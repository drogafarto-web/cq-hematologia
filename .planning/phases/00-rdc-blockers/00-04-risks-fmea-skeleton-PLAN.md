---
phase: 0
plan: 00-04
slug: risks-fmea-skeleton
wave: 2
depends_on: ["00-01", "00-02"]
estimate_days: 3.5
req_ids: [REQ-412]
risk_ids: [RISK-403, P0-R2, P0-R4, P0-R6, RISK-409]
compliance: [DICQ 4.14.6, ISO 15189 §8.5, RDC 978 Art. 86 (componente 2)]
modules_touched: [risks, labSettings (read), educacao-continuada (read), shell, functions]
callable: true
last_updated: 2026-05-07
locked_decisions: [DL-1]
---

# Phase 0 / Plan 00-04 — Risks: FMEA-Lite Risk Register

## Goal

Living risk register with FMEA-lite scoring (Probabilidade × Severidade × Detecção, NPR 1–125), 5×5 heatmap, periodic review automation (annual + monthly for top-5 critical), and treatment tracking. ADR-0016 documents the methodology choice with a v1.5 escape hatch (P0-R2). All state-changing writes via Cloud Function callables from day 1 (DL-1). Foundation for v1.4 Phase 4 (CAPA) and Phase 13 (Final DICQ Audit).

## Compliance citation

- **DICQ 4.14.6**: "Gestão de risco — identificação, análise, avaliação, tratamento, monitoramento."
- **ISO 15189:2022 §8.5**: Actions to address risks and opportunities.
- **RDC 978/2025 Art. 86**: PGQ — gerenciamento dos riscos é componente 2 obrigatório.

## Locked decisions applied

**DL-1 — Callable from day 1.** Callables: `risks_createRisk`, `risks_updateRisk`, `risks_softDeleteRisk`, `risks_registrarRevisao`, `risks_seedFromCsv` (admin-only, optional). Service: read-only `subscribeRisks` + `getRisk`. `firestore.rules` declares `allow create, update, delete: if false` + an `isValidRisk` helper kept (defense in depth, unused while client-direct denied).

This plan **inherits** the Wave 1 callable + audit-chain pattern from Plan 00-01 and the SGQ cross-link pattern from Plan 00-02.

## Files affected

### New

