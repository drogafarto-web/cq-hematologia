# Phase 4 Cloud Logs Monitoring Setup

**Effective Date:** 2026-05-20 (Phase 4 Launch)  
**Region:** `southamerica-east1`  
**Project ID:** `hmatologia2`  
**Monitor Duration:** 24/7 continuous (May 20 → November 30)  
**Last Updated:** 2026-05-07

---

## Overview

Phase 4 introduces two critical new subsystems to HC Quality:
1. **Portal Patient Access** — Patient-facing auth + laudo reads (RDC 978 Art. 167)
2. **NOTIVISA Submission Queue** — Government adverse event reporting (RDC 978 Art. 41 + ANVISA req)

This document establishes the observability infrastructure for safe live operations. All monitoring is configured before 2026-05-20 launch. Production is not permitted to go live without completion of **Section 2 (Alert Policies)** and **Section 3 (Runbooks)**.

---

## Section 1: Log Sinks (10 Critical Categories)

**Deployment:** Deploy sinks before 2026-05-18. All sinks live in GCP Cloud Logging console with 24/7 streaming.

---

### Sink 1: Portal Auth Failures

**Purpose:** Track patient authentication failures (Portal feature).

**Filter:**
```
severity >= ERROR 
AND (resource.type="cloud_function" OR resource.type="firestore")
AND (
  textPayload=~".*verifyPatientAuthToken.*"
  OR textPayload=~".*generatePatientAuthLink.*"
  OR textPayload=~".*permission denied.*"
  OR jsonPayload.errorCode="auth/invalid-email"
  OR jsonPayload.errorCode="auth/user-not-found"
)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 30 days
- **Alert Threshold:** >5 errors per 5 minutes → Alert 1 (P1)
- **Failure Mode:** Patient cannot authenticate or access portal

**What to Monitor:**
- Email delivery failures (token link generation)
- Firestore rule rejections on `/labs/{labId}/patients/{patientId}`
- Function timeout on `verifyPatientAuthToken`
- Invalid token signature (HMAC key rotation issue)

**Dashboard Metric:** Auth Error Count (real-time counter)

---

### Sink 2: NOTIVISA Submission Errors

**Purpose:** Track government API queue processing failures.

**Filter:**
```
severity >= ERROR 
AND resource.type="cloud_function"
AND (
  textPayload=~".*notivisaDraftCreate.*"
  OR textPayload=~".*submitNotivisaDraft.*"
  OR textPayload=~".*notivisaQueueProcessor.*"
  OR textPayload=~".*notivisaWebhookHandler.*"
  OR labels.functionName="notivisaQueueProcessor"
)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 60 days (compliance: RDC 978 Art. 41 audit trail)
- **Alert Threshold:** >3 errors per 10 minutes → Alert 2 (P1)
- **Failure Mode:** Adverse events queued but never submitted to ANVISA

**What to Monitor:**
- SOAP API timeout (gov API unavailable)
- Invalid payload format (message structure error)
- Authentication failure to gov sandbox/production
- Queue entry stuck in `pending` state >15 minutes
- Webhook ACK not received after submission

**Dashboard Metric:** NOTIVISA Queue Health (pending count + last processed timestamp)

---

### Sink 3: Firestore Rule Rejections

**Purpose:** Detect access control violations (multi-tenant isolation breach).

**Filter:**
```
severity >= ERROR 
AND resource.type="firestore"
AND textPayload=~".*Permission.*denied.*"
AND (
  labels.database=~".*firestore.*"
  OR jsonPayload.operation=~".*Read|Write|Delete.*"
)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 30 days
- **Alert Threshold:** >10 rejections per 5 minutes → Alert 3 (P2) + manual audit
- **Failure Mode:** Patient accessing wrong lab; RT accessing patient data; rule syntax error

**What to Monitor:**
- Portal patient reads outside their labId
- RT reads on portal collections (should not happen)
- Signature validation failure (hash mismatch)
- Collection path not matching expected pattern

**Dashboard Metric:** Rule Rejection Count + Rejection Reason Breakdown

---

### Sink 4: Portal Patient Laudo Access

**Purpose:** Track patient laudo read patterns (audit trail + analytics).

**Filter:**
```
resource.type="firestore"
AND (
  labels.collectionName=~".*laudos.*"
  OR jsonPayload.collection=~".*laudos.*"
)
AND jsonPayload.request.auth.token.portal == true
```

**Sink Configuration:**
- **Destination:** BigQuery (table: `hc_quality.cloud_logs.portal_laudo_reads`)
- **Retention:** 365 days (1 year for compliance)
- **Export Schedule:** Continuous
- **Failure Mode:** None (read-only logs)

**What to Monitor:**
- Patient access frequency (pattern analysis)
- Which results are most viewed (usage analytics)
- Peak access hours (capacity planning)
- Access by patient demographic (optional: for support triage)

**Dashboard Metric:** Portal Laudo Access Trends (hourly count, geographic heatmap if available)

---

### Sink 5: Session Timeouts & Logouts

**Purpose:** Monitor patient session lifecycle (normal vs. forced logouts).

**Filter:**
```
severity >= WARNING
AND (
  textPayload=~".*session expired.*"
  OR textPayload=~".*logout.*"
  OR jsonPayload.event="session.expired"
  OR jsonPayload.event="logout"
)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 30 days
- **Alert Threshold:** None (informational)
- **Failure Mode:** None (normal operation)

**What to Monitor:**
- Expected logout rate (patient closes session)
- Unexpected session expirations (idle timeout)
- Forced logouts (admin session termination)
- Session duration patterns (how long patients stay logged in)

**Dashboard Metric:** Session Count (active sessions, average duration)

---

### Sink 6: Email Delivery (Patient Auth Links)

**Purpose:** Track patient authentication email delivery success/failure.

