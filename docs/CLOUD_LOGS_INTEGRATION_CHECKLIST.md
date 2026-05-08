# Cloud Logs Monitoring Integration Checklist

**Purpose:** Connect Cloud Logs monitoring into the v1.3 deployment workflow (Steps 1–3 + post-deploy).

**Status:** Ready to use. Non-blocking; runs in parallel with deployment.

---

## v1.4 Update — Alert Rules Now Defined

Passive log monitoring (this checklist) is **not enough** for v1.4. Six structured alert rules are specified at:

- **[`docs/observability/ALERT_RULES_v1.4.md`](observability/ALERT_RULES_v1.4.md)** — full alert spec (A1–A6) with queries, thresholds, severity, escalation.
- **[`docs/observability/RUNBOOK.md`](observability/RUNBOOK.md)** — response procedures per alert.
- **[`docs/observability/policies/`](observability/policies/)** — one JSON template per alert; provision via `gcloud alpha monitoring policies create --policy-from-file=...`.

**Required before v1.4 launch (2026-05-20):**

- [ ] Notification channels created in Cloud Console (`oncall-eng`, `rt-clinical`, `dpo`, `cto`) — replace `PLACEHOLDER_*` IDs in JSON templates.
- [ ] A1, A3, A4 policies provisioned (READY today; no code dependencies).
- [ ] A5 log-based metrics (`twilio_sms_attempts`, `twilio_sms_failures`) defined; then A5 policy provisioned.
- [ ] A2 + A6 unblocked by Wave 3 (deploy `criticosSlaProbe` + `geminiEgressAudit`); then policies provisioned.
- [ ] Quarterly alert review scheduled.

This 24h passive monitoring guide remains useful for **post-deploy spot-checks**, but the alert policies are the production-grade signal.

---

## Pre-Deployment (Before Step 2)

- [ ] **Read guides**
  - [ ] `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — full reference
  - [ ] `docs/CLOUD_LOGS_QUICK_REFERENCE.md` — TL;DR + commands

- [ ] **Verify gcloud CLI**
  ```bash
  gcloud config set project hmatologia2
  gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=1
  ```
  Expected: returns 0 or 1 recent error (or empty if none)

- [ ] **Prepare monitoring environment**
  - [ ] Terminal window reserved for monitoring
  - [ ] `docs/` and `scripts/` directories writable
  - [ ] Either `jq` (JSON parsing) or PowerShell available

---

## Step 2: Functions Deploy (Monitoring Starts)

**Timeline:** Functions deploy begins → monitoring begins in parallel

### Option A: Automated (Bash/macOS/Linux)

```bash
# Terminal 1: Deploy (main task)
npm run build && firebase deploy --only functions --project hmatologia2

# Terminal 2: Start monitoring (in background)
cd C:\hc quality
bash scripts/monitor-cloud-logs.sh 24 30
# Runs for 24 hours, checks every 30 min
# Outputs to: scripts/cloud-logs-export-*.json + docs/MONITORING_REPORT_*.md
```

### Option B: Automated (PowerShell/Windows)

```powershell
# Terminal 1: Deploy (main task)
npm run build; firebase deploy --only functions --project hmatologia2

# Terminal 2: Start monitoring (in background)
cd C:\hc quality
.\scripts\monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30
# Runs for 24 hours, checks every 30 min
# Outputs to: scripts/cloud-logs-export-*.json + docs/MONITORING_REPORT_*.md
```

### Option C: Manual (Cloud Console, passive)

1. Open [Cloud Logging Console](https://console.cloud.google.com/logs/query)
2. Paste filter: `severity >= ERROR AND resource.type="cloud_function"`
3. Set time range: **Last 24 hours**
4. Manually refresh every 15–30 min
5. Note any errors in `docs/SIGN_OFF_CLOUD_LOGS_<date>.md` (see template below)

---

## During Deployment (Steps 2–3)

**Concurrent Tasks:**

| Task | Owner | Duration | Status |
|------|-------|----------|--------|
| Step 2: Functions deploy | Deployer | 5–10 min | Primary |
| Cloud Logs monitoring | Automated / Passive | 24h | Parallel |
| Step 3: Hosting deploy | Deployer | 2–5 min | After Step 2 |
| Post-deploy checklist | Deployer | 15 min | After Step 3 |

**Monitoring is non-blocking.** Deploy proceeds regardless of monitoring status. If errors appear, investigate separately.

---

## Post-Deployment (Step 3+)

**After hosting deploy completes:**

### 1. Check Automated Report (if using script)

```bash
# View auto-generated report
cat docs/MONITORING_REPORT_*.md | head -50

