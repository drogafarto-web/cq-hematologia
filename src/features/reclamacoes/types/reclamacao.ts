/**
 * Reclamacao Domain Types
 *
 * Complete feedback loop types for DICQ 4.8 (Complaint Handling) + 4.14.3 (Satisfaction) integration.
 * Multi-tenant: all entities scoped to `/labs/{labId}/reclamacoes/` Firestore paths.
 *
 * Compliance: RDC 978/2025 (Arts. 86, 115, 117 — 5-year retention), CDC Lei 8.078/90 (Arts. 6, 26),
 * LGPD Lei 13.709/18 (Arts. 7, 8, 9, 11, 18), ISO 15189:2015 (§4.8, §5.6.1).
 */

import type { Timestamp } from 'firebase/firestore';

/** ─── Audit / Signature ─────────────────────────────────────────────────────── */

/** Immutable signature per ADR 0001 — logical time + operator + hash chain */
export interface LogicalSignature {
  hash: string; // sha256(doc_before + doc_after + operatorId + ts), 64 chars hex
  operatorId: string; // request.auth.uid (verified by Firestore rules)
  ts: Timestamp; // server timestamp
}

/** Sequential chain hash per lab — replicates ADR 0001 pattern for audit trail */
export interface ChainHashEntry {
  seq: number; // sequential counter per lab
  entityId: string; // reclamacao/sugestao/satisfacao ID
  entityType: 'reclamacao' | 'sugestao' | 'satisfacao';
  hash: string; // sha256(previous_hash + entity_before + entity_after)
  operatorId: string;
  ts: Timestamp;
}

/** ─── LGPD / Consent ────────────────────────────────────────────────────────── */

/** GDPR/LGPD consent capture at intake */
export interface ConsentimentoLgpd {
  aceito: boolean; // must be true to create complaint
  em: Timestamp; // consent timestamp
  ipAddress: string; // non-PII hash (for forensics, not tracking)
  userAgent: string; // non-PII (browser info)
  versao: string; // consent text version for legal proof
}

/** ─── Complaint Intake ──────────────────────────────────────────────────────── */

/** Complaint intake channel — 6 possible entry points */
export type CanalEntrada =
  | 'web-interno' // RT/reception internal web form
  | 'web-publico' // Patient public web form `/portal-paciente/reclamacao/nova`
  | 'email' // Email parser via Resend Inbound
  | 'telefone' // Manual phone log UI
  | 'qr-laudo' // QR code embedded in PDF report
  | 'worklab-deep-link'; // Worklab app deep link

/** Metadata for tracking complaint origin (exam code, lab, source system) */
export interface OrigemDados {
  source: string; // 'web-interno', 'worklab', 'sistema-externo', etc.
  metadata: Record<string, any>; // { examCode, laudoId, nomeExame, dataExame, ... }
}

/** Complaint complainant (required PII — anonymous complaints not allowed in MVP) */
export interface Reclamante {
  nome: string;
  cpf: string; // required for audit, notification, RDC 978
  email?: string;
  telefone?: string;
  consentimentoLgpd: ConsentimentoLgpd;
}

/** Complaint attachment metadata (stored in Cloud Storage) */
export interface AnexoReclamacao {
  storageUrl: string; // gs://bucket/path/filename
  mimeType: string; // image/png, application/pdf, etc.
  size: number; // bytes
  uploadedEm: Timestamp;
}

/** ─── Auto-Classification (Gemini) ──────────────────────────────────────────── */

/** AI-suggested classification (before RT approval) */
export interface ClassificacaoAuto {
  tipoSugerido: string; // one of Tipo enum below
  severidadeSugerida: string; // 'alta' | 'media' | 'baixa'
  areaSugerida: string; // one of Area enum below
  confidence: number; // 0.0-1.0 from Gemini confidence
  modeloVersao: string; // 'gemini-2.5-flash@2026-06'
  rawResponse: string; // raw JSON from Gemini for audit trail
  geradoEm: Timestamp;
}

/** Complaint type categories (6 fixed + extensible) */
export type TipoReclamacao =
  | 'laudo-errado' // wrong test result
  | 'demora' // delivery delay
  | 'atendimento' // patient service issue
  | 'valor-cobrado' // billing error
  | 'amostra-hemolisada' // hemolyzed sample (pre-analytical)
  | 'outro'; // other

/** Severity classification */
export type SeveridadeReclamacao = 'alta' | 'media' | 'baixa';

/** Responsible area */
export type AreaResponsavel =
  | 'analitico' // analytical phase (test errors)
  | 'pre-analitico' // pre-analytical (collection, transport)
  | 'pos-analitico' // post-analytical (verification, delivery)
  | 'comercial' // billing / commercial
  | 'recepcao' // reception / intake
  | 'outro'; // other

/** Final classification (approved by RT) */
export interface Classificacao {
  tipo: TipoReclamacao;
  severidade: SeveridadeReclamacao;
  areaResponsavel: AreaResponsavel;
  aprovadoPor: string; // userId of approving RT
  aprovadoEm: Timestamp;
}

/** ─── RCA / 5 Whys ──────────────────────────────────────────────────────────── */

/** Single level in 5 Whys structured analysis */
export interface PorquePergunta {
  nivel: 1 | 2 | 3 | 4 | 5;
  pergunta: string; // "Por quê?" text (dynamic — previous answer becomes this)
  resposta: string; // operator's root cause analysis response
}

