/**
 * CEQService — Client-side CRUD + Z-score calculation
 *
 * Handles:
 * - CEQParticipacao CRUD
 * - CEQAmostra receipt and tracking
 * - CEQResultado recording + Z-score calculation
 * - Integration with NC module (auto-NC on |Z| > 3)
 *
 * Cloud Function calls delegated to functions/src/modules/ceq/*
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  writeBatch,
  orderBy,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../config/firebase.config';
import type {
  CEQParticipacao,
  CEQAmostra,
  CEQResultado,
  CEQParticipacaoInput,
  CEQAmostraInput,
  CEQResultadoInput,
  ZScoreResult,
} from '../types/CEQ';
// ─── Collection Refs ─────────────────────────────────────────────────────────

const getCEQParticipacaoRef = (labId: string) =>
  collection(db, 'labs', labId, 'ceq-participacoes');
const getCEQAmostraRef = (labId: string) => collection(db, 'labs', labId, 'ceq-amostras');
const getCEQResultadoRef = (labId: string) => collection(db, 'labs', labId, 'ceq-resultados');

// ─── CEQParticipacao Operations ──────────────────────────────────────────────

/**
 * Create new CEQParticipacao (enrollment in PT program)
 * Calls Cloud Function for rule validation
 */
export async function criarCEQParticipacao(
  labId: string,
  input: CEQParticipacaoInput,
  uid: string,
): Promise<CEQParticipacao> {
  const participacao: CEQParticipacao = {
    id: '', // Set by Firestore
    labId,
    ...input,
    criadoEm: new Date(),
    criadoPor: uid,
  };

  const ref = await addDoc(getCEQParticipacaoRef(labId), {
    ...participacao,
    criadoEm: Timestamp.fromDate(participacao.criadoEm),
    dataInicio: Timestamp.fromDate(input.dataInicio),
    dataFim: input.dataFim ? Timestamp.fromDate(input.dataFim) : null,
    atualizadoEm: Timestamp.fromDate(new Date()),
    atualizadoPor: uid,
  });

  participacao.id = ref.id;
  return participacao;
}

/**
 * Fetch CEQParticipacao by ID
 */
export async function obterCEQParticipacao(
  labId: string,
  participacaoId: string,
): Promise<CEQParticipacao | null> {
  const docRef = doc(db, 'labs', labId, 'ceq-participacoes', participacaoId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    criadoEm: data.criadoEm?.toDate() || new Date(),
    atualizadoEm: data.atualizadoEm?.toDate(),
    dataInicio: data.dataInicio?.toDate() || new Date(),
    dataFim: data.dataFim?.toDate(),
    deletadoEm: data.deletadoEm?.toDate(),
  } as CEQParticipacao;
}

/**
 * List active CEQParticipacoes for lab
 */
export async function listarCEQParticipacoes(labId: string): Promise<CEQParticipacao[]> {
  const q = query(
    getCEQParticipacaoRef(labId),
    where('ativo', '==', true),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      criadoEm: data.criadoEm?.toDate() || new Date(),
      atualizadoEm: data.atualizadoEm?.toDate(),
      dataInicio: data.dataInicio?.toDate() || new Date(),
      dataFim: data.dataFim?.toDate(),
      deletadoEm: data.deletadoEm?.toDate(),
    } as CEQParticipacao;
  });
}

/**
 * Soft-delete CEQParticipacao
 */
export async function suspenderCEQParticipacao(
  labId: string,
  participacaoId: string,
  uid: string,
): Promise<void> {
  const docRef = doc(db, 'labs', labId, 'ceq-participacoes', participacaoId);
  await updateDoc(docRef, {
    ativo: false,
    suspendoEm: Timestamp.fromDate(new Date()),
    atualizadoEm: Timestamp.fromDate(new Date()),
    atualizadoPor: uid,
  });
}

// ─── CEQAmostra Operations ───────────────────────────────────────────────────

/**
 * Record receipt of PT sample from provider
 */
