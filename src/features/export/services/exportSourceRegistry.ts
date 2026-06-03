/**
 * Export Source Registry — defines available data sources for ExportWizard
 *
 * Each module can register itself by adding an entry here.
 * Schema: { key, label, description, callable, formats, filters, permission }
 *
 * Used by ExportWizard to generate dynamic UI for source selection.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';
export type ExportPermission = 'rt-or-admin' | 'auditor' | 'any-member';

export interface FilterOption {
  key: string;
  label: string;
  type: 'date' | 'text' | 'multi-select' | 'single-select';
  options?: string[];
  required?: boolean;
}

export interface ExportSourceDescriptor {
  /** Unique identifier for this source */
  key: string;
  /** Display label (e.g. "Auditoria — Relatórios") */
  label: string;
  /** Longer description for UI tooltips */
  description: string;
  /** Cloud Function callable name (e.g. 'generateAuditReportPDF') */
  callable: string;
  /** Supported output formats */
  formats: ExportFormat[];
  /** Dynamic filters for the source */
  filters: FilterOption[];
  /** Permission level required */
  permission: ExportPermission;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const EXPORT_SOURCES: Record<string, ExportSourceDescriptor> = {
  // Auditoria — Anomaly-based audit reports (Phase 7)
  auditoria: {
    key: 'auditoria',
    label: 'Auditoria — Relatórios',
    description: 'Relatórios de auditoria avançada (anomalias, alertas, rule-engine)',
    callable: 'generateAuditReportPDF',
    formats: ['pdf', 'xlsx'],
    filters: [
      {
        key: 'from',
        label: 'Início',
        type: 'date',
        required: true,
      },
      {
        key: 'to',
        label: 'Fim',
        type: 'date',
        required: true,
      },
      {
        key: 'severity',
        label: 'Severidade',
        type: 'multi-select',
        options: ['low', 'medium', 'high', 'critical'],
        required: false,
      },
    ],
    permission: 'rt-or-admin',
  },

  // Add more sources below (placeholder for future modules)
  // analytics: { ... },
  // ciq: { ... },
  // ceq: { ... },
};

// ─── Helper: Get all registered source keys ────────────────────────────────────

export function getAvailableSources(): string[] {
  return Object.keys(EXPORT_SOURCES);
}

// ─── Helper: Get source by key ─────────────────────────────────────────────────

export function getSourceDescriptor(key: string): ExportSourceDescriptor | undefined {
  return EXPORT_SOURCES[key];
}
