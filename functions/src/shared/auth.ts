/**
 * shared/auth — auth helpers for Cloud Functions callables
 *
 * Centralizes membership/role checks against `labs/{labId}/members/{uid}`
 * and against custom claims set by the admin module (`provisionModulesClaims`).
 */

import { db } from './firebase';

/**
 * Check if user is an active member of lab.
 * Reads `labs/{labId}/members/{uid}` and verifies `active === true`.
 */
export async function isActiveMemberOfLab(uid: string, labId: string): Promise<boolean> {
  if (!uid || !labId) return false;
  try {
    const memberDoc = await db.doc(`labs/${labId}/members/${uid}`).get();
    return memberDoc.exists && memberDoc.data()?.active === true;
  } catch {
    return false;
  }
}

/**
 * Check if user is an active member of lab AND has one of the allowed roles.
 * Roles are stored in the member doc (`role: 'admin' | 'rt' | 'qualidade' | ...`)
 * or via custom claims map (`token.modules?.[labId]?.roles`).
 */
export async function hasLabRole(
  uid: string,
  labId: string,
  allowedRoles: string[],
  claimsRoles?: string[],
): Promise<boolean> {
  if (claimsRoles && claimsRoles.some((r) => allowedRoles.includes(r))) {
    return true;
  }
  if (!uid || !labId) return false;
  try {
    const memberDoc = await db.doc(`labs/${labId}/members/${uid}`).get();
    if (!memberDoc.exists || memberDoc.data()?.active !== true) return false;
    const role = memberDoc.data()?.role as string | undefined;
    return !!role && allowedRoles.includes(role);
  } catch {
    return false;
  }
}
