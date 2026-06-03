---
phase: 0
plan: 00-03
slug: lab-apoio-contracts
wave: 2
depends_on: ['00-01']
estimate_days: 2.5
req_ids: [REQ-416]
risk_ids: [RISK-403, P0-R1, P0-R6, RISK-409]
compliance: [RDC 978 Art. 36, Art. 37, Art. 38, Art. 39, DICQ 4.14.8]
modules_touched: [lab-apoio, educacao-continuada (read-only), shell, functions, storage]
callable: true
last_updated: 2026-05-07
locked_decisions: [DL-1]
---

# Phase 0 / Plan 00-03 — Lab Apoio: Contratos de Terceirização

## Goal

Manage contracts with support laboratories: register CNPJ + AVS habilitação + vigência + exames terceirizados + certifications + annual evaluations + uploaded contract PDFs. Auditor can list active contracts with vigências expiring soon highlighted; expiry alerts fire 60d / 30d / 7d ahead via email + in-app. All state-changing writes via Cloud Function callables from day 1 (DL-1).

## Compliance citation

- **RDC 978/2025 Art. 36**: "Laboratório clínico que terceiriza exames deve manter contrato formal com laboratório de apoio."
- **Art. 37**: Contratos devem especificar exames, prazos, responsabilidades.
- **Art. 38**: Laboratório de apoio deve ter habilitação ANVISA vigente.
- **Art. 39**: Avaliação periódica do laboratório de apoio (mínimo anual).
- **DICQ 4.14.8**: Auditoria de fornecedor (orphaned in v1.3 audit, closed by this plan).

## Locked decisions applied

**DL-1 — Callable from day 1.** All state-changing writes ship as callables (`labApoio_createContrato`, `labApoio_updateContrato`, `labApoio_softDeleteContrato`, `labApoio_registrarAvaliacaoPeriodica`, `labApoio_uploadContratoAnexo`). Service client-side: read-only `subscribeContratos` + `getContrato`. `firestore.rules` declares `allow create, update, delete: if false`.

This plan inherits the callable + rules + audit-chain pattern established by Plan 00-01 (turnos). Use the `functions/src/modules/turnos/{validators,signatureCanonical,index}.ts` shape as the canonical template; rename `turnos` → `labApoio`. **Do not invent a new pattern.**

## Files affected

### New

