---
title: "Phase 4 Incident Response Playbook"
date: "2026-08-31"
status: "OPERATIONAL"
---

# Phase 4 Incident Response Playbook

**Effective Date:** 2026-08-31  
**Scope:** v1.4 Production Deployment (Phase 4)  
**SLA:** P0 <5 min, P1 <15 min, P2 <1h, P3 <24h  
**Escalation:** On-call → Secondary → CTO → Leadership

---

## Severity Matrix

### 🟢 GREEN — Low Impact

**Definition:** <1% users affected, <15 min SLA  
**Examples:** Single user complaint, minor UI bug, non-critical feature down

**Response:**
1. Acknowledge in Slack (#production-alerts)
2. Investigate root cause (< 5 min)
3. Triage: Fix forward or defer to maintenance window
4. Notify affected user(s) if applicable
5. Log in incident tracker

**SLA:** <1h response time  
**Escalation:** None (on-call owns resolution)

---

### 🟡 YELLOW — Medium Impact

**Definition:** 1–10% users affected, <15 min response SLA  
**Examples:** Portal timeout spike, NOTIVISA queue backing up, auth latency issue

**Response:**
1. Page on-call (primary + secondary)
2. Join Slack war room (#production-emergency)
3. Engage CTO (notify, don't page yet)
4. Triage within 5 min:
   - Identify affected service
   - Assess: fix forward vs. rollback
   - Communicate ETA to stakeholders
5. Execute mitigation (< 15 min response)
6. Monitor for 30 min post-recovery
7. Post-mortem within 24h

**SLA:** <15 min response time, <1h resolution  
**Escalation:** If >15 min unresolved → page CTO

---

### 🔴 RED — Critical Impact

**Definition:** >10% users affected OR audit trail corrupted, <5 min SLA  
**Examples:** Firestore rules blocking all writes, Gemini API quota exhausted, NOTIVISA API down, auth service unavailable

**Response:**
1. Page ALL (on-call + secondary + CTO + DevOps lead)
2. CTO takes incident commander role
3. War room (Slack + video call): max 1 min assembly
4. Triage (< 2 min):
   - What's down?
   - How many users affected?
   - Fix forward or rollback?
5. Execute (< 5 min):
   - Rollback if data integrity at risk
   - Fix forward if safe + fast (<3 min)
6. Validate recovery (< 5 min)
7. Notify all stakeholders (labs, support team)
8. Monitor for 1 hour
9. Post-mortem within 2h (incident commander + team)

**SLA:** <5 min response, <30 min resolution  
**Escalation:** Automatic (all leads on call)

---

### ⚫ BLACK — Catastrophic Impact

**Definition:** Data loss, security breach, fraud, >60% service loss, <2 min SLA  
**Examples:** Database corruption, unauthorized access, patient data leaked, financial fraud

**Response:**
1. Page ALL immediately (no filtering)
2. Declare CODE RED incident
3. CTO + Legal + Security convene instantly
4. Lock down access (pause all writes if needed)
5. Forensics (gather evidence)
6. Determine root cause (< 5 min)
7. Execute recovery (< 15 min if possible)
8. Notify regulators if required (ANVISA, LGPD authority)
9. Post-mortem within 4h
10. External comms prepared (legal review)

**SLA:** <2 min notification, <30 min containment  
**Escalation:** CTO + Legal + CEO

---

## Scenario 1: Firestore Rules Block All Writes

**Symptom Detection:**
- Spike in "Permission denied" errors (>20% of writes)
- Portal RT: "Cannot create run" errors
- Portal Paciente: Consent save fails
- NOTIVISA: "Queue write failed" errors
- Cloud Logs: `ERROR ... firestore: PERMISSION_DENIED`

**Severity:** 🔴 RED (all run creation blocked)

**Timeline:**
```
T+0    Alert fires (A1 error rate >5%)
T+1    Page on-call
T+2    Team assembled
T+3    Root cause: Rules deploy had syntax error
T+5    ROLLBACK to previous rules
T+6    Validate: rules tests pass
T+7    Confirm: run creation works
T+8    Monitor error rate normalization
```

### Diagnosis (T+0 to T+3)

**Step 1: Confirm Issue** (1 min)

```bash
# Check error logs
gcloud logging read "resource.type=firestore & severity=ERROR" \
  --project hmatologia2 \
  --limit 100 \
  --format "table(timestamp, severity, jsonPayload.error_code, jsonPayload.message)"

# Expected: 100+ PERMISSION_DENIED errors in last 5 min
# If confirmed: → Step 2
```

**Step 2: Identify Affected Collections** (1 min)

```bash
# Which collections are affected?
gcloud logging read "resource.type=firestore & severity=ERROR & jsonPayload.error_code=PERMISSION_DENIED" \
  --project hmatologia2 \
  --format "table(jsonPayload.document_path)" \
  --limit 50 | sort | uniq

# Expected output example:
# projects/hmatologia2/databases/(default)/documents/runs/...
# projects/hmatologia2/databases/(default)/documents/notivisa-queue/...
# projects/hmatologia2/databases/(default)/documents/patient-consents/...

# If >3 collections blocked: → ROLLBACK decision
```

**Step 3: Check Recent Rule Deployment** (1 min)

```bash
# What was deployed?
git log --oneline firestore.rules | head -5

# See diff
git diff HEAD~1 HEAD -- firestore.rules

# Look for:
# - Syntax errors (missing semicolons, unmatched braces)
# - Logic errors (overly restrictive conditions)
# - Function redefinitions (conflicting rules)
```

### Mitigation (T+3 to T+7)

**Rollback Decision:**

```
CTO: "Rules blocking writes confirmed. Rolling back to previous version."

Command authority: CTO
Rollback owner: DevOps lead
Estimated recovery: < 5 min
Validation: Rules tests pass + manual test write
```

**Rollback Procedure:**

```bash
# Step 1: Restore previous firestore.rules
git show HEAD~1:firestore.rules > firestore.rules

# Step 2: Review rules (sanity check)
cat firestore.rules | head -50  # Spot check syntax

# Step 3: Deploy
firebase deploy --only firestore:rules --project hmatologia2

# Expected: ✔ Deploy complete!

# Step 4: Validate
firebase rules:test --project hmatologia2

# Expected: All tests PASS (0 failures)

# Step 5: Manual test write
firebase functions:call submitNotivisaEvent \
  --data='{"labId":"lab-001","event":{"type":"test"}}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected: Success (no PERMISSION_DENIED)

# Step 6: Confirm error rate drops
sleep 30
gcloud logging read "resource.type=firestore & severity=ERROR & timestamp>now-1m" \
  --project hmatologia2 \
  --format "table(timestamp, severity)" | wc -l

# Expected: <5 errors (normal baseline)
```

### Validation (T+7)

**Smoke Test Suite:**

```bash
# Re-run critical flow tests
npm test -- --testNamePattern="Phase4.*Critical" --maxWorkers=1

# Expected: 40/40 tests pass (all 8 flows × 5 runs)
```

**Error Rate Confirmation:**

```bash
# Check error rate trend
gcloud monitoring time-series list \
  --filter='metric.type="logging.googleapis.com/user/error_rate"' \
  --project hmatologia2 \
  --format="table(metric.labels.name, points[0].value.double_value)"

# Expected: <0.1% error rate (back to baseline)
```

### Post-Incident (T+8+)

**Post-Mortem (within 2h):**

1. **What happened?** — Rules change introduced syntax error
2. **Why?** — Code review missed error (human factor)
3. **Impact?** — 8 min downtime, ~1,000 failed writes, 5 users notified
4. **Fix?** — Rollback to stable version
5. **Prevention?** — Mandatory rules:test before deploy (git pre-push hook)

**Action Items:**
- [ ] Add `firebase rules:test` to git pre-push hook
- [ ] Add rules syntax validation to CI/CD
- [ ] Schedule code review training (Firestore rules focus)

---

## Scenario 2: Cloud Functions Cold Start Latency Spike

**Symptom Detection:**
- Portal load time increases to >3s (normally 1.8s)
- NOTIVISA submissions taking >5s (normally <2s)
- Alert A3 fires (P99 latency >3s)
- Cloud Functions: cold start latency observed

**Severity:** 🟡 YELLOW (user experience degraded, not blocked)

**Timeline:**
```
T+0    Alert fires (P99 > 3s)
T+1    Page secondary on-call
T+3    Root cause: Concurrent deployments created cold start spike
T+5    Increase function memory
T+8    Latency normalizes
```

### Diagnosis (T+0 to T+3)

**Step 1: Confirm Cold Start** (1 min)

```bash
# Check function execution latency
gcloud functions describe submitNotivisaEvent \
  --region southamerica-east1 \
  --project hmatologia2 \
  --format="table(name, runtime, memory_mb, available_memory_mb)"

# Check recent executions
gcloud logging read "resource.type=cloud_function & resource.labels.function_name=submitNotivisaEvent" \
  --project hmatologia2 \
  --limit 50 \
  --format="table(timestamp, jsonPayload.execution_id, jsonPayload.duration_ms)"

# Expected: latency 1000–2000ms normal, 3000–5000ms during spike
```

**Step 2: Check for Concurrent Deployments** (1 min)

```bash
# Any deployments in last 10 min?
gcloud deployments list --project hmatologia2 --limit 10

# Check Cloud Build
gcloud builds list --project hmatologia2 --limit 10 --format="table(create_time, id, status)"

# If concurrent builds visible: likely cause
```

**Step 3: Review Function Configuration** (1 min)

```bash
# Check memory allocation
firebase functions:list --project hmatologia2 \
  --format="table(name, memorySize, timeout)"

# If submitNotivisaEvent memory = 256MB (default): likely cause
# Expected allocation: 512MB+ for critical functions
```

### Mitigation (T+3 to T+8)

**Memory Increase Decision:**

```
CTO: "Increase function memory from 256MB to 512MB to reduce cold start."

Command authority: CTO
Executor: DevOps lead
Estimated recovery: < 5 min (no downtime)
Cost impact: ~2x increase for these functions
```

**Procedure:**

```bash
# Step 1: Update firebase.json function config
# Edit functions/firebase.json:
# "submitNotivisaEvent": {
#   "memory": "512MB",  # increase from 256MB
#   "timeout": "60s"
# }

# Step 2: Deploy with new memory config
firebase deploy --only functions --project hmatologia2

# Expected: Functions redeploy with new memory
# Note: Old containers will be torn down, new ones warm up

# Step 3: Monitor during deploy
# Watch for temporary latency spike (< 1 min)

# Step 4: Confirm memory applied
firebase functions:describe submitNotivisaEvent \
  --region southamerica-east1 \
  --project hmatologia2 \
  --format="value(memory_mb)"

# Expected: 512

# Step 5: Test latency
firebase functions:call submitNotivisaEvent \
  --data='{"labId":"lab-001","event":{"type":"test"}}' \
  --region southamerica-east1 \
  --project hmatologia2 \
  --format="table(name, result.executionTime)"

# Expected: <2s (vs. >3s before)
```

### Validation (T+8)

**Latency Normalization:**

```bash
# Check P99 latency trend
gcloud monitoring time-series list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/execution_times" & metric.labels.function_name="submitNotivisaEvent"' \
  --project hmatologia2 \
  --interval-start-time "2026-08-31T23:00:00Z" \
  --interval-end-time "2026-09-01T00:00:00Z" \
  --format="table(points[0].value.distribution_value.buckets)" | tail -5

# Expected: P99 back to <2.5s
```

**Cost Impact Check:**

```bash
# New daily function cost estimate
firebase functions:list --project hmatologia2 \
  --format="table(name, memorySize)" | \
  awk '{cost = ($2 / 256) * 0.0000041; print $1, cost " USD/day"}' | \
  awk '{sum += $2} END {print "Total additional cost: " sum " USD/day"}'

# Expected: ~$0.50–1.00 additional per day for critical functions
# Within budget (<$500/month)
```

### Post-Incident (T+8+)

**Post-Mortem:**

1. **What happened?** — Memory too low for concurrent load
2. **Why?** — Default 256MB insufficient after increased traffic
3. **Impact?** — 5 min elevated latency, 2% user-facing delay
4. **Fix?** — Increased memory to 512MB
5. **Prevention?** — Baseline memory config based on expected load

**Action Items:**
- [ ] Document function memory requirements per deployment
- [ ] Set up P99 latency baseline dashboard
- [ ] Create auto-scaling policy for Cloud Functions

---

## Scenario 3: Gemini API Quota Exhausted

**Symptom Detection:**
- OCR extraction fails with "Quota exceeded" error
- Portal Paciente: PDF upload hangs, timeout after 60s
- Cloud Functions: extractLaudoOCR returns HTTP 429
- Cloud Logs: `RESOURCE_EXHAUSTED: Quota exceeded`

**Severity:** 🟡 YELLOW (OCR feature down, not blocking other features)

**Timeline:**
```
T+0    Alert fires (OCR error rate >10%)
T+1    Page on-call
T+3    Root cause: Unexpected high OCR volume
T+5    Enable fallback to manual entry
T+10   Monitor degraded mode
```

### Diagnosis (T+0 to T+3)

**Step 1: Confirm Quota Issue** (1 min)

```bash
# Check Gemini API errors
gcloud logging read "resource.type=cloud_function & jsonPayload.error_code=RESOURCE_EXHAUSTED" \
  --project hmatologia2 \
  --limit 50 \
  --format="table(timestamp, jsonPayload.message)"

# Expected: Multiple "Quota exceeded" messages
```

**Step 2: Check Quota Limit** (1 min)

```bash
# Check GCP Gemini API quota
gcloud compute project-info describe --project hmatologia2 \
  --format='value(quotas[name="generativelanguage.googleapis.com/requests_per_minute"].limit)'

# Expected: 100 requests/min (or whatever is configured)

# Check usage in last hour
gcloud logging read "resource.type=cloud_function & resource.labels.function_name=extractLaudoOCR" \
  --project hmatologia2 \
  --format="table(timestamp)" | wc -l

# If >6000 requests in 1 hour: exceeds quota (100/min)
```

**Step 3: Understand Usage Spike** (1 min)

```bash
# Check OCR extraction volume trend
gcloud monitoring time-series list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/invocations" & resource.labels.function_name="extractLaudoOCR"' \
  --project hmatologia2 \
  --format="table(points[0].value.int64_value, points[0].interval.end_time)"

# Expected: sudden increase vs. baseline (likely user bulk upload)
```

### Mitigation (T+3 to T+10)

**Fallback Decision:**

```
On-Call: "OCR quota exhausted. Enabling fallback to manual entry UI."

Command authority: CTO (if agreed)
Executor: On-call engineer
Estimated impact: Users manually enter OCR text (3 min vs. 5s auto)
Duration: Until quota resets (next hour or upgrade)
```

**Procedure:**

```bash
# Step 1: Enable manual entry UI (feature flag)
# In Portal Paciente component:
if (ocrFeatureFlagOK && !geminiQuotaExhausted) {
  // Show OCR auto-extract
} else {
  // Show manual entry form (graceful degradation)
}

# Deploy toggle:
firebase functions:call updateFeatureFlag \
  --data='{"labId":"*","flag":"OCR_AUTO_EXTRACT","enabled":false}' \
  --project hmatologia2

# Expected: Manual entry UI now shows instead of upload box

# Step 2: Notify users
# Toast message: "OCR temporarily unavailable. Please manually enter values (3 min)."

# Step 3: Monitor quota usage
# Check if it drops below limit
gcloud logging read "resource.type=cloud_function & resource.labels.function_name=extractLaudoOCR" \
  --project hmatologia2 \
  --format="table(timestamp)" | tail -20 | wc -l

# Expected: 0 new errors (quota pressure relieved)

# Step 4: Request quota increase (parallel action)
# In GCP Console:
# IAM & Admin → Quotas → Filter: generativelanguage.googleapis.com/requests_per_minute
# Edit Quota → Increase to 500/min (or higher)
# Submit request (may take 24–48h approval)
```

### Validation (T+10)

**Error Rate Normalization:**

```bash
# Check OCR error rate
gcloud monitoring time-series list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/errors" & resource.labels.function_name="extractLaudoOCR"' \
  --project hmatologia2 \
  --format="table(points[0].value.int64_value)"

# Expected: 0 new errors (quota pressure gone)
```

**User Experience Check:**

```
Manual OCR Flow Test:
  - Upload PDF
  - Manual entry form shows
  - User enters test, value, date, etc.
  - Audit trail records: "Manual entry (OCR unavailable)"
  - Verification: ✓ Users can still work
```

### Post-Incident (T+10+)

**Post-Mortem:**

1. **What happened?** — Gemini API quota exceeded (100 requests/min)
2. **Why?** — Lab A ran bulk upload (50 PDFs) without notice
3. **Impact?** — 30 min OCR unavailable, users fell back to manual
4. **Fix?** — Enabled manual entry UI, disabled auto-OCR temporarily
5. **Prevention?** — Increase quota to 500+ requests/min, add rate limiting

**Action Items:**
- [ ] Request Gemini API quota increase (500+ req/min)
- [ ] Add rate limiting to extractLaudoOCR (max 10 uploads/user/hour)
- [ ] Add queueing for bulk OCR (process async with delay)
- [ ] Notify users before bulk uploads

---

## Scenario 4: Firestore Index Timeout (Queries Slow Down)

**Symptom Detection:**
- NOTIVISA queue status query takes >10s (normally <1s)
- RT Presence lookup latency spikes
- Alert A3 fires (P99 > 3s)
- Cloud Logs: Firestore query latency warnings

**Severity:** 🟡 YELLOW (reporting slow, operational systems still responsive)

**Timeline:**
```
T+0    Alert fires (query latency >3s)
T+1    Page on-call
T+3    Root cause: Missing composite index
T+5    Create index
T+10   Index builds, queries normalize
```

### Diagnosis (T+0 to T+3)

**Step 1: Check Query Latency** (1 min)

```bash
# Identify slow queries
gcloud logging read "resource.type=firestore & severity=WARNING & \"slow query\"" \
  --project hmatologia2 \
  --limit 20 \
  --format="table(jsonPayload.query, jsonPayload.duration_ms)"

# Expected: Queries on notivisa-queue or supervisor-status collection
```

**Step 2: Check Indexes** (1 min)

```bash
# List existing indexes
firebase firestore:indexes --project hmatologia2

# Look for index on:
# - notivisa-queue: [status, nextRetry]
# - supervisor-status: [active, lastHeartbeat]

# If index missing: that's the cause
```

**Step 3: Review Firestore Schema** (1 min)

```bash
# Check actual documents
firebase firestore:inspect --project hmatologia2 --path "notivisa-queue/lab-001/events"

# If collection has >1000 documents and query uses 2+ filters: index needed
```

### Mitigation (T+3 to T+10)

**Index Creation Decision:**

```
On-Call: "Missing composite index. Creating index now."

Command authority: On-call (standard ops)
Executor: DevOps (via firebase CLI)
Estimated build time: < 10 min for <10k docs
Impact: Queries faster immediately after build
```

**Procedure:**

```bash
# Step 1: Create missing indexes
firebase firestore:indexes --project hmatologia2 --region southamerica-east1

# Via firestore.indexes.json (or Firebase Console):
# Add:
# {
#   "collection": "notivisa-queue/{labId}/events",
#   "fields": [
#     {"field": "status", "direction": "ASCENDING"},
#     {"field": "nextRetry", "direction": "ASCENDING"}
#   ]
# }

# Step 2: Deploy index
firebase deploy --only firestore:indexes --project hmatologia2

# Expected: Index creation in progress

# Step 3: Monitor index build
firebase firestore:indexes --project hmatologia2 --detailed

# Expected status progression:
# CREATING → READY (< 10 min for small collections)

# Step 4: Re-test slow query
firebase functions:call queryNotivisaStatus \
  --data='{"labId":"lab-001","status":"pending"}' \
  --region southamerica-east1 \
  --project hmatologia2

# Expected: Response <1s (vs. >10s before)
```

### Validation (T+10)

**Query Performance Check:**

```bash
# Verify index now used
gcloud logging read "resource.type=firestore & resource.labels.database_id=notivisa-queue" \
  --project hmatologia2 \
  --format="table(jsonPayload.duration_ms)" | \
  awk '{sum += $1; count++} END {print "Average latency: " sum/count "ms"}'

# Expected: <1000ms (1s)
```

---

## Escalation Tree

### On-Call Response Flow

```
T+0 Alert fires
  │
  └─→ Severity Green?
      │ YES → On-call investigates (SLA: <1h)
      │ NO  → Proceed to next decision
      │
      └─→ Severity Yellow?
          │ YES → Page on-call + secondary (SLA: <15 min)
          │ NO  → Proceed to next decision
          │
          └─→ Severity Red?
              │ YES → PAGE ALL (CTO + DevOps + on-call + secondary)
              │ NO  → Severity Black
              │
              └─→ Severity Black?
                  │ YES → DECLARE CODE RED
                  │        → Page CTO + Legal + CEO immediately
                  │        → Security lockdown
                  │        → Forensics + recovery
```

### Escalation Contacts

**On-Call Engineer (Primary):**
```
Name: ________________________
Phone: ________________________
Slack: ________________________
Hours: 24/7 rotation
```

**Secondary On-Call:**
```
Name: ________________________
Phone: ________________________
Slack: ________________________
Hours: 24/7 rotation
```

**CTO (Final Authority):**
```
Name: drogafarto
Email: drogafarto@gmail.com
Phone: ________________________
Slack: @drogafarto
```

**DevOps Lead:**
```
Name: ________________________
Phone: ________________________
Slack: ________________________
Hours: 08:00–18:00 weekdays
```

**Security Lead:**
```
Name: ________________________
Phone: ________________________
Email: ________________________
Hours: On-call for BLACK incidents
```

---

## Post-Incident Actions

### Template for Every Incident

**Incident ID:** [YYYY-MM-DD-NNN]

**Timeline:**
```
T+0:   Alert fired / issue reported
T+5:   Root cause identified
T+10:  Mitigation executed
T+15:  Service recovered
T+30:  Validation complete
```

**Impact Assessment:**
```
Duration: __ minutes
Users affected: __ (% of total)
Transactions failed: __
Data loss: [ ] Yes [ ] No
Audit trail affected: [ ] Yes [ ] No
Severity: [ ] GREEN [ ] YELLOW [ ] RED [ ] BLACK
```

**Root Cause:**
```
What happened: _____________________________________
Why it happened: _____________________________________
Was it preventable? [ ] Yes [ ] No
How? _____________________________________
```

**Mitigation:**
```
Action taken: _____________________________________
Owner: _____________________________________
Duration: __ minutes
Effectiveness: _____________________________________
```

**Prevention:**
```
Action 1: _____________________________________
Owner: _____________ Target: _____________ Status: [ ] Done [ ] Pending

Action 2: _____________________________________
Owner: _____________ Target: _____________ Status: [ ] Done [ ] Pending

Action 3: _____________________________________
Owner: _____________ Target: _____________ Status: [ ] Done [ ] Pending
```

**Post-Mortem Meeting:**
```
Date: ______________
Attendees: _____________________________________
Duration: __ min
Key learnings: _____________________________________
Owner (follow-up): _____________________________________
Target date: ______________
```

---

## Document Index

**This Playbook:** `docs/INCIDENT_RESPONSE_PLAYBOOK_PHASE_4.md`

**Related Documents:**
- `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` — Contact tree
- `docs/GO_LIVE_DAY_SCHEDULE_2026-05-20.md` — Go-live timeline
- `.planning/SLO_TRACKING_MANIFEST.md` — SLO definitions

---

**Status:** ✅ READY FOR OPERATIONS

All 4 scenarios documented. Escalation tree clear. Post-mortem templates ready.

🚀
