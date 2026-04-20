import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';
import type { ManufacturerStats, BulaLevelData, PendingBulaData } from '../../../types';

// ─── Callable payload / result types ─────────────────────────────────────────

interface ExtractFromBulaPayload {
  base64: string;
  mimeType: string;
}

interface RawBulaAnalyte {
  analyteId: string;
  mean: number;
  sd: number;
  equipmentSource?: string;
}

interface RawBulaLevel {
  level: 1 | 2 | 3;
  lotNumber?: string | null;
  analytes: RawBulaAnalyte[];
}

interface ExtractFromBulaResult {
  controlName?: string | null;
  expiryDate?: string | null;
  levels: RawBulaLevel[];
}

const _extractFromBula = httpsCallable<ExtractFromBulaPayload, ExtractFromBulaResult>(
  functions,
  'extractFromBula',
);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls the Firebase Function that invokes Gemini server-side to parse a
 * hematology control bula PDF and extract manufacturer stats for all levels.
 * The Gemini API key never leaves the server — stored as a Firebase Secret.
 *
 * Returns a `PendingBulaData` with one `BulaLevelData` entry per level found
 * in the PDF (up to 3). Fallback analytes (Pentra instead of Yumizen) are
 * indicated via the `equipmentSources` map inside each level.
 *
 * @param base64   Base64-encoded PDF (no data URI prefix)
 * @param mimeType Should be 'application/pdf'
 */
export async function extractDataFromBulaPdf(
  base64: string,
  mimeType: string = 'application/pdf',
): Promise<PendingBulaData> {
  if (!base64.trim()) throw new Error('Nenhum arquivo fornecido para extração.');

  const warnings: string[] = [];
  let result: HttpsCallableResult<ExtractFromBulaResult>;

  try {
    result = await _extractFromBula({ base64, mimeType });
  } catch (err: unknown) {
    throw mapFunctionsError(err);
  }

  const data = result.data;

  // Parse expiry date
  let expiryDate: Date | null = null;
  if (data.expiryDate) {
    const d = new Date(data.expiryDate);
    if (!isNaN(d.getTime())) {
      expiryDate = d;
    } else {
      warnings.push('Data de vencimento não reconhecida — preencha manualmente.');
    }
  }

  // Map levels
  const levels: BulaLevelData[] = (data.levels ?? []).map((rawLevel) => {
    const manufacturerStats: ManufacturerStats = {};
    const equipmentSources: Record<string, string> = {};

    for (const { analyteId, mean, sd, equipmentSource } of rawLevel.analytes ?? []) {
      manufacturerStats[analyteId] = { mean, sd };
      if (equipmentSource) {
        equipmentSources[analyteId] = equipmentSource;
      }
    }

    return {
      level: rawLevel.level,
      lotNumber: rawLevel.lotNumber ?? null,
      manufacturerStats,
      equipmentSources: Object.keys(equipmentSources).length > 0 ? equipmentSources : undefined,
    };
  });

  if (levels.length === 0) {
    warnings.push('Nenhum nível extraído. Verifique se o PDF contém tabelas de valores esperados.');
  } else {
    for (const lvl of levels) {
      if (Object.keys(lvl.manufacturerStats).length === 0) {
        warnings.push(`Nível ${lvl.level}: nenhum analito extraído.`);
      }

      // Count fallback analytes for this level
      const fallbackCount = Object.values(lvl.equipmentSources ?? {}).filter(
        (src) => !src.toLowerCase().includes('yumizen') && !src.toLowerCase().includes('horiba'),
      ).length;
      if (fallbackCount > 0) {
        warnings.push(
          `Nível ${lvl.level}: ${fallbackCount} analito(s) extraídos do equipamento de fallback (Pentra).`,
        );
      }
    }
  }

  return {
    controlName: data.controlName ?? null,
    expiryDate,
    levels,
    warnings,
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
    if (code === 'functions/internal') {
      // Strip any "FirebaseError: " or similar prefix injected by the SDK.
      const clean = message.replace(/^[^:]+:\s*/, '').trim();
      // If the SDK returned the raw code word ("internal") it means the server
      // threw an unhandled exception — no useful detail reached the client.
      const isGeneric = !clean || clean.toLowerCase() === 'internal';
      return new Error(
        isGeneric
          ? 'Erro interno na extração da bula. Verifique os logs da função e tente novamente.'
          : clean,
      );
    }
    return new Error(message);
  }

  const msg = err instanceof Error ? err.message : 'Erro desconhecido na extração.';
  return new Error(`Falha na comunicação com a IA: ${msg}`);
}
