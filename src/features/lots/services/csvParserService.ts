import { z } from 'zod';
import { ANALYTES } from '../../../constants';
import type { ManufacturerStats } from '../../../types';

// ─── Analyte name synonyms ────────────────────────────────────────────────────

/**
 * Maps alternative names / abbreviations → canonical analyte ID.
 * All keys must be lowercase with non-alphanumeric chars stripped.
 */
const ANALYTE_SYNONYMS: Record<string, string> = {
  // WBC
  wbc: 'WBC', leucocitos: 'WBC', leucocytes: 'WBC', leukocytes: 'WBC',
  // RBC
  rbc: 'RBC', eritrocitos: 'RBC', erythrocytes: 'RBC', hemacias: 'RBC',
  // HGB
  hgb: 'HGB', hb: 'HGB', hemoglobina: 'HGB', hemoglobin: 'HGB', haemoglobin: 'HGB',
  // HCT
  hct: 'HCT', ht: 'HCT', hematocrito: 'HCT', hematocrit: 'HCT', haematocrit: 'HCT',
  // MCV
  mcv: 'MCV',
  // MCH
  mch: 'MCH',
  // MCHC
  mchc: 'MCHC',
  // PLT
  plt: 'PLT', plaquetas: 'PLT', platelets: 'PLT', thrombocytes: 'PLT', trombocitos: 'PLT',
  // RDW
  rdw: 'RDW', rdwcv: 'RDW',
  // MPV
  mpv: 'MPV',
  // PCT
  pct: 'PCT',
  // PDW
  pdw: 'PDW',
  // Differentials # (absolute counts — the only tracked form)
  // All common column names from manufacturer CSVs resolve to the # variant.
  neu: 'NEU#', neua: 'NEU#', neuabs: 'NEU#', neuhash: 'NEU#',
  neutrophils: 'NEU#', neutrofilos: 'NEU#', neutrophilsabs: 'NEU#',
  lym: 'LYM#', lyma: 'LYM#', lymabs: 'LYM#', lymhash: 'LYM#',
  lymphocytes: 'LYM#', linfocitos: 'LYM#', lymphocytesabs: 'LYM#',
  mon: 'MON#', mona: 'MON#', monabs: 'MON#', monhash: 'MON#',
  monocytes: 'MON#', monocitos: 'MON#', monocytesabs: 'MON#',
  eos: 'EOS#', eosa: 'EOS#', eosabs: 'EOS#', eoshash: 'EOS#',
  eosinophils: 'EOS#', eosinofilos: 'EOS#', eosinophilsabs: 'EOS#',
  bas: 'BAS#', basa: 'BAS#', basabs: 'BAS#', bashash: 'BAS#', baso: 'BAS#',
  basophils: 'BAS#', basofilos: 'BAS#', basophilsabs: 'BAS#',
};

/** Normalises a raw cell value for synonym lookup */
function normaliseKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Returns canonical analyte ID from a raw name string, or null if unknown. */
function resolveAnalyteId(raw: string): string | null {
  const key = normaliseKey(raw);
  if (ANALYTE_SYNONYMS[key]) return ANALYTE_SYNONYMS[key];

  // Direct match against known analytes (id or display name)
  const direct = ANALYTES.find(
    (a) => normaliseKey(a.id) === key || normaliseKey(a.name) === key,
  );
  return direct?.id ?? null;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ParsedStatSchema = z.object({
  analyteId: z.string(),
  mean:      z.number().positive(),
  sd:        z.number().nonnegative(),
});

export type ParsedStat = z.infer<typeof ParsedStatSchema>;

export interface ParsedCSVResult {
  lotNumber:   string | null;
  controlName: string | null;
  level:       1 | 2 | 3 | null;
  expiryDate:  Date | null;
  stats:       ParsedStat[];
  /** Non-fatal messages describing skipped rows or format issues. */
  warnings:    string[];
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/** Splits CSV text into rows of cells, stripping surrounding quotes. */
function parseCSVRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line.split(',').map((cell) =>
        cell.trim().replace(/^"(.*)"$/s, '$1').trim(),
      ),
    )
    .filter((row) => row.some((c) => c !== ''));
}

/** Parses a date string in common formats → Date, or null. */
function parseDate(raw: string): Date | null {
  if (!raw) return null;

  // MM/YYYY → last day of that month
  const mmyyyy = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmyyyy) {
    const m = parseInt(mmyyyy[1], 10);
    const y = parseInt(mmyyyy[2], 10);
    return new Date(y, m, 0); // day 0 of next month = last day of current
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw);

  // DD/MM/YYYY (Brazilian)
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return new Date(parseInt(br[3], 10), parseInt(br[2], 10) - 1, parseInt(br[1], 10));
  }

  return null;
}

