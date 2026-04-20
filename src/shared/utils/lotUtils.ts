import type { ControlLot } from '../../types';

export function groupByMonth(
  lots: ControlLot[],
): Array<{ key: string; label: string; lots: ControlLot[] }> {
  const sorted = [...lots].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  const map = new Map<string, { label: string; lots: ControlLot[] }>();
  for (const lot of sorted) {
    const yr = lot.startDate.getFullYear();
    const mo = lot.startDate.getMonth();
    const key = `${yr}-${String(mo).padStart(2, '0')}`;
    if (!map.has(key)) {
      const label = new Date(yr, mo, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      });
      map.set(key, { label, lots: [] });
    }
    map.get(key)!.lots.push(lot);
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
}
