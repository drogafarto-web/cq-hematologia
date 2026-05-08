# NOTIVISA Phase 4 — Callables 5-8 Implementation Guide

**Version:** 1.0  
**Date:** 2026-05-08  
**Status:** Complete implementation with test stubs  

## Overview

This document covers callables 5-8 for the NOTIVISA integration:

- **Callable 5:** `updateResultStatus` — Mark results as reviewed/released
- **Callable 6:** `fetchTestResults` — Retrieve completed test results with pagination
- **Callable 7:** `validateAuthorization` — Check NOTIVISA permissions & capabilities
- **Callable 8:** `logAuditTrail` — Immutable event logging with chain verification

All follow the same pattern as callables 1-4: full validation, auth checks, error handling, and audit trails.

---

## Callable 5: updateResultStatus

**Purpose:** Transition submission status from received → reviewed → released  
**Compliance:** RDC 978 Art. 122, DICQ 4.1.2.7

### Input Schema

```typescript
{
  labId: string;              // Lab identifier (required)
  submissionId: string;       // Submission to update (required)
  action: 'review' | 'release';  // Status transition action
  signature: {
    hash: string (64 chars);  // SHA-256 hash
    operatorId: string;       // Must match authenticated uid
    ts: number;               // Unix timestamp
  };
}
```

### Output Schema (Success)

```typescript
{
  ok: true;
  submissionId: string;
  status: 'received' | 'reviewed' | 'released';
  releasedAt?: number;        // Unix timestamp if released
  releasedBy?: string;        // UID of releasing officer
}
```

### Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| `SUBMISSION_NOT_FOUND` | Submission does not exist | Verify submissionId |
| `INVALID_STATUS_TRANSITION` | Cannot transition from current to target state | Check current status |
| `INVALID_SIGNATURE` | Signature operatorId ≠ authenticated uid | Regenerate signature |
| `PERMISSION_DENIED` | User lacks notivisa module claim | Contact admin |
| `SUPERVISOR_ROLE_REQUIRED` | Only RT/admin can review/release | Escalate to supervisor |
| `SUBMISSION_EXPIRED` | Result older than 7 days | Archive before review |
| `INTERNAL_ERROR` | Database or validation error | Check logs |

### Key Features

✅ **Role-based access control:** Only RT (Responsible Technician) or admin  
✅ **State machine validation:** Prevents invalid transitions  
✅ **Expiration check:** Results older than 7 days cannot be reviewed  
✅ **Atomic updates:** Status change + audit log in single transaction  
✅ **Immutable audit trail:** Cannot modify audit log entries  

### Firestore Collections Modified

- `notivisa-requisitions/{labId}/submissions/{submissionId}` — status, updatedAt, updatedBy, releasedAt, releasedBy
- `notivisa-requisitions/{labId}/submissions/{submissionId}/auditLog/{eventId}` — new immutable record
- `notivisa-audit-logs/{labId}/result-status-changes/{eventId}` — lab-wide audit index

### Example Usage

```typescript
const result = await updateResultStatus({
  labId: 'lab-001',
  submissionId: 'submission-abc123',
  action: 'release',
  signature: {
    hash: '0'.repeat(64),
    operatorId: 'user-rt-123',
    ts: Date.now(),
  },
});

// Response:
// {
//   ok: true,
//   submissionId: 'submission-abc123',
//   status: 'released',
//   releasedAt: 1715270400000,
//   releasedBy: 'user-rt-123'
// }
```

---

## Callable 6: fetchTestResults

**Purpose:** Retrieve completed test results with filtering and pagination  
**Compliance:** RDC 978 Art. 66, DICQ 4.3 (audit trail of data access)

### Input Schema

```typescript
{
  labId: string;
  filters?: {
    status?: 'received' | 'reviewed' | 'released';
    dateRange?: {
      startTs: number;        // Unix timestamp
      endTs: number;          // Unix timestamp
    };
    pacienteCpf?: string;     // 11-digit CPF
    submissionId?: string;    // Specific result ID
  };
  pageSize?: number;          // 1-100, default 20
  pageToken?: string;         // Base64-encoded cursor
}
```

### Output Schema (Success)

```typescript
{
  ok: true;
  results: [
    {
      submissionId: string;
      pacienteCpf: string;
      laudoId: string;
      status: 'received' | 'reviewed' | 'released';
      submittedAt: number;
      receivedAt?: number;
      reviewedAt?: number;
      releasedAt?: number;
      resultados: [
        {
          analito: string;
          valor: number | string;
          unidade: string;
          referencia?: string;
        }
      ];
      lastStatusChange: number;
    }
  ];
  pageInfo: {
    hasMore: boolean;
    nextPageToken?: string;
    totalInPage: number;
  };
  totalCount: number;         // Total results matching filters
  lastUpdatedAt: number;      // Query timestamp
}
```

### Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| `PERMISSION_DENIED` | User lacks NOTIVISA access | Contact admin |
| `INVALID_FILTER` | Filter validation failed | Check filter syntax |
| `PORTAL_UNAVAILABLE` | External portal unreachable | Retry later |
| `INVALID_PAGE_TOKEN` | Token malformed or expired | Request page 1 |
| `INTERNAL_ERROR` | Database error | Check logs |

### Key Features

✅ **Cursor-based pagination:** Efficient for large result sets  
✅ **Multi-field filtering:** status, date range, CPF, submission ID  
✅ **Performance optimization:** Soft-delete filter applied, 30s query timeout  
✅ **Audit logging:** All data access logged with operator ID  
✅ **PII protection:** CPF filtered client-side, not indexed  

### Firestore Collections Queried

- `notivisa-requisitions/{labId}/submissions` (read-only)
- `notivisa-audit-logs/{labId}/data-access` (write audit record)

### Example Usage

```typescript
const result = await fetchTestResults({
  labId: 'lab-001',
  filters: {
    status: 'released',
    dateRange: {
      startTs: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
      endTs: Date.now(),
    },
  },
  pageSize: 25,
});

// Response:
// {
//   ok: true,
//   results: [ /* 25 results */ ],
//   pageInfo: {
//     hasMore: true,
//     nextPageToken: 'eyJsYXN0RG9jSWQiOiAic3ViLTEyMyJ9',
//     totalInPage: 25
//   },
//   totalCount: 147,
//   lastUpdatedAt: 1715270400000
// }
```

---

## Callable 7: validateAuthorization

**Purpose:** Check NOTIVISA module access, role permissions, and portal configuration  
**Compliance:** RDC 978 Art. 66, DICQ 4.1.2.5 (RBAC)

### Input Schema

```typescript
{
  labId: string;  // Lab to validate access for
}
```

### Output Schema (Success)

```typescript
{
  ok: true;
  authorized: boolean;                          // Overall access granted?
  role: string;                                 // 'operator' | 'RT' | 'admin' | 'owner'
  permissions: string[];                        // [
                                                //   'notivisa:read',
                                                //   'notivisa:write',
                                                //   'notivisa:submit',
                                                //   'notivisa:review',
                                                //   'notivisa:release',
                                                //   'notivisa:audit',
                                                //   'notivisa:config'
                                                // ]
  portalConfigured: boolean;                    // Lab has NOTIVISA portal config?
  features: string[];                           // [
                                                //   'draft-creation',
                                                //   'requisition-submission',
                                                //   'result-review',
                                                //   'result-release',
                                                //   'status-tracking',
                                                //   'audit-logs',
                                                //   'bulk-export',
                                                //   'mfa-enabled',
                                                //   'portal-direct-access'
                                                // ]
  portalConfig?: {                              // Optional if configured
    labId: string;
    enabled: boolean;
    apiUrl?: string;
    mfaRequired: boolean;
    portalUrl?: string;
    lastValidatedAt?: number;
  };
  validationDetails?: {
    userHasClaim: boolean;
    userIsActiveMember: boolean;
    labHasConfig: boolean;
    portalConnectivity: 'online' | 'offline' | 'unknown';
  };
}
```

### Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| `UNAUTHENTICATED` | No auth context | Log in again |
| `PERMISSION_DENIED` | Not active lab member | Contact lab admin |
| `LAB_NOT_FOUND` | Lab document missing | Verify labId |
| `INTERNAL_ERROR` | Database error | Check logs |

### Role Permission Matrix

| Role | Permissions | Use Case |
|------|-------------|----------|
| `operator` | read, write, submit | Creates and submits NOTIVISA requisitions |
| `RT` | read, write, submit, review, release, audit | Reviews and releases results (RDC requirement) |
| `admin` | read, write, submit, review, release, audit, config | Configures portal and manages permissions |
| `owner` | read, write, submit, review, release, audit, config | Full lab control |

### Key Features

✅ **RBAC with fine-grained permissions:** Not just on/off  
✅ **Feature flag support:** Frontend can enable/disable UI based on features array  
✅ **Portal connectivity check:** Detects if government API is reachable  
✅ **Granular diagnostics:** validationDetails for troubleshooting  
✅ **Audit logging:** Every auth check logged  

