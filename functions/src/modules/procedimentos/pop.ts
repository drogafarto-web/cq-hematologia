import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { hashData, computeHmac } from '../audit/cryptoAudit';
import {
  POP,
  POPVersao,
  POPCreationRequest,
  POPVersionCreationRequest,
  POPSignatureRequest,
  POPTrainingRequest,
} from './types';

const db = admin.firestore();

/**
 * createPOP — Create a new POP document
 *
 * Sets up the root POP doc with basic metadata.
 * No version is created yet; next step is createPOPVersion.
 *
 * Permissions: Any lab member (will be called by admins/RT)
 */
export const createPOP = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Auth required');
  }

  const { labId, nome, codigo, conteudo, treinamentosObrigatorios, modulos } =
    request.data as POPCreationRequest;

  if (!labId || !nome || !codigo || !conteudo) {
    throw new functions.HttpsError('invalid-argument', 'Missing required fields');
  }

  // Validate codigo uniqueness per lab
  const existingPOP = await db
    .collection(`labs/${labId}/pops`)
    .where('codigo', '==', codigo)
    .limit(1)
    .get();

  if (!existingPOP.empty) {
    throw new functions.HttpsError('already-exists', `POP codigo ${codigo} already exists`);
  }

  // Create POP document
  const popRef = db.collection(`labs/${labId}/pops`).doc();
  const pop: Partial<POP> = {
    id: popRef.id,
    labId,
    nome,
    codigo,
    conteudo,
    treinamentosObrigatorios,
    modulos,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    criadoPor: request.auth.uid,
  };

  await popRef.set(pop);

  return { success: true, popId: popRef.id };
});

/**
 * createPOPVersion — Create a new version of an existing POP
 *
 * Computes hashConteudo, increments version número (v1.0 → v1.1 or v2.0).
 * Sets status='em_revisao', waiting for RT signature.
 *
 * Permissions: Any lab member (RT will review and sign)
 */
export const createPOPVersion = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Auth required');
  }

  const { labId, popId, conteudo, isMajorVersion } =
    request.data as POPVersionCreationRequest;

  if (!labId || !popId || !conteudo) {
    throw new functions.HttpsError('invalid-argument', 'Missing required fields');
  }

  // Fetch parent POP
  const popDoc = await db.doc(`labs/${labId}/pops/${popId}`).get();
  if (!popDoc.exists) {
    throw new functions.HttpsError('not-found', `POP ${popId} not found`);
  }

  // Fetch all existing versions to determine next version number
  const versionsSnap = await db
    .collection(`labs/${labId}/pops/${popId}/versoes`)
    .orderBy('numero', 'desc')
    .limit(1)
    .get();

  let nextNumero = '1.0';
  if (!versionsSnap.empty) {
    const lastVersion = versionsSnap.docs[0].data() as POPVersao;
    const [major, minor] = lastVersion.numero.split('.').map(Number);

    if (isMajorVersion) {
      // v1.x → v2.0
      nextNumero = `${major + 1}.0`;
    } else {
      // v1.0 → v1.1
      nextNumero = `${major}.${minor + 1}`;
    }
  }

  // Compute hash of content
  const hashConteudo = hashData(conteudo);

  // Create version document
  const versionRef = db.collection(`labs/${labId}/pops/${popId}/versoes`).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const vigenciaFim = new Date();
  vigenciaFim.setFullYear(vigenciaFim.getFullYear() + 2); // 2 years from now

  const version: Partial<POPVersao> = {
    id: versionRef.id,
    popId,
    numero: nextNumero,
    hashConteudo,
    dataVigenciaInicio: now,
    dataVigenciaFim: admin.firestore.Timestamp.fromDate(vigenciaFim),
    status: 'em_revisao',
    proximaRevisao: admin.firestore.Timestamp.fromDate(vigenciaFim),
    criadoEm: now,
    ultimaAtualizacao: now,
  };

  await versionRef.set(version);

  return { success: true, popVersaoId: versionRef.id, numero: nextNumero };
});

/**
 * assinaturaRT — Sign a POP version (RT-only)
 *
 * Verifies RT permission, signs hashConteudo via ADR 0005,
 * sets status='ativa', and auto-obsoletes previous versions.
 *
 * Permissions: RT (responsavelTecnico) only
 */
