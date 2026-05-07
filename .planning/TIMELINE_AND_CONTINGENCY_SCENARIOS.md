# Timeline + Contingency Scenarios

**Version:** 1.0  
**Date:** 2026-05-07  
**Prepared for:** v1.4 Wave 1 Delivery Checkpoint  
**Scope:** Phase 4 (May 20) through External Audit (Oct 31)

---

## Baseline Timeline (Green Path)

| Phase | Start | End | Duration | Key Milestones | Owner | Status |
|-------|-------|-----|----------|---|---|---|
| **Phase 4** | 2026-05-20 | 2026-06-02 | 14 days | Portal auth + NOTIVISA sandbox live | Executor | PLANNED |
| **Phase 5** | 2026-06-09 | 2026-07-07 | 29 days | Critical values + Twilio SMS escalation | Executor | PLANNED |
| **Phase 6** | 2026-07-14 | 2026-08-04 | 22 days | Bioquímica Phase 2 (analytes + OCR) | Executor | PLANNED |
| **Phase 7** | 2026-08-04 | 2026-08-18 | 15 days | Patient portal Phase 2 (complaints + NPS) | Executor | PLANNED |
| **Phase 8** | 2026-08-18 | 2026-08-31 | 14 days | CAPA closure + micro-modules + ceremony | Executor | PLANNED |
| **CAPA Ceremony** | 2026-08-05 | 2026-08-05 | 1 day | Auditor sign-off on closure items | CTO + Auditor | SCHEDULED |
| **External Audit** | 2026-08-31 | 2026-09-30 | 30 days | DICQ 85%+ verification (target) | Auditor | PLANNED |
| **Audit Sign-Off** | 2026-10-31 | 2026-10-31 | — | DICQ compliance certified | Auditor | PLANNED |

**Critical Path:**
```
Phase 4 (Portal) → Phase 5 (Critical Values) → Phase 6 (Bioquímica) 
→ Phase 7 (Portal Phase 2) → Phase 8 (CAPA) → External Audit
```

**Dependency Chain:**
- Phase 4 unblocks Phase 5 (NOTIVISA API tested in sandbox)
- Phase 5 unblocks Phase 6 (SMS escalation infrastructure ready)
- Phase 8 blocked until Phase 7 complete (all modules must be in place for CAPA assessment)
- External Audit begins only after Phase 8 ceremony completed

---

## ASCII Gantt Chart (Baseline)

```
2026-05 ──────────────────────────────────
         May 7  May 20                Jun 2
         ✅      ▌──────────────────┐
         Wave1   Phase 4: Portal+API │ 14d
                 (Auditor call)      │
                                     Jun 9 ──────────────────┐
                                          ▌─────────────────┤
                                    Phase 5: Critical Values │ 29d
                                                      Jul 7  │
                                                             ┘
2026-06 ──────────────────────────────────
                                       Jul 14 ───────────────┐
                                             ▌──────────────┤
                                       Phase 6: Bioquímica-2 │ 22d
                                                      Aug 4  │
                                                             ┘
2026-07 ──────────────────────────────────
                                             Aug 4 ──────────┐
                                                  ▌──────────┤
                                           Phase 7: Portal-2 │ 15d
                                                    Aug 18    │
                                                             ┘
2026-08 ──────────────────────────────────
         Aug 5   Aug 18  Aug 31       Oct 31
         ⚖️      ▌──┐    ▌─────────────┐
         CAPA    Phase8 └──────────────┼─────────────────────┐
         Sign-off (14d)  External Audit                      │
                         (30d + sign-off)                    │
                                                            ┘

KEY:
▌ = Active phase
⚖️ = Ceremony/Gate
└─┘ = Dependency boundary
```

---

## Contingency Scenarios

### Scenario A: Auditor Alignment Delayed (RFI Loop Extended)

**Trigger:** Auditor requests major clarifications on ADR-0022, ADR-0024, or ADR-0026 during alignment call (May 13–17). RFI response cycle extends to May 27.

