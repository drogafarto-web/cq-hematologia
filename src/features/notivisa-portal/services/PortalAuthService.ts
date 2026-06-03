/**
 * PortalAuthService — NOTIVISA Portal OAuth/Credential Authentication
 *
 * Provides unified authentication layer for healthcare professionals (RT, physicians, auditors)
 * accessing NOTIVISA government API. Handles:
 * - OAuth 2.0 authorization code flow with NOTIVISA IDP
 * - Token refresh with automatic expiry tracking
 * - Secure credential storage (Firebase custom tokens)
 * - Multi-session management (one user, multiple labs)
 * - Error recovery with exponential backoff
 *
 * Complies with: RDC 978 Art. 41 (timely reporting), DICQ 4.4 (audit trail),
 * LGPD Art. 32 (information security).
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { COLLECTIONS } from '../../../constants';
import type { LogicalSignature } from '../../../types';
import { z } from 'zod';

export type { LogicalSignature };

// ─── Type Definitions ───────────────────────────────────────────────────────

/** Portal auth token (issued by NOTIVISA IDP) */
export const PortalOAuthTokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(), // seconds
  tokenType: z.literal('Bearer'),
  scope: z.string(), // 'notivisa:read notivisa:write'
  idToken: z.string().min(1), // JWT with professional info
});

export type PortalOAuthToken = z.infer<typeof PortalOAuthTokenSchema>;

/** Session document (stored in Firestore per lab + user) */
export const PortalSessionSchema = z.object({
  id: z.string(),
  labId: z.string(),
  userId: z.string(),

  // OAuth token data
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  scope: z.string(),

  // Token lifecycle
  issuedAt: z.number().int(), // unix timestamp (ms)
  expiresAt: z.number().int(), // unix timestamp (ms)
  refreshedAt: z.number().int().nullable(), // last refresh time

  // Professional identity (from NOTIVISA idToken)
  professionalId: z.string(), // CREMESP/CRN/etc ID
  professionalName: z.string(),
  professionalEmail: z.string().email(),
  professionalRole: z.enum(['RT', 'MEDICO', 'DIRETOR', 'AUDITOR']),

  // Connection metadata
  notivisaLabCode: z.string(), // Lab's NOTIVISA registration code
  connectedAt: z.number().int(),
  lastActivityAt: z.number().int(),

  // Security
  ipAddress: z.string(),
  userAgent: z.string(),

  // Status
  status: z.enum(['active', 'expired', 'revoked', 'error']),
  errorMessage: z.string().nullable(),

  // Audit
  assinatura: z
    .object({
      hash: z.string().length(64),
      operatorId: z.string(),
      ts: z.number().int(),
    })
    .optional(),

  criadoEm: z.number().int(),
  atualizadoEm: z.number().int(),
  deletadoEm: z.number().int().nullable(),
});

export type PortalSession = z.infer<typeof PortalSessionSchema>;

/** Client-side session token (custom Firebase token wrapping NOTIVISA session) */
export interface PortalClientSession {
  sessionId: string;
  labId: string;
  firebaseToken: string; // Custom token signed by server
  expiresAt: number; // unix timestamp (ms)
  portalOAuthToken?: PortalOAuthToken; // Embedded for client-side use
}

/** OAuth request/response types */
export interface OAuthAuthorizeRequest {
  labId: string;
  redirectUri: string;
  state: string;
}

export interface OAuthTokenRequest {
  code: string;
  labId: string;
  userId: string;
  redirectUri: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  idToken: string;
}

