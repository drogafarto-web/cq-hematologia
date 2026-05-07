import { useState, type FormEvent } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import type { Cargo, CargoInput } from '../types/ControlInterno';
import { Field, inputClass, selectClass } from '../../educacao-continuada/components/_formPrimitives';

export interface CargoFormProps {
  /** Quando presente o form entra em modo edição. */
  cargo?: Cargo;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  nome: string;
  departamento: string;
  nivel: 1 | 2 | 3 | 4 | 5;
  responsabilidades: string;
}

interface FormErrors {
  nome?: string;
  departamento?: string;
  nivel?: string;
  responsabilidades?: string;
  submit?: string;
}

function buildInitialState(cargo?: Cargo): FormState {
  if (!cargo) {
    return {
      nome: '',
      departamento: '',
      nivel: 1,
      responsabilidades: '',
    };
  }
  return {
    nome: cargo.nome,
    departamento: cargo.departamento,
    nivel: cargo.nivel,
    responsabilidades: cargo.responsabilidades,
  };
}

function validate(state: FormState): FormErrors {
  const errors: FormErrors = {};
  const nome = state.nome.trim();
  const departamento = state.departamento.trim();
  const responsabilidades = state.responsabilidades.trim();

  if (nome.length < 2) errors.nome = 'Informe um nome com pelo menos 2 caracteres.';
  if (departamento.length === 0) errors.departamento = 'Departamento é obrigatório.';
  if (state.nivel < 1 || state.nivel > 5) errors.nivel = 'Nível deve estar entre 1 e 5.';
  if (responsabilidades.length === 0) errors.responsabilidades = 'Responsabilidades são obrigatórias.';

  return errors;
}

export function CargoForm({ cargo, onSaved, onCancel }: CargoFormProps) {
  const labId = useActiveLabId();
  const isEditing = Boolean(cargo);

  const [state, setState] = useState<FormState>(() => buildInitialState(cargo));
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

    if (!labId) {
      setErrors({ submit: 'Lab não identificado. Recarregue a página.' });
      return;
    }

    const validationErrors = validate(state);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const input: CargoInput = {
      nome: state.nome.trim(),
      departamento: state.departamento.trim(),
      nivel: state.nivel,
      responsabilidades: state.responsabilidades.trim(),
    };

    setIsSaving(true);
    setErrors({});

    try {
      // TODO: wire cargoService.createCargo(labId, input) or update
      await new Promise((resolve) => setTimeout(resolve, 500)); // placeholder
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
          {isEditing ? 'Editar cargo' : 'Novo cargo'}
        </h2>
        <p className="text-sm text-slate-400">
          Defina o cargo e responsabilidades para designações de CAPA digital.
        </p>
      </header>

      <Field
        id="cargo-nome"
        label="Nome do cargo"
        required
        error={errors.nome}
      >
        <input
          id="cargo-nome"
          type="text"
          value={state.nome}
          onChange={(e) => handleChange('nome', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Nome do cargo"
          className={inputClass(Boolean(errors.nome))}
        />
      </Field>

      <Field
        id="cargo-departamento"
        label="Departamento"
        required
        error={errors.departamento}
      >
        <input
          id="cargo-departamento"
          type="text"
          value={state.departamento}
          onChange={(e) => handleChange('departamento', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Departamento"
          className={inputClass(Boolean(errors.departamento))}
        />
      </Field>

      <Field
        id="cargo-nivel"
        label="Nível hierárquico (1-5)"
        required
        error={errors.nivel}
      >
        <select
          id="cargo-nivel"
          value={state.nivel}
          onChange={(e) => handleChange('nivel', Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
          disabled={isSaving}
          aria-label="Nível hierárquico"
          className={selectClass()}
        >
          <option value="1">Nível 1 (Operacional)</option>
          <option value="2">Nível 2 (Supervisão)</option>
          <option value="3">Nível 3 (Coordenação)</option>
          <option value="4">Nível 4 (Gerência)</option>
          <option value="5">Nível 5 (Diretoria)</option>
        </select>
      </Field>

      <Field
        id="cargo-responsabilidades"
        label="Responsabilidades"
        required
        error={errors.responsabilidades}
      >
        <textarea
          id="cargo-responsabilidades"
          value={state.responsabilidades}
          onChange={(e) => handleChange('responsabilidades', e.target.value)}
          disabled={isSaving}
          rows={5}
          aria-label="Responsabilidades do cargo"
          className={inputClass(Boolean(errors.responsabilidades))}
        />
      </Field>

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
          {isSaving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar cargo'}
        </button>
      </footer>
    </form>
  );
}
