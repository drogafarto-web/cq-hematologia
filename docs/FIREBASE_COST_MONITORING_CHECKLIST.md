# Firebase Cost Monitoring Checklist

**Project:** HC Quality CQ Labclin  
**Audience:** DevOps · Finance · CTO  
**Update Frequency:** Weekly (Friday 10:00 UTC)  
**Last Updated:** 2026-05-07

---

## Quick Start (5 minutes)

### Step 1: Access Google Cloud Console

```bash
# Login to Google Cloud Console
open https://console.cloud.google.com/billing/projects/hmatologia2

# Or via gcloud CLI
gcloud config set project hmatologia2
gcloud billing accounts list
gcloud billing accounts describe $(gcloud billing accounts list --format='value(name)')
```

### Step 2: Navigate to Billing Dashboard

1. Click **Billing** (left sidebar)
2. Select project **`hmatologia2`**
3. View **Cost Overview** for current month (Updated daily, ~12:00 PM UTC)
4. Cross-check with **Budgets & Alerts** tab

### Step 3: Set Alert (One-time)

```bash
# Create budget alert at $50/month (80% of $50 budget)
gcloud billing budgets create \
  --billing-account=$(gcloud billing accounts list --format='value(name)') \
  --display-name="HC Quality Phase 3 Cost Alert" \
  --budget-amount=50 \
  --threshold-rule=percent=80 \
  --alert-pubsub-topic=projects/hmatologia2/topics/billing-alert
```

---

## Weekly Monitoring Checklist (15 minutes)

Every Friday 10:00 UTC:

```markdown
## Week of [DATE]

### 1. Cost Summary
- [ ] Firestore: $____ (target range $0.33–$0.50)
- [ ] Cloud Functions: $____ (target $4–$12)
- [ ] Cloud Storage: $____ (target $3–$5)
- [ ] SMS (Twilio): $____ (target $0–$5)
- [ ] Total: $____ (target $15–$25 Phase 3, $75–$100 Phase 12)

### 2. Firestore Metrics
- [ ] Reads/day: __________ (baseline 500k → Phase 3 target 575k)
- [ ] Writes/day: __________ (baseline 50k → Phase 3 target 55k)
- [ ] Storage: __________ GB (baseline 15 GB, Phase 3 target 16.5 GB)
- [ ] Index count: __________ (baseline 42, Phase 3 target 50)
- **Alert if:** Reads spike >750k/day OR storage >20 GB OR writes >75k/day

### 3. Cloud Functions
- [ ] Invocations/day: __________ (Phase 3 target +25k/day)
- [ ] Failed functions: __________ (target 0)
- [ ] Timeout errors: __________ (target 0)
- [ ] Max function duration: __________ ms (target <10s for all except Puppeteer)
- **Alert if:** >5 timeout errors OR >1% failure rate

### 4. Cloud Storage
- [ ] Bucket size: __________ GB
  - App data: __________ GB (target +0.5 GB Phase 3)
  - Backups: __________ GB (target 165 GB, monthly rotation)
- **Alert if:** >30 GB OR backup not running

### 5. Twilio SMS
- [ ] SMS sent this week: __________ (Phase 3 target 30, Phase 6 target 200)
- [ ] Cost: $__________ (Phase 3 target <$1/week)
- **Alert if:** >200 SMS/week OR cost >$50/month

### 6. Performance Metrics
- [ ] Web Vitals LCP: __________ ms (target <2500 ms)
- [ ] Web Vitals CLS: __________ (target <0.1)
- [ ] Cloud Functions P95 latency: __________ ms
- **Alert if:** LCP >3000 ms OR CLS >0.15

### 7. Risk Check
- [ ] No secrets in `PENDING_SET_*` state
- [ ] No orphaned functions/indexes
- [ ] No leaked credentials in logs
- [ ] Cloud Logs errors: __________ (target 0)

### Notes & Action Items
- [ ] Any anomalies found? Document below:
  ```
  [Notes]
  ```
- [ ] Action items for next week?
  ```
  [Actions]
  ```
```

---

## Cost Anomaly Troubleshooting

### Scenario 1: Firestore reads spike >750k/day

**Likely causes:**
1. Analytics polling at 10s interval instead of 30s (most common)
2. New module with unoptimized queries (N+1 queries)
3. DDoS / spider bots crawling portal links
4. Scheduled function stuck in retry loop

**Debug steps:**