export async function receberCEQAmostra(
  labId: string,
  input: CEQAmostraInput,
  uid: string,
): Promise<CEQAmostra> {
  const amostra: CEQAmostra = {
    id: '', // Set by Firestore
    labId,
    ...input,
    status: 'recebida',
    criadoEm: new Date(),
    criadoPor: uid,
  };

  const ref = await addDoc(getCEQAmostraRef(labId), {
    ...amostra,
    criadoEm: Timestamp.fromDate(amostra.criadoEm),
    dataRecepcao: Timestamp.fromDate(input.dataRecepcao),
    atualizadoEm: Timestamp.fromDate(new Date()),
    atualizadoPor: uid,
  });

  amostra.id = ref.id;
  return amostra;
}

/**
 * Fetch CEQAmostra by ID
 */
export async function obterCEQAmostra(
  labId: string,
  amostraId: string,
): Promise<CEQAmostra | null> {
  const docRef = doc(db, 'labs', labId, 'ceq-amostras', amostraId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    criadoEm: data.criadoEm?.toDate() || new Date(),
    atualizadoEm: data.atualizadoEm?.toDate(),
    dataRecepcao: data.dataRecepcao?.toDate() || new Date(),
    dataResultado: data.dataResultado?.toDate(),
    resultadoRecebidoEm: data.resultadoRecebidoEm?.toDate(),
    deletadoEm: data.deletadoEm?.toDate(),
  } as CEQAmostra;
}

/**
 * List amostras for a given participacao
 */
export async function listarCEQAmostras(
  labId: string,
  ceqParticipacaoId: string,
): Promise<CEQAmostra[]> {
  const q = query(
    getCEQAmostraRef(labId),
    where('ceqParticipacaoId', '==', ceqParticipacaoId),
    where('deletadoEm', '==', null),
    orderBy('dataRecepcao', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      criadoEm: data.criadoEm?.toDate() || new Date(),
      atualizadoEm: data.atualizadoEm?.toDate(),
      dataRecepcao: data.dataRecepcao?.toDate() || new Date(),
      dataResultado: data.dataResultado?.toDate(),
      resultadoRecebidoEm: data.resultadoRecebidoEm?.toDate(),
      deletadoEm: data.deletadoEm?.toDate(),
    } as CEQAmostra;
  });
}

// ─── CEQResultado Operations + Z-Score Calculation ──────────────────────────

/**
 * Calculate Z-score using standard formula
 * Z = (obtained - reference) / estimated_sd
 *
 * Returns interpretacao based on ISO 13528:2015
 */
export function calcularZScore(
  valorObtido: number,
  valorReferencia: number,
  desvioEstimado: number,
): { zScore: number; interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria' } {
  // Guard against division by zero
  if (desvioEstimado === 0) {
    return {
      zScore: NaN,
      interpretacao: 'questionavel', // Treat as warning
    };
  }

  const zScore = (valorObtido - valorReferencia) / desvioEstimado;

  // ISO 13528:2015 interpretation
  let interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria';
  if (Math.abs(zScore) < 2) {
    interpretacao = 'satisfatoria';
  } else if (Math.abs(zScore) < 3) {
    interpretacao = 'questionavel';
  } else {
    interpretacao = 'insatisfatoria';
  }

  return { zScore, interpretacao };
}

/**
 * Record CEQResultado via Cloud Function callable
 * Server-side: calculates Z-score, creates resultado, auto-creates NC if |Z| >= 3
 */
export async function lancarCEQResultado(
  labId: string,
  input: CEQResultadoInput,
  uid: string,
): Promise<CEQResultado> {
  const callable = httpsCallable<
    {
      labId: string;
      ceqAmostraId: string;
      ceqParticipacaoId: string;
      analyteId: string;
      analyteName: string;
      valorObtido: number;
      unidade: string;
      valorReferencia: number;
      desvioEstimado: number;
    },
    {
      success: boolean;
      resultadoId: string;
      zScore: number;
      interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria';
      ncAutomaticaCriadaId?: string;
      ncNumero?: string;
    }
  >(functions, 'lacarCEQResultado');

  const result = await callable({
    labId,
    ceqAmostraId: input.ceqAmostraId,
    ceqParticipacaoId: input.ceqParticipacaoId,
    analyteId: input.analyteId || input.analyteName.toLowerCase().replace(/\s+/g, '-'),
    analyteName: input.analyteName,
    valorObtido: input.valorObtido,
    unidade: input.unidade || '',
    valorReferencia: input.valorReferencia,
    desvioEstimado: input.desvioEstimado,
  });

  const { resultadoId, zScore, interpretacao, ncAutomaticaCriadaId } = result.data;

  return {
    id: resultadoId,
    labId,
    ...input,
    zScore,
    interpretacao,
    temNCGrave: Math.abs(zScore) >= 3,
    ncAutomaticaCriadaId,
    status: 'lancado',
    criadoEm: new Date(),
    criadoPor: uid,
  } as CEQResultado;
}

