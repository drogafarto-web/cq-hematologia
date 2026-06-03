---
title: Production Deployment Checklist — v1.4 GA
phase: 14
status: active
created: 2026-05-07
audience: ops-engineer, tech-lead
---

# Production Deployment Checklist — v1.4 GA

**Deployment Date:** [SPECIFY: YYYY-MM-DD HH:MM UTC]  
**Project:** hmatologia2  
**Region:** southamerica-east1  
**Expected Duration:** 10–15 minutes active | 45 minutes monitoring  
**Rollback Available:** YES (recovery time <5 min if needed)

---

## Pre-Deployment (3 hours before window)

### Git & Build Hygiene

- [ ] **Verify main branch status**

  ```bash
  git status
  # Expected: On branch main, nothing to commit, working tree clean

  git log --oneline -n 1
  # Expected: Latest commit is merged PR with all tests passing
  ```

- [ ] **Confirm all CI checks pass**
  - [ ] GitHub Actions workflow PASSED (latest run)
  - [ ] Lint: 0 errors (allow 88 pre-existing warnings)
  - [ ] TypeScript: 0 errors
  - [ ] Unit tests: 738/738 passing

- [ ] **No untracked secrets**
  ```bash
  bash scripts/preflight-secrets-check.sh
  # Expected: All 6 secrets ACTIVE (GEMINI, RESEND, NOTIVISA, TWILIO×2, HMAC)
  # If any PENDING_SET → ABORT, provision secret first
  ```

### Build Validation

- [ ] **Local build succeeds**

  ```bash
  npx tsc --noEmit
  npm run build
  # Expected: No errors, Hosting bundle <500KB gzip

  npm run lint
  # Expected: 0 errors
  ```

- [ ] **Bundle size check**
  ```bash
  npm run analyze
  # Opens dist/stats.html
  # Verify: Main chunk <400KB gzip (if larger, investigate code splitting)
  ```

### Test Execution (Staging)

- [ ] **Unit tests on staging**

  ```bash
  npm run test:unit
  # Expected: 738/738 passing
  ```

- [ ] **Smoke tests on staging**

  ```bash
  npm run test:smoke:staging
  # Expected: All 25 modules + 5 critical paths PASS
  # If any failure: ABORT, investigate + fix
  ```

- [ ] **Load test on staging**
  ```bash
  bash scripts/load-test-phase-14.sh
  # Expected: P99 latency <2.5s, error rate <1%
  # If failed: ABORT, optimize before deploy
  ```

### Production Readiness

- [ ] **Verify production Firebase project**

  ```bash
  firebase projects:list
  # Confirm: hmatologia2 (default)

  firebase use hmatologia2
  # Set active project

  firebase apps:list
  # Verify: Web app (apiKey: AIza...) registered
  ```

- [ ] **Verify production secrets**

  ```bash
  firebase functions:secrets:list --project hmatologia2
  # Expected: All 6 secrets ACTIVE, no PENDING_SET
  # Check: Last rotation date (should be <90 days)
  ```

- [ ] **Verify production Firestore**

  ```bash
  firebase firestore:indexes --project hmatologia2
  # Expected: All indexes ENABLED (or CREATING if recent change)
  ```

- [ ] **Cloud Logs baseline**
  ```bash
  gcloud functions logs read --project hmatologia2 --limit 100
  # Save this output for comparison post-deploy
  ```

### Stakeholder Notification

- [ ] **Send pre-deployment email**

  ```
  To: CTO, RT lead, lab directors, auditor
  Subject: v1.4 Production Deployment — [DATE] [TIME UTC]

  Content:
  - Launch time: [DATE HH:MM UTC]
  - Expected downtime: 0 minutes (zero-downtime deploy)
  - Key features launching:
    * Portal ecosystem (RT medical + patient external access)
    * NOTIVISA integration (Art. 6º §1)
    * Critical value escalation (SMS/email)
    * CAPA closure workflow
  - Compliance readiness: DICQ 88% + RDC 978 critical articles 100%
  - If issues: Rollback available within 5 minutes

  Rollback plan: docs/rollback-procedures/ROLLBACK_CHECKLIST.md
  Incident escalation: [Slack #incident] or [Page on-call]
  ```

