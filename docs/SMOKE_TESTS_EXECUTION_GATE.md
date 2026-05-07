---
title: Smoke Tests Execution Gate — v1.3
version: 1.0
date: 2026-05-07
status: READY
scope: Step 4 of v1.3 Deployment Roadmap
---

# Smoke Tests Execution Gate — v1.3

**Purpose:** Final gate before executing smoke tests. Confirms all preconditions met.

**Completion Time:** ~2 hours total (including test execution)

**Go/No-Go Decision:** See bottom of this document.

---

## Pre-Execution Readiness (15 min)

### Prerequisite 1: Test Data Prepared

**Source:** `SMOKE_TESTS_TEST_DATA_VERIFICATION.md`

**Confirm:**
- [ ] Riopomba lab exists and is active
- [ ] 17 bioquímica analitos seeded
- [ ] At least 1 equipment created
- [ ] Lab settings document created
- [ ] Test member doc created (with `isActiveMemberOfLab: true`)
- [ ] Google Drive test folder created (ID saved)
- [ ] 5 test documents in Drive folder
- [ ] Test bula PDF prepared (local file)

**Estimated Time:** 10 minutes (if executing from `TEST_DATA_QUICK_START.md`)

---

### Prerequisite 2: Cloud Infrastructure Verified

**Source:** `POST_DEPLOY_CHECKLIST_v1.3.md`

**Confirm:**
- [ ] Firestore Rules published (status green, timestamp recent)
- [ ] Firestore Indexes deployed (status Ready or Building, no Errors)
- [ ] All Cloud Functions deployed (78 total, all green status)
- [ ] Environment variables set (`GEMINI_API_KEY`, `DRIVE_OAUTH_CLIENT_SECRET`)
- [ ] Service Worker updated in browser (hard refresh: Ctrl+Shift+R)

**Estimated Time:** 5 minutes (visual inspection in consoles)

---

### Prerequisite 3: Browser Environment Ready

**Confirm:**
- [ ] Production URL accessible: `https://hmatologia2.web.app`
- [ ] Logged in as test RT user (Riopomba member)
- [ ] DevTools open (Console tab visible)
- [ ] Cloud Logging tab open in parallel: `https://console.cloud.google.com/logs/`
- [ ] Firebase Console tab open: `https://console.firebase.google.com/project/hmatologia2`
- [ ] Network tab recording (DevTools → Network)

**Estimated Time:** 3 minutes (setup)

---

## Smoke Test Execution (80 min total)

### Smoke Test 1: Bioquímica End-to-End (10 min)

**Source:** `SMOKE_TESTS_v1.3.md` — Smoke Test 1

**Steps:**
1. Navigate to `/bioquimica`
2. Verify 16 analitos load
3. Upload bula PDF (Gemini parsing)
4. Create lot from parsed bula
5. Record a run (with 3 analitos)
6. View Levey-Jennings chart
7. Verify chainHash in Firestore (optional)

**Pass Criteria:**
- [ ] Page loads <3s, no JS errors
- [ ] 16+ analitos visible
- [ ] Bula parse completes <35s
- [ ] Lot created and visible with status `EM USO`
- [ ] Run recorded and visible with status `APROVADA`
- [ ] Chart renders with data point on mean line
- [ ] chainHash present in Firestore (64-char hex)

**Estimated Time:** 10 minutes

**Result:** ☐ PASS ☐ FAIL

---

### Smoke Test 2: SGD Drive Importer (12 min)

**Source:** `SMOKE_TESTS_v1.3.md` — Smoke Test 2

**Steps:**
1. Navigate to `/sgd` or `/sgq/importar-drive`
2. Initiate OAuth flow (Google consent screen)
3. Complete OAuth callback
4. Select Drive folder and list documents (5 expected)
5. Preview 3 sample documents
6. Select all 5 documents and batch import
7. Publish all 5 documents
8. Search/filter documents

**Pass Criteria:**
- [ ] OAuth flow completes <5s
- [ ] Exactly 5 documents listed
- [ ] All 5 documents preview cleanly
- [ ] All 5 import successfully (status `rascunho`)
- [ ] All 5 transition to `vigente` (<3s each)
- [ ] Search filters work (type "MQ" → 1 result)

**Estimated Time:** 12 minutes

