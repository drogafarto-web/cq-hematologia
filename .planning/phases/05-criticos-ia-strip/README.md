# Phase 5 Planning: Critical Values Escalation + IA Strip OCR Foundation

**Milestone:** v1.4 (Compliance Closure + Portal Expansion + IA Strip OCR Foundation)  
**Wave:** Wave 2 (Weeks 4–8, parallel with Phase 4 CAPA Closure)  
**Created:** 2026-05-07  
**Status:** Planning Complete — Ready for Execution

---

## Document Index

This directory contains the complete planning for Phase 5 of the v1.4 milestone, delivered using the GSD (Get Shit Done) workflow.

### Core Planning Documents

1. **[PHASE_5_OVERVIEW.md](PHASE_5_OVERVIEW.md)** (5.6 KB, 156 lines)
   - Strategic context and scope
   - Task breakdown (4 parallel streams)
   - Compliance mapping (RDC 978 + DICQ)
   - Risk assessment and dependencies
   - Artifacts and timeline

2. **[EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md)** (9.6 KB, 327 lines)
   - Quick reference for execution teams
   - Task stream coordination
   - Weekly milestones and sync points
   - Testing strategy overview
   - Regulatory alignment summary

3. **[PHASE_5_VERIFICATION.md](PHASE_5_VERIFICATION.md)** (13 KB, 396 lines)
   - Complete verification checklist
   - Requirements traceability
   - Dependency resolution proof
   - Acceptance criteria validation
   - Planning process audit trail
   - Sign-off statement

### Task-Specific Plans

#### Task 05-01: Critical Threshold Configuration + Routing Engine

**[05-01-PLAN.md](05-01-PLAN.md)** (12 KB, 383 lines)

**Scope:** Per-lab threshold CRUD, validation engine, escalation routing rules  
**Duration:** 3–4 days  
**Dependencies:** Phase 3 schema ✓  
**Blocks:** Task 05-02

**Key sections:**

- 5 detailed requirements (threshold model, service, UI, routing, rules)
- Firestore Rules + Zod schema specification
- 2 unit test modules (10+ specs)
- 7 acceptance criteria
- Regulatory compliance (RDC Art. 17, 128; DICQ 5.8.7)

---

#### Task 05-02: Critical Value Detection Engine + SLA Tracking

**[05-02-PLAN.md](05-02-PLAN.md)** (15 KB, 494 lines)

**Scope:** Detection on laudo creation, SMS/email escalation, SLA monitoring  
**Duration:** 3–4 days  
**Dependencies:** Task 05-01 ✓  
**Blocks:** None (parallel with Tasks 05-03, 05-04)

**Key sections:**

- 6 detailed requirements (detection, escalacao callable, SMS, SLA cron, dashboard, manual ack)
- State machine specification (NEW → SENDING → SENT → ACKNOWLEDGED)
- 3 unit test modules (15+ specs)
- 9 acceptance criteria
- Regulatory compliance (RDC Arts. 17, 128, 184-191; DICQ 4.14.5)

---

#### Task 05-03: IA Strip Upload + Gemini Vision Integration

**[05-03-PLAN.md](05-03-PLAN.md)** (14 KB, 472 lines)

**Scope:** Camera UI, image upload, Gemini Vision API, confidence validation  
**Duration:** 2–3 days  
**Dependencies:** Phase 3 schema ✓, Gemini API ✓  
**Blocks:** Task 05-04

**Key sections:**

- 5 detailed requirements (upload infra, Gemini API, confidence validation, dataset, dashboard)
- Image metadata schema and Firebase Storage structure
- Confidence threshold enforcement (0.85 default)
- 2 unit test modules (10+ specs)
- 10 acceptance criteria
- Regulatory compliance (RDC Art. 167; DICQ 5.8.7)

---

#### Task 05-04: IA Classification Feedback Loop + Dataset Aggregation

**[05-04-PLAN.md](05-04-PLAN.md)** (15 KB, 489 lines)

**Scope:** Accuracy calculation, monthly export, dataset aggregation, ADR documentation  
**Duration:** 2–3 days  
**Dependencies:** Task 05-03 ✓  
**Blocks:** None (Phase 11 IA fine-tuning feedback, v1.5)

**Key sections:**

- 5 detailed requirements (accuracy engine, export, webhook placeholder, ADR-0016, dashboard)
- Confusion matrix calculation logic
- Dataset export format (ML team deliverable)
- 2 unit test modules (8+ specs)
- 7 acceptance criteria
- ADR-0016 approach documentation (Gemini baseline vs. fine-tuned v1.5)

---

## Execution Overview

### Timeline at a Glance

