---
phase: 2
title: "v1.4 Planning Deep-Dive — EXECUTION PLAN"
period: "2026-05-08 → 2026-05-10"
owner: "CTO + Stream Leads"
status: "READY FOR EXECUTION"
---

# Phase 2 PLAN — v1.4 Planning Deep-Dive

**Execution window:** Wed 2026-05-08 through Fri 2026-05-10 (3 calendar days)  
**Teams:** CTO, QA Lead, Stream A Lead (primary); Streams B, C, D on standby  
**Objective:** Lock all v1.4 requirements, dependencies, compliance mappings, and auditor alignment before Phase 1 code execution starts

---

## Overview: 6 Tasks with Parallel Execution

**Task 2.1 (Wed 09:00–13:00)** — REQ↔Phase Dependency Matrix  
**Task 2.2 (Wed 14:00–17:00)** — Phase 0 RDC Blockers Plan  
**Task 2.3 (Thu 09:00–15:00)** — DICQ Coverage Matrix  
**Task 2.4 (Thu 09:00–13:00, parallel with 2.3)** — RDC 978 Gap Analysis  
**Task 2.5 (Thu 14:00–15:30)** — Auditor Pre-Alignment Call  
**Task 2.6 (Fri 09:00–11:00)** — Risk Register Status Update  
**CTO Sign-Off (Fri 11:30–12:00)** — All 6 artifacts locked

**Total effort:** 20.5 hours over 3 days, 4 people  
**Gate outcome:** Phase 3 unblocked (Mon 2026-05-13)

---

## Task Breakdowns (Abbreviated — See BRIEF for Full Details)

### 2.1 — REQ↔Phase Matrix (Wed 09:00–13:00)

**Input:** REQUIREMENTS.md (16 REQs) + ROADMAP.md (15 phases) + RISK-401 context  
**Output:** `.planning/milestones/v1.4-REQ-PHASE-MATRIX.md`  
**Acceptance:** All REQs assigned to phases, no contradictions, Phase 0 items marked  
**Owner:** CTO (lead) + Stream A (review)

---

### 2.2 — Phase 0 Plan (Wed 14:00–17:00)

**Input:** RISK-403 (4 RDC blockers identified)  
**Output:** `.planning/milestones/v1.4-PHASE-0-PLAN.md`  
**Items:** Supervisor shifts, LGPD policy, lab apoio contracts, risk mgmt skeleton (4 items, 7 days)  
**Acceptance:** Each item has acceptance criteria, Phase 0 blocks Phase 1 kickoff  
**Owner:** QA Lead (lead) + Stream A (support)

---

### 2.3 — DICQ Coverage Matrix (Thu 09:00–15:00)

**Input:** Obsidian checklist + DICQ audit report + all previous artifacts  
**Output:** `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md`  
**Scope:** 40+ DICQ blocks mapped to phase or deferred decision  
**Acceptance:** No orphans, DICQ target 88% achievable  
**Owner:** QA Lead (lead) + CTO (review)

---

### 2.4 — RDC 978 Gap Analysis (Thu 09:00–13:00, parallel with 2.3)

**Input:** All RDC 978 articles (mandatory + contextual)  
**Output:** `.planning/milestones/v1.4-RDC-COVERAGE-MATRIX.md`  
**Scope:** Mandatory articles phase-assigned, ≥95% coverage target  
**Acceptance:** All critical articles 🟢 or 🟡, no 🔴  
**Owner:** QA Lead (lead) + CTO (final review)

---

### 2.5 — Auditor Pre-Alignment Call (Thu 14:00–15:30)

**Input:** All 4 previous artifacts, talking points  
**Output:** `v1.4-AUDITOR-ALIGNMENT-PLAN.md` + auditor email confirmation  
**Agenda:** Timeline, CAPA roadmap, RFI SLA (5 business days), compliance interpretations  
**Acceptance:** Auditor verbal/written confirmation of all commitments  
**Owner:** CTO (lead) + QA Lead (support)

---

### 2.6 — Risk Register Update (Fri 09:00–11:00)

