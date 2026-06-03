---
wave: '2'
phases: [4, 5, 6, 7]
milestone: 'v1.4'
status: 'PRE-KICKOFF'
coordination_date: '2026-05-07'
kickoff_date: '2026-05-20'
go_nogo_assessment: 'PENDING'
---

# Wave 2 Coordination Framework — Phases 4-7 (v1.4 Operations)

**Coordinator Role:** Wave 2 Lead  
**Period:** 2026-05-20 → 2026-07-28 (9 weeks)  
**Phases:** 4 (Portal + NOTIVISA), 5 (Critical Escalation + IA), 6 (CAPA Closure), 7 (Export + Feedback)  
**Status:** ✅ **Pre-kickoff readiness verified** | ⏳ **Awaiting 2026-05-20 execution start**

---

## Executive Summary

This document establishes **coordination, monitoring, and sign-off protocols** for Wave 2 (Phases 4-7 concurrent execution). Wave 2 bridges compliance closure (Phase 8 CAPA) with feature expansion and auditor alignment.

**Key objectives:**

1. ✅ **Monitor status** of 4 parallel phase executors
2. ✅ **Provision test data** (100+ mock users, audit trails, critical values) per v1.4_TEST_DATA_PROVISIONING.md
3. ✅ **Enforce Go/No-Go gates** for each phase (compliance, testing, performance)
4. ✅ **Create sign-off checklist** (smoke tests, coverage, compliance)
5. ✅ **Coordinate Wave 3 handoff** (document blockers, test data state)

**Success metric:** All 4 phases deploy by 2026-07-28 with zero regressions + auditor pre-alignment complete.

---

## Pre-Kickoff Status (2026-05-07)

### Current State

| Component                | Status      | Evidence                                                                |
| ------------------------ | ----------- | ----------------------------------------------------------------------- |
| **Phase 3 (Foundation)** | ✅ COMPLETE | Deployed 2026-05-07 — 5 collections + 78 functions + rules              |
| **Phase 0-3 Planning**   | ✅ COMPLETE | 9 phase plans created, 8,500+ lines                                     |
| **Phase 4 Kickoff Docs** | ✅ READY    | 4 primary docs created, 1,520+ lines, signed off                        |
| **Phase 5-7 Docs**       | ✅ READY    | Overviews + detailed plans available                                    |
| **Test Data Fixtures**   | ⏳ PENDING  | v1.4_TEST_DATA_PROVISIONING.md complete, fixtures awaiting provisioning |
| **Infrastructure Setup** | ⏳ PENDING  | SMTP + Cloud Tasks + NOTIVISA sandbox (pre-kickoff timeline)            |
| **Team Assignments**     | ✅ READY    | 3.5 FTE per phase, no PTO conflicts                                     |
| **Compliance Roadmap**   | ✅ ALIGNED  | DICQ 78.5% → target 88% by Phase 9                                      |

### Pre-Kickoff Checklist (Due 2026-05-19 EOB)

**Critical path items (blocking execution):**

- [ ] **SMTP Provisioning** (DevOps) — Email delivery for portal auth + critical escalations
  - Task: Set credentials in `HCQ_SMTP_*` secrets
  - Effort: 1–2h
  - Owner: DevOps Lead
  - Deadline: 2026-05-19 EOB

- [ ] **Cloud Tasks Queue Creation** (DevOps) — Async job queue for NOTIVISA + email backfill
  - Task: Create queue `hmatologia2-operations` in southamerica-east1
  - Effort: 15 min
  - Owner: DevOps Lead
  - Deadline: 2026-05-19 EOB

- [ ] **Test Data Provisioning** (QA + Backend) — Fixture files + staging lab setup
  - Task: Load fixtures via `test/utils/load-fixtures.mjs --phase 4 --all`
  - Effort: 2–4h (initial load) + nightly resets
  - Owner: QA Lead
  - Deadline: 2026-05-19 EOB

**Soft items (fallback behaviors if delayed):**

- [ ] Email-link auth enable (optional, Phase 4 can use Resend as fallback)
- [ ] NOTIVISA sandbox keys (deferred to Phase 8, Phase 4 uses mock queue)
- [ ] Twilio provisioning (optional, SMS can use Firestore queue fallback)

---

## Phase 4 Status & Gates

### Overview

**Phase 4 — Patient Portal + NOTIVISA Integration**  
**Duration:** 2.5 weeks (2026-05-20 → 2026-06-02)  
**Effort:** 3.5 FTE  
**Risk:** 3.5/10 (LOW)

### Executor Assignment

