# Runbook: Email Delivery Failure Rate > 20%

**Alert Name:** `email-delivery-failure-rate`  
**Severity:** P2 — Patients cannot receive auth links  
**Response Time SLA:** <1 hour  
**Escalation:** CTO + Support Manager

---

## What This Alert Means

> 20% of patient authentication emails are failing to send. This means patients cannot receive the magic link needed to access their results in the Portal (Phase 4).

**Impact:**

- Patients cannot authenticate
- Portal feature becomes unusable
- Compliance risk (RDC 978 Art. 167 — patient access to results)

---

## Immediate Triage (3 minutes)

### 1. Confirm Failure Rate

```bash
cd /c/hc\ quality

# Count successes vs failures in past 1 hour
START=$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%SZ')

gcloud logging read \
  "resource.type='cloud_function' AND \
   labels.functionName='generatePatientAuthLink' AND \
   timestamp>='$START'" \
  --limit=200 --project=hmatologia2 --format=json | \
  jq 'group_by(.severity) | map({severity: .[0].severity, count: length})'
```

**Expected output:**

```json
[
  { "severity": "ERROR", "count": 3 },
  { "severity": "INFO", "count": 147 }
]
# Failure rate: 3/150 = 2% ✓ OK (alert should not have fired)

# If failure rate >20%:
# { "ERROR": 30, "INFO": 120 } # 20% failure rate — alert correct
```

**If alert fired correctly:** Proceed to Step 2

**If alert fired incorrectly:** Dismiss alert + adjust threshold

### 2. Get Sample Error Messages

```bash
gcloud logging read \
  "resource.type='cloud_function' AND \
   labels.functionName='generatePatientAuthLink' AND \
   severity=ERROR" \
  --limit=20 --project=hmatologia2 --format=json | \
  jq '.[] | {timestamp: .timestamp, error: .textPayload, code: .jsonPayload.code}'
```

**Categorize errors:**

- `SendGrid API error` → Go to **Section 2A**
- `RESEND API error` → Go to **Section 2A**
- `email not found / invalid` → Go to **Section 2B**
- `Template rendering error` → Go to **Section 2C**
- `Quota exceeded` → Go to **Section 2D**

---

## Section 2A: Email Vendor Service Issue

**Applies if:** SendGrid or RESEND API errors

### Step 1: Check Vendor Status

```bash
# SendGrid
curl -s https://status.sendgrid.com/api/v2/status.json | \
  jq '.status.indicator'

# Expected: "none" = operational
# If "minor" or "major": vendor experiencing outage
```

**If vendor is down:**

1. Post to `#production-alerts`:

   ```
   ⚠️ EMAIL VENDOR OUTAGE
   Service: SendGrid/RESEND
   Status: [outage]
   ETA: [check vendor dashboard]
   Action: Patients cannot receive auth links. Use fallback if available.
   ```

2. Check for fallback email provider:

   ```bash
   grep -r "EMAIL_FALLBACK\|BACKUP.*EMAIL" functions/src/.env functions/.env.example
   ```

3. If fallback exists:
   - Switch to fallback provider temporarily
   - Monitor backlog of failed emails + retry after vendor recovers

4. If no fallback:
   - Notify CTO + Support Manager
   - Prepare patient communication (outage notice)
   - Monitor vendor status hourly

**If vendor is operational:** Continue to Step 2

### Step 2: Check SendGrid/RESEND Quota

```bash
# Get API key
SENDGRID_KEY=$(gcloud secrets versions access latest --secret=SENDGRID_API_KEY --project=hmatologia2)

# Check credits remaining
curl -s https://api.sendgrid.com/v3/user/credits \
  -H "Authorization: Bearer $SENDGRID_KEY" | \
  jq '{credits: .remaining, status: .status}'
```

**Expected:** `{"credits": 1000, "status": "active"}`

**If credits = 0:**

1. Log into SendGrid dashboard → Settings → Billing
2. Check current plan + overage limit
3. Options:
   a. Upgrade plan (increase monthly quota)
   b. Buy additional credits
   c. Switch to RESEND (if configured)

