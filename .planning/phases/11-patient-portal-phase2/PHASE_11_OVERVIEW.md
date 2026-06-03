---
phase: '11'
title: 'Patient Portal Phase 2 + Multi-Channel Feedback'
status: 'Planned'
created: '2026-05-07'
duration: '3 weeks'
waves: 2
---

# Phase 11: Patient Portal Phase 2 + Multi-Channel Feedback

**Milestone:** v1.4 (Quality Extensions)  
**Period:** 2026-05-20 → 2026-06-10 (3 weeks)  
**Streams:** Backend (1.5 FTE) + Frontend (1.0 FTE) + DevOps (0.5 FTE)  
**Risk:** 2.5/10 (dependency on Phase 4 portal auth, email service integration deferred to Phase 5)

---

## Overview

Expands Phase 4 (Patient Portal Foundation) with multi-channel feedback infrastructure:

1. **Patient Complaint Intake** (Plan 11-01) — Structured complaint forms + auto-severity classification + RCA Five Whys + NC auto-trigger
2. **NPS + Suggestion Voting** (Plan 11-02) — Post-resolution satisfaction survey + patient suggestion feed with crowd-sourced voting + LGPD compliance

Full DICQ 4.8 (feedback management) + DICQ 4.14.3 (customer satisfaction) + RDC 978 Art. 115 (patient communication) + LGPD Arts. 18, 9 compliance.

---

## Plan Structure

### Plan 11-01: Complaint Intake + RCA Foundation (Wave 1, 5 days)

**Objective:** Build complaint intake forms + RCA workflow per DICQ 4.8/4.14.3.

**Deliverables:**

- Complaint intake form (FormReclamacao.tsx) with reCAPTCHA v3 + file upload
- RCA Five Whys wizard (RCAFormFiveWhys.tsx, 5 levels + root cause)
- Cloud Callable: criarReclamacao (create complaint + classify severity + NC auto-trigger)
- Cloud Callable: transitarReclamacao (state machine enforcement + RCA validation)
- Firestore Trigger: criarNCDraft (auto-create NC on high-severity)
- Firestore Rules: RLS for reclamacoes + RCA collections
- 15+ unit tests (form validation, callable logic, RCA, state machine)
- 3 critical E2E flows (form submission, RCA workflow, NC auto-create)

**Key Features:**

- Severity auto-classification (heuristic, deterministic, no API dependency)
- Status state machine: Nova → Analisando → RCA → Resolvida → Comunicada → Fechada
- High-severity (>=100 chars) auto-triggers NC draft (RN-13)
- RCA validation enforces 4+ levels before Resolvida transition (RN-14)
- All writes signed with LogicalSignature (ADR-0001)
- Soft-delete only (RN-06)

**Files Modified:** 13 files (2 components, 5 callables/triggers, 1 rules, 5 test files)

---

### Plan 11-02: NPS Logic + Suggestion Voting (Wave 2, depends on 11-01, 5 days)

**Objective:** Build post-resolution satisfaction measurement + suggestion feed with voting.

**Deliverables:**

- NPS survey form (FormNPSSurvey.tsx, token-based, 1-5 scale)
- Suggestion voting feed (SugestaoListVoting.tsx with upvote/downvote UI)
- Cloud Callable: submitNPSResposta (public NPS response submission)
- Cloud Callable: criarSugestao (patient suggestion creation)
- Cloud Callable: votarSugestao (upvote/downvote aggregation + trending)
- Firestore Trigger: dispararNPSPosResolucao (email on Resolvida status)
- Pub/Sub Cron Trigger: anonimizarRespostas (90-day PII anonymization per LGPD)
- Firestore Rules: RLS for satisfacao + sugestoes collections
- 22+ unit tests (NPS validation, vote aggregation, trending, milestone notifications, error cases)
- 4 critical E2E flows (NPS survey submission, suggestion creation, voting, 90d anonymization)

**Key Features:**

- NPS survey sent 30 days after complaint resolution (Resolvida status)
- Email contains token-based link (no auth required, single-use token)
- 1-5 scale response + optional comment (max 500 chars)
- After 90 days, PII anonymized (pacienteId dropped from response)
- Suggestions created via `/portal-paciente/sugestoes/nova` (email-link auth required)
- Patient voting: upvote/downvote buttons, user vote tracked per user (prevents double-voting)
- Trending aggregation: votos + recency bonus (suggestions <7 days old get boost)
- Notification on milestone: suggestion creator notified at 10+ upvotes
- LGPD consent checkbox on survey form + explicit audit trail

**Files Modified:** 16 files (3 components, 5 callables/triggers, 1 rules, 7 test files)

---

## Wave Structure

