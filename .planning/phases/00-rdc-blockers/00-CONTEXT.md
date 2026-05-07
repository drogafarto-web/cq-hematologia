---
phase: 0
title: RDC 978 Blockers Resolution
milestone: v1.4
created: 2026-05-07
last_updated: 2026-05-07
mode: gsd-plan-phase
source_spec: .planning/milestones/v1.4-PHASE-0-PLAN.md
requirements_doc: .planning/milestones/v1.4-REQUIREMENTS.md
risk_register: .planning/milestones/v1.4-RISK-REGISTER.md
duration_estimate: 7-9 days (1.5 + 0.25 + 2.5 + 3.5 = 7.75d engineering with parallel waves)
plans: 4
waves: 2
---

# Phase 0 — RDC 978 Blockers Resolution

## Phase boundary

**In scope (Phase 0 only):**

- New module `turnos` — supervisor shift registry (REQ-403 partial; RDC 978 Art. 122 + RDC 786).
- Two new SGQ documents: `POL-LGPD-001` (LGPD policy) + `IT-LGPD-DPIA-001` (DPIA template) plus a "Documentos Obrigatórios" badge surface inside `SGQView` (REQ-411; RDC 978 Art. 77).
- New module `lab-apoio` — third-party support-lab contracts (new REQ-416; RDC 978 Arts. 36–39 + DICQ 4.14.8).
- New module `risks` — FMEA-lite risk register (REQ-412; DICQ 4.14.6 + ISO 15189 §8.5).
- ADR-0016 documenting the FMEA-lite methodology choice (Task 4 design decision).
- Firestore rules + Firebase Storage rules + Cloud Function callables + scheduled jobs as required by each plan.

**Out of scope (explicitly deferred):**

- Patient registration consent flow / patient as auth entity → **deferred to v1.4 Phase 5 (Patient Portal, ADR-0015)**. See DL-3 below.
- Multi-tenant rollout for the new modules beyond `labclin-riopomba` → v1.5 (REQ-502).
- Legal review of Lab Apoio contract template → ships behind disclaimer in Phase 0; legal review runs in parallel with Phase 1 (P0-R1).
- Initial CSV seed of 10–15 known risks → optional stretch, may slip to v1.4.1 if Day 9 hard stop hit (P0-R4).
- Migration of existing client-side regulatory writes in other modules → governed by their own roadmap; Phase 0 only callable-izes the three NEW collections (`turnos`, `lab-apoio`, `risks`).

---

## Locked decisions (DL-1, DL-2, DL-3 — supersede milestone spec)

These three overrides were locked by CTO on 2026-05-07 and **must propagate to every plan** in this phase.

### DL-1 — Callable from day 1

**Rule:** every state-changing write to `turnos`, `lab-apoio`, `risks` ships as a Cloud Function callable from the first deploy. Client-side service is read-only (`subscribe*`, `get*`) plus a `softDelete*` callable wrapper for chainHash continuity. **No client-direct `create*` / `update*` / direct `softDelete*` on these collections.**

**Rules consequence:** `firestore.rules` for the three new collections must use `allow create, update: if false;` (callable enforces invariants via Admin SDK). `allow delete: if false;` always (RN-06 soft delete via callable update).

**Plans 00-01, 00-03, 00-04 must each include a callable scaffold task.** Plan 00-02 is exempt (it reuses existing SGQ writeBatch pattern; SGQ migration to callable is its own backlog item per `src/features/sgq/CLAUDE.md` SGQ-05).

**Reference:** CLAUDE.md "Convenções invioláveis" → "Escrita regulatória via Cloud Function callable (Fase 0b+)"; ADR-0012 (universal audit trail); `.claude/rules/firestore-security.md`.

### DL-2 — SGQ (not SGD) for POL-LGPD-001

**Rule:** Plan 00-02 deliverables live in the **`sgq` module** at `/labs/{labId}/sgq-documentos/`, with `tipo: 'POL'` for the policy and `tipo: 'IT'` for the DPIA template. The "Documentos Obrigatórios" badge integrates into `SGQView`, not into a `/sgd` route.

**Code reality:** `src/features/sgd/` is a Drive importer for external documents (`sgd-externos`); its schema lacks `tipo`/`versao`/`status`. `src/features/sgq/` is the production document-hierarchy module (DICQ 4.3 + ISO 15189 cl. 4.3) with full `em_revisao → vigente → obsoleto` state machine, audit chain (`sgq-documentos-audit`), and RN-SGQ-01..07. SGQ already supports `POL` and `IT` natively (see `src/features/sgq/types/Documento.ts` lines 40–48).

