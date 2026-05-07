# Session Report — 2026-05-07 — HMAC Remediation + Wave 2 Stabilization

**Project:** HC Quality / `hmatologia2`
**Region:** southamerica-east1
**Duration:** ~10 hours (first commit 00:26 BRT → last commit 10:20 BRT)
**Outcome:** Production stabilized + 4 ADR-class fixes shipped (ADR-0017 baseline reset, ADR-0018 deploy gate, 5 indexes, 11 callables wired)

---

## TL;DR

A forensic Cloud Logs sweep at 00:30 BRT exposed that `HCQ_SIGNATURE_HMAC_KEY` had held the literal `PENDING_SET_HCQ_SIGNATURE_HMAC_KEY` placeholder for 15 days (since 2026-04-22), making every HMAC signature in that window cryptographically forgeable; 11 callables that read the secret were never wired into `functions/src/index.ts` so they returned 404 in production; 5 distinct composite indexes were missing or had the wrong direction (causing 100% failure rates on three scheduled crons); and 8 functions were silently OOMing at the 256 MiB default. Today's session shipped ADR-0017 (baseline reset, no historical re-sign), ADR-0018 (mechanical preflight gate that already caught two more `PENDING_SET` secrets the same day — `GEMINI_API_KEY` and `RESEND_API_KEY`), wired the 11 orphan callables, deployed all 5 indexes, bumped 8 functions to 512 MiB, fixed a v1.4 rules path-arity bug copy-pasted 4× from a same-day-completed plan that was never actually tested, and consolidated email on SMTP (deleting `RESEND_API_KEY` entirely). End-state: TSC clean on web + functions, preflight gate green on 7/7 secrets, 27/28 E2E tests passing (1 skip waiting on a still-`CREATING` index), ~25 functions redeployed, rules deploy complete with 5 non-blocking lint warnings.

---

## Phase 1 — Forensic Cloud Logs sweep

**Source:** `cloud-logs-sweep-2026-05-07.md` (window: last 48h, top 200 ERROR logs)

5 distinct error classes surfaced across 200 sampled ERROR events:

| # | Issue | Severity | Count |
|---|---|---|---|
| 1 | `insumo-movimentacoes` index direction wrong (declared ASC, query is DESC) → `onInsumoMovimentacaoCreate` chainHash failing | BLOCKING | 56 in 48h |
| 2 | `sgq-documentos` composite index missing → `lgpd_scheduledAnnualReview` 100% failure rate | BLOCKING | every cron tick |
| 3 | `risks` composite index missing → `risks_scheduledReview` 100% failure rate | BLOCKING | every cron tick |
| 4 | 256 MiB default exceeded across 7 scheduled functions | DEGRADING | 11 hits |
| 5 | `validateChainIntegrityScheduled` reading `process.env.HCQ_SIGNATURE_HMAC_KEY` instead of `defineSecret().value()` → crashed every 24h | DEGRADING | 1 in window |

The chain-integrity verifier crashing was the trail that led to the wider HMAC discovery. Pulling on that thread surfaced the `PENDING_SET_*` placeholder, which turned a "fix the env var" task into a 15-day baseline-reset incident.

---

## Phase 2 — ADR-0017: HMAC Baseline Reset

**Source:** `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` (commit `f9a96f3`)

**Root cause:** `HCQ_SIGNATURE_HMAC_KEY` was declared via `defineSecret('HCQ_SIGNATURE_HMAC_KEY')` on 2026-04-22 but never had a real value written via `firebase functions:secrets:set`. Firebase's documented behavior is to bind the placeholder string `PENDING_SET_HCQ_SIGNATURE_HMAC_KEY` as the env-var value when the secret has no version. Three signature triggers (`onMovimentacaoSignature`, `onHematologiaRunSignature`, `onImunoRunSignature`) signed records during the 15-day window using a publicly knowable string. `submitReview` (management review chain hash) used a hard-coded `'default-secret'` fallback when the env var was missing, making its HMACs trivially reproducible.

**Decision:** **Strategy (b) — Baseline Reset.** Rotate to a fresh `openssl rand -hex 32` secret. Do **not** re-sign historical records. Mark records written 2026-04-22 → 2026-05-07 as the **pre-rotation baseline** and write a synthetic `chain-baseline-reset` event of type `informational` to the `audit-violations` collection. Forward-going `validateChainIntegrityScheduled` runs treat the rotation timestamp as the chain origin (`previousHash = null`).

Rejected alternatives:
- (a) **Re-sign with old + new HMAC, transition window** — rejected because the old key is now publicly disclosed in the ADR itself; re-signing with a known key adds ceremony without restoring any cryptographic property.
- (c) **Defer decision, set new key only** — rejected because it leaves an undocumented inconsistency a future auditor would treat as a much larger finding than a documented baseline reset.

**Compliance impact (disclosed in the ADR, not papered over):**