- `src/features/lab-apoio/CLAUDE.md` — module rules (RN-LABAPOIO-01..07: CNPJ format, vigenciaInicio < vigenciaFim, habilitacaoAnvisa non-empty, soft-delete only, signature server-generated, chainHash continuity, criticidade enum, evaluation cycle annual).
- `src/features/lab-apoio/types/LabApoio.ts` — `Contrato`, `ContratoInput`, `ExameItem`, `Certificacao`, `AvaliacaoPeriodica`, `Contato`, `Endereco`, `LabApoioFilters`, `LabApoioAuditEvent`. Schema verbatim from PHASE-0-PLAN Task 3 deliverable #1.
- `src/features/lab-apoio/services/labApoioService.ts` — read-only `subscribeContratos(labId, opts, cb, onErr)` + `getContrato(labId, id)` + `mapSnapshotToContrato`. Plus typed `httpsCallable` wrappers for the 5 callables.
- `src/features/lab-apoio/services/labApoioStorageService.ts` — Firebase Storage helpers: `uploadContratoPdf(labId, contratoId, file): Promise<{url, size}>` (validates PDF mime + 10MB max client-side as fast feedback; **server callable re-validates** — defense in depth) + `getSignedUrl(labId, contratoId, fileName)` for auditor links.
- `src/features/lab-apoio/hooks/useLabApoio.ts` — mirrors `useColaboradores.ts`. Mutations call callables; throws without lab. Includes `confirmAvaliacaoPeriodica(contratoId, payload)` + `archiveContrato(contratoId, motivo)`.
- `src/features/lab-apoio/hooks/useExpiryAlerts.ts` — derives upcoming expiries (next 90 days) from `contratos[]`; bins as `[expiring-7d, expiring-30d, expiring-60d, expired]`; sorted by `vigenciaFim ASC`.
- `src/features/lab-apoio/components/LabApoioView.tsx` — entry: topbar (← Hub + title), KPI strip (total ativos, vencendo 60d, vencidos, sem avaliação anual em dia), tabs `[Contratos | Avaliações | Vencimentos]`.
- `src/features/lab-apoio/components/LabApoioList.tsx` — dark-first table: `Nome | CNPJ | AVS | Vigência | Exames (count) | Criticidade | Avaliação | Ações`. Filters: ativo, criticidade, expiring-soon. `tabular-nums` on dates and CNPJ. Empty state pt-BR.
- `src/features/lab-apoio/components/LabApoioForm.tsx` — multi-step form (4 steps): (1) Dados gerais (nome, razaoSocial, CNPJ with mask + checksum, endereço, AVS + vigência, criticidade), (2) Exames (add/remove rows of `{codigo, descricao, tat}`), (3) Certificações + Contatos, (4) Upload contrato PDF. Step navigation preserves draft in component state. Disclaimer banner (P0-R1 mitigation) at step 1 in amber: "Template de contrato baseado em RDC 978 Arts. 36–39. Não substitui revisão jurídica. Revisão prevista para Phase 1 semana 2."
- `src/features/lab-apoio/components/LabApoioAvaliacao.tsx` — annual evaluation form per Art. 39: data, resultado (`'aprovado'|'aprovado_com_ressalva'|'reprovado'`), responsavel (combobox over `colaboradores`), observacoes, anexo opcional. Submits via callable.
- `src/features/lab-apoio/components/VencimentosWidget.tsx` — list view of expiring contracts with countdown badges (red <7d, amber <30d, yellow <60d). Click → opens contract detail.
- `functions/src/modules/labApoio/index.ts` — barrel.
- `functions/src/modules/labApoio/validators.ts` — Zod schemas + `assertLabApoioAccess(auth, labId)` + `labApoioCollection(labId)` + `ensureLabApoioLabRoot(labId)` + `validateCNPJ(cnpj)` (14-digit + checksum) + `validateAVS(avs)` (non-empty + min length).
- `functions/src/modules/labApoio/signatureCanonical.ts` — server-side SHA-256 over `sortedStringify({labId, cnpj, vigenciaInicioMs, vigenciaFimMs, tsMs})`.
- `functions/src/modules/labApoio/createContrato.ts` — `labApoio_createContrato`: assertAccess → Zod validate → CNPJ checksum → `vigenciaInicio < vigenciaFim` → re-read existing contracts to enforce uniqueness on `(labId, cnpj)` (RN-LABAPOIO-01) → generate signature → atomic batch (contrato + audit event).
- `functions/src/modules/labApoio/updateContrato.ts` — `labApoio_updateContrato`: only mutable fields (observacoes, contatos, certificacoes append-only history-preserving); rebuilds signature; appends audit event with `changes` diff.
- `functions/src/modules/labApoio/softDeleteContrato.ts` — `labApoio_softDeleteContrato({contratoId, motivo})`: writes `deletadoEm` + `softdeleted` audit event with chainHash continuity.
- `functions/src/modules/labApoio/registrarAvaliacaoPeriodica.ts` — `labApoio_registrarAvaliacaoPeriodica({contratoId, avaliacao})`: re-reads contrato → appends `avaliacao` to `avaliacaoPeriodica[]` (history-preserving, never overwrites) → updates `proximaAvaliacaoEm = avaliacao.data + 365d` → audit event `avaliacao-registrada`.
- `functions/src/modules/labApoio/uploadContratoAnexo.ts` — `labApoio_uploadContratoAnexo({contratoId, fileMeta})`: receives the Storage path of an already-uploaded PDF (Storage rules govern the upload itself), validates path matches `/labs/{labId}/lab-apoio/{contratoId}/contrato.pdf`, validates size <10MB via `bucket.file(path).getMetadata()`, updates `contrato.anexoContratoUrl` + `anexoContratoSize` + emits audit event `anexo-uploaded`.
- `functions/src/modules/labApoio/checkExpiry.ts` — `labApoio_checkExpiry` Cloud Scheduler: daily 06:00 BRT. For each contract with `ativo == true && deletadoEm == null`, evaluate `daysUntil(vigenciaFim)`; if 60 / 30 / 7 / 0 → write notification (`/labs/{labId}/notifications/`) + send email via existing email infra (extend or fall back to logging if not present). Idempotency key: `${contratoId}-${threshold}`.
- `functions/src/modules/labApoio/onContratoEventCreated.ts` — chainHash trigger (mirror Plan 00-01 onTurnoEventCreated).

