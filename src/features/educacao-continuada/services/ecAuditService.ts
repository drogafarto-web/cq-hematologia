/**
 * ecAuditService.ts
 *
 * Rastreabilidade de mutations **não-regulatórias** (colaborador, treinamento,
 * template, trilha, kit, certificado config). Mutations regulatórias (execução,
 * participante, avaliações, alertas) já gravam audit dentro dos callables
 * Cloud Functions `ec_*` — este helper é só para o que passa fora delas.
 *
 * ⚠️ Audit log client-side é por construção falsificável via DevTools (o
 * caller escreve direto em `auditLogs/`). Mitigação: rules impedem update/delete,
 * firestore timestamps são servidor, `callerUid` bate com `request.auth.uid`.
 * Para compliance estrita, migrar para trigger `onDocumentCreated` em cada
 * coleção (backlog pós-Fase 9).
 */

import { addDoc, collection, db, serverTimestamp, auth } from '../../../shared/services/firebase';
import type { LabId } from '../types/_shared_refs';

export type AuditAction =
  | 'CREATE_COLABORADOR'
  | 'UPDATE_COLABORADOR'
  | 'SOFT_DELETE_COLABORADOR'
  | 'RESTORE_COLABORADOR'
  | 'CREATE_TREINAMENTO'
  | 'UPDATE_TREINAMENTO'
  | 'SOFT_DELETE_TREINAMENTO'
  | 'RESTORE_TREINAMENTO'
  | 'CREATE_TEMPLATE'
  | 'UPDATE_TEMPLATE'
  | 'SOFT_DELETE_TEMPLATE'
  | 'RESTORE_TEMPLATE'
  | 'CREATE_KIT'
  | 'UPDATE_KIT'
  | 'SOFT_DELETE_KIT'
  | 'RESTORE_KIT'
  | 'CREATE_TRILHA'
  | 'UPDATE_TRILHA'
  | 'SOFT_DELETE_TRILHA'
  | 'RESTORE_TRILHA';

export interface AuditLogEntry {
  action: AuditAction;
  labId: LabId;
  targetId: string;
  payload?: Record<string, unknown>;
}

/**
 * Grava entrada em `/auditLogs/{id}`. Não bloqueia a operação principal —
 * em caso de falha, loga no console e segue. Mutations regulatórias não
 * devem usar este helper (usar `auditLogs` do callable server-side).
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const callerUid = auth.currentUser?.uid ?? null;
    await addDoc(collection(db, 'auditLogs'), {
      action: entry.action,
      labId: entry.labId,
      targetId: entry.targetId,
      payload: entry.payload ?? null,
      callerUid,
      callerEmail: auth.currentUser?.email ?? null,
      source: 'client',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Audit não pode quebrar operação funcional — log e segue
    console.warn('[ecAuditService] falha ao gravar audit:', err);
  }
}
