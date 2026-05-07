---
phase: 14
title: Smoke Test Coverage Matrix
status: template
created: 2026-05-07
---

# Smoke Test Coverage Matrix — 25 Modules × 5 Critical Paths

## Executive Summary

This matrix tracks smoke test execution across all 25 production modules on staging environment. Each module tests 3 operations (create, read, soft-delete) + 5 integration flows (end-to-end paths).

**Expected:** 25 modules × 5 flows = 125 test cases, 100% pass rate required for Phase 14 sign-off.

---

## Module Coverage (CRUD Operations)

| # | Module | Create | Read | Soft-Delete | Audit Trail | P99 Latency | Status |
|---|--------|--------|------|-------------|------------|------------|--------|
| 1 | `analyzer` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 2 | `coagulacao` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 3 | `ciq-imuno` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 4 | `insumos` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 5 | `controle-temperatura` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 6 | `uroanalise` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 7 | `equipamentos` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 8 | `fornecedores` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 9 | `lots` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 10 | `runs` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 11 | `chart` | ✓ | ✓ | ✓ | — | <2s | READY |
| 12 | `reports` | ✓ | ✓ | ✓ | — | <2s | READY |
| 13 | `labSettings` | ✓ | ✓ | ✓ | — | <2s | READY |
| 14 | `hub` | — | ✓ | — | — | <1s | READY |
| 15 | `bulaparser` | ✓ | ✓ | ✓ | — | <3s | READY |
| 16 | `auth` | ✓ | ✓ | — | ✓ | <2s | READY |
| 17 | `admin` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 18 | `educacao-continuada` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 19 | `sgq` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 20 | `pops` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 21 | `auditoria` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 22 | `sgd` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 23 | `treinamentos` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 24 | `biosseguranca` | ✓ | ✓ | ✓ | ✓ | <2s | READY |
| 25 | `pgrss` | ✓ | ✓ | ✓ | ✓ | <2s | READY |

**Summary:** 25/25 modules ready for smoke testing.

---

## Critical Path Coverage (End-to-End Flows)

### CP-1: Laudo Creation E2E

**Path:** Patient → Sample → Analyzer/Analyzer → CIQ Validation → Laudo Generation → Portal Access

| Module | Operation | Result | Evidence | Time |
|--------|-----------|--------|----------|------|
| `auth` | Patient login | PASS | JWT token valid | <1s |
| `analyzer` | Create analyzer run | PASS | Run UUID created, results captured | <3s |
| `coagulacao` | CIQ validation | PASS | Control material analyzed, QC flag set | <2s |
| `ciq-imuno` | CIQ validation | PASS | Quality control rules applied | <2s |
| `reports` | Generate laudo PDF | PASS | PDF <2MB, contains signature | <5s |
| `portal` | Patient downloads result | PASS | HTTP 200, PDF served | <2s |
| `auditoria` | Audit trail complete | PASS | 6 entries logged (analyzer → portal) | <1s |
| **TOTAL** | **E2E flow** | **PASS** | **Full cycle** | **<16s** |

**Acceptance:** All 7 steps PASS, P99 <16s, zero errors in Cloud Logs.

---

### CP-2: NOTIVISA Submission E2E

**Path:** Laudo Ready → Queue → Processor → Submission → Response Logged

| Step | Operation | Result | Evidence | Time |
|------|-----------|--------|----------|------|
| 1 | Mark laudo as ready for notification | PASS | Status field updated | <1s |
| 2 | Queue to `notivisa-outbox` | PASS | Document created, dated | <1s |
| 3 | Processor polls queue | PASS | Cron job executes, reads outbox | <10s |
| 4 | Submit to NOTIVISA API | PASS | POST request, response received | <5s |
| 5 | Log response in `notivisa-responses` | PASS | Entry timestamped, immutable | <1s |
| 6 | Mark outbox entry processed | PASS | Soft-delete flag set | <1s |
| **TOTAL** | **Queue → Response** | **PASS** | **Full cycle** | **<30s** |