/**
 * Fetch CEQResultado by ID
 */
export async function obterCEQResultado(
  labId: string,
  resultadoId: string,
): Promise<CEQResultado | null> {
  const docRef = doc(db, 'labs', labId, 'ceq-resultados', resultadoId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    criadoEm: data.criadoEm?.toDate() || new Date(),
    atualizadoEm: data.atualizadoEm?.toDate(),
    validadoEm: data.validadoEm?.toDate(),
    ncAutomaticaCriadaEm: data.ncAutomaticaCriadaEm?.toDate(),
    deletadoEm: data.deletadoEm?.toDate(),
    investigacao: data.investigacao
      ? {
          ...data.investigacao,
          dataInicio: data.investigacao.dataInicio?.toDate() || new Date(),
          dataFim: data.investigacao.dataFim?.toDate(),
        }
      : undefined,
  } as CEQResultado;
}

/**
 * List resultados for a given amostra
 */
export async function listarCEQResultados(
  labId: string,
  ceqAmostraId: string,
): Promise<CEQResultado[]> {
  const q = query(
    getCEQResultadoRef(labId),
    where('ceqAmostraId', '==', ceqAmostraId),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      criadoEm: data.criadoEm?.toDate() || new Date(),
      atualizadoEm: data.atualizadoEm?.toDate(),
      validadoEm: data.validadoEm?.toDate(),
      ncAutomaticaCriadaEm: data.ncAutomaticaCriadaEm?.toDate(),
      deletadoEm: data.deletadoEm?.toDate(),
      investigacao: data.investigacao
        ? {
            ...data.investigacao,
            dataInicio: data.investigacao.dataInicio?.toDate() || new Date(),
            dataFim: data.investigacao.dataFim?.toDate(),
          }
        : undefined,
    } as CEQResultado;
  });
}

/**
 * Query resultados with |Z| >= 3 (unsatisfactory/blocking)
 * Used for audit and oversight
 */
export async function listarResultadosInsatisfatorios(
  labId: string,
  days: number = 30,
): Promise<CEQResultado[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const q = query(
    getCEQResultadoRef(labId),
    where('interpretacao', '==', 'insatisfatoria'),
    where('criadoEm', '>=', Timestamp.fromDate(fromDate)),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
    limit(100),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      criadoEm: data.criadoEm?.toDate() || new Date(),
      atualizadoEm: data.atualizadoEm?.toDate(),
      validadoEm: data.validadoEm?.toDate(),
      ncAutomaticaCriadaEm: data.ncAutomaticaCriadaEm?.toDate(),
      deletadoEm: data.deletadoEm?.toDate(),
      investigacao: data.investigacao
        ? {
            ...data.investigacao,
            dataInicio: data.investigacao.dataInicio?.toDate() || new Date(),
            dataFim: data.investigacao.dataFim?.toDate(),
          }
        : undefined,
    } as CEQResultado;
  });
}

/**
 * Mark resultado as validated
 */
export async function validarCEQResultado(
  labId: string,
  resultadoId: string,
  uid: string,
): Promise<void> {
  const docRef = doc(db, 'labs', labId, 'ceq-resultados', resultadoId);
  await updateDoc(docRef, {
    status: 'validado',
    validadoEm: Timestamp.fromDate(new Date()),
    validadoPor: uid,
    atualizadoEm: Timestamp.fromDate(new Date()),
    atualizadoPor: uid,
  });
}
