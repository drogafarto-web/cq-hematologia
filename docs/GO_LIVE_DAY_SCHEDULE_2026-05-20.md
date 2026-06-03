---
title: 'Go-Live Day Schedule — Phase 4 Production Deployment'
date: '2026-08-31'
status: 'EXECUTION SCHEDULE'
---

# Go-Live Day Schedule

**Deploy Date:** 2026-08-31  
**Deploy Window:** 20:00–22:30 UTC-3 (São Paulo time)  
**Active Time:** 2h 30m  
**Monitoring Window:** 48 hours (2026-08-31 22:30 → 2026-09-02 22:30)

---

## Timeline at a Glance

```
2026-08-31 18:00 UTC-3      Team Assembly + Preflight
2026-08-31 20:00 UTC-3      DEPLOYMENT START
  └─ Step 1: Firestore Rules (30 min)
  └─ Step 2: Cloud Functions (40 min)
  └─ Step 3: Hosting (30 min)
  └─ Step 4: Smoke Tests (45 min)
2026-08-31 22:30 UTC-3      START 48-hour Monitoring
2026-09-02 22:30 UTC-3      END Monitoring + Closure
```

---

## Pre-Deployment Window (18:00–20:00 UTC-3)

### 18:00 UTC-3 — War Room Assembly

**Duration:** 15 minutes  
**Participants:** DevOps lead, QA lead, CTO, on-call engineer, Slack operator

**Tasks:**

- [ ] All team members logged into Slack #production-emergency
- [ ] All team members logged into video call (Zoom/Meet link)
- [ ] Runbooks printed and visible at each team member's desk
- [ ] Alert policies verified (Cloud Monitoring dashboard open)
- [ ] Secret manager accessible (gcloud auth verified)
- [ ] Firestore backup completed and snapshot saved
- [ ] Health checks: "Go round-robin: Is your system ready?"

**Success Criteria:**

- All 5 team members present and camera on
- All systems accessible without errors
- No blocking secrets/config issues identified

---

### 18:15 UTC-3 — Final Preflight Checks

**Duration:** 15 minutes  
**Owner:** DevOps lead

**Checklist:**

```
Firestore:
  [ ] Backup snapshot created: gs://hmatologia2-backup/phase4-pre-deploy.tar.gz
  [ ] Rules staging validated: no syntax errors
  [ ] Indexes ready: 4 indexes waiting for deploy
  [ ] Multi-tenant isolation spot-checked (2 random labs)

Cloud Functions:
  [ ] Build completed: npm run build successful (0 errors)
  [ ] All 78 functions listed: firebase functions:list shows 78 total
  [ ] 8 new functions verified present
  [ ] Environment variables set: GEMINI_API_KEY, TWILIO_AUTH_TOKEN (if used), NOTIVISA_ENDPOINT
  [ ] Secrets manager accessible: gcloud secrets list | grep hmatologia2

Cloud Storage:
  [ ] Bucket permissions: hmatologia2.appspot.com writable
  [ ] OCR results directory: /laudos/{labId}/ocr-results/ ready

Cloud Scheduler:
  [ ] 3 cron jobs configured:
    - Supervisor status (every 30 min)
    - NOTIVISA retry (every 5 min)
    - Cloud Logs baseline (Monday 08:00)
  [ ] All jobs in ENABLED state

Monitoring:
  [ ] Cloud Monitoring dashboard: 4 SLOs visible
  [ ] Alert policies: A1, A3, A4 in ENABLED state
  [ ] Cloud Logs: retention set to 7 days

Secrets:
  [ ] Gemini API key: curl test succeeds
  [ ] Twilio (if used): SMS test sent successfully
  [ ] NOTIVISA sandbox: test API call succeeds
  [ ] Email service: test email delivered to inbox
```

**Sign-Off:**

```
DevOps Lead: "All preflight checks GREEN. Ready to proceed to deployment."

Signature: ________________  Time: __:__ UTC-3
```

---

### 18:30 UTC-3 — Smoke Test Dry-Run

**Duration:** 15 minutes  
**Owner:** QA lead

**4 Critical Scenarios (in sequence):**

**Scenario 1: Patient Auth Flow (2 min)**

```bash
# Command:
curl -X POST https://staging.hmatologia2.web.app/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email": "patient-test@example.com", "labId": "lab-001"}'

# Expected:
- Status 200
- Response: {"sent": true, "ttl": 604800}
- Email received within 30s with valid link

# Success: ✓ / ✗
# Time: __ seconds
```

