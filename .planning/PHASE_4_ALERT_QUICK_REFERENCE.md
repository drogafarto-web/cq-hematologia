# Phase 4 Alert Quick Reference — Print & Post at Desks

**For On-Call Engineers — Laminate and keep visible**

---

## Alert Response Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│ ALERT FIRES → WHAT TO DO                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🚨 PORTAL AUTH FAILURES (P1)                  ← RED ALERT      │
│    Severity: CRITICAL — Patients cannot login                  │
│    Response Time: <15 minutes                                   │
│    Action:                                                      │
│      1. Check Cloud Logs for error pattern                      │
│      2. Determine cause (rule bug, email down, HMAC, timeout)  │
│      3. Execute: .planning/runbooks/phase-4-auth-failures.md   │
│    Escalate to CTO: If unresolved >30min                       │
│                                                                 │
│    🔗 RUNBOOK: phase-4-auth-failures.md (step-by-step)        │
│    💬 SLACK: #production-alerts                                │
│    📱 PAGE: On-call engineer (SMS + voice)                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🚨 NOTIVISA QUEUE STUCK (P1)                  ← RED ALERT      │
│    Severity: CRITICAL — Adverse events not submitted to gov    │
│    Response Time: <15 minutes                                   │
│    Action:                                                      │
│      1. Check queue status (pending >15min?)                   │
│      2. Check cron last executed (should be <5min ago)         │
│      3. Determine cause (cron down, gov API, payload format)   │
│      4. Execute: .planning/runbooks/phase-4-notivisa-queue.md │
│    Escalate to CTO: If unresolved >30min                       │
│                                                                 │
│    🔗 RUNBOOK: phase-4-notivisa-queue.md (step-by-step)       │
│    💬 SLACK: #production-alerts                                │
│    📱 PAGE: On-call engineer (SMS + voice)                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ⚠️  FIRESTORE RULES REJECTIONS (P2)           ← YELLOW ALERT   │
│    Severity: HIGH — Some users cannot access data              │
│    Response Time: <1 hour                                       │
│    Action:                                                      │
│      1. Identify rejection pattern (which path? which user?)   │
│      2. Check rules syntax (git diff recent changes)           │
│      3. Verify user token is valid (role, labId, status)       │
│      4. Execute: .planning/runbooks/phase-4-firestore-rules.md│
│    Escalate to Security: If multi-tenant isolation breach      │
│                                                                 │
│    🔗 RUNBOOK: phase-4-firestore-rules.md (decision tree)     │
│    💬 SLACK: #production-alerts                                │
│    📧 EMAIL: Alert Manager + Security team                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ⚠️  EMAIL DELIVERY FAILURE >20% (P2)          ← YELLOW ALERT   │
│    Severity: HIGH — Patients cannot receive auth links         │
│    Response Time: <1 hour                                       │
│    Action:                                                      │
│      1. Confirm failure rate (not false positive)              │
│      2. Get error details (vendor? quota? template? data?)     │
│      3. Execute: .planning/runbooks/phase-4-email-delivery.md │
│    Escalate to CTO: If vendor down + no fallback available     │
│                                                                 │
│    🔗 RUNBOOK: phase-4-email-delivery.md (vendor checklist)   │
│    💬 SLACK: #production-alerts                                │
│    📧 EMAIL: CTO + Support Manager                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ℹ️  FUNCTION LATENCY >2s p95 (P3)              ← INFO ALERT    │
│    Severity: LOW — Poor UX but not blocking                    │
│    Response Time: <4 hours                                      │
│    Action:                                                      │
│      1. Identify slow function (latency p95 > 2s)              │
│      2. Profile execution (cold start? Firestore? CPU?)        │
│      3. Execute: .planning/runbooks/phase-4-function-latency.md│
│    Escalate: None (informational only)                         │
│                                                                 │
│    🔗 RUNBOOK: phase-4-function-latency.md (profiling guide)  │
│    💬 SLACK: #production-alerts                                │
│    📧 EMAIL: Alert Manager (FYI)                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Commands (Copy-Paste Ready)

