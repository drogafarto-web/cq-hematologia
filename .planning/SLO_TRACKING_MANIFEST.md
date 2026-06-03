# SLO Tracking Setup — Complete Manifest

**Date Created:** 2026-05-07  
**Version:** 1.0  
**Status:** Complete, ready for deployment

---

## Deliverables Summary

**Total Artifacts:** 8 files (22 pages + JSON dashboard)  
**Total Size:** ~49 KB  
**Deployment Time:** 30 minutes  
**Maintenance:** 5 min/week + 30 min/month

---

## File Inventory

### Documentation Files (in `.planning/docs/`)

| #   | File                                | Purpose                         | Pages | For                           |
| --- | ----------------------------------- | ------------------------------- | ----- | ----------------------------- |
| 1   | **SLO_TRACKING_INDEX.md**           | Navigation & overview           | 1     | Everyone (start here)         |
| 2   | **SLO_TRACKING_QUICKSTART.md**      | 30-min execution checklist      | 2     | DevOps deploying today        |
| 3   | **SLO_TRACKING_SETUP.md**           | Full SLO definitions + context  | 6     | Team leads understanding SLOs |
| 4   | **SLO_ALERT_POLICIES_REFERENCE.md** | Alert configuration details     | 5     | Oncall engineers responding   |
| 5   | **SLO_MONTHLY_REPORT_TEMPLATE.md**  | Monthly audit report (fillable) | 8     | Auditors reviewing compliance |
| 6   | **OBSERVABILITY_SETUP_SUMMARY.md**  | Executive summary               | 3     | CTO/leaders decision-making   |
| 7   | **SLO_DEPLOYMENT_CHECKLIST.md**     | Deploy day checklist            | 3     | DevOps execution leader       |
| 8   | **SLO_TRACKING_MANIFEST.md**        | This file (inventory)           | 1     | Project coordination          |

### Dashboard & Config (in `.planning/dashboard-json/`)

| File                            | Purpose                               | Format | Size   |
| ------------------------------- | ------------------------------------- | ------ | ------ |
| **SLO_TRACKING_DASHBOARD.json** | Importable Cloud Monitoring dashboard | JSON   | ~12 KB |

---

## Quick Start Path

**If you have 30 minutes:**

1. Read `SLO_TRACKING_QUICKSTART.md` (5 min)
2. Execute steps 1–5 (25 min)
3. Brief team in Slack (post template provided)

**If you have 1 hour:**

1. Read `SLO_TRACKING_SETUP.md` (15 min)
2. Read `SLO_TRACKING_QUICKSTART.md` (5 min)
3. Execute steps 1–5 (30 min)
4. Test all alerts + verify (10 min)

**If you have 5 minutes (urgent link):**

- Send team: `/.planning/docs/SLO_TRACKING_INDEX.md`
- They'll find the path that fits

---

## SLO Definitions at a Glance

| SLO                   | Target       | Budget           | Alert Threshold        |
| --------------------- | ------------ | ---------------- | ---------------------- |
| **Availability**      | 99.5% uptime | 4.32 h/month     | 99.65% (70% budget)    |
| **Performance (P99)** | <3 seconds   | 1.5% requests    | 2.5s yellow / 3.0s red |
| **Error Rate**        | <0.1%        | 50k errors/month | 0.1% sustained 5 min   |
| **Audit Trail**       | 100% capture | 0 tolerance      | <100% = immediate red  |

---

## 4-Phase Rollout

### Phase 1: Setup (Day 1, 30 min)

- [ ] Import dashboard
- [ ] Create 4 alert policies
- [ ] Setup custom metrics
- [ ] Test alerts
- [ ] Brief team

**Owner:** DevOps Lead  
**Artifact:** `SLO_DEPLOYMENT_CHECKLIST.md`

### Phase 2: Verification (Week 1, daily)

- [ ] Check dashboard daily (2 min)
- [ ] Monitor alerts (zero expected)
- [ ] Identify false positives

**Owner:** Team Lead  
**Artifact:** Dashboard bookmarked

### Phase 3: Weekly Reviews (Week 2+, Mondays)

- [ ] Screenshot dashboard
- [ ] Post to Slack #observability
- [ ] Note trends (↑ / ↓ / →)

**Owner:** Rotating team member  
**Artifact:** `SLO_TRACKING_INDEX.md` (section: Weekly Review)

### Phase 4: Monthly Reporting (Month 2+, month-end)

- [ ] Fill SLO report
- [ ] Export metrics
- [ ] Get sign-offs (DevOps / CTO / Auditor)
- [ ] Archive for auditor

**Owner:** DevOps Lead + CTO  
**Artifact:** `SLO_MONTHLY_REPORT_TEMPLATE.md`

---

## Deployment Dependencies

**Before deploying, ensure:**

- [ ] GCP Project `hmatologia2` accessible
- [ ] Cloud Monitoring enabled
- [ ] Cloud Logs enabled
- [ ] Slack workspace #observability created (or your notification channel)
- [ ] PagerDuty (if using for critical alerts)
- [ ] Team briefed on SLO concept

**No code changes required.** Purely observability setup.

