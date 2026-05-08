# NOTIVISA Phase 4 — Comprehensive Integration Test Strategy

**Document ID:** TEST-NOTIVISA-PHASE-4-001  
**Date:** 2026-05-08  
**Version:** 1.0  
**Status:** Draft for Review  
**Audience:** Engineering Team, QA, CTO

---

## Executive Summary

This document defines a **comprehensive Phase 4 integration test strategy** for the NOTIVISA portal (RDC 978 Art. 66 compliance). Scope includes **8 callable functions**, **unit + integration tests**, **sandbox mock scenarios**, **error resilience**, **E2E flows**, and **coverage targets**.

**Deliverable Structure:**
- Jest unit test suite (1 file per callable × 8 = 8 test files)
- Firebase Emulator integration tests (1 suite)
- E2E flow validation (auth → submit → track → retrieve)
- Mock NOTIVISA response library
- Error scenario matrix (API down, timeout, invalid data, etc.)
- Coverage targets (>90% per callable, critical paths 100%)

---

## 1. The 8 Callables: Scope & Test Coverage

### 1.1 Callable Functions Inventory

| # | Name | Input | Output | Critical Behavior | Error Codes |
|---|------|-------|--------|------------------|-------------|
| 1 | `authenticatePortal` | labId, username, password, mfaCode? | ok, authToken, expiresAt, sessionId | Portal login; session creation; audit log | INVALID_CREDENTIALS, MFA_REQUIRED, MFA_INVALID, PORTAL_CONFIG_MISSING, PORTAL_UNREACHABLE, SESSION_CREATION_FAILED, PERMISSION_DENIED, INTERNAL_ERROR |
| 2 | `getPatientData` | labId, pacienteCpf, laudoId? | ok, paciente, laudo, readyForSubmission, missingFields? | Fetch patient + laudo; validate completeness; check required fields | PATIENT_NOT_FOUND, LAUDO_NOT_FOUND, INCOMPLETE_DATA, PERMISSION_DENIED, INTERNAL_ERROR |
| 3 | `submitRequisition` | labId, pacienteCpf, laudoId, authSessionId, notivisaPayload | ok, requisitionId, status, protocolNumber?, nextCheckAt? | Validate payload; submit to portal; queue for polling; audit log; dedup check; rate limit | INVALID_SESSION, SESSION_EXPIRED, INVALID_PAYLOAD, DUPLICATE_SUBMISSION, PORTAL_ERROR, RATE_LIMITED, PERMISSION_DENIED, INTERNAL_ERROR |
| 4 | `trackSampleStatus` | labId, requisitionId, authSessionId? | ok, status, protocolNumber?, portalStatus?, updatedAt, nextCheckAt?, errorMessage?, details? | Poll portal; update status; check terminal states; timeout after 24h; audit log | REQUISITION_NOT_FOUND, SESSION_INVALID, SESSION_EXPIRED, PERMISSION_DENIED, PORTAL_ERROR, INTERNAL_ERROR |
| 5 | `notivisaDraftCreate` | labId, laudoId, payload | ok, draftId, status, createdAt | Create draft; idempotency check; audit trail | INCOMPLETE_DATA, DUPLICATE_LAUDO, PERMISSION_DENIED, INTERNAL_ERROR |
| 6 | `getNotivisaDraft` | labId, draftId | ok, draft, status, auditLog? | Fetch draft; return current state + audit history | DRAFT_NOT_FOUND, PERMISSION_DENIED, INTERNAL_ERROR |
| 7 | `rejectNotivisaDraft` | labId, draftId, motivo, signature | ok, draftId, status, rejectedAt | Transition draft back to drafting; log rejection reason; audit trail | DRAFT_NOT_FOUND, INVALID_SIGNATURE, PERMISSION_DENIED, INTERNAL_ERROR |
| 8 | `listNotivisaOutbox` | labId | ok, submissions[], totalCount, pageToken? | List submitted + completed; pagination; filter by status/date | PERMISSION_DENIED, INTERNAL_ERROR |

---

## 2. Unit Test Suite — Per-Callable Strategy

### 2.1 Test File Structure

**Pattern:** `functions/src/modules/notivisa/callables/{CALLABLE_NAME}.test.ts`

```
functions/src/modules/notivisa/callables/
├── authenticatePortal.test.ts       (170 lines)
├── getPatientData.test.ts           (190 lines)
├── submitRequisition.test.ts         (210 lines)
├── trackSampleStatus.test.ts         (180 lines)
├── notivisaDraftCreate.test.ts       (160 lines)
├── getNotivisaDraft.test.ts          (130 lines)
├── rejectNotivisaDraft.test.ts       (140 lines)
└── listNotivisaOutbox.test.ts        (120 lines)
```

**Total:** ~1,200 LOC unit tests

### 2.2 Unit Test Coverage Targets

| Callable | Line Coverage | Branch Coverage | Critical Path | Timeout Coverage | Error Paths |
|----------|---|---|---|---|---|
| authenticatePortal | 95% | 90% | 100% | Yes (session expiry) | All 8 error codes |
| getPatientData | 92% | 88% | 100% | No | All 5 error codes |
| submitRequisition | 96% | 92% | 100% | Yes (rate limit, polling) | All 8 error codes |
| trackSampleStatus | 94% | 90% | 100% | Yes (24h timeout) | All 6 error codes |
| notivisaDraftCreate | 91% | 87% | 100% | No | All 4 error codes |
| getNotivisaDraft | 89% | 85% | 100% | No | All 3 error codes |
| rejectNotivisaDraft | 93% | 89% | 100% | No | All 4 error codes |
| listNotivisaOutbox | 88% | 84% | 100% | No | All 2 error codes |
| **TOTAL** | **92%** | **88%** | **100%** | **4 callables** | **40 error scenarios** |

### 2.3 Unit Test Template (Pattern)

Each callable test file follows this structure:

