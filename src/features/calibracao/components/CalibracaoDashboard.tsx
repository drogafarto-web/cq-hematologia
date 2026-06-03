/**
 * CalibracaoDashboard.tsx
 *
 * Main equipment calibration dashboard.
 * Displays equipment list with next-due date, status indicators, and action buttons.
 *
 * Dark-first design with color-coded status:
 * - emerald (>30d, no-prazo)
 * - amber (7-30d, em-risco)
 * - red (<7d, vencido)
 */

import React, { useMemo, useState } from 'react';
import { useCalibracoes } from '../hooks/useCalibracoes';
import { useDueDateMonitor } from '../hooks/useDueDateMonitor';
import type { CalibracaoRecord, CalibracaoStatusLegacy } from '../types/index';
import CertificateUploadModal from './CertificateUploadModal';
import CalibracaoDetail from './CalibracaoDetail';

type SortKey = 'due-date' | 'priority' | 'equipment-name';

interface SortOption {
  key: SortKey;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'due-date', label: 'Por data de vencimento' },
  { key: 'priority', label: 'Por criticidade' },
  { key: 'equipment-name', label: 'Por nome do equipamento' },
];

const statusColors: Record<CalibracaoStatusLegacy, { bg: string; dot: string; text: string }> = {
  'no-prazo': {
    bg: 'bg-emerald-900/20',
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  'em-risco': {
    bg: 'bg-amber-900/20',
    dot: 'bg-amber-500',
    text: 'text-amber-400',
  },
  vencido: {
    bg: 'bg-red-900/20',
    dot: 'bg-red-500',
    text: 'text-red-400',
  },
};

const statusLabels: Record<CalibracaoStatusLegacy, string> = {
  'no-prazo': 'No prazo',
  'em-risco': 'Em risco',
  vencido: 'Vencido',
};

interface EquipmentCardProps {
  record: CalibracaoRecord;
  onViewDetail: (record: CalibracaoRecord) => void;
  onUploadCertificate: (record: CalibracaoRecord) => void;
}

/**
 * Individual equipment card with status, deadline, and actions.
 */
function EquipmentCard({ record, onViewDetail, onUploadCertificate }: EquipmentCardProps) {
  const colors = statusColors[record.dueDateInfo.status];
  const nextDueDate = record.dueDateInfo.nextDueDate.toDate();
  const formattedDue = nextDueDate.toLocaleDateString('pt-BR');

  return (
    <div
      className={`rounded-lg border border-white/10 p-4 transition-colors duration-150 ${colors.bg} hover:border-white/20 hover:bg-white/5`}
    >
      {/* Header: Equipment name + serial */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">{record.equipName}</h3>
          {record.equipSerial && <p className="text-xs text-gray-400">SN: {record.equipSerial}</p>}
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${colors.bg}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
          <span className={colors.text}>{statusLabels[record.dueDateInfo.status]}</span>
        </div>
      </div>

      {/* Deadline info */}
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-tabular-nums font-semibold text-white">
          {record.dueDateInfo.daysUntilDue}
        </span>
        <span className="text-xs text-gray-400">dias até vencimento</span>
      </div>

      <div className="mb-4 text-xs text-gray-400">
        Vencimento: <span className="font-tabular-nums">{formattedDue}</span>
      </div>

      {/* Vendor info */}
      {record.vendor && (
        <div className="mb-3 text-xs text-gray-400">
          Fornecedor: <span className="text-gray-300">{record.vendor}</span>
        </div>
      )}

      {/* Certificate count */}
      <div className="mb-4 border-t border-white/10 pt-3">
        <p className="text-xs text-gray-400">
          {record.certificates?.length || 0} certificado(s) registrado(s)
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onViewDetail(record)}
          className="flex-1 rounded bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
          aria-label={`Ver detalhes de ${record.equipName}`}
        >
          Ver detalhes
        </button>
        <button
          onClick={() => onUploadCertificate(record)}
          className="flex-1 rounded bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors duration-150 hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
          aria-label={`Upload de certificado para ${record.equipName}`}
        >
          Upload
        </button>
      </div>
    </div>
  );
}

/**
 * Summary cards showing status counts.
 */
function StatusSummary({ calibracoes }: { calibracoes: CalibracaoRecord[] }) {
  const counts = useMemo(() => {
    return {
      total: calibracoes.length,
      noPrazo: calibracoes.filter((c) => c.dueDateInfo.status === 'no-prazo').length,
      emRisco: calibracoes.filter((c) => c.dueDateInfo.status === 'em-risco').length,
      vencido: calibracoes.filter((c) => c.dueDateInfo.status === 'vencido').length,
    };
  }, [calibracoes]);

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-gray-400">Total de equipamentos</p>
        <p className="text-2xl font-semibold text-white">{counts.total}</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-emerald-900/20 p-4">
        <p className="text-xs text-emerald-400">No prazo</p>
        <p className="text-2xl font-semibold text-emerald-400">{counts.noPrazo}</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-amber-900/20 p-4">
        <p className="text-xs text-amber-400">Em risco (7-30 dias)</p>
        <p className="text-2xl font-semibold text-amber-400">{counts.emRisco}</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-red-900/20 p-4">
        <p className="text-xs text-red-400">Vencidos</p>
        <p className="text-2xl font-semibold text-red-400">{counts.vencido}</p>
      </div>
    </div>
  );
}

