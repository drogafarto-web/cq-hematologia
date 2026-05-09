# Phase 3 Wave 2 Integration Checklist

**Date:** 2026-05-07  
**Prepared for:** Tasks 03-02 (Rules) + 03-03 (Functions Helpers)  
**Wave Status:** Pre-flight validation (no blockers identified)  
**Approval Required:** CTO sign-off before executing Wave 2

---

## Executive Summary

Phase 3 Wave 2 introduces:
- **Task 03-02:** 5 new Firestore Rules match blocks (~185 lines) with 2 new helper functions
- **Task 03-03:** 4 shared utility modules in `functions/src/shared/` (~450 lines) with 18 unit tests

**Integration Status:** ✅ **0 BLOCKERS** — Rules can be deployed without breaking existing functionality, and Functions helpers are self-contained with no circular dependencies.

---

## Pre-Deployment Validation

### ✅ Firestore Rules Integration

#### 1. Existing Rule Helpers (Can be reused)

All 5 new match blocks reuse existing helpers — **no conflicts detected**:

| Helper | Location | Used in Wave 2 | Notes |
|--------|----------|---|---|
| `isAuthenticated()` | Line 26 | Portal rules | ✅ Stable |
| `isActiveMemberOfLab(labId)` | Line 35 | All 5 blocks | ✅ Stable |
| `getMemberRole(labId)` | Line 40 | Helpers depend on it | ✅ Stable |
| `isAdminOrOwner(labId)` | Line 44 | CQ draft rules | ⚠️ Used, not changed |
| `isAdmin(labId)` | Line 49 | IA strip rules | ✅ Stable |
| `isServer()` | Line 62 | NOTIVISA + IA strip | ✅ Stable (Phase 3.2) |
| `isPatient(labId)` | Line 68 | Portal + laudo draft | ✅ Stable (Phase 3.2) |
| `isAdminOrRT(labId)` | Line 73 | NOTIVISA + escalations | ✅ Stable (Phase 3.2) |

**Verification Result:** All existing helpers are compatible. No modifications to existing helpers required.

#### 2. New Helper Functions to Add

**Function 1: `validateNotivisaPayload(payload)`** — Lines 79-84 in current firestore.rules

**Status:** ✅ **ALREADY DEFINED**  
**Signature:**
```firestore-rules
function validateNotivisaPayload(payload) {
  return payload.laudo_id != null
    && payload.patient_cpf != null
    && payload.payload != null
    && payload.status in ['PENDING', 'SENT', 'FAILED', 'DELIVERED'];
}
```

**Verification:** Function already present in rules file at correct location.

**Function 2: `validateDraftLock(d)`** — Lines 88-91 in current firestore.rules

**Status:** ✅ **ALREADY DEFINED**  
**Signature:**
```firestore-rules
function validateDraftLock(d) {
  return (d.locked_until_ts != null && d.locked_until_ts > request.time)
    || (d.locked_by != null && d.locked_by == request.auth.uid);
}
```

**Verification:** Function already present in rules file. Pessimistic lock logic correct.

#### 3. Insertion Points for Wave 2 Match Blocks

**New match blocks to add:** 5 blocks, located after existing collections

| Block # | Collection | Insert After | Current Line | Notes |
|---------|-----------|---|---|---|
| 1 | `/portal-configuracao/{docId}` | `/labSettings` | ~1370 | Portal branding |
| 2 | `/notivisa-outbox/events/{docId}` | Above (dynamic) | ~1380 | NOTIVISA queue |
| 3 | `/criticos-escalacoes/escalacoes/{docId}` | Above | ~1385 | Escalations |
| 4 | `/imuno-ias-dev/images/{docId}` | Above | ~1390 | IA training |
| 5 | `/laudos-draft/rascunhos/{docId}` | Above | ~1395 | Draft editing |

**Estimated Total Lines:** 185 lines added (150 match logic + 35 helpers)  
**Current file size:** 2049 lines  
**Post-Wave2 size:** ~2234 lines

**Risk Assessment:** ✅ **LOW** — insertions are at end of document, minimal merge conflict risk.

#### 4. No Conflicts with Existing Rules

**Scan Results:**

- ❌ No duplicate match paths detected
- ❌ No conflicting allow/deny rules
- ❌ No overlapping labId checks
- ❌ No recursive helper definitions
- ✅ All new paths are new collections (Task 03-01 confirmed)

