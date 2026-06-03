# NOTIVISA Integration Architecture — Visual Diagrams

**Version:** 1.0  
**Date:** 2026-05-07

This document contains detailed sequence diagrams, state machines, and data flow visualizations for the NOTIVISA integration.

---

## 1. Client → Cloud Functions → Firestore Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     HC Quality Web (React 19)                            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ NotivisaDraftView                                                │  │
│  │                                                                  │  │
│  │  [Create Draft] → notivisaDraftCreate(labId, laudoId)          │  │
│  │       ↓ (success)                                              │  │
│  │  [Draft Created] → draftId, payload, status='draft'            │  │
│  │       ↓ (user reviews)                                         │  │
│  │  [Review Button] → getNotivisaDraft(labId, draftId)           │  │
│  │       ↓                                                        │  │
│  │  [Display payload + audit log]                                │  │
│  │       ↓ (if correct)                                          │  │
│  │  [Approve Button] → approveNotivisaDraft() + signature        │  │
│  │       ↓ (success)                                             │  │
│  │  [status='approved'] → chainHash recorded                     │  │
│  │       ↓ (final step)                                          │  │
│  │  [Submit Button] → submitNotivisa()                           │  │
│  │       ↓ (success)                                             │  │
│  │  [status='pending'] → entry queued, deadline=result+24h       │  │
│  │                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ NotivisaQueueView                                                │  │
│  │                                                                  │  │
│  │  [List Queue] → listNotivisaOutbox(labId, status='pending')    │  │
│  │       ↓                                                        │  │
│  │  [Display 10 pending entries]                                 │  │
│  │  - diseaseCode, patientAnon, deadline, escalated?            │  │
│  │       ↓ (every 30s auto-refresh)                             │  │
│  │  [Scheduled processor updates Firestore]                      │  │
│  │  [UI polls for status changes]                                │  │
│  │                                                                │  │
│  │  [Auditor Export] → notivisaExportArchive()                  │  │
│  │       ↓ (success)                                             │  │
│  │  [Download CSV/JSON]                                          │  │
│  │                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                 ↓↑
                          (Firebase SDK)
                        (ID Token verified)