**Scenario 2: Portal RT Load (2 min)**

```bash
# Command:
curl -X GET https://staging.hmatologia2.web.app/portal-rt \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  --compressed

# Expected:
- Status 200
- HTML body received (no 404)
- LCP reported: <2.5s (staging may be slower)
- No console errors

# Success: ✓ / ✗
# Time: __ seconds
```

**Scenario 3: NOTIVISA Event Submission (2 min)**

```bash
# Command:
firebase functions:call submitNotivisaEvent \
  --data='{"labId":"lab-001","event":{"type":"critical_result"}}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected:
- Function executes <2s
- Response: {"queued": true, "eventId": "..."}
- Event created in Firestore `notivisa-queue/{labId}/events/{eventId}`

# Success: ✓ / ✗
# Time: __ seconds
```

**Scenario 4: Consent Capture Batch (2 min)**

```bash
# Command:
firebase functions:call recordPatientConsent \
  --data='{"labId":"lab-001","patients":["pat-001","pat-002","pat-003"]}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected:
- Function executes <3s
- Response: {"success": 3, "failed": 0}
- Records created in Firestore `patient-consents/{labId}/consents/{patientId}`

# Success: ✓ / ✗
# Time: __ seconds
```

**Results Summary:**

```
Scenario 1 (Auth):      ✓ PASS / ✗ FAIL
Scenario 2 (Portal RT): ✓ PASS / ✗ FAIL
Scenario 3 (NOTIVISA):  ✓ PASS / ✗ FAIL
Scenario 4 (Consent):   ✓ PASS / ✗ FAIL

All 4 Pass? YES / NO → If NO, STOP and debug
```

**Sign-Off:**

```
QA Lead: "All dry-run scenarios GREEN. Ready for production deploy."

Signature: ________________  Time: __:__ UTC-3
```

---

### 18:45 UTC-3 — War Room Standup

**Duration:** 10 minutes  
**Facilitator:** CTO

**Round-Robin Check-In:**

```
CTO: "Ready for deployment?"
  DevOps:   "✓ Yes. Infrastructure GREEN."
  QA:       "✓ Yes. Tests GREEN."
  On-Call:  "✓ Yes. Runbooks ready."
  Engineer: "✓ Yes. Systems online."
```

**Agenda:**

1. Confirm all preflight checks passed
2. Review critical risks (3 top blockers if any)
3. Confirm rollback procedure (everyone knows it)
4. Confirm SLA/escalation (who pages who if P0?)
5. Confirm communication plan (notify labs after Step 4)

**Go/No-Go Decision:**

```
CTO: "This is our go/no-go gate. All green? I'm authorizing deployment."

GO / NO-GO: [ ] GO  [ ] NO-GO

If NO-GO, reason: _____________________________________________
If NO-GO, defer to: ____________________________________________
```

---

### 19:00 UTC-3 — Final Go/No-Go Approval

**Duration:** 5 minutes  
**Owner:** CTO

**CTO Decision Matrix:**

| Check              | Status | Blocker? |
| ------------------ | ------ | -------- |
| Preflight GREEN    | ✓ Yes  | No       |
| Smoke tests GREEN  | ✓ Yes  | No       |
| Team ready         | ✓ Yes  | No       |
| Monitoring armed   | ✓ Yes  | No       |
| Runbooks reviewed  | ✓ Yes  | No       |
| Secrets accessible | ✓ Yes  | No       |

**CTO Authorization:**

```
I have reviewed all readiness criteria and authorize Phase 4 production deployment.

CTO Signature: ___________________________________
Time: __:__ UTC-3
Date: 2026-08-31

AUTHORIZATION: [ ] APPROVED FOR DEPLOYMENT [ ] DEFER

If DEFER, reason: ________________________________________________
```

**Slack Announcement:**

```
CTO: "Phase 4 deployment APPROVED. All hands on deck.
Deployment START at 20:00 UTC-3. War room active.
No interruptions for 2.5 hours."
```

---

## Deployment Window (20:00–22:30 UTC-3)

### 20:00 UTC-3 — DEPLOYMENT START

**Coordinator:** DevOps lead  
**Observers:** QA lead, on-call engineer, CTO

**Announcement:**

