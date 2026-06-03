/**
 * personnel/hooks/useCiencias.ts
 *
 * Hook reativo para Ciência de Responsabilidades.
 * Subscribe em `personnel/{labId}/ciencias` e deriva pendentes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { Timestamp } from '../../../shared/services/firebase';
import { watchCiencias, createCiencia } from '../services/cienciaService';
import { useDesignacoes } from './useDesignacoes';
import { useCargos } from './useCargos';
import type {
  CienciaResponsabilidades,
  CienciaResponsabilidadesInput,
} from '../types/CienciaResponsabilidades';
import type { Designacao, Cargo } from '../types';

export interface PendenteCiencia {
  designacao: Designacao;
  cargo: Cargo;
}

export interface UseCienciasResult {
  ciencias: CienciaResponsabilidades[];
  pendentes: PendenteCiencia[];
  loading: boolean;
  error: Error | null;
  create: (input: Omit<CienciaResponsabilidadesInput, 'hash'>) => Promise<string>;
}

export function useCiencias(): UseCienciasResult {
  const labId = useActiveLabId();
  const user = useUser();
  const [ciencias, setCiencias] = useState<CienciaResponsabilidades[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { designacoes } = useDesignacoes();
  const { cargos } = useCargos();

  useEffect(() => {
    if (!labId) {
      setCiencias([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = watchCiencias(
      labId,
      (items) => {
        setCiencias(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId]);

  // Derive pendentes: designações ativas sem ciência assinada
  const pendentes = useMemo(() => {
    const result: PendenteCiencia[] = [];
    const activeDesignacoes = designacoes.filter((d) => d.dataFim === null);

    for (const desig of activeDesignacoes) {
      const hasCiencia = ciencias.some(
        (c) => c.colaboradorId === desig.pessoaId && c.cargoId === desig.cargoId,
      );
      if (!hasCiencia) {
        const cargo = cargos.find((c) => c.id === desig.cargoId);
        if (cargo) {
          result.push({ designacao: desig, cargo });
        }
      }
    }

    return result;
  }, [designacoes, ciencias, cargos]);

  const create = useCallback(
    async (input: Omit<CienciaResponsabilidadesInput, 'hash'>) => {
      if (!labId) throw new Error('Lab não selecionado.');
      // hash is generated inside the service
      return createCiencia(labId, input as CienciaResponsabilidadesInput);
    },
    [labId],
  );

  return {
    ciencias,
    pendentes,
    loading,
    error,
    create,
  };
}
