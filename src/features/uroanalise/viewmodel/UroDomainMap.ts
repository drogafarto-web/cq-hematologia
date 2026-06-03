/**
 * UroDomainMap.ts — Classificação de domínio dos campos de UroanaliseRun.
 *
 * Metadata-only module. No Firestore, no adapters, no ViewModels.
 * Used by UI components to decide which fields to show, collapse, or hide.
 *
 * Cada campo de `UroanaliseRun` (e os herdados de `CQRun`) é classificado
 * em um de cinco grupos de domínio. A classificação é usada por componentes
 * de detalhe da corrida para renderizar seções colapsáveis, exibir labels
 * semanticamente corretos e filtrar campos por contexto de visualização.
 *
 * Fase 1A — Domain Review (URO_DOMAIN_MAP).
 * Compliance: RDC 978/2025 · CLSI GP16-A3 · DICQ 4.3
 *
 * @see UroanaliseRun — src/features/uroanalise/types/Uroanalise.ts
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UroDomainGroup =
  | 'operation'
  | 'traceability'
  | 'evidence'
  | 'governance'
  | 'infrastructure';

export interface UroDomainGroupMeta {
  /** Rótulo de exibição para a seção de UI. */
  label: string;
  /** Se `true`, a seção começa colapsada na visualização padrão. */
  collapsedByDefault: boolean;
  /** Lista exata de nomes de campo pertencentes a este grupo. */
  fields: readonly string[];
}

export type UroDomainMap = Record<UroDomainGroup, UroDomainGroupMeta>;

// ─── Domain Map ────────────────────────────────────────────────────────────────

/**
 * Mapa de domínio canônico de `UroanaliseRun`.
 *
 * Total de 56 entradas mapeadas:
 *   - 54 campos reais do tipo TypeScript (17 herdados de CQRun + 37 próprios,
 *     incluindo `equipmentId` e `equipamentoId` que coexistem no tipo final)
 *   - 2 campos virtuais (`origemPorAnalito`, `ocrConfianca`) que vivem aninhados
 *     dentro de `resultados.{analito}.{campo}` (ver UroFieldAuditado)
 *
 * Distribuição: 8 operation + 22 traceability + 3 evidence + 16 governance + 7 infrastructure
 */
