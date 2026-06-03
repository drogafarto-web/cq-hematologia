import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { checkNCs } from '../qualidade/naoConformidade';

const db = admin.firestore();

export const criarArea = onCall({ region: 'southamerica-east1' }, async (request: any) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Apenas admin podem criar áreas');
  }

  const { labId, nome, nivelBiosseguranca, epeObrigatorio } = request.data;

  if (!labId || !nome || !nivelBiosseguranca || !epeObrigatorio) {
    throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
  }

  try {
    // Check for blocking NCs
    const ncCheck = await checkNCs(labId, 'biosseguranca');
    if (ncCheck.blocked) {
      throw new HttpsError(
        'failed-precondition',
        ncCheck.message || 'NC crítica aberta bloqueia operações',
      );
    }

    const areaData = {
      labId,
      nome,
      nivelBiosseguranca,
      epeObrigatorio,
      status: 'ativa',
      pessoasAtuais: 0,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: request.auth.uid,
      deletadoEm: null,
    };

    const aRef = await db.collection(`labs/${labId}/biosseguranca-areas`).add(areaData);

    return {
      success: true,
      areaId: aRef.id,
    };
  } catch (error: any) {
    throw new HttpsError('internal', error.message || 'Erro ao criar área');
  }
});

export const registrarEPE = onCall({ region: 'southamerica-east1' }, async (request: any) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Apenas admin podem registrar EPEs');
  }

  const { labId, tipo, descricao, dataValidade, qtdEstoque, qtdMinima } = request.data;

  if (!labId || !tipo || !dataValidade || qtdEstoque === undefined) {
    throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
  }

  try {
    const epeData = {
      labId,
      tipo,
      descricao,
      dataValidade: admin.firestore.Timestamp.fromDate(new Date(dataValidade)),
      qtdEstoque,
      qtdMinima: qtdMinima || 0,
      status: 'em_uso',
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: request.auth.uid,
      deletadoEm: null,
    };

    const eRef = await db.collection(`labs/${labId}/biosseguranca-epe`).add(epeData);

    return {
      success: true,
      epeId: eRef.id,
    };
  } catch (error: any) {
    throw new HttpsError('internal', error.message || 'Erro ao registrar EPE');
  }
});

export const registrarInspecao = onCall({ region: 'southamerica-east1' }, async (request: any) => {
  if (!request.auth?.token.admin && !request.auth?.token.inspetorId) {
    throw new HttpsError('permission-denied', 'Apenas inspetores podem registrar inspeções');
  }

  const { labId, areaId, areaNome, conformidades, necessitaManutencao } = request.data;

  if (!labId || !areaId || !conformidades) {
    throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
  }

  try {
    const inspecaoData = {
      labId,
      areaId,
      areaNome,
      conformidades,
      necessitaManutencao: necessitaManutencao || false,
      data: admin.firestore.FieldValue.serverTimestamp(),
      inspetor: request.auth.uid,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: request.auth.uid,
    };

    const iRef = await db.collection(`labs/${labId}/biosseguranca-inspecoes`).add(inspecaoData);

    // If maintenance needed, create NC automatically
    if (necessitaManutencao) {
      await db.collection(`labs/${labId}/nao-conformidades`).add({
        labId,
        titulo: `Manutenção requerida em ${areaNome}`,
        descricao: 'Inspeção de biossegurança identificou necessidade de manutenção',
        severidade: 'media',
        origem: 'biosseguranca',
        status: 'aberta',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
        deletadoEm: null,
      });
    }

    return {
      success: true,
      inspecaoId: iRef.id,
    };
  } catch (error: any) {
    throw new HttpsError('internal', error.message || 'Erro ao registrar inspeção');
  }
});

export const atualizarEstoqueEPE = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas admin podem atualizar estoque');
    }

    const { labId, epeId, novaQtd } = request.data;

    if (!labId || !epeId || novaQtd === undefined) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
    }

    try {
      const eRef = db.collection(`labs/${labId}/biosseguranca-epe`).doc(epeId);
      await eRef.update({ qtdEstoque: novaQtd });

      return { success: true };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao atualizar estoque');
    }
  },
);
