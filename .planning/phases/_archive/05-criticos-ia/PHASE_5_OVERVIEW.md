---
phase: '5'
milestone: 'v1.4'
title: 'Phase 5 — Critical Values + IA Strip Parsing (Complete Planning)'
date_created: '2026-05-07'
date_updated: '2026-05-07'
status: 'planning-complete'
---

# Phase 5 — Critical Values + IA Strip Parsing

**Milestone:** v1.4 — Enhanced Compliance + IA Foundation  
**Wave:** 3 (Advanced Workflows, Weeks 6–7)  
**Duration:** 15 days (Phase 5 execution: 2026-06-09 → 2026-06-30)  
**Status:** ✅ **Planning complete, 4 comprehensive PLAN.md files ready for execution**

---

## Executive Summary

Phase 5 delivers two critical features to HC Quality:

### 1. **Critical Values Module** (Tasks 05-01 & 05-02)

Real-time escalation of critical laboratory results with state machine (NORMAL → CRITICAL → ALERTED → RESOLVED), configurable thresholds per analyte/equipment, and multi-channel notification (SMS + Email + Cloud Logs).

**Scope:** Severity configuration UI, detection engine, notification cascade, SLA tracking, retry logic, audit trail.  
**Compliance:** RDC 978 Arts. 99 (timely notification), 115 (escalation rules), 5.3 (audit trail), 167 (operator alerting) · DICQ 4.6.3 (critical workflow)  
**Timeline:** 6 days (05-01: 3 days, 05-02: 3 days)

### 2. **IA OCR Strip Parsing** (Tasks 05-03 & 05-04)

Automated Gemini 2.5 Flash Vision OCR for immunology analyzer strips (Yumizen H550), with golden dataset collection for v1.5 fine-tuning and A/B testing framework for model validation.

**Scope:** Gemini integration, strip image upload/storage, reconciliation with analyzer, training dataset versioning, A/B testing infrastructure, confidence threshold tuning.  
**Compliance:** RDC 978 Art. 99 (result accuracy + timely delivery) · DICQ 4.7 (training dataset management) · DICQ 4.2.2 (analytical phase controls)  
**Timeline:** 9 days (05-03: 5 days, 05-04: 4 days)

---

## Phase Goals (RDC 978 & DICQ)

| Requirement          | Goal                                      | Addressed By                              |
| -------------------- | ----------------------------------------- | ----------------------------------------- |
| **RDC 978 Art. 99**  | Critical result escalation within <5 min  | 05-01, 05-02 (SLA tracking)               |
| **RDC 978 Art. 115** | Critical value detection + thresholds     | 05-01 (state machine + config)            |
| **RDC 978 Art. 5.3** | Audit trail for all critical events       | 05-01, 05-02 (immutable logs)             |
| **RDC 978 Art. 167** | Operator notification of critical results | 05-02 (SMS + Email + Portal)              |
| **DICQ 4.6.3**       | Critical value workflow documented        | 05-01 (state machine, rules)              |
| **DICQ 4.7**         | Training dataset management               | 05-03, 05-04 (versioning, golden samples) |
| **DICQ 4.2.2**       | Analytical phase quality controls         | 05-03 (OCR accuracy validation)           |

---

## Phase Breakdown

### Task 05-01: Critical Values — State Machine & Severity Rules (3 days)

**Owner:** Stream A (Backend/Cloud Functions)  
**Deliverables:**

- Critical detection engine (`recordRunWithCriticalDetection` callable)
- Severity configuration (thresholds: low/high critical, low/high warn)
- State machine (FLAGGED → ALERTED → RESOLVED)
- Firestore Rules (escalacoes collection, server-write-only)
- Admin UI (threshold editor, audit log viewer)

**Success metrics:**

- Detection latency <100ms per run
- 25+ unit tests green
- RDC 978 Art. 115 compliance verified

---

### Task 05-02: Critical Values — Notification Cascade (3 days)

**Owner:** Stream A (Backend/Cloud Functions)  
**Deliverables:**

- Escalation callable (`escalateCriticalValue`)
- SMS integration (Twilio, E.164 formatting)
- Email integration (Resend, HTML template)
- Retry queue processor (exponential backoff, max 3 attempts)
- SLA tracking (target <5 min, logged per RDC 978 Art. 99)
- Cloud Logs + audit trail

**Success metrics:**

