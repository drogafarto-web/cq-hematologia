import { useState, type FormEvent } from 'react';

import { useTemplates } from '../hooks/useTemplates';
import { useTreinamentos } from '../hooks/useTreinamentos';
import type {
  Modalidade,
  Periodicidade,
  TemplateTreinamento,
  Treinamento,
  TreinamentoInput,
  Unidade,
} from '../types/EducacaoContinuada';

import { Field, inputClass, selectClass } from './_formPrimitives';

export interface TreinamentoFormProps {
  /** Quando presente, o form entra em modo edição. */
  treinamento?: Treinamento;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  titulo: string;
  tema: string;
  cargaHoraria: string;
  modalidade: Modalidade;
  unidade: Unidade;
  responsavel: string;
  periodicidade: Periodicidade;
  ativo: boolean;
  /** ID do template de origem (Fase 6). Só populado via "Criar a partir de template". */
  templateId?: string;
}

interface FormErrors {
  titulo?: string;
  tema?: string;
  cargaHoraria?: string;
  responsavel?: string;
  submit?: string;
}

const MODALIDADE_OPTIONS: ReadonlyArray<{ value: Modalidade; label: string }> = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
  { value: 'em_servico', label: 'Em serviço' },
];

const UNIDADE_OPTIONS: ReadonlyArray<{ value: Unidade; label: string }> = [
  { value: 'fixa', label: 'Unidade fixa' },
  { value: 'itinerante', label: 'Unidade itinerante' },
  { value: 'ambas', label: 'Ambas' },
];

const PERIODICIDADE_OPTIONS: ReadonlyArray<{ value: Periodicidade; label: string }> = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

function buildInitialState(treinamento?: Treinamento): FormState {
  if (!treinamento) {
    return {
      titulo: '',
      tema: '',
      cargaHoraria: '',
      modalidade: 'presencial',
      unidade: 'fixa',
      responsavel: '',
      periodicidade: 'anual',
      ativo: true,
    };
  }
  return {
    titulo: treinamento.titulo,
    tema: treinamento.tema,
    cargaHoraria: String(treinamento.cargaHoraria),
    modalidade: treinamento.modalidade,
    unidade: treinamento.unidade,
    responsavel: treinamento.responsavel,
    periodicidade: treinamento.periodicidade,
    ativo: treinamento.ativo,
    templateId: treinamento.templateId,
  };
}

/**
 * Aplica um template ao state do form. Herança **não lock** — todos os campos
 * copiados ficam editáveis. Mantém `ativo` e `unidade` do state atual (template
 * não tem esses campos).
 */
function applyTemplate(template: TemplateTreinamento, current: FormState): FormState {
  return {
    ...current,
    titulo: template.titulo,
    tema: template.tema,
    cargaHoraria: String(template.cargaHoraria),
    modalidade: template.modalidade,
    periodicidade: template.periodicidade,
    responsavel: current.responsavel, // responsável é do treinamento, não do template
    templateId: template.id,
  };
}

function parseCargaHoraria(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim();
  if (normalized.length === 0) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0 || n > 999) return null;
  return n;
}

function validate(state: FormState): FormErrors {
  const errors: FormErrors = {};
  if (state.titulo.trim().length < 3) errors.titulo = 'Mínimo de 3 caracteres.';
  if (state.tema.trim().length < 3) errors.tema = 'Mínimo de 3 caracteres.';
  if (state.responsavel.trim().length < 2) errors.responsavel = 'Mínimo de 2 caracteres.';
  if (parseCargaHoraria(state.cargaHoraria) === null) {
    errors.cargaHoraria = 'Informe um número entre 0,1 e 999 horas.';
  }
  return errors;
}

