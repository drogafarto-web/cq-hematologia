import { useMemo, useState, type FormEvent } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useAvaliacaoCompetencia } from '../hooks/useAvaliacaoCompetencia';
import { useColaboradores } from '../hooks/useColaboradores';
import { useExecucoes } from '../hooks/useExecucoes';
import { useParticipantes } from '../hooks/useParticipantes';
import { useTreinamentos } from '../hooks/useTreinamentos';
import type {
  Colaborador,
  Execucao,
  MetodoAvaliacaoCompetencia,
  ResultadoCompetencia,
} from '../types/EducacaoContinuada';

import { Field, inputClass, selectClass } from './_formPrimitives';

export interface AvaliacaoCompetenciaFormProps {
  execucaoId?: string;
  colaboradorId?: string;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  execucaoId: string;
  colaboradorId: string;
  metodo: MetodoAvaliacaoCompetencia;
  resultado: ResultadoCompetencia;
  evidencia: string;
  dataAvaliacao: string;
  proximaAvaliacaoEm: string;
}

interface FormErrors {
  execucaoId?: string;
  colaboradorId?: string;
  evidencia?: string;
  dataAvaliacao?: string;
  proximaAvaliacaoEm?: string;
  submit?: string;
}

const METODO_OPTIONS: ReadonlyArray<{ value: MetodoAvaliacaoCompetencia; label: string }> = [
  { value: 'observacao_direta', label: 'Observação direta' },
  { value: 'teste_escrito', label: 'Teste escrito' },
  { value: 'simulacao_pratica', label: 'Simulação prática' },
  { value: 'revisao_registro', label: 'Revisão de registro' },
];

const RESULTADO_OPTIONS: ReadonlyArray<{ value: ResultadoCompetencia; label: string }> = [
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'requer_retreinamento', label: 'Requer retreinamento' },
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

