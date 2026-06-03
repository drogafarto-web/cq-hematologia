/**
 * markCriticosBaselineReset.ts
 *
 * Defense-in-depth migration for ADR-0030 (Criticos HMAC Baseline Extension).
 *
 * Scans `criticos-log-eventos` and `criticos-escalacoes` per lab, finds any
 * document whose `assinatura.hash` is empty or non-64-hex AND whose `criadoEm`
 * (or `timestamp`) is before the cutoff, and stamps it with:
 *
 *   {
 *     signatureBaselineReset: true,
 *     baselineResetAdr: 'ADR-0030',
 *     baselineResetAt: <serverTimestamp>,
 *   }
 *
 * The script does NOT modify the original `assinatura.hash`, `timestamp`,
 * `operadorId`, or any audit field — re-signing with a current key would
 * fabricate authenticity (rejected per ADR-0017 §49 / ADR-0030 §A).
 *
 * USAGE
 *   # Dry-run (default — no writes, prints affected docs):
 *   #   npx ts-node functions/scripts/markCriticosBaselineReset.ts --labId=<lab-id>
 *   # Execute (admin only, requires explicit --confirm):
 *   #   npx ts-node functions/scripts/markCriticosBaselineReset.ts \
 *   #     --labId=<lab-id> --confirm
 *   # All labs:
 *   #   npx ts-node functions/scripts/markCriticosBaselineReset.ts --all-labs --confirm
 *
 * REQUIRES
 *   - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account with
 *     Firestore admin on `hmatologia2`.
 *   - Run from a trusted machine. NOT a Cloud Function. NOT a callable.
 *
 * IDEMPOTENT
 *   Re-running is safe — documents already marked `signatureBaselineReset: true`
 *   are skipped on subsequent runs.
 *
 * STATUS: not run as part of the ADR-0030 commit. Reserved for the case
 * where a forensic audit or an emulator-import-to-prod surfaces a pre-fix
 * document. See ADR-0030 §Operational checklist.
 */

import admin from 'firebase-admin';

// Cutoff: 1 hour after Wave 1 Agent 1's fix (commit a6e01ad, 2026-05-08 14:16 BRT
// = 17:16 UTC). The 1-hour buffer absorbs any in-flight write that started
// pre-fix and committed post-fix.
const CUTOFF_UTC = new Date('2026-05-08T18:16:00Z');

interface CliArgs {
  labId: string | null;
  allLabs: boolean;
  confirm: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const labIdArg = args.find((a) => a.startsWith('--labId='));
  return {
    labId: labIdArg ? labIdArg.split('=')[1] : null,
    allLabs: args.includes('--all-labs'),
    confirm: args.includes('--confirm'),
  };
}

function isInvalidHash(hash: unknown): boolean {
  if (typeof hash !== 'string') return true;
  if (hash.length === 0) return true;
  if (hash.length !== 64) return true;
  if (!/^[0-9a-f]{64}$/i.test(hash)) return true;
  return false;
}

interface ScanStats {
  scanned: number;
  flagged: number;
  alreadyMarked: number;
  skippedPostCutoff: number;
}

async function scanCollection(
  db: admin.firestore.Firestore,
  labId: string,
  collection: 'criticos-log-eventos' | 'criticos-escalacoes',
  dryRun: boolean,
): Promise<ScanStats> {
  const stats: ScanStats = {
    scanned: 0,
    flagged: 0,
    alreadyMarked: 0,
    skippedPostCutoff: 0,
  };

  const ref = db.collection('labs').doc(labId).collection(collection);
  // No server-side filter on assinatura.hash — Firestore can't predicate on
  // length/regex. Stream the lot and filter client-side. Volume is bounded
  // (criticos events per lab are <10k in v1.4 horizon).
  const snap = await ref.get();
  stats.scanned = snap.size;

  let writer = db.batch();
  let pendingWrites = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as {
      assinatura?: { hash?: unknown };
      timestamp?: admin.firestore.Timestamp;
      criadoEm?: admin.firestore.Timestamp;
      signatureBaselineReset?: boolean;
    };

    if (data.signatureBaselineReset === true) {
      stats.alreadyMarked++;
      continue;
    }

    const ts = data.timestamp ?? data.criadoEm;
    if (ts && ts.toDate() >= CUTOFF_UTC) {
      stats.skippedPostCutoff++;
      continue;
    }

    if (!isInvalidHash(data.assinatura?.hash)) {
      // Hash is well-formed (64 hex). Could still be a re-signed pre-fix
      // doc, but we have no way to know — and ADR-0030 §A forbids re-signing
      // anyway, so well-formed = trusted.
      continue;
    }

    stats.flagged++;
    console.log(
      `  [${collection}] ${doc.id}  hash=${
        JSON.stringify(data.assinatura?.hash) ?? 'undefined'
      }  ts=${ts ? ts.toDate().toISOString() : 'none'}`,
    );

    if (!dryRun) {
      writer.update(doc.ref, {
        signatureBaselineReset: true,
        baselineResetAdr: 'ADR-0030',
        baselineResetAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      pendingWrites++;
      // Firestore batch limit is 500. Flush proactively at 400.
      if (pendingWrites >= 400) {
        await writer.commit();
        writer = db.batch();
        pendingWrites = 0;
      }
    }
  }

  if (!dryRun && pendingWrites > 0) {
    await writer.commit();
  }

  return stats;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (!args.labId && !args.allLabs) {
    console.error(
      'Usage: npx ts-node markCriticosBaselineReset.ts (--labId=<id> | --all-labs) [--confirm]',
    );
    process.exit(1);
  }

  const dryRun = !args.confirm;
  console.log('=== ADR-0030 Criticos Baseline Reset Marker ===');
  console.log(`Cutoff (UTC): ${CUTOFF_UTC.toISOString()}`);
  console.log(`Mode:         ${dryRun ? 'DRY-RUN (no writes)' : 'EXECUTE'}`);
  console.log('');

  admin.initializeApp({ projectId: 'hmatologia2' });
  const db = admin.firestore();

  const labIds: string[] = args.allLabs
    ? (await db.collection('labs').get()).docs.map((d) => d.id)
    : [args.labId!];

  const totals: ScanStats = {
    scanned: 0,
    flagged: 0,
    alreadyMarked: 0,
    skippedPostCutoff: 0,
  };

  for (const labId of labIds) {
    console.log(`\n--- Lab: ${labId} ---`);
    for (const col of ['criticos-log-eventos', 'criticos-escalacoes'] as const) {
      const stats = await scanCollection(db, labId, col, dryRun);
      console.log(
        `  ${col}: scanned=${stats.scanned} flagged=${stats.flagged} alreadyMarked=${stats.alreadyMarked} skippedPostCutoff=${stats.skippedPostCutoff}`,
      );
      totals.scanned += stats.scanned;
      totals.flagged += stats.flagged;
      totals.alreadyMarked += stats.alreadyMarked;
      totals.skippedPostCutoff += stats.skippedPostCutoff;
    }
  }

  console.log('\n=== Totals ===');
  console.log(JSON.stringify(totals, null, 2));

  if (dryRun && totals.flagged > 0) {
    console.log('\nDry-run complete. Re-run with --confirm to mark the flagged documents.');
  } else if (!dryRun && totals.flagged > 0) {
    console.log('\nMarking complete. Documents now carry signatureBaselineReset=true.');
  } else {
    console.log('\nNo pre-fix documents found. No action needed.');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
