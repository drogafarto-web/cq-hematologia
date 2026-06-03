/**
 * src/features/reclamacoes/types/mp6.ts
 *
 * MP-6 (v1.4-final-closure) domain types for the reclamações Phase-2 surface.
 * Pure types — zero logic, zero non-type imports. Lives alongside the
 * established Phase-11 types (reclamacao.ts / rca.ts) without colliding.
 *
 * Compliance hooks:
 *  - RDC 978/2025 Art. 86 (gestão de não-conformidades + ações corretivas)
 *  - DICQ 4.14.3 (reclamações), 4.14.6 (gestão de riscos via RCA Five Whys)
 *  - LGPD Art. 9/11/13/17 (consent gate, anonymization, transparency, deletion)
 *
 * Intentional duplication note:
 *  - `LogicalSignature` here uses a numeric `ts` (epoch ms) so the same shape
 *    travels through Cloud Function callable JSON without losing fidelity.
 *    The Phase-11 `LogicalSignature` (in `./reclamacao.ts`) uses a Firestore
 *    `Timestamp` because that file is consumed exclusively by direct-Firestore
 *    services. They are two valid wire formats for the same logical concept.
 */

export type ReclamacaoCanal = 'patient-portal' | 'phone' | 'email' | 'in-person' | 'social-media';

export type ReclamacaoStatus =
  | 'new' // submitted by patient, awaiting triage
  | 'triaged' // admin reviewed, classified
  | 'rca-in-progress' // Five Whys workflow open
  | 'rca-completed' // root cause identified
  | 'capa-linked' // a CAPA opened from this complaint
  | 'closed' // resolved
  | 'rejected'; // not actionable (out of scope, duplicate, etc.)

export type ReclamacaoSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Wire-format signature attached to regulatory state transitions.
 * `hash` MUST be SHA-256 hex (64 chars). `operatorId` MUST equal `request.auth.uid`
 * server-side (callable enforces). `ts` is epoch ms.
 */
export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: number;
}

export interface ReclamacaoAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';
  storagePath: string;
  hash: string; // SHA-256 hex64
  uploadedAt: number;
}

export interface RCAFiveWhysAnswer {
  level: 1 | 2 | 3 | 4 | 5;
  question: string; // "Por que X aconteceu?"
  answer: string;
  answeredBy: string;
  answeredAt: number;
}

export interface RCAFiveWhys {
  workflowId: string;
  startedAt: number;
  startedBy: string;
  answers: RCAFiveWhysAnswer[]; // length 0..5
  rootCause?: string; // populated when answers.length === 5
  completedAt?: number;
  completedBy?: string;
  signature?: LogicalSignature;
}

export interface Reclamacao {
  id: string;
  labId: string;
  canal: ReclamacaoCanal;
  status: ReclamacaoStatus;
  severity: ReclamacaoSeverity;
  patientName?: string; // optional (anonymous complaints permitted)
  patientContact?: string; // email or phone (LGPD: encrypted at rest server-side)
  consentToken?: string; // LGPD consent token if patient identified themselves
  description: string; // ≥ 30 chars
  attachments: ReclamacaoAttachment[];
  signaturePatient?: LogicalSignature; // when submitted via portal
  rca?: RCAFiveWhys;
  capaId?: string; // link to capa-tracking doc when escalated
  createdAt: number;
  triagedAt?: number;
  triagedBy?: string;
  closedAt?: number;
  closedBy?: string;
  closingReason?: string;
  deletedAt?: number;
}

export interface CreateReclamacaoInput {
  labId: string;
  canal: ReclamacaoCanal;
  patientName?: string;
  patientContact?: string;
  consentToken?: string;
  description: string;
  attachmentIds?: string[];
}

/**
 * Default Five Whys question prompts (PT-BR). Admin can override per level
 * inline in the workflow component. Locked at 5 elements.
 */
export const RCA_QUESTION_TEMPLATES: readonly [string, string, string, string, string] = [
  'Por que isso aconteceu?',
  'Por que essa causa imediata existiu?',
  'Por que esse fator contribuinte estava presente?',
  'Por que o sistema permitiu essa condição?',
  'Por que essa falha sistêmica não foi detectada antes?',
] as const;
