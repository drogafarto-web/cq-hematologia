# Disaster Recovery Runbooks — HC Quality

**Reference:** docs/DR_PLAN.md

---

## Runbook 1: Firestore Data Corruption Recovery

**Scenario:** Detected corrupted data in production. Must restore from clean snapshot.

**Preconditions:**

- Access to `gcloud` CLI (authenticated as service account with Firestore admin rights)
- Staging project exists and is writable (hmatologia2-staging)
- Latest clean snapshot identified (timestamp known)

**Procedure:**

### Phase A: Preparation (before restore)

1. **Stop production writes (5 min):**

   ```bash
   # Disable all Cloud Functions (deploy empty stub)
   firebase deploy --only functions --project hmatologia2
   # (Or: manually disable in Firebase Console → Functions)

   # Confirm no writes are in progress
   gcloud firestore operations list --project=hmatologia2 | grep -i "in_progress"
   ```

2. **Snapshot corrupted state (for analysis):**

   ```bash
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   gsutil mb -p hmatologia2 gs://hmatologia2-corrupted-${TIMESTAMP}/

   gcloud firestore export gs://hmatologia2-corrupted-${TIMESTAMP}/export \
     --async \
     --project=hmatologia2

   # Monitor export progress
   gcloud firestore operations list --project=hmatologia2 --filter="operationType:EXPORT"
   # Wait for status "DONE"
   ```

3. **Identify clean snapshot (check backup timestamps):**
   ```bash
   gcloud firestore backups list --project=hmatologia2 --format="table(name,create_time,retention_time)"
   ```
   Pick the most recent backup before corruption detected. Note its `name` (e.g., `projects/hmatologia2/locations/us/backups/...`).

### Phase B: Restore to staging (validation)

4. **Import snapshot to staging:**

   ```bash
   BACKUP_NAME="projects/hmatologia2/locations/us/backups/2026-05-06T10:00:00Z"  # adjust timestamp

   gcloud firestore restore ${BACKUP_NAME} \
     --async \
     --project=hmatologia2-staging

   # Monitor restore progress
   gcloud firestore operations list --project=hmatologia2-staging --filter="operationType:IMPORT"
   # Wait for status "DONE" (typically 30-60 min for large DB)
   ```

5. **Validate restored data in staging:**
   - Firestore rules already deployed to staging (verify rules match prod).
   - Run smoke tests:
     ```bash
     npm test -- --filter="integration" --project=hmatologia2-staging
     ```
   - Check document counts:
     ```bash
     # Staging should match production pre-corruption
     gcloud firestore stat --project=hmatologia2-staging
     ```
   - Sample chain-hash verification (Task 3 details).

### Phase C: Restore to production

6. **If staging validation passes, restore to production:**

   ```bash
   gcloud firestore restore ${BACKUP_NAME} \
     --async \
     --project=hmatologia2

   # Monitor restore progress
   gcloud firestore operations list --project=hmatologia2 --filter="operationType:IMPORT"
   # Wait for status "DONE"
   ```

7. **Re-enable production (post-restore):**

   ```bash
   # Re-deploy functions with full logic
   npm run build:functions && firebase deploy --only functions --project=hmatologia2

   # Verify connectivity
   curl -X GET https://hmatologia2.web.app/api/health
   # Expected: 200 OK
   ```

8. **Post-restore validation (Task 3):** Run full chain-hash verification + smoke tests.

### Phase D: Evidence & Closure

9. **Document the recovery:**
   - Snapshot timestamp
   - Restore timestamp
   - Validation results
   - Downtime duration
   - Root cause (if identified during forensics)
   - Archive in `docs/DR_RESTORE_TEST_2026-05.md` (Task 3)

---

## Runbook 2: GCP Region Outage Recovery

**Scenario:** southamerica-east1 is down. Must failover to secondary region (northamerica-northeast1).

**Preconditions:**

- Secondary GCP project exists (hmatologia2-failover)
- Firebase project created in secondary region
- Firestore rules and indexes already deployed to secondary
- Latest backup accessible (exported to multi-region storage bucket)

**Procedure:**

### Phase A: Detection & Communication

1. **Confirm outage:**

   ```bash
   gcloud compute zones list --filter="region:southamerica-east1" --project=hmatologia2
   # If all zones show status "DOWN", regional outage confirmed.

   # Check GCP status page
   curl https://status.cloud.google.com/incidents.json | jq '.incidents[] | select(.affected_services[] | .service == "Firestore")'
   ```

2. **Update status page:**
   - "Service investigating incident in primary region. Secondary region deployment in progress. ETA: [time]"

3. **Notify customers:**
   - Email to support@[company] + PM Slack
   - Include: symptom, investigation status, ETA

### Phase B: Secondary region deployment

