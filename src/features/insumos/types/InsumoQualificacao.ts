/**
 * InsumoQualificacao — decisão formal de qualificação de um lote.
 *
 * Fluxo: operador (RT/biomedico) abre o modal `InsumoQualificacaoModal`,
 * preenche o checklist 5-itens, anexa evidência analítica (corridas) quando
 * aplicável, re-autentica com senha (Firebase reauth client-side) e dispara
 * a callable `approveQualificacao` ou `reproveQualificacao`. O servidor
 * (Admin SDK) cria/atualiza este doc, transiciona o Insumo, e selas a
 * decisão em `InsumoMovimentacao` tipo='qualificacao' com chain hash.
 *
 * Firestore path: /labs/{labId}/insumo-qualificacoes/{qId}
 *
 * Regulatório:
 *   - RDC 786/2023 art. 42  — rastreabilidade de insumos
 *   - RDC 978/2025 Art.128  — controle interno de qualidade documentado
 *   - RDC 67/2009 + 551/2021 — NOTIVISA (queixa técnica/evento adverso)
 */

import type { Timestamp } from 'firebase/firestore';

// ─── Modes ────────────────────────────────────────────────────────────────────

/**
 * Modo de qualificação — determina UI e regras de aprovação.
 *
 *   `corrida-validacao` — exige >= 1 evidência analítica (run conforme).
 *                         Default para Imuno manual analítico (reagente +
 *                         controles P/N).
 *   `checklist-rt`      — qualificação documental. Sem evidência analítica.
 *                         Default em quantitativos sem corrida de validação.
 *   `caracterizacao-rt` — multianalítico/quantitativo. PR2 (out of scope no
 *                         PR1). Callables rejeitam com `caracterizacao-rt-not-supported-in-pr1`.
 */
export type QualificacaoMode = 'corrida-validacao' | 'checklist-rt' | 'caracterizacao-rt';

/**
 * Status do doc:
 *   `em_andamento` — criado client-side; servidor ainda não decidiu.
 *   `aprovado`     — callable `approveQualificacao` aprovou.
 *   `reprovado`    — callable `reproveQualificacao` reprovou.
 */
export type QualificacaoStatus = 'em_andamento' | 'aprovado' | 'reprovado';

/** Status NOTIVISA (RDC 67/2009 + RDC 551/2021). */
export type QualificacaoNotivisaStatus = 'pendente' | 'notificado' | 'dispensado';

/** Estado da assinatura lógica do doc. */
export type QualificacaoSignatureStatus = 'pending' | 'valid' | 'invalid';

// ─── Schema ──────────────────────────────────────────────────────────────────

/**
 * Checklist de inspeção de recebimento — 5 itens fixos.
 * Aprovação exige TODOS true (servidor valida).
 */
export interface QualificacaoChecklistRecebimento {
  /** Embalagem íntegra (sem violação visível). */
  embalagemIntegra: boolean;
  /** Prazo de validade compatível (>30 dias após chegada por padrão). */
  prazoValidade: boolean;
  /** Condições de transporte adequadas (cadeia de frio quando aplicável). */
  condicoesTransporte: boolean;
  /** Dados do fabricante legíveis (nome, lote, validade). */
  dadosFabricante: boolean;
  /** Registro ANVISA presente quando aplicável (RDC 786 art. 42). */
  registroAnvisa: boolean;
}

export interface InsumoQualificacao {
  id: string;
  /** ID do Insumo (lote físico) sendo qualificado. */
  insumoId: string;
  /** ID do produto-mestre (catálogo) — denormalizado pra audit. */
  produtoId: string;

  /** Tipo do insumo qualificado — 'reagente' ou 'controle' no PR1. */
  tipo: 'reagente' | 'controle';
  /** Polaridade do controle (apenas quando tipo='controle' em Imuno). */
  nivel?: 'positivo' | 'negativo';
  /** Módulo de uso — 'imunologia' no PR1. */
  modulo: string;

  /** Modo de qualificação — determina exigências da decisão. */
  qualificacaoMode: QualificacaoMode;

  /** Checklist 5-itens (todos true para aprovar). */
  checklistRecebimento: QualificacaoChecklistRecebimento;

  /**
   * IDs de CIQImunoRun usadas como evidência analítica.
   * `corrida-validacao`: >= 1 obrigatório.
   * `checklist-rt`:      sempre vazio.
   */
  evidenciaRunIds: string[];

  /**
   * Método aplicado na decisão. Server captura este valor a partir do
   * `qualificacaoMode` no momento da aprovação. `'migrated'` é usado
   * exclusivamente pelo script de backfill 2026-04-26.
   */
  qcApprovalMethod: 'corrida-validacao' | 'checklist-rt' | 'migrated';

  status: QualificacaoStatus;

  // ── Decisor ──────────────────────────────────────────────────────────────
  /** UID do operador (request.auth.uid no servidor). */
  approvedBy: string;
  /** Nome canônico do operador (lookup users/{uid}.displayName). */
  approvedByNome: string;
  /** Cargo registrado no users/{uid}.role/cargo (audit imutável). */
  approvedByCargo: string;
  /** Timestamp server da decisão. */
  approvedAt: Timestamp;

  /** Motivo de reprovação. Obrigatório quando status='reprovado'. */
  motivoReprovacao?: string;

  // ── NOTIVISA (RDC 67/2009 + RDC 551/2021) ────────────────────────────────
  notivisaStatus?: QualificacaoNotivisaStatus;
  notivisaProtocolo?: string;
  notivisaRetornoAt?: Timestamp;

  // ── Assinatura lógica ────────────────────────────────────────────────────
  /** SHA-256 hex do payload canônico — gerado client e re-validado server. */
  logicalSignature: string;
  signatureStatus: QualificacaoSignatureStatus;

  // ── Audit ────────────────────────────────────────────────────────────────
  createdAt: Timestamp;
  createdBy: string;

  /**
   * Apenas em backfill — preserva contexto da migração (ADR ref + hashes).
   * Ausente em qualificações criadas via UI.
   */
  migrationContext?: {
    adrRef: string;
    adrSHA256: string;
    previewFile: string;
    scriptVersion: string;
  };
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

/**
 * Alerta operacional gerado por triggers/callables (Admin SDK).
 * Cliente apenas lê + faz acknowledge.
 *
 * Firestore path: /labs/{labId}/alertas/{id}
 */
export type AlertaType = 'signature_invalid' | 'qualificacao_reprovada' | 'insumo_vencendo';

export type AlertaSeverity = 'info' | 'warning' | 'error';

export interface InsumoAlerta {
  id: string;
  type: AlertaType;
  severity: AlertaSeverity;

  /** Path completo do doc de origem (ex: 'labs/X/insumo-qualificacoes/Y'). */
  relatedDocPath: string;
  /** ID do doc de origem (denormalizado para query rápida). */
  relatedDocId: string;

  /** Mensagem humana exibida na UI. */
  message: string;

  createdAt: Timestamp;

  /** UID do membro que reconheceu o alerta. Ausente == ainda não acked. */
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
}
