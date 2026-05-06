/**
 * Lot Service — bioquímica
 * CRUD + real-time subscriptions for control material (lotes)
 *
 * Multi-tenant: all paths under /labs/{labId}/bioquimica/root/lotes/
 * RN-06: soft-delete only (never hard-delete)
 */

import type { Unsubscribe, Timestamp } from 'firebase/firestore';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { ControlMaterial, ControlMaterialInput } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateLotAvulsoInput {
  lote: string;
  validade: Date | Timestamp;
  fornecedor: string;
  equipmentIds: string[];
  niveis: Array<{
    level: 1 | 2 | 3;
    manufacturerStats: Record<string, Record<string, { mean: number; sd: number }>>;
  }>;
}

export interface CreateLotSemBulaInput {
  lote: string;
  validade: Date | Timestamp;
  fornecedor: string;
  equipmentIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLotsRef(labId: string) {
  return collection(db, 'labs', labId, 'bioquimica', 'root', 'lotes');
}

function getLotDocRef(labId: string, lotId: string) {
  return doc(db, 'labs', labId, 'bioquimica', 'root', 'lotes', lotId);
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribe to all lotes (non-deleted only)
 */
export function subscribeLotes(
  labId: string,
  callback: (lotes: ControlMaterial[]) => void,
): Unsubscribe {
  const lotsRef = getLotsRef(labId);
  const q = query(lotsRef, where('deletadoEm', '==', null));

  return onSnapshot(q, (snap) => {
    const lotes: ControlMaterial[] = [];
    snap.forEach((doc) => {
      if (doc.exists()) {
        lotes.push(doc.data() as ControlMaterial);
      }
    });
    callback(lotes);
  });
}

/**
 * Subscribe to active lot by equipmentId
 * Returns first lot where emUso=true and equipmentIds includes this equipmentId
 */
export function subscribeActiveLotForEquipment(
  labId: string,
  equipmentId: string,
  callback: (lot: ControlMaterial | null) => void,
): Unsubscribe {
  const lotsRef = getLotsRef(labId);
  const q = query(
    lotsRef,
    where('deletadoEm', '==', null),
    where('emUso', '==', true),
  );

  return onSnapshot(q, (snap) => {
    let activeLot: ControlMaterial | null = null;
    snap.forEach((doc) => {
      const lot = doc.data() as ControlMaterial;
      if (lot.equipmentIds?.includes(equipmentId)) {
        activeLot = lot;
      }
    });
    callback(activeLot);
  });
}

// ─── Create (client-side — Plan 09-02, will move to callable in 09-04) ──────

/**
 * Create lote avulso — manual entry with 1-3 levels and manual stats
 */
export async function createLotAvulso(
  labId: string,
  input: CreateLotAvulsoInput,
): Promise<string> {
  const lotId = doc(getLotsRef(labId)).id;

  // Flatten niveis.manufacturerStats into analitoId -> nivelId -> stats
  const manufacturerStats: any = {};
  input.niveis.forEach((nivel) => {
    const nivelId = `nivel${nivel.level}`;
    Object.entries(nivel.manufacturerStats).forEach(([analitoId, stats]) => {
      if (!manufacturerStats[analitoId]) {
        manufacturerStats[analitoId] = {};
      }
      manufacturerStats[analitoId][nivelId] = stats;
    });
  });

  const lotDoc: ControlMaterial = {
    id: lotId,
    labId,
    lote: input.lote,
    validade: input.validade as any,
    fornecedor: input.fornecedor,
    equipmentIds: input.equipmentIds,
    origem: 'avulso',
    bulaPendente: false,
    manufacturerStats,
    niveis: input.niveis.map((n) => ({
      id: `nivel${n.level}`,
      nome: `Nível ${n.level}`,
    })),
    criadoEm: serverTimestamp() as any,
    deletadoEm: null,
  };

  await setDoc(getLotDocRef(labId, lotId), lotDoc);
  return lotId;
}

/**
 * Create lote sem bula — pending bula (7-day grace period)
 */
export async function createLotSemBula(
  labId: string,
  input: CreateLotSemBulaInput,
): Promise<string> {
  const lotId = doc(getLotsRef(labId)).id;

  const lotDoc: ControlMaterial = {
    id: lotId,
    labId,
    lote: input.lote,
    validade: input.validade as any, // will be passed through
    fornecedor: input.fornecedor,
    equipmentIds: input.equipmentIds,
    origem: 'sem-bula-7d',
    bulaPendente: true,
    manufacturerStats: null,
    niveis: [
      { id: 'nivel1', nome: 'Nível 1' },
    ],
    criadoEm: serverTimestamp() as any,
    deletadoEm: null,
  };

  await setDoc(getLotDocRef(labId, lotId), lotDoc);
  return lotId;
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Audit-only: log lot switch for equipmentId
 * Actual switch happens via Cloud Function in Plan 09-04
 */
export async function setLotEmUso(
  labId: string,
  lotId: string,
  equipmentId: string,
  operatorId: string,
): Promise<void> {
  // TODO: Call Cloud Function recordTraceabilityEvent in Plan 09-04
  console.log(`[TODO] Log lot switch: ${lotId} for ${equipmentId} by ${operatorId}`);
}

/**
 * Mark lot as archived (end of life, replaced by newer lot)
 */
export async function setLotDisponivel(
  labId: string,
  lotId: string,
): Promise<void> {
  const lotRef = getLotDocRef(labId, lotId);
  await updateDoc(lotRef, {
    archivedAt: serverTimestamp(),
  });
}

// ─── Soft Delete ──────────────────────────────────────────────────────────────

/**
 * Soft-delete a lot (RN-06: never hard-delete)
 * Mark deletadoEm timestamp
 */
export async function softDeleteLot(
  labId: string,
  lotId: string,
): Promise<void> {
  const lotRef = getLotDocRef(labId, lotId);
  await updateDoc(lotRef, {
    deletadoEm: serverTimestamp(),
  });
}

/**
 * Restore a deleted lot (revert deletadoEm)
 */
export async function restoreLot(
  labId: string,
  lotId: string,
): Promise<void> {
  const lotRef = getLotDocRef(labId, lotId);
  await updateDoc(lotRef, {
    deletadoEm: null,
  });
}

// ─── Batch Operations ────────────────────────────────────────────────────────

/**
 * Atomic update to mark lot as received bula (apply parsed bula data)
 * Used by applyBulaToLot callable (Plan 09-04)
 */
export async function applyBulaToLotBatch(
  labId: string,
  lotId: string,
  manufacturerStats: Record<string, Record<string, { mean: number; sd: number }>>,
): Promise<void> {
  const lotRef = getLotDocRef(labId, lotId);
  const batch = writeBatch(db);

  batch.update(lotRef, {
    manufacturerStats,
    bulaPendente: false,
  });

  await batch.commit();
}