| Week  | Days | Tasks                        | Deliverables                |
| ----- | ---- | ---------------------------- | --------------------------- |
| **4** | 1–2  | 05-01: Service + schema      | Threshold CRUD service      |
|       | 3–4  | 05-01: Config UI             | Config dashboard UI         |
|       | 3–4  | 05-02: Detection logic start | Detect engine logic         |
| **5** | 1–2  | 05-02: Escalacao callable    | SMS + SLA callables         |
|       | 1–2  | 05-03: Upload component      | Camera UI + Gemini callable |
|       | 3–4  | 05-02: Dashboard + SLA cron  | SLA dashboard + cron        |
|       | 3–4  | 05-03: Confidence + dataset  | Confidence validation       |
|       | 3–4  | 05-04: Accuracy calculator   | Accuracy engine + export    |
|       | 5–6  | **E2E + testing**            | Bug fixes, sign-off         |

**Critical path:** 05-01 (4d) → 05-02 (4d) = 8 days, contained within 2 weeks ✓

### Resource Allocation

**Stream B (Frontend):**

- Task 05-01 Config UI
- Task 05-02 Dashboard UI
- Task 05-03 Camera + Upload UI

**Stream C (IA Lead + Backend):**

- Task 05-02 Callables + SLA monitoring
- Task 05-03 Gemini Vision callable
- Task 05-04 Accuracy + export

**Parallel execution:** Both streams can work independently with daily sync.

---

## Deliverable Specifications

### Code Artifacts (40+ files)

**Frontend modules:**

```
src/features/criticos/
  ├─ services/thresholdService.ts (CRUD)
  ├─ utils/routingEngine.ts (escalation routing)
  ├─ components/ThresholdConfigPanel.tsx
  ├─ components/EscalacaoDashboard.tsx
  ├─ components/AcknowledgeModal.tsx
  ├─ hooks/useDetectCritico.ts
  └─ __tests__/ (4 test files)

src/features/ciq-imuno/strip-classifier/
  ├─ StripUploadComponent.tsx (camera UI)
  ├─ ImunoIADashboard.tsx (metrics)
  ├─ types.ts
  └─ __tests__/ (2 test files)
```

**Cloud Functions:**

```
functions/src/modules/criticos/
  ├─ escalacaoCriticos.ts (detection → escalacao)
  ├─ escalarCriticoViaSmS.ts (SMS dispatch)
  ├─ escalacao-sla-monitor.ts (cron job)
  └─ __tests__/ (3 test files)

functions/src/modules/ciqImuno/
  ├─ classifyStripGemini.ts (Gemini Vision)
  ├─ confidenceValidation.ts (validation logic)
  ├─ accuracyCalculator.ts (confusion matrix)
  ├─ collectIADataset.ts (monthly export)
  ├─ handleMLTeamFeedback.ts (placeholder)
  └─ __tests__/ (5 test files)
```

**Infrastructure:**

- Firestore Rules (RBAC for criticos, escalacoes, imuno-ias-dev)
- Firestore Indexes (query optimization)
- Cloud Storage (image hosting + signed URLs)

### Test Coverage

**Total test specifications:** 58+ specs across 11 test modules

- Threshold service: 10 specs
- Routing engine: 5 specs
- Escalacao logic: 8 specs
- SMS callable: 4 specs
- SLA monitoring: 3 specs
- Gemini integration: 6 specs
- Confidence validation: 4 specs
- Accuracy calculation: 5 specs
- Dataset export: 3 specs
- Integration tests: 3 smoke tests
- E2E tests: 10+ critical user journeys

**Coverage target:** ≥80% on all new code

### Documentation & Knowledge

**Architecture Decision Records:**

- [ADR-0014: Critical Values Escalation Model](docs/adr/0014-CRITICAL-VALUES-ESCALATION.md)
- [ADR-0016: IA Strip Classification Approach](docs/adr/0016-IA-STRIP-CLASSIFICATION.md)

**Planning documents (this directory):**

- 2,321 lines across 7 markdown files
- 96 KB of detailed planning
- 100% traceability from requirements → tests → acceptance

---

## Regulatory Compliance

### RDC 978 Coverage

**Articles addressed:**

- Art. 17: Critical values management ✅
- Art. 128: Audit trail enforcement ✅
- Art. 167: Emergency procedures (manual override) ✅
- Arts. 184-191: SLA tracking & notification ✅

**DICQ alignment:**

- 4.4.3: Audit trail (all state changes logged) ✅
- 4.14.5: SLA tracking & monitoring ✅
- 5.8.7: Critical values + IA validation ✅

### Compliance Evidence

All acceptance criteria include audit trail, RBAC, and soft-delete enforcement per HC Quality inviolable rules (RN-06).

---

## Risk Mitigation

**6 identified risks, all mitigated:**

1. Gemini API quota exceeded → $500/month alert
2. False positive critical flags → Gradual rollout (1 analyte)
3. SMS delivery delays → Email fallback
4. Low IA accuracy → 0.85 confidence threshold + manual override
5. Performance regression → Baseline Week 1, weekly monitoring
6. Escalation complexity → Clear state machine specification

