/**
 * generateEquipamentoReport — PDF resumo do equipamento (cadastro, calibração,
 * manutenções agendadas, uso últimos 30 dias).
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
  equipamentoId: z.string().min(1),
});

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

async function buildEquipamentoPdfBuffer(params: {
  equipLabel: string;
  cadastroLines: string[];
  calibracaoLines: string[];
  manutencaoLines: string[];
  usoLines: string[];
}): Promise<Buffer> {
  const { equipLabel, cadastroLines, calibracaoLines, manutencaoLines, usoLines } = params;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    doc.fontSize(14).font('Helvetica-Bold').text('Relatório do equipamento', { align: 'center' });
    doc.moveDown(0.35);
    doc.fontSize(10).font('Helvetica').text(equipLabel, { align: 'center' });
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
          doc.moveDown(0.3);
        }
      }
      doc.moveDown(0.6);
    };

    section('Cadastro', cadastroLines);
    section('Calibração', calibracaoLines);
    section('Manutenções agendadas', manutencaoLines);
    section('Histórico de uso (últimos 30 dias)', usoLines);

    doc.end();
  });
}

export const generateEquipamentoReport = onCall<unknown, Promise<{ url: string }>>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ url: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, equipamentoId } = parsed.data;
    const uid = request.auth.uid;
    const token = request.auth.token as Record<string, unknown> | undefined;

    await assertActiveLabMemberOrSuperAdmin(uid, labId, token);

    const eqRef = db.collection('labs').doc(labId).collection('equipamentos').doc(equipamentoId);
    const eqSnap = await eqRef.get();
    if (!eqSnap.exists) {
      throw new HttpsError('not-found', 'Equipamento não encontrado.');
    }
    const e = eqSnap.data() ?? {};

    const equipLabel = `${safeStr(e['name'])} · ${safeStr(e['modelo'])}`;

    const cadastroLines = [
      `Nome: ${safeStr(e['name'])}`,
      `Modelo: ${safeStr(e['modelo'])}`,
      `Fabricante: ${safeStr(e['fabricante'])}`,
      `Módulo: ${safeStr(e['module'])}`,
      `Status: ${safeStr(e['status'])}`,
      `Nº série: ${safeStr(e['numeroSerie'])}`,
      `Registro ANVISA: ${safeStr(e['registroAnvisa'])}`,
      `Observações: ${safeStr(e['observacoes'])}`,
    ];

    const prox = e['proximaCalibracao'];
    const proxStr = prox ? tsToDate(prox).toLocaleDateString('pt-BR') : '—';
    const certUrl =
      typeof e['certificadoCalibracaoUrl'] === 'string' && e['certificadoCalibracaoUrl'].length > 0
        ? (e['certificadoCalibracaoUrl'] as string)
        : '';
    const calibracaoLines = [
      `Próxima calibração: ${proxStr}`,
      certUrl ? `Certificado (URL): ${certUrl}` : 'Certificado (URL): —',
    ];

    const manSnap = await eqRef
      .collection('manutencoes')
      .orderBy('dataPrevista', 'desc')
      .limit(80)
      .get();

    const manutencaoLines: string[] = [];
    for (const d of manSnap.docs) {
      const m = d.data();
      if (m['status'] !== 'agendada') continue;
      const prev = tsToDate(m['dataPrevista']).toLocaleDateString('pt-BR');
      const tipo = safeStr(m['tipo']);
      const desc = safeStr(m['descricao']);
      const resp = safeStr(m['responsavelNome']);
      manutencaoLines.push(`${prev} · ${tipo} · ${resp} — ${desc}`);
    }
    if (manutencaoLines.length === 0) {
      manutencaoLines.push('Nenhuma manutenção com status agendada.');
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

    const usoSnap = await eqRef.collection('usos').orderBy('inicio', 'desc').limit(80).get();

    const usoLines: string[] = [];
    let usoCount = 0;
    for (const d of usoSnap.docs) {
      const u = d.data();
      const inicio = u['inicio'];
      const inicioTs =
        inicio instanceof admin.firestore.Timestamp
          ? inicio
          : admin.firestore.Timestamp.fromDate(tsToDate(inicio));
      if (inicioTs < cutoffTs) continue;
      if (usoCount >= 30) break;
      usoCount += 1;
      const iniStr = inicioTs.toDate().toLocaleString('pt-BR');
      const fimRaw = u['fim'];
      const fimStr = fimRaw != null ? tsToDate(fimRaw).toLocaleString('pt-BR') : '— (em aberto)';
      const op = safeStr(u['operadorNome']);
      usoLines.push(`${iniStr} → ${fimStr} · ${op}`);
    }
    if (usoLines.length === 0) {
      usoLines.push('Nenhum registro de uso nos últimos 30 dias.');
    }

    const pdfBuffer = await buildEquipamentoPdfBuffer({
      equipLabel,
      cadastroLines,
      calibracaoLines,
      manutencaoLines,
      usoLines,
    });

    const bucket = admin.storage().bucket();
    const objectPath = `labs/${labId}/reports/equipamento-${equipamentoId}-${Date.now()}.pdf`;
    const file = bucket.file(objectPath);

    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      public: false,
      metadata: {
        metadata: {
          labId,
          equipamentoId,
          kind: 'equipamento-report',
          firebaseStorageDownloadTokens: crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      },
    });

    // Use download token instead of getSignedUrl (avoids iam.serviceAccounts.signBlob permission)
    const [metadata] = await file.getMetadata();
    const downloadToken = metadata?.metadata?.firebaseStorageDownloadTokens;
    const bucketName = bucket.name;
    const encodedPath = encodeURIComponent(objectPath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    logger.info('generateEquipamentoReport ok', { labId, equipamentoId });

    return { url };
  },
);