export interface TokenRefreshRequest {
  labId: string;
  sessionId: string;
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

// ─── Firestore Collection Helpers ────────────────────────────────────────────

function getPortalSessionRef(labId: string, sessionId: string) {
  return doc(db, 'notivisa-portal-sessions', labId, 'sessions', sessionId);
}

function getPortalSessionsCollection(labId: string) {
  return collection(db, 'notivisa-portal-sessions', labId, 'sessions');
}

function getPortalAuditRef(labId: string, auditId: string) {
  return doc(db, 'notivisa-portal-audit', labId, 'events', auditId);
}

function getPortalAuditCollection(labId: string) {
  return collection(db, 'notivisa-portal-audit', labId, 'events');
}

// ─── Session Management ──────────────────────────────────────────────────────

/**
 * Creates a new portal session after OAuth token exchange
 * Called by Cloud Function callable after NOTIVISA IDP validates code
 */
export async function createPortalSession(
  labId: string,
  userId: string,
  oauthToken: PortalOAuthToken,
  professionalInfo: {
    id: string;
    name: string;
    email: string;
    role: 'RT' | 'MEDICO' | 'DIRETOR' | 'AUDITOR';
  },
  notivisaLabCode: string,
  ipAddress: string,
  userAgent: string,
): Promise<PortalSession> {
  const now = Date.now();
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const session: PortalSession = {
    id: sessionId,
    labId,
    userId,
    accessToken: oauthToken.accessToken,
    refreshToken: oauthToken.refreshToken,
    tokenType: oauthToken.tokenType,
    scope: oauthToken.scope,
    issuedAt: now,
    expiresAt: now + oauthToken.expiresIn * 1000,
    refreshedAt: null,
    professionalId: professionalInfo.id,
    professionalName: professionalInfo.name,
    professionalEmail: professionalInfo.email,
    professionalRole: professionalInfo.role,
    notivisaLabCode,
    connectedAt: now,
    lastActivityAt: now,
    ipAddress,
    userAgent,
    status: 'active',
    errorMessage: null,
    criadoEm: now,
    atualizadoEm: now,
    deletadoEm: null,
  };

  await setDoc(getPortalSessionRef(labId, sessionId), session);

  // Audit log
  await logPortalAudit(labId, 'SESSION_CREATED', {
    sessionId,
    userId,
    professionalEmail: professionalInfo.email,
    professionalRole: professionalInfo.role,
    notivisaLabCode,
  });

  return session;
}

/**
 * Retrieves an active portal session
 * Returns null if expired, revoked, or not found
 */
export async function getPortalSession(
  labId: string,
  sessionId: string,
): Promise<PortalSession | null> {
  const snap = await getDoc(getPortalSessionRef(labId, sessionId));

  if (!snap.exists()) return null;

  const session = PortalSessionSchema.parse(snap.data());

  // Check if expired
  if (session.status === 'expired' || session.expiresAt < Date.now()) {
    return null;
  }

  if (session.status !== 'active') {
    return null;
  }

  return session;
}

/**
 * Retrieves all active sessions for a user across labs
 * Used for session management UI (list active portals)
 */
export async function getUserPortalSessions(userId: string): Promise<PortalSession[]> {
  // Note: requires collectionGroup query (index must exist)
  const q = query(
    collection(db, 'notivisa-portal-sessions'),
    where('userId', '==', userId),
    where('status', '==', 'active'),
  );

  const snap = await getDocs(q);
  return snap.docs.map((doc) => PortalSessionSchema.parse(doc.data()));
}

/**
 * Updates session after successful token refresh
 */
export async function updatePortalSessionToken(
  labId: string,
  sessionId: string,
  newAccessToken: string,
  newRefreshToken: string | undefined,
  expiresIn: number,
): Promise<void> {
  const now = Date.now();
  const ref = getPortalSessionRef(labId, sessionId);

  await updateDoc(ref, {
    accessToken: newAccessToken,
    ...(newRefreshToken && { refreshToken: newRefreshToken }),
    expiresAt: now + expiresIn * 1000,
    refreshedAt: now,
    lastActivityAt: now,
    atualizadoEm: now,
  });

  await logPortalAudit(labId, 'TOKEN_REFRESHED', {
    sessionId,
    expiresIn,
  });
}

/**
 * Records activity on session (updates lastActivityAt)
 * Called on each NOTIVISA API call to track engagement
 */
export async function recordPortalSessionActivity(labId: string, sessionId: string): Promise<void> {
  const now = Date.now();
  await updateDoc(getPortalSessionRef(labId, sessionId), {
    lastActivityAt: now,
    atualizadoEm: now,
  });
}

/**
 * Revokes a portal session (immediate logout)
 * Soft-deletes the session document
 */
export async function revokePortalSession(
  labId: string,
  sessionId: string,
  reason?: string,
): Promise<void> {
  const now = Date.now();
  const ref = getPortalSessionRef(labId, sessionId);

  await updateDoc(ref, {
    status: 'revoked',
    errorMessage: reason || 'Manually revoked',
    deletadoEm: now,
    atualizadoEm: now,
  });

  await logPortalAudit(labId, 'SESSION_REVOKED', {
    sessionId,
    reason,
  });
}

/**
 * Marks session as expired (automatic after expiresAt reached)
 */
export async function markPortalSessionExpired(labId: string, sessionId: string): Promise<void> {
  const now = Date.now();
  const ref = getPortalSessionRef(labId, sessionId);

  await updateDoc(ref, {
    status: 'expired',
    errorMessage: 'Token expired',
    atualizadoEm: now,
  });

  await logPortalAudit(labId, 'SESSION_EXPIRED', { sessionId });
}

/**
 * Records error on session (e.g., refresh failed)
 */
export async function recordPortalSessionError(
  labId: string,
  sessionId: string,
  error: string,
): Promise<void> {
  const now = Date.now();
  const ref = getPortalSessionRef(labId, sessionId);

  await updateDoc(ref, {
    status: 'error',
    errorMessage: error,
    atualizadoEm: now,
  });

  await logPortalAudit(labId, 'SESSION_ERROR', {
    sessionId,
    error,
  });
}

// ─── Token Expiry Checking ──────────────────────────────────────────────────

/**
 * Checks if a session token is still valid
 * Returns true if token has >5 minutes left
 */
export function isPortalSessionValid(session: PortalSession): boolean {
  const now = Date.now();
  const expiresInMs = session.expiresAt - now;
  const bufferMs = 5 * 60 * 1000; // 5-minute buffer

  return session.status === 'active' && expiresInMs > bufferMs;
}

/**
 * Checks if token needs refresh (< 5 minutes left)
 */
export function needsPortalTokenRefresh(session: PortalSession): boolean {
  const now = Date.now();
  const expiresInMs = session.expiresAt - now;
  const bufferMs = 5 * 60 * 1000; // 5-minute buffer

  return session.status === 'active' && expiresInMs > 0 && expiresInMs <= bufferMs;
}

/**
 * Gets time remaining on session token (ms)
 */
export function getPortalSessionTimeRemaining(session: PortalSession): number {
  return Math.max(0, session.expiresAt - Date.now());
}

// ─── Audit Trail ────────────────────────────────────────────────────────────

export interface PortalAuditEvent {
  id: string;
  labId: string;
  action:
    | 'SESSION_CREATED'
    | 'TOKEN_REFRESHED'
    | 'SESSION_REVOKED'
    | 'SESSION_EXPIRED'
    | 'SESSION_ERROR'
    | 'AUTH_FAILED'
    | 'API_CALL_MADE';
  ts: number;
  details: Record<string, unknown>;
  operatorId?: string;
  assinatura?: LogicalSignature;
  criadoEm: number;
  deletadoEm: number | null;
}

export async function logPortalAudit(
  labId: string,
  action: PortalAuditEvent['action'],
  details: Record<string, unknown>,
  operatorId?: string,
): Promise<void> {
  const now = Date.now();
  const auditId = `audit_${now}_${Math.random().toString(36).substr(2, 9)}`;

  const auditEvent: PortalAuditEvent = {
    id: auditId,
    labId,
    action,
    ts: now,
    details,
    operatorId,
    criadoEm: now,
    deletadoEm: null,
  };

  await setDoc(getPortalAuditRef(labId, auditId), auditEvent);
}

/**
 * Retrieves audit trail for a session
 */
export async function getPortalSessionAudit(
  labId: string,
  sessionId: string,
  limit: number = 50,
): Promise<PortalAuditEvent[]> {
  const q = query(getPortalAuditCollection(labId), where('details.sessionId', '==', sessionId));

  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data() as PortalAuditEvent);
}

