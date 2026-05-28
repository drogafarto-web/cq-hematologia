import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'crypto';

const app = initializeApp({ projectId: 'hmatologia2' });
const db = getFirestore(app);

const labId = 'labclin-riopomba';

const URO_CRITERIOS = {
  N: {
    urobilinogenio: ['NORMAL'],
    glicose: ['NEGATIVO'],
    cetonas: ['NEGATIVO'],
    bilirrubina: ['NEGATIVO'],
    proteina: ['NEGATIVO'],
    nitrito: ['NEGATIVO'],
    ph: { min: 5.0, max: 6.0 },
    sangue: ['NEGATIVO'],
    densidade: { min: 1.005, max: 1.025 },
    leucocitos: ['NEGATIVO'],
  },
  P: {
    urobilinogenio: ['AUMENTADO'],
    glicose: ['1+', '2+', '3+', '4+'],
    cetonas: ['1+', '2+', '3+', '4+'],
    bilirrubina: ['1+', '2+', '3+', '4+'],
    proteina: ['1+', '2+', '3+'],
    nitrito: ['PRESENTE'],
    ph: { min: 6.0, max: 8.0 },
    sangue: ['1+', '2+', '3+'],
    densidade: { min: 1.015, max: 1.03 },
    leucocitos: ['1+', '2+', '3+', '4+'],
  },
};

const URO_ANALITOS = [
  'urobilinogenio',
  'glicose',
  'cetonas',
  'bilirrubina',
  'proteina',
  'nitrito',
  'ph',
  'sangue',
  'densidade',
  'leucocitos'
];

function validateUroResultado(analito, valor, nivel) {
  if (valor === null || valor === undefined) return null;
  const criterio = URO_CRITERIOS[nivel][analito];
  if (!criterio) return null;

  if ('min' in criterio && 'max' in criterio) {
    if (typeof valor !== 'number') return null;
    return valor >= criterio.min && valor <= criterio.max;
  }
  return criterio.includes(valor);
}

function avaliarRun(resultados, nivel) {
  const conformidadePorAnalito = {};
  const analitosNaoConformes = [];

  for (const analito of URO_ANALITOS) {
    const campo = resultados[analito];
    if (!campo) continue;

    const valor = campo.valor;
    const resultado = validateUroResultado(analito, valor, nivel);

    if (resultado === null) continue;

    conformidadePorAnalito[analito] = resultado;
    if (!resultado) {
      analitosNaoConformes.push(analito);
    }
  }

  const conformidade = analitosNaoConformes.length > 0 ? 'R' : 'A';
  return { conformidade, analitosNaoConformes };
}

// Genesis hash helper
function genesisHash(labId) {
  return createHash('sha256').update('hcq-audit-genesis:' + labId).digest('hex');
}

