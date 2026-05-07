---
title: v1.4 Gate Dependency Map
created: 2026-05-07
version: 1.0
purpose: Visual reference for gate blocking relationships and parallel execution windows
---

# v1.4 Gate Dependency Map

## Complete Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 0–3 (✅ COMPLETE 2026-05-07)                                      │
│ ├─ Phase 0: RDC Blockers (turnos, DPIA, lab-apoio, risks)               │
│ ├─ Phase 1: Baseline verification (19/19 smoke tests)                    │
│ ├─ Phase 2: Planning deep-dive (roadmap + compliance matrix)             │
│ └─ Phase 3: Schema extensions (5 collections, 50 callables)              │
└─────────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 4–7 PARALLEL (2026-05-20 → 2026-07-28)                            │
│ ┌───────────────────────────────────────────────────────────────────┐    │
│ │ Phase 4: Portal Auth + NOTIVISA Integration (2.5 weeks)           │    │
│ │ ├─ Task 04-01: Portal auth callable (RT login)                    │    │
│ │ ├─ Task 04-02: Portal UI components (WCAG AA dark-first)          │    │
│ │ ├─ Task 04-03: NOTIVISA queue processor                           │    │
│ │ └─ Task 04-04: E2E testing + Cloud Logs                           │    │
│ │ Deploy: 2026-06-02                                                 │    │
│ │ Risk: 3.5/10 (LOW)                                                 │    │
│ └───────────────────────────────────────────────────────────────────┘    │
│    │                                                                       │
│    ├──────────────────────────────┬──────────────────────────────┐       │
│    ↓                              ↓                              ↓       │
│ ┌────────────────────────┐  ┌──────────────────────┐  ┌──────────────┐ │
│ │ Phase 5: Critical +    │  │ Phase 6: Liberação   │  │ Phase 7:     │ │
│ │ IA (3 weeks)           │  │ + Críticos (2 weeks) │  │ Feedback +   │ │
│ │ Deploy: 2026-06-30     │  │ Deploy: 2026-07-14   │  │ Portal Pac.  │ │
│ │ Risk: 3/10 (LOW)       │  │ Risk: 2.5/10 (VERY)  │  │ Deploy:      │ │
│ │                        │  │                      │  │ 2026-07-28   │ │
│ │ UNBLOCKS: Phase 7, 9   │  │ UNBLOCKS: none       │  │ Risk: 3/10   │ │
│ └────────────────────────┘  └──────────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                           │
         └────────┬───────────┴───────────────────────────┘
                  ↓
         ┌────────────────────────┐
         │ WAVE 1 GATE            │
         │ (2026-06-02)           │
         │ ✓ All 4 phases PASS    │
         │ ✓ 32/32 E2E flows     │
         │ ✓ 0 critical blockers │
         └────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 8 (CAPA) — CRITICAL PATH (2026-06-15 → 2026-08-05)               │