### Auth Failures Triage
```bash
gcloud logging read \
  'resource.type="cloud_function" AND severity>=ERROR AND \
   (textPayload=~"verifyPatientAuthToken|generatePatientAuthLink")' \
  --limit=20 --project=hmatologia2 --format=json | \
  jq '.[] | {timestamp: .timestamp, function: .labels.functionName, error: .textPayload}'
```

### NOTIVISA Queue Status
```bash
gcloud firestore documents list \
  --collection-ids=notivisa-queue \
  --project=hmatologia2 | \
  jq 'group_by(.status) | map({status: .[0].status, count: length})'
```

### Firestore Rule Rejections
```bash
gcloud logging read \
  'resource.type="firestore" AND textPayload=~".*Permission.*denied.*"' \
  --limit=50 --project=hmatologia2 --format=json | \
  jq '[.[] | .labels.documentPath] | group_by(.) | map({path: .[0], count: length}) | sort_by(.count) | reverse' | head -10
```

### Email Delivery Rate
```bash
gcloud logging read \
  "resource.type='cloud_function' AND \
   labels.functionName='generatePatientAuthLink' AND \
   timestamp>='-P1H'" \
  --limit=200 --project=hmatologia2 --format=json | \
  jq 'group_by(.severity) | map({severity: .[0].severity, count: length})'
```

### Function Latency p95
```bash
gcloud logging read \
  'resource.type="cloud_function"' \
  --limit=500 --project=hmatologia2 --format=json | \
  jq 'group_by(.labels.functionName) | map({
    name: .[0].labels.functionName,
    p95_latency: (map(.duration) | sort | .[0.95 * length] | round)
  }) | sort_by(.p95_latency) | reverse'
```

---

## Runbook Quick Links

| Alert | Runbook | Path |
|-------|---------|------|
| **Portal Auth Failures** | auth-failures | `.planning/runbooks/phase-4-auth-failures.md` |
| **NOTIVISA Queue Stuck** | notivisa-queue | `.planning/runbooks/phase-4-notivisa-queue.md` |
| **Firestore Rules Rejections** | firestore-rules | `.planning/runbooks/phase-4-firestore-rules.md` |
| **Email Delivery Failure** | email-delivery | `.planning/runbooks/phase-4-email-delivery.md` |
| **Function Latency** | function-latency | `.planning/runbooks/phase-4-function-latency.md` |

**Quick Access:**
1. Read alert message in Slack
2. Identify severity (P1/P2/P3)
3. Find matching row in table above
4. Open runbook from "Path" column
5. Follow step-by-step instructions
6. Document incident in ticket
7. Escalate if unresolved >threshold

---

## Escalation Checklist

### If P1 unresolved >15 min

- [ ] Confirm alert is real (not false positive)
- [ ] Followed runbook steps 1–3 without resolution
- [ ] Tried all troubleshooting in relevant section

**ACTION:** Page CTO immediately
```bash
# Send SMS to CTO
echo "P1 Alert: [Alert Name] unresolved >30min. Executing runbook steps but need guidance. Check Slack #production-alerts"
```

### If P1 unresolved >30 min

- [ ] CTO notified + on-call discussion
- [ ] Runbook exhausted all options
- [ ] Manual intervention considered (rollback, soft-delete, etc.)

**ACTION:** Prepare rollback decision
- Check last stable version (v1.3 portal-disabled)
- Contact CTO for authority to rollback
- Execute rollback if approved

### If Security Incident Suspected

- [ ] Cross-lab data access detected
- [ ] Privilege escalation (viewer can write)
- [ ] Mass access attempts (DDoS pattern)

**ACTION:** Page CTO + Security team immediately
- Stop all user operations (possible breach)
- Preserve audit trail (no deletions)
- Begin forensics

---

## Dashboard Access

**Primary Dashboard (check every 5 min during incident):**
```
GCP Cloud Monitoring → Dashboards → "HC Quality — Production System Health"
```

**Key Metrics to Watch:**
- Cloud Functions Error Rate (target: <0.1%)
- Firestore Quota Usage (target: <50%)
- Portal Auth Latency p95 (target: <1.5s)
- NOTIVISA Queue Pending (target: 0)

