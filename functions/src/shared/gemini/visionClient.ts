/**
 * Gemini Vision Client Wrapper
 * Classifier for immunology IA strip images via Google Generative AI
 *
 * Implements:
 * - stripImageClassification: analyte detection + positive/negative/inconclusive result
 * - laudo OCR parsing
 * - confidence score extraction (0–1 normalized)
 *
 * RDC 978 Art.167 — IA classification requires patient consent documentation
 * LGPD Art.9 — sensitive health data requires explicit consent
 */

import * as functions from 'firebase-functions';
import { createAIClient, AIClient } from '../ai/aiClient';
import { STRIP_CLASSIFICATION_PROMPT } from '../ai/prompts/stripClassification';
import { LAUDO_EXTRACTION_PROMPT } from '../ai/prompts/laudoExtraction';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Immunology result classification
 * RDC 978 Art.167 — IA classification requires consent
 */
export enum ImunoResult {
  NEGATIVE = 'negative',
  POSITIVE = 'positive',
  INCONCLUSIVE = 'inconclusive',
}

/**
 * IA classification output from Gemini Vision
 */
export interface ImunoIAClassification {
  analyte: string;
  result: ImunoResult;
  confidence: number;
  rawText: string;
  operatorId: string;
  imageUrl: string;
  modelVersion: string;
  error?: string;
}

/**
 * Response shape from Gemini Vision model
 */
interface GeminiVisionResponse {
  analyte?: string;
  result?: 'positive' | 'negative' | 'inconclusive';
  confidence?: number;
  rawText?: string;
  [key: string]: unknown;
}

/**
 * OCR extraction result from laudo parsing
 */
interface LaudoOCRResult {
  fields: {
    patientName?: string;
    patientId?: string;
    testDate?: string;
    analyte?: string;
    result?: string;
    [key: string]: unknown;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Strip markdown code fences from vision responses */
function cleanJSON(raw: string): string {
  return raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
}

// ─── Client Class ───────────────────────────────────────────────────────────

export class GeminiVisionClient {
  private aiClient: AIClient;
  private confidenceThreshold: number = 0.85;
  private modelVersion: string = 'gemini-2.5-flash';

  constructor(
    apiKey: string = process.env.GEMINI_API_KEY || '',
    confidenceThreshold: number = 0.85,
    modelVersion: string = 'gemini-2.5-flash'
  ) {
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable not set. ' +
        'Set via: firebase functions:secrets:set GEMINI_API_KEY'
      );
    }

    this.aiClient = createAIClient({ apiKey, model: modelVersion, maxRetries: 3 });
    this.confidenceThreshold = confidenceThreshold;
    this.modelVersion = modelVersion;
  }

  /**
   * Classify immunology strip image via Gemini Vision
   *
   * @param imageBase64 Base64-encoded image data
   * @param labId Lab ID for logging context
   * @param stripId Strip run ID for logging context
   * @returns Partial ImunoIAClassification (without id, labId, hash, createdAt)
   * @throws {Error} If API fails, invalid response, or JSON parsing errors
   *
   * Success response includes:
   * - analyte: detected antigen (HIV, Syphilis, HepB, etc.)
   * - result: positive | negative | inconclusive
   * - confidence: 0.0–1.0; if < 0.85, result forced to inconclusive
   * - rawText: OCR'd strip text
   * - modelVersion: Gemini model used
   */
  async classifyStripImage(
    imageBase64: string,
    labId: string,
    stripId: string
  ): Promise<Omit<ImunoIAClassification, 'id' | 'labId' | 'hash' | 'createdAt'>> {
    try {
      const prompt = STRIP_CLASSIFICATION_PROMPT.template({
        confidenceThreshold: this.confidenceThreshold,
      });

      const response = await this.aiClient.generateVision({
        prompt,
        imageBase64,
        mimeType: 'image/jpeg',
      });

      // Parse JSON response (vision responses may still have markdown fences)
      let parsed: GeminiVisionResponse;
      try {
        const cleanedText = cleanJSON(response.text);
        parsed = JSON.parse(cleanedText);
      } catch (jsonErr) {
        functions.logger.warn(
          `[${labId}:${stripId}] Failed to parse Gemini JSON response`,
          { rawResponse: response.text, error: String(jsonErr) }
        );
        throw new Error(
          `Invalid JSON in Gemini response: ${String(jsonErr)}`
        );
      }

      // Extract fields
      const analyte = parsed.analyte || 'Unknown';
      let result = this.normalizeResult(parsed.result);
      const rawConfidence = this.parseConfidenceScore(parsed);

      // Enforce confidence threshold
      const finalConfidence = rawConfidence;
      if (rawConfidence < this.confidenceThreshold) {
        functions.logger.info(
          `[${labId}:${stripId}] Confidence below threshold`,
          { confidence: rawConfidence, threshold: this.confidenceThreshold }
        );
        result = ImunoResult.INCONCLUSIVE;
      }

      // Log successful classification
      functions.logger.info(
        `[${labId}:${stripId}] Strip classified`,
        { analyte, result, confidence: finalConfidence, modelVersion: this.modelVersion }
      );

      return {
        analyte,
        result,
        confidence: finalConfidence,
        rawText: parsed.rawText || '',
        operatorId: '', // Will be set by callable function
        imageUrl: '', // Will be set by callable function
        modelVersion: this.modelVersion,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);

      functions.logger.error(
        `[${labId}:${stripId}] Gemini Vision API error`,
        { error: errorMsg }
      );

      throw new Error(
        `Gemini Vision classification failed: ${errorMsg}`
      );
    }
  }

