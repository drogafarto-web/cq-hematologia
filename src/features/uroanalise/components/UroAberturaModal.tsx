/**
 * UroAberturaModal — modal de abertura de lote para CIQ-Uroanálise.
 *
 * Exibido imediatamente após o cadastro bem-sucedido de um lote de uroanálise
 * (tira ou controle). Registra o worklabId + observações do operador,
 * criando a abertura ativa via `createAbertura()`.
 *
 * Compliance: RDC 786/2023 art. 42 · RDC 978/2025.
 */

import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useUser, useActiveLabId } from '../../../store/useAuthStore';
import { createAbertura } from '../services/uroAberturaService';
import type { UroLoteTipo } from './UroLoteTipoSelector';

// ─── Constants ─────────────────────────────────────────────────────────────────

const WORKLAB_ID_REGEX = /^\d{1,10}$/;

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-amber-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

const TEXTAREA_CLS = `
  ${INPUT_CLS} resize-none min-h-[72px]
`.trim();

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PendingLot {
  id: string;
  tipo?: UroLoteTipo;
  nivel?: string;
  loteControle: string;
  fabricanteControle: string;
  validadeControle: string;
  /** Preenchido quando tipo === 'tira' */
  loteTira?: string;
  fabricanteTira?: string;
  validadeTira?: string;
  tiraNome?: string;
}

export interface UroAberturaModalProps {
  lot: PendingLot;
  onClose: () => void;
  onSuccess: (aberturaId: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function UroAberturaModal({ lot, onClose, onSuccess }: UroAberturaModalProps) {
  const labId = useActiveLabId();
  const user = useUser();

  const isTira = (lot.tipo ?? 'controle') === 'tira';

  const [worklabId, setWorklabId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!labId) {
      setError('Nenhum laboratório ativo.');
      return;
    }
    if (!user) {
      setError('Usuário não autenticado.');
      return;
    }

    const trimmed = worklabId.trim();
    if (!trimmed || !WORKLAB_ID_REGEX.test(trimmed)) {
      setError('Worklab ID inválido. Deve conter 1 a 10 dígitos.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const aberturaId = await createAbertura({
        labId,
        lotId: lot.id,
        worklabId: trimmed,
        abertoPor: user.uid,
        abertoPorNome: user.displayName ?? user.email ?? 'Operador',
        snapshotLote: {
          tipo: isTira ? 'tira' : 'controle',
          lote: isTira ? (lot.loteTira ?? lot.loteControle) : lot.loteControle,
          fabricante: isTira
            ? (lot.fabricanteTira ?? lot.fabricanteControle)
            : lot.fabricanteControle,
          validade: isTira ? (lot.validadeTira ?? lot.validadeControle) : lot.validadeControle,
          ...(lot.nivel && !isTira && { nivel: lot.nivel as 'N' | 'P' }),
          ...(isTira && lot.tiraNome && { tiraNome: lot.tiraNome }),
        },
        observacoes: observacoes.trim() || undefined,
      });
      onSuccess(aberturaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar abertura.');
    } finally {
      setSubmitting(false);
    }
  }

  const loteDisplay = isTira ? (lot.loteTira ?? lot.loteControle) : lot.loteControle;
  const fabDisplay = isTira
    ? (lot.fabricanteTira ?? lot.fabricanteControle)
    : lot.fabricanteControle;
  const valDisplay = isTira ? (lot.validadeTira ?? lot.validadeControle) : lot.validadeControle;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="abertura-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2
              id="abertura-title"
              className="text-base font-semibold text-slate-900 dark:text-white/90"
            >
              Registrar abertura
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {isTira ? 'Abertura de lote de tiras reagentes' : 'Abertura de lote de controle'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Snapshot info */}
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] p-4">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 mb-2">
              Informações do lote
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <span className="text-slate-500 dark:text-white/45">Lote:</span>
              <span className="text-slate-900 dark:text-white/85 font-medium text-right font-mono">
                {loteDisplay}
              </span>
              <span className="text-slate-500 dark:text-white/45">Fabricante:</span>
              <span className="text-slate-900 dark:text-white/85 font-medium text-right">
                {fabDisplay}
              </span>
              <span className="text-slate-500 dark:text-white/45">Validade:</span>
              <span className="text-slate-900 dark:text-white/85 font-medium text-right font-mono">
                {valDisplay ? new Date(valDisplay + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
              </span>
              {lot.nivel && !isTira && (
                <>
                  <span className="text-slate-500 dark:text-white/45">Nível:</span>
                  <span className="text-slate-900 dark:text-white/85 font-medium text-right">
                    {lot.nivel === 'N' ? 'Normal' : 'Patológico'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Worklab ID */}
          <div>
            <label
              htmlFor="worklabId"
              className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5"
            >
              Worklab ID <span className="text-red-500">*</span>
            </label>
            <input
              id="worklabId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              className={INPUT_CLS}
              value={worklabId}
              onChange={(e) => setWorklabId(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="ex: 123456"
            />
            <p className="text-[11px] text-slate-400 dark:text-white/30 mt-1">
              ID sequencial do worklist no Worklab (1 a 10 dígitos).
            </p>
          </div>

          {/* Observações */}
          <div>
            <label
              htmlFor="obs"
              className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5"
            >
              Observações
              <span className="text-slate-400 dark:text-white/25 font-normal ml-1">(opcional)</span>
            </label>
            <textarea
              id="obs"
              className={TEXTAREA_CLS}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Lote recebido e aberto para rotina..."
              maxLength={500}
            />
            <p className="text-[11px] text-right text-slate-400 dark:text-white/25 mt-1">
              {observacoes.length}/500
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 h-10 rounded-xl text-sm font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-sm font-medium"
            >
              {submitting ? 'Registrando…' : 'Registrar abertura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UroAberturaModal;