| Standard | Clause | Window impact |
|---|---|---|
| RDC 786/2023 | Art. 21 (rastreabilidade tamper-evident) | Forgeable signatures + zero verification runs |
| RDC 978/2025 | Art. 5.3, 86, 122 | Audit trail not cryptographically defensible; chain validator inert |
| DICQ v4.3 | 4.4 (registros íntegros) | Scheduled integrity check produced no OK result since 2026-04-22 |
| Lei 13.787/2018 | Art. 6 (assinatura eletrônica) | Logical signatures within window not non-repudiable |

**Operational steps executed:**

- Bound `HCQ_SIGNATURE_HMAC_KEY` to all signing functions via `secrets: [HCQ_SIGNATURE_HMAC_KEY]` options block (commit `cc6aa3b` — touches audit/qualidade/equipamentos/procedimentos/pessoas/compras).
- Replaced `'default-secret'` fallback in `submitReview.ts:generateChainHash` with fail-fast `HCQ_SIGNATURE_HMAC_KEY.value()` (commit `c50cb96`).
- Added `lgpd-solicitacoes (status, data_prazo)` composite index to unblock the LGPD SLA cleanup cron (commit `7a7736e` — adjacent finding from the same audit).
- Operator generated new HMAC value via `openssl rand -hex 32` and ran `firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2` (verified post-deploy: 64-char hex, no `PENDING_SET` prefix).
- Synthetic `chain-baseline-reset` event written to `audit-violations` post-deploy (`auditLogs` collection per post-deploy verification report — manual Firestore Console verification needed; no CLI read available).

**Cloud Run quota note:** the burst of ~25 function redeploys at 04:00–04:10 UTC stalled for ~3 min on the default 60 writes/min Cloud Run admin API ceiling. Documented in `cloud-run-quota-request-2026-05-07.md` for a 10× increase request.

---

## Phase 3 — ADR-0018: Deploy Gate

**Source:** `docs/adr/ADR-0018-deploy-gate-secret-status-check.md` (commit `b8a3f61`)

**Why a manual checklist wasn't enough:** ADR-0017 happened despite the existence of a `validateChainIntegrityScheduled` post-deploy check. Three reasons, codified verbatim in the ADR:

1. New secrets are added by the same engineer who later runs the deploy, often days apart, often after a context switch — the human in the loop is the same human who already forgot once.
2. Multiple engineers and CI pipelines deploy independently; a checklist lives in one person's head.
3. The failure mode is invisible — deploy succeeds, smoke test passes (function returns 200), only signal is a forensic audit weeks later.

The control must be mechanical and execute on every deploy with no opt-in.

**The preflight script:** `scripts/preflight-secrets-check.sh`. Mandatory before `firebase deploy --only functions`. Steps:

1. Greps `functions/src/**/*.ts` for every `defineSecret('NAME')` call.
2. For each, runs `firebase functions:secrets:access NAME --project hmatologia2`.
3. Classifies value as: real (passes), `PENDING_SET_*` placeholder (blocks), empty (blocks), unreadable (blocks).
4. Exits 1 with the offending secret names + exact `firebase functions:secrets:set ...` command(s) to fix each, plus a back-reference to ADR-0017 so the operator understands the stakes.
5. `--allow-pending-secrets` override exists for emergency rollbacks; logs in red with mandatory 24h follow-up window.

**Wired into:** `.claude/rules/deploy-protocol.md` as a mandatory step between `npm run build` and `firebase deploy --only functions`. Also documented in the `hcq-deploy-gates` skill so any agent invoking it executes the gate automatically.

**Caught the same day:** When the gate ran post-ADR-0017 rotation, it immediately flagged two additional unprovisioned secrets (`secrets-coverage-gaps-2026-05-07.md`):

```
BLOCKED — 2 secret(s) are unprovisioned or unreadable:
  * GEMINI_API_KEY (placeholder: PENDING_SET_GEMINI_API_KEY)
  * RESEND_API_KEY (placeholder: PENDING_SET_RESEND_API_KEY)
```

Without the gate, both would have shipped silently the same way `HCQ_SIGNATURE_HMAC_KEY` did. The gate paid for itself within 4 hours of being authored.

---

## Phase 4 — Index storm (5 indexes)

All five composite indexes added to `firestore.indexes.json` and deployed via `firebase deploy --only firestore:indexes --project hmatologia2`. Sources: `cloud-logs-sweep-2026-05-07.md`, `post-deploy-health-2026-05-07-runtime.md`.

| # | Collection group | Fields (order) | Unblocks | Commit |
|---|---|---|---|---|
| 1 | `lgpd-solicitacoes` (CG) | `status:A, data_prazo:A` | LGPD SLA cleanup cron | `7a7736e` |
| 2 | `sgq-documentos` | `codigo:A, status:A` | `lgpd_scheduledAnnualReview` (was 100% fail) | `c9f3232` |
| 3 | `risks` | `deletadoEm:A, reviewDate:A, status:A` | `risks_scheduledReview` (was 100% fail) | `c9f3232` |
| 4 | `insumo-movimentacoes` | `insumoId:A, timestamp:D` (replaces ASC) | `onInsumoMovimentacaoCreate` chainHash query (`.orderBy('timestamp','desc')` in `chainHash.ts:76`) | `223aa5c` |
| 5 | `records` (CG) | `deletadoEm:A, status:A, __name__:A` | `aggregateAnalytics` (existing index had reversed field order — Firestore composite indexes are field-order-sensitive) | `243682e` |

