import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { CAPAListView, CAPADetailPanel, CapaEvidenceUpload, AuditorRFIForm, CapaAuditorSignOff } from '../components';

/**
 * CAPATrackingHome — Root page for CAPA closure module (Phase 8 Wave 5)
 *
 * Implements split-view pattern:
 * - No selection → CAPAListView (filterable table)
 * - Selection → CAPADetailPanel (side panel with state history)
 *
 * Modals for RFI, evidence upload, and auditor sign-off managed via useState.
 *
 * Multi-tenant: labId comes from useActiveLabId()
 * Auth: RT/QA/director roles (enforced in AuthWrapper)
 */

export default function CAPATrackingHome() {
  const labId = useActiveLabId();

  // View state: null = list view, string = detail panel for that CAPA
  const [selectedCapaId, setSelectedCapaId] = useState<string | null>(null);

  // Modal states
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);
  const [showRFIForm, setShowRFIForm] = useState(false);
  const [showSignOff, setShowSignOff] = useState(false);

  if (!labId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] flex items-center justify-center">
        <p className="text-slate-600 dark:text-white/40">Nenhum laboratório ativo</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400/80 mb-2">
            Rastreamento
          </p>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            CAPA Closure
          </h1>
          <p className="text-sm text-slate-600 dark:text-white/40">
            Ações corretivas e preventivas — Rastreamento com auditor RDC 978 Art. 5.3
          </p>
        </div>

        {/* View logic: list or detail panel */}
        {!selectedCapaId ? (
          // List view
          <CAPAListView onSelect={setSelectedCapaId} />
        ) : (
          // Detail panel
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main detail panel */}
            <div className="lg:col-span-3">
              <CAPADetailPanel
                capaId={selectedCapaId}
                onBack={() => setSelectedCapaId(null)}
              />
            </div>

            {/* Side action bar */}
            <div className="lg:col-span-1 space-y-3">
              <button
                type="button"
                onClick={() => setShowEvidenceUpload(true)}
                className="w-full px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm transition-colors"
              >
                Upload de evidência
              </button>
              <button
                type="button"
                onClick={() => setShowRFIForm(true)}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-medium text-sm transition-colors"
              >
                Enviar RFI
              </button>
              <button
                type="button"
                onClick={() => setShowSignOff(true)}
                className="w-full px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-white font-medium text-sm transition-colors"
              >
                Auditor Sign-off
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Evidence upload modal */}
      {showEvidenceUpload && selectedCapaId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141417] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CapaEvidenceUpload
              capaId={selectedCapaId}
              onSuccess={() => setShowEvidenceUpload(false)}
              onClose={() => setShowEvidenceUpload(false)}
            />
          </div>
        </div>
      )}

      {/* RFI form modal */}
      {showRFIForm && selectedCapaId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141417] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <AuditorRFIForm
              capaId={selectedCapaId}
              onSuccess={() => setShowRFIForm(false)}
              onClose={() => setShowRFIForm(false)}
            />
          </div>
        </div>
      )}

      {/* Auditor sign-off modal */}
      {showSignOff && selectedCapaId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141417] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CapaAuditorSignOff
              capaIds={[selectedCapaId]}
              onSuccess={() => setShowSignOff(false)}
              onClose={() => setShowSignOff(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
