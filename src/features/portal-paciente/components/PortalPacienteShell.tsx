/**
 * PortalPacienteShell
 * Main patient portal layout — centered column, dark-first, WCAG AAA
 * Phase 4 scaffold: Meus Resultados + Consentimentos + Direitos LGPD
 */

import React, { useState } from 'react';
import { PortalPacienteNav } from './PortalPacienteNav';
import { ResultCard } from './ResultCard';
import { ConsentCaptureModal } from './ConsentCaptureModal';
import { usePatientResults } from '../hooks/usePatientResults';
import { usePatientConsent, useRecordPatientConsent } from '../hooks/usePatientConsent';
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

        {/* Section 1: Meus Resultados */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white/95">Meus Resultados</h2>
            {results.length > 0 && (
              <span className="text-sm text-white/50">
                {results.length} resultado{results.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {resultsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 rounded-lg bg-white/5 border border-white/8 animate-pulse"
                />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              {results.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  onViewDetails={() => {
                    // Phase 5: Navigate to detail view
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-lg border border-white/8 bg-white/2 text-center">
              <p className="text-sm text-white/60">
                Nenhum resultado disponível no momento.
              </p>
            </div>
          )}
        </section>

        {/* Section 2: Consentimentos */}
        <section>
          <h2 className="text-xl font-semibold text-white/95 mb-6">
            Consentimentos
          </h2>

          <div className="border border-white/8 rounded-lg p-6 bg-white/2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-white/95">
                  Processamento com IA
                </h3>
                <p className="text-xs text-white/60 mt-1">
                  Análise automática de uroanálise com tecnologia de IA
                </p>
                {hasConsent && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/12 border border-emerald-500/30">
                    <span className="text-xs font-medium text-emerald-400">
                      ✓ Autorizado
                    </span>
                    {consentedScopes.length > 0 && (
                      <span className="text-xs text-emerald-500/70">
                        ({consentedScopes.join(', ')})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!hasConsent && (
                <button
                  onClick={() => setConsentModal({ isOpen: true })}
                  className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  Autorizar
                </button>
              )}
            </div>
          </div>

          {/* LGPD info */}
          <p className="text-xs text-white/50 mt-4 leading-relaxed">
            Seus dados são tratados conforme a Lei Geral de Proteção de Dados (LGPD).
            Você pode revogar consentimentos a qualquer momento.
          </p>
        </section>

        {/* Section 3: Meus Direitos LGPD */}
        <section>
          <h2 className="text-xl font-semibold text-white/95 mb-6">
            Meus Direitos LGPD
          </h2>

          <div className="grid gap-4">
            {/* Right 1: Access */}
            <div className="border border-white/8 rounded-lg p-4 bg-white/2 hover:bg-white/3 transition-colors">
              <h3 className="text-sm font-medium text-white/95">Direito de Acesso</h3>
              <p className="text-xs text-white/60 mt-1">
                Solicitar cópia de todos os seus dados pessoais.
              </p>
              <button className="mt-3 text-xs font-medium text-violet-400 hover:text-violet-300">
                Solicitar →
              </button>
            </div>

            {/* Right 2: Portability */}
            <div className="border border-white/8 rounded-lg p-4 bg-white/2 hover:bg-white/3 transition-colors">
              <h3 className="text-sm font-medium text-white/95">Direito de Portabilidade</h3>
              <p className="text-xs text-white/60 mt-1">
                Exportar seus dados em formato estruturado.
              </p>
              <button className="mt-3 text-xs font-medium text-violet-400 hover:text-violet-300">
                Exportar →
              </button>
            </div>

            {/* Right 3: Deletion */}
            <div className="border border-white/8 rounded-lg p-4 bg-white/2 hover:bg-white/3 transition-colors">
              <h3 className="text-sm font-medium text-white/95">Direito ao Esquecimento</h3>
              <p className="text-xs text-white/60 mt-1">
                Solicitar a exclusão de seus dados pessoais.
              </p>
              <button className="mt-3 text-xs font-medium text-violet-400 hover:text-violet-300">
                Solicitar →
              </button>
            </div>
          </div>

          {/* Contact info */}
          <p className="text-xs text-white/50 mt-4">
            Dúvidas sobre privacidade?{' '}
            <a
              href="mailto:privacy@lab.com"
              className="text-violet-400 hover:text-violet-300"
            >
              Entre em contato
            </a>
          </p>
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
    </div>
  );
};
