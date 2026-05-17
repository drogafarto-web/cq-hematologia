/**
 * EditRiskModal.tsx
 * Modal for editing an existing risk. Calls risks_updateRisk callable.
 */

import React, { useState, useCallback } from 'react';
import type { Risk } from '../types/Risk';
import { callUpdateRisk } from '../services/risksService';

const PROCESSO_OPTIONS = [
  { label: 'Atendimento', value: 'atendimento' },
  { label: 'Coleta', value: 'coleta' },
  { label: 'Transporte', value: 'transporte' },
  { label: 'Armazenamento', value: 'armazenamento' },
  { label: 'Analise', value: 'analise' },
  { label: 'Pos-Analitico', value: 'pos_analitico' },
  { label: 'Liberacao', value: 'liberacao' },
  { label: 'Administrativo', value: 'administrativo' },
  { label: 'Rastreabilidade', value: 'rastreabilidade' },
];

const CATEGORIA_OPTIONS = [
  { label: 'Pessoal', value: 'pessoal' },
  { label: 'Equipamento', value: 'equipamento' },
  { label: 'Material', value: 'material' },
  { label: 'Processo', value: 'processo' },
  { label: 'Seguranca', value: 'seguranca' },
  { label: 'Outro', value: 'outro' },
];

const STATUS_OPTIONS = [
  { label: 'Aberto', value: 'aberto' },
  { label: 'Mitigando', value: 'mitigando' },
  { label: 'Monitorado', value: 'monitorado' },
  { label: 'Fechado', value: 'fechado' },
];

const EFICACIA_OPTIONS = [
  { label: 'Pendente', value: 'pendente' },
  { label: 'Eficaz', value: 'eficaz' },
  { label: 'Parcial', value: 'parcial' },
  { label: 'Ineficaz', value: 'ineficaz' },
];

interface EditRiskModalProps {
  risk: Risk;
  labId: string;
  onSuccess?: () => void;
  onCancel: () => void;
}

export const EditRiskModal: React.FC<EditRiskModalProps> = ({ risk, labId, onSuccess, onCancel }) => {
  const [form, setForm] = useState({
    descricao: risk.descricao,
    processo: risk.processo,
    categoria: risk.categoria,
    probabilidade: risk.probabilidade,
    severidade: risk.severidade,
    deteccao: risk.deteccao,
    status: risk.status,
    causaPotencial: (risk as any).causaPotencial || '',
    efeitoPotencial: (risk as any).efeitoPotencial || '',
    responsavel: (risk as any).responsavel || '',
    eficacia: (risk as any).eficacia || 'pendente',
    observacoes: risk.tratamento?.observacoes || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, any> = {};

      // Only send changed fields
      if (form.descricao !== risk.descricao) payload.descricao = form.descricao.trim();
      if (form.processo !== risk.processo) payload.processo = form.processo;
      if (form.categoria !== risk.categoria) payload.categoria = form.categoria;
      if (form.probabilidade !== risk.probabilidade) payload.probabilidade = form.probabilidade;
      if (form.severidade !== risk.severidade) payload.severidade = form.severidade;
      if (form.deteccao !== risk.deteccao) payload.deteccao = form.deteccao;
      if (form.status !== risk.status) payload.status = form.status;
      if (form.causaPotencial !== ((risk as any).causaPotencial || '')) payload.causaPotencial = form.causaPotencial.trim();
      if (form.efeitoPotencial !== ((risk as any).efeitoPotencial || '')) payload.efeitoPotencial = form.efeitoPotencial.trim();
      if (form.responsavel !== ((risk as any).responsavel || '')) payload.responsavel = form.responsavel.trim();
      if (form.eficacia !== ((risk as any).eficacia || 'pendente')) payload.eficacia = form.eficacia;
      if (form.observacoes !== (risk.tratamento?.observacoes || '')) {
        payload.tratamento = { ...risk.tratamento, observacoes: form.observacoes.trim() };
      }

      if (Object.keys(payload).length === 0) {
        setError('Nenhuma alteracao detectada.');
        setIsSubmitting(false);
        return;
      }

      await callUpdateRisk(labId, risk.id, payload as any);
      onSuccess?.();
      onCancel();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar risco.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, risk, labId, onSuccess, onCancel]);

  const npr = form.probabilidade * form.severidade * form.deteccao;
  const nivelLabel = npr >= 100 ? 'Critico' : npr >= 61 ? 'Alto' : npr >= 25 ? 'Medio' : 'Baixo';
  const nivelColor = npr >= 100 ? 'text-red-400' : npr >= 61 ? 'text-orange-400' : npr >= 25 ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a1f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Editar Risco</h2>
            <p className="text-xs text-white/50 mt-0.5">{risk.codigo}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${nivelColor}`}>{npr}</div>
            <div className="text-[10px] text-white/40">NPR ({nivelLabel})</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Descricao */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Descricao</label>
            <textarea
              value={form.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              rows={2}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Causa + Efeito */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Causa Potencial</label>
              <textarea
                value={form.causaPotencial}
                onChange={(e) => handleChange('causaPotencial', e.target.value)}
                rows={2}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Efeito Potencial</label>
              <textarea
                value={form.efeitoPotencial}
                onChange={(e) => handleChange('efeitoPotencial', e.target.value)}
                rows={2}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 resize-none"
              />
            </div>
          </div>

          {/* Processo + Categoria + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Processo</label>
              <select
                value={form.processo}
                onChange={(e) => handleChange('processo', e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
              >
                {PROCESSO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Categoria</label>
              <select
                value={form.categoria}
                onChange={(e) => handleChange('categoria', e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
              >
                {CATEGORIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* P S D sliders */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Probabilidade: <span className="text-white font-bold">{form.probabilidade}</span>
              </label>
              <input
                type="range" min={1} max={5} step={1}
                value={form.probabilidade}
                onChange={(e) => handleChange('probabilidade', Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[9px] text-white/30">
                <span>Rara</span><span>Quase certa</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Severidade: <span className="text-white font-bold">{form.severidade}</span>
              </label>
              <input
                type="range" min={1} max={5} step={1}
                value={form.severidade}
                onChange={(e) => handleChange('severidade', Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[9px] text-white/30">
                <span>Insignificante</span><span>Catastrofica</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Deteccao: <span className="text-white font-bold">{form.deteccao}</span>
              </label>
              <input
                type="range" min={1} max={5} step={1}
                value={form.deteccao}
                onChange={(e) => handleChange('deteccao', Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[9px] text-white/30">
                <span>Muito alta</span><span>Muito baixa</span>
              </div>
            </div>
          </div>

          {/* Responsavel + Eficacia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Responsavel</label>
              <input
                type="text"
                value={form.responsavel}
                onChange={(e) => handleChange('responsavel', e.target.value)}
                placeholder="Nome do responsavel"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Eficacia do Tratamento</label>
              <select
                value={form.eficacia}
                onChange={(e) => handleChange('eficacia', e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
              >
                {EFICACIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Observacoes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Observacoes do Tratamento</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => handleChange('observacoes', e.target.value)}
              rows={2}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:bg-white/[0.05] text-sm transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alteracoes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
