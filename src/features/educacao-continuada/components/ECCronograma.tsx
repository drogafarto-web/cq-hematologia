import { useMemo } from 'react';

import { useExecucoes } from '../hooks/useExecucoes';
import { useTreinamentos } from '../hooks/useTreinamentos';
import type {
  Execucao,
  ExecucaoStatus,
  Treinamento,
} from '../types/EducacaoContinuada';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const STATUS_DOT: Record<ExecucaoStatus, string> = {
  planejado: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
  realizado: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  adiado: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  cancelado: 'bg-slate-700 ring-1 ring-slate-600',
};

const STATUS_LABEL: Record<ExecucaoStatus, string> = {
  planejado: 'Planejada',
  realizado: 'Realizada',
  adiado: 'Adiada',
  cancelado: 'Cancelada',
};

export interface ECCronogramaProps {
  ano?: number;
  /** Clique na linha do treinamento — abre edição. Se ausente, linha fica passiva. */
  onEditTreinamento?: (t: Treinamento) => void;
  /** Arquivar treinamento — mostra botão inline na linha. */
  onArchiveTreinamento?: (t: Treinamento) => void;
}

/**
 * Cronograma anual: grid `treinamento × mês`, cada célula mostra bolinhas
 * coloridas por execução planejada/realizada naquele mês. Dá visão de relance
 * do que está previsto para o ano inteiro, FR-027 / RDC 978.
 *
 * Empty-state dedicado quando não há treinamento cadastrado ainda — evita
 * renderizar tabela vazia.
 */
export function ECCronograma({
  ano = new Date().getFullYear(),
  onEditTreinamento,
  onArchiveTreinamento,
}: ECCronogramaProps) {
  const { treinamentos, isLoading: loadingT } = useTreinamentos({ somenteAtivos: true });
  const { execucoes, isLoading: loadingE } = useExecucoes();

  const { inicioAno, fimAno } = useMemo(() => {
    return {
      inicioAno: new Date(ano, 0, 1).getTime(),
      fimAno: new Date(ano + 1, 0, 1).getTime(),
    };
  }, [ano]);

  // matrix: treinamentoId → meses[0..11] → execuções daquele mês
  const matrix = useMemo(() => {
    const m = new Map<string, Execucao[][]>();
    for (const t of treinamentos) {
      m.set(t.id, Array.from({ length: 12 }, () => []));
    }
    for (const e of execucoes) {
      const ts = e.dataPlanejada.toMillis();
      if (ts < inicioAno || ts >= fimAno) continue;
      const row = m.get(e.treinamentoId);
      if (!row) continue;
      const mes = new Date(ts).getMonth();
      row[mes].push(e);
    }
    return m;
  }, [treinamentos, execucoes, inicioAno, fimAno]);

  const mesAtual = useMemo(() => {
    const hoje = new Date();
    return hoje.getFullYear() === ano ? hoje.getMonth() : -1;
  }, [ano]);

  const totalExecucoesNoAno = useMemo(() => {
    return execucoes.filter((e) => {
      const ts = e.dataPlanejada.toMillis();
      return ts >= inicioAno && ts < fimAno;
    }).length;
  }, [execucoes, inicioAno, fimAno]);

  if (loadingT || loadingE) {
    return (
      <section className="flex flex-col gap-3">
        <Header ano={ano} subtitle="Carregando…" />
        <div className="h-48 animate-pulse rounded-lg border border-slate-800 bg-slate-900/40" />
      </section>
    );
  }

  if (treinamentos.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Header ano={ano} subtitle="Sem treinamentos cadastrados" />
        <p className="rounded-lg border border-dashed border-slate-800 py-8 text-center text-sm text-slate-400">
          Cadastre o primeiro treinamento abaixo — o cronograma aparece aqui assim que você planejar execuções.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <Header
        ano={ano}
        subtitle={`${treinamentos.length} treinamento(s) · ${totalExecucoesNoAno} execução(ões) no ano`}
      />

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="sticky left-0 z-10 min-w-[200px] bg-slate-900/80 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Treinamento
              </th>
              {MESES.map((m, i) => (
                <th
                  key={m}
                  className={`px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider ${
                    i === mesAtual ? 'text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {treinamentos.map((t) => {
              const row = matrix.get(t.id) ?? [];
              return (
                <tr
                  key={t.id}
                  className="group border-b border-slate-800/60 last:border-b-0 transition-colors hover:bg-slate-800/30"
                >
                  <td className="sticky left-0 z-10 bg-slate-900/60 px-4 py-2.5 group-hover:bg-slate-900/80">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-slate-100">{t.titulo}</span>
                        <span className="text-[11px] text-slate-500">
                          {t.periodicidade} · {t.cargaHoraria}h
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {onEditTreinamento && (
                          <button
                            type="button"
                            onClick={() => onEditTreinamento(t)}
                            aria-label={`Editar ${t.titulo}`}
                            title="Editar"
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-emerald-300"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                              <path
                                d="M11.5 2.5l2 2L5 13l-2.5.5L3 11l8.5-8.5zM10 4l2 2"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                        {onArchiveTreinamento && (
                          <button
                            type="button"
                            onClick={() => onArchiveTreinamento(t)}
                            aria-label={`Arquivar ${t.titulo}`}
                            title="Arquivar"
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                              <path
                                d="M2 4h12M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4M3.5 4l.7 9.1a1 1 0 001 .9h5.6a1 1 0 001-.9L12.5 4M7 7v5M9 7v5"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  {row.map((execs, mesIdx) => (
                    <td
                      key={mesIdx}
                      className={`px-2 py-2.5 text-center ${
                        mesIdx === mesAtual ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <CellDots execucoes={execs} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Legenda />
    </section>
  );
}

// ─── Internos ─────────────────────────────────────────────────────────────────

function Header({ ano, subtitle }: { ano: number; subtitle: string }) {
  return (
    <div className="flex items-end justify-between">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Cronograma {ano}
        </h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function CellDots({ execucoes }: { execucoes: Execucao[] }) {
  if (execucoes.length === 0) {
    return <span className="text-slate-700">·</span>;
  }
  return (
    <div className="flex items-center justify-center gap-0.5" title={tooltip(execucoes)}>
      {execucoes.slice(0, 3).map((e) => (
        <span
          key={e.id}
          className={`h-2 w-2 rounded-full ${STATUS_DOT[e.status]}`}
          aria-hidden
        />
      ))}
      {execucoes.length > 3 && (
        <span className="ml-0.5 text-[10px] font-medium text-slate-400">
          +{execucoes.length - 3}
        </span>
      )}
    </div>
  );
}

function tooltip(execucoes: Execucao[]): string {
  return execucoes
    .map((e) => {
      const data = e.dataPlanejada.toDate().toLocaleDateString('pt-BR');
      return `${data} — ${STATUS_LABEL[e.status]}`;
    })
    .join('\n');
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
      <span>Legenda:</span>
      <LegendaDot label="Planejada" cls="bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
      <LegendaDot label="Realizada" cls="bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
      <LegendaDot label="Adiada" cls="bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
      <LegendaDot label="Cancelada" cls="bg-slate-700 ring-1 ring-slate-600" />
    </div>
  );
}

function LegendaDot({ label, cls }: { label: string; cls: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${cls}`} aria-hidden />
      {label}
    </span>
  );
}
