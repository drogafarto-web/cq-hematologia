/**
 * CreateRiskModal.tsx
 *
 * Modal form for creating a new risk
 * Fields: código, descrição, processo, categoria, probabilidade, severidade, deteccao
 * Calls Cloud Function → Firestore → updates parent subscription
 */

import React, { useState, useRef, useEffect } from 'react';
import type { RiskInput } from '../types/Risk';
import { useRiskTemplates } from '../hooks/useRiskTemplates';
import { callCreateRisk } from '../services/risksService';
import { haptic } from '../../../shared/hooks/useHaptic';

interface CreateRiskModalProps {
  labId: string;
  onSuccess?: () => void;
  onCancel: () => void;
}

const PROCESSO_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Atendimento', value: 'atendimento' },
  { label: 'Coleta', value: 'coleta' },
  { label: 'Transporte', value: 'transporte' },
  { label: 'Armazenamento', value: 'armazenamento' },
  { label: 'Análise', value: 'analise' },
  { label: 'Pós-Analítico', value: 'pos_analitico' },
  { label: 'Liberação', value: 'liberacao' },
  { label: 'Administrativo', value: 'administrativo' },
  { label: 'Rastreabilidade', value: 'rastreabilidade' },
];

const CATEGORIA_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Análise', value: 'analise' },
  { label: 'Equipamento', value: 'equipamento' },
  { label: 'Material', value: 'material' },
  { label: 'Pessoal', value: 'pessoal' },
  { label: 'Processo', value: 'processo' },
  { label: 'Segurança', value: 'seguranca' },
  { label: 'Outro', value: 'outro' },
];

interface FormState extends Omit<RiskInput, 'processo' | 'categoria'> {
  processo: string; // allow empty during edit
  categoria: string; // allow empty during edit
}

