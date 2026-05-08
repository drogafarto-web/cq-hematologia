# v1.4 Pre-Deploy Checklist — Step 3: Bootstrap supervisor-status

**Phase:** Wave 1 / Wave 2 integration (commit b92fa6e)  
**When:** After Wave 2 rules deploy approval, before Step 4 (firestore:rules deploy)  
**Owner:** DevOps / CTO  
**Duration:** ~5 minutes (3 min script + 2 min verification)  
**Reversible:** Yes (cleanup script available)

---

## Checklist Items

- [ ] **Prerequisite verified:** `gcloud auth application-default login` executed and authenticated
- [ ] **Dry-run executed:** `node scripts/bootstrap-supervisor-status.mjs --dry-run` shows expected output
- [ ] **Output reviewed:** Confirms N labs processed (created + skipped counts make sense)
- [ ] **Script executed:** `node scripts/bootstrap-supervisor-status.mjs` (no --dry-run)
- [ ] **Verification:** Checked Firestore Console that 1+ docs now exist at `/labs/{labId}/supervisor-status/current`
- [ ] **Rules deploy ready:** Confirmed supervisor-status docs exist before `firebase deploy --only firestore:rules`

---

## Step-by-Step Execution

### 1. Dry-run

```bash
node scripts/bootstrap-supervisor-status.mjs --dry-run
```

**Expected output format:**
```
📋 Fetching labs...
✅ Found N lab(s)

[list of labs: ✓ Created / - Already exists / [DRY-RUN] Would create]

═══════════════════════════════════════════════════════════
  Summary
═══════════════════════════════════════════════════════════

📋 Total labs: N
✅ Created: M
⊘ Skipped: K
```

**What to check:**
- Total labs > 0 (if 0, something is wrong with Firestore connectivity)
- Created + Skipped = Total (numbers add up)
- No errors

### 2. Review & Approve

Look at the output:
- Does the count match your expectation?
- Any labs missing?
- Any errors?

If something seems off, investigate before applying.

### 3. Execute (Apply)

```bash
node scripts/bootstrap-supervisor-status.mjs
```

**Expected output:**
```
✅ Created  → /labs/{labId}/supervisor-status/current
[repeat for each lab]
```

**What to check:**
- Script completes without errors
- Created count matches expected new labs
- Skipped count matches labs that already had the doc

### 4. Verify in Firestore Console

1. Go to https://console.firebase.google.com/project/hmatologia2/firestore/
2. Navigate to **Data** tab
3. Open any lab: `/labs/{any-labId}`
4. Look for **supervisor-status** subcollection
5. Open **current** document
6. Verify fields:
   ```json
   {
     "hasActiveSupervisor": false,
     "lastUpdated": <timestamp>
   }
   ```

### 5. Document the Result

Copy this block into your deployment log / PR:

```markdown
## Step 3: Bootstrap supervisor-status

**Executed:** [date/time]
**Executor:** [name]
**Mode:** Production (hmatologia2)

**Dry-run output:**
[paste the dry-run output here]

**Apply output:**
[paste the apply output here]

**Verification:**
- [ ] Checked Firestore Console
- [ ] Confirmed `/labs/{labId}/supervisor-status/current` exists
- [ ] Field `hasActiveSupervisor` = false (safe default)
- [ ] Field `lastUpdated` = server timestamp

**Result:** ✅ PASS / ❌ FAIL

[If FAIL, describe what went wrong]
```

---

## If Something Goes Wrong

### Script errors (Firebase auth)

**Error:** `Failed to initialize Firebase: ...`

**Fix:**
```bash
gcloud auth application-default login
# Log in with your Google account in the browser
# Then re-run the script
```

### Lab not found

**Error:** `Lab not found: lab-uuid-xyz`

**Fix:**
- Double-check the lab ID exists in Firestore
- If using `--labId`, verify you have the correct UUID

### Script hung or timeout

**Fix:**
- Ctrl+C to cancel
- Check internet connectivity
- Check Firestore is accessible: `gcloud firestore collections list --project hmatologia2`
- Re-run

### Already has supervisor-status docs (nothing to create)

**This is OK** — means bootstrap was already done.

```bash
✅ All labs already had supervisor-status docs (no changes)
```

You can proceed to Step 4 (deploy rules).

---

## Rollback (if needed)

If you need to revert this step (e.g., incident response):

```bash
# Preview deletion
node scripts/cleanup-supervisor-status.mjs --dry-run

# Actually delete (requires explicit --confirm)
node scripts/cleanup-supervisor-status.mjs --dry-run --confirm
```

**Warning:** After cleanup, rules will fail-close again and block CIQ writes. Only do this during incident response.

---

## Next Steps

After Step 3 passes:

1. ✅ Step 3: Bootstrap supervisor-status (current)
2. ➜ **Step 4:** Deploy Firestore rules
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
   ```
3. Step 5: Deploy Cloud Functions (if needed)
4. Step 6: Deploy Hosting

---

## Related Documentation

- **Bootstrap script:** `docs/BOOTSTRAP_SUPERVISOR_STATUS.md` — full usage guide
- **Cleanup script:** `scripts/cleanup-supervisor-status.mjs` — rollback
- **Rules definition:** `firestore.rules` line ~110 (`hasActiveSupervisor`)
- **Test coverage:** `functions/src/__tests__/rules/supervisor-gating.test.ts`
- **Compliance:** RDC 978/2025 Art. 122 (active supervisor requirement)
- **Wave 2 context:** `.planning/proposed-changes/wave2-7-supervisor-gating.md`

---

## Sign-Off Template

When Step 3 is complete and verified, fill in and commit:

```markdown
### Step 3: Bootstrap supervisor-status — ✅ COMPLETE

- **Date:** [YYYY-MM-DD HH:MM]
- **Executor:** [name]
- **Labs processed:** [N created, K skipped]
- **Firestore verification:** ✅ Confirmed `/labs/{labId}/supervisor-status/current` exists on [N] labs
- **Rules deploy ready:** ✅ Yes, proceed to Step 4

**Notes:**
[Any issues encountered, how they were resolved, etc.]
```