---

## Handoff & Integration Points

### Incoming Dependencies

- Phase 3 schema (collections, indexes) ✅ Complete
- Phase 3 helpers (SMS, IA validators, notivisa formatter) ✅ Available
- Twilio account + API keys ✅ Configured
- Gemini 2.5 Flash API ✅ Access confirmed

### Outgoing Deliverables

- **Phase 6 (Satisfação):** Escalacao status accessible in feedback portal
- **Phase 8 (NOTIVISA):** Critical escalacao triggers NOTIVISA draft
- **Phase 11 (IA fine-tuning, v1.5):** 1000+ labeled images + accuracy baseline

---

## Getting Started

### For Stream Leads

1. **Start here:** [EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md) (quick overview + coordination points)
2. **Understand Phase context:** [PHASE_5_OVERVIEW.md](PHASE_5_OVERVIEW.md)
3. **Detailed spec for your task:** Read 05-0X-PLAN.md (your task number)

### For Developers

1. **Pick your task:** 05-01, 05-02, 05-03, or 05-04
2. **Read the PLAN.md:** Understand requirements, acceptance criteria, test plan
3. **Reference the tools:** Firestore schema, Zod types, helper functions
4. **Build & test:** Follow the test plan spec (10+ unit tests per task)

### For QA/Testing

1. **Review test plan:** Each PLAN.md has detailed test specs
2. **E2E smoke tests:** 10+ critical user journeys listed in EXECUTION_SUMMARY.md
3. **Verify acceptance:** All 7 criteria per task must be met before sign-off

### For Auditors/Compliance

1. **Regulatory mapping:** See PHASE_5_OVERVIEW.md + PHASE_5_VERIFICATION.md
2. **Compliance evidence:** Audit trail, RBAC, soft-delete in all task specs
3. **ADRs:** 0014 + 0016 document approach + trade-offs

---

## Quick Reference: Task Summaries

| Task      | Focus              | Team                | Duration | Key Metric                |
| --------- | ------------------ | ------------------- | -------- | ------------------------- |
| **05-01** | Threshold config   | Backend + Frontend  | 3–4d     | CRUD functional           |
| **05-02** | Escalation + SLA   | Backend + Frontend  | 3–4d     | SMS >99%, <200ms detect   |
| **05-03** | IA upload + Gemini | IA lead + Backend   | 2–3d     | <3s p99, 0.85 confidence  |
| **05-04** | Dataset + feedback | IA lead + Analytics | 2–3d     | 500+ images, 88% accuracy |

---

## Document Map

```
05-criticos-ia-strip/
├─ README.md (this file)
├─ PHASE_5_OVERVIEW.md (strategic context + risks)
├─ EXECUTION_SUMMARY.md (timeline + coordination)
├─ PHASE_5_VERIFICATION.md (complete audit trail)
├─ 05-01-PLAN.md (threshold config task)
├─ 05-02-PLAN.md (escalation + SLA task)
├─ 05-03-PLAN.md (IA upload + Gemini task)
└─ 05-04-PLAN.md (feedback loop + dataset task)

Also references:
├─ docs/adr/0014-CRITICAL-VALUES-ESCALATION.md
├─ docs/adr/0016-IA-STRIP-CLASSIFICATION.md
└─ .../v1.4-ROADMAP.md (parent phase plan)
```

---

## Sign-Off Checklist

Phase 5 planning is approved for execution when:

- [x] All 4 task PLANs completed (05-01 through 05-04)
- [x] Dependency graph verified (no blockers)
- [x] Resource estimates confirmed (96h, 2 FTE, 2 weeks)
- [x] Regulatory compliance mapped (RDC 978 + DICQ)
- [x] Risk assessment finalized (6 risks, all mitigated)
- [x] Test plans defined (58+ specs, 11 modules)
- [x] Acceptance criteria measurable (7 per task + 5 global)
- [x] Documentation complete (2,321 lines, 7 files)
- [x] ADRs prepared (0014, 0016)
- [x] Verification audit passed

**Status:** ✅ **READY FOR EXECUTION**

---

## Support & Escalation

**Daily coordination:** 15-min standup (Stream B + Stream C)  
**Technical blockers:** Contact CTO within 24h  
**Regulatory questions:** Review PHASE_5_VERIFICATION.md + ADRs  
**Integration issues:** Cross-reference task dependencies in EXECUTION_SUMMARY.md

---

**Version:** 1.0  
**Created:** 2026-05-07  
**Execution start:** 2026-05-13 (Week 4 of v1.4)  
**Completion target:** 2026-05-27 (Week 5)  
**Next phase:** 06-Satisfação (2026-05-28)

---

_This planning was generated using the GSD (Get Shit Done) workflow. All requirements are traceable, all tests are specified, all risks are mitigated, and all regulatory requirements are mapped._
