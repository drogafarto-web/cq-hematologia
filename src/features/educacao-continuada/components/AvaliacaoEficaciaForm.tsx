import { useMemo, useState, type FormEvent } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useAvaliacaoEficacia } from '../hooks/useAvaliacaoEficacia';
import { useExecucoes } from '../hooks/useExecucoes';
import { useTreinamentos } from '../hooks/useTreinamentos';
import type {
  Execucao,
  ResultadoEficacia,
} from '../types/EducacaoContinuada';

import { Field, inputClass, selectClass } from './_formPrimitives';

export interface AvaliacaoEficaciaFormProps {
  /** Quando fornecido, fixa a avaliação à execução (esconde o select). */
  execucaoId?: string;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  execucaoId: string;
  resultado: ResultadoEficacia;
  evidencia: string;
  dataAvaliacao: string;
  acaoCorretiva: string;
  fechar: boolean;
}

interface FormErrors {
  execucaoId?: string;
  evidencia?: string;
  dataAvaliacao?: string;
  acaoCorretiva?: string;
  submit?: string;
}

const RESULTADO_OPTIONS: ReadonlyArray<{ value: ResultadoEficacia; label: string }> = [
  { value: 'eficaz', label: 'Eficaz' },
  { value: 'ineficaz', label: 'Ineficaz (aciona FR-013)' },
];

function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateInputToTs(s: string): Timestamp | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return Timestamp.fromDate(new Date(y, m - 1, d, 0, 0, 0));
}

export function AvaliacaoEficaciaForm({
  execucaoId,
  onSaved,
  onCancel,
}: AvaliacaoEficaciaFormProps) {
  const { execucoes } = useExecucoes({ status: 'realizado' });
  const { treinamentos } = useTreinamentos({ includeDeleted: true });
  const { registrar, isSaving } = useAvaliacaoEficacia();

  const [state, setState] = useState<FormState>({
    execucaoId: execucaoId ?? '',
    resultado: 'eficaz',
    evidencia: '',
    dataAvaliacao: todayInputValue(),
    acaoCorretiva: '',
    fechar: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const execucaoSelecionada = useMemo<Execucao | null>(
    () => execucoes.find((e) => e.id === state.execucaoId) ?? null,
    [execucoes, state.execucaoId],
  );

  const tituloPorExec = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of treinamentos) m.set(t.id, t.titulo);
    return (exec: Execucao): string => m.get(exec.treinamentoId) ?? exec.treinamentoId;
  }, [treinamentos]);

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const errs: FormErrors = {};
    if (!state.execucaoId) errs.execucaoId = 'Selecione uma execução realizada.';
    if (state.evidencia.trim().length === 0) errs.evidencia = 'Evidência é obrigatória.';
    if (!state.dataAvaliacao) errs.dataAvaliacao = 'Informe a data da avaliação.';
    if (
      state.resultado === 'ineficaz' &&
      state.fechar &&
      state.acaoCorretiva.trim().length === 0
    ) {
      errs.acaoCorretiva = 'RN-02: ação corretiva obrigatória para fechar avaliação ineficaz.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const dataAvaliacao = dateInputToTs(state.dataAvaliacao);
    if (!dataAvaliacao) {
      setErrors({ dataAvaliacao: 'Data inválida.' });
      return;
    }

    try {
      await registrar({
        execucaoId: state.execucaoId,
        resultado: state.resultado,
        evidencia: state.evidencia,
        dataAvaliacao,
        acaoCorretiva:
          state.acaoCorretiva.trim().length > 0 ? state.acaoCorretiva : undefined,
        fechar: state.fechar,
      });
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar.';
      setErrors({ submit: message });
    }
  };

  const mostrarAcaoCorretiva = state.resultado === 'ineficaz';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">Avaliação de eficácia</h2>
        <p className="text-sm text-slate-400">
          Registro FR-001 (bloco inferior). Ineficaz com ação corretiva preenchida alimenta FR-013.
        </p>
      </header>

      {!execucaoId && (
        <Field id="avef-execucao" label="Execução" required error={errors.execucaoId}>
          <select
            id="avef-execucao"
            value={state.execucaoId}
            onChange={(e) => handleChange('execucaoId', e.target.value)}
            disabled={isSaving}
            aria-label="Execução avaliada"
            className={selectClass()}
          >
            <option value="">Selecione…</option>
            {execucoes.map((e) => (
              <option key={e.id} value={e.id}>
                {tituloPorExec(e)} — {e.dataAplicacao?.toDate().toLocaleDateString('pt-BR') ?? 's/data'}
              </option>
            ))}
          </select>
        </Field>
      )}

      {execucaoId && execucaoSelecionada && (
        <div className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
          Avaliando: <span className="font-medium text-slate-200">{tituloPorExec(execucaoSelecionada)}</span> — {execucaoSelecionada.dataAplicacao?.toDate().toLocaleDateString('pt-BR') ?? 's/data'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="avef-resultado" label="Resultado">
          <select
            id="avef-resultado"
            value={state.resultado}
            onChange={(e) => handleChange('resultado', e.target.value as ResultadoEficacia)}
            disabled={isSaving}
            aria-label="Resultado da avaliação"
            className={selectClass()}
          >
            {RESULTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="avef-data" label="Data da avaliação" required error={errors.dataAvaliacao}>
          <input
            id="avef-data"
            type="date"
            value={state.dataAvaliacao}
            onChange={(e) => handleChange('dataAvaliacao', e.target.value)}
            disabled={isSaving}
            aria-label="Data da avaliação"
            className={inputClass(Boolean(errors.dataAvaliacao))}
          />
        </Field>
      </div>

      <Field id="avef-evidencia" label="Evidência" required error={errors.evidencia}>
        <textarea
          id="avef-evidencia"
          value={state.evidencia}
          onChange={(e) => handleChange('evidencia', e.target.value)}
          disabled={isSaving}
          rows={3}
          aria-label="Evidência da avaliação"
          className={inputClass(Boolean(errors.evidencia))}
        />
      </Field>

      {mostrarAcaoCorretiva && (
        <section className="flex flex-col gap-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            Ação corretiva — FR-013
          </h3>
          <Field
            id="avef-acao-corretiva"
            label="Descrição da ação corretiva"
            error={errors.acaoCorretiva}
          >
            <textarea
              id="avef-acao-corretiva"
              value={state.acaoCorretiva}
              onChange={(e) => handleChange('acaoCorretiva', e.target.value)}
              disabled={isSaving}
              rows={3}
              aria-label="Ação corretiva"
              className={inputClass(Boolean(errors.acaoCorretiva))}
            />
          </Field>
        </section>
      )}

      <label className="flex items-center gap-3 text-sm text-slate-200 select-none">
        <input
          type="checkbox"
          checked={state.fechar}
          onChange={(e) => handleChange('fechar', e.target.checked)}
          disabled={isSaving}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
        />
        Fechar avaliação agora
        {state.resultado === 'ineficaz' && state.fechar && (
          <span className="text-xs text-amber-300">— exige ação corretiva</span>
        )}
      </label>

      {errors.submit && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {errors.submit}
        </p>
      )}

      <footer className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {isSaving ? 'Salvando…' : 'Registrar avaliação'}
        </button>
      </footer>
    </form>
  );
}
