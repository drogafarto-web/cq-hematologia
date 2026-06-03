---
phase: 0
plan: 00-01
slug: turnos-supervisor-shift
wave: 1
depends_on: []
estimate_days: 1.5
req_ids: [REQ-403]
risk_ids: [RISK-403, P0-R3, P0-R6, RISK-409]
compliance: [RDC 978 Art. 122, RDC 786, DICQ 4.1.2.7]
modules_touched: [turnos, educacao-continuada (read-only), shell, functions]
callable: true
last_updated: 2026-05-07
locked_decisions: [DL-1]
---

# Phase 0 / Plan 00-01 — Turnos: Supervisor Shift Registry

## Goal

Manager can register the supervising professional for every shift (manhã / tarde / noite / plantão), and an auditor can answer "quem supervisionou em [data] [turno]" for the last 90 days in one click — with chainHash-validated audit trail and tamper-evident logical signatures from day 1 (DL-1: callable from day 1).

## Compliance citation

- **RDC 978/2025 Art. 122**: "Todo laboratório deve ter responsável técnico legalmente habilitado, com supervisão presencial documentada por turno."
- **DICQ 4.1.2.7**: "Designação formal do responsável pela qualidade."
- **RDC 786/2023**: Differentiation between profissional legalmente habilitado (RT) and profissional capacitado (operator).

## Locked decision applied

**DL-1 — Callable from day 1.** All state-changing writes to `/labs/{labId}/turnos/` and to `/labs/{labId}/turnos/{id}/events/` ship as Cloud Function callables (`turnos_createTurno`, `turnos_updateTurno`, `turnos_softDeleteTurno`, `turnos_backfill90Days`). Service client-side has read-only `subscribeTurnos` + `getTurno`. `firestore.rules` declares `allow create, update, delete: if false` for the collection; chainHash continuity is the auditor's tamper evidence.

## Files affected

### New

