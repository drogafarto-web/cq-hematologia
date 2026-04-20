import React, { useState, useEffect, useMemo } from 'react';
import { useUser, useUserRole, useIsSuperAdmin } from '../../../store/useAuthStore';
import { useCoagRuns } from '../hooks/useCoagRuns';
import { useSaveCoagRun } from '../hooks/useSaveCoagRun';
import { useCoagWestgard } from '../hooks/useCoagWestgard';
import { CoagulacaoForm } from './CoagulacaoForm';
import { CoagAuditor } from './CoagAuditor';
import { CoagulacaoIndicadores } from './CoagulacaoIndicadores';
import { CoagulacaoRelatorioPrint } from './CoagulacaoRelatorioPrint';
import { exportCoagRunsToCSV } from '../services/coagExportService';
import {
  updateCoagLotDecision,
  updateCoagLotMeta,
  deleteCoagLot,
} from '../services/coagulacaoFirebaseService';
import { COAG_ANALYTES, COAG_ANALYTE_IDS } from '../CoagAnalyteConfig';
import { LeveyJenningsChart } from '../../chart/LeveyJenningsChart';
import { useChartData } from '../../chart/hooks/useChartData';
import type { CoagulacaoFormData } from './CoagulacaoForm.schema';
import type { CoagulacaoLot, CoagulacaoRun } from '../types/Coagulacao';
import type { CoagAnalyteId, CoagLotStatus, CoagNivel, CoagStatus } from '../types/_shared_refs';
import type { Analyte, ControlLot, Run, AnalyteResult } from '../../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const DownloadIcon = () => (
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
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);
const XIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const PrintIcon = () => (
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
    <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <path d="M6 14h12v8H6z" />
  </svg>
);
const CheckIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const BanIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M4.9 4.9l14.2 14.2" />
  </svg>
);
const QRIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
    <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="1" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="2.5" y="2.5" width="2" height="2" fill="currentColor" />
    <rect x="9.5" y="2.5" width="2" height="2" fill="currentColor" />
    <rect x="2.5" y="9.5" width="2" height="2" fill="currentColor" />
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
    <path
      d="M9 2l2 2-7 7H2v-2l7-7z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
    <path
      d="M2 3.5h9M4.5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5 6v4M8 6v4"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 3.5l.5 7a.5.5 0 00.5.5h5a.5.5 0 00.5-.5l.5-7"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);
const SpinnerIcon = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// ─── Lot Status Badge ─────────────────────────────────────────────────────────

const LOT_STATUS_CONFIG: Record<CoagLotStatus, { label: string; dot: string; cls: string }> = {
  sem_dados: {
    label: 'Sem dados',
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]',
  },
  valido: {
    label: 'Válido',
    dot: 'bg-emerald-500',
    cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  },
  atencao: {
    label: 'Atenção',
    dot: 'bg-amber-500',
    cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  },
  reprovado: {
    label: 'Reprovado',
    dot: 'bg-red-500',
    cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  },
};

function LotStatusBadge({ status }: { status: CoagLotStatus }) {
  const { label, dot, cls } = LOT_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  );
}

// ─── Validity helpers ─────────────────────────────────────────────────────────

function validityLevel(isoDate: string | undefined): {
  level: 'ok' | 'warning' | 'critical' | 'expired';
  daysLeft: number;
} {
  if (!isoDate) return { level: 'ok', daysLeft: Infinity };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d, 0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { level: 'expired', daysLeft: diff };
  if (diff <= 7) return { level: 'critical', daysLeft: diff };
  if (diff <= 15) return { level: 'warning', daysLeft: diff };
  return { level: 'ok', daysLeft: diff };
}

