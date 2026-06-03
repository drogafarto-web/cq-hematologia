/**
 * CriticosThresholdsForm — Admin form for creating/editing critical value thresholds
 *
 * Features:
 * - Create/edit thresholds with panic and critical ranges
 * - Cross-field validation (panic > critical)
 * - Dark-first design per MP-2 invariants
 * - WCAG AA accessibility
 * - RDC 978 Art. 128 compliant (with audit trail)
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { CriticoThreshold } from '../types';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { z } from 'zod';

// Re-export for type checking — assumes this shape exists in service
interface CriticoThresholdFormData {
  analitoId: string;
  analitoNome: string;
  unidade: string;
  faixaCritica: { min: number | null; max: number | null };
  faixaPanico: { min: number | null; max: number | null };
  severityDefault: 'low' | 'medium' | 'high' | 'panic';
  ativo: boolean;
}

interface Props {
  labId?: string;
  initial?: CriticoThreshold;
  onSaved?: (threshold: CriticoThreshold) => void;
  onCancel?: () => void;
}

const formSchema = z
  .object({
    analitoId: z.string().min(1, 'Analito obrigatório'),
    analitoNome: z.string().min(1, 'Nome do analito obrigatório'),
    unidade: z.string().min(1, 'Unidade obrigatória'),
    faixaCritica: z.object({
      min: z.number().nullable(),
      max: z.number().nullable(),
    }),
    faixaPanico: z.object({
      min: z.number().nullable(),
      max: z.number().nullable(),
    }),
    severityDefault: z.enum(['low', 'medium', 'high', 'panic'] as const),
    ativo: z.boolean(),
  })
  .refine((data) => data.faixaCritica.min !== null || data.faixaCritica.max !== null, {
    message: 'Faixa crítica deve ter pelo menos um limite',
    path: ['faixaCritica'],
  })
  .refine(
    (data) => {
      const { min, max } = data.faixaCritica;
      if (min !== null && max !== null) return min < max;
      return true;
    },
    {
      message: 'Mínimo deve ser menor que máximo',
      path: ['faixaCritica'],
    },
  )
  .refine(
    (data) => {
      const { min, max } = data.faixaPanico;
      if (min !== null && max !== null) return min < max;
      return true;
    },
    {
      message: 'Mínimo deve ser menor que máximo',
      path: ['faixaPanico'],
    },
  )
  .refine(
    (data) => {
      const cMin = data.faixaCritica.min;
      const pMin = data.faixaPanico.min;
      if (cMin !== null && pMin !== null) return pMin <= cMin;
      return true;
    },
    {
      message: 'Pânico mín deve ser ≤ crítico mín',
      path: ['faixaPanico'],
    },
  )
  .refine(
    (data) => {
      const cMax = data.faixaCritica.max;
      const pMax = data.faixaPanico.max;
      if (cMax !== null && pMax !== null) return cMax <= pMax;
      return true;
    },
    {
      message: 'Crítico máx deve ser ≤ pânico máx',
      path: ['faixaCritica'],
    },
  );

export default function CriticosThresholdsForm({
  labId: propLabId,
  initial,
  onSaved,
  onCancel,
}: Props) {
  const storeLabId = useActiveLabId();
  const labId = propLabId || storeLabId;
  const user = useUser();

  const isEditing = !!initial;

  const [formData, setFormData] = useState<CriticoThresholdFormData>(() => {
    if (initial) {
      return {
        analitoId: initial.analitoId,
        analitoNome: initial.analitoNome,
        unidade: initial.unidade,
        faixaCritica: initial.faixaCritica,
        faixaPanico: initial.faixaPanico,
        severityDefault: initial.severityDefault,
        ativo: initial.ativo,
      };
    }
    return {
      analitoId: '',
      analitoNome: '',
      unidade: '',
      faixaCritica: { min: null, max: null },
      faixaPanico: { min: null, max: null },
      severityDefault: 'medium',
      ativo: true,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Validate form
  const validateForm = useCallback(() => {
    try {
      formSchema.parse(formData);
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((e) => {
          const path = e.path.join('.');
          newErrors[path] = e.message;
        });
        return newErrors;
      }
      return { _form: 'Erro ao validar formulário' };
    }
  }, [formData]);

  // Handle field changes
  const handleChange = useCallback(
    (field: keyof CriticoThresholdFormData, value: unknown) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error for this field
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    },
    [errors],
  );

  // Handle range changes
  const handleRangeChange = useCallback(
    (range: 'faixaCritica' | 'faixaPanico', bound: 'min' | 'max', value: number | null) => {
      setFormData((prev) => ({
        ...prev,
        [range]: {
          ...prev[range],
          [bound]: value,
        },
      }));
      // Clear error for this range
      const newErrors = { ...errors };
      delete newErrors[range];
      setErrors(newErrors);
    },
    [errors],
  );

  // Handle submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const validationErrors = validateForm();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      if (!labId || !user) {
        setErrors({ _form: 'Contexto de usuário/lab não disponível' });
        return;
      }

      setIsLoading(true);
      try {
        // TODO: Call thresholdService.upsertThreshold(labId, formData, user.uid)
        // For now, return the data structure to be saved
        const threshold: CriticoThreshold = {
          id: initial?.id || crypto.randomUUID(),
          labId,
          ...formData,
          criadoEm: initial?.criadoEm || Date.now(),
          criadoPor: initial?.criadoPor || user.uid,
        };

        onSaved?.(threshold);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erro ao salvar';
        setErrors({ _form: msg });
      } finally {
        setIsLoading(false);
      }
    },
    [validateForm, labId, user, initial, onSaved],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error banner */}
      {errors._form && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
        >
          {errors._form}
        </div>
      )}

      {/* Analito selection row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="analitoId"
            className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wide"
          >
            ID do Analito
          </label>
          <input
            id="analitoId"
            type="text"
            value={formData.analitoId}
            onChange={(e) => handleChange('analitoId', e.target.value)}
            disabled={isLoading || isEditing}
            placeholder="e.g., TSH, K, glucose"
            aria-describedby={errors.analitoId ? 'err-analitoId' : undefined}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {errors.analitoId && (
            <p id="err-analitoId" className="mt-1 text-xs text-rose-400">
              {errors.analitoId}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="analitoNome"
            className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wide"
          >
            Nome do Analito
          </label>
          <input
            id="analitoNome"
            type="text"
            value={formData.analitoNome}
            onChange={(e) => handleChange('analitoNome', e.target.value)}
            disabled={isLoading}
            placeholder="e.g., Thyroid Stimulating Hormone"
            aria-describedby={errors.analitoNome ? 'err-analitoNome' : undefined}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {errors.analitoNome && (
            <p id="err-analitoNome" className="mt-1 text-xs text-rose-400">
              {errors.analitoNome}
            </p>
          )}
        </div>
      </div>

      {/* Unit */}
      <div>
        <label
          htmlFor="unidade"
          className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wide"
        >
          Unidade de Medida
        </label>
        <input
          id="unidade"
          type="text"
          value={formData.unidade}
          onChange={(e) => handleChange('unidade', e.target.value)}
          disabled={isLoading}
          placeholder="e.g., mIU/L, mg/dL"
          aria-describedby={errors.unidade ? 'err-unidade' : undefined}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {errors.unidade && (
          <p id="err-unidade" className="mt-1 text-xs text-rose-400">
            {errors.unidade}
          </p>
        )}
      </div>

      {/* Critical range */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
          Faixa Crítica (obrigatória)
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="faixaCritica-min"
              className="block text-white/70 text-xs font-medium mb-2"
            >
              Mínimo
            </label>
            <input
              id="faixaCritica-min"
              type="number"
              step="0.001"
              value={formData.faixaCritica.min ?? ''}
              onChange={(e) =>
                handleRangeChange(
                  'faixaCritica',
                  'min',
                  e.target.value ? parseFloat(e.target.value) : null,
                )
              }
              disabled={isLoading}
              placeholder="—"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 font-mono tabular-nums"
            />
          </div>
          <div>
            <label
              htmlFor="faixaCritica-max"
              className="block text-white/70 text-xs font-medium mb-2"
            >
              Máximo
            </label>
            <input
              id="faixaCritica-max"
              type="number"
              step="0.001"
              value={formData.faixaCritica.max ?? ''}
              onChange={(e) =>
                handleRangeChange(
                  'faixaCritica',
                  'max',
                  e.target.value ? parseFloat(e.target.value) : null,
                )
              }
              disabled={isLoading}
              placeholder="—"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 font-mono tabular-nums"
            />
          </div>
        </div>
        {errors.faixaCritica && (
          <p className="mt-2 text-xs text-rose-400" role="alert">
            {errors.faixaCritica}
          </p>
        )}
      </div>

      {/* Panic range */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
          Faixa de Pânico (opcional — deve conter faixa crítica)
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="faixaPanico-min"
              className="block text-white/70 text-xs font-medium mb-2"
            >
              Mínimo
            </label>
            <input
              id="faixaPanico-min"
              type="number"
              step="0.001"
              value={formData.faixaPanico.min ?? ''}
              onChange={(e) =>
                handleRangeChange(
                  'faixaPanico',
                  'min',
                  e.target.value ? parseFloat(e.target.value) : null,
                )
              }
              disabled={isLoading}
              placeholder="—"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 font-mono tabular-nums"
            />
          </div>
          <div>
            <label
              htmlFor="faixaPanico-max"
              className="block text-white/70 text-xs font-medium mb-2"
            >
              Máximo
            </label>
            <input
              id="faixaPanico-max"
              type="number"
              step="0.001"
              value={formData.faixaPanico.max ?? ''}
              onChange={(e) =>
                handleRangeChange(
                  'faixaPanico',
                  'max',
                  e.target.value ? parseFloat(e.target.value) : null,
                )
              }
              disabled={isLoading}
              placeholder="—"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 font-mono tabular-nums"
            />
          </div>
        </div>
        {errors.faixaPanico && (
          <p className="mt-2 text-xs text-rose-400" role="alert">
            {errors.faixaPanico}
          </p>
        )}
      </div>

      {/* Severity default */}
      <div>
        <label
          htmlFor="severityDefault"
          className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wide"
        >
          Severidade Padrão (na faixa crítica)
        </label>
        <select
          id="severityDefault"
          value={formData.severityDefault}
          onChange={(e) => handleChange('severityDefault', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
        >
          <option value="low">🔵 Baixa (documentação)</option>
          <option value="medium">🟡 Média (aviso)</option>
          <option value="high">🔴 Alta (escalação)</option>
          <option value="panic">⚫ Pânico (escalação imediata)</option>
        </select>
        <p className="mt-1 text-xs text-white/40">
          Valores na faixa de pânico sempre escalad como pânico, independente deste valor.
        </p>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3 pt-2">
        <input
          id="ativo"
          type="checkbox"
          checked={formData.ativo}
          onChange={(e) => handleChange('ativo', e.target.checked)}
          disabled={isLoading}
          className="w-4 h-4 rounded bg-white/10 border-white/20 text-violet-600 cursor-pointer disabled:opacity-50"
        />
        <label
          htmlFor="ativo"
          className="text-white/70 text-sm cursor-pointer flex items-center gap-2"
        >
          Ativo
          <span className="text-xs text-white/40">(desativados não disparam detecção)</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141417] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}
