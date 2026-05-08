/**
 * Portal RT — Entry Point (Lazy-loaded)
 *
 * Phase 4 Responsible Technician (RT) dashboard.
 * Scaffold: navigation shell ready for feature modules.
 */

import React from 'react';
import { useActiveLabId } from '../../store/useAuthStore';
import { PortalRTShell } from './components/PortalRTShell';
import { usePortalRTNav } from './hooks/usePortalRTNav';
import { PortalHeading, PortalSection } from './components/_ui';
import { useActiveLab } from '../../store/useAuthStore';

export function PortalRTView() {
  const activeLabId = useActiveLabId();
  const activeLab = useActiveLab();
  const { activeSection, selectSection, escalationCount, isValidRT, isLoading } = usePortalRTNav();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#141417]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-violet-500/20 flex items-center justify-center animate-pulse">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-violet-400">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
          </div>
          <p className="text-white/70 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isValidRT) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#141417]">
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-rose-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-white font-medium mb-2">Acesso não autorizado</p>
          <p className="text-white/50 text-sm mb-4">Você não tem permissão para acessar este módulo.</p>
        </div>
      </div>
    );
  }

  const labName = activeLab?.name || activeLabId || 'Lab';
  const operatorName = 'Responsável Técnico';

  return (
    <PortalRTShell
      labId={activeLabId || ''}
      labName={labName}
      operatorName={operatorName}
      activeSection={activeSection}
      onSelectSection={selectSection}
      escalationCount={escalationCount}
    >
      {/* Placeholder content for each section */}
      {activeSection === 'dashboard' && (
        <PortalSection title="Dashboard" subtitle="Visão geral operacional">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['Testes em Fila', 'Críticos Pendentes', 'Taxa de Conformidade', 'Últimas 24h'].map((card) => (
              <div key={card} className="p-4 rounded-lg bg-[#1a1a1d] border border-white/8">
                <p className="text-white/50 text-sm mb-2">{card}</p>
                <p className="text-2xl font-semibold text-white">—</p>
              </div>
            ))}
          </div>
        </PortalSection>
      )}

      {activeSection === 'criticos' && (
        <PortalSection title="Valores Críticos" subtitle="Escalações e revisões pendentes">
          <div className="p-6 rounded-lg bg-[#1a1a1d] border border-white/8 text-center">
            <p className="text-white/50">Nenhum valor crítico pendente</p>
          </div>
        </PortalSection>
      )}

      {activeSection === 'resultados' && (
        <PortalSection title="Resultados" subtitle="Testes processados e laudos">
          <div className="p-6 rounded-lg bg-[#1a1a1d] border border-white/8 text-center">
            <p className="text-white/50">Nenhum resultado para exibir</p>
          </div>
        </PortalSection>
      )}

      {activeSection === 'compliance' && (
        <PortalSection title="Compliance" subtitle="Conformidade regulatória e auditoria">
          <div className="p-6 rounded-lg bg-[#1a1a1d] border border-white/8 text-center">
            <p className="text-white/50">Módulo em desenvolvimento</p>
          </div>
        </PortalSection>
      )}

      {activeSection === 'configuracao' && (
        <PortalSection title="Configuração" subtitle="Ajustes e preferências">
          <div className="p-6 rounded-lg bg-[#1a1a1d] border border-white/8 text-center">
            <p className="text-white/50">Módulo em desenvolvimento</p>
          </div>
        </PortalSection>
      )}
    </PortalRTShell>
  );
}
