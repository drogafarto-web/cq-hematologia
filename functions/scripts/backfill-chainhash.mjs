/**
 * backfill-chainhash.mjs
 *
 * Sela movimentações de insumos que ficaram em `chainStatus: 'pending'` antes
 * da trigger `onInsumoMovimentacaoCreate` estar na região correta. Replica
 * fielmente a lógica de `functions/src/modules/insumos/chainHash.ts`:
 *   chainHash = SHA256(payloadSignature + previous.chainHash)
 *   genesis: SHA256("hcq-insumo-movimentacao-v1")
 *
 * Uso:
 *   # Dry-run — só lista o que faria
 *   node scripts/backfill-chainhash.mjs
 *
 *   # Aplicar
 *   node scripts/backfill-chainhash.mjs --apply
 *
 * CTO deve autorizar antes do --apply — escreve em coleção regulatória.
 */

import admin from 'firebase-admin';
import crypto from 'node:crypto';

admin.initializeApp();
const db = admin.firestore();

const apply = process.argv.includes('--apply');

// Idêntico ao chainHash.ts da function
const INSUMO_CHAIN_GENESIS_HASH = crypto
  .createHash('sha256')
  .update('hcq-insumo-movimentacao-v1')
  .digest('hex');

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function main() {
  const labsSnap = await db.collection('labs').get();
  let totalSealed = 0;
  let totalAlreadySealed = 0;

  for (const labDoc of labsSnap.docs) {
    const labId = labDoc.id;

    // Busca todas as movimentações do lab, ordenadas cronologicamente.
    // Ordem canônica: timestamp asc, tiebreak por movId lex.
    const movsSnap = await db
      .collection(`labs/${labId}/insumo-movimentacoes`)
      .orderBy('timestamp', 'asc')
      .get();

    if (movsSnap.empty) continue;

    // Agrupa por insumoId preservando ordem cronológica
    const byInsumo = new Map();
    for (const doc of movsSnap.docs) {
      const d = doc.data();
      const insumoId = d.insumoId;
      if (!byInsumo.has(insumoId)) byInsumo.set(insumoId, []);
      byInsumo.get(insumoId).push({ id: doc.id, ref: doc.ref, data: d });
    }

    console.log(`\nLab ${labId} — ${byInsumo.size} insumos com movimentações`);

    for (const [insumoId, movs] of byInsumo) {
      // Ordenação canônica: timestamp asc, tiebreak por movId lex
      movs.sort((a, b) => {
        const ta = a.data.timestamp.toMillis();
        const tb = b.data.timestamp.toMillis();
        if (ta !== tb) return ta - tb;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

      let previousChainHash = INSUMO_CHAIN_GENESIS_HASH;

      for (const mov of movs) {
        if (mov.data.chainStatus === 'sealed' && mov.data.chainHash) {
          // Já selado — usa o chainHash existente como previous do próximo
          previousChainHash = mov.data.chainHash;
          totalAlreadySealed++;
          continue;
        }

        // Validação do payloadSignature (mesma guard da trigger)
        if (
          !mov.data.payloadSignature ||
          typeof mov.data.payloadSignature !== 'string' ||
          mov.data.payloadSignature.length !== 64
        ) {
          console.error(`  ❌ ${mov.id}: payloadSignature inválido, pulando`);
          continue;
        }

        const chainHash = sha256Hex(mov.data.payloadSignature + previousChainHash);
        const isGenesis = previousChainHash === INSUMO_CHAIN_GENESIS_HASH;

        console.log(
          `  ${apply ? '🔏 Selando' : '🔍 Selaria'} ${mov.id.slice(0, 8)}... ` +
            `(insumo=${insumoId.slice(0, 8)}..., tipo=${mov.data.tipo}, ` +
            `${isGenesis ? 'GENESIS' : 'linked'}) → chainHash=${chainHash.slice(0, 16)}...`,
        );

        if (apply) {
          await mov.ref.update({
            chainHash,
            chainStatus: 'sealed',
            sealedAt: admin.firestore.FieldValue.serverTimestamp(),
            backfilledBy: 'script:backfill-chainhash.mjs',
            backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          totalSealed++;
        }

        previousChainHash = chainHash;
      }
    }
  }

  console.log(`\n─── Totais ───`);
  console.log(`Já selados (preservados): ${totalAlreadySealed}`);
  console.log(`${apply ? 'Selados agora' : 'Selariam'}: ${apply ? totalSealed : '(dry-run)'}`);
  if (!apply) console.log(`\nPara aplicar: node scripts/backfill-chainhash.mjs --apply`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
