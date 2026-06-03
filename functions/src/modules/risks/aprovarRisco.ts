/**
 * aprovarRisco.ts — callable `risks_aprovarRisco`
 *
 * Aprovação executiva de risco **crítico** (admin/owner), com verificação de
 * assinatura lógica alinhada a `signatureCanonical` / cliente.
 */

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  AprovarRiscoInputSchema,
  assertRisksAccess,
  assertRisksAdminOrOwner,
  risksCollection,
} from './validators';
import { generateRisksSignatureServer, type RiskPayload } from './signatureCanonical';

function coerceFirestoreTimestamp(value: unknown): admin.firestore.Timestamp {
  if (value instanceof admin.firestore.Timestamp) {
    return value;
  }
  if (value && typeof value === 'object' && '_seconds' in value) {
    const o = value as { _seconds: number; _nanoseconds?: number };
    return new admin.firestore.Timestamp(o._seconds, o._nanoseconds ?? 0);
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const o = value as { seconds: number; nanoseconds?: number };
    return new admin.firestore.Timestamp(o.seconds, o.nanoseconds ?? 0);
  }
  throw new HttpsError(
    'invalid-argument',
    'Assinatura: campo ts inválido (esperado Timestamp Firestore).',
  );
}

function verifyApprovalSignature(
  uid: string,
  labId: string,
  riskId: string,
  codigo: string,
  parsedSig: { hash: string; operatorId: string; ts: unknown },
): admin.firestore.Timestamp {
  if (parsedSig.operatorId !== uid) {
    throw new HttpsError(
      'permission-denied',
      'Assinatura: operatorId deve ser o usuário autenticado.',
    );
  }
  const ts = coerceFirestoreTimestamp(parsedSig.ts);
  const payload: RiskPayload = {
    action: 'aprovar_risco',
    labId,
    riskId,
    codigo,
  };
  const expected = generateRisksSignatureServer(uid, payload, ts);
  const clientHash = parsedSig.hash.toLowerCase();
  if (expected.hash.toLowerCase() !== clientHash) {
    throw new HttpsError('invalid-argument', 'Assinatura lógica inválida ou payload divergente.');
  }
  return ts;
}

export const risks_aprovarRisco = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const { labId, ...payload } = request.data;
    const auth = request.auth;

    await assertRisksAccess(auth, labId);
    await assertRisksAdminOrOwner(auth, labId);

    const uid = auth!.uid;

    let input: ReturnType<typeof AprovarRiscoInputSchema.parse>;
    try {
      input = AprovarRiscoInputSchema.parse({ labId, ...payload });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpsError('invalid-argument', `Entrada inválida: ${msg}`);
    }

    const db = admin.firestore();
    const riskRef = risksCollection(db, labId).doc(input.riskId);
    const snap = await riskRef.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Risco não encontrado.');
    }

    const risk = snap.data() as Record<string, unknown>;
    if (risk['deletadoEm'] != null) {
      throw new HttpsError('failed-precondition', 'Risco arquivado — não é possível aprovar.');
    }
    if (risk['nivel'] !== 'critico') {
      throw new HttpsError(
        'failed-precondition',
        'Aprovação só se aplica a risco em nível crítico.',
      );
    }
    const status = risk['status'] as string;
    if (status !== 'aberto' && status !== 'mitigando') {
      throw new HttpsError(
        'failed-precondition',
        'Risco deve estar em status aberto ou mitigando para aprovação executiva.',
      );
    }
    if (risk['aprovadoPor'] != null) {
      throw new HttpsError('failed-precondition', 'Risco já possui aprovação registrada.');
    }

    const codigo = String(risk['codigo'] ?? '');
    const sigTs = verifyApprovalSignature(uid, labId, input.riskId, codigo, {
      hash: input.logicalSignature.hash,
      operatorId: input.logicalSignature.operatorId,
      ts: input.logicalSignature.ts,
    });

    const now = admin.firestore.Timestamp.now();
    const logicalSignature = {
      hash: input.logicalSignature.hash,
      operatorId: input.logicalSignature.operatorId,
      ts: sigTs,
    };

    const batch = db.batch();
    const eventRef = riskRef.collection('events').doc();

    batch.update(riskRef, {
      aprovadoPor: uid,
      aprovadoEm: now,
      logicalSignature,
    });

    batch.set(eventRef, {
      id: eventRef.id,
      timestamp: now,
      operatorId: uid,
      tipo: 'aprovar_risco',
      changes: { aprovadoPor: uid, aprovadoEmMillis: now.toMillis() },
      chainHash: null,
      prevChainHash: null,
    });

    await batch.commit();

    logger.info('risks_aprovarRisco', { labId, riskId: input.riskId, uid });

    return { ok: true, eventId: eventRef.id };
  },
);