- `src/features/turnos/CLAUDE.md` — module-level rules (RN-TURNO-01..05; multi-tenant path; integration with shell; pendências)
- `src/features/turnos/types/Turno.ts` — `Turno`, `Periodo`, `TurnoInput` (DTO via `Omit`), `TurnoFilters`, `TurnoAuditEvent`, `LogicalSignature` reuse from `src/utils/logicalSignature.ts`
- `src/features/turnos/services/turnosService.ts` — read-only client: `subscribeTurnos(labId, opts, cb, onErr)` + `getTurno(labId, id)` + `mapSnapshotToTurno`. **No client-direct create/update/delete.** Mutations are wrappers around `httpsCallable` (`callCreateTurno`, `callUpdateTurno`, `callSoftDeleteTurno`, `callBackfill90Days`), each with `unwrapCallableError` translating `FirebaseError` → readable Error.
- `src/features/turnos/hooks/useTurnos.ts` — mirrors `useColaboradores.ts` (canonical). `useActiveLabId()` guard; `onSnapshot` with cleanup; mutations call callables and throw without lab. Validates `supervisorId` exists in active `colaboradores` (read-only check via `useColaboradores`); validates `certificatesActive` snapshot has at least one habilitação ativa.
- `src/features/turnos/hooks/useCoberturaTurnos.ts` — derives heatmap data from `turnos[]` for last 90 days (missing-shift detection per data × periodo).
- `src/features/turnos/components/TurnoForm.tsx` — create/edit modal: date picker (`<input type="date">`), period selector (`select` with 4 options), supervisor combobox (filters `colaboradores` where `ativo === true`), `certificatesActive[]` snapshot autopopulated from selected supervisor, `observacoes` textarea (max 500 chars). Uses `_formPrimitives` from EC for `Field` / `inputClass` if extracting; otherwise inline.
- `src/features/turnos/components/TurnosList.tsx` — dark-first table, `tabular-nums` on data column, filters (data range, periodo, supervisor), sort by `data DESC`. Empty state. Skeleton during `isLoading`.
- `src/features/turnos/components/CoberturaReport.tsx` — auditor view: 90-day heatmap (rows = data, cols = periodo), color-coded (emerald = registered, red = missing, amber = `inferred: true` pending confirmation), click cell to filter list. Includes "Confirmar inferida" inline action.
- `src/features/turnos/components/TurnosView.tsx` — entry point: topbar (← Hub button + title + lab badge), KPI strip (total 90d, missing 90d, inferred pending), filters, tabs `[Lista | Cobertura]`.
- `functions/src/modules/turnos/index.ts` — barrel re-exports.
- `functions/src/modules/turnos/validators.ts` — Zod schemas (`CreateTurnoInputSchema`, `UpdateTurnoInputSchema`, `SoftDeleteTurnoInputSchema`, `Backfill90DaysInputSchema`) + `assertTurnosAccess(auth, labId)` (claim `modules['turnos']` + active member of `labs/{labId}/members/{uid}`) + `turnosCollection(labId)` + `ensureTurnosLabRoot(labId)`.
- `functions/src/modules/turnos/signatureCanonical.ts` — server-side SHA-256 canonical hash (mirror of `controleTemperatura/signatureCanonical.ts`); `generateTurnosSignatureServer({labId, data, periodo, supervisorId, ts})` returns `{ hash, operatorId, ts }`.
- `functions/src/modules/turnos/createTurno.ts` — `turnos_createTurno` callable: assertTurnosAccess → re-read supervisor `colaboradores/{id}` (must exist + `ativo=true`) → derive `supervisorName` + `supervisorCRBM` snapshot → derive `certificatesActive[]` from active habilitações → generate signature → atomic writeBatch (turno + audit event with chainHash).
- `functions/src/modules/turnos/updateTurno.ts` — `turnos_updateTurno`: similar, only allows editing `observacoes` + `supervisorName` correction (post-backfill `inferred: true` confirmation flow); rebuilds signature; appends audit event with `changes` diff.
- `functions/src/modules/turnos/softDeleteTurno.ts` — `turnos_softDeleteTurno`: sets `deletadoEm = serverTimestamp()`; appends `softdeleted` audit event with chainHash continuity (resolves OPEN question per CONTEXT.md).
- `functions/src/modules/turnos/backfill90Days.ts` — `turnos_backfill90Days({labId, dryRun?: boolean})` admin-only callable: queries `colaboradores` for default supervisor inference (highest `criadoEm` with `ativo=true` matching shift defaults from `labSettings`), creates inferred turnos for last 90 days × 4 periods (max 360 docs), each flagged `inferred: true`. Idempotent (skips dates+periodo already present). Returns `{created, skipped, dryRun}`.
- `functions/src/modules/turnos/onTurnoEventCreated.ts` — Firestore trigger `onDocumentCreated('labs/{labId}/turnos/{turnoId}/events/{eventId}')` computes `chainHash = SHA-256(prevChainHash || canonicalEventPayload)`; persists back via Admin SDK update. Mirrors `hcq-ciq-audit-trail` skill output.

### Modified

- `functions/src/index.ts` — add `// ─── turnos module (Phase 0 — 2026-05-07)` block re-exporting the 5 callables + 1 trigger. Region inherited from `setGlobalOptions({region:'southamerica-east1'})`.
- `firestore.rules` — new block `match /labs/{labId}/turnos/{turnoId}` (read: `isActiveMemberOfLab(labId)`; create/update/delete: `if false`); subcollection `events/{eventId}` (read: lab member; create/update/delete: `if false`). Helper `isValidTurno` declared but unused for v1 (defense in depth for any future client-direct path).
- `firestore.indexes.json` — composite index `(labId, data DESC, periodo)` for the cobertura query; composite `(labId, supervisorId, data DESC)` for per-supervisor history.
- `functions/scripts/provision-modules-claims.ts` (or equivalent) — extend module-claims list to include `'turnos'` so the existing `provisionModulesClaims` callable grants access on next run. **Pre-deploy step:** run `provisionModulesClaims({dryRun:false})` granting `modules.turnos = fullAccess()` to all active users BEFORE deploying rules (CLAUDE.md fail-safe rule).
- `vite.config.ts` — add `manualChunks` entry: `'feature-turnos': [/src\/features\/turnos\//]`.
- `src/AppRouter.tsx` (or `auth/AuthWrapper.tsx`) — register lazy route `'turnos'` → `<TurnosView />` via `React.lazy(() => import('../features/turnos/components/TurnosView'))` + `Suspense` fallback.
- `src/types/index.ts` — extend `View` union with `'turnos'`.
- `src/features/hub/ModuleHub.tsx` — new tile `turnos` (status: active; view: `'turnos'`; SVG inline icon `currentColor`, e.g. clock+person; hover glow per DESIGN_SYSTEM).
- `CLAUDE.md` (root) — add new row in "Módulos em produção" table: `| turnos | Em prod · Registro de supervisão de turnos (RDC 978 Art. 122 + RDC 786) | YYYY-MM-DD |`.
- `package.json` (functions) — no new dep; uses existing `firebase-admin`, `firebase-functions`, `zod`.