```
"Step 1 starting now. Rules deployment in progress. Status updates every 5 min."

Time: 20:00
Task: Deploy Firestore Rules
Duration: 30 min (20:00–20:30)
Owner: DevOps lead
Success Criteria: rules tests pass, no auth errors in logs
Rollback: restore previous rules (< 5 min)
```

---

### 20:00–20:30 UTC-3 — Step 1: Firestore Rules + Indexes

**Exact Commands:**

```bash
# 1. Deploy rules
firebase deploy --only firestore:rules --project hmatologia2

# Expected output:
# ✔ Deploy complete!
# Function URLs can be found in the Firebase Console: https://console.firebase.google.com/project/hmatologia2
```

**Validation (< 5 min):**

```bash
# 2. Run rules tests
firebase rules:test --project hmatologia2

# Expected: All tests PASS (0 failures)
```

**Error Handling:**

```bash
# 3. If rules test fails:
#    a) Check error message
#    b) Look in firestore.rules for syntax error
#    c) Deploy previous commit rules:
#       git show HEAD~1:firestore.rules > firestore.rules
#       firebase deploy --only firestore:rules --project hmatologia2
#    d) Retry step 2
```

**Monitoring (continuous):**

```bash
# 4. Watch Cloud Logs for permission errors
gcloud logging read "resource.type=firestore & severity=ERROR" \
  --project hmatologia2 \
  --limit 50 \
  --format json | jq '.[] | select(.timestamp > "2026-08-31T20:00:00Z")'

# Expected: 0 permission-denied errors
```

**Status Check (at 20:15, 20:25):**

```bash
# 5. Spot check: Can we create a test document in notivisa-queue?
curl -X POST https://firestore.googleapis.com/v1/projects/hmatologia2/databases/(default)/documents/notivisa-queue/lab-001/events \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status":"pending","createdEm":1693497600000}'

# Expected: Document created successfully
```

**Sign-Off (at 20:30):**

```
Timestamp: 20:30 UTC-3
Status: ✓ COMPLETE / ✗ FAILED

If COMPLETE:
  DevOps: "Rules deployed, tests pass, no errors. Ready for Step 2."

If FAILED:
  DevOps: "Rollback in progress. [Reason: _______________]"
  Action: Re-do from latest stable commit, restart at 20:00

Signature: ________________  Time: __:__ UTC-3
```

---

### 20:30–21:10 UTC-3 — Step 2: Cloud Functions

**Announcement:**

```
"Step 2 starting now. Cloud Functions deploy in progress.
Expecting 40 min to completion. Heavy console output expected."

Time: 20:30
Task: Deploy 78 Cloud Functions + warm caches
Duration: 40 min (20:30–21:10)
Owner: DevOps lead
Success Criteria: all functions READY, cold start <3s, caches warm
Rollback: restore previous functions (< 5 min)
```

**Deploy Commands:**

```bash
# 1. Deploy all functions to southamerica-east1
cd functions
npm run build                              # Build TypeScript
firebase deploy --only functions --project hmatologia2 --region southamerica-east1

# Expected output:
# ✔ functions[funcName1] deployed
# ✔ functions[funcName2] deployed
# ... (78 total)
# ✔ Deploy complete!
```

**Validation (< 10 min):**

```bash
# 2. List all functions, confirm 78 deployed
firebase functions:list --project hmatologia2

# Expected: 78 functions listed, all showing ACTIVE state
```

**Warm Caches (< 5 min):**

```bash
# 3. Call 5 critical functions to warm caches and test execution

# Test 3a: submitNotivisaEvent
firebase functions:call submitNotivisaEvent \
  --data='{"labId":"lab-001","event":{"type":"test"}}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected: Success < 2s (cold start), response contains eventId

# Test 3b: recordPatientConsent
firebase functions:call recordPatientConsent \
  --data='{"labId":"lab-001","patients":["pat-001"]}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected: Success < 2s, response contains success count

# Test 3c: updateSupervisorStatus (cron job test)
firebase functions:call updateSupervisorStatus \
  --data='{"labId":"lab-001"}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected: Success < 1s, no errors

# Test 3d: extractLaudoOCR (mock test, no actual PDF)
firebase functions:call extractLaudoOCR \
  --data='{"labId":"lab-001","pdfUrl":"gs://test.pdf"}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected: May error (no actual PDF), but function invoked successfully

# Test 3e: queryNotivisaStatus
firebase functions:call queryNotivisaStatus \
  --data='{"labId":"lab-001","eventId":"event-001"}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected: Success < 1s, returns status
```

