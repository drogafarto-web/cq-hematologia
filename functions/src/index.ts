import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { syncClaims } from './helpers/claims';

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
async function assertSuperAdmin(
  uid: string,
  token?: Record<string, unknown>,
): Promise<void> {
  if (token?.isSuperAdmin === true) return;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.isSuperAdmin !== true) {
    throw new HttpsError(
      'permission-denied',
      'Acesso negado. Apenas Super Admins podem executar esta operação.',
    );
  }
}

// ─── createUser ───────────────────────────────────────────────────────────────
// Creates a Firebase Auth user + Firestore document, optionally adding to a lab.
// Caller must be Super Admin. Current session is NOT disrupted.

const CreateUserInputSchema = z.object({
  displayName: z.string().min(1).max(100),
  email:       z.string().email(),
  password:    z.string().min(8),
  labId:       z.string().optional(),
  role:        z.enum(['admin', 'member']).optional(),
});

export const createUser = onCall(
  {},
  async (request) => {
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
        emailVerified: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-exists')) {
        throw new HttpsError('already-exists', 'Este e-mail já está cadastrado.');
      }
      throw new HttpsError('internal', `Falha ao criar usuário: ${msg}`);
    }

    const uid = userRecord.uid;
    const db  = admin.firestore();
    const batch = db.batch();

    batch.set(db.doc(`users/${uid}`), {
      email,
      displayName,
      labIds:       labId ? [labId] : [],
      roles:        labId && role ? { [labId]: role } : {},
      isSuperAdmin: false,
      activeLabId:  null,
      pendingLabId: null,
      disabled:     false,
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    });

    if (labId && role) {
      batch.set(db.doc(`labs/${labId}/members/${uid}`), { role, active: true });
    }

    await batch.commit();

    // Audit — non-blocking
    db.collection('auditLogs').add({
      action:      'CREATE_USER',
      callerUid:   request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid:   uid,
      targetEmail: email,
      labId:       labId ?? null,
      payload:     {},
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return { uid };
  },
);

// ─── setUserDisabled ──────────────────────────────────────────────────────────
// Disables (disabled=true) or enables (disabled=false) a Firebase Auth account.
// Disabling immediately revokes all active sessions via token revocation.

const SetUserDisabledInputSchema = z.object({
  uid:      z.string().min(1),
  disabled: z.boolean(),
});

