# NOTIVISA Callables 5-8 — Quick Reference Card

**Callables Overview**

| #   | Name                    | Purpose                          | Compliance       | Key Params                      |
| --- | ----------------------- | -------------------------------- | ---------------- | ------------------------------- |
| 5   | `updateResultStatus`    | Mark result reviewed/released    | RDC 978 Art. 122 | submissionId, action, signature |
| 6   | `fetchTestResults`      | Retrieve results with pagination | RDC 978 Art. 66  | filters, pageSize, pageToken    |
| 7   | `validateAuthorization` | Check permissions & config       | DICQ 4.1.2.5     | labId                           |
| 8   | `logAuditTrail`         | Immutable event logging          | DICQ 4.4         | eventType, resourceId, details  |

---

## Callable 5: updateResultStatus

```typescript
// Input
{
  labId: "lab-001",
  submissionId: "sub-abc123",
  action: "release",  // or "review"
  signature: {
    hash: "0".repeat(64),
    operatorId: "user-rt-123",
    ts: Date.now()
  }
}

// Output (Success)
{
  ok: true,
  submissionId: "sub-abc123",
  status: "released",
  releasedAt: 1715270400000,
  releasedBy: "user-rt-123"
}

// Error Codes: 7
SUBMISSION_NOT_FOUND | INVALID_STATUS_TRANSITION | INVALID_SIGNATURE |
PERMISSION_DENIED | SUPERVISOR_ROLE_REQUIRED | SUBMISSION_EXPIRED | INTERNAL_ERROR
```

**Key Features:**
✅ State machine validation (received → reviewed → released)  
✅ RT/admin role enforcement  
✅ 7-day expiration check  
✅ Atomic batch writes (status + 2 audit logs)

---

## Callable 6: fetchTestResults

```typescript
// Input
{
  labId: "lab-001",
  filters: {
    status: "released",              // Optional
    dateRange: {                      // Optional
      startTs: 1715270400000,
      endTs: 1715356800000
    },
    pacienteCpf: "12345678900",       // Optional
    submissionId: "sub-abc123"        // Optional
  },
  pageSize: 25,                       // Default 20, Max 100
  pageToken: "eyJsYXN0RG9j..."       // Optional
}

// Output (Success)
{
  ok: true,
  results: [
    {
      submissionId: "sub-001",
      pacienteCpf: "12345678900",
      laudoId: "laudo-001",
      status: "released",
      submittedAt: 1715270400000,
      resultados: [
        { analito: "Hemoglobina", valor: 14.5, unidade: "g/dL" }
      ],
      lastStatusChange: 1715356800000
    }
    // ... up to pageSize results
  ],
  pageInfo: {
    hasMore: true,
    nextPageToken: "eyJsYXN0RG9j...",
    totalInPage: 25
  },
  totalCount: 147,
  lastUpdatedAt: 1715356800000
}

// Error Codes: 5
PERMISSION_DENIED | INVALID_FILTER | PORTAL_UNAVAILABLE | INVALID_PAGE_TOKEN | INTERNAL_ERROR
```

**Key Features:**
✅ Cursor-based pagination  
✅ Multi-field filtering  
✅ 30-second query timeout  
✅ Soft-delete filter applied

---

## Callable 7: validateAuthorization

```typescript
// Input
{
  labId: "lab-001"
}

// Output (Success)
{
  ok: true,
  authorized: true,
  role: "RT",
  permissions: [
    "notivisa:read",
    "notivisa:write",
    "notivisa:submit",
    "notivisa:review",
    "notivisa:release",
    "notivisa:audit"
  ],
  portalConfigured: true,
  features: [
    "draft-creation",
    "requisition-submission",
    "result-review",
    "result-release",
    "status-tracking",
    "audit-logs",
    "mfa-enabled",
    "portal-direct-access"
  ],
  validationDetails: {
    userHasClaim: true,
    userIsActiveMember: true,
    labHasConfig: true,
    portalConnectivity: "online"
  }
}

// Error Codes: 4
UNAUTHENTICATED | PERMISSION_DENIED | LAB_NOT_FOUND | INTERNAL_ERROR
```

**Role Permission Matrix:**

- `operator` → [read, write, submit]
- `RT` → [read, write, submit, review, release, audit]
- `admin` → [read, write, submit, review, release, audit, config]
- `owner` → [read, write, submit, review, release, audit, config]

**Key Features:**
✅ RBAC with 7 permissions  
✅ 9 feature flags  
✅ Portal connectivity check  
✅ Detailed diagnostics

---

## Callable 8: logAuditTrail

```typescript
// Input
{
  labId: "lab-001",
  eventType: "RESULT_RELEASED",  // 15 types available
  resourceId: "sub-abc123",
  details: {                       // Optional
    status: "released",
    releaseReason: "Normal"
  },
  signature: {
    hash: "0".repeat(64),
    operatorId: "user-rt-123",
    ts: Date.now()
  }
}

// Output (Success)
{
  ok: true,
  eventId: "1715270400123-abc7def9",
  hash: "e3b0c44298fc1c149...",
  previousHash: "da39a3ee5e6b4b0d...",
  recordedAt: 1715270400123,
  chain_verified: true
}

// Error Codes: 7
INVALID_EVENT_TYPE | INVALID_SIGNATURE | PERMISSION_DENIED | LAB_NOT_FOUND |
CHAIN_VERIFICATION_FAILED | DATABASE_ERROR | INTERNAL_ERROR
```

**Event Types (15):**
DRAFT_CREATED | DRAFT_SUBMITTED | DRAFT_APPROVED | DRAFT_REJECTED |
REQUISITION_SENT | RESULT_RECEIVED | RESULT_REVIEWED | RESULT_RELEASED |
ARCHIVE_EXPORTED | CONFIG_CHANGED | AUTH_FAILED | DATA_ACCESS |
PERMISSION_GRANTED | PERMISSION_REVOKED | SYSTEM_EVENT

