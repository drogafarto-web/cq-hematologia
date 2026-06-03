import * as admin from 'firebase-admin';
import { Equipamento, EquipamentoValidacao } from './types';

const db = admin.firestore();

export async function validarCalibracaoEquipamento(
  labId: string,
  equipId: string,
): Promise<EquipamentoValidacao> {
  try {
    const equipDoc = await db.collection(`labs/${labId}/equipamentos`).doc(equipId).get();

    if (!equipDoc.exists) {
      return { allowed: false, reason: 'Equipamento não encontrado' };
    }

    const equip = equipDoc.data() as Equipamento;

    if (equip.status === 'quebrado') {
      return { allowed: false, reason: 'Equipamento quebrado' };
    }

    if (equip.status === 'em_manutencao') {
      return { allowed: false, reason: 'Equipamento em manutenção' };
    }

    const now = new Date();
    const proximaCal = equip.proximaCalibracaoPrevista.toDate();

    if (proximaCal < now) {
      return {
        allowed: false,
        reason: `Calibração vencida em ${proximaCal.toLocaleDateString('pt-BR')}`,
        dataVencimento: equip.proximaCalibracaoPrevista,
      };
    }

    if (!equip.ultimaCalibracaoData) {
      return { allowed: false, reason: 'Nunca foi calibrado' };
    }

    return { allowed: true };
  } catch (error: any) {
    return { allowed: false, reason: `Erro ao validar: ${error.message}` };
  }
}

export async function validarManutencaoEquipamento(
  labId: string,
  equipId: string,
): Promise<EquipamentoValidacao> {
  try {
    const equipDoc = await db.collection(`labs/${labId}/equipamentos`).doc(equipId).get();

    if (!equipDoc.exists) {
      return { allowed: false, reason: 'Equipamento não encontrado' };
    }

    const equip = equipDoc.data() as Equipamento;

    if (equip.status === 'quebrado') {
      return { allowed: false, reason: 'Equipamento quebrado' };
    }

    const now = new Date();
    const proximaMan = equip.proximaManutenccaoPrevista.toDate();

    if (proximaMan < now) {
      return {
        allowed: false,
        reason: `Manutenção vencida em ${proximaMan.toLocaleDateString('pt-BR')}`,
        dataVencimento: equip.proximaManutenccaoPrevista,
      };
    }

    return { allowed: true };
  } catch (error: any) {
    return { allowed: false, reason: `Erro ao validar: ${error.message}` };
  }
}
