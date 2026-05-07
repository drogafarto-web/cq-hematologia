# Auditor Alignment Framework — v1.4 Execution (2026-05-07)

**Role:** Auditor Alignment Lead  
**Scope:** Phases 4–15 execution monitoring + weekly auditor sync  
**Timeline:** 2026-05-20 (Phase 4 kickoff) → 2026-08-05 (CAPA ceremony)  
**Status:** ACTIVE (weekly calls starting Week 1 of Phase 4)

---

## 1. Weekly Auditor Alignment Calls (Fridays 10:00 BRT)

### Schedule Template

**When:** Every Friday 10:00 BRT (São Paulo time, UTC-3)  
**Duration:** 30 minutes  
**Participants:**
- Auditor (Ernani, llabclin3@gmail.com)
- CTO (drogafarto@gmail.com)
- Compliance/Audit Lead (TBD, escalation owner)

**Calendar invite template:**
```
Title: HC Quality Weekly Auditor Alignment — Week X Phase Y
Time: Friday 10:00–10:30 BRT
Location: Google Meet [auto-generated link]
Recurrence: Every Friday through 2026-08-05

Agenda (10 min strict per item):
1. (0:00–0:02) — Last week DICQ trend + RDC articles covered
2. (0:02–0:05) — This week critical path status + blocker flags
3. (0:05–0:07) — RFI feedback response summary (if any)
4. (0:07–0:10) — Next week prep + decision needs
```

### Pre-Call Briefing Document (due Thursday 17:00 BRT)

**Template:** `.planning/weekly/AUDITOR_CALL_BRIEF_WEEK-X.md`

```markdown
# Week X Phase Y Auditor Briefing

**Date:** YYYY-MM-DD  
**Call:** Friday 10:00 BRT  
**Prepared by:** CTO / Audit Lead

## Compliance Trend

| Standard | Last Week | This Week | Δ | Target |
|---|---|---|---|---|
| DICQ | 78.5% | 79.2% | +0.7% | 88% (by Week 14) |
| RDC 978 | 85% | 86% | +1% | 100% (by Week 8) |
| LGPD | 62% | 63% | +1% | 85% (by Week 16) |

## Critical Path Status

- [ ] Phase 4 (Portal + NOTIVISA): On schedule / 🟡 At risk / 🔴 Blocked
- [ ] Phase 5 (Critical escalation): On schedule / 🟡 At risk / 🔴 Blocked
- [ ] Phase 8 (CAPA closure): On schedule / 🟡 At risk / 🔴 Blocked

## RFI Tracking

| ID | Topic | Status | Owner | Due |
|---|---|---|---|---|
| RFI-001 | CAPA closure 5-state | Answered | CTO | 2026-05-22 |
| RFI-002 | Critical thresholds | In progress | Eng-A | 2026-05-29 |

## Blockers Flagged

- None this week

## Decision Needed

- Auditor approval on Phase 8 CAPA state machine design (attached)

---

**Call recording:** [link]  
**Attendees:** Ernani, CTO, Audit Lead
```

### Post-Call Action Items Log

**Owner:** Scribe (Audit Lead)  
**File:** `.planning/AUDITOR_CALL_LOG_2026.md`

```markdown
# Auditor Call Log — 2026 (Ongoing)

## Call #1 — Week 1 Phase 4 (2026-05-17)

**Attendees:** Ernani, CTO  
**Duration:** 30 min  
**Date:** 2026-05-17 10:00 BRT

### Topics Discussed

1. **v1.3 → v1.4 handoff** ✓
   - 78.5% DICQ baseline confirmed
   - RDC 978 critical articles checklist reviewed
   - No surprises flagged

2. **Phase 4 architecture review** ✓
   - Portal auth design approved
   - NOTIVISA queue pattern accepted
   - Firestore rules governance sign-off

3. **RFI Feedback** → 2 questions
   - Q1: How are draft laudos locked during RT editing? → Pessimistic locking via callable (ADR-0020)
   - Q2: LGPD consent flow in portal? → Email link + explicit checkbox (ADR-0024)

### Action Items

| Item | Owner | Due | Status |
|---|---|---|---|
| Send ADR-0020 + ADR-0024 | CTO | 2026-05-18 | Done |
| Schedule Phase 4 weekly syncs | Audit Lead | 2026-05-20 | Done |
| Confirm May 20 Phase 4 kickoff | CTO | 2026-05-19 | Pending |

### Auditor Sign-Off

- ✅ Portal design approved (no blocking concerns)
- ✅ Phase 4 ready to launch May 20
- 🟡 Flagged: Resend email service PENDING_SET (DEC-040) — switch to SMTP complete, verify in Week 2

### Next Call

- **Date:** 2026-05-24 10:00 BRT
- **Phase 4 status:** First week production metrics
- **Prep:** Weekly trend report + early warning system (any blockers in Phase 4 execution)
```