### Firestore Collections Queried

- `labs/{labId}/members/{uid}` (check role and membership)
- `labs/{labId}/notivisa-config/portal` (read config)
- `notivisa-audit-logs/{labId}/auth-checks` (write audit record)

### Example Usage

```typescript
const result = await validateAuthorization({
  labId: 'lab-001',
});

// Response (RT user):
// {
//   ok: true,
//   authorized: true,
//   role: 'RT',
//   permissions: [
//     'notivisa:read',
//     'notivisa:write',
//     'notivisa:submit',
//     'notivisa:review',
//     'notivisa:release',
//     'notivisa:audit'
//   ],
//   portalConfigured: true,
//   features: [
//     'draft-creation',
//     'requisition-submission',
//     'result-review',
//     'result-release',
//     'status-tracking',
//     'audit-logs',
//     'mfa-enabled',
//     'portal-direct-access'
//   ],
//   validationDetails: {
//     userHasClaim: true,
//     userIsActiveMember: true,
//     labHasConfig: true,
//     portalConnectivity: 'online'
//   }
// }

// Response (denied):
// {
//   ok: false,
//   code: 'PERMISSION_DENIED',
//   message: 'User is not an active member of this lab'
// }
```

---

## Callable 8: logAuditTrail

**Purpose:** Record immutable audit events with chain-of-custody hashing  
**Compliance:** RDC 978 Art. 122, DICQ 4.4 § Trilha de Auditoria

### Input Schema

```typescript
{
  labId: string;
  eventType: string;  // One of: DRAFT_CREATED, DRAFT_SUBMITTED, DRAFT_APPROVED,
                      //         DRAFT_REJECTED, REQUISITION_SENT, RESULT_RECEIVED,
                      //         RESULT_REVIEWED, RESULT_RELEASED, ARCHIVE_EXPORTED,
                      //         CONFIG_CHANGED, AUTH_FAILED, DATA_ACCESS,
                      //         PERMISSION_GRANTED, PERMISSION_REVOKED, SYSTEM_EVENT
  resourceId: string; // ID of resource affected (e.g., submissionId, draftId)
  details?: Record<string, any>;  // Arbitrary event metadata
  signature: {
    hash: string (64 chars);
    operatorId: string;       // Must match authenticated uid
    ts: number;               // Unix timestamp
  };
}
```

### Output Schema (Success)

```typescript
{
  ok: true;
  eventId: string;                    // Unique event identifier
  hash: string (64 chars);            // SHA-256 event hash
  previousHash?: string (64 chars);   // Hash of previous event (chain link)
  recordedAt: number;                 // Unix timestamp
  chain_verified: boolean;            // Chain integrity OK?
}
```

### Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| `INVALID_EVENT_TYPE` | Event type not recognized | Use valid type from enum |
| `INVALID_SIGNATURE` | operatorId ≠ uid or timestamp stale | Regenerate signature |
| `PERMISSION_DENIED` | User lacks notivisa module claim | Contact admin |
| `LAB_NOT_FOUND` | Lab document missing | Verify labId |
| `CHAIN_VERIFICATION_FAILED` | Previous hash mismatch | Data integrity concern |
| `DATABASE_ERROR` | Firestore write failed | Retry or contact support |
| `INTERNAL_ERROR` | Validation error | Check logs |

### Key Features

✅ **Cryptographic integrity:** SHA-256 hashing of all event fields  
✅ **Chain-of-custody:** Each event links to previous via hash  
✅ **Immutability:** Events created only, never updated/deleted (Firestore security rules enforce)  
✅ **Idempotency:** Transaction prevents duplicate event IDs  
✅ **Comprehensive event types:** 15 standard event types covered  
✅ **Chain verification:** Detects if previous events were tampered with  

### Event Type Reference

| Event Type | Context | Example |
|---|---|---|
| `DRAFT_CREATED` | New NOTIVISA draft initiated | Draft form created in system |
| `DRAFT_SUBMITTED` | Draft submitted for approval | User hits "Submit Draft" button |
| `DRAFT_APPROVED` | RT approves draft | RT reviews and approves draft |
| `DRAFT_REJECTED` | Draft rejected with motivo | Auditor rejects for corrections |
| `REQUISITION_SENT` | Submission sent to NOTIVISA portal | Result sent to government API |
| `RESULT_RECEIVED` | Government portal returned result | Status updated to "received" |
| `RESULT_REVIEWED` | RT reviewed result | RT marks as reviewed |
| `RESULT_RELEASED` | Result released for clinical use | RT marks as released |
| `ARCHIVE_EXPORTED` | Results exported/archived | Auditor exports submission batch |
| `CONFIG_CHANGED` | Lab configuration updated | Portal credentials or settings changed |
| `AUTH_FAILED` | Authentication attempt failed | Failed login or permission denied |
| `DATA_ACCESS` | Data accessed (patient info, results) | Data retrieval for submission |
| `PERMISSION_GRANTED` | User permission added | New user granted NOTIVISA access |
| `PERMISSION_REVOKED` | User permission removed | User revoked from module |
| `SYSTEM_EVENT` | System-level event | Health check, maintenance |

