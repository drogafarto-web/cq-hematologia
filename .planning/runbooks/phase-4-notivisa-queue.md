# Runbook: NOTIVISA Queue Stuck

**Alert Name:** `notivisa-queue-stuck`  
**Severity:** P1 — Adverse events not reported to government  
**Response Time SLA:** <15 minutes  
**Escalation:** CTO if unresolved >30min

---

## What This Alert Means

Adverse event submissions queued for NOTIVISA (government API) are not being processed. Events have been pending in the queue for >15 minutes without submission. This violates RDC 978 Art. 41 (timely reporting requirement).

---

## Immediate Triage (2 minutes)

### 1. Confirm Queue Stuck

```bash
cd /c/hc\ quality

# Check for pending entries older than 15 minutes
CUTOFF=$(date -u -d '15 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')

gcloud firestore documents list \
  --collection-ids=notivisa-queue \
  --project=hmatologia2 | \
  jq --arg cutoff "$CUTOFF" '.[] | 
    select(.createdAt < $cutoff and .status == "pending")'
```

**Expected:** 0 results = queue healthy  
**If >0 results:** Queue is stuck — proceed to Step 2

### 2. Check Processor Cron Status

```bash
# Find last execution
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="notivisaQueueProcessor"' \
  --limit=10 --project=hmatologia2 --format=json | \
  jq '.[] | {timestamp: .timestamp, severity: .severity, message: .textPayload}' | head -3
```

**Look for:**
- Timestamp of last execution (should be <5 minutes ago)
- Any ERROR or WARNING messages
- Function duration (should be <30 seconds normally)

**If last execution was >15 min ago:**
- Cron job didn't run or failed → Go to **Section 2A**

**If cron ran recently but queue still has pending entries:**
- Cron executed but processor hit error → Go to **Section 2B**

---

## Section 2A: Cron Job Not Running

**Applies if:** `notivisaQueueProcessor` has not executed in >15 minutes

### Step 1: Check Cloud Scheduler

```bash
# List all scheduled jobs
gcloud scheduler jobs list --project=hmatologia2

# Should see: notivisaQueueProcessor (or similar)
```

**If job does not exist:**
1. Job was deleted (accidental or via Terraform destroy)
2. Recreate via Firebase CLI or Terraform:
   ```bash
   firebase deploy --only functions:notivisaQueueProcessor --project=hmatologia2
   ```
3. Wait 5 minutes for next scheduled run
4. Verify execution via logs above

**If job exists:**

### Step 2: Manually Trigger Cron

```bash
# Trigger processor immediately
gcloud functions call notivisaQueueProcessor \
  --project=hmatologia2 \
  --region=southamerica-east1 \
  --gen2 \
  --data='{"labId":"*"}' 2>&1 | tee /tmp/trigger.log

# Monitor for completion (wait 30 seconds)
sleep 30

# Check logs
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="notivisaQueueProcessor" AND \
   timestamp>="'$(date -u -d '1 minute ago' '+%Y-%m-%dT%H:%M:%S')'"' \
  --project=hmatologia2 --format=json | \
  jq '.[0] | {duration: .duration, status: .severity, message: .textPayload}'
```

**Possible outcomes:**

| Outcome | Cause | Action |
|---------|-------|--------|
| Function runs successfully, pending entries processed | Cron just slow | Monitor queue — should recover in 5 minutes |
| Function fails with SOAP error | Gov API unreachable | Go to **Section 2B** |
| Function fails with message format error | Payload validation failed | Go to **Section 2C** |
| Function times out (>60s) | Large queue or slow network | Go to **Section 2D** |

---

## Section 2B: Government API Unreachable

**Applies if:** SOAP API connection failures in processor logs

### Step 1: Check ANVISA API Status

```bash
# Test connectivity to gov sandbox API (Phase 4)
SOAP_ENDPOINT="https://notivisa-sandbox.anvisa.gov.br/soap/api/v1"

# Check HTTP connectivity
curl -v -X POST \
  "$SOAP_ENDPOINT" \
  -H "Content-Type: application/soap+xml" \
  -d '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <notivisa:Ping xmlns:notivisa="http://notivisa.anvisa.gov.br/soap/api"/>
    </soap:Body>
  </soap:Envelope>' \
  --max-time 10 2>&1 | head -20
```

