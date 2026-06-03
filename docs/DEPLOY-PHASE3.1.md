# Deploy Guide — Phase 3.1 (Analytics + Export Pipeline)

**Project:** `hmatologia2` · Region: `southamerica-east1`
**Date authored:** 2026-05-05
**Status:** PENDING CTO AUTHORIZATION

---

## What is being deployed

| Artifact                 | Change                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `firestore.indexes.json` | 3 new composite indexes: `entries (status+deletadoEm)`, `entries (deletadoEm+criadoEm)`, `records (status+deletadoEm)`      |
| `firestore.rules`        | 2 new rule blocks: `export-jobs` (client read-only) and `analytics/cache` (client read-only)                                |
| `functions/src/index.ts` | 3 new functions registered: `aggregateAnalytics` (scheduled), `initiateExport` (callable), `exportWorker` (Pub/Sub trigger) |
| Pub/Sub infrastructure   | Topic `exports` must exist before `exportWorker` subscription is created                                                    |

**Functions NOT touched in this deploy:** all other functions remain unchanged. Deploying only the 3 new functions avoids cold-starting or disrupting existing callables.

---

## Pre-deploy checklist

Run every item in order. Do not proceed past a failed gate.

- [ ] `npx tsc --noEmit` passes with 0 errors in root and `functions/`
- [ ] `cd functions && npm run build` succeeds (clean `functions/lib/` output)
- [ ] Current prod `firestore.rules` backed up (see backup command below)
- [ ] Current prod `firestore.indexes.json` state noted (indexes already building are safe — new ones add, do not replace)
- [ ] Pub/Sub topic `exports` verified or created (see Step 2 below)
- [ ] CTO deploy authorization received for this session

### Backup current rules before deploying

```powershell
# Run from C:\hc quality
$ts = (Get-Date -Format "yyyyMMdd-HHmm")
Copy-Item firestore.rules "docs\audits\firestore.rules.backup-$ts"
```

---

## Ordered deploy steps

Execute in this exact order. Each step is a discrete `firebase deploy` — never chain with `&&` without explicit ack between steps.

### Step 1 — Type-check and build

```powershell
# From C:\hc quality
npx tsc --noEmit
# Expected: no output (0 errors)

cd functions
npm run build
cd ..
# Expected: "Compilation complete." with 0 errors in functions/lib/
```

Gate: both must exit 0. If either fails, do NOT proceed.

### Step 2 — Create Pub/Sub topic `exports` (if not exists)

```powershell
# Check if topic already exists
gcloud pubsub topics describe exports --project=hmatologia2

# If NOT exists (error above), create it:
gcloud pubsub topics create exports --project=hmatologia2

# Verify creation
gcloud pubsub topics list --project=hmatologia2 --filter="name:exports"
```

**Critical:** `exportWorker` is deployed as a Pub/Sub-triggered function. If the topic does not exist at deploy time, the function deploys successfully but its Pub/Sub subscription fails silently — `initiateExport` will publish to a non-existent topic and jobs will never be processed.

### Step 3 — Deploy Firestore indexes (async build)

```powershell
firebase deploy --only firestore:indexes --project hmatologia2
```

- This is additive: only the 3 new indexes are created; existing indexes are unaffected.
- Index build is async and takes 5–15 minutes in Cloud Console.
- Queries against `entries` and `records` with the new field combinations will return errors until indexes are `READY`. Plan for this window.
- Do NOT wait for build before continuing — indexes build independently.

### Step 4 — Deploy Firestore rules

```powershell
firebase deploy --only firestore:rules --project hmatologia2
```

- Adds two new rule blocks: `export-jobs` (read-only for authenticated lab members) and `analytics/cache` (read-only for authenticated lab members).
- No existing rule blocks are modified. No modules lose access.
- No claim provisioning required: the new rules use `request.auth.token.labId == labId` rather than a module claim gate — no `provisionModulesClaims` run needed before this deploy.

### Step 5 — Deploy Cloud Functions (3 new only)

```powershell
firebase deploy --only functions:aggregateAnalytics,functions:initiateExport,functions:exportWorker --project hmatologia2
```

- Targets only the 3 Phase 3.1 functions. All other functions are untouched.
- `aggregateAnalytics` is a scheduled function — Firebase will create the Cloud Scheduler job automatically.
- `exportWorker` will create a Pub/Sub push subscription on topic `exports` (Step 2 must have completed successfully).
- `initiateExport` is a callable — no additional infrastructure needed.