```bash
# 1. Check Cloud Logs for analytics queries
gcloud logging read "resource.type=cloud_function AND protoPayload.methodName=google.firestore.v1.Firestore.RunQuery" \
  --limit 100 --format json | jq '.[] | select(.severity=="ERROR") | .protoPayload.request'

# 2. Check client-side polling interval
# Look at browser DevTools Network tab > XHR requests to `/analytics/*`
# Should see 1 request per 30 seconds per tab

# 3. If spike correlates with scheduled function:
gcloud functions describe <function-name> --format='value(sourceUploadUrl, status, updateTime)'

# 4. Check for N+1 queries in Cloud Logs
gcloud logging read "resource.type=cloud_function AND protoPayload.request.query" \
  --limit 1000 | grep -E "runs|insumos|lots" | wc -l
```

**Mitigation:**
- Increase polling interval from 30s → 60s (halves reads)
- Batch queries: instead of `for each run in runs { query events }`, do `collectionGroup query once`
- Implement client-side caching (localStorage + TTL)
- Check for crawlers: `gcloud logging read "httpRequest.userAgent" --limit 1000 | grep -iE "bot|crawler|spider"`

---

### Scenario 2: Cloud Functions cost spike $8→$20/month

**Likely causes:**
1. New Puppeteer function generating many PDFs (each: 512 MiB, 5s = high GiB-seconds)
2. Scheduled function invocation frequency increased
3. Memory allocation bumped without necessity

**Debug steps:**

```bash
# 1. List all functions with memory + timeout
gcloud functions list --format='table(name, memory, timeout, sourceUploadUrl)' | sort -k2 -rn

# 2. Get GiB-seconds for past 7 days
gcloud monitoring read --start-relative-duration 604800s \
  "resource.type=cloud_function AND metric.type=cloudfunctions.googleapis.com/function_execution_times" \
  --format=json | jq '.[] | {name: .resource.labels.function_name, memory_mb: .metric.labels.memory_mb, duration_ms: .points[0].value}'

# 3. Check for Puppeteer invocations
gcloud logging read "resource.type=cloud_function AND jsonPayload.function=~generatePatientLaudo.*" \
  --limit 100 --format json | jq '.[] | {timestamp: .timestamp, duration: .httpRequest.latency, status: .httpRequest.status}' | tail -20
```

**Mitigation:**
- Defer Puppeteer to Phase 5 (if causing spike now)
- Reduce memory from 512 → 256 MiB for callables (auto-scales)
- Implement PDF caching: store rendered PDFs in Cloud Storage, serve from cache if <24h old
- Batch PDF generation: queue into Pub/Sub, process 1 per minute instead of on-demand

---

### Scenario 3: SMS bill $3.75→$15/month (4x spike)

**Likely causes:**
1. Críticos escalation triggered for every analyte in every run (not just true critical values)
2. Test data in production (batch SMS during testing)
3. Twilio webhook misconfigured, sending duplicates

**Debug steps:**

```bash
# 1. Check escalation logic
gcloud logging read "resource.type=cloud_function AND jsonPayload.function=escalateNormalityValues" \
  --limit 100 --format json | jq '.[] | {timestamp: .timestamp, analito: .jsonPayload.analito, valor: .jsonPayload.valor, escalated: .jsonPayload.escalated}'

# 2. Count SMS by hour (identify spike window)
gcloud logging read "resource.type=cloud_function AND jsonPayload.sms_sent=true" \
  --limit 1000 --format json | jq '.[] | .timestamp' | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c

# 3. Check for duplicates (same analito + valor sent twice in <1 min)
gcloud logging read "resource.type=cloud_function AND jsonPayload.function=escalateNormalityValues" \
  --limit 1000 --format json | jq -s 'group_by(.jsonPayload.analito) | map(select(length > 1))'
```

**Mitigation:**
- Add 1-hour cooldown per analyte (don't re-alert if alert sent in last 60 min)
- Validate critical values against Westgard rules BEFORE escalating (prevent false positives)
- Test escalation in staging only; use test Twilio account for dev
- Check Twilio webhook logs: `https://console.twilio.com → Programmable SMS → Logs`

---

### Scenario 4: Storage bill $3.63→$10/month (unexpected spike)

**Likely causes:**
1. Firestore backups accumulating (should auto-delete after 30 days)
2. IA dataset images not being cleaned up
3. Portal PDF cache never expires

**Debug steps:**

```bash
# 1. List all GCS buckets and sizes
gsutil du -s -h gs://hmatologia2.appspot.com/
gsutil du -s -h gs://hmatologia2-backups/ (if separate bucket)

# 2. Find largest objects
gsutil ls -rh -L gs://hmatologia2.appspot.com/ | head -50

# 3. Check backup retention policy
gsutil lifecycle get gs://hmatologia2-backups/

# 4. Get IA dataset folder size
gsutil du -s -h gs://hmatologia2.appspot.com/labs/labclin-riopomba/imuno-ias-dev/
```

**Mitigation:**
- Set lifecycle policy: **delete objects >90 days old** (automatic)
- Cap IA dataset at 1 GB; delete images below accuracy threshold
- Implement portal PDF cache expiry: delete rendered PDFs >24h old
- Monitor with alert: notify if bucket grows >25 GB

---

## Monthly Cost Review Template

**Run on last Friday of month:**

```markdown
# Firebase Cost Review — [MONTH YEAR]

## Summary
- **Total cost:** $______
- **Budget:** $50 (Phase 3) / $100 (Phase 12)
- **Variance:** ±_____% (target: ±10%)
- **Month-over-month:** $___ (+/- from last month)

## Breakdown
| Service | Target | Actual | Variance | OK? |
|---------|--------|--------|----------|-----|
| Firestore | $0.50 | $____ | ___% | ☐ |
| Functions | $8 | $____ | ___% | ☐ |
| Storage | $3.63 | $____ | ___% | ☐ |
| SMS | $3.75 | $____ | ___% | ☐ |
| Monitoring | $2.50 | $____ | ___% | ☐ |
| **Total** | **$18.38** | **$____** | **____%** | **☐** |

## Anomalies Found
- ☐ None
- ☐ Yes, describe: _____

## Actions Taken
1. ______
2. ______
3. ______

## Forecast (next 3 months)
- June: $____
- July: $____
- August: $____

## Approval
- [ ] CTO sign-off
- [ ] Finance sign-off
- [ ] Escalations (if >15% variance): _____

**Reviewed by:** ___________  
**Date:** ___________
```

---

## Annual Budget Projection

**Year 1 (May 2026 – Apr 2027):**

```
Month    Phase   Cost    Cumulative   Status
─────────────────────────────────────────────
May      0b      $18     $18          v1.3 + Phase 0b
June     3.1     $22     $40          Portal init
July     3.2     $27     $67          IA foundation
August   4–5     $35     $102         CAPA closure
September 6–7    $45     $147         Críticos + feedback
October  8–9     $65     $212         NOTIVISA pilot
November 10–11   $75     $287         Multi-equipment
December 12–14   $85     $372         Launch prep
Jan–Apr  Post-launch $95 x4  $752     v1.4 LIVE (steady state)

YEAR 1 TOTAL: $752 USD (avg $62.67/month)
```

**Recommend annual budget: $1,000 USD (25% contingency buffer)**

---

## Automation Script (Optional)

**Weekly cost fetch (bash):**

```bash
#!/bin/bash
# usage: ./weekly-cost-report.sh

PROJECT_ID="hmatologia2"
BILLING_ACCOUNT=$(gcloud billing accounts list --format='value(name)')

echo "=== Firebase Cost Report: $(date +%Y-%m-%d) ==="
echo ""
echo "Firestore Storage:"
gcloud logging read "resource.type=cloud_firestore_database" \
  --limit 1000 --format='table(jsonPayload.response.bytes)' | awk '{sum+=$1} END {print sum/1024/1024/1024 " GB"}'

echo ""
echo "Recent Functions (last 7 days):"
gcloud functions list --format='table(name, memory, runtime)' | head -10

echo ""
echo "Billing Summary:"
gcloud billing accounts describe "$BILLING_ACCOUNT" \
  --format='table(displayName, masterBillingAccount.currencyCode, billingAccountId)'

echo ""
echo "Next scheduled cost review: Next Friday 10:00 UTC"
```

---

## External Monitoring (Recommended)

### Option 1: Google Cloud Cost Management (Free)

- **URL:** https://console.cloud.google.com/billing/budgets
- **Setup time:** 15 min
- **Cost:** Free
- **Monitoring:** Daily snapshots, alerts at 50% / 80% / 100%

### Option 2: Third-party Cloud Cost Tool (Optional)

- **Kubecost** ($500–5k/year) — multi-cloud cost allocation
- **Cloudlytics** ($30–100/month) — tailored Firebase dashboards
- **Only needed if:** >20 GCP projects or multi-cloud strategy

**Recommendation for HC Quality:** **Use native GCP console** (free, sufficient for single project).

---

## Escalation Path

**If costs exceed budget:**

1. **Week 1:** DevOps investigates anomaly (see troubleshooting guide above)
2. **Week 2:** CTO + Finance review findings + approve mitigation
3. **Week 3:** Implement fix (code changes / config tuning)
4. **Week 4:** Verify cost normalized; update forecast

**If cost spike is customer-driven (e.g., new lab with 10x higher usage):**
- Negotiate higher SaaS fee (from $99 → $199/month)
- Implement rate-limiting per lab
- Add on-demand pricing tier (e.g., $0.05 per 1k reads for power users)

---

## Version History

| Ver | Date | Author | Changes |
|-----|------|--------|---------|
| 1.0 | 2026-05-07 | Claude Agent | Initial monitoring checklist + troubleshooting |

**Next review:** 2026-06-07  
**Owner:** DevOps + Finance
