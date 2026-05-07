import { useEffect, useState } from 'react';
import { usePatientAuthStore } from './usePatientAuthStore';

interface UsePatientSessionReturn {
  expiresAt: Date | null;
  remainingMs: number;
  remainingSeconds: number;
  formattedTime: string;
  isExpired: boolean;
}

/**
 * Hook: Session countdown timer
 *
 * Updates every 10 seconds to show remaining time until token expiry
 * Triggers expiry check on interval
 *
 * Usage:
 *   const { remainingMs, formattedTime, isExpired } = usePatientSession();
 */
export function usePatientSessionCountdown(): UsePatientSessionReturn {
  const session = usePatientAuthStore((s) => s.session);
  const isTokenExpired = usePatientAuthStore((s) => s.isTokenExpired);
  const getTimeRemaining = usePatientAuthStore((s) => s.getTimeRemaining);

  const [remainingMs, setRemainingMs] = useState(0);

  // Update countdown every 10 seconds
  useEffect(() => {
    if (!session?.expiresAt) return;

    const updateCountdown = () => {
      const remaining = getTimeRemaining();
      setRemainingMs(remaining);
    };

    updateCountdown(); // Initial check

    const interval = setInterval(updateCountdown, 10000); // Every 10s
    return () => clearInterval(interval);
  }, [session?.expiresAt, getTimeRemaining]);

  const remainingSeconds = Math.floor(remainingMs / 1000);
  const isExpired = isTokenExpired();

  const formattedTime = (() => {
    if (remainingSeconds <= 0) return 'Expirado';

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  })();

  return {
    expiresAt: session?.expiresAt ?? null,
    remainingMs,
    remainingSeconds,
    formattedTime,
    isExpired,
  };
}
