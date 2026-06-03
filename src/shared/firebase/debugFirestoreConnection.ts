/**
 * Diagnóstico leve da conectividade Firestore (sem mutações).
 */

import type { Firestore } from 'firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';

export type DebugFirestoreConnectionReport = {
  labId: string;
  memberPath: string;
  memberDocExists: boolean;
  memberReadCode: string | null;
};

function diagEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return globalThis.localStorage?.getItem('hcq_firebase_diag') === '1';
  } catch {
    return false;
  }
}

export async function debugFirestoreConnection(
  db: Firestore,
  labId: string,
  uid: string,
): Promise<DebugFirestoreConnectionReport> {
  const ref = doc(db, 'labs', labId, 'members', uid);
  const path = ref.path;
  try {
    const snap = await getDoc(ref);
    const report: DebugFirestoreConnectionReport = {
      labId,
      memberPath: path,
      memberDocExists: snap.exists(),
      memberReadCode: null,
    };
    if (diagEnabled()) {
      console.info('[hcq debugFirestoreConnection]', report);
    }
    return report;
  } catch (e: unknown) {
    const code =
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      typeof (e as { code: string }).code === 'string'
        ? (e as { code: string }).code
        : 'unknown';
    const report: DebugFirestoreConnectionReport = {
      labId,
      memberPath: path,
      memberDocExists: false,
      memberReadCode: code,
    };
    if (diagEnabled()) {
      console.info('[hcq debugFirestoreConnection]', report, e);
    }
    return report;
  }
}
