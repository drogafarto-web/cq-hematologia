/**
 * Portal Paciente Types
 * Patient-facing portal types for LGPD consent + result viewing
 * RDC 978 Arts. 167 + DICQ 5.2, 5.3, 5.7
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Patient result card — simplified view
 */
export interface PatientResult {
  id: string;
  labId: string;
  patientId: string;
  examName: string;
  examDate: Timestamp;
  resultDate: Timestamp;
  status: 'ok' | 'warning' | 'critical' | 'pending';
  resultValue?: string;
  referenceRange?: string;
  unit?: string;
  laudoId: string;
  versionId?: string;
  signatureHash?: string;
}

/**
 * Consent scope — what patient is authorizing
 */
export type ConsentScope = 'ia-strip' | 'ia-laudo' | 'ia-predictive';

/**
 * Patient consent record
 */
export interface PatientConsent {
  id: string;
  labId: string;
  patientId: string;
  scope: ConsentScope[];
  consentedAt: Timestamp;
  revokedAt: Timestamp | null;
  ipAddress?: string; // anonymized
  userAgent?: string;
  metadata?: {
    explicitlyApproved?: boolean;
    termsVersion?: string;
  };
}

/**
 * Consent capture modal state
 */
export interface ConsentCaptureState {
  isOpen: boolean;
  scope: ConsentScope;
  isLoading: boolean;
  error?: string;
  successMessage?: string;
}

/**
 * Patient session in portal (ephemeral)
 */
export interface PatientPortalSession {
  patientId: string;
  labId: string;
  patientName: string;
  labName: string;
  email: string;
  expiresAt: Timestamp;
  token: string; // JWT
}

/**
 * LGPD rights section
 */
export interface LgpdRights {
  accessibilityLink: string;
  portabilityLink: string;
  deletionLink: string;
  contactEmail: string;
  dpaEmail?: string;
}