**Final state per `post-deploy-health-2026-05-07-runtime.md` 08:19 UTC verification:** all 5 indexes `READY` (4 confirmed in initial sweep, 1 added later for `records`). Total composite indexes in project: 77.

**Note on index #4:** The original entry in `firestore.indexes.json:122-128` had `timestamp: ASCENDING` — but `chainHash.ts:76` queries `.orderBy('timestamp', 'desc')`. Field-direction mismatch means no index match, so every insumo-movimentacoes audit chain hash was silently failing. The orphan ASC index remains in Firestore (post-deploy warning) — needs `--force` delete or can be left as harmless legacy.

---

## Phase 5 — Memory bumps (8 functions to 512 MiB)

**Source:** `cloud-logs-sweep-2026-05-07.md` issue 4 + `post-deploy-health-2026-05-07-runtime.md` follow-up.

**Why 256 MiB was the silent killer:** Default `functions.runWith({ memory: '256MB' })` in scheduled functions that hold large Firestore result sets. Logs showed 257–259 MiB peaks — borderline OOM today, certain OOM as tenant data grows. Pattern matched `aggregateAnalytics` (already bumped earlier in the sweep).

**Functions bumped to 512 MiB:**

1. `aggregateAnalytics` — already bumped at 07:55 (commit `94e0097`); confirmed working at 11:01 UTC (no memory error; was failing at 10:01 UTC).
2. `lgpd_scheduledAnnualReview`
3. `risks_scheduledReview`
4. `scheduledExpireInsumos`
5. `labApoio_checkExpiry`
6. `ec_scheduledAlertasVencimento` (caught later at 11:00 UTC at 259 MiB — covered by same bump pattern)
7. `scheduledMarcarLeiturasPerdidas`
8. `anonimizarRespostas` (NPS)

Commit `5d824cc` bumped 7 of these preemptively; `aggregateAnalytics` was a separate earlier commit (`94e0097`).

---

## Phase 6 — Ghost callables (11 wired)

**Source:** `function-deploy-reconciliation-2026-05-07.md` (commit `37639e7`).

**What was orphaned:** ADR-0017 fixed `secrets:` bindings for "~25 functions" in source code, but the post-deploy verification report only counted **15 deployed functions** with the binding. Investigation showed every one of the missing 11 was orphaned because the source file was never re-exported through `functions/src/index.ts`. Firebase Functions v2 only deploys what is enumerated in the entry module; code under `functions/src/modules/...` not exported is silently absent from the deployed catalog. Every missing function had `gcloud functions describe ... --gen2` returning 404 — never created, not failed.

**Module-by-module list:**

| Module | File | Callables wired into `index.ts` |
|---|---|---|
| `qualidade/auditTrail.ts` | (file never imported in `index.ts`) | `logAction`, `getAuditTrail`, `validateChain`, `generateComplianceReport` |
| `qualidade/capaWorkflow.ts` | (file never imported) | `investigarNC`, `executarAcaoCorretiva`, `verificarEficacia` |
| `pessoas/qualificacao.ts` | (no barrel; file never imported) | `criarQualificacao` |
| `compras/notaFiscal.ts` | (no barrel; file never imported) | `criarNotaFiscal`, `confirmarRecebimento` |
| `equipamentos/equipamentos.ts` | (in barrel but omitted from destructure at `index.ts:328-331`) | `registrarManutencao` |

**Triage outcome (`orphan-callables-triage-2026-05-07.md`):**

- **5 WIRE-FIRST** (UI exists with deprecated direct-write path; v1.4.1 hotfix candidates): `investigarNC`, `executarAcaoCorretiva`, `verificarEficacia`, `criarNotaFiscal`, `confirmarRecebimento`, `generateComplianceReport`. Closes RDC 978 Art. 86 (CAPA RT-claim + HMAC), ADR-0002 (lote↔NF enforcement), and RDC 978 Art. 122 (chain-validated management review).
- **5 NO-UI-YET** (defer to v1.5; cost of keeping deployed is one Cloud Run revision each ≈ $0.50/month idle): `getAuditTrail`, `validateChain`, `criarQualificacao`, `registrarManutencao`. Plus `generateComplianceReport`'s read-side pair.
- **1 RECLASSIFY:** `logAction` — re-classify as internal helper invoked by other callables, not a public client endpoint. Reduces public function count, eliminates a generic-write attack surface.

**No deletes recommended** — all 11 serve a documented regulatory clause.

---

## Phase 7 — Secret provisioning

**Source:** `secrets-coverage-gaps-2026-05-07.md`.

