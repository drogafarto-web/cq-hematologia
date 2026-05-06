/**
 * personnel/signDesignacao.ts
 *
 * Cloud Function callable para assinar designação com LogicalSignature.
 * Operação atômica: valida payload + gera assinatura server-side + cria Designacao.
 *
 * DICQ 4.1.2.7 compliance: designação de GQ/RT/Diretor marcada com operador + timestamp + hash.
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { createHash } from 'node:crypto';

const db = getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignDesignacaoPayload {
  labId: string;
  cargoId: string;
  pessoaId: string;
  pessoaNome: string;
  dataInicio: number; // milliseconds
  dataFim?: number | null;
  descricaoAutoridade: string;
  successorId?: string;
}

// ─── Validation ────────────────────────────────────────────────────────────────

const SignDesignacaoSchema = z.object({
  labId: z.string().min(1),
  cargoId: z.string().min(1),
  pessoaId: z.string().min(1),
  pessoaNome: z.string().min(1),
  dataInicio: z.number().int().positive(),
  dataFim: z.number().int().positive().nullable().optional(),
  descricaoAutoridade: z.string().min(1),
  successorId: z.string().optional(),
});

const EC_ACCESS_DENIED_MSG = 'Sem permissão para este módulo — contate o administrador.';

/**
 * Asserta que o usuário tem acesso ao módulo personnel neste lab.
 */
async function assertPersonnelAccess(auth: any, labId: string): Promise<void> {
  if (!auth) {
    throw new Error(EC_ACCESS_DENIED_MSG);
  }

  // Verifica claim de módulo + membership
  const userDoc = await db.collection('users').doc(auth.uid).get();
  if (!userDoc.exists) {
    throw new Error(EC_ACCESS_DENIED_MSG);
  }

  const userData = userDoc.data();
  const modules = userData?.modules || {};
  const personnelAccess = modules['personnel'] || false;

  if (!personnelAccess) {
    throw new Error(EC_ACCESS_DENIED_MSG);
  }

  // Verifica se é membro ativo do lab
  const memberDoc = await db
    .collection('labs')
    .doc(labId)
    .collection('members')
    .doc(auth.uid)
    .get();

  if (!memberDoc.exists) {
    throw new Error(EC_ACCESS_DENIED_MSG);
  }

  const memberData = memberDoc.data();
  if (!memberData?.ativo) {
    throw new Error(EC_ACCESS_DENIED_MSG);
  }
}

/**
 * Calcula o hash canônico da designação.
 * Algoritmo: SHA256(labId + cargoId + pessoaId + dataInicio + descricaoAutoridade)
 */
function computeDesignacaoHash(payload: SignDesignacaoPayload, operatorId: string, ts: number): string {
  const canonical = `${payload.labId}|${payload.cargoId}|${payload.pessoaId}|${payload.dataInicio}|${payload.descricaoAutoridade}|${operatorId}|${ts}`;
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Cloud Function: sign-and-write designação atômica.
 */
export const signDesignacao = onCall<SignDesignacaoPayload>(
  {
    region: 'southamerica-east1',
    memory: '256MiB',
  },
  async (request) => {
    // 1. Autenticação obrigatória
    if (!request.auth) {
      throw new Error('Autenticação necessária.');
    }

    const { uid } = request.auth;
    const payload = request.data;

    // 2. Validação do payload
    try {
      SignDesignacaoSchema.parse(payload);
    } catch (err) {
      throw new Error(`Payload inválido: ${(err as any).message}`);
    }

    // 3. Permissão (módulo + membership)
    try {
      await assertPersonnelAccess(request.auth, payload.labId);
    } catch (err) {
      console.error('[PERSONNEL_ACCESS_DENIED]', uid, payload.labId);
      throw err;
    }

    // 4. Timestamp do servidor
    const now = Date.now();
    const ts = Timestamp.fromMillis(now);

    // 5. Gera assinatura
    const hash = computeDesignacaoHash(payload, uid, now);

    // 6. Cria documento atomicamente
    const designacaoRef = db
      .collection('personnel')
      .doc(payload.labId)
      .collection('designacoes')
      .doc();

    await designacaoRef.set({
      labId: payload.labId,
      cargoId: payload.cargoId,
      pessoaId: payload.pessoaId,
      pessoaNome: payload.pessoaNome,
      dataInicio: Timestamp.fromMillis(payload.dataInicio),
      dataFim: payload.dataFim ? Timestamp.fromMillis(payload.dataFim) : null,
      descricaoAutoridade: payload.descricaoAutoridade,
      successorId: payload.successorId ?? null,
      chainHash: {
        hash,
        operatorId: uid,
        ts,
      },
      certificadoUrl: null,
      criadoEm: ts,
      updatedAt: ts,
      deletadoEm: null,
    });

    return {
      designacaoId: designacaoRef.id,
      signature: {
        hash,
        operatorId: uid,
        ts: now,
      },
      success: true,
    };
  },
);
