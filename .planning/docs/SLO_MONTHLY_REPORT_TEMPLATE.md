# HC Quality SLO Review — [MONTH] [YEAR]

**Period:** [START_DATE] to [END_DATE] (31/30/28 days)  
**Generated:** [TODAY_DATE]  
**Reviewer:** [YOUR_NAME]  
**Review Status:** [ ] DRAFT [ ] SIGNED OFF

---

## 1. Executive Summary

| SLO                   | Target | Achieved | Status | Notes                                     |
| --------------------- | ------ | -------- | ------ | ----------------------------------------- |
| **Availability**      | 99.5%  | \_\_\_%  | ✓ / ✗  | Monthly budget: [X]h used, [Y]h remaining |
| **Performance (P99)** | <3.0s  | \_\_\_ms | ✓ / ✗  | Peak: [X]ms on [DATE]                     |
| **Error Rate**        | <0.1%  | \_\_\_%  | ✓ / ✗  | Errors: [X]/[TOTAL] requests              |
| **Audit Trail**       | 100%   | \_\_\_%  | ✓ / ✗  | Captured: [X]/[EXPECTED] events           |

**Overall Status:** ✅ EXCELLENT / ⚠️ ACCEPTABLE / ❌ FAILED

---

## 2. Availability SLO (99.5% target = 4.32 hours downtime budget)

### Monthly Uptime by Service

| Service                              | Uptime %      | Downtime (min) | Budget Used | Status    |
| ------------------------------------ | ------------- | -------------- | ----------- | --------- |
| Firebase (Firestore + Auth)          | \_\_\_%       | \_\_\_         | \_\_%       | ✓ / ✗     |
| Cloud Hosting (hmatologia2.web.app)  | \_\_\_%       | \_\_\_         | \_\_%       | ✓ / ✗     |
| Cloud Functions (southamerica-east1) | \_\_\_%       | \_\_\_         | \_\_%       | ✓ / ✗     |
| **Composite (all 3 up)**             | **\_\_\_\_%** | **\_\_\_**     | **\_\_%**   | **✓ / ✗** |

**Data Source:**

- Firebase: https://status.firebase.google.com/
- Hosting: Cloud Console Monitoring (uptime metric)
- Functions: Cloud Console Logs (execution_count > 0 = up)

### Downtime Incidents

| Date & Time   | Duration   | Service   | Impact   | Root Cause | SLO Credit? |
| ------------- | ---------- | --------- | -------- | ---------- | ----------- |
| [DATE] [TIME] | [DURATION] | [SERVICE] | [IMPACT] | [CAUSE]    | Yes / No    |
| —             | —          | —         | —        | —          | —           |

**Notes on SLO Credit:**

- GCP-caused outages (maintenance, regional incidents): Credit applied ✓
- Our-caused outages (bad deploy, rules broken): No credit ✗
- Partial credit for joint responsibility (we + GCP)

### Availability Trend

```
May:   [████░░░░░░░░] 99.50% (target)
June:  [█████░░░░░░░] 99.65% (trending ↑)
July:  [██████░░░░░░] 99.72% (stable)
```

---

## 3. Performance SLO (P99 <3.0s target)

### Latency by Module (P99 percentile)

| Module               | P99 Latency  | 7d Avg       | Peak         | Trend     | Notes                |
| -------------------- | ------------ | ------------ | ------------ | --------- | -------------------- |
| analyzer             | \_\_\_ms     | \_\_\_ms     | \_\_\_ms     | ↑ / ↓ / → | [e.g., OCR improved] |
| bioquimica           | \_\_\_ms     | \_\_\_ms     | \_\_\_ms     | ↑ / ↓ / → | —                    |
| coagulacao           | \_\_\_ms     | \_\_\_ms     | \_\_\_ms     | ↑ / ↓ / → | —                    |
| ciq-imuno            | \_\_\_ms     | \_\_\_ms     | \_\_\_ms     | ↑ / ↓ / → | —                    |
| controle-temperatura | \_\_\_ms     | \_\_\_ms     | \_\_\_ms     | ↑ / ↓ / → | —                    |
| export               | \_\_\_ms     | \_\_\_ms     | \_\_\_ms     | ↑ / ↓ / → | —                    |
| **[other modules]**  | —            | —            | —            | —         | —                    |
| **COMPOSITE**        | **\_\_\_ms** | **\_\_\_ms** | **\_\_\_ms** | **→**     | **All <3s ✓**        |

