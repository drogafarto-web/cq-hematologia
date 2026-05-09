# Phase 3 Wave 1 Monitoring & Health Check Setup

**Mission:** Cloud Logs monitoring + health dashboard for Phase 3 (Schema Extensions).

**Deployment Window:** 2026-05-08 23:00 UTC → 2026-05-14 (Wave 1: Schema + Rules + Helpers, next waves: Portal UI + Mobile)

**Status:** ✅ READY FOR DEPLOYMENT

---

## What's in this Directory

### 📋 Documents

1. **`CLOUD_LOGS_BASELINE.md`** — Pre/post-deploy baseline comparison
   - Pre-deployment error snapshot (T-24h)
   - Expected post-deployment metrics
   - Deployment steps with monitoring milestones
   - Sign-off checklist
   - 🎯 **Use this:** To understand what "healthy" looks like for Phase 3

2. **`ALERT_CHECKLIST_PHASE3.md`** — Real-time escalation playbook
   - P0/P1/P2 alert severity matrix
   - Per-stage alert watch lists (5 deployment stages)
   - Command reference for immediate diagnostics
   - Escalation chain & rollback procedure
   - 🎯 **Use this:** When an alert fires; tells you exact action to take

3. **`HEALTH_CHECK_DASHBOARD.md`** — Live status tracker
   - Real-time deployment progress (5 stages)
   - KPI trends (errors, latency, indexes, warnings)
   - Compliance snapshot (RDC 978 / DICQ)
   - Smoke test status
   - 🎯 **Use this:** For continuous monitoring during Wave 1; update every 30 min

4. **`PHASE3_MONITORING_README.md`** — This file
   - Overview of monitoring setup
   - Quick-start instructions
   - File reference guide
   - Monitoring timeline
   - 🎯 **Use this:** To understand the monitoring architecture

---

## Quick Start: Enable Cloud Logs Monitoring

### Pre-Deployment (T-24h)

**1. Start baseline collection** (24h before Wave 1 deploy)

```powershell
# From C:\hc quality, run:
pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30
```

**What it does:**
- Queries Cloud Logs for last 24h every 30 minutes
- Counts ERROR severity events
- Exports JSON snapshot: `scripts/cloud-logs-export-baseline-[timestamp].json`
- Generates report: `docs/MONITORING_REPORT_[timestamp].md`

**Expected output (pre-Phase 3):**
```
ERROR logs in last 30m: 0
Firestore errors:       0
Function errors:        0
Hosting 5xx errors:     0

Total: 0 errors (baseline healthy)
```

### During Deployment (T0 → T+30m)

**2. Intensive monitoring** (during Wave 1 deployment)

```powershell
# Switch to 5-minute intervals during deployment
pwsh scripts/monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5
```

**Watch for:**
- Error count spike >10 in any 5m window = **P0 STOP** (see ALERT_CHECKLIST_PHASE3.md)
- Rules warnings jump >22 = **P1 ESCALATE**
- Permission denies for authorized users = **P1 INVESTIGATE**
- Any CRITICAL severity = **P0 ESCALATE IMMEDIATELY**

### Post-Deployment (T+30m → T+24h)

**3. Resume standard monitoring** (24h post-deploy window)

```powershell
# Back to 30-minute intervals for wave analysis
pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30 -StartTime "2026-05-08T23:30:00Z"
```

**Success criteria:**
- ✅ 0 sustained errors (>5 same signature)
- ✅ 0 CRITICAL events
- ✅ All 25 Firestore indexes READY by T+10m
- ✅ Rules warnings ≤20
- ✅ Function p95 latency <200ms
- ✅ Smoke tests 4/4 passing

---

## Monitoring Architecture

