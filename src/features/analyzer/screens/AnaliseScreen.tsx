import { AnalyteSelector } from '../../chart/AnalyteSelector';
import { LeveyJenningsChart } from '../../chart/LeveyJenningsChart';
import { StatsSourceToggle } from '../../chart/StatsSourceToggle';
import { useAppStore } from '../../../store/useAppStore';
import type { ControlLot, Analyte } from '../../../types';
import type { UseChartDataReturn } from '../../chart/hooks/useChartData';
import { WARNING_ONLY_WESTGARD_RULES } from '../../../constants';
import { DownloadIcon, PlusIcon } from '../components/icons';

// ─── Icons ────────────────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

// ─── Westgard chips ───────────────────────────────────────────────────────────

const ALL_RULES = ['1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10x'];

function LevelPills({
  lots,
  activeLot,
  onSelect,
}: {
  lots: ControlLot[];
  activeLot: ControlLot | null;
  onSelect: (id: string) => void;
}) {
  // Only show pills for lots in the same month/year as the active lot — prevents duplicate "NV1" buttons across months
  const monthKey = activeLot
    ? `${activeLot.startDate.getFullYear()}-${activeLot.startDate.getMonth()}`
    : null;
  const samePeriod = monthKey
    ? lots.filter((l) => `${l.startDate.getFullYear()}-${l.startDate.getMonth()}` === monthKey)
    : lots;
  const sorted = [...samePeriod].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));

  if (sorted.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 ml-4 px-3 py-1 bg-slate-100 dark:bg-white/[0.05] rounded-full border border-slate-200 dark:border-white/[0.08]">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
        Nível:
      </span>
      <div className="flex gap-1">
        {sorted.map((lot) => {
          const isActive = lot.id === activeLot?.id;
          return (
            <button
              key={lot.id}
              type="button"
              onClick={() => onSelect(lot.id)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08]'
              }`}
            >
              NV{lot.level ?? lot.lotNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WestgardChips({ violations }: { violations: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_RULES.map((rule) => {
        const active = violations.includes(rule);
        return (
          <span
            key={rule}
            className={`font-mono text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
              active
                ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30'
                : 'bg-white dark:bg-transparent text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/[0.08]'
            }`}
          >
            {rule}
          </span>
        );
      })}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lots: ControlLot[];
  activeLot: ControlLot | null;
  selectLot: (id: string) => void | Promise<void>;
  validAnalyteId: string | null;
  setSelectedAnalyte: (id: string) => void;
  statsMode: {
    mode: 'manufacturer' | 'internal';
    setMode: (m: 'manufacturer' | 'internal') => void;
    hasEnoughForInternal: boolean;
    approvedRuns: number;
    warning: string | null;
  };
  chartData: UseChartDataReturn;
  currentAnalyte: Analyte | null;
  goTo: (page: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnaliseScreen({
  lots,
  activeLot,
  selectLot,
  validAnalyteId,
  setSelectedAnalyte,
  statsMode,
  chartData,
  currentAnalyte,
  goTo,
}: Props) {
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  // Collect all active violations from the lot
  const activeViolations = activeLot
    ? [
        ...new Set(
          activeLot.runs
            .flatMap((r) => r.results)
            .filter((res) => (validAnalyteId ? res.analyteId === validAnalyteId : true))
            .flatMap((res) => res.violations ?? [])
            .filter((v) => !WARNING_ONLY_WESTGARD_RULES.has(v)),
        ),
      ]
    : [];

  return (
    <>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Análise estatística
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visualizando tendências e regras de Westgard
            {activeLot ? ` para ${activeLot.equipmentName}` : ''}
          </p>
        </div>

        <LevelPills lots={lots} activeLot={activeLot} onSelect={selectLot} />

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentView('reports')}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors"
          >
            <CalendarIcon /> Comparar lotes
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('reports')}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors"
          >
            <DownloadIcon /> Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => goTo('nova')}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <PlusIcon /> Nova corrida
          </button>
        </div>
      </div>

      {!activeLot ? (
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Nenhum lote de controle ativo
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4">
            Selecione um lote para visualizar o gráfico de controle
          </p>
          <button
            type="button"
            onClick={() => goTo('lotes')}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Ir para Lotes
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Analyte selector */}
          {activeLot.requiredAnalytes.length > 0 && (
            <AnalyteSelector
              lot={activeLot}
              selectedAnalyteId={validAnalyteId}
              onSelect={setSelectedAnalyte}
            />
          )}

          {/* Stats source toggle */}
          {validAnalyteId && currentAnalyte && (
            <StatsSourceToggle
              value={statsMode.mode}
              onChange={statsMode.setMode}
              hasEnoughForInternal={statsMode.hasEnoughForInternal}
              approvedRuns={statsMode.approvedRuns}
              warning={statsMode.warning}
            />
          )}

          {/* LJ Chart */}
          {validAnalyteId && currentAnalyte ? (
            <>
              <LeveyJenningsChart chartData={chartData} analyte={currentAnalyte} />

              {/* Westgard rules status */}
              <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="flex items-center px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
                  <span className="text-sm font-semibold text-slate-700 dark:text-white/80">
                    Regras de Westgard
                  </span>
                  {activeViolations.length > 0 && (
                    <span className="ml-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      {activeViolations.length} violação{activeViolations.length > 1 ? 'ões' : ''}
                    </span>
                  )}
                  {activeViolations.length === 0 && (
                    <span className="ml-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      Sem violações
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <WestgardChips violations={activeViolations} />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-8 text-center shadow-sm">
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Selecione um analito acima para ver o gráfico de Levey-Jennings
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
