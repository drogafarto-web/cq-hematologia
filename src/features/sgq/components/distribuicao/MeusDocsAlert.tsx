/**
 * MeusDocsAlert.tsx
 *
 * Banner: "Você tem N docs novos no seu setor"
 * Click → drawer with list; mark as read.
 */

import { useMemo, useState } from 'react';
import type { StatusVigencia } from '../lm/StatusVigenciaBadge';

interface DocumentoDistribuicao {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  setoresDistribuidos: string[];
}

interface MeusDocsAlertProps {
  userSetores: string[];
  documentos: DocumentoDistribuicao[];
  onDocumentClick?: (id: string) => void;
}

export function MeusDocsAlert({
  userSetores,
  documentos,
  onDocumentClick,
}: MeusDocsAlertProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const myDocs = useMemo(() => {
    return documentos.filter(doc =>
      doc.setoresDistribuidos.some(s => userSetores.includes(s))
    );
  }, [documentos, userSetores]);

  if (dismissed || myDocs.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Banner */}
      <div className="px-4 py-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-white font-medium">
                Você tem <span className="font-bold text-violet-400">{myDocs.length}</span> documento{myDocs.length !== 1 ? 's' : ''} novo{myDocs.length !== 1 ? 's' : ''} no seu setor
              </p>
              <p className="text-white/60 text-xs mt-1">Clique para visualizar a lista completa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Drawer */}
        {isOpen && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            {myDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => {
                  onDocumentClick?.(doc.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm"
              >
                <div className="font-mono text-xs text-white/70">{doc.codigo}</div>
                <div className="text-white text-sm truncate mt-0.5">{doc.titulo}</div>
                <div className="text-xs text-white/50 mt-1">
                  {doc.setoresDistribuidos.filter(s => userSetores.includes(s)).join(', ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
