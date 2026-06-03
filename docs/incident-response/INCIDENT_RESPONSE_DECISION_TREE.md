---
title: Incident Response Decision Tree
phase: 14
status: active
created: 2026-05-07
---

# Incident Response Decision Tree — v1.4 Production

This document provides a structured decision flow for diagnosing and responding to production incidents post-launch. Use this to classify severity, identify root cause, and determine recovery path (fix vs. rollback).

---

## Quick Triage (First 2 Minutes)

### Step 1: Determine Severity

```
INCIDENT DETECTED
    ↓
    [Is system completely down?]
    ├─ YES → P1 (Critical) — Go to Section 2.1
    ├─ NO → [Are >100 users affected?]
    │       ├─ YES → P2 (High) — Go to Section 2.2
    │       └─ NO → [Is there data loss risk?]
    │               ├─ YES → P2 (High) — Go to Section 2.2
    │               └─ NO → P3 (Medium) — Go to Section 2.3
    └─ [Time from incident report to classification] = <2 min
```

### Step 2: Determine Error Class

**Look at error message / Cloud Logs entry:**

```
"PermissionDenied"           → Firestore Rules issue (Section 3.1)
"UNAUTHENTICATED"            → Auth token invalid (Section 3.2)
"503 Service Unavailable"    → Quota exceeded or overload (Section 3.3)
"TimeoutError: >30s"         → Function timeout (Section 3.4)
"ReferenceError: X not def." → Missing dependency/secret (Section 3.5)
"Execution error in trigger" → Firestore trigger/function failure (Section 3.6)
"Network error / ERR_NAME_NOT_RESOLVED" → Third-party service down (Section 3.7)
"Out of memory / segfault"   → Memory leak or data explosion (Section 3.8)
```

**Document immediately:**

- [ ] Exact error message (screenshot or log line)
- [ ] Affected module (e.g., analyzer, laudo, portal)
- [ ] Time of first report
- [ ] Number of affected users (estimate)
- [ ] Is error reproducible? (always / sometimes / intermittent)

---

## Incident Severity Levels

### P1: Critical — System Down

**Definition:** System unavailable for >5 minutes OR data loss risk active.

**Immediate actions:**

1. **Page on-call engineer** (if not already responding)
2. **Notify stakeholders** (lab directors, CTO) — use #incident Slack channel
3. **Start incident log** — timestamp all actions
4. **Decision point:** Can you fix in <5 min? (Hotfix) OR Rollback?
   - YES → Proceed to hotfix (Section 4)
   - NO → Prepare rollback (Section 5)

**SLA:** Response <5 min, resolution <30 min

**Examples:**

- Firestore completely down (Firebase issue)
- All Cloud Functions returning 500 for >5 min
- Data corruption detected (e.g., wrong patient data served)
- Database unable to accept writes (quota exceeded, disk full)

---

### P2: High — Feature Unavailable

**Definition:** Feature unavailable for >15 min OR >100 users affected OR workaround doesn't exist.

**Immediate actions:**

1. **Alert on-call** (normal priority)
2. **Notify feature owner** (team lead)
3. **Start triage** — identify root cause
4. **Decision point:** Hotfix vs. Rollback vs. Degrade
   - Hotfix viable? → Fix + test (30-45 min)
   - Rollback viable? → Prepare rollback (5-10 min)
   - Degrade viable? → Disable feature, serve v1.3 fallback (5 min)

**SLA:** Response <15 min, resolution <1 hour

**Examples:**

- Laudo generation failing 100% (either all fail or all succeed)
- Portal login broken for all patient users
- NOTIVISA submissions all queued, processor hung
- CIQ run creation returning validation errors for all equipment

---

### P3: Medium — Degraded Feature

**Definition:** Feature partially broken (<50% success) OR performance degraded >50% OR <100 users affected.

**Immediate actions:**

1. **Log incident** (for audit trail)
2. **Monitor trend** — is error rate increasing or stable?
3. **Notify team** (no page required)
4. **Decision point:** Fix within business hours vs. defer
   - Fix in progress? → Implement + test
   - Defer to next sprint? → Document, schedule for next release

**SLA:** Response <1 hour, resolution <24 hours

**Examples:**

- Slow PDF generation (5s→15s, but working)
- Audit trail writes occasionally missing timestamps
- Portal search filtering inconsistent
- Analytics dashboard slow to load (but still responsive)