```
MONITORING LAYERS
═════════════════

┌─────────────────────────────────────────────┐
│  ALERT CHECKLIST (Real-time response)       │
│  - P0: STOP & rollback                      │
│  - P1: Investigate in parallel              │
│  - P2: Log for post-mortem                  │
└─────────────────────────────────────────────┘
         ↑
┌─────────────────────────────────────────────┐
│  HEALTH CHECK DASHBOARD (Live KPIs)         │
│  - 5 deployment stages                      │
│  - Error rate, latency, indexes, warnings   │
│  - Compliance snapshot (RDC 978 / DICQ)     │
│  - Update every 30m                         │
└─────────────────────────────────────────────┘
         ↑
┌─────────────────────────────────────────────┐
│  CLOUD LOGS BASELINE (Pre/post comparison)  │
│  - Baseline error snapshot (T-24h)          │
│  - Expected post-deploy behavior            │
│  - Success criteria & sign-off              │
└─────────────────────────────────────────────┘
         ↑
┌─────────────────────────────────────────────┐
│  MONITORING SCRIPT (scripts/monitor-cloud-  │
│  logs.ps1)                                  │
│  - Queries gcloud logging read              │
│  - Aggregates errors every 30m              │
│  - Exports JSON + Markdown report           │
└─────────────────────────────────────────────┘
         ↑
┌─────────────────────────────────────────────┐
│  GCP Cloud Logs (source)                    │
│  - Cloud Functions                          │
│  - Firestore (rules + operations)           │
│  - Cloud Run (hosting)                      │
└─────────────────────────────────────────────┘
```

---

## Phase 3 Wave 1 Timeline

### T-24h (2026-05-07 23:00 UTC)

- [ ] Start `monitor-cloud-logs.ps1` with `-Hours 24 -IntervalMinutes 30`
- [ ] Record baseline error count: **target 0**
- [ ] Verify pre-deploy metrics (22 indexes, 15 rule warnings, 32 functions)
- [ ] Team briefing on alert escalation chain

### T0 (2026-05-08 23:00 UTC) — Wave 1 Deployment Begins

**Stage 1: Schema (T+0m → T+5m)**
- [ ] Deploy 5 collections: portal-configuracao, notivisa-outbox, criticos-escalacoes, imuno-ias-dev, laudos-draft
- [ ] Create 3 composite indexes
- [ ] Monitor: `scripts/monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5`
- [ ] Expected: 0 errors, 3 indexes in CREATING state
- [ ] Dashboard update: HEALTH_CHECK_DASHBOARD.md Stage 1

**Stage 2: Rules (T+5m → T+10m)**
- [ ] Deploy Firestore Rules v1.4
- [ ] Monitor: Rules compile success, warnings ≤20
- [ ] Expected: 0 permission denies (authorized users), valid NOTIVISA payloads accepted
- [ ] Dashboard update: Stage 2

**Stage 3: Shared Helpers (T+10m → T+20m)**
- [ ] Deploy 4 functions: notivisa-sender, sms-gateway, laudo-finalizer, ia-strip-processor
- [ ] Monitor: Cold-start latency, warm latency, initialization errors
- [ ] Expected: Cold-start <300ms, warm <100ms, 0 errors
- [ ] Dashboard update: Stage 3

**Stage 4: Base Structures (T+20m → T+25m)**
- [ ] Deploy 3 callables: portal-getter, portal-setter, notivisa-processor
- [ ] Monitor: Response time <100ms, no errors
- [ ] Expected: All 3 responding, 0 errors
- [ ] Dashboard update: Stage 4

**Stage 5: Smoke Tests (T+25m → T+30m)**
- [ ] Test 1: NOTIVISA doc create (rules allow)
- [ ] Test 2: Portal unauthorized read (rules deny)
- [ ] Test 3: Critical escalation create (SMS fires)
- [ ] Test 4: Shared helper callable (no error)
- [ ] Expected: 4/4 pass, <5s each
- [ ] Dashboard update: Stage 5

### T+30m (2026-05-08 23:30 UTC) — Wave 1 Complete, 24h Monitoring Starts

- [ ] Switch monitoring: `scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30`
- [ ] Begin continuous monitoring for 24h
- [ ] Verify all 25 indexes READY
- [ ] Verify smoke test results
- [ ] Update HEALTH_CHECK_DASHBOARD.md every 30m

### T+24h (2026-05-09 23:30 UTC) — Monitoring Complete

- [ ] Export final logs: `gcloud logging read ... --format=json > scripts/cloud-logs-phase3-wave1-final.json`
- [ ] Generate final report: CLOUD_LOGS_WAVE1_REPORT.md
- [ ] CTO sign-off on wave completion
- [ ] Proceed to Wave 2 (Portal UI + Mobile) only if all criteria met

---

## Alert Quick Reference

### 🔴 P0 — STOP DEPLOYMENT

```
Trigger:
  • >10 errors in 30m window
  • 1+ CRITICAL event
  • Rules compile failure
  • Index creation fails
  • Hosting down (>5 5xx in 1m)

Action:
  1. Stop deployment immediately
  2. Export error logs
  3. Notify CTO
  4. Assess rollback

Reference: ALERT_CHECKLIST_PHASE3.md (P0 section)
```

