/**
 * provisionModulesClaims — callable SuperAdmin-only.
 *
 * Varre /users, deriva o mapa de `modules` a partir da memberships em
 * /labs/{labId}/members e grava o custom claim via Admin SDK. Idempotente:
 * se o claim já bate, não re-escreve. Dry-run disponível.
 *
 * Uso recomendado:
 *   1. `provisionModulesClaims({ dryRun: true })` — imprime diff no retorno
 *   2. `provisionModulesClaims({ dryRun: false })` — aplica
 *   3. `provisionModulesClaims({ dryRun: true })` novamente — espera "0 updates"
 *
 * Após 100% provisionado em produção, os 20 bypasses de
 * `!('modules' in request.auth.token)` em firestore.rules podem ser removidos
 * (vide firestore.rules.post-onda2).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { syncModuleClaims } from '../../helpers/claims';

// ─── Mapa role/lab → modules ─────────────────────────────────────────────────
//
// Todo membro ativo de um lab tem acesso aos módulos do HC Quality hoje:
// hematologia, imunologia, coagulacao, uroanalise, educacao-continuada,
// controle-temperatura. A gate real acontece no front via `hasModuleAccess()`
// — o claim só evita leitura cross-tenant.
//
// Para endurecer por role no futuro (ex: `operator` só vê hematologia),
// ajustar `deriveModules()` conforme a política — hoje é permissivo por design.

const ALL_MODULES = [
  'hematologia',
  'imunologia',
  'coagulacao',
  'uroanalise',
  'educacao-continuada',
  'controle-temperatura',
] as const;

type ModuleKey = (typeof ALL_MODULES)[number];
export type ModulesClaim = Record<ModuleKey, boolean>;

function fullAccess(): ModulesClaim {
  return {
    hematologia: true,
    imunologia: true,
    coagulacao: true,
    uroanalise: true,
    'educacao-continuada': true,
    'controle-temperatura': true,
  };
}

function noAccess(): ModulesClaim {
  return {
    hematologia: false,
    imunologia: false,
    coagulacao: false,
    uroanalise: false,
    'educacao-continuada': false,
    'controle-temperatura': false,
  };
}

function modulesEqual(a: Record<string, unknown>, b: ModulesClaim): boolean {
  for (const key of ALL_MODULES) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

async function assertSuperAdmin(
  uid: string,
  token: Record<string, unknown> | undefined,
): Promise<void> {
  if (token?.['isSuperAdmin'] === true) return;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.['isSuperAdmin'] !== true) {
    throw new HttpsError(
      'permission-denied',
      'Apenas Super Admins podem executar provisionamento de claims.',
    );
  }
}

// ─── Input schema ────────────────────────────────────────────────────────────

const ProvisionInputSchema = z.object({
  dryRun: z.boolean().default(true),
  /** Restringir a um único lab (provisiona só quem for membro ativo). */
  labId: z.string().optional(),
  /** Restringir a um único usuário (debug / correção pontual). */
  targetUid: z.string().optional(),
});

// ─── Output types ────────────────────────────────────────────────────────────

export interface ProvisionUserDiff {
  uid: string;
  email: string | null;
  labIds: string[];
  beforeModules: Record<string, unknown> | null; // null = sem claim
  afterModules: ModulesClaim;
  changed: boolean;
  reason: 'new-claim' | 'updated' | 'unchanged' | 'no-labs-skipped';
}

export interface ProvisionReport {
  dryRun: boolean;
  scanned: number;
  updated: number;
  unchanged: number;
  skipped: number;
  diffs: ProvisionUserDiff[];
  auditLogId: string | null;
}

// ─── Core ────────────────────────────────────────────────────────────────────