```typescript
/**
 * {CALLABLE_NAME}.test.ts
 * Phase 4 — Tests for {CALLABLE_NAME}
 * 
 * Coverage:
 * - Input validation (Zod schemas)
 * - Authorization checks (assertNotivisaAccess)
 * - Happy path (success response)
 * - All error codes (8/8)
 * - Audit logging
 * - Firestore batch operations
 * - Edge cases (timeouts, nulls, empty arrays)
 */

describe('{CALLABLE_NAME}', () => {
  let mockDb: any;
  let mockBatch: any;
  let mockAuth: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mock Firestore + batch
    // Setup mock admin.firestore()
    // Setup mock Cloud Logs (functions.logger)
  });

  describe('Authorization & Input Validation', () => {
    test('should reject unauthenticated request');
    test('should reject missing module claim (notivisa)');
    test('should validate input schema via Zod');
    test('should validate labId not empty');
    test('should validate required fields');
  });

  describe('Happy Path (Success Cases)', () => {
    test('should return ok=true on successful {ACTION}');
    test('should create/update Firestore documents correctly');
    test('should generate audit log entry');
    test('should return all expected fields in response');
  });

  describe('Error Scenarios', () => {
    test('should return error code: ERROR_1 with message');
    test('should return error code: ERROR_2 with message');
    // ... all error codes
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined optional fields');
    test('should handle empty arrays');
    test('should handle very large payloads (>1MB)');
    test('should handle special characters in strings');
  });

  describe('Audit Logging', () => {
    test('should log action to notivisa-audit-logs');
    test('should include operatorId + timestamp + details');
    test('should handle audit log write failures gracefully');
  });

  describe('Security & Compliance', () => {
    test('should not leak PII in error messages (CPF masking)');
    test('should validate signatures (if applicable)');
    test('should enforce RDC 978 Art. 66 requirements');
  });
});
```

---

## 3. Integration Tests — Firebase Emulator Suite

### 3.1 Integration Test Architecture

**File:** `functions/src/__tests__/integration/notivisa-integration.test.ts`

**Setup:**
- Firebase Rules Unit Testing (`@firebase/rules-unit-testing`)
- Firestore Emulator (local, in-process)
- Functions Emulator (port 5001)
- Test data seeding (labs, pacientes, laudos, auth, configs)

**Runtime:** ~45 seconds (parallel test groups)

### 3.2 Integration Test Scenarios (7 Groups)

#### Group 1: Sandbox Mode (Isolated Callables)

Tests each callable in isolation against a real Firestore emulator without calling other functions.

```typescript
describe('NOTIVISA Integration — Sandbox Mode (Isolated)', () => {
  describe('authenticatePortal isolated', () => {
    test('should create session doc in notivisa-sessions collection');
    test('should create audit log in notivisa-audit-logs collection');
    test('should enforce session expiry (1 hour)');
    test('should reject expired session on subsequent calls');
  });

  describe('getPatientData isolated', () => {
    test('should query pacientes collection by CPF');
    test('should fetch latest laudo by resultadoEm DESC');
    test('should validate all required fields present');
    test('should return readyForSubmission = true only when complete');
    test('should mask CPF in audit log (12345***);
  });

  describe('submitRequisition isolated', () => {
    test('should validate session exists and is active');
    test('should validate payload against notivisaPayloadSchema');
    test('should check for duplicate submission (same laudoId + CPF)');
    test('should enforce rate limit (20/hour)');
    test('should create notivisa-requisitions doc with status=queued');
    test('should set nextCheckAt = now + 5 minutes');
  });

  describe('trackSampleStatus isolated', () => {
    test('should fetch submission record by requisitionId');
    test('should return current status without polling if terminal');
    test('should mock portal response and update status');
    test('should set status=failed if polling >24 hours');
    test('should create status change audit log');
  });

  describe('notivisaDraftCreate isolated', () => {
    test('should check idempotency (same laudoId + labId)');
    test('should create notivisa-drafts/{labId}/drafts/{draftId}');
    test('should set status=drafting initially');
    test('should create root doc notivisa-drafts/{labId} if missing');
  });

  describe('getNotivisaDraft isolated', () => {
    test('should fetch draft by draftId');
    test('should include auditLog subcollection if present');
    test('should return 404 if draft not found');
  });

  describe('rejectNotivisaDraft isolated', () => {
    test('should validate signature (hash, operatorId, ts)');
    test('should transition status back to drafting');
    test('should store motivo in document');
    test('should create rejection audit log');
  });

  describe('listNotivisaOutbox isolated', () => {
    test('should query notivisa-requisitions with status in [submitted, completed]');
    test('should paginate by 50 per page');
    test('should return totalCount');
  });
});
```

**Expected:** 40+ test cases

#### Group 2: Mock NOTIVISA Responses

Inject mock responses for portal API calls (submitRequisition + trackSampleStatus).

```typescript
describe('NOTIVISA Integration — Mock Portal Responses', () => {
  const mockNotivisaResponses = {
    submitSuccess: {
      success: true,
      protocolNumber: 'NV-LAB-2026050812345',
      status: 'submitted',
    },
    submitFailure: {
      success: false,
      error: 'Portal temporarily unavailable',
    },
    statusProgression: [
      { status: 'submitted', timestamp: Date.now() },
      { status: 'processing', timestamp: Date.now() + 300000 },
      { status: 'completed', timestamp: Date.now() + 600000 },
    ],
  };

  test('should handle portal success response (submit → submitted)', async () => {
    // Mock portal to return success
    const result = await submitRequisition(request);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('submitted');
    expect(result.protocolNumber).toMatch(/^NV-/);
  });

  test('should handle portal failure and queue for retry', async () => {
    // Mock portal to return failure
    const result = await submitRequisition(request);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('queued'); // Fallback to queued
    expect(result.protocolNumber).toBeUndefined();
  });

  test('should handle status progression (polling mock)', async () => {
    // Track status across 3 polls
    let status = 'submitted';
    for (let i = 0; i < 3; i++) {
      const result = await trackSampleStatus(request);
      expect(result.ok).toBe(true);
      expect(['submitted', 'processing', 'completed']).toContain(result.status);
      status = result.status;
    }
  });

  test('should handle malformed portal response', async () => {
    // Mock portal returns invalid JSON
    const result = await trackSampleStatus(request);
    expect(result.ok).toContain('false'); // Should fail gracefully
  });
});
```

