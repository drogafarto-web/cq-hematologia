# SLO Tracking Setup — v1.3+ Production Monitoring

**Document Version:** 1.0  
**Date:** 2026-05-07  
**Status:** Ready for deployment  
**Owner:** DevOps / Observability

---

## Executive Summary

SLO (Service Level Objective) tracking provides continuous visibility into HC Quality's production health against four key dimensions: **Availability**, **Performance**, **Error Rate**, and **Compliance**. This setup enables:

- Real-time SLO burndown (how much error budget remains this month?)
- Auditor-ready monthly reports
- Automated alerts at 70%, 80%, 90% error budget consumption
- Daily SLO status dashboard (green/yellow/red)

**Deploy Time:** 30 minutes  
**Maintenance:** 5 min/week (check alert status)

---

## SLO Definitions

### 1. Availability: 99.5% Uptime

**Target:** Firebase + Hosting + Functions all ≥99.5% available  
**Monthly Budget:** 4.32 hours downtime (360 minutes)  
**Measurement Window:** 30-day rolling calendar month

**Metrics:**

- `firebase.uptime` — Firestore + Auth service health (from Firebase status page)
- `hosting.uptime` — Cloud Hosting (hmatologia2.web.app) HTTP 200 responses
- `functions.uptime` — Cloud Functions (all regions) execution success rate

**Alert Thresholds:**

- YELLOW (70% budget consumed): <99.65% in rolling 7 days
- ORANGE (80% budget consumed): <99.58% in rolling 7 days
- RED (90% budget consumed): <99.51% in rolling 7 days

**Acceptable Downtime Sources:**

- Planned maintenance (weekly Friday 02:00–03:00 UTC via Cloud Scheduler)
- GCP regional incidents (excluded from SLO post-incident review)

---

### 2. Performance: P99 Latency <3s

**Target:** 95% of all requests complete in <3 seconds (P99 <3s)  
**Monthly Budget:** 1.5% of requests can exceed 3s (75,000 out of 5M requests/month)

**Metrics:**

- `cloud_function_duration_ms` — per module (analyzer, coagulacao, ciq-imuno, etc.)
- `http_response_time_ms` — Hosting responses (hosting.googleapis.com)
- `firestore_read_latency_ms` — Firestore document reads

**Alert Thresholds:**

- YELLOW: P99 latency 2.5s (15-min sustained)
- RED: P99 latency >3.0s (5-min sustained) + >1% error rate

**Excluded (not SLO):**

- First cold-start after function update (expected, monitored separately)
- Requests during GCP quota throttling (logged as `RESOURCE_EXHAUSTED`)

---

### 3. Error Rate: <0.1%

**Target:** Fewer than 1 error per 1,000 requests (0.1% daily average)  
**Monthly Budget:** ~50,000 errors allowed in 5M requests/month

**Metrics:**

- HTTP 5xx responses (500, 502, 503, 504)
- Uncaught exceptions in Cloud Functions
- Firestore `PERMISSION_DENIED` + `INTERNAL` errors
- Client-side JavaScript errors (RUM)

**Error Categories:**

- **Unrecoverable:** `INTERNAL`, `UNAVAILABLE`, `DEADLINE_EXCEEDED` → SLO violates immediately
- **Recoverable:** Transient network errors (client retries) → counted only if final attempt fails
- **Excluded:** `PERMISSION_DENIED` after v1.3 (rules are permissive during implantação; will tighten Phase 4)

**Alert Thresholds:**

- YELLOW: >0.05% daily rate (500 errors/day in 5M requests)
- RED: >0.1% sustained 30 min (1,000 errors)

---

### 4. Compliance: 100% Audit Trail

**Target:** 100% of RDC 978 audit-relevant writes must appear in audit trail  
**Monthly Budget:** Zero missed events (0% tolerance)

**Metrics:**

- `audit_trail_capture_rate` — (events in audit collection) / (expected writes)
- `audit_trail_lag_p99` — write→audit latency, P99 <500ms