**Result:** ☐ PASS ☐ FAIL

---

### Smoke Test 3: Reclamação Multi-Channel (8 min) [OPTIONAL]

**Source:** `SMOKE_TESTS_v1.3.md` — Smoke Test 3

**Steps:**
1. Submit public reclamação form (unauthenticated)
2. Login as RT, see reclamação in list
3. Verify Gemini auto-classification
4. Transition reclamação states: Nova → Analisando → Resolvida
5. Verify NPS triggered in Firestore

**Pass Criteria:**
- [ ] Public form works, protocol returned
- [ ] RT sees reclamação in dashboard
- [ ] Auto-classification populated
- [ ] State transitions <3s each
- [ ] NPS entry created in Firestore

**Estimated Time:** 8 minutes

**Result:** ☐ PASS ☐ FAIL ☐ SKIPPED

---

### Smoke Test 4: Liberação State Machine (5 min) [OPTIONAL]

**Source:** `SMOKE_TESTS_v1.3.md` — Smoke Test 4

**Steps:**
1. Use approved bioquímica run from Smoke 1
2. Trigger laudo creation
3. Sign as RT (signature gate)
4. Verify state transitions: Pendente → Em Revisão → Liberado

**Pass Criteria:**
- [ ] Laudo created (status `Pendente`)
- [ ] RT can sign (signature recorded)
- [ ] State transitions valid
- [ ] Event logged in Firestore

**Estimated Time:** 5 minutes

**Result:** ☐ PASS ☐ FAIL ☐ SKIPPED

---

### Smoke Test 5: Regression Check (10 min)

**Source:** `SMOKE_TESTS_v1.3.md` — Smoke Test 5

**Spot-check existing modules:**

- [ ] `/analyzer` — OCR flow loads
- [ ] `/coagulacao` → select run → chart loads
- [ ] `/auditoria` → checklist visible
- [ ] `/treinamentos` → list view renders
- [ ] `/educacao-continuada` → colaboradores load

**Pass Criteria:**
- [ ] All 5 routes load <3s
- [ ] No 404 or 500 errors
- [ ] Console shows 0 JS errors

**Estimated Time:** 10 minutes

**Result:** ☐ PASS ☐ FAIL

---

## Post-Smoke Test Verification (10 min)

### Cloud Logs Review

**Action:**
1. Open Cloud Logging: `https://console.cloud.google.com/logs/query?project=hmatologia2`
2. Filter: `severity>="ERROR"` AND `timestamp>"2026-05-07T00:00:00Z"`
3. Review last 100 logs

**Confirm:**
- [ ] No new ERROR or CRITICAL errors (post-deploy)
- [ ] No function timeouts or 5xx responses
- [ ] All executed functions show successful completion

**Estimated Time:** 5 minutes

---

### Data Integrity Spot-Check

**Action:**
1. Firestore Console → `/labs/riopomba/bioquimica/root/runs/`
2. Check 1 run from Smoke 1:
   - [ ] All fields present (`labId`, `lote`, `nível`, `resultados`, `status`)
   - [ ] `chainHash` present (64-char hex)
   - [ ] Events subcollection has ≥1 event with valid hash

3. Firestore Console → `/labs/riopomba/sgq-documentos/`
4. Check 1 document from Smoke 2:
   - [ ] All fields present (`codigo`, `tipo`, `titulo`, `status`)
   - [ ] Audit trail present (criadoPor, criadoEm, etc.)

**Estimated Time:** 5 minutes

---

### Performance Baseline Check

**Action:**
1. Check Web Vitals in DevTools:
   - [ ] LCP <2.5s (Lighthouse target)
   - [ ] INP <200ms
   - [ ] CLS <0.1

2. Check Network tab for largest requests:
   - [ ] Main JS chunk <400 KB gzip
   - [ ] Firestore reads <5s for queries

**Estimated Time:** Optional, <5 minutes

---

## Sign-Off & Go/No-Go Decision

### Execution Summary

| Test | Status | Notes |
|------|--------|-------|
| Bioquímica E2E | ☐ PASS ☐ FAIL | |
| SGD Drive Importer | ☐ PASS ☐ FAIL | |
| Reclamação (opt) | ☐ PASS ☐ FAIL ☐ SKIP | |
| Liberação (opt) | ☐ PASS ☐ FAIL ☐ SKIP | |
| Regression | ☐ PASS ☐ FAIL | |
| Cloud Logs Review | ☐ CLEAN ☐ WARNINGS ☐ ERRORS | |
| Data Integrity | ☐ OK ☐ ISSUES | |

