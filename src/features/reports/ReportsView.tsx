import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { useActiveLot, useAppStore } from '../../store/useAppStore';
import { useActiveLab, useUser }     from '../../store/useAuthStore';
import { ANALYTE_MAP, ANALYTES }     from '../../constants';
import type { ControlLot, Run, WestgardViolation } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtFull(d: Date) {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function computeStats(values: number[]) {
  const n = values.length;
  if (n < 2) return null;
  const mean     = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const sd       = Math.sqrt(variance);
  const cv       = mean === 0 ? 0 : (sd / mean) * 100;
  return { mean, sd, cv, n };
}

function auditId(lot: ControlLot, labId: string): string {
  const seed = `${labId}-${lot.id}-${lot.lotNumber}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return `CQ-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

// ─── Print button ─────────────────────────────────────────────────────────────

function PrintButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        no-print
        fixed top-4 right-4 z-50
        flex items-center gap-2
        px-4 py-2.5 rounded-xl
        bg-violet-600 hover:bg-violet-500 active:bg-violet-700
        text-white text-sm font-semibold
        shadow-lg shadow-violet-900/40
        transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400
      "
      aria-label="Imprimir relatório"
    >
      <PrinterIcon />
      Imprimir Relatório
    </button>
  );
}

function PrinterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="1" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 6H2a1 1 0 00-1 1v5a1 1 0 001 1h1m10 0h1a1 1 0 001-1V7a1 1 0 00-1-1h-1"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 12h6M5 14h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Stats table per analyte ──────────────────────────────────────────────────

interface AnalyteStatsRowProps {
  analyteId:    string;
  lot:          ControlLot;
}

function AnalyteStatsRow({ analyteId, lot }: AnalyteStatsRowProps) {
  const analyte = ANALYTE_MAP[analyteId];
  if (!analyte) return null;

  const mfr = lot.manufacturerStats[analyteId];

  const approvedValues = lot.runs
    .filter((r) => r.status === 'Aprovada')
    .flatMap((r) => r.results.filter((res) => res.analyteId === analyteId))
    .map((res) => res.value);

  const int = computeStats(approvedValues);

  const d = analyte.decimals;

  return (
    <tr className="border-t border-gray-200 print:border-gray-300">
      <td className="py-1.5 pl-3 font-mono text-xs font-semibold text-gray-700 print:text-black">
        {analyte.name}
      </td>
      <td className="py-1.5 text-center text-xs text-gray-500 print:text-gray-600">
        {analyte.unit}
      </td>
      {/* Manufacturer */}
      <td className="py-1.5 text-center font-mono text-xs text-gray-700 print:text-black">
        {mfr ? mfr.mean.toFixed(d) : '—'}
      </td>
      <td className="py-1.5 text-center font-mono text-xs text-gray-700 print:text-black">
        {mfr ? mfr.sd.toFixed(d) : '—'}
      </td>
      <td className="py-1.5 text-center font-mono text-xs text-gray-600 print:text-gray-700">
        {mfr && mfr.mean > 0 ? `${((mfr.sd / mfr.mean) * 100).toFixed(1)}%` : '—'}
      </td>
      {/* Internal */}
      <td className="py-1.5 text-center font-mono text-xs text-gray-700 print:text-black">
        {int ? int.mean.toFixed(d) : '—'}
      </td>
      <td className="py-1.5 text-center font-mono text-xs text-gray-700 print:text-black">
        {int ? int.sd.toFixed(d) : '—'}
      </td>
      <td className="py-1.5 text-center font-mono text-xs text-gray-600 print:text-gray-700">
        {int ? `${int.cv.toFixed(1)}%` : '—'}
      </td>
      <td className="py-1.5 pr-3 text-center font-mono text-xs text-gray-600 print:text-gray-700">
        {int ? int.n : '—'}
      </td>
    </tr>
  );
}

// ─── Mini chart per analyte (print-safe) ─────────────────────────────────────

interface MiniChartProps {
  analyteId: string;
  lot:       ControlLot;
}

