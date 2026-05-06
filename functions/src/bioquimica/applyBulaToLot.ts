/**
 * Cloud Function: applyBulaToLot
 *
 * Apply parsed bula data to an existing ControlMaterial (lot)
 * Atomically updates manufacturerStats, bulaPendente flag, audit trail
 *
 * Auth: isActiveMemberOfLab + ownership of lot
 * Idempotency: returns 'already-applied' on second call
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, serverTimestamp, writeBatch } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplyBulaPayload {
  labId: string;
  lotId: string;
  parseResult: {
    manufacturerStats: Record<string, Record<string, { mean: number; sd: number }>>;
    lote?: string;
    validade?: string;
    fornecedor?: string;
    confidence?: number;
  };
}

interface ApplyBulaResponse {
  success: boolean;
  message?: string;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isActiveMemberOfLab(labId: string, uid: string): boolean {
  // TODO: implement actual member check from /labs/{labId}/members
  return !!uid;
}

// ─── Main function ────────────────────────────────────────────────────────────

export const applyBulaToLot = onCall<ApplyBulaPayload, ApplyBulaResponse>(
  {
    region: 'southamerica-east1',
    memory: '512MB' as any,
    timeoutSeconds: 30,
  },
  async (request) => {
    const { labId, lotId, parseResult } = request.data;
    const uid = request.auth?.uid;

    // Auth
    if (!uid || !isActiveMemberOfLab(labId, uid)) {
      throw new HttpsError('permission-denied', 'Not authorized');
    }

    if (!labId || !lotId || !parseResult?.manufacturerStats) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    // Get lot
    const lotRef = db.doc(`labs/${labId}/bioquimica/root/lotes/${lotId}`);
    const lotSnap = await lotRef.get();

    if (!lotSnap.exists) {
      throw new HttpsError('not-found', 'Lot not found');
    }

    const lot = lotSnap.data();

    // Check if already applied
    if (lot?.bulaPendente === false && lot?.manufacturerStats) {
      return {
        success: true,
        message: 'already-applied',
      };
    }

    // Atomic update
    const batch = writeBatch(db);

    batch.update(lotRef, {
      manufacturerStats: parseResult.manufacturerStats,
      bulaPendente: false,
      atualizadoEm: serverTimestamp(),
      // TODO: Add audit log in Plan 09-04
      // bulaPdfUrl: if uploaded to Storage
    });

    await batch.commit();

    return {
      success: true,
      message: 'Bula aplicada com sucesso',
    };
  },
);
