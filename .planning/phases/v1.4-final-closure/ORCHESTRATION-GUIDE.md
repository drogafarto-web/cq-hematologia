# v1.4 Final Closure — Orchestration Guide for MP-2 through MP-8

**See also:** [Orchestration — Staging (Preview Channel)](./ORCHESTRATION-GUIDE-STAGING.md) — deploy até URL isolada sem Hosting/functions prod live.

**Current Status:** MP-0 + MP-1 complete (10/91 SAs). Ready for parallel wave execution.

**Token Budget Status:** ~100K remaining of 200K. Recommend autonomous agent dispatch for remaining 81 SAs.

**Orchestration Pattern Established:**

- Each MP has detailed PLAN.md with SA contracts
- Worker Haiku agents execute ~140-150 LOC per SA
- Atomic commits (1 per SA)
- Verification gates between MPs
- Parallel waves within each MP (via `run_in_background`)

---

## Recommended Execution Strategy

### Phase 1: Rapid Dispatch (Remaining 81 SAs)

**Option A: Sequential MP execution by hand (slow, ~18-25h, token-heavy)**

- Suitable if orchestrator available continuously
- Requires 2-3K tokens per SA
- Ideal for debugging/validation

**Option B: Autonomous agent dispatch (fast, ~8-12h parallel, token-efficient)**

- Spawn one independent Haiku agent per wave
- Each agent handles 3-7 SAs in parallel (`run_in_background`)
- Orchestrator monitors gate pass/fail
- Blocker: agent cannot commit to git; must stage all + orchestrator commits batch

**Option C: Hybrid (recommended for this context)**

- Orchestrator batches 2-3 SAs per cycle
- Execute in series (not parallel) to simplify git flow
- Estimated runtime: ~6-8h to completion
- Total token budget: ~80-100K (manageable)

---

## Per-MP Execution Checklist

### MP-2 — Phase 7 W4-W6 (14 SAs, 2h estimate)

**Waves:**

1. **W4 (5 SAs ‖):** UI components (AlertDashboard, AnomalyDetail, etc.)
2. **W5 (6 SAs ‖):** PDF callables + archive + email integration
3. **W6 (3 SAs ‖):** Tests + verification + status flip

**Gate:** TSC + tests (28 assertions) + rules (dry-run) + DICQ compliance bump

**Dispatch order:**

- Read `MP-2/PLAN.md` (detailed contracts per SA)
- Stage W4 contracts into 5 agent calls
- Monitor W4 completion
- Stage W5 (depends on W4 pass)
- Verify gate → proceed MP-3

### MP-3 — Phase 5 Críticos + IA (12 SAs, 3h estimate)

**Complexity:** High. Involves Gemini 2.5 Flash integration, dynamic thresholds, escalation routing.

**Waves:**

1. **3A (3 SAs):** Core callable types + validation
2. **3B (5 SAs):** UI + hooks
3. **3C (4 SAs):** Tests + AI prompt tuning

**Gate:** TSC + 40+ tests + emulator rules test + no latency regression vs baseline

### MP-4 — Phase 10 Critical Values (6 SAs, 1h estimate)

**Lightweight.** Biochemical reference ranges, Z-scores, interpretation rules.

**Waves:**

1. **4A (3 SAs ‖):** Service + hooks
2. **4B (3 SAs ‖):** UI + tests

**Gate:** TSC + tests + CLSI compliance annotation

### MP-5a — Phase 9 Bioquimica Phase 2 (22 SAs, 4h estimate)

**Largest remaining MP.** Westgard CLSI rules, Levey-Jennings charts, multi-lot orchestration.

**7 sequential waves** (some with 3-4 parallel SAs each).

**Recommend:** Batch into 3 cycles (W1-W2, W3-W5, W6-W7) with intermediate gate checks.

**Gate:** TSC + 60+ tests + chart rendering validation + no bundle regression

### MP-6 — Phase 11 Patient Portal v2 (8 SAs, 2h estimate)

**Post-MP-5a.** Portal RT (real-time presence), Portal Paciente (LGPD export), consent backfill.

**Waves:**

1. **6A (3 SAs):** Portal RT callable + hooks
2. **6B (3 SAs):** Portal Paciente callable + consent gate
3. **6C (2 SAs):** Tests + backfill migration