# Or view error export
cat scripts/cloud-logs-export-*.json | jq '.[0:10]'  # First 10 errors
```

**Expected:**
- `Total Errors: 0` (ideal)
- `Total Errors: <5` (acceptable)
- `Total Errors: >10` (escalate)

### 2. Fill Manual Sign-Off Report

**If using automated script:** Report auto-generates. Just verify and commit.

**If using Cloud Console:** Create manual report:

```bash
# Copy template
cat docs/CLOUD_LOGS_MONITORING_GUIDE.md | grep -A 100 "Sign-Off Report Template" > /tmp/template.md

# Fill in: error count, timestamp, recommendation
# Save as: docs/SIGN_OFF_CLOUD_LOGS_2026-05-07.md
```

### 3. Commit Reports to Git

```bash
# Stage monitoring reports
git add docs/MONITORING_REPORT_*.md
git add docs/SIGN_OFF_CLOUD_LOGS_*.md
git add scripts/cloud-logs-export-*.json

# Commit with context
git commit -m "docs: v1.3 cloud logs monitoring sign-off — 24h verification complete

- Monitoring period: [start] → [end] UTC
- Total errors: [N] (Functions: [F], Firestore: [FS], Hosting: [H])
- Recommendation: [APPROVE/ESCALATE/BLOCK]
- Signed by: [name]"
```

### 4. Escalation Decision Tree

```
Total Errors == 0?
├─ YES → ✅ APPROVE (proceed to next task)
└─ NO → Check severity
    ├─ <5 errors + no 🔴 BLOCK issues → ✅ APPROVE (document in sign-off)
    ├─ >5 errors OR any 🔴 BLOCK issue → ⚠️ ESCALATE
    │   └─ Contact CTO (@drogafarto) with:
    │       • Error timestamp + type
    │       • Log snippet (from Cloud Console)
    │       • Decision: ROLLBACK / INVESTIGATE / MONITOR MORE
    └─ Missing reports? → ⚠️ RE-RUN monitoring
        └─ bash scripts/monitor-cloud-logs.sh 6 10  # 6h, tight checks
