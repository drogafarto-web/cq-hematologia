/**
 * IA Strip Validation Service — Fuzzy matching and plausibility checking
 *
 * Pure functions for validating Gemini-parsed analytes against expectations.
 * No Firebase imports — testable in isolation.
 *
 * Handles: fuzzy analyte name matching, unit validation, confidence thresholds,
 * plausible range checks for common immunoassay analytes.
 */

/**
 * Parsed result from Gemini
 */
export interface ParsedAnalyte {
  name: string;
  value: number;
  unit: string;
  confidence: number;
}

/**
 * Strip parse result container
 */
export interface StripParseResult {
  analytes: ParsedAnalyte[];
  rawJson: string;
  modelVersion: string;
}

/**
 * Validated analyte with flags and match score
 */
export interface ValidatedAnalyte extends ParsedAnalyte {
  matched: boolean;
  matchedExpected: string | null;
  matchScore: number;
  flags: (
    | 'low-confidence'
    | 'unit-mismatch'
    | 'unknown-analyte'
    | 'value-out-of-plausible-range'
  )[];
}

/**
 * Plausible ranges for top 5 immunoassay analytes.
 * Used to flag values that are physically impossible.
 */
const PLAUSIBLE_RANGES: Record<string, { min: number; max: number }> = {
  TSH: { min: 0.01, max: 100 }, // mIU/mL
  T4: { min: 0.1, max: 30 }, // ng/dL or similar
  T3: { min: 0.05, max: 10 }, // ng/dL
  IgE: { min: 0, max: 10000 }, // IU/mL
  CRP: { min: 0, max: 500 }, // mg/L
};

/**
 * Compute Levenshtein distance between two strings (0..1 similarity).
 * Normalized by the longer string length.
 *
 * @param a First string
 * @param b Second string
 * @returns Similarity score (0 = no match, 1 = exact match)
 */
export function fuzzyMatch(a: string, b: string): number {
  const aLower = a.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const bLower = b.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  if (aLower === bLower) return 1.0;
  if (!aLower || !bLower) return 0.0;

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      const cost = aLower[j - 1] === bLower[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // deletion
        matrix[i - 1][j] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  const distance = matrix[bLower.length][aLower.length];
  const maxLength = Math.max(aLower.length, bLower.length);
  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Validate parsed strip results against expectations.
 *
 * @param parsed Gemini-parsed analytes
 * @param expectedAnalytes List of analyte names to match
 * @param unitDictionary Valid units per analyte (e.g., { TSH: ['mIU/mL', 'uIU/mL'] })
 * @returns Array of validated analytes with flags
 */
export function validateStripResult(
  parsed: StripParseResult,
  expectedAnalytes: string[],
  unitDictionary: Record<string, string[]> = {},
): ValidatedAnalyte[] {
  return parsed.analytes.map((analyte) => {
    const flags: ValidatedAnalyte['flags'] = [];
    let matched = false;
    let matchedExpected: string | null = null;
    let matchScore = 0;

    // Try fuzzy matching against expected analytes
    let bestMatch: { name: string; score: number } | null = null;
    for (const expected of expectedAnalytes) {
      const score = fuzzyMatch(analyte.name, expected);
      if (score > (bestMatch?.score || 0)) {
        bestMatch = { name: expected, score };
      }
    }

    if (bestMatch && bestMatch.score >= 0.7) {
      matched = true;
      matchedExpected = bestMatch.name;
      matchScore = bestMatch.score;
    } else {
      flags.push('unknown-analyte');
      matchScore = bestMatch?.score || 0;
    }

    // Flag: low confidence
    if (analyte.confidence < 0.6) {
      flags.push('low-confidence');
    }

    // Flag: unit mismatch
    if (matchedExpected && unitDictionary[matchedExpected]) {
      const validUnits = unitDictionary[matchedExpected];
      if (!validUnits.includes(analyte.unit)) {
        flags.push('unit-mismatch');
      }
    }

    // Flag: value out of plausible range
    if (matchedExpected && PLAUSIBLE_RANGES[matchedExpected]) {
      const range = PLAUSIBLE_RANGES[matchedExpected];
      if (analyte.value < range.min || analyte.value > range.max) {
        flags.push('value-out-of-plausible-range');
      }
    }

    return {
      ...analyte,
      matched,
      matchedExpected,
      matchScore,
      flags,
    };
  });
}
