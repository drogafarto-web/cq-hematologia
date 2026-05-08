# Deployment Runbook Index v1.4

**Phase 4 Deployment (2026-05-08)**  
**Status:** ✅ LIVE (production hmatologia2.web.app)  
**Next Review:** Phase 5 deployment (2026-05-15)

---

## Quick Reference

### Pre-Deploy Checklist (Must Pass)

- [x] All 150+ unit tests passing (`npm test`)
- [x] All 8 E2E specs passing (`npm run e2e`)
- [x] Performance validation: 7/7 metrics passing (`bash scripts/phase4-validation.sh`)
- [x] TypeScript: 0 errors, <20 warnings (`npx tsc --noEmit`)
- [x] Firestore rules syntax valid (`firebase deploy --only firestore:rules --dry-run`)
- [x] Bundle size: main <365 KB (currently 362 KB)
- [x] Secrets provisioned:
  - `HCQ_SIGNATURE_HMAC_KEY` (64 chars)
  - `GEMINI_API_KEY` (Laudo OCR)
  - `NOTIVISA_API_KEY` (sandbox)
  - `RESEND_API_KEY` (patient email exports)
- [x] Bootstrap scripts run idempotently

**Gate Command:**
```bash
bash scripts/preflight-secrets-check.sh && npm run build && npm test
```

---

## Deployment Sequence

### Phase 1: Firestore Rules (5–10 min)

**Purpose:** Apply new rule gates for Portal-RT, Portal-Paciente, NOTIVISA, RT-presence, Laudo-OCR.

**Command:**
```bash
firebase deploy --only firestore:rules --project hmatologia2
```

**Validation:**
```bash
# Dry-run first (no changes)
firebase deploy --only firestore:rules --dry-run --project hmatologia2
# Expected: "✔ firestore:rules: Rules uploaded successfully (no changes deployed)"

# Then execute
firebase deploy --only firestore:rules --project hmatologia2
# Expected: "✔ firestore:rules: Deployed rules for database (default)"
```

**Post-Deploy Checks:**
- [ ] Console: https://console.firebase.google.com/project/hmatologia2/firestore/rules
  - Look for: No errors in rule viewer
  - Expected: Green checkmark on all rules blocks

- [ ] Manual test (via Cloud Console):
  - Create test: `/portal-rt-state/{labId}/dashboards/{dashboardId}` as non-RT user → 403 (Forbidden)
  - Expected: Rules correctly reject non-RT access

**Rollback:** `firebase deploy --only firestore:rules --project hmatologia2` (revert to prior version in Git)

---

### Phase 2: Cloud Functions (15–20 min)

**Purpose:** Deploy new callables for Portal-RT, Portal-Paciente, NOTIVISA, Laudo-OCR, consent backfill.

**Pre-Deploy:**
```bash
cd functions
npm install
npm run build
npm test
```

**Expected Output:**
```
PASS  src/modules/portal-rt/*.test.ts
PASS  src/modules/portal-paciente/*.test.ts
PASS  src/modules/notivisa/*.test.ts
PASS  src/modules/ocr/*.test.ts
PASS  src/modules/lgpd/*.test.ts

Test Suites: 5 passed, 5 total
Tests:       150+ passed, 150+ total
```

**Deploy:**
```bash
firebase deploy --only functions --project hmatologia2 --force
```

**Why `--force`:** Skips interactive prompts (CI/CD automation).

**Expected Output:**
```
i  deploying functions
⠙  functions: Waiting for operation to complete...

✔  functions[portal_rt_createDashboard(us-central1)]: Successful update operation.
✔  functions[portal_rt_updateDashboard(us-central1)]: Successful update operation.
✔  functions[critical_acknowledgeEscalation(us-central1)]: Successful update operation.
✔  functions[portal_paciente_recordConsent(us-central1)]: Successful update operation.
... [20+ more functions] ...

✔  All functions deployed successfully [15 functions in 120 seconds]
```

**Post-Deploy Checks:**
- [ ] Cloud Functions Dashboard: https://console.cloud.google.com/functions?project=hmatologia2
  - Expected: All functions show "OK" (green checkmark)
  - No timeout or 503 errors

