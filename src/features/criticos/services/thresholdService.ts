/**
 * Threshold Service — CRUD operations for critical value thresholds
 *
 * Path: /labs/{labId}/criticos-thresholds/{thresholdId}
 * Convention: labId is mandatory positional parameter for multi-tenant isolation
 * RN-06: Always use soft-delete (never deleteDoc)
 *
 * Implements RDC 978 Art. 128 (rastreabilidade) + DICQ 4.3 (auditoria)
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { CriticosThreshold, CriticosThresholdInput } from '../types/threshold';
import { CriticosThresholdInputSchema } from '../types/threshold';
import { db } from '../../../shared/services/firebase';
import { ZodError } from 'zod';

export type LabId = string;

// ─── Path helpers ────────────────────────────────────────────────────────────

function thresholdsCollection(labId: LabId) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CRITICOS_THRESHOLDS);
}

function thresholdRef(labId: LabId, thresholdId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CRITICOS_THRESHOLDS, thresholdId);
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate threshold input using Zod schema
 */
export function validateThresholdInput(input: unknown): CriticosThresholdInput {
  try {
    return CriticosThresholdInputSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`Validation error: ${messages}`);
    }
    throw error;
  }
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

/**
 * Create a new threshold
 *
 * @param labId Lab identifier (multi-tenant isolation)
 * @param input Threshold input
 * @param operadorId Current user ID (for audit trail)
 * @param operadorNome Current user name (for audit trail)
 * @returns Document ID
 */
export async function createThreshold(
  labId: LabId,
  input: CriticosThresholdInput,
  operadorId: string,
  operadorNome: string,
): Promise<string> {
  try {
    // Validate input
    const validated = validateThresholdInput(input);

    const id = crypto.randomUUID();
    const newDoc: Omit<CriticosThreshold, 'id'> = {
      labId,
      analitoId: validated.analitoId,
      analitoNome: validated.analitoNome,
      unidade: validated.unidade,
      min: validated.min,
      max: validated.max,
      ...(validated.alwaysCritico !== undefined && { alwaysCritico: validated.alwaysCritico }),
      ...(validated.neverCritico !== undefined && { neverCritico: validated.neverCritico }),
      severidade: validated.severidade,
      ...(validated.condicional && { condicional: validated.condicional }),
      ativo: validated.ativo,
      criadoEm: Timestamp.now(),
      criadoPor: operadorId,
      deletadoEm: null,
    };

    await setDoc(thresholdRef(labId, id), newDoc);
    return id;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Validation error')) throw err;
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Get a single threshold by ID
 *
 * @param labId Lab identifier
 * @param thresholdId Threshold document ID
 * @returns Threshold entity or null if not found
 */
export async function getThresholdById(
  labId: LabId,
  thresholdId: string,
): Promise<CriticosThreshold | null> {
  try {
    const snap = await getDoc(thresholdRef(labId, thresholdId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<CriticosThreshold, 'id'>) } as CriticosThreshold;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Get all active thresholds for a lab, sorted by analitoId
 *
 * @param labId Lab identifier
 * @returns Array of active thresholds
 */
export async function getThresholds(labId: LabId): Promise<CriticosThreshold[]> {
  try {
    const q = query(
      thresholdsCollection(labId),
      where('deletadoEm', '==', null),
      orderBy('analitoId', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<CriticosThreshold, 'id'>) }) as CriticosThreshold,
    );
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Update an existing threshold (preserves criadoEm/criadoPor)
 *
 * @param labId Lab identifier
 * @param thresholdId Threshold document ID
 * @param input Partial update
 * @param operadorId Current user ID (for audit trail)
 */
export async function updateThreshold(
  labId: LabId,
  thresholdId: string,
  input: Partial<CriticosThresholdInput>,
  operadorId: string,
): Promise<void> {
  try {
    const docRef = thresholdRef(labId, thresholdId);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      throw new Error(`Threshold not found: ${thresholdId}`);
    }

    const existingData = existing.data() as CriticosThreshold;
    if (existingData.labId !== labId) {
      throw new Error('Cross-tenant write attempted');
    }

    // Merge with existing and validate
    const merged = {
      analitoId: input.analitoId ?? existingData.analitoId,
      analitoNome: input.analitoNome ?? existingData.analitoNome,
      unidade: input.unidade ?? existingData.unidade,
      min: input.min !== undefined ? input.min : existingData.min,
      max: input.max !== undefined ? input.max : existingData.max,
      severidade: input.severidade ?? existingData.severidade,
      ativo: input.ativo !== undefined ? input.ativo : existingData.ativo,
      ...(input.condicional !== undefined && { condicional: input.condicional }),
      ...(input.alwaysCritico !== undefined && { alwaysCritico: input.alwaysCritico }),
      ...(input.neverCritico !== undefined && { neverCritico: input.neverCritico }),
    };

    validateThresholdInput(merged);

    // Build update payload (never update criadoEm/criadoPor)
    const updatePayload: Record<string, unknown> = {
      atualizadoEm: Timestamp.now(),
      atualizadoPor: operadorId,
    };

    if (input.analitoId !== undefined) updatePayload.analitoId = input.analitoId;
    if (input.analitoNome !== undefined) updatePayload.analitoNome = input.analitoNome;
    if (input.unidade !== undefined) updatePayload.unidade = input.unidade;
    if (input.min !== undefined) updatePayload.min = input.min;
    if (input.max !== undefined) updatePayload.max = input.max;
    if (input.severidade !== undefined) updatePayload.severidade = input.severidade;
    if (input.ativo !== undefined) updatePayload.ativo = input.ativo;
    if (input.condicional !== undefined) updatePayload.condicional = input.condicional;
    if (input.alwaysCritico !== undefined) updatePayload.alwaysCritico = input.alwaysCritico;
    if (input.neverCritico !== undefined) updatePayload.neverCritico = input.neverCritico;

    await updateDoc(docRef, updatePayload);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) throw err;
    if (err instanceof Error && err.message.includes('Cross-tenant')) throw err;
    if (err instanceof Error && err.message.startsWith('Validation error')) throw err;
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Soft-delete a threshold (RN-06: never use hard delete)
 *
 * @param labId Lab identifier
 * @param thresholdId Threshold document ID
 * @param operadorId Current user ID (for audit trail)
 * @param operadorNome Current user name (for audit trail)
 */
export async function softDeleteThreshold(
  labId: LabId,
  thresholdId: string,
  operadorId: string,
  operadorNome: string,
): Promise<void> {
  try {
    const docRef = thresholdRef(labId, thresholdId);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      throw new Error(`Threshold not found: ${thresholdId}`);
    }

    const existingData = existing.data() as CriticosThreshold;
    if (existingData.labId !== labId) {
      throw new Error('Cross-tenant write attempted');
    }

    await updateDoc(docRef, {
      deletadoEm: Timestamp.now(),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) throw err;
    if (err instanceof Error && err.message.includes('Cross-tenant')) throw err;
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Get thresholds for a specific analyte (for critical detection)
 *
 * @param labId Lab identifier
 * @param analitoId Analyte ID to query
 * @returns Array of active thresholds for the analyte
 */
export async function listThresholdsByAnalyte(
  labId: LabId,
  analitoId: string,
): Promise<CriticosThreshold[]> {
  try {
    const q = query(
      thresholdsCollection(labId),
      where('analitoId', '==', analitoId),
      where('deletadoEm', '==', null),
    );
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<CriticosThreshold, 'id'>) }) as CriticosThreshold,
    );
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
