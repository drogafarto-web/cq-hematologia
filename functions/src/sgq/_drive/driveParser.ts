/**
 * functions/src/sgq/_drive/driveParser.ts
 *
 * Drive API file operations:
 * - List files by LM-01 código
 * - Download and parse document content
 * - Extract metadata (mimeType, size, lastModified)
 */

import { drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface DriveFileMetadata {
  driveFileId: string;
  name: string;
  mimeType: string;
  size: number;
  lastModified: Date;
  webViewLink?: string;
}

/**
 * List Drive files matching LM-01 código
 * Uses heuristic: search for filename containing código
 */
export async function listFilesForCodigo(
  drive: drive_v3.Drive,
  codigo: string,
): Promise<DriveFileMetadata[]> {
  const query = `name contains '${codigo}' and trashed = false`;

  const response = await drive.files.list({
    q: query,
    spaces: 'drive',
    pageSize: 10,
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
  });

  const files = response.data.files || [];

  // Prioritize by mimeType: Google Docs > DOCX > PDF
  const priorityOrder: Record<string, number> = {
    'application/vnd.google-apps.document': 0,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 1,
    'application/pdf': 2,
    'text/plain': 3,
  };

  files.sort((a, b) => {
    const aPriority = priorityOrder[a.mimeType || ''] ?? 99;
    const bPriority = priorityOrder[b.mimeType || ''] ?? 99;
    return aPriority - bPriority;
  });

  return files.map((file) => ({
    driveFileId: file.id!,
    name: file.name || 'Untitled',
    mimeType: file.mimeType || 'application/octet-stream',
    size: file.size ? Number(file.size) : 0,
    lastModified: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
    webViewLink: file.webViewLink,
  }));
}

/**
 * Download and export document content
 * - Google Docs → export as Markdown
 * - DOCX → export as PDF
 * - PDF → return metadata only
 */
export async function downloadDocumentContent(
  drive: drive_v3.Drive,
  fileId: string,
  mimeType: string,
  maxSizeMB = 10,
): Promise<{ content: string; type: 'markdown' | 'pdf' | 'html'; sizeKB: number }> {
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      // Export Google Doc as Markdown
      const response = await drive.files.export(
        {
          fileId,
          mimeType: 'text/markdown',
        },
        {
          responseType: 'arraybuffer',
        },
      );

      const buffer = response.data as Buffer;
      const sizeKB = buffer.length / 1024;

      if (sizeKB > maxSizeMB * 1024) {
        throw new Error(`File too large: ${sizeKB.toFixed(1)}KB > ${maxSizeMB}MB`);
      }

      const markdown = new TextDecoder().decode(buffer);
      return { content: markdown, type: 'markdown', sizeKB };
    } else if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // Export DOCX as PDF (simpler preview than Word-specific parsing)
      const response = await drive.files.export(
        {
          fileId,
          mimeType: 'application/pdf',
        },
        {
          responseType: 'arraybuffer',
        },
      );

      const buffer = response.data as Buffer;
      const sizeKB = buffer.length / 1024;

      if (sizeKB > maxSizeMB * 1024) {
        throw new Error(`File too large: ${sizeKB.toFixed(1)}KB > ${maxSizeMB}MB`);
      }

      // Return base64 for embedding in HTML
      const base64 = Buffer.from(buffer).toString('base64');
      return {
        content: `data:application/pdf;base64,${base64}`,
        type: 'pdf',
        sizeKB,
      };
    } else if (mimeType === 'application/pdf') {
      // PDF: return metadata only (too large for download in preview)
      const metadata = await drive.files.get({
        fileId,
        fields: 'size',
      });

      const sizeKB = metadata.data.size ? Number(metadata.data.size) / 1024 : 0;
      return {
        content: `[PDF file - ${sizeKB.toFixed(1)}KB]`,
        type: 'pdf',
        sizeKB,
      };
    } else {
      throw new Error(`Unsupported mimeType: ${mimeType}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to download document: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Sanitize HTML to prevent XSS
 * Basic implementation — in production use DOMPurify or similar
 */
export function sanitizeHTML(html: string): string {
  // Remove dangerous tags/attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
}
