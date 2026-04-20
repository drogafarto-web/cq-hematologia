/**
 * _shared_refs.ts — Fonte única de verdade para tipos compartilhados do módulo Uroanálise.
 *
 * Importar daqui em todos os hooks, components e services do módulo.
 * NÃO duplicar estes tipos em outros arquivos do módulo.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · RDC 67/2009 + RDC 551/2021
 * Referências: CLSI GP16-A3 · European Urinalysis Guidelines (EUG) · CLSI AUTO10-A
 */

// ─── Nível de Controle ────────────────────────────────────────────────────────

/**
 * Nível do material de controle utilizado na corrida de uroanálise.
 *
 *  N = Normal    — controle negativo; parâmetros dentro do intervalo de referência.
 *  P = Patológico — controle com resultados elevados/positivos; simula urina patológica.
 *
 * Dois níveis são obrigatórios por CLSI GP16-A3.
 */
export type UroNivel = 'N' | 'P';

// ─── Frequência de Realização ─────────────────────────────────────────────────

/**
 * Frequência de realização do controle de qualidade.
 *
 *  DIARIA — Controle realizado uma vez por dia (padrão RDC 302/2005).
 *  LOTE   — Controle vinculado à abertura de novo lote de tiras.
 */
export type UroFrequencia = 'DIARIA' | 'LOTE';

// ─── Status de Decisão do Lote ────────────────────────────────────────────────

/**
 * Decisão formal de aceitação do lote pelo Responsável Técnico.
 *
 *  A         = Aceitável — lote dentro dos critérios RDC 978/2025.
 *  NA        = Não Aceitável — lote com falhas, mas sem reprovação formal.
 *  Rejeitado = Lote reprovado formalmente; requer investigação e ação corretiva registrada.
 */
export type UroStatus = 'A' | 'NA' | 'Rejeitado';

// ─── Status do Lote (calculado automaticamente) ───────────────────────────────

/**
 * Status calculado pelo hook de avaliação sobre o conjunto de runs do lote.
 *
 *  valido    — Lote dentro dos critérios de aceitação; taxa de NC abaixo dos limites.
 *  atencao   — Pelo menos um alerta ativo (ex: validade próxima, taxa de NC elevada).
 *  reprovado — Taxa de NC acima do limite ou lote expirado.
 *  sem_dados — Nenhum run registrado; status indeterminado.
 */
export type UroLotStatus = 'valido' | 'atencao' | 'reprovado' | 'sem_dados';

// ─── Origem do Campo (Auditoria OCR) ──────────────────────────────────────────

/**
 * Origem de preenchimento de um campo de resultado, para fins de auditoria de IA.
 *
 *  MANUAL        — Valor inserido manualmente pelo operador; sem IA envolvida.
 *  OCR_ACEITO    — Valor lido por OCR/IA e aceito pelo operador sem alteração.
 *  OCR_EDITADO   — Valor lido por OCR/IA mas corrigido manualmente pelo operador.
 *  OCR_REJEITADO — Leitura OCR descartada; valor final foi inserido manualmente.
 */
export type UroFieldOrigem = 'MANUAL' | 'OCR_ACEITO' | 'OCR_EDITADO' | 'OCR_REJEITADO';

// ─── Analitos Categóricos ─────────────────────────────────────────────────────

/**
 * Identificadores canônicos dos analitos categóricos (escala ordinal) do exame de urina.
 * Lidos via tiras reagentes (Combur-10, Multistix-10SG, Bioeasy-10, etc.).
 *
 *  urobilinogenio — Urobilinogênio; escala NORMAL/AUMENTADO ou semiquantitativa.
 *  glicose        — Glicose urinária; escala NEG a 4+ semiquantitativa.
 *  cetonas        — Corpos cetônicos; escala NEG / traços / 1+ / 2+ / 3+.
 *  bilirrubina    — Bilirrubina conjugada; escala NEG / 1+ / 2+ / 3+.
 *  proteina       — Proteína total; escala NEG / traços / 1+ / 2+ / 3+ / 4+.
 *  nitrito        — Nitrito bacteriano; escala binária NEGATIVO/PRESENTE.
 *  sangue         — Hemoglobina/eritrócitos; escala NEG / traços / 1+ / 2+ / 3+.
 *  leucocitos     — Leucócitos esterase; escala NEG / traços / 1+ / 2+ / 3+.
 */
