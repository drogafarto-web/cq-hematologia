/**
 * Dual-write triggers — recomputam HMAC server-side e gravam `serverHmac`
 * ao lado do signature do cliente. Divergências viram auditLogs.
 *
 * Não rejeita escritas com mismatch — essa é a fase de observação. Após janela
 * de 7-14 dias sem divergências reais, promover rules exigindo `serverHmac`.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import {
  HCQ_SIGNATURE_HMAC_KEY,
  computeHmac,
  verify,
} from './verifier';
import {
  extractMovimentacaoCanonicalFields,
  extractRunCanonicalFields,
} from './canonical';

async function logDivergence(
  kind: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await admin
    .firestore()
    .collection('auditLogs')
    .add({
      action: 'SIGNATURE_DIVERGENCE',
      kind,
      detail,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      severity: 'warning',
    });
}

// ─── Hematologia / Coag / Uro runs ───────────────────────────────────────────

function makeRunSigner(subpath: string, moduleId: string) {
  return onDocumentWritten(
    {
      document: subpath,
      secrets: [HCQ_SIGNATURE_HMAC_KEY],
    },
    async (event) => {
      const afterSnap = event.data?.after;
      if (!afterSnap || !afterSnap.exists) return;
      const data = afterSnap.data();
      if (!data) return;

      // Idempotência — se já temos serverHmac correto para o conteúdo atual, skip.
      const canonical = extractRunCanonicalFields(data);
      const key = HCQ_SIGNATURE_HMAC_KEY.value();
      const serverHmac = computeHmac(key, canonical);

      if (data['serverHmac'] === serverHmac) return;

      const clientSig = (data['logicalSignature'] as string | undefined) ?? null;
      const result = verify(key, canonical, clientSig);

      if (result.divergence) {
        await logDivergence('run', {
          path: afterSnap.ref.path,
          moduleId,
          clientSignature: clientSig,
          serverHmac: result.serverHmac,
        }).catch(() => {});
      }

      // Dual-write — grava serverHmac e flag de divergência
      await afterSnap.ref.update({
        serverHmac,
        serverHmacComputedAt: admin.firestore.FieldValue.serverTimestamp(),
        signatureDivergence: result.divergence,
      });
    },
  );
}

export const onHematologiaRunSignature = makeRunSigner(
  'labs/{labId}/lots/{lotId}/runs/{runId}',
  'hematologia',
);

export const onImunoRunSignature = makeRunSigner(
  'labs/{labId}/ciq-imuno/{lotId}/runs/{runId}',
  'imunologia',
);

// ─── Insumo movimentações ────────────────────────────────────────────────────
//
// Nota: movimentações já têm o trigger de chain-hash existente. Este trigger
// adiciona serverHmac ao lado do payloadSignature client-side. Concorrem
// em paralelo — nenhum depende do outro.

export const onMovimentacaoSignature = onDocumentWritten(
  {
    document: 'labs/{labId}/insumo-movimentacoes/{movId}',
    secrets: [HCQ_SIGNATURE_HMAC_KEY],
  },
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap || !afterSnap.exists) return;
    const data = afterSnap.data();
    if (!data) return;

    const canonical = extractMovimentacaoCanonicalFields(data);
    const key = HCQ_SIGNATURE_HMAC_KEY.value();
    const serverHmac = computeHmac(key, canonical);

    if (data['serverHmac'] === serverHmac) return;

    const clientSig = (data['payloadSignature'] as string | undefined) ?? null;
    const result = verify(key, canonical, clientSig);

    if (result.divergence) {
      await logDivergence('insumo-movimentacao', {
        path: afterSnap.ref.path,
        clientSignature: clientSig,
        serverHmac: result.serverHmac,
      }).catch(() => {});
    }

    await afterSnap.ref.update({
      serverHmac,
      serverHmacComputedAt: admin.firestore.FieldValue.serverTimestamp(),
      signatureDivergence: result.divergence,
    });
  },
);