### Firestore Collections Modified

- `notivisa-audit-logs/{labId}/events/{eventId}` — immutable event record
- `notivisa-audit-logs/{labId}/index/{eventType}` — event type index with counters

### Chain Verification Example

```
Event 1: hash = hash(event1_data) = "abc123..."
Event 2: hash = hash(event2_data), previousHash = "abc123..."
         → Verified if Event1.hash == "abc123..."
Event 3: hash = hash(event3_data), previousHash = hash(event2)
         → Can detect if Event 2 was tampered with
```

### Example Usage

```typescript
const result = await logAuditTrail({
  labId: 'lab-001',
  eventType: 'RESULT_RELEASED',
  resourceId: 'submission-abc123',
  details: {
    status: 'released',
    releaseReason: 'Normal release',
    affectedPatients: 1,
  },
  signature: {
    hash: '0'.repeat(64),
    operatorId: 'user-rt-123',
    ts: Date.now(),
  },
});

// Response:
// {
//   ok: true,
//   eventId: '1715270400123-abc7def9',
//   hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
//   previousHash: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
//   recordedAt: 1715270400123,
//   chain_verified: true
// }

// Subsequent event will link to this hash:
// {
//   eventId: '1715270405456-def2abc3',
//   previousHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
//   // ...
// }
```

---

## Testing Strategy

### Unit Test Coverage

Each callable has **14–17 test stubs** covering:

1. **Happy path tests:** Success cases with valid inputs
2. **Validation tests:** Input schema validation, error codes
3. **Authorization tests:** RBAC, permission checks, module claims
4. **Audit tests:** Logging, immutability, chain verification
5. **Error cases:** All error codes exercised
6. **Edge cases:** Boundary conditions, expiration, timeouts
7. **Integration:** Firestore writes, transactions, consistency

### Test Running

```bash
# Run all NOTIVISA tests
cd functions && npm test -- notivisa

# Run specific callable tests
npm test -- updateResultStatus
npm test -- fetchTestResults
npm test -- validateAuthorization
npm test -- logAuditTrail

# Run with coverage
npm test -- --coverage notivisa
```

### Manual Testing (Emulator)

```bash
firebase emulators:start --import=./seed.json --export-on-exit

# In another terminal:
firebase functions:shell --project hmatologia2

# Test updateResultStatus
updateResultStatus({
  labId: 'lab-001',
  submissionId: 'sub-001',
  action: 'release',
  signature: { hash: '0'.repeat(64), operatorId: 'user-rt', ts: Date.now() }
})

# Test fetchTestResults
fetchTestResults({
  labId: 'lab-001',
  pageSize: 10
})

# Test validateAuthorization
validateAuthorization({
  labId: 'lab-001'
})

# Test logAuditTrail
logAuditTrail({
  labId: 'lab-001',
  eventType: 'RESULT_RELEASED',
  resourceId: 'sub-001',
  signature: { hash: '0'.repeat(64), operatorId: 'user-rt', ts: Date.now() }
})
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing (`npm test -- notivisa`)
- [ ] TypeScript builds clean (`npm run build`)
- [ ] No lint errors (`npm run lint`)
- [ ] Code reviewed by at least one team member
- [ ] Firestore rules updated (NOTIVISA collections added)
- [ ] Firestore indexes created (pagination, filtering)
- [ ] Cloud Secrets configured (API keys if applicable)

### Deployment Steps

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Build
npm run build

# 3. Pre-flight check
bash scripts/preflight-secrets-check.sh

# 4. Deploy Firestore rules & indexes
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# 5. Deploy Cloud Functions
firebase deploy --only functions:updateResultStatus,functions:fetchTestResults,functions:validateAuthorization,functions:logAuditTrail --project hmatologia2

# 6. Deploy hosting (if UI updates included)
firebase deploy --only hosting --project hmatologia2
```

### Post-Deployment

