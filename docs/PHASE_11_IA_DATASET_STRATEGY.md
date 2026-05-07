# Phase 11 — IA Dataset Strategy

**Date**: 2026-05-07  
**Status**: Active  
**Owner**: IA/ML workstream  
**Dependencies**: Phase 10 (analyzer foundation), Phase 12 (model improvement)

---

## Executive Summary

Phase 11 establishes the **data collection, curation, and versioning infrastructure** for rapid Gemini 2.5 Flash fine-tuning and validation cycles. By phase end, target **500+ validated images** across 5 test kits (HIV, Dengue, Syphilis, COVID, HCG), with audit trail and privacy compliance.

**Critical path**:
1. **Week 1**: Collection protocol + metadata schema + privacy review
2. **Week 2–3**: Daily automated capture + manual RT classification
3. **Week 4**: Export pipeline + versioning + handoff to Phase 12

---

## 1. Collection Strategy

### 1.1 Daily Target & Timeline

| Phase | Daily Target | Duration | Cumulative |
|-------|--------------|----------|-----------|
| Phase 11.1 | 50+ images | Weeks 1–2 | 700+ |
| Phase 11.2 | 75+ images | Weeks 3–4 | 500+ (final) |
| Phase 12 | 100+ images | Ongoing | 1,000+ |

**Rationale**: 50 images/day across 5 test kits = 10 per kit per day. By end of 4 weeks, each kit has 200–250 images with manual validation. Diversity of conditions (positive, negative, borderline, invalid) captured within this volume.

### 1.2 Image Capture Points

**Primary sources**:

1. **Analyzer module** — auto-capture via camera during routine CIQ runs
   - Device: configured smartphone or microscope camera (see 1.3)
   - Trigger: on test kit image acquisition (OCR pipeline)
   - Format: JPEG, 2MB max, sRGB color space

2. **Manual RT override** — when analyzer confidence <0.85 or on-site testing
   - Portal: `src/features/analyzer/components/ManualImageUpload.tsx`
   - Metadata form: device model, lighting condition, batch ID, manual result
   - Fallback: if camera unavailable

3. **Batch replay** — existing test kit images from archive
   - Source: historical CIQ images (2024–2026) with known results
   - Scope: up to 100 images per kit (seed dataset)
   - Audit: linked to original test record via `originalTestId`

### 1.3 Camera & Device Specification

| Parameter | Spec |
|-----------|------|
| **Resolution** | ≥12 MP |
| **Focus distance** | 10–30cm (macro-capable) |
| **Color accuracy** | sRGB or calibrated |
| **Supported devices** | iPhone 12+, Samsung S21+, Xiaomi 12+, microscope USB cam |
| **Auto-settings** | white balance ON, HDR ON, no digital zoom |
| **Baseline** | Google Pixel 7 Pro (internal standard) |

**Setup checklist** (in `analyzer/SETUP_CAMERA.md`):
- [ ] Test focus depth at 15cm and 25cm
- [ ] Capture white balance card reference for post-processing
- [ ] Verify ISO <1600 in lab lighting
- [ ] Record device model + OS in metadata
- [ ] 5-image test batch before production

---

## 2. Metadata Capture Schema

All captured images are **immutable once ingested**; metadata is stored separately.

### 2.1 Image Metadata Record (Firestore)

**Collection**: `/labs/{labId}/ia-datasets/images/{imageId}`

```typescript
interface ImageMetadata {
  // Identity
  imageId: string                    // UUID v4
  labId: string                      // multi-tenant
  
  // Image file
  imageUrl: string                   // Cloud Storage path
  imageSize: number                  // bytes
  imageMimeType: 'image/jpeg'        // fixed for Phase 11
  imageHash: string                  // SHA-256 (immutable validation)
  
  // Capture context
  captureSource: 'analyzer' | 'manual' | 'batch-replay'
  captureDevice: {
    model: string                    // e.g., "iPhone 13 Pro"
    os: string                       // "iOS 17.2" | "Android 14"
    camera: string                   // "Main" | "Macro" | "Microscope USB"
  }
  captureLighting: 'standard' | 'led-ring' | 'natural' | 'microscope'
  captureDateTime: Timestamp         // ISO 8601 + tz
  
  // Test kit context
  testKitType: 'hiv' | 'dengue' | 'syphilis' | 'covid' | 'hcg'
  testKitBatch: string               // Batch ID from kit packaging
  testKitExpiryDate: Date            // exp date of test kit
  testKitManufacturer: string        // e.g., "BioSure"
  
  // Classification (manual, by RT)
  manualResult: 'positive' | 'negative' | 'invalid' | 'borderline' | 'unclear'
  manualConfidence: number           // 0.0–1.0 (RT confidence in their classification)
  classifiedBy: {
    operatorId: string               // RT who classified
    operatorName: string
    timestamp: Timestamp
  }
  classificationNotes: string        // "Very faint line", "Expired kit", etc.
  
  // Gemini baseline (for comparison in Phase 12)
  geminiBaseline?: {
    result: 'positive' | 'negative' | 'invalid'
    confidence: number               // 0.0–1.0
    rawResponse: string              // Full Gemini response
    timestamp: Timestamp
  }
  
  // Audit & versioning
  datasetVersion: string             // e.g., "v1.1.0" (phase 11.2)
  included: boolean                  // false = marked for exclusion, not deleted
  exclusionReason?: string           // "Duplicate", "RT unsure", "PII detected"
  
  // Regulatory compliance
  hasPII: boolean                    // false always; checked at ingestion
  pseudonym?: string                 // TEMP_LAB_ID-KIT-SEQ (no real patient ID)
  
  // Soft delete
  deletadoEm?: Timestamp
}
```

