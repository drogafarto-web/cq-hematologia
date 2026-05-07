/**
 * turnos_createTurno — callable for creating a supervisor shift registration.
 *
 * Responsabilidades:
 *   1. Valida claim + membership (assertTurnosAccess)
 *   2. Re-lê supervisor server-side (fonte da verdade de nome + CRBM + habilitações ativas)
 *   3. Valida RN-TURNO-02: supervisor ativo
 *   4. Snapshot certificatesActive[] (RN-TURNO-03 — immutable after creation)
 *   5. Gera `LogicalSignature` server-side com `uid` e `Timestamp.now()`
 *   6. writeBatch atômico: turno + audit event com chainHash
 *   7. Retorna turnoId
 *
 * RN-TURNO-01: garante unicidade (labId, data, periodo) via índice Firestore
 * (application-enforced pré-write check; rules bloqueiam duplicatas no schema)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  generateTurnosSignatureServer,
  sha256Hex,
  type LogicalSignature,
} from './signatureCanonical';
import {
  assertTurnosAccess,
  turnosCollection,
  ensureTurnosLabRoot,
  CreateTurnoInputSchema,
} from './validators';

interface CreateTurnoResult {
  ok: true;
  turnoId: string;
}

export const turnos_createTurno = onCall<unknown, Promise<CreateTurnoResult>>(
  {},
  async (request) => {
    const parsed = CreateTurnoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertTurnosAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    await ensureTurnosLabRoot(db, input.labId);

    // 1. Server-read supervisor to get name, CRBM, and certificatesActive
    const colaboradorRef = db.doc(
      `educacaoContinuada/${input.labId}/colaboradores/${input.supervisorId}`,
    );
    const colaboradorSnap = await colaboradorRef.get();
    if (!colaboradorSnap.exists || colaboradorSnap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Supervisor não encontrado ou arquivado.');
    }

    const colaboradorData = colaboradorSnap.data()!;
    const supervisorName = colaboradorData['nome'] as string;
    const supervisorCRBM = colaboradorData['crbm'] as string | undefined;

    // RN-TURNO-02: supervisor ativo
    if (colaboradorData['ativo'] !== true) {
      throw new HttpsError(
        'failed-precondition',
        'Supervisor não está ativo (RN-TURNO-02).',
      );
    }

    // RN-TURNO-03: snapshot certificatesActive (habilitações ativas)
    // Assumed field: habilitacoes = [{ id, descricao, ativo, vencimento }]
    const habilitacoes = (colaboradorData['habilitacoes'] ?? []) as Array<{
      id: string;
      descricao: string;
      ativo?: boolean;
      vencimento?: any;
    }>;
    const certificatesActive = habilitacoes
      .filter((h) => h.ativo !== false)
      .map((h) => ({
        id: h.id,
        descricao: h.descricao,
        ativo: true,
        vencimento: h.vencimento ?? null,
      }));

    // 2. Generate signature server-side
    const nowTs = admin.firestore.Timestamp.now();
    const signature: LogicalSignature = generateTurnosSignatureServer(uid, {
      data: input.data,
      periodo: input.periodo,
      supervisorId: input.supervisorId,
      supervisorName,
      supervisorCRBM: supervisorCRBM || '',
    });

    // 3. Atomic batch: turno + first audit event
    const turnosCol = turnosCollection(db, input.labId);
    const turnoRef = turnosCol.doc();
    const turnoId = turnoRef.id;

    // Build turno document
    const turnoDoc = {
      labId: input.labId,
      data: input.data,
      periodo: input.periodo,
      supervisorId: input.supervisorId,
      supervisorName,
      supervisorCRBM: supervisorCRBM || '',
      certificatesActive,
      observacoes: input.observacoes ?? null,
      inferred: false,
      logicalSignature: signature,
      criadoEm: nowTs,
      deletadoEm: null,
    };

    // First audit event (no previous chainHash)
    const auditEventRef = turnoRef.collection('events').doc();
    const firstEventPayload = {
      data: input.data,
      periodo: input.periodo,
      supervisorId: input.supervisorId,
      supervisorName,
      supervisorCRBM: supervisorCRBM || '',
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
    batch.set(turnoRef, turnoDoc);
    batch.set(auditEventRef, auditEvent);
    await batch.commit();

    return {
      ok: true,
      turnoId,
    };
  },
);