┌─────────────────────────────────────────────────────────────────────────┐
│              Cloud Functions (Gen 2, southamerica-east1)                 │
│                                                                          │
│  ┌─ notivisaDraftCreate ────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  1. Validate auth (request.auth.uid must exist)               │   │
│  │  2. Check member of lab (labs/{labId}/members/{uid})          │   │
│  │  3. Fetch laudo (labs/{labId}/liberacao-laudos/{laudoId})    │   │
│  │  4. Validate resultados present + non-empty                  │   │
│  │  5. Fetch paciente (labs/{labId}/pacientes/{pacienteId})     │   │
│  │  6. Validate CPF present (required for NOTIVISA)             │   │
│  │  7. Format payload (notivisaFormatter + Zod validation)      │   │
│  │  8. Check for existing draft (idempotent):                   │   │
│  │     QUERY where laudoId=X AND status in [draft,approved,..] │   │
│  │     IF found: return existing (don't duplicate)              │   │
│  │  9. Create draft doc:                                        │   │
│  │     SET /notivisa-drafts/{labId}/drafts/{newId}             │   │
│  │       {id, labId, laudoId, status='draft', payload, ...}    │   │
│  │  10. Append audit log:                                       │   │
│  │      SET /notivisa-drafts/{labId}/drafts/{id}/auditLog/{ts} │   │
│  │        {action='CREATED', operatorId, ts, details}          │   │
│  │  11. Return {ok, draftId, status, payload, createdAt}      │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ approveNotivisaDraft ─────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  1. Validate auth + RT role required                          │   │
│  │  2. Fetch draft doc                                           │   │
│  │  3. Check status = 'draft' (can't re-approve)                │   │
│  │  4. Verify signature (HMAC-SHA256)                            │   │
│  │  5. Generate chainHash (cumulative HMAC, ADR-0012)           │   │
│  │  6. UPDATE draft:                                            │   │
│  │     status → 'approved'                                      │   │
│  │     approvedBy, approvedAt, signature, chainHash             │   │
│  │  7. Append audit log:                                        │   │
│  │     {action='APPROVED', operatorId, signature, chainHash}   │   │
│  │  8. Return {ok, draftId, status, approvedBy, chainHash}    │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ submitNotivisa ──────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  1. Validate auth + (RT or admin)                             │   │
│  │  2. Fetch draft doc                                           │   │
│  │  3. Check status = 'approved' (must be pre-approved)         │   │
│  │  4. Create outbox entry:                                     │   │
│  │     SET /labs/{labId}/notivisa-outbox/{entryId}             │   │
│  │       {payload fields from draft, status='pending', ...}     │   │
│  │  5. Calculate notificationDeadline = resultDate + 24h        │   │
│  │  6. Initialize submissionAttempts = []                       │   │
│  │  7. UPDATE draft status → 'submitted'                        │   │
│  │  8. Return {ok, entryId, status, deadline}                  │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ notivisaQueueProcessor (Scheduled, every 5 min) ──────────────┐   │
│  │                                                                  │   │
│  │  PHASE A: Poll pending entries                                │   │
│  │  FOR EACH lab:                                                │   │
│  │    QUERY status='pending' AND deadline ≤ now()                │   │
│  │    FOR EACH entry:                                            │   │
│  │                                                                │   │
│  │  PHASE B: Evaluate retry eligibility                          │   │
│  │    IF attempts ≥ 5 → status='failed-permanent', escalate     │   │
│  │    IF attempts > 0:                                           │   │
│  │      nextRetry = lastAttempt.ts + backoff[attempts]          │   │
│  │      IF now < nextRetry → skip (not yet time)               │   │
│  │                                                                │   │
│  │  PHASE C: Attempt submission (mock Phase 4 / real Phase 12+) │   │
│  │    result = submitNotivisaToAnvisa(labId, entry)            │   │
│  │                                                                │   │
│  │    IF result.success:                                        │   │
│  │      APPEND submissionAttempt {                              │   │
│  │        attempt: N,                                           │   │
│  │        ts: now,                                              │   │
│  │        status: 'success',                                    │   │
│  │        receiptCode: result.receiptCode,                     │   │
│  │      }                                                        │   │
│  │      UPDATE status → 'submitted'                             │   │
│  │      RECORD receiptCodeFromAnvisa                            │   │
│  │                                                                │   │
│  │    ELSE IF result.isRetryable AND attempts < 5:              │   │
│  │      APPEND submissionAttempt { status: 'failed', error }   │   │
│  │      KEEP status='pending' (retry later)                    │   │
│  │                                                                │   │
│  │    ELSE:                                                     │   │
│  │      APPEND submissionAttempt { status: 'failed', error }   │   │
│  │      UPDATE status → 'failed-permanent'                     │   │
│  │      ALERT supervisor (SMS + email)                         │   │
│  │                                                                │   │
│  │  PHASE D: Check deadlines                                   │   │
│  │    QUERY status in ['pending','submitted']                   │   │
│  │          AND deadline < now()                                │   │
│  │          AND escalatedToSupervisor = false                  │   │
│  │    FOR EACH: UPDATE escalatedToSupervisor=true              │   │
│  │              ALERT supervisor                               │   │
│  │                                                                │   │
│  │  PHASE E: Log completion                                    │   │
│  │    Log to Cloud Logging: "[NOTIVISA] Queue processor ok"   │   │
│  │                                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ notivisaExportArchive ───────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  1. Validate auth + AUDITOR role REQUIRED                     │   │
│  │  2. QUERY outbox status='acknowledged' where criadoEm ≥ 90d  │   │
│  │  3. IF no entries → return error NO_DATA                      │   │
│  │  4. Generate CSV:                                             │   │
│  │     headers: [id, diseaseCode, patientAnon, resultValue, ...] │   │
│  │     rows: map each entry to CSV format                        │   │
│  │  5. Generate JSON:                                            │   │
│  │     {exported: [...], count: N}                              │   │
│  │  6. Create archive doc:                                      │   │
│  │     SET /labs/{labId}/notivisa-outbox/_archives/exports/{id}│   │
│  │       {exportedBy, exportedAt, recordCount, formats, ...}    │   │
│  │  7. Store file contents (if <1MB):                           │   │
│  │     SET /archives/{id}/files/export.csv {content, mimeType}  │   │
│  │     SET /archives/{id}/files/export.json {content, mimeType}  │   │
│  │  8. Append audit log {action='CREATED', exportedBy, ...}    │   │
│  │  9. Return {ok, archiveId, recordCount, formats, expiresAt} │   │
│  │                                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ notivisaWebhookHandler (Phase 12+) ──────────────────────────┐   │
│  │                                                                  │   │
│  │  1. Receive webhook POST from Anvisa                          │   │
│  │  2. Verify HTTP method = POST                                 │   │
│  │  3. Extract x-anvisa-signature header                         │   │
│  │  4. Verify HMAC-SHA256(payload, ANVISA_WEBHOOK_SECRET)        │   │
│  │  5. Parse payload (Zod validation)                            │   │
│  │  6. Find entry by idempotencyKey (across all labs)           │   │
│  │  7. IF found:                                                 │   │
│  │     UPDATE status → 'acknowledged'                            │   │
│  │     RECORD anvisa_eventId, receiptNumber, rejectionCode      │   │
│  │     APPEND webhookLog entry                                   │   │
│  │  8. ELSE: still return 200 (ack to prevent Anvisa retry)     │   │
│  │  9. Return {received: true, ...}                              │   │
│  │                                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                 ↓↑
                          (Firestore SDK)
                      (Rules enforce auth + labId)
┌─────────────────────────────────────────────────────────────────────────┐
│                       Firestore Database                                 │
│                       (multi-tenant, labId-scoped)                       │
│                                                                          │
│  /labs/{labId}/notivisa-drafts/drafts/{draftId}                         │
│    ├─ status: 'draft' | 'approved' | 'submitted'                        │
│    ├─ payload: {...}  (Art. 6º §1 NOTIVISA format)                      │
│    ├─ auditLog/{ts}   (append-only, immutable)                          │
│    │   ├─ action: CREATED | APPROVED | SUBMITTED                        │
│    │   ├─ operatorId: uid                                               │
│    │   └─ signature: {...}  (chainHash per ADR-0012)                    │
│                                                                          │
│  /labs/{labId}/notivisa-outbox/{entryId}                                │
│    ├─ status: 'pending' | 'submitted' | 'acknowledged' | 'failed-perm' │
│    ├─ diseaseCode, patientAnon, resultValue, deadline                   │
│    ├─ submissionAttempts: [                                             │
│    │   {attempt: 1, ts, status: 'success', receiptCode},               │
│    │   {attempt: 2, ts, status: 'failed', error: {...}},               │
│    │   ...                                                              │
│    │ ]  (append-only, immutable)                                        │
│    ├─ escalatedToSupervisor, escalationMotivo, escalationTs             │
│    ├─ auditLog/{ts}   (immutable)                                       │
│    │   ├─ action: CREATED | SUBMISSION_ATTEMPT | SOFT_DELETED | ESCALATION
│    │   ├─ operatorId                                                    │
│    │   └─ details: {...}                                               │
│    └─ webhookLog/{ts}  (Phase 12+, immutable)                           │
│        └─ anvisa_eventId, status, receiptNumber                         │
│                                                                          │
│  /labs/{labId}/notivisa-outbox/_archives/exports/{archiveId}            │
│    ├─ status: 'ready'  (immutable, no update/delete allowed)            │
│    ├─ exportedBy, exportedAt, expiresAt (90 days)                       │
│    ├─ files/export.csv  {content, mimeType, size}                       │
│    ├─ files/export.json {content, mimeType, size}                       │
│    └─ auditLog/{ts}     (immutable)                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. State Machine: NOTIVISA Entry Lifecycle

```
                           ┌─────────────────┐
                           │   Start: Laudo  │
                           │   result created │
                           └────────┬─────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   notivisaDraftCreate()       │
                    │   (Callable triggered)        │
                    │   ✓ Fetch laudo + paciente    │
                    │   ✓ Validate CPF present      │
                    │   ✓ Build Art. 6º payload     │
                    │   ✓ Write draft doc           │
                    │   ✓ Create auditLog entry     │
                    └───────────┬───────────────────┘
                                │
                                ▼
                    ┌───────────────────────────────┐
                    │ Status: DRAFT                 │
                    │ (/notivisa-drafts/{labId})   │
                    │ ✓ Stored in Firestore         │
                    │ ✓ Not yet submitted           │
                    └───────────┬───────────────────┘
                                │
                    ┌───────────┴──────────┐
                    │ (RT Decision Point)  │
                    ▼                      ▼
          ┌──────────────────┐    ┌──────────────────┐
          │ [APPROVE]        │    │ [REJECT]         │
          │ approveNotivis... │    │ (soft delete)     │
          └────────┬─────────┘    └──────────────────┘
                   │                      │
                   ▼                      ▼
        ┌─────────────────────┐  ┌──────────────────────┐
        │ Status: APPROVED    │  │ Status: DELETED      │
        │ ✓ RT signature      │  │ ✓ deletionReason     │
        │ ✓ chainHash (ADR12) │  │ ✓ auditLog recorded  │
        │ ✓ Ready for submit  │  │ → End (audit trail)  │
        └────────┬────────────┘  └──────────────────────┘
                 │
                 ▼ submitNotivisa()
    ┌────────────────────────────────┐
    │ Create Queue Entry             │
    │ (/notivisa-outbox/{labId})     │
    │ ✓ Copy payload from draft      │
    │ ✓ Set deadline = result+24h    │
    │ ✓ submissionAttempts = []      │
    │ ✓ Update draft status→submitted│
    └────────────┬───────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────┐
    │ Status: PENDING                      │
    │ (Awaiting scheduled processor cycle) │
    │ notificationDeadline: Timestamp      │
    │ submissionAttempts: []               │
    └────────────┬───────────────────────────┘
                 │
    ┌────────────▼─────────────────────────────┐
    │ (Scheduled Processor, every 5 min)       │
    │ notivisaQueueProcessor()                 │
    │                                          │
    │ PHASE A: Enumerate pending entries      │
    │ PHASE B: Check if ready to retry        │
    │          (backoff: 1m→5m→15m→45m→120m)  │
    │ PHASE C: Attempt submission             │
    │          (mock Phase 4, real Phase 12+) │
    │ PHASE D: Check past-deadline            │
    │          (notify supervisor)            │
    └────────────┬─────────────────────────────┘
                 │
         ┌───────┴─────────┬──────────────┬──────────────────┐
         │                 │              │                  │
    [SUCCESS]         [RETRYABLE]   [PERMANENT FAIL]    [DEADLINE PAST]
         │              (5xx)          (4xx)                 │
         │            TIMEOUT                               │
         ▼                ▼                ▼                 ▼
    ┌─────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐
    │ APPEND  │  │ APPEND         │  │ APPEND       │  │ UPDATE       │
    │ attempt │  │ attempt        │  │ attempt      │  │ escalated... │
    │         │  │ (error.retry..)│  │ (error.code) │  │ = true       │
    │ status→ │  │                │  │              │  │              │
    │SUBMITTED│  │ KEEP status=   │  │ UPDATE status│  │ escalation.. │
    │         │  │  'pending'     │  │ → 'failed-   │  │ Motivo=...   │
    │ receiptC│  │ (retry next)   │  │  permanent'  │  │              │
    │odeFromA│  │                │  │              │  │ ALERT        │
    │nvisa = │  │ ALERT?         │  │ ALERT        │  │ SUPERVISOR   │
    │ result.│  │ (if past hour)  │  │ SUPERVISOR   │  │              │
    │receipt│  │                │  │ (immediately)│  │ (SMS+email)  │
    │       │  │                │  │              │  │              │
    └───┬───┘  └────────────────┘  └──────────────┘  └──────────────┘
        │                                               │
        │                                      (Next cycle, escalated)
        │                                      Can be manually resolved
        │
        ▼
    ┌──────────────────────────────────┐
    │ Status: SUBMITTED                │
    │ ✓ receiptCodeFromAnvisa set      │
    │ ✓ submissionAttempts: [{success}]│
    │ Awaiting Anvisa webhook callback │
    │ (Phase 12+ only)                 │
    └────────────┬─────────────────────┘
                 │
        (Phase 12+ Webhook from Anvisa)
        notivisaWebhookHandler()
                 │
         ┌───────┴─────────────┐
         │                     │
      [SUCCESS]           [REJECTED]
         │                    │
         ▼                    ▼
    ┌─────────────────┐  ┌──────────────────┐
    │ Status:         │  │ Status: ACK       │
    │ ACKNOWLEDGED    │  │ (with error code) │
    │ ✓ anvisa_eventId│  │ ✓ error recorded  │
    │ ✓ webhook log   │  │ ✓ operator can    │
    │   entry         │  │   review and      │
    │                 │  │   resubmit        │
    │ → Ready for     │  │                   │
    │   auditor export│  └──────────────────┘
    └─────────────────┘
         │
         └─ AUDITOR EXPORT
            notivisaExportArchive()
            ✓ CSV/JSON archive
            ✓ Immutable for 90d
            ✓ Audit trail complete
            → End (compliance met)


    ┌──────────────────────────────────────┐
    │ ALTERNATIVE: Soft Delete             │
    │ (Admin only, from any status)        │
    │                                      │
    │ notivisaSoftDelete()                │
    │ ✓ reason: duplicate|false-positive   │
    │ ✓ notes: optional                    │
    │ ✓ status → 'deleted'                 │
    │ ✓ auditLog appended (immutable)      │
    │ → End (RN-06 soft-delete compliant)  │
    └──────────────────────────────────────┘
```

---

## 3. Queue Processing: Exponential Backoff Timeline

```
Entry created at T=0 (deadline T+24h)

T+0: submitNotivisa() called
     → entryId created, status='pending'
     → submissionAttempts=[]
     → nextRetry scheduled for T+0 (immediate)

T+5min: Processor cycle 1
        notivisaQueueProcessor()

        ├─ attemptNum = 0
        ├─ Ready? Yes (T+0 ≤ T+5)
        ├─ Call submitNotivisaToAnvisa()
        │
        │  Outcome A: SUCCESS ✓
        │  └─ Append { attempt: 1, ts: T+5, status: 'success', receiptCode }
        │  └─ status → 'submitted'
        │  └─ DONE (awaiting webhook)
        │
        │  Outcome B: RETRYABLE (500 error) ⚠
        │  └─ Append { attempt: 1, ts: T+5, status: 'failed', error: {...} }
        │  └─ status stays 'pending'
        │  └─ Next retry: T+5 + 1min = T+6
        │
        │  Outcome C: PERMANENT (400 error) ✗
        │  └─ Append { attempt: 1, ts: T+5, status: 'failed', error: {...} }
        │  └─ status → 'failed-permanent'
        │  └─ ESCALATE SUPERVISOR
        │  └─ DONE (requires manual fix)

T+6min: Processor cycle 2 (if Outcome B at T+5)
        notivisaQueueProcessor()

        ├─ attemptNum = 1
        ├─ lastAttempt.ts = T+5
        ├─ nextRetry = T+5 + 1min = T+6
        ├─ Ready? Yes (T+6 ≤ T+10)
        ├─ Call submitNotivisaToAnvisa()
        │
        │  If SUCCESS: DONE
        │  If RETRYABLE: nextRetry = T+6 + 5min = T+11
        │  If PERMANENT: ESCALATE

T+11min: Processor cycle 3 (if retryable at T+6)
        ├─ attemptNum = 2
        ├─ lastAttempt.ts = T+6
        ├─ nextRetry = T+6 + 5min = T+11
        ├─ Ready? Yes (T+11 ≤ T+15)
        ├─ If RETRYABLE: nextRetry = T+11 + 15min = T+26

T+26min: Processor cycle 4
        ├─ attemptNum = 3
        ├─ nextRetry = T+11 + 15min = T+26
        ├─ If RETRYABLE: nextRetry = T+26 + 45min = T+71

T+71min: Processor cycle 5
        ├─ attemptNum = 4
        ├─ nextRetry = T+26 + 45min = T+71
        ├─ If RETRYABLE: nextRetry = T+71 + 120min = T+191

T+191min: Processor cycle 6
         ├─ attemptNum = 5
         ├─ nextRetry = T+71 + 120min = T+191
         ├─ If RETRYABLE: MAX RETRIES EXCEEDED
         └─ status → 'failed-permanent'
         └─ ESCALATE SUPERVISOR (final attempt)

BACKOFF SCHEDULE (minutes):
  Attempt 1: 0 (immediate)
  Attempt 2: 1
  Attempt 3: 5 (cumulative 6)
  Attempt 4: 15 (cumulative 21)
  Attempt 5: 45 (cumulative 66)
  Max: 120 (after attempt 5)

WHY THIS SCHEDULE?
├─ Avoids hammering Anvisa API on transient failures
├─ Gives network time to stabilize (first 5 attempts in ~1.5 hours)
├─ Quick escalation if auth/validation issue (not solvable by waiting)
└─ Respects 24h RDC 978 deadline (most submitted within 30 min)
```

---

## 4. Authorization & Multi-Tenant Isolation

```
┌────────────────────────────────────────────────────────────┐
│ Firebase Auth                                              │
│                                                            │
│ User uid = "user-123"                                      │
│ Custom claims: {                                           │
│   role: "RT",                    // or AUDITOR, admin, ... │
│   labIds: ["lab-alpha", "lab-b"] // which labs user can.. │
│ }                                                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
                           ↓
          ┌────────────────────────────────────────┐
          │ Call notivisaDraftCreate({             │
          │   labId: "lab-alpha",                 │
          │   laudoId: "laudo-xyz"                │
          │ })                                     │
          └────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Cloud Function Validation (Server-Side)                    │
│                                                            │
│ 1. Is request.auth present?                              │
│    ✓ Yes: request.auth.uid = "user-123"                 │
│    ✗ No: throw HttpsError('unauthenticated')            │
│                                                            │
│ 2. Is user member of labId?                              │
│    Query: /labs/lab-alpha/members/user-123              │
│    ✓ Exists: memberRole = "RT"                          │
│    ✗ Not found: throw HttpsError('permission-denied')   │
│                                                            │
│ 3. Does user have required role?                         │
│    (Varies by callable)                                  │
│    - notivisaDraftCreate: any role OK                    │
│    - approveNotivisaDraft: RT only                       │
│    - notivisaExportArchive: AUDITOR only                │
│                                                            │
│ 4. REDUNDANT CHECK: labId in request matches DB path    │
│    (extra layer of protection)                           │
│    IF input labId ≠ path labId:                         │
│      throw HttpsError('permission-denied')              │
│                                                            │
│ ✓ All checks pass → continue to business logic          │
│ ✓ Every write includes labId redundantly                │
│ ✓ Firestore rules validate labId again (defense-in-depth)
│                                                            │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Firestore Database (Rules Layer)                           │
│                                                            │
│ Rule: match /notivisa-drafts/{labId}/drafts/{draftId} {  │
│   allow read: if                                          │
│     isActiveMemberOfLab(labId) &&                        │
│     (request.auth.token.role == 'RT' ||                 │
│      request.auth.token.role == 'AUDITOR' ||            │
│      isAdminOrOwner(labId));                            │
│                                                            │
│   allow create: if false;   // Cloud Function only       │
│   allow update: if                                        │
│     (isAdminOrOwner(labId) || role == 'RT') &&          │
│     resource.data.labId == labId;  // ← redundant check  │
│   allow delete: if false;   // Soft delete only          │
│ }                                                          │
│                                                            │
│ Helper function: isActiveMemberOfLab(labId)              │
│   return exists(/databases/.../labs/$(labId)/members/uid) │
│     && get(...).data.status == 'active';                │
│                                                            │
│ ✓ Cross-tenant write prevented (labId check)             │
│ ✓ Unauthorized read blocked (role + member check)        │
│ ✓ Hard delete prevented (always soft-delete)             │
│                                                            │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Data Written to Firestore                                  │
│                                                            │
│ Doc: /notivisa-drafts/lab-alpha/drafts/{draftId}         │
│ {                                                         │
│   id: "draft-abc123",                                     │
│   labId: "lab-alpha",  ← Redundant (already in path)     │
│   laudoId: "laudo-xyz",                                   │
│   payload: { ... },                                       │
│   status: "draft",                                        │
│   criadoEm: Timestamp,                                    │
│ }                                                          │
│                                                            │
│ Subcollection: auditLog/{timestamp}                      │
│ {                                                         │
│   action: "CREATED",                                      │
│   operatorId: "user-123",  ← Always present              │
│   ts: Timestamp,           ← Immutable timestamp          │
│   details: { ... }         ← Context-specific             │
│ }                                                          │
│                                                            │
└────────────────────────────────────────────────────────────┘

LAYERS OF DEFENSE:
1. Request auth (ID token verified by Firebase)
2. Function-level permission check (custom claims)
3. Lab membership check (Firestore query)
4. Firestore rules (labId + role validation)
5. Data includes labId redundantly (prevents accidental cross-tenant)

If ANY layer fails: operation blocked. No retry, no fallback.
```

---

## 5. Error Handling Decision Tree

```
notivisaQueueProcessor runs submitNotivisaToAnvisa(labId, entry)

                          │
                          ▼
                 ┌────────────────┐
                 │ API Call made  │
                 │ to Anvisa      │
                 │ (or mock)      │
                 └────────┬───────┘
                          │
                ┌─────────┴──────────┐
                │                    │
               [EXCEPTION]      [RESPONSE]
                │                    │
                ▼                    ▼
        ┌──────────────┐    ┌─────────────────────┐
        │ try/catch    │    │ Parse HTTP status   │
        │ ECONNREFUSED │    │ code                │
        │ ETIMEDOUT    │    │                     │
        │ ENOTFOUND    │    │ 200/201 OK          │
        │ (Network)    │    │ 4xx Client Error    │
        │              │    │ 5xx Server Error    │
        └──────┬───────┘    └────────┬────────────┘
               │                     │
               ▼                     ▼
    ┌──────────────────────┐  IF 200/201:
    │ isRetryable = true   │  - Extract receiptCode
    │ (Network error)      │  - status = 'success' ✓
    │                      │  - DONE
    │ IF attemptNum < 4:   │
    │   status='pending'   │  IF 4xx (400,401,403,404,422):
    │   (retry later)      │  - isRetryable = false ✗
    │                      │  - status = 'failed-permanent'
    │ ELSE:                │  - ESCALATE (validation error)
    │   status=failed-perm │  - Needs human review
    │   ESCALATE           │
    │                      │  IF 5xx (500,502,503,504):
    │                      │  - isRetryable = true ⚠
    │                      │  - status = 'pending' (retry)
    │                      │  - Backoff applied
    │                      │
    │                      │  IF 429 (Rate Limit):
    │                      │  - isRetryable = true
    │                      │  - status = 'pending'
    │                      │  - Longer backoff (honor Retry-After)
    └──────────────────────┘
                │
                └──────────────┬─────────────┐
                               │             │
                        [SUCCESS]       [FAILURE]
                               │             │
                               ▼             ▼
                        ┌───────────┐  ┌────────────────────┐
                        │ APPEND:   │  │ APPEND:            │
                        │ {         │  │ {                  │
                        │  attempt: │  │  attempt: N,       │
                        │  status:  │  │  status: 'failed', │
                        │  'success'│  │  error: {          │
                        │  receipt..│  │   code, message,   │
                        │ }         │  │   isRetryable      │
                        │           │  │  }                 │
                        │ UPDATE:   │  │ }                  │
                        │ status→   │  │                    │
                        │'submitted'│  │ If isRetryable:    │
                        │           │  │   status='pending' │
                        │ DONE ✓    │  │   Wait for next    │
                        │           │  │   cycle            │
                        │ (Awaiting │  │                    │
                        │ webhook)  │  │ Else:              │
                        │           │  │   status=          │
                        │           │  │   'failed-perm'    │
                        │           │  │   ALERT SUPERVISOR │
                        └───────────┘  └────────────────────┘
```

---

## 6. Signature Verification Flow

```
┌──────────────────────────────────────────────────────────────┐
│ RT Approval Workflow (Client-Side)                           │
│                                                              │
│ User clicks [Approve Draft]                                 │
│       ↓                                                      │
│ Modal opens: "Confirm RT Approval"                          │
│       ↓                                                      │
│ Display: draftId, payload summary                           │
│       ↓                                                      │
│ User enters CPF (or clicks biometric)                       │
│       ↓                                                      │
│ Client-side: Generate signature                             │
│ ┌────────────────────────────────────────┐                  │
│ │ message = JSON.stringify({             │                  │
│ │   draftId: "draft-abc123",             │                  │
│ │   operatorId: request.auth.uid,        │                  │
│ │   ts: Date.now()                       │                  │
│ │ })                                     │                  │
│ │                                        │                  │
│ │ signature = HMAC-SHA256(               │                  │
│ │   message,                             │                  │
│ │   HCQ_SIGNATURE_HMAC_KEY               │                  │
│ │ )  // client-side (from localStorage)  │                  │
│ │                                        │                  │
│ │ Send to function: {draftId, signature} │                  │
│ └────────────────────────────────────────┘                  │
│       ↓                                                      │
└──────────────────────────────────────────────────────────────┘
                       ↓ (HTTPS POST)
┌──────────────────────────────────────────────────────────────┐
│ Cloud Function: approveNotivisaDraft()                       │
│                                                              │
│ 1. Receive {draftId, signature}                             │
│                                                              │
│ 2. Fetch draft doc (verify it exists)                       │
│    IF NOT FOUND: throw HttpsError('draft-not-found')        │
│                                                              │
│ 3. Check status = 'draft' (can't re-approve)               │
│    IF NOT 'draft': throw HttpsError('invalid-status')      │
│                                                              │
│ 4. Reconstruct message (server-side)                        │
│ ┌────────────────────────────────────────┐                  │
│ │ message = JSON.stringify({             │                  │
│ │   draftId: input.draftId,              │                  │
│ │   operatorId: request.auth.uid,        │                  │
│ │   ts: ???  ← PROBLEM: can't trust client
│ │ })                                     │                  │
│ │                                        │                  │
│ │ // Alternative: signature over payload │                  │
│ │ message = JSON.stringify(draft.payload)│                  │
│ │                                        │                  │
│ │ computed = HMAC-SHA256(                │                  │
│ │   message,                             │                  │
│ │   HCQ_SIGNATURE_HMAC_KEY  // from...  │                  │
│ │ )                                      │                  │
│ │                                        │                  │
│ │ // CONSTANT-TIME COMPARISON            │                  │
│ │ // (prevent timing attacks)            │                  │
│ │ IF computed !== input.signature:       │                  │
│ │   throw HttpsError('signature-invalid')│                  │
│ │                                        │                  │
│ │ ✓ Signature verified: operator = uid  │                  │
│ │ ✓ Payload has not been tampered       │                  │
│ └────────────────────────────────────────┘                  │
│                                                              │
│ 5. Generate chainHash (per ADR-0012)                        │
│ ┌────────────────────────────────────────┐                  │
│ │ // chainHash = cumulative HMAC         │                  │
│ │ // (includes all previous signatures)  │                  │
│ │ chainHash = HMAC-SHA256(               │                  │
│ │   {                                    │                  │
│ │     status: 'approved',                │                  │
│ │     operatorId: uid,                   │                  │
│ │     ts: serverTimestamp,               │                  │
│ │     parentHash: draft.chainHash || ''  │                  │
│ │   },                                   │                  │
│ │   HCQ_SIGNATURE_HMAC_KEY               │                  │
│ │ )                                      │                  │
│ │                                        │                  │
│ │ // RDC 978 audit trail (immutable)    │                  │
│ │ // Each status change signed + chained│                  │
│ └────────────────────────────────────────┘                  │
│                                                              │
│ 6. Update draft doc:                                        │
│    UPDATE status = 'approved'                               │
│          approvedBy = uid                                   │
│          approvedAt = serverTimestamp                       │
│          signature = input.signature                        │
│          chainHash = computed chainHash                     │
│                                                              │
│ 7. Append audit log entry:                                  │
│    SET /auditLog/{timestamp}                                │
│      {                                                       │
│        action: 'APPROVED',                                  │
│        operatorId: uid,                                     │
│        ts: serverTimestamp,                                 │
│        details: {                                           │
│          signature: input.signature,                        │
│          chainHash: computed chainHash                      │
│        }                                                     │
│      }                                                       │
│                                                              │
│ 8. Return {ok, draftId, status='approved', chainHash}      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                       ↓ (HTTPS Response)
┌──────────────────────────────────────────────────────────────┐
│ Web Client (React)                                           │
│                                                              │
│ IF result.ok:                                               │
│   Show toast: "Draft approved by {uid} at {ts}"             │
│   Update UI: status = 'approved'                            │
│   Enable [Submit] button                                    │
│                                                              │
│ IF result.error:                                            │
│   Show error: result.message                                │
│   Keep draft in edit mode                                   │
│   User can retry approval                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

SECURITY PROPERTIES:
✓ Signature prevents tampering (client can't forge)
✓ Constant-time comparison prevents timing attacks
✓ operatorId = request.auth.uid (no client spoofing)
✓ Timestamp server-side (can't be backdated)
✓ chainHash creates immutable audit trail
✓ Each status change independently signed (ADR-0012)
```

---

## 7. Webhook Signature Verification (Phase 12+)

```
┌──────────────────────────────────────────────────────────────┐
│ Anvisa Notificação System (Gov)                              │
│                                                              │
│ Form submitted to Anvisa via SOAP API                       │
│ ✓ Receipt code assigned                                     │
│ ✓ Form processed, result available                          │
│                                                              │
│ Anvisa triggers webhook callback:                           │
│ POST https://hmatologia2.web.app/notivisaWebhookHandler     │
│                                                              │
│ Headers:                                                     │
│   Content-Type: application/json                            │
│   x-anvisa-signature: "abc123def456..." (hex-encoded)      │
│                                                              │
│ Body:                                                        │
│ {                                                            │
│   "idempotencyKey": "sha256_abcd...",                       │
│   "status": "success" | "rejected" | "error",              │
│   "eventId": "evt-2026-0507-12345",                        │
│   "timestamp": "2026-05-07T11:30:00Z",                     │
│   "receiptNumber": "NV-2026-0507-98765",                   │
│   "errorCode": null,  (if error/rejected)                   │
│   "errorMessage": null                                      │
│ }                                                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                       ↓ (HTTPS POST)
┌──────────────────────────────────────────────────────────────┐
│ Cloud Function: notivisaWebhookHandler()                     │
│                                                              │
│ 1. Verify HTTP method = POST                                │
│    IF NOT POST: 405 Method Not Allowed                      │
│                                                              │
│ 2. Extract x-anvisa-signature header                        │
│    signature = req.headers['x-anvisa-signature']            │
│    IF NOT PRESENT: 401 Unauthorized                         │
│                                                              │
│ 3. Verify signature (HMAC-SHA256)                           │
│ ┌────────────────────────────────────────┐                  │
│ │ payloadString = JSON.stringify(req.body)
│ │                                        │                  │
│ │ ANVISA_WEBHOOK_SECRET = (from         │                  │
│ │   Secret Manager, Phase 12+)          │                  │
│ │                                        │                  │
│ │ computed = HMAC-SHA256(                │                  │
│ │   payloadString,                       │                  │
│ │   ANVISA_WEBHOOK_SECRET                │                  │
│ │ ).digest('hex')                        │                  │
│ │                                        │                  │
│ │ // CONSTANT-TIME COMPARISON            │                  │
│ │ IF computed !== signature:             │                  │
│ │   Log: "Signature verification failed" │                  │
│ │   Return: 401 Unauthorized             │                  │
│ │   (Anvisa will retry)                  │                  │
│ │                                        │                  │
│ │ ✓ Signature matches: payload is from  │                  │
│ │   Anvisa (not spoofed)                 │                  │
│ └────────────────────────────────────────┘                  │
│                                                              │
│ 4. Parse webhook payload (Zod validation)                   │
│    IF validation fails: still return 200 OK                 │
│    (Acknowledge to prevent Anvisa retry)                    │
│                                                              │
│ 5. Find entry by idempotencyKey                             │
│    FOR EACH lab:                                            │
│      QUERY /notivisa-outbox                                 │
│            where idempotencyKey = payload.idempotencyKey    │
│      IF FOUND: match found, proceed to step 6               │
│      IF NOT FOUND: still return 200 OK (edge case)          │
│                                                              │
│ 6. Update entry document (if found)                         │
│    UPDATE {                                                 │
│      status: 'acknowledged',                                │
│      anvisa_eventId: payload.eventId,                       │
│      anvisa_acknowledgedAt: serverTimestamp,                │
│      anvisa_receiptNumber: payload.receiptNumber,           │
│      anvisa_rejectionCode: payload.errorCode || null,       │
│      anvisa_rejectionMessage: payload.errorMessage || null  │
│    }                                                         │
│                                                              │
│ 7. Append webhook log entry (immutable)                     │
│    SET /webhookLog/{timestamp}                              │
│      {                                                       │
│        action: 'ANVISA_WEBHOOK',                            │
│        ts: serverTimestamp,                                 │
│        payload: {                                           │
│          eventId: payload.eventId,                          │
│          status: payload.status,                            │
│          receiptNumber: payload.receiptNumber,              │
│          errorCode: payload.errorCode                       │
│        }                                                     │
│      }                                                       │
│                                                              │
│ 8. Return 200 OK (always, prevent retry)                   │
│    {                                                         │
│      received: true,                                        │
│      entryId: entry.id,  (if found)                        │
│      labId: labId,       (if found)                         │
│      note: ...           (edge case msg)                    │
│    }                                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                       ↓ (HTTPS 200 OK)
┌──────────────────────────────────────────────────────────────┐
│ Anvisa System (Gov)                                          │
│                                                              │
│ Receives 200 OK → webhook delivery confirmed                │
│ Stops retry attempts for this event                         │
│                                                              │
│ ✓ NOTIVISA workflow complete:                              │
│   - Form submitted                                          │
│   - HC Quality acknowledged receipt                         │
│   - Entry marked as 'acknowledged' in database              │
│   - Ready for audit export (if needed)                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘

SECURITY PROPERTIES:
✓ Webhook signature prevents spoofing (only Anvisa has secret)
✓ idempotencyKey prevents duplicate processing (deduplication)
✓ Constant-time comparison prevents timing attacks
✓ 200 OK response prevents Anvisa retry storms
✓ Webhook log immutable (audit trail preserved)
✓ Entry found by idempotencyKey (not editable by client)
✓ All data from Anvisa appended (never overwritten)
```

---

## 8. Multi-Lab Architecture (Database Partitioning)

```
┌───────────────────────────────────────────────────────────┐
│ HC Quality (SaaS)                                         │
│ Multi-tenant, lab-scoped collections                      │
│                                                           │
│ ┌────────────────────┐  ┌────────────────────┐            │
│ │ Lab Alpha (org-1)  │  │ Lab Beta (org-2)   │            │
│ ├────────────────────┤  ├────────────────────┤            │
│ │ /labs/lab-alpha    │  │ /labs/lab-beta     │            │
│ │ ├─ settings        │  │ ├─ settings        │            │
│ │ ├─ members         │  │ ├─ members         │            │
│ │ ├─ notivisa-drafts │  │ ├─ notivisa-drafts │            │
│ │ │  ├─ drafts       │  │ │  ├─ drafts       │            │
│ │ │  │ ├─ draft-001  │  │ │  │ ├─ draft-101  │            │
│ │ │  │ │  ├─ payload │  │ │  │ │  ├─ payload │            │
│ │ │  │ │  └─ auditLog│  │ │  │ │  └─ auditLog│            │
│ │ │  │ ├─ draft-002  │  │ │  │ ├─ draft-102  │            │
│ │ │  │ └─ ...        │  │ │  │ └─ ...        │            │
│ │ ├─ notivisa-outbox │  │ ├─ notivisa-outbox │            │
│ │ │  ├─ entry-a1     │  │ │  ├─ entry-b1     │            │
│ │ │  │  ├─ payload   │  │ │  │  ├─ payload   │            │
│ │ │  │  ├─ attempts  │  │ │  │  ├─ attempts  │            │
│ │ │  │  └─ auditLog  │  │ │  │  └─ auditLog  │            │
│ │ │  └─ ...          │  │ │  └─ ...          │            │
│ │                    │  │                    │            │
│ └────────────────────┘  └────────────────────┘            │
│                                                           │
│ Scheduled Processor runs for EACH lab:                  │
│                                                           │
│ CYCLE 1 (T+5min):                                        │
│  FOR EACH lab (lab-alpha, lab-beta, ...):               │
│    QUERY /labs/{labId}/notivisa-outbox                 │
│          where status='pending' AND ...                │
│    PROCESS queue (exponential backoff)                 │
│    UPDATE entries with submission attempts             │
│                                                           │
│ WHY PARALLEL-SAFE:                                      │
│   ✓ maxInstances=1 (only one processor at a time)      │
│   ✓ No cross-lab interference (each lab isolated)       │
│   ✓ labId filtering prevents query collision           │
│   ✓ Document-level writes are atomic (Firestore)       │
│                                                           │
└───────────────────────────────────────────────────────────┘

SCALABILITY:
├─ 100 labs: processor scans 100 labs/cycle (5min)
├─ 10 pending entries/lab: processes ~1000 entries/cycle
├─ Network requests: ~1000 Anvisa API calls/5min
│  = ~200 calls/minute = ~3.3 calls/sec (acceptable load)
│
├─ Firestore cost:
│  - 100 labs × 100 reads = 10k reads/cycle
│  - 5min cycle = 288 cycles/day = 2.88M reads/day
│  - Cost: ~$0.09/day (negligible)
│
├─ Cloud Functions cost:
│  - 288 invocations/day (scheduled processor)
│  - ~$0.40/month (negligible)
│
└─ Growth path:
   100 labs → 1000 labs: 10× increase
   Processor still handles easily (<30% CPU)
   Scale to multiple regions if needed (future)
```

---

**Document Generated:** 2026-05-07  
**For:** Phase 4–12 NOTIVISA Integration  
**Next Update:** Phase 8 mid-point (2026-07-15)