**Filter:**
```
resource.type="cloud_function"
AND (
  labels.functionName="generatePatientAuthLink"
  OR textPayload=~".*email.*sent.*"
  OR textPayload=~".*SendGrid.*"
  OR textPayload=~".*RESEND_API.*"
)
AND (severity >= WARNING OR severity >= ERROR)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 30 days
- **Alert Threshold:** Error rate >20% over 1 hour window → Alert 4 (P2)
- **Failure Mode:** Patient cannot receive auth link; cannot access portal

**What to Monitor:**
- Email delivery success rate
- Bounce rate (invalid email addresses)
- SendGrid/RESEND quota usage
- Email template render failures
- Rate limiting (too many auth emails to same patient)

**Dashboard Metric:** Email Delivery Rate (success/bounced/pending)

---

### Sink 7: NOTIVISA Webhook ACKs

**Purpose:** Track government callback processing (adverse event submission confirmation).

**Filter:**
```
resource.type="cloud_function"
AND labels.functionName="notivisaWebhookHandler"
AND (
  textPayload=~".*webhook.*received.*"
  OR textPayload=~".*ACK.*"
  OR jsonPayload.status=~".*acknowledged|failed.*"
)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 90 days (compliance: RDC 978 Art. 41 submission audit)
- **Alert Threshold:** None (webhook is asynchronous)
- **Failure Mode:** Gov callback lost; lab thinks event not submitted

**What to Monitor:**
- Webhook delivery success rate
- ACK receipt latency (how fast gov responds)
- Webhook signature validation (security check)
- Duplicate webhook receipt handling
- Network timeout on webhook receive

**Dashboard Metric:** Webhook Processing Rate (per hour)

---

### Sink 8: Performance Outliers (Slow Functions)

**Purpose:** Detect function execution time degradation.

**Filter:**
```
resource.type="cloud_function"
AND (
  jsonPayload.executionTime > 5000
  OR labels.duration > 5000
)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 30 days
- **Alert Threshold:** >5 functions with execution >5s per hour → Alert 5 (P3)
- **Failure Mode:** Slow auth, slow laudo reads, poor UX

**What to Monitor:**
- Function execution time histogram (p50/p95/p99)
- Cold start latency (normal, expected)
- Warm execution time (should be <1s for callables)
- Firestore query performance (slow reads)
- Signature computation time (if HMAC is expensive)

**Dashboard Metric:** Function Latency Percentiles (p50/p95/p99)

---

### Sink 9: Firestore Quota Warnings

**Purpose:** Monitor database quota approach (cost control + availability).

**Filter:**
```
resource.type="firestore"
AND (
  textPayload=~".*quota.*exceeded.*"
  OR textPayload=~".*rate limit.*"
  OR jsonPayload.errorCode="RESOURCE_EXHAUSTED"
)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 60 days
- **Alert Threshold:** Any quota warning → Alert Manager + CTO email
- **Failure Mode:** Database unavailable; all reads/writes fail

**What to Monitor:**
- Document write rate (daily limit: 24M for hmatologia2)
- Document read rate (daily limit: 100M)
- Index maintenance quota
- Storage size (approaching 1GB limit per collection)

**Dashboard Metric:** Firestore Quota Usage (% of daily limit)

---

### Sink 10: Unhandled Exceptions

**Purpose:** Catch JS runtime errors in functions (TypeError, ReferenceError, etc.).

**Filter:**
```
severity = ERROR
AND resource.type="cloud_function"
AND (
  textPayload=~".*TypeError.*"
  OR textPayload=~".*ReferenceError.*"
  OR textPayload=~".*SyntaxError.*"
  OR textPayload=~".*Cannot read.*"
  OR jsonPayload.errorType=~".*Error.*"
)
```

**Sink Configuration:**
- **Destination:** Cloud Logging (default)
- **Retention:** 30 days
- **Alert Threshold:** Any error → Alert 10 (P0, immediate page)
- **Failure Mode:** Function crash; callable returns 500 Internal Server Error

**What to Monitor:**
- Null/undefined access crashes
- Missing dependencies (import errors)
- Invalid JSON parsing
- Stack overflow (recursion)
- Out-of-memory (despite memory limit settings)

**Dashboard Metric:** Error Count (real-time, red if >0)

---

## Section 2: Alert Policies (5 Critical)

**Deployment:** Create alerts in GCP Cloud Monitoring console before 2026-05-18. All alerts configured to fire to **Slack #production-alerts** + SMS page on-call rotation for P1.

---

### Alert 1: Portal Auth Failures Spike (P1)

**Condition:**
```
resource.type = "cloud_function"
metric.type = "cloudfunctions.googleapis.com/execution_count"
filter(resource.label.function_name = "verifyPatientAuthToken")
AND aggregation(
  alignment_period: "300s",
  per_series_aligner: ALIGN_RATE
)
> 0.05  # More than 5 errors per 5 min at 1 req/s baseline
```

**Alert Name:** `portal-auth-failures-spike`

**Notification:**
1. Slack `#production-alerts`: `🚨 AUTH CRITICAL: Portal token verification failing (>5/5min). Check email service + Firestore rules.`
2. SMS Page: On-call engineer
3. Email: CTO + Alert Manager

**Response Time SLA:** <15 minutes

**Runbook:** See Section 4, Runbook 1 (Auth Failures > 5/5min)

**Escalation:**
- If unresolved after 30 min: page CTO
- If unresolved after 60 min: consider rollback to v1.3 portal-disabled

**Recovery Signal:** Error rate drops below 1 error per 5 min for 10 consecutive minutes.

---

### Alert 2: NOTIVISA Queue Stuck (P1)

**Condition:**
```
resource.type = "firestore"
AND collection = "notivisa-queue/{labId}/events"
AND query: status == "pending" AND createdAt < now() - 15min
aggregate(count) > 10
```

**Alternative (if above not available):**
Manual daily check via Cloud Logs:
```bash
gcloud logging read \
  'resource.type="firestore" AND textPayload=~"notivisa.*queue"' \
  --limit=50 --project=hmatologia2
```

**Alert Name:** `notivisa-queue-stuck`

**Notification:**
1. Slack `#production-alerts`: `🚨 NOTIVISA QUEUE STUCK: 10+ pending events not processed in 15 min. Restart cron or check SOAP API availability.`
2. SMS Page: On-call engineer
3. Email: CTO

