/**
 * CAPA Tracking Domain Types (Phase 8)
 *
 * Type hierarchy for CAPA tracking, status transitions, and evidence management.
 * Multi-tenant: all entities scoped to `/labs/{labId}/naoConformidades/{ncId}` paths.
 *
 * Soft-delete only (RN-06): all entities have `deletedAt: Timestamp | null`
 * LogicalSignature: { hash (SHA-256), operatorId, ts } for audit trail immutability
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * LogicalSignature — immutable audit marker
 *
 * Shared pattern with auditoria-interna.
 * - hash: SHA-256 of canonical JSON (64 hex chars)
 * - operatorId: request.auth.uid (creator/signer)
 * - ts: Timestamp of signature
 *
 * Rules validate: hash.size() == 64 + operatorId == request.auth.uid + ts is timestamp
 */
export interface LogicalSignature {
  readonly hash: string;        // SHA-256 hex (64 chars)
  readonly operatorId: string;  // request.auth.uid
  readonly ts: Timestamp;       // when signed
}

/**
 * CAPAStatus — workflow states
 *
 * Transitions follow state machine:
 * aberto → em-andamento → evidencia-submetida → auditor-revisando → fechado (terminal)
 */
export type CAPAStatus =
  | 'aberto'
  | 'em-andamento'
  | 'evidencia-submetida'
  | 'auditor-revisando'
  | 'fechado';

/**
 * CAPAPriority — severity of finding
 *
 * From Phase 7 audit dry-run categorization:
 * - critica: Major non-conformance (NCM) requiring immediate action
 * - alta: High-priority gap affecting operations
 * - media: Medium-priority procedural improvement
 * - estendida: Extended timeline (v1.4 scope)
 */
export type CAPAPriority = 'critica' | 'alta' | 'media' | 'estendida';

/**
 * CAPATransition — audit trail entry for status changes
 *
 * Immutable record of who changed status, when, and with what signature.
 * Appended to transitions[] array (never mutated).
 */
export interface CAPATransition {
  from: CAPAStatus;
  to: CAPAStatus;
  operatorId: string;           // request.auth.uid who initiated transition
  signature: LogicalSignature;  // immutable proof of change
  notes?: string;               // optional context (e.g., "rejected — more evidence needed")
}

/**
 * CAPAEvidenceRef — link to stored evidence artifact
 *
 * Evidence stored in Cloud Storage at:
 * /labs/{labId}/auditoria-evidencia/capa-{ncId}/{filename}
 * Chain-hash validated in Firestore rules.
 */
export interface CAPAEvidenceRef {
  type: 'foto' | 'documento' | 'certificado' | 'pop' | 'treinamento';
  storagePath: string;          // gs://hmatologia2.appspot.com/labs/{labId}/auditoria-evidencia/...
  uploadedAt: Timestamp;
  uploadedBy: string;           // userId
  hash: string;                 // SHA-256 for integrity verification
  filename?: string;            // original filename (metadata)
}

/**
 * CAPA — Corrective Action Plan
 *
 * 1:1 mapping with Non-Conformidade (NC) from Phase 7 audit.
 * Created automatically when NC is registered with critical/high severity.
 * Tracked in Firestore under `/labs/{labId}/naoConformidades/{ncId}`
 * as a subdocument at `naoConformidades/{ncId}/capaPlano`.
 */
export interface CAPA {
  readonly id: string;                    // matches NC id (1:1)
  readonly labId: string;                 // multi-tenant
  readonly ncId: string;                  // reference to parent NC
  finding: string;                        // descriptive finding from audit (e.g., "Falta em analisadores")
  dicqRef: string;                        // DICQ reference (e.g., "DICQ 5.3.1.4")
  priority: CAPAPriority;                 // critica | alta | media | estendida
  deadline: Timestamp;                    // target closure date
  owner: string;                          // userId assigned to action
  ownerName: string;                      // denormalized for display (e.g., "João Silva")
  status: CAPAStatus;                     // current workflow state
  transitions: CAPATransition[];          // immutable history of status changes
  evidence: CAPAEvidenceRef[];            // links to uploaded evidence
  effectivenessCriteria: string;          // RN-validation: how to verify closure
  closedAt?: Timestamp;                   // when status changed to 'fechado'
  closedBy?: string;                      // userId who closed (auditor)
  closureSignature?: LogicalSignature;    // signed closure proof
  readonly createdAt: Timestamp;          // when CAPA was created
  readonly createdBy?: string;            // userId who created (usually system on NC creation)
  deletedAt: Timestamp | null;            // soft-delete marker (RN-06)
}

/**
 * CAPAInput — payload for creating/updating CAPA
 *
 * Omits audit fields (id, labId, ncId, createdAt, deletedAt).
 * Only service layer can write these fields.
 */
export type CAPAInput = Omit<
  CAPA,
  'id' | 'labId' | 'ncId' | 'createdAt' | 'createdBy' | 'deletedAt'
>;

/**
 * DaysUntilDeadline — computed deadline status (virtual field, not stored)
 *
 * Added by hook during display computation.
 */
export interface DeadlineStatus {
  daysRemaining: number;
  status: 'on-track' | 'at-risk' | 'overdue';  // >7 days | 1-7 days | <0
  color: 'emerald' | 'amber' | 'red';          // color for UI indicator
}

/**
 * CAPAWithDeadlineStatus — CAPA + computed deadline field
 *
 * Returned by useCAPAs hook (adds virtual field).
 */
export interface CAPAWithDeadlineStatus extends CAPA {
  readonly deadlineStatus: DeadlineStatus;
}
