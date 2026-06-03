import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { NaoConformidade, NCSeveridade, NCOrigem } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';
import { HCQ_SIGNATURE_HMAC_KEY } from '../signatures/verifier';

const db = admin.firestore();

// ─── NC Blocking Gate Helper ──────────────────────────────────────────────────
// Used by 7 modules to check if critical NCs are open before operations

export interface NCBlockingCheckResult {
  blocked: boolean;
  blockingNC?: NaoConformidade;
  message?: string;
}

/**
 * checkNCs — Check if there are critical NCs open for a given module.
 * Called by module services before create/update operations.
 *
 * Returns: { blocked: true, blockingNC } if critical NC found
 *          { blocked: false } if clear to proceed
 */
export async function checkNCs(labId: string, moduloId: string): Promise<NCBlockingCheckResult> {
  try {
    const snapshot = await db
      .collection(`labs/${labId}/naoConformidades`)
      .where('moduloOrigemId', '==', moduloId)
      .where('severidade', '==', 'critica')
      .where('bloqueiaOperacoes', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { blocked: false };
    }

    const blockingNC = snapshot.docs[0].data() as NaoConformidade;
    return {
      blocked: true,
      blockingNC,
      message: `NC crítica ${blockingNC.codigo} bloqueia operações no módulo ${moduloId}. Resolva a NC antes de prosseguir.`,
    };
  } catch (error: any) {
    // If there's an error checking NCs, fail-safe: don't block
    console.error(`Error checking NCs for ${moduloId}:`, error);
    return { blocked: false };
  }
}

export const openNaoConformidade = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }

    const { labId, titulo, descricao, categoria, severidade, origem } = request.data;

    if (!labId || !titulo || !descricao || !severidade) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, titulo, descricao, severidade',
      );
    }

    // Gate: severidade CRITICA bloqueia operação
    if (severidade === NCSeveridade.CRITICA) {
      return {
        success: false,
        message: 'NC crítica requer aprovação de RT antes de ser aberta',
        requiresApproval: true,
      };
    }

    try {
      const secret = HCQ_SIGNATURE_HMAC_KEY.value();
      const numero = `NC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const nc: Partial<NaoConformidade> = {
        labId,
        codigo: numero,
        titulo,
        descricao,
        categoria: categoria || 'geral',
        severidade: severidade as NCSeveridade,
        capaStatus: 'nao_iniciada',
        capaHistorico: [],
        origem: (origem || 'interno') as NCOrigem,
        abertaPor: request.auth.uid,
        criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      if (secret) {
        const hmac = await signAuditEntry(
          `/labs/${labId}/naoConformidades`,
          request.auth.uid,
          `nc.aberta.${numero}`,
          nc,
          secret,
        );
        (nc as any).hmac = hmac.hmac;
      }

      const ncRef = await db.collection(`labs/${labId}/naoConformidades`).add(nc);

      return {
        success: true,
        ncId: ncRef.id,
        numero,
        status: 'aberta',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao abrir NC');
    }
  },
);

export const updateNaoConformidade = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }

    const { labId, ncId, updates } = request.data;

    if (!labId || !ncId || !updates) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, ncId, updates');
    }

    try {
      const docRef = db.collection(`labs/${labId}/naoConformidades`).doc(ncId);
      const snap = await docRef.get();

      if (!snap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrada`);
      }

      const updateData: any = {
        ...updates,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      // Prevent modification of core fields
      delete updateData.labId;
      delete updateData.numero;
      delete updateData.abertaPor;
      delete updateData.dataAbertura;

      await docRef.update(updateData);

      return {
        success: true,
        ncId,
        updated: Object.keys(updates),
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao atualizar NC');
    }
  },
);

export const addAcao = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }

    const { labId, ncId, descricao, responsavel, dataPlanejada } = request.data;

    if (!labId || !ncId || !descricao || !responsavel) {
      throw new HttpsError(
        'invalid-argument',
        'Campos obrigatórios: labId, ncId, descricao, responsavel',
      );
    }

    try {
      const docRef = db.collection(`labs/${labId}/naoConformidades`).doc(ncId);
      const snap = await docRef.get();

      if (!snap.exists) {
        throw new HttpsError('not-found', `NC ${ncId} não encontrada`);
      }

      const nc = snap.data() as NaoConformidade;
      const novaAcao = {
        descricao,
        responsavel,
        dataPrevista: admin.firestore.Timestamp.fromDate(new Date(dataPlanejada)),
        status: 'planejada' as const,
      };

      const updateData: Partial<NaoConformidade> = {
        capaStatus: 'acao',
        capaHistorico: [
          ...(nc.capaHistorico || []),
          {
            estado: 'acao',
            dataTransicao: admin.firestore.FieldValue.serverTimestamp() as any,
            responsavel: request.auth.uid,
            descricao: novaAcao.descricao,
            dataPrevista: novaAcao.dataPrevista,
          },
        ],
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      await docRef.update(updateData);

      return {
        success: true,
        ncId,
        status: 'acaoPropostaPela_acao',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao adicionar ação');
    }
  },
);
