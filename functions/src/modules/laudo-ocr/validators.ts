/**
 * Laudo OCR Validators
 * Phase 6: Validate extracted fields + warn on missing signatures
 */

import {
  LaudoExtractedFields,
  Field10,
  Field11,
  Field12,
} from './types';

/**
 * Validate field 10 (Observações) — required.
 * @returns true if field10.text is non-empty
 */
export function validateField10(field10: Field10): boolean {
  return typeof field10.text === 'string' && field10.text.trim().length > 0;
}

/**
 * Validate field 11 (RT signature) — advisory.
 * Returns { isValid: true, warnings: [] } if not detected but allows manual entry.
 * Only fails if field11 object is malformed.
 */
export function validateField11(
  field11: Field11
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!field11.detected) {
    warnings.push(
      'RT signature not detected — manual entry or verification recommended'
    );
  }

  if (field11.detected && !field11.boundingBox) {
    warnings.push('RT signature detected but no bounding box provided');
  }

  return { isValid: true, warnings };
}

/**
 * Validate field 12 (Director signature + date) — advisory.
 * Similar to field 11: warns if not detected but allows fallback.
 */
export function validateField12(
  field12: Field12
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!field12.detected) {
    warnings.push(
      'Director signature not detected — manual entry or verification recommended'
    );
  }

  if (field12.detected && !field12.boundingBox) {
    warnings.push('Director signature detected but no bounding box provided');
  }

  if (!field12.dateText) {
    warnings.push('No date extracted from field 12 — manual date entry may be needed');
  }

  return { isValid: true, warnings };
}

/**
 * Validate entire extraction result.
 *
 * Requirements:
 * - field10 must be non-empty (REQUIRED by RDC 978 Art. 167)
 * - field11/field12: if not detected, allow manual entry (ADVISORY)
 *
 * Returns { ok, warnings } where:
 * - ok=true if field10 is valid (allows manual entry for signatures)
 * - ok=false only if field10 is empty or object is malformed
 */
export function validateLaudoExtraction(
  extraction: LaudoExtractedFields
): { ok: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Validate field 10 (required)
  if (!validateField10(extraction.field10)) {
    return {
      ok: false,
      warnings: ['Field 10 (Observações) is required and cannot be empty'],
    };
  }

  // Validate field 11 (advisory)
  const field11Validation = validateField11(extraction.field11);
  warnings.push(...field11Validation.warnings);

  // Validate field 12 (advisory)
  const field12Validation = validateField12(extraction.field12);
  warnings.push(...field12Validation.warnings);

  return { ok: true, warnings };
}

/**
 * Check if extraction should be auto-saved or require manual review.
 * Returns 'auto' if all fields are high confidence + field10 filled.
 * Returns 'manual-review' if any advisory warning exists.
 */
export function getExtractionReviewLevel(
  extraction: LaudoExtractedFields
): 'auto' | 'manual-review' {
  const validation = validateLaudoExtraction(extraction);

  if (!validation.ok) {
    return 'manual-review';
  }

  // If warnings exist, escalate to manual review
  if (validation.warnings.length > 0) {
    return 'manual-review';
  }

  // If all fields have high confidence, can auto-save
  const allHighConfidence =
    extraction.field10.confidence === 'high' &&
    extraction.field11.confidence === 'high' &&
    extraction.field12.confidence === 'high';

  if (allHighConfidence) {
    return 'auto';
  }

  return 'manual-review';
}
