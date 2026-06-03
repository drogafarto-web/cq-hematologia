import { useEffect, useState, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { POP, POPFilters, POPInput } from '../types/POP';
import {
  subscribePOPs,
  createPOPClient,
  updatePOP,
  softDeletePOP,
  createPOPVersion,
  signPOPVersion,
  recordarTreinamentoPOP,
} from './popsService';

interface UsePopMutationState {
  loading: boolean;
  error: Error | null;
}

export function usePOPs(filters: POPFilters = {}) {
  const labId = useActiveLabId();
  const [pops, setPOPs] = useState<POP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribePOPs(
      labId,
      filters,
      (data) => {
        setPOPs(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId, JSON.stringify(filters)]);

  const criar = useCallback(
    async (input: POPInput) => {
      if (!labId) throw new Error('Lab não selecionado');
      return createPOPClient(labId, input);
    },
    [labId],
  );

  const atualizar = useCallback(
    async (
      popId: string,
      updates: Partial<Omit<POP, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>>,
    ) => {
      if (!labId) throw new Error('Lab não selecionado');
      return updatePOP(labId, popId, updates);
    },
    [labId],
  );

  const deletar = useCallback(
    async (popId: string) => {
      if (!labId) throw new Error('Lab não selecionado');
      return softDeletePOP(labId, popId);
    },
    [labId],
  );

  return { pops, loading, error, criar, atualizar, deletar };
}

// ─── useCreatePOP ────────────────────────────────────────────────────────────

export function useCreatePOP() {
  const labId = useActiveLabId();
  const [state, setState] = useState<UsePopMutationState>({
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (input: POPInput) => {
      if (!labId) throw new Error('Lab não selecionado');
      setState({ loading: true, error: null });
      try {
        const popId = await createPOPClient(labId, input);
        setState({ loading: false, error: null });
        return popId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ loading: false, error });
        throw error;
      }
    },
    [labId],
  );

  return { ...state, execute };
}

// ─── useCreatePOPVersion ──────────────────────────────────────────────────────

export function useCreatePOPVersion() {
  const labId = useActiveLabId();
  const [state, setState] = useState<UsePopMutationState>({
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (
      popId: string,
      conteudo: { markdown?: string; pdfUrl?: string },
      isMajorVersion?: boolean,
    ) => {
      if (!labId) throw new Error('Lab não selecionado');
      setState({ loading: true, error: null });
      try {
        const result = await createPOPVersion(labId, popId, conteudo, isMajorVersion);
        setState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ loading: false, error });
        throw error;
      }
    },
    [labId],
  );

  return { ...state, execute };
}

// ─── useSignPOP ──────────────────────────────────────────────────────────────

export function useSignPOP() {
  const labId = useActiveLabId();
  const [state, setState] = useState<UsePopMutationState>({
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (popId: string, popVersaoNumero: string) => {
      if (!labId) throw new Error('Lab não selecionado');
      setState({ loading: true, error: null });
      try {
        const result = await signPOPVersion(labId, popId, popVersaoNumero);
        setState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ loading: false, error });
        throw error;
      }
    },
    [labId],
  );

  return { ...state, execute };
}

// ─── useRecordTreinamento ────────────────────────────────────────────────────

export function useRecordTreinamento() {
  const labId = useActiveLabId();
  const [state, setState] = useState<UsePopMutationState>({
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (
      operadorUid: string,
      popId: string,
      popVersaoNumero: string,
      certificado_url?: string,
    ) => {
      if (!labId) throw new Error('Lab não selecionado');
      setState({ loading: true, error: null });
      try {
        const result = await recordarTreinamentoPOP(
          labId,
          operadorUid,
          popId,
          popVersaoNumero,
          certificado_url,
        );
        setState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ loading: false, error });
        throw error;
      }
    },
    [labId],
  );

  return { ...state, execute };
}
