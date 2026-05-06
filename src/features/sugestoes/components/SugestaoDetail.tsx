import React from 'react';
import type { Sugestao } from '../services/sugestaoService';

interface SugestaoDetailProps {
  sugestao: Sugestao;
  onClose: () => void;
}

export const SugestaoDetail: React.FC<SugestaoDetailProps> = ({ sugestao, onClose }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          ← Voltar
        </button>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-[#1f2937] rounded-lg p-8 border border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {sugestao.titulo}
        </h1>

        <div className="flex gap-2 mb-6">
          <span className="px-3 py-1 text-sm rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            {sugestao.categoria}
          </span>
          <span
            className={`px-3 py-1 text-sm rounded-full ${
              sugestao.status === 'implementada'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : sugestao.status === 'rejeitada'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
            }`}
          >
            {sugestao.status}
          </span>
        </div>

        <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-wrap">
          {sugestao.descricao}
        </p>

        {sugestao.motivo && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Motivo
            </p>
            <p className="text-gray-600 dark:text-gray-400">{sugestao.motivo}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Votos</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {sugestao.votos}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Tipo</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {sugestao.autorTipo}
            </p>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>Criado em: {new Date(sugestao.criadoEm).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
};
