import type { ControlLot } from '../../../types';

/**
 * Chave de agrupamento da bula = ano-mês de `startDate`.
 * Mesmos 3 níveis NV1/NV2/NV3 da bula Controllab compartilham essa chave.
 */
export function bulaKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
}

/**
 * Filtra a lista de lotes para a "bula corrente" usada na rotina diária —
 * a regra única consumida por LotPicker, LotSwitcher e PreFlightCheck pra
 * evitar drift entre componentes.
 *
 * Regras:
 *   1. Exclui lotes com `archivedAt` ou `manualHidden` — operador retirou.
 *   2. Exclui lotes vencidos (`expiryDate < now`).
 *   3. Encontra a bula corrente: `startDate` mais recente cuja janela está vigente.
 *      Empate ou inexistência: pega a mais recente independente de vigência.
 *   4. Retorna os lotes daquele mesmo `bulaKey`.
 *
 * Lotes de bulas antigas vigentes em paralelo NÃO entram — viraram ruído
 * na seleção da rotina e migram pro Histórico do LotManager.
 */
export function selectCurrentBulaLots(lots: ControlLot[]): ControlLot[] {
  const now = Date.now();
  const usable = lots.filter(
    (l) => l.archivedAt == null && l.manualHidden !== true && l.expiryDate.getTime() >= now,
  );
  if (usable.length === 0) return [];

  let bestStart = -Infinity;
  let currentKey: string | null = null;
  for (const l of usable) {
    const ts = l.startDate.getTime();
    if (ts > bestStart) {
      bestStart = ts;
      currentKey = bulaKey(l.startDate);
    }
  }

  return usable.filter((l) => bulaKey(l.startDate) === currentKey);
}