**Impact on Timeline:**

| Item | Baseline | Scenario A | Delta |
|------|----------|-----------|-------|
| Auditor call | May 13–17 | May 13–17 | — |
| RFI response | May 19 | May 27 | +8 days |
| Phase 4 kickoff | May 20 | May 28 | +8 days |
| Phase 4 deploy | Jun 2 | Jun 10 | +8 days |
| Phase 5 start | Jun 9 | Jun 17 | +8 days |
| Phase 5 deploy | Jul 7 | Jul 15 | +8 days |
| **Critical:** CAPA Ceremony | Aug 5 | Aug 13 | **+8 days** |
| External Audit start | Aug 31 | Sep 8 | +8 days |
| Audit sign-off deadline | Oct 31 | Nov 8 | **+8 days** |

**Recovery Path:**

1. **Immediate (May 20):** Spike task: "Auditor RFI deep-dive — clarify threat model + NOTIVISA webhook idempotency + portal email token rotation every 72h (ADR-0024 §3.2)."
   - Owner: CTO + compliance SME
   - Duration: 3 days (May 20–22)
   - Output: 5-page RFI response with threat matrix re-validation + test case addendum

2. **May 23–27:** Async RFI loop — expect auditor turnaround ~24–48h per round. Prepare fallback answers for 3 common pushbacks:
   - *"How do you prevent email replay attacks on portal link?"* → Answer: 7-day `exp` claim + HMAC re-validation on click + IP geo-lock optional (ADR-0024 §2.1)
   - *"What happens if NOTIVISA webhook fails after async append?"* → Answer: Retry queue with exponential backoff; manual reconciliation via Cloud Scheduler job (ADR-0026 §4.2)
   - *"Does patient consent for portal login fall under LGPD §9 or §18?"* → Answer: Both (initial consent + persistent audit trail per §38 mandate)

3. **May 28 (Phase 4 kickoff):** Start Phase 4 **in parallel** while awaiting final auditor sign-off.
   - Risk: Slight chance of rework if auditor requests architectural change (low probability if RFI resolved well).
   - Mitigation: Code all Phase 4 tasks in feature branches; do NOT merge to `main` until auditor confirms.

4. **Aug 13 (CAPA Ceremony adjusted):** Auditor signs off on closure items with Aug 13 date. No functional impact — only calendar shift.

**Probability:** 30% (auditor typically has 1–2 rounds of questions on new state machines).

---

### Scenario B: Vendor Integration Slips (NOTIVISA Sandbox or Twilio Onboarding Delayed)

**Trigger:** NOTIVISA provisioning takes 10 days instead of 5 (government sandbox delays) OR Twilio SMS provisioning blocked by compliance docs (Brazilian regulatory review required).

**Impact on Timeline:**

| Item | Baseline | Scenario B | Delta |
|------|----------|-----------|-------|
| Vendor credentials ready | May 15 | May 25 | +10 days |
| Phase 4 sandbox testing | May 20–Jun 2 | May 30–Jun 10 | +10 days |
| Phase 4 deploy | Jun 2 | Jun 10 | +8 days |
| Phase 5 (Twilio live) | Jun 9–Jul 7 | Jun 17–Jul 15 | +8 days |
| **Critical:** Phase 6 start | Jul 14 | Jul 22 | **+8 days** |
| Phase 8 (all modules ready) | Aug 18–31 | Aug 26–Sep 8 | **+8 days** |
| External Audit start | Aug 31 | Sep 8 | +8 days |
| Audit sign-off deadline | Oct 31 | Nov 8 | **+8 days** |

**Recovery Path:**

1. **Immediate (May 7–8):** Pre-flight vendor coordination:
   - Send **formal onboarding request** to NOTIVISA + Twilio TODAY (not May 15).
   - Ask: "(A) What is your SLA for sandbox provisioning? (B) Do you require compliance docs? (C) What is your escalation contact?"
   - Document responses in `EMAIL_TEMPLATES_VENDOR_COORDINATION.md` with timestamps.

