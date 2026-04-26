/**
 * seed-pin-demo.mjs
 *
 * Demo seeder — vincula automaticamente o primeiro lote aprovado de cada
 * módulo (CIQ Imuno, Coagulação, Uroanálise) à bancada como Setup Oficial.
 * Se não houver lote aprovado, vincula o primeiro lote pendente como
 * Em Validação. Idempotente: se um lote já está vinculado, pula.
 *
 * Uso:
 *   cd "c:/hc quality"
 *   node functions/scripts/seed-pin-demo.mjs              # dry-run
 *   node functions/scripts/seed-pin-demo.mjs --apply      # aplica
 *
 * Output: por lab, por módulo, mostra qual lote foi vinculado e como.
 */

import admin from 'firebase-admin';

const APPLY = process.argv.includes('--apply');

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const ACTOR = 'seed-pin-demo';

const MODULES = [
  {
    name: 'CIQ Imuno',
    subcollection: 'ciq-imuno',
    decisionField: 'ciqDecision',
  },
  {
    name: 'Coagulação',
    subcollection: 'ciq-coagulacao',
    decisionField: 'coagDecision',
  },
  {
    name: 'Uroanálise',
    subcollection: 'ciq-uroanalise',
    decisionField: 'uroDecision',
  },
];

async function pinLot(labId, mod, lot, setupType) {
  const ref = db.doc(`labs/${labId}/${mod.subcollection}/${lot.id}`);
  const data = lot.data();
  const prev = data.setupType ?? null;
  const entry = {
    at: Timestamp.now(),
    by: ACTOR,
    action: 'vinculado',
    setupType,
    ...(prev && prev !== null ? { prevSetupType: prev } : {}),
  };

  if (APPLY) {
    await ref.update({
      setupType,
      pinnedBy: ACTOR,
      pinnedAt: FieldValue.serverTimestamp(),
      pinHistory: FieldValue.arrayUnion(entry),
    });
  }
}

async function processLab(labId) {
  console.log(`\n══════ LAB: ${labId} ══════`);

  for (const mod of MODULES) {
    const colRef = db.collection(`labs/${labId}/${mod.subcollection}`);
    const all = await colRef.get();

    if (all.empty) {
      console.log(`  [${mod.name}] (sem lotes)`);
      continue;
    }

    // Idempotência: se já há setup vinculado neste módulo, pula
    const alreadyPinned = all.docs.find((d) => {
      const v = d.data()?.setupType;
      return v === 'principal' || v === 'validacao_paralela';
    });
    if (alreadyPinned) {
      const data = alreadyPinned.data();
      console.log(
        `  [${mod.name}] já vinculado: ${data.loteControle ?? alreadyPinned.id} (${data.setupType}) — pulando`,
      );
      continue;
    }

    // Tenta lote aprovado primeiro
    const approved = all.docs.find((d) => d.data()?.[mod.decisionField] === 'A');
    if (approved) {
      const data = approved.data();
      console.log(
        `  [${mod.name}] ${APPLY ? 'VINCULANDO' : '[dry-run]'} oficial: ${data.loteControle ?? approved.id}`,
      );
      await pinLot(labId, mod, approved, 'principal');
      continue;
    }

    // Senão, primeiro pendente como validação
    const pending = all.docs.find((d) => {
      const dec = d.data()?.[mod.decisionField];
      return dec !== 'Rejeitado';
    });
    if (pending) {
      const data = pending.data();
      console.log(
        `  [${mod.name}] ${APPLY ? 'VINCULANDO' : '[dry-run]'} validação: ${data.loteControle ?? pending.id}`,
      );
      await pinLot(labId, mod, pending, 'validacao_paralela');
      continue;
    }

    console.log(`  [${mod.name}] sem candidatos (todos rejeitados)`);
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (use --apply pra escrever)'}`);
  const labsSnap = await db.collection('labs').get();
  console.log(`Labs encontrados: ${labsSnap.size}`);

  for (const labDoc of labsSnap.docs) {
    await processLab(labDoc.id);
  }

  console.log('\n✓ Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
