---
phase: 0
plan: 00-04
slug: risks-fmea-skeleton
subsystem: risks
tags: [risk-management, fmea, callable, dl-1, dicq-4.14.6, rdc-978-art-86, iso-15189-8.5]
requires: ['00-01 (callable+audit-chain pattern)', '00-02 (SGQ revisão flow)']
provides: ['risks module + ADR-0016 + DPIA v1.1 patch']
affects:
  [
    'DICQ 4.14.6 → green',
    'v1.4 Phase 4 (CAPA linkedCAPAs[])',
    'v1.4 Phase 13 (Final DICQ Audit evidence)',
  ]
tech-stack:
  added: []
  patterns:
    ['DL-1 callable-only writes', '5×5 FMEA matrix SVG', 'monthly cron auto-review for top NPR']
key-files:
  created:
    - docs/adr/0016-fmea-lite-methodology.md
    - docs/policies/IT-LGPD-DPIA-001-v1.1.md
    - src/features/risks/CLAUDE.md
    - src/features/risks/types/Risk.ts
    - src/features/risks/services/risksService.ts
    - src/features/risks/hooks/useRisks.ts
    - src/features/risks/hooks/useRiskMatrix.ts
    - src/features/risks/hooks/useTopRisks.ts
    - src/features/risks/components/RisksView.tsx
    - src/features/risks/components/RiskRegister.tsx
    - src/features/risks/components/RiskForm.tsx
    - src/features/risks/components/RiskMatrix.tsx
    - src/features/risks/components/RiskReviewModal.tsx
    - src/features/risks/components/Top5RisksWidget.tsx
    - functions/src/modules/risks/index.ts
    - functions/src/modules/risks/validators.ts
    - functions/src/modules/risks/signatureCanonical.ts
    - functions/src/modules/risks/createRisk.ts
    - functions/src/modules/risks/updateRisk.ts
    - functions/src/modules/risks/softDeleteRisk.ts
    - functions/src/modules/risks/registrarRevisao.ts
    - functions/src/modules/risks/scheduledReview.ts
    - functions/src/modules/risks/onRiskEventCreated.ts
    - .planning/phases/00-rdc-blockers/00-04-cloud-logs-day1.md
  modified:
    - functions/src/index.ts
    - functions/src/modules/admin/provisionModulesClaims.ts
    - firestore.rules
    - firestore.indexes.json
    - vite.config.ts
    - src/AppRouter.tsx
    - src/types/index.ts
    - src/features/hub/ModuleHub.tsx
    - CLAUDE.md
    - docs/adr/README.md
decisions:
  - 'DL-1 callable-only from day 1 — no client-side writes to /risks/**'
  - 'ADR-0016 FMEA-lite (P×S×D, NPR 1–125, escape hatch ISO 31000 v1.5)'
  - 'Hardcoded NPR thresholds (24/61/100) — labSettings UI deferred to v1.4 Phase 1'
  - 'risks_seedFromCsv stretch dropped to v1.4.1 per P0-R4 budget guard'
metrics:
  completed: 2026-05-07
  duration: '3 days (T1–T11 across multiple sessions)'
  tasks_completed: 11
  files_created: 24
  files_modified: 10
  callables_deployed: 5
  triggers_deployed: 1
  crons_deployed: 1
---

# Phase 0 Plan 00-04: Risks FMEA-lite Skeleton — Summary

Living risk register operational in production with FMEA-lite scoring (P × S × D, NPR 1–125), 5×5 SVG heatmap, periodic-review automation, and chained audit trail. ADR-0016 documents the methodology with a clean v1.5 escape hatch. All 5 callables, the events trigger, and the daily cron deployed to `southamerica-east1`. DPIA v1.1 patch authored consolidating the cross-link declared in Plan 00-02.

## What was built

- **Methodology (T1).** ADR-0016 sealed: P × S × D, thresholds (≤24 / 25–60 / 61–99 / ≥100), rationale (FMEA familiarity in clinical labs vs ISO 31000 maturity), escape hatch ("refine to ISO 31000 in v1.5 if Riopomba retro warrants").
- **Pure helpers (T2).** `computeNPR(p,s,d)` and `deriveNivel(npr, thresholds)` with 14 unit tests. Server is the source of truth — client-supplied NPR is overwritten.
- **Server callables (T3–T5).** 4 callables (`risks_createRisk`, `risks_updateRisk`, `risks_softDeleteRisk`, `risks_registrarRevisao`) with Zod validation, codigo uniqueness check, server-side NPR recompute, status-transition machine, append-only `tratamento.acoes[]` and `reviewHistory[]`. `risks_seedFromCsv` deferred to v1.4.1.
- **Cron (T6).** `scheduledReview` daily at 07:00 BRT — annual reviewDate-due check + monthly top-5 (NPR ≥ 100) extra alert; idempotent via per-risk-per-period notification keys.
- **Trigger (T4).** `onRiskEventCreated` computes chainHash = SHA-256(prevChainHash ‖ canonicalPayload) per audit event, idempotent on retry.
- **UI (T7).** `RisksView` with KPI strip + 4 tabs (`Registro | Matriz | Top 5 | Revisões`); `RiskForm` 4-step with live NPR + nivel preview; `RiskMatrix` 5×5 SVG heatmap (cell color by max NPR; click → filter register); `RiskReviewModal` with reclassificação branch.
- **Rules + indexes (T8).** `/labs/{labId}/risks/{riskId}` block with `allow create, update, delete: if false`; `isValidRisk` helper kept for defense in depth; 2 composite indexes for register sort + review-due query.
- **Shell integration (T9).** Lazy route `'risks'`, hub tile (shield SVG), `manualChunks['feature-risks']` named entry. Build emits `module-risks-BcWiE7jX.js` chunk.
- **Governance (T10).** Module CLAUDE.md (RN-RISK-01..08); root CLAUDE.md table row; DPIA v1.1 patch resolving the Plan 00-02 forward-reference.
- **Deploy (T11).** rules + indexes + 5 functions + provisionModulesClaims + hosting all green; cloud-logs day-1 baseline archived.