│ ├─ F-01: Turnos auditável (RDC 978 Art. 122)                            │
│ ├─ F-02: DPIA incompleto (RDC 978 Art. 77)                              │
│ ├─ F-03: Lab-apoio contracts (RDC 978 Arts. 36–39)                      │
│ ├─ F-04: Risks FMEA-lite (RDC 978 Art. 86)                              │
│ ├─ F-05: Management-review (RDC 978 Art. 5.3)                           │
│ ├─ F-06: Document distribution (DICQ 4.3)                               │
│ └─ F-07: Rastreabilidade (DICQ 4.4)                                     │
│ Risk: 5/10 (MEDIUM — auditor dependent)                                 │
│ Auditor Ceremony: 2026-08-05 (Week 4 MUST hit deadline)                │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────┬─────────────────────┐
         ↓                                     ↓                     ↓
   ┌─────────────────┐              ┌──────────────────┐    ┌────────────────┐
   │ Phase 9: KPI    │              │ Phase 10: Pen-   │    │ Phase 11:      │
   │ Optimization    │              │ test (Parallel   │    │ Auditor Align  │
   │ (2 weeks)       │              │ Phase 4-5, repo  │    │ (8 weeks,      │
   │ Deploy:         │              │ due 2026-06-21)  │    │ weekly cadence) │
   │ 2026-08-04      │              │ Remediation:     │    │ Deploy:        │
   │ Risk: 2/10      │              │ 2026-07-04       │    │ 2026-08-05     │
   │                 │              │ Risk: 3/10       │    │ Risk: 4/10     │
   │ UNBLOCKS: none  │              │ UNBLOCKS: Wave 2 │    │ UNBLOCKS: W2,3 │
   └─────────────────┘              └──────────────────┘    └────────────────┘
         │
         └──────────────────────────────────────┬──────────────────┐
                                                ↓                  ↓
                                           ┌──────────────┐  ┌───────────────┐
                                           │ Phase 12:    │  │ (no additional)
                                           │ Test Data +  │
                                           │ Riopomba Val │
                                           │ (4 days)     │
                                           │ Deploy:      │
                                           │ 2026-08-02   │
                                           │ Risk: 2/10   │
                                           │ UNBLOCKS: W2 │
                                           └──────────────┘
                  │
                  └────────────────────┐
                                       ↓
                              ┌────────────────────┐
                              │ WAVE 2 GATE        │
                              │ (2026-08-31)       │
                              │ ✓ Phases 8-12 PASS │
                              │ ✓ 32/32 E2E       │
                              │ ✓ CAPA auditor OK  │
                              │ ✓ Pen-test <3 med  │
                              └────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 13–15 SEQUENTIAL (2026-08-12 → 2026-11-30)                        │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ Phase 13: Multi-Tenant Expansion (7 weeks, 2026-08-12–2026-09-30)  │  │
│ │ ├─ Mercês lab onboarding                                            │  │
│ │ ├─ Tabuleiro lab onboarding                                         │  │
│ │ └─ Cross-lab isolation verification                                 │  │
│ │ Risk: 3/10 (LOW)                                                    │  │
│ │ UNBLOCKS: Phase 14                                                  │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                       ↓                                   │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ Phase 14: ISO 15189 Formal Certification (9 weeks, 2026-09-01...) │  │
│ │ ├─ 120-point audit checklist                                        │  │
│ │ ├─ Internal audit (independent auditor)                             │  │
│ │ ├─ Compliance artifact completion                                   │  │
│ │ └─ Audit trail polish (chain-hash verification)                     │  │
│ │ Risk: 4/10 (MEDIUM — compliance audit)                              │  │
│ │ Deploy: 2026-10-31                                                  │  │
│ │ UNBLOCKS: Phase 15                                                  │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                       ↓                                   │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ Phase 15: v2 Planning (6 weeks, design-only, 2026-10-15–11-30)    │  │
│ │ ├─ HL7 FHIR export planning (RFC + ADR)                             │  │
│ │ ├─ AI Lab Autonomy planning (RFC + ADR)                             │  │
│ │ └─ v2 Roadmap artifact (Phases 16+)                                 │  │
│ │ Risk: 1/10 (VERY LOW — planning only)                               │  │
│ │ UNBLOCKS: v2.0 kickoff (Q1 2027)                                    │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    └─────────────────────────────┬────────────────┐
                                                  ↓                ↓
                                           ┌──────────────────┐ (Phase 15
                                           │ WAVE 3 GATE      │  overlaps)
                                           │ (2026-11-30)     │
                                           │ ✓ Phases 13-15   │
                                           │ ✓ DICQ ≥88%      │
                                           │ ✓ Audit trail OK │
                                           └──────────────────┘
                                                  ↓
                                           ┌──────────────────┐
                                           │ GO-LIVE GATE     │
                                           │ (2026-08-31      │
                                           │ external audit)  │
                                           │ ✓ 19/19 smoke    │
                                           │ ✓ CTO approval   │
                                           │ ✓ Auditor align  │
                                           └──────────────────┘