### Modified

- `functions/src/index.ts` — re-export 5 callables + 1 trigger + 1 cron under `// ─── lab-apoio module (Phase 0 — 2026-05-07)` block.
- `firestore.rules` — new block `match /labs/{labId}/lab-apoio/{contratoId}` (read: `isActiveMemberOfLab(labId)`; create/update/delete: `if false`); subcollection `events/{eventId}` (read: lab member; write: `if false`). **Note:** PHASE-0-PLAN says `labApoio` (camelCase); we use `lab-apoio` (kebab-case) for project-convention consistency — OPEN per CONTEXT.md, defaulting to kebab-case unless CTO objects.
- `storage.rules` — new block `match /labs/{labId}/lab-apoio/{contratoId}/{file}` (read: `isActiveMemberOfLab`; write: `isAdminOrOwner` + size <10MB + content-type `application/pdf`).
- `firestore.indexes.json` — composite `(labId, ativo, vigenciaFim ASC)` for expiring-soon query; `(labId, ativo, criticidade, vigenciaFim ASC)` for criticality-filtered list.
- `vite.config.ts` — `manualChunks['feature-lab-apoio']: [/src\/features\/lab-apoio\//]`.
- `src/AppRouter.tsx` (or auth/AuthWrapper.tsx) — lazy route `'lab-apoio'` → `<LabApoioView />`.
- `src/types/index.ts` — `View` union `'lab-apoio'`.
- `src/features/hub/ModuleHub.tsx` — Hub tile `lab-apoio` (SVG inline icon: handshake or building+arrow).
- `CLAUDE.md` (root) — new row in "Módulos em produção" + REQ-416 cross-link.
- `.planning/milestones/v1.4-REQUIREMENTS.md` — `# OPEN —` per CONTEXT.md: backfill REQ-416 verbatim before this plan starts (CTO action). If not done, this plan inserts a placeholder REQ-416 block referenced from the milestone-level docs.
- `functions/scripts/provision-modules-claims.ts` — extend with `'lab-apoio'`.

## Tasks (atomic, ordered)

### T1. Backfill REQ-416 + scaffold types + service skeleton (read-only)

**Outcome:** REQ-416 written into REQUIREMENTS.md (or stub committed referencing PHASE-0-PLAN); `types/LabApoio.ts` + `services/labApoioService.ts` exist.
**Files:** .planning/milestones/v1.4-REQUIREMENTS.md, src/features/lab-apoio/types/LabApoio.ts, src/features/lab-apoio/services/labApoioService.ts.
**Steps:**

1. **OPEN —** Author REQ-416 stub (mirror REQ-411 format). User story, acceptance criteria from PHASE-0-PLAN Task 3, effort, phase=v1.4 Phase 0. CTO to confirm wording.
2. Invoke `Skill hcq-module-generator` with `lab-apoio` (read-only mode).
3. Define types verbatim per PHASE-0-PLAN Task 3 schema.
4. Implement read-only `subscribeContratos`, `getContrato`, `mapSnapshotToContrato`.
5. Add `httpsCallable` wrappers + `unwrapCallableError`.
   **Verification:** `npx tsc --noEmit` clean.

### T2. Implement callable scaffold (validators, signatureCanonical, index, CNPJ checker)

**Outcome:** functions/src/modules/labApoio scaffold ready; CNPJ checksum function unit-tested.
**Files:** functions/src/modules/labApoio/{validators,signatureCanonical,index}.ts, functions/test/labApoio/cnpj.test.mjs.
**Steps:**

1. Mirror `functions/src/modules/turnos/validators.ts` (Wave 1 output) — rename, adapt schemas.
2. Implement `validateCNPJ(cnpj: string): boolean` with full Mod-11 checksum (8 valid + 4 invalid test cases).
3. Implement `validateAVS(avs: string): boolean` (non-empty, minimum 6 chars — Anvisa AVS format varies; conservative check).
4. Mirror signatureCanonical from turnos.
5. Unit-test CNPJ + AVS validators with `node:test`.
   **Verification:** `cd functions && npx tsc --noEmit` clean; `node --test functions/test/labApoio/cnpj.test.mjs` green (12 cases).

