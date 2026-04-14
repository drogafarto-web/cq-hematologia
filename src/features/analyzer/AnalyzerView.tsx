import React, { useState } from 'react';
import { ANALYTE_MAP }          from '../../constants';
import { useLots }              from '../lots/hooks/useLots';
import { useRuns }              from '../runs/hooks/useRuns';
import { useChartData }         from '../chart/hooks/useChartData';
import { LotManager }           from '../lots/LotManager';
import { NewRunForm }           from '../runs/NewRunForm';
import { ReviewRunModal }       from '../runs/ReviewRunModal';
import { ResultsHistory }       from '../runs/ResultsHistory';
import { LeveyJenningsChart }   from '../chart/LeveyJenningsChart';
import { AnalyteSelector }      from '../chart/AnalyteSelector';
import { StatsSourceToggle }    from '../chart/StatsSourceToggle';
import { useActiveLab, useIsSuperAdmin, useUser } from '../../store/useAuthStore';
import { useAppStore }          from '../../store/useAppStore';
import { useAuthFlow }          from '../auth/hooks/useAuthFlow';
import type { SyncStatus }      from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M7 1L1 4v4c0 3.5 3 5.5 6 6 3-.5 6-2.5 6-6V4L7 1z" fill="white" fillOpacity="0.9" />
      </svg>
    </div>
  );
}

function MenuBars() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="3"  r="1.2" fill="currentColor" />
      <circle cx="8" cy="8"  r="1.2" fill="currentColor" />
      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ChartMiniIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 9.5L4 6l2.5 2 4-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Sync status indicator ────────────────────────────────────────────────────

const SYNC_CFG: Record<SyncStatus, { dot: string; label: string; pulse?: boolean }> = {
  saved:   { dot: 'bg-emerald-500',  label: 'Salvo'     },
  saving:  { dot: 'bg-amber-500',    label: 'Salvando',  pulse: true },
  offline: { dot: 'bg-white/30',     label: 'Offline'   },
  error:   { dot: 'bg-red-500',      label: 'Erro sync' },
};

function SyncDot({ status }: { status: SyncStatus }) {
  const c = SYNC_CFG[status];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.pulse ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-white/30 hidden sm:block">{c.label}</span>
    </div>
  );
}

// ─── Lot info bar (shown when a lot is active) ────────────────────────────────

interface LotInfoBarProps {
  lot: {
    level: 1 | 2 | 3;
    controlName: string;
    lotNumber: string;
    expiryDate: Date;
    runCount: number;
    statistics: Record<string, { mean: number; sd: number }> | null;
  };
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-blue-500/15 text-blue-400',
  2: 'bg-amber-500/15 text-amber-400',
  3: 'bg-rose-500/15 text-rose-400',
};