---

## Key Metrics Explained

### 1. Availability: 99.5%

**What:** Firebase (Firestore + Auth) + Cloud Hosting + Cloud Functions all up  
**Monthly Budget:** Can be down 4.32 hours total  
**Alert at:** 70% budget consumed (3 hours used, 1.3 hours left)  
**Causes:** Planned maintenance, GCP outages, deploy issues

### 2. Performance: P99 <3 seconds

**What:** 95% of requests complete in <3s (P99 percentile <3s)  
**Monthly Budget:** 1.5% of requests (75k out of 5M) can be slower  
**Alert at:** P99 >2.5s for 15 min (yellow) or >3.0s for 5 min (red)  
**Causes:** Cold-starts, Gemini API latency, high load, DB queries

### 3. Error Rate: <0.1%

**What:** Fewer than 1 error per 1,000 requests  
**Monthly Budget:** ~50,000 errors allowed in 5M requests  
**Alert at:** >0.1% sustained 5 min  
**Causes:** Deploy bugs, service degradation, quota exceeded, transient failures

### 4. Compliance: 100% Audit Trail

**What:** Every RDC 978 audit-relevant write must be captured in audit trail  
**Monthly Budget:** Zero missed events (0% tolerance)  
**Alert at:** <100% capture rate (any missed event)  
**Causes:** Audit function crash, database issue, logic error

---

## Alert Escalation Path

```
Cloud Monitoring Alert fires
    ↓
┌───────────────────────────────┐
│ Check Severity/Color          │
└───────────────────────────────┘
    ↓
    ├─ RED (SLO violation)
    │  ├→ PagerDuty pages oncall engineer
    │  ├→ Oncall acknowledges within 15 min
    │  ├→ Open incident ticket
    │  ├→ Follow docs/DR_PLAN.md
    │  └→ Investigation + resolution
    │
    ├─ ORANGE (80% budget)
    │  ├→ Slack #observability notifies team
    │  ├→ Team lead schedules 1-hour sync
    │  ├→ Root cause analysis
    │  └→ Document findings
    │
    └─ YELLOW (70% budget)
       ├→ Slack #observability notifies team
       └→ Next Monday's weekly review will address
```

---

## Monthly Operations Workflow

**Every month (30 min):**

```
Day 1–29: Monitor daily
    ↓
Day 30: Fill SLO Report
    ├→ Export metrics from dashboard
    ├→ Fill SLO_MONTHLY_REPORT_TEMPLATE.md
    ├→ Analyze incidents (if any)
    ├→ Draft recommendations
    └→ Request sign-offs
    ↓
DevOps Lead: Review
    ├→ Verify numbers
    ├→ Add operational notes
    └→ Sign off
    ↓
CTO: Review
    ├→ Check compliance
    ├→ Approve recommendations
    └→ Sign off
    ↓
Auditor: Review
    ├→ Acknowledge report
    ├→ Note any concerns
    └→ Archive in compliance file
    ↓
Next Month: Repeat
```

---

## Dashboard Sections

**SLO Tracking Dashboard (12-column layout):**

1. **Availability SLO** (col 1–3) — Uptime % scorecard
2. **Performance P99** (col 4–6) — Latency trend line
3. **Error Rate** (col 7–9) — Errors/min with threshold
4. **Audit Trail Capture** (col 10–12) — % scorecard with red zone
5. **Error Budget Burndown** (full width) — Cumulative budget consumed
6. **Uptime Timeline** (col 1–6) — Daily status bars (7 days)
7. **Error Rate Heatmap** (col 7–12) — Module × hour grid
8. **Status Cards** (col 1–12) — Firebase / Functions / Hosting real-time

**All tiles refresh every 60s** from live metrics.

---

## Custom Metrics Created

Three user-defined metrics populate the dashboard:

1. **error_rate_percent** — Error count / total requests × 100
   - Source: Cloud Logs with `severity=ERROR` filter
   - Update frequency: ~5 min (log ingestion latency)

2. **audit_trail_events_captured** — Count of audit-trail subcollection writes
   - Source: Firestore audit events
   - Update frequency: Real-time

3. **audit_trail_expected_writes** — Count of domain collection creates (runs, docs, etc.)
   - Source: Firestore domain writes
   - Update frequency: Real-time

Capture rate = `captured / expected × 100%` (must stay at 100%)

---

## Compliance Alignment

### RDC 978 (ANVISA — Brazilian lab regulations)

- **Art. 117:** Audit trail mandatory (our Audit Trail SLO covers this)
- **Art. 122:** Shift supervision records (handled by turnos module)
- **Art. 179–191:** Technical record requirements (handled by sgd module)

**SLO Tracking provides:**

- Monthly proof that 100% of audit events captured (Article 117 compliance)
- Incident RCA documentation (shows investigation rigor)
- Sign-off from CTO + DevOps (management accountability)

### DICQ (ANVISA — quality management system)

- **Block 4.4:** Audit trail documentation (monthly reports)
- **Block 4.14:** Risk management (separate module, but SLO tracking shows process health)

**SLO Tracking provides:**

