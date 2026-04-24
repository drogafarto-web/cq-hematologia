import { useMemo, useState } from 'react';

import { useAvaliacaoCompetencia } from '../../hooks/useAvaliacaoCompetencia';
import { useAvaliacaoEficacia } from '../../hooks/useAvaliacaoEficacia';
import { useColaboradores } from '../../hooks/useColaboradores';
import { useExecucoes } from '../../hooks/useExecucoes';
import { useParticipantes } from '../../hooks/useParticipantes';
import { useTreinamentos } from '../../hooks/useTreinamentos';
import type {
  Colaborador,
  Execucao,
  ExecucaoStatus,
  Treinamento,
} from '../../types/EducacaoContinuada';
import type {
  ParticipanteRelatorio,
  RelatorioFR001,
} from '../../services/ecExportService';

import { AvaliacaoEficaciaForm } from '../AvaliacaoEficaciaForm';
import { CompetenciasExecucaoPanel } from '../CompetenciasExecucaoPanel';
import { ECRelatorioPrint } from '../ECRelatorioPrint';
import { ExecucaoForm } from '../ExecucaoForm';

type Panel =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; execucao: Execucao }
  | { mode: 'avaliar-eficacia'; execucaoId: string }
  | { mode: 'avaliar-competencia'; execucao: Execucao }
  | { mode: 'relatorio-fr001'; payload: RelatorioFR001 };

const STATUS_BADGE: Record<
  ExecucaoStatus,
  { label: string; cls: string }
