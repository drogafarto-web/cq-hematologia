/**
 * CAPAHome — Top-level page for CAPA module
 *
 * Renders: list view with create button and filters
 * Integration point for navigation and modal management
 */

import React, { useState } from 'react';
import { useActiveLabId } from '../../../../store/useAuthStore';
import { useCAPAList } from '../hooks/useCAPAList';
import CAPAListView from '../components/CAPAListView';
import CAPAForm from '../components/CAPAForm';
import type { CAPAFilters } from '../types';

export default function CAPAHome() {
  const labId = useActiveLabId();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState<CAPAFilters>({});

  const { capas, isLoading, error } = useCAPAList(labId || '', filters);

  if (!labId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#141417]">
        <div className="text-white/60">Sem lab ativo</div>
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
        onCreateClick={() => setShowCreateForm(true)}
      />

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <CAPAForm
              onSuccess={() => {
                setShowCreateForm(false);
                // List will auto-refresh via subscription
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
