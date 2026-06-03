/**
 * CAPAListView — Table of all CAPAs with status badges, filters, sorting
 *
 * Features:
 * - Dark-first table (bg-[#141417], text-white/90)
 * - Filter bar: status dropdown, sortable columns
 * - Status badges with icons (aberta=red, em-tratamento=yellow, verificada=blue, fechada=green)
 * - Click row to navigate to detail
 * - Skeleton loading state
 * - WCAG AA: semantic table, focus rings, keyboard navigation
 */

import React, { useState, useMemo } from 'react';
import type { CAPA, CAPAStatus } from '../types';

interface CAPAListViewProps {
  capas: CAPA[];
  isLoading: boolean;
  error: string | null;
  onCreateClick?: () => void;
  onCAPASelect?: (capaId: string) => void;
}

const STATUS_STYLES: Record<CAPAStatus, { bg: string; text: string; icon: string; label: string }> =
  {
    aberta: {
      bg: 'bg-red-900/20 border-red-700/50',
      text: 'text-red-200',
      icon: '●',
      label: 'Aberta',
    },
    'em-tratamento': {
      bg: 'bg-amber-900/20 border-amber-700/50',
      text: 'text-amber-200',
      icon: '◐',
      label: 'Em Tratamento',
    },
    verificada: {
      bg: 'bg-blue-900/20 border-blue-700/50',
      text: 'text-blue-200',
      icon: '◐',
      label: 'Verificada',
    },
    fechada: {
      bg: 'bg-emerald-900/20 border-emerald-700/50',
      text: 'text-emerald-200',
      icon: '✓',
      label: 'Fechada',
    },
    cancelada: {
      bg: 'bg-gray-900/20 border-gray-700/50',
      text: 'text-gray-200',
      icon: '✕',
      label: 'Cancelada',
    },
  };

const PRIORITY_LABELS: Record<number, string> = {
  1: '▁ Baixa',
  2: '▂ Média-Baixa',
  3: '▃ Média',
  4: '▄ Média-Alta',
  5: '▅ Alta',
};

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.05] hover:bg-white/[0.04]">
      <td className="p-3">
        <div className="h-4 bg-white/10 rounded w-16 animate-pulse" />
      </td>
      <td className="p-3">
        <div className="h-4 bg-white/10 rounded w-32 animate-pulse" />
      </td>
      <td className="p-3">
        <div className="h-4 bg-white/10 rounded w-24 animate-pulse" />
      </td>
      <td className="p-3">
        <div className="h-4 bg-white/10 rounded w-20 animate-pulse" />
      </td>
      <td className="p-3">
        <div className="h-4 bg-white/10 rounded w-20 animate-pulse" />
      </td>
    </tr>
  );
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '—';
  try {
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

export default function CAPAListView({
  capas,
  isLoading,
  error,
  onCreateClick,
  onCAPASelect,
}: CAPAListViewProps) {
  const [statusFilter, setStatusFilter] = useState<CAPAStatus | ''>('');
  const [sortBy, setSortBy] = useState<'prazo' | 'status' | 'criacao'>('criacao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort
  const filteredCapas = useMemo(() => {
    let result = [...capas];

    // Apply status filter
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortBy === 'prazo') {
        aVal = a.dataPrazo?.seconds || 0;
        bVal = b.dataPrazo?.seconds || 0;
      } else if (sortBy === 'status') {
        aVal = a.status;
        bVal = b.status;
      } else {
        aVal = a.criadoEm?.seconds || 0;
        bVal = b.criadoEm?.seconds || 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [capas, statusFilter, sortBy, sortOrder]);

  const handleSort = (column: 'prazo' | 'status' | 'criacao') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-[#141417] text-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
        <h1 className="text-2xl font-semibold text-white">Gestão de CAPA</h1>
        {onCreateClick && (
          <button
            onClick={onCreateClick}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded font-medium focus:ring-2 focus:ring-violet-400 transition-colors"
            aria-label="Criar nova CAPA"
          >
            + Criar CAPA
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-white/5 text-white border border-white/10 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="aberta">● Aberta</option>
          <option value="em-tratamento">◐ Em Tratamento</option>
          <option value="verificada">◐ Verificada</option>
          <option value="fechada">✓ Fechada</option>
          <option value="cancelada">✕ Cancelada</option>
        </select>

        {statusFilter && (
          <button
            onClick={() => setStatusFilter('')}
            className="px-3 py-2 bg-white/10 hover:bg-white/[0.15] text-white/80 text-sm rounded focus:ring-2 focus:ring-violet-500 transition-colors"
            aria-label="Limpar filtros"
          >
            Limpar filtros
          </button>
        )}

        <div className="flex-1" />

        <span className="text-sm text-white/60">
          {filteredCapas.length} de {capas.length}
        </span>
      </div>

      {/* Error State */}
      {error && (
        <div className="px-4 py-3 bg-red-900/20 border border-red-700/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && capas.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-white/60">Nenhuma CAPA encontrada</p>
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded font-medium"
              aria-label="Criar primeira CAPA"
            >
              Criar primeira CAPA
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && capas.length > 0 && (
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full border-collapse" role="table">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th scope="col" className="text-left p-3 font-semibold text-white/70 text-sm">
                  ID
                </th>
                <th scope="col" className="text-left p-3 font-semibold text-white/70 text-sm">
                  Título
                </th>
                <th
                  scope="col"
                  className="text-left p-3 font-semibold text-white/70 text-sm cursor-pointer hover:text-white"
                  onClick={() => handleSort('status')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('status')}
                  aria-sort={
                    sortBy === 'status'
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col" className="text-left p-3 font-semibold text-white/70 text-sm">
                  Prioridade
                </th>
                <th
                  scope="col"
                  className="text-left p-3 font-semibold text-white/70 text-sm cursor-pointer hover:text-white"
                  onClick={() => handleSort('prazo')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('prazo')}
                  aria-sort={
                    sortBy === 'prazo' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  Prazo {sortBy === 'prazo' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filteredCapas.length > 0 ? (
                filteredCapas.map((capa) => {
                  const statusStyle = STATUS_STYLES[capa.status];
                  return (
                    <tr
                      key={capa.id}
                      className="border-b border-white/[0.05] hover:bg-white/[0.04] cursor-pointer transition-colors"
                      onClick={() => onCAPASelect?.(capa.id)}
                      role="row"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onCAPASelect?.(capa.id)}
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCAPASelect?.(capa.id);
                          }}
                          className="text-violet-500 hover:text-violet-400 underline focus:ring-2 focus:ring-violet-500 rounded px-1"
                          aria-label={`Abrir CAPA ${capa.id.slice(-4)}`}
                        >
                          {capa.id.slice(-4).toUpperCase()}
                        </button>
                      </td>
                      <td className="p-3 text-white/90 max-w-xs truncate">{capa.titulo}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                          role="status"
                          aria-label={`Status: ${statusStyle.label}`}
                        >
                          <span>{statusStyle.icon}</span>
                          <span>{statusStyle.label}</span>
                        </span>
                      </td>
                      <td className="p-3 text-white/80 text-sm">
                        {PRIORITY_LABELS[capa.prioridade]}
                      </td>
                      <td className="p-3 text-white/80 text-sm">{formatDate(capa.dataPrazo)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-white/60">
                    Nenhuma CAPA com esses filtros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
