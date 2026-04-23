import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { syncClaims, syncModuleClaims } from './helpers/claims';

// ─── emailBackup module ───────────────────────────────────────────────────────
// Re-export so Firebase CLI discovers scheduledDailyBackup and triggerLabBackup.
export { scheduledDailyBackup, triggerLabBackup } from './modules/emailBackup/index';

// ─── cqiReport module ────────────────────────────────────────────────────────
// Re-export so Firebase CLI discovers scheduledDailyCQIReport and triggerCQIReport.
export { scheduledDailyCQIReport, triggerCQIReport } from './modules/cqiReport/index';

// ─── firestoreBackup module ──────────────────────────────────────────────────
// Daily Firestore export to GCS + manual SuperAdmin trigger. Complements PITR.
export {
  scheduledFirestoreExport,
  triggerFirestoreExport_onCall as triggerFirestoreExport,
} from './modules/firestoreBackup/index';

// ─── insumos module ──────────────────────────────────────────────────────────
// Scheduled expiration: move insumos vencidos (validadeReal < now) de 'ativo'
// para 'vencido'. Manual trigger disponível para admin/owner do lab.
// Chain hash: trigger onDocumentCreated sela criptograficamente cada
// movimentação de insumo em ordem canônica (tamper-evidence RDC 978/2025).
// validateFR10: endpoint HTTP público consultado via QR do FR-10 impresso.
export {
  scheduledExpireInsumos,
  triggerInsumosExpiration,
  onInsumoMovimentacaoCreate,
  validateFR10,
  triggerBackfillInsumoModulos,
} from './modules/insumos/index';

// ─── equipamentos module (Fase D — 2026-04-21) ───────────────────────────────
// triggerMigrateSetupsToEquipamentos: migra setups legados (docId=module) pra
// Equipamento como entidade de primeira classe + setup com docId=equipamentoId.
// SuperAdmin-only, idempotente, dryRun disponível.
// scheduledCleanupEquipamentosExpirados: deleta equipamentos aposentados com
// retencaoAte < now (>5 anos) — RDC 786/2023 art. 42.
export {
  triggerMigrateSetupsToEquipamentos,
  scheduledCleanupEquipamentosExpirados,
  triggerCleanupEquipamentosExpirados,
} from './modules/equipamentos/index';

// ─── admin module (Onda 2 + onda superadmin temporário) ──────────────────────
// provisionModulesClaims: varre users e provisiona claim `modules` com dry-run.
// grantTemporarySuperAdminToAll / revokeTemporarySuperAdmin: ferramenta
// AUTORIZADA explicitamente para período de testes 2026-04-22. Snapshot
// reversível em `temp/superadmin-grant/snapshots`.
export { provisionModulesClaims } from './modules/admin/provisionModulesClaims';
export {
  grantTemporarySuperAdminToAll,
  revokeTemporarySuperAdmin,
} from './modules/admin/temporarySuperAdmin';

// ─── ciqAudit module (Onda 4) ────────────────────────────────────────────────
// Triggers onDocumentWritten em runs (hemato + imuno) e insumos — derivam
// CIQAuditEvent e gravam em `labs/{labId}/ciq-audit` com hash chain tamper-evident.
// Alimenta a Seção 3 do relatório operacional (anexo operacional do email diário).
export {
  onHematologiaRunAudit,
  onImunoRunAudit,
  onInsumoLifecycleAudit,
} from './modules/ciqAudit/index';

// ─── signatures module (Onda 5) ──────────────────────────────────────────────
// Dual-write de HMAC server-side em runs + movimentações. Divergências viram
// auditLogs. Rules endurecem após janela de observação (7-14 dias).
export {
  onHematologiaRunSignature,
  onImunoRunSignature,
  onMovimentacaoSignature,
} from './modules/signatures/index';

// ─── compliance module ───────────────────────────────────────────────────────
// Trigger onCreate em runs hematológicas revalida insumos declarados. Runs sem
// `complianceOverride` e com reagente vencido/reprovado/inativo recebem flag
// `complianceViolation` + audit log. Defesa em profundidade — UI valida mas o
// server é a fonte de verdade regulatória (RDC 978/2025 Art.128).
export { onHematologiaRunComplianceCheck } from './modules/compliance/index';

// All functions deploy to the same region as Firestore
setGlobalOptions({ region: 'southamerica-east1' });

// Initialize Admin SDK once — runtime may reuse warm instances
if (!admin.apps.length) {
  admin.initializeApp();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Checks custom claim first (fast, no Firestore read).
 * Falls back to Firestore for users created before syncClaims migration.
 */
async function assertSuperAdmin(uid: string, token?: Record<string, unknown>): Promise<void> {
  if (token?.isSuperAdmin === true) return;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.isSuperAdmin !== true) {
    throw new HttpsError(
      'permission-denied',
      'Acesso negado. Apenas Super Admins podem executar esta operação.',
    );
  }
}

/**
 * Checks that the caller is either a SuperAdmin OR an active admin/owner of
 * the given lab. Used to gate lab-scoped operations that lab admins should
 * also be able to perform (e.g. approving pending users).
 */
