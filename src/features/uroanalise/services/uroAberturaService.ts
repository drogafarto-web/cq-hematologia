import {
  Timestamp,
  serverTimestamp,
  runTransaction,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  collection,
  db,
} from '../../../shared/services/firebase';
import { UroAberturaLote } from '../types/Uroanalise';

function aberturasCol(labId: string, lotId: string) {
  return collection(db, 'labs', labId, 'ciq-uroanalise', lotId, 'aberturas');
}

function aberturaRef(labId: string, lotId: string, aberturaId: string) {
  return doc(db, 'labs', labId, 'ciq-uroanalise', lotId, 'aberturas', aberturaId);
}

/**
 * Validates worklabId against the Regex defined in Firestore Rules: ^\d{1,10}$
 */
export function isValidWorklabId(worklabId: string): boolean {
  return /^\d{1,10}$/.test(worklabId);
}

export async function createAbertura(params: {
  labId: string;
  lotId: string;
  worklabId: string;
  abertoPor: string;
  abertoPorNome: string;
  snapshotLote: UroAberturaLote['snapshotLote'];
  dispositivoFabricante?: string;
  dispositivoModelo?: string;
  dispositivoSerie?: string;
  observacoes?: string;
}): Promise<string> {
  if (!isValidWorklabId(params.worklabId)) {
    throw new Error(`worklabId inválido: "${params.worklabId}". Deve conter 1–10 dígitos.`);
  }
  if (!params.labId) {
    throw new Error('labId é obrigatório.');
  }

  const newId = crypto.randomUUID();
  const now = Timestamp.now();

  // Step 1: Find current active abertura outside transaction
  const currentActive = await getAberturaAtiva(params.labId, params.lotId);

  // Step 2: Transaction — revalidate, deactivate, create new
  await runTransaction(db, async (tx) => {
    if (currentActive) {
      const activeRef = aberturaRef(params.labId, params.lotId, currentActive.id);
      const snap = await tx.get(activeRef);
      if (snap.exists() && snap.data()?.ativa === true) {
        tx.update(activeRef, { ativa: false, updatedAt: serverTimestamp() });
      }
    }

    const parentRef = doc(db, 'labs', params.labId, 'ciq-uroanalise', params.lotId);
    tx.set(
      parentRef,
      {
        id: params.lotId,
        labId: params.labId,
        tipo: params.snapshotLote.tipo,
        worklabIdAtual: params.worklabId,
        lotStatus: 'valido',
        runCount: 0,
        createdAt: serverTimestamp(),
        createdBy: params.abertoPor,
        ...(params.snapshotLote.tipo === 'tira'
          ? {
              tiraNome: params.snapshotLote.tiraNome ?? '',
              tiraFabricante: params.snapshotLote.fabricante,
              tiraReferencia: params.snapshotLote.tiraReferencia ?? params.snapshotLote.lote,
              validadeControle: params.snapshotLote.validade,
            }
          : {
              nivel: params.snapshotLote.nivel ?? 'N',
              loteControle: params.snapshotLote.lote,
              fabricanteControle: params.snapshotLote.fabricante,
              validadeControle: params.snapshotLote.validade,
              aberturaControle: now.toDate
                ? now.toDate().toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10),
            }),
      },
      { merge: true },
    );

    const newRef = aberturaRef(params.labId, params.lotId, newId);
    tx.set(newRef, {
      labId: params.labId,
      lotId: params.lotId,
      worklabId: params.worklabId,
      abertoEm: now,
      abertoPor: params.abertoPor,
      abertoPorNome: params.abertoPorNome,
      snapshotLote: params.snapshotLote,
      dispositivoFabricante: params.dispositivoFabricante,
      dispositivoModelo: params.dispositivoModelo,
      dispositivoSerie: params.dispositivoSerie,
      observacoes: params.observacoes,
      ativa: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return newId;
}

export async function getAberturaAtiva(
  labId: string,
  lotId: string,
): Promise<UroAberturaLote | null> {
  if (!labId || !lotId) return null;
  const q = query(aberturasCol(labId, lotId), where('ativa', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<UroAberturaLote, 'id'>) };
}

export async function getAberturaById(
  labId: string,
  lotId: string,
  aberturaId: string,
): Promise<UroAberturaLote | null> {
  const snap = await getDoc(aberturaRef(labId, lotId, aberturaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<UroAberturaLote, 'id'>) };
}

export async function listAberturas(labId: string, lotId: string): Promise<UroAberturaLote[]> {
  if (!labId || !lotId) return [];
  const q = query(aberturasCol(labId, lotId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<UroAberturaLote, 'id'>),
  }));
}
