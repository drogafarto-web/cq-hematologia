/**
 * classify.ts
 * Phase 5 W3-A4: IA Strip Classification + Dataset Collection Callables
 *
 * Two callables for immunology strip processing:
 * 1. classifyStripImage: Gemini Vision classification with confidence validation
 * 2. collectIADataset: Manual verdict recording + accuracy tracking
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

// ─── Type definitions ────────────────────────────────────────────────────────

export type Classification = 'Positive' | 'Negative' | 'Invalid' | 'Grey-Zone';
export type TestKit = 'HIV' | 'Dengue' | 'Syphilis' | 'COVID' | 'HCG';

// Input validation schemas
const ClassifyStripImagePayloadSchema = z.object({
  labId: z.string().min(1),
  stripId: z.string().min(1),
  imageBase64: z.string().optional(),
  referenceUrl: z.string().url().optional(),
});

const CollectIADatasetPayloadSchema = z.object({
  labId: z.string().min(1),
  stripId: z.string().min(1),
  manualVerdict: z.enum(['Positive', 'Negative', 'Invalid', 'Grey-Zone']),
  justification: z.string().min(1).max(500),
});

// ─── Classification Response Schema ──────────────────────────────────────────

const GeminiResponseSchema = z.object({
  classification: z.enum(['Positive', 'Negative', 'Invalid', 'Grey-Zone']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

interface ClassifyStripImagePayload {
  labId: string;
  stripId: string;
  imageBase64?: string;
  referenceUrl?: string;
}

interface CollectIADatasetPayload {
  labId: string;
  stripId: string;
  manualVerdict: Classification;
  justification: string;
}

interface ImunoIAClassification {
  labId: string;
  stripId: string;
  classification: Classification;
  confidence: number;
  reasoning: string;
  storedAt: any; // Firestore Timestamp
  deletedAt: null;
}

interface ImunoIADatasetRecord {
  labId: string;
  stripId: string;
  aiClassification: Classification;
  aiConfidence: number;
  manualVerdict: Classification;
  match: boolean;
  justification: string;
  recordedBy: string;
  recordedAt: any; // Firestore Timestamp
  deletedAt: null;
}

// ─── Helper: Download image from URL ─────────────────────────────────────────

async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const https = require('https');
      const chunks: Buffer[] = [];

      const request = https.get(imageUrl, (response: any) => {
        if (response.statusCode !== 200) {
          reject(new HttpsError('failed-precondition', `HTTP ${response.statusCode}: Invalid image URL`));
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

      request.on('error', () => {
        reject(new HttpsError('failed-precondition', 'Image URL download failed'));
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new HttpsError('deadline-exceeded', 'Image download timeout (10s)'));
      });
    } catch (error) {
      reject(new HttpsError('failed-precondition', 'Image download error'));
    }
  });
}

// ─── Helper: Parse Gemini response ───────────────────────────────────────────

function parseGeminiResponse(responseText: string) {
  try {
    const parsed = JSON.parse(responseText);
    return GeminiResponseSchema.parse(parsed);
  } catch {
    try {
      const repaired = jsonrepair(responseText);
      const parsed = JSON.parse(repaired);
      return GeminiResponseSchema.parse(parsed);
    } catch {
      throw new HttpsError('internal', 'Failed to parse Gemini response');
    }
  }
}

// ─── Helper: Create audit log ────────────────────────────────────────────────

async function createClassificationLog(
  labId: string,
  stripId: string,
  classification: Classification,
  confidence: number,
  operatorId: string
): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  try {
    await db.collection(`labs/${labId}/imuno-ia-logs`).add({
      labId,
      stripId,
      classification,
      confidence,
      operatorId,
      timestamp: now,
      deletedAt: null,
    });
  } catch (error) {
    console.warn(`Failed to log classification for ${stripId}: ${error}`);
    // Non-fatal
  }
}

// ─── Callable A: classifyStripImage ──────────────────────────────────────────

/**
 * classifyStripImage
 *
 * Input:
 *   - labId: Lab identifier
 *   - stripId: Strip identifier
 *   - imageBase64: Base64-encoded image (optional)
 *   - referenceUrl: Firebase Storage signed URL (optional)
 *
 * Process:
 *   1. Fetch image (prefer base64, fallback to URL download)
 *   2. Call Gemini Vision API
 *   3. Validate confidence >= 0.85
 *   4. Store classification record in Firestore
 *   5. Create log event
 *
 * Response:
 *   - classification: Positive | Negative | Invalid | Grey-Zone
 *   - confidence: 0.0-1.0
 *   - stored_at: ISO timestamp
 *
 * Errors:
 *   - 400: Image URL invalid, image missing
 *   - 403: Unauthorized (non-member)
 *   - 409: Confidence threshold violated (< 0.85)
 *   - 504: Gemini API timeout
 */
