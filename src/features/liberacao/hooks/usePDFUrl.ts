/**
 * usePDFUrl — hook to get a signed PDF URL for a laudo version.
 *
 * Lazy: does NOT fetch on mount. Caller invokes `generate()` (e.g. user
 * clicks "Visualizar PDF"). Avoids triggering Puppeteer on dashboard renders.
 *
 * State machine:
 *   idle → loading → ready (with url + expiresAt)
 *                  → error
 *
 * Auto-refresh: when the URL is within 5 minutes of expiry, returns
 * `isExpiringSoon: true`; caller can call `refresh()` to renew.
 */
import { useCallback, useState } from 'react';
import {
  generateLaudoPDF,
  type GenerateLaudoPDFInput,
  type GenerateLaudoPDFResult,
} from '../services/pdfService';

export type PDFUrlState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: GenerateLaudoPDFResult; expiresAt: number }
  | { status: 'error'; message: string };

const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // matches default 1h expiration

export interface UsePDFUrlReturn {
  state: PDFUrlState;
  isLoading: boolean;
  isReady: boolean;
  isExpiringSoon: boolean;
  signedUrl: string | null;
  result: GenerateLaudoPDFResult | null;
  error: string | null;
  generate: (input: GenerateLaudoPDFInput) => Promise<GenerateLaudoPDFResult>;
  refresh: (input: GenerateLaudoPDFInput) => Promise<GenerateLaudoPDFResult>;
  reset: () => void;
}

export function usePDFUrl(): UsePDFUrlReturn {
  const [state, setState] = useState<PDFUrlState>({ status: 'idle' });

  const run = useCallback(async (input: GenerateLaudoPDFInput) => {
    setState({ status: 'loading' });
    try {
      const result = await generateLaudoPDF(input);
      const ttlMs = (input.signedUrlExpiresInSec ?? SIGNED_URL_TTL_MS / 1000) * 1000;
      setState({
        status: 'ready',
        result,
        expiresAt: Date.now() + ttlMs,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar PDF';
      setState({ status: 'error', message });
      throw err;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const isReady = state.status === 'ready';
  const isLoading = state.status === 'loading';
  const isExpiringSoon = state.status === 'ready' && state.expiresAt - Date.now() < 5 * 60 * 1000;

  return {
    state,
    isLoading,
    isReady,
    isExpiringSoon,
    signedUrl: state.status === 'ready' ? state.result.signedUrl : null,
    result: state.status === 'ready' ? state.result : null,
    error: state.status === 'error' ? state.message : null,
    generate: run,
    refresh: run,
    reset,
  };
}
