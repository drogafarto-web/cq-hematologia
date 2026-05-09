/**
 * Calibração Type System
 *
 * Type system para calibração de equipamentos. Zero lógica.
 * Multi-tenant: escoped a `/labs/{labId}/calibracao`
 * Soft-delete only (RN-06): marca `deletadoEm: Timestamp | null`
 */

import type { Timestamp } from 'firebase/firestore';

export interface LogicalSignature {
  readonly hash: string;
  readonly operatorId: string;
  readonly ts: Timestamp;
}

// New English status (per Phase 8 plan spec)
export type CalibracaoStatusNew = 'in-date' | 'warning-30d' | 'warning-7d' | 'overdue' | 'out-of-service';

// Legacy Portuguese status (for backward compatibility with components)
export type CalibracaoStatusLegacy = 'no-prazo' | 'em-risco' | 'vencido';

// Union type that includes both - used in Record mappings where components don't know the difference
export type CalibracaoStatus = CalibracaoStatusNew | CalibracaoStatusLegacy;

// DueDateInfo uses legacy Portuguese statuses for component compatibility
export interface DueDateInfo {
  readonly nextDueDate: Timestamp;
  readonly daysUntilDue: number;
  readonly status: CalibracaoStatusLegacy; // 'no-prazo' | 'em-risco' | 'vencido'
  readonly alertsSent: {
    readonly dias30: boolean;
    readonly dias15: boolean;
    readonly dias7: boolean;
  };
}

// Legacy CertificateUpload for backward compatibility
export interface CertificateUpload {
  readonly id: string;
  readonly calibracaoId: string;
  readonly filename: string;
  readonly mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  readonly storagePath: string;
  readonly fileSize: number;
  readonly hash: string;
  readonly chainHash?: LogicalSignature; // Legacy field for compatibility
  readonly operatorId: string;
  readonly uploadedAt: Timestamp;
  readonly validUntil?: Timestamp;
}

export interface CalibracaoRecord {
  id: string;
  labId: string;
  equipamentoId: string;
  equipId: string;  // Alias for equipamentoId (for components)
  equipName: string;
  equipSerial?: string;
  calibrationMethod: 'in-house' | 'external-provider';
  calibrationProvider?: string;
  lastCalibrationDate: number | Timestamp;
  nextDueDate: number | Timestamp;
  certificateStoragePath: string;
  certificateHash: string;
  expandedUncertainty: number;
  status: CalibracaoStatus;
  statusUpdatedAt: number;
  alertsSent: { days: number; sentAt: number }[];
  createdAt: number | Timestamp;
  criadoEm?: Timestamp;  // Legacy alias
  createdBy: string;
  deletedAt?: number;
  // Required legacy fields for component compatibility
  readonly dueDateInfo: DueDateInfo;
  readonly certificates: CertificateUpload[];
  readonly vendor?: string;
  readonly vendorRef?: string;
  readonly notes?: string;
  readonly atualizadoEm?: Timestamp;
  readonly deletadoEm?: Timestamp | null;
}

export interface CalibracaoAlert {
  id: string;
  labId: string;
  calibracaoId: string;
  equipamentoName: string;
  daysUntilOverdue: number;
  alertType: 'warning-30d' | 'warning-7d' | 'overdue';
  emailSentAt: number;
  recipients: string[];
}

export function calculateCalibracaoStatus(nextDueDate: number | Timestamp): CalibracaoStatusNew {
  const now = Date.now();
  const dueTime = typeof nextDueDate === 'number' ? nextDueDate : nextDueDate.toMillis?.() ?? Date.now();
  const daysUntilDue = (dueTime - now) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue < 7) return 'warning-7d';
  if (daysUntilDue < 30) return 'warning-30d';
  return 'in-date';
}

export function mapStatusToLegacy(status: CalibracaoStatusNew): CalibracaoStatusLegacy {
  switch (status) {
    case 'in-date':
      return 'no-prazo';
    case 'warning-30d':
    case 'warning-7d':
      return 'em-risco';
    case 'overdue':
    case 'out-of-service':
      return 'vencido';
    default:
      return 'vencido';
  }
}

export function mapLegacyToNew(status: CalibracaoStatusLegacy): CalibracaoStatusNew {
  switch (status) {
    case 'no-prazo':
      return 'in-date';
    case 'em-risco':
      return 'warning-30d';
    case 'vencido':
      return 'overdue';
    default:
      return 'in-date';
  }
}

// Backward compatibility exports for existing services/components
export type CalibracaoInput = Omit<
  CalibracaoRecord,
  'id' | 'labId' | 'criadoEm' | 'atualizadoEm' | 'deletadoEm' | 'dueDateInfo' | 'certificates'
>;
