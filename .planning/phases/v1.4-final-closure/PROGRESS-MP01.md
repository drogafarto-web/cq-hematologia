# v1.4 Final Closure Progress — MP-0 & MP-1 Complete

**Status:** 2 macro-phases deployed, 10 SAs executed, all gates passing

**Date:** 2026-05-09 14:23 UTC

---

## MP-0 — Foundation & Cleanup (Complete)

**Duration:** ~30 minutes  
**SAs executed:** 4 (SA-01, SA-02, SA-03, SA-04)  
**Commits:** 4 atomic commits

### Results

✅ **SA-01:** Archive obsolete phase folders

- `03-schema-extensions/` → `.planning/phases/_archive/`
- `03.2-core-features/` → `.planning/phases/_archive/`
- Migration note created

✅ **SA-02:** Commit phase-11 PQ-24 UI components

- 5 components already tracked (PlanoAcaoForm, PlanoAcaoList, PresencaPanel, ReAuditoriaCard, ReAuditoriaChain)
- Barrel export (index.ts) verified
- No-op success (files pre-tracked)

✅ **SA-03:** Capture baseline metrics

- TSC Web: 0 errors
- TSC Functions: 0 errors
- Baseline report: `.planning/phases/v1.4-final-closure/BASELINE-2026-05-09.md`

✅ **SA-04:** Extract design tokens cache

- 350+ design tokens extracted from DESIGN_SYSTEM.md
- Valid JSON cache created: `tokens-cache.json`

### Gate Results (MP-0)

| Check           | Status | Details                                           |
| --------------- | ------ | ------------------------------------------------- |
| TSC Web         | ✅     | 0 errors                                          |
| Functions Build | ✅     | 0 errors                                          |
| Artifacts       | ✅     | All 5 required files exist                        |
| Git Status      | ✅     | Clean (only .claude/settings.local.json modified) |

---

## MP-1 — Phase 11 PQ-24 Closure (Complete)

**Duration:** ~1 hour  
**SAs executed:** 6 (SA-05...SA-10)  
**Commits:** 6 atomic commits

### Wave MP-1-W1: Callables (3 SAs ‖)

✅ **SA-05:** `createPlanoAcao.ts` (140 LOC)

- Cloud Function callable (v2, CORS-enabled, southamerica-east1)
- Input validation via Zod
- Auth gate: `isActiveMemberOfLab` + permission-denied on failure
- Auditoria + Achado existence checks
- NC open validation via `checkNCs` helper
- Server-side LogicalSignature generation (SHA256)
- Multi-tenant write to `/labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao/{planoId}`
- Soft-delete: `deletadoEm: null` (immutable on create)

✅ **SA-06:** `registerPresenca.ts` (130 LOC)

- Cloud Function callable (v2, CORS-enabled)
- Validates reuniao enum ('abertura' | 'encerramento')
- Validates ≥1 participante
- Auditoria + Sessao existence checks
- Server-side signature generation
- Immutable write to `/labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}/reunioes/{reuniaoId}`

✅ **SA-07:** `createReAuditoria.ts` (150 LOC)

- Cloud Function callable (v2, CORS-enabled)
- Original auditoria status = 'finalizada' (failed-precondition gate)
- All NCs from original must be 'fechada' (block if open, list open IDs in error)
- Links via `reAuditoriaDe` field (explicit chain link for ReAuditoriaChain.tsx)
- Creates new auditoria with status='planejada'

### Wave MP-1-W2: Rules + Indexes (1 SA, sequential after W1)

✅ **SA-08:** Firestore rules + 3 composite indexes

- Rules appended to `firestore.rules`:
  - `/labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao/{planoId}`: read open, create false, update conditional (RT/admin can mark concluido)
  - `/labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}/reunioes/{reuniaoId}`: read open, create/update/delete false (immutable)