export const CreateRiskModal: React.FC<CreateRiskModalProps> = ({
  labId,
  onSuccess,
  onCancel,
}) => {
  const [form, setForm] = useState<FormState>({
    codigo: '',
    descricao: '',
    processo: '',
    categoria: '',
    probabilidade: 3,
    severidade: 3,
    deteccao: 3,
    causaPotencial: '',
    efeitoPotencial: '',
    responsavel: '',
    status: 'aberto',
    tratamento: { estrategia: 'mitigar', acoes: [], observacoes: '' },
    reviewHistory: [],
    reviewDate: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateSelect, setTemplateSelect] = useState('');
  const { templates, loading: templatesLoading } = useRiskTemplates(labId);
  const codigoRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    codigoRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleChange = (
    field: keyof RiskInput,
    value: string | number
  ) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleTemplatePick = (templateId: string) => {
    setTemplateSelect(templateId);
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setForm((prev) => ({
      ...prev,
      categoria: t.categoria,
      processo: t.processo,
      descricao: t.descricao,
      probabilidade: t.pDefault,
      severidade: t.sDefault,
      deteccao: t.dDefault,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!form.codigo?.trim()) {
      setError('Código é obrigatório');
      codigoRef.current?.focus();
      return;
    }
    if (!form.descricao?.trim()) {
      setError('Descrição é obrigatória');
      return;
    }
    if (!form.processo) {
      setError('Processo é obrigatório');
      return;
    }
    if (!form.categoria) {
      setError('Categoria é obrigatória');
      return;
    }

    setIsSubmitting(true);

    try {
      await callCreateRisk(labId, {
        codigo: form.codigo.trim(),
        descricao: form.descricao.trim(),
        processo: form.processo as any,
        categoria: form.categoria as any,
        probabilidade: form.probabilidade || 3,
        severidade: form.severidade || 3,
        deteccao: form.deteccao || 3,
        causaPotencial: (form as any).causaPotencial?.trim() || undefined,
        efeitoPotencial: (form as any).efeitoPotencial?.trim() || undefined,
        responsavel: (form as any).responsavel?.trim() || undefined,
        status: 'aberto',
        tratamento: { estrategia: 'mitigar', acoes: [], observacoes: '' },
        reviewHistory: [],
        reviewDate: null,
      });

      haptic.confirm();
      onSuccess?.();
      onCancel();
    } catch (err) {
      haptic.error();
      setError(err instanceof Error ? err.message : 'Erro ao criar risco');
      console.error('Create risk error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-risk-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-[#0f1115] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 modal-spring"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="create-risk-title"
          className="text-xl font-bold text-white mb-4"
        >
          Novo Risco
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template opcional */}
          <div>
            <label htmlFor="risk-template-select" className="block text-sm font-medium text-white/70 mb-1.5">
              Usar template
            </label>
            <select
              id="risk-template-select"
              value={templateSelect}
              onChange={(e) => handleTemplatePick(e.target.value)}
              disabled={isSubmitting || templatesLoading}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
              style={{ colorScheme: 'dark' }}
            >
              <option value="">— Nenhum —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.titulo}
                </option>
              ))}
            </select>
          </div>

          {/* Código */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Código *
            </label>
            <input
              ref={codigoRef}
              type="text"
              value={form.codigo || ''}
              onChange={(e) => handleChange('codigo', e.target.value)}
              placeholder="ex: RIS-001"
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Descrição *
            </label>
            <textarea
              value={form.descricao || ''}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Descreva o risco..."
              disabled={isSubmitting}
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Causa Potencial */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Causa Potencial
            </label>
            <textarea
              value={(form as any).causaPotencial || ''}
              onChange={(e) => handleChange('causaPotencial' as any, e.target.value)}
              placeholder="O que pode causar este risco..."
              disabled={isSubmitting}
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Efeito Potencial */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Efeito Potencial
            </label>
            <textarea
              value={(form as any).efeitoPotencial || ''}
              onChange={(e) => handleChange('efeitoPotencial' as any, e.target.value)}
              placeholder="Consequências se o risco se materializar..."
              disabled={isSubmitting}
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Responsável
            </label>
            <input
              type="text"
              value={(form as any).responsavel || ''}
              onChange={(e) => handleChange('responsavel' as any, e.target.value)}
              placeholder="Nome do responsável pelo risco"
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
            />
          </div>

          {/* Processo */}
          <div>
            <label htmlFor="processo-select" className="block text-sm font-medium text-white/70 mb-1.5">
              Processo *
            </label>
            <select
              id="processo-select"
              value={form.processo || ''}
              onChange={(e) => handleChange('processo', e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
              style={{
                colorScheme: 'dark',
              }}
            >
              <option value="">Selecione...</option>
              {PROCESSO_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Categoria */}
          <div>
            <label htmlFor="categoria-select" className="block text-sm font-medium text-white/70 mb-1.5">
              Categoria *
            </label>
            <select
              id="categoria-select"
              value={form.categoria || ''}
              onChange={(e) => handleChange('categoria', e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
              style={{
                colorScheme: 'dark',
              }}
            >
              <option value="">Selecione...</option>
              {CATEGORIA_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* FMEA Scores */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
              Scores FMEA (1-5)
            </label>

            <div className="grid grid-cols-3 gap-3">
              {/* Probabilidade */}
              <div>
                <label htmlFor="prob-select" className="block text-xs text-white/50 mb-1">
                  Probabilidade
                </label>
                <select
                  id="prob-select"
                  value={form.probabilidade || 3}
                  onChange={(e) => handleChange('probabilidade', parseInt(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full px-2 py-1 bg-white/[0.05] border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  style={{ colorScheme: 'dark' }}
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severidade */}
              <div>
                <label htmlFor="sev-select" className="block text-xs text-white/50 mb-1">
                  Severidade
                </label>
                <select
                  id="sev-select"
                  value={form.severidade || 3}
                  onChange={(e) => handleChange('severidade', parseInt(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full px-2 py-1 bg-white/[0.05] border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  style={{ colorScheme: 'dark' }}
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Detecção */}
              <div>
                <label htmlFor="det-select" className="block text-xs text-white/50 mb-1">
                  Detecção
                </label>
                <select
                  id="det-select"
                  value={form.deteccao || 3}
                  onChange={(e) => handleChange('deteccao', parseInt(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full px-2 py-1 bg-white/[0.05] border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  style={{ colorScheme: 'dark' }}
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.07] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
