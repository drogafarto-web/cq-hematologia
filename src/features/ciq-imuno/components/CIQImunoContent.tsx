import React, { useState, useEffect } from 'react';
import { useUser, useUserRole, useIsSuperAdmin, useActiveLabId } from '../../../store/useAuthStore';
import { useCIQRuns } from '../hooks/useCIQRuns';
import { useSaveCIQRun } from '../hooks/useSaveCIQRun';
import { useCIQWestgard } from '../hooks/useCIQWestgard';
import { CIQImunoForm } from './CIQImunoForm';
import { NovoLoteModal } from '../../insumos/components/NovoLoteModal';
import { CIQAuditor } from './CIQAuditor';
import { CIQIndicadores } from './CIQIndicadores';
import { CIQRelatorioPrint } from './CIQRelatorioPrint';
import { LotDecisionModal } from './LotDecisionModal';
import { exportRunsToCSV } from '../services/ciqExportService';
import {
  updateLotDecision,
  updateLotMeta,
  deleteCIQLot,
  vincularCIQLot,
  desvincularCIQLot,
} from '../services/ciqFirebaseService';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';
import type { CIQLotStatus, CIQStatus } from '../types/_shared_refs';

// ─── Icons ────────────────────────────────────────────────────────────────────

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
function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M6.5 1.5l3 3-1 1 1.5 1.5-1 1L7 6.5l-3 3v-2L6.5 5l-1-1 1-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinOffIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M6.5 1.5l3 3-1 1 1.5 1.5-1 1L7 6.5l-3 3v-2L6.5 5l-1-1 1-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M2 11l9-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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

// ─── Lot Status Badge ─────────────────────────────────────────────────────────

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

// ─── Validity helpers ─────────────────────────────────────────────────────────

type ValidityLevel = 'ok' | 'warning' | 'critical' | 'expired';

