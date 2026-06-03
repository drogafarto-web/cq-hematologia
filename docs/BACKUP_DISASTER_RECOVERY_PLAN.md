# Backup & Disaster Recovery Plan — HC Quality (hmatologia2)

**Document ID:** BDR-001  
**Version:** 1.0  
**Effective Date:** 2026-05-07  
**Next Review:** 2027-05-07 (annual)  
**Owner:** CTO · DevOps  
**Classification:** DICQ 4.2 + RDC 978 Art. 115 (Backup & Retenção de Dados)

---

## Executive Summary

HC Quality implements a multi-layered backup and disaster recovery strategy to ensure regulatory compliance (RDC 978 Art. 115, DICQ 4.2, LGPD Art. 12) and business continuity. This plan covers **retention policies, backup automation, point-in-time recovery (PITR), testing protocols, and monitoring**.

**System Scope:** Production SaaS (hmatologia2.web.app)  
**Criticality:** Patient data, audit trails, regulatory documents  
**Backup Strategy:** Daily automated + manual on-demand  
**RPO (Recovery Point Objective):** < 24 hours  
**RTO (Recovery Time Objective):** 2-4 hours (by scenario)

---

## 1. Retention Policy (RDC 978 Art. 115 + DICQ 4.2)

### 1.1 Data Classification & Retention

| Data Category                                 | Retention Period                   | Soft Delete Grace      | Archive               | Legal Basis                     |
| --------------------------------------------- | ---------------------------------- | ---------------------- | --------------------- | ------------------------------- |
| **Laudos** (patient results)                  | 5 years (+ 6mo grace)              | Yes (soft_delete flag) | GCS Nearline after 1y | RDC 978 Art. 115 + ISO 15189    |
| **NOTIVISA Events** (adverse events)          | 10 years                           | No (immutable log)     | GCS Coldline after 3y | RDC 1377/2013 + ANVISA          |
| **Audit Trail** (write intent + read consent) | 5 years                            | No (append-only)       | GCS Nearline after 2y | RDC 978 Art. 119 + LGPD Art. 12 |
| **CIQ Runs** (control quality)                | 5 years                            | Yes                    | Nearline after 1y     | ISO 15189 + CLSI                |
| **DICQ Documents** (MQ/PQ/IT/FR/POL)          | Duration + 5 years                 | No (versionable)       | Nearline after 2y     | DICQ 4.3                        |
| **POPs** (Standard Procedures)                | Current + 5 years                  | No (versionable)       | Nearline after 2y     | DICQ 4.3 + RDC 979              |
| **Treinamento Records**                       | 5 years (after employee departure) | No (audit trail)       | Nearline after 3y     | RDC 978 Art. 122 + NR-1         |
| **Draft / Incomplete docs**                   | 30 days                            | Yes (auto-cleanup)     | —                     | Operational                     |
| **Login / Session Logs**                      | 1 year                             | No (audit)             | Coldline after 6mo    | Security + LGPD Art. 12         |
| **Error / System Logs**                       | 90 days                            | No                     | —                     | Operational diagnostics         |

**Immutable collections:** `auditLogs`, `notivisaEvents`, `treinamentos` — never soft-delete; archive via export only.

**Soft-delete process (RN-06 — HC Quality standard):**

```typescript
// Service layer always uses softDelete* methods
softDeleteLaudo(labId, laudoId) {
  return firestore.doc(`labs/${labId}/laudos/${laudoId}`)
    .update({ deletadoEm: now(), deletadoPor: operatorId })
}

// Soft-deleted docs remain queryable (filtered out in UI)
// Hard purge after 5-year retention via scheduled Cloud Function
```

---

### 1.2 Cleanup Schedule

| Task                          | Frequency                  | Action                                                        | Owner                                 |
| ----------------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| **Auto-delete drafts**        | Daily (3 AM UTC)           | Delete docs with `status: draft` AND `criadoEm < 30 days ago` | Cloud Function `cleanup-drafts`       |
| **Archive soft-deleted (1y)** | Weekly (Sunday 2 AM UTC)   | Export soft-deleted laudos/runs to GCS Nearline               | Cloud Function `archive-soft-deleted` |
| **Purge expired (5y+6mo)**    | Monthly (1st day 1 AM UTC) | Hard-delete laudos with `deletadoEm < 5.5 years ago`          | Cloud Function `purge-expired`        |
| **Audit log archival (2y)**   | Quarterly (1st day)        | Export auditLogs older than 2y to GCS Coldline                | Cloud Function `archive-audit-logs`   |
| **Backup rotation**           | Weekly                     | Delete GCS backups older than 7 years                         | `backup-rotate.sh` script             |