**Response Time SLA:** <15 minutes

**Runbook:** See Section 4, Runbook 2 (NOTIVISA Queue Stuck)

**Escalation:**
- If unresolved after 30 min: soft-delete stuck entry + escalate
- If pattern repeats: investigate gov API stability

**Recovery Signal:** All pending events processed within 10 minutes.

---

### Alert 3: High Firestore Rule Rejections (P2)

**Condition:**
```
resource.type = "firestore"
AND textPayload =~ ".*Permission.*denied.*"
aggregate(count over 300s) > 10
```

**Alert Name:** `firestore-rule-rejections-spike`

**Notification:**
1. Slack `#production-alerts`: `⚠️ FIRESTORE RULES: 10+ access rejections detected. Audit session tokens + rule syntax.`
2. Email: Alert Manager + Security team

**Response Time SLA:** <1 hour

**Runbook:** See Section 4, Runbook 3 (Firestore Rules Rejections Spike)

**Escalation:**
- If rejections are from valid users: rule syntax bug → deploy fix
- If rejections are from invalid session tokens: patient/RT usage error → support notification

**Recovery Signal:** Rejections drop below 2 per 5 minutes.

---

### Alert 4: Email Delivery Failure Rate (P2)

**Condition:**
```
resource.type = "cloud_function"
AND labels.functionName = "generatePatientAuthLink"
aggregate over 3600s:
  error_count / (success_count + error_count) > 0.20  # >20% failure rate
```

**Alternative:**
Manual check via Cloud Logs:
```bash
gcloud logging read \
  'resource.type="cloud_function" AND functionName="generatePatientAuthLink"' \
  --limit=100 --project=hmatologia2 | grep -E "error|success"
```

**Alert Name:** `email-delivery-failure-rate`

**Notification:**
1. Slack `#production-alerts`: `⚠️ EMAIL: 20%+ auth emails failing. Check SendGrid/RESEND quota + bounce rate.`
2. Email: CTO + Support Manager

**Response Time SLA:** <1 hour

**Runbook:** See Section 4, Runbook 4 (Email Delivery Failure > 20%)

**Escalation:**
- If email vendor quota exceeded: upgrade plan or use fallback SMS
- If high bounce rate: audit patient email addresses in database

**Recovery Signal:** Success rate returns above 80%.

---

### Alert 5: Function Latency Degradation (P3)

**Condition:**
```
resource.type = "cloud_function"
AND (
  labels.functionName = "verifyPatientAuthToken"
  OR labels.functionName = "getPatientLaudos"
)
metric.type = "cloudfunctions.googleapis.com/execution_times"
aggregate over 300s:
  p95_latency > 2000  # p95 > 2 seconds for portal callables
```

**Alert Name:** `function-latency-degradation`

**Notification:**
1. Slack `#production-alerts`: `ℹ️ LATENCY: Portal functions p95 > 2s. Profile execution + check Firestore indexes.`
2. Email: Alert Manager

**Response Time SLA:** <4 hours (lower priority)

**Runbook:** See Section 4, Runbook 5 (Function Latency > 2s)

**Escalation:**
- If bottleneck is Firestore query: check index coverage + create missing indexes
- If bottleneck is CPU: optimize payload validation or signature computation

**Recovery Signal:** p95 latency drops below 1.5 seconds for 30 consecutive minutes.

---

## Section 3: Dashboards

**Deployment:** Create all 4 dashboards in GCP Cloud Monitoring before 2026-05-18. Export JSON configs to `.planning/dashboards/`.

---

### Dashboard 1: Portal Auth Health

**Title:** `HC Quality — Portal Patient Auth`  
**Refresh Rate:** 30 seconds  
**Audience:** Alert Manager + On-Call Engineer

**Metrics:**

| Widget | Metric | Display | Threshold |
|--------|--------|---------|-----------|
| **Auth Token Gen Success Rate** | Function invocation success % | Gauge (0–100%) | Green >99%, Yellow 95–99%, Red <95% |
| **Email Delivery Rate** | SendGrid/RESEND success % | Time series | Green >95%, Yellow 85–95%, Red <85% |
| **Active Patient Sessions** | Session count (real-time) | Number | Info only |
| **Auth Latency p50/p95/p99** | Function execution time | Line chart | p95 target: <1s, warning >1.5s |
| **Daily Auth Volume** | Cumulative token generations | Bar chart | Info only |
| **Email Bounces** | Bounce count + bounce rate | Stacked bar | Alert if >5% |
| **Session Avg Duration** | Average time logged in | Gauge (minutes) | Info only |
| **Auth Error Count** | Errors over past 24h | Counter | Alert if >5 |

**SQL Query (BigQuery optional):**
```sql
SELECT
  TIMESTAMP_TRUNC(timestamp, HOUR) as hour,
  COUNT(*) as auth_attempts,
  COUNTIF(severity = "ERROR") as errors,
  ROUND(COUNTIF(severity = "ERROR") / COUNT(*) * 100, 2) as error_rate_pct
FROM hc_quality.cloud_logs.portal_auth
GROUP BY hour
ORDER BY hour DESC
LIMIT 24
```

---

### Dashboard 2: NOTIVISA Queue Health

**Title:** `HC Quality — NOTIVISA Submission Queue`  
**Refresh Rate:** 60 seconds  
**Audience:** Compliance Officer + CTO

**Metrics:**

| Widget | Metric | Display | Threshold |
|--------|--------|---------|-----------|
| **Queue Status** | Pending / Submitted / Failed count | Pie chart | Green: all processed, Yellow: >5 pending, Red: >10 pending |
| **Submission Success Rate** | % of queue events successfully submitted | Gauge | Green >98%, Yellow 95–98%, Red <95% |
| **Avg Processing Latency** | Time from creation to submission | Gauge (seconds) | Green <60s, Yellow 60–120s, Red >120s |
| **Webhook ACK Rate** | % of submitted events receiving gov ACK | Gauge | Green >99%, Yellow 95–99%, Red <95% |
| **Queue Entry Age Distribution** | Histogram of pending entry age | Heatmap | Alert if >1 pending entry >15min old |
| **Daily Submission Volume** | Cumulative submissions per day | Bar chart | Info only |
| **Queue Processor Cron Status** | Last execution timestamp + duration | Gauge | Alert if >1h since last run |
| **NOTIVISA API Errors** | Error count in past 24h | Counter | Alert if >3 |

