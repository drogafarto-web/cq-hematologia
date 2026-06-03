# Phase 3 Wave 1 Cloud Logs Monitoring — Document Index

**Quick Navigation for Phase 3 Deployment (2026-05-08 → 2026-05-14)**

---

## For Different Audiences

### 👔 CTO (Sign-Off Required)

1. **Start here:** `PHASE3_MONITORING_EXEC_SUMMARY.md` (3 min read)
   - What's been set up
   - Key metrics baseline
   - Timeline & success criteria
   - One-page sign-off checklist

### 🛠️ DevOps / On-Call (Monitoring Execution)

1. **Start here:** `PHASE3_MONITORING_README.md` (10 min read)
   - Monitoring architecture (5-layer stack)
   - Quick-start commands
   - Timeline with actionable milestones
   - Escalation chain

2. **During Wave 1:** Keep these open side-by-side
   - `HEALTH_CHECK_DASHBOARD.md` — Update every 30 min (live KPI tracker)
   - `ALERT_CHECKLIST_PHASE3.md` — Reference on any alert (P0/P1/P2 playbook)

3. **Post-Wave 1:** Review & archive
   - `CLOUD_LOGS_BASELINE.md` — Verify sign-off criteria met
   - `CLOUD_LOGS_WAVE1_REPORT.md` — Generate at T+24h

### 📊 QA / Test Engineer (Smoke Testing)

1. **Start here:** `ALERT_CHECKLIST_PHASE3.md` → Stage 5: Smoke Tests section
   - 4 critical tests required
   - Expected outcomes
   - Success criteria (4/4 pass in <5s each)

### 📈 Project Manager (Status Tracking)

1. **Start here:** `HEALTH_CHECK_DASHBOARD.md`
   - 5-stage deployment timeline
   - Real-time KPI snapshot
   - Smoke test results
   - Compliance status (RDC 978 / DICQ)

---

## Document Descriptions

### PHASE3_MONITORING_EXEC_SUMMARY.md

**For:** CTO sign-off  
**Length:** 2 pages  
**Key Content:**

- What's been set up (3 docs + 1 script)
- Key metrics baseline (errors, latency, compliance)
- 30-minute Wave 1 timeline
- Success criteria (all must pass for Wave 2)
- One-page checklist (before/during/after)

**Action:** Read now, sign off before T0

---

### PHASE3_MONITORING_README.md

**For:** DevOps / ops team  
**Length:** 5 pages  
**Key Content:**

- 5-layer monitoring architecture
- Quick-start: 3 monitoring commands (baseline, intensive, post-deploy)
- Full Phase 3 Wave 1 timeline (T-24h → T+24h)
- Alert quick reference (P0/P1/P2)
- Monitoring command cheat sheet

**Action:** Reference during Wave 1; update HEALTH_CHECK_DASHBOARD.md per milestones

---

### CLOUD_LOGS_BASELINE.md

**For:** Pre/post comparison, sign-off  
**Length:** 6 pages  
**Key Content:**

- Pre-deployment baseline (T-24h snapshot)
- Wave 1 deployment plan (5 stages, 30m total)
- Parallel stream assignments (Streams A/D primary)
- Post-deployment monitoring plan (24h window)
- Alert thresholds (P0/P1/P2)
- Sign-off checklist (pre-deploy, during, post-deploy, rollback)

**Action:** Reference pre-deploy; check baseline in HEALTH_CHECK_DASHBOARD.md; verify sign-off criteria at T+24h

---

### ALERT_CHECKLIST_PHASE3.md

**For:** Real-time escalation playbook  
**Length:** 7 pages  
**Key Content:**

- Severity levels: 🔴 P0 (STOP), 🟡 P1 (ESCALATE), 🟠 P2 (LOG)
- Per-stage alert watch lists (Stage 1–5)
- Real-time monitoring commands (gcloud syntax)
- Escalation chain (Slack → CTO → rollback decision)
- Post-alert response playbook (rollback, investigate, continue)
- Alert thresholds summary (1-page quick ref)

**Action:** **Consult immediately on any alert.** Tells you exact action (stop, investigate, or continue).

---

### HEALTH_CHECK_DASHBOARD.md

**For:** Live KPI tracker (update every 30 min)  
**Length:** 8 pages  
**Key Content:**

