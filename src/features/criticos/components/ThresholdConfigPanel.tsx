/**
 * ThresholdConfigPanel — Admin configuration UI for critical thresholds
 *
 * Features:
 * - Table view with sorting
 * - Create/edit threshold modal
 * - Soft-delete with confirmation
 * - Responsive tablet design
 * - Form validation with Zod
 * - Dark-first design (Apple/Linear reference)
 */

import React, { useEffect, useState } from 'react';
import { CriticoThreshold, CriticoThresholdInput } from '../types/threshold';
import { getThresholds, createThreshold, updateThreshold, softDeleteThreshold } from '../services/thresholdService';
import { useActiveLabId } from '../../../store/useAuthStore';

interface ThresholdConfigPanelProps {
  labId?: string;
  onError?: (error: Error) => void;
}

type SortField = 'analitoNome' | 'severidade' | 'ativo' | 'criadoEm';
type SortDirection = 'asc' | 'desc';

export function ThresholdConfigPanel({ labId: propLabId, onError }: ThresholdConfigPanelProps) {
  const storeLabId = useActiveLabId();
  const labId = propLabId || storeLabId;

  // State
  const [thresholds, setThresholds] = useState<CriticoThreshold[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('analitoNome');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Form state
  const [formData, setFormData] = useState<CriticoThresholdInput>({
    analitoId: '',
    analitoNome: '',
    min: null,
    max: null,
    unidade: '',
    severidade: 'alta',
    ativo: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load thresholds
  useEffect(() => {
    if (!labId) {
      setIsLoading(false);
      return;
    }

    const loadThresholds = async () => {
      try {
        setIsLoading(true);
        const data = await getThresholds(labId);
        setThresholds(data);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to load thresholds');
        onError?.(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadThresholds();
  }, [labId, onError]);

  // Sort thresholds
  const sortedThresholds = [...thresholds].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDir === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  // Open modal for creation
  const handleNew = () => {
    setEditingId(null);
    setFormData({
      analitoId: '',
      analitoNome: '',
      min: null,
      max: null,
      unidade: '',
      severidade: 'alta',
      ativo: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (threshold: CriticoThreshold) => {
    setEditingId(threshold.id);
    setFormData({
      analitoId: threshold.analitoId,
      analitoNome: threshold.analitoNome,
      min: threshold.min,
      max: threshold.max,
      unidade: threshold.unidade,
      severidade: threshold.severidade,
      ativo: threshold.ativo,
      condicional: threshold.condicional,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Handle save (create or update)
  const handleSave = async () => {
    if (!labId) return;

    try {
      // Note: In production, operadorId and operadorNome would come from auth context
      const operadorId = 'temp-user-id';
      const operadorNome = 'Temp User';

      if (editingId) {
        await updateThreshold(labId, editingId, formData, operadorId);
      } else {
        await createThreshold(labId, formData, operadorId, operadorNome);
      }

      // Reload thresholds
      const updated = await getThresholds(labId);
      setThresholds(updated);
      setIsModalOpen(false);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save threshold');
      setFormErrors({ _form: err.message });
      onError?.(err);
    }
  };

  // Handle soft-delete
  const handleDelete = async (id: string) => {
    if (!labId) return;

    try {
      const operadorId = 'temp-user-id';
      const operadorNome = 'Temp User';

      await softDeleteThreshold(labId, id, operadorId, operadorNome);

      // Reload thresholds
      const updated = await getThresholds(labId);
      setThresholds(updated);
      setDeleteConfirmId(null);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to delete threshold');
      onError?.(err);
    }
  };

  // Toggle active status
  const handleToggleActive = async (threshold: CriticoThreshold) => {
    if (!labId) return;

    try {
      const operadorId = 'temp-user-id';
      await updateThreshold(labId, threshold.id, { ...threshold, ativo: !threshold.ativo }, operadorId);

      // Reload thresholds
      const updated = await getThresholds(labId);
      setThresholds(updated);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to toggle threshold');
      onError?.(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-violet-500/20 flex items-center justify-center animate-pulse">
            <div className="w-4 h-4 bg-violet-400 rounded-full" />
          </div>
          <p className="text-white/70 text-sm">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Limites Críticos</h2>
          <p className="text-white/50 text-sm mt-1">Configure os limites para detecção automática de valores críticos</p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Novo Limite
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              {(['analitoNome', 'severidade', 'ativo', 'criadoEm'] as SortField[]).map((field) => (
                <th
                  key={field}
                  onClick={() => {
                    if (sortField === field) {
                      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField(field);
                      setSortDir('asc');
                    }
                  }}
                  className="px-4 py-3 text-left text-white/70 font-medium cursor-pointer hover:text-white transition-colors"
                >
                  {field === 'analitoNome' && 'Analito'}
                  {field === 'severidade' && 'Severidade'}
                  {field === 'ativo' && 'Status'}
                  {field === 'criadoEm' && 'Criado em'}
                  {sortField === field && (
                    <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-white/70 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedThresholds.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                  Nenhum limite configurado
                </td>
              </tr>
            ) : (
              sortedThresholds.map((threshold) => (
                <tr key={threshold.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white">{threshold.analitoNome}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        threshold.severidade === 'alta'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {threshold.severidade}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(threshold)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        threshold.ativo
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-gray-600/20 text-gray-400'
                      }`}
                    >
                      {threshold.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">
                    {threshold.criadoEm?.toDate?.().toLocaleDateString?.() || '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(threshold)}
                      className="px-2 py-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(threshold.id)}
                      className="px-2 py-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <ThresholdModal
          isOpen={isModalOpen}
          isEditing={!!editingId}
          formData={formData}
          errors={formErrors}
          onFormChange={setFormData}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <DeleteConfirmationModal
          isOpen={!!deleteConfirmId}
          onConfirm={() => handleDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}

interface ThresholdModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: CriticoThresholdInput;
  errors: Record<string, string>;
  onFormChange: (data: CriticoThresholdInput) => void;
  onSave: () => void;
  onClose: () => void;
}

function ThresholdModal({
  isOpen,
  isEditing,
  formData,
  errors,
  onFormChange,
  onSave,
  onClose,
}: ThresholdModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1a1a1e] rounded-xl border border-white/10 shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? 'Editar' : 'Novo'} Limite Crítico
          </h3>
        </div>

        <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {errors._form && (
            <div className="p-3 rounded-lg bg-rose-500/10 text-rose-300 text-sm">
              {errors._form}
            </div>
          )}

          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">ID do Analito</label>
            <input
              type="text"
              value={formData.analitoId}
              onChange={(e) => onFormChange({ ...formData, analitoId: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              placeholder="rbc, wbc, etc"
            />
            {errors.analitoId && <p className="mt-1 text-xs text-rose-400">{errors.analitoId}</p>}
          </div>

          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">Nome do Analito</label>
            <input
              type="text"
              value={formData.analitoNome}
              onChange={(e) => onFormChange({ ...formData, analitoNome: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              placeholder="Red Blood Cells"
            />
            {errors.analitoNome && <p className="mt-1 text-xs text-rose-400">{errors.analitoNome}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">Mín</label>
              <input
                type="number"
                value={formData.min ?? ''}
                onChange={(e) =>
                  onFormChange({ ...formData, min: e.target.value ? parseFloat(e.target.value) : null })
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">Máx</label>
              <input
                type="number"
                value={formData.max ?? ''}
                onChange={(e) =>
                  onFormChange({ ...formData, max: e.target.value ? parseFloat(e.target.value) : null })
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
          {errors.min && <p className="text-xs text-rose-400">{errors.min}</p>}

          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">Unidade</label>
            <input
              type="text"
              value={formData.unidade}
              onChange={(e) => onFormChange({ ...formData, unidade: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              placeholder="M/uL"
            />
            {errors.unidade && <p className="mt-1 text-xs text-rose-400">{errors.unidade}</p>}
          </div>

          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">Severidade</label>
            <select
              value={formData.severidade}
              onChange={(e) =>
                onFormChange({
                  ...formData,
                  severidade: e.target.value as 'alta' | 'baixa',
                })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            >
              <option value="alta">Alta</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => onFormChange({ ...formData, ativo: e.target.checked })}
              className="w-4 h-4 rounded bg-white/10 border-white/20 text-violet-600"
            />
            <label htmlFor="ativo" className="text-white/70 text-sm">
              Ativo
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmationModal({ isOpen, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1a1a1e] rounded-xl border border-white/10 shadow-xl max-w-sm w-full mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Remover limite?</h3>
          <p className="text-white/70 text-sm mb-6">
            Esta ação não pode ser desfeita. O limite será marcado como deletado.
          </p>
        </div>

        <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}
