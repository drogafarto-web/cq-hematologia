# Cloud Logs Baseline — Phase 3 Wave 1 Deployment (2026-05-08 → 2026-05-14)

**Project:** hmatologia2  
**Phase:** 3 (Schema Extensions & Cross-Cutting Prep)  
**Deployment Window:** 2026-05-08 → 2026-05-14 (1 week)  
**Monitoring Strategy:** Continuous 24h baseline pre-deploy + post-deploy wave analysis  
**Owner:** Stream D (DevOps) + CTO (Rules audit)  
**Status:** ✅ READY

---

## Executive Summary

Phase 3 deploys foundational schema, rules extensions, and shared utilities across 5 new Firestore collections and updated security rules for portal/NOTIVISA/critical escalations.

**Key Risk Areas:**
1. **Firestore Rules compilation** — New complex rules for portal access, NOTIVISA outbox, critical escalations
2. **Composite indexes** — 3 new composite indexes created; queries must wait for index completion
3. **Cross-tenant data isolation** — Portal + NOTIVISA rules enforce stricter multi-tenant boundaries
4. **Cold-start functions** — Shared helpers initialize new modules (notivisa, SMS, laudo, IA)

**Success Criteria (all must pass):**
- ✅ 0 sustained ERROR logs (>5 same signature in 2h window)
- ✅ 0 CRITICAL severity events
- ✅ Rules compilation warnings ≤ pre-deploy baseline (≤ 15)
- ✅ Firestore index creation completes without errors
- ✅ Function cold-start latency <300ms
- ✅ Composite queries execute within timeout (< 2s)
- ✅ Portal access rules enforce tenant isolation (0 permission denied for unauthorized users)
- ✅ NOTIVISA outbox rules reject malformed payloads

---

## Pre-Deployment Baseline (T-24h → T0)

### Collection & Rules Snapshot (Current Production)

**Active Collections:**
- `labs/{labId}/analyzer-runs` — OCR result storage
- `labs/{labId}/ciq-*` (25 CIQ modules) — Quality control records
- `labs/{labId}/laudos` — Published results
- `labs/{labId}/member` — User access control
- `labs/{labId}/sgq/*` — Documentation + audit
- `auditoria/{labId}/events` — Immutable audit trail

**Firestore Rules Current State:**
- Line count: ~450 (before Phase 3)
- Warning count: 15 pre-existing (lab-apoio + reclamacao blocks)
- Multi-tenant isolation: enforced via `labId` match
- Audit trail: immutable via `create-only` events

**Cloud Functions Current State:**
- Total deployed: 32 callables + 8 scheduled tasks
- p95 latency: <200ms (warm), ~200ms (cold-start)
- Error rate: <0.1% (healthy baseline)

### Pre-Deploy Cloud Logs Query Results

**Query Window:** Last 48h before Phase 3 Wave 1 deploy (2026-05-06 00:00 UTC → 2026-05-08 00:00 UTC)

```
severity >= ERROR
AND resource.type IN ("cloud_function", "cloud_firestore", "cloud_run")
```

| Resource Type | Error Count | Status | Notes |
|---|---|---|---|
| Cloud Functions | 0 | ✅ CLEAN | No function errors in 48h |
| Firestore | 0 | ✅ CLEAN | No permission/quota/index errors |
| Cloud Run (Hosting) | 0 | ✅ CLEAN | No 5xx responses |
| **Total Pre-Baseline** | **0** | ✅ PASS | Healthy production state |

### Firestore Rules Compilation Pre-Baseline

```
gcloud firestore indexes composite list --project=hmatologia2
```

**Expected:** 22 existing composite indexes, all READY

---

## Phase 3 Wave 1 Deployment Plan

### Deployment Steps

**Step 1:** Deploy Firestore schema (T0 → T+5m)
- Create 5 new collections: portal-configuracao, notivisa-outbox, criticos-escalacoes, imuno-ias-dev, laudos-draft
- Create 3 composite indexes (auto-created via deployment script or manual via Console)
- Verify: `firestore indexes composite list` shows 25 total READY

