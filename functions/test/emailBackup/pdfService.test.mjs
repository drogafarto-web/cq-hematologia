/**
 * Testes automatizados do gerador de backup PDF.
 *
 * Usa o test runner built-in do Node 20 (`node --test`). Não adiciona
 * dependências — requer apenas que `functions/lib/` esteja compilado.
 *
 * Observação: PDFs não são comparados byte-a-byte porque o pdfkit embute
 * timestamps. Em vez disso, verifica propriedades observáveis do buffer
 * (tamanho, marcadores binários, texto extraível via pattern matching
 * leve) e invariantes de comportamento (determinismo do hash, watermark
 * em não-produção, ausência de erro em edge cases).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { makeReport } from './fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..');

const { generateBackupPdf, computeContentHash } = await import(
  pathToFileURL(path.join(FUNCTIONS_DIR, 'lib/modules/emailBackup/services/pdfService.js')).href
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Localiza cada `stream ... endstream` no Buffer e devolve a fatia bruta.
 * Trabalha em Buffer direto (não em string) — preserva bytes binários
 * para inflação posterior via zlib.
 */
function findPdfStreams(buffer) {
  const streams = [];
  // Delimitador com newline inicial para evitar casar com o sufixo de "endstream\n".
  const startTag = Buffer.from('\nstream\n', 'latin1');
  const endTag = Buffer.from('\nendstream', 'latin1');
  let idx = 0;
  while (idx < buffer.length) {
    const s = buffer.indexOf(startTag, idx);
    if (s === -1) break;
    const dataStart = s + startTag.length;
    const e = buffer.indexOf(endTag, dataStart);
    if (e === -1) break;
    streams.push(buffer.subarray(dataStart, e));
    idx = e + endTag.length;
  }
  return streams;
}

/**
 * Converte uma hex string `<4865...>` em texto WinAnsi / Latin-1.
 * pdfkit escreve texto em content streams assim:
 *   [<4865...> 10 <55> 0] TJ
 * Cada par hex é um byte (WinAnsi, que coincide com Latin-1 na faixa imprimível).
 */
function decodeHexString(hex) {
  const cleaned = hex.replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i + 1 < cleaned.length; i += 2) {
    const byte = parseInt(cleaned.slice(i, i + 2), 16);
    if (!Number.isFinite(byte)) continue;
    out += String.fromCharCode(byte);
  }
  return out;
}

/** Extrai strings textuais de um PDF (streams + metadata). Best-effort. */
function extractPdfText(buffer) {
  let decoded = '';
  for (const s of findPdfStreams(buffer)) {
    try {
      decoded += zlib.inflateSync(s).toString('latin1') + '\n';
    } catch {
      // stream sem FlateDecode ou com filtro desconhecido — ignora
    }
  }

  // Extrai cada chamada de `[...] TJ`. Dentro do array, concatena os <hex>
  // sem separador — pdfkit quebra glifos com `characterSpacing` em hex
  // individuais intercalados com números de kerning, e juntar sem espaço
  // reconstitui a palavra original. Os números são ignorados.
  const tjArrays = [];
  const arrayRegex = /\[([^\]]*)\]\s*TJ/g;
  let am;
  while ((am = arrayRegex.exec(decoded)) !== null) {
    const inner = am[1];
    const hexRegex = /<([0-9A-Fa-f\s]+)>/g;
    let piece = '';
    let hm;
    while ((hm = hexRegex.exec(inner)) !== null) {
      piece += decodeHexString(hm[1]);
    }
    tjArrays.push(piece);
  }

  // Também hex strings soltas com `Tj` (texto sem kerning fine-grained).
  const looseHex = [];
  const looseHexRegex = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
  let lhm;
  while ((lhm = looseHexRegex.exec(decoded)) !== null) {
    looseHex.push(decodeHexString(lhm[1]));
  }

  // Literais `(texto) Tj` — usados em metadata UTF-16BE (Title/Subject).
  const combinedRaw = decoded + '\n' + buffer.toString('latin1');
  const literalRegex = /\(((?:\\.|[^\\()])*)\)/g;
  const literals = [];
  let lm;
  while ((lm = literalRegex.exec(combinedRaw)) !== null) {
    const esc = lm[1]
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
    if (esc.startsWith('\xfe\xff')) {
      const buf = Buffer.from(esc, 'latin1').subarray(2);
      literals.push(buf.swap16().toString('utf16le'));
    } else {
      literals.push(esc);
    }
  }

  return [...tjArrays, ...looseHex, ...literals].join(' ');
}