**Plan 00-02 does NOT scaffold a new module.** Its tasks are: write the two SGQ docs via existing flows + add a `DocumentosObrigatoriosBadge` UI block to `SGQView` + verify the audit chain captures both creations + schedule the annual review reminder.

### DL-3 — No patient consent flow in Phase 0

**Rule:** patient-facing onboarding / consent UI is **removed** from Phase 0. The system is a CIQ tool whose authenticated users are operators (RT, supervisors, admins); patients are not entities of the application in v1.4. The original Plan inferred a Next.js App Router path (`src/app/(auth)/registro/page.tsx`) which does not exist (project is React 19 + Vite SPA).

**LGPD evidence in Phase 0** is satisfied by:

1. `POL-LGPD-001` published in SGQ as `vigente`, `autoridadeEmitente` = RT signature (organizational acceptance representing the lab as data controller).
2. `IT-LGPD-DPIA-001` published in SGQ as `vigente`.
3. Audit-trail records in `sgq-documentos-audit` (`created` + `status-changed` events).
4. Visual badge "Documentos Obrigatórios" inside `SGQView` showing POL-LGPD-001 status.

**Acceptance criterion dropped from Plan 00-02:** "Patient registration shows policy link + consent checkbox; consent persisted with version + timestamp." → deferred to v1.4 Phase 5 (Patient Portal, email-link auth per ADR-0015). Until then, patient-side LGPD is governed by the lab's offline contract with the patient (paper consent at sample collection — pre-existing Riopomba practice).

---

## Wave plan summary

| Wave | Plans | Rationale |
|------|-------|-----------|
| **1** | `00-01-turnos-supervisor-shift` (1.5d), `00-02-lgpd-pol-and-dpia` (0.25d) | Independent. Both establish patterns reused by Wave 2. Turnos creates the canonical "callable + audit trail + lazy route + manualChunks" template for the next two modules; LGPD ships during a compliance review window without code dependency. Stream B (FE/BE) drives Plan 00-01; Stream A (compliance) drives Plan 00-02. |
| **2** | `00-03-lab-apoio-contracts` (2.5d), `00-04-risks-fmea-skeleton` (3.5d) | Both depend on Wave 1: they reuse the `turnos` callable scaffold (`functions/src/modules/<module>/{validators,signatureCanonical,index}.ts` shape), the rules-helper conventions, and the audit-chain trigger pattern. Plan 00-03 adds Storage rules for PDF uploads; Plan 00-04 adds an ADR (FMEA methodology) and a heatmap UI. |

**Parallelism within waves:** within Wave 1 the two plans touch disjoint folders (`src/features/turnos/**` vs `src/features/sgq/**` for badge only). Within Wave 2 the plans touch disjoint folders (`src/features/lab-apoio/**` vs `src/features/risks/**`). Both waves can run as concurrent agents.

**Cross-wave dependency edges:**

- 00-03 `depends_on: ["00-01"]` and 00-04 `depends_on: ["00-01"]` — they inherit the callable + audit-chain pattern established by `turnos`.
- 00-04 also `depends_on: ["00-02"]` — the FMEA-lite NPR thresholds will be referenced from `IT-LGPD-DPIA-001` (DPIA risk methodology cross-link).

---

## Canonical references (read these when planning each plan)

