import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase.config';
import type {
  VHSExam,
  VHSExamInput,
  VHSAddLeitura2Input,
  VHSLiberarInput,
  VHSLeitura,
} from '../types/VHSExam';
import { VHS_LIST_LIMIT, VHS_TOLERANCIA_MM_H } from '../constants/vhsConstants';

// ─── Helpers ───────────────────────────────────────────────────────────────

function vhsCollection(labId: string) {
  return collection(db, 'labs', labId, 'vhs-exams');
}

function mapVHSExam(id: string, data: Record<string, unknown>): VHSExam {
  return { id, ...data } as unknown as VHSExam;
}

function toLeitura(
  input: { valor: number; responsavelNome: string; leituraEm: Date },
  assinatura: string,
): VHSLeitura {
  return {
    valor: input.valor,
    responsavelNome: input.responsavelNome,
    leituraEm: Timestamp.fromDate(input.leituraEm),
    assinatura,
  };
}

function calcDivergencia(v1: number, v2: number): number {
  return Math.abs(v1 - v2);
}

// ─── saveVHSExam ───────────────────────────────────────────────────────────
// Cria documento com 1 ou 2 leituras de uma vez.
// leituraEm → Timestamp.fromDate (manual), registradoEm → serverTimestamp (auditoria)
export async function saveVHSExam(
  labId: string,
  input: VHSExamInput,
  sig1: string,
  uid: string,
  sig2?: string,
  sigVal1?: string,
  sigVal2?: string,
): Promise<string> {
  const leitura1 = toLeitura(input.leitura1, sig1);

  const base: Record<string, unknown> = {
    labId,
    amostraId: input.amostraId,
    pacienteId: input.pacienteId ?? null,
    pacienteNome: input.pacienteNome ?? null,
    metodo: input.metodo,
    equipamentoId: input.equipamentoId ?? null,
    observacoes: input.observacoes ?? null,
    leitura1,
    leitura2: null,
    divergencia: null,
    audit: {
      registradoPor: uid,
      registradoEm: serverTimestamp(),
    },
  };

  if (input.isValidationActive) {
    base.isValidationActive = true;
    if (input.leitura2 && sig2) {
      base.leitura2 = toLeitura(input.leitura2, sig2);
    }
    if (input.validacaoLeitura1 && sigVal1) {
      base.validacaoLeitura1 = toLeitura(input.validacaoLeitura1, sigVal1);
    }
    if (input.validacaoLeitura2 && sigVal2) {
      base.validacaoLeitura2 = toLeitura(input.validacaoLeitura2, sigVal2);
    }
    base.status = 'liberado';
    base.liberadoEm = serverTimestamp();
    base.liberadoPor = uid;
  } else {
    // Se a dupla checagem opcional não estiver ativa, os campos de validação são enviados como null (ou simplesmente não incluídos)
    base.isValidationActive = null;
    base.validacaoLeitura1 = null;
    base.validacaoLeitura2 = null;

    if (input.leitura2 && sig2) {
      const leitura2 = toLeitura(input.leitura2, sig2);
      const delta = calcDivergencia(leitura1.valor, leitura2.valor);
      const status = delta > VHS_TOLERANCIA_MM_H ? 'divergente' : 'liberado';

      base.leitura2 = leitura2;
      base.divergencia = delta;
      base.status = status;

      if (status === 'liberado') {
        base.liberadoEm = serverTimestamp();
        base.liberadoPor = uid;
      }
    } else {
      base.status = 'pendente';
    }
  }

  const ref = await addDoc(vhsCollection(labId), base);
  return ref.id;
}

// ─── addLeitura2 ───────────────────────────────────────────────────────────
// Completa exame pendente com a segunda leitura.
export async function addLeitura2(
  labId: string,
  examId: string,
  input: VHSAddLeitura2Input,
  sig2: string,
  uid: string,
): Promise<{ status: 'liberado' | 'divergente'; divergencia: number }> {
  const ref = doc(db, 'labs', labId, 'vhs-exams', examId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error('Exame não encontrado');
  }

  const data = snap.data() as Record<string, unknown>;
  if (data.status !== 'pendente') {
    throw new Error(`Exame com status "${data.status}" não aceita leitura 2`);
  }

  const leitura1 = data.leitura1 as VHSLeitura;
  const leitura2 = toLeitura(input.leitura2, sig2);
  const delta = calcDivergencia(leitura1.valor, leitura2.valor);
  const status = delta > VHS_TOLERANCIA_MM_H ? 'divergente' : 'liberado';

  const update: Record<string, unknown> = {
    leitura2,
    divergencia: delta,
    status,
    'audit.alteradoPor': uid,
    'audit.alteradoEm': serverTimestamp(),
  };

  if (status === 'liberado') {
    update.liberadoEm = serverTimestamp();
    update.liberadoPor = uid;
  }

  await updateDoc(ref, update);
  return { status, divergencia: delta };
}

// ─── liberarDivergente ─────────────────────────────────────────────────────
export async function liberarDivergente(
  labId: string,
  examId: string,
  liberadoPor: string,
  input: VHSLiberarInput,
): Promise<void> {
  if (!input.motivo || input.motivo.trim().length < 10) {
    throw new Error('Motivo deve ter pelo menos 10 caracteres');
  }

  const ref = doc(db, 'labs', labId, 'vhs-exams', examId);
  await updateDoc(ref, {
    status: 'liberado',
    liberadoEm: serverTimestamp(),
    liberadoPor,
    liberadoMotivo: input.motivo.trim(),
    'audit.alteradoPor': liberadoPor,
    'audit.alteradoEm': serverTimestamp(),
  });
}

// ─── cancelarExame ─────────────────────────────────────────────────────────
export async function cancelarExame(
  labId: string,
  examId: string,
  canceladoPor: string,
  motivo: string,
): Promise<void> {
  if (!motivo || motivo.trim().length < 5) {
    throw new Error('Motivo deve ter pelo menos 5 caracteres');
  }

  const ref = doc(db, 'labs', labId, 'vhs-exams', examId);
  await updateDoc(ref, {
    status: 'cancelado',
    canceladoEm: serverTimestamp(),
    canceladoPor,
    canceladoMotivo: motivo.trim(),
    'audit.alteradoPor': canceladoPor,
    'audit.alteradoEm': serverTimestamp(),
  });
}

// ─── getVHSExam ────────────────────────────────────────────────────────────
export async function getVHSExam(labId: string, examId: string): Promise<VHSExam | null> {
  const ref = doc(db, 'labs', labId, 'vhs-exams', examId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapVHSExam(snap.id, snap.data() as Record<string, unknown>);
}

// ─── listVHSExams ──────────────────────────────────────────────────────────
export interface ListVHSOptions {
  status?: string;
  limit?: number;
}

export async function listVHSExams(labId: string, options?: ListVHSOptions): Promise<VHSExam[]> {
  const constraints: unknown[] = [orderBy('audit.registradoEm', 'desc')];

  if (options?.status) {
    constraints.unshift(where('status', '==', options.status));
  }

  constraints.push(fsLimit(options?.limit ?? VHS_LIST_LIMIT));

  const q = query(vhsCollection(labId), ...(constraints as Parameters<typeof query>[1][]));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapVHSExam(d.id, d.data() as Record<string, unknown>));
}