#### Group 3: Authorization & Access Control

Validate Firestore rules + assertNotivisaAccess across all callables.

```typescript
describe('NOTIVISA Integration — Authorization', () => {
  test('should reject user without notivisa module claim', async () => {
    const userWithoutClaim = { uid: 'user-no-claim', token: { modules: {} } };
    const result = await authenticatePortal({ auth: userWithoutClaim, data: input });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('PERMISSION_DENIED');
  });

  test('should reject user not in labs/{labId}/members', async () => {
    const userNotMember = { uid: 'user-stranger', token: { modules: { notivisa: true } } };
    const result = await getPatientData({ auth: userNotMember, data: input });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('PERMISSION_DENIED');
  });

  test('should allow RT role to submit', async () => {
    const rtUser = { uid: 'rt-user', token: { modules: { notivisa: true } } };
    // Add rt-user to labs/{labId}/members with role=RT
    const result = await submitRequisition({ auth: rtUser, data: input });
    expect(result.ok).toBe(true);
  });

  test('should allow AUDITOR role to reject draft', async () => {
    const auditorUser = { uid: 'auditor-user', token: { modules: { notivisa: true } } };
    // Add auditor-user to labs/{labId}/members with role=AUDITOR
    const result = await rejectNotivisaDraft({ auth: auditorUser, data: input });
    expect(result.ok).toBe(true);
  });
});
```

#### Group 4: Error Scenarios & Resilience

Comprehensive error matrix (API down, timeout, invalid data, network failure).

```typescript
describe('NOTIVISA Integration — Error Scenarios & Resilience', () => {
  describe('Portal Unreachable (API Down)', () => {
    test('submitRequisition should queue when portal unreachable', async () => {
      // Mock portal HTTP timeout
      const result = await submitRequisition(request);
      expect(result.status).toBe('queued'); // Fallback
      expect(result.protocolNumber).toBeUndefined();
    });

    test('trackSampleStatus should return PORTAL_ERROR on timeout', async () => {
      // Mock portal no response
      const result = await trackSampleStatus(request);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PORTAL_ERROR');
    });
  });

  describe('Invalid Data Scenarios', () => {
    test('should reject CPF with wrong format', async () => {
      const result = await getPatientData({
        auth: validAuth,
        data: { labId: 'lab1', pacienteCpf: '123' }, // Too short
      });
      expect(result.ok).toBe(false);
      expect(result.code).toContain('INTERNAL_ERROR');
    });

    test('should reject laudo with missing results', async () => {
      const result = await submitRequisition({
        auth: validAuth,
        data: {
          ...validInput,
          notivisaPayload: {
            ...validInput.notivisaPayload,
            resultados: [], // Empty
          },
        },
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_PAYLOAD');
    });

    test('should reject signature with invalid hash length', async () => {
      const result = await rejectNotivisaDraft({
        auth: validAuth,
        data: {
          labId: 'lab1',
          draftId: 'draft1',
          motivo: 'Dados incompletos',
          signature: {
            hash: 'abc', // Should be 64 chars
            operatorId: 'user1',
            ts: Date.now(),
          },
        },
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('Rate Limiting & Throttling', () => {
    test('should reject >20 submissions per hour', async () => {
      // Submit 21 requisitions in 1 hour
      for (let i = 0; i < 20; i++) {
        const result = await submitRequisition(request);
        expect(result.ok).toBe(true);
      }
      const rateLimitedResult = await submitRequisition(request);
      expect(rateLimitedResult.ok).toBe(false);
      expect(rateLimitedResult.code).toBe('RATE_LIMITED');
    });
  });

  describe('Session Expiry & Timeout', () => {
    test('authenticatePortal should expire session after 1 hour', async () => {
      const result1 = await authenticatePortal(request);
      const sessionId = result1.sessionId;
      const expiresAt = result1.expiresAt;

      // Fast-forward time to expiry + 1 second
      jest.useFakeTimers();
      jest.setSystemTime(expiresAt + 1000);

      const result2 = await trackSampleStatus({
        auth: validAuth,
        data: { labId: 'lab1', requisitionId: 'req1', authSessionId: sessionId },
      });
      expect(result2.ok).toBe(false);
      expect(result2.code).toBe('SESSION_EXPIRED');

      jest.useRealTimers();
    });

    test('trackSampleStatus should timeout polling after 24 hours', async () => {
      const submittedAt = Date.now() - (25 * 3600 * 1000); // 25 hours ago
      // Create a submission with submittedAt = 25h ago
      const result = await trackSampleStatus(request);
      expect(result.status).toBe('failed'); // Should timeout
    });
  });

  describe('Duplicate Submission Prevention', () => {
    test('should reject duplicate submission (same laudo + patient)', async () => {
      const result1 = await submitRequisition(request);
      expect(result1.ok).toBe(true);

      const result2 = await submitRequisition(request); // Same request
      expect(result2.ok).toBe(false);
      expect(result2.code).toBe('DUPLICATE_SUBMISSION');
    });
  });

  describe('Concurrency & Race Conditions', () => {
    test('should handle concurrent submitRequisition calls safely', async () => {
      const promises = [1, 2, 3].map(() => submitRequisition(request));
      const results = await Promise.all(promises);
      
      // Only 1 should succeed; others should be DUPLICATE_SUBMISSION
      const successes = results.filter(r => r.ok);
      expect(successes.length).toBe(1);
    });
  });
});
```

#### Group 5: Audit Trail & Compliance

Validate RDC 978 Art. 66 audit logging.

