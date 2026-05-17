/**
 * useAuditReportExport.ts
 *
 * React hook for on-demand audit report generation and download.
 * Calls generateAuditReport Cloud Function callable.
 *
 * Phase 7 Wave 3: Advanced Auditoria
 * RDC 978 Art. 107 — Audit trail documentation
 * DICQ 4.4 — Audit monitoring + reporting
 *
 * Features:
 * - Generate reports with custom filters
 * - Support CSV/PDF formats
 * - Download trigger via browser
 * - Error handling and logging
 */

import { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import type { AuditReport, ReportFilter, ReportFormat } from '../types/anomalyTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseAuditReportExportReturn {
  generating: boolean;
  report: AuditReport | null;
  error: string | null;
  generate: (filter: ReportFilter, format?: ReportFormat) => Promise<void>;
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuditReportExport(): UseAuditReportExportReturn {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Call Cloud Function to generate report
  const generate = useCallback(async (
    filter: ReportFilter,
    format: ReportFormat = 'pdf',
  ) => {
    setGenerating(true);
    setError(null);

    try {
      // Call generateAuditReport CF callable
      const callable = httpsCallable<
        { labId: string; filter: ReportFilter },
        AuditReport
      >(functions, 'generateAuditReportPDF');

      const result = await callable({
        labId: filter.labId,
        filter,
      });

      const generatedReport = result.data;
      setReport(generatedReport);



      // Trigger download (basic implementation)
      // In Wave 5, PDF/CSV generation will be implemented server-side
      triggerDownload(generatedReport, format);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report';
      console.error('[useAuditReportExport] Generation error', err);
      setError(msg);
      setReport(null);
    } finally {
      setGenerating(false);
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setGenerating(false);
    setReport(null);
    setError(null);
  }, []);

  return { generating, report, error, generate, reset };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * triggerDownload
 *
 * Initiates browser download of report data.
 * For CSV: sends JSON stringified data
 * For PDF: would use downloadUrl from Cloud Function (Wave 5)
 */
function triggerDownload(report: AuditReport, format: ReportFormat): void {
  try {
    if (format === 'csv') {
      // Generate CSV from report metadata
      const csv = generateCSV(report);
      downloadFile(csv, `audit-report-${report.id}.csv`, 'text/csv');
    } else if (format === 'pdf') {
      // PDF generation is handled server-side in Wave 5
      // For now, download JSON representation
      const json = JSON.stringify(report, null, 2);
      downloadFile(json, `audit-report-${report.id}.json`, 'application/json');
    }
  } catch (err) {
    console.warn('[useAuditReportExport] Download trigger error', err);
  }
}

/**
 * generateCSV
 *
 * Converts report metadata to CSV format.
 */
function generateCSV(report: AuditReport): string {
  const lines: string[] = [];

  // Header
  lines.push('Relatório de Auditoria de Qualidade');
  lines.push(`ID do Relatório: ${report.id}`);
  lines.push(`Data de Geração: ${new Date(report.generatedAt).toLocaleString('pt-BR')}`);
  lines.push('');

  // Summary section
  lines.push('Resumo Executivo');
  lines.push(`Operações Analisadas: ${report.summary.entryCount}`);
  lines.push(`Anomalias Detectadas: ${report.summary.anomalyCount}`);
  lines.push(`Score de Conformidade: ${report.summary.complianceScore}%`);
  lines.push('');

  // Severity breakdown
  lines.push('Classificação por Severidade');
  lines.push(`Críticas: ${report.summary.severityBreakdown.critical}`);
  lines.push(`Altas: ${report.summary.severityBreakdown.high}`);
  lines.push(`Médias: ${report.summary.severityBreakdown.medium}`);
  lines.push('');

  // Filter details
  lines.push('Filtros Aplicados');
  lines.push(`Período: ${report.filter.period}`);
  if (report.filter.modules && report.filter.modules.length > 0) {
    lines.push(`Módulos: ${report.filter.modules.join(', ')}`);
  }
  if (report.filter.operatorIds && report.filter.operatorIds.length > 0) {
    lines.push(`Operadores: ${report.filter.operatorIds.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * downloadFile
 *
 * Triggers browser file download via Blob + link element.
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[useAuditReportExport] Download error', err);
  }
}