- Real-time status board (deployment stage progress)
- Cloud Logs health snapshot (errors, trend)
- 5 deployment stage checklists (what to verify per stage)
- Post-deployment 24h monitoring hourly snapshot table
- KPI trends: error rate, index readiness, rules warnings, function latency
- Smoke test results
- Compliance snapshot (RDC 978 / DICQ)
- Dashboard update procedure (collect → update → check alerts → commit)

**Action:** Update every 30 min during Wave 1; fill in values from monitoring script output & gcloud queries

---

## Monitoring Script Reference

**File:** `scripts/monitor-cloud-logs.ps1` (already deployed, tested v1.3)

**Commands:**

```powershell
# T-24h: 24h baseline (pre-deploy)
pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30

# T0 → T+30m: 5-minute intensive (during deployment)
pwsh scripts/monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5

# T+30m → T+24h: 30-minute standard (post-deploy wave)
pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30 -StartTime "2026-05-08T23:30:00Z"
```

**Outputs:**

- JSON export: `scripts/cloud-logs-export-[timestamp].json`
- Markdown report: `docs/MONITORING_REPORT_[timestamp].md`

---

## Phase 3 Wave 1 Timeline At A Glance

```
T-24h (2026-05-07 23:00 UTC)
  └─→ Start baseline collection
      └─→ Record pre-deploy metrics

T0 (2026-05-08 23:00 UTC) — WAVE 1 BEGINS
  ├─→ Stage 1 (T+0m → T+5m): Schema (5 collections + 3 indexes)
  ├─→ Stage 2 (T+5m → T+10m): Rules v1.4 (portal, NOTIVISA, critical gates)
  ├─→ Stage 3 (T+10m → T+20m): Shared Helpers (4 functions)
  ├─→ Stage 4 (T+20m → T+25m): Base Structures (3 callables)
  └─→ Stage 5 (T+25m → T+30m): Smoke Tests (4 critical flows)

T+30m (2026-05-08 23:30 UTC) — WAVE 1 COMPLETE
  └─→ Begin 24h monitoring window
      └─→ Update HEALTH_CHECK_DASHBOARD.md hourly

T+24h (2026-05-09 23:30 UTC) — MONITORING COMPLETE
  └─→ Export final logs
      └─→ Generate CLOUD_LOGS_WAVE1_REPORT.md
      └─→ CTO review & sign-off
      └─→ Proceed to Wave 2 (if criteria met)
```

---

## Alert Escalation At A Glance

| Alert                 | Severity | Action                                  | Reference                      |
| --------------------- | -------- | --------------------------------------- | ------------------------------ |
| >10 errors in 30m     | 🔴 P0    | **STOP deployment** → export logs → CTO | ALERT_CHECKLIST_PHASE3.md § P0 |
| 1+ CRITICAL event     | 🔴 P0    | **STOP immediately** → investigate      | ALERT_CHECKLIST_PHASE3.md § P0 |
| Rules compile fail    | 🔴 P0    | **Revert rules** → debug → CTO          | ALERT_CHECKLIST_PHASE3.md § P0 |
| Index FAILED state    | 🔴 P0    | **Contact GCP** → pause functions       | ALERT_CHECKLIST_PHASE3.md § P0 |
| >5 permission denies  | 🟡 P1    | Investigate rules (can continue)        | ALERT_CHECKLIST_PHASE3.md § P1 |
| Rules warnings >22    | 🟡 P1    | Review syntax (no deploy hold)          | ALERT_CHECKLIST_PHASE3.md § P1 |
| Function timeout >10s | 🟡 P1    | Profile function, check indexes         | ALERT_CHECKLIST_PHASE3.md § P1 |
| Index creation delay  | 🟠 P2    | Expected; monitor until READY           | ALERT_CHECKLIST_PHASE3.md § P2 |

---

## Success Criteria Summary

### Stage Completion (T0 → T+30m)

- [ ] Stage 1: 5 collections created, 3 indexes CREATING, 0 errors
- [ ] Stage 2: Rules deploy success, warnings ≤20, 0 permission denies (authorized)
- [ ] Stage 3: 4 functions deployed, cold-start <300ms, warm <100ms
- [ ] Stage 4: 3 callables deployed, response <100ms
- [ ] Stage 5: 4/4 smoke tests PASS in <5s each

