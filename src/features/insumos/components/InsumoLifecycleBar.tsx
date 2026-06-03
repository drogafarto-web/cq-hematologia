/**
 * InsumoLifecycleBar — barra visual de 5 etapas do ciclo de vida do lote.
 *
 * Etapas (derivadas de campos existentes — não persiste estado próprio):
 *   1. Cadastrado — sempre done
 *   2. Aberto     — `dataAbertura != null`
 *   3. Qualificado— `qcStatus === 'aprovado'` (PR1). Para tira-uro (PR2):
 *                   exibe "N/A — PR2" em cinza neutro.
 *   4. Em uso     — `runCount > 0 && status === 'ativo'`
 *   5. Encerrado  — status in ['fechado','vencido','descartado','segregado'].
 *                   `segregado` exibe "Segregado" em vermelho.
 *
 * Visual: dark-first. Etapa atual em emerald-500, passadas com check verde,
 * futuras em white/30. SVGs inline (sem libs de ícones).
 *
 * PR1 — 2026-04-26.
 */

import React from 'react';
import type { Insumo } from '../types/Insumo';

// ─── Icons inline ────────────────────────────────────────────────────────────

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function DotIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" className={className} aria-hidden>
      <circle cx="4" cy="4" r="3" fill="currentColor" />
    </svg>
  );
}

function BanIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M5 5l14 14" />
    </svg>
  );
}

// ─── Stage derivation ────────────────────────────────────────────────────────

type StageState = 'done' | 'current' | 'future' | 'na' | 'alert';

interface Stage {
  key: 'cadastrado' | 'aberto' | 'qualificado' | 'em_uso' | 'encerrado';
  label: string;
  state: StageState;
  /** Sub-label (ex: "Segregado") em destaque vermelho. */
  alertLabel?: string;
}

function deriveStages(insumo: Insumo): Stage[] {
  const isTiraUro = insumo.tipo === 'tira-uro';
  const isOpen = insumo.dataAbertura !== null && insumo.dataAbertura !== undefined;
  const isQualified = insumo.qcStatus === 'aprovado';
  const inUse = (insumo.runCount ?? 0) > 0 && insumo.status === 'ativo';
  const closedStatuses = ['fechado', 'vencido', 'descartado', 'segregado'] as const;
  const isClosed = closedStatuses.includes(insumo.status as (typeof closedStatuses)[number]);
  const isSegregado = insumo.status === 'segregado';

  // Cadastrado — sempre done
  const cadastrado: Stage = { key: 'cadastrado', label: 'Cadastrado', state: 'done' };

  // Aberto
  const aberto: Stage = {
    key: 'aberto',
    label: 'Aberto',
    state: isOpen ? 'done' : isClosed ? 'future' : 'current',
  };

  // Qualificado — PR2 placeholder pra tira-uro
  let qualificado: Stage;
  if (isTiraUro) {
    qualificado = {
      key: 'qualificado',
      label: 'Qualificado',
      state: 'na',
      alertLabel: 'N/A — PR2',
    };
  } else if (isQualified) {
    qualificado = { key: 'qualificado', label: 'Qualificado', state: 'done' };
  } else if (insumo.qcStatus === 'reprovado') {
    qualificado = {
      key: 'qualificado',
      label: 'Qualificado',
      state: 'alert',
      alertLabel: 'Reprovado',
    };
  } else if (isOpen) {
    qualificado = { key: 'qualificado', label: 'Qualificado', state: 'current' };
  } else {
    qualificado = { key: 'qualificado', label: 'Qualificado', state: 'future' };
  }

  // Em uso
  const emUso: Stage = {
    key: 'em_uso',
    label: 'Em uso',
    state: inUse ? 'done' : isClosed ? 'future' : isQualified ? 'current' : 'future',
  };

  // Encerrado
  const encerrado: Stage = {
    key: 'encerrado',
    label: 'Encerrado',
    state: isClosed ? 'done' : 'future',
    alertLabel: isSegregado ? 'Segregado' : undefined,
  };

  return [cadastrado, aberto, qualificado, emUso, encerrado];
}

// ─── Step bubble ─────────────────────────────────────────────────────────────

function StepBubble({ stage, idx }: { stage: Stage; idx: number }) {
  const base =
    'inline-flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold border transition-colors';
  let cls: string;
  let icon: React.ReactNode;

  if (stage.state === 'done') {
    cls = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
    icon = <CheckIcon />;
  } else if (stage.state === 'current') {
    cls = 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.18)]';
    icon = <span>{idx + 1}</span>;
  } else if (stage.state === 'alert') {
    cls = 'bg-red-500/20 border-red-500/40 text-red-400';
    icon = <BanIcon />;
  } else if (stage.state === 'na') {
    cls = 'bg-white/[0.04] border-white/[0.1] text-white/30';
    icon = <DotIcon />;
  } else {
    cls = 'bg-white/[0.04] border-white/[0.08] text-white/35';
    icon = <span>{idx + 1}</span>;
  }
  return <span className={`${base} ${cls}`}>{icon}</span>;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface InsumoLifecycleBarProps {
  /** Lote (Insumo) cuja barra será renderizada. */
  insumo: Insumo;
  /** Variação compacta sem labels (para uso em listas densas). */
  compact?: boolean;
}

export function InsumoLifecycleBar({ insumo, compact = false }: InsumoLifecycleBarProps) {
  const stages = deriveStages(insumo);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        {stages.map((stage, idx) => (
          <React.Fragment key={stage.key}>
            <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
              <StepBubble stage={stage} idx={idx} />
              {!compact && (
                <div className="text-center">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      stage.state === 'current'
                        ? 'text-emerald-400'
                        : stage.state === 'done'
                          ? 'text-emerald-300/85'
                          : stage.state === 'alert'
                            ? 'text-red-400'
                            : 'text-white/40'
                    }`}
                  >
                    {stage.label}
                  </p>
                  {stage.alertLabel && (
                    <p
                      className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${
                        stage.state === 'alert' || stage.alertLabel === 'Segregado'
                          ? 'text-red-400'
                          : 'text-white/30'
                      }`}
                    >
                      {stage.alertLabel}
                    </p>
                  )}
                </div>
              )}
            </div>
            {idx < stages.length - 1 && (
              <div
                className={`flex-1 h-[2px] rounded-full ${
                  stages[idx + 1].state === 'done' || stages[idx + 1].state === 'current'
                    ? 'bg-emerald-500/30'
                    : stages[idx + 1].state === 'alert'
                      ? 'bg-red-500/30'
                      : 'bg-white/[0.06]'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
