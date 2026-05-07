# SLO Alert Policies — Complete Reference

**Date:** 2026-05-07  
**Status:** Ready to configure in Cloud Monitoring  
**Owner:** DevOps / Observability

---

## Overview

Four SLO alert policies protect HC Quality's production availability, performance, error rate, and audit compliance. This document provides the exact configuration for each policy.

---

## Alert Policy 1: Availability SLO (99.5% target)

**Trigger:** Composite uptime drops below 99.65% (70% of monthly budget consumed)

| Field | Value |
|-------|-------|
| **Policy Name** | `HC Quality Availability Budget 70%` |
| **Severity** | HIGH (Yellow) |
| **Metric Type** | `compute.googleapis.com/uptime` |
| **Resource Filter** | `resource.type="uptime_url" AND resource.labels.display_name="hmatologia2.web.app"` |
| **Threshold** | `< 99.65%` |
| **Aggregation** | 30-day rolling window |
| **Duration** | Sustained 5 minutes |
| **Notification Channels** | Slack #observability |
| **Documentation** | SLO Budget: 4.32 hours/month |

**What triggers this:**
- Firebase (Firestore + Auth) uptime <99.65%
- Cloud Hosting (hmatologia2.web.app) uptime <99.65%
- Cloud Functions uptime <99.65%
- **Any service individually crossing threshold = alert fires**

**Response SLA:** 1 hour for team review (non-critical, budget warning)

**Example Scenario:**
```
Day 1 (May 1):  99.98% ✓
Day 2 (May 2):  99.97% ✓
Day 3 (May 3):  99.80% ⚠ (4.3 hours downtime due to maintenance)
Day 4 (May 4):  99.95% ✓
→ 30-day rolling avg now 99.67% → Alert fires
```

---

## Alert Policy 2: Performance SLO (P99 <3s target)

**Trigger:** P99 latency sustained above 2.5s for 15+ minutes (approaching hard SLO limit)

| Field | Value |
|-------|-------|
| **Policy Name** | `HC Quality Latency P99 >2.5s (Yellow)` |
| **Severity** | MEDIUM (Yellow, warning) |
| **Metric Type** | `cloudfunctions.googleapis.com/function/execution_times` |
| **Aggregation** | 95th percentile (P99) per function |
| **Threshold** | `> 2500` milliseconds |
| **Duration** | Sustained 15 minutes |
| **Notification Channels** | Slack #observability |
| **Documentation** | P99 budget: 1.5% of requests can exceed 3s |

**Additional Alert: RED threshold**

| Field | Value |
|-------|-------|
| **Policy Name** | `HC Quality Latency P99 >3.0s (Red)` |
| **Severity** | CRITICAL (Red, SLO violation) |
| **Threshold** | `> 3000` milliseconds |
| **Duration** | Sustained 5 minutes |
| **Notification Channels** | PagerDuty + Slack #sev-1 |

**What triggers this:**
- Single module's P99 >2.5s sustained (yellow)
- Single module's P99 >3.0s sustained (red, SLO violation)
- Examples:
  - `analyzer` module OCR taking >2.5s (likely Gemini Vision API latency)
  - `export` module PDF generation >2.5s
  - `coagulacao` module calculation >2.5s

**Response SLA:**
- YELLOW: 1 hour team review
- RED: 15 min page oncall + incident ticket

**Expected False Positives:**
- Cold-start after deploy (first invocation, acceptable)
- High load test (if announced)
- Gemini Vision API rate-limiting (auto-backoff, expected)

**Mitigation Steps (when alert fires):**
1. [ ] Check Cloud Logs for function execution times
2. [ ] Identify which module (shown in alert details)
3. [ ] Grep logs for timeout/rate-limit errors
4. [ ] If Gemini API: Check quota. If code: Compare to baseline (previous week)
5. [ ] If baseline regressed: Check recent deploy + rollback if needed

---

## Alert Policy 3: Error Rate SLO (<0.1% target)

**Trigger:** Error rate >0.1% sustained 5+ minutes (exceeds monthly budget)

