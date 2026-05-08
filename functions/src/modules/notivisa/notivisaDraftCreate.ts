/**
 * notivisaDraftCreate — create new NOTIVISA draft with idempotency check + rate limiting
 *
 * Implementação Batch 1, ADR-0026 Phase 8.
 *
 * Responsabilidades:
 *   1. Valida claim + membership (assertNotivisaAccess).
 *   2. Valida payload com Zod (NotivisaPayloadSchema).
 *   3. Idempotency check: query drafts por laudoId, status != 'submitted'.
 *   4. Rate limit: 10 submissions/minuto por lab via Firestore counter.
 *   5. Gera `LogicalSignature` server-side com `uid` e `Timestamp.now()`.
 *   6. Escreve draft + cria audit log entry.
 *   7. Retorna draftId + payload + createdAt.
 *
 * RN-12 (Phase 0b pattern): escrita regulatória via callable (client não pode).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertNotivisaAccess,
  NotivisaDraftCreateInputSchema,
  ensureNotivisaLabRoot,
  notivisaDraftsCol,
} from './validators';
import { generateNotivisaSignatureServer, type LogicalSignature } from './signatureCanonical';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

interface NotivisaDraftCreateResult {
  ok: true;
  draftId: string;
  status: 'draft';
  criadoEm: number;
}

/**
 * Rate limiting via Firestore counter (reseta daily).
 * Counts submissions per minute per lab.
 */
async function checkRateLimitPerMinute(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const counterRef = db.doc(
    `notivisa-drafts/${labId}/rate-limits/minute-${minuteKey}`,
  );
  const counterSnap = await counterRef.get();

  if (!counterSnap.exists) {
    // First request this minute
    await counterRef.set({ count: 1, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  } else {
    const count = (counterSnap.data()?.['count'] ?? 0) + 1;
    if (count > 10) {
      throw new HttpsError(
        'resource-exhausted',
        'Taxa de submissão excedida — máx 10 por minuto.',
      );
    }
    await counterRef.update({ count });
  }
}

export const notivisaDraftCreate = onCall<unknown, Promise<NotivisaDraftCreateResult>>(
  {},
  async (request) => {
    const parsed = NotivisaDraftCreateInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }

    const input = parsed.data;

    await assertNotivisaAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    await ensureNotivisaLabRoot(db, input.labId);

    // 1. Rate limit check
    await checkRateLimitPerMinute(db, input.labId);

    // 2. Idempotency check: search for existing draft with same laudoId (not submitted)
    const existingQuery = await notivisaDraftsCol(db, input.labId)
      .where('laudoId', '==', input.laudoId)
      .where('status', '!=', 'submitted')
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      const existingId = existingQuery.docs[0].id;
      const existingData = existingQuery.docs[0].data();
      return {
        ok: true,
        draftId: existingId,
        status: 'draft',
        criadoEm: existingData?.['criadoEm']?.toMillis?.() ?? Date.now(),
      };
    }

    // 3. Create new draft
    const draftRef = notivisaDraftsCol(db, input.labId).doc();
    const nowTs = admin.firestore.Timestamp.now();

    // Generate signature over payload
    const assinatura: LogicalSignature = generateNotivisaSignatureServer(
      uid,
      {
        versao: input.payload.versao,
        laudo_id: input.payload.laudo_id,
        paciente_cpf: input.payload.paciente_cpf,
        data_resultado: input.payload.data_resultado,
      },
      nowTs,
    );

    // 4. writeBatch: draft + audit log
    const batch = db.batch();

    batch.set(draftRef, {
      labId: input.labId,
      laudoId: input.laudoId,
      status: 'draft',
      payload: input.payload,
      assinatura,
      criadoEm: nowTs,
      deletadoEm: null,
    });

    // Create audit log subcollection entry
    const auditRef = draftRef.collection('auditLog').doc();
    batch.set(auditRef, {
      action: 'CREATED',
      operatorId: uid,
      ts: nowTs,
      details: {
        laudoId: input.laudoId,
        paciente_cpf_masked: `***${input.payload.paciente_cpf.slice(-4)}`,
      },
    });

    await batch.commit();

    // Audit non-blocking — retries + fallback to auditLogFailures/
    await writeAuditLog({
      action: 'NOTIVISA_DRAFT_CREATE',
      callerUid: uid,
      labId: input.labId,
      payload: {
        draftId: draftRef.id,
        laudoId: input.laudoId,
        paciente_cpf_masked: `***${input.payload.paciente_cpf.slice(-4)}`,
      },
    });

    return {
      ok: true,
      draftId: draftRef.id,
      status: 'draft',
      criadoEm: nowTs.toMillis(),
    };
  },
);