**Error Handling:**

```bash
# 4. If any function fails to deploy:
#    a) Check error message in console
#    b) Run: firebase functions:describe functionName --project hmatologia2
#    c) If deployment incomplete, wait 2 min and retry deploy step
#    d) If function code error, rollback and notify CTO
```

**Monitoring (continuous):**

```bash
# 5. Watch for function execution errors
gcloud logging read "resource.type=cloud_function & severity=ERROR" \
  --project hmatologia2 \
  --limit 100 \
  --format json | jq '.[] | select(.timestamp > "2026-08-31T20:30:00Z")'

# Expected: <5 errors during warmup (acceptable)
```

**Status Check (at 20:45, 21:00):**

```bash
# 6. Confirm: Functions responding to requests
curl -X POST https://southamerica-east1-hmatologia2.cloudfunctions.net/submitNotivisaEvent \
  -H "Authorization: Bearer ${GOOGLE_OAUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"labId":"lab-001","event":{"type":"test"}}'

# Expected: HTTP 200, valid JSON response
```

**Sign-Off (at 21:10):**

```
Timestamp: 21:10 UTC-3
Status: ✓ COMPLETE / ✗ FAILED

If COMPLETE:
  DevOps: "All 78 functions deployed and warm. Ready for Step 3."
  QA: "Function tests passed. No execution errors."

If FAILED:
  DevOps: "Rollback in progress. [Reason: _______________]"
  Action: Restore previous functions from git, restart at 20:30

Signature: ________________  Time: __:__ UTC-3
```

---

### 21:10–21:40 UTC-3 — Step 3: Hosting (React App)

**Announcement:**

```
"Step 3 starting now. Hosting (React app) deploy in progress.
Expecting 30 min. Users may see old version until cache clears."

Time: 21:10
Task: Deploy React app to Firebase Hosting
Duration: 30 min (21:10–21:40)
Owner: DevOps lead
Success Criteria: app loads, no 404s, PWA SW refreshed
Rollback: restore previous hosting (< 5 min)
```

**Deploy Commands:**

```bash
# 1. Build React app
npm run build

# Expected:
# ✔ Build complete
# - app bundle: 362 KB
# - vendor bundle: 118 KB (portal-rt) + 125 KB (portal-paciente)
# No errors or warnings beyond baseline 88 warnings

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting --project hmatologia2

# Expected output:
# ✔ Deploy complete!
# Hosting URL: https://hmatologia2.web.app
```

**Validation (< 5 min):**

```bash
# 3. HTTP status check
curl -I https://hmatologia2.web.app/ | grep "200\|301\|302"

# Expected: HTTP 200 OK

# 4. App load test
curl https://hmatologia2.web.app/ \
  --compressed \
  --write-out '\nTime Total: %{time_total}s\n'

# Expected: <2s response time, HTML body received

# 5. Check for 404s (missing assets)
curl https://hmatologia2.web.app/ \
  --compressed \
  | grep -i "404\|not found" | wc -l

# Expected: 0 lines (no 404s)
```

**PWA Service Worker Update:**

```bash
# 6. Verify PWA service worker is updated
curl https://hmatologia2.web.app/sw.js | head -20

# Expected: Service worker code present, version updated

# User notice: "Please refresh your browser for latest version"
#             (auto-update via registerType: 'autoUpdate')
```

**Error Handling:**

```bash
# 7. If deployment fails:
#    a) Check error message
#    b) Ensure node_modules installed: npm ci
#    c) Retry build: npm run build
#    d) Retry deploy: firebase deploy --only hosting --project hmatologia2
#    e) If persists, rollback to previous commit
```

**Monitoring (continuous):**

```bash
# 8. Watch for hosting errors
gcloud logging read "resource.type=http_load_balancer & severity=ERROR" \
  --project hmatologia2 \
  --limit 50 \
  --format json | jq '.[] | select(.timestamp > "2026-08-31T21:10:00Z")'

# Expected: <5 errors (acceptable during cache clear)
```

**Status Check (at 21:25):**

