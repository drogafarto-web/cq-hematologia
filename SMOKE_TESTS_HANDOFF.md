---
title: v1.3 Smoke Tests — Handoff to Executor
version: 1.0
date: 2026-05-07
scope: Step 4.0 Complete — Handoff to Step 4.1 (Test Execution)
---

# v1.3 Smoke Tests — Handoff to Executor

**Status:** Test data preparation COMPLETE. Ready for smoke test execution.

**Completion Date:** 2026-05-07

**Next Action:** Begin Phase 1 (Pre-Execution, 15 min) immediately.

---

## What Was Delivered

### Documents Created

1. **SMOKE_TESTS_TEST_DATA_VERIFICATION.md** — Comprehensive guide
   - Lab verification (Riopomba setup)
   - Bioquímica test data (analitos, equipment, bula PDF)
   - SGD/Drive test data (folder, 5 documents)
   - Cloud infrastructure verification
   - Troubleshooting guide

2. **TEST_DATA_QUICK_START.md** — 5-10 min checklist
   - Copy-paste friendly steps
   - Quick troubleshooting table
   - Ideal for rapid setup

3. **SMOKE_TESTS_EXECUTION_GATE.md** — Full test execution guide
   - Pre-execution readiness (15 min)
   - Test execution steps (80 min)
   - Post-test verification (10 min)
   - Go/No-Go decision form
   - Sign-off authorization

4. **SMOKE_TESTS_DOCUMENTATION_INDEX.md** — Navigation hub
   - Quick links to all docs
   - Execution workflow
   - Troubleshooting quick reference
   - Timeline and contacts

5. **v1.3-DEPLOYMENT_LOG.md** (updated)
   - Step 4.0 marked COMPLETE
   - All deliverables documented

### Documentation Summary

- **Total:** 5 documents (4 new, 1 updated)
- **Lines:** ~2,500 lines of detailed guidance
- **Coverage:** All 3 smoke test scenarios + regression testing
- **Quality:** Step-by-step procedures with pass/fail criteria

---

## Quick Start (5 Minutes)

### Do This Now

1. **Open:** `docs/TEST_DATA_QUICK_START.md`
2. **Follow:** 10-step checklist (5-10 minutes total)
3. **Verify:** `docs/POST_DEPLOY_CHECKLIST_v1.3.md` (5 minutes)
4. **Proceed:** `docs/SMOKE_TESTS_EXECUTION_GATE.md` (when ready)

### What You'll Set Up

- Riopomba lab config + member document
- 17 bioquímica analitos (seeded)
- Test equipment
- Google Drive folder + 5 test documents
- Test bula PDF (local file)
- Infrastructure verification (Firestore, Functions, etc.)

---

## Timeline

| Phase                           | Duration     | Owner       |
| ------------------------------- | ------------ | ----------- |
| Phase 1: Pre-Execution          | 15 min       | QA Engineer |
| Phase 2: Test Execution         | 80 min       | QA Engineer |
| Phase 3: Post-Test Verification | 10 min       | DevOps      |
| Phase 4: Sign-Off               | 5 min        | QA Lead     |
| **Total**                       | **~110 min** | —           |

**Plus:** 24 hours of operational monitoring (Phase 9)

---

## Key Files Reference

**For Setup:**

- `TEST_DATA_QUICK_START.md` (start here)
- `SMOKE_TESTS_TEST_DATA_VERIFICATION.md` (detailed reference)

**For Execution:**

- `SMOKE_TESTS_EXECUTION_GATE.md` (during tests)
- `SMOKE_TESTS_v1.3.md` (detailed procedures)

**For Navigation:**

- `SMOKE_TESTS_DOCUMENTATION_INDEX.md` (finding what you need)

**For Infrastructure Verify:**

- `POST_DEPLOY_CHECKLIST_v1.3.md` (existing doc)

---

## What's Been Documented

### Test Scenarios

✓ **Smoke Test 1: Bioquímica E2E** (10 min)

- 7 detailed steps with expected outcomes
- Gemini bula parsing integration
- Westgard acceptance rules
- Levey-Jennings chart rendering
- ChainHash signature verification

✓ **Smoke Test 2: SGD Drive Importer** (12 min)

- OAuth flow (Google consent screen)
- Drive folder listing
- Document preview
- Batch import (5 documents)
- Document status transitions + search

✓ **Smoke Test 3: Reclamação (optional)** (8 min)

- Public form submission
- State machine transitions
- NPS trigger verification

✓ **Smoke Test 4: Liberação (optional)** (5 min)

- Laudo creation and state transitions
- Signature gate validation

