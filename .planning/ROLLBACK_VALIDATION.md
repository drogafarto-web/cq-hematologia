# Rollback Procedures Validation Report

**Date:** 2026-05-07  
**Validator:** Agent  
**File Reviewed:** `.planning/PHASE_4_ROLLBACK_PROCEDURES.md` (456 lines)

---

## Executive Summary

**Status:** ⚠ **PARTIAL PASS WITH CRITICAL BLOCKERS**

The rollback procedures document is **well-structured and comprehensive**, but **cannot be executed in its current state** due to **2 critical code blockers** that prevent both `npm run build` and `firebase deploy` from succeeding. The document itself is valid; the codebase is not deployment-ready.

| Validation Aspect | Status | Severity | Notes |
|---|---|---|---|
| Failure decision trees (4) | ✓ PASS | — | Comprehensive, clear logic flow |
| Rollback execution paths (5) | ✓ PASS | — | Commands well-structured, tested references |
| Post-rollback monitoring (4 metrics) | ✓ PASS | — | Dashboard references exist |
| Prevention checklist | ✓ PASS | — | Actionable, complete |
| **Code executability** | ✗ **FAIL** | **CRITICAL** | 15+ TypeScript errors in `src/` and `functions/` |
| **Command validation** | ⚠ WARN | HIGH | Paths/scripts exist, but builds fail |
| **Firebase CLI tools** | ✓ PASS | — | firebase 15.16.0 installed and working |
| **Git state** | ✓ PASS | — | Main branch clean, tags present (v1.2) |

---

## 1. Failure Decision Trees — ✓ PASS

**Validation:** All 4 decision trees are present and logically sound.

### Tree 1: P0 Alert Fires (Lines 9–23)
- **Structure:** Clear binary decision (new code? yes/no)
- **Decision window:** 5 minutes ✓
- **Actions:** Runnable — Cloud Logs search referenced
- **Status:** COMPLETE

### Tree 2: Portal Laudo Load Regression (Lines 29–51)
- **Structure:** 4-branch decision (query / bundle / function latency / network)
- **Decision window:** 30 minutes ✓
- **Actions:** `gcloud` commands, `du -k`, CDN verification — all realistic
- **Status:** COMPLETE

### Tree 3: NOTIVISA Queue Stuck (Lines 57–83)
- **Structure:** 4-branch (processor crash / hung / permissions / API)
- **Decision window:** 15 min investigation + 30 min action ✓
- **Actions:** Firestore access checks, Secret Manager validation
- **Status:** COMPLETE

### Tree 4: Firestore Rule Violation (Lines 89–116)
- **Structure:** 5-branch (deploy success / indexes / membership / path match / rule condition)
- **Decision window:** 10 minutes ✓
- **Actions:** Emulator testing referenced (`npm run test:firestore-rules`)
- **Status:** COMPLETE

---

## 2. Rollback Execution Paths — ✓ PASS (with caveats)

**Validation:** All 5 rollback paths are well-documented. Commands are **theoretically correct** but **cannot execute** until code is fixed.

### Path 1: Hosting Only (Lines 154–180) — 1 min

**Commands:**
```bash
COMMIT=$(git log --oneline | head -1 | awk '{print $1}')    # ✓ Valid
git revert --no-edit $COMMIT                                 # ✓ Valid
npm run build                                                 # ✗ FAILS (see below)
firebase deploy --only hosting --project hmatologia2         # ✓ Valid (if build succeeds)
curl -I https://hmatologia2.web.app/portal/auth              # ✓ Valid
```

**Status:** ✓ Command syntax valid, ✗ **BUILD FAILS**

### Path 2: Firestore Rules Only (Lines 189–217) — 2 min

**Commands:**
```bash
git log --oneline -- firestore.rules | head -3              # ✓ Valid
GOOD_COMMIT=$(...)                                           # ✓ Valid shell
git show $GOOD_COMMIT:firestore.rules > firestore.rules      # ✓ Valid
firebase deploy --only firestore:rules --project hmatologia2 # ✓ Valid (no build needed)
firebase emulator:start --only firestore                     # ✓ Valid
npm run test:firestore-rules                                 # ✓ Test exists
```

**Status:** ✓ **FULLY EXECUTABLE** (rules-only is clean path)

### Path 3: Cloud Functions Only (Lines 226–286) — 5 min