export const classifyStripImage = onCall(async (request) => {
  // Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Parse and validate input
  let payload: ClassifyStripImagePayload;
  try {
    payload = ClassifyStripImagePayloadSchema.parse(request.data);
  } catch (error) {
    const validationError = error instanceof z.ZodError
      ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      : 'Unknown validation error';
    throw new HttpsError('invalid-argument', validationError);
  }

  // Verify at least one image source
  if (!payload.imageBase64 && !payload.referenceUrl) {
    throw new HttpsError('invalid-argument', 'imageBase64 or referenceUrl required');
  }

  // Verify user is member of lab
  const db = admin.firestore();
  const memberDoc = await db.doc(`labs/${payload.labId}/members/${request.auth.uid}`).get();
  if (!memberDoc.exists || !(memberDoc.data() as any)?.active) {
    throw new HttpsError('permission-denied', 'User is not an active member of this lab');
  }

  try {
    // Step 1: Get image as base64
    let base64Image = payload.imageBase64;
    if (!base64Image && payload.referenceUrl) {
      base64Image = await downloadImageAsBase64(payload.referenceUrl);
    }

    if (!base64Image) {
      throw new HttpsError('invalid-argument', 'Image data required');
    }

    // Step 2: Initialize Gemini client
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'Gemini API key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Step 3: Build prompt
    const prompt = `Analyze this rapid diagnostic test strip image and classify the result.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "classification": "Positive" | "Negative" | "Invalid" | "Grey-Zone",
  "confidence": <number 0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;

    // Step 4: Call Gemini
    const response = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
      { text: prompt },
    ]);

    const responseText = (response as any).content.parts
      .filter((part: any) => 'text' in part)
      .map((part: any) => part.text)
      .join('');

    if (!responseText) {
      throw new HttpsError('internal', 'Gemini API returned empty response');
    }

    // Step 5: Parse response
    const geminiResult = parseGeminiResponse(responseText);

    // Step 6: Validate confidence threshold
    const CONFIDENCE_THRESHOLD = 0.85;
    if (geminiResult.confidence < CONFIDENCE_THRESHOLD) {
      throw new HttpsError(
        'failed-precondition',
        `Confidence ${(geminiResult.confidence * 100).toFixed(1)}% below threshold ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%`
      );
    }

    // Step 7: Store classification record
    const now = admin.firestore.Timestamp.now();
    const classificationRecord: ImunoIAClassification = {
      labId: payload.labId,
      stripId: payload.stripId,
      classification: geminiResult.classification,
      confidence: geminiResult.confidence,
      reasoning: geminiResult.reasoning,
      storedAt: now,
      deletedAt: null,
    };

    await db
      .collection(`labs/${payload.labId}/ciq-imuno-results`)
      .doc('classifications')
      .collection('images')
      .doc(payload.stripId)
      .set(classificationRecord);

    // Step 8: Create log event
    await createClassificationLog(
      payload.labId,
      payload.stripId,
      geminiResult.classification,
      geminiResult.confidence,
      request.auth.uid
    );

    return {
      classification: geminiResult.classification,
      confidence: geminiResult.confidence,
      stored_at: now.toDate().toISOString(),
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

// ─── Callable B: collectIADataset ────────────────────────────────────────────

/**
 * collectIADataset
 *
 * Input:
 *   - labId: Lab identifier
 *   - stripId: Strip identifier
 *   - manualVerdict: Manual classification (Positive | Negative | Invalid | Grey-Zone)
 *   - justification: Reason for manual classification (1-500 chars)
 *
 * Process:
 *   1. Validate auditor role
 *   2. Fetch classification record
 *   3. Compare AI result vs manual verdict
 *   4. Store dataset record
 *   5. Increment dataset counter
 *
 * Response:
 *   - recorded: boolean (true if successful)
 *   - accuracy_delta: float (impact on monthly accuracy, can be negative)
 *
 * Errors:
 *   - 403: Unauthorized (non-auditor)
 *   - 404: Classification record not found
 */
export const collectIADataset = onCall(async (request) => {
  // Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Parse and validate input
  let payload: CollectIADatasetPayload;
  try {
    payload = CollectIADatasetPayloadSchema.parse(request.data);
  } catch (error) {
    const validationError = error instanceof z.ZodError
      ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      : 'Unknown validation error';
    throw new HttpsError('invalid-argument', validationError);
  }

  const db = admin.firestore();

  // Step 1: Verify auditor role
  const memberDoc = await db.doc(`labs/${payload.labId}/members/${request.auth.uid}`).get();
  if (!memberDoc.exists || !(memberDoc.data() as any)?.active) {
    throw new HttpsError('permission-denied', 'User is not an active member of this lab');
  }

  const memberData = memberDoc.data() as any;
  if (memberData.role !== 'auditor' && memberData.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only auditors can record dataset verdicts');
  }

  try {
    // Step 2: Fetch classification record
    const classificationRef = await db
      .collection(`labs/${payload.labId}/ciq-imuno-results`)
      .doc('classifications')
      .collection('images')
      .doc(payload.stripId)
      .get();

    if (!classificationRef.exists) {
      throw new HttpsError('not-found', `Classification record not found: ${payload.stripId}`);
    }

    const classification = classificationRef.data() as any;
    const aiClassification = classification.classification as Classification;
    const aiConfidence = classification.confidence;

    // Step 3: Determine if match
    const match = aiClassification === payload.manualVerdict;

    // Step 4: Store dataset record
    const now = admin.firestore.Timestamp.now();
    const datasetRecord: ImunoIADatasetRecord = {
      labId: payload.labId,
      stripId: payload.stripId,
      aiClassification,
      aiConfidence,
      manualVerdict: payload.manualVerdict,
      match,
      justification: payload.justification,
      recordedBy: request.auth.uid,
      recordedAt: now,
      deletedAt: null,
    };

    await db
      .collection(`labs/${payload.labId}/ciq-imuno-dataset`)
      .doc('records')
      .collection('verdicts')
      .doc(payload.stripId)
      .set(datasetRecord);

    // Step 5: Increment dataset counter and calculate accuracy
    const counterRef = db.collection(`labs/${payload.labId}/ciq-imuno-dataset`).doc('counter');
    const accuracyDelta = match ? 0.01 : -0.01; // Simplified: +1% per match, -1% per mismatch

    await db.runTransaction(async (tx) => {
      const counterDoc = await tx.get(counterRef);

      if (counterDoc.exists) {
        const data = counterDoc.data() as any;
        tx.update(counterRef, {
          totalRecorded: data.totalRecorded + 1,
          matchCount: data.matchCount + (match ? 1 : 0),
          lastUpdated: now,
        });
      } else {
        tx.set(counterRef, {
          labId: payload.labId,
          totalRecorded: 1,
          matchCount: match ? 1 : 0,
          lastUpdated: now,
          deletedAt: null,
        });
      }
    });

    return {
      recorded: true,
      accuracy_delta: accuracyDelta,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    console.error('Dataset collection error:', error);
    throw new HttpsError(
      'internal',
      `Dataset recording failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
});
