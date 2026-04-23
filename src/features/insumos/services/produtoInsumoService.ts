/**
 * produtoInsumoService — CRUD do catálogo de produtos de insumo.
 *
 * Fase C (2026-04-21) — separação Produto (catálogo) vs Lote (Insumo atual).
 * Path: /labs/{labId}/produtos-insumos/{produtoId}
 *
 * Queries otimizadas via índices compostos:
 *   - tipo + createdAt DESC
 *   - modulos array-contains + tipo
 *
 * Sem chain hash (produto é cadastro estável, não log). Audit trail fica a
 * cargo de createdBy/updatedBy.
 */

import {
  db,
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { ProdutoInsumo } from '../types/ProdutoInsumo';
import { produtoDedupKey } from '../types/ProdutoInsumo';
import type { InsumoTipo, InsumoModulo } from '../types/Insumo';

// ─── Path helpers ────────────────────────────────────────────────────────────

function produtosCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.PRODUTOS_INSUMOS);
}

function produtoRef(labId: string, produtoId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.PRODUTOS_INSUMOS, produtoId);
}

// ─── Input shapes ────────────────────────────────────────────────────────────

export type CreateProdutoPayload = Omit<ProdutoInsumo, 'id' | 'labId' | 'createdAt' | 'createdBy'> & {
  createdBy: string;
};

/**
 * Patch parcial do produto. Campos opcionais aceitam `null` explícito como
 * "remover do documento" (traduzido em `deleteField()`). `undefined` é
 * ignorado silenciosamente pelo Firestore (ignoreUndefinedProperties=true).
 *
 * `tipo` e `fabricante` são *condicionalmente* mutáveis: só podem mudar
 * enquanto NENHUM lote (Insumo) aponta pro produto — caso contrário quebram
 * o schema dos lotes referenciados e a chave de dedup (`fabricante|nome|tipo`).
 * O service valida no momento do update e rejeita com mensagem clara se
 * houver lote vinculado.
 */
export type UpdateProdutoPayload = {
  tipo?: ProdutoInsumo['tipo'];
  fabricante?: string;
  nomeComercial?: string;
  modulos?: ProdutoInsumo['modulos'];
  codigoFabricante?: string | null;
  registroAnvisa?: string | null;
  funcaoTecnica?: string | null;
  equipamentosCompativeis?: string[] | null;
  diasEstabilidadeAberturaDefault?: number | null;
  nivelDefault?: ProdutoInsumo['nivelDefault'] | null;
  updatedBy: string;
};

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface ProdutoFilters {
  tipo?: InsumoTipo;
  modulo?: InsumoModulo;
  /** Busca textual no cliente em fabricante + nomeComercial + codigoFabricante. */
  query?: string;
}

// ─── Subscription ────────────────────────────────────────────────────────────

/**
 * Assinatura em tempo real ao catálogo de produtos. Filtros aplicados no
 * servidor onde possível; query textual filtra no cliente.
 */
export function subscribeToProdutos(
  labId: string,
  onData: (produtos: ProdutoInsumo[]) => void,
  onError: (err: Error) => void,
  filters: ProdutoFilters = {},
): Unsubscribe {
  const constraints = [];
  if (filters.tipo) constraints.push(where('tipo', '==', filters.tipo));
  if (filters.modulo) constraints.push(where('modulos', 'array-contains', filters.modulo));
  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(produtosCol(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const produtos = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<ProdutoInsumo, 'id'>) }) as ProdutoInsumo,
      );
      onData(filters.query ? filterByText(produtos, filters.query) : produtos);
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

