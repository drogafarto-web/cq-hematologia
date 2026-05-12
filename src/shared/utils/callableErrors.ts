/**
 * Maps Firebase HTTPS Callable errors to Portuguese UI strings.
 * Callable SDK uses codes like `functions/internal`, `functions/permission-denied`.
 */

export function callableErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: string }).code);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const cleaned = rawMessage.replace(/^[^:]+:\s*/, '').trim();

    switch (code) {
      case 'functions/internal':
        if (!cleaned || cleaned.toLowerCase() === 'internal') {
          return 'Erro interno no servidor. Tente de novo em instantes. Se repetir, verifique os logs da Cloud Function ou peça suporte técnico.';
        }
        return cleaned;
      case 'functions/permission-denied':
        return cleaned || 'Sem permissão para realizar esta operação.';
      case 'functions/unauthenticated':
        return cleaned || 'Sessão expirada. Faça login novamente.';
      case 'functions/invalid-argument':
        return cleaned || 'Dados inválidos.';
      case 'functions/failed-precondition':
        return cleaned || 'Não foi possível concluir a operação.';
      case 'functions/unavailable':
        return cleaned || 'Serviço temporariamente indisponível. Tente novamente.';
      case 'functions/already-exists':
        return cleaned || 'Este registro já existe.';
      case 'functions/not-found':
        return cleaned || 'Registro não encontrado.';
      default:
        if (cleaned) return cleaned;
        return `Erro (${code}). Tente novamente.`;
    }
  }

  if (error instanceof Error) return error.message;
  return 'Erro inesperado. Tente novamente.';
}
