/**
 * documentoService — CRUD de documentos vinculados a equipamentos.
 *
 * Upload para Firebase Storage + metadados no Firestore.
 * Soft-delete only (retenção 5 anos — RDC 978).
 *
 * Storage path: labs/{labId}/equipamentos/{equipamentoId}/docs/{uuid}.{ext}
 * Firestore:    labs/{labId}/equipamentos/{equipamentoId}/documentos/{docId}
 */

import {
  db,
  storage,
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from '../../../shared/services/firebase';
import type { Unsubscribe, UploadTaskSnapshot } from '../../../shared/services/firebase';
import type { EquipamentoDocumento, DocumentoTipo } from '../types/EquipamentoDocumento';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../types/EquipamentoDocumento';

// ─── Path helpers ─────────────────────────────────────────────────────────────

function documentosCol(labId: string, equipamentoId: string) {
  return collection(db, 'labs', labId, 'equipamentos', equipamentoId, 'documentos');
}

function documentoRef(labId: string, equipamentoId: string, docId: string) {
  return doc(db, 'labs', labId, 'equipamentos', equipamentoId, 'documentos', docId);
}

function storagePath(labId: string, equipamentoId: string, fileName: string): string {
  const uuid = crypto.randomUUID();
  const ext = fileName.split('.').pop() || 'bin';
  return `labs/${labId}/equipamentos/${equipamentoId}/docs/${uuid}.${ext}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    throw new Error(`Tipo de arquivo não permitido: ${file.type}. Use PDF, JPG ou PNG.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Arquivo excede 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadDocumentoInput {
  tipo: DocumentoTipo;
  titulo: string;
  descricao?: string;
  uploadedBy: string;
  uploadedByName: string;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
}

/**
 * Upload de documento para Storage + criação do registro no Firestore.
 * Retorna o ID do documento criado.
 */
export async function uploadDocumento(
  labId: string,
  equipamentoId: string,
  file: File,
  input: UploadDocumentoInput,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  validateFile(file);

  const path = storagePath(labId, equipamentoId, file.name);
  const storageRef = ref(storage, path);

  // Upload com progresso
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      labId,
      equipamentoId,
      tipo: input.tipo,
      uploadedBy: input.uploadedBy,
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percent: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          });
        }
      },
      reject,
      resolve,
    );
  });

  // Criar registro no Firestore
  const docData: Omit<EquipamentoDocumento, 'id'> = {
    labId,
    equipamentoId,
    tipo: input.tipo,
    titulo: input.titulo,
    descricao: input.descricao || undefined,
    storagePath: path,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    uploadedBy: input.uploadedBy,
    uploadedByName: input.uploadedByName,
    uploadedAt: Timestamp.now(),
    deletadoEm: null,
  };

  const docRef = await addDoc(documentosCol(labId, equipamentoId), docData);
  return docRef.id;
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export function subscribeDocumentos(
  labId: string,
  equipamentoId: string,
  callback: (docs: EquipamentoDocumento[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    documentosCol(labId, equipamentoId),
    where('deletadoEm', '==', null),
    orderBy('uploadedAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EquipamentoDocumento);
      callback(docs);
    },
    onError,
  );
}

// ─── Download URL ─────────────────────────────────────────────────────────────

export async function getDocumentoDownloadUrl(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

// ─── Soft delete ──────────────────────────────────────────────────────────────

export async function softDeleteDocumento(
  labId: string,
  equipamentoId: string,
  docId: string,
): Promise<void> {
  await updateDoc(documentoRef(labId, equipamentoId, docId), {
    deletadoEm: serverTimestamp(),
  });
}