  /**
   * Extract fields from a laudo (report) image via OCR
   *
   * @param imageBase64 Base64-encoded laudo image
   * @returns Extracted fields (patientName, patientId, testDate, analyte, result, etc.)
   * @throws {Error} If API fails or parsing errors occur
   *
   * Used for laudo backdating + patient consent verification
   */
  async extractFieldsFromLaudo(
    imageBase64: string
  ): Promise<LaudoOCRResult> {
    try {
      const prompt = LAUDO_EXTRACTION_PROMPT.template();

      const response = await this.aiClient.generateVision({
        prompt,
        imageBase64,
        mimeType: 'image/jpeg',
      });

      let fields: Record<string, unknown>;
      try {
        const cleanedText = cleanJSON(response.text);
        fields = JSON.parse(cleanedText);
      } catch (jsonErr) {
        functions.logger.warn('Failed to parse laudo OCR JSON', {
          rawResponse: response.text,
          error: String(jsonErr),
        });
        throw new Error(`Invalid JSON in laudo OCR: ${String(jsonErr)}`);
      }

      return { fields };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);

      functions.logger.error('Laudo OCR extraction failed', {
        error: errorMsg,
      });

      throw new Error(`Laudo OCR failed: ${errorMsg}`);
    }
  }

  /**
   * Extract and normalize confidence score from Gemini response
   *
   * @param response Gemini Vision JSON response object
   * @returns Confidence as number 0.0–1.0
   */
  parseConfidenceScore(response: GeminiVisionResponse): number {
    const confidence = response.confidence;

    if (typeof confidence === 'number') {
      // Clamp to valid range
      return Math.max(0, Math.min(1, confidence));
    }

    // Default to 0.5 (medium confidence) if not provided
    functions.logger.warn(
      'Gemini response missing confidence field; defaulting to 0.5',
      { response }
    );
    return 0.5;
  }

  /**
   * Normalize result string to ImunoResult enum
   *
   * @param result Raw result from Gemini (may have whitespace, casing variations)
   * @returns Normalized ImunoResult
   */
  private normalizeResult(result?: string): ImunoResult {
    if (!result) return ImunoResult.INCONCLUSIVE;

    const normalized = result.toLowerCase().trim();

    if (normalized === 'positive') return ImunoResult.POSITIVE;
    if (normalized === 'negative') return ImunoResult.NEGATIVE;
    return ImunoResult.INCONCLUSIVE;
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

let instance: GeminiVisionClient | null = null;

/**
 * Get or create singleton Gemini Vision client
 * Lazy initialization on first use to delay GEMINI_API_KEY validation
 */
export function getGeminiVisionClient(): GeminiVisionClient {
  if (!instance) {
    instance = new GeminiVisionClient();
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetGeminiVisionClient(): void {
  instance = null;
}
