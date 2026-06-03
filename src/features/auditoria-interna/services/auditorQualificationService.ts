import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type {
  AuditorQualification,
  AuditorImpediment,
  AuditorQualificationInput,
} from '../types/auditor';

const COLLECTION_PATH = (labId: string) => `labs/${labId}/auditor-qualifications`;

export async function getAuditoresQualificados(labId: string): Promise<AuditorQualification[]> {
  const ref = collection(db, COLLECTION_PATH(labId));
  const q = query(ref, where('status', 'in', ['ativo', 'em-formacao']));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditorQualification);
}

export async function getAuditorById(
  labId: string,
  auditorId: string,
): Promise<AuditorQualification | null> {
  const ref = doc(db, COLLECTION_PATH(labId), auditorId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AuditorQualification;
}

export function checkImpediment(
  auditor: AuditorQualification,
  blocoAuditado: string,
): AuditorImpediment | null {
  const scope = auditor.escoposAutorizados.find((s) => s.bloco === blocoAuditado);
  if (scope && !scope.autorizado && scope.impedimento) {
    return {
      auditorId: auditor.id,
      setorImpedido: blocoAuditado,
      motivo: scope.impedimento,
      tipo: 'responsabilidade-direta',
    };
  }
  return null;
}

export function validateQualification(auditor: AuditorQualification): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const now = Timestamp.now().toMillis();

  if (auditor.qualificacaoValidaAte.toMillis() < now) {
    issues.push('Qualificação vencida');
  }

  if (auditor.necessitaReciclagem) {
    issues.push('Necessita reciclagem');
  }

  const hasFormacaoInicial = auditor.treinamentos.some((t) => t.tipo === 'formacao-inicial');
  if (!hasFormacaoInicial) {
    issues.push('Sem treinamento de formação inicial');
  }

  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  if (auditor.ultimaAuditoriaData && auditor.ultimaAuditoriaData.toMillis() < oneYearAgo) {
    issues.push('Sem auditoria realizada nos últimos 12 meses');
  }

  if (!auditor.ultimaAuditoriaData && auditor.status === 'ativo') {
    issues.push('Nenhuma auditoria realizada');
  }

  return { valid: issues.length === 0, issues };
}

export async function createAuditorQualification(
  labId: string,
  data: AuditorQualificationInput,
): Promise<string> {
  const ref = collection(db, COLLECTION_PATH(labId));
  const now = Timestamp.now();
  const docRef = await addDoc(ref, {
    ...data,
    criadoEm: now,
    atualizadoEm: now,
  });
  return docRef.id;
}

export async function updateAuditorQualification(
  labId: string,
  auditorId: string,
  data: Partial<AuditorQualification>,
): Promise<void> {
  const ref = doc(db, COLLECTION_PATH(labId), auditorId);
  await updateDoc(ref, {
    ...data,
    atualizadoEm: Timestamp.now(),
  });
}

export function subscribeAuditores(
  labId: string,
  callback: (auditores: AuditorQualification[]) => void,
): () => void {
  const ref = collection(db, COLLECTION_PATH(labId));
  return onSnapshot(ref, (snap) => {
    const auditores = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditorQualification);
    callback(auditores);
  });
}
