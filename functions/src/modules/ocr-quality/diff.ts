/**
 * OCR Diff Engine — pure functions, no Firestore deps.
 *
 * Compares an OCR-extracted result against the RT-validated final result and
 * emits a field-level edit summary. Everything in this file is unit-testable
 * without an emulator.
 */
import type {
  OCRResultSnapshot,
  FinalResultSnapshot,
  FieldEdit,
  DiffSummary,
  OCRField,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Value normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a field value for equality comparison.
 *
 * Rules (in order):
 *  1. trim outer whitespace
 *  2. collapse internal whitespace runs to single space
 *  3. lower-case (clinical fields are case-insensitive — "Negative" === "negative")
 *  4. swap comma decimals for dots ("12,4" === "12.4") — pt-BR vs en-US
 *  5. strip thousands separators when they sit between digits ("1.234,5" → "1234.5")
 *
 * We do NOT round numerics — `12.40` and `12.4` are kept distinct because the RT
 * may have intentionally added a sig-fig.
 */
export function normaliseValue(raw: string | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  let v = String(raw).trim().replace(/\s+/g, ' ').toLowerCase();

  // Heuristic: if value matches a number-like pattern, normalise locale.
  // We only touch values that contain digits — leaves "Negativo" alone.
  if (/\d/.test(v)) {
    // Strip thousands separators only when surrounded by digits on both sides.
    // pt-BR uses "." as thousands and "," as decimal: 1.234,56
    // en-US uses "," as thousands and "." as decimal: 1,234.56
    // We detect a single decimal mark (last "," or ".") and treat earlier
    // separators as thousands.
    const lastComma = v.lastIndexOf(',');
    const lastDot = v.lastIndexOf('.');
    const decimalIdx = Math.max(lastComma, lastDot);
    if (decimalIdx > -1) {
      const intPart = v.slice(0, decimalIdx).replace(/[.,]/g, '');
      const fracPart = v.slice(decimalIdx + 1);
      // Only treat as decimal if fracPart is purely digits — otherwise leave alone.
      if (/^\d+$/.test(fracPart)) {
        v = `${intPart}.${fracPart}`;
      }
    }
  }
  return v;
}

function valuesEqual(a: string | undefined, b: string | undefined): boolean {
  return normaliseValue(a) === normaliseValue(b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff
// ─────────────────────────────────────────────────────────────────────────────

function indexByName(fields: OCRField[]): Map<string, OCRField> {
  const m = new Map<string, OCRField>();
  for (const f of fields) {
    if (f && typeof f.name === 'string' && f.name.length > 0) {
      m.set(f.name, f);
    }
  }
  return m;
}

/**
 * Compute the field-level diff between an OCR snapshot and the RT-validated
 * final snapshot. Pure: no clocks, no network.
 */
export function diffFields(
  ocr: OCRResultSnapshot,
  finalR: FinalResultSnapshot,
): DiffSummary {
  const ocrMap = indexByName(ocr.fields ?? []);
  const finalMap = indexByName(finalR.fields ?? []);

  const seen = new Set<string>();
  const edits: FieldEdit[] = [];

  // Walk OCR fields first (preserves the OCR-emitted ordering).
  for (const [name, ocrField] of ocrMap) {
    seen.add(name);
    const finalField = finalMap.get(name);

    if (!finalField) {
      edits.push({
        field: name,
        kind: 'removed',
        ocrValue: ocrField.value,
        ocrConfidence: ocrField.confidence,
      });
      continue;
    }

    if (valuesEqual(ocrField.value, finalField.value)) {
      edits.push({
        field: name,
        kind: 'unchanged',
        ocrValue: ocrField.value,
        finalValue: finalField.value,
        ocrConfidence: ocrField.confidence,
      });
    } else {
      edits.push({
        field: name,
        kind: 'modified',
        ocrValue: ocrField.value,
        finalValue: finalField.value,
        ocrConfidence: ocrField.confidence,
      });
    }
  }

  // Then anything new the RT added.
  for (const [name, finalField] of finalMap) {
    if (seen.has(name)) continue;
    edits.push({
      field: name,
      kind: 'added',
      finalValue: finalField.value,
    });
  }

  let modifiedCount = 0;
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;
  for (const e of edits) {
    if (e.kind === 'modified') modifiedCount++;
    else if (e.kind === 'added') addedCount++;
    else if (e.kind === 'removed') removedCount++;
    else unchangedCount++;
  }

  const totalFields = edits.length;
  const errorRate =
    totalFields === 0 ? 0 : (modifiedCount + addedCount + removedCount) / totalFields;

  return {
    edits,
    modifiedCount,
    addedCount,
    removedCount,
    unchangedCount,
    totalFields,
    errorRate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Acceptance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confidence threshold below which the UI suggests re-photographing or manual
 * entry. Mirrors the `0.7` retry-trigger surfaced to the operator.
 */
export const RETRY_CONFIDENCE_THRESHOLD = 0.7;

/**
 * A run is `accepted` when:
 *   - OCR overall confidence >= retry threshold, AND
 *   - the operator made zero edits (modified+added+removed === 0).
 *
 * "Accepted" is the KPI numerator — it's the answer to "did the OCR
 * deliver a usable result on the first try?".
 */
export function isAccepted(diff: DiffSummary, overallConfidence: number): boolean {
  if (overallConfidence < RETRY_CONFIDENCE_THRESHOLD) return false;
  return diff.modifiedCount + diff.addedCount + diff.removedCount === 0;
}

/**
 * UI helper: should we suggest auto-retry / manual entry?
 * Pure boolean — caller decides whether to surface the hint.
 */
export function shouldSuggestRetry(overallConfidence: number): boolean {
  return overallConfidence < RETRY_CONFIDENCE_THRESHOLD;
}
