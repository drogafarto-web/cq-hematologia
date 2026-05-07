import React, { useState } from 'react';
import { LaudoList } from './LaudoList';
import { LaudoCard } from './LaudoCard';
import { LaudoViewer } from './LaudoViewer';
import { PatientProfileCard } from './PatientProfileCard';
import { usePatientLaudos } from '../hooks/usePatientLaudos';
import { usePatientId, usePatientLabId, usePatientAuthStore } from '../hooks/usePatientAuthStore';
import type { PatientPortalLaudo } from '../types/index';

interface PatientPortalDashboardProps {
  patientName: string;
  labName: string;
  onLogout: () => void;
  viewMode?: 'table' | 'grid';
  onViewChange?: (mode: 'table' | 'grid') => void;
}

/**
 * PatientPortalDashboard — Main portal component
 *
 * Orchestrates:
 * - Real-time laudo listener via usePatientLaudos()
 * - Profile sidebar with session countdown
 * - Table/grid view switcher
 * - Detail viewer modal
 * - Filtering, sorting, pagination
 *
 * Dark-first, responsive (mobile-first)
 *
 * Usage:
 *   <PatientPortalDashboard
 *     patientName="João Silva"
 *     labName="Lab Clínico"
 *     onLogout={handleLogout}
 *   />
 */

export const PatientPortalDashboard = React.memo(function PatientPortalDashboard({
  patientName,
  labName,
  onLogout,
  viewMode = 'table',
  onViewChange,
}: PatientPortalDashboardProps) {
  const patientId = usePatientId();
  const labId = usePatientLabId();
  const clearSession = usePatientAuthStore((s) => s.clearSession);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedLaudo, setSelectedLaudo] = useState<PatientPortalLaudo | null>(null);
  const [sortBy, setSortBy] = useState<'date-newest' | 'date-oldest' | 'exam-name'>(
    'date-newest'
  );

  const { laudos, isLoading, error, refetch } = usePatientLaudos(labId, patientId);

  const handleViewLaudo = (laudo: PatientPortalLaudo) => {
    setSelectedLaudo(laudo);
    setViewerOpen(true);
  };

  const handleLogout = () => {
    clearSession();
    onLogout();
  };

  const handleViewerClose = () => {
    setViewerOpen(false);
    setTimeout(() => setSelectedLaudo(null), 300); // Wait for animation
  };

  if (!patientId || !labId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Acesso não autorizado</h1>
          <p className="text-slate-400 mb-4">Por favor, autentique-se novamente.</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30"
          >
            Fazer login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Meus Laudos</h1>
          <p className="text-slate-400">
            Visualize e baixe seus resultados de laboratório
          </p>
        </div>

        {/* Layout: Sidebar + Main */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <PatientProfileCard
                patientName={patientName}
                labName={labName}
                onLogout={handleLogout}
              />
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 space-y-6">
            {/* View mode switcher */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewChange?.('table')}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${
                      viewMode === 'table'
                        ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                        : 'bg-white/8 text-slate-400 border border-white/10 hover:bg-white/10'
                    }
                  `}
                  aria-label="Visualizar como tabela"
                >
                  ⊞ Tabela
                </button>
                <button
                  onClick={() => onViewChange?.('grid')}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${
                      viewMode === 'grid'
                        ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                        : 'bg-white/8 text-slate-400 border border-white/10 hover:bg-white/10'
                    }
                  `}
                  aria-label="Visualizar como grade"
                >
                  ⊟ Grade
                </button>
              </div>

              <button
                onClick={refetch}
                disabled={isLoading}
                className="
                  px-3 py-2 rounded-lg text-sm
                  bg-white/8 text-slate-400 border border-white/10
                  hover:bg-white/10 disabled:opacity-50
                  transition-colors
                "
                aria-label="Recarregar laudos"
              >
                {isLoading ? '⧖ Atualizando...' : '🔄 Recarregar'}
              </button>
            </div>

            {/* Content */}
            {viewMode === 'table' ? (
              <LaudoList
                laudos={laudos}
                isLoading={isLoading}
                error={error}
                onView={handleViewLaudo}
                onRefresh={refetch}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            ) : (
              <>
                {isLoading && laudos.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/8 bg-white/4 h-80 animate-pulse"
                      />
                    ))}
                  </div>
                ) : error ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <h3 className="font-semibold text-red-300 mb-2">Erro ao carregar laudos</h3>
                    <p className="text-sm text-red-200 mb-3">{error.message}</p>
                    <button
                      onClick={refetch}
                      className="
                        px-4 py-2 rounded-lg
                        bg-red-500/20 text-red-300 hover:bg-red-500/30
                        text-sm font-medium transition-colors
                        border border-red-500/30
                      "
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : laudos.length === 0 ? (
                  <div className="rounded-xl border border-white/8 bg-white/4 p-12 text-center">
                    <div className="text-4xl mb-4">📋</div>
                    <h3 className="font-semibold text-white mb-2">
                      Nenhum laudo disponível
                    </h3>
                    <p className="text-sm text-slate-400">
                      Seus resultados de laboratório aparecerão aqui quando estiverem prontos.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {laudos.map((laudo) => (
                      <LaudoCard
                        key={laudo.id}
                        laudo={laudo}
                        onView={handleViewLaudo}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Viewer Modal */}
      {selectedLaudo && (
        <LaudoViewer
          laudo={selectedLaudo}
          isOpen={viewerOpen}
          onClose={handleViewerClose}
          breadcrumbs={[
            { label: 'Dashboard', href: '#' },
            { label: selectedLaudo.nome },
          ]}
        />
      )}

      {/* LGPD Notice (first-time) */}
      <LGPDNotice />
    </div>
  );
});

/**
 * LGPD Privacy Notice — shown on first visit
 * RN-P06: Disclaimer LGPD on first screen
 */
function LGPDNotice() {
  const [dismissed, setDismissed] = React.useState(
    localStorage.getItem('lgpd_notice_dismissed') === 'true'
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('lgpd_notice_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-sm z-40">
      <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4 backdrop-blur-sm">
        <h3 className="font-semibold text-blue-300 mb-2 text-sm">Aviso de Privacidade</h3>
        <p className="text-xs text-blue-200 mb-3">
          Seus dados estão protegidos pela Lei Geral de Proteção de Dados (LGPD).{' '}
          <a href="/privacy-policy" className="underline hover:text-blue-100" target="_blank" rel="noopener noreferrer">
            Leia nossa política
          </a>
          .
        </p>
        <button
          onClick={handleDismiss}
          className="
            w-full px-3 py-1.5 rounded-lg text-xs
            bg-blue-500/20 text-blue-300 hover:bg-blue-500/30
            border border-blue-500/30 transition-colors
          "
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
