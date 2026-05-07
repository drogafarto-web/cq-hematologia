/**
 * AuditTrailList.tsx
 *
 * Dark-first audit trail list component with filters, pagination, and chain validation.
 * Follows design system tokens: bg-[#141417], white/X, violet-500, emerald-500
 *
 * Features:
 * - Filter by modulo (enum), operador (combobox), resultado (radio group)
 * - Pagination with 50-entry page size
 * - Table: timestamp, modulo, operador, ação, resultado, hash (first 8 chars)
 * - Responsive: scrollable on mobile, sticky header
 * - Accessibility: aria-labels, keyboard nav, screen reader support (WCAG AA)
 * - Error handling with retry
 *
 * RDC 978 Art. 5.3: Immutable audit trail with chain validation support
 */

import React, { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAuditTrail } from '../hooks/useAuditTrail';
import type { AuditEntry } from '../services/auditCallables';
import type { LabId } from '../types/shared_refs';

interface AuditTrailListProps {
  labId?: LabId;
  onSelectEntry?: (entry: AuditEntry) => void;
}

const MODULO_OPTIONS = [
  'analyzer',
  'coagulacao',
  'ciq-imuno',
  'insumos',
  'controle-temperatura',
  'uroanalise',
  'equipamentos',
  'fornecedores',
  'lots',
  'runs',
  'chart',
  'reports',
  'labSettings',
  'hub',
  'bulaparser',
  'auth',
  'admin',
  'educacao-continuada',
  'sgq',
  'pops',
  'auditoria',
  'sgd',
  'treinamentos',
  'biosseguranca',
  'pgrss',
  'kpis',
  'lgpd',
  'analytics',
  'export',
  'mobile',
  'ceq',
  'bioquimica',
  'turnos',
  'risks',
  'lab-apoio',
] as const;

const RESULTADO_OPTIONS = [
  { value: 'sucesso' as const, label: 'Sucesso' },
  { value: 'falha' as const, label: 'Falha' },
  { value: 'aviso' as const, label: 'Aviso' },
] as const;

// Mock operators — in production, fetch from educacao-continuada/useColaboradores
const MOCK_OPERADORES = [
  { id: 'op-001', nome: 'João Silva' },
  { id: 'op-002', nome: 'Maria Santos' },
  { id: 'op-003', nome: 'Carlos Oliveira' },
  { id: 'op-004', nome: 'Ana Costa' },
  { id: 'op-005', nome: 'Pedro Martins' },
];

