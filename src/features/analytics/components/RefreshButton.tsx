/**
 * RefreshButton — Manual analytics refresh trigger
 *
 * Calls the AnalyticsService.refreshNow() callable (Phase 3.2 implementation).
 * Shows spinner while refreshing. Disabled during ongoing refresh.
 *
 * Accessibility: visible focus ring, aria-label, aria-busy on loading.
 */

import React, { useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAnalyticsStore } from '../hooks/useAnalyticsCache';
import { AnalyticsService } from '../services/analyticsService';

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={spinning ? 'animate-spin' : ''}
      style={{ animationDuration: '700ms' }}
    >
      <path
        d="M17 10a7 7 0 1 1-7-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13 3h4v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RefreshButtonProps {
  /** Compact mode — icon only, no label */
  compact?: boolean;
  className?: string;
}

export const RefreshButton = React.memo(function RefreshButton({
  compact = false,
  className = '',
}: RefreshButtonProps) {
  const labId = useActiveLabId();
  const { refreshing, setRefreshing, setError } = useAnalyticsStore();

  const handleRefresh = useCallback(async () => {
    if (!labId || refreshing) return;

    setRefreshing(true);
    setError(null);
    try {
      await AnalyticsService.refreshNow(labId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar analytics';
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }, [labId, refreshing, setRefreshing, setError]);

  const disabled = !labId || refreshing;

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={disabled}
      aria-busy={refreshing}
      aria-label="Atualizar dados de analytics agora"
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
        'text-xs font-medium transition-all duration-150',
        'border border-white/10 bg-white/5',
        'text-white/60 hover:text-white/90 hover:bg-white/10 hover:border-white/20',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5',
        className,
      ].join(' ')}
    >
      <RefreshIcon spinning={refreshing} />
      {!compact && <span>{refreshing ? 'Atualizando…' : 'Atualizar'}</span>}
    </button>
  );
});
