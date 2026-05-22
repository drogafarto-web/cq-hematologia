import type { CoagulacaoLot } from '../types/Coagulacao';
import { COAG_NIVEIS, type CoagNivel } from '../types/_shared_refs';

export { COAG_NIVEIS };

export interface CoagCompetenceMonth {
  key: string;
  label: string;
}

function parseIsoDate(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Período de competência = mês de criação do lote (equivalente ao startDate da bula em hematologia). */
export function lotCompetenceKey(lot: CoagulacaoLot): string | null {
  const created = lot.createdAt?.toDate?.();
  if (!created) return null;
  const y = created.getFullYear();
  const m = created.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function competenceMonthFromKey(key: string): CoagCompetenceMonth {
  const [y, m] = key.split('-').map(Number);
  const ref = new Date(y, (m ?? 1) - 1, 1);
  const label = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return { key, label };
}

export function getCoagCompetenceMonth(reference: Date = new Date()): CoagCompetenceMonth {
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1;
  return competenceMonthFromKey(`${year}-${String(month).padStart(2, '0')}`);
}

function latestCompetenceKey(lots: CoagulacaoLot[]): string | null {
  const keys = lots
    .map(lotCompetenceKey)
    .filter((k): k is string => k != null)
    .sort((a, b) => b.localeCompare(a));
  return keys[0] ?? null;
}

/**
 * Lotes do período corrente — mesma regra que `selectCurrentBulaLots` em hematologia:
 * último mês com lotes elegíveis (não vencidos), não o calendário isolado.
 */
export function selectCurrentCompetenceLots(lots: CoagulacaoLot[]): CoagulacaoLot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eligible = lots.filter((l) => {
    const exp = parseIsoDate(l.validadeControle);
    return exp != null && exp >= today;
  });

  const key = latestCompetenceKey(eligible) ?? getCoagCompetenceMonth().key;
  return eligible.filter((l) => lotCompetenceKey(l) === key);
}

export function getCurrentCompetenceMonth(lots: CoagulacaoLot[]): CoagCompetenceMonth {
  const current = selectCurrentCompetenceLots(lots);
  const key = latestCompetenceKey(current) ?? getCoagCompetenceMonth().key;
  return competenceMonthFromKey(key);
}

export function findCurrentLotByNivel(
  lots: CoagulacaoLot[],
  nivel: CoagNivel,
): CoagulacaoLot | undefined {
  const current = selectCurrentCompetenceLots(lots);
  const candidates = current
    .filter((l) => l.nivel === nivel)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  return candidates[0];
}
