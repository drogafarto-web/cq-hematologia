import React from 'react';

interface StatsToggleProps {
  value: 'manufacturer' | 'internal';
  onChange: (value: 'manufacturer' | 'internal') => void;
  isInternalReady: boolean;
  internalProgress: number; // 0-1
}

export const StatsToggle: React.FC<StatsToggleProps> = ({
  value,
  onChange,
  isInternalReady,
  internalProgress,
}) => {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-900/40 border border-slate-700 rounded-lg">
      <span className="text-xs font-medium text-slate-400">Estatística:</span>

      <div className="flex gap-2">
        {/* Manufacturer button */}
        <button
          onClick={() => onChange('manufacturer')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            value === 'manufacturer'
              ? 'bg-violet-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Bula
        </button>

        {/* Internal button */}
        <button
          onClick={() => onChange('internal')}
          disabled={!isInternalReady}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all relative group ${
            value === 'internal'
              ? 'bg-emerald-600 text-white shadow-md'
              : isInternalReady
                ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                : 'bg-slate-900 text-slate-600 cursor-not-allowed'
          }`}
          title={
            isInternalReady
              ? 'Usar estatística calculada a partir de runs recentes'
              : `Disponível após 20 runs (${Math.round(internalProgress * 100)}%)`
          }
        >
          Interna
          {!isInternalReady && (
            <span className="ml-1.5 text-slate-500">({Math.round(internalProgress * 100)}%)</span>
          )}
        </button>
      </div>

      {!isInternalReady && (
        <div className="ml-auto text-xs text-slate-500">
          <svg
            className="w-4 h-4 inline mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {Math.round(internalProgress * 20)} / 20 runs
        </div>
      )}
    </div>
  );
};

export default StatsToggle;
