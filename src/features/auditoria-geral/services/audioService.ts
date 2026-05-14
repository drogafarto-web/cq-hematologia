import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

import { storage } from '../../../shared/services/firebase';

export async function uploadAudio(
  labId: string,
  auditoriaId: string,
  indicadorId: string,
  blob: Blob,
  uid: string
): Promise<{ path: string; url: string }> {
  const uuid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `auditoria-geral/${labId}/${auditoriaId}/${indicadorId}/audio-${uuid}.webm`;
  const fileRef = storageRef(storage, path);

  await uploadBytes(fileRef, blob, { contentType: 'audio/webm' });
  const url = await getDownloadURL(fileRef);

  return { path, url };
}