// Canonical JSON sorting
function sortedJson(value) {
  if (value === null || value === undefined) return null;
  const keys = Object.keys(value).sort();
  const out = {};
  for (const k of keys) {
    const v = value[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = sortedJson(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Content hash helper
function computeContentHash(payload) {
  const canonical = JSON.stringify({
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    timestamp: payload.timestamp,
    actorUid: payload.actorUid,
    before: payload.before ? sortedJson(payload.before) : null,
    after: payload.after ? sortedJson(payload.after) : null,
    reason: payload.reason ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

const swapConfig = {
  '81ec231c-2ff4-4933-9777-523692be16d6': {
    targetNivel: 'P',
    targetResultadosEsperados: {
      urobilinogenio: 'AUMENTADO',
      glicose: '1+',
      cetonas: '1+',
      bilirrubina: '1+',
      proteina: '1+',
      nitrito: 'PRESENTE',
      sangue: '1+',
      leucocitos: '1+',
      ph: { min: 6, max: 8 },
      densidade: { min: 1.015, max: 1.03 }
    }
  },
  '796388e5-8c3e-4415-b6a4-3f34a8a04528': {
    targetNivel: 'N',
    targetResultadosEsperados: {
      urobilinogenio: 'NORMAL',
      glicose: 'NEGATIVO',
      cetonas: 'NEGATIVO',
      bilirrubina: 'NEGATIVO',
      proteina: 'NEGATIVO',
      nitrito: 'NEGATIVO',
      sangue: 'NEGATIVO',
      leucocitos: 'NEGATIVO',
      ph: { min: 5, max: 6 },
      densidade: { min: 1.005, max: 1.025 }
    }
  }
};

async function executeMigration() {
  console.log('Starting migration transaction for swapping lot levels...');

  await db.runTransaction(async (tx) => {
    // 1. Read audit chain state to calculate correct chained hashes
    const chainStateRef = db.doc(`labs/${labId}/_state/ciq-audit-chain`);
    const stateSnap = await tx.get(chainStateRef);
    let previousHash = stateSnap.exists
      ? stateSnap.data()?.['lastChainHash']
      : genesisHash(labId);

    console.log(`Current chain hash in state: ${previousHash}`);

    const lotUpdates = [];
    const runUpdates = [];

    // 2. Fetch all current data within the transaction
    for (const [lotId, config] of Object.entries(swapConfig)) {
      const lotRef = db.collection('labs').doc(labId).collection('ciq-uroanalise').doc(lotId);
      const lotSnap = await tx.get(lotRef);

      if (!lotSnap.exists) {
        throw new Error(`Lot ${lotId} not found in Firestore.`);
      }

      const lotData = lotSnap.data();

      // Collect original info for audit before-state
      const lotBefore = {
        nivel: lotData.nivel,
        resultadosEsperados: lotData.resultadosEsperados,
      };

      const lotAfter = {
        nivel: config.targetNivel,
        resultadosEsperados: config.targetResultadosEsperados,
      };

      lotUpdates.push({
        ref: lotRef,
        data: lotAfter,
        auditBefore: lotBefore,
        auditAfter: lotAfter,
        lotId,
      });

      // Get runs for this lot
      const runsSnap = await lotRef.collection('runs').get();
      console.log(`Lot ${lotId} has ${runsSnap.size} associated run(s) to swap.`);

      runsSnap.forEach((runDoc) => {
        const runData = runDoc.data();
        const { conformidade, analitosNaoConformes } = avaliarRun(runData.resultados, config.targetNivel);

        const runBefore = {
          nivel: runData.nivel,
          resultadosEsperados: runData.resultadosEsperados,
          conformidade: runData.conformidade,
          analitosNaoConformes: runData.analitosNaoConformes,
        };

        const runAfter = {
          nivel: config.targetNivel,
          resultadosEsperados: config.targetResultadosEsperados,
          conformidade,
          analitosNaoConformes,
        };

        runUpdates.push({
          ref: runDoc.ref,
          data: runAfter,
          auditBefore: runBefore,
          auditAfter: runAfter,
          runId: runDoc.id,
          lotId,
        });
      });
    }

    // 3. Write data updates & append audit trails sequentially
    const ts = Date.now();
    const timestamp = Timestamp.fromMillis(ts);

    // Update lots
    for (const update of lotUpdates) {
      tx.update(update.ref, update.data);
      console.log(`Updated lot ${update.lotId} details.`);
    }

    // Update runs
    for (const update of runUpdates) {
      tx.update(update.ref, update.data);
      console.log(`Updated run ${update.runId} details.`);
    }

    // Write consolidated audit trail record
    const eventId = randomUUID();
    const auditRef = db.doc(`labs/${labId}/ciq-audit/${eventId}`);

    const beforeCombined = {
      lots: lotUpdates.map(u => ({ id: u.lotId, ...u.auditBefore })),
      runs: runUpdates.map(u => ({ id: u.runId, lotId: u.lotId, ...u.auditBefore })),
    };

    const afterCombined = {
      lots: lotUpdates.map(u => ({ id: u.lotId, ...u.auditAfter })),
      runs: runUpdates.map(u => ({ id: u.runId, lotId: u.lotId, ...u.auditAfter })),
    };

    const action = 'EDIT_RUN_VALUE';
    const entityType = 'lot';
    const entityId = 'swap-uro-lots-migration';
    const actorUid = 'system-migration';
    const actorName = 'Script de Migração Swap Uro Lots';
    const actorRole = 'sistema';
    const reason = 'Uroanálise Redesign & Smart Swap: Correção de níveis trocados de lote Normal e Patológico (Onda 1)';
    const severity = 'critical';

    const contentHash = computeContentHash({
      action,
      entityType,
      entityId,
      timestamp: ts,
      actorUid,
      before: beforeCombined,
      after: afterCombined,
      reason,
    });

    const chainHash = createHash('sha256')
      .update(previousHash + contentHash)
      .digest('hex');

    const auditEventData = {
      id: eventId,
      labId,
      moduleId: 'uroanalise',
      timestamp,
      action,
      entityType,
      entityId,
      actorUid,
      actorName,
      actorRole,
      reason,
      severity,
      before: beforeCombined,
      after: afterCombined,
      previousHash,
      contentHash,
      chainHash,
    };

    tx.set(auditRef, auditEventData);
    console.log(`Wrote audit record ${eventId} to labs/${labId}/ciq-audit`);

    tx.set(
      chainStateRef,
      {
        lastChainHash: chainHash,
        lastEventId: eventId,
        lastTimestamp: timestamp,
      },
      { merge: true }
    );
    console.log(`Updated audit chain state lastChainHash to ${chainHash}`);
  });

  console.log('Migration transaction successfully completed and committed.');
}

executeMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