async function buildDiff(
  userRecord: admin.auth.UserRecord,
  userDocData: Record<string, unknown> | null,
  filterLabId: string | undefined,
): Promise<ProvisionUserDiff> {
  const uid = userRecord.uid;
  const email = userRecord.email ?? null;
  const claims = (userRecord.customClaims ?? {}) as Record<string, unknown>;
  const beforeModules =
    claims['modules'] && typeof claims['modules'] === 'object'
      ? (claims['modules'] as Record<string, unknown>)
      : null;

  const labIds = Array.isArray(userDocData?.['labIds'])
    ? (userDocData!['labIds'] as string[])
    : [];

  if (filterLabId && !labIds.includes(filterLabId)) {
    return {
      uid,
      email,
      labIds,
      beforeModules,
      afterModules: beforeModules
        ? (beforeModules as ModulesClaim)
        : noAccess(),
      changed: false,
      reason: 'no-labs-skipped',
    };
  }

  if (labIds.length === 0) {
    return {
      uid,
      email,
      labIds,
      beforeModules,
      afterModules: beforeModules
        ? (beforeModules as ModulesClaim)
        : noAccess(),
      changed: false,
      reason: 'no-labs-skipped',
    };
  }

  const desired = fullAccess();
  const reason: ProvisionUserDiff['reason'] = beforeModules === null ? 'new-claim' : 'updated';
  const changed =
    beforeModules === null || !modulesEqual(beforeModules, desired);

  return {
    uid,
    email,
    labIds,
    beforeModules,
    afterModules: desired,
    changed,
    reason: changed ? reason : 'unchanged',
  };
}

async function applyDiff(
  diff: ProvisionUserDiff,
): Promise<void> {
  if (!diff.changed) return;
  const db = admin.firestore();
  await db.doc(`users/${diff.uid}`).update({ modules: diff.afterModules });
  await syncModuleClaims(diff.uid, diff.afterModules);
}

// Firebase Auth `listUsers` pagina em 1000 por chamada.
async function listAllUsers(
  filterUid: string | undefined,
): Promise<admin.auth.UserRecord[]> {
  if (filterUid) {
    const user = await admin.auth().getUser(filterUid);
    return [user];
  }
  const out: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    out.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return out;
}

// ─── onCall ──────────────────────────────────────────────────────────────────

export const provisionModulesClaims = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (request): Promise<ProvisionReport> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(
      request.auth.uid,
      request.auth.token as Record<string, unknown>,
    );

    const parsed = ProvisionInputSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { dryRun, labId, targetUid } = parsed.data;

    const db = admin.firestore();

    // Coleta users em paralelo com auth listUsers (auth é fonte da verdade).
    const authUsers = await listAllUsers(targetUid);

    // Lookup de users docs em batches de 30 (limite `in` Firestore).
    const userDocs = new Map<string, Record<string, unknown> | null>();
    const uidChunks: string[][] = [];
    for (let i = 0; i < authUsers.length; i += 30) {
      uidChunks.push(authUsers.slice(i, i + 30).map((u) => u.uid));
    }
    await Promise.all(
      uidChunks.map(async (chunk) => {
        const refs = chunk.map((uid) => db.doc(`users/${uid}`));
        const snaps = await db.getAll(...refs);
        for (const snap of snaps) {
          userDocs.set(snap.id, snap.exists ? (snap.data() ?? null) : null);
        }
      }),
    );

    const diffs: ProvisionUserDiff[] = [];
    for (const userRecord of authUsers) {
      const docData = userDocs.get(userRecord.uid) ?? null;
      const diff = await buildDiff(userRecord, docData, labId);
      diffs.push(diff);
    }

    let updated = 0;
    let unchanged = 0;
    let skipped = 0;

    if (!dryRun) {
      // Aplica em série — safePath. Se precisar acelerar, pode paralelizar em
      // batches de 10.
      for (const diff of diffs) {
        if (diff.reason === 'no-labs-skipped') {
          skipped++;
          continue;
        }
        if (!diff.changed) {
          unchanged++;
          continue;
        }
        await applyDiff(diff);
        updated++;
      }
    } else {
      for (const diff of diffs) {
        if (diff.reason === 'no-labs-skipped') skipped++;
        else if (diff.changed) updated++;
        else unchanged++;
      }
    }

    // Audit log do run completo (não um por user — esse seria ruído).
    let auditLogId: string | null = null;
    const auditRef = await db.collection('auditLogs').add({
      action: dryRun ? 'PROVISION_MODULES_DRY_RUN' : 'PROVISION_MODULES_APPLY',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token['email'] ?? null,
      payload: {
        scanned: authUsers.length,
        updated,
        unchanged,
        skipped,
        labId: labId ?? null,
        targetUid: targetUid ?? null,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    auditLogId = auditRef.id;

    return {
      dryRun,
      scanned: authUsers.length,
      updated,
      unchanged,
      skipped,
      diffs,
      auditLogId,
    };
  },
);
