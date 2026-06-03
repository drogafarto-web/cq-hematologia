interface ScoreSelectorProps {
  value: number | null;
  naoAplica: boolean;
  niveis: Record<number, string>;
  onChange: (score: number | null, naoAplica: boolean) => void;
}

const ACTIVE_STYLES: Record<number, string> = {
  0: 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-white/[0.08] dark:border-white/20 dark:text-white/60',
  1: 'bg-red-100 border-red-300 text-red-700 dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-400',
  2: 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-400',
  3: 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-400',
  4: 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-400',
  5: 'bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-600/20 dark:border-emerald-600/40 dark:text-emerald-300',
};

const DEFAULT_STYLE =
  'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.08]';

export function ScoreSelector({ value, naoAplica, niveis, onChange }: ScoreSelectorProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            aria-label={`Score ${score}${niveis[score] ? `: ${niveis[score]}` : ''}`}
            aria-pressed={value === score}
            disabled={naoAplica}
            className={`w-9 h-9 rounded-lg text-sm font-medium border transition-all duration-150 ${
              naoAplica
                ? 'opacity-40 pointer-events-none ' + DEFAULT_STYLE
                : value === score
                  ? ACTIVE_STYLES[score]
                  : DEFAULT_STYLE
            }`}
            onClick={() => onChange(score, false)}
          >
            {score}
          </button>
        ))}

        <button
          type="button"
          aria-label="Nao aplicavel"
          aria-pressed={naoAplica}
          className={`px-3 h-9 rounded-lg text-xs font-medium border transition-all duration-150 ml-4 ${
            naoAplica
              ? 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-500/20 dark:border-violet-500/40 dark:text-violet-400'
              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white/40 dark:hover:bg-white/[0.08]'
          }`}
          onClick={() => onChange(null, !naoAplica)}
        >
          N/A
        </button>
      </div>

      {value !== null && !naoAplica && niveis[value] && (
        <p className="text-xs text-slate-500 dark:text-white/50 mt-2 leading-relaxed">
          {niveis[value]}
        </p>
      )}
    </div>
  );
}
