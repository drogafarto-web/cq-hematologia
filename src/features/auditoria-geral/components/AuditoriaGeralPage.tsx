import { useState } from 'react';
import { AuditoriasDashboard } from './AuditoriasDashboard';
import { DashboardAnalitico } from './DashboardAnalitico';
import { WizardAuditoria } from './WizardAuditoria';

type TabView = 'auditorias' | 'analytics';

export default function AuditoriaGeralPage() {
  const [selectedAuditoriaId, setSelectedAuditoriaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>('auditorias');

  if (selectedAuditoriaId) {
    return (
      <WizardAuditoria auditoriaId={selectedAuditoriaId} onBack={() => setSelectedAuditoriaId(null)} />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex items-center gap-1 px-6 pt-6">
        <button
          onClick={() => setActiveTab('auditorias')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'auditorias'
              ? 'bg-white/[0.06] text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          Auditorias
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'bg-white/[0.06] text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          Analytics
        </button>
      </div>
      {activeTab === 'auditorias' ? (
        <AuditoriasDashboard onSelect={setSelectedAuditoriaId} />
      ) : (
        <DashboardAnalitico />
      )}
    </div>
  );
}