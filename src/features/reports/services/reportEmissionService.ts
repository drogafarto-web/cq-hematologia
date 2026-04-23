/**
 * reportEmissionService — registro append-only de emissões de relatório CQI.
 *
 * Cada vez que um operador gera um relatório CQI (impressão/PDF), esta camada:
 *   1. Calcula SHA-256 criptográfico sobre payload canônico (labId + emissionId
 *      + generatedAt + generatedBy + lotIds + runIds ordenados).
 *   2. Deriva `auditCode` humano-legível (CQ-XXXX-XXXX-XXXX-XXXX) a partir dos
 *      primeiros 16 hex chars do hash.
 *   3. Persiste em `/labs/{labId}/report-emissions/{emissionId}` (create-only,
 *      imutável — ver firestore.rules).
 *
 * O código impresso no relatório é verificável contra o registro Firestore:
 * auditor pega o PDF, cruza `auditCode` com `/labs/{labId}/report-emissions`,
 * recalcula o SHA-256 do payload gravado e confirma que bate.
 *
 * Troca da implementação anterior (djb2 client-side determinístico) — RDC 978/2025.
 */

import {
  db,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { ControlLot } from '../../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportEmissionAuthor {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

export interface ReportEmission {
  emissionId: string;
  /** Código humano-legível no formato CQ-XXXX-XXXX-XXXX-XXXX */
  auditCode: string;
  /** Hash SHA-256 completo em hex (64 chars) */
  payloadHash: string;
}

interface CanonicalPayload {
  labId: string;
  emissionId: string;
  generatedAt: string; // ISO-8601
  generatedBy: string; // uid
  lotIds: string[]; // sorted asc
  runIds: string[]; // sorted asc
  runCount: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function formatAuditCode(hashHex: string): string {
  const short = hashHex.slice(0, 16).toUpperCase();
  return `CQ-${short.slice(0, 4)}-${short.slice(4, 8)}-${short.slice(8, 12)}-${short.slice(12, 16)}`;
}

function buildCanonicalPayload(
  labId: string,
  emissionId: string,
  author: ReportEmissionAuthor,
  lots: ControlLot[],
  generatedAt: Date,
): CanonicalPayload {
  const lotIds = lots.map((l) => l.id).sort();
  const runIds = lots.flatMap((l) => l.runs.map((r) => r.id)).sort();
  return {
    labId,
    emissionId,
    generatedAt: generatedAt.toISOString(),
    generatedBy: author.uid,
    lotIds,
    runIds,
    runCount: runIds.length,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(buffer);
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

function emissionRef(labId: string, emissionId: string) {
  return doc(
    db,
    COLLECTIONS.LABS,
    labId,
    SUBCOLLECTIONS.REPORT_EMISSIONS,
    emissionId,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Grava uma emissão de relatório em Firestore e retorna o código de auditoria
 * derivado. Append-only — rule bloqueia update e delete.
 *
 * @throws se o caller não for membro ativo do lab OU se a gravação falhar.
 */
export async function createReportEmission(
  labId: string,
  author: ReportEmissionAuthor,
  lots: ControlLot[],
  generatedAt: Date,
): Promise<ReportEmission> {
  const emissionId = crypto.randomUUID();
  const payload = buildCanonicalPayload(labId, emissionId, author, lots, generatedAt);
  const canonical = JSON.stringify(payload);
  const payloadHash = await sha256Hex(canonical);
  const auditCode = formatAuditCode(payloadHash);

  try {
    await setDoc(emissionRef(labId, emissionId), {
      labId,
      emissionId,
      auditCode,
      payloadHash,
      scope: 'consolidated-monthly-report',
      generatedAt: Timestamp.fromDate(generatedAt),
      generatedBy: author.uid,
      generatedByEmail: author.email ?? null,
      generatedByName: author.displayName ?? author.email ?? null,
      lotIds: payload.lotIds,
      runIds: payload.runIds,
      runCount: payload.runCount,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }

  return { emissionId, auditCode, payloadHash };
}
