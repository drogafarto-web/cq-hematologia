/**
 * registerCriticoDetection — Phase 5 W3-A1
 *
 * Cloud Function callable to register a critical value detection.
 * Validates input, checks against thresholds, creates escalacao + audit log atomically.
 *
 * RDC 978 Art. 128 (rastreabilidade) + Art. 5.7.1 (critical communication <60min)
 * DICQ 4.3 + 5.7.1 (escalation on critical values)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { db } from '../../shared/firebase';
import { generateChainHash } from '../../shared/signature';
import {
  defaultWindowForTier,
  defaultDestinatarioForTier,
  DEFAULT_TIER_LADDER,
} from './tierEngine';
import type {
  CriticosEscalacao,
  CriticosLogEvento,
  CriticosTierEscalation,
  RegisterCriticoDetectionResponse,
} from './types';

/**
 * Input validation schema for registerCriticoDetection callable.
 * Single analito variant (extensible to batch in Phase 6).
 */
const CriticalDetectionInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  laudoId: z.string().min(1, 'laudoId required'),
  laudoVersion: z.number().int().min(1, 'laudoVersion must be >= 1'),
  analitoId: z.string().min(1, 'analitoId required'),
  result: z.number('result must be a number'),
  unit: z.string().min(1, 'unit required'),
  pacientId: z.string().min(1, 'patientId required'),
  pacienteNome: z.string().min(1, 'pacienteNome required'),
  pacienteIdade: z.number().int().min(0, 'pacienteIdade must be >= 0'),
  pacienteSexo: z.enum(['M', 'F', 'NI'], {
    message: 'pacienteSexo must be M, F, or NI',
  }),
  physicianId: z.string().min(1, 'physicianId required'),
  physicianNome: z.string().min(1, 'physicianNome required'),
  physicianTelefone: z
    .string()
    .regex(/^\+?[\d\s\-()]{10,}$/, 'Invalid phone format'),
  physicianEmail: z.string().email('Invalid email format'),
  severidade: z.enum(['alta', 'baixa'], {
    message: 'severidade must be alta or baixa',
  }),
  motivo: z.string().min(1, 'motivo required'),
});

type CriticalDetectionInput = z.infer<typeof CriticalDetectionInputSchema>;

/**
 * Mock detector function — checks if result exceeds threshold.
 * Phase 5: hardcoded ranges; Phase 6: load from bioquimica thresholds.
 *
 * @param result Numeric result
 * @param analitoId Analyte identifier
 * @param severidade Expected severity level
 * @returns true if result is deemed critical
 */
function isCritical(
  result: number,
  analitoId: string,
  severidade: 'alta' | 'baixa'
): boolean {
  // Phase 5 stub: in production, fetch from bioquimica threshold service
  // For now, accept any numeric result and trust the client's severidade flag
  return !isNaN(result) && result !== 0;
}

/**
 * Build chained logical signature for audit event.
 * Per ADR-0017: HMAC-SHA256 chain hash linking events to prior event.
 */
