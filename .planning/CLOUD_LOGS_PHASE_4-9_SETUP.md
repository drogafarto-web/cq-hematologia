# Cloud Logs Monitoring Guide — Phase 4–9 Deployment Verification

**Purpose:** Continuous monitoring of Cloud Functions, Firestore, and Hosting logs during Phase 4–9 deployments (May 20 – September 30, 2026).

**Monitoring Window:** From each phase deploy completion through +24h (or spot-checks every 30 min during active deployment).

**Owner Responsibility:** Any authorized deployer. Non-blocking; runs in parallel with feature acceptance.

---

## 1. Pre-Monitoring Setup

| Setting | Value |
|---------|-------|
| **GCP Project** | `hmatologia2` |
| **Region** | `southamerica-east1` |
| **Monitoring Interval** | 24h continuous or 30-min spot-checks |
| **Alert Threshold** | Any `ERROR` or `EXCEPTION` severity |
| **Expected Error Rate** | <5 errors per 10,000 invocations |
| **BLOCK Threshold** | Any unhandled exception + `severity=ERROR` on `/labs/*` paths |

### Prerequisites

- GCP account with Editor+ role on `hmatologia2`
- `gcloud` CLI installed and authenticated: `gcloud config set project hmatologia2`
- (Optional) `jq` for JSON parsing (macOS/Linux); Windows use PowerShell equivalents in `scripts/monitor-cloud-logs.ps1`
- Firestore Emulator access (for pre-deploy validation)

---

## 2. Phase-Specific Checkpoints

### Phase 4 — NOTIVISA Sandbox Integration (May 20)

**Functions to Monitor:**
- `submitNotivisaDraft()` (callable) — client submits draft to NOTIVISA sandbox
- `processNotivisaQueueScheduled()` (scheduled, 5-min interval) — polls queue, enqueues submissions
- `notivisaWorker()` (Pub/Sub) — processes NOTIVISA API calls to ANVISA sandbox
- `manuallyRetryNotivisaCallable()` (callable) — admin-triggered retry

**Red Flags:**
```
severity=ERROR AND (
  resource.labels.function_name=~"notivisa.*"
  OR textPayload=~".*NOTIVISA.*permission.*"
)
```

**Expected Behavior:**
- `submitNotivisaDraft()` returns `{ draftId, status: 'PENDING' }` <500ms
- `processNotivisaQueueScheduled()` runs every 5 min, 0 errors
- `notivisaWorker()` logs `DELIVERED` or `FAILED_TEMP` (never silent failure)
- ANVISA sandbox API latency: p99 <3s
- Idempotent resubmissions: if `anvisa_protocol_id` exists, skip retry

**Firestore Collections to Inspect:**
```
gcloud logging read "resource.type='cloud_firestore' AND jsonPayload.collectionName=~'notivisa-.*'" \
  --project=hmatologia2 --limit=50 --format=json
```

---

### Phase 5 — Advanced Audit Trail (June 15)

**Functions to Monitor:**
- `recordAuditDiff()` (callable) — captures cross-collection diff on writes
- `captureContextSnapshot()` (trigger) — async context capture (compliance snapshot)
- `queryAuditTrailByDateRange()` (callable) — auditor-triggered range queries
- `generateAuditReport()` (callable) — PDF/CSV export for RDC 978 5.3 compliance

**Red Flags:**
```
severity=ERROR AND (
  resource.labels.function_name=~"audit.*"
  OR textPayload=~".*diff.*missing.*"
  OR textPayload=~".*context.*snapshot.*failed.*"
)
```

**Expected Behavior:**
- `recordAuditDiff()` captures before/after snapshots, calculates hash in <100ms
- Audit documents immutable: no updates after creation
- Context snapshots async, latency <2s behind write
- Export functions complete <30s (P99)

**Firestore Collections to Inspect:**
```
gcloud logging read "resource.type='cloud_firestore' AND jsonPayload.collectionName=~'.*auditLog.*'" \
  --project=hmatologia2 --limit=100 --format=json
```

---

### Phase 6–9 — Critical Values, Patient Portal, Analytics Scaling (July–September)

**Functions to Monitor:**
- `escalateCriticalResult()` (callable) — triggers on-call escalation (Phase 6)
- `generatePatientAuthToken()` (callable) — HMAC email link generation (Phase 7)
- `bulkExportAnalyticsSnapshot()` (scheduled, 30-min interval) — aggregates KPI data (Phase 8)
- `detectAnomalies()` (scheduled, hourly) — ML-based QC chart anomaly detection (Phase 9)