> = {
  planejado: {
    label: 'Planejada',
    cls: 'border-slate-700 bg-slate-800/40 text-slate-300',
  },
  realizado: {
    label: 'Realizada',
    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  adiado: {
    label: 'Adiada',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  cancelado: {
    label: 'Cancelada',
    cls: 'border-slate-700 bg-slate-800/40 text-slate-500',
  },
};

export function ExecucoesTab() {
  const [panel, setPanel] = useState<Panel>({ mode: 'closed' });
  const [filtroStatus, setFiltroStatus] = useState<ExecucaoStatus | 'todos'>('todos');
  const [busca, setBusca] = useState<string>('');

  const { execucoes, isLoading } = useExecucoes();
  const { treinamentos } = useTreinamentos({ includeDeleted: true });
  const { colaboradores } = useColaboradores({ includeDeleted: true });
  const { participantes } = useParticipantes();
  const { avaliacoes: avaliacoesEficacia } = useAvaliacaoEficacia();
  const { avaliacoes: avaliacoesCompetencia } = useAvaliacaoCompetencia();

  const treinamentoMap = useMemo(() => {
    const m = new Map<string, Treinamento>();
    for (const t of treinamentos) m.set(t.id, t);
    return m;
  }, [treinamentos]);

  const colaboradorMap = useMemo(() => {
    const m = new Map<string, Colaborador>();
    for (const c of colaboradores) m.set(c.id, c);
    return m;
  }, [colaboradores]);

  const visiveis = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return execucoes.filter((e) => {
      if (filtroStatus !== 'todos' && e.status !== filtroStatus) return false;
      if (buscaLower.length === 0) return true;
      const treinamento = treinamentoMap.get(e.treinamentoId);
      const titulo = treinamento?.titulo.toLowerCase() ?? '';
      const ministrante = e.ministrante.toLowerCase();
      return titulo.includes(buscaLower) || ministrante.includes(buscaLower);
    });
  }, [execucoes, filtroStatus, busca, treinamentoMap]);

  const buildRelatorioFR001 = (execucao: Execucao): RelatorioFR001 | null => {
    const treinamento = treinamentoMap.get(execucao.treinamentoId);
    if (!treinamento) return null;
    const partDaExec = participantes.filter((p) => p.execucaoId === execucao.id);
    const participantesPayload: ParticipanteRelatorio[] = partDaExec
      .map((p) => {
        const colaborador = colaboradorMap.get(p.colaboradorId);
        if (!colaborador) return null;
        return { colaborador, presente: p.presente };
      })
      .filter((p): p is ParticipanteRelatorio => p !== null);
    const avaliacaoEficacia =
      avaliacoesEficacia.find((a) => a.execucaoId === execucao.id) ?? null;
    const avaliacoesCompetenciaDaExec = avaliacoesCompetencia.filter(
      (a) => a.execucaoId === execucao.id,
    );
    return {
      tipo: 'FR-001',
      execucao,
      treinamento,
      participantes: participantesPayload,
      avaliacaoEficacia,
      avaliacoesCompetencia: avaliacoesCompetenciaDaExec,
    };
  };

  const handleEmitirFR001 = (execucao: Execucao): void => {
    const payload = buildRelatorioFR001(execucao);
    if (!payload) {
      window.alert('Treinamento relacionado não encontrado — não é possível emitir o FR-001.');
      return;
    }
    setPanel({ mode: 'relatorio-fr001', payload });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-100">Execuções</h2>
          <p className="text-sm text-slate-400">Registro FR-001 — ciclo de vida das sessões de treinamento.</p>
        </div>
        <button
          type="button"
          onClick={() => setPanel({ mode: 'create' })}
          className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 sm:self-auto"
        >
          Nova execução
        </button>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M13.5 13.5L10.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por treinamento ou ministrante…"
            aria-label="Buscar execuções"
            className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Status
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as ExecucaoStatus | 'todos')}
            aria-label="Filtro de status"
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="todos">Todos</option>
            <option value="planejado">Planejadas</option>
            <option value="realizado">Realizadas</option>
            <option value="adiado">Adiadas</option>
            <option value="cancelado">Canceladas</option>
          </select>
        </label>
      </div>

      {isLoading && <SkeletonList rows={4} />}

      {!isLoading && visiveis.length === 0 && (
        <Empty text="Nenhuma execução com os filtros atuais." />
      )}

      {!isLoading && visiveis.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-800/60 rounded-lg border border-slate-800 bg-slate-900/40">
          {visiveis.map((e) => {
            const treinamento = treinamentoMap.get(e.treinamentoId);
            const status = STATUS_BADGE[e.status];
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-slate-100">
                    {treinamento?.titulo ?? 'Treinamento removido'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Planejada: {e.dataPlanejada.toDate().toLocaleDateString('pt-BR')}
                    {e.dataAplicacao && ` · Aplicada: ${e.dataAplicacao.toDate().toLocaleDateString('pt-BR')}`}
                    {e.ministrante && ` · Ministrante: ${e.ministrante}`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${status.cls}`}>
                    {status.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPanel({ mode: 'edit', execucao: e })}
                    className="rounded px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Editar
                  </button>
                  {e.status === 'realizado' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPanel({ mode: 'avaliar-eficacia', execucaoId: e.id })}
                        className="rounded px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                      >
                        Avaliar eficácia
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanel({ mode: 'avaliar-competencia', execucao: e })}
                        className="rounded px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                      >
                        Avaliar competências
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEmitirFR001(e)}
                        className="rounded px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        Emitir FR-001
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(panel.mode === 'create' || panel.mode === 'edit') && (
        <FormPanel onClose={() => setPanel({ mode: 'closed' })}>
          <ExecucaoForm
            execucao={panel.mode === 'edit' ? panel.execucao : undefined}
            onSaved={() => setPanel({ mode: 'closed' })}
            onCancel={() => setPanel({ mode: 'closed' })}
          />
        </FormPanel>
      )}

      {panel.mode === 'avaliar-eficacia' && (
        <FormPanel onClose={() => setPanel({ mode: 'closed' })}>
          <AvaliacaoEficaciaForm
            execucaoId={panel.execucaoId}
            onSaved={() => setPanel({ mode: 'closed' })}
            onCancel={() => setPanel({ mode: 'closed' })}
          />
        </FormPanel>
      )}

      {panel.mode === 'avaliar-competencia' && (
        <FormPanel onClose={() => setPanel({ mode: 'closed' })}>
          <CompetenciasExecucaoPanel
            execucao={panel.execucao}
            onClose={() => setPanel({ mode: 'closed' })}
          />
        </FormPanel>
      )}

      {panel.mode === 'relatorio-fr001' && (
        <ECRelatorioPrint
          payload={panel.payload}
          onClose={() => setPanel({ mode: 'closed' })}
        />
      )}
    </div>
  );
}

// ─── Shared internals ─────────────────────────────────────────────────────────

function FormPanel({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative ml-auto flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 shadow-2xl"
      >
        {children}
      </aside>
    </div>
  );
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded border border-slate-800 bg-slate-900/40" />
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 py-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