---

### P4: Low — Non-Critical Bug

**Definition:** Cosmetic issue, workaround exists, no user-facing impact.

**Immediate actions:**

1. **Document** in backlog
2. **Schedule for next sprint**
3. **No urgent response required**

**Examples:**

- Typo in UI label
- Icon not rendering (but button still functional)
- Chart colors slightly off
- Email template formatting issue

---

## Root Cause Analysis By Error Type

### 3.1 Firestore Rules Error: PermissionDenied

**What it means:** Request to read/write a document was blocked by Firestore Rules.

**Decision tree:**

```
PermissionDenied in Cloud Logs
    ↓
    [Check the path that was denied]
    ├─ Path looks wrong (e.g., /labs/wrong-lab/...)?
    │  └─ Check: Is user in correct lab?
    │     ├─ NO → User not provisioned for this lab (auth issue, not rules)
    │     └─ YES → Bug in app logic (sending wrong labId)
    │
    ├─ Path looks right (e.g., /labs/lab-1/ciq/run-123)?
    │  └─ Check: Does user's claims include "ciq" module?
    │     ├─ NO → Run `provisionModulesClaims({ dryRun: false })`
    │     │       Wait 5 min for token refresh
    │     │       Retry request
    │     └─ YES → Check rules file for logic error
    │             grep -n "match /labs/{labId}/ciq" firestore.rules
    │             Review: isActiveMemberOfLab(labId) check
    │             Review: module access check
    │
    └─ Admin operation (editing rules, writing to admin collection)?
       └─ Check: Is user isSuperAdmin?
          ├─ NO → Insufficient permissions (expected behavior)
          └─ YES → Check rules for admin bypass
                  grep "isSuperAdmin" firestore.rules
```

**Common causes & fixes:**

| Root Cause                    | Indicator                                                        | Fix                                           |
| ----------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| User not active in lab        | User recently added, not in members doc                          | Re-provision in admin panel                   |
| Module claims not provisioned | Error appears for all users in lab                               | Run `provisionModulesClaims` callable         |
| Rules version mismatch        | Rules changed but not deployed                                   | `firebase deploy --only firestore:rules`      |
| Buggy rule expression         | Only specific operation fails (e.g., create works, update fails) | Review rules file, test locally with emulator |
| Cross-lab access attempt      | Error for user accessing different lab                           | Check app logic — ensure labId param correct  |

**Recovery:**

```bash
# Option 1: Provision claims (if missing)
firebase functions:call provisionModulesClaims \
  --project hmatologia2

# Option 2: Re-deploy rules (if out of sync)
firebase deploy --only firestore:rules \
  --project hmatologia2

# Option 3: Restart user session (refresh token)
# Ask user to logout + login

# Option 4: Rollback rules (if bug introduced)
git checkout v1.3 -- firestore.rules
firebase deploy --only firestore:rules \
  --project hmatologia2
```

**When to escalate:** If error persists after claims provisioned + 10 min, escalate to CTO.

---

### 3.2 Authentication Error: UNAUTHENTICATED

**What it means:** Request is missing valid authentication token or token is expired.

**Decision tree:**

```
UNAUTHENTICATED in Cloud Logs
    ↓
    [Is this a user-facing error or backend error?]
    ├─ User sees "Login Required" → Expected (user session expired)
    │  └─ Ask user to refresh browser (Ctrl+Shift+R) and login again
    │
    ├─ Error in Cloud Function callable → Function not checking auth
    │  └─ Review function code for missing `functions.identity()`
    │     Check: Does function expect authenticated request?
    │     Action: Add `request.auth != null` check or make callable public
    │
    └─ Error in client SDK call → Token validation failed
       └─ Check: Firebase config correct?
          Check: Is user logged in? (check useAuthStore)
          Action: Clear localStorage, logout, re-login
```

**Common causes & fixes:**

| Cause                                 | Fix                                              |
| ------------------------------------- | ------------------------------------------------ |
| PWA cached old auth config            | Hard reload (Ctrl+Shift+R)                       |
| Firebase SDK mismatch                 | Ensure firebase package.json version is ^10.14.1 |
| Multiple tabs with different sessions | Logout everywhere, login once                    |
| Token expired (idle >1h)              | Logout + login                                   |

**Recovery:**

