# Phase 4 Post-Deployment Validation Checklist

**Deployment Date:** May 20, 2026  
**Validation Window:** 08:45–12:30 UTC-3 (4 hours post-deploy)  
**Owner:** Incident Commander + Lab Director + On-Call Engineer  
**Status:** Ready for execution

---

## Overview

This checklist validates that Phase 4 deployment (Portal Auth + NOTIVISA Queue) is functioning correctly across:
1. **Smoke Tests** — Automated technical validation
2. **Lab Testing** — Manual lab-based functional testing
3. **Auditor Review** — Compliance review by lab director/auditor

All items must be completed before sign-off.

---

## Section 1: Smoke Tests (Automated, 15 min)

### 1.1 Hosting Reachability

**Command:**
```bash
curl -s -o /dev/null -w "%{http_code}" https://hmatologia2.web.app/portal/auth
```

**Expected:** `200`

**Failure Response:**
```bash
# If fails:
curl -v https://hmatologia2.web.app/portal/auth
# Check: CDN, firewall rules, hosting deployment
```

**Status:** ☐ PASS ☐ FAIL

---

### 1.2 Firestore Rules Validation

**Command:**
```bash
firebase emulator:start --only firestore &
npm run test:firestore-rules
```

**Expected:** All tests pass (example: "✓ NOTIVISA rules (12 tests)")

**Failure Response:**
```bash
# If fails:
firebase emulator:start --only firestore
# In another terminal:
npm run test:firestore-rules 2>&1 | grep -i "fail\|error"
# Check: Rule syntax, test assertions
```

**Status:** ☐ PASS ☐ FAIL

---

### 1.3 Cloud Functions Health

**Command:**
```bash
gcloud functions list --project hmatologia2 --region southamerica-east1 \
  --filter="name:notivisa*" --format="table(name, status)"
```

**Expected Output:**
```
NAME                               STATUS
projects/.../notivisaDraftCreate   ACTIVE
projects/.../submitNotivisa        ACTIVE
projects/.../notivisaQueueProcessor ACTIVE
projects/.../notivisaStatusCheck   ACTIVE
projects/.../notivisaWebhookHandler ACTIVE
```

**Failure Response:**
```bash
# If status is DEPLOYMENT_IN_PROGRESS or ERROR:
gcloud functions describe notivisaDraftCreate \
  --project hmatologia2 --region southamerica-east1
# Check: Build logs, error messages
```

**Status:** ☐ PASS ☐ FAIL

---

### 1.4 Firestore Indexes Ready

**Command:**
```bash
gcloud firestore indexes list --project hmatologia2 | grep -E "notivisa|READY"
```

**Expected:** All notivisa indexes with status `READY` (6 total)

**Failure Response:**
```bash
# If any index shows "Building" or "Error":
gcloud firestore indexes list --project hmatologia2 --filter="database=default" --format="table(name, state)"
# Wait up to 15 minutes for indexes to complete
```

**Status:** ☐ PASS ☐ FAIL

---

### 1.5 Bundle Size Check

**Command:**
```bash
du -k dist/assets/index-*.js | awk '{print $1}'
```

**Expected:** <365 KB (actual size should be ~320–355 KB)

**Failure Response:**
```bash
# If size >365 KB:
npm run build -- --mode production
du -k dist/assets/index-*.js
# Check: Unexpected imports, missing tree-shaking
```

**Status:** ☐ PASS ☐ FAIL

---

### 1.6 Lighthouse Performance Audit

**Command:**
```bash
npm run lighthouse -- https://hmatologia2.web.app/portal/dashboard
```

**Expected:**
```
Performance Score: ≥87
LCP: <2.0 seconds
INP: <200 ms
CLS: <0.05
```

**Failure Response:**
```bash
# If score <87:
# 1. Check DevTools > Lighthouse (local)
# 2. Identify slowest metrics
# 3. Check Cloud Logs for function latency issues
# 4. Verify no new heavy imports
```

**Status:** ☐ PASS ☐ FAIL

---

### 1.7 E2E Test Suite

**Command:**
```bash
npm run test:e2e -- --spec "src/__tests__/e2e/phase-4-critical-flows.test.ts"
```

