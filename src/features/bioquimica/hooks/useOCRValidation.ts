/**
 * bioquimica/hooks/useOCRValidation.ts
 *
 * Hook orchestrating OCR validation flow: parse → fuzzy match → validate.
 * Composes useGeminiVision + fuzzyAnalyteMatch + validateOCRResult.
 */

import { useCallback, useEffect, useState } from 'react';
import { useGeminiVision } from './useGeminiVision';
import { fuzzyMatchAnalyte } from '../services/fuzzyAnalyteMatch';
import { validateOCRResult } from '../services/ocrValidationService';
import type { OCRParsedResult, OCRValidationReport } from '../types/ocrResults';
import type { AnalitoId } from '../types/_shared_refs';
import type { AnalitoExpandedMetadata } from '../types/analitoExpansion';

// ─── Hook Types ────────────────────────────────────────────────────────────

export interface UseOCRValidationApi {
  isValidating: boolean;
  parsed?: OCRParsedResult;
  validation?: OCRValidationReport;
  error?: string;
  validateImage(args: {
    imageStoragePath: string;
    expectedAnalytes: AnalitoId[];
    consentToken: string;
  }): Promise<OCRValidationReport>;
  reset(): void;
}

// ─── Hook Implementation ───────────────────────────────────────────────────

/**
 * TODO: This hook currently assumes a catalog is passed or available globally.
 * In a real implementation, this would fetch the catalog from Firestore or
 * pass it as a parameter.
 */
export function useOCRValidation(): UseOCRValidationApi {
  const geminiVision = useGeminiVision();
  const [validation, setValidation] = useState<OCRValidationReport | undefined>();
  const [error, setError] = useState<string | undefined>();

  // Stub catalog for now — in production, fetch from Firestore
  const catalog: AnalitoExpandedMetadata[] = [];

  const validateImage = useCallback(
    async (args: {
      imageStoragePath: string;
      expectedAnalytes: AnalitoId[];
      consentToken: string;
    }): Promise<OCRValidationReport> => {
      setError(undefined);

      try {
        // Step 1: Parse image via Gemini
        const parsed = await geminiVision.parseImage(args);

        // Step 2: Apply fuzzy matching to each parsed analyte
        const matchedAnalytes = parsed.analytes.map((analyte) => {
          if (!analyte.matchedAnalitoId) {
            const fuzzyResult = fuzzyMatchAnalyte(analyte.rawName, catalog);
            return {
              ...analyte,
              matchedAnalitoId: fuzzyResult.matchedId,
              matchConfidence: fuzzyResult.confidence,
            };
          }
          return analyte;
        });

        // Step 3: Validate against expected analytes
        const parsedWithMatches: OCRParsedResult = {
          ...parsed,
          analytes: matchedAnalytes,
        };

        const validationReport = validateOCRResult({
          parsed: parsedWithMatches,
          expectedAnalytes: args.expectedAnalytes,
          catalog,
        });

        setValidation(validationReport);
        return validationReport;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      }
    },
    [geminiVision, catalog],
  );

  const reset = useCallback(() => {
    geminiVision.reset();
    setValidation(undefined);
    setError(undefined);
  }, [geminiVision]);

  return {
    isValidating: geminiVision.state.isParsing,
    parsed: geminiVision.state.result,
    validation,
    error: error || geminiVision.state.error,
    validateImage,
    reset,
  };
}
