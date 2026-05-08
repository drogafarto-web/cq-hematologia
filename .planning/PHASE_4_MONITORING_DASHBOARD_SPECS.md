# Phase 4 Monitoring Dashboard Specifications

**Effective Date:** 2026-05-20 (Phase 4 Launch)  
**Deployment Location:** GCP Cloud Monitoring  
**Target Audience:** On-Call Engineer, Incident Commander, Alert Manager  
**Refresh Interval:** 30 seconds (real-time)

---

## Dashboard Architecture

**4 Monitoring Dashboards + 5 Alert Policies + 10 Log Sinks**

All dashboards are read-only after 12:30 UTC-3 on May 20. Real-time updates via Cloud Monitoring API.

---

## Dashboard 1: Portal Auth Health

**Purpose:** Monitor patient authentication subsystem (Portal feature)  
**Location:** GCP Cloud Monitoring > Dashboards > "HC Quality — Portal Auth Health"

### Widgets

#### Widget 1.1: Auth Success Rate (%)

**Type:** Gauge (target: >99%)

**Metric Query:**
```
resource.type="cloud_function"
AND resource.labels.function_name="verifyPatientAuthToken"
AND labels.status="success"
```

**Calculation:**
```
success_count / total_count * 100
// Metric source: Cloud Logging
// Time window: last 5 minutes
// Threshold: Red <95%, Yellow <98%, Green >99%
```

**Display:**
```
┌─────────────────────────────────────┐
│  Auth Success Rate                  │
│                                     │
│              98.5% ✓                │
│                                     │
│  Target: >99%                       │
│  5-minute rolling average           │
└─────────────────────────────────────┘
```

---

#### Widget 1.2: Login Latency (p50/p95/p99)

**Type:** Time Series Chart (target: p95 <500ms)

**Metric Query:**
```
resource.type="cloud_function"
AND resource.labels.function_name="verifyPatientAuthToken"
AND metric.type="cloudfunctions.googleapis.com/execution_times"
```

**Calculation:**
```
Percentile (50th): median latency
Percentile (95th): 95th percentile latency (SLO target)
Percentile (99th): tail latency (informational)
```

**Display:**
```
┌─────────────────────────────────────────────┐
│  Login Latency (ms)                         │
│  1000 │                                     │
│   800 │                                     │
│   600 │  ┌─────────────┐                   │
│   400 │  │p95: 420ms   │                   │
│   200 │  │p50: 180ms   │ ┌─────┐           │
│     0 │  └─────────────┘ │     │ ┌─────┐   │
│       └─────────────────────────────────────┘
│       08:30  09:00  09:30  10:00  10:30  11:00
│       Target p95: <500ms ✓
```

---

#### Widget 1.3: Email Delivery Rate (%)

**Type:** Gauge (target: >95%)

**Metric Query:**
```
resource.type="cloud_function"
AND textPayload=~".*sendAuthLink.*"
AND labels.status="sent"
```

**Calculation:**
```
sent_count / attempted_count * 100
```

**Display:**
```
┌─────────────────────────────────────┐
│  Email Delivery Rate                │
│                                     │
│              96.2% ✓                │
│                                     │
│  Last 1 hour: 48/50 emails sent     │
│  Target: >95%                       │
└─────────────────────────────────────┘
```

---

#### Widget 1.4: Failed Auth Attempts (count)

**Type:** Area Chart (trend only, no threshold)

**Metric Query:**
```
resource.type="cloud_function"
AND resource.labels.function_name="verifyPatientAuthToken"
AND labels.status="failed"
```

**Display:**
```
┌─────────────────────────────────────┐
│  Failed Auth Attempts (Last 4h)     │
│  10 │                               │
│   8 │  ▁                            │
│   6 │  █ ▂ ▂                       │
│   4 │  █ █ █ ▁                    │
│   2 │  █ █ █ █ ▂ ▁                │
│   0 │  █ █ █ █ █ █ ▁              │
│     └─────────────────────────────┘
│     08:30  09:30  10:30  11:30  12:30
│     Alert threshold: >10 in 5 min → P1
```

---

#### Widget 1.5: Session Duration (median)

**Type:** Gauge (informational)

**Metric Query:**
```
resource.type="firestore"
AND labels.collectionName="portal_sessions"
AND metric.type="duration"
```

**Calculation:**
```
Median session length in minutes
// Firestore doc read timestamp - creation timestamp
```