**Expected:** All 6 critical flows pass

**Flows:**
1. Auth flow — patient login → dashboard
2. Draft creation — auditor creates NOTIVISA draft
3. Draft submission — (0% rollout: should be blocked)
4. Portal navigation — dark theme, responsiveness
5. Laudo read — patient views laudo without errors
6. Error handling — offline mode, network failure recovery

**Failure Response:**
```bash
# If any test fails:
npm run test:e2e -- --headed --spec "..."
# Observe browser to identify failure point
# Check console logs in DevTools
```

**Status:** ☐ PASS ☐ FAIL

---

## Section 2: Lab Testing (Manual, 1 hour)

### 2.1 Portal Auth Flow — Patient Perspective

**Setup:** Use test patient account: `patient-test-001@hc-quality.local`

**Steps:**

1. **Navigate to Portal**
   ```
   URL: https://hmatologia2.web.app/portal/auth
   Expected: Page loads in <2 seconds, dark theme visible
   ```

2. **Enter Email**
   ```
   Email: patient-test-001@hc-quality.local
   Expected: Input accepts email, no validation errors
   ```

3. **Request Auth Link**
   ```
   Click: "Enviar Link de Acesso"
   Expected: 
     - Success notification appears (<1s)
     - "Check your email for login link"
     - HTTP request completes <500ms
   ```

4. **Check Email**
   ```
   Expected:
     - Email arrives <1 minute
     - Subject: "[HC Quality] Access Link"
     - Contains: button "Acessar Portal"
     - Link format: /portal/verify?token=...
   ```

5. **Click Email Link**
   ```
   Open link in new browser
   Expected:
     - Redirects to /portal/dashboard
     - Dashboard loads <2s LCP
     - Patient name visible (authenticated)
     - Dark theme applied
   ```

6. **View Laudo**
   ```
   Click: First laudo in list
   Expected:
     - Laudo details load <1s
     - Results visible
     - No JavaScript errors in console
     - Navigation back works
   ```

**Result:** ☐ PASS ☐ FAIL ☐ PARTIAL (note issues)

**Issues Found (if any):**
```
_________________________________________
_________________________________________
```

---

### 2.2 NOTIVISA UI — Auditor Perspective (Feature Disabled in Phase 4)

**Setup:** Use test auditor account: `auditor-test-001@hc-quality.local`

**Steps:**

1. **Login as Auditor**
   ```
   Navigate to: /portal/auth
   Email: auditor-test-001@hc-quality.local
   Result: Dashboard loads, role shows "Auditor"
   ```

2. **Navigate to NOTIVISA**
   ```
   URL: /portal/notivisa
   Expected: "NOTIVISA Coming Soon" message
   Expected: No submit button available (rollout = 0%)
   Expected: Message: "Your lab is in the next rollout phase"
   ```

3. **Verify UI Elements**
   ```
   Expected:
     - Form loads even though feature disabled
     - Dark theme consistent
     - Responsive on mobile (375px width)
     - Accessible: keyboard navigation works
   ```

4. **Check Network Tab**
   ```
   Expected:
     - Feature flag fetched from /featureFlags/notivisa-rollout
     - Request completes <100ms
     - Status: 200 OK
   ```

**Result:** ☐ PASS ☐ FAIL ☐ PARTIAL (note issues)

**Issues Found (if any):**
```
_________________________________________
_________________________________________
```

---

### 2.3 Firestore Multi-Tenant Isolation

**Setup:** Use two different lab contexts

**Steps:**

1. **Login to Lab A (auditor-a@lab-a.local)**
   ```
   Expected: Can access /labs/lab-a/* paths
   Expected: Can read /notivisa-drafts/lab-a/drafts/*
   ```

2. **Attempt Cross-Tenant Access**
   ```
   URL: /portal/dashboard?labId=lab-b
   Expected: Either:
     - 403 Permission Denied
     - UI shows "Access Denied"
     - Cloud Logs shows rule rejection
   NOT: Able to see lab-b data
   ```