**Red Flags:**
```
severity=ERROR AND (
  resource.labels.function_name=~"critical|escalate|patient|analytics|anomaly"
  OR textPayload=~".*timeout.*"
  OR textPayload=~".*undefined.*"
  OR httpRequest.status >= 500
)
```

**Expected Behavior:**
- Critical value escalation: <5s end-to-end (from result write to email sent)
- Patient token generation: <200ms, no HMAC collision
- Analytics snapshots: batch <2GB Firestore read quota per cycle
- Anomaly detection: no false positives >2σ threshold

---

## 3. Monitoring Dashboards & Filters

### Cloud Console Quick Access

| Resource Type | Filter Query | Bookmark |
|---|---|---|
| **All Errors (Last Hour)** | `severity >= ERROR AND timestamp > now - 60m` | ⭐ Most common |
| **Cloud Functions Only** | `resource.type="cloud_function" AND severity >= ERROR` | Phase 4–9 focus |
| **Firestore Rules Rejections** | `resource.type="cloud_firestore" AND textPayload=~"Permission"` | Rules regression detection |
| **Hosting 5xx Errors** | `resource.type="cloud_run" AND httpRequest.status >= 500` | Availability |
| **Function Timeouts** | `resource.type="cloud_function" AND textPayload=~"Exceeded timeout"` | Async/heavy workload issues |
| **Pub/Sub Dead-Letter** | `resource.type="cloud_pubsub" AND severity >= WARNING` | Queue backlog warning |

### Firestore Index Monitoring

```gcloud
# Check for missing indexes (blocks queries)
gcloud logging read "resource.type='cloud_firestore' AND textPayload=~'.*index.*missing.*'" \
  --project=hmatologia2 --limit=20
```

---

## 4. Common Issues & Troubleshooting (Phase 4–9 Edition)

| Symptom | Log Signature | Root Cause | Resolution | Phase |
|---------|---|---|---|---|
| NOTIVISA submissions hang | `notivisaWorker` 0 output for >10 min | ANVISA API timeout or network issue | Check ANVISA sandbox status + increase Pub/Sub retry; escalate if >2h | 4 |
| Audit trail gaps | `recordAuditDiff` skipped docs | Callable error (not logged) | Check Cloud Function trace logs; ensure context snapshot succeeds | 5 |
| Patient portal login 401 | `generatePatientAuthToken` returns error | HMAC mismatch or salt rotation | Verify `SECRET_PATIENT_AUTH_HMAC` provisioned; check token TTL | 7 |
| KPI dashboard stale | `bulkExportAnalyticsSnapshot` delayed >30 min | Firestore quota exceeded or network backoff | Reduce aggregation window; increase read quota allocation | 8 |
| False positive anomalies | `detectAnomalies` flags normal variance | Model drift (retraining needed) | Review last N chart points manually; retrain baseline | 9 |
| Function cold-start latency spike | `duration_ms` >5s on first invoke | Expected on new version deploy | Not an error; caches warm after 30s; do not retry |  |
| Permission denied on `/labs/{labId}/*` | `textPayload=~"Permission"` | Rules mismatch or user not active | Check Firestore rules git diff; verify user in `labs/{labId}/members` | Any |
| Document too large (>1 MB) | `textPayload=~"Document exceeds max size"` | Audit trail or diff payload bloat | Split document or implement soft-limit on nested arrays | 5 |

---

## 5. Cloud Logs Integration Checklist for Phase 4–9 Deployments

### Pre-Deployment (T-1 hour)

- [ ] **Confirm gcloud CLI ready:** `gcloud config set project hmatologia2 && gcloud auth list`
- [ ] **Firestore rules & indexes synced to git:** `git diff firestore.rules` is empty or reviewed
- [ ] **Cloud Functions TSC green:** `cd functions && npm run build` zero errors
- [ ] **Secret status check passed:** `bash scripts/preflight-secrets-check.sh` exit code 0
- [ ] **Emulator rules tested:** `npm run test:emulator` passes all security rule scenarios
- [ ] **Optional: automated monitoring script ready:** `bash scripts/monitor-cloud-logs.sh` or `.ps1` variant accessible

### During Deployment (T+0 to T+15 min)

- [ ] **Step 1 (Firestore Rules):** `firebase deploy --only firestore:rules` succeeds
- [ ] **Monitor rules deploy:** `gcloud logging read "severity >= ERROR" --limit=5` (should be 0)
- [ ] **Step 2 (Firestore Indexes):** `firebase deploy --only firestore:indexes` succeeds
- [ ] **Step 3 (Cloud Functions):** `firebase deploy --only functions:<modules>` succeeds
  - Watch for `Deploying functions` spinner; total time should be <5 min per function set
  - If any function fails, see Emergency Rollback below