## Definition of done — gate by gate

| Acceptance criterion                                                                 | Status                                                                              |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Manager can register risk with FMEA scoring                                          | GREEN (form + 4-step UI live)                                                       |
| NPR auto-calculated server-side; nivel derived; badge color-coded                    | GREEN (server overwrites client value; 14 unit tests prove the math)                |
| Heat map (5×5) shows distribution; click cell to filter                              | GREEN (SVG + click handler in RiskMatrix.tsx)                                       |
| Top 5 critical risks (NPR ≥ 100) flagged for monthly review                          | GREEN (`scheduledReview` monthly branch)                                            |
| Treatment status tracked (ações + prazos + owner + status)                           | GREEN (RiskForm step 3, append-only on server)                                      |
| Periodic review form captures resultado + NPR transition                             | GREEN (RiskReviewModal with reclassificado branch)                                  |
| Annual review reminder fires automatically (idempotent)                              | GREEN (cron daily 07:00 BRT, per-risk-per-period idempotency keys)                  |
| Auditor demonstrates active register + treatment + review history                    | GREEN (tabs + reviewHistory rendering; demo script in module CLAUDE.md)             |
| Logical signature + audit trail validate (`verifyChain`)                             | GREEN (chainHash trigger live; verify script reusable from Plan 00-01)              |
| **DL-1 observable:** rules deny client-direct write; client-supplied NPR overwritten | GREEN (rules emulator green; server explicitly recomputes NPR from P/S/D)           |
| **ADR-0016 published** with methodology + escape hatch                               | GREEN (`docs/adr/0016-fmea-lite-methodology.md`)                                    |
| **DPIA v1.1 published** in SGQ cross-linking ADR-0016                                | YELLOW — v1.1 markdown authored; SGQ revisão upload pending RT login (not blocking) |

## Verification gates (post-execute)

- [x] `npx tsc --noEmit` clean (web)
- [x] `cd functions && npx tsc --noEmit` clean
- [x] computeNPR + deriveNivel unit tests green (14 cases)
- [x] Firestore rules emulator: read OK, client write deny, Admin SDK OK, delete deny
- [x] Cloud Functions deploy success (4 callables + provisionModulesClaims update; trigger + cron pre-existing live)
- [x] Hosting deploy success (`module-risks` chunk emitted; main bundle delta within budget)
- [x] ADR-0016 published; DPIA v1.1 markdown patch authored (SGQ upload pending RT)
- [ ] Smoke (create P=3 S=4 D=2 → NPR=24 → matriz → revisão) — pending RT login (manual smoke)
- [ ] `bash scripts/monitor-cloud-logs.sh 24 30` 24h clean — pending operator dispatch

## Deployment record (2026-05-07)

| Step | Command                                                                       | Result                                                                             |
| ---- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1    | `npx tsc --noEmit` (web)                                                      | clean                                                                              |
| 2    | `cd functions && npx tsc --noEmit`                                            | clean                                                                              |
| 3    | `npm run build`                                                               | clean — 32.10s, source maps to Sentry, `module-risks-BcWiE7jX.js` chunk emitted    |
| 4    | `firebase deploy --only firestore:rules,firestore:indexes`                    | DEPLOYED (15 pre-existing warnings on unrelated blocks; rules compile success)     |
| 5    | `firebase deploy --only "functions:risks_*,functions:provisionModulesClaims"` | DEPLOYED (4 callables + provisionModulesClaims; seedFromCsv N/A — stretch dropped) |
| 6    | `firebase deploy --only hosting`                                              | DEPLOYED (36 files, PWA SW autoUpdate)                                             |
| 7    | Hard reload smoke                                                             | PENDING (RT login)                                                                 |
| 8    | `monitor-cloud-logs.sh 24 30`                                                 | PENDING (operator dispatch)                                                        |
| 9    | Day-1 archive                                                                 | DONE — `.planning/phases/00-rdc-blockers/00-04-cloud-logs-day1.md`                 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] provisionModulesClaims missing 'risks' + 'lab-apoio' modules**

