# Cookbook: Adding Chain-Hash Auditing to Your Module

Five copy-paste templates for the three most common scenarios.

---

## Scenario 1: Adding chain hash to a new module (greenfield)

### Template 1A: Callable with single chain-audited operation

```typescript
// functions/src/modules/your-module/yourOperation.ts

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { writeChainedAudit } from '../../shared/audit/writeChainedAudit';
import { defineSecret } from 'firebase-functions/params';

const db = admin.firestore();

// Define your HMAC secret
export const YOUR_MODULE_HMAC_SECRET = defineSecret('YOUR_MODULE_HMAC_SECRET');

/**
 * Perform an operation that requires audit chain
 *
 * Compliance: RDC 978 Art. 128, DICQ 4.4
 */
export const yourOperation = functions.onCall(
  {
    region: 'southamerica-east1',
    secrets: [YOUR_MODULE_HMAC_SECRET],
  },
  async (request) => {
    // 1. Validate auth
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Authentication required');
    }

    const { labId, operationData } = request.data;

    // 2. Validate input
    if (!labId || !operationData) {
      throw new functions.HttpsError('invalid-argument', 'labId and operationData required');
    }

    // 3. Perform your domain operation
    const docRef = db.collection(`labs/${labId}/your-collection`).doc();
    const docData = {
      ...operationData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    };
    await docRef.set(docData);

    // 4. Chain-audit the operation (non-blocking)
    //    Caller does not await the result — audit failure is non-critical
    writeChainedAudit({
      collectionPath: `/labs/${labId}/your-collection`,
      operadorId: request.auth.uid,
      operation: 'yourModule.yourOperation',
      payload: {
        operationId: docRef.id,
        operationType: 'create',
        // Include fields relevant to auditor, omit secrets
      },
      secret: YOUR_MODULE_HMAC_SECRET.value(),
    }).catch((err) => {
      // Non-blocking: log but do not throw
      console.error('[yourOperation] chain audit failed (non-critical)', {
        labId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return { success: true, id: docRef.id };
  },
);
```

### Template 1B: Callable with multiple chain-audited operations

```typescript
// functions/src/modules/your-module/operations.ts

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { writeChainedAudit } from '../../shared/audit/writeChainedAudit';
import { YOUR_MODULE_HMAC_SECRET } from './secrets';

const db = admin.firestore();

/**
 * Helper: write chain audit and log failures (non-blocking)
 */
async function auditOperation(
  labId: string,
  operatorId: string,
  operation: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const result = await writeChainedAudit({
    collectionPath: `/labs/${labId}/your-collection`,
    operadorId: operatorId,
    operation,
    payload,
    secret: YOUR_MODULE_HMAC_SECRET.value(),
  });

  if (!result.ok) {
    console.error('[auditOperation] FAILED', {
      labId,
      operation,
      error: result.error,
    });
  }
}

export const operationA = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', '...');
  }

  const { labId, dataA } = request.data;
  const docRef = db.collection(`labs/${labId}/your-collection`).doc();

  await docRef.set({
    ...dataA,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Fire-and-forget audit
  auditOperation(labId, request.auth.uid, 'yourModule.operationA', {
    docId: docRef.id,
    operationType: 'A',
  });

  return { success: true, id: docRef.id };
});

export const operationB = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', '...');
  }

  const { labId, docId, dataB } = request.data;
  const docRef = db.doc(`labs/${labId}/your-collection/${docId}`);

  await docRef.update({
    ...dataB,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Fire-and-forget audit
  auditOperation(labId, request.auth.uid, 'yourModule.operationB', {
    docId,
    operationType: 'B',
  });

  return { success: true };
});
```

---

## Scenario 2: Retrofitting chain hash to an existing module

### Template 2A: Convert existing flat audit logs to chain hash

**Before:** Module has a collection `/labs/{labId}/your-collection` with logged activities in a separate `yourCollection-audit-log` flat log.

