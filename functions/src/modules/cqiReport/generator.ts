// ─── CQI Daily Report Generator ───────────────────────────────────────────────
// Orchestrates data fetching → per-analyte stats → PDF → email for each active
// sector found in a lab on a given date.
//
// Adjustment 3 (gap resolution): ANALYTE_MAP lives only in the frontend
// (src/constants.ts). A local copy of the 17 analyte descriptors is kept here
// so Cloud Functions never import from src/.

import * as admin    from 'firebase-admin';
import PDFDocument   = require('pdfkit');

import { calculateMean, calculateSD, calculateCV } from './stats/calculator';
import {
  renderQuantitativeAnalyteSection,
  renderCategoricalRunsSection,
  type QuantitativeAnalyteData,
  type CategoricalRunData,
} from './pdf/analyteSection';
import { sendCQIEmail, type SectorId } from './email/cqiTemplate';

// ─── Local analyte map (mirrors src/constants.ts) ─────────────────────────────

const ANALYTE_INFO: Record<string, { name: string; unit: string }> = {
  'WBC':  { name: 'WBC',  unit: '×10³/µL' },
  'RBC':  { name: 'RBC',  unit: '×10⁶/µL' },
  'HGB':  { name: 'HGB',  unit: 'g/dL'    },
  'HCT':  { name: 'HCT',  unit: '%'        },
  'MCV':  { name: 'MCV',  unit: 'fL'       },
  'MCH':  { name: 'MCH',  unit: 'pg'       },
  'MCHC': { name: 'MCHC', unit: 'g/dL'    },
  'PLT':  { name: 'PLT',  unit: '×10³/µL' },
  'RDW':  { name: 'RDW',  unit: '%'        },
  'MPV':  { name: 'MPV',  unit: 'fL'       },
  'PCT':  { name: 'PCT',  unit: '%'        },
  'PDW':  { name: 'PDW',  unit: 'fL'       },
  'NEU#': { name: 'NEU#', unit: '×10³/µL' },
  'LYM#': { name: 'LYM#', unit: '×10³/µL' },
  'MON#': { name: 'MON#', unit: '×10³/µL' },
  'EOS#': { name: 'EOS#', unit: '×10³/µL' },
  'BAS#': { name: 'BAS#', unit: '×10³/µL' },
};

// ─── Sector colours (match analyteSection header colours) ─────────────────────

const SECTOR_COLOR: Record<string, string> = {
  hematologia: '#1e3a5f',
  imunologia:  '#1a4731',
};

function sectorColor(sector: string): string {
  return SECTOR_COLOR[sector] ?? '#374151';
}

// ─── Timezone helpers ─────────────────────────────────────────────────────────

const TZ = 'America/Sao_Paulo';

/** Returns [start, end] of the given day in UTC, adjusted for BRT (UTC−3). */
function dayBounds(date: Date): { start: Date; end: Date } {
  const brtStr = date.toLocaleDateString('pt-BR', { timeZone: TZ });
  const [d, m, y] = brtStr.split('/').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, d,      3, 0, 0, 0)),   // 00:00 BRT
    end:   new Date(Date.UTC(y, m - 1, d + 1,  2, 59, 59, 999)), // 23:59:59 BRT
  };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Active labs query ────────────────────────────────────────────────────────

export interface ActiveLab {
  labId:   string;
  labName: string;
  email:   string;
}

export async function getActiveLabs(
  db: admin.firestore.Firestore,
): Promise<ActiveLab[]> {
  const snap = await db.collection('labs').get();
  const result: ActiveLab[] = [];
  for (const doc of snap.docs) {
    const data   = doc.data();
    const backup = data['backup'];
    // cqiEnabled/cqiEmail (set via lab settings panel) take precedence over
    // the legacy backup.enabled/backup.email fields (set by SuperAdmin).
    const enabled = backup?.['cqiEnabled'] ?? backup?.['enabled'];
    const email   = backup?.['cqiEmail']   ?? backup?.['email'];
    if (enabled === true && typeof email === 'string' && email) {
      result.push({ labId: doc.id, labName: data['name'] ?? doc.id, email });
    }
  }
  return result;
}

// ─── Internal data shapes ─────────────────────────────────────────────────────

interface RunResult {
  analyteId:  string;
  value:      number;
  violations: string[];
}

