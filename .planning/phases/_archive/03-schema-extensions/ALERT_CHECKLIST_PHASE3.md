# Phase 3 Wave 1 Alert Checklist — Real-time Response Guide

**Purpose:** Quick-reference escalation playbook for monitoring alerts during Phase 3 deployment (2026-05-08 → 2026-05-14).

**Owner:** On-call DevOps + CTO (on standby)  
**Last Updated:** 2026-05-08  
**Status:** ACTIVE during Phase 3 Wave 1

---

## Alert Severity Levels & Response Matrix

### 🔴 P0 (CRITICAL — Stop Deployment)

**Triggers:** Any of the following require immediate STOP and rollback assessment.

| Alert                    | Condition                            | Log Signature                                         | Immediate Action                                                                                                                                             |
| ------------------------ | ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ERROR Rate Spike**     | >10 errors in 30m window             | `severity=ERROR` count >10                            | 1. Note timestamp<br>2. Stop deployment waves<br>3. Export logs: `gcloud logging read ... --format=json > alert.json`<br>4. Notify CTO<br>5. Assess rollback |
| **CRITICAL Severity**    | 1+ CRITICAL event                    | `severity=CRITICAL`                                   | 1. Stop immediately<br>2. Export stack trace<br>3. Page CTO<br>4. Investigate before continuing                                                              |
| **Rules Compile Fail**   | Rules deployment fails or won't save | No deploy success log                                 | 1. Check syntax errors<br>2. Revert to last known good<br>3. Review Rules diff<br>4. Notify CTO                                                              |
| **Index FAILED State**   | Composite index enters FAILED        | `status=FAILED` in `firestore indexes composite list` | 1. Note index name + creation time<br>2. Contact GCP support<br>3. Pause all queries using that index<br>4. Do NOT continue deployment                       |
| **Hosting Service Down** | HTTP 5xx >5 in 1m                    | `httpRequest.status >= 500` count >5                  | 1. Check Cloud Run logs<br>2. Restart service if applicable<br>3. Notify CTO<br>4. Rollback if unrecoverable                                                 |

### 🟡 P1 (HIGH — Escalate & Investigate)

**Triggers:** Alert team; investigate in parallel with deployment.

| Alert                           | Condition                                    | Log Signature                                                 | Recommended Action                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Permission Denied Spike**     | >5 in 1h for authorized users                | `textPayload contains "Permission denied"`                    | 1. Check rules logic for new deployment<br>2. Verify test data has correct `labId`, `uid`<br>3. Review portal access rules syntax<br>4. May pause portal testing until resolved                 |
| **Rules Warnings Jump**         | Warning count jumps >50% (baseline 15 → >22) | `gcloud firestore:rules-validate` warnings                    | 1. Export rules diff<br>2. Identify new warnings<br>3. Prioritize critical warnings (unused variables, incomplete conditions)<br>4. Remediate low-priority warnings in next sprint              |
| **Function Timeout**            | Any callable takes >10s                      | `textPayload contains "Timeout"` or `executionTime > 10000ms` | 1. Identify which callable timed out<br>2. Check Firestore query complexity (index missing?)<br>3. Profile function execution<br>4. May be index creation delay → retry when index READY        |
| **Malformed NOTIVISA Payloads** | >10 rejected in 1h                           | `textPayload contains "validateNotivisaPayload"` rejection    | 1. Check NOTIVISA payload schema vs. Art. 6º §1 format<br>2. Review test data creation<br>3. May be schema mismatch<br>4. Do NOT send real NOTIVISA until resolved                              |
| **Latency p95 Spike**           | p95 latency >500ms for warm invocations      | Function logs + execution time                                | 1. Check Firestore quota consumed<br>2. Look for missing indexes (slow query logs)<br>3. Profile function code<br>4. If index creation in progress, latency expected; monitor until index READY |
| **Cold-Start Latency High**     | New functions cold-start >300ms              | `executionTime > 300ms` for first invocation                  | 1. Expected for cold-start; baseline <300ms target<br>2. If >500ms repeatedly, investigate bundle size<br>3. Monitor warm invocations (should be <100ms)                                        |
| **High Memory Usage**           | Function heap >500MB                         | `memoryUsed > 500` in function logs                           | 1. Check for memory leak in shared helper initialization<br>2. Profile function with large payload<br>3. May need to split large operations                                                     |