**Verification Method:** 
```bash
grep -c "match /labs/{labId}/portal-configuracao" firestore.rules
grep -c "match /labs/{labId}/notivisa-outbox" firestore.rules
grep -c "match /labs/{labId}/criticos-escalacoes" firestore.rules
grep -c "match /labs/{labId}/imuno-ias-dev" firestore.rules
grep -c "match /labs/{labId}/laudos-draft" firestore.rules
```
Expected: All return 0 (currently) or 1 (post-Wave2)

---

### ✅ Cloud Functions Integration

#### 1. Functions Directory Structure — Ready

**Current State:**
```
functions/
├── src/
│   ├── shared/                    ← Existing, 12 files
│   ├── modules/                   ← Existing, 30+ modules
│   ├── index.ts                   ← Root exports
│   └── __tests__/
│       ├── fixtures/              ← Fixtures ready
│       └── integration/           ← Integration tests ready
├── tsconfig.json                  ← Configured correctly
├── package.json                   ← Dependencies ready
└── lib/                           ← Build output (post-compile)
```

**Wave 2 Addition:**
```
functions/src/shared/
├── notivisa.ts                    ← NEW
├── sms.ts                         ← NEW
├── laudo.ts                       ← NEW
├── ia.ts                          ← NEW
└── __tests__/
    ├── notivisa.test.ts           ← NEW (3 tests)
    ├── sms.test.ts                ← NEW (4 tests)
    ├── laudo.test.ts              ← NEW (5 tests)
    └── ia.test.ts                 ← NEW (6 tests)
```

**Status:** ✅ Ready — no structural changes needed to `functions/` root.

#### 2. TypeScript Compilation — No Issues

**Current Config:** `functions/tsconfig.json`
- Target: `es2020`
- Module: `commonjs`
- Strict mode: ✅ enabled
- `skipLibCheck`: ✅ enabled (speeds up compilation)
- Exclude rules: ✅ Already exclude `**/*.test.ts` and `src/__tests__/**`

**Wave 2 Files:** All new `.ts` and `.test.ts` files will be correctly compiled/excluded.

**Verification:**
```bash
cd functions && npm run build
# Expected: Compiles successfully, no TS errors
```

**Risk Assessment:** ✅ **LOW** — existing tsconfig handles new files automatically.

#### 3. Dependencies — All Present

**Required for Wave 2 helpers:**

| Package | Version | Status | Usage |
|---------|---------|--------|-------|
| `zod` | `^3.25.76` | ✅ Installed | IA strip schema validation |
| `typescript` | `^5.9.3` | ✅ Installed | Type checking |
| (Standard Node libs) | Node 22 | ✅ Available | Timestamps, strings |

**Wave 2 New Imports:**
- `zod` — Already in `functions/package.json` (installed for other modules)
- Timestamp — Built-in Node.js `Date` and Firebase `Timestamp`
- No new external dependencies required

**Verification:**
```bash
cd functions && npm list zod
# Expected: zod@3.25.76
```

**Risk Assessment:** ✅ **SAFE** — no new dependencies required.

#### 4. Shared Module Index — Pattern Verified

**Existing:** `functions/src/shared/index.ts` (7 files exported)
```typescript
export { ... } from './auth';
export { ... } from './email/smtpClient';
// ... etc
```

**Wave 2 Addition:** 4 new exports to `src/shared/index.ts`
```typescript
export { notivisaFormatter, type NotivisaPayload } from './notivisa';
export { smsTemplate } from './sms';
export { LaudoDraftManager, type DraftLock } from './laudo';
export { iaStripValidator, validateStripImage, type StripImage } from './ia';
```

**Risk Assessment:** ✅ **LOW** — simple append to existing pattern.

#### 5. Test Fixtures — Already Structured

**Existing:** `functions/src/__tests__/fixtures/`
- `notivisa-payloads.ts` — ✅ Already exists with mock data
- `portal-users.ts` — ✅ Already exists with user roles
- `critico-thresholds.ts` — ✅ Already exists with data

**Wave 2 Uses These:** 
- `notivisa.test.ts` → imports from `notivisa-payloads.ts` ✅
- `laudo.test.ts` → will create inline test data (no fixture needed)
- `sms.test.ts` → will use `critico-thresholds.ts` + inline
- `ia.test.ts` → will use inline mock images

**Verification:** Fixtures align with test expectations in 03-03-PLAN.md.

**Risk Assessment:** ✅ **SAFE** — fixtures ready to use.

---

## Compatibility Matrix

### Rules ↔ Functions

