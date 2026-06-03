# v1.4 Budget Documentation — Complete Reference

**v1.4 Timeline:** May 20 → Sep 30, 2026 (22 weeks)  
**Total Budget:** $154,500 USD  
**Critical Path Deadline:** Aug 5, 2026 (auditor ceremony)

---

## Quick Navigation

### 1. Executive Summary

- **File:** `v1.4_BUDGET_PROJECTION.md` (this document, 70+ pages)
- **Read if:** You need the authoritative cost breakdown by phase, service, and role
- **Key sections:**
  - Section 1: Cloud costs (Firebase + Gemini + Twilio + SMS)
  - Section 2: Engineering hours (1,355 hours across 4 streams)
  - Section 3: Contingency & risk scenarios
  - Section 4: Total budget + monthly burn rate
  - Section 5: Cost tracking setup (GCP + Firebase + CSV)

### 2. Quick Reference (1-page cheat sheet)

- **File:** `v1.4_BUDGET_QUICK_REFERENCE.md`
- **Read if:** You need fast answers during budget reviews
- **Includes:**
  - Cost breakdown summary (table)
  - Weekly monitoring checklist
  - Monthly cost caps by phase (hard limits)
  - Cost triggers (act immediately when thresholds hit)
  - Contingency usage flowchart
  - Scripts for cost analysis (BigQuery, GCP Logging, etc.)

### 3. Cost Tracker (CSV)

- **File:** `v1.4_COST_TRACKER.csv`
- **Update:** Weekly by CTO or finance lead
- **Format:**
  ```
  date,category,subcategory,amount_usd,phase,owner,status,notes
  ```
- **Purpose:** Real-time spend tracking, variance analysis, auditor reports
- **Tool:** Open in Excel/Google Sheets, add weekly actuals
- **Cadence:** Update every Friday @ 16:00 BRT (before auditor call)

### 4. Pre-Deploy Cost Validation Gates

- **File:** `v1.4_COST_VALIDATION_GATES.md`
- **When to use:** Before each phase deployment (Phases 4, 5, 6, 7, 8, 9)
- **Contains:**
  - Per-phase checklists (cloud metrics, engineering hours, cumulative spend)
  - Deployment blocking criteria
  - Cost exception report template
  - Auditor pre-alignment sign-off (Phase 8 critical)
- **Sign-off:** CTO + Founder (optionally, external auditor for Phase 8)

---

## Cost Structure at a Glance

### Total Budget: $154,500 USD

| Component                | Cost       | %     | Notes                              |
| ------------------------ | ---------- | ----- | ---------------------------------- |
| **Engineering**          | $114,020   | 73.8% | 1,355 hours × 4 streams × 22 weeks |
| **Cloud Services**       | $10,002.80 | 6.5%  | Firebase + Gemini Vision + Twilio  |
| **External Pen-test**    | $4,500     | 2.9%  | Phase 10 security assessment       |
| **Contingency (15%)**    | $18,603    | 12.1% | Auditor delays, scope creep        |
| **Unallocated reserves** | $7,042     | 4.6%  | Emergency buffer                   |

### Monthly Burn Rate (Average)

- **May 20–31 (12 days):** $5,277
- **June:** $37,825 (Phase 4 + 5 ramp)
- **July:** $36,460 (Phase 5–8 peak)
- **August:** $22,800 (Phase 8–9 wind-down)
- **September:** $20,149 (buffer + post-audit ops)

**Average:** $27,627/month (with contingency)

---

## Phase-by-Phase Budget

