/**
 * Laudo OCR Module
 * Phase 6: RDC 978 Article 167 — OCR extraction of clinical report fields
 *
 * Exports:
 * - extractLaudoFieldsCallable: auto OCR via Gemini Vision
 * - saveLaudoFieldsManuallyCallable: fallback manual entry
 */

export { extractLaudoFieldsCallable } from './callables/extractLaudoFieldsCallable';
export { saveLaudoFieldsManuallyCallable } from './callables/saveLaudoFieldsManuallyCallable';
export { extractLaudoFields } from './laudoOCRExtractor';
export { validateLaudoExtraction, getExtractionReviewLevel } from './validators';

// Re-export types for client use
export type {
  LaudoExtractedFields,
  ExtractLaudoFieldsInput,
  ExtractLaudoFieldsResponse,
  SaveLaudoFieldsManuallyInput,
  SaveLaudoFieldsManuallyResponse,
  BoundingBox,
  Field10,
  Field11,
  Field12,
} from './types';
