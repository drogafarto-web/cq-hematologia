# Incident Response Runbook — HC Quality v1.3 Production

**Version:** v1.3  
**Status:** Active post-deployment  
**Applies to:** Production environment (`hmatologia2`, `southamerica-east1`)  
**Audience:** On-call engineers, CTO, DevOps team

---

## Table of Contents

1. [Overview](#overview)
2. [Severity Classification](#severity-classification)
3. [Incident Response Workflow](#incident-response-workflow)
4. [Scenario Playbooks](#scenario-playbooks)
   - 4.1 Error Rate Spike
   - 4.2 P99 Latency Degradation
   - 4.3 Firestore Index/Quota Issues
   - 4.4 Memory OOM Events
   - 4.5 Auth Service Degradation
   - 4.6 Hosting/CDN Failures
   - 4.7 Audit Trail Corruption
5. [Rollback Decision Tree](#rollback-decision-tree)
6. [Recovery Procedures](#recovery-procedures)
7. [Post-Incident Review](#post-incident-review)

---

## Overview

This runbook provides step-by-step procedures for responding to production incidents. It complements the **Cloud Logs Monitoring Report** and is referenced by the **Cloud Monitoring alert policies**.

**Key principles:**
- **Triage first:** Determine severity (🟢/🟡/🔴/⚫) before acting
- **Contained fixes first:** Try targeted fixes before rollback
- **Documentation during:** Log every action in incident ticket
- **Escalate early:** Page on-call if unsure; better safe than sorry
- **Post-mortem after:** Root-cause analysis within 24h of resolution

---

## Severity Classification

| Level | Alert Threshold | User Impact | Response Time | Owner |
|---|---|---|---|---|
| 🟢 **Green** | No alerts; error rate <0.1% | None | Monitor | On-call engineer |
| 🟡 **Yellow** | Warning alert; error rate 0.1%–1%; P99 latency 3–5s | Minimal; some operations slow | 15–30 min investigation | On-call engineer |
| 🔴 **Red** | Critical alert; error rate >1%; P99 >5s; OOM; permission denied | Significant; some flows broken | <5 min page CTO; act within 15 min | On-call + CTO |
| ⚫ **Black** | Multiple critical alerts; 5xx sustained >10 min; all write failures | Total service degradation | Immediate page all; prepare rollback | Entire DevOps team |

---

## Incident Response Workflow

### Phase 1: Detection (0–5 minutes)

```
┌─ Alert fires (Cloud Monitoring → Slack)
│
├─ On-call engineer acknowledges in Slack
│
├─ [CLASSIFY] Read alert message → determine severity (🟢/🟡/🔴/⚫)
│
├─ [IF 🟡 or worse] Create incident ticket
│   └─ Title: "INCIDENT: [Error Type] — [HH:MM UTC]"
│   └─ Body: timestamp, alert name, metric value, affected module
│
├─ [IF 🔴 or 🔴] Page CTO immediately
│   └─ Slack: "@drogafarto INCIDENT [severity] [type] — escalating"
│   └─ Wait for acknowledgment before proceeding
│
└─ Proceed to Phase 2
```

**On-call acknowledgment template (Slack):**
```
@here INCIDENT ACKNOWLEDGED — [HH:MM UTC]
Type: [Error Rate | P99 Latency | OOM | etc.]
Severity: [🟡 | 🔴 | ⚫]
Module: [bioquimica | sgq | liberacao | etc.]
Metrics: [error_rate=X%, P99=Yms, memory=ZMB]
Actions: [Investigating | Applying fix | Preparing rollback]
Status: [In Progress] — updates every 5 min
```

### Phase 2: Triage (5–15 minutes)

```
┌─ Gather real-time data via gcloud CLI
│  ├─ Query Cloud Logs for error type
│  ├─ Check Cloud Monitoring dashboard
│  ├─ Verify Firestore quota/index status
│  └─ Identify affected labs / users
│
├─ [ASSESS] Root cause (category):
│   ├─ Code bug (return code ≠ 0)
│   ├─ Infrastructure (quota, index, memory)
│   ├─ External service (Auth, Drive API)
│   ├─ Data model (document too large)
│   └─ Misconfiguration (env var, rule)
│
├─ [ESTIMATE] Fix complexity:
│   ├─ Quick fix (env var, config change): 5–10 min
│   ├─ Code fix (deploy new version): 15–20 min
│   ├─ Index creation (Firestore): 5–10 min deployment + 2–5 min build
│   ├─ Quota increase (GCP console): 5–10 min
│   └─ Rollback (revert to prior version): 10–15 min
│
└─ [DECIDE] Path forward:
   ├─ IF quick fix available → Phase 3A (Apply Fix)
   ├─ IF code fix needed → Phase 3B (Deploy + Monitor)
   ├─ IF unresolved after 15 min → Phase 4 (Rollback)
   └─ IF unsure → Escalate to CTO
```

### Phase 3A: Apply Quick Fix (Configuration)

```
┌─ Execute fix (env var, Firestore index, quota, etc.)
│
├─ Verify via gcloud CLI:
│  ├─ Check Cloud Logs for error cessation
│  ├─ Confirm metric returns to normal
│  └─ Spot-check affected function/query
│
├─ [SUCCESS] Error rate dropped & P99 stable?
│  └─ Proceed to Phase 5 (Monitor + Document)
│
└─ [FAILURE] Still erroring after 5 min?
   └─ Escalate to Phase 4 (Rollback)
```

### Phase 3B: Deploy Code Fix + Monitor

```
┌─ Quick code review (security + logic)
│  └─ 2-minute scan; don't overthink
│
├─ Build & deploy:
│  ├─ npm run build
│  ├─ firebase deploy --only functions --project hmatologia2
│  └─ Wait for deploy complete (2–3 min)
│
├─ Start tight monitoring loop (2-hour window, 10-min checks):
│  └─ bash scripts/monitor-cloud-logs.sh 2 10
│
├─ [SUCCESS] No new errors in first 20 min?
│  └─ Proceed to Phase 5 (Monitor + Document)
│
└─ [FAILURE] Errors persist or worsen?
   └─ Escalate to Phase 4 (Rollback)
```

### Phase 4: Rollback Decision

```
┌─ [IF Phase 3 failed] Rollback now:
│
├─ Firestore indexes: Cannot rollback (Firestore state)
│  └─ Instead: Edit index JSON, redeploy with fix
│
├─ Cloud Functions: Revert to previous deploy:
│  ├─ git checkout HEAD~1 functions/
│  ├─ firebase deploy --only functions --project hmatologia2
│  ├─ git checkout HEAD functions/
│  └─ Wait for confirmation (2–3 min)
│
├─ Hosting: Revert to previous deploy:
│  ├─ firebase deploy --only hosting --project hmatologia2
│  ├─ Or: Use Firebase Console → Hosting → Rollback button
│  └─ Wait for confirmation (1–2 min)
│
├─ Verify rollback successful:
│  ├─ Error rate drops to <0.5%?
│  ├─ P99 latency returns to normal (<2s)?
│  └─ No new errors in Cloud Logs?
│
├─ [ROLLBACK SUCCESS] Proceed to Phase 5
│
└─ [ROLLBACK FAILURE] CRITICAL STATE:
   ├─ This should never happen (rollback is regression test)
   ├─ Page CTO immediately + entire team
   ├─ Prepare manual intervention (scale down functions, disable triggers)
   └─ Escalate to Google Cloud support for manual rollback
```

### Phase 5: Stabilization + Monitoring

```
┌─ Extended monitoring (24-hour window):
│  └─ Restart cloud logs script in background
│     bash scripts/monitor-cloud-logs.sh 24 30 &
│
├─ Document every step in incident ticket
│
├─ Notify stakeholders (lab managers, CTO):
│  ├─ Incident summary (what happened)
│  ├─ Root cause (preliminary)
│  ├─ Resolution (what was done)
│  └─ ETA for post-mortem (within 24h)
│
└─ Phase 6: Post-Mortem (next business day)
```

---

## Scenario Playbooks

### Scenario 1: Error Rate Spike (>1%)

**Alert:** "HC Quality: Error Rate >1%"  
**Severity:** 🔴 RED  
**Expected MTTR:** 15–30 minutes

#### Step 1: Identify Error Type

```bash
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --limit=20 --format=json | \
  jq -r '.[] | "\(.timestamp) | \(.jsonPayload.message) | \(.resource.labels.function_name)"'
```

**Expected output pattern:**
```
2026-05-10T14:32:15Z | FAILED_PRECONDITION: The query requires an index | onInsumoMovimentacaoCreate
2026-05-10T14:32:16Z | FAILED_PRECONDITION: The query requires an index | onInsumoMovimentacaoCreate
```

#### Step 2: Classify Root Cause

| Error Message | Root Cause | Severity | Fix |
|---|---|---|---|
| `FAILED_PRECONDITION: query requires index` | Missing Firestore index | 🟡 YELLOW | Deploy index (5 min) |
| `Permission denied on /labs/{labId}/...` | Firestore rules regression | 🔴 RED | Rollback functions (15 min) |
| `out of memory` | Memory limit exceeded | 🟡 YELLOW | Increase memory + redeploy (15 min) |
| `undefined is not a function` | Missing dependency | 🔴 RED | Code fix + redeploy (20 min) |
| `Exceeded timeout of X seconds` | Async handler too slow | 🟡 YELLOW | Increase timeout or fix code (20 min) |

#### Step 3: Apply Fix

**If Missing Index:**
```bash
# 1. Edit firestore.indexes.json
vi firestore.indexes.json  # Add missing index definition

# 2. Deploy
firebase deploy --only firestore:indexes --project hmatologia2

# 3. Monitor (index builds in background, ~2–5 min)
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --limit=5 --follow
```

**If Permission Denied (Rules Regression):**
```bash
# 1. Check diff vs previous commit
git diff HEAD~1 firestore.rules

# 2. If regression found, rollback
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules --project hmatologia2

# 3. If no obvious regression, check auth token
gcloud logging read \
  'textPayload=~".*Permission denied.*" AND resource.type="cloud_firestore"' \
  --project=hmatologia2 --limit=5
```

**If OOM (Out of Memory):**
```bash
# 1. Identify function
FUNC=$(gcloud logging read 'textPayload=~".*out of memory.*"' \
  --project=hmatologia2 --format='value(resource.labels.function_name)' --limit=1)

# 2. Edit function file: increase memory in options
vi functions/src/modules/$FUNC.ts
# Change: memory: '256MiB' → memory: '512MiB'

# 3. Rebuild & deploy
cd functions && npm run build && cd ..
firebase deploy --only functions:$FUNC --project hmatologia2

# 4. Monitor
gcloud logging read "resource.labels.function_name=$FUNC" \
  --project=hmatologia2 --follow
```

#### Step 4: Verify Recovery

```bash
# Wait 5 minutes, then check error rate
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --freshness=5m --format=json | \
  jq 'length'  # Should be 0–1

# Check P99 latency returned to normal
gcloud monitoring read \
  'metric.type="cloudfunctions.googleapis.com|function|execution_times"' \
  --project=hmatologia2
```

---

### Scenario 2: P99 Latency Spike (>5 seconds)

**Alert:** "HC Quality: P99 Latency >5s"  
**Severity:** 🟡 YELLOW (or 🔴 if combined with errors)  
**Expected MTTR:** 20–30 minutes

#### Step 1: Identify Slow Functions

```bash
gcloud logging read 'resource.type="cloud_function"' \
  --project=hmatologia2 --limit=50 --format=json | \
  jq '[.[] | select(.jsonPayload.latency > 5000) | 
       {function: .resource.labels.function_name, latency_ms: .jsonPayload.latency}]'
```

**Output:**
```json
[
  { "function": "sgq_documentPublish", "latency_ms": 7200 },
  { "function": "liberacao_signLaudo", "latency_ms": 6100 }
]
```

#### Step 2: Root Cause Analysis

**Check 1: Is it a Firestore query problem?**
```bash
gcloud logging read \
  'jsonPayload.operation=~".*Firestore.*" AND severity="WARNING"' \
  --project=hmatologia2 --limit=10
```
Look for: `"slow query"`, `"range scan"`, `"missing index"`

**Check 2: Is it a cold-start latency?**
```bash
gcloud logging read \
  'jsonPayload.event_type="STARTUP"' \
  --project=hmatologia2 --limit=5
```
Cold starts expected 2–3s on first invocation (not an error).

**Check 3: Is it heavy computation?**
```bash
gcloud logging read \
  'resource.labels.function_name="sgq_documentPublish"' \
  --project=hmatologia2 --limit=20 --format=json | \
  jq '.[] | {function, latency: .jsonPayload.latency, payload_size: .jsonPayload.payload_bytes}'
```

#### Step 3: Fix Path

| Root Cause | Fix | Time |
|---|---|---|
| Missing index on query | Add to firestore.indexes.json + deploy | 10 min |
| Large document (>100KB) | Refactor to subcollection | 1+ hour |
| Expensive computation (crypto, PDF) | Move to background queue | 30 min |
| Cold start | Not an issue; expected on first invocation | N/A |
| External API call (Drive, Gemini) | Check external service health; add timeout | 10 min |

**If missing index:**
```bash
# Extract index spec from error message
gcloud logging read \
  'textPayload=~".*slow query.*" AND severity="WARNING"' \
  --project=hmatologia2 --limit=1 --format=json | \
  jq -r '.[] | .textPayload'

# Edit firestore.indexes.json with extracted spec
vi firestore.indexes.json

# Deploy
firebase deploy --only firestore:indexes --project hmatologia2
```

**If heavy computation:**
```bash
# Move to background queue (Cloud Tasks)
# Example: PDF generation for laudo

# Current (synchronous):
export const signarLaudo = onCall(async (request) => {
  const pdf = await generatePDF(...);  // 5–10 second blocking
  return pdf;
});

# Refactored (asynchronous):
export const signarLaudo = onCall(async (request) => {
  const taskId = generateUUID();
  await enqueuePdfGeneration(taskId, request.data);
  return { taskId, status: 'queued' };  // Return immediately
});

export const processPdfQueue = onTaskDispatched(async (req) => {
  const { taskId, data } = req.data;
  const pdf = await generatePDF(data);  // Run in background
  await savePdfResult(taskId, pdf);
});
```

#### Step 4: Verify

```bash
# Rerun functions and check latency distribution
gcloud monitoring read \
  'metric.type="cloudfunctions.googleapis.com|function|execution_times"' \
  --project=hmatologia2 --aggregation.align_period_seconds=60
```

---

### Scenario 3: Firestore Index / Quota Issues

**Alert:** Varies (missing index, quota exceeded)  
**Severity:** 🟡–🔴 (depends on coverage)  
**Expected MTTR:** 5–15 minutes

#### Missing Index

```bash
# Step 1: Locate error in logs
gcloud logging read \
  'textPayload=~".*FAILED_PRECONDITION.*query requires an index.*"' \
  --project=hmatologia2 --limit=3 --format=json

# Extract collection + field info from error URL (base64 encoded)
# Example: "Failed query index: insumo-movimentacoes [insumoId ASC, timestamp DESC]"

# Step 2: Edit firestore.indexes.json
cat firestore.indexes.json | grep -A 5 "insumo-movimentacoes"
# Verify timestamp order is DESCENDING (not ASCENDING)

# Step 3: Deploy
firebase deploy --only firestore:indexes --project hmatologia2

# Step 4: Monitor (index builds in background)
sleep 10 && gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --limit=5
```

#### Quota Exceeded

```bash
# Step 1: Check quota usage
gcloud firestore databases describe --location=southamerica-east1 \
  --project=hmatologia2

# Step 2: If approaching limit, increase via console
# Open: https://console.cloud.google.com/firestore/databases?project=hmatologia2
# → Settings → Quotas → Edit quota

# Or via CLI (if supported):
gcloud alpha firestore databases update hmatologia2 \
  --type=firestore-native \
  --write-capacity=10000 \
  --project=hmatologia2

# Step 3: Verify quota increased
gcloud firestore databases describe --location=southamerica-east1 \
  --project=hmatologia2 | grep -i quota
```

---

### Scenario 4: Memory OOM Events

**Alert:** "HC Quality: Function Memory OOM"  
**Severity:** 🟡 YELLOW (escalate to 🔴 if repeated)  
**Expected MTTR:** 15–20 minutes

#### Step 1: Identify Function

```bash
gcloud logging read 'textPayload=~".*out of memory.*"' \
  --project=hmatologia2 --format=json --limit=5 | \
  jq -r '.[] | "\(.timestamp) | \(.resource.labels.function_name)"'
```

#### Step 2: Analyze Memory Usage

```bash
# Check memory allocation + usage pattern
gcloud logging read \
  'resource.labels.function_name="lgpd_scheduledAnnualReview"' \
  --project=hmatologia2 --limit=20 --format=json | \
  jq '[.[] | {memory_allocated: .jsonPayload.memory_mb_allocated, memory_used: .jsonPayload.memory_mb_used}] | max_by(.memory_used)'
```

#### Step 3: Increase Memory

```bash
# Edit function file
vi functions/src/modules/lgpd/scheduledAnnualReview.ts

# Change memory (default 256MiB → 512MiB):
export const lgpd_scheduledAnnualReview = onSchedule({
  schedule: 'every 1 hours',
  region: 'southamerica-east1',
  memory: '512MiB',  # ← CHANGE HERE
  timeoutSeconds: 540,
}, async (context) => {
  // ...
});

# Rebuild & deploy
cd functions && npm run build && cd ..
firebase deploy --only functions:lgpd_scheduledAnnualReview --project hmatologia2
```

#### Step 4: Monitor + Investigate

```bash
# Monitor for next 2 hours
bash scripts/monitor-cloud-logs.sh 2 10

# If OOM persists: Code review for memory leaks
# Questions to ask:
# - Large arrays accumulating (e.g., unbounded Firestore query)?
# - Circular references preventing garbage collection?
# - Streaming data not being released?

# Fix example (if unbounded query):
// BEFORE (loads all docs into memory):
const docs = await collectionGroup('items').get();
const results = docs.docs.map(doc => process(doc));

// AFTER (process in batches):
const query = collectionGroup('items').limit(100);
const results = [];
let snapshot = await query.get();

while (!snapshot.empty) {
  results.push(...snapshot.docs.map(doc => process(doc)));
  const last = snapshot.docs[snapshot.docs.length - 1];
  snapshot = await query.startAfter(last).get();
}
```

---

### Scenario 5: Auth Service Degradation

**Alert:** Firebase Auth errors in logs  
**Severity:** 🔴 RED (blocks all user access)  
**Expected MTTR:** 10–20 minutes (depends on Google Cloud status)

#### Step 1: Check Firebase Status

Navigate to: https://status.firebase.google.com/

- If Auth service showing 🔴 RED: **This is a Google Cloud outage**
  - No action needed on our side
  - Notify users: "Authentication service experiencing issues. We're monitoring."
  - Check back in 5–10 minutes
  - Escalate to Google Cloud support if >30 min outage

- If status is 🟢 GREEN: **Our configuration issue**
  - Proceed to Step 2

#### Step 2: Check Service Account Credentials

```bash
# Verify Firebase config is loaded correctly
gcloud logging read \
  'textPayload=~".*auth.*" AND severity="ERROR"' \
  --project=hmatologia2 --limit=10

# Check if service account keys are valid
gcloud iam service-accounts describe \
  $(gcloud config get-value project)@appspot.gserviceaccount.com \
  --project=hmatologia2
```

#### Step 3: Token Verification

```bash
# If specific user reports auth issue, check token:
gcloud auth application-default print-access-token

# If token expired or invalid, refresh:
firebase emulators:start --only=auth  # For testing

# For production: Users can refresh via app (auto-refresh)
# If manual intervention needed:
# - Have user logout + login
# - Clear browser cache
# - Hard reload (Ctrl+Shift+R)
```

#### Step 4: User Communication

If outage >5 minutes:
```
TO: lab-managers@clientname.com
SUBJECT: Authentication Service Alert — HC Quality

We're currently investigating authentication issues on hmatologia2.web.app.
Your access may be temporarily unavailable.

Status: INVESTIGATING
ETA: [Time]
Updates: [Slack channel] / [Status page]

No data loss. No action required from your side.
We'll notify you once resolved.

—HC Quality DevOps
```

---

### Scenario 6: Hosting / CDN Failures

**Alert:** "HTTP 5xx Errors >10 in 1 hour"  
**Severity:** 🔴 RED (users blocked from accessing UI)  
**Expected MTTR:** 10–15 minutes

#### Step 1: Identify 5xx Type

```bash
gcloud logging read 'httpRequest.status>=500' \
  --project=hmatologia2 --format=json --limit=20 | \
  jq '[.[] | {status: .httpRequest.status, path: .httpRequest.requestUrl, error: .jsonPayload.error}]'
```

**Common error patterns:**
- `502 Bad Gateway` → Upstream service down (Cloud Functions)
- `503 Service Unavailable` → Server overloaded or deployment in progress
- `504 Gateway Timeout` → Slow backend (Firestore query timeout)

#### Step 2: Fix by Error Type

**If 502 (Cloud Functions down):**
```bash
# Check function status
firebase functions:list

# If functions not listed or status ERROR:
firebase deploy --only functions --project hmatologia2

# Or quick rollback:
git checkout HEAD~1 functions/src/index.ts
firebase deploy --only functions --project hmatologia2
```

**If 503 (Server overloaded):**
```bash
# Usually temporary; no action needed
# If sustained >5 min: Scale up Cloud Run instances
gcloud run services update default \
  --region=southamerica-east1 \
  --max-instances=100 \
  --project=hmatologia2
```

**If 504 (Slow backend):**
```bash
# Check Firestore query latency
gcloud logging read 'jsonPayload.latency > 30000' \
  --project=hmatologia2 --limit=10

# Likely cause: Missing index
# Fix: Add index to firestore.indexes.json + deploy
firebase deploy --only firestore:indexes --project=hmatologia2
```

#### Step 3: Rollback Hosting

```bash
# If 5xx persist after 10 minutes:
firebase deploy --only hosting --project hmatologia2

# Or use Firebase Console:
# → Hosting → Releases → Find previous release → Click Rollback
```

#### Step 4: Verify

```bash
# Monitor for 10 min
bash scripts/monitor-cloud-logs.sh 0.1667 10  # 10 min, 10-min checks

# Check HTTP status distribution
gcloud logging read 'resource.type="cloud_run"' \
  --project=hmatologia2 --format=json | \
  jq '[.[] | .httpRequest.status] | group_by(.) | map({status: .[0], count: length})'
```

---

### Scenario 7: Audit Trail Corruption

**Alert:** Manual verification (not automatic)  
**Severity:** 🔴–⚫ CRITICAL (potential tampering)  
**Expected MTTR:** 30+ minutes (requires investigation)

#### Step 1: Detect Corruption

```bash
# Run chain integrity verification script (if exists)
bash scripts/verifyChain.sh <labId> <collection>

# Output should show:
# ✅ All 50 events hashed correctly
# ✅ No gaps in chain
# ✅ No timestamp anomalies

# If output shows ❌: corruption detected
```

#### Step 2: Assess Impact

```bash
# Identify which events have bad hashes
gcloud firestore export gs://hmatologia2-backups/audit-export-$(date +%s) \
  --collection-ids=/labs/{labId}/auditoria

# Download + analyze:
gsutil cp -r gs://hmatologia2-backups/audit-export-* ./

# Check event timestamps + hashes
cat events.json | jq '.[] | select(.chainHash.hash != computed_hash)'
```

#### Step 3: Escalate + Preserve Evidence

```
TO: @drogafarto (CTO)
SUBJECT: CRITICAL — Possible Audit Trail Corruption

CHAIN INTEGRITY FAILURE DETECTED

Date/Time: [ISO timestamp]
Lab: [labId]
Collection: [collection name]
Affected Events: [N events with bad hashes]

Evidence:
- Export: gs://hmatologia2-backups/audit-export-X
- Verification script output: [paste output]
- Affected timerange: [start] to [end]

Possible Causes:
1. Code bug in chainHash.ts (hash computation changed)
2. Secret rotation incomplete (HMAC key mismatch)
3. External tampering (unlikely but possible)
4. Clock drift / NTP sync issue

ACTIONS TAKEN:
- [ ] Stopped all writes to affected collection (via firestore.rules disable)
- [ ] Exported audit trail for forensics
- [ ] Notified CTO (this message)

WAITING FOR:
- Confirmation to preserve data or rollback
- Root cause investigation direction
```

#### Step 4: Remediation (CTO Decision)

**If code bug:**
1. Fix code (hash computation)
2. Rebuild + deploy
3. Backfill: Recompute hashes for affected event range
4. Reverify: Run integrity script again

**If secret rotation incomplete:**
1. Revert to previous HMAC secret temporarily
2. Re-sign all events with old key
3. Complete secret rotation process
4. Reverify

**If external tampering suspected:**
1. Preserve all evidence
2. Escalate to security team + legal
3. File incident report
4. Investigate access logs (who modified events?)

---

## Rollback Decision Tree

```
START: "Is the system experiencing severity 🔴 or ⚫?"
│
├─ NO (🟢 or 🟡) → Continue monitoring
│   └─ Try targeted fix (config, index, memory)
│   └─ If fixed within 15 min → Proceed
│   └─ If not fixed → Ask CTO for approval to rollback
│
└─ YES (🔴 or ⚫) → Evaluate rollback urgency
    │
    ├─ "Can you identify + fix the root cause in <10 min?"
    │
    ├─ YES → Attempt fix
    │   ├─ Fixed? → Proceed to monitoring
    │   └─ Not fixed after 10 min? → ROLLBACK
    │
    └─ NO → ROLLBACK IMMEDIATELY
        │
        ├─ Firestore indexes
        │   └─ Cannot rollback (state-based)
        │   └─ Instead: Fix index definition + redeploy
        │
        ├─ Cloud Functions
        │   ├─ git checkout HEAD~1 functions/
        │   ├─ firebase deploy --only functions --project hmatologia2
        │   ├─ git checkout HEAD functions/
        │   └─ Wait for confirmation
        │
        ├─ Hosting
        │   ├─ firebase deploy --only hosting --project hmatologia2
        │   └─ Or: Firebase Console → Rollback button
        │
        ├─ Verify rollback successful
        │   ├─ Error rate < 0.5%?
        │   ├─ P99 latency < 2s?
        │   └─ Zero new errors?
        │
        ├─ [SUCCESS] → Phase 5 (Stabilization)
        └─ [FAILURE] → CRITICAL STATE
            └─ Page entire team + Google Cloud support
```

---

## Recovery Procedures

### Post-Rollback: Re-Deployment Checklist

After successful rollback, before deploying again:

```
□ Identify root cause of previous deploy
□ Review code changes in previous deploy
□ Discuss with CTO (what went wrong?)
□ Fix identified issue in code
□ Run full test suite locally
□ Code review by second engineer
□ Deploy to staging (if available)
□ Verify staging stability for 1 hour
□ Deploy to production (during low-traffic window if possible)
□ Start 2-hour monitoring window
□ Document changes in incident ticket
```

### Data Consistency Check (Post-Incident)

After resolving incident, verify data wasn't corrupted:

```bash
# Run compliance audit
bash scripts/compliance-audit.sh <labId>

# Check audit trail integrity
bash scripts/verifyChain.sh <labId> <collection>

# Spot-check recent writes
gcloud firestore export gs://hmatologia2-backups/post-incident-$(date +%s) \
  --collection-ids=/labs/{labId}/auditoria
```

---

## Post-Incident Review

### Timing

Conduct post-mortem **within 24 hours** of incident resolution.

### Participants

- On-call engineer (who responded)
- CTO (decision maker)
- Affected module owner (if applicable)
- Optional: QA engineer (if impacted test flows)

### Template

```markdown
# Post-Incident Review — [Date] [HH:MM UTC]

## Incident Summary
- **Start time:** [ISO timestamp]
- **End time:** [ISO timestamp]
- **Duration:** X minutes
- **Severity:** [🟡 | 🔴 | ⚫]
- **Affected users/labs:** [count or names]
- **Affected flows:** [list of broken features]

## Root Cause
[What actually happened? Why did the system fail?]

## Timeline
| Time | Event | Owner |
|------|-------|-------|
| 14:32 | Alert fired | Cloud Monitoring |
| 14:33 | On-call acknowledged | [Name] |
| 14:38 | Root cause identified | [Name] |
| 14:45 | Fix deployed / Rollback executed | [Name] |
| 14:52 | System stable | [Name] |

## Actions Taken
- [ ] [Action 1 — what was done to fix it]
- [ ] [Action 2]
- [ ] [Action 3]

## Contributing Factors
- [Factor 1: Why wasn't this caught earlier?]
- [Factor 2: Why did the system not degrade gracefully?]
- [Factor 3: Were there any monitoring blind spots?]

## Preventive Actions (Going Forward)
1. [Add new test case — specific code line]
2. [Add monitoring alert — specific metric]
3. [Refactor code for resilience — estimate 4 hours]
4. [Document edge case in CLAUDE.md]

## Owner + ETA
- [Action 1] — [Engineer name] — ETA [date]
- [Action 2] — [Engineer name] — ETA [date]
- [Action 3] — [Engineer name] — ETA [date]

## Approval
- [ ] CTO approves preventive actions
- [ ] Timeline reviewed (realistic?)
```

### Follow-Up

Track preventive actions in project backlog. Close post-mortem once all actions complete.

---

## Quick Reference: Commands

### Emergency Information Gathering

```bash
# Last 20 errors across all services
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20

# Errors in last 1 hour
gcloud logging read "severity >= ERROR AND timestamp > now - 60m" \
  --project=hmatologia2

# Function-specific errors
gcloud logging read 'resource.type="cloud_function" AND severity >= ERROR' \
  --project=hmatologia2 --limit=50

# Firestore errors
gcloud logging read 'resource.type="cloud_firestore" AND severity >= ERROR' \
  --project=hmatologia2 --limit=20

# HTTP 5xx errors
gcloud logging read 'httpRequest.status >= 500' \
  --project=hmatologia2 --limit=20

# Export all errors to JSON (for analysis)
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --format=json > errors-$(date +%s).json

# Real-time error stream (tail)
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --follow
```

### Quick Decisions

| Question | Command | Interpretation |
|---|---|---|
| "Are functions deployed?" | `firebase functions:list --project hmatologia2` | Should list 32+ active functions |
| "What's the error rate?" | Count ERROR logs / total invocations | <0.1% is healthy |
| "Is Firestore quota exceeded?" | `gcloud firestore databases describe` | Check writes/sec vs quota |
| "Did something change in last hour?" | `git log --oneline -10` | Review recent commits |
| "Should we rollback?" | Check if error rate >1% AND fix time >10 min | If both true: YES |

---

## Escalation Contact Matrix

| Situation | Contact | Method | SLA |
|---|---|---|---|
| 🟡 Yellow alert (error 0.1–1%) | On-call engineer | Slack | 15 min |
| 🔴 Red alert (error >1% OR latency >5s) | @drogafarto (CTO) | Slack + page | <5 min |
| ⚫ Critical (multiple failures, 5xx sustained) | Entire DevOps team | Slack + page all | Immediate |
| Questions during incident | @drogafarto | Slack DM | <10 min |
| Post-mortem scheduling | CTO | Email | Within 24h |

---

**Last Updated:** 2026-05-09  
**Version:** v1.3  
**Status:** Active — use for all production incidents

**Questions?** Contact @drogafarto or refer to `CLOUD_LOGS_MONITORING_REPORT_v1.3.md` executive summary.

