"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncClaims = syncClaims;
const admin = require("firebase-admin");
/**
 * Syncs the isSuperAdmin custom claim on a Firebase Auth user.
 * Claims are cached in the JWT — callers must call getIdToken(true) to pick up the new value.
 */
async function syncClaims(uid, isSuperAdmin) {
    await admin.auth().setCustomUserClaims(uid, { isSuperAdmin });
}
//# sourceMappingURL=claims.js.map