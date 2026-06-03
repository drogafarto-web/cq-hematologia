---
phase: '4'
milestone: 'v1.4'
title: 'Phase 4 — Patient Portal + NOTIVISA Integration (Wave 2)'
date_created: '2026-05-07'
date_updated: '2026-05-07'
status: 'planning-complete'
---

# Phase 4 — Patient Portal + NOTIVISA Integration

**Milestone:** v1.4 — Compliance Closure + Portal Expansion + IA Foundation  
**Wave:** 2 (Operations, Weeks 4–5)  
**Duration:** 2.5 weeks (2026-05-20 → 2026-06-02)  
**Status:** ✅ **Planning complete, ready for execution**

---

## Executive Summary

Phase 4 delivers two major regulatory features:

1. **Patient Portal** (REQ-408, REQ-409) — Read-only access to published laudos via email-link auth + PDF download + lab branding customization. Addresses RDC 978 Art. 167 (patient notification right) + LGPD Art. 18 (data access right).

2. **NOTIVISA Integration** (REQ-410) — Regulatory queue processor + sandbox API integration for result notifications (RDC 978 Art. 6º §1). Async retry logic, audit trail, compliance-ready for v1.5 production transition.

**Key metrics:**

- Scope: 2 major features, 4 interrelated tasks, 1 phase
- Effort: 2.5 weeks, ~3–4 FTE (Stream A backend + Stream B frontend + QA)
- Compliance: RDC 978 Arts. 6º §1, 167, 204 · DICQ 4.4 (audit) · LGPD Arts. 9, 18
- Dependencies: Phase 3 schema extensions (LIVE) + Phase 0 (LGPD baseline, LIVE)
- Risks: Email delivery (medium), API key management (medium), mobile responsiveness (low)

---

## Phase Breakdown

### Task 04-01: Patient Portal — Laudo Access & Download

**Owner:** Stream B (Portal Frontend Engineer)  
**Duration:** 2 weeks  
**Status:** Ready for execution

**Deliverables:**

- Email-link authentication (token validation, session management)
- Patient laudo list view (filtered by CPF, published only)
- Laudo detail page (full results display, read-only)
- Portal settings page (notification preferences)
- 3 Cloud Function callables (validatePatientToken, downloadLaudoPDF, updatePreferences)
- Firestore Rules for portal-configuracao + laudos patient reads + patientSessions
- 15+ unit tests

**Scope highlights:**

- One-time email link (7-day expiry, single-use)
- Session tokens (JWT, 30-day expiry, stored in localStorage)
- No SSO (v1.4 DL-3 decision, LGPD compliance via audit trail)
- Lab-specific branding (colors, logo, label customization)
- Patient data isolation (CPF-based filtering, server-side validation)

**Success criteria:**

- Patient can access portal via email link <500ms
- PDF download works for all laudo types
- All patient reads logged with CPF hash in audit trail
- WCAG AA accessibility + dark theme world-class quality

**Risk:** Email delivery (SMTP reliability), cross-patient data leak (mitigated by Rules + server-side CPF filter)

---

### Task 04-02: Portal UI Components & Responsive Design

**Owner:** Stream B (UI/UX Engineer)  
**Duration:** 1.5 weeks (overlaps 04-01 final week)  
**Status:** Ready for execution

**Deliverables:**

- 5 core components (PortalNavbar, PortalLayout, LaudoCard, LaudoDetailPage, PortalFooter)
- 3 page routes (PortalAuthPage, PortalLaudosPage, PortalLaudoDetailPage)
- Dark theme design tokens (portal-specific color + typography overrides)
- Responsive layouts (mobile-first, 640px/768px/1024px breakpoints)
- 12+ component unit tests + 3 snapshot tests
- Storybook stories (if Storybook in use)

**Scope highlights:**

- Mobile-first responsive (iPhone, iPad, desktop)
- Dark theme (dark mode only, no light mode in v1.4)
- Lab branding injection (CSS variables for dynamic colors)
- WCAG AA minimum (contrast 4.5:1, keyboard nav, screen reader)
- Web Vitals targets (LCP <2.0s, INP <200ms, CLS <0.05)

**Success criteria:**

- Passes designer review (Apple/Linear/Stripe reference, no template feel)
- WCAG AA verified (Axe DevTools, 0 violations)
- LCP <2.0s + INP <200ms + CLS <0.05 (Lighthouse baseline)
- Mobile tested on iPhone 12, iPad, Pixel 6

