# SLO Tracking Deployment — Final Checklist

**Date:** 2026-05-07  
**Target Completion:** 2026-05-07 (same day)  
**Time Estimate:** 30 minutes  
**Owner:** DevOps Lead / Observability Engineer  

---

## Pre-Deployment Verification

- [ ] All 6 SLO artifacts created (below)
- [ ] GCP Project: `hmatologia2` configured
- [ ] Cloud Monitoring access verified
- [ ] Slack workspace #observability created / ready
- [ ] PagerDuty integration configured (if using)
- [ ] Team briefing scheduled (post-deploy)

---

## Artifact Checklist

| # | File | Location | Status | Size |
|---|------|----------|--------|------|
| 1 | `SLO_TRACKING_INDEX.md` | `.planning/docs/` | ✅ | ~3 KB |
| 2 | `SLO_TRACKING_QUICKSTART.md` | `.planning/docs/` | ✅ | ~4 KB |
| 3 | `SLO_TRACKING_SETUP.md` | `.planning/docs/` | ✅ | ~8 KB |
| 4 | `SLO_ALERT_POLICIES_REFERENCE.md` | `.planning/docs/` | ✅ | ~7 KB |
| 5 | `SLO_MONTHLY_REPORT_TEMPLATE.md` | `.planning/docs/` | ✅ | ~9 KB |
| 6 | `SLO_TRACKING_DASHBOARD.json` | `.planning/dashboard-json/` | ✅ | ~12 KB |
| 7 | `OBSERVABILITY_SETUP_SUMMARY.md` | `.planning/docs/` | ✅ | ~6 KB |
| 8 | `SLO_DEPLOYMENT_CHECKLIST.md` | `.planning/docs/` | ✅ | This file |

**Total:** 8 documents, ~49 KB of specifications

---

## Execution Steps (In Order)

### Step 1: Dashboard Import (10 min)

**Prerequisites:**
- [ ] Cloud Console access to hmatologia2 project
- [ ] File: `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json` ready

**Actions:**
1. [ ] Open https://console.cloud.google.com/monitoring (project: hmatologia2)
2. [ ] Left sidebar → **Dashboards**
3. [ ] Click **CREATE DASHBOARD**
4. [ ] Click **⋮** (three dots) → **Import dashboard**
5. [ ] Copy-paste entire contents of `SLO_TRACKING_DASHBOARD.json`
6. [ ] Click **Import**
7. [ ] Rename dashboard: `HC Quality — SLO Tracking`
8. [ ] Click **Save**
9. [ ] Wait 2–5 minutes for tiles to load data
10. [ ] Verify all tiles display (may show "Loading..." initially)

**Success Criteria:**
- [ ] Dashboard appears in Dashboards list
- [ ] All 8 tiles visible (Availability, Performance, Error Rate, Audit Trail, Burndown, Timeline, Heatmap, Summary)
- [ ] Dashboard accessible via unique URL

---

### Step 2: Create Alert Policies (8 min, 2 min each)

**Prerequisites:**
- [ ] File: `.planning/docs/SLO_ALERT_POLICIES_REFERENCE.md` (for exact config)
- [ ] Notification channels configured (Slack, PagerDuty)

**Alert Policy 1: Availability Budget 70%**
- [ ] Cloud Monitoring → **Alert Policies** → **Create Policy**
- [ ] Name: `HC Quality Availability Budget 70%`
- [ ] Metric Type: `compute.googleapis.com/uptime`
- [ ] Filter: `resource.type="uptime_url" AND resource.labels.display_name="hmatologia2.web.app"`
- [ ] Condition: `value < 99.65%`
- [ ] Aggregation: 30-day rolling
- [ ] Duration: `5 minutes sustained`
- [ ] Notification Channel: Slack #observability
- [ ] Click **Create Policy**
- [ ] Verify policy created ✓

**Alert Policy 2: Performance P99 >2.5s (YELLOW)**
- [ ] **Create Policy**
- [ ] Name: `HC Quality Latency P99 >2.5s (Yellow)`
- [ ] Metric Type: `cloudfunctions.googleapis.com/function/execution_times`
- [ ] Aggregation: 95th percentile (P99)
- [ ] Condition: `> 2500` milliseconds
- [ ] Duration: `15 minutes sustained`
- [ ] Notification Channel: Slack #observability
- [ ] Click **Create Policy**
- [ ] Verify policy created ✓

**Alert Policy 3: Performance P99 >3.0s (RED)**
- [ ] **Create Policy**
- [ ] Name: `HC Quality Latency P99 >3.0s (Red)`
- [ ] Metric Type: `cloudfunctions.googleapis.com/function/execution_times`
- [ ] Aggregation: 95th percentile (P99)
- [ ] Condition: `> 3000` milliseconds
- [ ] Duration: `5 minutes sustained`
- [ ] Notification Channel: PagerDuty (critical)
- [ ] Click **Create Policy**
- [ ] Verify policy created ✓

