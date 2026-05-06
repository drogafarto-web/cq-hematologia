/**
 * criarReclamacao — Cloud Function Callable
 *
 * Creates a new complaint (reclamação) via 6 channels:
 * 1. web-interno: internal staff intake form
 * 2. web-publico: public patient portal (with reCAPTCHA)
 * 3. email: Resend Inbound parser
 * 4. telefone: manual log by receptionist
 * 5. qr-laudo: QR code on laudo PDF (Plan 10-04)
 * 6. worklab-deep-link: embedded Worklab app
 *
 * Pipeline:
 * 1. Validate reCAPTCHA (public channel only)
 * 2. Validate CPF format
 * 3. Validate LGPD consent capture
 * 4. Create complaint with LogicalSignature
 * 5. Trigger classificarReclamacaoIA async
 * 6. Auto-create NC draft if severity alta (Plan 11-01 criarNCDraft)
 * 7. Send confirmation email to complainant (Resend)
 * 8. Return complaint ID + SLA deadline
 *
 * RN-06: Soft-delete only — no hard deletes
 * RN-11: LogicalSignature mandatory on create
 * RN-13: NC auto-trigger severity alta + descricao.length >= 100
 * LGPD: Consentimento obrigatório + IPAddress + UserAgent capture
 * CDC Lei 8.078/90 Art. 26: slaPrazo = 30 dias
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { createHash } from 'crypto';

type LabId = string;

interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
}

interface Reclamacao {
  id: string;
  labId: LabId;
  reclamante: {
    nome: string;
    cpf: string;
    email?: string;
    telefone?: string;
    consentimentoLgpd: {
      aceito: boolean;
      em: admin.firestore.Timestamp;
      ipAddress: string;
      userAgent: string;
    };
  };
  canalEntrada: string;
  descricao: string;
  status: string;
  slaPrazo: admin.firestore.Timestamp;
  responsavelId: string;
  anexos: any[];
  comunicacoes: any[];
  signature: LogicalSignature;
  chainHash: string;
  criadoEm: admin.firestore.Timestamp;
  deletadoEm: admin.firestore.Timestamp | null;
  origemDados: {
    source: string;
    metadata?: Record<string, any>;
  };
  classificacaoAuto?: {
    tipoSugerido: string;
    severidadeSugerida: string;
    areaSugerida: string;
    confidence: number;
    modeloVersao: string;
    rawResponse: string;
    geradoEm: admin.firestore.Timestamp;
  };
  classificacao?: any;
}

import { classificarSeveridadeHeuristica, shouldTriggerNCAutocreate } from './_shared/severityClassifier';

const db = admin.firestore();
const logger = functions.logger;

// ─────────────────────────────────────────────────────────────────────────────
// Input Validation (Zod)
// ─────────────────────────────────────────────────────────────────────────────

// Per SECURITY_AUDIT.md #3: replaced z.record(z.any()) with z.record(z.unknown())
// (caller still has to cast to use it server-side, no implicit any) and added
// length caps + .strict() on all object schemas to reject unknown keys.
// Also caps ipAddress (45 = max for IPv6 + zone) and userAgent (#14).
const CreateReclamacaoCallableInput = z.object({
  labId: z.string().min(1).max(100),
  canalEntrada: z.enum([
    'web-interno',
    'web-publico',
    'email',
    'telefone',
    'qr-laudo',
    'worklab-deep-link',
  ]),
  descricao: z.string().min(10, 'Descrição mínima 10 caracteres').max(10000),
  reclamante: z
    .object({
      nome: z.string().min(3).max(200),
      cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
      email: z.string().email().max(255).optional(),
      telefone: z.string().regex(/^\d{10,11}$/).optional(),
    })
    .strict(),
  consentimentoLgpd: z
    .object({
      aceito: z.literal(true, { errorMap: () => ({ message: 'Consentimento LGPD obrigatório' }) }),
      ipAddress: z.string().max(45),
      userAgent: z.string().max(1000),
    })
    .strict(),
  origemDados: z
    .object({
      source: z.string().min(1).max(100),
      // metadata: server consumers must validate before use. z.unknown() forces
      // explicit casts at the call site instead of silent any propagation.
      metadata: z.record(z.unknown()).optional(),
    })
    .strict(),
  recaptchaToken: z.string().max(2048).optional(),  // web-publico only
  anexos: z
    .array(
      z
        .object({
          storageUrl: z.string().url().max(2048),
          mimeType: z.string().max(255),
          size: z.number().int().nonnegative().max(50 * 1024 * 1024), // 50 MB cap
        })
        .strict()
    )
    .max(5)
    .optional(),
}).strict();

// ─────────────────────────────────────────────────────────────────────────────
// reCAPTCHA Validation
// ─────────────────────────────────────────────────────────────────────────────

async function validateRecaptcha(
  token: string,
  remoteip: string
): Promise<{ success: boolean; score: number; action: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    logger.warn('RECAPTCHA_SECRET_KEY not configured');
    return { success: false, score: 0, action: '' };
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: secretKey,
      response: token,
      remoteip,
    }).toString(),
  });

  const data = await response.json() as {
    success: boolean;
    score?: number;
    action?: string;
    challenge_ts?: string;
    hostname?: string;
    error_codes?: string[];
  };

  return {
    success: data.success,
    score: data.score ?? 0,
    action: data.action ?? '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature Generation (ADR 0001)
// ─────────────────────────────────────────────────────────────────────────────

function generateLogicalSignature(
  docData: Record<string, any>,
  uid: string,
  ts: admin.firestore.Timestamp
): LogicalSignature {
  const payload = JSON.stringify(docData);
  const hash = createHash('sha256').update(payload).digest('hex');

  return {
    hash,
    operatorId: uid,
    ts,
  };
}

function computeChainHash(
  prevHash: string,
  entityId: string,
  operation: string,
  ts: admin.firestore.Timestamp,
  uid: string
): string {
  const data = `${prevHash}|${entityId}|${operation}|${ts.toDate().toISOString()}|${uid}`;
  return createHash('sha256').update(data).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Callable: criarReclamacao
// ─────────────────────────────────────────────────────────────────────────────

export const criarReclamacao = functions.https.onCall(
  {
    region: 'southamerica-east1',
    memory: '512MiB' as any,
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      // 1. Validate auth
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      // 1b. Rate limit (SECURITY_AUDIT.md #18) — 60/min for authenticated users.
      // Channel may be public-facing (web-publico, email) but the callable still
      // requires Firebase auth (anonymous or signed-in). Key by uid to prevent
      // abuse from single account.
      const { enforceAuthenticatedRateLimit } = await import(
        '../../shared/rateLimit'
      );
      const rl = await enforceAuthenticatedRateLimit(
        request.auth.uid,
        'criarReclamacao',
        60,
      );
      if (!rl.allowed) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Muitas requisições. Tente novamente em ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
          { retryAfterSeconds: Math.ceil(rl.retryAfterMs / 1000) },
        );
      }

      // 2. Parse and validate input
      const data = CreateReclamacaoCallableInput.parse(request.data);
      const { labId, canalEntrada, descricao, reclamante, consentimentoLgpd, origemDados, recaptchaToken, anexos } = data;

      // 3. Verify lab membership
      const memberRef = db.collection('labs').doc(labId).collection('members').doc(request.auth.uid);
      const memberSnap = await memberRef.get();

      if (!memberSnap.exists || !memberSnap.data()?.active) {
        // Allow public channel without membership
        if (canalEntrada !== 'web-publico' && canalEntrada !== 'email' && canalEntrada !== 'worklab-deep-link' && canalEntrada !== 'qr-laudo') {
          throw new functions.https.HttpsError(
            'permission-denied',
            'Not an active member of this lab'
          );
        }
      }

      // 4. Validate reCAPTCHA for public channel
      if (canalEntrada === 'web-publico') {
        if (!recaptchaToken) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'reCAPTCHA token required for web-publico channel'
          );
        }

        const recaptchaResult = await validateRecaptcha(recaptchaToken, request.rawRequest.ip ?? '0.0.0.0');
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'reCAPTCHA validation failed (spam detected)'
          );
        }
      }

      // 5. Validate LGPD consent
      if (!consentimentoLgpd.aceito) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'LGPD consent is mandatory'
        );
      }

      // 6. Classify severity heuristically (will be overridden by Gemini async)
      const severityResult = classificarSeveridadeHeuristica(descricao);
      const shouldCreateNCDraft = shouldTriggerNCAutocreate(
        severityResult.severidade,
        descricao
      );

      // 7. Create complaint document
      const reclamacaoId = db.collection('labs').doc(labId).collection('reclamacoes').doc().id;
      const now = admin.firestore.Timestamp.now();
      const slaPrazo = new Date(now.toDate());
      slaPrazo.setDate(slaPrazo.getDate() + 30); // CDC 30 dias

      const reclamacaoData: Partial<Reclamacao> = {
        labId,
        canalEntrada,
        descricao,
        reclamante: {
          nome: reclamante.nome,
          cpf: reclamante.cpf,
          email: reclamante.email,
          telefone: reclamante.telefone,
          consentimentoLgpd: {
            aceito: consentimentoLgpd.aceito,
            em: now,
            ipAddress: consentimentoLgpd.ipAddress,
            userAgent: consentimentoLgpd.userAgent,
          },
        },
        origemDados,
        status: 'Nova',
        slaPrazo: admin.firestore.Timestamp.fromDate(slaPrazo),
        responsavelId: request.auth.uid,
        classificacaoAuto: undefined,
        classificacao: undefined as any, // Placeholder until Gemini classification
        anexos: anexos ?? [],
        comunicacoes: [],
        signature: {} as LogicalSignature, // Computed below
        chainHash: '', // Computed below
        criadoEm: now,
        deletadoEm: null,
      };

      // 8. Generate signature + chainHash
      const signature = generateLogicalSignature(
        { ...reclamacaoData, id: reclamacaoId },
        request.auth.uid,
        now
      );
      const chainHash = computeChainHash(
        '0'.repeat(64), // Genesis hash
        reclamacaoId,
        'create',
        now,
        request.auth.uid
      );

      reclamacaoData.signature = signature;
      reclamacaoData.chainHash = chainHash;

      // 9. Atomic write: reclamacao + audit log + LGPD audit
      const batch = db.batch();

      const reclamacaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('reclamacoes')
        .doc(reclamacaoId);

      batch.set(reclamacaoRef, reclamacaoData);

      // Log LGPD access
      const lgpdAuditRef = db
        .collection('labs')
        .doc(labId)
        .collection('lgpd-audit')
        .doc();

      batch.set(lgpdAuditRef, {
        labId,
        uid: request.auth.uid,
        action: 'reclamacao_create',
        resource: `reclamacoes/${reclamacaoId}`,
        motivo: 'Complaint submission with PII capture',
        em: now,
      });

      // Audit log
      const auditRef = db
        .collection('labs')
        .doc(labId)
        .collection('audit')
        .doc();

      batch.set(auditRef, {
        labId,
        recurso: 'reclamacoes',
        recursoId: reclamacaoId,
        operacao: 'create',
        ator: request.auth.uid,
        dados: {
          canalEntrada,
          reclamanteCPF: reclamante.cpf.slice(-4), // Masked
          severidadeHeuristica: severityResult.severidade,
        },
        em: now,
      });

      await batch.commit();

      // 10. Trigger async Gemini classification (fire and forget)
      try {
        // Schedule async callable
        await db
          .collection('_functions-queue')
          .add({
            function: 'classificarReclamacaoIA',
            labId,
            reclamacaoId,
            descricao,
            createdAt: now,
          });
      } catch (err) {
        logger.warn('Failed to queue Gemini classification', { error: err, reclamacaoId });
        // Continue — complaint created, classification can retry
      }

      // 11. Trigger NC auto-create if needed (fire and forget)
      if (shouldCreateNCDraft) {
        try {
          await db
            .collection('_functions-queue')
            .add({
              function: 'criarNCDraft',
              labId,
              reclamacaoId,
              createdAt: now,
            });
        } catch (err) {
          logger.warn('Failed to queue NC draft creation', { error: err, reclamacaoId });
        }
      }

      // 12. Send confirmation email (Resend) — fire and forget
      if (reclamante.email) {
        try {
          await db
            .collection('_mail-queue')
            .add({
              to: reclamante.email,
              template: 'reclamacao-recebida',
              data: {
                reclamacaoId,
                reclamanteName: reclamante.nome,
                slaPrazo: slaPrazo.toLocaleDateString('pt-BR'),
              },
            });
        } catch (err) {
          logger.warn('Failed to queue confirmation email', { error: err, reclamacaoId });
        }
      }

      return {
        success: true,
        reclamacaoId,
        status: 'Nova',
        slaPrazo: slaPrazo.toISOString(),
      };
    } catch (err) {
      logger.error('criarReclamacao error', err);

      if (err instanceof z.ZodError) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Validation error: ${err.errors[0].message}`
        );
      }

      if (err instanceof functions.https.HttpsError) {
        throw err;
      }

      throw new functions.https.HttpsError('internal', 'Unexpected error creating complaint');
    }
  }
);