interface HemaRun {
  runCode:     string;
  confirmedAt: Date;
  operatorName: string;
  status:      string;
  results:     RunResult[];
}

interface ImunoRun {
  runCode:          string;
  confirmedAt:      Date;
  operatorName:     string;
  testType:         string;
  resultadoObtido:  string;
  resultadoEsperado: string;
}

interface HemaLot {
  lotId:        string;
  lotNumber:    string;
  level:        string;
  equipmentName: string;
  requiredAnalytes: string[];
  todayRuns:    HemaRun[];
  last20Runs:   Array<{ confirmedAt: Date; results: RunResult[] }>;
}

interface ImunoLot {
  lotId:    string;
  lotNumber: string;
  todayRuns: ImunoRun[];
}

// ─── Hematologia data fetch ───────────────────────────────────────────────────

async function fetchHemaLots(
  db:     admin.firestore.Firestore,
  labId:  string,
  bounds: { start: Date; end: Date },
): Promise<HemaLot[]> {
  const lotsSnap = await db.collection(`labs/${labId}/lots`).get();
  if (lotsSnap.empty) return [];

  const result: HemaLot[] = [];

  for (const lotDoc of lotsSnap.docs) {
    const lotData = lotDoc.data();

    const todaySnap = await db
      .collection(`labs/${labId}/lots/${lotDoc.id}/runs`)
      .where('confirmedAt', '>=', admin.firestore.Timestamp.fromDate(bounds.start))
      .where('confirmedAt', '<=', admin.firestore.Timestamp.fromDate(bounds.end))
      .orderBy('confirmedAt', 'asc')
      .get();

    if (todaySnap.empty) continue;

    const chartSnap = await db
      .collection(`labs/${labId}/lots/${lotDoc.id}/runs`)
      .orderBy('confirmedAt', 'desc')
      .limit(20)
      .get();

    const todayRuns: HemaRun[] = todaySnap.docs.map(d => {
      const r = d.data();
      return {
        runCode:      r['runCode']     ?? d.id.slice(0, 8).toUpperCase(),
        confirmedAt:  (r['confirmedAt'] as admin.firestore.Timestamp).toDate(),
        operatorName: r['operatorName'] ?? '—',
        status:       r['status']       ?? 'Pendente',
        results:      (r['results']     ?? []) as RunResult[],
      };
    });

    // Reverse so chart shows oldest → newest
    const last20Runs = chartSnap.docs.reverse().map(d => {
      const r = d.data();
      return {
        confirmedAt: (r['confirmedAt'] as admin.firestore.Timestamp).toDate(),
        results:     (r['results'] ?? []) as RunResult[],
      };
    });

    result.push({
      lotId:            lotDoc.id,
      lotNumber:        lotData['lotNumber']    ?? lotDoc.id,
      level:            lotData['level']        ?? '—',
      equipmentName:    lotData['equipmentName'] ?? '—',
      requiredAnalytes: (lotData['requiredAnalytes'] ?? []) as string[],
      todayRuns,
      last20Runs,
    });
  }

  return result;
}

// ─── Imunologia data fetch ────────────────────────────────────────────────────

async function fetchImunoLots(
  db:     admin.firestore.Firestore,
  labId:  string,
  bounds: { start: Date; end: Date },
): Promise<ImunoLot[]> {
  const lotsSnap = await db.collection(`labs/${labId}/ciq-imuno`).get();
  if (lotsSnap.empty) return [];

  const result: ImunoLot[] = [];

  for (const lotDoc of lotsSnap.docs) {
    const lotData = lotDoc.data();

    const todaySnap = await db
      .collection(`labs/${labId}/ciq-imuno/${lotDoc.id}/runs`)
      .where('confirmedAt', '>=', admin.firestore.Timestamp.fromDate(bounds.start))
      .where('confirmedAt', '<=', admin.firestore.Timestamp.fromDate(bounds.end))
      .orderBy('confirmedAt', 'asc')
      .get();

    if (todaySnap.empty) continue;

    const todayRuns: ImunoRun[] = todaySnap.docs.map(d => {
      const r = d.data();
      return {
        runCode:           r['runCode']            ?? d.id.slice(0, 8).toUpperCase(),
        confirmedAt:       (r['confirmedAt'] as admin.firestore.Timestamp).toDate(),
        operatorName:      r['operatorName']       ?? '—',
        testType:          r['testType']            ?? '—',
        resultadoObtido:   r['resultadoObtido']    ?? '—',
        resultadoEsperado: r['resultadoEsperado']  ?? '—',
      };
    });

    result.push({ lotId: lotDoc.id, lotNumber: lotData['lotNumber'] ?? lotDoc.id, todayRuns });
  }

  return result;
}

