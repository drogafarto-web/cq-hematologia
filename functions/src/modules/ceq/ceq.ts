/**
 * CEQ Cloud Functions — External Proficiency Program Management
 *
 * Callables:
 * - createCEQParticipacao() — Enroll lab in PT program
 * - receiveCEQAmostra() — Record sample receipt
 * - lacarCEQResultado() — Record result + calculate Z-score + auto-create NC
 *
 * Triggers:
 * - onCEQResultadoCreated() — Auto-NC creation when |Z| > 3
 */

import {
  onCall,
  HttpsError,
} from 'firebase-functions/v2/https';
import {
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import {
  initializeApp,
  getApps,
  cert,
} from 'firebase-admin/app';
import {
  getFirestore,
  Timestamp,
  FieldValue,
  serverTimestamp,
} from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type {
  CreateCEQParticipacaoRequest,
  RecebeCEQAmostraRequest,
  LancarCEQResultadoRequest,
  LancarCEQResultadoResponse,
} from './types';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!),
  });
}

const db = getFirestore();
const auth = getAuth();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Z-score calculation server-side (validation)
 */
function calcularZScore(
  valorObtido: number,
  valorReferencia: number,
  desvioEstimado: number,
): { zScore: number; interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria' } {
  if (desvioEstimado === 0) {
    return { zScore: NaN, interpretacao: 'questionavel' };
  }

  const zScore = (valorObtido - valorReferencia) / desvioEstimado;
  let interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria';

  if (Math.abs(zScore) < 2) {
    interpretacao = 'satisfatoria';
  } else if (Math.abs(zScore) < 3) {
    interpretacao = 'questionavel';
  } else {
    interpretacao = 'insatisfatoria';
  }

  return { zScore, interpretacao };
}

/**
 * Auto-create critical NC when |Z| >= 3
 * Integrates with ADR 0003 (Nao-Conformidade)
 */
async function criarNCAutomatica(
  labId: string,
  resultado: any,
  zScore: number,
  uid: string,
): Promise<{ ncId: string; ncNumero: string } | null> {
  if (Math.abs(zScore) < 3) {
    return null; // Not blocking
  }

  try {
    // Get next NC sequence number
    const sequenceRef = db.collection('labs').doc(labId).collection('nc-sequencia').doc('_counter');
    const sequenceSnap = await sequenceRef.get();
    const nextSeq = (sequenceSnap.data()?.count || 0) + 1;

    await sequenceRef.set({ count: nextSeq }, { merge: true });

    const ano = new Date().getFullYear();
    const ncNumero = `NC-${ano}-${String(nextSeq).padStart(4, '0')}`;

    // Create NC document
    const ncRef = db.collection('labs').doc(labId).collection('nao-conformidades').doc();

    const ncDoc = {
      numero: ncNumero,
      labId,
      origem: 'controle',
      origemId: resultado.ceqAmostraId,
      moduloOrigemId: 'ceq',
      descricao: `CEQ insatisfatória: ${resultado.analyteName} | Z-Score: ${zScore.toFixed(2)} | Amostra ${resultado.ceqAmostraId}`,
      severidade: 'grave',
      status: 'aberta',
      statusHistory: [
        {
          timestamp: serverTimestamp(),
          novoStatus: 'aberta',
          mudadoPor: uid,
          motivo: 'Auto-criada por resultado CEQ insatisfatório (|Z| ≥ 3)',
        },
      ],
      bloqueiaOperacoes: true,
      aberta: {
        timestamp: serverTimestamp(),
        uid,
        motivo: 'Resultado CEQ fora dos limites de aceitabilidade',
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await ncRef.set(ncDoc);

    return { ncId: ncRef.id, ncNumero };
  } catch (error) {
    console.error('Erro ao criar NC automática:', error);
    // Don't throw — NC creation failure shouldn't block resultado recording
    return null;
  }
}

// ─── Callables ───────────────────────────────────────────────────────────────

/**
 * createCEQParticipacao — Enroll lab in proficiency program
 */
export const createCEQParticipacao = onCall(async (request) => {
  const { labId, input } = request.data as CreateCEQParticipacaoRequest;

  // Auth check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User not authenticated');
  }

  // Lab membership check
  const labDoc = await db.collection('labs').doc(labId).get();
  if (!labDoc.exists()) {
    throw new HttpsError('not-found', 'Lab not found');
  }

  try {
    const ref = db.collection('labs').doc(labId).collection('ceq-participacoes').doc();

    const participacao = {
      ...input,
      labId,
      criadoEm: serverTimestamp(),
      criadoPor: request.auth.uid,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: request.auth.uid,
      dataInicio: Timestamp.fromDate(new Date(input.dataInicio)),
      dataFim: input.dataFim ? Timestamp.fromDate(new Date(input.dataFim)) : null,
      deletadoEm: null,
    };

    await ref.set(participacao);

    return {
      success: true,
      participacaoId: ref.id,
      message: `Participação em ${input.provedorNome} criada`,
    };
  } catch (error) {
    console.error('Erro ao criar participação CEQ:', error);
    throw new HttpsError('internal', 'Erro ao criar participação');
  }
});

/**
 * receiveCEQAmostra — Record sample receipt from PT provider
 */
export const receiveCEQAmostra = onCall(async (request) => {
  const req = request.data as RecebeCEQAmostraRequest;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User not authenticated');
  }

  try {
    const ref = db.collection('labs').doc(req.labId).collection('ceq-amostras').doc();

    const amostra = {
      labId: req.labId,
      ceqParticipacaoId: req.ceqParticipacaoId,
      rodada: req.rodada,
      ano: req.ano,
      dataRecepcao: Timestamp.fromDate(new Date(req.dataRecepcao)),
      provedorRodadaId: req.provedorRodadaId || null,
      status: 'recebida',
      criadoEm: serverTimestamp(),
      criadoPor: request.auth.uid,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: request.auth.uid,
      deletadoEm: null,
    };

    await ref.set(amostra);

    return {
      success: true,
      amostraId: ref.id,
      message: `Amostra rodada ${req.rodada}/${req.ano} recebida`,
    };
  } catch (error) {
    console.error('Erro ao receber amostra CEQ:', error);
    throw new HttpsError('internal', 'Erro ao receber amostra');
  }
});