| Phase           | Duration | Cloud          | Engineering  | Total        | Cumulative |
| --------------- | -------- | -------------- | ------------ | ------------ | ---------- |
| **4**           | 2.5w     | $520           | $21,600      | $22,120      | $22,120    |
| **5**           | 3w       | $1,560         | $25,600      | $27,160      | $49,280    |
| **6**           | 2w       | $1,617         | $11,440      | $13,057      | $62,337    |
| **7**           | 3w       | $1,627         | $11,440      | $13,067      | $75,404    |
| **8**           | 4w       | $1,617         | $23,040      | $24,657      | $100,061   |
| **9**           | 2w       | $1,627         | $9,200       | $10,827      | $110,888   |
| **10–12**       | 3w       | $2,234         | $12,660      | $14,894      | $125,782   |
| **Contingency** | —        | —              | —            | $18,603      | —          |
| **Reserves**    | —        | —              | —            | $7,042       | —          |
| **TOTAL**       | **22w**  | **$10,002.80** | **$114,020** | **$154,500** | —          |

---

## Cloud Services Breakdown

### 1. Firebase (Firestore + Functions + Hosting)

- **Current baseline (May 2026):** ~$850/month
- **v1.4 projection:** Ramps to ~$1,627/month by Phase 7
- **Why increase:** Portal auth (Phase 4) + NOTIVISA polling + critical detection (Phase 5) + PDF generation (Phase 6) + analytics (Phase 9)
- **5-month total:** ~$4,327

### 2. Gemini Vision API

- **Phase 5–9:** IA strip annotation + training dataset
- **Volume:** 500 → 5,500 images cumulative (May–Sep)
- **Cost per image:** ~$0.00055 (250 input tokens + 100 output tokens)
- **5-month total:** ~$4.50

### 3. Twilio SMS (Critical escalation)

- **Phase 5+:** SMS alerts for critical lab values
- **Volume:** 25 SMS/day testing → 75 SMS/day production
- **Rate:** BRL 0.50 per SMS (~$0.10 USD, FX conservative)
- **5-month total:** ~$1,170 (9,750 SMS)

### 4. SendGrid (Email notifications)

- **Free tier:** 12k emails/month
- **v1.4 usage:** ~10,650 emails (NOTIVISA + escalation)
- **Cost:** $0 (within free tier)

### 5. Google Cloud (beyond Firebase)

- **Cloud Logging:** <$2/month (audit trail ingestion)
- **Cloud Tasks:** <$0.02/month (NOTIVISA queue)
- **Total:** ~$1.30

### 6. External Pen-test (Phase 10)

- **Fixed contract:** $4,500 (3-week security assessment)
- **Includes:** Portal auth, LGPD compliance, API security

---

## Engineering Hours Allocation

**Total: 1,355 hours (1.54 FTE × 22 weeks)**

| Phase        | Hours | Cost    | Scope                                                                                      |
| ------------ | ----- | ------- | ------------------------------------------------------------------------------------------ |
| **Phase 4**  | 270   | $21,600 | Portal auth (3 callables) + UI (5 components) + NOTIVISA queue + E2E (8 flows)             |
| **Phase 5**  | 320   | $25,600 | Critical thresholds + SMS/email escalation + IA strip upload + feedback loop + A/B testing |
| **Phase 6**  | 143   | $11,440 | PDF generation + portal médico SSO + E2E suite (8 flows)                                   |
| **Phase 7**  | 143   | $11,440 | Portal paciente feedback + trending dashboard + LGPD polish + E2E (8 flows)                |
| **Phase 8**  | 288   | $23,040 | CAPA closure (findings F-01 → F-07) + auditor ceremony prep                                |
| **Phase 9**  | 115   | $9,200  | Advanced KPI queries + analytics dashboard + PDF batch export                              |
| **Phase 11** | 16    | $2,400  | Auditor pre-alignment meetings (8 × 2 hours, CTO @ $150/hr)                                |
| **Phase 12** | 60    | $4,800  | Test data refresh (50 labs, 1M records) + Riopomba validation + smoke testing              |

---

## Cost Monitoring & Governance

### Weekly Tasks (Every Friday @ 17:00 BRT)

