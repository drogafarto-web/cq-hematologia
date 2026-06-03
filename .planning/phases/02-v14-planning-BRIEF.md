---
phase: 2
title: 'v1.4 Planning Deep-Dive — Requirements Lock & Dependency Matrix'
period: '2026-05-08 → 2026-05-10 (3 days, Week 2)'
owner: 'CTO + Stream Leads (A–D)'
objective: 'Finalize all v1.4 requirements, lock dependency graph, align auditor expectations, prep all streams for unblocked Wave 1 execution'
status: 'PLANNED'
gate: 'Phase 3 (Schema Prep) unblocked after all 6 tasks complete'
---

# Phase 2 BRIEF — v1.4 Planning Deep-Dive

**Strategic objective:** Eliminate all ambiguity in v1.4 scope, dependencies, compliance mapping, and auditor alignment before a single line of code is merged.

**Duration:** 3 days (2026-05-08 → 2026-05-10, Wed–Fri)  
**Owner:** CTO + Stream Leads (A–D, mandatory attendance)  
**Output:** 6 detailed artifacts + auditor pre-alignment call confirmed  
**Gate:** Phase 3 kickoff (2026-05-13, Monday) unblocked only if all 6 tasks complete and CTO signs off

---

## Context

v1.3 deployed 25 modules into production (78.5% DICQ baseline, RDC 978 100% for completed areas). v1.4 closes the DICQ gap (88–92% target) and completes RDC 978 Part 2 (NOTIVISA, critical values, documentation).

**Critical blocker identified in RISK-401:** REQUIREMENTS.md (Section 1) shows 16 REQ-IDs (REQ-401–416) with contradictory phase assignments vs. ROADMAP.md (15 phases). Before Week 2 execution starts, **Phase 2 must resolve this ambiguity** via dependency matrix.

**Secondary blocker identified in RISK-403:** ROADMAP identified 4 mandatory RDC 978 items NOT scheduled in any phase (supervisor registry, LGPD policy, lab-apoio contracts, risk mgmt skeleton). Phase 0 (Days 1–7, pre-Phase 1) must be created and locked before Phase 1 starts.

**Tertiary blocker identified in RISK-404:** 13 DICQ sub-blocks have no assigned REQ-ID or phase. Phase 2 must publish a DICQ coverage matrix assigning owner/decision for each.

---

## Success Criteria (All must be ✅)

1. **REQ↔Phase Matrix published & locked** — every REQ-401–416 assigned to exactly 1 phase (1–13) with no contradiction vs. ROADMAP sequencing
2. **Phase 0 created & approved** — 4 mandatory RDC items scheduled (Days 1–7, pre-Phase 1 kickoff)
3. **DICQ Coverage Matrix published** — all 40+ DICQ blocks assigned to phase or marked "already done v1.3" or "deferred v1.5"
4. **RDC 978 Gap Map finalized** — all critical & non-critical articles color-coded (green/yellow/red) with phase assignment
5. **Auditor pre-alignment call confirmed** — auditor verbally confirms: timeline, 12 CAPAs roadmap, RFI SLA (5 business days), weekly standing call
6. **Risk Register updated** — RISK-401, 403, 404 migrated to "Mitigated" status; Phase 0 risk added if needed

**Sign-off:** CTO reviews all 6 artifacts; issues written approval (email or PR) by EOD Friday 2026-05-10

---

## Phase 2 Tasks (6 total)

### Task 2.1 — REQ↔Phase Dependency Matrix (CTO, Stream A Lead)

**Objective:** Reconcile REQUIREMENTS.md (48 REQs) with ROADMAP.md (15 phases). Create canonical matrix: every REQ-ID → phase + dependencies + criticality.

**Inputs:**

- `.planning/milestones/v1.4-REQUIREMENTS.md` (Section 1: REQ-401–416; Section 2: v2 parking lot)
- `.planning/milestones/v1.4-ROADMAP.md` (Phase 1–13 + Phase 0 implicit)
- `.planning/milestones/v1.4-RISK-REGISTER.md` (RISK-401 context)

**Deliverable:** `.planning/milestones/v1.4-REQ-PHASE-MATRIX.md`

**Structure:**

```
## Section 1: REQ↔Phase Mapping Table

| REQ-ID | Title | Phase | Wave | Duration (pts) | Dependencies | Criticality | Notes |
|--------|-------|-------|------|---------------|--------------|-------------|-------|
| REQ-401 | KPI Dashboarding | Phase 1 | Wave 1 | 18 pts | — | Should | V1.3 KPI partial |
| ... | ... | ... | ... | ... | ... | ... | ... |
```