/**
 * Loading skeleton while fetching data.
 */
function SkeletonLoader() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="mb-3 h-4 w-3/4 rounded bg-white/10" />
          <div className="mb-3 h-8 w-1/2 rounded bg-white/10" />
          <div className="h-20 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state when no equipment found.
 */
function EmptyState() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 py-12 text-center">
      <svg
        className="mx-auto mb-4 h-12 w-12 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="mb-2 text-sm font-semibold text-white">Nenhum equipamento cadastrado</h3>
      <p className="text-xs text-gray-400">
        Adicione equipamentos na seção de "Equipamentos" para começar o controle de calibração.
      </p>
    </div>
  );
}

/**
 * CalibracaoDashboard — main component.
 */
export default function CalibracaoDashboard() {
  const { calibracoes, loading, error } = useCalibracoes();
  const { changes, lastCheck } = useDueDateMonitor(calibracoes);
  const [sortBy, setSortBy] = useState<SortKey>('due-date');
  const [selectedDetail, setSelectedDetail] = useState<CalibracaoRecord | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<CalibracaoRecord | null>(null);

  // Sort calibracoes based on selected key
  const sortedCalibracoes = useMemo(() => {
    const sorted = [...calibracoes];

    switch (sortBy) {
      case 'due-date':
        sorted.sort(
          (a, b) => a.dueDateInfo.nextDueDate.toMillis() - b.dueDateInfo.nextDueDate.toMillis(),
        );
        break;
      case 'priority':
        // Sort by status: vencido → em-risco → no-prazo, then by days
        const statusPriority = { vencido: 0, 'em-risco': 1, 'no-prazo': 2 };
        sorted.sort((a, b) => {
          const statusDiff =
            statusPriority[a.dueDateInfo.status] - statusPriority[b.dueDateInfo.status];
          if (statusDiff !== 0) return statusDiff;
          return a.dueDateInfo.daysUntilDue - b.dueDateInfo.daysUntilDue;
        });
        break;
      case 'equipment-name':
        sorted.sort((a, b) => a.equipName.localeCompare(b.equipName, 'pt-BR'));
        break;
    }

    return sorted;
  }, [calibracoes, sortBy]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-4 text-red-400">
        <p className="text-sm font-medium">Erro ao carregar calibrações</p>
        <p className="text-xs text-red-300">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Calibração de Equipamentos</h1>
        <p className="mt-2 text-sm text-gray-400">
          Rastreamento de certificados de calibração (DICQ 5.3.1.4)
        </p>
      </div>

      {/* Status summary */}
      {!loading && calibracoes.length > 0 && <StatusSummary calibracoes={sortedCalibracoes} />}

      {/* Sort controls */}
      {!loading && calibracoes.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-xs font-medium text-gray-400">
            Ordenar por:
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded border border-white/10 bg-white/10 px-3 py-1 text-xs text-white placeholder-gray-500 transition-colors duration-150 hover:border-white/20 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
            aria-label="Ordenar equipamentos"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-slate-900 text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonLoader />
      ) : calibracoes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedCalibracoes.map((record) => (
            <EquipmentCard
              key={record.id}
              record={record}
              onViewDetail={setSelectedDetail}
              onUploadCertificate={setSelectedUpload}
            />
          ))}
        </div>
      )}

      {/* Last monitor check info (optional, for debugging) */}
      {lastCheck && changes.length > 0 && (
        <div className="text-xs text-gray-500">
          Última verificação de limites: {lastCheck.toLocaleTimeString('pt-BR')} ({changes.length}{' '}
          mudança(s))
        </div>
      )}

      {/* Detail Modal */}
      {selectedDetail && (
        <CalibracaoDetail record={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}

      {/* Upload Modal */}
      {selectedUpload && (
        <CertificateUploadModal
          record={selectedUpload}
          onClose={() => setSelectedUpload(null)}
          onSuccess={() => {
            setSelectedUpload(null);
            // Toast notification could be added here
          }}
        />
      )}
    </div>
  );
}