### 24h Post-Deploy Window (T+30m → T+24h)

- [ ] ERROR logs: 0 (target), <5 (acceptable)
- [ ] All 25 indexes: READY
- [ ] Rules warnings: ≤20 (stable)
- [ ] Function p95 latency: <200ms
- [ ] Compliance: RDC 978 95%+, DICQ 78.5%+ (maintained)

### Wave 1 Sign-Off (Required for Wave 2)

- [ ] All stage completion criteria met
- [ ] 24h monitoring window with 0 sustained errors
- [ ] CLOUD_LOGS_WAVE1_REPORT.md generated
- [ ] CTO approval (signature on sign-off checklist)

---

## File Locations (Absolute Paths)

```
C:\hc quality\.planning\phases\03-schema-extensions\

📄 MONITORING_INDEX.md ......................... This file (nav guide)
📄 PHASE3_MONITORING_EXEC_SUMMARY.md ........ CTO summary (read first)
📄 PHASE3_MONITORING_README.md ............... Full architecture (reference)
📄 CLOUD_LOGS_BASELINE.md .................... Pre/post baseline
📄 ALERT_CHECKLIST_PHASE3.md ................. Escalation playbook
📄 HEALTH_CHECK_DASHBOARD.md ................. Live KPI tracker (update 30m)

[To be created during/after Wave 1]
📄 CLOUD_LOGS_WAVE1_REPORT.md ................ Final report (T+24h)
📄 COMPLIANCE_SNAPSHOT_POST_WAVE1.md ........ Compliance after Wave1

Scripts (already deployed):
📄 C:\hc quality\scripts\monitor-cloud-logs.ps1 .. Monitoring script
```

---

## How to Use This Index

**I'm the CTO:**

1. Read PHASE3_MONITORING_EXEC_SUMMARY.md (2 min)
2. Skim ALERT_CHECKLIST_PHASE3.md § Alert Severity (1 min)
3. Sign off on summary checklist (1 min)

**I'm on DevOps/ops:**

1. Read PHASE3_MONITORING_README.md (10 min)
2. Before T0: Run baseline → `pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30`
3. At T0: Switch to intensive → `pwsh scripts/monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5`
4. During Wave 1: Keep HEALTH_CHECK_DASHBOARD.md & ALERT_CHECKLIST_PHASE3.md visible
5. Update dashboard every 30 min with metrics from script output
6. On any alert: Check ALERT_CHECKLIST_PHASE3.md for action

**I'm QA:**

1. Read ALERT_CHECKLIST_PHASE3.md § Stage 5: Smoke Tests
2. Execute 4 tests per checklist
3. Record results in HEALTH_CHECK_DASHBOARD.md

**I'm project manager:**

1. Bookmark HEALTH_CHECK_DASHBOARD.md
2. Check every 2 hours during Wave 1 for stage progress
3. Review final report at T+24h

---

## Critical Moments (Don't Miss These)

| Time         | Event                 | Action                                              | Owner  |
| ------------ | --------------------- | --------------------------------------------------- | ------ |
| **T-1h**     | Final briefing        | Review alert escalation chain                       | CTO    |
| **T-24h**    | Baseline starts       | Run monitoring script                               | DevOps |
| **T0**       | Wave 1 begins         | Switch to intensive monitoring (5m intervals)       | DevOps |
| **T+5m**     | Stage 1 ends          | Verify: 5 collections, 3 indexes CREATING, 0 errors | CTO    |
| **T+10m**    | Stage 2 ends          | Verify: Rules deployed, warnings ≤20                | CTO    |
| **T+20m**    | Stage 3 ends          | Verify: 4 functions, latency <300ms                 | CTO    |
| **T+25m**    | Stage 4 ends          | Verify: 3 callables, response <100ms                | CTO    |
| **T+30m**    | Stage 5 ends          | Verify: 4/4 smoke tests PASS                        | QA     |
| **T+30m**    | Monitoring starts     | Switch to standard 30m intervals                    | DevOps |
| **T+2h**     | Index readiness check | All 25 indexes should be READY                      | DevOps |
| **T+24h**    | Monitoring ends       | Export logs, generate final report                  | DevOps |
| **T+24h+1h** | CTO review            | Read CLOUD_LOGS_WAVE1_REPORT.md                     | CTO    |
| **T+24h+2h** | Sign-off              | Approve Wave 2 proceeding                           | CTO    |

