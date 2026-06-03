# Deployment CI/CD Notes

**Project:** HC Quality (hmatologia2)  
**Last updated:** 2026-05-08  
**Audience:** DevOps, engineers deploying to production

---

## Build & Type-Check Pipeline

### Step 1: Type-Check (Local & CI)

```bash
npx tsc --noEmit
```

**Expected output:** 2 pre-existing errors (expected, not blockers)

```
src/index.ts(222,3): error TS2305: Module '"./modules/labApoio"' has no exported member 'labApoio_generateContractTemplate'.
src/modules/ocr-quality/types.ts(15,15): error TS2305: Module '"../../shared/signature"' has no exported member 'LogicalSignature'.
```

**What is excluded from tsc:**

- `src/**/*.test.ts` / `src/**/*.test.tsx` — test files
- `src/__tests__/**` — test directories
- `src/modules/notivisa/**` — **Legacy NOTIVISA code (149 TS errors, temporary exclusion, Phase 6 deletion planned)**
- `src/modules/ia-strip/**` — pre-existing exclusion
- `src/modules/portals/**` — pre-existing exclusion
- `src/modules/personnel/**` — pre-existing exclusion

**If tsc reports NEW errors (not labApoio or ocr-quality):**

1. Check if notivisa exclusion was removed (see below)
2. Run `git diff functions/tsconfig.json` to confirm no accidental deletions
3. If notivisa exclusion is missing, update `functions/tsconfig.json` before merging

### Step 2: Build (Web & Functions)

**Web:**

```bash
npm run build
```

**Functions:**

```bash
cd functions && npm run build
```

**Expected:** Both succeed. Functions build excludes notivisa (handled by tsconfig exclusion).

### Step 3: Pre-Deploy Secret Status Check

**Mandatory before any `firebase deploy --only functions`:**

```bash
bash scripts/preflight-secrets-check.sh
```

**Expected output:**

- `Exit code 0`: All secrets provisioned, safe to deploy
- `Exit code 1`: At least one secret not set. Output lists:
  ```
  ❌ NOTIVISA_AUTH_KEY — not provisioned
  Run: firebase functions:secrets:set NOTIVISA_AUTH_KEY --project hmatologia2
  ```

**Important:** Do NOT force-deploy with unset secrets. Follow the listed commands to set them, then re-run the check.

**Emergency override** (incident only):

```bash
bash scripts/preflight-secrets-check.sh --allow-pending-secrets
```

Log the override, deploy, and review in 24h. See ADR-0017 for context (2026-05-07 HMAC incident).

---

## notivisa Exclusion Lifecycle

### Current (Phase 3–5)

**tsconfig.json snippet:**

```json
"exclude": [
  "src/modules/notivisa/**",  // Legacy NOTIVISA: 149 TS errors, Phase 6 delete planned
  ...
]
```

- `npx tsc --noEmit` — clean (notivisa excluded)
- `npm run build` — clean (notivisa not compiled)
- Feature flag `NOTIVISA_USE_WAVE2` routes traffic to Wave 2-10 callables
- Legacy code remains deployed but unused

### Phase 6 Transition (2026-07)

When legacy code is deleted:

1. Remove `"src/modules/notivisa/**"` from tsconfig exclude array
2. Run `npx tsc --noEmit` — must still be clean (notivisa deleted, not just excluded)
3. Run `npm run build` — must succeed
4. Deploy Cloud Functions

If tsc still reports errors after notivisa deletion, investigate: other modules may need cleanup (escalate to architecture team).

### Rollback (if Phase 6 delete causes issues)

1. **Immediate (within 2h):** `git revert <delete-commit>`
2. **Restore tsconfig:** Re-add `"src/modules/notivisa/**"` to exclude
3. **Verify:** `npx tsc --noEmit` (notivisa errors reappear, expected)
4. **Document:** Create `docs/NOTIVISA_DELETE_BLOCKER_2026-07.md` with root cause

---

## CI/CD Gating Checklist

### Pre-Merge (to main)

- [ ] `npx tsc --noEmit` passes locally
- [ ] `npm run build` passes locally (web)
- [ ] `npm run build` passes in functions/
- [ ] No new TS errors introduced (only labApoio + ocr-quality expected)
- [ ] Tests pass: `npm test` (or test suite in CI)
- [ ] No breaking changes to Firestore schema (if applicable)

### Pre-Deploy (to production)

- [ ] Pre-merge checklist passed + merged to main
- [ ] `bash scripts/preflight-secrets-check.sh` exits with code 0
- [ ] Firestore rules updated (if any): `firebase deploy --only firestore:rules`
- [ ] Firestore indexes deployed (if new): `firebase deploy --only firestore:indexes`
- [ ] Cloud Functions deployed: `firebase deploy --only functions`
- [ ] Hosting deployed: `firebase deploy --only hosting`
- [ ] Hard-refresh browser (Ctrl+Shift+R) to load new SW
- [ ] Smoke test: critical user flows (1 rundown, 1 e2e test path minimum)
- [ ] 24h Cloud Logs monitoring (see `CLOUD_LOGS_MONITORING_GUIDE.md`)

