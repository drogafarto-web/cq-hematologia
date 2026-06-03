import * as admin from 'firebase-admin';
import { POP } from './types';

const db = admin.firestore();

export async function canOperadorUsarPOP(
  labId: string,
  uid: string,
  popId: string,
  popVersaoNumero: string,
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get POP to verify it exists and version is ativa
    const popSnap = await db.collection(`labs/${labId}/pops`).doc(popId).get();
    if (!popSnap.exists) {
      return { allowed: false, reason: 'POP não encontrado' };
    }

    const pop = popSnap.data() as POP;
    const versaoAtiva = pop.versoes.find(
      (v) => v.numero === popVersaoNumero && v.status === 'ativa',
    );

    if (!versaoAtiva) {
      return { allowed: false, reason: `POP v${popVersaoNumero} não está ativa` };
    }

    // Check operator training
    const qualSnap = await db
      .collection(`labs/${labId}/qualificacoes`)
      .where('uid', '==', uid)
      .get();

    if (qualSnap.empty) {
      return { allowed: false, reason: 'Operador sem treinamento registrado' };
    }

    for (const doc of qualSnap.docs) {
      const qual = doc.data();
      const treinamentos = qual.treinamentosPOP || [];

      const trainRecord = treinamentos.find(
        (t: any) => t.popId === popId && t.popVersaoNumero === popVersaoNumero,
      );

      if (!trainRecord) continue;

      // Check if training is still valid
      const validoAte = trainRecord.validoAte.toDate?.() || trainRecord.validoAte;
      if (new Date() <= new Date(validoAte)) {
        return { allowed: true };
      } else {
        return { allowed: false, reason: 'Treinamento expirado' };
      }
    }

    return { allowed: false, reason: 'Operador não treinado nesta versão de POP' };
  } catch (error: any) {
    console.error('Error checking POP training:', error);
    return { allowed: false, reason: 'Erro ao validar treinamento' };
  }
}

export async function checkTrainingValid(
  labId: string,
  uid: string,
  modulo: string,
): Promise<{ valid: boolean; blockingReason?: string }> {
  try {
    // Get current ativa POP for module
    const popsSnap = await db
      .collection(`labs/${labId}/pops`)
      .where('modulos', 'array-contains', modulo)
      .get();

    if (popsSnap.empty) {
      return { valid: true }; // No POP required yet
    }

    for (const popDoc of popsSnap.docs) {
      const pop = popDoc.data() as POP;
      const ativaPop = pop.versoes.find((v) => v.status === 'ativa');

      if (!ativaPop) continue;

      const canUse = await canOperadorUsarPOP(labId, uid, popDoc.id, ativaPop.numero);
      if (!canUse.allowed) {
        return { valid: false, blockingReason: `POP "${pop.nome}": ${canUse.reason}` };
      }
    }

    return { valid: true };
  } catch (error: any) {
    console.error('Error checking POP training:', error);
    return { valid: true }; // Fail open to avoid blocking
  }
}

export async function getActivePOPVersion(labId: string, popId: string): Promise<string | null> {
  try {
    const popSnap = await db.collection(`labs/${labId}/pops`).doc(popId).get();
    if (!popSnap.exists) return null;

    const pop = popSnap.data() as POP;
    const ativaPop = pop.versoes.find((v) => v.status === 'ativa');
    return ativaPop?.numero || null;
  } catch (error) {
    console.error('Error getting active POP version:', error);
    return null;
  }
}
