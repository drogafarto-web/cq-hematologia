import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { GEMINI_MODEL, GEMINI_OCR_PROMPT } from '../../../constants';
import type { Analyte, GeminiExtractionResponse } from '../../../types';

// ─── Zod schema — validates Gemini response before it touches domain types ────

const AnalyteResultSchema = z.object({
  value:      z.number().min(0),
  confidence: z.number().min(0).max(1),
  reasoning:  z.string(),
});

const GeminiResponseSchema = z.object({
  sampleId: z.string().nullable().optional(),
  results:  z.record(z.string(), AnalyteResultSchema),
});

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client) return _client;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey || apiKey === 'SUA_CHAVE_GEMINI_AQUI') {
    throw new Error(
      'Chave da API Gemini não configurada. Defina VITE_GEMINI_API_KEY no arquivo .env.'
    );
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// ─── Main extraction function ─────────────────────────────────────────────────

/**
 * Sends the image to Gemini for OCR extraction and validates the response.
 * Does NOT save anything — caller is responsible for persistence.
 *
 * @param base64   Base64-encoded image (no data URI prefix)
 * @param analytes List of analytes to extract for this lot
 * @param mimeType MIME type of the original file (e.g. 'image/jpeg')
 * @throws         Descriptive error on API failure, empty response, or schema mismatch
 */
export async function extractDataFromImage(
  base64: string,
  analytes: Analyte[],
  mimeType: string
): Promise<GeminiExtractionResponse> {
  if (!base64.trim())    throw new Error('Nenhuma imagem fornecida para extração.');
  if (analytes.length === 0) throw new Error('Nenhum analito definido no lote.');

  const client   = getClient();
  const prompt   = GEMINI_OCR_PROMPT(analytes.map((a) => a.id));

  // ── API call ───────────────────────────────────────────────────────────────
  let rawText: string;

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    rawText = response.text ?? '';
  } catch (err) {
    rawText = ''; // Satisfy TS; re-throw below
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
      throw new Error('Cota da API Gemini excedida. Aguarde alguns instantes e tente novamente.');
    }
    if (msg.toUpperCase().includes('SAFETY')) {
      throw new Error('A imagem foi bloqueada por filtros de segurança. Tente uma foto diferente.');
    }
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
      throw new Error('Sem conexão com a internet. Verifique sua rede e tente novamente.');
    }

    throw new Error(`Falha na comunicação com a IA: ${msg}`);
  }

  // ── Response validation ────────────────────────────────────────────────────

  if (!rawText.trim()) {
    throw new Error('A IA retornou uma resposta vazia. Tente tirar uma foto mais clara do equipamento.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('A IA retornou dados em formato inválido. Tente novamente.');
  }

  const validation = GeminiResponseSchema.safeParse(parsed);
  if (!validation.success) {
    console.error('[geminiService] Schema validation failed:', validation.error.flatten());
    throw new Error(
      'A IA retornou dados fora do formato esperado. ' +
      'Verifique se a foto está nítida e tente novamente.'
    );
  }

  const { data } = validation;

  if (Object.keys(data.results).length === 0) {
    throw new Error(
      'Nenhum analito foi reconhecido na imagem. ' +
      'Verifique se a foto mostra a tela completa do equipamento.'
    );
  }

  return {
    sampleId: data.sampleId ?? undefined,
    results:  data.results,
  };
}
