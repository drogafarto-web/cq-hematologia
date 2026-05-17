/**
 * CEQOverviewDashboard — Visão consolidada de resultados CEQ
 *
 * KPIs globais, tendência mensal, resumo por especialidade, alertas.
 * Resultados não conformes linkam diretamente ao módulo de NC para rastreabilidade.
 * Drill-down: card alerta → lista de índices → drawer NC com CAPAWorkflow.
 */

import { useState, useRef } from 'react';
import { useCEQOverview, type CEQEspecialidadeSummary, type CEQNaoConformeItem } from '../hooks/useCEQOverview';
import { useAppStore } from '../../../store/useAppStore';
import { useNCs } from '../../sgq/naoConformidade/useNCs';
import CAPAWorkflow from '../../sgq/naoConformidade/components/CAPAWorkflow';
import type { NaoConformidade } from '../../sgq/types/NaoConformidade';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatMonth(m: string): string {
  const [y, mo] = m.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(mo) - 1]}/${y.slice(2)}`;
}

function conceitoBadge(c: 'B' | 'A' | 'I') {
  const cfg = {
    B: { label: 'Bom', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    A: { label: 'Aceitável', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    I: { label: 'Insatisfatório', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  }[c];
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string;
  accent: 'teal' | 'emerald' | 'amber' | 'red' | 'violet';
}) {
  const dot = {
    teal: 'bg-teal-400', emerald: 'bg-emerald-400',
    amber: 'bg-amber-400', red: 'bg-red-400', violet: 'bg-violet-400',
  }[accent];

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-white/90">{value}</p>
      {sub && <p className="text-[11px] text-white/30">{sub}</p>}
    </div>
  );
}

/* ─── Trend Chart (simple bar chart) ──────────────────────────────────────── */

function TrendChart({ data }: { data: { month: string; avgZScore: number; satisfatorios: number; total: number }[] }) {
  if (data.length === 0) return null;
  const maxZ = Math.max(...data.map(d => d.avgZScore), 3);

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">
        Tendência Z-Score Médio (|Z|)
      </h3>
      <div className="flex items-end gap-1.5 h-32">
        {data.map(d => {
          const pct = Math.min((d.avgZScore / maxZ) * 100, 100);
          const color = d.avgZScore < 2 ? 'bg-emerald-400' : d.avgZScore < 3 ? 'bg-amber-400' : 'bg-red-400';
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] tabular-nums text-white/40">{d.avgZScore.toFixed(1)}</span>
              <div className="w-full bg-white/[0.04] rounded-t-sm overflow-hidden" style={{ height: '100px' }}>
                <div
                  className={`w-full rounded-t-sm transition-all ${color}`}
                  style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                />
              </div>
              <span className="text-[9px] text-white/30">{formatMonth(d.month)}</span>
            </div>
          );
        })}
      </div>
      {/* Reference lines legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-white/30">
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-400 rounded" /> |Z| &lt; 2</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-amber-400 rounded" /> 2 ≤ |Z| &lt; 3</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-400 rounded" /> |Z| ≥ 3</span>
      </div>
    </div>
  );
}

/* ─── Conformidade por mês (% satisfatórios) ──────────────────────────────── */

function ConformidadeChart({ data }: { data: { month: string; satisfatorios: number; total: number }[] }) {
  if (data.length === 0) return null;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">
        % Conformidade por Mês
      </h3>
      <div className="flex items-end gap-1.5 h-32">
        {data.map(d => {
          const pct = d.total > 0 ? Math.round((d.satisfatorios / d.total) * 100) : 100;
          const color = pct >= 90 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400';
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] tabular-nums text-white/40">{pct}%</span>
              <div className="w-full bg-white/[0.04] rounded-t-sm overflow-hidden" style={{ height: '100px' }}>
                <div
                  className={`w-full rounded-t-sm transition-all ${color}`}
                  style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                />
              </div>
              <span className="text-[9px] text-white/30">{formatMonth(d.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Especialidades Table ────────────────────────────────────────────────── */

function EspecialidadesTable({ data }: { data: CEQEspecialidadeSummary[] }) {
  if (data.length === 0) return null;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.05]">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
          Resumo por Especialidade
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.05]">
              <th className="text-left px-5 py-2.5 font-medium">Especialidade</th>
              <th className="text-center px-3 py-2.5 font-medium">Rodadas</th>
              <th className="text-center px-3 py-2.5 font-medium">Resultados</th>
              <th className="text-center px-3 py-2.5 font-medium">Conformidade</th>
              <th className="text-center px-3 py-2.5 font-medium">Pior |Z|</th>
              <th className="text-center px-3 py-2.5 font-medium">Conceito</th>
            </tr>
          </thead>
          <tbody>
            {data.sort((a, b) => a.pctConformidade - b.pctConformidade).map(e => (
              <tr key={e.esquema} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3 text-white/80 font-medium capitalize">
                  {e.esquema.replace(/-/g, ' ')}
                </td>
                <td className="text-center px-3 py-3 text-white/50 tabular-nums">{e.rodadas}</td>
                <td className="text-center px-3 py-3 text-white/50 tabular-nums">{e.resultados}</td>
                <td className="text-center px-3 py-3">
                  <span className={`tabular-nums font-medium ${
                    e.pctConformidade >= 90 ? 'text-emerald-400' :
                    e.pctConformidade >= 70 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {e.pctConformidade}%
                  </span>
                </td>
                <td className="text-center px-3 py-3 tabular-nums text-white/50">{e.worstZ.toFixed(2)}</td>
                <td className="text-center px-3 py-3">{conceitoBadge(e.conceitoGeral)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── NC Detail Drawer ────────────────────────────────────────────────────── */

function NCDrawer({
  item,
  nc,
  onClose,
}: {
  item: CEQNaoConformeItem;
  nc: NaoConformidade | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-full max-w-lg bg-[#141417] border-l border-white/[0.08] shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#141417] border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-red-400/80 mb-1">
                Não Conformidade CEQ
              </p>
              <h2 className="text-lg font-semibold text-white/90">{item.analyteName}</h2>
              <p className="text-sm text-white/40 mt-0.5 capitalize">
                {item.esquema.replace(/-/g, ' ')} · Rodada {item.rodada}/{item.ano}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Context card */}
        <div className="px-6 py-4 space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Contexto do Resultado
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] text-white/30 uppercase">Analito</p>
                <p className="text-white/80 font-medium">{item.analyteName}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Z-Score</p>
                <p className={`font-mono font-semibold ${Math.abs(item.zScore) >= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                  {item.zScore >= 0 ? '+' : ''}{item.zScore.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Interpretação</p>
                <p className={`font-medium ${item.interpretacao === 'insatisfatoria' ? 'text-red-400' : 'text-amber-400'}`}>
                  {item.interpretacao === 'insatisfatoria' ? 'Insatisfatório' : 'Questionável'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Rodada</p>
                <p className="text-white/80">{item.rodada}/{item.ano}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Especialidade</p>
                <p className="text-white/80 capitalize">{item.esquema.replace(/-/g, ' ')}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Status NC</p>
                {item.ncId ? (
                  item.ncTratada ? (
                    <span className="text-emerald-400 font-medium">Tratada</span>
                  ) : (
                    <span className="text-amber-400 font-medium">Em tratamento</span>
                  )
                ) : (
                  <span className="text-red-400 font-medium">Pendente de criação</span>
                )}
              </div>
            </div>
          </div>

          {/* CAPA Workflow */}
          {nc ? (
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                Tratamento (CAPA)
              </h3>
              <CAPAWorkflow nc={nc} />
            </div>
          ) : (
            <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-sm text-red-300 font-medium">NC ainda não criada</p>
              <p className="text-xs text-white/40 mt-1">
                Faça upload do relatório PNCQ para gerar a NC automaticamente,
                ou crie manualmente no módulo de Qualidade.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Não Conformes Table (with NC link) ──────────────────────────────────── */

function NaoConformesTable({ data, onSelectItem }: { data: CEQNaoConformeItem[]; onSelectItem: (item: CEQNaoConformeItem) => void }) {
  const setCurrentView = useAppStore(s => s.setCurrentView);

  if (data.length === 0) return null;

  const navigateToNC = () => {
    setCurrentView('tratamento-nc');
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
          Resultados Não Conformes — Rastreabilidade NC
        </h3>
        <button
          type="button"
          onClick={navigateToNC}
          className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
        >
          Ver todas as NCs →
        </button>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0B0F14]">
            <tr className="text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.05]">
              <th className="text-left px-5 py-2.5 font-medium">Analito</th>
              <th className="text-left px-3 py-2.5 font-medium">Especialidade</th>
              <th className="text-center px-3 py-2.5 font-medium">Rodada</th>
              <th className="text-center px-3 py-2.5 font-medium">Z-Score</th>
              <th className="text-center px-3 py-2.5 font-medium">Conceito</th>
              <th className="text-center px-3 py-2.5 font-medium">NC</th>
              <th className="text-center px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr
                key={item.resultadoId}
                onClick={() => onSelectItem(item)}
                className="border-b border-white/[0.03] hover:bg-white/[0.04] cursor-pointer transition-colors"
              >
                <td className="px-5 py-3 text-white/80 font-medium">{item.analyteName}</td>
                <td className="px-3 py-3 text-white/50 capitalize">{item.esquema.replace(/-/g, ' ')}</td>
                <td className="text-center px-3 py-3 text-white/50 tabular-nums">
                  {item.rodada}/{item.ano}
                </td>
                <td className="text-center px-3 py-3">
                  <span className={`tabular-nums font-medium ${
                    Math.abs(item.zScore) >= 3 ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {item.zScore >= 0 ? '+' : ''}{item.zScore.toFixed(2)}
                  </span>
                </td>
                <td className="text-center px-3 py-3">{conceitoBadge(item.conceito === 'I' ? 'I' : 'A')}</td>
                <td className="text-center px-3 py-3">
                  {item.ncId ? (
                    <span className="text-[11px] px-2 py-1 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      NC vinculada
                    </span>
                  ) : Math.abs(item.zScore) >= 3 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                      Pendente
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      Monitorar
                    </span>
                  )}
                </td>
                <td className="text-center px-3 py-3">
                  {item.ncId ? (
                    item.ncTratada ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Tratada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Em tratamento
                      </span>
                    )
                  ) : Math.abs(item.zScore) >= 3 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      Aguardando NC
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/25">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function CEQOverviewDashboard() {
  const overview = useCEQOverview();
  const [selectedItem, setSelectedItem] = useState<CEQNaoConformeItem | null>(null);
  const [showOnlyPendentes, setShowOnlyPendentes] = useState(false);
  const ncTableRef = useRef<HTMLDivElement>(null);

  // Load NCs from SGQ module to get full NC data for the drawer
  const { ncs } = useNCs({ bloqueiaOperacoes: undefined });

  // Find the full NC object for the selected item
  const selectedNC: NaoConformidade | null = selectedItem?.ncId
    ? ncs.find(nc => nc.id === selectedItem.ncId) ?? null
    : null;

  const handleAlertClick = () => {
    setShowOnlyPendentes(true);
    // Scroll to the NC table
    setTimeout(() => {
      ncTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const filteredNaoConformes = showOnlyPendentes
    ? overview.naoConformes.filter(nc => !nc.ncTratada)
    : overview.naoConformes;

  if (overview.loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (overview.totalResultados === 0) return null;

  return (
    <div className="space-y-6">
      {/* Alert for pending insatisfatórios */}
      {overview.insatisfatoriosPendentes > 0 && (
        <button
          type="button"
          onClick={handleAlertClick}
          className="w-full text-left flex items-start gap-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm hover:bg-red-500/[0.12] hover:border-red-500/30 transition-colors cursor-pointer group"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="shrink-0 mt-0.5" aria-hidden>
            <path d="M10 3l7.5 13h-15L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 8.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="14" r="0.9" fill="currentColor" />
          </svg>
          <div className="flex-1">
            <p className="font-medium">{overview.insatisfatoriosPendentes} resultado(s) insatisfatório(s) pendente(s) de investigação</p>
            <p className="text-xs text-red-400/70 mt-0.5">DICQ 4.5 exige ação corretiva para resultados com |Z| ≥ 3 — clique para ver</p>
          </div>
          <span className="text-red-400/50 group-hover:text-red-400 transition-colors shrink-0 mt-0.5">→</span>
        </button>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Resultados" value={overview.totalResultados} accent="teal" />
        <StatCard
          label="Conformidade"
          value={`${overview.pctConformidade}%`}
          sub={`${overview.satisfatorios} satisfatórios`}
          accent="emerald"
        />
        <StatCard label="Satisfatórios" value={overview.satisfatorios} accent="emerald" />
        <StatCard label="Questionáveis" value={overview.questionaveis} accent="amber" />
        <StatCard
          label="Insatisfatórios"
          value={overview.insatisfatorios}
          sub={overview.insatisfatorios > 0 ? 'Requer NC/CAPA' : undefined}
          accent={overview.insatisfatorios > 0 ? 'red' : 'teal'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart data={overview.monthlyTrend} />
        <ConformidadeChart data={overview.monthlyTrend} />
      </div>

      {/* Especialidades table */}
      <EspecialidadesTable data={overview.especialidades} />

      {/* Não Conformes — rastreabilidade com link para NC */}
      <div ref={ncTableRef}>
        {showOnlyPendentes && (
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-white/40">Mostrando apenas pendentes</p>
            <button
              type="button"
              onClick={() => setShowOnlyPendentes(false)}
              className="text-[11px] text-teal-400 hover:text-teal-300 transition-colors"
            >
              Mostrar todos
            </button>
          </div>
        )}
        <NaoConformesTable data={filteredNaoConformes} onSelectItem={setSelectedItem} />
      </div>

      {/* NC Drawer */}
      {selectedItem && (
        <NCDrawer
          item={selectedItem}
          nc={selectedNC}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}