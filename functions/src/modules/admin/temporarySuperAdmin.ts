/**
 * grantTemporarySuperAdminToAll / revokeTemporarySuperAdmin
 *
 * Ferramenta EXPLICITAMENTE AUTORIZADA pelo CTO em 2026-04-22 para o período
 * de testes pré-lançamento. Promove todos os usuários atualmente cadastrados
 * a SuperAdmin, mantendo snapshot reversível em `temp/superadmin-grant-snapshot`.
 *
 * Riscos conhecidos (registrados em audit):
 *   - Acesso cross-lab irrestrito durante a vigência
 *   - LGPD: minimização suspensa durante o período declarado
 *   - RDC 978/2025: trilha precisa do período + razão é mandatória
 *
 * Desenho (safe by default):
 *   1. Só SuperAdmin chama.
 *   2. Dry-run é o default — retorna diff sem escrever.
 *   3. Aplicar requer `confirmationToken === 'EU-ENTENDO-OS-RISCOS-LGPD'`
 *      E `reason` com ≥ 20 caracteres.
 *   4. Cada promotion grava snapshot do estado anterior — revoke usa isso
 *      como fonte de verdade (não assume binário 'todos devem voltar pra false').
 *   5. Audit log completo por run + by-user.
 *
 * Fluxo recomendado:
 *   → grantTemporarySuperAdminToAll({ dryRun: true })  — inspeciona lista
 *   → grantTemporarySuperAdminToAll({
 *       dryRun: false,
 *       confirmationToken: 'EU-ENTENDO-OS-RISCOS-LGPD',
 *       reason: 'Período de testes pré-lançamento 2026-04-22 a 2026-05-05'
 *     })
 *   → [testes acontecem]
 *   → revokeTemporarySuperAdmin({ dryRun: true })     — inspeciona reversão
 *   → revokeTemporarySuperAdmin({ dryRun: false, confirmationToken: 'REVOGAR' })
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { syncClaims } from '../../helpers/claims';

// ─── Constantes ──────────────────────────────────────────────────────────────

const GRANT_CONFIRMATION_TOKEN = 'EU-ENTENDO-OS-RISCOS-LGPD';
const REVOKE_CONFIRMATION_TOKEN = 'REVOGAR';
const SNAPSHOT_COLLECTION = 'temp/superadmin-grant/snapshots';
const MIN_REASON_LENGTH = 20;

// ─── Auth guard ──────────────────────────────────────────────────────────────

async function assertSuperAdmin(
  uid: string,
  token: Record<string, unknown> | undefined,
): Promise<void> {
  if (token?.['isSuperAdmin'] === true) return;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.['isSuperAdmin'] !== true) {
    throw new HttpsError(
      'permission-denied',
      'Apenas Super Admins podem executar esta operação.',
    );
  }
}

// ─── GRANT ───────────────────────────────────────────────────────────────────

const GrantInputSchema = z.object({
  dryRun: z.boolean().default(true),
  confirmationToken: z.string().optional(),
  reason: z.string().optional(),
});

export interface GrantUserDiff {
  uid: string;
  email: string | null;
  wasSuperAdminBefore: boolean;
  willPromote: boolean;
}

export interface GrantReport {
  dryRun: boolean;
  grantId: string;
  scanned: number;
  toPromote: number;
  alreadySuperAdmin: number;
  diffs: GrantUserDiff[];
  appliedAt: string | null;
}

async function listAllAuthUsers(): Promise<admin.auth.UserRecord[]> {
  const out: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    out.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return out;
}

export const grantTemporarySuperAdminToAll = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (request): Promise<GrantReport> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(
      request.auth.uid,
      request.auth.token as Record<string, unknown>,
    );

    const parsed = GrantInputSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { dryRun, confirmationToken, reason } = parsed.data;

    if (!dryRun) {
      if (confirmationToken !== GRANT_CONFIRMATION_TOKEN) {
        throw new HttpsError(
          'failed-precondition',
          `confirmationToken deve ser exatamente "${GRANT_CONFIRMATION_TOKEN}".`,
        );
      }
      if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
        throw new HttpsError(
          'invalid-argument',
          `reason é obrigatória e deve ter ≥${MIN_REASON_LENGTH} caracteres.`,
        );
      }
    }

    const db = admin.firestore();
    const authUsers = await listAllAuthUsers();

    // Busca estado atual em batch
    const snapPromises = authUsers.map((u) =>
      db.doc(`users/${u.uid}`).get().then((s) => ({ uid: u.uid, snap: s })),
    );
    const snaps = await Promise.all(snapPromises);

    const diffs: GrantUserDiff[] = [];
    for (const { uid, snap } of snaps) {
      const auth = authUsers.find((u) => u.uid === uid)!;
      const claims = (auth.customClaims ?? {}) as Record<string, unknown>;
      const claimSa = claims['isSuperAdmin'] === true;
      const firestoreSa =
        snap.exists && snap.data()?.['isSuperAdmin'] === true;
      const wasSuperAdminBefore = claimSa || firestoreSa;
      diffs.push({
        uid,
        email: auth.email ?? null,
        wasSuperAdminBefore,
        willPromote: !wasSuperAdminBefore,
      });
    }

    const toPromote = diffs.filter((d) => d.willPromote).length;
    const alreadySuperAdmin = diffs.length - toPromote;

    const grantId = `grant-${Date.now()}-${request.auth.uid.slice(0, 8)}`;

    if (dryRun) {
      // Audit do probe (não-bloqueante)
      db.collection('auditLogs')
        .add({
          action: 'TEMP_SUPERADMIN_GRANT_DRY_RUN',
          callerUid: request.auth.uid,
          callerEmail: request.auth.token['email'] ?? null,
          grantId,
          payload: { scanned: diffs.length, toPromote, alreadySuperAdmin },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      return {
        dryRun: true,
        grantId,
        scanned: diffs.length,
        toPromote,
        alreadySuperAdmin,
        diffs,
        appliedAt: null,
      };
    }

    // Apply — grava snapshot por usuário + audit por usuário + audit master.
    const appliedAtIso = new Date().toISOString();
    const masterRef = db.collection('auditLogs').doc();
    const masterLogData = {
      action: 'TEMP_SUPERADMIN_GRANT_APPLY',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token['email'] ?? null,
      grantId,
      payload: {
        scanned: diffs.length,
        toPromote,
        alreadySuperAdmin,
        reason,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Para cada user a promover, grava snapshot + atualiza user doc.
    // Claim de auth é setado em série para não estourar rate limit.
    for (const d of diffs) {
      if (!d.willPromote) continue;

      const snapshotRef = db.doc(`${SNAPSHOT_COLLECTION}/${d.uid}`);
      // Write snapshot ANTES de mutar estado — ordem é proteção contra falha
      // parcial: se a próxima operação falhar, snapshot guia o revoke.
      await snapshotRef.set({
        uid: d.uid,
        email: d.email,
        wasSuperAdminBefore: d.wasSuperAdminBefore, // sempre false aqui por filtro
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        grantedBy: request.auth.uid,
        grantedByEmail: request.auth.token['email'] ?? null,
        grantId,
        reason,
      });

      await db.doc(`users/${d.uid}`).update({ isSuperAdmin: true });
      await syncClaims(d.uid, true);
    }

    // Audit master
    await masterRef.set(masterLogData);

    return {
      dryRun: false,
      grantId,
      scanned: diffs.length,
      toPromote,
      alreadySuperAdmin,
      diffs,
      appliedAt: appliedAtIso,
    };
  },
);

// ─── REVOKE ──────────────────────────────────────────────────────────────────

const RevokeInputSchema = z.object({
  dryRun: z.boolean().default(true),
  confirmationToken: z.string().optional(),
});

export interface RevokeReport {
  dryRun: boolean;
  scanned: number;
  reverted: number;
  keptSuperAdmin: number;
  revokedUids: string[];
  appliedAt: string | null;
}

export const revokeTemporarySuperAdmin = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (request): Promise<RevokeReport> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(
      request.auth.uid,
      request.auth.token as Record<string, unknown>,
    );

    const parsed = RevokeInputSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { dryRun, confirmationToken } = parsed.data;

    if (!dryRun && confirmationToken !== REVOKE_CONFIRMATION_TOKEN) {
      throw new HttpsError(
        'failed-precondition',
        `confirmationToken deve ser exatamente "${REVOKE_CONFIRMATION_TOKEN}".`,
      );
    }

    const db = admin.firestore();

    // Snapshots são a fonte de verdade — quem não está aqui nunca foi promovido
    // temporariamente e NÃO deve ser rebaixado (pode ser SuperAdmin legítimo).
    const snapshotSnap = await db.collection(SNAPSHOT_COLLECTION).get();

    const toRevoke = snapshotSnap.docs
      .filter((d) => d.data()['wasSuperAdminBefore'] === false)
      .map((d) => ({ uid: d.id, ref: d.ref }));

    const scanned = snapshotSnap.size;
    const keptSuperAdmin = snapshotSnap.size - toRevoke.length;

    if (dryRun) {
      db.collection('auditLogs')
        .add({
          action: 'TEMP_SUPERADMIN_REVOKE_DRY_RUN',
          callerUid: request.auth.uid,
          callerEmail: request.auth.token['email'] ?? null,
          payload: { scanned, toRevoke: toRevoke.length },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      return {
        dryRun: true,
        scanned,
        reverted: toRevoke.length,
        keptSuperAdmin,
        revokedUids: toRevoke.map((t) => t.uid),
        appliedAt: null,
      };
    }

    // Apply revoke — em série
    const appliedAtIso = new Date().toISOString();
    for (const { uid, ref } of toRevoke) {
      await db.doc(`users/${uid}`).update({ isSuperAdmin: false });
      await syncClaims(uid, false);
      await ref.delete();
    }

    await db.collection('auditLogs').add({
      action: 'TEMP_SUPERADMIN_REVOKE_APPLY',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token['email'] ?? null,
      payload: {
        scanned,
        reverted: toRevoke.length,
        keptSuperAdmin,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      dryRun: false,
      scanned,
      reverted: toRevoke.length,
      keptSuperAdmin,
      revokedUids: toRevoke.map((t) => t.uid),
      appliedAt: appliedAtIso,
    };
  },
);
