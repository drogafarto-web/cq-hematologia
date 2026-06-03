---
title: 'NOTIVISA Credential Rotation & Emergency Procedures'
date_created: '2026-05-07'
version: '1.0'
status: 'Active'
audience: 'DevOps + Security + Operations'
---

# NOTIVISA Credential Rotation & Emergency Procedures

Complete procedures for managing NOTIVISA sandbox and production credentials throughout their lifecycle.

---

## Table of Contents

1. [Credential Lifecycle](#credential-lifecycle)
2. [Scheduled Annual Rotation](#scheduled-annual-rotation)
3. [Emergency Revocation](#emergency-revocation)
4. [Credential Audit Trail](#credential-audit-trail)
5. [Version Control Integration](#version-control-integration)
6. [Rollback Procedures](#rollback-procedures)
7. [Compliance & Logging](#compliance--logging)

---

## Credential Lifecycle

### Timeline

| Phase                     | Date        | Action                                     | Status    |
| ------------------------- | ----------- | ------------------------------------------ | --------- |
| **Initial Provisioning**  | 2026-05-07  | ANVISA sandbox credentials issued          | Pending   |
| **First Rotation**        | 2027-05-07  | Annual renewal                             | Scheduled |
| **Second Rotation**       | 2028-05-07  | Annual renewal                             | Future    |
| **Production Onboarding** | 2026-11-01+ | Certificate + prod credentials provisioned | v1.5+     |

### Credential Types

| Credential                         | Type                   | Rotation Frequency | Storage                        | Usage                 |
| ---------------------------------- | ---------------------- | ------------------ | ------------------------------ | --------------------- |
| **NOTIVISA_SANDBOX_API_KEY**       | API Key (alphanumeric) | Annual (May)       | Firebase Secrets Manager       | Sandbox submission    |
| **NOTIVISA_SANDBOX_ENDPOINT**      | URL                    | On-change (rare)   | Firebase config + .env.sandbox | Sandbox API routing   |
| **NOTIVISA_LAB_CNPJ**              | Business ID            | Never (fixed)      | Firebase Secrets Manager       | Lab identification    |
| **NOTIVISA_REGISTRATION_ID**       | Reference ID           | Never              | Firebase Secrets Manager       | Support/debugging     |
| **NOTIVISA_PROD_API_KEY** (v1.5+)  | API Key                | Annual             | Firebase Secrets Manager       | Production submission |
| **NOTIVISA_CERT_PFX** (v1.5+)      | Digital certificate    | Annual             | Firebase Secrets Manager       | mTLS auth             |
| **NOTIVISA_CERT_PASSWORD** (v1.5+) | Certificate passphrase | Annual             | Firebase Secrets Manager       | Certificate unlock    |

---

## Scheduled Annual Rotation

### Timeline

- **Start date:** 4 weeks before expiry
- **Completion date:** 1 week before expiry
- **Test window:** 1 week post-rotation
- **Rollback window:** 2 weeks (in case of issues)

### Step 1: Prepare for Rotation (4 weeks before)

**1.1 Notify stakeholders**

```bash
# Email to stakeholders (ops, cto, compliance)
Subject: NOTIVISA Credential Rotation Planned for [DATE]

Timeline:
  - Week 1 (now): Notify + request new credentials from ANVISA
  - Week 2-3: Receive + test new credentials
  - Week 4: Promote to production + monitor for 1 week
  - Rollback window: 2 weeks post-production
```

**1.2 Request new credentials from ANVISA**

```bash
# Contact ANVISA support
# URL: https://portalanvisa.gov.br/notivisa
# Support email: (confirm during initial registration)

Subject: "HC Quality NOTIVISA Sandbox Credential Rotation Request"

Body:
  Lab: [lab_name]
  CNPJ: [cnpj]
  Registration ID: [NOTIVISA_REGISTRATION_ID]
  Current Key Expires: [date]
  Requested Delivery: [date, 2 weeks before expiry]
  Action: Request new API key for continued sandbox testing
  Reason: Annual security rotation per policy
```

**1.3 Document start of rotation**

```bash
cat >> docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt <<EOF
═══════════════════════════════════════════════════════════════
Date: $(date -u +%Y-%m-%d)
Event: Credential rotation initiated
Type: Scheduled annual rotation
Current Key: [last 8 chars] (set: 2025-05-07)
Expected New Key: Pending from ANVISA
Target Promotion: [date + 2 weeks]
Owner: [devops lead]
═══════════════════════════════════════════════════════════════
EOF
```

### Step 2: Receive & Test New Credentials (2-3 weeks)

**2.1 Receive credentials from ANVISA**

Expect email containing:

- New API Key (alphanumeric, ~32 characters)
- Confirmation of sandbox endpoint URL (should be same as current)
- Optional: Certificate thumbprint (if upgrading to mTLS)

**2.2 Store new credentials in test environment**

Create temporary secrets with `_NEW` suffix:

```bash
# Set new sandbox API key
firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY_NEW --project=hmatologia2
# Paste new key when prompted

# Verify new secret exists
gcloud secrets list --project=hmatologia2 | grep NOTIVISA
# Should show both NOTIVISA_SANDBOX_API_KEY and NOTIVISA_SANDBOX_API_KEY_NEW
```

**2.3 Test new credentials in isolated environment**

```bash
# Create test Cloud Function that uses new key
# File: functions/src/modules/notivisa/test/testNewCredentials.ts

import * as functions from 'firebase-functions/v2/https';

export const testNotivisaNewCredentials = functions
  .region('southamerica-east1')
  .onCall(async (request) => {
    try {
      // Load new secret
      const newApiKey = process.env.NOTIVISA_SANDBOX_API_KEY_NEW;
      const endpoint = process.env.NOTIVISA_SANDBOX_ENDPOINT;

      if (!newApiKey) {
        throw new Error('New API key not set');
      }

      // Test connectivity
      const response = await axios.get(`${endpoint}health`, {
        headers: {
          'Authorization': `Bearer ${newApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return {
        ok: true,
        status: response.status,
        message: 'New credentials validated successfully',
        testedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
      };
    }
  });
```

Deploy and test:

```bash
# Deploy test function
firebase deploy --only functions:testNotivisaNewCredentials --project=hmatologia2

# Invoke test (via Cloud Console or CLI)
gcloud functions call testNotivisaNewCredentials \
  --gen2 \
  --region=southamerica-east1 \
  --project=hmatologia2

# Expected output:
# {
#   "ok": true,
#   "status": 200,
#   "message": "New credentials validated successfully",
#   "testedAt": "2026-05-15T14:32:00Z"
# }
```

**2.4 Run integration tests with new credentials**

```bash
# Load new key into environment
export NOTIVISA_SANDBOX_API_KEY="$(gcloud secrets versions access latest --secret=NOTIVISA_SANDBOX_API_KEY_NEW --project=hmatologia2)"

# Run full test suite
npm run test:notivisa-sandbox

# Expected: All 3 test payloads (syphilis, dengue, HIV) pass
```

**2.5 Document test results**

```bash
cat >> docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt <<EOF

Credential Test Results:
  New Key: [last 8 chars]
  Received: $(date -u +%Y-%m-%d)
  Connectivity Test: PASS
  Integration Tests: 3/3 passed
    - Syphilis payload: PASS
    - Dengue payload: PASS
    - HIV payload: PASS
  Duration: [test duration]ms
  Tester: [name/initials]
EOF
```

### Step 3: Promote to Production (1 week before expiry)

**3.1 Delete old secret version**

```bash
# List all versions
gcloud secrets versions list NOTIVISA_SANDBOX_API_KEY --project=hmatologia2

# Destroy old version(s), keep current as reference
# Note: Cannot destroy all versions, keep 1 for audit trail
gcloud secrets versions destroy 2 \
  --secret=NOTIVISA_SANDBOX_API_KEY \
  --project=hmatologia2
```

**3.2 Promote new secret to active**

```bash
# Set new credentials as primary secret
firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY --project=hmatologia2
# Paste new API key when prompted

# Verify new version is active
gcloud secrets describe NOTIVISA_SANDBOX_API_KEY --project=hmatologia2 | grep "updated"

# Delete temporary _NEW secret
gcloud secrets delete NOTIVISA_SANDBOX_API_KEY_NEW --project=hmatologia2
```

**3.3 Redeploy all NOTIVISA functions**

```bash
# Build functions
cd functions
npm run build 2>&1 | tail -5

# Deploy NOTIVISA functions
firebase deploy \
  --only functions:notivisaDraftCreate,functions:notivisaQueueProcessor \
  --project=hmatologia2

# Verify deployment successful
gcloud functions describe notivisaDraftCreate \
  --region=southamerica-east1 \
  --project=hmatologia2 | grep "status\|updateTime"
```

**3.4 Monitor Cloud Logs**

```bash
# Watch logs for 10 minutes post-deployment
watch -n 10 'gcloud functions logs read notivisaQueueProcessor \
  --limit=5 \
  --region=southamerica-east1 \
  --project=hmatologia2'

# Check for errors
gcloud functions logs read \
  --filter='severity="ERROR"' \
  --limit=20 \
  --region=southamerica-east1 \
  --project=hmatologia2
```

**Expected**: 0 errors, functions responding normally.

### Step 4: Post-Rotation Validation (1 week)

**4.1 Smoke tests**

```bash
# Test via Cloud Function callable
# Trigger a test draft creation
firebase functions:call notivisaDraftCreate \
  --data='{"labId":"test-lab-001","laudoId":"test-laudo-001"}' \
  --region=southamerica-east1 \
  --project=hmatologia2

# Expected: Draft created successfully with new credentials
```

**4.2 Firestore audit check**

```bash
# Verify submissions using new credentials
gcloud firestore documents list \
  --collection-ids=notivisa-outbox \
  --project=hmatologia2 | \
  jq '.[] | {id: .name, createdAt: .createTime}' | \
  tail -10
```

**4.3 Alert monitoring**

```bash
# Check alert policies fired no false positives
gcloud monitoring policies list --project=hmatologia2 | grep -i notivisa

# Verify no P1 alerts about authentication failures
gcloud logging read \
  'resource.type="cloud_function" AND severity="ERROR" AND resource.labels.function_name=~"notivisa.*"' \
  --limit=10 \
  --project=hmatologia2
```

### Step 5: Document & Archive (Post-rotation)

**5.1 Final rotation log entry**

```bash
cat >> docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt <<EOF

Rotation Completed Successfully:
  Old Key: [last 8 chars] (destroyed on [date])
  New Key: [last 8 chars] (active as of [date])
  Deployment: functions:notivisaDraftCreate, functions:notivisaQueueProcessor
  Post-Rotation Validation: PASS
    - Smoke tests: 3/3 passed
    - Cloud Logs: 0 errors for 7 days
    - No P1 alerts triggered
  Rollback Status: Successful rotation, no rollback required
  Signed by: [devops lead]
  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
```

**5.2 Update documentation**

```bash
# Update credential expiry date in CLAUDE.md or runbooks
sed -i 's/Credentials valid until.*/Credentials valid until 2027-05-07/' docs/NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md
```

---

## Emergency Revocation

### When to Revoke

- Credentials suspected compromised (leaked, exposed in logs)
- Credential stolen or misused
- Unauthorized access detected
- Regulatory directive to revoke

### Immediate Actions (< 15 minutes)

**1. Revoke in ANVISA portal**

```bash
# Log into ANVISA
# https://portalanvisa.gov.br/notivisa

# Navigate to: Account Settings → API Keys → Revoke
# Click "Revoke" on current key
# Confirm revocation (irreversible)
```

**2. Delete secret from Firebase**

```bash
# Destroy current secret version
gcloud secrets versions destroy latest \
  --secret=NOTIVISA_SANDBOX_API_KEY \
  --project=hmatologia2 \
  --quiet

# Stop all NOTIVISA functions (they will fail without credentials)
firebase functions:delete notivisaDraftCreate \
  --region=southamerica-east1 \
  --project=hmatologia2 \
  --force

firebase functions:delete notivisaQueueProcessor \
  --region=southamerica-east1 \
  --project=hmatologia2 \
  --force
```

**3. Clear environment variables**

```bash
# Delete any .env files with old credentials
rm -f .env.sandbox .env.local

# Kill running processes that may hold cached credentials
pkill -f "firebase.*emulator"
pkill -f "node.*functions"
```

**4. Notify stakeholders**

```bash
# Email alert to security + ops teams
Subject: "URGENT: NOTIVISA Sandbox Credential Revoked - [date] [time]"

Body:
  Incident: Credential revocation
  Time: [UTC timestamp]
  Reason: [specify: leaked, compromised, policy]
  Action Taken:
    1. ANVISA portal revocation: DONE
    2. Firebase Secrets Manager deletion: DONE
    3. Cloud Functions halted: DONE
  Next Steps:
    - Waiting for emergency replacement from ANVISA
    - ETA: [specify, typically 2-4 hours]
    - NOTIVISA submissions will queue but not process until credentials restored
  Incident Owner: [devops on-call]
  Escalation: [CTO contact if not resolved in 2 hours]
```

### Recovery (2-4 hours)

**1. Request emergency replacement from ANVISA**

```bash
# Contact emergency support
# Email: [emergency contact from registration]
# Phone: [24/7 support number from registration]

Subject: "URGENT: HC Quality NOTIVISA Credential Revocation - Emergency Replacement"

Body:
  Lab: [lab_name]
  CNPJ: [cnpj]
  Registration ID: [NOTIVISA_REGISTRATION_ID]
  Issue: Current API key compromised and revoked
  Request: Emergency replacement key (expedited delivery)
  Urgency: Critical - production system affected
  Contact: [on-call engineer phone + email]
```

**2. Once replacement received**

Follow steps 2.2-2.3 above (Test New Credentials), then proceed directly to Step 3 (Promote to Production).

**3. Re-deploy functions**

```bash
# Same as Step 3.3 above
firebase deploy \
  --only functions:notivisaDraftCreate,functions:notivisaQueueProcessor \
  --project=hmatologia2
```

**4. Process queued submissions**

Any NOTIVISA drafts that were stuck in `pending` status will automatically retry:

```bash
# Query pending drafts that should now process
gcloud firestore documents list \
  --collection-ids=notivisa-outbox \
  --project=hmatologia2 | \
  jq '.[] | select(.status == "pending")'

# Monitor processor logs
gcloud functions logs read notivisaQueueProcessor \
  --limit=50 \
  --region=southamerica-east1 \
  --project=hmatologia2
```

---

## Credential Audit Trail

### Audit Log File

Location: `docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt`

**Format:**

```
═══════════════════════════════════════════════════════════════
Date: YYYY-MM-DD
Event: [rotation|revocation|emergency]
Type: [scheduled|unscheduled]
Old Key: [last 8 chars] (created: YYYY-MM-DD)
New Key: [last 8 chars] (created: YYYY-MM-DD)
Reason: [annual rotation|compromise|policy change|etc]
Status: [in-progress|completed|failed]
Deployments: [list of functions deployed]
Tests: [pass|fail] ([number passed/failed])
Notes: [additional context]
Signed by: [name/email]
═══════════════════════════════════════════════════════════════
```

### Audit Trail Queries

**View all rotations:**

```bash
cat docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt | grep "^Date:" | wc -l
# Output: Number of rotations in history
```

**View recent activity:**

```bash
tail -50 docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt
```

**View compromises:**

```bash
grep -i "compromise\|emergency\|revoc" docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt
```

---

## Version Control Integration

### Git Workflow

**Critical: Never commit credentials to Git**

```bash
# Ensure .env.sandbox is gitignored
echo ".env.sandbox" >> .gitignore
git add .gitignore
git commit -m "Protect .env.sandbox from accidental commit"

# Verify
git check-ignore .env.sandbox
# Output: .env.sandbox (should show gitignored)
```

### Audit Trail in Version Control

Instead of storing credentials, maintain rotation log in Git:

```bash
# Credentials: Firebase Secrets Manager only
# Audit trail: docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt

git add docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt
git commit -m "chore: log NOTIVISA credential rotation"
```

---

## Rollback Procedures

### When to Rollback

- New credentials fail authentication tests
- Post-deployment errors in production
- ANVISA API incompatibility with new key
- Data corruption or unexpected failures

### Rollback Steps

**1. Identify last known-good version**

```bash
gcloud secrets versions list NOTIVISA_SANDBOX_API_KEY --project=hmatologia2 --limit=5

# Example output:
# 3  2026-05-15  ENABLED   (current, broken)
# 2  2026-05-07  ENABLED   (previous, good)
# 1  2025-05-07  DISABLED  (too old)
```

**2. Revert to previous version**

```bash
# Restore version 2
gcloud secrets versions enable 2 --secret=NOTIVISA_SANDBOX_API_KEY --project=hmatologia2

# Verify version 2 is now active
gcloud secrets describe NOTIVISA_SANDBOX_API_KEY --project=hmatologia2 | grep updated
```

**3. Redeploy functions**

```bash
firebase deploy \
  --only functions:notivisaDraftCreate,functions:notivisaQueueProcessor \
  --project=hmatologia2

# Wait for deployment to complete
```

**4. Verify rollback**

```bash
# Test with old credentials
bash scripts/test-notivisa-sandbox-connectivity.sh

# Check Cloud Logs for errors
gcloud functions logs read notivisaQueueProcessor \
  --limit=10 \
  --region=southamerica-east1 \
  --project=hmatologia2
```

**5. Document rollback**

```bash
cat >> docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt <<EOF

Rollback Executed:
  Issue: New key (version 3) failed authentication
  Root Cause: [investigate and document]
  Reverted to: Version 2 (2026-05-07)
  Functions: notivisaDraftCreate, notivisaQueueProcessor
  Verification: PASS (Cloud Logs clean)
  Time to Recover: [duration]
  Next Action: [retry rotation, contact ANVISA, etc]
  Signed by: [name/email]
  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
```

---

## Compliance & Logging

### Regulatory Requirements

- **RDC 978 Art. 41:** Audit trail of all system actions (including credential changes)
- **DICQ 4.4:** Immutable logging of sensitive operations
- **LGPD:** Data security measures (credential rotation = data protection)

### Audit Evidence

Collect for regulatory inspection:

```bash
# 1. Rotation log file (this document)
cp docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt /tmp/audit_notivisa_rotation.txt

# 2. Cloud Logs export (credentials used for submissions)
gcloud logging read \
  'resource.type="cloud_function" AND resource.labels.function_name=~"notivisa.*"' \
  --limit=1000 \
  --format=json > /tmp/audit_notivisa_logs.json

# 3. Firestore audit trail
gcloud firestore documents list \
  --collection-ids=auditLogs \
  --project=hmatologia2 | \
  jq '.[] | select(.data.action | contains("notivisa"))' > /tmp/audit_notivisa_firestore.json

# Bundle for auditor
tar -czf audit_notivisa_2026-05-07.tar.gz \
  /tmp/audit_notivisa_rotation.txt \
  /tmp/audit_notivisa_logs.json \
  /tmp/audit_notivisa_firestore.json
```

---

## Reference Procedures

### Quick Reference Card (Print & Post)

```
╔══════════════════════════════════════════════════════════════╗
║    NOTIVISA CREDENTIAL EMERGENCY PROCEDURES                  ║
║    Post at: DevOps desk, Server room, On-call rotation       ║
╚══════════════════════════════════════════════════════════════╝

CREDENTIAL REVOKED OR COMPROMISED?

1. IMMEDIATE (< 5 min):
   [ ] Revoke in ANVISA: https://portalanvisa.gov.br/notivisa
   [ ] Delete secret: gcloud secrets delete NOTIVISA_SANDBOX_API_KEY
   [ ] Stop functions: firebase functions:delete notivisaQueueProcessor

2. NOTIFY (< 10 min):
   [ ] Email: ops@labclin.com.br, cto@labclin.com.br
   [ ] Include: What happened + when + actions taken

3. RECOVER (2-4 hours):
   [ ] Contact ANVISA emergency: [phone + email]
   [ ] Await replacement credentials
   [ ] Test new credentials (see full procedures)
   [ ] Redeploy functions
   [ ] Verify Cloud Logs

4. POST-INCIDENT (24 hours):
   [ ] Document root cause in rotation log
   [ ] Review access logs for breach confirmation
   [ ] Schedule post-mortem with team

Contact Info:
  ANVISA Support: [fill from registration email]
  DevOps On-Call: [fill from rotation]
  CTO: [fill from contacts]

For complete procedures, see: docs/NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md
```

---

**Status:** 🟢 **Active**  
**Created:** 2026-05-07  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-08-07 (quarterly)  
**Owner:** DevOps Lead + Security Team
