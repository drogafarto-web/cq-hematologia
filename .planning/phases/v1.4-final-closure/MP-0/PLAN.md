---
macro_phase: MP-0
phase_label: Foundation & Cleanup
total_subagents: 4
waves: 1
parallel: true
autonomous: true
human_gates: 0
worker_model: claude-haiku-4-5-20251001
estimated_runtime: 30min
depends_on: []
---

# MP-0 — Foundation & Cleanup

**Goal:** Quiesce the working tree, archive obsolete phase folders, capture baseline metrics, and stage shared design tokens so all downstream MPs start from a clean slate.
**Dependencies:** none (entry point of v1.4-final-closure).
**Output:**
- `.planning/phases/_archive/` populated with superseded phases + migration note
- 5 phase-11 PQ-24 components committed (no longer untracked)
- `.planning/phases/v1.4-final-closure/BASELINE-2026-05-09.md` with rollback metrics
- `.planning/phases/v1.4-final-closure/tokens-cache.json` with extracted design tokens

---

## Wave MP-0-W1 — Foundation (4 SAs ‖)

All 4 SAs run in parallel. No inter-SA dependencies.

---

### SA-01 — Archive obsolete phase folders

**Path:** move directories into `.planning/phases/_archive/`
**LOC target:** ~50 (migration note only)
**Depends on:** none

**Actions:**
1. Create directory `.planning/phases/_archive/` if missing.
2. Move `.planning/phases/03-schema-extensions/` → `.planning/phases/_archive/03-schema-extensions/`.
3. Move `.planning/phases/03.2-core-features/` → `.planning/phases/_archive/03.2-core-features/`.
4. Create `.planning/phases/_archive/v1.4-archive-2026-05-09.md` with the following sections:
   - **Archived on:** `2026-05-09`
   - **Archived by:** `MP-0/SA-01 (v1.4-final-closure)`
   - **Folders moved:**
     - `03-schema-extensions/` — superseded by Phase 3 LIVE work (already in production)
     - `03.2-core-features/` — superseded by Phase 3 LIVE work
   - **Reason:** Both folders predate the Phase 3 LIVE rollout (2026-05-05). Their schema/feature scope was absorbed into the live Phase 3 deliverables. Keeping them visible at top-level created confusion during planning.
   - **Restore procedure:** `git mv .planning/phases/_archive/<folder> .planning/phases/<folder>` then revert this commit.

**Invariants:**
- Use `git mv` (preserves history), not `mv` + `git add`.
- Do not delete any file. Move-only.
- The migration note must list every top-level subdirectory inside each archived folder.

**Files to read first:**
- `./CLAUDE.md`
- `.planning/ROADMAP.md` (if present, to confirm Phase 3 LIVE status)

**Verification:**
- `git status` shows renames (R) only, no deletions
- `ls .planning/phases/_archive/` lists both archived folders + the migration note
- `ls .planning/phases/` no longer contains `03-schema-extensions/` or `03.2-core-features/`

**Commit:** `chore(MP-0-W1-SA-01): archive superseded phase folders 03-schema-extensions + 03.2-core-features`

---

### SA-02 — Commit phase-11 PQ-24 UI components

**Path:** `src/features/auditoria-interna/components/`
**LOC target:** barrel export only (~20 LOC); the 5 components already exist on disk untracked
**Depends on:** none

**Actions:**
1. Verify the 5 untracked components exist with `git status --short src/features/auditoria-interna/components/`:
   - `PlanoAcaoForm.tsx`
   - `PlanoAcaoList.tsx`
   - `PresencaPanel.tsx`
   - `ReAuditoriaCard.tsx`
   - `ReAuditoriaChain.tsx`
2. Inspect existing `src/features/auditoria-interna/components/index.ts`. If the 5 components are not exported, add named exports for each. If `index.ts` is missing, create it with these exports plus the existing components in that folder (`AchadoForm`, `AuditoriaPlanning`, `AuditoriaView`, `AuditoriasList`, `ChecklistItemCard`, `SessaoExecucaoPanel`, `SessoesList`).
3. Run `npx tsc --noEmit` from repo root and confirm 0 new errors attributable to these files.
4. Stage and commit only these files (do not bundle unrelated changes).

