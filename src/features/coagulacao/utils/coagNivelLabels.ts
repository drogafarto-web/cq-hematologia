import type { CoagNivel } from '../types/_shared_refs';

/** Rótulo operacional — paridade com “Nível NVx” da hematologia, sem prefixo NV. */
export function formatCoagNivelLabel(nivel: CoagNivel): string {
  return `Nível ${nivel}`;
}

/** Rótulo com qualificador clínico (export, PDF, formulário). */
export function formatCoagNivelDetail(nivel: CoagNivel): string {
  const qual = nivel === 'I' ? 'Normal' : 'Patológico';
  return `${formatCoagNivelLabel(nivel)} — ${qual}`;
}