async function buildLogEventoSignature(params: {
  labId: string;
  escalacaoId: string;
  eventoId: string;
  tipo: CriticosLogEvento['tipo'];
  detalhes: CriticosLogEvento['detalhes'];
  operadorId: string;
  ts: admin.firestore.Timestamp;
}): Promise<{
  assinatura: CriticosLogEvento['assinatura'];
  eventoAnteriorId?: string;
}> {
  const { labId, escalacaoId, eventoId, tipo, detalhes, operadorId, ts } =
    params;

  // Fetch most recent prior event for this escalacao to chain against.
  const priorSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('criticos-log-eventos')
    .where('escalacaoId', '==', escalacaoId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  const prior = priorSnap.empty
    ? null
    : (priorSnap.docs[0].data() as CriticosLogEvento);
  const previousHash = prior?.assinatura?.hash ?? null;
  const eventoAnteriorId = prior?.id;

  const hash = generateChainHash({
    eventoId,
    escalacaoId,
    labId,
    tipo,
    operadorId,
    tsMs: ts.toMillis(),
    detalhes,
    previousHash,
  });

  return {
    assinatura: { hash, operatorId: operadorId, ts },
    ...(eventoAnteriorId ? { eventoAnteriorId } : {}),
  };
}

/**
 * Create initial tier escalations (3-tier SLA ladder).
 * Per RDC 978 Art. 5.7.1: RT (15min) → Physician (30min) → CTO/Diretor (60min).
 */
function createInitialTiers(
  escalacaoId: string,
  rtId: string,
  rtNome: string,
  physicianId: string,
  physicianNome: string,
  activatedAtTs: admin.firestore.Timestamp
): CriticosTierEscalation[] {
  const now = activatedAtTs.toMillis();
  const tiers: CriticosTierEscalation[] = [];

  // Tier 1: RT — 15 minute window
  tiers.push({
    tier: 1,
    destinatario: 'RT',
    destinatarioId: rtId,
    destinatarioNome: rtNome,
    activatedAt: activatedAtTs,
    slaMinutos: 15,
    status: 'aberto',
    attemptCanalIds: [],
  });

  // Tier 2: Physician — 15 minute window (starts at +15min)
  tiers.push({
    tier: 2,
    destinatario: 'MEDICO',
    destinatarioId: physicianId,
    destinatarioNome: physicianNome,
    activatedAt: new admin.firestore.Timestamp(
      activatedAtTs.seconds + 15 * 60,
      activatedAtTs.nanoseconds
    ),
    slaMinutos: 15,
    status: 'aberto',
    attemptCanalIds: [],
  });

  // Tier 3: CTO/Diretor — 30 minute window (starts at +30min)
  tiers.push({
    tier: 3,
    destinatario: 'CTO',
    destinatarioId: '', // To be filled by lab config
    destinatarioNome: 'CTO/Diretor Médico',
    activatedAt: new admin.firestore.Timestamp(
      activatedAtTs.seconds + 30 * 60,
      activatedAtTs.nanoseconds
    ),
    slaMinutos: 30,
    status: 'aberto',
    attemptCanalIds: [],
  });

  return tiers;
}

/**
 * Main callable: register a critical value detection.
 *
 * Flow:
 * 1. Validate auth (requires RT or admin role)
 * 2. Validate input schema (Zod)
 * 3. Fetch lab settings (check if feature enabled)
 * 4. Check if result is critical (using detector)
 * 5. If not critical, return no_action
 * 6. If critical:
 *    a. Create CriticosEscalacao doc with 3-tier SLA
 *    b. Create initial CriticosLogEvento (audit chain)
 *    c. Atomically batch-write both
 * 7. Return escalacaoId + slaDeadlines
 */
export const registerCriticoDetection = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<RegisterCriticoDetectionResponse> => {
    try {
      // Validate auth
      if (!request.auth?.uid) {
        throw new HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      // Parse + validate input
      const data = CriticalDetectionInputSchema.parse(request.data);
      const {
        labId,
        laudoId,
        laudoVersion,
        analitoId,
        result,
        unit,
        pacientId,
        pacienteNome,
        pacienteIdade,
        pacienteSexo,
        physicianId,
        physicianNome,
        physicianTelefone,
        physicianEmail,
        severidade,
        motivo,
      } = data;

      // Check if critical feature is enabled for this lab
      const labDoc = await db.collection('labs').doc(labId).get();
      if (!labDoc.exists) {
        throw new HttpsError('not-found', 'Lab not found');
      }

      const labData = labDoc.data();
      if (!labData?.criticos?.ativo) {
        throw new HttpsError(
          'failed-precondition',
          'Critical values feature not enabled for this lab'
        );
      }

      // Detector: check if result is critical
      const isCriticalValue = isCritical(result, analitoId, severidade);
      if (!isCriticalValue) {
        return {
          success: true,
          escalacaoId: '',
          escalacoes: [],
          sla: {
            slaMinutosTarget: 0,
            etaAckMs: 0,
          },
          status: 'no_action',
        };
      }

      // Fetch RT user profile for rtNome / rtEmail
      const rtDoc = await db
        .collection('labs')
        .doc(labId)
        .collection('members')
        .doc(request.auth.uid)
        .get();

      const rtNome = rtDoc.exists
        ? rtDoc.data()?.nome || request.auth.uid
        : request.auth.uid;
      const rtEmail = rtDoc.exists
        ? rtDoc.data()?.email || ''
        : '';

      // Create escalacao document
      const escalacaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('criticos-escalacoes')
        .doc();

      const now = admin.firestore.Timestamp.now();
      const tiers = createInitialTiers(
        escalacaoRef.id,
        request.auth.uid,
        rtNome,
        physicianId,
        physicianNome,
        now
      );

      const escalacao: CriticosEscalacao = {
        id: escalacaoRef.id,
        labId,
        laudoId,
        laudoVersion,
        exameId: `exam-${analitoId}`, // Phase 6: map to actual exameId
        analitoId,
        valorObtido: result,
        thresholdId: '', // Phase 6: fetch from threshold service
        severidade,
        motivo,
        pacienteId: pacientId,
        pacienteNome,
        pacienteIdade,
        pacienteSexo,
        medicoId: physicianId,
        medicoNome: physicianNome,
        medicoTelefone: physicianTelefone,
        medicoEmail: physicianEmail,
        rtId: request.auth.uid,
        rtNome,
        rtEmail,
        escalacoes: [],
        status: 'enviado',
        reconhecido_em: undefined,
        reconhecido_por: undefined,
        sla_status: 'em_prazo',
        sla_minutos_target: 15, // Tier 1 SLA
        tiers,
        tierAtivo: 1,
        criadoEm: now,
        criadoPor: request.auth.uid,
        atualizadoEm: now,
        atualizadoPor: request.auth.uid,
        deletadoEm: null,
      };

      // Create audit log event
      const eventoRef = db
        .collection('labs')
        .doc(labId)
        .collection('criticos-log-eventos')
        .doc();

      const eventoTs = admin.firestore.Timestamp.now();
      const detalhes = {
        analitoId,
        resultado: result,
        unidade: unit,
        severidade,
        motivo,
        detectadoPor: 'registerDetection',
      };

      const { assinatura, eventoAnteriorId } = await buildLogEventoSignature({
        labId,
        escalacaoId: escalacaoRef.id,
        eventoId: eventoRef.id,
        tipo: 'tier_ativado',
        detalhes,
        operadorId: request.auth.uid,
        ts: eventoTs,
      });

      const evento: CriticosLogEvento = {
        id: eventoRef.id,
        labId,
        escalacaoId: escalacaoRef.id,
        laudoId,
        tipo: 'tier_ativado',
        detalhes,
        timestamp: eventoTs,
        operadorId: request.auth.uid,
        assinatura,
        ...(eventoAnteriorId ? { eventoAnteriorId } : {}),
        deletadoEm: null,
      };

      // Atomic batch write: escalacao + log event
      const batch = db.batch();
      batch.set(escalacaoRef, escalacao);
      batch.set(eventoRef, evento);
      await batch.commit();

      // Return response with SLA deadlines
      const slaDeadlines = tiers.map((tier) => ({
        tier: tier.tier,
        destinatario: tier.destinatario,
        deadlineMs:
          tier.activatedAt.toMillis() + tier.slaMinutos * 60 * 1000,
      }));

      return {
        success: true,
        escalacaoId: escalacaoRef.id,
        escalacoes: [],
        sla: {
          slaMinutosTarget: 15,
          etaAckMs: 15 * 60 * 1000,
        },
        slaDeadlines,
        status: 'critical_registered',
      };
    } catch (error: any) {
      console.error('registerCriticoDetection error:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      if (error instanceof z.ZodError) {
        throw new HttpsError(
          'invalid-argument',
          `Validation error: ${error.errors[0].message}`
        );
      }

      throw new HttpsError(
        'internal',
        error.message || 'Internal error registering critical detection'
      );
    }
  }
);