export const setUserDisabled = onCall(
  {},
  async (request) => {
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

    admin.firestore().collection('auditLogs').add({
      action:      disabled ? 'DISABLE_USER' : 'ENABLE_USER',
      callerUid:   request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid:   uid,
      payload:     { disabled },
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return { success: true };
  },
);

// ─── setUserSuperAdmin ────────────────────────────────────────────────────────
// Promotes or demotes a user to/from Super Admin.
// Syncs custom claims so the new privilege is reflected in the next token refresh.

const SetUserSuperAdminSchema = z.object({
  targetUid:    z.string().min(1),
  isSuperAdmin: z.boolean(),
});

export const setUserSuperAdmin = onCall(
  {},
  async (request) => {
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

    admin.firestore().collection('auditLogs').add({
      action:      isSuperAdmin ? 'PROMOTE_SUPERADMIN' : 'DEMOTE_SUPERADMIN',
      callerUid:   request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      payload:     { isSuperAdmin },
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return { success: true };
  },
);

// ─── addUserToLab ─────────────────────────────────────────────────────────────
// Adds a user as a member of a lab. Atomic batch write.

const AddUserToLabSchema = z.object({
  targetUid: z.string().min(1),
  labId:     z.string().min(1),
  role:      z.enum(['admin', 'member']),
});

export const addUserToLab = onCall(
  {},
  async (request) => {
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
    const labIds   = (userData.labIds ?? []) as string[];

    batch.update(db.doc(`users/${targetUid}`), {
      labIds:           labIds.includes(labId) ? labIds : [...labIds, labId],
      [`roles.${labId}`]: role,
    });

    await batch.commit();

    db.collection('auditLogs').add({
      action:      'ADD_TO_LAB',
      callerUid:   request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload:     { role },
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return { success: true };
  },
);

// ─── updateUserLabRole ────────────────────────────────────────────────────────
// Changes a lab member's role. Blocks demoting the owner.

const UpdateUserLabRoleSchema = z.object({
  targetUid: z.string().min(1),
  labId:     z.string().min(1),
  role:      z.enum(['admin', 'member']),
});

export const updateUserLabRole = onCall(
  {},
  async (request) => {
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

    db.collection('auditLogs').add({
      action:      'CHANGE_ROLE',
      callerUid:   request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload:     { role },
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return { success: true };
  },
);

// ─── removeUserFromLab ────────────────────────────────────────────────────────
// Removes a user from a lab. Atomic batch write.

const RemoveUserFromLabSchema = z.object({
  targetUid: z.string().min(1),
  labId:     z.string().min(1),
});

export const removeUserFromLab = onCall(
  {},
  async (request) => {
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
    const labIds   = ((userData.labIds ?? []) as string[]).filter((id) => id !== labId);
    const roles    = { ...(userData.roles ?? {}) };
    delete roles[labId];
    const updates: Record<string, unknown> = { labIds, roles };
    if (userData.activeLabId === labId) updates.activeLabId = null;

    const batch = db.batch();
    batch.delete(db.doc(`labs/${labId}/members/${targetUid}`));
    batch.update(db.doc(`users/${targetUid}`), updates);
    await batch.commit();

    db.collection('auditLogs').add({
      action:      'REMOVE_FROM_LAB',
      callerUid:   request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload:     {},
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return { success: true };
  },
);

// ─── deleteUser ───────────────────────────────────────────────────────────────
// Permanently deletes a Firebase Auth account + all Firestore data.
// Cascades to lab memberships across all labs.

const DeleteUserSchema = z.object({
  targetUid: z.string().min(1),
});

export const deleteUser = onCall(
  {},
  async (request) => {
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
    const userData    = userSnap.data()!;
    const targetEmail = userData.email as string;
    const labIds      = (userData.labIds ?? []) as string[];

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
    db.collection('auditLogs').add({
      action:      'DELETE_USER',
      callerUid:   request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      targetEmail,
      payload:     { labsRemoved: labIds },
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return { success: true };
  },
);

// ─── Server-side secrets ──────────────────────────────────────────────────────

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const openRouterApiKey = defineSecret('OPENROUTER_API_KEY');

const GEMINI_DIRECT = 'gemini-3.1-flash-image-preview';
const OPENROUTER_GEMINI = 'google/gemini-2.0-flash-001';
const OPENROUTER_QWEN = 'qwen/qwen-vl-plus';

// ─── AI Service Helper ────────────────────────────────────────────────────────
// Logic for calling Gemini with failover to OpenRouter (Qwen)

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
    const content: any[] = [{ type: 'text', text: prompt }];
    // Gemini no OpenRouter suporta PDFs nativamente ou via Vision em muitos casos.
    // Usaremos a estrutura multimodal padrão do OpenRouter.
    content.push({
      type:      isPdf ? 'file' : 'image_url',
      [isPdf ? 'file' : 'image_url']: isPdf
        ? { filename: 'document.pdf', file_data: `data:${mimeType};base64,${base64}` }
        : { url: `data:${mimeType};base64,${base64}` },
    });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:    OPENROUTER_GEMINI,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
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
    const content: any[] = [{ type: 'text', text: prompt }];

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
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:    OPENROUTER_QWEN,
        messages: [{ role: 'user', content }],
        plugins:  isPdf ? [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }] : [],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
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
  sampleId:        z.string().nullable().optional(),
  values:          z.record(z.string(), z.number().nullable()),
  fieldConfidence: z.record(z.string(), z.enum(['high', 'medium', 'low'])).optional(),
  overallConfidence: z.enum(['high', 'medium', 'low']).optional(),
});

const CONFIDENCE_MAP: Record<'high' | 'medium' | 'low', number> = {
  high:   1.0,
  medium: 0.75,
  low:    0.5,
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
    memory:  '1GiB',
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
      prompt:    OCR_PROMPT,
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
      throw new HttpsError('internal', `A IA retornou JSON inválido: ${err instanceof Error ? err.message : 'formato desconhecido'}`);
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
        value:      rawValue,
        confidence: tier ? CONFIDENCE_MAP[tier] : CONFIDENCE_MAP.low,
        reasoning:  tier ? `${tier} (overall: ${overall})` : `low (overall: ${overall})`,
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

const BulaAnalyteSchema = z.object({
  analyteId:       z.string(),
  mean:            z.number().positive(),
  sd:              z.number().nonnegative(),
  equipmentSource: z.string().optional(),
});

const BulaLevelSchema = z.object({
  level:     z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lotNumber: z.string().nullable().optional(),
  analytes:  z.array(BulaAnalyteSchema),
});

const BulaResponseSchema = z.object({
  controlName: z.string().nullable().optional(),
  expiryDate:  z.string().nullable().optional(),
  levels:      z.array(BulaLevelSchema).min(1),
});

export const extractFromBula = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory:  '1GiB',
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
      prompt:    BULA_PROMPT,
      base64,
      mimeType,
      geminiKey: geminiKeyValue,
      openRouterKey: openRouterKeyValue,
    });

    if (!rawText.trim()) {
      throw new HttpsError('internal', 'A IA retornou uma resposta vazia. Verifique se o documento é legível.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error('❌ Erro no JSON da IA (Bula):', rawText, err);
      throw new HttpsError('internal', `A IA retornou JSON inválido (Bula): ${err instanceof Error ? err.message : 'formato desconhecido'}`);
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
