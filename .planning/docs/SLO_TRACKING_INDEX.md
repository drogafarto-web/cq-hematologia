# SLO Tracking Setup — Complete Index

**Date:** 2026-05-07  
**Status:** Ready for deployment (all artifacts complete)  
**Total Setup Time:** 30 minutes  

---

## Quick Navigation

| Role | Document | Purpose | Time |
|------|----------|---------|------|
| **DevOps Lead** | `SLO_TRACKING_QUICKSTART.md` | Step-by-step setup checklist | 5 min read |
| **Team Lead** | `SLO_TRACKING_SETUP.md` | Full specification + context | 10 min read |
| **Alert Owner** | `SLO_ALERT_POLICIES_REFERENCE.md` | Exact alert config + thresholds | Reference |
| **Auditor** | `SLO_MONTHLY_REPORT_TEMPLATE.md` | Monthly compliance report | Template |

---

## Setup Artifacts

### 1. Quick Start (30 min to live)

**File:** `.planning/docs/SLO_TRACKING_QUICKSTART.md`

Execution checklist with exact steps:
- [ ] Dashboard import (10 min)
- [ ] Alert policies (8 min)
- [ ] Custom metrics (5 min)
- [ ] Weekly review setup (2 min)
- [ ] Testing (5 min)

**Start here if:** You're deploying today and want to move fast.

---

### 2. Full Specification

**File:** `.planning/docs/SLO_TRACKING_SETUP.md`

Complete SLO definitions + rationale:

**1. Availability SLO (99.5%)**
- 4.32 hours monthly downtime budget
- Alert thresholds: 70% / 80% / 90% budget consumed
- Metrics: Firebase + Hosting + Functions uptime

**2. Performance SLO (P99 <3s)**
- 1.5% of requests allowed to exceed 3s
- Alert thresholds: YELLOW (2.5s) / RED (3.0s)
- Metrics: Per-module execution times

**3. Error Rate SLO (<0.1%)**
- ~50k errors allowed per month in 5M requests
- Alert thresholds: YELLOW (0.05%) / RED (0.1%)
- Metrics: HTTP 5xx + uncaught exceptions

**4. Compliance SLO (100% audit trail)**
- Zero tolerance for missed audit events (RDC 978)
- Alert threshold: Capture rate <100% = RED
- Metrics: Events in audit-trail / expected writes ratio

---

### 3. Alert Configuration Reference

**File:** `.planning/docs/SLO_ALERT_POLICIES_REFERENCE.md`

Four alert policies with exact configuration:

**Alert 1: Availability Budget (70%)**
- Metric: `compute.googleapis.com/uptime`
- Threshold: <99.65%
- Duration: 5 min sustained
- Notification: Slack #observability

**Alert 2: Performance P99**
- Metric: `cloudfunctions.googleapis.com/function/execution_times`
- Threshold: >2500ms (YELLOW) or >3000ms (RED)
- Duration: 15 min (YELLOW) / 5 min (RED)
- Notification: Slack #observability (yellow), PagerDuty (red)

**Alert 3: Error Rate**
- Metric: `logging.googleapis.com/user_defined_metric/error_rate_percent`
- Threshold: >0.001 (0.1%)
- Duration: 5 min sustained
- Notification: PagerDuty (critical)

**Alert 4: Audit Trail Capture**
- Metric: Custom metric (audit events captured / expected)
- Threshold: <1.0 (100%)
- Duration: 1 minute (zero tolerance)
- Notification: PagerDuty + Slack #compliance

**Also includes:**
- How to test each alert
- Tuning guidance (when to tighten/loosen)
- Integration with incident response (docs/DR_PLAN.md)

---

### 4. Dashboard JSON (importable)

**File:** `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json`

Pre-built Google Cloud Monitoring dashboard with:

- **SLO Burndown Chart** — error budget consumed (%) over month
- **Uptime Timeline** — daily service health (green/yellow/red)
- **P99 Latency Trend** — 7-day moving average per module
- **Error Rate Heatmap** — errors/hour by module
- **Audit Trail Capture** — real-time % (must be 100%)
- **Status Cards** — Firebase / Functions / Hosting health

**To use:**
1. Cloud Console → Dashboards → Create Dashboard
2. Click ⋮ → Import Dashboard
3. Paste JSON contents
4. Click Import
5. Done (tiles populate in 2–5 min)

