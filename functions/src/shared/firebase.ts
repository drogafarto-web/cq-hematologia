/**
 * shared/firebase — initialized firebase-admin singletons
 *
 * Re-exports `admin` namespace + `db` Firestore instance for callable handlers.
 * Lazy-initialized: safe to import multiple times.
 */

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export { admin };
