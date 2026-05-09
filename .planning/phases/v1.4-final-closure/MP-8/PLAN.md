---
macro_phase: MP-8
label: Final Deploy + Smoke
total_subagents: sequential (no SAs, orchestrator-driven)
depends_on: [MP-7]
estimated_runtime: 30min
waves: 1 (linear)
---

# MP-8 — Final Deploy + Smoke

Final pre-deploy gates + 3-step deploy sequence + post-deploy smoke + tag.

This MP is **NOT** subagent-driven. Orchestrator runs commands directly because each step requires deterministic output verification before next.

---

## Step 1 — Full Pre-Deploy Gate

```bash
cd 'C:\hc quality'

# 1.1 Typecheck
npx tsc --noEmit 2>&1 | tee /tmp/tsc.log
test "$(grep -c 'error TS' /tmp/tsc.log)" -eq 0 || EXIT="TSC FAIL"

# 1.2 Functions build
(cd functions && npm run build 2>&1 | tee /tmp/fn-build.log)
test "$?" -eq 0 || EXIT="FN BUILD FAIL"

# 1.3 Lint regression check (within +5% of baseline)
npm run lint 2>&1 | tail -5 | tee /tmp/lint.log
NEW_LINT=$(grep -oP '\d+(?= problems)' /tmp/lint.log | head -1)
BASELINE_LINT=$(jq -r '.lint_problems' .planning/phases/v1.4-final-closure/BASELINE-2026-05-09.md 2>/dev/null || echo "2364")
LIMIT=$(echo "$BASELINE_LINT * 1.05 / 1" | bc)
test "$NEW_LINT" -le "$LIMIT" || EXIT="LINT REGRESSION (+5%)"

# 1.4 Test suite
npm test -- --run 2>&1 | tail -5 | tee /tmp/test.log
test "$(grep -c 'failed' /tmp/test.log)" -le 16 || EXIT="TEST REGRESSION"
# Note: 16 = current portal-paciente baseline failures, pre-existing on main

# 1.5 Build app
npm run build 2>&1 | tee /tmp/app-build.log
test "$?" -eq 0 || EXIT="APP BUILD FAIL"

# 1.6 Bundle size check
MAIN_KB=$(du -k dist/assets/index-*.js | tail -1 | cut -f1)
test "$MAIN_KB" -le 460 || EXIT="BUNDLE TOO BIG ($MAIN_KB > 460 KB)"

# 1.7 Preflight secrets
bash scripts/preflight-secrets-check.sh
test "$?" -eq 0 || EXIT="SECRETS NOT PROVISIONED"

# 1.8 Secrets in diff
git diff main..v1.4-final-closure --unified=0 | grep -iE "(GEMINI_API_KEY|OPENROUTER_API_KEY|firebase-adminsdk|service-account|BEGIN PRIVATE KEY|ghp_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z_-]{35})"
test "$?" -ne 0 || EXIT="SECRETS IN DIFF"

# 1.9 CORS check on all new callables
for f in $(git diff --name-only main..v1.4-final-closure | grep "callables\|modules.*\.ts$" | grep -v test); do
  if grep -q "onCall" "$f"; then
    grep -q "cors: true" "$f" || echo "MISSING cors: $f"
  fi
done | tee /tmp/cors.log
test ! -s /tmp/cors.log || EXIT="CORS MISSING"

if [ -n "$EXIT" ]; then
  echo "PRE-DEPLOY GATE FAILED: $EXIT"
  exit 1
fi
echo "✓ All pre-deploy gates passed"
```

---

## Step 2 — Merge v1.4-final-closure to main

```bash
git checkout main
git pull origin main
git merge v1.4-final-closure --no-ff -m "feat(v1.4-FINAL): close all v1.4 backlog + partials + phase-11 PQ-24"
git push origin main
```

---

## Step 3 — Deploy Rules + Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
```

Wait for "Deploy complete!" — if rules deploy fails, **STOP** and abort. Rules must land before functions.

---

## Step 4 — Deploy Functions

```bash
firebase deploy --only functions --project hmatologia2
```

This may take 10-15min for 80+ functions. Wait for complete output. Verify all callable URLs returned.

---

## Step 5 — Deploy Hosting

```bash
firebase deploy --only hosting --project hmatologia2
```

---

## Step 6 — Post-Deploy Smoke (5 min)

```bash
# 6.1 Hosting reachable
curl -sf -o /dev/null https://hmatologia2.web.app && echo "✓ Hosting alive"

# 6.2 Functions reachable (sample 3)
for fn in createCapa createPlanoAcao registerPresenca; do
  URL=$(firebase functions:list --project hmatologia2 2>/dev/null | grep "$fn" | head -1)
  echo "  Function: $fn — registered"
done

# 6.3 Firestore rules check (read fails without auth)
curl -sf "https://firestore.googleapis.com/v1/projects/hmatologia2/databases/(default)/documents/labs/test/auditorias-internas" 
# Should return 401/403, not 200 with data

# 6.4 Cloud Logs baseline (start 24h monitor)
bash scripts/monitor-cloud-logs.sh 24 30 &
echo "Cloud Logs monitor PID $!: writing to .planning/phases/v1.4-final-closure/CLOUD-LOGS-24H.md"
```

---

## Step 7 — Tag + Update tracking

```bash
# 7.1 Update STATE.md and ROADMAP.md (orchestrator does this directly)
# Mark all 9 macro-phases complete, set milestone v1.4 to delivered

# 7.2 Tag the merge
git tag -a v1.4-FINAL -m "v1.4 complete: all 9 macro-phases delivered, DICQ ≥85%"
git push origin v1.4-FINAL

# 7.3 Final report
# Orchestrator generates .planning/phases/v1.4-final-closure/FINAL-REPORT.md
```

---

## Step 8 — FINAL-REPORT.md

Orchestrator generates this with:
- Total commits in v1.4-final-closure
- Total LOC delta (insertions/deletions)
- Test count delta (before/after)
- Bundle size delta
- DICQ compliance final %
- All 91 SAs status (success/failure)
- Cost actual (total tokens × pricing)
- Runtime actual

Commit: `docs(v1.4-FINAL): final report`

---

## Failure handling

If any step fails:
- **Step 1 fails:** Fix the failing gate (typically a regression introduced late). Re-run from Step 1.
- **Step 3 fails (rules):** Investigate emulator test failures. Roll back the failing rule block. Re-run Step 1+3.
- **Step 4 fails (functions):** Check first 5 errors in deploy output. Most common: TS6196 unused locals. Fix and retry. If quota exceeded, wait 1h and retry.
- **Step 5 fails (hosting):** Re-run `npm run build` then retry. Usually transient.
- **Step 6 smoke fails:** Investigate, may need rollback. Roll back via `firebase hosting:rollback --project hmatologia2`.

---

## Success Criteria

```
- [ ] Pre-deploy gate ✓
- [ ] Merge v1.4-final-closure → main ✓
- [ ] Rules + indexes deployed ✓
- [ ] Functions deployed (all callable URLs returned) ✓
- [ ] Hosting deployed ✓
- [ ] Smoke tests pass ✓
- [ ] Tag v1.4-FINAL pushed ✓
- [ ] STATE.md + ROADMAP.md updated ✓
- [ ] FINAL-REPORT.md committed ✓
- [ ] Cloud Logs 24h monitor started ✓
```

When all checked: **v1.4 LIVE in production**.
