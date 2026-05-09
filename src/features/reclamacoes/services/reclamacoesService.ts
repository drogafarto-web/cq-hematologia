/**
 * src/features/reclamacoes/services/reclamacoesService.ts
 *
 * MP-6 thin client (read-only) for the reclamações Phase-2 surface. Mirrors
 * the data written by the `intakeReclamacao` family of callables; never writes
 * directly. Writes happen exclusively through callables — see
 * `functions/src/modules/reclamacoes/intakeReclamacao.ts`.
 *
 * Multi-tenant path: `labs/{labId}/reclamacoes/{id}` (RDC 978 + RN-06).
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import type { Reclamacao } from '../types/mp6';

export interface ReclamacaoFilters {
  status?: Reclamacao['status'][];
  severity?: Reclamacao['severity'][];
  fromMs?: number;
  toMs?: number;
}

/**
 * Realtime subscription to a lab's reclamações. Filters are applied server-side
 * where possible; `severity` (array) and date range are applied client-side
 * to avoid composite-index explosion. Soft-deleted rows are dropped.
 */
export function subscribeReclamacoes(
  labId: string,
  filters: ReclamacaoFilters,
  onChange: (rows: Reclamacao[]) => void,
): () => void {
  const constraints: QueryConstraint[] = [where('labId', '==', labId)];

  if (filters.status && filters.status.length > 0) {
    if (filters.status.length === 1) {
      constraints.push(where('status', '==', filters.status[0]));
    } else {
      constraints.push(where('status', 'in', filters.status.slice(0, 10)));
    }
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(
    collection(db, 'labs', labId, 'reclamacoes'),
    ...constraints,
  );

  return onSnapshot(q, (snap) => {
    const rows: Reclamacao[] = [];
    snap.forEach((d) => {
      const data = d.data() as DocumentData;
      if (data.deletedAt) return;

      if (filters.severity && filters.severity.length > 0) {
        if (!filters.severity.includes(data.severity as Reclamacao['severity'])) {
          return;
        }
      }

      const createdAt = toMs(data.createdAt);
      if (filters.fromMs !== undefined && createdAt < filters.fromMs) return;
      if (filters.toMs !== undefined && createdAt > filters.toMs) return;

      rows.push(snapshotToReclamacao(d.id, data));
    });
    onChange(rows);
  });
}

export async function getReclamacao(
  labId: string,
  id: string,
): Promise<Reclamacao | undefined> {
  const ref = doc(db, 'labs', labId, 'reclamacoes', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return undefined;
  const data = snap.data() as DocumentData;
  if (data.deletedAt) return undefined;
  return snapshotToReclamacao(snap.id, data);
}

// ─── Internals ──────────────────────────────────────────────────────────────

function toMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as Timestamp).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  return 0;
}

function snapshotToReclamacao(id: string, data: DocumentData): Reclamacao {
  return {
    id,
    labId: String(data.labId),
    canal: data.canal,
    status: data.status,
    severity: data.severity,
    patientName: data.patientName ?? undefined,
    patientContact: data.patientContact ?? undefined,
    consentToken: data.consentToken ?? undefined,
    description: String(data.description ?? ''),
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    signaturePatient: data.signaturePatient ?? undefined,
    rca: data.rca ?? undefined,
    capaId: data.capaId ?? undefined,
    createdAt: toMs(data.createdAt),
    triagedAt: data.triagedAt ? toMs(data.triagedAt) : undefined,
    triagedBy: data.triagedBy ?? undefined,
    closedAt: data.closedAt ? toMs(data.closedAt) : undefined,
    closedBy: data.closedBy ?? undefined,
    closingReason: data.closingReason ?? undefined,
    deletedAt: data.deletedAt ? toMs(data.deletedAt) : undefined,
  };
}
