import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAuditorias } from '../hooks/useAuditorias';
import { AuditoriaPlanning } from './AuditoriaPlanning';
import { SessoesList } from './SessoesList';
import { AuditoriasList } from './AuditoriasList';
import { SessaoExecucaoPanel } from './SessaoExecucaoPanel';
import { AuditProgressDashboard } from './AuditProgressDashboard';
import { ReAuditoriaChain } from './ReAuditoriaChain';
import { ChevronLeft, LayoutDashboard, Play, History, Settings2 } from 'lucide-react';

/**
 * AuditoriaView — main entry point for auditoria-interna module
 *
 * Refactored to "Professional Platform" structure:
 * 1. Global View (Planning / Active / History)
 * 2. Audit Dashboard (Detailed view of a single audit)
 * 3. Execution (The actual checklist)
 */
export function AuditoriaView() {
  const labId = useActiveLabId();
  const { auditorias, isLoading, error } = useAuditorias();
  const [currentTab, setCurrentTab] = useState<'planejamento' | 'em-execucao' | 'historico'>(
    'em-execucao',
  );

  // State for the "Audit Dashboard" view
  const [viewedAuditoriaId, setViewedAuditoriaId] = useState<string | null>(null);

  // State for the "Execution" view
  const [activeSessao, setActiveSessao] = useState<{
    auditoriaId: string;
    sessaoId: string;
  } | null>(null);

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
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
          <p className="text-red-400 font-semibold text-lg">Erro ao carregar auditorias</p>
          <p className="text-sm text-white/60">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // View 3: Execution Panel
  if (activeSessao) {
    return (
      <SessaoExecucaoPanel
        auditoriaId={activeSessao.auditoriaId}
        sessaoId={activeSessao.sessaoId}
        onBack={() => setActiveSessao(null)}
      />
    );
  }

  // View 2: Audit Dashboard
  if (viewedAuditoriaId) {
    const audit = auditorias.find((a) => a.id === viewedAuditoriaId);
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between max-w-7xl mx-auto gap-4">
          <button
            onClick={() => setViewedAuditoriaId(null)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition w-fit"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Voltar para lista</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              Ciclo {audit?.ano} — {audit?.frequencia}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                audit?.status === 'em_execução'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {audit?.status.replace('_', ' ')}
            </span>
          </div>
        </header>

        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Stats & Progress */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 rounded-xl bg-violet-600/20 text-violet-400">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Painel de Conformidade</h2>
              </div>
              <AuditProgressDashboard
                auditoriaId={viewedAuditoriaId}
                labId={labId}
                sessaoId="" // Not used for this summary view yet
                responses={[]} // This would normally come from a real-time hook
              />
            </section>

            <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl">
              <ReAuditoriaChain auditoriaId={viewedAuditoriaId} />
            </section>
          </div>

          {/* Right Column: Sessions & Actions */}
          <div className="space-y-8">
            <section className="bg-gradient-to-br from-violet-600/10 to-fuchsia-600/10 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Play className="w-5 h-5 text-violet-400" />
                Sessões de Campo
              </h3>
              <SessoesList
                auditorias={audit ? [audit] : []}
                onSelectSessao={(audId, sesId) =>
                  setActiveSessao({ auditoriaId: audId, sessaoId: sesId })
                }
              />
            </section>

            <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-white/60" />
                Ações Rápidas
              </h3>
              <div className="space-y-3">
                <button className="w-full text-left px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition text-sm font-medium">
                  Exportar Relatório PDF
                </button>
                <button className="w-full text-left px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition text-sm font-medium">
                  Gerenciar Auditores
                </button>
                <button className="w-full text-left px-5 py-3 rounded-2xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400 text-sm font-medium">
                  Cancelar Auditoria
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  // View 1: Main List View
  return (
    <div className="min-h-screen bg-[#141417] text-white/90">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#141417]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent tracking-tight">
                Auditoria Interna
              </h1>
              <p className="text-white/40 text-base mt-2 font-medium">
                Módulo de Gestão da Qualidade (DICQ/ISO)
              </p>
            </div>

            <div className="flex gap-1.5 p-1.5 bg-white/5 rounded-2xl border border-white/10 w-fit">
              {(['planejamento', 'em-execucao', 'historico'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCurrentTab(tab)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                    currentTab === tab
                      ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)]'
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  {tab === 'planejamento' && 'Planejamento'}
                  {tab === 'em-execucao' && 'Ativas'}
                  {tab === 'historico' && 'Histórico'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        {currentTab === 'planejamento' && <AuditoriaPlanning auditorias={auditorias} />}
        {currentTab === 'em-execucao' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {auditorias
              .filter((a) => a.status === 'em_execução')
              .map((audit) => (
                <AuditCard
                  key={audit.id}
                  audit={audit}
                  onClick={() => setViewedAuditoriaId(audit.id)}
                />
              ))}
            {auditorias.filter((a) => a.status === 'em_execução').length === 0 && (
              <div className="col-span-full py-32 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01]">
                <div className="mb-6 inline-flex p-5 rounded-3xl bg-white/5 text-white/20">
                  <LayoutDashboard className="w-12 h-12" />
                </div>
                <p className="text-white/40 text-lg font-medium">
                  Nenhuma auditoria ativa no momento.
                </p>
                <p className="text-white/20 text-sm mt-1">
                  Vá em Planejamento para iniciar um novo ciclo.
                </p>
              </div>
            )}
          </div>
        )}
        {currentTab === 'historico' && (
          <AuditoriasList auditorias={auditorias.filter((a) => a.status === 'finalizada')} />
        )}
      </div>
    </div>
  );
}

function AuditCard({ audit, onClick }: { audit: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative text-left p-8 rounded-[32px] bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-white/[0.08] transition-all duration-500 shadow-2xl overflow-hidden"
    >
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 blur-[60px] group-hover:bg-violet-600/20 transition-colors" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-8">
          <div className="p-4 rounded-2xl bg-violet-600/20 text-violet-400 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(124,58,237,0.3)] transition-all duration-500">
            <Play className="w-7 h-7" />
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black">
              Ciclo Ativo
            </p>
            <p className="text-3xl font-black text-white">{audit.ano}</p>
          </div>
        </div>

        <h3 className="text-2xl font-bold mb-4 group-hover:text-violet-400 transition-colors">
          {audit.frequencia}
        </h3>

        <div className="space-y-6">
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="w-1/3 h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full group-hover:shadow-[0_0_15px_rgba(124,58,237,0.5)] transition-all" />
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold text-white/30 uppercase tracking-widest">
            <span>
              {audit.tipoExecucao === 'reAuditoria' ? 'Re-auditoria' : 'Auditoria Inicial'}
            </span>
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              {new Date(audit.criadoEm.toDate()).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
