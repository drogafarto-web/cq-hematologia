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

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as functions from 'firebase-functions';

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

// ─── Client Class ───────────────────────────────────────────────────────────

export class GeminiVisionClient {
  private client: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
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

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: modelVersion });
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
      const prompt = `
You are an immunology laboratory assistant. Analyze this immunology strip image and classify the result.

Return a JSON object with EXACTLY these fields:
{
  "analyte": "<name of the antigen being tested, e.g. 'HIV', 'Syphilis', 'Hepatitis B'>",
  "result": "<one of: 'positive', 'negative', 'inconclusive'>",
  "confidence": <0.0 to 1.0 float representing your certainty>,
  "rawText": "<any visible text or markers on the strip>"
}

Important:
- Confidence should be 0.90+ for clear results, 0.50-0.80 for ambiguous strips
- If the image is unclear or band positions are ambiguous, return 'inconclusive'
- confidence < 0.85 will trigger manual review
- Return ONLY the JSON object, no additional text or markdown

Analyze now:
`;

      const response = await this.model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        },
        prompt,
      ]);

      const responseText = response.response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error(
          'Gemini Vision returned empty response'
        );
      }

      // Parse JSON response
      let parsed: GeminiVisionResponse;
      try {
        // Clean response of markdown code blocks if present
        const cleanedText = responseText
          .replace(/^```json\n?/, '')
          .replace(/\n?```$/, '')
          .trim();
        parsed = JSON.parse(cleanedText);
      } catch (jsonErr) {
        functions.logger.warn(
          `[${labId}:${stripId}] Failed to parse Gemini JSON response`,
          { rawResponse: responseText, error: String(jsonErr) }
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
      let finalConfidence = rawConfidence;
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
      const prompt = `
Extract structured fields from this laboratory report (laudo) image.

Return a JSON object with these fields (include only if visible):
{
  "patientName": "<patient full name>",
  "patientId": "<patient registration ID or CPF>",
  "testDate": "<date of test in YYYY-MM-DD format>",
  "analyte": "<test/analyte name>",
  "result": "<test result value or interpretation>",
  "laboratory": "<laboratory name or stamp>",
  "referenceRange": "<reference range if visible>"
}

Important:
- Be precise; extract exactly what you see
- If a field is not visible or unclear, omit it
- Return ONLY the JSON object, no additional text or markdown
- Preserve original formatting for dates and numbers

Extract now:
`;

      const response = await this.model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        },
        prompt,
      ]);

      const responseText = response.response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Gemini Vision returned empty response');
      }

      let fields: Record<string, unknown>;
      try {
        const cleanedText = responseText
          .replace(/^```json\n?/, '')
          .replace(/\n?```$/, '')
          .trim();
        fields = JSON.parse(cleanedText);
      } catch (jsonErr) {
        functions.logger.warn('Failed to parse laudo OCR JSON', {
          rawResponse: responseText,
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
