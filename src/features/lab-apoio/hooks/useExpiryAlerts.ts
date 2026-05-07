/**
 * useExpiryAlerts.ts — derives expiring contracts from contratos[] in real-time.
 *
 * Bins contracts into categories: expiring-7d, expiring-30d, expiring-60d, expired.
 * Sorted by vigenciaFim ASC (soonest first).
 * No query needed — client-side derivation from cached data.
 */

import { useMemo } from 'react';
import type { Contrato } from '../types/LabApoio';

export interface ExpiryBin {
  '7d': Contrato[];
  '30d': Contrato[];
  '60d': Contrato[];
  expired: Contrato[];
}

export function useExpiryAlerts(contratos: Contrato[]): ExpiryBin {
  return useMemo(() => {
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const bins: ExpiryBin = {
      '7d': [],
      '30d': [],
      '60d': [],
      expired: [],
    };

    contratos.forEach((contrato) => {
      if (contrato.deletadoEm !== null || !contrato.ativo) return;

      const daysUntil = Math.floor(
        (new Date(contrato.vigenciaFim).getTime() - new Date(now).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysUntil < 0) {
        bins.expired.push(contrato);
      } else if (daysUntil <= 7) {
        bins['7d'].push(contrato);
      } else if (daysUntil <= 30) {
        bins['30d'].push(contrato);
      } else if (daysUntil <= 60) {
        bins['60d'].push(contrato);
      }
    });

    // Sort each bin by vigenciaFim ASC
    Object.values(bins).forEach((bin) => {
      bin.sort((a: Contrato, b: Contrato) => a.vigenciaFim.localeCompare(b.vigenciaFim));
    });

    return bins;
  }, [contratos]);
}