**Risk:** CSS cascade conflicts (mitigated by Tailwind `@layer`), mobile layout breaks (mitigated by real device testing)

---

### Task 04-03: NOTIVISA Queue Processor & Integration

**Owner:** Stream A (Backend/Cloud Functions Engineer)  
**Duration:** 2.5 weeks  
**Status:** Ready for execution

**Deliverables:**

- 2 Cloud Function triggers (`onLaudoPublished` enqueue, `processNotiVisaQueue` cron processor)
- 1 Cloud Function callable (manual re-queue for ops)
- NOTIVISA payload generator + sandbox API client (functions/src/shared/notivisa.ts)
- Retry logic (exponential backoff, max 5 attempts)
- Firestore Rules for notivisa-outbox collection (append-only, read-restricted)
- Cloud Scheduler job config (hourly cron)
- 20+ unit tests + 1 E2E integration test
- Operations guide (runbook for alert response, re-queue, troubleshoot)

**Scope highlights:**

- Regulatory queue (RDC 978 Art. 6º §1 compliance)
- Async processing (fire-and-forget laudo publish, queue async)
- Sandbox API integration (Portaria 204 format, ANVISA sandbox test)
- Audit trail (all events immutable, operator signatures)
- Failure handling (retry, alert ops on repeated failure)
- Patient data security (CPF hashed in queue, plaintext only in API payload)

**Success criteria:**

- Events enqueued on laudo publication
- Processor completes <10s per batch (10 events)
- Sandbox API calls succeed (202 Accepted)
- Retry logic works (5min → 10min → ... exponential backoff)
- Cloud Logs clean (0 errors, proper audit trail)
- Manual re-queue callable works (ops can retry failed events)

**Risk:** API key expiry (mitigated by secrets rotation + alert), payload format rejection (mitigated by schema validation in tests), network timeout (mitigated by retry)

**Note:** Production NOTIVISA (actual gov API submission) deferred to v1.5 pending auditor approval.

---

### Task 04-04: Testing, Cloud Logs & Deployment Validation

**Owner:** QA Engineer + DevOps (Stream D)  
**Duration:** 1.5 weeks (overlaps previous tasks final week)  
**Status:** Ready for execution

**Deliverables:**

- 6 critical E2E flows (portal auth → laudo view → PDF download → logout + NOTIVISA queue processing)
- Staging environment setup + data seeding script
- Cloud Logs monitoring (alert policy, log sink, 24h tail script)
- Smoke test checklist (executable, step-by-step)
- Deployment readiness checklist (pre-deploy verification)
- Staging sign-off report

**Scope highlights:**

- E2E testing (real user journeys, not unit tests)
- Mobile responsiveness verification (real devices: iPhone, iPad, Android)
- Accessibility testing (keyboard nav, screen reader)
- Performance validation (LCP, INP, CLS measurements)
- 24h post-deploy Cloud Logs monitoring
- Incident response runbook

**Success criteria:**

- All 6 E2E flows pass in staging
- 0 console errors on portal routes
- NOTIVISA sandbox processing verified
- Cloud Logs clean (0 ERROR/CRITICAL over 24h)
- Readiness checklist approved (CTO, QA, Security, Ops)

**Risk:** Staging data stale (mitigated by re-seed before test), E2E flaky (mitigated by retries + local mocks), alert noisy (mitigated by baseline tuning)

---

## Dependency Graph

```
Phase 3 (Schema Extensions) ─────┐
                                  ├─→ 04-01 (Portal Auth + Callables)
Phase 0 (LGPD Baseline) ──────────┤   ├─→ 04-02 (Portal UI)
                                  │   ├─→ 04-04 (E2E + Cloud Logs)
                                  │
Phase 3 (Schema Extensions) ─────┤
                                  ├─→ 04-03 (NOTIVISA Queue)
Phase 0 (LGPD Baseline) ──────────┘   └─→ 04-04 (Cloud Logs + Deploy)
```

**Critical path:** 04-01 → 04-02 (sequential for portal UX coherence) + 04-03 (parallel, independent backend) → 04-04 (final integration + deploy)

---

## Wave 2 Context (v1.4)

Phase 4 is part of **Wave 2 — Operations** (Weeks 4–8, parallel execution).

| Phase | Focus                           | Duration  | Parallel  | Gate                  |
| ----- | ------------------------------- | --------- | --------- | --------------------- |
| **4** | Patient Portal + NOTIVISA       | 2.5 weeks | Weeks 4–5 | Phase 3 complete ✅   |
| **5** | Satisfação/Feedback Portal      | 1.5 weeks | Week 5    | Phase 4 → UI sign-off |
| **6** | Critical Values + SMS/Email     | 2 weeks   | Weeks 4–5 | Phase 3 complete ✅   |
| **7** | Satisfação Dashboard + Trending | 1.5 weeks | Week 6    | Phase 5 + 6 complete  |

