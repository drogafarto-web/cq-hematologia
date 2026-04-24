import { useMemo, useState } from 'react';

import { useAvaliacaoCompetencia } from '../../hooks/useAvaliacaoCompetencia';
import { useColaboradores } from '../../hooks/useColaboradores';
import { useExecucoes } from '../../hooks/useExecucoes';
import { downloadColaboradoresTemplate } from '../../services/ecImportService';
import type { Colaborador } from '../../types/EducacaoContinuada';

import { AvaliacaoCompetenciaForm } from '../AvaliacaoCompetenciaForm';
import { ColaboradorForm } from '../ColaboradorForm';
import { ImportColaboradoresModal } from '../ImportColaboradoresModal';
import { ProntuarioColaborador } from '../ProntuarioColaborador';

type Panel =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; colaborador: Colaborador }
  | { mode: 'prontuario'; colaborador: Colaborador }
  | { mode: 'avaliar-competencia'; colaboradorId: string };

export function ColaboradoresTab() {
  const [panel, setPanel] = useState<Panel>({ mode: 'closed' });
  const [busca, setBusca] = useState<string>('');
  const [incluirInativos, setIncluirInativos] = useState<boolean>(false);
  const [importOpen, setImportOpen] = useState<boolean>(false);

  const { colaboradores, isLoading } = useColaboradores();
  const { avaliacoes: avaliacoesComp } = useAvaliacaoCompetencia();
  const { execucoes } = useExecucoes({ includeDeleted: true });

  /**
   * RN-04: colaboradorId → true quando avaliação mais recente por treinamento
   * é 'reprovado'. Calculado aqui para exibir o badge na lista sem precisar
   * abrir o prontuário.
   */
  const requerAlertaPorColab = useMemo<Map<string, boolean>>(() => {
    const execMap = new Map<string, string>();
    for (const e of execucoes) execMap.set(e.id, e.treinamentoId);

    const porColabTreinamento = new Map<string, Map<string, number>>();
    const resultadoMaisRecente = new Map<string, Map<string, string>>();

    for (const a of avaliacoesComp) {
      const treinId = execMap.get(a.execucaoId);
      if (!treinId) continue;
      const data = a.dataAvaliacao.toMillis();
      const porTrein = porColabTreinamento.get(a.colaboradorId) ?? new Map<string, number>();
      const resPorTrein = resultadoMaisRecente.get(a.colaboradorId) ?? new Map<string, string>();
      if (!porTrein.has(treinId) || data > (porTrein.get(treinId) ?? 0)) {
        porTrein.set(treinId, data);
        resPorTrein.set(treinId, a.resultado);
      }
      porColabTreinamento.set(a.colaboradorId, porTrein);
      resultadoMaisRecente.set(a.colaboradorId, resPorTrein);
    }

    const result = new Map<string, boolean>();
    for (const [colabId, mapTrein] of resultadoMaisRecente.entries()) {
      const temReprovado = Array.from(mapTrein.values()).some((r) => r === 'reprovado');
      result.set(colabId, temReprovado);
    }
    return result;
  }, [avaliacoesComp, execucoes]);

  const visiveis = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return colaboradores.filter((c) => {
      if (!incluirInativos && !c.ativo) return false;
      if (buscaLower.length === 0) return true;
      return (
        c.nome.toLowerCase().includes(buscaLower) ||
        c.cargo.toLowerCase().includes(buscaLower) ||
        c.setor.toLowerCase().includes(buscaLower)
      );
    });
  }, [colaboradores, busca, incluirInativos]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-100">Colaboradores</h2>
          <p className="text-sm text-slate-400">Cadastro e histórico — prontuário individual acessível por clique.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400 select-none">
            <input
              type="checkbox"
              checked={incluirInativos}
              onChange={(e) => setIncluirInativos(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
            />
            Incluir inativos
          </label>
          <button
            type="button"
            onClick={() => downloadColaboradoresTemplate()}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Baixar modelo
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            Importar XLSX
          </button>
          <button
            type="button"
            onClick={() => setPanel({ mode: 'create' })}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Novo colaborador
          </button>
        </div>
      </header>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, cargo ou setor…"
        aria-label="Buscar colaboradores"
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />

      {isLoading && <SkeletonList rows={4} />}
      {!isLoading && visiveis.length === 0 && (
        <Empty text={busca ? 'Nenhum colaborador encontrado.' : 'Nenhum colaborador cadastrado.'} />
      )}

      {!isLoading && visiveis.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {visiveis.map((c) => {
            const alerta = requerAlertaPorColab.get(c.id) ?? false;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setPanel({ mode: 'prontuario', colaborador: c })}
                  className={`flex w-full flex-col gap-0.5 rounded-lg border bg-slate-900/60 p-4 text-left transition hover:border-emerald-500/40 hover:bg-slate-900 ${
                    c.ativo ? 'border-slate-800' : 'border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-100">{c.nome}</span>
                    <div className="flex items-center gap-1.5">
                      {alerta && (
                        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                          Retreinar
                        </span>
                      )}
                      {!c.ativo && (
                        <span className="rounded-full border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{c.cargo} · {c.setor}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(panel.mode === 'create' || panel.mode === 'edit') && (
        <FormPanel onClose={() => setPanel({ mode: 'closed' })}>
          <ColaboradorForm
            colaborador={panel.mode === 'edit' ? panel.colaborador : undefined}
            onSaved={() => setPanel({ mode: 'closed' })}
            onCancel={() => setPanel({ mode: 'closed' })}
          />
        </FormPanel>
      )}

      {panel.mode === 'prontuario' && (
        <FormPanel onClose={() => setPanel({ mode: 'closed' })}>
          <div className="flex h-full flex-col gap-4">
            <ProntuarioColaborador
              colaborador={panel.colaborador}
              onClose={() => setPanel({ mode: 'closed' })}
            />
            <footer className="flex gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setPanel({ mode: 'edit', colaborador: panel.colaborador })}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Editar cadastro
              </button>
              <button
                type="button"
                onClick={() =>
                  setPanel({ mode: 'avaliar-competencia', colaboradorId: panel.colaborador.id })
                }
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                Registrar avaliação de competência
              </button>
            </footer>
          </div>
        </FormPanel>
      )}

      {panel.mode === 'avaliar-competencia' && (
        <FormPanel onClose={() => setPanel({ mode: 'closed' })}>
          <AvaliacaoCompetenciaForm
            colaboradorId={panel.colaboradorId}
            onSaved={() => setPanel({ mode: 'closed' })}
            onCancel={() => setPanel({ mode: 'closed' })}
          />
        </FormPanel>
      )}

      {importOpen && (
        <ImportColaboradoresModal
          onClose={() => setImportOpen(false)}
          onImported={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}

function FormPanel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-slate-800 bg-slate-900/40" />
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