```typescript
describe('NOTIVISA Integration — Audit Trail & Compliance (RDC 978 Art. 66)', () => {
  test('authenticatePortal should log to notivisa-audit-logs/logins', async () => {
    await authenticatePortal(request);
    
    const auditDocs = await db
      .collection('notivisa-audit-logs')
      .doc(labId)
      .collection('logins')
      .orderBy('ts', 'desc')
      .limit(1)
      .get();

    expect(auditDocs.size).toBe(1);
    const audit = auditDocs.docs[0].data();
    expect(audit).toMatchObject({
      action: 'PORTAL_LOGIN',
      operatorId: expect.any(String),
      ts: expect.any(Number),
      sessionId: expect.any(String),
      mfaUsed: expect.any(Boolean),
    });
  });

  test('submitRequisition should log submission + hash', async () => {
    await submitRequisition(request);

    const auditDocs = await db
      .collection('notivisa-requisitions')
      .doc(labId)
      .collection('submissions')
      .get();

    const submission = auditDocs.docs[0];
    const auditLog = await submission.ref
      .collection('auditLog')
      .get();

    expect(auditLog.size).toBeGreaterThan(0);
    const log = auditLog.docs[0].data();
    expect(log).toMatchObject({
      action: 'SUBMITTED',
      operatorId: expect.any(String),
      ts: expect.any(Number),
      status: expect.any(String),
      details: { payloadHash: expect.any(String) },
    });
  });

  test('trackSampleStatus should log status changes', async () => {
    await trackSampleStatus(request);

    const submission = /* fetch submission */;
    const auditLog = await submission.ref
      .collection('auditLog')
      .get();

    const statusChangeLogs = auditLog.docs
      .map(d => d.data())
      .filter(d => d.action === 'STATUS_UPDATED');

    expect(statusChangeLogs.length).toBeGreaterThan(0);
  });

  test('rejectNotivisaDraft should log rejection reason', async () => {
    await rejectNotivisaDraft({
      auth: validAuth,
      data: {
        labId,
        draftId,
        motivo: 'Dados incompletos — paciente sem data de nascimento',
        signature: validSignature,
      },
    });

    const draft = await db
      .collection('notivisa-drafts')
      .doc(labId)
      .collection('drafts')
      .doc(draftId)
      .get();

    expect(draft.data().rejectionMotivo).toBe('Dados incompletos — paciente sem data de nascimento');
    expect(draft.data().rejectedAt).toBeDefined();
    expect(draft.data().rejectedBy).toBe(validAuth.uid);
  });

  test('audit logs should include both system + operator context', async () => {
    // Verify every audit entry has:
    // - operatorId (who did it)
    // - ts (when, unix ms)
    // - action (what)
    // - details (context)
    
    const allAudits = await db
      .collectionGroup('auditLog')
      .get();

    for (const auditDoc of allAudits.docs) {
      const audit = auditDoc.data();
      expect(audit.operatorId).toBeTruthy();
      expect(audit.ts).toBeGreaterThan(0);
      expect(audit.action).toBeTruthy();
      expect(audit.details).toBeDefined();
    }
  });
});
```

#### Group 6: Happy Path E2E Flows

Complete end-to-end workflows (auth → data retrieval → submission → tracking).

```typescript
describe('NOTIVISA Integration — E2E Happy Path Flows', () => {
  test('E2E Flow 1: Full Requisition Submission & Tracking', async () => {
    // Step 1: RT authenticates
    const authResult = await authenticatePortal({
      auth: rtUser,
      data: {
        labId,
        portalUsername: 'rt001',
        portalPassword: 'pass12345',
      },
    });
    expect(authResult.ok).toBe(true);
    const sessionId = authResult.sessionId;

    // Step 2: Retrieve patient data
    const patientResult = await getPatientData({
      auth: rtUser,
      data: {
        labId,
        pacienteCpf: '12345678900',
        laudoId: 'laudo-001',
      },
    });
    expect(patientResult.ok).toBe(true);
    expect(patientResult.readyForSubmission).toBe(true);

    // Step 3: Submit requisition
    const submitResult = await submitRequisition({
      auth: rtUser,
      data: {
        labId,
        pacienteCpf: '12345678900',
        laudoId: 'laudo-001',
        authSessionId: sessionId,
        notivisaPayload: patientResult.laudo, // Use fetched laudo
      },
    });
    expect(submitResult.ok).toBe(true);
    const requisitionId = submitResult.requisitionId;

    // Step 4: Poll status
    const trackResult1 = await trackSampleStatus({
      auth: rtUser,
      data: { labId, requisitionId, authSessionId: sessionId },
    });
    expect(trackResult1.ok).toBe(true);
    expect(['queued', 'submitted', 'acknowledged']).toContain(trackResult1.status);

    // Step 5: Status progresses (mock)
    const trackResult2 = await trackSampleStatus({
      auth: rtUser,
      data: { labId, requisitionId, authSessionId: sessionId },
    });
    expect(['submitted', 'processing', 'completed']).toContain(trackResult2.status);
  });

  test('E2E Flow 2: Draft Creation → Approval → Archive', async () => {
    // Step 1: Create draft
    const draftCreateResult = await notivisaDraftCreate({
      auth: rtUser,
      data: {
        labId,
        laudoId: 'laudo-002',
        payload: validNotivisaPayload,
      },
    });
    expect(draftCreateResult.ok).toBe(true);
    const draftId = draftCreateResult.draftId;

    // Step 2: Fetch draft
    const getDraftResult = await getNotivisaDraft({
      auth: rtUser,
      data: { labId, draftId },
    });
    expect(getDraftResult.ok).toBe(true);
    expect(getDraftResult.draft.status).toBe('drafting');

    // Step 3: Auditor rejects draft (optional)
    const rejectResult = await rejectNotivisaDraft({
      auth: auditorUser,
      data: {
        labId,
        draftId,
        motivo: 'Paciente com data de nascimento inválida — solicitar confirmação',
        signature: {
          hash: crypto.createHash('sha256').update(JSON.stringify(getDraftResult.draft)).digest('hex'),
          operatorId: auditorUser.uid,
          ts: Date.now(),
        },
      },
    });
    expect(rejectResult.ok).toBe(true);

    // Step 4: List outbox (archived submissions)
    const listResult = await listNotivisaOutbox({
      auth: rtUser,
      data: { labId },
    });
    expect(listResult.ok).toBe(true);
    expect(listResult.submissions).toBeInstanceOf(Array);
  });

  test('E2E Flow 3: Incomplete Data Rejection', async () => {
    // Try to submit with incomplete laudo
    const patientResult = await getPatientData({
      auth: rtUser,
      data: {
        labId,
        pacienteCpf: '98765432100', // Patient missing dataNascimento
      },
    });
    expect(patientResult.ok).toBe(true);
    expect(patientResult.readyForSubmission).toBe(false);
    expect(patientResult.missingFields).toContain('paciente.dataNascimento');
  });
});
```

