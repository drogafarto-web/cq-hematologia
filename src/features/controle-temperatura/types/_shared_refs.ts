/**
 * Ponto único de re-exportação de tipos externos consumidos pelo módulo
 * Controle de Temperatura. Mantém o acoplamento com o resto do codebase numa
 * superfície pequena e auditável (mesmo padrão do módulo Educação Continuada).
 */

export type { Timestamp } from 'firebase/firestore';

/** Identificador do tenant — sempre presente em paths e docs. */
export type LabId = string;

/** UID do usuário autenticado (Firebase Auth). */
export type UserId = string;

/**
 * Wrapper auditável da assinatura lógica. Mantido idêntico ao do módulo
 * Educação Continuada — RDC 978/2025 exige rastreabilidade independente do
 * doc pai: `verifySignature()` reaplica o hash com operatorId + ts + payload
 * sem depender de outros campos. Divergência deliberada do legado
 * `CQRun.logicalSignature: string`.
 */
export interface LogicalSignature {
  hash: string;
  operatorId: UserId;
  ts: import('firebase/firestore').Timestamp;
}
