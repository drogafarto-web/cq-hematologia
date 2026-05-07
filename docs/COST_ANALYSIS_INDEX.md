# Firebase Cost Analysis — Document Index

**Project:** HC Quality CQ Labclin  
**Date:** 2026-05-07  
**Phase:** v1.4 (Phase 3.1–3.3 infrastructure planning)

---

## Documents in This Analysis

### 1. **COST_ANALYSIS_Phase3.md** (Full technical report)
**Use when:** CTO/Finance needs detailed cost breakdowns, Phase 4–12 projections, unit economics, optimization roadmap.

**Sections:**
- Executive summary (3 bullet points)
- Firestore storage + read/write impact (section 1.2–1.3)
- Cloud Functions inventory + GiB-second calculations (section 2)
- Cloud Storage + Gemini API + Twilio SMS (section 3–4)
- Phase 4–12 cost projections by phase + stream (section 6)
- Unit economics: 1–30 labs profitability scenarios (section 7)
- 8 optimization opportunities with ROI (section 8)
- Risk factors + contingency (section 9)
- Pricing reference table (section 11)
- Sign-off + versioning (section 12)

**Length:** 12 sections, ~300 lines, dense technical detail

**Read time:** 20 minutes (full) · 5 minutes (skim sections 5–7)

---

### 2. **COST_ANALYSIS_EXECUTIVE_SUMMARY.md** (1-page stakeholder brief)
**Use when:** Board meeting, budget approval, CFO review, sales team alignment.

**Sections:**
- Bottom line: Phase 3 adds $11/month, scales to $85–100 by Phase 12 (3 bullet points)
- Cost breakdown table: v1.3 ($16) → Phase 3 ($27)
- Monthly cost by phase: Weeks 1–22 trend
- Unit economics table: profitability at 1–15 labs
- Risk factors: 4 scenarios with probability/impact
- Key approved decisions (ADRs 0014–0018)
- Governance: budget alert threshold, approval gate
- Cost optimization roadmap (4 actions with ROI)
- FAQ with answers

**Length:** 1–2 pages, high-level decision-making, minimal math

**Read time:** 5 minutes (full) · 2 minutes (tables only)

---

### 3. **FIREBASE_COST_MONITORING_CHECKLIST.md** (Operations runbook)
**Use when:** Weekly cost review, operational monitoring, troubleshooting cost anomalies, setting up GCP alerts.

**Sections:**
- Quick start (5 minutes): 3-step access to GCP console + alert setup
- Weekly monitoring checklist (15 min): 7 sections with target ranges
- Cost anomaly troubleshooting (4 scenarios):
  - Firestore reads spike >750k/day
  - Cloud Functions cost spike $8→$20/month
  - SMS bill 4x spike
  - Storage bill unexpected spike
- Monthly cost review template (markdown form for documentation)
- Annual budget projection (12-month rolling forecast)
- Automation script (optional bash weekly reporter)
- External monitoring options (Kubecost vs GCP native)
- Escalation path (5-step incident response)

**Length:** 400+ lines, procedural + troubleshooting

**Read time:** 5 minutes (quick start) · 15 minutes (checklist) · 5 minutes per scenario (as-needed)

---

## How to Use These Documents

### For CTO (Architecture + Decisions)
1. **Read:** COST_ANALYSIS_Phase3.md sections 1–2 (Firestore + Functions impact)
2. **Review:** Section 7 (unit economics) to confirm 3+ labs breakeven
3. **Approve:** Section 8 (optimization roadmap) — assign owners + deadlines
4. **Monitor:** Use FIREBASE_COST_MONITORING_CHECKLIST weekly

### For Finance/CFO (Budget Planning)
1. **Read:** COST_ANALYSIS_EXECUTIVE_SUMMARY.md (2 min decision table)
2. **Approve:** Budget of $50/month (Phase 3) or $100/month (Phase 12)
3. **Set alert:** $50 threshold in GCP console (see checklist Quick Start)
4. **Monthly review:** Use monthly cost review template in FIREBASE_COST_MONITORING_CHECKLIST.md

