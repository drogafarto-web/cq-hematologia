import { useMemo } from 'react';
import type { Turno } from '../types/Turno';

export type TurnoCoverageStatus = 'registered' | 'inferred' | 'missing' | 'multiple';

export interface CoverageCell {
  status: TurnoCoverageStatus;
  turnos: Turno[];
}

/**
 * Hook que deriva heatmap de cobertura para os últimos 90 dias.
 * Retorna um mapa 2D (data × periodo) com status de cobertura.
 *
 * Status:
 * - 'registered': exatamente 1 turno com inferred=false
 * - 'inferred': exatamente 1 turno com inferred=true (pendente confirmação)
 * - 'multiple': >1 turno para a mesma (data, periodo) — conflito
 * - 'missing': 0 turnos
 */
export function useCoberturaTurnos(turnos: Turno[]): Map<string, Map<string, CoverageCell>> {
  const periodos = ['manha', 'tarde', 'noite', 'plantao'];

  return useMemo(() => {
    const now = new Date();
    const coverage = new Map<string, Map<string, CoverageCell>>();

    // Gera datas para os últimos 90 dias
    for (let i = 0; i < 90; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD

      coverage.set(dateStr, new Map());

      for (const periodo of periodos) {
        // Filtra turnos para esta (data, periodo)
        const matching = turnos.filter(
          (t) => t.data === dateStr && t.periodo === periodo && !t.deletadoEm,
        );

        let status: TurnoCoverageStatus;

        if (matching.length === 0) {
          status = 'missing';
        } else if (matching.length === 1) {
          status = matching[0].inferred ? 'inferred' : 'registered';
        } else {
          status = 'multiple';
        }

        coverage.get(dateStr)?.set(periodo, { status, turnos: matching });
      }
    }

    return coverage;
  }, [turnos]);
}
