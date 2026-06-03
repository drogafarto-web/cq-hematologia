# NOTIVISA Operational Quick Reference

**For:** RT, AUDITOR, DevOps  
**Version:** v1.4 (Phase 8)  
**Last updated:** 2026-05-07

---

## What is NOTIVISA?

System for notifying the Brazilian Ministry of Health (MS) of critical lab results in notifiable diseases (e.g., syphilis, dengue, HIV, tuberculosis).

**Regulation:** RDC 978 Art. 66 + Portaria 204/2016

**Timeline:** Notification required within 24 hours of result release

---

## How it Works (User Journey)

### Step 1: Critical Result Detected

- Patient result released (e.g., syphilis positive)
- If disease is on Portaria 204 list → NOTIVISA draft auto-created
- RT notified via email + UI badge

### Step 2: RT Reviews Draft

- RT logs in → sees "NOTIVISA Approval Required" badge
- Opens draft panel (shows patient initials, disease, test method, result)
- Reviews clinical details + deadline (24h from result)

### Step 3: RT Approves or Rejects

- **Approve:** RT clicks "Approve for Submission"
  - Draft sealed with cryptographic signature
  - Enqueued for government submission
  - Status: `submitted` → awaiting acknowledgment
- **Reject:** RT clicks "Reject"
  - Provides reason (min 10 chars)
  - Draft marked as `rejected` (cannot be resubmitted)
  - Audit log records reason

### Step 4: Status Polling (Automatic)

- Every 5 minutes, system polls government API
- If response: status updated (acknowledged/rejected)
- RT sees status in UI in near-real-time

### Step 5: Audit Export

- Auditor exports NOTIVISA submissions (CSV/JSON/XLSX)
- Includes: date, disease, status, operator, government response
- Ready for regulatory inspection

---

## Key Concepts

### Notifiable Diseases

99 diseases per Portaria 204/2016. Examples:

- Dengue (all forms, especially in pregnancy)
- Syphilis (acquired, congenital, in pregnancy)
- HIV/AIDS
- Tuberculosis
- Measles
- Meningitis

Full list in lab config; can be enabled/disabled per lab.

### Patient Anonymization

- Only patient **initials** stored (e.g., "JD")
- CPF **masked** in audit log (e.g., "123.456.789-\*\*")
- Full CPF encrypted in payload (LGPD Art. 9)

### Audit Trail

Every action logged immutably:

- WHO: operator UID
- WHAT: action (created, approved, rejected, submitted)
- WHEN: Unix timestamp
- HOW: cryptographic signature (SHA-256)

**Cannot be modified or deleted** (Firestore rules + RDC 978 Art. 204)

### Deadlines

- **Notification deadline:** 24 hours from result release
- **UI alert:** Red badge if <1 day remaining
- **System timeout:** Draft automatically marked `failed` if not submitted within SLA

---

## Common Tasks

### Task 1: Find a NOTIVISA Draft

**UI:** Dashboard → "NOTIVISA Approval Required" → Click draft

**Or manually:**

1. Firebase Console → Firestore
2. Collections → `notivisa-drafts` → select lab ID
3. Find draft by laudoId

### Task 2: Approve a Draft

1. Open draft in RT UI
2. Optional: Add approval notes (clinical details)
3. Click "Approve for Submission"
4. Signature generated automatically
5. Draft queued for government API (v1.5)

**Status:** `draft` → `submitted` → `acknowledged` (within 5 min polling)

### Task 3: Reject a Draft

1. Open draft in RT UI
2. Click "Reject"
3. Enter reason (min 10 characters, max 500)
   - Example: "Patient requests further testing before notification"
4. System signs rejection
5. Draft marked `rejected` (no resubmission possible)

**Auditor action:** Investigate and request re-testing if needed

### Task 4: Monitor Status

**In RT UI:**

- Drafts show real-time status badge
- Color coding:
  - **Yellow:** Pending approval
  - **Green:** Submitted + acknowledged
  - **Red:** Rejected or failed

**In Cloud Logs (DevOps):**

```bash
gcloud functions logs read notivisaStatusCheck --limit 50 --follow
# Shows polling results, retries, errors
```

### Task 5: Export for Auditor

**Auditor UI:** Auditor Dashboard → "NOTIVISA Outbox"

Filters:

- Date range (result date)
- Status (submitted, acknowledged, rejected, failed)
- Operator (RT name)

**Export:**

- Click "Export" → Choose format (CSV/JSON/XLSX)
- Download file (24-hour signed URL)
- Contains all submission + response details

---

## Troubleshooting

### Problem: Draft Not Appearing

**Cause:** Lab doesn't have notifiable disease enabled

**Fix:**

1. Lab Admin → Settings → NOTIVISA → Enable disease codes
2. Re-release result (triggers draft creation)

---

### Problem: "Cannot submit: RT approval required"

**Cause:** Draft in `draft` status, not `approved`

**Fix:**

1. RT reviews + approves draft first
2. Then `submitNotivisa()` succeeds

---

### Problem: Rate Limited (429 error)

**Cause:** >10 submissions in 1 hour

**Fix:**

1. Wait 1 hour for window to reset
2. Stagger submissions (max 10/hour/lab)
3. Contact DevOps if limit needs adjustment

---

### Problem: "Signature verification failed"