### Post-Deploy (sign-off within 2h)

- [ ] No critical errors in Cloud Logs
- [ ] No RPC failures in Firestore
- [ ] No auth timeouts or "internal" errors
- [ ] Spot-check: create 1 new record, export 1 report, run 1 query

---

## Deploy Command Sequence

### 1. Validate locally (always first)

```bash
cd C:\hc quality
npx tsc --noEmit
npm run build
```

### 2. Secret check (mandatory for functions deploy)

```bash
bash scripts/preflight-secrets-check.sh
```

### 3. Deploy sequence (rules → indexes → functions → hosting)

```bash
# Rules + Indexes
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# Functions (if new code)
firebase deploy --only functions --project hmatologia2

# Hosting (if web changes)
firebase deploy --only hosting --project hmatologia2
```

**Important:** Never chain with `&&` without explicit ack between steps. Each deploy is a separate decision point.

### 4. Monitor (24h minimum)

```bash
bash scripts/monitor-cloud-logs.sh 24 30   # (macOS/Linux)
# or
.\scripts\monitor-cloud-logs.ps1 -hours 24 -interval 30  # (Windows)
```

See `CLOUD_LOGS_MONITORING_GUIDE.md` for analysis + sign-off template.

---

## Known Issues & Workarounds

### Issue: notivisa tsc errors reappear

**Symptom:** `npx tsc --noEmit` reports 149 errors after merge/pull.

**Cause:** tsconfig.json notivisa exclusion was accidentally removed or reverted.

**Fix:**

```bash
git diff functions/tsconfig.json
# If notivisa exclude line is missing, restore it:
# "src/modules/notivisa/**" must be in the exclude array
```

**Prevention:** CI should validate tsconfig.json before merge (add linting rule if needed).

---

### Issue: Build fails with "missing package.json dep"

**Symptom:** `npm run build` fails with `Cannot find module 'xyz'`.

**Cause:** Functions package.json missing a peer dep (cascade-kills all 78 functions).

**Fix:**

```bash
cd functions
npm install <missing-package>
npm ci  # clean install to verify
```

**Prevention:** Pre-deploy script should run `npm ci` to catch untracked deps (see `scripts/preflight-*.sh`).

---

### Issue: "internal" error calling Cloud Function

**Symptom:** Web client receives `{code: 'internal', message: 'Internal'}` from callable.

**Cause:** Either:

1. Function failed to deploy (code old/broken on server)
2. Secret not provisioned (HMAC key missing, auth fails)
3. Firestore rules blocked the operation
4. Unhandled exception in function code

**Debug:**

```bash
# Check Cloud Logs (Filter by function name + timestamp)
firebase functions:log --only <function-name> --project hmatologia2

# Check secret status
bash scripts/preflight-secrets-check.sh

# Check Firestore rules (emulator first)
firebase emulators:start --only firestore
# Test read/write in web console
```

---

## Monitoring & Alerts

### Cloud Logs Setup (Post-Deploy, 2026-05-07+)

See `docs/CLOUD_LOGS_MONITORING_GUIDE.md` for full setup.

Quick reference:

```bash
# Watch for errors in real-time (24h)
bash scripts/monitor-cloud-logs.sh 24 30
```

### Red Flags (Escalate immediately)

- [ ] `ERROR: Function not found` (deployment failed)
- [ ] `invalid HMAC signature` (secret not set, see ADR-0017)
- [ ] `permission denied` (Firestore rules issue)
- [ ] `quota exceeded` (rate limiting, check usage)
- [ ] Any unhandled exception in function code (check logs + fix + redeploy)

---

## Version & Deprecation Timeline

| Node Version | Released | Deprecated | Status                       |
| ------------ | -------- | ---------- | ---------------------------- |
| Node 20      | 2023-04  | 2026-10-30 | Deployed; migrating to 22    |
| Node 22      | 2024-04  | TBD        | Current (southamerica-east1) |

**Action:** No action needed until Node 20 deprecation (Oct 2026). Cloud Functions auto-upgrade before cutoff.

---

## Additional Resources

- **Deploy protocol:** `.claude/rules/deploy-protocol.md`
- **Pre-flight checks:** `scripts/preflight-secrets-check.sh`
- **Monitoring:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md` + `CLOUD_LOGS_QUICK_REFERENCE.md`
- **Secret management:** `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` + `ADR-0018-deploy-gate-secret-status-check.md`
- **notivisa cleanup:** `docs/NOTIVISA_TSCONFIG_CLEANUP_ROADMAP.md`
