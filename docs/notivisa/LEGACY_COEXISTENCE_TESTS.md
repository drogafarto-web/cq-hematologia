# NOTIVISA Legacy Coexistence Test Strategy

**Status:** Phase 4 (Wave 3-6) — Test Planning
**Date:** 2026-05-08
**Scope:** Validation of mixed-mode draft lifecycle (legacy + Wave 2 callables)

---

## Executive Summary

This document defines **comprehensive test coverage** for scenarios where:

1. **Legacy callable** creates a draft → **Wave 2 cron** processes it
2. **Wave 2 callable** creates a draft → **Legacy cron** processes it (fallback)
3. **Both callables used in same lab** → no data loss, no duplicate submissions, audit coherent

Goal: **Zero race conditions, zero silent failures during the 3-month transition window (May 20 → Aug 1).**

---

## Part A: Test Categories

### Category 1: Status Enum Compatibility

#### Test 1.1: Legacy Draft in Wave 2 Query

**Scenario:**

```
1. Call notivisaDraftCreate (legacy) → draft ABC created with status='draft'
2. Query: db.collection(...).where('status', 'in', ['pending', 'draft'])
3. Result: draft ABC must be visible
```

**Expected:** ✅ Draft ABC returned
**Failure Mode:** Draft invisibly skipped; RT can't find it to approve

**Implementation:**

```typescript
it('T1.1: Legacy draft visible in Wave 2 query', async () => {
  const draftResult = await notivisaDraftCreate({
    labId: testLabId,
    laudoId: 'T1.1-001',
    payload: { ... }
  });

  const queryResult = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .where('status', 'in', ['pending', 'draft'])
    .get();

  const found = queryResult.docs.find(d => d.id === draftResult.draftId);
  expect(found).toBeDefined();
  expect(found?.data().status).toBe('draft');
});
```

---

#### Test 1.2: Wave 2 Draft in Legacy Query

**Scenario:**

```
1. Call notivisaCreateDraft (Wave 2) → draft XYZ created with status='pending'
2. Legacy cron queries: where('status', '==', 'draft')
3. Result: draft XYZ must NOT interfere (held for Wave 2 processing)
```

**Expected:** ✅ Draft XYZ ignored; no crash
**Failure Mode:** Legacy cron crashes or modifies Wave 2 draft

**Implementation:**

```typescript
it('T1.2: Wave 2 draft ignored by legacy status query', async () => {
  const draftResult = await notivisaCreateDraft({
    labId: testLabId,
    laudoId: 'T1.2-001',
    payload: { ... }
  });

  const legacyQuery = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .where('status', '==', 'draft')
    .get();

  const found = legacyQuery.docs.find(d => d.id === draftResult.draftId);
  expect(found).toBeUndefined(); // Wave 2 draft not found by legacy filter
});
```

---

### Category 2: Signature Ceremony Interop

#### Test 2.1: Legacy Approve → Wave 2 Submit

**Scenario:**

```
1. Legacy notivisaDraftCreate creates draft with signature
2. Legacy approveNotivisaDraft called with signature verification
3. Wave 2 notivisaSubmitDraft called (expects status='approved', doesn't check signature)
4. Result: submission succeeds
```

**Expected:** ✅ Draft transitions to submitted in queue
**Failure Mode:** Wave 2 rejects because signature missing/wrong format

**Implementation:**

```typescript
it('T2.1: Legacy-approved draft submits via Wave 2', async () => {
  // Step 1: Create with legacy
  const createResult = await notivisaDraftCreate({
    labId: testLabId,
    laudoId: 'T2.1-001',
    payload: { ... }
  });
  const draftId = createResult.draftId;

  // Step 2: Approve with legacy signature
  const sig = generateNotivisaSignatureClient(uid, { draftId, action: 'approve' }, Date.now());
  const approveResult = await approveNotivisaDraft({
    labId: testLabId,
    draftId,
    signature: sig
  });
  expect(approveResult.status).toBe('approved');

  // Step 3: Submit with Wave 2 (ignores signature)
  const submitResult = await notivisaSubmitDraft({
    labId: testLabId,
    draftId
  });

  expect(submitResult.ok).toBe(true);
  expect(submitResult.status).toBe('pending'); // enqueued
  expect(submitResult.eventId).toBeDefined();
});
```

---

#### Test 2.2: Wave 2 Approve → Legacy Submit

**Scenario:**

