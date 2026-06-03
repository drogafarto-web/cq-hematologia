/**
 * AvaliacaoFornecedorModal — avaliação periódica + histórico (callable + assinatura lógica).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';

import { functions, httpsCallable, Timestamp } from '../../../shared/services/firebase';
import { useUser } from '../../../store/useAuthStore';
import { useAvaliacoesFornecedor } from '../hooks/useAvaliacoesFornecedor';
import type {
  AvaliacaoFornecedor,
  CriteriosAvaliadosFornecedor,
  ResultadoAvaliacaoFornecedor,
} from '../types/AvaliacaoFornecedor';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

const RESULTADOS: { value: ResultadoAvaliacaoFornecedor; label: string }[] = [
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'aprovado_com_ressalva', label: 'Aprovado com ressalva' },
  { value: 'reprovado', label: 'Reprovado' },
];

const CRITERIOS: {
  key: keyof CriteriosAvaliadosFornecedor;
  label: string;
}[] = [
  { key: 'prazoEntrega', label: 'Prazo de entrega' },
  { key: 'qualidadeProduto', label: 'Qualidade do produto/serviço' },
  { key: 'documentacaoCorreta', label: 'Documentação correta' },
  { key: 'atendimento', label: 'Atendimento' },
];

type RegistrarPayload = {
  labId: string;
  fornecedorId: string;
  resultado: ResultadoAvaliacaoFornecedor;
  criteriosAvaliados: CriteriosAvaliadosFornecedor;
  observacoes?: string;
  logicalSignature: {
    hash: string;
    operatorId: string;
    ts: Timestamp;
  };
};

type RegistrarResult = { ok: true; avaliacaoId: string };

const callRegistrarAvaliacao = httpsCallable<RegistrarPayload, RegistrarResult>(
  functions,
  'registrarAvaliacaoFornecedor',
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
  resultado: ResultadoAvaliacaoFornecedor,
  criteriosAvaliados: CriteriosAvaliadosFornecedor,
  observacoes: string,
): Promise<{ hash: string; operatorId: string; ts: Timestamp }> {
  const ts = Timestamp.now();
  const dataPart: Record<string, string | number> = {
    atendimento: criteriosAvaliados.atendimento ? 1 : 0,
    documentacaoCorreta: criteriosAvaliados.documentacaoCorreta ? 1 : 0,
    fornecedorId,
    observacoes: observacoes.trim(),
    prazoEntrega: criteriosAvaliados.prazoEntrega ? 1 : 0,
    qualidadeProduto: criteriosAvaliados.qualidadeProduto ? 1 : 0,
    resultado,
  };
  const dataString = JSON.stringify({
    operatorId,
    ts: ts.toMillis(),
    data: sortedStringify(dataPart),
  });
  const hash = await sha256Hex(dataString);
  return { hash, operatorId, ts };
}

function resultadoLabel(r: ResultadoAvaliacaoFornecedor): string {
  const found = RESULTADOS.find((x) => x.value === r);
  return found?.label ?? r;
}

function formatData(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export interface AvaliacaoFornecedorModalProps {
  labId: string;
  fornecedorId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AvaliacaoFornecedorModal({
  labId,
  fornecedorId,
  onClose,
  onSuccess,
}: AvaliacaoFornecedorModalProps) {
  const user = useUser();
  const {
    avaliacoes,
    loading: loadingHist,
    error: histError,
  } = useAvaliacoesFornecedor(fornecedorId);

  const [resultado, setResultado] = useState<ResultadoAvaliacaoFornecedor>('aprovado');
  const [criterios, setCriterios] = useState<CriteriosAvaliadosFornecedor>({
    prazoEntrega: false,
    qualidadeProduto: false,
    documentacaoCorreta: false,
    atendimento: false,
  });
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleCriterio = useCallback((key: keyof CriteriosAvaliadosFornecedor) => {
    setCriterios((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const historicoOrdenado = useMemo(() => avaliacoes, [avaliacoes]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    if (!user) {
      setSubmitError('Usuário não autenticado.');
      return;
    }

    setSubmitting(true);
    try {
      const logicalSignature = await buildLogicalSignature(
        user.uid,
        fornecedorId,
        resultado,
        criterios,
        observacoes,
      );
      const payload: RegistrarPayload = {
        labId,
        fornecedorId,
        resultado,
        criteriosAvaliados: criterios,
        logicalSignature,
      };
      const obsTrim = observacoes.trim();
      if (obsTrim.length > 0) {
        payload.observacoes = obsTrim;
      }
      await callRegistrarAvaliacao(payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg =
        err instanceof FirebaseError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível registrar a avaliação.';
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
        aria-labelledby="avaliacao-fornecedor-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col"
      >
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-start justify-between gap-4 shrink-0 bg-white dark:bg-[#0F1318] sticky top-0 z-10">
          <div>
            <h2
              id="avaliacao-fornecedor-title"
              className="text-base font-semibold text-slate-900 dark:text-white/90"
            >
              Avaliação periódica
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              Registro auditado no fornecedor do laboratório.
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

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 shrink-0">
          <fieldset>
            <legend className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-2 ml-0.5">
              Resultado
            </legend>
            <div className="flex flex-col gap-2">
              {RESULTADOS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 cursor-pointer rounded-xl border border-slate-200 dark:border-white/[0.08] px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] has-[:checked]:border-violet-500/40 has-[:checked]:bg-violet-500/5 transition-colors"
                >
                  <input
                    type="radio"
                    name="resultado-avaliacao"
                    value={opt.value}
                    checked={resultado === opt.value}
                    onChange={() => setResultado(opt.value)}
                    disabled={submitting}
                    className="accent-violet-600"
                  />
                  <span className="text-sm text-slate-800 dark:text-white/85">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-2 ml-0.5">
              Critérios avaliados
            </legend>
            <div className="space-y-2">
              {CRITERIOS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 dark:text-white/75"
                >
                  <input
                    type="checkbox"
                    checked={criterios[key]}
                    onChange={() => toggleCriterio(key)}
                    disabled={submitting}
                    className="rounded border-slate-300 dark:border-white/20 accent-violet-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="avaliacao-obs"
              className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
            >
              Observações (opcional)
            </label>
            <textarea
              id="avaliacao-obs"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={submitting}
              className={INPUT_CLS}
              placeholder="Detalhes adicionais da avaliação."
            />
          </div>

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
              {submitting ? 'Registrando…' : 'Registrar avaliação'}
            </button>
          </div>
        </form>

        <div className="border-t border-slate-200 dark:border-white/[0.06] px-6 py-4 bg-slate-50/80 dark:bg-black/20">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/40 mb-3">
            Histórico
          </h3>
          {histError && (
            <p className="text-xs text-red-500 dark:text-red-400/80" role="alert">
              {histError.message}
            </p>
          )}
          {!histError && loadingHist && (
            <p className="text-xs text-slate-500 dark:text-white/45">Carregando…</p>
          )}
          {!histError && !loadingHist && historicoOrdenado.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-white/45">Nenhuma avaliação anterior.</p>
          )}
          {!histError && !loadingHist && historicoOrdenado.length > 0 && (
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {historicoOrdenado.map((a: AvaliacaoFornecedor) => (
                <li
                  key={a.id}
                  className="text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-slate-700 dark:text-white/75"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-white/90">
                      {resultadoLabel(a.resultado)}
                    </span>
                    <span className="text-slate-500 dark:text-white/40 shrink-0 tabular-nums">
                      {formatData(a.data)}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-white/45 mt-0.5">
                    {a.responsavelNome}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
