/**
 * Test script — Multi-level bula extraction with Pentra fallback
 * Usage:
 *   GEMINI_API_KEY=<your-key> node test-bula-extraction.mjs <path-to-pdf> [equipment-name]
 */

import { readFileSync, writeFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const pdfPath = process.argv[2];
const equipName = process.argv[3] ?? 'Yumizen H550';

if (!apiKey) {
  console.error('❌  Set GEMINI_API_KEY env var.');
  process.exit(1);
}
if (!pdfPath) {
  console.error('❌  Pass PDF path as first argument.');
  process.exit(1);
}

// ─── Analyte IDs ──────────────────────────────────────────────────────────────

const ANALYTE_IDS = [
  'WBC',
  'RBC',
  'HGB',
  'HCT',
  'MCV',
  'MCH',
  'MCHC',
  'PLT',
  'RDW',
  'MPV',
  'PCT',
  'PDW',
  'NEU',
  'LYM',
  'MON',
  'EOS',
  'BAS',
  'NEU#',
  'LYM#',
  'MON#',
  'EOS#',
].join(', ');

// ─── Prompt ───────────────────────────────────────────────────────────────────

const PROMPT = `
Você é um especialista em interpretar bulas de controles hematológicos.
Este documento contém tabelas para MUITOS equipamentos (30+). Extraia dados APENAS para "${equipName}".

PASSO 1 — Encontre a tabela rotulada exatamente "${equipName}".
PASSO 2 — Para cada nível (Nível I, II, III):
  - Identifique o número do lote (ex: HHI-1339)
  - Extraia Média e DP de cada analito
PASSO 3 — Fallback: se um analito não constar em "${equipName}", busque em "Pentra ES 60" ou "Pentra 60".
  Declare o equipamento em equipmentSource.

Analitos aceitos: ${ANALYTE_IDS}

Mapeamento de nomes da bula → IDs do sistema:
Hemácias→RBC, Leucócitos→WBC, Hemoglobina→HGB, Hematócrito→HCT,
Plaquetas→PLT, Neutrófilos%→NEU, Neutrófilos#→NEU#,
Linfócitos%→LYM, Linfócitos#→LYM#, Monócitos%→MON, Monócitos#→MON#,
Eosinófilos%→EOS, Eosinófilos#→EOS#, Basófilos%→BAS

Regras:
- Use apenas IDs exatos listados acima.
- Inclua só analitos com Média E DP legíveis (ignore células com "*" sem DP).
- Nunca invente valores.

Retorne JSON EXATO:
{
  "controlName": "<nome ou null>",
  "expiryDate": "<YYYY-MM-DD ou null>",
  "equipmentName": "${equipName}",
  "levels": [
    {
      "level": 1,
      "lotNumber": "<ex: HHI-1339>",
      "analytes": [
        { "analyteId": "<id>", "mean": 0.0, "sd": 0.0, "equipmentSource": "<equipamento>" }
      ]
    }
  ]
}
`.trim();

// ─── Call Gemini with retry across models ─────────────────────────────────────

async function callGemini(base64) {
  const client = new GoogleGenAI({ apiKey });
  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`    [${model}] attempt ${attempt}...`);
        const response = await client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: PROMPT },
                { inlineData: { mimeType: 'application/pdf', data: base64 } },
              ],
            },
          ],
          config: { responseMimeType: 'application/json' },
        });
        console.log(`    ✅  Success with ${model}`);
        return { model, text: response.text ?? '' };
      } catch (err) {
        const msg = err.message ?? String(err);
        const is503 =
          msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
        const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
        if (is503 && attempt < 3) {
          const wait = attempt * 8000;
          console.log(`    ⏳  503 overloaded — waiting ${wait / 1000}s...`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (is429) {
          console.log(`    ⚠️   429 quota exhausted for ${model} — trying next model`);
          break;
        }
        console.log(`    ❌  Error on ${model}: ${msg.slice(0, 120)}`);
        break;
      }
    }
  }
  throw new Error('All models failed.');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📄  Reading: ${pdfPath}`);
  const pdfBytes = readFileSync(pdfPath);
  const base64 = pdfBytes.toString('base64');
  console.log(`    ${(pdfBytes.length / 1024).toFixed(1)} KB\n`);

  console.log(`🤖  Extracting "${equipName}" from bula...`);
  const t0 = Date.now();
  const { model, text: rawText } = await callGemini(base64);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`    Done in ${elapsed}s (model: ${model})\n`);

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error('❌  Failed to parse JSON:');
    console.error(rawText.slice(0, 800));
    process.exit(1);
  }

  // ─── Display ────────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════');
  console.log(`  Control   : ${parsed.controlName ?? '(not found)'}`);
  console.log(`  Expiry    : ${parsed.expiryDate ?? '(not found)'}`);
  console.log(`  Equipment : ${parsed.equipmentName ?? '(not found)'}`);
  console.log(`  Levels    : ${parsed.levels?.length ?? 0}`);
  console.log('═══════════════════════════════════════════════════\n');

  for (const lvl of parsed.levels ?? []) {
    const primary = lvl.analytes.filter((a) => a.equipmentSource === equipName);
    const fallback = lvl.analytes.filter((a) => a.equipmentSource !== equipName);

    console.log(`  ▸ Level ${lvl.level} — Lot: ${lvl.lotNumber}`);
    console.log(
      `    ${lvl.analytes.length} analytes  (${primary.length} primary · ${fallback.length} fallback)\n`,
    );

    if (primary.length) {
      console.log(`    ✅  ${equipName}:`);
      for (const a of primary) {
        console.log(`        ${a.analyteId.padEnd(6)}  mean=${a.mean}  sd=${a.sd}`);
      }
    }
    if (fallback.length) {
      console.log('');
      console.log('    ⚠️   Fallback:');
      for (const a of fallback) {
        console.log(
          `        ${a.analyteId.padEnd(6)}  mean=${a.mean}  sd=${a.sd}  ← ${a.equipmentSource}`,
        );
      }
    }
    console.log('');
  }

  // ─── Save JSON ──────────────────────────────────────────────────────────────

  const outPath = pdfPath.replace(/\.pdf$/i, '_extraction_result.json');
  writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf-8');
  console.log(`💾  Saved: ${outPath}`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