---

## 2. Compliance Monitoring Dashboard

### Daily Scorecard (automated report 09:00 BRT)

**File:** `.planning/daily/COMPLIANCE_SCORECARD_2026-MM-DD.md`

```markdown
# Daily Compliance Scorecard — 2026-05-DD

**Generated:** 2026-05-DD 09:00 BRT  
**Period:** Previous 24h  
**Owner:** CI/CD automation + manual spot-check

## Headline Metrics

| Metric | Value | Target | Status |
|---|---|---|---|
| DICQ % | 78.5% | 88% (Aug 4) | 🟡 On track (+0.7%/week) |
| RDC 978 critical articles | 17/17 | 20/20 by Week 8 | 🟡 On track |
| LGPD audit trail entries | 1,247 | >100/day | ✅ Healthy |
| Test pass rate | 738/738 | 100% | ✅ Pass |
| Cloud Logs errors | 0 | 0 | ✅ Clean |

## Phase Status (Week X)

| Phase | Task | Status | Owner | Risk |
|---|---|---|---|---|
| 4 | Portal auth | 45% | Agent-1 | Low |
| 4 | NOTIVISA queue | 20% | Agent-3 | Low |
| 5 | Critical escalation | Planned | TBD | TBD |

## Known Issues

| Issue | Severity | Discovered | Root Cause | Remediation | ETA |
|---|---|---|---|---|---|
| None | — | — | — | — | — |

## Regulatory Gaps (RDC 978)

| Article | Requirement | Coverage | Gap | Remediation | Phase |
|---|---|---|---|---|---|
| 5.3 | Management review | ✅ 100% | None | — | — |
| 115 | Critical value escalation | 🟡 0% (Phase 5) | SMS/email | PENDING | 5 |
| 204 | Audit trail + signature | ✅ 100% | None | — | — |

## DICQ Block Progress

| Block | Name | Coverage | Target | Δ | Phase |
|---|---|---|---|---|---|
| A | Governance | 85% | 90% | +0% | 6 |
| B | Documentation | 92% | 95% | +0% | 6 |
| F | Analytical | 90% | 95% | +0% | — |
| I | Laudos/Release | 75% | 95% | +0% | 4–6 |

## Traffic Light Summary

🟢 **Green:** Tests passing, Cloud Logs clean, no regressions  
🟡 **Yellow:** DICQ trend slow (expect +1-2% per week)  
🔴 **Red Flags:** None

---

**Next update:** 2026-05-DD 09:00 BRT  
**Escalation contacts:**  
- CTO (critical blockers): drogafarto@gmail.com  
- Audit Lead (RFI response): TBD
```

### Weekly Compliance Report (Fridays 16:00 BRT)

**File:** `.planning/weekly/COMPLIANCE_REPORT_WEEK-X-2026.md`

