---
phase: 0
plan: 00-02
slug: lgpd-pol-and-dpia
wave: 1
depends_on: []
estimate_days: 0.25
req_ids: [REQ-411]
risk_ids: [RISK-403, P0-R5, RISK-409]
compliance: [RDC 978 Art. 77, LGPD Art. 8, DICQ 4.3, DICQ 4.13]
modules_touched: [sgq]
callable: false
last_updated: 2026-05-07
locked_decisions: [DL-2, DL-3]
---

# Phase 0 / Plan 00-02 — LGPD Política + DPIA Template (SGQ)

## Goal

Two SGQ documents — `POL-LGPD-001 v1.0` (Política de Privacidade e Proteção de Dados) and `IT-LGPD-DPIA-001 v1.0` (Template de DPIA) — published as `vigente` with RT signature, surfaced via a "Documentos Obrigatórios" badge inside `SGQView`, with full audit chain (`sgq-documentos-audit`) capturing both creations, and an annual review reminder scheduled. **No new module scaffold; no patient consent flow; no callable migration.**

## Compliance citation

- **RDC 978/2025 Art. 77**: "Política de privacidade documentada e disponível ao titular dos dados."
- **LGPD (Lei 13.709/2018) Art. 8**: Consentimento livre, informado e inequívoco.
- **DICQ 4.3**: Documentos da qualidade — hierarquia POL/IT.
- **DICQ 4.13**: Controle de registros — audit chain preservada para 5 anos mínimo.

## Locked decisions applied

**DL-2 — SGQ (not SGD).** Both documents land in `/labs/{labId}/sgq-documentos/` with `tipo: 'POL'` and `tipo: 'IT'` respectively. No code in `src/features/sgd/`. The "Documentos Obrigatórios" badge is rendered inside `SGQView`, not under a `/sgd` route.

**DL-3 — No patient consent flow.** The acceptance criterion "Patient registration shows policy link + consent checkbox; consent persisted with version + timestamp" is **DROPPED** from this plan. Patient-portal LGPD UX is deferred to v1.4 Phase 5 (ADR-0015). LGPD evidence in Phase 0 is satisfied by SGQ docs `vigente` + audit chain + RT signature on `autoridadeEmitente`.

This plan does NOT touch `src/features/sgq/services/` for write paths — it uses the existing `useSGQDocumentos` (or equivalent) hook. The SGQ migration to Cloud Function callable is its own backlog item (SGQ-05 in `src/features/sgq/CLAUDE.md`) and is not in Phase 0 scope.

## Files affected

### New

- `docs/policies/POL-LGPD-001-v1.0.md` — source content (pt-BR, ~3 pages) for the policy. The `Documento.url` field will reference either an exported PDF in Firebase Storage or a Drive URL — see Step T2 below. Template structure:
  - 1. Coleta de dados (cadastrais, clínicos, biométricos quando aplicável)
  - 2. Finalidade (exames, laudos, faturamento, obrigações legais RDC 978 + RDC 222)
  - 3. Base legal (LGPD Art. 7º consentimento + Art. 7º II obrigação legal + Art. 11º II "f" tutela da saúde)
  - 4. Retenção (laudos 5 anos RDC 978 Art. 115; cadastrais conforme política interna)
  - 5. Compartilhamento (auditores DICQ, ANVISA via NOTIVISA, lab apoio mediante contrato Arts. 36–39 → cross-link to Plan 00-03)
  - 6. Direitos do titular (Art. 18 LGPD: acesso, correção, eliminação, portabilidade, revogação)
  - 7. DPO/Encarregado (nome, email, canal de contato — preencher por RT antes de publicar)
  - 8. Medidas de segurança (criptografia trânsito + repouso Firebase, MFA, audit trail tamper-evident, soft delete RN-06)
  - 9. Revisão (anual; cron reminder agendado por este plano)
  - 10. Contato regulador (ANPD)
