# Phase 8.5 — Housekeeping Audit Report
**Date:** 2026-05-06  
**Status:** IN PROGRESS — Context limit reached, handoff prepared  
**Scope:** Latent bugs audit + spine cleanup

---

## Summary

Phase 8.5 housekeeping initiated to fix accumulated technical debt from Phases 9-12 execution. **Web build passes. Web TSC strict mode passes. Functions TSC has 121 errors blocking deploy.**

---

## Findings

### 1. Web Layer (React + Vite)
✅ **STATUS: CLEAN**
- `npm run build` → 28.46s, successful
- `npx tsc --noEmit` → 0 errors (strict mode passes)
- Unsubscribe patterns verified (Firebase listeners properly cleanup)
- No unused imports detected via sampling
- No critical null reference issues found

### 2. Functions Layer (Node 22, firebase-functions v7)
🔴 **STATUS: BLOCKED — 121 TypeScript Errors**

**Error Breakdown:**
- **TS6133** (unused variables): 24 instances
- **TS2307** (cannot find module): 24 instances
- **TS2339** (property doesn't exist): 17 instances
- **TS18048** (possibly undefined): 11 instances
- **TS7006** (implicit any): 8 instances
- **TS2345** (incompatible argument): 6 instances
- **Other**: 31 instances (TS2308, TS2305, TS2724, etc.)

**Top Offending Files:**
1. `src/sgq/aprovarBatchImport.ts` — 11 errors
2. `src/liberacao/criarLaudo.ts` — 10 errors
3. `src/modules/satisfacao/dispararNPSPosResolucao.ts` — 8 errors
4. `src/sgq/previewDocDrive.ts` — 6 errors
5. `src/sgq/listarDocsDrive.ts` — 6 errors
6. `src/modules/satisfacao/dispararNPSRecurring.ts` — 6 errors

**Root Causes Identified:**

1. **Firebase Functions v2 API Migration (High Impact)**
   - Code uses v1 syntax: `functions.https.onCall((input, context) => ...)`
   - v7 requires: `onCall<T>(async (request: CallableRequest<T>) => ...)`
   - Affects ~15 functions across SGQ, Liberacao, Reclamacoes, Satisfacao modules
   - Fix: Migrate callable signatures to v2 pattern

2. **Missing Module Imports (24 instances)**
   - `shared/firebase` — missing path resolution
   - `shared/auth` — missing path resolution
   - `shared/signature` — missing path resolution
   - `shared/tokenUtils` — missing path resolution
   - `googleapis` — not in package.json
   - `@google/generative-ai` — in package.json but import errors
   - Fix: Add missing modules to functions/package.json OR verify path aliases in tsconfig

3. **Unused Variable Cleanup (24 instances)**
   - Examples: `FieldValue`, `z`, `LabId`, `UserId`, `context`, `signaturePayload`
   - Fix: Remove unused imports/variables

4. **Property Access on Possibly Undefined (11 instances)**
   - Pattern: `context?.auth?.token?.name` when context type is mismatched
   - Pattern: `response.auth` on `CallableResponse` (doesn't have auth property)
   - Fix: Use proper request/response types from firebase-functions v2

5. **Implicit Any Parameters (8 instances)**
   - Pattern: `(message) => { ... }` without type
   - Common in Pub/Sub triggers: `onDocumentWrite((change, context) => ...)`
   - Fix: Add explicit types via CloudEvent

6. **Export Ambiguity (3 instances in liberacao/_shared/index.ts)**
   - ReleaseState, ExamClassification, ExameConfig exported twice
   - Fix: Consolidate exports

---

## Implementation Plan (Next Session)

### Phase 8.5 Batch 1 — Firebase Functions v2 Migration (Est. 2-3h)
**Priority:** P0 (blocks all function deploys)

1. Create helper migration script to refactor callable signatures
2. Fix 15+ callables using v2 API pattern:
   ```typescript
   // OLD (v1):
   functions.https.onCall(async (input, context) => { ... })
   
   // NEW (v2):
   onCall<InputType>(async (request: CallableRequest<InputType>) => { ... })
   ```
3. Update request/response property access:
   - `input` → `request.data`
   - `context.auth` → `request.auth`
   - `response.auth` → invalid (remove usage)

4. Files to migrate (priority order):
   - `src/sgq/aprovarBatchImport.ts`
   - `src/sgq/previewDocDrive.ts`
   - `src/sgq/listarDocsDrive.ts`
   - `src/sgq/classificarDocAuto.ts`
   - `src/modules/satisfacao/dispararNPSPosResolucao.ts`
   - `src/modules/satisfacao/submitNPSResposta.ts`
   - `src/modules/reclamacoes/transitarReclamacao.ts`
   - `src/modules/sugestoes/criarSugestao.ts`
   - `src/bioquimica/applyBulaToLot.ts`
   - etc.

### Phase 8.5 Batch 2 — Module Resolution + Package Deps (Est. 1-2h)
**Priority:** P1

1. Add missing packages to functions/package.json:
   - `googleapis` (for Drive API)
   - Verify `@google/generative-ai` import paths

2. Fix import path errors:
   - Add missing `shared/*` files OR
   - Fix tsconfig path aliases in functions/tsconfig.json

3. Verify path alias configuration:
   ```json
   "paths": {
     "@/*": ["../src/*"],
     "@functions/*": ["./src/*"]
   }
   ```

### Phase 8.5 Batch 3 — Cleanup + Validation (Est. 1h)
**Priority:** P2

1. Remove 24 unused variables
2. Fix 11 possibly-undefined issues
3. Add explicit types to 8 implicit-any parameters
4. Resolve 3 export ambiguities in liberacao/_shared/index.ts
5. Run `npx tsc --noEmit` → 0 errors target

### Phase 8.5 Batch 4 — Smoke Testing (Est. 30m)
**Priority:** P3

1. `npm run build` in functions/ → success
2. Test 3-4 critical callables via Firebase emulator
3. Verify no regression in web build
4. Commit: `fix(functions): TypeScript validation + firebase-functions v2 migration`

---

## Context for Resumption

**When resuming Phase 8.5.1:**

1. Start with `src/sgq/aprovarBatchImport.ts` — has 11 errors, most fixable in <5min
2. Use this as template for remaining ~15 files
3. Run incremental tsc checks: `cd functions && npx tsc --noEmit` after each file
4. Expected error reduction: 121 → ~50 (after v2 migration) → ~0 (after cleanup)

**Commands to verify progress:**
```bash
cd "C:\hc quality\functions"
npx tsc --noEmit 2>&1 | wc -l                    # Total error count
npx tsc --noEmit 2>&1 | grep "error TS" | cut -d: -f4 | sort | uniq -c | sort -rn  # By type
```

**Files NOT touched in web layer (all clean):**
- src/features/** — all modules
- src/shared/**
- src/store/**
- vite.config.ts
- tsconfig.json

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Functions deploy blocked | High | Fix all 121 TSC errors before any function deploy |
| v2 API breakage | Medium | Test 3-4 key callables in emulator after migration |
| Missing deps on deploy | Medium | Add all packages to package.json + test build |
| Regression in web | Low | Web build already passes; no web changes made |

---

## Next Steps (After Resume)

1. **Session: Phase 8.5.1** → Fix 121 TSC errors in functions
   - Target: `npx tsc --noEmit` → 0 errors
   - Target: `npm run build` (functions) → success
   
2. **Session: Phase 8.5.2** → Latent bug audit (memory leaks, null refs)
   - Firestore listener patterns
   - Error boundaries in UI
   - N+1 query patterns
   - Memory leak detection (Redux DevTools Profiler)

3. **Session: Phase 8.5.3** → Dead code cleanup
   - Unused functions/exports
   - Commented code removal
   - Deprecated API audit

4. **Session: Phase 8.5.4** → Documentation + commit
   - Update CLAUDE.md with bug fixes
   - Create `PHASE_8_5_SUMMARY.md`
   - Commit: `chore(08.5): housekeeping — TSC validation + dead code cleanup`

---

**Estimated Total Phase 8.5 Duration:** ~6-8 hours spread across 4 sessions

**Created:** 2026-05-06 14:52 UTC  
**Status:** Awaiting context reset + session resume for Batch 1
