/**
 * shared/utils/firebaseErrors.ts
 *
 * Pure utility for mapping Firebase/Firestore error codes to human-readable
 * Portuguese messages. No Firebase SDK imports — safe to use anywhere and
 * trivially testable without mocking.
 *
 * Handles both error classes thrown by Firebase v10+:
 *   - FirestoreError (subclass): code is plain, e.g. "permission-denied"
 *   - FirebaseError (base class): code is prefixed, e.g. "firestore/permission-denied"
 */

const ERROR_MESSAGES: Record<string, string> = {
  'permission-denied': 'Sem permissão para realizar esta operação.',
  'not-found': 'Documento não encontrado.',
  'already-exists': 'Registro já existe.',
  'resource-exhausted': 'Limite de requisições atingido. Aguarde alguns instantes.',
  unavailable: 'Serviço temporariamente indisponível. Verifique sua conexão.',
  'deadline-exceeded': 'A operação demorou demais. Tente novamente.',
  unauthenticated: 'Sessão expirada. Faça login novamente.',
  cancelled: 'Operação cancelada.',
  'invalid-argument': 'Dados inválidos. Verifique os valores e tente novamente.',
};

export function firestoreErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Erro inesperado. Tente novamente.';
  }

  // Both FirestoreError and FirebaseError expose a `code` property.
  const rawCode = (error as { code?: string }).code;

  if (!rawCode) {
    // Plain JS error (e.g. TypeError from bad serialization).
    // Log internally but never surface raw error.message to the UI.
    console.error('[firestoreErrorMessage] Non-Firebase error:', error);
    return 'Erro inesperado. Tente novamente.';
  }

  // Strip service prefix if present: "firestore/permission-denied" → "permission-denied"
  const code = rawCode.includes('/') ? rawCode.split('/')[1] : rawCode;

  return ERROR_MESSAGES[code] ?? `Erro Firebase: ${code}`;
}
