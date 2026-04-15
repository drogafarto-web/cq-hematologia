"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncClaims = syncClaims;
exports.syncModuleClaims = syncModuleClaims;
const admin = require("firebase-admin");
/**
 * Returns the current custom claims for a user, or an empty object if none set.
 * Always use this before setCustomUserClaims to prevent silently overwriting
 * unrelated claims (e.g. syncing isSuperAdmin must not wipe modules, and vice versa).
 */
async function getExistingClaims(uid) {
    const user = await admin.auth().getUser(uid);
    return user.customClaims ?? {};
}
/**
 * Syncs the isSuperAdmin custom claim on a Firebase Auth user.
 * Merges with existing claims so that modules and other flags are preserved.
 *
 * IMPORTANT: Claims are cached in the JWT for up to 1 hour.
 * The client must call `await user.getIdToken(true)` after this returns
 * to force-refresh the token and pick up the new value immediately.
 */
async function syncClaims(uid, isSuperAdmin) {
    const existing = await getExistingClaims(uid);
    await admin.auth().setCustomUserClaims(uid, { ...existing, isSuperAdmin });
}
/**
 * Sets the modules map on a user's custom claims.
 * Merges with existing claims so that isSuperAdmin and other flags are preserved.
 *
 * @param uid     - Firebase Auth UID of the target user.
 * @param modules - Map of moduleKey → boolean (e.g. { hematologia: true, bioquimica: false }).
 *
 * IMPORTANT: The client must call `await user.getIdToken(true)` after this returns
 * to force-refresh the token before attempting module-gated Firestore reads.
 */
async function syncModuleClaims(uid, modules) {
    const existing = await getExistingClaims(uid);
    await admin.auth().setCustomUserClaims(uid, { ...existing, modules });
}
//# sourceMappingURL=claims.js.map