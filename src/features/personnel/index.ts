/**
 * personnel/index.ts
 *
 * Public exports from the Personnel module (Cargos + Designações).
 */

// Types
export * from './types';

// Services
export * from './services/cargoService';
export * from './services/designacaoService';

// Hooks
export { useCargos, buildOrgChartTree } from './hooks/useCargos';
export { useDesignacoes, useCurrentDesignacao } from './hooks/useDesignacoes';
export { useOrgChart } from './hooks/useOrgChart';
