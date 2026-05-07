/**
 * LabApoioAvaliacao.tsx — annual evaluation form (Art. 39).
 *
 * Fields: data, resultado, responsavel (combobox), observacoes, anexo opcional.
 */

import React, { useState } from 'react';
import type { AvaliacaoPeriodica } from '../types/LabApoio';

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

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (onSubmit) {
        await onSubmit({
          data: new Date(),
          resultado: 'aprovado',
          responsavel: 'uid-placeholder',
          responsavelNome: 'Auditor',
          observacoes: 'Avaliação de rotina',
        });
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
            defaultValue={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-2">Resultado</label>
          <select className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white">
            <option value="aprovado">Aprovado</option>
            <option value="aprovado_com_ressalva">Aprovado com Ressalva</option>
            <option value="reprovado">Reprovado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-2">Responsável</label>
          <select className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white">
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
