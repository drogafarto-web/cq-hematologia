/**
 * OverrideModal — modal de justificativa obrigatória para rodar corrida com
 * insumo em estado de bloqueio (vencido / CQ pendente / Imuno não aprovado).
 *
 * Fase B1 (2026-04-21) — decisão CTO: qualquer operador pode fazer override
 * mediante justificativa obrigatória + log imutável + destaque em relatórios.
 * "Rodar sem setup configurado" NÃO tem override (bloqueio rígido).
 *
 * Contrato: modal é controlled. Pai abre quando `evaluateInsumoUsability`
 * retorna não-ok E decide prosseguir (após clicar "Salvar"). Callback
 * `onConfirm({ motivo, type, insumoId })` dispara a persistência + o registro
 * da transition no log.
 */

import React, { useState } from 'react';
import { motivoToTransitionType } from '../utils/insumoUsability';
import type { InsumoBloqueioMotivo } from '../utils/insumoUsability';
import type { InsumoTransitionType } from '../types/InsumoTransition';

export interface OverrideContext {
  /** Lista de bloqueios que dispararam o override. Múltiplos são possíveis
   *  (ex: reagente vencido + controle com QC pendente). */
  bloqueios: Array<{
    slot: 'reagente' | 'controle' | 'tira';
    insumoId: string;
    insumoNome: string;
    lote: string;
    motivo: InsumoBloqueioMotivo;
    mensagem: string;
  }>;
}

export interface OverrideResult {
  justificativa: string;
  /**
   * Tipo de transition a logar — escolhido automaticamente pelo motivo
   * mais severo. O caller pode usar para criar transitions individuais.
   */
  transitionType: InsumoTransitionType;
}

interface OverrideModalProps {
  open: boolean;
  context: OverrideContext;
  onCancel: () => void;
  onConfirm: (result: OverrideResult) => void | Promise<void>;
}

const BADGE_CLS: Record<InsumoBloqueioMotivo, string> = {
  vencido: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
  'qc-pendente': 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
  'imuno-nao-aprovado': 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
  descartado: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
};

const MOTIVO_LABEL: Record<InsumoBloqueioMotivo, string> = {
  vencido: 'VENCIDO',
  'qc-pendente': 'CQ PENDENTE',
  'imuno-nao-aprovado': 'SEM APROVAÇÃO DE LOTE',
  descartado: 'DESCARTADO',
};

export function OverrideModal({ open, context, onCancel, onConfirm }: OverrideModalProps) {
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  // Tipo de transition derivado do motivo mais severo (vencido ganha).
  const hasVencido = context.bloqueios.some((b) => b.motivo === 'vencido');
  const transitionType: InsumoTransitionType = hasVencido
    ? 'override-vencido'
    : motivoToTransitionType(context.bloqueios[0]?.motivo ?? 'qc-pendente');

  async function handleSubmit() {
    const trimmed = motivo.trim();
    if (trimmed.length < 10) {
      setError('Justificativa deve ter pelo menos 10 caracteres — auditor precisa de contexto.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ justificativa: trimmed, transitionType });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar override.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0"
        onClick={submitting ? undefined : onCancel}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] shadow-2xl">
        <header className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <p className="text-sm font-semibold text-slate-900 dark:text-white/90">
            Override auditado
          </p>
          <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
            Um ou mais insumos exigem justificativa para uso. Registro imutável.
          </p>
        </header>

        <div className="px-5 py-4">
          <ul className="space-y-2 mb-4">
            {context.bloqueios.map((b, i) => (
              <li
                key={`${b.insumoId}-${i}`}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05]"
              >
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${BADGE_CLS[b.motivo]}`}
                >
                  {MOTIVO_LABEL[b.motivo]}
                </span>
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-medium text-slate-800 dark:text-white/80">
                    {b.insumoNome} — Lote {b.lote}
                  </p>
                  <p className="text-slate-500 dark:text-white/45 mt-0.5">{b.mensagem}</p>
                </div>
              </li>
            ))}
          </ul>

          <label className="block">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40">
              Justificativa *
            </span>
            <textarea
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={submitting}
              placeholder="Ex: lote novo em trânsito, prazo de substituição excedido por atraso do fornecedor."
              rows={4}
              className="mt-1.5 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-sm placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-violet-500/50 resize-none"
            />
            <p className="text-[11px] text-slate-500 dark:text-white/35 mt-1">
              Mínimo 10 caracteres. Esta justificativa fica no histórico do insumo e aparece
              destacada nos relatórios auditáveis.
            </p>
          </label>

          {error && (
            <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 h-9 rounded-lg text-xs font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all disabled:opacity-60"
          >
            {submitting ? 'Registrando…' : 'Confirmar com override'}
          </button>
        </footer>
      </div>
    </div>
  );
}