| Field | Value |
|-------|-------|
| **Policy Name** | `HC Quality Error Rate >0.1%` |
| **Severity** | CRITICAL (Red, SLO violation) |
| **Metric Type** | `logging.googleapis.com/user_defined_metric/error_rate_percent` |
| **Log Filter** | `severity=ERROR AND (resource.type="cloud_function" OR resource.type="cloud_run")` |
| **Aggregation** | Sum of errors / total requests |
| **Threshold** | `> 0.001` (0.1%) |
| **Duration** | Sustained 5 minutes |
| **Notification Channels** | PagerDuty + Slack #sev-1 |
| **Documentation** | Budget: ~50,000 errors/month in 5M requests |

**Error Categories Monitored:**
- HTTP 5xx responses (500, 502, 503, 504)
- Uncaught exceptions in Cloud Functions
- Firebase `INTERNAL` / `UNAVAILABLE` / `DEADLINE_EXCEEDED`
- Client-side JavaScript errors (optional RUM integration)

**Excluded from SLO:**
- `PERMISSION_DENIED` (expected during implantação phase)
- Transient network errors if client retries successfully
- Anticipated rate-limiting during load tests

**What triggers this:**
```
Scenario 1: Deploy breaks something
- Deploy at 14:00 UTC
- Errors spike to 0.5% (50 errors/min)
- Alert fires at 14:05 (after 5 min sustained)
- Oncall: 15 min to page + rollback

Scenario 2: External service degrades (Gemini API)
- Gemini Vision API begins timing out
- Error rate climbs from 0.002% → 0.15%
- Alert fires, oncall investigates
- If external: document in incident, SLO credit reviewed

Scenario 3: Database overload
- Firestore rate-limiting after traffic spike
- Errors climb, alert fires
- Scaling triggered (auto or manual), error rate drops
- Acceptable if <15 min duration (transient)
```

**Response SLA:** 15 min page oncall + incident ticket

---

## Alert Policy 4: Audit Trail SLO (100% capture, zero tolerance)

**Trigger:** Audit event capture rate <100% (any missed event)

| Field | Value |
|-------|-------|
| **Policy Name** | `HC Quality Audit Trail Capture <100%` |
| **Severity** | CRITICAL (Red, RDC 978 violation) |
| **Metric Type** | `logging.googleapis.com/user_defined_metric/audit_trail_capture_rate` |
| **Calculation** | (events in audit-trail collection) / (expected writes) |
| **Threshold** | `< 1.0` (must be 100%) |
| **Duration** | 1 minute (zero tolerance) |
| **Notification Channels** | PagerDuty + Slack #compliance + email to CTO |
| **Documentation** | RDC 978 Art. 117—audit trail non-negotiable |

**Expected Writes (triggering audit trail):**
- CIQ run creation + approval
- DICQ document edit + version
- POP certification
- Training completion
- Risk assessment update
- User access change
- Non-Conformidade status change

**What triggers this:**
```
Scenario: Audit function crashes
- Write to runs collection: expected
- Trigger fires → calls auditTrail callable
- Callable crashes with undefined error
- Audit event never written to audit-trail subcollection
- Capture rate drops from 100% → 99.8%
- Alert fires IMMEDIATELY (zero tolerance)

Remediation:
1. Page oncall (15 min SLA)
2. Fix callable bug + redeploy
3. Run backfill script: backfill-audit-trail.sh
4. Verify capture rate back to 100%
5. RCA in incident ticket (what caused the crash?)
```

**Backfill Procedure (if needed):**
```bash
# 1. List missed audit events (from last X hours)
firebase firestore:query --collection-path="runs" \
  --where-fields "auditedAt" "<" --where-value "2026-05-07T14:00:00Z"

# 2. Trigger audit backfill Cloud Function
gcloud functions call backfillAuditTrail \
  --region=southamerica-east1 \
  --data '{"startTime": "2026-05-07T14:00:00Z"}'

# 3. Verify capture rate back to 100%
# Re-run custom metric query in Logs Explorer
```

**RDC 978 Compliance Impact:**
- Each missed audit event = regulatory violation
- Auditor notes in compliance report
- Must be corrected + documented before accreditation review
- **No grace period** — this is non-negotiable for lab certification

---

## Alert Testing

### Test Alert Policy 1 (Availability)

```bash
# Cloud Monitoring Console → Alert Policies → click policy
# Button: "Test Notification"
# Check: Slack #observability receives test alert
```

### Test Alert Policy 2 (Performance)