**Cause:** Approval signature tampered with or expired (>5 min)

**Fix:**

1. Reject draft + re-approve
2. Use fresh signature (generated at approval time)

---

### Problem: Government API not responding (polling failed)

**Cause:** ANVISA sandbox down or network issue

**Fix:**

1. System retries automatically (exponential backoff)
2. Check ANVISA status: https://portalanvisa.gov.br/status
3. DevOps: verify credentials in Secrets Manager

**Retry timeline:**

- Attempt 1: +1 min
- Attempt 2: +5 min
- Attempt 3: +30 min
- Attempt 4: +2 hours
- Attempt 5 (final): +24 hours

**If failed after 5 attempts:** System marks draft as `failed`, alerts RT for manual investigation.

---

## DevOps Tasks

### Deploy NOTIVISA (First Time)

**Pre-flight check:**

```bash
bash scripts/preflight-secrets-check.sh
# Output must be green (NOTIVISA_SANDBOX_API_KEY set)
```

**Deploy order:**

1. Rules + indexes: `firebase deploy --only firestore:rules,firestore:indexes`
2. Functions: `firebase deploy --only functions:notivisa*`
3. Hosting: `firebase deploy --only hosting`

**Verify:**

```bash
firebase functions:list --project hmatologia2
# Should show: submitNotivisa, notivisaDraftCreate, getNotivisaDraft, etc.
```

---

### Monitor NOTIVISA (Daily)

```bash
# Check errors (should be 0)
gcloud functions logs read notivisa --limit 100 | grep ERROR

# Check queue backlog
firebase firestore:query "notivisa-queue/{labId}/events" --where status == pending

# Check rate limits
firebase firestore:query "notivisa-queue/{labId}/events" --where createdAt >= "$(date -u -d '1 hour ago' +%s)000"
```

---

### Alert Response

| Alert                                    | Severity | Action                                                        |
| ---------------------------------------- | -------- | ------------------------------------------------------------- |
| API unreachable (3 consecutive failures) | P1       | Check ANVISA status; verify API key; escalate                 |
| Validation error persists >24h           | P2       | Contact RT; audit signature; redeploy if needed               |
| Rate limit exceeded (>3x/day)            | P2       | Review lab submission frequency; adjust config if ok          |
| Queue backed up (>50 pending)            | P2       | Check polling cron logs; restart if crashed                   |
| Signature verification failures          | P1       | Security incident; audit for tampering; soft-delete if needed |

---

### Rollback NOTIVISA

**If deployment breaks:**

```bash
# Revert Cloud Functions
firebase deploy --only firestore:rules --project hmatologia2
# Firestore keeps version history; this reverts to previous

# Or manually revert via Firebase Console:
# Firestore → Rules → View history → Publish previous version
```

**RTO:** ~5 minutes (functions stop processing, queue pauses)

---

## Contact & Escalation

### RT Support

- Email: `rt-team@lab.com` (example)
- Slack: `#notivisa-alerts`
- On-call: See deployment checklist contact tree

### DevOps Escalation

- If alerts persist >15 min: Page on-call engineer
- If government API is down: Contact ANVISA (contact via portal)
- If signature failures: Security team review

---

## Reference Documents

- **Detailed Spec:** `PHASE_8_DETAILED_PLAN.md`
- **Callable Specs:** `PHASE_8_NOTIVISA_CALLABLES.md`
- **Deployment Checklist:** `PHASE_8_DEPLOYMENT_CHECKLIST.md`
- **Government Setup:** `v1.4_NOTIVISA_SANDBOX_SETUP.md`
- **Cloud Logs Guide:** `CLOUD_LOGS_MONITORING_GUIDE.md`

---

## Key Numbers (Memorize)

- **Notification SLA:** 24 hours (from result release)
- **Polling interval:** 5 minutes (automatic)
- **Rate limit:** 10 submissions/hour per lab
- **Retry attempts:** Max 5 (exponential backoff)
- **Signature window:** 5 minutes (replay protection)
- **Audit log retention:** Indefinite (soft-delete only)

---

## Regulations (TL;DR)

| Acronym               | Full Name                      | Requirement                                      |
| --------------------- | ------------------------------ | ------------------------------------------------ |
| **RDC 978**           | ANVISA Clinical Lab Regulation | Notify MS of critical results (Art. 66)          |
| **Portaria 204/2016** | MS Notifiable Diseases         | 99 diseases + mandatory fields (Art. 6º)         |
| **DICQ 4.3–4.4**      | ISO 15189 Quality Management   | Documented procedures + adverse event management |
| **LGPD**              | Brazilian Data Privacy Law     | Anonymization + audit trail (Arts. 9, 18)        |
| **Lei 14.063/2020**   | Digital Signature Law          | Electronic signatures valid (used in sealing)    |

---

**Last updated:** 2026-05-07  
**Prepared by:** Phase 8 Execution Team  
**Review:** ADR-0014 (Accepted)

---

## Quick Links

- 🔗 NOTIVISA Portal: https://portalanvisa.gov.br/notivisa (sandbox/prod)
- 📋 Portaria 204: https://www.gov.br/anvisa/.../portaria-204
- 📞 ANVISA Contact: (See deployment checklist)
- 📧 Lab Admin: (See deployment checklist contact tree)
