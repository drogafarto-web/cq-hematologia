import type {
  Risk,
  RiskInput,
  RiskFilters,
  Nivel,
  Probabilidade,
  Severidade,
  Deteccao,
  NprThresholds,
  RegistrarRevisaoInput,
  SoftDeleteRiskInput,
} from '../types/Risk';
import { DEFAULT_NPR_THRESHOLDS } from '../types/Risk';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../../shared/services/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

// ─── NPR Computation & Nivel Derivation ────────────────────────────────────

/**
 * Compute NPR = Probabilidade × Severidade × Detecção.
 * Validates each input is in [1, 5].
 */
export function computeNPR(probabilidade: number, severidade: number, deteccao: number): number {
  if (![1, 2, 3, 4, 5].includes(probabilidade)) {
    throw new Error(`Probabilidade fora do intervalo [1,5]: ${probabilidade}`);
  }
  if (![1, 2, 3, 4, 5].includes(severidade)) {
    throw new Error(`Severidade fora do intervalo [1,5]: ${severidade}`);
  }
  if (![1, 2, 3, 4, 5].includes(deteccao)) {
    throw new Error(`Detecção fora do intervalo [1,5]: ${deteccao}`);
  }
  return probabilidade * severidade * deteccao;
}

/**
 * Derive Nivel from NPR using thresholds.
 * Returns 'baixo' | 'medio' | 'alto' | 'critico'.
 */
export function deriveNivel(
  npr: number,
  thresholds: NprThresholds = DEFAULT_NPR_THRESHOLDS,
): Nivel {
  if (npr <= thresholds.medio - 1) return 'baixo';
  if (npr <= thresholds.alto - 1) return 'medio';
  if (npr <= thresholds.critico - 1) return 'alto';
  return 'critico';
}

export { DEFAULT_NPR_THRESHOLDS };

// ─── Firestore Read Operations ─────────────────────────────────────────────

/**
 * Subscribe to risks in a lab (filtered by deletadoEm client-side).
 */
export function subscribeRisks(
  labId: string,
  filters?: RiskFilters,
  onData?: (risks: Risk[]) => void,
  onError?: (error: Error) => void,
) {
  const constraints: any[] = [];

  // Filter by status if provided
  if (filters?.status && filters.status.length > 0) {
    constraints.push(where('status', 'in', filters.status));
  }

  const q = query(collection(db, `labs/${labId}/risks`), ...constraints);

  return onSnapshot(
    q,
    (snapshot: any) => {
      const risks = snapshot.docs
        .map((doc: any) => mapSnapshotToRisk(doc.data() as any, doc.id))
        .filter((risk: Risk) => {
          // Filter deleted client-side
          if (!filters?.includeDeleted && risk.deletadoEm) {
            return false;
          }

          // Apply additional filters
          if (filters?.nivel && !filters.nivel.includes(risk.nivel)) {
            return false;
          }
          if (filters?.nprMin !== undefined && risk.npr < filters.nprMin) {
            return false;
          }
          if (filters?.nprMax !== undefined && risk.npr > filters.nprMax) {
            return false;
          }
          if (filters?.probabilidade && !filters.probabilidade.includes(risk.probabilidade)) {
            return false;
          }
          if (filters?.severidade && !filters.severidade.includes(risk.severidade)) {
            return false;
          }
          if (filters?.categoria && !filters.categoria.includes(risk.categoria)) {
            return false;
          }
          if (filters?.processo && !filters.processo.includes(risk.processo)) {
            return false;
          }
          if (filters?.searchText) {
            const text = filters.searchText.toLowerCase();
            if (
              !risk.codigo.toLowerCase().includes(text) &&
              !risk.descricao.toLowerCase().includes(text)
            ) {
              return false;
            }
          }

          return true;
        });

      onData?.(risks);
    },
    (error: any) => {
      onError?.(error as Error);
    },
  );
}

/**
 * Get a single risk by ID.
 */