| Wave  | Plans | Focus                  | Duration | Owner              | Blocker                                      |
| ----- | ----- | ---------------------- | -------- | ------------------ | -------------------------------------------- |
| **1** | 11-01 | Complaint intake + RCA | 5 days   | Backend + Frontend | Phase 4 portal auth                          |
| **2** | 11-02 | NPS + voting           | 5 days   | Backend + Frontend | 11-01 complete (Resolvida status dependency) |

**Parallelization:** Minimal — 11-02 depends on 11-01 Reclamacao status machine (Resolvida trigger point).

---

## Compliance Mapping

| Standard    | Article      | Phase 11 Coverage                              |
| ----------- | ------------ | ---------------------------------------------- | ------------------------ |
| **DICQ**    | 4.8          | Feedback management (complaint intake + RCA) ✓ |
| **DICQ**    | 4.14.3       | Customer satisfaction (NPS survey) ✓           |
| **DICQ**    | 4.14.4       | Improvement suggestions (voting feed) ✓        |
| **DICQ**    | 4.14.6       | Risk analysis via NC                           | ✓ (auto-link)            |
| **RDC 978** | Art. 115     | Patient communication rights (portal) ✓        |
| **CDC**     | Lei 8.078/90 | 30-day response SLA                            | ✓ (tracked)              |
| **LGPD**    | Art. 9       | Sensitive data handling                        | ✓ (audit trail, hashing) |
| **LGPD**    | Art. 18      | Right of access                                | ✓ (portal, NPS)          |
| **LGPD**    | Art. 19      | Right to deletion                              | Deferred to Phase 12     |

---

## Testing Summary

**Unit Tests:** 37+ (form validation, callables, RCA validation, vote aggregation, trending)

**E2E Tests:** 7 critical flows

- Complaint form submission + severity classification
- RCA Five Whys workflow + state transitions
- NC auto-creation on high-severity
- NPS survey submission + token validation
- Suggestion creation + voting
- Vote aggregation + trending calculation
- 90-day PII anonymization

**Coverage Target:** >90% on new code

**Execution Framework:** Jest (unit) + Cypress/Playwright (E2E), Firebase Emulator for integration

---

## Risk Dashboard

| Risk                           | Likelihood | Impact                               | Mitigation                                                                         |
| ------------------------------ | ---------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| **Email service integration**  | Medium     | Phase blocked if email fails         | Defer to Phase 5; use mock/log-based email in Phase 11 (Phase 4 also defers email) |
| **Firestore trigger delays**   | Low        | NPS sends late (>1h after Resolvida) | Monitor Cloud Logs; set alert on trigger latency                                   |
| **Pub/Sub cron misfire**       | Low        | PII not anonymized                   | Dry-run cron in test lab; manual trigger fallback script                           |
| **Vote spam**                  | Low        | Trending skewed by bots              | Rate limit: 100 votes/patient/hour; Cloud Logs monitoring                          |
| **Gemini integration pending** | Medium     | Heuristic severity <95% accuracy     | Use heuristic (deterministic) in Phase 11; defer IA to Phase 5                     |

---

## Dependencies & Blockers

**Upstream Dependencies:**

- Phase 4 (Portal Foundation) — Email-link auth required for patient access
- Phase 11-01 must complete before 11-02 starts (Reclamacao status machine required)

**Downstream Dependents:**

- Phase 11.5 (NPS Dashboard) — Trending aggregation + NPS score analytics
- Phase 12 (LGPD Fulfillment) — Right-to-deletion implementation
- Phase 5 (IA Integration) — Gemini severity classifier (optional enhancement)

---

## Deployment Checklist

**Pre-Deploy (Wave 1 + Wave 2 complete):**

- [ ] TypeScript: 0 errors
- [ ] Unit tests: 37+ all green, coverage >90%
- [ ] E2E tests: 7 flows all green
- [ ] Firestore Rules: 60+ emulator tests pass
- [ ] Cloud Logs: 24h simulation clean
- [ ] Accessibility: WCAG AA confirmed
- [ ] Dark theme: matches reference (no template)
- [ ] LGPD compliance: audit trail complete, consent checkboxes functional

**Deployment Steps:**

1. Rules (firestore.rules)
2. Functions (criarReclamacao, transitarReclamacao, dispararNPSPosResolucao, submitNPSResposta, criarSugestao, votarSugestao, criarNCDraft, anonimizarRespostas)
3. Hosting (React components)

**Sign-Off:**

- CTO (code + design)
- QA (tests + E2E)
- DevOps (deployment + monitoring)
- RT Lead (UX validation)

---

## Success Criteria

**Functional:**

- Patients submit complaints <5s (form → callable → Firestore)
- Severity auto-classified (heuristic accuracy ≥95% on test set)
- High-severity complaints create NC automatically (100% success)
- RT approves classification + fills RCA without errors
- NPS surveys sent 30 days after Resolvida (trigger latency <5min)
- Patients vote on suggestions (upvote/downvote aggregation correct)
- PII anonymized after 90 days (audit log confirms removal)