---

### 5. Monthly Report Template

**File:** `.planning/docs/SLO_MONTHLY_REPORT_TEMPLATE.md`

Auditor-ready monthly SLO review template:

**Sections:**
1. Executive Summary (scorecard)
2. Availability analysis + uptime by service
3. Performance analysis + P99 latency by module
4. Error Rate analysis + root causes
5. Compliance: Audit Trail capture rate
6. Summary + budget consumed
7. Incident RCAs
8. Recommendations
9. Sign-offs (DevOps / CTO / Auditor)

**Fill once per month (30 min):**
- Export metrics from dashboard
- Fill in actual numbers
- Note any incidents
- Get sign-offs
- Archive in `.planning/reports/SLO_REPORT_[YYYY-MM].md`

---

## Deployment Flow (5 phases)

### Phase 1: Setup (Today, 30 min)

1. [ ] Read `SLO_TRACKING_QUICKSTART.md`
2. [ ] Import `SLO_TRACKING_DASHBOARD.json`
3. [ ] Create 4 alert policies
4. [ ] Create 3 custom metrics
5. [ ] Test all alerts
6. [ ] Brief team in Slack #observability

**Outcome:** Dashboard live, alerts armed, team aware

---

### Phase 2: Verification (Week 1, daily 2 min)

Each morning:
1. [ ] Open SLO Tracking Dashboard
2. [ ] Check 4 SLO cards (all green?)
3. [ ] Review alert history
4. [ ] Post daily status to Slack

**Outcome:** Baseline established, false positives identified

---

### Phase 3: Weekly Reviews (Week 2+, 5 min/week)

Every Monday at 09:00 UTC:
1. [ ] Open dashboard
2. [ ] Compare to previous week
3. [ ] Screenshot + post to Slack #observability
4. [ ] Note any trends (↑ / ↓ / →)

**Outcome:** Team awareness of SLO health

---

### Phase 4: Monthly Reporting (Month 2+, 30 min/month)

Last day of each month:
1. [ ] Fill `SLO_MONTHLY_REPORT_TEMPLATE.md`
2. [ ] Export metrics from dashboard
3. [ ] Get sign-offs (DevOps / CTO / Auditor)
4. [ ] Archive as `SLO_REPORT_[YYYY-MM].md`
5. [ ] Upload to auditor portal

**Outcome:** Auditor-ready compliance reports

---

### Phase 5: Tuning (Quarter 2+, as needed)

Every 3 months:
1. [ ] Review 3-month trend for each SLO
2. [ ] Adjust thresholds if data supports
3. [ ] Document changes in ADR
4. [ ] Brief auditor

**Outcome:** SLOs match actual production behavior

---

## Key Files Reference

| File | Location | Purpose |
|------|----------|---------|
| Quick Start | `.planning/docs/SLO_TRACKING_QUICKSTART.md` | 30-min execution checklist |
| Full Spec | `.planning/docs/SLO_TRACKING_SETUP.md` | Complete SLO definitions + context |
| Alert Ref | `.planning/docs/SLO_ALERT_POLICIES_REFERENCE.md` | Exact alert configuration |
| Dashboard JSON | `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json` | Importable Cloud Monitoring dashboard |
| Report Template | `.planning/docs/SLO_MONTHLY_REPORT_TEMPLATE.md` | Monthly compliance report |
| This Index | `.planning/docs/SLO_TRACKING_INDEX.md` | Navigation + overview |

---

## SLO Definitions at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                 HC Quality SLOs (v1.3+)                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. AVAILABILITY: 99.5% uptime                              │
│     Budget: 4.32 hours/month                                │
│     Metrics: Firebase + Hosting + Functions all ≥99.5%     │
│     Alerts: 70% / 80% / 90% budget consumed                │
│                                                               │
│  2. PERFORMANCE: P99 <3 seconds                             │
│     Budget: 1.5% of requests allowed >3s                   │
│     Metrics: Per-module execution time (95th %ile)         │
│     Alerts: YELLOW 2.5s / RED 3.0s (sustained 15/5 min)   │
│                                                               │
│  3. ERROR RATE: <0.1%                                       │
│     Budget: ~50k errors/month in 5M requests               │
│     Metrics: HTTP 5xx + uncaught exceptions                │
│     Alerts: YELLOW 0.05% / RED 0.1% (sustained 5 min)     │
│                                                               │
│  4. COMPLIANCE: 100% audit trail capture                   │
│     Budget: Zero missed events (0% tolerance)              │
│     Metrics: Audit-trail events / expected writes          │
│     Alerts: RED <100% (1 min) — RDC 978 requirement       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Maintenance Schedule

