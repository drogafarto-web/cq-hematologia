# Runbook: Portal Auth Failures Spike

**Alert Name:** `portal-auth-failures-spike`  
**Severity:** P1 — Critical customer impact  
**Response Time SLA:** <15 minutes  
**Escalation:** CTO if unresolved >30min

---

## What This Alert Means

Portal patients cannot authenticate or access their results. Auth token generation is failing at >5 errors per 5 minutes. This blocks the entire Portal feature (Phase 4).

---

## Immediate Triage (2 minutes)

### 1. Confirm Alert is Real

```bash
cd /c/hc\ quality

# Count errors in past 5 minutes
gcloud logging read \
  'resource.type="cloud_function" AND severity>=ERROR AND \
   (textPayload=~"verifyPatientAuthToken|generatePatientAuthLink")' \
  --limit=20 --project=hmatologia2 --format=json | \
  jq 'length'
```

Expected: >5 errors confirms alert is active.

### 2. Get Error Details

```bash
gcloud logging read \
  'resource.type="cloud_function" AND severity>=ERROR AND \
   (textPayload=~"verifyPatientAuthToken|generatePatientAuthLink")' \
  --limit=20 --project=hmatologia2 --format=json | \
  jq '.[] | {timestamp: .timestamp, function: .labels.functionName, error: .textPayload}'
```

**Look for error patterns:**
- `PERMISSION_DENIED` → Firestore rule violation (Section 2A)
- `SendGrid` / `RESEND` error → Email service down (Section 2B)
- `undefined is not a function` → Missing HMAC secret (Section 2C)
- Function timeout → Performance issue (Section 2D)

---

## Diagnosis Decision Tree

### Decision: What is the error type?

**A. PERMISSION_DENIED on Firestore read** → Go to **Section 2A**

**B. SendGrid / RESEND API error** → Go to **Section 2B**

**C. Signature validation error (HMAC, hash mismatch)** → Go to **Section 2C**

**D. Function timeout or slow execution** → Go to **Section 2D**

**E. Other / Unknown** → Page CTO immediately

---

## Section 2A: Firestore Rules Check

**Applies if:** Error contains `PERMISSION_DENIED` or `Permission Denied`

### Step 1: Check Rules Syntax

```bash
cd /c/hc\ quality

# Validate syntax
npx firebase-rules-compile firestore.rules
```

**Expected:** `✓ No errors`  
**If error:** Go to **Step 2** below

### Step 2: If Rules Syntax is Broken

```bash
# Compare against last known good version
git diff HEAD~1 firestore.rules | head -50
```

**Actions:**
1. If recent change, revert:
   ```bash
   git revert HEAD --firestore.rules
   ```
2. Deploy corrected rules:
   ```bash
   firebase deploy --only firestore:rules --project=hmatologia2
   ```
3. Wait 2 minutes for deployment to propagate
4. Re-test: Try to authenticate as patient in portal
5. Monitor error rate (should drop immediately)

### Step 3: If Rules Syntax is Correct

**Check the specific rejection path:**

```bash
gcloud logging read \
  'resource.type="firestore" AND textPayload=~".*Permission.*denied.*"' \
  --limit=20 --project=hmatologia2 --format=json | \
  jq '.[] | {path: .labels.documentPath, user_id: .labels.uid, operation: .labels.operation}'
```

**Patterns to identify:**

| Pattern | Cause | Fix |
|---------|-------|-----|
| Path `/labs/ABC/patients/XYZ`, user is patient | Correct access (should be allowed) | Rule syntax bug → check isActiveMemberOfLab() function |
| Path `/labs/ABC/admin-only`, user is patient | Patient accessing admin collection | Expected rejection (not a bug) |
| Path `/labs/ABC/patients/XYZ`, user is RT | RT accessing patient collection | Rule syntax bug → check role check in rules |

**If rule is correct but rejections persist:**