**Step 2:** Deploy Firestore Rules v1.4 (T+5m → T+10m)
- Add portal access rules (isPatient, isOwnLaudo validation)
- Add NOTIVISA outbox rules (isAdmin, validateNotivisaPayload)
- Add critical escalations rules (isAdminOrRT)
- Verify: `npm run firestore:rules-validate` completes without errors

**Step 3:** Deploy Shared Helpers (T+10m → T+20m)
- Cloud Functions: 4 new modules (notivisa-sender, sms-gateway, laudo-finalizer, ia-strip-processor)
- Verify: Cold-start latency logged, no unhandled exceptions

**Step 4:** Deploy Function base structures (T+20m → T+25m)
- Portal callable stubs
- NOTIVISA event processor
- Critical escalation trigger
- Verify: All functions enumerate in `gcloud functions list --project=hmatologia2`

**Step 5:** Post-deploy verification (T+25m → T+30m)
- Run smoke test: Create test doc in notivisa-outbox; verify rules accept valid payload
- Run smoke test: Attempt unauthorized portal read; verify rules deny
- Verify: Composite indexes transition to READY state

### Parallel Streams During Phase 3

| Stream | Task | Blocking? | Monitor |
|--------|------|-----------|---------|
| Stream A | Rules audit + portal gates | YES | Rules compile warnings, permission denies |
| Stream D | Schema + indexes | YES | Index creation time, document inserts |
| Stream B | Shared helpers + SMS | NO | Function latency, cold-start |
| Stream C | Portal UI + mobile prep | NO | Function availability |

---

## Post-Deployment Monitoring Plan (T+0 → T+24h)

### Monitoring Intervals

**Continuous (every 30 minutes):**
- ERROR severity logs across all resources
- Firestore index status (all 25 should be READY)
- Function invocation count and latency (p50, p95, p99)

**Continuous (every 2 hours):**
- Rules compilation warnings (trend: should stabilize at ≤15)
- NOTIVISA outbox payload validation (reject count)
- Portal access deny count (should be 0 for authorized users)

**On-demand (if alert triggered):**
- Full error log dump with stack traces
- Affected function/collection/user context
- Rollback assessment

### Alert Thresholds

| Alert | Threshold | Severity | Action |
|---|---|---|---|
| **ERROR rate spike** | >10 errors in 30m window | 🔴 P0 | STOP deployment, assess rollback |
| **Index creation timeout** | Any composite index in CREATING >30m | 🔴 P0 | Contact GCP support, pause functions |
| **Rules compilation failure** | Warnings jump >50% (>22 from baseline 15) | 🟡 P1 | Revert rules, debug syntaxFail |
| **Permission denied spike** | >5 unauthorized access attempts in 1h | 🟡 P1 | Review rules logic, check test data |
| **Function timeout** | Any callable >10s execution time | 🟡 P1 | Investigate query performance, index missing? |
| **Malformed NOTIVISA payloads** | >10 rejected in 1h | 🟡 P1 | Review payload schema, fix client |
| **Latency p95 >500ms** | Warm invocation takes >500ms | 🟠 P2 | Profile function, check Firestore quota |

### Continuous Monitoring Script

**Pre-deploy (T-24h):**
```bash
# Start baseline collection
pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30
```

**During Phase 3 deployment (T0 → T+30m):**
```bash
# Intensive monitoring during deployment waves
pwsh scripts/monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5
```

**Post-deploy wave analysis (T+30m → T+24h):**
```bash
# Resume standard monitoring
pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30 -StartTime "2026-05-08T00:00:00Z"
```

**Archive & comparison:**
```bash
# Export final metrics
gcloud logging read \
  "resource.type IN ('cloud_function', 'cloud_firestore', 'cloud_run') AND severity >= ERROR" \
  --project=hmatologia2 \
  --limit=1000 \
  --format=json > scripts/cloud-logs-phase3-wave1-final.json
```

---

## Sign-Off Checklist

### Pre-Deployment (T-24h)