Phase 4 gates Phase 5 (patient portal feature expansion) and provides foundation for Phase 6 (critical value escalations that re-use NOTIVISA infrastructure).

---

## Compliance Mapping

| Regulation  | Article | Requirement                     | Phase 4 Delivery                      |
| ----------- | ------- | ------------------------------- | ------------------------------------- |
| **RDC 978** | 6º §1   | NOTIVISA notification to gov    | Queue + sandbox API integration       |
| **RDC 978** | 167     | Patient notification of results | Portal access + email notification    |
| **RDC 978** | 204     | Portaria 204 format compliance  | Payload schema + signature validation |
| **DICQ**    | 4.3     | Data access controls            | Portal RLS + Firestore Rules          |
| **DICQ**    | 4.4     | Audit trail completeness        | All patient reads logged              |
| **LGPD**    | 9       | Sensitive data handling         | CPF hashing + audit trail             |
| **LGPD**    | 18      | Right of access                 | Patient portal mechanism              |

---

## Resource Allocation

**Streams assigned:**

- **Stream B (Frontend):** 04-01, 04-02 (sequential) — 1 FTE
- **Stream A (Backend):** 04-01 callables, 04-03 (parallel) — 1.5 FTE
- **Stream D (QA + DevOps):** 04-04 (E2E + monitoring) — 1 FTE
- **CTO (oversight):** Phase 4 gate, risk escalations — 5–10% time

**Total effort:** ~3.5 FTE × 2.5 weeks = 8.75 person-weeks

---

## Risk Summary

| Risk                        | Probability   | Impact          | Mitigation                                      | Owner    |
| --------------------------- | ------------- | --------------- | ----------------------------------------------- | -------- |
| Email delivery fail (SMTP)  | Medium (3/10) | High (7/10)     | Test with staging, retry queue, fallback alert  | Stream B |
| Cross-patient data leak     | Low (2/10)    | Critical (9/10) | Server-side CPF filter + Rules, code review     | Stream A |
| NOTIVISA API key expires    | Medium (3/10) | High (7/10)     | Rotate quarterly, test in staging, alert on 401 | DevOps   |
| Sandbox API rejects payload | Low (2/10)    | High (7/10)     | Schema validation in tests, example payloads    | Stream A |
| Mobile layout breaks        | Low (2/10)    | Medium (5/10)   | Real device testing (iPhone, iPad, Android)     | Stream B |
| E2E tests flaky             | Medium (4/10) | Medium (5/10)   | Add retries, local mocks, run 3x                | QA       |
| Performance regression      | Low (2/10)    | Medium (5/10)   | Web Vitals monitoring, compare vs baseline      | QA       |

**Overall risk score:** 3.5/10 (LOW) — All major risks have clear mitigations.

---

## Success Criteria (Phase-level)

### Functional Completeness

- [ ] Patient portal live + accessible via email link
- [ ] PDF download works for all laudo types
- [ ] NOTIVISA queue enqueues events automatically
- [ ] Sandbox API integration tested + working
- [ ] All patient data properly secured (RBAC + Rules)

### Performance & UX

- [ ] Portal loads in <2.0s (LCP, Lighthouse desktop + mobile)
- [ ] Mobile responsive on all test devices
- [ ] WCAG AA accessibility verified
- [ ] No console errors on portal routes
- [ ] Dark theme passes designer review

### Compliance & Audit

- [ ] RDC 978 Arts. 6º §1, 167, 204 satisfied
- [ ] DICQ 4.3–4.4 audit trail complete
- [ ] LGPD Art. 18 (patient access) + Art. 9 (sensitive data) verified
- [ ] All patient reads logged with CPF hash
- [ ] Firestore Rules enforce isolation

### Testing & Deployment

- [ ] 38+ unit tests all green (portal 12 + NOTIVISA 20 + integration 6)
- [ ] 6 critical E2E flows all green (staging)
- [ ] Cloud Logs 24h clean (0 ERROR/CRITICAL)
- [ ] Readiness checklist approved (CTO, QA, Security, Ops)
- [ ] Operations runbook complete + team briefed

---

## Execution Timeline

### Kickoff (Week 1, 2026-05-20)