```bash
# Option 1: Ask user to hard reload + re-login
# (No action needed from ops)

# Option 2: Clear Firebase cache (if widespread)
# Via Firebase Console → Auth → Delete test users
# Then re-provision test accounts

# Option 3: Check Firebase Auth is healthy
# Go to Firebase Console → Authentication
# Verify: Email/password provider enabled
# Verify: No unusual sign-in activity
```

**When to escalate:** If ALL users see UNAUTHENTICATED (not just one), check Firebase Auth status.

---

### 3.3 Quota Exceeded: 503 Service Unavailable

**What it means:** System is overloaded or Firebase quota exceeded.

**Decision tree:**

```
503 Overload / Quota
    ↓
    [Which service is returning 503?]
    ├─ Firestore read/write quota → Firebase billing issue
    │  └─ Check: Cloud Console → Firestore → Quotas & Limits
    │     Check: Does quota show 100%?
    │     Action: Upgrade billing tier or wait for quota reset (daily at midnight UTC)
    │
    ├─ Cloud Functions invocations → Too many concurrent calls
    │  └─ Check: Cloud Logs → function invocation count
    │     Decision: Is load legitimate (100+ users) or DDoS?
    │     Action: Wait for load to subside, or enable Cloud Armor (firewall)
    │
    ├─ Firestore storage quota → Database full
    │  └─ Check: Cloud Console → Firestore → Storage
    │     Check: Is usage >100GB or close to project limit?
    │     Action: Contact Firebase support or export/delete old data
    │
    └─ Third-party API → GEMINI, TWILIO, RESEND quota
       └─ Check: Cloud Logs for error: "quota_exceeded"
          Action: Check billing in respective service (console.cloud.google.com, Twilio, Resend)
```

**Common causes & fixes:**

| Cause                         | Indicator                             | Fix                                                                     |
| ----------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Firestore read quota exceeded | Error: "too many concurrent requests" | Upgrade billing tier, optimize queries                                  |
| Load testing on production    | Spike from 10 req/s to 1000 req/s     | Stop test, wait 1-2 min for quota reset                                 |
| Gemini Vision quota maxed     | PDF generation all failing            | Check Gemini API quota, switch to cheaper model or implement rate limit |
| NOTIVISA queue explosion      | 10,000+ docs in notivisa-outbox       | Pause processor, implement backoff, fix root cause                      |

**Recovery:**

```bash
# Option 1: Wait for quota reset (midnight UTC)
# Monitor: error rate should drop to <1% after reset

# Option 2: Reduce load (if under your control)
# Pause batch jobs, disable non-critical features

# Option 3: Upgrade billing tier (if frequent)
# Firebase Console → Settings → Billing → Upgrade to Blaze pay-as-you-go

# Option 4: Implement circuit breaker
# If 10 consecutive failures, reject new requests with 503 + retry-after header
# Wait 30s, then allow requests again
```

**When to escalate:** If quota exceeded >2 hours continuously, escalate to CTO for capacity planning.

---

### 3.4 Cloud Function Timeout

**What it means:** Function execution exceeded 540-second hard limit (or callable timeout exceeded).

**Decision tree:**

```
Timeout Error (>30s for callable, >540s for background function)
    ↓
    [Is this a one-time timeout or systematic?]
    ├─ One-time (isolated incident) → Retry, likely transient
    │  └─ Check: Was load high at that moment?
    │     Action: Recommend user retry (it will likely work)
    │
    ├─ Systematic (happens every time) → Logic is too slow
    │  └─ Check: Cloud Logs for function execution time
    │     Identify: Which part is slow? (query? PDF generation? API call?)
    │     Action: Optimize + deploy hotfix
    │
    └─ Background job (scheduled function) → Needs optimization
       └─ Check: Job size — how many documents processed?
          Action: Implement pagination, split into smaller batches
```

**Common causes & fixes:**

| Function           | Typical Cause                     | Fix                                     |
| ------------------ | --------------------------------- | --------------------------------------- |
| `generateLaudo`    | Large PDF with 100+ images        | Reduce image quality, compress PDFs     |
| `submitToNotivisa` | NOTIVISA API slow (>10s per call) | Implement timeout + queue retry         |
| `analyzeCIQImage`  | Gemini Vision taking >30s         | Batch smaller images, use cheaper model |
| Scheduled backup   | 500,000+ documents to backup      | Implement pagination + parallel workers |

**Recovery:**

