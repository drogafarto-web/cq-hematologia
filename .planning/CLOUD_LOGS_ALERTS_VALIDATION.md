# Cloud Logs Alert Policies Validation — Phase 4

**Effective Date:** 2026-05-20  
**Project ID:** `hmatologia2`  
**Region:** `southamerica-east1`  
**Status:** Ready for gcloud CLI execution  
**Last Updated:** 2026-05-07

---

## Overview

This document provides **ready-to-execute gcloud commands** to create, test, and validate all 5 critical alert policies for Phase 4 launch. Each alert policy includes:

1. **Creation command** (gcloud CLI)
2. **Manual verification** (Firestore Console check)
3. **Test procedure** (trigger alert, verify notification)
4. **Success criteria** (verification checklist)

**Prerequisites:**

- `gcloud` CLI installed and authenticated
- Project ID set: `gcloud config set project hmatologia2`
- Slack webhook configured in GCP Notification Channels
- SMS/on-call pager configured (if applicable)

---

## Alert 1: Portal Auth Failures (P1)

**Condition:** >5 auth errors per 5 minutes  
**Threshold:** execution_count > 5 in 300s window  
**Severity:** P1 (critical)  
**Notification:** Slack + SMS page

### 1.1 Create Alert Policy

```bash
# Step 1: Create the alert policy
gcloud alpha monitoring policies create \
  --notification-channels=$(gcloud alpha monitoring channels list \
    --filter="displayName=Slack" --format="value(name)" | head -1) \
  --display-name="portal-auth-failures-spike" \
  --condition-display-name="Portal Auth Failures > 5/5min" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-threshold-filter='
    resource.type = "cloud_function"
    AND metric.type = "cloudfunctions.googleapis.com/execution_count"
    AND resource.label.function_name = "verifyPatientAuthToken"
  ' \
  --documentation-content="Auth token verification failing. Check email service + Firestore rules." \
  --documentation-mime-type="text/markdown" \
  --project=hmatologia2
```

**Alternative (if alpha command unavailable):**

```bash
# Using gcloud monitoring
gcloud monitoring policies create \
  --display-name="portal-auth-failures-spike" \
  --project=hmatologia2 << 'EOF'
{
  "displayName": "portal-auth-failures-spike",
  "conditions": [
    {
      "displayName": "Portal Auth Failures > 5/5min",
      "conditionThreshold": {
        "filter": "resource.type = \"cloud_function\" AND metric.type = \"cloudfunctions.googleapis.com/execution_count\" AND resource.label.function_name = \"verifyPatientAuthToken\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.05,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_RATE"
          }
        ]
      }
    }
  ],
  "notificationChannels": [
    "projects/hmatologia2/notificationChannels/<SLACK_CHANNEL_ID>"
  ],
  "documentation": {
    "content": "Auth token verification failing. Check email service, Firestore rules, HMAC secret binding.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 1.2 Manual Verification (Firestore Console)

```bash
# Verify Cloud Function exists
gcloud functions describe verifyPatientAuthToken \
  --region=southamerica-east1 \
  --project=hmatologia2

# Check recent invocations
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="verifyPatientAuthToken"' \
  --limit=10 \
  --format=json \
  --project=hmatologia2 | jq '.[] | {timestamp, severity, duration}'
```

### 1.3 Test Procedure: Trigger Alert Manually

```bash
# Step 1: Generate dummy auth errors in logs
# (Simulate failed token verification)

# Option A: Call function with invalid token
curl -X POST \
  https://southamerica-east1-hmatologia2.cloudfunctions.net/verifyPatientAuthToken \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "token": "invalid_jwt_token_12345"
    }
  }' \
  2>&1 | grep -E "error|Error|ERROR" || echo "Function returned error (expected)"

# Option B: Write test error log directly
# (Requires Cloud Logging API access)
gcloud logging write verifyPatientAuthToken-test \
  "TEST: Simulating auth failure for alert validation" \
  --severity=ERROR \
  --resource=cloud_function \
  --labels=functionName=verifyPatientAuthToken \
  --project=hmatologia2