### 2.2 Batch Metadata Record

**Collection**: `/labs/{labId}/ia-datasets/batches/{batchId}`

```typescript
interface BatchMetadata {
  batchId: string                    // UUID
  labId: string
  
  // Batch period
  batchDate: Date                    // Month/week of capture
  batchPeriod: 'week' | 'month'
  
  // Summary statistics
  totalImages: number
  imagesByKit: {
    hiv: number
    dengue: number
    syphilis: number
    covid: number
    hcg: number
  }
  imagesByResult: {
    positive: number
    negative: number
    invalid: number
    borderline: number
    unclear: number
  }
  imagesByDevice: Record<string, number>  // { "iPhone 13 Pro": 45, ... }
  imagesByLighting: Record<string, number>
  
  // Quality metrics
  avgManualConfidence: number        // mean RT confidence
  imagesMissing: number              // images not yet classified
  imagesExcluded: number             // images marked for exclusion
  
  // Artifacts
  exportedTo: string[]               // ["2026-05-07-monthly-export.zip", ...]
  changeLog: string                  // "Added 50 images, corrected 3 classifications"
  
  // Audit
  createdBy: string                  // operatorId of batch uploader
  criadoEm: Timestamp
  deletadoEm?: Timestamp
}
```

### 2.3 Metadata Validation Rules

**Firestore Security Rules** (in `firestore.rules`):

```
// ia-datasets collection is write-restricted to callable functions
match /labs/{labId}/ia-datasets/{document=**} {
  allow read: if request.auth.uid != null && isMember(labId);
  allow write: if request.auth.token.claims.role == 'rt' || request.auth.token.claims.role == 'superadmin';
}
```

**Zod schema** (in `src/features/analyzer/schemas/ImageMetadata.ts`):

```typescript
export const ImageMetadataSchema = z.object({
  imageId: z.string().uuid(),
  labId: z.string(),
  imageUrl: z.string().url(),
  imageSize: z.number().min(10000).max(2097152),  // 10KB–2MB
  imageMimeType: z.literal('image/jpeg'),
  imageHash: z.string().regex(/^[a-f0-9]{64}$/),
  
  captureSource: z.enum(['analyzer', 'manual', 'batch-replay']),
  captureDevice: z.object({
    model: z.string().min(3),
    os: z.string(),
    camera: z.enum(['Main', 'Macro', 'Microscope USB']),
  }),
  captureLighting: z.enum(['standard', 'led-ring', 'natural', 'microscope']),
  captureDateTime: z.instanceof(Timestamp),
  
  testKitType: z.enum(['hiv', 'dengue', 'syphilis', 'covid', 'hcg']),
  testKitBatch: z.string().regex(/^[A-Z0-9]{6,20}$/),
  testKitExpiryDate: z.instanceof(Date),
  testKitManufacturer: z.string(),
  
  manualResult: z.enum(['positive', 'negative', 'invalid', 'borderline', 'unclear']),
  manualConfidence: z.number().min(0).max(1),
  classifiedBy: z.object({
    operatorId: z.string(),
    operatorName: z.string(),
    timestamp: z.instanceof(Timestamp),
  }),
  classificationNotes: z.string().max(500),
  
  geminiBaseline: z.object({
    result: z.enum(['positive', 'negative', 'invalid']),
    confidence: z.number().min(0).max(1),
    rawResponse: z.string(),
    timestamp: z.instanceof(Timestamp),
  }).optional(),
  
  datasetVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
  included: z.boolean(),
  exclusionReason: z.string().optional(),
  
  hasPII: z.literal(false),
  pseudonym: z.string().optional(),
  
  deletadoEm: z.instanceof(Timestamp).optional(),
});
```