| Task                                 | Owner         | Role              | FTE |
| ------------------------------------ | ------------- | ----------------- | --- |
| **04-01** Portal auth + laudo access | Stream B Lead | Frontend          | 1.0 |
| **04-02** Portal UI components       | Stream B Lead | Design + Frontend | 0.5 |
| **04-03** NOTIVISA queue processor   | Stream A Lead | Backend           | 1.5 |
| **04-04** E2E testing + Cloud Logs   | Stream D Lead | QA + DevOps       | 0.5 |

### Pre-Execution Gates (Must Pass by 2026-05-20)

```
Gate 4-1: Infrastructure Ready
├─ [ ] SMTP credentials provisioned
├─ [ ] Cloud Tasks queue created
├─ [ ] Firestore rules v1.4 deployed
├─ [ ] Cloud Storage bucket verified
└─ Owner: DevOps Lead, Deadline: 2026-05-19 EOB

Gate 4-2: Test Data Ready
├─ [ ] Portal config fixture loaded (100+ test laudos)
├─ [ ] NOTIVISA queue mock data seeded
├─ [ ] 6 mock users (RT, operator, patient, admin) created
├─ [ ] Test lab lab-001-staging configured
└─ Owner: QA Lead, Deadline: 2026-05-19 EOB

Gate 4-3: Architecture Review
├─ [ ] PHASE_4_OVERVIEW.md reviewed (Tech Lead)
├─ [ ] Email-link auth design approved (CTO)
├─ [ ] NOTIVISA payload schema validated (Auditor)
├─ [ ] Multi-tenant isolation verified (Security)
└─ Owner: Tech Lead, Deadline: 2026-05-20 09:00 (kickoff meeting)

Gate 4-4: Team Ready
├─ [ ] All assigned engineers onboarded
├─ [ ] Dev environments configured (local + emulator)
├─ [ ] PHASE_4_QUICK_REFERENCE.md distributed
└─ Owner: Stream Leads, Deadline: 2026-05-20 09:00
```

### Phase 4 Success Criteria (Go/No-Go)

**Functional:**

- [ ] Patient portal accessible via email link + valid for 7 days
- [ ] PDF download works for all laudo types
- [ ] NOTIVISA queue auto-enqueues on laudo publish
- [ ] Sandbox API integration tested + no payload rejections

**Performance:**

- [ ] Portal LCP <2.0s, INP <200ms, CLS <0.05
- [ ] NOTIVISA processor completes <10s per batch (10 events)
- [ ] PDF generation <5s per laudo

**Compliance:**

- [ ] RDC 978 Arts. 6º §1, 167, 204 satisfied
- [ ] All patient reads logged with CPF hash in audit trail
- [ ] Firestore Rules enforce read isolation
- [ ] WCAG AA verified (Axe DevTools 0 violations)

**Testing:**

- [ ] 38+ unit tests passing (12 portal + 20 NOTIVISA + 6 integration)
- [ ] 6 critical E2E flows passing (staging)
- [ ] Cloud Logs 24h clean (0 ERROR/CRITICAL)

**Go/No-Go Decision:** CTO + Tech Lead (2026-06-02, pre-deploy)

---

## Phase 5 Status & Gates

### Overview

**Phase 5 — Critical Values + IA Strip Parsing**  
**Duration:** 3 weeks (2026-06-09 → 2026-06-30)  
**Effort:** 4 FTE  
**Risk:** 3/10 (LOW)  
**Dependency:** Phase 4 UI sign-off

### Executor Assignment

| Task                                      | Owner         | Role     | FTE |
| ----------------------------------------- | ------------- | -------- | --- |
| **05-01** Critical thresholds + SMS/email | Stream A Lead | Backend  | 1.5 |
| **05-02** Critical detection engine       | Stream A Lead | Backend  | 1.0 |
| **05-03** IA strip upload + Gemini Vision | Stream B Lead | Frontend | 1.0 |
| **05-04** IA feedback loop + versioning   | Stream A Lead | Backend  | 0.5 |

### Pre-Execution Gates (Must Pass by 2026-06-09)

```
Gate 5-1: Phase 4 Deployment Verified
├─ [ ] Phase 4 live in production (0 critical errors 24h post-deploy)
├─ [ ] Portal audit trail 100% coverage
└─ Owner: Stream D Lead, Deadline: 2026-06-09 09:00

Gate 5-2: Test Data Ready
├─ [ ] 10+ analytes with critical/warning thresholds defined
├─ [ ] 15 test runs with critical flags (HIGH/LOW severity)
├─ [ ] IA training dataset: 50 samples + golden samples loaded
├─ [ ] 10 test strip JPGs staged
└─ Owner: QA Lead, Deadline: 2026-06-09 09:00

Gate 5-3: SMS/Twilio Provisioned (Soft)
├─ [ ] Twilio account + auth token available
├─ [ ] SMS delivery verified with test messages
├─ └─ Fallback: Firestore queue if delayed
└─ Owner: DevOps Lead, Target: 2026-06-09 (best effort)

Gate 5-4: Architecture Review
├─ [ ] Gemini Vision integration reviewed (CTO)
├─ [ ] Critical threshold state machine validated
├─ [ ] SLA tracking design approved (Auditor)
└─ Owner: Tech Lead, Deadline: 2026-06-09 09:00
```

