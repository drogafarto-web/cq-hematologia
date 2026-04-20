/**
 * UroAnalyteConfig.ts — Configurações canônicas de analitos de uroanálise.
 *
 * Exporta critérios de aceitabilidade por nível, opções para button-grid de formulário,
 * labels de exibição, lista ordenada de IDs e marcadores de exclusão de OCR.
 *
 * Critérios de aceitabilidade por nível:
 *  N = Normal/Negativo — controle com resultados dentro do intervalo de referência.
 *  P = Patológico      — controle com resultados elevados/positivos.
 *
 * Avaliação ordinal conforme CLSI GP16-A3: tolerância ±1 nível para parâmetros
 * semiquantitativos. Os critérios aqui definem os valores ESPERADOS pelo fabricante;
 * a lógica de tolerância está em `useUroValidator.ts`.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · CLSI GP16-A3 · EUG (European Urinalysis Guidelines)
 */

import type { UroNivel, UroAnalitoId, UroValorCategorico } from './types/_shared_refs';

// ─── Types para critérios ─────────────────────────────────────────────────────

/**
 * Critério de aceitação categórico (ordinal) — lista de valores aceitos.
 * Um resultado é conforme se seu valor está na lista (avaliação exata).
 * A tolerância ±1 ordinal é aplicada na camada do validator, não aqui.
 */
type UroCriterioCategoricoList = readonly UroValorCategorico[];

/**
 * Critério de aceitação numérico — faixa [min, max] inclusiva.
 * Usado para pH e densidade (analitos quantitativos com escala contínua ordinal).
 */
type UroCriterioNumerico = { min: number; max: number };

/** União dos dois formatos de critério possíveis para um analito de uroanálise. */
export type UroCriterio = UroCriterioCategoricoList | UroCriterioNumerico;

// ─── URO_CRITERIOS ────────────────────────────────────────────────────────────

/**
 * Critérios de aceitabilidade canônicos por nível e analito.
 *
 * Nível N (Normal):
 *  Todos os analitos categóricos esperados negativos/normais.
 *  pH 5.0–6.0 (urina normal ligeiramente ácida).
 *  Densidade 1.005–1.020 (concentração urinária normal).
 *
 * Nível P (Patológico):
 *  Analitos com valores positivos simulando urina patológica.
 *  pH 6.0–8.0 (faixa patológica — alcalinização ou processo infeccioso).
 *  Densidade 1.015–1.030 (urina concentrada/patológica).
 *
 * Fonte: bula do material de controle urinário (Bio-Rad Lyphochek / Randox),
 * alinhada com os valores de referência CLSI GP16-A3 e EUG.
 */
export const URO_CRITERIOS: Record<UroNivel, Record<UroAnalitoId, UroCriterio>> = {
  N: {
    urobilinogenio: ['NORMAL'],
    glicose:        ['NEGATIVO'],
    cetonas:        ['NEGATIVO'],
    bilirrubina:    ['NEGATIVO'],
    proteina:       ['NEGATIVO'],
    nitrito:        ['NEGATIVO'],
    ph:             { min: 5.0, max: 6.0 },
    sangue:         ['NEGATIVO'],
    densidade:      { min: 1.005, max: 1.020 },
    leucocitos:     ['NEGATIVO'],
  },
  P: {
    urobilinogenio: ['AUMENTADO'],
    glicose:        ['1+', '2+', '3+', '4+'],
    cetonas:        ['1+', '2+', '3+', '4+'],
    bilirrubina:    ['1+', '2+', '3+', '4+'],
    proteina:       ['1+', '2+', '3+'],
    nitrito:        ['PRESENTE'],
    ph:             { min: 6.0, max: 8.0 },
    sangue:         ['1+', '2+', '3+'],
    densidade:      { min: 1.015, max: 1.030 },
    leucocitos:     ['1+', '2+', '3+', '4+'],
  },
};

// ─── OPCOES_POR_ANALITO ───────────────────────────────────────────────────────

