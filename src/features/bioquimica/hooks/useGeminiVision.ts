/**
 * bioquimica/hooks/useGeminiVision.ts
 *
 * React hook wrapping the parseAnalyteStripImage callable.
 * Manages loading, error, and result state.
 */

import { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { useAuthStore } from '../../../store/useAuthStore';
import type { OCRParsedResult } from '../types/ocrResults';
import type { AnalitoId } from '../types/_shared_refs';

// ─── Hook Types ────────────────────────────────────────────────────────────

export interface UseGeminiVisionState {
  isParsing: boolean;
  result?: OCRParsedResult;
  error?: string;
}

export interface UseGeminiVisionApi {
  state: UseGeminiVisionState;
  parseImage(args: {
    imageStoragePath: string;
    expectedAnalytes: AnalitoId[];
    consentToken: string;
  }): Promise<OCRParsedResult>;
  reset(): void;
}

// ─── Hook Implementation ───────────────────────────────────────────────────

export function useGeminiVision(): UseGeminiVisionApi {
  const [state, setState] = useState<UseGeminiVisionState>({
    isParsing: false,
  });

  const labId = useAuthStore((s) => s.appProfile?.activeLab?.id);

  const parseImage = useCallback(
    async (args: {
      imageStoragePath: string;
      expectedAnalytes: AnalitoId[];
      consentToken: string;
    }): Promise<OCRParsedResult> => {
      if (!labId) {
        throw new Error('No active lab selected');
      }

      setState({ isParsing: true });

      try {
        const callable = httpsCallable<any, OCRParsedResult>(functions, 'parseAnalyteStripImage');

        const result = await callable({
          labId,
          ...args,
        });

        setState({
          isParsing: false,
          result: result.data,
        });

        return result.data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setState({
          isParsing: false,
          error: errorMsg,
        });
        throw err;
      }
    },
    [labId],
  );

  const reset = useCallback(() => {
    setState({ isParsing: false });
  }, []);

  return {
    state,
    parseImage,
    reset,
  };
}