### Phase 5 Success Criteria (Go/No-Go)

**Functional:**

- [ ] Critical value triggers SMS/email within 2 min of result entry
- [ ] SLA dashboard updates in real-time
- [ ] IA strip upload + Gemini Vision OCR confidence >85%
- [ ] Model versioning (v1.0 baseline → v1.1 experiment) functional

**Performance:**

- [ ] Critical detection engine <500ms latency
- [ ] IA strip upload batch processing 100+ images/min
- [ ] SLA dashboard queries <2s

**Compliance:**

- [ ] RDC 978 Arts. 115-117 (critical escalation + SLA) satisfied
- [ ] DICQ 4.7 (IA training dataset) 100% audit trail
- [ ] LGPD Arts. 7, 9, 18 (escalation logs + PII) verified

**Testing:**

- [ ] 40+ unit tests passing (critical + IA)
- [ ] 8 critical E2E flows passing (escalation chains)
- [ ] Cloud Logs 24h clean

**Go/No-Go Decision:** CTO + Tech Lead (2026-06-30, pre-deploy)

---

## Phase 6 Status & Gates

### Overview

**Phase 6 — Liberación Completion + Críticos Polish**  
**Duration:** 2 weeks (2026-07-01 → 2026-07-14)  
**Effort:** 2 FTE  
**Risk:** 2.5/10 (VERY LOW)  
**Dependency:** Phase 4 + 5 deployment verified

### Key Deliverables

- PDF generation + QR validation (CloudFunction + puppeteer)
- Portal médico external access (SSO integration)
- 8 critical E2E flows (sign-off coverage)
- Lighthouse CI + performance budgets

### Pre-Execution Gates

```
Gate 6-1: Phase 5 Deployment Verified
├─ [ ] Phase 5 live + SLA tracking stable (0 critical errors 24h)
├─ [ ] IA strip processing 100% success rate
└─ Owner: Stream D Lead, Deadline: 2026-07-01 09:00

Gate 6-2: PDF Infrastructure Ready
├─ [ ] puppeteer installed in Functions runtime
├─ [ ] QR code library integrated
├─ [ ] Test PDFs generated + validated
└─ Owner: Stream A Lead, Deadline: 2026-07-01 09:00

Gate 6-3: Test Data Ready
├─ [ ] 50+ sample laudos for PDF export testing
└─ Owner: QA Lead, Deadline: 2026-07-01 09:00
```

### Phase 6 Success Criteria (Go/No-Go)

**Functional:**

- [ ] PDF generation <5s per laudo
- [ ] QR codes scannable + link to portal
- [ ] Portal médico accessible via email link (like patient portal)

**Performance:**

- [ ] Lighthouse score >90 desktop + mobile
- [ ] Web Vitals within targets (LCP <2.5s, INP <200ms, CLS <0.1)

**Testing:**

- [ ] 8 critical E2E flows passing
- [ ] PDF export quality verified (sample 100 laudos)
- [ ] Cloud Logs 24h clean

**Go/No-Go Decision:** CTO + Tech Lead (2026-07-14, pre-deploy)

---

## Phase 7 Status & Gates

### Overview

**Phase 7 — Export Wizard + Reclamações/Satisfação Polish + Portal Paciente**  
**Duration:** 3 weeks (2026-07-15 → 2026-07-28)  
**Effort:** 2.5 FTE  
**Risk:** 3/10 (LOW)  
**Dependency:** Phase 5 + 6 foundation + Portal paciente external UX

### Key Deliverables

- Export Wizard 4-step (format, filters, email, schedule)
- XLSX/PDF export with compression + batch scheduling
- Portal paciente external (feedback submission + tracking)
- Trending dashboard (satisfaction trends, 4.15 integration)
- LGPD consent + anonymization polish

### Pre-Execution Gates

```
Gate 7-1: Phase 6 Deployment Verified
├─ [ ] Phase 6 live + PDF export 100% success rate
└─ Owner: Stream D Lead, Deadline: 2026-07-15 09:00

Gate 7-2: Test Data Ready
├─ [ ] 5-10 test exports (XLSX, PDF, CSV) staged
├─ [ ] Mobile device profiles (iPhone, iPad, Android) configured
├─ [ ] 100+ feedback samples staged
└─ Owner: QA Lead, Deadline: 2026-07-15 09:00

Gate 7-3: Architecture Review
├─ [ ] XLSX CloudFunction + streaming reviewed
├─ [ ] Email delivery at scale (batch scheduling) validated
├─ [ ] Portal paciente external isolation verified (RBAC)
└─ Owner: Tech Lead, Deadline: 2026-07-15 09:00
```

