/**
 * CAPA Service Layer
 *
 * Thin wrapper for CAPA CRUD operations.
 * All writes routed through Cloud Function callables (server-sealed).
 * Reads via Firestore listeners.
 */

import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  getDoc,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../../shared/services/firebase';
import type {
  CAPA,
  CAParecao,
  Verificacao,
  CreateCAPAInput,
  CreateAcaoInput,
  CreateVerificacaoInput,
  CAPAFilters,
  AcaoFilters,
  CAPAStatus,
  VerificacaoResultado,
} from '../types';

// ─── Collection Paths ───────────────────────────────────────────────────────

const capaCollection = (labId: string) => collection(db, `labs/${labId}/capa`);
const acaoCollection = (labId: string, capaId: string) =>
  collection(db, `labs/${labId}/capa/${capaId}/acoes`);
const verificacaoCollection = (labId: string, capaId: string) =>
  collection(db, `labs/${labId}/capa/${capaId}/verificacoes`);

// ─── Cloud Function Callables ──────────────────────────────────────────────

const createCAPACallable = httpsCallable<
  any,
  { capaId: string; auditEntryId: string }
>(functions, 'createCAPA');

const updateCAPACallable = httpsCallable<any, { success: boolean }>(
  functions,
  'updateCAPA'
);

const assignCAPACallable = httpsCallable<any, { success: boolean; acaoId?: string }>(
  functions,
  'assignCAPA'
);

const verifyCAPACallable = httpsCallable<any, { success: boolean }>(
  functions,
  'verifyCAPA'
);

const softDeleteCAPACallable = httpsCallable<any, { success: boolean }>(
  functions,
  'softDeleteCAPA'
);

// ─── CREATE ────────────────────────────────────────────────────────────────

/**
 * Create a new CAPA document
 * Routed through Cloud Function callable for audit sealing
 */
export async function createCAPA(
  labId: string,
  input: CreateCAPAInput
): Promise<string> {
  try {
    // Minimal validation
    if (!input.titulo || input.titulo.trim().length < 5) {
      throw new Error('Título deve ter pelo menos 5 caracteres');
    }
    if (!input.descricao || input.descricao.trim().length < 10) {
      throw new Error('Descrição deve ter pelo menos 10 caracteres');
    }
    if (!input.dataPrazo) {
      throw new Error('Data de prazo é obrigatória');
    }

    const result = await createCAPACallable({
      labId,
      titulo: input.titulo,
      descricao: input.descricao,
      encontroId: input.encontroId || null,
      encontroTipo: input.encontroTipo || null,
      status: input.status || 'aberta',
      prioridade: input.prioridade || 3,
      dataPrazo: input.dataPrazo,
    });

    return result.data.capaId;
  } catch (error: any) {
    throw new Error(
      error.message || 'Erro ao criar CAPA. Por favor, tente novamente.'
    );
  }
}

// ─── READ ───────────────────────────────────────────────────────────────────

/**
 * Get single CAPA document
 */
export async function getCAPA(labId: string, capaId: string): Promise<CAPA | null> {
  try {
    const docRef = doc(capaCollection(labId), capaId);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as CAPA) : null;
  } catch (error: any) {
    console.error('Error fetching CAPA:', error);
    throw error;
  }
}

/**
 * Get actions for a CAPA
 */
export async function getAcoes(labId: string, capaId: string): Promise<CAParecao[]> {
  try {
    const colRef = acaoCollection(labId, capaId);
    const q = query(colRef, where('deletadoEm', '==', null));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CAParecao);
  } catch (error: any) {
    console.error('Error fetching ações:', error);
    throw error;
  }
}

/**
 * Get verifications for a CAPA
 */
export async function getVerificacoes(
  labId: string,
  capaId: string
): Promise<Verificacao[]> {
  try {
    const colRef = verificacaoCollection(labId, capaId);
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as Verificacao);
  } catch (error: any) {
    console.error('Error fetching verificações:', error);
    throw error;
  }
}

// ─── SUBSCRIBE (Realtime) ────────────────────────────────────────────────────

/**
 * Subscribe to CAPAs in a lab with optional filters
 */
