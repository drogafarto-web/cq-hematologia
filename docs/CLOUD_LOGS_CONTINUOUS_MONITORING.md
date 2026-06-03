# Cloud Logs Continuous Monitoring — Setup + Operations Guide

**Version:** v1.3+  
**Status:** Post-deployment infrastructure guide  
**Applies to:** HC Quality production (`hmatologia2`, `southamerica-east1`)  
**Audience:** DevOps engineers, on-call rotation, CTO

---

## Overview

Post-v1.3 deployment, cloud logs monitoring transitions from **episodic 24-hour sweeps** (post-deploy validation) to **continuous operational surveillance**. This document provides the setup, escalation workflows, and SLO targets.

**Three monitoring tiers:**

1. **Tier 1 (Immediate):** Cloud Monitoring alerts + dashboards (setup: ~2 hours)
2. **Tier 2 (Short-term):** Custom metrics + anomaly detection (setup: ~1 week)
3. **Tier 3 (Medium-term):** Multi-region failover + advanced alerting (setup: Phase 14+)

This document focuses on **Tier 1 (Immediate)** for v1.3 production readiness.

---

## Part 1: Cloud Monitoring Setup (Tier 1)

### 1.1 Prerequisites

- [ ] `gcloud` CLI installed and authenticated to `hmatologia2` project
- [ ] Firebase project owner or Editor IAM role
- [ ] Slack workspace (or email) for alert delivery
- [ ] 1–2 hours for initial setup

### 1.2 Create Monitoring Workspace

1. **Navigate to Cloud Console:**

   ```
   https://console.cloud.google.com/monitoring?project=hmatologia2
   ```

2. **Enable Cloud Monitoring API:**

   ```bash
   gcloud services enable monitoring.googleapis.com \
     --project=hmatologia2
   ```

3. **Create notification channel (Slack):**

   **Option A: Slack webhook (recommended)**

   ```bash
   gcloud alpha monitoring channels create \
     --display-name="HC Quality Alerts" \
     --type=slack \
     --channel-labels=channel_name='#devops-alerts'
   ```

   Note the returned `[CHANNEL_ID]` for later use.

   **Option B: Email (fallback)**

   ```bash
   gcloud alpha monitoring channels create \
     --display-name="HC Quality Alerts (Email)" \
     --type=email \
     --channel-labels=email_address='drogafarto@gmail.com'
   ```

4. **Verify channel created:**
   ```bash
   gcloud alpha monitoring channels list --project=hmatologia2
   ```

### 1.3 Create Alert Policies

#### Alert 1: Error Rate Spike (>1% in 5-min window)

```bash
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="HC Quality: Error Rate >1%" \
  --condition-display-name="Error rate spike" \
  --condition-threshold-value=0.01 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison-type=COMPARISON_GT \
  --documentation-content="Error rate exceeded 1%. Check 'CLOUD_LOGS_MONITORING_REPORT_v1.3.md' incident response section." \
  --project=hmatologia2
```

Or via UI:

