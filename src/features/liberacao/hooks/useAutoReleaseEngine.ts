/**
 * useAutoReleaseEngine — Hook that orchestrates auto-release decision
 *
 * Takes laudoId and returns:
 * - autoRelease: boolean
 * - reason: string
 * - blockers: string[]
 *
 * Reads laudo + exameConfig + criticosDetection + westgardViolations + amostra
 */

import { useMemo } from 'react';
import { Laudo } from '../types/laudo';
import { ExameConfig } from '../types/exameConfig';
import { shouldAutoRelease, AutoReleaseContext } from '../utils/exameClassifier';

interface AutoReleaseResult {
  autoRelease: boolean;
  reason: string;
  blockers: string[];
}

export function useAutoReleaseEngine(
  laudo: Laudo | null,
  exameConfigs: ExameConfig[] | null,
): AutoReleaseResult {
  return useMemo(() => {
    if (!laudo || !exameConfigs || exameConfigs.length === 0) {
      return {
        autoRelease: false,
        reason: 'Dados insuficientes para decisão',
        blockers: [],
      };
    }

    const blockers: string[] = [];

    // 1. Check for critical values
    if (laudo.criticoFlag) {
      blockers.push('Valor crítico detectado');
    }

    // 2. Check Westgard violations (placeholder — requires integration with CIQ module)
    // For MVP: assume no Westgard violations
    const hasWestgardReject = false;
    if (hasWestgardReject) {
      blockers.push('Violação Westgard CLSI');
    }

    // 3. Check material restrictions (placeholder)
    // For MVP: assume no material restrictions
    const hasMaterialRestrito = false;
    if (hasMaterialRestrito) {
      blockers.push('Material com restrição');
    }

    // 4. Get first exam config (for MVP, simplified logic)
    const firstExamCode = laudo.exames[0]?.id || '';
    const config = exameConfigs.find((c) => c.examCode === firstExamCode);

    if (!config) {
      return {
        autoRelease: false,
        reason: 'Nenhuma configuração encontrada para este exame',
        blockers: [],
      };
    }

    // 5. Run shouldAutoRelease logic
    const context: AutoReleaseContext = {
      hasWestgardReject,
      hasCritico: laudo.criticoFlag,
      hasMaterialRestrito,
    };

    const decision = shouldAutoRelease(laudo, config, context);

    return {
      autoRelease: decision.autoRelease,
      reason: decision.reason,
      blockers,
    };
  }, [laudo, exameConfigs]);
}

export default useAutoReleaseEngine;