```markdown
# Weekly Compliance Report — Week X 2026

**Period:** Mon DD – Fri DD  
**Reported by:** Audit Lead  
**Audience:** CTO, Auditor (Ernani), Internal team

## Executive Summary

**DICQ:** 78.5% → 79.2% (+0.7%)  
**RDC 978 critical:** 17/17 articles covered ✅  
**LGPD compliance:** 62% → 63% (+1%)  
**Unit tests:** 738/738 passing ✅  
**Cloud Logs:** 0 errors, 3 benign warnings ✓

**Status:** ON TRACK — Phase Y execution healthy, no blockers

---

## 1. DICQ Conformance By Block

| Block | Week N-1 | Week N | Target | Gap | Phase closure |
|---|---|---|---|---|---|
| A — Governance | 85% | 85% | 90% | -5% | Phase 6 |
| B — Documentation | 92% | 92% | 95% | -3% | Phase 6 |
| C — Personnel | 88% | 88% | 92% | -4% | Phase 7 |
| D — Equipment | 90% | 90% | 93% | -3% | — |
| E — Facility | 82% | 83% | 88% | -5% | Phase 9 |
| F — Analytical | 90% | 90% | 95% | -5% | — |
| G — QA | 95% | 95% | 97% | -2% | Phase 6–7 |
| H — Post-analytic | 75% | 76% | 92% | -16% | Phase 6 |
| I — Laudo Release | 75% | 75% | 95% | -20% | Phase 6 |
| J — Continuity | 85% | 85% | 90% | -5% | Phase 9 |

**Overall DICQ:** 82% → 82% (stable, trend +1-2%/week post Phase 4)

---

## 2. RDC 978 Article Coverage

| Article | Requirement | Status | Evidence | Owner |
|---|---|---|---|---|
| 5.3 | Management review | ✅ 100% | Phase 0 (turnos+risks+DPIA) | CTO |
| 86 | Risk management | ✅ 100% | Phase 0 (FMEA-lite) | CTO |
| 99 | Management responsibility | 🟡 80% | ADR-0021 (NOTIVISA) ready | Agent-3 |
| 115 | Critical value escalation | 🟡 0% | Phase 5 (Twilio SMS) | Agent-2 |
| 117 | SLA escalation | 🟡 0% | Phase 5 (SLA tracking) | Agent-2 |
| 167 | Laudos signed RT | ✅ 100% | Phase 3.2 (liberacao) | — |
| 204 | Audit trail immutable | ✅ 100% | LogicalSignature (ADR-0012) | — |

**RDC 978 closure target:** 100% by Week 8 (2026-07-01) ✅

---

## 3. LGPD Compliance Checklist

| Requirement | Article | Status | Notes | Phase closure |
|---|---|---|---|---|
| Consent capture | Art. 7 | ✅ Done | Portal email link + checkbox | Phase 5 |
| Data minimization | Art. 6 | 🟡 Partial | NPS stores min; full policy in Phase 7 | Phase 7 |
| Right to access | Art. 18 | 🔴 Pending | 15-day export endpoint Phase 13 | Phase 13 |
| Right to correction | Art. 19 | 🔴 Pending | Patient portal Phase 7 (partial) | Phase 7 |
| Right to deletion | Art. 17 | 🟡 Partial | Anonymization cron 90-day TTL | Phase 11 |
| Breach notification | Art. 34 | 🟡 Partial | Cloud Logs in place; SOP TBD Phase 11 | Phase 11 |

**LGPD closure target:** 85% by Phase 11 (2026-08-04) ✅

---

## 4. Known Issues & Remediation

| ID | Issue | Severity | Discovered | Root Cause | Remediation | ETA | Owner |
|---|---|---|---|---|---|---|---|
| ISSUE-001 | Resend email PENDING_SET | Medium | 2026-05-07 | Migration incomplete (6 files) | Switch to SMTP (done), verify Week 2 | 2026-05-24 | CTO |
| ISSUE-002 | Críticos thresholds config | Medium | Design phase | RDC 183 requirement | Implement Phase 5 callable `setCriticalThreshold` | 2026-06-30 | Agent-2 |
| ISSUE-003 | LGPD anonymization verify | Low | v1.3 deploy | Manual test not run | Cron job verification script Phase 11 | 2026-08-04 | QA |

---

## 5. Auditor Feedback Summary (Weekly)

| Week | Date | Call Status | Key Feedback | RFIs | Next review |
|---|---|---|---|---|---|
| 1 | 2026-05-17 | ✅ Complete | Portal design approved | 2 (ADRs 0020, 0024) | 2026-05-24 |
| 2 | 2026-05-24 | Scheduled | — | TBD | 2026-05-31 |

---

## 6. Risk Flags (Red, Yellow, Green)

### 🟢 Green (No action)
- Unit tests: 738/738 passing (baseline locked)
- Cloud Logs: Clean (0 errors)
- Web Vitals: Maintained (LCP <2s, CLS <0.05)

### 🟡 Yellow (Monitor)
- DICQ trend: +0.7%/week (need +1-2%/week to hit 88% by Aug 4) → accelerate Phase 5+ execution
- RDC 115/117: 0% coverage (Phase 5 critical path) → Agent-2 on schedule, watch May 28 delivery

### 🔴 Red (Escalate)
- None this week

---

## 7. Phase X Execution Summary

**Phase 4 (Portal + NOTIVISA) — Week 1 (May 20–26)**

| Task | Planned | Actual | % | Status | Risk |
|---|---|---|---|---|---|
| 04-01 Portal auth | 3 callables | 1.5 | 50% | On track | Low |
| 04-02 Portal UI | 5 components | 2 | 40% | On track | Low |
| 04-03 NOTIVISA queue | Async scheduler | Design done | 30% | On track | Medium (Gemini API quota) |
| 04-04 E2E testing | 8 flows | 2 | 25% | On track | Low |

**Week 1 RAG:** 🟡 At pace, no blockers. Gemini quota flagged for Week 2 monitoring.

---

## 8. Monthly Projection

| Metric | Week 1 | Week 4 | Week 8 | Week 14 | Week 22 (Final) |
|---|---|---|---|---|---|
| DICQ % | 78.5% | 79.5% | 82% | 88% | 92% |
| RDC 978 critical | 17/17 | 18/20 | 20/20 | 20/20 | 20/20 |
| LGPD % | 62% | 65% | 70% | 80% | 85% |
| Test pass % | 100% | 100% | 100% | 100% | 100% |

**Projection status:** 🟡 On track if Phase 5 unblocks by Jun 9 (baseline Week 4). If delayed 1 week, DICQ target becomes 86% (still acceptable).

---

## 9. Escalation & Contacts

| Role | Name | Email | Escalation trigger |
|---|---|---|---|---|
| CTO | drogafarto | drogafarto@gmail.com | Blocking RFI, Phase timeline slip >3 days |
| Auditor | Ernani | llabclin3@gmail.com | Any compliance gap discovered (weekly briefing) |
| Audit Lead | TBD | TBD | Daily scoreboard, RFI tracking, weekly report |

---

**Report prepared by:** [Audit Lead name]  
**Distribution:** CTO, Ernani, Internal team  
**Next report:** [Next Friday 16:00 BRT]
```

