---
role: Deployment Gate Manager
created: 2026-05-07
version: 1.0
---

# Gate Manager Quick Reference

**Purpose:** Fast lookup for gate validation, escalation, and decision-making during v1.4 execution.

---

## When to Validate Each Gate

| Date Range | Gates Due | Action |
|---|---|---|
| **May 20–Jun 2** | Phase 4 (final day 2026-06-02) | Monitor Phase 4 progress; validate Phase 4 gate end of week |
| **Jun 1–07** | Phase 10 (report due 2026-06-21) | Parallel Phase 4; monitor pen-test progress |
| **Jun 8** | Phase 5 (final day 2026-06-30) | After Phase 4 PASS; validate Phase 5 gate end of month |
| **Jun 9–14** | Phase 8 starts (ends 2026-08-05) | Parallel Phase 5; critical path gate |
| **Jun 15** | Phase 8 CAPA (auditor driven) | CTO-level gate; weekly auditor meetings start |
| **Jul 1–14** | Phase 6 (final day 2026-07-14) | Non-critical path; light monitoring |
| **Jul 8–28** | Phase 7 (final day 2026-07-28) | Non-critical path; light monitoring |
| **Jul 22–Aug 4** | Phase 9 + Phase 12 + Phase 11 Week 8 | Convergence; all gates due ~same week |
| **Aug 5** | WAVE 2 GATE DECISION POINT | Auditor CAPA ceremony; final CAPA sign-off |
| **Aug 31** | EXTERNAL AUDIT WINDOW | Go-Live Gate authority: CTO final approval |

---

## Gate Validation Checklist (Abridged)

Use full checklist from `v1.4_DEPLOYMENT_GATE_FRAMEWORK.md` Section II. Below = quick summary.

### Every Phase Gate (15 total)

- [ ] **Code complete?** (0 TODOs, PRs merged)
- [ ] **Tests passing?** (Unit >90%, E2E 8/8)
- [ ] **Rules deployed?** (Firestore 0 errors)
- [ ] **Functions working?** (0 5xx in 24h)
- [ ] **Logs clean?** (0 CRITICAL, <3% WARNING)
- [ ] **Compliance checked?** (RDC/DICQ articles)
- [ ] **Docs complete?** (CLAUDE.md, README, ADR)
- [ ] **No regressions?** (738/738 baseline tests)
- [ ] **Performance ok?** (Web Vitals on target)
- [ ] **Sign-offs collected?** (Executor, Tech Lead, QA, Compliance, CTO)

### Every Wave Gate (4 total)

- [ ] **All child phases PASS?** (e.g., Wave 1 = Phases 4, 5, 6, 7)
- [ ] **E2E coverage 100%?** (32+ flows per wave)
- [ ] **Data integrity OK?** (chain-hash verification)
- [ ] **Cloud Logs clean?** (cumulative 24h review)
- [ ] **Auditor alignment?** (if applicable)
- [ ] **Sign-offs complete?** (All phase owners + CTO)

### Go-Live Gate (1 final)

- [ ] **All 19 gates PASS?** (cumulative check)
- [ ] **19/19 smoke tests PASS?** (production flows)
- [ ] **DICQ ≥88%?** (compliance target)
- [ ] **RDC 978 100% critical articles?**
- [ ] **Auditor pre-audit review done?**
- [ ] **On-call setup complete?** (runbooks, contacts)
- [ ] **CTO final sign-off?** (authority to proceed)

---

## Blocker Resolution Process

### If Phase Gate FAILS (blocking items detected)

1. **Classify severity:**
   - 🔴 **Blocker (hard stop):** Code not ready, tests failing, security issue, auditor red flag
   - 🟠 **Warning (monitor):** Performance regression, documentation incomplete, minor compliance gap
   - 🟡 **Info (note):** Enhancement opportunity, tech debt flagged

2. **Notify immediately:**
   - Message phase executor: "Gate BLOCKED — see report below"
   - CC: Tech Lead, QA Lead, CTO
   - Include: blocker list, evidence, suggested action

