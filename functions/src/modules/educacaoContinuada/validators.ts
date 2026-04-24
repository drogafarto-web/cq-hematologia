/**
 * validators.ts — schemas Zod + helpers de auth/access para callables EC.
 *
 * Toda callable do módulo educacaoContinuada importa daqui: garante que a
 * mesma mensagem é retornada ao usuário em qualquer caminho de negação
 * (claim ausente / lab membership inativa / lab errado).
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

// ─── Mensagem padronizada ────────────────────────────────────────────────────
// UI exibe esta string sem alteração — não vazar detalhes técnicos
// (uid/labId/path) ao cliente, apenas para Cloud Logging.
export const EC_ACCESS_DENIED_MSG =
  'Sem permissão para este módulo — contate o administrador.';

// ─── Auth/access guard ───────────────────────────────────────────────────────

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Garante:
 *   1. Caller autenticado
 *   2. Caller tem claim modules['educacao-continuada'] === true
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *
 * Falhas viram `permission-denied` com `EC_ACCESS_DENIED_MSG`. Sempre logam
 * via console.error com prefixo `[EC_ACCESS_DENIED]` para Cloud Logging.
 */
export async function assertEcAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  // 1. Claim do módulo
  const modulesClaim = (auth.token?.['modules'] ?? {}) as Record<string, unknown>;
  if (modulesClaim['educacao-continuada'] !== true) {
    console.error('[EC_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'missing_module_claim',
      ts,
    });
    throw new HttpsError('permission-denied', EC_ACCESS_DENIED_MSG);
  }

  // 2. Membership ativa no lab solicitado
  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${uid}`)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[EC_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', EC_ACCESS_DENIED_MSG);
  }
}

// ─── Schemas Zod (inputs das callables) ──────────────────────────────────────

const EcPayloadSchema = z.record(z.string(), z.union([z.string(), z.number()]));

const PresencaSchema = z.object({
  colaboradorId: z.string().min(1),
  presente: z.boolean(),
});

export const MintSignatureInputSchema = z.object({
  labId: z.string().min(1),
  payloads: z.array(EcPayloadSchema).min(1).max(500),
});
export type MintSignatureInput = z.infer<typeof MintSignatureInputSchema>;

export const CommitExecucaoRealizadaInputSchema = z.object({
  labId: z.string().min(1),
  /** null → criar nova execução já como 'realizado'. */
  execucaoId: z.string().min(1).nullable(),
  treinamentoId: z.string().min(1),
  /** millis epoch (transport JSON-friendly). */
  dataPlanejada: z.number().int().nonnegative(),
  /** millis epoch. */
  dataAplicacao: z.number().int().nonnegative(),
  ministrante: z.string().trim().min(1),
  pauta: z.string().trim().min(1),
  presencas: z.array(PresencaSchema).min(1),
  diasAntecedenciaAlerta: z.number().int().min(0).max(365),
});
export type CommitExecucaoRealizadaInput = z.infer<
  typeof CommitExecucaoRealizadaInputSchema
>;

export const CommitExecucaoAdiadaInputSchema = z.object({
  labId: z.string().min(1),
  execucaoOriginalId: z.string().min(1),
  /** millis epoch. */
  novaDataPlanejada: z.number().int().nonnegative(),
  motivo: z.string().trim().min(1),
});
export type CommitExecucaoAdiadaInput = z.infer<
  typeof CommitExecucaoAdiadaInputSchema
>;

export const RegistrarEficaciaInputSchema = z.object({
  labId: z.string().min(1),
  execucaoId: z.string().min(1),
  resultado: z.enum(['eficaz', 'ineficaz']),
  evidencia: z.string().trim().min(1),
  /** millis epoch. */
  dataAvaliacao: z.number().int().nonnegative(),
  acaoCorretiva: z.string().trim().min(1).optional(),
  /** Quando true, cria com dataFechamento = serverTimestamp. */
  fechar: z.boolean().default(false),
});
export type RegistrarEficaciaInput = z.infer<typeof RegistrarEficaciaInputSchema>;

export const FecharEficaciaInputSchema = z.object({
  labId: z.string().min(1),
  avaliacaoId: z.string().min(1),
  /** Se ineficaz, vira obrigatório (re-validado server-side). */
  acaoCorretiva: z.string().trim().min(1).optional(),
});
export type FecharEficaciaInput = z.infer<typeof FecharEficaciaInputSchema>;

export const RegistrarCompetenciaInputSchema = z.object({
  labId: z.string().min(1),
  execucaoId: z.string().min(1),
  colaboradorId: z.string().min(1),
  metodo: z.enum([
    'observacao_direta',
    'teste_escrito',
    'simulacao_pratica',
    'revisao_registro',
  ]),
  resultado: z.enum(['aprovado', 'reprovado', 'requer_retreinamento']),
  evidencia: z.string().trim().min(1),
  /** millis epoch. */
  dataAvaliacao: z.number().int().nonnegative(),
  /** millis epoch — obrigatório quando resultado === 'reprovado'. */
  proximaAvaliacaoEm: z.number().int().nonnegative().optional(),
  // avaliadorId NUNCA vem do input — server injeta auth.uid
});
export type RegistrarCompetenciaInput = z.infer<
  typeof RegistrarCompetenciaInputSchema
>;

// ─── Helpers de path ─────────────────────────────────────────────────────────

export function ecLabRoot(db: admin.firestore.Firestore, labId: string) {
  return db.doc(`educacaoContinuada/${labId}`);
}

export function ecCollection(
  db: admin.firestore.Firestore,
  labId: string,
  name:
    | 'colaboradores'
    | 'treinamentos'
    | 'execucoes'
    | 'participantes'
    | 'avaliacoesEficacia'
    | 'avaliacoesCompetencia'
    | 'alertasVencimento'
    // Fase 7
    | 'trilhas'
    | 'progressosTrilha'
    // Fase 8
    | 'questoes'
    | 'questoesGabarito'
    | 'avaliacoesTeste'
    | 'respostasAvaliacao'
    // Fase 9
    | 'certificados',
) {
  return db.collection(`educacaoContinuada/${labId}/${name}`);
}

/**
 * Garante que o doc raiz `educacaoContinuada/{labId}` existe — espelha o
 * `ensureLabRoot` do service web. Idempotente.
 */
export async function ensureEcLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = ecLabRoot(db, labId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId });
  }
}

// ─── RN-05 helper ────────────────────────────────────────────────────────────

const MESES_POR_PERIODICIDADE: Record<string, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export function calcularDataVencimento(
  dataAplicacao: admin.firestore.Timestamp,
  periodicidade: string,
): admin.firestore.Timestamp {
  const meses = MESES_POR_PERIODICIDADE[periodicidade];
  if (typeof meses !== 'number') {
    throw new HttpsError(
      'failed-precondition',
      `Periodicidade desconhecida: ${periodicidade}`,
    );
  }
  const d = dataAplicacao.toDate();
  d.setMonth(d.getMonth() + meses);
  return admin.firestore.Timestamp.fromDate(d);
}
