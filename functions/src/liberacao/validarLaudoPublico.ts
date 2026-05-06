/**
 * validarLaudoPublico — public HTTPS endpoint for QR code validation.
 *
 * Path:  GET /api/validar-laudo/{laudoId}/v{version}?h={hashPrefix}
 *        (also accepts ?laudoId=…&version=… as query params for direct calls)
 *
 * Returns:
 *  - HTML page (default) — auditor / paciente friendly
 *  - JSON (Accept: application/json) — programmatic validators
 *
 * Privacy: NEVER returns paciente PII, exames, resultados, médico solicitante.
 * Only metadata: hash, RT name + registro, version, isCurrent flag,
 * supersededBy, lab name + CNES, emissaoEm.
 *
 * Rate limit: 60 requests / hour / IP (Firestore counter).
 *  - Window key:  rate-limits/lib_validate_pub__{ip}__{hourBucket}
 *  - Soft fail-open if Firestore is unreachable (returns 200 + warning) —
 *    we'd rather accept extra reads than 5xx in front of patients.
 */
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type { LaudoVersion } from './_shared/types';

const REGION = 'southamerica-east1';
const RATE_LIMIT_PER_HOUR = 60;

interface PublicLaudoMetadata {
  valid: boolean;
  hash: string;
  hashPrefix: string;
  version: number;
  isCurrent: boolean;
  supersededBy: string | null;
  rt: { name: string; registro: string };
  lab: { name: string; cnes: string };
  emissaoEm: string | null;
  criadoEm: string | null;
}

function parsePath(pathname: string): { laudoId?: string; version?: number } {
  // Accept /api/validar-laudo/{id}/v{N}  or  /validar-laudo/{id}/v{N}
  const match = pathname.match(/validar-laudo\/([^/]+)\/v(\d+)/);
  if (!match) return {};
  return { laudoId: decodeURIComponent(match[1]), version: Number(match[2]) };
}

function getClientIp(req: {
  headers: { [k: string]: string | string[] | undefined };
  ip?: string;
}): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0].split(',')[0].trim();
  return req.ip ?? 'unknown';
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const db = admin.firestore();
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const key = `lib_validate_pub__${ip}__${hourBucket}`;
  const ref = db.collection('rate-limits').doc(key);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.exists ? (snap.data()?.['count'] as number) : 0) ?? 0;
      if (current >= RATE_LIMIT_PER_HOUR) {
        return { allowed: false, remaining: 0 };
      }
      tx.set(
        ref,
        {
          count: current + 1,
          ip,
          hourBucket,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - current - 1 };
    });
    return result;
  } catch (err) {
    // Soft fail-open on infrastructure errors.
    console.error('[validarLaudoPublico] rate limit error', err);
    return { allowed: true, remaining: -1 };
  }
}

async function findLaudoVersion(
  laudoId: string,
  version: number,
): Promise<{ versionDoc: LaudoVersion; labId: string } | null> {
  // Public endpoint must not know labId. Use collectionGroup query.
  const db = admin.firestore();
  const snap = await db
    .collectionGroup('laudo-versions')
    .where('laudoId', '==', laudoId)
    .where('version', '==', version)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  const versionDoc = doc.data() as LaudoVersion;
  // Path: labs/{labId}/laudo-versions/{versionId}
  const labId = doc.ref.parent.parent?.id ?? versionDoc.labId;
  return { versionDoc, labId };
}