```
1. Wave 2 notivisaCreateDraft creates draft (status='pending', no signature)
2. Wave 2 notivisaApproveDraft (status='pending' → 'approved', stores approvalMetadata)
3. Legacy submitNotivisaDraft called (expects status in ['draft', 'approved'], no signature check)
4. Result: submission succeeds
```

**Expected:** ✅ Draft enqueued in `notivisa-queue`
**Failure Mode:** Legacy submit fails due to status mismatch or missing signature

**Implementation:**

```typescript
it('T2.2: Wave 2-approved draft submits via legacy', async () => {
  // Step 1: Create with Wave 2
  const createResult = await notivisaCreateDraft({
    labId: testLabId,
    laudoId: 'T2.2-001',
    payload: { ... }
  });
  const draftId = createResult.draftId;
  expect(createResult.status).toBe('pending');

  // Step 2: Approve with Wave 2
  const approveResult = await notivisaApproveDraft({
    labId: testLabId,
    draftId
  });
  expect(approveResult.status).toBe('approved');

  // Step 3: Submit with legacy (accepts both 'draft' and 'approved')
  const submitResult = await submitNotivisaDraft({
    labId: testLabId,
    draftId
  });

  expect(submitResult.ok).toBe(true);
  expect(submitResult.status).toBe('pending'); // queue status

  // Verify draft status in Firestore
  const draftSnap = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .doc(draftId)
    .get();
  expect(draftSnap.data().status).toBe('submitted');
});
```

---

### Category 3: Queue Processing

#### Test 3.1: Queue Event from Legacy Draft

**Scenario:**

```
1. Legacy draft created → approved → submitted
2. Queue event created by submitNotivisaDraft (legacy)
3. Wave 2 cron (processQueue) picks up event
4. Result: event processed, response stored, draft marked as submitted
```

**Expected:** ✅ Event processed, response recorded, no crashes
**Failure Mode:** Cron ignores event (wrong shape), crashes (missing field), or double-processes

**Implementation:**

```typescript
it('T3.1: Legacy queue event processed by Wave 2 cron', async () => {
  // Setup: legacy draft → approved → submitted
  const createResult = await notivisaDraftCreate({
    labId: testLabId,
    laudoId: 'T3.1-001',
    payload: { ... }
  });
  const draftId = createResult.draftId;

  const sig = generateNotivisaSignatureClient(uid, { draftId, action: 'approve' }, Date.now());
  await approveNotivisaDraft({
    labId: testLabId,
    draftId,
    signature: sig
  });

  const submitResult = await submitNotivisaDraft({
    labId: testLabId,
    draftId
  });
  const eventId = submitResult.eventId;

  // Verify queue event created
  const eventSnap = await db
    .collection('notivisa-queue')
    .doc(testLabId)
    .collection('events')
    .doc(eventId)
    .get();
  expect(eventSnap.exists).toBe(true);
  const eventData = eventSnap.data();
  expect(eventData.status).toBe('pending');
  expect(eventData.attempts).toBe(0);

  // Simulate Wave 2 cron processing
  const processorContext = {
    auth: { uid: 'system' }, // simulated
  };
  await processQueue(processorContext); // TBD: Cloud Function signature

  // Verify event processed (attempts incremented, status updated)
  const updatedSnap = await eventSnap.ref.get();
  const updated = updatedSnap.data();
  expect(updated.attempts).toBeGreaterThan(0);
  expect(['success', 'failed', 'pending']).toContain(updated.status);
});
```

---

#### Test 3.2: Queue Event from Wave 2 Draft

**Scenario:**

```
1. Wave 2 draft created → approved → submitted
2. Queue event created by notivisaSubmitDraft (Wave 2)
3. Legacy cron (or fallback) ignores (different event shape)
4. Wave 2 cron processes event
```

**Expected:** ✅ Event processed by Wave 2 cron, ignored by legacy
**Failure Mode:** Legacy cron crashes due to missing `mode` field

**Implementation:**