**Expected Writes per Month:** ~50,000 (CIQ runs, DICQ docs, training records, risk assessments)

**Audit-Relevant Operations:**

- CIQ run creation / approval / invalidation
- Documento da Qualidade edits / signature
- POP certification / training assignment
- Risk assessment / NC severity change
- User access grant / revocation

**Alert Thresholds:**

- RED: <100% capture (any missed event) → immediate investigation
- YELLOW: P99 lag >500ms (5 min window)

---

## Implementation: 4 Steps

### Step 1: Import Dashboard JSON to Cloud Monitoring (5 min)

**Dashboard Location:** `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json`

**To Import:**

1. Open [Cloud Console Monitoring](https://console.cloud.google.com/monitoring) on `hmatologia2` project
2. Left sidebar → **Dashboards**
3. Click **CREATE DASHBOARD**
4. In the toolbar, click **⋮** (more options) → **Import dashboard**
5. Paste the contents of `SLO_TRACKING_DASHBOARD.json`
6. Click **Import**
7. Rename to `HC Quality — SLO Tracking` (or keep auto-name)
8. Click **Save**

**Dashboard Contents:**

- SLO burndown chart (error budget remaining by day)
- Uptime timeline (green/yellow/red by service)
- P99 latency trend (7-day moving average per module)
- Error rate heatmap (by module, by hour)
- Audit trail capture rate (must stay 100%)

---

### Step 2: Create Error Budget Alert Policies (10 min)

**Alert Policy 1: Availability Budget (70%)**

1. Open [Cloud Monitoring → Alert Policies](https://console.cloud.google.com/monitoring/alertpolicies)
2. Click **Create Policy**
3. **Condition Name:** `HC Quality Availability Budget 70%`
4. **Metric:** `compute.googleapis.com | uptime`
5. **Filter:** `resource.project_id = "hmatologia2"`
6. **Condition:** `uptime < 99.65%` (30-day rolling)
7. **Duration:** 5 minutes
8. **Notification Channel:** Slack #observability (or email)
9. Click **Create Policy**

**Alert Policy 2: Performance Budget (sustained P99 >2.5s)**

1. Click **Create Policy**
2. **Condition Name:** `HC Quality Latency P99 >2.5s (Yellow)`
3. **Metric:** `cloudfunctions.googleapis.com | function/execution_times`
4. **Filter:** `resource.labels.function_name != ""`
5. **Aggregation:** 95th percentile
6. **Condition:** `P99 > 2500` (milliseconds)
7. **Duration:** 15 minutes sustained
8. **Notification Channel:** Slack #observability
9. Click **Create Policy**

**Alert Policy 3: Error Rate (>0.1%)**

1. Click **Create Policy**
2. **Condition Name:** `HC Quality Error Rate >0.1%`
3. **Metric:** `logging.googleapis.com | user_defined_metric` (custom metric, see Step 3)
4. **Condition:** `error_rate > 0.001` (0.1%)
5. **Duration:** 5 minutes
6. **Notification Channel:** PagerDuty (critical)
7. Click **Create Policy**

**Alert Policy 4: Audit Trail Capture (<100%)**

1. Click **Create Policy**
2. **Condition Name:** `HC Quality Audit Trail Capture <100%`
3. **Metric:** `logging.googleapis.com | audit_trail_capture_rate`
4. **Condition:** `capture_rate < 1.0`
5. **Duration:** 1 minute (zero tolerance)
6. **Notification Channel:** PagerDuty (critical) + Slack #compliance
7. Click **Create Policy**

---

### Step 3: Configure Custom Metrics (functions + audit trail) (10 min)

HC Quality's error rate and audit trail metrics are **user-defined** — they come from Cloud Logs patterns, not native metrics.

**Error Rate Metric (Cloud Logs → Metrics):**

1. Open [Cloud Console Logs → Logs Explorer](https://console.cloud.google.com/logs/query)
2. **Create Metric** button (top right)
3. **Log Filter:**
   ```
   severity=ERROR
   AND (
     resource.type="cloud_function"
     OR resource.type="cloud_run"
     OR jsonPayload.error="true"
   )
   ```
4. **Metric Name:** `projects/hmatologia2/metrics/error_rate_percent`
5. **Metric Type:** GAUGE
6. **Value Field:** (leave empty — count by default)
7. **Click Create**

This creates a metric that counts ERROR-level logs. The dashboard will then calculate `error_count / total_requests * 100`.

**Audit Trail Capture Metric:**

1. Open Logs Explorer again
2. **Create Metric**
3. **Log Filter:**
   ```
   resource.type="cloud_firestore"
   AND resource.database="(default)"
   AND resource.namespace="audit-trail"
   ```
4. **Metric Name:** `projects/hmatologia2/metrics/audit_trail_events_captured`
5. **Metric Type:** GAUGE
6. **Click Create**

Then, create a second metric for **expected writes** (writes to CIQ/DICQ collections):

1. **Create Metric**
2. **Log Filter:**
   ```
   resource.type="cloud_firestore"
   AND (
     resource.document_path=~".*/(runs|docs|pops|audits|risks)/.*"
   )
   AND jsonPayload.operation="create"
   ```
3. **Metric Name:** `projects/hmatologia2/metrics/audit_trail_expected_writes`
4. **Click Create**

The capture rate = `audit_trail_events_captured / audit_trail_expected_writes`. This will be displayed on the dashboard and used in Alert Policy 4.

---

### Step 4: Schedule Weekly SLO Review (ongoing, 5 min/week)

**Recurring Task (via Cloud Scheduler):**

1. Open [Cloud Console → Cloud Scheduler](https://console.cloud.google.com/cloudscheduler)
2. Click **Create Job**
3. **Name:** `hc-quality-slo-weekly-review`
4. **Frequency:** `0 09 * * 1` (Mondays 09:00 UTC)
5. **Timezone:** `UTC`
6. **Execution Type:** `HTTP`
7. **HTTP Method:** `GET`
8. **URL:** `https://hmatologia2.web.app/admin/slo-report` (or internal webhook)
9. **Headers:** Add `Authorization: Bearer <your-firebase-admin-token>`
10. **Click Create**

This will trigger a server-side Cloud Function that:

- Queries last 7 days of SLO metrics
- Generates JSON report
- Sends to Slack #compliance
- Logs to `slo_review_completed` event

**Manual Alternative (no Cloud Scheduler):**

Weekly on Monday morning, an engineer navigates to the SLO Tracking Dashboard and:

1. Checks all 4 SLO cards (green/yellow/red)
2. Takes a screenshot
3. Compares to previous week (trending up or down?)
4. Notes any alerts in the review template (see Step 5)
5. Adds to team Slack in #observability

---

### Step 5: Monthly SLO Review for Auditor

**Timing:** Last day of each calendar month (May 31, June 30, etc.)

**Owner:** DevOps lead + observability engineer

**Duration:** 30 minutes

**Report Template:**

Save as `.planning/docs/SLO_MONTHLY_REPORT_TEMPLATE.md` and fill monthly:

```markdown
# HC Quality SLO Review — May 2026

**Period:** 2026-05-01 to 2026-05-31 (31 days)  
**Generated:** 2026-06-01  
**Reviewer:** [DevOps Lead Name]  
**Sign-off:** [ ] CTO · [ ] QA Lead · [ ] Auditor

---

## 1. Availability (Target: 99.5% = 4.32 hours budget)

| Service              | Uptime     | Status   | Notes                                                |
| -------------------- | ---------- | -------- | ---------------------------------------------------- |
| Firebase (Firestore) | 99.98%     | PASS     | —                                                    |
| Cloud Hosting        | 99.97%     | PASS     | —                                                    |
| Cloud Functions      | 99.89%     | PASS     | 1 incident (2026-05-14, 45 min, GCP regional outage) |
| **Composite**        | **99.94%** | **PASS** | Budget: 3.2h used, 1.1h remaining                    |

**Incidents:** GCP southamerica-east1 maintenance window (planned, May 14 02:00–02:45). No SLO credit required.

**Status:** ✅ **PASS** — 99.94% > 99.5% target

---

## 2. Performance (Target: P99 <3s, budget 1.5% requests)

| Module                | P99 Latency | Budget Used | Status   |
| --------------------- | ----------- | ----------- | -------- |
| analyzer              | 1,240ms     | 0%          | PASS     |
| coagulacao            | 892ms       | 0%          | PASS     |
| ciq-imuno             | 756ms       | 0%          | PASS     |
| ... (25 more modules) | —           | —           | —        |
| **Composite P99**     | **2,145ms** | **<0.1%**   | **PASS** |

**7-day avg:** 2,089ms (trending stable)  
**Peak:** 2,856ms (May 23, 11:00 UTC, analyzer OCR spike—expected during load test)

**Status:** ✅ **PASS** — All modules <3s, budget <0.1% consumed

---

## 3. Error Rate (Target: <0.1%, budget ~50k errors/month in 5M requests)

| Category                  | Count   | Rate         | Status   |
| ------------------------- | ------- | ------------ | -------- |
| HTTP 5xx                  | 127     | 0.00254%     | PASS     |
| Uncaught JS exceptions    | 34      | 0.00068%     | PASS     |
| Firestore INTERNAL errors | 8       | 0.00016%     | PASS     |
| **Total**                 | **169** | **0.00338%** | **PASS** |

**Errors analyzed:** 0 sev-1, 5 sev-2 (retry succeeded), 164 sev-3 (transient)

**Root causes:**

- 89 errors: OCR timeout (Gemini Vision API rate limit, auto-backoff working)
- 50 errors: Transient Firebase auth token refresh
- 30 errors: Client-side network timeouts (user's ISP)

**Status:** ✅ **PASS** — 0.00338% << 0.1% target, budget 0.01% consumed

---

## 4. Compliance: Audit Trail (Target: 100% capture, 0 tolerance)

| Metric                                  | Value  | Status          |
| --------------------------------------- | ------ | --------------- |
| Expected writes (CIQ/DICQ/POP/training) | 47,293 | —               |
| Audit events captured                   | 47,293 | MATCH           |
| Capture rate                            | 100.0% | PASS            |
| P99 lag (write→audit)                   | 142ms  | <500ms target ✓ |

**Missed events:** 0  
**Lag outliers:** 3 events >500ms (all during 2026-05-13 function cold-start; acceptable)

**Status:** ✅ **PASS** — 100% capture, audit trail operational

---

## Summary

| SLO             | Target | Achieved | Status |
| --------------- | ------ | -------- | ------ |
| Availability    | 99.5%  | 99.94%   | ✅     |
| Performance P99 | <3s    | 2.145s   | ✅     |
| Error Rate      | <0.1%  | 0.00338% | ✅     |
| Audit Trail     | 100%   | 100.0%   | ✅     |

**Overall Status:** ✅ **EXCELLENT**

---

## Incidents & RCA

### Incident: May 14, 02:00–02:45 UTC (45 min)

**Impact:** Hosting (hmatologia2.web.app) down, Functions degraded  
**Cause:** GCP regional maintenance in southamerica-east1  
**Detection:** Alert firing 30s after impact  
**Mitigation:** Automatic re-routing to backup services (not yet live in v1.3)  
**SLO Credit:** Post-incident review by Google Cloud SRE confirms GCP-caused outage; SLO credit applied (downtime excluded)

---

## Alerts Fired

| Alert                      | Date             | Duration | Resolution                                                    |
| -------------------------- | ---------------- | -------- | ------------------------------------------------------------- |
| Availability <99.65% (70%) | 2026-05-14 02:00 | 45 min   | GCP incident, auto-resolved                                   |
| Latency P99 >2.5s          | 2026-05-23 11:15 | 8 min    | analyzer module OCR load test (expected), manual check passed |

**Total alert fatigue:** 2 events in 31 days = healthy (no false positives)

---

## Recommendations (Next Period)

1. **Phase 4+:** Implement multi-region failover for Hosting (currently single region)
2. **Phase 4+:** Set up custom metrics dashboard for per-module SLO tracking (vs. composite)
3. **Audit:** Plan quarterly SLO review with external auditor (currently monthly, CTO-only)
4. **OCR:** Monitor Gemini Vision API rate limits; consider client-side batch optimization (Phase 5)

---

## Sign-Off

- **DevOps Lead:** ****\_\_\_\_**** Date: **\_\_\_**
- **CTO Review:** ****\_\_\_\_**** Date: **\_\_\_**
- **Auditor Acknowledgment:** ****\_\_\_\_**** Date: **\_\_\_**

Next Review: 2026-06-30
```

---

## Dashboard JSON Format

**File Location:** `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json`

The dashboard JSON is pre-built (see separate artifact `SLO_TRACKING_DASHBOARD.json`) and contains:

- **SLO Burndown Chart:** Error budget consumed (%) over the month
- **Uptime Timeline:** Daily uptime status (green/yellow/red bars)
- **P99 Latency Trend:** 7-day moving average per module
- **Error Rate Heatmap:** Errors/min by module + hour-of-day
- **Audit Trail Capture:** Real-time % (must be 100%)

---

## Alert Escalation Path

**Severity Levels:**

| Severity            | SLO Impact                      | Alert Channel                | Response SLA         |
| ------------------- | ------------------------------- | ---------------------------- | -------------------- |
| **Critical (Red)**  | Immediate SLO violation         | PagerDuty + Slack #sev-1     | 15 min (page oncall) |
| **High (Orange)**   | 10% of budget consumed in 24h   | Slack #observability + email | 1 hour (team review) |
| **Medium (Yellow)** | 5% of budget consumed in 7 days | Slack #observability         | Next business day    |
| **Info (Green)**    | On track                        | Weekly Slack report          | N/A                  |

**Escalation:**

1. Alert fires → Slack notification (immediate)
2. If Red (SLO violation): PagerDuty → page oncall engineer
3. Oncall: 15 min to acknowledge + 30 min to open incident ticket
4. Incident commander: Follow `docs/DR_PLAN.md` escalation path
5. Post-incident: RCA within 24h, report in monthly SLO review

---

## Troubleshooting

**Q: Dashboard says "No data" for a metric**  
A: Custom metrics take 2–5 minutes to appear after creation. Wait 5 min, then refresh. If still blank, check that the log filter matches actual logs in Logs Explorer.

**Q: Alert never fires even though error rate is high**  
A: Verify the custom metric threshold logic. Open Logs Explorer → create test query with your filter → confirm >0 results. If metric is absent, re-create it (may have syntax error).

**Q: How do I test the alerts?**  
A: In Cloud Monitoring → Alert Policies → click policy → **Test Notification** button. This sends a test alert to your Slack/email/PagerDuty channel.

**Q: Can I silence alerts during planned maintenance?**  
A: Yes. Cloud Monitoring → Alert Policies → click policy → **Notification Channels** → toggle "Disable notifications" during maintenance window. Re-enable after.

---

## Success Criteria

By end of week:

- [ ] Dashboard imported to Cloud Console
- [ ] 4 Alert Policies created + tested
- [ ] Custom metrics (error_rate, audit_trail_capture) reporting data
- [ ] Team notified of Slack #observability channel
- [ ] First weekly review scheduled for Monday morning
- [ ] Monthly SLO report template saved
- [ ] Oncall engineer briefed on alert escalation path

---

## References

- **Dashboard:** `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json`
- **Cloud Monitoring Console:** https://console.cloud.google.com/monitoring
- **Cloud Logs Guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`
- **Incident Response:** `docs/DR_PLAN.md`
- **RDC 978 Audit Trail:** `docs/adr/ADR-0012-rdc-978-audit-trail-logical-signature.md`

---

**Status:** Ready for deployment  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-05-14 (after first week of monitoring)