### Phase 7 Success Criteria (Go/No-Go)

**Functional:**

- [ ] Export Wizard 4 steps complete (format → filters → email → schedule)
- [ ] XLSX export <30s for 1,000 results
- [ ] PDF batch export compression >50%
- [ ] Scheduled exports run on cron (weekly, monthly, custom)
- [ ] Portal paciente feedback submission + RT view working

**Performance:**

- [ ] Export wizard responsive on mobile (<2s transitions)
- [ ] XLSX generation streaming (no memory bloat)
- [ ] Email delivery batch <5s per 100 emails

**Compliance:**

- [ ] RDC 978 Arts. 167, 204 (export audit trail)
- [ ] DICQ 4.15 (feedback trending) 100% audit trail
- [ ] LGPD Arts. 5-7, 18 (consent + anonymization)

**Testing:**

- [ ] 35+ unit tests (export + feedback + scheduled jobs)
- [ ] 8 critical E2E flows (export + mobile + feedback)
- [ ] Mobile responsive verified on 3+ devices
- [ ] Cloud Logs 24h clean

**Go/No-Go Decision:** CTO + Tech Lead (2026-07-28, pre-deploy)

---

## Parallel Execution Timeline

```
2026-05-20 ──────────────────────────────────────────── 2026-07-28

Phase 4 (Portal + NOTIVISA)
├─ 2026-05-20 ─────────────────────────────────────── 2026-06-02
│  └─ Deploy ─────────────────────────────────────── 2026-06-02
│     └─ Cloud Logs 24h ───────────────────────────── 2026-06-03

Phase 5 (Critical + IA)          Phase 6 (Liberación)    Phase 7 (Export + Feedback)
├─ 2026-06-09 ─────────────────┤ 2026-07-01 ──────────┤ 2026-07-15 ─────────
│  └─ Deploy ────────────────── 2026-06-30          │  └─ Deploy ────────── 2026-07-28
│     └─ Cloud Logs 24h ──────── 2026-07-01          │     └─ Cloud Logs 24h ─ 2026-07-29

Phase 8 (CAPA Closure) — Parallel with Phases 5-7 [CRITICAL PATH]
├─ 2026-06-15 ─────────────────────────────────────────────── 2026-08-05 (Auditor deadline)
│  ├─ Eng-owned (F-01→F-04): 2026-06-15 ─────────────────── 2026-07-12
│  └─ CTO+Auditor (F-05→F-07): 2026-07-13 ─────────────────── 2026-08-05

Phase 11 (Auditor Alignment) — Weekly sync (ongoing)
├─ 2026-06-01 ───────────────────────────────────────────── 2026-08-05
│  └─ Mondays 10:00 BRT (architecture + CAPA progress)
```

**Critical path duration:** 14 weeks (May 20 → Aug 31)  
**Auditor ceremony deadline:** Aug 5 (3-week buffer)

---

## Test Data Provisioning Checklist

Per `v1.4_TEST_DATA_PROVISIONING.md`:

### Phase 4 Test Data (Due 2026-05-19)

- [ ] **Portal config** (`portal-configuracao/{labId}`)
  - Branding (logo, colors, theme)
  - Pages (landing, contact, features)
  - Data retention (90d)

- [ ] **100 Test Laudos** (published for portal download)
  - 50 HEMOGRAMA + 30 COAGULACAO + 20 other types
  - All signed with valid HMAC
  - CPF-filtered per patient

- [ ] **NOTIVISA Queue** (`notivisa-outbox/{labId}`)
  - 10 PENDING + 5 ACKED + 3 FAILED (mixed states)

- [ ] **Mock Users** (6 users for Phase 4)
  - RT, Physician, Operator, Patient ×2, Admin
  - All with staging emails + test passwords

**Effort:** 2–4h (fixture files + staging setup)  
**Owner:** QA Lead  
**Validation:** `npm run test:validate-fixtures -- --phase 4`

### Phase 5 Test Data (Due 2026-06-09)

- [ ] **Critical Thresholds** (`criticos-config/{labId}`)
  - 10+ analytes with critical/warning ranges
  - Escalation policy (SMS + email recipients)

- [ ] **Test Runs with Critical Values** (15 runs)
  - 5 HIGH severity (critical)
  - 5 LOW severity (warning)
  - 5 normal ranges (baseline)