3. **Set resolution deadline:**
   - Blocker type = Hard stop → **resolution due <48h** (or wave delayed)
   - Blocker type = Warning → **resolution due <1 week** (non-blocking)

4. **Track resolution:**
   - Update `GATE_STATUS_DASHBOARD.csv` (blocker count, details, ETA)
   - Re-validate phase gate when fixes submitted
   - Document root cause (for post-mortem)

5. **Escalate if unresolved >48h:**
   - Notify Wave Coordinator + CTO
   - Decision: extend timeline OR accept risk (documented override)
   - If risk accepted: CTO signature required + audit trail

---

## Critical Path Gates (Watch Closely)

**CRITICAL GATES = Must PASS on time or entire wave delays:**

| Gate | Scheduled | Hard Deadline | Risk Level | Escalation Trigger |
|---|---|---|---|---|
| **Phase 4** | 2026-06-02 | 2026-06-09 | HIGH | Day 7 slip → Wave 1 +1 week |
| **Phase 8** | 2026-08-05 | 2026-08-12 | HIGH | Day 7 slip → Wave 2 +1 week |
| **Phase 12** | 2026-08-02 | 2026-08-09 | HIGH | Any blocker → Wave 2 +1 week |
| **WAVE 1** | 2026-06-02 | 2026-06-09 | CRITICAL | Unmet → Phase 5–7 blocked |
| **WAVE 2** | 2026-08-31 | 2026-09-07 | CRITICAL | Unmet → Phase 13 blocked; external audit at risk |
| **GO-LIVE** | 2026-08-31 | 2026-09-07 | CRITICAL | Unmet → External audit misses deadline |

**Non-critical gates (Phase 6, 7, 10, 13, 14, 15):** Delays manageable with parallel execution.

---

## Escalation Contact Tree

```
Phase Executor
    ↓ (blocker >24h)
Tech Lead + QA Lead
    ↓ (unresolved >48h)
CTO (drogafarto)
    ↓ (critical path at risk)
Wave Coordinator / External Auditor (if CAPA-related)
    ↓ (external audit timeline threatened)
Executive Stakeholder (final decision authority)
```

**Contact info:** [Fill in phone/Slack/email per project context]

---

## Go/No-Go Decision Authority

| Gate | Final Authority | Approval Required? |
|---|---|---|
| **Phase Gates 4–15** | CTO | ✓ MUST sign-off |
| **Wave 1 Gate** | CTO | ✓ MUST sign-off |
| **Wave 2 Gate** | CTO + External Auditor (CAPA) | ✓ Both must concur |
| **Wave 3 Gate** | CTO + External Auditor | ✓ Both must concur |
| **Go-Live Gate** | CTO | ✓ MUST sign-off |

**Variance authority:** If a phase gate fails but risk is acceptable → CTO can override with written justification (update `GATE_STATUS_DASHBOARD.csv` with note).

---

## Key Metrics to Track (Real-Time Monitoring)

### Phase Health Indicators (update every 2 hours during active phase)

| Indicator | Green | Yellow | Red |
|---|---|---|---|
| **Runtime vs Plan** | <100% | 100–110% | >110% |
| **Test Coverage** | >90% | 75–90% | <75% |
| **E2E Pass Rate** | 100% (8/8) | 75% (6/8) | <75% (<6/8) |
| **Cloud Log Errors** | 0 CRITICAL | 0 CRITICAL, <1% WARNING | Any CRITICAL in 24h |
| **Blocker Age** | <24h to resolve | 24–48h | >48h |
| **Bundle Size** | <400 KB main | <420 KB | >420 KB |
| **Web Vitals LCP** | <2.0s | 2.0–2.5s | >2.5s |

**Action:** If any indicator goes RED → escalate immediately to CTO.

---

## Compliance Mapping (Quick Reference)

### RDC 978 Critical Articles (100% by v1.4)

