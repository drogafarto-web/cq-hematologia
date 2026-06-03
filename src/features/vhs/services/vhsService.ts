import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type {
  VHSExam,
  VHSExamInputLeitura1,
  VHSExamInputLeitura2,
  VHSDivergencia,
  VHSStatus,
} from '../types/VHSExam';

const COLLECTION = (labId: string) => collection(db, 'labs', labId, 'vhs-exams');

/**
 * Cria exame de VHS com a primeira leitura.
 * RDC 978 Art. 128 � operador 1 registra; exame fica pendente ate
 * segunda verificacao.
 */
export async function saveLeitura1(
  labId: string,
  input: VHSExamInputLeitura1,
  logicalSignature: string,
): Promise<VHSExam> {
  const payload = {
    ...input,
    labId,
    leitura1: {
      ...input.leitura1,
      ts: serverTimestamp(),
      assinatura: logicalSignature,
    },
    leitura2: null,
    status: 'pendente' as VHSStatus,
    criadoEm: serverTimestamp(),
    criadoPor: input.leitura1.operadorId,
  };

  const docRef = await addDoc(COLLECTION(labId), payload);

  return {
    id: docRef.id,
    ...payload,
    leitura1: {
      ...input.leitura1,
      ts: null as unknown as Timestamp,
      assinatura: logicalSignature,
    },
    leitura2: null,
    criadoEm: null as unknown as Timestamp,
    criadoPor: input.leitura1.operadorId,
  };
}

/**
 * Registra a segunda leitura e atualiza status.
 * Se |delta| > tolerancia, status vira 'divergente'.
 * Caso contrario, 'liberado'.
 */
export async function saveLeitura2(
  labId: string,
  examId: string,
  input: VHSExamInputLeitura2,
  logicalSignature: string,
  status: VHSStatus,
  divergencia?: VHSDivergencia,
): Promise<void> {
  const update: Record<string, unknown> = {
    leitura2: {
      ...input.leitura2,
      ts: serverTimestamp(),
      assinatura: logicalSignature,
    },
    status,
  };

  if (divergencia) {
    update.divergencia = divergencia;
  }

  if (status === 'liberado') {
    update.liberadoEm = serverTimestamp();
    update.liberadoPor = input.leitura2.operadorId;
  }

  await updateDoc(doc(COLLECTION(labId), examId), update);
}

/**
 * Liberacao de exame divergente por RT ou admin.
 * RDC 978 Art. 128 � exige justificativa documentada (min 10 chars).
 */
export async function liberarDivergente(
  labId: string,
  examId: string,
  liberadoPor: string,
  motivo: string,
): Promise<void> {
  if (motivo.length < 10) {
    throw new Error('Motivo deve ter no minimo 10 caracteres');
  }

  await updateDoc(doc(COLLECTION(labId), examId), {
    status: 'liberado',
    liberadoEm: serverTimestamp(),
    liberadoPor,
    observacoes: motivo,
  });
}

/**
 * Cancela um exame (admin/owner).
 */
export async function cancelarExame(
  labId: string,
  examId: string,
  canceladoPor: string,
  motivo: string,
): Promise<void> {
  await updateDoc(doc(COLLECTION(labId), examId), {
    status: 'cancelado',
    canceladoEm: serverTimestamp(),
    canceladoPor,
    canceladoMotivo: motivo,
  });
}

/**
 * Busca um exame pelo ID.
 */
export async function getVHSExam(labId: string, examId: string): Promise<VHSExam | null> {
  const snap = await getDoc(doc(COLLECTION(labId), examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as VHSExam;
}

/**
 * Lista exames de VHS de um laboratorio, ordenados por criadoEm desc.
 */
export async function listVHSExams(
  labId: string,
  options?: { status?: VHSStatus; limit?: number },
): Promise<VHSExam[]> {
  const constraints: any[] = [];

  if (options?.status) {
    constraints.push(where('status', '==', options.status));
  }

  constraints.push(orderBy('criadoEm', 'desc'));
  constraints.push(limit(options?.limit ?? 50));

  const snap = await getDocs(query(COLLECTION(labId), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VHSExam);
}