**Manual Check (Firestore Console):**
```
Collection: notivisa-queue/{labId}/events
Filter: status == "pending" AND createdAt < now() - 15 minutes
Expected: 0 documents
```

---

### Dashboard 3: Firestore Access Patterns

**Title:** `HC Quality — Firestore Security + Access`  
**Refresh Rate:** 5 minutes  
**Audience:** Security Team + DBAs

**Metrics:**

| Widget | Metric | Display | Threshold |
|--------|--------|---------|-----------|
| **Patient Portal Reads** | Read count to `laudos` collection from portal sessions | Line chart | Info only |
| **RT Admin Reads** | Read count to `runs`, `results` collections | Line chart | Info only |
| **Rule Rejection Count** | Permission denied errors | Counter + trend | Alert if >10 per 5min |
| **Rule Rejection Reason** | Breakdown by path (chart) | Pie chart | Top 3 rejection patterns |
| **Access by Time of Day** | Heatmap (hour × day) | Heatmap | Identify peak hours for capacity |
| **Multi-Tenant Isolation Check** | Count of cross-labId reads (should be 0) | Gauge | Alert if >0 |
| **Signature Validation Failures** | Count of hash mismatch errors | Counter | Alert if >0 |
| **Firestore Ops Rate** | Read/write/delete per second | Stacked area | Info only |

---

### Dashboard 4: System Health Overview

**Title:** `HC Quality — Production System Health`  
**Refresh Rate:** 30 seconds  
**Audience:** CTO + Ops Manager

**Metrics:**

| Widget | Metric | Display | Threshold |
|--------|--------|---------|-----------|
| **Cloud Functions Error Rate** | % of invocations ending in error | Gauge | Green <0.1%, Yellow 0.1–0.5%, Red >0.5% |
| **Firestore Quota Usage** | % of daily quota consumed | Gauge | Green <50%, Yellow 50–80%, Red >80% |
| **Error Budget Remaining (30-day)** | % of 30-day error budget left | Gauge | Green >50%, Yellow 25–50%, Red <25% |
| **Hosting HTTP 5xx Rate** | % of requests returning 5xx | Gauge | Green 0%, Yellow <0.01%, Red >0.01% |
| **Function Timeout Count** | Timeouts in past 24h | Counter | Alert if >0 |
| **Firestore Document Size Violations** | Count of docs >100KB | Counter | Alert if >0 |
| **Memory OOM Events** | Out-of-memory errors in functions | Counter | Alert if >0 |
| **Uptime** | System availability % (30-day) | Gauge | Target: >99.9% |

**Health Scorecard (automated):**
- 🟢 GREEN: All metrics nominal
- 🟡 YELLOW: 1+ metric in warning zone
- 🔴 RED: 1+ metric in critical zone

---

## Section 4: Runbooks (5 Critical Playbooks)

**Ownership:** On-Call Engineer (primary) + Alert Manager (escalation)  
**Review Cycle:** Monthly (every Phase)  
**Last Updated:** 2026-05-07

---

### Runbook 1: Portal Auth Failures > 5/5min

**Severity:** P1 (critical customer impact)  
**Response Time:** <15 minutes  
**Escalation:** CTO if unresolved >30min

**Step 1: Immediate Triage (2 min)**

```bash
# Check Cloud Function logs for error pattern
gcloud logging read \
  'resource.type="cloud_function" AND severity>=ERROR AND \
   (textPayload=~"verifyPatientAuthToken|generatePatientAuthLink")' \
  --limit=20 --project=hmatologia2 --format=json
```

**Look for:**
- `PERMISSION_DENIED` on `/labs/{labId}/patients/{patientId}` → Rule violation
- `auth/invalid-email` → Invalid token payload
- `undefined is not a function` → Missing HMAC secret binding
- `SendGrid API error` → Email service down
- Function timeout (>60s) → Cold start or Firestore slow query

**Decision Tree:**
- **If PERMISSION_DENIED:** → Go to Step 2A (Firestore rules)
- **If SendGrid error:** → Go to Step 2B (Email service)
- **If HMAC/signature error:** → Go to Step 2C (Token validation)
- **If timeout:** → Go to Step 2D (Performance)

---

**Step 2A: Firestore Rules Check**

```bash
# Verify rules syntax
gcloud firestore indexes composite list --project=hmatologia2

# Check rule validation
cat firestore.rules | grep -A5 "match /labs/{labId}/patients"
```

**If rules syntax is broken:**
1. Compare `firestore.rules` against last known good version:
   ```bash
   git diff HEAD~1 firestore.rules
   ```
2. If diff shows recent change: `git revert <commit>` and redeploy rules
3. If no recent change: check if emergency rule patch was applied
4. Deploy fix:
   ```bash
   firebase deploy --only firestore:rules --project hmatologia2
   ```

**If rules syntax is correct but rejections persist:**
1. Check patient session token:
   ```bash
   # In browser console (patient portal)
   localStorage.getItem('auth_token')  # Copy and decode JWT
   ```
2. Verify `labId` in token matches accessed lab ID
3. If token stale: tell patient to logout + re-authenticate

---

**Step 2B: Email Service Check**

```bash
# Check SendGrid/RESEND status
curl -s https://status.sendgrid.com/api/v2/status.json | jq '.status.indicator'
# Expected: "none" = operational
```

**If email service is down:**
1. Notify patient support team (ETA for recovery)
2. Check if fallback SMS is configured (see `.env`)
3. If no fallback: escalate to CTO for temporary portal disable decision
4. Monitor service status dashboard

**If email service is operational:**
1. Check SendGrid account quota:
   ```bash
   gcloud secrets versions access latest --secret="SENDGRID_API_KEY" --project=hmatologia2
   # Use this key to check SendGrid dashboard → Settings → Sending Rate
   ```
