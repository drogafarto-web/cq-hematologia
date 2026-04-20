import React, { useMemo } from 'react';
import type { ControlLot, Run, View } from '../../../types';
import { ANALYTE_MAP, WARNING_ONLY_WESTGARD_RULES } from '../../../constants';
import { DownloadIcon, PlusIcon, ChevRight } from '../components/icons';

// ─── Icons ────────────────────────────────────────────────────────────────────

function CameraIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 103-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getRunStatus(run: Run): 'approved' | 'rejected' | 'warn' | 'pending' {
  if (run.status === 'Aprovada') return 'approved';
  if (run.status === 'Rejeitada') return 'rejected';
  const hasViolation = run.results.some((r) => r.violations && r.violations.length > 0);
  if (hasViolation) return 'warn';
  return 'pending';
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'approved' | 'rejected' | 'warn' | 'pending' }) {
  const cfg = {
    approved:
      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    rejected:
      'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    warn: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    pending:
      'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10',
  };
  const labels = {
    approved: 'Aprovada',
    rejected: 'Rejeitada',
    warn: 'Alerta',
    pending: 'Pendente',
  };
  const dots = {
    approved: 'bg-emerald-500',
    rejected: 'bg-red-500',
    warn: 'bg-amber-500',
    pending: 'bg-slate-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[status]}`} />
      {labels[status]}
    </span>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  trend: string;
  accent: string;
  dir?: 'up' | 'down' | 'flat';
}

function KpiCard({ label, value, trend, accent, dir = 'flat' }: KpiProps) {
  const trendColor =
    dir === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : dir === 'down'
        ? 'text-red-500 dark:text-red-400'
        : 'text-slate-500 dark:text-slate-400';
  return (
    <div className="relative bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 overflow-hidden shadow-sm dark:shadow-none">
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ background: accent }}
      />
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        {label}
      </div>
      <div className="text-[28px] font-semibold text-slate-900 dark:text-white leading-none tracking-tight tabular-nums">
        {value}
      </div>
      <div className={`mt-2.5 text-xs ${trendColor}`}>{trend}</div>
    </div>
  );
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="w-[80px] h-[20px]" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80,
    H = 20;
  const path = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lots: ControlLot[];
  activeLot: ControlLot | null;
  goTo: (page: string) => void;
  setCurrentView: (view: View) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardScreen({ lots, activeLot, goTo, setCurrentView }: Props) {
  const allRuns = useMemo(
    () => lots.flatMap((l) => l.runs).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [lots],
  );
  const todayRuns = useMemo(() => allRuns.filter((r) => isToday(r.timestamp)), [allRuns]);
  const approvedToday = todayRuns.filter((r) => r.status === 'Aprovada').length;
  const rejectedToday = todayRuns.filter((r) => r.status === 'Rejeitada').length;
  const approvalRate =
    todayRuns.length > 0 ? Math.round((approvedToday / todayRuns.length) * 100) : 0;
  const lastRun = allRuns[0] ?? null;
  const lastRunLot = lastRun ? lots.find((l) => l.id === lastRun.lotId) : null;

  // Violations count (today)
  const alertCount = todayRuns.filter((r) =>
    r.results.some(
      (res) => res.violations && res.violations.some((v) => !WARNING_ONLY_WESTGARD_RULES.has(v)),
    ),
  ).length;

  // Analyte summary from active lot
  const analyteSummary = useMemo(() => {
    if (!activeLot) return [];
    return activeLot.requiredAnalytes.map((id) => {
      const analyte = ANALYTE_MAP[id];
      const runs = activeLot.runs.filter((r) => r.results.some((res) => res.analyteId === id));
      const results = activeLot.runs
        .flatMap((r) => r.results.filter((res) => res.analyteId === id))
        .slice(-12);
      const values = results.map((r) => r.value);
      const mean = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
      const hasViolation = activeLot.runs.some((r) =>
        r.results.some(
          (res) =>
            res.analyteId === id &&
            res.violations &&
            res.violations.some((v) => !WARNING_ONLY_WESTGARD_RULES.has(v)),
        ),
      );
      const hasWarning = activeLot.runs.some((r) =>
        r.results.some(
          (res) =>
            res.analyteId === id &&
            res.violations &&
            res.violations.some((v) => WARNING_ONLY_WESTGARD_RULES.has(v)),
        ),
      );
      const status: 'approved' | 'warn' | 'rejected' = hasViolation
        ? 'rejected'
        : hasWarning
          ? 'warn'
          : 'approved';
      const stats = activeLot.manufacturerStats[id];
      const cv = mean && stats ? ((stats.sd / stats.mean) * 100).toFixed(1) : '—';
      return {
        id,
        name: analyte?.name ?? id,
        unit: analyte?.unit ?? '',
        runs: runs.length,
        mean: mean?.toFixed(2) ?? '—',
        cv,
        values,
        status,
      };
    });
  }, [activeLot]);

  // Recent alerts from active lot
  const recentAlerts = useMemo(() => {
    if (!activeLot) return [];
    return activeLot.runs
      .flatMap((r) =>
        r.results
          .filter((res) => res.violations && res.violations.length > 0)
          .map((res) => ({
            runId: r.id,
            analyteId: res.analyteId,
            analyteName: ANALYTE_MAP[res.analyteId]?.name ?? res.analyteId,
            violations: res.violations!,
            timestamp: r.timestamp,
            isRejection: res.violations!.some((v) => !WARNING_ONLY_WESTGARD_RULES.has(v)),
          })),
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);
  }, [activeLot]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      {/* Page header */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Painel do turno
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 capitalize">
            {dateStr} · {activeLot?.equipmentName ?? 'nenhum equipamento selecionado'}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentView('reports')}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors"
          >
            <DownloadIcon /> Exportar relatório
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

      {/* KPI grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Corridas hoje"
          value={String(todayRuns.length)}
          trend={
            todayRuns.length === 0
              ? 'nenhuma ainda'
              : `${approvedToday} aprovadas · todos os níveis`
          }
          accent="#2563EB"
          dir="up"
        />
        <KpiCard
          label="Taxa de aprovação"
          value={todayRuns.length === 0 ? '—' : `${approvalRate}%`}
          trend={
            todayRuns.length === 0
              ? 'sem dados hoje'
              : `${approvedToday} de ${todayRuns.length} · todos os níveis`
          }
          accent="#10B981"
          dir={approvalRate >= 80 ? 'up' : 'down'}
        />
        <KpiCard
          label="Em alerta"
          value={String(alertCount)}
          trend={alertCount === 0 ? 'tudo dentro dos limites' : 'ver análise'}
          accent="#F59E0B"
          dir="flat"
        />
        <KpiCard
          label="Rejeições"
          value={String(rejectedToday)}
          trend={
            rejectedToday === 0
              ? 'sem rejeições hoje'
              : `corrida${rejectedToday > 1 ? 's' : ''} · todos os níveis`
          }
          accent="#EF4444"
          dir={rejectedToday > 0 ? 'down' : 'flat'}
        />
      </div>

      {/* Hero run + quick actions */}
      <div className="grid grid-cols-[2fr_1fr] gap-4 mb-4">
        {/* Hero run */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-6 shadow-sm dark:shadow-none">
          {lastRun && lastRunLot ? (
            <>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" /> Última corrida
                </span>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  {lastRun.id.slice(-12)}
                </span>
                <div className="ml-auto">
                  <StatusBadge status={getRunStatus(lastRun)} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-600 text-white">
                  NV{lastRunLot.level}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {lastRunLot.startDate.toLocaleDateString('pt-BR', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  {lastRunLot.lotNumber}
                </span>
              </div>
              <div className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight mt-1">
                {lastRunLot.controlName ?? lastRunLot.lotNumber}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {lastRunLot.equipmentName} · {lastRun.results.length} analito
                {lastRun.results.length !== 1 ? 's' : ''} medidos
              </div>

              <div className="grid grid-cols-4 gap-5 mt-5 pt-5 border-t border-dashed border-slate-200 dark:border-white/[0.07]">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Analitos
                  </div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
                    {lastRun.results.length}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">medidos</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Aprovados
                  </div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
                    {
                      lastRun.results.filter((r) => !r.violations || r.violations.length === 0)
                        .length
                    }
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    sem violações
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Status
                  </div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white">
                    {lastRun.status}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">corrida</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Horário
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-2">
                    {lastRun.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {lastRun.timestamp.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                Nenhuma corrida registrada
              </p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                Inicie uma nova corrida para ver os dados aqui
              </p>
              <button
                type="button"
                onClick={() => goTo('nova')}
                className="mt-4 inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <PlusIcon /> Nova corrida
              </button>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 shadow-sm dark:shadow-none">
          <div className="text-sm font-semibold text-slate-700 dark:text-white/80 mb-3">
            Ações rápidas
          </div>
          {[
            {
              icon: <CameraIcon />,
              title: 'Registrar nova corrida',
              sub: 'Captura por câmera ou upload',
              action: () => goTo('nova'),
            },
            {
              icon: <ChartIcon />,
              title: 'Abrir gráfico Levey-Jennings',
              sub: 'Visualizar corridas com Westgard',
              action: () => goTo('analise'),
            },
            {
              icon: <HistoryIcon />,
              title: 'Revisar histórico',
              sub: `${allRuns.length} corrida${allRuns.length !== 1 ? 's' : ''} registradas`,
              action: () => goTo('historico'),
            },
          ].map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={item.action}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:border-slate-300 dark:hover:border-white/[0.12] transition-all text-left mb-2 last:mb-0"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-white/80">
                  {item.title}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500">{item.sub}</div>
              </div>
              <ChevRight />
            </button>
          ))}
        </div>
      </div>

      {/* Analyte table + alerts */}
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        {/* Analyte overview */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl shadow-sm dark:shadow-none overflow-hidden">
          <div className="flex items-center px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
            <span className="text-sm font-semibold text-slate-700 dark:text-white/80">
              Status por analito
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              {activeLot ? (
                <>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    NV{activeLot.level}
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    {activeLot.startDate.toLocaleDateString('pt-BR', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </>
              ) : (
                'Nenhum lote ativo'
              )}
            </span>
          </div>
          {analyteSummary.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Selecione um lote de controle para ver o status por analito
              </p>
              <button
                type="button"
                onClick={() => goTo('lotes')}
                className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Ir para Lotes →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/[0.02]">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">
                      Analito
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">
                      Corridas
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">
                      Média
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">
                      CV %
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">
                      Tendência
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analyteSummary.map((row) => {
                    const sparkColor =
                      row.status === 'rejected'
                        ? '#ef4444'
                        : row.status === 'warn'
                          ? '#f59e0b'
                          : '#10b981';
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => goTo('analise')}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 dark:text-white/80">
                            {row.name}
                          </div>
                          <div className="font-mono text-xs text-slate-400 dark:text-slate-500">
                            {row.id}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {row.runs}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {row.mean}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {row.cv}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <Sparkline values={row.values} color={sparkColor} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 shadow-sm dark:shadow-none">
          <div className="flex items-center mb-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-white/80">
              Alertas recentes
            </span>
            {recentAlerts.length > 0 && (
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {recentAlerts.length} ativo{recentAlerts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {recentAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-2">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="text-sm text-slate-400 dark:text-slate-500">Sem alertas ativos</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-0.5">
                Tudo dentro dos limites Westgard
              </p>
            </div>
          ) : (
            <div className="mt-2">
              {recentAlerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex gap-3 py-3 border-b border-slate-100 dark:border-white/[0.05] last:border-0"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${alert.isRejection ? 'bg-red-500' : 'bg-amber-500'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-white/75 truncate">
                      {alert.analyteName} — {alert.violations.join(', ')}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {alert.timestamp.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeLot && (
            <>
              <div className="h-px bg-slate-100 dark:bg-white/[0.05] my-4" />
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                Lote ativo
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                    NV{activeLot.level}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {activeLot.startDate.toLocaleDateString('pt-BR', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                    {activeLot.lotNumber}
                  </span>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  Vence{' '}
                  {activeLot.expiryDate.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}{' '}
                  · {activeLot.runs.length} corrida{activeLot.runs.length !== 1 ? 's' : ''}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
