import React, { useState } from 'react';
import { ANALYTE_MAP } from '../../constants';
import type { Run, WestgardViolation } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M12 3.5l-.8 8a1 1 0 01-1 .9H3.8a1 1 0 01-1-.9L2 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon({ uploading }: { uploading?: boolean }) {
  if (uploading) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden
        className="animate-spin text-white/30"
      >
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="8 6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 5a1 1 0 011-1h1l1-1.5h5L10.5 4h1a1 1 0 011 1v5.5a1 1 0 01-1 1h-9a1 1 0 01-1-1V5z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ─── Image audit modal ────────────────────────────────────────────────────────

interface ImageModalProps {
  imageUrl: string;
  run: Run;
  onClose: () => void;
}

function ImageAuditModal({ imageUrl, run, onClose }: ImageModalProps) {
  const ts = new Date(run.timestamp);
  const label = ts.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 flex flex-col max-w-3xl w-full max-h-[90vh] rounded-2xl border border-white/[0.09] bg-[#0e0e10] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <CameraIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/90">Evidência Fotográfica</p>
              <p className="text-xs text-white/40 mt-0.5">{label}{run.sampleId ? ` · ${run.sampleId}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-violet-400/70 hover:text-violet-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-violet-500/10"
            >
              Abrir original
            </a>
            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar modal"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-all"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
          <img
            src={imageUrl}
            alt={`Foto da corrida — ${label}`}
            className="max-w-full max-h-full rounded-xl object-contain border border-white/[0.07]"
          />
        </div>

        {/* Footer: status + violations */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-white/[0.07] shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
            run.status === 'Aprovada'  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
            run.status === 'Rejeitada' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                                         'bg-amber-500/15 text-amber-400 border-amber-500/20'
          }`}>
            {run.status}
          </span>
          {run.manualOverride && (
            <span className="text-[10px] text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded">Manual</span>
          )}
          <span className="text-xs text-white/25 ml-auto">
            {run.results.length} analitos extraídos
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  Aprovada:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Rejeitada: 'bg-red-500/15     text-red-400     border-red-500/20',
  Pendente:  'bg-amber-500/15   text-amber-400   border-amber-500/20',
};

function StatusBadge({ status }: { status: Run['status'] }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ─── Westgard violation chip ──────────────────────────────────────────────────

const VIOLATION_STYLES: Record<WestgardViolation, string> = {
  '1-2s': 'bg-amber-500/15 text-amber-400/80',
  '1-3s': 'bg-red-500/15   text-red-400/80',
  '2-2s': 'bg-red-500/15   text-red-400/80',
  'R-4s': 'bg-red-500/15   text-red-400/80',
  '4-1s': 'bg-red-500/15   text-red-400/80',
  '10x':  'bg-red-500/15   text-red-400/80',
};

function ViolationChip({ v }: { v: WestgardViolation }) {
  return (
    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${VIOLATION_STYLES[v]}`}>
      {v}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RunItemProps {
  run:      Run;
  index:    number;
  onDelete: (runId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RunItem({ run, index, onDelete }: RunItemProps) {
  const [expanded,      setExpanded]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showImage,     setShowImage]     = useState(false);

  const ts = new Date(run.timestamp);
  const formattedDate = ts.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const formattedTime = ts.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });

  const allViolations = [
    ...new Set(run.results.flatMap((r) => r.violations)),
  ] as WestgardViolation[];

  // imageUrl is set asynchronously after upload; empty string means in-progress
  const imageReady    = Boolean(run.imageUrl);
  const imageUploading = !imageReady;

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(run.id);
  }

  function handleCameraClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (imageReady) setShowImage(true);
  }

  return (
    <>
      <div className={`rounded-xl border transition-all ${
        run.status === 'Rejeitada'
          ? 'border-red-500/20 bg-red-500/[0.03]'
          : run.status === 'Aprovada'
          ? 'border-white/[0.06]'
          : 'border-amber-500/20'
      }`}>
        {/* Header row */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-xs font-mono text-white/25 w-6 shrink-0">#{index}</span>

          <StatusBadge status={run.status} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/50">{formattedDate}</span>
              <span className="text-xs text-white/25">{formattedTime}</span>
              {run.sampleId && (
                <span className="text-xs text-white/35 font-mono">{run.sampleId}</span>
              )}
              {run.manualOverride && (
                <span className="text-[10px] text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded">
                  Manual
                </span>
              )}
            </div>
            {allViolations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {allViolations.map((v) => <ViolationChip key={v} v={v} />)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Camera / image audit button — always visible in header */}
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={imageUploading}
              className={`
                flex items-center justify-center w-7 h-7 rounded-lg transition-all
                ${imageReady
                  ? 'text-violet-400/60 hover:text-violet-400 hover:bg-violet-500/10 cursor-pointer'
                  : 'text-white/15 cursor-default'}
              `}
              title={imageReady ? 'Ver imagem original' : 'Enviando imagem…'}
            >
              <CameraIcon uploading={imageUploading} />
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
              className={`
                flex items-center justify-center w-7 h-7 rounded-lg transition-all
                ${confirmDelete
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-white/20 hover:text-white/50 hover:bg-white/[0.06]'}
              `}
              title={confirmDelete ? 'Clique para confirmar' : 'Excluir corrida'}
            >
              <TrashIcon />
            </button>

            <span className="text-white/25">
              <ChevronIcon open={expanded} />
            </span>
          </div>
        </div>

        {/* Expanded: analyte table */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-white/[0.05]">
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/25">
                    <th className="text-left pb-2 font-medium">Analito</th>
                    <th className="text-right pb-2 font-medium">Valor</th>
                    <th className="text-left pb-2 pl-2 font-medium">Unidade</th>
                    <th className="text-right pb-2 font-medium">Alertas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {run.results.map((r) => {
                    const analyte = ANALYTE_MAP[r.analyteId];
                    if (!analyte) return null;
                    return (
                      <tr key={r.id}>
                        <td className="py-1.5 text-white/60 font-medium">{analyte.name}</td>
                        <td className={`py-1.5 text-right font-mono ${
                          r.violations.some((v) => v !== '1-2s')
                            ? 'text-red-400'
                            : r.violations.includes('1-2s')
                            ? 'text-amber-400'
                            : 'text-white/80'
                        }`}>
                          {r.value.toFixed(analyte.decimals)}
                        </td>
                        <td className="py-1.5 pl-2 text-white/25">{analyte.unit}</td>
                        <td className="py-1.5 text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {r.violations.map((v) => <ViolationChip key={v} v={v} />)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Image row: spinner while uploading, button when ready */}
            <div className="mt-3">
              {imageUploading ? (
                <span className="flex items-center gap-1.5 text-xs text-white/25">
                  <CameraIcon uploading />
                  Enviando imagem…
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowImage(true); }}
                  className="flex items-center gap-1.5 text-xs text-violet-400/70 hover:text-violet-400 transition-colors"
                >
                  <CameraIcon />
                  Ver imagem original
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Image audit modal — portal-like, rendered outside the list item */}
      {showImage && imageReady && (
        <ImageAuditModal
          imageUrl={run.imageUrl}
          run={run}
          onClose={() => setShowImage(false)}
        />
      )}
    </>
  );
}
