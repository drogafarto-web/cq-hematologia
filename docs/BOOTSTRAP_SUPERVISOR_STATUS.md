# Bootstrap supervisor-status — Pre-Deploy Migration

## Overview

The Firestore rules gate critical CIQ writes with `hasActiveSupervisor(labId)`:

```firestore
function hasActiveSupervisor(labId) {
  let statusPath = /databases/$(database)/documents/labs/$(labId)/supervisor-status/current;
  return exists(statusPath)
    && get(statusPath).data.hasActiveSupervisor == true;
}
```

**If the doc doesn't exist, the rule fails closed and blocks all CIQ runs.** This is intentional safety, but each lab must bootstrap a `supervisor-status/current` doc before the rules deploy.

This script creates the doc for all labs in one operation.

---

## Prerequisites

1. **gcloud CLI installed and authenticated:**

   ```bash
   gcloud auth application-default login
   ```

2. **Node 22+** (the script is ES module, requires `firebase-admin` 12+)

3. **Firebase project accessible** (hmatologia2 by default)

---

## Usage

### Preview all labs (dry-run, recommended first)

```bash
node scripts/bootstrap-supervisor-status.mjs --dry-run
```

**Output:**

```
📋 Fetching labs...
✅ Found 5 lab(s)

- Already exists  → /labs/lab-uuid-1/supervisor-status/current
[DRY-RUN] Would create → /labs/lab-uuid-2/supervisor-status/current
- Already exists  → /labs/lab-uuid-3/supervisor-status/current
[DRY-RUN] Would create → /labs/lab-uuid-4/supervisor-status/current
[DRY-RUN] Would create → /labs/lab-uuid-5/supervisor-status/current

═══════════════════════════════════════════════════════════
  Summary
═══════════════════════════════════════════════════════════

📋 Total labs: 5
✅ Created: 0
⊘ Skipped: 2
⚠️  Mode: DRY-RUN (no actual changes)
```

### Execute for all labs

```bash
node scripts/bootstrap-supervisor-status.mjs
```

### Single lab only

```bash
node scripts/bootstrap-supervisor-status.mjs --labId lab-uuid-123
```

### Custom project (staging)

```bash
node scripts/bootstrap-supervisor-status.mjs --project hmatologia2-staging --dry-run
```

### Combine options

```bash
# Single lab, staging, dry-run
node scripts/bootstrap-supervisor-status.mjs --project hmatologia2-staging --labId test-lab-1 --dry-run
```

---

## What the script does

1. **Fetches all labs** from `/labs`
2. **For each lab:**
   - Checks if `/labs/{labId}/supervisor-status/current` exists
   - If **not exists**: creates with `{ hasActiveSupervisor: false, lastUpdated: serverTimestamp() }`
   - If **exists**: skips (already safe)
3. **Logs summary:** created count + skipped count
4. **Dry-run mode** (default with `--dry-run`): previews without writing

---

## Doc Structure

Each created doc has this shape:

```json
{
  "hasActiveSupervisor": false,
  "lastUpdated": <server timestamp>
}
```

- `hasActiveSupervisor: false` — safe default (supervisor not active on startup)
- `lastUpdated` — server timestamp (set by Firestore, not client)
- The doc is **immutable** — only Cloud Functions (`supervisorCheckin`/`supervisorCheckout`) update it

---

## Error Handling

### Firebase auth fails

If you see:

```
❌ Failed to initialize Firebase: ...
  Run: gcloud auth application-default login
```

Then:

```bash
gcloud auth application-default login
# Log in with your Google account in the browser
# Then retry the script
```

### Lab not found with --labId

```bash
node scripts/bootstrap-supervisor-status.mjs --labId invalid-lab-id
# ❌ Lab not found: invalid-lab-id
```

Check the lab ID in Firestore Console.

---

## Verification

After running (without `--dry-run`):

1. **Firestore Console check:**
   - Go to https://console.firebase.google.com/project/hmatologia2/firestore/
   - Navigate to `/labs/{labId}/supervisor-status/current`
   - Verify each lab has the doc with `{ hasActiveSupervisor: false, ... }`

2. **After rules deploy:**
   - Create a CIQ run via Hub
   - Should succeed (rules now find the doc and don't fail-closed)

---

## Rollback / Cleanup

If you need to delete all supervisor-status docs (e.g., testing rollback):

```bash
# Preview what will be deleted
node scripts/cleanup-supervisor-status.mjs --dry-run

# Actually delete (requires explicit --confirm)
node scripts/cleanup-supervisor-status.mjs --dry-run --confirm
```

---

## Integration with Deploy Checklist

This script is **Step 3 of the v1.4 pre-deploy checklist.**

**When to run:**

1. After Wave 2 integration commit (b92fa6e supervisor-gating rules)
2. **Before** `firebase deploy --only firestore:rules`

**Sequence:**

```bash
# 1. Dry-run first
node scripts/bootstrap-supervisor-status.mjs --dry-run

# 2. Review output — looks good?
# 3. Apply
node scripts/bootstrap-supervisor-status.mjs

# 4. Verify in Firestore Console (5 minutes)
# 5. Then deploy rules:
firebase deploy --only firestore:rules --project hmatologia2
```

---

## FAQs

**Q: What if a lab already has a supervisor-status doc?**
A: The script skips it. Safe to re-run multiple times.

**Q: Can I run this with different projects (staging/prod)?**
A: Yes — use `--project <id>`. Default is `hmatologia2`.

**Q: What if Firestore is in emulator mode?**
A: The script detects `FIRESTORE_EMULATOR_HOST` and works with the emulator. Useful for local testing.

**Q: Can I run this for a subset of labs?**
A: Yes — use `--labId <id>` to target a single lab.

**Q: What if the script crashes mid-way?**
A: It's safe to re-run. Skipped labs are idempotent (docs already exist stay untouched).

---

## References

- **Rules definition:** `firestore.rules` line ~110 (`hasActiveSupervisor`)
- **Test:** `functions/src/__tests__/rules/supervisor-gating.test.ts`
- **Compliance:** RDC 978/2025 Art. 122 (supervisor oversight of critical processes)
- **Related script:** `scripts/cleanup-supervisor-status.mjs` (rollback)
- **Deploy checklist:** `docs/DEPLOY_CHECKLIST_v1.4_STEP3.md`
