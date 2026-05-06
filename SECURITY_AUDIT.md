# SECURITY AUDIT — Phases 9–12
## Comprehensive Review of Committed Code

**Date:** 2026-05-06  
**Scope:** Phases 9 (Bioquímica), 10 (Liberação/Críticos), 11 (Feedback Loop), 12 (SGD Drive Importer)  
**Auditor:** Claude Code Agent  
**Status:** 21 commits reviewed, 8 files examined in depth

---

## CRITICAL ISSUES (must fix before production)

### 1. **CRITICAL: OAuth State Token Missing CSRF Protection** (HIGH) — **STATUS: FIXED 2026-05-06**
**File:** `functions/src/sgq/oauthCallbackDrive.ts`, line 32-37  
**Severity:** HIGH  
**Impact:** Callback hijacking, token theft via CSRF
**Fix commit:** `fix(security): OAuth state token CSRF protection — addressing SECURITY_AUDIT.md #1`
**Validation:** `crypto.randomBytes(32)` (256 bits) state token, stored in `/labs/{labId}/sgq-oauth-pending/{state}` with 10-min TTL, validated on callback with multi-tenant binding (#10), one-time use (deleted on validation), invalid attempts logged to `sgq-oauth-logs`.

```typescript
// VULNERABLE: State token is generated but NEVER VALIDATED
const { code, state, labId, userId } = req.query as Record<string, string>;

if (!code || !state || !labId || !userId) {
  return res.status(400).json(...);
}

// State is extracted but ignored — no validation against stored state
const { accessToken, expiresIn } = await exchangeCodeForTokens(
  code,
  labId,
  userId,
);
```

**Fix Required:**
- Generate state token with `crypto.randomBytes(32).toString('hex')` (not `Math.random`)
- Store state in Firestore under `/labs/{labId}/sgq-oauth-pending/{state}`
- Validate incoming state matches stored state before token exchange
- TTL state tokens to 5 minutes
- Delete state after validation (prevent replay)

**Recommended Code:**
```typescript
const pendingRef = admin.firestore()
  .doc(`labs/${labId}/sgq-oauth-pending/${state}`);
const pendingSnap = await pendingRef.get();

if (!pendingSnap.exists) {
  throw new HttpsError('permission-denied', 'Invalid or expired state token');
}

const storedAt = pendingSnap.data()!.createdAt as Timestamp;
const age = Date.now() - storedAt.toMillis();
if (age > 300000) { // 5 minutes
  await pendingRef.delete();
  throw new HttpsError('permission-denied', 'State token expired');
}

// Proceed with exchange
await pendingRef.delete(); // Prevent replay
```

---

### 2. **CRITICAL: Insecure OAuth Token Storage + Return** (HIGH) — **STATUS: FIXED 2026-05-06**
**File:** `functions/src/sgq/_drive/oauthClient.ts`, line 115-117  
**Severity:** HIGH  
**Impact:** Tokens leak to browser console, log injection, MitM exposure
**Fix commit:** `fix(security): insecure OAuth token storage and return — addressing SECURITY_AUDIT.md #2`
**Validation:** `getAccessToken()` now returns `access_token` (never `refresh_token`); access tokens cached in Firestore with absolute `expiresAt` Timestamp and refreshed when < 5 min remaining; audit log on every grant + refresh; KMS / Secret Manager rotation policy documented in `docs/SECURITY_OAUTH.md`.

```typescript
// VULNERABLE: Returns refresh token in memory without encryption
export async function getAccessToken(
  labId: string,
  userId: string,
): Promise<string> {
  const tokenDoc = await admin.firestore().collection(...).doc(userId).get();
  const { refreshToken, expiresAt } = tokenDoc.data() as {...};
  
  // ... OAuth refresh logic ...
  
  return refreshToken;  // ← WRONG: Should return accessToken only
}
```

**Issues:**
1. Line 117 returns `refreshToken` instead of `accessToken`
2. Refresh token is sensitive and should never be returned to caller
3. Firestore stores tokens in plain text (should use Google Secret Manager)

**Fix Required:**
```typescript
export async function getAccessToken(
  labId: string,
  userId: string,
): Promise<string> {
  const tokenDoc = await admin.firestore()
    .collection('labs')
    .doc(labId)
    .collection('sgq-oauth-tokens')
    .doc(userId)
    .get();

  if (!tokenDoc.exists) {
    throw new Error('No OAuth token found. Please re-authorize Drive access.');
  }

  const { refreshToken, expiresAt } = tokenDoc.data() as {
    refreshToken: string;
    expiresAt: Date;
  };

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Check if token needs refresh
  if (!expiresAt || expiresAt.getTime() < Date.now() + 300000) {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    // Update stored expiry
    await tokenDoc.ref.update({
      expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000),
    });

    return credentials.access_token; // ← Return access token, never refresh token
  }

  // Token still valid — return access token (should have saved it)
  // REFACTOR: Store accessToken in Firestore too (with short TTL)
  // For now, return placeholder until refactoring complete
  throw new Error('Access token not cached — must refresh. Re-run OAuth flow.');
}
```

**Migration Path:**
- Phase 12b: Store `accessToken` with `expiresAt` in Firestore (encrypted field)
- Store `refreshToken` in Google Secret Manager, reference by secret ID
- Never return `refreshToken` from any function
- Rotate tokens server-side only

---

### 3. **CRITICAL: Input Validation Gap — `z.record(z.any())` in Schema** (HIGH) — **STATUS: FIXED 2026-05-06**
**File:** `functions/src/liberacao/validators.ts`, line 116  
**Severity:** HIGH  
**Impact:** Arbitrary payload injection, schema bypass
**Fix commit:** `fix(security): strict input schemas, no z.any() bypass — addressing SECURITY_AUDIT.md #3`
**Validation:** Replaced with fully-typed `ExameLaudoSchema` matching `ExameLaudo` interface; `.strict()` rejects unknown keys; length caps on every string; array caps (50 exames, 200 resultados, 100 runIds); ID regex `/^[a-zA-Z0-9_\-:]+$/`. Same treatment applied to `criarReclamacao` (z.any → z.unknown, .strict, length caps) and `submitNPSResposta` (#14: ipAddress max 45, userAgent max 1000).

```typescript
export const CriarLaudoInputSchema = z.object({
  labId: z.string().min(1),
  runIds: z.array(z.string().min(1)).min(1),
  pacienteId: z.string().min(1),
  medicoSolicitanteId: z.string().min(1),
  exames: z.array(z.record(z.any())).min(1), // ← UNSAFE: accepts any object
});
```

**Fix Required:**
```typescript
// Define strict schema for ExameLaudo
const ExameLaudoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1).max(255),
  tipoMaterial: z.string().min(1).max(100),
  metodoAnalitico: z.string().min(1).max(255),
  resultados: z.array(z.object({
    teste: z.string().min(1),
    valor: z.number(),
    unidade: z.string().max(20),
  })),
  valoresReferencia: z.object({
    min: z.number(),
    max: z.number(),
    descricao: z.string().max(500),
  }),
  limitacoesTecnicas: z.string().optional(),
  interpretacao: z.string().optional(),
});

export const CriarLaudoInputSchema = z.object({
  labId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  runIds: z.array(z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/)).min(1).max(100),
  pacienteId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  medicoSolicitanteId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  exames: z.array(ExameLaudoSchema).min(1).max(100),
});
```

---

### 4. **CRITICAL: Missing Auth Check in LaudoStatusBadge Component** (MEDIUM-HIGH)
**File:** `src/features/liberacao/components/LaudoStatusBadge.tsx` (referenced but not examined in detail)  
**Severity:** MEDIUM-HIGH  
**Impact:** Potential unauthorized status visibility

Note: Component not fully reviewed, but pattern suggests review needed for:
- Client-side status checks without server validation
- Potential info disclosure via status field visibility

**Recommendation:** Ensure all status-related UI components validate `hasModuleAccess('liberacao')` at component mount.

---

## SIGNIFICANT ISSUES (should fix in next sprint)

### 5. **SIGNIFICANT: Type Casting `as any` in lotService** (MEDIUM)
**File:** `src/features/bioquimica/services/lotService.ts`, lines 132, 142, 163, 172  
**Severity:** MEDIUM  
**Impact:** Type safety gap, potential runtime errors

```typescript
validade: input.validade as any,
criadoEm: serverTimestamp() as any,
```

**Why This Matters:**
- `serverTimestamp()` returns `FieldValue`, not `Timestamp`
- Type cast hides the problem instead of solving it
- If code expects `Timestamp` later, runtime error will occur

**Fix Required:**
```typescript
// Proper type for Firestore server timestamp
const lotDoc: ControlMaterial = {
  id: lotId,
  labId,
  lote: input.lote,
  validade: input.validade instanceof Date 
    ? Timestamp.fromDate(input.validade) 
    : input.validade as Timestamp,
  fornecedor: input.fornecedor,
  equipmentIds: input.equipmentIds,
  origem: 'avulso',
  bulaPendente: false,
  manufacturerStats,
  niveis: input.niveis.map((n) => ({
    id: `nivel${n.level}`,
    nome: `Nível ${n.level}`,
  })),
  criadoEm: serverTimestamp(), // Let TypeScript handle this correctly
  deletadoEm: null,
};
```

---

### 6. **SIGNIFICANT: Insufficient Error Context in Cloud Functions** (MEDIUM)
**File:** `functions/src/liberacao/criarLaudo.ts`, lines 54-56, 79-82  
**Severity:** MEDIUM  
**Impact:** Hard to debug issues in production, weak error reporting

```typescript
const parsed = CriarLaudoInputSchema.safeParse(request.data);
if (!parsed.success) {
  throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  // ↑ Only first error shown; doesn't help operator find all issues
}
```

**Fix Required:**
```typescript
const parsed = CriarLaudoInputSchema.safeParse(request.data);
if (!parsed.success) {
  const errors = parsed.error.flatten();
  console.warn('[criarLaudo] Validation failed', {
    uid,
    labId,
    errors: errors.fieldErrors,
  });
  
  // Return all errors to UI (non-sensitive)
  throw new HttpsError('invalid-argument', 
    JSON.stringify({
      type: 'validation_error',
      fields: Object.entries(errors.fieldErrors).map(([field, msgs]) => ({
        field,
        messages: msgs?.slice(0, 1) || [], // First message only
      })),
    })
  );
}
```

---

### 7. **SIGNIFICANT: Race Condition in LaudoStatusBadge Async Logic** (MEDIUM)
**File:** `src/features/liberacao/hooks/useLaudoActions.ts` (likely exists, not examined)  
**Severity:** MEDIUM  
**Impact:** Double-submit, race condition on laudo release

**Pattern to Audit:**
```typescript
// VULNERABLE pattern (likely in hook):
const [submitting, setSubmitting] = useState(false);

const handleRelease = async () => {
  setSubmitting(true);
  try {
    await liberarLaudoCallable(laudoId);
    // UI updates happen here
  } finally {
    setSubmitting(false);
  }
};

// If user clicks button twice quickly:
// 1. First click: submitting = true, locks button
// 2. Network delay, user clicks again (button is disabled? maybe not always)
// 3. Second request sent
// 4. Both requests hit server simultaneously
```

**Fix Required:** See CODE_REVIEW.md #10 for pattern

---

### 8. **SIGNIFICANT: Missing LogicalSignature Validation in recordRunBioquimica** (MEDIUM)
**File:** `functions/src/bioquimica/recordRunBioquimica.ts`, lines 174-178  
**Severity:** MEDIUM  
**Impact:** Signature not persisted correctly, chain break possibility

```typescript
const signature = {
  hash: chainHash,
  operatorId: uid,
  ts: admin.firestore.Timestamp.now(),
};

// ↑ Matches LogicalSignature type BUT: chainHash is string, not hash object
// Should be: { hash: string (64 chars), operatorId, ts }
```

**Actual Type** (from types/):
```typescript
export interface LogicalSignature {
  operatorId: UserId;
  operatorRole: string;
  operatorName: string;
  operatorRegistro: string;
  timestamp: Timestamp;
  hash: string; // 64-char hex
}
```

**Fix:** Load operator metadata (role, name, registro) from `members/{uid}` before signing.

---

## ARCHITECTURAL CONCERNS

### 9. **OAuth Token Lifecycle Not Documented** (ARCHITECTURAL)
**Scope:** SGQ module Phase 12  
**Issue:** No documented token refresh strategy

**Concerns:**
- Token expiry times not validated upstream
- No alert/logging when tokens expire
- User experience unclear when Drive access revokes

**Recommendation:** 
Create `functions/src/sgq/_drive/TOKEN_LIFECYCLE.md`:
- Diagram of token states
- Refresh flow
- Expiry handling
- User recovery path

---

### 10. **Multi-Tenant Isolation in OAuth Callbacks** (ARCHITECTURAL)
**File:** `functions/src/sgq/oauthCallbackDrive.ts`  
**Issue:** User can specify any `labId` and `userId` in query params

```typescript
const { code, state, labId, userId } = req.query as Record<string, string>;
// ↑ Attacker could request: ?code=X&state=Y&labId=competitor-lab&userId=other-user
```

**Risk:** Cross-tenant OAuth token theft

**Fix Required:**
```typescript
// Option A: Bind state token to labId + userId upstream
const stateToken = generateStateWithLabAndUser(labId, userId);
// Then validate: stateToken must match labId + userId from callback

// Option B: Use Firebase custom claims to route OAuth
// State token stored by Firebase UID, not by labId/userId params
```

---

### 11. **Westgard Engine Correctness — History Window Undefined** (ARCHITECTURAL)
**File:** `src/features/bioquimica/utils/westgardRulesCLSI.ts`, lines 63-90  
**Severity:** MEDIUM  
**Issue:** Rules 2-2s and R-4s only check 1 previous run, not full 2-run window

```typescript
// Rule 2-2s: 2 consecutive runs same side beyond 2σ
if (input.history.length > 0) {
  const zPrev = (input.history[0].value - input.stats.mean) / input.stats.sd;
  // ↑ Only checks input.history[0] — what if history has 5 runs?
  // Should check all consecutive pairs, not just latest
}
```

**Impact:** Westgard 2-2s rule incompletely evaluated

**Recommendation:** 
- Document clearly: "history = previous N runs for this (analito, nivel, equipment)"
- Implement proper 2-run window logic:
```typescript
// Check ALL consecutive pairs in history (including current)
const allValues = [input.current.value, ...input.history.map(h => h.value)];
const allZScores = allValues.map(v => (v - input.stats.mean) / input.stats.sd);

for (let i = 1; i < allZScores.length; i++) {
  const z = allZScores[i];
  const zPrev = allZScores[i - 1];
  
  if (Math.abs(z) > 2 && Math.abs(zPrev) > 2 && Math.sign(z) === Math.sign(zPrev)) {
    violations.push({
      rule: '2-2s',
      severity: 'reject',
      detail: `Consecutive runs ${i} and ${i+1} both beyond 2σ same side`,
    });
  }
}
```

---

## CODE QUALITY FINDINGS

### 12. **Error Messages Leak Implementation Details** (MEDIUM)
**File:** `functions/src/liberacao/criarLaudo.ts`, lines 79-82  
**Issue:** Error message exposes internal schema

```typescript
if (!medicoSnap.exists) {
  throw new HttpsError(
    'not-found',
    'Médico solicitante não encontrado no cache. Sincronize com Worklab.',
    // ↑ Mentions "Worklab" integration detail (not user-facing)
  );
}
```

**Fix:** Use generic message to UI, detailed message to logs:
```typescript
if (!medicoSnap.exists) {
  console.error('[criarLaudo] Médico not found', {
    uid,
    labId,
    medicoId: medicoSolicitanteId,
  });
  throw new HttpsError(
    'not-found',
    'Médico solicitante não encontrado. Contate o administrador.',
  );
}
```

---

### 13. **Potential N+1 Query in listarDocsDrive** (MEDIUM)
**File:** `functions/src/sgq/listarDocsDrive.ts`, lines 88-89  
**Issue:** Loop calls `listFilesForCodigo(drive, ...)` for each LM-01 entry

```typescript
for (const entry of lm01Entries) {
  const files = await listFilesForCodigo(drive, entry.codigo); // ← Sequential calls
  // ...
}
```

**Impact:** If 100 LM-01 entries, 100 sequential Drive API calls (very slow)

**Fix Required:**
```typescript
// Batch Drive queries
const matchPromises = lm01Entries.map(entry => 
  listFilesForCodigo(drive, entry.codigo).catch(err => {
    console.warn(`Failed to list files for ${entry.codigo}:`, err);
    return [];
  })
);

const allFilesByEntry = await Promise.all(matchPromises);

const matched: MatchedDoc[] = [];
const gaps: { codigo: string; titulo: string }[] = [];

for (let i = 0; i < lm01Entries.length; i++) {
  const entry = lm01Entries[i];
  const files = allFilesByEntry[i];
  
  if (files.length > 0) {
    const bestMatch = files[0];
    matched.push({...});
  } else {
    gaps.push({...});
  }
}
```

---

### 14. **Unvalidated JSON Serialization in NPS Submission** (MEDIUM)
**File:** `functions/src/modules/satisfacao/submitNPSResposta.ts`, line 60  
**Issue:** User-provided `userAgent` serialized directly to DB

```typescript
consentimentoLgpd: {
  aceito: input.consentimentoLgpd.aceito,
  em: admin.firestore.FieldValue.serverTimestamp(),
  ipAddress: input.consentimentoLgpd.ipAddress, // ← From request
  userAgent: input.consentimentoLgpd.userAgent,  // ← From request
},
```

**Risk:** User-Agent can be extremely long or contain unusual characters  
Zod schema doesn't validate length:
```typescript
z.object({
  aceito: z.boolean(),
  ipAddress: z.string(),
  userAgent: z.string(), // ← No .max() constraint
})
```

**Fix:**
```typescript
z.object({
  aceito: z.boolean(),
  ipAddress: z.string().ip().max(45), // IPv4 + IPv6
  userAgent: z.string().max(1000), // Reasonable limit
})
```

---

## COMPLIANCE CHECKS

### 15. **Audit Trail Completeness — SGD Module** (COMPLIANCE)
**Scope:** Phase 12 — SGD Drive Importer  
**Status:** ✓ PASS (with notes)

**Checked:**
- OAuth operations logged to `sgq-oauth-logs` ✓
- Drive import job tracked in `sgq-import-jobs` ✓
- Document transitions logged to `sgq-documentos-audit` ✓

**Minor Gap:**
- No "who imported this batch" in log (userId captured but not operator name)
- RDC 978 5.3.2 requires "nome do responsável técnico"

**Recommendation:**
```typescript
// In aprovarBatchImport:
const operatorSnap = await db
  .doc(`labs/${labId}/members/${uid}`)
  .get();

const operatorName = operatorSnap.data()?.name || 'desconhecido';

await db
  .collection(`labs/${labId}/sgq-import-jobs`)
  .add({
    event: 'batch-import-approved',
    userId: uid,
    operatorName, // ← Add this
    batchId: batchRef.id,
    documentCount: approvedDocs.length,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
```

---

### 16. **LGPD Anonymization — NPS Responses** (COMPLIANCE)
**Scope:** Phase 11 — Feedback Loop / Satisfação  
**Status:** ⚠️ PARTIAL

**Checked:**
- Consent capture: ✓ Present
- IP Address storage: ✓ Acknowledged
- Anonymization job: ⚠️ Mentioned but not examined

```typescript
// From submitNPSResposta:
anonimizadoEm: null, // Will be set 90d later by cron job
```

**Issue:** No evidence of cron job implementation in code review scope

**Recommendation:**
- Examine `functions/src/modules/satisfacao/anonimizarRespostas.ts`
- Verify:
  - Cron scheduled via Firebase Cloud Tasks or Pub/Sub
  - TTL exactly 90 days (2592000000 ms)
  - Anonymization = delete ipAddress, userAgent, comentario
  - Audit trail preserved (who anonymized, when)

---

### 17. **RDC 978 Art. 180 — CIQ Plan Documentation** (COMPLIANCE)
**Scope:** Phase 9 — Bioquímica  
**Status:** ✓ PASS

**Evidence:**
- Westgard rules documented in code ✓
- Rule severity levels defined (warn/reject) ✓
- Stats source clear (bula primary, internal after N=20) ✓
- Multi-instrument tracking via equipmentIds ✓

**Recommendation:**
- Add comment link to RDC 978 Art. 180 in `westgardRulesCLSI.ts` header
- Document CLSI reference (CLSI EP15 or C24)

---

## MISSING SECURITY PATTERNS

### 18. **No Rate Limiting on Public Callables** (SECURITY) — **STATUS: FIXED 2026-05-06**
**Scope:** All Cloud Functions  
**Severity:** MEDIUM-HIGH
**Fix commit:** `fix(security): rate limiting on public callables — addressing SECURITY_AUDIT.md #4`
**Validation:** `functions/src/shared/rateLimit.ts` — Firestore-backed transactional counter, fail-open on infra issues, hits logged to `/_system/rate-limits/hits`. Applied: `submitNPSResposta` (10/min IP), `parseEmailReclamacao` (100/hour IP, returns 429 + Retry-After), `oauthCallbackDrive` (10/min IP), `criarReclamacao` (60/min uid), `criarLaudo` (100/min uid).

**Vulnerable Endpoints:**
- `submitNPSResposta` — public callable (only `npsToken` checks)
- `oauthCallbackDrive` — HTTP endpoint
- `listarDocsDrive` — requires auth but no per-user rate limit

**Fix Required:**
```typescript
// Use Google Cloud Tasks or Pub/Sub with rate limiting
// Option A: Firebase Extensions (official)
// Option B: Implement custom counter in Firestore

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const MAX_REQUESTS = 100;

async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const key = `rate-limit/${action}/${userId}`;
  const doc = await admin.firestore().doc(`_system/rate-limits/${key}`).get();
  
  if (!doc.exists) {
    await doc.ref.set({
      count: 1,
      resetAt: Date.now() + RATE_LIMIT_WINDOW,
    });
    return true;
  }
  
  const { count, resetAt } = doc.data()!;
  
  if (Date.now() > resetAt) {
    await doc.ref.update({
      count: 1,
      resetAt: Date.now() + RATE_LIMIT_WINDOW,
    });
    return true;
  }
  
  if (count >= MAX_REQUESTS) {
    return false;
  }
  
  await doc.ref.update({ count: count + 1 });
  return true;
}
```

---

### 19. **Missing Content Security Policy Headers** (SECURITY)
**File:** Not found in functions/src  
**Issue:** HTTP responses from Cloud Functions don't set CSP headers

**Fix Required:**
Add to `oauthCallbackDrive` and other HTTP handlers:
```typescript
res.setHeader('Content-Security-Policy', 
  "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; img-src 'self' data:; style-src 'self' 'unsafe-inline'");
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
```

---

### 20. **Insufficient Logging for Audit Trail Reconstruction** (SECURITY)
**Scope:** All sensitive operations  
**Issue:** Some callables don't log enough context for incident response

**Example:** `liberarLaudo` should log:
- Who released it (uid, name, role)
- Which laudo (id, paciente name)
- Timestamp (for sequence reconstruction)
- Previous release state
- Signature validation result

**Fix Required:**
```typescript
await admin.firestore()
  .collection(`labs/${labId}/audit-logs`)
  .add({
    tipo: 'laudo_liberado',
    laudoId,
    pacienteName,
    operadorId: uid,
    operadorRole: role,
    previousStatus: laudoData.status,
    newStatus: 'Liberado',
    signatureValidation: signatureValid ? 'passed' : 'failed',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ipAddress: context.rawRequest?.ip,
  });
```

---

## SUMMARY TABLE

| ID | Issue | Severity | Type | Sprint |
|---|---|---|---|---|
| 1 | OAuth State CSRF | CRITICAL | Security | Immed. |
| 2 | Token Storage/Return | CRITICAL | Security | Immed. |
| 3 | Input Validation (z.any) | CRITICAL | Security | Immed. |
| 4 | Missing Auth Badge | HIGH | Security | Sprint 1 |
| 5 | Type Casting `as any` | MEDIUM | Code Quality | Sprint 1 |
| 6 | Error Context | MEDIUM | Code Quality | Sprint 1 |
| 7 | Race Condition | MEDIUM | Concurrency | Sprint 1 |
| 8 | LogicalSignature | MEDIUM | Data Integrity | Sprint 1 |
| 9 | Token Lifecycle Docs | MEDIUM | Architecture | Sprint 2 |
| 10 | Multi-tenant OAuth | MEDIUM | Security | Sprint 1 |
| 11 | Westgard Window | MEDIUM | Correctness | Sprint 1 |
| 12 | Error Message Leak | MEDIUM | Security | Sprint 1 |
| 13 | N+1 Query | MEDIUM | Performance | Sprint 2 |
| 14 | NPS Validation | MEDIUM | Data Quality | Sprint 1 |
| 15 | Audit Trail Names | LOW | Compliance | Sprint 2 |
| 16 | LGPD Cron Job | MEDIUM | Compliance | Review |
| 17 | CIQ Documentation | LOW | Compliance | Sprint 2 |
| 18 | Rate Limiting | MEDIUM-HIGH | Security | Sprint 1 |
| 19 | CSP Headers | LOW | Security | Sprint 2 |
| 20 | Audit Logging | MEDIUM | Observability | Sprint 1 |

---

## REMEDIATION PRIORITY

### Blocker (Fix Before Next Deploy)
1. Issue #1: OAuth CSRF state token validation
2. Issue #2: OAuth token storage and return logic
3. Issue #3: Input validation schema (`z.any` removal)
4. Issue #18: Rate limiting on public callables

### Sprint 1 (Next 5 days)
- Issue #5: Type casting cleanup
- Issue #6: Error context improvement
- Issue #7: Race condition patterns
- Issue #8: LogicalSignature completeness
- Issue #10: Multi-tenant OAuth binding
- Issue #11: Westgard 2-run window logic
- Issue #12: Error message sanitization
- Issue #14: NPS user-agent validation
- Issue #20: Audit logging enrichment

### Sprint 2 (Next 10 days)
- Issue #9: Token lifecycle documentation
- Issue #13: Drive batch query optimization
- Issue #15: Audit trail operator name
- Issue #19: CSP + security headers

---

## DEPLOYMENT READINESS

**Current Status:** 🟡 CRITICAL BLOCKERS RESOLVED — pending Sprint 1 follow-ups + deploy sign-off
**Last update:** 2026-05-06

**Sign-Off Checklist:**
- [x] Issue #1 fixed (commit `fix(security): OAuth state token CSRF protection`)
- [x] Issue #2 fixed (commit `fix(security): insecure OAuth token storage and return`)
- [x] Issue #3 fixed (commit `fix(security): strict input schemas, no z.any() bypass`)
- [x] Issue #18 rate limiting deployed (commit `fix(security): rate limiting on public callables`)
- [ ] Staging integration test of OAuth flow (to be run pre-deploy)
- [ ] All issues #5-12 reviewed in PR (Sprint 1)
- [ ] SAST scan clean (no new secrets, no `any` types)
- [ ] Deploy sign-off from CTO

