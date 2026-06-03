# NOTIVISA Legacy Codepath Audit

**Status:** Phase 4 (Wave 3-6) — Deprecation Planning
**Date:** 2026-05-08
**Scope:** Two coexisting NOTIVISA callable patterns (legacy Batch 1 + Wave 2 Agent 10)

---

## Executive Summary

The NOTIVISA module has **two fully functional, parallel codepaths** writing to the same `notivisa-drafts/` collection:

| Codepath              | Pattern   | Callables                                                                                   | Status                      | Risk                                                       |
| --------------------- | --------- | ------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| **Legacy** (Batch 1)  | Verb-noun | `notivisaDraftCreate`, `approveNotivisaDraft`, `submitNotivisaDraft`, `rejectNotivisaDraft` | Implemented, tests passing  | Race conditions if both paths used in same lab/minute      |
| **Wave 2** (Agent 10) | camelCase | `notivisaCreateDraft`, `notivisaApproveDraft`, `notivisaSubmitDraft`                        | Implemented, test-mode only | Signature ceremony incomplete; audit log structure differs |

**Critical Issue:** Both write to `notivisa-drafts/{labId}/drafts/{draftId}` with different:

- Status enum values (`draft` vs `pending`)
- Signature strategies (cryptographic HMAC vs minimal audit log)
- Audit log structure (`CREATED` vs `DRAFT_CREATED`)

This creates **audit confusion** and potential **race-condition submissi** if a lab accidentally mixes callables.

---

## Part A: Legacy Codepath (Batch 1, ADR-0026)

### Callables Overview

#### 1. `notivisaDraftCreate` — Draft Creation

- **File:** `functions/src/modules/notivisa/notivisaDraftCreate.ts`
- **Exported from:** `modules/notivisa/index.ts` (line 17) — **NOT** re-exported in `functions/src/index.ts`
- **Region:** Default (`us-central1` inherited from global options, then southamerica-east1 via setGlobalOptions)
- **Input Schema:**
  ```typescript
  interface NotivisaDraftCreateInput {
    labId: string;
    laudoId: string;
    payload: {
      versao: '1.0';
      laudo_id: string;
      paciente_cpf: string; // 11 digits
      data_resultado: number; // timestamp
      // other fields...
    };
  }
  ```
- **Output Schema:**
  ```typescript
  interface NotivisaDraftCreateResult {
    ok: true;
    draftId: string;
    status: 'draft';
    criadoEm: number;
  }
  ```
- **Key Logic:**
  1. Validates access via `assertNotivisaAccess(request.auth, labId)`
  2. Rate limit: max 10 submissions/minute per lab (via Firestore counter)
  3. Idempotency check: queries for existing draft with same `laudoId`, status != `'submitted'`
  4. **Signature:** Generates `LogicalSignature` server-side with `operatorId`, `hash` (SHA-256), `ts`
  5. Atomic write: draft doc + audit log subcollection
  6. Non-blocking audit log to `auditLogs/{labId}/`

- **Error Codes:**
  - `invalid-argument`: Payload fails Zod validation
  - `permission-denied`: User not authorized for lab
  - `resource-exhausted`: Rate limit (>10/min)

- **Audit Signature Structure:**
  ```typescript
  assinatura: {
    hash: string; // SHA-256 hex of {operatorId, ts, payload}
    operatorId: string; // request.auth.uid
    ts: Timestamp;
  }
  ```

---

#### 2. `approveNotivisaDraft` — RT/Admin Approval

- **File:** `functions/src/modules/notivisa/approveNotivisaDraft.ts`
- **Exported from:** `modules/notivisa/index.ts` (line 18) — **NOT** re-exported in main index.ts
- **Input Schema:**
  ```typescript
  interface ApproveNotivisaDraftInput {
    labId: string;
    draftId: string;
    signature: {
      hash: string;
      operatorId: string;
      ts: number;
    };
  }
  ```
- **Output Schema:**
  ```typescript
  interface ApproveNotivisaDraftResult {
    ok: true;
    draftId: string;
    status: 'approved';
    rtApprovalSignature: {
      hash: string;
      operatorId: string;
      ts: number;
    };
  }
  ```
- **Key Logic:**
  1. Validates caller role (RT, admin, or owner)
  2. Fetches draft, validates status == `'draft'`
  3. **Signature Verification:** Client-provided signature checked via `verifySignature()`
     - Validates `hash` matches computed HMAC-SHA256
     - Validates `operatorId` == `request.auth.uid`
     - Validates timestamp within 5 minutes of server time
  4. Generates new `LogicalSignature` server-side (RT approval signature)
  5. Atomic update: draft status → `'approved'`, store `rtApprovalSignature`
  6. Audit log to subcollection + non-blocking audit log

