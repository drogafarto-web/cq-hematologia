/**
 * notaFiscalCallables.ts
 *
 * Cloud Function callable wrappers para operações de escrita no módulo Fornecedores.
 * DL-1 — LOCKED DECISION: todas as escritas regulatórias são callables do server.
 *
 * Cada wrapper:
 * 1. Lazy-loads via httpsCallable (não carrega no import)
 * 2. Injeta labId do contexto do caller (via hook)
 * 3. Traduz erros Firebase → Error legível em PT-BR
 */

import { functions, httpsCallable, type HttpsCallable } from '../../../shared/services/firebase';
import type { LabId } from '../types/shared_refs';

// ─── Result types ──────────────────────────────────────────────────────────

export interface CallCriarNotaFiscalResult {
  success: true;
  nfId: string;
}

export interface CallConfirmarRecebimentoResult {
  success: true;
  lotesGerados: string[];
  desvios: number;
}

// ─── Payload types ──────────────────────────────────────────────────────────

export interface CriarNotaFiscalPayload {
  labId: LabId;
  numero: string;
  serie: string;
  dataEmissao: string; // ISO 8601 string
  fornecedorId: string;
  itens: Array<{
    insumoId: string;
    lote: string;
    quantidade: number;
    validade?: string; // ISO 8601 date
  }>;
  valorTotal: number;
}

export interface ConfirmarRecebimentoPayload {
  labId: LabId;
  nfId: string;
  desviosObservados?: string;
}

// ─── Lazy-loaded callables ──────────────────────────────────────────────────

let _callCriarNotaFiscal: HttpsCallable<
  CriarNotaFiscalPayload,
  CallCriarNotaFiscalResult
> | null = null;
let _callConfirmarRecebimento: HttpsCallable<
  ConfirmarRecebimentoPayload,
  CallConfirmarRecebimentoResult
> | null = null;

function getCallCriarNotaFiscal(): HttpsCallable<
  CriarNotaFiscalPayload,
  CallCriarNotaFiscalResult
> {
  if (!_callCriarNotaFiscal) {
    _callCriarNotaFiscal = httpsCallable(functions, 'fornecedores_criarNotaFiscal');
  }
  return _callCriarNotaFiscal;
}

function getCallConfirmarRecebimento(): HttpsCallable<
  ConfirmarRecebimentoPayload,
  CallConfirmarRecebimentoResult
> {
  if (!_callConfirmarRecebimento) {
    _callConfirmarRecebimento = httpsCallable(functions, 'fornecedores_confirmarRecebimento');
  }
  return _callConfirmarRecebimento;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new nota fiscal via Cloud Function.
 * Validates fornecedor qualification and generates associated insumo lots.
 * Throws Error if validation fails or labId is not active.
 */
export async function callCriarNotaFiscal(
  payload: CriarNotaFiscalPayload,
): Promise<CallCriarNotaFiscalResult> {
  try {
    const result = await getCallCriarNotaFiscal()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Confirm receipt of a nota fiscal via Cloud Function.
 * Generates associated lots if itens were provided during creation.
 * Desvios observados are logged in auditTrail.
 */
export async function callConfirmarRecebimento(
  payload: ConfirmarRecebimentoPayload,
): Promise<CallConfirmarRecebimentoResult> {
  try {
    const result = await getCallConfirmarRecebimento()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

// ─── Error translation ──────────────────────────────────────────────────────

function translateError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message;

    // Firebase Cloud Function errors
    if (message.includes('UNAUTHENTICATED')) {
      return new Error('Autenticação necessária.');
    }
    if (message.includes('PERMISSION_DENIED')) {
      return new Error('Sem permissão para este módulo — contate o administrador.');
    }
    if (message.includes('NOT_FOUND')) {
      return new Error('Recurso não encontrado.');
    }
    if (message.includes('INVALID_ARGUMENT')) {
      // Extract details if available
      const match = message.match(/Dados inválidos: (.+)/);
      return new Error(match ? match[1] : 'Dados inválidos.');
    }
    if (message.includes('FAILED_PRECONDITION')) {
      const match = message.match(/FAILED_PRECONDITION: (.+)/);
      return new Error(match ? match[1] : 'Operação não permitida no estado atual.');
    }
    if (message.includes('INTERNAL')) {
      return new Error('Erro ao processar solicitação (cloud function).');
    }

    return new Error(message);
  }

  return new Error('Erro desconhecido ao chamar função.');
}