**Acceptance criteria:**

- ✅ All 16 REQ-IDs assigned to exactly 1 phase (no duplicates)
- ✅ No phase assignment contradicts ROADMAP sequencing (e.g., REQ that requires Phase 3 schema not assigned before Phase 3)
- ✅ Dependencies shown as REQ-IDs or phase prerequisites
- ✅ Criticality: Must-Have / Should-Have / Nice-to-Have (per REQUIREMENTS Section 5)
- ✅ Wave assignment (1–4) matches ROADMAP timeline
- ✅ Effort estimates (story points) sum to ~160–190 for Must-Have set
- ✅ CTO sign-off

**Owner:** CTO (primary), Stream A Lead (review)  
**Effort:** 8–10 pts  
**Timeline:** Wed 2026-05-08, 09:00–13:00 BRT

---

### Task 2.2 — Phase 0 Creation & Lock (QA Lead, Stream A Lead)

**Objective:** Formalize Phase 0 (Days 1–7, pre-Phase 1) addressing RISK-403: 4 mandatory RDC items.

**Items (from RISK-403):**

1. Supervisor presencial registry (RDC 978 Art. 122) — form + shift calendar integration
2. LGPD formal policy + acceptance tracking (RDC 978 Art. 77) — SGD versioned doc
3. Lab Apoio contracts management (RDC 978 Arts. 36–39) — contract registry + alerts
4. Risk management module skeleton (DICQ 4.14.6) — risk matrix + control tracking

**Deliverable:** `.planning/milestones/v1.4-PHASE-0-PLAN.md`

**Structure:**

```
# Phase 0 — Mandatory RDC 978 Blockers (Days 1–7, Pre-Phase 1)

## Item 1: Supervisor Presencial Registry (Art. 122)
- Acceptance criteria: [...]
- Effort: 2d
- Owner: [Stream + engineer]
- Acceptance: [...test criteria...]

## Item 2: LGPD Policy (Art. 77)
- ...

## Item 3: Lab Apoio Contracts (Arts. 36–39)
- ...

## Item 4: Risk Management Skeleton (DICQ 4.14.6)
- ...

## Phase 0 Timeline & Blockers
- Day 1: kickoff + Supervisor form design
- Day 2: Supervisor form code + LGPD policy doc draft
- Day 3: LGPD acceptance tracking + Lab Apoio template
- Day 4: Risk matrix skeleton + testing all 4
- Day 5–6: refinements + auditor review
- Day 7: sign-off; Phase 0 complete, Phase 1 unblocked
```

**Acceptance criteria:**

- ✅ All 4 items have clear acceptance criteria
- ✅ Effort estimate per item ≤2 days (total ≤8 days, fits in Week 1)
- ✅ Phase 0 is explicitly shown as blocking Phase 1 kickoff
- ✅ Auditor consulted (async email or pre-alignment call) confirming scope
- ✅ QA Lead sign-off

**Owner:** QA Lead (primary), Stream A Lead (review)  
**Effort:** 6–8 pts  
**Timeline:** Wed 2026-05-08, afternoon

---

### Task 2.3 — DICQ Coverage Matrix (QA Lead)

**Objective:** Map all 40+ DICQ blocks (per `.planning/milestones/v1.4-AUDIT-REPORT.md` or Obsidian checklist) to phase assignment or explicit deferral decision.

**Deliverable:** `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md`

**Structure:**

```
# DICQ Coverage Matrix (v1.4 Planning)

| DICQ Block | v1.3 Status | v1.4 Phase | REQ-ID | Status | Owner | Notes |
|------------|-------------|-----------|--------|--------|-------|-------|
| 4.1.1.2 Pessoa Jurídica (CNES) | Partial | Phase 0 | — | Admin doc | QA Lead | governance |
| 4.1.2.3 Política Qualidade | Partial | Phase 1 | REQ-411 | Drafting | CTO | LGPD integration |
| 4.15 Análise Crítica | Missing | Phase 3 | REQ-413 | Planned | CTO | v1.4 must-have |
| ... | ... | ... | ... | ... | ... | ... |
| (deferred items) | — | v1.5 | — | Decision | — | Rationale: [...] |
```