---

## 2. Backup Strategy

### 2.1 Backup Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Firestore                     │
│                   (hmatologia2 project)                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┴────────┬──────────────┐
         │                  │              │
    ┌────▼──────┐  ┌────────▼──┐  ┌──────▼──────┐
    │   Daily   │  │  Weekly   │  │  Monthly   │
    │   Full    │  │   Diff    │  │  Snapshot  │
    │ Backup    │  │ Backup    │  │  (Cold)    │
    │ (GCS      │  │ (GCS      │  │ (GCS       │
    │ Standard) │  │ Standard) │  │ Coldline)  │
    └────┬──────┘  └────┬──────┘  └──────┬──────┘
         │              │              │
         └──────────────┴──────────────┘
                  │
         ┌────────▼────────┐
         │  GCS Buckets:   │
         │  - gs://hc-     │
         │    quality-     │
         │    backups/     │
         │  - gs://hc-     │
         │    quality-     │
         │    archives/    │
         └─────────────────┘
                  │
         ┌────────▼────────┐
         │  Retention:     │
         │  - 7 years      │
         │  (full backup)  │
         │  - Locked via   │
         │    GCS policy   │
         └─────────────────┘
```

### 2.2 Backup Tiers

#### Tier 1: Daily Full Backup (24h)

- **Frequency:** Daily at 00:00 UTC (off-peak)
- **Type:** Full Firestore export
- **Storage:** `gs://hc-quality-backups/daily/`
- **Retention:** 30 days (7 full backups + 7 incremental)
- **RTO:** 30-60 min
- **RPO:** < 24 hours

**Trigger:** Cloud Scheduler → Cloud Function `backup-daily`

```bash
# Manual trigger
gcloud scheduler jobs update backup-daily \
  --project=hmatologia2 \
  --execute-now
```

#### Tier 2: Weekly Incremental Backup (7 days)

- **Frequency:** Every Sunday at 02:00 UTC
- **Type:** Delta from previous daily backup
- **Storage:** `gs://hc-quality-backups/weekly/`
- **Retention:** 12 weeks (3 months rolling)
- **RTO:** 2-4 hours (requires daily + weekly assembly)
- **RPO:** < 7 days

**Trigger:** Cloud Scheduler → Cloud Function `backup-weekly`

#### Tier 3: Monthly Snapshot (Cold Storage)

- **Frequency:** 1st of month at 03:00 UTC
- **Type:** Full snapshot → GCS Coldline (frozen)
- **Storage:** `gs://hc-quality-archives/monthly/`
- **Retention:** 7 years (compliance)
- **RTO:** 4-8 hours (requires restore from cold tier)
- **RPO:** < 1 month

**Trigger:** Cloud Scheduler → Cloud Function `backup-monthly`

### 2.3 Point-in-Time Recovery (PITR)

**Window:** 35 days (GCP Firestore managed backups)

**Recovery options:**

- **Within 24h:** Use daily backup (fastest, < 30 min)
- **Within 7d:** Use daily + weekly delta (30-60 min)
- **Within 35d:** Use GCP managed backup (automated, 1-2h)
- **Beyond 35d:** Use monthly archive from GCS Coldline (4-8h + thaw time)

---

## 3. Backup Implementation

### 3.1 GCS Bucket Setup

```bash
# Create backup bucket (standard tier, 30-day retention)
gsutil mb -p hmatologia2 -l southamerica-east1 gs://hc-quality-backups/

# Set retention policy (undelete-able, immutable for 7 years = 2557 days)
gsutil retention set 2557d gs://hc-quality-backups/

# Create archive bucket (coldline tier, 7-year retention)
gsutil mb -p hmatologia2 -l southamerica-east1 -c COLDLINE gs://hc-quality-archives/

gsutil retention set 2557d gs://hc-quality-archives/

# Enable versioning (prevent accidental deletion)
gsutil versioning set on gs://hc-quality-backups/
gsutil versioning set on gs://hc-quality-archives/

# Lifecycle rule: Standard → Nearline after 1 year, Coldline after 3 years
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 365}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 1095}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://hc-quality-backups/
gsutil lifecycle set lifecycle.json gs://hc-quality-archives/
```

