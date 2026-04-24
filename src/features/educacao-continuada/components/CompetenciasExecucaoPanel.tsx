import { useMemo, useState } from 'react';

import { useAvaliacaoCompetencia } from '../hooks/useAvaliacaoCompetencia';
import { useColaboradores } from '../hooks/useColaboradores';
import { useParticipantes } from '../hooks/useParticipantes';
import { useTreinamentos } from '../hooks/useTreinamentos';
import type { Colaborador, Execucao } from '../types/EducacaoContinuada';

import { AvaliacaoCompetenciaForm } from './AvaliacaoCompetenciaForm';

export interface CompetenciasExecucaoPanelProps {
  execucao: Execucao;
  onClose: () => void;
}

type Step =
  | { mode: 'list' }
  | { mode: 'form'; colaboradorId: string };

/**
 * Painel de avaliação de competências individuais (ISO 15189:2022 cl. 6.2.4)
 * para uma execução específica. Lista os participantes presentes — RN-03 da
 * própria cláusula: só avalia quem de fato recebeu o treinamento — e permite
 * avaliar um por um reusando `AvaliacaoCompetenciaForm` com `execucaoId` e
 * `colaboradorId` fixos.
 *
 * Cada submissão é um commit atomic independente (o hook `registrar` já cobre
 * isso). Fechar o painel no meio não deixa estado parcial inconsistente.
 */
export function CompetenciasExecucaoPanel({
  execucao,
  onClose,
}: CompetenciasExecucaoPanelProps) {
  const [step, setStep] = useState<Step>({ mode: 'list' });

  const { participantes, isLoading: loadingP } = useParticipantes({
    execucaoId: execucao.id,
  });
  const { colaboradores } = useColaboradores({ includeDeleted: true });
  const { avaliacoes } = useAvaliacaoCompetencia({ execucaoId: execucao.id });
  const { treinamentos } = useTreinamentos({ includeDeleted: true });

  const tituloTreinamento = useMemo(() => {
    const t = treinamentos.find((x) => x.id === execucao.treinamentoId);
    return t?.titulo ?? 'Treinamento removido';
  }, [treinamentos, execucao.treinamentoId]);

  const presentes = useMemo(
    () => participantes.filter((p) => p.presente),
    [participantes],
  );

  const colabMap = useMemo(() => {
    const m = new Map<string, Colaborador>();
    for (const c of colaboradores) m.set(c.id, c);
    return m;
  }, [colaboradores]);

  const avaliadosSet = useMemo(() => {
    const s = new Set<string>();
    for (const a of avaliacoes) s.add(a.colaboradorId);
    return s;
  }, [avaliacoes]);

  const totalPresentes = presentes.length;
  const totalAvaliados = useMemo(
    () => presentes.filter((p) => avaliadosSet.has(p.colaboradorId)).length,
    [presentes, avaliadosSet],
  );

  if (step.mode === 'form') {
    return (
      <AvaliacaoCompetenciaForm
        execucaoId={execucao.id}
        colaboradorId={step.colaboradorId}
        onSaved={() => setStep({ mode: 'list' })}
        onCancel={() => setStep({ mode: 'list' })}
      />
    );
  }

  const dataAplicacao = execucao.dataAplicacao?.toDate().toLocaleDateString('pt-BR') ?? 's/data';

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">Avaliar competências</h2>
        <p className="text-sm text-slate-400">
          {tituloTreinamento} — {dataAplicacao}
        </p>
        <p className="text-xs text-slate-500">
          ISO 15189:2022 cl. 6.2.4 · {totalAvaliados}/{totalPresentes} participantes avaliados
        </p>
      </header>

      {loadingP && <SkeletonList rows={3} />}

      {!loadingP && presentes.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-800 py-10 text-center text-sm text-slate-400">
          Nenhum participante com presença registrada nesta execução.
        </p>
      )}

      {!loadingP && presentes.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-800/60 rounded-lg border border-slate-800 bg-slate-900/40">
          {presentes.map((p) => {
            const colab = colabMap.get(p.colaboradorId);
            const avaliado = avaliadosSet.has(p.colaboradorId);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-slate-100">
                    {colab?.nome ?? 'Colaborador removido'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {colab ? `${colab.cargo} · ${colab.setor}` : p.colaboradorId}
                  </span>
                </div>
                <div className="shrink-0">
                  {avaliado ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M2.5 6.5L5 9l4.5-5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Avaliado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStep({ mode: 'form', colaboradorId: p.colaboradorId })}
                      className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                    >
                      Avaliar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Fechar
        </button>
      </footer>
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
