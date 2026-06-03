# Phase 4 Cloud Logs Monitoring — Complete Index

**Status:** ✅ COMPLETE — Ready for deployment 2026-05-20  
**Last Updated:** 2026-05-07  
**Owner:** Alert Manager + CTO

---

## Overview

This directory contains the complete observability infrastructure for Phase 4 live operations (May 20 → Nov 30, 2026).

**Key Documents:**

| Document                          | Purpose                                                             | Status                          |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------- |
| `PHASE_4_CLOUD_LOGS_SETUP.md`     | Main monitoring spec (10 sinks, 5 alerts, 4 dashboards, 5 runbooks) | ✅ COMPLETE                     |
| `runbooks/phase-4-*.md` (5 files) | Detailed incident response playbooks                                | ✅ COMPLETE                     |
| `dashboards/*.json`               | GCP Cloud Monitoring dashboard exports                              | ⏳ TODO (create in GCP Console) |
| `PHASE_4_ALERT_POLICIES.tf`       | Terraform config for alert policies (optional)                      | ⏳ TODO                         |

---

## Deployment Checklist

**All items must be completed by 2026-05-18 (before 2026-05-20 launch).**

### Phase 1: Create Log Sinks (2 hours)

- [ ] **Sink 1:** Portal Auth Failures
- [ ] **Sink 2:** NOTIVISA Submission Errors
- [ ] **Sink 3:** Firestore Rule Rejections
- [ ] **Sink 4:** Portal Laudo Access (BigQuery)
- [ ] **Sink 5:** Session Timeouts
- [ ] **Sink 6:** Email Delivery
- [ ] **Sink 7:** NOTIVISA Webhook ACKs
- [ ] **Sink 8:** Performance Outliers
- [ ] **Sink 9:** Firestore Quota Warnings
- [ ] **Sink 10:** Unhandled Exceptions

**Instructions:** See `PHASE_4_CLOUD_LOGS_SETUP.md` Section 1 for filter + destination configs.

**Deployment location:** GCP Cloud Logging console (`https://console.cloud.google.com/logs/`)

---

### Phase 2: Create Alert Policies (2 hours)

- [ ] **Alert 1:** Portal Auth Failures Spike (P1)
  - Slack: `#production-alerts`
  - SMS Page: On-call engineer
  - Runbook: `runbooks/phase-4-auth-failures.md`

- [ ] **Alert 2:** NOTIVISA Queue Stuck (P1)
  - Slack: `#production-alerts`
  - SMS Page: On-call engineer
  - Runbook: `runbooks/phase-4-notivisa-queue.md`

- [ ] **Alert 3:** High Firestore Rule Rejections (P2)
  - Slack: `#production-alerts`
  - Email: Alert Manager + Security team
  - Runbook: `runbooks/phase-4-firestore-rules.md`

- [ ] **Alert 4:** Email Delivery Failure Rate (P2)
  - Slack: `#production-alerts`
  - Email: CTO + Support Manager
  - Runbook: `runbooks/phase-4-email-delivery.md`

- [ ] **Alert 5:** Function Latency Degradation (P3)
  - Slack: `#production-alerts`
  - Email: Alert Manager (informational)
  - Runbook: `runbooks/phase-4-function-latency.md`

**Instructions:** See `PHASE_4_CLOUD_LOGS_SETUP.md` Section 2 for alert conditions + thresholds.

**Deployment location:** GCP Cloud Monitoring console → Alerting → Create Policy

---

### Phase 3: Create Dashboards (2 hours)

- [ ] **Dashboard 1:** Portal Auth Health
  - Metrics: Token gen rate, email delivery, session count, latency p50/p95/p99
  - Location: `dashboards/portal-auth-health.json`

- [ ] **Dashboard 2:** NOTIVISA Queue Health
  - Metrics: Queue status (pending/submitted/failed), success rate, latency, ACK rate
  - Location: `dashboards/notivisa-queue-health.json`