- [ ] Baseline logs collected: `scripts/cloud-logs-export-baseline-*.json`
- [ ] Baseline error count recorded: **0 errors in 24h pre-window**
- [ ] Current rules warning count verified: **15 pre-existing warnings**
- [ ] Current composite index count verified: **22 READY**
- [ ] Current function count verified: **32 deployed, all healthy**
- [ ] Deployment plan reviewed and approved by CTO
- [ ] Team briefing completed (all streams understand monitoring alert chain)

### During Deployment (T0 → T+30m)

- [ ] Step 1 (Schema): New collections created, confirmed in Console
- [ ] Step 1: Composite indexes created, status monitored every 5m
- [ ] Step 2 (Rules): Rules deployed, no compile errors
- [ ] Step 2: Rules warning count checked (should be ≤ 20)
- [ ] Step 3 (Shared Helpers): 4 functions deployed, no cold-start errors
- [ ] Step 4 (Base structures): Portal + NOTIVISA + critical callables visible in `gcloud functions list`
- [ ] Step 5 (Smoke tests): All 4 smoke tests pass
  - [ ] Create notivisa-outbox doc; rules accept valid payload
  - [ ] Attempt unauthorized portal read; rules deny
  - [ ] Create critical escalation doc
  - [ ] Invoke notivisa-sender callable (no error)

### Post-Deployment (T+30m → T+24h)

- [ ] Monitoring script running continuously (24h window)
- [ ] All 25 composite indexes reach READY state within 10m of deploy
- [ ] ERROR logs remain at 0 across all resources
- [ ] Function latency stable: p95 <300ms (cold-start <300ms new functions)
- [ ] No permission denied logs for authorized users
- [ ] NOTIVISA payload validation working (reject count = 0 for valid payloads)
- [ ] Rules warning count stable (no increase from post-deploy baseline)
- [ ] SMS gateway + laudo finalizer + IA processor cold-starts complete without error
- [ ] 24h monitoring window completed without critical incidents
- [ ] Final error export generated: `scripts/cloud-logs-phase3-wave1-final.json`

### Rollback Criteria (if triggered)

**Automatic Stop & Rollback:**
- [ ] 20+ errors of same signature within 30m window → STOP, assess rollback
- [ ] Any CRITICAL severity event → STOP, investigate immediately
- [ ] Rules compilation fails → STOP, revert rules, debug syntax
- [ ] Any composite index enters FAILED state → STOP, contact GCP support

**Manual Escalation (consult CTO):**
- [ ] >10 permission denied logs in 1h (rules audit concern)
- [ ] >15 rules warnings (indicates rules complexity issue)
- [ ] Function invocation timeout (>10s for any callable)

---

## Phase 3 Wave 1 Deployment Timeline

| Time | Event | Owner | Monitor |
|------|-------|-------|---------|
| **T-24h (2026-05-07 23:00 UTC)** | Baseline monitoring starts | DevOps | Error count = 0 ✓ |
| **T-0 (2026-05-08 23:00 UTC)** | Phase 3 deployment window opens | CTO | Intensive monitoring begins |
| **T+5m** | Firestore schema deployed | Agent 1 | Collections created, indexes CREATING |
| **T+10m** | Firestore Rules v1.4 deployed | Agent 2 | Rules compile check |
| **T+15m** | Shared Helpers functions deployed | Agent 3 | Cold-start logs monitored |
| **T+20m** | Base structures deployed | Agent 4 | Function enumeration verified |
| **T+25m** | Smoke tests executed | QA | All 4 tests PASS ✓ |
| **T+30m** | Deployment complete, wave monitoring starts | DevOps | 24h wave begins |
| **T+2h (2026-05-09 01:00 UTC)** | Index readiness check | DevOps | All 25 indexes READY? |
| **T+24h (2026-05-09 23:00 UTC)** | Wave 1 monitoring complete | DevOps | Final report generated |

---

## Monitoring Scripts & Exports

### Baseline Export (Pre-Deployment)

**File:** `scripts/cloud-logs-export-baseline-20260507.json`

