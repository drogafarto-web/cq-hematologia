# Cloud Functions Deployment Runbook v1.4

**Last updated:** 2026-05-08  
**Audience:** DevOps, Release Manager, CTO  
**Duration:** ~45 minutes (including smoke tests)

---

## Overview

This runbook guides the deployment of 78+ Firebase Cloud Functions for HC Quality v1.4. Functions are split into **callables** (invoked by client), **crons** (scheduled), and **triggers** (Firestore/Pub/Sub events).

**Deploy order:** Firestore Rules → Secrets (preflight) → Cloud Functions → Smoke tests → Cloud Logs monitoring

**Rollback:** Git revert + redeploy previous commit's functions.

---

## Prerequisites

### 1. Firestore Rules Deployed

Before deploying functions, ensure Firestore rules are live:

```bash
firebase deploy --only firestore:rules --project hmatologia2
```

Verify via Console: `Firestore > Rules > Last modified time` should be recent.

**Why:** Functions write to Firestore collections that are protected by rules. If rules are missing, function writes will fail silently (permission denied).

### 2. All Secrets Provisioned

Run the preflight secrets check:

```bash
bash scripts/preflight-secrets-check.sh
```

**Expected output:**
```
✓ OK — all 14 declared secret(s) have real values. Safe to deploy.
```

**If any secrets are missing:**
```bash
firebase functions:secrets:set GEMINI_API_KEY --project hmatologia2
firebase functions:secrets:set TWILIO_ACCOUNT_SID --project hmatologia2
firebase functions:secrets:set TWILIO_AUTH_TOKEN --project hmatologia2
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2
# ... (see output of preflight check for the full list)
```

### 3. Local Environment

- **Node.js:** 22.x (required; v20 deprecated 2026-10-30)
- **firebase-tools:** `npm install -g firebase-tools@latest`
- **Authentication:** `firebase login`
- **Project:** `firebase projects:list | grep hmatologia2`

### 4. TypeScript Builds Cleanly

```bash
cd functions && npx tsc --noEmit
```

**Expected:** No errors. If TypeScript errors appear, fix them before deployment.

---

## Deployment Steps

### Step 1: Preflight Validation (5 min)

```bash
# 1a. Check secrets
bash scripts/preflight-secrets-check.sh

# 1b. Check functions structure
bash scripts/preflight-functions-check.sh

# 1c. Build and type-check
cd functions
npm run build
npm audit --production  # Review for critical vulns
cd ..
```

**Gate:** Both scripts must return exit code `0`. If not, stop and fix issues before proceeding.

### Step 2: Dry-Run Deployment (5 min)

```bash
bash scripts/deploy-functions.sh --dry-run
```

**Output:** Shows what would be deployed (no actual changes).

### Step 3: Deploy Functions (15 min)

**Option A: All functions at once (recommended)**
```bash
bash scripts/deploy-functions.sh --phase 1
```

**Option B: Callables only** (if crons were deployed separately earlier)
```bash
bash scripts/deploy-functions.sh --phase 2
```

**Option C: Single function** (emergency hotfix)
```bash
bash scripts/deploy-functions.sh --phase 3 --function criarLaudo
```

**Monitor deployment:**
- Console output shows progress (`Deploying function X of Y...`)
- Look for `Deploy complete!` at the end
- If interrupted, re-run the command (Firebase CLI is idempotent)

### Step 4: Verify Deployment (5 min)

Check Firebase Console:
- **Functions tab:** All ~78 functions show as "Active" (green)
- **Last deployment:** Recent timestamp (within last 5 min)
- **Runtime:** Node 22 (not Node 20)

```bash
# List deployed functions via CLI
firebase functions:list --project hmatologia2
```

### Step 5: Smoke Tests (10 min)

#### 5.1 Test a critical callable

Example: `criarLaudo` (creates clinical report)

```bash
firebase functions:call criarLaudo --data '{"labId":"lab-01","runIds":["run-001"],"pacienteId":"pac-001","medicoSolicitanteId":"doc-001","exames":[]}' --project hmatologia2 --region southamerica-east1
```

**Expected:** Returns a JSON response with `laudoId`, `status`, `autoReleased`.

#### 5.2 Test consent gate

Example: `extractLaudoFields` (OCR extraction with LGPD consent check)

```bash
firebase functions:call extractLaudoFields --data '{"labId":"lab-01","laudoId":"laudo-001","storageUrl":"https://storage.googleapis.com/...","patientId":"pac-001"}' --project hmatologia2 --region southamerica-east1
```

**Expected:** Either a successful extraction or `failed-precondition` error if consent is missing.

#### 5.3 Test cron registration

Check Cloud Scheduler for newly deployed crons:

```bash
gcloud scheduler jobs list --project=hmatologia2 --location=southamerica-east1
```

**Expected jobs:**
- `notivisa-poll-submissions-5min`
- `presence-cleanup-8h`
- `audit-log-expiry-daily`

#### 5.4 Test trigger (Firestore write)

Create a test document in Firestore:

```bash
firebase firestore:delete /labs/lab-01/bioquimica/root/runs/test-run-001 --project hmatologia2 --force --shallow
firebase firestore:set /labs/lab-01/bioquimica/root/runs/test-run-001 '{"equipmentId":"eq-001","operatorId":"op-001","criadoEm":1714953600}' --project hmatologia2
```

