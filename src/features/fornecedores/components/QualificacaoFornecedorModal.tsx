/**
 * QualificacaoFornecedorModal — qualificação inicial (ou substituição via RT) com callable + assinatura lógica.
 */

import React, { useCallback, useState } from 'react';
import { FirebaseError } from 'firebase/app';

import {
  functions,
  httpsCallable,
  Timestamp,
} from '../../../shared/services/firebase';
import { useUser } from '../../../store/useAuthStore';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

const CATEGORIAS = [
  { id: 'reagentes', label: 'Reagentes' },
  { id: 'consumiveis', label: 'Consumíveis' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'outros', label: 'Outros' },
] as const;

type CategoriaId = (typeof CATEGORIAS)[number]['id'];

type QualificarPayload = {
  labId: string;
  fornecedorId: string;
  criteriosDocumentados: string;
  categorias: string[];
  logicalSignature: {
    hash: string;
    operatorId: string;
    ts: Timestamp;
  };
};

type QualificarResult = { ok: true };

const callQualificarFornecedor = httpsCallable<QualificarPayload, QualificarResult>(
  functions,
  'qualificarFornecedor',
);

function sortedStringify(data: Record<string, string | number>): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, string | number>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildLogicalSignature(
  operatorId: string,
  fornecedorId: string,
  criteriosDocumentados: string,
  categorias: string[],
): Promise<{ hash: string; operatorId: string; ts: Timestamp }> {
  const ts = Timestamp.now();
  const dataPart: Record<string, string | number> = {
    categorias: [...categorias].sort().join('|'),
    criteriosDocumentados: criteriosDocumentados.trim(),
    fornecedorId,
  };
  const dataString = JSON.stringify({
    operatorId,
    ts: ts.toMillis(),
    data: sortedStringify(dataPart),
  });
  const hash = await sha256Hex(dataString);
  return { hash, operatorId, ts };
}

export interface QualificacaoFornecedorModalProps {
  labId: string;
  fornecedorId: string;
  onClose: () => void;
  /** Chamado após sucesso — ex.: refetch / invalidar cache do fornecedor. */
  onSuccess?: () => void;
}

export function QualificacaoFornecedorModal({
  labId,
  fornecedorId,
  onClose,
  onSuccess,
}: QualificacaoFornecedorModalProps) {
  const user = useUser();
  const [criteriosDocumentados, setCriteriosDocumentados] = useState('');
  const [selected, setSelected] = useState<Set<CategoriaId>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleCategoria = useCallback((id: CategoriaId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    if (!user) {
      setSubmitError('Usuário não autenticado.');
      return;
    }
    const crit = criteriosDocumentados.trim();
    if (!crit) {
      setSubmitError('Descreva os critérios documentados.');
      return;
    }
    const categorias = Array.from(selected);
    if (categorias.length === 0) {
      setSubmitError('Selecione ao menos uma categoria.');
      return;
    }

    setSubmitting(true);
    try {
      const logicalSignature = await buildLogicalSignature(
        user.uid,
        fornecedorId,
        crit,
        categorias,
      );
      await callQualificarFornecedor({
        labId,
        fornecedorId,
        criteriosDocumentados: crit,
        categorias,
        logicalSignature,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg =
        err instanceof FirebaseError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível registrar a qualificação.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && !submitting && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qualificacao-fornecedor-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-start justify-between gap-4 sticky top-0 bg-white dark:bg-[#0F1318] z-10">
          <div>
            <h2
              id="qualificacao-fornecedor-title"
              className="text-base font-semibold text-slate-900 dark:text-white/90"
            >
              Qualificar fornecedor
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              Registro documental e categorias de fornecimento. Ação auditada no laboratório.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80 transition-colors"
            aria-label="Fechar"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label
              htmlFor="qual-criterios"
              className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
            >
              Critérios documentados
              <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>
            </label>
            <textarea
              id="qual-criterios"
              rows={5}
              value={criteriosDocumentados}
              onChange={(e) => setCriteriosDocumentados(e.target.value)}
              disabled={submitting}
              className={INPUT_CLS}
              placeholder="Descreva os critérios avaliados e a documentação verificada."
            />
          </div>

          <fieldset>
            <legend className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-2 ml-0.5">
              Categorias
              <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map((c) => {
                const active = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => toggleCategoria(c.id)}
                    aria-pressed={active}
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-medium border transition-all duration-150',
                      active
                        ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                        : 'border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-white/55 hover:border-white/20',
                      submitting ? 'opacity-40' : '',
                    ].join(' ')}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {submitError && (
            <p
              className="text-xs text-red-500 dark:text-red-400/85 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2"
              role="alert"
            >
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white shadow-sm disabled:opacity-50 transition-colors duration-150"
            >
              {submitting ? 'Registrando…' : 'Qualificar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
