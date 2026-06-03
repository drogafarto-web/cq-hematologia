# IA Strip Eval Fixtures

This folder holds the labeled image set used by `promptfoo eval -c ../promptfooconfig.yaml`.

**Status: STUB.** No real images are committed. Real fixtures must come from the
validation set used by the production `classifyStripGemini` callable, with explicit
sign-off from the lab Responsável Técnico (RT).

---

## Why no images here

- Patient/lab strip images are **clinical data**. They cannot be committed to the repo.
- Real fixtures live in a separate, access-controlled bucket. Path TBD —
  see `docs/ai-evals/IA_STRIP_EVAL_FRAMEWORK.md` for provisioning instructions.
- This stub exists so the eval harness, npm script, and CI workflow can be wired
  and reviewed in isolation from the data.

---

## Layout (once provisioned)

```
fixtures/
├── README.md                  ← this file
├── manifest.json              ← ground-truth labels (human-curated, RT-signed)
├── tests.generated.yaml       ← derived from manifest.json by build:fixtures script
└── images/
    ├── hiv/
    │   ├── clear-positive-001.jpg
    │   ├── clear-negative-001.jpg
    │   └── ambiguous-faint-t-001.jpg
    ├── dengue/
    ├── syphilis/
    ├── covid/
    └── hcg/
```

---

## `manifest.json` schema

Each entry describes one labeled image:

```json
[
  {
    "imageId": "hiv/clear-positive-001",
    "imagePath": "images/hiv/clear-positive-001.jpg",
    "testType": "hiv",
    "expectedLabel": "R",
    "expectedConfidenceMin": 0.85,
    "ambiguous": false,
    "labeledBy": "rt@lab.example",
    "labeledAt": "2026-05-08T14:00:00Z",
    "notes": "Strong T line, clear C line, well-lit centered capture"
  },
  {
    "imageId": "hiv/ambiguous-faint-t-001",
    "imagePath": "images/hiv/ambiguous-faint-t-001.jpg",
    "testType": "hiv",
    "expectedLabel": "INCONCLUSIVE",
    "expectedConfidenceMin": 0.0,
    "expectedConfidenceMax": 0.8,
    "ambiguous": true,
    "labeledBy": "rt@lab.example",
    "labeledAt": "2026-05-08T14:00:00Z",
    "notes": "Faint T at 25% intensity — should self-flag for MANUAL_REVIEW"
  }
]
```

### Field semantics

| Field                   | Required | Meaning                                                                                               |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `imageId`               | yes      | Stable ID, used in eval output. `<testType>/<descriptor>-NNN`.                                        |
| `imagePath`             | yes      | Relative path under `fixtures/`.                                                                      |
| `testType`              | yes      | One of `hiv`, `dengue`, `syphilis`, `covid`, `hcg`.                                                   |
| `expectedLabel`         | yes      | Ground truth: `R`, `NR`, or `INCONCLUSIVE`.                                                           |
| `expectedConfidenceMin` | yes      | Lower bound assertion. For clear cases, set ≥ 0.85 (matches runtime threshold). For ambiguous, set 0. |
| `expectedConfidenceMax` | no       | Upper bound assertion. Set on ambiguous cases (≤ 0.80) so over-confident errors are caught.           |
| `ambiguous`             | yes      | Marks a fixture intentionally chosen to test the manual-review escalation path.                       |
| `labeledBy`             | yes      | Email of the RT/clinical reviewer who signed the label.                                               |
| `labeledAt`             | yes      | ISO-8601 timestamp of labeling.                                                                       |
| `notes`                 | no       | Human-readable context — useful when triaging eval failures.                                          |

---

## Minimum coverage targets (before this eval is operational)

| Test type | Clear R | Clear NR | Ambiguous / Inconclusive | Total   |
| --------- | ------- | -------- | ------------------------ | ------- |
| hiv       | 20      | 20       | 10                       | 50      |
| dengue    | 15      | 15       | 10                       | 40      |
| syphilis  | 15      | 15       | 10                       | 40      |
| covid     | 15      | 15       | 10                       | 40      |
| hcg       | 15      | 15       | 10                       | 40      |
| **Total** | **80**  | **80**   | **50**                   | **210** |

Rationale: 85% accuracy ± 5pp at 95% CI requires ~200 labeled cases per the
audit; the split is weighted toward HIV because it carries the highest clinical
risk if misclassified.

---

## Generating `tests.generated.yaml` from `manifest.json`

Once `manifest.json` is populated:

```bash
# (script TBD — see docs/ai-evals/IA_STRIP_EVAL_FRAMEWORK.md §"Tooling")
node scripts/build-eval-fixtures.mjs functions/eval/ia-strip/fixtures/manifest.json
```

The generator emits one promptfoo test per manifest entry, wires the prompt
selector by `testType`, attaches the image as a `vars.image` reference, and
sets per-case `assert` blocks from `expectedLabel` / `expectedConfidence*`.

---

## Sign-off required before going live

1. RT reviews and signs `manifest.json` (commit message must include RT name + date).
2. Image bucket access provisioned for CI service account (read-only).
3. Baseline run on production model — accuracy ≥ 0.85 across all 5 test types.
4. CI gate `.github/workflows/eval-ia-strip.yml` enabled (currently DRAFT).
