/**
 * IA Dataset Collector — Client-side dataset entry uploader
 *
 * Uploads strip images to Storage + metadata to Firestore for ML retraining.
 * LGPD-compliant: no patient identifiers. Consent-gated.
 *
 * Storage path: gs://{bucket}/ia-strip-dataset/{labId}/{ts}-{uid}.jpg
 * Firestore path: /labs/{labId}/ia-strip-dataset/{entryId}
 */

import { ref, uploadBytes, StorageReference, FirebaseStorage } from 'firebase/storage';
import {
  collection,
  doc,
  setDoc,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { storage, db } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { ParsedAnalyte } from './iaStripValidation';

/**
 * Dataset entry metadata
 */
export interface DatasetEntry {
  labId: string;
  imageStoragePath: string;
  parsedResultId: string;
  groundTruth?: ParsedAnalyte[];
  modelVersion: string;
  uploadedAt: number;
  uploadedBy: string;
  consentGiven: boolean;
}

/**
 * Upload a strip image to dataset collection.
 *
 * @param labId Lab identifier
 * @param file Image file to upload
 * @param parsedResultId ID of the parse result record
 * @param modelVersion Model version (e.g., 'gemini-2.5-flash')
 * @param consentGiven Operator consent for retraining
 * @returns { entryId, storagePath }
 * @throws Error if consent not given
 */
export async function uploadDatasetEntry(
  labId: string,
  file: File,
  parsedResultId: string,
  modelVersion: string,
  consentGiven: boolean,
  userId: string,
): Promise<{ entryId: string; storagePath: string }> {
  try {
    // Validate consent
    if (!consentGiven) {
      throw new Error('Consent required for dataset collection');
    }

    // Upload to Storage
    const timestamp = Date.now();
    const storagePath = `ia-strip-dataset/${labId}/${timestamp}-${userId}.jpg`;
    const fileRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(fileRef, file, {
      contentType: file.type,
      customMetadata: {
        labId,
        uploadedBy: userId,
        modelVersion,
      },
    });

    // Write metadata to Firestore
    const entryId = doc(collection(db, '_')).id;
    const entryRef = doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.IA_STRIP_DATASET, entryId);

    const entry: Omit<DatasetEntry, 'uploadedAt'> & { uploadedAt: Timestamp } = {
      labId,
      imageStoragePath: snapshot.metadata.fullPath,
      parsedResultId,
      modelVersion,
      uploadedAt: Timestamp.now(),
      uploadedBy: userId,
      consentGiven,
    };

    await setDoc(entryRef, entry);

    return {
      entryId,
      storagePath: snapshot.metadata.fullPath,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Consent required')) {
      throw err;
    }
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
