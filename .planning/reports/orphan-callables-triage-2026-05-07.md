# Orphan Callables Triage — 2026-05-07

**Context:** Commit `37639e7` ("feat(functions): wire 11 missing callables to index.ts") deployed 11 Cloud Functions callables in `southamerica-east1`. A grep across `src/` confirms **zero web client invocations** of any of the 11 names. This report classifies each and recommends a triage path.

**Methodology:**

- Read every callable source under `functions/src/modules/`.
- Searched `src/features/**` for any `httpsCallable('<name>')` invocation, any service-level wrapper, any string literal of the callable name, and any sibling client-side path that does the same write directly to Firestore (which would indicate the callable is the intended replacement).
- Cross-referenced module CLAUDE.md files (`src/features/sgq/CLAUDE.md`, `src/features/capa-tracking/CLAUDE.md`) for explicit roadmap statements about callable migration.
- Cross-referenced `ADR-0017` (HMAC baseline reset) — all 11 callables were the ones that had `HCQ_SIGNATURE_HMAC_KEY.value()` bound but never reached production traffic.

---

## Summary

- Total orphan callables: **11**
- **WIRE-FIRST:** 5 (UI exists and uses a deprecated client-side write path that the callable was built to replace)
- **NO-UI-YET:** 5 (callable assumes a screen that has not been designed/built)
- **DELETE:** 0 (all callables serve a documented regulatory clause; none is gratuitous)
- **SERVER-ONLY UTILITY (re-classify):** 1 (`logAction` — better surfaced as an internal helper invoked by other callables, not a public client endpoint)

---

## Triage table

| #   | Callable                   | Module                    | Regulatory clause                                                      | Client status                                                                                                                                       | Recommendation                                                                                                           | Rough scope                                      |
| --- | -------------------------- | ------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 1   | `logAction`                | qualidade/auditTrail      | RDC 978 Art. 5.3 + DICQ 4.4                                            | No client caller; sgq/capa services do their own audit writes                                                                                       | **Re-classify as internal helper** — server-only, called by other callables                                              | 0.5 d (rename + lock down)                       |
| 2   | `getAuditTrail`            | qualidade/auditTrail      | RDC 978 Art. 5.3 (read-side)                                           | No UI for audit-trail browsing                                                                                                                      | NO-UI-YET — schedule v1.5 (auditor console)                                                                              | 3-4 d (table view + filters + signed-CSV export) |
| 3   | `validateChain`            | qualidade/auditTrail      | RDC 786 Art. 21 (tamper evidence on demand)                            | `validateChainIntegrityScheduled` runs on cron; no operator-triggered button                                                                        | NO-UI-YET — schedule v1.5 (RT "verify chain now" button)                                                                 | 1 d (button + result modal)                      |
| 4   | `generateComplianceReport` | qualidade/auditTrail      | RDC 978 Art. 122 (management review)                                   | `management-review/services/reviewTemplateService.ts` aggregates locally; no callable use                                                           | WIRE-FIRST — replace local aggregation with callable                                                                     | 2 d                                              |
| 5   | `investigarNC`             | qualidade/capaWorkflow    | RDC 978 Art. 86 + DICQ 4.14                                            | `sgq/naoConformidade/ncService.ts` writes `capaStatus` direct via `updateDoc` (no HMAC, no audit)                                                   | **WIRE-FIRST (high priority)** — remove direct write, route through callable                                             | 1.5 d                                            |
| 6   | `executarAcaoCorretiva`    | qualidade/capaWorkflow    | RDC 978 Art. 86 + DICQ 4.14                                            | Same — direct `updateDoc` in `ncService.ts`; `capa-tracking/CAPAStatusTransitionModal.tsx` is wired but uses `capaService.updateDoc`                | **WIRE-FIRST (high priority)** — capa-tracking CLAUDE.md explicitly lists this as pending (`updateCAPAStatus`)           | 1.5 d                                            |
| 7   | `verificarEficacia`        | qualidade/capaWorkflow    | RDC 978 Art. 86 + DICQ 4.14 (8D step "verify effectiveness")           | Same — no eficácia transition exists in client today                                                                                                | **WIRE-FIRST** — extends capa-tracking modal with one extra step                                                         | 1 d                                              |
| 8   | `criarQualificacao`        | pessoas/qualificacao      | DICQ 4.1 + RDC 786 Art. 22 (pessoal qualificado)                       | `src/features/personnel/` has no qualificacao screen at all                                                                                         | NO-UI-YET — schedule v1.5 (RT-only "grant qualification" form on operator profile)                                       | 3 d (modal + RT-claim guard + read view)         |
| 9   | `criarNotaFiscal`          | compras/notaFiscal        | RDC 786 Art. 42 (fiscal traceability) + ADR-0002 (lote↔NF obrigatório) | `fornecedores/services/notaFiscalService.ts` does direct `setDoc` — bypasses fornecedor qualification check baked into the callable                 | **WIRE-FIRST (high priority)** — closes ADR-0002 enforcement gap                                                         | 1 d                                              |
| 10  | `confirmarRecebimento`     | compras/notaFiscal        | RDC 786 Art. 42 + ADR-0002 (lote auto-creation from NF items)          | No "conferência" UI; client creates lotes manually via separate insumos screen — duplicates rastreabilidade                                         | **WIRE-FIRST** — adds "Conferir nota" action button to `FornecedoresView` NF list; auto-creates lotes via callable batch | 2 d                                              |
| 11  | `registrarManutencao`      | equipamentos/equipamentos | RDC 978 Art. 87 + DICQ 4.12 (equipamentos)                             | `equipamentoService.ts` has `enterManutencao`/`leaveManutencao` (status flag only); no structured Manutencao record with fornecedor + custo + peças | NO-UI-YET — schedule v1.5 (full manutenção form on equipment detail)                                                     | 2-3 d                                            |

