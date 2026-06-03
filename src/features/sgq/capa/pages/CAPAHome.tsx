/**
 * CAPAHome — Top-level page for CAPA module
 *
 * Renders: list view with create button and filters
 * Integration point for navigation and modal management
 */

import React, { useState } from 'react';
import { useActiveLabId } from '../../../../store/useAuthStore';
import { useAppStore } from '../../../../store/useAppStore';
import { useCAPAList } from '../hooks/useCAPAList';
import CAPAListView from '../components/CAPAListView';
import CAPADetailView from '../components/CAPADetailView';
import CAPAForm from '../components/CAPAForm';
import type { CAPAFilters, CAPAStatus } from '../types';

type CAPAView = 'list' | 'detail' | 'create';

export default function CAPAHome() {
  const labId = useActiveLabId();
  const [currentView, setCurrentView] = useState<CAPAView>('list');
  const [selectedCAPAId, setSelectedCAPAId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CAPAFilters>({});

  const { capas, isLoading, error } = useCAPAList(labId || '', filters);

  if (!labId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#141417]">
        <div className="text-white/60">Sem lab ativo</div>
      </div>
    );
  }

  if (currentView === 'detail' && selectedCAPAId) {
    return <CAPADetailView capaId={selectedCAPAId} onBack={() => setCurrentView('list')} />;
  }

  if (currentView === 'create') {
    return (
      <div className="min-h-screen bg-[#141417] p-6">
        <button
          onClick={() => setCurrentView('list')}
          className="mb-6 text-violet-400 hover:text-violet-300 focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
          aria-label="Voltar à lista"
        >
          ← Voltar
        </button>
        <div className="max-w-md mx-auto">
          <CAPAForm
            onSuccess={() => {
              setCurrentView('list');
              // List will auto-refresh via subscription
            }}
            onCancel={() => setCurrentView('list')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141417]">
      {/* List View */}
      <CAPAListView
        capas={capas}
        isLoading={isLoading}
        error={error || null}
        onCreateClick={() => setCurrentView('create')}
        onCAPASelect={(capaId) => {
          setSelectedCAPAId(capaId);
          setCurrentView('detail');
        }}
      />
    </div>
  );
}
