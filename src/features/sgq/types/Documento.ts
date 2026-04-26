/**
 * SGQ — Documento da Qualidade
 *
 * Sistema de Gestão da Qualidade (DICQ 8ª Ed. cl. 4.3 + ISO 15189:2015 cl. 4.3).
 * Hierarquia documental do laboratório:
 *
 *   MQ  — Manual da Qualidade            (1 documento, raiz da pirâmide)
 *   PQ  — Procedimento da Qualidade      (políticas/processos cross-cutting)
 *   IT  — Instrução de Trabalho          (procedimento operacional / POP)
 *   FR  — Formulário/Registro            (template a preencher)
 *   POL — Política                       (declaração de princípio)
 *
 * Cada documento tem ciclo de vida obrigatório:
 *
 *   em_revisao   → vigente   → obsoleto
 *      (rascunho)   (em uso)    (substituído ou expirado)
 *
 * Audit chain (DICQ 4.13): toda transição de status grava entrada em
 * `/labs/{labId}/sgq-documentos-audit/{auditId}` (append-only). Documento
 * obsoleto NUNCA é deletado — preservação por 5 anos no mínimo.
 *
 * Versionamento: cada revisão sobe `versao` em +1 e gera novo doc, mantendo
 * o anterior como `obsoleto` com `substituidoPor` apontando para o novo.
 *
 * Firestore path: /labs/{labId}/sgq-documentos/{documentoId}
 */

import type { Timestamp } from 'firebase/firestore';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type TipoDocumento =
  | 'MQ'   // Manual da Qualidade
  | 'PQ'   // Procedimento da Qualidade
  | 'IT'   // Instrução de Trabalho (POP)
  | 'FR'   // Formulário / Registro
  | 'POL'; // Política

export type StatusDocumento =
  | 'em_revisao'  // Em rascunho — não é evidência ainda
  | 'vigente'     // Em uso oficial — auditor olha aqui
  | 'obsoleto';   // Substituído/expirado — preservado para trilha

export const TIPO_LABEL: Record<TipoDocumento, string> = {
  MQ: 'Manual da Qualidade',
  PQ: 'Procedimento da Qualidade',
  IT: 'Instrução de Trabalho',
  FR: 'Formulário / Registro',
  POL: 'Política',
};

export const STATUS_LABEL: Record<StatusDocumento, string> = {
  em_revisao: 'Em revisão',
  vigente: 'Vigente',
  obsoleto: 'Obsoleto',
};

// ─── Entidade ────────────────────────────────────────────────────────────────

export interface Documento {
  readonly id: string;
  readonly labId: string;

  /**
   * Código único legível (ex: "MQ-001", "IT-012", "FR-027"). Sugerido pelo
   * tipo + número sequencial. O service valida unicidade por (labId, codigo).
   * Quando uma revisão sobe (gera doc novo), o código permanece — muda apenas
   * a versão. Auditor identifica o documento pelo código, não pelo id.
   */
  codigo: string;

  tipo: TipoDocumento;

  /** Título humano (ex: "Coleta de sangue venoso"). */
  titulo: string;

  /**
   * Versão monotônica incremental. Documento original começa em 1; cada
   * revisão sobe +1 (e gera novo doc Firestore preservando o anterior).
   */
  versao: number;

  /**
   * URL do PDF/documento. MVP aceita URL externa (Drive/Storage manual). v2
   * adicionará upload direto ao Firebase Storage com path imutável.
   */
  url: string;

  /**
   * Autoridade que aprovou e emitiu este documento (ex: "Diretor Técnico —
   * João Silva, CRBM-12345"). Texto livre — auditor compara com a designação
   * formal no Manual da Qualidade.
   */
  autoridadeEmitente: string;

  /** Data em que esta versão foi emitida formalmente. */
  dataEmissao: Timestamp;

  /**
   * Data da última revisão crítica (re-aprovação sem mudança de versão). Para
   * a primeira emissão, igual a `dataEmissao`.
   */
  dataRevisao: Timestamp;

  /**
   * Data planejada para próxima revisão (DICQ 4.3 — frequência pré-definida).
   * Quando `proximaRevisao < hoje`, o documento aparece como vencido na lista
   * mestra mesmo se ainda estiver `vigente` (sinal visual amarelo/vermelho).
   */
  proximaRevisao: Timestamp;