1. **Check patient session token:**
   - Get token from browser console (patient portal):
     ```javascript
     // Browser console while logged in as patient
     const token = await auth.currentUser.getIdTokenResult();
     console.log(token.claims.labId);  // Should match accessed lab
     console.log(token.claims.role);   // Should be 'patient'
     ```

2. **If token has wrong labId:**
   - Patient is logged into wrong lab account
   - Fix: Have patient logout + re-login to correct lab
   - Not a bug — support issue

3. **If token has wrong role:**
   - Session token corrupted (should not happen)
   - Fix: Soft-delete patient session + force re-auth
   - Page CTO if pattern repeats

---

## Section 2B: Email Service Check

**Applies if:** Error contains `SendGrid` or `RESEND` or `email service`

### Step 1: Check Service Status

```bash
# SendGrid
curl -s https://status.sendgrid.com/api/v2/status.json | \
  jq '.status.indicator'

# Expected: "none" = operational
# If "minor" or "major": vendor outage
```

**If vendor is down:**
1. Post to `#production-alerts`: "SendGrid/RESEND is experiencing outage. Estimated recovery: [ETA]"
2. Notify patient support team (patients cannot receive auth links)
3. Check if fallback email provider is configured (see `.env`)
4. If no fallback, discuss portal access options with CTO
5. Monitor vendor status dashboard hourly

**If vendor is operational:** Continue to Step 2

### Step 2: Check SendGrid Account Quota

```bash
# Get API key
SENDGRID_KEY=$(gcloud secrets versions access latest --secret=SENDGRID_API_KEY --project=hmatologia2)

# Check quota via API
curl -s https://api.sendgrid.com/v3/user/credits \
  -H "Authorization: Bearer $SENDGRID_KEY" | \
  jq '.remaining'
```

**If quota is 0:**
1. Log into SendGrid dashboard → Settings → Billing
2. Upgrade plan OR
3. Purchase additional email credits
4. Monitor quota recovery within 30 minutes

**If quota is OK:** Continue to Step 3

### Step 3: Check Email Template

**Test template rendering:**

```bash
# Get sample patient data
gcloud firestore documents get \
  labs/sample-lab-id/patients/sample-patient-id \
  --project=hmatologia2 | jq '.data'

# Verify patient email is valid
# Look for: email field exists and is not null
```

**If email is missing or invalid:**
1. This patient's email address is not in database
2. Support team must add/correct email address
3. Retry email delivery to corrected address

**If email is valid:** 

1. Check email template in code:
   ```bash
   cat functions/src/modules/auth/templates/generatePatientAuthLink.html
   ```

2. Look for:
   - Syntax errors (unclosed tags)
   - Variable interpolation errors (undefined variables)
   - Long/complex expressions that might fail

3. If error found:
   - Fix template
   - Test locally: `npm run test:email`
   - Deploy: `firebase deploy --only functions`

---

## Section 2C: Token Validation / HMAC Secret

**Applies if:** Error contains `HMAC`, `signature`, `hash mismatch`, or `undefined is not a function`

### Step 1: Check HMAC Secret is Bound

```bash
# Find HMAC-related code
grep -r "HCQ_SIGNATURE\|defineSecret.*HMAC" functions/src/modules/ | head -5

# Expected: Should see defineSecret() call in function definition
```

**If no defineSecret() call:**
1. Open function file (e.g., `functions/src/modules/auth/verifyPatientAuthToken.ts`)
2. Add at top:
   ```typescript
   import { defineSecret } from 'firebase-functions/params';
   
   const hmacKey = defineSecret('HCQ_SIGNATURE_HMAC_KEY');
   ```

3. Add to function declaration:
   ```typescript
   export const verifyPatientAuthToken = onCall(
     { secrets: [hmacKey], region: 'southamerica-east1' },
     async (request) => {
       const key = hmacKey.value();
       // ... rest of function
     }
   );
   ```

4. Save and deploy:
   ```bash
   firebase deploy --only functions:verifyPatientAuthToken --project=hmatologia2
   ```

**If defineSecret() is present:**

### Step 2: Check Secret is Provisioned