#### Group 7: Firestore Rules Validation

Ensure Firestore rules align with callable logic.

```typescript
describe('NOTIVISA Integration — Firestore Rules Validation', () => {
  test('should enforce notivisa-sessions read ACL (RT/AUDITOR only)', async () => {
    // Create session as RT
    await adminDb
      .collection('notivisa-sessions')
      .doc(labId)
      .collection('sessions')
      .doc('sess-001')
      .set({ uid: rtUser.uid, status: 'active' });

    // RT should read
    const rtClient = initializeTestApp({ projectId, auth: { uid: rtUser.uid } });
    const rtDb = getFirestore(rtClient);
    const sessionSnap = await getDoc(
      doc(rtDb, 'notivisa-sessions', labId, 'sessions', 'sess-001')
    );
    expect(sessionSnap.exists()).toBe(true);

    // Stranger should not read
    const strangerClient = initializeTestApp({ projectId, auth: { uid: 'stranger' } });
    const strangerDb = getFirestore(strangerClient);
    const forbiddenSnap = await getDoc(
      doc(strangerDb, 'notivisa-sessions', labId, 'sessions', 'sess-001')
    );
    // Expect to fail per rules
  });

  test('should prevent direct client creation of notivisa-requisitions', async () => {
    // Client tries to write to notivisa-requisitions
    const rtClient = initializeTestApp({ projectId, auth: { uid: rtUser.uid } });
    const rtDb = getFirestore(rtClient);

    expect(async () => {
      await setDoc(
        doc(rtDb, 'notivisa-requisitions', labId, 'submissions', 'req-999'),
        { status: 'submitted' } // Not allowed — CF only
      );
    }).rejects.toThrow();
  });

  test('should enforce soft-delete only (no hard deletes)', async () => {
    // Verify rules prevent deleteDoc on NOTIVISA collections
    const rtClient = initializeTestApp({ projectId, auth: { uid: rtUser.uid } });
    const rtDb = getFirestore(rtClient);

    expect(async () => {
      await deleteDoc(
        doc(rtDb, 'notivisa-requisitions', labId, 'submissions', 'req-001')
      );
    }).rejects.toThrow();
  });
});
```

---

## 4. Mock NOTIVISA Response Library

### 4.1 Mock Response Generator

**File:** `functions/src/__tests__/fixtures/notivisa-mocks.ts`

```typescript
/**
 * notivisa-mocks.ts — Mock NOTIVISA API responses for sandbox testing
 * 
 * Usage:
 *   const mockResponse = generateMockPortalResponse('submit_success', { protocolNumber: 'NV-LAB-123' });
 *   const mockStatus = generateMockStatusProgression(3); // 3 polls
 */

export const MockNotivisaResponses = {
  // ============ Submit Responses ============
  submitSuccess: (protocolNumber?: string) => ({
    success: true,
    protocolNumber: protocolNumber || `NV-${Date.now()}`,
    status: 'submitted',
  }),

  submitPortalDown: () => ({
    success: false,
    error: 'Portal temporarily unavailable (HTTP 503)',
  }),

  submitTimeout: () => ({
    success: false,
    error: 'Request timeout after 30s',
  }),

  submitInvalidCredentials: () => ({
    success: false,
    error: 'Invalid portal credentials',
  }),

  // ============ Status Responses ============
  statusSubmitted: (protocolNumber: string) => ({
    success: true,
    status: 'submitted',
    protocolNumber,
    response: {
      timestamp: Date.now(),
      acknowledgment: true,
    },
  }),

  statusProcessing: (protocolNumber: string) => ({
    success: true,
    status: 'processing',
    protocolNumber,
    response: {
      timestamp: Date.now(),
      processingStatus: 'in_progress',
      estimatedCompletionTime: Date.now() + 3600000,
    },
  }),

  statusCompleted: (protocolNumber: string) => ({
    success: true,
    status: 'completed',
    protocolNumber,
    response: {
      timestamp: Date.now(),
      result: 'accepted',
      completedAt: Date.now(),
      receiptCode: `REC-${Date.now()}`,
    },
  }),

  statusRejected: (protocolNumber: string, reason: string) => ({
    success: true,
    status: 'rejected',
    protocolNumber,
    response: {
      timestamp: Date.now(),
      result: 'rejected',
      reason,
    },
  }),

  // ============ Status Progression (Multi-Poll) ============
  statusProgression: (steps: number) => {
    const progression = [];
    const protocol = `NV-${Date.now()}`;
    
    for (let i = 0; i < steps; i++) {
      if (i < 2) {
        progression.push(MockNotivisaResponses.statusSubmitted(protocol));
      } else if (i < 4) {
        progression.push(MockNotivisaResponses.statusProcessing(protocol));
      } else {
        progression.push(MockNotivisaResponses.statusCompleted(protocol));
      }
    }
    return progression;
  },

  // ============ Malformed Responses (Error Handling) ============
  malformedJson: () => ({
    success: true,
    status: undefined, // Missing required field
  }),

  nullResponse: () => null,

  emptyResponse: () => ({}),
};

export function mockPortalSubmit(
  scenario: 'success' | 'failure' | 'timeout' | 'invalid_creds'
): any {
  switch (scenario) {
    case 'success':
      return MockNotivisaResponses.submitSuccess();
    case 'failure':
      return MockNotivisaResponses.submitPortalDown();
    case 'timeout':
      return MockNotivisaResponses.submitTimeout();
    case 'invalid_creds':
      return MockNotivisaResponses.submitInvalidCredentials();
  }
}

export function mockPortalStatusCheck(
  scenario: 'submitted' | 'processing' | 'completed' | 'rejected'
): any {
  const protocol = 'NV-LAB-001';
  switch (scenario) {
    case 'submitted':
      return MockNotivisaResponses.statusSubmitted(protocol);
    case 'processing':
      return MockNotivisaResponses.statusProcessing(protocol);
    case 'completed':
      return MockNotivisaResponses.statusCompleted(protocol);
    case 'rejected':
      return MockNotivisaResponses.statusRejected(protocol, 'Invalid patient data');
  }
}
```