---

### GO/NO-GO Criteria

#### 🟢 GO (Approve deployment, proceed to Phase 9 Validation)

**ALL of the following must be true:**

- ✅ Smoke 1 (Bioquímica) = PASS
- ✅ Smoke 2 (SGD) = PASS
- ✅ Smoke 5 (Regression) = PASS
- ✅ Cloud Logs = CLEAN (no new ERROR/CRITICAL)
- ✅ Data Integrity = OK (no missing fields, chainHash valid)
- ✅ No blocking issues found

**Action:** 
1. Document results in this form
2. Notify stakeholders: "v1.3 smoke tests passed, ready for 24h ops"
3. Proceed to Phase 9 (operational monitoring)

---

#### 🔴 NO-GO (Escalate to rollback)

**If ANY of these are true:**

- ❌ Smoke 1 or 2 = FAIL
- ❌ Smoke 5 = FAIL
- ❌ Cloud Logs = ERRORS (new, post-deploy)
- ❌ Data Integrity = ISSUES (chainHash broken, fields missing)
- ❌ Critical blocking issue (data loss, lockout, 5xx rate >5%)

**Action:**
1. Document issue details (screenshot, stack trace, steps to reproduce)
2. Post to deployment channel with severity level
3. If **Critical**: initiate **Rollback Procedure** (see DEPLOY_ROADMAP_v1.3.md Section 7)
4. If **High/Medium**: log post-deploy bug, schedule fix, continue monitoring

---

#### 🟡 CONDITIONAL (Investigate before deciding)

**If EITHER:**

- Smoke 3 or 4 FAIL (non-critical, optional tests)
- Indexes still building after 60 min
- Transient errors <1% invocation rate in Cloud Logs

**Action:**
1. Assess severity: non-blocking or blocking?
2. If non-blocking: log as post-deploy bug, continue with GO
3. If blocking: escalate to High/Medium (see NO-GO path above)

---

## Execution Sign-Off

**Date & Time:** `_______________________`  
**Tester Name:** `_______________________`  
**Lab ID:** `riopomba`

### Final Decision

**I have completed all smoke tests and verification steps. My determination is:**

#### ☐ GO — Ready for Phase 9 Operational Monitoring

**Rationale:** (brief summary of results)  
___________________________________________________________________  
___________________________________________________________________

#### ☐ NO-GO — Rollback Required

**Critical Issue:** (describe issue, include stack trace if applicable)  
___________________________________________________________________  
___________________________________________________________________

#### ☐ CONDITIONAL — Investigate Further

**Issue:** (describe conditional issue)  
___________________________________________________________________  
**Decision:** ☐ Can proceed as GO ☐ Requires NO-GO path

---

### Authorization

**Tester Signature:**  
Print name: `_______________________`  
Signature: `_______________________`  
Timestamp: `_______________________`

**Approved By (CTO/Ops Lead):**  
Print name: `_______________________`  
Signature: `_______________________`  
Timestamp: `_______________________`

---

## Next Steps

### If GO ✅

1. Archive this sign-off document
2. Notify ops team: "Phase 9 — 24h operational monitoring begins"
3. Set up on-call rotation for next 24h
4. Monitor Cloud Logs continuously for ERROR/CRITICAL
5. After 24h with <1% error rate: mark v1.3 as STABLE

### If NO-GO 🔴

1. Initiate rollback per DEPLOY_ROADMAP_v1.3.md Section 7
2. Notify stakeholders of rollback status
3. Preserve logs and Firestore snapshots for RCA (root cause analysis)
4. Schedule post-mortem meeting with team

### If CONDITIONAL 🟡

1. Complete investigation
2. If resolved: convert to GO
3. If unresolved: convert to NO-GO and rollback

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Status:** Ready for Execution  
**Related Docs:** `SMOKE_TESTS_v1.3.md`, `POST_DEPLOY_CHECKLIST_v1.3.md`, `SMOKE_TESTS_TEST_DATA_VERIFICATION.md`
