# ADR-0035: IA Accuracy Metrics & Feedback Loop (Phase 5 Task 05-04)

**Status:** Approved (2026-05-08)
**Phase:** 5 · Task 05-04
**Author:** Engineering Team
**Date:** 2026-05-08

---

## Executive Summary

This ADR documents the decision to implement an **accuracy metrics calculator** and **monthly dataset export pipeline** for training data feedback. The system measures how well Gemini Vision classifications match manually-verified verdicts, producing aggregated metrics for ML team fine-tuning and compliance auditing.

**Key Components:**
- `accuracyCalculator.ts` — calculates overall + per-confidence-bin + per-test-kit metrics
- `collectIADataset.ts` — Cloud Function callable exporting monthly datasets to Cloud Storage
- `handleMLTeamFeedback.ts` — placeholder for Phase 11+ fine-tuning feedback integration
- Firestore rules for `imuno-ia-exports` & `imuno-ia-feedback` collections
- 5 composite indexes for efficient queries

---

## Problem

Phase 4 delivered IA image classification (Gemini Vision). Phase 5 needs:

1. **Accuracy tracking** — how often does Gemini match manual verdicts?
2. **Dataset export** — monthly aggregations for ML team model fine-tuning
3. **Feedback integration** — receive improved model versions from ML team
4. **Compliance audit trail** — RDC 978 Art. 167 (laudo accuracy), DICQ 4.14.7 (supplier evaluation)

Without these, the IA pipeline lacks:
- Quality control visibility (no metrics)
- ML iteration cycle (no structured feedback)
- Regulatory traceability (no export audit trail)

---

## Decision

### 1. **Accuracy Calculation Strategy**

**Pattern:** Pure calculation library (no DB writes), invoked by Cloud Functions.

```typescript
export function calculateAccuracy(images: VerifiedImage[]): AccuracyMetrics {
  // Returns:
  // - totalImages: count of verified images
  // - correctMatches: count where geminiClassification == manualVerdict
  // - accuracy: correctMatches / totalImages (0.0 - 1.0)
  // - confusionMatrix: actual[predicted] counts
  // - confidenceBins: metrics binned by confidence (0.7-0.8, 0.8-0.9, 0.9-1.0)
  // - perTestKitMetrics: breakdown by kit (HIV, Dengue, Syphilis, COVID, HCG)
}
```

**Rationale:**
- Stateless calculation = testable, deterministic, repeatable
- Binning by confidence reveals calibration issues (e.g., 0.9-1.0 has lower accuracy → threshold too high)
- Per-test-kit breakdown enables targeted retraining (if HIV accuracy lags)
- Edge cases handled: empty lists, missing verifications → returns zero metrics

### 2. **Monthly Dataset Export Pipeline**

**Pattern:** Cloud Function callable (Admin/RT only), idempotent, immutable export.

```
collectIADataset({labId, exportMonth: "2026-05"})
  ↓
1. Query /labs/{labId}/imuno-ias-dev for verified images (manualVerdict != null)
2. Calculate accuracy metrics via accuracyCalculator
3. Sample up to 100 diverse records (balanced across test kits + confidence bins)
4. Generate ML team notes (accuracy → recommendations)
5. Upload JSON to Cloud Storage (gs://hmatologia2.appspot.com/datasets/imuno-ias/{month}-dataset.json)
6. Record audit log in /labs/{labId}/imuno-ia-exports/{exportId}
7. Return signed URL (valid 30 days)
```

**Export JSON Schema:**
```json
{
  "export_metadata": {
    "dataset_version": "1.0",
    "export_date": "2026-05-31T23:59:59Z",
    "export_month": "2026-05",
    "lab_id": "riopomba",
    "total_images": 456,
    "verified_images": 420
  },
  "accuracy_metrics": {
    "overall_accuracy": 0.88,
    "total_verified": 420,
    "correct_matches": 370,
    "confusion_matrix": { ... },
    "per_confidence_bin": { "0.7-0.8": {...}, ... },
    "per_test_kit": { "HIV": {...}, ... }
  },
  "samples": [
    {
      "image_id": "img-001",
      "test_kit": "HIV",
      "gemini_classification": "Positive",
      "gemini_confidence": 0.92,
      "manual_verdict": "Positive",
      "match": true,
      "metadata": { "lighting_condition": "bright", ... }
    },
    ...
  ],
  "ml_team_notes": "Dataset ready for fine-tuning. 420 verified samples. 88% accuracy with Gemini Vision...",
  "export_file_path": "gs://hmatologia2.appspot.com/datasets/imuno-ias/2026-05-dataset.json"
}
```

