---
phase: 15
milestone: v1.4
name: "Launch & Post-Deploy Monitoring"
status: planning-complete
period_start: 2026-05-07
period_end: 2026-05-09
duration_days: 3
dependencies:
  - "Phase 14 complete (code merged to main)"
  - "CTO authorization email"
  - "On-call engineer assigned"
  - "Secrets provisioned in GCP"
---

# Phase 15 Overview

## What Is This Phase?

Phase 15 is the **final gate** before v1.4 "goes live" in production. It consists of:

1. **4-step production deployment** (Rules → Indexes → Functions → Hosting → Smoke)
2. **48-hour continuous monitoring** (cloud logs + manual spot-checks)
3. **Real-world validation** (RT + auditor critical workflows)
4. **Metrics baseline capture** (DICQ %, RDC coverage, Web Vitals)
5. **v1.4 closure** (sign-offs, lessons learned, v1.5 kickoff)

---

## Context: Where We Are

**v1.3 Status:** Live in production since 2026-05-07, DICQ 78–82%, 35 modules running

**v1.4 Preparation:** Phases 0–14 complete. Code merged to main. All tests passing. No blockers.

**This Phase:** Execute the deployment, monitor for 48 hours, validate production, close the milestone.

**Next Phase:** Phase 4 (CAPA Closure) begins 2026-05-20 (v1.4 roadmap continues with Phases 4–15)

---

## Timeline at a Glance

```
2026-05-07
├─ 19:00 UTC     → Pre-execution gate (CTO auth, dependencies verified)
├─ 20:00–20:30   → Step 1: Firestore Rules + Indexes (30 min)
├─ 20:35–21:15   → Step 2: Cloud Functions (40 min)
├─ 21:15–21:45   → Step 3: Hosting (30 min)
├─ 21:45–22:30   → Step 4: Smoke Tests (45 min)
└─ 22:30 UTC     → START 48h monitoring

2026-05-08
├─ 08:00–17:00   → Real-world smoke tests (RT + auditor)
└─ Monitoring continues (12h rotation shifts)

2026-05-09
├─ 22:30 UTC     → END 48h monitoring
├─ 23:00–04:00   → v1.4 Closure tasks
└─ 09:00 UTC     → v1.5 Phase 4 kickoff meeting
```

---

## The 4-Step Deployment

### Step 1: Firestore Rules + Indexes (30 min)

**What:** Deploy Firestore security rules and composite indexes for all v1.4 collections

**Why:** Rules must be in place before functions try to write; indexes must exist before complex queries run

**Gate:** 0 permission errors in cloud logs post-deploy

**Rollback:** Revert `firestore.rules` + `firestore.indexes.json`, re-deploy

### Step 2: Cloud Functions (40 min)

**What:** Deploy 50+ new serverless functions (callables, triggers, cron jobs)

**Why:** Functions provide NOTIVISA, portal config, IA/OCR foundation, Pub/Sub handlers

**Gate:** Secrets provisioned (preflight check must pass); 3 cold-start smoke invocations succeed

**Rollback:** Revert `functions/`, rebuild, re-deploy

### Step 3: Hosting (30 min)

**What:** Deploy new web app (React/TypeScript build with new modules)

**Why:** Frontend code for new CIQ modules, portal expansion, feedback loop UI

**Gate:** PWA service worker registers + offline mode works

**Rollback:** Revert `src/`, rebuild, re-deploy

### Step 4: Smoke Tests (45 min)

**What:** Run 8 test cases covering critical paths (auth, NOTIVISA, portal, CIQ, SGQ, feedback)

**Why:** Verify the deployed system is functional end-to-end before monitoring period

**Gate:** All 8 tests pass without 5xx errors

**Escalation:** If any fail, investigate before proceeding to 48h monitoring

---

## 48-Hour Monitoring Strategy

### What We Monitor

| Layer | Metric | Red Flag | Expected |
|-------|--------|----------|----------|
| **Cloud Functions** | Error rate | Timeout, undefined, OOM | <0.01% |
| **Firestore** | Permission errors | "Permission denied" | 0 |
| **Hosting** | 5xx errors | 500, 502, 503, 504 | 0 |
| **NOTIVISA** | SMS delivery | Function error | 99%+ delivery |
| **Gemini API** | OCR errors | Timeout, bad input | <10 errors/48h |

### Automation + Manual Checks

**Automated:**
- PowerShell/Bash script runs continuously (or every 30 min)
- Logs filtered for ERROR/WARNING severity
- JSON export + Markdown report generated