---

## Per-callable analysis

### 1. `logAction`

**Source:** `functions/src/modules/qualidade/auditTrail.ts:18`
**Purpose:** Generic write to `/labs/{labId}/audit-trail/` with HMAC-signed entry. Payload: `{ labId, operation, modulo, acao, resultado, payload }`. Returns `{ entryId, timestamp }`.
**Regulatory clause:** RDC 978 Art. 5.3 (audit trail) + DICQ 4.4 (registros íntegros).
**Client search result:** Only matches in `src/__tests__/e2e/phase-3-integration.test.ts` (mock `auditService.logAction(...)`) and an unrelated `src/features/personnel/services/designacaoService.ts:191` function `validateChainHash` (collision on partial name). **No real client caller.**
**Why it's orphan:** Each domain module already writes its own audit trail in a domain-specific shape (e.g. `sgq-documentos-audit/`, `equipamentos-audit/`, capa `transitions[]`). A generic `logAction` overlaps with all of them and is not the right shape for any one of them.
**Recommendation:** **Re-classify as internal helper.** Move out of the public `onCall` surface, expose as an internal utility (`writeAuditEntry(...)`) consumed by the other 10 callables. Reduces the public function count, eliminates a generic-write attack surface, and keeps the HMAC sign path single-sourced.

---

### 2. `getAuditTrail`