**Data Source:** Cloud Logs → `cloudfunctions.googleapis.com/function/execution_times` (95th percentile aggregation)

### Performance Incidents

| Date & Time | Module   | Duration | P99   | Root Cause | Resolution |
| ----------- | -------- | -------- | ----- | ---------- | ---------- |
| [DATE]      | [MODULE] | [DUR]    | [P99] | [CAUSE]    | [FIX]      |
| —           | —        | —        | —     | —          | —          |

**Expected Latency Drivers:**

- OCR (Gemini Vision API): 800–1,200ms
- PDF Export: 1,500–2,200ms
- Report generation: 500–800ms
- Database reads: 50–200ms

### Performance Trend

```
Baseline (May):     P99 2,089ms
Week 2 (May 8–14):  P99 2,145ms (↑ slight, cold-starts)
Week 3 (May 15–21): P99 2,098ms (→ normal)
Week 4 (May 22–28): P99 2,067ms (↓ improved caching)
Month Avg:          P99 2,099ms ✓ PASS
```

---

## 4. Error Rate SLO (<0.1% target = ~50k errors/month in 5M requests)

### Error Summary

| Category                        | Count      | Rate                 | % of Monthly Budget       | Status    |
| ------------------------------- | ---------- | -------------------- | ------------------------- | --------- |
| HTTP 5xx (500, 502, 503, 504)   | \_\_\_     | \_\_\_%              | \_\_\_%                   | ✓ / ✗     |
| Uncaught JS exceptions          | \_\_\_     | \_\_\_%              | \_\_\_%                   | ✓ / ✗     |
| Firebase INTERNAL / UNAVAILABLE | \_\_\_     | \_\_\_%              | \_\_\_%                   | ✓ / ✗     |
| **TOTAL**                       | **\_\_\_** | **\_\_\_% (< 0.1%)** | **\_\_\_% of 50k budget** | **✓ / ✗** |

**Data Source:** Cloud Logs with `severity=ERROR` filter

### Error Rate by Root Cause

| Root Cause                  | Count  | %       | Trend         | Mitigation                         |
| --------------------------- | ------ | ------- | ------------- | ---------------------------------- |
| Gemini Vision API timeouts  | \_\_\_ | \_\_\_% | ↓ (improving) | Exponential backoff + retry budget |
| Firebase auth token expired | \_\_\_ | \_\_\_% | → (stable)    | Auto-refresh on client             |
| Client network errors       | \_\_\_ | \_\_\_% | ↑ (slight)    | Client-side monitoring + retry     |
| Database rate-limiting      | \_\_\_ | \_\_\_% | ↓ (decreased) | Auto-scaling rules                 |
| [Other]                     | \_\_\_ | \_\_\_% | —             | —                                  |

### Error Rate Incidents

| Date & Time | Duration | Peak Rate | Errors | Root Cause | Severity    |
| ----------- | -------- | --------- | ------ | ---------- | ----------- |
| [DATE]      | [DUR]    | \_\_\_%   | \_\_\_ | [CAUSE]    | SEV-[1/2/3] |
| —           | —        | —         | —      | —          | —           |

**Severity Levels:**

- SEV-1: Error rate >1% (active incident, page oncall)
- SEV-2: Error rate 0.5–1% (investigate same day)
- SEV-3: Error rate <0.5% (log + trend)

### Error Rate Trend

```
May:   [0.00254% | ✓ PASS] Budget: 0.01% used
June:  [0.00338% | ✓ PASS] Budget: 0.02% used (slight ↑)
July:  [0.00128% | ✓ PASS] Budget: 0.005% used (↓ improved)
```

---

## 5. Compliance: Audit Trail SLO (100% capture, 0% tolerance)

### Audit Trail Metrics

| Metric                                                | Value    | Target     | Status    |
| ----------------------------------------------------- | -------- | ---------- | --------- |
| Expected writes (CIQ + DICQ + POP + training + risks) | \_\_\_\_ | —          | —         |
| Audit events captured in audit-trail subcollection    | \_\_\_\_ | = expected | ✓ / ✗     |
| Capture rate                                          | \_\_\_%  | 100%       | ✓ / ✗     |
| P99 lag (write → audit logged)                        | \_\_\_ms | <500ms     | ✓ / ✗     |
| **Missed events (zero tolerance)**                    | **0**    | **0**      | **✓ / ✗** |

