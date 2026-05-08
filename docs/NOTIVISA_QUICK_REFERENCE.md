# NOTIVISA Integration — Quick Reference Guide

**Version:** 1.0  
**Updated:** 2026-05-08  
**For:** Engineers, RT, Supervisors, Auditors

---

## At-a-Glance: System Flow

```
Result (laudo) with reportable disease
         ↓
   [Create Draft] → notivisaDraftCreate()
         ↓
   [RT Review] → getNotivisaDraft()
         ↓
   [RT Approve] → approveNotivisaDraft() (signature required)
         ↓
   [Submit to Queue] → submitNotivisa()
         ↓
   [Scheduled Processing] → notivisaQueueProcessor() (every 5 min)
   └─ SUCCESS → status='submitted', awaiting Anvisa confirmation
   └─ RETRYABLE → wait 1m, 5m, 15m, 45m, 120m (exponential backoff)
   └─ PERMANENT FAIL → escalate supervisor (SMS + email alert)
         ↓
   [Anvisa Webhook] → notivisaWebhookHandler() (Phase 12+)
         ↓
   [Final Status] → status='acknowledged'
         ↓
   [Export for Audit] → notivisaExportArchive() (AUDITOR only)
```

---

## 8 Callable Functions (Summary)

### 1. `notivisaDraftCreate(labId, laudoId)`
- **Purpose:** Generate NOTIVISA form from result
- **Role Required:** Any member of lab
- **Input:** labId, laudoId, (optional criticoContext)
- **Output:** draftId, status='draft', payload
- **SLA:** Immediate
- **Error Codes:** LAUDO_NOT_FOUND, PACIENTE_NOT_FOUND, INVALID_PAYLOAD

### 2. `getNotivisaDraft(labId, draftId)`
- **Purpose:** View draft details + audit log
- **Role Required:** RT or AUDITOR
- **Input:** labId, draftId
- **Output:** payload, auditLog[], status
- **SLA:** Immediate
- **Error Codes:** UNAUTHORIZED, DRAFT_NOT_FOUND

### 3. `approveNotivisaDraft(labId, draftId, signature)`
- **Purpose:** RT approval + signature
- **Role Required:** RT only
- **Input:** labId, draftId, signature {hash, operatorId, ts}
- **Output:** status='approved', chainHash
- **SLA:** Immediate
- **Error Codes:** UNAUTHORIZED, INVALID_STATUS, SIGNATURE_INVALID
- **Note:** Signature = HMAC-SHA256 (server validates)

### 4. `submitNotivisa(labId, draftId)`
- **Purpose:** Move approved draft to async queue
- **Role Required:** RT or Admin
- **Input:** labId, draftId
- **Output:** entryId, status='pending', notificationDeadline
- **SLA:** Immediate; first submission attempt within 5 min
- **Error Codes:** UNAUTHORIZED, INVALID_STATUS
- **Note:** Sets deadline = resultDate + 24h (RDC 978 Art. 66)

### 5. `notivisaQueueProcessor()` (Scheduled)
- **Purpose:** Async submission processing (every 5 minutes)
- **Trigger:** Cloud Scheduler (automatic)
- **Processing:** Exponential backoff (1m → 5m → 15m → 45m → 120m)
- **Max Attempts:** 5
- **Escalation:** Supervisor alert if permanent fail or deadline past
- **SLA:** 5-minute cycles, submission within 24h window
- **Note:** Run `notivisaQueueProcessor()` manually if urgent: `gcloud functions call notivisaQueueProcessor --region southamerica-east1`

### 6. `notivisaExportArchive(labId, daysBack, format)`
- **Purpose:** Auditor-only export of acknowledged entries
- **Role Required:** AUDITOR only
- **Input:** labId, daysBack (1–365, default 90), format (csv|json|both)
- **Output:** archiveId, recordCount, formats[], expiresAt
- **SLA:** Immediate
- **Error Codes:** UNAUTHORIZED, LAB_NOT_FOUND, NO_DATA
- **Note:** Archive immutable, retained 90 days

### 7. `notivisaSoftDelete(labId, entryId, reason, notes?)`
- **Purpose:** Mark entry as deleted (soft-delete only, RN-06)
- **Role Required:** Admin or Owner only
- **Input:** labId, entryId, reason (duplicate|incorrect-patient|false-positive|test-entry|other), notes?
- **Output:** deletedAt, deletedBy
- **SLA:** Immediate
- **Error Codes:** UNAUTHORIZED, ENTRY_NOT_FOUND, ALREADY_SUBMITTED (warning, allowed)
- **Note:** Soft delete appends immutable audit log entry

