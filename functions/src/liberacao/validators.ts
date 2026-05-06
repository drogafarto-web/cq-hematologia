/**
 * validators.ts — schemas Zod + helpers de auth/access para callables liberacao
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const LIB_ACCESS_DENIED_MSG =
  'Sem permissão para este módulo — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Garante:
 *   1. Caller autenticado
 *   2. Caller tem claim modules['liberacao'] === true OU claim modules['criticos'] === true
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *   4. Caller tem role RT, RT-Substituto, ou Técnico
 */
export async function assertLiberacaoAccess(
  auth: AuthDataLite | undefined,
  labId: string,
  requiredRole?: 'RT' | 'RT-Substituto' | 'Técnico',
): Promise<{ uid: string; role: string }> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  // 1. Claim do módulo
  const modulesClaim = (auth.token?.['modules'] ?? {}) as Record<string, unknown>;
  const hasModule = modulesClaim['liberacao'] === true || modulesClaim['criticos'] === true;
  if (!hasModule) {
    console.error('[LIB_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'missing_module_claim',
      ts,
    });
    throw new HttpsError('permission-denied', LIB_ACCESS_DENIED_MSG);
  }

  // 2. Membership ativa no lab solicitado
  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${uid}`)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[LIB_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', LIB_ACCESS_DENIED_MSG);
  }

  // 3. Role check (optional)
  const role = memberSnap.data()?.['role'] as string | undefined;
  if (requiredRole && role !== requiredRole && role !== 'admin') {
    console.error('[LIB_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'role_mismatch',
      required: requiredRole,
      actual: role,
      ts,
    });
    throw new HttpsError('permission-denied', LIB_ACCESS_DENIED_MSG);
  }

  return { uid, role: role || 'unknown' };
}

/**
 * Garante RT ou RT-Substituto específico para liberação/assinatura
 */
export async function assertRTAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<string> {
  const { uid, role } = await assertLiberacaoAccess(auth, labId);

  if (role !== 'RT' && role !== 'RT-Substituto' && role !== 'admin') {
    console.error('[LIB_RT_DENIED]', {
      uid,
      labId,
      reason: 'not_rt',
      role,
    });
    throw new HttpsError('permission-denied', LIB_ACCESS_DENIED_MSG);
  }

  return uid;
}

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

export const SignaturePayloadSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/i, 'Hash deve ter 64 caracteres hexadecimais'),
  operatorId: z.string().min(1),
  timestamp: z.number().int().positive(),
});

export const CriarLaudoInputSchema = z.object({
  labId: z.string().min(1),
  runIds: z.array(z.string().min(1)).min(1),
  pacienteId: z.string().min(1),
  medicoSolicitanteId: z.string().min(1),
  exames: z.array(z.record(z.any())).min(1),
});

export const LiberarLaudoInputSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  signaturePayload: SignaturePayloadSchema,
  observacao: z.string().optional(),
});