- SMS/Email sent <500ms
- SLA tracked + monitored (Cloud Monitoring alert policy)
- RDC 978 Arts. 99, 167, 5.3 compliance verified

---

### Task 05-03: IA OCR Integration — Gemini Strip Parsing (5 days)

**Owner:** Stream C (IA/ML engineer)  
**Deliverables:**

- Gemini Vision API integration (`parseImmunologyStrip` callable)
- Strip image upload + Cloud Storage management
- OCR result reconciliation (delta calculation vs analyzer)
- Training data collection framework
- Frontend UI (camera capture, results review, operator feedback)

**Success metrics:**

- OCR accuracy ≥92% on 100-sample validation set
- Parsing latency <10s per image
- Zero PHI leakage from images
- DICQ 4.7 training dataset infrastructure ready

---

### Task 05-04: IA Training Dataset & Model Versioning (4 days)

**Owner:** Stream C (IA/ML engineer)  
**Deliverables:**

- Training version lifecycle (COLLECTING → READY → DEPLOYED → ARCHIVED)
- Golden sample annotation interface (expert validation UI)
- A/B testing framework (control vs treatment, daily metrics aggregation)
- Model selection mechanism (active version per lab, canary/AB strategies)
- Confidence threshold tuning (per-analyte, auto-accept/review/reject logic)

**Success metrics:**

- Version immutability enforced (audit trail)
- A/B test metrics aggregated correctly (nightly)
- Confidence threshold tuning reduces false negatives to <1%
- Admin UI allows golden sample annotation + version promotion

---

## Dependency Graph

```
Phase 4 Complete (Portal + NOTIVISA)
├─→ Email infrastructure (used by 05-02 notifications)
└─→ NOTIVISA retry queue pattern (reference for 05-02 retry logic)

Phase 3 Complete (Schema Extensions)
├─→ criticos-escalacoes collection
├─→ imuno-ias-dev collection
└─→ Firestore Rules baseline

05-01 (Críticos Detection)
├─→ CriticalFlag state machine
├─→ Thresholds CRUD
└─→ FLAGGED escalations ready for 05-02

05-02 (Críticos Escalation)
├─→ Uses CriticalFlag from 05-01
├─→ SMS/Email + audit trail
└─→ Portal notification queue (async)

05-03 (IA OCR Parsing)
├─→ Gemini integration
├─→ Strip images + reconciliation
└─→ Training data collection

05-04 (IA Versioning)
└─→ Uses strip images + OCR results from 05-03
    Golden dataset, A/B testing, model selection
```

**Critical path:** 05-01 → 05-02 (serial, 6 days) + 05-03 → 05-04 (parallel, 9 days) = **15 days total, 2 parallel streams**

---

## Wave 3 Context (v1.4)

Phase 5 is part of **Wave 3 — Advanced Workflows** (Weeks 6–7, parallel execution).

| Phase | Focus                       | Duration    | Parallel  | Gate                  |
| ----- | --------------------------- | ----------- | --------- | --------------------- |
| **4** | Patient Portal + NOTIVISA   | ✅ Complete | —         | Phase 3 ✅            |
| **5** | Critical Values + IA Strip  | 2 weeks     | Weeks 6–7 | Phase 4 ✅            |
| **6** | Reclamações/Feedback Portal | 1.5 weeks   | Week 6–7  | Phase 5 UI foundation |

Phase 5 gates Phase 6 (feedback portal uses critical escalation infra) and provides IA foundation for v1.5 fine-tuning.

---

## Compliance Mapping

### RDC 978/2025 Compliance

| Article   | Requirement                     | Phase 5 Delivery                  | Verification                          |
| --------- | ------------------------------- | --------------------------------- | ------------------------------------- |
| **6º §1** | NOTIVISA notifications          | 05-02 (retry queue infra)         | NOTIVISA queue processor (Phase 4-03) |
| **99**    | Timely critical result delivery | 05-02 (SLA <5 min)                | Cloud Monitoring + audit log          |
| **115**   | Critical value escalation rules | 05-01 (thresholds, state machine) | Admin UI threshold editor             |
| **5.3**   | Audit trail for critical events | 05-01, 05-02 (immutable logs)     | All escalations logged + signed       |
| **167**   | Operator notification           | 05-02 (SMS + Email)               | NOTIVISA queue + Portal               |

**Phase 5 RDC Compliance Target:** ✅ **100%** (Arts. 99, 115, 167, 5.3, 6º §1)

