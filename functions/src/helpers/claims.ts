import * as admin from 'firebase-admin';

/**
 * Syncs the isSuperAdmin custom claim on a Firebase Auth user.
 * Claims are cached in the JWT — callers must call getIdToken(true) to pick up the new value.
 */
export async function syncClaims(uid: string, isSuperAdmin: boolean): Promise<void> {
  await admin.auth().setCustomUserClaims(uid, { isSuperAdmin });
}