/** Root cause analysis via 5 Whys method */
export interface RCAFiveWhys {
  problema: string; // complaint summary as starting point
  porques: PorquePergunta[]; // array of why levels (min 3 required)
  causaRaiz: string; // final root cause statement (operator-written or suggested)
  preenchidoPor: string; // userId
  preenchidoEm: Timestamp;
}

/** ─── Corrective Action ─────────────────────────────────────────────────────── */

/** Corrective action linked to NC (if severity=alta) */
export interface AcaoCorretiva {
  id: string;
  descricao: string;
  responsavelId: string;
  dataImplementacao?: Timestamp;
  status: 'aberta' | 'implementada' | 'verificada' | 'fechada';
  ncId?: string; // backref to NC if created
}

/** ─── Resolution ────────────────────────────────────────────────────────────── */

/** Complaint resolution details */
export interface Resolucao {
  descricao: string; // how it was resolved
  eficacia: {
    verificadaEm: Timestamp;
    verificadaPor: string; // userId
    resultado: 'eficaz' | 'parcial' | 'ineficaz';
  };
}

/** ─── Communication Log ─────────────────────────────────────────────────────── */

/** Immutable email communication record */
export interface ComunicacaoCliente {
  id: string;
  destinatario: string; // email address
  assunto: string;
  corpo: string; // email body template rendered
  tipo: 'recebida' | 'status-update' | 'resolvida' | 'ncriada' | 'acompanhamento';
  enviado: boolean;
  enviadoEm?: Timestamp;
  statusEntrega?: 'enviado' | 'bounced' | 'nao-lido' | 'lido';
  resendMessageId?: string; // for tracking via Resend API
}

/** ─── NC Link ───────────────────────────────────────────────────────────────── */

/** Non-Conformity auto-created from high-severity complaint */
export type StatusNC = 'draft' | 'aprovada' | 'rejeitada';

/** ─── Main Complaint Entity ─────────────────────────────────────────────────── */

export type StatusReclamacao =
  | 'Nova'
  | 'Analisando'
  | 'RCA'
  | 'Resolvida'
  | 'Comunicada'
  | 'Fechada';

export interface Reclamacao {
  // ─── Identity ────────────────────────────────────────────────────────────
  id: string;
  labId: string; // redundant (defense-in-depth, required by multi-tenant rule)

  // ─── Complainant ─────────────────────────────────────────────────────────
  reclamante: Reclamante;

  // ─── Intake ──────────────────────────────────────────────────────────────
  canalEntrada: CanalEntrada;
  origemDados: OrigemDados;
  recebidoEm: Timestamp; // when complaint was received

  // ─── Content ─────────────────────────────────────────────────────────────
  descricao: string; // complaint text (free-form, may contain PII)
  anexos: AnexoReclamacao[];

  // ─── Classification (AI + RT approval) ────────────────────────────────────
  classificacaoAuto?: ClassificacaoAuto; // AI suggestion (before approval)
  classificacao: Classificacao;

  // ─── Workflow ────────────────────────────────────────────────────────────
  status: StatusReclamacao;
  slaPrazo: Timestamp; // 30 days from recebidoEm (CDC compliance)
  responsavelId?: string; // RT or Quality assigned

  // ─── RCA ─────────────────────────────────────────────────────────────────
  rcaFiveWhys?: RCAFiveWhys;
  acoesCorretivas?: AcaoCorretiva[];

  // ─── NC Link (auto-created if severity=alta) ────────────────────────────
  ncId?: string; // reference to NC in `/labs/{labId}/naoconformidades/`
  ncStatus?: StatusNC; // track NC lifecycle

  // ─── Resolution ──────────────────────────────────────────────────────────
  resolucao?: Resolucao;
  resolvidoEm?: Timestamp;

  // ─── Communication Log ───────────────────────────────────────────────────
  comunicacoes: ComunicacaoCliente[];

  // ─── NPS (post-resolution) ───────────────────────────────────────────────
  npsRespostaId?: string; // reference to entry in `/labs/{labId}/satisfacao-respostas/`

  // ─── LGPD ────────────────────────────────────────────────────────────────
  anonimizadoEm?: Timestamp; // after 90 days or explicit request

  // ─── Audit Trail ─────────────────────────────────────────────────────────
  signature: LogicalSignature;
  chainHash: string; // ADR 0001 sequential hash per lab
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null; // soft-delete only (RN-06)
}

/** ─── Versioning (immutable snapshot for retification) ────────────────────── */

export interface ReclamacaoVersion {
  id: string;
  reclamacaoId: string; // parent complaint
  labId: string;
  versaoNumero: number; // 1, 2, 3...
  snaphotAntes: Partial<Reclamacao>;
  snapshotDepois: Partial<Reclamacao>;
  motivoAtualizacao: string; // why it was changed
  alteradoPor: string; // userId
  alteradoEm: Timestamp;
  signature: LogicalSignature;
}

/** ─── DTO for Service Layer ────────────────────────────────────────────────── */

export type CreateReclamacaoInput = Omit<
  Reclamacao,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm' | 'signature' | 'chainHash'
>;

export type UpdateReclamacaoInput = Partial<
  Omit<Reclamacao, 'id' | 'labId' | 'criadoEm' | 'deletadoEm' | 'signature' | 'chainHash'>
>;