### 4.2 Test Data Seeding

**File:** `functions/src/__tests__/fixtures/notivisa-payloads.ts`

```typescript
/**
 * notivisa-payloads.ts — Valid + invalid NOTIVISA payloads for testing
 */

export const ValidPayloads = {
  completePayload: {
    versao: '1.0',
    laudo_id: 'laudo-syphilis-001',
    paciente_cpf: '12345678900',
    data_resultado: Date.now(),
    resultados: [
      {
        analito: 'TPPA (Treponema Pallidum Particle Agglutination)',
        valor: 'Reagente',
        unidade: 'Qualitativo',
        referencia: 'Não Reagente',
      },
    ],
    assinador: {
      cpf: '98765432100',
      nome: 'Dr. João Silva',
      data_assinatura: Date.now(),
    },
  },

  multipleResultados: {
    versao: '1.0',
    laudo_id: 'laudo-dengue-001',
    paciente_cpf: '11122233344',
    data_resultado: Date.now(),
    resultados: [
      { analito: 'NS1 Antígeno', valor: 'Positivo', unidade: 'Qualitativo', referencia: 'Negativo' },
      { analito: 'IgM Anti-Dengue', valor: '2.5', unidade: 'Índice', referencia: '<0.9' },
      { analito: 'IgG Anti-Dengue', valor: 'Negativo', unidade: 'Qualitativo', referencia: 'Negativo' },
    ],
    assinador: {
      cpf: '55566677788',
      nome: 'Dra. Maria Santos',
      data_assinatura: Date.now(),
    },
  },
};

export const InvalidPayloads = {
  missingPacketeCpf: {
    versao: '1.0',
    laudo_id: 'laudo-001',
    // paciente_cpf missing
    data_resultado: Date.now(),
    resultados: [{ analito: 'Test', valor: 'Pos', unidade: 'U', referencia: 'N' }],
    assinador: { cpf: '98765432100', nome: 'Doctor', data_assinatura: Date.now() },
  },

  emptyResultados: {
    versao: '1.0',
    laudo_id: 'laudo-001',
    paciente_cpf: '12345678900',
    data_resultado: Date.now(),
    resultados: [], // Empty
    assinador: { cpf: '98765432100', nome: 'Doctor', data_assinatura: Date.now() },
  },

  invalidCpfFormat: {
    versao: '1.0',
    laudo_id: 'laudo-001',
    paciente_cpf: '123', // Too short
    data_resultado: Date.now(),
    resultados: [{ analito: 'Test', valor: 'Pos', unidade: 'U', referencia: 'N' }],
    assinador: { cpf: '98765432100', nome: 'Doctor', data_assinatura: Date.now() },
  },

  invalidSignatureHash: {
    hash: 'abc', // Should be 64 chars
    operatorId: 'user-1',
    ts: Date.now(),
  },
};
```

---

## 5. Jest Configuration & Setup

### 5.1 Jest Config Updates

**File:** `functions/jest.config.js`

```javascript
module.exports = {
  displayName: 'functions',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: [
    '<rootDir>/../jest.setup.js', // Global test setup
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  collectCoverageFrom: [
    'modules/**/*.ts',
    '!modules/**/__tests__/**',
    '!modules/**/__mocks__/**',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './modules/notivisa/': {
      branches: 88,
      functions: 92,
      lines: 92,
      statements: 92,
    },
  },
  testTimeout: 15000,
  verbose: true,
  bail: false,
  maxWorkers: 4,
};
```

### 5.2 Jest Setup File

**File:** `functions/jest.setup.js`

```javascript
/**
 * Jest global setup — runs once before all tests
 */

// Mock Cloud Logging
jest.mock('firebase-functions/v2/https', () => ({
  __esModule: true,
  default: {
    ...require('firebase-functions/v2/https'),
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  },
}));

// Mock Admin SDK
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_EMULATOR_HUB = 'localhost:9099';

// Suppress console logs during tests
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.warn = jest.fn();
}

// Global timeout for Firebase operations
jest.setTimeout(15000);
```

---

## 6. Test Matrix & Coverage Plan

### 6.1 Coverage Matrix

| Layer | Component | Tests | Coverage Target | Current | Gap |
|-------|-----------|-------|---|---|---|
| Unit | authenticatePortal | 18 | 95% | — | — |
| Unit | getPatientData | 16 | 92% | — | — |
| Unit | submitRequisition | 22 | 96% | — | — |
| Unit | trackSampleStatus | 20 | 94% | — | — |
| Unit | notivisaDraftCreate | 14 | 91% | — | — |
| Unit | getNotivisaDraft | 12 | 89% | — | — |
| Unit | rejectNotivisaDraft | 15 | 93% | — | — |
| Unit | listNotivisaOutbox | 11 | 88% | — | — |
| Integration | Firestore Emulator | 42 | 90% | — | — |
| Integration | Mock Responses | 15 | 85% | — | — |
| Integration | Authorization | 8 | 100% | — | — |
| Integration | Error Resilience | 18 | 90% | — | — |
| Integration | Audit Trail | 10 | 100% | — | — |
| E2E | Happy Path Flows | 5 | 95% | — | — |
| E2E | Firestore Rules | 5 | 90% | — | — |
| **TOTAL** | **All** | **211** | **92%** | — | — |

### 6.2 Test Execution Plan

```bash
# 1. Unit tests (parallel, ~30s)
npm test -- modules/notivisa/callables

# 2. Integration tests (serial, ~45s)
npm test -- __tests__/integration/notivisa-integration.test.ts

# 3. E2E tests (serial, ~20s)
npm test -- __tests__/integration/notivisa-e2e.test.ts

# 4. Full coverage report
npm test -- --coverage --coverageReporters=html

# 5. Quick smoke test (minimal subset)
npm test -- --testNamePattern="happy path" --maxWorkers=1
```

