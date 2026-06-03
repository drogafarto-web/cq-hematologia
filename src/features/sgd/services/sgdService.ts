import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../shared/services/firebase';
import { getAuth } from 'firebase/auth';
import {
  SGDDocumento,
  LogicalSignature,
  DICABloco,
  SiglaDocExterno,
  LinkSuggestion,
  ModuleLink,
} from '../types/SGDDocumento';
import { generateAuditHash } from '../utils/auditHash';

export const sgdService = {
  async createDocument(
    labId: string,
    input: Omit<SGDDocumento, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'aud'>,
  ): Promise<SGDDocumento> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const docRef = doc(collection(db, `labs/${labId}/sgd-externos`));
    const now = serverTimestamp() as Timestamp;

    const payload = {
      ...input,
      labId,
      criadoEm: now,
      criadoPor: user.uid,
      deletadoEm: null,
    };

    const hash = generateAuditHash(payload);
    const aud: LogicalSignature = {
      hash,
      operatorId: user.uid,
      ts: now,
    };

    await setDoc(docRef, { ...payload, aud });

    const created = await getDoc(docRef);
    return {
      id: docRef.id,
      ...created.data(),
    } as SGDDocumento;
  },

  async updateDocument(
    labId: string,
    docId: string,
    updates: Partial<Omit<SGDDocumento, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'aud'>>,
  ): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const ref = doc(db, `labs/${labId}/sgd-externos/${docId}`);
    const existing = await getDoc(ref);

    if (!existing.exists()) throw new Error('Document not found');

    const now = serverTimestamp() as Timestamp;
    const payload = {
      ...existing.data(),
      ...updates,
      atualizadoEm: now,
      atualizadoPor: user.uid,
    };

    const hash = generateAuditHash(payload);
    const aud: LogicalSignature = {
      operatorId: user.uid,
      hash,
      ts: now,
    };

    await updateDoc(ref, { ...updates, aud, atualizadoEm: now, atualizadoPor: user.uid });
  },

  async softDeleteDocument(labId: string, docId: string): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const ref = doc(db, `labs/${labId}/sgd-externos/${docId}`);
    const existing = await getDoc(ref);

    if (!existing.exists()) throw new Error('Document not found');

    const now = serverTimestamp() as Timestamp;
    const payload = {
      ...existing.data(),
      deletadoEm: now,
    };

    const hash = generateAuditHash(payload);
    const aud: LogicalSignature = {
      operatorId: user.uid,
      hash,
      ts: now,
    };

    await updateDoc(ref, {
      deletadoEm: now,
      aud,
    });
  },

  async getDocument(labId: string, docId: string): Promise<SGDDocumento | null> {
    const ref = doc(db, `labs/${labId}/sgd-externos/${docId}`);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return {
      id: snap.id,
      ...snap.data(),
    } as SGDDocumento;
  },

  async listDocuments(
    labId: string,
    filters?: {
      categoria?: DICABloco;
      sigla?: SiglaDocExterno;
      includeDeleted?: boolean;
    },
  ): Promise<SGDDocumento[]> {
    let q: Query = query(collection(db, `labs/${labId}/sgd-externos`), orderBy('criadoEm', 'desc'));

    if (!filters?.includeDeleted) {
      q = query(q, where('deletadoEm', '==', null));
    }

    if (filters?.categoria) {
      q = query(q, where('categoriaICQ', '==', filters.categoria));
    }

    if (filters?.sigla) {
      q = query(q, where('sigla', '==', filters.sigla));
    }

    const snap = await getDocs(q);
    return snap.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as SGDDocumento,
    );
  },

  async addLinkSuggestion(labId: string, docId: string, suggestion: LinkSuggestion): Promise<void> {
    const ref = doc(db, `labs/${labId}/sgd-externos/${docId}`);
    const existing = await getDoc(ref);

    if (!existing.exists()) throw new Error('Document not found');

    const currentSuggestions = existing.data().linksSugeridos || [];
    const updated = [...currentSuggestions, suggestion];

    await this.updateDocument(labId, docId, {
      linksSugeridos: updated,
    });
  },

  async confirmLink(labId: string, docId: string, link: ModuleLink): Promise<void> {
    const ref = doc(db, `labs/${labId}/sgd-externos/${docId}`);
    const existing = await getDoc(ref);

    if (!existing.exists()) throw new Error('Document not found');

    const currentLinks = existing.data().linksConfirmados || [];
    const updated = [...currentLinks, link];

    await this.updateDocument(labId, docId, {
      linksConfirmados: updated,
    });
  },

  async getSignedUrl(labId: string, driveFileId: string): Promise<string> {
    const callable = httpsCallable(functions, 'sgdGetSignedUrl');
    const result = await callable({ labId, driveFileId });
    return (result.data as { url: string }).url;
  },

  async logAuditEvent(
    labId: string,
    event: {
      event: string;
      documentId?: string;
      details?: Record<string, unknown>;
      operatorEmail: string;
      consent: boolean;
    },
  ): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const auditRef = doc(collection(db, `labs/${labId}/sgd-externos-audit`));
    await setDoc(auditRef, {
      ...event,
      operatorId: user.uid,
      ts: serverTimestamp(),
    });
  },
};