- [ ] **IA Training Dataset** (50 samples)
  - Golden samples (5+ edge cases)
  - Mixed confidence levels (95% → 70%)

- [ ] **Test Strip Images** (10 JPGs)
  - 5 clear (>95% confidence)
  - 3 ambiguous (70–80%)
  - 2 poor quality (manual override needed)

**Effort:** 4–6h  
**Owner:** Backend + QA Leads  
**Validation:** `npm run test:validate-fixtures -- --phase 5`

### Phase 6 Test Data (Due 2026-07-01)

- [ ] **12 NC Findings** (auditoria/{labId}/findings)
  - CRITICAL, MAJOR, MINOR severity mix
  - RDC 978 + DICQ mapping for each

- [ ] **6 CAPA Records** (state machine: OPEN → IN-PROGRESS → RESOLVED → CLOSED)
  - Evidence files (PDFs, screenshots, CSVs)
  - Audit trail events (creation → updates → closure)

**Effort:** 3–4h  
**Owner:** QA Lead  
**Validation:** `npm run test:validate-fixtures -- --phase 6`

### Phase 7 Test Data (Due 2026-07-15)

- [ ] **Export Config** + device profiles (iPhone, iPad, Android)

- [ ] **5–10 Test Exports** (XLSX, PDF, CSV)
  - Various date ranges + filters

- [ ] **100+ Feedback Samples** (for trending + trending dashboard)

**Effort:** 2–3h  
**Owner:** QA Lead  
**Validation:** `npm run test:validate-fixtures -- --phase 7`

---

## Go/No-Go Gate Checklist

### Phase 4 Go/No-Go (2026-06-02, pre-deploy)

**Functional completeness:**

- [ ] Patient portal accessible + responsive
- [ ] PDF download all laudo types
- [ ] NOTIVISA queue processing verified
- [ ] Firestore Rules enforce isolation

**Performance verified:**

- [ ] LCP <2.0s, INP <200ms, CLS <0.05
- [ ] No console errors on portal routes
- [ ] NOTIVISA processor <10s per batch

**Compliance verified:**

- [ ] RDC 978 Arts. 6º §1, 167, 204 satisfied
- [ ] DICQ 4.3–4.4 audit trail complete
- [ ] LGPD Art. 18 (patient access) verified
- [ ] Firestore Rules approved by security

**Testing verified:**

- [ ] 38+ unit tests passing
- [ ] 6 critical E2E flows passing (staging)
- [ ] Cloud Logs 24h clean (0 ERROR/CRITICAL)

**Sign-offs:**

- [ ] CTO approval (architecture + compliance)
- [ ] Tech Lead approval (design + performance)
- [ ] QA Lead approval (test coverage + Cloud Logs)
- [ ] Security Lead approval (RBAC + Rules)
- [ ] Auditor pre-alignment (regulatory mapping)

**Gate decision:** GO / NO-GO (CTO, Tech Lead joint decision)

---

### Phase 5 Go/No-Go (2026-06-30, pre-deploy)

**Functional completeness:**

- [ ] SMS/email delivered <2min critical values
- [ ] SLA dashboard 100% uptime
- [ ] IA strip upload + Gemini Vision working
- [ ] Model versioning (v1.0 vs v1.1) functional

**Performance verified:**

- [ ] Critical detection <500ms latency
- [ ] Strip OCR confidence >85%
- [ ] SLA queries <2s

**Compliance verified:**

- [ ] RDC 978 Arts. 115-117 satisfied
- [ ] DICQ 4.7 (IA training) audit trail
- [ ] LGPD Arts. 7, 9, 18 escalation logs

**Testing verified:**

- [ ] 40+ unit tests passing
- [ ] 8 critical E2E flows passing
- [ ] Cloud Logs 24h clean

**Sign-offs:**

- [ ] CTO approval
- [ ] Tech Lead approval
- [ ] QA Lead approval
- [ ] Twilio/SMS verification (if provisioned)
- [ ] Auditor pre-alignment

**Gate decision:** GO / NO-GO

---

### Phase 6 Go/No-Go (2026-07-14, pre-deploy)

**Functional completeness:**

- [ ] PDF generation <5s per laudo
- [ ] QR codes scannable
- [ ] Portal médico external access working

**Performance verified:**

- [ ] Lighthouse >90 desktop + mobile
- [ ] Web Vitals within targets

**Testing verified:**

- [ ] 8 critical E2E flows passing
- [ ] PDF quality verified (100 samples)
- [ ] Cloud Logs 24h clean

**Sign-offs:**

- [ ] CTO approval
- [ ] Tech Lead approval
- [ ] QA Lead approval

