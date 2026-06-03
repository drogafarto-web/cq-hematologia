# Deployment Quick Reference — Phase 3

> **Print this + bookmark.** Last updated: 2026-05-07

---

## Pre-Merge Checklist (For Code Authors)

```
Before opening PR:
  [ ] npm run typecheck (0 errors)
  [ ] npm run lint (clean or <88 warnings)
  [ ] npm run test:unit (all passing)
  [ ] npm run test:coverage (≥80% statements)
  [ ] npm run build (no errors)
  [ ] If functions changed: cd functions && npm run build
  [ ] If functions changed: bash scripts/preflight-secrets-check.sh
  [ ] git push

After PR opens:
  [ ] GitHub Status Checks: All green
  [ ] 1 approval from reviewer
  [ ] Conversations resolved

Merge to main:
  [ ] Click "Merge" (auto-triggers Phase 3 workflow)
  [ ] Watch Actions tab (Rules + Functions auto-deploy)
  [ ] Wait for smoke tests + Cloud Logs check (20 min)
```

---

## Manual Deploy (Full Cycle)

**Use only if:** Auto-trigger failed or you need selective deployment  
**Project**: `hmatologia2`

### Step 1: Pre-Deploy (Local)

```bash
cd /c/hc\ quality

npm run typecheck                   # Must be 0 errors
npm run lint                         # Review warnings (baseline: 88)
npm run test:unit                    # Must all pass
npm run build                        # Must succeed
cd functions && npm run build && cd ..

# If functions changed:
bash scripts/preflight-secrets-check.sh   # Must exit 0
```

**If any step fails**: Fix and repeat from start. Do not proceed.

### Step 2: Deploy via GitHub Actions (Recommended)

**Option A: Auto (merge to main)**

- Code merged → Actions tab auto-starts Phase 3 workflow
- Wait ~20 min for completion

**Option B: Manual dispatch**

1. GitHub → `Actions` tab
2. Find `Phase 3 Deploy` workflow
3. Click `Run workflow` button
4. Select:
   - `deploy_stage`: `all` (or specific: `rules`, `functions`, `hosting`)
   - `skip_smoke_tests`: `false` (keep enabled)
   - `skip_monitoring`: `false` (keep enabled)
5. Click `Run`
6. Watch live progress

### Step 3: Post-Deploy (Monitor)

```
Watch GitHub Actions:
  [ ] Pre-Deploy Gate: ✅ Passed
  [ ] Deploy Rules: ✅ Passed (if changed)
  [ ] Deploy Functions: ✅ Passed (if changed)
  [ ] Deploy Hosting: ✅ Passed (or ⊘ Skipped)
  [ ] Smoke Tests: ✅ Passed
  [ ] Cloud Logs (1h): ✅ No errors
```

**Live URL**: https://hmatologia2.web.app

### Step 4: Verify in Browser

```
On desktop (after deploy completes):
  [ ] Hard reload: Ctrl+Shift+R (or Cmd+Shift+R)
  [ ] Check Console (F12): No errors
  [ ] Test main flow (login → CIQ → export)
  [ ] Check mobile (iPad/phone): Responsive OK
```

---

## Deploy Rollback (Emergency Only)

**Trigger**: Deploy caused visible errors OR Cloud Logs critical spike

### Option 1: Revert Code + Redeploy

```bash
# Identify last good commit
git log --oneline | head -5

# Revert recent commits
git revert HEAD~1     # (or HEAD~2, etc. for multiple)
git push

# GitHub Actions auto-triggers deploy with reverted code
# Watch Actions tab for completion
```

### Option 2: Manual Rollback (No Time to Code Review)

```bash
# Firestore Rules
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules --project hmatologia2 --token $FIREBASE_TOKEN

# Cloud Functions
git checkout HEAD~1 functions/
cd functions && npm run build && cd ..
firebase deploy --only functions --project hmatologia2 --token $FIREBASE_TOKEN

# Hosting
git checkout HEAD~1 -- src/
npm run build
firebase deploy --only hosting --project hmatologia2 --token $FIREBASE_TOKEN
```

**Note**: Manual deploys bypass some gates — only use in incident.

---

## Merge Protection Gates (Can't Bypass)

These block PR merge on GitHub:

| Gate              | Threshold                  | How to Fix                          |
| ----------------- | -------------------------- | ----------------------------------- |
| `pre-deploy-gate` | All 6 checks pass          | Fix errors in console, commit, push |
| `web (Node 22)`   | ESLint + typecheck + tests | Same as above                       |
| `functions`       | Build succeeds             | `cd functions && npm run build`     |
| Coverage ≥80%     | Statements covered         | Add tests for gaps                  |
| Bundle <420 KB    | Gzip size limit            | Lazy-load large deps, split routes  |

**If stuck**:

1. Check Actions tab → failed job
2. Click job name → scroll to failed step
3. Read error message
4. Fix locally + commit + push

---

## Secrets Management (Functions Only)

**Issue**: `HCQ_SIGNATURE_HMAC_KEY` or other secrets missing

**Check status** (pre-deploy):

```bash
bash scripts/preflight-secrets-check.sh
```

**Fix missing secret**:

```bash
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2
# Paste value when prompted
# (Value = 64-char hex from Firebase Console → Settings)
```

**Retry deploy** (workflow auto-detects next time):

```bash
git commit -am "fix: provision missing secrets"
git push
```

---

## Monitoring & Debugging

### Cloud Logs (Post-Deploy, 1h Monitoring)

