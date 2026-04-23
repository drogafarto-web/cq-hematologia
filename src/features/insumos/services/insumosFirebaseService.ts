/**
 * insumosFirebaseService — camada Firestore do cadastro mestre de insumos.
 *
 * Paths:
 *   Insumos:       labs/{labId}/insumos/{insumoId}
 *   Movimentações: labs/{labId}/insumo-movimentacoes/{movId} (imutável)
 *
 * Arquitetura: client-direct com Firestore Rules como defense-in-depth.
 * Cada mutação de estado (abertura/fechamento/descarte) gera um registro de
 * movimentação para audit trail — exigência de RDC 786/2023 art. 42.
 *
 * @see ../types/Insumo.ts para o modelo discriminado
 * @see ../utils/validadeReal.ts para o cálculo cacheado de validadeReal
 */

import {
  db,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type {
  Insumo,
  InsumoControle,
  InsumoReagente,
  InsumoTiraUro,
  InsumoMovimentacao,
  InsumoFilters,
} from '../types/Insumo';
import { computeValidadeReal } from '../utils/validadeReal';
import { computeMovimentacaoSignature } from '../utils/movimentacaoSignature';

// ─── Path helpers ─────────────────────────────────────────────────────────────

function insumosCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMOS);
}

function insumoRef(labId: string, insumoId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMOS, insumoId);
}

function movsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMO_MOVIMENTACOES);
}

function movRef(labId: string, movId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMO_MOVIMENTACOES, movId);
}

// ─── Input shapes ─────────────────────────────────────────────────────────────

/**
 * Campos auto-preenchidos pelo service (não podem vir do caller):
 * id, labId, validadeReal, createdAt, status, activationsCount, runCount,
 * lastRunAt. `modulos` também é derivado — service sincroniza a partir do
 * `modulo` singular (backward-compat com call sites existentes que só passam
 * o campo legado).
 *
 * O payload é um discriminated union explícito — `Omit<Insumo, ...>` quebraria
 * o narrowing do TypeScript e forçaria casts em call sites.
 */
type DerivedFields =
  | 'id'
  | 'labId'
  | 'validadeReal'
  | 'createdAt'
  | 'status'
  | 'modulos'
  | 'activationsCount'
  | 'runCount'
  | 'lastRunAt';

export type CreateInsumoPayload =
  | (Omit<InsumoControle, DerivedFields> & { createdBy: string; modulos?: InsumoControle['modulos'] })
  | (Omit<InsumoReagente, DerivedFields> & { createdBy: string; modulos?: InsumoReagente['modulos'] })
  | (Omit<InsumoTiraUro, DerivedFields> & { createdBy: string; modulos?: InsumoTiraUro['modulos'] });

/** Campos editáveis pós-criação. Lote/fabricante/validade são imutáveis por padrão. */
export type UpdateInsumoPayload = Partial<
  Pick<Insumo, 'nomeComercial' | 'registroAnvisa' | 'diasEstabilidadeAbertura'>
> & {
  /** Quando ajustes em dataAbertura/validade são permitidos, obriga justificativa. */
  justificativa?: string;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Subscreve em tempo real ao catálogo de insumos do lab, aplicando filtros no servidor
 * quando possível e no cliente para `query` (busca textual livre).
 */
export function subscribeToInsumos(
  labId: string,
  onData: (insumos: Insumo[]) => void,
  onError: (err: Error) => void,
  filters: InsumoFilters = {},
): Unsubscribe {
  const constraints = [];
  if (filters.tipo) constraints.push(where('tipo', '==', filters.tipo));
  // Query em `modulos` (array-contains) — source-of-truth desde 2026-04-21.
  // Docs legados sem `modulos` são invisíveis aqui até o backfill rodar. Lista
  // não filtrada (sem modulo) cobre o cenário "mostrar tudo" em ambos formatos.
  if (filters.modulo) constraints.push(where('modulos', 'array-contains', filters.modulo));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(insumosCol(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const insumos = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<Insumo, 'id'>) }) as Insumo,
      );
      const filtered = filters.query ? filterByText(insumos, filters.query) : insumos;
      onData(filtered);
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

