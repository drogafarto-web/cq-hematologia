import type { CoagulacaoLot } from '../types/Coagulacao';
import { COAG_NIVEIS, type CoagNivel } from '../types/_shared_refs';
import {
  findCurrentLotByNivel,
  getCoagCompetenceMonth,
  lotCompetenceKey,
  type CoagCompetenceMonth,
} from './currentCompetence';

export { COAG_NIVEIS, getCoagCompetenceMonth, lotCompetenceKey };
export type { CoagCompetenceMonth };

export type CoagNivelSidebarSlot =
  | { kind: 'lot'; lot: CoagulacaoLot }
  | { kind: 'empty'; nivel: CoagNivel };

/** Slots I/II do mês de competência (calendário corrente) — legado sidebar. */
export function buildCoagNivelSidebarSlots(
  lots: CoagulacaoLot[],
  competence: CoagCompetenceMonth = getCoagCompetenceMonth(),
): CoagNivelSidebarSlot[] {
  return COAG_NIVEIS.map((nivel) => {
    const lot = findCurrentLotByNivel(
      lots.filter((l) => lotCompetenceKey(l) === competence.key),
      nivel,
    );
    if (lot) return { kind: 'lot', lot };
    return { kind: 'empty', nivel };
  });
}

export function getCoagSidebarHistoricalLots(
  lots: CoagulacaoLot[],
  slots: CoagNivelSidebarSlot[],
): CoagulacaoLot[] {
  const shownIds = new Set(
    slots.filter((s): s is { kind: 'lot'; lot: CoagulacaoLot } => s.kind === 'lot').map((s) => s.lot.id),
  );
  return lots.filter((l) => !shownIds.has(l.id));
}