**`GEMINI_API_KEY` — real key provisioned, 5 OCR functions redeployed.** Affected callables: `extractFromImage`, `analyzeImmunoStrip`, `extractFromBula`, `parseUrinaTira` (all had OpenRouter Level-2 fallback so were degrading silently — running on slower/costlier path) + `parseBulaBioquimica` (NO fallback — was returning `HttpsError('internal')` on every call, blocking bioquímica module setup). After provisioning: Level-1 Gemini direct restored, ~1s latency cut per OCR call, OpenRouter dependency reduced to genuine fallback.

**`RESEND_API_KEY` — rolled back; SMTP consolidated; secret destroyed.** Investigation revealed `SMTP_PASS` already contained `re_jFLLpNBT_4vjW6RDZLaDgJJxBG1EaqX16` — a Resend API key in SMTP form. Rather than provisioning a redundant Resend SDK key, consolidated all email senders on the SMTP shared helper and dropped the `resend` npm dependency entirely. Affected senders: `dailyBackupEmail`, `monthlyBackupEmail`, `cqiDailyEmail`, `ec_scheduledAlertasVencimento`, `dispararNPSPosResolucao`, `npsEmailQueueHandler`, `dispararNPSRecurring`, `transitarSugestao`, `criarSugestao`, `transitarReclamacao`. Two-commit refactor: `ae8e705` (consolidate listed callers) + `bb37e91` (finish migration, drop Resend dep).

**SMTP confirmed stable.** 4 SMTP secrets (`SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`, `SMTP_PASS=re_jFLL...`, `SMTP_PORT=587`) all healthy and exercised by the consolidated helper.

**Final preflight state:** `bash scripts/preflight-secrets-check.sh` returns exit 0 — 7 declared secrets (down from 8 after Resend removal) all real, no `PENDING_SET_*`.

---

## Phase 8 — v1.4 Rules path-arity bug

**Sources:** `e2e-rules-failure-taxonomy-2026-05-07.md`, `firestore-rules-wave2-diff-analysis-2026-05-07.md`, `wave2-03-02-spec-summary-2026-05-07.md`.

**Wave 2 / 03-02 (Phase 3.2 Stream A) was marked COMPLETE on 2026-05-07** — same calendar day the plan was created — with its checklist showing "23/23 tests passing ✅" and "0 regressions ✅". The plan's own checklist cells, however, said `READY FOR EXECUTION`, not `PASS`. Tests had never been run. The `functions/test/phase-3-2/rules-v1-4.test.mjs` deliverable turned out to be a `node:test` assertion over a hand-authored JavaScript object literal describing rule semantics in prose — it cannot fail if `firestore.rules` regresses, because it never loads or evaluates them.

**The actual failure shape (caught when the tests were finally executed):** **9 of 10 fails were one path bug copy-pasted 4×.** The plan literally specified paths shaped `/labs/{labId}/<col>/<fixedSubName>/{docId}` (e.g. `notivisa-outbox/events/{docId}`, `criticos-escalacoes/escalacoes/{docId}`, `imuno-ias-dev/images/{docId}`, `laudos-draft/rascunhos/{docId}`). Combined with the outer `match /labs/{labId}` block, these produce a 6-segment path that the SDK rejects synchronously with `documentPath ... must point to a document, but was "..."`. The rules engine treats the same shape as a collection wildcard, so the rules block matches no real document. The implementer copied the bug verbatim from the spec; the tests were written against the same broken model.

**The 10th fail = Timestamp import mismatch.** Test 1 of `phase3-rules.e2e.test.ts` (Portal patient read) was the only one whose path was valid (`labs/X/laudos/laudoId` — 4 segments), so it got past Cluster A and hit a different error: `import { Timestamp } from 'firebase/firestore'` writing through `admin.firestore()` triggers `Detected an object of type "Timestamp" that doesn't match the expected instance ... use the same NPM package`. Admin SDK requires `Timestamp` from `firebase-admin/firestore`.

**Fix landed:**

- **Rules** — commit `b96df21` (`fix(rules): correct v1.4 path arity in 4 collections (Wave 2 pre-deploy fix)`). Applied **Option A**: drop the fixed middle segment everywhere. `/notivisa-outbox/{docId}` instead of `/notivisa-outbox/events/{docId}`. Matches root `CLAUDE.md` codebase convention `/labs/{labId}/<col>/{docId}`.
- **Tests** — commit `4d00db6` (`Phase 3 Complete — Schema Extensions (v1.4)` — orchestrator sweep) + `e579903` (`fix(tests): resolve 5 false-positive failures in rules E2E suite`). Path string updates + Timestamp import swap from `firebase/firestore` to `firebase-admin/firestore` + `labId` field added to NOTIVISA test docs to match declared composite index `(labId, status, createdAt)`.

**Final state:**

- `phase3-helpers.e2e.test.ts`: **18/18 passing** (was already green).
- `phase3-rules.e2e.test.ts`: **5/5 passing** (was 0/5).
- Full E2E suite: **27/28 passing**. The 1 skip = `phase3-schema.e2e.test.ts > Test 2 NOTIVISA outbox index query` — code is correct, but the `notivisa-outbox (labId, status, createdAt)` composite index was still in `CREATING` state at end of session. Test re-enables once index hits `READY`.