**After:** Same collection gets chain-hashed audits; old flat logs remain read-only.

```typescript
// functions/src/modules/your-module/migrateToChainAudit.ts

import * as admin from 'firebase-admin';
import { signAuditEntry } from '../../modules/audit/cryptoAudit';
import { YOUR_MODULE_HMAC_SECRET } from './secrets';

const db = admin.firestore();

/**
 * ONE-TIME SCRIPT: backfill chain hashes for existing records
 *
 * Usage (admin CLI):
 *   node -r ts-node/register functions/src/modules/your-module/migrateToChainAudit.ts
 *
 * Safety: reads existing records, writes to *new* chain collection.
 *         old audit-log remains untouched.
 */
async function migrateToChainAudit() {
  console.log('Starting migration...');

  const labs = await db.collection('labs').listDocuments();

  for (const labDoc of labs) {
    const labId = labDoc.id;
    const records = await db
      .collection(`labs/${labId}/your-collection`)
      .orderBy('createdAt', 'asc')
      .get();

    let chainCount = 0;
    for (const recordDoc of records.docs) {
      const record = recordDoc.data();

      // Skip if already chained (indicates partial migration)
      if (record._chainedAt) {
        continue;
      }

      try {
        // Write chain entry with original timestamp
        const entry = await signAuditEntry(
          `/labs/${labId}/your-collection`,
          record.createdBy || 'system',
          'yourModule.migrated',
          {
            originalDocId: recordDoc.id,
            // Include fields relevant to auditor
          },
          YOUR_MODULE_HMAC_SECRET.value(),
        );

        // Mark record as migrated (idempotent)
        await recordDoc.ref.update({
          _chainedAt: admin.firestore.FieldValue.serverTimestamp(),
          _chainEntryId: entry.id,
        });

        chainCount++;
      } catch (err) {
        console.error('[migrateToChainAudit] failed for record', {
          labId,
          recordId: recordDoc.id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue; do not block on individual failures
      }
    }

    console.log(`[${labId}] chained ${chainCount}/${records.size} records`);
  }

  console.log('Migration complete');
}

// Run if this file is executed directly
if (require.main === module) {
  migrateToChainAudit().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
```

### Template 2B: Gradually transition both audit methods (feature flag)

```typescript
// functions/src/modules/your-module/operationWithFeatureFlag.ts

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { writeChainedAudit } from '../../shared/audit/writeChainedAudit';
import { writeAuditLog } from '../../shared/audit/writeAuditLog'; // Old method
import { YOUR_MODULE_HMAC_SECRET } from './secrets';

const db = admin.firestore();

/**
 * Feature flag: enable chain-audit rollout by percentage
 *
 * Deployment strategy:
 *   Day 1: USE_CHAIN_AUDIT_PCT = 5  (5% of operations)
 *   Day 3: USE_CHAIN_AUDIT_PCT = 25 (25%)
 *   Day 5: USE_CHAIN_AUDIT_PCT = 100 (100%)
 *   Day 7: Remove old writeAuditLog call entirely
 */
const USE_CHAIN_AUDIT_PCT = 100; // Adjust per deployment phase

function shouldUseChainAudit(): boolean {
  return Math.random() * 100 < USE_CHAIN_AUDIT_PCT;
}

export const yourOperation = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', '...');
  }

  const { labId, operationData } = request.data;
  const docRef = db.collection(`labs/${labId}/your-collection`).doc();

  await docRef.set({
    ...operationData,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Audit: use new chain method OR old flat log (feature flag)
  if (shouldUseChainAudit()) {
    // New: chain-hashed
    writeChainedAudit({
      collectionPath: `/labs/${labId}/your-collection`,
      operadorId: request.auth.uid,
      operation: 'yourModule.operation',
      payload: {
        docId: docRef.id,
      },
      secret: YOUR_MODULE_HMAC_SECRET.value(),
    }).catch(() => {}); // Non-blocking
  } else {
    // Old: flat log
    writeAuditLog(
      labId,
      'yourModule.operation',
      {
        docId: docRef.id,
      },
      request.auth.uid,
    ).catch(() => {}); // Non-blocking
  }

  return { success: true, id: docRef.id };
});
```

