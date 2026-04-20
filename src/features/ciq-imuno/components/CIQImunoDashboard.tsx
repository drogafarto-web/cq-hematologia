import React, { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useUser, useUserRole, useIsSuperAdmin } from '../../../store/useAuthStore';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { ThemeToggle } from '../../../shared/components/ui/ThemeToggle';
import { useCIQLots } from '../hooks/useCIQLots';
import { useCIQRuns } from '../hooks/useCIQRuns';
import { useSaveCIQRun } from '../hooks/useSaveCIQRun';
import { useCIQWestgard } from '../hooks/useCIQWestgard';
import { CIQImunoForm } from './CIQImunoForm';
import { CIQAuditor } from './CIQAuditor';
import { CIQIndicadores } from './CIQIndicadores';
import { CIQRelatorioPrint } from './CIQRelatorioPrint';
import { exportRunsToCSV } from '../services/ciqExportService';
import { updateLotDecision, updateLotMeta, deleteCIQLot } from '../services/ciqFirebaseService';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';
import type { CIQLotStatus, CIQStatus } from '../types/_shared_refs';

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M8 2L3 6.5 8 11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImunoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2v3M10 15v3M2 10h3M15 10h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}

function PlusIcon() {
  return (
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
}

function DownloadIcon() {
  return (
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
}

function XIcon() {
  return (
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
}

function PrintIcon() {
  return (
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
}

function CheckIcon() {
  return (
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
}

function BanIcon() {
  return (
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
}

function QRIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2.5" y="2.5" width="2" height="2" fill="currentColor" />
      <rect x="9.5" y="2.5" width="2" height="2" fill="currentColor" />
      <rect x="2.5" y="9.5" width="2" height="2" fill="currentColor" />
      <path
        d="M8 8h1.5v1.5H8zM9.5 9.5H11v1.5H9.5zM11 8h1.5v1.5H11zM8 11h1.5v1.5H8zM11 11h1.5v1.5H11z"
        fill="currentColor"
      />
    </svg>
  );
}

function EditIcon() {
  return (
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
}

function TrashIcon() {
  return (
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
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path
        d="M22 12a10 10 0 00-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Lot Status Badge — design system dot+text pattern ───────────────────────

const LOT_STATUS_CONFIG: Record<CIQLotStatus, { label: string; dot: string; cls: string }> = {
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

function LotStatusBadge({ status }: { status: CIQLotStatus }) {
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

// ─── Lot Card ─────────────────────────────────────────────────────────────────

function LotCard({
  lot,
  isActive,
  canManage,
  onSelect,
  onEdit,
  onDelete,
}: {
  lot: CIQImunoLot;
  isActive: boolean;
  canManage: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={[
        'group relative w-full px-4 py-3 rounded-xl border transition-all cursor-pointer',
        isActive
          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
          : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Selecionar lote ${lot.testType}`}
        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
      />
      <div className="relative pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-white/85 truncate">
              {lot.testType}
            </p>
            <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5 font-mono truncate">
              {lot.loteControle}
            </p>
          </div>
          <div className={canManage ? 'group-hover:hidden' : ''}>
            <LotStatusBadge status={lot.lotStatus} />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400 dark:text-white/30">
          <span>
            {lot.runCount} corrida{lot.runCount !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-200 dark:text-white/15">·</span>
          <span>Val. {lot.validadeControle}</span>
        </div>
      </div>
      {canManage && (
        <div className="absolute top-2.5 right-3 hidden group-hover:flex items-center gap-0.5 pointer-events-auto">
          <button
            type="button"
            aria-label="Editar lote"
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-all"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            aria-label="Excluir lote"
            onClick={onDelete}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── NOTIVISA badge state ─────────────────────────────────────────────────────

/**
 * Calcula o badge de notificação sanitária de uma corrida.
 * Retorna null quando a corrida é conforme (resultado esperado = obtido).
 *
 * Prazos RDC 551/2021: 72h para eventos graves, 30d para QT sem risco.
 */
function notivisaBadgeState(
  run: CIQImunoRun,
): { label: string; cls: string; tooltip: string } | null {
  const conforme = run.resultadoObtido === run.resultadoEsperado;
  if (conforme) return null;

  if (run.notivisaStatus === 'notificado') {
    return {
      label: `✓ ${run.notivisaProtocolo ?? 'notificado'}`,
      cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
      tooltip: `Notificado em ${run.notivisaDataEnvio ?? '—'} · protocolo ${run.notivisaProtocolo ?? '—'}`,
    };
  }
  if (run.notivisaStatus === 'dispensado') {
    return {
      label: 'Dispensado',
      cls: 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10',
      tooltip: run.notivisaJustificativa ?? 'Causa operacional documentada.',
    };
  }

  // Pendente ou não definido — calcular prazo a partir da data de realização
  const [y, m, d] = run.dataRealizacao.split('-').map(Number);
  const realizado = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const horasDesde = (hoje.getTime() - realizado) / (1000 * 60 * 60);

  if (horasDesde >= 24 * 30) {
    return {
      label: 'Prazo vencido',
      cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30',
      tooltip: 'Prazo regulatório de 30 dias excedido. Notifique o NOTIVISA imediatamente.',
    };
  }
  if (horasDesde >= 72) {
    return {
      label: 'Urgente 72h+',
      cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
      tooltip: 'Prazo de 72h (evento grave) excedido. Classifique e notifique.',
    };
  }
  return {
    label: 'Pendente',
    cls: 'bg-amber-50/60 dark:bg-amber-500/[0.07] text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
    tooltip: 'Não conformidade aberta. Investigar causa e decidir notificação.',
  };
}

// ─── Run Row ──────────────────────────────────────────────────────────────────

function RunRow({ run, onShowQR }: { run: CIQImunoRun; onShowQR: (r: CIQImunoRun) => void }) {
  const conforme = run.resultadoObtido === run.resultadoEsperado;
  const hasAlerts = (run.westgardCategorico?.length ?? 0) > 0;

  const resultCls = conforme
    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';

  const notivisa = notivisaBadgeState(run);

  return (
    <tr className="border-t border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
      <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500 hidden md:table-cell">
        {run.runCode ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 dark:text-white/70">{run.dataRealizacao}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${resultCls}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${conforme ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          {run.resultadoObtido === 'R' ? 'R' : 'NR'}
          {!conforme && <span className="opacity-60 text-[10px]">(!)</span>}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${resultCls}`}
        >
          {conforme ? 'A' : 'NA'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs">
        {hasAlerts ? (
          <span className="text-amber-600 dark:text-amber-400">
            {run.westgardCategorico!.length} alerta{run.westgardCategorico!.length !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-emerald-500 dark:text-emerald-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {notivisa ? (
          <span
            title={notivisa.tooltip}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${notivisa.cls}`}
          >
            {notivisa.label}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500 hidden sm:table-cell">
        {run.logicalSignature ? `${run.logicalSignature.slice(0, 8)}…` : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onShowQR(run)}
          aria-label="Ver QR Code de auditoria"
          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.05] ml-auto"
        >
          <QRIcon />
        </button>
      </td>
    </tr>
  );
}

// ─── Westgard Alerts ──────────────────────────────────────────────────────────

const ALERT_LABELS: Record<string, string> = {
  taxa_falha_10pct: 'Taxa de falha >10% no lote',
  consecutivos_3nr: '3+ NR consecutivos',
  consecutivos_4nr: '4+ NR nos últimos 10 runs',
  lote_expirado: 'Lote de controle expirado',
  validade_30d: 'Controle vence em menos de 30 dias',
};

function WestgardAlertsPanel({ runs }: { runs: CIQImunoRun[] }) {
  const { alerts, lotStatus } = useCIQWestgard(runs);
  if (alerts.length === 0 || lotStatus === 'sem_dados' || lotStatus === 'valido') return null;
  const isRejected = lotStatus === 'reprovado';
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 space-y-2 ${
        isRejected
          ? 'bg-red-50 dark:bg-red-500/[0.06] border-red-200 dark:border-red-400/20'
          : 'bg-amber-50 dark:bg-amber-500/[0.06] border-amber-200 dark:border-amber-500/20'
      }`}
    >
      <p
        className={`text-xs font-semibold ${isRejected ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}
      >
        {isRejected ? 'Lote reprovado — RDC 978/2025' : 'Alertas de qualidade'}
      </p>
      <ul className="space-y-1">
        {alerts.map((a) => (
          <li key={a} className="text-xs text-slate-600 dark:text-white/55 flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 ${isRejected ? 'text-red-400' : 'text-amber-400'}`}>
              ›
            </span>
            {ALERT_LABELS[a] ?? a}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 my-8 mx-4 w-full max-w-lg bg-white dark:bg-[#111] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <p className="text-sm font-semibold text-slate-800 dark:text-white/85">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
          >
            <XIcon />
          </button>
        </div>
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
  lot: CIQImunoLot;
  isSaving: boolean;
  error: string | null;
  onSave: (fields: { aberturaControle: string; validadeControle: string }) => void;
  onCancel: () => void;
}) {
  const [abertura, setAbertura] = useState(lot.aberturaControle);
  const [validade, setValidade] = useState(lot.validadeControle);

  const inputCls =
    'w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.10] text-slate-800 dark:text-white/85 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all';
  const labelCls =
    'block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-1.5';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ aberturaControle: abertura, validadeControle: validade });
      }}
      className="space-y-4"
    >
      <div className="rounded-lg border border-slate-100 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.02] px-4 py-3 space-y-1">
        <RowDetail label="Teste" value={lot.testType} />
        <RowDetail label="Lote controle" value={lot.loteControle} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-abertura" className={labelCls}>
            Data de abertura
          </label>
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
          <label htmlFor="edit-validade" className={labelCls}>
            Data de validade
          </label>
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
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="h-9 px-4 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.10] hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors"
        >
          {isSaving ? (
            <>
              <SpinnerIcon /> Salvando…
            </>
          ) : (
            'Salvar alterações'
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyLots({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
        <ImunoIcon />
      </div>
      <div>
        <p className="font-medium text-slate-700 dark:text-white/70">Nenhum lote registrado</p>
        <p className="text-sm text-slate-400 dark:text-white/30 mt-1">
          Registre a primeira corrida para criar um lote de controle.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
      >
        <PlusIcon /> Nova corrida
      </button>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function CIQImunoDashboard() {
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const user = useUser();
  const role = useUserRole();
  const isSuperAdmin = useIsSuperAdmin();
  const { signOut } = useAuthFlow();

  const canDecide = isSuperAdmin || role === 'owner' || role === 'admin';

  const { lots, isLoading: lotsLoading } = useCIQLots();
  const [activeLotId, setActiveLotId] = useState<string | null>(null);
  const activeLot = lots.find((l) => l.id === activeLotId) ?? lots[0] ?? null;

  const { runs, isLoading: runsLoading } = useCIQRuns(activeLot?.id ?? null);
  const { save, isSaving } = useSaveCIQRun();

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [qrRun, setQRRun] = useState<CIQImunoRun | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [decidingLot, setDecidingLot] = useState(false);
  const [decisionErr, setDecisionErr] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  const [editingLot, setEditingLot] = useState<CIQImunoLot | null>(null);
  const [isSavingLot, setIsSavingLot] = useState(false);
  const [saveLotErr, setSaveLotErr] = useState<string | null>(null);
  const [deletingLot, setDeletingLot] = useState<CIQImunoLot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

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
      await updateLotMeta(editingLot.labId, editingLot.id, fields, user.uid, {
        aberturaControle: editingLot.aberturaControle,
        validadeControle: editingLot.validadeControle,
      });
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
          testType: deletingLot.testType,
          loteControle: deletingLot.loteControle,
          runCount: deletingLot.runCount,
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white">
      {/* ── Topbar — padrão design system ────────────────────────────────────── */}
      <header className="h-14 bg-white dark:bg-[#0F1318] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-4 px-6 sticky top-0 z-10">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[13px] text-slate-400 dark:text-slate-500">
          <button
            type="button"
            onClick={() => setCurrentView('hub')}
            className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <BackIcon /> Hub
          </button>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-white/70 font-medium">
            <span className="text-emerald-500 dark:text-emerald-400">
              <ImunoIcon />
            </span>
            CIQ-Imuno
          </div>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hidden sm:inline-flex">
            RDC 978/2025
          </span>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
          >
            <PlusIcon /> Nova corrida
          </button>
          <ThemeToggle size="sm" />
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      {lotsLoading ? (
        <div className="flex items-center justify-center py-32">
          <svg
            className="animate-spin w-5 h-5 text-slate-300 dark:text-white/20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.25"
            />
            <path
              d="M22 12a10 10 0 00-10-10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      ) : lots.length === 0 ? (
        <EmptyLots
          onNew={() => {
            setFormError(null);
            setShowForm(true);
          }}
        />
      ) : (
        <div className="max-w-[1400px] mx-auto px-8 py-6">
          <div className="flex gap-6 items-start">
            {/* ── Sidebar — lot list ───────────────────────────────────────── */}
            <aside
              className={[
                'w-[232px] shrink-0 sticky top-20 space-y-2',
                activeLotId !== null ? 'hidden sm:block' : 'w-full',
              ].join(' ')}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-1 pb-2">
                Lotes
              </div>
              {lots.map((lot) => (
                <LotCard
                  key={lot.id}
                  lot={lot}
                  isActive={lot.id === (activeLot?.id ?? lots[0]?.id)}
                  canManage={canDecide}
                  onSelect={() => setActiveLotId(lot.id)}
                  onEdit={() => {
                    setSaveLotErr(null);
                    setEditingLot(lot);
                  }}
                  onDelete={() => {
                    setDeleteErr(null);
                    setDeletingLot(lot);
                  }}
                />
              ))}
            </aside>

            {/* ── Main ────────────────────────────────────────────────────── */}
            <main className="flex-1 min-w-0 space-y-4">
              {/* Mobile: back */}
              <button
                type="button"
                onClick={() => setActiveLotId(null)}
                className="sm:hidden flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <BackIcon /> Lotes
              </button>

              {/* Page header */}
              {activeLot && (
                <div className="flex items-end gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {activeLot.testType}
                      </h1>
                      <LotStatusBadge status={activeLot.lotStatus} />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
                      {activeLot.loteControle} · Val. {activeLot.validadeControle}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                    {canDecide && runs.length > 0 && activeLot.ciqDecision !== 'A' && (
                      <button
                        type="button"
                        onClick={() => handleLotDecision('A')}
                        disabled={decidingLot}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-40 transition-all"
                      >
                        <CheckIcon /> Aprovar lote
                      </button>
                    )}
                    {canDecide &&
                      runs.length > 0 &&
                      activeLot.ciqDecision !== 'Rejeitado' &&
                      activeLot.ciqDecision !== 'A' && (
                        <button
                          type="button"
                          onClick={() => handleLotDecision('Rejeitado')}
                          disabled={decidingLot}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-500/[0.07] border border-red-200 dark:border-red-400/25 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/[0.15] disabled:opacity-40 transition-all"
                        >
                          <BanIcon /> Reprovar lote
                        </button>
                      )}
                    {runs.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowPrint(true)}
                          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors"
                        >
                          <PrintIcon /> Relatório PDF
                        </button>
                        <button
                          type="button"
                          onClick={handleExportCSV}
                          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors"
                        >
                          <DownloadIcon /> FR-036 CSV
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* KPI cards */}
              {runs.length > 0 && activeLot && (
                <CIQIndicadores runs={runs} lotStatus={activeLot.lotStatus} />
              )}

              {/* Decision badge */}
              {activeLot?.ciqDecision && (
                <div
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm ${
                    activeLot.ciqDecision === 'A'
                      ? 'bg-emerald-50 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-500/[0.06] border-red-200 dark:border-red-400/20 text-red-700 dark:text-red-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeLot.ciqDecision === 'A' ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                  <span className="font-semibold">
                    Decisão formal: {activeLot.ciqDecision === 'A' ? 'Aprovado' : 'Reprovado'}
                  </span>
                  {activeLot.decisionBy && (
                    <span className="text-xs opacity-60">· RT registrado</span>
                  )}
                </div>
              )}

              {/* Errors */}
              {(decisionErr || exportErr) && (
                <p className="text-xs text-red-500 dark:text-red-400">{decisionErr ?? exportErr}</p>
              )}

              {/* Westgard alerts */}
              {runs.length > 0 && <WestgardAlertsPanel runs={runs} />}

              {/* Runs table */}
              {runsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg
                    className="animate-spin w-4 h-4 text-slate-300 dark:text-white/20"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeOpacity="0.25"
                    />
                    <path
                      d="M22 12a10 10 0 00-10-10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              ) : runs.length === 0 ? (
                <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-8 text-center shadow-sm">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Nenhuma corrida registrada neste lote.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setShowForm(true);
                    }}
                    className="mt-3 inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                  >
                    <PlusIcon /> Registrar corrida
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                        {[
                          { label: 'Código', cls: 'hidden md:table-cell' },
                          { label: 'Data', cls: '' },
                          { label: 'Resultado', cls: '' },
                          { label: 'Aprovação', cls: '' },
                          { label: 'Westgard', cls: '' },
                          { label: 'NOTIVISA', cls: '' },
                          { label: 'Assinatura', cls: 'hidden sm:table-cell' },
                          { label: '', cls: '' },
                        ].map((h, i) => (
                          <th
                            key={i}
                            className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${h.cls}`}
                          >
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...runs].reverse().map((run) => (
                        <RunRow key={run.id} run={run} onShowQR={setQRRun} />
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
        <Modal title="Registrar corrida" onClose={() => setShowForm(false)}>
          {formError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/[0.07] border border-red-200 dark:border-red-400/20 text-xs text-red-600 dark:text-red-400">
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

      {/* ── Relatório PDF ────────────────────────────────────────────────────── */}
      {showPrint && activeLot && (
        <CIQRelatorioPrint lot={activeLot} runs={runs} onClose={() => setShowPrint(false)} />
      )}

      {/* ── Modal: Editar Lote ───────────────────────────────────────────────── */}
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
            <div className="rounded-xl border border-red-200 dark:border-red-400/20 bg-red-50 dark:bg-red-500/[0.06] px-4 py-3.5">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Esta operação é irreversível
              </p>
              <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed mt-1.5">
                O lote{' '}
                <span className="font-medium text-slate-700 dark:text-white/70">
                  {deletingLot.testType}
                </span>{' '}
                ({deletingLot.loteControle}) e todas as suas{' '}
                <span className="font-medium text-slate-700 dark:text-white/70">
                  {deletingLot.runCount} corrida{deletingLot.runCount !== 1 ? 's' : ''}
                </span>{' '}
                serão excluídos permanentemente e registrados no audit trail.
              </p>
            </div>
            {deleteErr && <p className="text-xs text-red-500 dark:text-red-400">{deleteErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingLot(null)}
                disabled={isDeleting}
                className="h-9 px-4 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.10] hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteLot}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <SpinnerIcon /> Excluindo…
                  </>
                ) : (
                  <>
                    <TrashIcon /> Excluir lote
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: QR Code de Auditoria ─────────────────────────────────────── */}
      {qrRun && activeLot && (
        <Modal title="QR Code de auditoria" onClose={() => setQRRun(null)}>
          <div className="flex flex-col items-center gap-4">
            <CIQAuditor run={qrRun} lotId={activeLot.id} size={160} />
            <div className="w-full rounded-xl border border-slate-100 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.03] p-4 space-y-2 text-xs">
              <RowDetail label="Teste" value={qrRun.testType} />
              <RowDetail label="Data" value={qrRun.dataRealizacao} />
              <RowDetail
                label="Resultado"
                value={qrRun.resultadoObtido === 'R' ? 'Reagente' : 'Não Reagente'}
              />
              <RowDetail label="Operador" value={qrRun.operatorName} />
              <RowDetail
                label="Assinatura"
                value={qrRun.logicalSignature ? `${qrRun.logicalSignature.slice(0, 16)}…` : '—'}
                mono
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Micro helper ─────────────────────────────────────────────────────────────

function RowDetail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400 dark:text-white/35 shrink-0">{label}</span>
      <span className={`text-slate-700 dark:text-white/70 text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
