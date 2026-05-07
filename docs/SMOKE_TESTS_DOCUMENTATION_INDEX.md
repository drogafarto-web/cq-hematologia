---
title: Smoke Tests Documentation Index — v1.3
version: 1.0
date: 2026-05-07
scope: Complete reference for Step 4 (Smoke Tests) of v1.3 Deployment Roadmap
---

# Smoke Tests Documentation Index — v1.3

**Purpose:** Central reference for all documents and resources related to v1.3 post-deployment smoke testing (Step 4).

**Status:** Complete and ready for execution.

---

## Quick Navigation

### For Test Execution (Start Here)

1. **[TEST_DATA_QUICK_START.md](TEST_DATA_QUICK_START.md)** (5–10 min)
   - Quick checklist to prepare Riopomba lab
   - Copy-paste friendly steps
   - **Start here if data prep needed**

2. **[SMOKE_TESTS_EXECUTION_GATE.md](SMOKE_TESTS_EXECUTION_GATE.md)** (2 hours total)
   - Pre-execution readiness verification
   - Step-by-step smoke test execution guide
   - Go/No-Go decision criteria
   - Final sign-off form
   - **Use this during test execution**

3. **[SMOKE_TESTS_v1.3.md](SMOKE_TESTS_v1.3.md)** (45 min + 24h ops)
   - Detailed 5 smoke test scenarios
   - Step-by-step actions and expected outcomes
   - Troubleshooting guide per test
   - Known issues and workarounds
   - **Reference during each smoke test**

### For Test Data Preparation

4. **[SMOKE_TESTS_TEST_DATA_VERIFICATION.md](SMOKE_TESTS_TEST_DATA_VERIFICATION.md)** (comprehensive)
   - Complete test data requirements
   - Riopomba lab verification steps
   - Bioquímica test data setup (analitos, equipment, bula PDF)
   - SGD/Drive test data setup (folder, documents)
   - Lab configuration checklist
   - Test account provisioning
   - Cloud function dependency verification
   - Firestore readiness checks
   - Troubleshooting guide
   - **Reference for any data prep questions**

5. **[SMOKE_TESTS_TEST_DATA_GUIDE.md](SMOKE_TESTS_TEST_DATA_GUIDE.md)**
   - Test data dependencies and manual steps
   - Account requirements
   - PDF bula generation
   - Drive folder setup
   - Cloud function configuration
   - Environment variables

### For Infrastructure Verification

6. **[POST_DEPLOY_CHECKLIST_v1.3.md](POST_DEPLOY_CHECKLIST_v1.3.md)**
   - Firebase Console verification (5 checks)
   - URL + Routing verification (4 routes)
   - PWA + Service Worker verification (2 checks)
   - Cloud Logging verification (3 sub-checks)
   - Firestore data integrity spot-checks (3 samples)
   - Go/No-Go criteria

### For Compliance & Sign-Off

7. **[COMPLIANCE_SUMMARY_v1.3.md](COMPLIANCE_SUMMARY_v1.3.md)**
   - v1.3 compliance achievements
   - DICQ block completion
   - RDC 978 alignment
   - Security audit results
   - Test coverage summary

8. **[SECURITY_SIGN_OFF_v1.3.md](SECURITY_SIGN_OFF_v1.3.md)**
   - Security review results
   - Firestore rules audit
   - OAuth compliance
   - Signature validation (chainHash)
   - Sign-off checklist

### For Continuous Monitoring

9. **[SMOKE_TESTS_QUICK_CHECKLIST_v1.3.md](SMOKE_TESTS_QUICK_CHECKLIST_v1.3.md)**
   - Quick reference checklist (2 pages)
   - Per-smoke-test pass/fail checkboxes
   - Known issues quick reference
   - Escalation contacts

### Deployment Reference

10. **[.planning/milestones/v1.3-DEPLOYMENT_LOG.md](.planning/milestones/v1.3-DEPLOYMENT_LOG.md)**
    - Deployment timeline and status
    - Step completion tracking
    - Rollback plan
    - Compliance summary table

---

## Execution Workflow

### Phase 1: Pre-Execution (15 min)

```
Start here:
  1. Review: SMOKE_TESTS_EXECUTION_GATE.md (Prerequisite 1)
  2. Execute: TEST_DATA_QUICK_START.md
  3. Verify: POST_DEPLOY_CHECKLIST_v1.3.md
  4. Confirm: All checkboxes green
```

### Phase 2: Test Execution (80 min + 24h ops)