---

## 3. Privacy & Compliance

### 3.1 PII Detection & Redaction

**Automated checks** (Cloud Function `checkImageForPII`):

1. **OCR scan** (Google Vision API):
   - Detect text in image (patient names, ID numbers, dates, addresses)
   - If found, flag `hasPII = true`, reject ingestion
   - Notification: notify lab admin with image + detected text

2. **Metadata validation**:
   - No patient identifiers in `classificationNotes`
   - No real patient IDs in any field
   - Pseudonym format: `{labId}-{kitType}-{seq}` (e.g., `LAB-001-HIV-0001`)

3. **Fallback redaction** (manual review):
   - If automated check is ambiguous, RT must manually confirm no PII
   - UI checkbox: "I have reviewed this image and confirm no patient identifiers are visible"

### 3.2 Data Retention & Deletion

| Phase | Retention | Policy |
|-------|-----------|--------|
| Phase 11 | 4 weeks (active collection) | Keep all unexcluded images |
| Phase 12+ | 12 months (model training) | Soft-delete after model deployment; hard-delete after 12 months |
| End of contract | Hard-delete all | LGPD + DICQ compliance |

**Soft delete only**: `deletadoEm` timestamp, never permanent removal during active phases.

### 3.3 Regulatory Compliance Checklist

- [ ] **LGPD Article 5**: No personal data collected beyond what's necessary (pseudonymized only)
- [ ] **DICQ 4.3**: Image metadata audit trail complete (operator, timestamp, classification)
- [ ] **RDC 978 §48**: Quality control evidence immutable (imageHash + signature)
- [ ] **ISO 15189 §4.14.3**: Records retained per retention schedule (see 3.2)

---

## 4. Export Pipeline

### 4.1 Monthly Export Format

**Trigger**: Automatic export on 1st day of each month (Cloud Scheduler).

**Output structure**:

```
2026-05-MONTHLY-EXPORT/
├── metadata.csv
├── images/
│   ├── hiv/
│   │   ├── LAB-001-HIV-0001.jpg
│   │   └── ...
│   ├── dengue/
│   ├── syphilis/
│   ├── covid/
│   └── hcg/
├── changelog.md
└── manifest.json
```

### 4.2 Metadata CSV Schema

```csv
imageId,testKitType,manualResult,manualConfidence,captureDevice,captureLighting,captureDateTime,testKitBatch,datasetVersion,included,geminiConfidence,geminiResult
LAB-001-HIV-0001,hiv,positive,0.95,iPhone 13 Pro,standard,2026-05-01T09:30:00Z,BIO-SUR-202405,v1.1.0,true,0.92,positive
LAB-001-HIV-0002,hiv,negative,0.98,Pixel 7,led-ring,2026-05-01T10:15:00Z,BIO-SUR-202405,v1.1.0,true,0.88,negative
LAB-001-DENG-0001,dengue,invalid,0.87,iPhone 13 Pro,standard,2026-05-02T08:00:00Z,TEST-DEN-202405,v1.1.0,false,NULL,NULL
```

### 4.3 Manifest & Changelog

**manifest.json**:

```json
{
  "exportDate": "2026-05-01",
  "datasetVersion": "v1.1.0",
  "labId": "LAB-001",
  "totalImages": 487,
  "imagesByKit": {
    "hiv": 102,
    "dengue": 95,
    "syphilis": 98,
    "covid": 96,
    "hcg": 96
  },
  "imagesByResult": {
    "positive": 167,
    "negative": 265,
    "invalid": 32,
    "borderline": 23,
    "unclear": 0
  },
  "avgManualConfidence": 0.93,
  "imagesExcluded": 13,
  "checksums": {
    "metadata.csv": "sha256:abc123...",
    "images.zip": "sha256:def456..."
  },
  "exportedBy": "system@hmatologia2.iam.gserviceaccount.com",
  "notes": "Phase 11.2 final export. 13 images excluded: 7 duplicates, 4 RT unsure, 2 potential PII."
}
```

**changelog.md**:

```markdown
# Dataset Changelog

## v1.1.0 — 2026-05-01 (Phase 11.2 final)

### Additions
- +50 new images (Week 4 capture)
- LED-ring lighting variant tested (15 images)
- Borderline classification category added

### Corrections
- Corrected 3 classifications after RT review
- Reclassified image LAB-001-COVID-0047 (negative → borderline)

### Exclusions
- 7 duplicate images removed (same test, re-photographed)
- 4 images marked "RT unsure" (confidence <0.7)
- 2 images with potential PII in background (manual redaction pending)

### Quality Notes
- Average manual confidence: 0.93 (up from 0.91)
- Lighting diversity improved (45% standard, 35% LED-ring, 20% microscope)
- Device diversity: 8 different models tested

## v1.0.0 — 2026-04-01 (Phase 11.1 initial)
- Baseline dataset: 400 images across 5 test kits
- Manual classification complete for all
- Gemini baseline captured
```

### 4.4 Versioning Scheme

**Format**: `v{major}.{minor}.{patch}`

| Version | Trigger | Scope |
|---------|---------|-------|
| v1.0.0 | Phase 11.1 complete | Initial dataset, 400 images, all classified |
| v1.1.0 | Phase 11.2 complete | +100 images, corrections applied, lighting expanded |
| v1.2.0 | Phase 12 checkpoint | +200 images, model improvements incorporated |
| v2.0.0 | Production deployment | Major schema or collection strategy change |

**Backward compatibility**: older versions archived as `.zip` in Cloud Storage (`gs://hmatologia2-ia-datasets/`), never deleted.

---

## 5. Diversity Targets

### 5.1 Test Kit Coverage

| Kit | Target | Positive % | Negative % | Invalid % | Borderline % |
|-----|--------|-----------|-----------|-----------|-------------|
| HIV | 100+ | 35% | 55% | 8% | 2% |
| Dengue | 100+ | 30% | 60% | 7% | 3% |
| Syphilis | 100+ | 35% | 55% | 7% | 3% |
| COVID | 100+ | 25% | 65% | 7% | 3% |
| HCG | 100+ | 40% | 50% | 8% | 2% |

**Rationale**: Weighted toward negatives (most common clinical outcome) with sufficient positive cases for model sensitivity tuning. Invalid and borderline are edge cases but essential for error-handling.

### 5.2 Device Diversity

**Minimum devices per kit**: 3  
**Target devices by phase end**: 8–10

Example lineup:
- Apple: iPhone 12, iPhone 13 Pro, iPhone 14 Pro (focus depth variation)
- Android: Google Pixel 7, Samsung S21, Xiaomi 12
- Specialist: Microscope USB camera, macro lens setup

**Metadata tracking**: `captureDevice.model` logged for every image; post-analysis can isolate device-specific classifier biases.

### 5.3 Lighting Diversity

| Lighting | Target % | Use case |
|----------|----------|----------|
| Standard lab (daylight-balanced) | 40% | Reference condition |
| LED ring (macro) | 35% | Smartphone macro testing |
| Natural (window) | 15% | Field deployments |
| Microscope | 10% | Specialist labs |

---

## 6. RT Classification Guidelines

### 6.1 Manual Result Categories

**Training document** (in `analyzer/CLASSIFICATION_GUIDE.md`):

| Result | Definition | Examples | Confidence threshold |
|--------|-----------|----------|---------------------|
| **Positive** | Clear visible band(s) at test line | Red/pink band, distinct from control | ≥0.85 |
| **Negative** | Band only at control line, no test band | Control visible, test area clear | ≥0.85 |
| **Invalid** | No control band, or result uninterpretable | Whole kit blank, smeared | ≥0.90 |
| **Borderline** | Very faint or ambiguous result | Barely visible line, operator hesitant | 0.60–0.80 |
| **Unclear** | Insufficient image quality to decide | Blurry, cropped, glare | <0.60 (reject) |

**RT workflow** (in `src/features/analyzer/components/RTClassificationModal.tsx`):

1. Display image full-screen
2. RT selects result category
3. RT enters confidence (0.0–1.0 slider)
4. RT adds optional notes (max 500 chars)
5. Submit → saved to Firestore with operator ID + timestamp
6. Confirmation: "Classification saved. Image ID: LAB-001-HIV-0001"

---

## 7. Implementation Checklist

### Phase 11.1 (Week 1–2)

- [ ] Firestore schema deployed (ImageMetadata + BatchMetadata collections)
- [ ] Zod validation schemas written
- [ ] Cloud Storage buckets configured (`hmatologia2-ia-datasets/`)
- [ ] Privacy review completed (LGPD + PII detection)
- [ ] Camera setup guide drafted + devices tested
- [ ] RT classification training completed (5 RTs, 10 practice images each)
- [ ] Manual upload portal implemented (`ManualImageUpload.tsx`)
- [ ] Analyzer integration (auto-capture on test completion)

