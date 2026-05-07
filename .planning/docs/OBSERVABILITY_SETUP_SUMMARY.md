# Observability Setup Summary — HC Quality v1.3

**Date:** 2026-05-07  
**Deliverable:** SLO Tracking Dashboard + Alert Policies  
**Status:** Ready for deployment  
**Deploy Time:** 30 minutes  

---

## What Was Built

A complete Service Level Objective (SLO) tracking system for HC Quality production monitoring, enabling:

1. **Real-time SLO visibility** — dashboard shows availability, performance, error rate, audit compliance
2. **Automated alerts** — 4 policies fire when SLOs at risk (70%, 80%, 90% budget consumed)
3. **Auditor-ready reports** — monthly compliance template for RDC 978 + DICQ
4. **Team ops playbook** — daily/weekly/monthly review cadence

---

## Artifacts (5 Files)

All files in `.planning/docs/` and `.planning/dashboard-json/`:

| # | File | Role | Length |
|---|------|------|--------|
| 1 | `SLO_TRACKING_INDEX.md` | Navigation + overview | 1 page |
| 2 | `SLO_TRACKING_QUICKSTART.md` | 30-min execution checklist | 2 pages |
| 3 | `SLO_TRACKING_SETUP.md` | Full specification + context | 6 pages |
| 4 | `SLO_ALERT_POLICIES_REFERENCE.md` | Alert configuration details | 5 pages |
| 5 | `SLO_MONTHLY_REPORT_TEMPLATE.md` | Monthly audit report (fillable) | 8 pages |
| 6 | `SLO_TRACKING_DASHBOARD.json` | Importable Cloud Monitoring dashboard | JSON |

**Total:** 22 pages + JSON dashboard

---

## SLO Definitions

### 1. Availability: 99.5%
- **Target:** Firebase + Hosting + Functions all ≥99.5% uptime
- **Budget:** 4.32 hours downtime per month
- **Metrics:** Firestore uptime, Cloud Hosting uptime, Cloud Functions uptime
- **Alerts:** 70% / 80% / 90% budget consumed
- **Acceptable downtime:** Planned maintenance + GCP regional incidents

### 2. Performance: P99 <3 seconds
- **Target:** 95% of requests complete in <3s (P99 <3s)
- **Budget:** 1.5% of monthly requests can exceed 3s
- **Metrics:** Per-module execution time (95th percentile)
- **Alerts:** YELLOW 2.5s / RED 3.0s sustained
- **Known drivers:** OCR (800–1200ms), PDF export (1500–2200ms), reports (500–800ms)

### 3. Error Rate: <0.1%
- **Target:** Fewer than 1 error per 1,000 requests
- **Budget:** ~50,000 errors per month in 5M requests
- **Metrics:** HTTP 5xx, uncaught exceptions, Firebase INTERNAL/UNAVAILABLE errors
- **Alerts:** YELLOW 0.05% / RED 0.1% sustained 5 min
- **Excluded:** PERMISSION_DENIED (implantação phase), transient network errors if client retries succeed

### 4. Compliance: 100% Audit Trail
- **Target:** Zero missed audit events (RDC 978 Art. 117)
- **Budget:** 0 missed events (zero tolerance)
- **Metrics:** (Audit events captured) / (expected writes) = 100%
- **Alerts:** RED <100% (1 min) + RDC 978 violation flag
- **Audit events:** CIQ runs, DICQ docs, POP certs, training, risk updates, access changes, NC status

---

## How It Works

### Dashboard (Cloud Monitoring)

```
┌────────────────────────────────────────────────┐
│ HC Quality — SLO Tracking Dashboard            │
├────────────────────────────────────────────────┤
│                                                 │
│  [Availability 99.94%]  [P99 Latency 2.1s]    │
│  [Error Rate 0.003%]    [Audit Trail 100%]    │
│                                                 │
│  ┌─ SLO Burndown Chart (error budget/month) ─┐ │
│  │ May:  [████░░░░░░] 3.2h used, 1.1h left  │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Uptime Timeline (7 days) ────────────────┐ │
│  │ ✅ ✅ ✅ ✅ ⚠️ ✅ ✅ (daily status)       │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ P99 Latency by Module ───────────────────┐ │
│  │ analyzer:     1,240ms ✅                  │ │
│  │ bioquimica:   892ms ✅                    │ │
│  │ ciq-imuno:    756ms ✅                    │ │
│  │ [22 more...]  <3000ms ✅                 │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Error Rate Heatmap (by module, 24h) ────┐ │
│  │ [Grid showing errors/hour per module]     │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Audit Trail Capture ─────────────────────┐ │
│  │ Captured: 47,293 / Expected: 47,293      │ │
│  │ Capture Rate: 100.0% ✅                   │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
└────────────────────────────────────────────────┘
```

