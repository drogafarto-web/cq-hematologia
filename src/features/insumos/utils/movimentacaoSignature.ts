/**
 * Assinatura criptográfica do evento de movimentação de insumo.
 *
 * Camada 1 — `payloadSignature` (calculado aqui): SHA-256 sobre o canonical
 * do evento em si, sem dependência de estado anterior. Funciona offline.
 *
 * Camada 2 — `chainHash` (calculado pela Cloud Function onDocumentCreated):
 * link com o evento anterior do mesmo insumo na ordem de `serverTimestamp`.
 *
 * A separação é deliberada: chain hash client-side geraria fork em cenário
 * multi-device offline (dois dispositivos leem o mesmo previous hash e
 * sincronizam depois). O payloadSignature valida integridade do evento
 * individual; chainHash valida integridade da cadeia. Ver skill/plan F6+F6b.
 */

import type { InsumoMovimentacaoTipo } from '../types/Insumo';

/**
 * Payload canônico do evento — ordem das chaves é imutável. Alterar a ordem
 * produz assinatura diferente e invalida verificações retroativas.
 *
 * Ausência de `timestamp` de servidor é intencional — o cliente não sabe o
 * server time. Usamos `clientTimestamp` (ISO8601 do momento do evento) como
 * parte do payload assinado. O `serverTimestamp` entra apenas na ordenação
 * da cadeia, calculada server-side.
 */
export interface MovimentacaoSignaturePayload {
  movId: string;
  insumoId: string;
  tipo: InsumoMovimentacaoTipo;
  operadorId: string;
  operadorName: string;
  clientTimestamp: string; // ISO8601
  motivo?: string;
}

/**
 * Monta a string canônica do payload com ordem de chaves fixa.
 * Exportada para testes e para o verifier CLI.
 */
export function canonicalMovimentacao(payload: MovimentacaoSignaturePayload): string {
  // Objeto literal mantém ordem de inserção em JS ES2015+.
  // Campos opcionais só entram se presentes — mantém canonical determinístico
  // entre eventos com/sem motivo.
  const ordered: Record<string, string> = {
    movId: payload.movId,
    insumoId: payload.insumoId,
    tipo: payload.tipo,
    operadorId: payload.operadorId,
    operadorName: payload.operadorName,
    clientTimestamp: payload.clientTimestamp,
  };
  if (payload.motivo !== undefined) ordered.motivo = payload.motivo;
  return JSON.stringify(ordered);
}

/**
 * Calcula SHA-256 hex do canonical via Web Crypto API nativa (sem libs).
 * Retorna 64 caracteres lowercase hex.
 */
export async function computeMovimentacaoSignature(
  payload: MovimentacaoSignaturePayload,
): Promise<string> {
  const canonical = canonicalMovimentacao(payload);
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash genesis da cadeia — primeiro evento de qualquer insumo usa este valor
 * como `previousChainHash`. SHA-256 de uma string de versão fixa garante que
 * migrações futuras do algoritmo sejam identificáveis.
 *
 * Precomputado: SHA-256('hcq-insumo-movimentacao-v1') em hex.
 * Mantido como constante literal para bater exato no servidor (functions/)
 * sem precisar importar este arquivo cruzando TS configs.
 */
export const INSUMO_CHAIN_GENESIS_SEED = 'hcq-insumo-movimentacao-v1';
export const INSUMO_CHAIN_GENESIS_HASH =
  'daa5e47ef3b073eaf0bc4e400ba96c26f37f2d3167c02f004fb21d659e3dee06';
