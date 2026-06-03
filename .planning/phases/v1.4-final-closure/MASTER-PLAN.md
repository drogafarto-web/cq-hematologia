---
phase: v1.4-final-closure
status: ready-to-execute
date_created: 2026-05-09
architecture: orchestrator-workers-haiku
total_macro_phases: 9
total_subagents: 91
total_waves: 28
estimated_runtime: 12-17h autonomous
estimated_cost: $5-8 USD (with prompt cache + batch API)
human_gates: 0
orchestrator_model: claude-opus-4-7
worker_model: claude-haiku-4-5-20251001
escalation_model: claude-sonnet-4-6
---

# v1.4 Final Closure — Master Plan

**Goal:** Single-shot autonomous execution closing all v1.4 backlog + partials + phase-11 PQ-24, then deploy.

**Approach:** Orchestrator-Workers pattern. Opus orchestrates, Haiku executes ≤200 LOC tasks with closed contracts in parallel waves. Verification gates between waves are deterministic (TSC, tests, build).

---

## Macro-Phase Map

```
MP-0  Foundation & Cleanup        [4 SAs ‖]                ~30min
MP-1  Phase 11 PQ-24 Closure      [W11A ‖, W11B →, W11C ‖] ~1h
MP-2  Phase 7 Auditoria W4-W6     [3 waves, 14 SAs]        ~2h
MP-3  Phase 5 Críticos + IA       [4 waves, 12 SAs]        ~3h
MP-4  Phase 10 Critical Values    [2 waves, 6 SAs]         ~1h
MP-5a Phase 9 Bioquimica Phase 2  [7 waves, 22 SAs]        ~4h
MP-5b Phase 9 Mobile Analytics    [2 waves, 5 SAs]         ~1h
MP-5c Phase 9 Mobile Refinement   [1 wave, 4 SAs]          ~1h
MP-6  Phase 11 Patient Portal v2  [2 waves, 8 SAs]         ~2h
MP-7  Phase 13 DICQ Audit         [3 waves, 10 SAs+Opus]   ~3h
MP-8  Final Deploy + Smoke        [sequential]             ~30min
```

---

## Worker Contract Template (Haiku 4.5)

Every Haiku subagent receives this XML-tagged structure:

```xml
<role>
Surgical TypeScript code generator for HC Quality (multi-tenant CIQ lab).
Output exactly the file specified. Match contract precisely. No prose.
</role>

<project_invariants>
- Multi-tenant: all collections /<col>/{labId}/<sub> or /labs/{labId}/<col>/<sub>
- RN-06 soft-delete: never deleteDoc, always softDelete*
- LogicalSignature: { hash, operatorId, ts } where operatorId === request.auth.uid
- Thin services / fat hooks (services CRUD only, hooks orchestrate)
- Regulatory writes via callable v2 in southamerica-east1 with cors:true
- Input DTOs via Omit<Entity, 'id'|'labId'|'criadoEm'|'deletedAt'>
- Dark-first design (Apple/Linear/Stripe) — bg-[#141417], white/X alpha, violet-500/emerald-500
- WCAG AA: 4.5:1 contrast, semantic HTML, keyboard nav
- 4px grid spacing (p-1, p-2, p-4, p-6, p-8)
</project_invariants>

<task>
{file_path}
</task>

<contract>
{exports_with_signatures}
{business_invariants}
{dependencies_to_import}
</contract>

<files_to_read>
{paths_to_canonical_examples}
- ./CLAUDE.md (always read)
</files_to_read>

<verification>
- npx tsc --noEmit → 0 errors for this file
- npm test {test_pattern} → pass
- git commit with message: feat(MP-{X}-W{Y}-SA-{NN}): {description}
</verification>

<success_criteria>
- [ ] File created at exact path
- [ ] All exports match contract
- [ ] No commentary in output
- [ ] TSC passes
- [ ] Tests pass
- [ ] Atomic commit applied
</success_criteria>
```

