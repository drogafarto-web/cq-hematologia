import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';
import { URO_ANALITOS, URO_ANALITOS_SEM_OCR } from '../UroAnalyteConfig';
import type { UroAnalitoId, UroValorCategorico } from '../types/_shared_refs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OcrField {
  /**
   * Valor sugerido pelo OCR. `null` quando a IA não conseguiu ler ou o analito
   * está em `URO_ANALITOS_SEM_OCR` (sempre manual por ambiguidade ótica).
   */
  valor: UroValorCategorico | number | null;
  /** Confiança no intervalo [0, 1]. 0 = não-leitura; >=0.85 = alta confiança. */
  confidence: number;
}

export type OcrResult = Record<UroAnalitoId, OcrField>;

// ─── Callable contract ────────────────────────────────────────────────────────

interface ParseUrinaPayload {
  base64: string;
  mimeType: string;
}

interface CfFieldString {
  valor: string | null;
  confidence: number;
}

interface CfFieldNumber {
  valor: number | null;
  confidence: number;
}

interface ParseUrinaResult {
  glicose: CfFieldString;
  cetonas: CfFieldString;
  proteina: CfFieldString;
  nitrito: CfFieldString;
  sangue: CfFieldString;
  leucocitos: CfFieldString;
  ph: CfFieldNumber;
}

const _parseUrinaTira = httpsCallable<ParseUrinaPayload, ParseUrinaResult>(
  functions,
  'parseUrinaTira',
);

// ─── Constants ────────────────────────────────────────────────────────────────

/** Tamanho máximo da imagem antes de chamar a IA: 4 MB. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** MIME types aceitos pelo backend. */
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

// ─── File → base64 ───────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Falha ao converter imagem para base64.'));
        return;
      }
      const [meta, data] = result.split(',');
      if (!meta || !data) {
        reject(new Error('Formato de base64 inesperado.'));
        return;
      }
      const mimeMatch = meta.match(/data:([^;]+);base64/);
      const mimeType = mimeMatch?.[1] ?? file.type;
      resolve({ base64: data, mimeType });
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * parseTiraReagente — leitura assistida por IA de tira reagente urinária.
 *
 * Fluxo:
 *   1. Converte File → base64 no cliente (sem upload para Storage).
 *   2. Envia para a Cloud Function `parseUrinaTira` via httpsCallable.
 *   3. CF invoca Gemini 3.1 Flash com fallback para OpenRouter.
 *   4. Prompt estruturado com valores exatos possíveis por analito.
 *   5. Zod valida a resposta antes de retornar ao cliente.
 *
 * Analitos NUNCA processados (retornam null + confidence 0):
 *   bilirrubina, urobilinogênio, densidade — contraste ótico insuficiente.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 (operador SEMPRE revisa a sugestão da IA).
 *
 * Roadmap RS232/USB (Uri View 200 WAMA): recebe 10 parâmetros diretamente do
 * analisador via Web Serial API, eliminando OCR e digitação manual. Após
 * estabilização do fluxo OCR atual.
 *
 * @param image  Foto da tira reagente (JPG/PNG/WebP).
 * @param _labId Reservado — a autenticação é feita server-side via Firebase Auth.
 */
export async function parseTiraReagente(image: File, _labId: string): Promise<OcrResult> {
  // Validação local antes de gastar quota da IA
  if (image.size > MAX_IMAGE_BYTES) {
    throw new Error('Imagem muito grande. Máximo: 4 MB.');
  }
  if (!ACCEPTED_MIME_TYPES.includes(image.type as AcceptedMimeType)) {
    throw new Error(`Formato não suportado (${image.type}). Use JPG, PNG ou WebP.`);
  }

  const { base64, mimeType } = await fileToBase64(image);

  const { data: cfResult } = await _parseUrinaTira({ base64, mimeType });

  // Mapeia resposta da CF (7 analitos) para OcrResult (10 analitos).
  // Os 3 em URO_ANALITOS_SEM_OCR permanecem null + confidence 0.
  const result: Partial<OcrResult> = {};

  for (const id of URO_ANALITOS) {
    if (URO_ANALITOS_SEM_OCR.includes(id)) {
      result[id] = { valor: null, confidence: 0 };
      continue;
    }

    if (id === 'ph') {
      result[id] = { valor: cfResult.ph.valor, confidence: cfResult.ph.confidence };
      continue;
    }

    // Analitos categóricos mapeados 1:1 por nome
    const cf = cfResult[id as Exclude<keyof ParseUrinaResult, 'ph'>];
    if (!cf) {
      result[id] = { valor: null, confidence: 0 };
      continue;
    }
    result[id] = {
      valor: cf.valor as UroValorCategorico | null,
      confidence: cf.confidence,
    };
  }

  return result as OcrResult;
}

// ─── Helper — filtra analitos que nunca recebem sugestão ──────────────────────

/**
 * Retorna apenas os analitos que devem receber sugestão do OCR.
 * Bilirrubina, Urobilinogênio e Densidade são sempre manuais —
 * contraste ótico insuficiente na cromatografia da tira reagente urinária.
 */
export function analytesSugeriveis(): UroAnalitoId[] {
  return URO_ANALITOS.filter((id) => !URO_ANALITOS_SEM_OCR.includes(id));
}
