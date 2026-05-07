import { useEffect, useState } from 'react';
import { usePatientAuthStore, usePatientSessionExpiry, usePatientIsExpired } from './usePatientAuthStore';

interface UsePatientSessionReturn {
  expiresAt: number | null;
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
export function usePatientSession(): UsePatientSessionReturn {
  const expiresAt = usePatientSessionExpiry();
  const isExpired = usePatientIsExpired();
  const checkExpiry = usePatientAuthStore((s) => s.checkExpiry);

  const [remainingMs, setRemainingMs] = useState(0);

  // Update countdown every 10 seconds
  useEffect(() => {
    if (!expiresAt) return;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, expiresAt - now);
      setRemainingMs(remaining);
      checkExpiry();
    };

    updateCountdown(); // Initial check

    const interval = setInterval(updateCountdown, 10000); // Every 10s
    return () => clearInterval(interval);
  }, [expiresAt, checkExpiry]);

  const remainingSeconds = Math.floor(remainingMs / 1000);

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
    expiresAt,
    remainingMs,
    remainingSeconds,
    formattedTime,
    isExpired,
  };
}
