/**
 * LGPD Service Layer
 *
 * Handles real-time subscriptions and read-only operations for LGPD entities.
 * All writes (DPIA creation, policy versioning, acceptance tracking) go through
 * Cloud Function callables (Fase 0b pattern).
 *
 * Multi-tenant enforcement: all operations require explicit labId parameter.
 * Soft-delete preservation (RN-06): filters deletadoEm == null.
 */

import {
  collection,
  doc,
  DocumentSnapshot,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Unsubscribe,
  Timestamp,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../../../shared/services/firebase';
import type { DPIA, PolicyVersion, PrivacyAceite, LogicalSignature, OTPRecord } from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Path helpers (multi-tenant)
// ──────────────────────────────────────────────────────────────────────────

function dpiaCol(labId: string) {
  return collection(db, `labs/${labId}/lgpd/dpia`);
}

function dpiaDoc(labId: string, dpiaId: string) {
  return doc(db, `labs/${labId}/lgpd/dpia/${dpiaId}`);
}

function policasCol(labId: string) {
  return collection(db, `labs/${labId}/lgpd/politicas`);
}

function policaDoc(labId: string, policaId: string) {
  return doc(db, `labs/${labId}/lgpd/politicas/${policaId}`);
}

function aceitesCol(userId: string) {
  return collection(db, `users/${userId}/privacyAceites`);
}

function aceitesDoc(userId: string, aceitesId: string) {
  return doc(db, `users/${userId}/privacyAceites/${aceitesId}`);
}

function otpsCol() {
  return collection(db, 'otps');
}

function otpsDoc(otpToken: string) {
  return doc(db, `otps/${otpToken}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Snapshot mappers
// ──────────────────────────────────────────────────────────────────────────

function mapDocToDPIA(snap: DocumentSnapshot): DPIA {
  const data = snap.data() as any;
  return {
    id: snap.id,
    labId: data.labId,
    versao: data.versao,
    dataPreenchimento: data.dataPreenchimento,
    responsavelDados: data.responsavelDados,
    datasColetadas: data.datasColetadas || [],
    fluxosDados: data.fluxosDados || [],
    riscos: data.riscos || [],
    medidas: data.medidas || [],
    revisaoJuridica: data.revisaoJuridica || false,
    dataAprovacao: data.dataAprovacao,
    assinaturRT: data.assinaturRT,
    criadoEm: data.criadoEm,
    atualizadoEm: data.atualizadoEm,
    deletadoEm: data.deletadoEm,
  };
}

function mapDocToPolicyVersion(snap: DocumentSnapshot): PolicyVersion {
  const data = snap.data() as any;
  return {
    id: snap.id,
    labId: data.labId,
    versao: data.versao,
    conteudo: data.conteudo,
    dataEfetivaAte: data.dataEfetivaAte,
    criadoEm: data.criadoEm,
    deletadoEm: data.deletadoEm,
  };
}

function mapDocToAceite(snap: DocumentSnapshot): PrivacyAceite {
  const data = snap.data() as any;
  return {
    id: snap.id,
    labId: data.labId,
    userId: data.userId,
    policyVersionId: data.policyVersionId,
    policyVersao: data.policyVersao,
    aceiteEm: data.aceiteEm,
    ipAddr: data.ipAddr,
    userAgent: data.userAgent,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// DPIA subscriptions and queries
// ──────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to single DPIA document (real-time)
 * Filters: deletadoEm == null (soft-delete)
 */
export function subscribeDPIA(
  labId: string,
  callback: (dpia: DPIA | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(dpiaCol(labId), where('deletadoEm', '==', null), limit(1));

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
      } else {
        callback(mapDocToDPIA(snap.docs[0]));
      }
    },
    onError,
  );
}

/**
 * Save DPIA via Cloud Function callable
 * Server-side generates versão increment + LogicalSignature
 *
 * Note: This is a client-side convenience wrapper. Actual write goes through
 * Cloud Function `gerarDPIA` for audit-grade signature generation.
 */
export async function saveDPIA(
  labId: string,
  dpia: Omit<DPIA, 'id' | 'labId' | 'criadoEm' | 'atualizadoEm' | 'versao'>,
): Promise<string> {
  const callable = httpsCallable(functions, 'gerarDPIA');
  const result: any = await callable({ labId, ...dpia });
  return result.data.dpiaId;
}

// ──────────────────────────────────────────────────────────────────────────
// Privacy Policy subscriptions
// ──────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to current privacy policy (real-time, latest version)
 * Filters: deletadoEm == null && dataEfetivaAte == null or dataEfetivaAte > now
 */
export function subscribeCurrentPolicy(
  labId: string,
  callback: (policy: PolicyVersion | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    policasCol(labId),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
    limit(1),
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
      } else {
        const policy = mapDocToPolicyVersion(snap.docs[0]);
        // Additional client-side validation: check if policy is still active
        const now = Timestamp.now();
        if (policy.dataEfetivaAte && policy.dataEfetivaAte.toMillis() < now.toMillis()) {
          callback(null);
        } else {
          callback(policy);
        }
      }
    },
    onError,
  );
}

/**
 * Get all policy versions (for history view)
 */
export async function getAllPolicyVersions(labId: string): Promise<PolicyVersion[]> {
  const q = query(policasCol(labId), where('deletadoEm', '==', null), orderBy('criadoEm', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map(mapDocToPolicyVersion);
}

// ──────────────────────────────────────────────────────────────────────────
// Privacy acceptance tracking
// ──────────────────────────────────────────────────────────────────────────

/**
 * Record user acceptance of privacy policy
 * Called via Cloud Function callable for audit-grade logging
 */
export async function recordAceite(
  userId: string,
  labId: string,
  policyVersionId: string,
  policyVersao: string,
  ipAddr: string,
  userAgent: string,
): Promise<string> {
  const callable = httpsCallable(functions, 'recordPrivacyAceite');
  const result: any = await callable({
    userId,
    labId,
    policyVersionId,
    policyVersao,
    ipAddr,
    userAgent,
  });
  return result.data.aceitesId;
}

/**
 * Check if user already accepted current policy version
 */
export async function getUserCurrentAcceptance(
  userId: string,
  policyVersionId: string,
): Promise<PrivacyAceite | null> {
  const q = query(aceitesCol(userId), where('policyVersionId', '==', policyVersionId), limit(1));

  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapDocToAceite(snap.docs[0]);
}

/**
 * Get all user acceptances (for compliance records)
 */
export async function getUserAllAceites(userId: string): Promise<PrivacyAceite[]> {
  const q = query(aceitesCol(userId), orderBy('aceiteEm', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(mapDocToAceite);
}

// ──────────────────────────────────────────────────────────────────────────
// OTP (One-Time Password) for exclusão titular identity verification
// ──────────────────────────────────────────────────────────────────────────

/**
 * Request OTP for titular exclusion flow
 * Sends OTP to provided email via Cloud Function callable
 */
export async function sendOTP(email: string, labName: string): Promise<{ otpToken: string }> {
  const callable = httpsCallable(functions, 'sendOTP');
  const result: any = await callable({ email, labName });
  return {
    otpToken: result.data.otpToken,
  };
}

/**
 * Verify OTP (called implicitly by deleteTitularData CF)
 * Not exposed directly to client; deleteTitularData CF validates OTP
 */

// ──────────────────────────────────────────────────────────────────────────
// PII Deletion (LGPD Art. 18)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Trigger PII deletion via Cloud Function callable
 * Zeros PII fields (nome, email, telefone, endereco)
 * Preserves audit chain-hash and all other data
 */
export async function deleteTitularData(request: {
  cpf: string;
  otp: string;
  otpToken: string;
  motivo: string;
}): Promise<{ deletedDocCount: number; auditRecordId: string }> {
  const callable = httpsCallable(functions, 'deleteTitularData');
  const result: any = await callable(request);
  return {
    deletedDocCount: result.data.deletedDocCount,
    auditRecordId: result.data.auditRecordId,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Deprecated client-side write functions
// (kept for rollback compatibility, will be removed after 1 sprint)
// ──────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Use saveDPIA Cloud Function callable instead
 */
export async function createDPIA_deprecated(
  labId: string,
  dpia: Omit<DPIA, 'id' | 'labId' | 'criadoEm' | 'atualizadoEm'>,
): Promise<string> {
  console.warn('[lgpdService] createDPIA is deprecated — use saveDPIA instead');
  const ref = doc(dpiaCol(labId));
  await setDoc(ref, {
    ...dpia,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}
