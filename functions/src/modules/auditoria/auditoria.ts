import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type { Auditoria, Achado } from './types';
import { checkNCs } from '../qualidade/naoConformidade';

const db = admin.firestore();

/**
 * createAuditoria: Cria auditoria interna com escopo, auditor, e data agendada.
 * Caller: admin/RT
 */
export const createAuditoria = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin && !request.auth?.token.responsavelTecnico) {
      throw new HttpsError(
        'permission-denied',
        'Apenas admin/RT podem criar auditorias'
      );
    }

    const { labId, codigo, titulo, tipo, escopo, agendadaPara } = request.data;

    if (!labId || !codigo || !titulo || !tipo || !escopo || !agendadaPara) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, codigo, titulo, tipo, escopo, agendadaPara'
      );
    }

    if (!['interna', 'externa', 'auditoria_cliente'].includes(tipo)) {
      throw new HttpsError('invalid-argument', 'Tipo inválido');
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

      const auditoria: Partial<Auditoria> = {
        labId,
        codigo,
        titulo,
        tipo,
        escopo,
        agendadaPara: admin.firestore.Timestamp.fromDate(
          new Date(agendadaPara)
        ),
        status: 'planejada',
        achados: [],
        planosAcao: [],
        checklist: {
          totalItens: 0,
          itensConforme: 0,
          itensNaoConforme: 0,
          itensNA: 0,
        },
        criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
        criadoPor: request.auth.uid,
        deletadoEm: null,
      };

      const audRef = await db
        .collection(`labs/${labId}/auditorias`)
        .add(auditoria);

      return {
        success: true,
        auditoriaId: audRef.id,
        codigo,
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao criar auditoria');
    }
  }
);

/**
 * registerAchado: Registra um achado grave/crítico numa auditoria.
 * Se severidade >= grave, oferece criação automática de NC.
 */
export const registerAchado = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin && !request.auth?.token.responsavelTecnico) {
      throw new HttpsError(
        'permission-denied',
        'Apenas admin/RT podem registrar achados'
      );
    }

    const { labId, auditoriaId, descricao, severidade, criterio, evidencias } =
      request.data;

    if (
      !labId ||
      !auditoriaId ||
      !descricao ||
      !severidade ||
      !criterio
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, auditoriaId, descricao, severidade, criterio'
      );
    }

    if (
      !['critica', 'grave', 'moderada', 'leve', 'observacao'].includes(
        severidade
      )
    ) {
      throw new HttpsError('invalid-argument', 'Severidade inválida');
    }

    try {
      const audRef = db.collection(`labs/${labId}/auditorias`).doc(auditoriaId);
      const audSnap = await audRef.get();

      if (!audSnap.exists) {
        throw new HttpsError('not-found', `Auditoria ${auditoriaId} não encontrada`);
      }

      const auditoria = audSnap.data() as Auditoria;

      // Generate unique achado ID
      const achadoId = `achado_${Date.now()}`;

      const novoAchado: Achado = {
        id: achadoId,
        descricao,
        severidade,
        criterio,
        evidencias: evidencias || [],
        registradoEm: admin.firestore.Timestamp.now(),
        registradoPor: request.auth.uid,
      };

      const achados = auditoria.achados || [];
      achados.push(novoAchado);

      await audRef.update({
        achados,
        status: auditoria.status === 'planejada' ? 'em_execucao' : auditoria.status,
      });

      return {
        success: true,
        auditoriaId,
        achadoId,
        severidade,
        requerNCAutomatica: severidade === 'critica' || severidade === 'grave',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao registrar achado');
    }
  }
);

/**
 * createPlanoAcao: Cria plano de ação pós-achado para closure.
 */
export const createPlanoAcao = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas admin podem criar planos de ação');
    }

    const { labId, auditoriaId, achadoId, descricao, responsavel, prazo } =
      request.data;

    if (!labId || !auditoriaId || !achadoId || !descricao || !responsavel || !prazo) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, auditoriaId, achadoId, descricao, responsavel, prazo'
      );
    }

    try {
      const audRef = db.collection(`labs/${labId}/auditorias`).doc(auditoriaId);
      const audSnap = await audRef.get();

      if (!audSnap.exists) {
        throw new HttpsError('not-found', `Auditoria ${auditoriaId} não encontrada`);
      }

      const auditoria = audSnap.data() as Auditoria;

      const planoId = `plano_${Date.now()}`;

      const novoPlano: any = {
        auditoriaId,
        achadoId,
        descricao,
        responsavel,
        prazo: admin.firestore.Timestamp.fromDate(new Date(prazo)),
        status: 'nao_iniciado',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
      };

      const planosAcao = (auditoria.planosAcao || []) as any[];
      planosAcao.push(novoPlano);

      await audRef.update({ planosAcao });

      return {
        success: true,
        auditoriaId,
        planoId,
        status: 'nao_iniciado',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao criar plano de ação');
    }
  }
);

/**
 * closeAuditoria: Finaliza auditoria (marca como fechada).
 */
export const closeAuditoria = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin && !request.auth?.token.responsavelTecnico) {
      throw new HttpsError(
        'permission-denied',
        'Apenas admin/RT podem fechar auditorias'
      );
    }

    const { labId, auditoriaId } = request.data;

    if (!labId || !auditoriaId) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, auditoriaId'
      );
    }

    try {
      const audRef = db.collection(`labs/${labId}/auditorias`).doc(auditoriaId);
      await audRef.update({
        status: 'fechada',
        prazoClosure: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        auditoriaId,
        status: 'fechada',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao fechar auditoria');
    }
  }
);
