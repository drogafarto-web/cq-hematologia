/**
 * ciqFirebaseService — camada Firestore exclusiva do módulo CIQ-Imuno.
 *
 * Standalone: não usa getDatabaseService() nem a classe FirebaseService
 * do módulo de hematologia. Cada módulo gerencia sua própria subcoleção.
 *
 * Paths:
 *   Lotes: labs/{labId}/ciq-imuno/{lotId}
 *   Runs:  labs/{labId}/ciq-imuno/{lotId}/runs/{runId}
 */

import {
  db,
  storage,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from '../../../shared/services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLLECTIONS, SUBCOLLECTIONS, storagePath } from '../../../constants';
import { firestoreErrorMessage } from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import type { CIQImunoRun, CIQImunoLot } from '../types/CIQImuno';
import type { CIQTestTypeConfig } from '../types/_shared_refs';

// ─── Path helpers ─────────────────────────────────────────────────────────────

function lotsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_IMUNO);
}

function lotRef(labId: string, lotId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_IMUNO, lotId);
}

function runsCol(labId: string, lotId: string) {
  return collection(
    db,
    COLLECTIONS.LABS,
    labId,
    SUBCOLLECTIONS.CIQ_IMUNO,
    lotId,
    SUBCOLLECTIONS.RUNS,
  );
}

function runRef(labId: string, lotId: string, runId: string) {
  return doc(
    db,
    COLLECTIONS.LABS,
    labId,
    SUBCOLLECTIONS.CIQ_IMUNO,
    lotId,
    SUBCOLLECTIONS.RUNS,
    runId,
  );
}

// ─── Lot operations ───────────────────────────────────────────────────────────

/**
 * Busca um lote pelo par (testType, loteControle) — retorna null se não existir.
 * Usado para re-aproveitar um lote já existente ao registrar uma nova corrida.
 */
