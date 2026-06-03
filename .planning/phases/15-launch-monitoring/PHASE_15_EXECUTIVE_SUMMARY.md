---
phase: 15
title: 'Phase 15 Executive Summary — v1.4 Launch & Post-Deploy Monitoring'
date: 2026-05-07
status: ready-for-execution
---

# Phase 15 Executive Summary

## What This Phase Does

Phase 15 executes the **production deployment of v1.4** (4-step sequence: Rules+Indexes → Functions → Hosting → Smoke Tests) and validates production health over 48 hours of continuous cloud logs monitoring.

This is the **final operational gate** before v1.4 is declared "live" and Phase 4 (CAPA Closure sequence) begins.

---

## Context

- **v1.3 Status:** Complete & live since 2026-05-07, DICQ baseline 78–82%, 35 modules in production
- **v1.4 Readiness:** Phase 14 code complete, all tests passing, CTO authorization obtained
- **v1.4 Scope:** 5 new modules (Bioquímica, Liberação, Críticos, Reclamações, SGD), CAPA infrastructure, Riopomba migration (80 docs)
- **Dependency:** All Phase 0–14 tasks merged to main; no outstanding blockers

---

## The 4-Step Deployment Sequence

### Step 1: Firestore Rules + Indexes (30 min)

**Owner:** DevOps Lead + QA Lead

- Pre-deploy: type-check + rules validation (`firebase deploy --dry-run`)
- Deploy: Rules first, then Indexes
- Gate: 0 permission errors in cloud logs (sanity check)
- Safety: Indexes may take 5–15 min to build in background (non-blocking for functions)

**Risk:** Schema mismatch between client and rules → permission denied errors on legitimate traffic

**Mitigation:** Rules reviewed + emulator smoke tested; revert on error within 3 min

### Step 2: Cloud Functions (50+ new callables) (40 min)

**Owner:** DevOps Lead + on-call engineer

- Pre-deploy security gate: `bash scripts/preflight-secrets-check.sh` (must be 0/green)
- Deploy: Functions per region `southamerica-east1`
- Validation: Invoke 3 high-traffic callables (NOTIVISA, portal-config, pub/sub check)
- Cold-start smoke: Expected 2–4s latency on first invocation (OK)

**Risk:** Missing secret (GEMINI_API_KEY, RESEND_API_KEY) → deploy succeeds but function fails at runtime

**Mitigation:** Preflight gate blocks deploy if secrets undefined; fallback: `--allow-pending-secrets` (emergency only, logged)

### Step 3: Hosting (30 min)

**Owner:** DevOps Lead

- Pre-deploy: Type-check, build, bundle size sanity
- Deploy: `firebase deploy --only hosting`
- Validation: PWA service worker check (fresh session), offline mode test
- Expected: ~XXX files, ~XX MB total size

**Risk:** PWA cache mismatch → user sees stale UI post-deploy

**Mitigation:** `registerType: 'autoUpdate'` handles this; users need Ctrl+Shift+R (documented in deploy-protocol)

### Step 4: Production Smoke Tests (45 min)

**Owner:** QA Lead + on-call engineer

**8 test cases covering critical paths:**

1. **AU-01** — Auditor login + role access
2. **CR-01** — Critical value escalation (NOTIVISA SMS)
3. **PR-01** — Patient portal laudo download
4. **DH-01** — Hub dashboard tiles + real-time data
5. **CQ-01** — Bioquímica CIQ entry + Levey-Jennings chart
6. **SG-01** — SGQ document list + version history
7. **FB-01** — NPS feedback submission (no PII leakage)
8. **FB-02** — Complaint intake + RT notification

**Gate:** All 8 pass without 5xx errors. Minor latency spikes acceptable.

---

## 48-Hour Cloud Logs Monitoring

**Timeline:** 2026-05-07 22:30 UTC → 2026-05-09 22:30 UTC

**Model:** Continuous automated script + manual spot-checks every 6 hours

**Owner:** On-call engineer (12h rotating shifts) + QA lead (oversight)

### What We Monitor

