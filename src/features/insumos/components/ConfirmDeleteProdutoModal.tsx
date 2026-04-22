/**
 * ConfirmDeleteProdutoModal — confirmação de exclusão de produto do catálogo.
 *
 * Dupla proteção antes de deletar:
 *   1. Conta lotes (Insumos) vinculados ao produto — se > 0, bloqueia com
 *      instrução pra descartar/descadastrar os lotes primeiro. Integridade
 *      referencial do histórico de CQ depende disso.
 *   2. Exige marcação de um checkbox de confirmação — previne clique
 *      acidental. Ação é hard-delete (sem soft-delete no modelo atual).
 */

import React, { useEffect, useState } from 'react';
import {
  countInsumosByProduto,
  deleteProduto,
} from '../services/produtoInsumoService';
import type { ProdutoInsumo } from '../types/ProdutoInsumo';

interface ConfirmDeleteProdutoModalProps {
  labId: string;
  produto: ProdutoInsumo;
  onClose: () => void;
  onDeleted?: (produtoId: string) => void;
}

export function ConfirmDeleteProdutoModal({
  labId,
  produto,
  onClose,
  onDeleted,
}: ConfirmDeleteProdutoModalProps) {
  const [lotesCount, setLotesCount] = useState<number | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    countInsumosByProduto(labId, produto.id)
      .then((n) => {
        if (!cancelled) setLotesCount(n);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [labId, produto.id]);

  const isLoading = lotesCount === null && !error;
  const hasLotes = (lotesCount ?? 0) > 0;
  const canDelete = !isLoading && !hasLotes && confirmChecked && !deleting;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteProduto(labId, produto.id);
      onDeleted?.(produto.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir produto.');
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-produto-title"
        className="w-full max-w-md bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <header className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <p
            id="delete-produto-title"
            className="text-sm font-semibold text-slate-900 dark:text-white/90"
          >
            Excluir produto do catálogo
          </p>
          <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
            {produto.fabricante} · {produto.nomeComercial}
          </p>
        </header>

        <div className="p-5 space-y-4">
          {isLoading && (
            <p className="text-xs text-slate-500 dark:text-white/40">
              Verificando lotes vinculados…
            </p>
          )}

          {!isLoading && hasLotes && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <p className="font-semibold mb-1">Exclusão bloqueada</p>
              <p>
                {lotesCount} {lotesCount === 1 ? 'lote vinculado' : 'lotes vinculados'} a
                este produto. Descarte ou remova os lotes primeiro pra preservar a cadeia
                de rastreabilidade.
              </p>
            </div>
          )}

          {!isLoading && !hasLotes && (
            <>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 leading-relaxed">
                <p className="font-semibold mb-1">Ação permanente</p>
                <p>
                  O produto será removido definitivamente do catálogo. Nenhum lote está
                  vinculado — operação segura em termos de integridade.
                </p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-white/20 text-red-600 focus:ring-red-500"
                />
                <span className="text-xs text-slate-700 dark:text-white/70 leading-relaxed">
                  Confirmo que quero excluir <strong>{produto.nomeComercial}</strong> do
                  catálogo deste lab.
                </span>
              </label>
            </>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 h-9 rounded-lg text-xs font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
          >
            {hasLotes ? 'Fechar' : 'Cancelar'}
          </button>
          {!hasLotes && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="px-4 h-9 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all"
            >
              {deleting ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
