/**
 * generateRiskMatrixPDF - Relatorio Executivo de Gestao de Riscos (FMEA-lite).
 * PDF profissional com capa, sumario executivo, matriz P*S, Pareto, registro, conclusao.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { logger } from 'firebase-functions';
import { assertRisksAccess, risksCollection } from '../../modules/risks/validators';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

const db = admin.firestore();
const inputSchema = z.object({ labId: z.string().min(1) });

type RiskRow = {
  codigo: string; descricao: string; processo: string; categoria: string;
  p: number; s: number; d: number; npr: number; nivel: string; status: string; observacoes: string;
};

function clamp1to5(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}
function str(v: unknown, fb = '—'): string {
  if (v === null || v === undefined) return fb;
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fb;
}
function num(v: unknown, fb = 0): number { return typeof v === 'number' && Number.isFinite(v) ? v : fb; }

function nivelLabel(n: string): string {
  const m: Record<string, string> = { baixo: 'Baixo', medio: 'Medio', alto: 'Alto', critico: 'Critico' };
  return m[n] || n;
}
function processoLabel(p: string): string {
  const m: Record<string, string> = {
    atendimento: 'Atendimento', coleta: 'Coleta', transporte: 'Transporte',
    armazenamento: 'Armazenamento', analise: 'Analise', pos_analitico: 'Pos-Analitico',
    liberacao: 'Liberacao', administrativo: 'Administrativo', rastreabilidade: 'Rastreabilidade',
  };
  return m[p] || p;
}
function labDisplayName(d: Record<string, unknown> | undefined): string {
  if (!d) return 'Laboratorio';
  for (const k of ['nomeFantasia', 'nome', 'razaoSocial', 'displayName']) {
    const v = d[k]; if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return 'Laboratorio';
}
function extractObs(data: Record<string, unknown>): string {
  const t = data['tratamento'] as Record<string, unknown> | undefined;
  return str(t?.['observacoes'], '—');
}

async function buildPdfBuffer(labName: string, rows: RiskRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    const pageW = doc.page.width;
    const contentW = pageW - 100;
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const criticos = rows.filter(r => r.nivel === 'critico').length;
    const altos = rows.filter(r => r.nivel === 'alto').length;
    const avgNpr = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.npr, 0) / rows.length) : 0;
    const byNivel: Record<string, number> = { baixo: 0, medio: 0, alto: 0, critico: 0 };
    const byProcesso: Record<string, number> = {};
    for (const r of rows) {
      byNivel[r.nivel] = (byNivel[r.nivel] || 0) + 1;
      byProcesso[r.processo] = (byProcesso[r.processo] || 0) + 1;
    }
    const processosSorted = Object.entries(byProcesso).sort(([, a], [, b]) => b - a);
    const topProcesso = processosSorted[0] ? processoLabel(processosSorted[0][0]) : '—';

    // === CAPA ===
    doc.rect(0, 0, pageW, doc.page.height).fill('#0f1115');
    doc.fillColor('#ffffff');
    doc.fontSize(10).font('Helvetica').text('SISTEMA DE GESTAO DA QUALIDADE', 50, 80, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#888888').text('RDC 978/2025 | DICQ 4.14.6 | ISO 15189 8.5', { align: 'center' });
    doc.fillColor('#ffffff').moveDown(4);
    doc.fontSize(24).font('Helvetica-Bold').text('Relatorio Executivo', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(20).text('Gestao de Riscos', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(14).font('Helvetica').fillColor('#aaaaaa').text('Analise FMEA-Lite', { align: 'center' });
    doc.moveDown(3);
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text(labName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#888888').text(dateStr, { align: 'center' });
    doc.moveDown(4);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica');
    doc.text(`${rows.length} riscos ativos  |  ${criticos} criticos  |  ${altos} alto risco  |  NPR medio: ${avgNpr}`, { align: 'center' });
    doc.moveDown(6);
    doc.fontSize(7).fillColor('#666666').text('Documento gerado automaticamente pelo HC Quality', { align: 'center' });
    doc.text('Valido como registro do SGQ - preservar para auditoria', { align: 'center' });

    // === SUMARIO EXECUTIVO ===
    doc.addPage();
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('1. Sumario Executivo');
    doc.moveDown(0.8);
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    doc.text(`Este relatorio apresenta a analise consolidada dos ${rows.length} riscos ativos identificados no laboratorio ${labName}, classificados pela metodologia FMEA-Lite (Probabilidade x Severidade x Deteccao).`);
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').text('Indicadores-chave:');
    doc.moveDown(0.3);
    doc.font('Helvetica');
    doc.text(`  Total de riscos ativos: ${rows.length}`);
    doc.text(`  Riscos criticos (NPR >= 100): ${byNivel['critico'] || 0}`);
    doc.text(`  Riscos alto (NPR 61-99): ${byNivel['alto'] || 0}`);
    doc.text(`  Riscos medio (NPR 25-60): ${byNivel['medio'] || 0}`);
    doc.text(`  Riscos baixo (NPR <= 24): ${byNivel['baixo'] || 0}`);
    doc.text(`  NPR medio geral: ${avgNpr}`);
    doc.text(`  Processo com maior concentracao: ${topProcesso} (${processosSorted[0]?.[1] || 0} riscos)`);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Analise Critica:');
    doc.moveDown(0.3);
    doc.font('Helvetica');
    if (criticos > 0) {
      doc.fillColor('#cc0000').text(`ATENCAO: ${criticos} risco(s) em nivel CRITICO requerem acao imediata e acompanhamento pela direcao tecnica.`);
      doc.fillColor('#333333');
    }
    if (altos > 0) doc.text(`${altos} risco(s) em nivel ALTO necessitam plano de mitigacao com prazo definido.`);
    if (processosSorted.length > 1) {
      doc.text(`O processo "${topProcesso}" concentra ${Math.round(((processosSorted[0]?.[1] || 0) / rows.length) * 100)}% dos riscos - recomenda-se analise de causa raiz.`);
    }
    doc.text('Metodologia: FMEA-Lite conforme DICQ 4.14.6 e RDC 978/2025 Art. 109.');

    // === MATRIZ DE RISCOS ===
    doc.moveDown(1.5);
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('2. Matriz de Riscos (P x S)');
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').fillColor('#555555');
    doc.text('Contagem de riscos por celula. Eixo Y = Probabilidade (5=Quase certa, 1=Rara). Eixo X = Severidade (5=Catastrofica, 1=Insignificante).');
    doc.moveDown(0.5);

    const grid: number[][] = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
    for (const r of rows) {
      const pi = r.p - 1; const si = r.s - 1;
      if (pi >= 0 && pi < 5 && si >= 0 && si < 5) grid[pi][si] += 1;
    }

    doc.font('Courier').fontSize(8).fillColor('#000000');
    doc.text('            S=1    S=2    S=3    S=4    S=5');
    for (let p = 5; p >= 1; p--) {
      const row = grid[p - 1];
      const cells = row.map(c => c === 0 ? '  .  ' : String(c).padStart(3, ' ') + '  ').join('|');
      doc.text(`   P=${p}  |${cells}|`);
    }
    doc.font('Helvetica');
    doc.moveDown(0.5);
    doc.fontSize(7).fillColor('#777777');
    doc.text('Zonas: Verde (PxS <= 4) Aceitavel | Amarelo (5-9) Toleravel | Laranja (10-12) Moderado | Vermelho (13-16) Substancial | Roxo (>16) Intoleravel');

    // === PARETO POR PROCESSO ===
    doc.moveDown(1.5);
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('3. Distribuicao por Processo (Pareto)');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#333333');

    let cumPct = 0;
    for (const [proc, count] of processosSorted) {
      const pct = Math.round((count / rows.length) * 100);
      cumPct += pct;
      const barLen = Math.round(pct / 3);
      const bar = '#'.repeat(barLen) + '.'.repeat(Math.max(0, 20 - barLen));
      doc.font('Courier').fontSize(8);
      doc.text(`  ${processoLabel(proc).padEnd(16)} ${bar} ${String(count).padStart(2)} (${String(pct).padStart(2)}% | acum: ${cumPct}%)`);
    }
    doc.font('Helvetica');

    // === REGISTRO DE RISCOS ===
    doc.addPage();
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('4. Registro de Riscos');
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica').fillColor('#555555');
    doc.text('Ordenado por NPR decrescente. Todos os riscos ativos (nao deletados).');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#000000');
    doc.text('Codigo    | Descricao                        | Processo     | P | S | D | NPR | Nivel   | Status');
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(pageW - 50, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(7).fillColor('#333333');
    for (const r of rows) {
      if (doc.y > doc.page.height - 70) {
        doc.addPage();
        doc.fontSize(7).font('Helvetica').fillColor('#333333');
      }
      const desc = r.descricao.length > 34 ? r.descricao.slice(0, 32) + '..' : r.descricao;
      const nprColor = r.npr >= 100 ? '#cc0000' : r.npr >= 61 ? '#cc6600' : r.npr >= 25 ? '#997700' : '#333333';
      const line = `${r.codigo.padEnd(9)} | ${desc.padEnd(34)} | ${processoLabel(r.processo).slice(0, 12).padEnd(12)} | ${r.p} | ${r.s} | ${r.d} | `;
      doc.text(line, { continued: true });
      doc.fillColor(nprColor).text(String(r.npr).padStart(3), { continued: true });
      doc.fillColor('#333333').text(` | ${nivelLabel(r.nivel).padEnd(7)} | ${r.status}`);
      doc.moveDown(0.15);
    }

    // === CONCLUSAO ===
    doc.addPage();
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('5. Conclusao e Recomendacoes');
    doc.moveDown(0.8);
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    doc.text(`Com base na analise dos ${rows.length} riscos identificados:`);
    doc.moveDown(0.5);
    if (criticos === 0 && altos === 0) {
      doc.text('O laboratorio apresenta perfil de risco CONTROLADO. Todos os riscos estao em niveis aceitaveis (baixo ou medio).');
      doc.text('Recomenda-se manter o ciclo de revisao periodica conforme cronograma estabelecido.');
    } else if (criticos > 0) {
      doc.text(`ATENCAO: ${criticos} risco(s) em nivel CRITICO identificado(s). Acao corretiva imediata e obrigatoria.`);
      doc.text('A direcao tecnica deve ser notificada e um plano de acao com prazo maximo de 30 dias deve ser estabelecido.');
      doc.text('Reavaliacao obrigatoria apos implementacao das acoes corretivas.');
    } else {
      doc.text(`${altos} risco(s) em nivel ALTO identificado(s). Planos de mitigacao devem ser priorizados.`);
      doc.text('Recomenda-se revisao mensal dos riscos de nivel alto ate reclassificacao.');
    }
    doc.moveDown(0.5);
    doc.text('Proxima revisao geral programada: 12 meses a partir desta data.');
    doc.text('Metodologia aplicada: FMEA-Lite (PxSxD) conforme ADR-0016.');
    doc.text('Base normativa: RDC 978/2025 Art. 86, 107, 108, 109 | DICQ 4.14.6 | ISO 15189 8.5.');
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#555555');
    doc.text('________________________________________');
    doc.moveDown(0.3);
    doc.text('Responsavel Tecnico');
    doc.moveDown(1.5);
    doc.text('________________________________________');
    doc.moveDown(0.3);
    doc.text('Direcao do Laboratorio');

    // === APENDICE ===
    doc.addPage();
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('Apendice - Metodologia FMEA-Lite');
    doc.moveDown(0.8);
    doc.fontSize(8).font('Helvetica').fillColor('#333333');
    doc.font('Helvetica-Bold').text('Calculo do NPR (Numero de Prioridade de Risco):');
    doc.font('Helvetica').text('  NPR = Probabilidade (P) x Severidade (S) x Deteccao (D)');
    doc.text('  Cada fator varia de 1 a 5. NPR varia de 1 a 125.');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Classificacao por NPR:');
    doc.font('Helvetica');
    doc.text('  Baixo: NPR <= 24 - Risco aceitavel, monitoramento padrao');
    doc.text('  Medio: NPR 25-60 - Risco toleravel, acoes preventivas recomendadas');
    doc.text('  Alto: NPR 61-99 - Risco significativo, plano de mitigacao obrigatorio');
    doc.text('  Critico: NPR >= 100 - Risco intoleravel, acao corretiva imediata');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Escala de Probabilidade (P):');
    doc.font('Helvetica').text('  1=Rara | 2=Improvavel | 3=Possivel | 4=Provavel | 5=Quase certa');
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('Escala de Severidade (S):');
    doc.font('Helvetica').text('  1=Insignificante | 2=Menor | 3=Moderada | 4=Maior | 5=Catastrofica');
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('Escala de Deteccao (D):');
    doc.font('Helvetica').text('  1=Muito alta (controle diario eficaz) | 2=Alta | 3=Moderada | 4=Baixa | 5=Muito baixa (sem controle)');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Referencias normativas:');
    doc.font('Helvetica');
    doc.text('  RDC 978/2025 - Art. 86, 107, 108, 109');
    doc.text('  DICQ 4.14.6 - Gestao de Riscos');
    doc.text('  ISO 15189:2022 8.5 - Gestao de riscos laboratoriais');
    doc.text('  ISO 31000:2018 - Gestao de riscos (principios e diretrizes)');

    // === RODAPE ===
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      if (i === 0) continue;
      doc.fontSize(7).fillColor('#999999').font('Helvetica');
      doc.text(`HC Quality - Gestao de Riscos | ${labName} | ${dateStr}`, 50, doc.page.height - 40, { width: contentW - 60, align: 'left' });
      doc.text(`Pagina ${i} de ${pages.count - 1}`, 50, doc.page.height - 40, { width: contentW, align: 'right' });
    }

    doc.end();
  });
}

export const generateRiskMatrixPDF = onCall<unknown, Promise<{ url: string }>>(
  { region: 'southamerica-east1', enforceAppCheck: false, memory: '512MiB' },
  async (request): Promise<{ url: string }> => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', `Dados invalidos: ${parsed.error.message}`);
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
        processo: str(data['processo'], '—'),
        categoria: str(data['categoria'], '—'),
        p: clamp1to5(data['probabilidade']),
        s: clamp1to5(data['severidade']),
        d: clamp1to5(data['deteccao']),
        npr: num(data['npr'], 0),
        nivel: str(data['nivel'], '—'),
        status: str(data['status'], '—'),
        observacoes: extractObs(data),
      });
    }
    rows.sort((a, b) => b.npr - a.npr);

    const pdfBuffer = await buildPdfBuffer(labName, rows);
    const bucket = admin.storage().bucket();
    const objectPath = `labs/${labId}/reports/risk-matrix-${Date.now()}.pdf`;
    const file = bucket.file(objectPath);
    const downloadToken = require('crypto').randomUUID();

    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      public: false,
      metadata: { metadata: { labId, kind: 'risk-matrix-pdf', firebaseStorageDownloadTokens: downloadToken } },
    });

    const bucketName = bucket.name;
    const encodedPath = encodeURIComponent(objectPath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    logger.info('generateRiskMatrixPDF ok', { labId, count: rows.length });
    return { url };
  },
);
