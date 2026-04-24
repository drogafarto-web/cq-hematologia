import { useState, type FormEvent } from 'react';

import { useColaboradores } from '../hooks/useColaboradores';
import type {
  Colaborador,
  ColaboradorInput,
} from '../types/EducacaoContinuada';

import { Field, inputClass } from './_formPrimitives';

export interface ColaboradorFormProps {
  /** Quando presente o form entra em modo edição. */
  colaborador?: Colaborador;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  nome: string;
  cargo: string;
  setor: string;
  ativo: boolean;
}

interface FormErrors {
  nome?: string;
  cargo?: string;
  setor?: string;
  submit?: string;
}

function buildInitialState(colaborador?: Colaborador): FormState {
  if (!colaborador) {
    return { nome: '', cargo: '', setor: '', ativo: true };
  }
  return {
    nome: colaborador.nome,
    cargo: colaborador.cargo,
    setor: colaborador.setor,
    ativo: colaborador.ativo,
  };
}

function validate(state: FormState): FormErrors {
  const errors: FormErrors = {};
  const nome = state.nome.trim();
  const cargo = state.cargo.trim();
  const setor = state.setor.trim();

  if (nome.length < 2) errors.nome = 'Informe um nome com pelo menos 2 caracteres.';
  if (cargo.length === 0) errors.cargo = 'Cargo é obrigatório.';
  if (setor.length === 0) errors.setor = 'Setor é obrigatório.';

  return errors;
}

export function ColaboradorForm({
  colaborador,
  onSaved,
  onCancel,
}: ColaboradorFormProps) {
  const { create, update } = useColaboradores();
  const isEditing = Boolean(colaborador);

  const [state, setState] = useState<FormState>(() =>
    buildInitialState(colaborador),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleChange = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ): void => {
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

    const input: ColaboradorInput = {
      nome: state.nome.trim(),
      cargo: state.cargo.trim(),
      setor: state.setor.trim(),
      ativo: state.ativo,
    };

    setIsSaving(true);
    setErrors({});

    try {
      if (colaborador) {
        await update(colaborador.id, input);
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
          {isEditing ? 'Editar colaborador' : 'Novo colaborador'}
        </h2>
        <p className="text-sm text-slate-400">
          Cadastro restrito ao módulo de Educação Continuada — não afeta usuários do sistema.
        </p>
      </header>

      <Field
        id="colaborador-nome"
        label="Nome"
        required
        error={errors.nome}
      >
        <input
          id="colaborador-nome"
          type="text"
          value={state.nome}
          onChange={(e) => handleChange('nome', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Nome do colaborador"
          className={inputClass(Boolean(errors.nome))}
        />
      </Field>

      <Field
        id="colaborador-cargo"
        label="Cargo"
        required
        error={errors.cargo}
      >
        <input
          id="colaborador-cargo"
          type="text"
          value={state.cargo}
          onChange={(e) => handleChange('cargo', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Cargo do colaborador"
          className={inputClass(Boolean(errors.cargo))}
        />
      </Field>

      <Field
        id="colaborador-setor"
        label="Setor"
        required
        error={errors.setor}
      >
        <input
          id="colaborador-setor"
          type="text"
          value={state.setor}
          onChange={(e) => handleChange('setor', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Setor do colaborador"
          className={inputClass(Boolean(errors.setor))}
        />
      </Field>

      <label className="flex items-center gap-3 text-sm text-slate-200 select-none">
        <input
          type="checkbox"
          checked={state.ativo}
          onChange={(e) => handleChange('ativo', e.target.checked)}
          disabled={isSaving}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
        />
        Colaborador ativo
      </label>

      {errors.submit && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
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
          {isSaving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar colaborador'}
        </button>
      </footer>
    </form>
  );
}