// ─── PDF cover page ───────────────────────────────────────────────────────────

function renderCoverPage(
  doc: PDFKit.PDFDocument,
  opts: {
    labName:      string;
    sector:       string;
    lots:         Array<{ lotNumber: string; level: string; equipmentName?: string }>;
    date:         Date;
    totalRuns:    number;
    accentColor:  string;
  },
): void {
  const { labName, sector, lots, date, totalRuns, accentColor } = opts;
  const M  = 40;
  const PW = 595.28;
  const PH = 841.89;
  const CW = PW - M * 2;

  // Top bar
  doc.rect(0, 0, PW, 8).fillColor(accentColor).fill();

  // System name
  doc.font('Helvetica-Bold').fontSize(10).fillColor(accentColor)
    .text('HC QUALITY', M, 24);
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
    .text('Sistema de Controle de Qualidade Interno', M, 38);

  doc.moveTo(M, 56).lineTo(PW - M, 56).lineWidth(0.5).strokeColor('#e5e7eb').stroke();

  // Main title
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827')
    .text('RELATÓRIO DIÁRIO DE', M, 76);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827')
    .text('CONTROLE DE QUALIDADE INTERNO', M, 98);

  // Sector badge
  doc.rect(M, 136, CW, 34).fillColor(accentColor).fill();
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff')
    .text(`SETOR: ${sector.toUpperCase()}`, M + 16, 150, { width: CW - 32 });

  // Info card
  const cardY = 192;
  const infoRows: Array<[string, string]> = [
    ['Laboratório', labName],
    ['Data',        fmtDate(date)],
    ['Lotes',       lots.map(l => `${l.lotNumber}${l.level ? ' — ' + l.level : ''}`).join(', ')],
    ['Equipamento', lots[0]?.equipmentName ?? '—'],
    ['Total de corridas', String(totalRuns)],
  ];

  doc.rect(M, cardY, CW, infoRows.length * 24 + 16).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
  let infoY = cardY + 12;
  for (const [label, value] of infoRows) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#9ca3af')
      .text(label, M + 14, infoY, { width: CW * 0.34 });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827')
      .text(value, M + CW * 0.36, infoY, { width: CW * 0.6, ellipsis: true });
    infoY += 24;
  }

  // RDC compliance notice
  const noticeY = cardY + infoRows.length * 24 + 28;
  const noticeText =
    'Este relatório foi gerado automaticamente em conformidade com a RDC 978/2025 (ANVISA) ' +
    'e os requisitos de Controle de Qualidade Interno para laboratórios clínicos.';
  doc.rect(M, noticeY, CW, 48).fillColor('#f0f9ff').stroke();
  doc.font('Helvetica').fontSize(7.5).fillColor('#0369a1')
    .text(noticeText, M + 12, noticeY + 10, { width: CW - 24 });

  // Footer
  doc.font('Helvetica').fontSize(7).fillColor('#9ca3af')
    .text(
      `Gerado automaticamente pelo hc-quality · ${fmtDateTime(new Date())} · Confidencial`,
      M, PH - 52, { width: CW, align: 'center' },
    );
  doc.rect(0, PH - 8, PW, 8).fillColor(accentColor).fill();
}

// ─── Daily runs summary table ─────────────────────────────────────────────────

interface SummaryRow {
  runCode:      string;
  confirmedAt:  Date;
  operatorName: string;
  status?:      string;
  alertCount?:  number;
  conforme?:    boolean;
}