### T3. Implement create + softDelete + audit trigger

**Outcome:** core write path working in emulator: `labApoio_createContrato` validates, signs, batches; chainHash trigger persists.
**Files:** createContrato.ts, softDeleteContrato.ts, onContratoEventCreated.ts, functions/src/index.ts.
**Steps:**

1. Implement `labApoio_createContrato`: enforce CNPJ uniqueness within lab (RN-LABAPOIO-01) by querying existing contratos with `where(cnpj == input.cnpj, deletadoEm == null).limit(1)` — reject if found.
2. Implement `labApoio_softDeleteContrato` with `motivo: string (min 10 chars)` requirement.
3. Implement chainHash trigger (mirror Plan 00-01).
4. Wire into `functions/src/index.ts`.
5. Extend smoke script `functions/scripts/smoke-labapoio-callables.mjs` (mirror EC smoke pattern): unauth → fail; valid create → ok; duplicate CNPJ → fail; soft delete → ok; create after soft delete (different CNPJ) → ok.
   **Verification:** Smoke script all green in emulator.

### T4. Implement update + avaliacao periodica + upload metadata

**Outcome:** remaining 3 callables operational. Storage upload path validated server-side.
**Files:** updateContrato.ts, registrarAvaliacaoPeriodica.ts, uploadContratoAnexo.ts.
**Steps:**

1. `updateContrato`: only `observacoes`, `contatos`, `certificacoes` mutable; immutable fields rejected with `failed-precondition`.
2. `registrarAvaliacaoPeriodica`: append-only on `avaliacaoPeriodica[]`; validate `data <= today`; auto-update `proximaAvaliacaoEm`.
3. `uploadContratoAnexo`: read Storage metadata for the path; reject if size >10MB or content-type != PDF; persist `anexoContratoUrl` + size.
   **Verification:** Smoke extended with 3 cases.

### T5. Implement expiry cron + email/in-app notification

**Outcome:** `labApoio_checkExpiry` runs daily 06:00 BRT; idempotent across re-runs.
**Files:** checkExpiry.ts, functions/src/index.ts.
**Steps:**

1. `onSchedule('0 6 * * *', 'America/Sao_Paulo', ...)`.
2. For each lab → query active contratos → compute days-until-expiry → for each threshold (60, 30, 7, 0) write notification with idempotency key.
3. If existing email infra present (check `functions/src/modules/emailBackup/`), reuse for email notifications; else log warning + leave email as backlog.
   **Verification:** Emulator: set `vigenciaFim = now + 7d` on test contrato; trigger cron; one notification appears. Re-trigger; no duplicate.

### T6. Build hooks + UI components

**Outcome:** all components rendering against emulator data; multi-step form works; expiring-soon widget shows countdown.
**Files:** hooks/useLabApoio.ts, hooks/useExpiryAlerts.ts, components/LabApoioView.tsx, components/LabApoioList.tsx, components/LabApoioForm.tsx, components/LabApoioAvaliacao.tsx, components/VencimentosWidget.tsx.
**Steps:**

1. `useLabApoio` mirroring `useColaboradores`.
2. `useExpiryAlerts` derives expiring bins client-side from current `contratos[]`.
3. `LabApoioForm` 4-step wizard with disclaimer banner (P0-R1) at step 1.
4. CNPJ input with mask + on-blur checksum validation (consume client-side `validateCNPJ`); fail-soft (allow submit, server rejects).
5. PDF upload: standard Firebase Storage `uploadBytes` to `/labs/{labId}/lab-apoio/{contratoId}/contrato.pdf`, then call `labApoio_uploadContratoAnexo` to register URL.
6. `LabApoioAvaliacao` with combobox over `colaboradores` (consume `useColaboradores({somenteAtivos: true})`).
7. `VencimentosWidget` countdown badges with `tabular-nums` and color tokens per `.claude/rules/performance.md` constraints (<3KB filter response — use derived state, not new query).
   **Verification:** `npm run dev` smoke; can create contrato + upload PDF + register avaliação + see in vencimentos widget.

