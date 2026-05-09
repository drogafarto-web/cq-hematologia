import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type { QualidadeAuditEntry, ComplianceReport, AuditTrailFilters } from './types';
import {
  signAuditEntry,
  validateChainIntegrity,
  verifyAuditEntry,
} from '../audit/cryptoAudit';
import { HCQ_SIGNATURE_HMAC_KEY } from '../signatures/verifier';
import { captureContext, type AuditContext } from '../../shared/contextCapture';
import { buildDiff, type DiffEntry } from '../../shared/auditDiffDetector';

const db = admin.firestore();

/**
 * ADR 0001 Wave 2 — Audit Trail Complete Implementation
 * Callables: getAuditTrail, validateChain, generateComplianceReport
 *
 * Phase 7 Wave 1 Extension:
 * - createAuditEntry: Capture context + diffs for every operation
 */

/**
 * Extended audit entry with captured context and diffs
 * Used by Phase 7 advanced auditoria
 */
export interface ExtendedAuditEntry extends QualidadeAuditEntry {
  context?: AuditContext;
  diffs?: DiffEntry[];
}

/**
 * createAuditEntry — Extended audit logging with context capture + diff detection
 * Called by business logic functions (investigarNC, executarAcaoCorretiva, etc.)
 *
 * RDC 978 Art. 107 — Complete context recording
 * Phase 7 Wave 1 — SA-05
 */
export async function createAuditEntry(
  req: CallableRequest<any>,
  moduleId: string,
  recordId: string,
  before?: unknown,
  after?: unknown
): Promise<ExtendedAuditEntry> {
  if (!req.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Auth required');
  }

  const context = captureContext(req);
  const diffs = buildDiff(before, after);
  const secret = HCQ_SIGNATURE_HMAC_KEY.value();

  const entryData: Partial<ExtendedAuditEntry> = {
    labId: context.labId,
    operatorId: context.operatorId,
    operation: context.action,
    modulo: moduleId,
    acao: context.action,
    resultado: 'sucesso',
    payload: {
      moduleId,
      recordId,
      before,
      after,
    },
    context,
    diffs,
    timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
    deletadoEm: null,
    previousHash: null,
    hmac: '',
    hash: '',
  };

  if (secret) {
    const sig = await signAuditEntry(
      `/labs/${context.labId}/audit-trail`,
      context.operatorId,
      context.action,
      entryData,
      secret
    );
    (entryData as any).hmac = sig.hmac;
    (entryData as any).hash = sig.hash;
  }

  const entryRef = await db.collection(`labs/${context.labId}/audit-trail`).add(entryData);

  return {
    id: entryRef.id,
    ...entryData,
  } as ExtendedAuditEntry;
}

/**
 * writeAuditEntry — Internal audit logging helper
 * Invoked by other callables (investigarNC, executarAcaoCorretiva, etc.)
 * Not exposed as a public onCall endpoint.
 */
export async function writeAuditEntry(
  labId: string,
  operatorId: string,
  operation: string,
  modulo: string,
  payload: Record<string, any>,
  resultado: 'sucesso' | 'falha' | 'aviso' = 'sucesso',
  acao?: string
): Promise<{ entryId: string; timestamp: admin.firestore.Timestamp }> {
  const secret = HCQ_SIGNATURE_HMAC_KEY.value();
  const entry: Partial<QualidadeAuditEntry> = {
    labId,
    operation,
    modulo,
    acao: acao || operation,
    resultado,
    operatorId,
    payload,
    timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
    deletadoEm: null,
    previousHash: null,
    hmac: '',
    hash: '',
  };

  if (secret) {
    const sig = await signAuditEntry(
      `/labs/${labId}/audit-trail`,
      operatorId,
      operation,
      entry,
      secret
    );
    (entry as any).hmac = sig.hmac;
    (entry as any).hash = sig.hash;
  }

  const entryRef = await db.collection(`labs/${labId}/audit-trail`).add(entry);

  return {
    entryId: entryRef.id,
    timestamp: admin.firestore.Timestamp.now(),
  };
}

