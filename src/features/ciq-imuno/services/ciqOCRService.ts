import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';
import type { TestType } from '../types/_shared_refs';

// ─── Callable payload / result types ─────────────────────────────────────────

interface AnalyzeStripPayload {
  base64: string;
  mimeType: string;
  testType: TestType;
}

interface AnalyzeStripResult {
  resultadoObtido: 'R' | 'NR';
  confidence: 'high' | 'medium' | 'low';
}

const _analyzeImmunoStrip = httpsCallable<AnalyzeStripPayload, AnalyzeStripResult>(
  functions,
  'analyzeImmunoStrip',
);

// ─── Constants ────────────────────────────────────────────────────────────────

/** Tamanho máximo da imagem antes de chamar a IA: 4 MB */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** MIME types aceitos pelo backend */
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

// ─── Public API ───────────────────────────────────────────────────────────────

export interface StripAnalysisResult {
  resultadoObtido: 'R' | 'NR';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Envia a foto de um strip de imunoensaio para a Cloud Function `analyzeImmunoStrip`
 * e retorna o resultado (R/NR) com nível de confiança da IA.
 *
 * A chave Gemini nunca sai do servidor — este serviço apenas empacota a imagem
 * e delega ao callable, que faz a chamada à IA com fallback automático.
 *
 * @param file     Arquivo de imagem capturado pelo input[type=file] ou câmera
 * @param testType Tipo de imunoensaio (informado ao prompt da IA para maior precisão)
 */
export async function analyzeStripImage(
  file: File,
  testType: TestType,
): Promise<StripAnalysisResult> {
  // Valida tipo MIME antes de fazer qualquer I/O
  if (!ACCEPTED_MIME_TYPES.includes(file.type as AcceptedMimeType)) {
    throw new Error(
      `Formato não suportado: ${file.type || '(desconhecido)'}. Use JPEG, PNG ou WebP.`,
    );
  }

  // Valida tamanho antes de converter (evita travar a UI em arquivos grandes)
  if (file.size > MAX_IMAGE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Imagem muito grande (${sizeMB} MB). O tamanho máximo é 4 MB.`);
  }

  const base64 = await fileToBase64(file);

  try {
    const result = await _analyzeImmunoStrip({
      base64,
      mimeType: file.type,
      testType,
    });
    return result.data;
  } catch (err: unknown) {
    throw mapFunctionsError(err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converte um File para base64 puro (sem prefixo data URI).
 * Usa FileReader para compatibilidade máxima com webviews mobile.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:<mime>;base64," — o backend espera base64 puro
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Falha ao converter imagem para base64.'));
      } else {
        resolve(base64);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapFunctionsError(err: unknown): Error {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    const message = err instanceof Error ? err.message : String(err);

    if (code === 'functions/unauthenticated') {
      return new Error('Sessão expirada. Faça login novamente.');
    }
    if (code === 'functions/invalid-argument') {
      const clean = message.replace(/^[^:]+:\s*/, '').trim();
      return new Error(clean || 'Dados inválidos enviados para análise.');
    }
    if (code === 'functions/resource-exhausted') {
      return new Error('Cota da IA excedida. Aguarde alguns instantes e tente novamente.');
    }
    if (code === 'functions/internal') {
      const clean = message.replace(/^[^:]+:\s*/, '').trim();
      const isGeneric = !clean || clean.toLowerCase() === 'internal';
      return new Error(
        isGeneric
          ? 'Erro interno na análise do strip. Verifique os logs e tente novamente.'
          : clean,
      );
    }
    return new Error(message.replace(/^[^:]+:\s*/, '').trim() || 'Erro desconhecido.');
  }

  const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
  return new Error(`Falha na comunicação com a IA: ${msg}`);
}
