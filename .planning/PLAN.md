# Phase 1 PLAN — ADR 0005: Helper cryptoAudit

**Phase:** 1 / ADR 0005  
**Duration:** Weeks 1-2 (~6-8 days)  
**Status:** `ready-to-execute`  
**Owner:** Engineer (implementation), CTO (reviews/approvals)

---

## Executive Summary

ADR 0005 centraliza HMAC-SHA256 + chain-hash audit em um único helper, eliminando duplicação entre `chainHash.ts` (insumos) e `ciqAudit/writer.ts`. Resolve **V-009** + abre caminho pra ADRs 0002-0003.

**Success:** Helper criado, testado >90%, zero HMAC divergência entre módulos.

---

## Critical Path (Days 1-8)

```
Day 1:    ADR 0005 design doc + approval
Day 2:    Setup cloud function + env secrets
Days 3-4: Helper implementation + unit tests
Day 5:    Chain validator + scheduled CF
Day 6:    Backfill legados + integration tests
Day 7:    Smoke test + security audit
Day 8:    Deploy + monitoring
```

---

## Task Breakdown

### Phase 1.1: Design & Approval (Day 1)

**Task 1.1.1 — ADR 0005 Design Document**

**Objective:** Formalize spec, get CTO sign-off before coding.

**Deliverables:**
- ADR 0005 doc in `docs/adr/0005-helper-cryptoaudit.md`
- Includes:
  - Problem statement (V-009 duplication)
  - Solution (crypto helper + chain-hash)
  - HMAC-SHA256 spec (deterministic JSON, key management, output format)
  - Cloud Function signature
  - Migration strategy (legacy data)
  - Rollback plan

**Acceptance:**
- [ ] ADR draft complete
- [ ] CTO review + ack
- [ ] No open questions on implementation

**Owner:** Engineer (draft) + CTO (review)  
**Duration:** 4-6 hours

---

### Phase 1.2: Setup (Day 2)

**Task 1.2.1 — Firebase Secrets Manager Setup**

**Objective:** Configure `HCQ_SIGNATURE_HMAC_KEY` in Firebase.

**Details:**
- Key size: 32 bytes (256-bit) for SHA-256
- Generate: `openssl rand -hex 32`
- Store in: `firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --data "<value>"`
- Verify: `firebase functions:secrets:access HCQ_SIGNATURE_HMAC_KEY` (returns `[object Object]`)

**Acceptance:**
- [ ] Secret set in Firebase
- [ ] Accessible in local emulator
- [ ] CI/CD has secret available (GitHub Actions / Cloud Build)

**Owner:** Engineer + CTO (approval for `functions:secrets:set`)  
**Duration:** 1-2 hours

**Task 1.2.2 — Cloud Function Structure**

**Objective:** Create directory + boilerplate for crypto helper.

**Files:**
```
functions/src/modules/audit/
├── cryptoAudit.ts              (helper: sign, verify, chain operations)
├── chainHashValidator.ts       (validator: check integrity + scheduled job)
├── cryptoAudit.test.ts         (unit tests)
└── types.ts                    (AuditEntry, ChainEntry, etc)
```

**Boilerplate:**
- Import crypto, admin, functions
- Environment: `process.env.HCQ_SIGNATURE_HMAC_KEY`
- Logger: structured logs with HMAC validation results

**Acceptance:**
- [ ] Directory created
- [ ] Imports working
- [ ] Tests runnable (empty suite OK)

**Owner:** Engineer  
**Duration:** 1 hour

---

### Phase 1.3: Implementation (Days 3-4)

**Task 1.3.1 — cryptoAudit Helper**

**Objective:** Core HMAC + chain-hash logic.

**Function signatures:**
```typescript
// 1. Sign an audit entry
export async function signAuditEntry(
  collectionPath: string,      // '/ciq-audit' or '/labs/{labId}/audit-log'
  docRef: FirebaseFirestore.DocumentReference,
  operadorId: string,
  operation: string,           // 'insumo.recebido', 'laudo.liberado', etc
  payload: Record<string, any>
): Promise<AuditEntry>

// 2. Verify existing entry
export function verifyAuditEntry(
  entry: AuditEntry,
  secret: string
): boolean

// 3. Get previous hash (for chain)
export async function getPreviousHash(
  collectionPath: string,
  orderedBy: 'createdAt' | 'timestamp'
): Promise<string | null>

// 4. Compute HMAC (standalone, for migration)
export function computeHmac(
  data: Record<string, any>,
  secret: string
): string

// 5. Compute SHA-256 hash (deterministic)
export function hashData(
  data: Record<string, any>
): string
```

**Implementation details:**
- JSON deterministic: `JSON.stringify(data, Object.keys(data).sort())`
- HMAC output: hex format
- Hash output: hex format
- Timestamp: must be `serverTimestamp()` (never client time)
- previousHash: queried from Firestore (last entry), not computed