function filterByText(produtos: ProdutoInsumo[], needle: string): ProdutoInsumo[] {
  const q = needle.toLowerCase();
  return produtos.filter(
    (p) =>
      p.fabricante.toLowerCase().includes(q) ||
      p.nomeComercial.toLowerCase().includes(q) ||
      (p.codigoFabricante ?? '').toLowerCase().includes(q),
  );
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Cria novo produto. Bloqueia duplicação exata (fabricante+nomeComercial) —
 * ao invés de rejeitar, retorna o ID existente com flag `wasDuplicate=true`
 * pra UI informar "já existia, usamos o existente".
 */
export async function createProduto(
  labId: string,
  payload: CreateProdutoPayload,
): Promise<{ id: string; wasDuplicate: boolean }> {
  try {
    // Dedup: busca produto existente com mesma chave normalizada.
    const existing = await findProdutoByNameFabricante(
      labId,
      payload.fabricante,
      payload.nomeComercial,
    );
    if (existing) {
      return { id: existing.id, wasDuplicate: true };
    }

    const id = crypto.randomUUID();
    const newDoc: Omit<ProdutoInsumo, 'id'> = {
      ...payload,
      labId,
      createdAt: Timestamp.now(),
    } as Omit<ProdutoInsumo, 'id'>;

    await setDoc(produtoRef(labId, id), newDoc);
    return { id, wasDuplicate: false };
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Atualização parcial de campos mutáveis. Valores `null` viram `deleteField()`
 * — usado pra limpar um campo opcional que foi apagado pelo operador em modo
 * edição.
 *
 * `tipo` e `fabricante` são condicionalmente mutáveis: só passam se NENHUM
 * lote aponta pro produto (guarda contra corrupção de schema dos lotes e
 * colisão de chave de dedup). Operador que tenta mudar com lote vinculado
 * recebe erro explícito — deve descartar os lotes antes, ou cadastrar um
 * novo produto se quiser preservar histórico.
 */
export async function updateProduto(
  labId: string,
  produtoId: string,
  patch: UpdateProdutoPayload,
): Promise<void> {
  try {
    const { updatedBy, ...fields } = patch;
    const isMudandoTipoOuFabricante =
      fields.tipo !== undefined || fields.fabricante !== undefined;
    if (isMudandoTipoOuFabricante) {
      const count = await countInsumosByProduto(labId, produtoId);
      if (count > 0) {
        throw new Error(
          `Não é possível alterar tipo ou fabricante: este produto já tem ${count} lote(s) vinculado(s). Descarte ou desvincule os lotes primeiro, ou cadastre um novo produto.`,
        );
      }
    }
    const update: Record<string, unknown> = {
      updatedBy,
      updatedAt: serverTimestamp(),
    };
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      update[k] = v === null ? deleteField() : v;
    }
    await updateDoc(produtoRef(labId, produtoId), update);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Delete hard — só permitido se nenhum lote (Insumo) aponta pra este produto.
 * Verificação no cliente antes de chamar; rules bloqueiam server-side se for
 * admin/owner (seguir padrão do Insumo).
 */
export async function deleteProduto(labId: string, produtoId: string): Promise<void> {
  try {
    await deleteDoc(produtoRef(labId, produtoId));
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Conta quantos lotes (Insumos) do lab apontam pra este produto — usado pela
 * UI antes de oferecer delete. Zero = liberado; >0 = bloqueado com instrução
 * de descartar/descadastrar os lotes antes.
 */
export async function countInsumosByProduto(
  labId: string,
  produtoId: string,
): Promise<number> {
  try {
    const insumosCol = collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMOS);
    const q = query(insumosCol, where('produtoId', '==', produtoId));
    const snap = await getDocs(q);
    return snap.size;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getProdutoOnce(labId: string, produtoId: string): Promise<ProdutoInsumo | null> {
  try {
    const snap = await getDoc(produtoRef(labId, produtoId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<ProdutoInsumo, 'id'>) } as ProdutoInsumo;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Busca produto existente com mesma chave normalizada (fabricante+nomeComercial).
 * Usado pelo dedup e pelo backfill automático na migração de Insumos legados.
 */
export async function findProdutoByNameFabricante(
  labId: string,
  fabricante: string,
  nomeComercial: string,
): Promise<ProdutoInsumo | null> {
  try {
    const key = produtoDedupKey(fabricante, nomeComercial);
    const snap = await getDocs(produtosCol(labId));
    const match = snap.docs.find((d) => {
      const data = d.data() as ProdutoInsumo;
      return produtoDedupKey(data.fabricante, data.nomeComercial) === key;
    });
    if (!match) return null;
    return { id: match.id, ...(match.data() as Omit<ProdutoInsumo, 'id'>) } as ProdutoInsumo;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
