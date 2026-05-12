/**
 * generateRiskMatrixPDF — Mapa de riscos (FMEA-lite) em PDF para o laboratório.
 *
 * Membro ativo com claim `modules.risks`. Upload em Storage; URL assinada (2h).
 * Reutiliza o padrão pdfkit de `generateFornecedoresReport` (buffer + getSignedUrl).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { logger } from 'firebase-functions';
import {
  assertRisksAccess,
  risksCollection,
} from '../../modules/risks/validators';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

const db = admin.firestore();

const inputSchema = z.object({
  labId: z.string().min(1),
});

type RiskRow = {
  codigo: string;
  descricao: string;
  categoria: string;
  p: number;
  s: number;
  d: number;
  npr: number;
  nivel: string;
  status: string;
  responsavel: string;
};

/** P/S/D na grade 1–5 para o mapa textual; valores fora do intervalo viram 1. */
function clampPad1to5(v: unknown): number {
  const n = num(v, 1);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function str(v: unknown, fallback = '—'): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return fallback;
}

function extractResponsavel(data: Record<string, unknown>): string {
  const trat = data['tratamento'] as Record<string, unknown> | undefined;
  const acoes = trat?.['acoes'];
  if (!Array.isArray(acoes) || acoes.length === 0) return '—';
  const first = acoes[0] as Record<string, unknown>;
  const owner = first?.['owner'];
  return str(owner, '—');
}

function labDisplayName(labData: Record<string, unknown> | undefined): string {
  if (!labData) return 'Laboratório';
  const candidates = ['nomeFantasia', 'nome', 'razaoSocial', 'displayName'];
  for (const k of candidates) {
    const v = labData[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return 'Laboratório';
}

function buildHeatmapCounts(rows: RiskRow[]): number[][] {
  const grid: number[][] = [];
  for (let i = 0; i < 5; i++) {
    grid.push([0, 0, 0, 0, 0]);
  }
  for (const r of rows) {
    const pi = r.p - 1;
    const si = r.s - 1;
    if (pi >= 0 && pi < 5 && si >= 0 && si < 5) {
      grid[pi][si] += 1;
    }
  }
  return grid;
}

async function buildPdfBuffer(labName: string, rows: RiskRow[]): Promise<Buffer> {
  const grid = buildHeatmapCounts(rows);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    doc.fontSize(14).font('Helvetica-Bold').text('Mapa de riscos (matriz FMEA-lite)', {
      align: 'center',
    });
    doc.moveDown(0.35);
    doc.fontSize(11).font('Helvetica-Bold').text(labName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#444444');
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica-Bold').text('Mapa textual P×S (contagem por célula)');
    doc.moveDown(0.25);
    doc.font('Courier').fontSize(8);
    doc.text('       S=1   S=2   S=3   S=4   S=5');
    for (let p = 5; p >= 1; p--) {
      const row = grid[p - 1];
      const cells = row.map((c) => String(c).padStart(4, ' ')).join(' ');
      doc.text(`P=${p} |${cells}`);
    }
    doc.font('Helvetica');
    doc.moveDown(0.75);

    doc.fontSize(10).font('Helvetica-Bold').text('Riscos ativos (ordenados por NPR decrescente)');
    doc.moveDown(0.35);
    doc.fontSize(7).font('Helvetica');

    const header =
      'Código | Descrição | Cat | P | S | D | NPR | Nível | Status | Responsável';
    doc.font('Helvetica-Bold').text(header);
    doc.moveDown(0.2);
    doc.font('Helvetica');

    if (rows.length === 0) {
      doc.text('Nenhum risco ativo encontrado.');
    } else {
      for (const r of rows) {
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
        }
        const desc =
          r.descricao.length > 48 ? `${r.descricao.slice(0, 45)}...` : r.descricao;
        const line = [
          r.codigo,
          desc,
          r.categoria,
          String(r.p),
          String(r.s),
          String(r.d),
          String(r.npr),
          r.nivel,
          r.status,
          r.responsavel,
        ].join(' | ');
        doc.text(line, { width: 520 });
        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}

export const generateRiskMatrixPDF = onCall<unknown, Promise<{ url: string }>>(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request): Promise<{ url: string }> => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId } = parsed.data;

    await assertRisksAccess(auth, labId);

    const [labSnap, risksSnap] = await Promise.all([
      db.doc(`labs/${labId}`).get(),
      risksCollection(db, labId).where('deletadoEm', '==', null).limit(500).get(),
    ]);

    const labName = labDisplayName(labSnap.data() as Record<string, unknown> | undefined);

    const rows: RiskRow[] = [];
    for (const d of risksSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      rows.push({
        codigo: str(data['codigo'], d.id),
        descricao: str(data['descricao'], '—'),
        categoria: str(data['categoria'], '—'),
        p: clampPad1to5(data['probabilidade']),
        s: clampPad1to5(data['severidade']),
        d: clampPad1to5(data['deteccao']),
        npr: num(data['npr'], 0),
        nivel: str(data['nivel'], '—'),
        status: str(data['status'], '—'),
        responsavel: extractResponsavel(data),
      });
    }

    rows.sort((a, b) => b.npr - a.npr);

    const pdfBuffer = await buildPdfBuffer(labName, rows);
    const bucket = admin.storage().bucket();
    const objectPath = `labs/${labId}/reports/risk-matrix-${Date.now()}.pdf`;
    const file = bucket.file(objectPath);

    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      public: false,
      metadata: {
        metadata: {
          labId,
          kind: 'risk-matrix-pdf',
        },
      },
    });

    const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
    const [url] = await file.getSignedUrl({ action: 'read', expires: expiresAt });

    logger.info('generateRiskMatrixPDF ok', { labId, count: rows.length });

    return { url };
  },
);