Expected output includes three function URLs/names in `southamerica-east1`.

### Step 6 — Verify deployment

```powershell
# List deployed functions and filter for Phase 3.1
firebase functions:list --project hmatologia2

# In the output, confirm these three appear with region southamerica-east1:
#   aggregateAnalytics
#   initiateExport
#   exportWorker
```

---

## Post-deploy verification checklist

Complete all items before marking Phase 3.1 as deployed.

### Cloud Functions

- [ ] `aggregateAnalytics` visible in Cloud Console → Cloud Functions, region `southamerica-east1`, with a Cloud Scheduler trigger showing the configured cron
- [ ] `initiateExport` visible as HTTP callable in Cloud Console
- [ ] `exportWorker` visible with Pub/Sub trigger bound to topic `exports`
- [ ] No deployment errors in Firebase Console → Functions → Logs (cold start, not runtime errors)

### Pub/Sub

- [ ] Topic `exports` exists: Cloud Console → Pub/Sub → Topics
- [ ] `exportWorker` subscription visible under the topic (created automatically on function deploy)

### Firestore rules

- [ ] Test that an **unauthenticated** request to `export-jobs/{labId}` is rejected (permission-denied)
- [ ] Test that an **authenticated non-member** request to `export-jobs/{labId}` is rejected
- [ ] Test that an **authenticated lab member** (with correct `labId` token claim) can READ from `export-jobs/{labId}`
- [ ] Test that even an **authenticated lab member** cannot WRITE to `export-jobs/{labId}` (client writes blocked by `allow create: if false`)
- [ ] Same read/write tests for `analytics/cache/{labId}`

### Firestore indexes

- [ ] Cloud Console → Firestore → Indexes → Composite — find the 3 new indexes for `entries` and `records` collections
- [ ] Status is `READY` (not `BUILDING`) before running production queries against those field combinations
- [ ] If status is `BUILDING`, note ETA and do not run queries that depend on these indexes until `READY`

---

## Rollback plan

### Firestore rules rollback

```powershell
# Restore from pre-deploy backup
Copy-Item "docs\audits\firestore.rules.backup-<timestamp>" firestore.rules
firebase deploy --only firestore:rules --project hmatologia2
```

Alternatively, using git:

```powershell
git show HEAD~1:firestore.rules | Out-File -Encoding utf8 firestore.rules
firebase deploy --only firestore:rules --project hmatologia2
```

**Impact:** Removes `export-jobs` and `analytics/cache` rule blocks. Any client attempting to read those collections will get `permission-denied`. Cloud Functions that write via Admin SDK are unaffected (Admin SDK bypasses rules).

### Cloud Functions rollback

```powershell
# Delete the 3 new functions
firebase functions:delete aggregateAnalytics initiateExport exportWorker --project hmatologia2
```

**Impact:** `initiateExport` calls from the client will fail with `NOT_FOUND`. Export jobs already in Firestore remain; they will not be processed. `aggregateAnalytics` will stop running on schedule.

### Firestore indexes rollback

There is no CLI rollback for Firestore indexes. To remove a deployed index:

1. Cloud Console → Firestore → Indexes → Composite
2. Find the index, click the trash icon to delete
3. Deletion is immediate; queries relying on it fall back to full-collection scans (or error if the query requires the index)

In practice, the 3 new indexes are additive and do not break any existing query. Rollback is only necessary if an index causes unexpected cost.

---

## Risk register

| Risk                                                       | Severity | Mitigation                                                                                                 |
| ---------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| Pub/Sub topic `exports` missing at function deploy         | HIGH     | Step 2 explicitly creates and verifies topic before Step 5                                                 |
| Index build window (5-15 min) causes query errors          | MEDIUM   | Deploy indexes first (Step 3); production traffic uses existing indexes; new queries gated by feature flag |
| `exportWorker` subscription not created if topic missing   | HIGH     | Verified by post-deploy Pub/Sub check                                                                      |
| Deploying 3 functions touches function deploy quota        | LOW      | Only 3 functions targeted; no global `firebase deploy --only functions`                                    |
| Rules change breaks existing module access                 | LOW      | New blocks are additive; no existing `match` block modified                                                |
| `aggregateAnalytics` scheduled job duplicate if redeployed | LOW      | Firebase CLI is idempotent — Cloud Scheduler job is updated, not duplicated                                |
