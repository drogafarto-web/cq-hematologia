/**
 * Script to backfill HMAC for legacy audit entries
 * Usage: node backfill-hmac.mjs --labId=<lab-id>
 */

import admin from 'firebase-admin';
import * as crypto from 'crypto';
import process from 'process';

// Initialize Firebase Admin
admin.initializeApp({ projectId: 'hmatologia2' });

const db = admin.firestore();

// Get secret from environment
const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
if (!secret) {
  console.error('ERROR: HCQ_SIGNATURE_HMAC_KEY not set');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const labIdArg = args.find((arg) => arg.startsWith('--labId='));
const labId = labIdArg ? labIdArg.split('=')[1] : null;

if (!labId) {
  console.error('Usage: node backfill-hmac.mjs --labId=<lab-id>');
  process.exit(1);
}

console.log(`Starting backfill for lab: ${labId}`);

function computeHmac(data, secret) {
  const canonicalJson = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHmac('sha256', secret).update(canonicalJson, 'utf-8').digest('hex');
}

function hashData(data) {
  const json = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(json, 'utf-8').digest('hex');
}

async function backfillHmac() {
  try {
    const collectionPath = `labs/${labId}/insumo-movimentacoes`;
    console.log(`Querying: ${collectionPath}`);

    const snapshot = await db.collection(collectionPath).orderBy('timestamp', 'asc').get();

    console.log(`Found ${snapshot.size} entries`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip if already has HMAC (new format)
      if (data.hmac) {
        skipped++;
        continue;
      }

      // Compute HMAC for legacy entry
      const { hash: oldHash, ...dataForHmac } = data;
      const hmac = computeHmac(dataForHmac, secret);
      const hash = hashData({ ...dataForHmac, hmac });

      // Update document
      const update = {
        hmac,
        hash,
        _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (oldHash) {
        update._legacyHash = oldHash; // Keep old hash for reference if exists
      }
      await doc.ref.update(update);

      updated++;
      processed++;

      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${snapshot.size}`);
      }
    }

    console.log(`
Backfill complete:
  Total: ${snapshot.size}
  Updated: ${updated}
  Skipped: ${skipped}
  Duration: ${Date.now()}ms
    `);

    // Validate chain after backfill
    console.log('Validating chain integrity...');
    let previousHash = null;
    let validationPassed = 0;
    let validationFailed = 0;

    const validated = await db.collection(collectionPath).orderBy('timestamp', 'asc').get();

    for (const doc of validated.docs) {
      const entry = doc.data();

      // Recompute HMAC to verify
      const { hmac, hash, ...dataForVerify } = entry;
      const computedHmac = computeHmac(dataForVerify, secret);

      if (computedHmac !== hmac) {
        console.error(`FAILED: ${doc.id} - HMAC mismatch`);
        validationFailed++;
        continue;
      }

      // Verify chain
      if (entry.previousHash !== previousHash) {
        console.error(
          `FAILED: ${doc.id} - Chain broken (expected ${previousHash}, got ${entry.previousHash})`,
        );
        validationFailed++;
        continue;
      }

      validationPassed++;
      previousHash = entry.hash;
    }

    console.log(`
Validation result:
  Passed: ${validationPassed}
  Failed: ${validationFailed}
  Chain integrity: ${validationFailed === 0 ? 'OK' : 'BROKEN'}
    `);

    process.exit(validationFailed === 0 ? 0 : 1);
  } catch (error) {
    console.error('ERROR during backfill:', error);
    process.exit(1);
  }
}

backfillHmac();