- `docs/policies/IT-LGPD-DPIA-001-v1.0.md` — DPIA template (pt-BR). Template structure:
  - 1. Descrição do tratamento (escopo, finalidade)
  - 2. Categorias de dados tratados
  - 3. Finalidades específicas + base legal
  - 4. Riscos identificados (referência cruzada à FMEA-lite — `# OPEN —` see notes)
  - 5. Medidas de mitigação
  - 6. Owner + revisor + data próxima revisão
  - 7. Histórico de revisões (placeholder vazio)
- `src/features/sgq/components/DocumentosObrigatoriosBadge.tsx` — new component rendered inside `SGQView`. Accepts a manifest of mandatory codigos (initially `['POL-LGPD-001']`; future-proofed for `['POL-LGPD-001', 'POP-RT', 'POL-Biossegurança']`). For each codigo:
  - Looks up latest `vigente` doc via `useSGQDocumentos({tipo:['POL','IT']})`.
  - Renders status badge: emerald-500 check + version label if `vigente` v≥1.0; amber-400 warn if only `em_revisao`; red-400 X if missing.
  - Click → opens existing `DocumentoFormModal` in view mode (or scrolls to row in `DocumentosListView`).
  - Dark-first; SVG inline `currentColor`; `tabular-nums` on version.
- `functions/src/modules/lgpd/scheduledAnnualReview.ts` — NEW Cloud Scheduler function (or extend existing `lgpd/` module if a similar cron exists). Daily at 07:00 BRT, queries `sgq-documentos` where `codigo IN ['POL-LGPD-001','IT-LGPD-DPIA-001']` AND `proximaRevisao <= today` AND `status == 'vigente'`. Writes a notification to `/labs/{labId}/notifications/{id}` (existing collection) + emits an in-app banner via existing notification machinery. **Reuses the SGQ vencimento pattern (SGQ-04 backlog) — if not yet built, this plan implements the minimum viable version reused later by SGQ-04.**

### Modified

- `src/features/sgq/components/SGQView.tsx` — render `<DocumentosObrigatoriosBadge />` (placement: per CONTEXT.md OPEN recommendation **(a)**, a strip below the existing KPI header, above the filters/table). One source change, ≤8 lines.
- `firestore.rules` — no change (SGQ rules already cover `POL` and `IT` tipos; the cron writes to `/labs/{labId}/notifications/` which has its own rules).
- `firestore.indexes.json` — extend if needed: `(labId, tipo, status, codigo)` for the badge query — verify existing indexes; add only if missing.
- `functions/src/index.ts` — re-export `lgpd_scheduledAnnualReview`.
- No changes to `vite.config.ts` (no new lazy route — badge lives inside existing SGQ chunk).
- No changes to `src/AppRouter.tsx` or `src/types/index.ts`.

## Tasks (atomic, ordered)

### T1. Draft POL-LGPD-001 + IT-LGPD-DPIA-001 source markdown

**Outcome:** two markdown files in `docs/policies/` containing the full pt-BR text, RT/DPO placeholders left as `[PREENCHER ANTES DE PUBLICAR]`, ready for compliance review.
**Files:** docs/policies/POL-LGPD-001-v1.0.md, docs/policies/IT-LGPD-DPIA-001-v1.0.md.
**Steps:**
1. Author per template structure above.
2. Cross-reference RDC 978 Art. 77 + Art. 115 + LGPD Arts. 7º, 8º, 11º, 18º verbatim where applicable.
3. Section 5 of the policy must explicitly cite "Laboratórios de apoio (Arts. 36–39, ver Plano 00-03)".
4. Section 4 of the DPIA must cite "FMEA-lite — ver ADR-0016 / Plano 00-04". `# OPEN —` per CONTEXT.md: ship DPIA v1.0 with this forward reference, plan a v1.1 patch after ADR-0016 publishes; OR block until ADR-0016 (CTO call).
**Verification:** Markdown lint passes; pt-BR review by compliance lead (P0-R5 — CTO can self-approve if compliance lead unreachable, per Phase 0 risk register).