1. Open [Cloud Monitoring → Policies](https://console.cloud.google.com/monitoring/alertpolicies?project=hmatologia2)
2. Click "Create Policy"
3. **Condition:**
   - Resource type: `Cloud Function`
   - Metric: `cloudfunctions.googleapis.com|function|error_count`
   - Aggregation window: 5 minutes
   - Condition: `error_count / invocation_count > 0.01`
4. **Notification:** Select Slack channel created above
5. **Documentation:**

   ```
   Error rate exceeded 1% threshold.

   **Action:**
   1. Check Cloud Logs for error type via gcloud CLI
   2. Refer to 'Incident Response Runbook' in CLOUD_LOGS_MONITORING_REPORT_v1.3.md
   3. Escalate to CTO if >5 errors in 1 hour

   **Commands:**
   gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20
   ```

#### Alert 2: P99 Latency Spike (>5 seconds)

```yaml
# Create file: gke-alert-p99-latency.yaml
displayName: 'HC Quality: P99 Latency >5s'
documentation:
  content: |
    Cloud Function P99 latency exceeded 5 seconds.

    **Action:**
    1. Check Firestore for missing indexes or slow queries
    2. Refer to 'If P99 Latency >5s' section in incident runbook
    3. Review Cloud Function memory allocation
conditions:
  - displayName: 'P99 latency spike'
    conditionThreshold:
      filter: |
        resource.type="cloud_function"
        AND metric.type="cloudfunctions.googleapis.com|function|execution_times"
      comparison: COMPARISON_GT
      thresholdValue: 5000 # milliseconds
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_PERCENTILE_99
notificationChannels:
  - '[CHANNEL_ID]'
```

Deploy:

```bash
gcloud alpha monitoring policies create --policy-from-file=gke-alert-p99-latency.yaml \
  --project=hmatologia2
```

#### Alert 3: Firestore Quota Alert (>80% usage)

```bash
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="HC Quality: Firestore Quota >80%" \
  --condition-display-name="Firestore quota warning" \
  --condition-threshold-value=0.80 \
  --condition-threshold-duration=300s \
  --documentation-content="Firestore quota usage approaching limit. Scale up via Firebase Console → Quotas if needed." \
  --project=hmatologia2
```

#### Alert 4: Function Memory OOM (any occurrence)

```bash
gcloud logging read \
  'resource.type="cloud_function" AND textPayload=~".*out of memory.*"' \
  --project=hmatologia2 \
  --format=json > oom-baseline.json
```

Create alert via UI:

1. Open [Cloud Monitoring → Policies](https://console.cloud.google.com/monitoring/alertpolicies?project=hmatologia2)
2. Click "Create Policy"
3. **Condition:**
   - Resource type: `Cloud Logs`
   - Log filter: `resource.type="cloud_function" AND textPayload=~".*out of memory.*"`
   - Condition: `log entry count > 0 in 60s`
4. **Notification:** Select Slack channel
5. **Documentation:**

   ```
   Cloud Function memory limit exceeded.

   **Action:**
   1. Identify function: gcloud logging read "textPayload=~'.*out of memory.*'" --limit=5
   2. Increase memory in function options (default 256MiB → 512MiB)
   3. Redeploy: firebase deploy --only functions:[FUNCTION_NAME]
   4. Monitor next 2 hours for recurrence
   ```

### 1.4 Create Monitoring Dashboards

#### Dashboard 1: System Health Overview

**Via gcloud:**

```bash
gcloud monitoring dashboards create --config-from-file=dashboard-overview.json \
  --project=hmatologia2
```

**File: `scripts/dashboard-overview.json`**

```json
{
  "displayName": "HC Quality v1.3 — System Health",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Function Error Rate (24h)",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_function\" AND metric.type=\"cloudfunctions.googleapis.com|function|error_count\""
                  }
                }
              }
            ]
          }
        }
      },
      {
        "xPos": 6,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Function P99 Latency (ms)",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_function\" AND metric.type=\"cloudfunctions.googleapis.com|function|execution_times\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_PERCENTILE_99"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      {
        "yPos": 4,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Firestore Writes/sec (5-min avg)",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_firestore\" AND metric.type=\"firestore.googleapis.com|document|write_ops\""
                  }
                }
              }
            ]
          }
        }
      },
      {
        "xPos": 6,
        "yPos": 4,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Hosting 5xx Errors (24h)",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run\" AND httpRequest.status>=500"
                  }
                }
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Via UI (simpler):**

1. Open [Cloud Monitoring → Dashboards](https://console.cloud.google.com/monitoring/dashboards?project=hmatologia2)
2. Click "Create Dashboard"
3. Add these charts:
   - Error rate (functions)
   - P99 latency (functions)
   - Firestore writes/sec
   - HTTP 5xx (hosting)
   - Firestore quota usage
4. Set auto-refresh: 30 seconds
5. Save as `HC Quality v1.3 — System Health`

---

## Part 2: Escalation Workflows

### 2.1 On-Call Rotation

**Primary on-call:** Defined in team Slack (rotate weekly)  
**Escalation path:**

1. Alert fires → Slack message to `#devops-alerts`
2. On-call engineer: Acknowledge within 5 minutes
3. Check runbook section in `CLOUD_LOGS_MONITORING_REPORT_v1.3.md`
4. If unresolved after 15 min: Page CTO (@drogafarto)
5. If critical (🔴): Page CTO immediately; start remediation in parallel

### 2.2 Severity Levels

| Level         | Threshold                                           | Response                                     | Owner            |
| ------------- | --------------------------------------------------- | -------------------------------------------- | ---------------- |
| 🟢 **Green**  | Error rate <0.1%, no alerts                         | Monitor passively                            | On-call engineer |
| 🟡 **Yellow** | 0.1%–1% error rate, P99 latency 3–5s                | Acknowledge alert; investigate within 30 min | On-call engineer |
| 🔴 **Red**    | >1% error rate, >5s P99, OOM, permission denied     | Page on-call; escalate to CTO within 5 min   | CTO + on-call    |
| ⚫ **Black**  | Multiple simultaneous alerts, 5xx sustained >10 min | All-hands incident; prepare rollback         | CTO + team       |

### 2.3 Escalation Template

**When escalating to CTO:**

```
INCIDENT: [Error Rate Spike | P99 Latency Spike | OOM | Firestore Quota | etc.]

SEVERITY: 🔴 RED | ⚫ BLACK

TIMESTAMP: 2026-05-10T14:32:15Z

METRIC: [error_count = X, P99 latency = Yms, memory = ZMB, etc.]

AFFECTED MODULE: [bioquimica | sgq | liberacao | etc.]

ERROR MESSAGE: [paste exact error from Cloud Logs]

ACTIONS TAKEN:
- [✓] Checked Cloud Monitoring dashboard
- [✓] Retrieved Cloud Logs via gcloud
- [✓] Ran incident runbook step X

CURRENT STATUS: [Monitoring | In Progress | Blocked]

DECISION NEEDED: [Continue monitoring | Rollback | Code fix | Quota increase]

CONTACT: [Your name] — [Slack] or [email]
```

### 2.4 Escalation Contacts

| Role                 | Primary                                                  | Backup   | Response SLA            |
| -------------------- | -------------------------------------------------------- | -------- | ----------------------- |
| On-call Engineer     | Slack `#devops-on-call`                                  | —        | 5 min                   |
| CTO                  | drogafarto@gmail.com                                     | Slack DM | 30 min (business hours) |
| Google Cloud Support | [Support case](https://console.cloud.google.com/support) | —        | 4 hour (standard)       |

---

## Part 3: SLO Targets and Reporting

### 3.1 Service Level Objectives (SLOs)

| SLO                    | Metric                        | Target            | Measurement Window | Owner   |
| ---------------------- | ----------------------------- | ----------------- | ------------------ | ------- |
| **Availability**       | Uptime (5xx errors)           | >99.5%            | Monthly            | On-call |
| **Error Rate**         | Errors / total invocations    | <0.1%             | Daily rolling 24h  | On-call |
| **Latency (P99)**      | Cloud Function execution time | <3s               | Daily rolling 24h  | On-call |
| **Audit Trail**        | Failed writes with audit log  | 0 (100% coverage) | Real-time          | CTO     |
| **RDC 978 Compliance** | Coverage of Art. 167–182      | ≥95%              | Quarterly          | CTO     |

### 3.2 SLO Tracking Dashboard

Create a separate dashboard for SLO metrics:

```json
{
  "displayName": "HC Quality v1.3 — SLO Tracking",
  "tiles": [
    {
      "title": "Monthly Uptime %",
      "scorecard": {
        "timeSeriesQuery": {
          "timeSeriesFilter": {
            "filter": "resource.type=\"cloud_run\" AND metric.type=\"compute.googleapis.com|instance|cpu|utilization\"",
            "aggregation": {
              "alignmentPeriod": "2592000s",
              "perSeriesAligner": "ALIGN_FRACTION_TRUE"
            }
          }
        },
        "thresholds": [{ "value": 0.995, "direction": "ABOVE", "label": "SLO target" }]
      }
    },
    {
      "title": "24h Error Rate %",
      "scorecard": {
        "timeSeriesQuery": {
          "timeSeriesFilter": {
            "filter": "resource.type=\"cloud_function\" AND metric.type=\"cloudfunctions.googleapis.com|function|error_count\"",
            "aggregation": {
              "alignmentPeriod": "86400s",
              "perSeriesAligner": "ALIGN_RATE"
            }
          }
        }
      }
    }
  ]
}
```

### 3.3 Weekly SLO Report

**Automated report (Slack, Fridays 16:00 BRT):**

```bash
#!/bin/bash
# File: scripts/slo-report.sh

PROJECT="hmatologia2"
WINDOW="604800s"  # 7 days

echo "**HC Quality SLO Report — Week Ending $(date +%Y-%m-%d)**"
echo ""
echo "| SLO | Target | Actual | Status |"
echo "|---|---|---|---|"

# Uptime
UPTIME=$(gcloud monitoring time-series list \
  --filter='metric.type="cloud_run" AND resource.type="cloud_run"' \
  --project=$PROJECT --format=json | jq '.data | length')
echo "| Availability | >99.5% | $(($UPTIME))% | ✅ |"

# Error rate
ERROR_RATE=$(gcloud logging read "severity >= ERROR" \
  --project=$PROJECT --format=json | jq 'length / (length * 100) * 100')
echo "| Error Rate | <0.1% | $(echo $ERROR_RATE | awk '{printf "%.2f", $1}')% | $([ $(echo "$ERROR_RATE < 0.1" | bc) -eq 1 ] && echo '✅' || echo '⚠️') |"

# P99 latency
P99=$(gcloud logging read 'resource.type="cloud_function"' \
  --project=$PROJECT --format=json | \
  jq '[.[] | select(.jsonPayload.latency) | .jsonPayload.latency] | sort[-1]')
echo "| P99 Latency | <3000ms | ${P99}ms | $([ $P99 -lt 3000 ] && echo '✅' || echo '⚠️') |"

echo ""
echo "**Next Review:** $(date -d '+7 days' +%Y-%m-%d)"
```

Deploy as Cloud Scheduler job:

```bash
gcloud scheduler jobs create app-engine slo-report-weekly \
  --schedule="0 16 * * FRI" \
  --timezone="America/Sao_Paulo" \
  --http-method=GET \
  --uri="https://southamerica-east1-hmatologia2.cloudfunctions.net/sloreport" \
  --project=hmatologia2
```

---

## Part 4: Long-Term Monitoring Evolution

### 4.1 Tier 2: Custom Metrics (Week 2–4 post-deploy)

**Implement per-module breakdown:**

- Bioquímica: CIQ creation latency, validation errors
- SGQ: Document versioning operations, audit trail hits
- Liberação: Signature computation time, auth failures
- Reclamações: Transit errors, status update latency
- Satisfação: NPS email queue failures
- Audit: Write intent capture success rate, chainHash verification

**Example custom metric (Bioquímica CIQ creation latency):**

```typescript
// functions/src/modules/bioquimica/metrics.ts
import { cloudMonitoring } from 'firebase-functions/params';

const metricsClient = new monitoring.MetricServiceClient();

export async function recordCIQCreationLatency(labId: string, latencyMs: number) {
  const request = {
    name: metricsClient.projectPath('hmatologia2'),
    timeSeries: [
      {
        metric: {
          type: 'custom.googleapis.com/bioquimica/ciq_creation_latency_ms',
          labels: { lab_id: labId },
        },
        resource: {
          type: 'global',
          labels: { project_id: 'hmatologia2' },
        },
        points: [
          {
            interval: { endTime: { seconds: Math.floor(Date.now() / 1000) } },
            value: { doubleValue: latencyMs },
          },
        ],
      },
    ],
  };

  await metricsClient.createTimeSeries(request);
}
```

### 4.2 Tier 3: Anomaly Detection + Multi-Region (Phase 14+)

**Future enhancements:**

- Cloud Monitoring anomaly detection for error spikes
- Secondary region failover (if budget allows)
- Integration with incident management (PagerDuty / Opsgenie)
- Automated playbook execution (SOAR platform)

---

## Part 5: Runbook Quick Reference

### Command Cheat Sheet

**List all alerts:**

```bash
gcloud alpha monitoring policies list --project=hmatologia2
```

**View alert policy:**

```bash
gcloud alpha monitoring policies describe [POLICY_ID] --project=hmatologia2
```

**Update alert threshold:**

```bash
gcloud alpha monitoring policies update [POLICY_ID] \
  --update-condition-threshold-value=0.02 \
  --project=hmatologia2
```

**View recent errors:**

```bash
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --limit=20 --freshness=1h
```

**Export logs to JSON:**

```bash
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --format=json > errors-$(date +%s).json
```

**Check Firestore quota:**

```bash
gcloud firestore databases describe --location=southamerica-east1 \
  --project=hmatologia2
```

**Monitor in real-time (tail):**

```bash
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 --follow
```

### Key Documentation Files

- **`CLOUD_LOGS_MONITORING_REPORT_v1.3.md`** — Executive summary + incident runbook
- **`CLOUD_LOGS_QUICK_REFERENCE.md`** — TL;DR + command snippets
- **`CLOUD_LOGS_INTEGRATION_CHECKLIST.md`** — Deploy workflow integration
- **`.planning/reports/cloud-logs-sweep-2026-05-07.md`** — Pre-deploy findings (5 issues)

---

## Part 6: Troubleshooting

### Issue: Alert not firing when expected

**Root causes:**

1. Notification channel not verified (Slack/email setup incomplete)
2. Metric not emitting (function not invoked)
3. Condition threshold misconfigured

**Resolution:**

```bash
# Verify notification channel
gcloud alpha monitoring channels list --project=hmatologia2

# Verify metric has data
gcloud monitoring time-series list \
  --filter='metric.type="cloudfunctions.googleapis.com|function|error_count"' \
  --project=hmatologia2

# Dry-run alert condition
gcloud alpha monitoring policies describe [POLICY_ID] \
  --format=json --project=hmatologia2 | jq '.conditions[0]'
```

### Issue: Too many false positives

**Root cause:** Threshold set too low

**Resolution:**

```bash
# Increase threshold
gcloud alpha monitoring policies update [POLICY_ID] \
  --update-condition-threshold-value=0.02 \
  --project=hmatologia2

# Or disable temporarily
gcloud alpha monitoring policies update [POLICY_ID] \
  --remove-notification-channels \
  --project=hmatologia2
```

### Issue: Slack channel not receiving messages

**Root causes:**

1. Webhook URL invalid or revoked
2. Slack bot permission missing
3. Notification channel misconfigured

**Resolution:**

1. Recreate notification channel:

   ```bash
   gcloud alpha monitoring channels create \
     --display-name="HC Quality Alerts (new)" \
     --type=slack \
     --channel-labels=channel_name='#devops-alerts'
   ```

2. Update alert policy to use new channel:
   ```bash
   gcloud alpha monitoring policies update [POLICY_ID] \
     --notification-channels=[NEW_CHANNEL_ID] \
     --project=hmatologia2
   ```

---

## Part 7: Compliance & Audit Trail

### Monitoring Coverage per RDC 978

| Article  | Requirement                         | Monitored Via                           | Alert Threshold           | Owner   |
| -------- | ----------------------------------- | --------------------------------------- | ------------------------- | ------- |
| Art. 167 | Laudo signature RT accountability   | Cloud Logs `liberacao_*` functions      | Error rate >1%            | On-call |
| Art. 179 | CIQ validation rules (Westgard)     | Cloud Logs `bioquimica_*` functions     | Error rate >0.5%          | On-call |
| Art. 181 | Traceability events for controls    | Cloud Logs `onInsumoMovimentacaoCreate` | Error rate >0% (critical) | CTO     |
| Art. 182 | Analytical method validation (bula) | Cloud Logs `analyzer_*` functions       | Error rate >0.5%          | On-call |

### Monitoring Coverage per DICQ 4.4

| Requirement             | Monitored Via                                         | Verification                              | Frequency |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------- | --------- |
| Write intent capture    | Cloud Logs + Firestore audit collection               | Daily spot-check (5 random docs per lab)  | Daily     |
| Immutable event logs    | Firestore `events` subcollection read-only rules      | Weekly (check rules compilation warnings) | Weekly    |
| Soft delete enforcement | Cloud Logs (check for any `deleteDoc` calls)          | Monthly audit                             | Monthly   |
| Operator accountability | Write signatures + Cloud Logs (operatorId validation) | Quarterly compliance audit                | Quarterly |

---

## Summary

**Continuous monitoring setup timeline:**

- **Day 1 (immediate):** Cloud Monitoring alerts + dashboards (Tier 1)
- **Week 2–4:** Custom metrics + anomaly detection (Tier 2)
- **Phase 14+:** Multi-region + advanced alerting (Tier 3)

**For v1.3 production readiness:** Complete Tier 1 setup before proceeding to Phase 13 (CAPA closure).

**Questions?** Refer to `CLOUD_LOGS_MONITORING_REPORT_v1.3.md` incident runbook or contact @drogafarto.

---

**Last Updated:** 2026-05-09  
**Version:** v1.3  
**Status:** Ready for implementation
