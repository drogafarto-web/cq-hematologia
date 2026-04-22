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
}

/**
 * Constrói um snapshot congelado a partir de um insumo mestre. Puro, sem IO —
 * chamado no save do run antes de gravar no Firestore.
 */
export function buildInsumoSnapshot(insumo: Insumo): InsumoSnapshot {
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

  return snap;
}

/**
 * Conjunto de snapshots usado em cada corrida. Preenchido no save a partir do
 * EquipmentSetup ativo. Slots opcionais refletem heterogeneidade dos módulos:
 *   - Hematologia/Coagulação: reagente + controle obrigatórios
 *   - Uroanálise: tira obrigatória; controle condicional (lote.requerControlePorCorrida)
 *   - Imuno: reagente obrigatório; SEM controle por corrida
 */
export interface InsumosSnapshotSet {
  reagente?: InsumoSnapshot;
  controle?: InsumoSnapshot;
  tira?: InsumoSnapshot;
}
