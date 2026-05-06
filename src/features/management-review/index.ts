/**
 * Management Review Module
 * DICQ 4.15 — Análise Crítica pela Direção (Annual Direction Critical Analysis)
 */

export { default as ManagementReviewDashboard } from './components/ManagementReviewDashboard';
export { useManagementReview, useFetchManagementReview } from './hooks/useManagementReview';
export { useReviewTemplate } from './hooks/useReviewTemplate';
export { useAtas, useAtasForReview } from './hooks/useAtas';
export type {
  ManagementReview,
  ReviewEntry,
  ReviewTemplate,
  Ata,
  LogicalSignature
} from './types';
