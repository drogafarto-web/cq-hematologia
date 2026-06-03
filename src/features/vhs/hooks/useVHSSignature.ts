import { useCallback } from 'react';
import { useUser } from '../../../store/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payload da assinatura lógica de uma leitura VHS.
 *
 * A ordem dos campos é canônica e imutável — alterar a ordem produz
 * uma assinatura diferente e invalida verificações retroativas.
 */
export interface VHSSignaturePayload {
  /** Identificador da amostra (livre, definido pelo operador) */
  amostra: string;
  /** Valor da leitura em mm/h */
  v1: number;
  /** uid Firebase Auth do operador que registrou a leitura */
  op: string;
  /** Método utilizado */
  met: 'westergren' | 'automatizado';
  /** Data ISO (YYYY-MM-DD) */
  date: string;
}

export interface VHSSignatureResult {
  /** Hash SHA-256 em hexadecimal (64 caracteres) */
  logicalSignature: string;
  /** uid do Firebase Auth do operador — rastreabilidade extra */
  signedBy: string;
  /** ISO 8601 do momento da assinatura */
  signedAt: string;
}

// ─── Pure helper (exportada para testes unitários) ────────────────────────────

/**
 * Gera SHA-256 sobre o payload canônico usando a Web Crypto API nativa.
 * Não usa bibliotecas externas — sem dependência de crypto-js.
 *
 * Campos serializados em ordem canônica e imutável:
 *   amostra, v1, op, met, date
 */
export async function generateVHSSignature(payload: VHSSignaturePayload): Promise<string> {
  const canonical = JSON.stringify({
    amostra: payload.amostra,
    v1: payload.v1,
    op: payload.op,
    met: payload.met,
    date: payload.date,
  });

  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useVHSSignature — gera a assinatura lógica (SHA-256) de uma leitura VHS.
 *
 * A assinatura vincula o operador identificado (op) aos dados
 * da leitura de forma auditável e imutável (RDC 978/2025 Art.128).
 *
 * Uso:
 *   const { sign, isReady } = useVHSSignature();
 *   const result = await sign({
 *     amostra,
 *     v1,
 *     op,
 *     met,
 *     date,
 *   });
 *   // result.logicalSignature → armazenar no documento Firestore
 */
export function useVHSSignature() {
  const user = useUser();

  const sign = useCallback(
    async (payload: VHSSignaturePayload): Promise<VHSSignatureResult> => {
      if (!user) {
        throw new Error('Usuário não autenticado. Impossível assinar.');
      }

      const logicalSignature = await generateVHSSignature(payload);

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
