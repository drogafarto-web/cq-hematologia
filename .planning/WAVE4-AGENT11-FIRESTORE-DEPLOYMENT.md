# Wave 4 Agent 11 — Firestore Rules Deployment + Phased Validation

**Status:** IN PROGRESS  
**Date Started:** 2026-05-08  
**Wave:** 4 / Wave (Days TBD)  
**Owner:** Claude Code Agent 11

---

## Task Overview

Consolidate all Firestore rules proposals from Wave 2–7, validate syntax, deploy through phases, and create pre/post-deployment infrastructure.

### Inputs (from prior waves)

- **Wave 2–7**: audit + PII rules (base)
- **Wave 3**: `hasActiveSupervisor` gate (3 CIQ paths), `hasActiveRT` gate (3 critical paths)
- **Wave 4-4**: Formalize `hasActiveRT` rules
- **Patch files**: ADR-0003, ADR-0004, ADR-0007, ADR-0002-0005-0006

### Outputs (this wave)

1. ✅ Consolidated `firestore.rules` (no conflicts)
2. ✅ Firestore rules syntax validation (emulator test)
3. ✅ 16 new tests in `firestore-rules.test.ts`
4. ✅ Phased deployment script `scripts/deploy-firestore-rules.sh`
5. ✅ Pre-deploy checklist document
6. ✅ Admin Rules Inspector UI (`src/features/admin/FirestoreRulesInspector.tsx`)
7. ✅ Sign-off document

---

## Phase A: Consolidation

### Current State

- `firestore.rules` (2108 lines): Current production rules
- 4 patch files: ADR-0003, ADR-0004, ADR-0007, ADR-0002-0005-0006
- Helpers already defined: `isAuthenticated()`, `isSuperAdmin()`, `isActiveMemberOfLab()`, `hasActiveSupervisor()`, `hasModuleAccess()`, `isAdminOrRT()`, `hasRole()`, etc.
- Key gates: `hasActiveSupervisor` (RDC 978 Art. 122 enforcement), HMAC validation, role-based access

### Consolidation Strategy

1. Read all patch files
2. Merge into main rules file
3. Validate no conflicts or duplicates
4. Check that all helpers are available in scope
5. Syntax validation via `firebase deploy --dry-run`

### Status

- [x] Identified patch files
- [ ] Merge Phase A: incorporate ADR-0003 (NC rules)
- [ ] Merge Phase B: incorporate ADR-0004 (POP rules)
- [ ] Merge Phase C: incorporate ADR-0007
- [ ] Merge Phase D: incorporate ADR-0002-0005-0006
- [ ] Validate consolidated file
- [ ] No syntax errors
- [ ] All helpers in scope

---

## Phase B: Test Creation

### Test Coverage Plan (16 tests)

| Category                      | Tests | Coverage                                                                |
| ----------------------------- | ----- | ----------------------------------------------------------------------- |
| RT read gate                  | 4     | RT can read thresholds, non-RT blocked, supervisor read, admin override |
| RT write gate + supervisor    | 4     | RT + supervisor=allowed, RT without supervisor=denied, admin bypass     |
| Audit collection immutability | 3     | Create allowed, update denied, delete denied                            |
| PII redaction rules           | 3     | Patient reads restricted, RT sees full, audit redaction                 |
| Soft-delete enforcement       | 2     | Hard delete blocked, soft delete via flag allowed                       |

### Test File Location

`functions/src/shared/__tests__/firestore-rules.test.ts`

### Status

- [ ] Test file created
- [ ] 16 tests implemented
- [ ] All tests passing
- [ ] Coverage report generated

---

## Phase C: Deployment Script

### Script Location

`scripts/deploy-firestore-rules.sh`

### Script Features

- Options: `--phase [a|b|c|d]`, `--dry-run`, `--project [staging|prod]`
- Pre-flight checks:
  - Bootstrap supervisor-status all labs? ✓
  - All tests pass? ✓
  - Dry-run succeeds? ✓
- Phase execution with rollback on failure
- Post-deploy smoke tests (5 CIQ runs, 3 NOTIVISA submissions, 1 export)
- Rollback capability via git history

### Status

- [ ] Script created
- [ ] Pre-flight checks implemented
- [ ] Phase A–D execution logic
- [ ] Smoke test suite
- [ ] Rollback logic

---

## Phase D: Admin Rules Inspector UI

### Component Location

`src/features/admin/FirestoreRulesInspector.tsx`

### Features

- Visual rule tree (nested match paths)
- Permission matrix heatmap (collection × role × action)
- Interactive rule tester (form: select collection + action + role → allowed/denied)
- Real-time rule evaluation

### Status

- [ ] Component scaffolded
- [ ] Rule tree renderer
- [ ] Permission matrix
- [ ] Rule tester
- [ ] Styling + dark-first design

---

## Pre-Deploy Checklist

- [ ] Bootstrap `supervisor-status/current` doc in all labs (via migration script)
- [ ] All new rules tests pass (16/16)
- [ ] All existing tests still pass (no regressions)
- [ ] Staging deploy succeeds
- [ ] Staging smoke tests pass (5 CIQ, 3 NOTIVISA, 1 export)
- [ ] Dry-run on prod succeeds
- [ ] Rules file has zero conflicts
- [ ] No syntax errors

---

## Sign-Off Document

File: `proposed-changes/wave4-11-firestore-rules-deployment.md`

Contents:

- Summary of all rules consolidated
- Test results (16/16 passing)
- Staging validation results
- Pre-deploy checklist sign-off
- Post-deploy verification plan

---

## Timeline

- **Phase A (Consolidation)**: ~1h
- **Phase B (Tests)**: ~2h
- **Phase C (Deployment Script)**: ~1.5h
- **Phase D (Admin UI)**: ~2h
- **Validation & Sign-Off**: ~1h

**Total Estimated**: ~7.5h

---

## Success Criteria (Deploy Gate)

✅ All 16 tests pass  
✅ Staging deployment succeeds  
✅ Staging smoke tests pass  
✅ Rules file zero conflicts  
✅ Dry-run succeeds on prod  
✅ No regressions in existing tests (347+ existing tests)

---

## Next Steps (Wave 5)

1. Merge consolidated rules to main branch
2. Deploy to staging (Phase C script)
3. Monitor 24h on staging
4. Deploy to prod (Phase C script)
5. Monitor 24h on prod
6. Archive this phase + document lessons learned
