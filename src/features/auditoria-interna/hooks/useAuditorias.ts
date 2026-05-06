/**
 * React hooks for auditoria-interna module
 *
 * Hooks follow the pattern from educacao-continuada:
 * - useActiveLabId() guard (throws if no lab)
 * - onSnapshot subscription with cleanup
 * - Error handling
 *
 * All mutations guard on active lab to prevent misuse.
 */

import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';

import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { functions } from '../../../shared/services/firebase';
import {
  subscribeAuditorias,
  subscribeSessoes,
  subscribeChecklistItems,
  subscribeAchados,
  softDeleteAchado,
} from '../services/auditoriaService';
import type {
  Auditoria,
  Sessao,
  ChecklistItem,
  Achado,
  AchadoInput,
  TemplateChecklist,
} from '../types';

// ──────────────────────────────────────────────────────────────────────────
// useAuditorias hook
// ──────────────────────────────────────────────────────────────────────────

export interface UseAuditoriasResult {
  auditorias: Auditoria[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Subscribe to all auditorias in the active lab
 *
 * Returns empty list and no subscription when labId is null.
 * Unsubscribes automatically on unmount.
 */
export function useAuditorias(): UseAuditoriasResult {
  const labId = useActiveLabId();
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setAuditorias([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeAuditorias(
      labId,
      (data) => {
        setAuditorias(data);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [labId]);

  return { auditorias, isLoading, error };
}

// ──────────────────────────────────────────────────────────────────────────
// useChecklistTemplate hook
// ──────────────────────────────────────────────────────────────────────────

export interface UseChecklistTemplateResult {
  template: TemplateChecklist | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Load a checklist template by ID
 *
 * Templates are loaded from static JSON.
 * Used when initializing a new sessao with DICQ template.
 */
export function useChecklistTemplate(
  templateId: string
): UseChecklistTemplateResult {
  const [template, setTemplate] = useState<TemplateChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Load template from static JSON
    // Actual loading will be implemented in Phase 05-02 when UI consumes this
    // For now, just stub the loading state
    setIsLoading(false);
  }, [templateId]);

  return { template, isLoading, error };
}

// ──────────────────────────────────────────────────────────────────────────
// useSessao hook
// ──────────────────────────────────────────────────────────────────────────

export interface UseSessaoResult {
  sessao: Sessao | null;
  checklistItems: ChecklistItem[];
  achados: Achado[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a single sessao with its checklist items and achados
 *
 * Real-time binding for audit execution view.
 * Combines three subscriptions (sessao + checklist + achados).
 */
export function useSessao(
  auditoriaId: string,
  sessaoId: string
): UseSessaoResult {
  const labId = useActiveLabId();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setSessao(null);
      setChecklistItems([]);
      setAchados([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Subscribe to sessao
    const unsubSessao = subscribeSessoes(
      labId,
      auditoriaId,
      (sessoes) => {
        const found = sessoes.find((s) => s.id === sessaoId);
        setSessao(found || null);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    // Subscribe to checklist items
    const unsubChecklist = subscribeChecklistItems(
      labId,
      auditoriaId,
      sessaoId,
      (items) => {
        setChecklistItems(items);
      },
      (err) => {
        setError(err);
      }
    );

    // Subscribe to achados
    const unsubAchados = subscribeAchados(
      labId,
      auditoriaId,
      sessaoId,
      (items) => {
        setAchados(items);
      },
      (err) => {
        setError(err);
      }
    );

    return () => {
      unsubSessao();
      unsubChecklist();
      unsubAchados();
    };
  }, [labId, auditoriaId, sessaoId]);

  return {
    sessao,
    checklistItems,
    achados,
    isLoading,
    error,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// useAchadoMutation hook
// ──────────────────────────────────────────────────────────────────────────

export interface UseAchadoMutationResult {
  registerAchado: (input: AchadoInput & {
    labId: string;
    auditoriaId: string;
    sessaoId: string;
  }) => Promise<string>;
  softDelete: (achadoId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Mutations for achado (findings)
 *
 * registerAchado: calls Cloud Function callable
 * softDelete: marks achado as deleted via callable
 *
 * Severity crítica/grave auto-triggers NC creation in Cloud Function.
 */
export function useAchadoMutation(): UseAchadoMutationResult {
  const activeLabId = useActiveLabId();
  const user = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const registerAchado = useCallback(
    async (input: AchadoInput & {
      labId: string;
      auditoriaId: string;
      sessaoId: string;
    }): Promise<string> => {
      if (!activeLabId) {
        throw new Error('Lab not active');
      }
      if (!user) {
        throw new Error('User not authenticated');
      }

      setIsLoading(true);
      setError(null);

      try {
        const callable = httpsCallable(functions, 'registerAchado');
        const result = await callable({
          ...input,
          labId,
        });

        // Callable returns { achadoId: string }
        return (result.data as any).achadoId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [activeLabId, user]
  );

  const handleSoftDelete = useCallback(
    async (achadoId: string): Promise<void> => {
      if (!activeLabId) {
        throw new Error('Lab not active');
      }

      setIsLoading(true);
      setError(null);

      try {
        await softDeleteAchado(activeLabId, achadoId, 'soft-deleted via UI');
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [activeLabId]
  );

  return {
    registerAchado,
    softDelete: handleSoftDelete,
    isLoading,
    error,
  };
}
