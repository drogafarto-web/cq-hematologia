---
phase: 0
milestone: v1.4
wave: 2
status: ready-for-execution
created: 2026-05-07
---

# Wave 2 Execution Brief — Phase 0 (Plans 00-03 & 00-04)

**Execution starts:** Upon Wave 1 completion + green `npm test` baseline (738/738) + hosting deploy success.

**Scope:** Two parallel streams executing Plans 00-03 (Lab Apoio) and 00-04 (Risks) in parallel with separate agents.

**Expected duration:** 4–5 days wall-clock (3.5 days + 2.5 days = 6 days estimation, parallelized to ~4–5 actual).

---

## Prerequisites (Wave 1 must complete with all green)

1. ✅ **Tests**: `npm test` passes 738/738 unit tests
2. ✅ **Type check**: `npx tsc --noEmit` zero errors (web + functions)
3. ✅ **Deploy**: Step 1 (Rules+Indexes) + Step 2 (Functions 78×) + Step 3 (Hosting) **LIVE** in production
4. ✅ **Baseline artifacts**: 
   - `src/features/turnos/` (complete, Plan 00-01 done)
   - `docs/policies/POL-LGPD-001-v1.0.pdf` + `IT-LGPD-DPIA-001-v1.0.pdf` (uploaded to Storage, Plan 00-02 done)
   - Firebase project `hmatologia2` accessible with southamerica-east1 region
5. ✅ **Dependencies resolved**: `turnos` callable pattern established; callables + triggers + cron available as templates in `functions/src/modules/turnos/`

---

## Stream A: Plan 00-03 — Lab Apoio Contracts

**Agent**: Single agent dedicated to this stream  
**Estimate**: 2.5 days (T1–T10 tasks)  
**Deliverables**: `labApoio` module (types + service + 5 callables + 1 trigger + 1 cron + UI)

### Execution Checklist: Plan 00-03

See detailed file: `.planning/phases/00-rdc-blockers/00-03-EXECUTION-CHECKLIST.md`

**Task dependencies (linear):**

- T1: Backfill REQ-416 → scaffold types/service (pre-requisite: REQ-416 authored ✓)
- T2: Implement callable validators + CNPJ checksum unit tests (depends on T1 types)
- T3: Create + softDelete + trigger (smoke script on emulator)
- T4: Update + avaliacao + upload (3 callables)
- T5: Expiry cron + email/notifications
- T6: Hooks + UI (5 components)
- T7: Rules + Storage rules + indexes + emulator tests
- T8: Shell integration (lazy route, Hub tile)
- T9: CLAUDE.md + root row + Obsidian checklist
- T10: Deploy (7 steps, claim provisioning first)

**Micro-dependencies to watch:**

- T2 depends on T1 types defined
- T3 depends on T2 validators + T1 service read-side
- T4 depends on T3 pattern (callable shape)
- T5 depends on T4 (contrato schema final)
- T6 depends on T1 types + T5 hooks ready
- T7 depends on all callables + trigger (scope frozen)
- T8 depends on T6 UI done
- T9 depends on T8 routing
- T10 depends on T9 docs updated

**Failure modes & escalation:**

- If T2 CNPJ validator fails: Review checksum algorithm (Mod-11 dual-check); escalate to CTO if algorithm ambiguous.
- If T3 trigger not firing: Check `firestore.indexes.json` deployed; check Cloud Functions logs in Firebase Console.
- If T5 cron not sending emails: Verify email service integration (may fall back to logging for MVP); escalate if email provider unreachable.
- If T7 rules reject legitimate reads: Check `isActiveMemberOfLab(labId)` propagation in all match blocks; escalate if cross-module RBAC broken.
- If T10 deploy fails: Roll back `functions/src/index.ts` last export block and re-run `firebase deploy --only functions`.

**Sign-off criteria (Agent to confirm):**

- ✅ `npm test` still passes 738/738 (no new failures)
- ✅ `npx tsc --noEmit` clean (web + functions)
- ✅ Emulator smoke test: all 5 callables + 1 trigger + 1 cron invoked successfully
- ✅ Firestore rules emulator pass (read/write/reject scenarios)
- ✅ Hub tile renders + lazy route loads
- ✅ Cloud Logs show no ERROR/CRITICAL in first 2 hours post-deploy

---

## Stream B: Plan 00-04 — Risks FMEA Register

