# Incident Response Quick Reference — On-Call Card

**Print this. Post on monitor. Reference under pressure.**

---

## 0–5 Minutes: Is This Real?

```
Checklist (do ALL):
☐ Check Cloud Monitoring: error rate, latency, invocations
☐ Ping Firestore: single read in Cloud Console
☐ Test public URL in incognito browser
☐ Check GCP Cloud Status (regional outage?)
☐ Get screenshot of issue / error message
```

**If confirmed real → POST TO SLACK: `[P?] <title> — <brief desc>` in #incident**

---

## Severity in 30 Seconds

| If… | …it's | …do this |
|-----|-------|----------|
| Patient data exposed OR system 100% down OR >30min without recovery | **P0** | ☐ `/remind @CTO Phone now` ☐ Create Meet link ☐ Slack: `@CTO @DevOps-Lead @Security-Lead` |
| Specific module down (CIQ works) OR data integrity question OR <30min outage | **P1** | ☐ Ping `@CTO` on Slack ☐ Customer: "investigating, 30min update" |
| User reports one action broken OR intermittent errors that resolve themselves | **P2** | ☐ Assign to on-call ☐ Log in Slack thread ☐ No immediate customer ping |

---

## Quick Diagnosis (15–30 sec per type)

### System won't start / 5xx errors

```bash
# 1. Check functions
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20 | head

# 2. Did we just deploy?
git log --oneline -5

# 3. Decision: Rollback or diagnose?
   IF recent deploy → rollback (see below)
   ELSE → check Firestore quota + GCP status
```

### Data looks corrupted / math doesn't match

```bash
# 1. Which collection?
firebase console → database → search doc → copy ID

# 2. Check chainHash
# In Console: open doc → look at signature.hash field
# In logs: gcloud logging read "collection=corrupted_collection"

# 3. Decision: Restore from backup
#    See: Section 2.6.3 in full playbook
```

### Customers report "unauthorized access" or see data from other lab

```bash
# 1. STOP. This is P0.
# 2. Post: `[P0] Data Breach — lab A accessed lab B data?`
# 3. Ping security: `@Security-Lead call now`
# 4. Do NOT delete logs
# 5. Export logs snapshot (see below)
```

---

## Fastest Recovery Paths

### Rollback (if recent bad deploy)

```bash
# 1. Find last good version
git log --oneline -10

# 2. Rollback rules or functions
git show <commit-id>:firestore.rules > firestore.rules
# OR
git checkout <commit-id> -- functions/src/

# 3. Deploy
firebase deploy --only firestore:rules,functions --project hmatologia2

# 4. Verify (5 min)
# - Refresh Cloud Logs
# - Try one action in app
# - Check error rate dropped
```

### Restore from backup (corruption)

```bash
# See: docs/DR_RUNBOOKS.md, Scenario 1
# TL;DR:
# 1. Disable writes (deploy rule that forbids it)
# 2. Restore from backup
# 3. Validate 10 docs (chain hash matches)
# 4. Re-enable writes
# Estimated time: 60–120 min (CTO oversees)
```

---

## Evidence Preservation (Do This First)

```bash
# 1. Cloud Logs snapshot (one command)
gcloud logging read "resource.type=(cloud_function OR cloud_firestore OR cloud_run)" \
  --project=hmatologia2 --limit=10000 --format=json > \
  incident-$(date +%Y%m%d-%H%M%S).json

# 2. Upload to GCS (keeps it safe)
gsutil cp incident-*.json gs://hmatologia2-incident-backups/logs/

# 3. Screenshot of Cloud Console (paste in Slack thread)
# Alt+PrintScreen → paste into Slack

# 4. Mark time & copy URL to incident logs
# Slack post: "Logs exported: [GCS link]"
```

---

## Customer Message Templates (Copy-Paste)

### Outage notification (send immediately when P0 confirmed)

```
We have detected a service issue affecting HC Quality.
Timestamp: [now]
Status: Investigating | ETA update: [+15 min]
What to do: Do not retry saves. We will notify when resolved.
```

### Data breach notification (send after triage complete)

```
We detected unauthorized access to [patient records / CIQ data].
Date: [when detected]
Scope: [~how many patients] records may have been accessed
Your data: [specific fields, e.g., "names, DOBs, test results"]
What we did: [revoked access / deployed fix / etc.]
Next: You will receive a detailed report within 24 hours.
Contact: security@hcquality.com.br for questions
```

---

## Escalation (Speed > Politeness)

### P0 → Immediate (target: <5 min response)

1. **Slack:** `@CTO` + `@DevOps-Lead` + `@Security-Lead` in `#incident` thread
2. **Phone:** If no Slack response in 2 min, call CTO
3. **Create Meet link:** Post in incident thread, invite tier-2

### P1 → Within 30 min

1. **Slack:** `@CTO` + `@DevOps-Lead` in thread
2. **Email:** CTO with incident link + severity
3. **No phone call** unless outage persists >5 min

### P2 → Assign & track

1. **Slack thread:** `@on-call-engineer`
2. **No customer notification** unless they ask
3. **Log in internal Slack** (not #incident, which is for P0/P1)

---

## When You Don't Know What To Do

**Principle:** Preserve data + preserve logs, delay impact resolution.

1. **Don't guess.** Post in `#incident` and page CTO.
2. **Don't delete anything.** All logs go to GCS first.
3. **Don't retry failed operations.** You might corrupt more data.
4. **Do communicate.** Customer wants "we know, we're working on it" every 15 min.

**Rule:** If uncertain → escalate → explain → execute together.

---

## Post-Incident (Within 24 hours)

- [ ] Post-mortem started (Slack thread or doc)
- [ ] Root cause documented (1–2 paragraphs)
- [ ] Preventive actions logged (Jira tickets created)
- [ ] Notification sent to customers (if P0/P1)
- [ ] Evidence archived (logs in GCS, post-mortem in docs/)

---

## Key Numbers (Save These)

| What | Value |
|------|-------|
| **GCP Project** | `hmatologia2` |
| **Region** | `southamerica-east1` |
| **Firestore quota limit** | 20K reads/sec, 10K writes/sec (per account) |
| **Function timeout** | 30 seconds (don't exceed) |
| **Cloud Logs retention** | 30 days (export old logs to GCS) |
| **CTO phone** | [from escalation matrix] |
| **On-call Slack** | `#incident` |
| **Status page** | status.hcquality.com.br |

---

## URLs (Bookmark These)

- Cloud Logs: `console.cloud.google.com/logs/query`
- Firebase Console: `console.firebase.google.com/project/hmatologia2`
- GCP Dashboard: `console.cloud.google.com`
- HC Quality: `hmatologia2.web.app`
- Status page: `status.hcquality.com.br`

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `"Exceeded timeout of 30 seconds"` | Function doing too much. Check for long loops in Cloud Function logs. |
| `"Permission denied"` on Firestore write | Rules too strict. Check firestore.rules for recent changes. Ask: which user? which collection? |
| `"Document too large"` | Firestore has 1MB document limit. Split into subcollection or move to Cloud Storage. |
| `"Request rate exceeded"` | Too many queries too fast. Check polling interval (should be ≥30s). |
| `"Invalid grant"` (OAuth) | Token expired. Check GCP credentials. Redeploy functions. |
| `ERR_BLOCKED_BY_CLIENT` (browser) | CORS issue OR browser blocked Firebase API. Check browser console for details. |

---

**Version:** 1.0 | **Last updated:** 2026-05-07 | **Next review:** 2026-11-07

Print. Laminate. Keep on desk.