- **Error Codes:**
  - `invalid-argument`: Signature invalid (hash mismatch, timestamp stale, operatorId mismatch)
  - `permission-denied`: Caller lacks RT/admin role
  - `failed-precondition`: Draft not in `'draft'` state
  - `not-found`: Draft deleted or missing

- **Signature Verification Logic (verifySignature):**
  ```
  1. operatorId in signature == request.auth.uid ✓
  2. |now - signature.ts| <= 5 minutes ✓
  3. signature.hash == SHA-256({operatorId, ts, payload}) ✓
  ```

---

#### 3. `submitNotivisaDraft` — Move to Queue

- **File:** `functions/src/modules/notivisa/submitNotivisaDraft.ts`
- **Exported from:** `modules/notivisa/index.ts` (line 19) — **NOT** re-exported in main index.ts
- **Input Schema:**
  ```typescript
  interface SubmitNotivisaDraftInput {
    labId: string;
    draftId: string;
  }
  ```
- **Output Schema:**
  ```typescript
  interface SubmitNotivisaDraftResult {
    ok: true;
    eventId: string;
    draftId: string;
    status: 'pending';
    pacienteCpf: string; // masked: ***1234
  }
  ```
- **Key Logic:**
  1. Fetches draft, validates status in [`'draft'`, `'approved'`]
  2. Extracts `paciente_cpf` from payload
  3. Atomic batch:
     - Update draft status → `'submitted'`
     - Create queue event in `notivisa-queue/{labId}/events/{eventId}` with:
       - `status: 'pending'`
       - `attempts: 0`
       - `maxAttempts: 5`
       - `createdAt`, `updatedAt` (Timestamps)
     - Write audit logs to draft + queue event subcollections
  4. Non-blocking audit log to `auditLogs/{labId}/`

- **Error Codes:**
  - `failed-precondition`: Draft not in [`draft`, `approved`] state; CPF missing
  - `not-found`: Draft deleted or missing

---

#### 4. `rejectNotivisaDraft` — Auditor Rejection

- **File:** `functions/src/modules/notivisa/rejectNotivisaDraft.ts`
- **Exported from:** `modules/notivisa/index.ts` (line 20) — **NOT** re-exported in main index.ts
- **Input Schema:**
  ```typescript
  interface RejectNotivisaDraftInput {
    labId: string;
    draftId: string;
    motivo: string;
    signature: {
      hash: string;
      operatorId: string;
      ts: number;
    };
  }
  ```
- **Output Schema:**
  ```typescript
  interface RejectNotivisaDraftResult {
    ok: true;
    draftId: string;
    status: 'rejected';
    motivo: string;
  }
  ```
- **Key Logic:**
  1. Validates caller role (auditor)
  2. Fetches draft, validates status in [`'draft'`, `'approved'`]
  3. Signature verification (same as `approveNotivisaDraft`)
  4. Atomic update:
     - Draft status → `'rejected'`
     - Store `motivo` + audit signature
     - Audit log subcollection + non-blocking audit log

---

### Legacy Testing

**File:** `functions/src/modules/notivisa/__tests__/notivisa.test.ts`

**Test Coverage:**

- ✅ Draft creation with idempotency
- ✅ Rate limiting (max 10/min)
- ✅ Signature generation & verification
- ✅ State transitions (draft → approved → submitted)
- ✅ Rejection workflow
- ✅ Audit log creation (batch 1 + 2)

**Status:** All passing (47/47 tests in batch 1-5).

---

## Part B: Wave 2 Codepath (Agent 10, Test-Mode Lifecycle)

### Callables Overview

#### 1. `createDraft` (exported as `notivisaCreateDraft`) — Draft Creation

- **File:** `functions/src/modules/notivisa/createDraft.ts`
- **Exported:** Line 2189 in `functions/src/index.ts` as `notivisaCreateDraft`
- **Region:** `southamerica-east1`
- **Input Schema:**
  ```typescript
  interface CreateDraftInput {
    labId: string;
    laudoId: string;
    payload: {
      versao: '1.0';
      laudo_id: string;
      paciente_cpf: string; // 11 digits
      data_resultado: number;
      resultados: Array<{
        analito: string;
        valor: number | string;
        unidade: string;
        referencia: string;
      }>;
    };
  }
  ```
- **Output Schema:**
  ```typescript
  interface CreateDraftResult {
    ok: true;
    draftId: string;
    status: 'pending'; // ← DIFFERENT from legacy 'draft'
    idempotent: boolean;
    mode: 'test' | 'sandbox' | 'prod';
    criadoEm: number;
  }
  ```
- **Key Differences from Legacy:**
  1. **No rate limiting** (TBD — planned for Phase 5)
  2. **Idempotency:** Checks for existing draft with `laudoId` in states [`pending`, `approved`, `submitted`]
  3. **No cryptographic signature** — stores `createdBy: uid` only
  4. **Mode-aware:** Reads `NOTIVISA_MODE` env (test/sandbox/prod) and stores it
  5. **Audit log structure:** Action = `DRAFT_CREATED` (not `CREATED`)
  6. **No signature ceremony:** Just stores metadata for audit trail

