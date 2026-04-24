/**
 * validarCertificadoEc — Fase 9 endpoint HTTP público.
 *
 * URL: `https://southamerica-east1-<project>.cloudfunctions.net/validarCertificadoEc?lab=<labId>&cert=<certId>`
 * Consumido pelo QR impresso no certificado PDF — qualquer um com a URL
 * (e portanto com o PDF em mãos) valida a autenticidade.
 *
 * Retorna HTML simples server-rendered. Dados mínimos: nome do colaborador,
 * nome do treinamento, data, lab. Não expõe detalhes sensíveis (assinatura,
 * gabarito, outras avaliações).
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const validarCertificadoEc = onRequest(
  { cors: true },
  async (req, res) => {
    const labId = String(req.query['lab'] ?? '').trim();
    const certId = String(req.query['cert'] ?? '').trim();

    if (!labId || !certId) {
      res.status(400).send(renderErrorHtml('Parâmetros inválidos', 'Faltam "lab" ou "cert".'));
      return;
    }

    const db = admin.firestore();

    try {
      const certSnap = await db
        .doc(`educacaoContinuada/${labId}/certificados/${certId}`)
        .get();

      if (!certSnap.exists) {
        res.status(404).send(renderErrorHtml('Certificado não encontrado', `ID ${certId} não existe neste laboratório.`));
        return;
      }

      const cert = certSnap.data()!;

      const [colSnap, treinSnap, execSnap] = await Promise.all([
        db.doc(`educacaoContinuada/${labId}/colaboradores/${cert['colaboradorId']}`).get(),
        db.doc(`educacaoContinuada/${labId}/treinamentos/${cert['treinamentoId']}`).get(),
        db.doc(`educacaoContinuada/${labId}/execucoes/${cert['execucaoId']}`).get(),
      ]);

      const configSnap = await db.doc(`educacaoContinuada/${labId}/certificadoConfig/config`).get();
      const nomeDoLab = (configSnap.data()?.['nomeDoLab'] as string | undefined)
        ?? ((await db.doc(`labs/${labId}`).get()).data()?.['name'] as string | undefined)
        ?? labId;

      const dataEmissao = (cert['emitidoEm'] as admin.firestore.Timestamp | undefined)?.toDate();
      const dataAplicacao = (execSnap.data()?.['dataAplicacao'] as admin.firestore.Timestamp | null | undefined)?.toDate();

      const html = renderSuccessHtml({
        certificadoId: certId,
        nomeColaborador: (colSnap.data()?.['nome'] as string | undefined) ?? '—',
        cargoColaborador: (colSnap.data()?.['cargo'] as string | undefined) ?? '—',
        tituloTreinamento: (treinSnap.data()?.['titulo'] as string | undefined) ?? '—',
        cargaHoraria: (treinSnap.data()?.['cargaHoraria'] as number | undefined) ?? 0,
        dataEmissao,
        dataAplicacao,
        nomeDoLab,
      });

      // Cache de 10min pra resposta idempotente
      res.set('Cache-Control', 'public, max-age=600');
      res.status(200).send(html);
    } catch (err) {
      console.error('[validarCertificadoEc]', err);
      res.status(500).send(renderErrorHtml('Erro interno', 'Não foi possível consultar o certificado.'));
    }
  },
);

// ─── HTML templates ──────────────────────────────────────────────────────────

interface SuccessParams {
  certificadoId: string;
  nomeColaborador: string;
  cargoColaborador: string;
  tituloTreinamento: string;
  cargaHoraria: number;
  dataEmissao: Date | undefined;
  dataAplicacao: Date | undefined;
  nomeDoLab: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: Date | undefined): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function renderSuccessHtml(p: SuccessParams): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Certificado válido · ${escapeHtml(p.nomeDoLab)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; }
    main { max-width: 720px; margin: 48px auto; padding: 32px; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(15,23,42,0.1); }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-weight: 600; font-size: 14px; }
    h1 { margin: 20px 0 8px; font-size: 28px; }
    .sub { color: #64748b; font-size: 14px; margin-bottom: 32px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 12px 20px; margin: 0; padding: 24px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; align-self: center; }
    dd { margin: 0; font-weight: 500; }
    .strong { font-size: 18px; color: #0f172a; }
    footer { margin-top: 24px; font-size: 12px; color: #94a3b8; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <div class="badge">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Certificado válido
    </div>
    <h1>${escapeHtml(p.nomeColaborador)}</h1>
    <p class="sub">${escapeHtml(p.cargoColaborador)} · Emitido por <strong>${escapeHtml(p.nomeDoLab)}</strong></p>

    <dl>
      <dt>Treinamento</dt><dd class="strong">${escapeHtml(p.tituloTreinamento)}</dd>
      <dt>Carga horária</dt><dd>${p.cargaHoraria}h</dd>
      <dt>Data do treinamento</dt><dd>${fmtDate(p.dataAplicacao)}</dd>
      <dt>Data de emissão</dt><dd>${fmtDate(p.dataEmissao)}</dd>
    </dl>

    <footer>
      ID do certificado: <code>${escapeHtml(p.certificadoId)}</code>
      <br>Verificação realizada em ${new Date().toLocaleString('pt-BR')}
      <br>RDC 978/2025 · ISO 15189:2022
    </footer>
  </main>
</body>
</html>`;
}

function renderErrorHtml(titulo: string, mensagem: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    body { margin: 0; font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; }
    main { max-width: 560px; margin: 48px auto; padding: 32px; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(15,23,42,0.1); text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px; background: #fef2f2; color: #991b1b; font-weight: 600; font-size: 14px; }
    h1 { margin: 20px 0 8px; font-size: 24px; }
    p { color: #475569; margin: 0; }
  </style>
</head>
<body>
  <main>
    <div class="badge">⚠ Certificado inválido</div>
    <h1>${escapeHtml(titulo)}</h1>
    <p>${escapeHtml(mensagem)}</p>
  </main>
</body>
</html>`;
}
