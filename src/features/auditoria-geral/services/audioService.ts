import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';

import { storage } from '../../../shared/services/firebase';
import type { AudioEvidencia } from '../types';

export async function uploadAudio(
  labId: string,
  auditoriaId: string,
  indicadorId: string,
  blob: Blob,
  uid: string,
  duration: number,
): Promise<AudioEvidencia> {
  const uuid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `auditoria-geral/${labId}/${auditoriaId}/${indicadorId}/audio-${uuid}.webm`;
  const fileRef = storageRef(storage, path);

  await uploadBytes(fileRef, blob, { contentType: 'audio/webm' });
  const url = await getDownloadURL(fileRef);

  return {
    url,
    path,
    duration,
    transcription: null,
    uploadedAt: Timestamp.now(),
    uploadedBy: uid,
  };
}
