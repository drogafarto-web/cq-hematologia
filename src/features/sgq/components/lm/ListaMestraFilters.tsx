/**
 * ListaMestraFilters.tsx
 *
 * Filters for LM-01 dashboard: tipo, status, setor, period.
 * URL param persistence for deep linking.
 */

import { useCallback, useMemo, useState } from 'react';
import type { TipoDocumento } from './TipoDocumentoBadge';
import type { StatusVigencia } from './StatusVigenciaBadge';
import { TipoDocumentoBadge } from './TipoDocumentoBadge';
import { StatusVigenciaBadge } from './StatusVigenciaBadge';

const TIPOS: TipoDocumento[] = ['MQ', 'PQ', 'IT', 'FR', 'POL', 'ROP', 'AP', 'EP', 'DOC', 'REL', 'CER', 'AUD', 'REC', 'FORM', 'OUT'];
const SETORES = ['Bioquímica', 'Hematologia', 'Imunologia', 'Coagulação', 'Microbiologia', 'Citologia', 'Histopatologia', 'Uroanálise', 'Endocrinologia', 'Farmácia', 'Recepção', 'Financeiro', 'TI', 'Qualidade', 'Direção', 'RH', 'Almoxarifado'];
const STATUSES: StatusVigencia[] = ['draft', 'em-revisao', 'vigente', 'obsoleto'];

interface ListaMestraFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
}

export interface FilterState {
  tipo?: TipoDocumento;
  status?: StatusVigencia;
  setor?: string;
  period?: 'all' | '7d' | '30d' | '90d';
  searchText?: string;
}

export function ListaMestraFilters({ onFiltersChange }: ListaMestraFiltersProps) {
  const [filters, setFiltersState] = useState<FilterState>({});

  const updateFilter = useCallback((key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFiltersState(newFilters);
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const clearFilters = useCallback(() => {
    setFiltersState({});
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters = Object.values(filters).some(v => v && v !== 'all');

  return (
    <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
      {/* Search */}
      <div>
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">Buscar</label>
        <input
          type="text"
          placeholder="Código ou título..."
          value={filters.searchText || ''}
          onChange={(e) => updateFilter('searchText', e.target.value || undefined)}
          className="mt-2 w-full px-3 py-2 bg-[#141417] border border-white/10 rounded-lg text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
      </div>

      {/* Tipo */}
      <div>
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">Tipo</label>
        <select
          value={filters.tipo || ''}
          onChange={(e) => updateFilter('tipo', e.target.value || undefined)}
          className="mt-2 w-full px-3 py-2 bg-[#141417] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        >
          <option value="">Todos os tipos</option>
          {TIPOS.map(tipo => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div>
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">Status</label>
        <div className="mt-2 space-y-2">
          {STATUSES.map(status => (
            <label key={status} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.status === status}
                onChange={(e) => updateFilter('status', e.target.checked ? status : undefined)}
                className="w-4 h-4 rounded-sm"
              />
              <StatusVigenciaBadge status={status} showLabel tooltip={false} />
            </label>
          ))}
        </div>
      </div>

      {/* Setor */}
      <div>
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">Setor de Distribuição</label>
        <select
          value={filters.setor || ''}
          onChange={(e) => updateFilter('setor', e.target.value || undefined)}
          className="mt-2 w-full px-3 py-2 bg-[#141417] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        >
          <option value="">Todos os setores</option>
          {SETORES.map(setor => (
            <option key={setor} value={setor}>{setor}</option>
          ))}
        </select>
      </div>

      {/* Period */}
      <div>
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">Período</label>
        <select
          value={filters.period || 'all'}
          onChange={(e) => updateFilter('period', e.target.value as FilterState['period'])}
          className="mt-2 w-full px-3 py-2 bg-[#141417] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        >
          <option value="all">Todos</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition-colors duration-150"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
