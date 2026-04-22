/**
 * FrequencyConfig — modelo estruturado de frequência de corridas de CQ.
 *
 * Substitui a string livre que convivia com legislação misturada
 * ("Diária — RDC 302/2005"). Legislação fica num campo separado
 * (`regulatoryReferences`) configurado por módulo em lab-settings.
 *
 * Fica no lote de controle (por módulo). Cada lote define sua cadência.
 *
 * Decisão CTO 2026-04-21 — Fase B1.
 */

export type FrequencyType =
  | 'diaria'
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'custom';

export interface FrequencyConfig {
  frequencyType: FrequencyType;
  /** Obrigatório quando `frequencyType === 'custom'`. Válido 1–180 dias. */
  frequencyDays?: number;
}

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  custom: 'Personalizada',
};

export const FREQUENCY_DAYS_MAP: Record<Exclude<FrequencyType, 'custom'>, number> = {
  diaria: 1,
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
};

/**
 * Validação estrutural — `custom` exige `frequencyDays` entre 1 e 180.
 * Demais tipos não aceitam `frequencyDays` (é ignorado silenciosamente).
 */
export function validateFrequencyConfig(
  c: FrequencyConfig,
): { ok: true } | { ok: false; error: string } {
  if (c.frequencyType === 'custom') {
    if (typeof c.frequencyDays !== 'number') {
      return { ok: false, error: 'Frequência personalizada requer número de dias.' };
    }
    if (!Number.isFinite(c.frequencyDays)) {
      return { ok: false, error: 'Número de dias inválido.' };
    }
    if (c.frequencyDays < 1 || c.frequencyDays > 180) {
      return { ok: false, error: 'Dias da frequência fora do intervalo 1–180.' };
    }
  }
  return { ok: true };
}

/**
 * Copy pt-BR — dropdown/relatório. `custom` mostra "a cada N dias".
 */
export function formatFrequencyConfig(c: FrequencyConfig): string {
  if (c.frequencyType === 'custom') {
    const d = c.frequencyDays ?? 0;
    return `A cada ${d} dias`;
  }
  return FREQUENCY_LABELS[c.frequencyType];
}

/**
 * Converte para número de dias — usado em agendadores/relatórios que precisam
 * de cardinalidade. Retorna `null` se `custom` inválido.
 */
export function frequencyToDays(c: FrequencyConfig): number | null {
  if (c.frequencyType === 'custom') {
    return typeof c.frequencyDays === 'number' &&
      c.frequencyDays >= 1 &&
      c.frequencyDays <= 180
      ? c.frequencyDays
      : null;
  }
  return FREQUENCY_DAYS_MAP[c.frequencyType];
}

/**
 * Backward-compat: mapeia strings legadas ("DIARIA"/"LOTE") para FrequencyConfig.
 * "LOTE" → tratamos como 'custom' com 90 dias (meia-vida típica de lote) para
 * não bloquear runs antigas; novos cadastros devem escolher um tipo real.
 */
export function legacyFrequencyToConfig(legacy: string): FrequencyConfig {
  const norm = legacy.toUpperCase();
  if (norm === 'DIARIA') return { frequencyType: 'diaria' };
  if (norm === 'SEMANAL') return { frequencyType: 'semanal' };
  if (norm === 'QUINZENAL') return { frequencyType: 'quinzenal' };
  if (norm === 'MENSAL') return { frequencyType: 'mensal' };
  // 'LOTE' ou desconhecido → custom 90d (fallback seguro).
  return { frequencyType: 'custom', frequencyDays: 90 };
}
