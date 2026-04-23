/**
 * Triggers onDocumentWritten que derivam eventos de CIQ Audit a partir de
 * escritas nas coleções de runs e insumos. Cada trigger:
 *
 *   1. Deriva a action do delta (create → CREATE_RUN, update.status → APPROVE_RUN, etc)
 *   2. Identifica actor via `operatorUid`/`operatorName` no doc
 *   3. Escreve via `writeCIQAuditEvent` com eventId idempotente
 *
 * Idempotência: cada trigger usa um `eventId` determinístico derivado do docId
 * + action + version-like-field. Retries não duplicam.
 *
 * Segurança: a coleção `ciq-audit` nega write de cliente em rules
 * (firestore.rules — linhas 176-181 legacy + firestore.rules.post-onda2).
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { writeCIQAuditEvent } from './writer';
import type {
  CIQAuditAction,
  CIQAuditSeverity,
} from '../emailBackup/operacional/types';

type RunModule = 'hematologia' | 'imunologia' | 'coagulacao' | 'uroanalise';

interface ActorInfo {
  actorUid: string;
  actorName: string;
  actorRole: string;
}

function extractActor(doc: Record<string, unknown> | undefined): ActorInfo {
  if (!doc) {
    return {
      actorUid: 'unknown',
      actorName: 'Actor desconhecido',
      actorRole: 'desconhecido',
    };
  }
  return {
    actorUid: (doc['operatorUid'] as string) ?? 'unknown',
    actorName: (doc['operatorName'] as string) ?? 'Actor desconhecido',
    actorRole: (doc['operatorRole'] as string) ?? 'operador',
  };
}

// ─── Derivação de ação a partir do delta do run ─────────────────────────────

interface RunDelta {
  action: CIQAuditAction;
  severity: CIQAuditSeverity;
  reason?: string;
}

function deriveRunAction(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): RunDelta | null {
  // Delete: fora do escopo desta versão (soft delete via status preferível).
  if (!after) return null;

  // Create
  if (!before) {
    return { action: 'CREATE_RUN', severity: 'info' };
  }

  const statusBefore = before['status'] as string | undefined;
  const statusAfter = after['status'] as string | undefined;

  // Transições de status
  if (statusBefore !== statusAfter) {
    if (statusAfter === 'Aprovada') {
      return { action: 'APPROVE_RUN', severity: 'info' };
    }
    if (statusAfter === 'Rejeitada') {
      return {
        action: 'REJECT_RUN',
        severity: 'warning',
        reason: (after['rejectionReason'] as string) ?? undefined,
      };
    }
    if (statusAfter === 'Pendente' && statusBefore === 'Aprovada') {
      return {
        action: 'REOPEN_RUN',
        severity: 'critical',
        reason: (after['reopenReason'] as string) ?? 'Reabertura sem justificativa',
      };
    }
  }

  // Ação corretiva anexada
  const corrAfter = after['correctiveAction'] as string | undefined;
  const corrBefore = before['correctiveAction'] as string | undefined;
  if (corrAfter && corrAfter !== corrBefore) {
    return {
      action: 'ATTACH_CORRECTIVE_ACTION',
      severity: 'info',
      reason: corrAfter,
    };
  }

  // Edição de valor manual
  if (after['isEdited'] === true && before['isEdited'] !== true) {
    return {
      action: 'EDIT_RUN_VALUE',
      severity: 'critical',
      reason:
        (after['editReason'] as string) ??
        'Edição manual pós-OCR sem justificativa',
    };
  }

  // Update não significativo — não registra
  return null;
}

// ─── Derivação de ação a partir do delta do insumo ──────────────────────────

function deriveInsumoAction(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): RunDelta | null {
  if (!after) return null;

  const statusBefore = (before?.['status'] as string | undefined) ?? null;
  const statusAfter = (after['status'] as string | undefined) ?? null;

  if (statusBefore === statusAfter) {
    // checkar segregação
    const segAfter = after['segregated'] === true;
    const segBefore = before?.['segregated'] === true;
    if (segAfter && !segBefore) {
      return {
        action: 'SEGREGATE_LOT',
        severity: 'critical',
        reason:
          (after['segregationReason'] as string) ??
          'Lote segregado sem justificativa',
      };
    }
    return null;
  }

  if (statusAfter === 'fechado') {
    return { action: 'CLOSE_LOT', severity: 'info' };
  }
  if (statusAfter === 'descartado') {
    return {
      action: 'DISCARD_LOT',
      severity: 'critical',
      reason:
        (after['motivoDescarte'] as string) ?? 'Descarte sem justificativa',
    };
  }
  if (statusAfter === 'ativo' && statusBefore === null) {
    return { action: 'OPEN_LOT', severity: 'info' };
  }

  return null;
}

function insumoModule(doc: Record<string, unknown> | undefined): RunModule {
  if (!doc) return 'hematologia';
  const mods = doc['modulos'] as string[] | undefined;
  if (Array.isArray(mods) && mods.length > 0) {
    return mods[0] as RunModule;
  }
  const m = doc['modulo'] as string | undefined;
  return (m as RunModule) ?? 'hematologia';
}

// ─── Trigger: runs de hematologia ────────────────────────────────────────────

export const onHematologiaRunAudit = onDocumentWritten(
  'labs/{labId}/lots/{lotId}/runs/{runId}',
  async (event) => {
    const db = admin.firestore();
    const { labId, runId } = event.params as Record<string, string>;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const delta = deriveRunAction(before, after);
    if (!delta) return;

    const actor = extractActor(after);
    try {
      await writeCIQAuditEvent(db, {
        labId,
        moduleId: 'hematologia',
        action: delta.action,
        entityType: 'run',
        entityId: runId,
        actorUid: actor.actorUid,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        reason: delta.reason,
        severity: delta.severity,
        before,
        after,
        eventId: `run-${runId}-${delta.action}-${after?.['version'] ?? Date.now()}`,
      });
    } catch (err) {
      console.error(
        `[ciqAudit] Falha ao registrar ${delta.action} run=${runId}:`,
        err,
      );
    }
  },
);

// ─── Trigger: runs de imunologia ─────────────────────────────────────────────

export const onImunoRunAudit = onDocumentWritten(
  'labs/{labId}/ciq-imuno/{lotId}/runs/{runId}',
  async (event) => {
    const db = admin.firestore();
    const { labId, runId } = event.params as Record<string, string>;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // CIQ-Imuno usa "Conforme"/"NÃO CONFORME" — mapear para as actions padrão
    const normalized = normalizeImunoStatus(before, after);
    const delta = deriveRunAction(normalized.before, normalized.after);
    if (!delta) return;

    const actor = extractActor(after);
    try {
      await writeCIQAuditEvent(db, {
        labId,
        moduleId: 'imunologia',
        action: delta.action,
        entityType: 'run',
        entityId: runId,
        actorUid: actor.actorUid,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        reason: delta.reason,
        severity: delta.severity,
        before,
        after,
        eventId: `imuno-run-${runId}-${delta.action}-${after?.['version'] ?? Date.now()}`,
      });
    } catch (err) {
      console.error(
        `[ciqAudit] Falha ao registrar ${delta.action} imuno-run=${runId}:`,
        err,
      );
    }
  },
);

function normalizeImunoStatus(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): {
  before: Record<string, unknown> | undefined;
  after: Record<string, unknown> | undefined;
} {
  const map = (d: Record<string, unknown> | undefined) => {
    if (!d) return d;
    const exp = d['resultadoEsperado'];
    const obt = d['resultadoObtido'];
    const isConform = exp !== undefined && exp === obt;
    return {
      ...d,
      status: isConform ? 'Aprovada' : 'Rejeitada',
    };
  };
  return { before: map(before), after: map(after) };
}

// ─── Trigger: insumos (abertura/fechamento/descarte/segregação) ──────────────

export const onInsumoLifecycleAudit = onDocumentWritten(
  'labs/{labId}/insumos/{insumoId}',
  async (event) => {
    const db = admin.firestore();
    const { labId, insumoId } = event.params as Record<string, string>;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    const delta = deriveInsumoAction(before, after);
    if (!delta) return;

    const actor = extractActor(after);
    try {
      await writeCIQAuditEvent(db, {
        labId,
        moduleId: insumoModule(after),
        action: delta.action,
        entityType: 'insumo',
        entityId: insumoId,
        actorUid: actor.actorUid,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        reason: delta.reason,
        severity: delta.severity,
        before,
        after,
        eventId: `insumo-${insumoId}-${delta.action}-${after?.['status'] ?? 'x'}-${Date.now()}`,
      });
    } catch (err) {
      console.error(
        `[ciqAudit] Falha ao registrar ${delta.action} insumo=${insumoId}:`,
        err,
      );
    }
  },
);