Monitor Cloud Logs to see the trigger fire:

```bash
gcloud functions log read onBioquimicaRunAudit --region southamerica-east1 --project hmatologia2 --limit 10
```

### Step 6: Cloud Logs Monitoring (≥30 min, automated)

Start real-time log monitoring:

```bash
bash scripts/monitor-cloud-logs.sh 30 60
```

**Parameters:** 
- `30` — polling interval (seconds)
- `60` — total duration (minutes)

**Output:** JSON report + summary of:
- Error rate per function
- Latency p50/p95/p99
- Cold starts
- Memory usage

**Red flags:**
- Error rate >5% on any single function
- Latency p99 >5s for critical paths (criarLaudo, recordRunBioquimica, etc.)
- OOM (Out of Memory) crashes
- Permission denied errors (Firestore or secrets)

---

## Troubleshooting

### Error: "Secrets validation failed"

**Cause:** One or more `defineSecret()` declarations in `functions/src/` are unprovisioned.

**Fix:**
```bash
bash scripts/preflight-secrets-check.sh
# Follow the instructions in the output
firebase functions:secrets:set MISSING_SECRET_NAME --project hmatologia2
bash scripts/preflight-secrets-check.sh  # Verify it passes now
```

### Error: "TypeScript compilation failed"

**Cause:** Source code has type errors.

**Fix:**
```bash
cd functions
npx tsc --noEmit 2>&1 | head -20  # Show first 20 errors
# Fix the errors in the source files
npm run build
```

### Error: "Firebase authentication expired"

**Cause:** `firebase login` token has expired.

**Fix:**
```bash
firebase login
# Follow browser prompt to re-authenticate
firebase projects:list  # Verify access
```

### Error: "Deploy stalled / timed out after 10 min"

**Cause:** Firebase backend is slow or there's a network issue.

**Fix:**
1. Check Cloud Functions console for any activity
2. Wait 5 minutes, then re-run the deploy command (idempotent, safe)
3. If still stalled, check `gcloud functions list --project=hmatologia2`

### Error: "Permission denied" when writing to Firestore

**Cause:** Function is running before Firestore rules are deployed, OR the function's service account lacks permissions.

**Fix:**
1. Ensure Firestore rules are deployed: `firebase deploy --only firestore:rules`
2. Verify default Cloud Functions service account has Editor role in IAM

### Cold start latency >10s

**Cause:** Large dependencies (e.g., Gemini API, SheetJS) are being imported at module level.

**Fix:**
- Use `import(...) ` (dynamic import) for large libraries
- Example: `const xlsx = await import('xlsx');` (inside the function, not at module level)
- Redeploy and monitor

---

## Rollback Plan

### Quick rollback (last deployment)

If functions were just deployed and are causing widespread errors:

```bash
# Revert the last commit (assuming it touched functions/src/)
git revert HEAD

# Redeploy the previous version
bash scripts/deploy-functions.sh --phase 1
```

### Selective rollback (single function)

If one function is broken but others are working:

```bash
# Revert just that function's source
git show HEAD~1:functions/src/modules/foo/bar.ts > functions/src/modules/foo/bar.ts

# Rebuild and redeploy just that function
cd functions && npm run build
firebase deploy --only functions:barCallable --project hmatologia2
```

### Full rollback via Cloud Functions UI

If CLI is unavailable:
1. Go to [Firebase Console > Functions](https://console.firebase.google.com/project/hmatologia2/functions)
2. Select each problematic function
3. Click "Delete"
4. Redeploy via CLI once issues are fixed

---

## Success Criteria

Deployment is **complete and safe** if:

- ✓ All 78 functions show as "Active" in Console
- ✓ Smoke tests (critical callables) return success
- ✓ Cloud Logs show error rate <2% over 60 min
- ✓ No "permission denied" errors in logs
- ✓ No "PENDING_SET_*" secret values in Cloud Logs
- ✓ Crons are registered in Cloud Scheduler
- ✓ Firestore rules are deployed (pre-req check)

---

## Post-Deployment

### 1. Announce deployment to team

Send message with:
- Deployment timestamp
- Version/commit SHA
- Which functions were deployed (all / selected)
- Known issues (if any)

### 2. Monitor for 24h

Watch Cloud Logs dashboard for errors. If error rate spikes:
- Check recent logs for patterns
- Cross-reference with recent code changes
- If critical, initiate rollback

### 3. Update deployment notes

Log in the project's shared notes (e.g., Obsidian or Slack) with:
- Date/time of deployment
- Deployment duration
- Any issues encountered
- Smoke test results

---

## See Also

- **ADR-0018:** Deploy gate design (secret validation)
- **ADR-0017:** HMAC incident (why this runbook exists)
- **PERFORMANCE_VALIDATION.md:** Pre-deployment performance checks
- **CLOUD_LOGS_MONITORING_GUIDE.md:** Detailed log setup
- **deploy-protocol.md:** General Firebase deploy conventions

---

## Support

**Questions or issues?**
- Escalate to CTO
- Review Cloud Functions logs: `gcloud functions log read FUNCTION_NAME --region southamerica-east1 --project hmatologia2 --limit 50`
- Check Firebase status: https://status.firebase.google.com/
