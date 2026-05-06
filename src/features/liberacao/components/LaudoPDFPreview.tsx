/**
 * LaudoPDFPreview — embeds a generated laudo PDF in an iframe.
 *
 * Lazy generation: shows a "Gerar visualização" CTA until the user
 * triggers it. Avoids unnecessary Puppeteer cold starts on dashboard mount.
 *
 * States:
 *  - idle      → CTA button
 *  - loading   → Skeleton placeholder
 *  - ready     → iframe with the signed URL
 *  - expiring  → ready + warning banner with "Renovar URL"
 *  - error     → error block + "Tentar novamente"
 */
import React, { useEffect } from 'react';
import { usePDFUrl } from '../hooks/usePDFUrl';

interface LaudoPDFPreviewProps {
  labId: string;
  laudoId: string;
  /** Optional: render a specific version (defaults to currentVersion server-side). */
  version?: number;
  /** Auto-generate on mount. Default false (lazy). */
  autoLoad?: boolean;
  /** Tailwind utility for height. Default `h-[80vh]`. */
  heightClass?: string;
}

export function LaudoPDFPreview({
  labId,
  laudoId,
  version,
  autoLoad = false,
  heightClass = 'h-[80vh]',
}: LaudoPDFPreviewProps) {
  const pdf = usePDFUrl();

  useEffect(() => {
    if (autoLoad && pdf.state.status === 'idle') {
      void pdf.generate({ labId, laudoId, version });
    }
    // We intentionally only react to autoLoad change; subsequent renders
    // shouldn't re-trigger generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  const handleGenerate = () => {
    void pdf.generate({ labId, laudoId, version });
  };

  const handleRefresh = () => {
    void pdf.refresh({ labId, laudoId, version });
  };

  if (pdf.state.status === 'idle') {
    return (
      <div
        className={`flex ${heightClass} items-center justify-center rounded-lg border border-white/10 bg-[#141417]`}
      >
        <button
          onClick={handleGenerate}
          className="rounded-md bg-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-violet-500/20 transition hover:bg-violet-400"
        >
          Gerar visualização do laudo
        </button>
      </div>
    );
  }

  if (pdf.isLoading) {
    return (
      <div
        className={`flex ${heightClass} flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-[#141417] text-sm text-white/60`}
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-violet-500" />
        Gerando PDF — isso pode levar alguns segundos.
      </div>
    );
  }

  if (pdf.state.status === 'error') {
    return (
      <div
        className={`flex ${heightClass} flex-col items-center justify-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 text-sm text-red-300`}
      >
        <p>Não foi possível gerar o PDF.</p>
        <p className="text-xs text-red-300/70">{pdf.error}</p>
        <button
          onClick={handleRefresh}
          className="rounded-md border border-red-400/40 px-4 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/20"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Ready
  return (
    <div className="flex flex-col gap-2">
      {pdf.isExpiringSoon && (
        <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <span>Link expirando em breve.</span>
          <button
            onClick={handleRefresh}
            className="rounded border border-amber-300/40 px-2 py-1 text-xs hover:bg-amber-500/20"
          >
            Renovar URL
          </button>
        </div>
      )}
      <iframe
        title={`Laudo ${laudoId} v${pdf.result?.version ?? ''}`}
        src={pdf.signedUrl ?? ''}
        className={`w-full ${heightClass} rounded-lg border border-white/10 bg-white`}
      />
    </div>
  );
}

export default LaudoPDFPreview;
