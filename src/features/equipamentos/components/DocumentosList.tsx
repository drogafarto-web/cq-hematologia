/**
 * DocumentosList - lista de documentos vinculados a um equipamento.
 * Download direto, soft-delete com confirmacao.
 */

import React, { useCallback, useState } from 'react';
import { useDocumentos } from '../hooks/useDocumentos';
import { getDocumentoDownloadUrl, softDeleteDocumento } from '../services/documentoService';
import type { EquipamentoDocumento, DocumentoTipo } from '../types/EquipamentoDocumento';
import { DOCUMENTO_TIPO_LABEL } from '../types/EquipamentoDocumento';

const TIPO_ICON: Record<DocumentoTipo, string> = {
  nota_fiscal: '📋',
  manual: '📖',
  contrato_manutencao: '📝',
  laudo_manutencao: '🔧',
  certificado_calibracao: '📏',
  qualificacao: '✅',
  outro: '📄',
};

interface DocumentosListProps {
  labId: string | null;
  equipamentoId: string | null;
  onUploadClick?: () => void;
}

export function DocumentosList({ labId, equipamentoId, onUploadClick }: DocumentosListProps) {
  const { documentos, isLoading } = useDocumentos(labId, equipamentoId);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDownload = useCallback(async (doc: EquipamentoDocumento) => {
    setDownloading(doc.id);
    try {
      const url = await getDocumentoDownloadUrl(doc.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(null);
    }
  }, []);

  const handleDelete = useCallback(
    async (docId: string) => {
      if (!labId || !equipamentoId) return;
      try {
        await softDeleteDocumento(labId, equipamentoId, docId);
      } catch (err) {
        console.error('Delete failed:', err);
      }
      setConfirmDelete(null);
    },
    [labId, equipamentoId],
  );

  if (!labId || !equipamentoId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-white/30">
          Documentos ({documentos.length})
        </h3>
        {onUploadClick && (
          <button
            type="button"
            onClick={onUploadClick}
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
          >
            + Upload
          </button>
        )}
      </div>

      {documentos.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400 dark:text-white/25">
          Nenhum documento vinculado.
          {onUploadClick && (
            <button
              type="button"
              onClick={onUploadClick}
              className="block mx-auto mt-2 text-xs text-violet-500 hover:text-violet-600"
            >
              Fazer primeiro upload
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] hover:border-violet-300 dark:hover:border-violet-500/30 transition-colors"
            >
              <span className="text-lg flex-shrink-0">{TIPO_ICON[doc.tipo]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-white/80 truncate">
                  {doc.titulo}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-white/35">
                  {DOCUMENTO_TIPO_LABEL[doc.tipo]} &middot; {doc.uploadedByName} &middot;{' '}
                  {doc.uploadedAt?.toDate?.().toLocaleDateString('pt-BR') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => void handleDownload(doc)}
                  disabled={downloading === doc.id}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                  title="Download"
                >
                  {downloading === doc.id ? (
                    <span className="w-4 h-4 block border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  )}
                </button>
                {confirmDelete === doc.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleDelete(doc.id)}
                      className="px-2 py-1 text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 rounded"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 text-[10px] text-slate-500 rounded"
                    >
                      Nao
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(doc.id)}
                    className="p-1.5 rounded-lg text-slate-400 dark:text-white/25 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Excluir"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