function renderRunsSummaryTable(
  doc:     PDFKit.PDFDocument,
  rows:    SummaryRow[],
  sector:  string,
  startY:  number,
): number {
  const M      = 40;
  const PH     = 841.89;
  const CW     = 595.28 - M * 2;
  const rowH   = 14;
  let y = startY;

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
    .text('Resumo das Corridas do Dia', M, y);
  y += 16;

  const isHema = sector === 'hematologia';
  const cols   = isHema
    ? ['Nº', 'Corrida', 'Hora', 'Operador', 'Status', 'Alertas Westgard']
    : ['Nº', 'Corrida', 'Hora', 'Operador', 'Conforme?'];
  const widths = isHema
    ? [CW * 0.05, CW * 0.15, CW * 0.1, CW * 0.28, CW * 0.12, CW * 0.30]
    : [CW * 0.06, CW * 0.18, CW * 0.12, CW * 0.38, CW * 0.26];

  // Header
  doc.rect(M, y, CW, 15).fillColor('#f1f5f9').fill();
  let cx = M;
  for (let i = 0; i < cols.length; i++) {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569')
      .text(cols[i], cx + 4, y + 5, { width: widths[i] - 8 });
    cx += widths[i];
  }
  y += 15;

  for (let ri = 0; ri < rows.length; ri++) {
    if (y + rowH > PH - M - 30) {
      doc.addPage();
      y = M;
    }
    const r = rows[ri];
    if (ri % 2 === 1) doc.rect(M, y, CW, rowH).fillColor('#f9fafb').fill();

    const timeStr = r.confirmedAt.toLocaleTimeString('pt-BR', {
      timeZone: TZ, hour: '2-digit', minute: '2-digit',
    });

    const cells = isHema
      ? [String(ri + 1), r.runCode, timeStr, r.operatorName, r.status ?? '—', String(r.alertCount ?? 0)]
      : [String(ri + 1), r.runCode, timeStr, r.operatorName, r.conforme ? 'Conforme' : 'NÃO CONFORME'];

    cx = M;
    for (let i = 0; i < cells.length; i++) {
      const isStatusCol = (isHema && i === 4) || (!isHema && i === 4);
      const v = cells[i];
      const color = isStatusCol
        ? (v === 'Aprovada' || v === 'Conforme' ? '#16a34a' : v === 'Reprovada' || v === 'NÃO CONFORME' ? '#dc2626' : '#111827')
        : '#111827';
      doc.font(isStatusCol ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5).fillColor(color)
        .text(v, cx + 4, y + 4, { width: widths[i] - 8, ellipsis: true });
      cx += widths[i];
    }
    y += rowH;
  }

  return y + 14;
}

// ─── PDF builders ─────────────────────────────────────────────────────────────

function makePdfPromise(
  drawFn: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({
      size:    'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info:    { Title: 'Relatório CQI — HC Quality', Author: 'hc-quality', Creator: 'hc-quality CQI Module' },
    });
    const chunks: Buffer[] = [];
    doc.on('data',  (c: Buffer) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    drawFn(doc);
    doc.end();
  });
}

async function buildHematologiaPdf(
  labName: string,
  lots:    HemaLot[],
  date:    Date,
): Promise<Buffer> {
  // Pre-compute analyte data (outside Promise so errors surface before PDF starts)
  const allTodayRuns = lots.flatMap(l => l.todayRuns);
  const totalRuns    = allTodayRuns.length;

  // Per-analyte aggregation across all lots
  const analyteMap = new Map<string, {
    todayValues: QuantitativeAnalyteData['todayValues'];
    last20Values: QuantitativeAnalyteData['last20Values'];
    lotNumber: string;
  }>();

  for (const lot of lots) {
    // Collect today's values per analyte
    for (const run of lot.todayRuns) {
      for (const res of run.results) {
        if (!analyteMap.has(res.analyteId)) {
          analyteMap.set(res.analyteId, { todayValues: [], last20Values: [], lotNumber: lot.lotNumber });
        }
        analyteMap.get(res.analyteId)!.todayValues.push({
          value:      res.value,
          timestamp:  run.confirmedAt,
          runCode:    run.runCode,
          violations: res.violations,
        });
      }
    }
    // Collect last-20 history per analyte
    for (const run of lot.last20Runs) {
      for (const res of run.results) {
        if (!analyteMap.has(res.analyteId)) {
          analyteMap.set(res.analyteId, { todayValues: [], last20Values: [], lotNumber: lot.lotNumber });
        }
        analyteMap.get(res.analyteId)!.last20Values.push({
          value:     res.value,
          timestamp: run.confirmedAt,
        });
      }
    }
  }

  // Build QuantitativeAnalyteData[] ordered by requiredAnalytes list of first lot
  const orderedIds = lots[0]?.requiredAnalytes.length > 0
    ? lots[0].requiredAnalytes
    : [...analyteMap.keys()];

  const analyteDataList: QuantitativeAnalyteData[] = orderedIds
    .filter(id => analyteMap.has(id))
    .map(id => {
      const entry   = analyteMap.get(id)!;
      const vals    = entry.todayValues.map(v => v.value);
      const mean    = calculateMean(vals);
      const sd      = calculateSD(vals, mean);
      const cv      = calculateCV(sd, mean);
      const info    = ANALYTE_INFO[id] ?? { name: id, unit: '' };
      return {
        analyteId:    id,
        name:         info.name,
        unit:         info.unit,
        lotNumber:    entry.lotNumber,
        todayValues:  entry.todayValues,
        last20Values: entry.last20Values,
        mean, sd, cv,
      };
    });

  return makePdfPromise(doc => {
    // Cover
    renderCoverPage(doc, {
      labName,
      sector:    'hematologia',
      lots:      lots.map(l => ({ lotNumber: l.lotNumber, level: l.level, equipmentName: l.equipmentName })),
      date,
      totalRuns,
      accentColor: sectorColor('hematologia'),
    });

    // Summary table
    doc.addPage();
    const summaryRows: SummaryRow[] = allTodayRuns.map(r => ({
      runCode:      r.runCode,
      confirmedAt:  r.confirmedAt,
      operatorName: r.operatorName,
      status:       r.status,
      alertCount:   r.results.reduce((s, res) => s + res.violations.length, 0),
    }));
    let y = renderRunsSummaryTable(doc, summaryRows, 'hematologia', 40);

    // Per-analyte sections
    for (const data of analyteDataList) {
      y = renderQuantitativeAnalyteSection(doc, data, y);
    }
  });
}

