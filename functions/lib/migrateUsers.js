"use strict";
/**
 * migrateUsers.ts — One-time migration script
 *
 * Sets isSuperAdmin custom claim on every existing Firebase Auth user based on
 * their Firestore /users/{uid} document. Also normalises missing fields.
 *
 * Run once after deploying the Cloud Functions that use syncClaims:
 *   cd functions
 *   npx ts-node src/migrateUsers.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS to point to a service account JSON
 * with Firebase Admin permissions (or run inside a GCP environment).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const auth = admin.auth();
async function migrate() {
    console.log('── migrateUsers ─────────────────────────────────────');
    const snap = await db.collection('users').get();
    console.log(`Found ${snap.size} user documents.`);
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    for (const docSnap of snap.docs) {
        const uid = docSnap.id;
        const data = docSnap.data();
        try {
            // 1. Sync custom claim
            const isSuperAdmin = data.isSuperAdmin === true;
            await auth.setCustomUserClaims(uid, { isSuperAdmin });
            // 2. Normalise missing Firestore fields (never overwrite existing values)
            const patch = {};
            if (data.disabled === undefined)
                patch.disabled = false;
            if (!data.contact)
                patch.contact = {};
            if (!data.audit) {
                patch['audit.migratedAt'] = admin.firestore.FieldValue.serverTimestamp();
            }
            if (data.displayName && !data.displayName.trim()) {
                patch.displayName = data.email ?? uid;
            }
            if (Object.keys(patch).length > 0) {
                await docSnap.ref.update(patch);
            }
            console.log(`  ✓ ${uid} — isSuperAdmin=${isSuperAdmin}`);
            updated++;
        }
        catch (err) {
            console.error(`  ✗ ${uid} —`, err instanceof Error ? err.message : err);
            errors++;
        }
    }
    console.log('─────────────────────────────────────────────────────');
    console.log(`Done. updated=${updated}  skipped=${skipped}  errors=${errors}`);
}
migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
//# sourceMappingURL=migrateUsers.js.map