### T7. Write Firestore + Storage rules; emulator tests

**Outcome:** rules emulator confirms client-direct write deny, Admin SDK callable allow, Storage upload deny if size>10MB or non-PDF.
**Files:** firestore.rules, storage.rules, firestore.indexes.json, functions/test/labApoio/rules.test.mjs.
**Steps:**

1. Invoke `Skill hcq-firestore-rules-generator` with collection `lab-apoio` and DL-1 convention.
2. Add storage.rules block with size + content-type validation.
3. Add 2 composite indexes.
4. Rules emulator test: read by member ✅; create by member ❌; create by Admin SDK ✅; delete ❌; events subcollection write ❌; storage upload >10MB ❌; storage upload non-PDF ❌.
   **Verification:** `firebase emulators:exec ... rules.test.mjs` green; `npm test` baseline 738/738 still green.

### T8. Wire shell integration + lazy route + manualChunks

**Outcome:** `/hub` tile + lazy chunk verified.
**Files:** src/types/index.ts, src/AppRouter.tsx, src/features/hub/ModuleHub.tsx, vite.config.ts.
**Steps:** Mirror Plan 00-01 T7.
**Verification:** `npm run build` produces `feature-lab-apoio` chunk; main bundle delta <5KB gzip vs Wave 1 baseline.

### T9. Write module CLAUDE.md + update root CLAUDE.md + Obsidian checklist

**Outcome:** module governance doc + root table row + Obsidian checkbox tickled.
**Files:** src/features/lab-apoio/CLAUDE.md, CLAUDE.md (root), Obsidian `01_Projetos/HC_Quality_Checklist_Auditoria.md` (item 4.14.8 → `[x]`).
**Verification:** Files written; Obsidian sync confirmed.

### T10. Pre-deploy: provision claim + dry-run; deploy in order; Cloud Logs

**Outcome:** rules + functions + hosting deployed; 24h Cloud Logs running.
**Files:** N/A (operational).
**Steps:**

1. `provisionModulesClaims({dryRun:false})` granting `modules['lab-apoio'] = fullAccess()` to active users.
2. `npx tsc --noEmit` (web + functions); `npm run build`.
3. `firebase deploy --only firestore:rules,firestore:indexes,storage:rules --project hmatologia2`.
4. `firebase deploy --only "functions:labApoio_*,functions:onContratoEventCreated" --project hmatologia2`.
5. `firebase deploy --only hosting --project hmatologia2`.
6. Hard reload + smoke (create + upload + avaliação + expiring widget).
7. `bash scripts/monitor-cloud-logs.sh 24 30`.
   **Verification:** Deploy logs clean; smoke green.

## Acceptance criteria

(Verbatim from PHASE-0-PLAN Task 3 + DL-1 additions.)

- [ ] Lab apoio contracts registered with full metadata (CNPJ + AVS + vigência + exames + certificações).
- [ ] Contract documents uploaded (PDF, max 10MB) and linked.
- [ ] Auditor can list active contracts with expiring vigências highlighted (60d / 30d / 7d / expired bins).
- [ ] Expiry alerts trigger 60d / 30d / 7d ahead via email + in-app (idempotent across cron re-runs).
- [ ] Annual evaluation (Art. 39) registered per contract; missing evaluations flagged in KPI strip.
- [ ] Logical signature + audit trail validate (`verifyChain` passes for sample contracts).
- [ ] **DL-1 observable:** rules deny `setDoc` from real client SDK against `/labs/.../lab-apoio/...` even with valid signature shape; Storage rules deny non-PDF + >10MB upload.
- [ ] Disclaimer banner ("template não substitui revisão jurídica") visible on form step 1 (P0-R1 mitigation).

## Verification gates (pre-execute → post-execute)

- [ ] `npx tsc --noEmit` clean (web)
- [ ] `cd functions && npx tsc --noEmit` clean
- [ ] `npm test` baseline 738/738 passing (no regression)
- [ ] CNPJ validator unit tests green (12 cases)
- [ ] Firestore rules emulator: read ok, write client deny, Admin SDK ok, delete deny
- [ ] Storage rules emulator: PDF <10MB ok, non-PDF deny, >10MB deny
- [ ] `verifyChain` script passes for created contracts
- [ ] `bash scripts/monitor-cloud-logs.sh` clean post-deploy (24h)
- [ ] Cloud Functions deploy success (5 callables + 1 trigger + 1 cron)
- [ ] Hosting deploy success
- [ ] `npm run build` produces `feature-lab-apoio` chunk; main bundle delta <5KB gzip

