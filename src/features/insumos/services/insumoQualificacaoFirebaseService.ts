/**
 * insumoQualificacaoFirebaseService — camada Firestore das qualificações.
 *
 * Cria docs em `/labs/{labId}/insumo-qualificacoes/{qId}` no estado inicial
 * `status='em_andamento'` + `signatureStatus='pending'`. A assinatura lógica
 * (SHA-256 do payload canônico) é gerada client-side e re-validada server-side
 * pelo trigger `onInsumoQualificacaoCreate` (recalcula com Admin SDK e
 * transiciona `signatureStatus → 'valid'` ou cria alerta `'signature_invalid'`).
 *
 * IMPORTANTE: aprovar/reprovar uma qualificação NÃO acontece neste service —
 * são callables Cloud Functions (`approveQualificacao`/`reproveQualificacao`)
 * que rodam transação atômica server-side com Admin SDK (sign-and-write).
 *
 * @see ../types/InsumoQualificacao.ts
 * @see functions/src/modules/insumoQualificacao/
 */

import {
  db,
  doc,
  setDoc,
  collection,
  serverTimestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type {
  InsumoQualificacao,
  QualificacaoChecklistRecebimento,
  QualificacaoMode,
} from '../types/InsumoQualificacao';

// ─── Path helpers ────────────────────────────────────────────────────────────

function qualificacoesCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMO_QUALIFICACOES);
}

function qualificacaoRef(labId: string, qId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMO_QUALIFICACOES, qId);
}

// ─── Canonical signature (deve bater com server) ─────────────────────────────

/**
 * Canonical do doc de qualificação — ordem de chaves imutável (alterar
 * invalida verificações retroativas). Server reproduz exatamente este
 * payload no trigger `onInsumoQualificacaoCreate` para validar a assinatura.
 *
 * Campos NÃO incluídos:
 *   - signatureStatus / status (mudam após decisão)
 *   - approvedBy/At/Cargo/Nome (preenchidos só pelo Admin SDK)
 *   - notivisa* (pós-decisão)
 *   - createdAt server timestamp (não é determinístico no client)
 */
export interface QualificacaoCanonicalPayload {
  qId: string;
  insumoId: string;
  produtoId: string;
  tipo: 'reagente' | 'controle';
  nivel?: 'positivo' | 'negativo';
  modulo: string;
  qualificacaoMode: QualificacaoMode;
  /** JSON.stringify do checklist com chaves em ordem alfabética (5 booleans). */
  checklist: string;
  /** runIds em ordem ascendente (sort estável) — vazio para checklist-rt. */
  evidenciaRunIds: string[];
  createdBy: string;
  /** ISO8601 do momento de criação no client. */
  clientCreatedAt: string;
}

export function canonicalQualificacao(p: QualificacaoCanonicalPayload): string {
  const sortedChecklist = JSON.parse(p.checklist) as Record<string, boolean>;
  const orderedChecklist: Record<string, boolean> = {};
  for (const k of Object.keys(sortedChecklist).sort()) {
    orderedChecklist[k] = sortedChecklist[k];
  }
  const ordered: Record<string, unknown> = {
    qId: p.qId,
    insumoId: p.insumoId,
    produtoId: p.produtoId,
    tipo: p.tipo,
    modulo: p.modulo,
    qualificacaoMode: p.qualificacaoMode,
    checklist: JSON.stringify(orderedChecklist),
    evidenciaRunIds: [...p.evidenciaRunIds].sort(),
    createdBy: p.createdBy,
    clientCreatedAt: p.clientCreatedAt,
  };
  if (p.nivel !== undefined) ordered.nivel = p.nivel;
  return JSON.stringify(ordered);
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Create payload ──────────────────────────────────────────────────────────

export interface CreateQualificacaoPayload {
  insumoId: string;
  produtoId: string;
  tipo: 'reagente' | 'controle';
  nivel?: 'positivo' | 'negativo';
  modulo: string;
  qualificacaoMode: QualificacaoMode;
  checklistRecebimento: QualificacaoChecklistRecebimento;
  evidenciaRunIds: string[];
  createdBy: string;
}

/**
 * Cria um doc `insumo-qualificacao` em estado pendente. Cliente:
 *   1. Monta payload canônico → SHA-256 → grava em `logicalSignature`.
 *   2. status='em_andamento', signatureStatus='pending'.
 *   3. Trigger server `onInsumoQualificacaoCreate` re-valida → 'valid' ou
 *      'invalid' (este último cria alerta em /alertas).
 *
 * Retorna o `qId` gerado client-side (UUID v4).
 *
 * NB: este NÃO é o caminho de aprovação. Após criar o doc, a UI dispara
 * a callable `approveQualificacao` que move status → 'aprovado' em transação.
 */
export async function createQualificacao(
  labId: string,
  payload: CreateQualificacaoPayload,
): Promise<string> {
  if (!labId) throw new Error('labId obrigatório');
  if (!payload.insumoId) throw new Error('insumoId obrigatório');

  const qId = crypto.randomUUID();
  const clientCreatedAt = new Date().toISOString();

  const canonical = canonicalQualificacao({
    qId,
    insumoId: payload.insumoId,
    produtoId: payload.produtoId,
    tipo: payload.tipo,
    nivel: payload.nivel,
    modulo: payload.modulo,
    qualificacaoMode: payload.qualificacaoMode,
    checklist: JSON.stringify(payload.checklistRecebimento),
    evidenciaRunIds: payload.evidenciaRunIds,
    createdBy: payload.createdBy,
    clientCreatedAt,
  });
  const logicalSignature = await sha256Hex(canonical);

  const data: Record<string, unknown> = {
    insumoId: payload.insumoId,
    produtoId: payload.produtoId,
    tipo: payload.tipo,
    modulo: payload.modulo,
    qualificacaoMode: payload.qualificacaoMode,
    checklistRecebimento: payload.checklistRecebimento,
    evidenciaRunIds: [...payload.evidenciaRunIds].sort(),
    qcApprovalMethod:
      payload.qualificacaoMode === 'corrida-validacao'
        ? 'corrida-validacao'
        : payload.qualificacaoMode === 'checklist-rt'
          ? 'checklist-rt'
          : 'corrida-validacao', // placeholder; servidor decide com base no qualificacaoMode
    status: 'em_andamento',
    approvedBy: '',
    approvedByNome: '',
    approvedByCargo: '',
    approvedAt: serverTimestamp(),
    logicalSignature,
    signatureStatus: 'pending',
    clientCreatedAt,
    createdAt: serverTimestamp(),
    createdBy: payload.createdBy,
  };
  if (payload.nivel !== undefined) data.nivel = payload.nivel;

  try {
    await setDoc(qualificacaoRef(labId, qId), data);
    return qId;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// Re-export para o trigger consumir a mesma forma canônica via TS path mapping
// não é possível (Functions não compartilha tsconfig). O servidor reimplementa
// `canonicalQualificacao` em `functions/src/modules/insumoQualificacao/signatureCanonical.ts`.
export type { InsumoQualificacao };
// Linha sem efeito apenas para deixar a função `qualificacoesCol` exportável
// no futuro; mantida privada por enquanto.
export { qualificacoesCol as _qualificacoesCol };