```bash
# List all secrets
gcloud secrets list --project=hmatologia2 | grep HCQ

# Expected: Should see HCQ_SIGNATURE_HMAC_KEY listed
```

**If secret is not listed:**
1. Provision it:
   ```bash
   firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project=hmatologia2
   ```
   (Will prompt for value — ask CTO for current key value)

2. Deploy function to use new secret:
   ```bash
   firebase deploy --only functions --project=hmatologia2
   ```

### Step 3: Verify Secret Value Matches Signer

```bash
# Get current secret value
gcloud secrets versions access latest --secret=HCQ_SIGNATURE_HMAC_KEY --project=hmatologia2

# Compare against signer code (see functions/src/modules/signatures/)
# The HMAC key must be identical — if mismatched, tokens are invalid
```

**If values don't match:**
1. Check `functions/src/modules/signatures/index.ts` for signer logic
2. Verify both functions use same key + algorithm
3. If issue found, rotate secret (see ADR-0017 procedure)
4. Deploy function
5. **Note:** Existing patient tokens will be invalid — ask Support to notify patients

---

## Section 2D: Performance / Timeout

**Applies if:** Error contains `timeout`, `DEADLINE_EXCEEDED`, or execution time >60s

### Step 1: Check Function Execution Time

```bash
# Get recent execution times
gcloud logging read \
  'resource.type="cloud_function" AND \
   (labels.functionName="verifyPatientAuthToken" OR \
    labels.functionName="generatePatientAuthLink")' \
  --limit=20 --project=hmatologia2 --format=json | \
  jq '.[] | {function: .labels.functionName, duration: .duration, status: .severity}'
```

**Expected:** duration <1000ms (1 second) for warm execution

**If duration >5000ms (5 seconds):**

### Step 2: Identify Bottleneck

**Check if cold start:**
```bash
# First invocation after deploy will be slow (normal)
# Monitor warm execution (2nd+ invocations)
```

**Check Firestore query performance:**
```bash
# Monitor Firestore quota usage
gcloud monitoring read \
  'metric.type="firestore.googleapis.com/document_reads"' \
  --project=hmatologia2 | tail -5
```

**If quota approaching limit:**
- Firestore is rate-limiting reads
- Scale up quota in Firebase Console → Project Settings → Firestore

**If quota OK:**
- Check for missing Firestore indexes:
  ```bash
  firebase firestore:indexes list --project=hmatologia2 | grep -E "patients|laudos"
  ```
- If index missing, create it via Firebase Console → Cloud Firestore → Indexes

### Step 3: Increase Function Memory (Temporary Fix)

```bash
# Increase memory allocation
gcloud functions deploy verifyPatientAuthToken \
  --memory=512MB \
  --region=southamerica-east1 \
  --project=hmatologia2
```

Monitor latency — should improve within 5 minutes.

---

## Recovery Validation (5 minutes)

```bash
# Monitor error rate in real-time
watch -n 5 'gcloud logging read \
  "resource.type=cloud_function AND severity>=ERROR AND \
   (textPayload=~verifyPatientAuthToken|generatePatientAuthLink)" \
  --project=hmatologia2 --limit=50 | wc -l'
```

**Success criteria:**
- Error count < 1 per 5 minutes (below alert threshold)
- At least 10 consecutive successful authentications
- Patients can access portal + view results

**If still failing after 30 min:**
1. Page CTO immediately
2. Consider rollback to v1.3 (portal-disabled)
3. Create incident ticket for root-cause analysis

---

## Post-Incident Checklist

- [ ] Create incident ticket (title: "Portal Auth Failures [date]")
- [ ] Document root cause + fix applied
- [ ] Update this runbook if new steps discovered
- [ ] Schedule post-mortem within 24h (see incident-response contacts)
- [ ] Review alert threshold (adjust if false positives)
- [ ] Notify CTO of incident for decision log

---

**Last Updated:** 2026-05-07  
**Owner:** Alert Manager + On-Call Engineer  
**Review Frequency:** Monthly