async function assertLabAdminOrSuperAdmin(
  uid: string,
  labId: string,
  token?: Record<string, unknown>,
): Promise<void> {
  if (token?.isSuperAdmin === true) return;
  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  if (userSnap.data()?.isSuperAdmin === true) return;

  const memberSnap = await admin.firestore().doc(`labs/${labId}/members/${uid}`).get();

  if (!memberSnap.exists || memberSnap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Acesso negado.');
  }
  const role = memberSnap.data()?.role;
  if (role !== 'admin' && role !== 'owner') {
    throw new HttpsError(
      'permission-denied',
      'Apenas administradores do laboratório podem executar esta operação.',
    );
  }
}

// ─── createUser ───────────────────────────────────────────────────────────────
// Creates a Firebase Auth user + Firestore document, optionally adding to a lab.
// Caller must be Super Admin. Current session is NOT disrupted.

const CreateUserInputSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  labId: z.string().optional(),
  role: z.enum(['admin', 'member']).optional(),
});

export const createUser = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = CreateUserInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }

  const { displayName, email, password, labId, role } = parsed.data;

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      // Admin-created accounts are pre-verified — the admin already validated
      // the email by creating the account manually. This avoids a verification
      // hurdle for users who receive their credentials from their lab admin.
      emailVerified: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('email-already-exists')) {
      throw new HttpsError('already-exists', 'Este e-mail já está cadastrado.');
    }
    throw new HttpsError('internal', `Falha ao criar usuário: ${msg}`);
  }

  const uid = userRecord.uid;
  const db = admin.firestore();
  const batch = db.batch();

  batch.set(db.doc(`users/${uid}`), {
    email,
    displayName,
    labIds: labId ? [labId] : [],
    roles: labId && role ? { [labId]: role } : {},
    isSuperAdmin: false,
    activeLabId: null,
    pendingLabId: null,
    disabled: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (labId && role) {
    batch.set(db.doc(`labs/${labId}/members/${uid}`), { role, active: true });
  }

  await batch.commit();

  // Audit — non-blocking
  db.collection('auditLogs')
    .add({
      action: 'CREATE_USER',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid: uid,
      targetEmail: email,
      labId: labId ?? null,
      payload: {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { uid };
});

// ─── setUserDisabled ──────────────────────────────────────────────────────────
// Disables (disabled=true) or enables (disabled=false) a Firebase Auth account.
// Disabling immediately revokes all active sessions via token revocation.

const SetUserDisabledInputSchema = z.object({
  uid: z.string().min(1),
  disabled: z.boolean(),
});

export const setUserDisabled = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = SetUserDisabledInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { uid, disabled } = parsed.data;

  if (uid === request.auth.uid) {
    throw new HttpsError('invalid-argument', 'Você não pode suspender sua própria conta.');
  }

  try {
    await admin.auth().updateUser(uid, { disabled });
    if (disabled) {
      await admin.auth().revokeRefreshTokens(uid);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('internal', `Falha ao atualizar conta: ${msg}`);
  }

  await admin.firestore().doc(`users/${uid}`).update({ disabled });

  admin
    .firestore()
    .collection('auditLogs')
    .add({
      action: disabled ? 'DISABLE_USER' : 'ENABLE_USER',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid: uid,
      payload: { disabled },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── setUserSuperAdmin ────────────────────────────────────────────────────────
// Promotes or demotes a user to/from Super Admin.
// Syncs custom claims so the new privilege is reflected in the next token refresh.

const SetUserSuperAdminSchema = z.object({
  targetUid: z.string().min(1),
  isSuperAdmin: z.boolean(),
});

export const setUserSuperAdmin = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = SetUserSuperAdminSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid, isSuperAdmin } = parsed.data;

  if (targetUid === request.auth.uid) {
    throw new HttpsError(
      'invalid-argument',
      'Você não pode alterar seu próprio nível de Super Admin.',
    );
  }

  // Update Firestore + sync custom claim atomically (serially is fine here)
  await admin.firestore().doc(`users/${targetUid}`).update({ isSuperAdmin });
  await syncClaims(targetUid, isSuperAdmin);

  admin
    .firestore()
    .collection('auditLogs')
    .add({
      action: isSuperAdmin ? 'PROMOTE_SUPERADMIN' : 'DEMOTE_SUPERADMIN',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      payload: { isSuperAdmin },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── addUserToLab ─────────────────────────────────────────────────────────────
// Adds a user as a member of a lab. Atomic batch write.

const AddUserToLabSchema = z.object({
  targetUid: z.string().min(1),
  labId: z.string().min(1),
  role: z.enum(['admin', 'member']),
});

export const addUserToLab = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = AddUserToLabSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid, labId, role } = parsed.data;
  const db = admin.firestore();
  const batch = db.batch();

  batch.set(db.doc(`labs/${labId}/members/${targetUid}`), { role, active: true });

  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }
  const userData = userSnap.data()!;
  const labIds = (userData.labIds ?? []) as string[];

  batch.update(db.doc(`users/${targetUid}`), {
    labIds: labIds.includes(labId) ? labIds : [...labIds, labId],
    [`roles.${labId}`]: role,
  });

  await batch.commit();

  db.collection('auditLogs')
    .add({
      action: 'ADD_TO_LAB',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload: { role },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── updateUserLabRole ────────────────────────────────────────────────────────
// Changes a lab member's role. Blocks demoting the owner.

const UpdateUserLabRoleSchema = z.object({
  targetUid: z.string().min(1),
  labId: z.string().min(1),
  role: z.enum(['admin', 'member']),
});

export const updateUserLabRole = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = UpdateUserLabRoleSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid, labId, role } = parsed.data;
  const db = admin.firestore();

  // Block demoting an owner
  const memberSnap = await db.doc(`labs/${labId}/members/${targetUid}`).get();
  if (memberSnap.exists && memberSnap.data()?.role === 'owner') {
    throw new HttpsError(
      'failed-precondition',
      'Não é possível rebaixar o proprietário do laboratório.',
    );
  }

  const batch = db.batch();
  batch.update(db.doc(`labs/${labId}/members/${targetUid}`), { role });
  batch.update(db.doc(`users/${targetUid}`), { [`roles.${labId}`]: role });
  await batch.commit();

  db.collection('auditLogs')
    .add({
      action: 'CHANGE_ROLE',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload: { role },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── removeUserFromLab ────────────────────────────────────────────────────────
// Removes a user from a lab. Atomic batch write.

const RemoveUserFromLabSchema = z.object({
  targetUid: z.string().min(1),
  labId: z.string().min(1),
});

export const removeUserFromLab = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = RemoveUserFromLabSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid, labId } = parsed.data;
  const db = admin.firestore();

  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  const userData = userSnap.data()!;
  const labIds = ((userData.labIds ?? []) as string[]).filter((id) => id !== labId);
  const roles = { ...(userData.roles ?? {}) };
  delete roles[labId];
  const updates: Record<string, unknown> = { labIds, roles };
  if (userData.activeLabId === labId) updates.activeLabId = null;

  const batch = db.batch();
  batch.delete(db.doc(`labs/${labId}/members/${targetUid}`));
  batch.update(db.doc(`users/${targetUid}`), updates);
  await batch.commit();

  db.collection('auditLogs')
    .add({
      action: 'REMOVE_FROM_LAB',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload: {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── deleteUser ───────────────────────────────────────────────────────────────
// Permanently deletes a Firebase Auth account + all Firestore data.
// Cascades to lab memberships across all labs.

const DeleteUserSchema = z.object({
  targetUid: z.string().min(1),
});

export const deleteUser = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = DeleteUserSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid } = parsed.data;

  if (targetUid === request.auth.uid) {
    throw new HttpsError('invalid-argument', 'Você não pode deletar sua própria conta.');
  }

  const db = admin.firestore();

  // Read user doc to get lab memberships before deleting
  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }
  const userData = userSnap.data()!;
  const targetEmail = userData.email as string;
  const labIds = (userData.labIds ?? []) as string[];

  // Delete Firebase Auth account first — point of no return
  try {
    await admin.auth().deleteUser(targetUid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('internal', `Falha ao deletar conta de autenticação: ${msg}`);
  }

  // Cascade: delete /labs/{labId}/members/{targetUid} for every lab
  const batch = db.batch();
  for (const labId of labIds) {
    batch.delete(db.doc(`labs/${labId}/members/${targetUid}`));
  }
  // Delete Firestore user document
  batch.delete(db.doc(`users/${targetUid}`));
  await batch.commit();

  // Audit — non-blocking
  db.collection('auditLogs')
    .add({
      action: 'DELETE_USER',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      targetEmail,
      payload: { labsRemoved: labIds },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── setModulesClaims ─────────────────────────────────────────────────────────
// Grants or revokes module access for a user by writing to Firebase Auth custom
// claims. Only Super Admins may call this function.
//
// Claim shape written:  { ...existingClaims, modules: { hematologia: true, ... } }
// Firestore mirror:     users/{uid}.modules  (read-only reference for UI — never
//                       use this for auth enforcement; always read the JWT claim)
//
// After a successful response the client MUST call:
//   await auth.currentUser.getIdToken(true)
// to force-refresh the JWT before attempting module-gated Firestore reads.

const SetModulesClaimsSchema = z.object({
  uid: z.string().min(1),
  modules: z.record(z.string(), z.boolean()),
});

export const setModulesClaims = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = SetModulesClaimsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }

  const { uid, modules } = parsed.data;

  // Verify the target user actually exists before touching claims
  try {
    await admin.auth().getUser(uid);
  } catch {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  // Mirror in Firestore for UI reference only (dashboard module tiles).
  // Authorization is enforced exclusively through the JWT custom claim.
  await admin.firestore().doc(`users/${uid}`).update({ modules });

  // Merge with existing claims (preserves isSuperAdmin + any future flags)
  await syncModuleClaims(uid, modules);

  admin
    .firestore()
    .collection('auditLogs')
    .add({
      action: 'SET_MODULE_CLAIMS',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid: uid,
      payload: { modules },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── Server-side secrets ──────────────────────────────────────────────────────

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const openRouterApiKey = defineSecret('OPENROUTER_API_KEY');

const GEMINI_DIRECT = 'gemini-3.1-flash-image-preview';
const OPENROUTER_GEMINI = 'google/gemini-2.0-flash-001';
const OPENROUTER_QWEN = 'qwen/qwen-vl-plus';

// ─── AI Service Helper ────────────────────────────────────────────────────────
// Logic for calling Gemini with failover to OpenRouter (Qwen)

/** Multimodal message part accepted by OpenRouter's chat completions endpoint. */
type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

/** Minimal shape of an OpenRouter chat.completions response we consume. */
interface OpenRouterChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

async function callAIWithFallback(params: {
  prompt: string;
  base64: string;
  mimeType: string;
  geminiKey: string;
  openRouterKey: string;
}): Promise<string> {
  const { prompt, base64, mimeType, geminiKey, openRouterKey } = params;
  const isPdf = mimeType === 'application/pdf';

  // ─── NÍVEL 1: Gemini Direto (GCP) ─────────────────────
  // Mais rápido e custo zero (enquanto houver cota)
  try {
    const genAI = new GoogleGenAI({ apiKey: geminiKey });
    const response = await genAI.models.generateContent({
      model: GEMINI_DIRECT,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
        },
      ],
      config: { responseMimeType: 'application/json' },
    });
    const text = response.text ?? '';
    if (text.trim()) {
      console.log('✅ Extração bem-sucedida: Nível 1 (Gemini Direto)');
      return text;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Nível 1 falhou: ${msg}. Tentando Nível 2...`);
  }

  // ─── NÍVEL 2: Gemini via OpenRouter ───────────────────
  // Mantém a qualidade e velocidade do Gemini usando saldo OpenRouter
  try {
    const content: OpenRouterContentPart[] = [{ type: 'text', text: prompt }];
    // Gemini no OpenRouter suporta PDFs nativamente ou via Vision em muitos casos.
    // Usaremos a estrutura multimodal padrão do OpenRouter.
    content.push(
      isPdf
        ? {
            type: 'file',
            file: {
              filename: 'document.pdf',
              file_data: `data:${mimeType};base64,${base64}`,
            },
          }
        : {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
    );

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_GEMINI,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as OpenRouterChatResponse;
      const text = data.choices?.[0]?.message?.content ?? '';
      if (text.trim()) {
        console.log('✅ Extração bem-sucedida: Nível 2 (Gemini OpenRouter)');
        return text;
      }
    } else {
      console.warn(`⚠️ Nível 2 retornou erro ${response.status}. Tentando Nível 3...`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Erro no Nível 2: ${msg}. Tentando Nível 3...`);
  }

  // ─── NÍVEL 3: Qwen VL via OpenRouter ──────────────────
  // Segurança máxima para OCR complexo (mais lento)
  try {
    const content: OpenRouterContentPart[] = [{ type: 'text', text: prompt }];

    if (isPdf) {
      content.push({
        type: 'file',
        file: {
          filename: 'document.pdf',
          file_data: `data:${mimeType};base64,${base64}`,
        },
      });
    } else {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` },
      });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_QWEN,
        messages: [{ role: 'user', content }],
        plugins: isPdf ? [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }] : [],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterChatResponse;
    const text = data.choices?.[0]?.message?.content ?? '';
    if (text.trim()) {
      console.log('✅ Extração bem-sucedida: Nível 3 (Qwen OpenRouter)');
      return text;
    }
    throw new Error('Retorno vazio do provedor Nível 3.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('internal', `Falha crítica em todos os níveis: ${msg}`);
  }
}

// ─── extractFromImage ─────────────────────────────────────────────────────────
// Callable function for OCR extraction from hematology analyzer screens.

// New schema: AI returns `values` (number|null per analyte) + `fieldConfidence`
// (categorical). A mapper inside the function converts back to the original
// {value, confidence, reasoning} shape so the frontend contract is unchanged.
const OcrResponseSchema = z.object({
  sampleId: z.string().nullable().optional(),
  values: z.record(z.string(), z.number().nullable()),
  fieldConfidence: z.record(z.string(), z.enum(['high', 'medium', 'low'])).optional(),
  overallConfidence: z.enum(['high', 'medium', 'low']).optional(),
});

const CONFIDENCE_MAP: Record<'high' | 'medium' | 'low', number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

const OCR_PROMPT = `
Você é um especialista em hematologia clínica e leitura de equipamentos automatizados, com foco no analisador Horiba Yumizen H550.

Você faz parte de um sistema profissional de Controle de Qualidade Laboratorial utilizado em rotinas reais de laboratório clínico.

--------------------------------------------------

🎯 OBJETIVO

Extrair com alta precisão os valores laboratoriais de uma imagem da tela do equipamento, retornando um JSON estruturado, confiável e validável.

Os dados serão utilizados para:
- Gráfico de Levey-Jennings
- Regras de Westgard
- Monitoramento de estabilidade analítica

Precisão é mais importante que completude.

--------------------------------------------------

🧭 ESTRUTURA DA TELA DO EQUIPAMENTO

A tela do Yumizen H550 é organizada em blocos fixos:

- TOPO: ID da amostra
- SUPERIOR ESQUERDO: RBC, HGB, HCT, VCM, HCM, CHCM, RDW-CV, RDW-SD
- SUPERIOR DIREITO: PLT, PCT, VPM, PDW
- INFERIOR: WBC + diferencial (NEU, LYM, MON, EOS, BASO)
  Cada linha do diferencial mostra: valor absoluto # | porcentagem %

Use este mapa espacial para desambiguar rótulos parcialmente ocluídos.

--------------------------------------------------

🔤 ALIASES DE RÓTULOS (interface pode estar em português)

A tela pode exibir abreviações portuguesas. Mapeie conforme abaixo:

  VCM   → MCV     (Volume Corpuscular Médio)
  HCM   → MCH     (Hemoglobina Corpuscular Média)
  CHCM  → MCHC    (Concentração de Hemoglobina Corpuscular Média)
  VPM   → MPV     (Volume Plaquetário Médio)
  BASO  → BAS#    (Basófilos — valor absoluto)

--------------------------------------------------

📏 REGRAS DE EXTRAÇÃO

1. FORMATO NUMÉRICO
   - Converter vírgula para ponto: 4,52 → 4.52

2. RDW (CRÍTICO)
   - Extrair SOMENTE RDW-CV (valor em %, primeira linha da dupla RDW)
   - Ignorar RDW-SD (segunda linha, em µm³)
   - Retornar sob a chave "RDW"

3. DIFERENCIAL LEUCOCITÁRIO (CRÍTICO)
   - Extrair SOMENTE os valores absolutos # (×10³/µL), coluna da esquerda
   - Ignorar completamente as porcentagens % (coluna da direita)
   - Se apenas % estiver visível → null
   - Retornar sob as chaves: NEU#, LYM#, MON#, EOS#, BAS#

4. CAMPOS ILEGÍVEIS
   - Retornar null e marcar confiança "low"

5. UNIDADES (não converter valores)
   - RBC → ×10⁶/µL
   - WBC e diferenciais → ×10³/µL

--------------------------------------------------

🚫 IGNORAR COMPLETAMENTE

O sistema utiliza sangue controle sintético.

NÃO extrair nem considerar:
- Flags (H, L, Hx, Lx, *, h*)
- Mensagens de interferência ou alertas clínicos
- Valores percentuais do diferencial
- RDW-SD

--------------------------------------------------

📊 PARÂMETROS A EXTRAIR

Eritrograma:  RBC, HGB, HCT, MCV, MCH, MCHC, RDW
Plaquetas:    PLT, MPV, PDW, PCT
Leucócitos:   WBC
Diferencial:  NEU#, LYM#, MON#, EOS#, BAS#
Outros:       NLR (se presente na tela)

--------------------------------------------------

🧠 AVALIAÇÃO DE QUALIDADE

Para cada campo extraído:
- "high"   → leitura clara e inequívoca
- "medium" → pequena dúvida (reflexo, ângulo, compressão de imagem)
- "low"    → difícil leitura ou incerteza real

--------------------------------------------------

📦 FORMATO DE SAÍDA (OBRIGATÓRIO)

Retorne apenas JSON válido, sem nenhum texto fora do JSON:

{
  "sampleId": "string | null",

  "values": {
    "RBC":  number | null,
    "HGB":  number | null,
    "HCT":  number | null,
    "MCV":  number | null,
    "MCH":  number | null,
    "MCHC": number | null,
    "RDW":  number | null,
    "PLT":  number | null,
    "MPV":  number | null,
    "PDW":  number | null,
    "PCT":  number | null,
    "WBC":  number | null,
    "NEU#": number | null,
    "LYM#": number | null,
    "MON#": number | null,
    "EOS#": number | null,
    "BAS#": number | null,
    "NLR":  number | null
  },

  "fieldConfidence": {
    "RBC":  "high | medium | low",
    "HGB":  "high | medium | low",
    "HCT":  "high | medium | low",
    "MCV":  "high | medium | low",
    "MCH":  "high | medium | low",
    "MCHC": "high | medium | low",
    "RDW":  "high | medium | low",
    "PLT":  "high | medium | low",
    "MPV":  "high | medium | low",
    "PDW":  "high | medium | low",
    "PCT":  "high | medium | low",
    "WBC":  "high | medium | low",
    "NEU#": "high | medium | low",
    "LYM#": "high | medium | low",
    "MON#": "high | medium | low",
    "EOS#": "high | medium | low",
    "BAS#": "high | medium | low",
    "NLR":  "high | medium | low"
  },

  "overallConfidence": "high | medium | low"
}

--------------------------------------------------

🚫 REGRAS PROIBIDAS

- Não misturar valores percentuais com absolutos
- Não inventar valores
- Não inferir dados ausentes
- Não retornar texto fora do JSON

--------------------------------------------------

🎯 FOCO FINAL

Se houver qualquer dúvida sobre um campo → retorne null.

A confiabilidade dos dados é mais importante que preencher todos os campos.
`.trim();

export const extractFromImage = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { base64, mimeType } = request.data as {
      base64: string;
      mimeType: string;
    };

    if (!base64?.trim()) {
      throw new HttpsError('invalid-argument', 'Nenhuma imagem fornecida.');
    }

    const geminiKeyValue = geminiApiKey.value();
    const openRouterKeyValue = openRouterApiKey.value();

    const rawText = await callAIWithFallback({
      prompt: OCR_PROMPT,
      base64,
      mimeType,
      geminiKey: geminiKeyValue,
      openRouterKey: openRouterKeyValue,
    });

    if (!rawText.trim()) {
      throw new HttpsError('internal', 'A IA retornou uma resposta vazia.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error('❌ Erro no JSON da IA:', rawText, err);
      throw new HttpsError(
        'internal',
        `A IA retornou JSON inválido: ${err instanceof Error ? err.message : 'formato desconhecido'}`,
      );
    }

    const validation = OcrResponseSchema.safeParse(parsed);
    if (!validation.success) {
      console.error('❌ Erro de validação OCR (Zod):', validation.error.format());
      throw new HttpsError('internal', `Dados OCR fora do formato: ${validation.error.message}`);
    }

    const { data } = validation;

    // Map new AI format → original frontend contract {value, confidence, reasoning}
    const results: Record<string, { value: number; confidence: number; reasoning: string }> = {};
    for (const [analyteId, rawValue] of Object.entries(data.values)) {
      if (rawValue === null) continue;
      const tier = data.fieldConfidence?.[analyteId];
      const overall = data.overallConfidence ?? 'n/a';
      results[analyteId] = {
        value: rawValue,
        confidence: tier ? CONFIDENCE_MAP[tier] : CONFIDENCE_MAP.low,
        reasoning: tier ? `${tier} (overall: ${overall})` : `low (overall: ${overall})`,
      };
    }

    if (Object.keys(results).length === 0) {
      throw new HttpsError('internal', 'Nenhum analito foi reconhecido na imagem.');
    }

    return {
      sampleId: data.sampleId ?? null,
      results,
    };
  },
);

// ─── analyzeImmunoStrip ───────────────────────────────────────────────────────
// Callable: lê foto de strip de imunoensaio e retorna resultado R/NR + confiança.
// A chave Gemini reside exclusivamente no backend — nunca exposta ao frontend.

const STRIP_RESULT_SCHEMA = z.object({
  resultado: z.enum(['R', 'NR']),
  confidence: z.enum(['high', 'medium', 'low']),
});

const ANALYZE_STRIP_INPUT_SCHEMA = z.object({
  base64: z.string().min(1, 'Imagem obrigatória.'),
  mimeType: z.string().min(1, 'mimeType obrigatório.'),
  testType: z.enum([
    'HCG',
    'BhCG',
    'HIV',
    'HBsAg',
    'Anti-HCV',
    'Sifilis',
    'Dengue',
    'COVID',
    'PCR',
    'Troponina',
  ]),
});

export const analyzeImmunoStrip = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    // Valida e tipifica o payload de entrada com Zod
    const inputValidation = ANALYZE_STRIP_INPUT_SCHEMA.safeParse(request.data);
    if (!inputValidation.success) {
      throw new HttpsError(
        'invalid-argument',
        `Payload inválido: ${inputValidation.error.message}`,
      );
    }

    const { base64, mimeType, testType } = inputValidation.data;

    const prompt = `Analise a imagem de um strip de imunoensaio do tipo ${testType}.

INSTRUÇÕES:
- R  = Reagente/Positivo  → duas linhas visíveis (controle + teste)
- NR = Não Reagente/Negativo → apenas uma linha visível (controle)

Avalie a qualidade da imagem para determinar o nível de confiança:
- high   = strip claramente visível, linhas nítidas
- medium = strip legível com pequenas imperfeições
- low    = imagem borrada, mal enquadrada ou strip danificado

Responda APENAS com JSON válido, sem markdown, sem explicações:
{ "resultado": "R" | "NR", "confidence": "high" | "medium" | "low" }`.trim();

    const rawText = await callAIWithFallback({
      prompt,
      base64,
      mimeType,
      geminiKey: geminiApiKey.value(),
      openRouterKey: openRouterApiKey.value(),
    });

    if (!rawText.trim()) {
      throw new HttpsError('internal', 'A IA retornou uma resposta vazia.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error('❌ analyzeImmunoStrip: JSON inválido da IA:', rawText, err);
      throw new HttpsError('internal', 'IA retornou resposta não-JSON.');
    }

    const validation = STRIP_RESULT_SCHEMA.safeParse(parsed);
    if (!validation.success) {
      console.error('❌ analyzeImmunoStrip: formato inválido (Zod):', validation.error.format());
      throw new HttpsError('internal', `Formato inválido da IA: ${validation.error.message}`);
    }

    console.log(
      `✅ analyzeImmunoStrip: ${testType} → ${validation.data.resultado} (${validation.data.confidence})`,
    );

    return {
      resultadoObtido: validation.data.resultado,
      confidence: validation.data.confidence,
    };
  },
);

// ─── extractFromBula ──────────────────────────────────────────────────────────
// Callable function for parsing manufacturer stats from PDF bulas.

const ANALYTE_IDS_ALL = [
  'WBC',
  'RBC',
  'HGB',
  'HCT',
  'MCV',
  'MCH',
  'MCHC',
  'PLT',
  'RDW',
  'MPV',
  'PCT',
  'PDW',
  'NEU#',
  'LYM#',
  'MON#',
  'EOS#',
  'BAS#',
].join(', ');

const BULA_PROMPT = `
Você é um especialista em interpretar bulas de controles hematológicos (package inserts).
Analise o documento PDF e extraia os valores esperados (média e desvio-padrão) para TODOS OS TRÊS NÍVEIS
do controle (Nível 1 = Baixo/Normal, Nível 2 = Normal/Elevado, Nível 3 = Alto/Elevado).

Analitos aceitos pelo sistema: ${ANALYTE_IDS_ALL}

Equipamentos — prioridade de extração:
1. PRIMEIRA ESCOLHA: Yumizen H550 ou Horiba ABX (qualquer variante)
2. FALLBACK: Se os valores do Yumizen H550 estiverem ausentes para um analito específico,
   use a coluna do Pentra ES 60, Pentra 60 ou Pentra XL (na ordem de preferência).
   Registre o equipamento de origem no campo "equipmentSource" do analito afetado.

Retorne um JSON com este formato EXATO:
{
  "controlName": "<nome comercial do controle ou null>",
  "expiryDate":  "<data de validade em YYYY-MM-DD ou null>",
  "levels": [
    {
      "level":     <1, 2 ou 3>,
      "lotNumber": "<número do lote deste nível ou null>",
      "analytes": [
        {
          "analyteId":       "<id exato do analito>",
          "mean":            <número>,
          "sd":              <número>,
          "equipmentSource": "<nome exato do equipamento de onde este valor foi lido, ex: 'Yumizen H550' ou 'Pentra 60'>"
        }
      ]
    }
  ]
}

Regras críticas:
- Inclua SEMPRE os três níveis no array "levels" (mesmo que um deles não tenha dados — nesse caso inclua "analytes": []).
- Ordene os níveis como [1, 2, 3].
- Use apenas os IDs exatos listados acima (ex: "WBC", "HGB", "NEU", "NEU#").
- Inclua apenas analitos com mean E sd claramente legíveis.
- Para metadados não encontrados, use null.
- Nunca invente valores. Se incerto, omita o analito do array.
- O campo "equipmentSource" é OBRIGATÓRIO em cada analito — registre sempre qual coluna/equipamento foi lido.
`.trim();

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const BulaAnalyteSchema = z.object({
  analyteId: z.string(),
  mean: z.number().positive(),
  sd: z.number().nonnegative(),
  equipmentSource: z.string().optional(),
});

const BulaLevelSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lotNumber: z.string().nullable().optional(),
  analytes: z.array(BulaAnalyteSchema),
});

const BulaResponseSchema = z.object({
  controlName: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  levels: z.array(BulaLevelSchema).min(1),
});

export const extractFromBula = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { base64, mimeType } = request.data as {
      base64: string;
      mimeType: string;
    };

    if (!base64?.trim()) {
      throw new HttpsError('invalid-argument', 'Nenhum arquivo fornecido.');
    }

    const geminiKeyValue = geminiApiKey.value();
    const openRouterKeyValue = openRouterApiKey.value();

    const rawText = await callAIWithFallback({
      prompt: BULA_PROMPT,
      base64,
      mimeType,
      geminiKey: geminiKeyValue,
      openRouterKey: openRouterKeyValue,
    });

    if (!rawText.trim()) {
      throw new HttpsError(
        'internal',
        'A IA retornou uma resposta vazia. Verifique se o documento é legível.',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error('❌ Erro no JSON da IA (Bula):', rawText, err);
      throw new HttpsError(
        'internal',
        `A IA retornou JSON inválido (Bula): ${err instanceof Error ? err.message : 'formato desconhecido'}`,
      );
    }

    const validation = BulaResponseSchema.safeParse(parsed);
    if (!validation.success) {
      console.error('❌ Erro de validação Bula (Zod):', validation.error.format());
      throw new HttpsError(
        'internal',
        `Dados da bula fora do formato: ${validation.error.message}`,
      );
    }

    return validation.data;
  },
);

// ─── approveUserForLab ────────────────────────────────────────────────────────
// Approves a pending Google OAuth user for a lab.
// Callable by lab admins/owners OR SuperAdmin.
//
// Flow:
//   1. Verify caller is lab admin/owner or SuperAdmin
//   2. Read pending_users/{labId}/users/{uid}
//   3. Create users/{uid} Firestore document
//   4. Set custom claims (role + tenantIds)
//   5. Mark emailVerified: true in Firebase Auth (admin already validated email)
//   6. Add to labs/{labId}/members/{uid}
//   7. Delete pending entry
//   8. Audit log

const ApproveUserInputSchema = z.object({
  labId: z.string().min(1),
  uid: z.string().min(1),
  assignedRole: z.enum(['admin', 'member']),
});

export const approveUserForLab = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const parsed = ApproveUserInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }

  const { labId, uid, assignedRole } = parsed.data;

  await assertLabAdminOrSuperAdmin(
    request.auth.uid,
    labId,
    request.auth.token as Record<string, unknown>,
  );

  const db = admin.firestore();

  // 1. Read pending entry
  const pendingRef = db.doc(`pending_users/${labId}/users/${uid}`);
  const pendingSnap = await pendingRef.get();

  if (!pendingSnap.exists) {
    throw new HttpsError('not-found', 'Usuário pendente não encontrado.');
  }

  const pending = pendingSnap.data()!;

  // 2. Check if user doc already exists (idempotency)
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();

  const batch = db.batch();

  if (!userSnap.exists) {
    batch.set(userRef, {
      email: pending.email ?? '',
      displayName: pending.displayName ?? pending.email ?? 'Usuário',
      labIds: [labId],
      roles: { [labId]: assignedRole },
      isSuperAdmin: false,
      activeLabId: null,
      pendingLabId: null,
      disabled: false,
      // emailVerified is managed on the Auth record below,
      // not stored redundantly in Firestore.
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });
  } else {
    // User doc exists — just add the new lab
    const existing = userSnap.data()!;
    const labIds = (existing.labIds ?? []) as string[];
    batch.update(userRef, {
      labIds: labIds.includes(labId) ? labIds : [...labIds, labId],
      [`roles.${labId}`]: assignedRole,
      pendingLabId: null,
    });
  }

  // 3. Add to lab members
  batch.set(db.doc(`labs/${labId}/members/${uid}`), {
    role: assignedRole,
    active: true,
  });

  // 4. Remove pending entry
  batch.delete(pendingRef);

  await batch.commit();

  // 5. Set custom claims — role + tenantIds array
  let existingClaims: Record<string, unknown> = {};
  try {
    const authUser = await admin.auth().getUser(uid);
    existingClaims = (authUser.customClaims ?? {}) as Record<string, unknown>;
  } catch {
    // User may not have claims yet — start fresh
  }

  const existingTenants = (existingClaims.tenantIds ?? []) as string[];
  await admin.auth().setCustomUserClaims(uid, {
    ...existingClaims,
    role: assignedRole,
    tenantIds: existingTenants.includes(labId) ? existingTenants : [...existingTenants, labId],
  });

  // 6. Mark emailVerified: true — admin validated the email by approving
  await admin.auth().updateUser(uid, { emailVerified: true });

  // 7. Audit log — non-blocking
  db.collection('auditLogs')
    .add({
      action: 'APPROVE_PENDING_USER',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid: uid,
      targetEmail: pending.email ?? null,
      labId,
      payload: { assignedRole },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── parseUrinaTira ───────────────────────────────────────────────────────────
// Callable: lê foto de tira reagente urinária e retorna os valores de cada
// analito (glicose, cetonas, proteína, nitrito, sangue, leucócitos, pH) com
// confiança individual. Bilirrubina, urobilinogênio e densidade NUNCA são
// processados — contraste ótico insuficiente, sempre manual.

const URO_OCR_RESULT_SCHEMA = z.object({
  glicose: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  cetonas: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  proteina: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  nitrito: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  sangue: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  leucocitos: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  ph: z.object({ valor: z.number().nullable(), confidence: z.number().min(0).max(1) }),
});

const PARSE_URINA_INPUT_SCHEMA = z.object({
  base64: z.string().min(1, 'Imagem obrigatória.'),
  mimeType: z.string().min(1, 'mimeType obrigatório.'),
});

export const parseUrinaTira = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const inputValidation = PARSE_URINA_INPUT_SCHEMA.safeParse(request.data);
    if (!inputValidation.success) {
      throw new HttpsError(
        'invalid-argument',
        `Payload inválido: ${inputValidation.error.message}`,
      );
    }

    const { base64, mimeType } = inputValidation.data;

    const prompt =
      `Você é um analista de controle de qualidade laboratorial. Leia a foto da tira reagente urinária comparando com o padrão de cores impresso no frasco/rótulo.

Parâmetros a identificar (7) com valores exatos:
- glicose:    "NEGATIVO" | "1+" | "2+" | "3+" | "4+"
- cetonas:    "NEGATIVO" | "TRACOS" | "1+" | "2+" | "3+"
- proteina:   "NEGATIVO" | "TRACOS" | "1+" | "2+" | "3+" | "4+"
- nitrito:    "NEGATIVO" | "PRESENTE"
- sangue:     "NEGATIVO" | "TRACOS" | "1+" | "2+" | "3+"
- leucocitos: "NEGATIVO" | "TRACOS" | "1+" | "2+" | "3+" | "4+"
- ph:         número entre 5.0 e 8.5 (múltiplo de 0.5)

NÃO processar: bilirrubina, urobilinogênio, densidade (ambíguos oticamente).

confidence: 0.95+ clara · 0.70-0.95 dúvida mínima · <0.70 ambíguo.
Se não puder ler um parâmetro, use { "valor": null, "confidence": 0 }.

Responda APENAS com JSON válido, sem markdown:
{
  "glicose": { "valor": "...", "confidence": 0..1 },
  "cetonas": { "valor": "...", "confidence": 0..1 },
  "proteina": { "valor": "...", "confidence": 0..1 },
  "nitrito": { "valor": "...", "confidence": 0..1 },
  "sangue": { "valor": "...", "confidence": 0..1 },
  "leucocitos": { "valor": "...", "confidence": 0..1 },
  "ph": { "valor": 5.0..8.5, "confidence": 0..1 }
}`.trim();

    const rawText = await callAIWithFallback({
      prompt,
      base64,
      mimeType,
      geminiKey: geminiApiKey.value(),
      openRouterKey: openRouterApiKey.value(),
    });

    if (!rawText.trim()) {
      throw new HttpsError('internal', 'A IA retornou uma resposta vazia.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error('❌ parseUrinaTira: JSON inválido da IA:', rawText, err);
      throw new HttpsError('internal', 'IA retornou resposta não-JSON.');
    }

    const validation = URO_OCR_RESULT_SCHEMA.safeParse(parsed);
    if (!validation.success) {
      console.error('❌ parseUrinaTira: formato inválido (Zod):', validation.error.format());
      throw new HttpsError('internal', `Formato inválido da IA: ${validation.error.message}`);
    }

    console.log('✅ parseUrinaTira: leitura bem-sucedida');

    return validation.data;
  },
);