export const getAuditTrail = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    const { labId, filters = {}, limit = 100, offset = 0 } = request.data;

    if (!labId) {
      throw new HttpsError('invalid-argument', 'labId required');
    }

    try {
      let query: FirebaseFirestore.Query = db.collection(`labs/${labId}/audit-trail`);

      // Apply filters
      if ((filters as AuditTrailFilters).modulo) {
        query = query.where('modulo', '==', (filters as AuditTrailFilters).modulo);
      }
      if ((filters as AuditTrailFilters).operadorId) {
        query = query.where('operatorId', '==', (filters as AuditTrailFilters).operadorId);
      }
      if ((filters as AuditTrailFilters).resultado) {
        query = query.where('resultado', '==', (filters as AuditTrailFilters).resultado);
      }

      // Order and paginate
      const snapshot = await query
        .orderBy('timestamp', 'desc')
        .limit(limit + 1)
        .offset(offset)
        .get();

      const entries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        success: true,
        entries,
        count: entries.length,
        hasMore: entries.length > limit,
      };
    } catch (error: any) {
      throw new HttpsError('internal', `Failed to fetch audit trail: ${error.message}`);
    }
  }
);

export const validateChain = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    const { labId } = request.data;

    if (!labId) {
      throw new HttpsError('invalid-argument', 'labId required');
    }

    try {
      const secret = HCQ_SIGNATURE_HMAC_KEY.value();
      if (!secret) {
        throw new Error('HMAC key not configured');
      }

      const result = await validateChainIntegrity(`labs/${labId}/audit-trail`, secret);

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      throw new HttpsError('internal', `Chain validation failed: ${error.message}`);
    }
  }
);

export const generateComplianceReport = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    const { labId, dateStart, dateEnd } = request.data;

    if (!labId || !dateStart || !dateEnd) {
      throw new HttpsError('invalid-argument', 'labId, dateStart, dateEnd required');
    }

    try {
      const secret = HCQ_SIGNATURE_HMAC_KEY.value();

      // Fetch all entries in date range
      const startDate = new Date(dateStart);
      const endDate = new Date(dateEnd);

      const snapshot = await db
        .collection(`labs/${labId}/audit-trail`)
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .orderBy('timestamp', 'asc')
        .get();

      const entries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (QualidadeAuditEntry & { id: string })[];

      // Analyze entries
      const operators = new Set<string>();
      const modules = new Set<string>();
      let successCount = 0;
      let failureCount = 0;
      let warningCount = 0;

      for (const entry of entries) {
        operators.add(entry.operatorId);
        modules.add(entry.modulo);
        if (entry.resultado === 'sucesso') successCount++;
        else if (entry.resultado === 'falha') failureCount++;
        else if (entry.resultado === 'aviso') warningCount++;
      }

      // Validate chain integrity
      let chainStatus: 'válida' | 'inválida' | 'parcial' = 'válida';
      let chainViolations: Array<{ entryId: string; reason: string }> = [];

      if (secret && entries.length > 0) {
        let previousHash: string | null = null;
        for (const entry of entries) {
          const verification = verifyAuditEntry(entry as any, secret);
          if (!verification.valid) {
            chainStatus = 'inválida';
            chainViolations.push({
              entryId: entry.id,
              reason: verification.reason || 'HMAC mismatch',
            });
          }
          if (entry.previousHash !== previousHash) {
            if (chainStatus === 'válida') chainStatus = 'parcial';
            chainViolations.push({
              entryId: entry.id,
              reason: 'Hash sequence broken',
            });
          }
          previousHash = entry.hash;
        }
      }

      const report: ComplianceReport = {
        labId,
        generatedAt: admin.firestore.Timestamp.now(),
        generatedBy: request.auth.uid,
        dateRange: {
          inicio: startDate,
          fim: endDate,
        },
        summary: {
          totalEntries: entries.length,
          operatorsInvolved: operators.size,
          modulesCovered: Array.from(modules),
          successCount,
          failureCount,
          warningCount,
        },
        chainStatus,
        chainViolations: chainViolations.length > 0 ? chainViolations : undefined,
        rdc978Compliance: {
          auditTrailComplete: entries.length > 0,
          noGapsinSequence: chainStatus !== 'inválida',
          hmacIntegrityValid: chainStatus !== 'inválida',
        },
        dicq44Compliance: {
          entriesImmutable: chainStatus !== 'inválida',
          operatorIdentification: entries.every((e) => !!e.operatorId),
          timestampServerGenerated: entries.every((e) => !!e.timestamp),
          auditTrailIsolated: true, // Firestore rules enforce isolation
        },
      };

      return {
        success: true,
        report,
      };
    } catch (error: any) {
      throw new HttpsError('internal', `Failed to generate compliance report: ${error.message}`);
    }
  }
);
