import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { computeHmac } from '../audit/cryptoAudit';
import { Equipamento, EquipamentoValidacao } from './types';

const db = admin.firestore();

export const criarEquipamento = onCall(async (request) => {
  const { labId, nome, marca, modelo, numeroSerie, fornecedorCalibracaoId } = request.data;
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'User not authenticated');
  if (!labId || !nome || !marca || !modelo || !numeroSerie) throw new HttpsError('invalid-argument', 'Missing required fields');

  const userClaims = request.auth?.token as any;
  if (!userClaims?.admin && !userClaims?.responsavelTecnico) throw new HttpsError('permission-denied', 'Only admin/RT can create equipamentos');

  const now = admin.firestore.FieldValue.serverTimestamp() as any;
  const equipId = db.collection(`labs/${labId}/equipamentos`).doc().id;
  const proximaCalibracao = new Date(); proximaCalibracao.setMonth(proximaCalibracao.getMonth() + 12);
  const proximaManutenccao = new Date(); proximaManutenccao.setMonth(proximaManutenccao.getMonth() + 6);

  const equipamento: Equipamento = {
    id: equipId, labId, nome, marca, modelo, numeroSerie,
    dataQualificacaoInicial: now,
    qualificadoPor: uid,
    proximaCalibracaoPrevista: admin.firestore.Timestamp.fromDate(proximaCalibracao),
    proximaManutenccaoPrevista: admin.firestore.Timestamp.fromDate(proximaManutenccao),
    status: 'ativo',
    fornecedorCalibracaoId,
    hmac: '',
    previousHash: null,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  };

  const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
  if (!secret) throw new HttpsError('internal', 'HMAC key not configured');
  equipamento.hmac = computeHmac({ labId, nome, status: 'ativo', fornecedorCalibracaoId }, secret);

  await db.collection(`labs/${labId}/equipamentos`).doc(equipId).set(equipamento);
  return { success: true, equipId };
});

export const registrarCalibracacao = onCall(async (request) => {
  const { labId, equipId, certificado_url, fornecedorId } = request.data;
  const uid = request.auth?.uid;
  if (!uid || !labId || !equipId || !certificado_url) throw new HttpsError('invalid-argument', 'Missing required fields');

  const userClaims = request.auth?.token as any;
  if (!userClaims?.responsavelTecnico) throw new HttpsError('permission-denied', 'Only RT can register');

  const equipRef = db.collection(`labs/${labId}/equipamentos`).doc(equipId);
  const equipDoc = await equipRef.get();
  if (!equipDoc.exists) throw new HttpsError('not-found', 'Equipment not found');

  const now = admin.firestore.FieldValue.serverTimestamp() as any;
  const proximaCalibracao = new Date(); proximaCalibracao.setMonth(proximaCalibracao.getMonth() + 12);
  const proximaData = admin.firestore.Timestamp.fromDate(proximaCalibracao);

  await equipRef.update({ ultimaCalibracaoData: now, ultimaCalibracaoFornecedorId: fornecedorId, proximaCalibracaoPrevista: proximaData, status: 'ativo', updatedAt: now });

  return { success: true, proximaData };
});

export async function validarCalibracaoEquipamento(labId: string, equipId: string): Promise<EquipamentoValidacao> {
  const equipDoc = await db.collection(`labs/${labId}/equipamentos`).doc(equipId).get();
  if (!equipDoc.exists) return { allowed: false, reason: 'Equipamento não encontrado' };

  const equip = equipDoc.data() as Equipamento;
  if (equip.status === 'quebrado') return { allowed: false, reason: 'Equipamento quebrado' };
  if (equip.status === 'em_manutencao') return { allowed: false, reason: 'Equipamento em manutenção' };

  const now = new Date();
  const proximaCal = equip.proximaCalibracaoPrevista.toDate();
  if (proximaCal < now) return { allowed: false, reason: `Calibração vencida em ${proximaCal.toLocaleDateString('pt-BR')}`, dataVencimento: equip.proximaCalibracaoPrevista };
  if (!equip.ultimaCalibracaoData) return { allowed: false, reason: 'Nunca foi calibrado' };

  return { allowed: true };
}
