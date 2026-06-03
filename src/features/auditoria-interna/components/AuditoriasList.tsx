import React, { useState } from 'react';
import { useAuditReportExport } from '../hooks/useAuditReportExport';
import { useSessao } from '../hooks/useAuditorias';
import type { Auditoria } from '../types';

interface AuditoriasListProps {
  auditorias: Auditoria[];
}

export function AuditoriasList({ auditorias }: AuditoriasListProps) {
  const { exportPDF, downloadPDF, isLoading, error, message } = useAuditReportExport();
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportPDF = async (auditoriaId: string, sessaoId: string, filename: string) => {
    try {
      setExportError(null);
      const { pdfUrl } = await exportPDF(auditoriaId, sessaoId);
      downloadPDF(pdfUrl, filename);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao exportar PDF';
      setExportError(errorMsg);
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Histórico de Auditorias</h2>
      {auditorias.length === 0 ? (
        <div className="border border-white/10 rounded-lg p-12 text-center">
          <p className="text-white/60">Nenhuma auditoria finalizada</p>
        </div>
      ) : (
        auditorias.map((auditoria) => (
          <div
            key={auditoria.id}
            className="border border-white/10 rounded-lg overflow-hidden bg-white/5"
          >
            {/* Header */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-medium">Auditoria {auditoria.ano}</p>
                  <p className="text-sm text-white/70 mt-2">
                    Finalizada em:{' '}
                    {new Date(auditoria.criadoEm.toDate()).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-sm text-white/70">
                    Responsável: {auditoria.responsavelTecnico}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setExpandedAuditId(expandedAuditId === auditoria.id ? null : auditoria.id)
                  }
                  className="px-3 py-1 rounded text-sm bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {expandedAuditId === auditoria.id ? 'Fechar' : 'Ver Detalhes'}
                </button>
              </div>
            </div>

            {/* Expanded content with sessions */}
            {expandedAuditId === auditoria.id && (
              <AuditoriaSessionsList
                auditoriaId={auditoria.id}
                onExport={handleExportPDF}
                isLoading={isLoading}
                message={message}
                error={exportError}
              />
            )}
          </div>
        ))
      )}

      {error && (
        <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/10 text-red-400">
          <p className="text-sm">{error.message}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Sessions list for a specific auditoria with export buttons
 */
function AuditoriaSessionsList({
  auditoriaId,
  onExport,
  isLoading,
  message,
  error,
}: {
  auditoriaId: string;
  onExport: (auditoriaId: string, sessaoId: string, filename: string) => Promise<void>;
  isLoading: boolean;
  message: string;
  error: string | null;
}) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // TODO: Implement session loading via useAuditSessions hook
  // For now, showing placeholder

  return (
    <div className="border-t border-white/10 p-4 bg-white/[0.02] space-y-3">
      <div className="text-sm text-white/70">
        <p className="mb-3">Sessões de auditoria disponíveis para exportação:</p>
        <div className="space-y-2">
          {/* Placeholder for sessions - in production, these would be loaded from DB */}
          <div className="border border-white/10 rounded p-3 bg-white/5">
            <div className="flex justify-between items-center">
              <span className="text-white/90">Sessão 1</span>
              <button
                disabled={isLoading}
                onClick={() =>
                  onExport(auditoriaId, 'session-1', `relatorio-auditoria-${auditoriaId}.pdf`)
                }
                className="px-3 py-1 text-xs rounded bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/50 text-white transition-colors"
              >
                {isLoading ? 'Gerando...' : 'Exportar PDF'}
              </button>
            </div>
            {message && <p className="text-xs text-violet-400 mt-2">{message}</p>}
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
