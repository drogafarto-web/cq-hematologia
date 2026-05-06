/**
 * functions/src/sgq/previewDocDrive.ts
 *
 * Cloud Function callable: Download and preview a single Drive document
 *
 * Input:
 *   - labId: lab identifier
 *   - driveFileId: Drive file ID
 *   - mimeType: file MIME type
 *
 * Output:
 *   - content: preview content (markdown, PDF embed, or placeholder)
 *   - type: 'markdown' | 'pdf' | 'html'
 *   - sizeKB: file size in KB
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { getAccessToken } from './_drive/oauthClient';
import { downloadDocumentContent } from './_drive/driveParser';

export interface PreviewDocDriveInput {
  labId: string;
  driveFileId: string;
  mimeType: string;
}

export interface PreviewDocDriveOutput {
  content: string;
  type: 'markdown' | 'pdf' | 'html';
  sizeKB: number;
}

export const previewDocDrive = functions.https.onCall(
  async (input: PreviewDocDriveInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    const { labId, driveFileId, mimeType } = input;
    const userId = context.auth.uid;

    try {
      // Get stored access token
      const accessToken = await getAccessToken(labId, userId);

      // Get Drive API client
      const drive = google.drive({ version: 'v3', auth: new google.auth.GoogleAuth({
        credentials: { access_token: accessToken },
      }) });

      // Download and parse content
      const result = await downloadDocumentContent(drive, driveFileId, mimeType);

      // Log operation
      await admin
        .firestore()
        .collection('labs')
        .doc(labId)
        .collection('sgq-import-logs')
        .doc()
        .set({
          event: 'preview-doc-drive',
          userId,
          driveFileId,
          mimeType,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          sizeKB: result.sizeKB,
        });

      return result as PreviewDocDriveOutput;
    } catch (error) {
      console.error('[previewDocDrive] error:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to preview document',
      );
    }
  },
);
