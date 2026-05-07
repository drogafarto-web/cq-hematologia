---
artifact: Phase 4 Contingency Timeline
status: ACTIVE
created: 2026-05-07
owner: CTO
review_cadence: Weekly (Monday 09:30 BRT)
auditor_deadline: 2026-08-31
phase4_baseline: 2026-06-02
---

# Phase 4 Contingency Timeline — Risk Mitigation Plan

**Status:** ACTIVE  
**Auditor Deadline:** 2026-08-31 (external audit + CAPA closure)  
**Phase 4 Baseline Deploy:** 2026-06-02 (2.5-week sprint, May 20 → Jun 2)  
**Baseline DICQ Target:** 85% (+6.5 points from v1.3's 78.5%)  
**Baseline RDC 978 Target:** 100% critical articles (Arts. 6, 115–117, 167, 204)

---

## Executive Summary

Phase 4 (Portal Auth + NOTIVISA Integration) is **critical path**. It gates Phase 5 (escalation + IA dataset) and Phase 8 (CAPA closure). Delays cascade to all downstream phases, risking audit readiness deadline (2026-08-31).

This document defines **three contingency scenarios** with recovery timelines, success criteria, and communication templates for auditor escalation.

**Key principle:** Any Phase 4 slip compresses Phase 5+ or requires auditor timeline extension request. Scenario A is acceptable; Scenario B requires RDC focus; Scenario C triggers post-audit deferral strategy.

---

## Baseline Timeline (Reference)

| Phase | Kickoff | Deploy | Duration | DICQ Gain | RDC Coverage |
|-------|---------|--------|----------|-----------|--------------|
| Phase 4 | 2026-05-20 | 2026-06-02 | 2.5w | +5% (85% target) | Arts. 6, 115–117, 167, 204 |
| Phase 5 | 2026-06-09 | 2026-06-30 | 3w | +3% (88% target) | Arts. 7, 9, 18 |
| Phase 6–7 | 2026-07-01 | 2026-07-14 | parallel | +2% (90% target) | —— |
| Phase 8 | 2026-07-15 | 2026-08-15 | 4w (CAPA) | +1–2% (91–92%) | Arts. 5.3, 118–125 |
| **Auditor Audit** | —— | **2026-08-31** | —— | **Target: 85%+** | **100% critical RDC** |

**Baseline assumes:**
- Phase 4 no slips
- Phase 5 uncompressed (3 weeks)
- Phase 8 CAPA closure (4 weeks, 12 findings)
- Auditor RFI cycles ≤5 business days per CAPA
- Parallel execution Phases 6–7 reduces clock impact

---

## Scenario A: Phase 4 Slip 2 Weeks (Deploy 2026-06-16)

### Timeline Impact

| Phase | Baseline | Slip A | Adjustment | Notes |
|-------|----------|--------|------------|-------|
| Phase 4 | 2026-06-02 | 2026-06-16 | +14 days | Standard slip; root causes: external dep, integration rework, security audit |
| Phase 5 | 2026-06-09 | 2026-06-23 | +14 days (1-week compressed) | Kickoff delayed; scope trimmed from 3w → 2w (SMS/email + basic escalation, defer IA v1.1) |
| Phase 6–7 | 2026-07-01 | 2026-07-07 | +6 days (no slip, overlaps Phase 5 tail) | Parallel execution absorbs Phase 5 compression |
| Phase 8 | 2026-07-15 | 2026-07-21 | +6 days | 4-week CAPA starts 2026-07-21, ends 2026-08-18 (13 days before auditor deadline) |
| **Auditor Audit** | **2026-08-31** | **2026-08-31** | **0 days** | **On time; 13-day buffer remains** |

### Go/No-Go Criteria

**Proceed to Phase 5 (Compressed) if:**
- Phase 4 deploy 2026-06-16 ✓
- Unit tests 738/738 baseline passed (zero regressions)
- E2E: All 8 critical flows PASS (auth → laudo → sign → audit trail)
- Cloud Logs: 0 errors, <5% warning rate over 24h
- NOTIVISA queue 100% event processing (0 failures in 48h)
- Portal LCP <2.5s (Web Vitals)
- Code review sign-off by tech lead + QA
- No CVEs in dependencies (security scan)

**DICQ Achievement:**
- Phase 4: +3% → 81.5% (reduced from +5% due to Phase 5 trim)
- Phase 5 (compressed): +2% → 83.5%
- Phase 8 (CAPA): +1.5% → 85% (meets baseline target)

**RDC 978 Achievement:**
- Phase 4: Arts. 6, 167, 204 ✓
- Phase 5: Arts. 115–117 (basic escalation) ✓
- Phase 8: Arts. 5.3, 118–125 ✓
- **100% critical RDC coverage** ✓

### Actions per Scenario A

#### Week 1 (Post-Phase 4 Slip Detection)

1. **CTO Review Call (Day 1)**
   - Identify slip root cause: external dependency? integration complexity? security audit?
   - Confirm Phase 4 deploy still achievable 2026-06-16 (not further)
   - Evaluate Phase 5 compression trade-offs:
     - Defer: IA v1.1 A/B testing → v1.4.1
     - Keep: SMS/email escalation + SLA dashboard (mandatory for RDC Arts. 115–117)

2. **Auditor Pre-Alignment (Day 2)**
   - Send 1-week slip notice to auditor with recovery plan
   - Schedule sync call (30 min) to discuss:
     - Phase 4 → 5 condensed timeline
     - Phase 8 still delivers 2026-08-18 (13-day buffer)
     - DICQ target downgrade: 85% → 83.5% (acceptable for critical RDC)
   - Confirm auditor OK with schedule shift

3. **Phase 5 Scope Reduction (Days 2–4)**
   - Publish `PHASE5_COMPRESSED_SCOPE.md`:
     - MVP: SMS/email callables + SLA dashboard + history UI
     - Defer to v1.4.1: IA training dataset + Gemini v1.1 experiment
   - Confirm Phase 5 deliverables still satisfy RDC Arts. 115–117 (critical value escalation)
   - Publish compressed Phase 5 PLAN.md

4. **Phase 6–7 Parallelization Kickoff (Day 5)**
   - Confirm Phase 6–7 execution can overlap Phase 5 tail (2026-07-08 onwards)
   - No resource conflict with Phase 5 team (separate streams)
   - Phase 6–7 deliver on 2026-07-14 as planned

#### Week 2–4 (Compressed Phase 5 Execution)

- Phase 5 duration: 2.5 weeks (2026-06-23 → 2026-07-08)
- Phase 6–7 parallel: 2026-07-07 → 2026-07-14
- Phase 8 CAPA: 2026-07-21 → 2026-08-18 (still 13 days pre-auditor)

#### Week 5 (Phase 8 CAPA Closure)

- 12 findings (from Phase 0–7 audit) → CAPA + evidence gathering
- Auditor RFI cycles ≤5 days per CAPA (agreed in pre-alignment)
- Escalate if RFI >5 days: CTO negotiation with auditor (24h SLA)
- Phase 8 completes 2026-08-18 → 13-day buffer for final auditor questions

### Communication to Auditor

**Email Template (send Day 2 of slip detection):**

```
Subject: v1.4 Phase 4 Timeline Update — Schedule Shift Notification

Dear [Auditor Name],

We are notifying you of a schedule adjustment to our v1.4 roadmap, effective immediately.

PHASE 4 DELAY:
- Previous target: 2026-06-02
- New target: 2026-06-16 (+14 days)
- Root cause: [select: external integration complexity / security audit extension / third-party API SLA]

MITIGATION:
- Phase 5 (Critical Escalation + IA Dataset) condensed from 3 weeks → 2.5 weeks
- Phase 6–7 execution parallelized (no clock impact)
- Phase 8 CAPA closure remains on track: 2026-07-21 → 2026-08-18

AUDIT READINESS IMPACT:
- DICQ target: 85% → 83.5% (RDC critical articles 100% unaffected)
- RDC 978 coverage: 100% on all critical articles (Arts. 6, 115–117, 167, 204, 5.3, 118–125)
- Auditor audit date: 2026-08-31 — 13-day buffer maintained

NEXT STEPS:
1. Confirm auditor alignment with revised Phase 4–8 timeline (this week)
2. Weekly standing calls continue (Fridays 14:00 BRT)
3. Phase 5 scope document (PHASE5_COMPRESSED_SCOPE.md) shared by 2026-06-09

We remain confident in audit readiness. No change to auditor audit date.

Best regards,
[CTO Name]
```

---

## Scenario B: Phase 4 Slip 3+ Weeks (Deploy 2026-06-23)

### Timeline Impact

| Phase | Baseline | Slip B | Adjustment | Notes |
|-------|----------|--------|------------|-------|
| Phase 4 | 2026-06-02 | 2026-06-23 | +21 days | Significant delay; external blocker or major refactor |
| Phase 5 | 2026-06-09 | 2026-06-23 | +14 days (2-week compressed) | Scope further trimmed: SMS-only escalation, defer email + SLA |
| Phase 6–7 | 2026-07-01 | 2026-07-07 | +6 days (parallel Phase 5, overlaps starting 2026-07-07) | No slip; absorption via parallelization |
| Phase 8 | 2026-07-15 | 2026-07-21 | +6 days | 4-week CAPA starts 2026-07-21, ends 2026-08-18 (still 13-day buffer, but tight) |
| **Auditor Audit** | **2026-08-31** | **2026-08-31** | **0 days (CRITICAL)** | **On auditor timeline; zero buffer for RFI delays** |

### Go/No-Go Criteria

**Proceed if Phase 4 delivers both:**
1. Core NOTIVISA queue (100% Art. 6 §1 compliance)
2. Portal auth + draft editing (RT access, laudo review)

**Defer to Phase 4.1 (post-audit):**
- Portal signature UI (can be manual RT signature initially)
- Access logging (can be audit trail only, not real-time dashboard)
- Advanced portal search/filtering

**DICQ Achievement:**
- Phase 4: +2% → 80.5% (minimal features, core compliance only)
- Phase 5 (2-week compressed): +1.5% → 82% (SMS escalation only)
- Phase 6–7: +1.5% → 83.5%
- Phase 8: +1.5% → 85% (borderline; RDC 100%, DICQ 85% target achieved via compression)

**RDC 978 Achievement:**
- Phase 4: Arts. 6, 204 (NOTIVISA + audit trail) ✓
- Phase 5: Arts. 115, 117 (basic escalation, SMS only) ✓
- Phase 8: Arts. 5.3, 118–125 (CAPA) ✓
- **100% critical RDC coverage** ✓ (email escalation deferred acceptable)

### Actions per Scenario B

#### Week 1 (Slip Detection)

1. **Emergency CTO + QA Lead Call (Day 1, 2h)**
   - Root cause analysis: Is Phase 4 blockage external (API, third-party) or internal (schema bug, performance)?
   - If external: escalate to provider; confirm hard date when resolved
   - If internal: spike fix or requirement trim?

2. **Auditor Emergency Briefing (Day 2)**
   - Inform auditor of 3-week slip + recovery strategy
   - Propose compromise: Phase 4 delivers NOTIVISA-only, portal auth deferred to Phase 4.1 (post-audit acceptable per auditor comfort)
   - **Require written auditor sign-off** on acceptable deferrals before proceeding

3. **Phase 4 Scope Reduction (Days 2–4)**
   - MVP Phase 4 (mandatory):
     - NOTIVISA queue processor + Art. 6 §1 notifications
     - Portal auth stub (login only, no draft editing)
     - Audit trail (read-only, no signature)
   - Defer to Phase 4.1:
     - Draft editing UI
     - Signature capture
     - Access history dashboard

4. **Phase 5 Ultra-Compression (Days 4–5)**
   - Publish `PHASE5_ULTRA_COMPRESSED_SCOPE.md`:
     - **Keep:** SMS escalation callable + SLA database (RDC Arts. 115–117)
     - **Defer:** Email integration, dashboard, IA dataset
   - Phase 5 duration: 2 weeks (2026-06-23 → 2026-07-07)
   - Confirm RDC critical coverage still 100%

5. **Phase 8 CAPA Risk Assessment (Day 5)**
   - 0-day buffer for auditor RFI delays
   - **All 12 CAPAs must complete by 2026-08-22** (9-day auditor deadline buffer)
   - **Escalation:** Any RFI >3 business days triggers CTO direct call to auditor
   - Agree on 3-day RFI SLA (aggressive vs baseline 5-day) in writing

#### Week 2–3 (Minimal Phase 4 Delivery)

- Phase 4: NOTIVISA + auth stub only
- Deploy 2026-06-23
- Portal signature/editing deferred to Phase 4.1 (document in HANDOFF.md)

#### Week 4 (Ultra-Compressed Phase 5)

- SMS escalation only
- 2-week execution (2026-06-23 → 2026-07-07)
- Phase 6–7 parallelized immediately

#### Weeks 5–8 (Zero-Margin CAPA Execution)

- Phase 8 CAPA: 2026-07-21 → 2026-08-22 (strict 9-day buffer)
- **3-business-day RFI SLA** (auditor-approved)
- Daily standup during CAPA for RFI tracking
- If any CAPA stalls >3 days: CTO escalation call with auditor (same-day)

### Communication to Auditor

**Email Template (send Day 2, URGENT):**

```
Subject: URGENT — v1.4 Phase 4 Timeline Adjustment + Auditor Alignment Required

Dear [Auditor Name],

We are formally notifying you of a schedule adjustment to our v1.4 roadmap that requires your immediate feedback and written approval.

PHASE 4 DELAY:
- Previous target: 2026-06-02
- New target: 2026-06-23 (+21 days)
- Root cause: [external API integration complexity / internal schema refactor / security remediation]

MITIGATION STRATEGY:
Phase 4 scope is reduced to MVP (NOTIVISA queue + auth stub). Advanced features (draft editing, signature, portal dashboard) deferred to Phase 4.1 (post-audit).

PHASE 4 MVP DELIVERS:
✓ NOTIVISA queue processor (RDC Art. 6 §1)
✓ Portal authentication (RT login)
✓ Audit trail (read-only)
✗ Portal draft editing (deferred to Phase 4.1)
✗ RT signature capture (deferred to Phase 4.1)
✗ Access history dashboard (deferred to Phase 4.1)

PHASE 5 ULTRA-COMPRESSION:
- SMS critical value escalation (RDC Arts. 115, 117) — **MANDATORY**
- Email escalation — deferred to Phase 4.1
- IA training dataset — deferred to v1.4.1

AUDIT READINESS IMPACT:
- DICQ target: 85% → 82% (RDC critical articles **100% unaffected**)
- RDC 978 critical articles (Arts. 6, 115–117, 167, 204, 5.3, 118–125): **100% compliant**
- Auditor audit date: 2026-08-31 — **CRITICAL: 9-day buffer only (vs 13-day baseline)**
- Phase 8 CAPA SLA: **3-business-day RFI cycles** (vs 5-day baseline)

REQUIRED AUDITOR DECISIONS:
1. Approve Phase 4 MVP scope and deferred items list (yes/no)
2. Accept 3-business-day RFI SLA for Phase 8 CAPA cycles (yes/no)
3. Written confirmation of acceptable deferrals (email reply required)

CRITICAL PATH IMPACT:
- If Phase 4 slips further: Phase 8 CAPA at risk; consider post-audit submission of Phase 4.1 items
- Zero margin for Phase 5/6/7/8 delays; all phases execute compressed

NEXT STEPS:
1. **Emergency video call** (48 hours from this email) to discuss trade-offs and get written approval
2. Revised timeline document (this email + PHASE4_CONTINGENCY_TIMELINE.md) shared simultaneously
3. Weekly standing calls resume post-alignment (Fridays 14:00 BRT)

We request urgent response to proceed with Phase 4 MVP delivery.

Best regards,
[CTO Name] + [QA Lead Name]
```

---

## Scenario C: Phase 4 Catastrophic Delay (Deploy 2026-07-07+)

### Timeline Impact

| Phase | Baseline | Slip C | Notes |
|-------|----------|--------|-------|
| Phase 4 | 2026-06-02 | 2026-07-07+ | 35+ days late; unacceptable |
| Phase 5 | 2026-06-09 | **DEFERRED to v1.4.1** | Post-audit |
| Phase 6–7 | 2026-07-01 | **DEFERRED to v1.4.1** | Post-audit |
| Phase 8 | 2026-07-15 | 2026-07-21 → 2026-08-18 | CAPA execution + findings closure only |
| **Auditor Audit** | **2026-08-31** | **2026-08-31** | **Audit occurs; Phase 5+ deferred** |

### Status: Unacceptable

**Phase 4 deploy past 2026-06-30 is NOT VIABLE** for v1.4. Triggers emergency strategy: Phase 4 + Phase 5–7 DEFERRED to v1.4.1 (post-audit release, target 2026-09-30).

### Go/No-Go Criteria

**Decision point: Day 14 of Phase 4 execution (2026-06-03)**

If Phase 4 is not tracking to 2026-06-16 (Scenario A) by Day 14, **escalate to CTO + Auditor for decision:**

- **Option 1 (Scenario A recovery):** Extend Phase 4 to 2026-06-16; compress Phase 5; absorb via Phase 6–7 parallel
- **Option 2 (Scenario B recovery):** Extend Phase 4 to 2026-06-23; MVP scope; ultra-compress Phase 5; zero buffer for Phase 8
- **Option 3 (Scenario C deferral):** Abandon Phase 4 in v1.4; audit as v1.3.x + Phase 0 only; Phase 4–7 ship in v1.4.1 (2026-09-30)

**If Scenario C is chosen:**

**Audit v1.4 delivers:**
- Phase 0 (RDC blockers): ✓ Deployed 2026-05-07
- Phase 8 (CAPA closure, 12 findings): ✓ 2026-07-21 → 2026-08-18
- DICQ: ~81% (Phase 0 + Phase 8 only; Phases 4–7 deferred)
- RDC 978: 95%+ critical articles (Phase 0 + Phase 8; portal deferral acceptable per auditor)
- Auditor sign-off on Phase 4–7 deferral to v1.4.1

**v1.4.1 (Post-Audit) Phases:**
- Phase 4: Portal auth + NOTIVISA (2026-09-01 → 2026-09-15, target deploy 2026-09-20)
- Phase 5: Critical escalation + IA dataset (2026-09-20 → 2026-10-10)
- Phase 6–7: Liberación + reclamações (2026-10-10 → 2026-10-25)
- Phase 15 (Final): DICQ closure → 92%+ (2026-10-25 → 2026-10-31)
- **v1.4.1 target deployment:** 2026-10-31

### Actions per Scenario C

#### Week 1 (Slip >3 weeks detected, Day 14 Phase 4)

1. **Emergency Escalation (Day 14, same-day)**
   - CTO + QA Lead + Auditor 30-min call
   - Discuss: Is Phase 4 blockage resolvable by 2026-06-23? Or defer?
   - If defer: auditor confirms acceptable to proceed with Phase 0 + Phase 8 only for audit

2. **Formal Deferral Announcement (Day 15)**
   - Email to auditor + stakeholders:
     ```
     Subject: Phase 4–7 DEFERRED to v1.4.1 (Post-Audit) — v1.4 Audit Readiness Revised

     Phase 4 (Portal Auth + NOTIVISA Integration) is deferred to v1.4.1 (post-audit).

     AUDIT v1.4 SCOPE (2026-08-31):
     - Phase 0: RDC blockers (turnos, LGPD, lab-apoio, risks) ✓
     - Phase 8: CAPA closure (12 findings + evidence) ✓
     - DICQ: ~81% (acceptable for first audit)
     - RDC 978: 95%+ critical articles
     - Auditor pre-approval: CONFIRMED

     v1.4.1 POST-AUDIT (2026-10-31 target):
     - Phase 4: Portal + NOTIVISA
     - Phase 5: Critical escalation + IA
     - Phase 6–7: Liberación + reclamações
     - Target DICQ: 92%+ at v1.4.1 audit review

     Timeline remains auditor-aligned.
     ```

3. **v1.4 Roadmap Replan (Days 15–21)**
   - Publish `v1.4-REVISED-SCOPE-AUDIT-ONLY.md`:
     - Phase 0 + Phase 8 only for audit
     - Phase 4–7 moved to v1.4.1 with revised dates
   - Publish `v1.4.1-ROADMAP.md` (post-audit, 9 phases, 10 weeks)
   - Update CLAUDE.md with revised timeline

4. **v1.4.1 Kickoff Planning (Days 21–28)**
   - Phase 4 kickoff: 2026-09-01
   - Phase 4 deploy: 2026-09-20 (3 weeks)
   - Phase 5–7: Parallel with Phase 8 review (auditor feedback loop)
   - v1.4.1 complete: 2026-10-31

#### Phase 8 Execution (2026-07-21 → 2026-08-18)

- Standard CAPA closure: 12 findings, auditor RFI, evidence sign-off
- No Phase 4–5 dependencies; CAPA isolated
- 13-day buffer remains (vs tight schedules in Scenarios A/B)

### Communication to Auditor

**Email Template (send Day 15, FORMAL DEFERRAL):**

```
Subject: FORMAL NOTICE — Phase 4–7 Deferred to v1.4.1 (Post-Audit Release)

Dear [Auditor Name],

Following our emergency call on [Date], we are formally notifying you that Phase 4 (Portal Auth + NOTIVISA Integration) and dependent phases (Phase 5–7) are deferred from v1.4 to v1.4.1 post-audit release.

DECISION RATIONALE:
Phase 4 is not tracking to 2026-06-23 delivery. Risk of cascading delays into Phase 8 (CAPA closure) and auditor audit date (2026-08-31) is unacceptable. Deferral to v1.4.1 (2026-10-31 target) reduces risk and maintains audit quality.

AUDIT v1.4 SCOPE (2026-08-31):
✓ Phase 0: RDC blockers (all 4 items)
✓ Phase 8: CAPA closure (12 findings, auditor RFI, evidence sign-off)
✗ Phase 4–7: Deferred to v1.4.1 (Portal, Critical Escalation, Liberación, Reclamações)

AUDIT READINESS IMPACT:
- DICQ: ~81% (Phase 0 + Phase 8 contribution)
- RDC 978: 95%+ critical articles (mandatory articles met; portal items deferred acceptable)
- DICQ post-audit target (v1.4.1): 92%+ (all deferred items complete)

v1.4.1 POST-AUDIT TIMELINE:
- Phase 4: 2026-09-01 → 2026-09-20 (Portal + NOTIVISA)
- Phase 5–7: 2026-09-20 → 2026-10-25 (Escalation + IA + Liberación)
- Phase 15 (Final): 2026-10-25 → 2026-10-31 (DICQ closure to 92%+)
- v1.4.1 deployment: 2026-10-31

AUDITOR SIGN-OFF REQUIRED:
Please confirm in writing that proceeding with v1.4 (Phase 0 + Phase 8 only) and deferring Phase 4–7 to v1.4.1 is acceptable for your audit scope.

NEXT STEPS:
1. Auditor written approval of deferred scope (48h SLA)
2. Updated `v1.4-REVISED-SCOPE-AUDIT-ONLY.md` published simultaneously
3. v1.4.1 roadmap finalized (2026-06-01)
4. Phase 8 CAPA execution proceeds on schedule (2026-07-21 → 2026-08-18)

We remain committed to audit readiness and quality. Deferral reduces delivery risk without compromising compliance coverage.

Best regards,
[CTO Name] + [QA Lead Name]
```

---

## Go/No-Go Decision Tree

**Use this tree to determine which scenario applies:**

```
Day 14 of Phase 4 Execution (2026-06-03):

Is Phase 4 trending to deploy ≤2026-06-16?
├─ YES → Scenario A (2-week slip)
│  └─ Continue Phase 4; compress Phase 5; accept 13-day auditor buffer
│
└─ NO → Is blockage resolvable by 2026-06-23?
   ├─ YES → Scenario B (3-week slip)
   │  └─ MVP Phase 4; ultra-compress Phase 5; accept 9-day auditor buffer (CRITICAL)
   │
   └─ NO → Scenario C (Catastrophic, >3 weeks)
      └─ DEFER Phase 4–7 to v1.4.1 (post-audit); audit v1.3 + Phase 0 + Phase 8
         └─ Auditor approval required (within 48h)
         └─ v1.4.1 ships 2026-10-31
```

**Trigger for escalation call with auditor:**
- Day 10 Phase 4: If slip likelihood >50%, schedule pre-alignment call
- Day 14 Phase 4: If trending past 2026-06-23, move to Scenario C discussion

---

## Success Criteria & KPIs per Scenario

### Scenario A Success (2-week slip, on-time audit)

| Metric | Target | Status |
|--------|--------|--------|
| Phase 4 deploy | 2026-06-16 | Trackable |
| Phase 5 compressed | 2 weeks (2w) | Trackable |
| E2E flows (Phase 4) | 8/8 PASS | Go-gate |
| Cloud Logs (24h) | 0 errors, <5% warnings | Go-gate |
| NOTIVISA queue (48h) | 100% events processed | Go-gate |
| Phase 8 CAPA complete | 2026-08-18 (13-day buffer) | Trackable |
| Auditor audit date | 2026-08-31 (no slip) | Fixed |
| DICQ achieved | 83.5–85% | Acceptable |
| RDC critical coverage | 100% | Go-gate |

### Scenario B Success (3-week slip, tight buffer)

| Metric | Target | Status |
|--------|--------|--------|
| Phase 4 MVP deploy | 2026-06-23 | Trackable |
| Phase 5 ultra-compressed | 2 weeks (2w), SMS-only | Trackable |
| NOTIVISA queue | 100% events | Go-gate |
| Phase 8 CAPA complete | 2026-08-18 (9-day buffer CRITICAL) | Trackable |
| RFI SLA | 3 business days (auditor-approved) | Trackable |
| Auditor audit date | 2026-08-31 (no slip) | Fixed |
| DICQ achieved | 82% (RDC unaffected) | Acceptable |
| RDC critical coverage | 100% (email escalation deferred) | Acceptable |

### Scenario C Success (Deferral, post-audit)

| Metric | Target | Status |
|--------|--------|--------|
| v1.4 audit scope | Phase 0 + Phase 8 only | Fixed |
| Phase 8 CAPA complete | 2026-08-18 (standard) | Trackable |
| Auditor pre-approval | Deferred Phase 4–7 acceptable | Required |
| v1.4 audit | 2026-08-31 (81% DICQ, 95% RDC) | Fixed |
| v1.4.1 post-audit | 2026-10-31 (92% DICQ, 100% RDC) | Target |
| Phases 4–7 complete | 2026-10-25 | Trackable |

---

## Risk Mitigation Measures (All Scenarios)

### During Phase 4 (Execution Watch)

1. **Daily standup** (Mon–Fri 10:00 BRT, 15 min)
   - Status: on-track, at-risk, red
   - Blockers: dependencies, rework, unknowns
   - Escalation: any risk score ↑1 point

2. **Weekly tech review** (Wed 14:00 BRT, 30 min)
   - Code review (security + performance)
   - Cloud Logs trend (errors, latency)
   - Test pass rate (baseline 738/738, regressions)

3. **Weekly auditor sync** (Fri 14:00 BRT, 30 min)
   - Progress update
   - Questions from auditor on RDC/DICQ
   - RFI cycles (if Phase 8 overlap)

### Decision Point: Day 14 Phase 4

- **Confirm scenario** (A, B, or C) by Day 14
- **Formal auditor notification** within 24h of decision
- **Revised scope/timeline** published within 48h

### If RFI SLA Breached (Any Scenario)

- **Phase 8 RFI >5 days (Scenario A):** CTO calls auditor same-day; negotiate 2-day extension or escalate to lab director
- **Phase 8 RFI >3 days (Scenario B):** CTO calls auditor same-day; no extensions (zero buffer)
- **Phase 8 RFI >5 days (Scenario C):** CTO calls auditor same-day; escalate to compliance consultant

---

## Appendix: Probability & Impact Assessment

### Probability of Phase 4 Slip

**Historical basis:** v1.3 Phase 9 (bioquímica) slipped 1 week (external dependency on Westgard rules). Phase 2 (planning) slipped 3 days (underestimated artifact depth).

| Scenario | Probability | Trigger |
|----------|-------------|---------|
| No slip (on 2026-06-02) | 60% | Mitigated Phase 3 schema; NOTIVISA API stable; team familiar with portal code |
| Scenario A (2w slip) | 25% | NOTIVISA API rate limits / RT portal UX rework / security audit extension |
| Scenario B (3w slip) | 12% | Third-party API unavailable 2w / internal schema flaw requiring redesign |
| Scenario C (>3w slip) | 3% | Cascading dependency failure / unforecast regulatory change / key team member unavailable |

### Impact of Phase 4 Slip on Audit Readiness

| Scenario | DICQ Impact | RDC Impact | Auditor Timeline | Risk Level |
|----------|-------------|-----------|------------------|-----------|
| No slip | +5% (85%) | 100% critical | On schedule | Low |
| Scenario A | +3% (81.5% → compressed 5 achieves 85%) | 100% critical | 13-day buffer | Low |
| Scenario B | +2% (80.5% → compressed achieves 85%) | 100% critical (email deferred) | 9-day buffer | Medium |
| Scenario C | Deferred to post-audit (81% v1.4) | 95% critical | On schedule (Phase 0+8 only) | Medium |

---

## Communication Cadence

| Audience | Channel | Frequency | Message |
|----------|---------|-----------|---------|
| **Auditor** | Email + call | Pre-alignment (W1), then weekly Fridays | Phase progress + RFI cycles + timeline adherence |
| **CTO + Team** | Slack #v1.4-phase4 | Daily (standup) + weekly (review) | Status, blockers, escalation |
| **Lab Director** | Email | Milestone completion + scenario triggers | Audit readiness, risk posture |
| **Finance** | Email | Scenario C only (deferral costs) | Budget impact of post-audit release |

---

## Glossary

- **DICQ:** Sistema de Garantia da Qualidade (Brazilian quality framework, 40 blocks A–J, max 100%)
- **RDC 978:** Anvisa regulatory standard for clinical labs (critical articles: Arts. 6, 115–117, 167, 204, 5.3, 118–125)
- **CAPA:** Corrective and Preventive Action (Phase 8, 12 findings closure)
- **RFI:** Request for Information (auditor questions during CAPA review)
- **Art.:** Article (RDC 978)
- **SLA:** Service-Level Agreement (response time, e.g., 3-day RFI SLA)
- **MVP:** Minimum Viable Product (core features only; defer non-critical UI/UX)
- **Phase 4.1:** Post-audit release phase (deferred features ship here in Scenario C)
- **v1.4.1:** Point release after external audit (Scenario C path)

---

**Document Status:** ACTIVE  
**Last Review:** 2026-05-07  
**Next Review:** 2026-05-14 (after Phase 4 kickoff, Day 1)  
**Owner:** CTO (drogafarto@gmail.com)  
**Stakeholders:** QA Lead, Tech Lead (Stream D), Auditor, Lab Director