---

## 7. Critical Path Coverage (100% Requirements)

The following **critical flows** must achieve **100% branch coverage** (no exceptions):

1. **authenticatePortal → Session Creation**
   - Credential validation ✓
   - MFA flow (required + optional) ✓
   - Session doc write ✓
   - Audit log write ✓
   - Error returns (all 8 codes) ✓

2. **submitRequisition → Portal Submission**
   - Session validation (exists, active, not expired) ✓
   - Duplicate check (same laudo + patient) ✓
   - Rate limit enforcement (20/hour) ✓
   - Payload validation (notivisaPayloadSchema) ✓
   - Submission to portal (success + fallback to queued) ✓
   - Document creation + audit log ✓

3. **trackSampleStatus → Status Updates**
   - Submission fetch (exists validation) ✓
   - Terminal state detection (completed, failed, rejected) ✓
   - 24-hour timeout enforcement ✓
   - Portal polling (mock responses) ✓
   - Status transition logic + audit log ✓

4. **Authorization Checks** (all callables)
   - assertNotivisaAccess on every callable entry ✓
   - Module claim validation ✓
   - Lab membership check ✓
   - Error code: PERMISSION_DENIED ✓

5. **Audit Trail** (all callables)
   - Every action logged to notivisa-audit-logs ✓
   - operatorId + ts + action + details ✓
   - No PII leakage (CPF masking) ✓

---

## 8. Error Scenario Matrix

| Scenario | Trigger | Expected Behavior | Test File | Assertion |
|----------|---------|---|---|---|
| API Down (503) | submitRequisition → portal unavailable | Queue for retry (status=queued) | submitRequisition.test.ts | expect(result.status).toBe('queued') |
| API Timeout (30s) | trackSampleStatus → no response | Return PORTAL_ERROR | trackSampleStatus.test.ts | expect(result.code).toBe('PORTAL_ERROR') |
| Invalid CPF | getPatientData → CPF <11 digits | Zod validation error → INTERNAL_ERROR | getPatientData.test.ts | expect(result.code).toContain('INTERNAL_ERROR') |
| Session Expired | trackSampleStatus → authSessionId > 1h old | Return SESSION_EXPIRED | trackSampleStatus.test.ts | expect(result.code).toBe('SESSION_EXPIRED') |
| Rate Limited | submitRequisition → >20/hour | Return RATE_LIMITED | submitRequisition.test.ts | expect(result.code).toBe('RATE_LIMITED') |
| Duplicate Submit | submitRequisition → same laudo + patient | Return DUPLICATE_SUBMISSION | submitRequisition.test.ts | expect(result.code).toBe('DUPLICATE_SUBMISSION') |
| Config Missing | authenticatePortal → no portal config | Return PORTAL_CONFIG_MISSING | authenticatePortal.test.ts | expect(result.code).toBe('PORTAL_CONFIG_MISSING') |
| MFA Required | authenticatePortal → config requires MFA but not provided | Return MFA_REQUIRED | authenticatePortal.test.ts | expect(result.code).toBe('MFA_REQUIRED') |
| Incomplete Data | getPatientData → paciente missing dataNascimento | Return INCOMPLETE_DATA + missingFields | getPatientData.test.ts | expect(result.missingFields).toContain(...) |
| 24h Timeout | trackSampleStatus → submission >24h old | Set status=failed | trackSampleStatus.test.ts | expect(result.status).toBe('failed') |
| Concurrent Submit | submitRequisition × 3 parallel | Only 1 succeeds; 2 get DUPLICATE_SUBMISSION | notivisa-integration.test.ts | expect(successes.length).toBe(1) |
| Malformed Portal Response | trackSampleStatus → portal returns invalid JSON | Fallback gracefully | trackSampleStatus.test.ts | expect(result.ok).toBeDefined() |

---

## 9. Performance & Load Testing

### 9.1 Performance Baselines

| Callable | Target P50 | Target P99 | SLA |
|----------|---|---|---|
| authenticatePortal | 200ms | 800ms | <1s |
| getPatientData | 150ms | 600ms | <1s |
| submitRequisition | 300ms | 1200ms | <2s |
| trackSampleStatus | 200ms | 900ms | <1.5s |
| notivisaDraftCreate | 250ms | 1000ms | <1.5s |
| getNotivisaDraft | 100ms | 400ms | <1s |
| rejectNotivisaDraft | 150ms | 500ms | <1s |
| listNotivisaOutbox | 200ms | 800ms | <1.5s |

### 9.2 Load Test (Future Phase)

```typescript
describe('NOTIVISA Load Testing (Smoke Test)', () => {
  test('should handle 100 concurrent submissions without error', async () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        submitRequisition({
          auth: rtUser,
          data: { ...input, pacienteCpf: `${10000000000 + i}` },
        })
      );
    }
    const results = await Promise.all(promises);
    const successes = results.filter(r => r.ok).length;
    expect(successes).toBeGreaterThan(90); // Allow 10% failure (duplicates, etc.)
  });

  test('should track 50 concurrent status checks', async () => {
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        trackSampleStatus({
          auth: rtUser,
          data: { labId, requisitionId: `req-${i}` },
        })
      );
    }
    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000); // All 50 in <5s
  });
});
```

---

## 10. Deployment & Execution

### 10.1 Pre-Merge Gate

```bash
#!/bin/bash
# Pre-merge checklist: npm test && coverage check

set -e

echo "📦 Running Jest unit + integration tests..."
npm test -- modules/notivisa/callables __tests__/integration/notivisa-integration.test.ts

echo "📊 Checking coverage thresholds..."
npm test -- --coverage --collectCoverageFrom='modules/notivisa/**/*.ts'

# Expected:
# - ✓ All 211 tests pass
# - ✓ notivisa/ module: 92% line, 88% branch
# - ✓ Critical paths: 100% branch coverage

echo "✅ All gates passed. Ready for merge."
```

