/**
 * Bidirectional pure adapters between `ControlLot` (collection `/lots`) and
 * `InsumoControle` (collection `/insumos` with `tipo='controle'`). Both
 * collections coexist during the unification rollout — these adapters let
 * consumers expecting `ControlLot` read from either source untouched.
 */

import { Timestamp } from 'firebase/firestore';
import { doc, setDoc, db } from '../../../shared/services/firebase';
import type { ControlLot, Run, ManufacturerStats, InternalStats } from '../../../types';
import type { InsumoControle, InsumoNivel, InsumoModulo } from '../types/Insumo';

// ─── ControlLot.level (1|2|3) ↔ InsumoControle.nivel (categórico) ─────────────

/**
 * Mapeia a numeração 1-3 da bula Controllab pro vocabulário categórico
 * usado em `InsumoControle.nivel`. Hematologia segue o padrão clássico
 * baixo/normal/alto. Imuno usa positivo/negativo (sem mapeamento de nível
 * numérico — esse adapter retorna 'normal' como fallback genérico para
 * controles imuno que casualmente carregassem level numérico).
 */
export function bulaLevelToNivel(level: 1 | 2 | 3): InsumoNivel {
  if (level === 1) return 'baixo';
  if (level === 3) return 'alto';
  return 'normal';
}

/**
 * Mapeia o `nivel` categórico de volta pro numérico 1-3 (perda de
 * informação aceitável — `'patologico'` colapsa pra 3, `'positivo'` pra 1).
 * Usado quando precisamos derivar `ControlLot.level` de um `InsumoControle`
 * que não preserva `bulaLevel` (legado).
 */
export function nivelToBulaLevel(nivel: InsumoNivel): 1 | 2 | 3 {
  switch (nivel) {
    case 'baixo':
    case 'positivo':
      return 1;
    case 'alto':
    case 'patologico':
      return 3;
    case 'normal':
    case 'negativo':
    default:
      return 2;
  }
}

// ─── ControlLot ← InsumoControle ──────────────────────────────────────────────

/**
 * Constrói um `ControlLot` (memória) a partir de um `InsumoControle`
 * (Firestore `/insumos`). Preenche defaults seguros para campos que o
 * InsumoControle não preserva (ex: corridas vêm separadas pela sub-coleção).
 *
 * @param insumo  InsumoControle desserializado.
 * @param runs    Corridas associadas (lidas separadamente da sub-coleção).
 */
export function controlLotFromInsumoControle(insumo: InsumoControle, runs: Run[] = []): ControlLot {
  return {
    id: insumo.id,
    labId: insumo.labId,
    lotNumber: insumo.lote,
    controlName: insumo.controlProgramName ?? insumo.nomeComercial,
    equipmentName: insumo.equipmentName ?? '',
    serialNumber: insumo.serialNumber ?? '',
    level: insumo.bulaLevel ?? nivelToBulaLevel(insumo.nivel),
    startDate: insumo.startDate ? insumo.startDate.toDate() : insumo.createdAt.toDate(),
    expiryDate: insumo.validade.toDate(),
    requiredAnalytes: insumo.requiredAnalytes ?? Object.keys(insumo.stats ?? {}),
    manufacturerStats: (insumo.stats ?? {}) as ManufacturerStats,
    statistics: (insumo.internalStats ?? null) as InternalStats | null,
    runs,
    runCount: insumo.runCount ?? runs.length,
    createdAt: insumo.createdAt.toDate(),
    createdBy: insumo.createdBy,
    ...(insumo.frequencyConfig && { frequencyConfig: insumo.frequencyConfig }),
    ...(insumo.requerControlePorCorrida !== undefined && {
      requerControlePorCorrida: insumo.requerControlePorCorrida,
    }),
  };
}

// ─── InsumoControle ← ControlLot ──────────────────────────────────────────────

/**
 * Subset de campos do `InsumoControle` que correspondem a um `ControlLot`,
 * pronto pra escrita em Firestore via `setDoc`. Não inclui `runs` (sub-coleção
 * separada) nem `runCount`/`internalStats` (atualizados server-side).
 *
 * Tipo flexível porque o tenant nem sempre tem `produtoId` resolvido na
 * hora do cadastro de bula — alguns campos ficam vazios e são preenchidos
 * pelo backfill posterior.
 */
export type InsumoControleWriteData = Omit<
  InsumoControle,
  'id' | 'runCount' | 'lastRunAt' | 'internalStats' | 'qcStatus' | 'qcApprovedAt'
