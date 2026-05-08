# Wave 4 Agent 11 — Pre-Deployment Checklist

**Date:** 2026-05-08  
**Target:** Firestore Rules Consolidation & Phased Deployment  
**Scope:** ADR-0003 (NC), ADR-0004 (POP), ADR-0005 (HMAC), ADR-0007 (Equipment)

---

## Pre-Deployment Gate

### ✅ Rule Consolidation

- [ ] `firestore.rules` contains all ADR patches (merged, no conflicts)
- [ ] ADR-0003 (nao-conformidades) block present and syntactically valid
- [ ] ADR-0004 (pops + versoes + treinamentos) block present and syntactically valid
- [ ] ADR-0007 (equipamentos refinement) rules integrated
- [ ] All helper functions in scope: `isActiveMemberOfLab()`, `isAdminOrOwner()`, `hasActiveSupervisor()`, etc.
- [ ] No duplicate rule matches (verified via `grep`)
- [ ] HMAC validation: 64-char hex requirement present in all create/update rules
- [ ] File syntax valid: `firebase deploy --only firestore:rules --dry-run --project hmatologia2`

**Status:** _____ (Pass/Fail)  
**Verified By:** __________ **Date:** __________

---

### ✅ Unit Test Coverage

- [ ] Test file created: `functions/src/shared/__tests__/firestore-rules.test.ts`
- [ ] 16 tests implemented and all passing:
  - [ ] 4 tests for RT read gate
  - [ ] 4 tests for RT write gate + supervisor
  - [ ] 3 tests for audit immutability
  - [ ] 3 tests for PII redaction
  - [ ] 2 tests for soft-delete enforcement
- [ ] Test execution: `npm run test -- firestore-rules.test.ts` produces `16 passed`
- [ ] No test regressions in existing suite (347+ tests still passing)
- [ ] Coverage >80% for new rules paths

**Status:** _____ (Pass/Fail)  
**Test Results:** 16/16 ✓  
**Verified By:** __________ **Date:** __________

---

### ✅ Supervisor Status Bootstrap

- [ ] Migration script executed: `scripts/preflight-supervisor-bootstrap.sh`
- [ ] All labs have `/labs/{labId}/supervisor-status/current` doc created
- [ ] `hasActiveSupervisor` cache populated for all active labs
- [ ] Cross-check: Query on 3 random labs confirms `supervisor-status/current` exists
- [ ] Lab list count matches expectation (e.g., 15+ labs bootstrapped)

**Status:** _____ (Pass/Fail)  
**Labs Bootstrapped:** ________ (count)  
**Verified By:** __________ **Date:** __________

---

### ✅ Staging Deployment

- [ ] Dry-run succeeds on staging project: `firebase deploy --only firestore:rules --dry-run --project hcquality-staging`
- [ ] Rules deploy to staging: `firebase deploy --only firestore:rules --project hcquality-staging`
- [ ] Post-deploy verification: Rules visible in staging Firebase Console
- [ ] Rules version matches expected date (2026-05-08 or later)

**Status:** _____ (Pass/Fail)  
**Staging Deployment Time:** __________  
**Verified By:** __________ **Date:** __________

---

### ✅ Staging Smoke Tests (24h monitoring)

#### CIQ Run Creation (5 samples)
- [ ] Test 1: Hematologia CIQ run create with supervisor → **PASS**
- [ ] Test 2: Imunologia CIQ run create with supervisor → **PASS**
- [ ] Test 3: Uroanalise CIQ run create with supervisor → **PASS**
- [ ] Test 4: CIQ run create WITHOUT supervisor → **BLOCKED** (expected)
- [ ] Test 5: CIQ run create by non-RT → **BLOCKED** (expected)

#### NOTIVISA Submission (3 samples)
- [ ] Test 1: NOTIVISA draft create by RT → **PASS**
- [ ] Test 2: NOTIVISA submit (callable) → **PASS**
- [ ] Test 3: NOTIVISA queue status update → **PASS**

#### Export (1 sample)
- [ ] Test 1: Generate & export CQI report → **PASS**

#### Audit Trail
- [ ] No rules-related errors in Cloud Logs (grep for "permission-denied" from firestore.rules)
- [ ] NC reads/writes by RT + supervisors: no blocks
- [ ] POP creation by admin, signature by RT: no blocks
- [ ] 24h monitoring window: no degradation

**Status:** _____ (All Pass / Failures)  
**Smoke Test Window:** 2026-05-08 to 2026-05-09 (24h)  
**Failures (if any):** ____________________  
**Verified By:** __________ **Date:** __________

---

### ✅ Production Dry-Run

- [ ] Dry-run succeeds on production: `firebase deploy --only firestore:rules --dry-run --project hmatologia2`
- [ ] Output shows: "✔ firestore:rules: Rules uploaded successfully (no changes deployed)"
- [ ] No validation errors or warnings

**Status:** _____ (Pass/Fail)  
**Dry-run Output:** [Paste output or attach screenshot]  
**Verified By:** __________ **Date:** __________

---

### ✅ Existing Test Suite Regression Check