- [ ] **Dashboard 3:** Firestore Access Patterns
  - Metrics: Patient/RT reads, rule rejections, access heatmap, isolation check
  - Location: `dashboards/firestore-access-patterns.json`

- [ ] **Dashboard 4:** System Health Overview
  - Metrics: Function error rate, quota usage, error budget, uptime
  - Location: `dashboards/system-health-overview.json`

**Instructions:** See `PHASE_4_CLOUD_LOGS_SETUP.md` Section 3 for widget specs + queries.

**Deployment location:** GCP Cloud Monitoring console → Dashboards → Create Dashboard

**Export:** After creating, export JSON:

```bash
gcloud monitoring dashboards describe DASHBOARD_ID --format=json > dashboards/dashboard-name.json
```

---

### Phase 4: Test & Training (1 hour)

- [ ] **Smoke Test:** Manually trigger P1 alert
  1. Create a test error log:
     ```bash
     gcloud logging write hc-quality-test "Test auth failure" \
       --severity=ERROR \
       --labels=functionName=verifyPatientAuthToken
     ```
  2. Verify alert fires to Slack within 2 minutes
  3. Verify alert can be acknowledged in GCP Console

- [ ] **Runbook Training:** On-call team reviews all 5 runbooks
  1. Each runbook walked through step-by-step
  2. Q&A for ambiguous procedures
  3. Test password reset + GCP access for team

- [ ] **Access Provisioning:**
  - [ ] On-call engineers have `roles/monitoring.alertPolicyEditor`
  - [ ] On-call engineers have GCP project viewer access
  - [ ] SMS pager configured + tested
  - [ ] CTO contact + SMS working

- [ ] **Documentation Review:**
  - [ ] All runbook paths verified (files exist)
  - [ ] All gcloud commands copy-paste ready (no syntax errors)
  - [ ] Slack channel `#production-alerts` created + team notified

---

### Phase 5: Go-Live (2026-05-20)

- [ ] All 5 runbooks printable + posted at team desks
- [ ] On-call rotation populated (see `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`)
- [ ] Error budget tracking dashboard live (Dashboard 4)
- [ ] Incident response contacts filled in
- [ ] First on-call engineer alerted + verified
- [ ] Launch monitoring simultaneous with Portal feature availability

---

## Runbook Quick Reference

| Alert                          | Severity | MTTR SLA | Runbook                       | Escalation      |
| ------------------------------ | -------- | -------- | ----------------------------- | --------------- |
| **Portal Auth Failures**       | P1       | <15 min  | `phase-4-auth-failures.md`    | CTO @ 30min     |
| **NOTIVISA Queue Stuck**       | P1       | <15 min  | `phase-4-notivisa-queue.md`   | CTO @ 30min     |
| **Firestore Rules Rejections** | P2       | <1 hour  | `phase-4-firestore-rules.md`  | Security team   |
| **Email Delivery Failure**     | P2       | <1 hour  | `phase-4-email-delivery.md`   | Support Manager |
| **Function Latency**           | P3       | <4 hours | `phase-4-function-latency.md` | None            |

**Quick Access:**

- All runbooks in `.planning/runbooks/phase-4-*.md`
- Print all 5 + laminate for desk reference

---

## Key Metrics Dashboard

**Access:** GCP Cloud Monitoring → Dashboards → "HC Quality — Production System Health"

**5-Minute Review:**

- Error rate: Target <0.1%, Alert >0.5%
- Firestore quota: Target <50%, Alert >80%
- Portal latency p95: Target <1.5s, Alert >2s
- NOTIVISA queue: Target 0 pending >15min, Alert >10 pending

**Daily Review (5 minutes):**

```bash
gcloud monitoring read \
  'metric.type="cloudfunctions.googleapis.com/execution_count" AND \
   resource.label.function_name=~"verifyPatientAuthToken|getPatientLaudos|notivisaQueueProcessor"' \
  --project=hmatologia2 | jq '.[].value'
```

---