```bash
# Option A: Trigger artificially
gcloud functions call testSlowFunction \
  --region=southamerica-east1 \
  --data '{"delayMs": 4000}'

# Option B: Use Cloud Monitoring test button
# Check: Slack notification, verify it shows P99 >2.5s threshold
```

### Test Alert Policy 3 (Error Rate)

```bash
# Trigger test error (safe)
gcloud functions call testErrorFunction \
  --region=southamerica-east1 \
  --data '{"errorType": "INTERNAL"}'

# Monitor logs → verify error counted in custom metric
# Check: PagerDuty receives alert (5 min delay expected)
```

### Test Alert Policy 4 (Audit Trail)

```bash
# Simulate missing audit event
gcloud firestore documents create runs/test-doc \
  --data='{"name": "test", "createdAt": "2026-05-07T14:00:00Z"}'

# Disable audit trigger temporarily
firebase firestore:rules:deploy --rules=/dev/null

# Manually add event back
firebase firestore:rules:deploy --rules=firestore.rules

# Verify: Capture rate dips, alert fires, then recovers
```

---

## Alert Tuning & Thresholds

### When to Tighten Thresholds

**Availability:** Currently 99.5% (4.32h/month budget)
- Phase 4+: Tighten to 99.9% if multi-region failover deployed

**Performance:** Currently P99 <3s
- If avg latency drops to <1s sustainably: consider 2.5s threshold
- If Gemini Vision API becomes bottleneck: consider per-module budgets

**Error Rate:** Currently <0.1%
- Phase 4+: After implantação rules lock down, may tighten to <0.05%

**Audit Trail:** Currently 100% (non-negotiable)
- Stay at 100% indefinitely (RDC 978 requirement)

### When to Loosen Thresholds

Do NOT loosen lightly. Any loosening must be:
1. Approved by CTO
2. Documented in ADR
3. Auditor briefed
4. Incident reviewed (understand root cause first)

Example acceptable reason:
- "Gemini Vision API public latency SLA is now 5s (was 3s); we've mitigated at library level, but raising our threshold to 4s temporarily while we optimize"

---

## Integration with Incident Response

**When an SLO alert fires:**

1. **Notification arrives** (Slack or PagerDuty)
2. **Oncall or team lead** acknowledges alert
3. **Check severity:**
   - RED: Open incident ticket + page on-call
   - YELLOW: Schedule sync within 1 hour
4. **Follow `docs/DR_PLAN.md`** for incident response flow
5. **Post-incident:** Fill SLO monthly report with RCA

**RCA Template (post-incident):**

```markdown
## Incident: Error Rate >0.1% on 2026-05-10

**Duration:** 14:05–14:27 UTC (22 minutes)  
**Peak Error Rate:** 0.23%  
**Root Cause:** Gemini Vision API returned 500 errors (Google issue, not ours)  
**Mitigation:** Automatic exponential backoff in analyzer function  
**Resolution:** Google resolved API outage; errors dropped to 0.0%  
**SLO Impact:** 0.15% of monthly error budget consumed  
**Action:** Reduce retry budget in analyzer; implement client-side caching for OCR results  
```

---

## Monthly Maintenance

**Every month (end-of-month):**

1. [ ] Review all 4 alert policies for false positives
2. [ ] Adjust thresholds if data supports it
3. [ ] Fill SLO monthly report (`SLO_MONTHLY_REPORT_TEMPLATE.md`)
4. [ ] Sign-off: DevOps + CTO + Auditor
5. [ ] Archive report in `.planning/reports/SLO_REPORT_[YYYY-MM].md`

**Quarterly (every 3 months):**

1. [ ] Review 3-month trend for each SLO
2. [ ] Are we approaching budget limits in any category?
3. [ ] Plan any threshold adjustments needed
4. [ ] Auditor review of compliance trend

---

## References

- **SLO Setup:** `.planning/docs/SLO_TRACKING_SETUP.md`
- **Quick Start:** `.planning/docs/SLO_TRACKING_QUICKSTART.md`
- **Dashboard:** `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json`
- **Monthly Report Template:** `.planning/docs/SLO_MONTHLY_REPORT_TEMPLATE.md`
- **Cloud Logs Guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`
- **Incident Response:** `docs/DR_PLAN.md`
- **Audit Trail Details:** `docs/adr/ADR-0012-rdc-978-audit-trail-logical-signature.md`

---

**Status:** Ready for deployment  
**Last Updated:** 2026-05-07