/** Parses a numeric string, accepting commas as decimal separators. */
function parseNum(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parses a hematology control CSV (Bio-Rad Difftrol or compatible) into
 * structured lot data. Handles both single-level and multi-level formats.
 *
 * @param text         Raw CSV text
 * @param targetLevel  Which level to extract from a multi-level file (default: 1)
 */
export function parseControlLotCSV(
  text: string,
  targetLevel?: 1 | 2 | 3,
): ParsedCSVResult {
  const rows = parseCSVRows(text);
  const result: ParsedCSVResult = {
    lotNumber:   null,
    controlName: null,
    level:       null,
    expiryDate:  null,
    stats:       [],
    warnings:    [],
  };

  // ── Metadata scan ──────────────────────────────────────────────────────────

  for (const row of rows) {
    const label = row[0] ?? '';
    const val   = row[1] ?? '';

    if (/lot.?n[úu]mero|lot.?number|lote/i.test(label)) {
      result.lotNumber = val || null;
    } else if (/control.?name|nome.*controle|controle/i.test(label)) {
      result.controlName = val || null;
    } else if (/expir|validade|vencimento/i.test(label)) {
      result.expiryDate = parseDate(val);
    } else if (/^n[íi]vel$|^level$/i.test(label.trim())) {
      const lv = parseInt(val, 10);
      if (lv >= 1 && lv <= 3) result.level = lv as 1 | 2 | 3;
    }
  }

  // ── Find header row ────────────────────────────────────────────────────────

  let headerIdx = -1;
  let meanCol   = -1;
  let sdCol     = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const norm = row.map((c) => c.toLowerCase());

    const hasAnalyteCol = /analyte|analito|test[e]?|param/i.test(row[0] ?? '');
    const hasMeanCol    = norm.some((c) => c === 'mean' || c === 'média' || c === 'media');

    if (!hasAnalyteCol || !hasMeanCol) continue;

    headerIdx = i;

    // Check if multi-level: "Level 1 Mean", "Nivel 2 Mean", etc.
    const isMultiLevel = norm.some((c) => /level\s*[123]|n[íi]vel\s*[123]/i.test(c));

    if (isMultiLevel) {
      const tl = targetLevel ?? result.level ?? 1;
      for (let j = 1; j < row.length; j++) {
        const cell = norm[j];
        if (new RegExp(`(level|n[íi]vel)\\s*${tl}`, 'i').test(cell)) {
          if (cell.includes('mean') || cell.includes('m') && cell.includes('dia')) {
            meanCol = j;
            sdCol   = j + 1; // SD is expected to immediately follow Mean
          }
        }
      }
      if (meanCol === -1) {
        result.warnings.push(
          `Nível ${tl} não encontrado. Usando primeiro nível disponível.`,
        );
        // Fallback to first mean column
        for (let j = 1; j < row.length; j++) {
          if (norm[j] === 'mean' || norm[j].includes('mean')) {
            meanCol = j;
            sdCol   = j + 1;
            break;
          }
        }
      }
    } else {
      // Single-level: find mean and SD columns by header label
      for (let j = 0; j < row.length; j++) {
        const cell = norm[j];
        if (meanCol === -1 && (cell === 'mean' || cell === 'média' || cell === 'media')) {
          meanCol = j;
        } else if (sdCol === -1 && (cell === 'sd' || cell === 'dp' || cell.startsWith('desvio'))) {
          sdCol = j;
        }
      }
    }

    break;
  }

  // ── Validate header was found ──────────────────────────────────────────────

  if (headerIdx === -1 || meanCol === -1 || sdCol === -1) {
    result.warnings.push(
      'Formato não reconhecido. Verifique se o CSV contém colunas de Analito, Mean e SD.',
    );
    return result;
  }

  // ── Parse data rows ────────────────────────────────────────────────────────

  const skipped: string[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawName = row[0] ?? '';
    if (!rawName.trim()) continue;

    const analyteId = resolveAnalyteId(rawName);
    if (!analyteId) {
      skipped.push(rawName);
      continue;
    }

    const mean = parseNum(row[meanCol] ?? '');
    const sd   = parseNum(row[sdCol]   ?? '');

    if (mean === null || sd === null) {
      result.warnings.push(`Valores inválidos para "${rawName}" — linha ignorada.`);
      continue;
    }

    const validated = ParsedStatSchema.safeParse({ analyteId, mean, sd });
    if (validated.success) {
      result.stats.push(validated.data);
    }
  }

  if (skipped.length > 0) {
    const preview = skipped.slice(0, 6).join(', ');
    const extra   = skipped.length > 6 ? ` +${skipped.length - 6}` : '';
    result.warnings.push(`Analitos não reconhecidos: ${preview}${extra}`);
  }

  if (result.stats.length === 0) {
    result.warnings.push(
      'Nenhum analito extraído. Confira se o CSV usa nomes compatíveis e colunas Mean/SD.',
    );
  }

  return result;
}

/** Converts ParsedStat[] to ManufacturerStats for persistence. */
export function statsToManufacturerStats(stats: ParsedStat[]): ManufacturerStats {
  return Object.fromEntries(
    stats.map(({ analyteId, mean, sd }) => [analyteId, { mean, sd }]),
  );
}
