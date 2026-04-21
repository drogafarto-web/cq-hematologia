// ─── Insumos Module — Chain Hash Trigger ─────────────────────────────────────
//
// Trigger onDocumentCreated em labs/{labId}/insumo-movimentacoes/{movId}.
//
// Resolve o fork que ocorreria se o chainHash fosse calculado client-side:
// dois dispositivos offline lendo o mesmo `previous.chainHash` e sincronizando
// depois produziriam dois sucessores no mesmo evento. Server-side, a ordem
// canônica é ditada pelo `timestamp` (serverTimestamp) do Firestore, com
// tiebreaker determinístico pelo `movId` lexicográfico.
//
// Design:
//   1. Trigger recebe o doc recém-criado (chainStatus='pending', chainHash=null).
//   2. Consulta o evento anterior IMEDIATAMENTE prévio do mesmo `insumoId`,
//      ordenado por `timestamp` desc, que já esteja `sealed`.
//   3. Calcula chainHash = SHA256(payloadSignature + previous.chainHash).
//      Genesis: primeiro evento do insumo usa INSUMO_CHAIN_GENESIS_HASH.
//   4. Atualiza o doc com { chainHash, chainStatus: 'sealed', sealedAt }.
//   5. Idempotência: se chainStatus já é 'sealed' ou chainHash != null,
//      early return — retries não reprocessam.
//
// Tiebreaker: se dois docs têm `timestamp` idêntico (raro, mesma ms), ordena
// por `movId` lexicográfico — determinístico em qualquer replay.
//
// Race condition: se um evento A chega antes de B na ordem canônica mas B é
// processado primeiro (cold start, concorrência), B vai ler A como "prévio"
// correto. Só funciona se A já foi selado. Tratamento: se o trigger vê que o
// prévio imediato ainda está 'pending', adia via retry automático do
// scheduler (throw) — próxima execução (com A selado) finaliza B.

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import * as crypto from 'node:crypto';

// Duplicata intencional do client-side — evita dependência cruzada TS entre
// functions/ e src/. Testes unitários (test/unit/insumos/chainGenesis.test.ts)
// verificam que as duas constantes batem.
const INSUMO_CHAIN_GENESIS_SEED = 'hcq-insumo-movimentacao-v1';
const INSUMO_CHAIN_GENESIS_HASH = crypto
  .createHash('sha256')
  .update(INSUMO_CHAIN_GENESIS_SEED)
  .digest('hex');

/** SHA-256 hex de uma string ASCII. */
function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

interface MovimentacaoDoc {
  insumoId: string;
  payloadSignature: string;
  chainHash: string | null;
  chainStatus: 'pending' | 'sealed';
  timestamp: admin.firestore.Timestamp;
}

/**
 * Busca o evento imediatamente anterior do mesmo insumo no mesmo lab,
 * já selado. Retorna null se este é o primeiro evento (genesis) ou se o
 * anterior ainda não foi selado (requer retry).
 */
async function findPreviousSealed(
  db: admin.firestore.Firestore,
  labId: string,
  insumoId: string,
  currentMovId: string,
  currentTimestamp: admin.firestore.Timestamp,
): Promise<{ chainHash: string } | null | 'not-ready'> {
  // Ordenação canônica: por timestamp desc. Nota: timestamp < currentTimestamp
  // para estrita anterioridade. Empates em timestamp caem em tiebreaker lexicográfico
  // por movId — tratamos abaixo.
  const prevSnap = await db
    .collection(`labs/${labId}/insumo-movimentacoes`)
    .where('insumoId', '==', insumoId)
    .where('timestamp', '<', currentTimestamp)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  if (prevSnap.empty) {
    // Verifica empate em timestamp (mesma ms) com movId lexicograficamente menor.
    // Consulta idêntica com `<=` e filtro manual.
    const tieSnap = await db
      .collection(`labs/${labId}/insumo-movimentacoes`)
      .where('insumoId', '==', insumoId)
      .where('timestamp', '==', currentTimestamp)
      .get();

    const ties = tieSnap.docs
      .filter((d) => d.id < currentMovId)
      .map((d) => d.data() as MovimentacaoDoc);
    if (ties.length === 0) return null;

    const latestTie = ties.reduce((a, b) => (a && a.chainStatus === 'sealed' ? a : b));
    if (latestTie.chainStatus !== 'sealed' || !latestTie.chainHash) return 'not-ready';
    return { chainHash: latestTie.chainHash };
  }

  const prev = prevSnap.docs[0].data() as MovimentacaoDoc;
  if (prev.chainStatus !== 'sealed' || !prev.chainHash) {
    return 'not-ready';
  }
  return { chainHash: prev.chainHash };
}

/**
 * Trigger principal. Reside em southamerica-east1 (consistência com Firestore).
 *
 * Retries automáticos: 3 tentativas (configuração do scheduler V2). Se um
 * evento anterior ainda está 'pending' na execução atual, throw força retry
 * com backoff exponencial — tipicamente resolve em <10s.
 */
export const onInsumoMovimentacaoCreate = onDocumentCreated(
  {
    document: 'labs/{labId}/insumo-movimentacoes/{movId}',
    region: 'southamerica-east1',
    memory: '256MiB',
    retry: true,
  },
  async (event) => {
    const { labId, movId } = event.params;
    const snap = event.data;
    if (!snap) {
      logger.warn('[insumos][chainHash] Event without data snapshot', { labId, movId });
      return;
    }

    const data = snap.data() as MovimentacaoDoc;

    // Idempotência — já selado → no-op.
    if (data.chainStatus === 'sealed' && data.chainHash) {
      return;
    }

    // Guard contra docs mal-formados. Rules já validam, mas defense-in-depth.
    if (!data.payloadSignature || typeof data.payloadSignature !== 'string' || data.payloadSignature.length !== 64) {
      logger.error('[insumos][chainHash] Invalid payloadSignature', { labId, movId });
      return; // Não joga — doc defeituoso não deve ser retryado.
    }

    const db = admin.firestore();

    const previous = await findPreviousSealed(
      db,
      labId,
      data.insumoId,
      movId,
      data.timestamp,
    );

    if (previous === 'not-ready') {
      // Evento anterior ainda pendente — lança para forçar retry do scheduler.
      logger.info('[insumos][chainHash] Previous event not yet sealed, retrying', {
        labId,
        movId,
        insumoId: data.insumoId,
      });
      throw new Error('Previous event not yet sealed; retrying');
    }

    const previousChainHash = previous ? previous.chainHash : INSUMO_CHAIN_GENESIS_HASH;
    const chainHash = sha256Hex(data.payloadSignature + previousChainHash);

    await snap.ref.update({
      chainHash,
      chainStatus: 'sealed',
      sealedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('[insumos][chainHash] Sealed', {
      labId,
      movId,
      insumoId: data.insumoId,
      isGenesis: previous === null,
    });
  },
);
