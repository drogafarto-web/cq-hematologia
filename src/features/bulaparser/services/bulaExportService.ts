import type { PendingBulaData } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_BULA_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Form data ────────────────────────────────────────────────────────────────

export interface BulaExportFormData {
  equipmentName: string;
  serialNumber: string;
  startDate: string; // YYYY-MM-DD (HTML date input format)
}

export const DEFAULT_EXPORT_FORM: BulaExportFormData = {
  equipmentName: 'Yumizen H550',
  serialNumber: '',
  startDate: '',
};

// ─── Synonym safety-net ───────────────────────────────────────────────────────
// Maps alternate analyteId forms → canonical IDs used by this app (constants.ts).
// Sorted longest-first so longer patterns can't be shadowed by shorter substrings.

const SYNONYM_MAP: [string, string][] = (
  [
    // Full Portuguese names
    ['hemoglobina', 'HGB'],
    ['hematocrito', 'HCT'],
    ['hemacias', 'RBC'],
    ['leucocitos', 'WBC'],
    ['plaquetas', 'PLT'],
    ['neutrofilos', 'NEU#'],
    ['linfocitos', 'LYM#'],
    ['monocitos', 'MON#'],
    ['eosinofilos', 'EOS#'],
    ['basofilos', 'BAS#'],
    // 4-char combos — must come before 3-char substrings
    ['mchc', 'MCHC'],
    // Compound RDW/PDW variants — map both to single tracked analyte
    ['rdw-cv', 'RDW'],
    ['rdw-sd', 'RDW'],
    ['pdw-cv', 'PDW'],
    ['pdw-sd', 'PDW'],
    ['rdwcv', 'RDW'],
    ['rdwsd', 'RDW'],
    ['pdwcv', 'PDW'],
    ['pdwsd', 'PDW'],
    // Differentials with hash — explicit to avoid stripping '#'
    ['neu#', 'NEU#'],
    ['lym#', 'LYM#'],
    ['mon#', 'MON#'],
    ['eos#', 'EOS#'],
    ['bas#', 'BAS#'],
    // 3-char codes
    ['mch', 'MCH'],
    ['mcv', 'MCV'],
    ['mpv', 'MPV'],
    ['pct', 'PCT'],
    ['pdw', 'PDW'],
    ['rdw', 'RDW'],
    ['wbc', 'WBC'],
    ['rbc', 'RBC'],
    ['hgb', 'HGB'],
    ['hct', 'HCT'],
    ['plt', 'PLT'],
    // 2-char codes
    ['hb', 'HGB'],
    ['ht', 'HCT'],
  ] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalises a raw string for synonym lookup. Keeps '#' for differentials. */
function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9#]/g, '');
}

/**
 * Resolves an analyteId to the app's canonical form via SYNONYM_MAP.
 * Returns the input unchanged if no match is found (Gemini should have
 * already canonicalized it — this is a safety net only).
 */
export function resolveAnalyteIdSafe(raw: string): string {
  const key = normalizeKey(raw);
  for (const [synonym, canonical] of SYNONYM_MAP) {
    if (key === normalizeKey(synonym)) return canonical;
  }
  return raw;
}

/**
 * Cleans a numeric value for CSV output.
 * - Replaces comma decimal separator with period.
 * - Maps missing/N/A/dash values to '0'.
 */
export function cleanValue(v: string | number | undefined | null): string {
  if (v === null || v === undefined) return '0';
  const str = String(v).trim();
  if (!str || str.toUpperCase() === 'N/A' || str === '-') return '0';
  return str.replace(',', '.');
}

// ─── CSV generation ───────────────────────────────────────────────────────────

/**
 * Converts extracted bula data + form metadata into a two-block CSV string:
 *
 * ```
 * // Info
 * level,lotNumber,controlName,equipmentName,serialNumber,expiryDate,startDate
 * 1,...
 * 2,...
 * 3,...
 *
 * // Stats
 * analyteId,mean_level1,sd_level1,mean_level2,sd_level2,mean_level3,sd_level3
 * RBC,...
 * ```
 *
 * This format is consumed by `parseMultiLevelLotCsv()` in csvParserService.
 */
export function convertBulaPDFtoCSV(data: PendingBulaData, form: BulaExportFormData): string {
  const { levels, controlName, expiryDate } = data;

  const expiryStr = expiryDate ? expiryDate.toISOString().split('T')[0] : '';

  // ── // Info block ──────────────────────────────────────────────────────────

  const infoHeader = 'level,lotNumber,controlName,equipmentName,serialNumber,expiryDate,startDate';

  const infoRows = levels.map((lvl) =>
    [
      lvl.level,
      lvl.lotNumber ?? '',
      controlName ?? '',
      form.equipmentName,
      form.serialNumber,
      expiryStr,
      form.startDate,
    ].join(','),
  );

  // ── // Stats block ─────────────────────────────────────────────────────────

  // Collect all unique analyteIds across levels, normalized to canonical form.
  // Preserve insertion order so the CSV rows match declaration order where possible.
  const seen = new Set<string>();
  const allAnalyteIds: string[] = [];

  for (const lvl of levels) {
    for (const rawId of Object.keys(lvl.manufacturerStats)) {
      const canonical = resolveAnalyteIdSafe(rawId);
      if (!seen.has(canonical)) {
        seen.add(canonical);
        allAnalyteIds.push(canonical);
      }
    }
  }

  const statsHeader = [
    'analyteId',
    ...levels.flatMap((lvl) => [`mean_level${lvl.level}`, `sd_level${lvl.level}`]),
  ].join(',');

  const statsRows = allAnalyteIds.map((aid) => {
    const cols = levels.flatMap((lvl) => {
      // Match by normalized key to handle any remaining non-canonical IDs from Gemini
      const entry = Object.entries(lvl.manufacturerStats).find(
        ([k]) => resolveAnalyteIdSafe(k) === aid,
      );
      return [cleanValue(entry?.[1].mean), cleanValue(entry?.[1].sd)];
    });
    return [aid, ...cols].join(',');
  });

  return ['// Info', infoHeader, ...infoRows, '', '// Stats', statsHeader, ...statsRows].join('\n');
}

// ─── Download trigger ─────────────────────────────────────────────────────────

/** Triggers a browser file download for the given CSV string. */
export function downloadCsvFile(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Builds the default CSV filename from control name and start date. */
export function buildCsvFilename(controlName: string | null, startDate: string): string {
  const name = (controlName ?? 'controle')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  const date = startDate || new Date().toISOString().split('T')[0];
  return `bula_${name}_${date}.csv`;
}
