#!/usr/bin/env node

/**
 * bootstrap-supervisor-status.mjs
 *
 * Pre-deploy migration: Creates supervisor-status/current doc per lab.
 *
 * Context:
 *   - Firestore rules gate CIQ writes with hasActiveSupervisor(labId)
 *   - Rule checks: exists(/labs/{labId}/supervisor-status/current)
 *   - If doc missing → rule fails closed (all CIQ runs blocked)
 *   - This script creates the doc with hasActiveSupervisor=false (safe default)
 *
 * Usage:
 *   node scripts/bootstrap-supervisor-status.mjs [--project <id>] [--dry-run] [--labId <id>]
 *
 * Examples:
 *   # Preview all labs (dry-run, default project hmatologia2)
 *   node scripts/bootstrap-supervisor-status.mjs --dry-run
 *
 *   # Execute for all labs
 *   node scripts/bootstrap-supervisor-status.mjs
 *
 *   # Single lab only
 *   node scripts/bootstrap-supervisor-status.mjs --labId lab-uuid-123
 *
 *   # Custom project + dry-run
 *   node scripts/bootstrap-supervisor-status.mjs --project hmatologia2-staging --dry-run
 *
 * Prerequisite:
 *   gcloud auth application-default login
 */

import admin from 'firebase-admin';
import { parseArgs } from 'node:util';

// ─── Config ──────────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'hmatologia2';
const DRY_RUN = process.argv.includes('--dry-run');

// Parse command-line arguments
let labId = null;
try {
  const { values } = parseArgs({
    options: {
      project: { type: 'string' },
      'dry-run': { type: 'boolean' },
      labId: { type: 'string' },
    },
  });
  if (values.project) {
    process.env.FIREBASE_PROJECT_ID = values.project;
  }
  if (values.labId) {
    labId = values.labId;
  }
} catch {
  // parseArgs not available in older Node, ignore
}

const PROJECT = process.env.FIREBASE_PROJECT_ID || PROJECT_ID;
const USE_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg, level = 'info') {
  const prefix =
    {
      info: '📋',
      success: '✅',
      warn: '⚠️',
      error: '❌',
      action: '⚡',
      skip: '⊘',
    }[level] || '📋';

  console.log(`${prefix} ${msg}`);
}

function logSection(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}\n`);
}

// ─── Firebase Init ───────────────────────────────────────────────────────────

function initFirebase() {
  try {
    admin.initializeApp({
      projectId: PROJECT,
    });
  } catch (e) {
    if (!e.message.includes('already initialized')) {
      throw e;
    }
  }

  return admin.firestore();
}

// ─── Main Bootstrap Logic ────────────────────────────────────────────────────

async function bootstrap() {
  logSection(
    `Bootstrap supervisor-status\nProject: ${PROJECT}\nMode: ${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}\nEmulator: ${USE_EMULATOR ? 'yes' : 'no'}`,
  );

  if (!DRY_RUN && !USE_EMULATOR) {
    log('⚠️  Production mode. Ensure you have Firebase credentials:', 'warn');
    log('  gcloud auth application-default login\n', 'warn');
  }

  let db;
  try {
    db = initFirebase();
  } catch (err) {
    log(`Failed to initialize Firebase: ${err.message}`, 'error');
    log('  Run: gcloud auth application-default login', 'warn');
    log('  Then: node scripts/bootstrap-supervisor-status.mjs', 'warn');
    process.exit(1);
  }

  let labs = [];

  // Fetch labs
  try {
    log('Fetching labs...', 'action');
    const snapshot = await db.collection('labs').get();

    if (snapshot.empty) {
      log('No labs found in Firestore', 'warn');
      return;
    }

    labs = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    log(`Found ${labs.length} lab(s)\n`, 'success');
  } catch (err) {
    log(`Error fetching labs: ${err.message}`, 'error');
    process.exit(1);
  }

  // Filter to single lab if specified
  if (labId) {
    const found = labs.find((l) => l.id === labId);
    if (!found) {
      log(`Lab not found: ${labId}`, 'error');
      process.exit(1);
    }
    labs = [found];
    log(`Filtered to single lab: ${labId}\n`, 'action');
  }

  // Process each lab
  let created = 0;
  let skipped = 0;
  const results = [];

  for (const lab of labs) {
    const statusDocPath = `supervisor-status/current`;
    const statusDocRef = db
      .collection('labs')
      .doc(lab.id)
      .collection('supervisor-status')
      .doc('current');

    try {
      const snapshot = await statusDocRef.get();

      if (snapshot.exists) {
        log(`- Already exists  → /labs/${lab.id}/${statusDocPath}`, 'skip');
        skipped++;
        results.push({
          labId: lab.id,
          status: 'skipped',
          reason: 'doc already exists',
        });
      } else {
        const docData = {
          hasActiveSupervisor: false,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (DRY_RUN) {
          log(`[DRY-RUN] Would create → /labs/${lab.id}/${statusDocPath}`, 'warn');
          log(`  Data: ${JSON.stringify(docData)}`, 'warn');
        } else {
          await statusDocRef.set(docData);
          log(`✓ Created  → /labs/${lab.id}/${statusDocPath}`, 'success');
        }

        created++;
        results.push({
          labId: lab.id,
          status: DRY_RUN ? 'would-create' : 'created',
          data: docData,
        });
      }
    } catch (err) {
      log(`✗ Error for lab ${lab.id}: ${err.message}`, 'error');
      results.push({
        labId: lab.id,
        status: 'error',
        error: err.message,
      });
    }
  }

  // Summary
  logSection('Summary');
  log(`Total labs: ${labs.length}`, 'info');
  log(`Created: ${created}`, 'success');
  log(`Skipped: ${skipped}`, 'skip');

  if (DRY_RUN) {
    log(`\nMode: DRY-RUN (no actual changes)`, 'warn');
    log(`Run without --dry-run to apply: node scripts/bootstrap-supervisor-status.mjs`, 'warn');
  }

  logSection('Next Steps');

  if (!DRY_RUN && created > 0) {
    log('1. Verify docs created in Firestore Console', 'info');
    log('   Go to: https://console.firebase.google.com/project/hmatologia2/firestore/', 'info');
    log('   Check: /labs/{labId}/supervisor-status/current exists', 'info');
    log('', 'info');
  }

  log('2. Deploy Firestore rules:', 'info');
  log('   firebase deploy --only firestore:rules --project hmatologia2', 'info');
  log('', 'info');
  log('3. Smoke test: Create a CIQ run via Hub → should succeed', 'info');

  if (created === 0 && !DRY_RUN) {
    log('\nℹ️  All labs already had supervisor-status docs (no changes)', 'info');
  }
}

// ─── Execution ───────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
  console.error('\n\nBOOTSTRAP FAILED', err);
  process.exit(1);
});