```typescript
it('T3.2: Wave 2 queue event has new fields (mode, nextRetry)', async () => {
  // Setup: Wave 2 draft → approved → submitted
  const createResult = await notivisaCreateDraft({
    labId: testLabId,
    laudoId: 'T3.2-001',
    payload: { ... },
    mode: 'test' // explicit
  });
  const draftId = createResult.draftId;

  await notivisaApproveDraft({
    labId: testLabId,
    draftId
  });

  const submitResult = await notivisaSubmitDraft({
    labId: testLabId,
    draftId
  });
  const eventId = submitResult.eventId;

  // Verify queue event has Wave 2 fields
  const eventSnap = await db
    .collection('notivisa-queue')
    .doc(testLabId)
    .collection('events')
    .doc(eventId)
    .get();
  const eventData = eventSnap.data();

  // Wave 2 specific fields
  expect(eventData.mode).toBe('test');
  expect(eventData.nextRetry).toBeDefined(); // Timestamp
  expect(eventData.enqueuedBy).toBe(uid);
  expect(eventData.laudoId).toBe('T3.2-001');

  // Legacy queue events don't have these
  // (legacy has: draftId, pacienteCpf, status, attempts, maxAttempts, createdAt, updatedAt)
});
```

---

### Category 4: Audit Trail Coherence

#### Test 4.1: Audit Log Actions from Both Paths Visible

**Scenario:**

```
1. Legacy draft created → action='CREATED' logged
2. Wave 2 draft created → action='DRAFT_CREATED' logged
3. Query all audit logs
4. Result: both actions visible with distinct names
```

**Expected:** ✅ Audit logs differentiated
**Failure Mode:** Audit logs merged/lost, query returns incomplete results

**Implementation:**

```typescript
it('T4.1: Both legacy and Wave 2 audit actions visible', async () => {
  // Create legacy draft
  const legacyResult = await notivisaDraftCreate({
    labId: testLabId,
    laudoId: 'T4.1-legacy',
    payload: { ... }
  });

  // Create Wave 2 draft
  const wave2Result = await notivisaCreateDraft({
    labId: testLabId,
    laudoId: 'T4.1-wave2',
    payload: { ... }
  });

  // Query all audit logs
  const auditSnap = await db
    .collection('auditLogs')
    .doc(testLabId)
    .collection('entries')
    .where('action', 'in', ['CREATED', 'DRAFT_CREATED', 'NOTIVISA_DRAFT_CREATE', 'NOTIVISA_DRAFT_CREATED'])
    .get();

  const createdActions = auditSnap.docs.map(d => d.data().action);
  expect(createdActions).toContain('CREATED'); // legacy
  expect(createdActions).toContain('DRAFT_CREATED'); // Wave 2
});
```

---

#### Test 4.2: Approval Audit Trail (Both Signatures)

**Scenario:**

```
1. Legacy draft: approveNotivisaDraft stores rtApprovalSignature (hash, operatorId, ts)
2. Wave 2 draft: notivisaApproveDraft stores approvedBy, approvedAt (no hash)
3. Audit log: both captured with correct metadata
```

**Expected:** ✅ Both approval styles recorded
**Failure Mode:** Signature data lost, approval metadata incomplete

**Implementation:**

```typescript
it('T4.2: Legacy approval signature stored; Wave 2 stores metadata', async () => {
  // Legacy: create → approve with signature
  const legacyCreate = await notivisaDraftCreate({
    labId: testLabId,
    laudoId: 'T4.2-legacy',
    payload: { ... }
  });
  const legacyDraftId = legacyCreate.draftId;

  const sig = generateNotivisaSignatureClient(uid, { draftId: legacyDraftId, action: 'approve' }, Date.now());
  const legacyApprove = await approveNotivisaDraft({
    labId: testLabId,
    draftId: legacyDraftId,
    signature: sig
  });

  // Verify legacy draft has rtApprovalSignature
  const legacySnap = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .doc(legacyDraftId)
    .get();
  const legacyData = legacySnap.data();
  expect(legacyData.rtApprovalSignature).toBeDefined();
  expect(legacyData.rtApprovalSignature.hash).toBeDefined();
  expect(legacyData.rtApprovalSignature.operatorId).toBe(uid);

  // Wave 2: create → approve without signature
  const wave2Create = await notivisaCreateDraft({
    labId: testLabId,
    laudoId: 'T4.2-wave2',
    payload: { ... }
  });
  const wave2DraftId = wave2Create.draftId;

  const wave2Approve = await notivisaApproveDraft({
    labId: testLabId,
    draftId: wave2DraftId
  });

  // Verify Wave 2 draft has approvedBy / approvedAt (no hash)
  const wave2Snap = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .doc(wave2DraftId)
    .get();
  const wave2Data = wave2Snap.data();
  expect(wave2Data.approvedBy).toBe(uid);
  expect(wave2Data.approvedAt).toBeDefined();
  expect(wave2Data.rtApprovalSignature).toBeUndefined(); // Wave 2 doesn't store this
});
```

