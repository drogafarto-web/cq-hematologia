/**
 * documentoService.ts
 *
 * CRUD + transições de status + emissão de revisão para Documentos do SGQ.
 * Thin service: cobre apenas persistência + mapping snapshot → entidade.
 * Validações de negócio (versionamento, transições válidas, audit) ficam
 * no hook `useDocumentos`.
 *
 * Path: /labs/{labId}/sgq-documentos/{id}
 * Audit: /labs/{labId}/sgq-documentos-audit/{auditId} (append-only)
 *
 * RN-06 — soft delete only. `deletadoEm` no doc; nunca `deleteDoc`.
 */

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from '../../../shared/services/firebase';
import { db } from '../../../shared/services/firebase';
import type {
  Documento,
  DocumentoAuditEvent,
  DocumentoAuditEventType,
  DocumentoFilters,
  DocumentoInput,
  StatusDocumento,
  TipoDocumento,
} from '../types/Documento';

// ─── Path helpers ────────────────────────────────────────────────────────────

const colDocs = (labId: string) =>
  collection(db, 'labs', labId, 'sgq-documentos');

const colAudit = (labId: string) =>
  collection(db, 'labs', labId, 'sgq-documentos-audit');

const docRef = (labId: string, id: string) =>
  doc(db, 'labs', labId, 'sgq-documentos', id);

// ─── Mapping ─────────────────────────────────────────────────────────────────

interface DocumentoSnapshot {
  codigo: string;
  tipo: TipoDocumento;
  titulo: string;
  versao: number;
  url: string;
  autoridadeEmitente: string;
  dataEmissao: Timestamp;
  dataRevisao: Timestamp;
  proximaRevisao: Timestamp;
  status: StatusDocumento;
  substituidoPor?: string;
  substitui?: string;
  observacoes?: string;
  criadoEm: Timestamp;
  criadoPor: string;
  criadoPorName: string;
  atualizadoEm: Timestamp;
  atualizadoPor: string;
  atualizadoPorName: string;
  deletadoEm: Timestamp | null;
}

