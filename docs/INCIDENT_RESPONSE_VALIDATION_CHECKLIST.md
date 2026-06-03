# Incident Response Validation Checklist

**Purpose:** Verify that incident response procedures work before they are needed.  
**Frequency:** Quarterly (every 3 months) + after any major deploy  
**Duration:** 4–6 hours (can be split across days)  
**Owner:** DevOps + QA + CTO

---

## Pre-Drill Setup (30 minutes)

### Approval & Communication

- [ ] Schedule drill with team 1 week in advance (don't surprise)
- [ ] Alert customers: "We will conduct a scheduled incident response drill. No data loss expected. Service may be unavailable for 30 minutes during drill window."
- [ ] Post in `#incident`: "INCIDENT DRILL STARTING [timestamp] — do not page real on-call"
- [ ] Create fake incident Slack channel: `#incident-drill-2026-05-07`

### Environment Setup

```bash
# 1. Snapshot production state (in case rollback needed)
gcloud firestore export gs://hmatologia2-incident-backups/pre-drill-snapshot-$(date +%s) \
  --project=hmatologia2

# 2. Tag current prod commit
git tag drill/pre-2026-05-07

# 3. Set up log filters in advance
# (So you can search easily during drill)
```

### Staging Environment (Recommended)

- Use `hmatologia2-staging` project for real drill scenarios
- Data is identical to prod (from backup)
- No real customer impact if something goes wrong

---

## Drill 1: Data Breach Detection & Containment (90 minutes)

**Scenario:** Suspicious reads detected in audit logs from unauthorized IP

**Objective:** Test breach detection workflow, evidence preservation, customer notification

### Phase 1: Detection (5 minutes)

**Simulated evidence:**

```bash
# Create fake Firestore reads from "attacker" IP
# (We'll simulate via Cloud Logs)

gcloud logging write hcq-drill-log \
  '{"message": "Suspicious read from 203.0.113.45 to /pacientes/lab-xyz/pac-001", "severity": "WARNING", "ip": "203.0.113.45"}' \
  --severity=WARNING \
  --project=hmatologia2
```

**Triage team actions:**

- [ ] Receive alert / discover log entry
- [ ] Post to `#incident-drill-2026-05-07`: "Suspicious reads detected"
- [ ] Check GCP Cloud Status for false-positive regional issues
- [ ] Export logs to GCS for preservation

### Phase 2: Escalation (10 minutes)

- [ ] Notify CTO (simulated): "P0 incident: potential data breach"
- [ ] CTO acknowledges and designates incident commander
- [ ] Create Google Meet for incident room (simulated)
- [ ] Send customer notification template to Slack for review (not actually sent)

### Phase 3: Investigation (30 minutes)

**Actions:**

```bash
# 1. Query Firestore audit logs for suspicious patterns
gcloud logging read "jsonPayload.sourceIp = '203.0.113.45'" \
  --project=hmatologia2 \
  --limit=1000 \
  --format=json | jq '.[] | select(.severity != "INFO")'

# 2. Determine scope: how many collections accessed?
# (Expected: only pacientes, maybe laudos)

# 3. Extract list of accessed patients
# (Count: <100 or >100? determines notification template)

# 4. Check if IP appears in other suspicious activity
gcloud logging read "jsonPayload.sourceIp = '203.0.113.45'" \
  --project=hmatologia2 \
  --limit=5000 \
  --format=json | jq '[.[] | .timestamp] | sort'
```

**Documenting investigation:**

- [ ] Copy query results to incident Slack thread
- [ ] Screenshot Cloud Logs (for post-mortem)
- [ ] Update spreadsheet: affected collections + record counts

### Phase 4: Containment (15 minutes)

- [ ] Rotate credentials that might have been compromised:
  ```bash
  # Revoke Firebase API key (if breach via key)
  gcloud services api-keys delete projects/hmatologia2/locations/global/keys/abc123 \
    --project=hmatologia2
  ```
- [ ] Deploy temporary rule blocking that IP (if applicable):
  ```javascript
  match /pacientes/{labId}/{rest=**} {
    allow read: if request.auth.uid != null &&
                   request.sourceIp != "203.0.113.45";
  }
  ```
- [ ] Verify rule deployed: refresh app, attempt read (should work for normal users)

### Phase 5: Customer Notification (10 minutes)

- [ ] Draft customer notification email (copy-paste from Section 3.2 of playbook)
- [ ] Review for accuracy:
  - [ ] Correct date/time of detection
  - [ ] Correct scope (number of patients)
  - [ ] Correct fields exposed
  - [ ] Clear next steps for customer
- [ ] Save as Google Doc / Slack message (do NOT send)

### Phase 6: Validation & Close

**Drill success criteria:**

- [ ] Evidence fully preserved in GCS + Slack thread
- [ ] Suspicious activity contained (rule deployed, credentials rotated)
- [ ] Customer notification drafted + reviewed
- [ ] Investigation findings documented
- [ ] Timeline captures all actions with timestamps

**Post-drill checklist:**

- [ ] Team debriefs: what worked? what was slow? (15 min)
- [ ] Update playbook if gaps found
- [ ] Create Jira ticket for any tool improvements
- [ ] Send "drill successful" message to customers (assure them no real breach)

---

## Drill 2: System Outage & Rollback (120 minutes)

**Scenario:** Recent deploy breaks Firestore rules; writes fail with permission denied

**Objective:** Test rollback speed + recovery validation

### Phase 1: Simulate Failure (10 minutes)

```bash
# Deploy broken rules (intentionally)
# (Work in staging project, not prod)

cat > firestore.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // BROKEN: breaks everything
    }
  }
}
EOF

firebase deploy --only firestore:rules --project hmatologia2-staging
```

**Simulate monitoring alert:**

- [ ] Cloud Functions: 100% error rate in staging logs
- [ ] Post to `#incident-drill-2026-05-07`: `[P0] System outage — all writes failing`

### Phase 2: Triage & Escalation (5 minutes)

- [ ] Confirm issue in staging: try to save a CIQ run (should fail)
- [ ] Assign P0, notify CTO (in drill)
- [ ] Decision: is this a rollback candidate? (Yes: rules changed recently)

### Phase 3: Investigation (10 minutes)

```bash
# 1. Check git log for recent rules changes
git log -p --follow -n 5 -- firestore.rules | head -50

# 2. Identify breaking change (should be obvious: `if false`)

# 3. Determine: is this deploy itself bad, or misconfiguration?
#    (In this drill: deploy itself is bad → rollback is correct choice)
```

**Decision point (documented in Slack):**

- [ ] Identified breaking change: recent rules deploy
- [ ] Rollback candidate: commit `abc123def` (last known good)
- [ ] CTO approval: "Roll back to abc123"

### Phase 4: Rollback Execution (15 minutes)

```bash
# 1. Identify last known-good version
git log --oneline -n 10 -- firestore.rules
# Expected output:
# abc123d [PROD] Fix rules for new CIQ module
# def456e [PROD] Refactor RBAC logic
# ghi789f [PROD] ...

# 2. Checkout working version
git show abc123d:firestore.rules > firestore.rules

# 3. Verify diff (should only show removal of breaking change)
git diff firestore.rules

# 4. Deploy
firebase deploy --only firestore:rules --project hmatologia2-staging

# 5. Verify on page load (rules allow reads again)
```

### Phase 5: Recovery Validation (30 minutes)

**Smoke tests on staging (must all pass):**

```
☐ Hub loads without errors
☐ User can open CIQ analyzer module
☐ Can view a past run
☐ Can create new CIQ run (write succeeds)
☐ Chain hash validation passes on 10 random documents
☐ Audit logs show successful operations
☐ No permission-denied errors in Cloud Logs
```

**Detailed validation:**

```bash
# 1. Test CIQ write
curl -X POST https://[staging-url]/api/ciq/runs/create \
  -H "Authorization: Bearer [token]" \
  -d '{"labId":"lab-test","runType":"coagulacao"}' \
  | jq '.status'  # Should be "success"

# 2. Validate chain hash on sample docs
gcloud firestore export gs://hmatologia2-incident-backups/drill-export-$(date +%s) \
  --project=hmatologia2-staging

# 3. Run chain-hash validator
npm run validate:chain-hash -- \
  --export-path=/tmp/firestore-export \
  --sample-size=10 \
  --strict

# 4. Check Cloud Logs
gcloud logging read "severity >= ERROR" --project=hmatologia2-staging --limit=50
# Expected: 0 permission-denied errors post-rollback
```

### Phase 6: Communication (10 minutes)

- [ ] Draft customer notification: "Service recovered. No data loss."
- [ ] Inform team: "Rollback successful. RCA in progress."
- [ ] Update status page (simulated): "Service Restored"

### Phase 7: Post-Incident (15 minutes)

**Root cause & preventive action:**

- [ ] Why did broken rules get deployed? (Inadequate pre-deploy testing?)
- [ ] Create Jira ticket: "Add pre-deploy rules validation test"
- [ ] Create Jira ticket: "Require peer review of firestore.rules before merge"

**Post-drill success criteria:**

- [ ] Rollback completed in <15 min
- [ ] All smoke tests pass
- [ ] Evidence preserved (git diff, log snapshot)
- [ ] Team debriefed + improvement tickets created

---

## Drill 3: Data Corruption Detection & Restore (180 minutes)

**Scenario:** Laudo documents corrupted (missing labId, null timestamps) after a Cloud Function bug

**Objective:** Test data corruption detection, backup restore, validation

### Phase 1: Inject Corruption (10 minutes)

```bash
# In staging, deliberately corrupt a laudo document
# (Simulate a Cloud Function bug that wrote bad data)

gcloud firestore update projects/hmatologia2-staging/databases/\(default\)/documents/laudos/lab-test/laudo-corrupt \
  --update-mask=labId,criadoEm \
  --update-mask-json='{"labId":null,"criadoEm":null}' \
  --project=hmatologia2-staging

# Verify corruption in Firebase Console:
# Navigate to: databases > laudos > lab-test > laudo-corrupt
# Expected: labId = null, criadoEm = null (INVALID)
```

### Phase 2: Detection (10 minutes)

**Simulate monitoring alert:**

- [ ] Run chain-hash validator:

  ```bash
  npm run validate:chain-hash -- --project=hmatologia2-staging --sample-size=100
  ```

  Expected output: `FAIL: Chain broken at doc [laudo-corrupt]. Hash mismatch.`

- [ ] Post to `#incident-drill-2026-05-07`: `[P1] Data corruption detected — laudo documents`

### Phase 3: Investigation (20 minutes)

```bash
# 1. Identify extent of corruption
gcloud firestore query --project=hmatologia2-staging laudos \
  --filter='labId == null' \
  --limit=1000

# Expected: [laudo-corrupt] + any other corrupted docs

# 2. Find timestamp of corruption
gcloud logging read "resource.type=cloud_firestore AND jsonPayload.operation=updateDocument" \
  --project=hmatologia2-staging \
  --limit=1000 \
  | jq '.[] | select(.jsonPayload.path | contains("laudo"))'

# 3. Identify root cause
# (Check Cloud Functions logs for write operation before corruption time)
gcloud logging read "resource.type=cloud_function" \
  --project=hmatologia2-staging \
  --limit=500 \
  | jq '.[] | select(.severity == "ERROR")'
```

### Phase 4: Decision (5 minutes)

**Incident commander decision (documented in Slack):**

- [ ] Corruption is isolated to <10 docs → can patch in-place
- [ ] Corruption is widespread (>50 docs) → restore from backup
- [ ] In drill: assume widespread corruption → proceed to restore

### Phase 5: Backup Restore (60 minutes)

**Step 1: Prepare staging project (10 min)**

```bash
# Identify clean backup
gsutil ls gs://hmatologia2-incident-backups/exports/ | head -5
# Expected: export-1715040000/, export-1715040100/, ...

# Pick the latest one before corruption timestamp
BACKUP_PATH="gs://hmatologia2-incident-backups/exports/export-1715033800"
```

**Step 2: Disable writes (5 min)**

```bash
# Deploy read-only rule
cat > firestore.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if false;  // MAINTENANCE MODE
    }
  }
}
EOF

firebase deploy --only firestore:rules --project=hmatologia2-staging
```

Verify: attempt to save a document (should fail gracefully)

**Step 3: Restore from backup (15 min)**

```bash
# THIS IS DESTRUCTIVE. In real incident, CTO approves first.

# Download backup
gsutil -m cp -r "$BACKUP_PATH/*" /tmp/firestore-restore/

# Delete corrupted database + restore
gcloud firestore databases delete --project=hmatologia2-staging

# Restore from backup
gcloud firestore databases restore \
  --source-backup=projects/hmatologia2-staging/locations/us-central1/backups/backup-id \
  --project=hmatologia2-staging \
  --async

# Monitor restore job
gcloud firestore operations list --project=hmatologia2-staging | head -10
```

(In staging, actual restore may be simulated due to time constraints)

**Step 4: Re-enable writes (5 min)**

```bash
# Restore normal rules
git checkout HEAD -- firestore.rules
firebase deploy --only firestore:rules --project=hmatologia2-staging
```

### Phase 6: Validation (30 minutes)

**Post-restore verification:**

```bash
# 1. Data integrity check
gcloud firestore query --project=hmatologia2-staging laudos \
  --filter='labId != null' \
  --limit=100 | jq 'length'

# 2. Chain hash validation on 50 samples
npm run validate:chain-hash -- \
  --project=hmatologia2-staging \
  --sample-size=50 \
  --strict

# Expected output: "PASS: All 50 documents verified. Chain integrity confirmed."

# 3. Smoke tests
☐ Hub loads
☐ Can view restored laudos
☐ Audit trail intact
☐ No permission errors
☐ Timestamps match pre-corruption state
```

### Phase 7: Communication (10 minutes)

- [ ] Draft customer notification: "Data has been restored to [timestamp]. Changes after that time are lost. Here is what was lost: [list]."
- [ ] Notify team: "Restore complete. Validation passed. RCA underway."

### Phase 8: Post-Incident (10 minutes)

**Root cause analysis:**

- [ ] Why did function write invalid data?
- [ ] Were tests insufficient?
- [ ] Create preventive actions:
  - "Add integration test for laudo creation"
  - "Add pre-deploy validation: all documents have required fields"

---

## Drill 4: LGPD Compliance — Data Subject Rights (90 minutes)

**Scenario:** Patient requests data export (Art. 18) and deletion (Art. 35); system must respond within 30 days

**Objective:** Test LGPD request processing workflow, audit trail, notification

### Phase 1: Receive Request (5 minutes)

**Simulate request:**

```bash
# Create fake LGPD request in staging
curl -X POST https://[staging-url]/api/lgpd/request \
  -H "Authorization: Bearer [patient-token]" \
  -d '{
    "type": "export",
    "reason": "patient requested copy of data",
    "requestedFields": ["pacientes", "laudos", "declaracoes"]
  }' | jq '.requestId'
```

- [ ] Request created in Firestore: `/lgpd-requests/{labId}/{requestId}`
- [ ] Post to Slack: "LGPD export request received. 30-day deadline: [date]"

### Phase 2: Process Request (30 minutes)

```bash
# 1. Check request status
gcloud firestore describe projects/hmatologia2-staging/databases/\(default\)/documents/lgpd-requests/lab-test/[requestId]

# 2. Verify patient identity (simulated)
# (In real incident, check email, patient ID, etc.)

# 3. Export data
curl -X POST https://[staging-url]/api/lgpd/export \
  -H "Authorization: Bearer [service-token]" \
  -d '{"requestId":"[requestId]"}' | jq '.exportUrl'

# Expected: downloadable ZIP file with all patient data

# 4. Verify export completeness
unzip -t /tmp/export-[requestId].zip | grep -c "\.json"
# Should show: paciente.json, laudos/*.json, declaracoes/*.json, etc.
```

- [ ] Export generated + stored in Cloud Storage
- [ ] Request status updated: `status: "export_generated"`
- [ ] Audit log created: `eventType: "GDPR_EXPORT", labId, patientId, timestamp, operator`

### Phase 3: Deletion Request (20 minutes)

**New request: delete all data**

```bash
# 1. Create deletion request
curl -X POST https://[staging-url]/api/lgpd/request \
  -H "Authorization: Bearer [patient-token]" \
  -d '{
    "type": "delete",
    "reason": "patient withdrew consent",
    "scope": "all"
  }' | jq '.requestId'

# 2. Approve deletion (CTO action, simulated)
curl -X POST https://[staging-url]/api/lgpd/approve-deletion \
  -H "Authorization: Bearer [cto-token]" \
  -d '{"requestId":"[requestId]","approvedBy":"CTO"}' | jq '.status'

# 3. Execute deletion
curl -X POST https://[staging-url]/api/lgpd/execute-deletion \
  -H "Authorization: Bearer [service-token]" \
  -d '{"requestId":"[requestId]"}' | jq '.status'

# Expected: "deletion_completed"
```

- [ ] All patient records soft-deleted (marked with `deletadoEm: now()`)
- [ ] Audit log created: `eventType: "GDPR_DELETION", patientId, approvedBy, timestamp`
- [ ] Original data NOT physically deleted (preserved in soft-delete for legal hold)

### Phase 4: Verification (20 minutes)

**Compliance checks:**

```bash
# 1. Verify soft-delete flag set
gcloud firestore query --project=hmatologia2-staging pacientes \
  --filter='patientId == [patientId]' | jq '.deletadoEm'
# Should NOT be null

# 2. Verify data not visible in normal queries
curl -X GET https://[staging-url]/api/pacientes?patientId=[patientId] \
  -H "Authorization: Bearer [staff-token]" | jq '.count'
# Should be 0 (soft-deleted)

# 3. Audit trail intact (admins can still see for legal compliance)
gcloud firestore query --project=hmatologia2-staging audit-logs \
  --filter='eventType == "GDPR_DELETION"' | jq 'length'
# Should be 1 (our deletion event)

# 4. Timeline verification
# Request created: [timestamp1]
# Deletion executed: [timestamp2]
# Days elapsed: [timestamp2 - timestamp1] < 30 days
```

- [ ] Deletion completed within deadline
- [ ] Audit trail shows who approved + when
- [ ] Patient data no longer accessible to staff
- [ ] Admin can still verify deletion in audit logs

### Phase 5: Communication (10 minutes)

- [ ] Draft patient notification: "Your deletion request has been processed. Your data has been permanently removed from our systems (except as required by law)."
- [ ] Notify compliance officer: "LGPD deletion request [requestId] completed on [date]. Evidence in audit logs."

### Phase 6: Post-Incident (5 minutes)

**Success criteria:**

- [ ] Request processed within 30-day SLA
- [ ] Audit trail complete
- [ ] Patient data no longer accessible
- [ ] Legal hold preserved (soft-delete)

---

## Drill 5: Security Incident — Credential Rotation (60 minutes)

**Scenario:** `HCQ_SIGNATURE_HMAC_KEY` secret exposed in old commit history

**Objective:** Test credential rotation, HMAC verification, historical data handling

### Phase 1: Detect Exposure (5 minutes)

```bash
# Simulate finding secret in git history
git log -p --all | grep -i "HCQ_SIGNATURE_HMAC_KEY" | head -5
# Output: evidence of unencrypted key in past commit

# Post to Slack: `[P0] Security — HMAC key found in git history`
```

### Phase 2: Immediate Containment (10 minutes)

**Actions (must complete within 5 min):**

```bash
# 1. Revoke old secret in Google Cloud Secret Manager
gcloud secrets versions destroy --secret=HCQ_SIGNATURE_HMAC_KEY \
  --project=hmatologia2-staging

# (In real incident: `destroy` removes secret from runtime, but version history preserved)

# 2. Verify secret no longer accessible by functions
curl -X POST https://[staging-url]/api/test/verify-secret \
  -H "Authorization: Bearer [admin-token]"
# Expected: Error "Secret not found" (indicates rotation complete)
```

- [ ] Old secret revoked from Secret Manager
- [ ] Functions cannot read old secret at next deploy

### Phase 3: Rotate to New Secret (15 minutes)

```bash
# 1. Generate new random HMAC key (256-bit)
openssl rand -hex 32
# Output: a1b2c3d4e5f6... (new key)

# 2. Create new secret version in Google Cloud
gcloud secrets versions add HCQ_SIGNATURE_HMAC_KEY \
  --data-file=- \
  --project=hmatologia2-staging \
  <<< "a1b2c3d4e5f6..."

# 3. Update all functions to use new secret
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY \
  --project=hmatologia2-staging

# 4. Redeploy all functions
firebase deploy --only functions --project=hmatologia2-staging
```

- [ ] New secret created in Secret Manager
- [ ] All function signatures updated to reference new secret
- [ ] Functions redeployed + warmed (verify no errors in logs)

### Phase 4: Verify Rotation (15 minutes)

**Test new secret is working:**

```bash
# 1. Test function that uses HMAC
curl -X POST https://[staging-url]/api/signature/test \
  -H "Authorization: Bearer [admin-token]" \
  -d '{"data":"test"}' | jq '.hmac'
# Expected: valid HMAC (different from old key's output)

# 2. Create new signed record and verify
npm run test:signatures -- --project=hmatologia2-staging

# Expected output:
# ✓ Signature generation with new key succeeds
# ✓ HMAC verification passes
# ✓ Old signatures still readable (validation skipped)
```

- [ ] New signatures generate with new key
- [ ] Old signatures remain unchanged (readable, but marked as pre-rotation)
- [ ] Chain hash validation resumes (with pre-rotation origin point)

### Phase 5: Historical Data Handling (10 minutes)

**Document baseline reset per ADR-0017:**

```bash
# 1. Create synthetic event marking baseline reset
curl -X POST https://[staging-url]/api/audit/baseline-reset \
  -H "Authorization: Bearer [admin-token]" \
  -d '{
    "eventType": "chain-baseline-reset",
    "adrReference": "ADR-0017",
    "reason": "HMAC key rotation — credential compromise remediation"
  }' | jq '.eventId'

# 2. Verify event recorded in audit-violations
gcloud firestore query --project=hmatologia2-staging audit-violations \
  --filter='eventType == "chain-baseline-reset"' | jq '.[] | .timestamp'
# Expected: [current timestamp]

# 3. Update chain validator to skip pre-rotation records
# (Already baked into validateChainIntegrityScheduled logic)
```

- [ ] Baseline reset event created in audit trail
- [ ] Pre-rotation records marked as historical (not re-validated)
- [ ] Post-rotation chain validation proceeds normally

### Phase 6: Communication & Documentation (5 minutes)

- [ ] Post incident report to team: "Credential rotated. All functions redeployed. Chain validator reset."
- [ ] Create ADR addendum documenting this rotation (reference ADR-0017)
- [ ] Notify compliance: "Security event: HMAC key rotated. Historical baseline reset. Audit trail: [link]."

---

## Post-Drill Debrief Template (30 minutes)

**Conduct within 24 hours of drill. Attendees: Incident commander + on-call + QA + manager.**

### Questions to Answer

1. **What was the detection latency?** (goal: <5 min)
   - How long before we noticed?
   - Could we have detected faster?

2. **What was decision latency?** (goal: <15 min for P0)
   - Time from detection to "here's what we're doing"
   - Did we have clear escalation path?

3. **What was remediation latency?** (goal: <30 min for rollback, <2h for restore)
   - Time from decision to fix deployed
   - What was the bottleneck?

4. **What didn't work?**
   - Missing runbook steps?
   - Tool unavailable?
   - Team member unreachable?
   - Documentation unclear?

5. **What were the surprises?**
   - Anything we didn't expect?
   - Any assumptions we had that were wrong?

### Output: Action Items

- [ ] Update playbooks with gaps found
- [ ] Jira tickets for tool improvements
- [ ] Schedule training (if team knowledge gap)
- [ ] Update escalation matrix (if contact info changed)
- [ ] Increase monitoring (if detection was slow)

**Example actions:**

- "Add alert for chain-hash validation failure" (Jira ticket: ops-123)
- "Document the Firestore export command in runbook" (Playbook update)
- "CTO availability: revise on-call schedule for weekend coverage" (HR action)

---

## Drill Tracking & Compliance

### Quarterly Schedule

| Quarter | Month | Drill                    | Owner      |
| ------- | ----- | ------------------------ | ---------- |
| Q1 2026 | Jan   | #1 (Data Breach)         | Security   |
| Q1 2026 | Feb   | #2 (Outage + Rollback)   | DevOps     |
| Q1 2026 | Mar   | #3 (Data Corruption)     | DBA        |
| Q2 2026 | Apr   | #4 (LGPD Compliance)     | Compliance |
| Q2 2026 | May   | #5 (Security — Rotation) | Security   |
| Q3 2026 | Jul   | #1 (repeat)              | Security   |
| Q3 2026 | Aug   | #2 (repeat)              | DevOps     |
| ...     | ...   | ...                      | ...        |

### Compliance Verification

- [ ] All 5 drill types completed in past 12 months
- [ ] Each drill includes post-mortem + action items
- [ ] Playbooks updated with findings
- [ ] Team trained on results
- [ ] Evidence (Slack transcripts, logs) archived
- [ ] Executive summary prepared for RDC 978 audit file

**Sign-off:**

- CTO: ******\_\_\_****** Date: ****\_\_\_****
- Compliance: ******\_\_\_****** Date: ****\_\_\_****

---

**Document Version:** 1.0 | **Last Drilled:** [Date] | **Next Drill Cycle:** [Date + 3 months]
