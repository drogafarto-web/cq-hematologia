/**
 * ConsentimentosSection
 * Display and manage patient consents with revocation UI + audit trail
 * Real-time Firestore listener for consent changes
 * WCAG AAA dark-first design
 */

import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
import { Skeleton } from '../components/Skeleton';
import type { PatientConsent, ConsentScope } from '../types';

interface ConsentimentosSectionProps {
  labId: string;
  patientId: string;
  onRevoke?: (consentId: string, reason: string) => Promise<void>;
}

const scopeLabels: Record<ConsentScope, string> = {
  'ia-strip': 'Análise de Strip com IA',
  'ia-laudo': 'Análise de Laudo com IA',
  'ia-predictive': 'Análise Preditiva',
};

const scopeDescriptions: Record<ConsentScope, string> = {
  'ia-strip': 'Autoriza análise automática de imagens de strips de uroanálise',
  'ia-laudo': 'Autoriza geração automática de laudos com suporte IA',
  'ia-predictive': 'Autoriza análises preditivas de resultados futuros',
};

export const ConsentimentosSection: React.FC<ConsentimentosSectionProps> = ({
  labId,
  patientId,
  onRevoke,
}) => {
  const [consents, setConsents] = useState<PatientConsent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<Record<string, string>>({});
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});

  // Real-time listener for patient consents
  useEffect(() => {
    if (!labId || !patientId) {
      setIsLoading(false);
      return;
    }

    const db = getFirestore();
    const consentsRef = collection(db, `consents/${labId}/patients/${patientId}/history`);
    const q = query(consentsRef, where('revokedAt', '==', null));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activeConsents = snapshot.docs.map((doc) => ({
          ...(doc.data() as PatientConsent),
          id: doc.id,
        }));
        setConsents(activeConsents);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching consents:', error);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, patientId]);

  const handleRevoke = async (consentId: string) => {
    if (!onRevoke || !revokeReason[consentId]) return;

    setRevoking((prev) => ({ ...prev, [consentId]: true }));
    try {
      await onRevoke(consentId, revokeReason[consentId]);
      setExpandedId(null);
      setRevokeReason((prev) => {
        const newReasons = { ...prev };
        delete newReasons[consentId];
        return newReasons;
      });
    } catch (error) {
      console.error('Error revoking consent:', error);
    } finally {
      setRevoking((prev) => ({ ...prev, [consentId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consents.length > 0 ? (
        <div className="space-y-3">
          {consents.map((consent) => (
            <div
              key={consent.id}
              className="border border-white/8 rounded-lg bg-white/2 overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedId(expandedId === consent.id ? null : consent.id)}
                className="w-full px-4 py-4 flex items-start justify-between gap-3 hover:bg-white/3 transition-colors"
              >
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium text-white/95">
                      {consent.scope.map((s) => scopeLabels[s]).join(', ')}
                    </h3>
                    <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/12 border border-emerald-500/30">
                      <span className="text-xs font-medium text-emerald-400">✓ Ativo</span>
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    Consentido em{' '}
                    {new Date(consent.consentedAt.toDate()).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <span className="text-white/50">{expandedId === consent.id ? '−' : '+'}</span>
              </button>

              {/* Expanded content */}
              {expandedId === consent.id && (
                <div className="px-4 py-4 border-t border-white/5 space-y-4">
                  {/* Scopes detail */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-white/70">Autoridades concedidas:</p>
                    <div className="space-y-2">
                      {consent.scope.map((scope) => (
                        <div
                          key={scope}
                          className="p-3 rounded-lg bg-white/3 border border-white/5"
                        >
                          <p className="text-sm font-medium text-white/95">{scopeLabels[scope]}</p>
                          <p className="text-xs text-white/60 mt-1">{scopeDescriptions[scope]}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Revocation section */}
                  {onRevoke && (
                    <div className="pt-4 border-t border-white/5">
                      <label className="block text-xs font-medium text-white/70 mb-2">
                        Motivo da revogação
                      </label>
                      <textarea
                        value={revokeReason[consent.id] || ''}
                        onChange={(e) =>
                          setRevokeReason((prev) => ({
                            ...prev,
                            [consent.id]: e.target.value,
                          }))
                        }
                        disabled={revoking[consent.id]}
                        placeholder="Informe o motivo da revogação (opcional)"
                        className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/95 placeholder-white/40 hover:bg-white/8 transition-colors focus:outline-none focus:border-violet-500/50 disabled:opacity-50 resize-none"
                        rows={3}
                      />
                      <button
                        onClick={() => handleRevoke(consent.id)}
                        disabled={revoking[consent.id]}
                        className="mt-3 w-full px-4 py-2 text-sm font-medium bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/20"
                      >
                        {revoking[consent.id] ? 'Revogando...' : 'Revogar consentimento'}
                      </button>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="pt-4 border-t border-white/5 space-y-2 text-xs text-white/50">
                    {consent.metadata?.termsVersion && (
                      <p>Versão de termos: {consent.metadata.termsVersion}</p>
                    )}
                    {consent.ipAddress && (
                      <p>IP: {consent.ipAddress.substring(0, 10)}... (anônimizado)</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-lg border border-white/8 bg-white/2 text-center">
          <p className="text-sm text-white/60">
            Nenhum consentimento ativo. Você pode autorizar processamento com IA a qualquer momento.
          </p>
        </div>
      )}

      {/* LGPD Info */}
      <div className="p-4 rounded-lg bg-white/2 border border-white/8">
        <p className="text-xs text-white/70">
          <strong>Seus direitos LGPD:</strong> Você pode revogar consentimentos a qualquer momento.
          Revogações futuras não afetam dados já processados, conforme LGPD Art. 8º, §3º.
        </p>
      </div>
    </div>
  );
};