function validityLevel(isoDate: string | undefined): { level: ValidityLevel; daysLeft: number } {
  if (!isoDate) return { level: 'ok', daysLeft: Infinity };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { level: 'expired', daysLeft };
  if (daysLeft <= 7) return { level: 'critical', daysLeft };
  if (daysLeft <= 15) return { level: 'warning', daysLeft };
  return { level: 'ok', daysLeft };
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

function ValidityBanner({
  validadeControle,
  runs,
}: {
  validadeControle: string;
  runs: CIQImunoRun[];
}) {
  const controle = validityLevel(validadeControle);

  // Worst reagente validity among runs of this lot — ajuda o técnico a ver
  // se o kit em uso está perto de vencer. Falta de validade = ignorado.
  let reagenteWorst: { level: ValidityLevel; daysLeft: number; lote?: string; val?: string } = {
    level: 'ok',
    daysLeft: Infinity,
  };
  for (const r of runs) {
    if (!r.validadeReagente) continue;
    const v = validityLevel(r.validadeReagente);
    const severity = (l: ValidityLevel) =>
      l === 'expired' ? 4 : l === 'critical' ? 3 : l === 'warning' ? 2 : 1;
    if (severity(v.level) > severity(reagenteWorst.level)) {
      reagenteWorst = { ...v, lote: r.loteReagente, val: r.validadeReagente };
    }
  }

  // Não mostra banner se nada crítico
  if (controle.level === 'ok' && reagenteWorst.level === 'ok') return null;

  const worstLevel: ValidityLevel =
    controle.level === 'expired' || reagenteWorst.level === 'expired'
      ? 'expired'
      : controle.level === 'critical' || reagenteWorst.level === 'critical'
        ? 'critical'
        : 'warning';

  const cls =
    worstLevel === 'expired'
      ? 'bg-red-100 dark:bg-red-500/[0.15] border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-300'
      : worstLevel === 'critical'
        ? 'bg-red-50 dark:bg-red-500/[0.07] border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
        : 'bg-amber-50 dark:bg-amber-500/[0.07] border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400';

  const msgs: string[] = [];
  if (controle.level === 'expired')
    msgs.push(
      `Controle expirado há ${Math.abs(controle.daysLeft)} dia(s). Não registre mais corridas neste lote — substitua o material de controle.`,
    );
  else if (controle.level === 'critical')
    msgs.push(`Controle vence em ${controle.daysLeft} dia(s). Peça reposição urgente.`);
  else if (controle.level === 'warning')
    msgs.push(`Controle vence em ${controle.daysLeft} dia(s). Planeje reposição.`);

  if (reagenteWorst.level === 'expired' && reagenteWorst.lote)
    msgs.push(
      `Kit reagente lote ${reagenteWorst.lote} vencido (${reagenteWorst.val}). Não use em corridas novas.`,
    );
  else if (reagenteWorst.level === 'critical' && reagenteWorst.lote)
    msgs.push(`Kit reagente lote ${reagenteWorst.lote} vence em ${reagenteWorst.daysLeft} dia(s).`);
  else if (reagenteWorst.level === 'warning' && reagenteWorst.lote)
    msgs.push(`Kit reagente lote ${reagenteWorst.lote} vence em ${reagenteWorst.daysLeft} dia(s).`);

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cls} text-sm`}>
      <span className="text-lg leading-none shrink-0" aria-hidden>
        ⚠
      </span>
      <div className="flex-1 space-y-1">
        {msgs.map((m, i) => (
          <p key={i}>{m}</p>
        ))}
      </div>
    </div>
  );
}

// ─── Run Row ──────────────────────────────────────────────────────────────────

function RunRow({ run, onShowQR }: { run: CIQImunoRun; onShowQR: (r: CIQImunoRun) => void }) {
  const conforme = run.resultadoObtido === run.resultadoEsperado;
  const hasAlerts = (run.westgardCategorico?.length ?? 0) > 0;

  // Resultado é sempre NEUTRO (valor da leitura: R / NR), sem mistura semântica.
  // Conformidade é que carrega a cor verde/vermelha — separação inequívoca
  // exigida pra auditoria RDC 978/2025 Art. 128.
  const conformityCls = conforme
    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
  const neutralCls =
    'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10';

  const operatorShort = run.operatorName
    ? run.operatorName.length > 18
      ? `${run.operatorName.split(' ').slice(0, 2).join(' ')}${run.operatorName.split(' ').length > 2 ? '…' : ''}`
      : run.operatorName
    : '—';

  return (
    <tr className="border-t border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
      <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500 hidden md:table-cell">
        {run.runCode ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 dark:text-white/70">{run.dataRealizacao}</td>

      {/* Lote do Reagente — rastreabilidade do kit testado */}
      <td
        className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-white/50 hidden lg:table-cell"
        title={
          run.fabricanteReagente
            ? `${run.fabricanteReagente} · ${run.loteReagente}`
            : run.loteReagente
        }
      >
        {run.loteReagente ?? '—'}
      </td>

      {/* Resultado (neutro) — mostra esperado → obtido */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium border ${neutralCls}`}
          title={`Esperado: ${run.resultadoEsperado} · Obtido: ${run.resultadoObtido}`}
        >
          <span className="opacity-50">{run.resultadoEsperado}</span>
          <span className="opacity-30">→</span>
          <span className="font-semibold">{run.resultadoObtido}</span>
        </span>
      </td>

      {/* Conformidade — semantica clínica clara */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${conformityCls}`}
          title={
            conforme
              ? 'Conforme — resultado obtido bateu com o esperado'
              : 'Não conforme — obtido diverge do esperado. Ação corretiva obrigatória.'
          }
        >
          {conforme ? '✓' : '✗'}
          <span className="hidden sm:inline">{conforme ? 'Conforme' : 'NC'}</span>
        </span>
      </td>

      <td className="px-4 py-3 text-xs">
        {hasAlerts ? (
          <span className="text-amber-600 dark:text-amber-400">
            {run.westgardCategorico!.length} alerta{run.westgardCategorico!.length !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-white/20">—</span>
        )}
      </td>

      {/* Assinatura — nome do operador + hash curto */}
      <td
        className="px-4 py-3 text-xs hidden sm:table-cell"
        title={
          run.logicalSignature
            ? `${run.operatorName}\nSHA-256: ${run.logicalSignature}`
            : (run.operatorName ?? '')
        }
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-600 dark:text-white/60 truncate max-w-[140px]">
            {operatorShort}
          </span>
          {run.logicalSignature && (
            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
              {run.logicalSignature.slice(0, 8)}…
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onShowQR(run)}
          aria-label="Ver QR Code"
          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.05] ml-auto"
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
  lote_expirado: 'Lote de controle expirado',
  validade_30d: 'Controle vence em menos de 30 dias',
};

function WestgardAlertsPanel({ runs }: { runs: CIQImunoRun[] }) {
  const { alerts, lotStatus } = useCIQWestgard(runs);
  if (alerts.length === 0 || lotStatus === 'sem_dados' || lotStatus === 'valido') return null;
  const isRejected = lotStatus === 'reprovado';
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 space-y-2 ${isRejected ? 'bg-red-50 dark:bg-red-500/[0.06] border-red-200 dark:border-red-400/20' : 'bg-amber-50 dark:bg-amber-500/[0.06] border-amber-200 dark:border-amber-500/20'}`}
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