1. **GCP Billing Dashboard:** Check cumulative spend vs. forecast
2. **Firebase Console:** Firestore reads/writes, Functions CPU, Hosting bandwidth
3. **Third-party APIs:** Gemini Vision logs, Twilio SMS usage, SendGrid email volume
4. **CSV tracker:** Update `v1.4_COST_TRACKER.csv` with actuals
5. **Metrics snapshot:** Generate `WEEKLY_METRICS.json` (see quick reference)
6. **Escalation check:** Flag any >5% variance to CTO before auditor call

### Monthly Tasks (Last Friday of each month)

1. **Cumulative spend review:** Total spend vs. $154,500 budget
2. **Phase closeout:** Reconcile engineering hours with time tracking
3. **Contingency status:** Verify <50% contingency used (target: >$9,300 remaining after Phase 8)
4. **Burn rate validation:** Month-to-month consistency (target: ±$5k)
5. **Auditor report:** Share cost snapshot with external auditor (Phase 11 meeting)

### Before Each Phase Deployment

- **Use:** `v1.4_COST_VALIDATION_GATES.md` checklist
- **Sign-off:** CTO (all phases) + Founder (if >110% of phase budget)
- **Auditor sign-off:** External auditor (Phase 8 CAPA only)
- **Blocking criteria:** If checks fail, delay deploy until remediation complete

---

## Contingency Reserve ($18,603)

### Allocation Strategy

- **40% Cloud spikes** (~$7,441): Gemini Vision API overuse, SMS volume surge, Firestore read regression
- **60% Engineering rework** (~$11,162): Auditor feedback delays, CAPA closure cycles, scope creep

### Recovery Actions

1. **If cloud cost spike (>50% overage):**
   - Immediate: Reduce Gemini Vision uploads by 50%
   - Day 1: BigQuery cost analysis for Firestore inefficiencies
   - Week 1: Implement query batching or aggregate collections
   - Approval: CTO (up to $5,000 contingency)

2. **If engineering hours spike (Phase rework):**
   - Immediate: Assess root cause (auditor feedback? bugs?)
   - Day 1: CTO reviews phase completion criteria
   - Week 1: Defer non-critical features to Phase 13
   - Approval: CTO (up to $11,000 contingency) + timeline adjustment

3. **If auditor feedback extends Phase 8 (CAPA):**
   - Immediate: Same-day auditor alignment call
   - Day 1: CTO + Auditor scope rework cycles
   - Week 1: Re-baseline CAPA closure (target: Aug 15 max)
   - Approval: Founder authorizes extended auditor coordination

### Target Contingency Burn

- **Best case:** <$5,000 (only minor API tuning)
- **Expected case:** $9,300–$13,000 (typical auditor feedback + cloud optimization)
- **Stress case:** >$15,000 (extended CAPA + multiple cloud issues)

---

## Success Criteria (Budget Tracking)

| Metric                         | Target                   | Achievement Method                                 |
| ------------------------------ | ------------------------ | -------------------------------------------------- |
| **Total budget variance**      | ≤5% of $154,500          | Weekly variance checks, cumulative tracking        |
| **Cloud cost accuracy**        | ≤6.5% of budget (≤$11k)  | BigQuery cost export, daily dashboard check        |
| **Engineering efficiency**     | 1,355 hours ± 10%        | Time tracking system (Harvest/Toggl), weekly audit |
| **Monthly burn consistency**   | ±$5,000 from $27,627 avg | Monthly review, flag >110% threshold               |
| **Contingency preservation**   | ≥50% remaining ($9,300)  | Post-Phase 8 contingency status check              |
| **Phase on-time completion**   | ≥80% (12 of 15 phases)   | Phase deployment validation gates                  |
| **Cost validation gates pass** | 100% of gate checklists  | CTO + Founder sign-off before deploy               |

---

## Escalation Paths

### Cost Variance Detected

1. **Threshold:** Monthly spend >110% of forecast
2. **Owner:** Phase lead (initial investigation)
3. **Escalate to:** CTO (if >$500/month variance)
4. **Escalate to:** Founder (if >$2,000/month variance or contingency >50% consumed)

### Auditor Delays (Phase 8 Critical Path)

