import { useMemo, useState } from 'react';
import { useCoberturaTurnos } from '../hooks/useCoberturaTurnos';
import { useTurnos } from '../hooks/useTurnos';
import type { Turno } from '../types/Turno';

const PERIODOS = ['manha', 'tarde', 'noite', 'plantao'];
const PERIODO_LABEL: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  plantao: 'Plantão',
};

function getCellColor(status: string): string {
  switch (status) {
    case 'registered':
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
    case 'inferred':
      return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
    case 'missing':
      return 'bg-red-500/15 border-red-500/30 text-red-300';
    case 'multiple':
      return 'bg-purple-500/15 border-purple-500/30 text-purple-300';
    default:
      return 'bg-slate-700/50 text-slate-300';
  }
}

interface CoberturaReportProps {
  onSelectTurno?: (turno: Turno) => void;
}

export function CoberturaReport({ onSelectTurno }: CoberturaReportProps) {
  const { turnos, isLoading } = useTurnos();
  const coverage = useCoberturaTurnos(turnos);
  const [selectedCell, setSelectedCell] = useState<{
    data: string;
    periodo: string;
  } | null>(null);

  const dates = useMemo(() => {
    const arr: string[] = [];
    const now = new Date();
    for (let i = 0; i < 90; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr.reverse();
  }, []);

  const selectedCellData = selectedCell
    ? coverage.get(selectedCell.data)?.get(selectedCell.periodo)
    : null;

  if (isLoading) {
    return <div className="text-center text-slate-400">Carregando cobertura...</div>;
  }

  return (
    <div className="flex gap-6">
      {/* Heatmap */}
      <div className="flex-1 overflow-x-auto rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="inline-block">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">
                  Data
                </th>
                {PERIODOS.map((p) => (
                  <th
                    key={p}
                    className="border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300"
                  >
                    {PERIODO_LABEL[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <tr key={date}>
                    <td className="border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-300">
                      {date}
                      <br />
                      <span className="text-slate-500">{dayLabel}</span>
                    </td>
                    {PERIODOS.map((periodo) => {
                      const cell = coverage.get(date)?.get(periodo);
                      const isSelected =
                        selectedCell?.data === date && selectedCell?.periodo === periodo;

                      return (
                        <td
                          key={`${date}-${periodo}`}
                          onClick={() => setSelectedCell({ data: date, periodo })}
                          className={`border px-2 py-1 cursor-pointer text-xs font-medium transition ${getCellColor(cell?.status || 'missing')} ${isSelected ? 'ring-2 ring-white' : ''}`}
                        >
                          {cell?.status === 'missing' && '—'}
                          {cell?.status === 'registered' && '✓'}
                          {cell?.status === 'inferred' && '?'}
                          {cell?.status === 'multiple' && '!'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend + Details */}
      <div
        className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4"
        style={{ minWidth: '300px' }}
      >
        <div>
          <h3 className="mb-3 font-semibold text-slate-100">Legenda</h3>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-emerald-500/30 border border-emerald-500/50" />
              <span className="text-slate-300">Registrado (✓)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-amber-500/30 border border-amber-500/50" />
              <span className="text-slate-300">Inferido (?) — pendente confirmação</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-red-500/30 border border-red-500/50" />
              <span className="text-slate-300">Faltando (—)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-purple-500/30 border border-purple-500/50" />
              <span className="text-slate-300">Múltiplos (!)</span>
            </div>
          </div>
        </div>

        {/* Selected cell details */}
        {selectedCell && selectedCellData && (
          <div className="border-t border-slate-700 pt-4">
            <h3 className="mb-2 font-semibold text-slate-100">
              {selectedCell.data} • {PERIODO_LABEL[selectedCell.periodo]}
            </h3>

            {selectedCellData.turnos.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum turno registrado</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedCellData.turnos.map((turno) => (
                  <div key={turno.id} className="flex flex-col gap-1 rounded bg-slate-700 p-2">
                    <p className="text-xs font-medium text-slate-100">{turno.supervisorName}</p>
                    <p className="text-xs text-slate-400">{turno.supervisorCRBM || 'sem CRBM'}</p>
                    {turno.inferred && (
                      <p className="text-xs text-amber-400">Inferido (pendente confirmação)</p>
                    )}
                    {turno.observacoes && (
                      <p className="text-xs text-slate-300">"{turno.observacoes}"</p>
                    )}
                    {/* TODO: Add inline "Confirmar inferida" button if turno.inferred */}
                    {turno.inferred && (
                      <button
                        onClick={() => onSelectTurno?.(turno)}
                        className="mt-1 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        → Confirmar/Editar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
