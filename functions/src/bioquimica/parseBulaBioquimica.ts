/**
 * Cloud Function: parseBulaBioquimica
 *
 * Gemini 2.5 Flash multimodal parsing of bioquímica control material PDFs
 * Extracts: lote, validade, fornecedor, níveis com mean/sd por analito
 *
 * Auth: isActiveMemberOfLab
 * Rate limit: 60/min/lab
 * Region: southamerica-east1, Memory: 1GiB, Timeout: 60s
 * Secrets: GEMINI_API_KEY
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/system';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

initializeApp();
const db = getFirestore();
const geminiSecret = defineSecret('GEMINI_API_KEY');

// ─── Types ────────────────────────────────────────────────────────────────────

const BulaParseSchema = z.object({
  niveis: z.array(
    z.object({
      level: z.enum(['1', '2', '3']),
      lotNumber: z.string().optional(),
    }),
  ),
  manufacturerStats: z.record(
    z.string(), // e.g., 'nivel1', 'nivel2'
    z.record(
      z.string(), // analito name
      z.object({
        mean: z.number(),
        sd: z.number(),
      }),
    ),
  ),
  lote: z.string().optional(),
  validade: z.string().optional(),
  fornecedor: z.string().optional(),
  confidence: z.number().default(0.85),
});

export type BulaParseResult = z.infer<typeof BulaParseSchema>;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isActiveMemberOfLab(labId: string, uid: string): boolean {
  // TODO: implement actual member check from /labs/{labId}/members
  // For now, accept if uid exists
  return !!uid;
}

// ─── Rate limit check ─────────────────────────────────────────────────────────

async function checkRateLimit(labId: string): Promise<boolean> {
  const counterRef = db.collection('_function_calls').doc(`parseBula_${labId}`);
  const now = new Date();
  const minuteKey = Math.floor(now.getTime() / 60000);

  const doc = await counterRef.get();
  const data = doc.data() || {};
  const lastMinute = data.lastMinute || -1;
  const count = lastMinute === minuteKey ? (data.count || 0) : 0;

  if (count >= 60) {
    return false;
  }

  await counterRef.set({
    lastMinute: minuteKey,
    count: count + 1,
    updatedAt: now,
  });

  return true;
}

// ─── Main function ────────────────────────────────────────────────────────────

export const parseBulaBioquimica = onCall(
  {
    region: 'southamerica-east1',
    memory: '1GiB' as any,
    timeoutSeconds: 60,
    secrets: [geminiSecret],
  },
  async (request) => {
    const { labId, pdfBase64 } = request.data;
    const uid = request.auth?.uid;

    // Auth
    if (!uid || !isActiveMemberOfLab(labId, uid)) {
      throw new HttpsError('permission-denied', 'Not authorized');
    }

    // Rate limit
    if (!(await checkRateLimit(labId))) {
      throw new HttpsError('resource-exhausted', 'Rate limit exceeded (60/min/lab)');
    }

    // Validate PDF
    if (!pdfBase64 || pdfBase64.length === 0) {
      throw new HttpsError('invalid-argument', 'PDF data required');
    }

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    if (pdfBytes.length > 10 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'PDF exceeds 10 MB');
    }

    // Check magic bytes (PDF signature)
    if (!pdfBytes.toString('utf8', 0, 4).startsWith('%PDF')) {
      throw new HttpsError('invalid-argument', 'Invalid PDF format');
    }

    // Call Gemini
    const genAI = new GoogleGenerativeAI(geminiSecret.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    try {
      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
        {
          text: `
Você é um especialista em análise de bulas de produtos de controle de qualidade analítico (bioquímica clínica).

Analise a imagem/PDF e extraia:

1. Número do lote
2. Data de validade
3. Nome do fornecedor
4. Para CADA NÍVEL (N1, N2, N3 ou equivalente):
   - Lista de analitos com:
     - Nome exato do analito
     - Valor de referência/média
     - Desvio padrão

Retorne APENAS um JSON válido (sem markdown, sem explicações) com a estrutura:
{
  "niveis": [{"level": "1", "lotNumber": "..."}, ...],
  "manufacturerStats": {
    "nivel1": {"Analito Nome": {"mean": 120.5, "sd": 3.2}, ...},
    ...
  },
  "lote": "...",
  "validade": "YYYY-MM-DD",
  "fornecedor": "...",
  "confidence": 0.95
}

Se não conseguir extrair um campo, omita-o ou use null.
          `,
        },
      ]);

      if (!response.response.text()) {
        throw new Error('Empty Gemini response');
      }

      // Parse response
      const jsonText = response.response.text().trim();
      const parsed = JSON.parse(jsonText);
      const result = BulaParseSchema.parse(parsed);

      return result;
    } catch (error: any) {
      if (error.name === 'ZodError') {
        throw new HttpsError(
          'invalid-argument',
          `Invalid response format from Gemini: ${error.message}`,
        );
      }

      if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
        throw new HttpsError('deadline-exceeded', 'Gemini request timeout');
      }

      throw new HttpsError('internal', `Gemini error: ${error.message}`);
    }
  },
);
