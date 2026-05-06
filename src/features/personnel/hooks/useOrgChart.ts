/**
 * personnel/hooks/useOrgChart.ts
 *
 * Combina cargos + designações para construir árvore org chart pronta para render.
 */

import { useMemo } from 'react';
import { useCargos, buildOrgChartTree } from './useCargos';
import { useDesignacoes } from './useDesignacoes';
import type { OrgChartNode } from '../types';

interface UseOrgChartState {
  tree: OrgChartNode[];
  loading: boolean;
  error: Error | null;
}

export function useOrgChart(): UseOrgChartState {
  const cargoState = useCargos();
  const designacaoState = useDesignacoes();

  const tree = useMemo(() => {
    if (cargoState.loading || designacaoState.loading) return [];
    return buildOrgChartTree(cargoState.cargos, cargoState.hierarchy, designacaoState.currentByRole);
  }, [cargoState.cargos, cargoState.hierarchy, designacaoState.currentByRole, cargoState.loading, designacaoState.loading]);

  const loading = cargoState.loading || designacaoState.loading;
  const error = cargoState.error || designacaoState.error;

  return { tree, loading, error };
}
