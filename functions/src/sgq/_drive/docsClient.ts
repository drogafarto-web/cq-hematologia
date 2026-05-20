/**
 * functions/src/sgq/_drive/docsClient.ts
 *
 * Google Docs/Drive API client for server-side document operations.
 * Uses OAuth2 access token from the authenticated user (via oauthClient.ts).
 *
 * The user's Drive storage is used (not a Service Account), solving the
 * quota-zero problem for personal Google accounts.
 */

import { google, docs_v1, drive_v3 } from 'googleapis';
import { createOAuth2Client } from './oauthClient';

export interface HeaderContent {
  labName: string;
  tipo: string;
  codigo: string;
  titulo: string;
  versao: number;
  status: string;
  dataEmissao: string;
  mote?: string;
}

function getAuthFromToken(accessToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  return client;
}

export function getDocsService(accessToken: string): docs_v1.Docs {
  return google.docs({ version: 'v1', auth: getAuthFromToken(accessToken) });
}

export function getDriveService(accessToken: string): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: getAuthFromToken(accessToken) });
}

export async function createDocument(
  accessToken: string,
  title: string,
  folderId: string,
): Promise<{ docId: string; docUrl: string }> {
  const drive = getDriveService(accessToken);

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    },
    fields: 'id,webViewLink',
  });

  const docId = res.data.id;
  const docUrl = res.data.webViewLink;

  if (!docId || !docUrl) {
    throw new Error('Failed to create Google Doc: missing id or webViewLink');
  }

  return { docId, docUrl };
}

/**
 * Upload a .docx/.xlsx buffer to Google Drive, converting to Google Docs/Sheets.
 * This preserves the original document content (text, formatting, tables, etc).
 */
export async function createDocumentFromSource(
  accessToken: string,
  title: string,
  folderId: string,
  sourceBuffer: Buffer,
  sourceMimeType: string,
): Promise<{ docId: string; docUrl: string }> {
  const drive = getDriveService(accessToken);

  const targetMimeType =
    sourceMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    sourceMimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12'
      ? 'application/vnd.google-apps.spreadsheet'
      : 'application/vnd.google-apps.document';

  const { Readable } = await import('stream');
  const readable = Readable.from(sourceBuffer);

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: targetMimeType,
      parents: [folderId],
    },
    media: {
      mimeType: sourceMimeType,
      body: readable,
    },
    fields: 'id,webViewLink',
  });

  const docId = res.data.id;
  const docUrl = res.data.webViewLink;

  if (!docId || !docUrl) {
    throw new Error('Failed to create Google Doc from source: missing id or webViewLink');
  }

  return { docId, docUrl };
}

export async function insertHeader(
  accessToken: string,
  docId: string,
  header: HeaderContent,
): Promise<void> {
  const docs = getDocsService(accessToken);

  const lines: string[] = [];
  lines.push(header.labName);
  lines.push(`${header.tipo} \u2014 ${header.codigo}`);
  lines.push(header.titulo);
  lines.push(
    `Vers\u00e3o: ${header.versao}  |  Status: ${header.status}  |  Emiss\u00e3o: ${header.dataEmissao}`,
  );

  if (header.mote) {
    lines.push(header.mote);
  }

  if (header.status === 'EM REVIS\u00c3O' || header.status === 'EM_REVISAO') {
    lines.push(
      '\u26a0 Este documento est\u00e1 em revis\u00e3o. A vers\u00e3o oficial \u00e9 controlada pelo HC Quality.',
    );
  }

  const fullText = lines.join('\n') + '\n';

  const requests: docs_v1.Schema$Request[] = [];

  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  });

  const labNameEnd = 1 + header.labName.length;
  requests.push({
    updateTextStyle: {
      range: { startIndex: 1, endIndex: labNameEnd },
      textStyle: { bold: true, fontSize: { magnitude: 14, unit: 'PT' } },
      fields: 'bold,fontSize',
    },
  });

  const line2Start = labNameEnd + 1;
  const line2Text = `${header.tipo} \u2014 ${header.codigo}`;
  const line2End = line2Start + line2Text.length;
  requests.push({
    updateTextStyle: {
      range: { startIndex: line2Start, endIndex: line2End },
      textStyle: { bold: true, fontSize: { magnitude: 12, unit: 'PT' } },
      fields: 'bold,fontSize',
    },
  });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });
}

export async function updateHeaderStatus(
  accessToken: string,
  docId: string,
  newStatus: string,
  dataEmissao: string,
): Promise<void> {
  const docs = getDocsService(accessToken);

  // Replace the status text directly (e.g., "Status: EM REVISÃO" → "Status: VIGENTE")
  // We need to try both possible current status values
  const requests: docs_v1.Schema$Request[] = [
    {
      replaceAllText: {
        containsText: { text: 'Status: EM REVISÃO', matchCase: true },
        replaceText: `Status: ${newStatus}`,
      },
    },
    {
      replaceAllText: {
        containsText: { text: 'Status: EM_REVISAO', matchCase: true },
        replaceText: `Status: ${newStatus}`,
      },
    },
    {
      replaceAllText: {
        containsText: { text: '{{DATA_EMISSAO}}', matchCase: true },
        replaceText: dataEmissao,
      },
    },
  ];

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });
}

export async function exportAsPdf(accessToken: string, docId: string): Promise<Buffer> {
  const drive = getDriveService(accessToken);

  const res = await drive.files.export(
    { fileId: docId, mimeType: 'application/pdf' },
    { responseType: 'arraybuffer' },
  );

  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Extracts plain text content from a Google Doc for diff comparison.
 * Returns concatenated text from all structural elements.
 */
export async function getDocContent(accessToken: string, docId: string): Promise<string> {
  const docs = getDocsService(accessToken);
  const res = await docs.documents.get({ documentId: docId });
  const body = res.data.body;
  if (!body?.content) return '';

  const parts: string[] = [];
  for (const element of body.content) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) {
          parts.push(el.textRun.content);
        }
      }
    }
    if (element.table) {
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          for (const cellContent of cell.content ?? []) {
            if (cellContent.paragraph?.elements) {
              for (const el of cellContent.paragraph.elements) {
                if (el.textRun?.content) {
                  parts.push(el.textRun.content);
                }
              }
            }
          }
        }
      }
    }
  }

  return parts.join('');
}

export async function shareWithUsers(
  accessToken: string,
  docId: string,
  emails: string[],
  role: 'writer' | 'reader',
): Promise<void> {
  const drive = getDriveService(accessToken);

  await Promise.all(
    emails.map((email) =>
      drive.permissions.create({
        fileId: docId,
        sendNotificationEmail: false,
        requestBody: { type: 'user', role, emailAddress: email },
      }),
    ),
  );
}

export async function revokeEditAccess(
  accessToken: string,
  docId: string,
  emails: string[],
): Promise<void> {
  const drive = getDriveService(accessToken);

  const permList = await drive.permissions.list({
    fileId: docId,
    fields: 'permissions(id,emailAddress,role)',
  });

  const permissions = permList.data.permissions ?? [];
  const emailSet = new Set(emails.map((e) => e.toLowerCase()));

  const writerPerms = permissions.filter(
    (p) =>
      p.role === 'writer' &&
      p.emailAddress &&
      emailSet.has(p.emailAddress.toLowerCase()),
  );

  await Promise.all(
    writerPerms.map((p) =>
      drive.permissions.update({
        fileId: docId,
        permissionId: p.id!,
        requestBody: { role: 'reader' },
      }),
    ),
  );
}