| Concern | File | Why |
|---|---|---|
| Hook pattern | `src/features/educacao-continuada/hooks/useColaboradores.ts` | Project canonical: `useActiveLabId()` guard + `onSnapshot` + cleanup + mutations that throw without lab |
| Module CLAUDE.md format | `src/features/educacao-continuada/CLAUDE.md`, `src/features/sgq/CLAUDE.md` | Required structure: scope, refs, multi-tenant paths, RN-* invariants, integration with shell, pendências |
| Callable shape | `functions/src/modules/controleTemperatura/{commitLeitura,signatureCanonical,validators,index}.ts` | Canonical: Zod input → assertCtAccess → Admin SDK re-read → server-side signature → atomic writeBatch → audit log |
| SGQ audit chain | `src/features/sgq/types/Documento.ts` (DocumentoAuditEvent), `src/features/sgq/CLAUDE.md` (RN-SGQ-06) | Append-only `/labs/{labId}/sgq-documentos-audit/` written in same batch as the doc itself |
| Rules patterns | `firestore.rules` helpers (`isActiveMemberOfLab`, `isAdminOrOwner`, `validSignature`, `labIdMatches`, `keepsLabId`, `keepsCreatedAt`) | Reuse helpers; do not redefine |
| Rules generator | Skill `hcq-firestore-rules-generator` | Use to draft rule blocks |
| Module scaffold | Skill `hcq-module-generator` | Use to scaffold types + service + hook + component skeletons for plans 00-01, 00-03, 00-04 |
| Audit trail | Skill `hcq-ciq-audit-trail` | Subcoleção events + `chainHash` trigger via Cloud Function |
| Deploy gates | Skill `hcq-deploy-gates` | Pre-merge + pre-deploy gate (TS, tests, rules emulator, baseline) |
| PDF export | Skill `hcq-pdf-export-scaffold` | Plan 00-03 contract PDF export, if extracted |
| Performance rule | `.claude/rules/performance.md` | All new routes lazy + manualChunks; new dep >50KB gzip needs justification |
| Module protection | `.claude/rules/module-protection.md` | Tasks that touch `useAuthStore`, `firestore.rules`, root `CLAUDE.md` are explicitly cross-module — ack each |
| Deploy protocol | `.claude/rules/deploy-protocol.md` | Order: `provisionModulesClaims` → rules → functions → hosting; hard reload after PWA deploy; Cloud Logs 24h post-deploy |
| Cloud Logs monitoring | `docs/CLOUD_LOGS_MONITORING_GUIDE.md` + `scripts/monitor-cloud-logs.sh` | Run after each module's Functions deploy |

---

## Risk hooks (Phase 0 specific)

Embed mitigation evidence in plan acceptance criteria:

- **RISK-403 (score 9 🔴)** — closes when all 4 plans pass acceptance gates. Each plan's "Definition of done" must include "auditor demonstration script" so closure is observable.
- **P0-R1** (legal review of contract template) — Plan 00-03 ships template behind a disclaimer banner; legal review runs Phase 1 week 2. The plan must include the disclaimer copy.
- **P0-R2** (FMEA iteration risk) — Plan 00-04 must produce ADR-0016 documenting methodology choice + escape hatch ("refine to ISO 31000 in v1.5 if feedback warrants").
- **P0-R3** (turnos backfill data gaps) — Plan 00-01 ships backfill behind `inferred: true` flag + UI banner asking manager confirmation; auditor-acceptable.
- **P0-R4** (7d timeline tight) — if Wave 2 stretches past Day 9, Plan 00-04 may drop the optional CSV seed import (stretch task). Plans must clearly mark stretch vs MVP tasks.
- **P0-R5** (compliance lead unavailable) — Plan 00-02 acceptance allows CTO self-approval if compliance lead is unreachable.
- **P0-R6** (perf regression in v1.3 prod load) — every plan adds a `manualChunks` entry + `React.lazy` route + Lighthouse spot-check pre-deploy.
- **RISK-409** (regression in v1.3 modules) — every plan keeps 738/738 baseline green (`npm test`) pre-merge and runs `bash scripts/monitor-cloud-logs.sh` post-deploy. Plans 00-01/03/04 add a callable but DO NOT touch existing module callables.

---

## Compliance evidence map

| Plan | REQ-IDs | RDC 978 | DICQ | RISKs |
|------|---------|---------|------|-------|
| 00-01 | REQ-403 (partial — supervisor sub-deliverable) | Art. 122; RDC 786 (habilitado vs capacitado) | 4.1.2.7 | RISK-403, P0-R3, P0-R6, RISK-409 |
| 00-02 | REQ-411 | Art. 77 | 4.3 (POL hierarchy), 4.13 (audit chain) | RISK-403, P0-R5, RISK-409 |
| 00-03 | REQ-416 (new — Lab Apoio module) | Arts. 36, 37, 38, 39 | 4.14.8 (supplier audit) | RISK-403, P0-R1, P0-R6, RISK-409 |
| 00-04 | REQ-412 | Art. 86 (componente 2 — gerenciamento dos riscos) | 4.14.6 (risk management) + ISO 15189 §8.5 | RISK-403, P0-R2, P0-R4, P0-R6, RISK-409 |

