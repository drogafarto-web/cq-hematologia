/**
 * Ponto único de re-exportação de tipos externos consumidos pelo módulo
 * Management Review. Mantém o acoplamento com o resto do codebase numa
 * superfície pequena e auditável.
 */

export type { Timestamp } from 'firebase/firestore';

/** Identificador do tenant — sempre presente em paths e docs. */
export type LabId = string;

/** UID do usuário autenticado (Firebase Auth). */
export type UserId = string;
