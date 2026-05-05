/**
 * Export job status constants, labels, and display metadata.
 * Single source of truth for UI rendering logic.
 */

import type { ExportJobStatus } from '../types';

export interface StatusMeta {
  label: string;
  /** Tailwind color class for badge background */
  bgClass: string;
  /** Tailwind color class for badge text */
  textClass: string;
  /** Tailwind color class for badge ring/border */
  ringClass: string;
  /** Whether to animate (pulse) the badge */
  animate: boolean;
}

export const JOB_STATUS_META: Record<ExportJobStatus, StatusMeta> = {
  queued: {
    label: 'Na fila',
    bgClass: 'bg-white/10',
    textClass: 'text-white/50',
    ringClass: 'ring-white/20',
    animate: false,
  },
  processing: {
    label: 'Processando',
    bgClass: 'bg-amber-500/20',
    textClass: 'text-amber-400',
    ringClass: 'ring-amber-500/30',
    animate: true,
  },
  completed: {
    label: 'Concluído',
    bgClass: 'bg-emerald-500/20',
    textClass: 'text-emerald-400',
    ringClass: 'ring-emerald-500/30',
    animate: false,
  },
  failed: {
    label: 'Falhou',
    bgClass: 'bg-red-500/20',
    textClass: 'text-red-400',
    ringClass: 'ring-red-500/30',
    animate: false,
  },
};

/** Human-readable format names */
export const FORMAT_LABELS: Record<string, string> = {
  xlsx: 'XLSX',
  pdf: 'PDF',
  csv: 'CSV',
};

/** Format variant names used in the wizard */
export const FORMAT_VARIANT_LABELS: Record<string, string> = {
  xlsx: 'XLSX — CIQ Completo',
  pdf: 'PDF — Relatório NC',
  csv: 'CSV — Dados Brutos',
};

/** Estimated processing time per format (rough UX hint) */
export const FORMAT_ESTIMATED_MINUTES: Record<string, number> = {
  xlsx: 2,
  pdf: 3,
  csv: 1,
};