  status: StatusDocumento;

  /**
   * Quando obsoleto: id do documento que substituiu este. Append-only — nunca
   * removido. Permite reconstruir a cadeia "MQ-001 v1 → v2 → v3 vigente".
   */
  substituidoPor?: string;

  /**
   * Quando este documento substituiu outro: id do anterior. Espelho de
   * `substituidoPor` no doc anterior.
   */
  substitui?: string;

  observacoes?: string;

  // ── Auditoria básica ──────────────────────────────────────────────────────

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  readonly criadoPorName: string;
  atualizadoEm: Timestamp;
  atualizadoPor: string;
  atualizadoPorName: string;
  /** Soft delete — RN-06. Documentos obsoletos NÃO usam isto (têm status próprio). */
  deletadoEm: Timestamp | null;
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export type DocumentoAuditEventType =
  | 'created'
  | 'updated'
  | 'status-changed'
  | 'revisao-emitida'; // Nova versão substitui a anterior

export interface DocumentoAuditEvent {
  readonly id: string;
  readonly labId: string;
  readonly documentoId: string;
  /** Snapshot do código no momento — sobrevive a edições posteriores. */
  codigoSnapshot: string;
  versaoSnapshot: number;

  type: DocumentoAuditEventType;

  /** Snapshot de campos alterados quando aplicável. */
  changes?: Record<string, { from: unknown; to: unknown }>;

  /** Em transições de status. */
  fromStatus?: StatusDocumento;
  toStatus?: StatusDocumento;

  /** Em revisao-emitida: id da versão anterior (que vai a obsoleto). */
  versaoAnteriorId?: string;

  motivo?: string;

  readonly timestamp: Timestamp;
  readonly operadorId: string;
  readonly operadorName: string;
}

// ─── Input DTO ───────────────────────────────────────────────────────────────

export type DocumentoInput = Omit<
  Documento,
  | 'id'
  | 'labId'
  | 'versao'
  | 'criadoEm'
  | 'criadoPor'
  | 'criadoPorName'
  | 'atualizadoEm'
  | 'atualizadoPor'
  | 'atualizadoPorName'
  | 'deletadoEm'
  | 'substituidoPor'
  | 'substitui'
>;

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface DocumentoFilters {
  tipo?: TipoDocumento | TipoDocumento[];
  /** Default no hook: apenas `vigente` + `em_revisao` (oculta obsoletos). */
  status?: StatusDocumento | StatusDocumento[];
  /** Inclui obsoletos (lista mestra completa para auditor). */
  includeObsoletos?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Documento vencido = `proximaRevisao < hoje` E status `vigente`. Sinal de
 * que o lab está fora de prazo de revisão (DICQ 4.3 — frequência definida).
 */
export function isVencido(d: Documento, now: Date = new Date()): boolean {
  if (d.status !== 'vigente') return false;
  return d.proximaRevisao.toDate().getTime() < now.getTime();
}

/**
 * Próximo da revisão = vence em ≤ 30 dias. Sinal amarelo na UI; auditor
 * olha bem documentos prestes a vencer.
 */
export function isProximoVencimento(
  d: Documento,
  now: Date = new Date(),
  diasLimite = 30,
): boolean {
  if (d.status !== 'vigente') return false;
  const diff = d.proximaRevisao.toDate().getTime() - now.getTime();
  const diasAteVencer = diff / (1000 * 60 * 60 * 24);
  return diasAteVencer >= 0 && diasAteVencer <= diasLimite;
}

/**
 * Sugere próximo número sequencial para um tipo. Caller passa documentos
 * existentes do mesmo tipo; helper extrai o maior número e retorna +1
 * com padding. Não é único garantido — service valida no servidor.
 */
export function sugerirProximoCodigo(
  tipo: TipoDocumento,
  existentes: Documento[],
): string {
  const prefix = `${tipo}-`;
  const numeros = existentes
    .filter((d) => d.codigo.startsWith(prefix))
    .map((d) => {
      const match = d.codigo.match(/^[A-Z]+-(\d+)$/);
      return match ? Number.parseInt(match[1], 10) : 0;
    })
    .filter((n) => Number.isFinite(n) && n > 0);

  const proximo = numeros.length === 0 ? 1 : Math.max(...numeros) + 1;
  return `${prefix}${String(proximo).padStart(3, '0')}`;
}
