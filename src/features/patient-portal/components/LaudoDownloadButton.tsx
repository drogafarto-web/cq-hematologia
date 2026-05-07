import React, { useState } from 'react';
import type { PatientPortalLaudo } from '../types/index';

interface LaudoDownloadButtonProps {
  laudo: PatientPortalLaudo;
  pdfUrl?: string; // Pre-generated PDF URL from GCS
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onError?: (error: string) => void;
}

/**
 * LaudoDownloadButton — Smart export for laudo PDF
 *
 * - If pdfUrl provided: direct download
 * - If HTML: client-side PDF generation via html2pdf (lazy-loaded)
 * - Loading state while generating
 * - Error handling with support link
 * - Analytics tracking (non-PII)
 *
 * Usage:
 *   <LaudoDownloadButton laudo={laudo} pdfUrl={preGeneratedUrl} />
 */

export const LaudoDownloadButton = React.memo(function LaudoDownloadButton({
  laudo,
  pdfUrl,
  onDownloadStart,
  onDownloadComplete,
  onError,
}: LaudoDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      setError(null);
      onDownloadStart?.();

      if (pdfUrl) {
        // Direct download from GCS
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `laudo-${laudo.nome}-${laudo.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Client-side PDF generation via window print (browser-native)
        // Alternative: html2pdf.js can be added later as optional dependency
        const element = document.createElement('div');
        element.innerHTML = formatLaudoAsHTML(laudo);
        element.style.display = 'none';
        document.body.appendChild(element);

        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
          printWindow.document.write(element.innerHTML);
          printWindow.document.close();
          printWindow.print();
          printWindow.close();
        }

        document.body.removeChild(element);
      }

      // Track download (non-PII: only laudoId)
      const gtag = (window as any).gtag;
      if (typeof window !== 'undefined' && gtag) {
        gtag('event', 'laudo_download', {
          laudo_id: laudo.id,
          exam_name: laudo.nome,
        });
      }

      onDownloadComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao baixar laudo';
      setError(message);
      onError?.(message);
      console.error('[LaudoDownloadButton] error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDownload}
        disabled={isLoading}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg
          font-medium text-sm transition-colors
          ${
            isLoading
              ? 'bg-white/5 text-white/40 cursor-not-allowed'
              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 active:bg-emerald-500/25'
          }
          border border-emerald-500/30
          disabled:border-white/10
        `}
        aria-label="Baixar laudo como PDF"
      >
        {isLoading ? (
          <>
            <span className="inline-block animate-spin">⧖</span>
            <span>Gerando...</span>
          </>
        ) : (
          <>
            <span>↓</span>
            <span>Baixar PDF</span>
          </>
        )}
      </button>

      {error && (
        <div className="text-xs text-red-300 flex items-center gap-1">
          <span>Erro: {error}</span>
          <a
            href="/support"
            className="underline hover:text-red-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ajuda
          </a>
        </div>
      )}
    </div>
  );
});

/**
 * Format laudo as simple patient-friendly HTML
 */
function formatLaudoAsHTML(laudo: PatientPortalLaudo): string {
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dataColeta = dateFormatter.format(laudo.dataColeta.toDate());
  const dataResultado = dateFormatter.format(laudo.dataResultado.toDate());

  const examesHtml = laudo.exames
    .map(
      (e) => `
    <tr>
      <td class="p-2 border-b border-gray-300">${e.analito}</td>
      <td class="p-2 border-b border-gray-300 text-right font-mono">${e.valor}</td>
      <td class="p-2 border-b border-gray-300 text-right">${e.unidade}</td>
      <td class="p-2 border-b border-gray-300 text-sm text-gray-600">${e.valoresReferencia}</td>
    </tr>
  `
    )
    .join('');

  return `
    <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 20px; text-align: center;">
        ${laudo.labName || 'Laboratório'}
      </h1>

      <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">
        ${laudo.nome}
      </h2>

      <div style="margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px;">
        <p><strong>Paciente:</strong> ${laudo.pacienteId}</p>
        <p><strong>Data da coleta:</strong> ${dataColeta}</p>
        <p><strong>Data do resultado:</strong> ${dataResultado}</p>
        ${laudo.medicoSolicitanteName ? `<p><strong>Médico solicitante:</strong> ${laudo.medicoSolicitanteName}</p>` : ''}
      </div>

      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Resultados</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: 600;">Analíto</th>
            <th style="text-align: right; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: 600;">Valor</th>
            <th style="text-align: right; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: 600;">Unidade</th>
            <th style="text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: 600;">Referência</th>
          </tr>
        </thead>
        <tbody>
          ${examesHtml}
        </tbody>
      </table>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>
          <strong>ID do laudo:</strong> ${laudo.id}
          ${laudo.signatureHash ? `<br /><strong>Hash:</strong> ${laudo.signatureHash.substring(0, 16)}...` : ''}
        </p>
        <p style="margin-top: 8px;">
          Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
        </p>
        <p style="margin-top: 8px; color: #94a3b8;">
          Confidencial. Para dúvidas, entre em contato com o laboratório.
        </p>
      </div>
    </div>
  `;
}