```

---

## Parallel Execution Windows

### Window 1: Phases 4–7 + Phase 10 (May 20 → Jul 28, 10 weeks)

**Independent phases (no blocking):**
- Phase 4 must complete first (portal auth foundation)
- Phase 5 depends Phase 4 PASS (critical escalation needs portal)
- Phase 6 **partially** depends Phase 4 (v1.3 Phase 10 foundation exists)
- Phase 7 depends Phase 4 (feedback portal needs auth)
- Phase 10 parallel (penetration test — independent consultant)

**Timeline:**
- Phase 4: May 20–Jun 2 (CRITICAL — gates all downstream)
- Phase 5: Jun 9–Jun 30 (blocked by Phase 4 PASS on 2026-06-02)
- Phase 6: Jul 1–Jul 14 (independent, non-critical path)
- Phase 7: Jul 8–Jul 28 (independent, non-critical path)
- Phase 10: Jun 1–Jun 21 (report), remediation Jul 1–Jul 4 (parallel Phase 6)

**Resource allocation:**
- 4 agents on Phase 4 (critical)
- 4 agents on Phase 5 (high priority)
- 2 agents on Phase 6 + Phase 7 (shared, low priority)
- 1 external consultant on Phase 10 (dedicated)

### Window 2: Phase 8 + Phase 9 + Phase 11 + Phase 12 (Jun 15 → Aug 5, 7 weeks)

**Phase 8 is CRITICAL PATH; others dependent or parallel:**
- Phase 8 CAPA: Jun 15–Aug 5 (auditor-driven, hard deadline 2026-08-05)
- Phase 9 KPI: Jul 22–Aug 4 (depends Phase 5 data + Phase 8 start)
- Phase 11 Auditor: Jun 1–Aug 5 (weekly meetings, parallel all phases)
- Phase 12 Test data: Jul 29–Aug 2 (depends Phase 8 CAPA completion)

**Timeline:**
- Phase 8 Week 1–2 (Jun 15–29): F-01 → F-04 implementation
- Phase 8 Week 3 (Jul 6–12): CTO + auditor prep (F-05 → F-06)
- Phase 8 Week 4 (Jul 13–20): Auditor ceremony (F-07 final sign-off)

**Auditor ceremony timeline (non-negotiable):**
- 2026-08-05: HARD DEADLINE for CAPA closure
- 3-week buffer before external audit (2026-08-31)
- If Phase 8 slips past 2026-08-05 → external audit at risk

**Resource allocation:**
- CTO + Eng A–D full-time on Phase 8 (4–5 people)
- 2 agents on Phase 9 (lower priority, post-Phase 5)
- CTO + Auditor weekly Phase 11 (coordination, not code)
- QA + Eng on Phase 12 (4 days, light team)

### Window 3: Phases 13–15 Sequential (Aug 12 → Nov 30, 16 weeks)

**Hard dependency chain:**
- Phase 13 starts: Aug 12 (depends Wave 2 PASS)
- Phase 14 starts: Sep 1 (depends Phase 13 PASS)
- Phase 15 starts: Oct 15 (depends Phase 14 PASS)

**Timeline:**
- Phase 13: Aug 12–Sep 30 (7 weeks)
- Phase 14: Sep 1–Oct 31 (9 weeks)
  - Phase 13 + 14 overlap Sep 1–Sep 30 (3 weeks, light overlap)
- Phase 15: Oct 15–Nov 30 (6 weeks)
  - Phase 14 + 15 overlap Oct 15–Oct 31 (2 weeks, light overlap)

**Resource allocation:**
- 2–3 agents per phase (sequential handoff)
- CTO involved Phase 14 (internal audit coordination) + Phase 15 (planning)

---

## Critical Path Bottlenecks

### Most Dangerous Gates (Single-Point Failure)

| Gate | Risk | Dependency | Mitigation |
|---|---|---|---|
| **Phase 4** | Hard blocker for Phases 5–7 | Portal auth + NOTIVISA | Start May 20; 1-week buffer built in |
| **Phase 8** | Hard blocker for Wave 2 + external audit | CAPA auditor sign-off (2026-08-05) | Weekly auditor alignment; artifacts pre-drafted |
| **Phase 12** | Blocks Wave 2 gate decision | Riopomba validation + smoke tests | Automate test data generation; parallel with Phase 9 |
| **Wave 2 Gate** | Unblocks Phase 13 (multi-tenant) | All Phases 8–12 PASS | No buffers available; must hit 2026-08-31 |

### Cascading Failure Scenarios

#### Scenario A: Phase 4 misses 2026-06-02 deadline

**Impact chain:**
- Phase 4 misses deadline by 1 week → 2026-06-09
- Phase 5 pushed to Jun 16–Jul 7 (1 week delay)
- Phase 6 pushed to Jul 8–Jul 21 (1 week delay)
- Phase 7 pushed to Jul 15–Aug 4 (1 week delay)
- Wave 1 gate pushed to Jun 9 (soft miss, non-blocking)
- Phase 5 completion misses Phase 9 data dependency → Phase 9 extends

**Recovery strategy:**
- Extend timeline 1 week total (phase 4 slip = 1 phase slip)
- Phases 6–7 are non-critical; can compress if needed
- Target: Phase 5 PASS by Jun 30 (hard requirement for Phase 9)

#### Scenario B: Phase 8 CAPA slips past 2026-08-05 auditor deadline

**Impact chain:**
- CAPA ceremony reschedules → external audit cannot start 2026-08-31
- v1.4 release delayed minimum 2 weeks (auditor feedback cycle)
- Go-Live gate missed; external audit pushed to Sep 30 (best case)
- Wave 2 gate fails (blocker: auditor sign-off incomplete)

**Recovery strategy:**
- This is CRITICAL PATH. No recovery without external auditor agreement
- Built-in 3-week buffer before audit (May 7 → Aug 31) specifically to prevent this
- If Phase 8 at risk by Jul 20 → escalate to CTO + external auditor immediately
- Options: compress Phase 14–15 scope, defer non-critical findings, extend audit window

#### Scenario C: Phase 14 ISO audit finds >10 major findings

**Impact chain:**
- Internal audit fails; remediation extends Phase 14 by 4+ weeks
- Phase 15 v2 planning pushed to Q1 2027
- Go-Live gate delayed (external audit cannot proceed without internal audit clean)

**Recovery strategy:**
- Mitigate via Phase 14 preparation (pre-audit gap analysis by Sep 1)
- If major findings predicted → re-scope Phase 14 (defer non-critical artifacts)
- Engage external ISO auditor as advisor during Phase 14 (proactive feedback)

---

## Concurrency Constraints

### Human Resource Bottleneck

**CTO is involved in 6 gates directly:**
1. Phase 4 sign-off
2. Phase 8 (CAPA closure — full-time)
3. Phase 11 (auditor alignment — 2h/week)
4. Wave 1 approval
5. Wave 2 approval (auditor alignment)
6. Go-Live final decision

**Implication:** CTO is bottleneck if Phase 8 overlaps with critical Phase 4 decisions. **Mitigation:** Delegate Phase 4 sign-off to Tech Lead (CTO reviews, but Tech Lead leads validation).

### External Auditor Bottleneck

**Auditor involved in:**
1. Phase 11 (weekly meetings 8×, 8 hours total)
2. Phase 8 (CAPA ceremony, 20 hours)
3. Wave 2 gate sign-off
4. Wave 3 gate sign-off
5. Go-Live pre-audit alignment

**Implication:** Auditor calendar risk if Phase 8 CAPA slips. **Mitigation:** Lock auditor availability on calendar 3 months in advance (Jun 1 → Aug 31).

---

## Gate Validation Sequencing (Strict Order)

```
Phase 0 ✅ PASS
  ↓ (unblock)
