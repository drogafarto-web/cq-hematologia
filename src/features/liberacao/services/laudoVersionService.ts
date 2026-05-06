import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Query,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { ref, getBytes } from 'firebase/storage';
import { storage } from '../../../shared/services/firebase';
import type { LabId } from '../types/_shared_refs';
import { LaudoVersion } from '../types/laudoVersion';

/**
 * Service para gerenciar versões imutáveis de laudos
 * Convenção: /labs/{labId}/laudo-versions/{versionId}
 *
 * Cada versão é imutável (snapshot congelado do laudo em um ponto no tempo)
 * Retificação cria nova versão; não edita anterior
 */

/**
 * Subscribe a todas as versões de um laudo
 */
export function subscribeVersions(
  labId: LabId,
  laudoId: string,
  onData: (versions: LaudoVersion[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, 'labs', labId, 'laudo-versions'),
    where('laudoId', '==', laudoId),
    orderBy('version', 'asc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const versions = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as LaudoVersion[];
      onData(versions);
    },
    (error) => {
      console.error('[subscribeVersions] error:', error);
      onError?.(error);
    }
  );

  return unsubscribe;
}

/**
 * Get versão específica
 */
export async function getVersion(
  labId: LabId,
  versionId: string
): Promise<LaudoVersion | null> {
  const docRef = doc(db, 'labs', labId, 'laudo-versions', versionId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    ...snapshot.data(),
    id: snapshot.id,
  } as LaudoVersion;
}

/**
 * Get URL signed do PDF da versão
 * Storage path: gs://hmatologia2.appspot.com/laudos/{labId}/{laudoId}/v{version}.pdf
 */
export async function getVersionPdfUrl(
  labId: LabId,
  laudoId: string,
  version: number
): Promise<string | null> {
  try {
    // Busca versão pra confirmar existência
    const q = query(
      collection(db, 'labs', labId, 'laudo-versions'),
      where('laudoId', '==', laudoId),
      where('version', '==', version)
    );

    const snapshot = await (await import('firebase/firestore')).getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const versionDoc = snapshot.docs[0].data() as LaudoVersion;

    // Retorna URL se armazenada
    if (versionDoc.pdfUrl) {
      return versionDoc.pdfUrl;
    }

    return null;
  } catch (error) {
    console.error('[getVersionPdfUrl] error:', error);
    return null;
  }
}

/**
 * Download PDF bytes (para refresh local ou processamento)
 * Requer permissão Storage
 */
export async function downloadVersionPdf(
  labId: LabId,
  laudoId: string,
  version: number
): Promise<ArrayBuffer | null> {
  try {
    const path = `laudos/${labId}/${laudoId}/v${version}.pdf`;
    const fileRef = ref(storage, path);
    const bytes = await getBytes(fileRef);
    return bytes;
  } catch (error) {
    console.error('[downloadVersionPdf] error:', error);
    return null;
  }
}