### 3.2 Cloud Scheduler Jobs

#### Job: backup-daily

```bash
# Create daily backup scheduler
gcloud scheduler jobs create app-engine backup-daily \
  --project=hmatologia2 \
  --schedule="0 0 * * *" \
  --timezone="Etc/UTC" \
  --http-method=POST \
  --uri="https://southamerica-east1-hmatologia2.cloudfunctions.net/backup-daily" \
  --oidc-service-account-email=scheduler@hmatologia2.iam.gserviceaccount.com \
  --oidc-token-audience="https://southamerica-east1-hmatologia2.cloudfunctions.net/backup-daily"
```

#### Job: backup-weekly

```bash
gcloud scheduler jobs create app-engine backup-weekly \
  --project=hmatologia2 \
  --schedule="0 2 * * 0" \
  --timezone="Etc/UTC" \
  --http-method=POST \
  --uri="https://southamerica-east1-hmatologia2.cloudfunctions.net/backup-weekly" \
  --oidc-service-account-email=scheduler@hmatologia2.iam.gserviceaccount.com \
  --oidc-token-audience="https://southamerica-east1-hmatologia2.cloudfunctions.net/backup-weekly"
```

#### Job: backup-monthly

```bash
gcloud scheduler jobs create app-engine backup-monthly \
  --project=hmatologia2 \
  --schedule="0 3 1 * *" \
  --timezone="Etc/UTC" \
  --http-method=POST \
  --uri="https://southamerica-east1-hmatologia2.cloudfunctions.net/backup-monthly" \
  --oidc-service-account-email=scheduler@hmatologia2.iam.gserviceaccount.com \
  --oidc-token-audience="https://southamerica-east1-hmatologia2.cloudfunctions.net/backup-monthly"
```

### 3.3 Cloud Functions (Backup Orchestrators)

Deploy to `functions/src/backups/`:

#### `backup-daily.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({ projectId: 'hmatologia2' });
const firestore = admin.firestore();

