import { useMemo } from 'react';

import { useProgressoTrilha } from '../hooks/useProgressoTrilha';
import { useTemplates } from '../hooks/useTemplates';
import { useTrilhas } from '../hooks/useTrilhas';
import type {
  ProgressoEtapa,
  ProgressoTrilha,
  StatusProgressoEtapa,
} from '../types/EducacaoContinuada';

export interface TrilhaProgressoViewProps {
  colaboradorId: string;
  colaboradorNome: string;
}

const STATUS_ETAPA_CFG: Record<
  StatusProgressoEtapa,
  { label: string; cls: string; dot: string }
> = {
  pendente: {
    label: 'Pendente',
    cls: 'border-slate-700 bg-slate-800/40 text-slate-400',
    dot: 'bg-slate-500',
  },
  agendado: {
    label: 'Agendado',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  realizado: {
    label: 'Realizado',
    cls: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    dot: 'bg-blue-400',
  },
  aprovado: {
    label: 'Aprovado',
    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
};

/**
 * Visão do colaborador — checklist das etapas da(s) trilha(s) em andamento.
 * Integrado ao Prontuário do Colaborador como seção. Recálculo RN-09 em tempo
 * real (etapa vira "aprovado" quando existe AvaliacaoCompetencia aprovada).
 */
export function TrilhaProgressoView({ colaboradorId, colaboradorNome }: TrilhaProgressoViewProps) {
  const { progressos, isLoading } = useProgressoTrilha({ colaboradorId });
  const { trilhas } = useTrilhas({ includeDeleted: true });
  const { templates } = useTemplates({ includeDeleted: true });

  const trilhaMap = useMemo(() => new Map(trilhas.map((t) => [t.id, t])), [trilhas]);
  const templateMap = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded border border-slate-800 bg-slate-900/40" />;
  }
  if (progressos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 py-6 text-center text-xs text-slate-500">
        Nenhuma trilha ativa para {colaboradorNome}.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {progressos.map((p) => {
        const trilha = trilhaMap.get(p.trilhaId);
        return (
          <article
            key={p.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4"
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-slate-100">
                  {trilha?.nome ?? 'Trilha arquivada'}
                </h4>
                <p className="text-xs text-slate-500">
                  {p.status === 'em_andamento'
                    ? 'Em andamento'
                    : p.status === 'concluida'
                      ? 'Concluída'
                      : 'Pausada'}
                  {' · '}
                  {p.percentualConcluido}% concluído
                </p>
              </div>
              <ProgressBar pct={p.percentualConcluido} />
            </header>

            <ul className="flex flex-col gap-1.5">
              {p.etapas.map((etapa, idx) => (
                <EtapaRow
                  key={`${etapa.templateId}-${idx}`}
                  etapa={etapa}
                  ordem={idx + 1}
                  templateTitulo={templateMap.get(etapa.templateId)?.titulo ?? 'Template removido'}
                />
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

function EtapaRow({
  etapa,
  ordem,
  templateTitulo,
}: {
  etapa: ProgressoEtapa;
  ordem: number;
  templateTitulo: string;
}) {
  const cfg = STATUS_ETAPA_CFG[etapa.status];
  return (
    <li className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/40 px-3 py-2">
      <span className="w-6 shrink-0 text-center text-xs font-semibold text-slate-500">{ordem}.</span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{templateTitulo}</span>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.cls}`}
      >
        {cfg.label}
      </span>
    </li>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-800"
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Tipagem auxiliar — export pra consumo em outras vistas se precisar.
export type { ProgressoTrilha };