/**
 * lacarCEQResultado — Record result + calculate Z-score + auto-create NC
 * Called from client after calcularZScore client-side (server validates)
 */
export const lacarCEQResultado = onCall(async (request) => {
  const req = request.data as LancarCEQResultadoRequest;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User not authenticated');
  }

  try {
    // Server-side Z-score calculation (validation)
    const { zScore, interpretacao } = calcularZScore(
      req.valorObtido,
      req.valorReferencia,
      req.desvioEstimado,
    );

    const temNCGrave = Math.abs(zScore) >= 3;

    // Create resultado document
    const resultadoRef = db.collection('labs').doc(req.labId).collection('ceq-resultados').doc();

    const resultado = {
      labId: req.labId,
      ceqAmostraId: req.ceqAmostraId,
      ceqParticipacaoId: req.ceqParticipacaoId,
      analyteId: req.analyteId,
      analyteName: req.analyteName,
      valorObtido: req.valorObtido,
      unidade: req.unidade,
      valorReferencia: req.valorReferencia,
      desvioEstimado: req.desvioEstimado,
      zScore,
      interpretacao,
      temNCGrave,
      status: 'lancado',
      criadoEm: serverTimestamp(),
      criadoPor: request.auth.uid,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: request.auth.uid,
      deletadoEm: null,
    };

    await resultadoRef.set(resultado);

    // Auto-create NC if |Z| >= 3
    let ncAutomaticaCriadaId: string | undefined;
    let ncNumero: string | undefined;

    if (temNCGrave) {
      const ncResult = await criarNCAutomatica(
        req.labId,
        { ...resultado, ceqAmostraId: req.ceqAmostraId },
        zScore,
        request.auth.uid,
      );

      if (ncResult) {
        ncAutomaticaCriadaId = ncResult.ncId;
        ncNumero = ncResult.ncNumero;

        // Update resultado with NC reference
        await resultadoRef.update({
          ncAutomaticaCriadaId,
          ncAutomaticaCriadaEm: serverTimestamp(),
        });
      }
    }

    // Update amostra status
    const amostraRef = db.collection('labs').doc(req.labId).collection('ceq-amostras').doc(req.ceqAmostraId);
    await amostraRef.update({
      status: 'resultado_lancado',
      dataResultado: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      atualizadoPor: request.auth.uid,
    });

    const response: LancarCEQResultadoResponse = {
      success: true,
      resultadoId: resultadoRef.id,
      zScore,
      interpretacao,
    };

    if (ncAutomaticaCriadaId) {
      response.ncAutomaticaCriadaId = ncAutomaticaCriadaId;
      response.ncNumero = ncNumero;
    }

    return response;
  } catch (error) {
    console.error('Erro ao lançar resultado CEQ:', error);
    throw new HttpsError('internal', 'Erro ao lançar resultado');
  }
});

// ─── Triggers ────────────────────────────────────────────────────────────────

/**
 * Trigger: Update amostra status when all resultados are validados
 */
export const onCEQResultadoValidado = onDocumentUpdated(
  'labs/{labId}/ceq-resultados/{docId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Check if transitioned to 'validado'
    if (before.status !== 'validado' && after.status === 'validado') {
      const { labId } = event.params as { labId: string };
      const ceqAmostraId = after.ceqAmostraId;

      // Query all resultados for this amostra
      const resultadosSnap = await db
        .collection('labs')
        .doc(labId)
        .collection('ceq-resultados')
        .where('ceqAmostraId', '==', ceqAmostraId)
        .where('deletadoEm', '==', null)
        .get();

      const allValidados = resultadosSnap.docs.every((doc) => doc.data().status === 'validado');

      if (allValidados) {
        await db
          .collection('labs')
          .doc(labId)
          .collection('ceq-amostras')
          .doc(ceqAmostraId)
          .update({
            status: 'processada',
            atualizadoEm: serverTimestamp(),
          });
      }
    }
  },
);