function LotInfoBar({ lot }: LotInfoBarProps) {
  const now  = Date.now();
  const diff = lot.expiryDate.getTime() - now;
  const days = Math.ceil(diff / 86_400_000);
  const fmtd = lot.expiryDate.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const expiryColor = days < 0 ? 'text-red-400' : days <= 30 ? 'text-amber-400' : 'text-white/30';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-b border-white/[0.05] bg-white/[0.01] shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${LEVEL_COLORS[lot.level]}`}>
          Nv.{lot.level}
        </span>
        <span className="text-sm font-medium text-white/80 truncate">{lot.controlName}</span>
        <span className="text-xs text-white/30 font-mono shrink-0">#{lot.lotNumber}</span>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <span className={`text-xs ${expiryColor}`}>
          Vence {fmtd}{days >= 0 ? ` (${days}d)` : ' — vencido'}
        </span>
        <span className="text-xs text-white/25">{lot.runCount} corrida{lot.runCount !== 1 ? 's' : ''}</span>
        {lot.statistics && (
          <span className="text-[10px] text-violet-400/60 flex items-center gap-1">
            <ChartMiniIcon /> stats internas
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AnalyzerView — the main application shell for operators.
 *
 * Layout:
 *   Header (lab name, sync, menu)
 *   ├── Sidebar (lot manager + add lot)
 *   └── Main (lot info → new run → analyte selector → chart → history)
 *
 * Modals:
 *   ReviewRunModal (when pendingRun is set)
 */
export function AnalyzerView() {
  const { signOut }      = useAuthFlow();
  const activeLab        = useActiveLab();
  const isSuperAdmin     = useIsSuperAdmin();
  const user             = useUser();
  const setCurrentView   = useAppStore((s) => s.setCurrentView);
  const chartStatsSource = useAppStore((s) => s.chartStatsSource);
  const setChartStats    = useAppStore((s) => s.setChartStatsSource);

  const {
    lots, activeLot, activeLotId, selectedAnalyteId, syncStatus,
    addLot, deleteLot, selectLot, setSelectedAnalyte,
  } = useLots();

  const {
    pendingRun, isExtracting, isConfirming, error: runError,
    newRun, confirmRun, cancelRun, deleteRun,
  } = useRuns();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen,    setMenuOpen]    = useState(false);

  // Only use selectedAnalyteId if it belongs to the active lot
  const validAnalyteId =
    activeLot && selectedAnalyteId && activeLot.requiredAnalytes.includes(selectedAnalyteId)
      ? selectedAnalyteId
      : null;

  const chartData      = useChartData(activeLot ?? null, validAnalyteId, chartStatsSource);
  const currentAnalyte = validAnalyteId ? ANALYTE_MAP[validAnalyteId] : null;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-12 border-b border-white/[0.06] shrink-0">
        <button
          type="button"
          aria-label={sidebarOpen ? 'Fechar barra lateral' : 'Abrir barra lateral'}
          onClick={() => setSidebarOpen((v) => !v)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white/70 hover:bg-white/[0.07] transition-all"
        >
          <MenuBars />
        </button>

        <LogoMark />

        <div className="flex-1 min-w-0 flex items-center gap-4">
          <p className="text-sm font-semibold text-white/85 truncate leading-none">
            {activeLab?.name ?? 'CQ Hematologia'}
          </p>


        </div>

        <SyncDot status={syncStatus} />

        {/* Overflow menu */}
        <div className="relative">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.07] transition-all"
          >
            <DotsIcon />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-40 w-48 rounded-xl bg-[#1c1c1c] border border-white/[0.1] shadow-2xl overflow-hidden py-1">
                <div className="px-4 py-2.5 border-b border-white/[0.07] mb-1">
                  <p className="text-xs text-white/50 truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setCurrentView('bulaparser'); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-white/55 hover:text-white/85 hover:bg-white/[0.05] transition-all"
                >
                  Importar bula PDF
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => { setCurrentView('superadmin'); setMenuOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-white/55 hover:text-white/85 hover:bg-white/[0.05] transition-all"
                  >
                    Painel Super Admin
                  </button>
                )}
                <div className="h-px bg-white/[0.06] my-1" />
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full px-4 py-2 text-left text-sm text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
                >
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-60 shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
            <LotManager
              lots={lots}
              activeLotId={activeLotId ?? null}
              onAdd={addLot}
              onDelete={deleteLot}
              onSelect={selectLot}
            />
          </aside>
        )}

        {/* Main panel */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!activeLot ? (
            /* Empty state — no lot selected */
            <div className="flex flex-col items-center justify-center flex-1 py-24 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
                  <rect x="3" y="3" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.3" />
                  <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.3" />
                </svg>
              </div>
              <p className="text-base font-semibold text-white/45">
                {lots.length === 0 ? 'Nenhum lote cadastrado' : 'Selecione um lote de controle'}
              </p>
              <p className="text-sm text-white/25 mt-1.5 max-w-xs leading-relaxed">
                {lots.length === 0
                  ? 'Crie um novo lote na barra lateral para começar a registrar corridas.'
                  : 'Escolha um lote na barra lateral para visualizar o gráfico e registrar corridas.'}
              </p>
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="mt-5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Abrir lotes →
                </button>
              )}
            </div>
          ) : (
            /* Lot selected — main analyzer */
            <>
              <LotInfoBar lot={activeLot} />

              <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-3xl mx-auto w-full">
                {/* New run capture */}
                <NewRunForm
                  onFile={newRun}
                  isExtracting={isExtracting}
                  error={runError}
                />

                {/* Analyte selector */}
                {activeLot.requiredAnalytes.length > 0 && (
                  <AnalyteSelector
                    lot={activeLot}
                    selectedAnalyteId={validAnalyteId}
                    onSelect={(id) => setSelectedAnalyte(id)}
                  />
                )}

                {/* Stats source + chart (only when analyte selected) */}
                {validAnalyteId && currentAnalyte && (
                  <>
                    <StatsSourceToggle
                      value={chartStatsSource}
                      onChange={setChartStats}
                      hasEnoughData={chartData.hasEnoughData}
                      approvedRuns={chartData.approvedRuns}
                    />

                    <LeveyJenningsChart
                      chartData={chartData}
                      analyte={currentAnalyte}
                    />
                  </>
                )}

                {/* Run history */}
                {activeLot.runs.length > 0 && (
                  <ResultsHistory
                    runs={activeLot.runs}
                    lotId={activeLot.id}
                    onDelete={deleteRun}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Review modal ─────────────────────────────────────────────────────── */}
      {pendingRun && activeLot && (
        <ReviewRunModal
          pendingRun={pendingRun}
          activeLot={activeLot}
          onConfirm={confirmRun}
          onCancel={cancelRun}
          isConfirming={isConfirming}
        />
      )}
    </div>
  );
}
