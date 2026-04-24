import { useMemo, useState } from 'react';

import { useColaboradores } from '../hooks/useColaboradores';
import { useProgressoTrilha } from '../hooks/useProgressoTrilha';
import { useTrilhas } from '../hooks/useTrilhas';
import type { TrilhaAprendizado } from '../types/EducacaoContinuada';

import { TrilhaForm } from './TrilhaForm';

export interface OnboardingPanelProps {
  onClose: () => void;
}

type View = 'list' | 'trilha-create' | 'trilha-edit';

type Panel =
  | { mode: 'list' }
  | { mode: 'trilha-create' }
  | { mode: 'trilha-edit'; trilha: TrilhaAprendizado };

/**
 * Painel do responsável — consolida gestão de trilhas + acompanhamento de
 * novos colaboradores (Fase 7). RN-08 roda no hook `useColaboradores` (ou no
 * seu caller) — este panel visualiza o estado.
 */
export function OnboardingPanel({ onClose }: OnboardingPanelProps) {
  const [panel, setPanel] = useState<Panel>({ mode: 'list' });
  const [view, setView] = useState<View>('list');
  void view;

  const { trilhas } = useTrilhas({ includeDeleted: false });
  const { colaboradores } = useColaboradores({ somenteAtivos: true });
  const { progressos, iniciar, setStatus } = useProgressoTrilha({});

  const colaboradoresMap = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c])),
    [colaboradores],
  );
  const trilhasMap = useMemo(() => new Map(trilhas.map((t) => [t.id, t])), [trilhas]);

  const handleArchiveTrilha = async (_t: TrilhaAprendizado): Promise<void> => {
    // Simplificado — a action de arquivar trilha fica no form de edit
    void _t;
  };

  if (panel.mode === 'trilha-create' || panel.mode === 'trilha-edit') {
    return (
      <Header onClose={onClose} titulo={panel.mode === 'trilha-create' ? 'Nova trilha' : 'Editar trilha'}>
        <TrilhaForm
          trilha={panel.mode === 'trilha-edit' ? panel.trilha : undefined}
          onSaved={() => {
            setPanel({ mode: 'list' });
            setView('list');
          }}
          onCancel={() => setPanel({ mode: 'list' })}
        />
      </Header>
    );
  }

  const trilhasPorCargo = trilhas.reduce<Record<string, TrilhaAprendizado[]>>((acc, t) => {
    const key = t.cargo || '—';
    acc[key] = acc[key] ?? [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <Header onClose={onClose} titulo="Onboarding Digital">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Trilhas de aprendizado ({trilhas.length})
            </h3>
            <button
              type="button"
              onClick={() => setPanel({ mode: 'trilha-create' })}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Nova trilha
            </button>
          </header>

          {Object.keys(trilhasPorCargo).length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 py-8 text-center text-xs text-slate-500">
              Nenhuma trilha cadastrada.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {Object.entries(trilhasPorCargo).map(([cargo, list]) => (
                <div key={cargo} className="flex flex-col gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    {cargo} · {list.length}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {list.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/60 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-200">{t.nome}</p>
                          <p className="text-[10px] text-slate-500">
                            {t.etapas.length} etapa(s) · {t.ativo ? 'Ativa' : 'Inativa'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPanel({ mode: 'trilha-edit', trilha: t })}
                          className="shrink-0 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Editar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Progressos em andamento ({progressos.filter((p) => p.status === 'em_andamento').length})
          </h3>

          {progressos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 py-8 text-center text-xs text-slate-500">
              Nenhum colaborador em onboarding no momento. Cadastre um colaborador
              com cargo correspondente a uma trilha ativa — o progresso inicia
              automaticamente (RN-08).
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {progressos.map((p) => {
                const c = colaboradoresMap.get(p.colaboradorId);
                const t = trilhasMap.get(p.trilhaId);
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {c?.nome ?? 'Colaborador arquivado'}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          · {t?.nome ?? 'Trilha removida'}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {p.percentualConcluido}% concluído · {p.status}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {p.status === 'em_andamento' && (
                        <button
                          type="button"
                          onClick={() => setStatus(p.id, 'pausada')}
                          className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Pausar
                        </button>
                      )}
                      {p.status === 'pausada' && (
                        <button
                          type="button"
                          onClick={() => setStatus(p.id, 'em_andamento')}
                          className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Retomar
                        </button>
                      )}
                      {p.status !== 'concluida' && p.percentualConcluido === 100 && (
                        <button
                          type="button"
                          onClick={() => setStatus(p.id, 'concluida')}
                          className="rounded px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                        >
                          Marcar concluída
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* RN-08 hint — iniciador manual para casos sem cargo exato */}
        <section className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500">
            Iniciar trilha manualmente para colaborador existente (fallback quando
            cargo não bate automaticamente):
          </p>
          <ManualStart
            trilhas={trilhas.filter((t) => t.ativo)}
            colaboradores={colaboradores}
            onStart={(col, t) => iniciar(col, t)}
            onArchive={handleArchiveTrilha}
          />
        </section>
      </div>
    </Header>
  );
}

function ManualStart({
  trilhas,
  colaboradores,
  onStart,
}: {
  trilhas: TrilhaAprendizado[];
  colaboradores: ReadonlyArray<{ id: string; nome: string; cargo: string }>;
  onStart: (colaboradorId: string, trilha: TrilhaAprendizado) => Promise<string>;
  onArchive: (t: TrilhaAprendizado) => Promise<void>;
}) {
  const [colId, setColId] = useState('');
  const [trId, setTrId] = useState('');
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!colId || !trId) return;
    const t = trilhas.find((x) => x.id === trId);
    if (!t) return;
    setBusy(true);
    try {
      await onStart(colId, t);
      setColId('');
      setTrId('');
    } finally {
      setBusy(false);
    }
  };

  if (trilhas.length === 0 || colaboradores.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={colId}
        onChange={(e) => setColId(e.target.value)}
        disabled={busy}
        aria-label="Colaborador"
        className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
      >
        <option value="">Colaborador…</option>
        {colaboradores.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome} ({c.cargo})
          </option>
        ))}
      </select>
      <select
        value={trId}
        onChange={(e) => setTrId(e.target.value)}
        disabled={busy}
        aria-label="Trilha"
        className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
      >
        <option value="">Trilha…</option>
        {trilhas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !colId || !trId}
        className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        Iniciar
      </button>
    </div>
  );
}

function Header({
  titulo,
  onClose,
  children,
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-lg font-semibold text-slate-100">{titulo}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>
      </header>
      {children}
    </div>
  );
}
