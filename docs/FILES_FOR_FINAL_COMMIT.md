# v1.3 Final Commit — Files to Stage

**Status:** Ready for `git add` after smoke tests pass (Step 4)  
**Target branch:** `main`  
**User execution:** `git commit -m "...message from FINAL_COMMIT_MESSAGE.txt"`

---

## 1. Documentation — 5 Sign-Off Files (NEW)

These files are already created. Verify they exist before staging:

```bash
ls -la C:\hc quality\docs\SMOKE_TESTS_*.md
ls -la C:\hc quality\docs\SECURITY_SIGN_OFF_v1.3.md
ls -la C:\hc quality\docs\POST_DEPLOY_CHECKLIST_v1.3.md
ls -la C:\hc quality\docs\COMPLIANCE_SUMMARY_v1.3.md
```

| File | Size | Status |
|------|------|--------|
| `docs/SMOKE_TESTS_v1.3.md` | ~340 lines | ✅ Ready to stage |
| `docs/SMOKE_TESTS_TEST_DATA_GUIDE.md` | ~427 lines | ✅ Ready to stage |
| `docs/POST_DEPLOY_CHECKLIST_v1.3.md` | ~220 lines | ✅ Ready to stage |
| `docs/SECURITY_SIGN_OFF_v1.3.md` | ~215 lines | ✅ Ready to stage |
| `docs/COMPLIANCE_SUMMARY_v1.3.md` | ~360 lines | ✅ Ready to stage |

**Staging command:**
```bash
git add docs/SMOKE_TESTS_v1.3.md \
        docs/SMOKE_TESTS_TEST_DATA_GUIDE.md \
        docs/POST_DEPLOY_CHECKLIST_v1.3.md \
        docs/SECURITY_SIGN_OFF_v1.3.md \
        docs/COMPLIANCE_SUMMARY_v1.3.md
```

---

## 2. Project State — UPDATED

| File | Change | Status |
|------|--------|--------|
| `.planning/STATE.md` | ✏️ Update deployment progress (Step 2→4), final timestamp | ⏳ Wait for smoke tests |

**Staging command:**
```bash
git add .planning/STATE.md
```

**What to update in STATE.md before staging:**
- Change `deployment_steps_complete` from `2` to `4`
- Change `deployment_percent` from `50` to `100`
- Update `status` from `v1.3-deploying` to `v1.3-deployed`
- Update `last_activity` to reflect Step 4 completion
- Update `last_updated` timestamp to smoke tests completion time

---

## 3. Functions — Wire Index (ALREADY DONE IN STEP 2)

| File | Change | Status |
|------|--------|--------|
| `functions/src/index.ts` | ✅ 27 v1.3 exports added (Batch 4) | ✅ Already staged in Step 2 |

**Do NOT re-edit this file.** All 27 exports are already present:
- 6 Bioquímica functions
- 4 SGQ functions
- 4 Liberação + Críticos functions
- 10 Reclamações + Satisfação + Sugestões functions
- 3 Phase 8 (CAPA/calibração) functions

**Verify no changes pending:**
```bash
git status functions/src/index.ts
# Should show clean or already staged
```

---

## 4. Module Files — NO CHANGES (Already Deployed in Step 2)

These files are already committed from previous phases. No changes needed:

```
functions/src/modules/
├── bioquimica/
│   ├── index.ts
│   ├── onBioquimicaRunCreate.ts
│   ├── onBioquimicaLeveyJennings.ts
│   ├── syncBioquimicaBulaparser.ts
│   ├── onBioquimicaAudit.ts
│   ├── generateBioquimicaReport.ts
│   └── (2 more)
├── sgq/
│   ├── index.ts
│   ├── importDocumentsFromDrive.ts
│   ├── onDocumentoWorkflow.ts
│   ├── syncListaMestraVersions.ts
│   └── generateSGQAuditReport.ts
├── liberacao/
├── criticos/
├── reclamacoes/
├── satisfacao/
├── sugestoes/
└── calibracao/
```

**Status:** ✅ All already committed in Phase 8-12 work  
**Do NOT stage these files again** — they are unchanged since Step 2 deploy

---

## 5. Build Verification — PRE-COMMIT CHECKLIST

**Run before committing:**

```bash
# 1. Type-check
npx tsc --noEmit
# Expected: 0 errors

# 2. Build Web
npm run build
# Expected: ✅ dist/ generated, no errors

# 3. Build Functions
cd functions && npm run build
# Expected: 0 errors, lib/ generated
cd ..

# 4. Verify no uncommitted changes (except docs + STATE.md)
git status
# Expected:
#   modified: .planning/STATE.md
#   new file: docs/SMOKE_TESTS_v1.3.md
#   new file: docs/SMOKE_TESTS_TEST_DATA_GUIDE.md
#   new file: docs/POST_DEPLOY_CHECKLIST_v1.3.md
#   new file: docs/SECURITY_SIGN_OFF_v1.3.md
#   new file: docs/COMPLIANCE_SUMMARY_v1.3.md
```

