/**
 * Consent Gate — LGPD/PII guardrail for ia-strip Gemini calls
 *
 * Verifies a patient consent record exists for AI processing of their images
 * BEFORE the base64 payload leaves our infrastructure for Gemini.
 *
 * Defense-in-depth: complements the LGPD DPIA. Even if a caller forgets to
 * check consent client-side, this gate stops the request server-side.
 *
 * Firestore schema:
 *   consents/{labId}/patients/{patientId}
 *     - iaProcessing: boolean         // explicit opt-in for AI processing
 *     - consentedAt: Timestamp        // when patient signed
 *     - revokedAt: Timestamp | null   // null = active; Timestamp = revoked
 *     - consentVersion: string        // policy version (e.g. 'lgpd-v1')
 *     - capturedBy: string            // operator UID who collected consent
 *
 * Throws HttpsError('failed-precondition', 'consent-not-captured') on miss.
 */

import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

export interface PatientConsentRecord {
  iaProcessing: boolean;
  consentedAt: admin.firestore.Timestamp;
  revokedAt: admin.firestore.Timestamp | null;
  consentVersion: string;
  capturedBy: string;
}

export interface ConsentGateInput {
  labId: string;
  patientId: string;
  /**
   * Optional injected firestore instance for testability. Defaults to
   * `admin.firestore()` when omitted (production path).
   */
  firestore?: admin.firestore.Firestore;
}

export interface ConsentGateResult {
  passed: true;
  consentVersion: string;
  consentedAt: admin.firestore.Timestamp;
}

/**
 * Verify patient AI-processing consent. Throws on any failure.
 *
 * Failure modes (all → HttpsError 'failed-precondition' / code 'consent-not-captured'):
 * - consent doc does not exist
 * - iaProcessing !== true
 * - revokedAt !== null
 * - consentedAt missing or invalid
 */
export async function consentGate(input: ConsentGateInput): Promise<ConsentGateResult> {
  const { labId, patientId } = input;
  const db = input.firestore ?? admin.firestore();

  if (!labId || !patientId) {
    throw new HttpsError('failed-precondition', 'consent-not-captured');
  }

  const ref = db.doc(`consents/${labId}/patients/${patientId}`);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'consent-not-captured');
  }

  const data = snap.data() as Partial<PatientConsentRecord> | undefined;

  if (!data) {
    throw new HttpsError('failed-precondition', 'consent-not-captured');
  }

  if (data.iaProcessing !== true) {
    throw new HttpsError('failed-precondition', 'consent-not-captured');
  }

  if (data.revokedAt !== null && data.revokedAt !== undefined) {
    throw new HttpsError('failed-precondition', 'consent-not-captured');
  }

  if (!data.consentedAt) {
    throw new HttpsError('failed-precondition', 'consent-not-captured');
  }

  return {
    passed: true,
    consentVersion: data.consentVersion ?? 'unspecified',
    consentedAt: data.consentedAt as admin.firestore.Timestamp,
  };
}
