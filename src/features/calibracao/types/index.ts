/**
 * Calibração Domain Types (DICQ 5.3.1.4)
 *
 * Equipment calibration tracking with certificate uploads and due date monitoring.
 * Multi-tenant: all entities scoped to `/labs/{labId}/calibracao/` paths.
 *
 * Soft-delete only (RN-06): all entities have `deletadoEm: Timestamp | null`
 * Chain-hash: HMAC-SHA256 on all certificate uploads for integrity verification
 * LogicalSignature: { hash (SHA-256), operatorId, ts } for audit trail immutability
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * LogicalSignature — immutable audit marker
 *
 * Pattern shared with auditoria-interna + educacao-continuada.
 * - hash: SHA-256 of canonical JSON (64 hex chars)
 * - operatorId: request.auth.uid (uploader/signer)
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
 * CertificateUpload — single calibration certificate record
 *
 * Links to Cloud Storage at: gs://bucket/calibracao/{labId}/{equipId}/{id}
 * Chain-hash validates integrity: HMAC-SHA256(labId + equipId + filename + operatorId + ts)
 */
export interface CertificateUpload {
  readonly id: string;                    // UUID, generated on upload
  readonly calibracaoId: string;          // FK to CalibracaoRecord.id (equipId)
  readonly filename: string;              // original filename (e.g., "cert_2026-05.pdf")
  readonly mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  readonly storagePath: string;           // gs://bucket/calibracao/{labId}/{equipId}/{id}
  readonly fileSize: number;              // bytes
  readonly hash: string;                  // chain-hash HMAC-SHA256 (64 chars hex)
  readonly operatorId: string;            // who uploaded (request.auth.uid)
  readonly uploadedAt: Timestamp;         // when uploaded
  readonly chainHash: LogicalSignature;   // integrity proof (hash + operatorId + ts)
  readonly validUntil?: Timestamp;        // expiration date of certificate validity (if stamped on cert)
}

/**
 * DueDateAlert — triggered when equipment approaches calibration due date
 *
 * Alerts fire at 30, 15, and 7 days before nextDueDate.
 * Can be dismissed by user (dismissedAt != null).
 */
export interface DueDateAlert {
  readonly id: string;                    // UUID
  readonly labId: string;                 // multi-tenant
  readonly equipId: string;               // FK to equipment
  readonly calibracaoId: string;          // FK to calibration record
  readonly daysRemaining: number;         // 30, 15, or 7
  readonly sentAt: Timestamp;             // when alert was triggered
  readonly dismissedAt?: Timestamp | null; // null = active, Timestamp = dismissed
}

/**
 * DueDateInfo — computed status of equipment calibration deadline
 *
 * Derived field computed on read from CalibracaoRecord.nextDueDate
 */
export interface DueDateInfo {
  readonly nextDueDate: Timestamp;
  readonly daysUntilDue: number;          // can be negative if overdue
  readonly status: 'no-prazo' | 'em-risco' | 'vencido';  // >30d, 7-30d, <7d
  readonly alertsSent: {
    readonly dias30: boolean;             // was 30-day alert sent?
    readonly dias15: boolean;             // was 15-day alert sent?
    readonly dias7: boolean;              // was 7-day alert sent?
  };
}

/**
 * CalibracaoRecord — main equipment calibration tracking entity
 *
 * One record per equipment, stored at `/labs/{labId}/calibracao/{equipId}`.
 * Historical calibrations (past certificates) live in `certificates[]` array.
 */
export interface CalibracaoRecord {
  readonly id: string;                    // matches equipId (1:1 linkage)
  readonly labId: string;                 // multi-tenant (RN-multi-tenant)
  readonly equipId: string;               // FK to equipamentos module
  readonly equipName: string;             // denormalized from equipamentos (read-only at this layer)
  readonly equipSerial?: string;          // equipment serial number
  readonly lastCalibrationDate: Timestamp; // when equipment was last calibrated
  readonly nextDueDate: Timestamp;        // when next calibration is due
  readonly vendor?: string;               // vendor name (if applicable)
  readonly vendorRef?: string;            // vendor document reference number
  readonly certificates: CertificateUpload[]; // all uploaded certificates (past + current)
  readonly dueDateInfo: DueDateInfo;      // computed status (derived)
  readonly notes?: string;                // operational notes
  readonly criadoEm: Timestamp;           // created timestamp
  readonly atualizadoEm: Timestamp;       // last updated
  readonly deletadoEm?: Timestamp | null; // soft-delete marker (RN-06)
}

/**
 * CalibracaoStatus — derived status from DueDateInfo
 *
 * Used in UI for color-coding and sorting.
 */
export type CalibracaoStatus = 'no-prazo' | 'em-risco' | 'vencido';

/**
 * Input DTO for creating/updating calibration records
 *
 * Omits audit fields (id, labId, criadoEm, atualizadoEm, deletadoEm)
 * Omits computed fields (dueDateInfo, certificates) — managed by service
 */
export type CalibracaoInput = Omit<
  CalibracaoRecord,
  'id' | 'labId' | 'criadoEm' | 'atualizadoEm' | 'deletadoEm' | 'dueDateInfo' | 'certificates'
>;

/**
 * CalibracaoTimeline — helper type for rendering timeline view
 *
 * Combines past + future calibrations for UI display.
 */
export interface CalibracaoTimeline {
  readonly pastCalibrations: CertificateUpload[];  // sorted by uploadedAt DESC
  readonly currentCertificate?: CertificateUpload; // most recent
  readonly futureDueDate: Timestamp;
  readonly status: CalibracaoStatus;
}
