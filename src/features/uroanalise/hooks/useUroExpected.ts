/**
 * useUroExpected.ts — Helper para derivar resultadosEsperados padrão a partir do nível.
 *
 * Provê um default sensato de `resultadosEsperados` para pré-preencher o formulário
 * de nova corrida de uroanálise antes que o operador confirme ou edite os valores.
 *
 * Decisão determinística para critérios multi-valor (nível P):
 *  Para analitos categóricos com múltiplos valores aceitos (ex: ['1+','2+','3+','4+']),
 *  usa `criterio[0]` — o primeiro valor = o menos severo (mais próximo do limiar).
 *  Razão: o material de controle patológico mais comum apresenta positividade discreta
 *  (1+/2+) em vez do extremo da escala. O operador DEVE revisar e ajustar para o valor
 *  real da bula do seu lote específico.
 *
 * Para critérios numéricos (pH, densidade): usa o shape `{min, max}` diretamente.
 * Para critérios categóricos com um único valor (ex: ['NEGATIVO']): usa esse valor.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · CLSI GP16-A3
 */

import { URO_CRITERIOS } from '../UroAnalyteConfig';
import type { UroanaliseRun } from '../types/Uroanalise';
import type { UroNivel, UroValorCategorico } from '../types/_shared_refs';

// ─── Helper público ───────────────────────────────────────────────────────────

/**
 * Retorna o shape default de `resultadosEsperados` para um nível de controle.
 *
 * Regras de derivação:
 *  - Critério categórico com um único valor (ex: `['NEGATIVO']`) → usa esse valor.
 *  - Critério categórico com múltiplos valores (ex: `['1+','2+','3+']`) → usa `criterio[0]`
 *    (o primeiro = menos severo). O operador deve confirmar/editar para o valor da bula
 *    do seu lote específico antes de salvar.
 *  - Critério numérico `{min, max}` (pH, densidade) → usa o shape `{min, max}` diretamente.
 *
 * @param nivel Nível do controle (N | P).
 * @returns     Shape parcial de `resultadosEsperados` com todos os 10 analitos preenchidos.
 */
export function getResultadosEsperadosDefault(
  nivel: UroNivel,
): UroanaliseRun['resultadosEsperados'] {
  const criterios = URO_CRITERIOS[nivel];

  return {
    urobilinogenio: pickCategoricoDefault(
      criterios.urobilinogenio as readonly UroValorCategorico[],
    ),
    glicose: pickCategoricoDefault(criterios.glicose as readonly UroValorCategorico[]),
    cetonas: pickCategoricoDefault(criterios.cetonas as readonly UroValorCategorico[]),
    bilirrubina: pickCategoricoDefault(criterios.bilirrubina as readonly UroValorCategorico[]),
    proteina: pickCategoricoDefault(criterios.proteina as readonly UroValorCategorico[]),
    nitrito: pickCategoricoDefault(criterios.nitrito as readonly UroValorCategorico[]),
    sangue: pickCategoricoDefault(criterios.sangue as readonly UroValorCategorico[]),
    leucocitos: pickCategoricoDefault(criterios.leucocitos as readonly UroValorCategorico[]),
    // pH e densidade são numéricos — usa shape {min, max} diretamente.
    ph: criterios.ph as { min: number; max: number },
    densidade: criterios.densidade as { min: number; max: number },
  };
}

// ─── Helper interno ───────────────────────────────────────────────────────────

/**
 * Seleciona o valor default de um critério categórico.
 *
 * Com um único valor → retorna esse valor (sem ambiguidade).
 * Com múltiplos valores → retorna `criterio[0]` (o menos severo/mais próximo do limiar).
 *
 * @param criterio Array readonly de valores aceitos pelo critério.
 * @returns        Valor default selecionado deterministicamente.
 */
function pickCategoricoDefault(criterio: readonly UroValorCategorico[]): UroValorCategorico {
  return criterio[0];
}