function ValidityBadge({ isoDate, label }: { isoDate: string | undefined; label: string }) {
  const { level, daysLeft } = validityLevel(isoDate);
  if (level === 'ok') return null;
  const cls =
    level === 'expired'
      ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30'
      : level === 'critical'
        ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
        : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
  const msg =
    level === 'expired'
      ? `${label} EXPIRADO há ${Math.abs(daysLeft)}d`
      : `${label} vence em ${daysLeft}d`;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${cls}`}
      title={`Validade ${isoDate ?? '—'}`}
    >
      ⚠ {msg}
    </span>
  );
}

// ─── Chart adapter (CoagulacaoRun → ControlLot) ───────────────────────────────

/**
 * Adapta um lote de coagulação + corridas para o shape esperado por `useChartData`
 * (ControlLot + Run[]). Permite reuso integral do LeveyJenningsChart sem divergir
 * do pipeline de análise do módulo de hematologia.
 */
function buildChartLot(coagLot: CoagulacaoLot, coagRuns: CoagulacaoRun[]): ControlLot {
  const nivel = coagLot.nivel;

  const manufacturerStats = Object.fromEntries(
    COAG_ANALYTE_IDS.map((id) => {
      const baseline = COAG_ANALYTES[id].levels[nivel];
      const mean = coagLot.mean?.[id] ?? baseline.mean;
      const sd = coagLot.sd?.[id] ?? baseline.sd;
      return [id, { mean, sd }];
    }),
  );

  const runs: Run[] = coagRuns.map((r) => {
    const ts = r.createdAt?.toDate?.() ?? new Date(`${r.dataRealizacao}T00:00:00`);
    const results: AnalyteResult[] = COAG_ANALYTE_IDS.map((id) => ({
      id: `${r.id}:${id}`,
      runId: r.id,
      analyteId: id,
      value: r.resultados[id],
      confidence: 1,
      reasoning: '',
      timestamp: ts,
      violations: [], // recalculadas por useChartData contra os stats ativos
    }));
    return {
      id: r.id,
      lotId: r.lotId,
      labId: r.labId,
      timestamp: ts,
      imageUrl: r.imageUrl ?? '',
      status: r.status,
      results,
      manualOverride: r.isEdited,
      createdBy: r.createdBy,
    };
  });

  return {
    id: coagLot.id,
    labId: coagLot.labId,
    lotNumber: coagLot.loteControle,
    controlName: `Coagulação Nível ${nivel}`,
    equipmentName: 'Clotimer Duo',
    serialNumber: '',
    level: nivel === 'I' ? 1 : 2,
    startDate: new Date(`${coagLot.aberturaControle}T00:00:00`),
    expiryDate: new Date(`${coagLot.validadeControle}T00:00:00`),
    requiredAnalytes: [...COAG_ANALYTE_IDS],
    manufacturerStats,
    runs,
    statistics: null,
    runCount: coagLot.runCount,
    createdAt: coagLot.createdAt?.toDate?.() ?? new Date(),
    createdBy: coagLot.createdBy,
  };
}

function toAnalyte(id: CoagAnalyteId): Analyte {
  const cfg = COAG_ANALYTES[id];
  return {
    id,
    name: cfg.label,
    unit: cfg.levels.I.unit,
    decimals: cfg.decimals,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CoagulacaoContentProps {
  lots: CoagulacaoLot[];
  activeLotId: string | null;
  setActiveLotId: (id: string | null) => void;
  /** Sinal externo para abrir o modal de Nova corrida (incrementado pelo sidebar). */
  newRunTrigger: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CoagulacaoContent({
  lots,
  activeLotId,
  setActiveLotId,
  newRunTrigger,
}: CoagulacaoContentProps) {
  const user = useUser();
  const userRole = useUserRole();
  const isSuperAdmin = useIsSuperAdmin();

  const canDecide = isSuperAdmin || userRole === 'owner' || userRole === 'admin';

  // ── Modais ────────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [qrRunId, setQrRunId] = useState<string | null>(null);
  const [selectedAnalyte, setSelectedAnalyte] = useState<CoagAnalyteId>('atividadeProtrombinica');

  // ── Sidebar externo pede nova corrida ─────────────────────────────────────
  // Event-via-counter: pai incrementa `newRunTrigger` a cada clique do botão
  // no Sidebar; este useEffect abre o formulário. Padrão aceito para eventos
  // imperativos sem lift de estado (evita prop drilling showForm/setShowForm
  // por 2 níveis). Alternativa seria ref API, que o React desencoraja.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (newRunTrigger > 0) setShowForm(true);
  }, [newRunTrigger]);

  // ── Resolução do lote ativo ───────────────────────────────────────────────
  const activeLot = useMemo(
    () => lots.find((l) => l.id === activeLotId) ?? lots[0] ?? null,
    [lots, activeLotId],
  );

  // ── Listener de runs + Westgard ───────────────────────────────────────────
  const { runs, isLoading: runsLoading } = useCoagRuns(activeLot?.id ?? null);
  const { lotStatus, byRun, lotAlerts } = useCoagWestgard(
    runs,
    activeLot?.nivel ?? 'I',
    activeLot?.validadeControle ?? '2099-12-31',
  );

  const { save, isSaving, error: saveError, clearError } = useSaveCoagRun();

  // ── Adapter do gráfico ────────────────────────────────────────────────────
  const chartLot = useMemo(
    () => (activeLot ? buildChartLot(activeLot, runs) : null),
    [activeLot, runs],
  );
  const chartData = useChartData(chartLot, selectedAnalyte, 'internal');
  const chartAnalyte = toAnalyte(selectedAnalyte);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (lots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400">
          <svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M2.5 10C4 7 6 13 8 10C10 7 12 13 14 10C15.5 7.5 17 10 17.5 10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white/85 mb-1">
          Nenhum lote de coagulação registrado
        </h2>
        <p className="text-sm text-slate-500 dark:text-white/40 mb-5 max-w-md">
          Registre a primeira corrida para iniciar o controle de qualidade. Um lote é criado
          automaticamente a cada combinação de lote de controle + nível.
        </p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-500/20"
        >
          <PlusIcon /> Nova corrida
        </button>

        {showForm && (
          <NovaRunModal
            onClose={() => setShowForm(false)}
            onSubmit={async (data) => {
              clearError();
              await save(data);
              setShowForm(false);
            }}
            isSaving={isSaving}
            error={saveError}
          />
        )}
      </div>
    );
  }

  if (!activeLot) return null;

  const { level: ctrlLvl, daysLeft: ctrlDays } = validityLevel(activeLot.validadeControle);

  async function handleDecision(decision: CoagStatus) {
    if (!activeLot || !user) return;
    if (
      !confirm(
        `Confirmar decisão "${decision}" para o lote ${activeLot.loteControle} (Nível ${activeLot.nivel})?`,
      )
    )
      return;
    try {
      await updateCoagLotDecision(activeLot.labId, activeLot.id, decision, user.uid);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao registrar decisão.');
    }
  }

  async function handleExport() {
    if (!activeLot) return;
    if (runs.length === 0) {
      alert('Nenhuma corrida para exportar.');
      return;
    }
    const filename = `FR036_Coag_Nivel${activeLot.nivel}_${activeLot.loteControle}`;
    exportCoagRunsToCSV(runs, filename);
  }

  async function handleDelete() {
    if (!activeLot || !user) return;
    try {
      await deleteCoagLot(
        activeLot.labId,
        activeLot.id,
        {
          nivel: activeLot.nivel,
          loteControle: activeLot.loteControle,
          runCount: activeLot.runCount,
          validadeControle: activeLot.validadeControle,
        },
        user.uid,
      );
      setShowDelete(false);
      setActiveLotId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir lote.');
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Lot tabs ────────────────────────────────────────────────────── */}
      {lots.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {lots.map((l) => {
            const isActive = l.id === activeLot.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveLotId(l.id)}
                className={[
                  'px-3.5 py-2 rounded-xl border text-xs font-medium transition-all',
                  isActive
                    ? 'bg-rose-500/10 border-rose-500/35 text-rose-700 dark:text-rose-300'
                    : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-white/45 hover:border-slate-300 dark:hover:border-white/20',
                ].join(' ')}
              >
                Nível {l.nivel} · {l.loteControle}
                <span className="ml-2 font-mono text-[10px] opacity-60">
                  {l.runCount} run{l.runCount !== 1 ? 's' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              Coagulação · Nível {activeLot.nivel}
            </h1>
            <LotStatusBadge status={lotStatus} />
            {activeLot.coagDecision && <DecisionPill decision={activeLot.coagDecision} />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-white/45">
            <span className="font-mono">{activeLot.loteControle}</span>
            <span>·</span>
            <span>{activeLot.fabricanteControle}</span>
            <ValidityBadge isoDate={activeLot.validadeControle} label="Controle" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-500/15"
          >
            <PlusIcon /> Nova corrida
          </button>

          <button
            type="button"
            onClick={() => setShowPrint(true)}
            disabled={runs.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/[0.09] text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-all"
          >
            <PrintIcon /> Imprimir
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={runs.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/[0.09] text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-all"
          >
            <DownloadIcon /> CSV
          </button>

          {canDecide && (
            <>
              <button
                type="button"
                onClick={() => handleDecision('A')}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border border-emerald-300 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all"
              >
                <CheckIcon /> Aprovar
              </button>
              <button
                type="button"
                onClick={() => handleDecision('Rejeitado')}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border border-red-300 dark:border-red-500/25 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              >
                <BanIcon /> Rejeitar
              </button>
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/[0.09] text-slate-500 dark:text-white/55 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all"
              >
                <EditIcon /> Editar
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border border-red-300/50 dark:border-red-500/25 text-red-500 dark:text-red-400/90 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              >
                <TrashIcon /> Excluir
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Banners de validade ─────────────────────────────────────────── */}
      {ctrlLvl !== 'ok' && (
        <div
          className={[
            'rounded-xl px-4 py-3 border text-sm',
            ctrlLvl === 'expired'
              ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-400'
              : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-400',
          ].join(' ')}
        >
          ⚠{' '}
          {ctrlLvl === 'expired'
            ? `Lote de controle EXPIRADO há ${Math.abs(ctrlDays)} dia${Math.abs(ctrlDays) !== 1 ? 's' : ''}. Novas corridas serão automaticamente reprovadas.`
            : `Lote de controle vence em ${ctrlDays} dia${ctrlDays !== 1 ? 's' : ''}. Programar substituição.`}
        </div>
      )}
      {lotAlerts.includes('validade_30d') && ctrlLvl === 'ok' && (
        <div className="rounded-xl px-4 py-3 border text-sm bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-400">
          ⚠ Validade do controle em menos de 30 dias — programar próximo lote.
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <CoagulacaoIndicadores runs={runs} lotStatus={lotStatus} />

      {/* ── Analyte tabs + Chart ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {COAG_ANALYTE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedAnalyte(id)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  selectedAnalyte === id
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    : 'text-slate-500 dark:text-white/45 hover:text-slate-800 dark:hover:text-white/80 border border-transparent hover:border-slate-200 dark:hover:border-white/[0.08]',
                ].join(' ')}
              >
                {COAG_ANALYTES[id].label}
              </button>
            ))}
          </div>
        </div>
        <LeveyJenningsChart chartData={chartData} analyte={chartAnalyte} />
      </section>

      {/* ── Runs table ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
            Corridas do lote
          </p>
          <p className="text-[11px] text-slate-400 dark:text-white/25">
            {runs.length} registro{runs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {runsLoading ? (
          <div className="py-12 flex justify-center items-center text-sm text-slate-400 dark:text-white/30 gap-2">
            <SpinnerIcon /> Carregando corridas…
          </div>
        ) : runs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 dark:text-white/30 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08]">
            Nenhuma corrida registrada neste lote.
          </div>
        ) : (
          <RunsTable
            runs={[...runs].sort((a, b) => b.dataRealizacao.localeCompare(a.dataRealizacao))}
            onQR={(id) => setQrRunId(id)}
          />
        )}
      </section>

      {/* ── Nova corrida Modal ──────────────────────────────────────────── */}
      {showForm && (
        <NovaRunModal
          onClose={() => setShowForm(false)}
          onSubmit={async (data) => {
            clearError();
            await save(data);
            setShowForm(false);
          }}
          isSaving={isSaving}
          error={saveError}
          initialNivel={activeLot.nivel}
        />
      )}

      {/* ── Print modal ─────────────────────────────────────────────────── */}
      {showPrint && (
        <CoagulacaoRelatorioPrint
          lot={activeLot}
          runs={runs}
          lotStatus={lotStatus}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* ── Edit lot modal ──────────────────────────────────────────────── */}
      {showEdit && canDecide && (
        <EditLotModal
          lot={activeLot}
          onClose={() => setShowEdit(false)}
          onSave={async (fields, prev) => {
            if (!user) return;
            await updateCoagLotMeta(activeLot.labId, activeLot.id, fields, user.uid, prev);
            setShowEdit(false);
          }}
        />
      )}

      {/* ── Delete confirm modal ────────────────────────────────────────── */}
      {showDelete && canDecide && (
        <DeleteLotModal
          lot={activeLot}
          runCount={runs.length}
          onCancel={() => setShowDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      {/* ── QR modal ────────────────────────────────────────────────────── */}
      {qrRunId &&
        (() => {
          const r = runs.find((x) => x.id === qrRunId);
          if (!r) return null;
          return <QRModal run={r} lotId={activeLot.id} onClose={() => setQrRunId(null)} />;
        })()}
    </div>
  );
}

// ─── DecisionPill ─────────────────────────────────────────────────────────────

function DecisionPill({ decision }: { decision: CoagStatus }) {
  const cfg =
    decision === 'A'
      ? {
          label: 'Aceitável',
          cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25',
        }
      : decision === 'NA'
        ? {
            label: 'Não aceitável',
            cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25',
          }
        : {
            label: 'Rejeitado',
            cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25',
          };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}
    >
      Decisão: {cfg.label}
    </span>
  );
}

// ─── RunsTable ────────────────────────────────────────────────────────────────

function RunsTable({ runs, onQR }: { runs: CoagulacaoRun[]; onQR: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.06]">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400 dark:text-white/35">
          <tr>
            <th className="text-left px-3.5 py-2.5 font-semibold">Código</th>
            <th className="text-left px-3 py-2.5 font-semibold">Data</th>
            <th className="text-right px-3 py-2.5 font-semibold">AP (%)</th>
            <th className="text-right px-3 py-2.5 font-semibold">RNI</th>
            <th className="text-right px-3 py-2.5 font-semibold">TTPA (s)</th>
            <th className="text-left px-3 py-2.5 font-semibold">Conf.</th>
            <th className="text-left px-3 py-2.5 font-semibold">Violações</th>
            <th className="text-left px-3 py-2.5 font-semibold">NOTIVISA</th>
            <th className="text-center px-3 py-2.5 font-semibold">QR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
          {runs.map((r) => {
            const conformeCls =
              r.conformidade === 'A'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400';
            const notivisa = r.conformidade === 'R' ? (r.notivisaStatus ?? 'pendente') : '—';
            const notivisaCls =
              notivisa === 'pendente'
                ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/25'
                : notivisa === 'notificado'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/25'
                  : notivisa === 'dispensado'
                    ? 'bg-slate-200 dark:bg-white/[0.08] text-slate-600 dark:text-white/55 border-slate-300 dark:border-white/[0.12]'
                    : '';
            return (
              <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                <td className="px-3.5 py-2.5 font-mono text-xs text-slate-500 dark:text-white/50">
                  {r.runCode ?? r.id.slice(0, 6)}
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-white/70">
                  {fmtDateBR(r.dataRealizacao)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-white/80">
                  {r.resultados.atividadeProtrombinica}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-white/80">
                  {r.resultados.rni.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-white/80">
                  {r.resultados.ttpa.toFixed(1)}
                </td>
                <td className={`px-3 py-2.5 font-semibold ${conformeCls}`}>
                  {r.conformidade === 'A' ? 'A' : 'R'}
                </td>
                <td className="px-3 py-2.5">
                  {(r.westgardViolations ?? []).length === 0 ? (
                    <span className="text-slate-300 dark:text-white/20 text-xs">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(r.westgardViolations ?? []).map((v) => (
                        <span
                          key={v}
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {notivisa === '—' ? (
                    <span className="text-slate-300 dark:text-white/20 text-xs">—</span>
                  ) : (
                    <span
                      className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${notivisaCls}`}
                    >
                      {notivisa}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {r.logicalSignature && (
                    <button
                      type="button"
                      onClick={() => onQR(r.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 dark:text-white/35 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Ver QR de auditoria"
                    >
                      <QRIcon />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`${wide ? 'max-w-3xl' : 'max-w-lg'} w-full max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] shadow-2xl`}
      >
        <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] sticky top-0 bg-white dark:bg-[#0F1318] z-10">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-white/30 hover:text-slate-800 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
            aria-label="Fechar"
          >
            <XIcon />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function NovaRunModal({
  onClose,
  onSubmit,
  isSaving,
  error,
  initialNivel,
}: {
  onClose: () => void;
  onSubmit: (data: CoagulacaoFormData) => Promise<void>;
  isSaving: boolean;
  error: string | null;
  initialNivel?: CoagNivel;
}) {
  return (
    <ModalShell
      title="Nova corrida — Coagulação"
      subtitle="Clotimer Duo · AP + RNI + TTPA"
      onClose={onClose}
      wide
    >
      {error && (
        <div className="mb-4 px-3.5 py-2.5 rounded-xl border text-xs bg-red-500/[0.07] border-red-400/25 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      <CoagulacaoForm
        onSave={onSubmit}
        isSaving={isSaving}
        onCancel={onClose}
        initialNivel={initialNivel}
      />
    </ModalShell>
  );
}

function EditLotModal({
  lot,
  onClose,
  onSave,
}: {
  lot: CoagulacaoLot;
  onClose: () => void;
  onSave: (
    fields: Partial<Pick<CoagulacaoLot, 'aberturaControle' | 'validadeControle'>>,
    prev: Partial<Pick<CoagulacaoLot, 'aberturaControle' | 'validadeControle'>>,
  ) => Promise<void>;
}) {
  const [abertura, setAbertura] = useState(lot.aberturaControle);
  const [validade, setValidade] = useState(lot.validadeControle);
  const [saving, setSaving] = useState(false);

  const dirty = abertura !== lot.aberturaControle || validade !== lot.validadeControle;

  async function submit() {
    setSaving(true);
    try {
      const prev = {
        aberturaControle: lot.aberturaControle,
        validadeControle: lot.validadeControle,
      };
      const fields = { aberturaControle: abertura, validadeControle: validade };
      await onSave(fields, prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Editar lote" subtitle="Alterações são auditadas" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5">
            Abertura
          </label>
          <input
            type="date"
            value={abertura}
            onChange={(e) => setAbertura(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5">
            Validade
          </label>
          <input
            type="date"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-sm"
          />
        </div>
      </div>
      <div className="mt-6 flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 h-9 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!dirty || saving}
          className="px-4 h-9 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteLotModal({
  lot,
  runCount,
  onCancel,
  onConfirm,
}: {
  lot: CoagulacaoLot;
  runCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const guard = `EXCLUIR ${lot.loteControle}`;

  async function submit() {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ModalShell title="Excluir lote?" subtitle="Ação irreversível — auditada" onClose={onCancel}>
      <div className="space-y-4">
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] text-red-700 dark:text-red-400 px-4 py-3 text-xs">
          Esta ação exclui o lote{' '}
          <span className="font-mono font-semibold">{lot.loteControle}</span> (Nível {lot.nivel}) e
          todas as suas <strong>{runCount}</strong> corrida{runCount !== 1 ? 's' : ''}. Um registro
          de auditoria é preservado em nível-lab.
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5">
            Digite <span className="font-mono">{guard}</span> para confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-sm font-mono"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 h-9 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={confirmText !== guard || deleting}
            className="px-4 h-9 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-40"
          >
            {deleting ? 'Excluindo…' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function QRModal({
  run,
  lotId,
  onClose,
}: {
  run: CoagulacaoRun;
  lotId: string;
  onClose: () => void;
}) {
  return (
    <ModalShell title={`Corrida ${run.runCode}`} subtitle="Código de auditoria" onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <CoagAuditor run={run} lotId={lotId} size={180} />
        <div className="text-center space-y-1">
          <p className="text-xs text-slate-500 dark:text-white/45">
            Escaneie o QR para abrir o registro de auditoria imutável.
          </p>
          <p className="text-[10px] font-mono text-slate-400 dark:text-white/30 break-all">
            {run.logicalSignature}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
