/**
 * AnalyticsPDFExport — Export button for dashboard PDF generation
 *
 * States: idle → generating → ready (opens URL) | error (retry)
 *
 * Accessibility:
 *   - aria-label on button
 *   - aria-live="polite" on status region
 *   - role="status" on spinner/result messages
 *
 * Design: dark-first, inline SVG icons, violet-500 primary, emerald-500 success.
 */

import React, { useState, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { initiateDashboardPDFExport, type DashboardType } from '../services/analyticsExportService';
import type { DateRange } from '../hooks/useDateRangeFilter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsPDFExportProps {
  dashboardType: DashboardType;
  dateRange: DateRange;
  filters?: {
    equipmentIds?: string[];
    operatorIds?: string[];
  };
  className?: string;
}

type ExportState = 'idle' | 'generating' | 'ready' | 'error';

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function DocumentArrowDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M4 4a2 2 0 0 1 2-2h5l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M11 2v5h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 10v5m0 0l-2-2m2 2l2-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="animate-spin"
      style={{ animationDuration: '700ms' }}
    >
      <path
        d="M17 10a7 7 0 1 1-7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 10l4.5 4.5L16 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AnalyticsPDFExport = React.memo(function AnalyticsPDFExport({
  dashboardType,
  dateRange,
  filters,
  className = '',
}: AnalyticsPDFExportProps) {
  const labId = useActiveLabId();
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!labId) return;
    if (exportState === 'generating') return;

    // If ready, just re-open the URL
    if (exportState === 'ready' && downloadUrl) {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setExportState('generating');
    setErrorMsg(null);
    setDownloadUrl(null);

    try {
      const result = await initiateDashboardPDFExport({
        labId,
        dashboardType,
        dateRange,
        filters,
      });

      setDownloadUrl(result.downloadUrl);
      setExportState('ready');
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar PDF';
      setErrorMsg(msg);
      setExportState('error');
    }
  }, [labId, exportState, downloadUrl, dashboardType, dateRange, filters]);

  const handleRetry = useCallback(() => {
    setExportState('idle');
    setErrorMsg(null);
    setDownloadUrl(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (exportState === 'error') {
    return (
      <div
        className={['flex items-center gap-2', className].join(' ')}
        aria-live="polite"
        role="status"
      >
        <span className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircleIcon />
          <span>{errorMsg ?? 'Erro ao gerar PDF'}</span>
        </span>
        <button
          type="button"
          onClick={handleRetry}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
            'bg-white/5 border border-white/10 text-white/60',
            'hover:bg-white/10 hover:text-white/80 transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
          ].join(' ')}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (exportState === 'ready') {
    return (
      <div
        className={['flex items-center gap-2', className].join(' ')}
        aria-live="polite"
        role="status"
      >
        <button
          type="button"
          onClick={handleExport}
          aria-label="PDF pronto — clique para abrir"
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
            'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
            'hover:bg-emerald-500/20 transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60',
          ].join(' ')}
        >
          <CheckIcon />
          <span>PDF pronto</span>
        </button>
      </div>
    );
  }

  if (exportState === 'generating') {
    return (
      <div
        className={['flex items-center gap-2', className].join(' ')}
        aria-live="polite"
        role="status"
      >
        <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white/5 border border-white/10 text-white/40">
          <SpinnerIcon />
          <span>Gerando PDF…</span>
        </span>
      </div>
    );
  }

  // idle
  return (
    <div className={className} aria-live="polite">
      <button
        type="button"
        onClick={handleExport}
        disabled={!labId}
        aria-label="Exportar dashboard como PDF"
        title="Exportar dashboard como PDF"
        className={[
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
          'bg-white/5 border border-white/10 text-white/60',
          'hover:bg-white/10 hover:text-white/80 transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        <DocumentArrowDownIcon />
        <span>Exportar PDF</span>
      </button>
    </div>
  );
});