- Evidence of continuous monitoring (Block 4.4 requirement)
- Monthly trend analysis (shows quality system effectiveness)

---

## Success Metrics (After 1 Month)

By 2026-06-07, success looks like:

- [ ] Dashboard accessed daily by team (2+ min/day)
- [ ] Weekly reviews completed 4 consecutive weeks (100% attendance)
- [ ] Zero critical incidents due to missed monitoring (preventive value)
- [ ] Monthly reports signed off and auditable (compliance value)
- [ ] No alert fatigue complaints (thresholds well-tuned)
- [ ] Auditor acknowledged report (regulatory acceptance)
- [ ] Team confidence in SLO visibility (operational value)

---

## Maintenance Checklist

**Daily (2 min):**

- [ ] Dashboard green? ✓
- [ ] Any overnight alerts?

**Weekly (Mondays 09:00 UTC, 5 min):**

- [ ] Screenshot dashboard
- [ ] Post to Slack #observability
- [ ] Note trend (↑ / ↓ / →)

**Monthly (last day, 30 min):**

- [ ] Fill SLO report
- [ ] Get sign-offs
- [ ] Archive

**Quarterly:**

- [ ] Review 3-month trend
- [ ] Adjust thresholds (if needed)
- [ ] Auditor briefing

---

## Quick Links

| Purpose                    | URL / Path                                                |
| -------------------------- | --------------------------------------------------------- |
| Cloud Monitoring Dashboard | https://console.cloud.google.com/monitoring/dashboards    |
| Cloud Logs                 | https://console.cloud.google.com/logs                     |
| Alert Policies             | https://console.cloud.google.com/monitoring/alertpolicies |
| Setup Documentation        | `.planning/docs/SLO_TRACKING_SETUP.md`                    |
| Quick Start                | `.planning/docs/SLO_TRACKING_QUICKSTART.md`               |
| Monthly Report             | `.planning/docs/SLO_MONTHLY_REPORT_TEMPLATE.md`           |

---

## FAQ (Short Answers)

**Q: What if we can't meet these SLOs?**  
A: Fine. SLOs are targets. If consistently missed, Phase 4 upgrades (multi-region, caching, optimization) will improve. Document in monthly reports.

**Q: Can we adjust thresholds?**  
A: Yes, after 1 month. Propose ADR, brief auditor, implement if CTO approves.

**Q: What about customer-facing SLO status?**  
A: Phase 4 feature. Currently internal only.

**Q: What if audit trail violations occur?**  
A: RDC 978 violation. Immediate incident. Backfill script runs. CTO + auditor notified. Non-negotiable for lab accreditation.

**Q: Who gets paged for RED alerts?**  
A: Oncall engineer. PagerDuty integration handles it. See `docs/DR_PLAN.md` for escalation.

**Q: Can we use this for customer reporting?**  
A: Not yet. Phase 4 will add customer-facing SLO dashboard. Currently CTO/auditor audience only.

---

## Getting Help

**For setup questions:**

- Read `SLO_TRACKING_QUICKSTART.md`
- Post in Slack #observability

**For alert interpretation:**

- Read `SLO_ALERT_POLICIES_REFERENCE.md`
- Check `docs/DR_PLAN.md` (incident response)

**For auditor reporting:**

- Use `SLO_MONTHLY_REPORT_TEMPLATE.md`
- Contact CTO for sign-off

**For performance optimization:**

- Check `docs/PERFORMANCE_PATTERNS.md`
- Contact DevOps team

---

## Sign-Off

| Role                       | Name | Date       | Status                 |
| -------------------------- | ---- | ---------- | ---------------------- |
| **Observability Engineer** | —    | 2026-05-07 | ✅ Ready               |
| **DevOps Lead**            | —    | —          | Awaiting               |
| **CTO**                    | —    | —          | Awaiting               |
| **Auditor**                | —    | —          | Awaiting (post-deploy) |

---

## Timeline

| Date           | Milestone               | Owner         | Status          |
| -------------- | ----------------------- | ------------- | --------------- |
| **2026-05-07** | All artifacts complete  | Observability | ✅ Complete     |
| **2026-05-07** | Dashboard deployed      | DevOps        | Pending (today) |
| **2026-05-07** | Alerts created + tested | DevOps        | Pending (today) |
| **2026-05-08** | Dashboard verification  | Team Lead     | Pending         |
| **2026-05-14** | First weekly review     | Team          | Pending         |
| **2026-05-31** | First monthly report    | DevOps + CTO  | Pending         |
| **2026-06-30** | Threshold tuning (Q2)   | DevOps        | Pending         |

---

## Next Actions

1. **Now (2026-05-07):** Send this manifest to DevOps lead
2. **Next 30 min:** Execute `SLO_DEPLOYMENT_CHECKLIST.md`
3. **Post-deploy:** Brief team in Slack
4. **Next Monday:** First weekly review
5. **Ongoing:** Maintain SLO dashboard

---

**Status:** Complete & ready for deployment  
**Confidence:** HIGH (all artifacts done, no blockers)  
**Target:** Go live today, 2026-05-07

Let's monitor like pros.
