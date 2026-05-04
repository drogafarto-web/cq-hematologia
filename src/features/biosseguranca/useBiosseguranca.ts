import { useState, useEffect, useCallback } from 'react';
import { useActiveLabId } from '../../store/useAuthStore';
import type { Area, EPE, InspecaoArea, BiossegurancaFilters } from './types/Biosseguranca';
import {
  subscribeAreas,
  subscribeEPEs,
  subscribeInspecoes,
  createArea,
  updateArea,
  createEPE,
  updateEPEStock,
  createInspecao,
  getEPEsObrigatorios,
  softDeleteArea,
  softDeleteEPE,
} from './biossegurancaService';

export function useBiossegurancaAreas(filters?: BiossegurancaFilters) {
  const labId = useActiveLabId();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) return;

    setLoading(true);
    const unsub = subscribeAreas(
      labId,
      filters || {},
      (data: Area[]) => {
        setAreas(data);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsub;
  }, [labId, filters?.status, filters?.nivelMinimo]);

  const create = useCallback(
    async (input: Omit<Area, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'>) => {
      if (!labId) throw new Error('No labId');
      return await createArea(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (areaId: string, updates: Partial<Area>) => {
      if (!labId) throw new Error('No labId');
      await updateArea(labId, areaId, updates);
    },
    [labId],
  );

  const deletar = useCallback(
    async (areaId: string) => {
      if (!labId) throw new Error('No labId');
      await softDeleteArea(labId, areaId);
    },
    [labId],
  );

  return {
    areas,
    loading,
    error,
    create,
    update,
    deletar,
  };
}

export function useBiossegurancaEPEs() {
  const labId = useActiveLabId();
  const [epes, setEPEs] = useState<EPE[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) return;

    setLoading(true);
    const unsub = subscribeEPEs(
      labId,
      (data: EPE[]) => {
        setEPEs(data);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsub;
  }, [labId]);

  const create = useCallback(
    async (input: Omit<EPE, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'>) => {
      if (!labId) throw new Error('No labId');
      return await createEPE(labId, input);
    },
    [labId],
  );

  const updateStock = useCallback(
    async (epeId: string, novaQtd: number) => {
      if (!labId) throw new Error('No labId');
      await updateEPEStock(labId, epeId, novaQtd);
    },
    [labId],
  );

  const deletar = useCallback(
    async (epeId: string) => {
      if (!labId) throw new Error('No labId');
      await softDeleteEPE(labId, epeId);
    },
    [labId],
  );

  return {
    epes,
    loading,
    error,
    create,
    updateStock,
    deletar,
  };
}

export function useBiossegurancaInspecoes(areaId?: string) {
  const labId = useActiveLabId();
  const [inspecoes, setInspecoes] = useState<InspecaoArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) return;

    setLoading(true);
    const unsub = subscribeInspecoes(
      labId,
      areaId,
      (data: InspecaoArea[]) => {
        setInspecoes(data);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsub;
  }, [labId, areaId]);

  const create = useCallback(
    async (input: Omit<InspecaoArea, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>) => {
      if (!labId) throw new Error('No labId');
      return await createInspecao(labId, input);
    },
    [labId],
  );

  return {
    inspecoes,
    loading,
    error,
    create,
  };
}
