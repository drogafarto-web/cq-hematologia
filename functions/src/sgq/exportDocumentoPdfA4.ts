/**
 * exportDocumentoPdfA4.ts
 *
 * Cloud Function callable that generates a PDF with:
 * 1. Cover page (carimbo virtual) with dynamic historico table (last 5 entries)
 * 2. Original document content exported as PDF (Docs or Sheets)
 *
 * The cover page is FIXED — content always starts on page 2.
 * Historico table shows last 5 revisions; older ones are compacted.
 * The original file is NEVER modified — metadata lives in Firestore only.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getAccessToken, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } from './_drive/oauthClient';
import { exportAsPdf, getDriveService } from './_drive/docsClient';
import { logger } from 'firebase-functions/v2';

const db = admin.firestore();

interface ExportPdfInput {
  labId: string;
  documentoId: string;
}

interface ExportPdfOutput {
  pdfUrl: string;
  pdfHash: string;
}

interface HistoricoEntry {
  versao: string;
  tipoAlteracao?: string;
  diffPercent?: number;
  data: FirebaseFirestore.Timestamp;
  elaboradoPor: string;
  aprovadoPor: string;
  alteracao: string;
}

async function exportSheetAsPdf(accessToken: string, fileId: string): Promise<Buffer> {
  const url =
    `https://docs.google.com/spreadsheets/d/${fileId}/export?` +
    `format=pdf&size=A4&portrait=true&fitw=true&gridlines=false&sheetnames=false&printtitle=false`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Sheets PDF export failed: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function getFileMimeType(accessToken: string, fileId: string): Promise<string> {
  const drive = getDriveService(accessToken);
  const res = await drive.files.get({ fileId, fields: 'mimeType' });
  return res.data.mimeType ?? '';
}

function formatTimestamp(ts: FirebaseFirestore.Timestamp | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

function formatVersao(v: string | number): string {
  if (typeof v === 'number') return `v${String(v).padStart(2, '0')}.0`;
  const parts = String(v).split('.');
  const major = parseInt(parts[0], 10) || 1;
  const minor = parseInt(parts[1], 10) || 0;
  return `v${String(major).padStart(2, '0')}.${minor}`;
}

async function buildCoverPage(
  doc: FirebaseFirestore.DocumentData,
  labName: string,
  historico: HistoricoEntry[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const dark = rgb(0.1, 0.1, 0.12);
  const gray = rgb(0.4, 0.4, 0.45);
  const black = rgb(0, 0, 0);
  const accent = rgb(0.4, 0.35, 0.7);

  // Lab name
  page.drawText(labName.toUpperCase(), {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: dark,
  });
  y -= 24;

  // Código + Tipo
  const tipoLine = `${doc.codigo} — ${doc.tipo}`;
  page.drawText(tipoLine, {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: dark,
  });
  y -= 18;

  // Título
  page.drawText(doc.titulo ?? '', {
    x: margin,
    y,
    size: 11,
    font,
    color: black,
  });
  y -= 28;

  // Versão + Status box
  const versaoStr = formatVersao(doc.versao ?? '1.0');
  const statusStr = (doc.status ?? 'em_revisao').toUpperCase().replace('_', ' ');
  page.drawText(`VERSÃO: ${versaoStr}`, {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: accent,
  });
  page.drawText(`STATUS: ${statusStr}`, {
    x: margin + 150,
    y,
    size: 10,
    font: fontBold,
    color: accent,
  });
  y -= 20;

  // Metadados em grid
  const metaLines = [
    `Emissão: ${formatTimestamp(doc.dataEmissao)}          Próx. revisão: ${formatTimestamp(doc.proximaRevisao)}`,
    `Elaborado por: ${doc.elaboradoPor ?? '—'}`,
    `Aprovado por: ${doc.autoridadeEmitente ?? '—'}`,
  ];

  for (const line of metaLines) {
    page.drawText(line, { x: margin, y, size: 9, font, color: gray });
    y -= 14;
  }

  y -= 12;

  // Linha separadora
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 18;

  // Histórico de revisões (últimas 5)
  if (historico.length > 0) {
    page.drawText('HISTÓRICO DE REVISÕES', {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: dark,
    });
    y -= 16;

    // Table header
    const colX = {
      versao: margin,
      tipo: margin + 50,
      data: margin + 100,
      alteracao: margin + 170,
      elaborado: margin + 360,
      aprovado: margin + 430,
    };

    page.drawText('Versão', { x: colX.versao, y, size: 7, font: fontBold, color: gray });
    page.drawText('Tipo', { x: colX.tipo, y, size: 7, font: fontBold, color: gray });
    page.drawText('Data', { x: colX.data, y, size: 7, font: fontBold, color: gray });
    page.drawText('Alteração', { x: colX.alteracao, y, size: 7, font: fontBold, color: gray });
    page.drawText('Elaborado', { x: colX.elaborado, y, size: 7, font: fontBold, color: gray });
    page.drawText('Aprovado', { x: colX.aprovado, y, size: 7, font: fontBold, color: gray });
    y -= 12;

    // Separator line under header
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: width - margin, y: y + 4 },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
    });

    const visibleEntries = historico.slice(-5);
    const hiddenCount = historico.length - visibleEntries.length;

    if (hiddenCount > 0) {
      page.drawText(`(...${hiddenCount} revisões anteriores)`, {
        x: margin,
        y,
        size: 7,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });
      y -= 11;
    }

    for (const entry of visibleEntries) {
      const tipoLabel = entry.tipoAlteracao === 'major' ? 'REV' : 'COR';

      page.drawText(formatVersao(entry.versao), { x: colX.versao, y, size: 7, font, color: black });
      page.drawText(tipoLabel, { x: colX.tipo, y, size: 7, font: fontBold, color: entry.tipoAlteracao === 'major' ? rgb(0.7, 0.5, 0.1) : rgb(0.2, 0.6, 0.3) });
      page.drawText(formatTimestamp(entry.data), { x: colX.data, y, size: 7, font, color: black });
      page.drawText((entry.alteracao ?? '').substring(0, 30), { x: colX.alteracao, y, size: 7, font, color: black });
      page.drawText((entry.elaboradoPor ?? '—').substring(0, 12), { x: colX.elaborado, y, size: 7, font, color: black });
      page.drawText((entry.aprovadoPor ?? '—').substring(0, 12), { x: colX.aprovado, y, size: 7, font, color: black });
      y -= 11;
    }
  }

  // Footer note
  y -= 20;
  page.drawText('Documento controlado pelo HC Quality — impressão não controlada.', {
    x: margin,
    y,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return pdfDoc.save();
}

export const exportDocumentoPdfA4 = onCall<ExportPdfInput>(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET],
  },
  async (request): Promise<ExportPdfOutput> => {
    const { labId, documentoId } = request.data;

    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userId = request.auth.uid;

    // Fetch document
    const docRef = db.doc(`/labs/${labId}/sgq-documentos/${documentoId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Documento não encontrado');
    }
    const docData = docSnap.data()!;

    // Lab name
    const labSnap = await db.doc(`/labs/${labId}`).get();
    const labName = labSnap.data()?.nome ?? labId;

    // Fetch historico-versoes
    const historicoSnap = await db
      .collection(`/labs/${labId}/sgq-documentos/${documentoId}/historico-versoes`)
      .orderBy('versao', 'asc')
      .get();

    const historico: HistoricoEntry[] = historicoSnap.docs.map((d) => d.data() as HistoricoEntry);

    // Build cover page
    const coverBytes = await buildCoverPage(docData, labName, historico);

    // Get content PDF
    const googleDocId = docData.googleDocId;
    if (!googleDocId) {
      throw new HttpsError(
        'failed-precondition',
        'Documento não possui Google Doc/Sheet vinculado',
      );
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(labId, userId);
    } catch {
      throw new HttpsError(
        'failed-precondition',
        'Autorização do Google Drive não encontrada. Re-autorize o acesso.',
      );
    }

    // Detect if Sheets or Docs
    let contentBuffer: Buffer;
    try {
      const mimeType = await getFileMimeType(accessToken, googleDocId);

      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        contentBuffer = await exportSheetAsPdf(accessToken, googleDocId);
      } else {
        contentBuffer = await exportAsPdf(accessToken, googleDocId);
      }
    } catch (err) {
      throw new HttpsError(
        'internal',
        `Falha ao exportar conteúdo como PDF: ${(err as Error).message}`,
      );
    }

    // Merge cover + content
    const finalPdf = await PDFDocument.create();

    const coverDoc = await PDFDocument.load(coverBytes);
    const [coverPage] = await finalPdf.copyPages(coverDoc, [0]);
    finalPdf.addPage(coverPage);

    const contentDoc = await PDFDocument.load(contentBuffer);
    const contentPages = await finalPdf.copyPages(contentDoc, contentDoc.getPageIndices());
    for (const p of contentPages) {
      finalPdf.addPage(p);
    }

    const mergedBytes = await finalPdf.save();

    // Upload to Storage
    const { createHash } = await import('crypto');
    const pdfHash = createHash('sha256').update(Buffer.from(mergedBytes)).digest('hex');
    const codigo = docData.codigo ?? 'DOC';
    const versao = docData.versao ?? '1.0';
    const storagePath = `labs/${labId}/sgq/exports/${codigo}_v${versao}_A4.pdf`;

    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(Buffer.from(mergedBytes), {
      contentType: 'application/pdf',
      metadata: {
        metadata: {
          documentoId,
          codigo,
          versao: String(versao),
          exportedBy: userId,
          exportedAt: new Date().toISOString(),
        },
      },
    });

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    logger.info('PDF A4 exported successfully', { documentoId, codigo, versao, storagePath });

    return { pdfUrl: signedUrl, pdfHash };
  },
);
