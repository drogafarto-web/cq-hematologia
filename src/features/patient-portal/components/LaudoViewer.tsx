import React, { useState } from 'react';
import { LaudoDownloadButton } from './LaudoDownloadButton';
import type { PatientPortalLaudo } from '../types/index';

interface LaudoViewerProps {
  laudo: PatientPortalLaudo;
  isOpen: boolean;
  onClose: () => void;
  pdfUrl?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

/**
 * LaudoViewer — Full-screen modal or page view for laudo detail
 *
 * Displays laudo HTML/PDF embedded
 * Toolbar: close, download, print buttons
 * Breadcrumbs for navigation
 * Session timeout warning (Phase 5 Wave 2)
 *
 * Usage:
 *   <LaudoViewer laudo={laudo} isOpen={true} onClose={handleClose} />
 */

export const LaudoViewer = React.memo(function LaudoViewer({
  laudo,
  isOpen,
  onClose,
  pdfUrl,
  breadcrumbs = [
    { label: 'Dashboard', href: '/portal' },
    { label: laudo.nome },
  ],
}: LaudoViewerProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    setIsPrinting(false);
  };

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedDate = dateFormatter.format(laudo.dataResultado.toDate());

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 print:hidden"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="
          fixed inset-4 top-8 bottom-8 z-50 flex flex-col
          bg-white/10 backdrop-blur-md border border-white/20 rounded-xl
          overflow-hidden
          print:inset-0 print:border-0 print:rounded-none print:bg-white print:text-black
        "
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 print:hidden">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {breadcrumbs.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                {item.href ? (
                  <a href={item.href} className="text-blue-400 hover:text-blue-300">
                    {item.label}
                  </a>
                ) : (
                  <span className="text-white">{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <LaudoDownloadButton laudo={laudo} pdfUrl={pdfUrl} />

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="
                inline-flex items-center gap-2 px-4 py-2 rounded-lg
                bg-slate-500/20 text-slate-300 hover:bg-slate-500/30
                text-sm font-medium transition-colors
                border border-slate-500/30
                disabled:opacity-50
              "
              aria-label="Imprimir laudo"
            >
              <span>🖨</span>
              <span>Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="
                inline-flex items-center justify-center
                w-8 h-8 rounded-lg
                bg-red-500/20 text-red-300 hover:bg-red-500/30
                transition-colors border border-red-500/30
              "
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 print:p-0">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8 pb-8 border-b border-white/10 print:border-gray-300">
              <h1 className="text-3xl font-bold text-white mb-2 print:text-black">
                {laudo.nome}
              </h1>
              <p className="text-sm text-slate-400 print:text-gray-600">
                <strong>Laborat
ório:</strong> {laudo.labName || 'Não informado'}
              </p>
              <p className="text-sm text-slate-400 print:text-gray-600">
                <strong>Data do resultado:</strong> {formattedDate}
              </p>
              {laudo.medicoSolicitanteName && (
                <p className="text-sm text-slate-400 print:text-gray-600">
                  <strong>Médico solicitante:</strong> {laudo.medicoSolicitanteName}
                </p>
              )}
            </div>

            {/* Exames Table */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4 print:text-black">
                Resultados
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse print:text-black">
                  <thead>
                    <tr className="border-b border-white/10 print:border-gray-300">
                      <th className="text-left px-4 py-3 font-semibold text-slate-300 print:text-black">
                        Analíto
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-300 print:text-black">
                        Valor
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-300 print:text-black">
                        Unidade
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-300 print:text-black">
                        Referência
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {laudo.exames.map((exame) => (
                      <tr
                        key={exame.analito}
                        className="border-b border-white/6 hover:bg-white/3 print:border-gray-200 print:hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-white print:text-black">{exame.analito}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-300 print:text-black">
                          {exame.valor}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 print:text-gray-600">
                          {exame.unidade}
                        </td>
                        <td className="px-4 py-3 text-slate-400 print:text-gray-600">
                          {exame.valoresReferencia}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-8 border-t border-white/10 text-xs text-slate-500 print:border-gray-300 print:text-gray-600">
              <p>
                <strong>ID do laudo:</strong> {laudo.id}
              </p>
              {laudo.signatureHash && (
                <p className="mt-2">
                  <strong>Hash de validação:</strong> {laudo.signatureHash.substring(0, 32)}...
                </p>
              )}
              <p className="mt-4 italic">
                Confidencial. Destinado apenas ao paciente. Em caso de dúvidas, entre em contato
                com o laboratório.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
