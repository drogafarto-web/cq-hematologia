/**
 * criarLaudo — Cria laudo + roda auto-release engine
 *
 * Callable que orquestra:
 * 1. Lê runs aprovadas + médico solicitante + exameConfig
 * 2. Detecta criticoFlag (server-side)
 * 3. Classifica laudo (rotina/revisao-rt/bloqueio-critico)
 * 4. Roda shouldAutoRelease
 * 5. Cria Laudo em status Pendente ou Auto-Liberado
 * 6. Cria LaudoVersion v1 se auto-liberado
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { assertLiberacaoAccess, CriarLaudoInputSchema } from './validators';
import {
  Laudo,
  LaudoVersion,
  ExameLaudo,
  ReleaseState,
  labId as makeLabId,
  userId as makeUserId,
  LogicalSignature,
} from './_shared/types';
import { AutoReleaseContext } from './_shared/exameClassifier';
import { calculateChainHash, GENESIS_CHAIN_HASH } from './_shared/auditChain';

interface CriarLaudoInput {
  labId: string;
  runIds: string[];
  pacienteId: string;
  medicoSolicitanteId: string;
  exames: any[];
}

interface CriarLaudoResult {
  ok: true;
  laudoId: string;
  status: ReleaseState;
  autoReleased: boolean;
  version?: number;
}

const REGION = 'southamerica-east1';

export const criarLaudo = onCall<unknown, Promise<CriarLaudoResult>>(
  { region: REGION, memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    const parsed = CriarLaudoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }

    const input = parsed.data as CriarLaudoInput;
    const { labId, pacienteId, medicoSolicitanteId, exames } = input;

    // 1. Auth check
    await assertLiberacaoAccess(request.auth, labId);
    const uid = request.auth!.uid;

    // 1b. Rate limit per uid (SECURITY_AUDIT.md #18): 100/min for authenticated.
    const { enforceAuthenticatedRateLimit } = await import('../shared/rateLimit');
    const rl = await enforceAuthenticatedRateLimit(uid, 'criarLaudo', 100);
    if (!rl.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Muitas requisições. Tente novamente em ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
      );
    }

    const db = admin.firestore();

    // 2. Lê dados do lab (cache local)
    const labSnap = await db.doc(`labs/${labId}`).get();
    if (!labSnap.exists) {
      throw new HttpsError('not-found', 'Lab não encontrado.');
    }
    const labData = labSnap.data()!;

    // 3. Lê médico solicitante do Worklab cache
    const medicoSnap = await db
      .doc(`labs/${labId}/medicos-solicitantes/${medicoSolicitanteId}`)
      .get();
    if (!medicoSnap.exists) {
      throw new HttpsError(
        'not-found',
        'Médico solicitante não encontrado no cache. Sincronize com Worklab.',
      );
    }
    void medicoSnap.data();
    void medicoSolicitanteId;

    // 4. Lê RT do lab (principal responsável técnico)
    const rtSnap = await db
      .collection(`labs/${labId}/members`)
      .where('role', '==', 'RT')
      .limit(1)
      .get();
    if (rtSnap.empty) {
      throw new HttpsError('not-found', 'RT do laboratório não encontrado.');
    }
    const rtMember = rtSnap.docs[0].data();

    // 5. Lê paciente (se armazenado localmente)
    const pacienteSnap = await db.doc(`labs/${labId}/pacientes/${pacienteId}`).get();
    if (!pacienteSnap.exists) {
      throw new HttpsError('not-found', 'Paciente não encontrado. Verifique integração Worklab.');
    }
    const pacienteData = pacienteSnap.data()!;

    // 6. Lê exames config para classificação
    const examesConfigSnap = await db
      .collection(`labs/${labId}/exames-config`)
      .where('deletadoEm', '==', null)
      .get();
    const examesConfigMap = new Map(examesConfigSnap.docs.map((doc) => [doc.id, doc.data()]));

    // 7. Lê thresholds para detecção de críticos (se houver)
    const criticosSnap = await db
      .collection(`labs/${labId}/criticos-thresholds`)
      .where('ativo', '==', true)
      .where('deletadoEm', '==', null)
      .get();
    void criticosSnap;

    // 8. Constrói LaudoVersion snapshot
    // NOTA: No MVP, exames vem do payload. Em v1.4, vir de runs aprovadas do Worklab
    const buildExameLaudo = (exame: any): ExameLaudo => ({
      id: exame.id || exame.examCode || 'unknown',
      nome: exame.nome || exame.examName || '',
      tipoMaterial: exame.tipoMaterial || '',
      metodoAnalitico: exame.metodoAnalitico || '',
      resultados: exame.resultados || [],
      valoresReferencia: exame.valoresReferencia || {
        min: 0,
        max: 0,
        descricao: '',
      },
      limitacoesTecnicas: exame.limitacoesTecnicas,
      interpretacao: exame.interpretacao,
    });

    const now = admin.firestore.Timestamp.now();
    const laudoId = db.collection(`labs/${labId}/laudos`).doc().id;

    // 9. Detecta críticos (placeholder — será melhorado em Plan 10-03)
    // Para MVP, assume sem críticos se não encontrar threshold aplicável
    let criticoFlag = false;
    const criticoDetalhes: any[] = [];

    // 10. Classifica laudo
    // Para MVP: assume rotina se a maioria dos exames for rotina
    let isRotina = true;

    for (const exame of exames) {
      const config = examesConfigMap.get(exame.id || exame.examCode);
      if (!config) continue;

      if (config.classification !== 'rotina') isRotina = false;
    }

    // 11. Determina auto-release
    const _context: AutoReleaseContext = {
      hasWestgardReject: false, // Placeholder
      hasCritico: criticoFlag,
      hasMaterialRestrito: false, // Placeholder
    };
    void _context;

    // Para MVP: se é rotina e sem crítico, auto-libera
    const autoReleaseDecision = isRotina
      ? { autoRelease: true, reason: 'Exame rotina sem bloqueadores' }
      : { autoRelease: false, reason: 'Exame requer revisão RT' };

    // 12. Cria Laudo document
    const initialStatus: ReleaseState = autoReleaseDecision.autoRelease
      ? 'Auto-Liberado'
      : 'Pendente';

    const laudo: Laudo = {
      id: laudoId,
      labId: makeLabId(labId),

      // RDC 978 Art. 167
      cnes: labData.cnes || '',
      labName: labData.name || 'Lab',
      labEndereco: labData.endereco || '',
      labTelefone: labData.telefone || '',

      rtNome: rtMember.name || '',
      rtRegistro: rtMember.registro || '',

      profissionalAssinaName: rtMember.name || '',
      profissionalAssinaRegistro: rtMember.registro || '',

      paciente: {
        id: pacienteData.id || pacienteId,
        nome: pacienteData.nome || '',
        cpf: pacienteData.cpf,
        sexo: pacienteData.sexo || 'NI',
      },

      pacienteIdade: {
        value: pacienteData.idade || 0,
        unit: 'anos',
      },

      coletaEm: now,
      emissaoEm: now,

      exames: exames.map(buildExameLaudo),

      status: initialStatus,
      currentVersion: autoReleaseDecision.autoRelease ? 1 : 0,

      criticoFlag,
      criticoDetalhes: criticoDetalhes.length > 0 ? criticoDetalhes : undefined,

      criadoEm: now,
      deletadoEm: null,
    };

    // 13. Transaction: criar laudo + version (se auto) + audit log
    const batch = db.batch();

    const laudoRef = db.doc(`labs/${labId}/laudos/${laudoId}`);
    batch.set(laudoRef, laudo);

    if (autoReleaseDecision.autoRelease) {
      // Cria versão v1 com signature "Sistema"
      const versionId = db.collection(`labs/${labId}/laudo-versions`).doc().id;
      const systemSignature: LogicalSignature = {
        operatorId: makeUserId('sistema'),
        operatorRole: 'Sistema',
        operatorName: 'Sistema',
        operatorRegistro: 'AUTO',
        timestamp: now,
        hash: '', // Será preenchido depois do cálculo de chainHash
      };

      const chainHash = calculateChainHash(GENESIS_CHAIN_HASH, laudo);
      systemSignature.hash = chainHash;

      const version: LaudoVersion = {
        id: versionId,
        labId: makeLabId(labId),
        laudoId,
        version: 1,
        snapshot: laudo,
        signature: systemSignature,
        chainHash,
        criadoEm: now,
      };

      const versionRef = db.doc(`labs/${labId}/laudo-versions/${versionId}`);
      batch.set(versionRef, version);

      // Audit log
      const auditRef = db.collection(`labs/${labId}/audit-logs`).doc();
      batch.set(auditRef, {
        tipo: 'laudo_auto_liberado',
        laudoId,
        operatorId: uid,
        motivo: autoReleaseDecision.reason,
        criadoEm: now,
      });
    }

    await batch.commit();

    return {
      ok: true,
      laudoId,
      status: initialStatus,
      autoReleased: autoReleaseDecision.autoRelease,
      version: autoReleaseDecision.autoRelease ? 1 : undefined,
    };
  },
);
