/**
 * CAPAEvidenceList.tsx
 *
 * Modal/drawer showing evidence artifacts linked to a CAPA.
 * Evidence stored in Cloud Storage with chain-hash validation.
 */

import { useState } from 'react';
import type { CAPAEvidenceRef } from '../types';

interface CAPAEvidenceListProps {
  evidence: CAPAEvidenceRef[];
  capaId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mapa de tipos de evidência → ícone + label.
 */
const EVIDENCE_TYPE_CONFIG: Record<
  NonNullable<CAPAEvidenceRef['type']>,
  { label: string; icon: string }
> = {
  'foto': { label: 'Foto', icon: '📸' },
  'documento': { label: 'Documento', icon: '📄' },
  'certificado': { label: 'Certificado', icon: '✓' },
  'pop': { label: 'POP', icon: '📋' },
  'treinamento': { label: 'Treinamento', icon: '👨‍🎓' },
};

export function CAPAEvidenceList({
  evidence,
  capaId,
  isOpen,
  onClose,
}: CAPAEvidenceListProps) {
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`evidence-modal-${capaId}`}
    >
      <div className="bg-[#141417] rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1f] px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 id={`evidence-modal-${capaId}`} className="text-lg font-semibold">
              Evidências (
              {evidence.length})
            </h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white/100 transition-colors"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Evidence List */}
        {evidence.length === 0 ? (
          <div className="px-6 py-8 text-center text-white/60">
            Nenhuma evidência carregada
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {evidence.map((ev) => {
              const config = ev.type ? EVIDENCE_TYPE_CONFIG[ev.type] : { label: 'Arquivo', icon: '📄' };
              const date = new Date(ev.uploadedAt);

              return (
                <li
                  key={ev.hash}
                  className="px-6 py-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-xl mt-0.5" aria-hidden="true">
                        {config.icon}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">
                          {config.label}
                        </h3>
                        {ev.filename && (
                          <p className="text-xs text-white/60 mt-1">
                            {ev.filename}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-white/50">
                            {new Intl.DateTimeFormat('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(date)}
                          </span>
                          {ev.uploadedBy && (
                            <span className="text-xs text-white/40">
                              por {ev.uploadedBy}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hash toggle */}
                    <button
                      onClick={() =>
                        setSelectedHash(selectedHash === ev.hash ? null : ev.hash)
                      }
                      className="text-xs text-violet-400 hover:text-violet-300 whitespace-nowrap transition-colors"
                      aria-label="Ver hash"
                    >
                      Hash
                    </button>
                  </div>

                  {/* Hash display when selected */}
                  {selectedHash === ev.hash && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <code className="text-xs text-white/60 break-all font-mono">
                        {ev.hash}
                      </code>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#1a1a1f] px-6 py-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
