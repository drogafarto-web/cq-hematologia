import {
  collection,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { EscalaDiaria, EscalaColaborador, Periodo } from '../types/Escala';
import type { LabId, Timestamp } from '../types/shared_refs';

const PERSONNEL_ROOT = 'personnel';

const labRootDoc = (labId: LabId): DocumentReference => doc(db, PERSONNEL_ROOT, labId);

const escalasCol = (labId: LabId): CollectionReference => collection(labRootDoc(labId), 'escalas');

function mapEscala(snap: QueryDocumentSnapshot): EscalaDiaria {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as string,
    data: d.data as Timestamp,
    periodo: (d.turno ?? d.periodo) as Periodo,
    colaboradores: (d.colaboradores ?? []) as EscalaColaborador[],
    rtPresente: Boolean(d.rtPresente),
    rtSubstitutoPresente: Boolean(d.rtSubstitutoPresente),
    observacoes: d.observacoes as string | undefined,
    criadoEm: d.criadoEm as Timestamp,
    updatedAt: d.updatedAt as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

export function watchEscalas(
  labId: LabId,
  startDate: Timestamp,
  endDate: Timestamp,
  callback: (escalas: EscalaDiaria[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    escalasCol(labId),
    where('deletadoEm', '==', null),
    where('data', '>=', startDate),
    where('data', '<=', endDate),
    orderBy('data', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map(mapEscala));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
}