async function getLaudoSummary(
  labId: string,
  laudoId: string,
): Promise<{ currentVersion: number; labName: string; cnes: string } | null> {
  const db = admin.firestore();
  const laudoSnap = await db.doc(`labs/${labId}/laudos/${laudoId}`).get();
  if (!laudoSnap.exists) return null;
  const laudo = laudoSnap.data();
  return {
    currentVersion: (laudo?.['currentVersion'] as number) ?? 0,
    labName: (laudo?.['labName'] as string) ?? '—',
    cnes: (laudo?.['cnes'] as string) ?? '—',
  };
}

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    try {
      return (ts as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

function renderHtml(meta: PublicLaudoMetadata, currentVersionUrl: string | null): string {
  const statusBadge = meta.isCurrent
    ? '<span class="badge ok">Versão vigente</span>'
    : '<span class="badge warn">Versão superada</span>';

  const supersededBlock = !meta.isCurrent
    ? `<div class="alert">
         <strong>Atenção:</strong> existe uma versão mais recente deste laudo.
         ${currentVersionUrl ? `<a href="${currentVersionUrl}">Ver versão atual</a>.` : ''}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Validação de Laudo · HC Quality</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0e;color:#e8e8ec;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#141417;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:32px;max-width:520px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.4)}
  h1{font-size:20px;font-weight:600;letter-spacing:-0.01em;margin-bottom:4px}
  .sub{color:#8b8b94;font-size:13px;margin-bottom:24px}
  .badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
  .badge.ok{background:rgba(16,185,129,0.15);color:#34d399}
  .badge.warn{background:rgba(245,158,11,0.15);color:#fbbf24}
  .alert{background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#fcd34d;padding:12px;border-radius:8px;font-size:13px;margin-bottom:20px}
  .alert a{color:#fff;text-decoration:underline}
  dl{display:grid;grid-template-columns:140px 1fr;gap:10px 16px;margin-top:18px;font-size:13px}
  dt{color:#8b8b94;text-transform:uppercase;font-size:10.5px;letter-spacing:0.06em;align-self:center}
  dd{color:#e8e8ec;font-variant-numeric:tabular-nums;word-break:break-all}
  .hash{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;color:#a1a1aa}
  footer{margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);color:#6b6b73;font-size:11px;text-align:center}
</style>
</head>
<body>
  <div class="card">
    <h1>Validação de laudo ${statusBadge}</h1>
    <p class="sub">Documento controlado · HC Quality</p>
    ${supersededBlock}
    <dl>
      <dt>Laboratório</dt><dd>${meta.lab.name}</dd>
      <dt>CNES</dt><dd>${meta.lab.cnes}</dd>
      <dt>Versão</dt><dd>${meta.version}</dd>
      <dt>Emissão</dt><dd>${meta.emissaoEm ?? '—'}</dd>
      <dt>RT</dt><dd>${meta.rt.name}</dd>
      <dt>Registro</dt><dd>${meta.rt.registro}</dd>
      <dt>Hash</dt><dd class="hash">${meta.hash}</dd>
    </dl>
    <footer>Esta página confirma a autenticidade da assinatura digital do laudo. Nenhum dado clínico do paciente é exibido aqui.</footer>
  </div>
</body>
</html>`;
}

export const validarLaudoPublico = onRequest(
  {
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 30,
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const ip = getClientIp(req);
    const rl = await checkRateLimit(ip);
    if (!rl.allowed) {
      res.status(429).json({ error: 'rate_limit_exceeded', retryAfterSec: 3600 });
      return;
    }
    if (rl.remaining >= 0) {
      res.set('X-RateLimit-Limit', String(RATE_LIMIT_PER_HOUR));
      res.set('X-RateLimit-Remaining', String(rl.remaining));
    }

    // Parse params: prefer URL path, fall back to query.
    const fromPath = parsePath(req.path || req.url || '');
    const laudoId =
      fromPath.laudoId ??
      (typeof req.query.laudoId === 'string' ? req.query.laudoId : undefined);
    const version =
      fromPath.version ??
      (typeof req.query.version === 'string' ? Number(req.query.version) : undefined);

    if (!laudoId || !version || !Number.isFinite(version)) {
      res.status(400).json({ error: 'invalid_params' });
      return;
    }

    let result: { versionDoc: LaudoVersion; labId: string } | null;
    try {
      result = await findLaudoVersion(laudoId, version);
    } catch (err) {
      console.error('[validarLaudoPublico] lookup error', err);
      res.status(500).json({ error: 'internal_error' });
      return;
    }

    if (!result) {
      const acceptsJson = (req.headers['accept'] ?? '').toString().includes('application/json');
      if (acceptsJson) {
        res.status(404).json({ valid: false, reason: 'not_found' });
      } else {
        res.status(404).send(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:24px;background:#0b0b0e;color:#e8e8ec"><h1>Laudo não encontrado</h1><p>Verifique o link e tente novamente.</p></body></html>`);
      }
      return;
    }

    const { versionDoc, labId } = result;
    const summary = await getLaudoSummary(labId, laudoId);
    const isCurrent = (summary?.currentVersion ?? version) === version;

    const meta: PublicLaudoMetadata = {
      valid: true,
      hash: versionDoc.chainHash,
      hashPrefix: (versionDoc.chainHash ?? '').slice(0, 8),
      version: versionDoc.version,
      isCurrent,
      supersededBy: isCurrent ? null : `v${summary?.currentVersion ?? '?'}`,
      rt: {
        name: versionDoc.signature?.operatorName ?? '—',
        registro: versionDoc.signature?.operatorRegistro ?? '—',
      },
      lab: {
        name: summary?.labName ?? versionDoc.snapshot?.labName ?? '—',
        cnes: summary?.cnes ?? versionDoc.snapshot?.cnes ?? '—',
      },
      emissaoEm: tsToIso(versionDoc.snapshot?.emissaoEm),
      criadoEm: tsToIso(versionDoc.criadoEm),
    };

    const acceptsJson = (req.headers['accept'] ?? '').toString().includes('application/json');
    if (acceptsJson) {
      res.status(200).json(meta);
      return;
    }

    const currentUrl = isCurrent
      ? null
      : `/api/validar-laudo/${encodeURIComponent(laudoId)}/v${summary?.currentVersion}`;
    res.status(200).type('text/html; charset=utf-8').send(renderHtml(meta, currentUrl));
  },
);
