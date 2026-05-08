/**
 * RiskRegister.tsx
 *
 * Risk registry — tabular view of all risks for a lab
 * CRUD operations: Create, Read, Update, Soft-Delete
 * Filters: status, nivel, NPR range, search
 */

import React, { useState, useMemo, memo } from 'react';
import type { Risk, RiskInput } from '../types/Risk';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  callCreateRisk,
  callUpdateRisk,
  callSoftDeleteRisk,
  subscribeRisks
} from '../services/risksService';
import { ConfirmModal } from '../../../shared/components/ConfirmModal';
import { CreateRiskModal } from './CreateRiskModal';

const NIVEL_CONFIG: Record<string, { dot: string; cls: string }> = {
  baixo: {
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]',
  },
  medio: {
    dot: 'bg-amber-500',
    cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  },
  alto: {
    dot: 'bg-orange-500',
    cls: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20',
  },
  critico: {
    dot: 'bg-red-500',
    cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  },
};

const STATUS_CONFIG: Record<string, { dot: string; cls: string }> = {
  aberto: {
    dot: 'bg-red-500',
    cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  },
  mitigando: {
    dot: 'bg-amber-500',
    cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  },
  monitorado: {
    dot: 'bg-blue-500',
    cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  },
  fechado: {
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.08] line-through',
  },
};

interface RiskRegisterProps {
  risks: Risk[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const RiskRow = memo(({ risk, onEdit, onDelete }: {
  risk: Risk;
  onEdit: (risk: Risk) => void;
  onDelete: (risk: Risk) => void;
}) => (
  <tr className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150">
    <td className="px-4 py-3 text-xs font-mono text-white/70">{risk.codigo}</td>
    <td className="px-4 py-3 text-sm text-white/80 truncate max-w-xs">{risk.descricao}</td>
    <td className="px-4 py-3 text-xs text-white/60">{risk.processo}</td>
    <td className="px-4 py-3 text-center tabular-nums text-sm font-semibold text-white/80">{risk.probabilidade}</td>
    <td className="px-4 py-3 text-center tabular-nums text-sm font-semibold text-white/80">{risk.severidade}</td>
    <td className="px-4 py-3 text-center tabular-nums text-sm font-semibold text-white/80">{risk.deteccao}</td>
    <td className="px-4 py-3 text-center tabular-nums text-lg font-bold text-white">{risk.npr}</td>
    <td className="px-4 py-3">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${NIVEL_CONFIG[risk.nivel]?.cls || ''}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${NIVEL_CONFIG[risk.nivel]?.dot || ''}`} />
        {risk.nivel}
      </span>
    </td>
    <td className="px-4 py-3">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[risk.status]?.cls || ''}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_CONFIG[risk.status]?.dot || ''}`} />
        {risk.status}
      </span>
    </td>
    <td className="px-4 py-3 text-right space-x-2">
      <button
        onClick={() => onEdit(risk)}
        className="text-xs px-2 py-1 rounded text-violet-300 hover:bg-violet-500/10 transition-colors"
      >
        Editar
      </button>
      <button
        onClick={() => onDelete(risk)}
        className="text-xs px-2 py-1 rounded text-red-300 hover:bg-red-500/10 transition-colors"
      >
        Excluir
      </button>
    </td>
  </tr>
));

RiskRow.displayName = 'RiskRow';

export const RiskRegister: React.FC<RiskRegisterProps> = ({
  risks,
  isLoading,
  error,
  onRefresh,
}) => {
  const labId = useActiveLabId();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Risk | null>(null);
  const [filters, setFilters] = useState({ statusFilter: '', searchText: '' });

  const filteredRisks = useMemo(() => {
    return risks.filter(r => {
      if (filters.statusFilter && r.status !== filters.statusFilter) return false;
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        if (!r.codigo.toLowerCase().includes(search) && !r.descricao.toLowerCase().includes(search)) {
          return false;
        }
      }
      return !r.deletadoEm; // Hide soft-deleted
    });
  }, [risks, filters]);

  if (!labId) {
    return <div className="text-white/50 text-sm p-4">Lab not selected</div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-white/[0.05] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-sm p-4">Erro: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4">
        <input
          type="text"
          placeholder="Pesquisar por código ou descrição..."
          value={filters.searchText}
          onChange={(e) => setFilters(f => ({ ...f, searchText: e.target.value }))}
          className="flex-1 px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-violet-500/60"
        />
        <select
          value={filters.statusFilter}
          onChange={(e) => setFilters(f => ({ ...f, statusFilter: e.target.value }))}
          className="px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-violet-500/60"
        >
          <option value="">Todos os status</option>
          <option value="aberto">Aberto</option>
          <option value="mitigando">Mitigando</option>
          <option value="monitorado">Monitorado</option>
          <option value="fechado">Fechado</option>
        </select>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-sm font-medium transition-colors"
        >
          + Novo Risco
        </button>
      </div>

      {/* Table */}
      {filteredRisks.length === 0 ? (
        <div className="py-12 text-center text-sm text-white/30 rounded-xl border border-dashed border-white/[0.08] mx-4">
          Nenhum risco cadastrado
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.01] mx-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Processo</th>
                <th className="px-4 py-3 font-medium text-center">P</th>
                <th className="px-4 py-3 font-medium text-center">S</th>
                <th className="px-4 py-3 font-medium text-center">D</th>
                <th className="px-4 py-3 font-medium text-center">NPR</th>
                <th className="px-4 py-3 font-medium">Nível</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRisks.map(risk => (
                <RiskRow
                  key={risk.id}
                  risk={risk}
                  onEdit={setEditingRisk}
                  onDelete={setDeleteConfirm}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          title="Excluir Risco"
          message={`Tem certeza que deseja excluir o risco "${deleteConfirm.codigo}"? Esta ação é irreversível.`}
          confirmLabel="Excluir"
          variant="danger"
          onConfirm={async () => {
            try {
              await callSoftDeleteRisk(labId, {
                riskId: deleteConfirm.id,
                motivo: 'Deletado pelo usuário',
              });
              setDeleteConfirm(null);
              onRefresh?.();
            } catch (err) {
              console.error('Delete failed:', err);
            }
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Create risk modal */}
      {showCreateModal && (
        <CreateRiskModal
          labId={labId}
          onSuccess={onRefresh}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};