### Phase 11.2 (Week 3–4)

- [ ] Daily collection running (50+ images/day)
- [ ] Metadata completeness audit (100% of captured images classified)
- [ ] Gemini baseline evaluation (run against all 500 images)
- [ ] Export pipeline coded + tested
- [ ] Monthly export #1 generated (v1.1.0)
- [ ] Changelog + manifest documented
- [ ] Handoff document prepared for Phase 12

---

## 8. Metrics & KPIs

### 8.1 Collection Health

| KPI | Target | Frequency |
|-----|--------|-----------|
| Daily capture rate | 50+ images | Daily report |
| Classification lag | <24h from capture | Daily |
| Manual confidence (mean) | ≥0.90 | Weekly |
| Images excluded | <5% of total | Weekly |
| Device diversity (unique models) | ≥8 | Phase end |

### 8.2 Data Quality

| Check | Requirement |
|-------|-------------|
| No PII detected | 100% pass rate |
| Image hash validation | 100% match |
| Metadata completeness | 100% of required fields |
| Lighting diversity | ≥3 lighting conditions per kit |
| Result distribution balance | Positive 25–40%, Negative 50–65%, Invalid/Borderline <10% |

### 8.3 Gemini Baseline Performance

| Metric | Phase 11 expectation | Phase 12 target |
|--------|---------------------|-----------------|
| Accuracy (vs manual) | 80–85% | 92–95% |
| Sensitivity (true positive rate) | 78–82% | 90–94% |
| Specificity (true negative rate) | 82–86% | 91–95% |
| Confidence distribution | Modal 0.70–0.95 | Modal 0.85–0.99 |

---

## 9. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Insufficient daily capture** (<30 images/day) | Dataset diversity lost; Phase 12 delays | Allocate dedicated RT hours; auto-replay batch images |
| **PII leakage** (patient ID in image/notes) | LGPD breach, regulatory fine | Automated OCR check + manual RT confirmation required |
| **RT classification disagreement** | Model trained on inconsistent labels | Inter-rater reliability audit (5% sample); tie-break by lead RT |
| **Device bias** (model overfit to iPhone) | Poor generalization | Balanced device sampling; per-device accuracy tracking |
| **Image corruption** (storage failure) | Data loss | Weekly backup to separate region (multi-region replication) |

---

## 10. Handoff to Phase 12

**Deliverables** (end of Phase 11, week 4):

1. **Dataset zip** (`2026-05-MONTHLY-EXPORT.zip`)
   - 500+ images
   - metadata.csv
   - manifest.json
   - changelog.md

2. **Gemini baseline report** (`GEMINI_BASELINE_v1.1.0.md`)
   - Per-kit accuracy/sensitivity/specificity
   - Confidence distribution histograms
   - Error analysis (false positives, false negatives per kit)
   - Top 20 misclassified images (for improvement targeting)

3. **RT feedback summary** (`RT_FEEDBACK_PHASE_11.md`)
   - Classification pain points
   - Device/lighting preferences
   - Suggested improvements for Phase 12

4. **Phase 12 readiness checklist** (`PHASE_12_READINESS.md`)
   - [ ] Dataset frozen (v1.1.0)
   - [ ] Gemini baseline established (accuracy floor)
   - [ ] Prompt engineering A/B test plan ready
   - [ ] Model evaluation harness ready

---

## Appendix: Example Capture Flow (Day 1)

**Timeline**: 2026-05-08, Lab LABCLIN-001

```
09:00 — RT starts CIQ analyzer run (HIV test)
        Device: iPhone 13 Pro with macro lens
        Image captured automatically → Cloud Storage
        → ImageMetadata record created + classified
        → manualResult: "positive", manualConfidence: 0.96

10:15 — Gemini baseline called
        → result: "positive", confidence: 0.92
        → stored in ImageMetadata.geminiBaseline

10:30 — Batch summary for today:
        Captured: 52 images (10 HIV, 9 Dengue, 11 Syphilis, 12 COVID, 10 HCG)
        All classified within 15 min
        Gemini baseline: 89% accuracy vs manual
        → BatchMetadata record created
        → logged to daily dashboard

May 1, 2026 — Monthly export triggered
        → CSV generated: 487 images + metadata
        → Images zipped: 420 MB
        → Changelog: "Phase 11.1 complete..."
        → S3 versioned: gs://hmatologia2-ia-datasets/2026-05-MONTHLY-EXPORT/
        → Phase 12 team notified
```

---

**Document version**: 1.0  
**Last updated**: 2026-05-07  
**Next review**: 2026-05-14 (Phase 11.1 checkpoint)
