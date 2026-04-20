import React, { useMemo, useState } from 'react';
import type { ControlLot, Run } from '../../../types';
import { ANALYTE_MAP, WARNING_ONLY_WESTGARD_RULES } from '../../../constants';
import { DownloadIcon, ChevRight } from '../components/icons';

// ─── Icons ────────────────────────────────────────────────────────────────────

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    Aprovada:  'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    Rejeitada: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    Pendente:  'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10',
  };
  const dots: Record<string, string> = {
    Aprovada: 'bg-emerald-500', Rejeitada: 'bg-red-500', Pendente: 'bg-slate-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${cfg[status] ?? cfg['Pendente']}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[status] ?? dots['Pendente']}`} />
      {status}
    </span>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunWithLot extends Run {
  lotNumber: string;
  lotName:   string;
  lotLevel:  1 | 2 | 3;
}

interface Props {
  lots: ControlLot[];
  goTo: (page: string) => void;
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(runs: RunWithLot[]) {
  const header = ['ID', 'Data', 'Hora', 'Lote', 'Número do Lote', 'Nível', 'Analitos', 'Violações', 'Status'];
  const rows = runs.map((r) => {
    const violations = [...new Set(
      r.results.flatMap((res) => res.violations ?? []).filter((v) => !WARNING_ONLY_WESTGARD_RULES.has(v))
    )];
    return [
      r.id,
      r.timestamp.toLocaleDateString('pt-BR'),
      r.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      r.lotName,
      r.lotNumber,
      `NV${r.lotLevel}`,
      r.results.length,
      violations.join('; ') || '—',
      r.status,
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `historico-corridas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HistoricoScreen({ lots, goTo }: Props) {
  const [filter,       setFilter]       = useState<'all' | 'Aprovada' | 'Rejeitada' | 'Pendente'>('all');
  const [query,        setQuery]        = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [levelFilter,  setLevelFilter]  = useState<Set<number>>(new Set());
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');

  const allRuns: RunWithLot[] = useMemo(
    () =>
      lots
        .flatMap((l) =>
          l.runs.map((r) => ({
            ...r,
            lotNumber: l.lotNumber,
            lotName:   l.controlName ?? l.lotNumber,
            lotLevel:  l.level,
          }))
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [lots]
  );

  const filtered = useMemo(() => {
    return allRuns.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (levelFilter.size > 0 && !levelFilter.has(r.lotLevel)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom + 'T00:00:00');
        if (r.timestamp < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59');
        if (r.timestamp > to) return false;
      }
      if (query) {
        const q     = query.toLowerCase();
        const names = r.results.map((res) => ANALYTE_MAP[res.analyteId]?.name ?? res.analyteId).join(' ');
        if (!(r.id + r.lotNumber + r.lotName + names).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allRuns, filter, levelFilter, dateFrom, dateTo, query]);

  const counts = useMemo(() => ({
    all:       allRuns.length,
    Aprovada:  allRuns.filter((r) => r.status === 'Aprovada').length,
    Rejeitada: allRuns.filter((r) => r.status === 'Rejeitada').length,
    Pendente:  allRuns.filter((r) => r.status === 'Pendente').length,
  }), [allRuns]);

  const groups = useMemo(() => {
    const g: Record<string, RunWithLot[]> = {};
    filtered.forEach((r) => {
      const d = r.timestamp.toISOString().slice(0, 10);
      (g[d] = g[d] ?? []).push(r);
    });
    return g;
  }, [filtered]);

  const hasAdvancedActive = levelFilter.size > 0 || !!dateFrom || !!dateTo;

  function toggleLevel(lv: number) {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(lv)) next.delete(lv); else next.add(lv);
      return next;
    });
  }

  function clearAdvanced() {
    setLevelFilter(new Set());
    setDateFrom('');
    setDateTo('');
  }

  const INPUT_CLS = 'h-8 px-3 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all';

  const FILTER_TABS: { id: typeof filter; label: string }[] = [
    { id: 'all',       label: 'Todas'     },
    { id: 'Aprovada',  label: 'Aprovadas' },
    { id: 'Rejeitada', label: 'Rejeitadas'},
    { id: 'Pendente',  label: 'Pendentes' },
  ];

  return (
    <>
      {/* Page header */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Histórico de corridas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">Registro imutável · trilha de auditoria completa</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium border transition-colors ${
              showAdvanced || hasAdvancedActive
                ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
                : 'bg-white dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08]'
            }`}
          >
            <FilterIcon />
            Filtros avançados
            {hasAdvancedActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            )}
          </button>
          <button
            type="button"
            onClick={() => exportCSV(filtered)}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors"
          >
            <DownloadIcon /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="bg-white dark:bg-white/[0.03] border border-blue-200 dark:border-blue-500/20 rounded-xl px-5 py-4 mb-4 shadow-sm dark:shadow-none">
          <div className="flex flex-wrap items-end gap-5">
            {/* Level filter */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Nível</p>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((lv) => (
                  <button key={lv} type="button" onClick={() => toggleLevel(lv)}
                    className={`px-3 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                      levelFilter.has(lv)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 dark:bg-white/[0.05] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-500/30'
                    }`}>
                    NV{lv}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Período</p>
              <div className="flex items-center gap-2">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={INPUT_CLS} title="De" />
                <span className="text-xs text-slate-400">até</span>
                <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className={INPUT_CLS} title="Até" />
              </div>
            </div>

            {hasAdvancedActive && (
              <button type="button" onClick={clearAdvanced}
                className="h-8 px-3 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                Limpar filtros
              </button>
            )}

            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 self-end pb-0.5">
              {filtered.length} corrida{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl px-4 py-3 mb-4 shadow-sm dark:shadow-none">
        <div className="inline-flex bg-slate-100 dark:bg-white/[0.06] rounded-lg p-0.5 gap-0.5">
          {FILTER_TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setFilter(tab.id)}
              className={`px-3 h-7 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white dark:bg-white/[0.10] text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              {tab.label}
              <span className="ml-1.5 text-slate-400 dark:text-slate-500">
                {tab.id === 'all' ? counts.all : counts[tab.id as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"><SearchIcon /></div>
          <input
            type="text"
            placeholder="Filtrar por ID, analito ou lote"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 focus:bg-white dark:focus:bg-white/[0.07] transition-all"
          />
        </div>

        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} de {allRuns.length} corrida{allRuns.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
        {allRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Nenhuma corrida registrada</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">As corridas aparecerão aqui após serem registradas</p>
            <button type="button" onClick={() => goTo('nova')}
              className="mt-4 inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Registrar primeira corrida
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma corrida com os filtros atuais</p>
            <button type="button" onClick={() => { clearAdvanced(); setFilter('all'); setQuery(''); }}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              Limpar todos os filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">Corrida</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">Lote</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">Analitos</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">Violações</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">Horário</th>
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">Status</th>
                  <th className="w-8" scope="col" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {Object.entries(groups).map(([date, list]) => (
                  <React.Fragment key={date}>
                    <tr className="bg-slate-50/70 dark:bg-white/[0.015]">
                      <td colSpan={7} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {(() => {
                          const d = new Date(date + 'T12:00:00');
                          return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                        })()} · {list.length} corrida{list.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                    {list.map((r) => {
                      const violations  = [...new Set(r.results.flatMap((res) => res.violations ?? []).filter((v) => !WARNING_ONLY_WESTGARD_RULES.has(v)))];
                      const analyteNames = r.results.slice(0, 3).map((res) => ANALYTE_MAP[res.analyteId]?.name ?? res.analyteId).join(', ') + (r.results.length > 3 ? ` +${r.results.length - 3}` : '');
                      return (
                        <tr key={r.id} className="border-t border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => goTo('analise')}>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{r.id.slice(-14)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">NV{r.lotLevel}</span>
                              <span className="text-slate-700 dark:text-slate-300 text-xs truncate max-w-[120px]">{r.lotName}</span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">#{r.lotNumber}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[180px] truncate">{analyteNames}</td>
                          <td className="px-4 py-3">
                            {violations.length > 0 ? (
                              <div className="flex gap-1 flex-wrap">
                                {violations.slice(0, 3).map((v) => (
                                  <span key={v} className="font-mono text-[10px] px-1.5 py-0.5 rounded border bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20">{v}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                              {r.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-300 dark:text-slate-600">
                            <ChevRight size={13} />
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-white/[0.05] text-xs text-slate-400 dark:text-slate-500">
              Exibindo {filtered.length} de {allRuns.length} corridas
            </div>
          </div>
        )}
      </div>
    </>
  );
}
