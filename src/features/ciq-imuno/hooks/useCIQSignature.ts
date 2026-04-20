import { useCallback } from 'react';
import { useUser } from '../../../store/useAuthStore';
import type { TestType } from '../types/_shared_refs';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Campos incluídos no payload da assinatura lógica.
 *
 * A ordem dos campos é canônica e imutável — alterar a ordem produz
 * uma assinatura diferente e invalida verificações retroativas.
 */
export interface CIQSignaturePayload {
  /** Documento profissional do operador (ex: "CRBM-MG 12345") */
  operatorDocument: string;
  /** ID do lote de controle no Firestore */
  lotId: string;
  /** Tipo de imunoensaio realizado */
  testType: TestType;
  /** Lote físico do material de controle */
  loteControle: string;
  /** Resultado obtido na corrida */
  resultadoObtido: 'R' | 'NR';
  /** Data de realização (YYYY-MM-DD) */
  dataRealizacao: string;
}

export interface CIQSignatureResult {
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
 */
export async function generateSignature(payload: CIQSignaturePayload): Promise<string> {
  const canonical = JSON.stringify({
    doc: payload.operatorDocument,
    lot: payload.lotId,
    test: payload.testType,
    ctrl: payload.loteControle,
    res: payload.resultadoObtido,
    date: payload.dataRealizacao,
  });

  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCIQSignature — gera a assinatura lógica (SHA-256) de uma corrida CIQ-Imuno.
 *
 * A assinatura vincula o operador identificado (operatorDocument) aos dados
 * da corrida de forma auditável e imutável (RDC 978/2025 Art.128).
 *
 * Uso:
 *   const { sign, isReady } = useCIQSignature();
 *   const result = await sign({ operatorDocument, lotId, testType, ... });
 *   // result.logicalSignature → armazenar no documento Firestore
 */
export function useCIQSignature() {
  const user = useUser();

  const sign = useCallback(
    async (payload: CIQSignaturePayload): Promise<CIQSignatureResult> => {
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