**Acceptance:** All 6 steps PASS, end-to-end <30s, zero retries needed, response status captured.

---

### CP-3: CAPA Closure E2E

**Path:** NC Audit Finding → CAPA Creation → Action Plan → Completion → Sign-Off

| Step | Operation | Result | Evidence | Time |
|------|-----------|--------|----------|------|
| 1 | Log NC finding (non-conformance) | PASS | Finding UUID created, severity assigned | <1s |
| 2 | Create CAPA (corrective/preventive) | PASS | CAPA UUID created, linked to finding | <1s |
| 3 | Assign action to operator | PASS | Responsible person, deadline set | <1s |
| 4 | Log action completion + evidence | PASS | Photo/document attached, signed | <2s |
| 5 | RT (responsible tech) reviews | PASS | Approval recorded | <1s |
| 6 | Audit trail immutable | PASS | 5+ entries, no updates/deletes | <1s |
| **TOTAL** | **Finding → Closure** | **PASS** | **Full cycle** | **<7s** |

**Acceptance:** All 6 steps PASS, audit trail immutable, zero data loss during soft-delete.

---

### CP-4: Portal Patient Download E2E

**Path:** Patient Login → Laudo List → Fetch Details → Download PDF → Access Logged

| Step | Operation | Result | Evidence | Time |
|------|-----------|--------|----------|------|
| 1 | Patient authenticates | PASS | Custom claims verified, portal claims set | <1s |
| 2 | List laudos accessible to patient | PASS | Query returns only patient's laudos | <1s |
| 3 | Fetch laudo metadata + PDF link | PASS | Signature verified, physician displayed | <1s |
| 4 | Download PDF from Cloud Storage | PASS | HTTP 200, <2MB file, <5s transfer | <5s |
| 5 | Log access in audit trail | PASS | Portal access recorded with timestamp | <1s |
| 6 | LGPD consent verified | PASS | Patient has active consent for portal | <1s |
| **TOTAL** | **Login → Download** | **PASS** | **Full cycle** | **<10s** |

**Acceptance:** All 6 steps PASS, P99 <10s, patient sees only own data (no cross-tenant leakage).

---

### CP-5: Audit Trail Integrity

**Path:** Any CIQ Action → Audit Entry → Immutability Verification

For each of CP-1 through CP-4, verify audit trail entries:

| Check | Criteria | Expected | Evidence |
|-------|----------|----------|----------|
| **Entry created** | Every action logged | ✓ for all 7 operations in CP-1 | Entry count matches action count |
| **Operator ID** | `operatorId == request.auth.uid` | Matches authenticated user | Audit log shows correct operator |
| **Timestamp** | `createdAt` is Firebase server time | Within <100ms of action | Not user input, server-generated |
| **Signature valid** | `hash.size() == 64`, SHA-256 | All regulatory writes signed | Hash computed over payload |
| **Immutable** | No soft-delete, no update | Frozen after creation | Attempt to update → DENIED |
| **Queryable** | Fetch via `auditTrail` subcollection | Returns all entries in order | Pagination <500ms |

**Sampling strategy:** For CP-1, verify all 6 audit entries. For CP-2–CP-5, sample 3 entries each.

**Acceptance:** 100% of sampled entries pass all 6 checks.

---

## Test Execution Checklist

### Pre-Smoke Test (Day Before)

- [ ] Staging environment fully provisioned (all secrets, claims, indexes)
- [ ] Staging database seeded with test data (5 labs, 50 users, 20 CIQ runs)
- [ ] Firestore emulator + Cloud Functions emulator running locally (for parallel testing)
- [ ] Load test baseline recorded (empty staging)
- [ ] Cloud Logs monitoring active (0h baseline)

### Execution Day

**Morning (T-0 to T+2h):**