4. After adding credits, retry failed emails:
   ```bash
   # Trigger processor to retry
   gcloud functions call generatePatientAuthLink \
     --project=hmatologia2 --region=southamerica-east1 \
     --data='{"labId":"*", "retryFailed": true}'
   ```

**If credits are available:**

### Step 3: Check Rate Limiting

```bash
# SendGrid applies rate limits per sender
# Check if we're hitting limits
curl -s https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[]}' \
  -w "HTTP %{http_code}\n" 2>&1 | tail -3
```

**If HTTP 429 (Too Many Requests):**

1. We're rate-limited (too many auth emails to same patient?)
2. Check sendgrid logs for pattern:

   ```bash
   gcloud logging read \
     "resource.type='cloud_function' AND \
      textPayload=~'429|Too Many Requests'" \
     --limit=20 --project=hmatologia2
   ```

3. Solutions:
   - Space out email sends (add delay between retries)
   - Consolidate multiple auth requests into single email
   - Contact SendGrid support to increase rate limit

**If not rate-limited:** Continue to Step 4

### Step 4: Check API Configuration

```bash
# Verify SendGrid configuration is correct
gcloud secrets versions access latest --secret=SENDGRID_API_KEY --project=hmatologia2 | head -c 50

# Should start with: SG.
# If empty or starts with PENDING_: Secret not provisioned
```

**If secret is empty/placeholder:**

1. Provision correct secret:

   ```bash
   firebase functions:secrets:set SENDGRID_API_KEY --project=hmatologia2
   # Will prompt for value — ask CTO for current API key
   ```

2. Deploy function:
   ```bash
   firebase deploy --only functions:generatePatientAuthLink --project=hmatologia2
   ```

**If secret looks valid:** Contact SendGrid support + page CTO

---

## Section 2B: Invalid/Missing Email Addresses

**Applies if:** Errors contain `invalid email` or `email not found`

### Step 1: Identify Patient with Bad Email

```bash
gcloud logging read \
  "resource.type='cloud_function' AND \
   labels.functionName='generatePatientAuthLink' AND \
   (textPayload=~'invalid.*email' OR textPayload=~'email.*not.*found')" \
  --limit=20 --project=hmatologia2 --format=json | \
  jq '.[] | {timestamp: .timestamp, patient_id: .labels.patientId, error: .textPayload}'
```

### Step 2: Audit Patient Email Addresses

```bash
# Find all patients with invalid or missing emails
gcloud firestore documents list \
  --collection-ids=labs \
  --project=hmatologia2 | \
  jq '.[] |
    select(.email == null or .email == "" or \
           .email | test("^[^@]+@[^@]+\\.[^@]+$") | not) | \
    {patient_id: .id, email: .email}'
```

**Common issues:**

- Missing email (null or empty)
- Typos: `user@cmm.com` instead of `user@com.br`
- Invalid format: `user@domain` (no TLD)
- Old/expired email addresses

### Step 3: Correct Patient Data

```bash
# Update patient email (manual or bulk)
# Via Firestore Console:
# Collections > labs > {labId} > patients > {patientId} > email: [correct value]

# Or via CLI:
gcloud firestore documents update \
  labs/{labId}/patients/{patientId} \
  email="patient@correctdomain.com"
```

### Step 4: Retry Delivery

```bash
# After correcting emails, retry for those patients
gcloud functions call generatePatientAuthLink \
  --project=hmatologia2 --region=southamerica-east1 \
  --data='{"patientId": "{patientId}", "labId": "{labId}"}'
```

---

## Section 2C: Email Template Rendering Error

**Applies if:** Errors contain `template`, `undefined`, or `render` error

### Step 1: Check Template File

```bash
# Find patient auth email template
find functions/src -name "*auth*link*" -o -name "*patient*email*" | \
  grep -i template

# View template
cat functions/src/modules/auth/templates/generatePatientAuthLink.hbs
```

**Look for:**