- [ ] Manual callable test (via Firebase Console):
  ```bash
  # Test Portal-RT callable
  firebase functions:config:get > .runtimeconfig.json
  npx firebase-cli --import=.runtimeconfig.json call portal_rt_createDashboard -- \
    '{"dashboardId":"test-dashboard","layout":"default"}'
  # Expected: 200 OK, returns dashboard object
  ```

**Monitor:** Watch Cloud Logs for 5 minutes
```bash
gcloud functions logs read portal_rt_createDashboard --limit 50 --project hmatologia2
```

**Rollback:** `firebase deploy --only functions --project hmatologia2` (revert to prior version in Git)

---

### Phase 3: Hosting (5 min)

**Purpose:** Deploy updated web bundle with Portal-RT, Portal-Paciente UX + updated hooks.

**Pre-Deploy:**
```bash
npm run build
# Expected: ✔ built in 45s, main: 362 KB, vendor: 247 KB
```

**Deploy:**
```bash
firebase deploy --only hosting --project hmatologia2
```

**Expected Output:**
```
i  deploying hosting
✔  hosting[hmatologia2]: file upload complete

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/hmatologia2/overview
Hosting URL: https://hmatologia2.web.app
```

**Post-Deploy Checks:**
- [ ] Smoke Test: https://hmatologia2.web.app
  - Expected: Hub loads, Portal-RT tile visible, Portal-Paciente tile visible
  - LCP <2s (measure with Lighthouse)

- [ ] Portal-RT: Click tile → Dashboard loads, escalation count shows
  - Expected: 0 escalations (or test data if seeded)

- [ ] Portal-Paciente: Visit `/portal-paciente`
  - Expected: Email auth form visible

**Monitor:** Lighthouse CI
```bash
npm run lighthouse -- https://hmatologia2.web.app
# Expected: performance >90, LCP <2.0s
```

**Rollback:** `firebase deploy --only hosting --project hmatologia2` (revert to prior version in Git)

---

## Post-Deploy Monitoring (24h)

**Automated Script:**
```bash
bash scripts/monitor-cloud-logs.sh 24 30
# Watches Cloud Logs for 24h, reports every 30 min
```

**Manual Monitoring:**

### Error Rate Alert

**Filter:** `severity="ERROR" AND resource.type="cloud_function"`

**Acceptable:** <0.1% error rate (background noise)  
**Red Line:** >1% error rate (pause deployments, investigate)

**Command:**
```bash
gcloud logging read 'severity="ERROR" AND timestamp>="2026-05-08T00:00:00Z"' \
  --project=hmatologia2 --limit=100 --format=json | grep severity | wc -l
```

### Latency Alert

**Filter:** `httpRequest.latency > 5000ms AND resource.type="cloud_function"`

**Acceptable:** <5 instances/hour  
**Red Line:** >20 instances/hour (possible bottleneck)

**Command:**
```bash
gcloud logging read 'httpRequest.latency > 5000' \
  --project=hmatologia2 --limit=100 --format=json | jq '.[] | .httpRequest.latency'
```

### Rules Rejection Alert

**Filter:** `message="Denied by Firestore Security Rules" AND operation="read"|"write"`

**Acceptable:** <10/hour (expected for permission tests)  
**Red Line:** >100/hour (possible rule syntax error)

**Command:**
```bash
gcloud logging read '"Denied by Firestore Security Rules"' \
  --project=hmatologia2 --limit=100
```

---

## Rollback Procedures

### Full Rollback (All Phases)

**Scenario:** Critical bug found post-deploy, revert everything.

**Steps:**
```bash
# 1. Revert Git commits (Phase 4 is commit b2e415b)
git revert HEAD~0..b2e415b  # or use reset if not yet pushed
git push

# 2. Re-deploy previous version
firebase deploy --project hmatologia2 --force
# This will redeploy rules + functions + hosting from previous Git state

# 3. Monitor for 30 min
bash scripts/monitor-cloud-logs.sh 30 5
```

**Validation:**
- [ ] Portal-RT unavailable (tile grayed out) OR shows error
- [ ] Portal-Paciente unavailable
- [ ] NOTIVISA drafts hidden
- [ ] Cloud Functions: old version running (check timestamp in logs)

### Partial Rollback (Functions Only)

**Scenario:** Bug in Portal-RT callable, everything else OK.