### DICQ 8ª Edição Compliance

| Block     | Requirement                 | Phase 5 Delivery                   | Verification                        |
| --------- | --------------------------- | ---------------------------------- | ----------------------------------- |
| **4.2.2** | Analytical phase controls   | 05-03 (OCR validation)             | Accuracy ≥92%, reconciliation logic |
| **4.6.3** | Resultado crítico workflow  | 05-01 (state machine)              | FLAGGED → ALERTED → RESOLVED        |
| **4.7**   | Training dataset management | 05-04 (versioning, golden samples) | Version immutability, audit trail   |

**Phase 5 DICQ Compliance Target:** ✅ **Blocks 4.2.2, 4.6.3, 4.7 satisfied**

### LGPD Compliance

| Article | Requirement             | Phase 5 Delivery                                 | Verification                |
| ------- | ----------------------- | ------------------------------------------------ | --------------------------- |
| **7**   | Sensitive data handling | 05-02 (SMS/Email privacy), 05-03 (image storage) | PHI masking, audit trail    |
| **9**   | Data subject rights     | 05-02 (log escalations for transparency)         | All notifications logged    |
| **18**  | Data access right       | 05-02 (portal notification queue)                | Patient portal (Phase 4-01) |

**Phase 5 LGPD Compliance Target:** ✅ **Arts. 7, 9, 18 satisfied**

---

## Resource Allocation

**Streams assigned:**

- **Stream A (Backend):** 05-01, 05-02 (critical values) — 2 FTE × 6 days = 12 person-days
- **Stream C (IA/ML):** 05-03, 05-04 (IA OCR + versioning) — 1.5 FTE × 9 days = 13.5 person-days
- **QA/DevOps:** Shared with Phase 4 (Cloud Logs, monitoring, E2E) — 0.5 FTE × 15 days = 7.5 person-days

**Total effort:** ~4 FTE × 2.5 weeks = **10 person-weeks**  
**Budget:** ~$40K-50K (outsourced IA specialist, if needed)

---

## Risk Summary

| Risk                                  | Probability   | Impact          | Mitigation                                  | Owner    |
| ------------------------------------- | ------------- | --------------- | ------------------------------------------- | -------- |
| SMS rate limit exceeded (Twilio)      | Low (2/10)    | Medium (5/10)   | Account limit +100/min, batching            | Stream A |
| OCR accuracy <92%                     | Medium (4/10) | High (7/10)     | Validate on 100 samples, golden data (v1.5) | Stream C |
| Gemini API cost overruns              | Low (2/10)    | Medium (5/10)   | Rate limiting + monitoring (Task 05-06)     | Stream C |
| Cross-lab data leak (critical values) | Low (2/10)    | Critical (9/10) | Rules validation, labId checks, code review | Stream A |
| E2E test flakiness                    | Medium (3/10) | Low (3/10)      | Retries, local mocks, run 3x                | QA       |
| Phases 6–9 schedule compression       | Medium (3/10) | Medium (5/10)   | Weekly checkpoints, cut scope if needed     | CTO      |

**Overall Phase 5 risk score:** **2.5/10 (LOW)**  
**Highest risk:** OCR accuracy + Gemini cost (both mitigated by monitoring + golden dataset)

---

## Success Criteria (Phase-level)

### Functional Completeness

- [ ] Critical detection engine live + detecting values correctly
- [ ] SMS + Email sent to clinicians <5 min from critical flag
- [ ] OCR parsing strips with ≥92% accuracy
- [ ] A/B testing framework operational (daily metrics aggregation)
- [ ] Golden sample annotation UI functional (expert validation)
- [ ] State machine transitions enforced (FLAGGED → ALERTED → RESOLVED)

### Performance & UX

- [ ] Escalation SLA tracking <5 min average (RDC 978 target)
- [ ] OCR parsing <10s per image
- [ ] Admin UI loads threshold/annotation screens <500ms
- [ ] Frontend strip upload <5s (image + progress)
- [ ] A/B test daily aggregation <5 min (nightly job)

### Compliance & Audit

- [ ] RDC 978 Arts. 99, 115, 167, 5.3 satisfied (auditor sign-off)
- [ ] DICQ 4.6.3 critical workflow documented + state machine
- [ ] DICQ 4.7 training dataset versioning + immutability
- [ ] LGPD Arts. 7, 9, 18 verified (privacy masking, audit trail)
- [ ] All escalations + model changes logged + signed (assinatura)
- [ ] Zero cross-lab data leaks (Rules verified)

