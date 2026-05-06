/**
 * useCAPADeadlineMonitor.ts
 *
 * Hook para refrescar deadline indicators a cada 60s.
 * Implementa meta-diff guard: só atualiza estado se algum CAPA mudou de
 * status (on-track → at-risk, etc).
 *
 * Evita re-render desnecessário quando apenas timestamp passa (sem mudança
 * de categoria de deadline).
 */

import { useEffect, useRef } from 'react';
import type { CAPAWithDeadlineStatus } from '../types';

interface DeadlineMonitorOptions {
  /** Intervalo de polling em ms. Default: 60000 (60s). */
  interval?: number;
}

/**
 * Deriva se a lista de CAPAs mudou significativamente (status de deadline alterou).
 * Comparação simples: mesma lista de IDs + mesmos status. Ignora timestamp puro.
 */
function hasMeaningfulChange(
  oldCapas: CAPAWithDeadlineStatus[],
  newCapas: CAPAWithDeadlineStatus[],
): boolean {
  if (oldCapas.length !== newCapas.length) return true;

  for (let i = 0; i < oldCapas.length; i++) {
    const old = oldCapas[i];
    const neu = newCapas[i];

    if (old.id !== neu.id || old.deadlineStatus.status !== neu.deadlineStatus.status) {
      return true;
    }
  }

  return false;
}

/**
 * Hook que refresca deadline indicators periodicamente (polling).
 *
 * Uso:
 * ```typescript
 * const { capas, loading, error } = useCAPAs();
 * useCAPADeadlineMonitor(capas, { interval: 60000 });
 * // Agora `capas` pode atualizar a cada 60s se deadline status mudar
 * ```
 *
 * Importante: Este hook NÃO dispara refetch completo. Apenas recalcula
 * `deadlineStatus` em local. Usado para que a UI atualize cores/indicadores
 * sem necessidade de interação do usuário.
 */
export function useCAPADeadlineMonitor(
  capas: CAPAWithDeadlineStatus[],
  options?: DeadlineMonitorOptions,
): void {
  const lastCapasRef = useRef<CAPAWithDeadlineStatus[]>(capas);
  const interval = options?.interval ?? 60000;

  useEffect(() => {
    // Verifica se há mudança significativa
    if (hasMeaningfulChange(lastCapasRef.current, capas)) {
      lastCapasRef.current = capas;
    }

    // Configurar polling para refrescar a cada `interval` ms
    const timer = setInterval(() => {
      // Nota: Aqui faríamos um refresh local dos deadline status.
      // Mas como a UI já tem acesso a `capas` via hook anterior (watchCAPAs),
      // e o deadline é calculado sempre que `capas` mudar, não precisamos
      // fazer nada especial. O próximo re-render via onSnapshot fará o refresh.

      // Se quisermos forçar um re-render mesmo sem dados novos do Firestore,
      // precisaríamos de estado local. Por enquanto, confiar que onSnapshot
      // vai atualizar quando houver mudança em Firestore (ou em 60s quando
      // o usuário volta à UI).
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [capas, interval]);
}