export async function findCIQLot(
  labId: string,
  testType: CIQImunoLot['testType'],
  loteControle: string,
): Promise<CIQImunoLot | null> {
  try {
    const q = query(
      lotsCol(labId),
      where('testType', '==', testType),
      where('loteControle', '==', loteControle),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<CIQImunoLot, 'id'>) };
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Cria um novo lote de controle.
 * Chamada apenas quando findCIQLot retorna null para o par (testType, loteControle).
 */
export async function createCIQLot(
  labId: string,
  lot: Omit<CIQImunoLot, 'id' | 'createdAt'>,
): Promise<string> {
  try {
    const id = crypto.randomUUID();
    const ref = lotRef(labId, id);
    await setDoc(ref, {
      ...lot,
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Atualiza campos mutáveis de um lote (runCount, lotStatus, ciqDecision).
 */
export async function updateCIQLot(
  labId: string,
  lotId: string,
  fields: Partial<
    Pick<CIQImunoLot, 'runCount' | 'lotStatus' | 'ciqDecision' | 'decisionBy' | 'decisionAt'>
  >,
): Promise<void> {
  try {
    await updateDoc(lotRef(labId, lotId), fields as Record<string, unknown>);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Registra a decisão formal de aprovação/rejeição de um lote pelo RT.
 *
 * Compliance RDC 786/2025 + RDC 978/2025 art. 128:
 *  1. Audit record imutável é gravado em ciq-imuno/{lotId}/audit/{uuid}
 *     ANTES da mutação no lot (subcoleção bloqueia update/delete via Rules).
 *  2. Atualiza ciqDecision, decisionBy, decisionAt, decisionJustificativa
 *     atomicamente no documento do lote.
 *
 * O caller deve garantir reautenticação do operador antes de invocar
 * (via reauthenticateWithCredential). Justificativa é obrigatória para
 * rastreabilidade auditável.
 */
export async function updateLotDecision(
  labId: string,
  lotId: string,
  decision: CIQImunoLot['ciqDecision'],
  decisionBy: string,
  justificativa: string,
  prevDecision?: CIQImunoLot['ciqDecision'],
): Promise<void> {
  try {
    const auditRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_IMUNO,
      lotId,
      SUBCOLLECTIONS.AUDIT,
      crypto.randomUUID(),
    );
    await setDoc(auditRef, {
      action: 'lot_decision',
      actorUid: decisionBy,
      prevValues: { ciqDecision: prevDecision ?? null },
      newValues: { ciqDecision: decision, justificativa },
      createdAt: serverTimestamp(),
    });

    await updateDoc(lotRef(labId, lotId), {
      ciqDecision: decision,
      decisionBy,
      decisionAt: serverTimestamp(),
      decisionJustificativa: justificativa,
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Atualiza metadados editáveis de um lote (datas de abertura e validade do controle).
 * Campos estruturais (testType, loteControle) são imutáveis pós-criação.
 *
 * Registra audit imutável em ciq-imuno/{lotId}/audit/{uuid} antes de persistir.
 */
export async function updateLotMeta(
  labId: string,
  lotId: string,
  fields: Partial<Pick<CIQImunoLot, 'aberturaControle' | 'validadeControle'>>,
  actorUid: string,
  prevValues: Partial<Pick<CIQImunoLot, 'aberturaControle' | 'validadeControle'>>,
): Promise<void> {
  try {
    // Audit first — imutável via Firestore Rules (só setDoc, nunca update/delete)
    const auditRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_IMUNO,
      lotId,
      SUBCOLLECTIONS.AUDIT,
      crypto.randomUUID(),
    );
    await setDoc(auditRef, {
      action: 'lot_edit',
      actorUid,
      prevValues,
      newValues: fields,
      createdAt: serverTimestamp(),
    });

    await updateDoc(lotRef(labId, lotId), fields as Record<string, unknown>);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Exclui um lote e todas as suas corridas (cascade via batch).
 *
 * Registra audit em labs/{labId}/ciq-audit/{uuid} ANTES do batch —
 * o registro sobrevive à exclusão do lote e é rastreável mesmo sem o documento.
 */
export async function deleteCIQLot(
  labId: string,
  lotId: string,
  lotSnapshot: Pick<CIQImunoLot, 'testType' | 'loteControle' | 'runCount' | 'validadeControle'>,
  actorUid: string,
): Promise<void> {
  try {
    // Audit gravado no nível do lab — sobrevive à exclusão do lote
    const auditRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_AUDIT,
      crypto.randomUUID(),
    );
    await setDoc(auditRef, {
      action: 'lot_delete',
      lotId,
      actorUid,
      lotSnapshot,
      createdAt: serverTimestamp(),
    });

    const runsSnap = await getDocs(runsCol(labId, lotId));
    const batch = writeBatch(db);
    runsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(lotRef(labId, lotId));
    await batch.commit();
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Gera o próximo código sequencial de corrida no formato CI-YYYY-NNNN.
 *
 * Usa uma transação Firestore para garantir que o contador seja atômico mesmo
 * sob concorrência (múltiplos operadores salvando simultâneamente).
 *
 * Counter path: labs/{labId}/ciq-imuno-meta/counters
 * Field: runCount (number, inicia em 0)
 */
export async function generateRunCode(labId: string): Promise<string> {
  const counterRef = doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_IMUNO_META, 'counters');
  const year = new Date().getFullYear();

  const nextCount = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().runCount as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { runCount: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });

  return `CI-${year}-${String(nextCount).padStart(4, '0')}`;
}

// ─── Vinculação à Bancada (Fase 1A — 2026-04-25) ─────────────────────────────

/**
 * Vincula um lote à bancada. Atômico — garante que pinHistory é append-only
 * e que o estado prévio seja capturado no audit (prevSetupType).
 *
 * Bloqueia vinculação como 'principal' se o lote ainda não foi aprovado
 * (apenas 'validacao_paralela' é permitido pra lotes pendentes).
 */
export async function vincularCIQLot(
  labId: string,
  lotId: string,
  setupType: 'principal' | 'validacao_paralela',
  actorUid: string,
): Promise<void> {
  const ref = lotRef(labId, lotId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Lote não encontrado.');
      const data = snap.data() as CIQImunoLot;

      if (setupType === 'principal' && data.ciqDecision !== 'A') {
        throw new Error('Setup oficial requer lote aprovado pelo RT.');
      }

      const prevSetupType = data.setupType ?? undefined;
      const entry = {
        at: Timestamp.now(),
        by: actorUid,
        action: 'vinculado' as const,
        setupType,
        ...(prevSetupType && prevSetupType !== null ? { prevSetupType } : {}),
      };

      tx.update(ref, {
        setupType,
        pinnedBy: actorUid,
        pinnedAt: serverTimestamp(),
        pinHistory: [...(data.pinHistory ?? []), entry],
      });
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Desvincula um lote da bancada. Atômico — append-only no pinHistory.
 */
export async function desvincularCIQLot(
  labId: string,
  lotId: string,
  actorUid: string,
): Promise<void> {
  const ref = lotRef(labId, lotId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Lote não encontrado.');
      const data = snap.data() as CIQImunoLot;

      if (!data.setupType) return; // já desvinculado, idempotente

      const entry = {
        at: Timestamp.now(),
        by: actorUid,
        action: 'desvinculado' as const,
        prevSetupType: data.setupType,
      };

      tx.update(ref, {
        setupType: null,
        pinnedBy: null,
        pinnedAt: null,
        pinHistory: [...(data.pinHistory ?? []), entry],
      });
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// ─── Run operations ───────────────────────────────────────────────────────────

/**
 * Persiste uma corrida CIQ-Imuno no Firestore.
 * O run.id deve ser gerado pelo caller (crypto.randomUUID()).
 */
export async function saveCIQRun(labId: string, lotId: string, run: CIQImunoRun): Promise<void> {
  try {
    const { id, ...data } = run;
    await setDoc(runRef(labId, lotId, id), {
      ...data,
      // Garante que createdAt e confirmedAt são serverTimestamp no primeiro save
      createdAt: serverTimestamp(),
      confirmedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Busca todas as corridas de um lote (uma vez, sem listener).
 * Usado pelo useCIQWestgard para análise estatística antes de salvar.
 */
export async function getCIQRuns(labId: string, lotId: string): Promise<CIQImunoRun[]> {
  try {
    const q = query(runsCol(labId, lotId), orderBy('dataRealizacao', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CIQImunoRun, 'id'>) }));
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Faz upload da imagem do strip e retorna a URL pública.
 * Não lança — falha silenciosa (imageUrl ficará vazia; run já está salva).
 */
export async function uploadStripImage(
  labId: string,
  lotId: string,
  runId: string,
  file: File,
): Promise<string> {
  const path = storagePath.imunoStripImage(labId, lotId, runId);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// ─── Real-time subscriptions ──────────────────────────────────────────────────

/**
 * Assina a coleção de lotes de um lab em tempo real.
 * Ordena por createdAt decrescente (mais recentes primeiro).
 */
export function subscribeToCIQLots(
  labId: string,
  callback: (lots: CIQImunoLot[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(lotsCol(labId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const lots = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CIQImunoLot, 'id'>),
      }));
      callback(lots);
    },
    (err) => {
      console.error('[ciqFirebaseService] lots listener error:', err);
      onError?.(new Error(firestoreErrorMessage(err)));
    },
  );
}

/**
 * Assina as corridas de um lote em tempo real.
 * Ordena por dataRealizacao crescente (cronológico).
 */
export function subscribeToCIQRuns(
  labId: string,
  lotId: string,
  callback: (runs: CIQImunoRun[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(runsCol(labId, lotId), orderBy('dataRealizacao', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const runs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CIQImunoRun, 'id'>),
      }));
      callback(runs);
    },
    (err) => {
      console.error(`[ciqFirebaseService] runs[${lotId}] listener error:`, err);
      onError?.(new Error(firestoreErrorMessage(err)));
    },
  );
}

// ─── Audit ────────────────────────────────────────────────────────────────────

/**
 * Grava um registro de auditoria imutável.
 * Firestore Rules bloqueiam update/delete nesta subcoleção.
 */
export async function writeCIQAuditRecord(
  labId: string,
  lotId: string,
  runId: string,
  record: Record<string, unknown>,
): Promise<void> {
  try {
    const auditRef = doc(
      db,
      COLLECTIONS.LABS,
      labId,
      SUBCOLLECTIONS.CIQ_IMUNO,
      lotId,
      SUBCOLLECTIONS.AUDIT,
      runId,
    );
    await setDoc(auditRef, {
      ...record,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Falha de auditoria não deve bloquear o fluxo principal
    console.error('[ciqFirebaseService] audit write failed:', err);
  }
}

// ─── Test Types config ────────────────────────────────────────────────────────

/**
 * Seed padrão de imunoensaios — aplicado quando o doc de config não existe.
 * `manual: true` para testes feitos fora de analisador (aglutinação em lâmina,
 * cartela, imunocromatografia). Um lab pode override qualquer um via UI.
 *
 * Critério: teste que um laboratório pequeno-médio faz por leitura visual,
 * sem leitor automático, com kit manual (reagente + controles do próprio kit).
 * Quando o lab tiver analisador (ex: Architect, Cobas), o admin desmarca manual
 * e a configuração do equipamento volta a valer.
 */
const DEFAULT_TEST_TYPES: CIQTestTypeConfig[] = [
  { name: 'HCG', manual: false },
  { name: 'BhCG', manual: false },
  { name: 'HIV', manual: false },
  { name: 'HBsAg', manual: false },
  { name: 'Anti-HCV', manual: false },
  { name: 'Sifilis', manual: false },
  { name: 'Dengue', manual: false },
  { name: 'COVID', manual: false },
  { name: 'PCR', manual: true },
  { name: 'VDRL', manual: true },
  { name: 'ASO', manual: true },
  { name: 'Fator Reumatoide', manual: true },
  { name: 'Troponina', manual: false },
];

function testTypesDocRef(labId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_IMUNO_CONFIG, 'testTypes');
}

/**
 * Normaliza o raw do Firestore para o shape `CIQTestTypeConfig[]`.
 *
 * Backward-compat on-read: docs pre-2026-04-24 gravam `types: string[]`.
 * Convertemos transparentemente para `[{name, manual:false}]` sem escrever —
 * a próxima mutação (add/remove/rename/setManual) grava o novo shape.
 *
 * Docs novos gravam `types: CIQTestTypeConfig[]`. Entries malformadas são
 * ignoradas (defensivo contra edits manuais).
 */
function normalizeRawTypes(raw: unknown): CIQTestTypeConfig[] {
  if (!Array.isArray(raw)) return [...DEFAULT_TEST_TYPES];
  const out: CIQTestTypeConfig[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ name: item, manual: false });
    } else if (item && typeof item === 'object') {
      const name = (item as { name?: unknown }).name;
      const manual = (item as { manual?: unknown }).manual;
      if (typeof name === 'string' && name.trim()) {
        out.push({ name, manual: manual === true });
      }
    }
  }
  return out.length > 0 ? out : [...DEFAULT_TEST_TYPES];
}

/**
 * Lê o array corrente dentro de uma transação — retorna DEFAULT_TEST_TYPES
 * quando o documento ainda não foi semeado. Consolidar a leitura aqui permite
 * tratar a ausência de doc e o campo inválido no mesmo ponto.
 */
async function readTypesInTx(
  tx: Parameters<Parameters<typeof runTransaction>[1]>[0],
  ref: ReturnType<typeof testTypesDocRef>,
): Promise<CIQTestTypeConfig[]> {
  const snap = await tx.get(ref);
  if (!snap.exists()) return [...DEFAULT_TEST_TYPES];
  return normalizeRawTypes(snap.data().types);
}

/**
 * Assina a lista de tipos de teste em tempo real.
 * Quando o documento ainda não existe, emite os tipos padrão sem tentar
 * semear — a primeira mutação de um admin (addTestType etc.) cria o doc
 * de forma atômica, evitando races entre seed e primeira adição.
 */
export function subscribeToTestTypes(
  labId: string,
  callback: (types: CIQTestTypeConfig[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    testTypesDocRef(labId),
    (snap) => {
      if (!snap.exists()) {
        callback([...DEFAULT_TEST_TYPES]);
        return;
      }
      callback(normalizeRawTypes(snap.data().types));
    },
    (err) => {
      console.error('[ciqFirebaseService] testTypes listener error:', err);
      onError?.(new Error(firestoreErrorMessage(err)));
    },
  );
}

/**
 * Adiciona um tipo de teste de forma atômica.
 * Transação garante que: (a) o doc é semeado com DEFAULTS se ainda não existe,
 * (b) adições concorrentes nunca perdem dados, (c) duplicatas case-insensitive
 * são ignoradas idempotentemente.
 */
export async function addTestType(
  labId: string,
  name: string,
  manual: boolean = false,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const ref = testTypesDocRef(labId);
  try {
    await runTransaction(db, async (tx) => {
      const curr = await readTypesInTx(tx, ref);
      if (curr.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) return;
      const next: CIQTestTypeConfig[] = [...curr, { name: trimmed, manual }];
      tx.set(ref, { types: next, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Remove um tipo de teste de forma atômica, preservando a ordem dos demais.
 */
export async function removeTestType(labId: string, name: string): Promise<void> {
  const ref = testTypesDocRef(labId);
  try {
    await runTransaction(db, async (tx) => {
      const curr = await readTypesInTx(tx, ref);
      const next = curr.filter((t) => t.name !== name);
      if (next.length === curr.length) return; // nada a remover
      tx.set(ref, { types: next, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Renomeia um tipo in-place, preservando a posição no array e a flag manual.
 * Bloqueia se o novo nome colide (case-insensitive) com outro existente.
 */
export async function renameTestType(
  labId: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;
  const ref = testTypesDocRef(labId);
  try {
    await runTransaction(db, async (tx) => {
      const curr = await readTypesInTx(tx, ref);
      const collides = curr.some(
        (t) => t.name !== oldName && t.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (collides) {
        throw new Error(`Já existe um teste com o nome "${trimmed}".`);
      }
      const next = curr.map((t) => (t.name === oldName ? { ...t, name: trimmed } : t));
      tx.set(ref, { types: next, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Alterna a flag `manual` de um tipo — idempotente. Atômico como as demais
 * mutações. Runs já gravados não são afetados (a flag é config, não dado).
 */
export async function setTestTypeManual(
  labId: string,
  name: string,
  manual: boolean,
): Promise<void> {
  const ref = testTypesDocRef(labId);
  try {
    await runTransaction(db, async (tx) => {
      const curr = await readTypesInTx(tx, ref);
      const idx = curr.findIndex((t) => t.name === name);
      if (idx === -1) return;
      if (curr[idx].manual === manual) return;
      const next = [...curr];
      next[idx] = { ...next[idx], manual };
      tx.set(ref, { types: next, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Reordena a lista de tipos. Valida que o array recebido é uma permutação
 * exata do array persistido — evita que uma reordenação concorrente com
 * uma adição apague o novo item. A flag `manual` de cada tipo é preservada.
 */
export async function reorderTestTypes(labId: string, ordered: string[]): Promise<void> {
  const ref = testTypesDocRef(labId);
  try {
    await runTransaction(db, async (tx) => {
      const curr = await readTypesInTx(tx, ref);
      if (curr.length !== ordered.length) {
        throw new Error('Reordenação inválida: a lista divergiu. Recarregue e tente novamente.');
      }
      const byName = new Map(curr.map((t) => [t.name, t]));
      if (ordered.some((n) => !byName.has(n))) {
        throw new Error('Reordenação inválida: conteúdo divergiu. Recarregue e tente novamente.');
      }
      const next = ordered.map((n) => byName.get(n)!);
      tx.set(ref, { types: next, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// ─── Re-export para conveniência ──────────────────────────────────────────────
export type { Unsubscribe };
export { Timestamp };
