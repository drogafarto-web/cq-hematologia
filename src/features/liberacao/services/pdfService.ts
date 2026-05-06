/**
 * pdfService — client wrapper around generateLaudoPDF callable.
 *
 * Provides a typed surface for components that need to:
 *  - Generate or refresh a laudo PDF (calls Cloud Function)
 *  - Download the PDF via signed URL
 *  - Open the PDF in a new tab
 *
 * Returns the signed URL (1h expiration); caller is responsible for
 * triggering the download / preview UI.
 */
import { httpsCallable, functions } from '../../../shared/services/firebase';
import type { HttpsCallableResult } from 'firebase/functions';

export interface GenerateLaudoPDFInput {
  labId: string;
  laudoId: string;
  /** Specific version to render (defaults to currentVersion server-side). */
  version?: number;
  /** Optional override for validation base URL (staging/dev). */
  validationBaseUrl?: string;
  /** Custom signed URL expiration (seconds). Default 3600. */
  signedUrlExpiresInSec?: number;
}

export interface GenerateLaudoPDFResult {
  ok: true;
  laudoId: string;
  version: number;
  signedUrl: string;
  storagePath: string;
  pdfHash: string;
  sizeBytes: number;
  validationUrl: string;
}

export async function generateLaudoPDF(
  input: GenerateLaudoPDFInput,
): Promise<GenerateLaudoPDFResult> {
  const callable = httpsCallable<GenerateLaudoPDFInput, GenerateLaudoPDFResult>(
    functions,
    'generateLaudoPDF',
  );
  const result: HttpsCallableResult<GenerateLaudoPDFResult> = await callable(input);
  return result.data;
}

/**
 * Fetch a signed URL and trigger a browser download via temporary <a>.
 * Filename: laudo-{laudoId}-v{version}.pdf
 */
export async function downloadLaudoPDF(input: GenerateLaudoPDFInput): Promise<void> {
  const result = await generateLaudoPDF(input);
  const filename = `laudo-${result.laudoId}-v${result.version}.pdf`;
  triggerDownload(result.signedUrl, filename);
}

/**
 * Build a download trigger via anchor element. The browser handles the actual
 * fetch + save flow; CORS is handled by the signed URL's headers.
 */
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  // target=_blank fallback if the browser ignores `download` for cross-origin URLs
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