## Tasks (atomic, ordered)

### T1. Scaffold types + service skeleton (read-only)

**Outcome:** `src/features/turnos/types/Turno.ts` + `services/turnosService.ts` exist; types match the schema in PHASE-0-PLAN Task 1; service exports `subscribeTurnos`, `getTurno`, `mapSnapshotToTurno`, plus typed callable wrappers (`callCreateTurno`, `callUpdateTurno`, `callSoftDeleteTurno`, `callBackfill90Days`) implemented as `httpsCallable` wrappers (no Firestore writes).
**Files:** types/Turno.ts, services/turnosService.ts, services/turnosCallables.ts (or co-located).
**Steps:**

1. Invoke `Skill hcq-module-generator` for `turnos` (read-only mode — no create/update in service).
2. Define `Turno`, `TurnoInput = Omit<Turno, 'id'|'labId'|'criadoEm'|'deletadoEm'|'logicalSignature'|'inferred'>`, `Periodo = 'manha'|'tarde'|'noite'|'plantao'`, `TurnoAuditEvent` (mirror SGQ `DocumentoAuditEvent`).
3. Implement `subscribeTurnos(labId, {from, to, periodo?, supervisorId?, includeInferred?, includeDeleted?}, cb, onErr)` with `onSnapshot` + filter of `deletadoEm` client-side.
4. Implement `httpsCallable` wrappers + `unwrapCallableError`.
   **Verification:** `npx tsc --noEmit` clean; `import` from a throwaway test file resolves.

### T2. Implement callable scaffold (validators + signatureCanonical + index)

**Outcome:** `functions/src/modules/turnos/{validators,signatureCanonical,index}.ts` exist; Zod schemas + access guard + canonical SHA-256 in place; nothing wired yet.
**Files:** functions/src/modules/turnos/{validators,signatureCanonical,index}.ts.
**Steps:**

1. Mirror `functions/src/modules/controleTemperatura/validators.ts`: `assertTurnosAccess`, `turnosCollection(labId)`, `ensureTurnosLabRoot(labId)`, Zod schemas (strict — no extra keys; `data` as ISO string coerced to `Timestamp`; `periodo` enum; `supervisorId` non-empty string).
2. Mirror `functions/src/modules/controleTemperatura/signatureCanonical.ts`: `node:crypto.createHash('sha256')` over `sortedStringify({labId, data, periodo, supervisorId, tsMillis})`.
3. Barrel re-exports.
   **Verification:** `cd functions && npx tsc --noEmit` clean.

### T3. Implement `turnos_createTurno` + audit trail trigger

**Outcome:** end-to-end create path works in emulator: callable validates input → re-reads supervisor → snapshots `certificatesActive` → generates signature → atomic batch writes turno + audit event → trigger computes chainHash and persists.
**Files:** createTurno.ts, onTurnoEventCreated.ts, functions/src/index.ts.
**Steps:**

1. Implement `turnos_createTurno` per spec above; on failure, throw `HttpsError('failed-precondition', ...)` with PT-BR message.
2. Implement `onTurnoEventCreated` trigger (Firestore v2 onDocumentCreated). Read prev event by ordering audit subcoleção `where(documentoId == this.documentoId).orderBy('timestamp','desc').limit(2)`; compute chainHash; update.
3. Wire in `functions/src/index.ts`.
4. Invoke `Skill hcq-ciq-audit-trail` for chainHash conventions (event types: `created`, `updated`, `softdeleted`, `backfilled`).
   **Verification:** Emulator smoke — call `turnos_createTurno` with valid payload via Admin SDK script in `functions/scripts/smoke-turnos-callables.mjs` (mirror EC smoke); inspect created doc + audit event has chainHash within 2s.

