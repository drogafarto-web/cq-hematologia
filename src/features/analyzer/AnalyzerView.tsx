import React, { useState } from 'react';
import { ANALYTE_MAP }          from '../../constants';
import { useLots }              from '../lots/hooks/useLots';
import { useRuns }              from '../runs/hooks/useRuns';
import { useChartData }         from '../chart/hooks/useChartData';
import { useStatsByMode }       from '../chart/hooks/useStatsByMode';
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
import { ThemeToggle }          from '../../shared/components/ui/ThemeToggle';
import type { SyncStatus, ControlLot } from '../../types';

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

// ─── Lot stat cards (shown when lot has runs) ────────────────────────────────

interface LotStatCardsProps {
  lot: ControlLot;
}

function LotStatCards({ lot }: LotStatCardsProps) {
  const { runs } = lot;
  if (runs.length === 0) return null;

  const lastRun     = runs[runs.length - 1];
  const rejected    = runs.filter((r) => r.status === 'Rejeitada').length;
  const rejectPct   = Math.round((rejected / runs.length) * 100);

  const recent = runs.slice(-3);
  const prior  = runs.slice(-6, -3);
  const recentRate = recent.filter((r) => r.status === 'Rejeitada').length / recent.length;
  const priorRate  = prior.length > 0
    ? prior.filter((r) => r.status === 'Rejeitada').length / prior.length
    : recentRate;

  const trend =
    prior.length === 0     ? 'new'       :
    recentRate < priorRate ? 'improving' :
    recentRate > priorRate ? 'degrading' : 'stable';

  const statusCfg: Record<string, { dot: string; text: string; label: string }> = {
    Aprovada:  { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Aprovada'  },
    Rejeitada: { dot: 'bg-red-500',     text: 'text-red-400',     label: 'Rejeitada' },
    Pendente:  { dot: 'bg-amber-500',   text: 'text-amber-400',   label: 'Pendente'  },
  };

  const trendCfg: Record<string, { symbol: string; label: string; cls: string }> = {
    improving: { symbol: '↑', label: 'Melhorando', cls: 'text-emerald-400' },
    degrading:  { symbol: '↓', label: 'Atenção',    cls: 'text-red-400'    },
    stable:     { symbol: '→', label: 'Estável',    cls: 'text-white/35 dark:text-white/35 text-slate-400' },
    new:        { symbol: '·', label: 'Início',     cls: 'text-white/35 dark:text-white/35 text-slate-400' },
  };

  const sc = statusCfg[lastRun.status] ?? statusCfg['Pendente'];
  const tc = trendCfg[trend];

  const lastRunTime = lastRun.timestamp.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const card = 'bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-3.5';
  const label = 'text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-white/20 mb-2';
  const sub   = 'text-[10px] text-slate-400 dark:text-white/20 mt-1';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {/* Last run */}
      <div className={card}>
        <p className={label}>Última corrida</p>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
          <span className={`text-sm font-semibold ${sc.text}`}>{sc.label}</span>
        </div>
        <p className={sub}>{lastRunTime}</p>
      </div>

      {/* Total */}
      <div className={card}>
        <p className={label}>Total de corridas</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white/80 leading-none">{runs.length}</p>
        <p className={sub}>neste lote</p>
      </div>

      {/* Rejected */}
      <div className={card}>
        <p className={label}>Reprovadas</p>
        <p className={`text-2xl font-bold leading-none ${rejected > 0 ? 'text-red-400' : 'text-slate-900 dark:text-white/80'}`}>
          {rejected}
        </p>
        <p className={sub}>{rejectPct}% do total</p>
      </div>

      {/* Trend */}
      <div className={card}>
        <p className={label}>Tendência</p>
        <p className={`text-2xl font-bold leading-none ${tc.cls}`}>{tc.symbol}</p>
        <p className={sub}>{tc.label}</p>
      </div>
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

  // Stats mode: local state managed inside the hook (Fabricante / Interna).
  // Replaces the former Zustand chartStatsSource — the toggle is ephemeral
  // UI state and does not need to survive navigation or lab switches.
  const statsMode = useStatsByMode(activeLot ?? null, validAnalyteId);

  const chartData      = useChartData(activeLot ?? null, validAnalyteId, statsMode.mode);
  const currentAnalyte = validAnalyteId ? ANALYTE_MAP[validAnalyteId] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white flex flex-col overflow-hidden transition-colors duration-300">

      {/* ── Header — sticky glass blur (iOS HIG pattern) ────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-12 border-b border-slate-200/80 dark:border-white/[0.06] shrink-0 bg-white/80 dark:bg-[#0B0F14]/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-[#0B0F14]/60">
        <button
          type="button"
          aria-label={sidebarOpen ? 'Fechar barra lateral' : 'Abrir barra lateral'}
          onClick={() => setSidebarOpen((v) => !v)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-white/35 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-200 dark:hover:bg-white/[0.07] transition-all"
        >
          <MenuBars />
        </button>

        <LogoMark />

        <div className="flex-1 min-w-0 flex items-center gap-4">
          <p className="text-sm font-semibold text-slate-800 dark:text-white/85 truncate leading-none">
            {activeLab?.name ?? 'CQ Hematologia'}
          </p>
        </div>

        <SyncDot status={syncStatus} />

        <ThemeToggle size="sm" />

        {/* Overflow menu */}
        <div className="relative">
          <button
            type="button"
            aria-label="Abrir menu de conta"
            aria-expanded={menuOpen ? 'true' : 'false'}
            onClick={() => setMenuOpen((v) => !v)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 hover:bg-slate-200 dark:hover:bg-white/[0.07] transition-all"
          >
            <DotsIcon />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-40 w-48 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden py-1">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.07] mb-1">
                  <p className="text-xs text-slate-500 dark:text-white/50 truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setCurrentView('hub'); setMenuOpen(false); }}
                  className="w-full px-4 min-h-[44px] text-left text-sm text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all flex items-center gap-2"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                    <path d="M8 2L3 6.5 8 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Todos os módulos
                </button>
                <button
                  type="button"
                  onClick={() => { setCurrentView('bulaparser'); setMenuOpen(false); }}
                  className="w-full px-4 min-h-[44px] text-left text-sm text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all"
                >
                  Importar bula PDF
                </button>
                <button
                  type="button"
                  onClick={() => { setCurrentView('reports'); setMenuOpen(false); }}
                  className="w-full px-4 min-h-[44px] text-left text-sm text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all flex items-center gap-2"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  Gerar relatório
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => { setCurrentView('superadmin'); setMenuOpen(false); }}
                    className="w-full px-4 min-h-[44px] text-left text-sm text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all"
                  >
                    Painel Super Admin
                  </button>
                )}
                <div className="h-px bg-slate-100 dark:bg-white/[0.06] my-1" />
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full px-4 min-h-[44px] text-left text-sm text-red-500/70 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
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
          <aside className="w-60 shrink-0 border-r border-slate-200 dark:border-white/[0.06] flex flex-col overflow-hidden bg-white dark:bg-transparent">
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
            /* ── Empty state ──────────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center flex-1 py-20 text-center px-8 relative overflow-hidden">
              {/* Faint dot grid */}
              <div className="dot-grid-bg absolute inset-0 opacity-[0.4] dark:opacity-100" />

              <div className="relative z-10 flex flex-col items-center">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-violet-500/[0.07] dark:bg-violet-500/[0.06] border border-violet-500/[0.15] dark:border-violet-500/[0.10] flex items-center justify-center mb-5 text-violet-500/50 dark:text-violet-400/40">
                  {lots.length === 0 ? (
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
                      <path d="M9.5 3.5h7M10.5 3.5v11.5l-3.5 4.5a2.25 2.25 0 001.75 3.5h8.5A2.25 2.25 0 0019 19.5l-3.5-4.5V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.5 15.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
                      <rect x="3" y="3" width="8.5" height="8.5" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="3" y="14.5" width="8.5" height="8.5" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="14.5" y="3" width="8.5" height="8.5" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M18.75 14.5v8.5M14.5 18.75h8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </div>

                <p className="text-lg font-semibold text-slate-600 dark:text-white/50 tracking-tight">
                  {lots.length === 0 ? 'Nenhum lote cadastrado' : 'Selecione um lote de controle'}
                </p>
                <p className="text-sm text-slate-400 dark:text-white/25 mt-2 max-w-[290px] leading-relaxed">
                  {lots.length === 0
                    ? 'Crie seu primeiro lote de controle para começar a registrar corridas e visualizar gráficos de Levey-Jennings.'
                    : 'Escolha um lote na barra lateral para visualizar o gráfico de controle e registrar novas corridas.'}
                </p>

                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className={`mt-6 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      lots.length === 0
                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                        : 'bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.09] text-slate-700 dark:text-white/60'
                    }`}
                  >
                    {lots.length === 0 ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        Criar primeiro lote
                      </>
                    ) : (
                      <>
                        Abrir lotes
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                          <path d="M3 6.5h7M7 4l3 2.5L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ── Lot selected — main analyzer ─────────────────────────────── */
            <>
              <LotInfoBar lot={activeLot} />

              <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-3xl mx-auto w-full">
                {/* Summary stat cards */}
                <LotStatCards lot={activeLot} />

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
                      value={statsMode.mode}
                      onChange={statsMode.setMode}
                      hasEnoughForInternal={statsMode.hasEnoughForInternal}
                      approvedRuns={statsMode.approvedRuns}
                      warning={statsMode.warning}
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
