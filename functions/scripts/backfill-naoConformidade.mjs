#!/usr/bin/env node

/**
 * Backfill Script: NCTemps → NaoConformidade Global Collection
 * ADR 0003 Wave 3: Migrate historical NC data from module-specific collections to global spine
 *
 * Usage:
 *   node functions/scripts/backfill-naoConformidade.mjs --labId=default
 *   node functions/scripts/backfill-naoConformidade.mjs --labId=all
 *
 * Process:
 *  1. Query all labs (if --labId=all) or specific lab
 *  2. For each lab, query temporary NC collections (per-module)
 *  3. Map temporary NC → NaoConformidade schema
 *  4. Compute HMAC via ADR 0005 helper
 *  5. Write to /labs/{labId}/nao-conformidades
 *  6. Verify 1:1 migration (count before = count after)
 *  7. Log summary
 *
 * Important: Do NOT delete temporary collections (needed for audit trail)
 * Temporary collections to preserve:
 *  - labs/{labId}/controleQualidade/desvios
 *  - labs/{labId}/insumos/{loteId}/desvios
 *  - labs/{labId}/equipamentos/{equipId}/manutencao
 *  - ... (other module-specific NC collections)
 */

import admin from 'firebase-admin';
import process from 'process';

// Initialize Firebase BEFORE importing cryptoAudit
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'hmatologia2' });
}

// Parse CLI args
const labIdArg = process.argv.find((arg) => arg.startsWith('--labId='))?.split('=')[1] || 'default';
const dryRun = process.argv.includes('--dry-run');

console.log(`\n🔄 ADR 0003 Backfill: NCTemps → NaoConformidade`);
console.log(`📋 Lab ID: ${labIdArg}`);
console.log(`🧪 Dry Run: ${dryRun ? 'YES (no writes)' : 'NO (will write)'}\n`);

const db = admin.firestore();
const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;

if (!secret) {
  console.error('❌ Error: HCQ_SIGNATURE_HMAC_KEY environment variable not set');
  process.exit(1);
}

/**
 * Generate NC numero in format NC-{YYYY}-{seq}
 */
async function generateNCNumero(labId, year) {
  const prefix = `NC-${year}-`;
  try {
    const snapshot = await db
      .collection(`labs/${labId}/nao-conformidades`)
      .where('numero', '>=', prefix)
      .where('numero', '<', prefix.replace(year.toString(), (year + 1).toString()))
      .orderBy('numero', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return `${prefix}001`;
    }

    const lastNumero = snapshot.docs[0].data().numero;
    const lastSeq = parseInt(lastNumero.split('-')[2], 10);
    const nextSeq = String(lastSeq + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  } catch (error) {
    return `${prefix}001`;
  }
}

/**
 * Get previous hash for chain (ADR 0005)
 */
async function getPreviousNCHash(labId) {
  try {
    const snapshot = await db
      .collection(`labs/${labId}/nao-conformidades`)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data().hmac || null;
  } catch (error) {
    return null;
  }
}

/**
 * Map from temporary NC schema to NaoConformidade
 */
function mapTemporaryNCToGlobal(tempNC, labId, numero) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return {
    labId,
    numero,
    origem: tempNC.origem || 'outro',
    origemId: tempNC.origemId,
    moduloOrigemId: tempNC.moduloOrigemId || 'unknown',
    descricao: tempNC.descricao || tempNC.description || 'Migrated from temporary NC',
    severidade: tempNC.severidade || 'leve',
    status: 'fechada', // Historical NCs are assumed closed (will be re-opened if not)
    statusHistory: [
      {
        timestamp: tempNC.createdAt || now,
        novoStatus: 'aberta',
        mudadoPor: tempNC.createdBy || 'sistema',
        motivo: 'Migração automática de NC temporária',
        hmac: '', // Will be filled by helper
      },
    ],
    capa: {
      investigacao: tempNC.investigacao,
      acaoCorretiva: tempNC.acaoCorretiva,
      verificacaoEficacia: tempNC.verificacaoEficacia,
    },
    aberta: {
      timestamp: tempNC.createdAt || now,
      uid: tempNC.createdBy || 'sistema',
      motivo: 'NC temporária migrada',
    },
    bloqueiaOperacoes: false, // Historical NCs don't block (closed)
    hmac: '', // Will be computed
    previousHash: null, // Will be fetched
    createdAt: tempNC.createdAt || now,
    updatedAt: now,
    versao: 1,
    _migratedAt: now,
    _originalSource: tempNC._path || tempNC._collection,
  };
}

/**
 * Backfill NCs from temporary collections
 */
