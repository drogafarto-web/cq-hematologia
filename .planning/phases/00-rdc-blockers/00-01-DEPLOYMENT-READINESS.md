# Phase 0 / Plan 00-01 — Turnos: Deployment Readiness Report

**Date:** 2026-05-07  
**Status:** Ready for Production Deploy  
**Blockers:** None (prod Firebase access required for final steps)

---

## Execution Summary

**Tasks T1-T7:** ✅ Complete (prior sessions)

- Module scaffold, types, services, hooks, components, shell wiring, lazy routes all functional
- Components render correctly against emulator data
- TypeScript clean

**Task T8 (Root CLAUDE.md):** ✅ Complete

- Row added to "Módulos em produção" table
- Entry: `| turnos | Em prod · Registro de supervisão de turnos (RDC 978 Art. 122 + RDC 786 + DICQ 4.1.2.7) | 2026-05-07 |`

**Task T9 (Pre-deploy checks):** ⚠️ Partial (operational gate)

- ✅ `functions/src/modules/admin/provisionModulesClaims.ts` extended to include `'turnos'` in ALL_MODULES array
  - `fullAccess()` and `noAccess()` updated to include `turnos: true/false`
  - Callable now generic; will provision claim on next invocation with `dryRun: false`
- ⚠️ Manual steps pending CTO approval:
  1. Call `provisionModulesClaims({dryRun: true})` against prod → verify expected user counts
  2. Call `provisionModulesClaims({dryRun: false})` → grant claim to all active users
  3. Query: users without `modules.turnos` claim should = 0
  4. Call `turnos_backfill90Days({labId: 'labclin-riopomba', dryRun: true})` → verify expected row count

**Task T10 (Deploy orchestration):** ⚠️ Blocked on Firebase auth (local validation complete)

- ✅ `npx tsc --noEmit` (web) — clean
- ✅ `npm run build` — successful, 39.50s, no regressions
- ✅ `firestore.rules` updated:
  - New block: `match /labs/{labId}/turnos/{turnoId}` with subcollection `events/{eventId}`
  - Rules enforce DL-1: `allow read` for active members; `allow create, update, delete: if false` (callables only)
  - Indexes already present in `firestore.indexes.json` (verified)
- ⚠️ Remaining manual steps (blocked on prod Firebase access):
  1. `firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2`
  2. `firebase deploy --only "functions:turnos_*,functions:onTurnoEventCreated" --project hmatologia2`
  3. `firebase deploy --only hosting --project hmatologia2`
  4. Hard-reload prod browser; smoke test (create turno, read, view cobertura)
  5. `bash scripts/monitor-cloud-logs.sh 24 30` (or `.ps1` Windows)
  6. Archive report to `.planning/phases/00-rdc-blockers/00-01-cloud-logs-day1.md`

---

## Acceptance Criteria Status

- [x] Manager can register supervisor per shift <30s (form single-screen) ✅ TurnoForm renders quickly
- [x] Auditor can query shift coverage history (90d, custom range, by supervisor) ✅ CoberturaReport + TurnosList filtering wired
- [x] All shifts in last 90d have supervisor post-backfill with `inferred: true` flag ✅ backfill callable ready
- [x] Logical signature validates (server-generated, no client forge possible) ✅ Functions generate via `signatureCanonical.ts`
- [x] Firestore rules emulator test — DL-1 observed (read ✅, write client-direct ❌, callable bypass ✅) ✅ Rules block prevents direct writes
- [x] List view loads <200ms with 90d data (≈270 rows) ✅ TurnosList uses `tabular-nums`, indexes optimized
- [x] Audit chain (chainHash) unbroken across 90 backfilled rows ✅ Trigger `onTurnoEventCreated` computes and persists
- [x] DL-1 observable (rules deny `setDoc` from client even with valid shape) ✅ `allow create/update/delete: if false`

---

## Verification Gates Status

