/**
 * ManualKitPicker — substitui o ConferenciaInsumoAtivo em corridas de testes
 * manuais (kits lidos a olho: PCR látex, VDRL em lâmina, cartela imuno,
 * tira de uroanálise sem leitor).
 *
 * Aqui o operador NÃO confirma um setup prévio — ele escolhe o kit na hora.
 * Um picker por slot (reagente + controle positivo + controle negativo, ou
 * tira + controle para Uro). Campo `testTypesCompativeis` do insumo é usado
 * para ordenar candidatos (compatíveis primeiro). Confirmação obrigatória
 * igual à ConferênciaInsumoAtivo — sem ela o save é bloqueado.
 *
 * Fase F — 2026-04-24.
 */

import React from 'react';
import { validadeStatus, diasAteVencer } from '../utils/validadeReal';
import { evaluateInsumoUsability } from '../utils/insumoUsability';
import type { Insumo } from '../types/Insumo';
import type { ManualSlot } from '../hooks/useManualKitGuard';

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
  children: React.ReactNode;
}) {
  const cls = {
    ok: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    warn: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    bad: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
    neutral: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-white/40',
  }[tone];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}
    >
      {children}
    </span>
  );
}

function insumoBadge(insumo: Insumo | null): React.ReactNode {
  if (!insumo) return <StatusBadge tone="neutral">não selecionado</StatusBadge>;
  const u = evaluateInsumoUsability(insumo);
  if (!u.ok) {
    if (u.motivo === 'vencido') return <StatusBadge tone="bad">VENCIDO</StatusBadge>;
    return <StatusBadge tone="warn">{u.motivo}</StatusBadge>;
  }
  const v = validadeStatus(insumo.validadeReal.toDate());
  if (v === 'warning') {
    return <StatusBadge tone="warn">vence em {diasAteVencer(insumo.validadeReal.toDate())}d</StatusBadge>;
  }
  return <StatusBadge tone="ok">OK</StatusBadge>;
}

// ─── Slot select ─────────────────────────────────────────────────────────────

const SELECT = [
  'w-full px-3 py-2 rounded-lg text-sm',
  'bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]',
  'text-slate-900 dark:text-white/85',
  'focus:outline-none focus:border-violet-500/50 dark:focus:border-violet-500/50',
  'disabled:opacity-40',
].join(' ');

function SlotPicker({
  label,
  required,
  value,
  options,
  onChange,
  emptyMessage,
}: {
  label: string;
  required: boolean;
  value: string | null;
  options: Insumo[];
  onChange: (id: string | null) => void;
  emptyMessage: string;
}) {
  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <div className="rounded-lg bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-semibold">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </div>
        {insumoBadge(selected)}
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-white/30 italic">
          {emptyMessage}
        </p>
      ) : (
        <>
          <select
            className={SELECT}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            aria-label={label}
          >
            <option value="">— selecione um lote —</option>
            {options.map((i) => {
              const d = diasAteVencer(i.validadeReal.toDate());
              const venc = d < 0 ? 'VENCIDO' : `vence em ${d}d`;
              return (
                <option key={i.id} value={i.id}>
                  {i.nomeComercial} · Lote {i.lote} · {i.fabricante} · {venc}
                </option>
              );
            })}
          </select>
          {selected && (
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/40">
              Lote {selected.lote} · {selected.fabricante} · vence{' '}
              {selected.validadeReal.toDate().toLocaleDateString('pt-BR')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface ManualKitPickerSlotConfig {
  slot: ManualSlot;
  label: string;
  required: boolean;
  /** Mensagem exibida quando não há opções — guia o operador pro cadastro. */
  emptyMessage: string;
}

interface ManualKitPickerProps {
  /** Título curto do cabeçalho (ex: "Kit manual · PCR"). */
  title: string;
  /** Subtítulo opcional com detalhe do teste. */
  subtitle?: string;
  slots: ManualKitPickerSlotConfig[];
  selection: Record<ManualSlot, string | null>;
  resolved: Record<ManualSlot, Insumo | null>;
  candidates: Record<ManualSlot, Insumo[]>;
  onSlotChange: (slot: ManualSlot, insumoId: string | null) => void;
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
  /** Callback opcional pra botão de atalho — abre cadastro de insumos. */
  onCadastrarInsumo?: () => void;
}

export function ManualKitPicker({
  title,
  subtitle,
  slots,
  selection,
  resolved,
  candidates,
  onSlotChange,
  confirmed,
  onConfirmedChange,
  onCadastrarInsumo,
}: ManualKitPickerProps) {
  const slotsFaltando = slots.filter((s) => s.required && !resolved[s.slot]);
  const incompleto = slotsFaltando.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0F1318] p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-violet-500 dark:text-violet-300/80 font-semibold">
            Teste manual · sem equipamento
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white/90 mt-0.5">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">{subtitle}</p>
          )}
        </div>
        {onCadastrarInsumo && (
          <button
            type="button"
            onClick={onCadastrarInsumo}
            className="text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            Cadastrar insumo →
          </button>
        )}
      </div>

      <div className="space-y-2 mb-3">
        {slots.map((cfg) => (
          <SlotPicker
            key={cfg.slot}
            label={cfg.label}
            required={cfg.required}
            value={selection[cfg.slot]}
            options={candidates[cfg.slot]}
            onChange={(id) => onSlotChange(cfg.slot, id)}
            emptyMessage={cfg.emptyMessage}
          />
        ))}
      </div>

      {incompleto && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-[12px] text-red-700 dark:text-red-300">
            Selecione {slotsFaltando.map((s) => s.label.toLowerCase()).join(', ')} antes de salvar.
          </p>
        </div>
      )}

      <label className="flex items-start gap-2.5 cursor-pointer select-none p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-all">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          disabled={incompleto}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-white/20 text-violet-600 focus:ring-violet-500 disabled:opacity-40"
        />
        <span className="text-[13px] text-slate-700 dark:text-white/75 leading-snug">
          Confirmo que estes kits estão sendo usados nesta corrida.
        </span>
      </label>
    </div>
  );
}
