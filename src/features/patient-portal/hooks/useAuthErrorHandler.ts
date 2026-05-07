/**
 * useAuthErrorHandler — Maps error scenarios to friendly messages
 * RDC 978 Art. 167 — LGPD-compliant error handling
 *
 * Handles all 10 error scenarios from task spec:
 * Auth link errors (5) + Email request errors (3) + Session errors (2)
 */

import { useCallback } from 'react';

// Error codes matching Cloud Function responses
export enum AuthErrorCode {
  // Token validation errors
  TOKEN_INVALID = 'auth/token-invalid',
  TOKEN_EXPIRED = 'auth/token-expired',
  TOKEN_USED = 'auth/token-used',
  TOKEN_TAMPERED = 'auth/token-tampered',

  // Resource errors
  LAB_NOT_FOUND = 'auth/lab-not-found',
  PATIENT_NOT_FOUND = 'auth/patient-not-found',

  // Email request errors
  EMAIL_NOT_FOUND = 'auth/email-not-found',
  RATE_LIMITED = 'auth/rate-limited',
  EMAIL_SERVICE_DOWN = 'auth/email-service-down',
  EMAIL_RECENTLY_SENT = 'auth/email-recently-sent',

  // Session errors
  SESSION_EXPIRED = 'auth/session-expired',
  SESSION_CORRUPTED = 'auth/session-corrupted',
  ACCESS_DENIED = 'auth/access-denied',
  NETWORK_ERROR = 'auth/network-error',

  // Generic
  UNKNOWN = 'auth/unknown',
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  actionLabel?: string;
  retryableAfterMs?: number; // For rate limiting
}

const ERROR_MESSAGES: Record<AuthErrorCode, Omit<AuthError, 'code'>> = {
  // Auth link errors
  [AuthErrorCode.TOKEN_INVALID]: {
    message: 'Link inválido. Solicite um novo link de acesso.',
    actionLabel: 'Solicitar novo link',
  },
  [AuthErrorCode.TOKEN_EXPIRED]: {
    message: 'Link expirado. Os links são válidos por 72 horas. Solicite um novo.',
    actionLabel: 'Solicitar novo link',
  },
  [AuthErrorCode.TOKEN_USED]: {
    message: 'Este link já foi utilizado. Faça login ou solicite um novo.',
    actionLabel: 'Fazer login',
  },
  [AuthErrorCode.TOKEN_TAMPERED]: {
    message: 'Link inválido (possível adulteração detectada). Solicite um novo por segurança.',
    actionLabel: 'Solicitar novo link',
  },

  // Resource errors
  [AuthErrorCode.LAB_NOT_FOUND]: {
    message: 'Laboratório não encontrado. Entre em contato com o suporte.',
  },
  [AuthErrorCode.PATIENT_NOT_FOUND]: {
    message: 'Registro do paciente não encontrado. Entre em contato com o suporte.',
  },

  // Email request errors
  [AuthErrorCode.EMAIL_NOT_FOUND]: {
    message: 'Email não associado a este laboratório. Verifique o endereço informado.',
    actionLabel: 'Tentar outro email',
  },
  [AuthErrorCode.RATE_LIMITED]: {
    message: 'Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.',
    retryableAfterMs: 60000,
  },
  [AuthErrorCode.EMAIL_SERVICE_DOWN]: {
    message: 'Serviço de email indisponível. Tente novamente em alguns momentos.',
    actionLabel: 'Tentar novamente',
  },
  [AuthErrorCode.EMAIL_RECENTLY_SENT]: {
    message: 'Email enviado recentemente. Verifique sua caixa de entrada (incluindo spam) ou tente em 5 minutos.',
    retryableAfterMs: 300000,
  },

  // Session errors
  [AuthErrorCode.SESSION_EXPIRED]: {
    message: 'Sua sessão expirou. Solicite um novo link de acesso.',
    actionLabel: 'Solicitar novo link',
  },
  [AuthErrorCode.SESSION_CORRUPTED]: {
    message: 'Sessão inválida. Faça login novamente.',
    actionLabel: 'Fazer login',
  },
  [AuthErrorCode.ACCESS_DENIED]: {
    message: 'Acesso negado. Entre em contato com o suporte.',
  },
  [AuthErrorCode.NETWORK_ERROR]: {
    message: 'Erro de conexão. Verifique sua internet e tente novamente.',
    actionLabel: 'Tentar novamente',
  },

  // Generic
  [AuthErrorCode.UNKNOWN]: {
    message: 'Algo deu errado. Tente novamente ou entre em contato com o suporte.',
    actionLabel: 'Tentar novamente',
  },
};

export interface UseAuthErrorHandlerReturn {
  getErrorInfo: (code: AuthErrorCode | string) => AuthError;
  getErrorFromResponse: (error: unknown) => AuthError;
  mapFirebaseError: (firebaseError: unknown) => AuthError;
  isRetryable: (code: AuthErrorCode) => boolean;
}

export function useAuthErrorHandler(): UseAuthErrorHandlerReturn {
  const getErrorInfo = useCallback((code: AuthErrorCode | string): AuthError => {
    const normalizedCode = (code || AuthErrorCode.UNKNOWN) as AuthErrorCode;
    const info = ERROR_MESSAGES[normalizedCode] || ERROR_MESSAGES[AuthErrorCode.UNKNOWN];
    return {
      code: normalizedCode,
      ...info,
    };
  }, []);

  const getErrorFromResponse = useCallback(
    (error: unknown): AuthError => {
      if (!error) {
        return getErrorInfo(AuthErrorCode.UNKNOWN);
      }

      // Handle Firebase error objects
      if (typeof error === 'object' && 'code' in error) {
        const fbError = error as { code?: string; message?: string };
        const code = fbError.code as AuthErrorCode | string;

        // Map Firebase codes to our error codes
        const codeMap: Record<string, AuthErrorCode> = {
          'functions/internal': AuthErrorCode.EMAIL_SERVICE_DOWN,
          'functions/unauthenticated': AuthErrorCode.SESSION_CORRUPTED,
          'functions/permission-denied': AuthErrorCode.ACCESS_DENIED,
        };

        const mappedCode = codeMap[code] || (code as AuthErrorCode);
        return getErrorInfo(mappedCode);
      }

      // Handle string error messages
      if (typeof error === 'string') {
        return getErrorInfo(AuthErrorCode.UNKNOWN);
      }

      return getErrorInfo(AuthErrorCode.UNKNOWN);
    },
    [getErrorInfo],
  );

  const mapFirebaseError = useCallback(
    (firebaseError: unknown): AuthError => {
      return getErrorFromResponse(firebaseError);
    },
    [getErrorFromResponse],
  );

  const isRetryable = useCallback((code: AuthErrorCode): boolean => {
    const retryableCodes = [
      AuthErrorCode.EMAIL_SERVICE_DOWN,
      AuthErrorCode.EMAIL_RECENTLY_SENT,
      AuthErrorCode.RATE_LIMITED,
      AuthErrorCode.NETWORK_ERROR,
    ];
    return retryableCodes.includes(code);
  }, []);

  return {
    getErrorInfo,
    getErrorFromResponse,
    mapFirebaseError,
    isRetryable,
  };
}