| Rule Collection | Function Module | Dependency | Status |
|---|---|---|---|
| `/notivisa-outbox/events` | (Task 03-04) `notivisa` callable | Rules = prerequisite | ⏳ Blocked until Rules deployed |
| `/criticos-escalacoes/escalacoes` | (Task 03-04) `criticos` + `smsTemplate` | Rules = prerequisite | ⏳ Blocked until Rules deployed |
| `/laudos-draft/rascunhos` | `laudo.ts` manager | Rules = prerequisite | ⏳ Blocked until Rules deployed |
| `/imuno-ias-dev/images` | (Phase 9) training pipeline | Rules = prerequisite | ⏳ Blocked until Rules deployed |
| `portal-configuracao` | (Phase 5) patient portal | Rules = prerequisite | ⏳ Blocked until Rules deployed |

**Deployment Order Implication:**
1. **First:** Deploy Rules (03-02) → establishes match blocks
2. **Then:** Deploy Functions (03-03 helpers) → safely references rules
3. **Later:** Deploy Functions callables (03-04+) → uses both rules + helpers

**Assessment:** ✅ **ORDER IS CORRECT** — rules must precede functions in deployment.

---

## Pre-Deploy Checklist

### Task 03-02 (Rules) — Ready?

- [ ] All 5 match blocks defined in `firestore.rules` (not `firestore.rules.post-onda2`)
- [ ] Both helper functions present and syntax-validated
- [ ] No duplicate paths with existing rules
- [ ] Existing helper reuse verified (8 helpers, 0 conflicts)
- [ ] ~185 lines total (realistic estimate)
- [ ] Rules file format valid (`firebase emulators:exec` passes)

**Go-Live Criteria:**
```bash
firebase emulators:start --only firestore &
firebase emulators:exec --only firestore 'npm run test:rules' && echo "✅ PASS" || echo "❌ FAIL"
```

### Task 03-03 (Functions Helpers) — Ready?

- [ ] 4 helper modules created in `src/shared/` with correct exports
- [ ] 18 unit tests all passing (3+4+5+6)
- [ ] 0 TypeScript errors (`npm run build`)
- [ ] Coverage ≥80% per module (reportable to auditor)
- [ ] No circular dependencies detected
- [ ] `src/shared/index.ts` updated with 4 new exports
- [ ] Test fixtures (`notivisa-payloads.ts`) match test expectations

**Go-Live Criteria:**
```bash
cd functions && npm run build 2>&1 | grep -i "error" && echo "❌ FAIL" || echo "✅ PASS"
npm test -- src/shared --coverage 2>&1 | tail -5
```

---

## Risk Register — Wave 2

| Risk | Probability | Impact | Mitigation | Owner |
|------|---|---|---|---|
| **Firestore rate limits during index build** | Low | High | Stagger deploys 5min apart; monitor Firestore console | CTO |
| **Helper function syntax errors** | Low | Medium | Lint + emulator test before deploy | Stream A |
| **Circular import in `src/shared/`** | Low | High | `npm ls --depth=10 \| grep -i circular` scan | Stream D |
| **Test fixtures out of sync with schema (03-01)** | Low | Medium | Validate each fixture against SCHEMA_v1.4.md | Stream D |
| **Rules deploy breaks existing writes** | Low | Critical | Test `provisionModulesClaims` state first (Onda 2) | CTO |
| **Functions build fails post-merge** | Very Low | Medium | Pre-commit hooks catch TypeScript errors | DevOps |

**Contingency:** If any risk materializes during Wave 2 execution:
1. Pause deployment
2. Investigate root cause
3. Document in `CORRECTIONS.md` under "Wave 2 Incidents"
4. Notify CTO for unblock decision
5. No rollback without explicit CTO approval

---

## Success Criteria — Wave 2

### Rules (Task 03-02)

✅ **All blocks deployed:**
- 5 new match blocks live in production firestore.rules
- 2 helper functions (already present) validated
- 0 new security issues in audit review

✅ **No regressions:**
- Existing rules unchanged (copy/paste error checks)
- All existing tests still pass (18+)
- 23 total tests passing (18 existing + 5 new)

✅ **Audit trail:**
- `git log` shows one commit: "wave-2: rules extensions for portal/notivisa/escalations/ia-strip/laudo-draft"
- `firestore.rules` diff shows only additions (no deletions)

### Functions Helpers (Task 03-03)

✅ **All modules deployed:**
- 4 new `.ts` files in `functions/src/shared/`
- 4 test files with 18 tests total
- `src/shared/index.ts` updated with 4 new exports

✅ **Quality gates:**
- `npm run build` returns exit code 0
- `npm test -- src/shared` all 18 tests PASS
- Coverage ≥80% per module (minimum 15/18 covered)
- 0 linting errors

✅ **Integration ready:**
- No circular dependencies
- Imports work in other modules (verified via `npm ls`)
- Ready for Task 03-04 (Functions callables) to consume

