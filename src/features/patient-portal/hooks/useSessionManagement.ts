/**
 * useSessionManagement — Handles session expiry warnings and auto-logout
 * RDC 978 Art. 167 — Session timeout at 10 minutes + 30-day max TTL
 *
 * Returns:
 *   - timeRemaining: milliseconds until expiry
 *   - isExpired: boolean
 *   - showWarning: boolean (true when <10 minutes)
 *   - refreshToken: () => Promise to extend session
 *   - logout: () => void to end session
 */

import { useEffect, useState, useCallback } from 'react';
import { usePatientAuthStore, usePatientTimeRemaining } from './usePatientAuthStore';

const WARNING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

export interface UseSessionManagementReturn {
  timeRemaining: number;
  isExpired: boolean;
  showWarning: boolean;
  isRefreshing: boolean;
  refreshToken: () => Promise<void>;
  logout: () => void;
}

export function useSessionManagement(): UseSessionManagementReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const timeRemaining = usePatientTimeRemaining();
  const session = usePatientAuthStore((s) => s.session);
  const isExpired = usePatientAuthStore((s) => s.isTokenExpired());
  const clearSession = usePatientAuthStore((s) => s.clearSession);
  const setError = usePatientAuthStore((s) => s.setError);

  // Show warning when time remaining < 10 minutes
  useEffect(() => {
    const shouldShowWarning = timeRemaining > 0 && timeRemaining < WARNING_THRESHOLD_MS;
    setShowWarning(shouldShowWarning);
  }, [timeRemaining]);

  // Auto-logout when token expires
  useEffect(() => {
    if (isExpired && session) {
      clearSession();
      setError('Sua sessão expirou. Faça login novamente.');
    }
  }, [isExpired, session, clearSession, setError]);

  const refreshToken = useCallback(async () => {
    if (!session) {
      setError('Sessão inválida. Faça login novamente.');
      return;
    }

    setIsRefreshing(true);
    try {
      // Call Cloud Function to refresh token
      // This extends the expiry to +72 hours from now
      const refreshTokenFn = (await import('firebase/functions')).httpsCallable(
        (await import('../../shared/services/firebase')).functions,
        'refreshPatientToken',
      );

      const result = await refreshTokenFn({
        currentToken: session.token,
      });

      if (result.data?.success && result.data?.token && result.data?.expiresAt) {
        // Update session with new token
        usePatientAuthStore.getState().setSession({
          token: result.data.token,
          patientId: session.patientId,
          labId: session.labId,
          email: session.email,
          expiresAt: new Date(result.data.expiresAt),
        });
      } else {
        setError('Erro ao renovar sessão. Faça login novamente.');
        clearSession();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      setError('Erro ao renovar sessão. Tente novamente.');
    } finally {
      setIsRefreshing(false);
    }
  }, [session, clearSession, setError]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return {
    timeRemaining,
    isExpired,
    showWarning,
    isRefreshing,
    refreshToken,
    logout,
  };
}
