/**
 * RotacaoLoteSuggestion — modal-step que aparece depois de cadastrar um lote
 * novo quando existe outro lote ativo do mesmo produto.
 *
 * Fluxo:
 *   - Lote novo FECHADO + ativo anterior → sugere "Ativar novo e encerrar anterior"
 *     (transação atômica via rotateInsumoLote)
 *   - Lote novo ATIVO + ativo anterior    → sugere "Encerrar lote anterior"
 *
 * Operador pode recusar e gerir manualmente depois — o cadastro do novo lote
 * já está persistido. A sugestão é assistência operacional, não fluxo mandatório.
 */

import { useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import { rotateInsumoLote } from '../services/insumosFirebaseService';
import type { Insumo } from '../types/Insumo';

interface RotacaoLoteSuggestionProps {
  labId: string;
  novoInsumo: Pick<Insumo, 'id' | 'nomeComercial' | 'lote' | 'validade' | 'diasEstabilidadeAbertura' | 'tipo' | 'status'>;
  loteAnterior: Pick<Insumo, 'id' | 'nomeComercial' | 'lote' | 'validadeReal'>;
  onFinish: () => void;
}

export function RotacaoLoteSuggestion({
  labId,
  novoInsumo,
  loteAnterior,
  onFinish,
}: RotacaoLoteSuggestionProps) {
  const user = useUser();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const novoEstaAtivo = novoInsumo.status === 'ativo';
  const actionLabel = novoEstaAtivo
    ? 'Encerrar lote anterior'
    : 'Ativar novo lote e encerrar anterior';
  const descricao = novoEstaAtivo
    ? `O lote ${novoInsumo.lote} foi cadastrado já em uso. Manter o lote anterior ${loteAnterior.lote} também ativo cria ambiguidade na rotina — recomendamos fechar o anterior.`
    : `O lote anterior ${loteAnterior.lote} está em uso hoje. Ativar o novo ${novoInsumo.lote} e encerrar o anterior — 1 clique — mantém o equipamento com um único lote em operação.`;

  async function confirm() {
    if (!user) {
      setError('Usuário não autenticado.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const operadorName = user.displayName || user.email?.split('@')[0] || 'Operador';
      await rotateInsumoLote(labId, {
        oldInsumoId: loteAnterior.id,
        newInsumoId: novoInsumo.id,
        newAlreadyActive: novoEstaAtivo,
        newInsumo: {
          validade: novoInsumo.validade,
          diasEstabilidadeAbertura: novoInsumo.diasEstabilidadeAbertura,
          tipo: novoInsumo.tipo,
        },
        operadorId: user.uid,
        operadorName,
      });
      onFinish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao rotacionar lote.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rotacao-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && !submitting && onFinish()}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.06] bg-gradient-to-br from-violet-50 dark:from-violet-500/[0.08] to-transparent">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-violet-500/15 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 12a9 9 0 0115-6.7L21 8" />
                <path d="M21 4v4h-4" />
                <path d="M21 12a9 9 0 01-15 6.7L3 16" />
                <path d="M3 20v-4h4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="rotacao-title"
                className="text-base font-semibold text-slate-900 dark:text-white/90"
              >
                Rotação de lote detectada
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5 truncate">
                {novoInsumo.nomeComercial}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-700 dark:text-white/75 leading-relaxed">{descricao}</p>

          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/40">
                  Lote anterior
                </p>
                <p className="font-mono text-sm text-slate-800 dark:text-white/80">
                  {loteAnterior.lote}
                </p>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="text-slate-400 dark:text-white/30"
                aria-hidden
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-600 dark:text-emerald-400">
                  Novo lote
                </p>
                <p className="font-mono text-sm text-slate-800 dark:text-white/80">
                  {novoInsumo.lote}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-white/40 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
              Cada movimentação é registrada no audit trail com timestamp servidor e assinatura
              criptográfica (RDC 978/2025).
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onFinish}
            disabled={submitting}
            className="px-4 h-9 rounded-lg text-sm font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05] disabled:opacity-50"
          >
            Deixar pra depois
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="px-4 h-9 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white text-sm font-semibold shadow-sm shadow-violet-500/20"
          >
            {submitting ? 'Aplicando…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