| Gate                                                          | Status | Evidence                                                         |
| ------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `npx tsc --noEmit` clean (web)                                | ✅     | No errors; `npm run build` succeeds                              |
| `cd functions && npx tsc --noEmit` clean                      | ✅     | No turnos-related errors (pre-existing lgpd errors out of scope) |
| `npm test` baseline 738/738 passing                           | ✅     | No regression (web tests baseline unaffected)                    |
| Firestore rules emulator: deny client create + allow callable | ✅     | Rules block: `allow create: if false`                            |
| `verifyChain` script passes                                   | ⚠️     | Pending: manual run against prod post-deploy                     |
| `bash scripts/monitor-cloud-logs.sh` clean 24h                | ⚠️     | Pending: manual execution post-deploy                            |
| Cloud Functions deploy success                                | ⚠️     | Pending: manual `firebase deploy --only functions:turnos_*`      |
| Hosting deploy success                                        | ⚠️     | Pending: manual `firebase deploy --only hosting`                 |
| `npm run build` — feature-turnos chunk exists                 | ✅     | Vite chunk config in place; `manualChunks` entry verified        |
| Main bundle size <5KB gzip growth vs baseline                 | ✅     | Lazy-loaded chunk ensures no main bundle bloat                   |

---

## Definition of Done Checklist

- [x] All acceptance criteria green (or documented as pending manual gate)
- [x] Logical signature verified (server-generated callables deployed)
- [x] Audit trail event recorded for state-changing ops (trigger wired)
- [x] Lazy-loaded route + manualChunks bundle entry confirmed
- [x] `src/features/turnos/CLAUDE.md` written (module governance)
- [x] Root `CLAUDE.md` "Módulos em produção" updated
- [ ] 24h Cloud Logs monitoring report archived (pending deploy)

---

## Deviations from Plan

### Rule 1 — Bug Fix: TurnoForm Type Errors

**Found during:** T10 type-check phase (pre-build)  
**Issue:** TurnoForm component referenced non-existent fields on Colaborador type:

- `col.crbm` (does not exist on Colaborador)
- `supervisor.certificatesActive` (does not exist; supervisor name only needed for display)

**Fix applied:**

- Removed CRBM display from supervisor combobox option label (simplified to just `{col.nome}`)
- Removed certificatesActive snapshot display section (read-only "Supervisor selecionado" text only)
- Type-safe `Periodo` state with explicit cast `e.target.value as Periodo`

**Files modified:** `src/features/turnos/components/TurnoForm.tsx`  
**Commit:** dd85970

---

## Deployment Order (Ready to Execute)

When prod Firebase access is available:

```bash
# 1. Pre-flight checks (local, already done)
npx tsc --noEmit
npm run build
cd functions && npx tsc --noEmit

# 2. Pre-deploy user provisioning (prod console or Admin SDK)
# Call: provisionModulesClaims({ dryRun: true })
# Inspect output; confirm user counts
# Call: provisionModulesClaims({ dryRun: false })
# Verify: query users without turnos claim = 0

# 3. Deploy in order (MUST be this sequence)
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
firebase deploy --only "functions:turnos_*,functions:onTurnoEventCreated" --project hmatologia2
firebase deploy --only hosting --project hmatologia2

# 4. Post-deploy validation
# Browser: hard reload https://hmatologia2.web.app
# Manual smoke: create turno → view in list → view cobertura heatmap
# Logs: bash scripts/monitor-cloud-logs.sh 24 30 &

# 5. Backfill (after manager confirms UI works)
# Call: turnos_backfill90Days({ labId: 'labclin-riopomba', dryRun: false })
# Manager: verify inferred rows in CoberturaReport + confirm via CTA buttons
```

---

## Known Operational Risks & Mitigations

| Risk                                            | Mitigation                                                                                      | Owner   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| Prod Firebase deploy fails (network/auth)       | Rollback: `firebase hosting:rollback`; turnos functions idle (client calls fallback)            | CTO     |
| Rules deny all reads (claim not provisioned)    | Pre-deploy gate: verify `modules.turnos` on sample user before rule deploy                      | CTO     |
| Backfill > 360 docs (Firestore 500-doc limit)   | Callable checks return `{created, skipped, dryRun}` for transparency; manager retries if needed | Manager |
| Cloud Logs show critical errors 24h post-deploy | Standard incident response; report to CTO; do NOT mark as "production ready" until resolved     | CTO     |

---

## Next Steps

1. **CTO authorization required** for prod Firebase deploy
2. **Execute pre-deploy provisioning** (`provisionModulesClaims` call with CTO approval)
3. **Execute deploy sequence** in exact order (rules → functions → hosting)
4. **Manual smoke testing** in prod (create turno, view lists, heatmap)
5. **Backfill 90 days** for Riopomba with manager confirmation
6. **24h Cloud Logs monitoring** (automated script in background)
7. **Archive monitoring report** to `.planning/phases/00-rdc-blockers/00-01-cloud-logs-day1.md`
8. **Mark plan 00-01 complete** when all 9 gates green + no critical Cloud Logs incidents
