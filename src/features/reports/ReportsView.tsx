import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { useAppStore } from '../../store/useAppStore';
import { useActiveLab, useUser } from '../../store/useAuthStore';
import { ANALYTE_MAP } from '../../constants';
import type { ControlLot, Run, WestgardViolation } from '../../types';
import { createReportEmission } from './services/reportEmissionService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtFull(d: Date) {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function computeStats(values: number[]) {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : (sd / mean) * 100;
  return { mean, sd, cv, n };
}
// Código de auditoria é gerado server-side via createReportEmission (SHA-256
// criptográfico + registro append-only em /labs/{labId}/report-emissions).
// A função djb2 determinística anterior foi removida — RDC 978/2025.

// ─── Icons ────────────────────────────────────────────────────────────────────

function PrinterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="1" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M3 6H2a1 1 0 00-1 1v5a1 1 0 001 1h1m10 0h1a1 1 0 001-1V7a1 1 0 00-1-1h-1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 12h6M5 14h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M9 11L5 7l4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Level pill ───────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' },
  2: { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' },
  3: { bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-700' },
};
const LEVEL_TEXT_CLASS: Record<number, string> = {
  1: 'text-blue-700',
  2: 'text-amber-700',
  3: 'text-rose-700',
};

// ─── Stats table per analyte ──────────────────────────────────────────────────

function AnalyteStatsRow({ analyteId, lot }: { analyteId: string; lot: ControlLot }) {
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
      <td className="py-1.5 text-center font-mono text-xs text-gray-700 print:text-black">
        {mfr ? mfr.mean.toFixed(d) : '—'}
      </td>
      <td className="py-1.5 text-center font-mono text-xs text-gray-700 print:text-black">
        {mfr ? mfr.sd.toFixed(d) : '—'}
      </td>
      <td className="py-1.5 text-center font-mono text-xs text-gray-600 print:text-gray-700">
        {mfr && mfr.mean > 0 ? `${((mfr.sd / mfr.mean) * 100).toFixed(1)}%` : '—'}
      </td>
      <td className="py-1.5 text-center font-mono text-xs text-gray-700 print:text-black border-l border-gray-100 print:border-gray-200">
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

// ─── Mini chart ───────────────────────────────────────────────────────────────

function MiniChart({ analyteId, lot }: { analyteId: string; lot: ControlLot }) {
  const analyte = ANALYTE_MAP[analyteId];
  const mfr = lot.manufacturerStats[analyteId];
  if (!analyte || !mfr) return null;
  const { mean, sd } = mfr;
  const sortedRuns = [...lot.runs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const data = sortedRuns.map((run, idx) => ({
    index: idx + 1,
    value: run.results.find((r) => r.analyteId === analyteId)?.value ?? null,
  }));
  if (data.every((d) => d.value === null)) return null;
  const yMin = mean - sd * 3.5;
  const yMax = mean + sd * 3.5;
  return (
    <div style={{ width: '100%', height: 110 }}>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#e5e7eb" horizontal vertical={false} />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 8, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 8, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v) => v.toFixed(analyte.decimals)}
          />
          <ReferenceLine y={mean} stroke="#374151" strokeWidth={1.2} />
          <ReferenceLine y={mean + sd} stroke="#10b981" strokeWidth={0.8} strokeDasharray="3 2" />
          <ReferenceLine y={mean - sd} stroke="#10b981" strokeWidth={0.8} strokeDasharray="3 2" />
          <ReferenceLine
            y={mean + 2 * sd}
            stroke="#f59e0b"
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
          <ReferenceLine
            y={mean - 2 * sd}
            stroke="#f59e0b"
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
          <ReferenceLine
            y={mean + 3 * sd}
            stroke="#ef4444"
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
          <ReferenceLine
            y={mean - 3 * sd}
            stroke="#ef4444"
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#4f46e5"
            strokeWidth={1.5}
            dot={{ r: 3, fill: '#4f46e5', strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Westgard badge ───────────────────────────────────────────────────────────

const REJECTION_RULES: WestgardViolation[] = ['1-3s', '2-2s', 'R-4s', '4-1s', '10x', '6T', '6X'];

function VBadge({ v }: { v: WestgardViolation }) {
  const isReject = REJECTION_RULES.includes(v);
  return (
    <span
      className={`inline-block text-[9px] font-mono font-bold px-1 py-0.5 rounded border mr-0.5
      ${
        isReject
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
          <th className="text-left py-2 pl-3 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">
            #
          </th>
          <th className="text-left py-2 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">
            Data / Hora
          </th>
          <th className="text-left py-2 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">
            Amostra
          </th>
          <th className="text-center py-2 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">
            Status
          </th>
          <th className="text-left py-2 pr-3 font-semibold text-gray-600 print:text-gray-800 border-b border-gray-300">
            Violações Westgard
          </th>
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
              ${hasRejection ? 'bg-red-50/50 print:bg-white' : allViolations.includes('1-2s') ? 'bg-amber-50/40 print:bg-white' : ''}`}
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
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border
                  ${
                    run.status === 'Aprovada'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : run.status === 'Rejeitada'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {run.status}
                </span>
              </td>
              <td className="py-1.5 pr-3">
                {allViolations.length === 0 ? (
                  <span className="text-gray-400">—</span>
                ) : (
                  allViolations.map((v) => <VBadge key={v} v={v} />)
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Summary bar (per lot) ────────────────────────────────────────────────────

function SummaryBar({ lot }: { lot: ControlLot }) {
  const total = lot.runs.length;
  const approved = lot.runs.filter((r) => r.status === 'Aprovada').length;
  const rejected = lot.runs.filter((r) => r.status === 'Rejeitada').length;
  const pending = total - approved - rejected;
  const approvalPct = total > 0 ? ((approved / total) * 100).toFixed(1) : '—';

  return (
    <div className="grid grid-cols-5 gap-0 border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
      {[
        { label: 'Total', value: total, color: 'text-gray-900' },
        { label: 'Aprovadas', value: approved, color: 'text-green-700' },
        { label: 'Rejeitadas', value: rejected, color: 'text-red-700' },
        { label: 'Pendentes', value: pending, color: 'text-amber-700' },
        { label: 'Taxa', value: `${approvalPct}%`, color: 'text-indigo-700' },
      ].map(({ label, value, color }, i) => (
        <div
          key={i}
          className={`px-3 py-2.5 text-center ${i > 0 ? 'border-l border-gray-200 print:border-gray-300' : ''}`}
        >
          <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Audit block ─────────────────────────────────────────────────────────────

function AuditBlock({ code, generatedAt }: { code: string; generatedAt: Date }) {
  return (
    <div className="flex items-start gap-4 p-4 border border-gray-300 rounded-lg print:border-gray-400">
      <div
        className="shrink-0 w-16 h-16 border border-gray-300 rounded p-1 print:border-gray-400"
        aria-hidden
      >
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <rect
            x="2"
            y="2"
            width="16"
            height="16"
            rx="2"
            fill="none"
            stroke="#374151"
            strokeWidth="2"
          />
          <rect x="5" y="5" width="10" height="10" rx="1" fill="#374151" />
          <rect
            x="38"
            y="2"
            width="16"
            height="16"
            rx="2"
            fill="none"
            stroke="#374151"
            strokeWidth="2"
          />
          <rect x="41" y="5" width="10" height="10" rx="1" fill="#374151" />
          <rect
            x="2"
            y="38"
            width="16"
            height="16"
            rx="2"
            fill="none"
            stroke="#374151"
            strokeWidth="2"
          />
          <rect x="5" y="41" width="10" height="10" rx="1" fill="#374151" />
          {[20, 23, 26, 29, 32, 35, 38, 20, 26, 32, 38, 23, 29, 35].map((x, i) => (
            <rect
              key={i}
              x={x}
              y={20 + (i % 5) * 4}
              width="3"
              height="3"
              rx="0.5"
              fill={code.charCodeAt(i % code.length) % 2 === 0 ? '#374151' : 'transparent'}
            />
          ))}
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
          Código de Auditoria — RDC 978/2025
        </p>
        <p className="text-lg font-mono font-bold text-gray-900 tracking-wider">{code}</p>
        <p className="text-[10px] text-gray-500 mt-1">Gerado em {fmtFull(generatedAt)}</p>
        <p className="text-[9px] text-gray-400 mt-0.5">
          Este código identifica unicamente este relatório para fins de rastreabilidade e auditoria
          regulatória.
        </p>
      </div>
    </div>
  );
}

// ─── Level section (one NV block) ─────────────────────────────────────────────

interface LevelSectionProps {
  lot: ControlLot;
  auditCode: string;
  isFirst: boolean;
  generatedAt: Date;
}

function LevelSection({ lot, auditCode, isFirst, generatedAt }: LevelSectionProps) {
  const lv = lot.level ?? 1;
  const colors = LEVEL_COLORS[lv] ?? LEVEL_COLORS[1];
  const levelTextCls = LEVEL_TEXT_CLASS[lv] ?? 'text-gray-800';
  const analyteIds = lot.requiredAnalytes.filter((id) => ANALYTE_MAP[id]);
  const lotPeriod = `${fmt(lot.startDate)} — ${fmt(lot.expiryDate)}`;

  return (
    <div className={isFirst ? '' : 'print-level-break mt-12 print:mt-0'}>
      {/* Level divider */}
      <div className="flex items-center gap-3 mb-5 print-avoid-break">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colors.bg} ${colors.text} ${colors.border}`}
        >
          <span className="text-xs font-bold uppercase tracking-widest">Nível {lv}</span>
        </div>
        <div className="flex-1 h-px bg-gray-200 print:bg-gray-300" />
        <span className="text-xs text-gray-400 print:text-gray-500 font-mono">
          #{lot.lotNumber}
        </span>
      </div>

      {/* Lot info */}
      <section className="mb-5 print-avoid-break">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
          Informações do Lote
        </h2>
        <div className="grid grid-cols-3 gap-0 border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
          {[
            { label: 'Material de Controle', value: lot.controlName ?? '—' },
            { label: 'Número do Lote', value: `#${lot.lotNumber}` },
            { label: 'Nível', value: `Nível ${lv}`, cls: levelTextCls },
            { label: 'Equipamento', value: lot.equipmentName },
            { label: 'Número de Série', value: lot.serialNumber },
            { label: 'Período de Validade', value: lotPeriod },
          ].map(({ label, value, cls }, i) => (
            <div
              key={i}
              className={`px-4 py-3 ${i > 0 ? 'border-l border-gray-200 print:border-gray-300' : ''} ${i >= 3 ? 'border-t border-gray-200 print:border-gray-300' : ''}`}
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
              <p className={`text-sm font-semibold print:text-black ${cls ?? 'text-gray-800'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Summary */}
      <section className="mb-5 print-avoid-break">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
          Resumo Estatístico
        </h2>
        <SummaryBar lot={lot} />
      </section>

      {/* Stats table */}
      <section className="mb-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
          Estatísticas por Analito
        </h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 print:bg-gray-100">
                <th className="text-left py-2 pl-3 font-semibold text-gray-600 border-b border-gray-200 print:border-gray-300">
                  Analito
                </th>
                <th className="text-center py-2 font-semibold text-gray-600 border-b border-gray-200 print:border-gray-300">
                  Unidade
                </th>
                <th
                  className="text-center py-2 font-semibold text-gray-500 border-b border-gray-200 print:border-gray-300"
                  colSpan={3}
                >
                  ← Fabricante →
                </th>
                <th
                  className="text-center py-2 font-semibold text-gray-500 border-b border-gray-200 print:border-gray-300 border-l border-gray-200"
                  colSpan={4}
                >
                  ← Interna (calculada) →
                </th>
              </tr>
              <tr className="bg-gray-50 print:bg-gray-100">
                <th className="pb-2 pl-3" scope="col" aria-label="Analito" />
                <th className="pb-2" scope="col" aria-label="Unidade" />
                <th className="pb-2 text-center text-[10px] font-medium text-gray-500">x̄</th>
                <th className="pb-2 text-center text-[10px] font-medium text-gray-500">SD</th>
                <th className="pb-2 text-center text-[10px] font-medium text-gray-500">CV%</th>
                <th className="pb-2 text-center text-[10px] font-medium text-gray-500 border-l border-gray-100">
                  x̄
                </th>
                <th className="pb-2 text-center text-[10px] font-medium text-gray-500">SD</th>
                <th className="pb-2 text-center text-[10px] font-medium text-gray-500">CV%</th>
                <th className="pb-2 pr-3 text-center text-[10px] font-medium text-gray-500">n</th>
              </tr>
            </thead>
            <tbody>
              {analyteIds.map((id) => (
                <AnalyteStatsRow key={id} analyteId={id} lot={lot} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* LJ charts */}
      <section className="mb-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Gráficos de Levey-Jennings
        </h2>
        <div className="space-y-4">
          {analyteIds.map((id) => {
            const analyte = ANALYTE_MAP[id];
            const mfr = lot.manufacturerStats[id];
            if (!analyte || !mfr) return null;
            return (
              <div
                key={id}
                className="border border-gray-200 rounded-lg overflow-hidden print:border-gray-300 print-avoid-break"
              >
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 print:bg-gray-100 border-b border-gray-200 print:border-gray-300">
                  <span className="text-xs font-bold text-gray-700">{analyte.name}</span>
                  <span className="text-[10px] text-gray-500">
                    {analyte.unit} · x̄ = {mfr.mean.toFixed(analyte.decimals)} · SD ={' '}
                    {mfr.sd.toFixed(analyte.decimals)}
                  </span>
                </div>
                <div className="px-2 py-2">
                  <MiniChart analyteId={id} lot={lot} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Runs table */}
      {lot.runs.length > 0 && (
        <section className="mb-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
            Histórico de Corridas
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
            <RunsTable runs={lot.runs} />
          </div>
        </section>
      )}

      {/* Per-level audit */}
      <section>
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
          Rastreabilidade — Nível {lv}
        </h2>
        <AuditBlock code={auditCode} generatedAt={generatedAt} />
      </section>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportsView() {
  const lots = useAppStore((s) => s.lots);
  const activeLotId = useAppStore((s) => s.activeLotId);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const activeLab = useActiveLab();
  const user = useUser();

  const generatedAt = useMemo(() => new Date(), []);

  // Estado da emissão: {loading, auditCode, error}. A emissão grava uma entrada
  // append-only em /labs/{labId}/report-emissions assim que o componente monta
  // com dados válidos. `printReady` bloqueia a impressão até o código existir.
  const [emissionState, setEmissionState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    auditCode: string | null;
    error: string | null;
  }>({ status: 'idle', auditCode: null, error: null });
  // Garante exatamente uma emissão por montagem do relatório — evita duplicar
  // em StrictMode (double-invoke do useEffect em dev) e em re-renders.
  const emissionStartedRef = useRef(false);

  // All lots from the same month/year as the active lot, sorted by level
  const referenceLots = useMemo(() => {
    const activeLot = lots.find((l) => l.id === activeLotId) ?? lots[0] ?? null;
    if (!activeLot) return lots.slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const refYear = activeLot.startDate.getFullYear();
    const refMonth = activeLot.startDate.getMonth();
    return lots
      .filter((l) => l.startDate.getFullYear() === refYear && l.startDate.getMonth() === refMonth)
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [lots, activeLotId]);

  const refMonth = useMemo(() => {
    if (!referenceLots[0]) return '';
    return referenceLots[0].startDate.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  }, [referenceLots]);

  // Combined totals
  const totals = useMemo(() => {
    const allRuns = referenceLots.flatMap((l) => l.runs);
    const total = allRuns.length;
    const approved = allRuns.filter((r) => r.status === 'Aprovada').length;
    const rejected = allRuns.filter((r) => r.status === 'Rejeitada').length;
    const pending = total - approved - rejected;
    return {
      total,
      approved,
      rejected,
      pending,
      rate: total > 0 ? ((approved / total) * 100).toFixed(1) : '—',
    };
  }, [referenceLots]);

  // ── Emissão do código de auditoria (SHA-256 + registro Firestore) ───────
  // Dispara uma única vez quando os dados mínimos estão disponíveis. Append-
  // only por regra — o ref impede gerar emissões duplicadas em re-renders.
  useEffect(() => {
    if (emissionStartedRef.current) return;
    if (!activeLab?.id || !user?.uid || referenceLots.length === 0) return;
    emissionStartedRef.current = true;
    setEmissionState({ status: 'loading', auditCode: null, error: null });
    void (async () => {
      try {
        const emission = await createReportEmission(
          activeLab.id,
          { uid: user.uid, email: user.email ?? null, displayName: user.displayName ?? null },
          referenceLots,
          generatedAt,
        );
        setEmissionState({ status: 'ready', auditCode: emission.auditCode, error: null });
      } catch (err) {
        emissionStartedRef.current = false; // permite retry manual
        setEmissionState({
          status: 'error',
          auditCode: null,
          error: err instanceof Error ? err.message : 'Falha ao registrar emissão.',
        });
      }
    })();
  }, [activeLab?.id, user?.uid, user?.email, user?.displayName, referenceLots, generatedAt]);

  if (referenceLots.length === 0) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 text-sm">Nenhum lote selecionado.</p>
        <button
          type="button"
          onClick={() => setCurrentView('analyzer')}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1.5"
        >
          <BackIcon /> Voltar ao analisador
        </button>
      </div>
    );
  }

  const isEmissionReady = emissionState.status === 'ready' && emissionState.auditCode !== null;
  const printDisabled = !isEmissionReady;

  return (
    <>
      {/* Print button — bloqueado até que o código de auditoria esteja registrado */}
      <button
        type="button"
        onClick={() => window.print()}
        disabled={printDisabled}
        className="no-print fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-semibold
          shadow-lg shadow-violet-900/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-violet-600"
        aria-label="Imprimir relatório"
        title={
          emissionState.status === 'loading'
            ? 'Gerando código de auditoria…'
            : emissionState.status === 'error'
              ? 'Código de auditoria não registrado — recarregue a página'
              : 'Imprimir relatório'
        }
      >
        <PrinterIcon />
        {emissionState.status === 'loading' ? 'Gerando código…' : 'Imprimir Relatório'}
      </button>

      {/* Back button */}
      <button
        type="button"
        onClick={() => setCurrentView('analyzer')}
        className="no-print fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-lg
          bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white/80 text-sm transition-all"
        aria-label="Voltar"
      >
        <BackIcon /> Voltar
      </button>

      {/* Printable body */}
      <div
        id="cq-report"
        className="min-h-screen bg-white text-gray-900 mx-auto px-10 py-12 max-w-4xl
          print:max-w-none print:px-0 print:py-0 print:m-0 font-sans"
      >
        {/* ── Shared report header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 pb-5 border-b-2 border-gray-900">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
              Relatório de Controle de Qualidade Interno
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {activeLab?.name ?? 'Laboratório'}
            </h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {referenceLots.map((l) => {
                const lv = l.level ?? 1;
                const c = LEVEL_COLORS[lv];
                return (
                  <span
                    key={l.id}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${c.bg} ${c.text} ${c.border}`}
                  >
                    NV{lv}
                  </span>
                );
              })}
              <span className="text-sm font-semibold text-gray-700 capitalize ml-1">
                {refMonth}
              </span>
            </div>
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

        {/* ── Combined KPIs (all levels) ───────────────────────────────────── */}
        <section className="mb-8 print-avoid-break">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Resumo Consolidado — {referenceLots.length} nível
            {referenceLots.length !== 1 ? 'eis' : ''}
          </h2>
          <div className="grid grid-cols-5 gap-0 border border-gray-200 rounded-lg overflow-hidden print:border-gray-300">
            {[
              { label: 'Total de corridas', value: totals.total, color: 'text-gray-900' },
              { label: 'Aprovadas', value: totals.approved, color: 'text-green-700' },
              { label: 'Rejeitadas', value: totals.rejected, color: 'text-red-700' },
              { label: 'Pendentes', value: totals.pending, color: 'text-amber-700' },
              { label: 'Taxa de aprovação', value: `${totals.rate}%`, color: 'text-indigo-700' },
            ].map(({ label, value, color }, i) => (
              <div
                key={i}
                className={`px-4 py-3 text-center ${i > 0 ? 'border-l border-gray-200 print:border-gray-300' : ''}`}
              >
                <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Banner de status da emissão (erro bloqueia impressão) ───────── */}
        {emissionState.status === 'error' && (
          <div className="no-print mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
            <p className="text-xs font-semibold text-red-700">
              Falha ao registrar emissão deste relatório.
            </p>
            <p className="text-[11px] text-red-600 mt-1 leading-snug">
              {emissionState.error ??
                'Sem código de auditoria válido, o relatório não pode ser impresso.'}{' '}
              Recarregue a página para tentar novamente.
            </p>
          </div>
        )}

        {/* ── One section per level ────────────────────────────────────────── */}
        {referenceLots.map((lot, idx) => (
          <LevelSection
            key={lot.id}
            lot={lot}
            auditCode={
              emissionState.auditCode ??
              (emissionState.status === 'loading' ? 'CQ-—————————————' : 'CQ-INDISPONIVEL')
            }
            isFirst={idx === 0}
            generatedAt={generatedAt}
          />
        ))}

        {/* ── LGPD footer ──────────────────────────────────────────────────── */}
        <footer className="mt-10 pt-5 border-t border-gray-300 print-avoid-break">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center print:border print:border-gray-300">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M8 1L2 4v4c0 4 2.5 6 6 7 3.5-1 6-3 6-7V4L8 1z"
                  stroke="#6b7280"
                  strokeWidth="1.3"
                  fill="none"
                />
                <path
                  d="M5.5 8l2 2 3-3"
                  stroke="#6b7280"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">
                Aviso de Privacidade — LGPD (Lei 13.709/2018)
              </p>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Este documento contém dados de controle de qualidade laboratorial processados em
                conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei Federal
                13.709/2018) e com a RDC 978/2025 da ANVISA. Os dados pessoais presentes neste
                relatório são tratados exclusivamente para fins de rastreabilidade, controle de
                qualidade e cumprimento de obrigações regulatórias. Retenção documental: mínimo 5
                anos.
              </p>
              <div className="flex items-center gap-6 mt-2 pt-2 border-t border-gray-200">
                <p className="text-[9px] text-gray-400">
                  Sistema: CQ Hematologia Labclin · RDC 978/2025 compliant
                </p>
                <p className="text-[9px] text-gray-400 ml-auto">
                  Gerado em: {fmtFull(generatedAt)}
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