| Article | Phase | Gate Check |
|---|---|---|
| **Art. 5.3** | Phase 8 (CAPA) | Management review + CAPA closure |
| **Art. 6** | Phase 4 (Portal) | Patient notification process |
| **Art. 20** | Phase 10 (Sec) | Information security measures |
| **Art. 36–39** | Phase 8 (Labs) | Lab-apoio contracts + AVS |
| **Art. 77** | Phase 0 (DPIA) | LGPD data protection impact |
| **Art. 86** | Phase 8 (Risks) | Risk management / FMEA |
| **Art. 115** | Phase 5 (Crit) | Critical value escalation |
| **Art. 117** | Phase 5 (Crit) | Escalation SLA |
| **Art. 122** | Phase 0 (Turnos) | Shift supervision audit trail |
| **Art. 167** | Phase 4 (Lib) | Laudo release workflow |
| **Art. 179–191** | Phase 6 (Lib) | CIQ quantitative procedures |
| **Art. 204** | Phase 4 (Audit) | Audit trail completeness |

### DICQ Compliance Blocks (Target 88% by Phase 14)

| Block | Phase | Gate Check |
|---|---|---|
| **Block 4.2.2** | Phase 5 (Crit) | Critical value alerts |
| **Block 4.3** | Phase 4–7 (Core) | Document control + quality docs |
| **Block 4.4** | Phase 8 (CAPA) | Nonconformance + audit trail |
| **Block 4.7** | Phase 5 (IA) | IA training dataset |
| **Block 4.14** | Phase 8 (Risks) | Risk management |
| **Block J** | Phase 9 (KPI) | Business continuity / SLA |

---

## Common Gate Failure Patterns (Diagnostics)

### Symptom: "Phase executor says code is ready, but tests are failing"

**Likely cause:** Tests not run locally before submission. **Action:**
- Request full `npm run test:unit + test:e2e` output (not just summary)
- Check for flaky E2E (ask for 3 consecutive runs)
- If tests consistently fail → BLOCKER, extend phase 1 week
- If tests flaky → investigate test infrastructure (setup issue?)

### Symptom: "Cloud Logs show WARNING spike during smoke test"

**Likely cause:** Expected warnings during deployment (rule evaluation, cold-start). **Action:**
- Filter logs: severity=ERROR only (ignore WARNING)
- Check for patterns (e.g., "index building" = expected)
- If recurring ERROR → BLOCKER, investigate before gate approval

### Symptom: "Auditor says 'artifacts look incomplete' but CTO thinks they're done"

**Likely cause:** Miscommunication on DICQ/RDC mapping. **Action:**
- Request detailed auditor feedback (DICQ block X missing Y section)
- Schedule CTO + auditor sync (same-day if possible)
- Clarify expectations before phase ends
- Document in `GATE_STATUS_DASHBOARD.csv` ("Auditor feedback — resolving X by Y date")

### Symptom: "Performance regressed (LCP 2.8s, target 2.5s)"

**Likely cause:** New library import, un-lazy-loaded route, or Firestore query N+1. **Action:**
- Request bundle analysis (`npm run build -- --analyze`)
- Check imports: any new >50 KB library added?
- Review lazy-load strategy (new routes must use `React.lazy`)
- If fixable in <2 days → yellow warning, extend phase 3 days
- If complex investigation needed → BLOCKER, investigate before deployment

---

## Sign-Off Document Template (CTO approval)

```markdown
## Gate Approval — [Phase Name]

**Gate:** Phase X: [Name]  
**Status:** ✓ PASS  
**Date:** [YYYY-MM-DD HH:MM UTC]  
**Validating Officer:** [CTO Name] (drogafarto)  
**Approval Signature:** [Hash]

### Summary

- [X] Checklist items 1–13 all verified
- [X] Phase-specific requirements confirmed
- [X] Blockers resolved / documented
- [X] Sign-offs collected (executor, tech lead, QA, compliance)

### Blockers Addressed

(If any blockers were found and resolved, list them here)

### Next Steps

- Unblock [downstream phase(s)]
- Deploy to [environment] on [date]
- Monitor [metrics] for [duration]

---

**CTO Signature:** drogafarto  
**Approval Hash:** [git commit hash / timestamp hash]  
**Timestamp:** [ISO 8601 UTC]
```

