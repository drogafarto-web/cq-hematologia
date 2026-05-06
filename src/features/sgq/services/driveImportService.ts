/**
 * src/features/sgq/services/driveImportService.ts
 *
 * Client-side service for Drive importer wizard
 * - Manages OAuth flow
 * - Calls backend for document listing, preview, classification
 * - Batches imports
 */

import {
  httpsCallable,
  functions,
} from '../../../shared/services/firebase';

export interface ImportDocPreview {
  codigo: string;
  tipo: string;
  titulo: string;
  driveFileId: string;
  driveName: string;
  mimeType: string;
  preview?: any;
  classification?: any;
  setoresLD?: string[];
}

/**
 * Initiate OAuth flow for Drive authorization
 */
export function initiateOAuthFlow(labId: string): string {
  const authUrl = new URL(
    'https://accounts.google.com/o/oauth2/v2/auth',
  );
  authUrl.searchParams.append('client_id', import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', `${window.location.origin}/api/sgq/oauth-callback`);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/drive.readonly');
  authUrl.searchParams.append('state', generateStateToken());

  return authUrl.toString();
}

/**
 * Generate CSRF state token
 */
function generateStateToken(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Call backend to list Drive documents matching LM-01
 */
export async function listarDocsDrive(
  labId: string,
  lm01SheetId: string,
): Promise<any> {
  const callable = httpsCallable(functions, 'listarDocsDrive');
  const result = await callable({ labId, lm01SheetId });
  return result.data;
}

/**
 * Preview a single Drive document
 */
export async function previewDocDrive(
  labId: string,
  driveFileId: string,
  mimeType: string,
): Promise<any> {
  const callable = httpsCallable(functions, 'previewDocDrive');
  const result = await callable({ labId, driveFileId, mimeType });
  return result.data;
}

/**
 * Get automatic classification for a document
 */
export async function classificarDocAuto(
  labId: string,
  codigo: string,
  titulo: string,
  preview?: string,
  lm01SetoresLD?: string[],
): Promise<any> {
  const callable = httpsCallable(functions, 'classificarDocAuto');
  const result = await callable({
    labId,
    codigo,
    titulo,
    preview,
    lm01SetoresLD,
  });
  return result.data;
}

/**
 * Import batch of documents from Drive
 */
export async function aprovarBatchImport(
  labId: string,
  docs: Array<{
    codigo: string;
    tipo: string;
    titulo: string;
    driveFileId: string;
    urlDriveOriginal: string;
    versao?: number;
    setoresLD?: string[];
    autoridadeEmitente?: string;
  }>,
): Promise<any> {
  const callable = httpsCallable(functions, 'aprovarBatchImport');
  const result = await callable({ labId, docs });
  return result.data;
}
