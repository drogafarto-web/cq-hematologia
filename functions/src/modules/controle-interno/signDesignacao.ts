/**
 * ci_signDesignacao — Cloud Function callable para assinatura digital de designações CAPA.
 *
 * Fluxo:
 * 1. Client envia: {labId, operatorId, cargoId, startDate, endDate, rtId}
 * 2. Server valida:
 *    - Autenticação + membership ativo em lab
 *    - Cargo existe e não está deletado
 *    - Operador existe (validação FK)
 *    - RT é membro ativo com role suficiente
 * 3. Server gera LogicalSignature (HMAC-SHA256) com rtId como operatorId
 * 4. Server cria doc imutável em /labs/{labId}/designacoes/{docId}
 * 5. Server grava auditLog entry em subcoleção
 * 6. Return {designacaoId, seal, createdAt}
 *
 * RDC 978 Art. 122 — Supervisão de turnos + Designações
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

// ─── Schemas Zod ────────────────────────────────────────────────────────────

const SignDesignacaoInputSchema = z.object({
  labId: z.string().min(1, 'labId obrigatório'),
  operatorId: z.string().min(1, 'operatorId obrigatório'),
  cargoId: z.string().min(1, 'cargoId obrigatório'),
  startDate: z.number().int().nonnegative('startDate deve ser millis epoch válidos'),
  endDate: z.number().int().nonnegative('endDate deve ser millis epoch válidos').nullable(),
  rtId: z.string().min(1, 'rtId (Responsável Técnico) obrigatório'),
});

type SignDesignacaoInput = z.infer<typeof SignDesignacaoInputSchema>;

interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: admin.firestore.Timestamp;
}

interface SignDesignacaoResult {
  designacaoId: string;
  seal: LogicalSignature;
  createdAt: number;
}

// ─── Signature generation (server-side canonical) ──────────────────────────

import { createHash } from 'node:crypto';

function sortedStringify(payload: Record<string, string | number>): string {
  const sorted: Record<string, string | number> = {};
  for (const key of Object.keys(payload).sort()) {
    sorted[key] = payload[key];
  }
  return JSON.stringify(sorted);
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateSignatureForDesignacao(
  rtId: string,
  cargoNivel: number,
  startDate: number,
  endDate: number | null,
  ts: admin.firestore.Timestamp,
): LogicalSignature {
  const dataString = JSON.stringify({
    operatorId: rtId,
    ts: ts.toMillis(),
    data: sortedStringify({
      cargoNivel: cargoNivel.toString(),
      startDate: startDate.toString(),
      endDate: (endDate ?? 0).toString(),
    }),
  });
  return {
    hash: sha256Hex(dataString),
    operatorId: rtId,
    ts,
  };
}

// ─── Access control helpers ──────────────────────────────────────────────────

async function assertLabAccess(
  auth: { uid: string; token?: Record<string, unknown> } | undefined,
  labId: string,
): Promise<string> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const db = admin.firestore();
  const memberSnap = await db.doc(`labs/${labId}/members/${auth.uid}`).get();

  if (!memberSnap.exists || memberSnap.data()?.['status'] !== 'active') {
    throw new HttpsError(
      'permission-denied',
      'Sem acesso ao laboratório. Contate o administrador.',
    );
  }

  return auth.uid;
}

async function assertRtRole(labId: string, rtId: string): Promise<void> {
  const db = admin.firestore();
  const rtSnap = await db.doc(`labs/${labId}/members/${rtId}`).get();

  if (!rtSnap.exists || rtSnap.data()?.['status'] !== 'active') {
    throw new HttpsError(
      'failed-precondition',
      'Responsável Técnico não é membro ativo do laboratório.',
    );
  }

  const role = rtSnap.data()?.['role'] as string | undefined;
  if (!['RT', 'owner', 'admin'].includes(role ?? '')) {
    throw new HttpsError(
      'failed-precondition',
      'Apenas Responsável Técnico, admin ou owner podem assinar designações.',
    );
  }
}

async function cargoExists(labId: string, cargoId: string): Promise<number> {
  const db = admin.firestore();
  const cargoSnap = await db.doc(`labs/${labId}/cargos/${cargoId}`).get();

  if (!cargoSnap.exists || cargoSnap.data()?.['deletadoEm'] !== null) {
    throw new HttpsError('not-found', 'Cargo não encontrado ou arquivado.');
  }

  const nivel = cargoSnap.data()?.['nivel'] as number | undefined;
  if (typeof nivel !== 'number' || nivel < 1 || nivel > 5) {
    throw new HttpsError('invalid-argument', 'Cargo com nível inválido.');
  }

  return nivel;
}

async function operatorExists(labId: string, operatorId: string): Promise<void> {
  const db = admin.firestore();
  const userSnap = await db.doc(`labs/${labId}/members/${operatorId}`).get();

  if (!userSnap.exists || userSnap.data()?.['status'] !== 'active') {
    throw new HttpsError('not-found', 'Operador não é membro ativo do laboratório.');
  }
}

// ─── Main callable ──────────────────────────────────────────────────────────

export const ci_signDesignacao = onCall<SignDesignacaoInput, Promise<SignDesignacaoResult>>(
  {},
  async (request) => {
    const parsed = SignDesignacaoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }

    const input = parsed.data;
    const db = admin.firestore();

    // ─── Validations ────────────────────────────────────────────────────────
    // 1. Caller has lab access
    await assertLabAccess(request.auth, input.labId);

    // 2. RT has necessary role
    await assertRtRole(input.labId, input.rtId);

    // 3. Cargo exists + fetch its nivel
    const cargoNivel = await cargoExists(input.labId, input.cargoId);

    // 4. Operator exists in lab
    await operatorExists(input.labId, input.operatorId);

    // ─── Signature generation ────────────────────────────────────────────────
    const now = admin.firestore.Timestamp.now();
    const signature = generateSignatureForDesignacao(
      input.rtId,
      cargoNivel,
      input.startDate,
      input.endDate,
      now,
    );

    // ─── Atomic write ───────────────────────────────────────────────────────
    const designacaoRef = db.collection('labs').doc(input.labId).collection('designacoes').doc();

    const designacaoDoc = {
      labId: input.labId,
      operatorId: input.operatorId,
      cargoId: input.cargoId,
      cargoNivel,
      dataInicio: admin.firestore.Timestamp.fromMillis(input.startDate),
      dataFim: input.endDate ? admin.firestore.Timestamp.fromMillis(input.endDate) : null,
      assinatura: {
        hash: signature.hash,
        operatorId: signature.operatorId,
        ts: signature.ts,
      },
      criadoEm: now,
      deletadoEm: null,
    };

    const auditLogRef = designacaoRef.collection('auditLog').doc();
    const auditEntry = {
      action: 'created',
      creatorId: request.auth!.uid,
      rtId: input.rtId,
      operatorId: input.operatorId,
      cargoId: input.cargoId,
      timestamp: now,
      severity: 'info',
      notes: `Designação criada para operador ${input.operatorId} no cargo ${input.cargoId}`,
    };

    const batch = db.batch();
    batch.set(designacaoRef, designacaoDoc);
    batch.set(auditLogRef, auditEntry);

    try {
      await batch.commit();
    } catch (err) {
      console.error('[CI_SIGN_DESIGNACAO_WRITE_FAILED]', {
        labId: input.labId,
        operatorId: input.operatorId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError('internal', 'Erro ao gravar designação. Contate o administrador.');
    }

    return {
      designacaoId: designacaoRef.id,
      seal: signature,
      createdAt: now.toMillis(),
    };
  },
);