- [ ] Monitor Cloud Logs for 24 hours
- [ ] Execute smoke tests:
  - [ ] Create draft, submit, receive result
  - [ ] Mark result as reviewed
  - [ ] Mark result as released
  - [ ] Fetch results with filtering
  - [ ] Check permissions via validateAuthorization
  - [ ] Verify audit trail entries created
- [ ] Check audit logs for errors
- [ ] Verify no data corruption
- [ ] Document in CHANGELOG

---

## Security Considerations

### Authentication & Authorization

✅ All callables require authenticated user  
✅ Module claim `notivisa` must be true  
✅ User must be active lab member  
✅ RT/admin role required for release operations  
✅ Signature operatorId must match authenticated UID  

### Data Protection

✅ Firestore security rules enforce `allow create: if false` for client writes  
✅ Server-side assinatura generation (not client)  
✅ Soft-delete only (never hard delete)  
✅ PII masking in logs (CPF first 3 digits masked)  
✅ Audit trail immutable (transaction-based creation)  

### Rate Limiting

Callables 5-8 don't have explicit rate limits (read-heavy, low risk), but:
- Frontend should limit UI button clicks (debounce)
- Monitor Cloud Logs for abuse patterns
- Can add rate limiting via custom middleware if needed

### Audit Trail Design

✅ Chain-of-custody hashing (SHA-256)  
✅ Previous event hash linked to new event  
✅ Idempotency via transaction  
✅ Immutable creation (no updates)  
✅ Comprehensive event types  
✅ Operator ID and timestamp recorded  

---

## Compliance Mapping

| Requirement | Callable(s) | Mechanism |
|---|---|---|
| **RDC 978 Art. 66** (Signed Access) | All | Signature validation, auth checks |
| **RDC 978 Art. 122** (Supervision) | 5, 8 | RT role enforcement, audit trail |
| **DICQ 4.1.2.5** (RBAC) | 7 | Permission mapping, role validation |
| **DICQ 4.1.2.7** (Supervision Record) | 5, 8 | Status transitions, audit log |
| **DICQ 4.3** (Audit Trail) | All | notivisa-audit-logs collection |
| **DICQ 4.4** (Trilha de Auditoria) | 8 | Chain verification, immutable logs |
| **LGPD** (PII Protection) | 6 | CPF masking in logs |

---

## Troubleshooting

### updateResultStatus

**Q:** "INVALID_STATUS_TRANSITION" error  
**A:** Check current submission status. Valid transitions: received→reviewed→released (one-way).

**Q:** "SUPERVISOR_ROLE_REQUIRED" error  
**A:** Only RT and admin can review/release. Ask lab admin to promote user role.

**Q:** "SUBMISSION_EXPIRED" error  
**A:** Results older than 7 days cannot be reviewed. Check submission createdAt timestamp.

### fetchTestResults

**Q:** Query timeout error  
**A:** Query took >30s. Try narrowing filters (e.g., smaller date range, specific CPF).

**Q:** "INVALID_PAGE_TOKEN" error  
**A:** Token expired or corrupted. Request page 1 again (omit pageToken).

**Q:** No results returned  
**A:** Check filters match your data. Use validateAuthorization to confirm access.

### validateAuthorization

**Q:** "authorized: false" but permissions look good  
**A:** Likely portalConfigured=false. Lab admin must create notivisa-config/portal doc.

**Q:** "PERMISSION_DENIED" error  
**A:** User not active lab member or missing notivisa module claim. Contact admin.

### logAuditTrail

**Q:** "CHAIN_VERIFICATION_FAILED" warning  
**A:** Previous event's hash doesn't match. Indicates possible data corruption. Investigate.

**Q:** Event not created  
**A:** Check signature timestamp (must be within 60 seconds). Check operatorId matches uid.

---

## References

- [RDC 978/2021 (ANVISA)](https://www.in.gov.br/web/dou/) — Brazilian regulatory standard
- [DICQ 4.3 & 4.4](https://www.sbpc.org.br/) — Quality management guidelines
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [Cloud Functions Best Practices](https://cloud.google.com/functions/docs/bestpractices/retries)
- [ADR-0026 — NOTIVISA Integration](../../../docs/adr/ADR-0026-notivisa-integration.md)

---

## Summary

**Callables 5-8 complete the NOTIVISA integration** with:
- ✅ Result status management (review/release workflow)
- ✅ Test result retrieval with filtering & pagination
- ✅ Authorization validation with RBAC & features
- ✅ Immutable audit trail with chain verification

**Ready for Phase 4 deployment (2026-05-20)** after:
1. All tests passing
2. Firestore rules deployed
3. Smoke tests executed
4. 24-hour log monitoring