### For Sales/Commercial (SaaS Unit Economics)
1. **Read:** COST_ANALYSIS_EXECUTIVE_SUMMARY.md section "Unit Economics"
2. **Confirm:** Pricing of $99/lab/month = 77% margin at 5 labs, breakeven at 3 labs
3. **Plan:** Pitch to 3+ labs by end of Phase 3 (Week 3) to hit profitability
4. **Track:** Cost per lab = (`$27–85` ÷ lab count) + `$11–15` per lab

### For DevOps (Operational Monitoring)
1. **Setup:** FIREBASE_COST_MONITORING_CHECKLIST.md Quick Start (15 min)
2. **Weekly:** Run checklist template every Friday 10:00 UTC
3. **Anomaly:** Jump to troubleshooting section if any metric outside target range
4. **Escalate:** Follow 5-step escalation path if cost exceeds budget

### For Product/Engineering (Architecture Impact)
1. **Read:** COST_ANALYSIS_Phase3.md sections 2 + 8 (Functions + optimizations)
2. **Plan:** Implement optimization roadmap Week 1 (analytics polling refactor if needed)
3. **Monitor:** Weekly checklist section 3 (Cloud Functions metrics)
4. **Optimize:** Batch NOTIVISA queue (Week 8, saves $5/month)

---

## Key Metrics to Track

### Weekly (Every Friday)

| Metric | Target | Alert | Notes |
|--------|--------|-------|-------|
| **Total cost** | $16–27 (Phase 3) | >$40 | Month-to-date |
| **Firestore reads** | 500k–575k/day | >750k | Analytics polling |
| **Cloud Functions** | $4–$12 | >$20 | GiB-seconds billing |
| **SMS sent** | 0–30/week (Phase 3) | >200 | Críticos escalation |
| **Storage** | 16.5 GB (Phase 3) | >25 GB | App data + backups |

### Monthly (Last Friday)

| Metric | Target | Action |
|--------|--------|--------|
| **Total cost** | $27 (Phase 3) ±10% | Variance >10%? → investigate anomaly |
| **Functions errors** | 0% | >1% failure rate? → debug Cloud Logs |
| **Backup size** | 165 GB | >250 GB? → check retention policy |

---

## Decision Log

| Decision | ADR | Status | Impact |
|----------|-----|--------|--------|
| Single-lab Riopomba (v1.4) | ADR-0011 | Approved | Saves ~$40/month vs multi-tenant |
| Gemini 2.5 Flash baseline | ADR-0010 | Approved | Free tier covers Phase 3–4 IA |
| NOTIVISA sandbox Phase 8 | ADR-0014 | Approved | Delays $20/month SMS until v1.5 |
| Cloud Functions Node 22 | Rule: deploy-protocol.md | Approved | No multi-region; southamerica-east1 only |
| Cost alert threshold | Recommended: $50 | Pending | Must set up in GCP console Week 1 |
| SMS deduplication | Recommended: section 8.3 | Pending | Implement Week 4 (Phase 4) |

---

## FAQ by Role

### "How much will Firebase cost in 12 months?"
**Answer:** Start at $16/month (v1.3), grow to $85–100/month (Phase 12). Year 1 total: ~$750–1000. See EXECUTIVE_SUMMARY.md cost projection table.

### "When do we break even on infrastructure costs?"
**Answer:** At 3 labs × $99/month = $297 revenue vs $105 cost = 65% margin. At 5 labs = 77% margin. See COST_ANALYSIS_Phase3.md section 7.

### "What's the biggest cost driver in Phase 3?"
**Answer:** Cloud Functions (19 new functions for portals + IA) = +$4.35/month. Second: SMS escalation pilot (+$3.75/month). See EXECUTIVE_SUMMARY.md cost breakdown.

### "Can we reduce costs by turning off features?"
**Answer:** Analytics polling at 30s → 60s saves $18/month. Batch NOTIVISA queue saves $5/month. Archive old events saves $10/month. See COST_ANALYSIS_Phase3.md section 8.