async function render(opts, envOverride) {
  const prevEnv = process.env.HCQ_ENVIRONMENT;
  if (envOverride !== undefined) process.env.HCQ_ENVIRONMENT = envOverride;
  try {
    const base = makeReport(opts);
    const report = { ...base, contentHash: computeContentHash(base) };
    return { buffer: await generateBackupPdf(report), report };
  } finally {
    if (envOverride !== undefined) {
      if (prevEnv === undefined) delete process.env.HCQ_ENVIRONMENT;
      else process.env.HCQ_ENVIRONMENT = prevEnv;
    }
  }
}

// ─── Core rendering ───────────────────────────────────────────────────────────

describe('generateBackupPdf — core rendering', () => {
  test('produz um Buffer com cabeçalho PDF válido', async () => {
    const { buffer } = await render({ full: true }, 'production');
    assert.ok(Buffer.isBuffer(buffer), 'resolved value deve ser Buffer');
    assert.equal(buffer.slice(0, 4).toString(), '%PDF', 'deve começar com %PDF');
    assert.ok(buffer.length > 5000, `buffer muito pequeno (${buffer.length}) — render incompleto?`);
    assert.ok(buffer.length < 500_000, `buffer anormalmente grande (${buffer.length})`);
  });

  test('contém título principal e seções esperadas', async () => {
    const { buffer } = await render({ full: true, multi: true }, 'production');
    const text = extractPdfText(buffer);
    assert.match(text, /Backup de Dados/);
    assert.match(text, /Relatório de Redundância/);
    assert.match(text, /Integridade e Autenticidade/);
    assert.match(text, /SHA-256 DO CONTEÚDO/);
  });

  test('emite campo de laboratório quando FULL', async () => {
    const { buffer } = await render({ full: true }, 'production');
    const text = extractPdfText(buffer);
    assert.match(text, /LabClin Rio Pomba MG/);
    assert.match(text, /12\.345\.678\/0001-90/);
    assert.match(text, /Dra\. Maria da Silva/);
    assert.match(text, /CRBM-MG 1234/);
    assert.match(text, /012345\/2026/);
  });

  test('destaca gaps quando campos regulatórios ausentes', async () => {
    const { buffer } = await render({ full: false }, 'production');
    const text = extractPdfText(buffer);
    assert.match(text, /não cadastrad[oa]/, 'deve marcar campos ausentes');
    assert.match(text, /Gaps de cadastro/, 'deve mostrar banner de gap');
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('computeContentHash — determinismo', () => {
  test('mesmo fixture produz hash idêntico em duas execuções', () => {
    const a = makeReport({ full: true, multi: true });
    const b = makeReport({ full: true, multi: true });
    assert.equal(computeContentHash(a), computeContentHash(b));
  });

  test('mudança em uma corrida produz hash diferente', () => {
    const a = makeReport({ full: true });
    const b = makeReport({ full: true });
    b.sections[0].rows[0].Conformidade = 'NÃO CONFORME';
    assert.notEqual(computeContentHash(a), computeContentHash(b));
  });
});

// ─── Environment watermark ────────────────────────────────────────────────────

describe('watermark de ambiente', () => {
  test('produção não contém marcações de homologação', async () => {
    const { buffer } = await render({ full: true }, 'production');
    const text = extractPdfText(buffer);
    assert.doesNotMatch(text, /HOMOLOGAÇÃO/);
    assert.doesNotMatch(text, /DOCUMENTO DE HOMOLOGAÇÃO/);
    assert.doesNotMatch(text, /\[HOMOLOGAÇÃO\]/);
  });

  test('staging marca watermark, banner e prefixo no hash', async () => {
    const { buffer } = await render({ full: true }, 'staging');
    const text = extractPdfText(buffer);
    assert.match(text, /HOMOLOGAÇÃO/, 'watermark diagonal deve aparecer');
    assert.match(text, /DOCUMENTO DE HOMOLOGAÇÃO/, 'banner de topo deve aparecer');
    assert.match(text, /\[HOMOLOGAÇÃO\]/, 'hash deve ser prefixado');
  });

  test('staging gera PDF maior que produção (watermark por página)', async () => {
    const prod = await render({ full: true }, 'production');
    const stg = await render({ full: true }, 'staging');
    assert.ok(
      stg.buffer.length > prod.buffer.length,
      `staging (${stg.buffer.length}) deve ser maior que prod (${prod.buffer.length}) por causa do watermark em cada página`,
    );
  });
});

// ─── Pagination & edge cases ──────────────────────────────────────────────────

describe('paginação', () => {
  test('fixture grande (40 corridas) renderiza sem erro e produz continuação', async () => {
    const { buffer } = await render({ full: true, runCount: 40 }, 'production');
    const text = extractPdfText(buffer);
    assert.match(text, /\(continuação\)/, 'deve emitir cabeçalho de continuação na quebra');
    assert.ok(buffer.length > 15_000, 'buffer grande esperado para 40 corridas');
  });

  test('multi-módulo produz sumário "NESTE RELATÓRIO"', async () => {
    const { buffer } = await render({ full: true, multi: true }, 'production');
    const text = extractPdfText(buffer);
    assert.match(text, /NESTE RELATÓRIO/);
    assert.match(text, /Hematologia/);
    assert.match(text, /Imunologia/);
  });

  test('módulo único não emite sumário', async () => {
    const { buffer } = await render({ full: true, multi: false }, 'production');
    const text = extractPdfText(buffer);
    assert.doesNotMatch(text, /NESTE RELATÓRIO/);
  });
});

describe('edge cases', () => {
  test('sem seções e sem alertas não quebra (apenas capa)', async () => {
    const base = makeReport({ empty: true });
    base.contentHash = computeContentHash(base);
    const buffer = await generateBackupPdf(base);
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.slice(0, 4).toString(), '%PDF');
    const text = extractPdfText(buffer);
    assert.match(text, /Backup de Dados/);
  });

  test('sem alertas operacionais, stat grid mostra zero', async () => {
    const { buffer } = await render({ full: true, alerts: false }, 'production');
    const text = extractPdfText(buffer);
    assert.match(text, /ALERTAS OPERACIONAIS/);
    assert.doesNotMatch(text, /alerta\(s\) operacional\(is\) detectado/);
  });
});

// ─── Regression guards ───────────────────────────────────────────────────────

describe('regressões corrigidas', () => {
  test('arrow U+2192 não aparece no PDF (substituído por en-dash)', async () => {
    const { buffer } = await render({ full: true }, 'production');
    const text = extractPdfText(buffer);
    // U+2192 renderiza "mal" em Helvetica/WinAnsi — garantimos que não é usado
    assert.doesNotMatch(text, /\u2192/);
  });

  test('símbolo infinito U+221E não aparece em badges (substituído por texto)', async () => {
    // Fixture padrão tem alerta critical de Hematologia com daysSinceLastRun=Infinity
    const { buffer } = await render({ full: true, multi: true }, 'production');
    const text = extractPdfText(buffer);
    assert.doesNotMatch(text, /\u221e/);
    assert.match(text, /SEM CORRIDAS NO PERÍODO/, 'badge deve usar texto explícito');
  });

  test('Registro profissional do operador aparece na linha secondary', async () => {
    const { buffer } = await render({ full: true }, 'production');
    const text = extractPdfText(buffer);
    assert.match(text, /Reg\.:/, 'label "Reg." deve aparecer na linha secundária');
    assert.match(text, /CRBM-MG 1234/);
  });
});