**Acceptance criteria:**

- ✅ All 40+ DICQ blocks listed
- ✅ Each block: v1.3 status (Missing / Partial / Done) → v1.4 status (Closed / In-Phase / Deferred)
- ✅ Deferred items explicitly documented with rationale + v1.5 commitment
- ✅ Mapping to Phase and/or REQ-ID (if applicable)
- ✅ Owner assigned per block
- ✅ QA Lead + CTO sign-off
- ✅ Target: ≥35 blocks resolved by end of v1.4 (88%+ compliance)

**Owner:** QA Lead (primary), CTO (review)  
**Effort:** 10–12 pts  
**Timeline:** Wed–Thu 2026-05-08 to 2026-05-09

---

### Task 2.4 — RDC 978 Gap Analysis & Article Mapping (QA Lead, CTO)

**Objective:** Color-code all RDC 978 articles (critical + non-critical) with phase assignment. Target: 100% coverage of Arts. 117, 167, 179-191, 204 (mandatory) + full map of 50+ articles.

**Deliverable:** `.planning/milestones/v1.4-RDC-COVERAGE-MATRIX.md`

**Structure:**

```
# RDC 978 Compliance Matrix (v1.4)

| Article | Requisite | Mandatory? | v1.3 Baseline | v1.4 Phase | REQ-ID | Status | Owner |
|---------|-----------|-----------|--------------|-----------|--------|--------|-------|
| 66 | Notificação Sanitária (Vigilância) | Critical | Missing | Phase 8 | REQ-410 | 🟡 Planned | Stream A |
| 77 | LGPD Policy | Critical | Missing | Phase 0 | — | 🟡 Planned | CTO |
| 86 | PGQ (6 componentes) | Critical | 80% | Phases 1–2, 4–9 | Multiple | 🟡 In-Progress | Multiple |
| 115 | Retenção 5 anos | Critical | 70% | Phase 3 | REQ-415 | 🟡 Planned | Stream A |
| 117 | Documentos Obrigatórios | Critical | 60% | Phase 1–2 | REQ-402, 403 | 🟡 Planned | Multiple |
| 122–127 | Pessoal (RT + Supervisor) | Critical | 40% | Phase 0–1 | REQ-403 | 🟡 Planned | Stream A |
| 128–131 | Rastreabilidade | Critical | 30% | Phase 2 | REQ-404 | 🟡 Planned | Stream B |
| 167 | Laudo (14 campos) | Critical | 50% | Phase 3 | REQ-415 | 🟡 Planned | Stream A |
| 176, V | CEQ Annual Report | Critical | 20% | Phase 2 | REQ-409 | 🟡 Planned | Stream A |
| 179–191 | CIQ + CEQ obrigatório | Critical | 100% | v1.3 ✓ | — | 🟢 Done | — |
| ... | ... | ... | ... | ... | ... | ... | ... |
```

**Acceptance criteria:**

- ✅ All mandatory articles (117, 167, 179-191, 204) show 🟢 or 🟡 status (no 🔴 red)
- ✅ Non-mandatory articles mapped but can be 🔴 deferred
- ✅ v1.3 baseline % vs. v1.4 phase target shown
- ✅ REQ-ID linkage (if applicable)
- ✅ Owner per article or group
- ✅ CTO + QA Lead sign-off
- ✅ Target: ≥95% mandatory articles at 🟢 or 🟡 (no red)

**Owner:** QA Lead (primary), CTO (final review)  
**Effort:** 8–10 pts  
**Timeline:** Thu 2026-05-09, morning

---

### Task 2.5 — Auditor Pre-Alignment Call & Sign-Off (CTO, QA Lead)

**Objective:** Align with external auditor on v1.4 timeline, CAPA roadmap (Phase 4), RFI SLA, weekly standing call, and confirm compliance interpretation.

**Deliverable:**

- Email confirmation (from auditor) of agreed timeline + SLA + interpretations
- `v1.4-AUDITOR-ALIGNMENT-PLAN.md` (internal doc summarizing call outcomes)

**Call Agenda (60 min, async or sync):**

