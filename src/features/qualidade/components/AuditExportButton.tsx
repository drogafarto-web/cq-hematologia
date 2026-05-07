/**
 * AuditExportButton.tsx
 *
 * Export audit trail as CSV or PDF with HMAC-SHA256 signature.
 * Opens popover on click, user selects format, button handles download initiation
 * and toast feedback (exporting, success, error).
 *
 * Props:
 * - labId: tenant identifier
 * - filters: AuditTrailFilters (modulo, operadorId, resultado, dateRange)
 *
 * Compliance: RDC 978 Art. 5.3 — signed, timestamped, immutable export
 */

import React, { useState, useRef } from 'react';
import { callExportAuditTrail } from '../services/auditCallables';
import type { LabId } from '../types/shared_refs';
import type { AuditTrailFilters } from '../types/auditUI';

interface AuditExportButtonProps {
  labId: LabId;
  filters: AuditTrailFilters;
}

export function AuditExportButton({ labId, filters }: AuditExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [showPopover, setShowPopover] = useState(false);
  const [toast, setToast] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleExport = async () => {
    if (!labId) {
      setToast({
        type: 'error',
        message: 'Lab ID é obrigatório',
      });
      return;
    }

    setExporting(true);
    setToast({
      type: 'info',
      message: `Exportando ${format.toUpperCase()}...`,
    });

    try {
      const response = await callExportAuditTrail({
        labId,
        formato: format,
        dataInicio: filters.dataInicio ? filters.dataInicio.getTime() : undefined,
        dataFim: filters.dataFim ? filters.dataFim.getTime() : undefined,
        modulo: filters.modulo,
        operadorId: filters.operadorId,
        resultado: filters.resultado,
      });

      if (!response.success || !response.downloadUrl) {
        throw new Error('Falha ao gerar export');
      }

      // Trigger download
      const link = document.createElement('a');
      link.href = response.downloadUrl;
      link.download = `auditoria-${labId}-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToast({
        type: 'success',
        message: 'Exportado com sucesso',
      });

      // Auto-dismiss success toast
      setTimeout(() => {
        setToast(null);
      }, 3000);

      setShowPopover(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao exportar';
      setToast({
        type: 'error',
        message,
      });
    } finally {
      setExporting(false);
    }
  };

  // Close popover when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPopover]);

  return (
    <div className="relative">
      {/* Export Button */}
      <button
        ref={buttonRef}
        onClick={() => setShowPopover(!showPopover)}
        disabled={exporting}
        className="px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
        aria-label="Exportar auditoria"
        title="Exportar trilha de auditoria"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Exportar
      </button>

      {/* Popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-white/10 bg-[#1a1a1f] p-4 shadow-2xl z-50"
          role="dialog"
          aria-label="Selecionar formato de exportação"
        >
          <h3 className="text-sm font-medium text-white mb-3">Formato de exportação</h3>

          {/* CSV Option */}
          <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white/5 transition-colors mb-2">
            <input
              type="radio"
              name="export-format"
              value="csv"
              checked={format === 'csv'}
              onChange={() => setFormat('csv')}
              className="w-4 h-4 rounded border border-white/20 accent-violet-500"
              aria-label="Exportar como CSV"
            />
            <div className="flex-1">
              <p className="text-sm text-white font-medium">CSV</p>
              <p className="text-xs text-white/50">Planilha com todas as colunas</p>
            </div>
          </label>

          {/* PDF Option */}
          <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white/5 transition-colors mb-4">
            <input
              type="radio"
              name="export-format"
              value="pdf"
              checked={format === 'pdf'}
              onChange={() => setFormat('pdf')}
              className="w-4 h-4 rounded border border-white/20 accent-violet-500"
              aria-label="Exportar como PDF"
            />
            <div className="flex-1">
              <p className="text-sm text-white font-medium">PDF</p>
              <p className="text-xs text-white/50">Relatório formatado e assinado</p>
            </div>
          </label>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full px-3 py-2 rounded-lg bg-violet-500 text-white font-medium text-sm hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Processando...' : 'Exportar'}
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 rounded-lg px-4 py-3 text-sm font-medium max-w-sm border transition-all z-50 ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              : toast.type === 'error'
                ? 'bg-red-500/20 border-red-500/30 text-red-400 flex items-start justify-between gap-2'
                : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
          }`}
          role="alert"
        >
          <span>{toast.message}</span>
          {toast.type === 'error' && (
            <button
              onClick={() => handleExport()}
              className="text-xs underline hover:text-red-300 whitespace-nowrap ml-4"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
    </div>
  );
}