/** Busca case-insensitive em fabricante + nomeComercial + lote. */
function filterByText(insumos: Insumo[], needle: string): Insumo[] {
  const q = needle.toLowerCase();
  return insumos.filter(
    (i) =>
      i.fabricante.toLowerCase().includes(q) ||
      i.nomeComercial.toLowerCase().includes(q) ||
      i.lote.toLowerCase().includes(q),
  );
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Cria um insumo novo. Calcula `validadeReal` no momento da criação e grava um
 * registro de movimentação `entrada` para audit trail.
 *
 * @returns ID gerado (UUID v4).
 */
export async function createInsumo(
  labId: string,
  payload: CreateInsumoPayload,
): Promise<string> {
  try {
    const id = crypto.randomUUID();
    const validadeDate = payload.validade.toDate();
    const aberturaDate = payload.dataAbertura ? payload.dataAbertura.toDate() : null;
    const validadeReal = Timestamp.fromDate(
      computeValidadeReal(validadeDate, aberturaDate, payload.diasEstabilidadeAbertura),
    );

    // Fase A — 2026-04-21: sincroniza `modulos[]` (source-of-truth) com o
    // `modulo` singular legado. Caller pode mandar qualquer um dos dois (ou
    // ambos) — service normaliza. `modulos[0]` é sempre o `modulo` primário
    // para queries legadas e relatórios pré-migração.
    const modulos =
      Array.isArray(payload.modulos) && payload.modulos.length > 0
        ? payload.modulos
        : [payload.modulo];
    const moduloLegado = payload.modulo ?? modulos[0];

    // Status inicial segue o estado físico real do insumo:
    //   - sem dataAbertura → lote ainda lacrado → 'fechado' (não utilizável até
    //     openInsumo registrar a abertura)
    //   - com dataAbertura → lote já aberto em uso → 'ativo'
    // Esta é a única invariante que garante que "Ativos" na listagem reflita
    // insumos realmente em rotina. RDC 786 art. 42 — rastreabilidade exige
    // timestamp formal de abertura.
    const statusInicial: Insumo['status'] = payload.dataAbertura ? 'ativo' : 'fechado';

    const newDoc: Omit<Insumo, 'id'> = {
      ...payload,
      labId,
      modulo: moduloLegado,
      modulos,
      status: statusInicial,
      validadeReal,
      createdAt: Timestamp.now(),
    } as Omit<Insumo, 'id'>;

    await setDoc(insumoRef(labId, id), newDoc);

    await logMovimentacao(labId, {
      insumoId: id,
      tipo: 'entrada',
      operadorId: payload.createdBy,
      operadorName: payload.createdBy, // UI enriquece com displayName quando disponível
    });

    return id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Atualiza campos mutáveis de um insumo. Campos estruturais (lote, validade,
 * tipo, fabricante) são imutáveis — um erro de cadastro pede `descartarInsumo`
 * + novo cadastro para manter trilha histórica limpa.
 */
export async function updateInsumo(
  labId: string,
  insumoId: string,
  patch: UpdateInsumoPayload,
): Promise<void> {
  try {
    const { justificativa: _j, ...fields } = patch;
    await updateDoc(insumoRef(labId, insumoId), fields);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Marca abertura: seta `dataAbertura`, recalcula `validadeReal`, atualiza
 * status→'ativo' (mesmo se já era) e registra movimentação.
 *
 * Para consumíveis ativos em CQ (`tipo in ['reagente','tira-uro']`) adicional-
 * mente marca `qcValidationRequired=true` — flag soft que a próxima corrida
 * de CQ aprovada e que declarar este insumo limpará via
 * `clearInsumoQCValidation`. Ver skill §F3.
 */
export async function openInsumo(
  labId: string,
  insumoId: string,
  current: Pick<Insumo, 'validade' | 'diasEstabilidadeAbertura' | 'tipo'>,
  operadorId: string,
  operadorName: string,
): Promise<void> {
  try {
    const now = new Date();
    const validadeReal = Timestamp.fromDate(
      computeValidadeReal(current.validade.toDate(), now, current.diasEstabilidadeAbertura),
    );

    const requiresQC = current.tipo === 'reagente' || current.tipo === 'tira-uro';

    await updateDoc(insumoRef(labId, insumoId), {
      dataAbertura: Timestamp.fromDate(now),
      validadeReal,
      status: 'ativo',
      ...(requiresQC && { qcValidationRequired: true }),
    });

    await logMovimentacao(labId, {
      insumoId,
      tipo: 'abertura',
      operadorId,
      operadorName,
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/** Marca fechamento — insumo preservado mas não consumível em novas corridas. */
export async function closeInsumo(
  labId: string,
  insumoId: string,
  operadorId: string,
  operadorName: string,
): Promise<void> {
  try {
    await updateDoc(insumoRef(labId, insumoId), {
      status: 'fechado',
      closedAt: serverTimestamp(),
    });

    await logMovimentacao(labId, {
      insumoId,
      tipo: 'fechamento',
      operadorId,
      operadorName,
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Descarte formal — estado terminal. Exige motivo para auditoria sanitária.
 * RDC 786 art. 42: descartes de insumos de diagnóstico requerem registro
 * do motivo + responsável + data.
 */
export async function descartarInsumo(
  labId: string,
  insumoId: string,
  motivo: string,
  operadorId: string,
  operadorName: string,
): Promise<void> {
  try {
    await updateDoc(insumoRef(labId, insumoId), {
      status: 'descartado',
      descartadoEm: serverTimestamp(),
      motivoDescarte: motivo,
    });

    await logMovimentacao(labId, {
      insumoId,
      tipo: 'descarte',
      operadorId,
      operadorName,
      motivo,
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Limpa o flag `qcValidationRequired` de N insumos em batch — chamado após
 * save bem-sucedido de uma CQ run aprovada que declare esses insumos.
 *
 * Idempotente: se o flag já é `false`/ausente, o update é no-op. Falha silen-
 * ciosa por-insumo (tolerante a concorrência com openInsumo) — log de erro
 * no console. Não throws: o save da run não deve reverter por falha aqui.
 *
 * Não gera movimentação própria — clear é efeito colateral de uma CQ run
 * que já tem audit trail próprio no módulo correspondente.
 */
export async function clearInsumoQCValidation(
  labId: string,
  insumoIds: readonly string[],
): Promise<void> {
  if (insumoIds.length === 0) return;
  await Promise.allSettled(
    insumoIds.map(async (id) => {
      try {
        await updateDoc(insumoRef(labId, id), { qcValidationRequired: false });
      } catch (err) {
        console.warn(
          `[insumos][clearQC] falha ao limpar ${id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }),
  );
}

// ─── Movimentações (audit trail imutável + chain hash) ──────────────────────

/**
 * Campos que o caller fornece. O serviço adiciona: `id`, `clientTimestamp`,
 * `payloadSignature`, `chainHash` (null inicial), `chainStatus` ('pending'),
 * `timestamp` (serverTimestamp). O `chainHash` final + `sealedAt` são
 * preenchidos pela Cloud Function `onInsumoMovimentacaoCreate`.
 */
type MovimentacaoInput = Omit<
  InsumoMovimentacao,
  | 'id'
  | 'timestamp'
  | 'clientTimestamp'
  | 'payloadSignature'
  | 'chainHash'
  | 'chainStatus'
  | 'sealedAt'
>;

/**
 * Grava um registro de movimentação. Imutável por design — rules negam
 * update/delete. Cliente calcula `payloadSignature` local; a Cloud Function
 * `onInsumoMovimentacaoCreate` preenche `chainHash` + sela o doc em 1-2s.
 *
 * Falha na rede: a promessa rejeita e o caller rethrow — inconsistência
 * com o estado "principal" do insumo é aceitável em failure-isolated call
 * (abrir/fechar/descartar). Retry fica a cargo do usuário.
 */
async function logMovimentacao(
  labId: string,
  input: MovimentacaoInput,
): Promise<void> {
  const id = crypto.randomUUID();
  const clientTimestamp = new Date().toISOString();
  const payloadSignature = await computeMovimentacaoSignature({
    movId: id,
    insumoId: input.insumoId,
    tipo: input.tipo,
    operadorId: input.operadorId,
    operadorName: input.operadorName,
    clientTimestamp,
    ...(input.motivo !== undefined && { motivo: input.motivo }),
  });

  await setDoc(movRef(labId, id), {
    ...input,
    clientTimestamp,
    payloadSignature,
    chainHash: null,
    chainStatus: 'pending',
    timestamp: serverTimestamp(),
  });
}

/** Busca cronológica das movimentações de um insumo (para audit view). */
export function subscribeToMovimentacoes(
  labId: string,
  insumoId: string,
  onData: (movs: InsumoMovimentacao[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(movsCol(labId), where('insumoId', '==', insumoId), orderBy('timestamp', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<InsumoMovimentacao, 'id'>) }) as InsumoMovimentacao,
        ),
      );
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

/**
 * Incrementa `runCount` e atualiza `lastRunAt` em batch para N insumos.
 * Chamado pelo save de run aprovada após gravar o run — semântica: "estes
 * insumos foram consumidos nesta corrida".
 *
 * Idempotência: não existe por design (cada chamada incrementa). O caller
 * deve chamar exatamente uma vez por save bem-sucedido. FieldValue.increment
 * é atômico no servidor, seguro contra concorrência.
 */
export async function incrementInsumoRunCount(
  labId: string,
  insumoIds: readonly string[],
): Promise<void> {
  if (insumoIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    for (const id of insumoIds) {
      batch.update(insumoRef(labId, id), {
        runCount: increment(1),
        lastRunAt: now,
      });
    }
    await batch.commit();
  } catch (err) {
    // Não relança — falha em incrementar não deve reverter um run já salvo.
    // Log pra observabilidade; operador segue rotina.
    console.warn(
      `[insumos][incrementRunCount] falha: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * Aprova um lote de insumo em Imuno (CQ por lote). Transiciona
 * `qcStatus: 'pendente' → 'aprovado'` + registra approver e timestamp.
 * Idempotente: chamar em lote já aprovado não muda nada (no-op pelo caller).
 *
 * Semântica: após validação em N corridas-teste bem-sucedidas, operador
 * ativa o lote para uso rotineiro. A partir daqui `evaluateInsumoUsability`
 * retorna OK.
 */
export async function aprovarLoteImuno(
  labId: string,
  insumoId: string,
  approverId: string,
  approverName: string,
  validationRunIds?: readonly string[],
): Promise<void> {
  try {
    const patch: Record<string, unknown> = {
      qcStatus: 'aprovado',
      qcApprovedAt: serverTimestamp(),
      qcApprovedBy: approverName,
      qcApprovedByUid: approverId,
    };
    if (validationRunIds && validationRunIds.length > 0) {
      patch.qcValidationRunIds = [...validationRunIds];
    }
    await updateDoc(insumoRef(labId, insumoId), patch);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Reprova um lote — estado terminal que bloqueia uso normal (override
 * continuar permitido com justificativa). Motivo obrigatório.
 */
export async function reprovarLoteImuno(
  labId: string,
  insumoId: string,
  operadorId: string,
  operadorName: string,
  motivo: string,
): Promise<void> {
  if (!motivo || !motivo.trim()) {
    throw new Error('Motivo de reprovação obrigatório.');
  }
  try {
    await updateDoc(insumoRef(labId, insumoId), {
      qcStatus: 'reprovado',
      motivoReprovacao: motivo.trim(),
      qcApprovedAt: serverTimestamp(),
      qcApprovedBy: operadorName,
      qcApprovedByUid: operadorId,
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Rotação assistida — fluxo atômico "fecha lote anterior + abre/confirma novo lote"
 * quando o operador cadastra lote novo do mesmo produto já em uso.
 *
 * Casos cobertos:
 *   1. Novo lote criado FECHADO e há ativo do mesmo produto → fecha o anterior
 *      e abre o novo (status 'fechado' → 'ativo') na mesma operação.
 *   2. Novo lote criado ATIVO (alreadyOpen=true) e há outro ativo do mesmo
 *      produto → apenas fecha o anterior. O novo já está ativo.
 *
 * Chain-hash de movimentações é respeitado — cada lado da rotação gera o seu
 * próprio registro em `insumo-movimentacoes` (abertura+fechamento), preservando
 * audit trail independente por insumo.
 *
 * Não é uma transaction Firestore — as escritas envolvem múltiplos docs em
 * subcoleções distintas (insumos + insumo-movimentacoes). Em caso de falha
 * parcial, o estado é recuperável via reading-time reconciliation (scheduled
 * function já trata status→'vencido' quando validadeReal expira).
 */
export async function rotateInsumoLote(
  labId: string,
  params: {
    /** Insumo anterior (vai fechar). Pode ser null → apenas abre o novo. */
    oldInsumoId: string | null;
    /** Insumo novo (vai abrir se `newAlreadyActive=false`). */
    newInsumoId: string;
    /**
     * Se o novo já foi criado ativo (alreadyOpen no form = true), apenas
     * fecha o anterior — não chama openInsumo.
     */
    newAlreadyActive: boolean;
    /** Metadata da abertura do novo lote (se aplicável). */
    newInsumo?: Pick<Insumo, 'validade' | 'diasEstabilidadeAbertura' | 'tipo'>;
    operadorId: string;
    operadorName: string;
  },
): Promise<void> {
  const { oldInsumoId, newInsumoId, newAlreadyActive, newInsumo, operadorId, operadorName } =
    params;

  // Ordem importa: fecha o anterior PRIMEIRO pra evitar ter dois ativos mesmo
  // que brevemente (cenário de concorrência com outro operador abrindo o
  // mesmo lote em outro dispositivo). Se falhar aqui, o novo continua fechado
  // e o operador pode tentar de novo; se cair entre passos, o anterior está
  // fechado e o novo ainda fechado — estado consistente pra fix manual.
  if (oldInsumoId) {
    await closeInsumo(labId, oldInsumoId, operadorId, operadorName);
  }
  if (!newAlreadyActive && newInsumo) {
    await openInsumo(labId, newInsumoId, newInsumo, operadorId, operadorName);
  }
}

/**
 * Retorna o insumo ativo do mesmo produto (produtoId), se existir, excluindo
 * o próprio insumo recém-criado. Usado para sugerir rotação depois do cadastro.
 *
 * Retorna `null` quando não há ativo anterior ou quando `produtoId` é ausente
 * (docs legados sem vinculação a produto não podem participar da sugestão
 * automática — o operador continua podendo rotacionar manualmente via UI).
 */
export async function findAtivoDoMesmoProduto(
  labId: string,
  produtoId: string | null | undefined,
  excludeInsumoId: string,
): Promise<Insumo | null> {
  if (!produtoId) return null;
  try {
    const q = query(
      insumosCol(labId),
      where('produtoId', '==', produtoId),
      where('status', '==', 'ativo'),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id === excludeInsumoId) continue;
      return { id: d.id, ...(d.data() as Omit<Insumo, 'id'>) } as Insumo;
    }
    return null;
  } catch (err) {
    // Erro aqui não deve reverter a criação do novo lote — retorna null e
    // segue. UI apenas pula a sugestão de rotação.
    console.warn(
      `[insumos][findAtivo] falha: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Single-insumo fetch — usado em tela de detalhe/auditoria.
 * Retorna `null` se o insumo não existe (não lança).
 */
export async function getInsumoOnce(labId: string, insumoId: string): Promise<Insumo | null> {
  try {
    const snap = await getDocs(
      query(insumosCol(labId), where('__name__', '==', insumoId)),
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<Insumo, 'id'>) } as Insumo;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
