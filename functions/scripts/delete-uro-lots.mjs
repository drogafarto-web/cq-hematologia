import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// 1. Initialize Firebase Admin
const app = initializeApp({
  credential: cert('./service-account.json.json'),
  projectId: 'hmatologia2',
});
const db = getFirestore();

// 2. Constants
const LAB_ID = 'labclin-riopomba';
const ACTOR_UID = 'LYBPnpoFkAYtxMK7wypmfBBvmFA2'; // RT Ernani Gomes Dutra
const TARGET_LOT_IDS = [
  '796388e5-8c3e-4415-b6a4-3f34a8a04528', // N 04862025 PNCQ
  '81ec231c-2ff4-4933-9777-523692be16d6', // P 04862025 PNCQ
  'ce612564-fa43-4ce7-8e90-d341b2aa69b7', // P 05842025 PNCQ
  'daff28d7-24a4-44b0-b230-3101e2088da3'  // N URIC 05842025 PNCQ
];

// Determine if we are running in dry-run or apply mode
const args = process.argv.slice(2);
const isApply = args.includes('--apply');

async function main() {
  console.log(`==================================================`);
  console.log(`      DELETE UROANALISE LOTS SCRIPT`);
  console.log(`      Mode: ${isApply ? '⚠️ APPLY (DESTRUCTIVE)' : '🔍 DRY-RUN (READ-ONLY)'}`);
  console.log(`==================================================\n`);

  const isoString = new Date().toISOString().replace(/[:.]/g, '-');
  const tempDir = 'C:\\Users\\labcl\\AppData\\Local\\Temp';
  const backupFileName = `uro-lots-backup-${isoString}.json`;
  const backupPath = path.join(tempDir, backupFileName);

  console.log(`Target Lab ID: ${LAB_ID}`);
  console.log(`Actor UID: ${ACTOR_UID} (Ernani)\n`);

  const backupData = {
    timestamp: new Date().toISOString(),
    labId: LAB_ID,
    actorUid: ACTOR_UID,
    mode: isApply ? 'apply' : 'dry-run',
    lots: []
  };

  // 3. Fetch all target lots and their runs
  for (const lotId of TARGET_LOT_IDS) {
    const lotRef = db.collection('labs').doc(LAB_ID).collection('ciq-uroanalise').doc(lotId);
    const lotSnap = await lotRef.get();

    if (!lotSnap.exists) {
      console.log(`[WARNING] Lot ID ${lotId} does not exist in Firestore! Skipping.`);
      continue;
    }

    const lotData = lotSnap.data();
    console.log(`Found Lot: ${lotId}`);
    console.log(`  - Lote Controle: ${lotData.loteControle || 'N/A'}`);
    console.log(`  - Fabricante: ${lotData.fabricanteControle || 'N/A'}`);
    console.log(`  - Nivel: ${lotData.nivel || 'N/A'}`);
    console.log(`  - Run Count (field): ${lotData.runCount ?? 0}`);

    // Fetch runs
    const runsSnap = await lotRef.collection('runs').get();
    console.log(`  - Runs found in subcollection: ${runsSnap.size}`);
    
    const lotBackup = {
      id: lotId,
      data: lotData,
      runs: []
    };

    runsSnap.forEach(runDoc => {
      const runData = runDoc.data();
      console.log(`    * Run ID: ${runDoc.id} | SignedBy: ${runData.createdByName || 'N/A'}`);
      lotBackup.runs.push({
        id: runDoc.id,
        data: runData
      });
    });

    backupData.lots.push(lotBackup);
    console.log('');
  }

  if (backupData.lots.length === 0) {
    console.log('No lots found to backup or delete. Exiting.');
    return;
  }

  // 4. Save backup JSON file
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`✅ Backup successfully saved to: ${backupPath}\n`);
  } catch (error) {
    console.error(`❌ Failed to save backup to ${backupPath}:`, error);
    process.exit(1);
  }

  // 5. Execute deletion if --apply is set
  if (isApply) {
    console.log(`🚀 Executing destructive deletions & audit log registrations...`);
    
    for (const lotEntry of backupData.lots) {
      const lotId = lotEntry.id;
      const lotData = lotEntry.data;
      const runs = lotEntry.runs;

      const lotRef = db.collection('labs').doc(LAB_ID).collection('ciq-uroanalise').doc(lotId);
      const auditUuid = randomUUID();
      const auditRef = db.collection('labs').doc(LAB_ID).collection('ciq-uroanalise-audit').doc(auditUuid);

      console.log(`Processing deletion for Lot: ${lotId}`);

      // Setup Audit Log
      const auditPayload = {
        action: 'lot_delete',
        lotId,
        actorUid: ACTOR_UID,
        lotSnapshot: {
          nivel: lotData.nivel || 'N/A',
          loteControle: lotData.loteControle || 'N/A',
          runCount: lotData.runCount ?? 0,
          validadeControle: lotData.validadeControle || 'N/A'
        },
        metadata: {
          scriptExecution: true,
          backupPath: backupPath
        },
        createdAt: Timestamp.now()
      };

      // Perform atomic batch delete of runs + lot + audit set
      const batch = db.batch();
      
      // Set audit log
      batch.set(auditRef, auditPayload);
      console.log(`  + Queued Audit Log: ciq-uroanalise-audit/${auditUuid}`);

      // Delete runs
      runs.forEach(run => {
        const runRef = lotRef.collection('runs').doc(run.id);
        batch.delete(runRef);
        console.log(`  - Queued delete for run: ${run.id}`);
      });

      // Delete lot
      batch.delete(lotRef);
      console.log(`  - Queued delete for lot: ${lotId}`);

      // Commit batch
      await batch.commit();
      console.log(`  🎉 Committed batch delete successfully for Lot ${lotId}!\n`);
    }

    console.log('✅ ALL OPERATIONS COMPLETED SUCCESSFULLY!');
  } else {
    console.log('🔍 DRY-RUN mode complete. No deletions or audit logs were committed to Firestore.');
    console.log('To execute the deletion and audit log generation, run with --apply.');
  }
}

main().catch(error => {
  console.error('❌ Script execution failed:', error);
  process.exit(1);
});