## On-Call Responsibilities

**PRIMARY ON-CALL (24/7, 4-week rotation)**

- Monitor `#production-alerts` Slack channel
- Respond to P1 <15min, P2 <1hr, P3 <4hr
- Execute runbooks from Section 4
- Document incident details
- Escalate to CTO if unresolved >30min

**SECONDARY ON-CALL (escalation)**

- Available if primary unresolved >30min
- Fresh perspective on troubleshooting
- Assume primary if unavailable

**CTO ON-CALL (critical decisions)**

- Page for P0/P1 unresolved >30min
- Authorize rollback decisions
- Emergency secret rotation

**Rotation:** Start 2026-05-20, 4-week cycles (Sunday → Sunday)

**Contact Details:** See `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`

---

## Error Budget Policy

**30-Day Error Budget:** 99.9% uptime = 43.2 minutes acceptable downtime

| Duration  | Budget Impact                  |
| --------- | ------------------------------ |
| <5 min    | No impact                      |
| 5–15 min  | Full duration consumed         |
| 15–60 min | Full incident duration         |
| >60 min   | Critical; post-mortem required |

**Check monthly:** Dashboard 4 (System Health) shows error budget remaining.

---

## Monthly Maintenance

**First day of each month:**

- [ ] Review past month's incidents (count + MTTR)
- [ ] Adjust alert thresholds if needed (too many false positives?)
- [ ] Check error budget consumption
- [ ] Archive logs >retention period to BigQuery (cost optimization)
- [ ] Update runbooks based on lessons learned

**Quarterly (every 3 months):**

- [ ] Full runbook procedure test in staging (end-to-end)
- [ ] On-call rotation effectiveness review
- [ ] RDC 978 Art. 167–182 compliance audit
- [ ] Incident response contacts refresh

---

## Related Documentation

**Phase 4 Onboarding:**

- `docs/v1.4_NOTIVISA_SANDBOX_SETUP.md` — Gov API integration
- `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` — On-call rotation

**Monitoring Baseline (v1.3):**

- `docs/CLOUD_LOGS_MONITORING_REPORT_v1.3.md` — Metrics baseline
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — v1.3 reference

**Architecture & Security:**

- `.claude/rules/firestore-security.md` — Multi-tenant rules
- `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` — Secret management
- `docs/adr/ADR-0021-notivisa-security.md` — Gov API security

---

## Files Created

✅ `.planning/PHASE_4_CLOUD_LOGS_SETUP.md` (10 KB)
✅ `.planning/PHASE_4_MONITORING_INDEX.md` (this file)
✅ `.planning/runbooks/phase-4-auth-failures.md` (12 KB)
✅ `.planning/runbooks/phase-4-notivisa-queue.md` (11 KB)
✅ `.planning/runbooks/phase-4-firestore-rules.md` (9 KB)
✅ `.planning/runbooks/phase-4-email-delivery.md` (10 KB)
✅ `.planning/runbooks/phase-4-function-latency.md` (9 KB)

**Total:** ~61 KB documentation, 5 runbooks, 10 sinks, 5 alerts, 4 dashboards ready for deployment.

---

## Next Steps

1. **Immediate (by 2026-05-15):**
   - Review all documents with Alert Manager + CTO
   - Create GCP alert policies + dashboards
   - Verify team access + SMS pager

2. **Pre-Launch (2026-05-18 to 2026-05-20):**
   - Smoke test all alerts
   - On-call team training
   - Go-live readiness sign-off

3. **Go-Live (2026-05-20):**
   - Enable monitoring (all 5 alerts armed)
   - On-call rotation active
   - Monitor first 24h continuously

4. **Post-Launch (2026-05-21+):**
   - Daily health checks (5 min)
   - Weekly incident review
   - Monthly threshold tuning

---

**Document Status:** ✅ READY FOR DEPLOYMENT  
**Approval:** Awaiting CTO sign-off  
**Last Modified:** 2026-05-07 12:00 UTC
