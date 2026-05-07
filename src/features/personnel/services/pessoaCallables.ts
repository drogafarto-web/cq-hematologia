/**
 * pessoaCallables.ts
 *
 * Cloud Function callable wrappers para operações de escrita no módulo Personnel.
 * v1.5 NO-UI-YET: criarQualificacao callable (server-side ready, UI pending)
 *
 * Cada wrapper:
 * 1. Lazy-loads via httpsCallable (não carrega no import)
 * 2. Injeta labId do contexto do caller (via hook)
 * 3. Traduz erros Firebase → Error legível em PT-BR
 */

import { functions, httpsCallable, type HttpsCallable } from '../../../shared/services/firebase';
import type { LabId, UserId } from '../types';

// ─── Result types ──────────────────────────────────────────────────────────

export interface CallCriarQualificacaoResult {
  ok: true;
  qualificacaoId: string;
}

// ─── Payload types ──────────────────────────────────────────────────────────

export interface CriarQualificacaoPayload {
  labId: LabId;
  operadorId: UserId;
  tipo: string;
  modulosLiberados: string[];
  validoDe: number; // Unix timestamp (ms)
  validoAte: number; // Unix timestamp (ms)
}

// ─── Lazy-loaded callables ──────────────────────────────────────────────────

let _callCriarQualificacao: HttpsCallable<
  CriarQualificacaoPayload,
  CallCriarQualificacaoResult
> | null = null;

function getCallCriarQualificacao(): HttpsCallable<
  CriarQualificacaoPayload,
  CallCriarQualificacaoResult
> {
  if (!_callCriarQualificacao) {
    _callCriarQualificacao = httpsCallable(functions, 'personnel_criarQualificacao');
  }
  return _callCriarQualificacao;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new qualificação (certification/qualification) for an operator.
 * Associates the operator with modules where they are authorized to perform operations.
 *
 * Throws Error if validation fails, operador not found, or labId is not active.
 *
 * v1.5 NO-UI-YET: Server-side callable ready. UI (modal + list + revogação) pending.
 */
export async function callCriarQualificacao(
  payload: CriarQualificacaoPayload
): Promise<CallCriarQualificacaoResult> {
  try {
    const result = await getCallCriarQualificacao()(payload);
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
      return new Error('Operador ou laboratório não encontrado.');
    }
    if (message.includes('INVALID_ARGUMENT')) {
      const match = message.match(/Dados inválidos: (.+)/);
      return new Error(match ? match[1] : 'Dados inválidos — verifique tipo, módulos e datas.');
    }
    if (message.includes('FAILED_PRECONDITION')) {
      const match = message.match(/FAILED_PRECONDITION: (.+)/);
      return new Error(
        match ? match[1] : 'Operação não permitida — operador pode já ter esta qualificação.'
      );
    }
    if (message.includes('INTERNAL')) {
      return new Error('Erro ao processar solicitação (cloud function).');
    }

    return new Error(message);
  }

  return new Error('Erro desconhecido ao chamar função.');
}
