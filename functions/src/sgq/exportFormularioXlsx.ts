/**
 * exportFormularioXlsx.ts
 *
 * Cloud Function callable that generates an XLSX file with smart page setup:
 * - Auto-detects if content fits A4 portrait or needs landscape
 * - Applies fitToWidth=1 so all columns always print on the same page
 * - Adds header row with lab name, document code, version, export date
 *
 * Used for FR-* (Formulários/Registros) that labs print as worksheets.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import { logger } from 'firebase-functions/v2';

const db = admin.firestore();

const LARGURA_LIMITE_RETRATO = 120;

interface ExportFormularioInput {
  labId: string;
  documentoId: string;
  colunas: string[];
  dados: Record<string, unknown>[];
  titulo?: string;
}

interface ExportFormularioOutput {
  xlsxUrl: string;
  orientation: 'portrait' | 'landscape';
}

function calcColWidths(colunas: string[], dados: Record<string, unknown>[]): number[] {
  return colunas.map((col) => {
    const headerLen = col.length;
    const maxDataLen = dados.reduce((max, row) => {
      const val = String(row[col] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return Math.max(headerLen, maxDataLen) + 2;
  });
}

export const exportFormularioXlsx = onCall<ExportFormularioInput>(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request): Promise<ExportFormularioOutput> => {
    const { labId, documentoId, colunas, dados, titulo } = request.data;

    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    if (!labId || !documentoId || !colunas?.length) {
      throw new HttpsError('invalid-argument', 'labId, documentoId e colunas são obrigatórios');
    }

    const docRef = db.doc(`/labs/${labId}/sgq-documentos/${documentoId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Documento não encontrado');
    }
    const docData = docSnap.data()!;

    const labSnap = await db.doc(`/labs/${labId}`).get();
    const labName = labSnap.data()?.nome ?? labId;

    const codigo = docData.codigo ?? 'FR-000';
    const versao = docData.versao ?? '1.0';
    const docTitulo = titulo ?? docData.titulo ?? codigo;

    const colWidths = calcColWidths(colunas, dados);
    const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
    const orientation: 'portrait' | 'landscape' = totalWidth > LARGURA_LIMITE_RETRATO ? 'landscape' : 'portrait';

    const headerRows = [
      [labName.toUpperCase()],
      [`${codigo} — ${docTitulo} (v${versao})`],
      [`Exportado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet(headerRows);

    const dataRows = dados.map((row) => colunas.map((col) => row[col] ?? ''));
    XLSX.utils.sheet_add_aoa(ws, [colunas, ...dataRows], { origin: 'A5' });

    ws['!cols'] = colWidths.map((wch) => ({ wch }));

    ws['!pageSetup'] = {
      paperSize: 9,
      orientation,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, docTitulo.substring(0, 31));

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const storagePath = `labs/${labId}/sgq/exports/${codigo}_v${versao}.xlsx`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        metadata: {
          documentoId,
          codigo,
          versao: String(versao),
          orientation,
          exportedBy: request.auth.uid,
          exportedAt: new Date().toISOString(),
        },
      },
    });

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    logger.info('XLSX exported', { documentoId, codigo, versao, orientation, storagePath });

    return { xlsxUrl: signedUrl, orientation };
  },
);
