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
import { CompetenciaMatrizTab } from './CompetenciaMatrizTab';
import { SupervisaoTab } from './SupervisaoTab';
import { CienciaTab } from './CienciaTab';
import { IndicadoresTab } from './IndicadoresTab';
import { AutorizacoesTab } from './AutorizacoesTab';

type TabName =
  | 'org-chart'
  | 'cargos'
  | 'dossier'
  | 'competencias'
  | 'supervisao'
  | 'ciencia'
  | 'indicadores'
  | 'autorizacoes';

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

  const [showGuide, setShowGuide] = useState(false);

  return (
    <main className="min-h-screen bg-[#141417]">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#141417]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Pessoal</h1>
              <p className="mt-1 text-sm text-white/60">
                Gestao de Pessoas — DICQ 5.1 + RDC 978 + ISO 15189
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
            >
              {showGuide ? 'Ocultar guia' : 'Guia regulatorio'}
            </button>
          </div>

          {showGuide && (
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                    <th className="px-3 py-2 text-left text-white/50 font-medium">Aba</th>
                    <th className="px-3 py-2 text-left text-white/50 font-medium">
                      Pergunta do auditor
                    </th>
                    <th className="px-3 py-2 text-left text-white/50 font-medium">Base legal</th>
                    <th className="px-3 py-2 text-left text-white/50 font-medium">
                      Texto da legislacao
                    </th>
                    <th className="px-3 py-2 text-left text-white/50 font-medium">Risco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 font-medium">Organograma</td>
                    <td className="px-3 py-1.5 text-white/50">Qual a estrutura do lab?</td>
                    <td className="px-3 py-1.5 text-white/40">
                      DICQ 4.1.2.7 · ISO 5.1 · RDC Art.44
                    </td>
                    <td className="px-3 py-1.5 text-white/35 italic">
                      &quot;O laboratorio deve possuir estrutura organizacional definida e
                      documentada&quot;
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                        NC menor
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 font-medium">Cargos</td>
                    <td className="px-3 py-1.5 text-white/50">
                      Quais responsabilidades de cada funcao?
                    </td>
                    <td className="px-3 py-1.5 text-white/40">
                      DICQ 5.1.3 · ISO 6.2.1 · RDC Art.45
                    </td>
                    <td className="px-3 py-1.5 text-white/35 italic">
                      &quot;Definicao clara de atribuicoes e responsabilidades de cada
                      profissional&quot;
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                        NC menor
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 font-medium">Dossie</td>
                    <td className="px-3 py-1.5 text-white/50">
                      Cade a documentacao desse profissional?
                    </td>
                    <td className="px-3 py-1.5 text-white/40">
                      DICQ 5.1.1 · ISO 6.2.2 · RDC Art.46
                    </td>
                    <td className="px-3 py-1.5 text-white/35 italic">
                      &quot;Manter arquivo atualizado com documentacao de habilitacao
                      profissional&quot;
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px]">
                        NC maior
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 font-medium">Competencias</td>
                    <td className="px-3 py-1.5 text-white/50">
                      Quem esta habilitado para esse exame?
                    </td>
                    <td className="px-3 py-1.5 text-white/40">
                      DICQ 5.1.4 · ISO 6.2.3 · RDC Art.47
                    </td>
                    <td className="px-3 py-1.5 text-white/35 italic">
                      &quot;Qualificacao tecnica compativel com as funcoes desempenhadas, verificada
                      periodicamente&quot;
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px]">
                        NC maior
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 font-medium">Supervisao</td>
                    <td className="px-3 py-1.5 text-white/50">
                      Esse tecnico novo foi supervisionado?
                    </td>
                    <td className="px-3 py-1.5 text-white/40">
                      DICQ 5.1.7 · ISO 6.2.2 · RDC Art.47§2
                    </td>
                    <td className="px-3 py-1.5 text-white/35 italic">
                      &quot;Supervisor tecnico com minimo 2 anos de experiencia deve acompanhar
                      novos profissionais&quot;
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px]">
                        NC maior
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 font-medium">Ciencia</td>
                    <td className="px-3 py-1.5 text-white/50">Ele sabe suas responsabilidades?</td>
                    <td className="px-3 py-1.5 text-white/40">
                      DICQ 5.1.3§2 · ISO 6.2.1 · RDC Art.45§1
                    </td>
                    <td className="px-3 py-1.5 text-white/35 italic">
                      &quot;Comprovacao de ciencia das atribuicoes pelo profissional&quot;
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                        NC menor
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 font-medium">Indicadores</td>
                    <td className="px-3 py-1.5 text-white/50">Como voces monitoram a equipe?</td>
                    <td className="px-3 py-1.5 text-white/40">
                      DICQ 4.15.2 · ISO 8.6 · RDC Art.88
                    </td>
                    <td className="px-3 py-1.5 text-white/35 italic">
                      &quot;Indicadores de qualidade devem ser monitorados e analisados
                      criticamente&quot;
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                        NC menor
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 font-medium">Autorizacoes</td>
                    <td className="px-3 py-1.5 text-white/50">Quem pode liberar laudo?</td>
                    <td className="px-3 py-1.5 text-white/40">
                      RDC Art.48 · DICQ 5.1.4 · ISO 6.2.5
                    </td>
                    <td className="px-3 py-1.5 text-white/35 italic">
                      &quot;O laboratorio deve manter lista atualizada de pessoal autorizado a
                      liberar laudos&quot; · &quot;Registro formal de autorizacoes concedidas a cada
                      profissional&quot; · &quot;Autorizacao documentada para atividades
                      especificas&quot;
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-red-500/25 text-red-200 text-[10px] font-semibold">
                        CRITICA
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-white/[0.06] bg-white/[0.01]">
                <p className="text-[10px] text-white/30">
                  NC critica = risco de interdicao pela ANVISA. NC maior = exige CAPA imediata. NC
                  menor = prazo para correcao.
                </p>
              </div>
            </div>
          )}
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
            <button
              onClick={() => setActiveTab('competencias')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'competencias'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
              role="tab"
              aria-selected={activeTab === 'competencias'}
              aria-controls="personnel-tabpanel"
            >
              Competências
            </button>
            <button
              onClick={() => setActiveTab('supervisao')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'supervisao'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
              role="tab"
              aria-selected={activeTab === 'supervisao'}
              aria-controls="personnel-tabpanel"
            >
              Supervisão
            </button>
            <button
              onClick={() => setActiveTab('ciencia')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'ciencia'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
              role="tab"
              aria-selected={activeTab === 'ciencia'}
              aria-controls="personnel-tabpanel"
            >
              Ciência
            </button>
            <button
              onClick={() => setActiveTab('indicadores')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'indicadores'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
              role="tab"
              aria-selected={activeTab === 'indicadores'}
              aria-controls="personnel-tabpanel"
            >
              Indicadores
            </button>
            <button
              onClick={() => setActiveTab('autorizacoes')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'autorizacoes'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
              role="tab"
              aria-selected={activeTab === 'autorizacoes'}
              aria-controls="personnel-tabpanel"
            >
              Autorizações
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        id="personnel-tabpanel"
        role="tabpanel"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        {error &&
          !['competencias', 'supervisao', 'ciencia', 'indicadores', 'autorizacoes'].includes(
            activeTab,
          ) && (
            <div className="rounded-lg bg-red-500/10 p-4 text-red-200">
              <p className="text-sm font-medium">Erro ao carregar dados: {error.message}</p>
            </div>
          )}

        {loading &&
          !['competencias', 'supervisao', 'ciencia', 'indicadores', 'autorizacoes'].includes(
            activeTab,
          ) && (
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

        {activeTab === 'competencias' && <CompetenciaMatrizTab />}

        {activeTab === 'supervisao' && <SupervisaoTab />}

        {activeTab === 'ciencia' && <CienciaTab />}

        {activeTab === 'indicadores' && <IndicadoresTab />}

        {activeTab === 'autorizacoes' && <AutorizacoesTab />}
      </div>
    </main>
  );
}

export default PersonnelDashboard;
