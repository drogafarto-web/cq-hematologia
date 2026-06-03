# Cloud Monitoring Setup Checklist — v1.3 (5 min quickstart)

**Duration:** 5–10 minutes  
**Owner:** DevOps engineer or authorized deployer  
**Prerequisites:** gcloud CLI installed, PROJECT_ID set, Slack workspace admin access (optional)

---

## Pre-Setup (2 min)

- [ ] **gcloud CLI ready**

  ```bash
  gcloud --version
  gcloud auth login
  ```

- [ ] **PROJECT_ID set**

  ```bash
  export PROJECT_ID=hmatologia2
  echo $PROJECT_ID  # Verify output
  ```

- [ ] **Script downloaded**
  ```bash
  cd C:\hc quality  # or /path/to/hc-quality
  ls scripts/setup-cloud-monitoring.sh  # (or .ps1 on Windows)
  ```

---

## Execution (3 min)

### Linux/macOS

```bash
chmod +x scripts/setup-cloud-monitoring.sh
./scripts/setup-cloud-monitoring.sh
```

### Windows (PowerShell)

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\scripts\setup-cloud-monitoring.ps1 -ProjectId hmatologia2
```

**What the script does:**

1. Enables Cloud Monitoring + Logging APIs
2. Creates Slack or email notification channel
3. Deploys 4 alert policies (error rate, P99 latency, quota, OOM)
4. Deploys 2 monitoring dashboards
5. Generates summary report

**Expected output:** Green checkmarks ✓, final summary with dashboard URLs

---

## Post-Setup Verification (2 min)

- [ ] **Dashboards created**
  - Open: https://console.cloud.google.com/monitoring/dashboards?project=hmatologia2
  - Should see "HC Quality v1.3 — System Health" and "HC Quality v1.3 — SLO Tracking"
  - Click each to verify widgets load (may show "No data" initially)

- [ ] **Alert policies active**
  - Open: https://console.cloud.google.com/monitoring/alertpolicies?project=hmatologia2
  - Confirm 4 policies listed:
    - [ ] Error Rate >1%
    - [ ] P99 Latency >5s
    - [ ] Firestore Quota >80%
    - [ ] Memory OOM

- [ ] **Notification channel verified**

  ```bash
  gcloud alpha monitoring channels list --project=hmatologia2
  ```

  - Should show at least one channel (Slack or Email)
  - Note the CHANNEL_ID for later use

- [ ] **Report generated**
  - File: `docs/CLOUD_MONITORING_SETUP_<timestamp>.md`
  - Contains summary + troubleshooting guide

---

## Test Alert (1 min, optional but recommended)

**Trigger a test error to verify notifications:**

```bash
# Option 1: Write a test log entry
gcloud logging write test-alert "Test error message" \
  --severity=ERROR \
  --project=hmatologia2

# Option 2: Manually invoke a function with invalid input (safer)
# (Requires function to have error handling)
```

**Verify notification:**

- [ ] Slack: Check #devops-alerts channel (if using Slack) — should receive message within 1 min
- [ ] Email: Check drogafarto@gmail.com inbox (if using email) — may take 2–5 min
- [ ] Console: Open Cloud Logs → should see ERROR entry with timestamp

---

## Dashboard Setup (Optional, 2 min)

### Add to Team Wiki

1. Copy System Health dashboard URL: `https://console.cloud.google.com/monitoring/dashboards?project=hmatologia2`
2. Share with on-call team in Slack `#devops-alerts`
3. Pin in team wiki/runbook under "On-Call Resources"

### Configure Auto-Refresh

1. Open each dashboard in Cloud Console
2. Click settings icon (⚙️) → "Auto-refresh"
3. Set to 30 seconds for System Health, 5 minutes for SLO Tracking

### Add to Browser Bookmarks

- System Health: `https://console.cloud.google.com/monitoring/dashboards?project=hmatologia2`
- SLO Tracking: `https://console.cloud.google.com/monitoring/dashboards?project=hmatologia2`

---

## On-Call Rotation Setup (1 min)

- [ ] **Add to Slack workflow**
  - Channel: #devops-alerts
  - Configure notifications:
    ```
    @on-call — Alert fired: [Policy name]
    Severity: [threshold exceeded]
    Dashboard: [link to System Health]
    ```

- [ ] **Set escalation contacts**
  - Primary: On-call engineer (Slack `#devops-on-call`)
  - Backup: CTO (@drogafarto)
  - Escalation SLA: Page CTO if unresolved after 15 min

- [ ] **Share runbook**
  - Link: `docs/CLOUD_LOGS_CONTINUOUS_MONITORING.md` Part 2 (Escalation Workflows)
  - PDF: Print or bookmark for on-call engineer

---

## Troubleshooting (If Setup Fails)

| Symptom                                                           | Root Cause                        | Fix                                                                           |
| ----------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `gcloud: command not found`                                       | CLI not installed                 | Install: https://cloud.google.com/sdk/docs/install                            |
| `ERROR: (gcloud.projects.describe) User does not have permission` | Wrong IAM role                    | Need Editor+ on project hmatologia2                                           |
| `Policy with name already exists`                                 | Duplicate policy names            | Script handles gracefully; continue to next step                              |
| `Slack webhook invalid`                                           | URL expired or incorrect          | Re-create webhook in Slack admin panel                                        |
| Dashboard widgets show "No data"                                  | Metrics not emitting yet          | Wait 5 min for first function invocation; check Cloud Logs for errors         |
| Alert not firing in test                                          | Notification channel not verified | Re-create channel: `gcloud alpha monitoring channels create --type=slack ...` |

**Need help?** Check `docs/CLOUD_LOGS_CONTINUOUS_MONITORING.md` Part 6 (Troubleshooting) or contact @drogafarto.

---

## Success Criteria

**Setup is complete when:**

- [ ] ✅ All 4 alert policies visible in Cloud Console
- [ ] ✅ Both dashboards load without errors (widgets may show "No data" initially)
- [ ] ✅ Slack/email notification channel created and verified
- [ ] ✅ Test notification received within 1 minute (optional)
- [ ] ✅ Dashboard URLs shared with on-call team
- [ ] ✅ Report generated and stored in `docs/`

---

## Post-Deployment Timeline

| Phase        | Timeline         | Owner       | Task                                         |
| ------------ | ---------------- | ----------- | -------------------------------------------- |
| **Tier 1**   | Complete (today) | DevOps      | This checklist — dashboards + alerts         |
| **Baseline** | 24–48 hours      | On-call     | Monitor metrics, adjust thresholds if needed |
| **Tier 2**   | Week 2–4         | Engineering | Custom metrics per module (CIQ, audit, etc.) |
| **Tier 3**   | Phase 14+        | DevOps      | Multi-region failover + anomaly detection    |

For v1.3 production readiness, **Tier 1 must be complete before Phase 13**.

---

## Related Documentation

- **Continuous Monitoring Guide:** `docs/CLOUD_LOGS_CONTINUOUS_MONITORING.md`
  - Setup instructions, escalation workflows, SLO targets, troubleshooting
- **Incident Runbook:** `docs/CLOUD_LOGS_MONITORING_REPORT_v1.3.md`
  - Detailed incident response, error diagnosis, remediation steps
- **Quick Reference:** `docs/CLOUD_LOGS_QUICK_REFERENCE.md`
  - Command cheat sheet for on-call engineer

---

**Checklist Version:** v1.3  
**Last Updated:** 2026-05-07  
**Status:** Ready for execution