### T2. Convert markdown to PDF + upload to storage; capture URL

**Outcome:** two PDFs accessible at signed URLs (or Drive URLs as MVP per SGQ-01 backlog), copy-paste-ready for `Documento.url` field.
**Files:** N/A (operational — Pandoc or print-to-PDF).
**Steps:**
1. Render each markdown to PDF (`pandoc docs/policies/POL-LGPD-001-v1.0.md -o /tmp/POL-LGPD-001-v1.0.pdf` or browser print).
2. Upload to `/labs/labclin-riopomba/sgq/documentos/POL-LGPD-001/v1.pdf` (Firebase Storage; the SGQ MVP accepts URLs but path convention per SGQ-01 is documented).
3. Generate signed URL or set permissions per existing SGQ external-URL pattern.
**Verification:** Both PDFs open in incognito browser via the URL; file size <2MB each.

### T3. Create POL-LGPD-001 in SGQ via existing UI flow

**Outcome:** `Documento` doc created at `/labs/labclin-riopomba/sgq-documentos/{auto-id}` with `tipo:'POL'`, `codigo:'POL-LGPD-001'`, `versao:1`, `status:'em_revisao'` initially, then transitioned to `vigente` after RT review. Audit chain captures `created` + `status-changed` events per RN-SGQ-06.
**Files:** N/A (operational via SGQ UI).
**Steps:**
1. Login as RT (real session, not seed).
2. Navigate to `SGQView` → "Novo Documento".
3. Fill form: tipo=POL, codigo=`POL-LGPD-001`, titulo=`Política de Privacidade e Proteção de Dados (LGPD)`, versao=`1`, url=PDF URL from T2, autoridadeEmitente=`RT — [Nome do RT, CRBM-XXXX]`, dataEmissao=hoje, dataRevisao=hoje, proximaRevisao=hoje + 365 dias, status=`em_revisao`, observacoes=referência a RDC 978 Art. 77.
4. Save. Verify audit event `created` appears in Firestore at `/labs/labclin-riopomba/sgq-documentos-audit/`.
5. Open the doc in edit mode, transition status to `vigente` with motivo `Aprovada por RT em [data] após revisão de compliance`.
6. Verify second audit event `status-changed` with `fromStatus:'em_revisao'`, `toStatus:'vigente'`.
**Verification:** Two audit events present; doc visible in `DocumentosListView` with green badge; `verifyChain` over `sgq-documentos-audit` for this doc returns OK.

### T4. Create IT-LGPD-DPIA-001 in SGQ via existing UI flow

**Outcome:** Second doc created with `tipo:'IT'`, codigo `IT-LGPD-DPIA-001`, versao 1, status transitioned to `vigente`. Audit chain captures both events.
**Files:** N/A (operational).
**Steps:** Mirror T3 with IT tipo + DPIA template URL + autoridadeEmitente RT.
**Verification:** Mirror T3.

### T5. Build `DocumentosObrigatoriosBadge` component + integrate into SGQView

**Outcome:** badge strip rendered below KPIs in `SGQView`; both mandatory docs show emerald check; click navigates to row.
**Files:** src/features/sgq/components/DocumentosObrigatoriosBadge.tsx, src/features/sgq/components/SGQView.tsx.
**Steps:**
1. Manifest as a constant: `DOCUMENTOS_OBRIGATORIOS = [{codigo:'POL-LGPD-001', label:'Política de Privacidade (LGPD)'}, {codigo:'IT-LGPD-DPIA-001', label:'Template DPIA (LGPD)'}]`.
2. Hook into existing `useSGQDocumentos` (or equivalent — verify name in `src/features/sgq/hooks/`); for each codigo, find latest `vigente` doc.
3. Render dark-first chip row: emerald check / amber warn / red X SVG `currentColor` + label + `tabular-nums` version. Hover transition 150ms.
4. Click → opens `DocumentoFormModal` in view mode prefilled with the doc (reuse existing modal).
5. Strip placement: directly below KPI strip in `SGQView`, above filters. Adds ≤8 lines of JSX in `SGQView`.
**Verification:** `npm run dev` shows the strip; both docs show green badge; `npx tsc --noEmit` clean; `npm test` 738/738 green (no SGQ test regression).