# Repeat 5+ times to exceed threshold
for i in {1..6}; do
  gcloud logging write verifyPatientAuthToken-test \
    "TEST ERROR #$i: Token verification failed" \
    --severity=ERROR \
    --resource=cloud_function \
    --labels=functionName=verifyPatientAuthToken \
    --project=hmatologia2
  sleep 1
done

# Step 2: Wait for alert to fire (up to 5 min)
echo "Alert should fire within 5 minutes..."
sleep 300

# Step 3: Check Slack #production-alerts for notification
echo "✓ Check Slack for: '🚨 AUTH CRITICAL: Portal token verification failing'"
```

### 1.4 Success Verification Checklist

```bash
# ✓ Checklist:

# 1. Alert policy created in GCP
gcloud alpha monitoring policies list \
  --filter="displayName=portal-auth-failures-spike" \
  --format="table(name, displayName, enabled)" \
  --project=hmatologia2

# Expected output:
# NAME                                           DISPLAY_NAME                      ENABLED
# projects/hmatologia2/alertPolicies/xxxxx       portal-auth-failures-spike        True

# 2. Notification channel configured
gcloud alpha monitoring channels list \
  --filter="displayName=Slack" \
  --format="table(name, type, displayName, enabled)" \
  --project=hmatologia2

# Expected: Slack channel enabled

# 3. Manual log entries written
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="verifyPatientAuthToken" AND \
   textPayload=~"TEST ERROR"' \
  --limit=10 \
  --project=hmatologia2

# Expected: 6+ test error entries visible

# 4. Slack notification received
# MANUAL CHECK: Look in #production-alerts Slack channel
# Expected: Message "🚨 AUTH CRITICAL: Portal token verification failing"

echo "✓ Alert 1 validation complete"
```

---

## Alert 2: NOTIVISA Queue Stuck (P1)

**Condition:** >10 pending entries older than 15 minutes  
**Query Check:** `status == "pending" AND createdAt < now() - 15min`  
**Severity:** P1 (critical)  
**Notification:** Slack + SMS page

### 2.1 Create Alert Policy

```bash
# Note: Firestore query-based alerts have limited gcloud support
# Create via GCP Console or use Cloud Monitoring API directly