2. If quota exceeded: upgrade plan or enable queuing retry logic
3. If quota OK: check email template render (see `.planning/runbooks/email-template-test.md`)

---

**Step 2C: Token Validation Check**

```bash
# Check HMAC secret is bound
grep -r "defineSecret.*HMAC\|HCQ_SIGNATURE" functions/src/

# Check function options
grep -r "secrets:" functions/src/modules/auth/
```

**If HMAC secret not bound:**
1. Add to function:
   ```typescript
   const hmacKey = defineSecret('HCQ_SIGNATURE_HMAC_KEY');
   
   export const verifyPatientAuthToken = onCall(
     { secrets: [hmacKey], region: 'southamerica-east1' },
     async (request) => { ... }
   );
   ```
2. Ensure secret is provisioned in Firebase:
   ```bash
   firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2
   ```
3. Deploy function:
   ```bash
   firebase deploy --only functions:verifyPatientAuthToken --project hmatologia2
   ```

**If secret is bound but validation fails:**
1. Check secret value matches signer:
   ```bash
   gcloud secrets versions access latest --secret="HCQ_SIGNATURE_HMAC_KEY" --project=hmatologia2
   ```
2. Compare against signer code (see `functions/src/modules/signatures/`)
3. If mismatch: rotate secret (see ADR-0017)

---

**Step 2D: Performance Check**

```bash
# Check function execution time
gcloud logging read \
  'resource.type="cloud_function" AND labels.functionName="verifyPatientAuthToken"' \
  --limit=10 --project=hmatologia2 --format=json | jq '.[] | {duration: .duration, severity: .severity}'
```

**If execution time > 5s:**
1. Profile function (Cloud Profiler or Cloud Trace):
   ```bash
   gcloud trace list --project=hmatologia2 --filter="name:verifyPatientAuthToken" --limit=5
   ```
2. Identify bottleneck:
   - **Firestore query slow?** → Check index coverage, create missing indexes
   - **HMAC computation slow?** → Optimize or cache
   - **Cold start?** → Expected; monitor warm execution only
3. Deploy fix or adjust memory/timeout

---

**Step 3: Recovery Validation (5 min)**

```bash
# Monitor error rate in real-time
watch -n 5 'gcloud logging read \
  "resource.type=cloud_function AND severity>=ERROR AND \
   (textPayload=~verifyPatientAuthToken|generatePatientAuthLink)" \
  --limit=50 --project=hmatologia2 | wc -l'
```

**Success Criteria:**
- Error count < 1 per 5 minutes (below alert threshold)
- At least 10 consecutive successful authentications
- No new errors in past 10 minutes

**If still failing after 30 min:** Page CTO. Consider rollback to v1.3 portal-disabled config.

---

**Step 4: Post-Incident (after resolution)**

1. Create incident ticket in project tracker
2. Document root cause + fix applied
3. Schedule post-mortem within 24h (see incident-response contacts)
4. Update this runbook if new steps discovered

---

### Runbook 2: NOTIVISA Queue Stuck

**Severity:** P1 (adverse events not reported to gov)  
**Response Time:** <15 minutes  
**Escalation:** CTO if unresolved >30min

**Step 1: Immediate Triage (2 min)**

```bash
# Check queue status
gcloud logging read \
  'resource.type="firestore" AND \
   (textPayload=~"notivisa.*queue" OR textPayload=~"notivisaQueueProcessor")' \
  --limit=20 --project=hmatologia2
```

**Look for:**
- Queue entries with status == "pending" for >15 minutes
- Processor cron last execution timestamp (should be <5min ago)
- SOAP API connection errors
- Queue entry too large (payload size limit)

---

**Step 2: Check Processor Cron Status**

```bash
# Check last successful execution
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="notivisaQueueProcessor"' \
  --limit=10 --project=hmatologia2 --format=json | \
  jq '.[] | {timestamp: .timestamp, severity: .severity, message: .textPayload}'
```

**If cron has not run in >15 minutes:**

1. **Manual trigger:**
   ```bash
   gcloud functions call notivisaQueueProcessor \
     --project=hmatologia2 --region=southamerica-east1 \
     --data='{"labId":"*"}' # Process all labs
   ```

2. **Monitor execution:**
   ```bash
   # Wait 30s then check logs
   gcloud logging read \
     'resource.type="cloud_function" AND \
      labels.functionName="notivisaQueueProcessor" AND \
      timestamp>="'$(date -u -d '30 seconds ago' '+%Y-%m-%dT%H:%M:%S')'"' \
     --project=hmatologia2
   ```

3. **Check for errors:**
   - SOAP API timeout: gov API unavailable
   - Mock API error: Phase 4 sandbox not responding
   - Invalid message format: payload validation error

---

**Step 3: Check Government API Availability**

```bash
# Test SOAP API connectivity (Phase 4 sandbox)
curl -s -X POST \
  https://notivisa-sandbox.anvisa.gov.br/soap/api/v1 \
  -H "Content-Type: application/soap+xml" \
  -d '<soap:Envelope ...>' \
  -w "HTTP Status: %{http_code}\n"

# Expected: 200 OK or 500 SOAP Fault (API is reachable)
# If timeout or connection refused: gov API down
```

**If gov API is down:**
1. Check ANVISA status page: https://www.anvisa.gov.br/
2. Notify CTO + Compliance Officer (adverse events cannot be submitted)
3. Keep queue entries in `pending` state (will retry automatically on schedule)
4. Monitor and update status every 30 minutes

**If gov API is reachable but returns errors:**
1. Check SOAP request format matches WSDL (see Phase 12 spec)
2. Verify authentication credentials (client certificate + API key)
3. Test with sample payload from Phase 4 documentation
4. Contact ANVISA support if format correct but still failing

---

**Step 4: Check Queue Entry Content**

```bash
# Find oldest pending entry
gcloud firestore export gs://hmatologia2_backups/queue-export-$(date +%s) \
  --collection-ids=notivisa-queue

# Or manually via Firestore Console:
# Collections > notivisa-queue > {labId} > events > filter by status="pending"
```