async function buildImunologiaPdf(
  labName: string,
  lots:    ImunoLot[],
  date:    Date,
): Promise<Buffer> {
  const allTodayRuns = lots.flatMap(l => l.todayRuns);
  const totalRuns    = allTodayRuns.length;

  // Group runs by testType
  const byTestType = new Map<string, CategoricalRunData[]>();
  for (const run of allTodayRuns) {
    if (!byTestType.has(run.testType)) byTestType.set(run.testType, []);
    byTestType.get(run.testType)!.push({
      runCode:           run.runCode,
      timestamp:         run.confirmedAt,
      testType:          run.testType,
      resultadoObtido:   run.resultadoObtido,
      resultadoEsperado: run.resultadoEsperado,
      conforme:          run.resultadoObtido === run.resultadoEsperado,
    });
  }

  return makePdfPromise(doc => {
    renderCoverPage(doc, {
      labName,
      sector:    'imunologia',
      lots:      lots.map(l => ({ lotNumber: l.lotNumber, level: '' })),
      date,
      totalRuns,
      accentColor: sectorColor('imunologia'),
    });

    doc.addPage();
    const summaryRows: SummaryRow[] = allTodayRuns.map(r => ({
      runCode:      r.runCode,
      confirmedAt:  r.confirmedAt,
      operatorName: r.operatorName,
      conforme:     r.resultadoObtido === r.resultadoEsperado,
    }));
    let y = renderRunsSummaryTable(doc, summaryRows, 'imunologia', 40);

    for (const [testType, runs] of byTestType) {
      y = renderCategoricalRunsSection(doc, runs, testType, y);
    }
  });
}

// ─── Per-sector send helpers ──────────────────────────────────────────────────

export type SectorStatus = 'sent' | 'no-data';

async function sendHematologia(
  db:      admin.firestore.Firestore,
  lab:     ActiveLab,
  date:    Date,
  bounds:  { start: Date; end: Date },
): Promise<SectorStatus> {
  const lots = await fetchHemaLots(db, lab.labId, bounds);
  if (lots.length === 0) {
    console.log(`[cqiReport][hematologia] lab=${lab.labId} no runs today — skip`);
    return 'no-data';
  }

  console.log(`[cqiReport][hematologia] lab=${lab.labId} lots=${lots.length} building PDF`);
  const pdfBuffer   = await buildHematologiaPdf(lab.labName, lots, date);
  const allTodayRuns = lots.flatMap(l => l.todayRuns);
  const alertCount   = allTodayRuns.flatMap(r => r.results).reduce((s, r) => s + r.violations.length, 0);
  const analyteSet   = new Set(allTodayRuns.flatMap(r => r.results.map(res => res.analyteId)));

  await sendCQIEmail({
    to:            lab.email,
    labName:       lab.labName,
    sector:        'hematologia' as SectorId,
    lotNumber:     lots.map(l => l.lotNumber).join(', '),
    date,
    totalRuns:     allTodayRuns.length,
    analyteCount:  analyteSet.size,
    alertCount,
    hasRejections: allTodayRuns.some(r => r.status === 'Reprovada'),
    pdfBuffer,
  });

  console.log(`[cqiReport][hematologia] lab=${lab.labId} email sent to ${lab.email}`);
  return 'sent';
}

