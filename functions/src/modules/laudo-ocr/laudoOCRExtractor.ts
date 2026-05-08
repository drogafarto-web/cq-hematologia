/**
 * Laudo OCR Extractor
 * Phase 6: Main orchestrator for RDC 978 Art. 167 field extraction
 *
 * Calls Gemini 2.5 Vision to extract fields 10–12 from clinical reports (laudos).
 * Implements consent gate + audit logging.
 */

import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HttpsError } from 'firebase-functions/v2/https';
import { consentGate } from '../ia-strip/guardrails/consentGate';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';
import {
  LaudoExtractedFields,
  LaudoOCRGeminiResponse,
  LaudoOCRGeminiResponseSchema,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Main Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract laudo fields 10–12 via Gemini Vision.
 *
 * Input:
 *   - laudoPdfUrl: signed Cloud Storage URL to laudo (PDF or image)
 *   - labId: lab identifier
 *   - patientId: optional patient ID (for consent validation)
 *
 * Output:
 *   - LaudoExtractedFields with field10, field11, field12, timestamps
 *
 * Consent gate:
 *   - If patientId provided, verify patient has iaProcessing consent before calling Gemini
 *   - Throws HttpsError('failed-precondition', 'consent-not-captured') if missing
 *
 * Audit:
 *   - Logs to auditLogs collection with action='laudo-ocr-extracted'
 *   - Includes token counts, latency, source='auto'
 */
export async function extractLaudoFields(
  laudoPdfUrl: string,
  labId: string,
  patientId?: string,
  operatorId?: string,
  firestore?: admin.firestore.Firestore
): Promise<LaudoExtractedFields> {
  const db = firestore ?? admin.firestore();

  // 1. Validate inputs
  if (!laudoPdfUrl || !laudoPdfUrl.startsWith('https://')) {
    throw new HttpsError('invalid-argument', 'Invalid laudoPdfUrl (must be signed Cloud Storage URL)');
  }

  if (!labId) {
    throw new HttpsError('invalid-argument', 'labId required');
  }

  // 2. Consent gate (if patient ID provided)
  if (patientId) {
    try {
      await consentGate({ labId, patientId, firestore: db });
    } catch (err) {
      throw new HttpsError(
        'failed-precondition',
        `Patient consent not captured: ${(err as Error).message}`
      );
    }
  }

  // 3. Call Gemini Vision API
  const startTime = Date.now();
  const geminiResult = await callGeminiVisionLaudo(laudoPdfUrl);
  const geminiLatencyMs = Date.now() - startTime;

  // 4. Validate Gemini response
  let parsedResponse: LaudoOCRGeminiResponse;
  try {
    parsedResponse = LaudoOCRGeminiResponseSchema.parse(geminiResult);
  } catch (err) {
    throw new HttpsError(
      'internal',
      `Gemini response validation failed: ${(err as Error).message}`
    );
  }

  // 5. Construct extraction result
  const now = admin.firestore.Timestamp.now();
  const extraction: LaudoExtractedFields = {
    labId,
    laudoId: '', // Will be filled by callable
    field10: parsedResponse.field10,
    field11: parsedResponse.field11,
    field12: parsedResponse.field12,
    source: 'auto',
    extractedAt: now,
    extractedBy: operatorId ?? 'system',
    status: 'completed',
    geminiLatencyMs,
    rawGeminiResponse: geminiResult,
  };

  // 6. Non-blocking audit log
  await writeAuditLog(
    {
      action: 'laudo-ocr-extracted',
      labId,
      operatorId: operatorId ?? 'system',
      source: 'auto',
      geminiLatencyMs,
      payload: {
        field10_confidence: parsedResponse.field10.confidence,
        field11_detected: parsedResponse.field11.detected,
        field12_detected: parsedResponse.field12.detected,
      },
    },
    db
  ).catch((err) => {
    console.error('[extractLaudoFields] Audit log failed:', err);
  });

  return extraction;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Vision API Call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call Gemini 2.5 Vision with laudo image URL + extraction prompt.
 *
 * Gemini accepts URLs directly via inlineData format.
 * Extracts field10, field11, field12 from laudo PDF/image.
 *
 * Returns raw parsed JSON from model (before schema validation).
 */
async function callGeminiVisionLaudo(
  laudoPdfUrl: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('internal', 'GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = buildLaudoExtractionPrompt();

  try {
    // Fetch the image from the signed URL
    const imageBase64 = await fetchAndEncodeImage(laudoPdfUrl);

    // Call Gemini with vision capability
    const response = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg', // Assume PDF was converted to JPEG; could be adaptive
        },
      },
      {
        text: prompt,
      },
    ]);

    const content = response.response.text();
    return parseGeminiLaudoResponse(content);
  } catch (error) {
    console.error('[callGeminiVisionLaudo] Error:', error);
    throw new HttpsError(
      'internal',
      `Gemini Vision API failed: ${(error as Error).message}`
    );
  }
}