**If entry is corrupted or oversized:**
1. Soft-delete it:
   ```bash
   gcloud firestore update-document \
     notivisa-queue/{labId}/events/{eventId} \
     deletadoEm=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
   ```
2. Create support ticket for lab to resubmit
3. Log incident for post-mortem analysis

**If entry format is valid:**
1. Check against WSDL schema (see docs/Phase4_NOTIVISA_SCHEMA.md)
2. If schema mismatch: update queue processor logic + redeploy
3. If schema OK: re-trigger processor with verbose logging

---

**Step 5: Recovery Validation (5 min)**

```bash
# Monitor queue processing
watch -n 10 'gcloud logging read \
  "resource.type=firestore AND textPayload=~notivisaQueue" \
  --limit=20 --project=hmatologia2 | grep -E "submitted|processed"'
```

**Success Criteria:**
- All pending entries processed within 10 minutes
- No new entries stuck in pending
- Processor cron executed successfully

**If still stuck after 30 min:** Page CTO. Consider soft-deleting oldest entry + escalating to ANVISA support.

---

**Step 6: Post-Incident**

1. Analyze gov API response time (adjust retry backoff if needed)
2. Update queue processor error handling (more granular error types)
3. Schedule ANVISA integration check (monthly)

---

### Runbook 3: Firestore Rules Rejections Spike

**Severity:** P2 (some users cannot access data)  
**Response Time:** <1 hour  
**Escalation:** Security team if rule compromise suspected

**Step 1: Identify Rejection Pattern (5 min)**

```bash
# Get rejection details
gcloud logging read \
  'resource.type="firestore" AND textPayload=~".*Permission.*denied.*"' \
  --limit=50 --project=hmatologia2 --format=json | \
  jq '.[] | {timestamp: .timestamp, path: .labels.documentPath, uid: .labels.uid, operation: .labels.operation}'
```

**Categorize rejections:**
- **Path pattern 1:** Portal patient reading wrong lab → misconfigured session token
- **Path pattern 2:** RT reading patient data → rule syntax bug
- **Path pattern 3:** Admin accessing superadmin collection → role check failed
- **Path pattern 4:** Any user reading `/audit-log/*` → immutable rule violation

**Example:**
```
Rejections all from paths: /labs/lab-abc/patients/...
Rejected by: user-xyz (known to be patient)
Operation: read
=> Patient trying to access correct lab but session token corrupted
```

---

**Step 2: Determine Root Cause**

**If rejections are from valid paths + valid users:**

1. **Check Firestore Rules syntax:**
   ```bash
   npx tsc firestore.rules 2>&1 | head -20
   ```

2. **Check for recent changes:**
   ```bash
   git log --oneline -10 firestore.rules
   ```

3. **If recent change:** Compare against previous version:
   ```bash
   git show HEAD~1:firestore.rules | grep -A10 "isActiveMemberOfLab"
   ```

4. **If syntax error found:**
   - Fix in local editor
   - Test in emulator:
     ```bash
     firebase emulators:start --only firestore
     # Run security rules tests
     npm run test:rules
     ```
   - Deploy corrected rules:
     ```bash
     firebase deploy --only firestore:rules --project hmatologia2
     ```

**If rejections are from invalid users/paths:**

1. **Check if patient is accessing correct lab:**
   - Query patient session:
     ```bash
     gcloud firestore documents get \
       labs/{labId}/patients/{patientId} \
       --project=hmatologia2
     ```
   - Verify `labId` in session token matches accessed lab
   - If mismatch: patient logged into wrong lab account → support issue, not rule bug

2. **Check if RT is attempting admin-only operation:**
   - Verify user role (should not be "admin" for RT access rejection)
   - If role is "admin" but rules reject: rules bug → fix and redeploy

3. **Check for stale permission cache:**
   - Clear browser cache + hard reload
   - Clear Firestore token cache:
     ```bash
     # Client-side: auth.signOut() then re-authenticate
     ```

---

**Step 3: Recovery Validation (5 min)**

```bash
# Monitor rejection rate
watch -n 10 'gcloud logging read \
  "resource.type=firestore AND textPayload=~Permission.denied" \
  --limit=20 --project=hmatologia2 | wc -l'
```

**Success Criteria:**
- Rejection count drops to <2 per 5 minutes (background noise)
- Valid users can access data again
- No new rejections for same path/user pair

---

**Step 4: Detailed Investigation (if persists)**

1. **Check multi-tenant isolation:**
   ```bash
   # Query for cross-labId reads (should be impossible)
   gcloud logging read \
     'resource.type="firestore" AND \
      jsonPayload.request.path=~"/labs/[^/]+/.*" AND \
      jsonPayload.auth.uid NOT IN request.path' \
     --limit=20 --project=hmatologia2
   ```

2. **Check signature validation:**
   ```bash
   gcloud logging read \
     'textPayload=~".*hash.*mismatch|.*signature.*invalid"' \
     --limit=20 --project=hmatologia2
   ```

3. **If security violation suspected:** Page CTO immediately + notify security team.

---

### Runbook 4: Email Delivery Failure > 20%

**Severity:** P2 (patients cannot receive auth links)  
**Response Time:** <1 hour  
**Escalation:** CTO + Support Manager

**Step 1: Verify Failure Rate (3 min)**

```bash
# Count successes vs. failures
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="generatePatientAuthLink"' \
  --limit=100 --project=hmatologia2 --format=json | \
  jq 'group_by(.severity) | map({severity: .[0].severity, count: length})'
```

**Expected output:**
```
[
  { "severity": "ERROR", "count": 2 },   # Failures
  { "severity": "INFO", "count": 98 }    # Successes
]
# Failure rate: 2/100 = 2% ✓ OK
```

**If failure rate >20%:**

```bash
# Get sample error messages
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="generatePatientAuthLink" AND severity=ERROR' \
  --limit=10 --project=hmatologia2 --format=json | \
  jq '.[] | {message: .textPayload, timestamp: .timestamp}'
```

---

**Step 2: Check SendGrid/RESEND Status**

