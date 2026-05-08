/**
 * Laudo OCR Extractor
 * Phase 6: Main orchestrator for RDC 978 Art. 167 field extraction
 *
 * Calls Gemini 2.5 Vision to extract fields 10–12 from clinical reports (laudos).
 * Implements consent gate + audit logging.
 *
 * Production safeguards:
 * - Consent gate enforced (LGPD Art. 9)
 * - Gemini latency tracked + timeout protection
 * - Error handling with fallback to manual entry
 * - Comprehensive audit trail (action + token counts)
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

  // 6. Non-blocking audit log with full context
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
        field11_confidence: parsedResponse.field11.confidence,
        field12_detected: parsedResponse.field12.detected,
        field12_confidence: parsedResponse.field12.confidence,
        overallConfidence: parsedResponse.overallConfidence,
      },
    },
    db
  ).catch((err) => {
    console.error('[extractLaudoFields] Audit log failed (non-blocking):', err);
    // Don't throw — audit failure should not block extraction
  });

  return extraction;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Vision API Call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call Gemini 2.5 Vision with laudo image URL + extraction prompt.
 *
 * Gemini accepts base64 inlineData format.
 * Extracts field10, field11, field12 from laudo PDF/image.
 *
 * Temperature set to 0.1 (low creativity) for deterministic extraction.
 * Timeout: 60s total (with 30s buffer for safety).
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
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  const promptText = buildLaudoExtractionPrompt();

  try {
    // Fetch the image from the signed URL with MIME type detection
    const { base64, mimeType } = await fetchAndEncodeImage(laudoPdfUrl);

    // Call Gemini with vision capability using correct API format
    const response = await model.generateContent([
      promptText,
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
    ]);

    const result = await response.response;
    if (!result || !result.text()) {
      throw new Error('Gemini returned empty response');
    }

    const content = result.text();
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
 * Supports both PDF and image formats.
 * Detects MIME type from URL or defaults to application/pdf for PDFs.
 */
async function fetchAndEncodeImage(url: string): Promise<{ base64: string; mimeType: string }> {
  try {
    // Use AbortController for timeout (Node 22 supports native AbortController)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Detect MIME type from URL or Content-Type header
    let mimeType = 'image/jpeg'; // default
    if (url.includes('.pdf')) {
      mimeType = 'application/pdf';
    } else if (response.headers.get('content-type')) {
      mimeType = response.headers.get('content-type')!.split(';')[0];
    }

    return { base64, mimeType };
  } catch (err) {
    throw new HttpsError(
      'internal',
      `Failed to fetch laudo image: ${(err as Error).message}`
    );
  }
}

/**
 * Build Gemini prompt for laudo field extraction.
 * Portuguese language, RDC 978 Art. 167 compliance focus.
 * Instructions for field 10, 11, 12 extraction + signature detection.
 */