- Unclosed HTML tags
- Undefined variables (e.g., `{{patientName}}` but name not provided)
- Complex expressions that might fail
- Character encoding issues (non-UTF8)

### Step 2: Test Template Locally

```bash
# Create test patient data
cat > /tmp/test-patient.json <<EOF
{
  "name": "Test Patient",
  "email": "test@example.com",
  "labId": "test-lab",
  "authLink": "https://portal.example.com/auth/token123"
}
EOF

# Test template render
npm run test:email -- \
  --template=generatePatientAuthLink \
  --patient=/tmp/test-patient.json
```

**If render fails:**

1. Check error message for specific line/variable
2. Fix template syntax
3. Test again

**If render succeeds:**

1. Check if rendering is deterministic (same output every time)
2. Verify link is clickable
3. Verify patient name shows correctly

### Step 3: Deploy Fix

```bash
cd functions
npm run build
firebase deploy --only functions:generatePatientAuthLink --project=hmatologia2
```

---

## Section 2D: Quota Exceeded

**Applies if:** Errors contain `quota` or `limit exceeded`

### Step 1: Check Quota Type

```bash
# Is it SendGrid monthly quota or rate limit?
gcloud logging read \
  "textPayload=~'quota|limit'" \
  --limit=10 --project=hmatologia2 | \
  grep -E "monthly|rate|daily"
```

**If monthly quota:**

- Go to **Section 2A, Step 3** (upgrade plan)

**If rate limit:**

- Go to **Section 2A, Step 3** (space out requests)

### Step 2: Check Daily Email Volume

```bash
# How many auth emails are we sending per day?
gcloud logging read \
  "resource.type='cloud_function' AND \
   labels.functionName='generatePatientAuthLink' AND \
   timestamp>='-P1D'" \
  --limit=10000 --project=hmatologia2 | \
  wc -l
```

**Expected:** <10K emails/day (SendGrid free tier allows 100/day, paid allows 1M+)

**If volume is high:**

1. Check for retry loops (patients clicking "send again" repeatedly?)
2. Implement backoff:
   ```typescript
   const lastAttempt = patient.lastAuthEmailAt;
   const now = Date.now();
   if (now - lastAttempt < 60000) {
     // 1 minute cooldown
     return { error: 'Too soon. Wait 1 minute before retrying.' };
   }
   ```

---

## Recovery Validation (10 minutes)

```bash
# Monitor success rate over time
watch -n 30 'gcloud logging read \
  "resource.type=cloud_function AND \
   labels.functionName=generatePatientAuthLink AND \
   timestamp>='\'$(date -u -d '1 hour ago' +"'"'%Y-%m-%dT%H:%M:%S'"'"')'\'' \
  --limit=500 --project=hmatologia2 --format=json | \
  jq "group_by(.severity) | map({severity: .[0].severity, count: length})"'
```

**Success criteria:**

- Success rate returns to >95%
- Failure count <5 per 100 attempts
- No new errors for 30 minutes

---

## Post-Incident Checklist

- [ ] Create incident ticket (title: "Email Delivery Failures [date]")
- [ ] Document root cause (vendor, quota, template, data quality)
- [ ] If vendor issue: Note ETA + communication sent to patients
- [ ] If quota issue: Verify plan upgrade/fallback is working
- [ ] If template issue: Unit test added to prevent regression
- [ ] If data quality issue: Create batch remediation task
- [ ] Update alert threshold if needed (adjust tolerance if false positives)
- [ ] Notify Support Manager of recovery

---

## Monitoring Tips

**Daily health check:**

```bash
# Check email success rate once per day
gcloud logging read \
  "resource.type='cloud_function' AND \
   labels.functionName='generatePatientAuthLink' AND \
   timestamp>='-P1D'" \
  --limit=1000 --project=hmatologia2 --format=json | \
  jq 'group_by(.severity) |
      map({severity: .[0].severity, count: length}) |
      reverse'
```

**Expected:** ERROR count <5% of total

---

**Last Updated:** 2026-05-07  
**Owner:** Support Manager + Alert Manager  
**Review Frequency:** Weekly (email is critical path)
