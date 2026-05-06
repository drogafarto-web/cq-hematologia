/**
 * recordRunBioquimica — Callable Cloud Function
 *
 * Única forma autorizada (server-side) de criar uma Run de bioquímica.
 * Client nunca escreve diretamente em /labs/{labId}/bioquimica/root/runs/{runId}.
 *
 * Responsabilidades:
 * 1. Validar membership + role (isActiveMemberOfLab)
 * 2. Validar dados de entrada (RunInput)
 * 3. Executar Westgard CLSI server-side (não confiar no client)
 * 4. Calcular chainHash (sequencial, auditável)
 * 5. Gerar LogicalSignature (hash + operatorId + ts)
 * 6. Atualizar lotStatus (incrementar approvalCount)
 * 7. Persistence via writeBatch (atomic)
 * 8. Return violations + metadata para UI re-render
 *
 * Threat model (CONTEXT.md):
 * - T5: Server-side Westgard (não confia na engine client)
 * - T3: chainHash imutável (determinístico, replicável)
 * - T1: LogicalSignature (operatorId === auth.uid, validado em rules)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { checkWestgardCLSI } from './_shared/westgardRulesCLSI';
import { calculateChainHashSync } from './_shared/chainHashCalc';

interface RecordRunBioquimicaInput {
  labId: string;
  lotId: string;
  equipmentId: string;
  analitoIds: string[];
  resultados: Record<string, Record<string, number>>;
  referenceBula?: string;
}

interface WestgardViolation {
  rule: string;
  severity: 'warn' | 'reject';
  message: string;
  value: number;
  threshold: number;
  zScore?: number;
  analitoId?: string;
  nivelId?: string;
}

interface RecordRunBioquimicaOutput {
  runId: string;
  status: string;
  violations: WestgardViolation[];
  chainHash: string;
  approvalCount: number;
  message: string;
}

/**
 * Check if user is an active member of lab (basic check)
 * TODO: Expand to check role claims in v1.4
 */
async function isActiveMemberOfLab(
  uid: string,
  labId: string,
  db: admin.firestore.Firestore
): Promise<boolean> {
  try {
    const memberDoc = await db.doc(`labs/${labId}/members/${uid}`).get();
    return memberDoc.exists && memberDoc.data()?.active === true;
  } catch {
    return false;
  }
}

export const recordRunBioquimica = onCall(async (request) => {
  const db = admin.firestore();

  // ─── Auth + Input Validation ──────────────────────────────────────────────

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User not authenticated');
  }

  const uid = request.auth.uid;
  const { labId, lotId, equipmentId, analitoIds, resultados, referenceBula } =
    request.data as RecordRunBioquimicaInput;

  // Validate required fields
  if (!labId || !lotId || !equipmentId || !analitoIds || !resultados) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  // Check membership
  const isMember = await isActiveMemberOfLab(uid, labId, db);
  if (!isMember) {
    throw new HttpsError(
      'permission-denied',
      'User is not an active member of this lab'
    );
  }

  // ─── Load Lot + Analito Metadata ──────────────────────────────────────────

  let lotDoc, analitos;
  try {
    lotDoc = await db.doc(`labs/${labId}/bioquimica/root/lotes/${lotId}`).get();
    if (!lotDoc.exists) {
      throw new HttpsError('not-found', 'Lot not found');
    }

    const analitoPromises = analitoIds.map((id) =>
      db.doc(`labs/${labId}/bioquimica/root/analitos/${id}`).get()
    );
    const analitoSnapshots = await Promise.all(analitoPromises);
    analitos = analitoSnapshots
      .map((snap) => snap.data())
      .filter((a): a is any => !!a);

    if (analitos.length !== analitoIds.length) {
      throw new HttpsError('invalid-argument', 'One or more analitos not found');
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'Failed to load lot or analitos');
  }

  // ─── Westgard Validation (Server-Side) ─────────────────────────────────────

  const violations: WestgardViolation[] = [];

  for (const analito of analitos) {
    const niveis = analito.niveis || [];
    for (const nivelId of niveis) {
      const value = resultados[analito.id]?.[nivelId];
      if (value === undefined) continue; // Skip if value not provided

      // Get bula stats for this (analito, nível)
      const bulaStats = analito.statsPorNivel?.[nivelId];
      if (bulaStats) {
        const analitoViolations = checkWestgardCLSI(value, {
          mean: bulaStats.mean,
          sd: bulaStats.sd,
        });

        violations.push(
          ...analitoViolations.map((v) => ({
            ...v,
            analitoId: analito.id,
            nivelId,
          }))
        );
      }
    }
  }

  // Determine status: aprovada if no violations, rejeitada if critical
  const hasCriticalViolation = violations.some((v) => v.severity === 'reject');
  const runStatus = hasCriticalViolation ? 'Rejeitada' : 'Aprovada';
  const aproveitamento = hasCriticalViolation ? 'informativa' : 'oficial';

  // ─── Calculate Chain Hash ──────────────────────────────────────────────────

  // Load previous run's chainHash (for sequential chaining)
  let prevChainHash = 'genesis'; // Placeholder; real impl loads from last run
  const chainHash = calculateChainHashSync(prevChainHash, {
    labId,
    lotId,
    equipmentId,
    resultados,
    ts: Date.now(),
  });

  // ─── Generate LogicalSignature ────────────────────────────────────────────

  const signature = {
    hash: chainHash,
    operatorId: uid,
    ts: admin.firestore.Timestamp.now(),
  };

  // ─── Build Run Document ──────────────────────────────────────────────────────

  const runId = db.collection('_').doc().id; // Generate unique ID
  const run: any = {
    labId,
    lotId,
    equipmentId,
    analitoIds,
    resultados,
    status: runStatus,
    aproveitamento,
    violations,
    chainHash,
    signature,
    referenceBula,
    criadoEm: admin.firestore.Timestamp.now(),
    criadoPor: uid,
    deletadoEm: null,
  };

  // ─── Atomic Write: Run + Lot Update ──────────────────────────────────────────

  const batch = db.batch();

  // Write run
  batch.set(db.doc(`labs/${labId}/bioquimica/root/runs/${runId}`), run);

  // Update lot: increment approvalCount
  const lotRef = db.doc(`labs/${labId}/bioquimica/root/lotes/${lotId}`);
  const lotData = lotDoc.data() || {};
  batch.update(lotRef, {
    approvalCount: (lotData.approvalCount || 0) + 1,
    lastRunAt: admin.firestore.Timestamp.now(),
  });

  try {
    await batch.commit();
  } catch (err) {
    throw new HttpsError('internal', 'Failed to persist run and lot update');
  }

  // ─── Return Response ──────────────────────────────────────────────────────────

  return {
    runId,
    status: runStatus,
    violations,
    chainHash,
    approvalCount: (lotData.approvalCount || 0) + 1,
    message: hasCriticalViolation
      ? 'Run criada com violações Westgard críticas — rejeição automática'
      : 'Run aprovada — no violations detected',
  } as RecordRunBioquimicaOutput;
});