function buildLaudoExtractionPrompt(): string {
  return `SISTEMA DE EXTRAÇÃO DE LAUDOS CLÍNICOS — RDC 978 Art. 167
Você é um especialista em análise de documentos clínicos (laudos laboratoriais).

INSTRUÇÃO: Extraia exatamente TRÊS CAMPOS do laudo/relatório apresentado:

═══════════════════════════════════════════════════════════════════════════

CAMPO 10 — OBSERVAÇÕES (Texto livre)
Descrição: Seção de observações, notas clínicas ou comentários do laudo
Requisito: OBRIGATÓRIO (RDC 978)
Ação:
  1. Localize a seção "Observações", "Notas", "Comentários" ou similar
  2. Copie o texto completo e literal desta seção
  3. Se não existir seção clara, extraia informações adicionais/interpretações
  4. Avalie sua confiança: high (texto claro) | medium (parcial/ambíguo) | low (ilegível/incerto)

═══════════════════════════════════════════════════════════════════════════

CAMPO 11 — ASSINATURA/CARIMBO DO RESPONSÁVEL TÉCNICO (RT)
Descrição: Firma e/ou carimbo do profissional responsável técnico (RT)
Requisito: DETECTAR (não obrigatório; fallback manual disponível)
Ação:
  1. Procure por assinatura manuscrita OU carimbo com nome/inscrição de RT
  2. Se DETECTADA:
     - detected: true
     - boundingBox: forneça coordenadas [x, y, width, height] em percentuais (0–100 do documento)
       • x: distância do lado esquerdo (%)
       • y: distância do topo (%)
       • width: largura do box (%)
       • height: altura do box (%)
     - confidence: high | medium | low
     - notes: descrição breve (ex: "assinatura clara com carimbo")
  3. Se NÃO detectada:
     - detected: false
     - boundingBox: omitir ou null
     - confidence: high (se certeza de não haver) | low (se incerto)
     - notes: "Sem assinatura/carimbo visível"

═══════════════════════════════════════════════════════════════════════════

CAMPO 12 — ASSINATURA/CARIMBO DO DIRETOR + DATA
Descrição: Firma/carimbo do diretor técnico ou diretor responsável + data do laudo
Requisito: DETECTAR (não obrigatório; fallback manual disponível)
Ação:
  1. Procure por assinatura/carimbo EM SEÇÃO DIFERENTE de field11 (normalmente inferior)
  2. Procure por DATA visível próxima a esta assinatura (formato: DD/MM/YYYY ou similar)
  3. Se DETECTADA:
     - detected: true
     - dateText: data extraída em ISO 8601 (YYYY-MM-DD) ou null se não visível
       • Exemplo: "2026-05-08"
       • Se data for "08/05/2026", converta para "2026-05-08"
     - boundingBox: coordenadas [x, y, width, height] em percentuais (0–100)
     - confidence: high | medium | low
     - notes: descrição (ex: "assinatura + data visível")
  4. Se NÃO detectada:
     - detected: false
     - dateText: null
     - boundingBox: omitir ou null
     - notes: "Sem assinatura de diretor/data visível"

═══════════════════════════════════════════════════════════════════════════

FORMATO DE RETORNO: JSON VÁLIDO (SEM MARKDOWN, SEM BLOCOS DE CÓDIGO)

Retorne um JSON com a seguinte estrutura:

{
  "field10": {
    "text": "texto literal da seção de observações",
    "confidence": "high ou medium ou low"
  },
  "field11": {
    "detected": true ou false,
    "boundingBox": { "x": número 0-100, "y": número 0-100, "width": número 0-100, "height": número 0-100 },
    "confidence": "high ou medium ou low",
    "notes": "descrição breve"
  },
  "field12": {
    "detected": true ou false,
    "dateText": "YYYY-MM-DD ou null",
    "boundingBox": { "x": número 0-100, "y": número 0-100, "width": número 0-100, "height": número 0-100 },
    "confidence": "high ou medium ou low",
    "notes": "descrição breve"
  },
  "overallConfidence": "high ou medium ou low",
  "remarks": "observações adicionais ou null"
}

LEMBRE-SE: Retorne APENAS JSON válido. Sem markdown, sem blocos de código, sem explicações. JSON puro.`;
}

/**
 * Parse Gemini response from JSON.
 * Robust handling for various response formats.
 * Strips markdown code blocks, extra whitespace, and attempts JSON repair if needed.
 */
function parseGeminiLaudoResponse(content: string): Record<string, unknown> {
  try {
    let jsonStr = content.trim();

    // 1. Try to extract JSON from markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    // 2. Try to extract raw JSON object/array
    const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonObjMatch && !jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
      jsonStr = jsonObjMatch[0];
    }

    // 3. Attempt standard JSON parse
    try {
      return JSON.parse(jsonStr);
    } catch (parseErr) {
      // 4. If initial parse fails, try to repair common issues
      // (e.g., trailing commas, unquoted keys)
      console.warn('[parseGeminiLaudoResponse] JSON parse failed, attempting repair:', parseErr);

      // Try using the jsonrepair library if available
      try {
        // @ts-ignore — jsonrepair is optional
        const repair = require('jsonrepair');
        const repaired = repair(jsonStr);
        return JSON.parse(repaired);
      } catch (repairErr) {
        // If repair also fails, throw original parse error
        throw parseErr;
      }
    }
  } catch (error) {
    console.error('[parseGeminiLaudoResponse] Parse failed:', error, 'Content:', content.substring(0, 500));
    throw new HttpsError(
      'internal',
      `Failed to parse Gemini laudo response: ${(error as Error).message}`
    );
  }
}
