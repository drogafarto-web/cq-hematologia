import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createTemplate,
  restoreTemplate,
  softDeleteTemplate,
  subscribeTemplates,
  updateTemplate,
  type SubscribeTemplatesOptions,
} from '../services/ecFirebaseService';
import type {
  TemplateTreinamento,
  TemplateTreinamentoInput,
} from '../types/EducacaoContinuada';

export interface UseTemplatesResult {
  templates: TemplateTreinamento[];
  isLoading: boolean;
  error: Error | null;
  create: (input: TemplateTreinamentoInput) => Promise<string>;
  /** Atualiza um template. `versaoAtual` precisa vir do doc atual — service incrementa +1. */
  update: (
    id: string,
    patch: Partial<TemplateTreinamentoInput>,
    versaoAtual: number,
  ) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

/**
 * Hook da biblioteca de templates de treinamento (Fase 6). Subscribe em tempo
 * real filtrado por labId + opções. Padrão espelha `useTreinamentos`.
 */
export function useTemplates(options: SubscribeTemplatesOptions = {}): UseTemplatesResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, somenteAtivos = false, tag } = options;

  const [templates, setTemplates] = useState<TemplateTreinamento[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setTemplates([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeTemplates(
      labId,
      { includeDeleted, somenteAtivos, tag },
      (list) => {
        setTemplates(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, includeDeleted, somenteAtivos, tag]);

  const create = useCallback(
    async (input: TemplateTreinamentoInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createTemplate(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (
      id: string,
      patch: Partial<TemplateTreinamentoInput>,
      versaoAtual: number,
    ): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateTemplate(labId, id, patch, versaoAtual);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteTemplate(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreTemplate(labId, id);
    },
    [labId],
  );

  return { templates, isLoading, error, create, update, softDelete, restore };
}
