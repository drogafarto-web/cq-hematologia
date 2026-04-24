/**
 * Ponto único de re-exportação de tipos externos consumidos pelo módulo
 * Educação Continuada. Mantém o acoplamento com o resto do codebase numa
 * superfície pequena e auditável.
 */

export type { Timestamp } from 'firebase/firestore';

/** Identificador do tenant — sempre presente em paths e docs. */
export type LabId = string;

/** UID do usuário autenticado (Firebase Auth). */
export type UserId = string;

/**
 * Wrapper auditável da assinatura lógica. Diverge do legado `CQRun.logicalSignature: string`
 * intencionalmente: aqui guardamos operatorId e timestamp junto com o hash SHA-256
 * para que `verifySignature()` possa ser reaplicada sem depender de outros campos
 * do documento — requisito de rastreabilidade RDC 978/2025.
 */
export interface LogicalSignature {
  hash: string;
  operatorId: UserId;
  ts: import('firebase/firestore').Timestamp;
}