export const backupDaily = functions.https.onRequest(async (req, res) => {
  try {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const outputUri = `gs://hc-quality-backups/daily/firestore-${timestamp}`;

    // Trigger Firestore export
    await firestore.bulkWriter().close();
    const [operation] = await admin.firestore().makeBackupOperation(outputUri);

    functions.logger.info(`Backup started: ${outputUri}`, { operation: operation.name });

    res.json({ status: 'initiated', uri: outputUri, operation: operation.name });
  } catch (error) {
    functions.logger.error('Backup failed', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### `backup-weekly.ts`

```typescript
export const backupWeekly = functions.https.onRequest(async (req, res) => {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const outputUri = `gs://hc-quality-backups/weekly/firestore-${timestamp}`;

    // Same as daily, but stored in different path
    const [operation] = await admin.firestore().makeBackupOperation(outputUri);
    functions.logger.info(`Weekly backup: ${outputUri}`);

    res.json({ status: 'initiated', uri: outputUri });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### `backup-monthly.ts`

```typescript
export const backupMonthly = functions.https.onRequest(async (req, res) => {
  try {
    const date = new Date();
    const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    const outputUri = `gs://hc-quality-archives/monthly/firestore-${timestamp}`;

    // Export to coldline (archive tier)
    const [operation] = await admin.firestore().makeBackupOperation(outputUri);

    // Transition to coldline after upload completes
    const bucket = storage.bucket('hc-quality-archives');
    await bucket.setStorageClass('COLDLINE');

    functions.logger.info(`Monthly archive: ${outputUri}`);
    res.json({ status: 'initiated', uri: outputUri, tier: 'COLDLINE' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### `backup-verify.ts` (post-backup validation)

```typescript
export const backupVerify = functions.https.onRequest(async (req, res) => {
  try {
    const backupUri = req.body.uri; // gs://bucket/path
    const bucket = new Storage().bucket(backupUri.split('/')[2]);
    const files = await bucket.getFiles();

    const stats = {
      uri: backupUri,
      fileCount: files[0].length,
      totalSize: files[0].reduce((sum, f) => sum + (f.metadata.size || 0), 0),
      timestamp: new Date().toISOString(),
      status: files[0].length > 0 ? 'verified' : 'failed',
    };

    functions.logger.info('Backup verified', stats);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 4. Restore Procedures

### 4.1 Restore from Daily Backup (RTO: 30-60 min)

```bash
#!/bin/bash
# restore-from-daily.sh
# Usage: ./restore-from-daily.sh YYYY-MM-DD [staging|prod]

set -e

BACKUP_DATE=${1:-$(date -d "yesterday" +%Y-%m-%d)}
TARGET_ENV=${2:-staging}
BACKUP_URI="gs://hc-quality-backups/daily/firestore-${BACKUP_DATE}"
TARGET_PROJECT="hmatologia2-${TARGET_ENV}"

echo "[1/5] Verifying backup exists..."
gsutil ls "${BACKUP_URI}" || { echo "Backup not found"; exit 1; }

echo "[2/5] Stopping writes to ${TARGET_PROJECT}..."
gcloud functions delete firestore-write-callable \
  --project="${TARGET_PROJECT}" \
  --quiet || true

echo "[3/5] Importing backup to ${TARGET_PROJECT}..."
gcloud firestore import "${BACKUP_URI}" \
  --async \
  --project="${TARGET_PROJECT}"

echo "[4/5] Waiting for import to complete (this may take 1-2 hours)..."
while true; do
  STATUS=$(gcloud firestore operations list \
    --project="${TARGET_PROJECT}" \
    --filter="operationType:IMPORT" \
    --limit=1 \
    --format="value(done)")
  if [[ "$STATUS" == "True" ]]; then
    echo "Import completed!"
    break
  fi
  echo "Still importing... (checking every 30s)"
  sleep 30
done

echo "[5/5] Restored from ${BACKUP_URI} to ${TARGET_PROJECT}"
echo "Next: verify data + re-enable functions"
```

### 4.2 Restore from Monthly Archive (RTO: 4-8 hours)

```bash
#!/bin/bash
# restore-from-archive.sh
# Usage: ./restore-from-archive.sh 2026-05 [staging|prod]

set -e

ARCHIVE_DATE=${1}
TARGET_ENV=${2:-staging}
ARCHIVE_URI="gs://hc-quality-archives/monthly/firestore-${ARCHIVE_DATE}-01"
TARGET_PROJECT="hmatologia2-${TARGET_ENV}"

echo "[1/4] Thawing coldline archive (may take 24h)..."
gsutil rewrite -s STANDARD "${ARCHIVE_URI}/**" || \
  { echo "Archive still in transition. Try again in 1h"; exit 1; }

echo "[2/4] Verifying restored files..."
gsutil du -s "${ARCHIVE_URI}"

echo "[3/4] Importing to ${TARGET_PROJECT}..."
gcloud firestore import "${ARCHIVE_URI}" \
  --async \
  --project="${TARGET_PROJECT}"

echo "[4/4] Waiting for import (1-2 hours)..."
while true; do
  STATUS=$(gcloud firestore operations list --project="${TARGET_PROJECT}" --limit=1 --format="value(done)")
  [[ "$STATUS" == "True" ]] && break
  sleep 60
done

echo "Restore from archive complete!"
```

### 4.3 Point-in-Time Recovery (PITR)

```bash
#!/bin/bash
# pitr-restore.sh
# Usage: ./pitr-restore.sh 2026-05-07T15:30:00Z staging

set -e

TIMESTAMP=$1
TARGET_ENV=${2:-staging}
TARGET_PROJECT="hmatologia2-${TARGET_ENV}"

echo "Restoring Firestore to ${TIMESTAMP} in ${TARGET_PROJECT}..."

gcloud firestore restore-backup \
  --backup-name="projects/hmatologia2/locations/us/backups/${TIMESTAMP}" \
  --async \
  --project="${TARGET_PROJECT}"

echo "PITR initiated. Monitoring..."
gcloud firestore operations list \
  --project="${TARGET_PROJECT}" \
  --filter="operationType:IMPORT" \
  --format="table(name,done,progressPercent)"
```

---

## 5. Verification & Validation

### 5.1 Chain-Hash Verification (Post-Restore)

```bash
#!/bin/bash
# verify-chain-hash.sh
# Sample 100 documents and verify LogicalSignature integrity

set -e

PROJECT=$1
SAMPLE_SIZE=100

echo "Verifying chain-hash integrity in ${PROJECT}..."

# Export laudos to JSON
gcloud firestore export gs://hc-quality-backups/verify-${RANDOM} \
  --async \
  --project="${PROJECT}"

# Verify 100 random docs
gcloud firestore query laudos \
  --project="${PROJECT}" \
  --limit="${SAMPLE_SIZE}" \
  --format=json | jq -r '.[] | select(.chainHash != null) | .chainHash' > /tmp/hashes.txt

echo "Sampled ${SAMPLE_SIZE} documents."
echo "Chain-hash verification results:"

VALID=0
TOTAL=$(wc -l < /tmp/hashes.txt)

while IFS= read -r hash; do
  # Verify hash is 64-char hex string
  if [[ $hash =~ ^[a-f0-9]{64}$ ]]; then
    ((VALID++))
  fi
done < /tmp/hashes.txt

echo "Valid hashes: ${VALID}/${TOTAL} ($(( VALID * 100 / TOTAL ))%)"

if [[ $VALID -lt $(( TOTAL * 95 / 100 )) ]]; then
  echo "ALERT: Less than 95% hashes valid!"
  exit 1
fi

echo "Chain-hash verification PASSED"
```

### 5.2 Smoke Tests (Post-Restore)

```bash
#!/bin/bash
# smoke-tests.sh
# Basic functionality checks after restore

set -e

PROJECT=$1

echo "Running smoke tests in ${PROJECT}..."

# Test 1: Can read hub
echo -n "Hub loads: "
curl -s "https://${PROJECT}.web.app/api/health" | jq .status || echo "FAIL"

# Test 2: Document counts match
echo -n "Document counts: "
PROD_COUNT=$(gcloud firestore stat --project=hmatologia2 --format="value(totalCount)")
RESTORED_COUNT=$(gcloud firestore stat --project="${PROJECT}" --format="value(totalCount)")

if [[ "$PROD_COUNT" == "$RESTORED_COUNT" ]]; then
  echo "PASS (${PROD_COUNT} docs)"
else
  echo "FAIL (prod: ${PROD_COUNT}, restored: ${RESTORED_COUNT})"
  exit 1
fi

# Test 3: Audit trail readable
echo -n "Audit trail: "
COUNT=$(gcloud firestore query auditLogs --project="${PROJECT}" --limit=1 | wc -l)
[[ $COUNT -gt 0 ]] && echo "PASS" || echo "FAIL"

echo "Smoke tests completed!"
```

---

## 6. Monitoring & Alerting

### 6.1 Backup Monitoring Dashboard

Create Cloud Monitoring dashboard (`docs/terraform/backup-dashboard.tf`):

```terraform
resource "google_monitoring_dashboard" "backup_status" {
  project        = "hmatologia2"
  dashboard_json = jsonencode({
    displayName = "Backup & DR Status"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Last Daily Backup"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"cloudfunctions.googleapis.com/execution_count\" resource.label.function_name=\"backup-daily\""
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "GCS Backup Size"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"storage.googleapis.com/total_bytes\" resource.label.bucket_name=\"hc-quality-backups\""
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Firestore Size"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"firestore.googleapis.com/instance/network_sent_bytes\" resource.label.project_id=\"hmatologia2\""
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Backup Success Rate"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloud_function\" metric.type=\"cloudfunctions.googleapis.com/execution_count\" resource.label.function_name=~\"backup-.*\""
                }
              }
            }
          }
        }
      ]
    }
  })
}
```

### 6.2 Alerts

```bash
# Alert: Backup failed
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="Backup Daily Failed" \
  --condition-display-name="backup-daily execution errors > 0" \
  --condition-threshold-value=0 \
  --condition-threshold-filter='resource.type="cloud_function" AND resource.labels.function_name="backup-daily" AND metric.type="cloudfunctions.googleapis.com/execution_count" AND metric.labels.status="error"'