2. **May 15–20:** If vendors are slow:
   - **Build Phase 4 in mock mode:** Implement NOTIVISA client with stubbed API (`/sandbox/notivisa-mock.ts`).
   - All business logic tested against mock; swap real API on credential arrival.
   - Prevents Phase 4 from blocking Phase 5.
   - Risk: Minimal (mock follows same interface as real API per ADR-0026 §3.1).

3. **Phase 5 Parallel Track (if Twilio is delayed only):**
   - If NOTIVISA is ready but Twilio is not:
     - Start Phase 5 backend (state machine + Cloud Function wiring) WITHOUT SMS provider.
     - SMS template ready; deploy phase gate: "Twilio credentials in Cloud Secret Manager" (manual gate at May 26).
     - Phase 5 deploy moves to Jun 10, but doesn't block Phase 6 if Phase 6 doesn't depend on SMS.
     - Confirm dependency: Phase 6 (Bioquímica) has **zero** SMS dependency. ✅ Clear to proceed.

4. **Fallback: Extend Phase 4 duration** (accept slip):
   - If both vendors are 10+ days late:
     - Phase 4 ends Jun 10 instead of Jun 2 (8-day buffer accepted).
     - Phase 5 starts Jun 17 instead of Jun 9 (acceptable — no calendar conflict).
     - All downstream phases shift by 8 days, but **do NOT move CAPA Ceremony date** (Aug 5 is hard constraint).
     - Action: Cut 1 Phase 8 micro-module if needed to keep Aug 5 ceremony on track.

5. **Escalation path (if >10 days delay):**
   - Notify CTO by May 25.
   - CTO escalates directly to vendor C-level (NOTIVISA = gov contact, Twilio = account rep).
   - Alternative: Use Twilio trial SMS (no Brazilian number pool, but unblocks dev).
   - Alternative: Pause Phase 5 SMS feature; go live with Portal + NOTIVISA only.

