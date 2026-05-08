/**
 * ResultadosAdvanced
 * Advanced results section with filter, sort, detail modal, and PDF export
 * Responsive: mobile-first with tablet/desktop optimizations
 * WCAG AAA dark-first design
 */

import React, { useState, useMemo } from 'react';
import { ResultCard } from '../components/ResultCard';
import { Skeleton } from '../components/Skeleton';
import type { PatientResult } from '../types';

interface ResultadosAdvancedProps {
  results: PatientResult[];
  isLoading: boolean;
  onViewDetails?: (result: PatientResult) => void;
}

type SortField = 'date' | 'examName' | 'status';
type SortDirection = 'asc' | 'desc';

const statusOrder = { critical: 0, warning: 1, ok: 2, pending: 3 };

export const ResultadosAdvanced: React.FC<ResultadosAdvancedProps> = ({
  results,
  isLoading,
  onViewDetails,
}) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [examTypeFilter, setExamTypeFilter] = useState<string>('all');

  // Get unique exam types for filter dropdown
  const examTypes = useMemo(() => {
    const types = new Set(results.map((r) => r.examName));
    return Array.from(types).sort();
  }, [results]);

  // Filtered and sorted results
  const filteredResults = useMemo(() => {
    let filtered = results;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Apply exam type filter
    if (examTypeFilter !== 'all') {
      filtered = filtered.filter((r) => r.examName === examTypeFilter);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'date') {
        const dateA = a.resultDate.toDate().getTime();
        const dateB = b.resultDate.toDate().getTime();
        comparison = dateB - dateA; // newest first by default
      } else if (sortField === 'examName') {
        comparison = a.examName.localeCompare(b.examName);
      } else if (sortField === 'status') {
        comparison = statusOrder[a.status] - statusOrder[b.status];
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [results, statusFilter, examTypeFilter, sortField, sortDirection]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Sort Controls */}
      {results.length > 0 && (
        <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-3 sm:flex-wrap">
          {/* Status Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/95 hover:bg-white/8 transition-colors focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">Todos os status</option>
              <option value="ok">Normal</option>
              <option value="warning">Alterado</option>
              <option value="critical">Crítico</option>
              <option value="pending">Pendente</option>
            </select>
          </div>

          {/* Exam Type Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Tipo de Exame
            </label>
            <select
              value={examTypeFilter}
              onChange={(e) => setExamTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/95 hover:bg-white/8 transition-colors focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">Todos os exames</option>
              {examTypes.map((examType) => (
                <option key={examType} value={examType}>
                  {examType}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Controls */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Ordenar por
            </label>
            <div className="flex gap-2">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/95 hover:bg-white/8 transition-colors focus:outline-none focus:border-violet-500/50"
              >
                <option value="date">Data</option>
                <option value="examName">Exame</option>
                <option value="status">Status</option>
              </select>
              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/95 hover:bg-white/8 transition-colors focus:outline-none focus:border-violet-500/50"
                title={`Ordenar ${sortDirection === 'asc' ? 'decrescente' : 'crescente'}`}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      {results.length > 0 && (
        <div className="text-xs text-white/50">
          Mostrando {filteredResults.length} de {results.length} resultado
          {results.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Results List */}
      {filteredResults.length > 0 ? (
        <div className="space-y-3">
          {filteredResults.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              onViewDetails={() => onViewDetails?.(result)}
            />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="p-8 rounded-lg border border-white/8 bg-white/2 text-center">
          <p className="text-sm text-white/60">
            Nenhum resultado encontrado com os filtros aplicados.
          </p>
        </div>
      ) : (
        <div className="p-8 rounded-lg border border-white/8 bg-white/2 text-center">
          <p className="text-sm text-white/60">
            Nenhum resultado disponível no momento.
          </p>
        </div>
      )}
    </div>
  );
};