async function sendImunologia(
  db:     admin.firestore.Firestore,
  lab:    ActiveLab,
  date:   Date,
  bounds: { start: Date; end: Date },
): Promise<SectorStatus> {
  const lots = await fetchImunoLots(db, lab.labId, bounds);
  if (lots.length === 0) {
    console.log(`[cqiReport][imunologia] lab=${lab.labId} no runs today — skip`);
    return 'no-data';
  }

  console.log(`[cqiReport][imunologia] lab=${lab.labId} lots=${lots.length} building PDF`);
  const pdfBuffer    = await buildImunologiaPdf(lab.labName, lots, date);
  const allTodayRuns = lots.flatMap(l => l.todayRuns);
  const nonConformes = allTodayRuns.filter(r => r.resultadoObtido !== r.resultadoEsperado).length;

  await sendCQIEmail({
    to:            lab.email,
    labName:       lab.labName,
    sector:        'imunologia' as SectorId,
    lotNumber:     lots.map(l => l.lotNumber).join(', '),
    date,
    totalRuns:     allTodayRuns.length,
    analyteCount:  new Set(allTodayRuns.map(r => r.testType)).size,
    alertCount:    nonConformes,
    hasRejections: nonConformes > 0,
    pdfBuffer,
  });

  console.log(`[cqiReport][imunologia] lab=${lab.labId} email sent to ${lab.email}`);
  return 'sent';
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export interface CQIReportResult {
  overall:   'sent' | 'no-data' | 'disabled' | 'partial' | 'failed';
  email?:    string;
  sectors: {
    hematologia: 'sent' | 'no-data' | 'failed';
    imunologia:  'sent' | 'no-data' | 'failed';
  };
}

/**
 * Generates and sends daily CQI reports for all active sectors of a lab.
 * Sectors are processed independently — a failure in one does not abort the other.
 */
export async function generateAndSendCQIReport(
  labId: string,
  date:  Date,
): Promise<CQIReportResult> {
  const db  = admin.firestore();
  const lab = await (async (): Promise<ActiveLab | null> => {
    const snap = await db.doc(`labs/${labId}`).get();
    if (!snap.exists) return null;
    const data   = snap.data()!;
    const backup = data['backup'];
    if (!backup?.enabled || !backup?.email) return null;
    return { labId, labName: data['name'] ?? labId, email: backup.email as string };
  })();

  if (!lab) {
    console.log(`[cqiReport] lab=${labId} backup disabled or no email — skip`);
    return {
      overall: 'disabled',
      sectors: { hematologia: 'no-data', imunologia: 'no-data' },
    };
  }

  const bounds = dayBounds(date);
  console.log(`[cqiReport] lab=${labId} date=${fmtDate(date)} processing sectors`);

  // Run sectors in parallel; isolate failures with allSettled
  const results = await Promise.allSettled([
    sendHematologia(db, lab, date, bounds),
    sendImunologia(db, lab, date, bounds),
  ]);

  const sectorStatus = (i: number): 'sent' | 'no-data' | 'failed' => {
    const res = results[i];
    if (res.status === 'rejected') {
      const sector = i === 0 ? 'hematologia' : 'imunologia';
      console.error(`[cqiReport][${sector}] lab=${labId} FAILED:`, res.reason);
      return 'failed';
    }
    return res.value;
  };

  const sectors = {
    hematologia: sectorStatus(0),
    imunologia:  sectorStatus(1),
  };

  const sentCount   = Object.values(sectors).filter(s => s === 'sent').length;
  const failedCount = Object.values(sectors).filter(s => s === 'failed').length;

  let overall: CQIReportResult['overall'];
  if (failedCount === 2)                     overall = 'failed';
  else if (sentCount === 0 && failedCount === 0) overall = 'no-data';
  else if (sentCount > 0 && failedCount === 0)   overall = 'sent';
  else                                           overall = 'partial';

  return { overall, email: lab.email, sectors };
}
