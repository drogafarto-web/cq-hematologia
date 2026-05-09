/**
 * functions/src/modules/bioquimica/geminiVisionService.ts
 *
 * Callable v2 wrapping Gemini 2.5 Flash for analyte strip OCR.
 * Region: southamerica-east1, CORS: true, Memory: 512MiB, Timeout: 120s.
 *
 * Auth required: request.auth must be set.
 * LGPD gate: consentToken required before processing image.
 *
 * Compliance: RDC 978 Art. 167 (laudo digitalization), LGPD Art. 9 (sensitive data).
 */

import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as crypto from 'crypto';
import type { OCRParsedResult } from '../../../../src/features/bioquimica/types/ocrResults';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

// ─── Callable ──────────────────────────────────────────────────────────────

export const parseAnalyteStripImage = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: [geminiApiKey],
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (request): Promise<OCRParsedResult> => {
    // Auth check
    if (!request.auth) {
      throw new Error('unauthenticated');
    }

    // Parse input
    const { labId, imageStoragePath, expectedAnalytes, consentToken } = request.data;

    if (!labId || !imageStoragePath || !Array.isArray(expectedAnalytes) || !consentToken) {
      throw new Error('invalid_request: missing required fields');
    }

    // LGPD gate: consentToken is required
    if (!consentToken || typeof consentToken !== 'string') {
      throw new Error('permission_denied: LGPD consent token required');
    }

    // TODO: isActiveMemberOfLab(labId) check would go here
    // For now, trusting auth context

    // Stub mode for testing
    if (process.env.GEMINI_API_KEY === 'STUB') {
      return createStubOCRResult(imageStoragePath, expectedAnalytes);
    }

    // TODO: Implement actual Gemini Vision call
    // This is a placeholder — real implementation would:
    // 1. Download image from GCS
    // 2. Call Gemini API
    // 3. Parse JSON response
    // 4. Return structured OCRParsedResult

    throw new Error('not_implemented: Gemini Vision integration pending');
  }
);

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Call Gemini Vision API for OCR.
 * This is an internal helper exported for testing.
 *
 * Note: In production, image would be fetched from GCS first.
 */
export async function callGeminiVision(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<{ rawText: string; warnings: string[] }> {
  // Placeholder — not yet implemented
  throw new Error('not_implemented: Gemini Vision API integration pending');
}

// ─── Stub Mode (for testing) ───────────────────────────────────────────────

/**
 * Create a canned OCR result for testing and E2E scenarios.
 */
function createStubOCRResult(
  imageStoragePath: string,
  expectedAnalytes: string[]
): OCRParsedResult {
  const timestamp = Date.now();
  const imageHash = crypto.createHash('sha256').update(imageStoragePath).digest('hex');

  return {
    imageStoragePath,
    imageHash,
    parsedAt: timestamp,
    geminiModel: 'gemini-2.5-flash',
    rawText: '[STUB MODE] OCR text redacted for testing',
    analytes: expectedAnalytes.slice(0, 4).map((id, i) => ({
      rawName: id,
      matchedAnalitoId: id as any,
      matchConfidence: 'high',
      rawValue: (80 + i * 5).toString(),
      parsedValue: 80 + i * 5,
      rawUnit: 'U/L',
      unitMatched: true,
    })),
    overallConfidence: 'high',
    warnings: ['[STUB MODE] This is a test fixture'],
  };
}
