/**
 * personnel/hooks/useCompetenciaMatriz.ts
 *
 * Hook reativo para Matriz de Competências Técnicas.
 * Subscribe em `personnel/{labId}/competencias` com filtros opcionais.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  watchCompetencias,
  upsertCompetencia,
  softDeleteCompetencia,
  type WatchCompetenciasOptions,
} from '../services/competenciaMatrizService';
import type {
  CompetenciaTecnica,
  CompetenciaTecnicaInput,
  CategoriaCompetencia,
  NivelCompetencia,
} from '../types/CompetenciaMatriz';

export interface UseCompetenciaMatrizOptions {
  categoria?: CategoriaCompetencia;
  colaboradorId?: string;
}

export interface UseCompetenciaMatrizResult {
  competencias: CompetenciaTecnica[];
  loading: boolean;
  error: Error | null;
  /** Grid derivado: Map<colaboradorId, Map<itemId, CompetenciaTecnica>> */
  grid: Map<string, Map<string, CompetenciaTecnica>>;
  /** Lista única de colaboradores presentes */
  colaboradores: { id: string; nome: string }[];
  /** Lista única de itens (analitos/equipamentos/procedimentos) */
  itens: { id: string; nome: string; categoria: CategoriaCompetencia }[];
  /** Competências com avaliação vencida ou próxima de vencer (30 dias) */
  alertas: CompetenciaTecnica[];
  upsert: (input: CompetenciaTecnicaInput, existingId?: string) => Promise<string>;
  remove: (id: string) => Promise<void>;
}

export function useCompetenciaMatriz(
  options?: UseCompetenciaMatrizOptions,
): UseCompetenciaMatrizResult {
  const labId = useActiveLabId();
  const [competencias, setCompetencias] = useState<CompetenciaTecnica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setCompetencias([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = watchCompetencias(
      labId,
      (items) => {
        setCompetencias(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      options as WatchCompetenciasOptions,
    );

    return () => unsub();
  }, [labId, options?.categoria, options?.colaboradorId]);

  // Derivar grid
  const grid = useMemo(() => {
    const map = new Map<string, Map<string, CompetenciaTecnica>>();
    for (const c of competencias) {
      if (!map.has(c.colaboradorId)) {
        map.set(c.colaboradorId, new Map());
      }
      map.get(c.colaboradorId)!.set(c.itemId, c);
    }
    return map;
  }, [competencias]);

  // Derivar colaboradores únicos
  const colaboradores = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of competencias) {
      if (!seen.has(c.colaboradorId)) {
        seen.set(c.colaboradorId, c.colaboradorNome);
      }
    }
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome }));
  }, [competencias]);

  // Derivar itens únicos
  const itens = useMemo(() => {
    const seen = new Map<string, { nome: string; categoria: CategoriaCompetencia }>();
    for (const c of competencias) {
      if (!seen.has(c.itemId)) {
        seen.set(c.itemId, { nome: c.itemNome, categoria: c.categoria });
      }
    }
    return Array.from(seen.entries()).map(([id, v]) => ({ id, ...v }));
  }, [competencias]);

  // Alertas: vencidas ou vencendo em 30 dias
  const alertas = useMemo(() => {
    const now = Date.now();
    const threshold = 30 * 24 * 60 * 60 * 1000;
    return competencias.filter((c) => {
      if (!c.dataProximaAvaliacao) return false;
      const prox = c.dataProximaAvaliacao.toDate().getTime();
      return prox - now <= threshold;
    });
  }, [competencias]);

  const upsert = useCallback(
    async (input: CompetenciaTecnicaInput, existingId?: string) => {
      if (!labId) throw new Error('Lab não selecionado.');
      return upsertCompetencia(labId, input, existingId);
    },
    [labId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!labId) throw new Error('Lab não selecionado.');
      return softDeleteCompetencia(labId, id);
    },
    [labId],
  );

  return {
    competencias,
    loading,
    error,
    grid,
    colaboradores,
    itens,
    alertas,
    upsert,
    remove,
  };
}