1. (5 min) v1.4 timeline: Phase 0–13, May 7 → Sep 30 (22 weeks)
2. (10 min) Phase 4 CAPA roadmap: 12 CAPAs, expected closure date (early Aug), evidence requirements
3. (10 min) RFI SLA: 5 business day target per CAPA + weekly standing call (Fridays, 30 min, async option available)
4. (10 min) Compliance interpretation: discuss ambiguous items (DICQ 4.15 "analysis" format, RDC 122 "supervisor presencial", etc.)
5. (10 min) Pre-audit window: tentative external audit date (early Oct) + sign-off timeline
6. (10 min) Questions + commitments
7. (5 min) Next steps: weekly standing call starts Week 3 (Fri 2026-05-17)

**Deliverable: v1.4-AUDITOR-ALIGNMENT-PLAN.md**

```
# v1.4 Auditor Alignment — Outcomes

**Call Date:** 2026-05-09 (Thursday, 15:00 BRT)
**Attendees:** CTO, QA Lead, Auditor [Name]

## Agreed Timelines
- v1.4 Phase 0–13: 2026-05-07 → 2026-09-30 (22 weeks)
- Phase 4 CAPA closure: expected 2026-07-25
- Phase 13 final audit dry-run: week of 2026-09-01
- External audit: tentative 2026-10-15 (6-week post-launch buffer)

## RFI SLA Agreement
- Target response time per auditor RFI: 5 business days
- Escalation: after 7 days, CTO override scheduling
- Weekly standing call: Fridays, 30 min, asynch option if needed
- First call: 2026-05-17 (Friday)

## Compliance Interpretations Locked
- DICQ 4.15 "management review": annual meeting with documented 15 inputs (format confirmed)
- RDC 122 "supervisor presencial": shift registry with supervisor name + date/time (not just policy)
- RDC 77 "formal LGPD policy": versioned document in SGD with employee acceptance log

## Sign-Off Checkpoint
- Auditor confirms "v1.4 timeline reasonable" ✅
- Auditor confirms "no blockers in current plan" ✅
- Auditor confirms "willing to review pre-audit checklist Week 18" ✅

**Next:** Weekly standing call starts 2026-05-17
```

**Acceptance criteria:**

- ✅ Auditor verbal confirmation (recorded or emailed) of 3 items: timeline, CAPA roadmap, RFI SLA
- ✅ Compliance interpretations documented + auditor confirms reading (email reply)
- ✅ Weekly standing call confirmed for Fridays 2026-05-17 onwards
- ✅ Internal alignment memo published by EOD Thu 2026-05-09

**Owner:** CTO (primary), QA Lead (support)  
**Effort:** 4–6 pts (mostly async coordination)  
**Timeline:** Thu 2026-05-09, afternoon

---

### Task 2.6 — Risk Register Mitigation Review (CTO, QA Lead)

**Objective:** Migrate RISK-401 (REQ↔Phase inconsistency), RISK-403 (4 RDC blockers), and RISK-404 (13 DICQ orphans) from Active → Mitigated status based on Phase 2 artifact outputs.

**Process:**

1. **RISK-401 → Mitigated:** REQ-PHASE-MATRIX.md (Task 2.1) published, CTO signed
2. **RISK-403 → Mitigated:** PHASE-0-PLAN.md (Task 2.2) published, QA Lead signed
3. **RISK-404 → Mitigated:** DICQ-COVERAGE-MATRIX.md (Task 2.3) published, all 13 orphans assigned
4. **New risks added:** If Phase 0 or subsequent planning surfaces new risks, add to register (e.g., RISK-420 if Phase 0 scope creep identified)

**Deliverable:** Updated `.planning/milestones/v1.4-RISK-REGISTER.md` with status transitions

**Acceptance criteria:**

- ✅ RISK-401, 403, 404 status changed from Active → Mitigated (with date + evidence link)
- ✅ All other 🟡 / 🟢 risks reviewed (status unchanged or new risks added)
- ✅ Risk register versioning updated (e.g., v1.1, dated 2026-05-10)
- ✅ CTO + QA Lead sign-off

**Owner:** CTO (primary), QA Lead (review)  
**Effort:** 4–5 pts  
**Timeline:** Fri 2026-05-10, morning

---

## Phase 2 Timeline

