# Phase 15 — v1.4 Launch & Post-Deploy Monitoring

## Overview

Phase 15 is the **final operational gate** before v1.4 is declared "live in production." It encompasses:

1. **4-step production deployment** (Rules+Indexes → Functions → Hosting → Smoke Tests)
2. **48-hour continuous cloud logs monitoring** (automated + manual spot-checks)
3. **Real-world validation** (RT + auditor workflows)
4. **Metrics capture** (DICQ, RDC, Web Vitals, function costs)
5. **v1.4 closure** (deployment log, lessons learned, v1.5 kickoff)

**Timeline:** 2026-05-07 20:00 UTC → 2026-05-09 22:30 UTC (3 calendar days)  
**Owner:** DevOps Lead + QA Lead + On-Call Engineer  
**CTO Authorization:** Required before Step 1

---

## Documents in This Phase

### 1. **PHASE_15_DETAILED_PLAN.md** (Primary Execution Plan)

Comprehensive, step-by-step operational guide. Use this for:

- Pre-deployment checklist
- 4-step deployment sequence with validation gates
- 48-hour monitoring setup and filter patterns
- Smoke test procedures (8 test cases with expected outcomes)
- Real-world validation workflows
- Metrics capture methodology
- Incident escalation thresholds + rollback procedure
- v1.4 closure tasks
- v1.5 kickoff alignment

**Read this if:** You need to understand the full execution plan or troubleshoot during deployment.

---

### 2. **PHASE_15_EXECUTIVE_SUMMARY.md** (High-Level Overview)

CTO/auditor-friendly summary. Answers:

- What does Phase 15 do?
- What are the 4 deployment steps?
- What is the monitoring strategy?
- What success criteria must be met?
- What are the key risks and dependencies?
- What comes next (Phase 4 / v1.5)?

**Read this if:** You're the CTO, auditor, or project manager needing quick context.

---

### 3. **PHASE_15_DEPLOYMENT_CHECKLIST.md** (Quick Reference)

Print-friendly checklist for live deployment. Contains:

- Pre-execution gate checklist (things that must be done before 2026-05-07 19:00)
- Step 1–4 detailed checklists with copy-paste commands
- 48-hour monitoring startup command
- War room communication template
- Real-world smoke test checklist
- Closure task checklist
- Emergency rollback procedure

**Use this if:** You're running the deployment live. Print it, check off as you go.

---

### 4. **README.md** (This File)

Navigation guide to Phase 15 documents.

---

## When to Use Each Document

| Situation                     | Use This                        | Why                         |
| ----------------------------- | ------------------------------- | --------------------------- |
| Planning Phase 15 execution   | DETAILED_PLAN                   | Full operational context    |
| Brief executive stakeholders  | EXECUTIVE_SUMMARY               | Quick context + key metrics |
| Live deployment happening now | DEPLOYMENT_CHECKLIST            | Step-by-step + commands     |
| Understanding the phase       | README                          | Navigation                  |
| Post-mortem after Phase 15    | DETAILED_PLAN + LESSONS_LEARNED | Full context + learnings    |

---

## Key Milestones

```
2026-05-07 19:00 UTC
└─ Pre-execution gate: CTO authorization + dependencies verified
│
2026-05-07 20:00 UTC
├─ Step 1: Firestore Rules + Indexes deploy (30 min) [DETAILED_PLAN §1]
├─ Step 2: Cloud Functions deploy (40 min) [DETAILED_PLAN §2]
├─ Step 3: Hosting deploy (30 min) [DETAILED_PLAN §3]
└─ Step 4: Production smoke tests (45 min) [DETAILED_PLAN §4]
│
2026-05-07 22:30 UTC
└─ START 48-hour cloud logs monitoring [DETAILED_PLAN §5]

2026-05-08 08:00 UTC
└─ Real-world smoke tests begin (RT + auditor) [DETAILED_PLAN §6]

2026-05-09 22:30 UTC
└─ END 48-hour monitoring

2026-05-09 23:00 UTC
└─ v1.4 Closure tasks [DETAILED_PLAN §7]

2026-05-10 09:00 UTC
└─ v1.5 Phase 4 kickoff
```

