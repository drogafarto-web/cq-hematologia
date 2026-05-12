/**
 * validators.ts (server — risks module)
 *
 * Guarda de auth/access + schemas Zod para callables do módulo Risks.
 *
 * Paridade com turnos: mesma forma de `assertTurnosAccess`,
 * adaptada pro claim `modules['risks']`.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const RISKS_ACCESS_DENIED_MSG =
  'Sem permissão para este módulo — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Exige membro ativo com role `admin` ou `owner` (ex.: aprovação de risco crítico).
 * Chamar **após** `assertRisksAccess` (já valida auth + claim + membro ativo).
 */
export async function assertRisksAdminOrOwner(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const uid = auth.uid;
  const ts = new Date().toISOString();
  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${uid}`)
    .get();
  const role = memberSnap.data()?.['role'] as string | undefined;
  if (role !== 'admin' && role !== 'owner') {
    console.error('[RISKS_ADMIN_REQUIRED]', { uid, labId, role, ts });
    throw new HttpsError(
      'permission-denied',
      'Apenas administradores ou proprietários do laboratório podem aprovar risco crítico.',
    );
  }
}

/**
 * Garante (em ordem):
 *   1. Caller autenticado
 *   2. Caller tem claim modules['risks'] === true
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *
 * Falhas viram `permission-denied` com mensagem padronizada + log
 * `[RISKS_ACCESS_DENIED]` em Cloud Logging.
 */
export async function assertRisksAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  const modulesClaim = (auth.token?.['modules'] ?? {}) as Record<string, unknown>;
  if (modulesClaim['risks'] !== true) {
    console.error('[RISKS_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'missing_module_claim',
      ts,
    });
    throw new HttpsError('permission-denied', RISKS_ACCESS_DENIED_MSG);
  }

  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${uid}`)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[RISKS_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', RISKS_ACCESS_DENIED_MSG);
  }
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function risksLabRoot(db: admin.firestore.Firestore, labId: string) {
  return db.doc(`labs/${labId}`);
}

export function risksCollection(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.collection(`labs/${labId}/risks`);
}

export async function ensureRisksLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = risksLabRoot(db, labId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId }, { merge: true });
  }
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const ProbabilidadeSchema = z.number().int().min(1).max(5);
const SeveridadeSchema = z.number().int().min(1).max(5);
const DeteccaoSchema = z.number().int().min(1).max(5);
const CategoriaSchema = z.enum([
  'analise',
  'equipamento',
  'material',
  'pessoal',
  'processo',
  'seguranca',
  'outro',
]);
const ProcessoSchema = z.enum([
  'coleta',
  'armazenamento',
  'analise',
  'liberacao',
  'rastreabilidade',
]);
const StatusSchema = z.enum(['aberto', 'mitigando', 'monitorado', 'fechado']);
const EstrategiaSchema = z.enum(['evitar', 'mitigar', 'transferir', 'aceitar']);

export const CreateRiskInputSchema = z.object({
  labId: z.string().min(1),
  codigo: z.string().min(1),
  descricao: z.string().min(10).max(500),
  processo: ProcessoSchema,
  categoria: CategoriaSchema,
  probabilidade: ProbabilidadeSchema,
  severidade: SeveridadeSchema,
  deteccao: DeteccaoSchema,
  // Server recomputes NPR, but client can send it (server overrides)
  status: StatusSchema.optional().default('aberto'),
  tratamento: z.object({
    estrategia: EstrategiaSchema,
    acoes: z.array(z.object({
      id: z.string(),
      criadoEm: z.any(), // Timestamp
      descricao: z.string(),
      prazo: z.any(), // Timestamp
      owner: z.string(),
      status: z.enum(['planejada', 'em_andamento', 'concluida']),
    })).default([]),
    observacoes: z.string().optional(),
  }),
});

export type CreateRiskInput = z.infer<typeof CreateRiskInputSchema>;

export const UpdateRiskInputSchema = z.object({
  labId: z.string().min(1),
  riskId: z.string().min(1),
  probabilidade: ProbabilidadeSchema.optional(),
  severidade: SeveridadeSchema.optional(),
  deteccao: DeteccaoSchema.optional(),
  status: StatusSchema.optional(),
  tratamento: z.object({
    estrategia: EstrategiaSchema.optional(),
    acoes: z.array(z.any()).optional(),
    observacoes: z.string().optional(),
  }).optional(),
});

export type UpdateRiskInput = z.infer<typeof UpdateRiskInputSchema>;

export const SoftDeleteRiskInputSchema = z.object({
  labId: z.string().min(1),
  riskId: z.string().min(1),
  motivo: z.string().min(1).max(500),
});

export type SoftDeleteRiskInput = z.infer<typeof SoftDeleteRiskInputSchema>;

export const RegistrarRevisaoInputSchema = z.object({
  labId: z.string().min(1),
  riskId: z.string().min(1),
  revisao: z.object({
    criadoEm: z.any(), // Timestamp
    revisor: z.string(),
    revisorNome: z.string().optional(),
    resultado: z.enum(['mantido', 'reduzido', 'reclassificado', 'fechado']),
    observacoes: z.string().max(1000),
    nprPrevio: z.number().int().optional(),
    nprNovo: z.number().int().optional(),
    probabilidadeNova: ProbabilidadeSchema.optional(),
    severidadeNova: SeveridadeSchema.optional(),
    deteccaoNova: DeteccaoSchema.optional(),
  }),
});

export type RegistrarRevisaoInput = z.infer<typeof RegistrarRevisaoInputSchema>;

export const SeedFromCsvInputSchema = z.object({
  labId: z.string().min(1),
  rows: z.array(CreateRiskInputSchema).max(1000),
});

export type SeedFromCsvInput = z.infer<typeof SeedFromCsvInputSchema>;

/** Pelo menos um de `ncId` ou `capaId` (podem vir ambos na mesma chamada). */
export const VincularNcAoRiscoInputSchema = z
  .object({
    labId: z.string().min(1),
    riskId: z.string().min(1),
    ncId: z.string().min(1).optional(),
    capaId: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.ncId) || Boolean(d.capaId), {
    message: 'Informe ncId e/ou capaId.',
  });

export type VincularNcAoRiscoInput = z.infer<typeof VincularNcAoRiscoInputSchema>;

const LogicalSignatureInputSchema = z.object({
  hash: z
    .string()
    .length(64)
    .regex(/^[a-f0-9]+$/i, 'hash deve ser SHA-256 hex (64 caracteres).'),
  operatorId: z.string().min(1),
  ts: z.any(),
});

export const AprovarRiscoInputSchema = z.object({
  labId: z.string().min(1),
  riskId: z.string().min(1),
  logicalSignature: LogicalSignatureInputSchema,
});

export type AprovarRiscoInput = z.infer<typeof AprovarRiscoInputSchema>;

// ─── NPR Validation ─────────────────────────────────────────────────────────

/**
 * Server-side NPR validation: ensures client-supplied NPR (if any) matches
 * P × S × D computation. Returns the authoritative NPR.
 */
export function validateAndComputeNPR(
  probabilidade: number,
  severidade: number,
  deteccao: number,
  clientSuppliedNpr?: number,
): number {
  const serverNpr = probabilidade * severidade * deteccao;

  // Server always uses its own computation (defense in depth)
  if (clientSuppliedNpr !== undefined && clientSuppliedNpr !== serverNpr) {
    console.warn('[NPR_MISMATCH]', {
      clientSupplied: clientSuppliedNpr,
      serverComputed: serverNpr,
      probabilidade,
      severidade,
      deteccao,
    });
  }

  return serverNpr;
}