### Alerts (Cloud Monitoring + Slack/PagerDuty)

Four alert policies monitor SLO health:

1. **Availability Alert (YELLOW)** → Slack #observability
   - Fires: Uptime <99.65% (70% of budget consumed)
   - Response SLA: 1 hour

2. **Performance Alert (YELLOW/RED)** → Slack #observability (yellow), PagerDuty (red)
   - Fires: P99 >2.5s for 15 min (yellow) or >3s for 5 min (red)
   - Response SLA: 1 hour (yellow), 15 min (red)

3. **Error Rate Alert (RED)** → PagerDuty + Slack #sev-1
   - Fires: Error rate >0.1% sustained 5 min
   - Response SLA: 15 min page oncall + incident ticket

4. **Audit Trail Alert (RED)** → PagerDuty + Slack #compliance
   - Fires: Capture rate <100% (any missed event)
   - Response SLA: Immediate (RDC 978 violation)

### Monthly Report

End of each month: Fill `SLO_MONTHLY_REPORT_TEMPLATE.md` with:
- Actual % for each SLO
- Incidents + RCAs
- Budget consumed
- Recommendations
- Sign-offs (DevOps, CTO, Auditor)

Save as `.planning/reports/SLO_REPORT_[YYYY-MM].md` for auditor.

---

## Deployment Steps (30 min)

### Step 1: Import Dashboard (10 min)