- [ ] **Post in #announcements Slack**

  ```
  🚀 v1.4 GA deployment starting in [TIME]
  Features: Portal, NOTIVISA, Critical Values, CAPA
  Impact: None expected (zero-downtime)
  Status page: [link to monitoring dashboard]
  ```

- [ ] **Notify lab support team**
  ```
  "v1.4 goes live [TIME UTC]. Users may see new portal feature.
   If login issues: Ctrl+Shift+R (hard reload).
   Contact ops if problems persist."
  ```

---

## Deployment Window (60 minutes)

**Start time:** [EXACT UTC TIME]  
**Go/No-Go decision:** T-2 minutes  
**Expected end time:** T+50 minutes (with 10 min buffer)

### T-2 Minutes: Final Go/No-Go

**Checklist before proceeding:**

- [ ] All pre-deployment checks above are DONE
- [ ] CTO has approved deployment (Slack confirmation)
- [ ] Staging environment is green (load test passed)
- [ ] No active incidents in production
- [ ] On-call team standing by
- [ ] All team members who will monitor are in Slack war room

**Decision:**

```
[ ] GO — Proceed to deployment
[ ] NO-GO — Cancel and reschedule
    Reason: _________________________________
```

### T+0 Minutes: Deploy Firestore Rules & Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes \
  --project hmatologia2
```

**Expected:**

- Output: ✓ rules deployed, ✓ indexes updated
- Duration: 30–60 seconds
- No user-facing impact (rules applied immediately)

**Monitor immediately:**

```bash
# Watch for PermissionDenied errors
gcloud functions logs read \
  --project hmatologia2 \
  --limit 50 \
  --follow

# Expected: 0 PermissionDenied errors in first 1 minute
```

**Go/No-Go checkpoint:**

- [ ] Rules deployed successfully
- [ ] No cascade of PermissionDenied errors
- [ ] Users can still access their modules (sanity check: test user logs in)

**If failure:**

- [ ] Rollback: `git checkout v1.3 -- firestore.rules && firebase deploy --only firestore:rules`
- [ ] Wait 2 minutes for rules to propagate
- [ ] ABORT deployment, investigate root cause

---

### T+1 Minute: Deploy Cloud Functions

```bash
cd functions
npm run build
cd ..

firebase deploy --only functions \
  --project hmatologia2
```

**Expected:**

- Output: ✓ 75+ functions deployed
- Duration: 3–5 minutes
- No errors during deployment

**Monitor during deployment:**

```bash
# Every 30s, check Cloud Logs for errors
watch -n 30 'gcloud functions logs read --project hmatologia2 --limit 10'
```

**Expected logs:**

```
[Cloud Functions] Deployment started
[Cloud Functions] Function abc deployed
...
[Cloud Functions] All functions deployed successfully
```

**Go/No-Go checkpoint (T+5):**

- [ ] All functions deployed (check: firebase deploy output says "Deploy complete!")
- [ ] No timeouts or compilation errors
- [ ] Cloud Logs show no Error or Critical messages

**If failure:**

- [ ] Check specific error in logs: `gcloud functions logs read`
- [ ] If missing secret: `firebase functions:secrets:set NAME`
- [ ] If dependency missing: `cd functions && npm install && npm run build`
- [ ] If logic error: rollback `git checkout v1.3 -- functions/`
- [ ] Redeploy and verify

---

### T+6 Minutes: Invalidate Hosting CDN Cache

```bash
gcloud compute url-maps invalidate-cdn-cache web-app-cache \
  --path "/*" \
  --project hmatologia2
```

**Expected:**

- Invalidation request queued
- Duration: <1 second to queue, 1–2 minutes to propagate globally

---

### T+7 Minutes: Deploy Web Hosting

```bash
firebase deploy --only hosting --project hmatologia2
```

**Expected:**

- Output: ✓ bundle deployed, ✓ live at https://hmatologia2.web.app
- Duration: 2–3 minutes
- Users see new PWA bundle after CDN propagation

**Monitor:**

```bash
# Verify site loads
curl -I https://hmatologia2.web.app
# Expected: HTTP 200