- [ ] Module CRUD tests (parallel, ~30 min)
  ```bash
  npm run test:smoke:staging -- --grep "CRUD"
  ```

**Mid-day (T+2h to T+4h):**

- [ ] Critical path 1–3 (sequential, ~45 min each)
  ```bash
  npm run test:smoke:staging -- --grep "CP-1|CP-2|CP-3"
  ```

**Afternoon (T+4h to T+5h):**

- [ ] Critical path 4–5 + audit trail (sequential, ~30 min)
  ```bash
  npm run test:smoke:staging -- --grep "CP-4|CP-5"
  ```

**End of day (T+5h to T+6h):**

- [ ] Summary report generation
  ```bash
  npm run test:smoke:ci
  ```

### Post-Smoke Test

- [ ] Collect test results XML + markdown report
- [ ] Compare vs. baseline (latencies, error rates)
- [ ] Check Cloud Logs for unexpected warnings
- [ ] Archive results for audit trail
- [ ] Notify Phase 14 lead of results

---

## Failure Criteria

**ABORT Phase 14 if:**

- Any module's create/read fails (cannot be deferred)
- Any critical path <50% pass rate (e.g., laudo creation 50% timeout)
- P99 latency >2.5s for any module (perf regression)
- Audit trail missing for any regulatory operation
- Cross-tenant data leakage detected (critical security bug)

**Allowed to proceed with mitigation:**

- Non-critical module failure (e.g., chart rendering) → defer to v1.5
- <1% error rate on low-impact flow (e.g., optional email) → add retry logic
- Latency spike on 1 function → optimize + test again

---

## Smoke Test Template (TypeScript)

```typescript
// test/smoke/modules/analyzer.smoke.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { testAnalyzerCreate, testAnalyzerRead, testAnalyzerDelete } from '../../fixtures/analyzerHelpers';

describe('Module: Analyzer', () => {
  let db: any;

  beforeAll(() => {
    const app = initializeApp({ projectId: 'staging' });
    db = getFirestore(app);
    connectFirestoreEmulator(db, 'localhost', 8080);
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('CRUD Operations', () => {
    it('should create analyzer run', async () => {
      const result = await testAnalyzerCreate(db, {
        labId: 'test-lab-1',
        equipmentId: 'eq-1',
        sampleId: 'sample-1',
        materialType: 'sangue-total',
      });
      expect(result.runId).toBeDefined();
      expect(result.status).toBe('processing');
    });

    it('should read analyzer run', async () => {
      const run = await testAnalyzerRead(db, 'test-lab-1', 'run-123');
      expect(run.equipmentId).toBe('eq-1');
      expect(run.results).toBeDefined();
    });

    it('should soft-delete analyzer run', async () => {
      await testAnalyzerDelete(db, 'test-lab-1', 'run-456');
      const run = await testAnalyzerRead(db, 'test-lab-1', 'run-456');
      expect(run.deletadoEm).toBeDefined();
    });

    it('should record audit trail', async () => {
      // Verify audit entries created for all 3 operations above
      const auditEntries = await fetchAuditTrail(db, 'test-lab-1', 'analyzer');
      expect(auditEntries.length).toBeGreaterThanOrEqual(3);
      expect(auditEntries[0].assinatura).toBeDefined();
      expect(auditEntries[0].assinatura.hash.length).toBe(64);
    });
  });

  describe('Performance', () => {
    it('should respond in <2s p99', async () => {
      const times: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        await testAnalyzerRead(db, 'test-lab-1', `run-${i}`);
        times.push(performance.now() - start);
      }
      const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];
      expect(p99).toBeLessThan(2000);
    });
  });
});
```

---

## Approval & Sign-Off

**Smoke Test Lead:** _________________ Date: _________

**QA Lead:** _________________ Date: _________

**CTO:** _________________ Date: _________

Once all 125 test cases pass, Phase 14 can advance to Load Testing.