interface CIQImunoContentProps {
  lots: CIQImunoLot[];
  activeLotId: string | null;
  setActiveLotId: (id: string | null) => void;
  newRunTrigger: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQImunoContent({
  lots,
  activeLotId,
  setActiveLotId,
  newRunTrigger,
}: CIQImunoContentProps) {
  const user = useUser();
  const role = useUserRole();
  const isSuperAdmin = useIsSuperAdmin();
  const labId = useActiveLabId();
  const canDecide = isSuperAdmin || role === 'owner' || role === 'admin';

  const activeLot = lots.find((l) => l.id === activeLotId) ?? lots[0] ?? null;

  const { runs, isLoading: runsLoading } = useCIQRuns(activeLot?.id ?? null);
  const { save, isSaving } = useSaveCIQRun();

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formPrefill, setFormPrefill] = useState<CIQImunoLot | null>(null);
  // Spine entry-point: "+ Cadastrar Insumo" abre o NovoLoteModal pré-filtrado
  // pra módulo imunologia. O lote físico (Insumo) nasce no catálogo canônico
  // (RDC 978 spine), separado do CIQImunoLot — que continua sendo materializado
  // lazy na primeira corrida pelo CIQImunoForm.
  const [showCadastrarInsumo, setShowCadastrarInsumo] = useState(false);

  const [pinningLot, setPinningLot] = useState<CIQImunoLot | null>(null);
  const [isPinning, setIsPinning] = useState(false);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [unpinningLot, setUnpinningLot] = useState<CIQImunoLot | null>(null);
  const [isUnpinning, setIsUnpinning] = useState(false);