### T4. Implement `turnos_updateTurno`, `turnos_softDeleteTurno`, `turnos_backfill90Days`

**Outcome:** all 4 callables operational. Backfill is idempotent (re-runs do not duplicate).
**Files:** updateTurno.ts, softDeleteTurno.ts, backfill90Days.ts, functions/src/index.ts.
**Steps:**

1. Update flow: only `observacoes` + `supervisorName` editable post-creation (other fields force a softDelete + recreate flow, enforced server-side).
2. SoftDelete: writes `deletadoEm = Timestamp.now()` + emits `softdeleted` audit event (chainHash continuity per CONTEXT.md OPEN resolution).
3. Backfill: read `colaboradores` (active), pick default supervisor (`labSettings.defaultSupervisorId` if set, else most recent active), iterate last 90 days × 4 periods, skip existing `(data, periodo)` tuples, batch in chunks of 100 (Firestore limit 500). Returns `{created, skipped, dryRun}`. Admin role required.
4. Extend smoke script with 4 more cases (update happy, softDelete idempotent, backfill dry-run, backfill apply twice idempotent).
   **Verification:** Smoke script all green; emulator verifies idempotency (second backfill creates 0 docs).

### T5. Write Firestore rules + indexes; deploy emulator test

**Outcome:** rules emulator confirms (a) authenticated lab member can READ turnos, (b) cannot CREATE/UPDATE/DELETE client-direct, (c) callable Admin SDK bypass works (test via emulator running both callable + rules).
**Files:** firestore.rules, firestore.indexes.json, functions/test/turnos/rules.test.mjs (new), functions/scripts/smoke-turnos-callables.mjs (extended).
**Steps:**

1. Invoke `Skill hcq-firestore-rules-generator` with input: collection `turnos`; convention DL-1 (write deny client). Generated block must include the events subcollection.
2. Add 2 composite indexes (see "Modified" above).
3. Write rules emulator test (`@firebase/rules-unit-testing`) covering: read by member ✅, read by non-member ❌, create by member ❌ (DL-1), create by Admin SDK token ✅, delete by anyone ❌.
   **Verification:** `firebase emulators:exec --only firestore "node functions/test/turnos/rules.test.mjs"` green; `npm test` baseline 738/738 still green.

### T6. Build hooks + UI components

**Outcome:** TurnosView, TurnosList, TurnoForm, CoberturaReport, useTurnos, useCoberturaTurnos all wired and rendering against emulator data; dark-first per DESIGN_SYSTEM.
**Files:** hooks/useTurnos.ts, hooks/useCoberturaTurnos.ts, components/TurnosView.tsx, components/TurnosList.tsx, components/TurnoForm.tsx, components/CoberturaReport.tsx.
**Steps:**

1. `useTurnos` — copy `useColaboradores` shape; replace mutations with callable wrappers; return type `UseTurnosResult` mirrors `UseColaboradoresResult`.
2. `useCoberturaTurnos` — derive `Map<dateISO, Map<periodo, TurnoCoverageStatus>>` for last 90 days; status enum `'registered' | 'inferred' | 'missing' | 'multiple'`.
3. `TurnoForm` — `<input type="date">` for `data`; `<select>` for `periodo`; supervisor combobox filtered by `colaboradores.ativo === true` (consume via `useColaboradores({somenteAtivos: true})`); 500-char counter on `observacoes`; submit via `useTurnos.create`.
4. `TurnosList` — sortable table `Data | Período | Supervisor | CRBM | Inferida? | Observações | Ações`; `tabular-nums` on Data; filters (date range, periodo, supervisor); empty state copy in pt-BR.
5. `CoberturaReport` — `<table>` with 90 rows × 4 cols; cells use bg color tokens (`bg-emerald-500/15`, `bg-red-500/15`, `bg-amber-500/15`); inline "Confirmar inferida" CTA opens TurnoForm in edit mode prefilled.
6. `TurnosView` — sticky topbar, KPI strip (3 stats), tabs `[Lista | Cobertura]`, drawer for create/edit.
   **Verification:** `npm run dev`; manual smoke (page renders against emulator, can create + see in list + see in heatmap); `npx tsc --noEmit` clean.