**Source:** `functions/src/modules/qualidade/auditTrail.ts:73`
**Purpose:** Paginated read of `/labs/{labId}/audit-trail/` with filters (`modulo`, `operadorId`, `resultado`). Returns `{ entries, count, hasMore }`.
**Regulatory clause:** RDC 978 Art. 5.3 (read-side of the audit trail) + DICQ 4.4.
**Client search result:** No web caller. No `AuditTrailView` exists. No menu item in the hub.
**Why it's orphan:** The auditor-facing console was sketched in v1.4 roadmap but never built. Today, audit data is only inspected via Firestore console or `validateChainIntegrityScheduled` cron output.
**Recommendation:** **NO-UI-YET → schedule for v1.5.** Bundle with `validateChain` (#3) under a new `auditoria-trail` view: list + filter + "verify now" button + signed CSV export. Until then, the callable is dead code but preserves the contract; the cost of keeping it deployed is one Cloud Run revision.

---

### 3. `validateChain`

**Source:** `functions/src/modules/qualidade/auditTrail.ts:124`
**Purpose:** Runs `validateChainIntegrity(...)` from `audit/cryptoAudit` on the audit-trail collection of a given lab. Returns the verifier result (OK + first-broken-link).
**Regulatory clause:** RDC 786 Art. 21 (tamper-evidence verifiable on demand) + DICQ 4.4.
**Client search result:** No caller. The scheduled job `validateChainIntegrityScheduled` (cron 12h) covers the periodic case.
**Why it's orphan:** Designed for a "verify now" button on the auditor console — that button doesn't exist yet.
**Recommendation:** **NO-UI-YET → schedule for v1.5.** Pair with `getAuditTrail` UI. Add a single button "Verificar integridade da trilha agora" that returns OK / breakdown in a modal. Useful in audit visits when the auditor wants live proof, not the 12-hour cron lag.

---

### 4. `generateComplianceReport`

**Source:** `functions/src/modules/qualidade/auditTrail.ts:155`
**Purpose:** Aggregates audit-trail entries within a date range, computes operators/modules covered, success/failure/warning counts, validates chain across the range, returns RDC 978 + DICQ 4.4 compliance flags.
**Regulatory clause:** RDC 978 Art. 122 (management review) + DICQ 4.4.
**Client search result:** `src/features/management-review/services/reviewTemplateService.ts` exists and aggregates similar metrics — but does so **client-side** by reading individual collections, not via this callable. No call to `generateComplianceReport`.
**Why it's orphan:** Built ahead of the management-review module; service shipped earlier with local aggregation. Now the callable is a strict superset of what `reviewTemplateService` does (signed + chain-validated + server-side).
**Recommendation:** **WIRE-FIRST.** Replace the local aggregator in `reviewTemplateService.ts` with a `httpsCallable('generateComplianceReport')` invocation. Two wins: (a) management review now shows cryptographic chain validation, not just counts; (b) one fewer reason to widen client read rules on `audit-trail`. Estimated 2 days including UI to surface `chainViolations[]` if the report comes back `inválida`.

---

### 5. `investigarNC`

**Source:** `functions/src/modules/qualidade/capaWorkflow.ts:9`
**Purpose:** Transition NC into `capaStatus = 'investigacao'`. RT-only (`request.auth.token.responsavelTecnico`). Appends `capaHistorico` entry with `descricao` + `achados[]`. Signs with HMAC.
**Regulatory clause:** RDC 978 Art. 86 (CAPA) + DICQ 4.14 (gestão de NCs).
**Client search result:** `src/features/sgq/naoConformidade/ncService.ts` writes `capaStatus` directly via `updateDoc` (no HMAC, no RT-claim check, no signed `capaHistorico`). The CAPA workflow modal in `src/features/sgq/naoConformidade/components/CAPAWorkflow.tsx` calls these direct service methods.
**Why it's orphan:** This callable is the intended Phase 0b replacement for the direct-write pattern still used by `ncService.ts`. The migration was scaffolded but the client switch never happened.
**Recommendation:** **WIRE-FIRST (high priority).** This is a compliance gap, not an enhancement: today, any active member can flip `capaStatus`, not just RT, and transitions aren't HMAC-signed. Replacing the direct `updateDoc` with `httpsCallable('investigarNC')` closes both. Estimated 1.5 days including a deprecation period on the direct write path.

---

### 6. `executarAcaoCorretiva`

**Source:** `functions/src/modules/qualidade/capaWorkflow.ts:70`
**Purpose:** Transition NC into `capaStatus = 'acao'`. RT-only. Appends `capaHistorico` entry with `descricao` + `dataPrevista`. HMAC-signed.
**Regulatory clause:** RDC 978 Art. 86 + DICQ 4.14.
**Client search result:** Same direct-write path as #5. Additionally, `src/features/capa-tracking/CLAUDE.md` explicitly lists "Cloud Function `updateCAPAStatus`" as pending — and this callable is precisely that, named differently.
**Why it's orphan:** Built but never wired into either of the two NC/CAPA UIs (`sgq/naoConformidade` and `capa-tracking`).
**Recommendation:** **WIRE-FIRST (high priority).** Wire from both `CAPAWorkflow.tsx` (sgq) and `CAPAStatusTransitionModal.tsx` (capa-tracking). Bundling with #5 and #7 in the same wave is the right batch — same modal surface, same HMAC bind, same RT guard. **Update `src/features/capa-tracking/CLAUDE.md` Pendência #1** when wired (`updateCAPAStatus → executarAcaoCorretiva`).

---

### 7. `verificarEficacia`

**Source:** `functions/src/modules/qualidade/capaWorkflow.ts:131`
**Purpose:** Transition NC after CAPA execution: `resultado ∈ {eficaz, ineficaz, nao_concluida}`. If `eficaz` → status `fechada`. If `ineficaz` → reverts to `investigacao`. RT-only. HMAC-signed.
**Regulatory clause:** RDC 978 Art. 86 (CAPA closure with effectiveness verification) + DICQ 4.14 + 8D step "Verify Effectiveness".
**Client search result:** No caller. The `eficaz/ineficaz` UI doesn't exist in either NC view; today CAPAs close as a single status flip without a structured effectiveness check.
**Why it's orphan:** The full CAPA lifecycle (open → investigation → action → effectiveness → close) is not implemented client-side; only the first two transitions exist.
**Recommendation:** **WIRE-FIRST.** Extends `CAPAStatusTransitionModal` with an "Efetividade" step. Without this step, CAPAs close without auditable effectiveness evidence — DICQ 4.14 finding waiting to happen. Estimated 1 day on top of the wave that wires #5 and #6.

---

### 8. `criarQualificacao`

**Source:** `functions/src/modules/pessoas/qualificacao.ts:10`
**Purpose:** Grant a qualification to an operator: `tipo` + `modulosLiberados[]` + `validoDe`/`validoAte`. RT-only (member doc check). HMAC-signed. Blocks if there's an open NC on the `pessoas` module.
**Regulatory clause:** DICQ 4.1 (pessoal qualificado) + RDC 786 Art. 22 + DICQ 4.14 (NC blocking gate).
**Client search result:** `src/features/personnel/` has cargo + designação + org-chart hooks but **no qualificacao screen**. No callable invocation. The only `qualificacao` matches in client are `insumoQualificacao` (different domain) and `ciqImunoQualificacao` (different domain).
**Why it's orphan:** The "people qualification" management UI was scoped for v1.4 but deferred; today, qualifications are tracked off-system (Excel).
**Recommendation:** **NO-UI-YET → schedule for v1.5.** Moderate scope: add a "Qualificações" tab to the operator profile, RT-only "+ Conceder qualificação" modal, list view with `validoAte` countdown. Estimated 3 days including read view + revogação flow.

---

### 9. `criarNotaFiscal`

**Source:** `functions/src/modules/compras/notaFiscal.ts:14`
**Purpose:** Create NotaFiscal in `/labs/{labId}/notas-fiscais/`. **Validates that the fornecedor is qualified** (`isFornecedorQualificado`) before accepting — implements ADR-0002 invariant. HMAC-signed audit log.
**Regulatory clause:** RDC 786 Art. 42 (rastreabilidade fiscal) + ADR-0002 (lote ↔ NF obrigatório).
**Client search result:** `src/features/fornecedores/services/notaFiscalService.ts:85` (`createNotaFiscal`) does direct `setDoc` to the same collection. **Bypasses the fornecedor-qualification check.** UI: `NotaFiscalFormModal.tsx` calls the client service.
**Why it's orphan:** Same Phase 0b gap as #5–#7 — callable scaffolded, client write never deprecated.
**Recommendation:** **WIRE-FIRST (high priority).** Closes the ADR-0002 enforcement gap: today, an unqualified fornecedor can have NFs registered against it, breaking the qualified-supply chain. Replace `notaFiscalService.createNotaFiscal` with `httpsCallable('criarNotaFiscal')`. Estimated 1 day.

---

### 10. `confirmarRecebimento`

**Source:** `functions/src/modules/compras/notaFiscal.ts:101`
**Purpose:** Confirm NF receipt: stamps `dataRecebimento` + `conferidoPor` + `desviosObservados`, **and atomically creates one `Insumo` lote per NF item** (with `notaFiscalId`, `fornecedorId`, `nfItemIndex` — the ADR-0002 traceability spine). HMAC-signed audit log.
**Regulatory clause:** RDC 786 Art. 42 + ADR-0002.
**Client search result:** No caller. No "Conferir recebimento" action in `FornecedoresView`. Lotes are created manually in a separate insumos screen — meaning today the lote↔NF link is operator-discipline-dependent, not enforced.
**Why it's orphan:** UI for the conferência action was deferred; the callable does the heavy lifting (atomic batch of NF update + N lote inserts) but no button invokes it.
**Recommendation:** **WIRE-FIRST.** Adds a "Conferir nota" action to the NF list in `FornecedoresView`. Big traceability win: lotes are auto-generated with the correct foreign keys, eliminating the most common ADR-0002 violation pattern (operator forgets to set `notaFiscalId` on the lote). Estimated 2 days including conferência form (desvios capture + per-item review).

---

### 11. `registrarManutencao`

**Source:** `functions/src/modules/equipamentos/equipamentos.ts:163`
**Purpose:** Create a structured `Manutencao` record under `/labs/{labId}/equipamentos/{eqId}/manutencoes/`: `tipo` (preventiva/corretiva/emergencial), `descricao`, `fornecedorId`, `custo_total`, `pecasSubstituidas[]`, next maintenance date. Updates parent equipamento with `proximaManutenccaoPrevista`. HMAC-signed.
**Regulatory clause:** RDC 978 Art. 87 (manutenção de equipamentos) + DICQ 4.12.
**Client search result:** `equipamentoService.ts` exposes `enterManutencao`/`leaveManutencao` — these only flip a status flag and write a free-text motivo to the audit subcollection. **No structured maintenance record is created today.**
**Why it's orphan:** The full maintenance form (with fornecedor link, cost, parts, next date) was deferred; the simple status-flag flow shipped instead.
**Recommendation:** **NO-UI-YET → schedule for v1.5.** Adds a "Registrar manutenção" form on the equipment detail screen with required fornecedor selector + tipo + custo + peças. The current `enterManutencao` flow stays as a quick "send to maintenance" action; `registrarManutencao` is the structured record produced when maintenance closes. Estimated 2–3 days.

---

## Recommended execution order (post-triage)

**Wave A — WIRE-FIRST compliance closures (target: v1.4.1 hotfix, ~1 sprint):**

1. **#5 `investigarNC` + #6 `executarAcaoCorretiva` + #7 `verificarEficacia`** — single wave, same modal, closes RT-claim + HMAC + effectiveness gaps. Total ~4 d.
2. **#9 `criarNotaFiscal` + #10 `confirmarRecebimento`** — single wave, fornecedores domain, closes ADR-0002 enforcement + auto-lote creation. Total ~3 d.
3. **#4 `generateComplianceReport`** — single-file replacement in `reviewTemplateService.ts`. ~2 d.

**Wave B — Internal cleanup (no scope change, alongside Wave A):** 4. **#1 `logAction`** — re-classify as internal helper, remove from public surface. ~0.5 d.

**Wave C — NO-UI-YET (gate on v1.5 roadmap; do not build until UI scope is approved):** 5. **#2 `getAuditTrail` + #3 `validateChain`** — auditor console (combined ~5 d). 6. **#8 `criarQualificacao`** — pessoas qualificação UI (~3 d). 7. **#11 `registrarManutencao`** — equipamento manutenção structured form (~2–3 d).

**No deletes recommended.** All 11 callables serve a documented regulatory clause; the cost of keeping them deployed (one Cloud Run revision each, ~$0.50/month idle) is dominated by the cost of re-deriving them later.

---

## References

- Commit `37639e7` — wire 11 missing callables to index.ts
- `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` — these 11 are the cohort whose `HCQ_SIGNATURE_HMAC_KEY` binding was finally fixed but who never got production traffic
- `docs/adr/0002-lote-nf-obrigatorio.md` — the invariant `criarNotaFiscal` + `confirmarRecebimento` enforce
- `docs/adr/ADR-0007-equipamento-gate.md` — context for `registrarManutencao`
- `src/features/sgq/CLAUDE.md` §SGQ-05 — explicit roadmap entry for migration to callables
- `src/features/capa-tracking/CLAUDE.md` §Pendências — explicit "Cloud Function `updateCAPAStatus`" pending entry (= callables #5-#7)
- `.planning/reports/cloud-logs-sweep-2026-05-07.md` — confirms zero invocation traffic on these 11 functions in 48 h window
