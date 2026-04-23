/**
 * complianceAudit — audit trail de decisões de compliance em corridas.
 *
 * Grava em `/auditLogs` (coleção global, mesmo padrão usado por Cloud Functions
 * admin como createUser/setUserSuperAdmin). Rules atuais permitem create por
 * qualquer membro autenticado — imutável por convenção (nunca update/delete).
 *
 * Fire-and-forget do ponto de vista do caller — a falha aqui nunca reverte
 * o save da run. Trigger server-side `onRunCreatedComplianceCheck` também
 * grava como defense-in-depth; dupla escrita é idempotente via `action` + `runId`.
 */

import { addDoc, collection, db, serverTimestamp } from '../../../shared/services/firebase';

export interface ComplianceAuditEntry {
  action:
    | 'RUN_COMPLIANCE_OVERRIDE'
    | 'RUN_COMPLIANCE_VIOLATION_DETECTED'
    /**
     * RUN_RECLASSIFICATION — RDC 978/2025 Art.128 — mudança de status de uma
     * run já registrada (ex: Rejeitada → Aprovada). Exige justificativa
     * ≥15 chars capturada pelo caller e gravada em `payload.justificativa`.
     */
    | 'RUN_RECLASSIFICATION';
  labId: string;
  runId: string;
  lotId: string;
  module: string;
  callerUid: string | null;
  callerEmail: string | null;
  payload: Record<string, unknown>;
}

/**
 * Grava um audit log de decisão de compliance. Nunca throws — erros são
 * logados no console para observabilidade. O caller não deve aguardar.
 */
export async function logComplianceAudit(entry: ComplianceAuditEntry): Promise<void> {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      ...entry,
      source: 'client',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn(
      `[complianceAudit] falha ao gravar (${entry.action}, run=${entry.runId}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