---

## 3. RFI Management System

### RFI Tracking Spreadsheet

**File:** `.planning/AUDITOR_RFI_TRACKING.md` (source of truth)

```markdown
# Auditor RFI Tracking Log

**Maintained by:** Audit Lead  
**Last updated:** 2026-05-07  
**Response SLA:** 5 business days (escalate if longer)

## Active RFIs

| ID | Topic | Date Opened | Auditor Q | Response | Owner | ETA | Status |
|---|---|---|---|---|---|---|---|
| RFI-001 | Draft laudo locking mechanism | 2026-05-17 | How prevent concurrent RT edits? | ADR-0020 pessimistic locking via callable + DB-level read intent | CTO | 2026-05-18 | ✅ Answered (2026-05-18) |
| RFI-002 | LGPD consent flow portal | 2026-05-17 | Portal paciente: consent capture + audit? | ADR-0024 email link + explicit checkbox + audit log + 90-day anonymization | CTO | 2026-05-18 | ✅ Answered (2026-05-18) |
| RFI-003 | Critical thresholds configuration | TBD (Phase 5 kickoff Jun 9) | RDC 183: how lab sets critical values per analyte? | Callable `setCriticalThreshold(labId, analyte, lowerBound, upperBound)` + Rules enforce read-only post-config | Agent-2 | 2026-06-15 | ⏳ Pending (design phase) |

## Closed RFIs (Archive)

| ID | Topic | Opened | Closed | Response | Outcome |
|---|---|---|---|---|---|
| None yet | — | — | — | — | — |

## Response Template

When responding to Ernani via email:

```
Prezado Ernani,

