/**
 * useGovernanceChecklist Hook
 * Phase 9 — Manual Qualidade + Governance Framework
 *
 * Provides reactive access to governance checklist data with alerts and status tracking
 */

import { useCallback, useState } from 'react';
import { useActiveLabId } from '@/store/useAuthStore';
import {
  GovernanceChecklist,
  GovernanceItem,
  GovernanceSummary,
} from '../types/GovernanceChecklist';
import { GovernanceChecklistService } from '../services/GovernanceChecklistService';

interface UseGovernanceChecklistReturn {
  checklist: GovernanceChecklist | null;
  summary: GovernanceSummary | null;
  loading: boolean;
  error: string | null;
  overdueItems: GovernanceItem[];
  atRiskItems: GovernanceItem[];
  phase9GateMet: boolean;
  reload: () => Promise<void>;
  updateItem: (itemId: string, updates: Partial<GovernanceItem>) => Promise<void>;
  exportForMR: () => string;
}

export function useGovernanceChecklist(): UseGovernanceChecklistReturn {
  const activeLabId = useActiveLabId();
  const [checklist, setChecklist] = useState<GovernanceChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overdueItems, setOverdueItems] = useState<GovernanceItem[]>([]);
  const [atRiskItems, setAtRiskItems] = useState<GovernanceItem[]>([]);
  const [phase9GateMet, setPhase9GateMet] = useState(false);

  const reload = useCallback(async () => {
    if (!activeLabId) {
      setError('No active lab');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loaded = await GovernanceChecklistService.loadChecklist(activeLabId);
      setChecklist(loaded);

      if (loaded) {
        // Calculate summary
        const summary = GovernanceChecklistService.generateSummary(loaded);
        // Summary is not directly stored in state, calculated on demand

        // Get all items
        const allItems = Object.values(loaded.categories).flatMap((cat) => cat.items);

        // Detect overdue and at-risk
        const overdue = GovernanceChecklistService.detectOverdueItems(allItems);
        const atRisk = GovernanceChecklistService.detectAtRiskItems(allItems);

        setOverdueItems(overdue);
        setAtRiskItems(atRisk);

        // Check Phase 9 gate
        const gateCheck = await GovernanceChecklistService.checkPhase9GateCriteria(activeLabId);
        setPhase9GateMet(gateCheck.gateMet);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('[useGovernanceChecklist] Error loading checklist:', err);
    } finally {
      setLoading(false);
    }
  }, [activeLabId]);

  const updateItem = useCallback(
    async (itemId: string, updates: Partial<GovernanceItem>) => {
      if (!activeLabId) {
        setError('No active lab');
        return;
      }

      try {
        const result = await GovernanceChecklistService.updateItem(activeLabId, itemId, updates);
        if (result.success) {
          // Reload checklist to reflect changes
          await reload();
        } else {
          setError(result.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        console.error('[useGovernanceChecklist] Error updating item:', err);
      }
    },
    [activeLabId, reload],
  );

  const exportForMR = useCallback(() => {
    if (!checklist) return '';
    return GovernanceChecklistService.exportForManagementReview(checklist);
  }, [checklist]);

  const summary: GovernanceSummary | null = checklist
    ? GovernanceChecklistService.generateSummary(checklist)
    : null;

  return {
    checklist,
    summary,
    loading,
    error,
    overdueItems,
    atRiskItems,
    phase9GateMet,
    reload,
    updateItem,
    exportForMR,
  };
}