**Idempotency:** Same `exportMonth` → overwrites previous export. Cloud Storage is immutable by nature (re-upload replaces the file).

**Audit Trail:** Every export recorded in `/labs/{labId}/imuno-ia-exports/{exportId}` with:
- `exportedBy: operatorId`
- `exportedAt: timestamp`
- `stats: { totalImages, verifiedImages, accuracy }`
- `fileUrl: signedUrl`

### 3. **ML Team Feedback Integration** (Phase 5 Placeholder, Phase 11 Implementation)

**Pattern:** Cloud Function callable, stores feedback for future implementation.

```typescript
handleMLTeamFeedback({
  labId,
  modelVersion: "2.1",
  improvedAccuracy: 0.92,
  thresholdRecommendation: 0.87,
  notes: "Retraining on 420 samples improved accuracy by 4%..."
})
  ↓
Stores in /labs/{labId}/imuno-ia-feedback/{feedbackId} with status: "PENDING_IMPLEMENTATION"
```

**Phase 5 Scope:** Placeholder only. Records feedback for audit trail.

**Phase 11+ Implementation Will:**
1. Validate ML team signature (TBD: auth scheme)
2. Update `/labs/{labId}/imuno-ia-config` with new `modelVersion`
3. Set new `confidenceThreshold` if provided
4. Schedule A/B test comparison (old vs new model on new images)
5. Notify lab admin via email + Portal-RT dashboard

### 4. **Firestore Rules & Security**

**Collections:**

| Collection | Path | Write | Read | Notes |
|---|---|---|---|---|
| `imuno-ia-exports` | `/labs/{labId}/imuno-ia-exports/{id}` | Cloud Function only | Admin/RT | Immutable export records |
| `imuno-ia-feedback` | `/labs/{labId}/imuno-ia-feedback/{id}` | Cloud Function only | Admin/RT | Immutable feedback log |

**Rules:**
```firestore
match /imuno-ia-exports/{exportId} {
  allow read: if isAdminOrRT(labId);
  allow create: if false;  // Via collectIADataset callable only
  allow update, delete: if false;
}

match /imuno-ia-feedback/{feedbackId} {
  allow read: if isAdminOrRT(labId);
  allow create: if false;  // Via handleMLTeamFeedback callable only
  allow update, delete: if false;
}
```

**Multi-tenant isolation:** `labId` in path + rules check `isAdminOrRT(labId)` ensures labs cannot read each other's exports.

### 5. **Indexes**

5 composite indexes for efficient queries:

```
1. imuno-ia-exports: (labId, exportMonth)
2. imuno-ia-exports: (labId, exportedAt DESC)
3. imuno-ias-dev: (labId, manualVerdict, createdAt DESC)
4. imuno-ia-feedback: (labId, receivedAt DESC)
5. imuno-ias-dev: (labId, model_version, createdAt DESC)
```

**Rationale:** Enable fast lookups by (lab, month) and (lab, date) filtering for analytics dashboards.

---

## Alternatives Considered

### A. Real-time metrics calculation (rejected)
- **Pro:** Always current
- **Con:** Expensive on every image verify; blocks UI
- **Decision:** Batch calculation via monthly export is sufficient for ML iteration cycles

### B. Store metrics in Firestore directly (rejected)
- **Pro:** Real-time query
- **Con:** Recalculation is expensive; immutability harder to enforce
- **Decision:** Export to Cloud Storage (immutable, queryable via JSON) + audit log in Firestore

### C. No feedback mechanism (rejected)
- **Pro:** Simpler Phase 5
- **Con:** No integration path for improved models; labs stuck with baseline
- **Decision:** Placeholder callable in Phase 5, functional in Phase 11+

---

## Consequences

### Positive

1. **Accuracy visibility** — operators see how well Gemini performs → trust in IA
2. **Compliance audit trail** — RDC 978 Art. 167 (supplier evaluation) = Gemini accuracy records
3. **ML iteration** — structured feedback loop enables incremental model improvements
4. **Data-driven decisions** — per-kit metrics guide retraining priorities (e.g., "HIV needs work")
5. **Immutability** — exports never modified after creation → audit evidence

### Negative

