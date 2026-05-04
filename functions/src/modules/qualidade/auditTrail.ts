import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type { AuditEntry } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';

const db = admin.firestore();

/**
 * ADR 0001 Wave 1 — Audit Trail Skeleton
 * Complete implementation in Wave 2
 */

export const logAction = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    const { labId, operation, modulo, acao, resultado, payload } = request.data;

    if (!labId || !operation || !modulo) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      const entry: Partial<AuditEntry> = {
        labId,
        operation,
        modulo,
        acao: acao || operation,
        resultado: resultado || 'sucesso',
        operatorId: request.auth.uid,
        payload: payload || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
        deletadoEm: null,
        previousHash: null,
        hmac: '',
        hash: '',
      };

      if (secret) {
        const sig = await signAuditEntry(
          `/labs/${labId}/audit-trail`,
          request.auth.uid,
          operation,
          entry,
          secret
        );
        (entry as any).hmac = sig.hmac;
        (entry as any).hash = sig.hash;
      }

      const entryRef = await db.collection(`labs/${labId}/audit-trail`).add(entry);

      return {
        success: true,
        entryId: entryRef.id,
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
