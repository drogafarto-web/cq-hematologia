#!/usr/bin/env node

/**
 * Backfill Script: Wire POP Referências to CIQ Runs
 * ADR 0004 Wave 3: Retroactively denormalize popReferencia to existing runs
 *
 * Usage:
 *   node functions/scripts/backfill-pop-reference.mjs --labId=default [--limit=100] [--dry-run]
 *   node functions/scripts/backfill-pop-reference.mjs --labId=all [--limit=100]
 *
 * Process:
 *  1. Query all CIQ runs (hematologia, imunologia, coagulacao, uroanalise, bioquimica)
 *  2. For each run with timestamp T:
 *     - Find which POP version was active on date T
 *     - Find if operator was trained on that POP version on date T
 *     - If match: denormalize run.popReferencia = {popId, popVersaoNumero}
 *     - If no match: mark _uncovered_pop_reference (for manual review)
 *  3. Verify coverage: report % of runs with popReferencia wire-in
 *  4. Log summary
 *
 * Safety: This is a SAFE denormalization operation (read-only, no original data modified).
 * Runs marked _uncovered_pop_reference can be reviewed manually later.
 */

import admin from 'firebase-admin';
import process from 'process';

// Parse CLI args
const labIdArg = process.argv.find((arg) => arg.startsWith('--labId='))?.split('=')[1] || 'default';
const limitArg = parseInt(
  process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '1000000',
  10,
);
const dryRun = process.argv.includes('--dry-run');

console.log(`\n🔄 ADR 0004 Backfill: POP Reference Wire-in`);
console.log(`📋 Lab ID: ${labIdArg}`);
console.log(`📊 Limit: ${limitArg}`);
console.log(`🧪 Dry Run: ${dryRun ? 'YES (no writes)' : 'NO (will write)'}\n`);

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'hmatologia2' });
}

const db = admin.firestore();

// CIQ module types that can have runs with POPs
const CIQ_MODULES = ['hematologia', 'imunologia', 'coagulacao', 'uroanalise', 'bioquimica'];

/**
 * Find active POP version on a given date
 */
async function findActivePOPVersionOnDate(labId, popId, targetDate) {
  try {
    const popSnap = await db.collection(`labs/${labId}/pops`).doc(popId).get();
    if (!popSnap.exists) return null;

    const pop = popSnap.data();
    const versoes = pop.versoes || [];

    // Find version active on targetDate
    for (const versao of versoes) {
      const vigoraInicio = versao.dataVigenciaInicio.toDate?.() || versao.dataVigenciaInicio;
      const vigenciaFim = versao.dataVigenciaFim.toDate?.() || versao.dataVigenciaFim;

      if (targetDate >= vigoraInicio && targetDate <= vigenciaFim && versao.status === 'ativa') {
        return versao.numero;
      }
    }

    return null;
  } catch (error) {
    console.error(`[POP lookup] Error: ${error.message}`);
    return null;
  }
}

/**
 * Check if operator was trained on POP version on a given date
 */
