/**
 * contextCapture.ts
 *
 * Extract operation context from Cloud Function request.
 * Used by audit trail to record metadata about who did what, when, where.
 *
 * RDC 978 Art. 107 — Operation context required for audit trail
 */

import type { CallableRequest } from 'firebase-functions/v2/https';

/**
 * Full context of an audit operation
 * Immutable once created
 */
export interface AuditContext {
  operatorId: string; // From request.auth.uid
  labId: string; // Multi-tenant isolation
  timestamp: number; // ms since epoch
  action: 'create' | 'update' | 'delete' | 'export' | 'review';
  ip?: string; // From CF headers
  userAgent?: string; // From CF headers
  moduleId: string; // Which module?
  recordId: string; // Which record?
  before?: Record<string, unknown>; // Snapshot before change
  after?: Record<string, unknown>; // Snapshot after change
}

/**
 * Extract context from a Cloud Function callable request
 * Assumes request is authenticated (auth.uid exists)
 */
export function captureContext(req: CallableRequest<any>): AuditContext {
  const operatorId = req.auth?.uid ?? 'unknown';
  const labId = req.data?.labId ?? '';
  const timestamp = Date.now();

  // Infer action from function caller or explicit action field
  let action: AuditContext['action'] = 'create';
  if (
    req.data?.action &&
    ['create', 'update', 'delete', 'export', 'review'].includes(req.data.action)
  ) {
    action = req.data.action;
  }

  // Extract IP and User-Agent from request headers
  // Cloud Functions pass these via rawRequest (in v2 HTTPS)
  let ip: string | undefined;
  let userAgent: string | undefined;

  // In v2 functions, headers are in req.rawRequest?.headers
  // Fallback to checking request context if available
  if ((req as any).rawRequest?.headers) {
    ip =
      (req as any).rawRequest.headers['x-forwarded-for'] ||
      (req as any).rawRequest.headers['cf-connecting-ip'] ||
      (req as any).rawRequest.socket?.remoteAddress;
    userAgent = (req as any).rawRequest.headers['user-agent'];
  }

  const moduleId = req.data?.moduleId ?? '';
  const recordId = req.data?.recordId ?? '';
  const before = req.data?.before;
  const after = req.data?.after;

  return {
    operatorId,
    labId,
    timestamp,
    action,
    ip,
    userAgent,
    moduleId,
    recordId,
    before,
    after,
  };
}
