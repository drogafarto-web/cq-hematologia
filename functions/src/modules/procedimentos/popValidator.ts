import * as admin from 'firebase-admin';
import { Qualificacao } from '../pessoas/types';
import { POPValidationResult } from './types';

const db = admin.firestore();

/**
 * canOperadorUsarPOP — Check if operator is trained on a specific POP version
 *
 * Validates:
 * 1. Operator has Qualificacao record
 * 2. Has training record for this POP version
 * 3. Training is not expired
 *
 * Returns { allowed: boolean, reason?: string }
 */
export async function canOperadorUsarPOP(
  labId: string,
  uid: string,
  popId: string,
  popVersaoAtual: string  // e.g., "1.0"
): Promise<POPValidationResult> {
  try {
    // Fetch operator's Qualificacao
    const qualsSnap = await db
      .collection(`labs/${labId}/qualificacoes`)
      .where('uid', '==', uid)
      .limit(1)
      .get();

    if (qualsSnap.empty) {
      return {
        allowed: false,
        reason: `Operator ${uid} has no qualifications recorded`,
      };
    }

    const qual = qualsSnap.docs[0].data() as Qualificacao;

    // Find training record for this POP version
    const popTraining = qual.treinamentosPOP?.find(
      (t) => t.popId === popId && t.popVersaoNumero === popVersaoAtual
    );

    if (!popTraining) {
      return {
        allowed: false,
        reason: `Operator not trained on POP version ${popVersaoAtual}. Available versions: ${
          qual.treinamentosPOP?.map((t) => `${t.popId}@${t.popVersaoNumero}`).join(', ') || 'none'
        }`,
      };
    }

    // Check training validity (not expired)
    const now = new Date();
    const validoAte = popTraining.validoAte.toDate();

    if (validoAte < now) {
      const daysExpired = Math.floor((now.getTime() - validoAte.getTime()) / (1000 * 60 * 60 * 24));
      return {
        allowed: false,
        reason: `Training on POP v${popVersaoAtual} expired ${daysExpired} days ago (${validoAte.toLocaleDateString()})`,
      };
    }

    // Success: operator can use this POP
    const daysUntilExpiry = Math.floor((validoAte.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      allowed: true,
      expiraEm: popTraining.validoAte,
    };
  } catch (error: any) {
    return {
      allowed: false,
      reason: `Error validating POP access: ${error.message}`,
    };
  }
}

/**
 * checkTrainingValid — Gate function for CIQ run save
 *
 * Called before saving a CIQ run to verify operator has valid training on POP version.
 * If validation fails, throws error preventing run save.
 *
 * Usage:
 * ```typescript
 * // In hematologia.ts submitRun():
 * await popValidator.checkTrainingValid(labId, uid, currentPopId, currentPopVersao);
 * // If throws → can't save run
 * // If success → continue to denormalize popReferencia
 * ```
 */
export async function checkTrainingValid(
  labId: string,
  uid: string,
  popId: string,
  popVersaoNumero: string
): Promise<void> {
  const result = await canOperadorUsarPOP(labId, uid, popId, popVersaoNumero);

  if (!result.allowed) {
    throw new Error(`Cannot save run: ${result.reason}`);
  }
}

/**
 * getOperadorPOPTrainingStatus — Get detailed training status for operator on all POPs
 *
 * Returns array of training records with expiry status.
 * Useful for dashboard/UI to show operator's POP training status.
 */
export async function getOperadorPOPTrainingStatus(
  labId: string,
  uid: string
): Promise<
  Array<{
    popId: string;
    popVersaoNumero: string;
    dataConcluso: string;
    validoAte: string;
    diasParaExpirar: number;
    expirado: boolean;
  }>
> {
  try {
    const qualsSnap = await db
      .collection(`labs/${labId}/qualificacoes`)
      .where('uid', '==', uid)
      .limit(1)
      .get();

    if (qualsSnap.empty) {
      return [];
    }

    const qual = qualsSnap.docs[0].data() as Qualificacao;
    const now = new Date();

    return (qual.treinamentosPOP || []).map((training) => {
      const validoAte = training.validoAte.toDate();
      const diasParaExpirar = Math.floor(
        (validoAte.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        popId: training.popId,
        popVersaoNumero: training.popVersaoNumero,
        dataConcluso: training.dataConcluso.toDate().toISOString(),
        validoAte: validoAte.toISOString(),
        diasParaExpirar,
        expirado: diasParaExpirar < 0,
      };
    });
  } catch (error: any) {
    throw new Error(`Error fetching training status: ${error.message}`);
  }
}

/**
 * getPOPVersionWithSignature — Fetch a POP version with RT signature details
 *
 * Useful for audit trail and verification.
 */
export async function getPOPVersionWithSignature(
  labId: string,
  popId: string,
  popVersaoNumero: string
) {
  const versionsSnap = await db
    .collection(`labs/${labId}/pops/${popId}/versoes`)
    .where('numero', '==', popVersaoNumero)
    .limit(1)
    .get();

  if (versionsSnap.empty) {
    throw new Error(`POP version ${popVersaoNumero} not found`);
  }

  return versionsSnap.docs[0].data();
}

/**
 * getActivePOPVersion — Get currently active version of a POP
 */
export async function getActivePOPVersion(labId: string, popId: string) {
  const versionsSnap = await db
    .collection(`labs/${labId}/pops/${popId}/versoes`)
    .where('status', '==', 'ativa')
    .limit(1)
    .get();

  if (versionsSnap.empty) {
    return null;
  }

  return versionsSnap.docs[0].data();
}

/**
 * getAllActivePOPsForModule — Get all active POPs that apply to a specific module
 *
 * Useful for UI to list required POPs for a module.
 */
export async function getAllActivePOPsForModule(labId: string, modulo: string) {
  const popsSnap = await db
    .collection(`labs/${labId}/pops`)
    .where('modulos', 'array-contains', modulo)
    .get();

  const result = [];

  for (const popDoc of popsSnap.docs) {
    const pop = popDoc.data();
    const activeVersion = await getActivePOPVersion(labId, popDoc.id);

    if (activeVersion) {
      result.push({
        popId: popDoc.id,
        nome: pop.nome,
        codigo: pop.codigo,
        versaoAtiva: activeVersion.numero,
        versaoAtivaId: activeVersion.id,
      });
    }
  }

  return result;
}

/**
 * getMissingPOPTrainings — Find which POPs operator is NOT trained on
 *
 * Compares required POPs for a module against operator's training records.
 * Returns list of POPs requiring training.
 */
export async function getMissingPOPTrainings(
  labId: string,
  uid: string,
  modulo: string
): Promise<
  Array<{
    popId: string;
    popNome: string;
    popCodigo: string;
    requiredVersion: string;
  }>
> {
  try {
    const activePOPs = await getAllActivePOPsForModule(labId, modulo);
    const trainingStatus = await getOperadorPOPTrainingStatus(labId, uid);

    const trainingMap = new Map(
      trainingStatus
        .filter((t) => !t.expirado)
        .map((t) => [`${t.popId}@${t.popVersaoNumero}`, true])
    );

    const missing = [];

    for (const pop of activePOPs) {
      const key = `${pop.popId}@${pop.versaoAtiva}`;
      if (!trainingMap.has(key)) {
        const popDoc = await db.doc(`labs/${labId}/pops/${pop.popId}`).get();
        const popData = popDoc.data();
        missing.push({
          popId: pop.popId,
          popNome: popData?.nome || 'Unknown',
          popCodigo: popData?.codigo || 'Unknown',
          requiredVersion: pop.versaoAtiva,
        });
      }
    }

    return missing;
  } catch (error: any) {
    throw new Error(`Error checking missing trainings: ${error.message}`);
  }
}
