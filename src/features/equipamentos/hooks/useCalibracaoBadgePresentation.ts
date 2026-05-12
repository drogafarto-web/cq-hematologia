/**
 * useCalibracaoBadgePresentation — rótulo e tom visual para o badge de calibração (sem Firebase).
 */

import { useMemo } from 'react';

import type { CalibracaoStatus } from './useCalibracaoStatus';

export interface CalibracaoBadgePresentation {
  label: string;
  toneClasses: string;
}

export function useCalibracaoBadgePresentation(calibracaoStatus: CalibracaoStatus): CalibracaoBadgePresentation {
  return useMemo(() => {
    switch (calibracaoStatus) {
      case 'vencida':
        return {
          label: 'Calibração vencida',
          toneClasses: 'border border-red-500/40 bg-red-500/15 text-red-300',
        };
      case 'proxima':
        return {
          label: 'Calibração próxima',
          toneClasses: 'border border-amber-500/40 bg-amber-500/15 text-amber-200',
        };
      case 'em_dia':
        return {
          label: 'Calibração em dia',
          toneClasses: 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
        };
      case 'sem_data':
        return {
          label: 'Sem data de calibração',
          toneClasses: 'border border-white/20 bg-white/10 text-white/60',
        };
    }
  }, [calibracaoStatus]);
}