✓ **Smoke Test 5: Regression** (10 min)

- Spot-check 5 existing modules
- No 404 errors, no console JS errors

### Test Data Preparation

✓ Riopomba lab setup (config, settings, member doc)
✓ Bioquímica module (17 analitos, equipment, bula PDF)
✓ SGD/Drive module (folder, 5 documents)
✓ Cloud infrastructure verification (rules, functions, indexes)
✓ Test account provisioning (Firebase Auth + member doc)

### Pass/Fail Criteria

✓ Clear success criteria for each test step
✓ Go/No-Go decision matrix
✓ Escalation path for failures
✓ Post-test verification procedures

---

## When You're Ready to Execute

### Step 1: Prepare (15 min)

```
1. Open: TEST_DATA_QUICK_START.md
2. Execute: 10-step checklist
3. Result: Riopomba lab ready, test data prepared
```

### Step 2: Execute Tests (80 min)

```
1. Open: SMOKE_TESTS_EXECUTION_GATE.md
2. Follow: Phase 2 (Test Execution)
3. Reference: SMOKE_TESTS_v1.3.md for detailed steps
4. Monitor: Cloud Logs continuously
5. Document: Results in execution gate form
```

### Step 3: Verify & Sign-Off (15 min)

```
1. Review: Cloud Logs (per execution gate)
2. Check: Data integrity
3. Complete: Go/No-Go decision form
4. Obtain: Authorization signatures
5. Archive: Sign-off form for audit trail
```

---

## Success Criteria

### All 3 Core Tests Must Pass

- ✅ Smoke Test 1 (Bioquímica): All 7 steps pass
- ✅ Smoke Test 2 (SGD): All 7 steps pass
- ✅ Smoke Test 5 (Regression): All modules accessible

### Infrastructure Must Be Healthy

- ✅ Cloud Logs: No new ERROR/CRITICAL errors post-deploy
- ✅ Data Integrity: ChainHash valid, no missing fields
- ✅ Performance: Page loads <2.5s, interactions <200ms

### If All Succeed

→ **GO decision** → Begin Phase 9 (24h operational monitoring)

### If Any Core Test Fails

→ **NO-GO decision** → Initiate rollback procedure

---

## Escalation Contacts

| Issue                | Contact          | Severity    |
| -------------------- | ---------------- | ----------- |
| ChainHash broken     | CTO + Auditor    | 🔴 CRITICAL |
| Rules lockout        | Rules Audit Team | 🔴 CRITICAL |
| Function 5xx         | Functions Team   | 🔴 CRITICAL |
| UI broken            | Frontend Team    | 🟠 HIGH     |
| Performance degraded | Perf Team        | 🟠 HIGH     |
| Transient errors     | DevOps (monitor) | 🟡 MEDIUM   |

---

## Files You'll Need

All located in: `C:\hc quality\docs\`

```
SMOKE_TESTS_TEST_DATA_VERIFICATION.md    ← Detailed setup guide
TEST_DATA_QUICK_START.md                 ← Start here (5 min)
SMOKE_TESTS_EXECUTION_GATE.md            ← During tests (2 hours)
SMOKE_TESTS_v1.3.md                      ← Reference procedures
SMOKE_TESTS_DOCUMENTATION_INDEX.md       ← Finding what you need
POST_DEPLOY_CHECKLIST_v1.3.md            ← Infrastructure verify
SMOKE_TESTS_QUICK_CHECKLIST_v1.3.md      ← Quick reference (2 pg)
COMPLIANCE_SUMMARY_v1.3.md               ← Post-test sign-off
SECURITY_SIGN_OFF_v1.3.md                ← Security validation
```

---

## Summary

**Step 4.0: Test Data Preparation** ✅ COMPLETE

All prerequisites documented and ready. Executor can proceed immediately to Phase 1 (Pre-Execution, 15 minutes).

**Estimated Total Time:**

- Setup: 15 minutes
- Smoke tests: 80 minutes
- Verification: 10 minutes
- Sign-off: 5 minutes
- **Total: ~2 hours**

**Plus:** 24 hours of Phase 9 operational monitoring.

---

## Next: Start Phase 1

**→ Open:** `docs/TEST_DATA_QUICK_START.md`

**→ Follow:** 10-step checklist

**→ Result:** Riopomba lab ready for smoke tests

---

**Good luck!** 🚀

For any questions, see `SMOKE_TESTS_DOCUMENTATION_INDEX.md` for troubleshooting links.

---

**Handoff Date:** 2026-05-07  
**Status:** READY FOR EXECUTION  
**Next Step:** Phase 1 (Pre-Execution)
