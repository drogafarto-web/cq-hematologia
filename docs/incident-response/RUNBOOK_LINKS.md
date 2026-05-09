# Critical Incident Runbooks

## Index

| Scenario | Severity | Runbook Link | Trigger | MTTR Target |
|----------|----------|--------------|---------|-------------|
| Function timeout | Yellow | #fn-timeout | >5s response time | 15 min |
| Database unavailable | Red | #db-unavailable | Connection errors | 30 min |
| Auth service down | Red | #auth-down | Login failures | 15 min |
| Firestore Rules broken | Red | #rules-broken | Permission errors on all writes | 20 min |
| Data corruption detected | Black | #data-corruption | Hash chain broken or records missing | 1 hour (restore) |
| NOTIVISA API failure | Red | #notivisa-failure | Gov endpoint down or rejecting batches | 30 min |
| Memory leak in function | Yellow | #memory-leak | Function memory approaching limit | 30 min |
| Cloud Logs unavailable | Yellow | #logs-unavailable | Cannot see Cloud Logs | 15 min (or blind fix) |

---

## Runbook: Function Timeout (#fn-timeout)

**Trigger:** Cloud Logs shows "Functions runtime exceeded 540s" OR frontend shows "timeout" error

**IC Actions:**
1. Check which function(s) are timing out: Cloud Logs filter `severity=ERROR resource.type=cloud_function`
2. Check Cloud Functions list: look for recent deploy (last 10 min)
3. Options:
   a. **Revert deploy** (if <15 min old): `firebase deploy --only functions --rollback`
   b. **Restart function** (if no recent deploy): Use Cloud Logs to identify culprit function
   c. **Increase timeout** (if legitimate slow op): Edit function.yaml, re-deploy, monitor
4. Verify in Cloud Logs: no more timeout errors
5. Notify team: Slack #incidents "Function X recovered, cause was [deploy/load/query], fix was [revert/restart/timeout-increase]"

**Prevention:**
- Tests must verify function execution <300s (includes setup + teardown)
- High-latency functions should use Cloud Tasks (async) instead of HTTP callable
- Monitor function duration metrics in Cloud Monitoring (future)

---

## Runbook: Database Unavailable (#db-unavailable)

**Trigger:** Firestore connection fails, all client queries fail with "service unavailable"

**IC Actions:**
1. Check Firebase Console: Firestore status (green or red indicator)
2. Check region status: https://status.cloud.google.com (filter southamerica-east1)
3. Options:
   a. **If Google outage:** Wait for recovery (no action), notify team in Slack
   b. **If isolated issue:** Clear browser cache + try again (usually resolves in 1-2 min)
   c. **If persistence:** Create Cloud Support ticket (requires support plan)
4. **Fallback (if >5 min):** Switch to read-only mode (disable writes, show cached data if available)
5. Communicate: Slack #incidents "Database outage (Google region issue), estimated recovery [X min]"

**Prevention:**
- Multi-region failover (future Phase 8 planning)
- Cloud Firestore automatic failover (available now, check if enabled)

---

## Runbook: Auth Service Down (#auth-down)

**Trigger:** Login fails, "Authentication failed" error for all users

**IC Actions:**
1. Check Firebase Console: Authentication status (green or red)
2. Check if issue is Firebase Auth or app code:
   - Open developer console on login page
   - Check what error: "Firebase service unavailable" vs "Invalid email"
3. Options:
   a. **Firebase outage:** Wait for recovery (no action)
   b. **App code issue:** Check recent deploy (last 10 min), revert auth changes
   c. **Hardcoded secret expired:** Rotate secret in Secret Manager, redeploy functions
4. Verify: Try login again in incognito window
5. Communicate: Slack #incidents "Auth recovered, cause was [Google outage | deploy bug | secret rotation]"

**Prevention:**
- All secrets in Secret Manager, rotated monthly
- Auth functions have explicit error handling (no "undefined" errors)
- E2E tests include login flow (catch before production)

---

## Runbook: Firestore Rules Broken (#rules-broken)

**Trigger:** All Firestore writes fail with "permission-denied", reads may also fail

**IC Actions:**
1. Check Cloud Logs: filter `resource.name=~"firestore" AND severity=ERROR`
2. Check recent Rules deploy: Cloud Console → Firestore → Rules history
3. If recent deploy caused this:
   a. **Revert Rules:** Click "Previous version" → "Restore" (in Console) OR use CLI with previous version hash
   b. Verify: Firestore Console, try writing a doc (should succeed)