### Testing & Deployment

- [ ] 50+ unit tests all green (05-01: 25, 05-02: 20, 05-03: 18, 05-04: 15)
- [ ] 5+ integration tests (critical flow, A/B test, OCR reconcile) all green
- [ ] 5+ E2E tests (real images, real Twilio mock, real Firestore) all green
- [ ] Cloud Logs 24h clean (0 ERROR/CRITICAL, benign WARNINGs only)
- [ ] Readiness checklist approved (CTO, QA, Auditor, Ops)
- [ ] Operations runbook complete + team briefed

### Quality & Accuracy

- [ ] OCR accuracy ≥92% on 100-sample validation set
- [ ] SLA on-time delivery ≥95% (RDC 978 Art. 99)
- [ ] Critical value false negative rate <1% (sensitivity >99%)
- [ ] A/B test statistical significance determined (control vs treatment winner)
- [ ] Confidence threshold tuning reduces review rate to <20% (auto-accept >80%)

---

## Timeline (Recommended Execution)

### Week 6 (Kickoff, 2026-06-09)

- **Mon–Tue (05-01 Wave 1):** Detection engine + threshold CRUD
- **Wed–Fri (05-01 Wave 2):** Admin UI + state machine tests

### Week 6–7 (Parallel Execution)

- **Mon–Wed (05-02 Wave 1):** Escalation callable + SMS/Email integration
- **Thu–Fri (05-02 Wave 2):** Retry queue + SLA tracking + audit trail

**Parallel:**

- **Mon–Fri (05-03 Wave 1):** Gemini integration + strip upload + reconciliation
- **Mon–Fri (05-04 Wave 1):** Training versioning + A/B framework

### Week 7 (Stabilization)

- **Mon–Tue (05-03 Wave 2):** Frontend UI + E2E tests
- **Wed–Fri (05-04 Wave 2):** Admin annotation UI + confidence tuning

### Week 7–8 (Testing & Deployment)

- **Mon–Tue:** Cloud Logs setup + smoke tests (all 4 tasks)
- **Wed–Thu:** Readiness checklist + ops briefing
- **Fri:** Deploy (Rules → Functions → Hosting)

### Week 8 (Post-Deploy Monitoring)

- **Mon–Fri:** Cloud Logs 24h tail, fix P0 issues, stabilize
- **Friday:** Phase 5 sign-off, Phase 6 unblock

**Estimated completion:** 2026-06-30 (4 weeks from Phase 4 stabilization)

---

## Handoff to Phase 6

**Phase 6 prerequisites (all satisfied by Phase 5):**

- ✅ Critical value escalation infrastructure (05-01, 05-02)
- ✅ Multi-channel notification (SMS, Email, Portal)
- ✅ SLA tracking + monitoring
- ✅ Cloud Logs monitoring active + alerting configured
- ✅ IA OCR foundation (strips, training data, versioning)
- ✅ Firestore schema + Rules extended

**Phase 6 scope (Feedback Portal + Trending):**

- Patient portal satisfaction survey + NPS feedback
- RCA (Root Cause Analysis) workflow for complaints
- Trending dashboard (complaints over time, categories)
- Link complaints to critical escalations (optional)

**Phase 6 kickoff:** 1 week post-Phase 5 stabilization (2026-07-07 TBD), conditional on <5% error rate in Phase 5 production.

---

## Compliance Artifacts Produced

1. **CRITICAL_VALUES_ARCHITECTURE.md** — state machine, threshold schema, detection logic
2. **CRITICAL_VALUES_ESCALATION.md** — notification strategy, retry policy, SLA guarantees
3. **CRITICAL_VALUES_AUDIT_TRAIL.md** — logging strategy, immutability, RDC 978 Art. 5.3
4. **GEMINI_OCR_INTEGRATION.md** — API integration, prompt engineering, error handling
5. **STRIP_PARSING_VALIDATION.md** — accuracy targets, reconciliation logic, test methodology
6. **TRAINING_DATASET_VERSIONING.md** — version lifecycle, golden samples, metrics
7. **AB_TEST_FRAMEWORK.md** — experiment design, daily aggregation, winner determination
8. **CONFIDENCE_THRESHOLD_TUNING.md** — per-analyte thresholds, optimization algorithm
9. **Phase 5 RDC Mapping.md** — Task breakdown ↔ RDC 978/DICQ articles
10. **Phase 5 Operations Guide.md** — runbook for alert response, manual operations

