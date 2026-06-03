/**
 * bioquimica/services/analitoService.ts
 *
 * Camada client-direct para CRUD de analitos. Usado pelo UI admin
 * (`AnalitoAdmin`) enquanto Plan 09-04 não introduz a callable equivalente.
 *
 * Migração planejada (Plan 09-04, Fase 0c+):
 *   - `createAnalito` e `updateAnalito` ficarão deprecated por 1 sprint
 *   - Cloud Function `manageAnalito` assume escrita
 *   - Service mantém só `subscribe*` e `softDelete*`
 *
 * Soft-delete only (RN-06). `labId` redundante no payload (defense-in-depth).
 *
 * Threat model relevante:
 *   - T1 mitigado: rules validam `labId == path-labId` (cross-tenant write impossível)
 *   - T5 NÃO se aplica aqui (sem stats Westgard em analito); aplica em runs (Plan 09-04)
 */

import {
  Timestamp,
  collection,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { Analito, AnalitoInput, LabId, UserId } from '../types';
import { ensureBioquimicaRoot } from './bioquimicaService';

// ─── Paths ─────────────────────────────────────────────────────────────────
//
// Mantemos paralelo ao bioquimicaService — os mesmos paths para evitar
// duplicação de root anchor ou drift em refactor futuro.

const analitosCol = (labId: LabId): CollectionReference =>
  collection(doc(db, 'labs', labId), 'bioquimica', 'root', 'analitos');

const analitoDoc = (labId: LabId, analitoId: string): DocumentReference =>
  doc(analitosCol(labId), analitoId);

// ─── Mapping ───────────────────────────────────────────────────────────────

function mapAnalito(snap: QueryDocumentSnapshot): Analito {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    nome: d.nome as string,
    sigla: (d.sigla ?? undefined) as string | undefined,
    unidade: d.unidade as string,
    unidadeSI: (d.unidadeSI ?? undefined) as string | undefined,
    rangeBiologico: d.rangeBiologico as { min: number; max: number },
    metodo: (d.metodo ?? undefined) as string | undefined,
    cvAlvo: (d.cvAlvo ?? undefined) as number | undefined,
    ativo: Boolean(d.ativo),
    seedDefault: Boolean(d.seedDefault),
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

// ─── Subscribe ────────────────────────────────────────────────────────────

/**
 * Real-time subscribe a todos os analitos não-deletados, ordem alfabética.
 * Filtro de `deletadoEm` é client-side (volume baixo — ≤50 analitos por lab).
 */
export function watchAnalitos(
  labId: LabId,
  callback: (list: Analito[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(analitosCol(labId), orderBy('nome', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(mapAnalito).filter((a) => a.deletadoEm === null);
      callback(list);
    },
    (err) => onError?.(err as Error),
  );
}

// ─── Mutations ────────────────────────────────────────────────────────────

/**
 * Cria um analito custom no lab. `seedDefault` é forçado a `false` aqui —
 * só a Cloud Function `seedBioquimicaDefaults` cria com `seedDefault: true`.
 *
 * Service é a única fonte de `id`, `labId`, `criadoEm` e `deletadoEm`.
 *
 * @deprecated após Plan 09-04 — Cloud Function callable assumirá escrita.
 *             Mantido como fallback durante 1 sprint pós-migração.
 */
export async function createAnalito(labId: LabId, input: AnalitoInput): Promise<string> {
  await ensureBioquimicaRoot(labId);
  const ref = doc(analitosCol(labId));
  await setDoc(ref, {
    labId,
    nome: input.nome,
    sigla: input.sigla ?? null,
    unidade: input.unidade,
    unidadeSI: input.unidadeSI ?? null,
    rangeBiologico: input.rangeBiologico,
    metodo: input.metodo ?? null,
    cvAlvo: input.cvAlvo ?? null,
    ativo: input.ativo,
    seedDefault: false, // só callable de seed cria com true
    criadoEm: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

/**
 * Atualiza um analito existente. `labId`, `criadoEm` e `seedDefault` NUNCA
 * mudam — rules validam (`keepsLabId()` + `keepsCreatedAt()`).
 *
 * @deprecated após Plan 09-04 — manageAnalito callable assumirá escrita.
 */
export async function updateAnalito(
  labId: LabId,
  analitoId: string,
  patch: Partial<AnalitoInput>,
): Promise<void> {
  // Whitelist explícito — impede update acidental de labId/seedDefault.
  const allowed: Record<string, unknown> = {};
  if ('nome' in patch) allowed.nome = patch.nome;
  if ('sigla' in patch) allowed.sigla = patch.sigla ?? null;
  if ('unidade' in patch) allowed.unidade = patch.unidade;
  if ('unidadeSI' in patch) allowed.unidadeSI = patch.unidadeSI ?? null;
  if ('rangeBiologico' in patch) allowed.rangeBiologico = patch.rangeBiologico;
  if ('metodo' in patch) allowed.metodo = patch.metodo ?? null;
  if ('cvAlvo' in patch) allowed.cvAlvo = patch.cvAlvo ?? null;
  if ('ativo' in patch) allowed.ativo = patch.ativo;
  allowed.atualizadoEm = serverTimestamp();

  await updateDoc(analitoDoc(labId, analitoId), allowed);
}

/**
 * Soft-delete (RN-06). Marca operador para auditoria.
 */
export async function softDeleteAnalito(
  labId: LabId,
  analitoId: string,
  operatorId: UserId,
): Promise<void> {
  await updateDoc(analitoDoc(labId, analitoId), {
    deletadoEm: serverTimestamp(),
    deletadoPor: operatorId,
  });
}