```bash
# Check SendGrid API health
curl -I https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $(gcloud secrets versions access latest --secret=SENDGRID_API_KEY --project=hmatologia2)"

# Check RESEND status
curl -s https://status.resend.com/api/v2/status.json | jq '.status.indicator'
```

**If service status is degraded:**
1. Check vendor status page for ETA
2. Enable email retry logic (exponential backoff)
3. Notify patient support team

**If service status is operational:**

---

**Step 3: Check SendGrid Quota**

```bash
# Access SendGrid dashboard (manual)
# Go to: https://app.sendgrid.com/settings/account → Billing

# Or via API:
curl -s https://api.sendgrid.com/v3/user/credits \
  -H "Authorization: Bearer $SENDGRID_API_KEY" | jq '.remaining'
```

**If quota exceeded:**
1. Upgrade plan in SendGrid dashboard
2. Or use fallback email provider (check `.env` for `EMAIL_FALLBACK_PROVIDER`)
3. Monitor quota recovery

**If quota OK:**

---

**Step 4: Check Bounce Rate**

```bash
# Access SendGrid dashboard (manual)
# Go to: https://app.sendgrid.com/analytics → Bounces

# Sample: if 10% of emails bouncing = invalid patient emails in database
```

**If bounce rate >5%:**
1. Audit patient email addresses:
   ```bash
   gcloud firestore documents list \
     --collection-ids=labs/{labId}/patients \
     --project=hmatologia2 | \
     jq '.[] | select(.email | test("@")) | .email'
   ```
2. Find emails with common typos (e.g., `cmm.com` vs. `com.com`)
3. Contact support team to correct database
4. Retry delivery to corrected addresses

**If bounce rate OK:**

---

**Step 5: Check Email Template**

```bash
# Test template render
# 1. Get sample patient data:
gcloud firestore documents get \
  labs/{labId}/patients/sample-patient-id \
  --project=hmatologia2 | jq '.data'

# 2. Render template locally:
npm run test:email-template -- \
  --patient="$(jq '.')" \
  --template="generatePatientAuthLink"

# 3. Verify output contains:
#    - Valid HTML structure
#    - Correct auth link URL
#    - Patient name populated
#    - Lab name populated
```

**If template render fails:**
1. Check template syntax in `functions/src/modules/notifications/templates/`
2. Fix syntax error
3. Deploy function
4. Retry email delivery

---

**Step 6: Recovery Validation (5 min)**

```bash
# Monitor success rate
watch -n 10 'gcloud logging read \
  "resource.type=cloud_function AND functionName=generatePatientAuthLink" \
  --limit=50 --project=hmatologia2 | grep -E "ERROR|INFO" | wc -l'
```

**Success Criteria:**
- Success rate returns to >95%
- At least 20 consecutive successful deliveries
- No new errors for 30 minutes

---

**Step 7: Post-Incident**

1. If vendor issue: document in incident ticket + adjust SLA
2. If database issue: audit all patient emails + create remediation task
3. If template issue: add unit test to prevent regression

---

### Runbook 5: Function Latency > 2s (p95)

**Severity:** P3 (poor UX, not critical)  
**Response Time:** <4 hours  
**Escalation:** None (monitor only)

**Step 1: Identify Slow Function (5 min)**

```bash
# Find p95 latency per function
gcloud logging read \
  'resource.type="cloud_function"' \
  --limit=100 --project=hmatologia2 --format=json | \
  jq 'group_by(.labels.functionName) | map({
    name: .[0].labels.functionName,
    p95_latency: (map(.duration) | sort | .[0.95 * length] | round)
  })'
```

**Example output:**
```json
[
  { "name": "verifyPatientAuthToken", "p95_latency": 950 },    # OK (<2s)
  { "name": "getPatientLaudos", "p95_latency": 2100 },         # SLOW (>2s)
  { "name": "notivisaQueueProcessor", "p95_latency": 5500 }    # VERY SLOW
]
```

---

**Step 2: Profile Function Execution**

**Option A: Cloud Trace (best)**

```bash
# Get samples from trace
gcloud trace list \
  --filter="name:getPatientLaudos" \
  --limit=5 \
  --project=hmatologia2

# Analyze slowest trace
gcloud trace describe <trace-id> \
  --project=hmatologia2 | jq '.spans[] | {name, startTime, duration}'
```

**Option B: Cloud Profiler (if enabled)**

```bash
gcloud profiler profile create \
  --function=getPatientLaudos \
  --project=hmatologia2 --duration=60s
```

**Option C: Manual logging (quick)**

Add timing logs to function:
```typescript
const start = Date.now();

console.log(`[PERF] Firestore query started at ${start}`);
const results = await getPatientLaudos(patientId);
const fsTime = Date.now() - start;

console.log(`[PERF] Firestore query took ${fsTime}ms`);
console.log(`[PERF] Function total duration: ${Date.now() - start}ms`);
```

---

**Step 3: Identify Bottleneck**

**Bottleneck Type: Firestore Query Slow**

```bash
# Check Firestore query statistics
gcloud firestore indexes composite list --project=hmatologia2 | \
  grep -E "laudos|runs|results"
```

**If index is missing:**
1. Create composite index in Firebase Console → Cloud Firestore → Indexes
2. Or via CLI:
   ```bash
   firebase firestore:indexes create --path=firestore.indexes.json --project=hmatologia2
   ```
3. Wait for index build (usually <5 min)
4. Redeploy function to use new index

**If index exists but query still slow:**
1. Check Firestore quota usage:
   ```bash
   gcloud monitoring read \
     --filter='metric.type="firestore.googleapis.com/document_reads"' \
     --project=hmatologia2
   ```
2. If approaching quota: scale up via Firebase Console → Quotas
3. If quota OK: optimize query logic (fewer documents, more specific filter)

---

**Bottleneck Type: Function CPU Slow**

```bash
# Check function memory/CPU allocation
gcloud functions describe verifyPatientAuthToken \
  --region=southamerica-east1 \
  --project=hmatologia2 | grep -E "availableMemory|timeout"
```

**If memory is low:**
1. Increase memory allocation:
   ```bash
   gcloud functions deploy verifyPatientAuthToken \
     --memory=512MB \
     --region=southamerica-east1 \
     --project=hmatologia2
   ```
