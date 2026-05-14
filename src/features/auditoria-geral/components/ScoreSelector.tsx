interface ScoreSelectorProps {
  value: number | null;
  naoAplica: boolean;
  niveis: Record<number, string>;
  onChange: (score: number | null, naoAplica: boolean) => void;
}

const ACTIVE_STYLES: Record<number, string> = {
  0: 'bg-white/[0.08] border-white/20 text-white/60',
  1: 'bg-red-500/20 border-red-500/40 text-red-400',
  2: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  3: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  4: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
  5: 'bg-emerald-600/20 border-emerald-600/40 text-emerald-300',
};

const DEFAULT_STYLE =
  'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.08]';

export function ScoreSelector({
  value,
  naoAplica,
  niveis,
  onChange,
}: ScoreSelectorProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
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
          className={`px-3 h-9 rounded-lg text-xs font-medium border transition-all duration-150 ml-2 ${
            naoAplica
              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
              : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.08]'
          }`}
          onClick={() => onChange(null, !naoAplica)}
        >
          N/A
        </button>
      </div>

      {value !== null && !naoAplica && niveis[value] && (
        <p className="text-xs text-white/50 mt-2 leading-relaxed">
          {niveis[value]}
        </p>
      )}
    </div>
  );
}