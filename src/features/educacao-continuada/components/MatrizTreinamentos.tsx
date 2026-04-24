import {
  useMatrizTreinamentos,
  type MatrizCelula,
  type StatusMatriz,
} from '../hooks/useMatrizTreinamentos';
import type { Colaborador, Treinamento } from '../types/EducacaoContinuada';

const STATUS_CONFIG: Record<
  StatusMatriz,
  { label: string; cellCls: string; chipCls: string; dot: string }
> = {
  ok: {
    label: 'OK',
    cellCls: 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
    chipCls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  vencendo: {
    label: 'Vencendo',
    cellCls: 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30',
    chipCls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  vencido: {
    label: 'Vencido',
    cellCls: 'bg-red-500/25 text-red-200 hover:bg-red-500/35',
    chipCls: 'border-red-500/40 bg-red-500/15 text-red-300',
    dot: 'bg-red-400',
  },
  pendente: {
    label: 'Pendente',
    cellCls: 'bg-slate-800/40 text-slate-500 hover:bg-slate-800/60',
    chipCls: 'border-slate-700 bg-slate-800/40 text-slate-300',
    dot: 'bg-slate-500',
  },
};

function formatDate(ts: { toDate: () => Date }): string {
  return ts.toDate().toLocaleDateString('pt-BR');
}

function tooltipFor(c: Colaborador, t: Treinamento, cell: MatrizCelula): string {
  const linha1 = `${c.nome} × ${t.titulo}`;
  if (cell.status === 'pendente') {
    return `${linha1}\nNunca avaliado (periodicidade: ${t.periodicidade})`;
  }
  const ultima = cell.ultimaAvaliacao ? formatDate(cell.ultimaAvaliacao) : '—';
  const venc = cell.proximoVencimento ? formatDate(cell.proximoVencimento) : '—';
  const dias = cell.diasAteVencimento ?? 0;
  const sufixo =
    cell.status === 'vencido'
      ? `${Math.abs(dias)} dia(s) vencido`
      : `${dias} dia(s) restante(s)`;
  return `${linha1}\nÚltima aprovação: ${ultima}\nPróximo vencimento: ${venc}\n${sufixo}`;
}

function cellLabel(cell: MatrizCelula): string {
  if (cell.status === 'pendente') return '—';
  const dias = cell.diasAteVencimento ?? 0;
  if (cell.status === 'vencido') return `${Math.abs(dias)}d↑`;
  return `${dias}d`;
}

/**
 * Dashboard semáforo: linhas = colaboradores ativos, colunas = treinamentos
 * ativos. Cada célula mostra o status derivado em tempo real (ver
 * `useMatrizTreinamentos`).
 *
 * Imprimir matriz usa `window.print()` com `@page { size: A4 landscape }`
 * (escopado via @media print) — orientação horizontal para caber muitas
 * colunas. Sticky first column + sticky header para navegar grids grandes
 * sem perder contexto.
 */
export function MatrizTreinamentos() {
  const { colaboradores, treinamentos, matriz, contadores, isLoading, diasAviso } =
    useMatrizTreinamentos();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded border border-slate-800 bg-slate-900/40"
          />
        ))}
      </div>
    );
  }

  if (colaboradores.length === 0) {
    return (
      <Empty text="Nenhum colaborador ativo cadastrado. Vá até a aba Colaboradores para adicionar." />
    );
  }
  if (treinamentos.length === 0) {
    return (
      <Empty text="Nenhum treinamento ativo cadastrado. Vá até a aba Planejamento para adicionar." />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Print-only @page (orientação landscape para caber muitas colunas) */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { background: white !important; }
          .matriz-print-container, .matriz-print-container * { color: black !important; }
          .matriz-print-container .matriz-cell { border: 1px solid #ccc !important; background: transparent !important; }
        }
      `}</style>

      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-100">Matriz de treinamentos</h2>
          <p className="text-sm text-slate-400">
            Cruzamento colaboradores × treinamentos. Status derivado da última
            avaliação de competência aprovada e da periodicidade. Janela de aviso:{' '}
            <strong className="text-slate-200">{diasAviso} dias</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
        >
          Imprimir matriz
        </button>
      </header>

      <div className="flex flex-wrap gap-2 print:hidden">
        <ContadorChip status="ok" count={contadores.ok} />
        <ContadorChip status="vencendo" count={contadores.vencendo} />
        <ContadorChip status="vencido" count={contadores.vencido} />
        <ContadorChip status="pendente" count={contadores.pendente} />
        <span className="self-center text-xs text-slate-500 sm:ml-auto">
          {colaboradores.length} colaborador(es) × {treinamentos.length} treinamento(s) ={' '}
          {contadores.total} célula(s)
        </span>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h2 className="text-lg font-semibold">
          Matriz de Treinamentos — {new Date().toLocaleDateString('pt-BR')}
        </h2>
        <p className="text-xs">
          OK: {contadores.ok} · Vencendo: {contadores.vencendo} · Vencido:{' '}
          {contadores.vencido} · Pendente: {contadores.pendente}
        </p>
      </div>

      <div className="matriz-print-container overflow-auto rounded-lg border border-slate-800 bg-slate-900/40">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 min-w-[200px] border-b border-r border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Colaborador
              </th>
              {treinamentos.map((t) => (
                <th
                  key={t.id}
                  scope="col"
                  title={`${t.titulo} — periodicidade ${t.periodicidade}`}
                  className="sticky top-0 z-10 min-w-[120px] border-b border-r border-slate-800 bg-slate-900 px-2 py-2 text-left text-xs font-medium text-slate-300"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="line-clamp-2 leading-tight">{t.titulo}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">
                      {t.periodicidade}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c, i) => (
              <tr key={c.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-[200px] border-b border-r border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm font-medium text-slate-200"
                >
                  <div className="flex flex-col gap-0.5">
                    <span>{c.nome}</span>
                    <span className="text-[10px] text-slate-500">
                      {c.cargo} · {c.setor}
                    </span>
                  </div>
                </th>
                {treinamentos.map((t, j) => {
                  const cell = matriz[i][j];
                  const cfg = STATUS_CONFIG[cell.status];
                  return (
                    <td
                      key={t.id}
                      title={tooltipFor(c, t, cell)}
                      aria-label={`${c.nome} em ${t.titulo}: ${cfg.label}`}
                      className={`matriz-cell cursor-help border-b border-r border-slate-800 px-2 py-2 text-center align-middle text-xs font-medium transition-colors ${cfg.cellCls}`}
                    >
                      {cellLabel(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContadorChip({ status, count }: { status: StatusMatriz; count: number }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.chipCls}`}
    >
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}: {count}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 py-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