### T6. Implement `lgpd_scheduledAnnualReview` Cloud Scheduler

**Outcome:** daily 07:00 BRT cron queries the two mandatory docs; if `proximaRevisao <= today`, writes a notification to `/labs/{labId}/notifications/`. Idempotent (skips dates already notified for the same `(codigo, proximaRevisao)`).
**Files:** functions/src/modules/lgpd/scheduledAnnualReview.ts, functions/src/index.ts.
**Steps:**
1. `onSchedule('0 7 * * *', 'America/Sao_Paulo', ...)` (Cloud Scheduler v2 syntax in firebase-functions/v2).
2. For each lab in `/labs/{labId}` (initially only Riopomba — extends naturally for v1.5 multi-tenant):
   - Query `sgq-documentos` `where codigo in ['POL-LGPD-001','IT-LGPD-DPIA-001'] and status == 'vigente' and proximaRevisao <= now`.
   - For each match, write a notification doc with `type:'lgpd-revisao-vencida'`, `codigo`, `severity:'high'`, `proximaRevisao`, `idempotencyKey: '${codigo}-${proximaRevisao}'`.
   - Skip if a notification with the same idempotencyKey already exists for this lab.
3. Reuse existing `/labs/{labId}/notifications/` collection rules (no rules change).
**Verification:** Emulator: set `proximaRevisao = yesterday` on test doc; trigger cron manually; assert notification doc created. Re-trigger; assert no duplicate.

### T7. Deploy hosting + new function

**Outcome:** `DocumentosObrigatoriosBadge` live in prod; cron scheduled.
**Files:** N/A (deploy commands).
**Steps:**
1. `npx tsc --noEmit` (web) + `cd functions && npx tsc --noEmit` clean.
2. `npm run build` clean.
3. `firebase deploy --only functions:lgpd_scheduledAnnualReview --project hmatologia2`.
4. `firebase deploy --only hosting --project hmatologia2`.
5. Hard reload prod; verify badge appears in `SGQView` with both docs green.
**Verification:** Smoke pass; Cloud Logs spot-check shows cron schedule registered.

### T8. Update root CLAUDE.md SGQ row

**Outcome:** row in "Módulos em produção" table reflects LGPD docs published.
**Files:** CLAUDE.md (root).
**Steps:** Append to existing `sgq` row last-update + brief note: `sgq | Em prod · Documentos da Qualidade (DICQ 4.3) — MQ/PQ/IT/FR/POL + versionamento + audit + POL-LGPD-001 + IT-LGPD-DPIA-001 (Phase 0) | YYYY-MM-DD`.
**Verification:** Markdown lint OK; row diff is single line.

## Acceptance criteria

(Verbatim from PHASE-0-PLAN Task 2 MINUS DL-3 dropped item, PLUS DL-2 routing.)

- [ ] Policy published in **SGQ** (not SGD) with version 1.0, status `vigente`, RT signature in `autoridadeEmitente`.
- [ ] Linked from `SGQView` "Documentos Obrigatórios" strip with emerald status badge.
- [ ] DPIA template (`IT-LGPD-DPIA-001`) exists in SGQ as `vigente` v1.0.
- [ ] Annual review reminder scheduled (`lgpd_scheduledAnnualReview` cron, fires daily; notifications sent at `proximaRevisao + 0` for both docs).
- [ ] Auditor can demonstrate: published policy + DPIA template + audit chain (`sgq-documentos-audit` for both docs) in <5 min.
- [ ] **DROPPED (DL-3):** ~~Patient registration shows policy link + consent checkbox; consent persisted with version + timestamp.~~ (Deferred to v1.4 Phase 5.)
- [ ] **NEW (DL-2 confirmation):** zero edits to `src/features/sgd/` in this plan. `git diff src/features/sgd/` is empty.