### T7. Wire shell integration + lazy route + manualChunks

**Outcome:** `View = 'turnos'` reachable from `/hub` tile; lazy chunk verified in `npm run build` output.
**Files:** src/types/index.ts, src/AppRouter.tsx (or auth/AuthWrapper.tsx), src/features/hub/ModuleHub.tsx, vite.config.ts.
**Steps:**

1. Add `'turnos'` to `View` union.
2. Add lazy route + Suspense fallback in shell.
3. Add Hub tile (SVG inline; status `active`; click navigates to `'turnos'`).
4. Add `manualChunks['feature-turnos']` entry in `vite.config.ts`.
   **Verification:** `npm run build` succeeds; output contains a chunk named `feature-turnos-*.js`; `dist/assets` size delta <50KB gzip for the new chunk (per `.claude/rules/performance.md`); main bundle does NOT grow.

### T8. Write module CLAUDE.md + update root CLAUDE.md

**Outcome:** module governance doc exists; root table updated.
**Files:** src/features/turnos/CLAUDE.md, CLAUDE.md (root).
**Steps:**

1. Mirror `src/features/sgq/CLAUDE.md` structure: scope exclusivo, refs regulatórias, multi-tenant, RN-TURNO-01..05 (RN-01: turno único por (labId, data, periodo) entre não-deletados; RN-02: supervisor ativo; RN-03: `certificatesActive` snapshot imutável após criação; RN-04: soft-delete only; RN-05: chainHash contínuo no audit trail).
2. Add status row in root `CLAUDE.md` table.
   **Verification:** Both files written; markdown links valid (no broken refs).

### T9. Pre-deploy: claim provisioning + dry-run backfill

**Outcome:** all active users have `modules.turnos = fullAccess()` claim before rules deploy. Backfill `dryRun: true` confirms expected `created` count for Riopomba.
**Files:** N/A (operational step).
**Steps:**

1. Extend `provisionModulesClaims` to include `'turnos'` if not generic.
2. Run `provisionModulesClaims({dryRun: true})` then `({dryRun: false})` against prod (admin token).
3. Query `users` for any active 30d-user without `modules.turnos` — must be 0.
4. Run `turnos_backfill90Days({labId: 'labclin-riopomba', dryRun: true})` and report counts to CTO for confirmation.
   **Verification:** CTO ack on dry-run output; query returns 0 unclaimed users.

### T10. Deploy in order; run Cloud Logs monitor

**Outcome:** rules + functions + hosting deployed in canonical order; 24h Cloud Logs monitoring kicked off.
**Files:** N/A (deploy commands).
**Steps:**

1. `npx tsc --noEmit` (web) + `cd functions && npx tsc --noEmit` clean.
2. `npm run build` (web) clean.
3. `firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2`.
4. `firebase deploy --only "functions:turnos_*,functions:onTurnoEventCreated" --project hmatologia2`.
5. `firebase deploy --only hosting --project hmatologia2`.
6. Hard-reload prod browser; smoke create + read + cobertura.
7. Run `bash scripts/monitor-cloud-logs.sh 24 30` (or `.ps1` on Windows) in background; review report.
8. Apply backfill `({dryRun: false})` on Riopomba; manager confirms inferred rows in Week 1 via CoberturaReport CTA.
   **Verification:** Deploy logs clean; smoke checklist green; Cloud Logs report shows 0 critical incidents 24h post-deploy.

## Acceptance criteria

(Verbatim from PHASE-0-PLAN Task 1 + DL-1 additions; nothing dropped.)

