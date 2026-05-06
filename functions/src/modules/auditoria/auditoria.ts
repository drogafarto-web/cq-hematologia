import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';
import type { Auditoria, Achado, Sessao, ChecklistItem, LogicalSignature } from './types';
import { checkNCs } from '../qualidade/naoConformidade';
import { createNCFromAchado } from './achadoToNC';

// Load checklist templates from seed data
const CHECKLIST_TEMPLATES = require('../../seeds/checklistTemplates.json');

const db = admin.firestore();

// ============ Zod Input Validators ============

const RegisterAchadoInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  auditoriaId: z.string().min(1, 'auditoriaId é obrigatório'),
  sessaoId: z.string().min(1, 'sessaoId é obrigatório'),
  checklistItemId: z.string().min(1, 'checklistItemId é obrigatório'),
  descricao: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  severidade: z.enum(['crítica', 'grave', 'moderada', 'leve', 'observação']),
  evidencia: z.string().optional(),
});

type RegisterAchadoInputType = z.infer<typeof RegisterAchadoInput>;

const InstallChecklistTemplateInput = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  templateId: z.string().min(1),
});

type InstallChecklistTemplateInputType = z.infer<typeof InstallChecklistTemplateInput>;

const UpdateChecklistResponseInput = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  sessaoId: z.string().min(1),
  responses: z.array(
    z.object({
      itemId: z.string().min(1),
      resposta: z.enum(['conforme', 'não-conforme', 'N/A']),
      severidade: z.enum(['crítica', 'grave', 'moderada', 'leve', 'observação']).optional(),
      observacoes: z.string().optional(),
    })
  ),
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

// ============ Callables ============

/**
 * createAuditoria: Cria auditoria interna anual com frequência e auditor.
 * Caller: admin/RT
 */
export const createAuditoria = onCall(
  { region: 'southamerica-east1' },
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const { labId, ano, frequencia, responsavelTecnico, proximaAuditoriaPlanejada } = request.data;

    if (!labId || !ano || !frequencia || !responsavelTecnico || !proximaAuditoriaPlanejada) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, ano, frequencia, responsavelTecnico, proximaAuditoriaPlanejada'
      );
    }

    const isMember = await isActiveMemberOfLab(labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      // ADR 0003 Wave 3: Check for blocking NCs before creating auditoria
      const ncCheck = await checkNCs(labId, 'auditoria');
      if (ncCheck.blocked) {
        throw new HttpsError(
          'failed-precondition',
          ncCheck.message || 'NC crítica aberta bloqueia operações neste módulo'
        );
      }

      const auditoria: Auditoria = {
        id: '', // will be set by doc ref
        labId,
        ano,
        frequencia,
        responsavelTecnico,
        proximaAuditoriaPlanejada: admin.firestore.Timestamp.fromDate(
          new Date(proximaAuditoriaPlanejada)
        ),
        status: 'planejada',
        criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
        criadoPor: request.auth.uid,
        deletadoEm: null,
      };

      const audRef = await db.collection(`labs/${labId}/auditorias-internas`).add(auditoria);

      return {
        success: true,
        auditoriaId: audRef.id,
        ano,
        frequencia,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao criar auditoria');
    }
  }
);

/**
 * registerAchado: Registra um achado (finding) numa sessão de auditoria.
 * Se severidade >= grave, cria NC automaticamente.
 */
export const registerAchado = onCall(
  { region: 'southamerica-east1' },
  async (request: CallableRequest<RegisterAchadoInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const operatorId = request.auth.uid;

    // Validate input
    let input: RegisterAchadoInputType;
    try {
      input = RegisterAchadoInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    // Check lab membership
    const isMember = await isActiveMemberOfLab(input.labId, operatorId);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      // Check for blocking NCs
      const ncCheck = await checkNCs(input.labId, 'auditoria');
      if (ncCheck.blocked) {
        throw new HttpsError('failed-precondition', ncCheck.message || 'Blocking NC prevents operation');
      }

      // Generate logical signature
      const canonicalPayload = {
        auditoriaId: input.auditoriaId,
        sessaoId: input.sessaoId,
        checklistItemId: input.checklistItemId,
        descricao: input.descricao,
        severidade: input.severidade,
      };
      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(canonicalPayload, Object.keys(canonicalPayload).sort()))
        .digest('hex');

      const assinatura: LogicalSignature = {
        hash,
        operatorId,
        ts: admin.firestore.Timestamp.now(),
      };

      // Create achado document
      const achadoRef = db
        .collection(
          `labs/${input.labId}/auditorias-internas/${input.auditoriaId}/sessoes/${input.sessaoId}/achados`
        )
        .doc();

      const achado: Achado = {
        id: achadoRef.id,
        sessaoId: input.sessaoId,
        labId: input.labId,
        checklistItemId: input.checklistItemId,
        descricao: input.descricao,
        evidencia: input.evidencia || '',
        severidade: input.severidade,
        statusNC: 'pendente',
        assinatura,
        criadoEm: assinatura.ts,
        criadoPor: operatorId,
        deletadoEm: null,
      };

      // Start batch write
      const batch = db.batch();
      batch.set(achadoRef, achado);

      // If severity >= grave, auto-create NC
      let ncCreated = false;
      let ncId: string | undefined;
      if (input.severidade === 'crítica' || input.severidade === 'grave') {
        const { ncId: newNcId } = await createNCFromAchado(
          input.labId,
          achado,
          input.auditoriaId,
          input.sessaoId,
          operatorId
        );

        ncId = newNcId;
        ncCreated = true;

        // Update achado to link NC
        batch.update(achadoRef, {
          ncId,
          statusNC: 'criada',
        });
      }

      await batch.commit();

      return {
        success: true,
        achadoId: achadoRef.id,
        severidade: input.severidade,
        ncCreated,
        ncId: ncId || null,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Error registering achado');
    }
  }
);

