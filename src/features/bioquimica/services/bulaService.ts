/**
 * Bula Service — bioquímica
 * PDF parsing + application orchestration
 *
 * Delegates to Cloud Functions:
 * - parseBulaBioquimica: Gemini Vision + Zod validation
 * - applyBulaToLot: atomic apply to lot
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import type {
  BulaParseResult,
  ControlMaterial,
} from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParseBulaPayload {
  labId: string;
  pdfBase64: string;
}

export interface ApplyBulaPayload {
  labId: string;
  lotId: string;
  parseResult: BulaParseResult;
}

export interface ApplyBulaResponse {
  success: boolean;
  message?: string;
}

// ─── Callables ────────────────────────────────────────────────────────────────

const parseBulaBioquimicaCallable = httpsCallable<ParseBulaPayload, BulaParseResult>(
  functions,
  'parseBulaBioquimica',
);

const applyBulaToLotCallable = httpsCallable<ApplyBulaPayload, ApplyBulaResponse>(
  functions,
  'applyBulaToLot',
);

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a bula PDF using Gemini Vision
 * Returns parsed result with analitos × níveis + manufacturerStats
 *
 * @param labId Multi-tenant context
 * @param pdfFile PDF file object
 * @returns Promise<BulaParseResult> with parsed data or throws on error
 *
 * Errors:
 * - PDF validation (format, size)
 * - Gemini timeout
 * - Rate limit (60/min/lab)
 * - Invalid response format
 */
export async function processBula(
  labId: string,
  pdfFile: File,
): Promise<BulaParseResult> {
  // Validate client-side
  if (!pdfFile.type.includes('pdf')) {
    throw new Error('Arquivo deve ser um PDF válido');
  }
  if (pdfFile.size > 10 * 1024 * 1024) {
    throw new Error('PDF não pode exceder 10 MB');
  }

  // Convert to base64
  const arrayBuffer = await pdfFile.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const binaryString = Array.from(uint8Array)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  const pdfBase64 = btoa(binaryString);

  try {
    const response = await parseBulaBioquimicaCallable({
      labId,
      pdfBase64,
    });

    return response.data;
  } catch (error: any) {
    // Parse function-specific errors
    const message = error?.message || 'Erro ao processar bula';

    if (message.includes('rate limit')) {
      throw new Error('Muitas tentativas. Por favor aguarde 1 minuto.');
    }
    if (message.includes('timeout')) {
      throw new Error('Tempo limite excedido. Tente novamente ou cadastre manualmente.');
    }
    if (message.includes('invalid') || message.includes('parse')) {
      throw new Error('PDF inválido ou corrompido. Tente outro arquivo.');
    }

    throw new Error(message);
  }
}

/**
 * Apply parsed bula data to an existing lot
 * Atomically updates manufacturerStats, bulaPendente flag, and audit trail
 *
 * @param labId Multi-tenant context
 * @param lotId Lot to apply bula to
 * @param parseResult Parsed bula data from processBula()
 *
 * Errors:
 * - Lot not found
 * - Lot not pending bula
 * - Concurrent apply (race condition)
 */
export async function applyBula(
  labId: string,
  lotId: string,
  parseResult: BulaParseResult,
): Promise<void> {
  try {
    await applyBulaToLotCallable({
      labId,
      lotId,
      parseResult,
    });
  } catch (error: any) {
    const message = error?.message || 'Erro ao aplicar bula ao lote';

    if (message.includes('not found')) {
      throw new Error('Lote não encontrado');
    }
    if (message.includes('already-applied')) {
      throw new Error('Bula já foi aplicada a este lote');
    }

    throw new Error(message);
  }
}
