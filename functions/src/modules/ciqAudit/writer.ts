/**
 * Writer central de CIQ Audit. Calcula contentHash + chainHash encadeado em
 * transação. Idempotente por `eventId` — reescrita retorna o evento existente
 * sem duplicar a cadeia.
 *
 * Não é chamado pelo cliente. Apenas triggers server-side (ver triggers.ts).
 */

import * as admin from 'firebase-admin';
import { createHash, randomUUID } from 'crypto';
import { genesisHash } from './genesis';
import type {
  CIQAuditAction,
  CIQAuditEvent,
  CIQAuditSeverity,
} from '../emailBackup/operacional/types';

// Ações críticas exigem reason obrigatória (RDC 978/2025 Art.128).
const CRITICAL_ACTIONS: Set<CIQAuditAction> = new Set([
  'REOPEN_RUN',
  'DISCARD_LOT',
  'EDIT_RUN_VALUE',
  'SEGREGATE_LOT',
]);

export interface WriteAuditInput {
  labId: string;
  moduleId: 'hematologia' | 'imunologia' | 'coagulacao' | 'uroanalise';
  action: CIQAuditAction;
  entityType: 'run' | 'lot' | 'insumo';
  entityId: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  reason?: string;
  severity: CIQAuditSeverity;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /**
   * Idempotency key — se já existir um evento com este eventId, nada é escrito.
   * Usar `{collection}:{docId}:{action}:{before?.version ?? 'v'}` ou similar
   * para garantir que retry de trigger não duplique.
   */
  eventId?: string;
}

function computeContentHash(payload: {
  action: CIQAuditAction;
  entityType: string;
  entityId: string;
  timestamp: number;
  actorUid: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}): string {
  // JSON.stringify tem ordem estável para chaves literais — mas dados externos
  // podem vir com ordem arbitrária. Serializar com chaves ordenadas.
  const canonical = JSON.stringify({
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    timestamp: payload.timestamp,
    actorUid: payload.actorUid,
    before: payload.before ? sortedJson(payload.before) : null,
    after: payload.after ? sortedJson(payload.after) : null,
    reason: payload.reason ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function sortedJson(value: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(value).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = value[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = sortedJson(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Grava um evento de audit. Transacional: garante que a cadeia seja consistente
 * sob concorrência. Se já existir evento com este `eventId`, retorna sem escrever.
 */
export async function writeCIQAuditEvent(
  db: admin.firestore.Firestore,
  input: WriteAuditInput,
): Promise<CIQAuditEvent | null> {
  // Validação de reason para ações críticas.
  if (CRITICAL_ACTIONS.has(input.action)) {
    if (!input.reason || input.reason.trim().length < 3) {
      throw new Error(
        `writeCIQAuditEvent: action=${input.action} é crítica e exige reason. ` +
          `Recebido: ${JSON.stringify(input.reason)}`,
      );
    }
  }

  const eventId = input.eventId ?? randomUUID();
  const auditRef = db.doc(`labs/${input.labId}/ciq-audit/${eventId}`);
  const chainStateRef = db.doc(`labs/${input.labId}/_state/ciq-audit-chain`);

  return db.runTransaction(async (tx) => {
    // Idempotência: se já existe, retorna o doc atual
    const existingSnap = await tx.get(auditRef);
    if (existingSnap.exists) {
      return toEvent(existingSnap.id, existingSnap.data() ?? {});
    }

    const stateSnap = await tx.get(chainStateRef);
    const previousHash: string = stateSnap.exists
      ? (stateSnap.data()?.['lastChainHash'] as string)
      : genesisHash(input.labId);

    // Timestamp server-side canônico — usamos Date.now() dentro de transação
    // porque FieldValue.serverTimestamp() não retorna o valor dentro da própria
    // transação. Trade-off: ganha determinismo de hash, perde microsegundos
    // de precisão.
    const ts = Date.now();

    const contentHash = computeContentHash({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      timestamp: ts,
      actorUid: input.actorUid,
      before: input.before,
      after: input.after,
      reason: input.reason,
    });

    const chainHash = createHash('sha256')
      .update(previousHash + contentHash)
      .digest('hex');

    const docData = {
      id: eventId,
      labId: input.labId,
      moduleId: input.moduleId,
      timestamp: admin.firestore.Timestamp.fromMillis(ts),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUid: input.actorUid,
      actorName: input.actorName,
      actorRole: input.actorRole,
      reason: input.reason ?? null,
      severity: input.severity,
      before: input.before ?? null,
      after: input.after ?? null,
      previousHash,
      contentHash,
      chainHash,
    };

    tx.set(auditRef, docData);
    tx.set(
      chainStateRef,
      {
        lastChainHash: chainHash,
        lastEventId: eventId,
        lastTimestamp: admin.firestore.Timestamp.fromMillis(ts),
      },
      { merge: true },
    );

    return toEvent(eventId, docData);
  });
}

function toEvent(id: string, data: Record<string, unknown>): CIQAuditEvent {
  return {
    id,
    labId: data['labId'] as string,
    moduleId: data['moduleId'] as string,
    timestamp: data['timestamp'] as admin.firestore.Timestamp,
    action: data['action'] as CIQAuditAction,
    entityType: data['entityType'] as 'run' | 'lot' | 'insumo',
    entityId: data['entityId'] as string,
    actorUid: data['actorUid'] as string,
    actorName: data['actorName'] as string,
    actorRole: data['actorRole'] as string,
    reason: (data['reason'] as string | null) ?? undefined,
    severity: data['severity'] as CIQAuditSeverity,
    previousHash: data['previousHash'] as string,
    contentHash: data['contentHash'] as string,
    chainHash: data['chainHash'] as string,
  };
}
