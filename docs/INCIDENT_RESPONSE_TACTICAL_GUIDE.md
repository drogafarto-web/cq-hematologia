# Incident Response — Tactical Decision Guide

**Quick tactical reference for P0 incidents**  
**Laminate and keep in your laptop bag**

---

## When System is Down (P0)

### 1. Is it really down? (30 seconds)

```bash
# Test 1: Ping Firestore
gcloud firestore:databases list --project=hmatologia2
# Expected: hmatologia2-staging (default) · OK

# Test 2: Test public URL
# Browser → hmatologia2.web.app
# Expected: app loads + you can see login

# Test 3: Check Cloud Status
# Browser → status.cloud.google.com
# Expected: no incidents in southamerica-east1
```

### 2. If confirmed down → P0, immediately:

```
[ ] Post to Slack #incident: [P0] System down — [timestamp]
[ ] Slack: @CTO @DevOps-Lead @Security-Lead
[ ] Get phone number for CTO from escalation matrix
[ ] If no Slack response in 2 min: CALL CTO
[ ] Create Google Meet for incident room
```

### 3. Root cause in <15 min:

```bash
# Check #1: Recent deploy?
git log --oneline -3
# If yes: proceed to ROLLBACK section below

# Check #2: Rules broken?
gcloud logging read "resource.type=cloud_firestore" \
  --project=hmatologia2 --limit=50 | grep -i "permission\|deny"
# If yes: check firestore.rules for recent changes

# Check #3: Function errors?
gcloud logging read "resource.type=cloud_function AND severity >= ERROR" \
  --project=hmatologia2 --limit=50
# If yes: read error messages + stack trace

# Check #4: Regional outage?
# Browser → status.cloud.google.com
# If yes: wait up to 2 hours, then failover to secondary region
```

---

## Recovery: System Outage

### Path A: Rollback (if recent bad deploy)

**Timeline:** 10–20 min (fastest)

```bash
# 1. Identify last good version
git log --oneline -5

# 2. Check which file changed
git show HEAD~1:firestore.rules > old-rules.txt
git show HEAD:firestore.rules > new-rules.txt
diff old-rules.txt new-rules.txt
# If obvious break (e.g., "allow write: if false"), this is it

# 3. Get CTO approval: "Roll back to abc123"

# 4. Deploy old version
git checkout abc123 -- firestore.rules functions/src/
firebase deploy --only firestore:rules,functions --project hmatologia2

# 5. Verify (2 min)
# → Refresh Cloud Logs (errors should drop)
# → Try to save a CIQ run in app (should work)
# → Check error rate: gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=10
```

**Decision point:** If outage persists after rollback → proceed to Path B (Restore)

---

### Path B: Restore from Backup (if corruption or data loss)

**Timeline:** 60–120 min (slower but safer)

**Prerequisites:**
- CTO must approve (restores are destructive)
- You have access to restore location (`hmatologia2-staging` project)

```bash
# 1. STOP WRITES IMMEDIATELY
# Deploy read-only rule (5 min)
cat > firestore.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
EOF

firebase deploy --only firestore:rules --project hmatologia2

# Verify: try to save in app (should fail gracefully: "Cannot save right now")

# 2. IDENTIFY CLEAN BACKUP
gsutil ls gs://hmatologia2-incident-backups/exports/
# Example output:
# gs://hmatologia2-incident-backups/exports/export-1715039200/
# gs://hmatologia2-incident-backups/exports/export-1715039300/
# Choose the one BEFORE corruption was detected

BACKUP="export-1715039200"

# 3. TEST RESTORE IN STAGING FIRST
# (This step prevents restoring bad data to prod)
gcloud firestore databases delete \
  --project=hmatologia2-staging

# Restore to staging
gcloud firestore databases restore \
  --source-backup=projects/hmatologia2/locations/us-central1/backups/$BACKUP \
  --destination-database-name=default \
  --project=hmatologia2-staging

# Wait for restore to complete (5–15 min)
gcloud firestore operations list --project=hmatologia2-staging

# 4. VALIDATE STAGING DATA
# Run this on staging:
npm run validate:chain-hash -- \
  --project=hmatologia2-staging \
  --sample-size=50 \
  --strict

# If PASS: proceed to step 5
# If FAIL: try older backup (go back to step 2)

# 5. RESTORE TO PRODUCTION
gcloud firestore databases delete \
  --project=hmatologia2
gcloud firestore databases restore \
  --source-backup=projects/hmatologia2/locations/us-central1/backups/$BACKUP \
  --destination-database-name=default \
  --project=hmatologia2

# 6. RE-ENABLE WRITES
git checkout HEAD -- firestore.rules
firebase deploy --only firestore:rules --project hmatologia2

# 7. FINAL VALIDATION (5 min)
npm run validate:chain-hash -- --project=hmatologia2 --sample-size=100
# Expected: ALL PASS
```

---

## When Data Looks Corrupted (P0/P1)

### 1. Detect corruption:

```bash
# Symptom: laudo document has labId = null OR criadoEm = null
# Check Cloud Firestore in Firebase Console:
# Navigate to: database → laudos → [doc] → check fields

# Programmatic check:
gcloud firestore query --project=hmatologia2 laudos \
  --filter='labId == null' --limit=100 | jq 'length'

# If > 0: corruption confirmed
```

### 2. Isolate scope:

```bash
# How many corrupted docs?
gcloud firestore query --project=hmatologia2 laudos \
  --filter='labId == null' --limit=10000 | jq 'length'
# If < 10: Can patch in-place (faster)
# If > 50: Must restore from backup (safer)

# When did corruption start?
gcloud logging read "resource.type=cloud_firestore AND jsonPayload.operation = updateDocument" \
  --project=hmatologia2 --limit=1000 | jq '.[] | select(.jsonPayload.path | contains("laudos"))' \
  | jq '.timestamp' | sort | head
# This tells you the first suspicious write timestamp
```

### 3. Decision:

```
Corruption count < 10 AND isolated to 1 collection?
  → Patch in-place: fix document manually via Cloud Function
  → Restore validation: 100% chain-hash check after patch

Corruption count > 50 OR multiple collections?
  → Restore from backup: Follow Path B above
  → CTO must approve before proceeding
```

---

## When Patient Data is Exposed (P0: Data Breach)

### 1. Immediate containment (5 min):

```bash
# STOP the breach
# If attacker has active session:
gcloud firestore rules deploy firestore.rules
# (Deploy rules that restrict suspicious IP/account)

# If compromised credential:
gcloud services api-keys delete projects/hmatologia2/locations/global/keys/[KEY_ID]
# (Revoke the credential immediately)

# Save evidence NOW
gcloud logging read "jsonPayload.sourceIp = '203.0.113.45'" \
  --project=hmatologia2 --limit=10000 --format=json > \
  breach-evidence-$(date +%Y%m%d-%H%M%S).json

gsutil cp breach-evidence-*.json gs://hmatologia2-incident-backups/logs/
```

### 2. Assess scope (15 min):

```bash
# Which collections accessed?
gcloud logging read "jsonPayload.operation = read AND severity >= WARNING" \
  --project=hmatologia2 --limit=1000 | jq -r '.[] | .jsonPayload.path' | sort -u
# Expected: pacientes, laudos, declaracoes (don't see if only system collections)

# How many patients?
gcloud firestore query --project=hmatologia2 pacientes \
  --limit=10000 | jq 'length'
# If < 100: Severity P1
# If > 100: Severity P0 (notify ANPD + ANVISA)

# What fields?
# In Firebase Console: open one patient doc
# List all visible fields (names, CPF, diagnoses, test results, etc.)
```

### 3. Notify (within 72 hours):

```bash
# Draft customer notification
# Template in INCIDENT_RESPONSE_PLAYBOOK.md § Section 3.2
# Include:
# - Date/time detected
# - Which patients (names or ID range)
# - Which fields exposed
# - What you did to contain
# - What they should do

# Submit to ANPD (Brazilian Data Protection Authority)
# Template in INCIDENT_RESPONSE_PLAYBOOK.md § Section 3.3
# Include: scope, root cause, remediation, contact info

# Note: LGPD Art. 34 deadline = 72 hours from detection to notification
```

---

## When a Permission Denied Error Appears (P1)

### 1. Isolate the error:

```bash
# Get exact error from Cloud Logs
gcloud logging read "text:\"Permission denied\"" \
  --project=hmatologia2 --limit=20 --format=json | jq '.[0]'

# Look for:
# - Which collection? ("path": "/labs/xyz/coleção/doc")
# - Who tried? ("principalEmail": "...")
# - What operation? ("operation": "read" or "write")
```

### 2. Check rules:

```bash
# Open firestore.rules in editor
nano firestore.rules

# Find the matching path:
# Example: match /labs/{labId}/pacientes/{rest=**}
# Check: Is there an `allow read: if ...` rule?

# Common issue: Missing claim provisioning
# Check if the user has the right claims:
# gcloud iam service-accounts get-iam-policy projects/hmatologia2 \
#   --format=json | jq '.bindings[] | select(.role | contains("ROLE"))'
```

### 3. Remediation:

```bash
# Option A: Rules are correct, user has wrong claims
# → Run provisionModulesClaims() function (CTO only)

# Option B: Rules are broken (bad recent deploy)
# → Rollback to previous rules:
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules --project hmatologia2

# Option C: Rules need update for new feature
# → Edit firestore.rules + test locally:
firebase emulators:exec --only firestore "npm test"
# Must pass 100% before deploying
```

---

## When the Database Can't Connect (P0)

### 1. Is it a regional outage?

```bash
# Check Google Cloud Status
# Browser → status.cloud.google.com
# Look for: southamerica-east1 São Paulo region

# If YES: Wait up to 2 hours
#         Status page shows auto-recovery ETA
#         Update customers every 30 min: "Issue in GCP region. We are monitoring recovery."

# If NO: Proceed to step 2
```