export function AvaliacaoCompetenciaForm({
  execucaoId,
  colaboradorId,
  onSaved,
  onCancel,
}: AvaliacaoCompetenciaFormProps) {
  const { execucoes } = useExecucoes({ status: 'realizado' });
  const { treinamentos } = useTreinamentos({ includeDeleted: true });
  const { colaboradores } = useColaboradores({ includeDeleted: true });
  const { registrar, isSaving } = useAvaliacaoCompetencia();

  const [state, setState] = useState<FormState>({
    execucaoId: execucaoId ?? '',
    colaboradorId: colaboradorId ?? '',
    metodo: 'observacao_direta',
    resultado: 'aprovado',
    evidencia: '',
    dataAvaliacao: todayInputValue(),
    proximaAvaliacaoEm: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Quando há execução selecionada, restringe colaboradores aos participantes
  // presentes — ISO 15189 avalia quem efetivamente recebeu o treinamento.
  const { participantes } = useParticipantes({ execucaoId: state.execucaoId || undefined });

  const colaboradoresElegiveis = useMemo<Colaborador[]>(() => {
    if (!state.execucaoId) return colaboradores.filter((c) => c.deletadoEm === null);
    const presentes = new Set(
      participantes.filter((p) => p.presente).map((p) => p.colaboradorId),
    );
    return colaboradores.filter((c) => presentes.has(c.id));
  }, [colaboradores, participantes, state.execucaoId]);

  const tituloPorExec = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of treinamentos) m.set(t.id, t.titulo);
    return (exec: Execucao): string => m.get(exec.treinamentoId) ?? exec.treinamentoId;
  }, [treinamentos]);

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      // Ao mudar execução, reset colaborador se não estiver mais elegível
      if (key === 'execucaoId') next.colaboradorId = '';
      return next;
    });
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const errs: FormErrors = {};
    if (!state.execucaoId) errs.execucaoId = 'Selecione uma execução.';
    if (!state.colaboradorId) errs.colaboradorId = 'Selecione um colaborador.';
    if (state.evidencia.trim().length === 0) errs.evidencia = 'Evidência é obrigatória.';
    if (!state.dataAvaliacao) errs.dataAvaliacao = 'Informe a data da avaliação.';
    if (state.resultado === 'reprovado' && !state.proximaAvaliacaoEm) {
      errs.proximaAvaliacaoEm = 'Resultado "reprovado" exige data de próxima avaliação.';
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
    const proximaAvaliacaoEm = dateInputToTs(state.proximaAvaliacaoEm);

    try {
      await registrar({
        execucaoId: state.execucaoId,
        colaboradorId: state.colaboradorId,
        metodo: state.metodo,
        resultado: state.resultado,
        evidencia: state.evidencia,
        dataAvaliacao,
        proximaAvaliacaoEm: proximaAvaliacaoEm ?? undefined,
      });
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar.';
      setErrors({ submit: message });
    }
  };

  const precisaProximaAvaliacao = state.resultado === 'reprovado';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">Avaliação de competência</h2>
        <p className="text-sm text-slate-400">
          ISO 15189:2022 cláusula 6.2.4 — avaliação do colaborador após treinamento.
        </p>
      </header>

      {!execucaoId && (
        <Field id="avcomp-execucao" label="Execução" required error={errors.execucaoId}>
          <select
            id="avcomp-execucao"
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

      {!colaboradorId && (
        <Field id="avcomp-colaborador" label="Colaborador" required error={errors.colaboradorId}>
          <select
            id="avcomp-colaborador"
            value={state.colaboradorId}
            onChange={(e) => handleChange('colaboradorId', e.target.value)}
            disabled={isSaving || !state.execucaoId}
            aria-label="Colaborador avaliado"
            className={selectClass()}
          >
            <option value="">
              {state.execucaoId ? 'Selecione…' : 'Selecione a execução primeiro'}
            </option>
            {colaboradoresElegiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.cargo}
              </option>
            ))}
          </select>
          {state.execucaoId && colaboradoresElegiveis.length === 0 && (
            <p className="text-xs text-amber-300">
              Nenhum participante presente nesta execução. Avaliação bloqueada.
            </p>
          )}
        </Field>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="avcomp-metodo" label="Método">
          <select
            id="avcomp-metodo"
            value={state.metodo}
            onChange={(e) => handleChange('metodo', e.target.value as MetodoAvaliacaoCompetencia)}
            disabled={isSaving}
            aria-label="Método de avaliação"
            className={selectClass()}
          >
            {METODO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="avcomp-resultado" label="Resultado">
          <select
            id="avcomp-resultado"
            value={state.resultado}
            onChange={(e) => handleChange('resultado', e.target.value as ResultadoCompetencia)}
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
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="avcomp-data" label="Data da avaliação" required error={errors.dataAvaliacao}>
          <input
            id="avcomp-data"
            type="date"
            value={state.dataAvaliacao}
            onChange={(e) => handleChange('dataAvaliacao', e.target.value)}
            disabled={isSaving}
            aria-label="Data da avaliação"
            className={inputClass(Boolean(errors.dataAvaliacao))}
          />
        </Field>

        {precisaProximaAvaliacao && (
          <Field
            id="avcomp-proxima"
            label="Próxima avaliação"
            required
            error={errors.proximaAvaliacaoEm}
          >
            <input
              id="avcomp-proxima"
              type="date"
              value={state.proximaAvaliacaoEm}
              onChange={(e) => handleChange('proximaAvaliacaoEm', e.target.value)}
              disabled={isSaving}
              aria-label="Data da próxima avaliação"
              className={inputClass(Boolean(errors.proximaAvaliacaoEm))}
            />
          </Field>
        )}
      </div>

      <Field id="avcomp-evidencia" label="Evidência" required error={errors.evidencia}>
        <textarea
          id="avcomp-evidencia"
          value={state.evidencia}
          onChange={(e) => handleChange('evidencia', e.target.value)}
          disabled={isSaving}
          rows={3}
          aria-label="Evidência da avaliação"
          className={inputClass(Boolean(errors.evidencia))}
        />
      </Field>

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