> & {
  // Campos que vêm do `ControlLot` mas só fazem sentido depois do produto
  // estar resolvido — opcional pra permitir cadastro direto da bula.
  produtoId?: string;
};

/**
 * Constrói o payload `InsumoControle` (Firestore `/insumos`) a partir de
 * um `ControlLot`. Usado durante dual-write na transição: cada vez que um
 * `ControlLot` é criado/atualizado em `/lots`, esta função gera o espelho
 * para gravar em `/insumos`.
 *
 * Decisões de mapeamento:
 *   - `lote` ← `lotNumber`
 *   - `validade` ← `expiryDate`
 *   - `dataAbertura` ← null (controles Controllab são "abertos" no momento
 *      do uso, não no cadastro — o EquipamentoCard infere do startDate)
 *   - `validadeReal` ← `expiryDate` (sem dataAbertura, igual à validade)
 *   - `status` ← 'ativo' (cadastros novos)
 *   - `nivel` ← derivado de `bulaLevel` (1→baixo, 2→normal, 3→alto)
 *   - `modulo` ← 'hematologia' por default (overridable via param)
 *   - `equipamentosPermitidos` ← derivado de `equipmentName` quando o lab
 *      tem um único equipamento; caso contrário fica vazio (= legado/qualquer)
 */
export function insumoControleWriteDataFromControlLot(
  lot: ControlLot,
  opts: {
    modulo?: InsumoModulo;
    equipamentosPermitidos?: string[];
    fabricante?: string;
  } = {},
): InsumoControleWriteData {
  const modulo = opts.modulo ?? 'hematologia';
  const nivel = bulaLevelToNivel(lot.level);

  return {
    labId: lot.labId,
    tipo: 'controle',
    nivel,
    modulo,
    modulos: [modulo],
    fabricante: opts.fabricante ?? 'Controllab',
    nomeComercial: lot.controlName,
    lote: lot.lotNumber,
    validade: Timestamp.fromDate(lot.expiryDate),
    dataAbertura: null,
    diasEstabilidadeAbertura: 0,
    validadeReal: Timestamp.fromDate(lot.expiryDate),
    status: 'ativo' as const,
    createdAt: Timestamp.fromDate(lot.createdAt),
    createdBy: lot.createdBy,
    stats: lot.manufacturerStats ?? undefined,
    ...(opts.equipamentosPermitidos &&
      opts.equipamentosPermitidos.length > 0 && {
        equipamentosPermitidos: opts.equipamentosPermitidos,
      }),
    bulaLevel: lot.level,
    controlProgramName: lot.controlName,
    startDate: Timestamp.fromDate(lot.startDate),
    equipmentName: lot.equipmentName,
    serialNumber: lot.serialNumber,
    requiredAnalytes: lot.requiredAnalytes,
    ...(lot.frequencyConfig && { frequencyConfig: lot.frequencyConfig }),
    ...(lot.requerControlePorCorrida !== undefined && {
      requerControlePorCorrida: lot.requerControlePorCorrida,
    }),
  };
}

// ─── Dual-write: replicate ControlLot → /insumos ──────────────────────────────

/**
 * Replica um `ControlLot` na coleção `/insumos` preservando seu `id` original.
 *
 * Chamada após `saveLot` ter sucesso na coleção legada `/lots`. Falha não
 * desfaz o /lots — a função é fire-and-forget na perspectiva do caller.
 * Uso o mesmo ID propositalmente: quando o cutover trocar a fonte de verdade
 * pra /insumos, o restante do app continua funcionando sem precisar mapear
 * IDs antigos pra novos.
 *
 * Não cria movimentação `entrada` em `/insumo-movimentacoes` — esta é uma
 * réplica, não um recebimento físico. Quando a migração total acontecer,
 * a Cloud Function vai gerar movimentações canônicas se necessário.
 *
 * @param labId         ID do lab.
 * @param lot           ControlLot recém-criado/atualizado em /lots.
 * @param opts          Mesmas opções do `insumoControleWriteDataFromControlLot`.
 * @returns Promise que resolve com o ID gravado (= lot.id).
 */
export async function replicateControlLotToInsumos(
  labId: string,
  lot: ControlLot,
  opts: {
    modulo?: InsumoModulo;
    equipamentosPermitidos?: string[];
    fabricante?: string;
  } = {},
): Promise<string> {
  const writeData = insumoControleWriteDataFromControlLot(lot, opts);
  const ref = doc(db, 'labs', labId, 'insumos', lot.id);
  await setDoc(ref, writeData);
  return lot.id;
}
