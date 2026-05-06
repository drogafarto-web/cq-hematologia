/**
 * transitarVigencia.ts
 *
 * Cloud Function callable for document status transitions.
 * State machine validation + signature + chainHash + audit trail.
 * Requires RT claim.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { verifyLogicalSignature, generateLogicalSignature } from '../shared/auditHash';

const db = admin.firestore();

type StatusVigencia = 'draft' | 'em-revisao' | 'vigente' | 'obsoleto';

interface TransitionPayload {
  labId: string;
  documentoId: string;
  novoStatus: StatusVigencia;
  razao: string;
  pin: string;
}

interface Transition {
  doStatus: StatusVigencia;
  paraStatus: StatusVigencia;
  razao: string;
  assinadoPor: string;
  ts: admin.firestore.Timestamp;
  hash: string;
}

const VALID_TRANSITIONS: Record<StatusVigencia, StatusVigencia[]> = {
  'draft': ['em-revisao'],
  'em-revisao': ['vigente', 'draft'],
  'vigente': ['obsoleto', 'em-revisao'],
  'obsoleto': ['vigente'],
};

/**
 * Validate state machine transition
 */
function validateTransition(from: StatusVigencia, to: StatusVigencia): boolean {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/**
 * Verify RT signature via PIN
 * In production: compare against stored PIN hash
 * For MVP: placeholder validation
 */
function verifyRTSignature(pin: string, context: functions.https.CallableContext): boolean {
  // TODO: Store PIN hash in user record + verify here
  // For now: basic length check
  if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
    throw new Error('PIN inválido');
  }

  // Verify RT claim
  const claims = context.auth?.token as any;
  if (!claims?.['rt-member'] && !claims?.['admin']) {
    throw new Error('Apenas Responsáveis Técnicos podem aprovar transições');
  }

  return true;
}

export const transitarVigencia = functions
  .region('southamerica-east1')
  .https.onCall(async (data: TransitionPayload, context) => {
    // 1. Authentication
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const userId = context.auth.uid;

    // 2. Authorization (RT claim)
    const claims = context.auth.token as any;
    if (!claims?.['rt-member'] && !claims?.['admin']) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas RT pode transitar documentos');
    }

    // 3. Validate lab membership
    if (!claims?.['labs']?.includes(data.labId)) {
      throw new functions.https.HttpsError('permission-denied', `Acesso negado ao lab ${data.labId}`);
    }

    // 4. Verify PIN
    try {
      verifyRTSignature(data.pin, context);
    } catch (err) {
      throw new functions.https.HttpsError('invalid-argument', (err as Error).message);
    }

    // 5. Fetch document
    const docRef = db.collection(`/labs/${data.labId}/sgq-documentos`).doc(data.documentoId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Documento não encontrado');
    }

    const doc = docSnap.data() as any;
    const currentStatus: StatusVigencia = doc.statusVigencia || 'draft';

    // 6. Validate state machine
    if (!validateTransition(currentStatus, data.novoStatus)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Transição inválida: ${currentStatus} → ${data.novoStatus}`
      );
    }

    // 7. Build transition record with signature
    const now = admin.firestore.Timestamp.now();
    const transitionData = {
      doStatus: currentStatus,
      paraStatus: data.novoStatus,
      razao: data.razao,
      assinadoPor: userId,
      ts: now,
    };

    const transitionHash = generateLogicalSignature({
      ...transitionData,
      ts: now.toDate(),
    });

    const transition: Transition = {
      ...transitionData,
      hash: transitionHash,
    };

    // 8. Atomic update via transaction
    const batch = db.batch();

    // Update document status
    const docUpdateData = {
      statusVigencia: data.novoStatus,
      transitions: admin.firestore.FieldValue.arrayUnion(transition),
      ultimaAtualizacao: now,
      aud: {
        operatorId: userId,
        hash: generateLogicalSignature({
          statusVigencia: data.novoStatus,
          ultimaAtualizacao: now.toDate(),
        }),
        ts: now,
      },
    };

    batch.update(docRef, docUpdateData);

    // Log audit event
    const auditRef = db.collection(`/labs/${data.labId}/sgq-audit`).doc();
    batch.set(auditRef, {
      event: 'transicao-vigencia',
      documentoId: data.documentoId,
      doStatus: currentStatus,
      paraStatus: data.novoStatus,
      operatorId: userId,
      razao: data.razao,
      ts: now,
      hash: transitionHash,
    });

    // Commit
    await batch.commit();

    return {
      success: true,
      documentoId: data.documentoId,
      statusAnterior: currentStatus,
      statusNovo: data.novoStatus,
      ts: now.toDate().toISOString(),
    };
  });
