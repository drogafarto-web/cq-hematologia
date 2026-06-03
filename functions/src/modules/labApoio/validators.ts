/**
 * validators.ts (server — labApoio module)
 *
 * Guarda de auth/access + schemas Zod para callables do módulo Lab Apoio.
 * Inclui validação de CNPJ (Mod-11 checksum) e AVS (Anvisa).
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const LABAPOIO_ACCESS_DENIED_MSG =
  'Sem permissão para este módulo — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Garante (em ordem):
 *   1. Caller autenticado
 *   2. Caller tem claim modules['lab-apoio'] === true
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *
 * Falhas viram `permission-denied` com mensagem padronizada + log.
 */
export async function assertLabApoioAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  const modulesClaim = (auth.token?.['modules'] ?? {}) as Record<string, unknown>;
  if (modulesClaim['lab-apoio'] !== true) {
    console.error('[LABAPOIO_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'missing_module_claim',
      ts,
    });
    throw new HttpsError('permission-denied', LABAPOIO_ACCESS_DENIED_MSG);
  }

  const memberSnap = await admin.firestore().doc(`labs/${labId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[LABAPOIO_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', LABAPOIO_ACCESS_DENIED_MSG);
  }
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function labApoioLabRoot(db: admin.firestore.Firestore, labId: string) {
  return db.doc(`labs/${labId}`);
}

export function labApoioCollection(db: admin.firestore.Firestore, labId: string) {
  return db.collection(`labs/${labId}/lab-apoio`);
}

export async function ensureLabApoioLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = labApoioLabRoot(db, labId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId }, { merge: true });
  }
}

// ─── CNPJ Validator (Mod-11 checksum) ─────────────────────────────────────────

/**
 * Valida CNPJ: 14 dígitos com checksum Mod-11 correto.
 * Retorna true se válido, false caso contrário.
 *
 * CNPJ format: XX.XXX.XXX/0001-YY onde YY é o checksum.
 * Aceita formato com ou sem máscara.
 */
export function validateCNPJ(cnpj: string): boolean {
  // Remove máscara
  const clean = cnpj.replace(/[^\d]/g, '');

  // Deve ter 14 dígitos
  if (clean.length !== 14) return false;

  // Sequências inválidas (todos iguais)
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Calcula verificadores
  let tamanho = clean.length - 2;
  let numeros = clean.substring(0, tamanho);
  const digitos = clean.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  tamanho = tamanho + 1;
  numeros = clean.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

  return true;
}

/**
 * Valida AVS (Autorização Válida de Supervisa) — Anvisa.
 * Conservative check: não-vazio + min 6 caracteres.
 * Anvisa AVS format varia; deixar validação rigorosa para auditores manuais.
 */
export function validateAVS(avs: string): boolean {
  const clean = avs.trim();
  return clean.length >= 6;
}

/**
 * Detecta vigência expirando em janela.
 * Retorna 'expired' (já vencido), 'critical' (≤30d), 'warning' (≤90d), 'ok' (>90d).
 *
 * @param vigenciaFim YYYY-MM-DD
 * @param referenceDate Data de referência (default: hoje)
 */
export function classifyAVSExpiry(
  vigenciaFim: string,
  referenceDate: Date = new Date(),
): 'expired' | 'critical' | 'warning' | 'ok' {
  const fim = new Date(vigenciaFim).getTime();
  const ref = referenceDate.getTime();
  const days = Math.floor((fim - ref) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'ok';
}

/**
 * RN-LABAPOIO-08 — Detecta sobreposição de vigência entre dois intervalos.
 * Dois contratos para o mesmo CNPJ não podem ter vigências sobrepostas
 * (RDC 978 Art. 36 — contrato vigente único).
 *
 * @param a Intervalo A { inicio, fim } em YYYY-MM-DD
 * @param b Intervalo B { inicio, fim } em YYYY-MM-DD
 * @returns true se sobrepõem
 */
export function vigenciaOverlaps(
  a: { inicio: string; fim: string },
  b: { inicio: string; fim: string },
): boolean {
  const aIni = new Date(a.inicio).getTime();
  const aFim = new Date(a.fim).getTime();
  const bIni = new Date(b.inicio).getTime();
  const bFim = new Date(b.fim).getTime();
  // Sobreposição clássica de intervalos fechados
  return aIni <= bFim && bIni <= aFim;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const CriticidadeSchema = z.enum(['baixa', 'media', 'alta']);
const ResultadoAvaliacaoSchema = z.enum(['aprovado', 'aprovado_com_ressalva', 'reprovado']);

const ExameItemSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(1),
  tat: z.number().min(1),
});

const CertificacaoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  dataValidade: z.any().nullable().optional(), // Timestamp — lax
  ativo: z.boolean(),
});

const ContatoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  funcao: z.string().min(1),
  telefone: z.string().optional(),
  email: z.string().email(),
});

const EnderecoSchema = z.object({
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  estado: z.string().regex(/^[A-Z]{2}$/),
  cep: z.string().regex(/^\d{8}$/),
});

export const CreateContratoInputSchema = z.object({
  labId: z.string().min(1),
  nome: z.string().min(1),
  razaoSocial: z.string().min(1),
  cnpj: z.string().min(1).refine(validateCNPJ, 'CNPJ inválido'),
  habilitacaoAnvisa: z.string().min(6),
  vigenciaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vigenciaFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  criticidade: CriticidadeSchema,
  exames: z.array(ExameItemSchema).min(1),
  endereco: EnderecoSchema,
  certificacoes: z.array(CertificacaoSchema).default([]),
  contatos: z.array(ContatoSchema).default([]),
  observacoes: z.string().max(2000).optional().nullable(),
  ativo: z.boolean().default(true),
});

export type CreateContratoInput = z.infer<typeof CreateContratoInputSchema>;

export const UpdateContratoInputSchema = z.object({
  labId: z.string().min(1),
  contratoId: z.string().min(1),
  observacoes: z.string().max(2000).optional().nullable(),
  contatos: z.array(ContatoSchema).optional(),
  certificacoes: z.array(CertificacaoSchema).optional(),
});

export type UpdateContratoInput = z.infer<typeof UpdateContratoInputSchema>;

export const SoftDeleteContratoInputSchema = z.object({
  labId: z.string().min(1),
  contratoId: z.string().min(1),
  motivo: z.string().min(10),
});

export type SoftDeleteContratoInput = z.infer<typeof SoftDeleteContratoInputSchema>;

export const RegistrarAvaliacaoInputSchema = z.object({
  labId: z.string().min(1),
  contratoId: z.string().min(1),
  avaliacao: z.object({
    data: z.any(), // Timestamp — lax
    resultado: ResultadoAvaliacaoSchema,
    responsavel: z.string().min(1),
    responsavelNome: z.string().min(1),
    observacoes: z.string().max(1000).optional(),
    anexoUrl: z.string().optional(),
  }),
});

export type RegistrarAvaliacaoInput = z.infer<typeof RegistrarAvaliacaoInputSchema>;

export const UploadContratoAnexoInputSchema = z.object({
  labId: z.string().min(1),
  contratoId: z.string().min(1),
  fileMeta: z.object({
    path: z.string(),
    size: z
      .number()
      .min(1)
      .max(10 * 1024 * 1024), // <10MB
    contentType: z.string().refine((ct) => ct === 'application/pdf', 'Apenas PDF permitido'),
  }),
});

export type UploadContratoAnexoInput = z.infer<typeof UploadContratoAnexoInputSchema>;