- `docs/adr/0016-fmea-lite-methodology.md` — ADR documenting NPR formula (P × S × D), nivel thresholds (configurable per lab via `labSettings`), escape hatch ("refine to ISO 31000 in v1.5 if Riopomba feedback warrants"), rationale (FMEA familiarity in clinical labs, simplicity vs ISO 31000 maturity, alignment with REQ-412 acceptance). Author: CTO. Status: accepted.
- `src/features/risks/CLAUDE.md` — module rules (RN-RISK-01..08: codigo unique per lab, P/S/D in 1..5, NPR == P*S*D, nivel derived, status enum, reviewDate >= criadoEm, monthly auto-review for NPR>=100, soft-delete only).
- `src/features/risks/types/Risk.ts` — `Risk`, `RiskInput`, `Tratamento`, `Acao`, `Revisao`, `RiskFilters`, `RiskAuditEvent`, `Probabilidade = 1|2|3|4|5`, `Severidade = 1|2|3|4|5`, `Deteccao = 1|2|3|4|5`, `Nivel = 'baixo'|'medio'|'alto'|'critico'`, `Categoria` enum, `Processo` enum, `Status` enum. Schema verbatim from PHASE-0-PLAN Task 4.
- `src/features/risks/services/risksService.ts` — read-only `subscribeRisks(labId, opts, cb, onErr)` + `getRisk(labId, id)` + `mapSnapshotToRisk` + helpers `computeNPR(p,s,d)`, `deriveNivel(npr, thresholds)`. Plus `httpsCallable` wrappers for callables.
- `src/features/risks/services/riskCsvImportService.ts` — optional CSV import for the 10–15 known risks seed (data leak, CIQ failure, equipment downtime, RT absence, contract expiry, etc.). Parses CSV into `RiskInput[]` and posts batch via `risks_seedFromCsv`. **Stretch task** per P0-R4.
- `src/features/risks/hooks/useRisks.ts` — mirrors `useColaboradores.ts`.
- `src/features/risks/hooks/useRiskMatrix.ts` — derives 5×5 grid `Map<probability, Map<severity, Risk[]>>` for heatmap rendering.
- `src/features/risks/hooks/useTopRisks.ts` — derives top-5 by NPR (filter `status != 'fechado'`, sort `npr DESC`).
- `src/features/risks/components/RisksView.tsx` — entry: topbar, KPI strip (total ativos, criticos, alto, em tratamento, vencendo revisão), tabs `[Registro | Matriz | Top 5 | Revisões]`.
- `src/features/risks/components/RiskRegister.tsx` — sortable/filterable table: `Codigo | Descricao (truncated) | Processo | Categoria | NPR | Nivel | Status | Owner | Próx. revisão | Ações`. `tabular-nums` on numeric columns. Sorting by NPR default.
- `src/features/risks/components/RiskForm.tsx` — multi-step form: (1) Descrição (codigo auto-suggested via `sugerirProximoCodigo`-style helper, descricao 50-500 chars, processo, categoria), (2) Análise FMEA (P/S/D scrubbers 1–5 with semantic labels; live NPR + nivel preview), (3) Tratamento (estrategia enum, ações repeater with prazo/owner/status), (4) Owner + reviewDate.
- `src/features/risks/components/RiskMatrix.tsx` — 5×5 SVG heatmap (rows=Severidade, cols=Probabilidade); each cell shows count of risks at that (P,S) intersection; color by max-NPR in cell (emerald/amber/orange/red per nivel thresholds); click cell to filter `RiskRegister`.
- `src/features/risks/components/RiskReviewModal.tsx` — periodic review form: data, revisor (combobox), resultado (`mantido|reduzido|reclassificado|fechado`), observacoes, `nprPrevio` (read-only), `nprNovo` (recomputed if reclassificado).
- `src/features/risks/components/Top5RisksWidget.tsx` — dashboard widget; can be embedded into `/hub` (optional follow-up).
- `functions/src/modules/risks/index.ts` — barrel.
- `functions/src/modules/risks/validators.ts` — Zod + assertRisksAccess + collection helper + `validateNPR(p,s,d,npr)` (ensures `npr === p*s*d`).
- `functions/src/modules/risks/signatureCanonical.ts` — mirror of Plan 00-01 / 00-03.
- `functions/src/modules/risks/createRisk.ts` — `risks_createRisk`: assertAccess → validate → enforce `codigo` uniqueness within lab (RN-RISK-01) via re-read → compute NPR + nivel server-side (do NOT trust client) → derive `reviewDate = criadoEm + 365d` → atomic batch (risk + audit `created`).
- `functions/src/modules/risks/updateRisk.ts` — `risks_updateRisk`: P/S/D mutation triggers NPR + nivel recompute server-side; `tratamento.acoes[]` is history-preserving append; status transitions (`aberto → mitigando → monitorado → fechado`) enforced server-side.
- `functions/src/modules/risks/softDeleteRisk.ts` — `risks_softDeleteRisk({riskId, motivo})`: only allowed if `status != 'fechado'` (closed risks preserve evidence forever); writes `deletadoEm` + audit `softdeleted` event.
- `functions/src/modules/risks/registrarRevisao.ts` — `risks_registrarRevisao({riskId, revisao})`: append-only on `reviewHistory[]`; if `resultado === 'reclassificado'`, server recomputes NPR/nivel from new P/S/D in payload; if `resultado === 'fechado'`, sets `status = 'fechado'` + `reviewDate = null`; updates `reviewDate = revisao.data + 365d` otherwise; audit event `revisao-registrada`.
- `functions/src/modules/risks/seedFromCsv.ts` — `risks_seedFromCsv({labId, rows: RiskInput[]})` admin-only; rejects if collection non-empty (idempotent first-run only); batches in chunks of 100. **Stretch.**
- `functions/src/modules/risks/scheduledReview.ts` — daily 07:00 BRT cron: query risks where `reviewDate <= today AND status != 'fechado' AND deletadoEm == null` → notification per risk; additional monthly check (1st of month) for `npr >= 100 AND status != 'fechado'` flagging top-5 for monthly review even if reviewDate not reached.
- `functions/src/modules/risks/onRiskEventCreated.ts` — chainHash trigger.

### Modified

