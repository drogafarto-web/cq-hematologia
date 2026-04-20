import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';
import type { Analyte, GeminiExtractionResponse, GeminiAnalyteResult } from '../../../types';

// ─── Callable reference ───────────────────────────────────────────────────────

interface ExtractFromImagePayload {
  base64: string;
  analyteIds: string[];
  mimeType: string;
}

interface ExtractFromImageResult {
  sampleId: string | null;
  results: Record<string, GeminiAnalyteResult>;
}

const _extractFromImage = httpsCallable<ExtractFromImagePayload, ExtractFromImageResult>(
  functions,
  'extractFromImage',
);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls the Firebase Function that invokes Gemini server-side.
 * The Gemini API key never leaves the server — it is stored as a Firebase Secret.
 *
 * @param base64   Base64-encoded image (no data URI prefix)
 * @param analytes List of analytes to extract for this lot
 * @param mimeType MIME type of the original file (e.g. 'image/jpeg')
 * @throws         Descriptive error on function failure or schema mismatch
 */
export async function extractDataFromImage(
  base64: string,
  analytes: Analyte[],
  mimeType: string,
): Promise<GeminiExtractionResponse> {
  if (!base64.trim()) throw new Error('Nenhuma imagem fornecida para extração.');
  if (analytes.length === 0) throw new Error('Nenhum analito definido no lote.');

  let result: HttpsCallableResult<ExtractFromImageResult>;

  try {
    result = await _extractFromImage({
      base64,
      analyteIds: analytes.map((a) => a.id),
      mimeType,
    });
  } catch (err: unknown) {
    throw mapFunctionsError(err);
  }

  const { sampleId, results } = result.data;

  return {
    sampleId: sampleId ?? undefined,
    results,
  };
}

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapFunctionsError(err: unknown): Error {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    const message = err instanceof Error ? err.message : String(err);

    if (code === 'functions/resource-exhausted') {
      return new Error('Cota da API Gemini excedida. Aguarde alguns instantes e tente novamente.');
    }
    if (code === 'functions/unauthenticated') {
      return new Error('Sessão expirada. Faça login novamente.');
    }
    if (code === 'functions/invalid-argument') {
      return new Error(
        'A imagem foi bloqueada por filtros de segurança. Tente uma foto diferente.',
      );
    }
    if (code === 'functions/internal') {
      // Strip the "functions/internal:" prefix Firebase adds
      const clean = message.replace(/^.*?:\s*/, '');
      return new Error(clean || 'Erro interno na extração. Tente novamente.');
    }
    return new Error(message);
  }

  const msg = err instanceof Error ? err.message : 'Erro desconhecido na extração.';
  return new Error(msg);
}
