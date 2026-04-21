// ─── Insumos Module — validateFR10 HTTP endpoint ─────────────────────────────
//
// Endpoint HTTP público lido pelo auditor via QR code impresso no FR-10.
// Recebe `?lab={labId}&hash={hash}`, faz lookup em `labs/{labId}/fr10-emissions/
// {hash}` e responde com HTML amigável — "este hash foi emitido em X por Y
// para período Z" OU "hash não encontrado".
//
// Não autenticado por design: o QR está num PDF físico que qualquer auditor
// pode receber. A validação **não revela dados sensíveis** — só metadados da
// emissão (lab, módulo, equipamento, período, emissor, contagem de linhas).
// Conteúdo das movimentações não é exposto.
//
// Rate limiting: não implementado no MVP — Firebase Functions tem proteções
// built-in contra abuso em endpoints não-autenticados.

import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(ts: admin.firestore.Timestamp | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fmtDateOnly(ts: admin.firestore.Timestamp | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function fmtModulo(m: string): string {
  switch (m) {
    case 'hematologia':
      return 'Hematologia';
    case 'coagulacao':
      return 'Coagulação';
    case 'uroanalise':
      return 'Uroanálise';
    case 'imunologia':
      return 'Imunologia';
    default:
      return m;
  }
}

// ─── HTML templates ──────────────────────────────────────────────────────────

const PAGE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(180deg, #0B0F14 0%, #151d2a 100%);
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    line-height: 1.5;
  }
  .card {
    max-width: 520px;
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge-ok {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #86efac;
  }
  .badge-fail {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
  h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 16px 0 4px;
    letter-spacing: -0.02em;
  }
  .subtitle {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 24px;
  }
  .field {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 13px;
  }
  .field:last-child { border-bottom: none; }
  .field-label {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 500;
  }
  .field-value {
    color: rgba(255, 255, 255, 0.9);
    word-break: break-word;
  }
  .hash {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    word-break: break-all;
  }
  .footer {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    line-height: 1.6;
  }
`;

function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)} — Validação FR-10</title>
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <div class="card">
    ${body}
  </div>
</body>
</html>`;
}

function renderNotFound(labId: string, hash: string): string {
  return htmlShell(
    'Hash não encontrado',
    `
    <div class="badge badge-fail">✕ Não encontrado</div>
    <h1>Hash não registrado</h1>
    <p class="subtitle">Este FR-10 não foi emitido pelo laboratório informado.</p>

    <div class="field">
      <div class="field-label">Laboratório</div>
      <div class="field-value">${escapeHtml(labId)}</div>
    </div>
    <div class="field">
      <div class="field-label">Hash consultado</div>
      <div class="field-value hash">${escapeHtml(hash)}</div>
    </div>

    <div class="footer">
      Possíveis causas: (a) o hash no QR foi alterado, (b) o PDF é de
      outro laboratório, (c) a emissão foi deletada indevidamente.
      Entre em contato com a Gerência da Qualidade do laboratório emissor.
    </div>
    `,
  );
}

interface EmissionDoc {
  hash: string;
  labId: string;
  labName: string;
  labCnpj?: string;
  modulo: string;
  equipamento: string;
  periodoInicio: admin.firestore.Timestamp;
  periodoFim: admin.firestore.Timestamp;
  emittedAt: admin.firestore.Timestamp;
  lastPrintedAt: admin.firestore.Timestamp;
  emittedByUid: string;
  emittedByName: string;
  rowCount: number;
}

function renderFound(data: EmissionDoc): string {
  const cnpj = data.labCnpj ? `<div class="field">
    <div class="field-label">CNPJ</div>
    <div class="field-value">${escapeHtml(data.labCnpj)}</div>
  </div>` : '';

  return htmlShell(
    `FR-10 válido — ${data.labName}`,
    `
    <div class="badge badge-ok">✓ Emissão autêntica</div>
    <h1>FR-10 registrado</h1>
    <p class="subtitle">Hash confere com a base de dados do laboratório emissor.</p>

    <div class="field">
      <div class="field-label">Laboratório</div>
      <div class="field-value">${escapeHtml(data.labName)}</div>
    </div>
    ${cnpj}
    <div class="field">
      <div class="field-label">Módulo</div>
      <div class="field-value">${escapeHtml(fmtModulo(data.modulo))}</div>
    </div>
    <div class="field">
      <div class="field-label">Equipamento</div>
      <div class="field-value">${escapeHtml(data.equipamento)}</div>
    </div>
    <div class="field">
      <div class="field-label">Período</div>
      <div class="field-value">${fmtDateOnly(data.periodoInicio)} – ${fmtDateOnly(data.periodoFim)}</div>
    </div>
    <div class="field">
      <div class="field-label">Emissor</div>
      <div class="field-value">${escapeHtml(data.emittedByName)}</div>
    </div>
    <div class="field">
      <div class="field-label">Emitido em</div>
      <div class="field-value">${fmtDate(data.emittedAt)}</div>
    </div>
    <div class="field">
      <div class="field-label">Linhas</div>
      <div class="field-value">${data.rowCount}</div>
    </div>
    <div class="field">
      <div class="field-label">Hash SHA-256</div>
      <div class="field-value hash">${escapeHtml(data.hash)}</div>
    </div>

    <div class="footer">
      Este endpoint valida a autenticidade da emissão contra a base de
      dados do laboratório. Não expõe dados de movimentações individuais —
      para auditoria completa, solicite o relatório à Gerência da Qualidade.
      <br><br>
      Compliance: RDC 978/2025 Art.128 · ISO 15189:2022 · PALC 2021/2025 ·
      MP 2.200-2/2001 art. 4.
    </div>
    `,
  );
}

function renderBadRequest(reason: string): string {
  return htmlShell(
    'Requisição inválida',
    `
    <div class="badge badge-fail">✕ Parâmetros inválidos</div>
    <h1>Requisição inválida</h1>
    <p class="subtitle">${escapeHtml(reason)}</p>

    <div class="footer">
      Este endpoint espera <code>?lab=&lt;labId&gt;&amp;hash=&lt;sha256&gt;</code>.
      O QR do FR-10 normalmente traz esses parâmetros já preenchidos.
    </div>
    `,
  );
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * GET /validateFR10?lab={labId}&hash={hash}
 *
 * Respostas:
 *   200 + HTML: encontrado
 *   404 + HTML: hash não existe
 *   400 + HTML: parâmetros inválidos
 *   500 + HTML: erro interno (loga via logger)
 */
export const validateFR10 = onRequest(
  {
    region: 'southamerica-east1',
    memory: '256MiB',
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    // Apenas GET — evita side effects em POST/PUT.
    if (req.method !== 'GET') {
      res.status(405).type('text/html; charset=utf-8').send(
        renderBadRequest('Método HTTP não permitido — use GET.'),
      );
      return;
    }

    const lab = typeof req.query.lab === 'string' ? req.query.lab : '';
    const hash = typeof req.query.hash === 'string' ? req.query.hash : '';

    if (!lab || !hash) {
      res.status(400).type('text/html; charset=utf-8').send(
        renderBadRequest('Parâmetros obrigatórios: lab e hash.'),
      );
      return;
    }

    // Guard de formato — SHA-256 hex tem 64 caracteres, só [0-9a-f].
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      res.status(400).type('text/html; charset=utf-8').send(
        renderBadRequest('Hash inválido — deve ser SHA-256 hex de 64 caracteres.'),
      );
      return;
    }

    // Guard de labId — alfanumérico + hífen/underscore, máx 100 chars.
    // Evita path traversal via `../` e injection via caracteres especiais.
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(lab)) {
      res.status(400).type('text/html; charset=utf-8').send(
        renderBadRequest('Identificador de laboratório inválido.'),
      );
      return;
    }

    try {
      const db = admin.firestore();
      const snap = await db.doc(`labs/${lab}/fr10-emissions/${hash}`).get();

      if (!snap.exists) {
        logger.info('[validateFR10] not found', { lab, hashPrefix: hash.slice(0, 12) });
        res.status(404).type('text/html; charset=utf-8').send(renderNotFound(lab, hash));
        return;
      }

      const data = snap.data() as EmissionDoc;
      logger.info('[validateFR10] ok', {
        lab,
        hashPrefix: hash.slice(0, 12),
        emittedByUid: data.emittedByUid,
      });
      res.status(200).type('text/html; charset=utf-8').send(renderFound(data));
    } catch (err) {
      logger.error('[validateFR10] internal error', {
        lab,
        hashPrefix: hash.slice(0, 12),
        err: err instanceof Error ? err.message : String(err),
      });
      res.status(500).type('text/html; charset=utf-8').send(
        renderBadRequest('Erro interno ao consultar a base de dados. Tente novamente.'),
      );
    }
  },
);
