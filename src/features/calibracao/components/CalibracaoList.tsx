/**
 * CalibracaoList.tsx — SA-32
 *
 * Equipment calibration table with status badges.
 * Responsive design with upload certificate modal.
 */

import { useState, useMemo } from 'react';
import { useCalibracoes } from '../hooks/useCalibracoes';

type CalibrationStatus = 'in-date' | 'warning-30d' | 'warning-7d' | 'overdue' | 'out-of-service';

function getStatusColor(status: CalibrationStatus): {
  badge: string;
  dot: string;
  label: string;
} {
  switch (status) {
    case 'in-date':
      return {
        badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: 'Em dia',
      };
    case 'warning-30d':
      return {
        badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        dot: 'bg-amber-400',
        label: 'Aviso (30 dias)',
      };
    case 'warning-7d':
      return {
        badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
        dot: 'bg-orange-400',
        label: 'Aviso (7 dias)',
      };
    case 'overdue':
      return {
        badge: 'bg-red-500/20 text-red-300 border border-red-500/30',
        dot: 'bg-red-400',
        label: 'Vencido',
      };
    case 'out-of-service':
      return {
        badge: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
        dot: 'bg-slate-400',
        label: 'Fora de operação',
      };
  }
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-BR');
}

function Skeleton() {
  return (
    <tr className="border-t border-white/5 hover:bg-white/2 transition-colors">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-5 bg-slate-700/40 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

function UploadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

export function CalibracaoList() {
  const { calibracoes, loading, error } = useCalibracoes();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...calibracoes].sort((a, b) => {
      const aNext =
        typeof a.nextDueDate === 'number'
          ? a.nextDueDate
          : ((a.nextDueDate as any)?.toMillis?.() ?? Infinity);
      const bNext =
        typeof b.nextDueDate === 'number'
          ? b.nextDueDate
          : ((b.nextDueDate as any)?.toMillis?.() ?? Infinity);
      return aNext - bNext;
    });
  }, [calibracoes]);

  const overdueCount = sorted.filter((c) => {
    const nextDue =
      typeof c.nextDueDate === 'number'
        ? c.nextDueDate
        : ((c.nextDueDate as any)?.toMillis?.() ?? 0);
    return nextDue < Date.now();
  }).length;

  const warningCount = sorted.filter((c) => {
    const nextDue =
      typeof c.nextDueDate === 'number'
        ? c.nextDueDate
        : ((c.nextDueDate as any)?.toMillis?.() ?? 0);
    const daysUntil = (nextDue - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil < 30;
  }).length;

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
        <p className="text-sm font-medium">Erro ao carregar calibrações</p>
        <p className="text-xs text-red-400 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status Summary */}
      <div className="flex gap-4">
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs font-medium text-red-300">
              {overdueCount} vencido{overdueCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs font-medium text-amber-300">
              {warningCount} aviso{warningCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Equipamento
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Última calibração
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Próxima vencimento
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Status
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Ação
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                  Nenhum equipamento cadastrado
                </td>
              </tr>
            ) : (
              sorted.map((cal) => {
                const statusColor = getStatusColor(cal.status as CalibrationStatus);
                return (
                  <tr
                    key={cal.id}
                    className="border-t border-white/5 hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-200">
                      <p className="font-medium">{cal.equipName}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">ID: {cal.equipamentoId}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {formatDate(
                        typeof cal.lastCalibrationDate === 'number'
                          ? cal.lastCalibrationDate
                          : (cal.lastCalibrationDate as any)?.toMillis?.(),
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                      {formatDate(
                        typeof cal.nextDueDate === 'number'
                          ? cal.nextDueDate
                          : (cal.nextDueDate as any)?.toMillis?.(),
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusColor.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                        {statusColor.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedId(cal.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
                        aria-label={`Upload certificado para ${cal.equipName}`}
                      >
                        <UploadIcon />
                        Upload
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && sorted.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-white/2 rounded-lg border border-white/5 text-xs text-slate-400">
          <span>
            Total: <span className="font-semibold text-slate-200">{sorted.length}</span>
          </span>
          <span className="text-white/20">·</span>
          <span>
            Em dia:{' '}
            <span className="font-semibold text-emerald-400">
              {sorted.filter((c) => c.status === 'in-date').length}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