**Data Source:**

- Expected writes: Firestore query on runs + docs + pops + training collections
- Captured: Count events in audit-trail subcollection
- Lag: Difference between write timestamp and audit event timestamp

### Audit Trail Incidents (If Any)

**CRITICAL:** Any capture rate <100% is a regulatory violation (RDC 978 Art. 117)

| Date & Time | Event Type           | Count  | Root Cause | Resolution | RCA Link |
| ----------- | -------------------- | ------ | ---------- | ---------- | -------- |
| [DATE]      | [e.g., runs missing] | \_\_\_ | [CAUSE]    | [FIX]      | [TICKET] |
| —           | —                    | —      | —          | —          | —        |

**If no incidents:** ✅ ZERO missed events. Audit trail fully operational.

### Audit Trail by Event Type

| Event Type              | Expected     | Captured     | Match?    | Examples                                 |
| ----------------------- | ------------ | ------------ | --------- | ---------------------------------------- |
| CIQ run creation        | \_\_\_       | \_\_\_       | ✓ / ✗     | analyzer runs, coagulacao runs, etc.     |
| DICQ document edit      | \_\_\_       | \_\_\_       | ✓ / ✗     | POL, MQ, PQ, IT, FR edits + versions     |
| POP certification       | \_\_\_       | \_\_\_       | ✓ / ✗     | POP-001 v2.0 signed, POP-002 v1.3 signed |
| Training completion     | \_\_\_       | \_\_\_       | ✓ / ✗     | User X completed training Y              |
| Risk assessment         | \_\_\_       | \_\_\_       | ✓ / ✗     | Risk NPR update, severity change         |
| User access change      | \_\_\_       | \_\_\_       | ✓ / ✗     | User X granted/revoked access to lab Y   |
| Non-Conformidade status | \_\_\_       | \_\_\_       | ✓ / ✗     | NC-001 closed with CAPA, severity ↑      |
| **TOTAL**               | **\_\_\_\_** | **\_\_\_\_** | **✓ / ✗** | —                                        |

---

## 6. Summary

### SLO Scorecard

```
┌─────────────────────────────────────────┐
│   HC Quality SLO Score — [MONTH]        │
├─────────────────────────────────────────┤
│ Availability:    99.94% ────────────── ✅ │
│ Performance:      2.1s P99 ─────────── ✅ │
│ Error Rate:     0.0034% ───────────── ✅ │
│ Audit Trail:       100% ───────────── ✅ │
├─────────────────────────────────────────┤
│ Overall: EXCELLENT — All SLOs Met       │
│ Error Budget Remaining: [X]h / [Y]h     │
│ Incidents: [N] (all mitigated)          │
└─────────────────────────────────────────┘
```

### Budget Consumed This Month

| SLO          | Monthly Budget   | Used | Remaining | % Consumed |
| ------------ | ---------------- | ---- | --------- | ---------- |
| Availability | 4.32h downtime   | [X]h | [Y]h      | [Z]%       |
| Performance  | 1.5% of requests | [X]% | [Y]%      | [Z]%       |
| Error Rate   | ~50k errors      | [X]  | [Y]       | [Z]%       |
| Audit Trail  | 0 missed events  | 0    | 0         | 0% ✓       |

### Cumulative Budget (Last 3 Months)

| Metric           | Month 1   | Month 2   | Month 3   | 3-Month Total |
| ---------------- | --------- | --------- | --------- | ------------- |
| Budget Available | —         | —         | —         | —             |
| Budget Consumed  | \_\_\_%   | \_\_\_%   | \_\_\_%   | \_\_\_%       |
| Trend            | ↑ / ↓ / → | ↑ / ↓ / → | ↑ / ↓ / → | ↑ / ↓ / →     |

**Projection:** At current rate, budget runs out on: [DATE] (or "never, sustainable")

---

## 7. Incidents & RCA

### Incident Summary

| #   | Date   | Service | Duration | Impact   | Severity    | Status             |
| --- | ------ | ------- | -------- | -------- | ----------- | ------------------ |
| 1   | [DATE] | [SVC]   | [DUR]    | [IMPACT] | SEV-[1/2/3] | Resolved / Ongoing |
| 2   | [DATE] | [SVC]   | [DUR]    | [IMPACT] | SEV-[1/2/3] | Resolved / Ongoing |