export async function getRisk(labId: string, riskId: string): Promise<Risk | null> {
  const docRef = doc(db, `labs/${labId}/risks`, riskId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data() as any;
  if (data.labId !== labId) {
    throw new Error('Risk does not belong to this lab');
  }

  return mapSnapshotToRisk(data, docSnap.id);
}

/**
 * Map Firestore snapshot to Risk entity (timestamp conversion, etc).
 */
export function mapSnapshotToRisk(data: any, id: string): Risk {
  return {
    ...data,
    id,
    criadoEm: data.criadoEm?.toDate ? data.criadoEm.toDate() : data.criadoEm,
    deletadoEm: data.deletadoEm?.toDate ? data.deletadoEm.toDate() : data.deletadoEm,
    reviewDate: data.reviewDate?.toDate ? data.reviewDate.toDate() : data.reviewDate,
    tratamento: {
      ...data.tratamento,
      acoes: (data.tratamento?.acoes || []).map((acao: any) => ({
        ...acao,
        criadoEm: acao.criadoEm?.toDate ? acao.criadoEm.toDate() : acao.criadoEm,
        prazo: acao.prazo?.toDate ? acao.prazo.toDate() : acao.prazo,
      })),
    },
    reviewHistory: (data.reviewHistory || []).map((rev: any) => ({
      ...rev,
      criadoEm: rev.criadoEm?.toDate ? rev.criadoEm.toDate() : rev.criadoEm,
    })),
  } as Risk;
}

// ─── Callable Wrappers ────────────────────────────────────────────────────

export async function callCreateRisk(
  labId: string,
  payload: Omit<RiskInput, 'labId'>,
): Promise<Risk> {
  const fn = httpsCallable<any, any>(functions, 'risks_createRisk');
  try {
    const result = await fn({ labId, ...payload });
    return mapSnapshotToRisk(result.data, result.data.id);
  } catch (error) {
    throw unwrapCallableError(error);
  }
}

export async function callUpdateRisk(
  labId: string,
  riskId: string,
  payload: Partial<RiskInput>,
): Promise<Risk> {
  const fn = httpsCallable<any, any>(functions, 'risks_updateRisk');
  try {
    const result = await fn({ labId, riskId, ...payload });
    return mapSnapshotToRisk(result.data, result.data.id);
  } catch (error) {
    throw unwrapCallableError(error);
  }
}

export async function callSoftDeleteRisk(labId: string, input: SoftDeleteRiskInput): Promise<void> {
  const fn = httpsCallable<any, void>(functions, 'risks_softDeleteRisk');
  try {
    await fn({ labId, ...input });
  } catch (error) {
    throw unwrapCallableError(error);
  }
}

export async function callRegistrarRevisao(
  labId: string,
  input: RegistrarRevisaoInput,
): Promise<Risk> {
  const fn = httpsCallable<any, any>(functions, 'risks_registrarRevisao');
  try {
    const result = await fn({ labId, ...input });
    return mapSnapshotToRisk(result.data, result.data.id);
  } catch (error) {
    throw unwrapCallableError(error);
  }
}

/**
 * CSV import (admin-only, optional stretch task).
 */
export async function callSeedFromCsv(
  labId: string,
  rows: RiskInput[],
): Promise<{ created: number; skipped: number }> {
  const fn = httpsCallable<any, any>(functions, 'risks_seedFromCsv');
  try {
    const result = await fn({ labId, rows });
    return result.data;
  } catch (error) {
    throw unwrapCallableError(error);
  }
}

// ─── Error Handling ────────────────────────────────────────────────────────

function unwrapCallableError(error: any): Error {
  if (error.code === 'failed-precondition') {
    return new Error(error.message || 'Condição prévia falhou');
  }
  if (error.code === 'permission-denied') {
    return new Error('Sem permissão para esta ação');
  }
  if (error.code === 'not-found') {
    return new Error('Risco não encontrado');
  }
  if (error.code === 'invalid-argument') {
    return new Error(`Entrada inválida: ${error.message}`);
  }
  if (error.message) {
    return new Error(error.message);
  }
  return new Error('Erro desconhecido ao chamar função');
}