### Daily (2 min)
- [ ] Check SLO dashboard (all green?)
- [ ] Review overnight alerts

### Weekly (5 min)
- [ ] Monday 09:00 UTC: SLO review + Slack post
- [ ] Check alert policies for false positives

### Monthly (30 min)
- [ ] End of month: Fill SLO report
- [ ] Get sign-offs (DevOps / CTO / Auditor)
- [ ] Archive report

### Quarterly (1 hour)
- [ ] Review 3-month trend
- [ ] Adjust thresholds if needed
- [ ] Brief auditor on any changes

---

## Alert Escalation Path

```
Alert Fires
    ↓
Slack Notification (auto)
    ↓
├─ If RED (SLO violation):
│  ├─ PagerDuty pages oncall (auto)
│  ├─ Oncall: Acknowledge within 15 min
│  ├─ Open incident ticket
│  └─ Follow docs/DR_PLAN.md
│
├─ If ORANGE (80% budget):
│  ├─ Slack notifies team
│  ├─ Lead: Schedule sync within 1 hour
│  └─ Root cause analysis
│
└─ If YELLOW (70% budget):
   ├─ Slack notification
   └─ Monday weekly review will address
```

---

## Testing

### Test Alert Delivery (before going live)

1. [ ] For each alert: Cloud Monitoring → click policy → **Test Notification**
2. [ ] Verify Slack / PagerDuty received test alert
3. [ ] Check alert details are clear and actionable

### Test Alert Triggers (optional, but recommended)

1. [ ] **Availability:** Manually turn off a service's health check
2. [ ] **Performance:** Call a slow function (4+ second delay)
3. [ ] **Error Rate:** Trigger intentional errors in logs
4. [ ] **Audit Trail:** Disable audit function temporarily, verify capture drops

---

## Success Criteria (End of Week 1)

By Friday 2026-05-10:

- [ ] Dashboard imported + tiles populate with data
- [ ] 4 alert policies created + tested
- [ ] Custom metrics reporting to Cloud Logs
- [ ] Team briefed on Slack #observability
- [ ] Oncall engineer knows escalation path
- [ ] First weekly review completed (Monday)
- [ ] Zero false positive complaints

---

## FAQ

**Q: What if an alert fires at 3am?**  
A: PagerDuty pages the oncall engineer on-call (setup required separately). Follow incident response playbook (docs/DR_PLAN.md).

**Q: Can I snooze alerts during maintenance?**  
A: Yes. Cloud Monitoring → Alert Policy → **Disable Notifications** during window. Re-enable after.

**Q: What if our metrics baseline is different from these targets?**  
A: Phase 4 tuning: Review 1-month data, adjust thresholds if needed (document in ADR). SLO targets are achievable with v1.3 infrastructure; don't lower targets without CTO approval.

**Q: Do we report SLOs to customers?**  
A: Not in v1.3 (internal monitoring). Phase 4: Customer-facing SLO status page (public dashboard).

**Q: What about multi-region SLOs?**  
A: Phase 4 post-deployment. Currently single region (southamerica-east1). After failover deployed, will track multi-region composite uptime.

---

## References

- **Cloud Monitoring Console:** https://console.cloud.google.com/monitoring
- **Incident Response:** `docs/DR_PLAN.md`
- **Cloud Logs Guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`
- **RDC 978 Audit Trail:** `docs/adr/ADR-0012-rdc-978-audit-trail-logical-signature.md`
- **Deployment Protocol:** `.claude/rules/deploy-protocol.md`

---

## Sign-Off

**Setup Owner:** ___________________________ Date: __________

**CTO Review:** ___________________________ Date: __________

Ready to deploy: [ ] Yes [ ] No

If no, blockers:
________________________________________________________________________

---

**Status:** Ready for immediate deployment  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-05-14 (1 week)