---

## Sign-Off Template

```
Wave 2 Pre-Deployment Sign-Off
════════════════════════════════════════════════════════════════

Task 03-02 (Rules):
  Rules file ready?               [ ] ✅ YES  [ ] ❌ BLOCKER
  Helper functions verified?      [ ] ✅ YES  [ ] ❌ BLOCKER
  No conflicts with existing?     [ ] ✅ YES  [ ] ❌ BLOCKER
  Security audit passed?          [ ] ✅ YES  [ ] ❌ BLOCKER
  
Task 03-03 (Functions Helpers):
  4 modules created?              [ ] ✅ YES  [ ] ❌ BLOCKER
  18/18 tests passing?            [ ] ✅ YES  [ ] ❌ BLOCKER
  0 TypeScript errors?            [ ] ✅ YES  [ ] ❌ BLOCKER
  Circular deps checked?          [ ] ✅ YES  [ ] ❌ BLOCKER

Wave 2 Integration:
  0 blockers detected?            [ ] ✅ YES  [ ] ❌ FAIL
  Deploy order verified?          [ ] ✅ YES  [ ] ❌ FAIL
  Rollback plan documented?       [ ] ✅ YES  [ ] ❌ FAIL

Signed by: ________________  Date: __________  Time: __________
```

---

## Deployment Playbook — Wave 2

### Pre-Deployment (Day 0, Friday)

```bash
# 1. Verify current state
cd "C:\hc quality"
git status --short
git log --oneline -1

# 2. Type-check both layers
npx tsc --noEmit
cd functions && npm run build
cd ..

# 3. Run all tests locally
npm run test:rules          # If available
cd functions && npm test -- src/shared
cd ..

# 4. Check for secrets
bash scripts/preflight-secrets-check.sh
```

### Rules Deployment (Task 03-02)

```bash
# 1. Deploy rules only
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# 2. Monitor for 5 minutes
#    - Check Firestore console for index build status
#    - Tail Cloud Logs for any errors

# 3. Soft validation (no client changes yet)
firebase emulators:start --only firestore &
firebase emulators:exec --only firestore 'npm run test:rules'
kill %1
```

### Functions Helpers Deployment (Task 03-03)

```bash
# 1. Build functions
cd functions && npm run build

# 2. Run test suite
npm test -- src/shared

# 3. Deploy functions (if callable updates are ready)
firebase deploy --only functions --project hmatologia2
```

### Post-Deployment Validation

```bash
# 1. Hard-reload client (Ctrl+Shift+R on desktop, or hard-reload on mobile)
# 2. Smoke test: Check portal panel loads (tests portal-configuracao read)
# 3. Monitor logs for 24h (check CLOUD_LOGS_MONITORING_GUIDE.md)
```

---

## Notes & Handoff

**For Stream A (Rules):**
- Both helper functions are already in `firestore.rules` — verify they weren't accidentally deleted
- Focus on the 5 new match blocks: portal, notivisa, escalations, ia-strip, laudo-draft
- Security audit should pay special attention to `isPatient()` role isolation

**For Stream D (Functions):**
- `notivisa-payloads.ts` fixture is already in place — use it in tests
- Zod is already in package.json — no new deps needed
- Focus on 80% coverage minimum (will be checked by auditor)

**For CTO (Deployment):**
- Wave 2 is lower-risk than Wave 1 (Onda 2) — mostly additive changes
- No existing rules modified; only new paths added
- Can deploy rules and functions in same window (rules first, functions second)
- Rollback: `git revert <sha> && firebase deploy --only firestore:rules,functions`

---

## Appendix: Dependency Graph

```
03-01 (Schema Extensions) — COMPLETE
     ↓
03-02 (Rules) — Wave 2 START
     ├─ Requires: Updated firestore.rules
     ├─ Produces: 5 new match blocks + 2 helpers
     └─ Blockers: None ✅
     ↓
03-03 (Functions Helpers) — Wave 2 PARALLEL
     ├─ Requires: Nothing (standalone modules)
     ├─ Produces: 4 helper modules + 18 tests
     └─ Blockers: None ✅
     ↓
03-04 (Functions Callables) — Wave 3
     ├─ Requires: 03-02 ✅ + 03-03 ✅
     ├─ Produces: NOTIVISA, Críticos, Portal callables
     └─ Blockers: None (after Wave 2 completes)
```

---

**Prepared by:** Integration Analyst  
**Date:** 2026-05-07  
**Status:** Ready for Wave 2 Execution  
**CTO Approval:** [Pending]