- `functions/src/index.ts` — re-export 5 callables + 1 trigger + 1 cron under `// ─── risks module (Phase 0 — 2026-05-07)` block.
- `firestore.rules` — block for `/labs/{labId}/risks/{riskId}` + events subcollection (read: lab member; create/update/delete: `if false`); `isValidRisk` helper declared (defense in depth).
- `firestore.indexes.json` — composite `(labId, deletadoEm, status, npr DESC)` for register sorted by NPR; `(labId, deletadoEm, reviewDate ASC)` for review-due query.
- `vite.config.ts` — `manualChunks['feature-risks']: [/src\/features\/risks\//]`.
- `src/AppRouter.tsx` — lazy `'risks'` → `<RisksView />`.
- `src/types/index.ts` — `View` union `'risks'`.
- `src/features/hub/ModuleHub.tsx` — Hub tile `risks` (SVG inline icon: shield+exclamation or matrix grid).
- `CLAUDE.md` (root) — new row in "Módulos em produção" table.
- `functions/scripts/provision-modules-claims.ts` — extend with `'risks'`.
- `src/features/labSettings/types/...` — extend lab-settings schema with optional `nprThresholds: { medio: number; alto: number; critico: number }` (defaults: 25, 61, 100). Read-only access by `risks` service. **OPEN —** if labSettings schema is locked, ship hardcoded thresholds and add settings UI as v1.4 Phase 1 stretch.
- `docs/adr/README.md` — append link to ADR-0016.

## Tasks (atomic, ordered)

### T1. Author ADR-0016 (FMEA-lite methodology)

**Outcome:** ADR documents methodology + escape hatch + thresholds.
**Files:** docs/adr/0016-fmea-lite-methodology.md, docs/adr/README.md.
**Steps:**
1. Author per project ADR template (`docs/adr/0008-*.md` as recent example).
2. Sections: Context, Decision, Status, Consequences, Alternatives Considered (ISO 31000 — deferred for v1.5), References (DICQ 4.14.6 + ISO 15189 §8.5 + RDC 978 Art. 86).
3. State default thresholds: baixo ≤24, medio 25–60, alto 61–99, critico ≥100.
4. State escape hatch: "Refine to ISO 31000 if Riopomba feedback in v1.4 retro warrants — versioned ADR-0016a."
5. CTO sign-off.
**Verification:** ADR file exists; README index updated; markdown lint OK.

### T2. Scaffold types + service skeleton (read-only) + npr/nivel helpers

**Outcome:** types match PHASE-0-PLAN schema; pure helpers `computeNPR` + `deriveNivel` unit-tested.
**Files:** src/features/risks/types/Risk.ts, src/features/risks/services/risksService.ts, src/__tests__/risks/computeNPR.test.ts.
**Steps:**
1. Invoke `Skill hcq-module-generator` with `risks` (read-only mode).
2. Define types verbatim from PHASE-0-PLAN Task 4 schema.
3. Implement `computeNPR(p, s, d): number` (validates 1..5 each; throws otherwise).
4. Implement `deriveNivel(npr, thresholds = DEFAULT_THRESHOLDS): Nivel`.
5. Unit-test 8 cases for computeNPR (1×1×1=1, 5×5×5=125, edge OOB throw, etc.) + 6 cases for deriveNivel boundaries.
**Verification:** `npx tsc --noEmit` clean; `npm test -- risks/computeNPR` green.

### T3. Implement callable scaffold (validators, signatureCanonical, index)

**Outcome:** functions/src/modules/risks scaffold ready.
**Files:** functions/src/modules/risks/{validators,signatureCanonical,index}.ts.
**Steps:** Mirror Plan 00-01 / 00-03 pattern. Adapt Zod for P/S/D enums + `validateNPR` cross-check.
**Verification:** `cd functions && npx tsc --noEmit` clean.

### T4. Implement createRisk + softDeleteRisk + audit trigger

**Outcome:** core write path operational.
**Files:** createRisk.ts, softDeleteRisk.ts, onRiskEventCreated.ts, functions/src/index.ts.
**Steps:**
1. `createRisk`: `codigo` uniqueness within lab; auto-derive NPR + nivel server-side from input P/S/D (client value ignored if provided — server is source of truth); `reviewDate = criadoEm + 365d` default.
2. `softDeleteRisk`: reject if `status === 'fechado'` (preserve evidence).
3. ChainHash trigger.
4. Smoke script `functions/scripts/smoke-risks-callables.mjs` (mirror Plan 00-01).
**Verification:** Smoke script: unauth fail; create happy → NPR matches; create with bogus client-supplied NPR → server overwrites; soft delete on aberto ok, on fechado fail; chainHash present.

