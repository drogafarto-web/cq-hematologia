/**
 * Snapshot legível do estado Auth + claims (para diagnóstico; não logar PII em produção).
 * Ative com import.meta.env.DEV ou localStorage hcq_firebase_diag=1
 */

import type { Auth, IdTokenResult } from 'firebase/auth';

export type DebugAuthStateReport = {
  uid: string | null;
  email: string | null;
  emailVerified: boolean | null;
  tokenIssuedAtIso: string | null;
  tokenExpirationIso: string | null;
  authTimeIso: string | null;
  signInProvider: string | null;
  /** Chaves top-level dos custom claims (evita dump completo em log). */
  customClaimKeys: string[];
  modulesClaim: Record<string, unknown> | null;
  modulesCeq: boolean | null;
};

function diagEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return globalThis.localStorage?.getItem('hcq_firebase_diag') === '1';
  } catch {
    return false;
  }
}

function safeModulesFromClaims(claims: Record<string, unknown>): Record<string, unknown> | null {
  const m = claims.modules;
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>;
  return null;
}

export async function debugAuthState(
  auth: Auth,
  forceRefresh = false,
): Promise<DebugAuthStateReport> {
  const u = auth.currentUser;
  if (!u) {
    return {
      uid: null,
      email: null,
      emailVerified: null,
      tokenIssuedAtIso: null,
      tokenExpirationIso: null,
      authTimeIso: null,
      signInProvider: null,
      customClaimKeys: [],
      modulesClaim: null,
      modulesCeq: null,
    };
  }

  let tr: IdTokenResult;
  try {
    tr = await u.getIdTokenResult(forceRefresh);
  } catch (e) {
    if (diagEnabled()) {
      console.info('[hcq debugAuthState] getIdTokenResult failed', e);
    }
    throw e;
  }

  const claims = (tr.claims ?? {}) as Record<string, unknown>;
  const modules = safeModulesFromClaims(claims);
  const ceqRaw = modules?.ceq;
  const modulesCeq = typeof ceqRaw === 'boolean' ? ceqRaw : null;

  const report: DebugAuthStateReport = {
    uid: u.uid,
    email: u.email,
    emailVerified: u.emailVerified,
    tokenIssuedAtIso: tr.issuedAtTime ? new Date(tr.issuedAtTime).toISOString() : null,
    tokenExpirationIso: tr.expirationTime ? new Date(tr.expirationTime).toISOString() : null,
    authTimeIso: u.metadata?.lastSignInTime
      ? new Date(u.metadata.lastSignInTime).toISOString()
      : null,
    signInProvider: u.providerData[0]?.providerId ?? null,
    customClaimKeys: Object.keys(claims).sort(),
    modulesClaim: modules,
    modulesCeq,
  };

  if (diagEnabled()) {
    console.info('[hcq debugAuthState]', {
      ...report,
      modulesClaim: report.modulesClaim ? '(object)' : null,
    });
  }

  return report;
}