  // Event-via-counter: pai incrementa `newRunTrigger` ao clicar "Nova corrida"
  // no sidebar. Evita prop drilling de showForm/setShowForm por 2 níveis.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (newRunTrigger > 0) {
      setFormError(null);
      setShowForm(true);
    }
  }, [newRunTrigger]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [qrRun, setQRRun] = useState<CIQImunoRun | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [decidingLot, setDecidingLot] = useState(false);
  const [decisionErr, setDecisionErr] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<'A' | 'Rejeitado' | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [editingLot, setEditingLot] = useState<CIQImunoLot | null>(null);
  const [isSavingLot, setIsSavingLot] = useState(false);
  const [saveLotErr, setSaveLotErr] = useState<string | null>(null);
  const [deletingLot, setDeletingLot] = useState<CIQImunoLot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  async function handleSave(
    data: CIQImunoFormData,
    options?: import('../hooks/useSaveCIQRun').SaveCIQRunOptions,
  ) {
    setFormError(null);
    try {
      const { lotId } = await save(data, options);
      setActiveLotId(lotId);
      setShowForm(false);
      setFormPrefill(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar corrida.');
    }
  }

  async function handlePinLot(setupType: 'principal' | 'validacao_paralela') {
    if (!pinningLot || !user) return;
    setPinErr(null);
    setIsPinning(true);
    try {
      await vincularCIQLot(pinningLot.labId, pinningLot.id, setupType, user.uid);
      setPinningLot(null);
    } catch (err) {
      setPinErr(err instanceof Error ? err.message : 'Erro ao vincular.');
    } finally {
      setIsPinning(false);
    }
  }

  async function handleUnpinLot() {
    if (!unpinningLot || !user) return;
    setIsUnpinning(true);
    try {
      await desvincularCIQLot(unpinningLot.labId, unpinningLot.id, user.uid);
      setUnpinningLot(null);
    } catch (err) {
      console.error('[CIQImuno] desvincular falhou', err);
    } finally {
      setIsUnpinning(false);
    }
  }

  function handleLotDecision(decision: CIQStatus) {
    if (!activeLot || !user) return;
    setDecisionErr(null);
    if (decision === 'A' || decision === 'Rejeitado') {
      setPendingDecision(decision);
      return;
    }
    // Outros status (ex: 'Pendente') seguem o caminho direto sem reauth.
    setDecidingLot(true);
    void updateLotDecision(
      activeLot.labId,
      activeLot.id,
      decision,
      user.uid,
      'Reset para pendente',
      activeLot.ciqDecision,
    )
      .catch((err) =>
        setDecisionErr(err instanceof Error ? err.message : 'Erro ao registrar decisão.'),
      )
      .finally(() => setDecidingLot(false));
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

  // ── Empty state (no lots) ─────────────────────────────────────────────────

  if (lots.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
            <ImunoIcon />
          </div>
          <div>
            <p className="font-medium text-slate-700 dark:text-white/70">Nenhum lote registrado</p>
            <p className="text-sm text-slate-400 dark:text-white/30 mt-1">
              Registre a primeira corrida para criar um lote de controle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCadastrarInsumo(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/75 hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:text-violet-700 dark:hover:text-violet-300 transition-all"
            >
              <PlusIcon /> Cadastrar Insumo
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              <PlusIcon /> Nova Corrida
            </button>
          </div>
        </div>
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
              onCancel={() => {
                setShowForm(false);
                setFormPrefill(null);
              }}
              {...(formPrefill && { prefillFromLot: formPrefill })}
            />
          </Modal>
        )}
        {showCadastrarInsumo && labId && (
          <NovoLoteModal
            labId={labId}
            initialModulo="imunologia"
            onClose={() => setShowCadastrarInsumo(false)}
          />
        )}
      </>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────

  const currentActiveLotId = activeLot?.id ?? null;

  return (
    <div className="flex gap-6 items-start">
      {/* ── Lot list rail ──────────────────────────────────────────────────── */}
      <aside className="w-[240px] shrink-0 space-y-2 sticky top-20">
        <div className="px-1 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-white/40">
            Lotes ({lots.length})
          </span>
        </div>
        {/* Duas ações distintas, co-locadas: cadastrar Insumo (lote físico no
            estoque/spine) vs registrar Corrida (consome insumos pra rodar CIQ).
            Botão único antes era ambíguo — abria a corrida apesar do label
            "Cadastrar". */}
        <div className="space-y-1.5 px-1 pb-2">
          <button
            type="button"
            onClick={() => setShowCadastrarInsumo(true)}
            title="Cadastra um lote físico (reagente, controle positivo, controle negativo) no catálogo de insumos. Não cria corrida."
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-md text-[11px] font-semibold bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-white/75 hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:text-violet-700 dark:hover:text-violet-300 transition-all"
          >
            <PlusIcon /> Cadastrar Insumo
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFormPrefill(null);
              setShowForm(true);
            }}
            title="Registra uma nova corrida de CIQ. Na primeira corrida de um lote de controle o sistema cria automaticamente o agrupador de lote."
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-md text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
          >
            <PlusIcon /> Nova Corrida
          </button>
        </div>
        <div className="space-y-1">
          {lots.map((lot) => {
            const isActive = lot.id === currentActiveLotId;
            const isPinned =
              lot.setupType === 'principal' || lot.setupType === 'validacao_paralela';
            const isPrincipal = lot.setupType === 'principal';
            return (
              <button
                key={lot.id}
                type="button"
                onClick={() => setActiveLotId(lot.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                    : 'border-transparent bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:border-slate-200 dark:hover:border-white/[0.07]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[13px] font-medium truncate ${
                      isActive
                        ? 'text-emerald-800 dark:text-emerald-300'
                        : 'text-slate-700 dark:text-white/75'
                    }`}
                  >
                    {lot.testType}
                  </span>
                  {isPinned && (
                    <span
                      className={`shrink-0 ${isPrincipal ? 'text-emerald-500 dark:text-emerald-400' : 'text-blue-500 dark:text-blue-400'}`}
                      title={isPrincipal ? 'Setup Oficial' : 'Em validação'}
                    >
                      <PinIcon />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 dark:text-white/35">
                  <span className="font-mono truncate">{lot.loteControle}</span>
                  <span>·</span>
                  <span>
                    {lot.runCount} run{lot.runCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Active lot detail ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Page header */}
        {activeLot && (
          <div className="flex items-end gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {activeLot.testType}
                </h1>
                <LotStatusBadge status={activeLot.lotStatus} />
                <ValidityBadge isoDate={activeLot.validadeControle} label="Controle" />
                {(activeLot.setupType === 'principal' ||
                  activeLot.setupType === 'validacao_paralela') && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      activeLot.setupType === 'principal'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    <PinIcon />
                    {activeLot.setupType === 'principal' ? 'Setup Oficial' : 'Em Validação'}
                  </span>
                )}
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
              {canDecide && (
                <>
                  {activeLot.setupType === 'principal' ||
                  activeLot.setupType === 'validacao_paralela' ? (
                    <button
                      type="button"
                      onClick={() => setUnpinningLot(activeLot)}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium bg-amber-50 dark:bg-amber-500/[0.07] border border-amber-200 dark:border-amber-400/25 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/[0.15] transition-colors"
                    >
                      <PinOffIcon /> Desvincular
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPinErr(null);
                        setPinningLot(activeLot);
                      }}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-200 dark:border-emerald-400/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/[0.15] transition-colors"
                    >
                      <PinIcon /> Vincular
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSaveLotErr(null);
                      setEditingLot(activeLot);
                    }}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    <EditIcon /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteErr(null);
                      setDeletingLot(activeLot);
                    }}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium bg-white dark:bg-white/[0.05] border border-red-200 dark:border-red-400/25 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.07] transition-colors"
                  >
                    <TrashIcon /> Excluir
                  </button>
                </>
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
            {activeLot.decisionBy && <span className="text-xs opacity-60">· RT registrado</span>}
          </div>
        )}

        {/* Errors */}
        {(decisionErr || exportErr) && (
          <p className="text-xs text-red-500 dark:text-red-400">{decisionErr ?? exportErr}</p>
        )}

        {/* Westgard alerts */}
        {runs.length > 0 && <WestgardAlertsPanel runs={runs} />}

        {/* Validity banner — alerta proativo de vencimento do controle ou reagente */}
        {activeLot && <ValidityBanner validadeControle={activeLot.validadeControle} runs={runs} />}

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
                    { label: 'Lote Reagente', cls: 'hidden lg:table-cell' },
                    { label: 'Resultado', cls: '' },
                    { label: 'Conformidade', cls: '' },
                    { label: 'Westgard', cls: '' },
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

        {/* Modal: Nova corrida */}
        {showForm && (
          <Modal
            title={formPrefill ? 'Registrar corrida (lote vinculado)' : 'Registrar corrida'}
            onClose={() => {
              setShowForm(false);
              setFormPrefill(null);
            }}
          >
            {formError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/[0.07] border border-red-200 dark:border-red-400/20 text-xs text-red-600 dark:text-red-400">
                {formError}
              </div>
            )}
            <CIQImunoForm
              onSave={handleSave}
              isSaving={isSaving}
              onCancel={() => {
                setShowForm(false);
                setFormPrefill(null);
              }}
              {...(formPrefill && { prefillFromLot: formPrefill })}
            />
          </Modal>
        )}

        {/* Modal: Cadastrar Insumo (spine) — pré-filtra módulo imunologia */}
        {showCadastrarInsumo && labId && (
          <NovoLoteModal
            labId={labId}
            initialModulo="imunologia"
            onClose={() => setShowCadastrarInsumo(false)}
          />
        )}

        {/* Relatório PDF */}
        {showPrint && activeLot && (
          <CIQRelatorioPrint lot={activeLot} runs={runs} onClose={() => setShowPrint(false)} />
        )}

        {/* Modal: Editar lote */}
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

        {/* Modal: Confirmar exclusão */}
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

        {/* Modal: Vincular lote */}
        {pinningLot && (
          <Modal title="Vincular à bancada" onClose={() => !isPinning && setPinningLot(null)}>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-100 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.02] px-4 py-3 space-y-1">
                <RowDetail label="Teste" value={pinningLot.testType} />
                <RowDetail label="Lote" value={pinningLot.loteControle} />
                <RowDetail label="Validade" value={pinningLot.validadeControle} />
              </div>
              <p className="text-xs text-slate-500 dark:text-white/50 leading-relaxed">
                Vincular um lote à bancada destrava registro de corridas para esse lote sem precisar
                selecioná-lo manualmente. Toda mudança fica registrada no histórico do lote (RDC
                786).
              </p>
              {pinningLot.ciqDecision !== 'A' && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-400/20 bg-blue-50 dark:bg-blue-500/[0.06] px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
                  Este lote ainda não foi aprovado pelo RT — apenas vinculação{' '}
                  <span className="font-medium">Em validação</span> está disponível. Corridas
                  registradas serão classificadas como validação até o lote ser aprovado.
                </div>
              )}
              {pinErr && <p className="text-xs text-red-500 dark:text-red-400">{pinErr}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPinningLot(null)}
                  disabled={isPinning}
                  className="h-9 px-4 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.10] hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-all"
                >
                  Cancelar
                </button>
                {pinningLot.ciqDecision === 'A' && (
                  <button
                    type="button"
                    onClick={() => handlePinLot('principal')}
                    disabled={isPinning}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors"
                  >
                    {isPinning ? <SpinnerIcon /> : <PinIcon />} Setup oficial
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePinLot('validacao_paralela')}
                  disabled={isPinning}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors"
                >
                  {isPinning ? <SpinnerIcon /> : <PinIcon />} Em validação
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: Desvincular lote */}
        {unpinningLot && (
          <Modal
            title="Desvincular da bancada"
            onClose={() => !isUnpinning && setUnpinningLot(null)}
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-100 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.02] px-4 py-3 space-y-1">
                <RowDetail label="Teste" value={unpinningLot.testType} />
                <RowDetail label="Lote" value={unpinningLot.loteControle} />
              </div>
              <p className="text-xs text-slate-500 dark:text-white/50">
                O lote permanece no estoque com o histórico de corridas intacto. Ação registrada no
                histórico do lote.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUnpinningLot(null)}
                  disabled={isUnpinning}
                  className="h-9 px-4 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.10] hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUnpinLot}
                  disabled={isUnpinning}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 transition-colors"
                >
                  {isUnpinning ? <SpinnerIcon /> : <PinOffIcon />} Desvincular
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: QR de auditoria */}
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

        {/* Decisão formal de lote — reauth + justificativa + audit imutável */}
        {pendingDecision && activeLot && user && (
          <LotDecisionModal
            open
            decision={pendingDecision}
            lot={activeLot}
            runs={runs}
            actorUid={user.uid}
            actorName={user.displayName ?? user.email ?? 'Responsável Técnico'}
            onClose={() => setPendingDecision(null)}
          />
        )}
      </div>
    </div>
  );
}