---

## Critical Success Criteria

For Phase 15 to be "complete," ALL of the following must be true:

1. ✓ All 4 deploy steps executed successfully (no blockers)
2. ✓ 48-hour monitoring: 0 P0 incidents
3. ✓ 8/8 smoke test cases passing
4. ✓ Real-world validation: RT + auditor sign-off
5. ✓ Metrics captured: DICQ 78–82%, RDC 90%+, Web Vitals green
6. ✓ Closure deliverables: DEPLOYMENT_LOG, LESSONS_LEARNED, METRICS_BASELINE
7. ✓ CTO + auditor approvals documented

---

## Dependencies (Blocking)

All must be complete before Step 1:

- ✓ Phase 14 code merged to main + tested
- ✓ CTO authorization email received
- ✓ On-call engineer assigned (name + phone)
- ✓ GCP credentials live (`gcloud auth`, `firebase auth`)
- ✓ Secrets provisioned (GEMINI_API_KEY, RESEND_API_KEY, etc.)
- ✓ Test accounts created (auditor, patient, RT)

---

## Roles & Responsibilities

| Role                 | Primary Duty              | Phase 15 Window                                     |
| -------------------- | ------------------------- | --------------------------------------------------- |
| **CTO**              | Approval gate             | Async email: pre-deploy + post-closure              |
| **DevOps Lead**      | Deploy execution          | 2026-05-07 20:00–21:45 UTC (all day available)      |
| **QA Lead**          | Smoke tests + spot-checks | 2026-05-07 21:45–22:30 UTC + daily 6h rotations     |
| **On-Call Engineer** | 48h monitoring            | 2026-05-07 22:30 → 2026-05-09 22:30 (12h rotations) |
| **Auditor**          | Real-world validation     | 2026-05-08 08:00–17:00 UTC (business hours)         |

---

## Quick Command Reference

### Pre-Deployment

```bash
# Type-check
npx tsc --noEmit

# Secrets gate
bash scripts/preflight-secrets-check.sh

# Build
npm run build
cd functions && npm run build
```

### Step 1: Rules + Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
```

### Step 2: Functions

```bash
firebase deploy --only functions --project hmatologia2 --region southamerica-east1
```

### Step 3: Hosting

```bash
firebase deploy --only hosting --project hmatologia2
```

### 48h Monitoring

```bash
# Bash (macOS/Linux)
bash scripts/monitor-cloud-logs.sh 48 30