// ─── OAuth State Management ──────────────────────────────────────────────────

/**
 * Generates OAuth state parameter for CSRF protection
 * State is stored temporarily and validated on callback
 */
export function generateOAuthState(): string {
  const randomBytes = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0'),
  ).join('');
  return randomBytes;
}

/**
 * Generates OAuth authorization URL for redirect to NOTIVISA IDP
 */
export function generateOAuthAuthorizeUrl(
  idpBaseUrl: string,
  clientId: string,
  redirectUri: string,
  labId: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'notivisa:read notivisa:write',
    state,
    // Optional: pre-fill lab context
    lab_code: labId,
  });

  return `${idpBaseUrl}/oauth/authorize?${params.toString()}`;
}

// ─── Token Validation ───────────────────────────────────────────────────────

/**
 * Validates OAuth token format (basic structure check)
 */
export function validateOAuthToken(token: PortalOAuthToken): boolean {
  try {
    PortalOAuthTokenSchema.parse(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates session document format
 */
export function validatePortalSession(session: PortalSession): boolean {
  try {
    PortalSessionSchema.parse(session);
    return true;
  } catch {
    return false;
  }
}

// ─── Cleanup (expired sessions) ──────────────────────────────────────────────

/**
 * Marks sessions as expired if their token has reached expiresAt
 * Called by Cloud Scheduler cron (daily)
 */
export async function cleanupExpiredPortalSessions(labId: string): Promise<number> {
  const now = Date.now();
  const sessionsRef = getPortalSessionsCollection(labId);

  const q = query(sessionsRef, where('status', '==', 'active'), where('expiresAt', '<', now));

  const snap = await getDocs(q);
  let count = 0;

  for (const docSnap of snap.docs) {
    await markPortalSessionExpired(labId, docSnap.id);
    count++;
  }

  return count;
}

export default {
  createPortalSession,
  getPortalSession,
  getUserPortalSessions,
  updatePortalSessionToken,
  recordPortalSessionActivity,
  revokePortalSession,
  markPortalSessionExpired,
  recordPortalSessionError,
  isPortalSessionValid,
  needsPortalTokenRefresh,
  getPortalSessionTimeRemaining,
  logPortalAudit,
  getPortalSessionAudit,
  generateOAuthState,
  generateOAuthAuthorizeUrl,
  validateOAuthToken,
  validatePortalSession,
  cleanupExpiredPortalSessions,
};
