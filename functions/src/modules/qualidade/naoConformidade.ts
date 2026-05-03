import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  NaoConformidade,
  NCStatus,
  NCCheckResult,
  OpenNaoConformidadeRequest,
  OpenNaoConformidadeResponse,
  UpdateNaoConformidadeRequest,
  UpdateNaoConformidadeResponse,
  StatusHistoryEntry,
  NCAuditEvent,
} from './types';
import { signAuditEntry } from '../audit/cryptoAudit';

const db = admin.firestore();

/**
 * Generate NC numero in format NC-{YYYY}-{seq}
 * Queries existing NCs for this lab to find next sequence number
 */
async function generateNCNumero(labId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NC-${year}-`;

  try {
    // Query NCs created in this year
    const snapshot = await db
      .collection(`labs/${labId}/nao-conformidades`)
      .where('numero', '>=', prefix)
      .where('numero', '<', prefix.replace(year.toString(), (year + 1).toString()))
      .orderBy('numero', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return `${prefix}001`;
    }

    const lastNumero = snapshot.docs[0].data().numero;
    const lastSeq = parseInt(lastNumero.split('-')[2], 10);
    const nextSeq = String(lastSeq + 1).padStart(3, '0');

    return `${prefix}${nextSeq}`;
  } catch (error) {
    // Collection might not exist yet, start from 001
    return `${prefix}001`;
  }
}

/**
 * Get previous hash for this lab's NC chain (ADR 0005)
 */
async function getPreviousNCHash(labId: string): Promise<string | null> {
  try {
    const snapshot = await db
      .collection(`labs/${labId}/nao-conformidades`)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    return snapshot.docs[0].data().hmac || null;
  } catch (error) {
    return null;
  }
}

/**
 * Validate NC creation request
 */
function validateOpenRequest(req: OpenNaoConformidadeRequest): { valid: boolean; error?: string } {
  if (!req.labId) return { valid: false, error: 'labId is required' };
  if (!req.origem) return { valid: false, error: 'origem is required' };
  if (!req.moduloOrigemId) return { valid: false, error: 'moduloOrigemId is required' };
  if (!req.descricao) return { valid: false, error: 'descricao is required' };
  if (!req.severidade) return { valid: false, error: 'severidade is required' };
  if (!req.uid) return { valid: false, error: 'uid (operador) is required' };
  if (!req.motivo) return { valid: false, error: 'motivo is required' };

  const validOrigens = ['insumo', 'equipamento', 'controle', 'pessoas', 'processo', 'outro'];
  if (!validOrigens.includes(req.origem)) {
    return { valid: false, error: `Invalid origem: ${req.origem}` };
  }

  const validSeveridades = ['leve', 'grave', 'critica'];
  if (!validSeveridades.includes(req.severidade)) {
    return { valid: false, error: `Invalid severidade: ${req.severidade}` };
  }

  return { valid: true };
}

/**
 * Cloud Callable: Open a new Non-Conformidade
 *
 * Triggered by: Module operators/supervisors when detecting a deviation
 * Authorization: Any authenticated user (but supervisor/RT recommended)
 * Side effects:
 *  - Creates NC doc
 *  - HMAC-signs via ADR 0005
 *  - If severidade='critica', sets bloqueiaOperacoes=true
 *  - Logs to audit trail
 */
export const openNaoConformidade = functions
  .region('southamerica-east1')
  .https.onCall(async (data: OpenNaoConformidadeRequest, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    // Validate request
    const validation = validateOpenRequest(data);
    if (!validation.valid) {
      throw new functions.https.HttpsError('invalid-argument', validation.error);
    }

    const { labId, origem, origemId, moduloOrigemId, descricao, severidade, uid, motivo } = data;

    try {
      // Generate NC numero
      const numero = await generateNCNumero(labId);

      // Get previous hash for chain (ADR 0005)
      const previousHash = await getPreviousNCHash(labId);

      // Prepare NC document
      const now = admin.firestore.FieldValue.serverTimestamp();
      const ncData: Omit<NaoConformidade, 'id'> = {
        labId,
        numero,
        origem,
        origemId,
        moduloOrigemId,
        descricao,
        severidade,
        status: 'aberta',
        statusHistory: [],
        capa: {},
        aberta: {
          timestamp: now as any,
          uid,
          motivo,
        },
        bloqueiaOperacoes: severidade === 'critica', // Auto-block critical NCs
        hmac: '', // Placeholder, will be computed
        previousHash,
        createdAt: now as any,
        updatedAt: now as any,
        versao: 1,
      };

      // Compute HMAC via ADR 0005 helper
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      if (!secret) {
        throw new Error('HCQ_SIGNATURE_HMAC_KEY environment variable not configured');
      }

      // Create initial status history entry
      const statusEntry: StatusHistoryEntry = {
        timestamp: now as any,
        novoStatus: 'aberta',
        mudadoPor: uid,
        motivo: `NC aberta: ${motivo}`,
        hmac: '', // Will be computed
      };

      // Sign the status entry
      const statusHmac = await signAuditEntry(
        `labs/${labId}/nao-conformidades/audit-trail`,
        uid,
        'nc.aberta',
        {
          numero,
          origem,
          descricao,
          severidade,
          motivo,
        },
        secret
      );

      // Use the signed audit entry's HMAC for status history
      statusEntry.hmac = statusHmac.hmac;
      ncData.statusHistory.push(statusEntry);
      ncData._ncAuditTrailRef = statusHmac.id;

      // Compute full NC HMAC (deterministic, excludes hmac field itself)
      const { computeHmac } = await import('../audit/cryptoAudit');
      const ncPayload = {
        aberta: ncData.aberta,
        createdAt: ncData.createdAt,
        descricao: ncData.descricao,
        laboroOrigemId: ncData.moduloOrigemId,
        numero: ncData.numero,
        origem: ncData.origem,
        origemId: ncData.origemId,
        previousHash: ncData.previousHash,
        severidade: ncData.severidade,
        status: ncData.status,
        statusHistory: ncData.statusHistory,
      };

      ncData.hmac = computeHmac(ncPayload, secret);

      // Write NC to Firestore
      const ncDocRef = await db.collection(`labs/${labId}/nao-conformidades`).add(ncData);

      // Log to ADR 0005 audit trail (final NC creation)
      await signAuditEntry(
        `labs/${labId}/nao-conformidades/audit-trail`,
        uid,
        'nc.aberta',
        {
          ncId: ncDocRef.id,
          numero,
          origem,
          descricao,
          severidade,
          bloqueiaOperacoes: ncData.bloqueiaOperacoes,
          motivo,
        },
        secret
      );

      const response: OpenNaoConformidadeResponse = {
        success: true,
        ncId: ncDocRef.id,
        numero,
        hmac: ncData.hmac,
        message: `NC ${numero} aberta com sucesso${ncData.bloqueiaOperacoes ? ' (operações bloqueadas)' : ''}`,
      };

      return response;
    } catch (error: any) {
      console.error('openNaoConformidade error:', error);
      throw new functions.https.HttpsError('internal', error.message || 'Failed to open NC');
    }
  });

/**
 * Cloud Callable: Update NC status or CAPA fields
 *
 * Triggered by: RT (responsavelTecnico) advancing NC through CAPA workflow
 * Authorization: RT or admin only
 * Side effects:
 *  - Updates NC status
 *  - Records status transition in statusHistory
 *  - HMAC-signs all changes
 *  - Logs to audit trail
 */
export const updateNaoConformidade = functions
  .region('southamerica-east1')
  .https.onCall(async (data: UpdateNaoConformidadeRequest, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    // Check RT authorization
    const isRT = context.auth.token.responsavelTecnico === true || context.auth.token.admin === true;
    if (!isRT && data.novoStatus) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only RT can change NC status. To add investigation/action/verification data, contact RT.'
      );
    }

    const { ncId, labId, uid, novoStatus, motivoTransicao, investigacao, acaoCorretiva, verificacaoEficacia } = data;

    if (!ncId || !labId || !uid) {
      throw new functions.https.HttpsError('invalid-argument', 'ncId, labId, and uid are required');
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      if (!secret) {
        throw new Error('HCQ_SIGNATURE_HMAC_KEY environment variable not configured');
      }

      // Fetch current NC
      const ncDocRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
      const ncSnapshot = await ncDocRef.get();

      if (!ncSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', `NC ${ncId} not found`);
      }

      const currentNC = ncSnapshot.data() as NaoConformidade;

      // Validate status transition (if provided)
      if (novoStatus) {
        const validTransitions: Record<NCStatus, NCStatus[]> = {
          aberta: ['investig', 'cancelada'],
          investig: ['correcao', 'cancelada'],
          correcao: ['verif_eficacia', 'cancelada'],
          verif_eficacia: ['fechada', 'investig', 'cancelada'],
          fechada: [], // Final state
          cancelada: [], // Final state
        };

        if (!validTransitions[currentNC.status]?.includes(novoStatus)) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            `Cannot transition from '${currentNC.status}' to '${novoStatus}'`
          );
        }
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const updates: any = {
        updatedAt: now,
        versao: (currentNC.versao || 0) + 1,
      };

      // Handle status transition
      if (novoStatus && novoStatus !== currentNC.status) {
        updates.status = novoStatus;

        // Create status history entry
        const statusEntry: StatusHistoryEntry = {
          timestamp: now as any,
          novoStatus,
          mudadoPor: uid,
          motivo: motivoTransicao,
          hmac: '', // Will be filled below
        };

        // Sign the status transition
        const statusHmac = await signAuditEntry(
          `labs/${labId}/nao-conformidades/audit-trail`,
          uid,
          'nc.status_changed',
          {
            ncId,
            numero: currentNC.numero,
            anteriorStatus: currentNC.status,
            novoStatus,
            motivo: motivoTransicao,
          },
          secret
        );

        statusEntry.hmac = statusHmac.hmac;
        updates.statusHistory = [...(currentNC.statusHistory || []), statusEntry];
      }

      // Handle CAPA updates
      if (investigacao) {
        updates['capa.investigacao'] = {
          ...currentNC.capa?.investigacao,
          ...investigacao,
          dataInicio: investigacao.dataInicio || currentNC.capa?.investigacao?.dataInicio || now,
        };
      }

      if (acaoCorretiva) {
        updates['capa.acaoCorretiva'] = {
          ...currentNC.capa?.acaoCorretiva,
          ...acaoCorretiva,
          dataPrevista: acaoCorretiva.dataPrevista || currentNC.capa?.acaoCorretiva?.dataPrevista,
        };
      }

      if (verificacaoEficacia) {
        updates['capa.verificacaoEficacia'] = {
          ...currentNC.capa?.verificacaoEficacia,
          ...verificacaoEficacia,
          dataVerificacao: verificacaoEficacia.dataVerificacao || now,
        };

        // If eficácia was verified as 'eficaz', unblock operations
        if (verificacaoEficacia.resultado === 'eficaz') {
          updates.bloqueiaOperacoes = false;
        }
      }

      // Update NC
      await ncDocRef.update(updates);

      // Re-fetch to get updated document
      const updatedSnapshot = await ncDocRef.get();
      const updatedNC = updatedSnapshot.data() as NaoConformidade;

      // Log to audit trail
      await signAuditEntry(
        `labs/${labId}/nao-conformidades/audit-trail`,
        uid,
        'nc.status_changed',
        {
          ncId,
          numero: updatedNC.numero,
          anteriorStatus: currentNC.status,
          novoStatus: updatedNC.status,
          capaUpdates: {
            investigacao: !!investigacao,
            acaoCorretiva: !!acaoCorretiva,
            verificacaoEficacia: !!verificacaoEficacia,
          },
        },
        secret
      );

      const response: UpdateNaoConformidadeResponse = {
        success: true,
        ncId,
        novoStatus: updatedNC.status,
        hmac: updatedNC.hmac,
        message: `NC ${updatedNC.numero} atualizada com sucesso`,
      };

      return response;
    } catch (error: any) {
      console.error('updateNaoConformidade error:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', error.message || 'Failed to update NC');
    }
  });

/**
 * Helper: Check if there are critical NCs blocking a module
 *
 * Used by: 7-module integration (Insumos, Equipamento, etc)
 * Returns: NCCheckResult with list of blocking NCs
 */
export async function checkNCs(labId: string, moduloOrigemId: string): Promise<NCCheckResult> {
  try {
    const criticalNCs = await db
      .collection(`labs/${labId}/nao-conformidades`)
      .where('moduloOrigemId', '==', moduloOrigemId)
      .where('bloqueiaOperacoes', '==', true)
      .where('status', 'in', ['aberta', 'investig', 'correcao', 'verif_eficacia'])
      .get();

    if (criticalNCs.empty) {
      return { hasCriticalNCs: false, criticalNCs: [] };
    }

    const blockingNCs = criticalNCs.docs.map((doc) => {
      const data = doc.data() as NaoConformidade;
      return {
        ncId: doc.id,
        numero: data.numero,
        severidade: data.severidade,
        descricao: data.descricao,
        bloqueiaOperacoes: data.bloqueiaOperacoes,
      };
    });

    const firstNC = blockingNCs[0];
    const message =
      blockingNCs.length === 1
        ? `Operações bloqueadas por NC ${firstNC.numero}: ${firstNC.descricao}`
        : `Operações bloqueadas por ${blockingNCs.length} NCs críticas. Primeira: ${firstNC.numero}`;

    return {
      hasCriticalNCs: true,
      criticalNCs: blockingNCs,
      message,
    };
  } catch (error: any) {
    console.error('checkNCs error:', error);
    // On error, assume no blocking (fail open)
    return { hasCriticalNCs: false, criticalNCs: [] };
  }
}