**Manual:**
- Spot-checks every 6 hours (on-call engineer)
- War room post (Slack) every 6 hours
- Action on P0 incident within 5 minutes
- P1 escalation within 2 hours

### Escalation Thresholds

| Incident Type | Action | SLA |
|---------------|--------|-----|
| **P0:** NOTIVISA down, rules block traffic, auth broken | Immediate investigation + potential rollback | <5 min acknowledge |
| **P1:** 10% error rate in single module, sustained rate-limit | Escalate → patch after Phase 15 | <2h decision |
| **P2:** Single timeout, transient OAuth | Document → v1.4.1 | <24h review |

### Rollback Procedure

If P0 cannot be fixed in 15 minutes:

1. Revert to pre-deploy commit (git reset --hard)
2. Re-deploy all 4 steps in sequence
3. Smoke test (5 min)
4. Post-mortem (1h after resolution)

---

## Real-World Validation (Business Hours Day 2)

**Timeline:** 2026-05-08 08:00–17:00 UTC

**Participants:** Auditor, RT (lab technician), QA lead

**Purpose:** Verify critical workflows work in production

### Workflows Tested

1. **Auditor SGD Compliance Review**
   - Check: 80 Riopomba documents migrated to SGD
   - Verify: Audit trail (creation, modification, approval history)
   - Sign-off: "SGD module ready for regulatory audit"

2. **RT Critical Value Response**
   - Create high glucose result (>500 mg/dL)
   - Measure latency: Time from "Mark Critical" to RT notification
   - Validate SLA: <2 min end-to-end (RDC 978 Art. 184)

3. **Patient Portal Laudo Download**
   - Access portal with patient credentials
   - Download PDF laudo
   - Verify: Signature block present, results correct, no PII leakage

4. **Portal Médico Link (optional)**
   - If Phase 10.06 complete: generate sharable link for doctor
   - Verify: Read-only access, link expiration (30 days)

5. **Feedback Loop NPS**
   - Patient submits NPS score
   - Verify: PII not visible (name excluded)
   - Check: Data stored in `feedback-nps/{labId}/`

---

## Metrics Captured

After 48h monitoring, QA lead compiles baseline snapshot:

**DICQ Compliance:**
- Expected: 78–82% (v1.3 baseline + v1.4 gains)
- Per-block breakdown (A–J)

**RDC 978 Coverage:**
- Arts. 117 (SGD), 167 (laudo), 179–191 (CIQ + critical values)
- Expected: 90%+

**Web Vitals (from RUM):**
- LCP <2.5s (p50 target: <2.0s)
- INP <200ms (p50 target: <120ms)
- CLS <0.1 (p50 target: <0.05)

**Cloud Functions:**
- Cold-start latency (avg 2–4s expected)
- Error rate (<0.01%)
- P95 response time

**SMS/Email Delivery:**
- SMS: 99%+ (Twilio)
- Email: 99%+ (Resend)

**IA Foundation:**
- Imuno OCR dataset size
- Model inference latency (if live)

---

## v1.4 Closure (Post-Monitoring)

### Deliverables Produced

1. **DEPLOYMENT_LOG_v1.4.md** — Timeline + step-by-step results + metrics
2. **MONITORING_REPORT_v1.4.md** — 48h cloud logs summary + incident log
3. **MONITORING_REPORT_v1.4.pdf** — Formatted PDF for archival
4. **METRICS_BASELINE_v1.4.json** — Snapshot JSON for tracking
5. **LESSONS_LEARNED.md** — What went well + improvements for v1.5
6. **Updated STATE.md** — v1.4 production status
7. **Updated Obsidian roadmap** — Phase completions + v1.5 preview

### Sign-Offs Required

- [ ] **CTO:** "v1.4 LIVE" authorization (async email)
- [ ] **Auditor:** "Compliance verified" acknowledgment (async email)
- [ ] **DevOps:** "0 P0 incidents, stable" confirmation
- [ ] **QA:** "Smoke tests passing, metrics captured" confirmation

### v1.5 Kickoff (2026-05-10 09:00 UTC)

30-minute alignment meeting:
- Phase 4 (CAPA Closure) readiness
- Phases 5–7 planning (portal, RDC Part 2, DICQ → 88%)
- Resource allocation (4 parallel streams)
- Next gate: Phase 4 detailed plan + requirements

---

## Success Criteria

For Phase 15 to be "complete," ALL must be true:

