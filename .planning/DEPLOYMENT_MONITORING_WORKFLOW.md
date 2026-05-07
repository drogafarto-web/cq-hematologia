# v1.3 Deployment + Cloud Logs Monitoring Workflow

**Date:** 2026-05-06  
**Status:** Ready  
**Updated:** CLAUDE.md references integration points

---

## Overview

This workflow guides the **complete v1.3 deployment process** including the newly added **24-hour Cloud Logs monitoring** phase.

**Timeline:**
- **Step 1: Type-check** — 5 min
- **Step 2: Functions deploy** — 5 min + **monitoring starts (parallel)**
- **Step 3: Hosting deploy** — 2 min
- **Step 4: Cloud Logs monitoring** — 24h (non-blocking, runs in background)
- **Step 5: Sign-off** — 15 min (after 24h or on-demand)

**Total active time:** ~17 min (deploy) + 15 min (sign-off) = 32 min
**Total clock time:** 24h+ (monitoring runs in background)

---

## Prerequisite Checklist

Before deploying:

- [ ] All tests passing: `npm test` (web + functions)
- [ ] No TypeScript errors: `npm run tsc --noEmit`
- [ ] Firestore rules reviewed: `firestore.rules` matches git HEAD expectation
- [ ] Functions reviewed: `functions/src/` has no syntax errors
- [ ] Environment variables set in Cloud Functions console
- [ ] Firebase CLI authenticated: `firebase login`
- [ ] Project configured: `gcloud config set project hmatologia2`
- [ ] Monitoring scripts available:
  - [ ] `scripts/monitor-cloud-logs.sh` (Bash, for macOS/Linux)
  - [ ] `scripts/monitor-cloud-logs.ps1` (PowerShell, for Windows)

---

## Step 1: Type-Check (5 min)

**Command:**
```bash
npm run tsc --noEmit
```

**Expected Output:**
```
No errors found
```

**If errors:**
- Fix locally
- Re-run type-check
- Do NOT proceed to Step 2 until clean

---

## Step 2: Functions Deploy (5 min) + Monitoring Starts

**Command (Terminal 1):**
```bash
npm run build && firebase deploy --only functions --project hmatologia2
```

**Expected Output:**
```
✔ Deploy complete!
Function URL: https://southamerica-east1-hmatologia2.cloudfunctions.net/...
```

**While deploy runs (Terminal 2, start monitoring in parallel):**

### Option A: Automated (Bash)
```bash
cd C:\hc quality
bash scripts/monitor-cloud-logs.sh 24 30
```
Output: will generate `docs/MONITORING_REPORT_*.md` + `scripts/cloud-logs-export-*.json` after 24h

### Option B: Automated (PowerShell)
```powershell
cd C:\hc quality
.\scripts\monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30
```
Output: same as Bash version