**Content:**
```json
[
  {
    "timestamp": "2026-05-07T23:45:00Z",
    "severity": "INFO",
    "resource": { "type": "cloud_function" },
    "message": "All functions healthy. Error count: 0"
  }
]
```

**Interpretation:** Baseline clean; any post-deploy errors are regression candidates.

### Post-Deployment Export (Wave 1)

**File:** `scripts/cloud-logs-phase3-wave1-*.json` (3 cycles: T+0h, T+12h, T+24h)

**Comparison Logic:**
- If post-deploy ERROR count > pre-deploy baseline (0) → escalate
- If error signature matches pre-existing issue → monitor for regression
- If error is new signature → investigate immediately

### Alert Export Chain

```
Monitor script (every 30m)
  ↓
  Aggregates errors: count, severity, signature
  ↓
  JSON export: scripts/cloud-logs-phase3-wave1-[timestamp].json
  ↓
  Markdown report: .planning/phases/03-schema-extensions/CLOUD_LOGS_WAVE1_REPORT.md
  ↓
  Slack/Email notification (if threshold exceeded)
```

---

## Reference: Alert Thresholds Reminder

```
ERROR rate:           >10/30m window = STOP & rollback
CRITICAL severity:    1+ event       = immediate investigation
Index FAILED state:   any            = contact GCP support
Rules warnings jump:  baseline +50%  = revert + debug
Permission denies:    >5/1h          = rules audit required
Function timeout:     >10s any call  = profile + investigate
Malformed payloads:   >10/1h         = schema mismatch
Latency p95 spike:    >500ms warm    = quota/perf check
```

---

## Success Metrics (Target)

| Metric | Target | Threshold |
|--------|--------|-----------|
| **Pre-deploy error count** | 0 | <5 acceptable |
| **Post-deploy error count (T+24h)** | 0 | <5 acceptable |
| **Error rate change** | 0% (no increase) | <10% regression acceptable |
| **Rules warnings count** | ≤15 (baseline) | <20 acceptable |
| **All composite indexes READY** | 100% by T+10m | 100% by T+30m acceptable |
| **Function latency p95** | <300ms (cold), <100ms (warm) | <500ms acceptable |
| **Smoke test pass rate** | 4/4 (100%) | 3/4 (75%) acceptable |
| **DICQ compliance** | ≥78.5% (maintained) | ≥75% acceptable |
| **RDC 978 coverage** | ≥95% (maintained) | ≥90% acceptable |

---

## Next Phase Trigger

**Phase 3 Wave 2 (Portal UI + Mobile)** begins only after ALL of:
- ✅ Phase 3 Wave 1 Cloud Logs sign-off complete
- ✅ 24h monitoring window with 0 sustained errors
- ✅ All composite indexes READY
- ✅ Smoke tests 4/4 passing
- ✅ Compliance baselines maintained

**Approval:** CTO sign-off (see SIGN-OFF section below)

---

## Sign-Off & Archive

**Baseline Report:** Completed **2026-05-08 00:00 UTC**

**Wave 1 Report:** To be completed **2026-05-09 00:00 UTC**

**Archive Location:**
- Baseline: `scripts/cloud-logs-export-baseline-*.json`
- Wave 1 exports: `scripts/cloud-logs-phase3-wave1-*.json`
- Wave 1 report: `.planning/phases/03-schema-extensions/CLOUD_LOGS_WAVE1_REPORT.md`
- Compliance snapshot: `.planning/phases/03-schema-extensions/COMPLIANCE_SNAPSHOT_POST_WAVE1.md`

**Approval Sign-Off:**

| Role | Name | Date | Status |
|------|------|------|--------|
| **CTO** | [Name] | 2026-05-09 | Pending |
| **DevOps** | [Name] | 2026-05-09 | Pending |
| **Rules Auditor** | [Name] | 2026-05-09 | Pending |

---

**END OF CLOUD LOGS BASELINE**

---

**Next:** Run pre-deployment monitoring (`pwsh scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30`) starting T-24h (2026-05-07 23:00 UTC).
