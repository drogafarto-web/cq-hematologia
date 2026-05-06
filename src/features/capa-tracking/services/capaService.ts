/**
 * capaService.ts
 *
 * Camada de persistência multi-tenant do módulo CAPA Tracking.
 * Toda operação recebe `labId` explicitamente — não há caminho que permita
 * escrita sem tenant. Documentos também carregam `labId` redundante para
 * defense-in-depth nas security rules.
 *
 * Deleção é sempre lógica (RN-06) — nenhuma função deste arquivo invoca
 * `deleteDoc`. Guarda de 5 anos conforme RDC 978/2025.
 *
 * Nota: CAPAs são subdocumentos de Non-Conformidades criadas na Phase 5 (Auditoria).
 * Estrutura: `/labs/{labId}/naoConformidades/{ncId}/capaPlano/{capaId}`
 */

import {
  Timestamp,
  collection,
  db,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { CAPA, CAPAInput } from '../types';

// ─── Paths multi-tenant ───────────────────────────────────────────────────────

/**
 * Retorna a coleção raiz de non-conformidades para um lab.
 */
const nonConformidadesCol = (labId: string): CollectionReference =>
  collection(db, 'labs', labId, 'naoConformidades');

/**
 * Retorna a referência a um documento específico de non-conformidade.
 */
const nonConformidadeDoc = (labId: string, ncId: string): DocumentReference =>
  doc(nonConformidadesCol(labId), ncId);

/**
 * Retorna a subcoleção de CAPAs dentro de uma non-conformidade.
 * Estrutura: `/labs/{labId}/naoConformidades/{ncId}`
 * Nota: Em Firestore, CAPAs são armazenadas como um campo `capaPlano` subdocumento,
 * ou como documento separado. Aqui temos o CAPA como field no NC document.
 * Service lê via getDoc em naoConformidades + acessa field capaPlano.
 */
const capaFromNC = (labId: string, ncId: string): DocumentReference =>
  nonConformidadeDoc(labId, ncId);

// ─── Mapping snapshot → entidade ──────────────────────────────────────────────

/**
 * Extrai um CAPA do subdocumento `capaPlano` dentro de uma Non-Conformidade.
 */
function mapCAPAFromNC(ncId: string, labId: string, capaData: any): CAPA {
  return {
    id: ncId,
    labId,
    ncId,
    finding: capaData.finding ?? '',
    dicqRef: capaData.dicqRef ?? '',
    priority: capaData.priority ?? 'media',
    deadline: capaData.deadline,
    owner: capaData.owner ?? '',
    ownerName: capaData.ownerName ?? '',
    status: capaData.status ?? 'aberto',
    transitions: capaData.transitions ?? [],
    evidence: capaData.evidence ?? [],
    effectivenessCriteria: capaData.effectivenessCriteria ?? '',
    closedAt: capaData.closedAt,
    closedBy: capaData.closedBy,
    closureSignature: capaData.closureSignature,
    createdAt: capaData.createdAt,
    createdBy: capaData.createdBy,
    deletedAt: capaData.deletedAt ?? null,
  };
}

// ─── API: CAPA ─────────────────────────────────────────────────────────────────

/**
 * Retorna um CAPA específico pelo ID (que é o ncId).
 * Lê o documento de Non-Conformidade e extrai o campo capaPlano.
 */
export async function getCAPA(labId: string, capaId: string): Promise<CAPA | null> {
  const ncDoc = await getDoc(capaFromNC(labId, capaId));
  if (!ncDoc.exists()) {
    return null;
  }
  const data = ncDoc.data();
  const capaPlano = data?.capaPlano;
  if (!capaPlano) {
    return null;
  }
  return mapCAPAFromNC(capaId, labId, capaPlano);
}

/**
 * Inscreve-se a mudanças em tempo real de todos os CAPAs de um lab.
 *
 * Filtra por `deletedAt == null` por padrão (padrão de soft-delete).
 * Ordena por deadline (ascendente) para UI destacar próximas vencidas.
 *
 * Retorna unsubscribe para cleanup em useEffect.
 */
export function watchCAPAs(
  labId: string,
  callback: (capas: CAPA[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const nonConfsCol = nonConformidadesCol(labId);

  return onSnapshot(
    query(nonConfsCol),
    (snapshot) => {
      const capas: CAPA[] = [];
      snapshot.forEach((ncDoc) => {
        const data = ncDoc.data();
        const capaPlano = data?.capaPlano;
        if (capaPlano && capaPlano.deletedAt === null) {
          capas.push(mapCAPAFromNC(ncDoc.id, labId, capaPlano));
        }
      });
      // Ordena por deadline (próximos primeiro)
      capas.sort((a, b) => {
        const aTime = a.deadline?.toMillis?.() ?? 0;
        const bTime = b.deadline?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      callback(capas);
    },
    (error) => {
      onError?.(error);
    },
  );
}

/**
 * Atualiza um CAPA (campos de negócio).
 * Chamado por Cloud Function callable após validação de transição.
 * Service aqui é apenas persistência — sem validação de estado.
 */
export async function updateCAPAStatus(
  labId: string,
  capaId: string,
  patch: Partial<CAPAInput>,
): Promise<void> {
  const ncRef = capaFromNC(labId, capaId);
  await updateDoc(ncRef, { 'capaPlano': { ...patch } });
}

/**
 * Deleção lógica de um CAPA (RN-06).
 * Marca `deletedAt` com timestamp do servidor.
 * Nunca remove o documento — mantém guarda de 5 anos (RDC 978/2025).
 */
export async function softDeleteCAPA(
  labId: string,
  capaId: string,
): Promise<void> {
  const ncRef = capaFromNC(labId, capaId);
  await updateDoc(ncRef, {
    'capaPlano.deletedAt': serverTimestamp(),
  });
}

/**
 * Reverte deleção lógica de um CAPA.
 */
export async function restoreCAPA(
  labId: string,
  capaId: string,
): Promise<void> {
  const ncRef = capaFromNC(labId, capaId);
  await updateDoc(ncRef, {
    'capaPlano.deletedAt': null,
  });
}