```bash
# 1. Fix: src/modules/portal-rt/portal_rt_createDashboard.ts
# 2. Rebuild + test
npm run build && npm test -- portal-rt

# 3. Redeploy only Portal-RT function
firebase deploy --only functions:portal_rt_createDashboard --project hmatologia2

# 4. Verify: Portal-RT callable still works with fix
```

### Rules Rollback Only

**Scenario:** Rule syntax error, functions/hosting fine.

```bash
# 1. Revert firestore.rules to prior version
git checkout HEAD~1 -- firestore.rules

# 2. Validate dry-run
firebase deploy --only firestore:rules --dry-run --project hmatologia2

# 3. Deploy
firebase deploy --only firestore:rules --project hmatologia2

# 4. Test: Verify Portal-RT reads work again
```

---

## Incident Response Contacts

**CTO (Deployment Authority):** [Fill in contact]  
**Infrastructure Lead:** [Fill in contact]  
**On-Call Rotation:** [Fill in schedule]  

### Escalation Matrix

| Severity | Example | Owner | ETA | Escalate |
|----------|---------|-------|-----|----------|
| 🟢 Green | Latency +10% | Eng | <1h | After 2h |
| 🟡 Yellow | Error rate 0.5% | Eng | <30m | After 1h |
| 🔴 Red | Error rate >5% OR Portal-RT down | Eng + CTO | <15m | After 30m |
| ⚫ Black | Data loss OR DICQ breach | All Hands | <5m | Immediate |

---

## Pre-Deployment Checklist (Fill Before Each Deploy)

- [ ] Git: All Phase 4 commits merged to `main` (commit: `b2e415b`)
- [ ] Build: `npm run build` passes (0 errors, <20 warnings)
- [ ] Tests: All 150+ tests passing
- [ ] Rules: Firestore rules syntax valid (dry-run clean)
- [ ] Secrets: `scripts/preflight-secrets-check.sh` passes
- [ ] Performance: `scripts/phase4-validation.sh` passes (7/7 metrics)
- [ ] Review: Code review completed + approved
- [ ] Compliance: DICQ checklist 100% (critical items)
- [ ] Comms: Stakeholders notified (CTO, ops, customer)
- [ ] Window: Deploy during business hours (9 AM–5 PM, not Fri evening)

---

## Deployment Window Guidelines

**Preferred:** Tuesday–Thursday, 9–11 AM PT (no overlap with peak lab hours)  
**Acceptable:** Monday–Thursday, 9–5 PM PT  
**Avoid:** Friday evening (no on-call coverage), weekends, holidays

**Lab Peak Hours:** 7–9 AM (morning collection), 12–2 PM (processing)

---

## Post-Deploy Sign-Off Template

```markdown
# Phase 4 Deployment Sign-Off — 2026-05-08

**Deployment Started:** 2026-05-08 09:00 PT  
**Rules Deployed:** 2026-05-08 09:05 PT  
**Functions Deployed:** 2026-05-08 09:15 PT  
**Hosting Deployed:** 2026-05-08 09:20 PT  

## Post-Deploy Validation

- [ ] Portal-RT loads in <2s (LCP)
- [ ] Portal-Paciente email auth works
- [ ] NOTIVISA draft creation works
- [ ] Laudo OCR processes test image
- [ ] Cloud Logs: <0.1% error rate
- [ ] Rules: <10 rejections/hour (normal)
- [ ] Bundle size: 362 KB (OK)

## Incident Log

(None) — Deployment clean.

## Sign-Off

**Deployment Lead:** [Name] — 2026-05-08 09:30 PT  
**QA Lead:** [Name] — 2026-05-08 09:35 PT  
**CTO:** [Name] — 2026-05-08 09:40 PT  

**Status:** ✅ APPROVED FOR PRODUCTION
```

---

## References

- Phase 4 Completion Summary: `docs/PHASE_4_COMPLETION_SUMMARY.md`
- Wave 4 Deliverables: `proposed-changes/WAVE_4_DELIVERABLES_INDEX.md`
- Compliance Checklist: `docs/COMPLIANCE_CHECKLIST_v1.4.md`
- Cloud Logs Monitoring: `docs/CLOUD_LOGS_MONITORING_GUIDE.md`
- Performance Validation: `scripts/phase4-validation.sh`
