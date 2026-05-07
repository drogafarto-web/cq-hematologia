# Phase 3 Operational Runbook — Production Monitoring & Incident Response

**Version:** 1.0  
**Date:** 2026-05-07  
**Status:** Live  
**Audience:** DevOps, Backend Engineers, On-Call Operators, CTO

---

## Overview

This runbook covers daily operations for **HC Quality Phase 3** in production. Phase 3 includes 25 modules across 5 key domains: CIQ (coagulation, immunology, urinalysis, biochemistry), infrastructure (equipment, suppliers, lot management), regulatory (NOTIVISA, audit trails, quality documentation), clinical (laudo generation, critical values), and admin (settings, hub, authentication).

**Scope:** Monitoring, alerting, troubleshooting, escalation, and rollback procedures for Phase 3 production services.

**SLA:** 99.5% uptime | Response time: P0 <15min, P1 <1h, P2 <8h

---

## Table of Contents

1. [Daily Monitoring Checklist](#daily-monitoring-checklist-5-min)
2. [Alert Thresholds & Severity](#alert-thresholds--severity)
3. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
4. [Rollback Procedure](#rollback-procedure)
5. [On-Call Escalation](#on-call-escalation)
6. [Post-Incident Review](#post-incident-review)

---

## Daily Monitoring Checklist (5 min)

Run this sequence every morning and before major deployments. Automate via cron for 24/7 coverage.

### 1. Cloud Logs Errors (P0/P1/P2)

**Command:**
```bash
gcloud logging read "severity >= ERROR AND timestamp > now - 60m" \
  --project=hmatologia2 \
  --limit=100 \
  --format="table(timestamp, severity, labels.function_name, textPayload)"
```

**Check:**
- [ ] Error count in last 1h ≤ 5
- [ ] No `"Permission denied"` on `/labs/{labId}/*` writes
- [ ] No `"Function timeout"` patterns
- [ ] No `"Document too large"` errors
- [ ] No repeated stack traces (indicates cascading failure)

**If any fail:** → Escalate to P1 (see [Alert Thresholds](#alert-thresholds--severity))

---

### 2. Firestore Quota Usage

**Command:**
```bash
gcloud firestore stat --project=hmatologia2
```

**Check:**
- [ ] Disk usage growth rate <10% month-over-month
- [ ] Document count matches expected baseline (should be stable or grow <5% daily)
- [ ] No unexplained spikes in write operations

**Expected baseline (as of 2026-05-07):**
- ~850K documents
- ~45 GB storage
- ~200K daily writes

**If quota exceeded 80%:**
- Document the spike with timestamp
- Check for bulk imports or drive syncs in progress
- If unplanned, escalate to P1

---

### 3. Function Invocation Count & Latency

**Command:**
```bash
gcloud monitoring time-series list \
  --filter="metric.type = cloudfunctions.googleapis.com/function/execution_count" \
  --project=hmatologia2 \
  --format="table(points[0].value.double_value, resource.labels.function_name)"
```

**Check:**
- [ ] Total invocations in last 1h >100 (healthy baseline)
- [ ] No single function invoked >10k times in 1h (possible infinite loop)
- [ ] P99 latency <3s (healthy range; <5s acceptable)

**Spike investigation:**
```bash
# Find which function is spiking
gcloud logging read \
  'resource.type="cloud_function" AND timestamp > now - 60m' \
  --project=hmatologia2 \
  --format="table(labels.function_name)" | sort | uniq -c | sort -rn
```

If single function >10% of invocations: Check for runaway polling or trigger misconfig.

---

### 4. Laudo Draft Locks (Auto-Expire)

**Check:** Locks should expire automatically after 1h. Manual cleanup only if stuck >2h.

**Command (manual check):**
```bash
# Query laudo collection for stuck locks
firebase firestore --project=hmatologia2 \
  'collection("labs").doc("{labId}").collection("laudos").where("lock.expiresAt", "<", now())'
```

**If any found:**
- [ ] Document timestamp + `laudo_id`
- [ ] Check Cloud Logs for error during laudo generation
- [ ] If lock created >2h ago: Force-delete via admin SDK

**Expected:** 0 stuck locks at any time. If >2 found in 24h → P2 (investigate laudo generation timeout)

---

## Alert Thresholds & Severity

| Metric | Threshold | Severity | Action | Response |
|--------|-----------|----------|--------|----------|
| Cloud Logs errors/hour | >10 | P0 | Immediate investigation | <15 min |
| `"Permission denied"` count | >0 (on writes) | P0 | Check rules rollback | <15 min |
| Laudo draft lock stuck | >2h | P1 | Force-delete, debug | <1 h |
| NOTIVISA retry attempts | >3 (same event) | P1 | Check payload validation | <1 h |
| Firestore rules rejections | >100/hour | P2 | Analyze rejection patterns | <8 h |
| Function cold-start latency | >5s (P99) | P2 | Profile bundle size | <8 h |
| Unhandled exceptions | >1/hour | P2 | Stack trace analysis | <8 h |
| Build time degradation | +20% vs baseline | P2 | Profile imports, check bundle | <24 h |
| Firestore quota usage | >85% | P1 | Investigate bulk ops | <1 h |
| HTTP 5xx errors | >5/hour | P1 | Check hosting logs | <1 h |

---

### Severity Definitions

**P0 — Critical (15 min SLA):**
- Service unavailable or degraded for >5 min
- Data loss or data corruption detected
- Security breach or unauthorized access
- Rules rejecting all writes to a collection

**P1 — High (1 hour SLA):**
- Feature unusable (but service up)
- Performance degraded >50%
- Intermittent errors affecting >10% of requests
- External API integration failing (NOTIVISA, Drive, Gemini)

**P2 — Medium (8 hour SLA):**
- Single-module failure (doesn't block other modules)
- Minor performance issue (<50% degradation)
- Code quality issue (dead code, unused variables)
- Documentation missing or outdated

---

## Common Issues & Troubleshooting

### Issue 1: Draft Lock Stuck >2h

**Symptom:** Laudo locked for editing, user reports "cannot edit result"

**Log Signature:**
```
Cloud Logs: laudo_id={id}, lock.operatorId={uid}, lock.createdAt={ts}
```

**Root Cause:**
- Operator session killed while editing (no cleanup)
- Cloud Function timeout during laudo generation
- Network disconnect during `unlockLaudo` call

**Resolution:**

**Step 1: Confirm lock is stuck (not just delayed)**
```bash
firebase firestore --project=hmatologia2 \
  'collection("labs").doc("{labId}").collection("laudos").doc("{laudo_id}").get().lock'

# Expected lock.expiresAt: if > now + 1h, it's stuck
```

**Step 2: Force-delete lock (via Admin SDK)**

Create temporary script `force-unlock-laudo.js`:
```javascript
const admin = require('firebase-admin');
const projectId = 'hmatologia2';
const labId = 'LAB001'; // Replace with actual labId
const laudoId = 'laudo-123'; // Replace with actual laudo_id

admin.initializeApp({
  projectId: projectId
});

async function forceClearLock() {
  const laudoRef = admin.firestore()
    .collection('labs').doc(labId)
    .collection('laudos').doc(laudoId);
  
  const laudoDoc = await laudoRef.get();
  console.log('Current lock:', laudoDoc.data().lock);
  
  await laudoRef.update({
    lock: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log('Lock cleared. Audit entry created.');
}

forceClearLock().catch(console.error);
```

**Step 3: Audit trail**
- [ ] Document `laudo_id`, operator, lock timestamp, force-clear timestamp
- [ ] Create audit entry via `auditTrail` subcollection:
  ```
  {
    action: "LOCK_FORCE_CLEARED",
    reason: "Stuck lock >2h, operator: {operatorId}",
    operator: "admin-on-call",
    timestamp: now()
  }
  ```

**Step 4: Alert operator**
- [ ] Notify original operator: "Draft lock cleared due to timeout. Please retry."
- [ ] Escalate to P2 if >2 incidents in 24h (indicates timeout issue)

---

### Issue 2: NOTIVISA Event Failed >3 Attempts

**Symptom:** Regulatory notification not reaching NOTIVISA. User reports "event stuck PENDING"

**Log Signature:**
```
Cloud Logs: "sendNotivisa" OR "notivisa-outbox"
Error: attempts=3, status=FAILED, nextRetry=null
```

**Root Cause:**
- Invalid patient CPF format (masking error)
- NOTIVISA API authentication expired
- Payload validation failing (missing required fields per RDC 978 Art. 6º §1)
- Network timeout or NOTIVISA API down

**Resolution:**

**Step 1: Check payload validation**
```bash
gcloud logging read \
  'textPayload =~ ".*notivisa.*" AND severity >= ERROR' \
  --project=hmatologia2 \
  --limit=10 \
  --format=json | jq '.[].textPayload' | head -5
```

**Step 2: Validate CPF masking**
```bash
# Check if patient_cpf is correctly masked (should be 11 digits, no dashes)
# Example: 12345678901 ✓ | 123.456.789-01 ✗
firebase firestore --project=hmatologia2 \
  'collection("labs").doc("{labId}").collection("notivisa-outbox").where("status", "==", "FAILED").limit(5)'
```

**Step 3: Retry manually**

```bash
# Create callable function trigger to retry specific event
firebase deploy --only functions:retryNotivisaEvent --project=hmatologia2

# Call via curl or Firebase Console:
curl -X POST https://hmatologia2.cloudfunctions.net/retryNotivisaEvent \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{"labId": "LAB001", "eventId": "event-123"}'
```

**Step 4: Check NOTIVISA API credentials**
```bash
# Verify env var is set
firebase functions:config:get | grep NOTIVISA

# If missing or wrong, update:
firebase functions:config:set notivisa.api_key="<key>" --project=hmatologia2
firebase deploy --only functions --project=hmatologia2
```

**Step 5: Escalate if pattern continues**
- If >5 events failing after retry → P1
- Document failed event IDs + timestamps
- Check NOTIVISA API status page
- Notify compliance team (regulatory requirement)

---

### Issue 3: Rules Rejections Spiking >100/hour

**Symptom:** Users report "permission denied" on normal operations. Cloud Logs show rules rejections.

**Log Signature:**
```
Cloud Logs: resource.type="cloud_firestore" 
AND textPayload =~ ".*Permission denied.*"
```

**Root Cause:**
- Rules deployed with incorrect RBAC logic
- `membership` collection out of sync (user no longer member of lab)
- Multi-tenant isolation broke (labId mismatch)
- Token expired or invalid request auth

**Resolution:**

**Step 1: Identify rejection pattern**
```bash
gcloud logging read \
  'resource.type="cloud_firestore" AND textPayload =~ ".*Permission denied.*"' \
  --project=hmatologia2 \
  --limit=50 \
  --format=json | jq -r '.[] | "\(.timestamp): \(.textPayload)" | capture("path: (?<path>[^,]+)") | .path' | sort | uniq -c | sort -rn
```

**Step 2: Check rules logic**
```bash
# View current rules
firebase rules:get firestore --project=hmatologia2

# Verify labId isolation at collection level
# Expected: match /labs/{labId}/* { allow read,write: if labId in request.auth.labIds; }
```

**Step 3: Check membership sync**

```bash
# Verify operator is member of lab
firebase firestore --project=hmatologia2 \
  'collection("membership").where("labId", "==", "LAB001").where("operatorId", "==", "user-123").get()'

# If empty: operator was removed but still has open session
# → Direct operator to re-login
```

**Step 4: Rollback rules if >5% error rate**
```bash
# Get previous rules version
git log --oneline -- firestore.rules | head -5

# Checkout previous version
git checkout HEAD~1 firestore.rules

# Deploy rollback
firebase deploy --only firestore:rules --project=hmatologia2 -m "Rollback: rules rejections spike"

# Verify via logs (should drop to <5/hour within 2 min)
sleep 120
gcloud logging read \
  'resource.type="cloud_firestore" AND textPayload =~ ".*Permission denied.*" AND timestamp > now - 10m' \
  --project=hmatologia2 --limit=20
```

**Step 5: Investigate root cause post-rollback**
- Review rules diff: `git diff HEAD~1 firestore.rules`
- Check if RBAC logic change introduced bug
- Test in staging before re-deploying to prod
- Document lessons learned in incident review

---

### Issue 4: Build Time Degradation (+20% vs baseline)

**Symptom:** Deploy takes significantly longer than usual. Build logs show slowdown.

**Baseline metrics (Phase 3 initial):**
- `npm run build`: ~45s (main app + functions combined)
- `tsc --noEmit`: ~12s (type check)
- Bundle size: ~362 KB (main chunk gzip)

**Root Cause:**
- New large dependency added (>50KB gzip)
- Type checking enabled for more files
- Composite indexes rebuilding
- Disk space low

**Resolution:**

**Step 1: Identify slow step**
```bash
# Time each build phase
time npm run build 2>&1 | tee build-profile.log

# Expected breakdown:
# - tsc: ~12s
# - vite build: ~30s
# - functions build: ~15s
```

**Step 2: Check for new imports**
```bash
# Compare bundle size vs last known good
npx vite build
# Check dist/ size: should be ~362KB (main.js gzip)

# If larger, profile:
npx vite-plugin-visualizer
# Opens interactive bundle analysis
```

**Step 3: Check for new dependencies**
```bash
# Compare package.json vs last deploy
git diff HEAD~1 package.json | grep "^+" | grep '"'

# If any new large deps found:
npm ls --depth=0 | grep -E "chalk|lodash|axios" # common culprits

# Ask: Is there a lighter alternative?
# - chalk → picomatch (if only for CLI logging)
# - axios → node-fetch (if HTTP only)
# - lodash → lodash-es (tree-shaking friendly)
```

**Step 4: Profile type checking**
```bash
# Check if tsconfig includes too many files
cat tsconfig.json | jq '.include'

# Should exclude node_modules, dist, .next, etc.
# If too broad (e.g., "src/**/*"), tighten it:
# "include": ["src/**/*.ts", "src/**/*.tsx", "functions/src/**/*.ts"]
```

**Step 5: Clear caches if stuck**
```bash
rm -rf node_modules dist .turbo .next
npm install
npm run build
```

**Step 6: If >20% slower, don't deploy**
- Revert recent commits until baseline restored
- Profile root cause before re-adding changes
- Escalate to P2 with timeline

---

## Rollback Procedure

**When to rollback:**
- P0 issue unresolved after >30 min investigation
- Data integrity compromised
- Security vulnerability discovered post-deploy
- >20% error rate on single module

**Scope:** Can rollback Rules, Functions, or Hosting independently.

### Step 1: Identify rollback target

**Check Git history:**
```bash
git log --oneline --decorate | head -10

# Example output:
# abc123d (HEAD -> main) deploy(phase-3): Rules v1.4 + notivisa-outbox
# def456c deploy(phase-3): Schema extensions + indexes
# ghi789j (tag: v1.3-final) Phase 3 ready for production
```

**Choose rollback commit:**
- If rules broken: rollback to `v1.3-final`
- If functions broken: rollback to `v1.3-final`
- If hosting broken: rollback to `v1.3-final`

### Step 2: Create rollback branch

```bash
git checkout v1.3-final
git checkout -b rollback/phase3-emergency
```

### Step 3: Deploy rollback (by component)

**Rollback Rules only:**
```bash
firebase deploy --only firestore:rules --project=hmatologia2 \
  -m "Rollback: Rules regression detected — [reason]"

# Verify
firebase rules:get firestore --project=hmatologia2 | head -20
```

**Rollback Functions only:**
```bash
cd functions
npm run build
firebase deploy --only functions --project=hmatologia2 \
  -m "Rollback: Functions broken — [reason]"

# Verify functions deployed
firebase functions:list --project=hmatologia2 | head -10
```

**Rollback Hosting only:**
```bash
firebase deploy --only hosting --project=hmatologia2 \
  -m "Rollback: Hosting broken — [reason]"

# Verify hosting is live
curl -I https://hmatologia2.web.app
# Expected: HTTP 200
```

### Step 4: Verify rollback successful

**Health check:**
```bash
# 1. Cloud Logs — errors should drop
gcloud logging read "severity >= ERROR AND timestamp > now - 5m" \
  --project=hmatologia2 --limit=20
# Expected: <5 errors

# 2. Critical functions — smoke test
firebase functions:shell --project=hmatologia2
> parseResultBioquimica({data: {...}})
# Expected: no errors

# 3. Hosting — basic navigation
curl https://hmatologia2.web.app
# Expected: HTML response, no 5xx
```

### Step 5: Document rollback

**Create incident report:**
```markdown
# Rollback Report — Phase 3 [Date]

**Trigger:** [P0 issue description]
**Rollback Time:** [timestamp]
**Rollback Duration:** [how long to stable]
**Root Cause:** [if identified]
**Resolution:** [what to do before re-deploying]

**Impact:**
- Downtime: [duration]
- Users affected: [count / estimate]
- Data loss: [yes/no]
```

**Save to:** `docs/rollback-reports/rollback-<date>.md`

**Commit:**
```bash
git add docs/rollback-reports/
git commit -m "docs: Rollback report — Phase 3 [issue] [date]"
git push origin main
```

### Step 6: Investigate root cause (post-rollback)

Once system is stable, investigate why the deployment failed:
1. Compare rollback version vs deployed version
2. Identify the specific commit that introduced the issue
3. Run smoke tests on staging with that commit
4. Fix the issue and re-test before redeploying

**Timeline:**
- Rollback: <15 min (to stable)
- Investigation: <2h (parallel with team)
- Fix validation: <1h (staging smoke tests)
- Re-deploy: <30 min (follow deploy protocol)

---

## On-Call Escalation

### L1 — Ops / On-Call (First Response)

**Your role:** Monitor, collect data, initial triage.

**When to escalate:**
- If issue not resolved within 15 min (P0)
- If root cause unclear after 20 min investigation
- If rollback needed

**Before escalating, gather:**
- [ ] Exact error messages from Cloud Logs (copy-paste)
- [ ] Timestamps of first occurrence + current status
- [ ] Affected user count (if known)
- [ ] Reproduction steps (if possible)
- [ ] Screenshot or video (if UI issue)

**Escalation path:** Slack `#incidents` → Page L2 on-call

---

### L2 — Backend / Platform Engineer

**Your role:** Deep debugging, code changes, deploy.

**What you'll receive:** L1 summary + logs.

**Checklist:**
- [ ] Verify L1 findings in Cloud Logs / Cloud Console
- [ ] Check recent commits: `git log --oneline | head -20`
- [ ] Run Cloud Logs filters from [Daily Monitoring](#daily-monitoring-checklist-5-min) section
- [ ] Identify if it's Rules, Functions, Hosting, or Firestore data issue
- [ ] Decide: investigate deeper vs. rollback immediately
- [ ] If rollback: follow [Rollback Procedure](#rollback-procedure)
- [ ] If investigate: parallel with L3, post findings to Slack every 10 min

**Escalation to L3:** If root cause not found within 30 min or if decision needed (rollback, data fix, etc.)

---

### L3 — CTO / Architect

**Your role:** Strategic decisions, major changes, customer communication.

**When called:**
- P0 issues unresolved after 30 min
- Potential data loss / corruption
- Security incident
- Need to decide rollback or emergency hotfix
- Need to communicate with customers

**Your checklist:**
- [ ] Review incident summary from L2
- [ ] Assess business impact
- [ ] Decide: rollback vs. emergency fix vs. accept risk for now
- [ ] If rollback: approve and oversee execution
- [ ] If hotfix: ensure fast-track code review + deploy
- [ ] Update status page + customer communications
- [ ] Schedule post-incident review

---

## Post-Incident Review

**Timing:** Within 24h of any P0/P1 incident.

**Attendees:** L2 + L3 + module owner (optional).

**Format:** 30 min discussion + 1 page written report.

### Discussion Topics

1. **Timeline:** Exactly when did issue appear? When did we detect? When resolved?
2. **Root cause:** Why did it happen? Single point of failure or systematic issue?
3. **Detection gaps:** How should we have found it sooner?
4. **Prevention:** What should we have done to avoid this?
5. **Remediation:** How should we handle it if it happens again?

### Written Report Template

**File:** `docs/incident-reports/incident-<date>-<title>.md`

```markdown
# Incident Report — [Title]

**Date:** 2026-05-07
**Duration:** 45 minutes
**Severity:** P0
**Impact:** 150 users unable to generate laudo results

## Timeline

- 14:30 UTC — First error detected in Cloud Logs
- 14:35 UTC — L1 on-call paged L2
- 14:50 UTC — Root cause identified (rules regression)
- 15:15 UTC — Rollback deployed, service restored

## Root Cause

Rules v1.4 had overly restrictive labId check. Condition should be:
```
allow write: if request.auth.labIds.contains(resource.data.labId);
```
But deployed as:
```
allow write: if request.auth.labIds[0] == resource.data.labId;
```
Failed for operators with multiple lab access.

## Prevention

1. Add unit tests for multi-lab operator scenarios
2. Smoke test in staging with multi-lab user before prod deploy
3. Add quota-alert rule: if rules rejections >50/hour, page on-call

## Follow-up

- [ ] Add multi-lab operator to CI test data
- [ ] Update rules testing guide
- [ ] Review other rules for similar patterns
- [ ] Deploy quota-alert rule
```

---

## Appendix: Quick Command Reference

### Check System Health (1 min)

```bash
# 1. Errors in last hour
gcloud logging read "severity >= ERROR AND timestamp > now - 60m" \
  --project=hmatologia2 --limit=20

# 2. Firestore quota
gcloud firestore stat --project=hmatologia2

# 3. Function statuses
firebase functions:list --project=hmatologia2

# 4. Hosting status
curl -I https://hmatologia2.web.app

# 5. Latest deploy time
gcloud app versions list --project=hmatologia2 --limit=1
```

### Verify Rules Are Live

```bash
firebase rules:get firestore --project=hmatologia2 | grep -A5 "v1.4"
# Should show: Service.match ... rule blocks for Phase 3 collections
```

### Check a Specific Lab's Data

```bash
firebase firestore --project=hmatologia2 \
  'collection("labs").doc("LAB001").get()'
```

### Force-Clear a Laudo Lock (Admin Only)

```bash
firebase firestore --project=hmatologia2 \
  'collection("labs").doc("LAB001").collection("laudos").doc("laudo-123").update({"lock": null})'
```

### Tail Cloud Logs in Real-Time

```bash
gcloud logging read "severity >= WARNING" \
  --project=hmatologia2 \
  --limit=50 \
  --follow
# Press Ctrl+C to stop
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-07 | Initial Phase 3 runbook — daily checklist, thresholds, troubleshooting, escalation, rollback |

---

**Last Updated:** 2026-05-07  
**Owner:** DevOps / Platform Team  
**Next Review:** 2026-05-21 (2 weeks post-Phase 3 production)