/**
 * Fetch image from signed Cloud Storage URL and encode as base64.
 * This is a placeholder — in production, would use fetch() or
 * Cloud Storage Admin SDK to stream the file.
 */
async function fetchAndEncodeImage(url: string): Promise<string> {
  try {
    // Placeholder: in production, implement actual fetch + base64 encode
    // For now, assume the URL is valid and return a dummy base64
    // A real implementation would use Node's fetch or Cloud Storage SDK

    const fetch = require('node-fetch');
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    const buffer = await response.buffer();
    return buffer.toString('base64');
  } catch (err) {
    throw new HttpsError(
      'internal',
      `Failed to fetch laudo image: ${(err as Error).message}`
    );
  }
}

/**
 * Build Gemini prompt for laudo field extraction.
 * Instructions for field 10, 11, 12 extraction + signature detection.
 */
function buildLaudoExtractionPrompt(): string {
  return `Você está analisando um laudo clínico (relatório de resultado de laboratório).

EXTRAIR E ANALISAR TRÊS CAMPOS:

**Campo 10 — Observações (Texto livre)**
- Copie exatamente o texto da seção "Observações" ou "Notas Clínicas"
- Este campo é obrigatório
- Confiança: high | medium | low

**Campo 11 — Assinatura/Carimbo do Responsável Técnico (RT)**
- Detectar presença de assinatura OU carimbo
- Se presente: fornecer bounding box [x, y, width, height] como percentuais (0–100)
- Se ausente: detected=false
- Confiança: high | medium | low

**Campo 12 — Assinatura/Carimbo do Diretor do Lab + Data**
- Detectar presença de assinatura OU carimbo
- Se presente: extrair data visível (se houver)
- Se presente: fornecer bounding box [x, y, width, height] como percentuais (0–100)
- Se ausente: detected=false
- Confiança: high | medium | low

RETORNE JSON VÁLIDO (sem markdown):

{
  "field10": {
    "text": "...",
    "confidence": "high|medium|low"
  },
  "field11": {
    "detected": true|false,
    "boundingBox": { "x": 0–100, "y": 0–100, "width": 0–100, "height": 0–100 },
    "confidence": "high|medium|low",
    "notes": "..."
  },
  "field12": {
    "detected": true|false,
    "dateText": "data extraída (ISO 8601) ou null",
    "boundingBox": { "x": 0–100, "y": 0–100, "width": 0–100, "height": 0–100 },
    "confidence": "high|medium|low",
    "notes": "..."
  },
  "overallConfidence": "high|medium|low",
  "remarks": "..."
}`;
}

/**
 * Parse Gemini response from JSON.
 * Handles both markdown code blocks and raw JSON.
 */
function parseGeminiLaudoResponse(content: string): Record<string, unknown> {
  try {
    let jsonStr = content;

    // Try markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1];
    } else {
      // Try raw JSON
      const rawJsonMatch = content.match(/\{[\s\S]*\}/);
      if (rawJsonMatch) {
        jsonStr = rawJsonMatch[0];
      }
    }

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[parseGeminiLaudoResponse] Parse failed:', error, 'Content:', content);
    throw new HttpsError(
      'internal',
      `Failed to parse Gemini laudo response: ${(error as Error).message}`
    );
  }
}