### 🟠 P2 (MEDIUM — Monitor & Log)

**Triggers:** Track and mention in post-deployment report.

| Alert                        | Condition                          | Log Signature                           | Action                                                                                                                                   |
| ---------------------------- | ---------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Index Creation Delay**     | Composite index in CREATING >10m   | `status=CREATING` >10 min               | This is normal; Firestore creates indexes async. Monitor until READY (target <5min). Do NOT block deployment.                            |
| **Network Latency**          | HTTP request latency >2s           | `latency > 2000ms`                      | Investigate network path, CDN cache; likely transient. If sustained >30m, escalate to P1.                                                |
| **Debug Logs Accumulating**  | INFO/DEBUG severity logs >1000/min | Log volume spikes                       | May indicate verbose logging in new code. If spikes high enough to affect quota, review log levels. Low priority unless affecting quota. |
| **Transient Quota Warnings** | `QUOTA_EXCEEDED` but recovers <60s | `textPayload contains "QUOTA_EXCEEDED"` | Normal during load spike; Firestore auto-backs off. If quota_exceeded PERSISTS >5 min, escalate to P1.                                   |

---

## Deployment Stage Alert Response

### **Stage 1: Schema Deployment (T+0m → T+5m)**

**Monitoring Focus:** Collection creation, index creation start

**Alert Watch List:**

- ❌ New collection creation fails → P0 STOP
- ⚠️ Composite indexes not starting creation → P0 STOP
- 🟡 Indexes slow to transition to CREATING → P2 LOG
- ⚠️ Unexpected permission errors on new collections → P1 INVESTIGATE

**Expected Behavior:**

- ✅ 5 new collections visible in Console
- ✅ 3 new composite indexes status = CREATING
- ✅ 0 error logs for schema operations

**Success Criteria:** All 5 collections created, 3 indexes transitioned to CREATING within 3m.

### **Stage 2: Rules Deployment (T+5m → T+10m)**

**Monitoring Focus:** Rules compilation, warning count, permission tests

**Alert Watch List:**

- ❌ Rules deploy fails (compilation error) → P0 STOP
- ⚠️ Rules warnings jump >22 → P1 INVESTIGATE
- ⚠️ Unexpected permission denies on non-portal operations → P1 INVESTIGATE
- 🟡 Portal access rules not enforcing (unauthorized users can read) → P1 INVESTIGATE

**Expected Behavior:**

- ✅ Rules deploy succeeds with ≤20 warnings
- ✅ 0 permission denied for authorized users
- ✅ NOTIVISA outbox accepts valid payloads, rejects invalid ones
- ✅ Portal access rules block unauthorized reads

**Success Criteria:** Rules deployed, warning count ≤20, smoke test pass rate ≥75%.

### **Stage 3: Shared Helpers Deploy (T+10m → T+20m)**

**Monitoring Focus:** Function deployment, cold-start latency, initialization errors

**Alert Watch List:**

- ❌ Any function fails to deploy → P0 STOP
- ⚠️ Cold-start latency >500ms repeatedly → P1 INVESTIGATE
- 🟡 Cold-start latency 300–500ms → P2 LOG
- ⚠️ Memory spike during initialization → P1 INVESTIGATE
- 🟡 SMS gateway or laudo finalizer unresponsive → P1 INVESTIGATE

**Expected Behavior:**

- ✅ 4 shared helper functions deployed (notivisa-sender, sms-gateway, laudo-finalizer, ia-strip-processor)
- ✅ Cold-start latency <300ms (target), <500ms (acceptable)
- ✅ Warm latency <100ms
- ✅ 0 unhandled exceptions during initialization