- [ ] Manager can register supervisor per shift in <30s (single-screen form).
- [ ] Auditor can query shift coverage history (last 90d, custom range, by supervisor).
- [ ] All shifts in last 90 days have a registered supervisor (post-backfill, with `inferred: true` flag for manager review).
- [ ] Logical signature validates (`verifyChain` script passes, server-generated, no client-side hash forging possible).
- [ ] Firestore rules emulator test passes: read by member ✅, write client-direct ❌ (DL-1), Admin SDK callable bypass ✅, delete by anyone ❌.
- [ ] List view loads <200ms with 90 days of data (≈270 rows).
- [ ] **DL-1 observable:** rules deny `setDoc` from a real client SDK against `/labs/.../turnos/...` even with a valid `validSignature()` shape (test from a fresh emulator session).
- [ ] Audit chain (chainHash) is unbroken across the 90 backfilled rows + every subsequent operation (verify via `verifyChain` script — Plan 00-04 reuses this script).

## Verification gates (pre-execute → post-execute)

- [ ] `npx tsc --noEmit` clean (web)
- [ ] `cd functions && npx tsc --noEmit` clean
- [ ] `npm test` baseline 738/738 passing (no regression)
- [ ] Firestore rules emulator: deny direct client create + allow callable Admin SDK write
- [ ] `verifyChain` script passes (audit trail integrity, last 90d backfill + smoke ops)
- [ ] `bash scripts/monitor-cloud-logs.sh` clean post-deploy (24h baseline)
- [ ] Cloud Functions deploy success (5 callables + 1 trigger named `turnos_*` + `onTurnoEventCreated`)
- [ ] Hosting deploy success
- [ ] `npm run build` produces a `feature-turnos` chunk; main bundle does NOT grow >5KB gzip vs baseline

## Risk hooks

- **P0-R3 (backfill data gaps):** `inferred: true` flag + UI banner + manager confirmation flow within Week 1; auditor accepts inferred + confirmed.
- **P0-R6 (perf regression):** lazy route + manualChunks entry; Lighthouse CI on `/hub` after deploy must show no regression on LCP / INP / CLS.
- **RISK-409 (regression in v1.3 modules):** zero edits to existing module callables/rules; `npm test` 738/738 baseline; hard reload + smoke of 3 random v1.3 flows (CIQ run, EC dashboard, controle-temperatura) post-deploy.
- **RISK-403 (P0 closure):** auditor demonstration script in module CLAUDE.md ("dado um turno hoje, mostrar quem supervisionou + cadeia de auditoria").

## Skills to invoke (execution time)

- `hcq-module-generator` — scaffold types + service + hook + components (T1, T6)
- `hcq-firestore-rules-generator` — rules block (T5)
- `hcq-ciq-audit-trail` — events subcoleção + chainHash trigger (T3)
- `hcq-deploy-gates` — pre-merge + pre-deploy gate (T10)

## Definition of done

- All acceptance criteria green
- Logical signature verified on at least one sample write (server-generated)
- Audit trail event recorded for every state-changing operation (create/update/softDelete/backfill)
- Lazy-loaded route + manualChunks bundle entry confirmed in `npm run build` output
- `src/features/turnos/CLAUDE.md` written
- Root `CLAUDE.md` "Módulos em produção" updated with `turnos` row
- 24h Cloud Logs monitoring report archived to `.planning/phases/00-rdc-blockers/00-01-cloud-logs-day1.md`

## Notes (plan-specific)

- This plan establishes the **Wave 1 → Wave 2 inheritance pattern**. The `functions/src/modules/turnos/{validators,signatureCanonical,index}.ts` shape, the rules block format, the `onTurnoEventCreated` trigger, and the callable wrappers in the service layer become the canonical templates copied (with renames) by Plans 00-03 (lab-apoio) and 00-04 (risks). Quality of this plan directly impacts Wave 2 throughput.
- Reuse `useColaboradores` for supervisor combobox — do NOT re-fetch `colaboradores` directly in `useTurnos`. Decoupling preserves the EC module boundary.
- Period strings are pt-BR (`'manha' | 'tarde' | 'noite' | 'plantao'`); UI labels via `PERIODO_LABEL` map. No accents in enum values (matches EC convention).
- `certificatesActive[]` is a **snapshot at shift time** (not a live FK). The callable copies the IDs from the supervisor's current habilitações; a later edit of the supervisor's habilitações must NOT retroactively change the snapshot. RN-03 enforced server-side.
- Soft delete on a turno must NOT cascade to its audit subcoleção — the chain stays append-only; instead, a `softdeleted` event is appended with chainHash continuity.