---

## Common Scenarios

### "We got an alert. What do I do?"

1. **Note timestamp** and alert type
2. **Open ALERT_CHECKLIST_PHASE3.md**
3. **Find your alert in the severity matrix** (P0/P1/P2)
4. **Follow the "Immediate Action" steps**
5. **Escalate to CTO** if P0, investigate if P1, log if P2

Example: "We have >10 errors in last 30m"
→ ALERT_CHECKLIST_PHASE3.md § P0 § ERROR Rate Spike
→ 1. Stop deployment, 2. Export logs, 3. Notify CTO, 4. Assess rollback

### "Deployment is progressing. How do I stay on top of it?"

1. **Keep HEALTH_CHECK_DASHBOARD.md open**
2. **Every 30 minutes:**
   - Run the monitoring script output
   - Copy error count, latency, index status into dashboard
   - Update stage completion status
   - Commit changes to git
3. **Run manual diagnostics** (gcloud commands in PHASE3_MONITORING_README.md § Cheat Sheet)

### "Wave 1 is complete. What happens next?"

1. **At T+24h:** Monitoring script finishes
2. **Export final logs:** `gcloud logging read ... --format=json > scripts/cloud-logs-phase3-wave1-final.json`
3. **Generate report:** CLOUD_LOGS_WAVE1_REPORT.md (template in CLOUD_LOGS_BASELINE.md)
4. **CTO review:** Read report, verify all sign-off criteria met
5. **CTO sign-off:** Approve Wave 2 proceeding (or escalate if issues)

---

## References & Resources

**Internal Documents:**

- `.planning/phases/03-schema-extensions/03-PLAN.md` — Full Phase 3 plan
- `.claude/docs/CLOUD_LOGS_MONITORING_GUIDE.md` — v1.3 reference (read-only)
- `.claude/docs/CLOUD_LOGS_QUICK_REFERENCE.md` — gcloud commands

**External Resources:**

- GCP Cloud Logs Console: https://console.cloud.google.com/logs/query
- Firestore Indexes: https://console.cloud.google.com/firestore/indexes
- Cloud Functions: https://console.cloud.google.com/functions
- Project: `hmatologia2` in GCP console

**Contacts:**

- CTO: [Name] — sign-off, escalation decisions
- DevOps: [Name] — monitoring execution, diagnostics
- Rules Auditor: [Name] — rules validation
- QA: [Name] — smoke test execution

---

## Verification Checklist (Before T0)

- [ ] All 5 monitoring documents reviewed by relevant teams
- [ ] PHASE3_MONITORING_EXEC_SUMMARY.md signed by CTO
- [ ] `scripts/monitor-cloud-logs.ps1` tested and working
- [ ] GCP credentials configured: `gcloud config set project hmatologia2`
- [ ] PowerShell 5.1+ available (run `$PSVersionTable.PSVersion`)
- [ ] Team briefed on alert escalation chain
- [ ] HEALTH_CHECK_DASHBOARD.md template saved in shared drive (or pinned in Slack)
- [ ] Rollback procedure documented in team wiki
- [ ] CTO available for on-call during Wave 1

---

## Next Steps

1. **CTO:** Read PHASE3_MONITORING_EXEC_SUMMARY.md, sign off
2. **DevOps:** Read PHASE3_MONITORING_README.md, prepare monitoring commands
3. **QA:** Review ALERT_CHECKLIST_PHASE3.md § Stage 5, prepare smoke tests
4. **All:** Brief on alert escalation chain
5. **At T-24h:** Start baseline monitoring
6. **At T0:** Proceed to Wave 1 deployment

---

**Status:** ✅ READY FOR PHASE 3 WAVE 1 (2026-05-08 23:00 UTC)

**Last Updated:** 2026-05-08  
**Owner:** DevOps + CTO  
**Next Review:** Post-Wave 1 (2026-05-09 23:30 UTC)

---

**For Questions:** See relevant document section above or contact team leads.

**For Alerts During Wave 1:** Consult ALERT_CHECKLIST_PHASE3.md immediately.

---

**END OF MONITORING INDEX**
