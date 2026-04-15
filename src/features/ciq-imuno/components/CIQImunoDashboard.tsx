import React, { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useCIQLots }  from '../hooks/useCIQLots';
import { useCIQRuns }  from '../hooks/useCIQRuns';
import { useSaveCIQRun } from '../hooks/useSaveCIQRun';
import { useCIQWestgard } from '../hooks/useCIQWestgard';
import { CIQImunoForm }  from './CIQImunoForm';
import { CIQAuditor }    from './CIQAuditor';
import { exportRunsToCSV } from '../services/ciqExportService';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';
import type { CIQLotStatus } from '../types/_shared_refs';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13 8H3M6 5L3 8l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImunoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function QRIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2.5" y="2.5" width="2" height="2" fill="currentColor" />
      <rect x="9.5" y="2.5" width="2" height="2" fill="currentColor" />
      <rect x="2.5" y="9.5" width="2" height="2" fill="currentColor" />
      <path d="M8 8h1.5v1.5H8zM9.5 9.5H11v1.5H9.5zM11 8h1.5v1.5H11zM8 11h1.5v1.5H8zM11 11h1.5v1.5H11z"
            fill="currentColor" />
    </svg>
  );
}

// ─── Lot Status Badge ─────────────────────────────────────────────────────────

const LOT_STATUS_CONFIG: Record<CIQLotStatus, { label: string; className: string }> = {
  sem_dados: {
    label:     'Sem dados',
    className: 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-white/40 border-slate-200 dark:border-white/[0.08]',
  },
  valido: {
    label:     'Válido',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  atencao: {
    label:     'Atenção',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  reprovado: {
    label:     'Reprovado',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
};

function LotStatusBadge({ status }: { status: CIQLotStatus }) {
  const { label, className } = LOT_STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyLots({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20
                      flex items-center justify-center text-emerald-400">
        <ImunoIcon size={24} />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-slate-700 dark:text-white/70">Nenhum lote registrado</p>
        <p className="text-sm text-slate-400 dark:text-white/30">
          Registre a primeira corrida para criar um lote de controle.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400
                   text-white text-sm font-medium transition-colors"
      >
        <PlusIcon />
        Nova corrida
      </button>
    </div>
  );
}

function EmptyRuns({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <p className="text-sm text-slate-400 dark:text-white/30">
        Nenhuma corrida registrada neste lote.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.1]
                   text-sm text-slate-500 dark:text-white/50
                   hover:text-slate-800 dark:hover:text-white/80
                   hover:border-slate-300 dark:hover:border-white/[0.2]
                   transition-all"
      >
        <PlusIcon />
        Registrar corrida
      </button>
    </div>
  );
}

// ─── Lot Card ─────────────────────────────────────────────────────────────────

function LotCard({
  lot,
  isActive,
  onSelect,
}: {
  lot:      CIQImunoLot;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left px-4 py-3 rounded-xl border transition-all',
        isActive
          ? 'bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/25'
          : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.07]',
        'hover:border-emerald-500/40 dark:hover:border-emerald-500/30',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-white/85 truncate">
            {lot.testType}
          </p>
          <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5 truncate">
            {lot.loteControle}
          </p>
        </div>
        <LotStatusBadge status={lot.lotStatus} />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[11px] text-slate-400 dark:text-white/30">
          {lot.runCount} corrida{lot.runCount !== 1 ? 's' : ''}
        </span>
        <span className="text-[11px] text-slate-300 dark:text-white/15">·</span>
        <span className="text-[11px] text-slate-400 dark:text-white/30">
          Val. {lot.validadeControle}
        </span>
      </div>
    </button>
  );
}

// ─── Run Row ──────────────────────────────────────────────────────────────────

function RunRow({
  run,
  lotId,
  onShowQR,
}: {
  run:     CIQImunoRun;
  lotId:   string;
  onShowQR: (run: CIQImunoRun) => void;
}) {
  const conforme = run.resultadoObtido === run.resultadoEsperado;
  const hasAlerts = (run.westgardCategorico?.length ?? 0) > 0;

  return (
    <tr className="border-t border-slate-100 dark:border-white/[0.05] group">
      <td className="py-3 pr-4 text-sm text-slate-700 dark:text-white/70">
        {run.dataRealizacao}
      </td>
      <td className="py-3 pr-4">
        <span className={[
          'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
          conforme
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        ].join(' ')}>
          {run.resultadoObtido === 'R' ? 'R' : 'NR'}
          {!conforme && <span className="opacity-70">(!)</span>}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs text-slate-500 dark:text-white/40">
        {hasAlerts ? (
          <span className="text-amber-500 dark:text-amber-400">
            {run.westgardCategorico!.length} alerta{run.westgardCategorico!.length !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-emerald-500 dark:text-emerald-400">—</span>
        )}
      </td>
      <td className="py-3 pr-4 text-xs text-slate-400 dark:text-white/30 font-mono hidden sm:table-cell">
        {run.logicalSignature ? `${run.logicalSignature.slice(0, 8)}…` : '—'}
      </td>
      <td className="py-3 text-right">
        <button
          type="button"
          onClick={() => onShowQR(run)}
          aria-label="Ver QR Code de auditoria"
          className="opacity-0 group-hover:opacity-100 transition-opacity
                     p-1.5 rounded-lg text-slate-400 dark:text-white/30
                     hover:text-slate-700 dark:hover:text-white/70
                     hover:bg-slate-100 dark:hover:bg-white/[0.05]"
        >
          <QRIcon />
        </button>
      </td>
    </tr>
  );
}

// ─── Westgard Alerts Panel ────────────────────────────────────────────────────

const ALERT_LABELS: Record<string, string> = {
  taxa_falha_10pct: 'Taxa de falha >10% no lote',
  consecutivos_3nr: '3+ NR consecutivos',
  consecutivos_4nr: '4+ NR nos últimos 10 runs',
  lote_expirado:    'Lote de controle expirado',
  validade_30d:     'Controle vence em menos de 30 dias',
};

function WestgardAlertsPanel({ runs }: { runs: CIQImunoRun[] }) {
  const { alerts, lotStatus } = useCIQWestgard(runs);
  if (alerts.length === 0 || lotStatus === 'sem_dados' || lotStatus === 'valido') return null;

  return (
    <div className={[
      'rounded-xl border px-4 py-3 space-y-2',
      lotStatus === 'reprovado'
        ? 'bg-red-500/[0.06] border-red-400/20'
        : 'bg-amber-500/[0.06] border-amber-500/20',
    ].join(' ')}>
      <p className={`text-xs font-semibold ${lotStatus === 'reprovado' ? 'text-red-500 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
        {lotStatus === 'reprovado' ? '✕ Lote Reprovado (RDC 978/2025)' : '⚠ Alertas de Qualidade'}
      </p>
      <ul className="space-y-1">
        {alerts.map((a) => (
          <li key={a} className="text-xs text-slate-600 dark:text-white/55 flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-amber-400">›</span>
            {ALERT_LABELS[a] ?? a}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title:    string;
  onClose:  () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 my-8 mx-4 w-full max-w-lg
                      bg-white dark:bg-[#111] rounded-2xl shadow-2xl
                      border border-slate-200 dark:border-white/[0.08]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4
                        border-b border-slate-100 dark:border-white/[0.06]">
          <p className="font-semibold text-slate-800 dark:text-white/85">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-slate-400 dark:text-white/30
                       hover:text-slate-700 dark:hover:text-white/70
                       hover:bg-slate-100 dark:hover:bg-white/[0.05]
                       transition-all"
          >
            <XIcon />
          </button>
        </div>
        {/* Content */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function CIQImunoDashboard() {
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { lots, isLoading: lotsLoading } = useCIQLots();
  const [activeLotId, setActiveLotId]    = useState<string | null>(null);
  const activeLot = lots.find((l) => l.id === activeLotId) ?? lots[0] ?? null;

  const { runs, isLoading: runsLoading } = useCIQRuns(activeLot?.id ?? null);
  const { save, isSaving }               = useSaveCIQRun();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showForm,  setShowForm]  = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [qrRun,     setQRRun]     = useState<CIQImunoRun | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSave(data: CIQImunoFormData) {
    setFormError(null);
    try {
      const { lotId } = await save(data);
      setActiveLotId(lotId);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar corrida.');
    }
  }

  function handleExportCSV() {
    setExportErr(null);
    try {
      const filename = activeLot
        ? `FR036_${activeLot.testType}_${activeLot.loteControle}`.replace(/\s+/g, '_')
        : 'FR036_CIQ_Imuno';
      exportRunsToCSV(runs, filename);
    } catch (err) {
      setExportErr(err instanceof Error ? err.message : 'Erro ao exportar.');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] text-slate-900 dark:text-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 dark:border-white/[0.06]
                         bg-white dark:bg-white/[0.02] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">

          <button
            type="button"
            onClick={() => setCurrentView('hub')}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/40
                       hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label="Voltar ao hub"
          >
            <ArrowLeft />
            Hub
          </button>

          <span className="text-slate-300 dark:text-white/10 select-none">/</span>

          <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
            <ImunoIcon />
            <span className="text-sm font-medium">CIQ-Imuno</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full
                             bg-emerald-500/10 text-emerald-600 dark:text-emerald-400
                             border border-emerald-500/20">
              RDC 978/2025
            </span>
            <button
              type="button"
              onClick={() => { setFormError(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium
                         transition-colors"
            >
              <PlusIcon />
              Nova corrida
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {lotsLoading ? (
        <div className="flex items-center justify-center py-32">
          <svg className="animate-spin w-5 h-5 text-slate-300 dark:text-white/20"
               viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      ) : lots.length === 0 ? (
        <EmptyLots onNew={() => { setFormError(null); setShowForm(true); }} />
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex gap-6 items-start">

            {/* ── Sidebar — lot list ──────────────────────────────────────── */}
            <aside className="w-64 shrink-0 space-y-2 sticky top-20">
              <p className="text-[11px] font-semibold uppercase tracking-wider
                            text-slate-400 dark:text-white/30 mb-3">
                Lotes
              </p>
              {lots.map((lot) => (
                <LotCard
                  key={lot.id}
                  lot={lot}
                  isActive={lot.id === (activeLot?.id ?? lots[0]?.id)}
                  onSelect={() => setActiveLotId(lot.id)}
                />
              ))}
            </aside>

            {/* ── Main — runs table ───────────────────────────────────────── */}
            <main className="flex-1 min-w-0 space-y-4">

              {/* Lot header */}
              {activeLot && (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-slate-800 dark:text-white/85">
                        {activeLot.testType}
                      </h2>
                      <LotStatusBadge status={activeLot.lotStatus} />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5">
                      {activeLot.loteControle} · Val. {activeLot.validadeControle}
                    </p>
                  </div>

                  {runs.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                   border border-slate-200 dark:border-white/[0.1]
                                   text-xs text-slate-500 dark:text-white/50
                                   hover:text-slate-800 dark:hover:text-white/80
                                   hover:border-slate-300 dark:hover:border-white/[0.2]
                                   transition-all"
                      >
                        <DownloadIcon />
                        FR-036 CSV
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Export error */}
              {exportErr && (
                <p className="text-xs text-red-500 dark:text-red-400">{exportErr}</p>
              )}

              {/* Westgard alerts */}
              {runs.length > 0 && <WestgardAlertsPanel runs={runs} />}

              {/* Runs table */}
              {runsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin w-4 h-4 text-slate-300 dark:text-white/20"
                       viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : runs.length === 0 ? (
                <EmptyRuns onNew={() => { setFormError(null); setShowForm(true); }} />
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-white/[0.07]
                                bg-white dark:bg-white/[0.02] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/[0.06]">
                        {['Data', 'Resultado', 'Westgard', 'Assinatura', ''].map((h) => (
                          <th key={h} className="px-0 pr-4 py-2.5 pl-4 first:pl-5 text-left
                                                  text-[11px] font-semibold uppercase tracking-wider
                                                  text-slate-400 dark:text-white/30">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y-0">
                      {[...runs].reverse().map((run) => (
                        <RunRow
                          key={run.id}
                          run={run}
                          lotId={activeLot!.id}
                          onShowQR={setQRRun}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {/* ── Modal: Nova Corrida ──────────────────────────────────────────────── */}
      {showForm && (
        <Modal title="Registrar Corrida" onClose={() => setShowForm(false)}>
          {formError && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl
                            bg-red-500/[0.07] border border-red-400/20
                            text-xs text-red-500 dark:text-red-400">
              {formError}
            </div>
          )}
          <CIQImunoForm
            onSave={handleSave}
            isSaving={isSaving}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}

      {/* ── Modal: QR Code de Auditoria ──────────────────────────────────────── */}
      {qrRun && activeLot && (
        <Modal title="QR Code de Auditoria" onClose={() => setQRRun(null)}>
          <div className="flex flex-col items-center gap-4">
            <CIQAuditor run={qrRun} lotId={activeLot.id} size={160} />
            <div className="w-full rounded-xl border border-slate-100 dark:border-white/[0.07]
                            bg-slate-50 dark:bg-white/[0.03] p-4 space-y-2 text-xs">
              <Row label="Teste"       value={qrRun.testType} />
              <Row label="Data"        value={qrRun.dataRealizacao} />
              <Row label="Resultado"   value={qrRun.resultadoObtido === 'R' ? 'Reagente' : 'Não Reagente'} />
              <Row label="Operador"    value={qrRun.operatorName} />
              <Row label="Assinatura"  value={qrRun.logicalSignature ? `${qrRun.logicalSignature.slice(0, 16)}…` : '—'} mono />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Micro helper ─────────────────────────────────────────────────────────────

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400 dark:text-white/35 shrink-0">{label}</span>
      <span className={`text-slate-700 dark:text-white/70 text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