function mapSnapshot(id: string, labId: string, data: DocumentoSnapshot): Documento {
  return {
    id,
    labId,
    ...data,
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export interface OperatorContext {
  uid: string;
  name: string;
}

export interface CreateDocumentoArgs {
  labId: string;
  input: DocumentoInput;
  operator: OperatorContext;
}

/**
 * Cria um novo documento — versão inicial 1, status `em_revisao`.
 * Caller (hook) já validou unicidade do código.
 */
export async function createDocumento({
  labId,
  input,
  operator,
}: CreateDocumentoArgs): Promise<string> {
  const newRef = doc(colDocs(labId));
  const now = serverTimestamp();

  const payload = {
    ...input,
    labId,
    versao: 1,
    status: 'em_revisao' as StatusDocumento,
    criadoEm: now,
    criadoPor: operator.uid,
    criadoPorName: operator.name,
    atualizadoEm: now,
    atualizadoPor: operator.uid,
    atualizadoPorName: operator.name,
    deletadoEm: null,
  };

  const batch = writeBatch(db);
  batch.set(newRef, payload);

  // Audit
  const auditRef = doc(colAudit(labId));
  batch.set(auditRef, {
    labId,
    documentoId: newRef.id,
    codigoSnapshot: input.codigo,
    versaoSnapshot: 1,
    type: 'created' as DocumentoAuditEventType,
    timestamp: now,
    operadorId: operator.uid,
    operadorName: operator.name,
  });

  await batch.commit();
  return newRef.id;
}

export interface UpdateDocumentoArgs {
  labId: string;
  id: string;
  patch: Partial<DocumentoInput>;
  operator: OperatorContext;
}

/**
 * Atualiza campos de metadata (titulo, observacoes, autoridadeEmitente,
 * datas, url) sem mexer em versão/status. Para mudar status use
 * `transitionStatus`; para emitir revisão use `emitirRevisao`.
 */
export async function updateDocumento({
  labId,
  id,
  patch,
  operator,
}: UpdateDocumentoArgs): Promise<void> {
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.update(docRef(labId, id), {
    ...patch,
    atualizadoEm: now,
    atualizadoPor: operator.uid,
    atualizadoPorName: operator.name,
  });

  const auditRef = doc(colAudit(labId));
  batch.set(auditRef, {
    labId,
    documentoId: id,
    codigoSnapshot: patch.codigo ?? '',
    versaoSnapshot: 0,
    type: 'updated' as DocumentoAuditEventType,
    timestamp: now,
    operadorId: operator.uid,
    operadorName: operator.name,
  });

  await batch.commit();
}

export interface TransitionStatusArgs {
  labId: string;
  id: string;
  fromStatus: StatusDocumento;
  toStatus: StatusDocumento;
  codigo: string;
  versao: number;
  motivo?: string;
  operator: OperatorContext;
}

/**
 * Transita o status do documento. Validação das transições válidas é do hook.
 * Transições aceitas:
 *   em_revisao → vigente   (publicação)
 *   vigente    → em_revisao (volta a rascunho — raro, requer motivo)
 *   vigente    → obsoleto  (descontinuação manual sem revisão)
 *   em_revisao → obsoleto  (descarte de rascunho — requer motivo)
 */
export async function transitionStatus({
  labId,
  id,
  fromStatus,
  toStatus,
  codigo,
  versao,
  motivo,
  operator,
}: TransitionStatusArgs): Promise<void> {
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.update(docRef(labId, id), {
    status: toStatus,
    atualizadoEm: now,
    atualizadoPor: operator.uid,
    atualizadoPorName: operator.name,
  });

  const auditRef = doc(colAudit(labId));
  batch.set(auditRef, {
    labId,
    documentoId: id,
    codigoSnapshot: codigo,
    versaoSnapshot: versao,
    type: 'status-changed' as DocumentoAuditEventType,
    fromStatus,
    toStatus,
    motivo: motivo ?? null,
    timestamp: now,
    operadorId: operator.uid,
    operadorName: operator.name,
  });

  await batch.commit();
}

export interface EmitirRevisaoArgs {
  labId: string;
  documentoAnterior: Documento;
  novaInput: DocumentoInput;
  operator: OperatorContext;
}

/**
 * Emite uma nova versão. Atomic em batch:
 *   1) Documento anterior vai para `obsoleto` + grava `substituidoPor`.
 *   2) Cria novo doc com versão N+1, status `vigente`, `substitui` apontando
 *      para o anterior.
 *   3) Grava 2 entradas no audit log (`status-changed` + `revisao-emitida`).
 *
 * Caller (hook) DEVE validar que o anterior está em `vigente`. Permitir
 * revisão a partir de `em_revisao` é abuso — auditor acharia estranho.
 */
export async function emitirRevisao({
  labId,
  documentoAnterior,
  novaInput,
  operator,
}: EmitirRevisaoArgs): Promise<string> {
  const novaVersao = documentoAnterior.versao + 1;
  const novoRef = doc(colDocs(labId));
  const now = serverTimestamp();
  const batch = writeBatch(db);

  // 1) Anterior → obsoleto
  batch.update(docRef(labId, documentoAnterior.id), {
    status: 'obsoleto' as StatusDocumento,
    substituidoPor: novoRef.id,
    atualizadoEm: now,
    atualizadoPor: operator.uid,
    atualizadoPorName: operator.name,
  });

  // 2) Novo doc — vigente, mesmo código, versão +1
  batch.set(novoRef, {
    ...novaInput,
    labId,
    versao: novaVersao,
    status: 'vigente' as StatusDocumento,
    substitui: documentoAnterior.id,
    criadoEm: now,
    criadoPor: operator.uid,
    criadoPorName: operator.name,
    atualizadoEm: now,
    atualizadoPor: operator.uid,
    atualizadoPorName: operator.name,
    deletadoEm: null,
  });

  // 3a) Audit do anterior
  batch.set(doc(colAudit(labId)), {
    labId,
    documentoId: documentoAnterior.id,
    codigoSnapshot: documentoAnterior.codigo,
    versaoSnapshot: documentoAnterior.versao,
    type: 'status-changed' as DocumentoAuditEventType,
    fromStatus: 'vigente',
    toStatus: 'obsoleto',
    motivo: `Substituído pela versão ${novaVersao}`,
    timestamp: now,
    operadorId: operator.uid,
    operadorName: operator.name,
  });

  // 3b) Audit do novo
  batch.set(doc(colAudit(labId)), {
    labId,
    documentoId: novoRef.id,
    codigoSnapshot: novaInput.codigo,
    versaoSnapshot: novaVersao,
    type: 'revisao-emitida' as DocumentoAuditEventType,
    versaoAnteriorId: documentoAnterior.id,
    timestamp: now,
    operadorId: operator.uid,
    operadorName: operator.name,
  });

  await batch.commit();
  return novoRef.id;
}

export interface SoftDeleteArgs {
  labId: string;
  id: string;
  operator: OperatorContext;
}

/**
 * Soft-delete (RN-06). Apenas para documentos `em_revisao` que nunca foram
 * publicados — não permitir delete em `vigente`/`obsoleto` (auditor precisa
 * da trilha completa). Validação no hook.
 */
export async function softDeleteDocumento({
  labId,
  id,
  operator,
}: SoftDeleteArgs): Promise<void> {
  await updateDoc(docRef(labId, id), {
    deletadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    atualizadoPor: operator.uid,
    atualizadoPorName: operator.name,
  });
}

// ─── Subscribe ───────────────────────────────────────────────────────────────

export function subscribeDocumentos(
  labId: string,
  filters: DocumentoFilters,
  callback: (documentos: Documento[]) => void,
): () => void {
  // Sem orderBy composto — ordenação no client. Mantém indexação simples.
  const q = query(
    colDocs(labId),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    const all = snap.docs.map((d) =>
      mapSnapshot(d.id, labId, d.data() as DocumentoSnapshot),
    );

    const filtered = all.filter((doc) => {
      // Filtro por tipo
      if (filters.tipo) {
        const tipos = Array.isArray(filters.tipo) ? filters.tipo : [filters.tipo];
        if (!tipos.includes(doc.tipo)) return false;
      }

      // Filtro por status
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statuses.includes(doc.status)) return false;
      } else if (!filters.includeObsoletos) {
        if (doc.status === 'obsoleto') return false;
      }

      return true;
    });

    callback(filtered);
  });
}