**Probability:** 40% (vendor delays common in Brazil for gov APIs; Twilio's Brazil compliance review typically 7–10 days).

---

### Scenario C: Go/No-Go Gate Failure (May 19 Pre-Phase-4 Blocker)

**Trigger:** One or more pre-Phase-4 prerequisites fail:
- Auditor alignment call incomplete or conditional approval only
- Cloud Monitoring dashboards not deployed (alerting infrastructure down)
- Test environment Firestore not seeded (staging unavailable)
- Resource allocation template unfilled (no team assigned to Phase 4)
- On-call rotation not distributed (incident response untested)

**Impact on Timeline:**

| Item | Baseline | Scenario C | Recovery |
|------|----------|-----------|----------|
| Phase 4 kickoff gate | May 20 | **BLOCKED** | +1 to +7 days |
| Phase 4 deploy | Jun 2 | Jun 9–16 | +7 to +14 days |
| Downstream phases | All shift | Cascading slip | See recovery below |

**Go/No-Go Gate Checklist (by May 19 EOD):**

```
☐ Auditor alignment call completed (RFI feedback documented)
☐ Auditor verbal approval: "OK to proceed with Phase 4 as designed"
☐ NOTIVISA sandbox API call successful (HTTP 200 on test request)
☐ Twilio account provisioned (SMS numbers assigned + test SMS sent)
☐ Cloud Monitoring dashboards live (System Health + SLO Tracking visible in Console)
☐ Cloud Monitoring alert policy armed (test alert received via email/Slack)
☐ Resource allocation template filled (team names, FTE-weeks, skill gaps)
☐ Staging Firestore seeded (test data loaded, Cloud Functions deployed)
☐ On-call rotation calendar distributed (Slack #on-call-paging created + members added)
☐ Executor hand-off meeting completed (Phase 4 Plans 01–03 reviewed, blockers identified)
```

**Recovery Path (Tiered by Blocker Type):**

#### **Type 1: Auditor/Compliance (Critical)**

If auditor approval is conditional (not full go):
- **Action:** Schedule emergency 30-min call for May 19.
- **Owner:** CTO + auditor.
- **Outcome:** Either (A) Full approval → proceed, or (B) Conditional (specific ADR revision required) → slip to May 27.
- **Contingency:** If no resolution by May 19 noon, halt Phase 4 kickoff until May 27 (7-day slip acceptable per Scenario A).

#### **Type 2: Vendor/Infrastructure (Medium)**

If NOTIVISA or Twilio not ready:
- **Action:** Activate Scenario B mock-mode path (Phase 4 proceeds with stubbed API).
- **Timeline impact:** 0 days (Phase 4 still starts May 20, but deploy may slip to Jun 10).
- **Outcome:** Phase 4 design complete + tested against mock; real API swap when credentials arrive.

If Cloud Monitoring or Staging Firestore not ready:
- **Action:** Fast-track setup (2-day sprint May 19–20).
  - Monitoring: `scripts/setup-cloud-monitoring.sh` + 30 min manual dashboard review.
  - Staging: Run `v1.4-TEST_DATA_STRATEGY.md` seed scripts (idempotent, 45 min total).
- **Timeline impact:** 0 days (setup completes before Phase 4 starts).
- **Escalation:** If not ready by EOD May 20, Phase 4 continues with production-only monitoring (not ideal, but acceptable for 1 week).

#### **Type 3: Planning/Process (Low)**

If resource allocation unfilled or on-call not distributed:
- **Action:** CTO completes these async on May 19 (these are **not** technical blockers).
- **Timeline impact:** 0 days (process tasks, not code).
- **Outcome:** Hand-off meeting moves to May 21 if needed (1-day slip acceptable).

#### **Consolidated Recovery (Multiple Blockers):**

| Blocker | Recovery time | Acceptable? | Fallback |
|---------|---|---|---|
| Auditor conditional | 7 days | YES (Scenario A) | Proceed with conditional, rework if needed |
| Vendor not ready | 10 days | YES (Scenario B) | Use mock API, swap real at delivery |
| Monitoring not ready | 2 days | YES | Expedite setup, use temporary logging if needed |
| Staging not ready | 2 days | YES | Seed Friday May 19, ready Monday May 20 |
| Team not assigned | 1 day | YES | CTO assigns, hand-off Tuesday May 21 |
| **Any 2+ blockers** | **May 27** | **CONDITIONAL** | Skip Phases 4–5, start Phase 6 in parallel (requires approval) |

**Decision Tree (May 19 EOD):**

```
┌─ All 10 checks ✓
│  └─→ APPROVED: Phase 4 kickoff May 20 (GREEN)
│
├─ 1–2 checks ✗ (Vendor/Infra/Process)
│  └─→ APPROVED with remediation: Phase 4 starts May 20, mock mode or fast-track setup
│       → YELLOW
│
├─ 3+ checks ✗ OR Auditor condition not resolved
│  └─→ BLOCKED: Delay Phase 4 to May 27 (RFI/vendor/setup completion)
│       → RED
│
└─ Auditor or Critical path ✗ (can't be mocked)
   └─→ BLOCKED: Escalate to CTO, assess Phase structure change
        (e.g., start Phase 6 while waiting for Phase 4 prerequisites)
        → BLACK (emergency decision)
```

**Probability:** 25% (typical for startup projects; often 1–2 minor blockers, rarely critical path failures).

---

## Comparative Timeline Summary

```
EVENT                      GREEN PATH      SCENARIO A        SCENARIO B        SCENARIO C
                          (Baseline)       (Auditor Delay)   (Vendor Delay)    (Pre-Phase4 Gate)
─────────────────────────────────────────────────────────────────────────────────────────────
Auditor call              May 13–17        May 13–17         May 13–17         May 13–17
RFI response/approval     May 19           May 27 (+8d)      May 19            May 19 [BLOCKED]
Phase 4 kickoff           May 20           May 28 (+8d)      May 20            May 27 (+7d) [RED]
Phase 4 deploy            Jun 2            Jun 10 (+8d)      Jun 10 (+8d)      Jun 9 (+7d)
Phase 5 start             Jun 9            Jun 17 (+8d)      Jun 17 (+8d)      Jun 16 (+7d)
Phase 6 start             Jul 14           Jul 22 (+8d)      Jul 22 (+8d)      Jul 21 (+7d)
Phase 8 end / CAPA        Aug 18–31        Aug 26–Sep8 (+8d) Aug 26–Sep8 (+8d) Sep 4–17 (+7d)
CAPA Ceremony             Aug 5            Aug 13 (+8d)      Aug 13 (+8d)      **SLIP** (need decision)
External Audit start      Aug 31           Sep 8 (+8d)       Sep 8 (+8d)       Sep 15 (+15d)
Audit sign-off            Oct 31           Nov 8 (+8d)       Nov 8 (+8d)       Nov 15 (+15d)

LEGEND:
(+Nd) = N-day slip
[BLOCKED] = Gate failure, requires escalation
[RED] = Manual decision required
```

---

## Escalation & Decision Authority

### Scenario A (Auditor Delay)
- **Authority:** CTO (approval of 8-day slip acceptable, within margin).
- **Escalation:** If RFI round 2 needed, notify executive sponsor (VP Engineering or CEO) by May 25.
- **Decision:** Proceed with Phase 4 in parallel (feature branches, no main merge until approval).

### Scenario B (Vendor Delay)
- **Authority:** Executor (can activate mock API path without CTO approval).
- **Escalation:** If delay >10 days, CTO escalates to vendors' C-level; notify executive sponsor by May 22.
- **Decision:** Accept 8-day Phase 4 deploy slip if needed; do NOT extend Phase 8 beyond Aug 31 (CAPA Ceremony hard date).

### Scenario C (Pre-Phase4 Gate Failure)
- **Authority:** CTO (full decision on go/no-go).
- **Yellow → Proceed:** Auditor + 1 minor blocker → approved with remediation plan.
- **Red → 7-day delay:** 2+ blockers or Auditor conditional → Phase 4 moves to May 27; all phases shift by 7 days.
- **Black → Escalate:** 3+ blockers or critical path failure → emergency decision on Phase structure (e.g., parallel Phase 6 start).

---

## Mitigation Inventory

| Risk | Probability | Mitigation | Owner | Timeline |
|------|---|---|---|---|
| Auditor RFI extended | 30% | Pre-prepare 3 threat matrices + fallback answers | Compliance SME | By May 19 |
| NOTIVISA delay | 40% | Send onboarding request May 7; build mock API | Executor | By May 15 |
| Twilio delay | 35% | Parallel SMS template work; use trial if needed | Backend | By May 20 |
| Monitoring setup fail | 15% | Pre-test scripts; have manual dashboard ready | DevOps | By May 18 |
| Resource unfilled | 10% | CTO assigns on May 19 async | CTO | By May 19 EOD |
| On-call untested | 20% | Dry-run alert on May 18; Slack admin ready | DevOps | By May 18 |

---

## Sign-Off & Next Steps

**This document establishes:**
1. ✅ Baseline timeline from Phase 4 (May 20) through Audit sign-off (Oct 31)
2. ✅ Three contingency scenarios (A: Auditor delay, B: Vendor delay, C: Pre-Phase4 gate failure)
3. ✅ Recovery paths for each (8-day, 8-day, 7-day slips respectively)
4. ✅ Escalation authority by scenario type
5. ✅ Go/No-Go gate checklist for May 19 EOD

**Prepared by:** Claude Code (HC Quality Agent)  
**Date:** 2026-05-07  
**Status:** Ready for CTO review + executive briefing
