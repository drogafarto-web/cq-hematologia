# Critical Incident Runbooks

Index of procedures for common production incidents.

---

## Runbook Index

| Scenario                 | Severity | MTTR Target      |
| ------------------------ | -------- | ---------------- |
| Function timeout         | Yellow   | 15 min           |
| Database unavailable     | Red      | 30 min           |
| Auth service down        | Red      | 15 min           |
| Firestore Rules broken   | Red      | 20 min           |
| Data corruption detected | Black    | 1 hour (restore) |
| NOTIVISA API failure     | Red      | 30 min           |
| Memory leak in function  | Yellow   | 30 min           |

---

## Runbook: Function Timeout

**Trigger:** Cloud Logs shows "Functions runtime exceeded 540s"

**IC Actions:**

1. Check which function(s): Cloud Logs filter `severity=ERROR resource.type=cloud_function`
2. Check recent deploy (last 10 min)
3. Options:
   a. **Revert deploy** (if <15 min old): `firebase deploy --only functions --rollback`
   b. **Restart function**: Redeploy specific function
   c. **Increase timeout**: Edit function.yaml, re-deploy
4. Verify in Cloud Logs: no more timeout errors
5. Notify team: Slack #incidents with root cause

**Prevention:**

- Tests verify function execution <300s
- High-latency operations use Cloud Tasks (async)

---

## Runbook: Database Unavailable

**Trigger:** Firestore connection fails, all queries fail

**IC Actions:**

1. Check Firebase Console: Firestore status
2. Check region status: https://status.cloud.google.com
3. Options:
   a. **If Google outage:** Wait for recovery
   b. **If isolated:** Clear browser cache + retry
   c. **If persistence:** Create Cloud Support ticket
4. **Fallback (if >5 min):** Switch to read-only mode
5. Communicate: Slack #incidents with ETA

---

## Runbook: Auth Service Down

**Trigger:** Login fails for all users

**IC Actions:**

1. Check Firebase Console: Authentication status
2. Check if issue is Firebase Auth or app code
3. Options:
   a. **Firebase outage:** Wait for recovery
   b. **App code issue:** Check recent deploy, revert auth changes
   c. **Secret expired:** Rotate in Secret Manager, redeploy functions
4. Verify: Try login in incognito window
5. Communicate: Slack #incidents with root cause

---

## Runbook: Firestore Rules Broken

**Trigger:** All writes fail with "permission-denied"

**IC Actions:**

1. Check Cloud Logs: filter `resource.name=~"firestore" AND severity=ERROR`
2. Check recent Rules deploy
3. If recent deploy caused this:
   a. **Revert Rules:** Click "Previous version" → "Restore" in Console
   b. Verify: Try writing a doc (should succeed)
4. Communicate: Slack #incidents with root cause

---

## Runbook: Data Corruption Detected

**Trigger:** Audit chain broken OR customer reports missing records

**IC Actions:**

1. **DO NOT DELETE DATA** — preserve for forensics
2. **Escalate to CTO immediately** — this is Black incident
3. CTO decides: restore from backup vs forensic recovery
4. If restoring from backup:
   - Identify clean backup point
   - Create new Firestore database from backup
   - Verify audit trail integrity in new database
   - Test data quality (spot-check records)
   - Plan switchover
5. Communicate: CTO + Legal prepare customer notification

---

## Runbook: NOTIVISA API Failure

**Trigger:** Gov endpoint down or rejecting batches

**IC Actions:**

1. Check NOTIVISA service status (check emails, gov notifications)
2. Check if submission queue is backed up
3. Options:
   a. **If gov outage:** Wait for recovery, queue will auto-retry
   b. **If submission format error:** Check Cloud Logs for error details
   c. **If auth error:** Rotate credentials, re-submit
4. Communicate: Slack #incidents with ETA and customer impact

---

## Runbook: Memory Leak in Function

**Trigger:** Function memory approaching limit

**IC Actions:**

1. Check Cloud Functions dashboard: memory usage trend
2. Identify which function is leaking
3. Check recent deploy to that function
4. Options:
   a. Revert function (if recent deploy)
   b. Increase memory allocation (temporary)
   c. Redeploy with memory leak fix (if identified)
5. Communicate: Slack #incidents with root cause

---

**For more runbooks:** Expand this index as new patterns are discovered.
