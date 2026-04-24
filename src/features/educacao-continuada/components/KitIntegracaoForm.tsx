import { useMemo, useState, type FormEvent } from 'react';

import { useKitsIntegracao } from '../hooks/useKitsIntegracao';
import { useTemplates } from '../hooks/useTemplates';
import type { KitIntegracao, KitIntegracaoInput } from '../types/EducacaoContinuada';

import { Field, inputClass } from './_formPrimitives';

export interface KitIntegracaoFormProps {
  kit?: KitIntegracao;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  nome: string;
  cargo: string;
  templateIds: string[];
  ativo: boolean;
}

interface FormErrors {
  nome?: string;
  cargo?: string;
  templateIds?: string;
  submit?: string;
}

function buildInitial(kit?: KitIntegracao): FormState {
  if (!kit) {
    return { nome: '', cargo: '', templateIds: [], ativo: true };
  }
  return {
    nome: kit.nome,
    cargo: kit.cargo,
    templateIds: [...kit.templateIds],
    ativo: kit.ativo,
  };
}

function validate(state: FormState): FormErrors {
  const errs: FormErrors = {};
  if (state.nome.trim().length < 3) errs.nome = 'Mínimo de 3 caracteres.';
  if (state.cargo.trim().length < 2) errs.cargo = 'Mínimo de 2 caracteres.';
  if (state.templateIds.length === 0) errs.templateIds = 'Adicione ao menos 1 template ao kit.';
  return errs;
}

/**
 * Form de KitIntegracao (Fase 6). Ordem dos templates importa (ex: integração
 * sequencial). Sem drag-and-drop: setas ↑↓ + remover. Acessível no teclado
 * e em mobile sem lib adicional.
 */
export function KitIntegracaoForm({ kit, onSaved, onCancel }: KitIntegracaoFormProps) {
  const { create, update } = useKitsIntegracao();
  const { templates } = useTemplates({ somenteAtivos: true });
  const isEditing = Boolean(kit);

  const [state, setState] = useState<FormState>(() => buildInitial(kit));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const templateMap = useMemo(() => {
    const m = new Map(templates.map((t) => [t.id, t]));
    return m;
  }, [templates]);

  const disponiveis = useMemo(
    () => templates.filter((t) => !state.templateIds.includes(t.id)),
    [templates, state.templateIds],
  );

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...state.templateIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setState((prev) => ({ ...prev, templateIds: next }));
  };
  const moveDown = (idx: number) => {
    if (idx === state.templateIds.length - 1) return;
    const next = [...state.templateIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setState((prev) => ({ ...prev, templateIds: next }));
  };
  const removeAt = (idx: number) => {
    setState((prev) => ({
      ...prev,
      templateIds: prev.templateIds.filter((_, i) => i !== idx),
    }));
  };
  const addTemplate = (id: string) => {
    setState((prev) => ({ ...prev, templateIds: [...prev.templateIds, id] }));
    if (errors.templateIds) setErrors((prev) => ({ ...prev, templateIds: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errs = validate(state);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const input: KitIntegracaoInput = {
      nome: state.nome.trim(),
      cargo: state.cargo.trim(),
      templateIds: state.templateIds,
      ativo: state.ativo,
    };
    setIsSaving(true);
    setErrors({});
    try {
      if (kit) {
        await update(kit.id, input);
      } else {
        await create(input);
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar kit.';
      setErrors({ submit: msg });
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">
          {isEditing ? 'Editar kit de integração' : 'Novo kit de integração'}
        </h2>
        <p className="text-sm text-slate-400">
          Sequência ordenada de templates por cargo (ex: "Kit Biomédico Júnior"). A
          ordem da lista é a ordem sugerida de aplicação.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="kit-nome" label="Nome" required error={errors.nome}>
          <input
            id="kit-nome"
            type="text"
            value={state.nome}
            onChange={(e) => setState((p) => ({ ...p, nome: e.target.value }))}
            disabled={isSaving}
            aria-label="Nome do kit"
            className={inputClass(Boolean(errors.nome))}
          />
        </Field>

        <Field id="kit-cargo" label="Cargo alvo" required error={errors.cargo}>
          <input
            id="kit-cargo"
            type="text"
            value={state.cargo}
            onChange={(e) => setState((p) => ({ ...p, cargo: e.target.value }))}
            disabled={isSaving}
            aria-label="Cargo alvo"
            placeholder="Biomédico, Técnico, Auxiliar…"
            className={inputClass(Boolean(errors.cargo))}
          />
        </Field>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Templates do kit ({state.templateIds.length})
          </h3>
        </header>

        {state.templateIds.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhum template no kit. Adicione abaixo (pela ordem de aplicação).
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {state.templateIds.map((id, idx) => {
              const t = templateMap.get(id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <span className="w-6 text-center text-xs font-semibold text-slate-500">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-200">
                      {t?.titulo ?? 'Template removido'}
                    </p>
                    {t && (
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        {t.periodicidade} · {t.cargaHoraria}h
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      label="Mover para cima"
                      onClick={() => moveUp(idx)}
                      disabled={isSaving || idx === 0}
                    >
                      ↑
                    </IconButton>
                    <IconButton
                      label="Mover para baixo"
                      onClick={() => moveDown(idx)}
                      disabled={isSaving || idx === state.templateIds.length - 1}
                    >
                      ↓
                    </IconButton>
                    <IconButton
                      label="Remover do kit"
                      onClick={() => removeAt(idx)}
                      disabled={isSaving}
                      intent="danger"
                    >
                      ×
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {errors.templateIds && (
          <p role="alert" className="text-xs text-red-400">
            {errors.templateIds}
          </p>
        )}

        {disponiveis.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Adicionar template
            </p>
            <div className="flex flex-wrap gap-1.5">
              {disponiveis.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => addTemplate(t.id)}
                  disabled={isSaving}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50"
                >
                  + {t.titulo}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <label className="flex items-center gap-3 text-sm text-slate-200 select-none">
        <input
          type="checkbox"
          checked={state.ativo}
          onChange={(e) => setState((p) => ({ ...p, ativo: e.target.checked }))}
          disabled={isSaving}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
        />
        Kit ativo
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
          {isSaving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar kit'}
        </button>
      </footer>
    </form>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
  intent = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
  intent?: 'default' | 'danger';
}) {
  const base =
    'flex h-7 w-7 items-center justify-center rounded text-base transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const intentCls =
    intent === 'danger'
      ? 'text-red-400 hover:bg-red-500/10'
      : 'text-slate-300 hover:bg-slate-800';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${intentCls}`}
    >
      {children}
    </button>
  );
}
