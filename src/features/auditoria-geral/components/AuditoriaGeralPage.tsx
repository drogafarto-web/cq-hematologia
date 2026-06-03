import { useState } from 'react';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { AuditoriasDashboard } from './AuditoriasDashboard';
import { DashboardAnalitico } from './DashboardAnalitico';
import { WizardAuditoria } from './WizardAuditoria';

type TabView = 'auditorias' | 'indicadores';

export default function AuditoriaGeralPage() {
  const [selectedAuditoriaId, setSelectedAuditoriaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>('auditorias');

  if (selectedAuditoriaId) {
    return (
      <ErrorBoundary>
        <WizardAuditoria
          auditoriaId={selectedAuditoriaId}
          onBack={() => setSelectedAuditoriaId(null)}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 text-slate-900 dark:bg-[#0B0F14] dark:text-white">
        <div className="flex items-center gap-1 px-6 pt-6">
          <button
            onClick={() => setActiveTab('auditorias')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'auditorias'
                ? 'bg-slate-200 text-slate-900 dark:bg-white/[0.06] dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/60'
            }`}
          >
            Auditorias
          </button>
          <button
            onClick={() => setActiveTab('indicadores')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'indicadores'
                ? 'bg-slate-200 text-slate-900 dark:bg-white/[0.06] dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/60'
            }`}
          >
            Indicadores
          </button>
        </div>
        {activeTab === 'auditorias' ? (
          <AuditoriasDashboard onSelect={setSelectedAuditoriaId} />
        ) : (
          <DashboardAnalitico />
        )}
      </div>
    </ErrorBoundary>
  );
}