- [ ] **Step 4 (Hosting):** `firebase deploy --only hosting` succeeds
- [ ] **Hard reload browser:** Ctrl+Shift+R to pull new Service Worker + bundle

### Post-Deployment (T+15 min to T+24h)

- [ ] **Smoke test critical flows:** manually test 3 main user journeys (phase-specific)
- [ ] **Start automated monitoring:** `bash scripts/monitor-cloud-logs.sh 24 30` (or PowerShell `.ps1`)
- [ ] **Check error baseline:** if <5 total errors in first 30 min, continue; if >5, investigate before proceeding
- [ ] **Firestore rule audit:** spot-check 3–5 permission denials (if any) to confirm rules are working as expected
- [ ] **Function latency check:** p50 latency <500ms, p99 <3s (retrieve from Cloud Console → Cloud Functions → Execution times)
- [ ] **Pub/Sub queue depth:** if Phase 4+, verify `notivisa-outbox` queue draining (Pub/Sub Metrics tab)
- [ ] **Hosting performance:** LCP <2.5s, INP <200ms (run Lighthouse in browser DevTools)
- [ ] **Email deliverability (Phase 7+):** send test email via patient portal; verify inbox receipt <30s
- [ ] **At 6h mark:** review report generated by monitoring script (if automated)
- [ ] **At 24h mark:** create manual sign-off document and commit to repo

---

## 6. Emergency Rollback Procedure

**Trigger:** Any 🔴 BLOCK issue (see red flags above) that persists >5 minutes.

```bash
# 1. Note error + timestamp
ERROR_TS=$(date)
ERROR_LOG=$(gcloud logging read "severity >= ERROR" --limit=1 --format=json)

# 2. Identify which deploy introduced it
git log --oneline | head -5

# 3. If critical (blocking all users), rollback immediately:
git checkout HEAD~1 functions/
firebase deploy --only functions --project hmatologia2

# 4. Verify rollback landed:
gcloud logging read "severity >= ERROR" --limit=5

# 5. Escalate to CTO:
echo "INCIDENT: $ERROR_TS"
echo "Error: $(echo $ERROR_LOG | jq '.[]')"
echo "Action: rolled back functions to HEAD~1"
echo "Status: $(git log --oneline | head -1)"
```

**Post-Incident:**
- Pause Phase workstreams until root cause identified
- Create incident report in `.planning/incidents/INCIDENT_<date>_<phase>.md`
- Update ADR if architectural flaw; update rules if security issue
- 24h post-mortem with on-call rotation (see `v1.4-INCIDENT_RESPONSE_CONTACTS.md`)

---

## 7. Monitoring Script Usage

### Bash (macOS/Linux)

```bash
cd C:\hc quality

# Full 24h monitoring (checks every 30 min)
bash scripts/monitor-cloud-logs.sh

# Custom duration: 6h monitoring, check every 10 min
bash scripts/monitor-cloud-logs.sh 6 10

# Extended: 48h monitoring, check every 1h
bash scripts/monitor-cloud-logs.sh 48 60
```

### PowerShell (Windows)

```powershell
cd "C:\hc quality"

# Full 24h monitoring
.\scripts\monitor-cloud-logs.ps1

# Custom duration: 6h, 10-min interval
.\scripts\monitor-cloud-logs.ps1 -DurationHours 6 -IntervalMinutes 10

# Extended: 48h, 1h interval
.\scripts\monitor-cloud-logs.ps1 -DurationHours 48 -IntervalMinutes 60
```

**Output Files:**
- `docs/MONITORING_REPORT_<timestamp>.md` — auto-generated summary (error counts, red flags, sign-off template)
- `scripts/cloud-logs-export-<timestamp>.json` — all raw error logs (JSON format, for audit trail)

---

## 8. Manual Sign-Off Template

After 24h monitoring completes (or earlier if confident), create:

