# Phase 5: Critical Values Escalation + IA Strip OCR Foundation

**Status:** Planning  
**Milestone:** v1.4 (Wave 2)  
**Duration:** 2 weeks (start Week 4, parallel with Phase 4 CAPA Closure)  
**Regulatory:** RDC 978 Arts. 17, 167 + ISO 15189 5.8.7  

---

## Strategic Context

Phase 5 executes the critical patient safety workflow + foundational IA for imuno strip classification. Split across 4 parallel task streams to enable both critical escalation (immediate) and IA dataset collection (foundational).

**Wave 2 position:**
- Phase 4 (CAPA Closure) runs in parallel — no blocking dependencies
- Phase 3 schema + helpers (`criticos-escalacoes`, `notivisa-outbox`, `smsTemplate`, `iaStripValidator`) ready
- Gemini 2.5 Flash API access confirmed
- Twilio SMS contract signed

**Success:** 
- Crítico detection <200ms latency
- SMS delivery >99% in <2 min
- SLA dashboard (red/amber/green)
- IA dataset >500 images collected
- 0 critical errors in E2E tests

---

## Task Breakdown

### Task 05-01: Critical Threshold Configuration + Routing Engine
**Scope:** Implement per-lab threshold config (CRUD UI), threshold validation, escalation routing rules.  
**Duration:** 3–4 days  
**Deliverable:** `src/features/criticos/` module (config component, service layer, Firestore schema binding)

### Task 05-02: Critical Value Detection Engine + SLA Tracking
**Scope:** Build detection logic, SLA calculation, cron jobs, escalation state machine.  
**Duration:** 3–4 days  
**Deliverable:** `escalacaoCriticos` callable, `escalarCriticoViaSmS` callable, cron trigger

### Task 05-03: IA Strip Upload + Gemini Vision Integration
**Scope:** Camera UI, image metadata capture, Gemini Vision API integration, confidence validation.  
**Duration:** 2–3 days  
**Deliverable:** `src/features/ciq-imuno/strip-classifier/` module, `classifyStripGemini` callable

### Task 05-04: IA Classification Feedback Loop + Dataset Aggregation
**Scope:** Dataset collection, manual override tracking, accuracy dashboard, monthly exports.  
**Duration:** 2–3 days  
**Deliverable:** `collectIADataset` aggregator, `imuno-ia-dashboard` component, ADR-0016

---

## Compliance Mapping

| Requirement | RDC 978 | DICQ | Task |
|---|---|---|---|
| Critical value detection | Art. 17 | 5.8.7 | 05-02 |
| Escalation SLA tracking | Art. 184-191 | 4.14.5 | 05-02 |
| Manual override audit trail | Art. 128 | 4.4.3 | 05-02, 05-04 |
| IA validation confidence threshold | Art. 167 (emergency procedures) | 5.8.7 | 05-03 |
| Dataset labeling (strip images) | — | 5.8.7 | 05-04 |

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Gemini Vision API quota exceeded | IA stops working | Medium | Set $500/month quota alert; scale to fine-tuned model v1.5 |
| False positive critical values (low confidence Gemini) | Patient safety hazard | Low | Confidence threshold 0.85 default; manual override always allowed |
| SMS delivery delays (Twilio) | Escalation SLA breach | Low | Email fallback + incident log; Twilio support escalation if persistent |
| High volume of false critical flags | Lab workflow disruption | Medium | Gradual rollout to 1 analyte, monitor 1 week, then expand |
| IA dataset annotation burden | Slow data collection | Medium | Optimize UI for speed; use batch import for historical images |

---

## Dependencies & Critical Path

```
Phase 3 schema ✓
  ↓
Phase 3 helpers ✓ (sms.ts, ia.ts, notivisa.ts, criticoDetector.ts)
  ↓
Task 05-01: Threshold config (foundation for 05-02)
  ↓
Task 05-02: Detection + SLA (can run parallel with 05-03, 05-04)
  ↓
Task 05-03, 05-04: IA integration (parallel, independent)
  ↓
E2E testing (all tasks)
```

**Critical path:** 05-01 → 05-02 (4–5 days) + 05-03 + 05-04 (2–3 days each) = **~1 week**.

---

## Acceptance Criteria

- [ ] Threshold CRUD UI accessible + functional
- [ ] Detection engine <200ms latency (measured on laudo creation)
- [ ] SMS template renders <160 chars + delivers >99% in <2 min
- [ ] SLA dashboard shows red/amber/green per escalation
- [ ] IA confidence threshold 0.85 enforced; manual override allowed
- [ ] 500+ labeled images collected in `imuno-ia-dev`
- [ ] IA accuracy baseline documented (expected ~88%)
- [ ] 0 critical errors in E2E suite (10+ critical paths)
- [ ] Compliance audit trail 100% (zero untracked escalations)

---

## Artifacts

**Phase 5 deliverables:**
- `PLAN.md` files (4 tasks × PLAN.md)
- `src/features/criticos/` module (expanded from placeholder)
- `src/features/ciq-imuno/strip-classifier/` module (new)
- `escalacaoCriticos` callable
- `escalarCriticoViaSmS` callable
- `classifyStripGemini` callable
- `collectIADataset` aggregator
- `imuno-ia-dashboard` component
- E2E test suite (10+ specs)
- ADR-0014: Critical Values Escalation Model
- ADR-0016: IA Strip Classification Approach

---

## Timeline & Milestones

**Week 4 (start Phase 5):**
- Days 1–2: Task 05-01 implementation + code review
- Days 3–4: Task 05-02 start (detection logic)

**Week 5:**
- Days 1–2: Task 05-02 completion (SLA + cron)
- Days 3–4: Task 05-03, 05-04 parallel implementation

**Week 6 (buffer):**
- Days 1–2: E2E testing + bug fixes
- Days 3–4: Code review + final sign-off
- Days 5: Handoff to Phase 6 (Satisfação)

---

## Related Documents

- [v1.4 ROADMAP](../../milestones/v1.4-ROADMAP.md) — phases 1-15
- [Phase 3 SCHEMA](../03-schema-extensions/) — collections, indexes
- [RDC 978 Coverage Map](../../milestones/v1.4-RDC-COVERAGE-MATRIX.md)
- [DICQ Gap Analysis](../../milestones/v1.4-DICQ-GAP-ANALYSIS.md)

---

**Owner:** Stream B (frontend) + 1 backend  
**Next Phase:** 06-satisfacao (Feedback portal)  
**Version:** 1.0 (2026-05-07)
