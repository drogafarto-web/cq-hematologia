/**
 * personnel/components/PersonnelDashboard.tsx
 *
 * Main entry point for Personnel module.
 * Displays org chart + cargo library.
 * Dark-first design matching Apple/Linear references.
 */

import React, { useEffect, useState } from 'react';
import { useOrgChart } from '../hooks/useOrgChart';
import { useCargos } from '../hooks/useCargos';
import { usePersonnelDossierGate } from '../hooks/usePersonnelDossierGate';
import { OrgChart } from './OrgChart';
import { CargoList } from './CargoList';
import { PersonnelDossierTab } from './PersonnelDossierTab';

type TabName = 'org-chart' | 'cargos' | 'dossier';

export function PersonnelDashboard(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabName>('org-chart');
  const { canAccess: canDossier, loading: dossierGateLoading } = usePersonnelDossierGate();
  const { tree, loading: treeLoading, error: treeError } = useOrgChart();
  const { cargos, loading: cargosLoading, error: cargosError } = useCargos();

  useEffect(() => {
    if (dossierGateLoading) return;
    if (activeTab === 'dossier' && !canDossier) {
      setActiveTab('org-chart');
    }
  }, [activeTab, canDossier, dossierGateLoading]);

  const loading = treeLoading || cargosLoading;
  const error = treeError || cargosError;

  return (
    <main className="min-h-screen bg-[#141417]">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#141417]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Pessoal</h1>
              <p className="mt-1 text-sm text-white/60">Organograma e Descrição de Cargos</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-white/10 px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('org-chart')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'org-chart'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
              role="tab"
              aria-selected={activeTab === 'org-chart'}
              aria-controls="personnel-tabpanel"
            >
              Organograma
            </button>
            <button
              onClick={() => setActiveTab('cargos')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'cargos'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
              role="tab"
              aria-selected={activeTab === 'cargos'}
              aria-controls="personnel-tabpanel"
            >
              Cargos
            </button>
            {!dossierGateLoading && canDossier && (
              <button
                onClick={() => setActiveTab('dossier')}
                className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'dossier'
                    ? 'border-violet-500 text-white'
                    : 'border-transparent text-white/60 hover:text-white'
                }`}
                role="tab"
                aria-selected={activeTab === 'dossier'}
                aria-controls="personnel-tabpanel"
              >
                Dossiê
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div id="personnel-tabpanel" role="tabpanel" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="rounded-lg bg-red-500/10 p-4 text-red-200">
            <p className="text-sm font-medium">Erro ao carregar dados: {error.message}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        )}

        {!loading && !error && activeTab === 'org-chart' && <OrgChart nodes={tree} />}

        {!loading && !error && activeTab === 'cargos' && <CargoList cargos={cargos} />}

        {!loading && !error && activeTab === 'dossier' && canDossier && (
          <PersonnelDossierTab canEdit={canDossier} />
        )}
      </div>
    </main>
  );
}

export default PersonnelDashboard;
