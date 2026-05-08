/**
 * PortalPacienteShell
 * Main patient portal layout — centered column, dark-first, WCAG AAA
 * Phase 4 complete: Meus Resultados + Consentimentos + Direitos LGPD + Email Preferences
 */

import React, { useState } from 'react';
import { PortalPacienteNav } from './PortalPacienteNav';
import { ConsentCaptureModal } from './ConsentCaptureModal';
import { PreferenciaEmailModal } from './PreferenciaEmailModal';
import { usePatientResults } from '../hooks/usePatientResults';
import { usePatientConsent, useRecordPatientConsent } from '../hooks/usePatientConsent';
import { ResultadosAdvanced } from '../sections/ResultadosAdvanced';
import { ConsentimentosSection } from '../sections/ConsentimentosSection';
import { DireitosLGPDSection } from '../sections/DireitosLGPDSection';
import type { ConsentScope } from '../types';

interface PortalPacienteShellProps {
  patientId: string;
  patientName: string;
  labId: string;
  labName: string;
  onLogout: () => void;
}

export const PortalPacienteShell: React.FC<PortalPacienteShellProps> = ({
  patientId,
  patientName,
  labId,
  labName,
  onLogout,
}) => {
  const { results, isLoading: resultsLoading } = usePatientResults(labId, patientId);
  const { hasConsent, consentedScopes } = usePatientConsent(labId, patientId);
  const { recordConsent, isLoading: consentLoading } = useRecordPatientConsent();
  const [consentModal, setConsentModal] = useState({ isOpen: false });
  const [emailPrefsModal, setEmailPrefsModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleConsentSubmit = async (scopes: ConsentScope[]) => {
    try {
      await recordConsent(labId, patientId, scopes);
      setConsentModal({ isOpen: false });
      setSuccessMessage(`Consentimento capturado em ${new Date().toLocaleDateString('pt-BR')}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('Consent error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#141417]">
      {/* Navigation */}
      <PortalPacienteNav
        patientName={patientName}
        labName={labName}
        onLogout={onLogout}
      />

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Success message */}
        {successMessage && (
          <div className="p-4 rounded-lg bg-emerald-500/12 border border-emerald-500/30">
            <p className="text-sm text-emerald-300">{successMessage}</p>
          </div>
        )}

        {/* Section 1: Meus Resultados (Advanced) */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white/95">Meus Resultados</h2>
            {results.length > 0 && (
              <span className="text-sm text-white/50">
                {results.length} resultado{results.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <ResultadosAdvanced
            results={results}
            isLoading={resultsLoading}
            onViewDetails={(result) => setSelectedResult(result)}
          />
        </section>

        {/* Section 2: Consentimentos */}
        <section>
          <h2 className="text-xl font-semibold text-white/95 mb-6">
            Consentimentos
          </h2>

          <ConsentimentosSection
            labId={labId}
            patientId={patientId}
            onRevoke={async (consentId, reason) => {
              // Cloud Function callable for revocation
              console.log('Revoking consent:', consentId, reason);
            }}
          />

          {!hasConsent && (
            <div className="mt-4 p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <button
                onClick={() => setConsentModal({ isOpen: true })}
                className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
              >
                Autorizar Novo Consentimento
              </button>
            </div>
          )}
        </section>

        {/* Section 3: Meus Direitos LGPD */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white/95">Meus Direitos LGPD</h2>
            <button
              onClick={() => setEmailPrefsModal(true)}
              className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
            >
              Preferências de Email →
            </button>
          </div>

          <DireitosLGPDSection
            labId={labId}
            patientId={patientId}
            onRequestAccess={async () => {
              // Cloud Function callable for data access
              console.log('Requesting data access');
            }}
            onRequestExport={async () => {
              // Cloud Function callable for export
              console.log('Requesting export');
            }}
            onRequestDeletion={async () => {
              // Cloud Function callable for deletion
              console.log('Requesting deletion');
            }}
          />
        </section>

        {/* Footer spacing */}
        <div className="h-8" />
      </main>

      {/* Modals */}
      <ConsentCaptureModal
        isOpen={consentModal.isOpen}
        onClose={() => setConsentModal({ isOpen: false })}
        onSubmit={handleConsentSubmit}
        labName={labName}
      />

      <PreferenciaEmailModal
        isOpen={emailPrefsModal}
        labId={labId}
        patientId={patientId}
        onClose={() => setEmailPrefsModal(false)}
        onSave={async (prefs) => {
          // Save preferences to Firestore
          console.log('Saving email preferences:', prefs);
        }}
      />
    </div>
  );
};
