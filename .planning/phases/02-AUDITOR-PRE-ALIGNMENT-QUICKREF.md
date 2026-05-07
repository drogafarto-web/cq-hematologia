# Auditor Pre-Alignment — Quick Reference

**Goal**: Secure auditor sign-off on Phase 0 scope, evidence standards, DICQ 88% target, and RFI cadence before Phase 1 kickoff (May 17).

**When**: Week 1 (May 8–10, 2026)  
**Duration**: 60–90 min sync call + 1 day post-call deliverables  
**Owner**: CTO + QA Lead

---

## Pre-Call Checklist (T-7 to T-1)

- [ ] Identify + contact auditor (Labclin RT or SBAC lead)
- [ ] Schedule 90-min sync call (May 8–10 morning, Brasília time)
- [ ] Share artifact bundle (6 files): v1.3 recap, v1.4 roadmap, DICQ/RDC matrices, Phase 0 plan, risk register
- [ ] Prepare evidence samples: audit trail screenshots, signed laudo PDF, SGD snapshot, risk matrix
- [ ] Internal 30-min pre-brief (CTO + QA Lead): lock trade-off positions
- [ ] Test screen-share setup

---

## Call Agenda (60 min)

| Part | Time | Topic | Owner | Auditor Decision |
|------|------|-------|-------|------------------|
| 1 | 2 min | Welcome + context | CTO | — |
| 2 | 8–12 | v1.3 recap (78.5%, 25 modules, smoke tests) | QA Lead | Confirm v1.3 baseline ✓ |
| 3 | 12–18 | v1.4 roadmap (22w, 88%+, phases 0–9, timelines) | CTO | Confirm timeline ✓ |
| 4 | 12–18 | Evidence standards (LogicalSignature, chainHash, versioning, retention, RT signature) | CTO | Lock all 5 standards ✓ |
| 5 | 8–12 | RFI cadence (5-day SLA, weekly digest) | QA Lead | Confirm SLA + preference ✓ |
| 6 | 6–10 | DICQ 88% + audit prep timeline (Aug 15, Oct/Nov external audit) | CTO | Agree target + timeline ✓ |
| 7 | 5–10 | Q&A + next checkpoint (May 31) | CTO | Capture all decisions |

---

## Critical Approvals During Call

**1. LogicalSignature (Digital Signature)**
```
Auditor decision: ✅ Accept | 🟡 Conditional | 🔴 Reject
Current: SHA256(json(event) + previous_hash) + operatorId + server timestamp
Auditor concern: [fill if needed]
Adjustment: [fill if conditional]
```

**2. ChainHash + Append-Only Rules**
```
Auditor decision: ✅ Accept | 🟡 Conditional | 🔴 Reject
Evidence: Firestore rules block delete + modify; events append-only; Cloud Audit Logs backup
Auditor concern: [fill if needed]
```

**3. SGD Versioning**
```
Auditor decision: ✅ Accept | 🟡 Conditional | 🔴 Reject
Scheme: {type}-{name}-{date}-v{semver}-{status}.pdf
Example: MQ-HMATOLOGIA-2026-05-07-v1.0-APPROVED.pdf
```

**4. Retention + Access**
```
Auditor decision: ✅ Accept | 🟡 Conditional | 🔴 Reject
Policy: 5-year hot (Firestore) + 7-year cold (Cloud Storage) + read-only auditor access
```

**5. RT Signature**
```
Auditor decision: ✅ Accept | 🟡 Conditional | 🔴 Reject
Current: password-protected LogicalSignature
Upgrade: biometric v1.5
```

---

## Post-Call Deliverables (T+1 Day)

**QA Lead Publishes:**
1. `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-STRATEGY-MINUTES.md` (all decisions + Q&A)
2. Share with auditor for review (24h turnaround)

**CTO Sends:**
3. Email to auditor: "HC Quality v1.4 — Auditor Pre-Alignment Confirmed"
   - Recap 5 evidence standards (accepted/conditional/rejected)
   - Confirm RFI SLA (5 days)
   - Confirm Phase 1 kickoff May 17
   - Request reply "Confirmed" within 24h

**CTO Updates:**
4. `.planning/STATE.md` → `auditor_alignment: CONFIRMED`
5. `.planning/PROJECT.md` → add "Auditor Alignment" section

**QA Lead Updates:**
6. `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md` → add "Auditor Interpretation" column
7. `.planning/milestones/v1.4-RISK-REGISTER.md` → resolve RISK-402

---

## Key Talking Points

**v1.3 Baseline** (show confidence)
- ✅ 25 modules in prod, 78.5% DICQ, 738 tests passing, smoke tests 19/19, Cloud Logs 24h HEALTHY
- ✅ RDC 978 Arts. 117, 167, 179–191 covered
- ✅ Audit trail + signatures working since May 1

**v1.4 Scope** (show realism)
- 22 weeks (May 7 → Sep 30)
- Phase 0 RDC blockers (turnos, LGPD, lab-apoio, risks): May 7–16 (4 modules, low risk)
- Phases 1–9: CAPA closure, portals, pré/pós-analytic, governance formalization (6–7% DICQ lift)
- Buffer: Sep 1–Aug 15 (2 weeks for rework)
- **Target**: 88.5% ± 2% (lower bound 86%, upper bound 91%)

**Evidence Quality** (show rigor)
- LogicalSignature: SHA-256 chain, operatorId = employee ID, server timestamp (non-repudiation + immutability)
- ChainHash: each event hash = previous + current JSON (tamper-evident)
- Firestore rules: enforce append-only + delete block (regulatory-grade access control)
- Cloud Audit Logs + cold archive (7-year retention for compliance)

**RFI Discipline** (show professionalism)
- 5-day SLA (standard) + 3-day SLA (critical 🔴)
- Weekly digest (Sundays) or ad-hoc (auditor preference)
- Weekly escalation if overdue
- Archive in SGD + decision log (historical record for external auditors Oct/Nov)

---

## Contingency (If Auditor Unavailable)

1. Submit written RFI bundle (email + 5-day window)
2. Engage external consultant (1–2 days, ~$2–3k) to validate Phase 0 scope
3. Proceed with Phase 0 (no blockers there)
4. Pause Phase 1 pending async response
5. Re-attempt auditor contact weekly

**Gate**: minimum written email confirmation before Phase 1 entry (May 17).

---

## Success = Auditor Sign-Off

**Auditor confirms** (in writing, email or signed minutes):
1. ✅ Phase 0 RDC blockers sufficient
2. ✅ Evidence standards locked (all 5 items accepted or conditional with clear path)
3. ✅ DICQ 88% + Aug 15 timeline realistic
4. ✅ No show-stoppers
5. ✅ RFI SLA 5 days, weekly digest

**Then**: Phase 1 kickoff May 17 → full v1.4 execution (22 weeks).

---

## Files

- **Main**: `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-STRATEGY.md` (835 lines, complete plan)
- **Template**: `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-SIGN-OFF.md` (checklist template, filled during call)
- **Post-call**: `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-STRATEGY-MINUTES.md` (created T+1)

---

## Contact Lock-In

- **Primary**: QA Lead ([email])
- **Secondary**: CTO ([email])
- **RFI Folder**: SGD `AUDITOR-RFI-INBOX` (shared)
- **Escalation**: CTO direct phone (+55 11 XXXX-XXXX)

---

**Commit**: `8045527`  
**Ready for execution**: May 8–10  
**Expected close**: May 11 (all deliverables)
