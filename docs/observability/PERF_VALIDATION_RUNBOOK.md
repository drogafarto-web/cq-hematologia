# Perf Validation Runbook

**Owner:** Platform / Observability
**Audience:** any engineer triaging a `perf-validate` failure on a PR or nightly run
**Last reviewed:** 2026-05-08

---

## What this gate does

`scripts/perf-validate.mjs` runs the 7-metric performance suite from `.planning/PERFORMANCE_VALIDATION.md`, compares each result to `.planning/perf-baseline.json`, and emits:

- `dist/perf-report-{ts}.md` — printable full report (CI artifact)
- `dist/perf-report-{ts}.json` — machine-readable (CI artifact)
- `dist/perf-pr-summary.md` — compact PR comment body

It runs in two contexts:

1. **PR / push to `main`** — gates merges. Bundle + Lighthouse + Web Vitals are fully measured locally in CI. Backend telemetry (auth/laudo/queue/rules) is `SKIP` unless an upstream job populated `$PERF_TELEMETRY_FILE`.
2. **Nightly cron (02:00 UTC)** — full suite against latest `main`. Backend telemetry comes from the prod monitoring scripts; missing data degrades to `SKIP` (not failure).

---

## Status semantics

Every metric ends in one of four states:

| Status | Meaning | Gate behavior |
| --- | --- | --- |
| `PASS` | Within budget vs baseline | Green |
| `WARN` | Past the warn threshold but within hard limit | Yellow — gate stays green, comment flags it |
| `FAIL` | Past the hard limit | **Red — blocks merge** |
| `SKIP` | No data captured (collector not run) | Green (unless `--strict`) |

Thresholds live in `.planning/perf-baseline.json`. Each metric has `baseline`, `warn`, `fail`. Direction is `lower-is-better` for ms/KB and `higher-is-better` for Lighthouse scores.

---

## Reading the report

Sample report row:

```
| 1. Bundle (main shell, gzip) | 411 KB | 399 KB | 439 KB | WARN | +3.0% (regression) |
```

Columns: metric name · current measurement · baseline value · hard fail limit · status · delta vs baseline.

The full report also ships:

- **Lighthouse per route** — score + LCP/INP/CLS for each of the 5 audited routes
- **Top 8 JS chunks (gzip)** — to localize bundle regressions
- **Recommendations** — context-aware next actions per failing metric

---

## Triage flow

When the gate fails on your PR:

1. **Open the `perf-report` artifact.** Identify which metric failed.
2. **Reproduce locally:**
   ```powershell
   npm run build
   npx lhci autorun --collect.staticDistDir=./dist --collect.numberOfRuns=3
   npm run perf:validate
   ```
   The Markdown report writes to `dist/perf-report-*.md`.
3. **Match to a category below and follow the action.**

### Bundle regression

- Cause: a new static `import` of a heavy lib (xlsx, pdf-lib, recharts, @sentry/*).
- Action: `npm run analyze` → open `dist/stats.html` → find the new chunk → convert to `await import(...)` at use site.
- Reference: `docs/PERFORMANCE_PATTERNS.md` and `.claude/rules/performance.md`.

### Lighthouse regression

- Cause: render-blocking script, hydration cost, large image without `width`/`height`, slow Firestore in TTFB.
- Action: rerun Lighthouse locally. Compare per-route diff. If only one route regressed, profile that route in DevTools → Performance.

### Web Vitals regression

- LCP up: hero element changed, font/image preload removed, or new blocking JS.
- INP up: long task in event handler. Profile DevTools → Performance → Long tasks.
- CLS up: image without dimensions, late-injected component, font swap layout shift.

### Auth / Laudo / Queue / Rules

- Source is production p95 telemetry, not local.
- If failing, check Cloud Logs in Firebase Console for the affected component before changing code:
  - **Auth**: `triggerUserCreation`, `onUserCreate`, login latency in Sentry.
  - **Laudo**: Firestore `latencyUs` for laudo queries; verify composite indexes.
  - **Queue**: Cloud Tasks dashboard backlog + Cloud Scheduler invocation timing.
  - **Rules**: Firebase Console → Firestore → Performance → Rule evaluation latency.

---

## When to suppress noise

`SKIP` is normal in PR runs because backend telemetry is captured nightly, not per-PR. Do **not** treat skips as failures unless the run is meant to be authoritative (use `--strict` only on release-candidate validation runs).

A single `WARN` on bundle (+3-5%) is acceptable if a feature explicitly added a new dependency that was reviewed. Document the bump in the PR body. If the same metric warns 3 PRs in a row without explanation, escalate — the baseline drift is real.

---

## When to fail the gate (override green)

If you suspect a real regression that perf-validate missed (e.g., a memory leak that takes 10 minutes to surface), do not ship just because the gate is green. Flag it in PR review and run a manual smoke test on hosting before merging.

If the gate is **red** but the regression is intentional and approved (e.g., a new module pushes main shell to 415 KB on purpose):

1. Open an issue tagged `perf-baseline-bump`.
2. Update `.planning/perf-baseline.json` in a separate commit on the same PR.
3. Reference the issue in the commit message and link the CTO sign-off.
4. Do not bypass the gate by editing the workflow — bumping the baseline is the documented escape hatch.

---

## Local usage

```powershell
# Full run (bundle + lighthouse + web vitals; backend telemetry skipped)
npm run perf:validate

# Only bundle, fastest signal
node scripts/perf-validate.mjs --only=bundle

# Strict mode — skips become failures
node scripts/perf-validate.mjs --strict

# Override baseline (e.g., for v1.4 RC)
node scripts/perf-validate.mjs --baseline=.planning/perf-baseline-rc.json
```

Telemetry injection (for nightly runs that pull from production):

```powershell
$env:PERF_TELEMETRY_FILE = "dist/perf-telemetry.json"
node scripts/perf-validate.mjs --json --pr-summary
```

`perf-telemetry.json` shape:

```json
{
  "auth":           { "p95Ms": 412, "p99Ms": 521 },
  "laudoLoad":      { "p95Ms": 1180, "p99Ms": 1980 },
  "queue":          { "p95Ms": 78,   "p99Ms": 142 },
  "firestoreRules": { "p95Ms": 31,   "p99Ms": 65 }
}
```

---

## Updating the baseline

The baseline file (`.planning/perf-baseline.json`) is a contract. Bumping it requires:

- A new measurement run on a sealed commit (release candidate or post-deploy nightly).
- CTO sign-off on the bump (link in commit message).
- Updated `version`, `capturedAt`, `sourceCommit` fields.

Never bump the baseline silently as part of a feature PR.

---

## Failure modes of the gate itself

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Job fails with `Baseline not found` | wrong `--baseline=` path | check path is repo-relative |
| All metrics report SKIP | LHCI did not run before perf-validate | check workflow order; LHCI step must succeed first |
| PR comment not posted | missing `pull-requests: write` permission | already set in `lighthouse-ci.yml` |
| `dist/perf-report-*.md` missing in artifact | build dir not present | the script `mkdir -p`s it; check `Upload perf validation report` step |

---

## Related

- `.planning/PERFORMANCE_VALIDATION.md` — metric definitions + manual test commands
- `.planning/PERFORMANCE_AUDIT_PHASE_4_5.md` — v1.3 baseline source
- `.planning/perf-baseline.json` — machine-readable thresholds
- `scripts/perf-validate.mjs` — orchestrator
- `.github/workflows/lighthouse-ci.yml` — CI wiring
- `.claude/rules/performance.md` — author-time guardrails