**Display:**
```
┌─────────────────────────────────────┐
│  Median Session Duration            │
│                                     │
│            24 minutes               │
│                                     │
│  (Baseline: 20–30 min expected)     │
└─────────────────────────────────────┘
```

---

## Dashboard 2: NOTIVISA Queue Health

**Purpose:** Monitor government adverse event submission pipeline  
**Location:** GCP Cloud Monitoring > Dashboards > "HC Quality — NOTIVISA Queue Health"

### Widgets

#### Widget 2.1: Queue Status Overview

**Type:** Pie Chart / Status Summary (breakdown by status)

**Metric Query:**
```
resource.type="firestore"
AND labels.collectionName="notivisa-queue"
```

**Breakdown:**
```
pending     (queued, waiting for processor)
submitted   (sent to ANVISA, awaiting ACK)
acknowledged (receipt confirmed)
failed_permanent (max retries exceeded)
```

**Display:**
```
┌──────────────────────────────────────┐
│  Queue Status Distribution           │
│                                      │
│  ◐ pending: 0 (0%)                  │
│  ◑ submitted: 2 (5%)                │
│  ◑ acknowledged: 38 (95%)           │
│  ◐ failed: 0 (0%)                   │
│                                      │
│  Total entries: 40                   │
│  Healthy: ✓ (no stuck entries)       │
└──────────────────────────────────────┘
```

---

#### Widget 2.2: Queue Processing Latency (p50/p95)

**Type:** Time Series Chart (target: p95 <100ms)

**Metric Query:**
```
resource.type="cloud_function"
AND resource.labels.function_name="notivisaQueueProcessor"
AND metric.type="cloudfunctions.googleapis.com/execution_times"
```

**Calculation:**
```
p50 (median): typical processing time
p95: 95th percentile (SLO target: <100ms)
```

**Display:**
```
┌──────────────────────────────────────┐
│  Queue Processor Latency (ms)        │
│  200 │                               │
│  150 │  ┌─────────────┐             │
│  100 │  │p95: 85ms    │ ┌─────┐    │
│   50 │  │p50: 40ms    │ │     │    │
│    0 │  └─────────────┘ └─────┘    │
│      └──────────────────────────────┘
│      08:30  09:00  09:30  10:00  11:00
│      Target p95: <100ms ✓
```

---

#### Widget 2.3: Submission Success Rate (%)

**Type:** Gauge (target: >95%)

**Metric Query:**
```
resource.type="cloud_function"
AND textPayload=~".*submitNotivisaToAnvisa.*"
AND labels.result="success"
```

**Calculation:**
```
success_count / (success_count + failed_count) * 100
// Over last 1 hour
```

**Display:**
```
┌──────────────────────────────────────┐
│  Submission Success Rate (1h)        │
│                                      │
│            98.3% ✓                   │
│                                      │
│  41/42 submissions successful        │
│  Target: >95%                        │
└──────────────────────────────────────┘
```

---

#### Widget 2.4: Stuck Entries (count)

**Type:** Gauge (alert: >0)

**Metric Query:**
```
resource.type="firestore"
AND labels.collectionName="notivisa-queue"
AND (
  (status="pending" AND createdAt < now() - 15 minutes)
  OR (status="submitted" AND createdAt < now() - 30 minutes)
)
```

**Calculation:**
```
Count of entries not advancing for >15 min (pending) or >30 min (submitted)
```

**Display:**
```
┌──────────────────────────────────────┐
│  Stuck Entries (>15min pending)      │
│                                      │
│               0 ✓                    │
│                                      │
│  Alert threshold: >0 → P1 immediate  │
│  Time window: last 1 hour            │
└──────────────────────────────────────┘
```

---

#### Widget 2.5: Feature Flag Status

**Type:** Info Card (state + percentage)

**Metric Query:**
```
featureFlags.notivisa-rollout (Firestore document)
```

**Display:**
```
┌──────────────────────────────────────┐
│  NOTIVISA Feature Flag               │
│                                      │
│  Status: ENABLED ✓                   │
│  Rollout: 25% (3 labs out of 12)     │
│  Labs in rollout:                    │
│    • lab-001 (hash: 12) ✓            │
│    • lab-002 (hash: 45) ✓            │
│    • lab-003 (hash: 67) ✓            │
│                                      │
│  Last updated: 2026-05-22 14:00      │
│  Updated by: incident-commander     │
└──────────────────────────────────────┘
```

---

#### Widget 2.6: ANVISA API Latency (p95)

**Type:** Time Series Chart (target: <3s)