**Auto runs** after hosting deploy. Check artifact: `post-deploy-logs-<sha>`

**Manual check**:

```bash
# Last 50 errors in past 1h
gcloud logging read \
  'severity=ERROR AND timestamp>="2026-05-07T12:00:00Z"' \
  --project hmatologia2 \
  --limit 50
```

### Service Worker (Hosting Caching Issue)

**Symptom**: Old code still showing after deploy

**Fix**:

```
Browser: Ctrl+Shift+R (hard reload)
Note: Changes require hard reload — SW is sticky by design
```

### Function Invocation Latency (Spike?)

**Check** (Firebase Console):

1. https://console.firebase.google.com/project/hmatologia2/functions
2. Click function name
3. View "Invocations" + "Latency" tabs
4. Check if spike correlates with deploy time

**Hypothesis**: If latency normal → likely not deploy issue

---

## Incident Response

**Checklist if deploy causes production error**:

```
1. Identify error:
   [ ] Cloud Logs show error spike?
   [ ] User report specific path failing?
   [ ] Automated alert triggered?

2. Scope impact:
   [ ] Is it affecting all users or subset (specific feature)?
   [ ] Can users work around?
   [ ] Is data integrity at risk?

3. Severity:
   [ ] P1 (data loss, security, widespread) → Rollback immediately
   [ ] P2 (feature broken, partial users) → Root cause < 2 min
   [ ] P3 (cosmetic, single user) → Fix in next deploy

4. Actions:
   [ ] P1: Execute rollback (see section above)
   [ ] P2: If fix clear, fix + redeploy. Else rollback.
   [ ] P3: Create issue, prioritize next day

5. Post-incident:
   [ ] Review logs: What failed?
   [ ] Why didn't tests catch it?
   [ ] Update pre-deploy gates?
   [ ] Root cause doc
```

---

## Key Commands (Copy-Paste)

```bash
# Validate locally (pre-commit)
npm run typecheck && npm run lint && npm run test:unit && npm run build

# Deploy manually (if workflow fails)
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2 --token $FIREBASE_TOKEN
firebase deploy --only functions --project hmatologia2 --token $FIREBASE_TOKEN
firebase deploy --only hosting --project hmatologia2 --token $FIREBASE_TOKEN

# Monitor live logs
gcloud logging read --project hmatologia2 --limit 50 --follow

# Check Cloud Logs for errors (past 24h)
gcloud logging read \
  'severity>=ERROR AND timestamp>"2026-05-06T12:00:00Z"' \
  --project hmatologia2 \
  --limit 100 \
  --format json | jq '.[] | "\(.timestamp) \(.severity) \(.jsonPayload.message)"'

# Provision missing secret
firebase functions:secrets:set SECRET_NAME --project hmatologia2
```

---

## Slack Notification Template

**For #deployments channel** (if using Slack integration):

```
🚀 Phase 3 Deploy Started
├─ Commit: <link>
├─ Stage: [rules | functions | hosting | all]
├─ Triggered: [auto | manual]
└─ ETA: 20 min

[After 20 min]

✅ Phase 3 Deploy Complete
├─ Rules: ✅
├─ Functions: ✅
├─ Hosting: ✅
├─ Smoke Tests: ✅
├─ Cloud Logs: ✅ (no errors)
└─ Live: https://hmatologia2.web.app
```

---

## Support / Escalation

| Issue                                        | Who              | Action                                |
| -------------------------------------------- | ---------------- | ------------------------------------- |
| PR won't merge (gates failing)               | Code author      | Check Actions tab, fix + commit       |
| Secrets missing                              | Ops / Infra      | `firebase functions:secrets:set`      |
| Deploy succeeded but errors post-deploy      | On-call engineer | Review Cloud Logs → decide rollback   |
| Workflow infrastructure issue (Actions down) | Platform team    | Check GitHub status + rerun           |
| Lost ability to deploy                       | Infra lead       | Check FIREBASE_TOKEN secret in GitHub |

---

## Compliance Notes (RDC 978 / DICQ)

**Deployment audit trail** required for:

- RDC 978 Art. 5.3 (Audit Trail)
- DICQ 4.4 (Documentation System)

**Records kept**:

- GitHub Actions logs (90 days)
- Firebase Hosting (varies by plan)
- Cloud Logs (30 days by default)

**Export for audit**:

```bash
# Download artifact from GitHub Actions
# Or: gcloud logging read ... --format json > audit_export.json
```

---

## Checklists (Print-Friendly)

### Deploy Day Morning

- [ ] Check status page (GitHub, Google Cloud)
- [ ] Verify FIREBASE_TOKEN is valid
- [ ] Scan Slack #incidents — any ongoing issues?
- [ ] Read last 3 deployments in Actions tab

### Pre-Merge

- [ ] `npm run typecheck` passes
- [ ] `npm run test:unit` passes (≥80% coverage)
- [ ] PR has 1 approval
- [ ] GitHub status checks all green
- [ ] No unresolved conversations

### Post-Deploy

- [ ] Actions: All jobs ✅
- [ ] Hard reload browser: Ctrl+Shift+R
- [ ] Test main flow (login → CIQ → export)
- [ ] Check Cloud Logs: No error spike
- [ ] Notify team in Slack

---

**Last Updated**: 2026-05-07  
**Workflow**: `.github/workflows/phase-3-deploy.yml`  
**Guide**: `docs/PHASE_3_DEPLOY_WORKFLOW.md`  
**Protocol**: `docs/DEPLOY_PROTOCOL.md`