export const URO_DOMAIN_MAP = {
  operation: {
    label: 'Operação',
    collapsedByDefault: false,
    fields: [
      'nivel',
      'frequencia',
      'dataRealizacao',
      'loteTira',
      'loteControle',
      'resultados',
      'resultadosEsperados',
      'manual',
    ] as const,
  },

  /**
   * Rastreabilidade — campos que provam conformidade regulatória.
   *
   * Inclui dados do operador, equipamento, condições ambientais, insumos
   * (tira e controle com lotes, fabricantes, validades, aberturas e worklab IDs),
   * e snapshots imutáveis que sobrevivem a alterações futuras nos registros mestres.
   *
   * @deprecated `responsavel` — redundante com `operatorName` (herdado de CQRun).
   * Ambos existem como campos separados no tipo para queries Firestore sem join.
   */
  traceability: {
    label: 'Rastreabilidade',
    collapsedByDefault: true,
    fields: [
      // Operador
      'operatorId',
      'operatorName',
      'operatorRole',
      'operatorDocument',
      'createdBy',
      // Equipamento
      'equipmentId', // herdado de CQRun — mesmo campo que equipamentoId em runtime
      'equipamentoId',
      'equipamentoSnapshot',
      // Ambiente
      'temperaturaAmbiente',
      'umidadeAmbiente',
      // Tira reagente
      'tiraMarca',
      'fabricanteTira',
      'validadeTira',
      'aberturaTiraId',
      'worklabIdTira',
      // Controle urinário
      'fabricanteControle',
      'aberturaControle',
      'validadeControle',
      'aberturaControleId',
      'worklabIdControle',
      // Snapshot & redundância
      'insumosSnapshot',
      'responsavel',
    ] as const,
  },

  /**
   * Evidências — dados produzidos pela corrida.
   *
   * Inclui a imagem da tira reagente e metadados de OCR/IA.
   *
   * Nota: `origemPorAnalito` e `ocrConfianca` são campos **virtuais** — não
   * existem como propriedades de topo em `UroanaliseRun`. Eles vivem aninhados
   * dentro de `resultados.{analito}.origem` e `resultados.{analito}.ocrConfianca`
   * respectivamente, como parte do wrapper `UroFieldAuditado<T>` (ver
   * `src/features/uroanalise/types/Uroanalise.ts`).
   *
   * A inclusão destes campos virtuais no grupo `evidence` permite que a UI trate
   * a proveniência e a confiança da leitura como evidência auditável, sem
   * expor a complexidade do tipo aninhado.
   */
  evidence: {
    label: 'Evidências',
    collapsedByDefault: true,
    fields: ['imageUrl', 'origemPorAnalito', 'ocrConfianca'] as const,
  },

  governance: {
    label: 'Governança',
    collapsedByDefault: true,
    fields: [
      // Conformidade
      'conformidade',
      'analitosNaoConformes',
      'alertas',
      'status',
      'isEdited',
      'acaoCorretiva',
      // NOTIVISA (RDC 67/2009 + RDC 551/2021)
      'notivisaTipo',
      'notivisaStatus',
      'notivisaProtocolo',
      'notivisaDataEnvio',
      'notivisaJustificativa',
      // Assinatura & confirmação
      'logicalSignature',
      'confirmedAt',
      // Override de insumos
      'insumoVencidoOverride',
      'qcNaoValidado',
      'overrideMotivo',
    ] as const,
  },

  infrastructure: {
    label: 'Infraestrutura',
    collapsedByDefault: true,
    fields: ['id', 'labId', 'lotId', 'runCode', 'version', 'createdAt', 'previousRunId'] as const,
  },
} as const satisfies UroDomainMap;

// ─── Computed helpers ──────────────────────────────────────────────────────────

/**
 * Todos os nomes de campo de `UroanaliseRun`, incluindo campos virtuais,
 * em uma única lista plana. Útil para iteração genérica ou validação.
 */
export const URO_ALL_FIELDS: readonly string[] = (
  Object.values(URO_DOMAIN_MAP) as UroDomainGroupMeta[]
).flatMap((group) => [...group.fields]);

// ─── Pre-computed O(1) lookup ─────────────────────────────────────────────────

const FIELD_TO_GROUP = new Map<string, UroDomainGroup>();

// Build once at module load
for (const [group, meta] of Object.entries(URO_DOMAIN_MAP)) {
  for (const field of meta.fields) {
    FIELD_TO_GROUP.set(field, group as UroDomainGroup);
  }
}

/**
 * Retorna o grupo de domínio ao qual o campo pertence.
 *
 * @param field — Nome do campo (ex: `'nivel'`, `'operatorName'`, `'imageUrl'`).
 * @returns O grupo de domínio, ou `undefined` se o campo não for reconhecido.
 *
 * @example
 * ```ts
 * getFieldGroup('nivel');           // 'operation'
 * getFieldGroup('logicalSignature'); // 'governance'
 * getFieldGroup('unknown');         // undefined
 * ```
 */
export function getFieldGroup(field: string): UroDomainGroup | undefined {
  return FIELD_TO_GROUP.get(field);
}

/**
 * Retorna todos os nomes de campo pertencentes a um grupo de domínio.
 *
 * @param group — Grupo de domínio alvo.
 * @returns Lista imutável de nomes de campo.
 *
 * @example
 * ```ts
 * getGroupFields('evidence'); // ['imageUrl', 'origemPorAnalito', 'ocrConfianca']
 * ```
 */
export function getGroupFields(group: UroDomainGroup): readonly string[] {
  return URO_DOMAIN_MAP[group].fields;
}
