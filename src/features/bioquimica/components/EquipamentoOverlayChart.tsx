import React, { useState, useMemo } from 'react';
import { ChartDataResult } from '../hooks/useChartData';
import LeveyJenningsChart from './LeveyJenningsChart';

interface EquipamentoOverlayChartProps {
  data: Map<string, ChartDataResult>;
  equipamentos: Array<{ id: string; nome: string }>;
  analitoName: string;
  nivelName: string;
}

// Generate consistent color for equipment by hash
const hashToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  const colors = [
    '#8b5cf6', // violet
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
  ];
  return colors[Math.abs(hash) % colors.length];
};

export const EquipamentoOverlayChart: React.FC<EquipamentoOverlayChartProps> = ({
  data,
  equipamentos,
  analitoName,
  nivelName,
}) => {
  const [selectedEquipamentos, setSelectedEquipamentos] = useState<Set<string>>(
    new Set(equipamentos.map((e) => e.id)),
  );

  const toggleEquipamento = (eqId: string) => {
    const newSet = new Set(selectedEquipamentos);
    if (newSet.has(eqId)) {
      newSet.delete(eqId);
    } else {
      newSet.add(eqId);
    }
    setSelectedEquipamentos(newSet);
  };

  const visibleEquipamentos = useMemo(() => {
    return equipamentos.filter((e) => selectedEquipamentos.has(e.id));
  }, [equipamentos, selectedEquipamentos]);

  if (data.size === 0) {
    return (
      <div className="flex items-center justify-center w-full h-64 bg-slate-900/30 rounded-lg border border-slate-700">
        <p className="text-slate-400 text-sm">Sem dados para comparação</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend / Equipment selector */}
      <div className="flex flex-wrap gap-3 items-center p-3 bg-slate-900/20 border border-slate-700 rounded-lg">
        <span className="text-xs font-medium text-slate-400">Equipamentos:</span>
        {equipamentos.map((eq) => {
          const hasData = data.has(eq.id);
          const isSelected = selectedEquipamentos.has(eq.id);
          const color = hashToColor(eq.id);

          return (
            <button
              key={eq.id}
              onClick={() => toggleEquipamento(eq.id)}
              disabled={!hasData}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isSelected && hasData
                  ? 'bg-slate-800 border border-slate-600'
                  : 'bg-slate-900 border border-slate-700'
              } ${!hasData ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-800'}`}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {eq.nome}
            </button>
          );
        })}
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {visibleEquipamentos.length === 0 ? (
          <div className="flex items-center justify-center w-full h-64 bg-slate-900/30 rounded-lg border border-slate-700">
            <p className="text-slate-400 text-sm">Selecione pelo menos um equipamento</p>
          </div>
        ) : (
          visibleEquipamentos.map((eq) => {
            const eqData = data.get(eq.id);
            if (!eqData) return null;

            return (
              <div
                key={eq.id}
                className="p-4 bg-slate-900/40 border border-slate-700 rounded-lg"
                style={{
                  borderLeftColor: hashToColor(eq.id),
                  borderLeftWidth: '3px',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: hashToColor(eq.id) }}
                  />
                  <h4 className="text-sm font-semibold text-slate-200">{eq.nome}</h4>
                </div>
                <LeveyJenningsChart data={eqData} analitoName={analitoName} nivelName={nivelName} />
              </div>
            );
          })
        )}
      </div>

      {visibleEquipamentos.length > 0 && (
        <div className="text-xs text-slate-500 italic">
          Dica: Compare os padrões visuais entre equipamentos. Discrepâncias podem indicar
          diferenças de calibração ou desempenho.
        </div>
      )}
    </div>
  );
};

export default EquipamentoOverlayChart;
