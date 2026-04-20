import { useCallback } from 'react';
import { useUser } from '../../../store/useAuthStore';
import { URO_ANALITOS } from '../UroAnalyteConfig';
import type { UroNivel, UroAnalitoId, UroValorCategorico } from '../types/_shared_refs';
import type { UroanaliseRun, UroFieldAuditado } from '../types/Uroanalise';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Campos incluídos no payload da assinatura lógica de uma corrida de uroanálise.
 *
 * A ordem dos campos é canônica e imutável — alterar a ordem produz
 * uma assinatura diferente e invalida verificações retroativas.
 */
export interface UroSignaturePayload {
  /** Documento profissional do operador (ex: "CRBM-MG 12345") */
  operatorDocument: string;
  /** ID do lote de controle no Firestore */
  lotId:            string;
  /** Nível do material de controle: N = normal/negativo, P = patológico/elevado */
  nivel:            UroNivel;
  /** Lote físico do material de controle urinário */
  loteControle:     string;
  /** Lote das tiras reagentes utilizadas */
  loteTira:         string;
  /**
   * Hash determinístico dos resultados (categóricos + numéricos).
   * Gerado por `canonicalizeUroResultados` antes de passar ao payload.
   * Itera os analitos em ordem canônica (URO_ANALITOS) para garantir determinismo
   * independente da ordem de preenchimento do formulário.
   */
  resultadosCanonical: string;
  /** Data de realização (YYYY-MM-DD) */
  dataRealizacao:   string;
}

export interface UroSignatureResult {
  /** Hash SHA-256 em hexadecimal (64 caracteres) */
  logicalSignature: string;
  /** uid do Firebase Auth do operador — rastreabilidade extra */
  signedBy: string;
  /** ISO 8601 do momento da assinatura */
  signedAt: string;
}

// ─── Helper: canonicalização dos resultados ───────────────────────────────────

/**
 * Serializa os resultados de uroanálise em JSON canônico e determinístico.
 *
 * Itera `URO_ANALITOS` em ordem fixa (urobilinogenio → glicose → cetonas → ...),
 * garantindo que o hash seja idêntico para o mesmo conjunto de valores independente
 * da ordem de preenchimento do formulário ou da construção do objeto.
 *
 * Campos não preenchidos (analito ausente ou valor null) aparecem como `null`
 * no JSON — assegura que o hash discrimine entre "não preenchido" e "zero".
 *
 * @param resultados  Mapa de resultados da corrida (`UroanaliseRun['resultados']`).
 * @returns           String JSON canônica com chaves em ordem fixa (URO_ANALITOS).
 */
export function canonicalizeUroResultados(
  resultados: UroanaliseRun['resultados'],
): string {
  const canonical: Record<string, UroValorCategorico | number | null> = {};

  for (const analito of URO_ANALITOS) {
    const campo = resultados[analito as keyof typeof resultados] as
      | UroFieldAuditado<UroValorCategorico>
      | UroFieldAuditado<number>
      | undefined;

    canonical[analito] = campo?.valor ?? null;
  }

  return JSON.stringify(canonical);
}

// ─── Pure helper (exportada para testes unitários) ────────────────────────────

/**
 * Gera SHA-256 sobre o payload canônico usando a Web Crypto API nativa.
 * Não usa bibliotecas externas — sem dependência de crypto-js.
 *
 * Campos serializados em ordem canônica e imutável:
 *   doc, lot, niv, ctrl, tira, res, date
 */
export async function generateSignature(
  payload: UroSignaturePayload,
): Promise<string> {
  const canonical = JSON.stringify({
    doc:  payload.operatorDocument,
    lot:  payload.lotId,
    niv:  payload.nivel,
    ctrl: payload.loteControle,
    tira: payload.loteTira,
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
 * useUroSignature — gera a assinatura lógica (SHA-256) de uma corrida CIQ-Uroanálise.
 *
 * A assinatura vincula o operador identificado (operatorDocument) aos dados
 * da corrida de forma auditável e imutável (RDC 978/2025 Art.128).
 *
 * Uso:
 *   const { sign, isReady } = useUroSignature();
 *   const result = await sign({
 *     operatorDocument,
 *     lotId,
 *     nivel,
 *     loteControle,
 *     loteTira,
 *     resultadosCanonical: canonicalizeUroResultados(resultados),
 *     dataRealizacao,
 *   });
 *   // result.logicalSignature → armazenar no documento Firestore
 */
export function useUroSignature() {
  const user = useUser();

  const sign = useCallback(
    async (payload: UroSignaturePayload): Promise<UroSignatureResult> => {
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