3. **Verify Rule Rejections in Logs**
   ```bash
   gcloud logging read "resource.type=firestore AND textPayload=~'.*Permission.*denied.*'" \
     --project hmatologia2 --limit 10
   Expected: <5 rejections (transient retries OK)
   ```

**Result:** ☐ PASS ☐ FAIL ☐ PARTIAL (note issues)

---

### 2.4 Error Handling & Recovery

**Setup:** Simulate network issues

**Steps:**

1. **Offline Mode (DevTools)**
   ```
   Open DevTools > Network > Offline
   Navigate: /portal/dashboard
   Expected: Shows "Offline" message, not blank page
   Resume network: Page recovers
   ```

2. **Slow Network (Throttle)**
   ```
   Open DevTools > Network > Slow 3G
   Navigate: /portal/dashboard
   Expected:
     - Skeleton loader appears
     - Data loads progressively
     - No timeout errors >30s
   ```

3. **Function Timeout (Cloud Logs Check)**
   ```bash
   gcloud logging read "executionTime > 30000" \
     --project hmatologia2 \
     --limit 5
   Expected: 0 functions exceeding 30s timeout
   ```

**Result:** ☐ PASS ☐ FAIL ☐ PARTIAL (note issues)

---

### 2.5 Portal Performance — Real User Monitoring

**Setup:** Open browser DevTools

**Steps:**

1. **Page Load (LCP)**
   ```
   Reload /portal/dashboard
   DevTools > Performance tab
   Expected: LCP <2.0s (measure "Largest Contentful Paint")
   Record: _________ ms
   ```

2. **Interaction (INP)**
   ```
   Click buttons, scroll, interact
   Expected: INP <200ms (measure "Interaction to Next Paint")
   Record: _________ ms
   ```

3. **Visual Stability (CLS)**
   ```
   Observe page during load
   Expected: CLS <0.05 (no layout shift)
   Record: _________ (or "stable")
   ```

4. **Bundle Analysis**
   ```
   DevTools > Network tab
   Expected:
     - index-*.js <365 KB
     - Total page load <1.5s (on fast network)
     - CSS inline, JS defer
   ```

**Result:** ☐ PASS ☐ FAIL ☐ PARTIAL (note metrics)

---

## Section 3: Auditor Review (Compliance, 30 min)

### 3.1 RDC 978 Compliance — Portal Auth

**Requirement:** Art. 167 — Patient Right to Access Medical Records

**Checklist:**

- [ ] Authentication method is secure (link-based, time-limited)
- [ ] Patient email verified (sent by application)
- [ ] Session expires after inactivity (30 min target)
- [ ] Patient can only view their own results (multi-tenant isolation working)
- [ ] Access is logged in audit trail
- [ ] Patient cannot modify results

**Validation Command:**
```bash
# Check audit logs
gcloud logging read "labels.functionName=verifyPatientAuthToken" \
  --project hmatologia2 --limit 20 | jq '.[] | "\(.timestamp) | \(.jsonPayload.patientId)"'
# Expected: Patient ID logged on each access
```

**Status:** ☐ COMPLIANT ☐ NON-COMPLIANT ☐ PARTIAL (note gaps)

---

### 3.2 RDC 978 Compliance — NOTIVISA (Phase 4: Partial)

**Requirement:** Art. 41 — ANVISA Adverse Event Notification

**Phase 4 Checklist (Sandbox):**

- [ ] NOTIVISA queue infrastructure deployed (not enabled)
- [ ] Feature flag implemented (disabled: 0% rollout)
- [ ] Firestore indexes created for queue queries
- [ ] Cloud Functions deployed (ready for real API in Phase 12)
- [ ] Monitoring/alerting ready
- [ ] Rollback procedures documented

**Full Compliance (Phase 12+):**
- [ ] Real ANVISA API endpoint configured
- [ ] Submissions logged and auditable
- [ ] Receipts stored (idempotency tracking)
- [ ] Escalation for missed deadlines implemented

**Status:** ☐ COMPLIANT (Phase 4 scope) ☐ PARTIAL (waiting Phase 12)

---

### 3.3 Data Security & Privacy

**Checklist:**

