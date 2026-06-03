/**
 * CAPA Cloud Functions
 *
 * Callables for Corrective/Preventive Action (CAPA) lifecycle.
 * All writes audit-sealed via registerAuditEntry.
 * RDC 978 Art. 99 + DICQ 4.14.6 compliance.
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { signAuditEntry } from './audit/cryptoAudit';

const db = admin.firestore();

// ─── Validators ────────────────────────────────────────────────────────────

const CreateCAPAInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  titulo: z
    .string()
    .min(5, 'Título deve ter pelo menos 5 caracteres')
    .max(200, 'Título não pode exceder 200 caracteres'),
  descricao: z
    .string()
    .min(10, 'Descrição deve ter pelo menos 10 caracteres')
    .max(2000, 'Descrição não pode exceder 2000 caracteres'),
  encontroId: z.string().nullable().optional(),
  encontroTipo: z
    .enum(['auditoria', 'laudo', 'reclamacao', 'risco', 'nao-conformidade'])
    .nullable()
    .optional(),
  status: z
    .enum(['aberta', 'em-tratamento', 'verificada', 'fechada', 'cancelada'])
    .default('aberta'),
  prioridade: z.number().int().min(1).max(5).default(3),
  dataPrazo: z.any(), // Timestamp
});

const UpdateCAPAInput = z.object({
  labId: z.string().min(1),
  capaId: z.string().min(1),
  newStatus: z.enum(['aberta', 'em-tratamento', 'verificada', 'fechada', 'cancelada']),
  notes: z.string().optional(),
});

const AssignCAPAInput = z.object({
  labId: z.string().min(1),
  capaId: z.string().min(1),
  tipo: z.enum(['corretiva', 'preventiva']),
  descricao: z
    .string()
    .min(10, 'Descrição deve ter pelo menos 10 caracteres')
    .max(1000, 'Descrição não pode exceder 1000 caracteres'),
  responsavel: z.string().min(1, 'Responsável é obrigatório'),
  dataVencimento: z.any(), // Timestamp
  evidenciasLinks: z.array(z.string()).default([]),
  notas: z.string().optional(),
});

const VerifyCAPAInput = z.object({
  labId: z.string().min(1),
  capaId: z.string().min(1),
  verificadoPor: z.string().min(1),
  dataVerificacao: z.any(), // Timestamp
  resultado: z.enum(['efetiva', 'nao-efetiva', 'parcialmente-efetiva']),
  notas: z
    .string()
    .min(10, 'Notas devem ter pelo menos 10 caracteres')
    .max(2000, 'Notas não podem exceder 2000 caracteres'),
  horasInvestidas: z.number().min(0).default(0),
});

const SoftDeleteCAPAInput = z.object({
  labId: z.string().min(1),
  capaId: z.string().min(1),
  deletadoPor: z.string().min(1),
});

// ─── Status Transitions ────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  aberta: ['em-tratamento', 'cancelada'],
  'em-tratamento': ['verificada', 'cancelada'],
  verificada: ['fechada', 'cancelada'],
  fechada: [],
  cancelada: [],
};

function isValidTransition(currentStatus: string, newStatus: string): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ─── Helper: Check lab membership ──────────────────────────────────────────

async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const userLabsRef = db.collection('users').doc(uid).collection('labs').doc(labId);
    const snap = await userLabsRef.get();
    return snap.exists && snap.data()?.ativo === true;
  } catch {
    return false;
  }
}

async function isAdminOrRT(labId: string, uid: string): Promise<boolean> {
  try {
    const memberRef = db.collection('labs').doc(labId).collection('members').doc(uid);
    const snap = await memberRef.get();
    if (!snap.exists) return false;
    const role = snap.data()?.role;
    return role === 'admin' || role === 'owner' || role === 'rt';
  } catch {
    return false;
  }
}

// ─── createCAPA Callable ───────────────────────────────────────────────────

export const createCAPA = onCall(
  { region: 'southamerica-east1', secrets: ['AUDIT_SECRET'] },
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const input = CreateCAPAInput.parse(request.data);
    const isMember = await isActiveMemberOfLab(input.labId, request.auth.uid);

    if (!isMember) {
      throw new HttpsError('permission-denied', 'Not a lab member');
    }

    try {
      const capaCollection = db.collection('labs').doc(input.labId).collection('capa');
      const capaRef = capaCollection.doc();

      const capaDoc = {
        id: capaRef.id,
        labId: input.labId,
        titulo: input.titulo,
        descricao: input.descricao,
        encontroId: input.encontroId || null,
        encontroTipo: input.encontroTipo || null,
        status: input.status,
        prioridade: input.prioridade,
        dataPrazo: input.dataPrazo,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
        deletadoEm: null,
        deletadoPor: null,
      };

      // Write CAPA doc
      await capaRef.set(capaDoc);

      // Register audit entry
      const auditSecret = process.env.AUDIT_SECRET || 'dev-secret';
      const auditEntry = await signAuditEntry(
        `labs/${input.labId}/audit-trail`,
        request.auth.uid,
        'capa.criada',
        {
          capaId: capaRef.id,
          titulo: input.titulo,
          encontroId: input.encontroId || null,
          prioridade: input.prioridade,
        },
        auditSecret,
      );

      return {
        capaId: capaRef.id,
        auditEntryId: auditEntry.id,
      };
    } catch (error: any) {
      console.error('createCAPA error:', error);
      throw new HttpsError('internal', 'Erro ao criar CAPA. Por favor, tente novamente.');
    }
  },
);

// ─── updateCAPA Callable ───────────────────────────────────────────────────

export const updateCAPA = onCall(
  { region: 'southamerica-east1', secrets: ['AUDIT_SECRET'] },
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const input = UpdateCAPAInput.parse(request.data);
    const isAuthorized = await isAdminOrRT(input.labId, request.auth.uid);

    if (!isAuthorized) {
      throw new HttpsError(
        'permission-denied',
        'Apenas RT ou admin podem atualizar status de CAPA',
      );
    }

    try {
      const capaRef = db.collection('labs').doc(input.labId).collection('capa').doc(input.capaId);

      const snap = await capaRef.get();
      if (!snap.exists) {
        throw new HttpsError('not-found', 'CAPA não encontrada');
      }

      const capaData = snap.data();
      if (!capaData) {
        throw new HttpsError('not-found', 'CAPA não encontrada');
      }

      const currentStatus = capaData.status;
      if (!isValidTransition(currentStatus, input.newStatus)) {
        throw new HttpsError(
          'failed-precondition',
          `Transição inválida: ${currentStatus} → ${input.newStatus}`,
        );
      }

      // Update status
      await capaRef.update({
        status: input.newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Register audit entry
      const auditSecret = process.env.AUDIT_SECRET || 'dev-secret';
      await signAuditEntry(
        `labs/${input.labId}/audit-trail`,
        request.auth.uid,
        'capa.status-alterado',
        {
          capaId: input.capaId,
          oldStatus: currentStatus,
          newStatus: input.newStatus,
          notes: input.notes || '',
        },
        auditSecret,
      );

      return { success: true };
    } catch (error: any) {
      console.error('updateCAPA error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Erro ao atualizar CAPA. Por favor, tente novamente.');
    }
  },
);

// ─── assignCAPA Callable ───────────────────────────────────────────────────

export const assignCAPA = onCall(
  { region: 'southamerica-east1', secrets: ['AUDIT_SECRET'] },
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const input = AssignCAPAInput.parse(request.data);
    const isAuthorized = await isAdminOrRT(input.labId, request.auth.uid);

    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'Apenas RT ou admin podem atribuir ações');
    }

    try {
      const capaRef = db.collection('labs').doc(input.labId).collection('capa').doc(input.capaId);

      const snap = await capaRef.get();
      if (!snap.exists) {
        throw new HttpsError('not-found', 'CAPA não encontrada');
      }

      const capa = snap.data();
      if (!capa) {
        throw new HttpsError('not-found', 'CAPA não encontrada');
      }

      if (capa.status === 'fechada' || capa.status === 'cancelada') {
        throw new HttpsError(
          'failed-precondition',
          'Não é possível atribuir ações a CAPA fechada ou cancelada',
        );
      }

      // Create action in subcollection
      const acaoRef = capaRef.collection('acoes').doc();
      const acaoDoc = {
        id: acaoRef.id,
        capaId: input.capaId,
        labId: input.labId,
        tipo: input.tipo,
        descricao: input.descricao,
        responsavel: input.responsavel,
        dataVencimento: input.dataVencimento,
        status: 'aberta',
        evidenciasLinks: input.evidenciasLinks,
        notas: input.notas || '',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        deletadoEm: null,
      };

      await acaoRef.set(acaoDoc);

      // Auto-transition parent CAPA to em-tratamento if still aberta
      if (capa.status === 'aberta') {
        await capaRef.update({
          status: 'em-tratamento',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Register audit entry
      const auditSecret = process.env.AUDIT_SECRET || 'dev-secret';
      await signAuditEntry(
        `labs/${input.labId}/audit-trail`,
        request.auth.uid,
        'capa.acao-criada',
        {
          capaId: input.capaId,
          acaoId: acaoRef.id,
          tipo: input.tipo,
          responsavel: input.responsavel,
        },
        auditSecret,
      );

      return { success: true, acaoId: acaoRef.id };
    } catch (error: any) {
      console.error('assignCAPA error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Erro ao atribuir ação. Por favor, tente novamente.');
    }
  },
);

// ─── verifyCAPA Callable ───────────────────────────────────────────────────

export const verifyCAPA = onCall(
  { region: 'southamerica-east1', secrets: ['AUDIT_SECRET'] },
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const input = VerifyCAPAInput.parse(request.data);
    const isAuthorized = await isAdminOrRT(input.labId, request.auth.uid);

    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'Apenas RT ou admin podem verificar CAPAs');
    }

    try {
      const capaRef = db.collection('labs').doc(input.labId).collection('capa').doc(input.capaId);

      const snap = await capaRef.get();
      if (!snap.exists) {
        throw new HttpsError('not-found', 'CAPA não encontrada');
      }

      const capa = snap.data();
      if (!capa) {
        throw new HttpsError('not-found', 'CAPA não encontrada');
      }

      if (capa.status !== 'em-tratamento') {
        throw new HttpsError(
          'failed-precondition',
          'Verificação só é possível em CAPAs em-tratamento',
        );
      }

      // Create verification in subcollection
      const verRef = capaRef.collection('verificacoes').doc();
      const verDoc = {
        id: verRef.id,
        capaId: input.capaId,
        labId: input.labId,
        verificadoPor: input.verificadoPor,
        dataVerificacao: input.dataVerificacao,
        resultado: input.resultado,
        notas: input.notas,
        horasInvestidas: input.horasInvestidas,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        deletadoEm: null,
      };

      await verRef.set(verDoc);

      // If resultado === 'efetiva', auto-close CAPA
      if (input.resultado === 'efetiva') {
        await capaRef.update({
          status: 'fechada',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Otherwise move to 'verificada' (not yet closed)
        await capaRef.update({
          status: 'verificada',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Register audit entry
      const auditSecret = process.env.AUDIT_SECRET || 'dev-secret';
      await signAuditEntry(
        `labs/${input.labId}/audit-trail`,
        request.auth.uid,
        'capa.verificada',
        {
          capaId: input.capaId,
          resultado: input.resultado,
          horasInvestidas: input.horasInvestidas,
        },
        auditSecret,
      );

      return { success: true };
    } catch (error: any) {
      console.error('verifyCAPA error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'internal',
        'Erro ao registrar verificação. Por favor, tente novamente.',
      );
    }
  },
);

// ─── softDeleteCAPA Callable ───────────────────────────────────────────────

export const softDeleteCAPA = onCall(
  { region: 'southamerica-east1', secrets: ['AUDIT_SECRET'] },
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth token required');
    }

    const input = SoftDeleteCAPAInput.parse(request.data);
    const isAuthorized = await isAdminOrRT(input.labId, request.auth.uid);

    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'Apenas RT ou admin podem deletar CAPAs');
    }

    try {
      const capaRef = db.collection('labs').doc(input.labId).collection('capa').doc(input.capaId);

      const snap = await capaRef.get();
      if (!snap.exists) {
        throw new HttpsError('not-found', 'CAPA não encontrada');
      }

      // Soft delete: set deletadoEm and deletadoPor, never deleteDoc
      await capaRef.update({
        deletadoEm: admin.firestore.FieldValue.serverTimestamp(),
        deletadoPor: input.deletadoPor,
      });

      // Register audit entry
      const auditSecret = process.env.AUDIT_SECRET || 'dev-secret';
      await signAuditEntry(
        `labs/${input.labId}/audit-trail`,
        request.auth.uid,
        'capa.deletada',
        {
          capaId: input.capaId,
          deletadoPor: input.deletadoPor,
        },
        auditSecret,
      );

      return { success: true };
    } catch (error: any) {
      console.error('softDeleteCAPA error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Erro ao deletar CAPA. Por favor, tente novamente.');
    }
  },
);
