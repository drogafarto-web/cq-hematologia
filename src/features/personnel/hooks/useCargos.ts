/**
 * personnel/hooks/useCargos.ts
 *
 * Subscribe à lista de cargos em tempo real.
 * Devolve hierarquia pronta para OrgChart.
 */

import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { watchCargos, getCargoHierarchy } from '../services/cargoService';
import type { Cargo, LabId, OrgChartNode } from '../types';

interface UseCargoState {
  cargos: Cargo[];
  hierarchy: { roots: string[]; parents: Map<string, string> };
  loading: boolean;
  error: Error | null;
}

export function useCargos(): UseCargoState {
  const [state, setState] = useState<UseCargoState>({
    cargos: [],
    hierarchy: { roots: [], parents: new Map() },
    loading: true,
    error: null,
  });

  const labId = useActiveLabId() as LabId | null;

  useEffect(() => {
    if (!labId) {
      setState((s) => ({ ...s, loading: false, error: new Error('No active lab') }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const unsubscribe = watchCargos(
      labId,
      async (cargos) => {
        try {
          const hierarchy = await getCargoHierarchy(labId);
          setState({ cargos, hierarchy, loading: false, error: null });
        } catch (err) {
          setState((s) => ({ ...s, error: err as Error }));
        }
      },
      (err) => {
        setState((s) => ({ ...s, error: err, loading: false }));
      },
    );

    return () => {
      unsubscribe();
    };
  }, [labId]);

  return state;
}

/**
 * Builds OrgChart tree from cargos + current designações.
 * Pass the result of useDesignacoes().currentByRole to populate names.
 */
export function buildOrgChartTree(
  cargos: Cargo[],
  hierarchy: { roots: string[]; parents: Map<string, string> },
  currentByRole: Map<string, any>, // Designacao
): OrgChartNode[] {
  const cargoMap = new Map<string, Cargo>(cargos.map((c) => [c.id, c]));

  function buildNode(cargoId: string): OrgChartNode {
    const cargo = cargoMap.get(cargoId);
    if (!cargo) {
      return {
        cargoId,
        titulo: '(Unknown)',
      };
    }

    const designacao = currentByRole.get(cargoId);
    const node: OrgChartNode = {
      cargoId,
      titulo: cargo.titulo,
      designacaoId: designacao?.id,
      nome: designacao?.pessoaNome,
      reportaA: cargo.reportaA,
      filhos: [],
    };

    // Find children
    for (const [childCargoId, parentCargoId] of hierarchy.parents) {
      if (parentCargoId === cargoId) {
        node.filhos!.push(buildNode(childCargoId));
      }
    }

    return node;
  }

  return hierarchy.roots.map((rootId) => buildNode(rootId));
}
