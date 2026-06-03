interface ScoreSelectorWithRubricProps {
  value: number | null;
  naoAplica: boolean;
  niveis: Record<number, string>;
  onChange: (score: number | null, naoAplica: boolean) => void;
}

const SCORE_COLORS: Record<number, { bg: string; border: string; text: string; activeBg: string }> =
  {
    0: {
      bg: 'bg-slate-50 dark:bg-white/[0.02]',
      border: 'border-slate-200 dark:border-white/[0.08]',
      text: 'text-slate-600 dark:text-white/60',
      activeBg: 'bg-slate-100 dark:bg-white/[0.08]',
    },
    1: {
      bg: 'bg-red-50/50 dark:bg-red-500/5',
      border: 'border-red-200 dark:border-red-500/20',
      text: 'text-red-700 dark:text-red-400',
      activeBg: 'bg-red-100 dark:bg-red-500/20',
    },
    2: {
      bg: 'bg-orange-50/50 dark:bg-orange-500/5',
      border: 'border-orange-200 dark:border-orange-500/20',
      text: 'text-orange-700 dark:text-orange-400',
      activeBg: 'bg-orange-100 dark:bg-orange-500/20',
    },
    3: {
      bg: 'bg-amber-50/50 dark:bg-amber-500/5',
      border: 'border-amber-200 dark:border-amber-500/20',
      text: 'text-amber-700 dark:text-amber-400',
      activeBg: 'bg-amber-100 dark:bg-amber-500/20',
    },
    4: {
      bg: 'bg-emerald-50/50 dark:bg-emerald-500/5',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      text: 'text-emerald-700 dark:text-emerald-400',
      activeBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    },
    5: {
      bg: 'bg-emerald-50/50 dark:bg-emerald-600/5',
      border: 'border-emerald-300 dark:border-emerald-600/20',
      text: 'text-emerald-800 dark:text-emerald-300',
      activeBg: 'bg-emerald-100 dark:bg-emerald-600/20',
    },
  };

const BADGE_COLORS: Record<number, string> = {
  0: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/60',
  1: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  2: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  3: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  4: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  5: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-300',
};

export function ScoreSelectorWithRubric({
  value,
  naoAplica,
  niveis,
  onChange,
}: ScoreSelectorWithRubricProps) {
  return (
    <div className={`space-y-1 ${naoAplica ? 'opacity-40 pointer-events-none' : ''}`}>
      <p className="text-[11px] font-medium text-slate-500 dark:text-white/40 uppercase tracking-wide mb-2">
        Escala de Maturidade
      </p>
      {[0, 1, 2, 3, 4, 5].map((score) => {
        const isSelected = value === score;
        const colors = SCORE_COLORS[score];
        const text = niveis[score] || '';

        return (
          <button
            key={score}
            type="button"
            aria-pressed={isSelected}
            aria-label={`Score ${score}: ${text}`}
            disabled={naoAplica}
            onClick={() => onChange(score, false)}
            className={`w-full text-left rounded-lg border px-3 py-2 transition-all duration-150 ${
              isSelected
                ? `${colors.activeBg} ${colors.border} ring-1 ring-violet-500/30`
                : `${colors.bg} ${colors.border} hover:ring-1 hover:ring-violet-500/20`
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold shrink-0 mt-0.5 ${BADGE_COLORS[score]}`}
              >
                {score}
              </span>
              <span
                className={`text-xs leading-relaxed ${
                  isSelected ? colors.text + ' font-medium' : 'text-slate-600 dark:text-white/60'
                } ${!isSelected ? 'line-clamp-1' : ''}`}
              >
                {text || (
                  <span className="italic text-slate-400 dark:text-white/30">Sem descrição</span>
                )}
              </span>
            </div>
          </button>
        );
      })}

      <div className="pt-2">
        <button
          type="button"
          aria-label="Não aplicável"
          aria-pressed={naoAplica}
          onClick={() => onChange(null, !naoAplica)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
            naoAplica
              ? 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-500/20 dark:border-violet-500/40 dark:text-violet-400 opacity-100 pointer-events-auto'
              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white/40 dark:hover:bg-white/[0.08]'
          }`}
        >
          N/A — Não Aplicável
        </button>
      </div>
    </div>
  );
}