4. If no recent deploy:
   a. Check Rules syntax: Look for `function` or `match` errors
   b. Try deploying current Rules again (may be transient)
5. Communicate: Slack #incidents "Rules error fixed, cause was [deploy bug | syntax error], restored from backup"

**Prevention:**
- Firestore Rules deployed only via `firebase deploy` (no manual edits in Console for production)
- Test Rules in Emulator before deploying (CI gate: `npm run test:rules`)

---

## Runbook: Data Corruption Detected (#data-corruption)

**Trigger:** Audit chain broken (hash verification fails) OR customer reports missing records

**IC Actions:**
1. **DO NOT DELETE or modify data** — preserve corruption for forensics
2. **Escalate to CTO immediately** — this is Black incident (potential data loss)
3. CTO decides: restore from backup (loses recent data) vs forensic recovery (slower)
4. If restoring from backup:
   - Identify clean backup point (last known good state)
   - Create new Firestore database from backup (don't overwrite)
   - Verify audit trail integrity in new database
   - Test data quality (spot-check records)
   - Plan switchover (flag current DB as corrupted, point app to new DB)
5. Communicate: CTO + Legal prepare customer notification (within 1h if data loss confirmed)

**Prevention:**
- Audit chain integrity checked daily (cron job, future enhancement)
- Backups automated, tested monthly
- Soft-delete only (never hard delete), soft-delete verified in Rules

---

## Runbook: NOTIVISA API Failure (#notivisa-failure)

**Trigger:** Gov endpoint down or rejecting batches, submissions fail with "API error"

**IC Actions:**
1. Check NOTIVISA status: Contact gov IT support (phone list in contact tree)
2. Check our submission format: Recent NOTIVISA function logs in Cloud Logs
3. Options:
   a. **If gov API down:** Queue submissions for retry (function should auto-retry, check)
   b. **If format issue:** Check RDC Portaria 204/2017 spec, fix function, redeploy
   c. **If timeout:** Increase function timeout (gov API is slow during peak hours)
4. Verify: Check submitted batch status in NOTIVISA test console
5. Communicate: Slack #incidents "NOTIVISA recovery status: [queued for retry | format fixed | waiting on gov]"

**Prevention:**
- NOTIVISA submissions use exponential backoff (max 24h retry)
- Test suite includes gov sandbox environment (smoke test daily)
- Monitor NOTIVISA lag: submission time - acceptance time should be <2 hours

---

## Runbook: Memory Leak in Function (#memory-leak)

**Trigger:** Function memory approaching 512MB limit, executions slow down

**IC Actions:**
1. Check Cloud Logs: Search for "memory approaching" warnings
2. Identify which function: filter `resource.labels.function_name`
3. Check recent deploys: Memory increase correlates with which change?
4. Options:
   a. **Revert recent deploy:** `firebase deploy --only functions --rollback`
   b. **Profile function:** Add console.log for memory usage, check what's growing
   c. **Increase memory allocation:** Edit function.yaml (costs more, temporary fix)
5. Verify: Monitor memory metrics for 30 min after fix
6. Communicate: Slack #incidents "Memory leak fixed, cause was [deploy | listener not cleaning up], permanent fix ETA [date]"

**Prevention:**
- Firebase Functions memory should stay <300MB during execution
- Unsubscribe from listeners in finally block (Firestore onSnapshot)
- Profile high-memory functions in local environment before deploy

---

## Runbook: Cloud Logs Unavailable (#logs-unavailable)

**Trigger:** Cannot view Cloud Logs (UI times out or shows "error loading logs")

**IC Actions:**
1. Check Cloud Console status: https://status.cloud.google.com
2. If Google Cloud is down: Monitor only from alerting (you're flying blind), use automated backups
3. If isolated issue:
   a. Try different browser (cache issue)
   b. Try Cloud Logs API directly: `gcloud logging read "resource.type=cloud_function" --limit 10`
   c. Tail live logs locally: `firebase functions:log` (if you have CLI access)
4. Fallback: Use Slack incidents channel as incident log (timestamp each update)
5. After resolve: Export logs to Cloud Storage for backup (future automation)

**Prevention:**
- Cloud Logs are read-only; failures don't affect application
- Keep backup alerting configured (email or SMS) if Cloud Logs fails
- Document alternative log access methods (local CLI, Cloud Storage exports)
