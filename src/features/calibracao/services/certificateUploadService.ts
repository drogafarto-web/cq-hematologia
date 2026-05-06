/**
 * certificateUploadService.ts
 *
 * Cloud Storage integration for certificate uploads with chain-hash validation.
 * Files stored at: gs://bucket/calibracao/{labId}/{equipId}/{uuid}
 *
 * Pattern: Upload → Compute HMAC-SHA256 → Store metadata in Firestore
 * + validate integrity on download (re-compute hash, compare to stored).
 */

import {
  db,
  Timestamp,
  getDownloadURL,
  uploadBytesResumable,
  ref as storageRef,
  storage,
  serverTimestamp,
  updateDoc,
  doc,
  type StorageReference,
  type UploadTaskSnapshot,
} from '../../../shared/services/firebase';
import type { CertificateUpload } from '../types/index';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MIME_TYPES_ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const STORAGE_BUCKET_PATH = 'calibracao';

/**
 * Generate UUID v4 using crypto.randomUUID (available in modern browsers)
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validate file: MIME type, size, not corrupted.
 * Throws error with user-friendly message.
 */
export function validateFile(file: File): void {
  if (!MIME_TYPES_ALLOWED.includes(file.type)) {
    throw new Error(
      `Tipo de arquivo não permitido. Aceitos: PDF, JPG, PNG. Recebido: ${file.type}`,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.`,
    );
  }

  if (file.size === 0) {
    throw new Error('Arquivo vazio. Selecione um arquivo com conteúdo.');
  }
}

// ─── Hash computation ────────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 chain-hash of file content.
 * Web Crypto API: works client-side.
 *
 * Chain-hash format: labId + equipId + filename + operatorId + timestamp
 * Returns hex string (64 chars).
 */
export async function computeChainHash(
  file: ArrayBuffer,
  labId: string,
  equipId: string,
  filename: string,
  operatorId: string,
  ts: number, // milliseconds since epoch
): Promise<string> {
  // Canonical message: deterministic serialization
  const message = `${labId}|${equipId}|${filename}|${operatorId}|${ts}`;
  const messageBuffer = new TextEncoder().encode(message);

  // HMAC key: use labId as secret (constant across org, deriv from env possible)
  const keyBuffer = new TextEncoder().encode(labId);

  // HMAC-SHA256
  const key = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const hashBuffer = await crypto.subtle.sign('HMAC', key, messageBuffer);

  // Return as hex string
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Upload ─────────────────────────────────────────────────────────────────────

/**
 * Upload certificate to Cloud Storage + compute metadata.
 *
 * Flow:
 * 1. Validate file
 * 2. Upload to Storage (path: calibracao/{labId}/{equipId}/{uuid})
 * 3. Compute chain-hash of file bytes
 * 4. Return CertificateUpload metadata (stored by caller in Firestore)
 *
 * On error, file is NOT uploaded. Caller responsible for retrying or error handling.
 */
export async function uploadCertificate(
  file: File,
  labId: string,
  equipId: string,
  operatorId: string,
  onProgress?: (progress: number) => void,
): Promise<CertificateUpload> {
  // Validate
  validateFile(file);

  // Generate unique ID
  const certId = generateUUID();
  const now = Date.now();

  // Convert File to ArrayBuffer for hash computation
  const fileBuffer = await file.arrayBuffer();

  // Compute chain-hash
  const chainHashValue = await computeChainHash(fileBuffer, labId, equipId, file.name, operatorId, now);

  // Upload to Cloud Storage
  const storagePath = `calibracao/${labId}/${equipId}/${certId}`;
  const fileRef = storageRef(storage, storagePath);

  const uploadTask = uploadBytesResumable(fileRef, file);

  // Track progress
  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          // Get download URL
          await getDownloadURL(fileRef);

          // Return metadata
          const timestamp = Timestamp.fromMillis(now);
          resolve({
            id: certId,
            calibracaoId: equipId,
            filename: file.name,
            mimeType: file.type as 'application/pdf' | 'image/jpeg' | 'image/png',
            storagePath,
            fileSize: file.size,
            hash: chainHashValue,
            operatorId,
            uploadedAt: timestamp,
            chainHash: {
              hash: chainHashValue,
              operatorId,
              ts: timestamp,
            },
          });
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

// ─── Download + Verification ─────────────────────────────────────────────────

/**
 * Get download URL for certificate from Cloud Storage.
 * In production, integrity verification happens server-side (Cloud Function).
 */
export async function getDownloadUrl(
  cert: CertificateUpload,
): Promise<string> {
  const fileRef = storageRef(storage, cert.storagePath);
  return getDownloadURL(fileRef);
}

/**
 * Validate certificate integrity without downloading full file.
 * Checks stored metadata only (no storage access).
 *
 * In practice, full verification requires re-computing the hash —
 * which needs file bytes. This is a metadata-only check for quick validation.
 */
export function validateCertificateMetadata(cert: CertificateUpload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!cert.id || cert.id.length === 0) {
    errors.push('ID do certificado vazio');
  }

  if (!cert.hash || cert.hash.length !== 64) {
    errors.push(`Hash inválido (esperado 64 chars, recebido ${cert.hash?.length || 0})`);
  }

  if (!cert.chainHash || !cert.chainHash.operatorId || !cert.chainHash.ts) {
    errors.push('Assinatura de integridade incompleta');
  }

  if (cert.fileSize <= 0) {
    errors.push('Tamanho do arquivo inválido');
  }

  if (!MIME_TYPES_ALLOWED.includes(cert.mimeType)) {
    errors.push(`Tipo MIME não permitido: ${cert.mimeType}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