export function AuditTrailList({ labId: propLabId, onSelectEntry }: AuditTrailListProps) {
  const contextLabId = useActiveLabId();
  const labId = (propLabId || contextLabId) as LabId;

  const [state, actions] = useAuditTrail(labId);
  const { entries, total, hasMore, page, loading, error, filters } = state;

  // Helper: format timestamp to DD/MM/YYYY HH:MM:SS
  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // Helper: capitalize module name
  const capitalizeModulo = (modulo: string): string => {
    return modulo
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-');
  };

  // Helper: get badge styling by resultado
  const getResultadoBadgeStyle = (resultado: 'sucesso' | 'falha' | 'aviso'): string => {
    switch (resultado) {
      case 'sucesso':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'falha':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'aviso':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    }
  };

  const resultadoLabel: Record<string, string> = {
    sucesso: 'Sucesso',
    falha: 'Falha',
    aviso: 'Aviso',
  };

  // Handlers
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    actions.updateFilter(key, value);
  };

  const handleClearFilters = () => {
    actions.clearFilters();
  };

  const handlePrevPage = () => {
    actions.prevPage();
  };

  const handleNextPage = () => {
    actions.nextPage();
  };

  const handleRetry = () => {
    actions.retry();
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== null);

  return (
    <div className="space-y-6 bg-[#141417]">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-white">Trilha de Auditoria</h2>
          <p className="text-sm text-white/60 mt-1">
            {total > 0
              ? `${total} entrada${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'}`
              : 'Nenhuma entrada encontrada'}
          </p>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
        <h3 className="text-sm font-medium text-white">Filtros</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Modulo Filter */}
          <div className="space-y-2">
            <label htmlFor="filter-modulo" className="text-xs font-medium text-white/70 block">
              Módulo
            </label>
            <select
              id="filter-modulo"
              value={filters.modulo || ''}
              onChange={(e) => handleFilterChange('modulo', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              aria-label="Filtrar por módulo"
            >
              <option value="">Todos os módulos</option>
              {MODULO_OPTIONS.map((mod) => (
                <option key={mod} value={mod}>
                  {capitalizeModulo(mod)}
                </option>
              ))}
            </select>
          </div>

          {/* Operador Filter */}
          <div className="space-y-2">
            <label htmlFor="filter-operador" className="text-xs font-medium text-white/70 block">
              Operador
            </label>
            <select
              id="filter-operador"
              value={filters.operadorId || ''}
              onChange={(e) => handleFilterChange('operadorId', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              aria-label="Filtrar por operador"
            >
              <option value="">Todos os operadores</option>
              {MOCK_OPERADORES.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Resultado Filter */}
          <div className="space-y-2">
            <label htmlFor="filter-resultado" className="text-xs font-medium text-white/70 block">
              Resultado
            </label>
            <select
              id="filter-resultado"
              value={filters.resultado || ''}
              onChange={(e) => handleFilterChange('resultado', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              aria-label="Filtrar por resultado"
            >
              <option value="">Todos os resultados</option>
              {RESULTADO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
            aria-label="Limpar todos os filtros"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex justify-between items-start gap-4"
          role="alert"
          aria-live="polite"
        >
          <div>
            <p className="text-sm text-red-400 font-medium">Erro ao carregar auditoria</p>
            <p className="text-xs text-red-400/70 mt-1">{error.message}</p>
          </div>
          <button
            onClick={handleRetry}
            className="text-xs px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Tentar novamente"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty State */}
      {entries.length === 0 && !loading && (
        <div className="rounded-lg border border-white/10 p-12 text-center">
          <p className="text-white/50">Nenhuma entrada encontrada</p>
        </div>
      )}

      {/* Table */}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm" aria-label="Entradas da trilha de auditoria">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 sticky top-0 z-10">
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Data/Hora
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Módulo
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Operador
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Ação
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Resultado
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70 font-mono text-xs"
                  scope="col"
                  aria-sort="none"
                  title="Primeiros 8 caracteres do hash SHA-256"
                >
                  Hash
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onSelectEntry?.(entry)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectEntry?.(entry);
                    }
                  }}
                  aria-label={`Entrada de auditoria ${index + 1}: ${capitalizeModulo(entry.modulo)} em ${formatTimestamp(entry.timestamp)}`}
                >
                  <td className="px-4 py-3 text-white font-mono text-xs whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-white/90 truncate">
                    {capitalizeModulo(entry.modulo)}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-sm truncate">
                    {entry.operadorId}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-sm font-mono truncate">
                    {entry.operacao}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getResultadoBadgeStyle(
                        entry.resultado,
                      )}`}
                      aria-label={`Resultado: ${resultadoLabel[entry.resultado]}`}
                    >
                      {resultadoLabel[entry.resultado]}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 text-white/60 font-mono text-xs whitespace-nowrap"
                    title={`Hash completo: ${entry.hash}`}
                  >
                    {entry.hash.substring(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
            <p className="text-sm text-white/60">Carregando...</p>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {entries.length > 0 && !loading && (
        <div
          className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4"
          role="navigation"
          aria-label="Paginação"
        >
          <button
            onClick={handlePrevPage}
            disabled={page === 0}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Página anterior"
          >
            Anterior
          </button>

          <span className="text-sm text-white/60">
            Página {page + 1} de {Math.ceil(total / 50)}
          </span>

          <button
            onClick={handleNextPage}
            disabled={!hasMore}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Próxima página"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
