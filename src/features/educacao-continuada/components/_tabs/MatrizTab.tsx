import { MatrizTreinamentos } from '../MatrizTreinamentos';

/**
 * Wrapper de tab — segue o padrão dos demais `_tabs/*Tab.tsx`. Toda lógica
 * vive em `MatrizTreinamentos` e no hook `useMatrizTreinamentos`.
 */
export function MatrizTab() {
  return <MatrizTreinamentos />;
}
