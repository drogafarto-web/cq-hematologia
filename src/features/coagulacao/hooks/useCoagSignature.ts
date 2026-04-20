import { useCallback } from 'react';
import { useUser } from '../../../store/useAuthStore';
import type { CoagNivel, CoagAnalyteId } from '../types/_shared_refs';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Campos incluídos no payload da assinatura lógica de uma corrida de coagulação.
 *
 * A ordem dos campos é canônica e imutável — alterar a ordem produz
 * uma assinatura diferente e invalida verificações retroativas.
 */
export interface CoagSignaturePayload {
  /** Documento profissional do operador (ex: "CRBM-MG 12345") */
  operatorDocument: string;
  /** ID do lote de controle no Firestore */
  lotId:            string;
  /** Nível do material de controle: I = normal, II = anticoagulado/patológico */
  nivel:            CoagNivel;
  /** Lote físico do material de controle */
  loteControle:     string;
  /**
   * Hash determinístico dos resultados: JSON canônico de {ap, rni, ttpa} em ordem fixa.
   * Gerado por `canonicalizeCoagResultados` antes de passar ao payload.
   */
  resultadosCanonical: string;
  /** Data de realização (YYYY-MM-DD) */
  dataRealizacao:   string;
}

export interface CoagSignatureResult {
  /** Hash SHA-256 em hexadecimal (64 caracteres) */
  logicalSignature: string;
  /** uid do Firebase Auth do operador — rastreabilidade extra */
  signedBy: string;
  /** ISO 8601 do momento da assinatura */
  signedAt: string;
}

// ─── Helper: canonicalização dos resultados ───────────────────────────────────

/**
 * Serializa os resultados da corrida em JSON canônico e determinístico.
 *
 * A ordem das chaves é FIXA (ap, rni, ttpa) — independente da ordem do
 * objeto de entrada. Isso garante que o hash seja idêntico para o mesmo
 * conjunto de valores, independentemente de como o objeto foi construído.
 *
 * Chamado antes de montar CoagSignaturePayload.resultadosCanonical.
 *
 * @param resultados  Mapa analito → valor numérico do tipo Record<CoagAnalyteId, number>.
 * @returns           String JSON canônica com chaves em ordem fixa.
 */
export function canonicalizeCoagResultados(
  resultados: Record<CoagAnalyteId, number>,
): string {
  return JSON.stringify({
    ap:   resultados.atividadeProtrombinica,
    rni:  resultados.rni,
    ttpa: resultados.ttpa,
  });
}

// ─── Pure helper (exportada para testes unitários) ────────────────────────────

/**
 * Gera SHA-256 sobre o payload canônico usando a Web Crypto API nativa.
 * Não usa bibliotecas externas — sem dependência de crypto-js.
 *
 * Campos serializados em ordem canônica e imutável:
 *   doc, lot, niv, ctrl, res, date
 */
export async function generateSignature(
  payload: CoagSignaturePayload,
): Promise<string> {
  const canonical = JSON.stringify({
    doc:  payload.operatorDocument,
    lot:  payload.lotId,
    niv:  payload.nivel,
    ctrl: payload.loteControle,
    res:  payload.resultadosCanonical,
    date: payload.dataRealizacao,
  });

  const encoded    = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCoagSignature — gera a assinatura lógica (SHA-256) de uma corrida CIQ-Coagulação.
 *
 * A assinatura vincula o operador identificado (operatorDocument) aos dados
 * da corrida de forma auditável e imutável (RDC 978/2025 Art.128).
 *
 * Uso:
 *   const { sign, isReady } = useCoagSignature();
 *   const result = await sign({
 *     operatorDocument,
 *     lotId,
 *     nivel,
 *     loteControle,
 *     resultadosCanonical: canonicalizeCoagResultados(resultados),
 *     dataRealizacao,
 *   });
 *   // result.logicalSignature → armazenar no documento Firestore
 */
export function useCoagSignature() {
  const user = useUser();

  const sign = useCallback(
    async (payload: CoagSignaturePayload): Promise<CoagSignatureResult> => {
      if (!user) {
        throw new Error('Usuário não autenticado. Impossível assinar a corrida.');
      }

      const logicalSignature = await generateSignature(payload);

      return {
        logicalSignature,
        signedBy: user.uid,
        signedAt: new Date().toISOString(),
      };
    },
    [user],
  );

  return {
    /** Função assíncrona que gera a assinatura SHA-256 */
    sign,
    /** false enquanto o usuário não estiver autenticado */
    isReady: user !== null,
  } as const;
}
