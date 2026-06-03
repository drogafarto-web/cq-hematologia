/**
 * useAuditReportExport — Hook for exporting audit report PDFs
 *
 * Calls generateAuditReportPDF Cloud Function and manages download state.
 * Complies with RDC 978 requirements for audit report PDF export.
 */

import { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';

export interface UseAuditReportExportResult {
  /** Export audit session to PDF */
  exportPDF: (
    auditoriaId: string,
    sessaoId: string,
  ) => Promise<{ pdfUrl: string; filename: string }>;
  /** Download PDF from signed URL */
  downloadPDF: (pdfUrl: string, filename: string) => void;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Progress message */
  message: string;
}

/**
 * Hook to export audit report to PDF
 *
 * Returns pdfUrl (signed Cloud Storage URL valid for 7 days).
 * Handles PDF size validation (<10MB) server-side.
 */
export function useAuditReportExport(): UseAuditReportExportResult {
  const labId = useActiveLabId();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');

  const exportPDF = useCallback(
    async (
      auditoriaId: string,
      sessaoId: string,
    ): Promise<{ pdfUrl: string; filename: string }> => {
      if (!labId) {
        throw new Error('Lab not active');
      }

      setIsLoading(true);
      setError(null);
      setMessage('Gerando relatório de auditoria...');

      try {
        const callable = httpsCallable(functions, 'generateAuditInternaPDF');
        const result = await callable({
          labId,
          auditoriaId,
          sessaoId,
        });

        const data = result.data as any;

        if (!data.success) {
          throw new Error(data.error || 'Falha ao gerar PDF');
        }

        setMessage(`PDF gerado com sucesso (${data.pdfSizeMB}MB)`);

        return {
          pdfUrl: data.pdfUrl,
          filename: data.filename,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setMessage('');
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [labId],
  );

  const downloadPDF = useCallback((pdfUrl: string, filename: string) => {
    try {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('Download failed:', error);
    }
  }, []);

  return {
    exportPDF,
    downloadPDF,
    isLoading,
    error,
    message,
  };
}