**Gate decision:** GO / NO-GO

---

### Phase 7 Go/No-Go (2026-07-28, pre-deploy)

**Functional completeness:**

- [ ] Export Wizard 4 steps complete
- [ ] XLSX <30s, PDF batch compression >50%
- [ ] Scheduled exports on cron
- [ ] Portal paciente feedback + trending

**Performance verified:**

- [ ] Export wizard responsive (<2s mobile)
- [ ] Email batch <5s per 100
- [ ] Trending dashboard <3s load

**Compliance verified:**

- [ ] RDC 978 Arts. 167, 204
- [ ] DICQ 4.15 (feedback trending)
- [ ] LGPD Arts. 5-7, 18 (consent + anonymization)

**Testing verified:**

- [ ] 35+ unit tests passing
- [ ] 8 critical E2E flows passing
- [ ] Mobile responsive (3+ devices)
- [ ] Cloud Logs 24h clean

**Sign-offs:**

- [ ] CTO approval
- [ ] Tech Lead approval
- [ ] QA Lead approval
- [ ] Auditor pre-alignment

**Gate decision:** GO / NO-GO

---

## Wave 2 Sign-Off Checklist

### Smoke Tests (Post-Phase 7 Deploy)

```
□ Portal auth flow (email link → login → laudo view → PDF download)
□ Critical value escalation (result entry → SMS sent → SLA tracked)
□ IA strip upload (image upload → Gemini Vision → confidence > 85%)
□ Export wizard (4-step flow → email delivery verified)
□ Portal paciente feedback (submit → RT view → trending dashboard)
□ CAPA closure workflow (NC finding → investigate → execute → verify → close)
□ Auditor alignment ceremony (Phase 8 sign-off)
```

### Test Coverage Baseline

| Phase     | Unit Tests | E2E Flows | Coverage % | Target % |
| --------- | ---------- | --------- | ---------- | -------- |
| **4**     | 38+        | 6         | TBD        | 85%+     |
| **5**     | 40+        | 8         | TBD        | 85%+     |
| **6**     | 20+        | 8         | TBD        | 80%+     |
| **7**     | 35+        | 8         | TBD        | 80%+     |
| **Total** | 133+       | 30        | TBD        | 83%+     |

### Cloud Logs Baseline

**Per-phase 24h post-deploy requirements:**

| Metric         | Phase 4 | Phase 5 | Phase 6 | Phase 7 |
| -------------- | ------- | ------- | ------- | ------- |
| ERROR count    | 0       | 0       | 0       | 0       |
| CRITICAL count | 0       | 0       | 0       | 0       |
| WARNING rate   | <5%     | <5%     | <5%     | <5%     |
| Error types    | TBD     | TBD     | TBD     | TBD     |

---

## Wave 2 Readiness Assessment (2026-05-07)

### Current Status Summary

| Category           | Status      | Evidence                                          | Owner        |
| ------------------ | ----------- | ------------------------------------------------- | ------------ |
| **Planning**       | ✅ COMPLETE | 4 phase plans ready                               | Tech Lead    |
| **Infrastructure** | ⏳ PENDING  | SMTP/Tasks/sandbox setup due 2026-05-19           | DevOps Lead  |
| **Test Data**      | ⏳ PENDING  | Fixtures ready, provisioning due per phase        | QA Lead      |
| **Team**           | ✅ READY    | 3.5 FTE assigned, no conflicts                    | Stream Leads |
| **Compliance**     | ✅ MAPPED   | RDC 978, DICQ, LGPD coverage verified             | Auditor      |
| **Architecture**   | ✅ APPROVED | Phase 3 deployed, Phase 4-7 designs reviewed      | CTO          |
| **Documentation**  | ✅ COMPLETE | Kickoff checklists, quick reference, guides ready | All          |

### Risk Assessment (By Phase)

| Phase | Risk Score | Top Risk                | Mitigation                                     |
| ----- | ---------- | ----------------------- | ---------------------------------------------- |
| **4** | 3.5/10     | Email delivery fail     | Test with staging, retry queue, fallback alert |
| **5** | 3/10       | IA strip upload latency | Batch processing + async queue                 |
| **6** | 2.5/10     | PDF generation bloat    | Streaming + compression + load test            |
| **7** | 3/10       | Batch export at scale   | Email job queue + scheduled retry              |

**Overall Wave 2 risk:** 3.0/10 (LOW) — All risks have clear mitigations.

### Blockers & Escalations

**No critical blockers identified.** Pre-kickoff action items are soft (infrastructure provisioning with fallback behaviors).

---

## Wave 2 → Wave 3 Handoff Protocol

### Handoff Checklist (Due 2026-07-28)