1. **Threshold:** CAPA closure extends >2 weeks past Aug 5
2. **Owner:** CTO (coordinates with auditor)
3. **Escalate to:** Founder (if jeopardizes Aug 31 external audit)
4. **Contingency:** Up to $4,000 for extended auditor coordination

### Cloud API Cost Spike

1. **Threshold:** Gemini Vision >$1,000/month or SMS >15,000/month
2. **Owner:** Agent responsible for feature (6, 5 respectively)
3. **Escalate to:** CTO (implement rate-limiting or pause uploads)
4. **Contingency:** Up to $5,000 for API optimization

---

## Tools & Access

### GCP Billing Dashboard

- **URL:** https://console.cloud.google.com/billing
- **Access:** drogafarto@gmail.com (CTO), <rt-lead@email>
- **Refresh:** Real-time
- **Alert:** Billing budget set to $3,000/month (cloud services only)

### Firebase Console (Real-time Metrics)

- **URL:** https://console.firebase.google.com/project/hmatologia2
- **Tabs to monitor:**
  - Firestore: Usage → Reads/Writes/Deletes
  - Functions: Logs → Filter by function name
  - Hosting: Analytics → Bandwidth
- **Refresh:** Every 1 minute (near real-time)

### BigQuery Cost Export

- **Dataset:** `hc_quality_billing.gcp_billing_export_v1`
- **Table:** Daily snapshots of GCP billing
- **Query:** See `v1.4_BUDGET_QUICK_REFERENCE.md` Script A
- **Refresh:** Daily @ 06:00 UTC (12 hours delay)

### CSV Tracker

- **File:** `v1.4_COST_TRACKER.csv`
- **Format:** Spreadsheet-ready (open in Excel/Google Sheets)
- **Update:** Weekly by CTO or finance lead
- **Purpose:** Actuals reconciliation, auditor reports, variance analysis

---

## Approvals & Sign-Off

### Budget Approval Checklist

- [ ] CTO reviewed cost breakdown + phase allocations
- [ ] Founder approved total $154,500 USD budget
- [ ] Finance confirmed payment terms (net-30 cloud, bi-weekly eng)
- [ ] Auditor pre-alignment called for baseline budget review
- [ ] Team leads assigned cost tracking responsibilities

### Sign-Off Template

```
v1.4 Budget Approval

CTO: _________________ Date: ______
Founder: _________________ Date: ______
Finance: _________________ Date: ______

Total Approved: $154,500 USD
Period: May 20 → Sep 30, 2026
Contingency: $18,603 (15% buffer)
```

---

## Related Documents

- **v1.4 Kickoff:** `.planning/milestones/v1.4-KICKOFF-SUMMARY.md` — phase timeline, dependencies, risks
- **Phase plans:** `.planning/phases/04-*/PLAN.md` through `.planning/phases/12-*/PLAN.md`
- **Compliance mapping:** `.planning/milestones/COMPLIANCE_SUMMARY_v1.3.md` (DICQ/RDC/LGPD baseline)
- **Deploy protocol:** `.claude/rules/deploy-protocol.md` (phase deployment sequence)
- **Cloud monitoring:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md` (post-deploy 24h setup)

---

## Contact & Questions

**Budget Owner:** CTO (drogafarto@gmail.com)  
**Finance Lead:** [name], [email]  
**Auditor Liaison:** RT Lead, [email]

**For questions about:**

- Cloud costs → CTO or Finance lead
- Engineering hours → CTO or Phase lead
- Auditor alignment → CTO + RT lead
- Contingency approvals → Founder

---

## Document History

| Version | Date       | Author            | Changes                                |
| ------- | ---------- | ----------------- | -------------------------------------- |
| 1.0     | 2026-05-07 | Claude Code Agent | Initial v1.4 budget projection created |

---

**v1.4 Budget execution begins May 20, 2026. All documentation ready.**

**Status:** ✅ Approved for Phase 4 kickoff
