import React from 'react';
import { StatusBadge } from './StatusBadge';
import { LaudoDownloadButton } from './LaudoDownloadButton';
import type { PatientPortalLaudo } from '../types/index';

interface LaudoCardProps {
  laudo: PatientPortalLaudo;
  onView?: (laudo: PatientPortalLaudo) => void;
  onDownload?: (laudo: PatientPortalLaudo) => void;
  pdfUrl?: string;
}

/**
 * LaudoCard — Mobile-responsive card view for single laudo
 *
 * Shows: exam icon, name, date (PT-BR), status badge, action buttons
 * Tap → open viewer modal or navigate to detail page
 *
 * Dark-first design, responsive grid layout
 * Usage:
 *   <LaudoCard laudo={laudo} onView={handleView} />
 */

export const LaudoCard = React.memo(function LaudoCard({
  laudo,
  onView,
  onDownload,
  pdfUrl,
}: LaudoCardProps) {
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedDate = dateFormatter.format(laudo.dataResultado.toDate());

  return (
    <div
      className="
        rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm
        p-4 hover:bg-white/6 hover:border-white/12 transition-all
        dark:bg-white/3 dark:border-white/10
      "
    >
      {/* Header: Exam name + Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-white leading-snug mb-1">
            {laudo.nome}
          </h3>
          <p className="text-xs text-slate-400">{formattedDate}</p>
        </div>

        <StatusBadge status={laudo.status} criticoFlag={laudo.criticoFlag} />
      </div>

      {/* Exam count */}
      {laudo.exames.length > 0 && (
        <div className="mb-3 text-xs text-slate-500">
          {laudo.exames.length} {laudo.exames.length === 1 ? 'análise' : 'análises'}
        </div>
      )}

      {/* Quick sample of analitos */}
      {laudo.exames.length > 0 && (
        <div className="mb-4 space-y-1">
          {laudo.exames.slice(0, 2).map((exame) => (
            <div key={exame.analito} className="text-xs text-slate-400">
              <span className="font-mono">{exame.analito}:</span>
              <span className="ml-2">{exame.valor}</span>
              {exame.unidade && <span className="ml-1 text-slate-500">{exame.unidade}</span>}
            </div>
          ))}
          {laudo.exames.length > 2 && (
            <div className="text-xs text-slate-500 italic">
              +{laudo.exames.length - 2} mais
            </div>
          )}
        </div>
      )}

      {/* Separator */}
      <div className="h-px bg-white/6 mb-4" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onView?.(laudo)}
          className="
            flex-1 px-3 py-2 rounded-lg
            bg-blue-500/20 text-blue-300 hover:bg-blue-500/30
            text-xs font-medium transition-colors
            border border-blue-500/30
          "
          aria-label={`Ver resultado de ${laudo.nome}`}
        >
          Ver
        </button>

        <div className="flex-1">
          <LaudoDownloadButton
            laudo={laudo}
            pdfUrl={pdfUrl}
            onDownloadComplete={() => onDownload?.(laudo)}
          />
        </div>
      </div>

      {/* Medical disclaimer (for critical results) */}
      {laudo.criticoFlag && laudo.status === 'FINALIZADO' && (
        <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-300">
            ⚠ Resultado crítico — Contate seu médico imediatamente.
          </p>
        </div>
      )}
    </div>
  );
});
