/**
 * equipamentosCallables.ts
 *
 * Cloud Function callable wrappers para operações de escrita no módulo Equipamentos.
 * v1.5 NO-UI-YET: registrarManutencao callable (server-side ready, UI pending)
 *
 * Cada wrapper:
 * 1. Lazy-loads via httpsCallable (não carrega no import)
 * 2. Injeta labId do contexto do caller (via hook)
 * 3. Traduz erros Firebase → Error legível em PT-BR
 */

import { functions, httpsCallable, type HttpsCallable } from '../../../shared/services/firebase';

type LabId = string;
type UserId = string;

// ─── Result types ──────────────────────────────────────────────────────────

export interface CallRegistrarManutencaoResult {
  ok: true;
  manutencaoId: string;
}

// ─── Payload types ──────────────────────────────────────────────────────────

export interface RegistrarManutencaoPayload {
  labId: LabId;
  eqId: string;
  tipo: 'preventiva' | 'corretiva' | 'calibracao';
  fornecedorId?: string;
  custo?: number;
  pecasSubstituidas?: string[];
  observacoes?: string;
}

// ─── Lazy-loaded callables ──────────────────────────────────────────────────

let _callRegistrarManutencao: HttpsCallable<
  RegistrarManutencaoPayload,
  CallRegistrarManutencaoResult
> | null = null;

function getCallRegistrarManutencao(): HttpsCallable<
  RegistrarManutencaoPayload,
  CallRegistrarManutencaoResult
> {
  if (!_callRegistrarManutencao) {
    _callRegistrarManutencao = httpsCallable(functions, 'equipamentos_registrarManutencao');
  }
  return _callRegistrarManutencao;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register a maintenance record for an equipment.
 * Supports preventive, corrective, and calibration maintenance types.
 * Optionally records parts replaced, supplier, and cost for inventory tracking.
 *
 * Throws Error if validation fails, equipment not found, or labId is not active.
 *
 * v1.5 NO-UI-YET: Server-side callable ready. UI (equipment detail form + structured form) pending.
 */
export async function callRegistrarManutencao(
  payload: RegistrarManutencaoPayload,
): Promise<CallRegistrarManutencaoResult> {
  try {
    const result = await getCallRegistrarManutencao()(payload);
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
      return new Error('Equipamento ou laboratório não encontrado.');
    }
    if (message.includes('INVALID_ARGUMENT')) {
      const match = message.match(/Dados inválidos: (.+)/);
      return new Error(
        match ? match[1] : 'Dados inválidos — verifique tipo e campos obrigatórios.',
      );
    }
    if (message.includes('FAILED_PRECONDITION')) {
      const match = message.match(/FAILED_PRECONDITION: (.+)/);
      return new Error(
        match ? match[1] : 'Operação não permitida — equipamento pode estar inativo ou em uso.',
      );
    }
    if (message.includes('INTERNAL')) {
      return new Error('Erro ao processar solicitação (cloud function).');
    }

    return new Error(message);
  }

  return new Error('Erro desconhecido ao chamar função.');
}