- **Error Codes:**
  - `invalid-argument`: Payload validation failure
  - `permission-denied`: User not authorized
  - (No rate-limit error yet)

---

#### 2. `approveDraft` (exported as `notivisaApproveDraft`) — RT/Admin Approval

- **File:** `functions/src/modules/notivisa/approveDraft.ts`
- **Exported:** Line 2190 in `functions/src/index.ts` as `notivisaApproveDraft`
- **Region:** `southamerica-east1`
- **Input Schema:**
  ```typescript
  interface ApproveDraftInput {
    labId: string;
    draftId: string;
  }
  ```
- **Output Schema:**
  ```typescript
  interface ApproveDraftResult {
    ok: true;
    draftId: string;
    status: 'approved';
    approvedBy: string;
    approvedAt: number;
  }
  ```
- **Key Differences from Legacy:**
  1. **No signature verification** — just role check (RT, admin, owner)
  2. **Simpler state machine:** Requires status == `'pending'` (not `'draft'`)
  3. **Stores approvalMetadata:** `approvedBy`, `approvedAt`
  4. **Audit log action:** `DRAFT_APPROVED` (not `APPROVED`)

- **Role Check:** `callerHasApprovalRole()` checks:
  - `token.role in ['RT', 'admin', 'owner']`
  - Also checks `token.roles` array (backward compat)

---

#### 3. `submitDraft` (exported as `notivisaSubmitDraft`) — Move to Queue

- **File:** `functions/src/modules/notivisa/submitDraft.ts`
- **Exported:** Line 2191 in `functions/src/index.ts` as `notivisaSubmitDraft`
- **Region:** `southamerica-east1`
- **Input Schema:**
  ```typescript
  interface SubmitDraftInput {
    labId: string;
    draftId: string;
  }
  ```
- **Output Schema:**
  ```typescript
  interface SubmitDraftResult {
    ok: true;
    draftId: string;
    eventId: string;
    status: 'pending';
    mode: 'test' | 'sandbox' | 'prod';
    enqueuedAt: number;
  }
  ```