---

## 6. Commit Strategy

**Order matters — follow exactly:**

```bash
# Step A: Stage documentation files
git add docs/SMOKE_TESTS_v1.3.md \
        docs/SMOKE_TESTS_TEST_DATA_GUIDE.md \
        docs/POST_DEPLOY_CHECKLIST_v1.3.md \
        docs/SECURITY_SIGN_OFF_v1.3.md \
        docs/COMPLIANCE_SUMMARY_v1.3.md

# Step B: Stage project state
git add .planning/STATE.md

# Step C: Verify staging
git status
# Should show only the 6 files above as staged

# Step D: Create commit (use FINAL_COMMIT_MESSAGE.txt content)
git commit -m "v1.3: CAPA Closure + Compliance + SGD Migration — Production Deploy

## Summary
Deploy v1.3 completion: all 12 phases implemented, 27 v1.3 functions wired + deployed,
4 sign-off documents generated. DICQ compliance 71.3% → 78.5%. Production-ready.

... (full message from FINAL_COMMIT_MESSAGE.txt) ..."

# Step E: Verify commit created
git log --oneline -1
# Should show your new commit hash

# Step F: Push to main
git push origin main
# Expected: remote accepted, GitHub Actions triggered
```

---

## 7. Post-Commit Verification

After commit succeeds, check:

```bash
# 1. Commit is on main
git log main --oneline | head -1
# Should show your v1.3 commit

# 2. GitHub Actions CI/CD triggered
# Go to https://github.com/labcl/hc-quality/actions
# Look for "v1.3: CAPA Closure..." job running

# 3. Cloud Logs monitoring (Step 4)
# Execute smoke tests from docs/SMOKE_TESTS_v1.3.md
# Monitor https://console.cloud.google.com/logs for 24h
```

---

## 8. Rollback Point

If critical issues discovered before smoke tests complete:

```bash
# Get current commit hash
ROLLBACK_HASH=$(git rev-parse HEAD)
echo "v1.3 commit hash: $ROLLBACK_HASH"

# IF ROLLBACK NEEDED:
git revert HEAD --no-edit           # Creates undo commit (safe)
# OR
git reset --hard HEAD~1              # Hard undo (destructive, use with caution)
git push origin main --force
```

**When to rollback:**
- TypeScript errors post-merge (rare, but catch-all)
- Production outage (critical bug in v1.3 code)
- Firestore rules lock-out (failed ACL deployment)

**When NOT to rollback:**
- Smoke test failures (debug + fix + new commit)
- Minor UI/UX issues (hotfix commit)
- Documentation typos (update + new commit)

---

## 9. Timeline & Approvals

| Step | Owner | Timeline | Status |
|------|-------|----------|--------|
| Build verification | Engineer | Immediate | ⏳ Wait for smoke tests |
| Stage files | Engineer | ~2 min | ⏳ Wait for approval |
| Create commit | Engineer | ~1 min | ⏳ Wait for approval |
| Push to main | Engineer | ~10 sec | ⏳ Wait for approval |
| GitHub Actions CI | Automated | ~5-10 min | ⏳ Auto-triggered |
| Step 4 smoke tests | QA/Engineer | ~30 min | ⏳ User-executed |
| Cloud Logs monitoring | Ops/Engineer | 24h | ⏳ Ongoing |

**Final approval gate:** After Step 4 smoke tests PASS + 0 errors in Cloud Logs (24h tail)

---

## Files NOT Included

These files are reference-only and should NOT be staged:

```
❌ .planning/milestones/v1.3-DEPLOYMENT_LOG.md — Reference log only
❌ CLAUDE.md — No changes (reference in commit message only)
❌ docs/ROADMAP.md — No changes (reference only)
❌ docs/PERFORMANCE_PATTERNS.md — No changes (reference only)
❌ All module CLAUDE.md files — No changes (reference only)
```

---

## Summary: Final Commit Contents

```
Modified:   1 file  (.planning/STATE.md)
New files:  5 docs  (sign-off + test data)
Deleted:    0 files

Total additions: ~1,562 lines
Total deletions: 0 lines
```

**Estimated commit size:** ~120 KB (mostly markdown)  
**Expected merge time:** <5 sec (fast-forward)  
**Expected GitHub Actions runtime:** ~5-10 min (lint + build)

---

**Last Updated:** 2026-05-07 (post-deployment template)  
**Ready for execution by:** User (after Step 4 smoke tests pass)
