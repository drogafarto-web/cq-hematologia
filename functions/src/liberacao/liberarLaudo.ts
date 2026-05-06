/**
 * liberarLaudo — RT libera laudo manualmente com assinatura
 *
 * Callable que orquestra:
 * 1. Auth: RT ou RT-Substituto
 * 2. Lê laudo + última versão
 * 3. Valida transição: Pendente ou Em Revisão → Liberado
 * 4. Recalcula chainHash server-side (não confia no client)
 * 5. Cria LaudoVersion v(N+1) com signature RT
 * 6. Update laudo: status Liberado, currentVersion N+1
 * 7. Audit log
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { assertRTAccess, LiberarLaudoInputSchema } from './validators';
import {
  Laudo,
  LaudoVersion,
  LogicalSignature,
  LabId,
  UserId,
  labId as makeLabId,
  userId as makeUserId,
} from './_shared/types';
import { validateTransition } from './_shared/stateMachine';
import { calculateChainHash } from './_shared/auditChain';

interface LiberarLaudoInput {
  labId: string;
  laudoId: string;
  signaturePayload: {
    hash: string;
    operatorId: string;
    timestamp: number;
  };
  observacao?: string;
}

interface LiberarLaudoResult {
  ok: true;
  laudoId: string;
  version: number;
  status: string;
  chainHash: string;
}

const REGION = 'southamerica-east1';

export const liberarLaudo = onCall<unknown, Promise<LiberarLaudoResult>>(
  { region: REGION, memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    const parsed = LiberarLaudoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }

    const input = parsed.data as LiberarLaudoInput;
    const { labId, laudoId, signaturePayload, observacao } = input;

    // 1. Auth: RT ou RT-Substituto
    const uid = await assertRTAccess(request.auth, labId);

    const db = admin.firestore();

    // 2. Lê laudo
    const laudoRef = db.doc(`labs/${labId}/laudos/${laudoId}`);
    const laudoSnap = await laudoRef.get();
    if (!laudoSnap.exists) {
      throw new HttpsError('not-found', 'Laudo não encontrado.');
    }
    const laudo = laudoSnap.data() as Laudo;

    // 3. Valida transição
    const validTransition = validateTransition(laudo.status, 'Liberado', 'RT');
    if (!validTransition.allowed) {
      throw new HttpsError(
        'failed-precondition',
        `Transição não permitida: ${validTransition.reason}`,
      );
    }

    // 4. Lê última versão para chainHash
    const versionsSnap = await db
      .collection(`labs/${labId}/laudo-versions`)
      .where('laudoId', '==', laudoId)
      .orderBy('version', 'desc')
      .limit(1)
      .get();

    let prevChainHash = '0'.repeat(64); // Genesis
    let nextVersion = 1;

    if (!versionsSnap.empty) {
      const lastVersion = versionsSnap.docs[0].data() as LaudoVersion;
      prevChainHash = lastVersion.chainHash;
      nextVersion = lastVersion.version + 1;
    }

    // 5. Atualiza laudo para estado Liberado
    const now = admin.firestore.Timestamp.now();
    const updatedLaudo: Laudo = {
      ...laudo,
      status: 'Liberado',
      currentVersion: nextVersion,
    };

    // 6. Recalcula chainHash server-side
    const serverChainHash = calculateChainHash(prevChainHash, {
      laudoId,
      status: 'Liberado',
      version: nextVersion,
      timestamp: now.toMillis(),
    });

    // 7. Lê operador (RT) para assinatura
    const memberSnap = await db.doc(`labs/${labId}/members/${uid}`).get();
    const memberData = memberSnap.data();

    const signature: LogicalSignature = {
      operatorId: makeUserId(uid),
      operatorRole: 'RT',
      operatorName: memberData?.name || '',
      operatorRegistro: memberData?.registro || '',
      timestamp: now,
      hash: serverChainHash,
    };

    // 8. Cria nova versão
    const versionId = db.collection(`labs/${labId}/laudo-versions`).doc().id;
    const newVersion: LaudoVersion = {
      id: versionId,
      labId: makeLabId(labId),
      laudoId,
      version: nextVersion,
      snapshot: updatedLaudo,
      signature,
      chainHash: serverChainHash,
      criadoEm: now,
    };

    // 9. Transaction: update laudo + create version + audit
    const batch = db.batch();

    batch.update(laudoRef, {
      status: 'Liberado',
      currentVersion: nextVersion,
    });

    const versionRef = db.doc(`labs/${labId}/laudo-versions/${versionId}`);
    batch.set(versionRef, newVersion);

    const auditRef = db.collection(`labs/${labId}/audit-logs`).doc();
    batch.set(auditRef, {
      tipo: 'laudo_liberado',
      laudoId,
      operatorId: uid,
      operatorRole: 'RT',
      versao: nextVersion,
      observacao,
      criadoEm: now,
    });

    await batch.commit();

    return {
      ok: true,
      laudoId,
      version: nextVersion,
      status: 'Liberado',
      chainHash: serverChainHash,
    };
  },
);