**Unit tests:**
```typescript
describe('cryptoAudit', () => {
  it('signAuditEntry creates valid HMAC', async () => { ... })
  it('verifyAuditEntry passes on valid entry', () => { ... })
  it('verifyAuditEntry fails if HMAC modified', () => { ... })
  it('verifyAuditEntry fails if payload mutated', () => { ... })
  it('getPreviousHash returns last entry hash', async () => { ... })
  it('computeHmac deterministic across calls', () => { ... })
})
```

**Acceptance:**
- [ ] All functions implement per spec
- [ ] Unit tests >90% coverage
- [ ] Tests pass in emulator
- [ ] No console.log (use structured logging)

**Owner:** Engineer  
**Duration:** 2-3 days

---

**Task 1.3.2 — Refactor Existing Modules**

**Objective:** Make `chainHash.ts` + `ciqAudit/writer.ts` use new helper (don't delete).

**Changes:**
```typescript
// Before: functions/src/modules/insumos/chainHash.ts
export async function recordMovement(...) {
  // duplicated HMAC logic here
}

// After:
import { signAuditEntry } from '../audit/cryptoAudit';

export async function recordMovement(...) {
  const entry = await signAuditEntry(
    '/labs/{labId}/insumo-movimentacoes',
    docRef,
    operadorId,
    'insumo.movimento',
    payload
  );
  // use entry.hmac + entry.hash
}
```

**Similarly for `ciqAudit/writer.ts`:**
```typescript
import { signAuditEntry } from './cryptoAudit';

export async function writeAuditLog(...) {
  const entry = await signAuditEntry(
    '/ciq-audit',
    docRef,
    operadorId,
    operation,
    payload
  );
  // use entry
}
```

**Acceptance:**
- [ ] Both modules refactored
- [ ] Integration tests pass
- [ ] No behavior change (audit output identical)

**Owner:** Engineer  
**Duration:** 1 day

---

### Phase 1.4: Chain Validation (Day 5)

**Task 1.4.1 — Chain Integrity Validator**

**Objective:** Scheduled Cloud Function to verify chain-hash unbroken.

**Signature:**
```typescript
export async function validateChainIntegrity(
  collectionPath: string,
  options?: { maxAge?: number; batchSize?: number }
): Promise<{
  valid: boolean;
  violations: Array<{
    docId: string;
    reason: 'hmac-mismatch' | 'hash-sequence-broken' | 'missing-hash';
    expectedHash: string;
    actualHash: string;
  }>;
  stats: { scanned: number; valid: number; invalid: number; duration: number };
}>
```

**Logic:**
1. Query all entries, sorted by timestamp ascending
2. For each entry:
   - Recompute HMAC(entry.payload) + secret
   - Compare to entry.hmac (must match)
   - Verify entry.previousHash == prev_entry.hash
3. Return violations list

**Scheduled deployment:**
```typescript
export const validateChainIntegrityScheduled = functions
  .region('southamerica-east1')
  .pubsub.schedule('every 12 hours')
  .onRun(async context => {
    const result = await validateChainIntegrity('/ciq-audit');
    if (!result.valid) {
      console.error('Chain broken:', result.violations);
      // Open NC automatically? (depends on ADR 0003)
    }
    return result;
  });
```

**Acceptance:**
- [ ] Validator queries Firestore correctly
- [ ] Recomputes HMAC matching signAuditEntry
- [ ] Scheduled function deploys
- [ ] Runs daily without timeout (should be <1min for 10k entries)

**Owner:** Engineer  
**Duration:** 1 day

---

### Phase 1.5: Migration (Day 6)

**Task 1.5.1 — Backfill Legacy Data**

**Objective:** Migrate existing chain-hash entries to new HMAC format.

**Strategy:**
1. Export `/insumo-movimentacoes` (current live chain-hash)
2. For each doc:
   - If already has `hmac` + `hash`: skip (already new format)
   - If has only `hash`: compute `hmac` via `cryptoAudit.computeHmac(payload)`
   - Write back: `hmac`, `_migratedAt: serverTimestamp()`
3. Validate chain post-migration

**Script:**
```typescript
// functions/scripts/backfill-hmac.mjs
async function backfillHmac() {
  const docs = await db.collection('labs').doc(labId)
    .collection('insumo-movimentacoes')
    .orderBy('timestamp')
    .get();

  for (const doc of docs.docs) {
    if (!doc.data().hmac) {
      const hmac = computeHmac(doc.data().payload, secret);
      await doc.ref.update({ hmac, _migratedAt: serverTimestamp() });
    }
  }
}
```

**Acceptance:**
- [ ] Script runs without errors
- [ ] 100% docs processed
- [ ] Chain validation passes post-migration
- [ ] Audit log recorded (backup before/after)

**Owner:** Engineer + Data team (verification)  
**Duration:** 1 day

---

### Phase 1.6: Security & Testing (Day 7)

**Task 1.6.1 — Smoke Test Suite**

**Objective:** End-to-end validation.

**Tests:**
1. **Unit:** All cryptoAudit functions (already in 1.3.1)
2. **Integration:**
   - Create audit entry → verify HMAC valid
   - Tamper with entry → verify HMAC invalid
   - Chain 10 entries → validate chain unbroken
   - Validate chain with 1 broken link → validator catches it
3. **E2E:**
   - Insumo-movimentacao recorded → HMAC in Firestore
   - CIQ-audit entry created → HMAC in Firestore
   - Scheduled validator runs → 0 violations

**Test environment:**
- Firebase emulator (local)
- Test data: 50 docs per collection
- Runs in <2min

**Acceptance:**
- [ ] All tests pass
- [ ] Coverage >90%
- [ ] No timeouts

**Owner:** Engineer + QA  
**Duration:** 4-6 hours

**Task 1.6.2 — Security Audit**

**Objective:** Review for crypto/secret mgmt risks.

**Checklist:**
- [ ] Secret never logged (grep `-v HCQ_SIGNATURE_HMAC_KEY`)
- [ ] HMAC-SHA256 is NIST approved
- [ ] previousHash prevents replay attacks
- [ ] Timestamp validation prevents stale entries
- [ ] Cloud Function requires authentication (not public)
- [ ] Firestore rules block direct writes (CF mediation enforced)

**Acceptance:**
- [ ] Security review completed
- [ ] No critical findings
- [ ] CTO sign-off

**Owner:** Security reviewer + CTO  
**Duration:** 2-3 hours

---

### Phase 1.7: Deploy & Monitoring (Day 8)

**Task 1.7.1 — Deploy to Production**

**Steps:**
1. Merge ADR 0005 branch (code review + CTO approval)
2. `firebase deploy --only functions:signAuditEntry,functions:validateChainIntegrityScheduled,firestore:rules`
3. Verify in prod:
   - Create test audit entry
   - Validate HMAC present
   - Scheduled function runs (check logs)
4. Monitor errors (Firestore, Cloud Functions logs)

**Acceptance:**
- [ ] Deploy successful
- [ ] No function errors
- [ ] Scheduled validator ran 1x successfully

**Owner:** Engineer + DevOps + CTO (approval)  
**Duration:** 2-3 hours

**Task 1.7.2 — Monitoring & Alerting**

**Objective:** Catch chain-hash failures early.

**Alerts:**
- If `validateChainIntegrity` returns violations → Slack alert
- If any HMAC recomputation fails → error log + alert
- If secret access fails → error log + lock function

**Dashboards (Firestore Analytics):**
- Audit entries created per day
- HMAC validation pass rate
- Chain integrity status

**Acceptance:**
- [ ] Alerts configured
- [ ] Dashboard visible
- [ ] CTO can monitor

**Owner:** DevOps + SRE  
**Duration:** 2-3 hours

---

## Critical Decisions

| Decision | Rationale |
|----------|-----------|
| HMAC-SHA256 | NIST approved, deterministic, no decryption needed |
| Chain-hash (not tree) | Linear for audit log, simpler validation, RDC 978 compatible |
| Scheduled validator 12h | Catch breaks early; <1min overhead; configurable frequency |
| Backfill with `_migratedAt` | Track which entries are "old format" vs "new"; audit trail |
| Cloud Function mediation | Firestore rules can't validate HMAC natively; CF is enforcement point |

---

## Risks & Mitigations

| Risk | Sev | Mitigation |
|------|-----|-----------|
| Secret key leak | 🔴 | Never log; use Firebase Secrets; rotate quarterly |
| HMAC divergence (old vs new) | 🟠 | Backfill validates 100%; scheduled validator catches divergence |
| Performance: validate 10k entries | 🟠 | Parallel batch validation; runs in ~3-5s; scheduled (not blocking) |
| Rollback breaks chain | 🔴 | Keep old code path 1 week; dual-read logic if needed; have backup |
| Previous hash not found (first entry) | 🟡 | previousHash = null OK; validator handles null case |

---

## Acceptance Criteria

**Phase 1 ADR 0005 Complete when:**

- [x] ADR 0005 written + CTO approved
- [x] Helper `cryptoAudit.ts` deployed
- [x] Chain validator deployed
- [x] Unit tests >90% coverage + passing
- [x] Integration tests passing (emulator)
- [x] Backfill completed 100%
- [x] Smoke tests passing
- [x] Security audit passed
- [x] Production deployment successful
- [x] Scheduled validator ran 1x without errors
- [x] Firestore rules enforcing HMAC requirement

---

## Next Phase Gate

**ADR 0005 ships → ADRs 0002 + 0006 can start (parallel)**

```
/gsd-execute-phase  ← starts Day 1 implementation
```

---

## References

- **ADR 0005:** `docs/adr/0005-helper-cryptoaudit.md` (to create)
- **REQUIREMENTS.md:** `.planning/REQUIREMENTS.md`
- **Research:** HMAC-SHA256, Firebase Secrets, Firestore rules
- **Violation:** `docs/backlog/spine-violations.md` (V-009)

---

**Status:** `ready-to-execute`  
**Next:** `/gsd-execute-phase` to begin Day 1 (design + CTO approval)
