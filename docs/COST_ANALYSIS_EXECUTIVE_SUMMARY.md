# Firebase Cost Analysis — Executive Summary

**Project:** HC Quality CQ Labclin  
**Analysis Date:** 2026-05-07  
**Period:** Phase 3 (v1.4 foundation) through Phase 12 (launch)  
**Region:** `southamerica-east1` (Brazil)

---

## Bottom Line

**Phase 3 adds ~$11/month to infrastructure.** Cumulative monthly cost grows from $16 (v1.3 baseline) to $27 (Phase 3 end), scaling to $85–100 by Phase 12 (Week 16). **Profitability at 3–5 active labs** (SaaS model: $99/lab/month = 79% margin at 10+ labs).

---

## Cost Breakdown (Monthly)

### Phase 3 Impact (Weeks 1–3 of v1.4)

```
v1.3 Baseline    v1.3 + Phase 3    Delta
─────────────────────────────────────────────
Firestore        $3.33             $3.50          +$0.17 (5 new collections, 8 indexes)
Cloud Functions  $4.45             $8.80          +$4.35 (19 new functions: portals + IA)
Storage          $3.30             $3.63          +$0.33 (dataset + cached PDFs)
SMS              $0                $3.75          +$3.75 (Críticos escalation, pilot)
Monitoring       $2.00             $2.50          +$0.50 (profiling + logs)
Misc             $3.00             $3.10          +$0.10 (rounding, IPs)
─────────────────────────────────────────────
TOTAL            $16/month         $27/month      +$11/month
```

### Projected Monthly Cost by Phase

| Phase | Weeks | Focus | Monthly Cost | Cumulative |
|-------|-------|-------|--------------|-----------|
| **v1.3** | — | Foundation (22 modules) | $16 | $16 |
| **Phase 0b** | 1–2 | RDC blockers (turnos, risks, lab-apoio) | +$2 | $18 |
| **Phase 3.1–3.3** | 1–3 | Portal + IA foundation | +$9 | **$27** |
| **Phase 4–5** | 4–8 | CAPA closure + patient portal | +$8 | $35 |
| **Phase 6–7** | 6–8 | Críticos + feedback portal | +$10 | $45 |
| **Phase 8–9** | 9–11 | NOTIVISA + IA scaling | +$20 | $65 |
| **Phase 10–11** | 12–14 | Multi-equipment + dataset | +$10 | $75 |
| **Phase 12–15** | 16–22 | Performance + launch prep | +$10–25 | $85–100 |

---

## Unit Economics (SaaS Model)

At **$99/month per lab** (market price for ISO 15189 compliance SaaS):

```
Labs    Revenue     Costs       Profit      Margin
──────────────────────────────────────────────────
1       $99         $95         $4          4%      ← still bleeding
3       $297        $105        $192        65%     ← breakeven zone
5       $495        $115        $380        77%     ← comfortable
10      $990        $155        $835        84%     ← healthy
15      $1,485      $200        $1,285      87%     ← excellent
```

**Cost per lab = Fixed($27–85/month) ÷ Lab count + Variable($11–15/lab)**

**Decision rule:** Proceed with Phase 3 if **3+ labs committed** to SaaS pilot.

---

## Risk Factors (Could add $10–30/month)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| IA dataset explosion (Gemini free tier exceeded) | Medium | +$5–15/month | Cap images at 500; batch processing |
| Portal PDF generation at scale (1k+ users) | Low | +$7/month | PDF caching + CDN |
| Critical SMS spikes (equipment malfunction) | Medium | +$10/month | Deduplication + cooldown |
| Analytics polling surge (100+ concurrent) | Medium | +$10/month | Polling backoff + aggregates |

---

## Key Decisions

### Approved Assumptions (ADR-0014 through 0018)

1. **Single-lab (Riopomba) in v1.4** — multi-tenant v2 in v1.5+ (saves $20–40/month infrastructure until Scale)
2. **Gemini 2.5 Flash baseline** — fine-tuning deferred to v1.5 (saves $100–200/month fine-tuning ops)
3. **NOTIVISA sandbox in Phase 8** — production API in v1.5 (avoids gov API costs until ready)
4. **Cloud Functions Node 22** — no upgrade; deprecation Sept 2026 (plan v1.5 upgrade early)
5. **No multi-region replication** — southamerica-east1 only (saves 3x storage costs)

---

## Governance

### Monthly Cost Review

- **Owner:** Finance + CTO
- **Frequency:** Last Friday of month
- **Alert threshold:** $40 (80% of $50 budget)
- **Review window:** 7 days before next month forecast

### Approval Gate for Phase 4 (Months 4–6)

- [ ] Phase 3 costs track within ±15% of forecast
- [ ] 3+ labs in SaaS pilot + signed SOW
- [ ] Críticos SMS escalation tested (no spam/cost overages)
- [ ] IA dataset < 1 GB (no Gemini free tier bleed)
- [ ] Monitoring dashboard + alerts live

---

## Cost Optimization Roadmap (Do These)

| Week | Action | Savings | Effort |
|------|--------|---------|--------|
| 1 | Set up GCP billing alerts + dashboard | N/A | 1h |
| 4 | Evaluate WebSocket polling vs 30s interval | $18/month | 2d |
| 8 | Batch NOTIVISA queue (1h poll instead of 15m) | $5/month | 1d |
| 12 | Archive audit events >90d to BigQuery | $10/month | 3d |

---

## Spreadsheet Attachments

**Detailed cost model:** `docs/COST_ANALYSIS_Phase3.md` (sections 1–12)

- Firestore read/write breakdowns (500k → 575k reads/day)
- Cloud Functions inventory (78 current + 19 new)
- Phase 4–12 projections by stream
- Pricing reference tables (current 2026 rates)

---

## Questions & Answers

**Q: What if we don't hit 3 labs in Year 1?**  
A: Monthly cost is **fixed at ~$85 by Phase 12** regardless of lab count (fixed infrastructure). 1 lab = 100% cost borne by Riopomba. Not economically viable below 3 labs; consider it R&D investment or negotiate fixed licensing.

**Q: Should we wait to deploy Phase 3 until sales confirms demand?**  
A: Phase 3 is already committed (Weeks 1–3 of v1.4). Deferring costs $5–10k in opportunity loss (portal delays affect NPS). **Proceed and optimize in Phase 4–5 if demand signal is weak.**

**Q: Can we reduce to sub-$100/month for Phase 12?**  
A: Unlikely without major refactor (WebSocket polling saves $18, batching saves $5, archiving saves $10 = $33 max). **Target: $75–85/month at Phase 12.** Multi-tenant v2 (v1.5) will **reduce per-lab costs from $12 to $2** by fixing amortization.

**Q: What's the cloud bill risk if a competitor tries to DDoS us?**  
A: Firestore reads scale but are **per-document (metered), not per-request**. A DDoS spike = higher bill but **not runaway** (unlike API keys). Max daily Firestore bill is ~$1.50 at 10M reads (normal = 0.03). **Risk: low but set alert at $75/day.**

---

## Version History

| Ver | Date | Author | Changes |
|-----|------|--------|---------|
| 1.0 | 2026-05-07 | Claude Agent | Initial exec summary + financials |

**Last updated:** 2026-05-07  
**Next review:** 2026-06-07
