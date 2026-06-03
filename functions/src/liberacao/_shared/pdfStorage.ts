/**
 * Cloud Storage helpers for laudo PDFs.
 *
 * Storage layout: gs://{bucket}/laudos/{labId}/{laudoId}/v{version}.pdf
 * - Reads via signed URL (1 hour default expiration)
 * - Writes only via Admin SDK (server-side); client never writes
 * - Soft-delete only (matches RN-06)
 */
import * as admin from 'firebase-admin';

export interface UploadResult {
  /** gs:// URI of the uploaded object. */
  gsUrl: string;
  /** Public-style HTTPS path (without signature) for reference. */
  storagePath: string;
  /** Signed URL valid for `expiresInSec`. */
  signedUrl: string;
  /** Bytes of the PDF (used for size enforcement). */
  sizeBytes: number;
}

const DEFAULT_BUCKET = 'hmatologia2.appspot.com';
const DEFAULT_EXPIRES_SEC = 60 * 60; // 1 hour

function getBucket() {
  // bucket() with no args uses default bucket; pass explicit name for safety.
  return admin.storage().bucket(DEFAULT_BUCKET);
}

export function laudoStoragePath(labId: string, laudoId: string, version: number): string {
  return `laudos/${labId}/${laudoId}/v${version}.pdf`;
}

export async function uploadLaudoPDF(params: {
  labId: string;
  laudoId: string;
  version: number;
  buffer: Buffer;
  pdfHash: string;
  expiresInSec?: number;
}): Promise<UploadResult> {
  const path = laudoStoragePath(params.labId, params.laudoId, params.version);
  const bucket = getBucket();
  const file = bucket.file(path);

  await file.save(params.buffer, {
    contentType: 'application/pdf',
    resumable: false,
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        labId: params.labId,
        laudoId: params.laudoId,
        version: String(params.version),
        pdfHash: params.pdfHash,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  const signedUrl = await getSignedUrl(path, params.expiresInSec ?? DEFAULT_EXPIRES_SEC);

  return {
    gsUrl: `gs://${bucket.name}/${path}`,
    storagePath: path,
    signedUrl,
    sizeBytes: params.buffer.length,
  };
}

export async function getSignedUrl(
  storagePath: string,
  expiresInSec: number = DEFAULT_EXPIRES_SEC,
): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInSec * 1000,
  });
  return url;
}

export async function deleteLaudoPDF(storagePath: string): Promise<void> {
  const bucket = getBucket();
  const file = bucket.file(storagePath);
  await file.delete({ ignoreNotFound: true });
}