Re: RFI-XXX — [Topic]

Sua pergunta: [restate auditor question]

Resposta: [detailed response with references]

Evidência: [code link / ADR / screenshot]

Próximo passo: [action, if needed]

Um abraço,
CTO
```

---

## RFI Response Evidence Checklist

Before sending response to auditor, verify:

- [ ] Question restated accurately (no reinterpretation)
- [ ] Evidence linked (GitHub commit, ADR file, code snippet)
- [ ] Test coverage mentioned (if applicable)
- [ ] Owner + ETA clear (if follow-up needed)
- [ ] Copy saved to RFI log + monthly report
```

---

## 4. Pre-Alignment Ceremony (2026-05-15 proposed)

### Goals
- Present Phase 4 architecture + CAPA closure strategy
- Get auditor buy-in on Phase 8 state machine + signature requirements
- Discuss external audit timeline + expectations
- Lock resource allocation approval

### Attendees
- Ernani (auditor)
- CTO (drogafarto)
- Audit Lead (to be assigned)
- Optional: Architecture lead (for technical depth)

### Agenda (90 min)

```
0:00–0:10 — v1.3 snapshot recap + v1.4 overview
0:10–0:35 — Architecture: Firestore rules, state machines, audit trail (live code walkthrough)
0:35–0:55 — RDC 978 mandatory articles + DICQ block progress + gap remediation
0:55–1:15 — Phase 4-7 plans (2-min per plan), CAPA ceremony structure, auditor ceremony timeline
1:15–1:25 — RFI loop + contingency scenarios (if Phase X slips 2 weeks)
1:25–1:30 — Go/no-go decision for Phase 4 kickoff May 20
```

### Pre-Call Deliverables (due May 14 EOD)

