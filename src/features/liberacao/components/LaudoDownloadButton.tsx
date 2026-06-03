/**
 * LaudoDownloadButton — primary action to download a laudo PDF.
 *
 * Calls generateLaudoPDF callable, then triggers a browser download
 * via signed URL. Tooltip warns about 1h expiration.
 */
import React, { useState } from 'react';
import { downloadLaudoPDF } from '../services/pdfService';

interface LaudoDownloadButtonProps {
  labId: string;
  laudoId: string;
  version?: number;
  className?: string;
  /** Optional callback invoked after a successful download trigger. */
  onSuccess?: () => void;
  /** Optional callback invoked on failure. */
  onError?: (error: Error) => void;
}

export function LaudoDownloadButton({
  labId,
  laudoId,
  version,
  className,
  onSuccess,
  onError,
}: LaudoDownloadButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setStatus('loading');
    setError(null);
    try {
      await downloadLaudoPDF({ labId, laudoId, version });
      setStatus('idle');
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao baixar PDF';
      setStatus('error');
      setError(message);
      if (err instanceof Error) onError?.(err);
    }
  };

  const baseClass =
    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'loading'}
        title="O link de download expira em 1 hora."
        className={`${baseClass} bg-violet-500 text-white shadow-md shadow-violet-500/20 hover:bg-violet-400 ${className ?? ''}`}
      >
        {status === 'loading' ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Gerando…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Baixar PDF
          </>
        )}
      </button>
      {status === 'error' && error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}

export default LaudoDownloadButton;