**All 4 Dashboards:**
1. **Portal Auth Health** — Token gen, email delivery, session count, latency
2. **NOTIVISA Queue Health** — Queue status, submission rate, webhook ACK, processor cron
3. **Firestore Access Patterns** — Patient/RT reads, rule rejections, access heatmap
4. **System Health Overview** — Error rate, quota, error budget, uptime

---

## Contact Cheat Sheet

**PRIMARY ON-CALL** (Mon–Fri 9am–5pm, + on-call rotation)
- SMS/Voice Pager: [configured in on-call system]
- Slack: @on-call-primary
- Timezone: UTC

**SECONDARY ON-CALL** (backup if primary unavailable)
- SMS/Voice Pager: [configured in on-call system]
- Slack: @on-call-secondary
- Timezone: UTC

**CTO** (for P0/P1 unresolved >30min)
- Email: [from v1.4-INCIDENT_RESPONSE_CONTACTS.md]
- SMS: [from on-call system]
- Slack: @CTO

**SUPPORT MANAGER** (for email/portal issues)
- Slack: #support-operations
- Email: [from v1.4-INCIDENT_RESPONSE_CONTACTS.md]

**SECURITY TEAM** (for access control incidents)
- Slack: #security
- Email: [from v1.4-INCIDENT_RESPONSE_CONTACTS.md]

---

## Incident Documentation Template

**When alert fires, create ticket with:**

```
Title: [Alert Name] — [Date] — [Severity]

Description:
- Alert triggered at: [time UTC]
- Alert condition: [threshold that fired]
- Affected service: [Portal/NOTIVISA/Firestore/Email/Functions]
- Estimated customer impact: [# of users affected]

Troubleshooting:
- Root cause identified: [from runbook diagnosis]
- Fix applied: [step #X from runbook]
- Time to resolution: [MTTR in minutes]

Resolution:
- ☐ Error rate/queue cleared
- ☐ Customer impact mitigated
- ☐ Monitoring confirmed healthy
- ☐ Post-mortem scheduled (if >30 min)

Post-Incident:
- ☐ Root cause documented
- ☐ Runbook updated (if new steps discovered)
- ☐ Alert threshold reviewed (false positives?)
- ☐ Prevention measure identified
```

---

## Common False Positives

| Alert | False Positive Cause | Fix |
|-------|---------------------|-----|
| Auth Failures | Cold start latency | Exclude first 2 min after deploy |
| NOTIVISA Queue | Slow gov API (normal) | Increase timeout threshold |
| Firestore Rejections | Expected rejections (viewer accessing admin) | Refine filter to exclude expected patterns |
| Email Delivery | Normal temporary SendGrid hiccup | Increase failure rate threshold to >30% |
| Function Latency | Cold start (expected) | Monitor warm execution only (skip first 10 min) |

**If alert fires repeatedly for same false positive:**
1. Document in runbook
2. Request threshold adjustment
3. Update alert policy in GCP Console

---

## Quick Sanity Check

**Run this every morning (5 minutes):**

```bash
#!/bin/bash
echo "=== Phase 4 System Health ==="

# Error rate
echo -n "Error rate (past 1h): "
gcloud logging read 'severity>=ERROR' --limit=1000 --project=hmatologia2 | wc -l
echo "/1000"

# Quota usage
echo -n "Firestore quota usage: "
gcloud monitoring read 'metric.type="firestore.googleapis.com/document_reads"' --project=hmatologia2 | tail -1 | jq '.value'
echo "% of daily limit"

# Queue status
echo -n "NOTIVISA pending entries: "
gcloud firestore documents list --collection-ids=notivisa-queue --project=hmatologia2 | \
  jq '[.[] | select(.status=="pending")] | length'

# Portal sessions
echo -n "Active portal sessions: "
gcloud firestore documents list --collection-ids=portal-sessions --project=hmatologia2 | \
  jq '[.[] | select(.status=="active")] | length'

echo ""
echo "✅ All systems nominal" || echo "⚠️  Check alerts above"
```

---

**Last Updated:** 2026-05-07  
**For:** Phase 4 Live Operations (May 20 → Nov 30, 2026)  
**Print 5 copies for on-call desk rotation**
