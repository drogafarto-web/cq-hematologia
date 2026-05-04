import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Equipamento, Calibracao, Manutencao } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';
import { checkNCs } from '../qualidade/naoConformidade';

const db = admin.firestore();

export const criarEquipamento = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin && !request.auth?.token.responsavelTecnico) {
      throw new HttpsError('permission-denied', 'Apenas admin/RT podem criar equipamentos');
    }

    const {
      labId,
      nome,
      marca,
      modelo,
      numeroSerie,
      fornecedorCalibracaoId,
      dataProximaCalibracaoPrevista,
      dataProximaManutenccaoPrevista,
    } = request.data;

    if (!labId || !nome || !marca || !modelo || !numeroSerie || !fornecedorCalibracaoId) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, nome, marca, modelo, numeroSerie, fornecedorCalibracaoId');
    }

    try {
      // ADR 0003 Wave 3: Check for blocking NCs before creating equipment
      const ncCheck = await checkNCs(labId, 'equipamento');
      if (ncCheck.blocked) {
        throw new HttpsError(
          'failed-precondition',
          ncCheck.message || 'NC crítica aberta bloqueia operações neste módulo'
        );
      }

      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      const now = admin.firestore.Timestamp.now();

      const eq: Partial<Equipamento> = {
        labId,
        nome,
        marca,
        modelo,
        numeroSerie,
        dataQualificacaoInicial: now,
        qualificadoPor: request.auth.uid,
        proximaCalibracaoPrevista: admin.firestore.Timestamp.fromDate(
          new Date(dataProximaCalibracaoPrevista || Date.now() + 365 * 24 * 60 * 60 * 1000)
        ),
        proximaManutenccaoPrevista: admin.firestore.Timestamp.fromDate(
          new Date(dataProximaManutenccaoPrevista || Date.now() + 180 * 24 * 60 * 60 * 1000)
        ),
        status: 'ativo',
        fornecedorCalibracaoId,
        hmac: '',
        previousHash: null,
        createdAt: now,
        updatedAt: now,
        createdBy: request.auth.uid,
      };

      if (secret) {
        const hmac = await signAuditEntry(
          `/labs/${labId}/equipamentos`,
          request.auth.uid,
          `eq.criado.${numeroSerie}`,
          eq,
          secret
        );
        (eq as any).hmac = hmac.hmac;
      }

      const eqRef = await db.collection(`labs/${labId}/equipamentos`).add(eq);

      return {
        success: true,
        equipamentoId: eqRef.id,
        numeroSerie,
        status: 'ativo',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao criar equipamento');
    }
  }
);

export const registrarCalibracacao = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }

    const { labId, equipamentoId, fornecedorId, status, proximaDataCalibracao, certificadoUrl, observacoes } =
      request.data;

    if (!labId || !equipamentoId || !fornecedorId || !status || !proximaDataCalibracao) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, equipamentoId, fornecedorId, status, proximaDataCalibracao'
      );
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      const now = admin.firestore.Timestamp.now();

      const calibracao: Partial<Calibracao> = {
        equipamentoId,
        labId,
        dataRealizacao: now,
        realizadoPor: request.auth.uid,
        fornecedorId,
        proximaDataCalibracao: admin.firestore.Timestamp.fromDate(new Date(proximaDataCalibracao)),
        certificado_url: certificadoUrl || '',
        status: status as 'ok' | 'com_restricoes' | 'reprovado',
        observacoes,
        hmac: '',
        createdAt: now,
      };

      if (secret) {
        const hmac = await signAuditEntry(
          `/labs/${labId}/equipamentos/${equipamentoId}/calibracoes`,
          request.auth.uid,
          `calibracao.${equipamentoId}`,
          calibracao,
          secret
        );
        (calibracao as any).hmac = hmac.hmac;
      }

      // Update equipamento
      const eqRef = db.collection(`labs/${labId}/equipamentos`).doc(equipamentoId);
      await eqRef.update({
        proximaCalibracaoPrevista: admin.firestore.Timestamp.fromDate(new Date(proximaDataCalibracao)),
        ultimaCalibracaoData: now,
        ultimaCalibracaoFornecedorId: fornecedorId,
        updatedAt: now,
      });

      // Store calibracao
      const calibRef = await db.collection(`labs/${labId}/equipamentos/${equipamentoId}/calibracoes`).add(calibracao);

      return {
        success: true,
        calibracaoId: calibRef.id,
        equipamentoId,
        proximaDataCalibracao,
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao registrar calibração');
    }
  }
);

export const registrarManutencao = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }

    const { labId, equipamentoId, fornecedorId, tipo, descricao, proximaDataManutencao, custo_total, pecasSubstituidas } =
      request.data;

    if (!labId || !equipamentoId || !fornecedorId || !tipo || !descricao || !proximaDataManutencao) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, equipamentoId, fornecedorId, tipo, descricao, proximaDataManutencao'
      );
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      const now = admin.firestore.Timestamp.now();

      const manutencao: Partial<Manutencao> = {
        equipamentoId,
        labId,
        dataRealizacao: now,
        realizadoPor: request.auth.uid,
        fornecedorId,
        tipo: tipo as 'preventiva' | 'corretiva' | 'emergencial',
        descricao,
        proximaDataManutencao: admin.firestore.Timestamp.fromDate(new Date(proximaDataManutencao)),
        pecasSubstituidas: pecasSubstituidas || [],
        custo_total: custo_total || 0,
        hmac: '',
        createdAt: now,
      };

      if (secret) {
        const hmac = await signAuditEntry(
          `/labs/${labId}/equipamentos/${equipamentoId}/manutencoes`,
          request.auth.uid,
          `manutencao.${equipamentoId}`,
          manutencao,
          secret
        );
        (manutencao as any).hmac = hmac.hmac;
      }

      // Update equipamento
      const eqRef = db.collection(`labs/${labId}/equipamentos`).doc(equipamentoId);
      await eqRef.update({
        proximaManutenccaoPrevista: admin.firestore.Timestamp.fromDate(new Date(proximaDataManutencao)),
        ultimaManutenccaoData: now,
        ultimaManutenccaoFornecedorId: fornecedorId,
        updatedAt: now,
      });

      // Store manutencao
      const mantRef = await db.collection(`labs/${labId}/equipamentos/${equipamentoId}/manutencoes`).add(manutencao);

      return {
        success: true,
        manutencaoId: mantRef.id,
        equipamentoId,
        proximaDataManutencao,
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao registrar manutenção');
    }
  }
);
