import React, { useState } from 'react';
import { useSugestoes } from '../hooks/useSugestoes';
import { useActiveLabId } from '../../../store/useAuthStore';
import { SugestaoDetail } from './SugestaoDetail';
import { SugestaoVotingPanel } from './SugestaoVotingPanel';
import type { LabId } from '../types';
import type { Sugestao } from '../services/sugestaoService';

export const SugestaoDashboard: React.FC = () => {
  const labId = useActiveLabId() as LabId;
  const [view, setView] = useState<'lista' | 'votacao'>('lista');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [selectedStatus, setSelectedStatus] = useState<string>('todas');
  const [ordenarPor, setOrdenarPor] = useState<'votos' | 'recencia'>('votos');
  const [selectedSugestao, setSelectedSugestao] = useState<Sugestao | null>(null);

  const { sugestoes, isLoading } = useSugestoes(labId, {
    categoria: selectedCategoria === 'todas' ? undefined : selectedCategoria,
    status: selectedStatus === 'todas' ? undefined : selectedStatus,
    ordenarPor: ordenarPor,
  });

  if (selectedSugestao) {
    return <SugestaoDetail sugestao={selectedSugestao} onClose={() => setSelectedSugestao(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sugestões</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-0.5 bg-gray-100 dark:bg-[#111827]">
            <button
              type="button"
              onClick={() => setView('lista')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'lista'
                  ? 'bg-white dark:bg-[#1f2937] text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setView('votacao')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'votacao'
                  ? 'bg-white dark:bg-[#1f2937] text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Votação
            </button>
          </div>
          <a
            href="/sugestoes/nova"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Nova sugestão
          </a>
        </div>
      </div>

      {view === 'votacao' && labId ? (
        <>
          <div className="max-w-3xl mx-auto">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filtrar por categoria
            </label>
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1f2937] text-gray-900 dark:text-white"
            >
              <option value="todas">Todas</option>
              <option value="produto">Produto</option>
              <option value="processo">Processo</option>
              <option value="ambiente">Ambiente</option>
              <option value="atendimento">Atendimento</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <SugestaoVotingPanel
            labId={labId}
            filterTopic={selectedCategoria === 'todas' ? undefined : selectedCategoria}
          />
        </>
      ) : null}

      {/* Filters — lista view */}
      {view === 'lista' ? (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categoria
            </label>
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1f2937] text-gray-900 dark:text-white"
            >
              <option value="todas">Todas</option>
              <option value="produto">Produto</option>
              <option value="processo">Processo</option>
              <option value="ambiente">Ambiente</option>
              <option value="atendimento">Atendimento</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1f2937] text-gray-900 dark:text-white"
            >
              <option value="todas">Todas</option>
              <option value="aberta">Aberta</option>
              <option value="analisada">Sendo analisada</option>
              <option value="implementada">Implementada</option>
              <option value="rejeitada">Rejeitada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ordenar por
            </label>
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as 'votos' | 'recencia')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1f2937] text-gray-900 dark:text-white"
            >
              <option value="votos">Mais votadas</option>
              <option value="recencia">Mais recentes</option>
            </select>
          </div>
        </div>
      ) : null}

      {/* List */}
      {view === 'lista' ? (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando sugestões...</div>
          ) : sugestoes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Nenhuma sugestão encontrada</div>
          ) : (
            sugestoes.map((sugestao) => (
              <div
                key={sugestao.id}
                onClick={() => setSelectedSugestao(sugestao)}
                className="p-4 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a3746] cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {sugestao.titulo}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {sugestao.descricao}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        {sugestao.categoria}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
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
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {sugestao.votos}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">votos</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};
