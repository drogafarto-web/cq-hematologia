import { useMemo } from 'react';

import { useAlertasVencimento } from '../hooks/useAlertasVencimento';
import { useAvaliacaoCompetencia } from '../hooks/useAvaliacaoCompetencia';
import { useAvaliacaoEficacia } from '../hooks/useAvaliacaoEficacia';
import { useExecucoes } from '../hooks/useExecucoes';
import { useTreinamentos } from '../hooks/useTreinamentos';
import type {
  AvaliacaoCompetencia,
  AvaliacaoEficacia,
  Execucao,
} from '../types/EducacaoContinuada';

export interface ECIndicadoresProps {
  /** Ano civil para os cortes temporais. Default: ano corrente. */
  ano?: number;
}

/**
 * Painel de indicadores consolidados do ano — RDC 978/2025.
 *
 * Agregação client-side sobre os subscribes reativos. Trade-off conhecido:
 * carrega todo o dataset do tenant. Para volume alto (>5k execuções),
 * considerar pré-agregação em Cloud Function com snapshot diário.
 */
export function ECIndicadores({ ano = new Date().getFullYear() }: ECIndicadoresProps) {
  const inicioAno = useMemo(() => new Date(ano, 0, 1).getTime(), [ano]);
  const fimAno = useMemo(() => new Date(ano + 1, 0, 1).getTime(), [ano]);

  const { treinamentos } = useTreinamentos({ somenteAtivos: true });
  const { execucoes } = useExecucoes();
  const { avaliacoes: avaliacoesEficacia } = useAvaliacaoEficacia();
  const { avaliacoes: avaliacoesCompetencia } = useAvaliacaoCompetencia();
  const { alertasIminentes, alertasVencidos } = useAlertasVencimento();

  const execucoesAno = useMemo<Execucao[]>(
    () =>
      execucoes.filter((e) => {
        const t = e.dataPlanejada.toMillis();
        return t >= inicioAno && t < fimAno;
      }),
    [execucoes, inicioAno, fimAno],
  );

  const avaliacoesEficaciaAno = useMemo<AvaliacaoEficacia[]>(
    () =>
      avaliacoesEficacia.filter((a) => {
        const t = a.dataAvaliacao.toMillis();
        return t >= inicioAno && t < fimAno;
      }),
    [avaliacoesEficacia, inicioAno, fimAno],
  );

  const avaliacoesCompetenciaAno = useMemo<AvaliacaoCompetencia[]>(
    () =>
      avaliacoesCompetencia.filter((a) => {
        const t = a.dataAvaliacao.toMillis();
        return t >= inicioAno && t < fimAno;
      }),
    [avaliacoesCompetencia, inicioAno, fimAno],
  );

  // ── Métricas ──────────────────────────────────────────────────────────────
  const totalExecPlanejadas = execucoesAno.length;
  const totalRealizadas = execucoesAno.filter((e) => e.status === 'realizado').length;
  const totalAdiadas = execucoesAno.filter((e) => e.status === 'adiado').length;
  const totalCanceladas = execucoesAno.filter((e) => e.status === 'cancelado').length;
  const percRealizacao = totalExecPlanejadas > 0
    ? Math.round((totalRealizadas / totalExecPlanejadas) * 100)
    : 0;

  const eficazes = avaliacoesEficaciaAno.filter((a) => a.resultado === 'eficaz').length;
  const ineficazes = avaliacoesEficaciaAno.filter((a) => a.resultado === 'ineficaz').length;
  const totalEficacia = eficazes + ineficazes;
  const percEficacia = totalEficacia > 0 ? Math.round((eficazes / totalEficacia) * 100) : 0;

  const ineficazesFechadas = avaliacoesEficaciaAno.filter(
    (a) => a.resultado === 'ineficaz' && a.dataFechamento !== null,
  );
  const tempoMedioFechamentoMs = ineficazesFechadas.length > 0
    ? ineficazesFechadas.reduce(
        (sum, a) =>
          sum + ((a.dataFechamento?.toMillis() ?? 0) - a.dataAvaliacao.toMillis()),
        0,
      ) / ineficazesFechadas.length
    : 0;
  const tempoMedioFechamentoDias = Math.round(tempoMedioFechamentoMs / (24 * 60 * 60 * 1000));

  const aprovados = avaliacoesCompetenciaAno.filter((a) => a.resultado === 'aprovado').length;
  const reprovados = avaliacoesCompetenciaAno.filter((a) => a.resultado === 'reprovado').length;
  const retreinamento = avaliacoesCompetenciaAno.filter(
    (a) => a.resultado === 'requer_retreinamento',
  ).length;
  const totalCompetencia = aprovados + reprovados + retreinamento;
  const percAprovacao = totalCompetencia > 0 ? Math.round((aprovados / totalCompetencia) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-100">Indicadores {ano}</h2>
          <p className="text-sm text-slate-400">
            Painel consolidado do ano civil — RDC 978/2025. Atualizado em tempo real.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Treinamentos ativos"
          value={String(treinamentos.length)}
          hint={`${totalExecPlanejadas} execuções planejadas em ${ano}`}
        />
        <MetricCard
          label="% realização"
          value={`${percRealizacao}%`}
          hint={`${totalRealizadas}/${totalExecPlanejadas} realizadas`}
          bar={percRealizacao}
          accent={percRealizacao >= 80 ? 'emerald' : percRealizacao >= 60 ? 'amber' : 'red'}
        />
        <MetricCard
          label="% eficácia"
          value={`${percEficacia}%`}
          hint={`${eficazes}/${totalEficacia} avaliações eficazes`}
          bar={percEficacia}
          accent={percEficacia >= 85 ? 'emerald' : percEficacia >= 70 ? 'amber' : 'red'}
        />
        <MetricCard
          label="% competência"
          value={`${percAprovacao}%`}
          hint={`${aprovados}/${totalCompetencia} aprovados`}
          bar={percAprovacao}
          accent={percAprovacao >= 85 ? 'emerald' : percAprovacao >= 70 ? 'amber' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Execuções adiadas"
          value={String(totalAdiadas)}
          hint={`${totalCanceladas} canceladas no ano`}
        />
        <MetricCard
          label="Fechamento FR-013"
          value={
            ineficazesFechadas.length > 0 ? `${tempoMedioFechamentoDias} d` : '—'
          }
          hint={
            ineficazesFechadas.length > 0
              ? `tempo médio em ${ineficazesFechadas.length} casos`
              : 'sem ações corretivas fechadas'
          }
        />
        <MetricCard
          label="Competência reprovada"
          value={String(reprovados + retreinamento)}
          hint={`${reprovados} reprovados · ${retreinamento} requer retreino`}
          accent={reprovados + retreinamento > 0 ? 'amber' : 'slate'}
        />
        <MetricCard
          label="Alertas"
          value={String(alertasIminentes.length + alertasVencidos.length)}
          hint={`${alertasVencidos.length} vencidos · ${alertasIminentes.length} iminentes`}
          accent={alertasVencidos.length > 0 ? 'red' : alertasIminentes.length > 0 ? 'amber' : 'slate'}
        />
      </div>
    </div>
  );
}

// ─── Métrica ──────────────────────────────────────────────────────────────────

type Accent = 'emerald' | 'amber' | 'red' | 'slate';

const ACCENT_CLASSES: Record<Accent, { text: string; bar: string; border: string }> = {
  emerald: {
    text: 'text-emerald-300',
    bar: 'bg-emerald-500',
    border: 'border-emerald-500/30',
  },
  amber: {
    text: 'text-amber-300',
    bar: 'bg-amber-500',
    border: 'border-amber-500/30',
  },
  red: { text: 'text-red-300', bar: 'bg-red-500', border: 'border-red-500/30' },
  slate: {
    text: 'text-slate-100',
    bar: 'bg-slate-600',
    border: 'border-slate-800',
  },
};

function MetricCard({
  label,
  value,
  hint,
  bar,
  accent = 'slate',
}: {
  label: string;
  value: string;
  hint?: string;
  bar?: number;
  accent?: Accent;
}) {
  const cls = ACCENT_CLASSES[accent];
  return (
    <div className={`flex flex-col gap-2 rounded-lg border bg-slate-900/60 p-4 ${cls.border}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${cls.text}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {typeof bar === 'number' && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full ${cls.bar} transition-all`}
            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
          />
        </div>
      )}
    </div>
  );
}
