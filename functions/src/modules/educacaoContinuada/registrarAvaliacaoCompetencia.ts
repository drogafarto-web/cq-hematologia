/**
 * ec_registrarAvaliacaoCompetencia — ISO 15189:2022 cl. 6.2.4.
 *
 * Server-side:
 *   - injeta avaliadorId = auth.uid (cliente não envia)
 *   - valida que o colaborador foi PRESENTE na execução (FK + ISO 15189:
 *     só avalia quem recebeu o treinamento)
 *   - exige proximaAvaliacaoEm quando resultado === 'reprovado'
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertEcAccess,
  ecCollection,
  ensureEcLabRoot,
  RegistrarCompetenciaInputSchema,
} from './validators';
import { generateEcSignatureServer } from './signatureCanonical';

interface RegistrarCompetenciaResult {
  ok: true;
  avaliacaoId: string;
}

export const ec_registrarAvaliacaoCompetencia = onCall<
  unknown,
  Promise<RegistrarCompetenciaResult>
>({}, async (request) => {
  const parsed = RegistrarCompetenciaInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }
  const input = parsed.data;

  await assertEcAccess(request.auth, input.labId);
  const uid = request.auth!.uid;
  const db = admin.firestore();

  // ISO 15189: reprovado exige plano de retreinamento
  if (input.resultado === 'reprovado' && input.proximaAvaliacaoEm === undefined) {
    throw new HttpsError(
      'failed-precondition',
      'Resultado "reprovado" exige data de próxima avaliação (plano de retreinamento).',
    );
  }

  // Execução: existe + realizada
  const execRef = ecCollection(db, input.labId, 'execucoes').doc(input.execucaoId);
  const execSnap = await execRef.get();
  if (!execSnap.exists || execSnap.data()?.['deletadoEm'] !== null) {
    throw new HttpsError('not-found', 'Execução não encontrada ou arquivada.');
  }
  if (execSnap.data()?.['status'] !== 'realizado') {
    throw new HttpsError(
      'failed-precondition',
      'Avaliação de competência só pode ser registrada para execução realizada.',
    );
  }

  // ISO 15189 cl. 6.2.4: só avalia quem foi presente
  const participantesQuery = await ecCollection(db, input.labId, 'participantes')
    .where('execucaoId', '==', input.execucaoId)
    .where('colaboradorId', '==', input.colaboradorId)
    .where('presente', '==', true)
    .limit(1)
    .get();
  if (participantesQuery.empty) {
    throw new HttpsError(
      'failed-precondition',
      'Colaborador não consta como presente nessa execução — ISO 15189 só avalia quem recebeu o treinamento.',
    );
  }

  await ensureEcLabRoot(db, input.labId);

  const dataAvaliacaoTs = admin.firestore.Timestamp.fromMillis(input.dataAvaliacao);
  const proximaAvaliacaoTs = input.proximaAvaliacaoEm
    ? admin.firestore.Timestamp.fromMillis(input.proximaAvaliacaoEm)
    : undefined;

  const assinatura = generateEcSignatureServer(uid, {
    execucaoId: input.execucaoId,
    colaboradorId: input.colaboradorId,
    metodo: input.metodo,
    resultado: input.resultado,
    dataAvaliacao: input.dataAvaliacao,
  });

  const doc: Record<string, unknown> = {
    labId: input.labId,
    execucaoId: input.execucaoId,
    colaboradorId: input.colaboradorId,
    metodo: input.metodo,
    resultado: input.resultado,
    avaliadorId: uid, // server-injected
    dataAvaliacao: dataAvaliacaoTs,
    evidencia: input.evidencia,
    assinatura,
    deletadoEm: null,
  };
  if (proximaAvaliacaoTs) {
    doc['proximaAvaliacaoEm'] = proximaAvaliacaoTs;
  }

  const ref = ecCollection(db, input.labId, 'avaliacoesCompetencia').doc();
  await ref.set(doc);

  db.collection('auditLogs')
    .add({
      action: 'EC_REGISTRAR_COMPETENCIA',
      callerUid: uid,
      labId: input.labId,
      payload: {
        avaliacaoId: ref.id,
        execucaoId: input.execucaoId,
        colaboradorId: input.colaboradorId,
        resultado: input.resultado,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { ok: true, avaliacaoId: ref.id };
});