**Performance:**

- Form submission: <5s (including reCAPTCHA + classification)
- NPS survey: <3s (rendering + submission)
- Suggestion voting: <2s (upvote toggle)
- Mobile responsive: tested on 375px/768px/1024px

**Compliance:**

- DICQ 4.8 + 4.14.3 satisfied
- RDC 978 Art. 115 satisfied
- LGPD Arts. 9, 18 satisfied (explicit consent, audit trail, PII removal)
- 0 cross-patient leaks (code review + Rules validation)

**Security:**

- reCAPTCHA bot prevention (score >=0.5)
- Rate limiting enforced (10 complaints/patient/24h, 100 votes/patient/hour)
- Token single-use (NPS survey)
- All writes signed with LogicalSignature

---

## Timeline

```
May 20 — Phase 11 kickoff (11-01 starts)
  ├─ May 22: 11-01 types + rules complete
  ├─ May 24: 11-01 forms + callables complete
  ├─ May 26: 11-01 triggers + tests complete
  └─ May 27: 11-01 deployment checklist signed, Wave 1 complete

May 27 — Phase 11-02 starts (depends on 11-01)
  ├─ May 29: 11-02 types + rules + forms complete
  ├─ May 31: 11-02 callables + triggers complete
  ├─ Jun 02: 11-02 E2E tests + documentation complete
  └─ Jun 03: 11-02 deployment checklist signed, Wave 2 complete

Jun 03 — Combined deployment (11-01 + 11-02)
  ├─ Jun 03: Deploy Rules
  ├─ Jun 03: Deploy Functions (8 callables/triggers)
  ├─ Jun 04: Deploy Hosting (React components)
  └─ Jun 05: 24h Cloud Logs monitoring + sign-off

Jun 10 — Phase 11 LIVE (all feedback loops functional)
  └─ Unblocks Phase 11.5 (NPS dashboard) + Phase 12 (LGPD fulfillment)
```

---

## Deferred (Out of Phase 11 Scope)

- **WhatsApp/SMS notifications** — Phase 5 (multi-channel escalation)
- **Email delivery service** — Phase 5 (Resend integration, Phase 4 also defers this)
- **Trending dashboard (NPS/suggestions)** — Phase 11.5+ (analytics aggregate + visualization)
- **Gemini IA severity classification** — Phase 5+ (cost optimization, heuristic sufficient for MVP)
- **Right-to-deletion (LGPD Art. 19)** — Phase 12 (full PII purge + account closure)

---

## Files Summary

**Total files modified/created:** 29 files

| Category             | Count | Files                                                                                                                                             |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components (TSX)     | 5     | FormReclamacao, RCAFormFiveWhys, FormNPSSurvey, SugestaoCard, SugestaoListVoting                                                                  |
| Hooks (TS)           | 5     | useReclamacaoForm, useRCAState, useNPSSurvey, useSugestaoVoting, satisfacaoService                                                                |
| Cloud Functions (TS) | 8     | criarReclamacao, transitarReclamacao, criarNCDraft, dispararNPSPosResolucao, submitNPSResposta, anonimizarRespostas, criarSugestao, votarSugestao |
| Types (TS)           | 2     | reclamacoes/types, satisfacao/types                                                                                                               |
| Rules (Firestore)    | 1     | firestore.rules (extended)                                                                                                                        |
| Tests (TS)           | 7     | reclamacoes-intake.test, satisfacao-nps.test, sugestoes-voting.test, reclamacao-intake.e2e, nps-survey.e2e, sugestao-voting.e2e + others          |
| Documentation (MD)   | 1     | PHASE_11_OVERVIEW.md + inline (CLAUDE.md updates, ARCHITECTURE.md, DEPLOYMENT-CHECKLIST)                                                          |

---

## References

- **PLAN 11-01:** `.planning/phases/11-patient-portal-phase2/11-01-PLAN.md`
- **PLAN 11-02:** `.planning/phases/11-patient-portal-phase2/11-02-PLAN.md`
- **Phase 4 (Portal Auth):** `.planning/phases/04-portal-notivisa/04-01-PLAN.md`
- **Module CLAUDE.md:** `src/features/reclamacoes/CLAUDE.md` (architecture + rules)
- **ADR-0001:** `docs/adr/0001-audit-chain.md` (LogicalSignature pattern)
- **Compliance:** `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md` (block coverage)

---

**Created:** 2026-05-07  
**Status:** Planned (ready for Phase 11 kickoff 2026-05-20)  
**Next Step:** Execute Plan 11-01 (Wave 1) upon Phase 4 completion