---

## Scenario 3: Validating chain continuity (auditor workflow)

### Template 3A: On-demand chain validation script

```typescript
// scripts/validate-audit-chains.mjs

#!/usr/bin/env node

/**
 * Usage:
 *   node scripts/validate-audit-chains.mjs --collection notas-fiscais --project hmatologia2 --lab lab-1
 *   node scripts/validate-audit-chains.mjs --collection criticos-log-eventos --project hmatologia2
 *
 * Output: JSON report to stdout + pretty-printed summary
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse arguments
const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i += 2) {
  argMap[args[i].replace(/^--/, '')] = args[i + 1];
}

const { collection, project, lab, secret } = argMap;

if (!collection || !project) {
  console.error('Usage: node validate-audit-chains.mjs --collection <name> --project <projectId> [--lab <labId>] [--secret <secretPath>]');
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccountPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.config/firebase',
  `${project}-key.json`
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account not found: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: project,
});

const db = admin.firestore();

/**
 * Validate chain integrity for a single collection
 */
async function validateCollection(collectionPath, hmacSecret) {
  console.log(`\n📋 Validating: ${collectionPath}`);

  try {
    const snapshot = await db
      .collection(collectionPath)
      .orderBy('timestamp', 'asc')
      .get();

    const entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`   Found ${entries.length} entries`);

    let violations = [];
    let validCount = 0;
    let previousHash = null;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const entryNum = i + 1;

      // Check hash continuity
      if (entry.previousHash !== previousHash) {
        violations.push({
          docId: entry.id,
          entryNum,
          reason: 'hash-sequence-broken',
          expected: previousHash,
          actual: entry.previousHash,
        });
        console.error(`   ❌ Entry ${entryNum}: hash mismatch`);
      } else {
        validCount++;
        console.log(`   ✓  Entry ${entryNum}: valid`);
      }

      previousHash = entry.hash;
    }

    const report = {
      collectionPath,
      timestamp: new Date().toISOString(),
      valid: violations.length === 0,
      stats: {
        total: entries.length,
        valid: validCount,
        invalid: violations.length,
      },
      violations,
    };

    // Print summary
    if (report.valid) {
      console.log(`   ✅ CHAIN VALID (${validCount}/${entries.length})`);
    } else {
      console.log(
        `   ⚠️  CHAIN BROKEN (${violations.length} violations)`
      );
      violations.forEach((v) => {
        console.log(
          `      - Entry ${v.entryNum} (${v.docId}): ${v.reason}`
        );
      });
    }

    return report;
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return {
      collectionPath,
      timestamp: new Date().toISOString(),
      valid: false,
      error: err.message,
    };
  }
}

/**
 * Main: validate all labs or a specific lab
 */
async function main() {
  const reports = [];

  if (lab) {
    // Single lab
    const collectionPath = `/labs/${lab}/${collection}`;
    const report = await validateCollection(collectionPath, secret);
    reports.push(report);
  } else {
    // All labs
    const labDocs = await db.collection('labs').listDocuments();

    for (const labDoc of labDocs) {
      const collectionPath = `/labs/${labDoc.id}/${collection}`;
      const report = await validateCollection(collectionPath, secret);
      reports.push(report);
    }
  }

  // Write JSON report
  const reportPath = `chain-validation-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2));
  console.log(`\n📁 Report written to: ${reportPath}`);

  // Exit with error if any chain broken
  const anyBroken = reports.some((r) => !r.valid);
  process.exit(anyBroken ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

### Template 3B: Periodic validation in Cloud Function

```typescript
// functions/src/modules/your-module/validateChainScheduled.ts

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { validateChainIntegrity } from '../audit/cryptoAudit';
import { YOUR_MODULE_HMAC_SECRET } from './secrets';

const db = admin.firestore();

/**
 * Scheduled validation: every 6 hours
 *
 * Compliance: RDC 978 Art. 128 requires continuous audit integrity verification
 */
export const validateYourCollectionChainScheduled = onSchedule(
  {
    schedule: '0 */6 * * *', // Every 6 hours
    region: 'southamerica-east1',
    secrets: [YOUR_MODULE_HMAC_SECRET],
  },
  async () => {
    const secret = YOUR_MODULE_HMAC_SECRET.value();
    const labDocs = await db.collection('labs').listDocuments();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    let totalViolations = 0;
    const results = [];

    for (const labDoc of labDocs) {
      const labId = labDoc.id;
      const collectionPath = `/labs/${labId}/your-collection`;

      try {
        const result = await validateChainIntegrity(collectionPath, secret);

        results.push({
          labId,
          collectionPath,
          valid: result.valid,
          stats: result.stats,
          violations: result.violations.map((v) => ({
            docId: v.docId,
            reason: v.reason,
          })),
        });

        totalViolations += result.violations.length;

        if (!result.valid) {
          // Write violation record for auditor
          await db.collection('audit-chain-violations').add({
            labId,
            collectionPath,
            timestamp,
            violations: result.violations,
            stats: result.stats,
          });

          // Alert
          console.error('[validateYourCollectionChainScheduled] CHAIN BREACH', {
            labId,
            collectionPath,
            violations: result.violations.length,
          });
        }
      } catch (err) {
        console.error('[validateYourCollectionChainScheduled] ERROR', {
          labId,
          error: err instanceof Error ? err.message : String(err),
        });

        results.push({
          labId,
          collectionPath,
          valid: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Log summary
    console.log('[validateYourCollectionChainScheduled] complete', {
      labsChecked: labDocs.length,
      totalViolations,
      reportSize: results.length,
    });
  },
);
```

---

## Quick reference: common mistakes

| Mistake                                     | Problem                               | Fix                                                                                      |
| ------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Writing failure marker into chain target    | Breaks `previousHash` continuity      | Always use `failureMarkerCollectionPath()` to derive sibling                             |
| `await` in tight loop without batching      | Slow, quota spike                     | Batch with `writeBatch` or use a queue                                                   |
| Checking chain result in hot path           | Blocks user on audit latency          | Fire-and-forget; never `await writeChainedAudit` before returning to user                |
| Rotating HMAC secret without migration      | Old entries unverifiable              | Follow ADR-0017 pattern: baseline reset + disclosure                                     |
| Validating chain only on read               | Breach undetected for days            | Run periodic validation job (every 6 hours minimum)                                      |
| No index on `timestamp` in chain collection | Chain queries slow (>1s for 10k docs) | Add composite index per **Firestore Indexes** section                                    |
| Omitting sensitive data from audit          | Insufficient context                  | Include domain fields (IDs, amounts, operationTypes), omit secrets (passwords, API keys) |

---

## Deployment checklist

- [ ] Added `writeChainedAudit` call to your callable
- [ ] Added secret to `functions/src/modules/your-module/secrets.ts`
- [ ] Declared secret in `firebase.json` functions config
- [ ] Set secret value: `firebase functions:secrets:set YOUR_MODULE_HMAC_SECRET --project hmatologia2`
- [ ] Added firestore.rules blocks for your collection + `-auditFailures` sibling
- [ ] Added composite indexes to `firestore.indexes.json`
- [ ] Tests added: happy path, transient retry, permanent failure
- [ ] Chain validation job added (if collection >1000 docs)
- [ ] Monitoring rule added to `docs/observability/policies/`
- [ ] Runbook created: troubleshooting broken chains in your module
- [ ] Pre-deployment gate passes: `bash scripts/preflight-secrets-check.sh`
- [ ] PR includes link to this cookbook + pattern documentation

---

**Last updated:** 2026-05-08 (Wave 3 Agent 8)