**Input:** Outcomes from Tasks 2.1–2.5  
**Output:** Updated `v1.4-RISK-REGISTER.md` v1.1  
**Changes:** RISK-401, 403, 404 mitigated; version bumped; review cadence confirmed  
**Acceptance:** CTO + QA Lead sign-off  
**Owner:** CTO (lead) + QA Lead (support)

---

## Parallel Path Optimization

**Wednesday (2 tasks, 7 hours, sequential):**
- 09:00–13:00 Task 2.1 (CTO + Stream A)
- 14:00–17:00 Task 2.2 (QA Lead + Stream A)

**Thursday (3 tasks, 9 hours, parallel):**
- 09:00–15:00 Task 2.3 (QA Lead, primary focus)
- 09:00–13:00 Task 2.4 (CTO + QA Lead, secondary focus — can overlap with 2.3)
- 14:00–15:30 Task 2.5 (CTO + QA Lead, after 2.3/2.4 team debriefs)

**Friday (1 task + sign-off, 2.5 hours):**
- 09:00–11:00 Task 2.6 (CTO + QA Lead)
- 11:30–12:00 CTO final gate review + sign-off email

---

## Success Metrics

| Metric | Target | Verification |
|--------|--------|---|
| All 6 artifacts published | 6/6 | `.planning/milestones/` contains all files |
| REQ↔Phase reconciliation | 0 contradictions | Matrix shows phase order consistent w/ ROADMAP |
| Phase 0 scope | 4 items, 7 days | PHASE-0-PLAN shows fit within Week 1 |
| DICQ target | 88% achievable | Coverage matrix shows path to 156+/178 items |
| RDC mandatory | ≥95% coverage | 10 mandatory articles all 🟢 or 🟡 |
| Auditor alignment | Verbal + email | Auditor confirmation received by Sat 2026-05-11 |
| Risk mitigation | 3 risks mitigated | RISK-401/403/404 status = Mitigated |
| Team readiness | 4 streams ready | Phase 1 kickoff Mon 2026-05-13, all teams confirm |

---

## Known Risks & Mitigations (Phase 2)

| Risk | Prob | Mitigation |
|------|------|-----------|
| REQ↔Phase reconciliation contentious | Low | CTO final call after 1h debate |
| Auditor unavailable Thu | Medium | Async email option + 48h window for call |
| DICQ/RDC interpretation conflict | Low | Escalate to auditor pre-call; defer ambiguous items to Phase 0 decision |
| Phase 0 scope creep (5th item added) | Medium | Phase 0 locked to 4 items + 8d budget at kickoff |

---

## Deliverables Checklist

- [ ] `.planning/milestones/v1.4-REQ-PHASE-MATRIX.md` (CTO signed)
- [ ] `.planning/milestones/v1.4-PHASE-0-PLAN.md` (QA Lead signed)
- [ ] `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md` (QA Lead + CTO signed)
- [ ] `.planning/milestones/v1.4-RDC-COVERAGE-MATRIX.md` (CTO signed)
- [ ] `.planning/milestones/v1.4-AUDITOR-ALIGNMENT-PLAN.md` (CTO + auditor email confirmation)
- [ ] `.planning/milestones/v1.4-RISK-REGISTER.md` v1.1 (CTO + QA Lead signed)
- [ ] CTO sign-off email (to all Stream Leads + team)

---

## Phase 3 Unblock Criteria

Phase 3 (Schema Prep, starts Mon 2026-05-13) requires **ALL** of:

1. ✅ REQ-PHASE-MATRIX.md published + CTO signed
2. ✅ PHASE-0-PLAN.md published + auditor consulted
3. ✅ DICQ-COVERAGE-MATRIX.md complete (no orphans)
4. ✅ RDC-COVERAGE-MATRIX.md published (≥95% mandatory coverage)
5. ✅ Auditor pre-alignment call complete + email confirmation
6. ✅ RISK-401, 403, 404 migrated to Mitigated + register versioned

**If any criterion not met by Fri EOD:** Phase 1 postponed 1 week; Phase 2 extended.

---

**Document Status:** READY FOR EXECUTION  
**Created:** 2026-05-07 (planning)  
**Owner:** CTO

---

**End of Phase 2 PLAN**
