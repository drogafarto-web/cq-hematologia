/**
 * validators.ts (server — insumoQualificacao)
 *
 * Schemas Zod + helpers de auth/access para callables de qualificação.
 *
 * Auth gate: caller precisa ser membro ativo do lab + role 'owner'/'admin'
 * (proxy para RT/biomedico — modelo de roles atual não tem RT explicit).
 * Issue conhecida: ver Output > "Issues conhecidas".
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const ACCESS_DENIED_MSG =
  'Sem permissão para qualificar insumos — apenas RT/biomedico do laboratório.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Valida (em ordem):
 *   1. Caller autenticado
 *   2. `auth_time` < `maxReauthAgeSec` (default 600s = 10min) — força reauth
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *   4. Caller tem role 'owner' ou 'admin'
 *
 * Retorna o member doc para o caller usar (role, displayName).
 */
export async function assertQualificacaoAccess(
  auth: AuthDataLite | undefined,
  labId: string,
  opts?: { maxReauthAgeSec?: number; requireFreshAuth?: boolean },
): Promise<{ uid: string; role: string }> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const uid = auth.uid;

  // 1. Reauth window — token claim auth_time é unix seconds.
  if (opts?.requireFreshAuth !== false) {
    const authTime = Number(auth.token?.['auth_time'] ?? 0);
    const maxAge = opts?.maxReauthAgeSec ?? 600;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!authTime || nowSec - authTime > maxAge) {
      throw new HttpsError('failed-precondition', 'reauth-required');
    }
  }

  // 2. Membership ativa
  const memberSnap = await admin.firestore().doc(`labs/${labId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    throw new HttpsError('permission-denied', ACCESS_DENIED_MSG);
  }

  // 3. Role gate (RT/biomedico ⇒ owner/admin no modelo atual).
  const role = String(memberSnap.data()?.['role'] ?? '');
  if (role !== 'owner' && role !== 'admin') {
    throw new HttpsError('permission-denied', ACCESS_DENIED_MSG);
  }

  return { uid, role };
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const ApproveQualificacaoInputSchema = z.object({
  labId: z.string().min(1),
  qId: z.string().min(1),
  evidenciaRunIds: z.array(z.string().min(1)).default([]),
});
export type ApproveQualificacaoInput = z.infer<typeof ApproveQualificacaoInputSchema>;

export const ReproveQualificacaoInputSchema = z.object({
  labId: z.string().min(1),
  qId: z.string().min(1),
  motivoReprovacao: z.string().min(3).max(1000),
  notificarNotivisa: z.boolean().default(false),
});
export type ReproveQualificacaoInput = z.infer<typeof ReproveQualificacaoInputSchema>;

// ─── User lookup ─────────────────────────────────────────────────────────────

/**
 * Carrega displayName + cargo do user para gravar no doc de qualificação
 * como prova imutável de quem tomou a decisão. Cargo é lido de
 * users/{uid}.cargo se presente, ou cai pra `role` da membership como fallback.
 */
export async function loadOperadorInfo(
  uid: string,
  fallbackRole: string,
): Promise<{ nome: string; cargo: string }> {
  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  const data = userSnap.exists ? (userSnap.data() ?? {}) : {};
  const nome = String(data['displayName'] ?? data['email'] ?? uid);
  const cargo = String(data['cargo'] ?? fallbackRole);
  return { nome, cargo };
}
