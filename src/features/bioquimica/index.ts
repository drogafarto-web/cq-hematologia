/**
 * bioquimica/index.ts
 *
 * Barrel exports do módulo bioquimica. Esta porta de entrada é também o
 * ponto de import para o code-splitting via `React.lazy(() => import('./features/bioquimica'))`.
 *
 * Design: o `BioquimicaView` default é a tela admin de analitos no MVP
 * (Plan 09-01). Plans 09-02+ vão substituir por uma navegação interna com
 * lotes/runs/relatórios — quando isso acontecer, a rota raiz fica num
 * componente shell e este export passa a apontar para ele.
 */

export { AnalitoAdmin as default, AnalitoAdmin } from './components/AnalitoAdmin';
export { AnalitoForm } from './components/AnalitoForm';
export { AnalitoList } from './components/AnalitoList';

export { useAnalitos, useAnalitosAtivos } from './hooks/useAnalitos';
export { useBioquimicaState } from './hooks/useBioquimicaState';

export * from './types';
