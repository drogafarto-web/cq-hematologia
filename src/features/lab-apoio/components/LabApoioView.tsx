/**
 * LabApoioView.tsx — entry point for lab-apoio module.
 *
 * Contains:
 *   - Topbar (← Hub + title)
 *   - KPI strip (total ativos, vencendo 60d, vencidos, sem avaliação anual)
 *   - Tabs: [Contratos | Avaliações | Vencimentos]
 */

import React, { useState } from 'react';
import { useLabApoio } from '../hooks/useLabApoio';
import { useExpiryAlerts } from '../hooks/useExpiryAlerts';
import { LabApoioList } from './LabApoioList';
import { VencimentosWidget } from './VencimentosWidget';
import { VigenciaAlertBanner } from './VigenciaAlertBanner';

export function LabApoioView() {
  const { contratos, loading, error } = useLabApoio();
  const expiryBins = useExpiryAlerts(contratos);
  const [activeTab, setActiveTab] = useState<'contratos' | 'avaliacoes' | 'vencimentos'>(
    'contratos',
  );

  if (error) {
    return (
      <div className="p-6 text-red-500">
        <p>Erro ao carregar contratos: {error.message}</p>
      </div>
    );
  }

  const totalAtivos = contratos.filter((c) => c.ativo && c.deletadoEm === null).length;
  const vencendo60d = expiryBins['60d'].length;
  const vencidos = expiryBins.expired.length;
  const semAvaliacaoAnual = contratos.filter(
    (c) =>
      c.ativo &&
      c.deletadoEm === null &&
      c.proximaAvaliacaoEm &&
      new Date(c.proximaAvaliacaoEm.toDate()).getTime() < Date.now(),
  ).length;

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f]">
      {/* Topbar */}
      <div className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
        <a href="/hub" className="text-white/50 hover:text-white transition-colors">
          ← Hub
        </a>
        <h1 className="text-2xl font-semibold text-white">Laboratórios de Apoio</h1>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-white/5">
        <div className="flex flex-col">
          <span className="text-xs text-white/50 uppercase tracking-wide">Contratos Ativos</span>
          <span className="text-2xl font-bold text-white">{totalAtivos}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-yellow-500 uppercase tracking-wide">Vencendo (60d)</span>
          <span className="text-2xl font-bold text-yellow-500">{vencendo60d}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-red-500 uppercase tracking-wide">Vencidos</span>
          <span className="text-2xl font-bold text-red-500">{vencidos}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-amber-500 uppercase tracking-wide">
            Sem Avaliação Anual
          </span>
          <span className="text-2xl font-bold text-amber-500">{semAvaliacaoAnual}</span>
        </div>
      </div>

      {!loading && <VigenciaAlertBanner contratos={contratos} />}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5 px-6">
        {(['contratos', 'avaliacoes', 'vencimentos'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-white border-violet-500'
                : 'text-white/50 border-transparent hover:text-white'
            }`}
          >
            {tab === 'contratos' && 'Contratos'}
            {tab === 'avaliacoes' && 'Avaliações'}
            {tab === 'vencimentos' && 'Vencimentos'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {loading && <div className="text-white/50">Carregando...</div>}
        {!loading && activeTab === 'contratos' && <LabApoioList contratos={contratos} />}
        {!loading && activeTab === 'vencimentos' && <VencimentosWidget expiryBins={expiryBins} />}
        {!loading && activeTab === 'avaliacoes' && (
          <div className="text-white/50">Avaliações periódicas — em desenvolvimento</div>
        )}
      </div>
    </div>
  );
}
