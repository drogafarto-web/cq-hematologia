/**
 * acknowledgeEscalacao — RT acknowledges critical value escalation
 * Phase 5 (Wave 3): Stops further escalation attempts; logs event with chain signature
 *
 * Implements RDC 978 Art. 128 (rastreabilidade)
 * Implements DICQ 4.3 (actions on critical values)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { generateChainHash } from '../../shared/signature';
import type { AcknowledgeEscalacaoResponse, CriticosEscalacao, CriticosLogEvento } from './types';

const db = admin.firestore();

/**
 * Build a chained logical signature for a CriticosLogEvento.
 *
 * Per ADR-0017 + RDC 978 Art. 128: every audit entry carries a 64-hex
 * HMAC-SHA256 chain hash binding (operatorId, eventId, escalacaoId, tipo,
 * timestamp, detalhes) to the prior event's hash for the same escalacao,
 * making the trail tamper-evident.
 *
 * Returns both the signature (for the doc) and the previous event id
 * (for `eventoAnteriorId` linkage). When no prior event exists, chain
 * origin is null — matches ADR-0017 baseline-reset semantics.
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
  const { labId, escalacaoId, eventoId, tipo, detalhes, operadorId, ts } = params;

  // Fetch most recent prior event for this escalacao to chain against.
  const priorSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('criticos-log-eventos')
    .where('escalacaoId', '==', escalacaoId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  const prior = priorSnap.empty ? null : (priorSnap.docs[0].data() as CriticosLogEvento);
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

const AcknowledgeEscalacaoRequestSchema = z.object({
  labId: z.string().min(1),
  escalacaoId: z.string().min(1),
  acknowledgedBy: z.string().min(1),
  method: z.enum(['portal_web', 'webhook_twilio', 'manual_rt']),
  notas: z.string().optional(),
});

/**
 * Callable: RT acknowledges escalacao to stop further escalation attempts.
 *
 * Transactional update:
 *   1. Validate escalacao exists and status is 'enviado'
 *   2. Update escalacao: status = 'reconhecido', timestamps, acknowledgedBy
 *   3. Cancel pending SMS/email attempts (set status to 'descartado')
 *   4. Create audit log event with chain signature
 *
 * Returns SLA compliance metrics (tempoSlaMs, slaStatus).
 *
 * Auth: Requires RT role or admin.
 */
export const acknowledgeEscalacao = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<AcknowledgeEscalacaoResponse> => {
    try {
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      const data = AcknowledgeEscalacaoRequestSchema.parse(request.data);
      const { labId, escalacaoId, acknowledgedBy, method } = data;

      // Validate RT role (or admin)
      const claims = request.auth.token as any;
      const isRTOrAdmin = claims.role === 'RT' || claims.role === 'ADMIN' || claims.admin;
      if (!isRTOrAdmin) {
        throw new HttpsError('permission-denied', 'Requires RT or admin role');
      }

      const escalacaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('criticos-escalacoes')
        .doc(escalacaoId);

      const escalacaoDoc = await escalacaoRef.get();
      if (!escalacaoDoc.exists) {
        throw new HttpsError('not-found', 'Escalacao not found');
      }

      const escalacao = escalacaoDoc.data() as CriticosEscalacao;

      // Validate state: must be 'enviado' or 'sent' (not already acknowledged)
      if (escalacao.status !== 'enviado') {
        throw new HttpsError('failed-precondition', 'Escalacao already acknowledged or canceled');
      }

      const now = admin.firestore.Timestamp.now();
      const tempoSlaMs = now.toMillis() - escalacao.criadoEm.toMillis();

      const slaStatus =
        tempoSlaMs <= escalacao.sla_minutos_target * 60 * 1000 ? 'em_prazo' : 'vencido';

      // Count total attempts before canceling
      const totalAttempts = escalacao.escalacoes.length;

      // Mark pending attempts as cancelled (soft-cancel, don't delete)
      const cancelledEscalacoes = escalacao.escalacoes.map((attempt) => {
        if (attempt.status === 'enviado') {
          return {
            ...attempt,
            status: 'descartado',
          };
        }
        return attempt;
      });

      // Atomic writeBatch: update escalacao + create log event
      const batch = db.batch();

      // Update escalacao
      batch.update(escalacaoRef, {
        status: 'reconhecido',
        reconhecido_em: now,
        reconhecido_por: acknowledgedBy,
        tempo_deteccao_ms: tempoSlaMs,
        tempo_sla_ms: tempoSlaMs,
        sla_status: slaStatus,
        escalacoes: cancelledEscalacoes,
        atualizadoEm: now,
        atualizadoPor: request.auth.uid,
      });

      // Create audit log event
      const eventoRef = db.collection('labs').doc(labId).collection('criticos-log-eventos').doc();

      const ackDetalhes = {
        reconhecido_por: acknowledgedBy,
        metodo: method,
        tempo_sla_ms: tempoSlaMs,
        escalacoes_canceladas: totalAttempts,
        notas: data.notas || '',
      };

      const { assinatura: ackAssinatura, eventoAnteriorId: ackPriorId } =
        await buildLogEventoSignature({
          labId,
          escalacaoId,
          eventoId: eventoRef.id,
          tipo: 'reconhecimento_manual',
          detalhes: ackDetalhes,
          operadorId: request.auth.uid,
          ts: now,
        });

      batch.set(eventoRef, {
        id: eventoRef.id,
        labId,
        escalacaoId,
        laudoId: escalacao.laudoId,
        tipo: 'reconhecimento_manual',
        detalhes: ackDetalhes,
        timestamp: now,
        operadorId: request.auth.uid,
        assinatura: ackAssinatura,
        ...(ackPriorId ? { eventoAnteriorId: ackPriorId } : {}),
        deletadoEm: null,
      } as CriticosLogEvento);

      // Commit atomic transaction
      await batch.commit();

      return {
        success: true,
        escalacaoId,
        status: 'reconhecido',
        tempoSlaMs,
        slaStatus: slaStatus as 'em_prazo' | 'vencido',
      };
    } catch (error: any) {
      console.error('acknowledgeEscalacao error:', error);
      if (error instanceof HttpsError) throw error;

      throw new HttpsError('internal', error.message || 'Internal error');
    }
  },
);
