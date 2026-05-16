/**
 * transitarVigencia.ts
 *
 * Cloud Function callable for document status transitions.
 * State machine validation + signature + chainHash + audit trail.
 * Requires RT claim.
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generateLogicalSignature } from '../shared/auditHash';

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
function verifyRTSignature(pin: string, request: CallableRequest<TransitionPayload>): boolean {
  // TODO: Store PIN hash in user record + verify here
  // For now: basic length check
  if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
    throw new Error('PIN inválido');
  }

  // Verify RT claim
  const claims = request.auth?.token as any;
  if (!claims?.['rt-member'] && !claims?.['admin']) {
    throw new Error('Apenas Responsáveis Técnicos podem aprovar transições');
  }

  return true;
}

export const transitarVigencia = onCall<TransitionPayload>(
  { region: 'southamerica-east1' },
  async (request) => {
    const data = request.data;
    // 1. Authentication
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const userId = request.auth.uid;

    // 2. Authorization (RT claim)
    const claims = request.auth.token as any;
    if (!claims?.['rt-member'] && !claims?.['admin']) {
      throw new HttpsError('permission-denied', 'Apenas RT pode transitar documentos');
    }

    // 3. Validate lab membership
    const isSuperAdmin = claims?.['isSuperAdmin'] === true;
    if (!isSuperAdmin) {
      const memberRef = db.collection(`labs/${data.labId}/members`).doc(request.auth!.uid);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists || memberSnap.data()?.active !== true) {
        throw new HttpsError('permission-denied', `Acesso negado ao lab ${data.labId}`);
      }
    }

    // 4. Verify PIN
    try {
      verifyRTSignature(data.pin, request);
    } catch (err) {
      throw new HttpsError('invalid-argument', (err as Error).message);
    }

    // 5. Fetch document
    const docRef = db.collection(`/labs/${data.labId}/sgq-documentos`).doc(data.documentoId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Documento não encontrado');
    }

    const doc = docSnap.data() as any;
    const currentStatus: StatusVigencia = doc.statusVigencia || 'draft';

    // 6. Validate state machine
    if (!validateTransition(currentStatus, data.novoStatus)) {
      throw new HttpsError(
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
  },
);