### 8. `notivisaWebhookHandler()` (Phase 12+)
- **Purpose:** Receive Anvisa acknowledgment callback
- **Trigger:** Anvisa SOAP service (HTTP POST)
- **Auth:** HMAC-SHA256 signature verification (header: x-anvisa-signature)
- **Input:** Webhook payload {idempotencyKey, status, eventId, timestamp, receiptNumber}
- **Output:** 200 OK (always, prevent retry)
- **SLA:** <1s
- **Note:** Signature verified server-side; no client token required

---

## Error Classification

### Retryable Errors (Processor Retries)
```
5xx (500, 502, 503, 504)
ECONNREFUSED, ETIMEDOUT, ENOTFOUND
→ Action: Wait for next cycle (exponential backoff)
→ Status: remains 'pending'
→ Attempt: incremented
```

### Non-Retryable Errors (Escalate Immediately)
```
4xx (400, 401, 403, 404, 422)
→ Action: Escalate supervisor
→ Status: 'failed-permanent'
→ Attempt: incremented (no retry)
→ Alert: SMS + email to supervisor
```

### Deadline Escalation
```
Entry past notificationDeadline (result + 24h) AND status in ['pending', 'submitted']
→ Action: Escalate supervisor
→ Alert: "Entry past 24h deadline, manual intervention required"
→ Status: escalatedToSupervisor = true
```

---

## Firestore Collections (Quick Reference)

### `/notivisa-drafts/{labId}/drafts/{draftId}`
- **Purpose:** NOTIVISA form drafts (awaiting RT approval)
- **Status:** draft → approved → submitted → deleted
- **Key Fields:** payload (Art. 6º), status, criadoEm
- **Subcollection:** auditLog/{ts} (immutable)
- **Access:** RT (read/update), Admin (read)

### `/labs/{labId}/notivisa-outbox/{entryId}`
- **Purpose:** Async submission queue (RDC 978 Art. 66 compliance)
- **Status:** pending → submitted → acknowledged → failed-permanent → deleted
- **Key Fields:** diseaseCode, patientAnon, notificationDeadline, submissionAttempts[]
- **Subcollection:** auditLog/{ts}, webhookLog/{ts} (both immutable)
- **Access:** RT (read), Admin (read/write soft-delete), AUDITOR (read/export)

### `/labs/{labId}/notivisa-outbox/_archives/exports/{archiveId}`
- **Purpose:** Immutable audit archives (retained 90 days)
- **Status:** ready (immutable)
- **Key Fields:** exportedBy, exportedAt, expiresAt, formats[]
- **Subcollection:** files/{fileName} (CSV/JSON content, if <1MB), auditLog/{ts}
- **Access:** AUDITOR (read), Admin (read)

---

## Supervisor Escalation Runbook

### I. Received Alert: "Entry Past Deadline"

**Action:**
1. Check Firestore: `where('escalatedToSupervisor', '==', true)`
2. View entry details: diseaseCode, patientAnon, deadline, last error
3. Assess: Is submission still possible?

**Options:**

#### Option A: Retryable Error (5xx, network)
- **What to do:** Wait 1–5 minutes; processor will retry automatically
- **If still failing after 30 min:** Contact IT/ops (possible Anvisa downtime)

#### Option B: Non-Retryable Error (4xx, validation)
- **What to do:** Contact RT who approved form
- **Issue:** Likely malformed payload (missing field, invalid code)
- **Fix:** 
  1. RT reviews draft payload
  2. Correct issue (e.g., add missing field)
  3. Create new draft + resubmit
  4. Soft-delete old (failed) entry (reason='false-positive' or 'incorrect-patient')

#### Option C: Permanent Failure (max attempts)
- **What to do:** Check submissionAttempts[] log for error pattern
- **If pattern:** Certificate expired, API endpoint wrong, rate limit exceeded
- **Fix:** Contact Security/Ops to:
  - Renew certificate (if auth error 401)
  - Verify API endpoint (if 404)
  - Wait (if rate limit 429)
- **Then:** Manually retry entry (processor will pick up)

