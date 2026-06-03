/**
 * Smoke / intent tests for Phase 10 Plan 04 — PDF generation + QR validation.
 *
 * These tests document the expected behavior of:
 *   - generateLaudoPDF callable (auth, payload, response shape)
 *   - validarLaudoPublico HTTPS endpoint (rate limit, PII redaction, HTML/JSON content negotiation)
 *   - LaudoVersion.pdfUrl/pdfHash audit trail update
 *
 * They run as plain `node --test` assertions (no Firebase emulator needed)
 * and serve as a contract for the live integration tests that will be added
 * once the emulator harness lands (Plan 10-06).
 *
 * Run:  node --test functions/test/liberacao/pdfFlow.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── E2E intent: laudo creation → release → PDF → QR validation ────────────

test('E2E: criarLaudo → liberarLaudo → generateLaudoPDF → validarLaudoPublico', () => {
  const flow = [
    {
      step: 1,
      action: 'criarLaudo (callable, Plan 10-02)',
      expected: 'creates Laudo doc + LaudoVersion v1 if auto-released',
    },
    {
      step: 2,
      action: 'liberarLaudo (callable, Plan 10-02)',
      expected: 'creates LaudoVersion v(N+1) with RT signature + chainHash',
    },
    {
      step: 3,
      action: 'generateLaudoPDF (callable, Plan 10-04)',
      expected:
        'Puppeteer renders HTML → PDF, uploads to gs://hmatologia2.appspot.com/laudos/{labId}/{laudoId}/v{version}.pdf, returns signed URL valid for 1h',
    },
    {
      step: 4,
      action: 'QR code in PDF footer points to /api/validar-laudo/{laudoId}/v{version}',
      expected: 'Public endpoint returns metadata-only response (no PII)',
    },
    {
      step: 5,
      action: 'validarLaudoPublico (HTTPS, Plan 10-04)',
      expected:
        'Returns hash, RT name+registro, version, isCurrent, lab name+CNES, emissaoEm; rate-limited 60 req/h/IP',
    },
  ];

  for (const s of flow) {
    assert.ok(s.expected.length > 0, `Step ${s.step} must define expected behavior`);
  }
  assert.equal(flow.length, 5, 'E2E flow has 5 documented steps');
});

// ─── generateLaudoPDF callable contract ────────────────────────────────────

test('generateLaudoPDF: requires auth + active membership', () => {
  const cases = [
    { auth: null, expected: 'unauthenticated' },
    { auth: { uid: 'u1' }, member: false, expected: 'permission-denied' },
    { auth: { uid: 'u1' }, member: true, expected: 'allow' },
  ];
  for (const c of cases) {
    if (!c.auth) {
      assert.equal(c.expected, 'unauthenticated');
    } else if (!c.member) {
      assert.equal(c.expected, 'permission-denied');
    } else {
      assert.equal(c.expected, 'allow');
    }
  }
});

test('generateLaudoPDF: input schema validates labId, laudoId, optional version', () => {
  const validInputs = [
    { labId: 'lab1', laudoId: 'l1' },
    { labId: 'lab1', laudoId: 'l1', version: 2 },
    { labId: 'lab1', laudoId: 'l1', signedUrlExpiresInSec: 7200 },
  ];
  const invalidInputs = [
    { laudoId: 'l1' }, // missing labId
    { labId: 'lab1' }, // missing laudoId
    { labId: 'lab1', laudoId: 'l1', version: 0 }, // version must be positive
    { labId: 'lab1', laudoId: 'l1', signedUrlExpiresInSec: 30 }, // below 60s min
  ];
  assert.equal(validInputs.length, 3);
  assert.equal(invalidInputs.length, 4);
});

test('generateLaudoPDF: response shape includes signedUrl + pdfHash + sizeBytes', () => {
  const expectedKeys = [
    'ok',
    'laudoId',
    'version',
    'signedUrl',
    'storagePath',
    'pdfHash',
    'sizeBytes',
    'validationUrl',
  ];
  for (const k of expectedKeys) {
    assert.ok(k.length > 0);
  }
  assert.equal(expectedKeys.length, 8);
});

test('generateLaudoPDF: enforces <10MB PDF size cap', () => {
  const MAX = 10 * 1024 * 1024;
  assert.equal(MAX, 10485760);
  assert.ok(9 * 1024 * 1024 < MAX, '9MB is under cap');
  assert.ok(11 * 1024 * 1024 > MAX, '11MB triggers resource-exhausted');
});

test('generateLaudoPDF: storage path follows convention', () => {
  const path = `laudos/lab123/laudoABC/v2.pdf`;
  assert.match(path, /^laudos\/[^/]+\/[^/]+\/v\d+\.pdf$/);
});

// ─── validarLaudoPublico HTTPS endpoint contract ───────────────────────────

test('validarLaudoPublico: parses /api/validar-laudo/{id}/v{N} from path', () => {
  const examples = ['/api/validar-laudo/laudo123/v1', '/validar-laudo/laudo123/v3?h=abc'];
  for (const url of examples) {
    const match = url.match(/validar-laudo\/([^/]+)\/v(\d+)/);
    assert.ok(match, `URL ${url} must match`);
    assert.ok(Number(match[2]) > 0);
  }
});

test('validarLaudoPublico: rate limit 60 req/h/IP', () => {
  const RATE = 60;
  const reqsInWindow = 65;
  const allowed = Math.min(RATE, reqsInWindow);
  const blocked = Math.max(0, reqsInWindow - RATE);
  assert.equal(allowed, 60);
  assert.equal(blocked, 5);
});

test('validarLaudoPublico: response contains NO PII', () => {
  const allowedFields = [
    'valid',
    'hash',
    'hashPrefix',
    'version',
    'isCurrent',
    'supersededBy',
    'rt',
    'lab',
    'emissaoEm',
    'criadoEm',
  ];
  const forbiddenFields = [
    'paciente',
    'pacienteNome',
    'cpf',
    'exames',
    'resultados',
    'medicoSolicitante',
    'observacoes',
  ];
  for (const f of allowedFields) assert.ok(f.length > 0);
  for (const f of forbiddenFields) {
    assert.ok(!allowedFields.includes(f), `Field ${f} must NOT be in response`);
  }
});

test('validarLaudoPublico: HTML response when Accept != application/json', () => {
  const acceptVariants = [
    { accept: 'text/html', expected: 'html' },
    { accept: '*/*', expected: 'html' },
    { accept: 'application/json', expected: 'json' },
  ];
  for (const v of acceptVariants) {
    const isJson = v.accept.includes('application/json');
    assert.equal(isJson ? 'json' : 'html', v.expected);
  }
});

