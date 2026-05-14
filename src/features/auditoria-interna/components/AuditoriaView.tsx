import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAuditorias } from '../hooks/useAuditorias';
import { AuditoriaPlanning } from './AuditoriaPlanning';
import { SessoesList } from './SessoesList';
import { AuditoriasList } from './AuditoriasList';
import { SessaoExecucaoPanel } from './SessaoExecucaoPanel';

/**
 * AuditoriaView — main entry point for auditoria-interna module
 *
 * Tabs: Planejamento | Em Execução | Histórico
 * Dark-first, responsive layout for tablet use.
 */
export function AuditoriaView() {
  const labId = useActiveLabId();
  const { auditorias, isLoading, error } = useAuditorias();
  const [currentTab, setCurrentTab] = useState<'planejamento' | 'em-execucao' | 'historico'>('planejamento');
  const [selectedAuditoria, setSelectedAuditoria] = useState<string | null>(null);
  const [selectedSessao, setSelectedSessao] = useState<string | null>(null);

  if (!labId) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <p>Lab não ativo</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-pulse w-12 h-12 bg-white/10 rounded-lg mx-auto" />
          <p>Carregando auditorias...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-red-400">Erro ao carregar auditorias</p>
          <p className="text-sm text-white/60">{error.message}</p>
        </div>
      </div>
    );
  }

  if (selectedAuditoria && selectedSessao) {
    return (
      <SessaoExecucaoPanel
        auditoriaId={selectedAuditoria}
        sessaoId={selectedSessao}
        onBack={() => {
          setSelectedAuditoria(null);
          setSelectedSessao(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#141417] text-white/90">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#141417]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-semibold mb-8">Auditoria Interna</h1>

          {/* Tabs */}
          <div className="flex gap-6">
            {(['planejamento', 'em-execucao', 'historico'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`pb-3 border-b-2 font-medium transition-colors ${
                  currentTab === tab
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-white/60 hover:text-white/90'
                }`}
              >
                {tab === 'planejamento' && 'Planejamento'}
                {tab === 'em-execucao' && 'Em Execução'}
                {tab === 'historico' && 'Histórico'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {currentTab === 'planejamento' && (
          <AuditoriaPlanning auditorias={auditorias} />
        )}
        {currentTab === 'em-execucao' && (
          <SessoesList
            auditorias={auditorias.filter((a) => a.status === 'em_execução')}
            onSelectSessao={(auditoriaId, sessaoId) => {
              setSelectedAuditoria(auditoriaId);
              setSelectedSessao(sessaoId);
            }}
          />
        )}
        {currentTab === 'historico' && (
          <AuditoriasList auditorias={auditorias.filter((a) => a.status === 'finalizada')} />
        )}
      </div>
    </div>
  );
}
