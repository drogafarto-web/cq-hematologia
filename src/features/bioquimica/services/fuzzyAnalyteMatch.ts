/**
 * bioquimica/services/fuzzyAnalyteMatch.ts
 *
 * Fuzzy-match OCR-extracted analyte names to canonical AnalitoId via
 * Levenshtein distance + alias table. Pure functions, no I/O.
 *
 * Compliance: RDC 978 Art. 167 (OCR-driven laudo digitalization).
 */

import type { AnalitoId } from '../types/_shared_refs';
import type { OCRConfidence } from '../types/ocrResults';
import type { AnalitoExpandedMetadata } from '../types/analitoExpansion';

// ─── Match Result ────────────────────────────────────────────────────────

export interface FuzzyMatchResult {
  matchedId?: AnalitoId;
  confidence: OCRConfidence;
  matchedVia: 'exact' | 'alias' | 'levenshtein' | 'none';
  distance?: number;  // Levenshtein distance if used
}

// ─── Main Matching Function ──────────────────────────────────────────────

/**
 * Attempt to match a raw OCR-extracted analyte name to the catalog.
 * Tries: exact match → alias match → Levenshtein distance → none.
 */
export function fuzzyMatchAnalyte(
  rawName: string,
  catalog: AnalitoExpandedMetadata[]
): FuzzyMatchResult {
  const normalized = normalizeAnalyteName(rawName);

  if (!normalized) {
    return { confidence: 'low', matchedVia: 'none' };
  }

  // Tier 1: Exact match against id
  for (const meta of catalog) {
    if (normalizeAnalyteName(meta.id) === normalized) {
      return {
        matchedId: meta.id,
        confidence: 'high',
        matchedVia: 'exact',
      };
    }
  }

  // Tier 2: Exact match against alternativeNames
  for (const meta of catalog) {
    for (const alias of meta.alternativeNames) {
      if (normalizeAnalyteName(alias) === normalized) {
        return {
          matchedId: meta.id,
          confidence: 'high',
          matchedVia: 'alias',
        };
      }
    }
  }

  // Tier 3: Levenshtein distance ≤ 2
  let bestMatch: FuzzyMatchResult | null = null;

  for (const meta of catalog) {
    // Check distance against id
    const idDistance = levenshteinDistance(normalized, normalizeAnalyteName(meta.id));
    if (idDistance <= 2 && idDistance > 0) {
      const confidence: OCRConfidence = idDistance === 1 ? 'medium' : 'low';
      if (!bestMatch || idDistance < (bestMatch.distance || 999)) {
        bestMatch = {
          matchedId: meta.id,
          confidence,
          matchedVia: 'levenshtein',
          distance: idDistance,
        };
      }
    }

    // Check distance against aliases
    for (const alias of meta.alternativeNames) {
      const aliasDistance = levenshteinDistance(normalized, normalizeAnalyteName(alias));
      if (aliasDistance <= 2 && aliasDistance > 0) {
        const confidence: OCRConfidence = aliasDistance === 1 ? 'medium' : 'low';
        if (!bestMatch || aliasDistance < (bestMatch.distance || 999)) {
          bestMatch = {
            matchedId: meta.id,
            confidence,
            matchedVia: 'levenshtein',
            distance: aliasDistance,
          };
        }
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  // Tier 4: No match
  return { confidence: 'low', matchedVia: 'none' };
}

// ─── Levenshtein Distance ────────────────────────────────────────────────

/**
 * Calculate Levenshtein distance between two strings.
 * Pure function — no side effects.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[j][0] = j;
  }

  // Fill matrix
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // deletion
        matrix[j - 1][i] + 1,      // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

// ─── Normalization ──────────────────────────────────────────────────────

/**
 * Normalize an analyte name for matching.
 * - lowercase
 * - strip accents (NFKD decomposition)
 * - collapse whitespace
 * - replace slashes, dashes, underscores with spaces
 * - trim
 */
export function normalizeAnalyteName(s: string): string {
  if (!s) return '';

  return s
    .toLowerCase()
    // Decompose accents using NFKD
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // Replace punctuation with spaces
    .replace(/[/\-_]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}