### 🟡 P1 — INVESTIGATE

```
Trigger:
  • >5 permission denies (authorized users)
  • Rules warnings jump >22
  • Function timeout >10s
  • >10 malformed payloads in 1h

Action:
  1. Investigate in parallel with deployment
  2. Determine root cause
  3. Fix or escalate to CTO

Reference: ALERT_CHECKLIST_PHASE3.md (P1 section)
```

### 🟠 P2 — LOG

```
Trigger:
  • Index creation delay >10m
  • HTTP latency >2s
  • Debug logs accumulating

Action:
  1. Note in monitoring report
  2. Continue deployment
  3. Include in post-deployment analysis

Reference: ALERT_CHECKLIST_PHASE3.md (P2 section)
```

---

## Monitoring Commands Cheat Sheet

### Start Monitoring

```powershell
# 24h baseline (pre-deploy)
pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30

# 5-minute intensive (during deployment)
pwsh scripts/monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5

# 24h post-deploy wave
pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30 -StartTime "2026-05-08T23:30:00Z"
```

### Manual Diagnostics

```powershell
# Check ERROR logs (last 30m)
gcloud logging read "severity >= ERROR AND timestamp > now - 30m" `
  --project=hmatologia2 --limit=20 --format=json

# Check Firestore index status
gcloud firestore indexes composite list --project=hmatologia2 `
  --format="table(name, state, createTime)"

# Check function latency
gcloud logging read 'resource.type="cloud_function"' `
  --project=hmatologia2 --limit=50 --format=json | `
  jq 'map(.jsonPayload | {function: .name, latency: .executionTime}) | sort_by(.latency)'

# Check rules warnings
npm run firestore:rules-validate 2>&1 | grep -i "warning"
```

---

## Success Criteria

### Pre-Phase 3 (Baseline)

- [ ] Cloud Logs baseline clean: 0 errors in 24h
- [ ] Firestore: 22 composite indexes READY
- [ ] Rules: 15 pre-existing warnings (stable)
- [ ] Functions: 32 deployed, healthy
- [ ] Compliance: RDC 978 95%+, DICQ 78.5%+

### Post-Wave 1 (Sign-Off)

- [ ] Wave 1 errors: 0 in 24h post-deploy window
- [ ] Rules warnings: ≤20 (no increase)
- [ ] All indexes: 25/25 READY
- [ ] Function latency: p95 <200ms
- [ ] Smoke tests: 4/4 pass
- [ ] Compliance: Maintained (no regression)

### Rollback Thresholds (Automatic Stop)

- [ ] >20 errors of same signature in 30m
- [ ] 1+ CRITICAL event
- [ ] Rules compilation failure
- [ ] Index creation FAILED state
- [ ] Hosting service down

---

## Reference & Documentation

| Document | Purpose | Update Frequency |
|----------|---------|---|
| CLOUD_LOGS_BASELINE.md | Pre/post comparison, sign-off | Once pre-deploy, once post-deploy |
| ALERT_CHECKLIST_PHASE3.md | Real-time escalation guide | Referenced on alert only |
| HEALTH_CHECK_DASHBOARD.md | Live KPI tracker | Every 30m during Wave 1 |
| PHASE3_MONITORING_README.md | This file; architecture overview | Once (reference only) |

---

## File Locations (Absolute Paths)

```
C:\hc quality
├── .planning\phases\03-schema-extensions\
│   ├── CLOUD_LOGS_BASELINE.md ..................... Baseline doc
│   ├── ALERT_CHECKLIST_PHASE3.md ................. Alert guide
│   ├── HEALTH_CHECK_DASHBOARD.md ................. Live tracker
│   ├── PHASE3_MONITORING_README.md ............... This file
│   ├── CLOUD_LOGS_WAVE1_REPORT.md ................ [To be created post-Wave1]
│   └── COMPLIANCE_SNAPSHOT_POST_WAVE1.md ........ [To be created post-Wave1]
│
├── scripts\
│   ├── monitor-cloud-logs.ps1 ..................... Monitoring script
│   ├── cloud-logs-export-baseline-*.json ........ [To be created pre-Wave1]
│   ├── cloud-logs-phase3-wave1-*.json ........... [To be created post-Wave1]
│   └── cloud-logs-phase3-wave1-final.json ....... [To be created T+24h]
│
├── docs\
│   ├── CLOUD_LOGS_MONITORING_GUIDE.md ........... v1.3 reference (read-only)
│   ├── CLOUD_LOGS_QUICK_REFERENCE.md ........... v1.3 reference (read-only)
│   └── CLOUD_LOGS_INTEGRATION_CHECKLIST.md .... v1.3 reference (read-only)
```

