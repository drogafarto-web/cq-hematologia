/**
 * LabApoioAvaliacao.tsx — annual evaluation form (Art. 39).
 *
 * Fields: data, resultado, responsavel (combobox), observacoes, anexo opcional.
 */

import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { AvaliacaoPeriodica, UserId } from '../types/LabApoio';

interface LabApoioAvaliacaoProps {
  contratoNome: string;
  onSubmit?: (avaliacao: Omit<AvaliacaoPeriodica, 'id'>) => Promise<void>;
  onCancel?: () => void;
}

export function LabApoioAvaliacao({
  contratoNome,
  onSubmit,
  onCancel,
}: LabApoioAvaliacaoProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    resultado: 'aprovado' as const,
    responsavel: '',
    observacoes: '',
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (onSubmit && formData.responsavel) {
        const dataTs = Timestamp.fromDate(new Date(formData.data));
        await onSubmit({
          data: dataTs,
          resultado: formData.resultado as 'aprovado' | 'aprovado_com_ressalva' | 'reprovado',
          responsavel: formData.responsavel as UserId,
          responsavelNome: 'Auditor',
          observacoes: formData.observacoes || 'Avaliação de rotina',
        });
      } else if (!formData.responsavel) {
        setError('Selecione um responsável');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white/5 rounded-lg border border-white/10 p-6">
      <h2 className="text-lg font-semibold text-white mb-6">
        Avaliação Periódica — {contratoNome}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-white/70 mb-2">Data da Avaliação</label>
          <input
            type="date"
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
            value={formData.data}
            onChange={(e) => setFormData({ ...formData, data: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-2">Resultado</label>
          <select
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
            value={formData.resultado}
            onChange={(e) => setFormData({ ...formData, resultado: e.target.value as any })}
          >
            <option value="aprovado">Aprovado</option>
            <option value="aprovado_com_ressalva">Aprovado com Ressalva</option>
            <option value="reprovado">Reprovado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-2">Responsável</label>
          <select
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
            value={formData.responsavel}
            onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
          >
            <option value="">Selecionar...</option>
            <option value="uid-1">Auditor 1</option>
            <option value="uid-2">Auditor 2</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-2">Observações</label>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder:text-white/30"
            rows={3}
            placeholder="Anotações da avaliação..."
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          />
        </div>
      </div>

      {error && <div className="text-red-400 text-sm mt-4">{error}</div>}

      <div className="flex gap-3 justify-end mt-6">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-white/50 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Registrar Avaliação'}
        </button>
      </div>
    </div>
  );
}