```bash
# Option 1: Optimize the function
cd functions
# Edit src/laudo.ts → reduce PDF image quality
# Or edit src/gemini.ts → implement timeout + fallback
npm run build
firebase deploy --only functions:generateLaudo

# Option 2: Increase timeout (temporary)
# Edit functions/src/index.ts:
#   functions.runWith({ timeoutSeconds: 540 })
# (Note: 540s is the hard limit for Cloud Functions)

# Option 3: Implement background job
# Move to Cloud Tasks instead of callable:
#   - Client submits job request
#   - Cloud Task queues work
#   - Background worker processes in background (no timeout)
```

**When to escalate:** If hotfix not viable in <15 min, rollback + schedule proper fix.

---

### 3.5 Missing Dependency or Secret

**What it means:** Function tries to import/use something that doesn't exist.

**Decision tree:**

```
ReferenceError: X is not defined
    ↓
    [What is X?]
    ├─ X is a module import (e.g., "signImage" not found)
    │  └─ Check: package.json — is dependency listed?
    │     Action: npm install <package> && npm run build && firebase deploy
    │
    ├─ X is an environment variable or secret (e.g., GEMINI_API_KEY)
    │  └─ Check: `firebase functions:secrets:list`
    │     Action: `firebase functions:secrets:set GEMINI_API_KEY`
    │     Then redeploy
    │
    └─ X is a function or utility (e.g., "validateSignature")
       └─ Check: Did recent commit delete this function?
          Action: `git log --oneline | head -5` → revert if needed
```

**Recovery:**

```bash
# Option 1: Install missing dependency
npm install some-package
npm run build
firebase deploy --only functions

# Option 2: Provision missing secret
firebase functions:secrets:set GEMINI_API_KEY
# (Paste the key when prompted)
firebase deploy --only functions

# Option 3: Revert recent commit
git revert <commit-hash>
npm run build
firebase deploy --only functions
```

**When to escalate:** If secret not available, check `scripts/preflight-secrets-check.sh` output.

---

### 3.6 Firestore Trigger Failure

**What it means:** A document write triggered a Cloud Function, but the function failed.

**Decision tree:**

```
Execution error in trigger (onWrite, onDelete)
    ↓
    [Check Cloud Logs for trigger error message]
    ├─ Error in user data validation → User submitted bad data
    │  └─ Check rules to ensure validation is strict
    │     Action: Tighten rules to prevent bad data from entering
    │
    ├─ Error in downstream operation (e.g., calling Gemini) → Transient failure
    │  └─ Check: Is the API (Gemini, NOTIVISA) up?
    │     Action: Implement retry logic in trigger
    │
    ├─ Error in audit trail write → Audit collection misconfigured
    │  └─ Check: Does audit subcollection exist?
    │     Action: Manually create subcollection or fix trigger code
    │
    └─ Trigger is looping infinitely → Update triggers write to same collection
       └─ Check: Is trigger updating the document it triggered on?
          Action: Refactor to break the loop (e.g., write to different collection)
```

**Recovery:**

```bash
# Option 1: Fix trigger logic
# Edit functions/src/triggers.ts
# Test locally with emulator:
firebase emulators:exec --only firestore "npm test"
npm run build
firebase deploy --only functions

# Option 2: Disable trigger temporarily
# Comment out the function registration:
# export const onLaudoCreated = functions.firestore...
# Deploy, then manually investigate

# Option 3: Replay missed events
# If trigger failed silently, documents are stuck
# Manual fix: Update document manually to retrigger
# Or write one-off script to process backlog
```

**When to escalate:** If trigger causing data corruption (e.g., audit trail entries duplicated), stop all writes + investigate.

---

### 3.7 Third-Party Service Down

**What it means:** Call to external API (Gemini, NOTIVISA, Twilio, Resend) is failing.

**Decision tree:**

```
Network error / API error from third party
    ↓
    [Which service?]
    ├─ Gemini Vision API (PDF/image analysis)
    │  └─ Check: https://status.cloud.google.com (Google API status)
    │     Check: Is quota exceeded? (console.cloud.google.com)
    │     Action: Implement fallback (use cached results or skip analysis)
    │
    ├─ NOTIVISA (regulatory notification)
    │  └─ Check: Is NOTIVISA API up? (check their status page)
    │     Check: Is auth token still valid?
    │     Action: Queue will retry automatically; monitor backlog
    │
    ├─ Twilio SMS (critical value alert)
    │  └─ Check: Twilio account status (console.twilio.com)
    │     Check: Is phone number valid? (correct country code?)
    │     Action: Fallback to email notification (send via Resend)
    │
    └─ Resend Email (notifications, invites)
       └─ Check: Resend status (resend.com/status)
          Check: Is sender email verified?
          Action: Implement retry queue
```

