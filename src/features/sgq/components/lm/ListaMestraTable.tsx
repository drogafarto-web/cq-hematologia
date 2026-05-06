/**
 * ListaMestraTable.tsx
 *
 * Paginated table: código, tipo, título, status, versão, setores LD, última atualização, ações.
 * Lazy loading with Suspense. 50 docs per page.
 */

import { useMemo, useState } from 'react';
import { TipoDocumentoBadge } from './TipoDocumentoBadge';
import { StatusVigenciaBadge, type StatusVigencia } from './StatusVigenciaBadge';
import type { FilterState } from './ListaMestraFilters';

/**
 * Simple relative time formatter (replacement for date-fns)
 */
function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'agora mesmo';
  if (diffMinutes < 60) return `${diffMinutes}m atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 30) return `${diffDays}d atrás`;
  return date.toLocaleDateString('pt-BR');
}

interface DocumentoLM {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  status: StatusVigencia;
  versao: number;
  setoresLD: string[];
  ultimaAtualizacao: Date;
  criadoEm: Date;
}

interface ListaMestraTableProps {
  documentos: DocumentoLM[];
  loading?: boolean;
  filters?: FilterState;
  onDocumentClick?: (id: string) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

const ITEMS_PER_PAGE = 50;

export function ListaMestraTable({
  documentos,
  loading = false,
  filters = {},
  onDocumentClick,
  currentPage = 1,
  onPageChange,
}: ListaMestraTableProps) {
  const filtered = useMemo(() => {
    let result = [...documentos];

    if (filters.tipo) result = result.filter(d => d.tipo === filters.tipo);
    if (filters.status) result = result.filter(d => d.status === filters.status);
    if (filters.setor) result = result.filter(d => d.setoresLD.includes(filters.setor || ''));
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase();
      result = result.filter(d =>
        d.codigo.toLowerCase().includes(q) ||
        d.titulo.toLowerCase().includes(q)
      );
    }

    if (filters.period && filters.period !== 'all') {
      const now = new Date();
      const daysAgo = filters.period === '7d' ? 7 : filters.period === '30d' ? 30 : 90;
      const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      result = result.filter(d => d.ultimaAtualizacao >= cutoff);
    }

    return result.sort((a, b) => b.ultimaAtualizacao.getTime() - a.ultimaAtualizacao.getTime());
  }, [documentos, filters]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedDocs = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60 text-sm">Nenhum documento encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-xs text-white/60">
        Mostrando <span className="font-semibold text-white">{paginatedDocs.length}</span> de{' '}
        <span className="font-semibold text-white">{filtered.length}</span> documentos
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wide">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wide">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wide">Título</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wide">Vers.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wide">Distribuído</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wide">Última Atualização</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wide">Ação</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDocs.map((doc, idx) => (
              <tr
                key={doc.id}
                className="border-b border-white/5 hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
                onClick={() => onDocumentClick?.(doc.id)}
              >
                <td className="px-4 py-3 text-white font-mono text-xs tabular-nums">{doc.codigo ?? ''}</td>
                <td className="px-4 py-3">
                  <TipoDocumentoBadge tipo={doc.tipo as any} showLabel tooltip />
                </td>
                <td className="px-4 py-3 text-white text-sm max-w-xs truncate">{doc.titulo}</td>
                <td className="px-4 py-3">
                  <StatusVigenciaBadge status={doc.status} showLabel tooltip={false} />
                </td>
                <td className="px-4 py-3 text-white text-center font-mono tabular-nums">v{doc.versao}</td>
                <td className="px-4 py-3 text-white text-xs">
                  {doc.setoresLD.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {doc.setoresLD.slice(0, 2).map(s => (
                        <span key={s} className="inline-block bg-white/10 px-2 py-1 rounded text-xs">
                          {s.split(' ')[0]}
                        </span>
                      ))}
                      {doc.setoresLD.length > 2 && (
                        <span className="inline-block bg-white/10 px-2 py-1 rounded text-xs">
                          +{doc.setoresLD.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-white/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/60 text-xs">
                  {formatDistanceToNow(doc.ultimaAtualizacao)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDocumentClick?.(doc.id);
                    }}
                    className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:text-white/40 disabled:hover:bg-transparent rounded-lg transition-colors"
          >
            ← Anterior
          </button>

          <div className="text-xs text-white/60">
            Página <span className="font-semibold text-white">{currentPage}</span> de{' '}
            <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <button
            onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:text-white/40 disabled:hover:bg-transparent rounded-lg transition-colors"
          >
            Próximo →
          </button>
        </div>
      )}
    </div>
  );
}