---

### Category 5: Rejection Handling

#### Test 5.1: Legacy Rejection (Status='rejected')

**Scenario:**

```
1. Legacy draft created → rejected via rejectNotivisaDraft
2. Query: where('status', '==', 'rejected')
3. Result: draft visible with motivo
```

**Expected:** ✅ Rejected draft stored with reason
**Failure Mode:** Rejection lost, motivo not stored

**Implementation:**

```typescript
it('T5.1: Legacy draft rejection stores motivo', async () => {
  const createResult = await notivisaDraftCreate({
    labId: testLabId,
    laudoId: 'T5.1-001',
    payload: { ... }
  });
  const draftId = createResult.draftId;

  const rejectMotivo = 'CPF inválido na fonte';
  const sig = generateNotivisaSignatureClient(uid, { draftId, action: 'reject' }, Date.now());
  const rejectResult = await rejectNotivisaDraft({
    labId: testLabId,
    draftId,
    motivo: rejectMotivo,
    signature: sig
  });

  expect(rejectResult.status).toBe('rejected');

  // Verify motivo stored
  const draftSnap = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .doc(draftId)
    .get();
  expect(draftSnap.data().status).toBe('rejected');
  expect(draftSnap.data().motivo).toBe(rejectMotivo);
});
```

---

#### Test 5.2: Wave 2 Rejection (Soft Delete)

**Scenario:**

```
1. Wave 2 draft created
2. TBD: rejection mechanism (proposed: soft-delete via deletadoEm != null)
3. Query: where('deletadoEm', '==', null) excludes it
```

**Expected:** ✅ Soft-deleted draft invisible to normal queries
**Failure Mode:** Deleted draft still visible, no way to recover reason

**Note:** Phase 4 doesn't have Wave 2 rejection callable yet; placeholder for future.

**Implementation:**

```typescript
it('T5.2: Wave 2 rejection via soft-delete (placeholder)', async () => {
  // TBD: implement rejectDraft in Wave 2 (Phase 5+)
  // For now, rejection is manual soft-delete via admin

  const createResult = await notivisaCreateDraft({
    labId: testLabId,
    laudoId: 'T5.2-001',
    payload: { ... }
  });
  const draftId = createResult.draftId;

  // Manual soft-delete
  await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .doc(draftId)
    .update({
      deletadoEm: admin.firestore.FieldValue.serverTimestamp(),
      rejectionReason: 'Test rejection'
    });

  // Verify soft-deleted draft invisible to active queries
  const activeSnap = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .where('deletadoEm', '==', null)
    .get();

  const found = activeSnap.docs.find(d => d.id === draftId);
  expect(found).toBeUndefined();
});
```

---

### Category 6: Race Conditions

#### Test 6.1: Dual Submission Prevention (Idempotency)

**Scenario:**

```
1. Client calls notivisaCreateDraft (Wave 2) twice in quick succession
2. Result: both calls return same draftId (idempotency wins)
3. No duplicate drafts created
```

**Expected:** ✅ Idempotent; second call returns existing draftId
**Failure Mode:** Two separate drafts created; duplicate submissions to government

**Implementation:**

```typescript
it('T6.1: Wave 2 idempotency prevents duplicate drafts', async () => {
  const payload = {
    labId: testLabId,
    laudoId: 'T6.1-001',
    payload: { ... }
  };

  // Call twice concurrently
  const [result1, result2] = await Promise.all([
    notivisaCreateDraft(payload),
    notivisaCreateDraft(payload)
  ]);

  expect(result1.draftId).toBe(result2.draftId);
  expect(result1.idempotent).toBe(false); // First call creates
  expect(result2.idempotent).toBe(true);  // Second call returns existing

  // Verify only one draft in Firestore
  const snaps = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .where('laudoId', '==', 'T6.1-001')
    .get();
  expect(snaps.docs).toHaveLength(1);
});
```

---

#### Test 6.2: Mixed-Mode Idempotency (Legacy vs Wave 2)

**Scenario:**

```
1. Client calls notivisaDraftCreate (legacy) with laudoId='ABC' → draft D1 created, status='draft'
2. Same client calls notivisaCreateDraft (Wave 2) with laudoId='ABC' → creates new draft D2, status='pending'
3. Result: TWO separate drafts (both have same laudoId)
4. Cron must handle both without confusion
```