## Verification gates (pre-execute → post-execute)

- [ ] `npx tsc --noEmit` clean (web)
- [ ] `cd functions && npx tsc --noEmit` clean
- [ ] `npm test` baseline 738/738 passing (no SGQ regression)
- [ ] `verifyChain` script passes for `POL-LGPD-001` + `IT-LGPD-DPIA-001` audit subcoleção
- [ ] `bash scripts/monitor-cloud-logs.sh` clean post-deploy (24h baseline)
- [ ] Cloud Functions deploy success (`lgpd_scheduledAnnualReview` registered)
- [ ] Hosting deploy success
- [ ] No new `manualChunks` entry needed (badge lives in existing SGQ chunk); main bundle delta <2KB gzip

## Risk hooks

- **P0-R5 (compliance lead unavailable):** CTO can self-approve POL/DPIA per RISK-405 mitigation; this plan does NOT block on compliance lead beyond a 24h ack.
- **RISK-409 (regression in v1.3 modules):** zero edits to existing SGQ service / hook write paths; only the read-only badge component is added. SGQ module's existing 738/738 tests remain untouched.
- **RISK-403 closure contribution:** auditor demonstration script written into `src/features/sgq/CLAUDE.md` "Pendências conhecidas → resolvidas" with a one-line note + screenshot path.

## Skills to invoke (execution time)

- `hcq-deploy-gates` — pre-merge + pre-deploy gate (T7)
- (No `hcq-module-generator` — no new module.)
- (No `hcq-firestore-rules-generator` — no rules change.)

## Definition of done

- All acceptance criteria green
- Both SGQ docs `vigente` v1.0 with RT signature
- Audit chain (`sgq-documentos-audit`) shows `created` + `status-changed` events for both
- `DocumentosObrigatoriosBadge` rendered in `SGQView` with green badges for both
- `lgpd_scheduledAnnualReview` cron scheduled and idempotent
- Root `CLAUDE.md` SGQ row updated
- 24h Cloud Logs report archived to `.planning/phases/00-rdc-blockers/00-02-cloud-logs-day1.md`

## Notes (plan-specific)

- This is the **smallest plan in Phase 0** (0.25d). It exists as a discrete plan, not folded into 00-01, because (a) it requires compliance-lead human review (P0-R5), which gates merge but not other Wave 1 work, and (b) it touches only `src/features/sgq/**` while 00-01 touches `src/features/turnos/**` — disjoint folders allow strict parallel execution.
- **DL-2 invariant during execution:** if any task tempts you toward `src/features/sgd/`, STOP. The SGD module is the Drive importer for `sgd-externos`; LGPD documents are first-class SGQ documents. Re-read DL-2 in CONTEXT.md.
- **DL-3 invariant during execution:** if any task tempts you to add UI under `src/app/(auth)/registro/...` or anywhere a "patient" might log in, STOP. There is no patient auth in v1.4. Re-read DL-3 in CONTEXT.md.
- `# OPEN —` from CONTEXT.md: DPIA Section 4 references FMEA-lite (ADR-0016, Plan 00-04). Recommendation: ship DPIA v1.0 with the forward reference; patch to v1.1 after ADR-0016 publishes (versioned doc per RN-SGQ-05). CTO to confirm before T1 ends.
- Cloud Scheduler timezone: use `'America/Sao_Paulo'` (BRT/BRST automatic). Idempotency key prevents duplicate notifications across daylight transitions.
- The SGQ migration to Cloud Function callable (SGQ-05 backlog) is **out of scope for this plan**. Existing client-side `writeBatch` + rules-validated `validSignature()` is sufficient for Phase 0; Phase 1+ may revisit.