/**
 * installChecklistTemplate: Loads DICQ template (~115 items) into a new audit session.
 * Creates sessão + checklist items in atomic batch.
 */
export const installChecklistTemplate = onCall(
  { region: 'southamerica-east1' },
  async (request: CallableRequest<InstallChecklistTemplateInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    let input: InstallChecklistTemplateInputType;
    try {
      input = InstallChecklistTemplateInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    const isMember = await isActiveMemberOfLab(input.labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      // Get template from seed data
      const template = (CHECKLIST_TEMPLATES as Record<string, any>)[input.templateId];
      if (!template) {
        throw new HttpsError('not-found', `Template ${input.templateId} not found`);
      }

      // Create sessão document
      const sessaoRef = db
        .collection(`labs/${input.labId}/auditorias-internas/${input.auditoriaId}/sessoes`)
        .doc();

      const sessao: Sessao = {
        id: sessaoRef.id,
        auditoriaId: input.auditoriaId,
        labId: input.labId,
        auditor: request.auth.uid,
        dataInicio: admin.firestore.Timestamp.now(),
        dataFim: null,
        status: 'planejada',
        totalItens: template.itens.length,
        itensConforme: 0,
        itensNãoConforme: 0,
        itensNA: 0,
        criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
        criadoPor: request.auth.uid,
        deletadoEm: null,
      };

      // Batch create: sessão + checklist items
      let batch = db.batch();
      batch.set(sessaoRef, sessao);

      let itemsCount = 0;
      for (const templateItem of template.itens) {
        const itemRef = sessaoRef.collection('checklist-items').doc();
        const item: ChecklistItem = {
          id: itemRef.id,
          sessaoId: sessaoRef.id,
          labId: input.labId,
          numeroDICQ: templateItem.numeroDICQ,
          descricao: templateItem.descricao,
          categoria: templateItem.categoria,
          bloco: templateItem.bloco,
          isApplicable: templateItem.isApplicable,
          resposta: null,
          severidade: null,
          observacoes: '',
          criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
          criadoPor: request.auth.uid,
        };
        batch.set(itemRef, item);
        itemsCount++;

        // Commit every 400 items (safe margin below 500 limit)
        if (itemsCount % 400 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }

      // Final commit
      await batch.commit();

      return {
        success: true,
        sessaoId: sessaoRef.id,
        itemsCreated: itemsCount,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Error installing template');
    }
  }
);

/**
 * updateChecklistResponses: Batch-updates checklist item responses + sessão stats.
 * Called when auditor finalizes session (syncs offline draft responses).
 */
export const updateChecklistResponses = onCall(
  { region: 'southamerica-east1' },
  async (request: CallableRequest<UpdateChecklistResponseInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    let input: UpdateChecklistResponseInputType;
    try {
      input = UpdateChecklistResponseInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    const isMember = await isActiveMemberOfLab(input.labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      const batch = db.batch();
      let conforme = 0, naoConforme = 0, na = 0;

      for (const resp of input.responses) {
        const itemRef = db
          .collection(
            `labs/${input.labId}/auditorias-internas/${input.auditoriaId}/sessoes/${input.sessaoId}/checklist-items`
          )
          .doc(resp.itemId);

        const update: any = {
          resposta: resp.resposta,
          observacoes: resp.observacoes || '',
        };

        if (resp.resposta === 'não-conforme') {
          update.severidade = resp.severidade || 'observação';
        }

        batch.update(itemRef, update);

        // Count for sessão stats
        if (resp.resposta === 'conforme') conforme++;
        else if (resp.resposta === 'não-conforme') naoConforme++;
        else na++;
      }

      // Update sessão stats
      const sessaoRef = db
        .collection(`labs/${input.labId}/auditorias-internas/${input.auditoriaId}/sessoes`)
        .doc(input.sessaoId);

      batch.update(sessaoRef, {
        itensConforme: conforme,
        itensNãoConforme: naoConforme,
        itensNA: na,
        dataFim: input.responses.length > 0 ? admin.firestore.FieldValue.serverTimestamp() : null,
        status: 'finalizada',
      });

      await batch.commit();

      return {
        success: true,
        itemsUpdated: input.responses.length,
        stats: { conforme, naoConforme, na },
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * createPlanoAcao: Cria plano de ação pós-achado para closure.
 */
export const createPlanoAcao = onCall(
  { region: 'southamerica-east1' },
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    const { labId, achadoId, descricao, responsavel, prazo } = request.data;

    if (!labId || !achadoId || !descricao || !responsavel || !prazo) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, achadoId, descricao, responsavel, prazo'
      );
    }

    const isMember = await isActiveMemberOfLab(labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      // TODO: Implement plano de ação creation
      return {
        success: true,
        message: 'Plano de ação creation not yet implemented',
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * closeAuditoria: Finaliza auditoria (marca como finalizada).
 */
export const closeAuditoria = onCall(
  { region: 'southamerica-east1' },
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    const { labId, auditoriaId } = request.data;

    if (!labId || !auditoriaId) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, auditoriaId'
      );
    }

    const isMember = await isActiveMemberOfLab(labId, request.auth.uid);
    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      const audRef = db.collection(`labs/${labId}/auditorias-internas`).doc(auditoriaId);
      await audRef.update({
        status: 'finalizada',
      });

      return {
        success: true,
        auditoriaId,
        status: 'finalizada',
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);
