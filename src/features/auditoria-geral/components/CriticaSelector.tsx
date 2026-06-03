import type { CriticaStatus } from '../types';

interface CriticaSelectorProps {
  value: CriticaStatus | null;
  score: number | null;
  onChange: (critica: CriticaStatus | null) => void;
}

const OPTIONS: { value: CriticaStatus; label: string; shortLabel: string }[] = [
  { value: 'CONFORME', label: 'Conforme', shortLabel: 'C' },
  { value: 'NÃO CONFORME', label: 'Não Conforme', shortLabel: 'NC' },
  { value: 'NÃO APLICA', label: 'Não Aplica', shortLabel: 'NA' },
];

function getSuggestion(score: number | null): CriticaStatus | null {
  if (score === null) return null;
  if (score <= 1) return 'NÃO CONFORME';
  if (score >= 4) return 'CONFORME';
  return null;
}

export function CriticaSelector({ value, score, onChange }: CriticaSelectorProps) {
  const suggestion = getSuggestion(score);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-slate-500 dark:text-white/40 uppercase tracking-wide">
        Julgamento de Conformidade
      </p>
      <div className="flex items-center gap-2">
        {OPTIONS.map((opt) => {
          const isSelected = value === opt.value;
          const isSuggested = !isSelected && suggestion === opt.value;

          let baseStyle =
            'bg-slate-50 border-slate-200 text-slate-600 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white/50';
          if (isSelected) {
            if (opt.value === 'CONFORME') {
              baseStyle =
                'bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/50 dark:text-emerald-300 ring-1 ring-emerald-500/30';
            } else if (opt.value === 'NÃO CONFORME') {
              baseStyle =
                'bg-red-100 border-red-400 text-red-800 dark:bg-red-500/20 dark:border-red-500/50 dark:text-red-300 ring-1 ring-red-500/30';
            } else {
              baseStyle =
                'bg-slate-200 border-slate-400 text-slate-700 dark:bg-white/[0.08] dark:border-white/20 dark:text-white/70 ring-1 ring-slate-400/30';
            }
          } else if (isSuggested) {
            if (opt.value === 'CONFORME') {
              baseStyle =
                'bg-slate-50 border-emerald-300 text-slate-600 dark:bg-white/[0.04] dark:border-emerald-500/30 dark:text-white/50 border-dashed';
            } else if (opt.value === 'NÃO CONFORME') {
              baseStyle =
                'bg-slate-50 border-red-300 text-slate-600 dark:bg-white/[0.04] dark:border-red-500/30 dark:text-white/50 border-dashed';
            }
          }

          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Marcar como ${opt.label}`}
              onClick={() => onChange(isSelected ? null : opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 hover:ring-1 hover:ring-violet-500/20 ${baseStyle}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {suggestion && !value && (
        <p className="text-[10px] text-slate-400 dark:text-white/30 italic">
          Sugestão baseada no score: {suggestion === 'CONFORME' ? 'Conforme' : 'Não Conforme'}
        </p>
      )}
    </div>
  );
}
