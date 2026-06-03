# NOTIVISA TypeScript Cleanup Roadmap

**Status:** Phase 3.3 (2026-05-08)  
**Issue:** 149 pre-existing TS errors in `functions/src/modules/notivisa/` legacy code  
**Current handling:** tsconfig exclusion via `src/modules/notivisa/**`  
**Target Phase for hard delete:** Phase 6 (2026-07)

---

## Context

Wave 2–3 introduced refactored NOTIVISA callables alongside pre-existing legacy code via feature flag (coexist). Legacy code contains:

- Untyped parameters (`any` casts)
- Missing exports (23+ functions with signature mismatches)
- Old lifecycle patterns (deprecated in Wave 2-10)
- 149 pre-existing TypeScript errors

The legacy code is **functionally intact** (no runtime impact) but creates TypeScript compilation noise, blocking clean `npx tsc --noEmit` in CI/CD.

---

## Current State (Phase 3–5)

### Build Behavior

- `functions/tsconfig.json` excludes `src/modules/notivisa/**`
- `npm run build` works (legacy code is not compiled by tsc)
- `npx tsc --noEmit` passes (excludes notivisa, reports only labApoio + ocr-quality pre-existing)
- Feature flag `NOTIVISA_USE_WAVE2` routes production traffic to Wave 2-10 callables
- Legacy callables remain deployed but unused

### CI/CD Gate

Pre-deploy check `scripts/preflight-secrets-check.sh` validates secret status. TypeScript check (`npx tsc --noEmit`) is separate and currently skipped for notivisa via tsconfig exclusion.

---

## Cleanup Phases

### Phase 4–5: Migration (2026-05 to 2026-06)

**Action:** Migrate all active labs from legacy to Wave 2-10 callables.

1. **Week 1 (May 20–26):**
   - Deploy migration guide: `docs/NOTIVISA_WAVE2_MIGRATION_GUIDE.md`
   - Run analytics: count labs still using legacy callables (feature flag telemetry)
   - Notify lab admins: "Your NOTIVISA integration will be upgraded May 27"

2. **Week 2 (May 27–Jun 02):**
   - Bulk migrate labs: set `NOTIVISA_USE_WAVE2 = true` for all active labs
   - Smoke test: submit 3 drafts per lab via new callables
   - Monitor error logs: 24h watch for regressions (Cloud Logs)

3. **Week 3 (Jun 03–09):**
   - Audit: confirm zero legacy callable invocations in Cloud Logs
   - If regressions found: rollback to feature flag per lab, update migration guide
   - If clean: mark legacy as "safe to delete"

### Phase 6: Hard Delete (2026-07)

**Target date:** 2026-07-15 (Phase 6 sprint)

1. **Step 1: Pre-delete validation (2026-07-01)**
   - Run `docs/NOTIVISA_MIGRATION_VALIDATION.sql` (Firestore export)
   - Confirm: zero labs using legacy feature flag (NOTIVISA_USE_WAVE2 == false)
   - Run e2e smoke: Wave 2-10 callables cover all customer workflows
   - If validation fails: delay delete, update roadmap

2. **Step 2: Code deletion (2026-07-08)**
   - Delete directory: `functions/src/modules/notivisa/` **ENTIRELY**
   - Remove from function exports: `functions/src/index.ts` (notivisa callables list)
   - Update `functions/src/modules/INDEX.ts` (registry)
   - Run `npx tsc --noEmit` — **must be clean, no errors**

3. **Step 3: tsconfig cleanup (2026-07-09)**
   - Remove notivisa exclusion from `functions/tsconfig.json`
   - Verify tsc still clean (notivisa gone, labApoio + ocr-quality remain)
   - Verify build succeeds: `npm run build` in functions/

4. **Step 4: Deploy & verify (2026-07-10)**
   - Deploy Cloud Functions: `firebase deploy --only functions`
   - Hard-refresh web: verify no 404 for notivisa callables
   - Monitor logs: 24h watch for missing callable errors
   - Close ADR-0023 (notivisa cleanup decision)

---

## Rollback Plan

If hard delete causes unexpected issues:

1. **Immediately (within 2h):**

   ```bash
   git revert <delete-commit>
   firebase deploy --only functions
   ```

2. **Post-rollback (within 24h):**
   - Re-enable tsconfig exclusion: `"src/modules/notivisa/**"` in exclude array
   - Run `npx tsc --noEmit` (errors reappear, expected)
   - Document blocker in `docs/NOTIVISA_DELETE_BLOCKER_2026-07.md`
   - Schedule re-assessment for Phase 7

3. **Investigation checklist:**
   - Did Wave 2-10 callables have undetected gaps?
   - Are customers calling legacy callables via direct HTTP (not feature flag)?
   - Is Cloud Functions deployment itself corrupted?

---

## Deprecation Timeline

| Date       | Phase | Status  | Action                                       |
| ---------- | ----- | ------- | -------------------------------------------- |
| 2026-05-08 | 3.3   | Current | Exclude via tsconfig + document roadmap      |
| 2026-05-20 | 4     | Start   | Deploy migration guide, begin lab migration  |
| 2026-06-09 | 5     | End     | Confirm all labs migrated, zero legacy usage |
| 2026-07-08 | 6     | Execute | Hard delete legacy code + tsconfig cleanup   |
| 2026-07-10 | 6     | Verify  | Deploy + 24h smoke test                      |

---

## Testing Checklist (Pre-Delete, Phase 6)

Run these before executing Step 2 (code deletion):

### Unit Tests

```bash
cd functions
npm test -- src/modules/notivisa/ --verbose
```

Expected: 0 test files (excluded by tsconfig).

### Integration Tests

```bash
npm test -- src/__tests__/notivisa-wave2-integration.test.ts
```

Expected: ✓ all Wave 2-10 integration tests pass (new callables).

### Build Validation

```bash
npm run build
npx tsc --noEmit
```

Expected: clean (no errors, only labApoio + ocr-quality remain).

### Firestore Rules Test

```bash
cd ..
npm test -- firestore.rules.test.ts
```

Expected: notivisa rules still valid (rules are separate from code).

---

## Documentation Artifacts

Created/updated:

- `NOTIVISA_TSCONFIG_CLEANUP_ROADMAP.md` (this file)
- `NOTIVISA_WAVE2_MIGRATION_GUIDE.md` (Phase 4, to be created)
- `NOTIVISA_MIGRATION_VALIDATION.sql` (Phase 6, to be created)
- `functions/tsconfig.json` (enhanced comment, 2026-05-08)

---

## Decision Record

**ADR-0023: Legacy NOTIVISA Code Deprecation & Cleanup**

- **Context:** Wave 2–3 refactored NOTIVISA via new callables + feature flag; legacy code coexists but unused.
- **Problem:** 149 TS errors block clean `npx tsc --noEmit`; noise in CI/CD.
- **Decision:** Exclude via tsconfig (temporary), migrate all labs Phase 4–5, hard delete Phase 6.
- **Rationale:** Allows coexistence while roadmap is clear; phased approach reduces rollback risk.
- **Status:** Approved 2026-05-08.
- **Rollback:** Revert tsconfig exclusion, re-run tsc (errors reappear).

---

## Contact & Escalation

- **Phase 4 lead:** Notivisa migration team (TBD)
- **Phase 6 lead:** Core infrastructure team
- **Escalation:** If migration blockers arise, update `NOTIVISA_DELETE_BLOCKER_*.md` and notify tech lead 48h before Phase 6 start date.
