import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

// ============ Zod Input Validator ============

const BatchSaveResponsesInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  auditoriaId: z.string().min(1, 'auditoriaId é obrigatório'),
  sessaoId: z.string().min(1, 'sessaoId é obrigatório'),
  responses: z
    .array(
      z.object({
        itemId: z.string().min(1, 'itemId é obrigatório'),
        resposta: z.enum(['conforme', 'nao-conforme', 'N/A']),
        severidade: z.string().optional(),
        observacao: z.string().max(2000).optional(),
      }),
    )
    .min(1, 'Pelo menos uma resposta é obrigatória')
    .max(500, 'Máximo de 500 respostas por batch'),
});

type BatchSaveResponsesInputType = z.infer<typeof BatchSaveResponsesInput>;

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
 * batchSaveResponses: Saves multiple checklist responses in a single batch write.
 * Updates session counters (totalConforme, totalNaoConforme, totalNA).
 */
export const batchSaveResponses = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<BatchSaveResponsesInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const operatorId = request.auth.uid;

    // Validate input
    let input: BatchSaveResponsesInputType;
    try {
      input = BatchSaveResponsesInput.parse(request.data);
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
      const checklistCol = `${basePath}/checklist-items`;

      // Verify session exists
      const sessaoRef = db
        .collection(`labs/${input.labId}/auditorias-internas/${input.auditoriaId}/sessoes`)
        .doc(input.sessaoId);

      const sessaoSnap = await sessaoRef.get();
      if (!sessaoSnap.exists) {
        throw new HttpsError('not-found', 'Sessão não encontrada');
      }

      // Batch write all responses
      let batch = db.batch();
      let totalConforme = 0;
      let totalNaoConforme = 0;
      let totalNA = 0;
      let opsCount = 0;

      for (const resp of input.responses) {
        const itemRef = db.collection(checklistCol).doc(resp.itemId);

        const updateData: Record<string, any> = {
          resposta: resp.resposta,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: operatorId,
        };

        if (resp.severidade) {
          updateData.severidade = resp.severidade;
        }

        if (resp.observacao !== undefined) {
          updateData.observacoes = resp.observacao;
        }

        batch.update(itemRef, updateData);
        opsCount++;

        // Count responses for session stats
        if (resp.resposta === 'conforme') totalConforme++;
        else if (resp.resposta === 'nao-conforme') totalNaoConforme++;
        else totalNA++;

        // Commit every 450 ops (safe margin below 500 limit)
        if (opsCount % 450 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }

      // Update session counters
      batch.update(sessaoRef, {
        itensConforme: admin.firestore.FieldValue.increment(totalConforme),
        itensNãoConforme: admin.firestore.FieldValue.increment(totalNaoConforme),
        itensNA: admin.firestore.FieldValue.increment(totalNA),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: operatorId,
      });

      // Final batch commit
      await batch.commit();

      return {
        success: true,
        saved: input.responses.length,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao salvar respostas em batch');
    }
  },
);