1. Open [Cloud Console Monitoring](https://console.cloud.google.com/monitoring)
2. Left sidebar → **Dashboards** → **CREATE DASHBOARD**
3. Click **⋮** → **Import dashboard**
4. Paste contents of `.planning/dashboard-json/SLO_TRACKING_DASHBOARD.json`
5. Click **Import** → **Save**

### Step 2: Create 4 Alert Policies (8 min)

Use exact config from `SLO_ALERT_POLICIES_REFERENCE.md`:

1. **Availability Budget 70%** — Slack #observability
2. **Performance P99** (2.5s / 3.0s) — Slack + PagerDuty
3. **Error Rate >0.1%** — PagerDuty
4. **Audit Trail <100%** — PagerDuty + Slack #compliance

### Step 3: Setup Custom Metrics (5 min)

Cloud Logs → **Create Metric** for:
- `error_rate_percent` (ERROR-level logs)
- `audit_trail_events_captured` (audit-trail namespace)
- `audit_trail_expected_writes` (domain collection writes)

### Step 4: Schedule Weekly Review (2 min)

Cloud Scheduler → **Create Job**
- Name: `hc-quality-slo-weekly-review`
- Frequency: `0 09 * * 1` (Mondays 09:00 UTC)
- HTTP GET to SLO report webhook

### Step 5: Test & Verify (5 min)

- [ ] Dashboard loads with data (wait 5 min if blank)
- [ ] Each alert policy: click **Test Notification** → verify Slack/PagerDuty
- [ ] Custom metrics appear in Logs Explorer
- [ ] Team briefed in Slack #observability

---

## Maintenance (5 min/week)

**Daily (2 min):**
- Open SLO dashboard
- Check all 4 cards green ✅
- Review alert history

**Weekly (5 min, Mondays 09:00 UTC):**
- Screenshot dashboard
- Compare to last week (trending ↑ / ↓ / →?)
- Post to Slack #observability

**Monthly (30 min, last day of month):**
- Fill SLO monthly report template
- Export metrics from dashboard
- Get sign-offs (DevOps / CTO / Auditor)
- Archive as `SLO_REPORT_[YYYY-MM].md`

**Quarterly:**
- Review 3-month trend
- Adjust thresholds if needed (rare)
- Brief auditor on any SLO changes

---

## Key Files Quick Reference

| Document | When to Read | Time |
|----------|--------------|------|
| `SLO_TRACKING_INDEX.md` | First (navigation) | 3 min |
| `SLO_TRACKING_QUICKSTART.md` | Deploying today | 5 min + 30 min execution |
| `SLO_TRACKING_SETUP.md` | Understanding SLOs | 15 min |
| `SLO_ALERT_POLICIES_REFERENCE.md` | Creating alerts | Reference (5 min per alert) |
| `SLO_MONTHLY_REPORT_TEMPLATE.md` | End of month | 30 min fill |
| Dashboard JSON | Importing to Cloud Console | 2 min copy-paste |

---

## Alert Escalation

```
Alert fires in Cloud Monitoring
         ↓
Slack notification in #observability (auto)
         ↓
    ├─ RED (SLO violation)
    │  ├→ PagerDuty pages oncall
    │  ├→ Oncall: Acknowledge 15 min
    │  ├→ Open incident ticket
    │  └→ Follow docs/DR_PLAN.md
    │
    ├─ ORANGE (80% budget consumed)
    │  ├→ Slack notifies team
    │  ├→ Team lead: Schedule 1-hour sync
    │  └→ Investigate root cause
    │
    └─ YELLOW (70% budget)
       └→ Weekly review will address
```

---

## Testing (Optional, Recommended)

Before going live, test each alert:

1. **Availability Alert:** 
   - Cloud Monitoring → Policy → **Test Notification**
   - Verify Slack #observability receives test

2. **Performance Alert:**
   - Call slow Cloud Function (4s+ delay)
   - Watch logs for latency spike
   - Verify alert fires after threshold

3. **Error Rate Alert:**
   - Trigger test errors in logs
   - Verify custom metric captures them
   - Verify PagerDuty receives alert

4. **Audit Trail Alert:**
   - Temporarily disable audit function
   - Create a write (run, doc, etc.)
   - Verify capture rate drops <100%
   - Verify alert fires immediately

---

## Success Criteria (End of Week 1)

By Friday 2026-05-10:

- [ ] Dashboard imported + all tiles load data
- [ ] 4 alert policies created + tested
- [ ] Custom metrics reporting to Cloud Logs
- [ ] Team briefed in Slack #observability
- [ ] Oncall engineer knows escalation path
- [ ] First weekly review completed (Monday)
- [ ] No false positive complaints
- [ ] Zero service degradation from monitoring changes

---

## FAQ

**Q: What if we don't meet SLOs?**  
A: Acceptable. SLOs are targets, not guarantees. If consistently missed, Phase 4 infrastructure upgrades (multi-region, caching) will improve. Document in monthly report.

**Q: Can we adjust alert thresholds?**  
A: Yes, after 1 month of data. Propose change in ADR, brief auditor, implement if CTO approves.

**Q: What about customer-facing SLO status page?**  
A: Phase 4. Currently internal monitoring only.

**Q: What if audit trail violations occur?**  
A: RDC 978 violation. Immediate incident. CTO + auditor notified. Backfill script runs. Zero tolerance—these are non-negotiable for lab accreditation.

**Q: How do we prove compliance to auditor?**  
A: Monthly SLO reports + signed-off reports. Dashboard accessible to auditor (read-only). Cloud Logs queryable for deep dives.

---

## Next Steps

1. **Today:** Read `SLO_TRACKING_QUICKSTART.md`
2. **Within 30 min:** Execute setup steps 1–5
3. **Next Monday:** First weekly SLO review
4. **Month-end:** Fill monthly SLO report
5. **Ongoing:** 5 min/week + 30 min/month maintenance

---

## References

- **Cloud Monitoring:** https://console.cloud.google.com/monitoring
- **Cloud Logs:** https://console.cloud.google.com/logs
- **Incident Response:** `docs/DR_PLAN.md`
- **Audit Trail Details:** `docs/adr/ADR-0012-rdc-978-audit-trail-logical-signature.md`
- **Deployment Protocol:** `.claude/rules/deploy-protocol.md`
- **Cloud Logs Guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`

---

## Sign-Off

**Setup Sponsor:** CTO / Observability Lead  
**Date:** 2026-05-07  
**Status:** Ready for immediate deployment

Artifacts complete. No blockers. Proceed to Quick Start.

---

**Questions?** Post in Slack #observability or contact DevOps lead.

**Next Review:** 2026-05-14 (after first week of monitoring)