**Metric Query:**
```
resource.type="cloud_function"
AND textPayload=~".*submitNotivisaToAnvisa.*"
AND labels.metric="roundTripMs"
```

**Calculation:**
```
p95 latency of SOAP calls to ANVISA API
```

**Display:**
```
┌──────────────────────────────────────┐
│  ANVISA API Latency (p95, ms)        │
│ 5000 │                               │
│ 4000 │                               │
│ 3000 │  ┌─────────────┐             │
│ 2000 │  │p95: 2100ms  │ ┌─────┐    │
│ 1000 │  │p50: 950ms   │ │     │    │
│    0 │  └─────────────┘ └─────┘    │
│      └──────────────────────────────┘
│      08:30  09:00  09:30  10:00  11:00
│      Target p95: <3000ms (sandbox) ✓
```

---

## Dashboard 3: Firestore Access Patterns

**Purpose:** Monitor data access, rules enforcement, and performance  
**Location:** GCP Cloud Monitoring > Dashboards > "HC Quality — Firestore Access"

### Widgets

#### Widget 3.1: Patient Read Latency (p50/p95)

**Type:** Time Series Chart (target: p95 <500ms)

**Metric Query:**
```
resource.type="firestore"
AND labels.collectionName=~".*patients.*"
AND jsonPayload.operation="Read"
```

**Calculation:**
```
Firestore read latency percentiles
```

**Display:**
```
┌──────────────────────────────────────┐
│  Patient Read Latency (ms)           │
│ 1000 │                               │
│  800 │                               │
│  600 │  ┌─────────────┐             │
│  400 │  │p95: 380ms   │ ┌─────┐    │
│  200 │  │p50: 120ms   │ │     │    │
│    0 │  └─────────────┘ └─────┘    │
│      └──────────────────────────────┘
│      08:30  09:00  09:30  10:00  11:00
│      Target p95: <500ms ✓
```

---

#### Widget 3.2: Laudo Query Latency (p50/p95)

**Type:** Time Series Chart (target: p95 <1000ms)

**Metric Query:**
```
resource.type="firestore"
AND labels.collectionName=~".*laudos.*"
AND jsonPayload.operation="Query"
```

**Calculation:**
```
Firestore composite query latency (using new indexes)
```

**Display:**
```
┌──────────────────────────────────────┐
│  Laudo Query Latency (ms)            │
│ 2000 │                               │
│ 1500 │                               │
│ 1000 │  ┌─────────────┐             │
│  500 │  │p95: 780ms   │ ┌─────┐    │
│    0 │  │p50: 320ms   │ │     │    │
│      │  └─────────────┘ └─────┘    │
│      └──────────────────────────────┘
│      08:30  09:00  09:30  10:00  11:00
│      Target p95: <1000ms ✓
```

---

#### Widget 3.3: Rule Rejections (count)

**Type:** Area Chart (alert: >10 in 5 min)

**Metric Query:**
```
resource.type="firestore"
AND textPayload=~".*Permission.*denied.*"
```

**Calculation:**
```
Count of rule rejections per 5-minute window
```

**Display:**
```
┌──────────────────────────────────────┐
│  Rule Rejections (Last 4h)           │
│  50 │                               │
│  40 │  ▁                            │
│  30 │  █ ▂ ▂                       │
│  20 │  █ █ █ ▁                    │
│  10 │  █ █ █ █ ▂ ▁                │
│   0 │  █ █ █ █ █ █ ▁              │
│     └──────────────────────────────┘
│     08:30  09:30  10:30  11:30  12:30
│     Alert threshold: >10 in 5 min → P2
│     Current: 2 (5-min window) ✓
```

---

#### Widget 3.4: Index Usage Summary

**Type:** Table (info only)

**Data Source:** Firestore Index Stats

**Display:**
```
┌────────────────────────────────────────────────┐
│  Index Usage (Last 1h)                         │
├──────────────────────┬──────────┬──────────────┤
│  Index Name          │ Usage    │ Efficiency   │
├──────────────────────┼──────────┼──────────────┤
│  notivisa-drafts-1   │ 342 hits │ 100% ✓       │
│  notivisa-queue-1    │ 156 hits │ 100% ✓       │
│  laudos-patientId-1  │ 1204 hits│ 100% ✓       │
│  patients-labId-1    │ 3421 hits│ 100% ✓       │
└────────────────────────────────────────────────┘
```

---

## Dashboard 4: System Health Overview