### T5. Implement updateRisk + registrarRevisao + (stretch) seedFromCsv

**Outcome:** review cycle works; reclassification recomputes NPR.
**Files:** updateRisk.ts, registrarRevisao.ts, seedFromCsv.ts (stretch).
**Steps:**
1. `updateRisk`: status transitions enforced (`aberto → mitigando | fechado`; `mitigando → monitorado | fechado`; `monitorado → mitigando | fechado`; `fechado → ∅` terminal).
2. `registrarRevisao`: append `reviewHistory[]`; reclassificado branch recomputes NPR/nivel; fechado branch sets terminal status.
3. **Stretch (P0-R4 dropline):** `seedFromCsv` only if Wave 2 still on schedule by Day 7. Otherwise drop to v1.4.1.
**Verification:** Smoke extended; reclassificação from NPR=80 → NPR=20 transitions nivel `medio → baixo` server-side.

### T6. Implement scheduled review (annual + monthly top-5)

**Outcome:** daily cron at 07:00 BRT identifies due reviews; idempotent.
**Files:** scheduledReview.ts, functions/src/index.ts.
**Steps:**
1. Daily query: `reviewDate <= today AND status != 'fechado' AND deletadoEm == null`. Per match, write notification with idempotency key `${riskId}-${reviewDate-iso}`.
2. Monthly check (cron also runs daily but only acts on day 1 of month): `npr >= 100 AND status != 'fechado'`. Notification idempotency key `${riskId}-monthly-${YYYY-MM}`.
3. Reuse existing `/labs/{labId}/notifications/` collection.
**Verification:** Emulator: set `reviewDate = yesterday` on test risk; trigger; one notification. Re-trigger; no dup. Set `npr=100` on another risk; trigger on Mar 1 (mock); monthly notification appears.

### T7. Build hooks + UI components (Register + Form + Matrix + Review + Top5)

**Outcome:** all components rendering against emulator data; form computes NPR live; matrix shows distribution; review modal drives reclassificação.
**Files:** hooks/useRisks.ts, hooks/useRiskMatrix.ts, hooks/useTopRisks.ts, components/RisksView.tsx, components/RiskRegister.tsx, components/RiskForm.tsx, components/RiskMatrix.tsx, components/RiskReviewModal.tsx, components/Top5RisksWidget.tsx.
**Steps:**
1. `useRisks` mirrors `useColaboradores`.
2. `RiskForm` step 2: P/S/D as range inputs (1–5 with numeric label); below, large NPR display + nivel chip color-coded; debounced 100ms recompute on change. Use `tabular-nums`.
3. `RiskMatrix` 5×5 SVG; cell color by max NPR (emerald < threshold.medio; amber < threshold.alto; orange < threshold.critico; red ≥ threshold.critico). Click → `setFilter({probabilidade, severidade})` on Register.
4. `RiskReviewModal` step-through: pick resultado → conditional UI for reclassificado (P/S/D scrubbers) → submit via `risks_registrarRevisao`.
5. `Top5RisksWidget` shows top 5 by NPR with color chips + click to drill-down.
6. `RisksView` topbar + KPI strip + tabs.
**Verification:** `npm run dev` smoke; create risk + see in matrix + run review + reclassify; `npx tsc --noEmit` clean.

### T8. Write Firestore rules + indexes; rules emulator tests

**Outcome:** rules deny client-direct write; allow Admin SDK callable; allow read by member.
**Files:** firestore.rules, firestore.indexes.json, functions/test/risks/rules.test.mjs.
**Steps:**
1. Invoke `Skill hcq-firestore-rules-generator` with `risks` collection + DL-1 convention; include `isValidRisk` helper for defense in depth.
2. Add 2 composite indexes.
3. Rules emulator test: read by member ✅; create by member ❌; create by Admin SDK ✅; delete ❌; revisao subcoleção write ❌.
**Verification:** Emulator green; baseline 738/738 still green.

### T9. Wire shell integration + lazy route + manualChunks

**Outcome:** tile in `/hub`; lazy chunk verified.
**Files:** src/types/index.ts, src/AppRouter.tsx, src/features/hub/ModuleHub.tsx, vite.config.ts.
**Steps:** Mirror Plan 00-01 T7.
**Verification:** `npm run build` produces `feature-risks` chunk.

