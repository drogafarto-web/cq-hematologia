import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';
import type { LogicalSignature } from './types';

const db = admin.firestore();

// ============ Zod Input Validator ============

const FinalizeSessionInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  auditoriaId: z.string().min(1, 'auditoriaId é obrigatório'),
  sessaoId: z.string().min(1, 'sessaoId é obrigatório'),
});

type FinalizeSessionInputType = z.infer<typeof FinalizeSessionInput>;

// ============ Helper: Check lab membership ============

async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const userLabsRef = db.collection('users').doc(uid).collection('labs').doc(labId);
    const snap = await userLabsRef.get();
    return snap.exists && snap.data()?.ativo === true;
  } catch {
    return false;
  }
}

// ============ Callable ============

/**
 * finalizeSession: Finalizes an audit session.
 * - Validates all checklist items have been responded
 * - Calculates final counters and conformity score
 * - Updates session status to 'finalizada' with dataFim
 * - Generates LogicalSignature (SHA-256 hash of all responses)
 */
export const finalizeSession = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<FinalizeSessionInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const operatorId = request.auth.uid;

    // Validate input
    let input: FinalizeSessionInputType;
    try {
      input = FinalizeSessionInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    // Check lab membership
    const isSuperAdmin = !!request.auth.token.superAdmin || !!request.auth.token.isSuperAdmin;
    const isMember = isSuperAdmin || (await isActiveMemberOfLab(input.labId, operatorId));
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      const basePath = `labs/${input.labId}/auditorias-internas/${input.auditoriaId}/sessoes/${input.sessaoId}`;

      // Verify session exists and is not already finalized
      const sessaoRef = db
        .collection(`labs/${input.labId}/auditorias-internas/${input.auditoriaId}/sessoes`)
        .doc(input.sessaoId);

      const sessaoSnap = await sessaoRef.get();
      if (!sessaoSnap.exists) {
        throw new HttpsError('not-found', 'Sessão não encontrada');
      }

      const sessaoData = sessaoSnap.data()!;
      if (sessaoData.status === 'finalizada') {
        throw new HttpsError('failed-precondition', 'Sessão já está finalizada');
      }

      // Fetch all checklist items
      const checklistSnap = await db.collection(`${basePath}/checklist-items`).get();

      if (checklistSnap.empty) {
        throw new HttpsError('failed-precondition', 'Sessão não possui itens de checklist');
      }

      // Validate all items have been responded and calculate counters
      void checklistSnap.docs.length; // assert non-empty (validated above)
      const unanswered: string[] = [];
      let totalConforme = 0;
      let totalNaoConforme = 0;
      let totalNA = 0;

      // Collect responses for signature generation (sorted by doc ID for determinism)
      const sortedDocs = checklistSnap.docs.sort((a, b) => a.id.localeCompare(b.id));
      const responseEntries: Array<{ id: string; resposta: string }> = [];

      for (const doc of sortedDocs) {
        const data = doc.data();

        if (data.resposta === null || data.resposta === undefined) {
          unanswered.push(data.numeroDICQ || doc.id);
        } else {
          if (data.resposta === 'conforme') totalConforme++;
          else if (data.resposta === 'não-conforme' || data.resposta === 'nao-conforme')
            totalNaoConforme++;
          else totalNA++;
        }

        responseEntries.push({
          id: doc.id,
          resposta: data.resposta || 'null',
        });
      }

      // Block finalization if there are unanswered items
      if (unanswered.length > 0) {
        throw new HttpsError(
          'failed-precondition',
          `${unanswered.length} item(ns) sem resposta: ${unanswered.slice(0, 5).join(', ')}${unanswered.length > 5 ? '...' : ''}`,
        );
      }

      // Calculate conformity score (percentage)
      const totalApplicable = totalConforme + totalNaoConforme;
      const score =
        totalApplicable > 0 ? Math.round((totalConforme / totalApplicable) * 10000) / 100 : 0;

      // Generate LogicalSignature: SHA-256 hash of all responses
      const canonicalPayload = JSON.stringify(
        responseEntries.map((e) => ({ id: e.id, resposta: e.resposta })),
      );

      const hash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');

      const assinatura: LogicalSignature = {
        hash,
        operatorId,
        ts: admin.firestore.Timestamp.now(),
      };

      // Update session to finalized
      await sessaoRef.update({
        status: 'finalizada',
        dataFim: admin.firestore.Timestamp.now(),
        itensConforme: totalConforme,
        itensNãoConforme: totalNaoConforme,
        itensNA: totalNA,
        score,
        assinatura,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: operatorId,
      });

      // Write to audit-trail
      const auditTrailRef = db.collection(`${basePath}/audit-trail`).doc();

      await auditTrailRef.set({
        id: auditTrailRef.id,
        action: 'finalizeSession',
        sessaoId: input.sessaoId,
        score,
        totalConforme,
        totalNaoConforme,
        totalNA,
        signatureHash: hash,
        operatorId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        score,
        totalNC: totalNaoConforme,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao finalizar sessão');
    }
  },
);
