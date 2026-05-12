/**
 * generateFornecedoresReport — PDF com fornecedores ativos + última avaliação periódica.
 *
 * Membro ativo do laboratório ou SuperAdmin. Upload em Storage; URL assinada (~1h).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { logger } from 'firebase-functions';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

const db = admin.firestore();

const inputSchema = z.object({
  labId: z.string().min(1),
});

type FornecedorRow = {
  nomeFantasia: string;
  cnpj: string;
  avalData: string;
  avalResultado: string;
  criterios: string;
};

async function assertActiveLabMemberOrSuperAdmin(
  uid: string,
  labId: string,
  token: Record<string, unknown> | undefined,
): Promise<void> {
  if (token?.isSuperAdmin === true) {
    return;
  }
  const userSnap = await db.doc(`users/${uid}`).get();
  if (userSnap.data()?.isSuperAdmin === true) {
    return;
  }

  const memberSnap = await db.doc(`labs/${labId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Acesso negado.');
  }
}

function avaliacaoDataToDate(value: unknown): Date {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const sec = (o.seconds ?? o._seconds) as number | undefined;
    const nan = (o.nanoseconds ?? o._nanoseconds) as number | undefined;
    if (typeof sec === 'number' && typeof nan === 'number') {
      return new admin.firestore.Timestamp(sec, nan).toDate();
    }
  }
  return new Date(0);
}

function formatCriterios(criterios: unknown): string {
  if (!criterios || typeof criterios !== 'object') {
    return '—';
  }
  const entries = Object.entries(criterios as Record<string, unknown>);
  if (entries.length === 0) return '—';
  return entries
    .map(([k, v]) => `${k}:${v === true ? 'S' : 'N'}`)
    .join(' ');
}

async function buildFornecedoresPdfBuffer(rows: FornecedorRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    doc.fontSize(14).font('Helvetica-Bold').text('Relatório de fornecedores', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#444444');
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Nome fantasia | CNPJ | Última avaliação | Resultado | Critérios (S/N)');
    doc.moveDown(0.25);
    doc.font('Helvetica');

    if (rows.length === 0) {
      doc.text('Nenhum fornecedor ativo encontrado.');
    } else {
      for (const r of rows) {
        if (doc.y > doc.page.height - 72) {
          doc.addPage();
        }
        doc.text(
          `${r.nomeFantasia} | ${r.cnpj} | ${r.avalData} | ${r.avalResultado} | ${r.criterios}`,
          { width: 520 },
        );
        doc.moveDown(0.35);
      }
    }

    doc.end();
  });
}

export const generateFornecedoresReport = onCall<unknown, Promise<{ url: string }>>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ url: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId } = parsed.data;
    const uid = request.auth.uid;
    const token = request.auth.token as Record<string, unknown> | undefined;

    await assertActiveLabMemberOrSuperAdmin(uid, labId, token);

    const fornSnap = await db
      .collection('labs')
      .doc(labId)
      .collection('fornecedores')
      .where('ativo', '==', true)
      .limit(500)
      .get();

    const rows: FornecedorRow[] = [];

    for (const doc of fornSnap.docs) {
      const d = doc.data();
      const nomeFantasia =
        typeof d['nomeFantasia'] === 'string' && d['nomeFantasia'].length > 0
          ? (d['nomeFantasia'] as string)
          : '—';
      const cnpj =
        typeof d['cnpj'] === 'string' && d['cnpj'].length > 0 ? (d['cnpj'] as string) : '—';

      const avalQ = await doc.ref
        .collection('avaliacoes-periodicas')
        .orderBy('data', 'desc')
        .limit(1)
        .get();

      let avalData = '—';
      let avalResultado = '—';
      let criterios = '—';

      if (!avalQ.empty) {
        const a = avalQ.docs[0].data();
        avalData = avaliacaoDataToDate(a['data']).toLocaleDateString('pt-BR');
        const res = a['resultado'];
        avalResultado = typeof res === 'string' && res.length > 0 ? res : '—';
        criterios = formatCriterios(a['criteriosAvaliados']);
      }

      rows.push({ nomeFantasia, cnpj, avalData, avalResultado, criterios });
    }

    rows.sort((x, y) => x.nomeFantasia.localeCompare(y.nomeFantasia, 'pt-BR'));

    const pdfBuffer = await buildFornecedoresPdfBuffer(rows);
    const bucket = admin.storage().bucket();
    const objectPath = `labs/${labId}/reports/fornecedores-${Date.now()}.pdf`;
    const file = bucket.file(objectPath);

    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      public: false,
      metadata: {
        metadata: {
          labId,
          kind: 'fornecedores-report',
        },
      },
    });

    const expiresAt = Date.now() + 60 * 60 * 1000;
    const [url] = await file.getSignedUrl({ action: 'read', expires: expiresAt });

    logger.info('generateFornecedoresReport ok', { labId, count: rows.length });

    return { url };
  },
);
