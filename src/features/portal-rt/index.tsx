/**
 * Portal RT — Entry Point (Lazy-loaded)
 *
 * Phase 4 Responsible Technician (RT) dashboard.
 * Full implementation: all 5 sections wired with real-time data subscription patterns.
 */

import React from 'react';
import { useActiveLabId } from '../../store/useAuthStore';
import { PortalRTShell } from './components/PortalRTShell';
import { usePortalRTNav } from './hooks/usePortalRTNav';
import { useActiveLab } from '../../store/useAuthStore';
import { DashboardSection } from './sections/DashboardSection';
import { CriticosSection } from './sections/CriticosSection';
import { ResultadosSection } from './sections/ResultadosSection';
import { ComplianceSection } from './sections/ComplianceSection';
import { ConfiguracaoSection } from './sections/ConfiguracaoSection';

export function PortalRTView() {
  const activeLabId = useActiveLabId();
  const activeLab = useActiveLab();
  const { activeSection, selectSection, escalationCount, isValidRT, isLoading } = usePortalRTNav();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#141417]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-violet-500/20 flex items-center justify-center animate-pulse">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-violet-400"
            >
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
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto mb-4 text-rose-400"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-white font-medium mb-2">Acesso não autorizado</p>
          <p className="text-white/50 text-sm mb-4">
            Você não tem permissão para acessar este módulo.
          </p>
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
      {activeSection === 'dashboard' && <DashboardSection labId={activeLabId || undefined} />}
      {activeSection === 'criticos' && <CriticosSection labId={activeLabId || undefined} />}
      {activeSection === 'resultados' && <ResultadosSection labId={activeLabId || undefined} />}
      {activeSection === 'compliance' && <ComplianceSection labId={activeLabId || undefined} />}
      {activeSection === 'configuracao' && <ConfiguracaoSection labId={activeLabId || undefined} />}
    </PortalRTShell>
  );
}