**Recovery:**

```bash
# Option 1: Use fallback service
# If Gemini down → use cached results from last successful run
# If Twilio down → send email instead of SMS
# If Resend down → queue email, retry in 1h

# Option 2: Implement circuit breaker
# If 5 consecutive failures to service → assume down
# Return degraded response (e.g., "notification pending")
# Retry in background after 5 min

# Option 3: Monitor 3rd-party status
# Set up alerting for status page changes
# Notify on-call when service is degraded

# Option 4: Contact third-party support
# If outage >15 min, file incident ticket
# Get ETA for recovery
```

**When to escalate:** If third-party outage affecting production SLA, notify affected labs immediately.

---

### 3.8 Memory Leak / Out of Memory

**What it means:** Cloud Function process consumed >4GB RAM and crashed.

**Decision tree:**

```
Out of memory / Segmentation fault
    ↓
    [Which function?]
    ├─ PDF generation (generateLaudo, exportResults)
    │  └─ Cause: Large images or too many images in PDF
    │     Action: Reduce image resolution, compress before PDF
    │
    ├─ Image analysis (analyzeCIQImage, imageRecognition)
    │  └─ Cause: Loading full-resolution image into memory
    │     Action: Resize image before processing, use streaming
    │
    ├─ Batch data processing (backupData, exportBatch)
    │  └─ Cause: Loading entire dataset into memory at once
    │     Action: Process in chunks/pages, delete intermediate results
    │
    └─ Machine learning model (trainImageClassifier)
       └─ Cause: Model too large or training data too big
          Action: Use smaller model, implement streaming batches
```

**Recovery:**

```bash
# Option 1: Reduce memory usage in code
# Edit functions/src/pdf.ts:
#   - Change: const img = sharp(data).resize(...)
#   - Add: .resize(500, 500) to reduce size
#   - Add: .toBuffer() to stream instead of loading all at once
npm run build
firebase deploy --only functions

# Option 2: Implement pagination
# For batch operations:
#   - Query first 1000 documents
#   - Process batch
#   - Delete from memory
#   - Loop until all processed

# Option 3: Increase function memory allocation
# Edit functions/firebase.json:
#   "memoryMB": 4096  (default)
#   → "memoryMB": 8192 (double)
# Note: Higher memory also increases cost
npm run build
firebase deploy --only functions
```

**When to escalate:** If OOM happening repeatedly, implement fundamental redesign (e.g., use Cloud Storage for temp files instead of memory).

---

## Hotfix Workflow (Decision → Deploy → Monitor)

**Use this when:** P1/P2 incident can be fixed in <15 minutes.

### Step 1: Prepare Hotfix

```bash
# Create feature branch
git checkout -b hotfix/issue-name

# Make minimal change
# (single file if possible, avoid cascading dependencies)

# Type-check
npx tsc --noEmit

# Build
npm run build

# Test (either unit or smoke)
npm run test:unit  # or npm run test:smoke
```

### Step 2: Deploy Hotfix

```bash
# Deploy only affected component
firebase deploy --only functions:affectedFunction \
  --project hmatologia2

# Or for rules-only hotfix:
firebase deploy --only firestore:rules \
  --project hmatologia2

# Wait for deploy complete (1-3 min)
```

### Step 3: Monitor (30 minutes)

```bash
# Watch Cloud Logs
gcloud functions logs read \
  --project hmatologia2 \
  --follow \
  --limit 100

# Metrics to check:
#   - Error rate < 1%
#   - Latency normal (< baseline)
#   - No new error patterns
#   - User feedback improving
```

### Step 4: Commit to Version Control

```bash
git commit -am "hotfix: describe fix"
git push origin hotfix/issue-name

# Open PR for review + merge
# (do not merge directly to main without approval)
```

---

## Rollback Workflow (Decision → Execute → Verify)

**Use this when:** Hotfix not viable in <15 min OR unknown issue.

### Step 1: Decide Which Component to Rollback