---

## Sign-off & Approval Gates

**Planning Sign-off (this document):**

- ✅ Scope finalized (4 comprehensive PLAN.md files)
- ✅ Dependencies verified (Phase 3 + 4 prerequisites satisfied)
- ✅ Compliance mapping complete (RDC 978 + DICQ + LGPD)
- ✅ Resource allocation confirmed (4 FTE × 2.5 weeks)

**Pre-Execution Gates (before 2026-06-09):**

- [ ] CTO scope + architecture review
- [ ] Auditor liaison compliance sign-off
- [ ] Tech Lead resource commitment + timeline approval
- [ ] Gemini API quota provisioned + cost monitoring configured
- [ ] Twilio account setup + rate limit verified

**Execution Gates (per task):**

- [ ] 05-01 code review (state machine, Rules)
- [ ] 05-02 code review (escalation logic, retry, SLA)
- [ ] 05-03 code review (Gemini integration, OCR accuracy)
- [ ] 05-04 code review (versioning, A/B framework)

**Post-Deploy Gates:**

- [ ] Cloud Logs 24h clean (0 errors)
- [ ] Smoke test execution complete
- [ ] Phase 5 RDC audit (auditor sign-off)
- [ ] Operations team briefed + runbook validated

---

## Files & Deliverables

**Planning Documents:**

- ✅ `05-01-PLAN.md` — Critical Values Detection (3 days, 6 sections, 25+ tests)
- ✅ `05-02-PLAN.md` — Critical Values Escalation (3 days, 7 sections, 20+ tests)
- ✅ `05-03-PLAN.md` — IA OCR Parsing (5 days, 6 sections, 18+ tests)
- ✅ `05-04-PLAN.md` — IA Training Dataset (4 days, 6 sections, 15+ tests)
- ✅ `PHASE_5_OVERVIEW.md` — This document (comprehensive phase vision)

**Code Deliverables (on completion):**

- 8+ new Cloud Functions (callables + triggers)
- 5+ new Firestore collections + Rules
- 12+ new frontend components
- 80+ unit tests
- 5+ integration/E2E tests
- ~5,000 LOC (functions + frontend + tests)

---

## Related Documentation

- **Phase 4 OVERVIEW:** `.planning/phases/04-portal-notivisa/PHASE_4_OVERVIEW.md`
- **Phase 3 OVERVIEW:** `.planning/phases/03-schema-extensions/` (schema + Rules)
- **v1.4 Roadmap:** `.planning/ROADMAP.md` (Wave context, critical path)
- **v1.4 Requirements:** `docs/v1.4-REQUIREMENTS.md` (REQ-405, REQ-406, REQ-407)
- **RDC 978 Spec:** `~/.claude/CLAUDE.md` + Obsidian `HC_Quality_RDC_978_2025_Resumo.md`
- **DICQ 8ª Edição:** Obsidian `HC_Quality_Compliance_DICQ.md` (blocks A–J mapping)

---

## Key Decisions Locked

**CTO decisions (2026-05-07):**

1. ✅ **Critical escalation SLA:** <5 min from flag to alert (RDC 978 Art. 99 target)
2. ✅ **Notification channels:** SMS + Email (SMS preferred for critical, email for ops trail)
3. ✅ **Gemini 2.5 Flash only:** No custom LLM in v1.4 (defer to v1.5 after 500+ samples)
4. ✅ **A/B testing mandatory:** Before promoting treatment version to production
5. ✅ **Golden sample annotation:** Expert-validated for DICQ 4.7 compliance
6. ✅ **Confidence threshold tuning:** Per-analyte (not global) to handle equipment variance

---

## Version History

| Version | Date       | Changes                                                                       |
| ------- | ---------- | ----------------------------------------------------------------------------- |
| 1.0     | 2026-05-07 | Initial planning, 4 comprehensive PLAN.md files created (05-01 through 05-04) |

---

**Created:** 2026-05-07 21:30 UTC  
**Status:** ✅ **Planning complete, ready for execution kickoff on 2026-06-09**  
**Next step:** CTO approval gate → execute Phase 5 per plan schedule  
**Expected completion:** 2026-06-30 (4 weeks)  
**Compliance audit:** 2026-08-31 (external auditor, v1.4 final assessment)