# Alert: Firestore size anomaly (>10% growth in 1h)
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="Firestore Growth Anomaly" \
  --condition-display-name="Firestore size spike" \
  --condition-threshold-value=1000000000 \
  --condition-threshold-filter='resource.type="firestore_instance" AND metric.type="firestore.googleapis.com/instance/network_sent_bytes"'
```

---

## 7. Testing & Validation Schedule

### 7.1 Monthly Restore Test

**Purpose:** Validate that backups are restorable and complete.  
**Frequency:** 1st Friday of each month (off-peak).  
**Duration:** 2-3 hours  
**Approval:** CTO sign-off required

**Procedure:**

```bash
#!/bin/bash
# backup-test-monthly.sh
# Full restore validation test

set -e

TEST_DATE=$(date +%Y-%m-%d)
LOG_FILE="docs/DR_RESTORE_TEST_${TEST_DATE}.md"

echo "# Monthly Backup Restore Test — ${TEST_DATE}" > "${LOG_FILE}"

# Step 1: Select backup
BACKUP_DATE=$(date -d "2 weeks ago" +%Y-%m-%d)
BACKUP_URI="gs://hc-quality-backups/daily/firestore-${BACKUP_DATE}"

echo "Testing backup: ${BACKUP_URI}"
echo "- Backup Date: ${BACKUP_DATE}" >> "${LOG_FILE}"