**Contract for `index.ts`:**
```typescript
export { default as AchadoForm } from './AchadoForm';
export { default as AuditoriaPlanning } from './AuditoriaPlanning';
export { default as AuditoriaView } from './AuditoriaView';
export { default as AuditoriasList } from './AuditoriasList';
export { default as ChecklistItemCard } from './ChecklistItemCard';
export { default as PlanoAcaoForm } from './PlanoAcaoForm';
export { default as PlanoAcaoList } from './PlanoAcaoList';
export { default as PresencaPanel } from './PresencaPanel';
export { default as ReAuditoriaCard } from './ReAuditoriaCard';
export { default as ReAuditoriaChain } from './ReAuditoriaChain';
export { default as SessaoExecucaoPanel } from './SessaoExecucaoPanel';
export { default as SessoesList } from './SessoesList';
```
If any component uses named (not default) export, mirror its actual export shape — read each file's last lines first.

**Invariants:**
- No code edits inside the 5 components themselves in this SA. Wiring happens in MP-1.
- Barrel must compile (`npx tsc --noEmit`) without error.
- Do not import from outside `auditoria-interna/`.

**Files to read first:**
- `src/features/auditoria-interna/components/PlanoAcaoForm.tsx` (verify export style)
- `src/features/auditoria-interna/components/PlanoAcaoList.tsx`
- `src/features/auditoria-interna/components/PresencaPanel.tsx`
- `src/features/auditoria-interna/components/ReAuditoriaCard.tsx`
- `src/features/auditoria-interna/components/ReAuditoriaChain.tsx`
- `./CLAUDE.md`

**Verification:**
- `git status --short src/features/auditoria-interna/components/` returns empty after commit
- `npx tsc --noEmit` exit code 0

**Commit:** `feat(MP-0-W1-SA-02/phase-11/C1): commit phase-11 PQ-24 UI components — 5 components + barrel`

---

### SA-03 — Capture baseline metrics

**Path:** `.planning/phases/v1.4-final-closure/BASELINE-2026-05-09.md`
**LOC target:** ~60
**Depends on:** none

**Actions:**
Run each command, capture the result, and write the markdown report. Run from repo root.

```bash
# 1. TSC error count (web)
npx tsc --noEmit 2>&1 | tee /tmp/tsc-baseline.log
TSC_WEB=$(grep -c 'error TS' /tmp/tsc-baseline.log || echo 0)

# 2. TSC error count (functions)
(cd functions && npm run build 2>&1) | tee /tmp/fn-baseline.log
TSC_FN=$(grep -c 'error TS' /tmp/fn-baseline.log || echo 0)

# 3. Lint warning count
npm run lint 2>&1 | tee /tmp/lint-baseline.log
LINT=$(grep -cE 'warning|error' /tmp/lint-baseline.log || echo 0)

# 4. Test counts
npm test -- --run --reporter=basic 2>&1 | tee /tmp/test-baseline.log
TESTS_TOTAL=$(grep -oE '[0-9]+ (passed|failed|skipped)' /tmp/test-baseline.log)

# 5. Build size
npm run build 2>&1 | tee /tmp/build-baseline.log
MAIN_GZIP=$(grep -E 'index-.*\.js.*gzip' /tmp/build-baseline.log | head -1)

# 6. Git HEAD
HEAD_SHA=$(git rev-parse HEAD)
HEAD_SHORT=$(git rev-parse --short HEAD)
```

**Output document structure:**
```markdown
# Baseline Metrics — v1.4 Final Closure (2026-05-09)

## Purpose
Snapshot of repo health at the start of v1.4-final-closure. Used as rollback reference and as denominator for "did we regress?" gates after each MP.

## Git
- HEAD SHA: <full sha>
- HEAD short: <short sha>
- Branch: <branch>

## TypeScript
- Web (`npx tsc --noEmit`): N errors
- Functions (`cd functions && npm run build`): N errors

## Lint
- `npm run lint`: N warnings, M errors

## Tests
- Total: X passed / Y failed / Z skipped
- Test files run: N

## Build
- Main chunk gzip size: NNN KB
- Total dist size: NNN KB

## Verification gates derived from this baseline
- TSC must stay at <baseline> or below for the rest of v1.4-final-closure
- Lint warnings allowed to grow at most +5% from baseline
- Main chunk gzip must stay ≤ 450 KB regardless of baseline
- No test that passes today may fail after any MP
```

**Invariants:**
- All numbers are real (run the commands). No placeholders.
- If a command fails (non-zero exit), record the failure in the doc — do not skip.
- If `/tmp` is unavailable on Windows, use `$env:TEMP` (PowerShell) — the doc must capture the actual numbers regardless of shell.

**Files to read first:**
- `package.json` (confirm script names)
- `functions/package.json`
- `./CLAUDE.md`