- Day 1: Phase 3 complete + approved, Phase 4 all-hands
- Day 2–3: 04-01 auth + 04-03 queue architecture kick-off (parallel)
- Day 4–5: 04-02 component design finalized, spike Cloud Logs setup

### Wave 1 (Week 1–2)

- **04-01:** Email-link auth + callables wired
- **04-03:** Queue triggers + processor cron implemented
- **04-02:** Components scaffolded + theme tokens defined
- **04-04:** E2E tests drafted, staging environment setup

### Wave 2 (Week 2–2.5)

- **04-01:** Callables tested, portal integration finalized
- **04-02:** Responsive polish + accessibility audit
- **04-03:** Retries + error handling, manual re-queue tested
- **04-04:** Full E2E suite + staging smoke tests

### Deployment (Week 2.5)

- Day 1: Readiness checklist approved
- Day 2–3: Deploy Rules → Functions → Hosting (3-step deploy)
- Day 4: Cloud Logs 24h tail begins, smoke test execution
- Day 5–8: 24h post-deploy monitoring (auto + manual)

### Stabilization (Week 3 prep)

- Monitor Cloud Logs, alert on errors
- Fix any P0 issues immediately
- Phase 5 unblock after 24h clean logs

---

## Handoff to Phase 5

**Phase 5 prerequisites (all satisfied by Phase 4):**

- ✅ Portal auth + laudo view live
- ✅ Email notification mechanism (04-01)
- ✅ NOTIVISA queue infrastructure (04-03)
- ✅ Firestore schema extended (Phase 3)
- ✅ Cloud Logs monitoring active (04-04)

**Phase 5 scope (Patient Portal Phase 2 — edit workflows, RT portal):**

- RT editor for draft laudos (edit before publication)
- Pessimistic locking (prevent concurrent edits)
- Locking timeout + cleanup cron
- RT portal UI (similar to patient portal, but editable)
- Signature + publication workflow

**Phase 5 kickoff:** 1 week post-Phase 4 stabilization (2026-05-28 TBD), conditional on <5% error rate in Phase 4 production.

---

## Compliance Artifacts Produced

1. **NOTIVISA_QUEUE_ARCHITECTURE.md** — design doc, state machine, retry strategy
2. **NOTIVISA_OPERATIONS_GUIDE.md** — runbook for alert response, manual re-queue, troubleshooting
3. **PORTAL_ARCHITECTURE.md** — auth flow, session strategy, security model
4. **PORTAL_UI_ACCESSIBILITY.md** — WCAG AA approach, testing guide
5. **Phase 4 audit trail logs** — all patient reads + NOTIVISA events immutable in Firestore
6. **RDC 978 compliance matrix** — mapping Phase 4 deliverables to Arts. 6º §1, 167, 204
7. **ADRs (if design decisions warrant)** — email-link auth, session token strategy, NOTIVISA sandbox approach

---

## Sign-off & Approval Gates

**Phase 4 planning complete.** Ready for execution gate approval.

| Gate                    | Owner           | Status     |
| ----------------------- | --------------- | ---------- |
| **Scope review**        | CTO             | ⏳ Pending |
| **Architecture review** | Tech Lead       | ⏳ Pending |
| **Compliance review**   | Auditor liaison | ⏳ Pending |
| **Resource commitment** | Stream leads    | ⏳ Pending |
| **Execution kickoff**   | All             | ⏳ Pending |

**Expected approval date:** 2026-05-13 (end of Phase 3, start of Phase 4 week 1)

---

## Related Documents

- **Phase 3 Schema Extensions:** `.planning/phases/03-schema-extensions/` (portal-configuracao, notivisa-outbox, etc.)
- **Phase 0 LGPD Baseline:** `.planning/phases/00-rdc-blockers/` (POL-LGPD-001, DPIA)
- **v1.4 Roadmap:** `.planning/ROADMAP.md` (Wave 2 context, parallel phases 4–7)
- **v1.4 Requirements:** `docs/v1.4-REQUIREMENTS.md` (REQ-408, 409, 410 mapped)
- **Obsidian strategic docs:** `01_Projetos/HC_Quality_Roadmap.md`, `HC_Quality_Decisoes_Abertas.md`

---

## Revision History

| Version | Date       | Changes                                                         |
| ------- | ---------- | --------------------------------------------------------------- |
| 1.0     | 2026-05-07 | Initial planning, 4 PLAN.md files created (04-01 through 04-04) |

**Last updated:** 2026-05-07 (20:50 UTC)  
**Status:** ✅ **Ready for execution kickoff**
