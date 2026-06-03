import { INDICADORES } from '../data/indicadores';
import { BLOCOS } from '../data/blocos';
import type { BlocoId, BlocoMeta, RespostaIndicador } from '../types';

interface SidebarBlocosProps {
  currentBlocoIndex: number;
  respostas: RespostaIndicador[];
  onSelectBloco: (index: number) => void;
}

function getBlocoStats(bloco: BlocoMeta, respostas: RespostaIndicador[]) {
  const indicadores = INDICADORES.filter((ind) => bloco.indicadores.includes(ind.numero));
  const total = indicadores.length;
  const respondidos = indicadores.filter((ind) =>
    respostas.some((r) => r.numero === ind.numero && (r.score !== null || r.naoAplica)),
  ).length;
  const naoConformes = indicadores.filter((ind) =>
    respostas.some((r) => r.numero === ind.numero && r.critica === 'NÃO CONFORME'),
  ).length;
  return { total, respondidos, naoConformes };
}

export function SidebarBlocos({ currentBlocoIndex, respostas, onSelectBloco }: SidebarBlocosProps) {
  const totalRespondidos = respostas.filter((r) => r.score !== null || r.naoAplica).length;

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01] p-3 gap-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-white/30 px-2 mb-2">
        Blocos
      </p>

      {BLOCOS.map((bloco, i) => {
        const { total, respondidos, naoConformes } = getBlocoStats(bloco, respostas);
        const isCurrent = i === currentBlocoIndex;
        const isComplete = respondidos === total;
        const percent = total > 0 ? (respondidos / total) * 100 : 0;

        return (
          <button
            key={bloco.id}
            type="button"
            onClick={() => onSelectBloco(i)}
            className={`w-full text-left rounded-lg px-2.5 py-2 transition-all ${
              isCurrent
                ? 'bg-violet-50 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20'
                : 'hover:bg-slate-100 dark:hover:bg-white/[0.03] border border-transparent'
            }`}
            aria-label={`Bloco ${bloco.id}: ${bloco.nome} — ${respondidos}/${total} respondidos`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${
                  isCurrent
                    ? 'bg-violet-500 text-white'
                    : isComplete
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : 'bg-slate-200 text-slate-600 dark:bg-white/[0.08] dark:text-white/50'
                }`}
              >
                {bloco.id}
              </span>
              <span
                className={`text-xs truncate ${
                  isCurrent
                    ? 'font-medium text-violet-700 dark:text-violet-400'
                    : 'text-slate-600 dark:text-white/60'
                }`}
              >
                {bloco.nome}
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-1.5 pl-7">
              <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isComplete
                      ? 'bg-emerald-400 dark:bg-emerald-500'
                      : 'bg-violet-400 dark:bg-violet-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-white/30 tabular-nums w-8 text-right">
                {respondidos}/{total}
              </span>
            </div>

            {/* NC indicator */}
            {naoConformes > 0 && (
              <div className="pl-7 mt-1">
                <span className="text-[9px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                  {naoConformes} NC
                </span>
              </div>
            )}
          </button>
        );
      })}

      {/* Global progress */}
      <div className="mt-auto pt-3 border-t border-slate-200 dark:border-white/[0.06] px-2">
        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-white/40 mb-1">
          <span>Progresso total</span>
          <span className="font-medium tabular-nums">{totalRespondidos}/57</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${(totalRespondidos / 57) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1 text-center">
          {Math.round((totalRespondidos / 57) * 100)}% completo
        </p>
      </div>
    </aside>
  );
}