**Success Criteria:** All 4 functions deployed, cold-start <300ms, warm <100ms.

### **Stage 4: Base Structures Deploy (T+20m → T+25m)**

**Monitoring Focus:** Portal callable stubs, NOTIVISA processor, critical escalation trigger

**Alert Watch List:**

- ❌ Portal callable fails to deploy → P0 STOP
- ⚠️ NOTIVISA event processor hangs on test → P1 INVESTIGATE
- 🟡 Critical escalation trigger latency high → P2 LOG

**Expected Behavior:**

- ✅ Portal getter/setter callables respond <100ms
- ✅ NOTIVISA processor listens to outbox changes
- ✅ Critical escalation trigger fires on threshold match

**Success Criteria:** All 3 callables deployed and responding within 100ms.

### **Stage 5: Smoke Tests (T+25m → T+30m)**

**Alert Watch List:**

- ❌ Any smoke test fails → P0 STOP & ROLLBACK ASSESSMENT
- ⚠️ Test takes >5s to complete → P1 INVESTIGATE (index creation delay expected)
- 🟡 Test succeeds but slow → P2 LOG

**Smoke Tests:**

1. **NOTIVISA Outbox Create:** Create valid doc; rules allow + store success
2. **Portal Access Deny:** Attempt unauthorized read; rules deny + return 0 docs
3. **Critical Escalation Create:** Create escalation doc; SMS trigger fires
4. **Shared Helper Callable:** Invoke notivisa-sender; no error, returns success

**Success Criteria:** 4/4 tests pass within 5s each.

---

## Real-Time Monitoring Command Reference

### Immediate Alert Check (every 5m during deployment)

```powershell
# Check ERROR severity in last 5 minutes
gcloud logging read "severity >= ERROR AND timestamp > now - 5m" `
  --project=hmatologia2 `
  --limit=10 `
  --format="table(timestamp, severity, resource.type, textPayload)"
```

### Function Latency Check (every 10m)

```powershell
# Get p95 latency for all functions
gcloud logging read 'resource.type="cloud_function"' `
  --project=hmatologia2 `
  --limit=50 `
  --format=json | `
  jq '[.[] | select(.labels.function_name | startswith("notivisa") or startswith("sms") or startswith("laudo")) | {function_name: .labels.function_name, execution_time: .jsonPayload.executionTime}] | sort_by(.execution_time) | .[-5:]'
```

### Firestore Index Status (every 2m during schema deploy)

```powershell
# Check index creation progress
gcloud firestore indexes composite list --project=hmatologia2 --format="table(name, state, createTime)"
```

### Rules Warnings Check (after rules deploy)

```powershell
# Validate rules and count warnings
npm run firestore:rules-validate 2>&1 | grep -E "warning|Warning"
```

---

## Escalation Chain

### Immediate Escalation (P0)

1. **Whoever detects:** Note timestamp, error signature, affected resource
2. **Notify:** Slack #hc-quality-oncall → message: **`🔴 P0 ALERT: [error type] at [timestamp] — STOPPING DEPLOYMENT`**
3. **CTO:** Receive notification, assess rollback necessity within 5 minutes
4. **Action:** Either continue (if safe) or execute rollback procedure

### Investigation Escalation (P1)

1. **Whoever detects:** Note timestamp, error signature, context
2. **Notify:** Slack #hc-quality-oncall → message: **`🟡 P1 ALERT: [issue] — investigating`**
3. **CTO:** Review logs in parallel; provide guidance
4. **Action:** Fix or continue with caution

### Logging & Monitoring (P2)

1. **Whoever detects:** Log observation in monitoring report
2. **Post-deployment:** Include in final report for trend analysis
3. **Action:** None required; informational only

---

## Post-Alert Response Playbook

### If P0 Triggered → Rollback Assessment

**Timeline: 5 minutes**

```
T+0s: Alert detected, deployment paused
T+30s: Export full error logs to artifact
T+1m: CTO reviews error signature
T+2m: Decision: continue vs. rollback
  Option A: "Continue" — root cause low-impact, deployment proceeds
  Option B: "Pause" — fix issue in current deployment step, retry
  Option C: "Rollback" — revert to last known good, archive logs, post-mortem
