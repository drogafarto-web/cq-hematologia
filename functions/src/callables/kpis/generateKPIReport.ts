/**
 * generateKPIReport — PDF consolidado: KPIs diários no período, metas ativas e planos em aberto.
 *
 * Membro ativo do laboratório ou SuperAdmin. Upload em Storage; URL assinada (2h).
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
  mesInicio: z.unknown(),
  mesFim: z.unknown(),
});

function toFirestoreTimestamp(ts: unknown, fieldLabel: string): admin.firestore.Timestamp {
  if (ts instanceof admin.firestore.Timestamp) {
    return ts;
  }
  if (ts && typeof ts === 'object') {
    const o = ts as Record<string, unknown>;
    const sec = (o.seconds ?? o._seconds) as number | undefined;
    const nan = (o.nanoseconds ?? o._nanoseconds) as number | undefined;
    if (typeof sec === 'number' && typeof nan === 'number') {
      return new admin.firestore.Timestamp(sec, nan);
    }
  }
  throw new HttpsError('invalid-argument', `${fieldLabel} inválido.`);
}

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

function tsToDate(value: unknown): Date {
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

function safeStr(v: unknown, fallback = '—'): string {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fallback;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

interface KpiDailyRow {
  dataLabel: string;
  tat: string;
  retrab: string;
  doc: string;
  nc: string;
}

async function buildKpiPdfBuffer(params: {
  labId: string;
  periodLabel: string;
  rows: KpiDailyRow[];
  metaLines: string[];
  planoLines: string[];
  summaryLines: string[];
}): Promise<Buffer> {
  const { labId, periodLabel, rows, metaLines, planoLines, summaryLines } = params;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    doc.fontSize(14).font('Helvetica-Bold').text('Relatório de indicadores (KPI)', { align: 'center' });
    doc.moveDown(0.35);
    doc.fontSize(10).font('Helvetica').text(`Laboratório: ${labId}`, { align: 'center' });
    doc.moveDown(0.25);
    doc.text(`Período: ${periodLabel}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#444444');
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    const section = (title: string, lines: string[]) => {
      doc.fontSize(10).font('Helvetica-Bold').text(title);
      doc.moveDown(0.25);
      doc.fontSize(8).font('Helvetica');
      if (lines.length === 0) {
        doc.text('—');
      } else {
        for (const line of lines) {
          if (doc.y > doc.page.height - 72) {
            doc.addPage();
          }
          doc.text(line, { width: 520 });
          doc.moveDown(0.28);
        }
      }
      doc.moveDown(0.55);
    };

    section('Resumo do período', summaryLines);
    section('Metas ativas', metaLines);
    section('KPIs diários (amostra tabular)', rows.map((r) => `${r.dataLabel} · TAT ${r.tat} · Retr. ${r.retrab} · Doc. ${r.doc} · NC ${r.nc}`));
    section('Planos em aberto (rascunho / ativo)', planoLines);

    doc.end();
  });
}

export const generateKPIReport = onCall<
  unknown,
  Promise<{ url: string }>
>({ region: 'southamerica-east1', cors: true }, async (request): Promise<{ url: string }> => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const parsed = inputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }

  const { labId } = parsed.data;
  const mesInicioTs = toFirestoreTimestamp(parsed.data.mesInicio, 'mesInicio');
  const mesFimTs = toFirestoreTimestamp(parsed.data.mesFim, 'mesFim');

  if (mesInicioTs.toMillis() > mesFimTs.toMillis()) {
    throw new HttpsError('invalid-argument', 'mesInicio deve ser anterior ou igual a mesFim.');
  }

  const uid = request.auth.uid;
  const token = request.auth.token as Record<string, unknown> | undefined;
  await assertActiveLabMemberOrSuperAdmin(uid, labId, token);

  const labRef = db.collection('labs').doc(labId);
  const labSnap = await labRef.get();
  if (!labSnap.exists) {
    throw new HttpsError('not-found', 'Laboratório não encontrado.');
  }

  const metricsSnap = await labRef
    .collection('kpi-metrics')
    .where('data', '>=', mesInicioTs)
    .where('data', '<=', mesFimTs)
    .orderBy('data', 'asc')
    .limit(400)
    .get();

  const metasSnap = await labRef.collection('kpi-metas').where('ativo', '==', true).limit(80).get();

  const planosSnap = await labRef
    .collection('planos-melhoria')
    .where('status', 'in', ['ativo', 'rascunho'])
    .limit(120)
    .get();

  const metaLines: string[] = [];
  for (const d of metasSnap.docs) {
    const m = d.data();
    const tipo = safeStr(m['tipoKPI']);
    const valor = num(m['valor']);
    const unidade = safeStr(m['unidade']);
    if (valor === null) continue;
    metaLines.push(`${tipo}: ${valor.toFixed(1)} ${unidade}`);
  }
  if (metaLines.length === 0) {
    metaLines.push('Nenhuma meta ativa registrada.');
  }

  const rows: KpiDailyRow[] = [];
  let sumTat = 0;
  let sumRet = 0;
  let sumDoc = 0;
  let n = 0;
  let nTat = 0;
  let nRet = 0;
  let nDoc = 0;
  for (const d of metricsSnap.docs) {
    const k = d.data();
    const dataRaw = k['data'];
    const dataLabel = tsToDate(dataRaw).toLocaleDateString('pt-BR');
    const tat = num(k['turnaround_media_horas']);
    const retrab = num(k['retrabalho_percentual']);
    const docPct = num(k['documentacao_percentual']);
    const nc = num(k['nc_total_abertas']);
    rows.push({
      dataLabel,
      tat: tat !== null ? `${tat.toFixed(1)}h` : '—',
      retrab: retrab !== null ? `${retrab.toFixed(1)}%` : '—',
      doc: docPct !== null ? `${docPct.toFixed(1)}%` : '—',
      nc: nc !== null ? String(nc) : '—',
    });
    if (tat !== null) {
      sumTat += tat;
      nTat += 1;
    }
    if (retrab !== null) {
      sumRet += retrab;
      nRet += 1;
    }
    if (docPct !== null) {
      sumDoc += docPct;
      nDoc += 1;
    }
    n += 1;
  }
  if (rows.length === 0) {
    rows.push({
      dataLabel: '—',
      tat: '—',
      retrab: '—',
      doc: '—',
      nc: '—',
    });
  }

  const summaryLines: string[] = [];
  if (n > 0) {
    const tatAvg = nTat > 0 ? `${(sumTat / nTat).toFixed(1)}h` : '—';
    const retAvg = nRet > 0 ? `${(sumRet / nRet).toFixed(1)}%` : '—';
    const docAvg = nDoc > 0 ? `${(sumDoc / nDoc).toFixed(1)}%` : '—';
    summaryLines.push(
      `Médias no período (${n} dia(s) com métrica): turnaround ${tatAvg} · retrabalho ${retAvg} · documentação ${docAvg}`,
    );
  } else {
    summaryLines.push('Nenhum documento de KPI diário no intervalo informado.');
  }

  const planoLines: string[] = [];
  for (const d of planosSnap.docs) {
    const p = d.data();
    if (p['deletadoEm'] != null) continue;
    const titulo = safeStr(p['titulo']);
    const status = safeStr(p['status']);
    const resp = safeStr(p['responsavelNome']);
    const prazo = tsToDate(p['prazoMeta']).toLocaleDateString('pt-BR');
    planoLines.push(`${titulo} · ${status} · prazo ${prazo} · ${resp}`);
  }
  if (planoLines.length === 0) {
    planoLines.push('Nenhum plano em rascunho ou ativo.');
  }

  const periodLabel = `${mesInicioTs.toDate().toLocaleDateString('pt-BR')} — ${mesFimTs.toDate().toLocaleDateString('pt-BR')}`;

  const pdfBuffer = await buildKpiPdfBuffer({
    labId,
    periodLabel,
    rows,
    metaLines,
    planoLines,
    summaryLines,
  });

  const bucket = admin.storage().bucket();
  const objectPath = `labs/${labId}/reports/kpi-${Date.now()}.pdf`;
  const file = bucket.file(objectPath);

  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    public: false,
    metadata: {
      metadata: {
        labId,
        kind: 'kpi-report',
      },
    },
  });

  const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
  const [url] = await file.getSignedUrl({ action: 'read', expires: expiresAt });

  logger.info('generateKPIReport ok', { labId, rows: metricsSnap.size });

  return { url };
});