```
During tests:
  1. Smoke 1: Follow SMOKE_TESTS_v1.3.md — Smoke Test 1 (10 min)
  2. Smoke 2: Follow SMOKE_TESTS_v1.3.md — Smoke Test 2 (12 min)
  3. Smoke 3: Follow SMOKE_TESTS_v1.3.md — Smoke Test 3 [OPT] (8 min)
  4. Smoke 4: Follow SMOKE_TESTS_v1.3.md — Smoke Test 4 [OPT] (5 min)
  5. Smoke 5: Follow SMOKE_TESTS_v1.3.md — Smoke Test 5 (10 min)
  6. Log results in: SMOKE_TESTS_EXECUTION_GATE.md
```

### Phase 3: Post-Test Verification (10 min)

```
After tests:
  1. Review Cloud Logs (per SMOKE_TESTS_EXECUTION_GATE.md)
  2. Check data integrity (per POST_DEPLOY_CHECKLIST_v1.3.md)
  3. Make Go/No-Go decision (SMOKE_TESTS_EXECUTION_GATE.md bottom)
  4. Sign off
```

### Phase 4: Compliance & Archive (5 min)

```
If GO:
  1. Document results
  2. Notify stakeholders
  3. Begin Phase 9 (24h operational monitoring)
  4. Archive SMOKE_TESTS_EXECUTION_GATE.md sign-off form
```

---

## Test Scenarios Summary

| # | Name | Module | Duration | Status |
|---|------|--------|----------|--------|
| 1 | Bioquímica E2E | `bioquimica` | 10 min | Core (MUST PASS) |
| 2 | SGD Drive Importer | `sgq`, `sgd` | 12 min | Core (MUST PASS) |
| 3 | Reclamação Multi-Channel | `reclamacoes` | 8 min | Optional |
| 4 | Liberação State Machine | `liberacao` | 5 min | Optional |
| 5 | Regression Check | All existing | 10 min | Core (MUST PASS) |

**Core Tests (must all pass for GO):** 1, 2, 5  
**Optional Tests:** 3, 4 (can be skipped if time-constrained)

---

## Key Files at a Glance

### Most Important (Read First)

| File | Purpose | Time to Read |
|------|---------|--------------|
| `TEST_DATA_QUICK_START.md` | Fast setup checklist | 2 min |
| `SMOKE_TESTS_EXECUTION_GATE.md` | Test execution + sign-off | 5 min |
| `SMOKE_TESTS_v1.3.md` | Detailed smoke tests | 10 min (skim) |

### Reference (Lookup as Needed)

| File | Purpose | Time to Read |
|------|---------|--------------|
| `SMOKE_TESTS_TEST_DATA_VERIFICATION.md` | Detailed test data guide | 10 min |
| `POST_DEPLOY_CHECKLIST_v1.3.md` | Infrastructure verification | 5 min |
| `SMOKE_TESTS_QUICK_CHECKLIST_v1.3.md` | Quick reference | 2 min |

### Sign-Off & Compliance (Post-Test)

| File | Purpose | Time to Read |
|------|---------|--------------|
| `COMPLIANCE_SUMMARY_v1.3.md` | Compliance results | 5 min |
| `SECURITY_SIGN_OFF_v1.3.md` | Security audit results | 5 min |

---

## Troubleshooting Quick Links

| Issue | Solution Location |
|-------|-------------------|
| Analitos not seeding | `SMOKE_TESTS_TEST_DATA_VERIFICATION.md` → Troubleshooting → "Analitos Not Appearing" |
| Drive folder empty | `SMOKE_TESTS_TEST_DATA_VERIFICATION.md` → Troubleshooting → "Drive Folder Returns 0 Documents" |
| Gemini timeout | `SMOKE_TESTS_TEST_DATA_VERIFICATION.md` → Troubleshooting → "Gemini API Timeout" |
| Permission denied | `SMOKE_TESTS_TEST_DATA_VERIFICATION.md` → Troubleshooting → "Firestore Rules Reject Reads" |
| Service Worker stale | `SMOKE_TESTS_TEST_DATA_VERIFICATION.md` → Troubleshooting → "Service Worker Not Updated" |
| Test failing in Smoke 1 | `SMOKE_TESTS_v1.3.md` → Smoke Test 1 → Troubleshooting section |
| Test failing in Smoke 2 | `SMOKE_TESTS_v1.3.md` → Smoke Test 2 → Troubleshooting section |

---

## Environment Requirements

### Test Machine