**Latent finding flagged for follow-up (not fixed):** the `*-rules.e2e.test.ts` files use **Firebase Admin SDK against a real Firestore project**. Admin SDK bypasses rules entirely. Even when these tests pass, they verify path-string parsing — never security posture. The suite is mislabeled. Need to migrate to `@firebase/rules-unit-testing` against the local emulator before claiming any rules coverage.

---

## Phase 9 — Latent code-quality fixes

**`functions/src/shared/laudo.ts` — client SDK → Admin SDK** (commit `6617f8c`).
The shared laudo helper was importing `firebase/firestore` (client SDK) inside a Cloud Functions context. Worked by coincidence because the Admin SDK shadows the global, but every cold start instantiated a useless client connection. Swapped to `firebase-admin/firestore`. Also flagged but left alone: `laudo.ts:86` operator-precedence latent bug `?? 0 + 1` should be `(?? 0) + 1` — same line, separate concern.

**Puppeteer lazy-load** (commit `264ebe2`).
PDF-generation functions imported puppeteer at module top level. Cold-start cost was paid by every function in the same code bundle — even ones that never render PDFs. Wrapped in lazy `await import('puppeteer')` factory; isolated to functions that actually need it.

---

## Phase 10 — Production deploy

**Command:** `firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2`

**Result:** Deploy complete with **5 warnings** — all non-blocking:

- 4 unused/invalid helper-function names in `firestore.rules` (lint warnings; rules still valid).
- 1 orphan index detected in Firestore: `insumo-movimentacoes (insumoId ASC, timestamp ASC)` — replaced by the corrected DESC variant. Needs `--force` to delete or can be left as harmless legacy.

Functions deploys for the day batched in two waves (~25 redeployed):
1. ADR-0017 cohort (signature bindings + audit/qualidade/equipamentos/procedimentos/pessoas/compras callables) — observed Cloud Run admin write throttling at 60 writes/min default.
2. Memory bumps + secret rebinds (post-Gemini provisioning + post-Resend removal).

---

## Commits (chronological, 2026-05-07 only)