**Expected:** ⚠️ Both drafts created (no collision); cron processes both without conflict
**Failure Mode:** Cron picks one and ignores other; race condition in queue

**Implementation:**

```typescript
it('T6.2: Mixed-mode callables create separate drafts (same laudoId allowed)', async () => {
  // Legacy call
  const legacyResult = await notivisaDraftCreate({
    labId: testLabId,
    laudoId: 'T6.2-shared',
    payload: { ... }
  });

  // Wave 2 call (same laudoId)
  const wave2Result = await notivisaCreateDraft({
    labId: testLabId,
    laudoId: 'T6.2-shared',
    payload: { ... }
  });

  // Both succeed; different draftIds
  expect(legacyResult.draftId).not.toBe(wave2Result.draftId);
  expect(legacyResult.status).toBe('draft');
  expect(wave2Result.status).toBe('pending');

  // Verify both in Firestore
  const snaps = await db
    .collection('notivisa-drafts')
    .doc(testLabId)
    .collection('drafts')
    .where('laudoId', '==', 'T6.2-shared')
    .get();
  expect(snaps.docs).toHaveLength(2);

  // Cron must process both without conflicts (separate code paths)
  // This is handled by conflict detection cron in Phase 6
});
```

---

### Category 7: Rate Limiting

#### Test 7.1: Legacy Rate Limit (10 req/min)

**Scenario:**

```
1. Call notivisaDraftCreate 11 times in <60 seconds
2. First 10 succeed; 11th fails with resource-exhausted
```

**Expected:** ✅ Rate limit enforced
**Failure Mode:** All 11 succeed (limit not working); no protection against abuse

**Implementation:**

```typescript
it('T7.1: Legacy rate limit enforced (10/min per lab)', async () => {
  const requests = Array.from({ length: 11 }, (_, i) => ({
    labId: testLabId,
    laudoId: `T7.1-${i}`,
    payload: { ... }
  }));

  const results = await Promise.allSettled(
    requests.map(r => notivisaDraftCreate(r))
  );

  // First 10 succeed
  const succeeded = results.filter(r => r.status === 'fulfilled');
  expect(succeeded).toHaveLength(10);

  // 11th fails
  const failed = results.filter(r => r.status === 'rejected');
  expect(failed).toHaveLength(1);
  expect(failed[0].reason.code).toBe('resource-exhausted');
});
```

---

#### Test 7.2: Wave 2 No Rate Limit (Yet)

**Scenario:**

```
1. Call notivisaCreateDraft 11 times in <60 seconds
2. All 11 succeed (no rate limiting yet; planned Phase 5)
```

**Expected:** ✅ No limit (by design, Phase 4)
**Failure Mode:** Rate limit implemented early (scope creep)

**Implementation:**

```typescript
it('T7.2: Wave 2 has no rate limit (Phase 4)', async () => {
  const requests = Array.from({ length: 11 }, (_, i) => ({
    labId: testLabId,
    laudoId: `T7.2-${i}`,
    payload: { ... }
  }));

  const results = await Promise.allSettled(
    requests.map(r => notivisaCreateDraft(r))
  );

  // All 11 succeed
  const succeeded = results.filter(r => r.status === 'fulfilled');
  expect(succeeded).toHaveLength(11);

  // None fail
  const failed = results.filter(r => r.status === 'rejected');
  expect(failed).toHaveLength(0);
});
```

---

## Part B: Integration Test Suite File

**File:** `functions/src/modules/notivisa/__tests__/mixed-mode-integration.test.ts`

```typescript
/**
 * NOTIVISA Legacy Coexistence Integration Tests
 *
 * Validates that legacy (Batch 1) and Wave 2 (Agent 10) callables
 * can coexist in the same lab without data loss or race conditions.
 *
 * Test categories:
 * 1. Status enum compatibility
 * 2. Signature ceremony interop
 * 3. Queue processing (both paths)
 * 4. Audit trail coherence
 * 5. Rejection handling
 * 6. Race conditions / idempotency
 * 7. Rate limiting
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as admin from 'firebase-admin';
import {
  notivisaDraftCreate,
  approveNotivisaDraft,
  submitNotivisaDraft,
  rejectNotivisaDraft,
  notivisaCreateDraft,
  notivisaApproveDraft,
  notivisaSubmitDraft,
} from '../index';

const testLabId = 'test-lab-mixed-mode';
const testUid = 'user-test-rt';

describe('NOTIVISA Mixed-Mode Integration Tests', () => {
  let db: admin.firestore.Firestore;

  beforeEach(async () => {
    db = admin.firestore();
    // Setup: ensure lab + user exist
    await ensureNotivisaLabRoot(db, testLabId);
  });

  afterEach(async () => {
    // Cleanup: delete test drafts
    const snaps = await db.collection('notivisa-drafts').doc(testLabId).collection('drafts').get();
    const batch = db.batch();
    snaps.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });

  describe('Category 1: Status Enum Compatibility', () => {
    // Tests 1.1, 1.2 go here
  });

  describe('Category 2: Signature Ceremony Interop', () => {
    // Tests 2.1, 2.2 go here
  });

  // ... other categories
});
```