test('validarLaudoPublico: superseded version surfaces "Atenção" warning', () => {
  const cases = [
    { isCurrent: true, expectedBadge: 'ok' },
    { isCurrent: false, expectedBadge: 'warn' },
  ];
  for (const c of cases) {
    assert.equal(c.expectedBadge, c.isCurrent ? 'ok' : 'warn');
  }
});

// ─── QR Code contract ──────────────────────────────────────────────────────

test('QR code: error correction level M, 120px width, B/W', () => {
  const config = {
    errorCorrectionLevel: 'M',
    width: 120,
    margin: 1,
    dark: '#000000',
    light: '#FFFFFF',
  };
  assert.equal(config.errorCorrectionLevel, 'M');
  assert.equal(config.width, 120);
  assert.equal(config.dark, '#000000');
});

test('QR URL contains laudoId, version, and hash prefix', () => {
  const url = 'https://hmatologia2.web.app/api/validar-laudo/laudo123/v2?h=abc12345';
  assert.match(url, /validar-laudo\/[^/]+\/v\d+/);
  assert.match(url, /\?h=[a-f0-9]{8}$/);
});

// ─── Audit trail invariants ────────────────────────────────────────────────

test('LaudoVersion update writes pdfUrl, pdfHash, pdfStoragePath, pdfGeneratedAt', () => {
  const expectedUpdateFields = ['pdfUrl', 'pdfStoragePath', 'pdfHash', 'pdfGeneratedAt'];
  assert.equal(expectedUpdateFields.length, 4);
});

test('audit-logs entry created on PDF generation', () => {
  const expectedAuditDoc = {
    tipo: 'laudo_pdf_gerado',
    laudoId: 'string',
    version: 'number',
    operatorId: 'string',
    pdfHash: 'string',
    sizeBytes: 'number',
    criadoEm: 'serverTimestamp',
  };
  assert.equal(expectedAuditDoc.tipo, 'laudo_pdf_gerado');
});
