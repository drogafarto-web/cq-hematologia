/**
 * AuditoriaView.tsx
 *
 * Main entry point for advanced auditoria module (Phase 7).
 * Renders the full audit dashboard with alerts, drill-down, and reporting.
 *
 * RDC 978 Art. 107 — Anomaly detection + audit trail monitoring
 * DICQ 4.4 — Compliance audit reporting
 */

import React, { useState } from 'react';
import { useActiveLab, useUser } from '../../store/useAuthStore';
import { AlertCenter } from './components/AlertCenter';
import { AlertDrillDown } from './components/AlertDrillDown';
import { ReportBuilder } from './components/ReportBuilder';
import type { AuditAlert } from './types/anomalyTypes';

export default function AuditoriaView() {
  const activeLab = useActiveLab();
  const user = useUser();
  const labId = activeLab?.id ?? '';

  const [selectedAlert, setSelectedAlert] = useState<AuditAlert | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [reportBuilderOpen, setReportBuilderOpen] = useState(false);

  if (!labId || !user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 dark:text-white/40 mb-2">Carregando contexto do laboratório...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase text-violet-400/80 mb-1">
            Conformidade
          </p>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Auditoria Avançada
              </h1>
              <p className="text-sm text-slate-600 dark:text-white/40 mt-1">
                Detecção de anomalias, relatórios e trilha de auditoria
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReportBuilderOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M2 3a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 9h8M6 5h8M6 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Novo Relatório
            </button>
          </div>
        </div>

        {/* Alert Center */}
        <div className="bg-white dark:bg-[#141417] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6">
          <AlertCenter
            labId={labId}
            onDrillDown={(alert) => {
              setSelectedAlert(alert);
              setDrillDownOpen(true);
            }}
          />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#141417] rounded-lg border border-slate-200 dark:border-white/[0.08] p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-white/50 uppercase tracking-wide">Compliance Audit Trail</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-2">RDC 978</p>
            <p className="text-xs text-slate-500 dark:text-white/30 mt-1">Art. 107 — Detecção de anomalias</p>
          </div>
          <div className="bg-white dark:bg-[#141417] rounded-lg border border-slate-200 dark:border-white/[0.08] p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-white/50 uppercase tracking-wide">DICQ Mapping</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-2">4.4</p>
            <p className="text-xs text-slate-500 dark:text-white/30 mt-1">Audit monitoring + compliance</p>
          </div>
          <div className="bg-white dark:bg-[#141417] rounded-lg border border-slate-200 dark:border-white/[0.08] p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-white/50 uppercase tracking-wide">Operador</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mt-2 truncate">{user?.displayName || user?.email || 'Anônimo'}</p>
            <p className="text-xs text-slate-500 dark:text-white/30 mt-1">Contexto: {labId}</p>
          </div>
        </div>
      </div>

      {/* Alert Drill-Down Modal */}
      <AlertDrillDown
        alert={selectedAlert}
        open={drillDownOpen}
        onClose={() => {
          setDrillDownOpen(false);
          setSelectedAlert(null);
        }}
        onDismiss={async (alertId: string, reason: string) => {
          // Call dismissAlert service
          // For now, just close modal
          setDrillDownOpen(false);
          setSelectedAlert(null);
        }}
      />

      {/* Report Builder Modal */}
      {reportBuilderOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <ReportBuilder
              labId={labId}
              onComplete={() => setReportBuilderOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