4. **Restore latest backup to secondary project:**

   ```bash
   # List available backups
   gcloud firestore backups list --project=hmatologia2
   LATEST_BACKUP="projects/hmatologia2/locations/us/backups/..."  # pick most recent

   # Import to secondary
   gcloud firestore restore ${LATEST_BACKUP} \
     --async \
     --project=hmatologia2-failover

   # Monitor (typically 1-2h)
   gcloud firestore operations list --project=hmatologia2-failover
   ```

5. **Deploy functions to secondary region:**

   ```bash
   cd functions
   npm install
   npx tsc --noEmit
   firebase deploy --only functions --project=hmatologia2-failover
   ```

6. **Update DNS / Firebase Hosting:**
   - Update `.firebaserc` to point primary to secondary project (or switch via DNS)
   - Or: manually update Firebase Hosting custom domain to secondary project
   - Verify: curl -I https://hmatologia2.web.app
   - Should connect to secondary region

### Phase C: Validation

7. **Smoke tests in secondary region:**

   ```bash
   npm test -- --filter="integration" --project=hmatologia2-failover
   ```

8. **Chain-hash verification (Task 3).**

### Phase D: Ongoing monitoring

9. **Monitor primary region recovery:**

   ```bash
   gcloud compute zones list --filter="region:southamerica-east1" --repeat=1min
   # When zones come online, prepare to fail back
   ```

10. **Failback (when primary recovered):**
    - Restore primary from secondary backup (same procedure as Phase B)
    - Switch DNS back to primary
    - Verify primary is healthy
    - Keep secondary as hot-standby

---

## Runbook 3: Compromised Credentials Recovery

**Scenario:** Firebase Admin SDK key leaked. Must rotate key, check for unauthorized writes.

**Preconditions:**

- GCP Console access (project owner role)
- Audit logs accessible
- `gcloud` CLI authenticated

**Procedure:**

### Phase A: Immediate containment

1. **Rotate credential immediately:**

   ```bash
   # Go to Firebase Console → Project Settings → Service Accounts
   # OR use gcloud:

   gcloud iam service-accounts keys list --iam-account=[SERVICE_ACCOUNT_EMAIL] --project=hmatologia2
   # Identify the compromised key (by creation date or ID)

   gcloud iam service-accounts keys delete [KEY_ID] \
     --iam-account=[SERVICE_ACCOUNT_EMAIL] \
     --project=hmatologia2

   # Generate new key
   gcloud iam service-accounts keys create ~/new-key.json \
     --iam-account=[SERVICE_ACCOUNT_EMAIL] \
     --project=hmatologia2

   # Store new key securely (1Password / GCP Secret Manager)
   ```

2. **Update all systems using the credential:**

   ```bash
   # Cloud Functions (redeploy with new key in environment)
   firebase env:set FIREBASE_ADMIN_SDK_KEY=[new_key_json]
   npm run build:functions && firebase deploy --only functions

   # CI/CD (update GitHub Secrets / GitLab CI variables)
   # Manually in CI/CD UI: update FIREBASE_KEY to new value

   # .env files (rotate on all deployed instances)
   # For Cloud Run: redeploy services with new env var
   ```

### Phase B: Forensics

3. **Check audit logs for suspicious activity (24h lookback):**

   ```bash
   gcloud logging read \
     "resource.type=cloud_firestore_database AND protoPayload.authenticationInfo.principalEmail=[SERVICE_ACCOUNT_EMAIL]" \
     --limit=1000 \
     --project=hmatologia2 \
     --format=json > /tmp/audit_logs.json

   # Analyze for unusual writes:
   jq '.[] | select(.protoPayload.methodName | contains("Write"))' /tmp/audit_logs.json | head -20
   ```

4. **Check Firestore audit trail for mass deletes:**

   ```bash
   gcloud firestore query --collection=auditLogs \
     --filter='action==delete' \
     --order-by=ts --descending \
     --limit=100 \
     --project=hmatologia2
   ```

5. **Determine if unauthorized writes occurred:**
   - If no unusual audit entries: credential was exposed but not used. No data recovery needed.
   - If unusual writes found: proceed to Scenario 1 (Corruption Recovery) to restore from clean backup.

### Phase C: Notification

6. **Notify compliance (if data access confirmed):**
   - Privacy Officer + Legal: "Credential compromise detected. Scope: [read-only / write access]. Recovery: [no impact / restored from backup]."
   - If customer data access: LGPD Art. 34 notification required within 48h.

---

## Runbook 4: Ransomware / Malicious Write Attack

**Scenario:** Attacker exploited CF or compromised credential, bulk-deleted/encrypted production data.

**Preconditions:**

- Detection complete (alert triggered, scope confirmed)
- Alert system providing real-time metrics
- Backups uncompromised (stored separately from production)

**Procedure:**

### Phase A: Immediate containment (CRITICAL)