# Step 2: Restore to staging
echo "Restoring to staging project..."
gcloud firestore import "${BACKUP_URI}" \
  --async \
  --project=hmatologia2-staging

# Wait for completion
while true; do
  STATUS=$(gcloud firestore operations list --project=hmatologia2-staging --limit=1 --format="value(done)")
  [[ "$STATUS" == "True" ]] && break
  sleep 60
done

echo "- Restore Status: PASSED" >> "${LOG_FILE}"

# Step 3: Chain-hash verification
VALID=$(gcloud firestore query laudos --project=hmatologia2-staging --limit=100 --format=json | \
  jq '[.[] | select(.chainHash =~ "^[a-f0-9]{64}$")] | length')

echo "- Chain-hash Valid: ${VALID}/100" >> "${LOG_FILE}"

# Step 4: Document count check
STAGING_COUNT=$(gcloud firestore stat --project=hmatologia2-staging --format="value(totalCount)")
PROD_COUNT=$(gcloud firestore stat --project=hmatologia2 --format="value(totalCount)")

echo "- Document Count Prod: ${PROD_COUNT}" >> "${LOG_FILE}"
echo "- Document Count Staging: ${STAGING_COUNT}" >> "${LOG_FILE}"

# Step 5: Smoke tests
./scripts/smoke-tests.sh hmatologia2-staging >> "${LOG_FILE}"

# Step 6: Summary
if [[ $VALID -gt 95 ]] && [[ "$STAGING_COUNT" -gt 0 ]]; then
  echo "## Result: PASSED ✓" >> "${LOG_FILE}"
  echo "All validation checks completed successfully."
else
  echo "## Result: FAILED ✗" >> "${LOG_FILE}"
  exit 1
fi

echo "Test report saved to ${LOG_FILE}"
```

### 7.2 Quarterly DR Drill

**Scope:** Simulate full disaster scenario (corruption + restore).  
**Frequency:** Q1, Q2, Q3, Q4 (quarterly).  
**Team:** CTO, Tech Lead, DevOps  
**Duration:** 4 hours

**Scenario checklist:**

- [ ] Declare incident (Slack #incident)
- [ ] Identify clean backup (timestamp recorded)
- [ ] Isolate production (disable functions)
- [ ] Restore to staging (30-90 min)
- [ ] Validate restored data (30 min)
- [ ] Restore to production (30-90 min)
- [ ] Re-enable functions + API (10 min)
- [ ] Final validation + chain-hash check (30 min)
- [ ] Document findings + debrief (30 min)

### 7.3 Annual Compliance Audit

**RDC 978 Art. 115 + DICQ 4.2 requirements:**

- [ ] Backup retention policy document current (5 years + 6mo grace)
- [ ] GCS retention locks verified (immutable for 7 years)
- [ ] All backup tiers operational (daily, weekly, monthly)
- [ ] PITR window tested (35-day window validated)
- [ ] Restore procedures tested end-to-end
- [ ] Chain-hash verification passed (100+ samples)
- [ ] Alerts configured + monitored
- [ ] Team trained on runbooks
- [ ] Incident playbooks up-to-date
- [ ] Compliance evidence archived

---

## 8. Operational Runbooks

### 8.1 Check Backup Status

```bash
#!/bin/bash
# check-backup-status.sh

echo "=== Backup Status Report ==="
echo

echo "Last 5 daily backups:"
gsutil ls -L gs://hc-quality-backups/daily/ | tail -10

echo
echo "Last 3 weekly backups:"
gsutil ls -L gs://hc-quality-backups/weekly/ | tail -6

echo
echo "GCS Backup Bucket Size:"
gsutil du -sh gs://hc-quality-backups/

echo
echo "GCS Archive Bucket Size:"
gsutil du -sh gs://hc-quality-archives/