Phase 1 ✅ PASS
  ↓ (unblock)
Phase 2 ✅ PASS
  ↓ (unblock)
Phase 3 ✅ PASS
  ↓ (unblock)
Phase 4 ← MUST PASS by 2026-06-02
  ├→ Phase 5 ← depends 4
  ├→ Phase 6 (partial)
  ├→ Phase 7 (depends 4)
  └→ Phase 10 (parallel, independent)
         ↓
      WAVE 1 GATE (Jun 2) ← depends 4, 5, 6, 7
         ↓
  Phase 8 ← MUST START Jun 15, PASS by 2026-08-05
         ├→ Phase 9 (depends 5 + 8)
         ├→ Phase 11 (parallel, depends 0-3)
         └→ Phase 12 (depends 8)
              ↓
           WAVE 2 GATE (Aug 31) ← depends 8, 9, 12 + auditor
              ↓
       Phase 13 ← MUST PASS by 2026-09-30
              ↓
       Phase 14 ← MUST PASS by 2026-10-31
              ↓
       Phase 15 ← MUST PASS by 2026-11-30
              ↓
           WAVE 3 GATE (Nov 30)
              ↓
         GO-LIVE GATE (Aug 31 external audit)
```

---

## Parallel Resource Gantt (16-Week Timeline)

```
Week    Phase 4   Phase 5   Phase 6   Phase 7   Phase 8   Phase 9   Phase 10  Phase 11  Phase 12  Phase 13  Phase 14  Phase 15
------- --------- --------- --------- --------- --------- --------- --------- --------- --------- --------- --------- ---------
1-2     [====]                                                       [====]    [X]
        5/20-6/2                                                     6/1-6/21  weekly