**Alert Policy 4: Error Rate >0.1%**
- [ ] **Create Policy**
- [ ] Name: `HC Quality Error Rate >0.1%`
- [ ] Metric Type: `logging.googleapis.com/user_defined_metric/error_rate_percent`
- [ ] Condition: `> 0.001` (0.1%)
- [ ] Duration: `5 minutes sustained`
- [ ] Notification Channel: PagerDuty + Slack #sev-1
- [ ] Click **Create Policy**
- [ ] Verify policy created ✓

**Alert Policy 5: Audit Trail <100%**
- [ ] **Create Policy**
- [ ] Name: `HC Quality Audit Trail Capture <100%`
- [ ] Metric Type: `logging.googleapis.com/user_defined_metric/audit_trail_capture_rate`
- [ ] Condition: `< 1.0` (must be 100%)
- [ ] Duration: `1 minute` (zero tolerance)
- [ ] Notification Channel: PagerDuty + Slack #compliance
- [ ] Click **Create Policy**
- [ ] Verify policy created ✓

---

### Step 3: Create Custom Metrics (5 min)

**Prerequisites:**
- [ ] Cloud Logs access
- [ ] Actual logs being written to Cloud Logs (expected: any deployed project has logs)

**Metric 1: Error Rate**
- [ ] Cloud Logs Explorer → **Create Metric**
- [ ] Log Filter:
  ```
  severity=ERROR
  AND (
    resource.type="cloud_function"
    OR resource.type="cloud_run"
    OR jsonPayload.error="true"
  )
  ```
- [ ] Metric Name: `error_rate_percent`
- [ ] Metric Type: GAUGE
- [ ] Click **Create Metric**
- [ ] Verify creation ✓

**Metric 2: Audit Trail Captured**
- [ ] **Create Metric**
- [ ] Log Filter:
  ```
  resource.type="cloud_firestore"
  AND resource.database="(default)"
  AND resource.namespace="audit-trail"
  ```
- [ ] Metric Name: `audit_trail_events_captured`
- [ ] Metric Type: GAUGE
- [ ] Click **Create Metric**
- [ ] Verify creation ✓

**Metric 3: Audit Trail Expected Writes**
- [ ] **Create Metric**
- [ ] Log Filter:
  ```
  resource.type="cloud_firestore"
  AND (
    resource.document_path=~".*/(runs|docs|pops|audits|risks)/.*"
  )
  AND jsonPayload.operation="create"
  ```
- [ ] Metric Name: `audit_trail_expected_writes`
- [ ] Metric Type: GAUGE
- [ ] Click **Create Metric**
- [ ] Verify creation ✓

---

### Step 4: Test Alert Notifications (5 min)

**Test Each Alert:**

1. [ ] Cloud Monitoring → **Alert Policies**
2. [ ] Click **Alert Policy 1** (Availability)
   - [ ] Click **Test Notification**
   - [ ] Verify Slack #observability receives test alert (within 1 min)
3. [ ] Click **Alert Policy 2** (Latency Yellow)
   - [ ] Click **Test Notification**
   - [ ] Verify Slack #observability receives test alert
4. [ ] Click **Alert Policy 3** (Latency Red)
   - [ ] Click **Test Notification**
   - [ ] Verify PagerDuty receives test alert
5. [ ] Click **Alert Policy 4** (Error Rate)
   - [ ] Click **Test Notification**
   - [ ] Verify PagerDuty receives test alert
6. [ ] Click **Alert Policy 5** (Audit Trail)
   - [ ] Click **Test Notification**
   - [ ] Verify PagerDuty + Slack #compliance receive test alerts

**Success Criteria:**
- [ ] All 5 test notifications delivered
- [ ] Slack notifications appear immediately
- [ ] PagerDuty notifications appear within 1 min
- [ ] No duplicate notifications

---

### Step 5: Setup Weekly Review Job (2 min)

**Option A: Cloud Scheduler (Automated)**
- [ ] Cloud Console → **Cloud Scheduler**
- [ ] Click **Create Job**
- [ ] Name: `hc-quality-slo-weekly-review`
- [ ] Frequency: `0 09 * * 1` (Mondays 09:00 UTC)
- [ ] Timezone: UTC
- [ ] HTTP Method: GET
- [ ] URL: `https://hmatologia2.web.app/admin/slo-report` (or internal webhook)
- [ ] Headers: Add `Authorization: Bearer [Firebase-admin-token]`
- [ ] Click **Create**
- [ ] Verify job created ✓

**Option B: Manual Slack Reminder (If no Cloud Function setup)**
- [ ] Post to Slack #observability:
  ```
  /remind @here "Weekly SLO Review due" every Monday at 09:00 UTC
  ```
- [ ] Verify reminder scheduled ✓

---

### Step 6: Team Briefing (5 min)

**Post in Slack #observability:**