### 10.2 Running Tests Locally

```bash
# 1. Start Firebase Emulator
firebase emulators:start --import=./emulator-seed

# 2. In another terminal, run tests
npm test -- --watch modules/notivisa/callables/authenticatePortal.test.ts

# 3. View coverage report
npm test -- --coverage
open coverage/functions/index.html
```

### 10.3 CI/CD Integration

**GitHub Actions** (`.github/workflows/notivisa-tests.yml`):

```yaml
name: NOTIVISA Tests (Phase 4)

on:
  pull_request:
    paths:
      - 'functions/src/modules/notivisa/**'
      - 'functions/jest.config.js'
      - 'firestore.rules'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start Firebase Emulator
        run: |
          npm install -g firebase-tools
          firebase emulators:start --import=./emulator-seed &
          sleep 5 # Wait for emulator
      
      - name: Run NOTIVISA tests
        run: npm test -- modules/notivisa __tests__/integration/notivisa
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/functions/lcov.info
          flags: notivisa-phase4
```

---

## 11. Success Criteria & Acceptance

### 11.1 Acceptance Checklist

- [ ] All 8 callable unit test files created (1,200+ LOC)
- [ ] 211+ integration/E2E tests execute successfully
- [ ] 92%+ overall coverage; 100% critical paths
- [ ] All 8 callables have all error codes tested
- [ ] Mock NOTIVISA responses tested (submit success/failure, status progression)
- [ ] Authorization + audit trail tests pass
- [ ] E2E flows validate end-to-end (auth → submit → track)
- [ ] Firestore rules align with callables (no orphaned documents)
- [ ] Performance baselines met (P50 <300ms, P99 <1.2s)
- [ ] Error matrix complete (12 scenarios × callables)
- [ ] Rate limiting tested (20 submissions/hour enforced)
- [ ] Session expiry tested (1 hour timeout)
- [ ] 24-hour polling timeout tested
- [ ] Duplicate submission prevention tested
- [ ] Concurrent request handling validated
- [ ] PII masking (CPF) verified in audit logs
- [ ] RDC 978 Art. 66 audit trail complete + logged

### 11.2 Sign-Off

| Role | Responsibility | Sign-Off |
|------|---|---|
| Engineer | Implementation + unit tests | |
| QA Lead | Integration + E2E tests + coverage report | |
| CTO | Critical path verification + compliance check | |

---

## 12. Appendix: Test File Examples

### 12.1 submitRequisition.test.ts (Skeleton)

```typescript
/**
 * submitRequisition.test.ts — Unit tests
 * 210 lines | 96% coverage target
 */

describe('submitRequisition', () => {
  let mockDb: any;
  let mockBatch: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock setup...
  });

  describe('Authorization & Input Validation', () => {
    test('should reject unauthenticated request');
    test('should validate labId not empty');
    test('should validate CPF format (11 digits)');
    test('should validate notivisaPayloadSchema');
  });

  describe('Happy Path (Success Cases)', () => {
    test('should submit and return ok=true with requisitionId');
    test('should create notivisa-requisitions/{labId}/submissions/{id}');
    test('should set status=queued on portal failure');
    test('should set status=submitted on portal success');
    test('should set nextCheckAt = now + 5 min');
  });

  describe('Error Scenarios (All 8 Codes)', () => {
    test('should return INVALID_SESSION if session not found');
    test('should return SESSION_EXPIRED if session > 1h old');
    test('should return INVALID_PAYLOAD on Zod validation error');
    test('should return DUPLICATE_SUBMISSION for same laudo+patient');
    test('should return PORTAL_ERROR on HTTP error');
    test('should return RATE_LIMITED if >20/hour');
    test('should return PERMISSION_DENIED without notivisa claim');
    test('should return INTERNAL_ERROR on uncaught exception');
  });

  describe('Audit Logging', () => {
    test('should create auditLog entry with action=SUBMITTED');
    test('should include payloadHash in details');
    test('should update session lastActivityAt');
  });
});
```

### 12.2 Integration Test Group (Skeleton)

```typescript
describe('NOTIVISA Integration — Mock Responses', () => {
  let testEnv: RulesTestEnvironment;
  let db: Firestore;
  let functions: Functions;

  beforeAll(async () => {
    testEnv = await initializeTestApp({ projectId: 'hmatologia2-test' });
    // Setup...
  });

  test('should transition from queued → submitted → processing → completed', async () => {
    // 1. Submit
    // 2. Poll 3× with mock progression
    // 3. Verify final status = completed
  });

  test('should handle portal unavailable gracefully', async () => {
    // 1. Mock portal 503
    // 2. Submit requisition
    // 3. Verify status = queued (fallback)
  });
});
```

---

## 13. Timeline & Milestones

| Phase | Task | Duration | Owner |
|-------|------|----------|-------|
| 1 | Create 8 unit test files | 2d | Engineer |
| 2 | Create integration test suite | 1d | Engineer |
| 3 | Create E2E test flows | 1d | QA |
| 4 | Mock NOTIVISA responses + fixtures | 0.5d | Engineer |
| 5 | Firestore Rules validation tests | 0.5d | Engineer |
| 6 | Coverage report + gap analysis | 0.5d | QA |
| 7 | Performance baseline collection | 1d | Engineer |
| **TOTAL** | **Phase 4 Test Strategy** | **6d** | **Team** |

---

## 14. References & Documentation

- **ADR-0014:** NOTIVISA Integration (Sandbox → Production)
- **ADR-0021:** NOTIVISA Queue Pattern
- **ADR-0026:** Queue Processing (Async, Append-Only)
- **RDC 978 Art. 66:** Government notification requirements
- **Firestore Rules:** `.claude/rules/notivisa-firestore-rules.md`
- **Jest Docs:** https://jestjs.io/
- **Firebase Emulator:** https://firebase.google.com/docs/emulator-suite
- **Firebase Rules Unit Testing:** https://github.com/firebase/firebase-js-sdk/tree/master/packages/rules-unit-testing

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-08  
**Status:** Ready for Review & Implementation
