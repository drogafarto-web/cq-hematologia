---
phase: 07-advanced-auditoria
status: planned
date_created: 2026-05-08
date_planned: 2026-05-08
duration_weeks: 2
---

# Phase 7 — Advanced Auditoria + AI Insights

**Milestone:** v1.4 Extended Quality Assurance  
**Period:** 2026-07-15 → 2026-08-04 (2 weeks)  
**Team:** 2 FTE (1 backend, 1 frontend) + AI specialist (0.5 FTE)  
**Scope:** Cross-collection audit trail enhancements, anomaly detection, smart alerts, NLP reporting

---

## Goals & Compliance

| Goal | Regulatory Basis | Deliverables |
|------|------------------|--------------|
| **Enhanced Audit Trail** | RDC 978 5.3, DICQ 4.4 | Cross-collection diffs, context capture, signature validation |
| **Anomaly Detection** | DICQ 4.4, RDC 978 Art. 107 | Baseline-driven detection, Gemini semantic analysis, confidence scoring |
| **Real-time Alerts** | RDC 978 5.3, DICQ 4.4 | Alert routing (role-based), drill-down context, dismissal workflow |
| **Audit Reporting** | RDC 978 Art. 107, DICQ 4.4 | NLP-powered summaries (Portuguese), PDF/CSV exports, scheduled reports |

**Compliance Target:** RDC 978 (Art. 107, 5.3) + DICQ 4.4 (Trilha de Auditoria, Investigação de NC)

---

## Phase 7 Plans

### Plan 07-01: Audit Trail Extension (Wave 1)
- **Focus:** Cross-collection diff detection, context capture, signature validation
- **Files Modified:** auditTrail.ts, auditDiffDetector.ts, contextCapture.ts, firestore.rules
- **Deliverables:**
  - Deterministic diff engine (field-level changes)
  - Context payload builder (operator, lab, location, intent)
  - Enhanced writeAuditEntry() with diff + context
  - Firestore rules (callable-only writes, immutability)
- **Must-Haves:**
  - Audit trail captures before/after state for every regulated write
  - Context includes: operatorId, role, lab, location, operation intent
  - Diffs are cryptographically signed (non-repudiation)
  - Rules enforce: reads only by auditors, writes only by Cloud Functions

### Plan 07-02: Anomaly Detection Engine (Wave 2)
- **Focus:** Baseline-driven anomaly detection, AI pattern matching, Gemini integration
- **Files Modified:** anomalyDetector.ts, normalizeBaseline.ts, aiPatternMatcher.ts, firestore.indexes.json
- **Deliverables:**
  - Operator behavior baseline (operation frequency, time-of-day, result distribution)
  - Anomaly scorer (5 dimensions: operation rarity, time anomaly, result rarity, velocity, module jump)
  - Gemini-powered pattern matching (semantic analysis, risk assessment)
  - Cloud Function trigger on audit trail writes
  - Firestore indexes for baseline + anomaly queries
- **Must-Haves:**
  - Anomaly detection runs on every audit entry (non-blocking trigger)
  - Confidence scoring 0.0–1.0 for triage
  - High-confidence anomalies (>0.85) trigger AI analysis
  - Baseline data-driven from historical audit entries

### Plan 07-03: Smart Alert System (Wave 2–3)
- **Focus:** Real-time alerts, role-based routing, interactive drill-down
- **Files Modified:** alertEngine.ts, useAnomalyAlerts.ts, AlertCenter.tsx, firestore.rules
- **Deliverables:**
  - Alert generation from anomalies (severity: critical/high/medium)
  - Alert routing (AUDITOR gets all, RT gets module-specific)
  - Real-time subscription hook + alert dashboard UI
  - Drill-down modal (operator profile, anomaly breakdown, AI insight, related audits)
  - Dismissal workflow (reason required, logged for audit)
- **Must-Haves:**
  - Alerts generated automatically for score >0.85
  - Real-time notification via Firebase listener
  - Alert dashboard world-class design (Apple/Linear/Stripe standard)
  - Dismissal logged separately (compliance audit trail)