| SHA | Time (BRT) | Subject | Phase |
|-----|-----------|---------|-------|
| `dd85970` | 00:26 | feat(00-01-turnos): T8-T10 prep — root CLAUDE.md + provision claims + firestore rules + TurnoForm fixes | (carry-over) |
| `35d5631` | 00:27 | docs(00-01-turnos): deployment readiness report | (carry-over) |
| `3a75859` | 00:29 | feat(00-04-risks): T1 — author ADR-0016 FMEA-lite methodology | (carry-over) |
| `8ed9603` | 00:30 | feat(00-03-lab-apoio): T1 scaffold types + service | (carry-over) |
| `7f5b8a0` | 00:32 | feat(00-03-lab-apoio): T2 callable scaffold + CNPJ validator | (carry-over) |
| `8d8a3e5` | 00:32 | feat(00-04-risks): T2 — scaffold types + service + NPR helpers | (carry-over) |
| `cc7f77a` | 00:33 | feat(00-03-lab-apoio): T3 create + softDelete + audit trigger | (carry-over) |
| `6cecd82` | 00:33 | feat(00-04-risks): T3 — callable scaffold | (carry-over) |
| `784ff29` | 00:34 | feat(00-03-lab-apoio): T4 remaining callables + expiry cron | (carry-over) |
| `8daae73` | 00:35 | feat(00-03-lab-apoio): T6 hooks + UI components | (carry-over) |
| `0fc73a5` | 00:35 | feat(00-04-risks): T4 — createRisk + softDeleteRisk + audit trigger | (carry-over) |
| `fe5f3a9` | 00:36 | feat(00-04-risks): T5 — updateRisk + registrarRevisao callables | (carry-over) |
| `00c1ee4` | 00:36 | feat(00-04-risks): T6 — scheduled review cron | (carry-over) |
| `39cc0ac` | 00:37 | docs(00-03-lab-apoio): T8 module CLAUDE.md | (carry-over) |
| `4cd50a5` | 00:37 | feat(00-04-risks): T8 — Firestore rules + composite indexes | (carry-over) |
| `0cad94a` | 00:38 | docs: 00-03 SUMMARY | (carry-over) |
| `98a6895` | 00:39 | feat(00-04-risks): T9 — shell integration | (carry-over) |
| `e0a834e` | 00:40 | feat(00-04-risks): T10 — module CLAUDE.md | (carry-over) |
| `359d5c0` | 00:41 | docs(00-04-risks): execution status report | (carry-over) |
| `824231b` | 00:56 | fix(types): resolve TS errors in lab-apoio callables | (carry-over) |
| `6ce1c27` | 01:01 | chore(00-03-lab-apoio): provision-modules-claims.mjs script | (carry-over) |
| `ad80a0e` | 01:01 | feat(00-04-risks): T11 — extend provisionModulesClaims | (carry-over) |
| `f613d09` | 01:02 | docs(00-03-lab-apoio): T9-T10 deployment readiness checklist | (carry-over) |
| `0479a35` | 01:03 | docs(00-03-lab-apoio): SUMMARY for T9 + T10 staging | (carry-over) |
| `dfe2fd7` | 01:13 | docs(00-04-risks): T11 deploy complete + cloud-logs day-1 | (carry-over) |
| `7c86e0d` | 01:23 | docs(plan-00-01): Turnos smoke test | (carry-over) |
| `c1b19ab` | 01:32 | docs: Plan 00-02 CTO manual PDF conversion complete | (carry-over) |
| **`cc6aa3b`** | **01:34** | **fix(audit,qualidade,equipamentos,procedimentos,pessoas,compras): bind HCQ_SIGNATURE_HMAC_KEY to all signing functions** | **Phase 2 (ADR-0017)** |
| **`c50cb96`** | **01:35** | **fix(management-review): consolidate chain hash secret + remove default-secret fallback** | **Phase 2 (ADR-0017)** |
| **`7a7736e`** | **01:35** | **fix(lgpd): add composite index for solicitacoes SLA cleanup cron** | **Phase 4 (index #1)** |
| **`f9a96f3`** | **01:35** | **docs(adr): ADR-0017 HMAC signature baseline reset** | **Phase 2 (ADR-0017)** |
| `93b33bb` | 01:41 | docs(phase-0): Plan 00-02 RT Manual Gate COMPLETE | (carry-over) |
| `408eb5b` | 01:43 | docs: Phase 0 completion checkpoint | (carry-over) |
| **`94e0097`** | **07:55** | **fix(analytics): bump aggregateAnalytics memory to 512MiB** | **Phase 5 (memory bump)** |
| **`c9f3232`** | **07:58** | **fix(indexes): add composite indexes for sgq-documentos + risks scheduled queries** | **Phase 4 (indexes #2 #3)** |
| **`b8a3f61`** | **08:06** | **feat(deploy-gate): add preflight secret-status check (ADR-0018)** | **Phase 3 (ADR-0018)** |
| **`223aa5c`** | **08:08** | **fix(indexes): correct insumo-movimentacoes timestamp direction (DESC for chainHash query)** | **Phase 4 (index #4)** |
| `af898a2` | 08:11 | docs(phase-0): CLOSURE REPORT | (carry-over) |
| **`5d824cc`** | **08:13** | **fix(functions): preemptively bump 7 scheduled functions to 512MiB** | **Phase 5 (memory bumps)** |
| `ad693ad` | 08:18 | docs: PROJECT.md — v1.3 final metrics | (carry-over) |
| `dd0dd49` | 08:18 | docs(phase-0): Cloud Logs health check | (carry-over) |
| `cca9bec` | 08:18 | docs(phase-0): SIGN-OFF MEMO | (carry-over) |
| **`37639e7`** | **08:19** | **feat(functions): wire 11 missing callables to index.ts (residual ADR-0017 cleanup)** | **Phase 6 (ghost callables)** |
| `7ce8055` | 08:20 | docs(phase-1): kickoff v1.3 stabilization | (carry-over) |
| `a8f4bf0` | 08:21 | docs(phase-1): execution complete | (carry-over) |
| `32bcf3d` | 08:21 | chore(v1.3): archive phases 08-12 to milestones | (carry-over) |
| `ebf3382` | 08:22 | docs(phase-1): EXECUTION SUMMARY | (carry-over) |
| `10acee0` | 08:26 | docs(v1.4): dependency matrix | (carry-over) |
| `f93fcb5` | 08:26 | docs(v1.4): roadmap readiness audit | (carry-over) |
| `63f193e` | 08:26 | docs(v1.4): RDC 978 compliance matrix | (carry-over) |
| `fa7bd28` | 08:27 | docs(v1.4): DICQ gap analysis | (carry-over) |
| `0e8d0bb` | 08:27 | docs(v1.4): requirements deep-dive | (carry-over) |
| `8045527` | 08:27 | docs(phase-0b): auditor pre-alignment strategy | (carry-over) |
| `211a193` | 08:28 | docs(phase-0b): auditor pre-alignment quick reference | (carry-over) |
| `288d0ac` | 08:28 | docs(v1.4): risk register deep-dive | (carry-over) |
| `74b177f` | 08:28 | docs(phase-2): planning v1.4 | (carry-over) |
| `86967cc` | 08:32 | docs(phase-2): COMPLETE | (carry-over) |
| **`243682e`** | **09:31** | **fix(indexes): add records collection-group index for analytics aggregator** | **Phase 4 (index #5)** |
| `e08a2ea` | 09:40 | docs(phase-3.1): Firestore Schema v1.4 | (carry-over) |
| **`ae8e705`** | **09:47** | **refactor(email): consolidate on SMTP via shared helper, drop Resend from listed callers** | **Phase 7 (SMTP consolidation)** |
| `448a95a` | 09:50 | perf(phase-3): capture performance baseline pre-deploy | (carry-over) |
| `67aa3c5` | 09:54 | docs: PHASE_3_HANDBOOK.md | (carry-over) |
| **`b96df21`** | **10:04** | **fix(rules): correct v1.4 path arity in 4 collections (Wave 2 pre-deploy fix)** | **Phase 8 (rules path arity)** |
| **`4d00db6`** | **10:07** | **Phase 3 Complete — Schema Extensions (v1.4)** | **Phase 8 (test fixes swept in)** |
| `08cacb8` | 10:08 | docs(e2e-tests): append resolution to rules failure taxonomy (27/28 green) | Phase 8 |
| **`bb37e91`** | **10:14** | **refactor(email): finish Resend → SMTP migration, drop dependency** | **Phase 7 (final Resend removal)** |
| **`e579903`** | **10:19** | **fix(tests): resolve 5 false-positive failures in rules E2E suite** | **Phase 8 (test fixes)** |
| **`264ebe2`** | **10:20** | **perf(functions): lazy-load puppeteer to cut cold-start bloat** | **Phase 9 (latent fixes)** |
| **`6617f8c`** | **10:20** | **fix(functions): replace client SDK with Admin SDK in shared/laudo.ts** | **Phase 9 (latent fixes)** |

**Bold rows = remediation-session commits.** Non-bold = parallel v1.3/v1.4 planning + 00-* RDC blockers carrying over from 2026-05-06 sessions.

---

## Production state at end of session

| Surface | Status |
|---------|--------|
| TSC (functions + web) | clean |
| Preflight gate (ADR-0018) | 7/7 secrets real |
| Tests E2E (rules + helpers) | 23/23 |
| Tests E2E (full suite) | 27/28 (1 skip — NOTIVISA index `CREATING`) |
| Indexes (5 new) | 4 `READY`, 1 `CREATING` (NOTIVISA `(labId, status, createdAt)`) |
| Functions deploy | ~25 redeployed today |
| Rules deploy | landed via `b96df21` (v1.4 path arity fix) |
| HMAC chain integrity | baseline reset documented (ADR-0017); rotation key 64-char hex; `validateChainIntegrityScheduled` next cycle pending |
| Audit trail | synthetic `chain-baseline-reset` event in `auditLogs` (manual Firestore Console verification per post-deploy report) |

---

## Pending (next session)

### Bloqueadores eliminados — nenhum

### High priority (3)

- **5 callables wire-first** (CAPA wave + Fornecedores wave) — v1.4.1 hotfix candidates per `orphan-callables-triage-2026-05-07.md`:
  - CAPA wave (single modal, ~4 d): `investigarNC` + `executarAcaoCorretiva` + `verificarEficacia`. Closes RT-claim + HMAC + effectiveness gaps in NC workflow.
  - Fornecedores wave (~3 d): `criarNotaFiscal` + `confirmarRecebimento`. Closes ADR-0002 enforcement (auto-lote creation from NF items).
  - Standalone (~2 d): `generateComplianceReport` — replaces local aggregation in `reviewTemplateService.ts` with chain-validated server call.
- **Cloud Run quota increase request** — form pre-filled in `cloud-run-quota-request-2026-05-07.md`. Submit via Cloud Console → IAM & Admin → Quotas. Justification: 60 writes/min default rate-limited the 04:00 UTC ADR-0017 redeploy burst; v1.5 adds 7-9 callables, v1.6 adds 4-6 mobile back-end; trajectory to 100+ functions in 6 months.
- **Orphan Firestore index cleanup** — `insumo-movimentacoes (insumoId ASC, timestamp ASC)` replaced by DESC variant. Either `firebase deploy --only firestore:indexes --force` or leave as harmless legacy.

### Medium priority (4)

- **5 rules.lint warnings** — unused functions + invalid var names in `firestore.rules`. Clean up in v1.5.
- **`functions/src/shared/laudo.ts:86`** — operator-precedence latent bug `?? 0 + 1` should be `(?? 0) + 1`. Same line as today's Admin SDK fix; separate concern flagged but not patched.
- **NOTIVISA composite index** — still in `CREATING` at end of session. Re-enable `phase3-schema.e2e.test.ts > Test 2` once `READY`.
- **`isServer()` operator-precedence dead branch** in `firestore.rules:62-65`. Current expression `A || (B && C)` makes the second branch mostly unreachable for real Admin SDK calls (which present with `request.auth == null`, not `request.auth.uid == null` + specific `aud`). Per `firestore-rules-wave2-diff-analysis-2026-05-07.md` recommendation, rewrite to `return request.auth == null || request.auth.token.server == true`.

### Low priority (3)

- **4 WIP modules excluded from tsconfig** (criticos/ia-strip/notivisa/portals) — fix-forward in v1.5 or remove from tree.
- **5 NO-UI-YET callables** (`auditTrail.getAuditTrail`, `auditTrail.validateChain`, `pessoas.criarQualificacao`, `equipamentos.registrarManutencao`) — wait for client wiring in v1.5+. Cost of leaving deployed: 1 Cloud Run revision each (~$0.50/month idle).
- **Migrate `*-rules.e2e.test.ts` to `@firebase/rules-unit-testing`** — current Admin SDK harness bypasses rules entirely. Suite is mislabeled. Until migration lands, the entire `*-rules.e2e.test.ts` file gives false confidence about rules coverage.

---

## Lessons learned

- **`PENDING_SET_*` is silent and costly.** 15 days of corrupt audit signatures + zero successful chain verifications, with no runtime signal. Functions returned 200s with garbage cryptography. ADR-0018 prevents recurrence — and proved its worth within 4 hours by catching `GEMINI_API_KEY` and `RESEND_API_KEY` in the same `PENDING_SET_*` state.
- **Plans marked complete same-day with success criteria checked are suspicious.** Wave 2 of 03-02 had `23/23 tests passing ✅` in its checklist but the tests had never been run — and the deliverable test file (`functions/test/phase-3-2/rules-v1-4.test.mjs`) was a `node:test` assertion over a JavaScript object literal describing rules in prose, not a real rules-emulator test. The same-day complete-stamp was the warning sign; treating the ✅ icon as evidence of execution is the bug.
- **Tests using Admin SDK don't test rules.** Even when green, they verify path-string parsing — never security posture. Need `@firebase/rules-unit-testing` against the local emulator, with the test file name reserved for files that actually exercise rules.
- **Index direction matters.** `(field ASC)` and `(field DESC)` are different indexes in Firestore — composite indexes are field-order- AND direction-sensitive. Rule of thumb: index direction must match the `orderBy` direction in the query. Two of today's 5 missing-index errors were direction mismatches, not missing indexes.
- **Source ≠ deployed.** ADR-0017 fixed bindings on "~25 functions" in source, but only 15 were actually deployed because 11 were never wired into `functions/src/index.ts`. Firebase Functions v2 only deploys what the entry module exports; a callable file that compiles cleanly but is never imported is silently absent from production. Need a CI gate that fails the build if `*.ts` under `functions/src/modules/` exports an `onCall|onSchedule|onDocument*` symbol that is not transitively re-exported by `functions/src/index.ts`.
- **256 MiB is the silent killer.** Default memory ceiling for scheduled functions; logs show 257–259 MiB peaks today, certain OOM as tenants grow. Bump preemptively, not reactively.

---

## References

### ADRs
- [`docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md`](../../docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md)
- [`docs/adr/ADR-0018-deploy-gate-secret-status-check.md`](../../docs/adr/ADR-0018-deploy-gate-secret-status-check.md)

### Reports
- [`cloud-logs-sweep-2026-05-07.md`](./cloud-logs-sweep-2026-05-07.md) — forensic 48h sweep, 5 issue classes
- [`function-deploy-reconciliation-2026-05-07.md`](./function-deploy-reconciliation-2026-05-07.md) — 11 ghost callables root cause
- [`post-deploy-verification-2026-05-07.md`](./post-deploy-verification-2026-05-07.md) — 6 checks (4 PASS / 1 PARTIAL / 1 MANUAL)
- [`post-deploy-health-2026-05-07-runtime.md`](./post-deploy-health-2026-05-07-runtime.md) — runtime health 08:19 UTC
- [`secrets-coverage-gaps-2026-05-07.md`](./secrets-coverage-gaps-2026-05-07.md) — GEMINI + RESEND inventory + impact
- [`e2e-rules-failure-taxonomy-2026-05-07.md`](./e2e-rules-failure-taxonomy-2026-05-07.md) — 10 → 1 failure resolution
- [`firestore-rules-wave2-diff-analysis-2026-05-07.md`](./firestore-rules-wave2-diff-analysis-2026-05-07.md) — path-arity bug forensics
- [`wave2-03-02-spec-summary-2026-05-07.md`](./wave2-03-02-spec-summary-2026-05-07.md) — plan-vs-delivered audit
- [`orphan-callables-triage-2026-05-07.md`](./orphan-callables-triage-2026-05-07.md) — 11 callables WIRE-FIRST/NO-UI-YET/RECLASSIFY
- [`cloud-run-quota-request-2026-05-07.md`](./cloud-run-quota-request-2026-05-07.md) — 600 writes/min request, pre-filled

### Commits (remediation core)
- `cc6aa3b` `c50cb96` `7a7736e` `f9a96f3` — ADR-0017 batch
- `94e0097` `c9f3232` `b8a3f61` `223aa5c` `5d824cc` — pre-08:30 BRT batch (analytics, indexes, deploy gate)
- `37639e7` — 11 callables wired
- `243682e` — records index
- `ae8e705` `bb37e91` — SMTP consolidation
- `b96df21` `4d00db6` `08cacb8` `e579903` — Wave 2 rules + tests
- `264ebe2` `6617f8c` — latent code-quality

### Obsidian
- `01_Projetos/HC_Quality_Roadmap.md` — pending: append Phase 0 (RDC blockers) + ADR-0017/0018 entries
- `01_Projetos/HC_Quality_Decisoes_Abertas.md` — pending: close "HMAC binding hygiene" item; add "v1.4.1 hotfix scope (5 callables)"
- `01_Projetos/HC_Quality_Compliance_DICQ.md` — pending: update §4.4 with chain-baseline-reset disclosure cross-reference
