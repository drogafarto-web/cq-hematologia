"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFromBula = exports.extractFromImage = exports.setUserDisabled = exports.createUser = void 0;
var https_1 = require("firebase-functions/v2/https");
var v2_1 = require("firebase-functions/v2");
var params_1 = require("firebase-functions/params");
var genai_1 = require("@google/genai");
var zod_1 = require("zod");
var admin = require("firebase-admin");
// All functions deploy to the same region as Firestore
(0, v2_1.setGlobalOptions)({ region: 'southamerica-east1' });
// Initialize Admin SDK once — runtime may reuse warm instances
if (!admin.apps.length) {
    admin.initializeApp();
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Throws permission-denied if the caller is not a Super Admin (Firestore check). */
function assertSuperAdmin(uid) {
    return __awaiter(this, void 0, void 0, function () {
        var snap;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, admin.firestore().doc("users/".concat(uid)).get()];
                case 1:
                    snap = _b.sent();
                    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.isSuperAdmin) !== true) {
                        throw new https_1.HttpsError('permission-denied', 'Acesso negado. Apenas Super Admins podem executar esta operação.');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// ─── createUser ───────────────────────────────────────────────────────────────
// Creates a Firebase Auth user + Firestore document, optionally adding to a lab.
// The caller must be a Super Admin. The current session is NOT disrupted.
var CreateUserInputSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    labId: zod_1.z.string().optional(),
    role: zod_1.z.enum(['admin', 'member']).optional(),
});
exports.createUser = (0, https_1.onCall)({}, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var parsed, _a, displayName, email, password, labId, role, userRecord, err_1, msg, uid, firestore, batch;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!request.auth) {
                    throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
                }
                return [4 /*yield*/, assertSuperAdmin(request.auth.uid)];
            case 1:
                _c.sent();
                parsed = CreateUserInputSchema.safeParse(request.data);
                if (!parsed.success) {
                    throw new https_1.HttpsError('invalid-argument', "Dados inv\u00E1lidos: ".concat(parsed.error.message));
                }
                _a = parsed.data, displayName = _a.displayName, email = _a.email, password = _a.password, labId = _a.labId, role = _a.role;
                _c.label = 2;
            case 2:
                _c.trys.push([2, 4, , 5]);
                return [4 /*yield*/, admin.auth().createUser({
                        email: email,
                        password: password,
                        displayName: displayName,
                        emailVerified: false,
                    })];
            case 3:
                userRecord = _c.sent();
                return [3 /*break*/, 5];
            case 4:
                err_1 = _c.sent();
                msg = err_1 instanceof Error ? err_1.message : String(err_1);
                if (msg.includes('email-already-exists')) {
                    throw new https_1.HttpsError('already-exists', 'Este e-mail já está cadastrado.');
                }
                throw new https_1.HttpsError('internal', "Falha ao criar usu\u00E1rio: ".concat(msg));
            case 5:
                uid = userRecord.uid;
                firestore = admin.firestore();
                batch = firestore.batch();
                // Firestore user document
                batch.set(firestore.doc("users/".concat(uid)), {
                    email: email,
                    displayName: displayName,
                    labIds: labId ? [labId] : [],
                    roles: labId && role ? (_b = {}, _b[labId] = role, _b) : {},
                    isSuperAdmin: false,
                    activeLabId: null,
                    pendingLabId: null,
                    disabled: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                // Lab membership (optional)
                if (labId && role) {
                    batch.set(firestore.doc("labs/".concat(labId, "/members/").concat(uid)), { role: role, active: true });
                }
                return [4 /*yield*/, batch.commit()];
            case 6:
                _c.sent();
                // Audit — non-blocking
                firestore.collection('auditLogs').add({
                    action: 'CREATE_USER',
                    targetUid: uid,
                    email: email,
                    actorUid: request.auth.uid,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                }).catch(function () { });
                return [2 /*return*/, { uid: uid }];
        }
    });
}); });
// ─── setUserDisabled ──────────────────────────────────────────────────────────
// Suspends (disabled=true) or enables (disabled=false) a Firebase Auth account.
// Suspension immediately revokes all active sessions via token revocation.
var SetUserDisabledInputSchema = zod_1.z.object({
    uid: zod_1.z.string().min(1),
    disabled: zod_1.z.boolean(),
});
exports.setUserDisabled = (0, https_1.onCall)({}, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var parsed, _a, uid, disabled, err_2, msg;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!request.auth) {
                    throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
                }
                return [4 /*yield*/, assertSuperAdmin(request.auth.uid)];
            case 1:
                _b.sent();
                parsed = SetUserDisabledInputSchema.safeParse(request.data);
                if (!parsed.success) {
                    throw new https_1.HttpsError('invalid-argument', 'Dados inválidos.');
                }
                _a = parsed.data, uid = _a.uid, disabled = _a.disabled;
                if (uid === request.auth.uid) {
                    throw new https_1.HttpsError('invalid-argument', 'Você não pode suspender sua própria conta.');
                }
                _b.label = 2;
            case 2:
                _b.trys.push([2, 6, , 7]);
                return [4 /*yield*/, admin.auth().updateUser(uid, { disabled: disabled })];
            case 3:
                _b.sent();
                if (!disabled) return [3 /*break*/, 5];
                // Revoke all active refresh tokens — terminates existing sessions immediately
                return [4 /*yield*/, admin.auth().revokeRefreshTokens(uid)];
            case 4:
                // Revoke all active refresh tokens — terminates existing sessions immediately
                _b.sent();
                _b.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                err_2 = _b.sent();
                msg = err_2 instanceof Error ? err_2.message : String(err_2);
                throw new https_1.HttpsError('internal', "Falha ao atualizar conta: ".concat(msg));
            case 7: 
            // Sync state to Firestore so client can read it without Admin SDK
            return [4 /*yield*/, admin.firestore().doc("users/".concat(uid)).update({ disabled: disabled })];
            case 8:
                // Sync state to Firestore so client can read it without Admin SDK
                _b.sent();
                // Audit — non-blocking
                admin.firestore().collection('auditLogs').add({
                    action: disabled ? 'SUSPEND_USER' : 'ENABLE_USER',
                    targetUid: uid,
                    actorUid: request.auth.uid,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                }).catch(function () { });
                return [2 /*return*/, { success: true }];
        }
    });
}); });
// Server-side secret — never exposed to the browser bundle
var geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
// ─── Shared constants ─────────────────────────────────────────────────────────
var GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';
// ─── extractFromImage ─────────────────────────────────────────────────────────
// Callable function for OCR extraction from hematology analyzer screens.
var AnalyteResultSchema = zod_1.z.object({
    value: zod_1.z.number().min(0),
    confidence: zod_1.z.number().min(0).max(1),
    reasoning: zod_1.z.string(),
});
var OcrResponseSchema = zod_1.z.object({
    sampleId: zod_1.z.string().nullable().optional(),
    results: zod_1.z.record(zod_1.z.string(), AnalyteResultSchema),
});
var OCR_PROMPT = function (analyteIds) { return "\nYou are an expert OCR system for clinical hematology analyzers.\nAnalyze the image of a Yumizen H550 result screen and extract the numeric values\nfor each of the following analytes: ".concat(analyteIds.join(', '), ".\n\nReturn a JSON object with this exact shape:\n{\n  \"sampleId\": \"<string | null>\",\n  \"results\": {\n    \"<analyteId>\": {\n      \"value\": <number>,\n      \"confidence\": <0.0\u20131.0>,\n      \"reasoning\": \"<brief explanation>\"\n    }\n  }\n}\n\nRules:\n- Only include analytes that are clearly visible and readable.\n- Use null for sampleId if not visible.\n- Confidence 1.0 = perfectly clear; 0.0 = not visible / guessed.\n- Never fabricate values. If a value is unreadable, omit that analyte key.\n").trim(); };
exports.extractFromImage = (0, https_1.onCall)({ secrets: [geminiApiKey] }, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, base64, analyteIds, mimeType, client, rawText, response, err_3, msg, parsed, validation, data;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                if (!request.auth) {
                    throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
                }
                _a = request.data, base64 = _a.base64, analyteIds = _a.analyteIds, mimeType = _a.mimeType;
                if (!(base64 === null || base64 === void 0 ? void 0 : base64.trim())) {
                    throw new https_1.HttpsError('invalid-argument', 'Nenhuma imagem fornecida.');
                }
                if (!Array.isArray(analyteIds) || analyteIds.length === 0) {
                    throw new https_1.HttpsError('invalid-argument', 'Nenhum analito definido.');
                }
                client = new genai_1.GoogleGenAI({ apiKey: geminiApiKey.value() });
                _d.label = 1;
            case 1:
                _d.trys.push([1, 3, , 4]);
                return [4 /*yield*/, client.models.generateContent({
                        model: GEMINI_MODEL,
                        contents: [
                            {
                                role: 'user',
                                parts: [
                                    { text: OCR_PROMPT(analyteIds) },
                                    { inlineData: { mimeType: mimeType, data: base64 } },
                                ],
                            },
                        ],
                        config: { responseMimeType: 'application/json' },
                    })];
            case 2:
                response = _d.sent();
                rawText = (_b = response.text) !== null && _b !== void 0 ? _b : '';
                return [3 /*break*/, 4];
            case 3:
                err_3 = _d.sent();
                msg = err_3 instanceof Error ? err_3.message : String(err_3);
                if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
                    throw new https_1.HttpsError('resource-exhausted', 'Cota da API Gemini excedida. Aguarde alguns instantes.');
                }
                if (msg.toUpperCase().includes('SAFETY')) {
                    throw new https_1.HttpsError('invalid-argument', 'A imagem foi bloqueada por filtros de segurança.');
                }
                throw new https_1.HttpsError('internal', "Falha na comunica\u00E7\u00E3o com a IA: ".concat(msg));
            case 4:
                if (!rawText.trim()) {
                    throw new https_1.HttpsError('internal', 'A IA retornou uma resposta vazia.');
                }
                try {
                    parsed = JSON.parse(rawText);
                }
                catch (_e) {
                    throw new https_1.HttpsError('internal', 'A IA retornou dados em formato inválido.');
                }
                validation = OcrResponseSchema.safeParse(parsed);
                if (!validation.success) {
                    throw new https_1.HttpsError('internal', 'A IA retornou dados fora do formato esperado.');
                }
                data = validation.data;
                if (Object.keys(data.results).length === 0) {
                    throw new https_1.HttpsError('internal', 'Nenhum analito foi reconhecido na imagem.');
                }
                return [2 /*return*/, {
                        sampleId: (_c = data.sampleId) !== null && _c !== void 0 ? _c : null,
                        results: data.results,
                    }];
        }
    });
}); });
// ─── extractFromBula ──────────────────────────────────────────────────────────
// Callable function for parsing manufacturer stats from PDF bulas.
var ANALYTE_IDS_ALL = [
    'WBC', 'RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'PLT', 'RDW',
    'MPV', 'PCT', 'PDW', 'NEU', 'LYM', 'MON', 'EOS', 'BAS',
    'NEU#', 'LYM#', 'MON#', 'EOS#',
].join(', ');
var BULA_PROMPT = "\nVoc\u00EA \u00E9 um especialista em interpretar bulas de controles hematol\u00F3gicos (package inserts).\nAnalise o documento PDF e extraia os valores esperados (m\u00E9dia e desvio-padr\u00E3o) para os analitos\ndo Yumizen H550 / Horiba ABX.\n\nAnalitos aceitos pelo sistema: ".concat(ANALYTE_IDS_ALL, "\n\nRetorne um JSON com este formato EXATO:\n{\n  \"controlName\": \"<nome comercial do controle ou null>\",\n  \"lotNumber\":   \"<n\u00FAmero do lote ou null>\",\n  \"expiryDate\":  \"<data de validade em YYYY-MM-DD ou null>\",\n  \"level\":       <1, 2 ou 3 conforme o n\u00EDvel do controle, ou null>,\n  \"analytes\": [\n    { \"analyteId\": \"<id exato do analito>\", \"mean\": <n\u00FAmero>, \"sd\": <n\u00FAmero> }\n  ]\n}\n\nRegras:\n- Use apenas os IDs exatos listados acima (ex: \"WBC\", \"HGB\", \"NEU\", \"NEU#\").\n- Inclua apenas analitos com mean E sd claramente leg\u00EDveis no documento.\n- Quando o PDF tiver tabelas para m\u00FAltiplos n\u00EDveis, extraia o n\u00EDvel informado ou n\u00EDvel 1.\n- Para metadados n\u00E3o encontrados, use null.\n- Nunca invente valores. Se incerto, omita o analito.\n").trim();
var BulaAnalyteSchema = zod_1.z.object({
    analyteId: zod_1.z.string(),
    mean: zod_1.z.number().positive(),
    sd: zod_1.z.number().nonnegative(),
});
var BulaResponseSchema = zod_1.z.object({
    controlName: zod_1.z.string().nullable().optional(),
    lotNumber: zod_1.z.string().nullable().optional(),
    expiryDate: zod_1.z.string().nullable().optional(),
    level: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]).nullable().optional(),
    analytes: zod_1.z.array(BulaAnalyteSchema),
});
exports.extractFromBula = (0, https_1.onCall)({ secrets: [geminiApiKey], memory: '1GiB' }, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, base64, mimeType, client, rawText, response, err_4, msg, parsed, validation;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!request.auth) {
                    throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
                }
                _a = request.data, base64 = _a.base64, mimeType = _a.mimeType;
                if (!(base64 === null || base64 === void 0 ? void 0 : base64.trim())) {
                    throw new https_1.HttpsError('invalid-argument', 'Nenhum arquivo fornecido.');
                }
                client = new genai_1.GoogleGenAI({ apiKey: geminiApiKey.value() });
                _c.label = 1;
            case 1:
                _c.trys.push([1, 3, , 4]);
                return [4 /*yield*/, client.models.generateContent({
                        model: GEMINI_MODEL,
                        contents: [
                            {
                                role: 'user',
                                parts: [
                                    { text: BULA_PROMPT },
                                    { inlineData: { mimeType: mimeType, data: base64 } },
                                ],
                            },
                        ],
                        config: { responseMimeType: 'application/json' },
                    })];
            case 2:
                response = _c.sent();
                rawText = (_b = response.text) !== null && _b !== void 0 ? _b : '';
                return [3 /*break*/, 4];
            case 3:
                err_4 = _c.sent();
                msg = err_4 instanceof Error ? err_4.message : String(err_4);
                if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
                    throw new https_1.HttpsError('resource-exhausted', 'Cota da API Gemini excedida. Aguarde alguns instantes.');
                }
                throw new https_1.HttpsError('internal', "Falha na comunica\u00E7\u00E3o com a IA: ".concat(msg));
            case 4:
                if (!rawText.trim()) {
                    throw new https_1.HttpsError('internal', 'A IA retornou uma resposta vazia. Verifique se o PDF é legível.');
                }
                try {
                    parsed = JSON.parse(rawText);
                }
                catch (_d) {
                    throw new https_1.HttpsError('internal', 'A IA retornou dados em formato inválido.');
                }
                validation = BulaResponseSchema.safeParse(parsed);
                if (!validation.success) {
                    throw new https_1.HttpsError('internal', 'A IA retornou dados fora do formato esperado.');
                }
                return [2 /*return*/, validation.data];
        }
    });
}); });
