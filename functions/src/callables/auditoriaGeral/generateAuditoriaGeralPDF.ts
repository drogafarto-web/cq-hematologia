/**
 * generateAuditoriaGeralPDF — Relatorio Executivo de Auditoria Geral.
 * PDF profissional com capa, sumario executivo, scores por bloco, achados criticos, tabela completa.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { logger } from 'firebase-functions';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

const db = admin.firestore();
const inputSchema = z.object({ labId: z.string().min(1), auditoriaId: z.string().min(1) });

const BLOCOS: Record<string, string> = {
  A: 'Documentacao Legal e Governanca',
  B: 'Contratos e Terceirizacao',
  C: 'Tecnologias e Equipamentos',
  D: 'Risco e Documentos',
  E: 'Pessoal e Educacao',
  F: 'Infraestrutura e Ambiente',
  G: 'Sistemas e Biosseguranca',
  H: 'Procedimentos e Rastreabilidade',
  I: 'Fase Pre-Analitica',
  J: 'Fase Analitica',
  K: 'Fase Pos-Analitica e Laudos',
  L: 'Controle da Qualidade (CIQ/CEQ)',
};

interface Resposta {
  numero: number;
  nome: string;
  bloco: string;
  score: number | null;
  observacoes: string;
}

function labDisplayName(d: Record<string, unknown> | undefined): string {
  if (!d) return 'Laboratorio';
  for (const k of ['nomeFantasia', 'nome', 'razaoSocial', 'displayName']) {
    const v = d[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return 'Laboratorio';
}

function str(v: unknown, fb = '—'): string {
  if (v === null || v === undefined) return fb;
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fb;
}

function parseResposta(data: Record<string, unknown>): Resposta {
  const score = typeof data['score'] === 'number' && Number.isFinite(data['score'] as number)
    ? data['score'] as number
    : null;
  return {
    numero: typeof data['numero'] === 'number' ? data['numero'] as number : 0,
    nome: str(data['nome'] || data['indicador'] || data['descricao'], 'Indicador'),
    bloco: str(data['bloco'], '?'),
    score,
    observacoes: str(data['observacoes'], ''),
  };
}

function computeScores(respostas: Resposta[]) {
  const respondidos = respostas.filter(r => r.score !== null && r.score > 0);
  const naCount = respostas.filter(r => r.score === null || r.score === 0).length;
  const totalScore = respondidos.reduce((sum, r) => sum + (r.score ?? 0), 0);
  const maxPossible = respondidos.length * 4;
  const scorePercent = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
  const belowThree = respondidos.filter(r => (r.score ?? 0) <= 2).length;

  // Per-bloco scores
  const blocoScores: Record<string, { total: number; count: number }> = {};
  for (const r of respondidos) {
    if (!blocoScores[r.bloco]) blocoScores[r.bloco] = { total: 0, count: 0 };
    blocoScores[r.bloco].total += r.score ?? 0;
    blocoScores[r.bloco].count += 1;
  }

  return { respondidos: respondidos.length, naCount, totalScore, maxPossible, scorePercent, belowThree, blocoScores };
}

async function buildPdfBuffer(
  labName: string,
  auditoria: Record<string, unknown>,
  respostas: Resposta[],
): Promise<Buffer> {
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

    const titulo = str(auditoria['titulo'] || auditoria['title'], 'Auditoria Geral');
    const auditorName = str(auditoria['auditorNome'] || auditoria['auditor'] || auditoria['auditorName'], '—');
    const dataAuditoria = auditoria['data']
      ? (auditoria['data'] as { toDate?: () => Date }).toDate
        ? (auditoria['data'] as { toDate: () => Date }).toDate().toLocaleDateString('pt-BR')
        : str(auditoria['data'])
      : dateStr;

    const stats = computeScores(respostas);

    // === CAPA ===
    doc.rect(0, 0, pageW, doc.page.height).fill('#0f1115');
    doc.fillColor('#ffffff');
    doc.fontSize(10).font('Helvetica').text('SISTEMA DE GESTAO DA QUALIDADE', 50, 80, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#888888').text('RDC 978/2025 | DICQ 4.4 | ISO 15189', { align: 'center' });
    doc.fillColor('#ffffff').moveDown(4);
    doc.fontSize(24).font('Helvetica-Bold').text('Auditoria Geral', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(20).text('Relatorio Executivo', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica').fillColor('#aaaaaa').text(titulo, { align: 'center' });
    doc.moveDown(3);
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text(labName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#888888').text(`Auditor: ${auditorName}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.text(`Data: ${dataAuditoria}`, { align: 'center' });
    doc.moveDown(3);
    doc.fillColor('#ffffff').fontSize(36).font('Helvetica-Bold').text(`${stats.scorePercent}%`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#aaaaaa').text('Score de Conformidade', { align: 'center' });
    doc.moveDown(5);
    doc.fontSize(7).fillColor('#666666').text('Documento gerado automaticamente pelo HC Quality', { align: 'center' });
    doc.text('Valido como registro do SGQ - preservar para auditoria', { align: 'center' });

    // === SUMARIO EXECUTIVO ===
    doc.addPage();
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('1. Sumario Executivo');
    doc.moveDown(0.8);
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    doc.text(`Este relatorio apresenta os resultados da auditoria geral realizada no laboratorio ${labName}.`);
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').text('Indicadores-chave:');
    doc.moveDown(0.3);
    doc.font('Helvetica');
    doc.text(`  Score total: ${stats.scorePercent}% (${stats.totalScore}/${stats.maxPossible} pontos)`);
    doc.text(`  Indicadores respondidos: ${stats.respondidos}/57`);
    doc.text(`  Indicadores N/A: ${stats.naCount}`);
    doc.text(`  Indicadores com score <= 2 (criticos): ${stats.belowThree}`);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Analise Critica:');
    doc.moveDown(0.3);
    doc.font('Helvetica');
    if (stats.scorePercent >= 80) {
      doc.text('O laboratorio apresenta nivel de conformidade SATISFATORIO. Manter ciclo de melhoria continua.');
    } else if (stats.scorePercent >= 60) {
      doc.text('O laboratorio apresenta nivel de conformidade PARCIAL. Acoes corretivas recomendadas nos blocos com score inferior a 60%.');
    } else {
      doc.fillColor('#cc0000').text('ATENCAO: Nivel de conformidade INSATISFATORIO. Acoes corretivas imediatas necessarias.');
      doc.fillColor('#333333');
    }

    // === SCORES POR BLOCO ===
    doc.addPage();
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('2. Scores por Bloco');
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').fillColor('#555555');
    doc.text('Percentual de conformidade por bloco tematico (score obtido / score maximo possivel).');
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
    doc.text('Bloco  Nome                                    Score %   Barra');
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(pageW - 50, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(8).fillColor('#333333');
    const blocoKeys = Object.keys(BLOCOS);
    for (const key of blocoKeys) {
      const bs = stats.blocoScores[key];
      const pct = bs ? Math.round((bs.total / (bs.count * 4)) * 100) : 0;
      const barLen = Math.round(pct / 5);
      const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));
      const nome = BLOCOS[key].length > 38 ? BLOCOS[key].slice(0, 36) + '..' : BLOCOS[key];
      const pctColor = pct < 50 ? '#cc0000' : pct < 70 ? '#cc6600' : '#333333';
      doc.fillColor('#333333').text(`  ${key}      ${nome.padEnd(40)}`, { continued: true });
      doc.fillColor(pctColor).text(`${String(pct).padStart(3)}%  `, { continued: true });
      doc.fillColor('#333333').text(bar);
      doc.moveDown(0.15);
    }

    // === ACHADOS CRITICOS ===
    const criticos = respostas.filter(r => r.score !== null && r.score <= 2);
    if (criticos.length > 0) {
      doc.addPage();
      doc.fillColor('#000000');
      doc.fontSize(16).font('Helvetica-Bold').text('3. Achados Criticos (Score <= 2)');
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica').fillColor('#555555');
      doc.text(`${criticos.length} indicador(es) com pontuacao critica identificado(s). Requerem acao corretiva.`);
      doc.moveDown(0.8);

      doc.font('Helvetica-Bold').fontSize(7).fillColor('#000000');
      doc.text('No.  | Indicador                                    | Score | Observacoes');
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(pageW - 50, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(7).fillColor('#333333');
      for (const r of criticos) {
        if (doc.y > doc.page.height - 70) {
          doc.addPage();
          doc.fontSize(7).font('Helvetica').fillColor('#333333');
        }
        const nome = r.nome.length > 44 ? r.nome.slice(0, 42) + '..' : r.nome;
        const obs = r.observacoes.length > 40 ? r.observacoes.slice(0, 38) + '..' : r.observacoes;
        doc.fillColor('#cc0000').text(
          `${String(r.numero).padStart(3)}  | ${nome.padEnd(46)} |   ${r.score}   | ${obs}`,
        );
        doc.moveDown(0.15);
      }
    }

    // === TABELA COMPLETA ===
    doc.addPage();
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text(criticos.length > 0 ? '4. Tabela Completa (57 Indicadores)' : '3. Tabela Completa (57 Indicadores)');
    doc.moveDown(0.3);
    doc.fontSize(7).font('Helvetica').fillColor('#555555');
    doc.text('Todos os indicadores avaliados, ordenados por numero.');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#000000');
    doc.text('No. | Bloco | Indicador                                         | Score | Obs');
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(pageW - 50, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(6.5).fillColor('#333333');
    const sorted = [...respostas].sort((a, b) => a.numero - b.numero);
    for (const r of sorted) {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        doc.fontSize(6.5).font('Helvetica').fillColor('#333333');
      }
      const nome = r.nome.length > 47 ? r.nome.slice(0, 45) + '..' : r.nome;
      const scoreStr = r.score !== null ? String(r.score) : 'N/A';
      const obs = r.observacoes.length > 25 ? r.observacoes.slice(0, 23) + '..' : r.observacoes;
      const scoreColor = r.score !== null && r.score <= 2 ? '#cc0000' : '#333333';
      doc.fillColor('#333333').text(`${String(r.numero).padStart(3)} |   ${r.bloco}   | ${nome.padEnd(49)} | `, { continued: true });
      doc.fillColor(scoreColor).text(`${scoreStr.padStart(3)}`, { continued: true });
      doc.fillColor('#333333').text(`  | ${obs}`);
      doc.moveDown(0.1);
    }

    // === RODAPE ===
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      if (i === 0) continue;
      doc.fontSize(7).fillColor('#999999').font('Helvetica');
      doc.text(
        `HC Quality - Auditoria Geral | ${labName} | ${dateStr}`,
        50, doc.page.height - 40,
        { width: contentW - 60, align: 'left' },
      );
      doc.text(
        `Pagina ${i} de ${pages.count - 1}`,
        50, doc.page.height - 40,
        { width: contentW, align: 'right' },
      );
    }

    doc.end();
  });
}

export const generateAuditoriaGeralPDF = onCall(
  { memory: '512MiB' },
  async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados invalidos: ${parsed.error.message}`);
    }
    const { labId, auditoriaId } = parsed.data;

    // Verify caller is active member of lab
    const memberSnap = await db.doc(`labs/${labId}/members/${auth.uid}`).get();
    if (!memberSnap.exists || memberSnap.data()?.active !== true) {
      throw new HttpsError('permission-denied', 'Acesso negado. Membro inativo ou inexistente.');
    }

    // Read auditoria doc
    const auditoriaSnap = await db.doc(`auditoria-geral/${labId}/auditorias/${auditoriaId}`).get();
    if (!auditoriaSnap.exists) {
      throw new HttpsError('not-found', 'Auditoria nao encontrada.');
    }
    const auditoriaData = auditoriaSnap.data() as Record<string, unknown>;

    // Read respostas subcollection
    const respostasSnap = await db
      .collection(`auditoria-geral/${labId}/auditorias/${auditoriaId}/respostas`)
      .get();
    const respostas: Resposta[] = respostasSnap.docs.map(d => parseResposta(d.data() as Record<string, unknown>));

    // Read lab info
    const labSnap = await db.doc(`labs/${labId}`).get();
    const labName = labDisplayName(labSnap.data() as Record<string, unknown> | undefined);

    logger.info('generateAuditoriaGeralPDF', { labId, auditoriaId, respostasCount: respostas.length });

    const pdfBuffer = await buildPdfBuffer(labName, auditoriaData, respostas);
    const pdf = pdfBuffer.toString('base64');

    return { pdf };
  },
);