1. **Disable all cloud functions (5 min):**

   ```bash
   # Option 1: Firebase Console
   # Functions → List all → Select each → Delete or Disable

   # Option 2: gcloud
   gcloud functions list --project=hmatologia2 --format="table(name,runtime,status)"

   for func in $(gcloud functions list --project=hmatologia2 --format="value(name)"); do
     gcloud functions delete $func --project=hmatologia2 --quiet
   done

   # Redeploy empty stub (graceful "service offline" message)
   firebase deploy --only functions:health --project=hmatologia2
   # health function returns 503 Offline
   ```

2. **Disable API traffic:**

   ```bash
   # Firebase Hosting: deploy static maintenance page
   # OR: disable custom domain in Firebase Console

   # Result: hmatologia2.web.app → "System Maintenance" page
   ```

3. **Isolate databases:**

   ```bash
   # Firestore: no additional action needed (writes are stopped)
   # Firebase Realtime DB (if used): disable writes

   # Prevent further replication/backups of corrupted state
   gcloud firestore backups disable-auto-backup --project=hmatologia2
   ```

### Phase B: Forensics (in parallel with Phase A)

4. **Snapshot corrupted state (for analysis):**

   ```bash
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   gsutil mb -p hmatologia2 gs://hmatologia2-ransomware-${TIMESTAMP}/

   gcloud firestore export gs://hmatologia2-ransomware-${TIMESTAMP}/export \
     --async \
     --project=hmatologia2

   # Save for forensic analysis (do NOT delete until incident resolved)
   ```

5. **Review audit logs (last 48h):**

   ```bash
   gcloud logging read \
     "resource.type=cloud_firestore_database" \
     --limit=10000 \
     --project=hmatologia2 \
     --format=json > /tmp/full_audit.json

   # Identify the attack vector (which function? which credential?)
   jq '.[] | select(.severity != "DEFAULT") | {timestamp:.timestamp, caller:.protoPayload.authenticationInfo.principalEmail, method:.protoPayload.methodName}' /tmp/full_audit.json
   ```

6. **Identify clean snapshot (earliest before attack):**

   ```bash
   gcloud firestore backups list --project=hmatologia2 \
     --format="table(name,create_time,retention_time)"

   # Pick the oldest backup that predates the attack (e.g., if attack happened 2026-05-06 15:00, use 2026-05-06 05:00 backup)
   ```

### Phase C: Full restore + hardening

7. **Restore production from clean snapshot:**
   - Follow Runbook 1 (Firestore Data Corruption), Phase B-C (import + validation + restore)
   - Restore to STAGING first, validate fully, then restore to PROD
   - Expected duration: 2-4 hours

8. **Post-restore: harden Cloud Functions (prevent re-attack):**

   ```bash
   # Review CF code for vulnerability (how was it exploited?)
   # Patch: add input validation, rate-limiting, quota checks

   # Example: if CF accepted unbounded delete requests:
   # BEFORE: deleteAllDocs(query) → batch.delete() on unbounded result
   # AFTER: deleteAllDocs(query, maxDocs: 100) → batch with limit

   npm run build:functions && firebase deploy --only functions --project=hmatologia2
   ```

9. **Update Firestore rules to tighten access:**

   ```
   # Example: if CF was compromised, lock down callable auth
   BEFORE: allow call: if request.auth != null;
   AFTER: allow call: if request.auth.token.aud == 'hmatologia2' && request.auth.token.role == 'admin';

   firebase deploy --only firestore:rules --project=hmatologia2
   ```

### Phase D: Recovery & notification

10. **Re-enable services:**
    - Re-enable Cloud Functions (patched)
    - Re-enable API / Firebase Hosting
    - Test smoke suite

11. **Rotate all credentials (comprehensive):**

    ```bash
    # Service accounts, API keys, Firebase API credentials
    # Reissue secrets to all consumers
    ```

12. **Notify (if breach confirmed):**
    - **Legal + Privacy Officer:** Incident report, breach determination, LGPD notification timeline
    - **Customers (if their data accessed):** Transparency statement, recovery measures, next steps
    - **Public:** Status page update (factual, not admitting breach unless confirmed)

---

## Validation Procedures (All Scenarios)

See Task 3 for detailed chain-hash verification and smoke test procedures.

---

## Contacts & Escalation

| Contact          | Role               | Number     | Email     |
| ---------------- | ------------------ | ---------- | --------- |
| CTO              | Incident Commander | [phone]    | [email]   |
| Tech Lead        | Executor           | [phone]    | [email]   |
| Security Officer | Forensics          | —          | [email]   |
| GCP Support      | Infrastructure     | [SLA link] | [support] |

**Escalation path:** Tech Lead (detection) → CTO (decision) → Security Officer (forensics) → PM (comms).

---

**Last updated:** 2026-05-06
**Next runbook drill:** 2027-05-06 (annual)
