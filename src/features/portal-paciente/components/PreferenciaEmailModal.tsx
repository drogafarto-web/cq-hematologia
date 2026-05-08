/**
 * PreferenciaEmailModal
 * Patient email preference center for notifications
 * Consent changes, new results, export ready
 * WCAG AAA dark-first design
 */

import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';

interface EmailPreferences {
  id?: string;
  labId: string;
  patientId: string;
  consentChanges: boolean;
  newResults: boolean;
  exportReady: boolean;
  weeklyDigest: boolean;
  unsubscribedAt?: Timestamp | null;
  updatedAt: Timestamp;
}

interface PreferenciaEmailModalProps {
  isOpen: boolean;
  labId: string;
  patientId: string;
  onClose: () => void;
  onSave?: (prefs: EmailPreferences) => Promise<void>;
}

export const PreferenciaEmailModal: React.FC<PreferenciaEmailModalProps> = ({
  isOpen,
  labId,
  patientId,
  onClose,
  onSave,
}) => {
  const [prefs, setPrefs] = useState<EmailPreferences>({
    labId,
    patientId,
    consentChanges: true,
    newResults: true,
    exportReady: true,
    weeklyDigest: false,
    updatedAt: undefined as any,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from Firestore on mount
  useEffect(() => {
    if (!isOpen || !labId || !patientId) return;

    const loadPreferences = async () => {
      setIsLoading(true);
      try {
        const db = getFirestore();
        const prefDoc = await getDoc(
          doc(db, `patientPreferences/${labId}/patients/${patientId}`)
        );

        if (prefDoc.exists()) {
          setPrefs(prefDoc.data() as EmailPreferences);
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [isOpen, labId, patientId]);

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(prefs);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao salvar preferências'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dark overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-40 transition-opacity"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal card */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4">
        <div className="bg-[#1a1a1e] rounded-lg border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white/95">
              Preferências de Email
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Escolha quais notificações você deseja receber
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Preference Options */}
                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.consentChanges}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        consentChanges: e.target.checked,
                      })
                    }
                    disabled={isSaving}
                    className="mt-1 w-5 h-5 rounded border-white/30 accent-violet-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/95">
                      Alterações de Consentimento
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Notificações quando você revoga ou altera consentimentos
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.newResults}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        newResults: e.target.checked,
                      })
                    }
                    disabled={isSaving}
                    className="mt-1 w-5 h-5 rounded border-white/30 accent-violet-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/95">
                      Novos Resultados
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Notificações quando novos resultados estão disponíveis
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.exportReady}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        exportReady: e.target.checked,
                      })
                    }
                    disabled={isSaving}
                    className="mt-1 w-5 h-5 rounded border-white/30 accent-violet-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/95">
                      Exportação Pronta
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Notificações quando seus dados estão prontos para download
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.weeklyDigest}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        weeklyDigest: e.target.checked,
                      })
                    }
                    disabled={isSaving}
                    className="mt-1 w-5 h-5 rounded border-white/30 accent-violet-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/95">
                      Resumo Semanal
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Resumo semanal de todas as suas atividades no portal
                    </p>
                  </div>
                </label>

                {/* Error state */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/12 border border-red-500/30">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {/* Legal notice */}
                <div className="p-3 rounded-lg bg-white/2 border border-white/5">
                  <p className="text-xs text-white/60">
                    Mesmo que desabilite notificações, você continuará recebendo
                    mensagens críticas de segurança e alterações de conta conforme
                    exigido por lei.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/5 flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white/95 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !onSave}
              className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Salvando...' : 'Salvar Preferências'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