**Key Features:**
✅ SHA-256 cryptographic hashing  
✅ Chain-of-custody linking  
✅ Idempotency via transaction  
✅ Chain integrity verification

---

## Common Patterns

### Pattern 1: Update Result Status (Workflow)

```typescript
// Step 1: Validate Authorization
const auth = await validateAuthorization({ labId });
if (!auth.permissions.includes('notivisa:review')) return;

// Step 2: Mark as Reviewed
const reviewed = await updateResultStatus({
  labId,
  submissionId,
  action: 'review',
  signature: signature,
});

// Step 3: Log the action
await logAuditTrail({
  labId,
  eventType: 'RESULT_REVIEWED',
  resourceId: submissionId,
  signature: signature,
});

// Step 4: Mark as Released
const released = await updateResultStatus({
  labId,
  submissionId,
  action: 'release',
  signature: signature,
});
```

### Pattern 2: Fetch & Display Results

```typescript
// Step 1: Check authorization
const auth = await validateAuthorization({ labId });

// Step 2: Fetch first page
const page1 = await fetchTestResults({
  labId,
  filters: { status: 'released' },
  pageSize: 20,
});

// Step 3: Get next page if needed
if (page1.pageInfo.hasMore) {
  const page2 = await fetchTestResults({
    labId,
    filters: { status: 'released' },
    pageSize: 20,
    pageToken: page1.pageInfo.nextPageToken,
  });
}

// Step 4: Log the data access
await logAuditTrail({
  labId,
  eventType: 'DATA_ACCESS',
  resourceId: 'batch-fetch',
  details: { resultsCount: page1.results.length },
  signature: signature,
});
```

### Pattern 3: Audit Logging

```typescript
// For any significant event:
await logAuditTrail({
  labId,
  eventType: 'RESULT_RELEASED',
  resourceId: submissionId,
  details: {
    previousStatus: 'reviewed',
    newStatus: 'released',
    operator: operatorName,
    timestamp: Date.now()
  },
  signature: {
    hash: computeHash(...),
    operatorId: uid,
    ts: Date.now()
  }
});
```

---

## Error Handling Cheat Sheet

### updateResultStatus

| Error                     | Cause             | Fix                           |
| ------------------------- | ----------------- | ----------------------------- |
| SUBMISSION_NOT_FOUND      | ID doesn't exist  | Verify submissionId from list |
| INVALID_STATUS_TRANSITION | Wrong state       | Check current status first    |
| SUPERVISOR_ROLE_REQUIRED  | Not RT/admin      | Escalate to supervisor        |
| SUBMISSION_EXPIRED        | Older than 7 days | Archive instead               |

### fetchTestResults

| Error              | Cause              | Fix                    |
| ------------------ | ------------------ | ---------------------- |
| INVALID_PAGE_TOKEN | Token expired      | Request page 1 again   |
| INVALID_FILTER     | Bad filter syntax  | Check dateRange values |
| PERMISSION_DENIED  | No NOTIVISA access | Contact admin          |

### validateAuthorization

| Error             | Cause          | Fix                  |
| ----------------- | -------------- | -------------------- |
| PERMISSION_DENIED | Not lab member | Ask admin to add you |
| LAB_NOT_FOUND     | Lab ID wrong   | Verify lab exists    |

### logAuditTrail

| Error                     | Cause            | Fix                        |
| ------------------------- | ---------------- | -------------------------- |
| INVALID_SIGNATURE         | operatorId ≠ uid | Regenerate with correct ID |
| CHAIN_VERIFICATION_FAILED | Data corrupted   | Contact support            |

---

## Testing Commands

```bash
# Run all tests
cd functions && npm test -- notivisa

# Run specific callable
npm test -- updateResultStatus

# Run with coverage
npm test -- --coverage notivisa

# Manual testing (emulator)
firebase emulators:start
# In another terminal:
firebase functions:shell --project hmatologia2

> updateResultStatus({
    labId: 'lab-001',
    submissionId: 'sub-001',
    action: 'release',
    signature: { hash: '0'.repeat(64), operatorId: 'user', ts: Date.now() }
  })
```

---

## Deployment Checklist (Pre-Flight)

```bash
# 1. Type check
npx tsc --noEmit

# 2. Build
npm run build

# 3. Pre-flight secrets check
bash scripts/preflight-secrets-check.sh

# 4. Deploy rules & indexes
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# 5. Deploy functions
firebase deploy --only functions --project hmatologia2

# 6. Verify in Cloud Console
# - Check Cloud Functions logs
# - Verify Firestore audit trail entries created
# - Test each callable manually
```

---

## Performance Targets

| Callable              | Latency       | Throughput      | Notes                |
| --------------------- | ------------- | --------------- | -------------------- |
| updateResultStatus    | <500ms        | Unlimited       | Single doc update    |
| fetchTestResults      | <3s (30s max) | 20 results/page | Query timeout at 30s |
| validateAuthorization | <200ms        | Unlimited       | 2 doc reads          |
| logAuditTrail         | <1s           | Unlimited       | Transaction-based    |

---

## Quick Links

📄 **Full Guide:** `IMPLEMENTATION_GUIDE_PHASE4_5-8.md`  
📦 **Deliverables:** `DELIVERABLES_PHASE4_5-8.md`  
✅ **Validators:** `../validators.ts`  
🧪 **Tests:** `*test.ts` files (64 test stubs)  
📋 **Callables 1-4:** See `DELIVERABLES.md` & `IMPLEMENTATION_GUIDE.md`