- [ ] All Phase 4-7 deployments complete + verified (24h Cloud Logs clean)
- [ ] Test data preserved (snapshot backup taken)
- [ ] Smoke test results documented
- [ ] Coverage metrics captured (unit tests, E2E flows, Cloud Logs)
- [ ] Phase 8 CAPA closure status reported (parallel track)
- [ ] Auditor pre-alignment ceremony completed (sign-off on F-05/F-06/F-07)
- [ ] Wave 3 infrastructure requirements identified (NOTIVISA production, extended KPIs, penetration test)
- [ ] Known issues + regressions documented

### Wave 3 Readiness Criteria

**Wave 3 (Phases 8-11) can start if:**

- ✅ Phase 4-7 live + stable (0 critical errors 48h post-deploy)
- ✅ CAPA closure F-01 → F-04 complete (Eng-owned)
- ✅ Auditor pre-alignment ceremony complete (CTO + Auditor)
- ✅ Test data refresh executed (Riopomba 80 docs validated)
- ✅ Production hardening checklist approved

---

## Coordination Command Center

### Daily Standup (Phase 4-7 execution)

**When:** 10:00 BRT daily (Mon-Fri)  
**Duration:** 15 min  
**Attendees:** Phase 4-7 executor + Wave 2 Lead + Tech Lead (optional)  
**Format:**

- What did I ship yesterday?
- What's blocking me today?
- What's my priority for tomorrow?

**Escalations:** Yellow/Red status → Wave 2 Lead → CTO (same day)

### Weekly Coordination (Wave 2 Lead + All Executors)

**When:** Fridays 15:00 BRT  
**Duration:** 45 min  
**Attendees:** Wave 2 Lead, Phase 4-7 leads, QA Lead, DevOps Lead, Tech Lead, CTO (optional)  
**Agenda:**

1. Phase 4-7 status by executor (3 min each)
2. Cross-phase blockers + dependencies (5 min)
3. Test data + infrastructure readiness (5 min)
4. Auditor alignment prep (5 min, starting Week 2)
5. Risk register review (5 min)
6. Q&A + escalations (5 min)

