#!/usr/bin/env node
/**
 * Seed Analytics Mock Data
 *
 * Populates /labs/{labId}/analytics/meta + /analytics/cache/metrics/ciqCompliance
 * with realistic mock data for dashboard demo/verification during rollout.
 *
 * The 4 dashboards (Compliance, Trends, NCHeatmap, Training) all read the same
 * aggregate doc via Zustand, so seeding these two docs lights up everything.
 *
 * Usage:
 *   node scripts/seed-analytics-mock.mjs                # all labs
 *   node scripts/seed-analytics-mock.mjs --labId=foo    # specific lab
 *   node scripts/seed-analytics-mock.mjs --dry-run      # preview only
 */

import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, '../service-account.json.json'), 'utf-8'),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'hmatologia2',
});

const db = admin.firestore();

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const labIdArg = args.find((a) => a.startsWith('--labId='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

// ─── Mock builders ────────────────────────────────────────────────────────────

function buildAggregate(labId) {
  // Realistic distribution: ~92% compliance, healthy NC backlog, mixed ages
  const totalRuns = 487;
  const validRuns = 449;
  const invalidRuns = totalRuns - validRuns;
  const openNCs = 14;
  const closedNCs = 38;
  const total = openNCs + closedNCs;
  const retrabalhoCount = 23;

  return {
    labId,

    // CIQ compliance
    totalRuns,
    validRuns,
    invalidRuns,
    compliancePercent: Math.round((validRuns / totalRuns) * 1000) / 10,

    // Non-conformities
    openNCs,
    closedNCs,
    ncResolutionRate: Math.round((closedNCs / total) * 1000) / 10,
    avgResolutionDays: 4.7,

    // Processing
    avgProcessingHours: 3.2,

    // Retrabalho
    retrabalhoCount,
    retrabalhoPercent: Math.round((retrabalhoCount / totalRuns) * 1000) / 10,

    // NC by module — mix across the production modules
    ncByModule: {
      hematologia: 5,
      coagulacao: 3,
      'ciq-imuno': 2,
      uroanalise: 1,
      'controle-temperatura': 2,
      insumos: 1,
    },

    // NC age buckets — recent skew (healthy: most NCs being addressed quickly)
    ncAgeBuckets: {
      '7d': 7,
      '30d': 4,
      '60d': 2,
      '>60d': 1,
    },

    // Metadata
    computedAt: admin.firestore.FieldValue.serverTimestamp(),
    dataAsOf: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildMeta(labId) {
  return {
    labId,
    lastRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
    refreshIntervalMinutes: 60,
    isCached: true,
    cacheExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    staleWarningMinutes: 90,
  };
}

// ─── Seed one lab ─────────────────────────────────────────────────────────────

async function seedLab(labId) {
  const aggregate = buildAggregate(labId);
  const meta = buildMeta(labId);

  const aggregateRef = db.doc(`labs/${labId}/analytics/cache/metrics/ciqCompliance`);
  const metaRef = db.doc(`labs/${labId}/analytics/meta`);

  if (dryRun) {
    console.log(`\n[DRY-RUN] Would write to lab ${labId}:`);
    console.log(`  ├─ ${aggregateRef.path}`);
    console.log(
      `  │  └─ compliance ${aggregate.compliancePercent}% · ${aggregate.totalRuns} runs · ${aggregate.openNCs} open NCs`,
    );
    console.log(`  └─ ${metaRef.path}`);
    return;
  }

  await Promise.all([aggregateRef.set(aggregate), metaRef.set(meta)]);

  console.log(
    `✓ ${labId}  compliance=${aggregate.compliancePercent}%  runs=${aggregate.totalRuns}  openNCs=${aggregate.openNCs}`,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n🌱 Seeding analytics mock data${dryRun ? ' [DRY-RUN]' : ''}\n`);

  let labIds = [];

  if (labIdArg) {
    labIds = [labIdArg];
  } else {
    const labsSnap = await db.collection('labs').get();
    labIds = labsSnap.docs.map((d) => d.id);
  }

  if (labIds.length === 0) {
    console.log('⚠  Nenhum lab encontrado.');
    process.exit(0);
  }

  console.log(`Labs alvo: ${labIds.length}\n`);

  for (const labId of labIds) {
    try {
      await seedLab(labId);
    } catch (err) {
      console.error(`✗ ${labId}: ${err.message}`);
    }
  }

  console.log(`\n✅ Pronto. Recarregue (Ctrl+Shift+R) o dashboard pra ver os dados.\n`);
  process.exit(0);
})().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
