import React, { useState, lazy, Suspense } from 'react';
import { useAnalitos } from '../hooks/useAnalitos';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useRuns } from '../hooks/useRuns';

const LeveyJenningsChart = lazy(() => import('./LeveyJenningsChart'));
const StatsToggle = lazy(() => import('./StatsToggle'));

interface AnalyticsDashboardProps {
  labId: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ labId }) => {
  const [selectedAnalito, setSelectedAnalito] = useState<string>('');
  const [selectedEquipamento, setSelectedEquipamento] = useState<string>('');
  const [selectedNivel, setSelectedNivel] = useState<string>('');
  const [statsSource, setStatsSource] = useState<'manufacturer' | 'internal'>('manufacturer');

  const { analitos = [], loading: analytosLoading = false } = useAnalitos();
  const { equipamentos = [], loading: equipamentosLoading = false } = useEquipamentos();
  const { runs = [] } = useRuns(
    labId,
    selectedEquipamento ? { equipmentId: selectedEquipamento } : undefined,
  );

  // Set default selections
  React.useEffect(() => {
    if (analitos.length > 0 && !selectedAnalito) {
      setSelectedAnalito(analitos[0].id);
    }
  }, [analitos, selectedAnalito]);

  React.useEffect(() => {
    if (equipamentos.length > 0 && !selectedEquipamento) {
      setSelectedEquipamento(equipamentos[0].id);
    }
  }, [equipamentos, selectedEquipamento]);

  const currentAnalito = analitos.find((a) => a.id === selectedAnalito);
  const niveis = (currentAnalito as any)?.niveis || [];
  React.useEffect(() => {
    if (niveis.length > 0 && !selectedNivel) {
      setSelectedNivel(niveis[0]);
    }
  }, [currentAnalito, selectedNivel, niveis]);

  if (analytosLoading || equipamentosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-slate-400">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (analitos.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-slate-400">Nenhum analito configurado</p>
        </div>
      </div>
    );
  }

  const selectedAnalitoObj = analitos.find((a) => a.id === selectedAnalito);
  const selectedEquipamentoObj = equipamentos.find((e) => e.id === selectedEquipamento);

  // KPI calculations
  const totalRuns = runs.length;
  const approvedRuns = runs.filter((r) => r.status === 'Aprovada').length;
  const approvalRate = totalRuns > 0 ? ((approvedRuns / totalRuns) * 100).toFixed(1) : '—';
  const runsWithViolations = runs.filter((r) => Object.keys(r.violations || {}).length > 0).length;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Analito */}
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-2">Analito</label>
          <select
            value={selectedAnalito}
            onChange={(e) => {
              setSelectedAnalito(e.target.value);
              setSelectedNivel('');
            }}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-violet-500"
          >
            {analitos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Nível */}
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-2">Nível</label>
          <select
            value={selectedNivel}
            onChange={(e) => setSelectedNivel(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-violet-500"
          >
            {niveis.map((n: string) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Equipamento */}
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-2">Equipamento</label>
          <select
            value={selectedEquipamento}
            onChange={(e) => setSelectedEquipamento(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-violet-500"
          >
            {equipamentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stats toggle */}
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-2">Estatística</label>
          <Suspense fallback={<div className="h-9 bg-slate-900 rounded" />}>
            <StatsToggle
              value={statsSource}
              onChange={setStatsSource}
              isInternalReady={false}
              internalProgress={0}
            />
          </Suspense>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/40 border border-slate-700 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Total de Runs (30d)</p>
          <p className="text-2xl font-bold text-slate-100">{totalRuns}</p>
        </div>
        <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
          <p className="text-xs text-green-400 mb-1">Taxa Aprovação</p>
          <p className="text-2xl font-bold text-green-300">{approvalRate}%</p>
        </div>
        <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
          <p className="text-xs text-amber-400 mb-1">Runs com Violações</p>
          <p className="text-2xl font-bold text-amber-300">{runsWithViolations}</p>
        </div>
        <div className="p-4 bg-slate-900/40 border border-slate-700 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Equipamento</p>
          <p className="text-sm font-semibold text-slate-200">
            {(selectedEquipamentoObj as any)?.nome || '—'}
          </p>
        </div>
      </div>

      {/* Main chart */}
      {selectedNivel && (
        <div className="p-4 bg-slate-900/40 border border-slate-700 rounded-lg">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-96">
                <p className="text-slate-400 text-sm">Carregando gráfico...</p>
              </div>
            }
          >
            <LeveyJenningsChart
              data={{
                points: [],
                mean: 0,
                sd: 0,
                lines: [],
                isInternalReady: false,
                statsSource,
              }}
              analitoName={selectedAnalitoObj?.nome || ''}
              nivelName={selectedNivel}
            />
          </Suspense>
        </div>
      )}

      {/* Recent runs table */}
      <div className="p-4 bg-slate-900/40 border border-slate-700 rounded-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Runs Recentes</h3>
        {runs.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Nenhuma run no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">Data</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">Equipamento</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">Status</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium">Violações</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 10).map((run) => (
                  <tr key={run.id} className="border-b border-slate-800">
                    <td className="px-3 py-2 text-slate-300">
                      {new Date(run.criadoEm.toMillis()).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{run.equipmentId}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-medium ${
                          run.status === 'Aprovada' ? 'text-green-400/80' : 'text-red-400/80'
                        }`}
                      >
                        {run.status === 'Aprovada' ? '✓ Aprovada' : '✗ Rejeitada'}
                      </span>
                    </td>
                    <td className="text-right px-3 py-2 text-amber-400/80">
                      {Array.isArray(run.violations) ? run.violations.length : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