2. Monitor latency improvement

**If memory is high but latency still slow:**
1. Optimize code (profile with Chrome DevTools or Node profiler)
2. Look for:
   - Inefficient loops or regex operations
   - JSON stringification/parsing on large objects
   - Synchronous operations blocking async

---

**Bottleneck Type: Cold Start Latency**

```bash
# Check if latency is due to cold start
gcloud logging read \
  'labels.functionName="verifyPatientAuthToken" AND \
   jsonPayload.executionTime > 5000' \
  --limit=5 --project=hmatologia2 | \
  jq '.[] | {initialization_duration: .labels.initializationTime, execution_duration: .labels.executionTime}'
```

**If initialization time is >2s:**
- This is normal for first invocation after deploy
- Monitor warm execution (2nd+ invocations) instead
- Set alerting threshold to exclude cold starts

**If initialization time is high for every invocation:**
1. Check function size (gzipped bundle size)
2. Reduce dependencies (tree-shake unused modules)
3. Use dynamic imports for heavy libraries:
   ```typescript
   const xlsx = await import('xlsx');  // Load only when needed
   ```

---

**Step 4: Deploy Fix**

Once bottleneck identified:

1. **Make code change (if applicable)**
2. **Test locally:**
   ```bash
   firebase emulators:start --only functions
   npm run test:performance
   ```
3. **Deploy:**
   ```bash
   firebase deploy --only functions:verifyPatientAuthToken --project=hmatologia2
   ```
4. **Monitor new latency:**
   ```bash
   watch -n 10 'gcloud logging read \
     "labels.functionName=verifyPatientAuthToken" \
     --limit=20 --project=hmatologia2 | \
     jq "map(.duration) | add / length | round"'
   ```

---

**Step 5: Recovery Validation (10 min)**

**Success Criteria:**
- p95 latency < 1.5s for 30 consecutive minutes
- p99 latency < 3s
- No cold-start bias in measurements

---

**Step 6: Post-Incident**

1. Document optimization applied (for team reference)
2. Add performance test to CI/CD to prevent regression
3. Update function memory/timeout allocation in `firebase.json` if changed

---

## Section 5: On-Call Responsibilities (Phase 4)

**Activation Date:** 2026-05-20  
**Rotation Cycle:** 4 weeks (Sunday → Sunday)  
**Backup Cycle:** Overlapping (36h crossover for handoff)

---

### PRIMARY ON-CALL (24/7, Slack rotation)

**Responsibilities:**
1. Monitor `#production-alerts` Slack channel in real-time
2. Respond to P1/P2 alerts within SLA (<15min for P1, <1h for P2)
3. Execute runbooks from Section 4
4. Document incident details in ticket
5. Escalate to secondary on-call if issue unresolved >30min

**Access Requirements:**
- GCP project permissions: `hmatologia2` viewer + functions/firestore access
- Firebase CLI authenticated: `firebase login`
- Slack notification settings: @-mention enabled
- Phone on-call pager: SMS + voice alerts enabled

**Weekly Handoff:**
- Sunday 9am UTC: Sync between departing + incoming on-call
- Review incidents from past week
- Update alert thresholds if needed
- Test runbook procedures

---

### SECONDARY ON-CALL (escalation)

**Responsibilities:**
1. Available for escalation if primary unresolved >30min
2. Fresh perspective on troubleshooting
3. May assume primary if primary unavailable (illness, outage)
4. Participate in post-mortems

**Access Requirements:** Same as primary

---

### CTO ON-CALL (critical decisions + rollback authority)

**Responsibilities:**
1. Page for P0/P1 incidents unresolved >30min
2. Make rollback decisions
3. Authorize emergency secret rotation
4. Public communication (status page updates)

**Response Time:** <15min for P0/P1

---

### Error Budget Policy

**30-Day Error Budget:** 99.9% uptime = 43.2 minutes of acceptable downtime

| Incident Duration | Impact on Budget |
|---|---|
| <5 min | No impact (within margin) |
| 5–15 min | 5–15 min consumed |
| 15–60 min | Full incident duration consumed |
| >60 min | Critical incident; post-mortem required |

**Budget Status:** Check monthly in Dashboard 4 (System Health).

---

## Deployment Checklist (Pre-Launch)

**All items must be completed before 2026-05-20.**

- [ ] **Section 1:** All 10 log sinks created in GCP Cloud Logging
- [ ] **Section 2:** All 5 alert policies created + tested in staging
- [ ] **Section 3:** All 4 dashboards created + JSON exported to `.planning/dashboards/`
- [ ] **Section 4:** All 5 runbooks reviewed by Alert Manager
- [ ] **Section 5:** On-call rotation populated + contact details filled in `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`
- [ ] **Access:** On-call engineers have GCP IAM permissions granted
- [ ] **Smoke Test:** Trigger alert manually (create dummy error log) → verify Slack notification
- [ ] **Escalation Path:** CTO contact details verified + SMS pager tested
- [ ] **Team Training:** On-call briefing completed (runbook walkthrough)

---

## Maintenance & Review Schedule

**Monthly Review (every Phase):**
- Update alert thresholds based on new baseline metrics
- Review 30-day error budget consumption
- Add new sinks/runbooks if Phase introduces new critical paths
- Archive logs >retention period to BigQuery (cost optimization)

**Quarterly Audit (every 3 months):**
- Run full runbook procedures in staging (end-to-end test)
- Review on-call rotation effectiveness
- Update incident response contacts
- Compliance check (RDC 978 Art. 167–182 audit trail requirements)

---

## Related Documents

- `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` — On-call rotation + escalation tree
- `.planning/runbooks/phase-4-*.md` — Detailed runbooks (auto-generated from Section 4)
- `.planning/dashboards/*.json` — Dashboard JSON exports
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — v1.3 baseline (reference)
- `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` — Secret management context

---

**Document Status:** ✅ COMPLETE  
**Approval:** Awaiting CTO sign-off before deployment  
**Next Step:** Create alert policies in GCP Console + runbook tickets
