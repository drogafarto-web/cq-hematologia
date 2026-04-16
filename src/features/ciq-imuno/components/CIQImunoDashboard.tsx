import React, { useState } from 'react';
import { useAppStore }    from '../../../store/useAppStore';
import { useUser, useUserRole, useIsSuperAdmin } from '../../../store/useAuthStore';
import { useAuthFlow }    from '../../auth/hooks/useAuthFlow';
import { useCIQLots }     from '../hooks/useCIQLots';
import { useCIQRuns }     from '../hooks/useCIQRuns';
import { useSaveCIQRun }  from '../hooks/useSaveCIQRun';
import { useCIQWestgard } from '../hooks/useCIQWestgard';
import { CIQImunoForm }      from './CIQImunoForm';
import { CIQAuditor }        from './CIQAuditor';
import { CIQIndicadores }    from './CIQIndicadores';
import { CIQRelatorioPrint } from './CIQRelatorioPrint';
import { exportRunsToCSV }                          from '../services/ciqExportService';
import { updateLotDecision, updateLotMeta, deleteCIQLot } from '../services/ciqFirebaseService';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';
import type { CIQLotStatus, CIQStatus } from '../types/_shared_refs';

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

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 5V1h8v4M3 10H1V5h12v5h-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8h8v5H3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.1 3.1l7.8 7.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M9 2l2 2-7 7H2v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M2 3.5h9M4.5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5 6v4M8 6v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3.5l.5 7a.5.5 0 00.5.5h5a.5.5 0 00.5-.5l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
  canManage,
  onSelect,
  onEdit,
  onDelete,
}: {
  lot:       CIQImunoLot;
  isActive:  boolean;
  canManage: boolean;
  onSelect:  () => void;
  onEdit:    () => void;
  onDelete:  () => void;
}) {
  return (
    <div className={[
      'group relative w-full px-4 py-3 rounded-xl border transition-all',
      isActive
        ? 'bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/25'
        : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.07]',
      'hover:border-emerald-500/40 dark:hover:border-emerald-500/30',
    ].join(' ')}>

      {/* Full-card select button — below action buttons in stacking order */}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Selecionar lote ${lot.testType}`}
        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2
                   focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
      />

      {/* Card content — pointer-events-none so clicks fall through to the button above */}
      <div className="relative pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-white/85 truncate">
              {lot.testType}
            </p>
            <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5 truncate">
              {lot.loteControle}
            </p>
          </div>

          {/* Badge — hidden on hover when actions are available */}
          <div className={canManage ? 'group-hover:hidden' : ''}>
            <LotStatusBadge status={lot.lotStatus} />
          </div>
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
      </div>

      {/* Action buttons — pointer-events-auto, sit above the select button */}
      {canManage && (
        <div className="absolute top-2.5 right-3 hidden group-hover:flex items-center gap-1 pointer-events-auto">
          <button
            type="button"
            aria-label="Editar lote"
            onClick={onEdit}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30
                       hover:text-slate-700 dark:hover:text-white/70
                       hover:bg-slate-100 dark:hover:bg-white/[0.07]
                       transition-all"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            aria-label="Excluir lote"
            onClick={onDelete}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30
                       hover:text-red-500 dark:hover:text-red-400
                       hover:bg-red-500/[0.08] dark:hover:bg-red-500/[0.1]
                       transition-all"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
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
      <td className="py-3 pr-4 text-xs font-mono text-slate-400 dark:text-white/35 hidden md:table-cell">
        {run.runCode ?? '—'}
      </td>
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
      {/* Aprovação — campo explícito separado do resultado */}
      <td className="py-3 pr-4">
        <span className={[
          'inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border',
          conforme
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        ].join(' ')}>
          {conforme ? 'A' : 'NA'}
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
                     min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30
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

// ─── Edit Lot Form ────────────────────────────────────────────────────────────

function EditLotForm({
  lot,
  isSaving,
  error,
  onSave,
  onCancel,
}: {
  lot:      CIQImunoLot;
  isSaving: boolean;
  error:    string | null;
  onSave:   (fields: { aberturaControle: string; validadeControle: string }) => void;
  onCancel: () => void;
}) {
  const [abertura,  setAbertura]  = useState(lot.aberturaControle);
  const [validade,  setValidade]  = useState(lot.validadeControle);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ aberturaControle: abertura, validadeControle: validade });
  }

  const inputCls = [
    'w-full px-3 py-2 rounded-xl text-sm',
    'bg-slate-50 dark:bg-white/[0.04]',
    'border border-slate-200 dark:border-white/[0.1]',
    'text-slate-800 dark:text-white/85',
    'focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
    'transition-all',
  ].join(' ');

  const labelCls = 'block text-xs font-medium text-slate-500 dark:text-white/40 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Read-only identifiers */}
      <div className="rounded-xl border border-slate-100 dark:border-white/[0.07]
                      bg-slate-50 dark:bg-white/[0.02] px-4 py-3 space-y-1">
        <Row label="Teste"         value={lot.testType} />
        <Row label="Lote controle" value={lot.loteControle} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-abertura" className={labelCls}>Data de abertura</label>
          <input
            id="edit-abertura"
            type="date"
            value={abertura}
            onChange={(e) => setAbertura(e.target.value)}
            required
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="edit-validade" className={labelCls}>Data de validade</label>
          <input
            id="edit-validade"
            type="date"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
            required
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 rounded-xl text-sm text-slate-500 dark:text-white/50
                     border border-slate-200 dark:border-white/[0.1]
                     hover:text-slate-800 dark:hover:text-white/80
                     hover:border-slate-300 dark:hover:border-white/[0.2]
                     disabled:opacity-40 transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                     bg-emerald-500 hover:bg-emerald-400 text-white
                     disabled:opacity-40 transition-colors"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Salvando…
            </>
          ) : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function CIQImunoDashboard() {
  const setCurrentView  = useAppStore((s) => s.setCurrentView);
  const user            = useUser();
  const role            = useUserRole();
  const isSuperAdmin    = useIsSuperAdmin();
  const { signOut }     = useAuthFlow();

  // Somente owner/admin/superAdmin podem emitir decisão formal de lote
  const canDecide = isSuperAdmin || role === 'owner' || role === 'admin';

  // ── Data ───────────────────────────────────────────────────────────────────
  const { lots, isLoading: lotsLoading } = useCIQLots();
  const [activeLotId, setActiveLotId]    = useState<string | null>(null);
  const activeLot = lots.find((l) => l.id === activeLotId) ?? lots[0] ?? null;

  const { runs, isLoading: runsLoading } = useCIQRuns(activeLot?.id ?? null);
  const { save, isSaving }               = useSaveCIQRun();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showForm,    setShowForm]    = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [qrRun,       setQRRun]       = useState<CIQImunoRun | null>(null);
  const [exportErr,   setExportErr]   = useState<string | null>(null);
  const [decidingLot,  setDecidingLot]  = useState(false);
  const [decisionErr,  setDecisionErr]  = useState<string | null>(null);
  const [showPrint,    setShowPrint]    = useState(false);

  // ── Lot management state ─────────────────────────────────────────────────────
  const [editingLot,    setEditingLot]    = useState<CIQImunoLot | null>(null);
  const [isSavingLot,   setIsSavingLot]   = useState(false);
  const [saveLotErr,    setSaveLotErr]    = useState<string | null>(null);
  const [deletingLot,   setDeletingLot]   = useState<CIQImunoLot | null>(null);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const [deleteErr,     setDeleteErr]     = useState<string | null>(null);

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

  async function handleLotDecision(decision: CIQStatus) {
    if (!activeLot || !user) return;
    setDecisionErr(null);
    setDecidingLot(true);
    try {
      await updateLotDecision(activeLot.labId, activeLot.id, decision, user.uid);
    } catch (err) {
      setDecisionErr(err instanceof Error ? err.message : 'Erro ao registrar decisão.');
    } finally {
      setDecidingLot(false);
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

  async function handleEditLotSave(fields: { aberturaControle: string; validadeControle: string }) {
    if (!editingLot || !user) return;
    setSaveLotErr(null);
    setIsSavingLot(true);
    try {
      await updateLotMeta(
        editingLot.labId,
        editingLot.id,
        fields,
        user.uid,
        { aberturaControle: editingLot.aberturaControle, validadeControle: editingLot.validadeControle },
      );
      setEditingLot(null);
    } catch (err) {
      setSaveLotErr(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setIsSavingLot(false);
    }
  }

  async function handleDeleteLot() {
    if (!deletingLot || !user) return;
    setDeleteErr(null);
    setIsDeleting(true);
    try {
      await deleteCIQLot(
        deletingLot.labId,
        deletingLot.id,
        {
          testType:         deletingLot.testType,
          loteControle:     deletingLot.loteControle,
          runCount:         deletingLot.runCount,
          validadeControle: deletingLot.validadeControle,
        },
        user.uid,
      );
      if (activeLotId === deletingLot.id) setActiveLotId(null);
      setDeletingLot(null);
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : 'Erro ao excluir.');
    } finally {
      setIsDeleting(false);
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
                             border border-emerald-500/20 hidden sm:inline-flex">
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
            <button
              type="button"
              onClick={signOut}
              aria-label="Sair do sistema"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         border border-slate-200 dark:border-white/[0.1]
                         text-xs text-slate-500 dark:text-white/40
                         hover:text-slate-800 dark:hover:text-white/70
                         hover:border-slate-300 dark:hover:border-white/[0.2]
                         transition-all"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">Sair</span>
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
                  canManage={canDecide}
                  onSelect={() => setActiveLotId(lot.id)}
                  onEdit={() => { setSaveLotErr(null); setEditingLot(lot); }}
                  onDelete={() => { setDeleteErr(null); setDeletingLot(lot); }}
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

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* Decisão formal — apenas owner/admin/superAdmin */}
                    {canDecide && runs.length > 0 && activeLot.ciqDecision !== 'A' && (
                      <button
                        type="button"
                        onClick={() => handleLotDecision('A')}
                        disabled={decidingLot}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                   bg-emerald-500/10 border border-emerald-500/30
                                   text-xs text-emerald-600 dark:text-emerald-400
                                   hover:bg-emerald-500/20 disabled:opacity-40 transition-all"
                      >
                        <CheckIcon />
                        Aprovar lote
                      </button>
                    )}
                    {canDecide && runs.length > 0 && activeLot.ciqDecision !== 'Rejeitado' && (
                      <button
                        type="button"
                        onClick={() => handleLotDecision('Rejeitado')}
                        disabled={decidingLot}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                   bg-red-500/[0.07] border border-red-400/25
                                   text-xs text-red-600 dark:text-red-400
                                   hover:bg-red-500/[0.15] disabled:opacity-40 transition-all"
                      >
                        <BanIcon />
                        Reprovar lote
                      </button>
                    )}
                    {runs.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowPrint(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                     border border-slate-200 dark:border-white/[0.1]
                                     text-xs text-slate-500 dark:text-white/50
                                     hover:text-slate-800 dark:hover:text-white/80
                                     hover:border-slate-300 dark:hover:border-white/[0.2]
                                     transition-all"
                        >
                          <PrintIcon />
                          Relatório PDF
                        </button>
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
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Operational indicators */}
              {runs.length > 0 && activeLot && (
                <CIQIndicadores runs={runs} lotStatus={activeLot.lotStatus} />
              )}

              {/* Decision / export errors */}
              {decisionErr && (
                <p className="text-xs text-red-500 dark:text-red-400">{decisionErr}</p>
              )}
              {exportErr && (
                <p className="text-xs text-red-500 dark:text-red-400">{exportErr}</p>
              )}

              {/* Formal decision badge */}
              {activeLot?.ciqDecision && (
                <div className={[
                  'flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs',
                  activeLot.ciqDecision === 'A'
                    ? 'bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/[0.06] border-red-400/20 text-red-600 dark:text-red-400',
                ].join(' ')}>
                  <span className="font-semibold">
                    Decisão formal: {activeLot.ciqDecision === 'A' ? 'Aprovado' : 'Reprovado'}
                  </span>
                  {activeLot.decisionBy && (
                    <span className="opacity-60">· RT registrado</span>
                  )}
                </div>
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
                        {[
                          { label: 'Código',     className: 'hidden md:table-cell' },
                          { label: 'Data',       className: '' },
                          { label: 'Resultado',  className: '' },
                          { label: 'Aprovação',  className: '' },
                          { label: 'Westgard',   className: '' },
                          { label: 'Assinatura', className: '' },
                          { label: '',           className: '' },
                        ].map((h) => (
                          <th key={h.label} className={[
                            'px-0 pr-4 py-2.5 pl-4 first:pl-5 text-left',
                            'text-[11px] font-semibold uppercase tracking-wider',
                            'text-slate-400 dark:text-white/30',
                            h.className,
                          ].join(' ')}>
                            {h.label}
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

      {/* ── Relatório PDF (print layout) ────────────────────────────────────── */}
      {showPrint && activeLot && (
        <CIQRelatorioPrint
          lot={activeLot}
          runs={runs}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* ── Modal: Editar Lote ──────────────────────────────────────────────── */}
      {editingLot && (
        <Modal title="Editar lote" onClose={() => setEditingLot(null)}>
          <EditLotForm
            lot={editingLot}
            isSaving={isSavingLot}
            error={saveLotErr}
            onSave={handleEditLotSave}
            onCancel={() => setEditingLot(null)}
          />
        </Modal>
      )}

      {/* ── Modal: Confirmar Exclusão ────────────────────────────────────────── */}
      {deletingLot && (
        <Modal title="Excluir lote" onClose={() => !isDeleting && setDeletingLot(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                Esta operação é irreversível
              </p>
              <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                O lote <span className="font-medium text-slate-700 dark:text-white/70">{deletingLot.testType}</span>{' '}
                ({deletingLot.loteControle}) e todas as suas{' '}
                <span className="font-medium text-slate-700 dark:text-white/70">{deletingLot.runCount} corrida{deletingLot.runCount !== 1 ? 's' : ''}</span>{' '}
                serão excluídos permanentemente. A exclusão será registrada no audit trail do sistema.
              </p>
            </div>

            {deleteErr && (
              <p className="text-xs text-red-500 dark:text-red-400">{deleteErr}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingLot(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm text-slate-500 dark:text-white/50
                           border border-slate-200 dark:border-white/[0.1]
                           hover:text-slate-800 dark:hover:text-white/80
                           hover:border-slate-300 dark:hover:border-white/[0.2]
                           disabled:opacity-40 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteLot}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                           bg-red-500 hover:bg-red-400 text-white
                           disabled:opacity-40 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Excluindo…
                  </>
                ) : (
                  <>
                    <TrashIcon />
                    Excluir lote
                  </>
                )}
              </button>
            </div>
          </div>
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
