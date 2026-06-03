import { useCallback, useState } from 'react';
import type { VHSMetodo } from '../types/VHSExam';

// ─── Payload canônico da assinatura ────────────────────────────────────────
export interface VHSSignaturePayload {
  amostra: string;
  valor: number;
  responsavel: string;
  leituraEm: string; // ISO 8601 da leitura manual
  met: VHSMetodo;
}

// ─── Pure function — SHA-256 hex ───────────────────────────────────────────
export async function generateVHSSignature(payload: VHSSignaturePayload): Promise<string> {
  const canonical = [
    payload.amostra,
    String(payload.valor),
    payload.responsavel,
    payload.leituraEm,
    payload.met,
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Hook wrapper ──────────────────────────────────────────────────────────
export function useVHSSignature() {
  const [isReady, setIsReady] = useState(true);

  const sign = useCallback(async (payload: VHSSignaturePayload): Promise<string> => {
    setIsReady(false);
    try {
      return await generateVHSSignature(payload);
    } finally {
      setIsReady(true);
    }
  }, []);

  return { sign, isReady };
}
