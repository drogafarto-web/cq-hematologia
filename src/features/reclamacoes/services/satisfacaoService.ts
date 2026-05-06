/**
 * Satisfacao Service Layer
 *
 * NPS (Net Promoter Score) survey service: CRUD + subscription.
 * Handles: survey responses, campaign management.
 * Multi-tenant: `/labs/{labId}/satisfacao-respostas/`
 */

import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import type { NPSResposta, CampanhaSatisfacao, OrigemNPS } from '../types';

/**
 * Subscribe to NPS responses for a lab
 */
export function subscribeToNPSRespostas(
  labId: string,
  filters?: {
    origem?: OrigemNPS;
    limit?: number;
  },
  onUpdate?: (respostas: NPSResposta[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const constraints: any[] = [
    where('labId', '==', labId),
    orderBy('respondidoEm', 'desc'),
  ];

  if (filters?.origem) {
    constraints.push(where('origem', '==', filters.origem));
  }

  if (filters?.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(
    collection(db, 'labs', labId, 'satisfacao-respostas'),
    ...constraints
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const respostas: NPSResposta[] = [];
      snapshot.forEach((doc) => {
        respostas.push(doc.data() as NPSResposta);
      });
      onUpdate?.(respostas);
    },
    (error) => {
      console.error('Error subscribing to NPS respostas:', error);
      onError?.(error as Error);
    }
  );
}

/**
 * Get single NPS response
 */
export async function getNPSResposta(
  labId: string,
  respostaId: string
): Promise<NPSResposta | null> {
  const docRef = doc(db, 'labs', labId, 'satisfacao-respostas', respostaId);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return snapshot.data() as NPSResposta;
  }

  return null;
}

/**
 * Get NPS responses by origin
 */
export async function getNPSRespostasByOrigem(
  labId: string,
  origem: OrigemNPS,
  limitCount = 500
): Promise<NPSResposta[]> {
  const q = query(
    collection(db, 'labs', labId, 'satisfacao-respostas'),
    where('labId', '==', labId),
    where('origem', '==', origem),
    orderBy('respondidoEm', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  const respostas: NPSResposta[] = [];

  snapshot.forEach((doc) => {
    respostas.push(doc.data() as NPSResposta);
  });

  return respostas;
}

/**
 * Get NPS responses for a specific complaint (pós-resolução)
 */
export async function getNPSRespostasParaReclamacao(
  labId: string,
  reclamacaoId: string
): Promise<NPSResposta[]> {
  const q = query(
    collection(db, 'labs', labId, 'satisfacao-respostas'),
    where('labId', '==', labId),
    where('reclamacaoId', '==', reclamacaoId),
    orderBy('respondidoEm', 'desc')
  );

  const snapshot = await getDocs(q);
  const respostas: NPSResposta[] = [];

  snapshot.forEach((doc) => {
    respostas.push(doc.data() as NPSResposta);
  });

  return respostas;
}

/**
 * Get NPS responses for a quarterly campaign
 */
export async function getNPSRespostasParaCampanha(
  labId: string,
  trimestre: string
): Promise<NPSResposta[]> {
  const q = query(
    collection(db, 'labs', labId, 'satisfacao-respostas'),
    where('labId', '==', labId),
    where('trimestreRecurring', '==', trimestre),
    orderBy('respondidoEm', 'desc')
  );

  const snapshot = await getDocs(q);
  const respostas: NPSResposta[] = [];

  snapshot.forEach((doc) => {
    respostas.push(doc.data() as NPSResposta);
  });

  return respostas;
}

/**
 * Calculate NPS score from responses
 * Formula: % promotores (9-10) - % detratores (0-6)
 *
 * @returns NPS score (-100 to +100)
 */
export async function calcularNPSScore(
  respostas: NPSResposta[]
): Promise<number> {
  if (respostas.length === 0) return 0;

  const detratores = respostas.filter((r) => r.nota < 7).length;
  const promotores = respostas.filter((r) => r.nota >= 9).length;

  const percentDetratores = (detratores / respostas.length) * 100;
  const percentPromotores = (promotores / respostas.length) * 100;

  return Math.round(percentPromotores - percentDetratores);
}

/**
 * Get NPS distribution for dashboard
 */
export async function getNPSDistribution(
  labId: string,
  origem?: OrigemNPS
): Promise<{
  detratores: number;
  neutros: number;
  promotores: number;
  score: number;
}> {
  const constraints = [where('labId', '==', labId)];
  if (origem) {
    constraints.push(where('origem', '==', origem));
  }

  const q = query(
    collection(db, 'labs', labId, 'satisfacao-respostas'),
    ...constraints
  );

  const snapshot = await getDocs(q);
  const respostas: NPSResposta[] = [];

  snapshot.forEach((doc) => {
    respostas.push(doc.data() as NPSResposta);
  });

  const detratores = respostas.filter((r) => r.nota < 7).length;
  const neutros = respostas.filter((r) => r.nota >= 7 && r.nota <= 8).length;
  const promotores = respostas.filter((r) => r.nota >= 9).length;
  const score = await calcularNPSScore(respostas);

  return { detratores, neutros, promotores, score };
}

/**
 * Subscribe to campaigns for a lab
 */
export function subscribeToCalmpanhas(
  labId: string,
  onUpdate?: (campanhas: CampanhaSatisfacao[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'labs', labId, 'satisfacao-campanhas'),
    where('labId', '==', labId),
    orderBy('dataInicio', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const campanhas: CampanhaSatisfacao[] = [];
      snapshot.forEach((doc) => {
        campanhas.push(doc.data() as CampanhaSatisfacao);
      });
      onUpdate?.(campanhas);
    },
    (error) => {
      console.error('Error subscribing to campanhas:', error);
      onError?.(error as Error);
    }
  );
}

/**
 * Get campaign by ID
 */
export async function getCampanha(
  labId: string,
  campanhaId: string
): Promise<CampanhaSatisfacao | null> {
  const docRef = doc(db, 'labs', labId, 'satisfacao-campanhas', campanhaId);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return snapshot.data() as CampanhaSatisfacao;
  }

  return null;
}

/**
 * Get campaigns by status
 */
export async function getCampanhasByStatus(
  labId: string,
  status: 'ativa' | 'encerrada' | 'processando'
): Promise<CampanhaSatisfacao[]> {
  const q = query(
    collection(db, 'labs', labId, 'satisfacao-campanhas'),
    where('labId', '==', labId),
    where('status', '==', status),
    orderBy('dataInicio', 'desc')
  );

  const snapshot = await getDocs(q);
  const campanhas: CampanhaSatisfacao[] = [];

  snapshot.forEach((doc) => {
    campanhas.push(doc.data() as CampanhaSatisfacao);
  });

  return campanhas;
}

/**
 * Get NPS responses that are not yet anonymized
 */
export async function getNPSRespostasNaoAnonimizadas(
  labId: string
): Promise<NPSResposta[]> {
  const q = query(
    collection(db, 'labs', labId, 'satisfacao-respostas'),
    where('labId', '==', labId),
    where('anonimizadoEm', '==', null)
  );

  const snapshot = await getDocs(q);
  const respostas: NPSResposta[] = [];

  snapshot.forEach((doc) => {
    respostas.push(doc.data() as NPSResposta);
  });

  return respostas;
}

/**
 * Get NPS responses due for anonymization (> 90 days old)
 */
export async function getNPSRespostasDueForAnonymization(
  labId: string,
  daysSinceResponse = 90
): Promise<NPSResposta[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceResponse);

  const q = query(
    collection(db, 'labs', labId, 'satisfacao-respostas'),
    where('labId', '==', labId),
    where('respondidoEm', '<', Timestamp.fromDate(cutoffDate)),
    where('anonimizadoEm', '==', null)
  );

  const snapshot = await getDocs(q);
  const respostas: NPSResposta[] = [];

  snapshot.forEach((doc) => {
    respostas.push(doc.data() as NPSResposta);
  });

  return respostas;
}

/**
 * Count NPS responses
 */
export async function countNPSRespostas(labId: string): Promise<number> {
  const q = query(
    collection(db, 'labs', labId, 'satisfacao-respostas'),
    where('labId', '==', labId)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}