**Output:** Coordination summary (Slack #phase-4-7-updates)

### Auditor Pre-Alignment (Weekly, starting 2026-06-01)

**When:** Mondays 10:00 BRT  
**Duration:** 45 min  
**Attendees:** CTO, RT Lead, External Auditor  
**Agenda:**

- Week 1 (Jun 1): Portal architecture + NOTIVISA integration
- Week 2 (Jun 8): Critical escalation + IA training demo
- Week 3 (Jun 15): CAPA closure progress (F-01 → F-04)
- Week 4 (Jun 22): Extended modules (liberación, reclamações)
- **Ongoing through auditor ceremony (Aug 5)**

---

## Monitoring & Observability

### Cloud Logs Strategy (Per Phase)

**Post-deploy monitoring window:** 24h per phase  
**Alert threshold:** 0 ERROR/CRITICAL, <5% WARNING rate  
**Actions:**

- [ ] Deploy monitoring dashboard (24h tail script)
- [ ] Configure alert policies (Slack + PagerDuty)
- [ ] Document error signatures + remediation runbooks
- [ ] Create incident response checklists

**Reference:** `CLOUD_LOGS_MONITORING_GUIDE.md`

### Performance Monitoring

**Baseline capture (per phase):**

- [ ] LCP, INP, CLS measurements (Lighthouse)
- [ ] API latency (Cloud Trace)
- [ ] Database query performance (Firestore metrics)
- [ ] Bundle size (vite build report)

**Regression gates:**

- Abort deploy if LCP >2.5s or CLS >0.1
- Alert if INP >200ms

### Test Coverage Tracking

**Per-phase target:** 80%+ coverage  
**Tools:**

- [ ] vitest coverage report (unit tests)
- [ ] Detox E2E flow pass rate
- [ ] Cloud Logs error tracking

---

## Communication Plan

### Slack Channels

- **#phase-4-7-updates** — Daily standup summaries + blockers
- **#wave-2-coordination** — Weekly coordination meeting notes
- **#auditor-alignment** — Auditor pre-alignment talking points
- **#cloud-logs-monitoring** — 24h post-deploy monitoring alerts

### Email Distribution

- **Wave 2 Daily Report** (10:15 BRT) → Wave 2 Lead, Tech Lead, CTO
- **Weekly Coordination Summary** (15:30 Fridays) → All stakeholders
- **Phase Go/No-Go Decision** (2h pre-deploy) → All stakeholders

### Escalation Paths

| Severity                           | Escalation Path                       | Time      |
| ---------------------------------- | ------------------------------------- | --------- |
| **GREEN** (on-track)               | Slack update daily                    | EOD       |
| **YELLOW** (at-risk, 3-day buffer) | Slack + daily standup                 | Same day  |
| **RED** (blocking, <3-day buffer)  | Slack + Wave 2 Lead → Tech Lead → CTO | <2h       |
| **CRITICAL** (deploy abort)        | Phone + CTO decision                  | Immediate |

---

## Success Criteria (Wave 2 Complete)

### Delivery

- ✅ All 4 phases (4-7) deployed to production
- ✅ Zero regressions (738+ baseline tests passing)
- ✅ DICQ compliance 78.5% → 88%+ (Phase 0-7)
- ✅ RDC 978 critical articles 100% coverage

### Quality

- ✅ Test coverage 80%+ per phase
- ✅ Cloud Logs 24h clean per phase
- ✅ Performance baselines established + monitored
- ✅ Smoke tests 100% passing

### Compliance

- ✅ Auditor pre-alignment ceremony complete (Phase 8 sign-off)
- ✅ CAPA closure F-01 → F-04 complete
- ✅ All regulatory mappings verified

### Team

- ✅ No critical incidents during Wave 2 execution
- ✅ Team morale high (post-launch retrospectives)
- ✅ Knowledge transfer complete (handoff to Wave 3)

---

## Appendix: Phase 4-7 One-Pagers

### Phase 4 — Patient Portal + NOTIVISA Integration

**Focus:** User-facing portal (RT + patient) + gov regulatory queue  
**Compliance:** RDC 978 Arts. 6º §1, 167, 204  
**Effort:** 2.5 weeks, 3.5 FTE  
**Risk:** 3.5/10 (email delivery, API keys)  
**Success:** Portal responsive + NOTIVISA queue processing verified

### Phase 5 — Critical Escalation + IA Training Dataset

**Focus:** Real-time alerts (SMS/email) + machine learning strip parsing  
**Compliance:** RDC 978 Arts. 115-117, DICQ 4.7  
**Effort:** 3 weeks, 4 FTE  
**Risk:** 3/10 (IA latency, Twilio provisioning)  
**Success:** SMS <2min, IA confidence >85%

### Phase 6 — Liberación Completion + Críticos Polish

**Focus:** PDF export + portal médico + Lighthouse optimization  
**Compliance:** RDC 978 Arts. 167, DICQ 4.3  
**Effort:** 2 weeks, 2 FTE  
**Risk:** 2.5/10 (puppeteer bloat, QR code formatting)  
**Success:** PDF <5s, Lighthouse >90, QR scannable

### Phase 7 — Export Wizard + Reclamações/Satisfação + Portal Paciente

**Focus:** Bulk export (XLSX/PDF/CSV) + feedback collection + trending  
**Compliance:** RDC 978 Arts. 167, 204; DICQ 4.15; LGPD Arts. 5-7, 18  
**Effort:** 3 weeks, 2.5 FTE  
**Risk:** 3/10 (batch scale, email delivery at scale)  
**Success:** XLSX <30s, batch cron reliable, portal paciente responsive

---

## Next Steps (2026-05-07 → 2026-05-20)

### By 2026-05-19 EOB (Critical Path)

1. **DevOps** provisions SMTP credentials (1–2h)
2. **DevOps** creates Cloud Tasks queue (15 min)
3. **QA** provisions Phase 4 test data + staging lab (2–4h)
4. **All Leads** complete sign-offs in PHASE_4_KICKOFF_CHECKLIST.md
5. **CTO** makes final GO/NO-GO decision

### 2026-05-20 Kickoff

1. **09:00–10:00:** Phase 4 all-hands kickoff meeting
2. **Afternoon:** Architecture review session (Tech Lead + team)
3. **EOD:** Confirm all team environments configured + ready

### 2026-05-21+ Execution

1. Phase 4 Day 1: 04-01 auth + 04-03 queue kickoff (parallel)
2. Phase 4 Day 2–3: Component scaffolding + architecture finalization
3. Phase 5 parallel planning + test data staging

---

## Document Metadata

**Created:** 2026-05-07 (pre-kickoff)  
**Owner:** Wave 2 Lead (Coordinator)  
**Approvers:** CTO, Tech Lead, Stream Leads  
**Status:** ⏳ **Awaiting final sign-offs (pre-kickoff checklist)**  
**Next Review:** 2026-05-20 (post-kickoff) + weekly thereafter  
**Distribution:** All Phase 4-7 participants + auditor

---

**Wave 2 is READY for 2026-05-20 execution start.** All planning complete, infrastructure provisioning in final phase, test data pre-staged. Go/No-Go gates established per phase. Coordination framework in place.

CTO decision required by 2026-05-20 09:00 UTC. All systems green for launch.