```
Affected Module
    ├─ Firestore Rules
    │  └─ `firebase deploy --only firestore:rules --project hmatologia2`
    │
    ├─ Cloud Functions
    │  └─ `firebase deploy --only functions --project hmatologia2`
    │     (rolls back all functions to last deployed version)
    │
    ├─ Hosting
    │  └─ `firebase deploy --only hosting --project hmatologia2`
    │     (rolls back web bundle to last deployed version)
    │
    └─ Everything (nuclear option)
       └─ See docs/rollback-procedures/COMPLETE_ROLLBACK_CHECKLIST.md
```

### Step 2: Execute Rollback

```bash
# Get last deployed version hash
git log --oneline -n 5

# If rolling back to previous commit:
git checkout <previous-commit-hash> -- firestore.rules
firebase deploy --only firestore:rules --project hmatologia2

# If rolling back functions:
git checkout <previous-commit-hash> -- functions/
npm run build
firebase deploy --only functions --project hmatologia2

# Rollback time estimate: 3-5 min
```

### Step 3: Verify Rollback Successful

```bash
# Smoke test basic flow
curl https://hmatologia2.web.app/api/health
# Expected: { "status": "ok" }

# Check Cloud Logs
gcloud functions logs read --project hmatologia2 --limit 20
# Expected: No errors, normal activity

# Ask affected users to hard reload
# (PWA may have cached new bundle)
```

### Step 4: Post-Mortem

1. Root cause analysis (within 24h)
2. Fix prepared in branch (don't commit to main yet)
3. Tested extensively on staging
4. Re-deploy with approval + monitoring
5. Document incident in incident log

---

## Communication Template

**When incident occurs, send this to Slack #incident:**

```
[TIMESTAMP] Incident Report — [Phase 14 Production]

Component Affected: [Module name]
Severity: [P1/P2/P3/P4]
Status: [Investigating / Fixing / Monitoring / Resolved]

What happened:
- [1-2 sentence description]

Current impact:
- ~[#] users affected
- Feature [name] is unavailable

Actions taken:
- [ ] Classified severity
- [ ] Identified root cause
- [ ] Deploying fix / Initiating rollback
- [ ] Monitoring metrics

ETA to resolution: [Time]

Updates every [5/15] minutes.
```

---

## Checklist: Incident Resolved

Before closing an incident:

- [ ] Error rate back to <1%
- [ ] Latency back to baseline
- [ ] All affected users have recovery path (hard reload / logout-login)
- [ ] Cloud Logs show no new errors for 10 min
- [ ] Stakeholders notified of resolution
- [ ] Root cause documented
- [ ] Hotfix or rollback committed to git
- [ ] Post-mortem scheduled if P1/P2

---

## Escalation Path

```
Incident Triage
    ↓
On-Call Engineer (available 24/7)
    ↓ [Can't resolve in 15 min?]
    ↓
Tech Lead + CTO (paged immediately for P1)
    ↓ [Still investigating?]
    ↓
External Support (Firebase, Google Cloud)
    ↓ [Service provider issue?]
    ↓
Lab Directors + Legal (if data loss / compliance breach)
```

**On-call rotation:** [Configure in PagerDuty / Opsgenie / similar]

**Escalation triggers:**

- P1 incident >10 min → page CTO
- Data loss suspected → page CTO + Legal
- Third-party outage >1h → contact support
- Same incident repeated 3x → RCA + architectural fix required

---

## Post-Launch Support

**First week (2026-08-23 to 2026-08-30):**

- 24/7 on-call coverage
- CTO available for escalations
- New issues prioritized immediately

**Weeks 2-4 (August 30 → September 30):**

- 24/5 on-call (business hours + emergency)
- CTO availability 9-17 UTC

**Month 2+ (October 1 onwards):**

- Standard on-call rotation
- CTO available 9-17 UTC weekdays

---

## Links & Resources

- **Cloud Logs:** https://console.cloud.google.com/logs (project: hmatologia2)
- **Firebase Console:** https://console.firebase.google.com/u/0/project/hmatologia2
- **Firestore Rules Docs:** https://firebase.google.com/docs/firestore/security/start
- **Cloud Functions Troubleshooting:** https://cloud.google.com/functions/docs/troubleshooting
- **ADR-0017 (HMAC incident):** `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md`
- **Deploy Protocol:** `.claude/rules/deploy-protocol.md`