```markdown
# Cloud Logs Monitoring Sign-Off — Phase [N] Deployment

**Deploy Date:** [YYYY-MM-DD]  
**Deploy Time (UTC):** [HH:MM]  
**Phase:** Phase [N] — [Module Name]  
**Monitoring Duration:** 24h  
**Monitor Operator:** [Your Name]  

## Summary

- **Total Errors:** [N] (target <5)
- **🔴 BLOCK Issues Found:** [YES/NO]
- **Critical Functions Status:** [OK/DEGRADED]
- **Firestore Rules Status:** [OK/NEEDS_REVIEW]
- **Hosting Performance:** [OK/SLOW]

## Spot Checks

- [ ] notivisa-outbox queue (Phase 4): [0 pending / N pending / not applicable]
- [ ] audit trail completeness (Phase 5): [sample 5 writes + confirm audit doc exists]
- [ ] critical escalation latency (Phase 6): [p50 <5s / SLOW / not tested]
- [ ] patient portal token generation (Phase 7): [OK / FAILED / not tested]
- [ ] analytics dashboard responsiveness (Phase 8): [<2s load / SLOW / not tested]
- [ ] anomaly detection accuracy (Phase 9): [normal / false positive rate high / not tested]

## Errors Reviewed

[List any errors found + mitigation taken, or "None found"]

## Recommendation

✅ **APPROVED** — Deploy can proceed to production / next phase.
⚠️ **CONDITIONAL** — Deploy approved with caveat: [describe].
❌ **REJECTED** — Deploy blocked pending [describe issue].

**Signature:** [Your Name] | [Timestamp]
**Reviewed by CTO:** [ ] Yes [ ] No (if >5 errors or 🔴 BLOCK found, requires CTO sign-off)
```

Save as: `docs/SIGN_OFF_CLOUD_LOGS_<phase>_<date>.md`

---

## 9. Phase-Specific Compliance Notes

### Phase 4–5: RDC 978 Art. 5.3 (Audit Trail)

- Every write to result/laudo collection must have corresponding audit log
- Audit log immutable after creation
- Monitor: `gcloud logging read "jsonPayload.collectionName=~'auditLog.*'" --limit=100`
- Post-deploy check: sample 10 random result writes; confirm audit docs exist

### Phase 6: RDC 978 Art. 122 (Critical Results Escalation)

- Critical values must escalate within business hours
- Monitor: check `escalateCriticalResult` latency p99 <5s
- Post-deploy check: flag a test critical value; measure email receipt time

### Phase 7–8: LGPD (Patient Portal + Analytics)

- Patient token generation must not leak PII in logs
- Analytics export must respect consent flags (TEMP-IMPLANTACAO for this phase)
- Monitor: `gcloud logging read "textPayload=~'.*cpf|cnpj|email.*'" --limit=20` (should be 0 unmasked)
- Post-deploy check: scan export logs for PII; confirm masked fields in audit trail

### Phase 9: Quality System (Anomaly Detection + False Positives)

- Model predictions logged for audit trail (required by DICQ 4.3)
- False positive escalations must not trigger unnecessary manual review
- Monitor: alert if anomaly detection error rate >2%
- Post-deploy check: run model on historical data; compare predictions to manual QC flags

---

## 10. References & Quick Links

| Document | Purpose | Path |
|---|---|---|
| **Main Monitoring Guide (v1.3)** | Full reference, v1.3 base | `docs/CLOUD_LOGS_MONITORING_GUIDE.md` |
| **Quick Reference Card** | Cheat sheet, gcloud commands | `docs/CLOUD_LOGS_QUICK_REFERENCE.md` |
| **Integration Checklist** | Pre/during/post deploy tasks | **← This document** |
| **Deploy Protocol** | Firestore rules → Functions → Hosting sequence | `.claude/rules/deploy-protocol.md` |
| **Incident Response** | Severity matrix, on-call rotation, runbooks | `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` |
| **NOTIVISA ADR** | Phase 4 NOTIVISA queue architecture | `docs/adr/ADR-0021-notivisa-queue-pattern.md` |
| **Audit Trail ADR** | Phase 5 diff capture + context snapshot | `docs/adr/ADR-0014-audit-trail-extensibility.md` |

---

## 11. Escalation Contacts

| Issue Type | Contact | Response Time |
|---|---|---|
| 🔴 BLOCK issue (critical error) | @drogafarto (CTO) | <30 min (business hours) |
| 🟡 Slow latency / Pub/Sub backlog | @devops (on-call) | <1h |
| 🟢 Low-priority question | `#dev-ops` Slack | <4h |

**Include in escalation:**
- Error timestamp + log snippet
- Function name + phase
- Action taken (rollback Y/N)
- Current status (restored Y/N)

---

**Version:** 1.0 (Phase 4 Baseline)  
**Last Updated:** 2026-05-08  
**Next Review:** After Phase 4 deploy (May 20, 2026)