# Check for errors
gcloud functions logs read --project hmatologia2 --limit 20
```

**Go/No-Go checkpoint (T+10):**

- [ ] Hosting deployment complete
- [ ] Website responsive at https://hmatologia2.web.app
- [ ] No 5xx errors in first requests

---

### T+10 Minutes: Smoke Test in Production (5 min)

**Critical flow sanity check:**

- [ ] **Open browser (incognito, Ctrl+Shift+R)**

  ```
  URL: https://hmatologia2.web.app
  Expected: Site loads in <2s, no errors in console (F12)
  ```

- [ ] **Login as test user**

  ```
  Email: testops@lab1.local
  Password: [from secrets manager]
  Expected: Redirect to dashboard, no "Permission Denied" error
  ```

- [ ] **Create CIQ run (quick smoke)**

  ```
  Navigate: Hub → Analyzer
  Action: Create new CIQ run
  Expected: Success, run ID generated, no errors
  ```

- [ ] **Verify audit trail**

  ```
  Navigate: Hub → Auditoria
  Action: Look for "testops" entries from 2 min ago
  Expected: Entry visible with operator=testops, signature valid
  ```

- [ ] **Check API health**
  ```
  curl https://hmatologia2.web.app/api/health
  Expected: { "status": "ok", "version": "1.4.0" }
  ```

**If any failure:**

- [ ] **P1 response:** Initiate rollback immediately (Section: "Rollback Procedure")
- [ ] **P2/P3 response:** Note issue, continue monitoring 45 min, then decide

---

## Post-Deployment Monitoring (45 minutes)

### T+15 to T+20 Minutes: Error Rate Check

```bash
# Count errors in first 10 minutes after deploy
gcloud functions logs read \
  --project hmatologia2 \
  --format="table(severity,message)" \
  --limit 100

# Expected: 0 errors OR <0.5% error rate
```

**Thresholds that trigger rollback:**

| Metric             | Threshold      | Action                    |
| ------------------ | -------------- | ------------------------- |
| Errors/min         | >10            | ROLLBACK immediately      |
| 5xx responses      | >5%            | ROLLBACK immediately      |
| Latency p99        | >3s            | Monitor, decide in 15 min |
| Module unavailable | Any 1+ modules | ROLLBACK immediately      |

---

### T+20 to T+40 Minutes: Continuous Monitoring

**Every 10 minutes, check:**

```bash
# Run monitoring script
bash scripts/monitor-cloud-logs.sh 30 5
# Monitors for 30s, checks every 5s for new errors
```

**Expected output (good):**

```
[OK] No errors detected
[OK] Latency distribution normal
[OK] No cascading failures
[OK] All functions responding
```

**Expected output (needs investigation):**

```
[WARNING] 5 errors in last 10 min (still <1% rate) — monitor
[WARNING] p99 latency 2.8s (elevated but <3s) — acceptable
[ERROR] 50+ errors — ROLLBACK
[ERROR] 503 rate spike — check quota
```

**During this window, also:**

- [ ] **User-facing checks** (every 10 min)
  - [ ] Can login? (test account)
  - [ ] Can create CIQ run? (analyzer module)
  - [ ] Can download result? (portal feature)
  - [ ] Check browser console (F12) for JS errors

- [ ] **Stakeholder comms**
  - [ ] Post to #announcements: "✓ v1.4 live, all systems nominal"
  - [ ] Email lab directors: "Deployment successful, new features live"

---

### T+40 to T+45 Minutes: Final Sign-Off

**Before signing off, verify:**

- [ ] **Zero critical errors** in past 20 minutes
- [ ] **P99 latency <2.5s** (or documented baseline)
- [ ] **Error rate <1%**
- [ ] **All 25 modules accessible** (smoke test modules one more time)
- [ ] **No cascading failures** (one error didn't cascade to others)

**Sign-off decision:**

```
[ ] ✓ PRODUCTION GA — All metrics green, systems nominal
    Signed: _________________ Date/Time: _________

[ ] ⚠ MONITORING — Elevated metrics, watching closely
    Issue: _________________________________
    Recheck at: T+60 min

[ ] ✗ ROLLBACK — Metrics outside tolerance, initiating rollback
    Issue: _________________________________
    Rollback started: _________
```

---

## Rollback Procedure (If Needed)

**Trigger:** Any P1 metric breached OR CTO decision

### Step 1: Immediate Hosting Rollback (2 minutes)

```bash
# Find previous deploy hash
firebase hosting:releases --project hmatologia2 | head -5
# Look for second-most-recent release

# Rollback to previous version
firebase hosting:channels:deploy previous \
  --project hmatologia2
