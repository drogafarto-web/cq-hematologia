import { useMemo } from 'react';
import { checkWestgardCLSI, WestgardViolation, suggestStatus } from '../utils/westgardRulesCLSI';
import { Run, Analito } from '../types';

export interface AcceptanceResult {
  violations: Map<string, Map<string, WestgardViolation[]>>; // analito → nível → violations
  suggestedStatus: 'Aprovada' | 'Rejeitada';
  hasWarnings: boolean;
  hasRejects: boolean;
}

export function useAcceptanceEngine(
  run: Partial<Run>,
  previousRuns: Run[],
  analitos: Analito[],
  statsMap: Map<string, Map<string, { mean: number; sd: number }>>,
): AcceptanceResult {
  return useMemo(() => {
    const violations = new Map<string, Map<string, WestgardViolation[]>>();
    let hasWarnings = false;
    let hasRejects = false;

    // Process each analito and nível pair
    for (const analito of analitos) {
      const analitoViolations = new Map<string, WestgardViolation[]>();

      const niveis = (analito as any).niveis || [];
      for (const nível of niveis) {
        // Get value from run
        const value = run.resultados?.[analito.id]?.[nível];
        if (typeof value !== 'number') {
          analitoViolations.set(nível, []);
          continue;
        }

        // Get stats
        const stats = statsMap.get(analito.id)?.get(nível);
        if (!stats) {
          analitoViolations.set(nível, []);
          continue;
        }

        // Get history (last N runs for this analito × nível)
        const history = previousRuns
          .filter(
            (r) =>
              r.equipmentId === run.equipmentId &&
              r.resultados?.[analito.id]?.[nível] !== undefined,
          )
          .sort((a, b) => b.criadoEm.toMillis() - a.criadoEm.toMillis())
          .slice(0, 10)
          .map((r) => ({
            value: r.resultados[analito.id][nível],
            capturaEm: r.criadoEm,
          }));

        // Check Westgard rules
        const ruleViolations = checkWestgardCLSI({
          current: {
            value,
            analitoId: analito.id,
            nivelId: nível,
            equipmentId: run.equipmentId || '',
            capturaEm: (run.criadoEm || '') as any,
          },
          history,
          stats,
        });

        analitoViolations.set(nível, ruleViolations);

        // Track violation types
        for (const v of ruleViolations) {
          if (v.severity === 'warn') hasWarnings = true;
          if (v.severity === 'reject') hasRejects = true;
        }
      }

      violations.set(analito.id, analitoViolations);
    }

    // Flatten violations to determine overall status
    const allViolations: WestgardViolation[] = [];
    for (const [, analitoViolations] of violations) {
      for (const [, vList] of analitoViolations) {
        allViolations.push(...vList);
      }
    }

    const suggestedStatus = suggestStatus(allViolations);

    return {
      violations,
      suggestedStatus,
      hasWarnings,
      hasRejects,
    };
  }, [run, previousRuns, analitos, statsMap]);
}
