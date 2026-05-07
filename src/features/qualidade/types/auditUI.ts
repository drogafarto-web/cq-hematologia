/**
 * auditUI.ts
 *
 * UI-layer types for v1.5 audit console, chain validation, and compliance auditing.
 * These types augment the callable payloads with UI state and derived filters.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Filters for audit trail view.
 * Client-side state model passed to getAuditTrail callable.
 */
export interface AuditTrailFilters {
  modulo?: string;
  operadorId?: string;
  resultado?: 'sucesso' | 'falha' | 'aviso';
  dataInicio?: Date;
  dataFim?: Date;
}

/**
 * UI state for paginated audit trail list.
 * Tracks current page, filters, and load state.
 */
export interface AuditTrailState {
  entries: AuditTrailEntry[];
  filters: AuditTrailFilters;
  offset: number;
  limit: number;
  count: number;
  hasMore: boolean;
  isLoading: boolean;
  error?: Error | null;
  lastRefresh: number;
}

/**
 * Single audit trail entry rendered in list view.
 */
export interface AuditTrailEntry {
  id: string;
  modulo: string;
  operadorId: string;
  operadorNome?: string;
  resultado: 'sucesso' | 'falha' | 'aviso';
  timestamp: Timestamp;
  detalhes?: string;
  chainHashValido?: boolean;
}

/**
 * Result of chain hash validation.
 * Status 'valido' means entire chain is unbroken.
 * Status 'quebrado' indicates at least one violation.
 */
export interface ValidateChainResult {
  status: 'valido' | 'quebrado';
  firstViolation?: {
    docId: string;
    index: number;
    expectedHash: string;
    actualHash: string;
  };
  lastCheckTime: number;
}

/**
 * UI state for chain validator widget.
 */
export interface ChainValidatorState {
  result?: ValidateChainResult;
  isValidating: boolean;
  lastValidated?: number;
  error?: Error | null;
}

/**
 * Export options for signed CSV or PDF audit report.
 */
export interface AuditExportOptions {
  format: 'csv' | 'pdf';
  includeChainValidation: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: AuditTrailFilters;
}

/**
 * Audit console view model — aggregates trail + chain validator + controls.
 */
export interface AuditConsoleState {
  trail: AuditTrailState;
  chainValidator: ChainValidatorState;
  exportInProgress: boolean;
  selectedEntries: Set<string>;
}
