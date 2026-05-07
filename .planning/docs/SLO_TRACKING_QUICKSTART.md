# SLO Tracking — Quick Start Checklist (30 min setup)

**Date Created:** 2026-05-07  
**Owner:** DevOps Lead  
**Time Investment:** 30 min setup, 5 min/week maintenance

---

## Pre-Requisites

- [ ] GCP account with Editor+ role on `hmatologia2`
- [ ] Access to [Cloud Console](https://console.cloud.google.com)
- [ ] Slack workspace access (for notifications)
- [ ] PagerDuty account (for critical alerts)

---

## Setup Timeline

### 5 min: Prep

- [ ] Read `.planning/docs/SLO_TRACKING_SETUP.md` (full spec)
- [ ] Locate dashboard JSON at `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json`
- [ ] Open [Cloud Console Monitoring](https://console.cloud.google.com/monitoring)
- [ ] Confirm project is set to `hmatologia2` (top-left dropdown)

### 10 min: Import Dashboard

1. [ ] Left sidebar → **Dashboards**
2. [ ] Click **CREATE DASHBOARD**
3. [ ] Click **⋮** → **Import dashboard**
4. [ ] Copy-paste contents of `SLO_TRACKING_DASHBOARD.json`
5. [ ] Click **Import**
6. [ ] Rename to `HC Quality — SLO Tracking` (optional)
7. [ ] Click **Save**
8. [ ] Verify all tiles load (may take 2-5 min for data to appear)

### 8 min: Create Alerts (4 policies × 2 min each)

**Alert 1: Availability (70% budget)**
- [ ] Cloud Monitoring → **Alert Policies** → **Create Policy**
- [ ] Name: `HC Quality Availability Budget 70%`
- [ ] Metric: `compute.googleapis.com | uptime`
- [ ] Condition: `uptime < 99.65%`
- [ ] Duration: `5 minutes`
- [ ] Notification: Slack #observability
- [ ] **Create**

**Alert 2: Performance (P99 >2.5s)**
- [ ] **Create Policy**
- [ ] Name: `HC Quality Latency P99 >2.5s`
- [ ] Metric: `cloudfunctions.googleapis.com | function/execution_times`
- [ ] Aggregation: 95th percentile
- [ ] Condition: `P99 > 2500` (milliseconds)
- [ ] Duration: `15 minutes sustained`
- [ ] Notification: Slack #observability
- [ ] **Create**

**Alert 3: Error Rate (>0.1%)**
- [ ] **Create Policy**
- [ ] Name: `HC Quality Error Rate >0.1%`
- [ ] Metric: `logging.googleapis.com | user_defined_metric`
- [ ] Condition: `error_rate > 0.001`
- [ ] Duration: `5 minutes`
- [ ] Notification: PagerDuty (critical)
- [ ] **Create**

**Alert 4: Audit Trail (<100%)**
- [ ] **Create Policy**
- [ ] Name: `HC Quality Audit Trail Capture <100%`
- [ ] Metric: `logging.googleapis.com | audit_trail_capture_rate`
- [ ] Condition: `capture_rate < 1.0`
- [ ] Duration: `1 minute`
- [ ] Notification: PagerDuty + Slack #compliance
- [ ] **Create**

### 5 min: Setup Custom Metrics

**Error Rate Metric:**
- [ ] Logs Explorer → **Create Metric**
- [ ] Filter: `severity=ERROR AND (resource.type="cloud_function" OR resource.type="cloud_run")`
- [ ] Metric Name: `error_rate_percent`
- [ ] Type: GAUGE
- [ ] **Create**

**Audit Trail Metric:**
- [ ] **Create Metric**
- [ ] Filter: `resource.type="cloud_firestore" AND resource.namespace="audit-trail"`
- [ ] Metric Name: `audit_trail_events_captured`
- [ ] **Create**

**Expected Writes Metric:**
- [ ] **Create Metric**
- [ ] Filter: `resource.type="cloud_firestore" AND jsonPayload.operation="create"`
- [ ] Metric Name: `audit_trail_expected_writes`
- [ ] **Create**

### 2 min: Schedule Weekly Review

- [ ] Cloud Console → **Cloud Scheduler**
- [ ] **Create Job**
- [ ] Name: `hc-quality-slo-weekly-review`
- [ ] Frequency: `0 09 * * 1` (Monday 09:00 UTC)
- [ ] HTTP GET: `https://hmatologia2.web.app/admin/slo-report`
- [ ] **Create**

OR (manual alternative):
- [ ] Add recurring Slack reminder: `/remind #observability "SLO weekly review" every Monday at 09:00 UTC`

---

## Daily Checks (2 min)

**Every morning:**

1. [ ] Open [SLO Tracking Dashboard](https://console.cloud.google.com/monitoring/dashboards) (bookmark it)
2. [ ] Check all 4 SLO cards:
   - [ ] Availability: green ✓
   - [ ] Performance: green ✓
   - [ ] Error Rate: green ✓
   - [ ] Audit Trail: green ✓
3. [ ] If any card is yellow/red:
   - [ ] Click on it → drill down into logs
   - [ ] Slack #observability with screenshot + brief note
4. [ ] Check alert history (Cloud Monitoring → Alert Policies → scroll down)
   - [ ] Any new incidents?

---

## Weekly Review (5 min)

**Every Monday at 09:00 UTC:**

1. [ ] Open SLO Tracking Dashboard
2. [ ] Compare to last week:
   - [ ] Availability trending up or down?
   - [ ] Latency getting slower?
   - [ ] Error rate stable?
3. [ ] Take screenshot
4. [ ] Post to Slack #observability:
   ```
   **SLO Weekly Review — [Date]**
   
   Availability: 99.94% ✅ | Performance: 2.1s P99 ✅ | Error Rate: 0.003% ✅ | Audit Trail: 100% ✅
   
   Trend: Stable | Incidents: 0 | Budget Remaining: 3.2h
   
   [screenshot]
   ```

---

## Monthly Report (30 min)

**Last day of each calendar month:**

1. [ ] Export SLO data (Cloud Monitoring → Dashboard → **Export to PDF**)
2. [ ] Fill `SLO_MONTHLY_REPORT_TEMPLATE.md`:
   - [ ] Availability %
   - [ ] Performance P99
   - [ ] Error rate
   - [ ] Audit trail capture %
   - [ ] Incident RCA (if any)
   - [ ] Budget consumed
3. [ ] Get sign-offs:
   - [ ] DevOps Lead: ______ Date: ______
   - [ ] CTO: ______ Date: ______
   - [ ] Auditor: ______ Date: ______
4. [ ] Save to `.planning/reports/SLO_REPORT_[YYYY-MM].md`
5. [ ] Upload to auditor system (or Slack #compliance)

---

## Alert Escalation

**Alert fires:**

1. [ ] Slack notification appears in #observability (auto)
2. [ ] If **RED** (SLO violation):
   - [ ] PagerDuty page fires (auto)
   - [ ] Oncall engineer: Acknowledge within 15 min
   - [ ] Open incident ticket in your ticketing system
   - [ ] Follow `docs/DR_PLAN.md` incident response
3. [ ] If **ORANGE** (80% budget):
   - [ ] Slack notification (team reads it)
   - [ ] Team lead: Schedule sync within 1 hour
   - [ ] Review recent changes (deploy, traffic spike, etc.)
4. [ ] If **YELLOW** (70% budget):
   - [ ] Slack notification
   - [ ] Weekly review will cover it

---

## Testing Alerts (optional, but recommended)

**Test your alert setup without causing real impact:**

1. [ ] Cloud Monitoring → **Alert Policies**
2. [ ] Click any alert → **Test Notification**
3. [ ] Check Slack / PagerDuty received test alert
4. [ ] Repeat for all 4 alert policies

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Dashboard shows "No data" | Wait 5 min, refresh. Metrics take time to populate. |
| Alert never fires even though error rate is high | Verify custom metric exists in Logs Explorer. Recreate if needed. |
| Slack notifications not arriving | Check notification channel config in Alert Policy. Test manually. |
| P99 latency showing 0ms | Check that functions have executed at least once this hour. Cold-start may delay first data point. |
| Audit trail capture stuck at 0% | Ensure audit functions are writing to `audit-trail` subcollection. Check `docs/adr/ADR-0012` for schema. |

---

## Files Reference

| File | Purpose |
|------|---------|
| `.planning/docs/SLO_TRACKING_SETUP.md` | Full specification (read once) |
| `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json` | Dashboard import JSON |
| `.planning/docs/SLO_TRACKING_QUICKSTART.md` | This checklist |
| `.planning/docs/SLO_MONTHLY_REPORT_TEMPLATE.md` | Monthly report template |
| `docs/CLOUD_LOGS_MONITORING_GUIDE.md` | How to debug logs if alerts fire |
| `docs/DR_PLAN.md` | Incident response playbook |

---

## Rollout Phases

**Phase 1 (Week 1):**
- [ ] Setup dashboard + 4 alerts
- [ ] Team briefing on Slack #observability
- [ ] Oncall engineer briefed on escalation

**Phase 2 (Week 2–4):**
- [ ] Daily checks (catch and fix any false positives)
- [ ] First weekly review
- [ ] First monthly report

**Phase 3 (Month 2+):**
- [ ] SLO tracking becomes standard ops
- [ ] Monthly reports to auditor
- [ ] Quarterly review of alert thresholds (tune if needed)

---

## Sign-Off

- **Setup Owner:** ________________ Date: ________
- **CTO Review:** ________________ Date: ________
- **Ops Lead Acknowledgment:** ________________ Date: ________

Ready to deploy: [ ] Yes [ ] No

If not ready, note blockers:
_________________________________________________________________

---

**Questions?** Post in Slack #observability or open issue in repo.

Next: Monitor for 7 days, then schedule full review.