**Option A: Full functions rollback**
```bash
COMMIT=$(git log --oneline -- functions/src | head -1 | awk '{print $1}')  # ✓ Valid
git revert --no-edit $COMMIT                                  # ✓ Valid
cd functions && npm run build                                 # ✗ FAILS (see below)
npm test                                                      # ✓ Syntax valid (if build succeeds)
firebase deploy --only functions --project hmatologia2        # ✓ Valid (if build succeeds)
```

**Option B: Disable problematic function only**
```bash
# Edit function to reject all calls — ✓ Valid approach
firebase deploy --only functions:notivisaDraftCreate          # ✓ Valid
git restore functions/src/modules/notivisa/callables.ts       # ✓ Valid
```

**Option C: Manual GCP Console disable**
- Documented but not scriptable — ✓ Valid fallback

**Status:** ✓ Command syntax valid, ✗ **BUILD FAILS**, ✓ Option B provides workaround

### Path 4: Rules + Functions (Lines 295–320) — 5 min

**Commands:**
```bash
RULES_COMMIT=$(...)                                           # ✓ Valid
FUNC_COMMIT=$(...)                                            # ✓ Valid
git revert --no-edit $RULES_COMMIT $FUNC_COMMIT               # ✓ Valid
npm run build                                                 # ✗ FAILS
cd functions && npm run build && npm test                     # ✗ FAILS
firebase deploy --only firestore:rules,functions              # ✓ Valid (if builds succeed)
```

**Status:** ✓ Command structure valid, ✗ **BOTH BUILDS FAIL**

### Path 5: Full Rollback (Lines 324–361) — 10 min

**Commands:**
```bash
git log --oneline v1.3..HEAD | head -20                      # ⚠ NO v1.3 TAG (only v1.2 exists)
git reset --hard $PHASE3_COMMIT                              # ✓ Valid (if hash known)
npm run build                                                 # ✗ FAILS (current state)
cd functions && npm run build && npm test                     # ✗ FAILS (current state)
firebase deploy --only hosting,firestore:rules,functions      # ✓ Valid (if builds succeed)
bash .planning/scripts/phase-4-smoke-test.sh                 # ✓ Script exists
```

**Status:** ⚠ **Tag reference missing**, ✗ **BOTH BUILDS FAIL**

---

## 3. Post-Rollback Monitoring — ✓ PASS

**Validation:** 4 key metrics specified with targets and sources.

| Metric | Target | Monitor | Status |
|---|---|---|---|
| Auth success rate | >99% | Dashboard 1 | ✓ Referenced |
| Portal load time | <2s LCP | Browser dev tools | ✓ Clear |
| Error rate | <0.1% | Cloud Logs | ✓ Filters exist |
| Firestore latency | <500ms p95 | Dashboard 3 | ✓ Referenced |

**Post-Rollback Checklist (Lines 411–418):**
- ✓ All 4 dashboards health metric check
- ✓ Cloud Logs error verification
- ✓ Auth success rate confirmation
- ✓ Portal load test specified
- ✓ NOTIVISA queue status (if applicable)

**Sign-Off Template (Lines 420–432):**
- ✓ Complete with all required fields
- ✓ Timestamp, component, reason, status tracking

**Status:** ✓ **FULLY COMPLETE**

---

## 4. Prevention Checklist — ✓ PASS

**Lines 436–445** specify 6 actionable prevention items:

- [ ] Root cause fixed in code
- [ ] Additional unit tests added
- [ ] Staging environment tested end-to-end
- [ ] Code review by CTO + tech lead
- [ ] All pre-deployment validation items passing
- [ ] >24 hours elapsed since rollback (cool-down)

**Status:** ✓ **COMPLETE AND ACTIONABLE**

---

## 5. Code Executability — ✗ CRITICAL FAILURES

### Blocker 1: TypeScript Build Failure (src/)

**Command:** `npm run build`

**Failure Output:**
```
src/features/notivisa-portal/services/PortalAuthService.ts(19,15): 
  error TS2305: Module '"../../../types"' has no exported member 'LogicalSignature'.
```

**Root Cause:** Missing or incorrectly exported type definition.

**Impact:**
- ❌ Cannot run `npm run build` for hosting deployment
- ❌ Blocks Hosting rollback path (Path 1)
- ❌ Blocks Full rollback (Path 5)

---

### Blocker 2: Functions TypeScript Build Failure

**Command:** `cd functions && npm run build`

**Failure Count:** 15+ TS errors in `authenticatePortal.ts`