```bash
# 9. Load Portal RT and Portal Paciente
#    - Open https://hmatologia2.web.app/portal-rt in browser
#    - Open https://hmatologia2.web.app/portal-paciente in browser
#    - Check DevTools Console for errors
#    - Verify: no red ✗ errors, only normal warnings

# Manual validation:
#   Portal RT:        "Loads without errors" ✓ / ✗
#   Portal Paciente:  "Loads without errors" ✓ / ✗
```

**Sign-Off (at 21:40):**

```
Timestamp: 21:40 UTC-3
Status: ✓ COMPLETE / ✗ FAILED

If COMPLETE:
  DevOps: "Hosting deployed, app loading, no 404s. Ready for Step 4."
  QA: "App loads without console errors. Clear to proceed."

If FAILED:
  DevOps: "Rollback in progress. [Reason: _______________]"
  Action: Restore previous build from git, restart at 21:10

Signature: ________________  Time: __:__ UTC-3
```

---

### 21:40–22:30 UTC-3 — Step 4: Production Smoke Tests

**Announcement:**

```
"Step 4 starting now. Running 8 critical E2E scenarios in production.
No changes made to system. Pure validation. 45 min expected."

Time: 21:40
Task: Execute 8 E2E critical flows + load test
Duration: 45 min (21:40–22:30)
Owner: QA lead
Success Criteria: 8/8 flows pass, load test p99 <2.5s, <1% error
Rollback: Not needed (read-only test phase)
```

**E2E Test Commands:**

```bash
# Run all 8 critical scenarios
cd src/__tests__
npm test -- --testNamePattern="Phase4.*Critical" --coverage=false

# Expected: 40 test cases pass (5 runs × 8 scenarios)
# Time: ~30 min

# Output format:
# ✓ Phase 4 Critical E2E: Patient auth → results view (5/5 pass)
# ✓ Phase 4 Critical E2E: RT dashboard → criticios (5/5 pass)
# ✓ Phase 4 Critical E2E: Critical result → NOTIVISA (5/5 pass)
# ✓ Phase 4 Critical E2E: Consent capture → audit (5/5 pass)
# ✓ Phase 4 Critical E2E: OCR extraction → validation (5/5 pass)
# ✓ Phase 4 Critical E2E: RT presence detection (5/5 pass)
# ✓ Phase 4 Critical E2E: LGPD rights request (5/5 pass)
# ✓ Phase 4 Load Test: 1000 users, p99 < 2.5s, <1% error (pass)
#
# Test Suites: 1 passed, 1 total
# Tests:       40 passed, 40 total
```

**Load Test:**

```bash
# Run concurrent load test (50 users for 2 min)
npm run test:load -- --users 50 --duration 120 --rampUp 30

# Expected:
# - Total requests: 2000+
# - Success rate: >99% (max 20 failures)
# - P50 latency: <1s
# - P95 latency: <2s
# - P99 latency: <2.5s (target)
# - Error rate: <1%

# Results summary:
# ✓ Load test PASSED
# p99: 2.3s (target: <2.5s) ✓
# Error rate: 0.8% (target: <1%) ✓
```

**Alert Policy Verification:**

```bash
# Test that alert policies fire correctly
# 1. Trigger A1 alert (error rate >5%)
#    - Create 100 failed requests
#    - Verify alert fires in Cloud Monitoring
#    - Time to alert: should be < 2 min

# 2. Trigger A3 alert (P99 latency >3s)
#    - Create 50 requests with 3.2s response time
#    - Verify alert fires
#    - Time to alert: should be < 2 min

# 3. Verify A4 alert (audit write failures)
#    - Simulate failed audit write
#    - Verify alert fires
#    - Time to alert: should be < 1 min

# Alert test results:
# A1 (error rate):      Fired in 1.2 min ✓
# A3 (P99 latency):     Fired in 1.5 min ✓
# A4 (audit write):     Fired in 45 sec ✓
```

**Real-World Validation:**

```
RT user (QA lead with RT credentials):
  - Login to Portal RT
  - View dashboard
  - View critical results
  - Check presence indicator shows "Online"
  - Take 2 screenshots for archive

Auditor user (on-call engineer with Auditor credentials):
  - Login to audit section
  - View compliance metrics
  - Check NOTIVISA queue status
  - Verify audit trail populated
  - Take 2 screenshots for archive

Patient user (test patient account):
  - Receive email-link
  - Click link
  - View results
  - Update consent preferences
  - Take 2 screenshots for archive

Results:
  RT validation:     ✓ PASS / ✗ FAIL
  Auditor validation: ✓ PASS / ✗ FAIL
  Patient validation: ✓ PASS / ✗ FAIL
```

