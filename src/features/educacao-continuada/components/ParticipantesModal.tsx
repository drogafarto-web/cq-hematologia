import { useEffect, useMemo, useState } from 'react';

import { useColaboradores } from '../hooks/useColaboradores';
import type { PresencaInput } from '../hooks/useSaveExecucao';

export interface ParticipantesModalProps {
  /** Estado inicial de presenças — permite reabrir o modal e ajustar. */
  initial: PresencaInput[];
  onConfirm: (presencas: PresencaInput[]) => void;
  onCancel: () => void;
}

/**
 * Modal de registro de presença. Trabalha com `PresencaInput[]` — a assinatura
 * individual de cada participante é gerada no commit em `useSaveExecucao`,
 * nunca aqui (evita reexecutar SHA-256 a cada re-render do modal).
 */
export function ParticipantesModal({
  initial,
  onConfirm,
  onCancel,
}: ParticipantesModalProps) {
  const { colaboradores, isLoading, error } = useColaboradores({ somenteAtivos: true });

  // Map colaboradorId → presente — chave estável, performática em toggle.
  const [presencas, setPresencas] = useState<Map<string, boolean>>(() => {
    const m = new Map<string, boolean>();
    for (const p of initial) m.set(p.colaboradorId, p.presente);
    return m;
  });

  // Quando a lista de colaboradores chega, garante entrada default (false) para
  // cada colaborador ativo que ainda não tem registro no estado local.
  useEffect(() => {
    setPresencas((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const c of colaboradores) {
        if (!next.has(c.id)) {
          next.set(c.id, false);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [colaboradores]);

  const toggle = (colaboradorId: string): void => {
    setPresencas((prev) => {
      const next = new Map(prev);
      next.set(colaboradorId, !(prev.get(colaboradorId) ?? false));
      return next;
    });
  };

  const marcarTodos = (value: boolean): void => {
    setPresencas(() => {
      const next = new Map<string, boolean>();
      for (const c of colaboradores) next.set(c.id, value);
      return next;
    });
  };

  const totalPresentes = useMemo(
    () => Array.from(presencas.values()).filter(Boolean).length,
    [presencas],
  );

  const handleConfirm = (): void => {
    const result: PresencaInput[] = colaboradores.map((c) => ({
      colaboradorId: c.id,
      presente: presencas.get(c.id) ?? false,
    }));
    onConfirm(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="participantes-title"
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-slate-800 bg-slate-950 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 id="participantes-title" className="text-base font-semibold text-slate-100">
              Registrar presença
            </h2>
            <p className="text-xs text-slate-400">
              {totalPresentes} de {colaboradores.length} colaboradores marcados
              {totalPresentes === 0 && ' — RN-03 exige ao menos 1 presente'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => marcarTodos(true)}
              disabled={colaboradores.length === 0}
              className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => marcarTodos(false)}
              disabled={totalPresentes === 0}
              className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Nenhum
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Erro ao carregar colaboradores: {error.message}
            </p>
          )}

          {isLoading && (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded border border-slate-800 bg-slate-900/40" />
              ))}
            </div>
          )}

          {!isLoading && colaboradores.length === 0 && (
            <p className="rounded-md border border-dashed border-slate-800 py-10 text-center text-sm text-slate-400">
              Nenhum colaborador ativo cadastrado.
            </p>
          )}

          {!isLoading && colaboradores.length > 0 && (
            <ul className="flex flex-col divide-y divide-slate-800/60">
              {colaboradores.map((c) => {
                const isPresente = presencas.get(c.id) ?? false;
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5 select-none">
                      <input
                        type="checkbox"
                        checked={isPresente}
                        onChange={() => toggle(c.id)}
                        aria-label={`Marcar presença de ${c.nome}`}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm text-slate-100">{c.nome}</span>
                        <span className="text-xs text-slate-500">
                          {c.cargo} · {c.setor}
                        </span>
                      </div>
                      {isPresente && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                          Presente
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={totalPresentes === 0}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar presença ({totalPresentes})
          </button>
        </footer>
      </div>
    </div>
  );
}