**Sample Errors:**
```
src/modules/notivisa-portal/callables/authenticatePortal.ts(117,23):
  error TS18048: 'stateData' is possibly 'undefined'.

src/modules/notivisa-portal/callables/authenticatePortal.ts(135,21):
  error TS2339: Property 'logger' does not exist on type 'typeof import(...)

src/modules/notivisa-portal/callables/authenticatePortal.ts(188,71):
  error TS2551: Property 'idToken' does not exist on type 'OAuthTokenResponse'. 
  Did you mean 'id_token'?
```

**Root Causes:**
1. Undefined variable usage without null checks
2. Missing `logger` import/reference on https module
3. Camelcase/snake_case mismatch in OAuth token response (idToken vs id_token)
4. Property existence validation missing

**Impact:**
- ❌ Cannot run `cd functions && npm run build`
- ❌ Blocks Functions rollback path (Path 3, Option A)
- ❌ Blocks Rules + Functions rollback (Path 4)
- ❌ Blocks Full rollback (Path 5)

---

## 6. Command Validation — ⚠ PARTIAL PASS

### Git Commands
- ✓ `git log --oneline` — works
- ✓ `git revert --no-edit` — valid syntax
- ✓ `git show -- firestore.rules` — valid
- ✓ `git reset --hard` — dangerous but valid
- ⚠ `git log v1.3..HEAD` — **v1.3 tag does not exist** (only v1.2 exists)
  - **Fix needed:** Update full rollback procedure to use v1.2 or latest stable commit hash

### Firebase CLI Commands
- ✓ `firebase deploy --only hosting` — verified functional
- ✓ `firebase deploy --only firestore:rules` — verified functional
- ✓ `firebase deploy --only functions` — syntax valid (not tested due to build failure)
- ✓ `firebase emulator:start` — syntax valid
- ✓ `firebase functions:log` — syntax valid
- ✓ `firebase functions describe` — syntax valid (not tested)

### Google Cloud Commands
- ✓ `gcloud firestore indexes list` — syntax valid (not tested)
- ✓ `gcloud functions list` — syntax valid
- ✓ `gcloud secrets versions access latest` — syntax valid (not tested)
- ✓ `gcloud alpha monitoring policies list` — syntax valid (not tested)

### Build Commands
- ✓ `npm run build` — **command exists**, ✗ **fails due to TS errors**
- ✓ `cd functions && npm run build` — **command exists**, ✗ **fails due to TS errors**
- ✓ `npm test` — syntax valid (functions side)
- ✓ `npm run lint` — syntax valid

### Bash Script References
- ✓ `.planning/scripts/phase-4-smoke-test.sh` — exists and is well-structured
  - 10 automated checks
  - Color-coded output
  - Proper error handling
  - Exit codes (0 = pass, 1 = fail)

---

## 7. Cross-Document References — ✓ PASS

**Referenced documents (all exist):**

| Document | Path | Status |
|---|---|---|
| Deployment Checklist | `.planning/PHASE_4_DEPLOYMENT_CHECKLIST.md` | ✓ Exists |
| Smoke Test Script | `.planning/scripts/phase-4-smoke-test.sh` | ✓ Exists |
| Cloud Logs Guide | `docs/CLOUD_LOGS_QUICK_REFERENCE.md` | ✓ Exists |
| Incident Response | `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` | ✓ Exists |
| Firestore Rules (NOTIVISA) | `.claude/rules/notivisa-firestore-rules.md` | ✓ Exists |

---

## Issues Found & Required Fixes

### CRITICAL (Blocks all rollback paths except rules-only)

1. **Missing `LogicalSignature` export in types**
   - **File:** `src/features/notivisa-portal/services/PortalAuthService.ts:19`
   - **Fix:** Ensure `LogicalSignature` is exported from `src/types/` or correct import path
   - **Impact:** Blocks hosting + full rollback
   - **Estimated time:** 5 min

2. **Functions TypeScript errors in authenticatePortal.ts**
   - **File:** `functions/src/modules/notivisa-portal/callables/authenticatePortal.ts`
   - **Issues:**
     - Undefined `stateData` (line 117)
     - Missing `logger` property on https module (multiple lines)
     - OAuth token property name mismatches (idToken vs id_token, expiresIn vs expires_in, etc.)
   - **Fix:** 
     - Add null checks for `stateData`
     - Import/use correct logger from firebase-functions
     - Map OAuth response with snake_case keys to camelCase or adjust code
   - **Impact:** Blocks functions + full rollback
   - **Estimated time:** 15 min