/**
 * Opções ordinais completas para button-grid de formulário.
 *
 * Ordenadas do menor (mais negativo/normal) para o maior (mais patológico) —
 * permite que o operador selecione rapidamente o resultado por toque.
 *
 * Inclui apenas analitos categóricos (8 de 10).
 * pH e densidade são numéricos e NÃO têm button-grid (campo de input numérico direto).
 *
 * Escala por analito:
 *  urobilinogenio — NORMAL / AUMENTADO (escala binária da tira)
 *  glicose        — NEGATIVO → 4+ (semiquantitativo)
 *  cetonas        — NEGATIVO → 3+ (inclui TRACOS como grau intermediário)
 *  bilirrubina    — NEGATIVO → 3+ (sem TRACOS — resolução da tira)
 *  proteina       — NEGATIVO → 4+ (inclui TRACOS)
 *  nitrito        — NEGATIVO / PRESENTE (escala binária)
 *  sangue         — NEGATIVO → 3+ (inclui TRACOS)
 *  leucocitos     — NEGATIVO → 4+ (inclui TRACOS)
 */
export const OPCOES_POR_ANALITO: Partial<Record<UroAnalitoId, readonly UroValorCategorico[]>> = {
  urobilinogenio: ['NORMAL', 'AUMENTADO'],
  glicose:        ['NEGATIVO', '1+', '2+', '3+', '4+'],
  cetonas:        ['NEGATIVO', 'TRACOS', '1+', '2+', '3+'],
  bilirrubina:    ['NEGATIVO', '1+', '2+', '3+'],
  proteina:       ['NEGATIVO', 'TRACOS', '1+', '2+', '3+', '4+'],
  nitrito:        ['NEGATIVO', 'PRESENTE'],
  sangue:         ['NEGATIVO', 'TRACOS', '1+', '2+', '3+'],
  leucocitos:     ['NEGATIVO', 'TRACOS', '1+', '2+', '3+', '4+'],
  // pH e densidade são numéricos — sem button-grid.
};

// ─── URO_ANALITO_LABELS ───────────────────────────────────────────────────────

/**
 * Labels de exibição para cada analito de uroanálise.
 * Usar em UI, cabeçalhos de tabela, tooltips e relatórios impressos.
 */
export const URO_ANALITO_LABELS: Record<UroAnalitoId, string> = {
  urobilinogenio: 'Urobilinogênio',
  glicose:        'Glicose',
  cetonas:        'Cetonas',
  bilirrubina:    'Bilirrubina',
  proteina:       'Proteína',
  nitrito:        'Nitrito',
  sangue:         'Sangue oculto',
  leucocitos:     'Leucócitos',
  ph:             'pH',
  densidade:      'Densidade',
};

// ─── URO_ANALITOS ─────────────────────────────────────────────────────────────

/**
 * Lista canônica de IDs de analitos de uroanálise — para iteração ordenada em UI.
 *
 * Ordem clínica: da mais específica/importante para controle de qualidade para a
 * menos (grupos: metabólicos → infecciosos → físico-químicos).
 * Esta ordem é usada em: tabelas de runs, formulários, relatórios e avaliação.
 */
export const URO_ANALITOS: readonly UroAnalitoId[] = [
  'urobilinogenio',
  'glicose',
  'cetonas',
  'bilirrubina',
  'proteina',
  'nitrito',
  'ph',
  'sangue',
  'densidade',
  'leucocitos',
] as const;

// ─── URO_ANALITOS_SEM_OCR ─────────────────────────────────────────────────────

/**
 * Analitos que NUNCA recebem sugestão de OCR por ambiguidade ótica.
 *
 * Justificativa por analito:
 *  bilirrubina    — Coloração amarelo-laranja sobrepõe com urobilinogênio na tira;
 *                   contraste insuficiente para discriminação confiável por visão computacional.
 *  urobilinogenio — Comportamento cromático não-linear (escala NORMAL/AUMENTADO tem
 *                   gradiente de cor sutil que varia com pH da urina e fabricante da tira).
 *  densidade      — Escala refratométrica impressa em fontes pequenas com variação de
 *                   tonalidade não-linear; leitura automática não-confiável em diferentes
 *                   condições de iluminação.
 *
 * Estes analitos requerem SEMPRE entrada manual pelo operador, mesmo quando o pipeline
 * de OCR processa os demais analitos da tira.
 *
 * Referência: CLSI AUTO10-A (avaliação de sistemas automatizados de uroanálise).
 */
export const URO_ANALITOS_SEM_OCR: readonly UroAnalitoId[] = [
  'bilirrubina',
  'urobilinogenio',
  'densidade',
] as const;
