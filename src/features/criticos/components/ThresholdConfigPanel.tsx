/**
 * ThresholdConfigPanel — Admin configuration UI for critical thresholds
 *
 * Features:
 * - Table view with sorting and search
 * - Create/edit threshold modal with form validation
 * - Soft-delete with confirmation
 * - Conditional age/sex rules
 * - Responsive dark-first design (Apple/Linear reference)
 * - Full accessibility (WCAG AA): ARIA labels, keyboard nav, focus visible
 * - RDC 978 Art. 128 compliant audit trail
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  CriticosThreshold,
  CriticosThresholdInput,
  CriticosThresholdInputSchema,
} from '../types/threshold';
import {
  getThresholds,
  createThreshold,
  updateThreshold,
  softDeleteThreshold,
} from '../services/thresholdService';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { ZodError } from 'zod';

interface ThresholdConfigPanelProps {
  labId?: string;
  onError?: (error: Error) => void;
}

type SortField = 'analitoNome' | 'severidade' | 'ativo' | 'criadoEm';
type SortDirection = 'asc' | 'desc';

export function ThresholdConfigPanel({ labId: propLabId, onError }: ThresholdConfigPanelProps) {
  const storeLabId = useActiveLabId();
  const labId = propLabId || storeLabId;
  const user = useUser();

  // State
  const [thresholds, setThresholds] = useState<CriticosThreshold[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('analitoNome');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'alta' | 'baixa'>('all');
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CriticosThresholdInput>({
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
        const err =
          error instanceof Error ? error : new Error('Falha ao carregar limites críticos');
        onError?.(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadThresholds();
  }, [labId, onError]);

  // Filter and sort thresholds
  const filteredThresholds = useMemo(() => {
    let result = thresholds;

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.analitoNome.toLowerCase().includes(q) || t.analitoId.toLowerCase().includes(q),
      );
    }

    // Apply severity filter
    if (severityFilter !== 'all') {
      result = result.filter((t) => t.severidade === severityFilter);
    }

    // Apply sort
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const cmp = aValue.localeCompare(bValue, 'pt-BR');
        return sortDir === 'asc' ? cmp : -cmp;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return result;
  }, [thresholds, searchQuery, severityFilter, sortField, sortDir]);

  // Validate form
  const validateForm = useCallback(() => {
    try {
      CriticosThresholdInputSchema.parse(formData);
      return {};
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((e) => {
          const path = e.path.join('.');
          errors[path] = e.message;
        });
        return errors;
      }
      return { _form: 'Erro ao validar formulário' };
    }
  }, [formData]);

  // Open modal for creation
  const handleNew = useCallback(() => {
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
  }, []);

  // Open modal for editing
  const handleEdit = useCallback((threshold: CriticosThreshold) => {
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
      alwaysCritico: threshold.alwaysCritico,
      neverCritico: threshold.neverCritico,
    });
    setFormErrors({});
    setIsModalOpen(true);
  }, []);

  // Handle save (create or update)
  const handleSave = useCallback(async () => {
    if (!labId || !user) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateThreshold(labId, editingId, formData, user.uid);
      } else {
        await createThreshold(labId, formData, user.uid, user.email || 'unknown');
      }

      // Reload thresholds
      const updated = await getThresholds(labId);
      setThresholds(updated);
      setIsModalOpen(false);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Falha ao salvar limite crítico');
      setFormErrors({ _form: err.message });
      onError?.(err);
    } finally {
      setIsSaving(false);
    }
  }, [labId, user, validateForm, editingId, formData, onError]);

  // Handle soft-delete
  const handleDelete = useCallback(
    async (id: string) => {
      if (!labId || !user) return;

      setIsSaving(true);
      try {
        await softDeleteThreshold(labId, id, user.uid, user.email || 'unknown');

        // Reload thresholds
        const updated = await getThresholds(labId);
        setThresholds(updated);
        setDeleteConfirmId(null);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Falha ao deletar limite crítico');
        onError?.(err);
      } finally {
        setIsSaving(false);
      }
    },
    [labId, user, onError],
  );

  // Toggle active status
  const handleToggleActive = useCallback(
    async (threshold: CriticosThreshold) => {
      if (!labId || !user) return;

      setIsSaving(true);
      try {
        await updateThreshold(
          labId,
          threshold.id,
          { ...threshold, ativo: !threshold.ativo },
          user.uid,
        );

        // Reload thresholds
        const updated = await getThresholds(labId);
        setThresholds(updated);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Falha ao atualizar status');
        onError?.(err);
      } finally {
        setIsSaving(false);
      }
    },
    [labId, user, onError],
  );

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Limites Críticos</h2>
          <p className="text-white/50 text-sm mt-1">
            Configure os limites para detecção automática de valores críticos (RDC 978 Art. 128)
          </p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141417]"
          aria-label="Adicionar novo limite crítico"
        >
          + Novo Limite
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="search-thresholds"
            className="block text-xs font-medium text-white/70 mb-2"
          >
            Buscar por nome ou ID do analito
          </label>
          <input
            id="search-thresholds"
            type="text"
            placeholder="Ex: Potássio, K"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
            aria-describedby="search-hint"
          />
          <p id="search-hint" className="text-xs text-white/40 mt-1">
            Filtra por nome ou ID do analito
          </p>
        </div>
        <div>
          <label htmlFor="severity-filter" className="block text-xs font-medium text-white/70 mb-2">
            Severidade
          </label>
          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
          >
            <option value="all">Todos</option>
            <option value="alta">Alta</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <table className="w-full text-sm" role="grid" aria-label="Limites críticos">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              {(['analitoNome', 'severidade', 'ativo', 'criadoEm'] as SortField[]).map((field) => (
                <th
                  key={field}
                  scope="col"
                  onClick={() => {
                    if (sortField === field) {
                      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField(field);
                      setSortDir('asc');
                    }
                  }}
                  className="px-4 py-3 text-left text-white/70 font-medium cursor-pointer hover:text-white hover:bg-white/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/70"
                  tabIndex={0}
                  role="button"
                  aria-sort={
                    sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  {field === 'analitoNome' && 'Analito'}
                  {field === 'severidade' && 'Severidade'}
                  {field === 'ativo' && 'Status'}
                  {field === 'criadoEm' && 'Criado em'}
                  {sortField === field && (
                    <span className="ml-2" aria-hidden="true">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right text-white/70 font-medium sr-only">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredThresholds.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                  {searchQuery || severityFilter !== 'all'
                    ? 'Nenhum limite encontrado com os critérios de busca'
                    : 'Nenhum limite configurado. Clique em "Novo Limite" para começar.'}
                </td>
              </tr>
            ) : (
              filteredThresholds.map((threshold) => (
                <tr
                  key={threshold.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors focus-within:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 text-white">
                    <div className="font-medium">{threshold.analitoNome}</div>
                    <div className="text-xs text-white/40 font-mono">{threshold.analitoId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium inline-block ${
                        threshold.severidade === 'alta'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                      role="status"
                    >
                      {threshold.severidade === 'alta' ? '🔴 Alta' : '🟡 Baixa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(threshold)}
                      disabled={isSaving}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 ${
                        threshold.ativo
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      aria-label={`${threshold.ativo ? 'Desativar' : 'Ativar'} limite ${threshold.analitoNome}`}
                    >
                      {threshold.ativo ? '✓ Ativo' : '○ Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">
                    {threshold.criadoEm instanceof Object && 'toDate' in threshold.criadoEm
                      ? (threshold.criadoEm as any).toDate?.().toLocaleDateString?.('pt-BR')
                      : new Date(threshold.criadoEm as string).toLocaleDateString?.('pt-BR') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(threshold)}
                      disabled={isSaving}
                      className="px-3 py-1 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Editar limite ${threshold.analitoNome}`}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(threshold.id)}
                      disabled={isSaving}
                      className="px-3 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Remover limite ${threshold.analitoNome}`}
                    >
                      🗑️ Remover
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
          isSaving={isSaving}
          onFormChange={setFormData}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <DeleteConfirmationModal
          isOpen={!!deleteConfirmId}
          isSaving={isSaving}
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
  formData: CriticosThresholdInput;
  errors: Record<string, string>;
  isSaving: boolean;
  onFormChange: (data: CriticosThresholdInput) => void;
  onSave: () => void;
  onClose: () => void;
}

function ThresholdModal({
  isOpen,
  isEditing,
  formData,
  errors,
  isSaving,
  onFormChange,
  onSave,
  onClose,
}: ThresholdModalProps) {
  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="threshold-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-[#141417] rounded-xl border border-white/10 shadow-2xl max-w-lg w-full overflow-auto max-h-[90vh]">
        <div className="sticky top-0 p-6 border-b border-white/10 bg-[#141417] flex items-center justify-between">
          <h3 id="threshold-modal-title" className="text-lg font-semibold text-white">
            {isEditing ? 'Editar' : 'Novo'} Limite Crítico
          </h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-white/50 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errors._form && (
            <div
              className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
              role="alert"
            >
              {errors._form}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="th-analitoId"
                className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wide"
              >
                ID do Analito
              </label>
              <input
                id="th-analitoId"
                type="text"
                value={formData.analitoId}
                onChange={(e) => onFormChange({ ...formData, analitoId: e.target.value })}
                disabled={isSaving}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                placeholder="rbc"
                aria-describedby={errors.analitoId ? 'err-analitoId' : undefined}
              />
              {errors.analitoId && (
                <p id="err-analitoId" className="mt-1 text-xs text-rose-400" role="alert">
                  {errors.analitoId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="th-analitoNome"
                className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wide"
              >
                Nome do Analito
              </label>
              <input
                id="th-analitoNome"
                type="text"
                value={formData.analitoNome}
                onChange={(e) => onFormChange({ ...formData, analitoNome: e.target.value })}
                disabled={isSaving}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                placeholder="Red Blood Cells"
                aria-describedby={errors.analitoNome ? 'err-analitoNome' : undefined}
              />
              {errors.analitoNome && (
                <p id="err-analitoNome" className="mt-1 text-xs text-rose-400" role="alert">
                  {errors.analitoNome}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="th-unidade"
              className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wide"
            >
              Unidade de Medida
            </label>
            <input
              id="th-unidade"
              type="text"
              value={formData.unidade}
              onChange={(e) => onFormChange({ ...formData, unidade: e.target.value })}
              disabled={isSaving}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              placeholder="M/uL, mg/dL"
              aria-describedby={errors.unidade ? 'err-unidade' : undefined}
            />
            {errors.unidade && (
              <p id="err-unidade" className="mt-1 text-xs text-rose-400" role="alert">
                {errors.unidade}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
              Valores Críticos · Ordem: mín &lt; máx
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="th-min" className="block text-white/70 text-xs font-medium mb-2">
                  Mínimo
                </label>
                <input
                  id="th-min"
                  type="number"
                  step="0.001"
                  value={formData.min ?? ''}
                  onChange={(e) =>
                    onFormChange({
                      ...formData,
                      min: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono tabular-nums"
                  placeholder="—"
                  aria-describedby={errors.min ? 'err-min' : undefined}
                />
              </div>
              <div>
                <label htmlFor="th-max" className="block text-white/70 text-xs font-medium mb-2">
                  Máximo
                </label>
                <input
                  id="th-max"
                  type="number"
                  step="0.001"
                  value={formData.max ?? ''}
                  onChange={(e) =>
                    onFormChange({
                      ...formData,
                      max: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono tabular-nums"
                  placeholder="—"
                  aria-describedby={errors.max ? 'err-max' : undefined}
                />
              </div>
            </div>
            {errors.min && (
              <p id="err-min" className="mt-2 text-xs text-rose-400" role="alert">
                {errors.min}
              </p>
            )}
            {errors.max && (
              <p id="err-max" className="mt-2 text-xs text-rose-400" role="alert">
                {errors.max}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="th-severidade"
              className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wide"
            >
              Nível de Severidade
            </label>
            <select
              id="th-severidade"
              value={formData.severidade}
              onChange={(e) =>
                onFormChange({
                  ...formData,
                  severidade: e.target.value as 'alta' | 'baixa',
                })
              }
              disabled={isSaving}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <option value="alta">🔴 Alta (escalação imediata)</option>
              <option value="baixa">🟡 Baixa (documentação)</option>
            </select>
            <p className="mt-1 text-xs text-white/40">
              {formData.severidade === 'alta'
                ? 'Ativa escalação automática para RT'
                : 'Apenas registra no audit trail'}
            </p>
          </div>

          {/* Conditional rules section */}
          {formData.condicional && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <p className="text-xs font-medium text-white/70 uppercase tracking-wide">
                Regras Condicionais (Opcional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="th-age-min"
                    className="block text-white/70 text-xs font-medium mb-1"
                  >
                    Idade Mínima (anos)
                  </label>
                  <input
                    id="th-age-min"
                    type="number"
                    min="0"
                    value={formData.condicional.idadeMin ?? ''}
                    onChange={(e) =>
                      onFormChange({
                        ...formData,
                        condicional: {
                          ...formData.condicional!,
                          idadeMin: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        },
                      })
                    }
                    disabled={isSaving}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 text-xs"
                    placeholder="—"
                  />
                </div>
                <div>
                  <label
                    htmlFor="th-age-max"
                    className="block text-white/70 text-xs font-medium mb-1"
                  >
                    Idade Máxima (anos)
                  </label>
                  <input
                    id="th-age-max"
                    type="number"
                    min="0"
                    value={formData.condicional.idadeMax ?? ''}
                    onChange={(e) =>
                      onFormChange({
                        ...formData,
                        condicional: {
                          ...formData.condicional!,
                          idadeMax: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        },
                      })
                    }
                    disabled={isSaving}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 text-xs"
                    placeholder="—"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="th-sexo" className="block text-white/70 text-xs font-medium mb-1">
                  Sexo
                </label>
                <select
                  id="th-sexo"
                  value={formData.condicional.sexo ?? ''}
                  onChange={(e) =>
                    onFormChange({
                      ...formData,
                      condicional: {
                        ...formData.condicional!,
                        sexo: (e.target.value as 'M' | 'F' | undefined) || undefined,
                      },
                    })
                  }
                  disabled={isSaving}
                  className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50"
                >
                  <option value="">Ambos</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="th-ativo"
              checked={formData.ativo}
              onChange={(e) => onFormChange({ ...formData, ativo: e.target.checked })}
              disabled={isSaving}
              className="w-4 h-4 rounded bg-white/10 border-white/20 text-violet-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              aria-describedby="ativo-desc"
            />
            <label htmlFor="th-ativo" className="text-white/70 text-sm cursor-pointer">
              Ativo
            </label>
            <p id="ativo-desc" className="text-xs text-white/40">
              (desativados não disparam detecção)
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 p-6 border-t border-white/10 bg-[#141417] flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141417] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={isSaving}
          >
            {isSaving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmationModal({
  isOpen,
  isSaving,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-[#141417] rounded-xl border border-white/10 shadow-2xl max-w-sm w-full">
        <div className="p-6">
          <h3 id="delete-modal-title" className="text-lg font-semibold text-white mb-2">
            Remover limite crítico?
          </h3>
          <p className="text-white/70 text-sm mb-6">
            Esta ação não pode ser desfeita. O limite será marcado como deletado no audit trail (RDC
            978 Art. 128).
          </p>
        </div>

        <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Manter
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141417] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={isSaving}
          >
            {isSaving ? 'Removendo...' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  );
}
