/**
 * Portal RT — Navigation Hook
 *
 * Manages active section state and escalation count subscription.
 * Role validation: ensures user is RT.
 */

import { useCallback, useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { PortalRTSectionType } from '../types';

// ─── Mock escalation subscription ──────────────────────────────────────────────

/**
 * Mock hook for subscribing to escalation count.
 * In Phase 4.2, this will subscribe to Firestore collection of critical values.
 * For now, returns 0 and updates every 30 seconds as a placeholder.
 */
function useEscalationCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // TODO (Phase 4.2): Subscribe to /critical-values/{labId}/pending
    // For now, mock polling to verify subscription pattern works
    const interval = setInterval(() => {
      // Placeholder: in real implementation, Firestore onSnapshot here
      setCount(0);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return count;
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export interface UsePortalRTNavOptions {
  initialSection?: PortalRTSectionType;
}

export interface UsePortalRTNavReturn {
  activeSection: PortalRTSectionType;
  selectSection: (section: PortalRTSectionType) => void;
  escalationCount: number;
  isValidRT: boolean;
  isLoading: boolean;
}

export function usePortalRTNav(
  options: UsePortalRTNavOptions = {}
): UsePortalRTNavReturn {
  const { initialSection = 'dashboard' } = options;
  const [activeSection, setActiveSection] = useState<PortalRTSectionType>(initialSection);
  const [isLoading, setIsLoading] = useState(true);

  // Get active lab ID
  const activeLabId = useActiveLabId();
  const escalationCount = useEscalationCount();

  // Validate RT role on mount
  useEffect(() => {
    const validateRole = async () => {
      try {
        // In real implementation, verify user claims include 'rt' role for activeLabId
        // For now, we assume if user has activeLabId, they're authorized
        if (!activeLabId) {
          console.warn('[Portal RT] No active lab ID');
        }
      } finally {
        setIsLoading(false);
      }
    };

    validateRole();
  }, [activeLabId]);

  const selectSection = useCallback((section: PortalRTSectionType) => {
    setActiveSection(section);
  }, []);

  const isValidRT = !!activeLabId;

  return {
    activeSection,
    selectSection,
    escalationCount,
    isValidRT,
    isLoading,
  };
}