---

## Failure Handling Protocol

```
SA fails verification →
  attempt 1: re-spawn Haiku with error output as input
  attempt 2: re-spawn with reference to canonical file
  attempt 3: ESCALATE → spawn Sonnet 4.6 with full context
  attempt 4: PAUSE wave + log to .planning/INCIDENTS.md + continue siblings
```

Wave proceeds even if 1-2 SAs fail — those are logged for cleanup MP. Hard-stop only if >50% of wave fails.

---

## Cost Optimization (Prompt Caching)

Shared prompt cached at 4 cache breakpoints:

1. `<role>` + `<project_invariants>` (5K tokens, cached forever in 5min TTL refreshed by each call)
2. CLAUDE.md content (3K tokens)
3. Per-wave canonical examples (variable)
4. Per-SA contract (variable)

Result: First SA in wave pays full price, SAs 2-N pay ~10% (90% cache hit).

For waves with 4+ SAs, **batch API** (50% discount) used in parallel dispatch.

---

## Execution Order

```
MP-0 → MP-1 → MP-2 → MP-3 → MP-4 → MP-5a/5b/5c (parallel) → MP-6 → MP-7 → MP-8
```

Within each MP, waves execute sequentially but SAs within a wave run parallel via `Task(run_in_background:true)`.

---

## Master Verification Gates

| Gate          | Run after                     | Pass criteria                                                       |
| ------------- | ----------------------------- | ------------------------------------------------------------------- |
| **G-Build**   | each MP                       | `npx tsc --noEmit` exit 0, `(cd functions && npm run build)` exit 0 |
| **G-Test**    | each MP                       | `npm test` ≥98% pass, no Phase 8 regression                         |
| **G-Lint**    | MP-8 only                     | warnings ≤ baseline + 5% (current 2,081)                            |
| **G-Bundle**  | MP-8 only                     | dist main chunk ≤ 450 KB gzip                                       |
| **G-Secrets** | MP-8 only                     | preflight-secrets-check.sh exit 0, no secrets in diff               |
| **G-CORS**    | MP-1, MP-3, MP-4, MP-5a, MP-6 | All new callables have cors:true                                    |
| **G-Rules**   | MP-1, MP-7                    | Emulator rules tests pass                                           |
| **G-Deploy**  | MP-8                          | rules + indexes deploy OK, functions deploy OK, hosting deploy OK   |

---

## Final Outputs

After MP-8 completes:

- Branch: `v1.4-final-closure` merged to `main`
- Tag: `v1.4-FINAL` on the merge commit
- 91 atomic commits (1 per SA)
- Master report: `.planning/phases/v1.4-final-closure/FINAL-REPORT.md`
- Compliance update: `docs/COMPLIANCE_v1.4_FINAL.md` (DICQ ≥85%)
- All 9 macro-phases LIVE in production at https://hmatologia2.web.app

---

## Per-MP Plan Files

Each macro-phase has its own detailed plan:

- `MP-0/PLAN.md` — Foundation (4 SAs)
- `MP-1/PLAN.md` — Phase 11 PQ-24 (6 SAs)
- `MP-2/PLAN.md` — Phase 7 Auditoria W4-W6 (14 SAs)
- `MP-3/PLAN.md` — Phase 5 Críticos + IA (12 SAs)
- `MP-4/PLAN.md` — Phase 10 Critical Values (6 SAs)
- `MP-5a/PLAN.md` — Bioquímica Phase 2 (22 SAs)
- `MP-5b/PLAN.md` — Mobile Analytics (5 SAs)
- `MP-5c/PLAN.md` — Mobile Refinement (4 SAs)
- `MP-6/PLAN.md` — Patient Portal v2 (8 SAs)
- `MP-7/PLAN.md` — DICQ Audit (10 SAs + Opus planner)
- `MP-8/PLAN.md` — Final Deploy + Smoke

---

**Status:** Ready to dispatch. Awaiting orchestrator GO signal.