#### Option D: Past Deadline (>24h without ACK)
- **What to do:** Manual mitigation (outside HC Quality system)
- **Steps:**
  1. Export entry as PDF (use HC Quality UI)
  2. Login to [Anvisa NOTIVISA Portal](https://notivisa.saude.gov.br) (Phase 12+)
  3. Submit form manually
  4. Record receipt number in Firestore manually (field: `manual_receipt_code`)
  5. Soft-delete entry in HC Quality (reason='manually-submitted')
- **Document:** Add note explaining manual submission (audit trail)

---

## Common Commands (CLI)

### Query Escalated Entries (Firestore Console or CLI)

```bash
# List all escalated entries in a lab
firebase firestore:query \
  "labs/lab-alpha/notivisa-outbox" \
  --query "where('escalatedToSupervisor','==',true)" \
  --project hmatologia2

# List all failed-permanent entries
firebase firestore:query \
  "labs/lab-alpha/notivisa-outbox" \
  --query "where('status','==','failed-permanent')" \
  --project hmatologia2
```

### Manually Trigger Queue Processor

```bash
# If you need to process queue immediately (don't wait for 5-min cycle)
gcloud functions call notivisaQueueProcessor \
  --region southamerica-east1 \
  --project hmatologia2
```

### Check Cloud Logs for NOTIVISA Errors

```bash
# Last 24 hours
gcloud logging read \
  'resource.type="cloud_function" AND severity="ERROR" AND textPayload=~"NOTIVISA"' \
  --limit 50 \
  --project hmatologia2 \
  --format json

# Or use: bash scripts/monitor-cloud-logs.sh 24 30
```

### Export Specific Entry Data

```bash
# Get entry details (Firestore console)
1. Navigate to /labs/{labId}/notivisa-outbox/{entryId}
2. View document + submissionAttempts array
3. Review auditLog subcollection (all actions)
4. Check webhookLog subcollection (Phase 12+, Anvisa confirmation)
```

---

## Test Scenarios (Phase 4 Sandbox)

### Scenario 1: Happy Path (Immediate Success)

**Setup:** Create laudo with positive result for HIV (99078)

**Expected Flow:**
```
T+0: notivisaDraftCreate() → draft-001 created
T+0: approveNotivisaDraft() → signature verified, status='approved'
T+0: submitNotivisa() → entry-001 created, status='pending'
T+5: notivisaQueueProcessor() runs
     → submitNotivisaToAnvisa(mock) → returns receiptCode (mock)
     → Update entry: status='submitted', receiptCode set
     → auditLog appended: {action='SUBMISSION_ATTEMPT', status='success'}
T+10: Auditor export → CSV includes entry with status='acknowledged' (mock)
```

**Verify:** Cloud Logs show `[NOTIVISA] Success: entry-001 (attempt 1)` ✓

---

### Scenario 2: Retryable Error (Network, 5xx)

**Setup:** Same as Scenario 1, but inject mock 503 error on first attempt

**Expected Flow:**
```
T+5: notivisaQueueProcessor() → submitNotivisaToAnvisa(mock) → 503 error
     → isRetryable=true, keep status='pending'
     → auditLog appended: {action='SUBMISSION_ATTEMPT', status='failed', isRetryable=true}
     → nextRetry = T+5 + 1min = T+6
T+6: notivisaQueueProcessor() → submitNotivisaToAnvisa(mock) → SUCCESS
     → status='submitted', receiptCode set
     → auditLog appended: {action='SUBMISSION_ATTEMPT', status='success'}
```

**Verify:** Cloud Logs show `[NOTIVISA] Retryable failure: entry-001 (attempt 1/5)`, then success ✓

---

### Scenario 3: Permanent Error (4xx Validation)

**Setup:** Create laudo with invalid CPF (causes 400 error)

**Expected Flow:**
```
T+5: notivisaQueueProcessor() → submitNotivisaToAnvisa(mock) → 400 error
     → isRetryable=false, status='failed-permanent'
     → escalatedToSupervisor=true, escalationMotivo='validation-error'
     → auditLog appended with error details
     → Alert supervisor (SMS + email, Phase 8+)
```

**Verify:** 
- Cloud Logs show `[NOTIVISA] Permanent failure: entry-001` ✓
- Entry document: `escalatedToSupervisor=true` ✓
- Supervisor receives alert ✓

---

### Scenario 4: Past Deadline Escalation

**Setup:** Create entry with result date 25 hours ago (deadline = 24h + result)

**Expected Flow:**
```
T+5: notivisaQueueProcessor() runs
     → Queries status in ['pending','submitted']
     → AND notificationDeadline < now()
     → AND escalatedToSupervisor = false
     → Finds entry with deadline 1 hour past
     → escalatedToSupervisor=true, escalationMotivo='deadline-passed'
     → Alert supervisor
```

**Verify:**
- Cloud Logs show `[NOTIVISA] Past-deadline escalation: entry-001` ✓
- Entry field: `escalationMotivo='deadline-passed'` ✓

---

### Scenario 5: Soft Delete (RN-06)

**Setup:** Entry in 'pending' status

**Expected Flow:**
```
T+0: notivisaSoftDelete(labId, entryId, reason='false-positive', notes='Retested, negative')
     → Update entry: status='deleted', deletedAt, deletedBy
     → auditLog appended: {action='SOFT_DELETED', reason='false-positive', notes='...'}
     → Entry still queryable via deletedAt filter
     → Hard delete forbidden (Firestore rules block)
```

**Verify:**
- Entry document: `status='deleted'` ✓
- auditLog contains SOFT_DELETED entry ✓
- Query `where('status','==','deleted')` returns entry ✓
- Cannot hard delete (401 error) ✓

---

## Phase Transition Checklist

### Phase 4 → Phase 8 (May 20–July 15)

- [ ] Form generation working 8 weeks in production
- [ ] Zero unplanned downtime
- [ ] Audit logs 100% complete (spot-check 10 random entries)
- [ ] Deadline escalations <1% (indicates good result timing)
- [ ] No permanent failures that couldn't be resolved

### Phase 8 → Phase 12 (July 15–Aug 1)

- [ ] Certificate provisioned (e-CNPJ + digital cert from ICP-Brasil)
- [ ] Anvisa sandbox testing complete (submit test form, receive receipt)
- [ ] Webhook signature verification tested
- [ ] Idempotency key deduplication working (submit same form 2×, get same receipt)
- [ ] Real API endpoint URL configured
- [ ] Production date set

---

## Contact & Escalation

### Engineering (Code Issues)
- **Channel:** #notivisa-integration Slack
- **On-Call:** Claude Code Agent / Engineering Lead
- **For:** Function errors, deployment issues, database locks

### Regulatory Affairs (Compliance)
- **Contact:** Regulatory Officer
- **For:** RDC 978 questions, Portaria 204 disease code updates
- **Frequency:** Quarterly review

### Auditor (Audit Trail)
- **Contact:** Internal/External Auditor
- **Frequency:** Phase 4 completion, Phase 12 completion, annual
- **Access:** Read-only to notivisa-outbox + archives

### Anvisa Support (API Integration, Phase 12+)
- **Portal:** https://notivisa.saude.gov.br/
- **Email:** notivisa-suporte@saude.gov.br
- **Response Time:** 2–5 business days (government SLA)

---

## Glossary

| Term | Definition |
|------|-----------|
| **NOTIVISA** | Notificação Imediata de Vítima de Violência — ANVISA system for immediate disease notification |
| **RDC 978** | Current ANVISA regulation for laboratory operations (2026-01-15) |
| **DICQ 4.x** | Laboratory Quality Management Standard (blocks 4.1–4.4) |
| **Art. 66** | RDC 978 Article 66 — requires NOTIVISA notification within 24h |
| **RT** | Responsável Técnico — laboratory technical director (sign-off role) |
| **Portaria 204/2016** | MS (Ministry of Health) list of 99 reportable diseases |
| **idempotencyKey** | SHA-256 hash unique to each form; prevents duplicate Anvisa submissions |
| **chainHash** | Cumulative HMAC signature proving audit trail immutability (ADR-0012) |
| **Escalation** | Supervisor alert for deadline passed or permanent submission failure |
| **Soft Delete** | Mark record deleted but preserve for audit (never hard delete, RN-06) |
| **Backoff** | Exponential delay between retries (1m → 5m → 15m → 45m → 120m) |

---

**Document Status:** Final  
**For:** Day-to-day operations  
**Updated:** 2026-05-08  
**Next Review:** Phase 8 mid-point (2026-07-15)