**Agent**: Single agent dedicated to this stream  
**Estimate**: 3.5 days (T1–T10 tasks)  
**Deliverables**: `risks` module (ADR-0016 + types + service + 4 callables + 1 trigger + 1 cron + UI)

### Execution Checklist: Plan 00-04

See detailed file: `.planning/phases/00-rdc-blockers/00-04-EXECUTION-CHECKLIST.md`

**Task dependencies (linear):**

- T1: Author ADR-0016 (FMEA methodology) — CTO sign-off required
- T2: Scaffold types + service + NPR/nivel helpers (depends on T1 ADR finalized)
- T3: Implement callable validators (depends on T2 types)
- T4: Create + softDelete + trigger (depends on T3 validators)
- T5: Update + review mechanics (depends on T4)
- T6: Scheduled review cron + seedFromCsv stretch (depends on T5)
- T7: Hooks + matrix/top-5 derived data (depends on T2 types)
- T8: UI (RiskForm multi-step, RiskMatrix heatmap, Top5Widget) (depends on T7 hooks)
- T9: Rules + indexes + emulator tests (depends on all callables frozen)
- T10: Shell integration (lazy route, Hub tile, Top5 widget optional) (depends on T8 UI)
- T11: CLAUDE.md + ADR-0016 in index + Obsidian checklist
- T12: Deploy (mirroring Stream A)

**Micro-dependencies to watch:**

- T1 is blocker: ADR must be reviewed + accepted before T2 starts. If CTO unavailable: mark T1 done with `[PENDING CTO REVIEW]` comment and continue; escalate if blocking.
- T2 helpers (`computeNPR`, `deriveNivel`) unit-tested; pair with T3 validators to ensure server-side recompute logic matches frontend preview.
- T6 `seedFromCsv` is stretch task; if time-boxed, defer to v1.4 Phase 1 (document as backlog).
- T7 hooks: `useRiskMatrix` is computationally light (derive 5×5 grid from array); if performance concern, add memoization + lazy compute.

**Failure modes & escalation:**

- If T1 ADR delayed: CTO can provide verbal approval + mark ADR "ACCEPTED (provisional)"; continue. ADR review in next retro.
- If T3 validators overly strict: Re-read FMEA spec; ensure P/S/D ∈ [1,5], NPR = P×S×D, nivel derived per ADR-0016 thresholds.
- If T4 trigger not computing chainHash: Check `onRiskEventCreated` vs `onTurnoEventCreated` pattern (should be identical); test in emulator first.
- If T6 cron conflicts with labApoio cron: Stagger by 30min (labApoio 06:00, risks 07:00 BRT); update cron strings in both modules.
- If T9 rules reject lab member read: Verify `/labs/{labId}/risks/{riskId}` read rule includes `isActiveMemberOfLab(labId)`.
- If T12 deploy fails after both streams: Check for module-name collision in `functions/src/index.ts`; ensure distinct callable prefixes (`risks_*`, `labApoio_*`).

**Sign-off criteria (Agent to confirm):**

- ✅ ADR-0016 published + linked in `docs/adr/README.md`
- ✅ `npm test` still passes 738/738
- ✅ `npx tsc --noEmit` clean
- ✅ Emulator: all 4 callables + 1 trigger + 1 cron; FMEA heatmap renders
- ✅ `computeNPR` + `deriveNivel` tested with 5 edge cases each
- ✅ Risk Matrix 5×5 heatmap loads (mock data)
- ✅ Cloud Logs show no ERROR/CRITICAL in first 2 hours post-deploy

---

## Parallelization Notes

**Both streams independent on Wave 1 outputs**, but **NOT independent on each other**:

- ✅ **Can start simultaneously**: Both import `turnos` pattern only (read-side, observer); no direct coupling.
- ⚠️ **Careful on `functions/src/index.ts`**: Each stream adds a re-export block. Merge carefully (no cherry-picking); ensure both blocks present before final deploy.
- ⚠️ **Firestore rules**: Both streams add new match blocks. Merge carefully; verify no syntax errors via `firebase emulator:start --only firestore`.
- ⚠️ **Cloud Scheduler crons**: labApoio cron at 06:00, risks cron at 07:00 (stagger to avoid contention).
- ⚠️ **Firestore indexes**: Both may add composite indexes. Batch via `firebase deploy --only firestore:indexes` after both rules finalized.

**Merge gate (before deploy):**