```

---

## Red Flag Scenarios (Immediate Action Required)

| Error | Signature | Action |
|-------|-----------|--------|
| **Timeout cascade** | >3 "Exceeded timeout" per hour | Check `functions/src/modules/*/index.ts` async handlers; increase timeout or split work |
| **Permission denied** on `/labs/{labId}/*` writes | Repeated permission errors | Compare `firestore.rules` to git HEAD; rules regression detected; rollback or fix rules |
| **502/503 sustained** | HTTP 502/503 for >5 min continuous | Hosting layer issue; consider rollback: `firebase deploy --only hosting ...` with previous version |
| **"undefined is not a function"** | Stack trace with function name | Missing dependency in `functions/package.json`; check `npm list` output; re-install and re-deploy |
| **Document too large** | `"Document too large"` on laudo/declaracao | Data model exceeds 1 MB; refactor to subcollection or Cloud Storage |

**For any red flag:**
1. Screenshot error from Cloud Console
2. Note exact timestamp
3. Message CTO: "🔴 BLOCK — [error] detected at [time]. Escalating..."
4. Wait for response before proceeding

---

## Monitoring Cleanup (After 24h or Earlier)

**When to stop monitoring:**

- ✅ 24h window complete (automated script finishes)
- 🔴 Critical error found (investigate immediately, then stop)
- ⚠️ On-demand (manual Ctrl+C in Cloud Console or script)

**Cleanup steps:**

```bash
cd C:\hc quality

# 1. Archive monitoring output
mkdir -p docs/monitoring-archive
cp docs/MONITORING_REPORT_*.md docs/monitoring-archive/
cp scripts/cloud-logs-export-*.json docs/monitoring-archive/

# 2. Commit final state
git add docs/monitoring-archive/
git commit -m "docs: archive cloud logs monitoring — v1.3 deployment complete"

# 3. Notify stakeholders (if manual monitoring)
# "Cloud logs monitoring complete. No critical issues. System stable."
```

---

## Scenario-Based Quick Reference

### Scenario 1: "I deployed; how do I monitor?"

```bash
# Quick (30 min spot-check)
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20

# Full (24h automated, if you have time)
bash scripts/monitor-cloud-logs.sh 24 30
```

### Scenario 2: "An error appeared; what do I do?"

1. **Get details:** Click the error in Cloud Console or:
   ```bash
   gcloud logging read "severity >= ERROR" --project=hmatologia2 --format=json | jq '.[] | select(.severity == "ERROR")'
   ```
2. **Check if it's critical:** Match against red flags above
3. **If 🔴 BLOCK:** Escalate immediately + consider rollback
4. **If ⚠️ ESCALATE:** Document + notify CTO
5. **If 🟡 OK:** Continue monitoring; document in sign-off

### Scenario 3: "I need to stop monitoring mid-way"

```bash
# Bash script (terminal 2)
Ctrl+C

# PowerShell script (terminal 2)
Ctrl+C

# Cloud Console
Just close the tab. No side effects.
```

Auto-generated report will cover the partial monitoring period. Create manual sign-off noting the truncation.

### Scenario 4: "Post-monitoring, I found errors. How do I fix them?"

1. **Note error type** from red flags table above
2. **Identify root cause:**
   - Timeout → check `functions/src/modules/*/index.ts`
   - Permission → check `firestore.rules` diff
   - Missing dep → check `functions/package.json`
   - Data too large → refactor schema
3. **Fix locally**, test with emulator
4. **Re-deploy** (Step 2 only): `firebase deploy --only functions --project hmatologia2`
5. **Restart monitoring** for next 2h (tight checks): `bash scripts/monitor-cloud-logs.sh 2 10`
6. **Verify fix** before final sign-off

---

## File Manifest

| File | Purpose | Created By | When to Use |
|------|---------|-----------|-------------|
| `docs/CLOUD_LOGS_MONITORING_GUIDE.md` | Full reference (40 sections) | Setup | Read once; reference as needed |
| `docs/CLOUD_LOGS_QUICK_REFERENCE.md` | TL;DR + commands | Setup | Print or bookmark |
| `scripts/monitor-cloud-logs.sh` | Bash monitoring script | Setup | macOS/Linux automated |
| `scripts/monitor-cloud-logs.ps1` | PowerShell monitoring script | Setup | Windows automated |
| `docs/MONITORING_REPORT_*.md` | Auto-generated report | Script | View after monitoring |
| `scripts/cloud-logs-export-*.json` | All errors (JSON) | Script | Archive + analysis |
| `docs/SIGN_OFF_CLOUD_LOGS_*.md` | Manual sign-off report | Deployer | Human verification |

---

## Troubleshooting

### "gcloud: command not found"

**Fix:**
```bash
# Install Google Cloud SDK
# macOS: brew install google-cloud-sdk
# Windows: Download from https://cloud.google.com/sdk/docs/install
# Linux: curl https://sdk.cloud.google.com | bash

# Verify
gcloud --version
```

### "Project hmatologia2 not found"

**Fix:**
```bash
gcloud config set project hmatologia2
gcloud auth login  # Re-authenticate if needed
```

### "jq: command not found" (Bash script)

**Fix:**
```bash
# macOS: brew install jq
# Windows/Linux: Script will skip jq features and use grep instead
# No action needed; script is resilient
```

### "Monitoring script hangs after 30 min"

**Fix:**
```bash
# Terminal 2: Check script status
ps aux | grep monitor-cloud-logs  # If hung, Ctrl+C and restart
# Or manually check: gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=5
```

---

## Sign-Off Template

**Use this to manually approve the deployment after monitoring.**

```markdown
# v1.3 Cloud Logs Monitoring Sign-Off

**Deployer:** [Your Name]  
**Date:** 2026-05-07  
**Monitoring Period:** 24h (May 7 00:00 → May 8 00:00 UTC)  

## Results

| Metric | Value |
|--------|-------|
| Total Errors | 0 |
| Function Errors | 0 |
| Firestore Errors | 0 |
| Hosting 5xx Errors | 0 |
| P99 Latency | <2s |

## Recommendation

✅ **APPROVE** — All checks passed. Safe for production release.

---

**Signature:** _______________ | **Date:** 2026-05-07
```

---

## Next Steps

1. **Before next deployment:** Copy this checklist to a notepad/doc
2. **During deployment:** Follow the sequence (Steps 1–3 + monitoring)
3. **Post-deployment:** Review reports + commit to git
4. **Future deployments:** Reuse scripts; monitoring is repeatable

---

**Last Updated:** 2026-05-06 | **Version:** 1.3
