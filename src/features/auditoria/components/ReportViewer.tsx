/**
 * SA-13: ReportViewer — Exec summary + diff table + expandable sections
 *
 * Displays NLP-summarized audit report with:
 * - Executive summary (prose)
 * - Diff table comparing periods
 * - Expandable sections per metric
 * - Print-friendly styles
 *
 * No external chart libs — diff is a pure HTML table.
 */

import React, { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { getDoc, doc, db } from '../../../shared/services/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportMetric {
  name: string;
  previousValue: number | null;
  currentValue: number | null;
}

interface ReportSection {
  title: string;
  content: string;
}

interface AuditReport {
  id: string;
  labId: string;
  summary: string;
  metrics: ReportMetric[];
  sections: ReportSection[];
  generatedBy: string;
  generatedAt: number; // ms epoch
  periodFrom: number;
  periodTo: number;
}

interface ReportViewerProps {
  labId: string;
  reportId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportViewer({ labId, reportId }: ReportViewerProps): JSX.Element {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const reportRef = doc(db, `labs/${labId}/audit-reports/${reportId}`);
        const snap = await getDoc(reportRef);

        if (!snap.exists()) {
          throw new Error('Relatório não encontrado');
        }

        const data = snap.data();
        if (isMounted) {
          setReport({
            id: snap.id,
            labId: data.labId,
            summary: data.summary || 'Sumário não disponível.',
            metrics: data.metrics || [],
            sections: data.sections || [],
            generatedBy: data.generatedBy,
            generatedAt: data.generatedAt,
            periodFrom: data.periodFrom,
            periodTo: data.periodTo,
          });
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [labId, reportId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 rounded-lg bg-rose-500/15 border border-rose-400/30 text-sm text-rose-200">
        {error?.message || 'Erro ao carregar relatório'}
      </div>
    );
  }

  const formatDate = (ms: number) => new Date(ms).toLocaleDateString('pt-BR');
  const periodLabel = `${formatDate(report.periodFrom)} — ${formatDate(report.periodTo)}`;

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const getDiffClass = (prev: number | null, curr: number | null) => {
    if (prev === null || curr === null) return 'text-white/70';
    if (curr > prev) return 'text-rose-400'; // regression
    if (curr < prev) return 'text-emerald-400'; // improvement
    return 'text-white/70'; // neutral
  };

  return (
    <div className="flex flex-col gap-8 print:gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-white/10 pb-6 print:pb-4">
        <h1 className="text-2xl font-bold text-white/90 mb-2">Relatório de Auditoria</h1>
        <div className="text-sm text-white/60 space-y-1">
          <p>Período: {periodLabel}</p>
          <p>Gerado em: {new Date(report.generatedAt).toLocaleString('pt-BR')}</p>
          <p>Por: {report.generatedBy}</p>
        </div>
      </div>

      {/* Executive Summary */}
      <section className="prose prose-invert print:prose-sm">
        <h2 className="text-lg font-semibold text-white/90 mb-4">Sumário Executivo</h2>
        <p className="text-sm text-white/70 leading-6 whitespace-pre-wrap">{report.summary}</p>
      </section>

      {/* Diff Table */}
      {report.metrics.length > 0 && (
        <section className="overflow-x-auto print:text-xs">
          <h2 className="text-lg font-semibold text-white/90 mb-4">Métricas Comparadas</h2>
          {report.metrics.length === 0 ? (
            <p className="text-sm text-white/60">Sem dados comparáveis no período anterior</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-white/60 font-medium">Métrica</th>
                  <th className="text-right p-3 text-white/60 font-medium tabular-nums">
                    Período anterior
                  </th>
                  <th className="text-right p-3 text-white/60 font-medium tabular-nums">
                    Período atual
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.metrics.map((metric, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-3 text-white/90 font-mono text-xs">{metric.name}</td>
                    <td className="p-3 text-right tabular-nums text-white/70">
                      {metric.previousValue !== null ? metric.previousValue.toFixed(2) : '—'}
                    </td>
                    <td
                      className={`p-3 text-right tabular-nums font-semibold ${getDiffClass(
                        metric.previousValue,
                        metric.currentValue,
                      )}`}
                    >
                      {metric.currentValue !== null ? metric.currentValue.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Expandable Sections */}
      {report.sections.length > 0 && (
        <section className="flex flex-col gap-3 print:gap-2">
          <h2 className="text-lg font-semibold text-white/90">Seções detalhadas</h2>
          {report.sections.map((section) => (
            <details
              key={section.title}
              open={expandedSections.has(section.title)}
              onToggle={() => toggleSection(section.title)}
              className="group border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/5 transition-colors print:open"
            >
              <summary className="flex items-center justify-between text-sm font-medium text-white/90 select-none">
                {section.title}
                <span
                  className="text-violet-400 group-open:rotate-180 transition-transform"
                  aria-hidden="true"
                >
                  ▼
                </span>
              </summary>
              <div className="mt-4 text-sm text-white/70 leading-6 whitespace-pre-wrap">
                {section.content}
              </div>
            </details>
          ))}
        </section>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white;
            color: black;
          }
          .prose {
            color: black;
          }
          table {
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #ddd;
          }
        }
      `}</style>
    </div>
  );
}
