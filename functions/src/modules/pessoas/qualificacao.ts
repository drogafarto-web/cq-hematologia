import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { Qualificacao } from './types';
import { checkNCs } from '../qualidade/naoConformidade';
import { HCQ_SIGNATURE_HMAC_KEY } from '../signatures/verifier';

const db = admin.firestore();

export const criarQualificacao = functions.onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request) => {
    if (!request.auth) throw new functions.HttpsError('unauthenticated', 'Auth required');

    const { labId, uid, tipo, modulosLiberados, validoDe, validoAte } = request.data;
    if (!labId || !uid || !tipo) {
      throw new functions.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Only RT (responsavelTecnico) can grant qualifications
    const memberSnap = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
    if (!memberSnap.data()?.responsavelTecnico) {
      throw new functions.HttpsError('permission-denied', 'Only RT can grant qualifications');
    }

    // ADR 0003 Wave 3: Check for blocking NCs before creating qualification
    const ncCheck = await checkNCs(labId, 'pessoas');
    if (ncCheck.blocked) {
      throw new functions.HttpsError(
        'failed-precondition',
        ncCheck.message || 'NC crítica aberta bloqueia operações neste módulo',
      );
    }

    const secret = HCQ_SIGNATURE_HMAC_KEY.value();
    if (!secret) {
      throw new functions.HttpsError('internal', 'HCQ_SIGNATURE_HMAC_KEY not configured');
    }
    const qualData = { uid, tipo, modulosLiberados, validoDe, validoAte };
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(qualData, Object.keys(qualData).sort()), 'utf-8')
      .digest('hex');

    const qual = await db.collection(`labs/${labId}/qualificacoes`).add({
      ...qualData,
      hmac,
      liberadoPor: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    } as Qualificacao);

    return { success: true, qualId: qual.id };
  },
);

export async function isOperadorQualificadoPara(
  labId: string,
  uid: string,
  modulo: string,
): Promise<boolean> {
  const quals = await db
    .collection(`labs/${labId}/qualificacoes`)
    .where('uid', '==', uid)
    .where('modulosLiberados', 'array-contains', modulo)
    .get();

  for (const doc of quals.docs) {
    const q = doc.data() as Qualificacao;
    if (!q.validoAte) return true; // Indefinido
    if (q.validoAte.toDate() > new Date()) return true;
  }
  return false;
}
