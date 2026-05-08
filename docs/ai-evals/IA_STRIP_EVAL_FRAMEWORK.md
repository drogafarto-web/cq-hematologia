# IA Strip Eval Framework

Offline regression suite for `classifyStripGemini` — the Gemini 2.5 Flash callable
that classifies rapid diagnostic test (RDT) strip images as Reativo (R),
Não-Reativo (NR), or Inconclusive across HIV, Dengue, Syphilis, COVID, and HCG.

**Status: SCAFFOLD.** The harness is wired, the prompts are pinned to the production
v1 baseline, the CI gate is drafted. **No real fixtures exist yet** — see
[Sign-off checklist](#sign-off-checklist) before declaring this operational.

---

## Why this exists

Per the v1.4 audit: the classifier enforces a 0.85 confidence threshold at runtime
(`AUTO_SAVE` vs `MANUAL_REVIEW` escalation), but there was **no offline regression
suite** to detect:

- Prompt drift when variants v1/v2/v3 are tuned
- Model drift when Gemini 2.5 Flash is updated
- Calibration drift (over- or under-confident outputs)
- Schema regressions in the JSON output Gemini returns

A failure in any of these silently degrades clinical decision support. We need a
loud, automated gate.

---

## Architecture

```
functions/
├── eval/ia-strip/
│   ├── promptfooconfig.yaml       ← provider + prompts + assertions + thresholds
│   ├── fixtures/
│   │   ├── README.md              ← how to populate (data lives elsewhere)
│   │   ├── manifest.json          ← RT-signed ground truth (gitignored)
│   │   ├── tests.generated.yaml   ← built from manifest by scripts/build-eval-fixtures.mjs
│   │   └── images/                ← clinical images (gitignored, in private bucket)
│   ├── output/                    ← eval results (gitignored)
│   └── .gitignore
└── package.json                   ← devDep: promptfoo; script: eval:ia-strip

.github/workflows/
└── eval-ia-strip.yml              ← DRAFT CI gate (manual + PR + weekly cron)

docs/ai-evals/
└── IA_STRIP_EVAL_FRAMEWORK.md     ← this file
```

The eval **does not import** `functions/src/modules/ia-strip/callables/classifyStripGemini.ts`.
Instead, the prompts in `promptfooconfig.yaml` are **mirrored** from `buildPrompt()`
v1 variants. This keeps the eval honest (it tests the same surface the user sees)
and avoids tight coupling that would let us "fix" failures by silently changing
the eval prompt without changing prod.

When the production prompt changes, the eval prompt must be updated in lockstep —
this is enforced by code review, not tooling.

---

## Running locally

### Prerequisites

```bash
cd functions
npm install                # picks up promptfoo devDep
export GEMINI_API_KEY="..."  # use the eval-only key, not prod
```

> **Cost note:** A full 210-fixture run at gemini-2.5-flash pricing is roughly
> $0.05–0.15. Don't loop this in a watch script.

### Single run

```bash
cd functions
npm run eval:ia-strip
```

Output lands in `functions/eval/ia-strip/output/results.json` plus an HTML
report. Open the HTML to inspect per-case reasoning when investigating failures.

### Filtering to a single test type

```bash
npx promptfoo eval -c eval/ia-strip/promptfooconfig.yaml --filter-providers hiv-v1
```

---

## Interpreting results

| Signal | What it means | Action |
| --- | --- | --- |
| Overall accuracy < 0.85 | Model regressed OR fixtures expanded into harder cases | Triage by test type — find the bucket dragging the average |
| Clear-case avg confidence < 0.85 | Calibration drift — model is hedging on cases it should be sure about | Investigate prompt; check if Gemini version bumped |
| Ambiguous-case confidence > 0.80 | Over-confident — model not self-flagging for `MANUAL_REVIEW` | **High clinical risk.** Page on-call. |
| Schema parse failure > 0 | Model output drifted from JSON contract | `parseGeminiResponse()` would return `INCONCLUSIVE` in prod — silent degradation. Fix prompt or pin model version. |
| Latency p99 > 5s | Inference slower than the 30s callable timeout but past the 3s product target | Track; not a release blocker unless > 10s |

---

## Threshold rationale

| Threshold | Value | Source |
| --- | --- | --- |
| Runtime confidence cutoff | 0.85 | Hardcoded default in `classifyStripGemini.ts` line 103 (overridable per-lab via `imuno-ia-dev/{labId}/config.confidenceThreshold`) |
| Eval accuracy gate | 0.85 | Matches in-code claim "85–88% on validation set" (line 9) |
| Ambiguous max confidence | 0.80 | One step below runtime cutoff — ensures ambiguous fixtures fall into `MANUAL_REVIEW` even with 5pp upward drift |
| Schema failure tolerance | 0.00 | Any parse failure becomes `INCONCLUSIVE` in prod with confidence=0, silently shifting load to manual review. Zero tolerance. |
| Latency budget | 5000ms (eval), 3000ms (product target) | Callable timeout is 30s; product SLA is p99 < 3s. Eval gate is loose to absorb network jitter. |

These will be re-baselined after the first real fixture run. Update this section
and the YAML when you do.

---

## Adding fixtures

1. Capture (or pull from production) RDT images **with full clinical context** —
   what kit, what lot, what lighting, what the RT called the result.
2. Store images in the access-controlled bucket. Path TBD —
   coordinate with the platform team. **Do not** commit images to the repo.
3. Append entries to `fixtures/manifest.json` per the schema in
   [`fixtures/README.md`](../../functions/eval/ia-strip/fixtures/README.md).
4. Get RT sign-off on the labels — commit message must include RT name + date,
   e.g. `chore(eval): add 12 dengue fixtures (RT: dr.silva@example, 2026-05-15)`.
5. Run `npm run eval:ia-strip` locally to confirm baseline accuracy holds.
6. Open PR; CI runs the eval against the new fixtures.

### Fixture quality guidelines

- **Diversity beats volume.** A balanced 50-image set beats 200 images from
  the same lighting condition.
- **Hard cases matter.** Include intentionally ambiguous fixtures — faint T
  lines, partial shadows, off-axis captures — to exercise the
  `MANUAL_REVIEW` escalation path.
- **One fixture, one truth.** If two RTs disagree on the label, that's an
  inter-rater reliability issue — log it, don't include the image in the suite
  until reconciled.

---

## CI gate (DRAFT)

`.github/workflows/eval-ia-strip.yml` runs the eval on:

- PRs touching `functions/src/modules/ia-strip/**` or `functions/eval/ia-strip/**`
- Weekly cron (Mondays 04:00 UTC) — drift detection independent of code changes
- Manual `workflow_dispatch` — for ad-hoc runs

Currently gated by `if: false` on the eval job. To activate:

1. Confirm fixtures meet the [minimum coverage table](../../functions/eval/ia-strip/fixtures/README.md#minimum-coverage-targets-before-this-eval-is-operational).
2. Provision `GEMINI_API_KEY_EVAL` secret in repo settings — must be a separate
   key from prod with quota cap.
3. Run the workflow manually via `workflow_dispatch` and confirm a green run.
4. Remove `if: false` from the `eval` job.
5. Uncomment `pull_request` and `schedule` triggers.
6. Update CODEOWNERS so `.github/workflows/eval-ia-strip.yml` requires AI/ML
   platform review.

---

## Sign-off checklist

This eval is **not operational** until every box below is checked.

- [ ] Fixtures provisioned per minimum coverage table (210 total, balanced)
- [ ] `manifest.json` reviewed and signed by RT (commit message captures RT name + date)
- [ ] Image bucket provisioned + read-only access for CI service account
- [ ] `GEMINI_API_KEY_EVAL` secret added to repo settings
- [ ] First manual run completed; baseline accuracy ≥ 0.85 across all 5 test types
- [ ] `scripts/build-eval-fixtures.mjs` written + verified (TBD — currently a stub reference)
- [ ] CI workflow `if: false` removed and `pull_request`/`schedule` triggers uncommented
- [ ] CODEOWNERS updated for eval workflow + config
- [ ] This document updated with the actual measured baseline (replace "85–88%")
- [ ] Runbook for "eval gate fails on PR" added to incident playbook
- [ ] On-call rotation acknowledged: ambiguous-case over-confidence is a clinical-risk page

Until all boxes are checked, treat this framework as scaffolding only — do not
cite it as evidence of regression coverage in compliance documentation.

---

## Related

- Source callable: `functions/src/modules/ia-strip/callables/classifyStripGemini.ts`
- Module overview: `src/features/ia-strip/CLAUDE.md` (if present)
- Audit reference: v1.4 audit, Phase 11 findings
- Confidence threshold history: ADR pending — open one when baseline is set