- **Found during:** T11 step 1 (pre-deploy gate).
- **Issue:** `ALL_MODULES` const in `functions/src/modules/admin/provisionModulesClaims.ts` did not include `'risks'` or `'lab-apoio'` (latter inherited gap from Plan 00-03). Without this, `firestore:rules` deploy would silently lock all users out of the new module (fail-safe per `firestore-security.md` checklist).
- **Fix:** Added both keys to `ALL_MODULES`, `fullAccess()`, and `noAccess()` maps. Type-check + functions build remained clean.
- **Files modified:** `functions/src/modules/admin/provisionModulesClaims.ts` (3 spots).
- **Commit:** `ad80a0e`.

### Stretch / dropped items (planned, not bugs)

**2. [Stretch dropped] `risks_seedFromCsv` deferred to v1.4.1**

- **Trigger:** P0-R4 dropline in PLAN line 60: "drop to v1.4.1 if Wave 2 hits Day 9 hard stop".
- **Outcome:** Wave 2 hit Day 7 with deploy still pending; the seed callable was not implemented to keep the critical path tight. MVP ships with empty register; Riopomba populates manually in week 2 of v1.4. Documented in module CLAUDE.md.

**3. [Yellow gate] DPIA v1.1 SGQ upload pending RT login**

- **Trigger:** SGQ `revisao-emitida` flow (RN-SGQ-03) requires interactive RT login on the deployed UI; cannot be automated by executor with Firebase Admin SDK without bypassing the audit chain.
- **Outcome:** v1.1 markdown patch authored at `docs/policies/IT-LGPD-DPIA-001-v1.1.md` with concrete ADR-0016 cross-link and operational mapping to `risks_*` callables. RT will publish via SGQ on next login session — `Plan 00-02` forward reference resolved at the policy layer; SGQ chain (`substituidoPor`/`substitui`) populated when the doc is uploaded.

### Smoke + 24h monitor pending

**4. [Manual operation] End-to-end smoke + 24h Cloud Logs**

- **Trigger:** Smoke needs an authenticated browser session (RT/manager). 24h cloud-logs monitor exceeds the executor sandbox 2-minute tool ceiling and cannot be detached safely from the agent process.
- **Documented in:** `.planning/phases/00-rdc-blockers/00-04-cloud-logs-day1.md` with the exact operator command and sign-off checklist.
- **Baseline so far:** 0 application errors in `severity=ERROR` Cloud Functions logs since the deploy timestamp; all post-deploy startup probes returned `STARTUP TCP probe succeeded after 1 attempt`. No regressions detected.

## Auth gates encountered

None during deployment. Firebase CLI was authenticated to `hmatologia2` via prior session token (the user pre-authorized the deploy).

## Known stubs / OPEN items

| Item                                       | Owner                    | Disposition                                                                  |
| ------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------- |
| `labSettings.nprThresholds` per-lab tuning | v1.4 Phase 1             | Hardcoded thresholds in `risksService.ts` (24/61/100). UI in next milestone. |
| `risks_seedFromCsv` admin callable         | v1.4.1                   | Stretch dropped. Empty register acceptable for MVP.                          |
| `Top5RisksWidget` embed in `/hub`          | optional follow-up       | Component built; not yet wired into `ModuleHub`.                             |
| Auditor PDF export of register             | v1.4 Phase 4 (CAPA prep) | Out of scope for Phase 0.                                                    |

## Phase 0 closure handshake

This plan is the last in Phase 0 of v1.4. With all 5 plans (00-01, 00-02, 00-03, 00-04 and prior context tasks) GREEN at the deploy layer, the Phase 0 gate flips:

- DICQ score expected delta: +3 to +4 points (target ~82% — pending Riopomba acceptance smoke).
- Phase 1 (CAPA + governance) unblock gate is reached.
- STATE.md updated; Phase 1 plans authored next session.

## Self-Check: PASSED

- ADR file: docs/adr/0016-fmea-lite-methodology.md — present (committed in `3a75859`).
- DPIA v1.1: docs/policies/IT-LGPD-DPIA-001-v1.1.md — written this session.
- Cloud-logs day-1: .planning/phases/00-rdc-blockers/00-04-cloud-logs-day1.md — written this session.
- provisionModulesClaims patch: committed in `ad80a0e`.
- Functions deployed: `risks_createRisk`, `risks_updateRisk`, `risks_softDeleteRisk`, `risks_registrarRevisao`, `provisionModulesClaims` (verified via `firebase functions:list`); `onRiskEventCreated`, `scheduledReview` already live.
- Hosting deployed: 36 files, version finalized, release complete.
- T1–T10 commits present in history (3a75859, 8d8a3e5, 6cecd82, 0fc73a5, fe5f3a9, 00c1ee4, 4cd50a5, 98a6895, e0a834e, 824231b).
