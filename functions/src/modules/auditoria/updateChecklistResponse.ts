import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { LogicalSignature } from './types';
import { createNCFromAchado } from './achadoToNC';

const db = admin.firestore();

// ============ Zod Input Validator ============

const UpdateChecklistResponseInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  auditoriaId: z.string().min(1, 'auditoriaId é obrigatório'),
  sessaoId: z.string().min(1, 'sessaoId é obrigatório'),
  itemId: z.string().min(1, 'itemId é obrigatório'),
  resposta: z.enum(['conforme', 'nao-conforme', 'N/A']),
  severidade: z.string().optional(),
  observacao: z.string().max(2000, 'Observação não pode exceder 2000 caracteres').optional(),
});

type UpdateChecklistResponseInputType = z.infer<typeof UpdateChecklistResponseInput>;

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
 * updateChecklistResponse: Updates a single checklist item response.
 * If resposta is 'nao-conforme' with severidade 'critica' or 'grave',
 * automatically triggers achado/NC creation.
 * Writes to audit-trail for traceability.
 */
export const updateChecklistResponse = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<UpdateChecklistResponseInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const operatorId = request.auth.uid;

    // Validate input
    let input: UpdateChecklistResponseInputType;
    try {
      input = UpdateChecklistResponseInput.parse(request.data);
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
      const itemRef = db.collection(`${basePath}/checklist-items`).doc(input.itemId);

      // Verify item exists
      const itemSnap = await itemRef.get();
      if (!itemSnap.exists) {
        throw new HttpsError('not-found', 'Checklist item não encontrado');
      }

      // Build update payload
      const updateData: Record<string, any> = {
        resposta: input.resposta,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: operatorId,
      };

      if (input.severidade) {
        updateData.severidade = input.severidade;
      }

      if (input.observacao !== undefined) {
        updateData.observacoes = input.observacao;
      }

      // Update the checklist item
      await itemRef.update(updateData);

      // Write to audit-trail
      const auditTrailRef = db.collection(`${basePath}/audit-trail`).doc();

      await auditTrailRef.set({
        id: auditTrailRef.id,
        action: 'updateChecklistResponse',
        itemId: input.itemId,
        resposta: input.resposta,
        severidade: input.severidade || null,
        observacao: input.observacao || null,
        operatorId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // If nao-conforme with critical/grave severity, trigger achado creation
      let achadoCreated = false;
      let ncId: string | null = null;

      if (
        input.resposta === 'nao-conforme' &&
        (input.severidade === 'critica' ||
          input.severidade === 'grave' ||
          input.severidade === 'crítica')
      ) {
        const itemData = itemSnap.data()!;

        // Create achado document
        const achadoRef = db.collection(`${basePath}/achados`).doc();

        const achado = {
          id: achadoRef.id,
          sessaoId: input.sessaoId,
          labId: input.labId,
          checklistItemId: input.itemId,
          descricao:
            itemData.descricao || `Não-conformidade no item ${itemData.numeroDICQ || input.itemId}`,
          evidencia: input.observacao || '',
          severidade: input.severidade as any,
          statusNC: 'pendente' as const,
          assinatura: {
            hash: '',
            operatorId,
            ts: admin.firestore.Timestamp.now(),
          } as LogicalSignature,
          criadoEm: admin.firestore.Timestamp.now(),
          criadoPor: operatorId,
          deletadoEm: null,
        };

        await achadoRef.set(achado);

        // Create NC from achado
        const ncResult = await createNCFromAchado(
          input.labId,
          { ...achado, id: achadoRef.id } as any,
          input.auditoriaId,
          input.sessaoId,
          operatorId,
        );

        // Update achado with NC link
        await achadoRef.update({
          ncId: ncResult.ncId,
          statusNC: 'criada',
        });

        achadoCreated = true;
        ncId = ncResult.ncId;
      }

      return {
        success: true,
        achadoCreated,
        ncId,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao atualizar resposta');
    }
  },
);