**Error Handling:**

```bash
# 8. If any test fails:
#    a) Run that specific test in isolation
#    b) Check error message + logs
#    c) Determine: is this a system issue or test flake?
#    d) If system issue: escalate to CTO for go/no-go decision
#    e) If test flake: re-run 1 more time
```

**Sign-Off (at 22:30):**

```
Timestamp: 22:30 UTC-3
Status: ✓ COMPLETE / ✗ FAILED

If COMPLETE (all 8 flows + load test pass):
  QA Lead: "All 8 critical flows passing. Load test green. READY FOR OPERATIONS."
  CTO: "Phase 4 deployed successfully. Monitoring armed. All hands on deck for 48h."

If FAILED:
  CTO: "Critical issue detected. Escalating to war room.
        Options: 1) Fix + re-test, 2) Rollback to stable state."
  DevOps: "Rollback decision authority: CTO"

Signature: ________________  Time: __:__ UTC-3
```

---

## Post-Deployment (22:30 UTC-3 onwards)

### 22:30 UTC-3 — START 48-Hour Monitoring

**Announcement:**

```
"Deployment COMPLETE. Phase 4 now LIVE in production.
All monitoring systems armed. War room remains active for 48h.
Next standup in 6 hours (04:30 UTC-3 tomorrow)."
```

**Immediate Actions:**

```bash
# 1. Start automated monitoring script
bash scripts/monitor-cloud-logs.sh 48 30

# Script:
#  - Runs for 48 hours
#  - Polls Cloud Logs every 30 min
#  - Captures: error rate, P99 latency, function costs, audit completeness
#  - Outputs: .logs/monitoring-2026-08-31.log + .logs/metrics-2026-08-31.json

# 2. Manual spot checks (first 30 min)
#    - Error rate: __%
#    - P99 latency: __s
#    - Portal RT active users: __
#    - Portal Paciente consents captured: __
```

**Notification to Labs:**

```
Subject: v1.4 Production Launch — Phase 4 Live

Hi Labs,

HC Quality v1.4 is now live. No downtime occurred.

New features available:
- Patient portal (email-link authentication)
- NOTIVISA regulatory notification queue
- RT presence enforcement
- Laudo OCR with Gemini Vision

Training materials: https://hmatologia2.web.app/docs/phase4-guide

Support: engineering-team@hmatologia2.com

No action required. System operational.

—Engineering Team
```

**War Room Schedule (48h Monitoring):**

```
2026-08-31 22:30  Automated monitoring started
2026-09-01 04:30  Standup #1 (6h window) — Error rate, latency, any issues?
2026-09-01 10:30  Standup #2 (6h window) — DICQ tracking, audit trail completeness
2026-09-01 16:30  Standup #3 (6h window) — Cost tracking, user feedback summary
2026-09-01 22:30  Standup #4 (6h window) — 24h checkpoint, no critical issues?
2026-09-02 04:30  Standup #5 (6h window) — Final performance review
2026-09-02 22:30  END Monitoring — Closure tasks
```

---

### 48-Hour Monitoring Metrics

**Real-Time Metrics (captured every 30 min):**

| Metric        | Target               | Status | Notes               |
| ------------- | -------------------- | ------ | ------------------- |
| Error rate    | <0.1%                | ✓ / ✗  | Alert A1 if >5%     |
| P99 latency   | <3s                  | ✓ / ✗  | Alert A3 if >2.5s   |
| Availability  | >99.5%               | ✓ / ✗  | Check error budgets |
| Audit writes  | 100%                 | ✓ / ✗  | Alert A4 if <100%   |
| Function cost | $\_\_ (budget: $500) | ✓ / ✗  | Track spending      |

**Business Metrics (captured at key intervals):**

| Metric                   | Baseline | Phase 4 | Target | Notes               |
| ------------------------ | -------- | ------- | ------ | ------------------- |
| Portal RT active users   | —        | \_\_    | >5     | RT adoption         |
| Portal Paciente consents | —        | \_\_    | >80%   | LGPD compliance     |
| NOTIVISA submissions     | —        | \_\_    | 100%   | All events queue    |
| OCR accuracy             | —        | 94.7%   | >90%   | Gemini performance  |
| RT presence enforcement  | —        | \_\_    | 100%   | Art. 122 compliance |