---

## Escalation Chain

**During Phase 3 Wave 1:**

```
Monitoring Script / Alert Triggered
    ↓
    ├─→ P0 (ERROR spike, CRITICAL, rules fail, index fails, service down)
    │   ↓
    │   Notify: Slack #hc-quality-oncall
    │   → "🔴 P0 ALERT: [type] — STOPPING DEPLOYMENT"
    │   → Export logs to artifact
    │   → CTO assesses rollback (5 min response)
    │
    ├─→ P1 (Permission denied, rules warnings, timeout, latency spike)
    │   ↓
    │   Notify: Slack #hc-quality-oncall
    │   → "🟡 P1 ALERT: [issue] — investigating"
    │   → Investigate in parallel
    │   → CTO guidance on fix vs. continue
    │
    └─→ P2 (Index delay, latency >2s, debug logs)
        ↓
        Log in monitoring report
        → Continue deployment
        → Mention in post-mortem
```

---

## Next Steps

1. **Now (T-24h before Wave 1):**
   - [ ] Review this README
   - [ ] Read CLOUD_LOGS_BASELINE.md (understand what "healthy" looks like)
   - [ ] Review ALERT_CHECKLIST_PHASE3.md (know your escalation triggers)
   - [ ] Brief the team on alert thresholds

2. **T-24h (2026-05-07 23:00 UTC):**
   - [ ] Start baseline monitoring: `pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30`
   - [ ] Begin collecting pre-deploy logs
   - [ ] Record baseline metrics in HEALTH_CHECK_DASHBOARD.md

3. **T0 (2026-05-08 23:00 UTC):**
   - [ ] Switch to intensive monitoring: `pwsh scripts/monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5`
   - [ ] Execute Wave 1 deployment stages 1–5
   - [ ] Update HEALTH_CHECK_DASHBOARD.md after each stage
   - [ ] On any alert: consult ALERT_CHECKLIST_PHASE3.md

4. **T+30m (2026-05-08 23:30 UTC):**
   - [ ] Wave 1 deployment complete
   - [ ] Verify smoke tests 4/4 passing
   - [ ] Resume standard monitoring: `pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30`
   - [ ] Begin 24h post-deploy wave analysis

5. **T+24h (2026-05-09 23:30 UTC):**
   - [ ] Monitoring window complete
   - [ ] Export final logs
   - [ ] Generate CLOUD_LOGS_WAVE1_REPORT.md
   - [ ] CTO sign-off
   - [ ] Proceed to Wave 2 if all criteria met

---

## Support & References

**For monitoring questions:**
- See `docs/CLOUD_LOGS_MONITORING_GUIDE.md` (v1.3 reference)
- See `docs/CLOUD_LOGS_QUICK_REFERENCE.md` (commands)

**For alert escalation:**
- See `ALERT_CHECKLIST_PHASE3.md` (real-time response guide)

**For live status:**
- See `HEALTH_CHECK_DASHBOARD.md` (KPI trends, stage progress)

**For deployment context:**
- See `.planning/phases/03-schema-extensions/03-PLAN.md` (Phase 3 full plan)

---

## Final Checklist

Before Wave 1 Deployment (T-1h):

- [ ] All three monitoring documents reviewed and understood
- [ ] `monitor-cloud-logs.ps1` tested and working
- [ ] Baseline collection ready to start (T-24h)
- [ ] Team briefed on alert escalation
- [ ] CTO available for sign-off
- [ ] HEALTH_CHECK_DASHBOARD.md baseline metrics recorded
- [ ] Rollback procedure documented and practiced

**Status:** ✅ READY FOR PHASE 3 WAVE 1

---

**Document:** PHASE3_MONITORING_README.md  
**Created:** 2026-05-08  
**Phase:** 3 (Schema Extensions & Cross-Cutting Prep)  
**Owner:** DevOps + CTO  
**Status:** 🟢 ACTIVE FOR WAVE 1 DEPLOYMENT

---

**Next:** See CLOUD_LOGS_BASELINE.md for pre-deployment metrics setup.
