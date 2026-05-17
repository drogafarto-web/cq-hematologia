/**
 * AuditoriaView.tsx
 *
 * Main entry point for advanced auditoria module (Phase 7).
 * 4-tab dashboard: Anomalias | Conformidade | Integrações | Relatórios
 *
 * RDC 978 Art. 107 — Anomaly detection + audit trail monitoring
 * DICQ 4.4 — Compliance audit reporting
 */

import React, { useState } from 'react';
import { useActiveLab, useUser } from '../../store/useAuthStore';
import { AlertCenter } from './components/AlertCenter';
import { AlertDrillDown } from './components/AlertDrillDown';
import { ReportBuilder } from './components/ReportBuilder';
import { ComplianceTab } from './components/ComplianceTab';
import { IntegrationsTab } from './components/IntegrationsTab';
import type { AuditAlert } from './types/anomalyTypes';

type Tab = 'anomalias' | 'conformidade' | 'integracoes' | 'relatorios';

export default function AuditoriaView() {
  const activeLab = useActiveLab();
  const user = useUser();
  const labId = activeLab?.id ?? '';

  const [activeTab, setActiveTab] = useState<Tab>('anomalias');
  const [selectedAlert, setSelectedAlert] = useState<AuditAlert | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  if (!labId || !user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 dark:text-white/40 mb-2">Carregando contexto do laboratório...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'anomalias', label: 'Anomalias' },
    { id: 'conformidade', label: 'Conformidade' },
    { id: 'integracoes', label: 'Integrações' },
    { id: 'relatorios', label: 'Relatórios' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase text-violet-400/80 mb-1">
            Conformidade
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Auditoria Avançada
          </h1>
          <p className="text-sm text-slate-600 dark:text-white/40 mt-1">
            Detecção de anomalias, conformidade DICQ e trilha de auditoria
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-white/10">
          <nav className="flex gap-6" aria-label="Abas de auditoria">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'border-transparent text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/80'
                }`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'anomalias' && (
            <div className="bg-white dark:bg-[#141417] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6">
              <AlertCenter
                labId={labId}
                onDrillDown={(alert) => {
                  setSelectedAlert(alert);
                  setDrillDownOpen(true);
                }}
              />
            </div>
          )}

          {activeTab === 'conformidade' && (
            <ComplianceTab labId={labId} />
          )}

          {activeTab === 'integracoes' && (
            <IntegrationsTab labId={labId} />
          )}

          {activeTab === 'relatorios' && (
            <div className="bg-white dark:bg-[#141417] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6">
              <ReportBuilder labId={labId} />
            </div>
          )}
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
          setDrillDownOpen(false);
          setSelectedAlert(null);
        }}
      />
    </div>
  );
}