| Date       | Day | Task                           | Owner             | Duration | Deliverable                    |
| ---------- | --- | ------------------------------ | ----------------- | -------- | ------------------------------ |
| 2026-05-08 | Wed | 2.1 REQ↔Phase Matrix           | CTO, Stream A     | 4h       | v1.4-REQ-PHASE-MATRIX.md       |
| 2026-05-08 | Wed | 2.2 Phase 0 Plan (afternoon)   | QA Lead, Stream A | 3h       | v1.4-PHASE-0-PLAN.md           |
| 2026-05-09 | Thu | 2.3 DICQ Coverage Matrix       | QA Lead           | 6h       | v1.4-DICQ-COVERAGE-MATRIX.md   |
| 2026-05-09 | Thu | 2.4 RDC Gap Analysis           | QA Lead, CTO      | 4h       | v1.4-RDC-COVERAGE-MATRIX.md    |
| 2026-05-09 | Thu | 2.5 Auditor Call (afternoon)   | CTO, QA Lead      | 1.5h     | v1.4-AUDITOR-ALIGNMENT-PLAN.md |
| 2026-05-10 | Fri | 2.6 Risk Register Update       | CTO, QA Lead      | 2h       | Updated v1.4-RISK-REGISTER.md  |
| 2026-05-10 | Fri | CTO Sign-Off (all 6 artifacts) | CTO               | 0.5h     | Email approval                 |

**Total effort:** 20.5 hours (3 days, 4 people)

---

## Phase 2 Gate Criteria (Phase 3 Unblock)

Phase 3 (Schema Prep) may **not** kick off before all of the following are met:

1. ✅ REQ-PHASE-MATRIX.md published + CTO signed (no REQ assignments contradicting ROADMAP)
2. ✅ PHASE-0-PLAN.md approved by QA Lead + auditor consulted (4 RDC items assigned to Days 1–7)
3. ✅ DICQ-COVERAGE-MATRIX.md complete (all 40+ blocks assigned or deferred with rationale)
4. ✅ RDC-COVERAGE-MATRIX.md shows ≥95% mandatory articles at green/yellow (no red critical articles)
5. ✅ Auditor pre-alignment call completed + email confirmation received (timeline, SLA, interpretations)
6. ✅ RISK-401, 403, 404 migrated to Mitigated + register versioned

**CTO Sign-Off:** Written approval (email or PR comment) by EOD Fri 2026-05-10 required before Monday 2026-05-13 Phase 1 kickoff.

If any gate criterion not met by EOD Friday, Phase 1 postponed to following Monday; Phase 2 extended through following week until all gates closed.

---

## Risks & Mitigations (Phase 2 Specific)

| Risk                                                     | Probability | Mitigation                                                                |
| -------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| REQ↔Phase reconciliation contentious                     | Low         | CTO final call if consensus not reached in 1h of Task 2.1                 |
| Auditor unavailable Thu for pre-call                     | Medium      | Async email confirmation option; call scheduled within 48h                |
| DICQ/RDC interpretation conflict emerges during Task 2.4 | Low         | Defer ambiguous items to Phase 0 decision or escalate to auditor pre-call |
| Phase 0 scope creep (5th RDC item added mid-discussion)  | Medium      | Phase 0 locked to 4 items + 8-day budget at kickoff                       |

---

## Artifacts Checklist

All Phase 2 artifacts stored in `.planning/milestones/`:

- [ ] `v1.4-REQ-PHASE-MATRIX.md`
- [ ] `v1.4-PHASE-0-PLAN.md`
- [ ] `v1.4-DICQ-COVERAGE-MATRIX.md`
- [ ] `v1.4-RDC-COVERAGE-MATRIX.md`
- [ ] `v1.4-AUDITOR-ALIGNMENT-PLAN.md`
- [ ] `v1.4-RISK-REGISTER.md` (updated with status transitions)

**CTO sign-off email:** Include all 6 artifact links + explicit "Phase 3 unblocked" statement

---

## Success Outcome

At end of Phase 2 (EOD Friday 2026-05-10):

- All 4 streams (A–D) have **unambiguous scope** for Wave 1 execution
- **Zero REQ↔Phase contradictions** remain
- **Phase 0 locked** (4 RDC items, 7 days, Days 1–7 of Week 1)
- **Phase 1 start date confirmed** (Monday 2026-05-13)
- **Auditor aligned** (timeline, SLA, interpretations in writing)
- **Risk mitigation plan active** (RISK-401, 403, 404 mitigated; weekly review Monday 2026-05-13)

**Next:** Phase 1 Kickoff (Mon 2026-05-13) — v1.3 Stabilization & Phase 0 RDC Blockers

---

**Document Status:** BRIEF (planning document)  
**Created:** 2026-05-07  
**Owner:** CTO  
**Approval:** Pending execution

---

**End of Phase 2 BRIEF**