### T10. Write module CLAUDE.md + update root CLAUDE.md + Obsidian + revisit DPIA cross-link

**Outcome:** module governance + root row + Obsidian DICQ 4.14.6 → `[x]` + Plan 00-02 DPIA v1.1 patch (cross-link to ADR-0016).
**Files:** src/features/risks/CLAUDE.md, CLAUDE.md (root), Obsidian `01_Projetos/HC_Quality_Checklist_Auditoria.md`, docs/policies/IT-LGPD-DPIA-001-v1.1.md (patch from Plan 00-02 forward reference).
**Steps:**
1. Write module CLAUDE.md (mirror SGQ).
2. Append root table row.
3. Tickle Obsidian checklist.
4. Patch DPIA template to v1.1 with concrete reference to ADR-0016 + Plan 00-04 NPR methodology. Republish DPIA via SGQ as a new revisão (per RN-SGQ-03: previous v1.0 transitions to obsoleto, v1.1 vigente).
**Verification:** Files written; DPIA v1.1 vigente in SGQ; DPIA v1.0 obsoleto; chain `substituidoPor` populated.

### T11. Pre-deploy + deploy + Cloud Logs + smoke

**Outcome:** rules + functions + hosting deployed; 24h Cloud Logs running; manager-confirmed smoke for register + review + reclassificação.
**Files:** N/A (operational).
**Steps:**
1. `provisionModulesClaims` with `'risks'` granted to active users.
2. `npx tsc --noEmit` (web + functions); `npm run build`.
3. `firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2`.
4. `firebase deploy --only "functions:risks_*,functions:onRiskEventCreated" --project hmatologia2`.
5. `firebase deploy --only hosting --project hmatologia2`.
6. Hard reload + smoke (create + matrix + review cycle).
7. `bash scripts/monitor-cloud-logs.sh 24 30`.
**Verification:** Deploy logs clean; smoke green.

## Acceptance criteria

(Verbatim from PHASE-0-PLAN Task 4 + DL-1 additions.)

- [ ] Manager can register risk with FMEA scoring (probabilidade × severidade × detecção).
- [ ] NPR auto-calculated server-side; nivel derived; visual badge color-coded.
- [ ] Heat map (5×5 matrix) shows risk distribution; click cell to filter.
- [ ] Top 5 critical risks (NPR ≥ 100) flagged for monthly review even if reviewDate not reached.
- [ ] Treatment status tracked (ações + prazos + owner + status).
- [ ] Periodic review form captures resultado + NPR transition (previous/new); reclassificação recomputes server-side.
- [ ] Annual review reminder fires automatically (daily cron, idempotent notifications).
- [ ] Auditor can demonstrate active risk register + treatment evidence + review history.
- [ ] Logical signature + audit trail validate (`verifyChain` script passes for sample risks across status transitions).
- [ ] **DL-1 observable:** rules deny client-direct write; Admin SDK callable allowed; client-supplied NPR is overwritten by server-computed value.
- [ ] **ADR-0016 published** with methodology + escape hatch.
- [ ] **DPIA v1.1 published** in SGQ cross-linking ADR-0016 (Plan 00-02 forward reference resolved).

## Verification gates (pre-execute → post-execute)

- [ ] `npx tsc --noEmit` clean (web)
- [ ] `cd functions && npx tsc --noEmit` clean
- [ ] `npm test` baseline 738/738 passing (no regression)
- [ ] computeNPR + deriveNivel unit tests green (14 cases)
- [ ] Firestore rules emulator: read ok, write client deny, Admin SDK ok, delete deny
- [ ] `verifyChain` script passes for sample risks including reclassificação
- [ ] `bash scripts/monitor-cloud-logs.sh` clean post-deploy (24h)
- [ ] Cloud Functions deploy success (5 callables + 1 trigger + 1 cron)
- [ ] Hosting deploy success
- [ ] `npm run build` produces `feature-risks` chunk; main bundle delta <5KB gzip
- [ ] ADR-0016 + DPIA v1.1 in SGQ both published

## Risk hooks