echo
echo "Firestore Operational Backups:"
gcloud firestore backups list --project=hmatologia2 --format="table(name,create_time,retention_time)"
```

### 8.2 List Available Recovery Points

```bash
#!/bin/bash
# list-recovery-points.sh
# Show all available backups for PITR

gcloud firestore backups list --project=hmatologia2 \
  --format="table(
    name.basename(),
    create_time.date('%Y-%m-%d %H:%M:%S'),
    retention_time.date('%Y-%m-%d'),
    state
  )"
```

### 8.3 Manual On-Demand Backup

```bash
#!/bin/bash
# backup-on-demand.sh
# Trigger immediate backup (not on schedule)

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
OUTPUT_URI="gs://hc-quality-backups/on-demand/firestore-${TIMESTAMP}"

echo "Starting on-demand backup to ${OUTPUT_URI}..."

gcloud firestore export "${OUTPUT_URI}" \
  --async \
  --project=hmatologia2

echo "Backup started. Monitor progress:"
echo "  gcloud firestore operations list --project=hmatologia2 --filter='operationType:EXPORT'"
```

---

## 9. Disaster Scenarios & Recovery Reference

| Scenario                   | RTO      | RPO      | Procedure                     | Runbook                                     |
| -------------------------- | -------- | -------- | ----------------------------- | ------------------------------------------- |
| **Data Corruption**        | 2 hours  | < 1 hour | Restore from daily backup     | `restore-from-daily.sh` + chain-hash verify |
| **Region Outage**          | 4 hours  | < 1 hour | Failover to secondary region  | `docs/DR_PLAN.md` Scenario 2                |
| **Compromised Credential** | 1 hour   | < 30 min | Rotate key + check audit logs | `docs/DR_RUNBOOKS.md` Runbook 3             |
| **Ransomware Attack**      | 24 hours | < 1 hour | Isolate → forensics → restore | `docs/DR_RUNBOOKS.md` Runbook 4             |

**Full procedures:** See `docs/DR_PLAN.md` (4 scenarios) + `docs/DR_RUNBOOKS.md` (4 executable runbooks).

---

## 10. Compliance Mapping

| Requirement                              | Implementation                                                             | Evidence                                                |
| ---------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| **RDC 978 Art. 115** (Backup & Retenção) | Daily full + weekly differential + monthly cold storage (7-year retention) | `gs://hc-quality-backups/`, `gs://hc-quality-archives/` |
| **RDC 978 Art. 119** (Audit Trail)       | Immutable append-only collection + 5-year retention                        | `auditLogs` collection (no soft-delete)                 |
| **DICQ 4.2** (Data Management)           | Backup policy + retention schedule + testing                               | This document + annual DR test                          |
| **DICQ 4.2.3** (Backup Testing)          | Monthly restore test + quarterly DR drill                                  | `docs/DR_RESTORE_TEST_*.md`                             |
| **LGPD Art. 12** (Data Subject Rights)   | Data export on-demand + soft-delete + archival                             | Service layer + scheduled cleanup functions             |
| **ISO 15189** (Data Retention)           | 5 years post-soft-delete (clinical lab data)                               | Retention policy § 1.2                                  |

---

## 11. Sign-Off & Approval

| Role                 | Name | Date       | Signature |
| -------------------- | ---- | ---------- | --------- |
| **CTO**              | —    | 2026-05-07 | —         |
| **Tech Lead**        | —    | 2026-05-07 | —         |
| **Security Officer** | —    | 2026-05-07 | —         |

---

## 12. Document History

- **v1.0** (2026-05-07): Initial comprehensive BDR plan. Retention policy + backup strategy + scripts + monitoring + testing schedule. RDC 978 compliant.

---

## Appendix: Quick Reference Cheat Sheet

```bash
# Check backup status
gsutil ls -h gs://hc-quality-backups/daily/

# List recovery points
gcloud firestore backups list --project=hmatologia2

# Restore from daily (2 hours)
./scripts/restore-from-daily.sh 2026-05-06 staging

# Restore from archive (8 hours)
./scripts/restore-from-archive.sh 2026-05 staging

# Verify chain-hash post-restore
./scripts/verify-chain-hash.sh hmatologia2-staging

# Run smoke tests
./scripts/smoke-tests.sh hmatologia2-staging

# Monthly test (1st Friday)
./scripts/backup-test-monthly.sh
```

---

**Owner:** CTO · DevOps  
**Last Updated:** 2026-05-07  
**Next Review:** 2027-05-07