---

## Weekly Sync Cadence (During Active Phases)

| Day | Meeting | Attendees | Duration | Purpose |
|---|---|---|---|---|
| **Monday 9:00 BRT** | Phase Planning | Phase executor + Tech Lead + CTO | 30 min | Week plan + blocker review |
| **Wednesday 10:00 BRT** | Auditor Pre-Alignment | CTO + Auditor + RT lead | 60 min | Phase progress + artifact approval |
| **Friday 15:00 BRT** | Gate Validation | Gate Manager + Phase executor + CTO | 30 min | Week-end status + go/no-go decision |

---

## Automated Dashboard Updates (Manual Process)

**File:** `.planning/milestones/GATE_STATUS_DASHBOARD.csv`

**Update frequency:** Every 2 hours during active phases (Phase kickoff → target deploy date)

**Updater:** Gate Manager OR phase executor (self-report)

**Metrics to update per row:**
- `% Complete` — based on test results + PR merged count
- `Blockers_Active` — count of BLOCKED checklist items
- `Blocker_Details` — human-readable summary (e.g., "Phase 4 blocked by NOTIVISA callable failing smoke test")
- `Last_Updated` — timestamp of last check
- `Next_Review_ETA` — when next validation checkpoint is due

**Automation script option:** Create a GitHub Actions workflow that queries:
- PR merge status (Phase X branch → main)
- Test results (Cloud Build logs or Jest output)
- Firestore Rules deploy status (Firebase API)
- Cloud Logs recent errors (Logging API)
- ...then auto-update CSV with status + timestamp

(Currently manual; automation is Phase 16+ roadmap item.)

---

## Phase 4 Launch Checklist (First Gate)

**When:** 2026-05-20 kickoff  
**Gate deadline:** 2026-06-02  
**Preparation (T-7 days, week of 2026-05-13):**

- [ ] Agent 1–4 assigned + onboarded (read Phase 4 CLAUDE.md)
- [ ] NOTIVISA sandbox account provisioned (gov processing ~3–5 days)
- [ ] Twilio + SendGrid API keys configured (Phase 5 uses these too)
- [ ] Firestore emulator updated with Phase 3 schema
- [ ] Test lab account configured + RT test users created
- [ ] E2E test template created (8 flow scenarios defined)
- [ ] Daily standup scheduled (9:00 BRT, 15 min)
- [ ] Blockers escalation contact distributed (CTO, Tech Lead, QA)

**Phase 4 Week 1 (May 20–26):**
- Portal auth callable live + unit tested
- NOTIVISA queue processor scaffold + test skeleton
- Cloud Logs baseline established (take "0 errors" screenshot)

**Phase 4 Week 2 (May 27–Jun 2):**
- All 3 callables deployed to production
- E2E smoke tests passing (manual on staging first)
- Gate validation scheduled for 2026-06-02 end-of-day
- If blockers found by noon on Jun 2 → escalate immediately (1-week buffer needed)

---

## When to Panic (Escalation Red Flags)

🚨 **Escalate to CTO immediately if:**

1. **Critical article fails compliance check** (e.g., Art. 6 notification not logged)
2. **Chain-hash broken** (crypto validation fails — data integrity risk)
3. **Auditor discovers undisclosed gap** (compliance debt exposed)
4. **Phase runtime >2× planned duration** (critical path threatened)
5. **Firestore rule deploy fails + can't rollback** (read/write lockout)
6. **0 critical errors suddenly spike** (unknown regression introduced)
7. **Bundle size regression >50%** (web vitals degradation)
8. **Gate validator discovers scope creep** (phase trying to ship too much)

**Action:** Conference call same-day. Convene: Phase executor, Tech Lead, CTO, Wave Coordinator. Decide: extend phase, defer features, accept risk, or escalate further.

---

**Last Updated:** 2026-05-07  
**Next Review:** 2026-05-20 (Phase 4 kickoff)