```

**Result:** Users get v1.3 bundle immediately (after hard reload).

### Step 2: Functions Rollback (If Needed)

```bash
# If functions are causing issues (not hosting)
git checkout v1.3 -- functions/
npm run build
firebase deploy --only functions --project hmatologia2
```

### Step 3: Firestore Rules Rollback (If Needed)

```bash
# If rules are broken (not functions/hosting)
git checkout v1.3 -- firestore.rules
firebase deploy --only firestore:rules --project hmatologia2
```

### Step 4: Verify Rollback Successful

```bash
# Check site loads with v1.3
curl -I https://hmatologia2.web.app

# Verify no new errors
gcloud functions logs read --project hmatologia2 --limit 10

# Users should hard reload (Ctrl+Shift+R)
```

### Step 5: Incident Communication

```
[ROLLBACK] v1.4 rolled back to v1.3

Reason: [Brief description]
Time: [UTC timestamp]
Services: [Rules|Functions|Hosting] reverted
Impact: Users may see cached v1.4 PWA (hard reload needed)
ETA to v1.4 fix: [TIME]

Engineering: Root cause analysis starting
Lab teams: Contact ops if issues persist
```

---

## Post-Mortem (If Rollback Occurred)

**Within 24 hours of rollback:**

- [ ] **Root cause identified** — What failed and why?
- [ ] **Fix prepared** — Committed to feature branch
- [ ] **Fix tested** — Unit + smoke tests PASS on staging
- [ ] **Fix reviewed** — CTO + tech lead approved
- [ ] **Retry scheduled** — Next deployment window booked
- [ ] **Communication sent** — "Root cause identified, fix ready, retry scheduled"

---

## Deployment Success Criteria

**Phase 14 deployment is considered successful if:**

- ✅ All 3 components deployed (rules, functions, hosting)
- ✅ Zero critical errors in first 45 minutes
- ✅ All 25 modules accessible
- ✅ P99 latency <2.5s
- ✅ Error rate <1%
- ✅ Audit trail records all operations
- ✅ No user lockouts or permission issues
- ✅ Lab directors confirm features working
- ✅ Auditor pre-alignment validated
- ✅ On-call team standing by for 72 hours

---

## Approval & Sign-Off

**Deployment approved by:**

- [ ] **CTO:** ********\_******** Date: ****\_**** Time: ****\_****
- [ ] **Tech Lead:** ********\_******** Date: ****\_**** Time: ****\_****
- [ ] **Ops Lead:** ********\_******** Date: ****\_**** Time: ****\_****

**Deployment executed by:**

- **Ops Engineer:** ********\_******** Date: ****\_**** Time: ****\_****

**Monitoring responsibility:**

- **Primary (0–45 min):** ********\_******** (on-call engineer)
- **Secondary (45–72h):** ********\_******** (on-call engineer)

---

## Quick Reference: Command Checklist

```bash
# Pre-flight
bash scripts/preflight-secrets-check.sh
npm run typecheck
npm run build
npm run test:unit
npm run test:smoke:staging
bash scripts/load-test-phase-14.sh

# Deploy rules
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# Deploy functions
cd functions && npm run build && cd ..
firebase deploy --only functions --project hmatologia2

# Deploy hosting
firebase deploy --only hosting --project hmatologia2

# Monitor
gcloud functions logs read --project hmatologia2 --follow
bash scripts/monitor-cloud-logs.sh 30 5

# Rollback (if needed)
git checkout v1.3 -- firestore.rules functions/
npm run build
firebase deploy --only firestore:rules,functions --project hmatologia2
```

---

## Contacts & Escalation

**On-call engineer:** [Phone/Slack/PagerDuty link]  
**Tech lead:** [Phone/Slack link]  
**CTO:** [Phone/Slack link]  
**Lab support:** [Slack #support channel]  
**Firebase support:** [GCP support ticket link]

**Incident comms:** Slack #incident  
**Status page:** [link if applicable]

---

## Deployment Notes

Use this section to document actual deployment details:

```
Start time: ________________________ UTC
End time: ________________________ UTC

Actual issues encountered:
_________________________________________________________________
_________________________________________________________________

Deviations from checklist:
_________________________________________________________________

Lessons learned:
_________________________________________________________________

Next deployment improvements:
_________________________________________________________________
```

---

**Document version:** 1.0  
**Last updated:** 2026-05-07  
**Next review:** After first production deployment (2026-08-30)