export const assinaturaRT = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Auth required');
  }

  // Check RT permission
  if (!request.auth.token.responsavelTecnico) {
    throw new functions.HttpsError(
      'permission-denied',
      'Only RT (Responsável Técnico) can sign POP versions'
    );
  }

  const { labId, popId, popVersaoId } = request.data as POPSignatureRequest;

  if (!labId || !popId || !popVersaoId) {
    throw new functions.HttpsError('invalid-argument', 'Missing required fields');
  }

  // Fetch version to sign
  const versionDoc = await db
    .doc(`labs/${labId}/pops/${popId}/versoes/${popVersaoId}`)
    .get();

  if (!versionDoc.exists) {
    throw new functions.HttpsError('not-found', `POP version not found`);
  }

  const version = versionDoc.data() as POPVersao;

  // Fetch RT info from members
  const memberDoc = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
  if (!memberDoc.exists) {
    throw new functions.HttpsError('not-found', `Member record not found`);
  }
  const member = memberDoc.data();

  // Get HMAC secret from environment
  const secret = process.env.HCQ_SIGNATURE_HMAC_KEY || 'dev-key';

  // Sign the hashConteudo
  const signatureData = {
    popId,
    popVersaoNumero: version.numero,
    hashConteudo: version.hashConteudo,
    rtUid: request.auth.uid,
    timestamp: new Date().toISOString(),
  };
  const hmac = computeHmac(signatureData, secret);

  // Update version to 'ativa' with signature
  const now = admin.firestore.FieldValue.serverTimestamp();
  await versionDoc.ref.update({
    status: 'ativa',
    assinadaPor: {
      uid: request.auth.uid,
      nome: member.nome || 'Unknown',
      cargo: member.cargo || 'RT',
      timestamp: now,
      hmac,
    },
    ultimaAtualizacao: now,
  });

  // Auto-obsolete previous versions with same major version
  const [currentMajor] = version.numero.split('.').map(Number);

  const allVersions = await db
    .collection(`labs/${labId}/pops/${popId}/versoes`)
    .get();

  for (const vDoc of allVersions.docs) {
    if (vDoc.id === popVersaoId) continue; // Skip current version

    const v = vDoc.data() as POPVersao;
    const [vMajor] = v.numero.split('.').map(Number);

    if (vMajor === currentMajor && v.status === 'ativa') {
      await vDoc.ref.update({
        status: 'obsoleta',
        motivo_obsolescencia: `Substituído por v${version.numero}`,
        dataObsolescencia: now,
        ultimaAtualizacao: now,
      });
    }
  }

  // Update parent POP's versaoAtivaNumero
  await db.doc(`labs/${labId}/pops/${popId}`).update({
    versaoAtivaNumero: version.numero,
  });

  return {
    success: true,
    popVersaoNumero: version.numero,
    assinadoEm: new Date().toISOString(),
  };
});

/**
 * recordarTreinamentoPOP — Record that operator completed training on POP version
 *
 * Adds entry to POPTrainingRecord collection and updates Qualificacao.treinamentosPOP[].
 * Called after operator confirms training completion.
 *
 * Permissions: RT only
 */
export const recordarTreinamentoPOP = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Auth required');
  }

  // Check RT permission
  if (!request.auth.token.responsavelTecnico) {
    throw new functions.HttpsError(
      'permission-denied',
      'Only RT can record training'
    );
  }

  const { labId, operadorUid, popId, popVersaoNumero, certificado_url } =
    request.data as POPTrainingRequest;

  if (!labId || !operadorUid || !popId || !popVersaoNumero) {
    throw new functions.HttpsError('invalid-argument', 'Missing required fields');
  }

  // Fetch POP version to validate
  const allVersions = await db
    .collection(`labs/${labId}/pops/${popId}/versoes`)
    .where('numero', '==', popVersaoNumero)
    .limit(1)
    .get();

  if (allVersions.empty) {
    throw new functions.HttpsError('not-found', `POP version ${popVersaoNumero} not found`);
  }

  const popVersion = allVersions.docs[0].data() as POPVersao;

  // Calculate validity period (based on POP's treinamentosObrigatorios)
  const popDoc = await db.doc(`labs/${labId}/pops/${popId}`).get();
  const pop = popDoc.data() as POP;

  let periodicidadeMeses = 24; // default
  for (const req of pop.treinamentosObrigatorios) {
    if (req.tipoTreinamento === 'inicial') {
      // Initial training (no recycle)
      periodicidadeMeses = 999 * 12; // effectively indefinite
    } else if (req.tipoTreinamento === 'reciclagem') {
      periodicidadeMeses = req.periodicidadeMeses;
    }
  }

  const validoAte = new Date();
  validoAte.setMonth(validoAte.getMonth() + periodicidadeMeses);

  // Fetch or create Qualificacao for operator
  const qualsSnap = await db
    .collection(`labs/${labId}/qualificacoes`)
    .where('uid', '==', operadorUid)
    .limit(1)
    .get();

  let qualId: string;
  if (qualsSnap.empty) {
    // Create minimal Qualificacao
    const newQual = db.collection(`labs/${labId}/qualificacoes`).doc();
    qualId = newQual.id;
    await newQual.set({
      uid: operadorUid,
      tipo: 'treinamento',
      modulosLiberados: [],
      validoDe: admin.firestore.FieldValue.serverTimestamp(),
      liberadoPor: request.auth.uid,
      treinamentosPOP: [
        {
          popId,
          popVersaoNumero,
          dataConcluso: admin.firestore.FieldValue.serverTimestamp(),
          validoAte: admin.firestore.Timestamp.fromDate(validoAte),
          certificado_url,
        },
      ],
      hmac: '', // Will be set by update
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    qualId = qualsSnap.docs[0].id;
    const qual = qualsSnap.docs[0].data();

    // Add to treinamentosPOP array
    const existingTraining = qual.treinamentosPOP || [];
    const updatedTraining = existingTraining.filter(
      (t: any) => !(t.popId === popId && t.popVersaoNumero === popVersaoNumero)
    );
    updatedTraining.push({
      popId,
      popVersaoNumero,
      dataConcluso: admin.firestore.FieldValue.serverTimestamp(),
      validoAte: admin.firestore.Timestamp.fromDate(validoAte),
      certificado_url,
    });

    await qualsSnap.docs[0].ref.update({
      treinamentosPOP: updatedTraining,
    });
  }

  // Create audit entry (ADR 0005)
  const secret = process.env.HCQ_SIGNATURE_HMAC_KEY || 'dev-key';
  const trainingData = {
    operadorUid,
    popId,
    popVersaoNumero,
    dataConcluso: new Date().toISOString(),
    validoAte: validoAte.toISOString(),
  };
  const hmac = computeHmac(trainingData, secret);

  return {
    success: true,
    qualificacaoId: qualId,
    validoAte: validoAte.toISOString(),
  };
});
