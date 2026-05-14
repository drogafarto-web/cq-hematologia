import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';
import type { Auditoria, Achado, Sessao, ChecklistItem, LogicalSignature } from './types';
import { checkNCs } from '../qualidade/naoConformidade';

// Load checklist templates from seed data
const CHECKLIST_TEMPLATES = require('../../seeds/checklistTemplates.json');

const db = admin.firestore();

// ============ Zod Input Validators ============

const RegisterAchadoInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  auditoriaId: z.string().min(1, 'auditoriaId é obrigatório'),
  sessaoId: z.string().min(1, 'sessaoId é obrigatório'),
  checklistItemId: z.string().min(1, 'checklistItemId é obrigatório'),
  descricao: z
    .string()
    .min(20, 'Descrição deve ter pelo menos 20 caracteres')
    .max(500, 'Descrição não pode exceder 500 caracteres')
    .regex(/^[\w\s\p{L}\p{P}]+$/u, 'Descrição contém caracteres inválidos'),
  severidade: z.enum(['crítica', 'grave', 'moderada', 'leve', 'observação']),
  evidencia: z
    .string()
    .max(2000, 'Evidência não pode exceder 2000 caracteres')
    .optional(),
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
    const memberRef = db.collection(`labs/${labId}/members`).doc(uid);
    const snap = await memberRef.get();
    return snap.exists && snap.data()?.active === true;
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
  { region: 'southamerica-east1', cors: true },
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
        criadoEm: admin.firestore.Timestamp.now(),
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
  { region: 'southamerica-east1', cors: true },
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

      // Generate logical signature with deterministic canonical JSON
      const canonicalPayload = {
        auditoriaId: input.auditoriaId,
        checklistItemId: input.checklistItemId,
        descricao: input.descricao,
        sessaoId: input.sessaoId,
        severidade: input.severidade,
      };
      const sortedKeys = Object.keys(canonicalPayload).sort();
      const canonicalJson =
        '{' +
        sortedKeys
          .map((k) => `"${k}":${JSON.stringify((canonicalPayload as any)[k])}`)
          .join(',') +
        '}';
      const hash = crypto
        .createHash('sha256')
        .update(canonicalJson)
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

      // Use transaction for atomic achado + NC creation
      let ncCreated = false;
      let ncId: string | undefined;

      const result = await db.runTransaction(async (tx) => {
        // Always write achado
        tx.set(achadoRef, achado);

        // If severity >= grave, auto-create NC in same transaction
        if (input.severidade === 'crítica' || input.severidade === 'grave') {
          const ncRef = db
            .collection(`labs/${input.labId}/naoConformidades`)
            .doc();

          // Prepare NC data with deterministic signature
          const ncCanonical = {
            achadoId: achadoRef.id,
            auditoriaId: input.auditoriaId,
            descricao: input.descricao,
            origem: 'auditoria-interna',
            severidade: input.severidade,
          };
          const ncSortedKeys = Object.keys(ncCanonical).sort();
          const ncCanonicalJson =
            '{' +
            ncSortedKeys
              .map((k) => `"${k}":${JSON.stringify((ncCanonical as any)[k])}`)
              .join(',') +
            '}';
          const ncHash = crypto
            .createHash('sha256')
            .update(ncCanonicalJson)
            .digest('hex');

          const ncAssinatura: LogicalSignature = {
            hash: ncHash,
            operatorId,
            ts: admin.firestore.Timestamp.now(),
          };

          const nc = {
            labId: input.labId,
            titulo: `Achado auditoria: ${input.descricao.substring(0, 60)}`,
            descricao: input.descricao,
            origem: 'auditoria-interna',
            achadoId: achadoRef.id,
            auditoriaId: input.auditoriaId,
            severidade: input.severidade,
            status: 'aberta',
            assinatura: ncAssinatura,
            criadoEm: admin.firestore.Timestamp.now(),
            criadoPor: operatorId,
            deletadoEm: null,
          };

          tx.set(ncRef, nc);

          // Update achado with NC link in same transaction
          tx.update(achadoRef, {
            ncId: ncRef.id,
            statusNC: 'criada',
          });

          return { ncId: ncRef.id, ncCreated: true };
        }

        return { ncId: undefined, ncCreated: false };
      });

      ncId = result.ncId;
      ncCreated = result.ncCreated;

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
  { region: 'southamerica-east1', cors: true },
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
      // Get template from seed data with validation
      const template = (CHECKLIST_TEMPLATES as Record<string, any>)[input.templateId];
      if (!template) {
        throw new HttpsError('not-found', `Template ${input.templateId} not found`);
      }
      if (!template.itens || template.itens.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          `Template has no items. Expected ~115 DICQ items.`
        );
      }
      if (template.itens.length < 110) {
        console.warn(
          `Template item count (${template.itens.length}) below expected ~115. Proceeding.`
        );
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
        criadoEm: admin.firestore.Timestamp.now(),
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

        // Commit every 450 items (safe margin below 500 limit)
        if (itemsCount % 450 === 0) {
          try {
            await batch.commit();
          } catch (err: any) {
            throw new HttpsError(
              'internal',
              `Batch commit failed at item ${itemsCount}: ${err.message}. Partial load possible — restart.`
            );
          }
          batch = db.batch();
        }
      }

      // Final commit with error handling
      try {
        await batch.commit();
      } catch (err: any) {
        throw new HttpsError(
          'internal',
          `Final batch commit failed at item ${itemsCount}: ${err.message}`
        );
      }

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
  { region: 'southamerica-east1', cors: true },
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
 * closeAuditoria: Finaliza auditoria (marca como finalizada).
 */
export const closeAuditoria = onCall(
  { region: 'southamerica-east1', cors: true },
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
        deletadoEm: admin.firestore.FieldValue.serverTimestamp(),
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