### Option C: Cloud Console (Manual)
1. Open [Cloud Logs Explorer](https://console.cloud.google.com/logs/query)
2. Paste filter: `severity >= ERROR`
3. Set time range: **Last 24 hours**
4. Refresh every 15–30 min manually
5. Document observations in notepad

### Option D: CLI Spot-Checks
```bash
# Run every 2 hours (12 checks for 24h)
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20
```

**Key point:** Monitoring is **non-blocking**. Deploy succeeds or fails independently. Choose one option and let it run in background.

---

## Step 3: Hosting Deploy (2 min)

**Command (Terminal 1, after Functions deploy completes):**
```bash
firebase deploy --only hosting --project hmatologia2
```

**Expected Output:**
```
✔ Deploy complete!
Hosting URL: https://hmatologia2.web.app
```

**Monitoring continues in Terminal 2 (no action needed).**

---

## Step 4: Cloud Logs Monitoring (24h, Non-Blocking)

**Status:** Automatic if using script options A or B; manual if option C or D.

**If using automated script:**
- Do nothing. Script runs unattended.
- Reports auto-generate after 24h:
  - `docs/MONITORING_REPORT_<timestamp>.md` — summary
  - `scripts/cloud-logs-export-<timestamp>.json` — all errors

**If using Cloud Console or CLI:**
- Spot-check every 2h (or as needed)
- Note any errors in a text file

**What to watch for (Red Flags):**

| Error | Action |
|-------|--------|
| `"Exceeded timeout"` | Escalate: async handler issue |
| `"Permission denied"` on `/labs/{labId}/*` | Escalate: rules regression |
| HTTP 502/503 sustained >5 min | Escalate: hosting failure |
| `"undefined is not a function"` | Escalate: missing dependency |
| `"Document too large"` | Escalate: data model overflow |

**For any red flag:** Take screenshot + timestamp, notify CTO (@drogafarto).

---

## Step 5: Sign-Off (15 min, After Monitoring)

### 5.1 Review Automated Report (if script was used)

```bash
cat docs/MONITORING_REPORT_*.md | head -50
```

Expected:
- Total Errors: 0–5 (acceptable)
- Recommendation: ✅ APPROVE

### 5.2 Create Manual Sign-Off Report

Use template from `docs/CLOUD_LOGS_MONITORING_GUIDE.md` section "Sign-Off Report Template":

**File:** `docs/SIGN_OFF_CLOUD_LOGS_2026-05-07.md`

```markdown
# v1.3 Cloud Logs Monitoring Sign-Off

**Deployer:** [Your Name]
**Date:** 2026-05-07
**Monitoring Period:** 24h (2026-05-07 00:00 → 2026-05-08 00:00 UTC)

## Summary

| Metric | Value |
|--------|-------|
| Total Errors | 0 |
| Function Errors | 0 |
| Firestore Errors | 0 |
| Hosting 5xx Errors | 0 |

## Recommendation

✅ **APPROVE** — All checks passed. Safe for production release.

---

**Signature:** _________________ | **Date:** 2026-05-07
```

### 5.3 Commit Reports to Git

```bash
git add docs/MONITORING_REPORT_*.md
git add docs/SIGN_OFF_CLOUD_LOGS_*.md
git add scripts/cloud-logs-export-*.json

git commit -m "docs: v1.3 cloud logs monitoring sign-off — 24h verification

Monitoring period: 2026-05-07 00:00 → 2026-05-08 00:00 UTC
Total errors found: 0 (Functions: 0, Firestore: 0, Hosting: 0)
Recommendation: APPROVE for production release
Signed by: [deployer name]"
```

### 5.4 Escalation Decision

```
Total Errors == 0?
├─ YES → ✅ RELEASE (system is live)
└─ NO → Check severity
    ├─ <5 errors + no red flags → ✅ RELEASE (document in sign-off)
    ├─ >5 errors OR red flag found → ⚠️ ESCALATE
    │   └─ Message CTO with timestamp + error type
    └─ Awaiting response before proceeding
```

---

## Quick Command Reference

### Deploy Commands

```bash
# Full deploy (Steps 1–3)
npm run tsc --noEmit
npm run build
firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2

# Functions only (if rollback needed)
firebase deploy --only functions --project hmatologia2

# Hosting only (if CSS/JS-only fix needed)
firebase deploy --only hosting --project hmatologia2
```

### Monitoring Commands

```bash
# Bash script (macOS/Linux) — 24h with 30-min checks
bash scripts/monitor-cloud-logs.sh 24 30

# PowerShell script (Windows) — same
.\scripts\monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30

# Quick error check (right now)
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20

# Real-time tail (Ctrl+C to stop)
gcloud logging read "severity >= ERROR" --project=hmatologia2 --follow

# Error count snapshot
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=100 --format=json | jq length
```

### Rollback Commands

```bash
# If Functions deploy failed, rollback to previous version
git checkout HEAD~1 functions/
firebase deploy --only functions --project hmatologia2

# If Hosting deploy failed, rollback
git checkout HEAD~1 hosting/
firebase deploy --only hosting --project hmatologia2

# After rollback, re-start monitoring
bash scripts/monitor-cloud-logs.sh 2 10  # 2h with tight 10-min checks
```

---

## Error Scenarios

### Scenario 1: Timeout errors appear during monitoring

**Diagnosis:**
```bash
gcloud logging read \
  'resource.type="cloud_function" AND textPayload=~".*Exceeded timeout.*"' \
  --project=hmatologia2 \
  --limit=10
```

**Root cause:** Async handler not awaiting or long-running operation.

**Fix:**
1. Open `functions/src/modules/<name>/index.ts`
2. Check callable handler — ensure all promises are `await`'ed
3. Re-deploy: `firebase deploy --only functions --project hmatologia2`
4. Restart monitoring: `bash scripts/monitor-cloud-logs.sh 2 10`

### Scenario 2: Permission denied errors on Firestore

**Diagnosis:**
```bash
gcloud logging read \
  'resource.type="cloud_firestore" AND textPayload=~".*Permission.*"' \
  --project=hmatologia2 \
  --limit=10
```

**Root cause:** Firestore rules too restrictive or bug in v1.3 rules.

**Fix:**
1. Compare current rules to git HEAD: `git diff HEAD firestore.rules`
2. If regression, rollback: `git checkout HEAD~1 firestore.rules`
3. Re-deploy: `firebase deploy --only firestore --project hmatologia2`
4. Restart monitoring: `bash scripts/monitor-cloud-logs.sh 2 10`

### Scenario 3: HTTP 502/503 errors (Hosting)

**Diagnosis:**
```bash
gcloud logging read \
  'resource.type="cloud_run" AND httpRequest.status >= 500' \
  --project=hmatologia2 \
  --limit=10
```

**Root cause:** Deployment in progress, Functions not responding, or hosting config issue.

**Fix:**
1. Wait 5–10 min for Functions to warm up (cold start can cause 502 initially)
2. If persists, check Functions deploy: `firebase deploy --only functions --project hmatologia2`
3. If still failing, rollback hosting: `git checkout HEAD~1 hosting/ && firebase deploy --only hosting --project hmatologia2`

---

## Deployment Checklist (Final)

Before marking deployment complete:

- [ ] Step 1: Type-check passed (no TS errors)
- [ ] Step 2: Functions deployed successfully
- [ ] Step 2: Monitoring started (Terminal 2)
- [ ] Step 3: Hosting deployed successfully
- [ ] Step 4: Monitoring completed (24h or on-demand)
- [ ] Step 5a: Auto-generated report reviewed (or manual observations noted)
- [ ] Step 5b: Manual sign-off report created: `docs/SIGN_OFF_CLOUD_LOGS_*.md`
- [ ] Step 5c: Reports committed to git
- [ ] Step 5d: Escalation decision made
  - [ ] ✅ APPROVE: System released to production
  - [ ] ⚠️ ESCALATE: CTO notified, awaiting response
  - [ ] 🔴 BLOCK: Critical issue, awaiting fix

---

## Post-Deployment

**Once signed off (✅ APPROVE):**

1. **System is live:** v1.3 is now in production
2. **Monitoring reports archived:** For audit trail + compliance
3. **Issues tracked:** Any escalated issues logged in project backlog
4. **Next deployment:** Reuse scripts; monitoring is repeatable

**Timeline for next check:**
- Monitor live traffic for 24–48h via `analytics` module
- Review Lighthouse CI results (if enabled)
- Check user feedback + error reports (Sentry, if integrated)

---

## File Locations (Quick Reference)

| File | Purpose |
|------|---------|
| `docs/CLOUD_LOGS_MONITORING_GUIDE.md` | Full reference (40+ sections) |
| `docs/CLOUD_LOGS_QUICK_REFERENCE.md` | TL;DR + commands |
| `docs/CLOUD_LOGS_INTEGRATION_CHECKLIST.md` | Workflow scenarios |
| `scripts/monitor-cloud-logs.sh` | Bash automation |
| `scripts/monitor-cloud-logs.ps1` | PowerShell automation |
| `docs/MONITORING_REPORT_*.md` | Auto-generated report |
| `docs/SIGN_OFF_CLOUD_LOGS_*.md` | Manual sign-off template |

---

## Support

**Questions?**
- Read `docs/CLOUD_LOGS_QUICK_REFERENCE.md` (2 min)
- Read `docs/CLOUD_LOGS_MONITORING_GUIDE.md` sections 2–5 (comprehensive)

**Issues found?**
- Match against red flags table above
- Take screenshot + timestamp
- Notify CTO (@drogafarto)

**Ready to deploy?**
- Follow the workflow above in order
- Use automated script (easiest)
- Sign off after 24h

---

**Last Updated:** 2026-05-06 | **Version:** 1.3