| Layer           | Filter                                                                 | Red Flags                                                  | Expected                                          |
| --------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| Cloud Functions | `resource.type="cloud_function" AND severity >= ERROR`                 | `Timeout`, `undefined is not a function`, `out of memory`  | <5 errors per 50K invocations                     |
| Firestore       | `resource.type="cloud_firestore"`                                      | `Permission denied`, `Rate exceeded`, `Document too large` | 0 permission; 0–2 rate warnings                   |
| Hosting         | `resource.type="cloud_run"` OR `resource.labels.service="hmatologia2"` | `5xx` status, latency >5s                                  | 0 errors; LCP <2.5s                               |
| NOTIVISA        | `function_name="notivisa-send" AND severity >= ERROR`                  | Any error (P0)                                             | 0 errors                                          |
| Gemini API      | `text:"gemini" AND severity >= ERROR`                                  | Timeout, API limit, bad input                              | <10 errors per 48h (acceptable for IA foundation) |

### Incident Escalation

| Severity | Examples                                                  | SLA                | Action                                                  |
| -------- | --------------------------------------------------------- | ------------------ | ------------------------------------------------------- |
| **P0**   | NOTIVISA down, Firestore rules blocking, auth unavailable | <5 min acknowledge | Escalate → immediate investigation → potential rollback |
| **P1**   | Function taking >10s, module 10% error rate, rate-limited | <2h resolve        | Escalate → log for v1.4.1 post-launch patch             |
| **P2**   | Single timeout, transient OAuth, slow module              | <24h address       | Document → plan for v1.4.1                              |

### Rollback Trigger

If P0 incident **cannot be fixed in 15 minutes**, execute rollback:

- Revert to pre-deploy commit
- Re-deploy in sequence (Rules → Functions → Hosting)
- Smoke test (5 min)
- Post-mortem (1h after resolution)

---

## Real-World Smoke Tests (Business Hours)

**Timeline:** 2026-05-08 08:00–17:00 UTC

**Participants:** Auditor, RT (lab), QA lead

**Purpose:** Validate production mirrors staging for regulatory-critical workflows

### Workflows Tested

1. **Auditor Compliance Review** (30 min)
   - SGD module: 80 Riopomba docs migrated
   - Audit trail: version history + approval chain
   - Sign-off: "SGD module ready for audit"

2. **RT Critical Value Response** (45 min)
   - Create high glucose result (>500 mg/dL)
   - Measure latency: Time from "Mark Critical" to RT notification
   - SLA validation: <2 min end-to-end (RDC 978 Art. 184)

3. **Patient Portal** (20 min)
   - Laudo download (PDF signature verification)
   - Design validation (dark mode, typography)

4. **Portal Médico** (20 min, optional if Phase 10.06 complete)
   - Sharable link creation
   - Doctor read-only access
   - Link expiration (30 days)

5. **Feedback Loop** (15 min)
   - NPS submission with PII check (name excluded)
   - Complaint intake + RT routing

---

## Metrics Captured

Post-48h monitoring, QA lead compiles `METRICS_BASELINE_v1.4.json`:

```json
{
  "dicq_compliance": "78–82%",
  "rdc_978_coverage": "90%+",
  "web_vitals": {
    "lcp": "1.8s (p50)",
    "inp": "120ms (p50)",
    "cls": "0.02 (p50)"
  },
  "cloud_functions": {
    "cold_start_avg": "2.5s",
    "error_rate": "<0.01%"
  },
  "sms_delivery": "99.3%",
  "email_delivery": "99.7%"
}
```

---

## v1.4 Closure (Post-Monitoring)

### Deliverables

1. **DEPLOYMENT_LOG_v1.4.md** — Step-by-step timeline + metrics
2. **MONITORING_REPORT_v1.4.pdf** — 48h cloud logs summary + incidents
3. **METRICS_BASELINE_v1.4.json** — DICQ/RDC/Web Vitals snapshot
4. **LESSONS_LEARNED.md** — What went well, improvements for v1.5
5. **Updated STATE.md** — v1.4 live, ready for Phase 4

### Sign-Offs

- [ ] **CTO approval** — "v1.4 LIVE" authorization
- [ ] **Auditor acknowledgment** — "Compliance baseline verified"
- [ ] **DevOps sign-off** — "0 P0 incidents, production stable"

### v1.5 Kickoff (2026-05-10 09:00 UTC)

30-min meeting to align on:

- Phase 4 readiness (CAPA closure sequence, auditor timeline)
- Phase 5–7 planning (portal expansion, RDC Part 2, DICQ → 88%)
- Resource allocation (4 parallel streams)
- Next milestone gate (Phase 4 detailed plan + requirements)

---

## Key Success Criteria