1. **Manual verification overhead** — operators must verify images to build training set
2. **Monthly cadence** — feedback loop is slow (30-45 days per iteration)
3. **Cloud Storage costs** — monthly exports + 30-day retention = ~10 MB/lab/year
4. **Phase 11 dependency** — fine-tuning benefits only realized in Phase 11+

---

## Implementation

### Code Artifacts

| File | Lines | Purpose |
|---|---|---|
| `functions/src/modules/ciqImuno/accuracyCalculator.ts` | 196 | Pure calculation library |
| `functions/src/modules/ciqImuno/collectIADataset.ts` | 417 | Monthly export callable |
| `functions/src/modules/ciqImuno/handleMLTeamFeedback.ts` | 112 | Feedback placeholder callable |
| `functions/test/ciqImuno/accuracyCalculator.test.mjs` | 362 | 7 unit tests (100% coverage) |
| `functions/test/ciqImuno/collectIADataset.test.mjs` | 273 | 8 unit tests (schema + diversity) |
| `firestore.rules` | +30 lines | Rules for export + feedback collections |
| `firestore.indexes.json` | +5 indexes | Composite indexes for queries |
| `functions/src/index.ts` | exports | Register callables |

### Tests

- **accuracyCalculator.test.mjs:** 7 tests
  1. Known confusion matrix (80% accuracy)
  2. Confusion matrix structure
  3. Per-confidence binning (0.7-0.8, 0.8-0.9, 0.9-1.0)
  4. Per-test-kit metrics
  5. Empty image list (zero division)
  6. No verified images
  7. Perfect accuracy (100%)

- **collectIADataset.test.mjs:** 8 tests
  1. Export JSON schema validation
  2. Sample diversity across test kits
  3. Sample limit (max 100)
  4. Accuracy metrics correctness
  5. Per-confidence bin totals
  6. Per-test-kit totals
  7. Sample record schema
  8. ML team notes generation

**All 15 tests passing.**

### Deployment Order

1. ✅ `firestore.rules` — add export + feedback rules
2. ✅ `firestore.indexes.json` — add 5 composite indexes
3. ✅ `functions/src/modules/ciqImuno/*.ts` — new callables
4. ✅ `functions/test/ciqImuno/*.test.mjs` — unit tests
5. 🔄 `firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2`
6. 🔄 `firebase deploy --only functions:collectIADataset --project hmatologia2`
7. 🔄 `firebase deploy --only functions:handleMLTeamFeedback --project hmatologia2`
8. 🔄 `firebase deploy --only hosting --project hmatologia2`

---

## Compliance

| Requirement | Coverage | Notes |
|---|---|---|
| RDC 978 Art. 167 | ✅ Full | Supplier (Gemini) accuracy evaluation; export = evidence |
| DICQ 4.14.7 | ✅ Full | Supplier evaluation on metrics; annual review via dashboard |
| LGPD Art. 9 | ✅ Full | Image data only shared with ML team via auth-gated export (admin-only) |
| Audit trail | ✅ Full | Every export logged in Firestore + immutable in Cloud Storage |
| Non-repudiation | ✅ Full | Export signed by operatorId + timestamp |

---

## References

- ADR-0010: Gemini Vision API as IA Baseline
- ADR-0025: IA Strip Classification via Gemini Vision API
- Phase 4 Completion Summary: Portal-RT, Portal-Paciente, Laudo OCR
- Phase 5 Task 05-03: IA Image Upload Pipeline (dependency)
- Phase 11: IA Fine-tuning & Model Deployment (future)

---

## Questions & Decisions Log

**Q:** Should ML team have direct read access to exports?
**A:** No. Admin exports to Cloud Storage with signed URL; ML team receives URL via secure channel (email/Slack). No Firestore access for external teams.

**Q:** What if accuracy is very low (e.g., 40%)?
**A:** ML team notes will recommend data collection (diverse training set). Lab can pause IA use and rely on manual verification only (RDC 978 allows this).

**Q:** When do we measure accuracy? Per-image or monthly aggregate?
**A:** Both. Per-image: visible on verification UI (confidence score). Monthly: aggregated export for ML team. This enables real-time confidence guidance + batch fine-tuning.

**Q:** Should we version the metrics schema?
**A:** Yes — `dataset_version: "1.0"` in export_metadata. Phase 11 fine-tuning may add new fields; version pinning ensures backward compatibility.