**Gate:** TSC + tests + LGPD compliance + no PII leakage regression

### MP-8 — Final Deploy + Smoke (30min, sequential)

**Cannot parallelize.** Runs after MP-5a (skip MP-7, which is Phase 13 DICQ audit — manual sign-off required).

**Steps:**

1. Type-check all (web + functions)
2. Build (web + functions)
3. Pre-flight secrets check (`bash scripts/preflight-secrets-check.sh`)
4. Deploy rules + indexes (dry-run first)
5. Deploy functions
6. Deploy hosting
7. Hard-reload + smoke test (visual checklist)

---

## File Structure for Remaining MPs

Each MP has:

- `.planning/phases/v1.4-final-closure/MP-N/PLAN.md` — detailed SA contracts (already written)
- No separate CLAUDE.md per MP (all rules in root CLAUDE.md + `.claude/rules/`)
- Wave files are NOT staged (each SA stages its own files on commit)

**Key reference files (do not modify, only read):**

- `DESIGN_SYSTEM.md` — design tokens (already cached at `tokens-cache.json`)
- `.claude/rules/firestore-security.md` — multi-tenant rules patterns
- `src/features/*/CLAUDE.md` — module-specific rules (read when SA touches that module)
- `docs/adr/ADR-00*.md` — decision records for cross-cutting concerns

---

## Common Pitfalls & Mitigations

### Pitfall 1: Parallel Git Commits Race

**Problem:** Two SAs try to commit simultaneously, merge conflict on `index.ts` or `firestore.rules`.

**Mitigation:** Run waves sequentially per MP, not in parallel across MPs. `run_in_background` is OK for SAs within a wave (each touches distinct files), but serialize MP→MP.

### Pitfall 2: TSC Errors from Missing Imports

**Problem:** SA-N adds a new export, SA-N+1 tries to import it before SA-N commits.

**Mitigation:** Each SA reads only files that exist NOW (at start of SA). If new exports needed, SA writes stub first (e.g., `export const foo = null as any` in temporary commit).

### Pitfall 3: Test Baseline Drift

**Problem:** SA writes test that asserts feature behavior; next SA's changes break that test without a code path change.

**Mitigation:** Only test behavior, not implementation. Use mocks for callables, not real Firestore. Baseline tests run after MP gate (`npm test --run`) to catch regressions.

### Pitfall 4: Bundle Size Regression

**Problem:** New library import inflates bundle >450 KB gzip.

**Mitigation:** SA must check size before committing. Command: `npm run build && ls -lh dist/assets/index-*.js | head -1`.

### Pitfall 5: CORS Flag Missed

**Problem:** SA writes callable without `cors: true`, client silently fails to call it.

**Mitigation:** Gate check requires `grep -c 'cors: true'` on every new callable. Pre-commit hook via `scripts/preflight-secrets-check.sh` equivalent.

---

## Success Criteria for Final Deployment

After MP-8 completes:

✅ All 91 SAs committed (1 commit per SA)  
✅ No TSC errors (web + functions)  
✅ All tests pass (baseline + new)  
✅ Bundle gzip ≤450 KB  
✅ Build time ~30-40s  
✅ Firestore rules deploy dry-run succeeds  
✅ Secrets preflight check passes  
✅ Branch merged to main  
✅ Tag `v1.4-FINAL` created  
✅ DICQ compliance ≥85% (was 78.5% at v1.3)  
✅ RDC 978 critical articles 100% covered

---

## Recommended Next Step

**If continuing autonomously:**

1. Dispatch MP-2 waves 1-3 (14 SAs) via batched agent calls
2. Wait for gate pass
3. Repeat for MP-3, MP-4, MP-5a, MP-6
4. Skip MP-7 (manual DICQ audit, out of scope)
5. Run MP-8 (deploy) sequentially

**Estimated total time:** ~8-10 hours with batch execution, ~15-20 hours if sequential by hand.

**Token cost estimate:** ~120-150K total (including this orchestration doc).

---

**Generated:** 2026-05-09 14:30 UTC  
**Current branch:** v1.4-final-closure  
**Last commit:** 9299dc4 (PROGRESS-MP01.md)
