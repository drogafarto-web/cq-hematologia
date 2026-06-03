import React, { useState } from 'react';
import { db } from '../../../shared/services/firebase';
import type { LabId } from '../types';

interface FiveWhysLevel {
  nivel: number;
  pergunta: string;
  resposta: string;
}

interface RCAFiveWhysFormProps {
  labId: LabId;
  reclamacaoId: string;
  onSubmit: (rca: any) => Promise<void>;
}

export const RCAFiveWhysForm: React.FC<RCAFiveWhysFormProps> = ({
  labId,
  reclamacaoId,
  onSubmit,
}) => {
  const [levels, setLevels] = useState<FiveWhysLevel[]>(
    Array.from({ length: 5 }, (_, i) => ({
      nivel: i + 1,
      pergunta: `Por quê? (Nível ${i + 1})`,
      resposta: '',
    })),
  );
  const [nivelRaiz, setNivelRaiz] = useState('');
  const [acoesRecomendadas, setAcoesRecomendadas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLevelChange = (nivel: number, resposta: string) => {
    setLevels(levels.map((l) => (l.nivel === nivel ? { ...l, resposta } : l)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nivelRaiz) {
      setError('Descrição da causa raiz é obrigatória');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const rcaData = {
        niveis: levels,
        nivelRaiz: nivelRaiz,
        acoesRecomendadas: acoesRecomendadas,
        completadoEm: new Date().toISOString(),
      };

      // Update reclamacao with RCA data
      // Note: In production, this should be called via callable function
      // For now, this is a placeholder — actual update happens via Cloud Function

      await onSubmit(rcaData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar RCA');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-400">
          <strong>5 Whys:</strong> Responda a cada nível para identificar a causa raiz. Comece com o
          problema e faça 5 perguntas "Por quê?" sucessivas.
        </p>
      </div>

      {/* 5 Levels */}
      <div className="space-y-4">
        {levels.map((level) => (
          <div key={level.nivel} className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              {level.pergunta}
            </label>
            <textarea
              value={level.resposta}
              onChange={(e) => handleLevelChange(level.nivel, e.target.value)}
              placeholder={`Nível ${level.nivel} - responda por quê...`}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
        ))}
      </div>

      {/* Cause Root */}
      <div className="space-y-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
        <label className="block text-sm font-bold text-green-700 dark:text-green-400">
          Causa Raiz
        </label>
        <textarea
          value={nivelRaiz}
          onChange={(e) => setNivelRaiz(e.target.value)}
          placeholder="Descrição da causa raiz identificada..."
          className="w-full p-3 border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          rows={3}
          required
        />
      </div>

      {/* Recommended Actions */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
          Ações Recomendadas (opcional)
        </label>
        <textarea
          value={acoesRecomendadas}
          onChange={(e) => setAcoesRecomendadas(e.target.value)}
          placeholder="Liste as ações corretivas recomendadas..."
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting || !nivelRaiz}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        {isSubmitting ? 'Salvando RCA...' : 'Salvar RCA 5 Whys'}
      </button>
    </form>
  );
};