REQ-416 is new (introduced by Phase 0). It must be back-linked into `v1.4-REQUIREMENTS.md` Section 1 by the planner-of-record before plan 00-03 executes — see "Open questions" below.

---

## Cross-cutting invariants (apply to every plan)

Every plan must:

1. Path multi-tenant: `/labs/{labId}/<sub>` collection root; `labId` redundant in payload.
2. RN-06 soft delete only — `softDelete*` is itself a callable for the three new collections (chainHash continuity).
3. `LogicalSignature = { hash: string (size==64), operatorId == request.auth.uid, ts: timestamp }` enforced in rules + generated server-side via Admin SDK.
4. Thin service / fat hook. DTO via `Omit<Entity, 'id'|'labId'|'criadoEm'|'deletadoEm'|'logicalSignature'>`.
5. Hook follows `useColaboradores.ts` shape: `useActiveLabId()` guard, `onSnapshot` with cleanup, mutations throw without lab.
6. Audit subcoleção `/labs/{labId}/<col>/{id}/events/{eventId}` (or `<col>-audit/{eventId}` per existing SGQ convention) — append-only, chainHash trigger via Cloud Function.
7. Rules use existing helpers (`isActiveMemberOfLab`, `isAdminOrOwner`, `validSignature`, `labIdMatches`). Do not redefine.
8. Lazy route in `src/AppRouter.tsx`; named entry in `vite.config.ts` `manualChunks`.
9. Dark-first UI per `DESIGN_SYSTEM.md`: SVG inline (no icon libs), `currentColor`, `tabular-nums` on data columns, hover/focus 150–200ms, 4px grid spacing.
10. `pt-BR` for in-codebase strings (UI labels, error messages, ADR titles); plan body in English.
11. Module CLAUDE.md written at `src/features/<module>/CLAUDE.md` mirroring `src/features/sgq/CLAUDE.md` structure.
12. Root `CLAUDE.md` "Módulos em produção" table updated with a new row at module GA.
13. No emoji in any output.

---

## Open questions (must resolve before execution)

These are flagged as `# OPEN —` inline in the relevant plan body. The CTO must resolve before that plan kicks off.

- **OPEN — REQ-416 backlink:** Phase 0 introduces a new requirement ID (`REQ-416 — Laboratórios de Apoio`) for Plan 00-03. Either (a) `v1.4-REQUIREMENTS.md` Section 1 must be amended to add REQ-416 verbatim with acceptance criteria mirrored from PHASE-0-PLAN Task 3, or (b) Plan 00-03 references REQ-416 inline and a follow-up doc PR backfills it. Recommendation: **(a)**, done before Plan 00-03 starts to avoid an orphaned ID.
- **OPEN — DPIA template content sourcing for Plan 00-04 cross-link:** Plan 00-02's DPIA (`IT-LGPD-DPIA-001`) defines a minimal risk methodology section. Plan 00-04 (FMEA-lite) defines another. To avoid divergence, the DPIA template should reference the FMEA-lite methodology document (ADR-0016) by ID. This forces a soft sequencing: Plan 00-02 ships DPIA v1.0 stub; the methodology cross-link lands as DPIA v1.1 after ADR-0016 is published in Plan 00-04. Acceptable? Or block DPIA v1.0 on ADR-0016 (slows Wave 1 by 1d)?
- **OPEN — `DocumentosObrigatoriosBadge` component placement in `SGQView`:** the SGQ module already has a KPI header. Should "Documentos Obrigatórios" be (a) a new strip below the KPIs, (b) a tab inside the existing tab bar, or (c) a banner pinned above the table? Recommendation: **(a)** — least invasive, surfaces the badge without mode-switching.
- **OPEN — `lab-apoio` collection name canonicalization:** PHASE-0-PLAN says `/labs/{labId}/labApoio/{contratoId}` (camelCase). Project convention in other modules is kebab-case (`sgq-documentos`, `sgd-externos`, `controle-temperatura`). Plan 00-03 will use `/labs/{labId}/lab-apoio/{contratoId}` for consistency unless CTO objects.
- **OPEN — chainHash continuity on softDelete:** for the three new collections, `softDelete*` mutates `deletadoEm` only. Should the chainHash trigger record this as a `softdeleted` event type (preserving append-only chain), or skip (since the doc is logically still present)? Recommendation: **record as event** — auditor expects a deletion trail.

---

**End of 00-CONTEXT.md**
