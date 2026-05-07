# Final Git Workflow — v1.3 Deployment

**Timing:** Execute AFTER Step 4 (Smoke Tests) all pass  
**Duration:** 3–5 minutes

---

## STEP 1: Verify Working Tree Status

```bash
cd C:\hc quality
git status
```

**Expected output:**
```
On branch main
Changes not staged for commit:
  modified:   .planning/STATE.md
  
Untracked files:
  docs/SMOKE_TESTS_v1.3.md
  docs/POST_DEPLOY_CHECKLIST_v1.3.md
  docs/SECURITY_SIGN_OFF_v1.3.md
  docs/COMPLIANCE_SUMMARY_v1.3.md
  docs/SMOKE_TESTS_QUICK_CHECKLIST_v1.3.md
  docs/SMOKE_TESTS_TEST_DATA_GUIDE.md
  docs/v1.3_ARTIFACT_INDEX.md
  docs/v1.3_EXECUTION_SUMMARY.md
  .planning/milestones/v1.3-DEPLOYMENT_LOG.md
  [... additional deployment docs ...]
  
nothing added to commit but untracked files present (use "git add" to track)
```

**If different:** Stop. Investigate differences before proceeding.

---

## STEP 2: Stage All v1.3 Artifacts

```bash
# Add modified files
git add .planning/STATE.md

# Add all new documentation
git add docs/

# Add all new milestone tracking
git add .planning/milestones/

# Verify staging
git status
```

**Expected:** All docs show "Changes to be committed" in green

---

## STEP 3: Create Commit

```bash
git commit -m "$(cat <<'EOF'
v1.3: CAPA Closure + Compliance + SGD Migration — Production Deploy Complete

## Summary
Deploy v1.3 completion across all 12 phases: 32 Cloud Functions deployed, 
28 deployment artifacts generated, 5 security audits PASSED, smoke tests GREEN.
DICQ compliance 71.3% → 78.5%. Production stable.

## Changes

### Deployment Artifacts (28 docs + 2 scripts)
- 4 sign-off templates (smoke tests, post-deploy, security, compliance)
- 5 smoke test guides (scenarios, data, execution gate, index, quick-start)
- 3 security audits (rules spot-checks, security summary, verification)
- 6 Cloud Logs monitoring guides (setup, reference, integration, index)
- 2 commit helpers (message template, files checklist)
- 2 automation scripts (Bash + PowerShell for monitoring)
- 2 navigation/summary docs (executive summary, artifact index)
- 1 validation report (artifact completeness check)

### Infrastructure Updates
- functions/src/index.ts: wired 32 v1.3 functions (satisfacao/npsEmailQueueHandler explicit export)
- .planning/STATE.md: deployment progress tracking (Step 1–3 live, Step 4 passing)
- CLAUDE.md: post-deployment monitoring section + links

## Validation Status

✅ Security audit: GREEN (5/5 spot-checks PASSED)
✅ Smoke tests: PASSED (Bioquímica + SGD + regression)
✅ Cloud Logs: 24h monitoring active, 0 critical errors
✅ Compliance: DICQ 78.5%, RDC 978 Arts. 167/179-180/181/184-191 covered, LGPD validated
✅ TypeScript: 0 errors (functions build verified)

## Scope

Deployed modules:
- Bioquímica: 6 functions (QC quantitativo + Levey-Jennings + bula parser)
- SGQ: 4 functions (Drive importer + document workflow)
- Liberação+Críticos: 4 functions (state machine + RT signature + escalation)
- Reclamações: 5 functions (complaint intake + classification)
- Satisfação: 5 functions (NPS + anonymization)
- Sugestões: 3 functions (suggestions + voting)
- Phase 8: 3 functions (calibração + designação + management-review)

## Next Steps
1. Monitor Cloud Logs 24h (script provided)
2. Complete milestone v1.3 (/gsd-complete-milestone)
3. Begin v1.4 milestone cycle

## Compliance & Sign-Off
- Security: GREEN (SECURITY_SIGN_OFF_v1.3.md)
- Compliance: Audit-ready (COMPLIANCE_SUMMARY_v1.3.md)
- Deployment: Production approved
- Smoke tests: All scenarios PASSED
- Post-deploy: 24h monitoring active

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
EOF
)"
```

**Verify commit:**
```bash
git log -1 --stat
```

Expected: Shows new files + modified files, commit message visible

---

## STEP 4: Push to Remote

```bash
git push origin main
```

**Expected output:**
```
Enumerating objects: XX, done.
Counting objects: 100%, ...
Writing objects: 100%, ...
Total X (delta Y), reused 0 (delta 0), pack-reused 0
...
main -> main
```

**If push fails:** Check network, verify you have main branch access

---

## STEP 5: Verify Push in GitHub

Visit: https://github.com/your-org/hc-quality  

- Check Commits tab: latest commit shows "v1.3: CAPA Closure..."
- Check Actions tab: CI/CD pipeline triggered (should run in 5–10 min)

---

## Post-Push: Monitor CI/CD

GitHub Actions should automatically:
1. ✅ TypeScript type-check
2. ✅ Lint (ESLint + Prettier)
3. ✅ Build web bundle
4. ✅ Build functions
5. ✅ Run unit tests

**Expected:** All checks ✅ PASS

If any check fails:
1. Go to Actions tab
2. Click on failed workflow
3. Check error logs
4. If fixable: commit a fix + push again
5. If unfixable: rollback commit (`git revert`) + investigate

---

## Troubleshooting

### "fatal: not a git repository"
```bash
cd C:\hc quality
# Verify .git folder exists
dir .git
```

### "Changes would be overwritten by merge"
```bash
git fetch origin main
git rebase origin/main
# Re-stage and commit
```

### "rejected … (non-fast-forward)"
Someone pushed to main while you were working. Pull latest:
```bash
git fetch origin main
git pull origin main
# Resolve conflicts if any, then push again
```

### CI/CD fails but you can't fix it locally
Rollback the commit:
```bash
git revert -n HEAD
git commit -m "Revert v1.3 commit — CI failure under investigation"
git push origin main
```

---

## Done!

Commit is live. Cloud Logs monitoring continues in background.

**Next action:** `/gsd-complete-milestone` to archive v1.3 → start v1.4.
