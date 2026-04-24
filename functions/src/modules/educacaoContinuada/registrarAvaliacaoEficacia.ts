/**
 * Avaliação de Eficácia (FR-001 inferior + FR-013 — RDC 978 Art. 126).
 *
 * 2 callables nesta unidade:
 *   - ec_registrarAvaliacaoEficacia — cria. RN-02 (ineficaz + fechar exige
 *     acaoCorretiva). Suporta criar já-fechada num único ato.
 *   - ec_fecharAvaliacaoEficacia — fecha avaliação aberta. Re-aplica RN-02
 *     antes de gravar (transição de estado é momento crítico).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertEcAccess,
  ecCollection,
  ensureEcLabRoot,
  FecharEficaciaInputSchema,
  RegistrarEficaciaInputSchema,
} from './validators';
import { generateEcSignatureServer } from './signatureCanonical';

// ─── ec_registrarAvaliacaoEficacia ──────────────────────────────────────────

interface RegistrarEficaciaResult {
  ok: true;
  avaliacaoId: string;
}

export const ec_registrarAvaliacaoEficacia = onCall<
  unknown,
  Promise<RegistrarEficaciaResult>
>({}, async (request) => {
  const parsed = RegistrarEficaciaInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }
  const input = parsed.data;

  await assertEcAccess(request.auth, input.labId);
  const uid = request.auth!.uid;
  const db = admin.firestore();

  // RN-02
  if (
    input.resultado === 'ineficaz' &&
    input.fechar &&
    (!input.acaoCorretiva || input.acaoCorretiva.length === 0)
  ) {
    throw new HttpsError(
      'failed-precondition',
      'RN-02: avaliação ineficaz não pode ser fechada sem ação corretiva preenchida.',
    );
  }

  // Verifica execução existe + realizada (eficácia só faz sentido após realização)
  const execRef = ecCollection(db, input.labId, 'execucoes').doc(input.execucaoId);
  const execSnap = await execRef.get();
  if (!execSnap.exists || execSnap.data()?.['deletadoEm'] !== null) {
    throw new HttpsError('not-found', 'Execução não encontrada ou arquivada.');
  }
  if (execSnap.data()?.['status'] !== 'realizado') {
    throw new HttpsError(
      'failed-precondition',
      'Avaliação de eficácia só pode ser registrada para execução realizada.',
    );
  }

  await ensureEcLabRoot(db, input.labId);

  const dataAvaliacaoTs = admin.firestore.Timestamp.fromMillis(input.dataAvaliacao);
  const dataFechamentoTs = input.fechar ? admin.firestore.Timestamp.now() : null;

  const assinatura = generateEcSignatureServer(uid, {
    execucaoId: input.execucaoId,
    resultado: input.resultado,
    dataAvaliacao: input.dataAvaliacao,
    fechamento: input.fechar ? 1 : 0,
  });

  const doc: Record<string, unknown> = {
    labId: input.labId,
    execucaoId: input.execucaoId,
    resultado: input.resultado,
    evidencia: input.evidencia,
    dataAvaliacao: dataAvaliacaoTs,
    dataFechamento: dataFechamentoTs,
    assinatura,
    deletadoEm: null,
  };
  if (input.acaoCorretiva) {
    doc['acaoCorretiva'] = input.acaoCorretiva;
  }

  const ref = ecCollection(db, input.labId, 'avaliacoesEficacia').doc();
  await ref.set(doc);

  db.collection('auditLogs')
    .add({
      action: 'EC_REGISTRAR_EFICACIA',
      callerUid: uid,
      labId: input.labId,
      payload: {
        avaliacaoId: ref.id,
        execucaoId: input.execucaoId,
        resultado: input.resultado,
        fechado: input.fechar,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { ok: true, avaliacaoId: ref.id };
});

// ─── ec_fecharAvaliacaoEficacia ─────────────────────────────────────────────

interface FecharEficaciaResult {
  ok: true;
}

export const ec_fecharAvaliacaoEficacia = onCall<
  unknown,
  Promise<FecharEficaciaResult>
>({}, async (request) => {
  const parsed = FecharEficaciaInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }
  const input = parsed.data;

  await assertEcAccess(request.auth, input.labId);
  const uid = request.auth!.uid;
  const db = admin.firestore();

  const ref = ecCollection(db, input.labId, 'avaliacoesEficacia').doc(input.avaliacaoId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.['deletadoEm'] !== null) {
    throw new HttpsError('not-found', 'Avaliação não encontrada ou arquivada.');
  }
  const atual = snap.data()!;
  if (atual['dataFechamento'] !== null) {
    throw new HttpsError('failed-precondition', 'Avaliação já está fechada.');
  }

  // RN-02 re-aplicada — usa acao do input ou a já existente no doc
  const acao =
    (input.acaoCorretiva ?? (atual['acaoCorretiva'] as string | undefined) ?? '').trim();
  if (atual['resultado'] === 'ineficaz' && acao.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      'RN-02: avaliação ineficaz não pode ser fechada sem ação corretiva preenchida.',
    );
  }

  const assinatura = generateEcSignatureServer(uid, {
    execucaoId: atual['execucaoId'] as string,
    resultado: atual['resultado'] as string,
    dataAvaliacao: (atual['dataAvaliacao'] as admin.firestore.Timestamp).toMillis(),
    fechamento: 1,
  });

  const patch: Record<string, unknown> = {
    dataFechamento: admin.firestore.Timestamp.now(),
    assinatura,
  };
  if (acao.length > 0) {
    patch['acaoCorretiva'] = acao;
  }

  await ref.update(patch);

  db.collection('auditLogs')
    .add({
      action: 'EC_FECHAR_EFICACIA',
      callerUid: uid,
      labId: input.labId,
      payload: { avaliacaoId: input.avaliacaoId },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { ok: true };
});