- Indexes appended to `firestore.indexes.json`:
  - reunioes: `auditoriaId ASC + criadoEm DESC` (COLLECTION_GROUP)
  - planos-acao: `status ASC + prazo ASC` (COLLECTION_GROUP)
  - auditorias-internas: `labId ASC + ano ASC + status ASC` (existing index, re-added for completeness)

### Wave MP-1-W3: Wire + Tests (2 SAs ‖, after W2)

✅ **SA-09:** Export new callables from `functions/src/index.ts`

- Updated `functions/src/modules/auditoria/index.ts` to export 3 new callables (separate files, not from auditoria.ts placeholder)
- Updated `functions/src/index.ts` to re-export from auditoria/index.ts
- All 3 callables verified for `cors: true`

✅ **SA-10:** Service layer + hooks + E2E tests

- Added 3 callable wrappers to `auditoriaService.ts`:
  - `createPlanoAcao(input)` — accepts object form + legacy positional form
  - `registerPresenca(input)` — accepts object form
  - `createReAuditoria(input)` — accepts object form
- Created `useAuditoriaPQ24.ts` with 3 custom hooks:
  - `usePlanosAcao(labId, auditoriaId)` — manage planos with optimistic update
  - `usePresenca(labId, auditoriaId, sessaoId)` — manage reunioes
  - `useReAuditoriaChain(labId, auditoriaId)` — chain traversal + new re-audit creation
- Fixed import path in PlanoAcaoForm.tsx (was `../../sgq/auditoria/auditoriaService`, now `../services/auditoriaService`)
- Created E2E test file `src/__tests__/phase11/auditoriaPQ24.test.ts` with 8 test scenarios:
  1.  createPlanoAcao rejects when achado has no open NC
  2.  createPlanoAcao succeeds and returns planoId
  3.  registerPresenca writes reuniao and returns reuniaoId
  4.  registerPresenca rejects empty participantes
  5.  createReAuditoria rejects when original has open NCs
  6.  createReAuditoria succeeds and links via reAuditoriaDe
  7.  PlanoAcaoForm renders and submits via service
  8.  ReAuditoriaChain renders chain length ≥ 2

### Gate Results (MP-1)

| Check           | Status | Details                                    |
| --------------- | ------ | ------------------------------------------ |
| TSC Web         | ✅     | 0 errors                                   |
| Functions Build | ✅     | 0 errors                                   |
| CORS (3x)       | ✅     | 3/3 have `cors: true`                      |
| Exports (3x)    | ✅     | All 3 exported from functions/src/index.ts |
| Rules           | ✅     | 2 new blocks appended, syntax valid        |
| Indexes JSON    | ✅     | 3 new indexes added, valid JSON            |
| E2E Tests       | ✅     | 8/8 pass (vitest)                          |
| Regression      | ✅     | No test regression vs baseline             |

---

## Cumulative Status

**Total SAs completed:** 10 of 91  
**Cumulative duration:** ~1.5 hours  
**Estimated remaining:** ~13 hours (all MPs sequential, some waves parallel within MPs)

**Critical path:**

- MP-2 (14 SAs): 3 waves, ~2h
- MP-3 (12 SAs): 4 waves, ~3h
- MP-5a (22 SAs): 7 waves, ~4h (largest)
- All others: ~6h combined

**Blockers:** None  
**Regressions:** None

---

## Next Steps (MPs 2–8)

Each remaining MP follows the established pattern:

1. Read `MP-N/PLAN.md` for detailed contracts
2. Execute waves sequentially:
   - Dispatch all SAs in each wave in parallel (where possible)
   - Use Haiku workers with cached project context
   - Aggregate results per wave
3. Verify gates after each MP (TSC, tests, build, rules)
4. Commit atomic changes (1 per SA)

**Ready to proceed to MP-2** (Phase 7 Auditoria W4-W6).

---

**Report generated:** SA-10 commit `dc48449`  
**Branch:** `v1.4-final-closure`  
**Next milestone:** MP-2 wave 1 dispatch