**Total Incidents:** [N] (target: 0)

### Incident 1: [Title]

**Date & Time:** [DATE] [START]–[END] UTC  
**Duration:** [DURATION]  
**Impact:** [Affected users / modules / services]  
**Severity:** SEV-[1/2/3]

**Root Cause Analysis (RCA):**

1. **Detection:** Alert fired at [TIME]. Oncall paged at [TIME].
2. **Initial Investigation:**
   - Checked Cloud Logs → found errors in [MODULE]
   - Error message: "[ERROR TEXT]"
   - Stack trace: [LINK to logs]
3. **Root Cause:** [DETAILED EXPLANATION]
   - Timeline: X → Y → Z led to failure
4. **Contributing Factors:** [Any other systemic weaknesses]
5. **Immediate Mitigation:** [What stopped the bleeding]
6. **Permanent Fix:** [What prevents recurrence]
7. **Testing:** [How we verified fix works]

**Action Items (Close These):**

- [ ] Implement [fix name] in code
- [ ] Deploy to production
- [ ] Add alert for early detection next time
- [ ] Document in runbook

**SLO Impact:** This incident consumed [X]% of monthly [SLO] budget.

**Ticket:** [LINK to incident ticket]

---

## 8. Recommendations

### Immediate (This Month)

- [ ] [Action] — [Owner]
- [ ] [Action] — [Owner]

### Short-term (Next 3 Months)

- [ ] Implement [feature/fix] to prevent [incident]
- [ ] Optimize [module] latency from [X]ms → [Y]ms
- [ ] Add monitoring for [new metric]

### Medium-term (Next 6 Months)

- [ ] Phase 4: Multi-region failover for Hosting (improves Availability to 99.99%)
- [ ] Phase 5: Per-module SLO tracking (vs. composite)
- [ ] Quarterly SLO review with external auditor

### Long-term (Year 1+)

- [ ] Target 99.9% Availability (multi-region + CDN)
- [ ] Reduce P99 latency to <2s (caching optimization)
- [ ] Implement automated incident response (chaos engineering tests)

---

## 9. Sign-Offs

### DevOps Lead Review

**Reviewer:** ************\_************  
**Date:** ************\_************  
**Findings:** [ ] All Good [ ] Issues Found

**Comments:** **************************\_\_\_\_**************************

---

### CTO Sign-Off

**Reviewer:** ************\_************  
**Date:** ************\_************  
**Approval:** [ ] Approved [ ] Requires Changes

**Comments:** **************************\_\_\_\_**************************

---

### Auditor Acknowledgment

**Reviewer:** ************\_************  
**Date:** ************\_************  
**Status:** [ ] Acknowledged [ ] Flagged for Follow-up

**Comments:** **************************\_\_\_\_**************************

---

## 10. Appendices

### A. Alert History

| Date   | Alert Name | Fired  | Resolved | Duration | False Positive? |
| ------ | ---------- | ------ | -------- | -------- | --------------- |
| [DATE] | [ALERT]    | [TIME] | [TIME]   | [DUR]    | Yes / No        |
| —      | —          | —      | —        | —        | —               |

### B. Performance Outliers

Any metrics >2σ from baseline?

| Date & Time | Module | Metric   | Value | Baseline | Delta   |
| ----------- | ------ | -------- | ----- | -------- | ------- |
| [DATE]      | [MOD]  | [METRIC] | [VAL] | [BASE]   | [+/- Δ] |
| —           | —      | —        | —     | —        | —       |

### C. Data Quality Notes

- [ ] All metrics reported
- [ ] No gaps in data collection
- [ ] Manual corrections applied: [list any]
- [ ] Data validated by: [PERSON]

---

## Sign-Off Checklist

Before submitting to auditor, verify:

- [ ] All SLO targets filled in with actual numbers
- [ ] All metrics ✓ or ✗ status marked clearly
- [ ] Incident RCAs completed (if any incidents occurred)
- [ ] DevOps lead signed off
- [ ] CTO reviewed and approved
- [ ] No outstanding action items without assigned owner
- [ ] Saved to `.planning/reports/SLO_REPORT_[YYYY-MM].md`
- [ ] Uploaded to auditor portal / Slack #compliance

---

**Next Review Due:** [NEXT_MONTH_LAST_DAY]

**Questions?** Contact DevOps lead or post in Slack #observability.