| Criterion | Target | Status |
|-----------|--------|--------|
| All 4 deploy steps execute | ✓ No blockers | TBD |
| 0 P0 incidents in 48h window | ✓ None | TBD |
| Smoke tests 8/8 passing | ✓ All green | TBD |
| Real-world workflows validated | ✓ RT + auditor sign-off | TBD |
| DICQ baseline captured | ✓ 78–82% documented | TBD |
| RDC 978 coverage verified | ✓ 90%+ documented | TBD |
| Web Vitals green | ✓ LCP <2.5s, INP <200ms, CLS <0.1 | TBD |
| Cloud logs exported | ✓ JSON + PDF saved | TBD |
| CTO + auditor approvals | ✓ Emails documented | TBD |

---

## Critical Dependencies

**Blocking (must be complete before 2026-05-07 20:00 UTC):**
- [ ] Phase 14 merged to main
- [ ] CTO authorization email received
- [ ] On-call engineer assigned (name + phone)
- [ ] GCP credentials live (`gcloud auth`, `firebase auth`)
- [ ] Secrets provisioned (GEMINI_API_KEY, RESEND_API_KEY, others)
- [ ] Test accounts created (auditor, patient, RT)

**Non-blocking (nice to have):**
- Pre-create Slack war room channel
- Stage monitoring scripts locally
- Pre-warm function invocations (optional)

---

## Roles & Responsibilities

| Role | Primary Duty | Phase 15 Window |
|------|--------------|-----------------|
| **CTO** | Approval gate + post-closure sign-off | Async (emails) |
| **DevOps Lead** | Deploy execution + validation | 2026-05-07 all day (20:00–21:45 active) |
| **QA Lead** | Smoke tests + 48h monitoring oversight | 2026-05-07 21:45+ (daily 6h rotations) |
| **On-Call Engineer** | 48-hour continuous monitoring | 2026-05-07 22:30 → 2026-05-09 22:30 (12h shifts) |
| **Auditor** | Real-world workflow validation | 2026-05-08 08:00–17:00 UTC |

---

## Related Documents

**In this phase directory:**
- `README.md` — Navigation guide (start here)
- `PHASE_15_DETAILED_PLAN.md` — Full execution guide
- `PHASE_15_EXECUTIVE_SUMMARY.md` — Stakeholder overview
- `PHASE_15_DEPLOYMENT_CHECKLIST.md` — Live deployment checklist

**In project root:**
- `.claude/rules/deploy-protocol.md` — Deploy sequence + rules
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — Cloud logs setup
- `scripts/monitor-cloud-logs.sh` / `.ps1` — Monitoring automation
- `.planning/milestones/v1.4-ROADMAP.md` — Full v1.4 context

---

## FAQ

**Q: What if Phase 14 code isn't fully tested?**
A: Phase 15 cannot proceed. Phase 14 must be 100% complete (all tests passing, no outstanding PRs).

**Q: Can I skip the 48-hour monitoring?**
A: No. 48h monitoring is non-negotiable for production stability verification.

**Q: What if a step takes longer than expected?**
A: Document the time extension, but proceed through all 4 steps in sequence same day.

**Q: Do I need auditor present during deployment?**
A: No. Auditor only needed for real-world validation (2026-05-08 business hours).

**Q: What's the worst-case scenario?**
A: P0 incident detected during 48h monitoring → execute rollback → back to v1.3 live → post-mortem for v1.4.1.

---

## What Happens Next (Phase 4)

After Phase 15 is complete and v1.4 is "LIVE," Phase 4 begins **2026-05-20**:

**Phase 4: CAPA Closure & Process Execution**
- Duration: 2–3 weeks
- Owner: Auditor-led (with tech team support)
- Goal: Close 8 CAPA items from Phase 8
- Success: Auditor sign-off on compliance closure

See `.planning/milestones/v1.4-ROADMAP.md` § Phase 4 for full details.

---

## Document Metadata

| Property | Value |
|----------|-------|
| Phase | 15 |
| Milestone | v1.4 |
| Status | Planning complete, ready for execution |
| Duration | 3 calendar days (105 min deployment + 48h monitoring) |
| Owner | DevOps Lead + QA Lead + On-Call Engineer |
| CTO Gate | Authorization required before Step 1 |
| Created | 2026-05-07 |
| Version | 1.0 |

---

**Phase 15 is ready for execution.**  
**Awaiting CTO authorization to proceed.**  
**Start time: 2026-05-07 20:00 UTC**