3       Gate W1   [====]                                  [start]    [remedial][X]
        6/2       6/9-6/30           6/15                6/21       7/1-7/4   weekly
4                 [====]    [====]    [start]   [====]              [X]
                  thru 6/30  6/22-7/14 7/8      ongoing    thru    weekly
5-6                         [====]    [====]    [====]    [====]    [X]
                           7/14       7/28      ongoing   7/22-8/4  weekly
7       Gate W1    Gate      Gate      Gate      [====]    Gate      remedial  Gate      [start]
        2-6-02     6-30      7-14      7-28      ongoing   8-4       done      8-5       7/29-8/2
8                                              [CAPA]    [====]    [====]    Gate      [====]
                                                         8-4       ongoing   WAVE 2    thru 8-2
                                                                            8-31
9                                              [===]     [final]           [start]
                                               cere      week8              8-12
10                                             [sign]    done
                                               8-5
11-16                                                                        [========]
                                                                             13: 8-12-9-30
                                                                             14: 9-1-10-31
                                                                             15: 10-15-11-30
                                                                             W3/Go-Live: 11-30-8-31
```

**Legend:**
- `[====]` = Phase active (development)
- `[XXXX]` = Gate validation window
- `[start]` = Phase kickoff
- `[sign]` = Auditor ceremony / sign-off
- `[gate]` = Gate decision point
- `weekly` = Recurring meeting (Phase 11)
- `ongoing` = Background coordination

---

## Risk Escalation Flow

```
Phase Executor Detects Issue (Day 1)
                ↓
    Tech Lead + QA Lead Review (same day)
                ↓
        CTO Notified (Day 1 EOD)
        ├─ Blocker: <24h resolution attempt
        ├─ Warning: <48h resolution target
        └─ Info: document + track
                ↓
    If Unresolved >48h:
                ├─ Wave Coordinator alerted
                ├─ Decision: extend phase OR defer scope
                └─ Escalate to executive (if critical path)
                ↓
    If Auditor-Related (Phase 8, 11):
                ├─ CTO + Auditor sync (same day)
                ├─ Artifact remediation priority
                └─ Escalate to external auditor if needed
```

---

## Success Criteria Summary

| Level | Condition | Owner | Gate |
|---|---|---|---|
| **Phase-level** | ✓ All 13 core checklist items PASS | Phase executor + CTO | Phase gate |
| **Wave-level** | ✓ All child phases PASS + E2E 100% | Wave coordinator + CTO | Wave gate |
| **Campaign-level** | ✓ All 4 wave gates + external audit | CTO | Go-Live gate |
| **Go-Live** | ✓ 19/19 gates + auditor alignment + CTO sign-off | CTO + External auditor | PRODUCTION |

---

**Map Created:** 2026-05-07  
**Next Update:** 2026-05-20 (Phase 4 kickoff)
