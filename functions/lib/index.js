"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveUserForLab = exports.extractFromBula = exports.analyzeImmunoStrip = exports.extractFromImage = exports.setModulesClaims = exports.deleteUser = exports.removeUserFromLab = exports.updateUserLabRole = exports.addUserToLab = exports.setUserSuperAdmin = exports.setUserDisabled = exports.createUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const genai_1 = require("@google/genai");
const zod_1 = require("zod");
const admin = require("firebase-admin");
const claims_1 = require("./helpers/claims");
// All functions deploy to the same region as Firestore
(0, v2_1.setGlobalOptions)({ region: 'southamerica-east1' });
// Initialize Admin SDK once — runtime may reuse warm instances
if (!admin.apps.length) {
    admin.initializeApp();
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Checks custom claim first (fast, no Firestore read).
 * Falls back to Firestore for users created before syncClaims migration.
 */
async function assertSuperAdmin(uid, token) {
    if (token?.isSuperAdmin === true)
        return;
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    if (!snap.exists || snap.data()?.isSuperAdmin !== true) {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado. Apenas Super Admins podem executar esta operação.');
    }
}
/**
 * Checks that the caller is either a SuperAdmin OR an active admin/owner of
 * the given lab. Used to gate lab-scoped operations that lab admins should
 * also be able to perform (e.g. approving pending users).
 */
async function assertLabAdminOrSuperAdmin(uid, labId, token) {
    if (token?.isSuperAdmin === true)
        return;
    const userSnap = await admin.firestore().doc(`users/${uid}`).get();
    if (userSnap.data()?.isSuperAdmin === true)
        return;
    const memberSnap = await admin
        .firestore()
        .doc(`labs/${labId}/members/${uid}`)
        .get();
    if (!memberSnap.exists || memberSnap.data()?.active !== true) {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado.');
    }
    const role = memberSnap.data()?.role;
    if (role !== 'admin' && role !== 'owner') {
        throw new https_1.HttpsError('permission-denied', 'Apenas administradores do laboratório podem executar esta operação.');
    }
}
// ─── createUser ───────────────────────────────────────────────────────────────
// Creates a Firebase Auth user + Firestore document, optionally adding to a lab.
// Caller must be Super Admin. Current session is NOT disrupted.
const CreateUserInputSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    labId: zod_1.z.string().optional(),
    role: zod_1.z.enum(['admin', 'member']).optional(),
});
exports.createUser = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(request.auth.uid, request.auth.token);
    const parsed = CreateUserInputSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { displayName, email, password, labId, role } = parsed.data;
    let userRecord;
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('email-already-exists')) {
            throw new https_1.HttpsError('already-exists', 'Este e-mail já está cadastrado.');
        }
        throw new https_1.HttpsError('internal', `Falha ao criar usuário: ${msg}`);
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
    db.collection('auditLogs').add({
        action: 'CREATE_USER',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid: uid,
        targetEmail: email,
        labId: labId ?? null,
        payload: {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
    return { uid };
});
// ─── setUserDisabled ──────────────────────────────────────────────────────────
// Disables (disabled=true) or enables (disabled=false) a Firebase Auth account.
// Disabling immediately revokes all active sessions via token revocation.
const SetUserDisabledInputSchema = zod_1.z.object({
    uid: zod_1.z.string().min(1),
    disabled: zod_1.z.boolean(),
});
exports.setUserDisabled = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(request.auth.uid, request.auth.token);
    const parsed = SetUserDisabledInputSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos.');
    }
    const { uid, disabled } = parsed.data;
    if (uid === request.auth.uid) {
        throw new https_1.HttpsError('invalid-argument', 'Você não pode suspender sua própria conta.');
    }
    try {
        await admin.auth().updateUser(uid, { disabled });
        if (disabled) {
            await admin.auth().revokeRefreshTokens(uid);
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new https_1.HttpsError('internal', `Falha ao atualizar conta: ${msg}`);
    }
    await admin.firestore().doc(`users/${uid}`).update({ disabled });
    admin.firestore().collection('auditLogs').add({
        action: disabled ? 'DISABLE_USER' : 'ENABLE_USER',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid: uid,
        payload: { disabled },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
    return { success: true };
});
// ─── setUserSuperAdmin ────────────────────────────────────────────────────────
// Promotes or demotes a user to/from Super Admin.
// Syncs custom claims so the new privilege is reflected in the next token refresh.
const SetUserSuperAdminSchema = zod_1.z.object({
    targetUid: zod_1.z.string().min(1),
    isSuperAdmin: zod_1.z.boolean(),
});
exports.setUserSuperAdmin = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(request.auth.uid, request.auth.token);
    const parsed = SetUserSuperAdminSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos.');
    }
    const { targetUid, isSuperAdmin } = parsed.data;
    if (targetUid === request.auth.uid) {
        throw new https_1.HttpsError('invalid-argument', 'Você não pode alterar seu próprio nível de Super Admin.');
    }
    // Update Firestore + sync custom claim atomically (serially is fine here)
    await admin.firestore().doc(`users/${targetUid}`).update({ isSuperAdmin });
    await (0, claims_1.syncClaims)(targetUid, isSuperAdmin);
    admin.firestore().collection('auditLogs').add({
        action: isSuperAdmin ? 'PROMOTE_SUPERADMIN' : 'DEMOTE_SUPERADMIN',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid,
        payload: { isSuperAdmin },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
    return { success: true };
});
// ─── addUserToLab ─────────────────────────────────────────────────────────────
// Adds a user as a member of a lab. Atomic batch write.
const AddUserToLabSchema = zod_1.z.object({
    targetUid: zod_1.z.string().min(1),
    labId: zod_1.z.string().min(1),
    role: zod_1.z.enum(['admin', 'member']),
});
exports.addUserToLab = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(request.auth.uid, request.auth.token);
    const parsed = AddUserToLabSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos.');
    }
    const { targetUid, labId, role } = parsed.data;
    const db = admin.firestore();
    const batch = db.batch();
    batch.set(db.doc(`labs/${labId}/members/${targetUid}`), { role, active: true });
    const userSnap = await db.doc(`users/${targetUid}`).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Usuário não encontrado.');
    }
    const userData = userSnap.data();
    const labIds = (userData.labIds ?? []);
    batch.update(db.doc(`users/${targetUid}`), {
        labIds: labIds.includes(labId) ? labIds : [...labIds, labId],
        [`roles.${labId}`]: role,
    });
    await batch.commit();
    db.collection('auditLogs').add({
        action: 'ADD_TO_LAB',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid,
        labId,
        payload: { role },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
    return { success: true };
});
// ─── updateUserLabRole ────────────────────────────────────────────────────────
// Changes a lab member's role. Blocks demoting the owner.
const UpdateUserLabRoleSchema = zod_1.z.object({
    targetUid: zod_1.z.string().min(1),
    labId: zod_1.z.string().min(1),
    role: zod_1.z.enum(['admin', 'member']),
});
exports.updateUserLabRole = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(request.auth.uid, request.auth.token);
    const parsed = UpdateUserLabRoleSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos.');
    }
    const { targetUid, labId, role } = parsed.data;
    const db = admin.firestore();
    // Block demoting an owner
    const memberSnap = await db.doc(`labs/${labId}/members/${targetUid}`).get();
    if (memberSnap.exists && memberSnap.data()?.role === 'owner') {
        throw new https_1.HttpsError('failed-precondition', 'Não é possível rebaixar o proprietário do laboratório.');
    }
    const batch = db.batch();
    batch.update(db.doc(`labs/${labId}/members/${targetUid}`), { role });
    batch.update(db.doc(`users/${targetUid}`), { [`roles.${labId}`]: role });
    await batch.commit();
    db.collection('auditLogs').add({
        action: 'CHANGE_ROLE',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid,
        labId,
        payload: { role },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
    return { success: true };
});
// ─── removeUserFromLab ────────────────────────────────────────────────────────
// Removes a user from a lab. Atomic batch write.
const RemoveUserFromLabSchema = zod_1.z.object({
    targetUid: zod_1.z.string().min(1),
    labId: zod_1.z.string().min(1),
});
exports.removeUserFromLab = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(request.auth.uid, request.auth.token);
    const parsed = RemoveUserFromLabSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos.');
    }
    const { targetUid, labId } = parsed.data;
    const db = admin.firestore();
    const userSnap = await db.doc(`users/${targetUid}`).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Usuário não encontrado.');
    }
    const userData = userSnap.data();
    const labIds = (userData.labIds ?? []).filter((id) => id !== labId);
    const roles = { ...(userData.roles ?? {}) };
    delete roles[labId];
    const updates = { labIds, roles };
    if (userData.activeLabId === labId)
        updates.activeLabId = null;
    const batch = db.batch();
    batch.delete(db.doc(`labs/${labId}/members/${targetUid}`));
    batch.update(db.doc(`users/${targetUid}`), updates);
    await batch.commit();
    db.collection('auditLogs').add({
        action: 'REMOVE_FROM_LAB',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid,
        labId,
        payload: {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
    return { success: true };
});
// ─── deleteUser ───────────────────────────────────────────────────────────────
// Permanently deletes a Firebase Auth account + all Firestore data.
// Cascades to lab memberships across all labs.
const DeleteUserSchema = zod_1.z.object({
    targetUid: zod_1.z.string().min(1),
});
exports.deleteUser = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(request.auth.uid, request.auth.token);
    const parsed = DeleteUserSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos.');
    }
    const { targetUid } = parsed.data;
    if (targetUid === request.auth.uid) {
        throw new https_1.HttpsError('invalid-argument', 'Você não pode deletar sua própria conta.');
    }
    const db = admin.firestore();
    // Read user doc to get lab memberships before deleting
    const userSnap = await db.doc(`users/${targetUid}`).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Usuário não encontrado.');
    }
    const userData = userSnap.data();
    const targetEmail = userData.email;
    const labIds = (userData.labIds ?? []);
    // Delete Firebase Auth account first — point of no return
    try {
        await admin.auth().deleteUser(targetUid);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new https_1.HttpsError('internal', `Falha ao deletar conta de autenticação: ${msg}`);
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
    db.collection('auditLogs').add({
        action: 'DELETE_USER',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid,
        targetEmail,
        payload: { labsRemoved: labIds },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
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
const SetModulesClaimsSchema = zod_1.z.object({
    uid: zod_1.z.string().min(1),
    modules: zod_1.z.record(zod_1.z.string(), zod_1.z.boolean()),
});
exports.setModulesClaims = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await assertSuperAdmin(request.auth.uid, request.auth.token);
    const parsed = SetModulesClaimsSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { uid, modules } = parsed.data;
    // Verify the target user actually exists before touching claims
    try {
        await admin.auth().getUser(uid);
    }
    catch {
        throw new https_1.HttpsError('not-found', 'Usuário não encontrado.');
    }
    // Mirror in Firestore for UI reference only (dashboard module tiles).
    // Authorization is enforced exclusively through the JWT custom claim.
    await admin.firestore().doc(`users/${uid}`).update({ modules });
    // Merge with existing claims (preserves isSuperAdmin + any future flags)
    await (0, claims_1.syncModuleClaims)(uid, modules);
    admin.firestore().collection('auditLogs').add({
        action: 'SET_MODULE_CLAIMS',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid: uid,
        payload: { modules },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
    return { success: true };
});
// ─── Server-side secrets ──────────────────────────────────────────────────────
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
const openRouterApiKey = (0, params_1.defineSecret)('OPENROUTER_API_KEY');
const GEMINI_DIRECT = 'gemini-3.1-flash-image-preview';
const OPENROUTER_GEMINI = 'google/gemini-2.0-flash-001';
const OPENROUTER_QWEN = 'qwen/qwen-vl-plus';
// ─── AI Service Helper ────────────────────────────────────────────────────────
// Logic for calling Gemini with failover to OpenRouter (Qwen)
async function callAIWithFallback(params) {
    const { prompt, base64, mimeType, geminiKey, openRouterKey } = params;
    const isPdf = mimeType === 'application/pdf';
    // ─── NÍVEL 1: Gemini Direto (GCP) ─────────────────────
    // Mais rápido e custo zero (enquanto houver cota)
    try {
        const genAI = new genai_1.GoogleGenAI({ apiKey: geminiKey });
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ Nível 1 falhou: ${msg}. Tentando Nível 2...`);
    }
    // ─── NÍVEL 2: Gemini via OpenRouter ───────────────────
    // Mantém a qualidade e velocidade do Gemini usando saldo OpenRouter
    try {
        const content = [{ type: 'text', text: prompt }];
        // Gemini no OpenRouter suporta PDFs nativamente ou via Vision em muitos casos.
        // Usaremos a estrutura multimodal padrão do OpenRouter.
        content.push({
            type: isPdf ? 'file' : 'image_url',
            [isPdf ? 'file' : 'image_url']: isPdf
                ? { filename: 'document.pdf', file_data: `data:${mimeType};base64,${base64}` }
                : { url: `data:${mimeType};base64,${base64}` },
        });
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: OPENROUTER_GEMINI,
                messages: [{ role: 'user', content }],
                response_format: { type: 'json_object' },
            }),
        });
        if (response.ok) {
            const data = (await response.json());
            const text = data.choices?.[0]?.message?.content ?? '';
            if (text.trim()) {
                console.log('✅ Extração bem-sucedida: Nível 2 (Gemini OpenRouter)');
                return text;
            }
        }
        else {
            console.warn(`⚠️ Nível 2 retornou erro ${response.status}. Tentando Nível 3...`);
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ Erro no Nível 2: ${msg}. Tentando Nível 3...`);
    }
    // ─── NÍVEL 3: Qwen VL via OpenRouter ──────────────────
    // Segurança máxima para OCR complexo (mais lento)
    try {
        const content = [{ type: 'text', text: prompt }];
        if (isPdf) {
            content.push({
                type: 'file',
                file: {
                    filename: 'document.pdf',
                    file_data: `data:${mimeType};base64,${base64}`,
                },
            });
        }
        else {
            content.push({
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}` },
            });
        }
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openRouterKey}`,
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
        const data = (await response.json());
        const text = data.choices?.[0]?.message?.content ?? '';
        if (text.trim()) {
            console.log('✅ Extração bem-sucedida: Nível 3 (Qwen OpenRouter)');
            return text;
        }
        throw new Error('Retorno vazio do provedor Nível 3.');
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new https_1.HttpsError('internal', `Falha crítica em todos os níveis: ${msg}`);
    }
}
// ─── extractFromImage ─────────────────────────────────────────────────────────
// Callable function for OCR extraction from hematology analyzer screens.
// New schema: AI returns `values` (number|null per analyte) + `fieldConfidence`
// (categorical). A mapper inside the function converts back to the original
// {value, confidence, reasoning} shape so the frontend contract is unchanged.
const OcrResponseSchema = zod_1.z.object({
    sampleId: zod_1.z.string().nullable().optional(),
    values: zod_1.z.record(zod_1.z.string(), zod_1.z.number().nullable()),
    fieldConfidence: zod_1.z.record(zod_1.z.string(), zod_1.z.enum(['high', 'medium', 'low'])).optional(),
    overallConfidence: zod_1.z.enum(['high', 'medium', 'low']).optional(),
});
const CONFIDENCE_MAP = {
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
exports.extractFromImage = (0, https_1.onCall)({
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '1GiB',
    timeoutSeconds: 300,
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const { base64, mimeType } = request.data;
    if (!base64?.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'Nenhuma imagem fornecida.');
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
        throw new https_1.HttpsError('internal', 'A IA retornou uma resposta vazia.');
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch (err) {
        console.error('❌ Erro no JSON da IA:', rawText, err);
        throw new https_1.HttpsError('internal', `A IA retornou JSON inválido: ${err instanceof Error ? err.message : 'formato desconhecido'}`);
    }
    const validation = OcrResponseSchema.safeParse(parsed);
    if (!validation.success) {
        console.error('❌ Erro de validação OCR (Zod):', validation.error.format());
        throw new https_1.HttpsError('internal', `Dados OCR fora do formato: ${validation.error.message}`);
    }
    const { data } = validation;
    // Map new AI format → original frontend contract {value, confidence, reasoning}
    const results = {};
    for (const [analyteId, rawValue] of Object.entries(data.values)) {
        if (rawValue === null)
            continue;
        const tier = data.fieldConfidence?.[analyteId];
        const overall = data.overallConfidence ?? 'n/a';
        results[analyteId] = {
            value: rawValue,
            confidence: tier ? CONFIDENCE_MAP[tier] : CONFIDENCE_MAP.low,
            reasoning: tier ? `${tier} (overall: ${overall})` : `low (overall: ${overall})`,
        };
    }
    if (Object.keys(results).length === 0) {
        throw new https_1.HttpsError('internal', 'Nenhum analito foi reconhecido na imagem.');
    }
    return {
        sampleId: data.sampleId ?? null,
        results,
    };
});
// ─── analyzeImmunoStrip ───────────────────────────────────────────────────────
// Callable: lê foto de strip de imunoensaio e retorna resultado R/NR + confiança.
// A chave Gemini reside exclusivamente no backend — nunca exposta ao frontend.
const STRIP_RESULT_SCHEMA = zod_1.z.object({
    resultado: zod_1.z.enum(['R', 'NR']),
    confidence: zod_1.z.enum(['high', 'medium', 'low']),
});
const ANALYZE_STRIP_INPUT_SCHEMA = zod_1.z.object({
    base64: zod_1.z.string().min(1, 'Imagem obrigatória.'),
    mimeType: zod_1.z.string().min(1, 'mimeType obrigatório.'),
    testType: zod_1.z.enum([
        'HCG', 'BhCG', 'HIV', 'HBsAg', 'Anti-HCV',
        'Sifilis', 'Dengue', 'COVID', 'PCR', 'Troponina',
    ]),
});
exports.analyzeImmunoStrip = (0, https_1.onCall)({
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    // Valida e tipifica o payload de entrada com Zod
    const inputValidation = ANALYZE_STRIP_INPUT_SCHEMA.safeParse(request.data);
    if (!inputValidation.success) {
        throw new https_1.HttpsError('invalid-argument', `Payload inválido: ${inputValidation.error.message}`);
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
        throw new https_1.HttpsError('internal', 'A IA retornou uma resposta vazia.');
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch (err) {
        console.error('❌ analyzeImmunoStrip: JSON inválido da IA:', rawText, err);
        throw new https_1.HttpsError('internal', 'IA retornou resposta não-JSON.');
    }
    const validation = STRIP_RESULT_SCHEMA.safeParse(parsed);
    if (!validation.success) {
        console.error('❌ analyzeImmunoStrip: formato inválido (Zod):', validation.error.format());
        throw new https_1.HttpsError('internal', `Formato inválido da IA: ${validation.error.message}`);
    }
    console.log(`✅ analyzeImmunoStrip: ${testType} → ${validation.data.resultado} (${validation.data.confidence})`);
    return {
        resultadoObtido: validation.data.resultado,
        confidence: validation.data.confidence,
    };
});
// ─── extractFromBula ──────────────────────────────────────────────────────────
// Callable function for parsing manufacturer stats from PDF bulas.
const ANALYTE_IDS_ALL = [
    'WBC', 'RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'PLT', 'RDW',
    'MPV', 'PCT', 'PDW', 'NEU#', 'LYM#', 'MON#', 'EOS#', 'BAS#',
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
const BulaAnalyteSchema = zod_1.z.object({
    analyteId: zod_1.z.string(),
    mean: zod_1.z.number().positive(),
    sd: zod_1.z.number().nonnegative(),
    equipmentSource: zod_1.z.string().optional(),
});
const BulaLevelSchema = zod_1.z.object({
    level: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]),
    lotNumber: zod_1.z.string().nullable().optional(),
    analytes: zod_1.z.array(BulaAnalyteSchema),
});
const BulaResponseSchema = zod_1.z.object({
    controlName: zod_1.z.string().nullable().optional(),
    expiryDate: zod_1.z.string().nullable().optional(),
    levels: zod_1.z.array(BulaLevelSchema).min(1),
});
exports.extractFromBula = (0, https_1.onCall)({
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '1GiB',
    timeoutSeconds: 300,
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const { base64, mimeType } = request.data;
    if (!base64?.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'Nenhum arquivo fornecido.');
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
        throw new https_1.HttpsError('internal', 'A IA retornou uma resposta vazia. Verifique se o documento é legível.');
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch (err) {
        console.error('❌ Erro no JSON da IA (Bula):', rawText, err);
        throw new https_1.HttpsError('internal', `A IA retornou JSON inválido (Bula): ${err instanceof Error ? err.message : 'formato desconhecido'}`);
    }
    const validation = BulaResponseSchema.safeParse(parsed);
    if (!validation.success) {
        console.error('❌ Erro de validação Bula (Zod):', validation.error.format());
        throw new https_1.HttpsError('internal', `Dados da bula fora do formato: ${validation.error.message}`);
    }
    return validation.data;
});
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
const ApproveUserInputSchema = zod_1.z.object({
    labId: zod_1.z.string().min(1),
    uid: zod_1.z.string().min(1),
    assignedRole: zod_1.z.enum(['admin', 'member']),
});
exports.approveUserForLab = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const parsed = ApproveUserInputSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, uid, assignedRole } = parsed.data;
    await assertLabAdminOrSuperAdmin(request.auth.uid, labId, request.auth.token);
    const db = admin.firestore();
    // 1. Read pending entry
    const pendingRef = db.doc(`pending_users/${labId}/users/${uid}`);
    const pendingSnap = await pendingRef.get();
    if (!pendingSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Usuário pendente não encontrado.');
    }
    const pending = pendingSnap.data();
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
    }
    else {
        // User doc exists — just add the new lab
        const existing = userSnap.data();
        const labIds = (existing.labIds ?? []);
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
    let existingClaims = {};
    try {
        const authUser = await admin.auth().getUser(uid);
        existingClaims = (authUser.customClaims ?? {});
    }
    catch {
        // User may not have claims yet — start fresh
    }
    const existingTenants = (existingClaims.tenantIds ?? []);
    await admin.auth().setCustomUserClaims(uid, {
        ...existingClaims,
        role: assignedRole,
        tenantIds: existingTenants.includes(labId)
            ? existingTenants
            : [...existingTenants, labId],
    });
    // 6. Mark emailVerified: true — admin validated the email by approving
    await admin.auth().updateUser(uid, { emailVerified: true });
    // 7. Audit log — non-blocking
    db.collection('auditLogs').add({
        action: 'APPROVE_PENDING_USER',
        callerUid: request.auth.uid,
        callerEmail: request.auth.token.email ?? null,
        targetUid: uid,
        targetEmail: pending.email ?? null,
        labId,
        payload: { assignedRole },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
    return { success: true };
});
//# sourceMappingURL=index.js.map