## Risk hooks

- **P0-R1 (legal review):** disclaimer banner shipped; legal review scheduled Phase 1 Week 2 in parallel; contract is operationally functional pre-review.
- **P0-R6 (perf regression):** lazy route + manualChunks; Lighthouse spot-check on `/hub` post-deploy unchanged.
- **RISK-409 (regression in v1.3):** zero edits to existing module code; baseline 738/738 tests green; smoke 3 random v1.3 flows post-deploy.
- **RISK-403 closure:** auditor demonstration script in module CLAUDE.md.
- **Inherited from Wave 1 (Plan 00-01):** the chainHash trigger pattern, the rules block format, and the callable validators shape are copied with renames; quality of Plan 00-01 directly affects this plan's velocity.

## Skills to invoke (execution time)

- `hcq-module-generator` — scaffold (T1, T6)
- `hcq-firestore-rules-generator` — Firestore + Storage rule blocks (T7)
- `hcq-ciq-audit-trail` — events subcoleção + chainHash (T3)
- `hcq-pdf-export-scaffold` — **deferred** to v1.4 Phase 1+ (annual contract export PDF is not in Phase 0 acceptance; out of scope per RESEARCH-driven prioritization)
- `hcq-deploy-gates` — pre-merge + pre-deploy (T10)

## Definition of done

- All acceptance criteria green
- Logical signature server-generated on every state-changing op
- Audit trail event recorded for every operation including PDF anexo upload
- Lazy route + manualChunks confirmed
- `src/features/lab-apoio/CLAUDE.md` written
- Root `CLAUDE.md` "Módulos em produção" row added
- Obsidian `HC_Quality_Checklist_Auditoria.md` item 4.14.8 → `[x]`
- 24h Cloud Logs report archived to `.planning/phases/00-rdc-blockers/00-03-cloud-logs-day1.md`
- REQ-416 backfilled into `v1.4-REQUIREMENTS.md`

## Notes (plan-specific)

- This plan **inherits** the callable + audit-chain + rules shape from Plan 00-01 (turnos). Do NOT redesign. The pattern is: `validators.ts` (Zod + assertAccess + collection helper) → `signatureCanonical.ts` (server SHA-256) → one file per callable (`createContrato.ts`, etc) → `onContratoEventCreated.ts` chainHash trigger → `index.ts` barrel → wire into `functions/src/index.ts`.
- **OPEN — collection name (`lab-apoio` vs `labApoio`):** PHASE-0-PLAN spec says camelCase; project convention is kebab-case (sgq-documentos, sgd-externos, controle-temperatura). This plan defaults to **kebab-case** unless CTO objects in T1.
- **OPEN — REQ-416 backfill:** must be done before T2 starts so that the plan can cite a stable REQ ID. Recommendation in CONTEXT.md.
- Storage path canonicalized: `/labs/{labId}/lab-apoio/{contratoId}/contrato.pdf` (single file per contract; future versions append `-vN` suffix). Rules enforce.
- **Cross-link from Plan 00-02:** the LGPD policy section 5 references "Laboratórios de apoio (Arts. 36–39)". The two plans must be consistent — review Plan 00-02 POL text before publishing this plan's contract template.
- Email infrastructure: if `functions/src/modules/emailBackup/` does not expose a generic `sendNotification` callable, this plan logs the email intent + adds a backlog item. Do NOT block on building generic email infra.
- The contract template wording (PDF content) is supplied as a static asset in T6 step 5 (`docs/templates/contrato-laboratorio-apoio-v1.0.pdf`). Source the wording from RDC 978 Arts. 36–39 verbatim + DICQ 4.14.8 + the Riopomba lab's existing offline contract structure (CTO to provide).
- Performance: the expiring-soon query uses `(labId, ativo, vigenciaFim ASC)` index — fast even at 10x current contract count.