- [ ] All 347+ existing tests still pass: `npm run test`
- [ ] No new build errors: `npm run build` succeeds
- [ ] TypeScript clean: `npm run tsc --noEmit` (0 errors)
- [ ] Bundle size check: no significant increase from rule changes (rules are deployed separately)

**Test Results:** _____ / 347 pass  
**Build Status:** ✓ Clean  
**TypeScript Errors:** 0  
**Verified By:** __________ **Date:** __________

---

### ✅ Rules File Integrity

- [ ] No merge conflicts in `firestore.rules` (no `<<<<<<<`, `=======`, `>>>>>>>` markers)
- [ ] File line count reasonable: >2000 lines (all ADRs merged)
- [ ] No syntax errors from sed/merge: no dangling braces or mismatched quotes
- [ ] Git diff shows only intentional additions (ADR-0003, ADR-0004 blocks)

**Status:** _____ (Pass/Fail)  
**File Line Count:** ________ (expected ~2150+)  
**Git Diff Review:** ✓ Approved  
**Verified By:** __________ **Date:** __________

---

### ✅ Stakeholder Sign-Off

- [ ] Architecture review: Rules consolidation complete and correct ✓ / ✗
- [ ] Security review: All gates in place (RT, supervisor, HMAC) ✓ / ✗
- [ ] Compliance review: RDC 978 Art. 122 enforced via `hasActiveSupervisor` ✓ / ✗
- [ ] Operations review: Smoke tests passed, no ongoing incidents ✓ / ✗

**Architecture Sign-Off:**  
Name: __________ Title: __________ Date: __________

**Security Sign-Off:**  
Name: __________ Title: __________ Date: __________

**Compliance Sign-Off:**  
Name: __________ Title: __________ Date: __________

**Operations Sign-Off:**  
Name: __________ Title: __________ Date: __________

---

## Deployment Gate: PROCEED / HOLD

**Overall Status:** ⬜ PROCEED / ⬜ HOLD / ⬜ ROLLBACK

**Reason (if HOLD or ROLLBACK):**
```
_________________________________________________________________
_________________________________________________________________
```

**Gate Authorized By:**  
Name: __________ Title: __________ Date: __________

---

## Post-Deployment Verification (within 24h of prod deploy)

### Rules Deployed to Production
- [ ] Rules deployed to hmatologia2: `firebase deploy --only firestore:rules --project hmatologia2`
- [ ] Deployment timestamp verified in Firebase Console
- [ ] No errors reported during deploy

**Deployment Time:** __________  
**Deployment Status:** ✓ Success  
**Verified By:** __________ **Date:** __________

---

### Production Smoke Tests (24h monitoring)

#### CIQ Run Creation
- [ ] 5 CIQ run creates with supervisor: all **PASS**
- [ ] 1 CIQ run create without supervisor: **BLOCKED** (expected)
- [ ] Cloud Logs show 0 unexpected permission-denied errors

#### NOTIVISA Submission
- [ ] 3 NOTIVISA submissions: all **PASS**
- [ ] No queue backlog

#### Export
- [ ] 1 export cycle: **PASS**

#### Audit
- [ ] Cloud Logs: no firestore.rules errors
- [ ] Error rate pre/post deploy: no degradation
- [ ] Latency p95 pre/post deploy: no degradation >5%

**Status:** _____ (All Green / Issues Found)  
**Issues (if any):** ____________________  
**Verified By:** __________ **Date:** __________

---

## Rollback Plan (if needed)

**Rollback Trigger:**
- [ ] Smoke tests failing (>1% error rate)
- [ ] Permission-denied errors in critical flows
- [ ] Unexpected rules blocking legitimate operations
- [ ] Cloud Logs showing recurring errors

**Rollback Procedure:**
```bash
# 1. Identify last-known-good commit
git log --oneline | head -5

# 2. Revert rules file
git checkout <prior-commit> -- firestore.rules

# 3. Deploy prior version
firebase deploy --only firestore:rules --project hmatologia2

# 4. Verify
firebase deploy --only firestore:rules --dry-run --project hmatologia2
```

**Rollback Executed:** ⬜ Yes / ⬜ No  
**Reason:** ____________________  
**Rollback Time:** __________  
**Verified By:** __________ **Date:** __________

---

## Sign-Off

**Consolidation & Testing Complete:** ✓ __________  
**Staging Validation Complete:** ✓ __________  
**Production Deployment Complete:** ✓ __________  
**24h Post-Deployment Monitoring Complete:** ✓ __________  

**Final Authorization:**  
Name: __________ Title: __________ Date: __________

---

## Appendix: Test Evidence

### Firestore Rules Test Output
```
[Paste output of: npm run test -- firestore-rules.test.ts]
```

### Staging Deployment Output
```
[Paste output of: firebase deploy --only firestore:rules --project hcquality-staging]
```

### Production Dry-Run Output
```
[Paste output of: firebase deploy --only firestore:rules --dry-run --project hmatologia2]
```

### Cloud Logs Sample (Production)
```
[Paste 20-30 lines from Cloud Logs showing successful operations post-deploy]
```

---

**End of Checklist**