### 2. Check Firestore quota:

```bash
# Admin console → Firestore → Usage
# Look at: Read ops/day, Write ops/day
# If quota exceeded: Request increase OR enable auto-scaling

# Alternative: Check logs
gcloud logging read "\"Request rate exceeded\"" \
  --project=hmatologia2 --limit=10
# If many: Someone running bulk operation (Drive importer, data migration, etc.)
# → Contact them to pause
```

### 3. If local app issue:

```bash
# Check Cloud Functions
gcloud logging read "resource.type=cloud_function AND severity >= ERROR" \
  --project=hmatologia2 --limit=50

# Check if function is crashing (stack trace)
# If yes: Redeploy
firebase deploy --only functions --project hmatologia2
```

---

## Credential Compromised (P0: Security)

### 1. IMMEDIATE (0–5 min):

```bash
# If HCQ_SIGNATURE_HMAC_KEY exposed:
gcloud secrets versions destroy --secret=HCQ_SIGNATURE_HMAC_KEY \
  --project=hmatologia2
# (Prevents new functions from reading it)

# If Firebase Admin SDK key exposed:
gcloud services api-keys delete projects/hmatologia2/locations/global/keys/[KEY_ID]

# If GCP service account compromised:
# → Cloud Console → Service Accounts → [account] → Manage keys → Delete old key
```

### 2. Investigate scope (15 min):

```bash
# When was credential last used?
gcloud logging read "protoPayload.authenticationInfo.principalEmail = 'service-account@...'" \
  --project=hmatologia2 --limit=1000

# Were there unauthorized writes?
# → If ANY writes: go to Section 2.6.3 (Data Restore)
# → If only reads: less critical (rotate key + move on)
```

### 3. Create new credential:

```bash
# Generate new key/secret
openssl rand -hex 32  # For HMAC key
# OR use gcloud to create new service account key

# Update all systems:
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY \
  --project=hmatologia2
# (Paste new secret, press enter)

firebase deploy --only functions --project=hmatologia2
```

### 4. Document baseline reset:

```bash
# Mark in audit trail that secret was rotated
# This tells auditors: old signatures are from pre-rotation baseline
# Add synthetic event: eventType = "chain-baseline-reset"
# (See ADR-0017 for details)
```

---

## LGPD Deletion Request Overdue (P1: Compliance)

### 1. Verify it's overdue:

```bash
# Check request timestamp
gcloud firestore describe \
  projects/hmatologia2/databases/\(default\)/documents/lgpd-requests/lab-xyz/req-abc

# Look at: createdAt field
# Calculate: today - createdAt > 30 days?
# If YES: overdue (incident)
```

### 2. Immediate action:

```bash
# Execute deletion immediately
curl -X POST https://hmatologia2.web.app/api/lgpd/execute-deletion \
  -H "Authorization: Bearer [admin-token]" \
  -d '{"requestId":"req-abc"}'

# Verify it executed
gcloud firestore describe \
  projects/hmatologia2/databases/\(default\)/documents/lgpd-requests/lab-xyz/req-abc
# Look at: status field should be "deletion_completed"
```

### 3. Document & notify:

```bash
# Add entry to incident log
# Include: request created [date], deletion executed [date], days overdue [number]

# Notify compliance: "LGPD deletion overdue. Request executed. Audit trail preserved."

# Root cause: Why was this not processed in time?
# Was webhook not triggered? Did Cloud Function crash?
# Create Jira ticket to prevent recurrence
```

---

## Escalation Phone Script

**When you need to call CTO during incident:**

```
"Hi [name], this is [your name] from DevOps. 
We have a P0 incident in production.

[Type]: [data breach | system down | data corruption | etc.]
[Summary]: [1–2 sentence description of impact]
[Timeline]: [when detected, how long ago]
[Scope]: [affected modules, number of users/patients]

Status: [investigating | ready for your decision on remediation]

We have created a Google Meet incident room: [link]

Can you join in the next [2 min | 5 min]?
"
```

---

## When You're Stuck: Escalate

**Rule:** Uncertainty = escalate (don't guess, don't try risky commands).

```bash
# Document current state
git log --oneline -3 > situation.txt
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=50 > logs.txt

# Post to Slack
#incident: "Status unclear. Logs attached. CTO input needed."

# Call CTO if no Slack response in 2 min
```

---

## Post-Incident Checklist (After resolution)

```
[ ] Incident record created: docs/incidents/INC-YYYY-MM-DD-###.md
[ ] Root cause documented (not "unknown")
[ ] Preventive action Jira ticket created (if applicable)
[ ] Customer notified: "Issue resolved at [time]. We apologize for disruption."
[ ] Evidence archived: Cloud Logs → GCS
[ ] Post-mortem scheduled: Within 24 hours
[ ] Slack thread closed: "Incident resolved. Details in RCA."
```

---

**Version:** 1.0 | **Last updated:** 2026-05-07

Print. Laminate. Carry. Reference under pressure.

No guessing. No hesitation. Execute.