| Criterion                       | Target                     | Status                 |
| ------------------------------- | -------------------------- | ---------------------- |
| All 4 deploy steps execute      | ✓ No blockers              | TBD (2026-05-07 20:00) |
| 0 P0 incidents during 48h       | ✓ None                     | TBD (2026-05-09 22:30) |
| Smoke tests 8/8 passing         | ✓ All green                | TBD (2026-05-07 22:30) |
| DICQ baseline captured          | ✓ 78–82%                   | TBD                    |
| RDC 978 Arts. 117, 167, 179-191 | ✓ 90%+                     | TBD                    |
| Real-world RT validation        | ✓ <2 min critical response | TBD                    |
| Auditor sign-off                | ✓ Complete                 | TBD                    |
| v1.5 Phase 4 readiness          | ✓ Documented               | TBD                    |

---

## Critical Dependencies & Assumptions

### Must Be True (Blocking)

1. **Phase 14 complete & merged** — All code reviewed, tested, no outstanding merge conflicts
2. **CTO authorization email** — Explicit "proceed with Phase 15" before Step 1
3. **Secrets provisioned** — All `defineSecret()` calls resolve to actual values (not PENDING\_\*)
4. **On-call engineer assigned** — Named person + phone number for 48h window
5. **GCP credentials live** — `gcloud auth` + `firebase projects:list` working

### Nice to Have (Non-Blocking)

- Pre-create test accounts (auditor, patient, RT) for smoke tests
- Stage monitoring scripts on local machine
- Slack war room pre-created
- Notification channels (PagerDuty, Slack) tested

---

## Timeline at a Glance

```
2026-05-07
├─ 20:00–20:30  Step 1: Firestore Rules + Indexes (30 min)
├─ 20:35–21:15  Step 2: Cloud Functions (40 min)
├─ 21:15–21:45  Step 3: Hosting (30 min)
├─ 21:45–22:30  Step 4: Smoke Tests (45 min)
└─ 22:30        → START 48h Monitoring

2026-05-08
├─ 00:00–22:30  Monitoring + spot-checks (12h rotations)
└─ 08:00–17:00  Real-world smoke tests (RT + auditor)

2026-05-09
├─ 22:30        → END 48h Monitoring
├─ 23:00–04:00  v1.4 Closure tasks (merge, STATE.md, logs export, lessons-learned)
└─ 09:00        v1.5 Phase 4 kickoff

2026-05-10
└─ (Next phase begins: Phase 4 CAPA Closure sequence)
```

---

## Owner & Escalation

| Role             | Name   | Email   | Phone   | Shift                                               |
| ---------------- | ------ | ------- | ------- | --------------------------------------------------- |
| CTO              | [Name] | [email] | [phone] | Approval gate only                                  |
| DevOps Lead      | [Name] | [email] | [phone] | 2026-05-07 all day                                  |
| QA Lead          | [Name] | [email] | [phone] | 2026-05-07 all day + 2026-05-08/09 spot-checks      |
| On-Call Engineer | [Name] | [email] | [phone] | 2026-05-07 22:30 → 2026-05-09 22:30 (12h rotations) |
| Auditor          | [Name] | [email] | [phone] | 2026-05-08 09:00–17:00 (real-world tests)           |

---

## Next Phase (Phase 4 – CAPA Closure)

After v1.4 is "LIVE" and Phase 15 complete, Phase 4 begins on 2026-05-20:

- **Duration:** 2–3 weeks (auditor-led, parallel with Phase 5–7)
- **Goal:** Close 8 CAPA items identified in Phase 8 + auditor feedback loop
- **Success Criteria:** Auditor sign-off on compliance closure + zero blocking findings
- **Deliverables:** Phase 8 Plans 05–07 execution + auditor attestation

---

## Document References

- **Detailed Plan:** `.planning/phases/15-launch-monitoring/PHASE_15_DETAILED_PLAN.md` (this file's sibling)
- **v1.4 Roadmap:** `.planning/milestones/v1.4-ROADMAP.md`
- **v1.3 Completion:** `.planning/milestones/v1.3-COMPLETION-SUMMARY.md`
- **Deploy Protocol:** `.claude/rules/deploy-protocol.md`
- **Cloud Logs Guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`

---

**Phase 15 Status:** Ready for execution (2026-05-07 19:00 UTC gate approval)
**Document Version:** 1.0
**Last Updated:** 2026-05-07
