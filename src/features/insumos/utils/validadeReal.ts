/**
 * validadeReal — helpers puros para cálculo de validade efetiva de insumos.
 *
 * Sem dependência de Firestore — todos os helpers operam sobre Date em UTC
 * para facilitar testes e previsibilidade em fuso-horário.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Warning threshold — insumos vencendo nos próximos N dias disparam alerta
 * visual nas UIs. RDC 786 não fixa o valor; 7 dias é o padrão adotado por
 * grandes redes laboratoriais (COLA, CAP, SBPC) para ações corretivas.
 */
export const WARNING_DAYS = 7;

/**
 * Validade real = `min(validade, dataAbertura + diasEstabilidade)`.
 *
 * Quando o insumo ainda está fechado (`dataAbertura === null`) ou o fabricante
 * declara estabilidade pós-abertura igual ou inferior a 0, a validade do
 * fabricante é mantida.
 *
 * @param validade                Validade impressa pelo fabricante.
 * @param dataAbertura            Quando foi aberto. `null` = fechado.
 * @param diasEstabilidadeAbertura  Dias de vida útil após abertura.
 */
export function computeValidadeReal(
  validade: Date,
  dataAbertura: Date | null,
  diasEstabilidadeAbertura: number,
): Date {
  if (!dataAbertura || diasEstabilidadeAbertura <= 0) return validade;

  const openExpiry = new Date(dataAbertura.getTime() + diasEstabilidadeAbertura * MS_PER_DAY);
  return openExpiry < validade ? openExpiry : validade;
}

/** true quando `validadeReal` já passou em relação a `now`. */
export function isVencido(validadeReal: Date, now: Date = new Date()): boolean {
  return validadeReal.getTime() < now.getTime();
}

/**
 * Dias (arredondados para cima) até `validadeReal`. Negativo = já vencido.
 * Útil para UI: `< 0` vermelho, `< WARNING_DAYS` âmbar, resto verde.
 */
export function diasAteVencer(validadeReal: Date, now: Date = new Date()): number {
  const ms = validadeReal.getTime() - now.getTime();
  return Math.ceil(ms / MS_PER_DAY);
}

/** Semáforo baseado em `diasAteVencer` — alinhado com o design system. */
export type ValidadeStatus = 'ok' | 'warning' | 'expired';

export function validadeStatus(
  validadeReal: Date,
  now: Date = new Date(),
): ValidadeStatus {
  const dias = diasAteVencer(validadeReal, now);
  if (dias < 0) return 'expired';
  if (dias <= WARNING_DAYS) return 'warning';
  return 'ok';
}