# PowerShell (Windows)
.\scripts\monitor-cloud-logs.ps1 -Hours 48 -IntervalMinutes 30
```

### Emergency Rollback

```bash
git reset --hard [STABLE_COMMIT]
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2
```

---

## Incident Response

| Severity | Example                                              | SLA    | Action                               |
| -------- | ---------------------------------------------------- | ------ | ------------------------------------ |
| **P0**   | NOTIVISA down, rules block traffic, auth unavailable | <5 min | Escalate → immediate fix or rollback |
| **P1**   | Function 10% error rate, module slow, rate-limited   | <2h    | Escalate → log for v1.4.1 patch      |
| **P2**   | Single timeout, transient error, slow load           | <24h   | Document → plan for v1.4.1           |

For P0: If cannot fix in 15 minutes, execute rollback procedure (DEPLOYMENT_CHECKLIST §Emergency).

---

## Deliverables Produced During Phase 15

After closure, the following documents exist:

1. **DEPLOYMENT_LOG_v1.4.md** — Timeline + step results + metrics
2. **MONITORING_REPORT_v1.4.md** — 48h cloud logs summary
3. **MONITORING_REPORT_v1.4.pdf** — Formatted PDF export
4. **cloud-logs-export-v1.4.json** — Raw JSON logs for archival
5. **METRICS_BASELINE_v1.4.json** — DICQ/RDC/Web Vitals snapshot
6. **LESSONS_LEARNED.md** — What went well + improvements for v1.5
7. **Updated STATE.md** — v1.4 live status

Plus:

- Updated `CLAUDE.md` (module table + deployment status)
- Updated Obsidian roadmap
- CTO approval email (saved to docs)
- Auditor acknowledgment email (saved to docs)

---

## Next Phase (Phase 4 – CAPA Closure)

After Phase 15 is complete and v1.4 is "LIVE," Phase 4 begins **2026-05-20**:

- **Duration:** 2–3 weeks (auditor-led, parallel with Phases 5–7)
- **Goal:** Close 8 CAPA items from Phase 8 + auditor feedback loop
- **Deliverable:** Auditor sign-off on compliance closure + zero blocking findings

See `v1.4-ROADMAP.md` for full Phase 4 plan.

---

## Useful References

**From this project:**

- `PHASE_15_DETAILED_PLAN.md` — Full execution guide
- `PHASE_15_EXECUTIVE_SUMMARY.md` — High-level overview
- `PHASE_15_DEPLOYMENT_CHECKLIST.md` — Live deployment checklist

**From project root:**

- `.claude/rules/deploy-protocol.md` — Firebase deploy protocol
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — Cloud logs setup guide
- `docs/CLOUD_LOGS_QUICK_REFERENCE.md` — gcloud commands cheat sheet
- `scripts/monitor-cloud-logs.sh` — Bash monitoring script
- `scripts/monitor-cloud-logs.ps1` — PowerShell monitoring script
- `.planning/milestones/v1.4-ROADMAP.md` — Full v1.4 roadmap
- `.planning/milestones/v1.3-COMPLETION-SUMMARY.md` — v1.3 context

---

## FAQ

### Q: When exactly does Phase 15 start?

**A:** Phase 15 starts **2026-05-07 20:00 UTC** with Step 1 (Firestore Rules+Indexes deploy). Pre-execution gate must be cleared by **19:00 UTC** same day.

### Q: What if something breaks during deployment?

**A:** See "Incident Response" section above. For P0 incidents that cannot be fixed in 15 minutes, execute the rollback procedure (DEPLOYMENT_CHECKLIST §Emergency).

### Q: Can I deploy just one step at a time?

**A:** Yes, but follow the sequence strictly: Rules+Indexes → Functions → Hosting. Do NOT skip steps or reorder.

### Q: What if the 48h monitoring detects an error?

**A:** Depends on severity (P0/P1/P2). For P0, escalate immediately. For P1/P2, document and plan for v1.4.1 post-launch patch. See "Incident Response" table.

### Q: Who signs off that Phase 15 is complete?

**A:** CTO (async email) + Auditor (async email). Both must confirm in writing.

### Q: What comes after Phase 15?

**A:** v1.4 is "LIVE" and Phase 4 (CAPA Closure) begins 2026-05-20. See v1.4-ROADMAP.md for full Phase 4 plan.

---

## Document Metadata

| Property          | Value                                    |
| ----------------- | ---------------------------------------- |
| **Phase**         | 15                                       |
| **Milestone**     | v1.4                                     |
| **Start**         | 2026-05-07 20:00 UTC                     |
| **End**           | 2026-05-09 22:30 UTC                     |
| **Owner**         | DevOps Lead + QA Lead + On-Call Engineer |
| **Approval Gate** | CTO authorization                        |
| **Status**        | Ready for execution                      |
| **Version**       | 1.0                                      |
| **Last Updated**  | 2026-05-07                               |
| **Next Review**   | Post-Phase 15 completion (2026-05-10)    |

---

## Document Index

- **PHASE_15_DETAILED_PLAN.md** ← Main execution guide (read first)
- **PHASE_15_EXECUTIVE_SUMMARY.md** ← High-level overview for stakeholders
- **PHASE_15_DEPLOYMENT_CHECKLIST.md** ← Print & use during live deployment
- **README.md** ← This file (navigation)

---

**Phase 15 is ready for execution. CTO authorization required before 2026-05-07 20:00 UTC.**
