import { useState, type FormEvent } from 'react';

import { useTemplates } from '../hooks/useTemplates';
import { useTrilhas } from '../hooks/useTrilhas';
import type {
  EtapaTrilha,
  TrilhaAprendizado,
  TrilhaAprendizadoInput,
} from '../types/EducacaoContinuada';

import { Field, inputClass } from './_formPrimitives';

export interface TrilhaFormProps {
  trilha?: TrilhaAprendizado;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  nome: string;
  descricao: string;
  cargo: string;
  etapas: EtapaTrilha[];
  ativo: boolean;
}

function buildInitial(trilha?: TrilhaAprendizado): FormState {
  if (!trilha) {
    return { nome: '', descricao: '', cargo: '', etapas: [], ativo: true };
  }
  return {
    nome: trilha.nome,
    descricao: trilha.descricao,
    cargo: trilha.cargo,
    etapas: [...trilha.etapas],
    ativo: trilha.ativo,
  };
}

/**
 * Form de TrilhaAprendizado (Fase 7). Etapas ordenadas com setas ↑↓ (sem nova
 * dep). Cada etapa aponta para um template + define prazo em dias e se é
 * obrigatória.
 */
export function TrilhaForm({ trilha, onSaved, onCancel }: TrilhaFormProps) {
  const { create, update } = useTrilhas();
  const { templates } = useTemplates({ somenteAtivos: true });
  const isEditing = Boolean(trilha);

  const [state, setState] = useState<FormState>(() => buildInitial(trilha));
  const [errors, setErrors] = useState<{ nome?: string; cargo?: string; etapas?: string; submit?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const addEtapa = (templateId: string) => {
    const nextOrdem = state.etapas.length + 1;
    setState((prev) => ({
      ...prev,
      etapas: [...prev.etapas, { ordem: nextOrdem, templateId, prazoEmDias: 30, obrigatoria: true }],
    }));
  };
  const removeEtapa = (idx: number) => {
    setState((prev) => ({
      ...prev,
      etapas: prev.etapas.filter((_, i) => i !== idx).map((e, i) => ({ ...e, ordem: i + 1 })),
    }));
  };
  const moveEtapa = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= state.etapas.length) return;
    const next = [...state.etapas];
    [next[idx], next[j]] = [next[j], next[idx]];
    setState((prev) => ({ ...prev, etapas: next.map((e, i) => ({ ...e, ordem: i + 1 })) }));
  };
  const updateEtapa = (idx: number, patch: Partial<EtapaTrilha>) => {
    setState((prev) => ({
      ...prev,
      etapas: prev.etapas.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errs: typeof errors = {};
    if (state.nome.trim().length < 3) errs.nome = 'Mínimo de 3 caracteres.';
    if (state.cargo.trim().length < 2) errs.cargo = 'Mínimo de 2 caracteres.';
    if (state.etapas.length === 0) errs.etapas = 'Adicione ao menos 1 etapa à trilha.';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const input: TrilhaAprendizadoInput = {
      nome: state.nome.trim(),
      descricao: state.descricao.trim(),
      cargo: state.cargo.trim(),
      etapas: state.etapas,
      ativo: state.ativo,
    };
    setIsSaving(true);
    setErrors({});
    try {
      if (trilha) {
        await update(trilha.id, input);
      } else {
        await create(input);
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar trilha.';
      setErrors({ submit: msg });
      setIsSaving(false);
    }
  };

  const disponiveis = templates.filter((t) => !state.etapas.some((e) => e.templateId === t.id));
  const templateTitulo = (id: string): string => templates.find((t) => t.id === id)?.titulo ?? 'Template removido';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">
          {isEditing ? 'Editar trilha' : 'Nova trilha'}
        </h2>
        <p className="text-sm text-slate-400">
          Sequência ordenada de templates por cargo. RN-08: ao cadastrar
          colaborador novo com cargo {state.cargo || '…'}, o progresso inicia
          automaticamente.
        </p>
      </header>

      <Field id="trilha-nome" label="Nome" required error={errors.nome}>
        <input
          id="trilha-nome"
          type="text"
          value={state.nome}
          onChange={(e) => setState((p) => ({ ...p, nome: e.target.value }))}
          disabled={isSaving}
          aria-label="Nome da trilha"
          className={inputClass(Boolean(errors.nome))}
        />
      </Field>

      <Field id="trilha-cargo" label="Cargo alvo" required error={errors.cargo}>
        <input
          id="trilha-cargo"
          type="text"
          value={state.cargo}
          onChange={(e) => setState((p) => ({ ...p, cargo: e.target.value }))}
          disabled={isSaving}
          placeholder="Biomédico, Técnico…"
          aria-label="Cargo alvo"
          className={inputClass(Boolean(errors.cargo))}
        />
      </Field>

      <Field id="trilha-descricao" label="Descrição">
        <textarea
          id="trilha-descricao"
          value={state.descricao}
          onChange={(e) => setState((p) => ({ ...p, descricao: e.target.value }))}
          disabled={isSaving}
          rows={2}
          aria-label="Descrição"
          className={inputClass(false)}
        />
      </Field>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold text-slate-200">
          Etapas ({state.etapas.length})
        </h3>

        {state.etapas.length === 0 ? (
          <p className="text-xs text-slate-500">
            Adicione templates abaixo (na ordem de aplicação).
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {state.etapas.map((etapa, idx) => (
              <li
                key={`${etapa.templateId}-${idx}`}
                className="flex items-start gap-2 rounded border border-slate-800 bg-slate-900/60 p-3"
              >
                <span className="w-6 shrink-0 text-center text-xs font-semibold text-slate-500">
                  {etapa.ordem}.
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="truncate text-sm text-slate-200">
                    {templateTitulo(etapa.templateId)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      Prazo:
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={etapa.prazoEmDias}
                        onChange={(e) =>
                          updateEtapa(idx, {
                            prazoEmDias: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        disabled={isSaving}
                        aria-label={`Prazo em dias da etapa ${etapa.ordem}`}
                        className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-200"
                      />
                      dias
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={etapa.obrigatoria}
                        onChange={(e) => updateEtapa(idx, { obrigatoria: e.target.checked })}
                        disabled={isSaving}
                        aria-label={`Etapa ${etapa.ordem} obrigatória`}
                        className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      Obrigatória
                    </label>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Mover para cima"
                    onClick={() => moveEtapa(idx, -1)}
                    disabled={isSaving || idx === 0}
                    className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Mover para baixo"
                    onClick={() => moveEtapa(idx, 1)}
                    disabled={isSaving || idx === state.etapas.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Remover etapa"
                    onClick={() => removeEtapa(idx)}
                    disabled={isSaving}
                    className="flex h-7 w-7 items-center justify-center rounded text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {errors.etapas && (
          <p role="alert" className="text-xs text-red-400">
            {errors.etapas}
          </p>
        )}

        {disponiveis.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Adicionar template</p>
            <div className="flex flex-wrap gap-1.5">
              {disponiveis.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => addEtapa(t.id)}
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
        Trilha ativa (RN-08 aplica só em trilhas ativas)
      </label>

      {errors.submit && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
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
          {isSaving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar trilha'}
        </button>
      </footer>
    </form>
  );
}
