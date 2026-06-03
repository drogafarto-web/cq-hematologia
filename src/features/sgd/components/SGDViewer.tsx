import React, { useMemo } from 'react';
import { useSGDDocumento } from '../hooks/useSGDDocumentos';
import { SGDDocumento, SIGLA_LABEL } from '../types/SGDDocumento';
import { cn } from '../../../utils/cn';

interface SGDViewerProps {
  labId: string;
  docId: string;
  inline?: boolean; // inline (modal) vs full-screen
  onClose?: () => void;
}

/**
 * SGDViewer — Display external documents (Drive-hosted)
 * Supports PDF inline preview + metadata sidebar.
 * a11y: keyboard ESC to close, aria-label on buttons.
 */
export const SGDViewer: React.FC<SGDViewerProps> = ({ labId, docId, inline = false, onClose }) => {
  const { data: doc, loading, error } = useSGDDocumento(labId, docId);

  const iframeUrl = useMemo(() => {
    if (!doc?.driveFileId) return null;
    // Google Drive viewer: https://drive.google.com/file/d/{fileId}/view
    return `https://drive.google.com/file/d/${doc.driveFileId}/preview`;
  }, [doc?.driveFileId]);

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-200">
        Erro ao carregar documento: {error.message}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-[#141417] text-white',
        inline
          ? 'rounded-lg border border-white/10 p-4 h-[600px]'
          : 'fixed inset-0 z-50 flex flex-col',
      )}
      role={inline ? 'dialog' : 'main'}
      aria-label={doc?.titulo || 'Document Viewer'}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
        <div className="flex-1">
          {loading ? (
            <div className="h-6 w-48 bg-white/10 rounded animate-pulse" />
          ) : (
            <>
              <h2 className="text-lg font-semibold">{doc?.titulo}</h2>
              {doc?.descricao && <p className="text-sm text-white/60 mt-1">{doc.descricao}</p>}
            </>
          )}
        </div>

        {onClose && !inline && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Fechar visualizador"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 overflow-auto', inline ? '' : 'grid grid-cols-3 gap-4')}>
        {/* PDF/Document Preview */}
        {loading ? (
          <div className="bg-white/5 rounded-lg animate-pulse h-full" />
        ) : iframeUrl ? (
          <iframe
            src={iframeUrl}
            className={cn('rounded-lg', inline ? 'w-full h-full' : 'col-span-2 h-full')}
            title={doc?.titulo}
            allow="encrypted-media"
          />
        ) : (
          <div className="bg-white/5 rounded-lg p-6 flex items-center justify-center text-white/60">
            <p>Visualização não disponível para tipo: {doc?.mimeType}</p>
          </div>
        )}

        {/* Metadata Sidebar (full-screen only) */}
        {!inline && doc && (
          <div className="col-span-1 bg-white/5 rounded-lg p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* File Info */}
              <div>
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
                  Arquivo
                </h3>
                <p className="text-sm text-white/80 truncate" title={doc.driveFileName}>
                  {doc.driveFileName}
                </p>
              </div>

              {/* Category */}
              {doc.categoriaICQ && (
                <div>
                  <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
                    Bloco DICQ
                  </h3>
                  <span className="inline-block bg-violet-900/30 text-violet-200 px-2 py-1 rounded text-xs font-medium">
                    Bloco {doc.categoriaICQ}
                  </span>
                </div>
              )}

              {/* Sigla (External Document Classification) */}
              {doc.sigla && (
                <div>
                  <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
                    Classificação
                  </h3>
                  <span className="inline-block bg-emerald-900/30 text-emerald-200 px-2 py-1 rounded text-xs font-medium">
                    {doc.sigla}
                  </span>
                  <p className="text-xs text-white/50 mt-1">{SIGLA_LABEL[doc.sigla]}</p>
                  {doc.codigoExterno && (
                    <p className="text-sm text-white/80 mt-1 font-mono">{doc.codigoExterno}</p>
                  )}
                  {doc.orgaoEmissor && (
                    <p className="text-xs text-white/50 mt-1">{doc.orgaoEmissor}</p>
                  )}
                </div>
              )}

              {/* Created */}
              <div>
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
                  Criado
                </h3>
                <p className="text-sm text-white/80">
                  {doc.criadoEm?.toDate().toLocaleDateString('pt-BR')}
                </p>
              </div>

              {/* Links */}
              {doc.linksConfirmados && doc.linksConfirmados.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
                    Vinculado a
                  </h3>
                  <div className="space-y-1">
                    {doc.linksConfirmados.map((link) => (
                      <div
                        key={`${link.targetModule}-${link.targetId}`}
                        className="text-sm text-emerald-300"
                      >
                        {link.targetModule}: {link.targetNome}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
