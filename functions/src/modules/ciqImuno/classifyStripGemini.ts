/**
 * classifyStripGemini.ts
 * Phase 5 Task 05-03: Gemini Vision API integration for immunology strip classification
 *
 * Callable that:
 * 1. Fetches image from Firebase Storage signed URL
 * 2. Calls Gemini 2.5 Flash Vision API
 * 3. Parses response (classification + confidence)
 * 4. Applies confidence threshold (default 0.85)
 * 5. Logs cost per call
 * 6. Returns classification with recommended action (AUTO_SAVE | MANUAL_REVIEW)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

// Type definitions
export type TestType = 'HIV' | 'Dengue' | 'Syphilis' | 'COVID' | 'HCG';
export type Classification = 'Positive' | 'Negative' | 'Invalid' | 'Grey-Zone';
export type RecommendedAction = 'AUTO_SAVE' | 'MANUAL_REVIEW';

// Input validation schema
const ClassifyStripPayloadSchema = z.object({
  labId: z.string().min(1),
  runId: z.string().min(1),
  imageUrl: z.string().url(),
  testKit: z.enum(['HIV', 'Dengue', 'Syphilis', 'COVID', 'HCG']),
  confusionMatrixId: z.string().optional(),
});

// Gemini response parsing schema
const GeminiResponseSchema = z.object({
  classification: z.enum(['Positive', 'Negative', 'Invalid', 'Grey-Zone']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

interface ClassifyStripPayload {
  labId: string;
  runId: string;
  imageUrl: string;
  testKit: TestType;
  confusionMatrixId?: string;
}

interface GeminiClassificationResponse {
  classification: Classification;
  confidence: number;
  reasoning: string;
}

// Return type for classifyStripGemini (inferred from return statement)

/**
 * Download image from Firebase Storage signed URL as base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Use Google Cloud Storage client from admin SDK
      const https = require('https');
      const chunks: Buffer[] = [];

      const request = https.get(imageUrl, (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer.toString('base64'));
        });
      });

      request.on('error', (error: Error) => {
        reject(new Error(`Image download failed: ${error.message}`));
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Image download timeout (10s)'));
      });
    } catch (error) {
      reject(
        new Error(
          `Failed to download image: ${error instanceof Error ? error.message : 'unknown error'}`
        )
      );
    }
  });
}

/**
 * Estimate API cost based on tokens used
 * Gemini 2.5 Flash pricing (approx):
 * - Input: $0.075 / 1M tokens
 * - Output: $0.30 / 1M tokens
 */
function estimateCost(inputTokens: number, outputTokens: number): number {
  const INPUT_COST_PER_M = 0.075;
  const OUTPUT_COST_PER_M = 0.30;

  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_M;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_M;

  return inputCost + outputCost;
}

/**
 * Log classification cost to Firestore
 */
