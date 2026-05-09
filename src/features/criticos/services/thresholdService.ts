import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import {
  CriticoThreshold,
  CriticoThresholdInput,
  CriticoThresholdInputSchema,
} from '../types/threshold';
import { ZodError } from 'zod';

export type LabId = string;

/**
 * Threshold Service — CRUD operations for critical value thresholds
 *
 * Convention: labId is mandatory positional parameter for multi-tenant isolation
 * RN-06: Always use soft-delete (never deleteDoc)
 */

// Collection path helper
function thresholdsCollection(labId: LabId) {
  return collection(db, 'labs', labId, 'criticos-thresholds');
}

/**
 * Validate threshold input using Zod schema
 */
export function validateThresholdInput(input: unknown): CriticoThresholdInput {
  try {
    return CriticoThresholdInputSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`Validation error: ${messages}`);
    }
    throw error;
  }
}

/**
 * Get all active thresholds for a lab
 */
export async function getThresholds(labId: LabId): Promise<CriticoThreshold[]> {
  const q = query(thresholdsCollection(labId), where('deletadoEm', '==', null));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<CriticoThreshold, 'id'>),
    id: doc.id,
  }));
}

/**
 * Get thresholds for a specific analyte
 */
export async function listThresholdsByAnalyte(
  labId: LabId,
  analitoId: string
): Promise<CriticoThreshold[]> {
  const q = query(
    thresholdsCollection(labId),
    where('analitoId', '==', analitoId),
    where('deletadoEm', '==', null)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<CriticoThreshold, 'id'>),
    id: doc.id,
  }));
}

/**
 * Create a new threshold
 *
 * @param labId Lab identifier (multi-tenant isolation)
 * @param input Validated threshold input (use validateThresholdInput first)
 * @param operadorId Current user ID (for audit trail)
 * @param operadorNome Current user name (for audit trail)
 * @returns Document ID
 */
export async function createThreshold(
  labId: LabId,
  input: CriticoThresholdInput,
  operadorId: string,
  operadorNome: string
): Promise<string> {
  // Validate input
  const validated = validateThresholdInput(input);

  // Create reference
  const ref = doc(thresholdsCollection(labId));

  // Write document with audit fields
  await setDoc(ref, {
    labId, // Defense-in-depth: include labId in document
    ...validated,
    criadoEm: Timestamp.now(),
    criador: {
      operadorId,
      nome: operadorNome,
    },
    deletadoEm: null,
  });

  return ref.id;
}

/**
 * Update an existing threshold
 *
 * @param labId Lab identifier
 * @param id Threshold document ID
 * @param input Partial update (validated)
 * @param operadorId Current user ID
 */
export async function updateThreshold(
  labId: LabId,
  id: string,
  input: Partial<CriticoThresholdInput>,
  operadorId: string
): Promise<void> {
  // Verify document exists and belongs to this lab
  const docRef = doc(thresholdsCollection(labId), id);
  const existing = await getDoc(docRef);

  if (!existing.exists()) {
    throw new Error(`Threshold not found: ${id}`);
  }

  const existingData = existing.data() as CriticoThreshold;
  if (existingData.labId !== labId) {
    throw new Error('Cross-tenant write attempted');
  }

  // Validate merged input
  const merged = { ...existingData, ...input };
  const validated = validateThresholdInput(merged);

  // Update (keep criadoEm and criador immutable)
  const updatePayload = {
    analitoId: validated.analitoId,
    min: validated.min,
    max: validated.max,
    severidade: validated.severidade,
    ativo: validated.ativo,
    condicional: validated.condicional,
  };
  await updateDoc(docRef, updatePayload);
}

/**
 * Soft-delete a threshold (RN-06)
 *
 * @param labId Lab identifier
 * @param id Threshold document ID
 * @param operadorId Current user ID
 * @param operadorNome Current user name
 */
export async function softDeleteThreshold(
  labId: LabId,
  id: string,
  operadorId: string,
  operadorNome: string
): Promise<void> {
  // Verify document exists and belongs to this lab
  const docRef = doc(thresholdsCollection(labId), id);
  const existing = await getDoc(docRef);

  if (!existing.exists()) {
    throw new Error(`Threshold not found: ${id}`);
  }

  const existingData = existing.data() as CriticoThreshold;
  if (existingData.labId !== labId) {
    throw new Error('Cross-tenant write attempted');
  }

  // Mark deleted
  await updateDoc(docRef, {
    deletadoEm: Timestamp.now(),
    deletador: {
      operadorId,
      nome: operadorNome,
    },
  });
}

/**
 * Get a single threshold by ID
 */
export async function getThresholdById(labId: LabId, id: string): Promise<CriticoThreshold> {
  const docRef = doc(thresholdsCollection(labId), id);
  const existing = await getDoc(docRef);

  if (!existing.exists()) {
    throw new Error(`Threshold not found: ${id}`);
  }

  const data = existing.data() as Omit<CriticoThreshold, 'id'>;
  return {
    ...data,
    id: existing.id,
  };
}