### "What if a lab generates 10x more data than expected?"
**Answer:** Firestore reads are metered (not per-request), so cost scales linearly. Risk: $0.06/M reads could jump +$5/month if 10 labs do 10x. Set alert at $75/day. See CHECKLIST.md scenario 1.

### "Should we bill customers for data overage?"
**Answer:** No. Include unlimited data in $99/month SaaS fee (data-driven product, not API-metered). If cost spike confirmed at scale, negotiate pricing tier or implement rate-limiting. See COST_ANALYSIS_Phase3.md section 7.2.

---

## Timeline of Rollout

| Week | Document | Owner | Action |
|------|----------|-------|--------|
| Week 1 (May 7–13) | All 3 docs | CTO + Finance | Review + approve Phase 3 costs |
| Week 1 | CHECKLIST.md | DevOps | Set up GCP alerts + weekly monitoring |
| Week 2 | CHECKLIST.md | DevOps | First weekly cost review |
| Week 4 | CHECKLIST.md | DevOps | Monthly cost review template completion |
| Week 8 | COST_ANALYSIS_Phase3.md | Eng + Product | Implement optimization roadmap (polling, batch) |
| Week 12 | COST_ANALYSIS_Phase3.md | Product + Eng | Re-forecast Phase 12 cost impact |
| Monthly (Fridays) | CHECKLIST.md | DevOps + Finance | Standing monthly review meeting |

---

## Version Control

All 3 documents are version-controlled in `c:/hc quality/docs/`:

- `COST_ANALYSIS_Phase3.md` → Main technical reference
- `COST_ANALYSIS_EXECUTIVE_SUMMARY.md` → Board/finance deck
- `FIREBASE_COST_MONITORING_CHECKLIST.md` → Weekly ops runbook
- `COST_ANALYSIS_INDEX.md` (this file) → Navigation + FAQ

**Versioning:** Update monthly as Phase 3 → Phase 4 → Phase 12 progresses. See "Version History" in each doc footer.

**Approval:** CTO + Finance sign-off required for any cost changes >10% vs forecast.

---

## Appendix: Cross-References

**Related docs in repo:**

- `firebase.json` — Firebase configuration (region, emulator ports)
- `.claude/rules/deploy-protocol.md` — Pre-deploy gates + secrets check
- `docs/adr/ADR-0011-single-lab-deployment-model-v1-4.md` — Single-tenant decision
- `docs/adr/ADR-0014-notivisa-integration-sandbox-to-production.md` — NOTIVISA cost impact
- `docs/adr/ADR-0018-deploy-gate-secret-status-check.md` — Secret provisioning (cost risk)
- `.planning/milestones/v1.4-ROADMAP.md` — Phase timeline (links cost to each phase)
- `src/features/<module>/CLAUDE.md` — Per-module architecture (can reference cost when adding features)

**External references:**

- Google Cloud Firestore pricing: https://cloud.google.com/firestore/pricing
- Cloud Functions pricing: https://cloud.google.com/functions/pricing
- Cloud Storage pricing: https://cloud.google.com/storage/pricing
- Twilio SMS Brazil rates: https://www.twilio.com/sms/pricing/br

---

## Print-Friendly Version

**For printing board materials, use:**
- COST_ANALYSIS_EXECUTIVE_SUMMARY.md (2 pages)
- FIREBASE_COST_MONITORING_CHECKLIST.md Quick Start (1 page)

**Total printed: 3 pages, fits in one envelope.**

---

## Questions? Contact

- **Cost anomalies / monitoring:** DevOps team (use CHECKLIST.md troubleshooting)
- **Budget approval / finance:** CFO (use EXECUTIVE_SUMMARY.md)
- **Technical deep-dive / architecture:** CTO (use COST_ANALYSIS_Phase3.md)
- **Operational runbook:** DevOps (use CHECKLIST.md)

---

**Last updated:** 2026-05-07  
**Next review:** 2026-06-07 (weekly cost review)  
**Archive:** When Phase 3 completes (approx Week 3), transition to Phase 4 cost forecast