- [ ] Modern browser (Chrome, Firefox, Edge — latest version)
- [ ] DevTools open (F12)
- [ ] Internet connection (stable, no VPN issues)
- [ ] Access to: `hmatologia2.web.app`, Cloud Console, Firebase Console

### Test Account

- [ ] Firebase Auth user (email: `your-test@example.com`)
- [ ] Member of `riopomba` lab (in Firestore `/labs/riopomba/members/{uid}`)
- [ ] Role: `RT` (Responsável Técnico)
- [ ] Claims: `isActiveMemberOfLab: true`

### Test Data

- [ ] Riopomba lab exists in Firestore
- [ ] 17 bioquímica analitos seeded
- [ ] 1+ equipment document created
- [ ] Google Drive test folder created (5 documents)
- [ ] Test bula PDF prepared locally

### Cloud Infrastructure

- [ ] Firestore Rules published
- [ ] Cloud Functions deployed (78 callables)
- [ ] Firestore Indexes building/ready
- [ ] Environment variables set

---

## Escalation Path

### If Test Fails

1. **Severity Assessment:**
   - **Critical 🔴:** Data loss, chainHash broken, 5xx rate >5%, rules lockout
   - **High 🟠:** UI broken, regression in v1.2, performance degraded
   - **Medium 🟡:** Cosmetic issue, non-blocking warning, optional feature fail

2. **Action:**
   - Document in `SMOKE_TESTS_EXECUTION_GATE.md`
   - Screenshot error + console logs
   - Post to deployment channel
   - If Critical → initiate rollback (see DEPLOY_ROADMAP_v1.3.md Section 7)
   - If High/Medium → log post-deploy bug, continue monitoring

3. **Contacts:**
   - **Deploy Lead:** CTO (drogafarto)
   - **Ops Lead:** On-call engineer
   - **Functions Team:** For Cloud Function errors
   - **Rules Audit:** For Firestore rule violations

---

## Success Criteria

### Smoke Tests Passing

- ✅ Smoke 1 (Bioquímica): All 7 steps pass
- ✅ Smoke 2 (SGD): All 7 steps pass
- ✅ Smoke 5 (Regression): All 5 modules accessible
- ✅ Cloud Logs: No new ERROR/CRITICAL errors
- ✅ Data Integrity: chainHash valid, no missing fields

### Ready for Phase 9

- ✅ All core smoke tests passed
- ✅ Sign-off form completed and approved
- ✅ Stakeholders notified
- ✅ On-call rotation ready for 24h ops monitoring

---

## Timeline Summary

| Phase | Task | Duration | Owner |
|-------|------|----------|-------|
| Setup | Prepare test data | 5–10 min | QA Engineer |
| Setup | Verify infrastructure | 5 min | DevOps |
| Exec | Smoke Test 1 | 10 min | QA Engineer |
| Exec | Smoke Test 2 | 12 min | QA Engineer |
| Exec | Smoke Test 5 | 10 min | QA Engineer |
| Verify | Cloud Logs review | 5 min | DevOps |
| Verify | Data integrity | 5 min | DevOps |
| Sign-Off | Complete gate form | 3 min | QA Lead |
| **Total** | **All phases** | **~50 min** | — |

**Plus:** 24 hours of operational monitoring (Phase 9)

---

## Document Maintenance

**Last Updated:** 2026-05-07  
**Version:** 1.0 (stable)  
**Owner:** CTO (drogafarto)  
**Review Schedule:** After each v1.3 hotfix or Phase 9 (24h ops)

**If Documents Need Update:**
1. Edit the relevant doc in `C:\hc quality\docs\`
2. Update this index if new documents added
3. Commit with message: `chore(smoke-tests): update documentation`

---

## Archive & History

**Previous Smoke Test Docs:**
- None (v1.3 is first structured post-deployment smoke test suite)

**Related Phase Documents:**
- `.planning/milestones/v1.3-DEPLOYMENT_LOG.md` — Deployment timeline
- `docs/DEPLOY_ROADMAP_v1.3.md` — Full deployment roadmap
- `CLAUDE.md` — Project conventions and rules

---

**Start Testing:** [TEST_DATA_QUICK_START.md](TEST_DATA_QUICK_START.md) → [SMOKE_TESTS_EXECUTION_GATE.md](SMOKE_TESTS_EXECUTION_GATE.md) → [SMOKE_TESTS_v1.3.md](SMOKE_TESTS_v1.3.md)

**Questions?** Check troubleshooting section in each doc, or post to deployment channel.

**Good luck!** 🚀