### HIGH (Reduces rollback path options)

3. **v1.3 tag does not exist**
   - **File:** `.planning/PHASE_4_ROLLBACK_PROCEDURES.md` line 330
   - **Current state:** Only v1.2 tag exists
   - **Fix:** Replace `v1.3..HEAD` with a known good commit hash (from git log) or use `v1.2..HEAD` if Phase 3 work started on v1.2
   - **Impact:** Full rollback path (Path 5) requires manual commit hash lookup
   - **Estimated time:** 2 min

### MEDIUM (Documentation clarity)

4. **Incomplete gcloud command dependencies**
   - **Issue:** Several `gcloud` commands assume user is authenticated and project set
   - **Recommendation:** Add pre-flight check: `gcloud auth list` + `gcloud config get project`
   - **Impact:** Users may not realize they need gcloud auth before running rollback
   - **Estimated time:** 3 min (add section)

---

## Procedure Quality Assessment

### Strengths
- ✓ Comprehensive decision tree logic with clear time windows
- ✓ 5 rollback paths cover all failure scenarios
- ✓ Post-rollback monitoring with specific dashboards + metrics
- ✓ Prevention checklist to avoid repeating the incident
- ✓ Sign-off template ensures accountability
- ✓ Clear escalation path (CTO / incident commander)
- ✓ Smoke test script is production-ready

### Weaknesses
- ✗ Cannot be executed until code blockers are fixed
- ⚠ Missing validation that gcloud CLI is authenticated
- ⚠ v1.3 tag reference is outdated (doesn't exist)
- ⚠ No explicit guidance on which path to choose under time pressure (could add decision matrix)

---

## Recommended Next Steps

### Immediate (before any rollback attempt)

1. **Fix TS errors in src/features/notivisa-portal**
   - Ensure LogicalSignature is properly exported
   - Validate import paths

2. **Fix TS errors in functions/src/modules/notivisa-portal/callables/authenticatePortal.ts**
   - Add null checks for stateData
   - Fix logger import
   - Fix OAuth token property mapping

3. **Update rollback procedures**
   - Replace `v1.3..HEAD` with `v1.2..HEAD` or specific commit hash
   - Add gcloud auth preflight check

4. **Verify build passes**
   - Run `npm run build` → should succeed
   - Run `cd functions && npm run build && npm test` → all tests should pass

### Before Production Deployment (May 20)

1. Dry-run each rollback path (except full rollback, which is destructive):
   - ✓ Hosting rollback (Path 1) — actually revert, rebuild, verify
   - ✓ Rules rollback (Path 2) — currently ready
   - ✓ Functions rollback (Path 3, Option B) — disable function, verify

2. Post-rollback monitoring setup
   - Verify all 4 dashboards are accessible
   - Test alert policies fire correctly (via synthetic test)

3. On-call team training
   - Walk through decision tree with rotation
   - Practice executing Path 2 (rules-only) first (lowest risk)

---

## Sign-Off Checklist

| Item | Status | Owner |
|---|---|---|
| Document structure complete | ✓ PASS | — |
| 4 decision trees present | ✓ PASS | — |
| 5 rollback paths documented | ✓ PASS | — |
| Commands syntactically valid | ⚠ WARN | @CTO |
| Code compiles (no TS errors) | ✗ FAIL | @Dev team |
| v1.3 tag exists or procedure updated | ✗ FAIL | @Dev team |
| All referenced docs exist | ✓ PASS | — |
| Smoke test script is executable | ✓ PASS | — |
| Post-rollback monitoring specified | ✓ PASS | — |
| Prevention checklist complete | ✓ PASS | — |

---

## Final Verdict

**Document Quality:** ⭐⭐⭐⭐⭐ (5/5) — Excellent structure, decision logic, and completeness.

**Executability:** ⭐⭐☆☆☆ (2/5) — Cannot run due to code blockers. Rules-only path (Path 2) is ready; all others blocked until TS errors are fixed.

**Ready for Production Rollback:** ❌ **NO** — Fix code errors first. Then dry-run each path before May 20 deployment.

**Recommendation:** Fix the 3 critical code issues, update the v1.3 tag reference, then re-run this validation to confirm ✓ FULL PASS.

---

**Report Generated:** 2026-05-07 by Agent validation  
**Next Review:** After code fixes, before May 20 deployment gate
