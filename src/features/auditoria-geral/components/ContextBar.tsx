interface ContextBarProps {
  blocoNome: string;
  blocoIndex: number;
  totalBlocos: number;
  itemNoBloco: number;
  totalItensBloco: number;
  totalRespondidos: number;
  totalIndicadores: number;
  onBack: () => void;
}

export function ContextBar({
  blocoNome,
  blocoIndex,
  totalBlocos,
  itemNoBloco,
  totalItensBloco,
  totalRespondidos,
  totalIndicadores,
  onBack,
}: ContextBarProps) {
  const blocoPercent = totalItensBloco > 0 ? (itemNoBloco / totalItensBloco) * 100 : 0;
  const globalPercent = totalIndicadores > 0 ? (totalRespondidos / totalIndicadores) * 100 : 0;

  return (
    <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0B0F14]/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/[0.06] -mx-6 px-6 py-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/80 transition-colors"
            aria-label="Voltar ao painel"
          >
            ← Voltar
          </button>
          <span className="text-slate-300 dark:text-white/20">|</span>
          <span className="font-medium text-slate-700 dark:text-white/80">
            Bloco {blocoIndex + 1}/{totalBlocos}: {blocoNome}
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-500 dark:text-white/50">
          <span>
            {totalRespondidos}/{totalIndicadores} total ({Math.round(globalPercent)}%)
          </span>
        </div>
      </div>

      {/* Dual progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${blocoPercent}%` }}
            role="progressbar"
            aria-valuenow={itemNoBloco}
            aria-valuemin={0}
            aria-valuemax={totalItensBloco}
            aria-label={`Bloco: ${itemNoBloco} de ${totalItensBloco} respondidos`}
          />
        </div>
        <span className="text-[10px] text-slate-400 dark:text-white/30 w-16 text-right shrink-0">
          {itemNoBloco}/{totalItensBloco}
        </span>
      </div>
    </div>
  );
}