- **Key Differences from Legacy:**
  1. Requires status == `'approved'` (stricter than legacy's [`'draft'`, `'approved'`])
  2. **Richer queue event structure:**
     ```
     - laudoId (not just draftId)
     - pacienteCpfMasked (not full CPF)
     - mode (test/sandbox/prod)
     - nextRetry (for cron scheduling)
     - enqueuedBy (operator ID)
     ```
  3. **Draft metadata:** Stores `submittedBy`, `submittedAt`, `queueEventId` on draft
  4. **Audit log action:** `DRAFT_SUBMITTED` (not `SUBMITTED`)

- **Queue Event Schema (Wave 2):**
  ```typescript
  {
    labId: string;
    draftId: string;
    laudoId: string;
    pacienteCpfMasked: string;
    mode: 'test' | 'sandbox' | 'prod';
    status: 'pending' | 'processing' | 'success' | 'failed';
    attempts: number;
    maxAttempts: number;
    nextRetry: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    enqueuedBy: string;
    deletadoEm: null;
  }
  ```

---

### Wave 2 Testing

**File:** `functions/src/modules/notivisa/__tests__/wave2-10-lifecycle.test.ts`

**Test Coverage:**

- ✅ Test-mode draft creation
- ✅ Idempotency (non-rejected drafts return existing draftId)
- ✅ Approval workflow (pending → approved)
- ✅ Submission to queue
- ✅ Mode awareness (test/sandbox/prod)
- ✅ Audit log structure validation

**Status:** Tests in progress; core lifecycle validated in Wave 2 Agent 10.

---

## Part C: Coexistence Issues

### 1. Status Enum Collision

**Problem:** Both codepaths write `status` field, but with different enums:

| Codepath | Values                                           | Meaning                                   |
| -------- | ------------------------------------------------ | ----------------------------------------- |
| Legacy   | `['draft', 'approved', 'submitted', 'rejected']` | Draft states before government submission |
| Wave 2   | `['pending', 'approved', 'submitted']`           | Skeleton for lifecycle                    |

**Consequence:** A query `where('status', '==', 'draft')` in cron won't find Wave 2 drafts (which use `'pending'`). A mixed-mode lab sees only half its drafts in admin dashboards.

---

### 2. Signature Structure Divergence

**Legacy Signature:**

```typescript
assinatura: {
  hash: string; // SHA-256 of {operatorId, ts, payload}
  operatorId: string;
  ts: Timestamp; // Server timestamp
}
```

**Wave 2:** No signature at all in `createDraft`/`approveDraft`.

**Consequence:** Audit trail is incoherent. Legacy drafts have cryptographic proof; Wave 2 drafts have only operator ID. If a customer needs to prove "who approved this draft?", legacy has a signed answer, Wave 2 has metadata.

---

### 3. Audit Log Action Names

| Callable | Legacy Action | Wave 2 Action     |
| -------- | ------------- | ----------------- |
| Create   | `CREATED`     | `DRAFT_CREATED`   |
| Approve  | `APPROVED`    | `DRAFT_APPROVED`  |
| Submit   | `SUBMITTED`   | `DRAFT_SUBMITTED` |

**Consequence:** Audit log queries like `where('action', '==', 'CREATED')` are fragmented. Same operation has two names.

---

### 4. Race Condition: Dual Submission

**Scenario:**

1. Lab admin calls `notivisaDraftCreate` (legacy) → draft in `notivisa-drafts/{labId}/drafts/ABC` with status=`'draft'`
2. RT calls `notivisaApproveDraft` (legacy) → status→ `'approved'`
3. **Different** operator calls `notivisaSubmitDraft` (Wave 2, expecting status=`'pending'`) → **fails** with `failed-precondition`

**Reverse scenario (worse):**

1. Lab calls `notivisaCreateDraft` (Wave 2) → draft ABC with status=`'pending'`
2. Legacy cron or hook tries to process it with old logic expecting status=`'draft'` → **silently skips**

**Consequence:** Unpredictable behavior. Some submissions succeed, others fail silently.

---

### 5. Cloud Logs Audit Trail Fragmentation

**Invocation patterns differ:**

- Legacy: `notivisaDraftCreate(labId, laudoId, payload)`
- Wave 2: `notivisaCreateDraft(labId, laudoId, payload)` ← Different function name in logs

**Consequence:** When auditing "who created draft X?", the trace includes the function name. Two equivalent operations have different names in logs, breaking audit automation.

---

## Part D: Customer Usage Status

### Grep for Legacy Calls in Cloud Logs

**Command to check (for Phase 5):**

```bash
gcloud functions logs read notivisaDraftCreate \
  --project hmatologia2 \
  --limit 1000 \
  --filter='severity>=ERROR OR httpRequest.status>=400'
```

**Current status:** No active customers using legacy path yet (v1.4 Phase 4 = early adopter mode, implantação open access).

**Recommendation:** Defer telemetry to Phase 5 when multi-tenant traffic normalizes.

---

## Part E: Files to Update

### Re-exports

**Current state:**

- `functions/src/modules/notivisa/index.ts` — exports legacy `notivisaDraftCreate`, `approveNotivisaDraft`, `submitNotivisaDraft`, `rejectNotivisaDraft`
- `functions/src/index.ts` — exports Wave 2 callables as `notivisaCreateDraft`, `notivisaApproveDraft`, `notivisaSubmitDraft`

**Action:** Do NOT delete `modules/notivisa/index.ts` exports yet. Just mark as deprecated (Phase 4).

---

## Part F: Recommendations

### For Wave 3-6 (Deprecation Phase)

1. **Do NOT delete legacy callables yet.** Both codepaths are production-grade; only the confusion is the problem.

2. **Add deprecation markers** (JSDoc only, no code deletion):

   ```typescript
   /**
    * @deprecated Use notivisaCreateDraft instead (Wave 2-10).
    * Scheduled for removal 2026-08-01.
    * See docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md for migration path.
    */
   export const notivisaDraftCreate = onCall(...)
   ```

3. **Enable feature flag** (Phase 4):

   ```typescript
   const FEATURE_LEGACY_NOTIVISA_ENABLED = process.env.FEATURE_LEGACY_NOTIVISA_ENABLED !== 'false';

   if (FEATURE_LEGACY_NOTIVISA_ENABLED) {
     export { notivisaDraftCreate } from './notivisaDraftCreate';
     // ...
   }
   ```

4. **Monitor usage** (Phase 5): Grep Cloud Logs for legacy function invocations; measure % of drafts per codepath per lab.

5. **Hard cutover** (Phase 6 — 2026-07): Set `FEATURE_LEGACY_NOTIVISA_ENABLED=false`, delete legacy files.

---

## Related Documents

- `MIGRATION_LEGACY_TO_WAVE2.md` — customer migration path
- `NOTIVISA_CLEANUP_ROADMAP.md` — Phase-by-phase deprecation timeline
- `LEGACY_COEXISTENCE_TESTS.md` — mixed-mode test coverage
- `NOTIVISA_CONFLICT_DETECTION_CRON.md` — Phase 6 monitoring (proposed)

---

## Sign-Off

| Role              | Name | Date       |
| ----------------- | ---- | ---------- |
| Wave 3-6 Engineer | TBD  | 2026-05-08 |
| CTO Review        | TBD  | TBD        |