```
📊 SLO Tracking Live!

HC Quality is now monitoring Service Level Objectives:
✅ Availability: 99.5% uptime (4.32h/month budget)
✅ Performance: P99 <3 seconds
✅ Error Rate: <0.1% (50k errors/month budget)
✅ Compliance: 100% audit trail capture (RDC 978)

📈 Dashboard: https://console.cloud.google.com/monitoring/dashboards
⚠️ Alerts: Will post to #observability (info) and #sev-1 (critical)

Daily: Check dashboard (2 min)
Weekly: Review on Mondays 09:00 UTC (5 min)
Monthly: Fill SLO report + sign-off (30 min)

Questions? Post here or read .planning/docs/SLO_TRACKING_INDEX.md

Oncall engineers: You're responsible for PagerDuty alerts. See docs/DR_PLAN.md for escalation path.
```

- [ ] Message posted
- [ ] Team acknowledges in thread

---

## Post-Deployment Verification (Next Day)

**Day 1 (2026-05-08):**

- [ ] Dashboard loads without errors
- [ ] All 4 SLO cards show green status ✅
- [ ] No spurious alert notifications
- [ ] Custom metrics populated (may take 1–2 hours for first data)

**Day 7 (2026-05-14):**

- [ ] First weekly review completed (Monday 09:00)
- [ ] Screenshot posted to Slack #observability
- [ ] Team feedback on dashboard usability received
- [ ] Zero false positive complaints

**Day 30 (2026-06-07):**

- [ ] First monthly SLO report completed
- [ ] All 4 SLOs passed (or incidents documented + RCA'd)
- [ ] Report signed off (DevOps / CTO / Auditor)
- [ ] Report archived in `.planning/reports/SLO_REPORT_2026-05.md`

---

## Rollback Plan (If needed)

If alerts prove problematic:

1. [ ] Cloud Monitoring → Alert Policies
2. [ ] Disable problematic alert: Toggle **Disabled** switch
3. [ ] Post to Slack explaining issue
4. [ ] Adjust threshold (see `SLO_ALERT_POLICIES_REFERENCE.md`)
5. [ ] Re-enable

**Do NOT delete policies** — disable, investigate, fix, re-enable.

---

## Documentation Index

**For DevOps Lead (deploying):**
1. [ ] This checklist (you're reading it)
2. [ ] `SLO_TRACKING_QUICKSTART.md` (step-by-step)

**For Oncall Engineer (responding to alerts):**
1. [ ] `SLO_ALERT_POLICIES_REFERENCE.md` (understand each alert)
2. [ ] `docs/DR_PLAN.md` (incident response playbook)

**For Team Lead (weekly reviews):**
1. [ ] `SLO_TRACKING_INDEX.md` (weekly process)
2. [ ] Dashboard URL (bookmark it)

**For Auditor (monthly reports):**
1. [ ] `SLO_MONTHLY_REPORT_TEMPLATE.md` (fill monthly)
2. [ ] Dashboard access (read-only)
3. [ ] Monthly `.planning/reports/SLO_REPORT_[YYYY-MM].md` files

---

## Success Criteria (Go/No-Go Decision)

**GO if all checked:**
- [ ] Dashboard deployed + tiles load
- [ ] 5 alert policies created + tested
- [ ] 3 custom metrics reporting data
- [ ] Team briefed + acknowledged
- [ ] Weekly/monthly processes defined
- [ ] Oncall engineer briefed on escalation
- [ ] No blockers or showstoppers

**NO-GO if any of:**
- [ ] Dashboard import fails (JSON syntax error)
- [ ] Alerts not firing on test
- [ ] Slack/PagerDuty integration broken
- [ ] Team unable to access dashboard
- [ ] Custom metrics not populating (give 2 hours before deciding)

---

## Sign-Off

**Deployment Owner:** _____________________________

**Date/Time Started:** ___________________________

**Date/Time Completed:** ___________________________

**Overall Status:** [ ] GO — Deployed successfully [ ] NO-GO — Issues found (details below)

**Issues (if NO-GO):**
_________________________________________________________________

**CTO Review Sign-Off:** ___________________________ Date: __________

---

## Next Steps (Post-Deployment)

1. **Today (2026-05-07):** Deploy + team briefing
2. **Next 7 days:** Daily dashboard checks (2 min)
3. **Next Monday (2026-05-14):** First weekly review (5 min)
4. **End of May (2026-05-31):** First monthly SLO report (30 min)
5. **Ongoing:** Maintenance cadence (daily/weekly/monthly)

---

## References

- **Quick Start:** `.planning/docs/SLO_TRACKING_QUICKSTART.md`
- **Full Spec:** `.planning/docs/SLO_TRACKING_SETUP.md`
- **Alert Reference:** `.planning/docs/SLO_ALERT_POLICIES_REFERENCE.md`
- **Dashboard JSON:** `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json`
- **Monthly Report:** `.planning/docs/SLO_MONTHLY_REPORT_TEMPLATE.md`
- **Incident Response:** `docs/DR_PLAN.md`

---

**Status:** Ready to execute  
**Confidence Level:** HIGH (all artifacts complete, no dependencies)  
**Go-Live Target:** Today, 2026-05-07

Proceed with Step 1.
