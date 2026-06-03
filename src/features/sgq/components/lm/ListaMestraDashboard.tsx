/**
 * ListaMestraDashboard.tsx
 *
 * Main dashboard: KPI cards + filters + table.
 * Real-time data via Firestore listener.
 */

import { useMemo, useState } from 'react';
import { ListaMestraFilters, type FilterState } from './ListaMestraFilters';
import { ListaMestraTable } from './ListaMestraTable';
import type { StatusVigencia } from './StatusVigenciaBadge';
import type { TipoDocumento } from './TipoDocumentoBadge';

/**
 * Mock data type — replace with real Firestore data via hook
 */
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

interface ListaMestraDashboardProps {
  labId: string;
  documentos?: DocumentoLM[];
  loading?: boolean;
  onDocumentSelect?: (id: string) => void;
}

const KPI_CARD_CLASS = 'flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg min-w-max';

export function ListaMestraDashboard({
  labId,
  documentos = [],
  loading = false,
  onDocumentSelect,
}: ListaMestraDashboardProps) {
  const [filters, setFilters] = useState<FilterState>({});
  const [currentPage, setCurrentPage] = useState(1);

  // KPI calculations
  const kpis = useMemo(() => {
    const filtered = documentos.filter((d) => {
      if (filters.tipo) return d.tipo === filters.tipo;
      if (filters.status) return d.status === filters.status;
      if (filters.setor) return d.setoresLD.includes(filters.setor);
      return true;
    });

    return {
      total: documentos.length,
      vigentes: documentos.filter((d) => d.status === 'vigente').length,
      emRevisao: documentos.filter((d) => d.status === 'em-revisao').length,
      rascunhos: documentos.filter((d) => d.status === 'draft').length,
      obsoletos: documentos.filter((d) => d.status === 'obsoleto').length,
      filtrados: filtered.length,
    };
  }, [documentos, filters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Lista Mestra</h2>
        <p className="text-white/60 text-sm mt-1">
          Catálogo centralizado de documentos da qualidade
        </p>
      </div>

      {/* KPI Cards */}
      <div className="flex flex-wrap gap-2">
        <div className={KPI_CARD_CLASS}>
          <div className="text-xs text-white/60 uppercase font-semibold tracking-wide">Total</div>
          <div className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">
            {kpis.total}
          </div>
        </div>
        <div className={KPI_CARD_CLASS}>
          <div className="text-xs text-white/60 uppercase font-semibold tracking-wide">
            Vigentes
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono tabular-nums">
            {kpis.vigentes}
          </div>
        </div>
        <div className={KPI_CARD_CLASS}>
          <div className="text-xs text-white/60 uppercase font-semibold tracking-wide">
            Em Revisão
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono tabular-nums">
            {kpis.emRevisao}
          </div>
        </div>
        <div className={KPI_CARD_CLASS}>
          <div className="text-xs text-white/60 uppercase font-semibold tracking-wide">
            Rascunhos
          </div>
          <div className="text-2xl font-bold text-slate-400 mt-1 font-mono tabular-nums">
            {kpis.rascunhos}
          </div>
        </div>
        <div className={KPI_CARD_CLASS}>
          <div className="text-xs text-white/60 uppercase font-semibold tracking-wide">
            Obsoletos
          </div>
          <div className="text-2xl font-bold text-red-400 mt-1 font-mono tabular-nums">
            {kpis.obsoletos}
          </div>
        </div>
      </div>

      {/* Layout: Filters + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Filters */}
        <div className="lg:col-span-1">
          <ListaMestraFilters onFiltersChange={setFilters} />
        </div>

        {/* Main: Table */}
        <div className="lg:col-span-3">
          <ListaMestraTable
            documentos={documentos}
            loading={loading}
            filters={filters}
            onDocumentClick={onDocumentSelect}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
}
