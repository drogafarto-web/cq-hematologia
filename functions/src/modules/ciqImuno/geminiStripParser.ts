/**
 * geminiStripParser — Phase 5 W3-SA-32
 *
 * Cloud Function callable for immunoassay strip OCR via Gemini 2.5 Flash.
 * Input: base64 image + expected analytes
 * Output: parsed analytes with confidence scores
 *
 * LGPD: No patient identifiers in request or response.
 * Logs every run to /labs/{labId}/ia-strip-runs/ for audit + dataset.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import { db } from '../../shared/firebase';
import { z } from 'zod';

// ─── Secrets ────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedAnalyte {
  name: string;
  value: number;
  unit: string;
  confidence: number;
}

export interface StripParseResult {
  analytes: ParsedAnalyte[];
  rawJson: string;
  modelVersion: string;
}

// ─── Input validation ───────────────────────────────────────────────────────

const GeminiParserInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  imageBase64: z.string().min(1, 'imageBase64 required'),
  expectedAnalytes: z.array(z.string()).min(1, 'expectedAnalytes required'),
});

// ─── Gemini callable ────────────────────────────────────────────────────────

export const geminiStripParser = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: [GEMINI_API_KEY],
    memory: '1GiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    try {
      // Auth + validate input
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User not authenticated');
      }

      const { labId, imageBase64, expectedAnalytes } = GeminiParserInputSchema.parse(
        request.data
      );

      // Verify user is member of lab
      const memberDoc = await db
        .collection('labs')
        .doc(labId)
        .collection('members')
        .doc(request.auth.uid)
        .get();
      if (!memberDoc.exists) {
        throw new HttpsError('permission-denied', 'Not a member of this lab');
      }

      // Validate image size (<12 MB after decoding)
      const imageSizeBytes = Buffer.byteLength(imageBase64, 'base64');
      const MAX_IMAGE_SIZE_BYTES = 12 * 1024 * 1024;
      if (imageSizeBytes > MAX_IMAGE_SIZE_BYTES) {
        throw new HttpsError('invalid-argument', `Image too large (max 12 MB): ${imageSizeBytes}`);
      }

      // Call Gemini 2.5 Flash
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const systemPrompt = `You are a lab assistant specialized in reading immunoassay analyte strips.
Your task is to extract analyte readings from strip images.

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "analytes": [
    {"name": "TSH", "value": 2.5, "unit": "mIU/L", "confidence": 0.95},
    ...
  ]
}`;

      const userPrompt = `Extract analytes from this strip image.
Expected analytes to look for: ${expectedAnalytes.join(', ')}
Return ONLY the JSON response with analyzed values and confidence scores (0-1).`;

      let response;
      let attempts = 0;
      let lastError: any;

      // Retry once on JSON parse failure
      while (attempts < 2) {
        try {
          response = await model.generateContent([
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              text: systemPrompt + '\n\n' + userPrompt,
            },
          ]);

          const text = response.response.text();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            lastError = new Error('No JSON in response');
            attempts++;
            continue;
          }

          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.analytes || !Array.isArray(parsed.analytes)) {
            lastError = new Error('Invalid JSON structure');
            attempts++;
            continue;
          }

          // Success — log and return
          const result: StripParseResult = {
            analytes: parsed.analytes.map((a: any) => ({
              name: String(a.name || ''),
              value: Number(a.value || 0),
              unit: String(a.unit || ''),
              confidence: Number(a.confidence || 0.5),
            })),
            rawJson: jsonMatch[0],
            modelVersion: 'gemini-2.5-flash',
          };

          // Log to dataset collection
          try {
            const logRef = db
              .collection('labs')
              .doc(labId)
              .collection('ia-strip-runs')
              .doc(admin.firestore().collection('_').doc().id);

            await logRef.set({
              labId,
              imageSize: imageSizeBytes,
              expectedAnalytes,
              result: result.analytes,
              modelVersion: result.modelVersion,
              uploadedBy: request.auth.uid,
              uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } catch (logErr) {
            console.warn('[geminiStripParser] Failed to log run:', logErr);
            // Non-blocking
          }

          return result;
        } catch (parseErr) {
          lastError = parseErr;
          attempts++;
        }
      }

      throw new HttpsError(
        'internal',
        `Gemini returned non-JSON after 2 attempts: ${lastError?.message || 'unknown error'}`
      );
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }

      if (err instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', `Validation: ${err.message}`);
      }

      console.error('[geminiStripParser] Error:', err);
      throw new HttpsError('internal', 'Strip parsing failed');
    }
  }
);