- [ ] Firestore rules enforce multi-tenant isolation (no cross-lab access)
- [ ] Patient PII encrypted in transit (HTTPS only)
- [ ] Secrets not stored in code (Anvisa API key in Secret Manager)
- [ ] Audit logs immutable (no delete of audit records)
- [ ] Session tokens time-limited (expiry set)
- [ ] No sensitive data in logs (PII filtered)

**Validation Commands:**
```bash
# Check firestore rules don't allow read across labs
grep -n "labId ==" firestore.rules | head -5
# Expected: Rules enforce labId matching

# Check no secrets in code
git diff HEAD~10 | grep -i "apikey\|password\|secret"
# Expected: No matches (or only in config/examples)
```

**Status:** ☐ COMPLIANT ☐ NON-COMPLIANT ☐ PARTIAL (note issues)

---

### 3.4 Change Documentation

**Checklist:**

- [ ] Deployment runbook executed (PHASE_4_DEPLOYMENT_RUNBOOK.md)
- [ ] Feature flag strategy documented (PHASE_4_FEATURE_FLAG_STRATEGY.md)
- [ ] Rollback procedures documented (PHASE_4_ROLLBACK_PROCEDURES.md)
- [ ] Monitoring setup completed (PHASE_4_MONITORING_DASHBOARD_SPECS.md)
- [ ] Post-mortem template available (v1.4-INCIDENT_RESPONSE_CONTACTS.md)
- [ ] Change log updated (git commit messages descriptive)

**Status:** ☐ COMPLETE ☐ INCOMPLETE (note missing docs)

---

## Section 4: Final Sign-Off

### Incident Commander Approval

**Name:** _______________________________  
**Title:** CTO / Technical Lead  
**Date/Time:** __________________ UTC-3  
**Signature:** ___________________________

**Overall Status:**

```
☐ GO-LIVE APPROVED
  All smoke tests, lab tests, and auditor review complete.
  System is stable and ready for production.
  Feature flag set to 0% rollout.
  Next step: Advance to 25% on May 22.

☐ GO-LIVE WITH CONDITIONS
  [Describe conditions, mitigations, and re-check date]
  _________________________________________________
  _________________________________________________

☐ ROLLBACK REQUIRED
  [Describe failure, rollback reason, and timeline]
  _________________________________________________
  _________________________________________________
```

---

### Lab Director / Auditor Approval

**Name:** _______________________________  
**Title:** Lab Director / Auditor  
**Date/Time:** __________________ UTC-3  
**Signature:** ___________________________

**Compliance Confirmation:**

```
☐ Approved for Use
  Portal auth and NOTIVISA queue are operationally ready.
  Multi-tenant isolation verified.
  Audit trail and monitoring functional.

☐ Approved with Reservations
  [Describe reservations and acceptance criteria for Phase 12]
  _________________________________________________

☐ Not Approved
  [Describe non-compliance issue and required remediation]
  _________________________________________________
```

---

## Appendix: Quick Reference

### Critical Metrics Targets

| Metric | Target | Check Command |
|--------|--------|---|
| Auth success | >99% | Dashboard 1, Widget 1.1 |
| Auth latency p95 | <500ms | Dashboard 1, Widget 1.2 |
| Queue stuck entries | 0 | Dashboard 2, Widget 2.4 |
| LCP | <2.0s | Lighthouse audit |
| INP | <200ms | DevTools Performance |
| Error rate | <0.1% | Dashboard 4, Widget 4.1 |

### Troubleshooting Checklist

**If smoke test fails:**
1. Check internet connectivity
2. Verify GCP project access (`gcloud auth list`)
3. Check region (`southamerica-east1`)
4. Review function logs (`firebase functions:log`)

**If lab test fails:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard reload (Ctrl+Shift+R)
3. Check DevTools console for errors
4. Try in private/incognito window

**If compliance issue:**
1. Document gap in Section 3
2. Determine if blocking (rollback) or non-blocking (remediate in Phase 5+)
3. Notify CTO and lab director
4. File ticket for next phase

---

**Validation Complete?** Proceed to sign-off.  
**Issues Found?** Document in Section 2–3 and escalate.  
**Ready to Rollout to 25%?** Advance feature flag after 48h stability window.
