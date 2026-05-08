/**
 * labApoio_createContrato — callable for creating a support lab contract.
 *
 * Responsabilidades:
 *   1. Valida claim + membership (assertLabApoioAccess)
 *   2. Valida payload com Zod schema
 *   3. Valida RN-LABAPOIO-01: (labId, cnpj) único entre não-deletados
 *   4. Valida RN-LABAPOIO-02: vigenciaInicio < vigenciaFim
 *   5. Gera `LogicalSignature` server-side com `uid` e `Timestamp.now()`
 *   6. writeBatch atômico: contrato + audit event com chainHash
 *   7. Retorna contratoId
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  generateContratoSignatureServer,
  sha256Hex,
  type LogicalSignature,
} from './signatureCanonical';
import {
  assertLabApoioAccess,
  labApoioCollection,
  ensureLabApoioLabRoot,
  CreateContratoInputSchema,
  validateCNPJ,
  vigenciaOverlaps,
} from './validators';

interface CreateContratoResult {
  ok: true;
  contratoId: string;
}

export const labApoio_createContrato = onCall<unknown, Promise<CreateContratoResult>>(
  {},
  async (request) => {
    const parsed = CreateContratoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertLabApoioAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    await ensureLabApoioLabRoot(db, input.labId);

    // 1. Validate CNPJ checksum (RN-LABAPOIO-02)
    if (!validateCNPJ(input.cnpj)) {
      throw new HttpsError('invalid-argument', 'CNPJ inválido (checksum Mod-11).');
    }

    // 2. Validate vigencia (RN-LABAPOIO-03)
    const inicioDate = new Date(input.vigenciaInicio);
    const fimDate = new Date(input.vigenciaFim);
    if (inicioDate >= fimDate) {
      throw new HttpsError(
        'invalid-argument',
        'vigenciaFim deve ser posterior a vigenciaInicio.',
      );
    }

    // 3. Check uniqueness (labId, cnpj) e sobreposição de vigência —
    //    RN-LABAPOIO-01 + RN-LABAPOIO-08 (RDC 978 Art. 36 — contrato vigente único).
    const labApoioCol = labApoioCollection(db, input.labId);
    const existingQuery = await labApoioCol
      .where('cnpj', '==', input.cnpj)
      .where('deletadoEm', '==', null)
      .get();

    const overlapping = existingQuery.docs.find((d) => {
      const data = d.data();
      return vigenciaOverlaps(
        { inicio: input.vigenciaInicio, fim: input.vigenciaFim },
        { inicio: data.vigenciaInicio as string, fim: data.vigenciaFim as string },
      );
    });

    if (overlapping) {
      throw new HttpsError(
        'already-exists',
        `Já existe contrato ativo com este CNPJ cuja vigência sobrepõe (${overlapping.data().vigenciaInicio} → ${overlapping.data().vigenciaFim}). RDC 978 Art. 36 exige contrato vigente único.`,
      );
    }

    // 4. Generate signature server-side
    const nowTs = admin.firestore.Timestamp.now();
    const signature: LogicalSignature = generateContratoSignatureServer(
      uid,
      input.labId,
      input.cnpj,
      input.vigenciaInicio,
      input.vigenciaFim,
      nowTs,
    );

    // 5. Atomic batch: contrato + first audit event
    const contratoRef = labApoioCol.doc();
    const contratoId = contratoRef.id;

    // Build contrato document
    const contratoDoc = {
      labId: input.labId,
      nome: input.nome,
      razaoSocial: input.razaoSocial,
      cnpj: input.cnpj,
      habilitacaoAnvisa: input.habilitacaoAnvisa,
      vigenciaInicio: input.vigenciaInicio,
      vigenciaFim: input.vigenciaFim,
      criticidade: input.criticidade,
      exames: input.exames,
      endereco: input.endereco,
      certificacoes: input.certificacoes ?? [],
      contatos: input.contatos ?? [],
      observacoes: input.observacoes ?? null,
      anexoContratoUrl: undefined,
      anexoContratoSize: undefined,
      avaliacaoPeriodica: [],
      proximaAvaliacaoEm: null,
      ativo: input.ativo ?? true,
      logicalSignature: signature,
      criadoEm: nowTs,
      deletadoEm: null,
    };

    // First audit event (no previous chainHash)
    const auditEventRef = contratoRef.collection('events').doc();
    const firstEventPayload = {
      cnpj: input.cnpj,
      criticidade: input.criticidade,
      habilitacaoAnvisa: input.habilitacaoAnvisa,
      labId: input.labId,
      nome: input.nome,
      vigenciaFim: input.vigenciaFim,
      vigenciaInicio: input.vigenciaInicio,
    };
    const firstEventHash = sha256Hex(JSON.stringify(firstEventPayload));

    const auditEvent = {
      tipo: 'created',
      operadorId: uid,
      timestamp: nowTs,
      mudancas: undefined,
      chainHash: firstEventHash,
      chainHashAnterior: null,
    };

    const batch = db.batch();
    batch.set(contratoRef, contratoDoc);
    batch.set(auditEventRef, auditEvent);
    await batch.commit();

    return {
      ok: true,
      contratoId,
    };
  },
);
