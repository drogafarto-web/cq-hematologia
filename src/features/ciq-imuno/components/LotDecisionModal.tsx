/**
 * LotDecisionModal — fluxo formal de aprovação/rejeição de lote pelo RT.
 *
 * Compliance RDC 786/2025 + RDC 978/2025 art. 128:
 *  - Mostra resumo do lote (taxa de aprovação, contadores, alertas Westgard)
 *  - Exige justificativa escrita (mín 10 chars)
 *  - Exige reautenticação por senha (Firebase EmailAuthProvider) — senha
 *    NUNCA trafega pro server, validação é local via reauthenticateWithCredential
 *  - Service grava audit record imutável antes de mutar `ciqDecision`
 *
 * O caller é responsável por gateier visibilidade do trigger (canDecide).
 * Este modal não checa role — assume que quem chega aqui pode decidir.
 */

import React, { useMemo, useState } from 'react';
import { auth } from '../../../shared/services/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { updateLotDecision } from '../services/ciqFirebaseService';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';
import type { CIQStatus } from '../types/_shared_refs';

// ─── Inline icons ─────────────────────────────────────────────────────────────

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

function ShieldIcon() {
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
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface LotDecisionModalProps {
  open: boolean;
  decision: Extract<CIQStatus, 'A' | 'Rejeitado'>;
  lot: CIQImunoLot;
  runs: CIQImunoRun[];
  actorUid: string;
  actorName: string;
  onClose: () => void;
  onDecided?: (decision: Extract<CIQStatus, 'A' | 'Rejeitado'>) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateBR(d?: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
}

const ALERT_LABELS: Record<string, string> = {
  taxa_falha_10pct: '>10% NR no lote',
  consecutivos_3nr: '3+ NR consecutivos',
  consecutivos_4nr: '4+ NR nos últimos 10',
  lote_expirado: 'Lote expirado',
  validade_30d: 'Validade <30 dias',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LotDecisionModal({
  open,
  decision,
  lot,
  runs,
  actorUid,
  actorName,
  onClose,
  onDecided,
}: LotDecisionModalProps) {
  const [justificativa, setJustificativa] = useState('');
  const [senha, setSenha] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = runs.length;
    const aprov = runs.filter((r) => {
      const positivoOk = r.resultadoObtido === r.resultadoEsperado;
      const negativoOk =
        r.resultadoEsperadoNegativo === undefined ||
        r.resultadoObtidoNegativo === r.resultadoEsperadoNegativo;
      return positivoOk && negativoOk;
    }).length;
    const naoAprov = total - aprov;
    const taxa = total > 0 ? (aprov / total) * 100 : 0;
    const allAlerts = [...new Set(runs.flatMap((r) => r.westgardCategorico ?? []))];
    return { total, aprov, naoAprov, taxa, allAlerts };
  }, [runs]);

  const isAprovar = decision === 'A';
  const headerColor = isAprovar
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-red-700 dark:text-red-300';
  const headerBg = isAprovar
    ? 'bg-emerald-50 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/25'
    : 'bg-red-50 dark:bg-red-500/[0.06] border-red-200 dark:border-red-500/25';
  const ctaBg = isAprovar ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700';

  if (!open) return null;

  const podeSubmit =
    !submitting && acknowledged && justificativa.trim().length >= 10 && senha.length >= 6;

  async function handleSubmit() {
    setError(null);
    if (justificativa.trim().length < 10) {
      setError('Justificativa precisa ter pelo menos 10 caracteres.');
      return;
    }
    if (!acknowledged) {
      setError('Confirme a declaração formal antes de prosseguir.');
      return;
    }
    const u = auth.currentUser;
    if (!u || !u.email) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }
    if (senha.length < 6) {
      setError('Informe sua senha (mínimo 6 caracteres).');
      return;
    }

    setSubmitting(true);
    try {
      const cred = EmailAuthProvider.credential(u.email, senha);
      await reauthenticateWithCredential(u, cred);
    } catch {
      setError('Senha incorreta.');
      setSubmitting(false);
      return;
    }

    try {
      await updateLotDecision(
        lot.labId,
        lot.id,
        decision,
        actorUid,
        justificativa.trim(),
        lot.ciqDecision,
      );
      onDecided?.(decision);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar decisão.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
          <h2 className={`text-sm font-semibold ${headerColor}`}>
            {isAprovar ? 'Aprovar lote — decisão formal RT' : 'Reprovar lote — decisão formal RT'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            title="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Resumo do lote */}
          <section className={`rounded-xl border ${headerBg} px-4 py-3.5`}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
              Lote sob decisão
            </p>
            <p className="text-base font-semibold mt-0.5">
              {lot.testType} · {lot.loteControle}
            </p>
            <p className="text-xs opacity-80 mt-0.5">
              Validade {fmtDateBR(lot.validadeControle)} · Abertura{' '}
              {fmtDateBR(lot.aberturaControle)}
            </p>
          </section>

          {/* Métricas */}
          <section className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-slate-100 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02] py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/40">
                Corridas
              </p>
              <p className="text-xl font-semibold text-slate-800 dark:text-white/85 tabular-nums">
                {stats.total}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/[0.05] py-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Conformes
              </p>
              <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {stats.aprov}
              </p>
            </div>
            <div className="rounded-lg border border-red-100 dark:border-red-500/20 bg-red-50/60 dark:bg-red-500/[0.05] py-3">
              <p className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400">
                Rejeitadas
              </p>
              <p className="text-xl font-semibold text-red-700 dark:text-red-300 tabular-nums">
                {stats.naoAprov}
              </p>
            </div>
          </section>

          <p className="text-xs text-slate-500 dark:text-white/45 text-center">
            Taxa de conformidade:{' '}
            <span className="font-semibold text-slate-700 dark:text-white/75 tabular-nums">
              {stats.total > 0 ? `${stats.taxa.toFixed(1)}%` : '—'}
            </span>
          </p>

          {/* Westgard alerts */}
          {stats.allAlerts.length > 0 && (
            <section className="rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/[0.06] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1.5">
                Alertas Westgard ativos
              </p>
              <ul className="space-y-0.5 text-xs text-amber-800 dark:text-amber-200">
                {stats.allAlerts.map((a) => (
                  <li key={a}>• {ALERT_LABELS[a] ?? a}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Declaração */}
          <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] px-4 py-3.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-white/20 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-700 dark:text-white/75 leading-relaxed">
                Eu, <span className="font-semibold">{actorName}</span>, na condição de responsável
                técnico, declaro formalmente{' '}
                <span className={`font-semibold ${headerColor}`}>
                  {isAprovar ? 'aprovar este lote para uso assistencial' : 'reprovar este lote'}
                </span>{' '}
                conforme RDC 786/2025. Esta decisão é imutável e fica registrada no histórico
                auditável do laboratório.
              </span>
            </label>
          </section>

          {/* Justificativa */}
          <section>
            <label
              htmlFor="justificativa"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/45 mb-1.5"
            >
              Justificativa <span className="text-red-500">*</span>{' '}
              <span className="font-normal text-slate-400 dark:text-white/35 normal-case">
                (mín. 10 caracteres)
              </span>
            </label>
            <textarea
              id="justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              disabled={submitting}
              placeholder={
                isAprovar
                  ? 'Ex: Validação concluída com 5 corridas conformes consecutivas, sem alertas Westgard.'
                  : 'Ex: Lote apresentou 3 corridas NR consecutivas — descartar e abrir não conformidade.'
              }
              className="w-full rounded-lg border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.02] px-3 py-2 text-sm text-slate-700 dark:text-white/85 placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-slate-400 dark:focus:border-white/25 disabled:opacity-40 resize-none"
            />
            <p className="text-[10px] text-slate-400 dark:text-white/35 mt-1 tabular-nums">
              {justificativa.trim().length}/500
            </p>
          </section>

          {/* Senha */}
          <section>
            <label
              htmlFor="senha-rt"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/45 mb-1.5"
            >
              Senha do RT <span className="text-red-500">*</span>{' '}
              <span className="font-normal text-slate-400 dark:text-white/35 normal-case">
                (assinatura digital)
              </span>
            </label>
            <input
              id="senha-rt"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={submitting}
              placeholder="Digite sua senha"
              className="w-full rounded-lg border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.02] px-3 py-2 text-sm text-slate-700 dark:text-white/85 placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-slate-400 dark:focus:border-white/25 disabled:opacity-40"
            />
            <p className="text-[10px] text-slate-400 dark:text-white/35 mt-1 flex items-center gap-1">
              <ShieldIcon /> Reauth local — senha não é transmitida ao servidor.
            </p>
          </section>

          {/* Erro */}
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-500/[0.07] px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-between items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.10] hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!podeSubmit}
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors ${ctaBg}`}
            >
              {submitting ? <SpinnerIcon /> : <ShieldIcon />}
              {isAprovar ? 'Aprovar com assinatura' : 'Reprovar com assinatura'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