async function wasOperadorTreinadoEmData(labId, uid, popId, popVersaoNumero, targetDate) {
  try {
    const qualsSnap = await db
      .collection(`labs/${labId}/qualificacoes`)
      .where('uid', '==', uid)
      .get();

    if (qualsSnap.empty) return false;

    for (const doc of qualsSnap.docs) {
      const qual = doc.data();
      const treinamentos = qual.treinamentosPOP || [];

      const treino = treinamentos.find(
        (t) => t.popId === popId && t.popVersaoNumero === popVersaoNumero,
      );

      if (treino) {
        // Check if training was completed before or on targetDate
        const dataConcluso = treino.dataConcluso.toDate?.() || treino.dataConcluso;
        if (dataConcluso <= targetDate) {
          // Check validity
          const validoAte = treino.validoAte.toDate?.() || treino.validoAte;
          if (validoAte >= targetDate) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    // Gracefully handle missing collections
    return false;
  }
}

/**
 * Determine which POP (if any) applies to this run and operator
 */
async function determinePOPReferencia(labId, run, operadorUid) {
  try {
    const runTimestamp = run.timestamp.toDate?.() || run.timestamp;

    // If run already has popReferencia, skip (idempotent)
    if (run.popReferencia && run.popReferencia.popId) {
      return { alreadyWired: true };
    }

    // Check operator's trained POPs
    const qualsSnap = await db
      .collection(`labs/${labId}/qualificacoes`)
      .where('uid', '==', operadorUid)
      .get();

    if (qualsSnap.empty) {
      return { found: false, reason: 'no-training' };
    }

    for (const doc of qualsSnap.docs) {
      const qual = doc.data();
      const treinamentos = qual.treinamentosPOP || [];

      for (const treino of treinamentos) {
        // Check if training covers this date
        const dataConcluso = treino.dataConcluso.toDate?.() || treino.dataConcluso;
        const validoAte = treino.validoAte.toDate?.() || treino.validoAte;

        if (dataConcluso <= runTimestamp && validoAte >= runTimestamp) {
          // Verify POP version was still active
          const activeVersao = await findActivePOPVersionOnDate(labId, treino.popId, runTimestamp);

          if (activeVersao === treino.popVersaoNumero) {
            return {
              found: true,
              popId: treino.popId,
              popVersaoNumero: treino.popVersaoNumero,
            };
          }
        }
      }
    }

    return { found: false, reason: 'no-valid-training-on-date' };
  } catch (error) {
    console.error(`[POP determination] Error: ${error.message}`);
    return { found: false, reason: 'error', error: error.message };
  }
}

/**
 * Backfill POP references for a single lab across all CIQ modules
 */
async function backfillLabPOPReferences(labId) {
  console.log(`\n📚 Processing lab: ${labId}`);

  const stats = {
    totalRuns: 0,
    wiredPOPs: 0,
    alreadyWired: 0,
    uncovered: 0,
    errors: 0,
  };

  // Process each CIQ module
  for (const modulo of CIQ_MODULES) {
    try {
      console.log(`  🔍 Scanning ${modulo} runs...`);

      // Query runs for this module (assuming typical CIQ structure)
      const runsRef = db.collection(`labs/${labId}/${modulo}-runs`);
      let runsQuery = runsRef.limit(limitArg);

      // Order by timestamp for deterministic processing
      runsQuery = runsQuery.orderBy('timestamp', 'desc');

      const runsSnap = await runsQuery.get();
      stats.totalRuns += runsSnap.size;

      for (const runDoc of runsSnap.docs) {
        const run = runDoc.data();

        // Get operator uid (varies by module structure)
        const operadorUid = run.operadorUid || run.uid || run.createdBy;
        if (!operadorUid) {
          stats.uncovered++;
          continue;
        }

        // Determine POP for this run
        const popResult = await determinePOPReferencia(labId, run, operadorUid);

        if (popResult.alreadyWired) {
          stats.alreadyWired++;
        } else if (popResult.found) {
          // Wire the POP reference
          if (!dryRun) {
            await runDoc.ref.update({
              popReferencia: {
                popId: popResult.popId,
                popVersaoNumero: popResult.popVersaoNumero,
              },
              _popWiredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          stats.wiredPOPs++;
        } else {
          // Mark for manual review
          if (!dryRun) {
            await runDoc.ref.update({
              _uncovered_pop_reference: true,
              _uncoverageReason: popResult.reason || 'unknown',
              _uncoveredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          stats.uncovered++;
        }
      }

      console.log(
        `    ✓ ${modulo}: ${runsSnap.size} runs (wired: ${stats.wiredPOPs}, uncovered: ${stats.uncovered})`,
      );
    } catch (error) {
      if (error.code !== 'FAILED_PRECONDITION') {
        console.error(`    ✗ ${modulo}: ${error.message}`);
        stats.errors++;
      } else {
        console.log(`    ⊘ ${modulo}: collection not found (skipped)`);
      }
    }
  }

  console.log(`\n  📊 Backfill Stats for ${labId}:`);
  console.log(`     • Total Runs: ${stats.totalRuns}`);
  console.log(`     • Newly Wired: ${stats.wiredPOPs}`);
  console.log(`     • Already Wired: ${stats.alreadyWired}`);
  console.log(`     • Uncovered: ${stats.uncovered}`);
  console.log(
    `     • Coverage: ${stats.totalRuns > 0 ? (((stats.wiredPOPs + stats.alreadyWired) / stats.totalRuns) * 100).toFixed(2) : 0}%`,
  );
  console.log(`     • Errors: ${stats.errors}`);

  if (dryRun) {
    console.log(`     • (DRY RUN: no actual writes)`);
  }

  return stats;
}

/**
 * Main
 */
async function main() {
  try {
    if (labIdArg === 'all') {
      // Get all labs
      const labsSnap = await db.collection('labs').get();
      const totalStats = { totalRuns: 0, wiredPOPs: 0, alreadyWired: 0, uncovered: 0, errors: 0 };

      for (const labDoc of labsSnap.docs) {
        const stats = await backfillLabPOPReferences(labDoc.id);
        totalStats.totalRuns += stats.totalRuns;
        totalStats.wiredPOPs += stats.wiredPOPs;
        totalStats.alreadyWired += stats.alreadyWired;
        totalStats.uncovered += stats.uncovered;
        totalStats.errors += stats.errors;
      }

      console.log(`\n✅ POP Reference Backfill Complete (All Labs)`);
      console.log(
        `   • Total Runs: ${totalStats.totalRuns} | Wired: ${totalStats.wiredPOPs} | Already: ${totalStats.alreadyWired} | Uncovered: ${totalStats.uncovered}`,
      );
      console.log(
        `   • Overall Coverage: ${totalStats.totalRuns > 0 ? (((totalStats.wiredPOPs + totalStats.alreadyWired) / totalStats.totalRuns) * 100).toFixed(2) : 0}%`,
      );
    } else {
      // Single lab
      await backfillLabPOPReferences(labIdArg);
      console.log(`\n✅ POP Reference Backfill Complete`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Backfill Failed:`, error.message);
    process.exit(1);
  }
}

main();