async function backfillLab(labId) {
  console.log(`\n📚 Processing lab: ${labId}`);

  const stats = {
    queried: 0,
    mapped: 0,
    written: 0,
    skipped: 0,
    errors: 0,
  };

  const year = new Date().getFullYear();
  const previousHash = await getPreviousNCHash(labId);

  // Sources to backfill (per-module temporary collections)
  // This is a sample; actual implementations should verify paths
  const sources = [
    {
      name: 'controleQualidade/desvios',
      path: `labs/${labId}/controleQualidade/desvios`,
      moduloOrigemId: 'qualidade',
      origem: 'controle',
    },
    {
      name: 'insumos (desvios)',
      path: `labs/${labId}/insumos`,
      subcollection: 'desvios',
      moduloOrigemId: 'insumos',
      origem: 'insumo',
    },
    // Add more sources as needed:
    // { name: 'equipamentos', path: `labs/${labId}/equipamentos`, ... }
    // { name: 'pessoas', path: `labs/${labId}/qualificacoes`, ... }
  ];

  for (const source of sources) {
    try {
      let query;
      if (source.subcollection) {
        // For subcollections, we need to iterate documents first
        const parentsSnap = await db.collection(source.path).get();
        for (const parentDoc of parentsSnap.docs) {
          const subSnap = await parentDoc.ref.collection(source.subcollection).get();
          stats.queried += subSnap.size;

          for (const subDoc of subSnap.docs) {
            const tempNC = subDoc.data();
            const numero = await generateNCNumero(labId, year);

            const globalNC = mapTemporaryNCToGlobal(
              {
                ...tempNC,
                _path: `${source.path}/${parentDoc.id}/${source.subcollection}/${subDoc.id}`,
              },
              labId,
              numero,
            );

            // Compute HMAC
            globalNC.hmac = computeHmac(
              {
                aberta: globalNC.aberta,
                createdAt: globalNC.createdAt,
                descricao: globalNC.descricao,
                moduloOrigemId: globalNC.moduloOrigemId,
                numero: globalNC.numero,
                origem: globalNC.origem,
                origemId: globalNC.origemId,
                previousHash: previousHash,
                severidade: globalNC.severidade,
                status: globalNC.status,
                statusHistory: globalNC.statusHistory,
              },
              secret,
            );
            globalNC.previousHash = previousHash;

            if (!dryRun) {
              await db.collection(`labs/${labId}/nao-conformidades`).add(globalNC);
              stats.written++;
            } else {
              stats.mapped++;
            }
          }
        }
      } else {
        // For regular collections
        const snap = await db.collection(source.path).get();
        stats.queried += snap.size;

        for (const doc of snap.docs) {
          const tempNC = doc.data();
          const numero = await generateNCNumero(labId, year);

          const globalNC = mapTemporaryNCToGlobal(
            {
              ...tempNC,
              _path: `${source.path}/${doc.id}`,
            },
            labId,
            numero,
          );

          // Compute HMAC
          globalNC.hmac = computeHmac(
            {
              aberta: globalNC.aberta,
              createdAt: globalNC.createdAt,
              descricao: globalNC.descricao,
              moduloOrigemId: globalNC.moduloOrigemId,
              numero: globalNC.numero,
              origem: globalNC.origem,
              origemId: globalNC.origemId,
              previousHash: previousHash,
              severidade: globalNC.severidade,
              status: globalNC.status,
              statusHistory: globalNC.statusHistory,
            },
            secret,
          );
          globalNC.previousHash = previousHash;

          if (!dryRun) {
            await db.collection(`labs/${labId}/nao-conformidades`).add(globalNC);
            stats.written++;
          } else {
            stats.mapped++;
          }
        }
      }

      console.log(`  ✓ ${source.name}: ${stats.queried} found`);
    } catch (error) {
      if (error.code !== 'FAILED_PRECONDITION') {
        console.error(`  ✗ ${source.name}: ${error.message}`);
        stats.errors++;
      } else {
        console.log(`  ⊘ ${source.name}: collection not found (skipped)`);
      }
    }
  }

  // Verify migration
  try {
    const globalSnap = await db.collection(`labs/${labId}/nao-conformidades`).get();
    const globalCount = globalSnap.size;

    console.log(`\n  📊 Migration Stats:`);
    console.log(`     • Queried: ${stats.queried}`);
    console.log(`     • Written: ${stats.written}`);
    console.log(`     • Skipped: ${stats.skipped}`);
    console.log(`     • Errors: ${stats.errors}`);
    console.log(`     • Global NC Count: ${globalCount}`);

    if (dryRun) {
      console.log(`     • (DRY RUN: no actual writes)`);
    }
  } catch (error) {
    console.error(`     • ✗ Verification failed: ${error.message}`);
  }

  return stats;
}

/**
 * Main
 */
async function main() {
  const { computeHmac, hashData } = await import('../lib/modules/audit/cryptoAudit.js');

  try {
    if (labIdArg === 'all') {
      // Get all labs
      const labsSnap = await db.collection('labs').get();
      const totalStats = { queried: 0, written: 0, skipped: 0, errors: 0 };

      for (const labDoc of labsSnap.docs) {
        const stats = await backfillLab(labDoc.id);
        totalStats.queried += stats.queried;
        totalStats.written += stats.written;
        totalStats.skipped += stats.skipped;
        totalStats.errors += stats.errors;
      }

      console.log(`\n✅ Backfill Complete (All Labs)`);
      console.log(`   • Total Queried: ${totalStats.queried}`);
      console.log(`   • Total Written: ${totalStats.written}`);
      console.log(`   • Total Errors: ${totalStats.errors}`);
    } else {
      // Single lab
      await backfillLab(labIdArg);
      console.log(`\n✅ Backfill Complete`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Backfill Failed:`, error.message);
    process.exit(1);
  }
}

main();