async function logClassificationCost(
  labId: string,
  costUsd: number,
  testKit: TestType,
  confidence: number
): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const dateKey = now.toDate().toISOString().split('T')[0];

  try {
    const costDocRef = db.doc(
      `labs/${labId}/imuno-ia-cost/${dateKey}`
    );

    await db.runTransaction(async (tx) => {
      const costDoc = await tx.get(costDocRef);

      if (costDoc.exists) {
        const data = costDoc.data() as any;
        tx.update(costDocRef, {
          callCount: data.callCount + 1,
          estimatedCost: data.estimatedCost + costUsd,
          lastUpdated: now,
        });
      } else {
        tx.set(costDocRef, {
          labId,
          dateKey,
          callCount: 1,
          estimatedCost: costUsd,
          lastUpdated: now,
        });
      }
    });
  } catch (error) {
    console.warn(
      `Failed to log cost for ${labId}: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    // Non-fatal: don't fail the entire request if cost logging fails
  }
}

/**
 * Parse Gemini response with JSON repair fallback
 */
function parseGeminiResponse(responseText: string): GeminiClassificationResponse {
  try {
    // Try standard JSON parse first
    const parsed = JSON.parse(responseText);
    return GeminiResponseSchema.parse(parsed);
  } catch (parseError) {
    // Try JSON repair if standard parse fails
    try {
      const repaired = jsonrepair(responseText);
      const parsed = JSON.parse(repaired);
      return GeminiResponseSchema.parse(parsed);
    } catch (repairError) {
      throw new Error(
        `Failed to parse Gemini response: ${responseText.substring(0, 100)}...`
      );
    }
  }
}

/**
 * Get lab configuration (confidence threshold)
 */
async function getLabConfig(labId: string): Promise<{ confidenceThreshold: number }> {
  const db = admin.firestore();

  try {
    const configDoc = await db.doc(`labs/${labId}/imuno-ia-config/config`).get();

    if (configDoc.exists) {
      const data = configDoc.data() as any;
      return {
        confidenceThreshold: data.confidenceThreshold ?? 0.85,
      };
    }
  } catch (error) {
    console.warn(`Failed to fetch lab config for ${labId}: ${error}`);
  }

  // Default threshold
  return { confidenceThreshold: 0.85 };
}

/**
 * Cloud Function callable: classifyStripGemini
 *
 * Classifies rapid immunology test strips using Gemini Vision API.
 * Returns classification result with confidence and recommended action.
 *
 * @param request.data {ClassifyStripPayload}
 * @returns {Promise<ClassifyStripResult>}
 *
 * @throws HttpsError if validation fails, image download fails, or API call fails
 */
export const classifyStripGemini = onCall(async (request) => {
    // Validate authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Parse and validate input
    let payload: ClassifyStripPayload;
    try {
      const data = request.data as any;
      payload = ClassifyStripPayloadSchema.parse(data);
    } catch (error) {
      const validationError = error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        : 'Unknown validation error';
      throw new HttpsError('invalid-argument', `Validation error: ${validationError}`);
    }

    // Verify user is member of lab (basic RBAC)
    const db = admin.firestore();
    const memberDoc = await db.doc(`labs/${payload.labId}/members/${request.auth.uid}`).get();
    if (!memberDoc.exists || !(memberDoc.data() as any)?.active) {
      throw new HttpsError(
        'permission-denied',
        'User is not an active member of this lab'
      );
    }

    const startTime = Date.now();

    try {
      // Step 1: Download image
      let base64Image: string;
      try {
        base64Image = await downloadImageAsBase64(payload.imageUrl);
      } catch (error) {
        throw new HttpsError(
          'failed-precondition',
          `Image download failed: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }

      // Step 2: Get lab configuration
      const labConfig = await getLabConfig(payload.labId);

      // Step 3: Initialize Gemini client
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new HttpsError(
          'internal',
          'Gemini API key not configured'
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Step 4: Build prompt
      const prompt = `You are a clinical laboratory image analysis assistant specializing in rapid diagnostic test (RDT) interpretation.

Analyze this RDT strip for ${payload.testKit} and classify the result.

Respond ONLY with valid JSON (no markdown, no code blocks, just raw JSON):
{
  "classification": "Positive" | "Negative" | "Invalid" | "Grey-Zone",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<brief explanation of the classification>"
}

Respond with ONLY the JSON object, nothing else.`;

      // Step 5: Call Gemini Vision API
      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          text: prompt,
        },
      ]);

      const responseText = (response as any).content.parts
        .filter((part: any) => 'text' in part)
        .map((part: any) => ('text' in part ? part.text : ''))
        .join('');

      if (!responseText) {
        throw new HttpsError(
          'internal',
          'Gemini API returned empty response'
        );
      }

      // Step 6: Parse response
      const geminiResult = parseGeminiResponse(responseText);

      // Step 7: Determine recommended action
      const flaggedForManualReview = geminiResult.confidence < labConfig.confidenceThreshold;
      const recommendedAction: RecommendedAction = flaggedForManualReview
        ? 'MANUAL_REVIEW'
        : 'AUTO_SAVE';

      // Step 8: Calculate latency and cost
      const geminiLatencyMs = Date.now() - startTime;
      const estimatedTokens = {
        input: Math.ceil(base64Image.length / 4) + 200, // rough estimate
        output: 100, // typical JSON response
      };
      const costEstimateUsd = estimateCost(estimatedTokens.input, estimatedTokens.output);

      // Step 9: Log cost asynchronously (don't block response)
      logClassificationCost(
        payload.labId,
        costEstimateUsd,
        payload.testKit,
        geminiResult.confidence
      ).catch((err) => console.error('Cost logging failed:', err));

      // Step 10: Return result
      return {
        classification: geminiResult.classification,
        confidence: geminiResult.confidence,
        reasoning: geminiResult.reasoning,
        geminiLatencyMs,
        flaggedForManualReview,
        threshold: labConfig.confidenceThreshold,
        recommendedAction,
        costEstimateUsd,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error('Classification error:', error);
      throw new HttpsError(
        'internal',
        `Classification failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
});