- [ ] Deck with state machine diagrams (Phase 8-9)
- [ ] Live app demo walkthrough (https://hmatologia2.web.app, show audit trail, rules)
- [ ] RFI responses document (ADR-0020 + ADR-0024 ready)
- [ ] Contingency timeline (if Phase X + X+1 delay 2 weeks, still hit Aug 4?)
- [ ] Excel RFI tracker (as of call date)

---

## 5. Monthly Compliance Reports

### Template: End-of-Month Summary (Last Friday 17:00 BRT)

**File:** `.planning/monthly/COMPLIANCE_REPORT_MAY_2026.md`

```markdown
# Monthly Compliance Report — May 2026

**Period:** May 1–31, 2026  
**Prepared by:** Audit Lead  
**Distribution:** CTO, Ernani (auditor), Board (if applicable)

## Headline Numbers

| Metric | Start of month | End of month | Target | Δ | Status |
|---|---|---|---|---|---|
| DICQ % | 78.5% (v1.3) | 79.2% | 88% | +0.7% | 🟡 On track |
| RDC 978 critical articles | 17/17 | 17/17 | 20/20 | +0 | 🟡 Phase 5 pending |
| LGPD % | 62% | 63% | 85% | +1% | 🟡 On track |

## Phases Completed

- ✅ Phase 0 (RDC blockers) — complete
- ✅ Phase 1 (Baseline) — complete
- ✅ Phase 2 (Planning) — complete
- ✅ Phase 3 (Schema) — complete
- 🟡 Phase 4 (Portal + NOTIVISA) — 40% (May 20–31, Week 2 in progress)

## RFI Responses Sent

- ✅ RFI-001 (Draft locking) — answered May 18
- ✅ RFI-002 (LGPD consent) — answered May 18

## Known Issues

| Issue | Severity | Status |
|---|---|---|
| Resend email migration | Medium | Resolved (SMTP switch done) |
| Críticos thresholds | Medium | Design in Phase 5 (Jun 9 kickoff) |

## Auditor Feedback (Monthly Summary)

**Calls held:** 1 (May 17)  
**Key themes:** Portal design approved, NOTIVISA queue pattern accepted, no blocking concerns  
**Next call:** May 24

## Next Month Forecast

- Phase 4 completion (Portal + NOTIVISA green)
- Phase 5 kickoff (Critical escalation + IA training)
- DICQ trend +1-2%/week (target 81-82% by end June)
- RDC 978 closure (Arts. 115, 117) Phase 5 completion

---

**Sign-off:** CTO  
**Next report:** 2026-06-30
```

---

## 6. Escalation Matrix

### Trigger Points

| Scenario | Severity | Action | Owner | Timeline |
|---|---|---|---|---|
| **Phase X delivery >3 days late** | 🔴 Red | Email CTO + Ernani + meeting to replan | Audit Lead | Within 4h of miss |
| **DICQ trend <+0.5%/week (2-week avg)** | 🟡 Yellow | Flag in weekly brief, propose acceleration plan | Audit Lead | By Friday weekly call |
| **RFI response >5 business days outstanding** | 🟡 Yellow | Email escalation to CTO + Ernani with ETA update | Audit Lead | By EOD 5th day |
| **Critical security finding in Cloud Logs** | 🔴 Red | P0 incident, notify auditor within 1h, remediation plan in 4h | CTO | Immediate |
| **LGPD breach detected** | 🔴 Red | Incident commander activates; notify auditor + legal within 2h | CTO | Immediate |

### Escalation Contacts

| Role | Name | Email | Phone | Escalation conditions |
|---|---|---|---|---|
| **CTO** | drogafarto | drogafarto@gmail.com | — | Phase slip, P0 security, LGPD breach |
| **Auditor** | Ernani | llabclin3@gmail.com | — | Any compliance gap, blocking RFI |
| **Audit Lead** | TBD | TBD | TBD | Daily ops, RFI tracking, weekly reports |

---

## 7. Success Criteria (v1.4 Audit-Ready)

| Criterion | Target | Evidence | Owner |
|---|---|---|---|
| **Weekly auditor calls** | 100% completion (13 weeks × 1 call) | Call log with attendance | Audit Lead |
| **RFI response SLA** | 5 business days, 100% compliance | RFI tracker + response docs | CTO |
| **DICQ compliance** | ≥88% by Aug 4 | Daily scorecard trending | CTO |
| **RDC 978 mandatory** | 100% Arts. 6, 115, 117, 167, 204 | Auditor sign-off | CTO |
| **Monthly reports** | Delivered to auditor by last Friday of month | Report archive | Audit Lead |
| **Pre-alignment ceremony** | May 15, auditor buy-in on Phase 4 | Meeting notes + go/no-go decision | CTO |
| **CAPA ceremony** | Aug 5, auditor sign-off on 12 findings | Ceremony minutes + ADR-0022 closeout | CTO |

---

## 8. Timeline Summary

```
2026-05-07 — v1.4 Planning complete, auditor email sent
2026-05-15 — Pre-alignment ceremony (auditor buy-in Phase 4)
2026-05-20 — Phase 4 kickoff (Portal + NOTIVISA)
2026-05-24 — Weekly call #1 (Phase 4 Week 1 status)
2026-05-31 — Weekly call #2 + May compliance report
2026-06-02 — Phase 4 deploy target
2026-06-09 — Phase 5 kickoff (Critical escalation + IA)
2026-06-30 — June compliance report
2026-07-01 — RDC 978 critical articles 100% ✅
2026-07-31 — July compliance report
2026-08-04 — All phases 4-9 complete, DICQ ≥88%
2026-08-05 — CAPA ceremony (auditor sign-off)
2026-08-31 — v1.4 complete, ready for external audit (Oct 2026)
```

---

**Framework owner:** Audit Lead  
**Last updated:** 2026-05-07  
**Next review:** 2026-05-24 (post Week 1 call)
