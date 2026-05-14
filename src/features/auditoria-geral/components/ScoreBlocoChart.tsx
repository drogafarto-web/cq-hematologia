import { BLOCOS } from '../data/blocos';
import type { ScoresPorBloco } from '../types';
import { getPercentColor } from '../utils/scoreUtils';

interface ScoreBlocoChartProps {
  scoresPorBloco: ScoresPorBloco;
}

function getBarColor(percent: number): string {
  if (percent < 40) return 'bg-red-400';
  if (percent < 60) return 'bg-amber-400';
  if (percent < 80) return 'bg-blue-400';
  return 'bg-emerald-400';
}

export function ScoreBlocoChart({ scoresPorBloco }: ScoreBlocoChartProps) {
  return (
    <div className="space-y-2">
      {BLOCOS.map((bloco) => {
        const score = scoresPorBloco[bloco.id] ?? 0;
        return (
          <div key={bloco.id} className="flex items-center gap-3">
            <span className="text-xs text-white/50 w-6 font-mono">{bloco.id}</span>
            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getBarColor(score)}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className={`text-xs font-mono w-10 text-right ${getPercentColor(score)}`}>
              {score}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