- **P0-R2 (FMEA iteration):** ADR-0016 captures methodology + escape hatch ("v1.5 ISO 31000 refinement if needed"); UI thresholds configurable via `labSettings` (or hardcoded with v1.4 Phase 1 settings UI).
- **P0-R4 (timeline overflow):** `risks_seedFromCsv` is **stretch**; drop to v1.4.1 if Wave 2 hits Day 9 hard stop. T5 step 3 marks this clearly. MVP ships with empty risk register; Riopomba populates in Week 2.
- **P0-R6 (perf regression):** lazy route + manualChunks; `RiskMatrix` SVG render budget <50ms; Lighthouse spot-check on `/hub` post-deploy.
- **RISK-409 (regression in v1.3):** zero edits to existing module code; baseline 738/738 green; smoke 3 random v1.3 flows post-deploy.
- **RISK-403 closure:** auditor demonstration script in module CLAUDE.md; closure is contingent on this plan being last in Phase 0.
- **Inherited from Wave 1:** callable shape from Plan 00-01; SGQ revisão pattern from Plan 00-02 (used by T10 step 4 to publish DPIA v1.1).

## Skills to invoke (execution time)

- `hcq-module-generator` — scaffold (T2, T7)
- `hcq-firestore-rules-generator` — rules block (T8)
- `hcq-ciq-audit-trail` — events subcoleção + chainHash (T4)
- `hcq-deploy-gates` — pre-merge + pre-deploy (T11)

## Definition of done

- All acceptance criteria green
- Logical signature server-generated; client-supplied NPR overwritten
- Audit trail event for every state-change including review reclassificação
- ADR-0016 in `docs/adr/`; README index updated
- DPIA v1.1 in SGQ as `vigente` (DPIA v1.0 transitioned to `obsoleto` with `substituidoPor` chain)
- Lazy route + manualChunks confirmed
- `src/features/risks/CLAUDE.md` written
- Root `CLAUDE.md` row added
- Obsidian DICQ 4.14.6 → `[x]`
- 24h Cloud Logs report archived to `.planning/phases/00-rdc-blockers/00-04-cloud-logs-day1.md`
- **Phase 0 closure handshake:** since this is the last plan, on green status update `.planning/STATE.md` with new DICQ score (target +3 to +4 points → ~82%) and notify CTO that Phase 1 unblock gate is reached.

## Notes (plan-specific)

- This plan is the **largest in Phase 0** (3.5d engineering) and the longest critical path. P0-R4 risk applies most directly: if Wave 2 stretches to Day 9, drop the CSV seed (T5 step 3) and ship MVP-empty register.
- **Cross-plan dependency on 00-02 (DPIA v1.1 patch):** T10 step 4 explicitly publishes DPIA v1.1 in SGQ via the existing `revisao-emitida` flow (RN-SGQ-03). This requires Plan 00-02 to have published DPIA v1.0 first — hence `depends_on: ["00-02"]`. The Plan 00-02 forward reference (`# OPEN — DPIA cross-link`) is resolved by this step.
- **NPR threshold storage:** ideal is `labSettings.nprThresholds` for per-lab tuning. **OPEN —** if `src/features/labSettings/` schema is locked or modifying it bloats this plan, ship hardcoded thresholds in `risksService.ts` with a TODO for v1.4 Phase 1. Current recommendation: hardcode for Phase 0; settings UI in Phase 1.
- **Server overrides client NPR:** the callable explicitly recomputes NPR from P/S/D. Even if the client sends `npr: 999`, server stores `npr: P*S*D`. This is a small but important defense-in-depth flag in unit tests.
- **History preservation:** `tratamento.acoes[]` and `reviewHistory[]` are append-only. The callable rejects payloads that shrink either array.
- **Chained closure status:** when a risk is `fechado`, soft-delete is rejected (T4 step 2). Closed risks are evidence forever per RDC 978 retention.
- **The auditor demonstration script** in module CLAUDE.md should walk: open `RisksView` → switch to `Matriz` tab → click red cell → see filtered list → click risk → see full review history with NPR transitions → export PDF (PDF export deferred to Phase 1; CLAUDE.md notes this).
- This plan's quality directly affects v1.4 Phase 4 (CAPA — `linkedCAPAs[]` field) and Phase 13 (Final DICQ Audit — risk register evidence). The schema must be forward-compatible: `linkedCAPAs?: string[]` and `linkedNCs?: string[]` already declared per spec; ensure types ship with these fields even if unused in Phase 0.
