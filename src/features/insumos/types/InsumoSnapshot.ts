/**
 * InsumoSnapshot — congelamento imutável de um insumo no momento da corrida.
 *
 * Decisão B1 (2026-04-21): toda corrida salva snapshot completo (não só ID),
 * pra que alteração/descarte do doc mestre não apague a trilha da corrida.
 * Base regulatória: RDC 786/2023 art. 42 (rastreabilidade de insumos).
 *
 * Superset de `RunReagenteSnapshot` (legado de Hematologia) — novos módulos
 * usam este tipo; Hematologia transiciona gradualmente preservando o array
 * `reagentesSnapshot` antigo por backward-compat.
 */

import type { Timestamp } from 'firebase/firestore';
import type { Insumo, InsumoTipo, InsumoModulo } from './Insumo';

export interface InsumoSnapshot {
  /** ID do doc mestre. Pode apontar para doc editado/descartado depois. */
  id: string;
  tipo: InsumoTipo;
  /** Módulos declarados no insumo no momento da corrida. */
  modulos: InsumoModulo[];

  fabricante: string;
  nomeComercial: string;
  lote: string;

  /** Validade de fábrica (fechado). */
  validade: Timestamp;
  /** Validade efetiva no momento da corrida — essencial para auditoria. */
  validadeReal: Timestamp;

  /** Quando foi aberto — `null` se usado ainda fechado (raro). */
  dataAbertura: Timestamp | null;

  /**
   * Status de CQ de insumo no momento do uso. Relevante em Imuno (CQ por lote)
   * e em reagentes recém-abertos (Hemato/Coag/Uro). Nulo/ausente em controles
   * que não carregam esse conceito.
   */
  qcStatus?: 'pendente' | 'aprovado' | 'reprovado';

  /** Registro ANVISA — exigido por RDC 786 em inspeções. */
  registroAnvisa?: string;

  // ── Fase Worklab (2026-06-02) — vínculo com AberturaLote ────────────────────
  /**
   * ID da AberturaLote que originou o uso deste insumo (subcoleção
   * `aberturas/` no módulo dono). Permite rastrear qual worklist/worklab
   * ID estava ativo quando o insumo foi consumido, sem join.
   */
  aberturaId?: string;
  /**
   * Worklab ID da abertura (string numérica `^\d{1,10}$`).
   * Desnormalizado para queries que filtram por worklab sem lookup da abertura.
   */
  worklabIdInicio?: string;
  /**
   * Timestamp Firestore de quando a abertura foi registrada — congela o momento
   * de início do uso do insumo para fins de auditoria.
   */
  worklabIdAberturaEm?: import('firebase/firestore').Timestamp;
}

/**
 * Contexto opcional passado ao `buildInsumoSnapshot` para popular os campos
 * da Fase Worklab (2026-06-02). Origem típica: a `UroAberturaLote` selecionada
 * no picker no momento da corrida.
 */
export interface BuildInsumoSnapshotContext {
  /** ID do doc de AberturaLote (subcoleção `aberturas/`). */
  aberturaId?: string;
  /** Worklab ID numérico (`^\d{1,10}$`). */
  worklabIdInicio?: string;
  /** Timestamp Firestore de quando a abertura foi registrada. */
  worklabIdAberturaEm?: import('firebase/firestore').Timestamp;
}

/**
 * Constrói um snapshot congelado a partir de um insumo mestre. Puro, sem IO —
 * chamado no save do run antes de gravar no Firestore.
 *
 * Aceita um `context` opcional para popular os campos da Fase Worklab
 * (aberturaId, worklabIdInicio, worklabIdAberturaEm) quando a origem do insumo
 * é uma `UroAberturaLote`.
 */
export function buildInsumoSnapshot(
  insumo: Insumo,
  context?: BuildInsumoSnapshotContext,
): InsumoSnapshot {
  const snap: InsumoSnapshot = {
    id: insumo.id,
    tipo: insumo.tipo,
    modulos:
      Array.isArray(insumo.modulos) && insumo.modulos.length > 0
        ? [...insumo.modulos]
        : [insumo.modulo],
    fabricante: insumo.fabricante,
    nomeComercial: insumo.nomeComercial,
    lote: insumo.lote,
    validade: insumo.validade,
    validadeReal: insumo.validadeReal,
    dataAbertura: insumo.dataAbertura ?? null,
  };

  // Campos opcionais — só popula se presentes para não injetar `undefined`.
  if (insumo.tipo === 'reagente' || insumo.tipo === 'tira-uro') {
    // Cast seguro pelos discriminants do union.
    const maybeQc = (insumo as { qcStatus?: InsumoSnapshot['qcStatus'] }).qcStatus;
    if (maybeQc) snap.qcStatus = maybeQc;
  }

  if (insumo.registroAnvisa) snap.registroAnvisa = insumo.registroAnvisa;

  // Fase Worklab (2026-06-02) — popula vínculo com AberturaLote se fornecido.
  if (context?.aberturaId) snap.aberturaId = context.aberturaId;
  if (context?.worklabIdInicio) snap.worklabIdInicio = context.worklabIdInicio;
  if (context?.worklabIdAberturaEm) snap.worklabIdAberturaEm = context.worklabIdAberturaEm;

  return snap;
}

/**
 * Conjunto de snapshots usado em cada corrida. Preenchido no save a partir do
 * EquipmentSetup ativo (modo analisador) ou do ManualKitPicker (modo manual).
 * Slots opcionais refletem heterogeneidade dos módulos:
 *   - Hematologia/Coagulação: reagente + controle obrigatórios
 *   - Uroanálise: tira obrigatória; controle condicional (lote.requerControlePorCorrida)
 *   - Imuno analisador: reagente obrigatório; SEM controle por corrida
 *   - Imuno manual (Fase F 2026-04-24): reagente + controlePositivo +
 *     controleNegativo — os 3 itens do kit manual (PCR látex, VDRL em lâmina,
 *     cartela imuno) vão juntos na corrida, sem passar por EquipmentSetup.
 */
export interface InsumosSnapshotSet {
  reagente?: InsumoSnapshot;
  reagenteTtpa?: InsumoSnapshot;
  controle?: InsumoSnapshot;
  tira?: InsumoSnapshot;
  /** Controle positivo do kit manual — esperado reagente ("R"). */
  controlePositivo?: InsumoSnapshot;
  /** Controle negativo do kit manual — esperado não-reagente ("NR"). */
  controleNegativo?: InsumoSnapshot;
}
