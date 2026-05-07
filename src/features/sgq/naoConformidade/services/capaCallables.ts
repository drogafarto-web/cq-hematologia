/**
 * capaCallables.ts
 *
 * Cloud Function callable wrappers para operações de escrita no módulo CAPA.
 * Fase 0b — todas as escritas regulatórias são callables do server.
 *
 * Cada wrapper:
 * 1. Lazy-loads via httpsCallable (não carrega no import)
 * 2. Injeta labId do contexto do caller (via hook)
 * 3. Traduz erros Firebase → Error legível em PT-BR
 */

import { functions, httpsCallable, type HttpsCallable } from '../../../../shared/services/firebase';
import type { LabId } from '../../types/shared_refs';

// ─── Result types ──────────────────────────────────────────────────────────

export interface CallInvestigarNCResult {
  ok: true;
  ncId: string;
  status: 'investigacao';
}

export interface CallExecutarAcaoCorrecivaResult {
  ok: true;
  ncId: string;
  status: 'acao' | 'execucao';
}

export interface CallVerificarEficaciaResult {
  ok: true;
  ncId: string;
  status: 'eficacia' | 'fechada';
}

// ─── Payload types ──────────────────────────────────────────────────────────

export interface InvestigarNCPayload {
  labId: LabId;
  ncId: string;
  descricao: string;
  achados?: string;
}

export interface ExecutarAcaoCorrecivaPayload {
  labId: LabId;
  ncId: string;
  descricao: string;
  dataPrevista: number; // milliseconds timestamp
}

export interface VerificarEficaciaPayload {
  labId: LabId;
  ncId: string;
  resultado: 'eficaz' | 'ineficaz' | 'nao_concluida';
  evidencia?: string;
}

// ─── Lazy-loaded callables ──────────────────────────────────────────────────

let _callInvestigarNC: HttpsCallable<
  InvestigarNCPayload,
  CallInvestigarNCResult
> | null = null;
let _callExecutarAcaoCorretiva: HttpsCallable<
  ExecutarAcaoCorrecivaPayload,
  CallExecutarAcaoCorrecivaResult
> | null = null;
let _callVerificarEficacia: HttpsCallable<
  VerificarEficaciaPayload,
  CallVerificarEficaciaResult
> | null = null;

function getCallInvestigarNC(): HttpsCallable<
  InvestigarNCPayload,
  CallInvestigarNCResult
> {
  if (!_callInvestigarNC) {
    _callInvestigarNC = httpsCallable(functions, 'capa_investigarNC');
  }
  return _callInvestigarNC;
}

function getCallExecutarAcaoCorretiva(): HttpsCallable<
  ExecutarAcaoCorrecivaPayload,
  CallExecutarAcaoCorrecivaResult
> {
  if (!_callExecutarAcaoCorretiva) {
    _callExecutarAcaoCorretiva = httpsCallable(functions, 'capa_executarAcaoCorretiva');
  }
  return _callExecutarAcaoCorretiva;
}

function getCallVerificarEficacia(): HttpsCallable<
  VerificarEficaciaPayload,
  CallVerificarEficaciaResult
> {
  if (!_callVerificarEficacia) {
    _callVerificarEficacia = httpsCallable(functions, 'capa_verificarEficacia');
  }
  return _callVerificarEficacia;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Inicia investigação de uma Não-Conformidade via Cloud Function.
 * Transiciona status para 'investigacao' com achados documentados.
 */
export async function callInvestigarNC(
  payload: InvestigarNCPayload,
): Promise<CallInvestigarNCResult> {
  try {
    const result = await getCallInvestigarNC()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Executa ação corretiva para uma Não-Conformidade via Cloud Function.
 * Transiciona para 'acao'/'execucao' com data prevista de fechamento.
 */
export async function callExecutarAcaoCorretiva(
  payload: ExecutarAcaoCorrecivaPayload,
): Promise<CallExecutarAcaoCorrecivaResult> {
  try {
    const result = await getCallExecutarAcaoCorretiva()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Verifica eficácia da ação corretiva via Cloud Function.
 * Transiciona para 'eficacia' ou 'fechada' conforme resultado.
 */
export async function callVerificarEficacia(
  payload: VerificarEficaciaPayload,
): Promise<CallVerificarEficaciaResult> {
  try {
    const result = await getCallVerificarEficacia()(payload);
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
      return new Error('Não-Conformidade não encontrada.');
    }
    if (message.includes('INVALID_ARGUMENT')) {
      const match = message.match(/Dados inválidos: (.+)/);
      return new Error(match ? match[1] : 'Dados inválidos.');
    }
    if (message.includes('FAILED_PRECONDITION')) {
      const match = message.match(/FAILED_PRECONDITION: (.+)/);
      return new Error(
        match
          ? match[1]
          : 'Operação não permitida no estado atual da Não-Conformidade.',
      );
    }
    if (message.includes('INTERNAL')) {
      return new Error('Erro ao processar solicitação (cloud function).');
    }

    return new Error(message);
  }

  return new Error('Erro desconhecido ao chamar função de CAPA.');
}
