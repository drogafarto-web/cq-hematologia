/**
 * useCalibracaoStatus — deriva status de calibração a partir da próxima data (sem Firebase).
 */

import { useMemo } from 'react';
import type { Timestamp } from 'firebase/firestore';

export type CalibracaoStatus = 'em_dia' | 'vencida' | 'proxima' | 'sem_data';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function deriveStatus(proximaCalibracao: Timestamp | undefined): CalibracaoStatus {
  if (proximaCalibracao == null) {
    return 'sem_data';
  }
  const tsMs = proximaCalibracao.toMillis();
  const nowMs = Date.now();
  if (tsMs < nowMs) {
    return 'vencida';
  }
  if (tsMs <= nowMs + THIRTY_DAYS_MS) {
    return 'proxima';
  }
  return 'em_dia';
}

export function useCalibracaoStatus(proximaCalibracao: Timestamp | undefined): {
  calibracaoStatus: CalibracaoStatus;
} {
  return useMemo(
    () => ({ calibracaoStatus: deriveStatus(proximaCalibracao) }),
    [proximaCalibracao],
  );
}