export function subscribeCAPAs(
  labId: string,
  filters: CAPAFilters = {},
  callback: (capas: CAPA[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const constraints = [where('deletadoEm', '==', null)];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.prioridade !== undefined) {
    constraints.push(where('prioridade', '==', filters.prioridade));
  }

  if (filters.criadoPor) {
    constraints.push(where('criadoPor', '==', filters.criadoPor));
  }

  if (filters.encontroId) {
    constraints.push(where('encontroId', '==', filters.encontroId));
  }

  const q = query(capaCollection(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      let capas = snap.docs.map((d) => d.data() as CAPA);

      // Client-side filtering for full-text search
      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        capas = capas.filter(
          (capa) =>
            capa.titulo.toLowerCase().includes(search) ||
            capa.descricao.toLowerCase().includes(search)
        );
      }

      callback(capas);
    },
    onError
  );
}

/**
 * Subscribe to actions for a CAPA
 */
export function subscribeAcoes(
  labId: string,
  capaId: string,
  filters: AcaoFilters = {},
  callback: (acoes: CAParecao[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const constraints = [where('deletadoEm', '==', null)];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.responsavel) {
    constraints.push(where('responsavel', '==', filters.responsavel));
  }

  if (filters.tipo) {
    constraints.push(where('tipo', '==', filters.tipo));
  }

  const q = query(acaoCollection(labId, capaId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const acoes = snap.docs.map((d) => d.data() as CAParecao);
      callback(acoes);
    },
    onError
  );
}

// ─── UPDATE (Status Transitions) ────────────────────────────────────────────

/**
 * Update CAPA status
 * Routed through callable for audit sealing
 */
export async function updateCAPAStatus(
  labId: string,
  capaId: string,
  newStatus: CAPAStatus,
  notes?: string
): Promise<void> {
  try {
    await updateCAPACallable({
      labId,
      capaId,
      newStatus,
      notes: notes || '',
    });
  } catch (error: any) {
    throw new Error(
      error.message || 'Erro ao atualizar status da CAPA. Por favor, tente novamente.'
    );
  }
}

/**
 * Assign a corrective/preventive action to a CAPA
 * Routed through callable for audit sealing
 */
export async function assignCAPA(
  labId: string,
  capaId: string,
  input: CreateAcaoInput
): Promise<string> {
  try {
    if (!input.descricao || input.descricao.trim().length < 10) {
      throw new Error('Descrição da ação deve ter pelo menos 10 caracteres');
    }
    if (!input.responsavel) {
      throw new Error('Responsável é obrigatório');
    }
    if (!input.dataVencimento) {
      throw new Error('Data de vencimento é obrigatória');
    }

    const result = await assignCAPACallable({
      labId,
      capaId,
      tipo: input.tipo,
      descricao: input.descricao,
      responsavel: input.responsavel,
      dataVencimento: input.dataVencimento,
      evidenciasLinks: input.evidenciasLinks || [],
      notas: input.notas || '',
    });

    // Return the action ID (stored in server response)
    return result.data.acaoId || capaId; // Fallback to capaId if not returned
  } catch (error: any) {
    throw new Error(
      error.message || 'Erro ao atribuir ação. Por favor, tente novamente.'
    );
  }
}

/**
 * Submit verification result for a CAPA
 * If resultado === 'efetiva', auto-closes CAPA
 * Routed through callable for audit sealing
 */
export async function verifyCAPA(
  labId: string,
  capaId: string,
  input: CreateVerificacaoInput
): Promise<void> {
  try {
    if (!input.verificadoPor) {
      throw new Error('Verificador (RT) é obrigatório');
    }
    if (!input.resultado) {
      throw new Error('Resultado de verificação é obrigatório');
    }
    if (!input.notas || input.notas.trim().length < 10) {
      throw new Error('Notas de verificação devem ter pelo menos 10 caracteres');
    }

    await verifyCAPACallable({
      labId,
      capaId,
      verificadoPor: input.verificadoPor,
      dataVerificacao: input.dataVerificacao,
      resultado: input.resultado,
      notas: input.notas,
      horasInvestidas: input.horasInvestidas || 0,
    });
  } catch (error: any) {
    throw new Error(
      error.message || 'Erro ao registrar verificação. Por favor, tente novamente.'
    );
  }
}

// ─── SOFT DELETE ────────────────────────────────────────────────────────────

/**
 * Soft delete a CAPA document
 * Routed through callable for audit sealing
 */
export async function softDeleteCAPA(
  labId: string,
  capaId: string,
  deletadoPor: string
): Promise<void> {
  try {
    await softDeleteCAPACallable({
      labId,
      capaId,
      deletadoPor,
    });
  } catch (error: any) {
    throw new Error(
      error.message || 'Erro ao deletar CAPA. Por favor, tente novamente.'
    );
  }
}