### Plan 07-04: Audit Report Generation (Wave 3)
- **Focus:** NLP-powered summaries, PDF/CSV exports, scheduled reporting
- **Files Modified:** reportGenerator.ts, nlpSummarizer.ts, ReportBuilder.tsx, useAuditReportExport.ts
- **Deliverables:**
  - Gemini-powered NLP summarization (Portuguese, 150–200 words)
  - Report wizard UI (3-step: filters → preview → export)
  - PDF + CSV export (Cloud Storage backed)
  - Scheduled reporting (daily/weekly/monthly with email)
  - RDC 978 compliance mapping in reports
- **Must-Haves:**
  - Report generation <10 seconds for 1000 audit entries
  - Summary written in Portuguese, non-technical language
  - Exports include: summary, metrics, audit data table, anomaly analysis, RDC 978 mapping
  - Scheduled reports auto-emailed to recipients

---

## Dependency Graph

```
Phase 7-01 (Audit Trail Extension)
├─ Diff detection engine
├─ Context capture
├─ Enhanced auditTrail module
└─ Firestore rules

    ↓ depends on 07-01

Phase 7-02 (Anomaly Detection)
├─ Baseline computation
├─ Anomaly scoring
├─ AI pattern matching
└─ Cloud Function trigger
│
└─→ Phase 7-03 (Smart Alerts) [parallel, both depend on 07-01]
    ├─ Alert generation
    ├─ Role-based routing
    ├─ Real-time subscription hook
    └─ AlertCenter UI + dismissal

        ↓ depends on 07-02, 07-03

    Phase 7-04 (Audit Reports)
    ├─ NLP summarization
    ├─ Report generation
    ├─ ReportBuilder UI
    └─ Scheduled exports
```

---

## Wave Structure

| Wave | Plans | Autonomous | Duration |
|------|-------|-----------|----------|
| 1 | 07-01 | yes | 3–4 days |
| 2 | 07-02, 07-03 | yes (parallel) | 4–5 days |
| 3 | 07-04 | yes | 2–3 days |

**Total:** 2 weeks (9–12 days of implementation + 2–3 days for testing + 1 day deploy gate)

---

## Key Technologies

| Layer | Technology | Purpose | Cost/Impact |
|-------|-----------|---------|------------|
| Diff Detection | Native JS (crypto module) | Field-level change tracking | $0 |
| Baseline Computation | Firestore queries + native JS | Operator behavior analysis | $0 (included in Firestore) |
| Anomaly Scoring | Native JS (weighted scoring) | Deviation detection | $0 |
| AI Analysis | Gemini 2.5 Flash | Semantic pattern matching | ~$0.005/call (est. 200/day = $1/day for large lab) |
| PDF Export | TBD (check project deps) | Report generation | Depends on library choice |
| Cloud Storage | Firebase Cloud Storage | Report hosting | <$1/month for typical volume |
| Scheduled Reports | Cloud Scheduler + Cloud Functions | Automated export | <$1/month |

---

## Compliance Mapping

### RDC 978 / 2025

| Article | Requirement | Phase 7 Implementation |
|---------|-------------|----------------------|
| Art. 5.3 | Audit trail with signature | 07-01: diff + context + HMAC signature |
| Art. 107 | Regular audit reviews | 07-04: automated report generation |
| Art. 86 | CAPA documentation | 07-01: audit trail supports CAPA investigation |

### DICQ 4.3 / 2024

| Block | Requirement | Phase 7 Implementation |
|-------|-------------|----------------------|
| 4.4 | Trilha de auditoria (audit trail monitoring) | 07-01 + 07-02 + 07-03 |
| 4.4 | Investigação de NC (non-conformance investigation) | 07-04: audit report supports investigation |
| 4.14.6 | CAPA management | 07-01: audit context supports CAPA links |

---

## Testing Strategy

### Unit Tests
- Diff detection: 8+ test cases (primitives, nested objects, arrays, special values)
- Baseline computation: 8+ cases (new operator, experienced, role change, time-of-day)
- Anomaly scoring: 10+ cases (rarity, time, result, velocity, module jump)
- NLP summarization: 5+ cases (normal, insufficient data, zero anomalies, timeout)
- Alert routing: 6+ cases (auditor, RT, module assignment, dismissal)