**Expected:**
- HTTP 200 OK + SOAP response, OR
- HTTP 500 SOAP Fault (API is reachable but request malformed)

**If connection timeout or refused:**
- ANVISA API is down
- Check status page: https://www.anvisa.gov.br/
- Notify CTO + Compliance Officer (ETA for recovery)
- **Keep queue entries in `pending` state** (will auto-retry on next cron)

### Step 2: Check Authentication Credentials

```bash
# Verify certificate + API key are valid
gcloud secrets list --project=hmatologia2 | grep -i notivisa

# Expected: Should see secrets for:
# - NOTIVISA_CLIENT_CERT (client certificate)
# - NOTIVISA_API_KEY (authentication key)
# - NOTIVISA_ENDPOINT (API URL)
```

**If secrets missing:**
1. Provision them:
   ```bash
   firebase functions:secrets:set NOTIVISA_CLIENT_CERT --project=hmatologia2
   firebase functions:secrets:set NOTIVISA_API_KEY --project=hmatologia2
   ```
2. Re-deploy processor:
   ```bash
   firebase deploy --only functions:notivisaQueueProcessor --project=hmatologia2
   ```

**If secrets exist:**
1. Verify values are not empty/placeholder:
   ```bash
   gcloud secrets versions access latest --secret=NOTIVISA_API_KEY --project=hmatologia2 | head -c 20
   ```
2. If empty, ask CTO for credentials + provision them

### Step 3: Contact ANVISA Support

If API is reachable but rejects authentication:
1. Open support ticket at https://www.anvisa.gov.br/support
2. Provide:
   - Sandbox account ID
   - Certificate thumbprint
   - Recent error message
3. Wait for response (typically 24–48h)
4. Update credentials once ANVISA confirms

**In the meantime:**
- Keep queue entries in `pending` state
- Monitor API status hourly
- Do NOT soft-delete entries (they represent real adverse events)

---

## Section 2C: Message Format / Validation Error

**Applies if:** Processor logs show `invalid message format` or `schema validation failed`

### Step 1: Check Queue Entry Content

```bash
# Get oldest pending entry
gcloud firestore documents get \
  notivisa-queue/{labId}/events/{eventId} \
  --project=hmatologia2 | jq '.data'

# Look at: message structure, required fields
```

**Compare against NOTIVISA SOAP schema:**
- File: `docs/Phase4_NOTIVISA_SCHEMA.md` (or similar)
- Required fields per RDC 978 Art. 41:
  - Event type (e.g., "adverse-event")
  - Lab ID
  - Event description
  - Patient ID (anonymized or reference)
  - Event date/time
  - Severity level

### Step 2: If Entry is Malformed

```bash
# Check how entry was created
git log -p --all -S "{eventId}" -- "*notivisa*" | head -50
```

**Determine root cause:**
- Client submitted invalid payload (bug in Phase 4 feature)
- Server converted payload incorrectly (bug in callable)
- Data was corrupted after insertion (rare)

**Actions:**
1. Soft-delete malformed entry:
   ```bash
   # Via Firestore Console or CLI:
   gcloud firestore documents update \
     notivisa-queue/{labId}/events/{eventId} \
     deletadoEm=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
   ```

2. Create support ticket for lab (event not submitted, resubmit if needed)

3. **Fix the bug** (if applicable):
   - If client bug: deploy corrected submission logic
   - If server bug: deploy corrected processor logic

### Step 3: If Entry Format is Valid

```bash
# Check against actual WSDL from ANVISA
# File location: functions/src/modules/notivisa/wsdl/notivisa-api.wsdl

# Verify field names match WSDL element names (case-sensitive!)
grep -E "<element name=|<xs:element name=" functions/src/modules/notivisa/wsdl/notivisa-api.wsdl | head -20
```

**Common issues:**
- Field name typo (e.g., `eventType` vs `eventtype`)
- Missing required field (WSDL minOccurs=1)
- Wrong data type (string vs integer)
- Incorrect XML namespace

