/**
 * ec_gerarCertificado — Fase 9 (PDF + QR + Storage).
 *
 * Gera um PDF de certificado para (colaborador, treinamento, execução,
 * avaliacaoCompetencia) — exige avaliação de competência com resultado
 * `aprovado`. Upload PDF no Storage + grava doc Certificado com URL de
 * download e payload do QR apontando para o endpoint HTTP público
 * `validarCertificadoEc`.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import * as QRCode from 'qrcode';

import { assertEcAccess, ecCollection, ensureEcLabRoot } from './validators';

const GerarCertificadoInputSchema = z.object({
  labId: z.string().min(1),
  avaliacaoCompetenciaId: z.string().min(1),
});

interface GerarCertificadoResult {
  ok: true;
  certificadoId: string;
  pdfDownloadUrl: string;
  qrCodePayload: string;
}

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'hmatologia2';
const REGION = 'southamerica-east1';
const BASE_VALIDATE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/validarCertificadoEc`;

export const ec_gerarCertificado = onCall<unknown, Promise<GerarCertificadoResult>>(
  {},
  async (request) => {
    const parsed = GerarCertificadoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, avaliacaoCompetenciaId } = parsed.data;

    await assertEcAccess(request.auth, labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    // Lê avaliacao + execucao + colaborador + treinamento
    const avRef = ecCollection(db, labId, 'avaliacoesCompetencia').doc(avaliacaoCompetenciaId);
    const avSnap = await avRef.get();
    if (!avSnap.exists) throw new HttpsError('not-found', 'Avaliação de competência não encontrada.');
    const av = avSnap.data()!;
    if (av['resultado'] !== 'aprovado') {
      throw new HttpsError(
        'failed-precondition',
        'Certificado só pode ser gerado para avaliação com resultado "aprovado".',
      );
    }

    const execSnap = await ecCollection(db, labId, 'execucoes').doc(av['execucaoId'] as string).get();
    const exec = execSnap.data()!;
    const colaboradorSnap = await ecCollection(db, labId, 'colaboradores')
      .doc(av['colaboradorId'] as string)
      .get();
    const colaborador = colaboradorSnap.data()!;
    const treinamentoSnap = await ecCollection(db, labId, 'treinamentos')
      .doc(exec['treinamentoId'] as string)
      .get();
    const treinamento = treinamentoSnap.data()!;

    // Fase 10: para tipo='capacitacao_externa' o colaborador já traz
    // certificado externo anexado ao treinamento — gerar certificado interno
    // não se aplica (semântica diferente, evita duplicidade documental).
    // Fallback 'periodico' preserva comportamento de docs antigos.
    const tipoTreinamento = (treinamento['tipo'] ?? 'periodico') as string;
    if (tipoTreinamento === 'capacitacao_externa') {
      throw new HttpsError(
        'failed-precondition',
        'Treinamento de capacitação externa já tem certificado anexado pelo colaborador — geração interna não se aplica.',
      );
    }

    // Config certificado (opcional)
    const configSnap = await db.doc(`educacaoContinuada/${labId}/certificadoConfig/config`).get();
    const config = configSnap.exists ? configSnap.data()! : null;

    // Lab name: se config não tem, fallback pra nome do lab via docs/labs/{labId}
    let nomeDoLab = (config?.['nomeDoLab'] as string | undefined) ?? '';
    if (!nomeDoLab) {
      const labSnap = await db.doc(`labs/${labId}`).get();
      nomeDoLab = (labSnap.data()?.['name'] as string | undefined) ?? labId;
    }
    const textoRodape = (config?.['textoRodape'] as string | undefined)
      ?? 'Este certificado comprova a participação e aprovação no treinamento indicado, conforme RDC 978/2025 e ISO 15189:2022.';

    await ensureEcLabRoot(db, labId);

    // Doc do certificado — gera ID antes (precisamos pro path do QR e Storage)
    const certRef = ecCollection(db, labId, 'certificados').doc();
    const qrCodePayload = `${BASE_VALIDATE_URL}?lab=${encodeURIComponent(labId)}&cert=${encodeURIComponent(certRef.id)}`;

    // Gera QR code PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrCodePayload, {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 1,
      width: 220,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    // Gera PDF buffer
    const pdfBuffer = await buildCertificadoPdf({
      nomeColaborador: colaborador['nome'] as string,
      cargoColaborador: colaborador['cargo'] as string,
      tituloTreinamento: treinamento['titulo'] as string,
      cargaHoraria: treinamento['cargaHoraria'] as number,
      dataAplicacao: (exec['dataAplicacao'] as admin.firestore.Timestamp | null)?.toDate() ?? null,
      nomeDoLab,
      textoRodape,
      certificadoId: certRef.id,
      qrBuffer,
    });

    // Upload Storage
    const storage = admin.storage().bucket();
    const path = `educacaoContinuada/${labId}/certificados/${certRef.id}.pdf`;
    const file = storage.file(path);
    await file.save(pdfBuffer, { contentType: 'application/pdf', public: false });
    // Signed URL de longa duração (1 ano) — renovação via callable posterior se expirar
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const [downloadUrl] = await file.getSignedUrl({ action: 'read', expires: expiresAt });

    // Grava certificado
    await certRef.set({
      labId,
      colaboradorId: av['colaboradorId'],
      treinamentoId: exec['treinamentoId'],
      execucaoId: av['execucaoId'],
      avaliacaoCompetenciaId,
      qrCodePayload,
      pdfStoragePath: path,
      pdfDownloadUrl: downloadUrl,
      emitidoEm: admin.firestore.FieldValue.serverTimestamp(),
      geradoPor: uid,
    });

    db.collection('auditLogs')
      .add({
        action: 'EC_GERAR_CERTIFICADO',
        callerUid: uid,
        labId,
        payload: {
          certificadoId: certRef.id,
          colaboradorId: av['colaboradorId'],
          treinamentoId: exec['treinamentoId'],
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    return { ok: true, certificadoId: certRef.id, pdfDownloadUrl: downloadUrl, qrCodePayload };
  },
);

// ─── PDF builder ─────────────────────────────────────────────────────────────

interface PdfParams {
  nomeColaborador: string;
  cargoColaborador: string;
  tituloTreinamento: string;
  cargaHoraria: number;
  dataAplicacao: Date | null;
  nomeDoLab: string;
  textoRodape: string;
  certificadoId: string;
  qrBuffer: Buffer;
}

async function buildCertificadoPdf(p: PdfParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // Lab header
    doc.fontSize(14).fillColor('#64748b').text(p.nomeDoLab, { align: 'center' });
    doc.moveDown(0.5);

    // Título
    doc.fontSize(36).fillColor('#0f172a').text('Certificado de Treinamento', { align: 'center' });
    doc.moveDown(1);

    // Corpo
    doc.fontSize(14).fillColor('#334155');
    doc.text('Certificamos que', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .fontSize(28)
      .fillColor('#065f46')
      .text(p.nomeColaborador, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#64748b').text(`(${p.cargoColaborador})`, { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#334155');
    doc.text('concluiu e foi aprovado no treinamento', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .fontSize(20)
      .fillColor('#0f172a')
      .text(p.tituloTreinamento, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#64748b');
    const dataStr = p.dataAplicacao
      ? p.dataAplicacao.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';
    doc.text(`Carga horária: ${p.cargaHoraria}h · Data: ${dataStr}`, { align: 'center' });

    // Rodapé: texto + ID + QR
    doc.moveDown(3);
    const footerY = doc.page.height - 160;

    // QR à esquerda
    doc.image(p.qrBuffer, 50, footerY, { width: 90, height: 90 });
    doc
      .fontSize(8)
      .fillColor('#64748b')
      .text('Validar em:', 50, footerY + 95, { width: 100 });
    doc
      .fontSize(7)
      .fillColor('#64748b')
      .text(`ID: ${p.certificadoId}`, 50, footerY + 108, { width: 160 });

    // Texto rodapé centrado
    doc
      .fontSize(10)
      .fillColor('#334155')
      .text(p.textoRodape, 170, footerY + 20, {
        width: doc.page.width - 240,
        align: 'center',
      });

    doc.end();
  });
}
