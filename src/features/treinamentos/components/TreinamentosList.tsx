import { memo, useCallback, useState } from 'react';
import { useTreinamentos } from '../useTreinamentos';
import { TIPO_LABEL, STATUS_LABEL, isTreinamentoPendente } from '../types/Treinamento';
import type { Treinamento, TreinamentoFilters, StatusTreinamento, TipoTreinamento } from '../types/Treinamento';

export function TreinamentosList() {
  const [filters, setFilters] = useState<TreinamentoFilters>({});
  const { treinamentos, loading, error } = useTreinamentos(filters);

  const handleFilterChange = useCallback((key: keyof TreinamentoFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Carregando treinamentos...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Erro: {error.message}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Status</label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value as StatusTreinamento)}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Tipo</label>
          <select
            value={filters.tipo || ''}
            onChange={(e) => handleFilterChange('tipo', e.target.value as TipoTreinamento)}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          >
            <option value="">Todos</option>
            {Object.entries(TIPO_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Busca</label>
          <input
            type="text"
            placeholder="POP ou instrutor..."
            value={filters.busca || ''}
            onChange={(e) => handleFilterChange('busca', e.target.value)}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
          />
        </div>
      </div>

      {/* List */}
      {treinamentos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>Nenhum treinamento encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-800 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-300">POP / Título</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-300">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-300">Data Agendada</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-300">Frequência</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-300">Instrutor</th>
              </tr>
            </thead>
            <tbody>
              {treinamentos.map((t) => (
                <TreinamentoRow key={t.id} treinamento={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── TreinamentoRow ───────────────────────────────────────────────────────────

const TreinamentoRow = memo(function TreinamentoRow({
  treinamento: t,
}: {
  treinamento: Treinamento;
}) {
  const presentes = Object.values(t.presenca).filter((p) => p.presente).length;

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-white">{t.popNome}</div>
        <div className="text-xs text-gray-400">{t.titulo}</div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{TIPO_LABEL[t.tipo]}</td>
      <td className="px-4 py-3">
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            isTreinamentoPendente(t)
              ? 'bg-yellow-900 text-yellow-100'
              : t.status === 'realizado'
                ? 'bg-emerald-900 text-emerald-100'
                : 'bg-gray-800 text-gray-300'
          }`}
        >
          {STATUS_LABEL[t.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {t.dataAgendada.toDate().toLocaleDateString('pt-BR')}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {presentes} / {t.participantes.length}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{t.instrutorNome}</td>
    </tr>
  );
});