### Integration Tests
- Cloud Function trigger (anomaly detection on audit write)
- Firestore rules (read/write/delete access control)
- Real-time subscription (alert listener cleanup)
- Report generation (query → summarize → export)

### E2E Tests (if available)
- Anomaly detection trigger flow
- Alert dismissal workflow
- Report generation + download

**Target:** ≥85% branch coverage (backend), ≥80% component coverage (frontend)

---

## Risk Register (Phase 7)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|----------|
| Gemini API cost overruns | Low | $$ | Rate limit: only high-confidence anomalies (>0.80). Cost cap: $10/lab/month. Monitor daily spending. |
| Anomaly detection false positive rate >50% | Medium | ⚠️ | Tuning post-deployment. Start with high threshold (0.85), gradually lower. Dismissal tracking. |
| PDF export library unavailable | Low | ⚠️ | Check project dependencies first. Use alternative: HTML-to-PDF service or Cloud Functions + Puppeteer. |
| Report generation timeout for large labs | Low | ⚠️ | Limit query to 5000 entries per report. Paginate if >5000. Cache results for 1 hour. |
| Real-time alert subscription memory leak | Low | 🔴 | Enforce unsubscribe on component unmount. Test with Chrome DevTools Memory tab. |

---

## Success Criteria

- [ ] All 4 plans completed and deployed
- [ ] Audit trail captures field-level diffs + context for every regulatory write
- [ ] Anomaly detection baseline computed and verified (>90% new operator accuracy)
- [ ] Alert system real-time (< 2 sec delivery to auditor UI)
- [ ] Report generation <10 seconds for 1000 entries
- [ ] NLP summaries in Portuguese, professional tone, 150–200 words
- [ ] All test suites passing (≥85% backend coverage, ≥80% frontend)
- [ ] WCAG AA accessibility verified
- [ ] RDC 978 Art. 5.3, 107 + DICQ 4.4 compliance achieved
- [ ] Cost validated (<$15/month for typical 10-lab deployment)

---

## Timeline & Milestones

**Week 1 (Jul 15–21):**
- Day 1–2: 07-01 (Audit Trail Extension) complete + deployed
- Day 3–4: 07-02 (Anomaly Detection) complete
- Day 5: 07-03 (Smart Alerts) UI in progress

**Week 2 (Jul 22–28):**
- Day 6–7: 07-03 complete + deployed
- Day 8–9: 07-04 (Audit Reports) complete
- Day 10: Testing + E2E + deploy gate
- Day 11–12: Deploy to production + monitoring
- Day 13–14: Buffer for issues + sign-off

**Deploy Date:** 2026-08-04 (14:00 UTC)

---

## Post-Deployment Monitoring

- **Cloud Logs:** monitor function invocation count, error rate, latency (Phase 3 baseline: <100ms for audit writes)
- **Cloud Storage:** verify report upload success rate + cost tracking
- **Anomaly Detection:** track false positive rate (target: <30%)
- **Alert System:** measure time from anomaly detection to auditor notification (target: <2 sec)
- **NLP Summarization:** verify Portuguese output + cost per report

**Monitoring Dashboard:** Fire up `scripts/monitor-cloud-logs.sh` post-deploy for 24h baseline.

---

## Handoff to Phase 8

After Phase 7 deploy (2026-08-04):
1. **Update ROADMAP.md:** Phase 7 status = COMPLETE
2. **Archive:** Phase 7 documentation + deployment notes to `.planning/milestones/`
3. **Next Phase:** Phase 8 begins 2026-08-05 (NOTIVISA edge cases + Labs Apoio contracts)
4. **Compliance Review:** Prepare Phase 7 evidence for RDC 978 Art. 107 audit (due 2026-08-31)

---

**Created:** 2026-05-08  
**Status:** PLANNED (ready for Wave 1 execution)  
**Owner:** CTO (@drogafarto)  
**Executors:** Backend engineer + Frontend engineer + AI specialist (partial)