**Verification:**
- File exists at the exact path
- Every section has a real number, not a TODO
- `git diff --stat` shows only this file modified

**Commit:** `docs(MP-0-W1-SA-03): capture v1.4-final-closure baseline metrics`

---

### SA-04 — Extract design tokens cache

**Path:** `.planning/phases/v1.4-final-closure/tokens-cache.json`
**LOC target:** ~120 (JSON)
**Depends on:** none

**Actions:**
1. Read `DESIGN_SYSTEM.md` end-to-end.
2. Extract every concrete design token referenced and serialize as JSON. Group by category. Where a token has multiple representations (Tailwind class + raw hex), capture both.

**Schema:**
```json
{
  "version": "v1.4-final-closure",
  "extracted_from": "DESIGN_SYSTEM.md",
  "extracted_at": "2026-05-09",
  "colors": {
    "background": { "primary": "#141417", "tailwind": "bg-[#141417]" },
    "surface": { "...": "..." },
    "text": { "...": "..." },
    "accents": {
      "violet": { "primary": "violet-500", "hex": "..." },
      "emerald": { "primary": "emerald-500", "hex": "..." }
    },
    "alpha": { "white-5": "white/5", "white-10": "white/10", "...": "..." }
  },
  "spacing": {
    "grid": "4px",
    "scale": ["p-1", "p-2", "p-4", "p-6", "p-8"],
    "forbidden": ["p-[13px]", "any arbitrary value"]
  },
  "typography": {
    "scale": ["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl"],
    "tabular_nums_required_for": ["data tables", "metrics", "currency"],
    "weight_scale": ["font-normal", "font-medium", "font-semibold"]
  },
  "radii": {
    "sm": "rounded",
    "md": "rounded-md",
    "lg": "rounded-lg",
    "xl": "rounded-xl",
    "2xl": "rounded-2xl"
  },
  "shadows": { "...": "..." },
  "motion": {
    "duration": ["150ms", "200ms"],
    "respects_reduced_motion": true
  },
  "icons": {
    "policy": "inline SVG with currentColor",
    "forbidden_libraries": ["lucide-react", "heroicons", "react-icons"]
  },
  "a11y": {
    "contrast_min_normal": 4.5,
    "contrast_min_large": 3.0,
    "focus_visible_required": true,
    "keyboard_nav_required": true
  }
}
```

**Invariants:**
- Valid JSON (parseable by `JSON.parse`).
- Every value comes from `DESIGN_SYSTEM.md` — no invention.
- If a category in `DESIGN_SYSTEM.md` is missing, omit it from the JSON (do not stub).

**Files to read first:**
- `DESIGN_SYSTEM.md`
- `./CLAUDE.md` (rules section "Frontend Pro Max")

**Verification:**
- `node -e "JSON.parse(require('fs').readFileSync('.planning/phases/v1.4-final-closure/tokens-cache.json','utf8'))"` exit code 0
- Every accent color in `DESIGN_SYSTEM.md` appears under `colors.accents`

**Commit:** `docs(MP-0-W1-SA-04): cache design tokens for downstream UI subagents`

---

## Verification Gate MP-0

```bash
# G-Build
npx tsc --noEmit
(cd functions && npm run build)

# G-Clean
git status --porcelain   # must be empty after all 4 commits land

# G-Artifacts
test -d .planning/phases/_archive/03-schema-extensions
test -d .planning/phases/_archive/03.2-core-features
test -f .planning/phases/_archive/v1.4-archive-2026-05-09.md
test -f .planning/phases/v1.4-final-closure/BASELINE-2026-05-09.md
test -f .planning/phases/v1.4-final-closure/tokens-cache.json
node -e "JSON.parse(require('fs').readFileSync('.planning/phases/v1.4-final-closure/tokens-cache.json','utf8'))"
```

**Pass criteria:**
- [ ] All 4 SA commits landed on the branch
- [ ] `git status` clean (no untracked, no modified)
- [ ] `npx tsc --noEmit` exit 0
- [ ] `cd functions && npm run build` exit 0
- [ ] Both archive folders moved + migration note exists
- [ ] BASELINE doc has real numbers in every section
- [ ] tokens-cache.json parses as valid JSON
- [ ] No test that previously passed now fails (compare against baseline)

**Failure handling:** If SA-02 finds the components no longer untracked (someone else committed them), it is a no-op success. If SA-01 finds an archived folder is referenced by an active plan, abort SA-01 and escalate — do not silently archive.