T+5m: Action complete, team notified
```

**Rollback Command (if needed):**

```powershell
# Revert Rules
git checkout HEAD~1 firestore.rules
npm run firestore:rules-deploy

# Revert Functions
firebase deploy --only functions --project hmatologia2 --force

# Verify
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20
```

### If P1 Triggered → Investigate & Continue

**Timeline: 15 minutes**

```
T+0s: Alert detected, investigate in parallel
T+5m: Root cause identified
  - Rules syntax issue? → Fix + redeploy
  - Payload schema mismatch? → Fix test data
  - Slow query? → Create index, retry
T+15m: Resolution verified, continue deployment
```

### If P2 Triggered → Log & Continue

```
T+0s: Alert detected, logged in monitoring report
T+deployment-end: Include in final post-deployment report
T+24h: Analyze trend, schedule remediation if needed
```

---

## Post-Deployment Report Template

**File:** `.planning/phases/03-schema-extensions/CLOUD_LOGS_WAVE1_REPORT.md`

```markdown
# Phase 3 Wave 1 Cloud Logs Report

**Deployment Period:** 2026-05-08 23:00 UTC → 2026-05-09 23:00 UTC

## Summary

| Metric               | Value  | Target | Status     |
| -------------------- | ------ | ------ | ---------- |
| Total Errors         | [N]    | 0      | [✅/⚠️/❌] |
| P0 Alerts            | [N]    | 0      | [✅/⚠️/❌] |
| P1 Alerts            | [N]    | <5     | [✅/⚠️/❌] |
| Rules Warnings       | [N]    | ≤20    | [✅/⚠️/❌] |
| All Indexes READY    | [Y/N]  | Yes    | [✅/❌]    |
| Function p95 Latency | [X ms] | <300ms | [✅/⚠️/❌] |
| Smoke Tests          | [N/4]  | 4/4    | [✅/⚠️/❌] |

## Critical Incidents

[List any P0 alerts triggered, root cause, resolution]

## Investigation Items

[List any P1 alerts, status, follow-up required]

## Recommendation

✅ APPROVE: All metrics pass, safe for next phase  
⚠️ CONDITIONAL: Some issues found; recommend fix before next phase  
❌ ESCALATE: Critical issues found; recommend further investigation

---

**CTO Sign-Off:** **********\_\_**********  
**Date:** 2026-05-09
```

---

## Quick Reference: Alert Thresholds Summary

```
P0 (STOP DEPLOYMENT):
  • >10 ERROR logs in 30m window
  • 1+ CRITICAL severity event
  • Rules compile failure
  • Index creation fails
  • Hosting service down (>5 5xx in 1m)

P1 (INVESTIGATE):
  • >5 Permission denied in 1h (authorized users)
  • Rules warnings >22 (50% jump)
  • Function timeout >10s
  • >10 malformed payloads in 1h
  • Latency p95 >500ms warm invocations

P2 (LOG):
  • Index creation delay >10m (expected)
  • HTTP latency >2s
  • DEBUG logs >1000/min
  • Transient quota warnings <60s
```

---

## References

- **Baseline:** `.planning/phases/03-schema-extensions/CLOUD_LOGS_BASELINE.md`
- **Monitoring Script:** `scripts/monitor-cloud-logs.ps1`
- **GCP Console:** https://console.cloud.google.com/logs/query
- **Firestore Indexes:** https://console.cloud.google.com/firestore/indexes
- **Cloud Functions:** https://console.cloud.google.com/functions

---

**END OF ALERT CHECKLIST**

**Status:** 🟢 ACTIVE  
**Last Reviewed:** 2026-05-08  
**Next Review:** After Phase 3 Wave 1 completion (2026-05-09)
