/**
 * functions/src/sgq/listarDocsDrive.ts
 *
 * Cloud Function callable: List documents from Drive that match LM-01 entries
 *
 * Input:
 *   - labId: lab identifier
 *   - lm01SheetId: Google Sheets ID of LM-01 (lista mestra)
 *
 * Output:
 *   - matched: list of DriveFileMetadata with corresponding LM-01 entry
 *   - gaps: LM-01 entries without Drive file match
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { getAccessToken } from './_drive/oauthClient';
import { parseLM01Sheet } from './_drive/lm01Parser';
import { listFilesForCodigo } from './_drive/driveParser';

export interface ListarDocsDriveInput {
  labId: string;
  lm01SheetId: string;
}

export interface MatchedDoc {
  codigo: string;
  tipo: string;
  titulo: string;
  driveFileId: string;
  driveName: string;
  mimeType: string;
  lastModified: string;
  webViewLink?: string;
}

export interface ListarDocsDriveOutput {
  matched: MatchedDoc[];
  gaps: {
    codigo: string;
    titulo: string;
  }[];
  totalLM01: number;
  totalMatched: number;
}

export const listarDocsDrive = onCall<ListarDocsDriveInput, Promise<ListarDocsDriveOutput>>(
  async (request: CallableRequest<ListarDocsDriveInput>) => {
    // Auth: requires RT claim or authenticated user (will refine to RT later)
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { labId, lm01SheetId } = request.data;
    const userId = request.auth.uid;

    try {
      // Get stored access token
      const accessToken = await getAccessToken(labId, userId);

      // OAuth2 client with the user's access token
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      // Fetch LM-01 from Google Sheets
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const lm01Response = await sheets.spreadsheets.values.get({
        spreadsheetId: lm01SheetId,
        range: 'A:G', // columns: código, tipo, título, versão, setores, parent, observações
      });

      const lm01Values = lm01Response.data.values || [];
      const lm01Entries = await parseLM01Sheet(lm01Values);

      // Get Drive API client
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const matched: MatchedDoc[] = [];
      const gaps: { codigo: string; titulo: string }[] = [];

      // Match each LM-01 entry with Drive files
      for (const entry of lm01Entries) {
        const files = await listFilesForCodigo(drive, entry.codigo);

        if (files.length > 0) {
          const bestMatch = files[0]; // Already sorted by priority
          matched.push({
            codigo: entry.codigo,
            tipo: entry.tipo,
            titulo: entry.titulo,
            driveFileId: bestMatch.driveFileId,
            driveName: bestMatch.name,
            mimeType: bestMatch.mimeType,
            lastModified: bestMatch.lastModified.toISOString(),
            webViewLink: bestMatch.webViewLink,
          });
        } else {
          gaps.push({
            codigo: entry.codigo,
            titulo: entry.titulo,
          });
        }
      }

      // Log operation
      await admin
        .firestore()
        .collection('labs')
        .doc(labId)
        .collection('sgq-import-jobs')
        .doc()
        .set({
          event: 'listar-docs-drive',
          userId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          stats: {
            totalLM01: lm01Entries.length,
            totalMatched: matched.length,
            totalGaps: gaps.length,
          },
        });

      return {
        matched,
        gaps,
        totalLM01: lm01Entries.length,
        totalMatched: matched.length,
      } as ListarDocsDriveOutput;
    } catch (error) {
      console.error('[listarDocsDrive] error:', error);
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to list documents',
      );
    }
  },
);
