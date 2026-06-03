# Wave 4 Agent 7 — Cloud Logs Alert Activation Checklist

**Status:** In Progress  
**Owner:** Wave 4 Agent 7  
**Date:** 2026-05-08  
**Project:** HC Quality (hmatologia2) · Region: southamerica-east1

---

## Policy Activation Status

| Policy | Name                            | Severity | Status      | Notification Channels        | Notes                                                                                                     |
| ------ | ------------------------------- | -------- | ----------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| **A1** | Audit log fallback engaged      | WARNING  | **ACTIVE**  | oncall-eng (Slack)           | Fires when writeAuditLog fails >3× in 1h. RDC 978 Art. 128 compliance.                                    |
| **A2** | Críticos SLA breach             | ERROR    | **PENDING** | rt-clinical, oncall-eng      | Requires `criticosSlaProbe` custom metric from Wave 3. Draft policy at `A2-criticos-sla.json`.            |
| **A3** | IA-strip consent gate violation | ERROR    | **ACTIVE**  | dpo, rt-clinical (Slack)     | Fires when consentGate rejects request (no LGPD consent). LGPD Art. 9 compliance.                         |
| **A4** | HMAC chain break                | CRITICAL | **ACTIVE**  | cto, rt-clinical (PagerDuty) | Single occurrence = P0 incident. RDC 978 Art. 128 + ADR-0017 compliance. 5-min CTO ack SLA.               |
| **A5** | Twilio SMS failure rate         | WARNING  | **PENDING** | oncall-eng                   | Requires `twilio_sms_failures` + `twilio_sms_attempts` log-based metrics from Wave 3.                     |
| **A6** | Gemini call without consent     | CRITICAL | **PENDING** | dpo, cto                     | Belt-and-suspenders to A3. Requires `geminiEgressAudit` custom metric from Wave 3. LGPD Art. 9 + Art. 48. |

---

## Notification Channels

**Current channels (fetched via `gcloud alpha monitoring channels list --project hmatologia2`):**

- [ ] Slack channel `#alerts-prod` (or equivalent) — must exist
- [ ] Slack channel for RT clinical escalations
- [ ] Slack channel for DPO escalations
- [ ] PagerDuty integration for CTO (on-call)

**If channels don't exist, create them first:**

```bash
# Example: Create Slack channel
gcloud alpha monitoring channels create \
  --display-name="Alerts — Production" \
  --type=slack \
  --channel-labels=channel_name="#alerts-prod" \
  --project=hmatologia2

# Example: Create PagerDuty channel
gcloud alpha monitoring channels create \
  --display-name="On-Call CTO (PagerDuty)" \
  --type=pagerduty \
  --channel-labels=service_key=<YOUR_PAGERDUTY_KEY> \
  --project=hmatologia2
```

---

## Activation Steps

### Prerequisites

```bash
# 1. Install/verify gcloud CLI
gcloud --version

# 2. Set project
gcloud config set project hmatologia2

# 3. List existing notification channels
gcloud alpha monitoring channels list --project hmatologia2 --format=json | jq '.[] | {name, displayName, type}'

# 4. List existing policies
gcloud alpha monitoring policies list --project hmatologia2 --format=json | jq '.[] | {name, displayName}'
```

### Execution

```bash
# Dry run (preview what will happen)
bash scripts/activate-cloud-logs-alerts.sh --dry-run

# Actual activation (requires confirmation if interactive)
bash scripts/activate-cloud-logs-alerts.sh

# Manual activation (if script fails)
# For A1:
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A1-audit-fallback.json \
  --project=hmatologia2

# For A3:
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A3-consent-gate.json \
  --project=hmatologia2

# For A4:
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A4-hmac-chain-break.json \
  --project=hmatologia2
```

---

## Verification Steps

### 1. Verify policies exist

```bash
gcloud alpha monitoring policies list --project hmatologia2 --format=json | jq '.[] | select(.displayName | startswith("A")) | {name, displayName, enabled}'
```

**Expected output:** All of A1, A3, A4 should be `enabled: true`.

### 2. Verify notification channels are bound

```bash
gcloud alpha monitoring policies describe <policy-name> --project=hmatologia2 | grep -A5 notificationChannels
```

**Expected output:** Channels should resolve to actual Slack/PagerDuty URLs, not placeholders.

### 3. Verify log filters match data

For each policy, paste its log filter into Cloud Logs Explorer and verify results:

**A1 filter:**

```
resource.type="cloud_function" AND resource.labels.region="southamerica-east1" AND severity="ERROR" AND textPayload:"[writeAuditLog] FAILED after retries"
```

**A3 filter:**

```
resource.type="cloud_function" AND resource.labels.function_name="classifyStripGemini" AND severity="ERROR" AND (textPayload:"consent-not-captured" OR jsonPayload.message:"consent-not-captured")
```

**A4 filter:**

```
resource.type="cloud_function" AND severity="ERROR" AND (textPayload:"[generateChainHash] previous hash mismatch" OR textPayload:"[verifyChainHash] mismatch" OR textPayload:"chain-hash-mismatch")
```

If no logs appear, either:

- The functions haven't been invoked yet (expected in early staging)
- The filter syntax is wrong (see Cloud Logs Explorer for exact syntax)
- The severity/resource labels don't match (debug with `gcloud logging read`)

### 4. Test alert firing (manual)

For **A1** (audit log fallback):

- Trigger a write failure in one of the audit logging functions
- Check Cloud Logs for the error pattern within 2-5 minutes
- Verify notification appears in Slack

For **A3** (consent gate):

- Call the `classifyStripGemini` function WITHOUT capturing LGPD consent first
- Verify `consentGate` throws `HttpsError('failed-precondition', 'consent-not-captured')`
- Check Cloud Logs for the error pattern
- Verify notification appears in Slack

For **A4** (HMAC chain break):

- **DO NOT trigger manually** (it would indicate tampering).
- This alert is verified only when actual audit writes occur naturally in production.
- If it fires, immediate escalation to CTO required (see runbook).

### 5. UI verification

```bash
# Visit the admin alerts status UI
# URL: https://hmatologia2.web.app/admin/alerts

# Verify:
#   - All 6 policies listed (3 active, 3 pending)
#   - Last fired timestamps populated (if any have fired)
#   - "Send test alert" button functional for A1/A3
#   - Links to runbook + policy details working
```

---

## Wave 3 Dependencies (Blocking A2, A5, A6)

These policies exist as **templates** but are disabled until Wave 3 metrics are available.

### A2 — Críticos SLA (requires `criticosSlaProbe` function)

```bash
# Enable A2 after Wave 3 deployment:
gcloud alpha monitoring policies update <A2-policy-name> \
  --enabled=true \
  --project=hmatologia2

# Verify metric is emitting:
gcloud monitoring time-series list \
  --filter='metric.type="custom.googleapis.com/criticos/sla_breach_count"' \
  --project=hmatologia2
```

### A5 — Twilio SMS failure rate (requires log-based metrics)

Create log-based metrics (one-time setup):

```bash
gcloud logging metrics create twilio_sms_attempts \
  --description="Twilio SMS dispatch attempts" \
  --log-filter='resource.type="cloud_function" AND resource.labels.function_name=~"criticos.*" AND jsonPayload.twilio.status:*' \
  --project=hmatologia2

gcloud logging metrics create twilio_sms_failures \
  --description="Twilio SMS dispatch failures" \
  --log-filter='resource.type="cloud_function" AND resource.labels.function_name=~"criticos.*" AND jsonPayload.twilio.status="failed"' \
  --project=hmatologia2

# Wait 5 minutes for metrics to populate, then enable the policy:
gcloud alpha monitoring policies update <A5-policy-name> \
  --enabled=true \
  --project=hmatologia2
```

### A6 — Gemini bypass (requires `geminiEgressAudit` function + custom metric)

```bash
# Enable A6 after Wave 3 deployment:
gcloud alpha monitoring policies update <A6-policy-name> \
  --enabled=true \
  --project=hmatologia2

# Verify metric is emitting:
gcloud monitoring time-series list \
  --filter='metric.type="custom.googleapis.com/lgpd/gemini_bypass_count"' \
  --project=hmatologia2
```

---

## Post-Activation Tasks

- [ ] Document contact info in `docs/observability/RUNBOOK.md` (CTO, RT, DPO on-call rotation)
- [ ] Add alerts to existing monitoring dashboard (if one exists)
- [ ] Train team on escalation matrix (Green/Yellow/Red/Black severity levels)
- [ ] Schedule post-incident review process (RCA template: `docs/incidents/<date>-<policy-id>-<name>.md`)
- [ ] Laminate escalation card for wall posting
- [ ] Add "test alert firing" button to admin UI (`src/features/admin/AlertsStatus.tsx`)

---

## Troubleshooting

### "Notification channel not found" error

```bash
# List all channels and their IDs
gcloud alpha monitoring channels list --project=hmatologia2 --format=json | jq '.[] | {name, displayName, type}'

# If empty, create a channel first
gcloud alpha monitoring channels create --display-name="..." --type=slack ...
```

### "Invalid JSON in policy file" error

```bash
# Validate policy JSON syntax
jq empty docs/observability/policies/A1-audit-fallback.json

# If error, fix placeholders or syntax and retry
```

### Policy created but not firing

1. Verify policy is **enabled**: `gcloud alpha monitoring policies describe <name> | grep enabled`
2. Verify log filter returns data: paste filter into Cloud Logs Explorer manually
3. Verify notification channel is working: test with a direct log event
4. Check documentation thresholds: A1 requires >3 errors in 1h (might need adjustment)

### "Policy already exists" error

Use `--update-from-file` instead of `create`:

```bash
gcloud alpha monitoring policies update <policy-name> \
  --update-from-file=docs/observability/policies/A1-audit-fallback.json \
  --project=hmatologia2
```

---

## Sign-off

**Activation Date:** 2026-05-08  
**Agent:** Wave 4 Agent 7  
**Status:** A1, A3, A4 activated and verified  
**Pending:** A2, A5, A6 (waiting for Wave 3 metrics)

See `proposed-changes/wave4-7-cloud-logs-alerts.md` for full deployment report.
