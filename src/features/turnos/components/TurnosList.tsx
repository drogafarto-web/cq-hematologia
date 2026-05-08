import { useState, useMemo } from 'react';
import { useTurnos } from '../hooks/useTurnos';
import type { Turno } from '../types/Turno';
import { SupervisorPresencaActions } from './SupervisorPresencaActions';

const PERIODO_LABEL: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  plantao: 'Plantão',
};

interface TurnosListProps {
  onEdit?: (turno: Turno) => void;
}

export function TurnosList({ onEdit }: TurnosListProps) {
  const { turnos, isLoading, softDelete } = useTurnos();
  const [filterDataFrom, setFilterDataFrom] = useState('');
  const [filterDataTo, setFilterDataTo] = useState('');
  const [filterPeriodo, setFilterPeriodo] = useState('');
  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [sortBy, setSortBy] = useState<'data-desc' | 'data-asc'>('data-desc');

  const filtered = useMemo(() => {
    let result = turnos.filter((t) => !t.deletadoEm);

    if (filterDataFrom) {
      result = result.filter((t) => t.data >= filterDataFrom);
    }
    if (filterDataTo) {
      result = result.filter((t) => t.data <= filterDataTo);
    }
    if (filterPeriodo) {
      result = result.filter((t) => t.periodo === filterPeriodo);
    }
    if (filterSupervisor) {
      result = result.filter((t) => t.supervisorId === filterSupervisor);
    }

    result.sort((a, b) => {
      const cmp = a.data.localeCompare(b.data);
      return sortBy === 'data-desc' ? -cmp : cmp;
    });

    return result;
  }, [turnos, filterDataFrom, filterDataTo, filterPeriodo, filterSupervisor, sortBy]);

  const supervisors = useMemo(
    () => Array.from(new Set(turnos.map((t) => t.supervisorId))),
    [turnos],
  );

  if (isLoading && turnos.length === 0) {
    return <div className="text-center text-slate-400">Carregando turnos...</div>;
  }

  if (turnos.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
        <p className="text-slate-400">Nenhum turno registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="grid grid-cols-4 gap-3 rounded-lg bg-slate-800 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">Data de (AAAA-MM-DD)</label>
          <input
            type="date"
            value={filterDataFrom}
            onChange={(e) => setFilterDataFrom(e.target.value)}
            className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">Data até (AAAA-MM-DD)</label>
          <input
            type="date"
            value={filterDataTo}
            onChange={(e) => setFilterDataTo(e.target.value)}
            className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">Período</label>
          <select
            value={filterPeriodo}
            onChange={(e) => setFilterPeriodo(e.target.value)}
            className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100"
          >
            <option value="">Todos</option>
            <option value="manha">Manhã</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
            <option value="plantao">Plantão</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">Supervisor</label>
          <select
            value={filterSupervisor}
            onChange={(e) => setFilterSupervisor(e.target.value)}
            className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100"
          >
            <option value="">Todos</option>
            {supervisors.map((supId) => {
              const sup = turnos.find((t) => t.supervisorId === supId);
              return (
                <option key={supId} value={supId}>
                  {sup?.supervisorName}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* TODO: Design tokens for color, spacing refinement */}
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-200">
                <button
                  onClick={() => setSortBy(sortBy === 'data-desc' ? 'data-asc' : 'data-desc')}
                  className="text-emerald-400 underline"
                >
                  Data {sortBy === 'data-desc' ? '↓' : '↑'}
                </button>
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-200">Período</th>
              <th className="px-4 py-2 text-left font-medium text-slate-200">Supervisor</th>
              <th className="px-4 py-2 text-left font-medium text-slate-200">CRBM</th>
              <th className="px-4 py-2 text-left font-medium text-slate-200">Inferida?</th>
              <th className="px-4 py-2 text-left font-medium text-slate-200">Presença</th>
              <th className="px-4 py-2 text-left font-medium text-slate-200">Observações</th>
              <th className="px-4 py-2 text-left font-medium text-slate-200">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filtered.map((turno) => (
              <tr key={turno.id} className="hover:bg-slate-750">
                <td className="px-4 py-2 font-mono text-slate-100 tabular-nums">{turno.data}</td>
                <td className="px-4 py-2 text-slate-100">{PERIODO_LABEL[turno.periodo]}</td>
                <td className="px-4 py-2 text-slate-100">{turno.supervisorName}</td>
                <td className="px-4 py-2 text-slate-100">{turno.supervisorCRBM || '—'}</td>
                <td className="px-4 py-2 text-slate-100">
                  {turno.inferred ? (
                    <span className="text-amber-400">Sim (pendente confirmação)</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2">
                  <SupervisorPresencaActions turno={turno} />
                </td>
                <td className="px-4 py-2 max-w-xs truncate text-slate-300">
                  {turno.observacoes || '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit?.(turno)}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          window.confirm(
                            `Tem certeza que deseja arquivar o turno de ${turno.data} às ${PERIODO_LABEL[turno.periodo]}?`,
                          )
                        ) {
                          await softDelete(turno.id);
                        }
                      }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Arquivar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-slate-400">
          Nenhum turno encontrado com os filtros aplicados.
        </div>
      )}
    </div>
  );
}
