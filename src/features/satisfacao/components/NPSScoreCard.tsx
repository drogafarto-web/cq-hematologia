import React from 'react';
import { useNPSScore } from '../hooks/useNPSScore';
import type { LabId } from '../../../types';

interface NPSScoreCardProps {
  labId: LabId;
  origem?: 'pos-reclamacao' | 'trimestral';
  title?: string;
}

export const NPSScoreCard: React.FC<NPSScoreCardProps> = ({
  labId,
  origem,
  title = 'Net Promoter Score',
}) => {
  const { nps, total, promotores, neutros, detratores, isLoading } = useNPSScore(labId, {
    origem,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#1f2937] rounded-lg p-6 min-h-[200px] flex items-center justify-center">
        <div className="text-center text-gray-500">Carregando NPS...</div>
      </div>
    );
  }

  const promotorPercent = total > 0 ? Math.round((promotores / total) * 100) : 0;
  const neutroPercent = total > 0 ? Math.round((neutros / total) * 100) : 0;
  const detratorcent = total > 0 ? Math.round((detratores / total) * 100) : 0;

  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>

      <div className="flex items-center gap-8">
        {/* NPS Score */}
        <div className="flex flex-col items-center">
          <div
            className={`text-5xl font-bold tabular-nums ${
              nps >= 50
                ? 'text-emerald-500'
                : nps >= 0
                  ? 'text-yellow-500'
                  : 'text-red-500'
            }`}
          >
            {nps}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">NPS Score</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">n={total}</p>
        </div>

        {/* Category breakdown */}
        <div className="flex-1 space-y-3">
          {/* Promotores */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Promotores
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {promotorPercent}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${promotorPercent}%` }}
              />
            </div>
          </div>

          {/* Neutros */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Neutros
              </span>
              <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">
                {neutroPercent}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all"
                style={{ width: `${neutroPercent}%` }}
              />
            </div>
          </div>

          {/* Detratores */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Detratores
              </span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">
                {detratorcent}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${detratorcent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