function MiniChart({ analyteId, lot }: MiniChartProps) {
  const analyte = ANALYTE_MAP[analyteId];
  const mfr     = lot.manufacturerStats[analyteId];
  if (!analyte || !mfr) return null;

  const { mean, sd } = mfr;

  const sortedRuns = [...lot.runs].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const data = sortedRuns.map((run, idx) => {
    const result = run.results.find((r) => r.analyteId === analyteId);
    return {
      index: idx + 1,
      value: result?.value ?? null,
    };
  });

  if (data.every((d) => d.value === null)) return null;

  const yMin = mean - sd * 3.5;
  const yMax = mean + sd * 3.5;

  return (
    <div style={{ width: '100%', height: 120 }}>
      <LineChart
        width={520}
        height={120}
        data={data}
        margin={{ top: 8, right: 24, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="2 2" stroke="#e5e7eb" horizontal vertical={false} />
        <XAxis dataKey="index" tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false}
          axisLine={{ stroke: '#d1d5db' }} interval="preserveStartEnd" />
        <YAxis domain={[yMin, yMax]} tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false}
          axisLine={false} width={36}
          tickFormatter={(v) => v.toFixed(analyte.decimals)} />
        <ReferenceLine y={mean}        stroke="#374151" strokeWidth={1.2} />
        <ReferenceLine y={mean + sd}   stroke="#10b981" strokeWidth={0.8} strokeDasharray="3 2" />
        <ReferenceLine y={mean - sd}   stroke="#10b981" strokeWidth={0.8} strokeDasharray="3 2" />
        <ReferenceLine y={mean + 2*sd} stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3 2" />
        <ReferenceLine y={mean - 2*sd} stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3 2" />
        <ReferenceLine y={mean + 3*sd} stroke="#ef4444" strokeWidth={0.8} strokeDasharray="3 2" />
        <ReferenceLine y={mean - 3*sd} stroke="#ef4444" strokeWidth={0.8} strokeDasharray="3 2" />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#4f46e5"
          strokeWidth={1.2}
          dot={{ r: 2, fill: '#4f46e5', strokeWidth: 0 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  );
}

// ─── Westgard violation badge ─────────────────────────────────────────────────

const REJECTION_RULES: WestgardViolation[] = ['1-3s','2-2s','R-4s','4-1s','10x','6T','6X'];

function VBadge({ v }: { v: WestgardViolation }) {
  const isReject = REJECTION_RULES.includes(v);
  return (
    <span className={`inline-block text-[9px] font-mono font-bold px-1 py-0.5 rounded border mr-0.5
      ${isReject
        ? 'bg-red-50 text-red-700 border-red-200 print:bg-white print:border-red-400'
        : 'bg-amber-50 text-amber-700 border-amber-200 print:bg-white print:border-amber-400'
      }`}
    >
      {v}
    </span>
  );
}

// ─── Runs table ───────────────────────────────────────────────────────────────

function RunsTable({ runs }: { runs: Run[] }) {
  const sorted = [...runs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-gray-100 print:bg-gray-100">
          <th className="text-left py-2 pl-3 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">#</th>
          <th className="text-left py-2 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">Data / Hora</th>
          <th className="text-left py-2 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">Amostra</th>
          <th className="text-center py-2 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">Status</th>
          <th className="text-left py-2 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">Violações Westgard</th>
          <th className="text-center py-2 pr-3 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">Manual</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((run, i) => {
          const allViolations = [
            ...new Set(run.results.flatMap((r) => r.violations)),
          ] as WestgardViolation[];

          const hasRejection = allViolations.some((v) => REJECTION_RULES.includes(v));

          return (
            <tr
              key={run.id}
              className={`border-t border-gray-200 print:border-gray-300
                ${hasRejection
                  ? 'bg-red-50/50 print:bg-white'
                  : allViolations.includes('1-2s')
                  ? 'bg-amber-50/40 print:bg-white'
                  : ''
                }`}
            >
              <td className="py-1.5 pl-3 font-mono text-gray-500 print:text-gray-600">
                {sorted.length - i}
              </td>
              <td className="py-1.5 font-mono text-gray-700 print:text-black whitespace-nowrap">
                {fmtFull(new Date(run.timestamp))}
              </td>
              <td className="py-1.5 text-gray-500 font-mono print:text-gray-600">
                {run.sampleId ?? '—'}
              </td>
              <td className="py-1.5 text-center">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border
                  ${run.status === 'Aprovada'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : run.status === 'Rejeitada'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {run.status}
                </span>
              </td>
              <td className="py-1.5">
                {allViolations.length === 0
                  ? <span className="text-gray-400">—</span>
                  : allViolations.map((v) => <VBadge key={v} v={v} />)
                }
              </td>
              <td className="py-1.5 pr-3 text-center text-gray-400">
                {run.manualOverride ? '✓' : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── QR-style audit block ─────────────────────────────────────────────────────

function AuditBlock({ code, generatedAt }: { code: string; generatedAt: Date }) {
  return (
    <div className="flex items-start gap-4 p-4 border border-gray-300 rounded-lg print:border-gray-400">
      {/* QR placeholder grid */}
      <div className="shrink-0 w-16 h-16 border border-gray-300 rounded p-1 print:border-gray-400" aria-hidden>
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          {/* Corner finders */}
          <rect x="2"  y="2"  width="16" height="16" rx="2" fill="none" stroke="#374151" strokeWidth="2" />
          <rect x="5"  y="5"  width="10" height="10" rx="1" fill="#374151" />
          <rect x="38" y="2"  width="16" height="16" rx="2" fill="none" stroke="#374151" strokeWidth="2" />
          <rect x="41" y="5"  width="10" height="10" rx="1" fill="#374151" />
          <rect x="2"  y="38" width="16" height="16" rx="2" fill="none" stroke="#374151" strokeWidth="2" />
          <rect x="5"  y="41" width="10" height="10" rx="1" fill="#374151" />
          {/* Decorative data modules — deterministic pattern from code */}
          {[20,23,26,29,32,35,38,20,26,32,38,23,29,35].map((x, i) => (
            <rect key={i} x={x} y={20 + (i % 5) * 4} width="3" height="3" rx="0.5"
              fill={code.charCodeAt(i % code.length) % 2 === 0 ? '#374151' : 'transparent'} />
          ))}
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
          Código de Auditoria — RDC 978/2025
        </p>
        <p className="text-lg font-mono font-bold text-gray-900 tracking-wider">{code}</p>
        <p className="text-[10px] text-gray-500 mt-1">
          Gerado em {fmtFull(generatedAt)}
        </p>
        <p className="text-[9px] text-gray-400 mt-0.5">
          Este código identifica unicamente este relatório para fins de rastreabilidade e auditoria regulatória.
        </p>
      </div>
    </div>
  );
}

// ─── Summary stats bar ────────────────────────────────────────────────────────

function SummaryBar({ lot }: { lot: ControlLot }) {
  const total     = lot.runs.length;
  const approved  = lot.runs.filter((r) => r.status === 'Aprovada').length;
  const rejected  = lot.runs.filter((r) => r.status === 'Rejeitada').length;
  const pending   = total - approved - rejected;
  const withViol  = lot.runs.filter((r) =>
    r.results.some((res) => res.violations.length > 0)
  ).length;

  const approvalPct = total > 0 ? ((approved / total) * 100).toFixed(1) : '—';

  return (
    <div className="grid grid-cols-5 gap-0 border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
      {[
        { label: 'Total de corridas', value: total,       color: 'text-gray-900' },
        { label: 'Aprovadas',         value: approved,    color: 'text-green-700' },
        { label: 'Rejeitadas',        value: rejected,    color: 'text-red-700' },
        { label: 'Pendentes',         value: pending,     color: 'text-amber-700' },
        { label: 'Taxa de aprovação', value: `${approvalPct}%`, color: 'text-indigo-700' },
      ].map(({ label, value, color }, i) => (
        <div key={i}
          className={`px-4 py-3 text-center ${i > 0 ? 'border-l border-gray-200 print:border-gray-300' : ''}`}
        >
          <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportsView() {
  const activeLot       = useActiveLot();
  const activeLab       = useActiveLab();
  const user            = useUser();
  const setCurrentView  = useAppStore((s) => s.setCurrentView);

  const generatedAt = useMemo(() => new Date(), []);

  const auditCode = useMemo(
    () => activeLot && activeLab ? auditId(activeLot, activeLab.id) : 'CQ-00000000',
    [activeLot, activeLab]
  );

  // Analytes that actually have data in this lot
  const activeAnalyteIds = useMemo(() => {
    if (!activeLot) return [];
    return activeLot.requiredAnalytes.filter((id) => ANALYTE_MAP[id]);
  }, [activeLot]);

  function handlePrint() {
    window.print();
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!activeLot) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 text-sm">Nenhum lote selecionado.</p>
        <button
          type="button"
          onClick={() => setCurrentView('analyzer')}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1.5"
        >
          <BackIcon />
          Voltar ao analisador
        </button>
      </div>
    );
  }

  const lotLevel = `Nível ${activeLot.level}`;
  const lotPeriod = `${fmt(activeLot.startDate)} — ${fmt(activeLot.expiryDate)}`;

  return (
    <>
      {/* ── Print button (always visible, not printed) ─────────────────────── */}
      <PrintButton onClick={handlePrint} />

      {/* ── Back button (not printed) ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setCurrentView('analyzer')}
        className="
          no-print
          fixed top-4 left-4 z-50
          flex items-center gap-1.5
          px-3 py-2 rounded-lg
          bg-white/[0.06] hover:bg-white/[0.1]
          text-white/50 hover:text-white/80 text-sm
          transition-all
        "
        aria-label="Voltar"
      >
        <BackIcon />
        Voltar
      </button>

      {/* ── Printable report body ──────────────────────────────────────────── */}
      <div
        id="cq-report"
        className="
          min-h-screen
          bg-white text-gray-900
          mx-auto
          px-10 py-12
          max-w-4xl
          print:max-w-none print:px-8 print:py-6 print:m-0
          font-sans
        "
      >

        {/* ── Report header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 pb-5 border-b-2 border-gray-900">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
              Relatório de Controle de Qualidade Interno
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {activeLab?.name ?? 'Laboratório'}
            </h1>
            {activeLab?.cnpj && (
              <p className="text-xs text-gray-500 mt-0.5">CNPJ: {activeLab.cnpj}</p>
            )}
            {activeLab?.address && (
              <p className="text-xs text-gray-500">
                {activeLab.address.city} — {activeLab.address.state}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 ml-8">
            <p className="text-xs text-gray-500">Emitido por</p>
            <p className="text-sm font-semibold text-gray-800">
              {user?.displayName ?? user?.email ?? 'Operador'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Gerado em</p>
            <p className="text-sm font-mono text-gray-800">{fmtFull(generatedAt)}</p>
          </div>
        </div>

        {/* ── Lot info block ─────────────────────────────────────────────────── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Informações do Lote
          </h2>
          <div className="grid grid-cols-3 gap-0 border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
            {[
              { label: 'Material de Controle', value: activeLot.controlName },
              { label: 'Número do Lote',        value: `#${activeLot.lotNumber}` },
              { label: 'Nível',                 value: lotLevel },
              { label: 'Equipamento',           value: activeLot.equipmentName },
              { label: 'Número de Série',        value: activeLot.serialNumber },
              { label: 'Período de Validade',   value: lotPeriod },
            ].map(({ label, value }, i) => (
              <div key={i}
                className={`px-4 py-3 ${i > 0 ? 'border-l border-gray-200 print:border-gray-300' : ''}
                  ${i >= 3 ? 'border-t border-gray-200 print:border-gray-300' : ''}`}
              >
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Summary bar ───────────────────────────────────────────────────── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Resumo Estatístico
          </h2>
          <SummaryBar lot={activeLot} />
        </section>

        {/* ── Stats table ───────────────────────────────────────────────────── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Estatísticas por Analito
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 print:bg-gray-100">
                  <th className="text-left py-2 pl-3 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-200 print:border-gray-300">
                    Analito
                  </th>
                  <th className="text-center py-2 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-200 print:border-gray-300">
                    Unidade
                  </th>
                  <th className="text-center py-2 font-semibold text-gray-500 border-b border-gray-200 print:border-gray-300" colSpan={3}>
                    ← Fabricante →
                  </th>
                  <th className="text-center py-2 font-semibold text-gray-500 border-b border-gray-200 print:border-gray-300 border-l border-gray-200 print:border-gray-300" colSpan={4}>
                    ← Interna (calculada) →
                  </th>
                </tr>
                <tr className="bg-gray-50 print:bg-gray-100">
                  <th className="pb-2 pl-3" />
                  <th className="pb-2" />
                  <th className="pb-2 text-center text-[10px] font-medium text-gray-500">x̄</th>
                  <th className="pb-2 text-center text-[10px] font-medium text-gray-500">SD</th>
                  <th className="pb-2 text-center text-[10px] font-medium text-gray-500">CV%</th>
                  <th className="pb-2 text-center text-[10px] font-medium text-gray-500 border-l border-gray-200 print:border-gray-300">x̄</th>
                  <th className="pb-2 text-center text-[10px] font-medium text-gray-500">SD</th>
                  <th className="pb-2 text-center text-[10px] font-medium text-gray-500">CV%</th>
                  <th className="pb-2 pr-3 text-center text-[10px] font-medium text-gray-500">n</th>
                </tr>
              </thead>
              <tbody>
                {activeAnalyteIds.map((id) => (
                  <AnalyteStatsRow key={id} analyteId={id} lot={activeLot} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Levey-Jennings charts (one per analyte) ────────────────────────── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Gráficos de Levey-Jennings
          </h2>
          <div className="space-y-5">
            {activeAnalyteIds.map((id) => {
              const analyte = ANALYTE_MAP[id];
              const mfr     = activeLot.manufacturerStats[id];
              if (!analyte || !mfr) return null;
              return (
                <div
                  key={id}
                  className="border border-gray-200 rounded-lg overflow-hidden print:border-gray-300 print-avoid-break"
                >
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 print:bg-gray-100 border-b border-gray-200 print:border-gray-300">
                    <span className="text-xs font-bold text-gray-700">{analyte.name}</span>
                    <span className="text-[10px] text-gray-500">
                      {analyte.unit}
                      {' · '}
                      x̄ = {mfr.mean.toFixed(analyte.decimals)}
                      {' · '}
                      SD = {mfr.sd.toFixed(analyte.decimals)}
                    </span>
                  </div>
                  <div className="px-2 py-2">
                    <MiniChart analyteId={id} lot={activeLot} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Runs table ─────────────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Histórico de Corridas
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
            <RunsTable runs={activeLot.runs} />
          </div>
        </section>

        {/* ── Audit block ────────────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Rastreabilidade
          </h2>
          <AuditBlock code={auditCode} generatedAt={generatedAt} />
        </section>

        {/* ── LGPD footer (obrigatório RDC 978/2025) ────────────────────────── */}
        <footer className="mt-8 pt-5 border-t border-gray-300">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center print:border print:border-gray-300">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 1L2 4v4c0 4 2.5 6 6 7 3.5-1 6-3 6-7V4L8 1z"
                  stroke="#6b7280" strokeWidth="1.3" fill="none" />
                <path d="M5.5 8l2 2 3-3" stroke="#6b7280" strokeWidth="1.3"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">
                Aviso de Privacidade — LGPD (Lei 13.709/2018)
              </p>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Este documento contém dados de controle de qualidade laboratorial processados em conformidade com a
                Lei Geral de Proteção de Dados Pessoais (LGPD — Lei Federal 13.709/2018) e com a RDC 978/2025 da ANVISA.
                Os dados pessoais presentes neste relatório (operador, laboratório) são tratados exclusivamente para
                fins de rastreabilidade, controle de qualidade e cumprimento de obrigações regulatórias.
                O acesso a este documento deve ser restrito a profissionais autorizados. Não compartilhe este relatório
                com terceiros não autorizados. Retenção documental conforme exigência ANVISA: mínimo 5 anos.
              </p>
              <div className="flex items-center gap-6 mt-2 pt-2 border-t border-gray-200">
                <p className="text-[9px] text-gray-400">
                  Sistema: CQ Hematologia Labclin · RDC 978/2025 compliant
                </p>
                <p className="text-[9px] text-gray-400 ml-auto">
                  Documento gerado em: {fmtFull(generatedAt)}
                </p>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