**Purpose:** High-level system SLOs, error budget, and incidents  
**Location:** GCP Cloud Monitoring > Dashboards > "HC Quality — System Health Overview"

### Widgets

#### Widget 4.1: Error Rate (%)

**Type:** Gauge (target: <0.1%, alert: >0.5%)

**Metric Query:**
```
resource.type="cloud_function"
AND severity="ERROR"
```

**Calculation:**
```
error_count / total_invocations * 100
// Over last 5 minutes
```

**Display:**
```
┌──────────────────────────────────────┐
│  System Error Rate (5-min)           │
│                                      │
│             0.02% ✓                  │
│                                      │
│  5 errors / 25,000 invocations       │
│  Target: <0.1% | Alert: >0.5%        │
└──────────────────────────────────────┘
```

---

#### Widget 4.2: Function Execution Time (p50/p90/p99)

**Type:** Time Series Chart (target: p90 <2s)

**Metric Query:**
```
resource.type="cloud_function"
AND metric.type="cloudfunctions.googleapis.com/execution_times"
```

**Calculation:**
```
Percentiles across all functions
```

**Display:**
```
┌──────────────────────────────────────┐
│  Function Execution Time (ms)        │
│ 5000 │                               │
│ 4000 │                               │
│ 3000 │  ┌─────────────┐             │
│ 2000 │  │p90: 1850ms  │ ┌─────┐    │
│ 1000 │  │p50: 420ms   │ │p99  │    │
│    0 │  └─────────────┘ └─────┘    │
│      └──────────────────────────────┘
│      08:30  09:00  09:30  10:00  11:00
│      Target p90: <2000ms ✓
```

---

#### Widget 4.3: Firestore Quota Usage (%)

**Type:** Gauge (alert: >80%)

**Metric Query:**
```
resource.type="firestore"
AND metric.type="quotas"
```

**Calculation:**
```
(current_usage / quota_limit) * 100
// For daily read/write operations
```

**Display:**
```
┌──────────────────────────────────────┐
│  Daily Firestore Quota               │
│                                      │
│               42% ✓                  │
│                                      │
│  Read operations: 315k / 750k        │
│  Write operations: 84k / 250k        │
│  Alert threshold: >80%               │
└──────────────────────────────────────┘
```

---

#### Widget 4.4: Error Budget (30-day SLO)

**Type:** Gauge + Status (target: 99.9% uptime = 43.2 min budget)

**Calculation:**
```
(max_allowed_downtime - actual_downtime) / max_allowed_downtime * 100
// 30-day rolling window
```

**Display:**
```
┌──────────────────────────────────────┐
│  Error Budget (30-day)               │
│                                      │
│   Remaining: 41.8 minutes ✓         │
│   Consumed: 1.4 minutes              │
│                                      │
│   99.9% SLA = 43.2 min downtime     │
│   Progress bar: [████████████░░░░░░░]│
└──────────────────────────────────────┘
```

---

#### Widget 4.5: Uptime Status

**Type:** Info Card (state indicator)

**Display:**
```
┌──────────────────────────────────────┐
│  System Uptime Status                │
│                                      │
│  Status: ✓ OPERATIONAL              │
│  Last Incident: 2026-05-15 (5d ago) │
│  MTTR: 12 minutes                    │
│  Current Streak: 5 days 2 hours     │
│                                      │
│  Incident History (30d):             │
│    • 0 P0 incidents                  │
│    • 1 P1 incident (resolved)        │
│    • 2 P2 incidents (resolved)       │
└──────────────────────────────────────┘
```

---

#### Widget 4.6: Active Alerts

**Type:** Table (live incidents)

**Data Source:** Cloud Monitoring Alert Policies

**Display:**
```
┌──────────────────────────────────────────────────────┐
│  Active Alerts                                       │
├──────────────┬────────┬──────────┬──────────────────┤
│  Alert       │ Policy │ Duration │ Status           │
├──────────────┼────────┼──────────┼──────────────────┤
│ (none)       │ —      │ —        │ ✓ All clear      │
└──────────────────────────────────────────────────────┘
```

---

## Alert Policies (5 Total)

### Alert 1: Portal Auth Failures (P1)

**Severity:** Critical  
**Notification:** SMS page + Slack `#production-alerts`  
**MTTR SLA:** <15 minutes  
**Runbook:** `.planning/runbooks/phase-4-auth-failures.md`

**Condition:**
```
resource.type="cloud_function"
AND resource.labels.function_name="verifyPatientAuthToken"
AND severity="ERROR"

Threshold: >5 errors in 5 minutes
Evaluation window: 5 minutes
Aggregation: sum
Condition: value > 5
```

