import React from 'react';

interface ConformityScaleProps {
  niveis: Record<string, string>;
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
}

const LEVEL_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-100' },
  2: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-100' },
  3: { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-100' },
  4: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-100' },
  5: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-100' },
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Crítico',
  2: 'Parcial',
  3: 'Com gaps',
  4: 'Conforme',
  5: 'Excelência',
};

export function ConformityScale({ niveis, value, onChange, disabled = false }: ConformityScaleProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1" role="radiogroup" aria-label="Escala de conformidade">
        {[1, 2, 3, 4, 5].map((level) => {
          const isSelected = value === level;
          const colors = LEVEL_COLORS[level];
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Nível ${level}: ${LEVEL_LABELS[level]}`}
              disabled={disabled}
              onClick={() => onChange(level)}
              className={`
                flex-1 py-3 px-2 rounded-lg text-center font-semibold text-sm transition-all
                ${isSelected
                  ? `${colors.bg} ${colors.text} ring-2 ring-offset-2 ring-offset-slate-900 ring-white/50 scale-105`
                  : `bg-white/5 border ${colors.border}/30 text-white/60 hover:bg-white/10`
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className="block text-lg">{level}</span>
              <span className="block text-xs mt-0.5 opacity-80">{LEVEL_LABELS[level]}</span>
            </button>
          );
        })}
      </div>

      {value && niveis[String(value)] && (
        <div className={`p-3 rounded-lg border ${LEVEL_COLORS[value].border}/20 bg-white/5`}>
          <p className="text-sm text-white/80 leading-relaxed">
            <span className={`font-semibold ${LEVEL_COLORS[value].text}`}>Nível {value}:</span>{' '}
            {niveis[String(value)]}
          </p>
        </div>
      )}
    </div>
  );
}