**Actions:**
1. Compare entry fields against WSDL
2. Update processor code to match WSDL exactly
3. Test with sample payload:
   ```bash
   npm run test:notivisa-payload -- --entry-id={eventId}
   ```
4. Re-trigger processor

---

## Section 2D: Function Timeout

**Applies if:** Processor execution >60 seconds or times out

### Step 1: Check Queue Size

```bash
# Count pending + processing entries
gcloud firestore documents list \
  --collection-ids=notivisa-queue \
  --project=hmatologia2 | \
  jq 'group_by(.status) | map({status: .[0].status, count: length})'
```

**If >100 pending entries:**
- Processor is slow due to large queue
- Each entry takes ~1 second to process (batch limit?)

**Actions:**
1. Increase function memory + timeout:
   ```bash
   gcloud functions deploy notivisaQueueProcessor \
     --memory=1GB \
     --timeout=300s \
     --region=southamerica-east1 \
     --project=hmatologia2
   ```
2. Increase batch size in processor code (if applicable):
   ```typescript
   const BATCH_SIZE = 25;  // Process 25 entries per cron
   ```

### Step 2: Check Network / API Latency

```bash
# Measure API response time
time curl -X POST \
  "https://notivisa-sandbox.anvisa.gov.br/soap/api/v1" \
  -H "Content-Type: application/soap+xml" \
  -d '<soap:Envelope ...>' \
  --max-time 10
```

**Expected:** <2 seconds per request

**If >5 seconds:**
- ANVISA API is slow or overloaded
- Adjust processor logic to handle slow responses:
  ```typescript
  const timeout = 30000; // 30 seconds per entry
  ```

### Step 3: Check for Infinite Loop / Deadlock

```bash
# Review processor code for bugs
cat functions/src/modules/notivisa/crons/notivisaQueueProcessor.ts | \
  grep -A5 -B5 "while\|for\|recursion" | head -30
```

**Look for:**
- Infinite loops (no break condition)
- Recursive calls (stack overflow)
- Deadlock on database write

**If bug found:**
1. Fix code
2. Deploy: `firebase deploy --only functions:notivisaQueueProcessor`
3. Test timeout improves

---

## Recovery Validation (5 minutes)

```bash
# Monitor queue status
watch -n 10 'gcloud firestore documents list \
  --collection-ids=notivisa-queue \
  --project=hmatologia2 | \
  jq "group_by(.status) | map({status: .[0].status, count: length})"'
```

**Success criteria:**
- All pending entries processed within 10 minutes
- No new entries stuck in pending
- Processor cron executing on schedule (every 5 min)

**If still stuck after 30 min:**
1. Page CTO immediately
2. Consider soft-deleting oldest entry to unblock queue
3. Escalate to ANVISA support if API issue suspected

---

## Post-Incident Checklist

- [ ] Create incident ticket (title: "NOTIVISA Queue Stuck [date]")
- [ ] Document root cause (API, processor bug, payload format, network)
- [ ] Verify all stuck entries are now processed
- [ ] If entries were soft-deleted, notify lab + create remediation ticket
- [ ] Review processor logs for error patterns
- [ ] Update alert threshold if needed (adjust 15-min timeout if API known to be slow)
- [ ] Schedule post-mortem with ANVISA integration team

---

## Monitoring Tips

**Daily health check:**
```bash
# Check queue status once per day
gcloud firestore documents list \
  --collection-ids=notivisa-queue \
  --project=hmatologia2 | \
  jq 'map(select(.status == "pending")) | length as $pending | \
      map(select(.status == "submitted")) | length as $submitted | \
      {pending: $pending, submitted: $submitted}'
```

**Weekly audit:**
- Review for any entries with status "failed" (may need manual investigation)
- Check processor cron execution history (should be zero errors)
- Verify webhook ACKs are being received (see Dashboard 2)

---

**Last Updated:** 2026-05-07  
**Owner:** Compliance Officer + CTO  
**Review Frequency:** Weekly (due to gov API dependency)