1. **Type check both branches**: `npx tsc --noEmit` on merged code (web + functions)
2. **Run emulator**: `firebase emulator:start --only firestore` + smoke tests for both modules
3. **Run unit tests**: `npm test` — expect 738/738 + any new tests from both streams (should still pass)
4. **Lint functions**: `cd functions && npm run lint` (if enabled)
5. **Deploy sequence**: Rules → Indexes → Functions → Hosting (mirrors Step 1–3 from v1.3)

---

## Failure Recovery (per Phase 0 Risk Register)

| Risk ID | Trigger | Escalation | Mitigation |
|---------|---------|-----------|-----------|
| P0-R1 | Lab Apoio contracts template wrong | P0-R1 in Stream A docs | Disclaimer banner at form step 1; Phase 1 week 2 review scheduled |
| P0-R2 | FMEA methodology change request mid-execution | ADR-0016 objection from CTO | Escape hatch in ADR: "ISO 31000 v1.5 if feedback warrants" |
| P0-R3 | Turnos supervisor not active in educacao | Turnos callable validation | Validation pre-check in callable; error message guides user |
| P0-R4 | Risk seed data incomplete | CSV importer stretch task | Mark stretch; ship without seed; backlog for v1.4 Phase 1 |
| P0-R5 | LGPD policies not reviewed by compliance | Plan 00-02 sign-off | CTO can self-approve; escalate if external counsel required |
| P0-R6 | Callable pattern breaks under load | Emulator smoke test | Emulator test non-binding; scale test post-Phase 0 (Phase 1 week 3) |

---

## Expected Artifacts Post-Execution

**Stream A (Lab Apoio):**

- `src/features/lab-apoio/` (types, service, hooks, components) — ~2,500 LOC
- `functions/src/modules/labApoio/` (callables, validators, trigger, cron) — ~1,200 LOC
- `firestore.rules` + `storage.rules` blocks updated
- `firestore.indexes.json` updated with 2 composite indexes
- Hub tile + lazy route registered
- Unit tests: ~200 LOC (CNPJ validator, signature, audit event chain)

**Stream B (Risks):**

- `docs/adr/0016-fmea-lite-methodology.md` — ~400 words
- `src/features/risks/` (types, service, hooks, components) — ~3,000 LOC
- `functions/src/modules/risks/` (callables, validators, trigger, cron) — ~1,400 LOC
- `firestore.rules` blocks updated
- `firestore.indexes.json` updated with 2 composite indexes
- Hub tile + lazy route registered
- Unit tests: ~250 LOC (computeNPR edge cases, nivel derivation, review mechanics)

**Cross-module:**

- `functions/src/index.ts` updated (both module re-exports)
- `src/AppRouter.tsx` updated (2 new lazy routes)
- `src/types/index.ts` updated (`View` union +2 values)
- `src/features/hub/ModuleHub.tsx` updated (2 new tiles)
- `CLAUDE.md` (root) updated (2 new rows in "Módulos em produção" table)
- `.planning/milestones/v1.4-REQUIREMENTS.md` backfilled (REQ-416 at minimum)

**Total new code**: ~8,500 LOC (web + functions + tests + docs)

---

## Skills Invoked (in order)

Per each stream (parallel):

1. **hcq-module-generator** — scaffold both modules (Wave 1 output: turnos pattern; Wave 2: adapt for labApoio + risks)
2. **hcq-firestore-rules-generator** — rules blocks for both (after callables scope frozen)
3. **hcq-ciq-audit-trail** — chainHash conventions (verify labApoio + risks trigger mirrors turnos)
4. **hcq-deploy-gates** — pre-merge gate check (type-check, test, lint, secrets scan, emulator)

---

## Go/No-Go Decision

**Green to execute Wave 2:**

- ✅ Wave 1 (Plans 00-01 + 00-02) **COMPLETE** with `npm test 738/738` + deploy success
- ✅ `functions/src/modules/turnos/` serves as canonical template (readable, not modified by Wave 2)
- ✅ Both PLAN.md files (00-03, 00-04) finalized + CTO sign-off
- ✅ Two agents assigned + execution briefs ready

**Red/Stop execution:**

- ❌ Wave 1 tests fail (any regression)
- ❌ ADR-0016 stuck in review >4 hours (CTO unavailable)
- ❌ Firebase project region not `southamerica-east1` (incompatible with existing functions)

---

**Last updated:** 2026-05-07 21:30 UTC  
**Prepared by:** Agent (pre-execution brief generation)