export function TreinamentoForm({
  treinamento,
  onSaved,
  onCancel,
}: TreinamentoFormProps) {
  const { create, update } = useTreinamentos();
  const { templates } = useTemplates({ somenteAtivos: true });
  const isEditing = Boolean(treinamento);

  const [state, setState] = useState<FormState>(() => buildInitialState(treinamento));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const validationErrors = validate(state);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const cargaHoraria = parseCargaHoraria(state.cargaHoraria);
    // validate() já garante não-nulo, mas narrow TS aqui
    if (cargaHoraria === null) return;

    const input: TreinamentoInput = {
      titulo: state.titulo.trim(),
      tema: state.tema.trim(),
      cargaHoraria,
      modalidade: state.modalidade,
      unidade: state.unidade,
      responsavel: state.responsavel.trim(),
      periodicidade: state.periodicidade,
      ativo: state.ativo,
      ...(state.templateId ? { templateId: state.templateId } : {}),
    };

    setIsSaving(true);
    setErrors({});

    try {
      if (treinamento) {
        await update(treinamento.id, input);
      } else {
        await create(input);
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar.';
      setErrors({ submit: message });
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">
          {isEditing ? 'Editar treinamento' : 'Novo treinamento'}
        </h2>
        <p className="text-sm text-slate-400">
          Planejamento conforme FR-027 / RDC 978/2025. A execução real é registrada em FR-001.
        </p>
      </header>

      {!isEditing && templates.length > 0 && (
        <Field id="treinamento-template" label="Criar a partir de template (opcional)">
          <select
            id="treinamento-template"
            value={state.templateId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                setState((prev) => ({ ...prev, templateId: undefined }));
                return;
              }
              const tpl = templates.find((t) => t.id === id);
              if (tpl) setState((prev) => applyTemplate(tpl, prev));
            }}
            disabled={isSaving}
            aria-label="Criar a partir de template"
            className={selectClass()}
          >
            <option value="">— Sem template (criar do zero) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo} (v{t.versao})
              </option>
            ))}
          </select>
          {state.templateId && (
            <p className="mt-1 text-xs text-emerald-300">
              Campos preenchidos a partir do template. Todos editáveis — herança, não lock.
            </p>
          )}
        </Field>
      )}

      <Field id="treinamento-titulo" label="Título" required error={errors.titulo}>
        <input
          id="treinamento-titulo"
          type="text"
          value={state.titulo}
          onChange={(e) => handleChange('titulo', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Título do treinamento"
          className={inputClass(Boolean(errors.titulo))}
        />
      </Field>

      <Field id="treinamento-tema" label="Tema" required error={errors.tema}>
        <input
          id="treinamento-tema"
          type="text"
          value={state.tema}
          onChange={(e) => handleChange('tema', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Tema do treinamento"
          className={inputClass(Boolean(errors.tema))}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="treinamento-carga"
          label="Carga horária (h)"
          required
          error={errors.cargaHoraria}
        >
          <input
            id="treinamento-carga"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            max="999"
            value={state.cargaHoraria}
            onChange={(e) => handleChange('cargaHoraria', e.target.value)}
            disabled={isSaving}
            aria-label="Carga horária em horas"
            className={inputClass(Boolean(errors.cargaHoraria))}
          />
        </Field>

        <Field id="treinamento-responsavel" label="Responsável" required error={errors.responsavel}>
          <input
            id="treinamento-responsavel"
            type="text"
            value={state.responsavel}
            onChange={(e) => handleChange('responsavel', e.target.value)}
            disabled={isSaving}
            autoComplete="off"
            aria-label="Responsável pelo treinamento"
            className={inputClass(Boolean(errors.responsavel))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field id="treinamento-modalidade" label="Modalidade">
          <select
            id="treinamento-modalidade"
            value={state.modalidade}
            onChange={(e) => handleChange('modalidade', e.target.value as Modalidade)}
            disabled={isSaving}
            aria-label="Modalidade do treinamento"
            className={selectClass()}
          >
            {MODALIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="treinamento-unidade" label="Unidade">
          <select
            id="treinamento-unidade"
            value={state.unidade}
            onChange={(e) => handleChange('unidade', e.target.value as Unidade)}
            disabled={isSaving}
            aria-label="Unidade de aplicação"
            className={selectClass()}
          >
            {UNIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="treinamento-periodicidade" label="Periodicidade">
          <select
            id="treinamento-periodicidade"
            value={state.periodicidade}
            onChange={(e) => handleChange('periodicidade', e.target.value as Periodicidade)}
            disabled={isSaving}
            aria-label="Periodicidade do treinamento"
            className={selectClass()}
          >
            {PERIODICIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-200 select-none">
        <input
          type="checkbox"
          checked={state.ativo}
          onChange={(e) => handleChange('ativo', e.target.checked)}
          disabled={isSaving}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
        />
        Treinamento ativo
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
          {isSaving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar treinamento'}
        </button>
      </footer>
    </form>
  );
}