export type UroAnalitoCategoricoId =
  | 'urobilinogenio'
  | 'glicose'
  | 'cetonas'
  | 'bilirrubina'
  | 'proteina'
  | 'nitrito'
  | 'sangue'
  | 'leucocitos';

// ─── Analitos Quantitativos ───────────────────────────────────────────────────

/**
 * Identificadores canônicos dos analitos quantitativos/ordinais físico-químicos.
 *
 *  ph         — pH urinário; escala ordinal de 5.0 a 8.5 (passo 0.5).
 *  densidade  — Densidade urinária; escala ordinal de 1.000 a 1.030 (passo 0.005).
 */
export type UroAnalitoQuantitativoId = 'ph' | 'densidade';

// ─── União de todos os analitos ───────────────────────────────────────────────

/**
 * União de todos os analitos suportados no módulo de uroanálise (tiras reagentes).
 * Usar para tipagem de Records e arrays que cobrem o conjunto completo.
 */
export type UroAnalitoId = UroAnalitoCategoricoId | UroAnalitoQuantitativoId;

// ─── Valores Categóricos ──────────────────────────────────────────────────────

/**
 * Escala ordinal unificada para resultados categóricos de uroanálise.
 *
 * Valores semiquantitativos gerais (+, 2+, 3+, 4+, traços):
 *  NEGATIVO  — Ausência do analito; abaixo do limiar de detecção da tira.
 *  TRACOS    — Concentração mínima detectável; "traços" (threshold).
 *  1+        — Positividade discreta (nível 1).
 *  2+        — Positividade moderada (nível 2).
 *  3+        — Positividade intensa (nível 3).
 *  4+        — Positividade máxima na escala da tira (nível 4).
 *
 * Valores especiais para analitos com escala própria:
 *  NORMAL    — Urobilinogênio dentro do intervalo de referência (~0.2–1.0 EU/dL).
 *  AUMENTADO — Urobilinogênio acima do intervalo de referência (>2.0 EU/dL).
 *  PRESENTE  — Nitrito positivo (indica bacteriúria significativa por bactérias redutoras).
 *
 * Tolerância de avaliação: ±1 nível ordinal é aceitável (convencional CLSI GP16-A3).
 * Desvio >1 nível constitui não conformidade.
 */
export type UroValorCategorico =
  | 'NEGATIVO'
  | 'TRACOS'
  | '1+'
  | '2+'
  | '3+'
  | '4+'
  | 'NORMAL'
  | 'AUMENTADO'
  | 'PRESENTE';

// ─── Alertas de Qualidade ─────────────────────────────────────────────────────

/**
 * Alertas de qualidade gerados pelo hook de avaliação do lote de uroanálise.
 * Análogos ao WestgardCatAlert do ciq-imuno, adaptados para avaliação ordinal.
 *
 *  taxa_nc_10pct      — Taxa de não conformidade >10% no lote (mínimo 10 runs para ativar).
 *  consecutivos_3nc   — 3 runs não conformes consecutivos.
 *  consecutivos_4nc   — 4+ runs não conformes nos últimos 10 runs.
 *  lote_expirado      — `validadeControle` anterior à `dataRealizacao` → lotStatus: reprovado.
 *  validade_30d       — `validadeControle` expira em menos de 30 dias → lotStatus: atencao.
 */
export type UroAlert =
  | 'taxa_nc_10pct'
  | 'consecutivos_3nc'
  | 'consecutivos_4nc'
  | 'lote_expirado'
  | 'validade_30d';
