/**
 * bioquimica/services/ocrValidationService.ts
 *
 * Validate Gemini OCR output against expected analytes for the current run.
 * Pure function — no I/O.
 */

import type { OCRParsedResult, OCRValidationReport } from '../types/ocrResults';
import type { AnalitoId } from '../types/_shared_refs';
import type { AnalitoExpandedMetadata } from '../types/analitoExpansion';

// ─── Validation Service ────────────────────────────────────────────────────

/**
 * Validate OCR parsed result against expected analytes.
 * Determines acceptance severity: accept | review | reject.
 */
export function validateOCRResult(args: {
  parsed: OCRParsedResult;
  expectedAnalytes: AnalitoId[];
  catalog: AnalitoExpandedMetadata[];
}): OCRValidationReport {
  const { parsed, expectedAnalytes } = args;

  // Find matched and unmatched
  const matched: AnalitoId[] = [];
  const unmatched: AnalitoId[] = [...expectedAnalytes];
  const unexpected: string[] = [];

  // For each parsed analyte
  for (const analyte of parsed.analytes) {
    if (analyte.matchedAnalitoId) {
      const matchIdx = unmatched.indexOf(analyte.matchedAnalitoId);
      if (matchIdx >= 0) {
        unmatched.splice(matchIdx, 1);
        if (!matched.includes(analyte.matchedAnalitoId)) {
          matched.push(analyte.matchedAnalitoId);
        }
      } else {
        // Matched but not expected
        unexpected.push(analyte.rawName);
      }
    } else if (analyte.matchConfidence === 'low') {
      unexpected.push(analyte.rawName);
    }
  }

  // Determine severity
  let validationSeverity: 'accept' | 'review' | 'reject';

  if (unmatched.length === 0 && parsed.overallConfidence === 'high') {
    validationSeverity = 'accept';
  } else if (unmatched.length <= 2 && parsed.overallConfidence !== 'low') {
    validationSeverity = 'review';
  } else {
    validationSeverity = 'reject';
  }

  return {
    parsedResultId: parsed.imageHash,
    expectedAnalytes,
    matched,
    unmatched,
    unexpected,
    validationSeverity,
  };
}
