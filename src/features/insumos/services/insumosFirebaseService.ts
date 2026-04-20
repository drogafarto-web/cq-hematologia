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
 * id, labId, validadeReal, createdAt, status.
 *
 * O payload é um discriminated union explícito — `Omit<Insumo, ...>` quebraria
 * o narrowing do TypeScript e forçaria casts em call sites.
 */
type DerivedFields = 'id' | 'labId' | 'validadeReal' | 'createdAt' | 'status';

export type CreateInsumoPayload =
  | (Omit<InsumoControle, DerivedFields> & { createdBy: string })
  | (Omit<InsumoReagente, DerivedFields> & { createdBy: string })
  | (Omit<InsumoTiraUro, DerivedFields> & { createdBy: string });

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
  if (filters.modulo) constraints.push(where('modulo', '==', filters.modulo));
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

    const newDoc: Omit<Insumo, 'id'> = {
      ...payload,
      labId,
      status: 'ativo',
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
 * Marca abertura: seta `dataAbertura`, recalcula `validadeReal`, atualiza status→'ativo'
 * (mesmo se já era), e registra movimentação.
 */
export async function openInsumo(
  labId: string,
  insumoId: string,
  current: Pick<Insumo, 'validade' | 'diasEstabilidadeAbertura'>,
  operadorId: string,
  operadorName: string,
): Promise<void> {
  try {
    const now = new Date();
    const validadeReal = Timestamp.fromDate(
      computeValidadeReal(current.validade.toDate(), now, current.diasEstabilidadeAbertura),
    );

    await updateDoc(insumoRef(labId, insumoId), {
      dataAbertura: Timestamp.fromDate(now),
      validadeReal,
      status: 'ativo',
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

// ─── Movimentações (audit trail imutável) ────────────────────────────────────

type MovimentacaoInput = Omit<InsumoMovimentacao, 'id' | 'timestamp' | 'logicalSignature'>;

/**
 * Grava um registro de movimentação. Imutável por design — rules negam
 * update/delete. `logicalSignature` é populado em v2 quando migrarmos para
 * cadeia hash-linked igual às runs de CIQ.
 */
async function logMovimentacao(
  labId: string,
  input: MovimentacaoInput,
): Promise<void> {
  const id = crypto.randomUUID();
  await setDoc(movRef(labId, id), {
    ...input,
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