# For now, create as custom metric alert:
gcloud monitoring policies create \
  --display-name="notivisa-queue-stuck" \
  --project=hmatologia2 << 'EOF'
{
  "displayName": "notivisa-queue-stuck",
  "conditions": [
    {
      "displayName": "NOTIVISA Queue Stuck >15min",
      "conditionThreshold": {
        "filter": "resource.type = \"firestore\" AND resource.label.database_id = \"(default)\" AND metric.type = \"firestore.googleapis.com/document_deletes\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 10,
        "duration": "900s",
        "aggregations": [
          {
            "alignmentPeriod": "900s",
            "perSeriesAligner": "ALIGN_COUNT"
          }
        ]
      }
    }
  ],
  "notificationChannels": [
    "projects/hmatologia2/notificationChannels/<SLACK_CHANNEL_ID>"
  ],
  "documentation": {
    "content": "Adverse event queue not processing. Check NOTIVISA cron status + gov API availability.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 2.2 Manual Verification (Firestore Console)

```bash
# Check Firestore collections exist
gcloud firestore collections list \
  --project=hmatologia2 | grep notivisa

# Expected: notivisa-drafts, notivisa-queue, notivisa-outbox

# Query for stuck entries (manual check)
# Via Firestore Console:
# 1. Go to Cloud Firestore → Collections
# 2. Select: notivisa-queue > {labId} > events
# 3. Filter: status == "pending" AND createdAt < (15 min ago)
# Expected: 0 documents in normal operation

gcloud logging read \
  'resource.type="firestore" AND \
   textPayload=~"notivisa.*queue.*pending"' \
  --limit=10 \
  --project=hmatologia2
```

### 2.3 Test Procedure: Trigger Queue Stuck Alert

```bash
# Step 1: Create test NOTIVISA draft entry
cat > /tmp/test-notivisa.json << 'EOF'
{
  "laudoId": "test-laudo-999",
  "status": "pending",
  "payload": {
    "event_type": "TEST_ADVERSE_EVENT",
    "severity": "INFO",
    "description": "Test event for alert validation"
  },
  "createdAt": "$(date -u -d '20 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')",
  "labId": "test-lab-001"
}
EOF

# Step 2: Write to Firestore (requires elevated permissions)
# Option A: Via CLI (if emulator running)
firebase emulators:start --only firestore &
sleep 3
gcloud firestore documents create \
  notivisa-queue/test-lab-001/events/test-event-001 \
  --data='{"status":"pending","createdAt":"2026-04-22T10:00:00Z","labId":"test-lab-001"}' \
  --project=hmatologia2

# Option B: Via Cloud Function (create test function)
gcloud functions deploy test-notivisa-queue-alert \
  --runtime=nodejs18 \
  --trigger-http \
  --project=hmatologia2 << 'EOF'
const admin = require('firebase-admin');
admin.initializeApp();

exports.testNotivisaQueueAlert = async (req, res) => {
  const db = admin.firestore();
  const oldDate = new Date(Date.now() - 20 * 60000); // 20 min ago

  await db.collection('notivisa-queue').doc('test-lab-001')
    .collection('events').doc('test-alert-' + Date.now()).set({
      status: 'pending',
      createdAt: oldDate,
      labId: 'test-lab-001',
      payload: { event_type: 'TEST' }
    });

  res.json({ success: true });
};
EOF

curl https://southamerica-east1-hmatologia2.cloudfunctions.net/test-notivisa-queue-alert

# Step 3: Wait for alert (up to 15 minutes)
echo "Waiting for alert to trigger (15 min check)..."
sleep 900

# Step 4: Verify
gcloud logging read \
  'resource.type="firestore" AND \
   textPayload=~"notivisa.*queue.*stuck"' \
  --limit=5 \
  --project=hmatologia2
```

### 2.4 Success Verification Checklist

```bash
# ✓ Checklist:

# 1. Alert policy created
gcloud alpha monitoring policies list \
  --filter="displayName=notivisa-queue-stuck" \
  --format="value(name)" \
  --project=hmatologia2

# 2. Check queue collections exist
gcloud firestore documents list \
  --collection-ids="notivisa-queue" \
  --project=hmatologia2 | head -5

# 3. Verify cron function exists
gcloud functions describe notivisaQueueProcessor \
  --region=southamerica-east1 \
  --project=hmatologia2

# 4. Slack notification received
echo "MANUAL: Check #production-alerts for 'NOTIVISA QUEUE STUCK' message"

echo "✓ Alert 2 validation complete"
```

---

## Alert 3: Firestore Rule Rejections (P2)

**Condition:** >10 permission denied errors per 5 minutes  
**Severity:** P2 (medium)  
**Notification:** Slack + Security team email

### 3.1 Create Alert Policy

```bash
gcloud monitoring policies create \
  --display-name="firestore-rule-rejections-spike" \
  --project=hmatologia2 << 'EOF'
{
  "displayName": "firestore-rule-rejections-spike",
  "conditions": [
    {
      "displayName": "Firestore Rule Rejections >10/5min",
      "conditionThreshold": {
        "filter": "resource.type = \"firestore\" AND textPayload =~ \".*Permission.*denied.*\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 10,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_DELTA"
          }
        ]
      }
    }
  ],
  "notificationChannels": [
    "projects/hmatologia2/notificationChannels/<SLACK_CHANNEL_ID>"
  ],
  "documentation": {
    "content": "High rate of Firestore rule rejections. Audit session tokens, rule syntax, and multi-tenant isolation.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 3.2 Manual Verification

```bash
# Check recent rule rejections in logs
gcloud logging read \
  'resource.type="firestore" AND \
   severity>=ERROR AND \
   textPayload=~".*Permission.*denied.*"' \
  --limit=20 \
  --format=json \
  --project=hmatologia2 | jq '.[] | {timestamp, severity, path: .labels.documentPath}'
```

### 3.3 Test Procedure: Trigger Rule Rejection Alert

```bash
# Step 1: Simulate permission denied errors
# Option A: Call Firestore with unauthorized user
# (Requires test user setup)

# Option B: Write test rejection logs
for i in {1..12}; do
  gcloud logging write firestore-rule-rejection-test \
    "Permission denied: User $i cannot read /labs/lab-xyz/patients/patient-123" \
    --severity=ERROR \
    --resource=firestore \
    --labels="documentPath=/labs/lab-xyz/patients/patient-123,operation=Read" \
    --project=hmatologia2
  sleep 2
done

# Step 2: Wait for alert (5 minutes)
sleep 300

# Step 3: Verify logs
gcloud logging read \
  'textPayload=~"firestore-rule-rejection-test"' \
  --limit=15 \
  --project=hmatologia2 | wc -l
# Expected: 12+ entries
```

### 3.4 Success Verification Checklist

```bash
# ✓ Checklist:

# 1. Alert exists
gcloud alpha monitoring policies list \
  --filter="displayName=firestore-rule-rejections-spike" \
  --project=hmatologia2

# 2. Test logs written
gcloud logging read \
  'textPayload=~"firestore-rule-rejection-test"' \
  --limit=15 \
  --project=hmatologia2 | wc -l
# Expected: 12

# 3. Slack notification received
echo "MANUAL: Check #production-alerts for rejection spike message"

echo "✓ Alert 3 validation complete"
```

---

## Alert 4: Email Delivery Failure Rate (P2)

**Condition:** >20% failure rate over 1 hour window  
**Severity:** P2 (medium)  
**Notification:** Slack + CTO email

### 4.1 Create Alert Policy

```bash
gcloud monitoring policies create \
  --display-name="email-delivery-failure-rate" \
  --project=hmatologia2 << 'EOF'
{
  "displayName": "email-delivery-failure-rate",
  "conditions": [
    {
      "displayName": "Email Delivery Failure >20%/1hr",
      "conditionThreshold": {
        "filter": "resource.type = \"cloud_function\" AND labels.functionName = \"generatePatientAuthLink\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.20,
        "duration": "3600s",
        "aggregations": [
          {
            "alignmentPeriod": "3600s",
            "perSeriesAligner": "ALIGN_FRACTION_TRUE",
            "crossSeriesReducer": "REDUCE_COUNT_FALSE"
          }
        ]
      }
    }
  ],
  "notificationChannels": [
    "projects/hmatologia2/notificationChannels/<SLACK_CHANNEL_ID>"
  ],
  "documentation": {
    "content": "Email delivery failing at high rate. Check SendGrid/RESEND quota, bounce rate, template errors.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 4.2 Manual Verification

```bash
# Check email function logs
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="generatePatientAuthLink"' \
  --limit=50 \
  --format=json \
  --project=hmatologia2 | jq 'group_by(.severity) | map({severity: .[0].severity, count: length})'

# Expected output:
# [
#   { "severity": "ERROR", "count": <failures> },
#   { "severity": "INFO", "count": <successes> }
# ]
```

### 4.3 Test Procedure: Trigger Email Failure Alert

```bash
# Step 1: Write success and failure logs to simulate >20% failure rate
# Generate 80 successes + 25 failures = 23.8% failure rate

# Success logs
for i in {1..80}; do
  gcloud logging write generatePatientAuthLink \
    "Email sent successfully to patient-$i@example.com" \
    --severity=INFO \
    --resource=cloud_function \
    --labels=functionName=generatePatientAuthLink \
    --project=hmatologia2
  (( i % 10 == 0 )) && sleep 1
done

# Failure logs (to push rate above 20%)
for i in {1..25}; do
  gcloud logging write generatePatientAuthLink \
    "Failed to send email: SendGrid API timeout" \
    --severity=ERROR \
    --resource=cloud_function \
    --labels=functionName=generatePatientAuthLink \
    --project=hmatologia2
  sleep 1
done

# Step 2: Wait for alert window (up to 1 hour or threshold interval)
sleep 180

# Step 3: Query logs
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="generatePatientAuthLink"' \
  --limit=150 \
  --project=hmatologia2 | grep -c "ERROR"
# Expected: 25
```

### 4.4 Success Verification Checklist

```bash
# ✓ Checklist:

# 1. Alert policy created
gcloud alpha monitoring policies list \
  --filter="displayName=email-delivery-failure-rate" \
  --project=hmatologia2

# 2. Function invocations logged
gcloud logging read \
  'labels.functionName="generatePatientAuthLink"' \
  --limit=10 \
  --project=hmatologia2

# 3. Error/success ratio visible
gcloud logging read \
  'labels.functionName="generatePatientAuthLink"' \
  --limit=100 \
  --format=json \
  --project=hmatologia2 | \
  jq '[.[] | .severity] | group_by(.) | map({severity: .[0], count: length})'

# 4. Slack notification received
echo "MANUAL: Check #production-alerts for email delivery warning"

echo "✓ Alert 4 validation complete"
```

---

## Alert 5: Function Latency Degradation (P3)

**Condition:** p95 latency >2s for portal callables  
**Severity:** P3 (low)  
**Notification:** Slack + Alert Manager email

### 5.1 Create Alert Policy

```bash
gcloud monitoring policies create \
  --display-name="function-latency-degradation" \
  --project=hmatologia2 << 'EOF'
{
  "displayName": "function-latency-degradation",
  "conditions": [
    {
      "displayName": "Portal Functions p95 Latency >2s",
      "conditionThreshold": {
        "filter": "resource.type = \"cloud_function\" AND (labels.functionName = \"verifyPatientAuthToken\" OR labels.functionName = \"getPatientLaudos\")",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 2000,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_PERCENTILE_95",
            "crossSeriesReducer": "REDUCE_MEAN"
          }
        ]
      }
    }
  ],
  "notificationChannels": [
    "projects/hmatologia2/notificationChannels/<SLACK_CHANNEL_ID>"
  ],
  "documentation": {
    "content": "Portal function latency degraded. Profile execution, check Firestore indexes, optimize queries.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 5.2 Manual Verification

```bash
# Check function execution times
gcloud logging read \
  'resource.type="cloud_function" AND \
   (labels.functionName="verifyPatientAuthToken" OR labels.functionName="getPatientLaudos")' \
  --limit=50 \
  --format=json \
  --project=hmatologia2 | jq '.[] | {function: .labels.functionName, duration: .duration}'

# Sort by duration to find p95
gcloud logging read \
  'resource.type="cloud_function" AND labels.functionName="verifyPatientAuthToken"' \
  --limit=100 \
  --format=json \
  --project=hmatologia2 | jq '[.[] | .duration] | sort | .[length * 0.95 | floor]'
```

### 5.3 Test Procedure: Trigger Latency Alert

```bash
# Step 1: Simulate slow function invocations
# Write logs with execution times >2s

for i in {1..50}; do
  duration=$((1500 + RANDOM % 1000))  # 1500-2500ms

  gcloud logging write verifyPatientAuthToken \
    "{\"duration\": $duration, \"message\": \"Token verification took ${duration}ms\"}" \
    --resource=cloud_function \
    --labels=functionName=verifyPatientAuthToken \
    --project=hmatologia2 \
    --severity=INFO
  sleep 1
done

# Step 2: Add some slow outliers (>2000ms)
for i in {1..10}; do
  gcloud logging write verifyPatientAuthToken \
    "{\"duration\": $((2500 + RANDOM % 1500)), \"message\": \"Slow invocation detected\"}" \
    --resource=cloud_function \
    --labels=functionName=verifyPatientAuthToken \
    --project=hmatologia2 \
    --severity=INFO
  sleep 2
done

# Step 3: Wait for alert window (5-10 minutes)
sleep 600

# Step 4: Verify p95
gcloud logging read \
  'labels.functionName="verifyPatientAuthToken"' \
  --limit=100 \
  --format=json \
  --project=hmatologia2 | jq 'map(.jsonPayload.duration // .duration) | sort | .[length * 0.95 | floor]'
# Expected: >2000
```

### 5.4 Success Verification Checklist

```bash
# ✓ Checklist:

# 1. Alert policy created
gcloud alpha monitoring policies list \
  --filter="displayName=function-latency-degradation" \
  --project=hmatologia2

# 2. Function metrics visible
gcloud logging read \
  'labels.functionName="verifyPatientAuthToken"' \
  --limit=50 \
  --format=json \
  --project=hmatologia2 | jq 'map(.duration) | {min: min, max: max, avg: (add / length | round)}'

# 3. p95 calculation verified
gcloud logging read \
  'labels.functionName="verifyPatientAuthToken"' \
  --limit=100 \
  --format=json \
  --project=hmatologia2 | \
  jq '[.[] | .duration] | sort | {p50: .[length * 0.50 | floor], p95: .[length * 0.95 | floor], p99: .[length * 0.99 | floor]}'

# 4. Slack notification received
echo "MANUAL: Check #production-alerts for latency warning (if p95 >2s)"

echo "✓ Alert 5 validation complete"
```

---

## Comprehensive Validation Script (All 5 Alerts)

Save as `scripts/validate-all-alerts.sh`:

```bash
#!/bin/bash

# Comprehensive Alert Validation Script
# Usage: bash scripts/validate-all-alerts.sh

set -e

PROJECT_ID="hmatologia2"
REGION="southamerica-east1"

echo "===== Cloud Logs Alert Policies Validation ====="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# === Alert 1: Portal Auth Failures ===
echo "→ Alert 1: Portal Auth Failures"
echo "  Creating test logs..."
for i in {1..6}; do
  gcloud logging write verifyPatientAuthToken-test \
    "TEST ERROR #$i: Token verification failed" \
    --severity=ERROR \
    --resource=cloud_function \
    --labels=functionName=verifyPatientAuthToken \
    --project=$PROJECT_ID
  sleep 1
done
echo "  ✓ Test logs written. Waiting for alert..."
sleep 10

# === Alert 2: NOTIVISA Queue Stuck ===
echo "→ Alert 2: NOTIVISA Queue Stuck"
echo "  (Requires manual Firestore entry or emulator)"
echo "  SKIP: Manual step required"

# === Alert 3: Firestore Rule Rejections ===
echo "→ Alert 3: Firestore Rule Rejections"
echo "  Creating test rejection logs..."
for i in {1..12}; do
  gcloud logging write firestore-rule-rejection-test \
    "Permission denied: User cannot access document" \
    --severity=ERROR \
    --resource=firestore \
    --labels="documentPath=/labs/test-lab/data,operation=Read" \
    --project=$PROJECT_ID
  sleep 1
done
echo "  ✓ Test logs written"

# === Alert 4: Email Delivery Failure ===
echo "→ Alert 4: Email Delivery Failure Rate"
echo "  Creating email test logs..."
for i in {1..80}; do
  gcloud logging write generatePatientAuthLink \
    "Email sent successfully" \
    --severity=INFO \
    --resource=cloud_function \
    --labels=functionName=generatePatientAuthLink \
    --project=$PROJECT_ID
done
for i in {1..25}; do
  gcloud logging write generatePatientAuthLink \
    "Failed to send email: API timeout" \
    --severity=ERROR \
    --resource=cloud_function \
    --labels=functionName=generatePatientAuthLink \
    --project=$PROJECT_ID
done
echo "  ✓ Test logs written (80 success, 25 failure = 23.8% fail rate)"

# === Alert 5: Function Latency ===
echo "→ Alert 5: Function Latency Degradation"
echo "  Creating latency test logs..."
for i in {1..30}; do
  duration=$((2100 + RANDOM % 500))
  gcloud logging write verifyPatientAuthToken \
    "Invocation took ${duration}ms" \
    --severity=INFO \
    --resource=cloud_function \
    --labels=functionName=verifyPatientAuthToken \
    --project=$PROJECT_ID
  sleep 1
done
echo "  ✓ Test logs written"

echo ""
echo "===== Summary ====="
echo "All alert test logs written successfully."
echo ""
echo "Next steps:"
echo "1. Check GCP Cloud Logging console for test entries"
echo "2. Verify Slack #production-alerts for notifications"
echo "3. Review alert policies in GCP Monitoring"
echo "4. Clean up test logs (manual)"
echo ""
echo "Manual cleanup:"
echo "  gcloud logging read 'textPayload=~TEST' --project=$PROJECT_ID --limit=10 | jq '.[] | .name'"
```

**Execute:**

```bash
bash scripts/validate-all-alerts.sh
```

---

## Cleanup: Remove Test Logs

```bash
# List test logs
gcloud logging read \
  'textPayload=~"TEST ERROR|firestore-rule-rejection-test|Email sent successfully|Invocation took"' \
  --limit=200 \
  --format=json \
  --project=hmatologia2 | jq '.[] | .logName' | sort | uniq

# Delete test function (if created)
gcloud functions delete test-notivisa-queue-alert \
  --region=southamerica-east1 \
  --project=hmatologia2 \
  --quiet

# Note: Cloud Logs cannot be manually deleted. Retention policy will auto-clean after 30 days.
```

---

## Pre-Deployment Checklist

Before Phase 4 launch (2026-05-20):

- [ ] **Alert 1 (Auth Failures)** — Policy created + tested + Slack verified
- [ ] **Alert 2 (NOTIVISA Queue)** — Policy created + cron function verified
- [ ] **Alert 3 (Firestore Rejections)** — Policy created + tested
- [ ] **Alert 4 (Email Delivery)** — Policy created + tested
- [ ] **Alert 5 (Function Latency)** — Policy created + tested
- [ ] **Notification Channels** — Slack webhook + SMS pager verified
- [ ] **On-Call Contacts** — `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` filled in
- [ ] **Runbooks** — All 5 runbooks reviewed + test execution scheduled
- [ ] **Team Training** — On-call briefing completed
- [ ] **Dashboard Export** — JSON configs exported to `.planning/dashboards/`

---

## Troubleshooting

### gcloud command not found

```bash
# Install Google Cloud SDK
# macOS: brew install google-cloud-sdk
# Windows: choco install google-cloud-sdk
# Linux: curl https://sdk.cloud.google.com | bash

gcloud init
gcloud auth login
gcloud config set project hmatologia2
```

### Alert policy not triggering

```bash
# Check if notification channel is configured
gcloud alpha monitoring channels list --project=hmatologia2

# Verify alert policy is enabled
gcloud alpha monitoring policies list --project=hmatologia2 | grep -i "alert-name"

# Test notification channel (direct Slack test)
# In Slack, use: /test-notification to trigger test alert
```

### Slack webhook not working

```bash
# Verify Slack integration in GCP
# 1. GCP Console → Monitoring → Notification Channels
# 2. Find Slack channel → Edit → Test notification
# 3. Check Slack #production-alerts channel

# If webhook fails:
# - Re-authenticate Slack app in GCP
# - Check Slack app permissions (incoming webhooks)
# - Verify #production-alerts channel exists
```

---

## Related Documents

- `.planning/PHASE_4_CLOUD_LOGS_SETUP.md` — Full alert + runbook definitions
- `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` — On-call rotation + escalation tree
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — v1.3 baseline reference
- `.planning/runbooks/` — Auto-generated runbook scripts

---

**Status:** ✅ READY FOR EXECUTION  
**Approval:** Awaiting CTO sign-off  
**Next Step:** Execute validation script + verify Slack notifications