**Notification Message:**
```
🚨 CRITICAL: Portal Auth Failures
  - >5 auth errors in 5 minutes
  - Users cannot access portal
  - Runbook: phase-4-auth-failures.md
  - Escalate to CTO if unresolved >15 min
```

---

### Alert 2: NOTIVISA Queue Stuck (P1)

**Severity:** Critical  
**Notification:** SMS page + Slack `#production-alerts`  
**MTTR SLA:** <15 minutes  
**Runbook:** `.planning/runbooks/phase-4-notivisa-queue.md`

**Condition:**
```
resource.type="firestore"
AND labels.collectionName="notivisa-queue"
AND (
  (status="pending" AND createdAt < now() - 15 minutes)
  OR (status="submitted" AND createdAt < now() - 30 minutes)
)

Threshold: >0 stuck entries
Evaluation window: 1 minute (check every minute)
Condition: value > 0
```

**Notification Message:**
```
🚨 CRITICAL: NOTIVISA Queue Stuck
  - >0 entries pending >15 minutes
  - Processor may be hung or crashing
  - Check: Cloud Logs, processor function status
  - Runbook: phase-4-notivisa-queue.md
```

---

### Alert 3: Rule Rejections Spike (P2)

**Severity:** High  
**Notification:** Email + Slack `#production-alerts`  
**MTTR SLA:** <1 hour  
**Runbook:** `.planning/runbooks/phase-4-firestore-rules.md`

**Condition:**
```
resource.type="firestore"
AND textPayload=~".*Permission.*denied.*"

Threshold: >10 rejections in 5 minutes
Evaluation window: 5 minutes
Condition: value > 10
```

**Notification Message:**
```
⚠️  HIGH: Firestore Rule Rejections Spike
  - >10 permission denied errors in 5 minutes
  - Check: user roles, rule logic, signature validation
  - Runbook: phase-4-firestore-rules.md
```

---

### Alert 4: Email Delivery Failure (P2)

**Severity:** High  
**Notification:** Email + Slack `#production-alerts`  
**MTTR SLA:** <1 hour  
**Runbook:** `.planning/runbooks/phase-4-email-delivery.md`

**Condition:**
```
resource.type="cloud_function"
AND textPayload=~".*sendAuthLink.*"
AND labels.status="failed"

Threshold: >5% failure rate (over 1-hour window)
Evaluation window: 1 hour
Condition: failure_rate > 0.05
```

---

### Alert 5: Function Latency Degradation (P3)

**Severity:** Medium  
**Notification:** Email (informational)  
**MTTR SLA:** <4 hours  
**Runbook:** `.planning/runbooks/phase-4-function-latency.md`

**Condition:**
```
resource.type="cloud_function"
AND metric.type="cloudfunctions.googleapis.com/execution_times"

Threshold: p90 latency >3 seconds
Evaluation window: 5 minutes
Condition: p90 > 3000ms
```

---

## Dashboard Export (Terraform)

**File:** `.planning/dashboards/phase-4-dashboards.tf` (optional)

To deploy dashboards as code:

```bash
# 1. Export dashboard JSON
gcloud monitoring dashboards describe [DASHBOARD_ID] --format=json > dashboard.json

# 2. Or define in Terraform
# See: https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_dashboard

# 3. Apply
terraform apply
```

---

## Accessing Dashboards

**Pre-Deployment (before May 20):**
1. Create in GCP Cloud Monitoring console manually
2. Or export from another environment

**Post-Deployment (May 20+):**
1. All dashboards should be live and streaming real-time data
2. Access at: `https://console.cloud.google.com/monitoring/dashboards`

**On-Call Access:**
- Desktop: Full access via GCP Console
- Mobile: Limited access via GCP Cloud Console mobile app (view-only)
- SMS alerts: Direct to on-call engineer phone

---

## Maintenance & Updates

**Weekly (every Monday 09:00 UTC-3):**
- Review dashboard accuracy (metrics still valid?)
- Check for stale data or missing data points
- Adjust alert thresholds if needed (too many false positives?)

**Monthly (first Monday of month):**
- Archive old dashboards (>6 months unused)
- Validate all alert policies are firing correctly
- Update runbook references if changed

---

**Dashboard Status:** Ready for deployment 2026-05-20  
**Owner:** Alert Manager + On-Call Rotation  
**Last Updated:** 2026-05-07
