#!/usr/bin/env node

/**
 * cleanup-supervisor-status.mjs
 *
 * Reverse operation: Deletes supervisor-status/current docs per lab.
 *
 * Use for testing/rollback only. Requires explicit --confirm flag to prevent
 * accidental deletion.
 *
 * Usage:
 *   node scripts/cleanup-supervisor-status.mjs --dry-run [--project <id>] [--labId <id>]
 *   node scripts/cleanup-supervisor-status.mjs --dry-run --confirm [--project <id>]
 *
 * Examples:
 *   # Preview what will be deleted (always safe, no confirm needed)
 *   node scripts/cleanup-supervisor-status.mjs --dry-run
 *
 *   # Actually delete (requires --dry-run --confirm)
 *   node scripts/cleanup-supervisor-status.mjs --dry-run --confirm
 *
 *   # Single lab preview
 *   node scripts/cleanup-supervisor-status.mjs --dry-run --labId lab-uuid-123
 *
 * Prerequisite:
 *   gcloud auth application-default login
 */

import admin from 'firebase-admin';
import { parseArgs } from 'node:util';

// ─── Config ──────────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'hmatologia2';
const DRY_RUN = process.argv.includes('--dry-run');
const CONFIRM = process.argv.includes('--confirm');

let labId = null;
try {
  const { values } = parseArgs({
    options: {
      project: { type: 'string' },
      'dry-run': { type: 'boolean' },
      confirm: { type: 'boolean' },
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
      delete: '🗑️',
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

// ─── Main Cleanup Logic ──────────────────────────────────────────────────────

async function cleanup() {
  logSection(
    `Cleanup supervisor-status\nProject: ${PROJECT}\nMode: ${!DRY_RUN && CONFIRM ? 'EXECUTE' : 'DRY-RUN'}`,
  );

  // Safety check
  if (!DRY_RUN) {
    log('Safety check: Use --dry-run to preview, then --dry-run --confirm to delete', 'warn');
    log('Example: node scripts/cleanup-supervisor-status.mjs --dry-run --confirm', 'warn');
    process.exit(1);
  }

  if (DRY_RUN && !CONFIRM) {
    log('Preview mode (no changes). Use --confirm to actually delete.', 'info');
  }

  let db;
  try {
    db = initFirebase();
  } catch (err) {
    log(`Failed to initialize Firebase: ${err.message}`, 'error');
    log('  Run: gcloud auth application-default login', 'warn');
    process.exit(1);
  }

  let labs = [];

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
  }

  // Process each lab
  let deleted = 0;
  let notFound = 0;

  for (const lab of labs) {
    const statusDocRef = db
      .collection('labs')
      .doc(lab.id)
      .collection('supervisor-status')
      .doc('current');

    try {
      const snapshot = await statusDocRef.get();

      if (!snapshot.exists) {
        log(`- Not found  → /labs/${lab.id}/supervisor-status/current`, 'info');
        notFound++;
      } else {
        if (CONFIRM) {
          await statusDocRef.delete();
          log(`🗑️ Deleted  → /labs/${lab.id}/supervisor-status/current`, 'delete');
          deleted++;
        } else {
          log(`[DRY-RUN] Would delete → /labs/${lab.id}/supervisor-status/current`, 'warn');
          deleted++;
        }
      }
    } catch (err) {
      log(`✗ Error for lab ${lab.id}: ${err.message}`, 'error');
    }
  }

  // Summary
  logSection('Summary');
  log(`Total labs checked: ${labs.length}`, 'info');
  log(`Deleted: ${CONFIRM ? deleted : 0}`, 'delete');
  log(`Would delete: ${!CONFIRM ? deleted : 0}`, 'warn');
  log(`Not found: ${notFound}`, 'info');

  if (DRY_RUN && !CONFIRM) {
    log(`\nTo actually delete, run:`, 'action');
    log(`  node scripts/cleanup-supervisor-status.mjs --dry-run --confirm`, 'info');
  }
}

// ─── Execution ───────────────────────────────────────────────────────────────

cleanup().catch((err) => {
  console.error('\n\nCLEANUP FAILED', err);
  process.exit(1);
});