---

## Contingency Responses

### If P0 Incident Occurs

**P0 Definition:** System unavailable >30 min OR data loss OR security breach

**Response (< 5 min):**

```
1. CTO calls war room: "All hands on deck. We have a P0."
2. On-call engineer: "What's the symptom?"
3. Triage (2 min):
   - Error rate spike? → Check Cloud Functions
   - Data missing? → Check Firestore backup
   - Auth broken? → Check JWT validation
   - API unresponsive? → Check Cloud Scheduler
4. Decision (3 min):
   - Fix forward: (if fixable in <30 min)
   - Rollback: (git reset --hard [STABLE_COMMIT])
5. Execute: (DevOps)
6. Validate: (QA)
7. Post-mortem: (within 24h)
```

**Rollback Procedure (<5 min total):**

```bash
# Step 1: Identify last stable commit
git log --oneline | head -5
# Pick commit before Phase 4 merge

# Step 2: Reset to stable state
git reset --hard [STABLE_COMMIT]

# Step 3: Redeploy in reverse order
firebase deploy --only firestore:rules --project hmatologia2     # 1 min
firebase deploy --only functions --project hmatologia2           # 2 min
firebase deploy --only hosting --project hmatologia2             # 1 min

# Step 4: Validate
firebase rules:test --project hmatologia2                        # 30 sec
curl https://hmatologia2.web.app/ | head -20                   # 5 sec

# Total: ~5 minutes to restore service
```

---

## Closure Tasks (after 48h monitoring)

### 2026-09-02 22:30 UTC-3

**Metrics Capture:**

```bash
# 1. Export all 48h monitoring data
cat .logs/metrics-2026-08-31.json | \
  jq '.[] | {time: .timestamp, error_rate: .error_pct, p99: .p99_latency, cost: .cost_usd}' > \
  ./docs/PHASE_4_DEPLOYMENT_METRICS_48H.json

# 2. Generate summary report
./scripts/gen-deployment-report.sh ./docs/PHASE_4_DEPLOYMENT_METRICS_48H.json > \
  ./docs/PHASE_4_DEPLOYMENT_REPORT_FINAL.md

# 3. Archive logs
tar czf ./archive/phase4-deployment-logs-2026-08-31.tar.gz .logs/

# 4. DICQ compliance measurement
firebase functions:call measureDICQCompliance --project hmatologia2 > \
  ./docs/PHASE_4_DICQ_COMPLIANCE_FINAL.json

# Expected: 80–82% (target +2–4 points)
```

**Lessons Learned Session:**

```
Participants: All 5 team members
Duration: 30 min
Questions:
  1. What went well? (2 items)
  2. What could be better? (2 items)
  3. Any surprises? (document if any)
  4. Action items for next phase? (max 3)

Output: docs/PHASE_4_DEPLOYMENT_RETROSPECTIVE.md
```

**Final Sign-Off:**

```
CTO: "Phase 4 deployed successfully. All metrics green. Ready to close."

Status: ✓ DEPLOYMENT SUCCESS / ✗ ISSUES FOUND (document details)

Signature: ________________________  Time: __:__ UTC-3
Date: 2026-09-02
```

---

## Archive & References

**This Schedule:** `docs/GO_LIVE_DAY_SCHEDULE_2026-05-20.md`

**Monitoring Script:**

- `scripts/monitor-cloud-logs.sh` (Bash)
- `scripts/monitor-cloud-logs.ps1` (PowerShell)

**Runbooks:**

- `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`
- `docs/INCIDENT_RESPONSE_PLAYBOOK_PHASE_4.md`

**Rollback Reference:**

- `.planning/milestones/DEPLOY_ROADMAP_v1.3.md` (previous successful deploy)

---

**Execution Status:**

- [ ] Pre-deployment checklist (18:00–20:00) — Complete?
- [ ] Step 1: Rules (20:00–20:30) — Complete?
- [ ] Step 2: Functions (20:30–21:10) — Complete?
- [ ] Step 3: Hosting (21:10–21:40) — Complete?
- [ ] Step 4: Smoke tests (21:40–22:30) — Complete?
- [ ] 48h monitoring started? (22:30)
- [ ] Closure tasks completed? (Sep 2, 22:30)

---

**Ready to Deploy.** 🚀

2026-08-31 20:00 UTC-3 — Go-live time