// ─── Validação de unicidade ──────────────────────────────────────────────────

/**
 * Verifica se já existe doc não-deletado com o mesmo código (excluindo o id
 * passado, útil em update). Retorna true se duplicado.
 */
export async function existeCodigoDuplicado(
  labId: string,
  codigo: string,
  excludeId?: string,
): Promise<boolean> {
  const q = query(
    colDocs(labId),
    where('codigo', '==', codigo),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== excludeId);
}

// ─── Bulk import (Drive → SGQ) ───────────────────────────────────────────────

export interface BulkCreateItem {
  input: DocumentoInput;
}

export interface BulkCreateResult {
  created: { codigo: string; id: string }[];
  skipped: { codigo: string; reason: string }[];
}

/**
 * Cria múltiplos documentos em sequência. Pula códigos já existentes
 * (não-deletados) — idempotente. Cada criação faz seu próprio batch
 * (doc + audit), portanto N writes Firestore.
 *
 * Por que sequencial (não paralelo): rate limit das rules + clareza no
 * skipped por código duplicado. Volume esperado em primeiro import: ~80
 * docs (Labclin LM-01) — sequencial é aceitável.
 *
 * RN-08: status inicial sempre `em_revisao`. Auditor valida antes de
 * promover pra `vigente` via UI.
 */
export async function bulkCreateDocumentos({
  labId,
  items,
  operator,
}: {
  labId: string;
  items: BulkCreateItem[];
  operator: OperatorContext;
}): Promise<BulkCreateResult> {
  const created: { codigo: string; id: string }[] = [];
  const skipped: { codigo: string; reason: string }[] = [];

  for (const { input } of items) {
    try {
      const dup = await existeCodigoDuplicado(labId, input.codigo);
      if (dup) {
        skipped.push({ codigo: input.codigo, reason: 'já existe' });
        continue;
      }
      const id = await createDocumento({ labId, input, operator });
      created.push({ codigo: input.codigo, id });
    } catch (err) {
      skipped.push({
        codigo: input.codigo,
        reason: err instanceof Error ? err.message : 'erro desconhecido',
      });
    }
  }

  return { created, skipped };
}

// ─── Audit query ─────────────────────────────────────────────────────────────

export function subscribeAuditDocumento(
  labId: string,
  documentoId: string,
  callback: (events: DocumentoAuditEvent[]) => void,
): () => void {
  const q = query(
    colAudit(labId),
    where('documentoId', '==', documentoId),
    orderBy('timestamp', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    const events = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<DocumentoAuditEvent, 'id'>),
    }));
    callback(events);
  });
}

// ─── Export agregador para teste ─────────────────────────────────────────────

export const documentoService = {
  create: createDocumento,
  update: updateDocumento,
  transitionStatus,
  emitirRevisao,
  softDelete: softDeleteDocumento,
  subscribe: subscribeDocumentos,
  subscribeAudit: subscribeAuditDocumento,
  existeCodigoDuplicado,
};

// Re-export Timestamp para conveniência do hook (escrita de datas).
export { Timestamp, setDoc };