---

## Part C: Test Execution Matrix

| Test                                       | Phase 4        | Phase 5         | Phase 6              |
| ------------------------------------------ | -------------- | --------------- | -------------------- |
| **Category 1: Status Enum**                |
| 1.1: Legacy visible in Wave 2 query        | ✅ Required    | ✅ Passes       | ✅ N/A (legacy gone) |
| 1.2: Wave 2 ignored by legacy query        | ✅ Required    | ✅ Passes       | ✅ N/A               |
| **Category 2: Signature Interop**          |
| 2.1: Legacy approve + Wave 2 submit        | ✅ Required    | ✅ Passes       | ✅ N/A               |
| 2.2: Wave 2 approve + legacy submit        | ✅ Required    | ✅ Passes       | ✅ N/A               |
| **Category 3: Queue Processing**           |
| 3.1: Legacy queue → Wave 2 cron            | ✅ Required    | ✅ Passes       | ✅ N/A               |
| 3.2: Wave 2 queue → Wave 2 cron            | ✅ Required    | ✅ Passes       | ✅ Passes            |
| **Category 4: Audit Trail**                |
| 4.1: Both action names visible             | ✅ Required    | ✅ Passes       | ✅ N/A               |
| 4.2: Approval signatures/metadata          | ✅ Required    | ✅ Passes       | ✅ N/A               |
| **Category 5: Rejection**                  |
| 5.1: Legacy rejection + motivo             | ✅ Required    | ✅ Passes       | ✅ N/A               |
| 5.2: Wave 2 soft-delete (placeholder)      | ⏳ Placeholder | ✅ Implement    | ✅ Passes            |
| **Category 6: Race Conditions**            |
| 6.1: Idempotency (Wave 2)                  | ✅ Required    | ✅ Passes       | ✅ Passes            |
| 6.2: Mixed-mode (both create same laudoId) | ✅ Required    | ✅ Passes       | ✅ N/A               |
| **Category 7: Rate Limiting**              |
| 7.1: Legacy rate limit                     | ✅ Required    | ✅ Passes       | ✅ N/A               |
| 7.2: Wave 2 no limit (Phase 4)             | ✅ Required    | 📋 Plan Phase 5 | ✅ Implemented       |

---

## Part D: Success Criteria

### Phase 4 (May 20 → Jun 20)

- [ ] All Category 1–4 tests pass
- [ ] Mixed-mode idempotency works (6.1, 6.2)
- [ ] Legacy rate limiting intact (7.1)
- [ ] Zero silent failures in test suite
- [ ] Audit trail coherent for both paths

### Phase 5 (Jun 20 → Jul 20)

- [ ] Category 5.2 implemented (Wave 2 rejection)
- [ ] Rate limiting added to Wave 2 (7.2)
- [ ] Conflict detection cron passes live testing
- [ ] <1% of new submissions on legacy path (telemetry)

### Phase 6 (Jul 20 → Aug 1)

- [ ] Feature flag flip (legacy disabled)
- [ ] All legacy tests archived
- [ ] Wave 2 tests pass 100%
- [ ] Zero incidents post-cutover

---

## Related Documents

- `LEGACY_AUDIT.md` — detailed technical audit
- `MIGRATION_LEGACY_TO_WAVE2.md` — customer migration guide
- `NOTIVISA_CLEANUP_ROADMAP.md` — phase-by-phase timeline

---

## Sign-Off

| Role                 | Name | Date       |
| -------------------- | ---- | ---------- |
| Wave 3-6 QA Engineer | TBD  | 2026-05-08 |
| CTO Review           | TBD  | TBD        |
