import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { ChecklistItem } from './types';

const db = admin.firestore();

// ============ Zod Input Validator ============

const InstallChecklistTemplateInput = z.object({
  auditoriaId: z.string().min(1, 'auditoriaId é obrigatório'),
  sessaoId: z.string().min(1, 'sessaoId é obrigatório'),
  templateId: z.string().min(1, 'templateId é obrigatório'),
  labId: z.string().min(1, 'labId é obrigatório'),
});

type InstallChecklistTemplateInputType = z.infer<typeof InstallChecklistTemplateInput>;

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
 * installChecklistTemplate: Installs a checklist template into a session,
 * creating individual checklist-item documents from the template definition.
 */
export const installChecklistTemplate = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<InstallChecklistTemplateInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    // Validate input
    let input: InstallChecklistTemplateInputType;
    try {
      input = InstallChecklistTemplateInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    // Check lab membership
    const isSuperAdmin = !!request.auth.token.superAdmin || !!request.auth.token.isSuperAdmin;
    const isMember = isSuperAdmin || (await isActiveMemberOfLab(input.labId, request.auth.uid));
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      // Read template from Firestore templates collection
      const templateSnap = await db
        .collection('templates')
        .doc(input.templateId)
        .get();

      if (!templateSnap.exists) {
        throw new HttpsError('not-found', `Template ${input.templateId} não encontrado`);
      }

      const templateData = templateSnap.data()!;
      const itens = templateData.itens as Array<{
        numeroDICQ: string;
        descricao: string;
        categoria: string;
        bloco: string;
        moduloVinculado?: string;
      }>;

      if (!itens || itens.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          'Template não possui itens de checklist'
        );
      }

      // Verify session exists
      const sessaoRef = db
        .collection(
          `labs/${input.labId}/auditorias-internas/${input.auditoriaId}/sessoes`
        )
        .doc(input.sessaoId);

      const sessaoSnap = await sessaoRef.get();
      if (!sessaoSnap.exists) {
        throw new HttpsError('not-found', 'Sessão não encontrada');
      }

      // Batch create checklist items (respecting 500 ops per batch limit)
      const checklistCol = sessaoRef.collection('checklist-items');
      let batch = db.batch();
      let itemsCreated = 0;

      for (const templateItem of itens) {
        const itemRef = checklistCol.doc();
        const item: ChecklistItem = {
          id: itemRef.id,
          sessaoId: input.sessaoId,
          labId: input.labId,
          numeroDICQ: templateItem.numeroDICQ,
          descricao: templateItem.descricao,
          categoria: templateItem.categoria,
          bloco: templateItem.bloco,
          isApplicable: true,
          resposta: null,
          severidade: null,
          observacoes: '',
          criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
          criadoPor: request.auth!.uid,
        };

        // Add moduloVinculado as extra field
        const docData: any = { ...item };
        if (templateItem.moduloVinculado) {
          docData.moduloVinculado = templateItem.moduloVinculado;
        }

        batch.set(itemRef, docData);
        itemsCreated++;

        // Commit every 450 ops (safe margin below 500 limit)
        if (itemsCreated % 450 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }

      // Final batch commit
      if (itemsCreated % 450 !== 0) {
        await batch.commit();
      }

      // Update session totalItens
      await sessaoRef.update({
        totalItens: itemsCreated,
      });

      return {
        success: true,
        itemsCreated,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao instalar template');
    }
  }
);
