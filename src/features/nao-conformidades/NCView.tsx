/**
 * NCView.tsx
 *
 * Entry point — Módulo "Tratamento de Não Conformidades"
 * Unifica: sgq/naoConformidade + sgq/capa + capa-tracking + qualidade (anomalias)
 *
 * 5 abas com linguagem de profissional de qualidade:
 * 1. Não Conformidades — registro e acompanhamento
 * 2. Investigações — causa raiz, 5 porquês, CAPA
 * 3. Indicadores — dashboard executivo
 * 4. Relatórios — geração PDF/CSV
 * 5. Configurações — setores, origens, prazos
 *
 * RDC 978/2025 + DICQ 4.14 + ISO 15189
 */

import React, { useState, lazy, Suspense } from 'react';
import { useActiveLab, useUser } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import NCList from '../sgq/naoConformidade/components/NCList';
import { NCIndicadores } from './components/NCIndicadores';
import { NCConfiguracoes } from './components/NCConfiguracoes';
import { NCReportBuilder } from './components/NCReportBuilder';
import type { NaoConformidade } from '../sgq/types/NaoConformidade';

const CAPAHome = lazy(() => import('../sgq/capa/pages/CAPAHome').then((m) => ({ default: m.default })));

type Tab = 'ncs' | 'investigacoes' | 'indicadores' | 'relatorios' | 'configuracoes';

export default function NCView() {
  const activeLab = useActiveLab();
  const user = useUser();
  const labId = activeLab?.id ?? '';
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const [activeTab, setActiveTab] = useState<Tab>('ncs');
  const [selectedNC, setSelectedNC] = useState<NaoConformidade | null>(null);

  if (!labId || !user) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
        <p className="text-white/40">Carregando...</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; description: string }[] = [
    { id: 'ncs', label: 'Não Conformidades', description: 'Registro e acompanhamento' },
    { id: 'investigacoes', label: 'Investigações', description: 'Causa raiz e CAPA' },
    { id: 'indicadores', label: 'Indicadores', description: 'Dashboard' },
    { id: 'relatorios', label: 'Relatórios', description: 'PDF e CSV' },
    { id: 'configuracoes', label: 'Configurações', description: 'Setores e prazos' },
  ];

  return (
    <div className="min-h-screen bg-[#0c0c0c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <button
            type="button"
            onClick={() => setCurrentView('hub')}
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-3"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M12 15l-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voltar ao Hub
          </button>
          <p className="text-[10px] font-bold tracking-widest uppercase text-red-400/80 mb-1">
            Gestão da Qualidade
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Tratamento de Não Conformidades
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Registro, investigação, ações corretivas e rastreabilidade — RDC 978/2025
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/10">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Abas do módulo NC">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-red-500 text-white'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div role="tabpanel" className="min-h-[60vh]">
          {activeTab === 'ncs' && (
            <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
              <NCList
                onSelectNC={(nc) => {
                  setSelectedNC(nc);
                  setActiveTab('investigacoes');
                }}
              />
            </div>
          )}

          {activeTab === 'investigacoes' && (
            <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
              <Suspense fallback={<LoadingFallback />}>
                <CAPAHome />
              </Suspense>
            </div>
          )}

          {activeTab === 'indicadores' && (
            <NCIndicadores labId={labId} />
          )}

          {activeTab === 'relatorios' && (
            <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
              <NCReportBuilder labId={labId} />
            </div>
          )}

          {activeTab === 'configuracoes' && (
            <NCConfiguracoes labId={labId} />
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <p className="text-sm text-white/50">Carregando...</p>
      </div>
    </div>
  );
}
