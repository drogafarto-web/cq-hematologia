---
phase: 11
title: 'IA Foundation — Strip OCR Classification Prep'
duration: '2 weeks'
start_date: '2026-06-09'
deploy_date: '2026-06-23'
status: 'planning'
risk_level: '2.5/10'
dicq_gain: '+3–4% (DICQ 4.7 IA training dataset)'
rdc_articles: '115 (critical values), 204 (audit trail), 5.3 (management review)'
---

# Phase 11: IA Foundation — Strip OCR Classification Prep

**Wave:** 3  
**Duration:** 2 weeks (2026-06-09 → 2026-06-23)  
**Deploy Complexity:** Medium  
**Parallel Phase:** Phase 6 (liberação completion)  
**Critical Path:** Yes (baseline for Phase 12+ IA feedback loop)

---

## Executive Summary

Phase 11 builds the **infrastructure for AI-powered strip immunology classification**. Goal: capture 500+ diverse strip images, train baseline Gemini Vision model, establish validation pipeline, and implement confidence-based manual review escalation. Delivery readiness for Phase 12 (IA feedback loop + versioning).

**Success criteria:**

- Image upload infrastructure (camera + file) live on imuno module
- Gemini Vision API integrated (3 test prompts, <3s p99 latency)
- Confidence threshold validation (0.85 default, manual override path)
- Dataset collection (50+/day target, 500+ by phase end)
- IA performance dashboard (accuracy vs. RT verdicts)
- Firestore schema + Cloud Functions (6 callables + indexes)
- E2E tests (5 critical flows)
- DICQ 4.7 compliance proof (training dataset policy + versioning)

---

## 1. Image Upload Infrastructure (UI + Validation)

### 1.1 Components & UX (Dark-first, WCAG AA)

#### Camera Feed Component

- **File:** `src/features/ciq-imuno/components/StripCameraCapture.tsx`
- **Capabilities:**
  - Live camera preview with focus guides (strip positioning visual cue)
  - Tap to capture or 3-second countdown auto-capture
  - Real-time size validation (min 640×480, max 1080p)
  - Fallback to file input for desktop/browser w/o camera access
  - Mobile responsive (iOS Safari + Android Chrome)
  - WCAG AA: aria-labels, focus visible, keyboard navigation

#### Upload Form Component

- **File:** `src/features/ciq-imuno/components/StripIAUploadForm.tsx`
- **Fields:**
  - Camera feed (live or captured image preview)
  - Test type selector (dropdown, pre-filled from context)
  - Operator notes (optional 256 char textarea)
  - Confidence threshold override (advanced toggle, default 0.85)
  - Submission button + retry logic
- **Validation:**
  - Image size <5MB (client-side check before encoding)
  - MIME type: image/jpeg, image/png, image/webp
  - Aspect ratio check (4:3 preferred, 16:9 acceptable)
  - Min resolution 640×480

#### Image Preview & Annotation

- **File:** `src/features/ciq-imuno/components/StripIAPreview.tsx`
- **Features:**
  - Thumbnail + metadata (capture time, test type, file size)
  - Auto-resize preview to 1080p (visual feedback on compression)
  - Cancel/retake button
  - Geolocation capture (optional, stored separately for privacy)

### 1.2 Firebase Storage Path Pattern

```
gs://hmatologia2.appspot.com/
├── imuno-ia-dev/{labId}/
│   ├── {year}/
│   │   ├── {month}/
│   │   │   ├── {captureId}_original.jpg
│   │   │   ├── {captureId}_resized_1080p.jpg
│   │   │   └── {captureId}_metadata.json
│   └── rejected/{year}/{month}/
│       └── {captureId}_rejected_reason.txt
```

**Metadata file example (`{captureId}_metadata.json`):**

```json
{
  "captureId": "img_20260609_abc123",
  "labId": "lab_001",
  "operatorId": "user_auth_uid",
  "testType": "igg",
  "capturedAt": "2026-06-09T14:32:15Z",
  "originalSize": 4521034,
  "resizedSize": 892456,
  "mimeType": "image/jpeg",
  "resolution": { "width": 1080, "height": 810 },
  "geolocation": { "lat": -22.5, "lng": -48.7 },
  "notes": "Clear positive reaction",
  "operatorNotes": "Good lighting conditions",
  "exifStripped": true
}
```

### 1.3 Auto-resize Pipeline (Client-side, Canvas)

- **Lib:** Canvas API (no external dependency)
- **Target:** 1080p max (maintains quality, reduces bandwidth)
- **Process:**
  1. Load original image into HTMLCanvasElement
  2. Calculate aspect ratio, scale to 1080w max
  3. Compress JPEG quality: 0.8 (80%)
  4. Convert to base64 for transmission to Cloud Function
  5. Client keeps original (for retry metadata) but sends resized

**Size limits:**

- Max upload size: **5 MB** (triggers client-side error before processing)
- Resized target: **<1 MB** (typically 650–950 KB at q=0.8)
- Battery/data consideration: max 50 images/day per operator (soft limit, enforced via UI warning)

---

## 2. Gemini Vision API Integration

### 2.1 Cloud Function Callable

**File:** `functions/src/callables/classifyStripGemini.ts`

```typescript
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import { LogicalSignature, generateChainHash } from '../helpers/signature';
import type { TestType } from '../types/ciq-imuno.types';

interface ClassifyStripPayload {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  testType: TestType;
  labId: string;
  captureId: string;
  operatorId: string;
  promptVariant?: 'v1' | 'v2' | 'v3'; // A/B testing variants
}

interface GeminiClassificationResult {
  classification: 'R' | 'NR' | 'INCONCLUSIVE';
  confidence: number; // 0–1
  reasoning: string;
  geminiModel: string;
  latencyMs: number;
  promptVariant: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

interface ClassifyStripResult {
  classification: 'R' | 'NR' | 'INCONCLUSIVE';
  confidence: number;
  reasoning: string;
  geminiLatencyMs: number;
  flaggedForManualReview: boolean; // confidence < threshold
  threshold: number;
  recommendedAction: 'AUTO_SAVE' | 'MANUAL_REVIEW' | 'OPERATOR_OVERRIDE';
  signature: LogicalSignature;
  operatorId: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const classifyStripGemini = onCall<ClassifyStripPayload, ClassifyStripResult>(
  {
    region: 'southamerica-east1',
    memory: '1GB',
    timeoutSeconds: 30,
  },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const {
      base64,
      mimeType,
      testType,
      labId,
      captureId,
      operatorId,
      promptVariant = 'v1',
    } = request.data;

    // 2. Validation
    if (!base64 || !mimeType || !testType || !labId || !captureId || !operatorId) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    if (!['R', 'NR', 'INCONCLUSIVE'].includes(classification)) {
      throw new HttpsError('invalid-argument', 'Invalid test type');
    }

    // 3. Lab membership check
    const memberDoc = await admin.firestore().doc(`labs/${labId}/members/${operatorId}`).get();
    if (!memberDoc.exists || !memberDoc.data()?.isActiveMemberOfLab) {
      throw new HttpsError('permission-denied', 'Operator not active member of lab');
    }

    // 4. Call Gemini Vision API
    const startTime = Date.now();
    let geminiResult: GeminiClassificationResult;

    try {
      const prompt = buildPrompt(testType, promptVariant);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const response = await model.generateContent([
        {
          inlineData: {
            data: base64,
            mimeType,
          },
        },
        {
          text: prompt,
        },
      ]);

      const content = response.response.text();
      geminiResult = parseGeminiResponse(content, testType, promptVariant, Date.now() - startTime);
    } catch (error: unknown) {
      console.error('[classifyStripGemini] Gemini API error:', error);
      throw new HttpsError('internal', `Gemini Vision API failed: ${(error as Error).message}`);
    }

    // 5. Confidence threshold check
    const threshold = 0.85; // Configurable per lab (future enhancement)
    const flaggedForManualReview = geminiResult.confidence < threshold;

    // 6. Generate signature for audit trail
    const hashPayload = `${captureId}|${geminiResult.classification}|${geminiResult.confidence}|${operatorId}`;
    const chainHash = generateChainHash(hashPayload);
    const signature: LogicalSignature = {
      hash: chainHash,
      operatorId,
      ts: admin.firestore.Timestamp.now(),
    };

    // 7. Determine recommended action
    let recommendedAction: 'AUTO_SAVE' | 'MANUAL_REVIEW' | 'OPERATOR_OVERRIDE';
    if (flaggedForManualReview) {
      recommendedAction = 'MANUAL_REVIEW';
    } else {
      recommendedAction = 'AUTO_SAVE';
    }

    // 8. Log classification event (non-blocking)
    const iAEventDoc = {
      captureId,
      labId,
      operatorId,
      testType,
      classification: geminiResult.classification,
      confidence: geminiResult.confidence,
      reasoning: geminiResult.reasoning,
      geminiModel: geminiResult.geminiModel,
      promptVariant,
      flaggedForManualReview,
      recommendedAction,
      signature,
      classifiedAt: admin.firestore.Timestamp.now(),
      geminiLatencyMs: geminiResult.latencyMs,
      tokensUsed: geminiResult.tokensUsed,
    };

    admin
      .firestore()
      .doc(`imuno-ia-dev/${labId}/events/${captureId}`)
      .set(iAEventDoc)
      .catch((err) => console.error('[classifyStripGemini] Audit log write failed:', err));

    // 9. Cost tracking (Gemini pricing: ~$1.25 per 1M input tokens, ~$5 per 1M output tokens)
    const costEstimate =
      (geminiResult.tokensUsed.input * 1.25 + geminiResult.tokensUsed.output * 5) / 1_000_000;
    admin
      .firestore()
      .doc(`imuno-ia-cost/${labId}/daily/${getTodayKey()}`)
      .update({
        callCount: admin.firestore.FieldValue.increment(1),
        estimatedCost: admin.firestore.FieldValue.increment(costEstimate),
        lastUpdated: admin.firestore.Timestamp.now(),
      })
      .catch(() => {
        // Create if not exists
        admin.firestore().doc(`imuno-ia-cost/${labId}/daily/${getTodayKey()}`).set({
          callCount: 1,
          estimatedCost: costEstimate,
          lastUpdated: admin.firestore.Timestamp.now(),
        });
      });

    // 10. Return result to client
    return {
      classification: geminiResult.classification,
      confidence: geminiResult.confidence,
      reasoning: geminiResult.reasoning,
      geminiLatencyMs: geminiResult.latencyMs,
      flaggedForManualReview,
      threshold,
      recommendedAction,
      signature,
      operatorId,
    };
  },
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildPrompt(testType: TestType, variant: 'v1' | 'v2' | 'v3' = 'v1'): string {
  const prompts: Record<TestType, Record<string, string>> = {
    igg: {
      v1: `Você está analisando um strip de imunoensaio para IgG (Rubéola, Toxoplasma ou Sífilis). 
      A imagem mostra a reação visual após incubação. 
      Classify como:
      - "R" (Reativo/Positivo) se houver linha vermelha clara na zona de teste (T)
      - "NR" (Não-reativo/Negativo) se houver apenas linha na zona de controle (C)
      - "INCONCLUSIVE" se a imagem está borrada, mal iluminada ou a reação está ambígua
      Responda em JSON: { "classification": "R|NR|INCONCLUSIVE", "confidence": 0.0–1.0, "reasoning": "explicação breve" }`,
      v2: `Strip de IgG (Rubéola/Toxoplasma/Sífilis). Você vê:
      - Duas linhas (C e T) = R (Reativo)
      - Uma linha (C apenas) = NR (Não-reativo)
      - Linha apagada ou banda vermelha difusa = INCONCLUSIVE
      JSON: { "classification": "R|NR|INCONCLUSIVE", "confidence": 0–1, "reasoning": "..." }`,
      v3: `IgG imunoensaio visual classification. Evaluate clarity and intensity of test line (T) vs control line (C).
      High confidence: crisp lines, good contrast. Low confidence: faint, smudged, or mixed result.
      JSON: { "classification": "R|NR|INCONCLUSIVE", "confidence": 0–1, "reasoning": "..." }`,
    },
    igm: {
      v1: `Strip de IgM (dengue, zika, infecções agudas). Mesmo critério IgG acima.`,
      v2: `IgM strip: R = 2 lines, NR = 1 line (C), INCONCLUSIVE = unclear.`,
      v3: `IgM classification (acute infection markers). Same visual criteria.`,
    },
    // ... additional test types (igg_toxo, igg_sifilis, etc.)
  };

  return prompts[testType]?.[variant] || prompts[testType]?.v1 || '';
}

function parseGeminiResponse(
  content: string,
  testType: TestType,
  promptVariant: string,
  latencyMs: number,
): GeminiClassificationResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      classification: ['R', 'NR', 'INCONCLUSIVE'].includes(parsed.classification)
        ? parsed.classification
        : 'INCONCLUSIVE',
      confidence:
        typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      reasoning: parsed.reasoning || '',
      geminiModel: 'gemini-2.5-flash',
      latencyMs,
      promptVariant,
      tokensUsed: {
        input: Math.ceil(content.length / 4) + 100, // Rough estimate
        output: Math.ceil(content.length / 3),
      },
    };
  } catch (error) {
    console.error('[parseGeminiResponse] Failed to parse Gemini response:', content, error);
    return {
      classification: 'INCONCLUSIVE',
      confidence: 0,
      reasoning: 'Failed to parse Gemini response',
      geminiModel: 'gemini-2.5-flash',
      latencyMs,
      promptVariant,
      tokensUsed: { input: 0, output: 0 },
    };
  }
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
```

### 2.2 Prompt Engineering Variants (A/B Testing)

**File:** `docs/PHASE_11_PROMPT_VARIANTS.md`

Three prompt variants to test during dataset collection:

| Variant | Style                        | Target                        | Latency | Accuracy |
| ------- | ---------------------------- | ----------------------------- | ------- | -------- |
| **v1**  | Portuguese, clinical detail  | Accuracy                      | <2.5s   | Baseline |
| **v2**  | Portuguese, terse checklist  | Speed                         | <1.5s   | 95%+     |
| **v3**  | English, visual instructions | International model alignment | <2.0s   | 94%+     |

**Evaluation metrics:** Accuracy vs. RT verdicts (ground truth), latency p50/p95/p99, token usage per call.

### 2.3 Response Schema

All Gemini responses parsed to:

```typescript
{
  classification: 'R' | 'NR' | 'INCONCLUSIVE';
  confidence: 0.0 – 1.0;
  reasoning: string; // 50–200 chars
  geminiModel: 'gemini-2.5-flash';
  latencyMs: number; // p99 target <3000
  promptVariant: 'v1' | 'v2' | 'v3';
  tokensUsed: { input: number; output: number };
}
```

**Latency target:** <3s p99 (95% of calls <2.5s)

---

## 3. Validation Pipeline (Confidence Threshold + Manual Review)

### 3.1 Decision Tree

```
CAPTURED IMAGE
    ↓
VALIDATE RESOLUTION & MIME TYPE
    ↓ (Pass)
UPLOAD TO FIREBASE STORAGE
    ↓
CALL classifyStripGemini()
    ↓
PARSE RESPONSE
    ↓
CONFIDENCE >= 0.85?
    ├─ YES (R or NR) → AUTO_SAVE
    │   ├─ Write to runs collection
    │   └─ Log to events/audit
    │
    └─ NO (confidence < 0.85) → MANUAL_REVIEW
        ├─ Show RT review UI
        ├─ Display Gemini classification + confidence
        ├─ Allow RT to override
        └─ Log final decision + RT signature
```

### 3.2 Client-side Hook

**File:** `src/features/ciq-imuno/hooks/useStripIAClassification.ts`

```typescript
import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';
import type { TestType } from '../types/_shared_refs';

interface UseStripIAClassificationOptions {
  confidenceThreshold?: number; // Default: 0.85
  onClassificationComplete?: (result: ClassificationResult) => void;
  onError?: (error: Error) => void;
}

interface ClassificationResult {
  classification: 'R' | 'NR' | 'INCONCLUSIVE';
  confidence: number;
  reasoning: string;
  flaggedForManualReview: boolean;
  recommendedAction: 'AUTO_SAVE' | 'MANUAL_REVIEW' | 'OPERATOR_OVERRIDE';
  signature: LogicalSignature;
}

export function useStripIAClassification(options: UseStripIAClassificationOptions = {}) {
  const { confidenceThreshold = 0.85, onClassificationComplete, onError } = options;
  const [isClassifying, setIsClassifying] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);

  const classifyStrip = useCallback(
    async (
      base64: string,
      mimeType: string,
      testType: TestType,
      labId: string,
      captureId: string,
      operatorId: string,
    ) => {
      setIsClassifying(true);
      try {
        const callable = httpsCallable(functions, 'classifyStripGemini');
        const response = await callable({
          base64,
          mimeType,
          testType,
          labId,
          captureId,
          operatorId,
        });

        const classificationResult = response.data as ClassificationResult;
        setResult(classificationResult);
        onClassificationComplete?.(classificationResult);

        return classificationResult;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        onError?.(err);
        throw err;
      } finally {
        setIsClassifying(false);
      }
    },
    [onClassificationComplete, onError],
  );

  return { classifyStrip, isClassifying, result };
}
```

### 3.3 Manual Review UI Component

**File:** `src/features/ciq-imuno/components/StripManualReviewModal.tsx`

- Show Gemini classification + confidence % in alert state
- Display original image (full resolution, zoomable)
- RT decision buttons: "Confirm (R)" | "Confirm (NR)" | "Mark Inconclusive"
- Optional comment field
- Digital signature capture (via `useCIQSignature` hook)
- Audit trail: decision timestamp + RT operatorId + reasoning

---

## 4. Dataset Collection Strategy

### 4.1 Collection Target

| Phase    | Week   | Target        | Cumulative |
| -------- | ------ | ------------- | ---------- |
| Phase 11 | Week 1 | 50 images/day | 350        |
| Phase 11 | Week 2 | 75 images/day | 500+       |

**Diversity requirement:** Across test types (IgG Rubéola/Toxo/Sífilis, IgM dengue/zika), lighting conditions (good/poor/harsh), and strip quality (clear/faint/borderline).

### 4.2 Privacy & Consent

- **No patient PII captured:** Images stored separately from patient records
- **Metadata stored:** Test type, result, operator ID, timestamp, confidence
- **Geolocation optional:** Stored only if lab consent given (LGPD Art. 7)
- **Retention:** 12 months (for model retraining), then archive or delete per lab policy
- **Access:** Lab admin + RT team only; no external visibility

### 4.3 Storage Path

```
imuno-ia-dev/{labId}/
├── {year}/{month}/
│   └── {captureId}_{classification}_v{promptVariant}.jpg
├── rejected/
│   └── {captureId}_rejected_reason.txt
└── metadata.jsonl (newline-delimited JSON log)
```

### 4.4 Metadata Collection

Every image logged to `imuno-ia-dev/{labId}/events/{captureId}`:

```json
{
  "captureId": "img_20260609_...",
  "testType": "igg",
  "classification": "R",
  "confidence": 0.92,
  "rtVerdict": "R",
  "rtVerdictAt": "2026-06-09T14:35:00Z",
  "rtOperatorId": "user_xyz",
  "promptVariant": "v1",
  "geminiLatencyMs": 2134,
  "agreedWithGemini": true,
  "notes": "Clear positive, good lighting"
}
```

---

## 5. IA Performance Dashboard

### 5.1 Dashboard Views

**File:** `src/features/ciq-imuno/components/IAPerformanceDashboard.tsx`

#### Tab 1: Overview

- Gemini accuracy % vs. RT verdicts (YTD)
- Total images processed (count)
- Average confidence by test type
- Top prompt variant by accuracy
- Gemini API cost trending (weekly)

#### Tab 2: Confusion Matrix

- 2×2 table: Gemini (R/NR) vs. RT (R/NR)
- Cell counts + percentages
- Sensitivity, specificity, PPV, NPV calculations

#### Tab 3: Confidence Distribution

- Histogram: confidence buckets (0–0.1, 0.1–0.2, ..., 0.9–1.0)
- % of images flagged for manual review
- Overlay: RT agreement % by confidence bucket

#### Tab 4: Trend Analysis

- Line chart: weekly accuracy + API cost
- Filter: test type, prompt variant, operator
- Monthly export button (CSV/XLSX)

#### Tab 5: Cost Tracking

- Gemini API spend this month
- Cost per classification (estimate)
- Alert if spending >$500/month (configurable)
- Projected monthly cost (based on collection rate)

### 5.2 Metrics Queries (Firestore)

```typescript
// Accuracy calculation
const events = await getCollection(`imuno-ia-dev/${labId}/events`);
const agreements = events.filter((e) => e.agreedWithGemini).length;
const accuracy = (agreements / events.length) * 100;

// Sensitivity = TP / (TP + FN)
const tp = events.filter((e) => e.classification === 'R' && e.rtVerdict === 'R').length;
const fn = events.filter((e) => e.classification === 'NR' && e.rtVerdict === 'R').length;
const sensitivity = (tp / (tp + fn)) * 100;

// Confidence bucketing
const buckets = {};
events.forEach((e) => {
  const bucket = Math.floor(e.confidence * 10) / 10;
  buckets[bucket] = (buckets[bucket] || 0) + 1;
});
```

---

## 6. Firestore Schema Sketch

### 6.1 Collections

#### imuno-ia-dev/{labId}/events (Append-only audit log)

```typescript
interface IAEventLog {
  captureId: string;
  testType: TestType;
  classification: 'R' | 'NR' | 'INCONCLUSIVE';
  confidence: number; // 0–1
  reasoning: string;
  geminiModel: 'gemini-2.5-flash';
  promptVariant: 'v1' | 'v2' | 'v3';
  geminiLatencyMs: number;
  tokensUsed: { input: number; output: number };

  // RT manual review (if confidence < 0.85)
  flaggedForManualReview: boolean;
  rtVerdict?: 'R' | 'NR' | 'INCONCLUSIVE';
  rtVerdictAt?: Timestamp;
  rtOperatorId?: string;
  rtNotes?: string;

  // Signature
  signature: LogicalSignature;

  // Audit
  operatorId: string;
  labId: string;
  classifiedAt: Timestamp;
  agreedWithGemini: boolean; // (rtVerdict === classification)

  createdAt: Timestamp;
  deletedAt: null | Timestamp; // Soft-delete only
}
```

**Indexes:**

- `{ labId, classifiedAt desc }`
- `{ labId, testType, classifiedAt desc }`
- `{ labId, flaggedForManualReview, classifiedAt desc }`
- `{ labId, promptVariant, classifiedAt desc }`

#### imuno-ia-dev/{labId}/config (Lab-specific settings)

```typescript
interface IALabConfig {
  labId: string;

  // Thresholds & rules
  confidenceThreshold: number; // 0.85 default
  minImagesBeforeModelUpdate: number; // 100

  // Collection targets
  dailyCollectionTarget: number; // 50 images/day
  maxImagesPerDay: number; // 200 (soft limit)

  // Prompt variant (A/B test allocation)
  promptVariantAllocation: {
    v1: 0.34; // 34% of images use v1
    v2: 0.33;
    v3: 0.33;
  };

  // Privacy & consent
  recordGeolocation: boolean;
  retentionDays: number; // 365 default

  // Notifications
  alertEmail: string[];
  alertOnAccuracyDrop: number; // 0.80 (80% accuracy alert)

  updatedAt: Timestamp;
  updatedBy: string; // Admin operator ID
}
```

#### imuno-ia-cost/{labId}/daily/{dateKey} (Cost tracking)

```typescript
interface IACostDaily {
  labId: string;
  dateKey: string; // YYYY-MM-DD

  callCount: number;
  estimatedCost: number; // USD
  tokensUsed: {
    input: number;
    output: number;
  };

  lastUpdated: Timestamp;
}
```

**Index:** `{ labId, dateKey desc }`

### 6.2 Firestore Rules Additions

```
match /imuno-ia-dev/{labId} {
  // Lab admin only (config doc)
  match /config {
    allow read: if isActiveMemberOfLab(labId);
    allow write: if isAdminOfLab(labId);
  }

  // Append-only events (operators + readers)
  match /events/{captureId} {
    allow read: if isActiveMemberOfLab(labId);
    allow create: if isActiveMemberOfLab(labId)
                     && request.resource.data.labId == labId
                     && validSignature(request.resource.data.signature);
    allow update, delete: if false; // Immutable
  }

  // Cost tracking (admin read, system write)
  match /daily/{dateKey} {
    allow read: if isAdminOfLab(labId);
    allow write: if request.auth.uid == getFunction('cloudFunctionServiceAccountUid');
  }
}
```

---

## 7. Cloud Functions Callables

### 7.1 Function Inventory

| Callable                  | Purpose                        | Region             | Timeout | Owner    |
| ------------------------- | ------------------------------ | ------------------ | ------- | -------- |
| `classifyStripGemini`     | Core IA classification         | southamerica-east1 | 30s     | Phase 11 |
| `collectIADataset`        | Batch image upload tracking    | southamerica-east1 | 60s     | Phase 11 |
| `trackIAAccuracy`         | Log RT verdict & agreement     | southamerica-east1 | 15s     | Phase 11 |
| `getIAPerformanceMetrics` | Dashboard data aggregation     | southamerica-east1 | 20s     | Phase 11 |
| `updateIALabConfig`       | Admin config updates           | southamerica-east1 | 10s     | Phase 11 |
| `exportIADataset`         | Batch dataset export (ML team) | southamerica-east1 | 120s    | Phase 12 |

### 7.2 Stubs (To be implemented in Phase 11)

```typescript
// functions/src/callables/collectIADataset.ts
export const collectIADataset = onCall(...); // Count + aggregate daily

// functions/src/callables/trackIAAccuracy.ts
export const trackIAAccuracy = onCall(...); // Log RT verdict + calculate agreement

// functions/src/callables/getIAPerformanceMetrics.ts
export const getIAPerformanceMetrics = onCall(...); // Return dashboard data

// functions/src/callables/updateIALabConfig.ts
export const updateIALabConfig = onCall(...); // Admin config changes
```

---

## 8. Prompt Engineering Variations (Testing Plan)

### 8.1 Variants

| Variant | Language   | Style                                       | Expected Strength    | A/B Weight |
| ------- | ---------- | ------------------------------------------- | -------------------- | ---------- |
| **v1**  | Portuguese | Clinical detail + decision rules            | High accuracy        | 34%        |
| **v2**  | Portuguese | Terse checklist (faster)                    | Speed + 95% accuracy | 33%        |
| **v3**  | English    | Visual cues (international model alignment) | Model generalization | 33%        |

### 8.2 Evaluation

**Daily metrics logged per variant:**

- Accuracy (% agreement with RT verdict)
- Latency p50/p95/p99
- Token usage (input + output)
- Confidence distribution

**Phase 11 exit criteria:** Choose winner (highest accuracy ≥92%) for v1.0 baseline in Phase 12.

---

## 9. E2E Test Specs (5 Critical Flows)

### 9.1 Flow 1: Camera Capture → Classification → Auto-Save

**File:** `src/__tests__/ciq-imuno/phase-11-camera-auto-save.e2e.spec.ts`

```typescript
describe('CIQ Imuno — Phase 11 Camera Auto-Save Flow', () => {
  it('RT captures strip image → Gemini classifies → confidence ≥0.85 → auto-saves result', async () => {
    // 1. Open imuno module
    // 2. Click "Capturar Strip" button
    // 3. Approve camera permission
    // 4. Position strip in camera feed
    // 5. Tap "Capturar"
    // 6. Verify image preview + metadata fields
    // 7. Select test type (IgG)
    // 8. Click "Enviar para Análise de IA"
    // 9. Wait for classifyStripGemini() response
    // 10. Verify: confidence = 0.92, flaggedForManualReview = false
    // 11. Verify: result auto-saved to runs collection (no manual review shown)
    // 12. Verify: event logged to imuno-ia-dev/events/{captureId}
  });
});
```

### 9.2 Flow 2: File Upload → Confidence <0.85 → Manual Review

```typescript
it('RT uploads file → confidence 0.78 → manual review modal → RT overrides → signature captured', async () => {
  // 1. Open imuno module
  // 2. Click "Upload from file"
  // 3. Select JPEG file
  // 4. Select test type
  // 5. Submit
  // 6. Wait for classification
  // 7. Verify: StripManualReviewModal shown (confidence 0.78 < 0.85)
  // 8. Display Gemini classification + confidence + reasoning
  // 9. RT clicks "Confirmar (R)"
  // 10. Sign modal shown (signature hook)
  // 11. RT signs
  // 12. Verify: Run saved with rtVerdict + signature
  // 13. Verify: Event logged with agreedWithGemini = false
});
```

### 9.3 Flow 3: Prompt Variant A/B — Collect Images Across All 3 Variants

```typescript
it('Phase 11 dataset collection respects prompt variant allocation (33% v1, v2, v3)', async () => {
  // Simulate 300 image uploads
  // Verify: ~100 assigned to v1, ~100 to v2, ~100 to v3
  // Verify: each variant logged correctly in events
  // Verify: accuracy metrics per variant calculated
});
```

### 9.4 Flow 4: Dashboard — Accuracy Metrics Display

```typescript
it('IA Performance Dashboard displays confusion matrix + accuracy %', async () => {
  // 1. Seed test data: 50 events (40 agree, 10 disagree)
  // 2. Open IAPerformanceDashboard
  // 3. Navigate to "Confusion Matrix" tab
  // 4. Verify: TP count, FN count, sensitivity/specificity calculated
  // 5. Verify: Accuracy = 80% displayed
  // 6. Verify: Cost section shows estimated spend
});
```

### 9.5 Flow 5: Cost Tracking — Alert Threshold

```typescript
it('Gemini API cost tracking alerts when spending exceeds $500/month', async () => {
  // 1. Simulate 5,000 Gemini calls (avg $0.12 per call)
  // 2. Seed cost data: imuno-ia-cost/{labId}/daily/{dateKeys}
  // 3. Open IAPerformanceDashboard (Cost tab)
  // 4. Verify: Monthly projected cost calculated
  // 5. If >$500, verify: warning banner shown
  // 6. Admin clicks "View Cost Mitigation"
  // 7. Verify: suggestions popup (reduce daily target, pause collection)
});
```

---

## 10. Dataset Management

### 10.1 Daily Collection Process

**Workflow:**

1. **Morning (6:00 AM BRT):** Lab ops team starts daily collection
   - Opens imuno module
   - Clicks "IA Dataset Collection Mode"
   - Proceeds with strip captures (target 50/day)

2. **Throughout day:** Images uploaded + classified + audited
   - Automatic logging to imuno-ia-dev/{labId}/events/

3. **Evening (6:00 PM BRT):** Sync report
   - Dashboard shows: images collected today, accuracy, cost
   - Alert if <25 images (missed target)

4. **Monthly export (1st of month):** ML team download
   - CSV export: {captureId, classification, confidence, rtVerdict, promptVariant, ...}
   - Store in shared Drive folder (LGPD-approved storage)

### 10.2 Versioning Strategy

```
imuno-ia-dev/{labId}/
├── dataset_v1.0_baseline.csv       # 500 images (Phase 11)
├── dataset_v1.0_baseline_meta.json # Collection metadata
├── dataset_v1.1_experimental.csv   # 1,000+ images (Phase 12)
└── versions.log                     # Audit trail
```

**version.log entry:**

```
v1.0_baseline | 2026-06-23 | 523 images | v1:v2:v3 = 34:33:33 | 92.1% accuracy | deployed
v1.1_experiment | 2026-07-14 | 1050 images | v1:v2:v3 = 20:40:40 | in-collection
```

---

## 11. DICQ Mapping (Quality Assurance)

### 11.1 DICQ 4.7 — Machine Learning / IA Governance

**Requirement:** Organization must document IA model training, validation, and monitoring.

**Phase 11 Deliverables:**

1. **Training dataset policy** (`docs/PHASE_11_IA_TRAINING_POLICY.md`)
   - Image selection criteria (diversity, quality)
   - Consent & privacy safeguards
   - Retention schedule

2. **Model versioning procedure** (`docs/PHASE_11_IA_MODEL_VERSIONING.md`)
   - How baseline v1.0 was trained (500 images, 92%+ accuracy)
   - How v1.1+ experiments are A/B tested
   - Rollback procedure if accuracy drops

3. **Performance monitoring** (`src/features/ciq-imuno/components/IAPerformanceDashboard.tsx`)
   - Real-time accuracy tracking vs. RT verdicts (ground truth)
   - Alert if accuracy <88% (configurable per lab)
   - Monthly trend reports

4. **Validation audit trail**
   - Every classification logged with signature + operator ID
   - RT overrides captured + reasoned
   - Gemini API costs tracked (cost control)

**DICQ compliance checklist:**

- [ ] Training dataset documented (50-day collection target = 500+ images)
- [ ] Prompt engineering variants tested (v1, v2, v3)
- [ ] Accuracy baseline established (92%+ vs. RT verdicts)
- [ ] Model versioning procedure drafted
- [ ] Performance dashboard live
- [ ] Audit trail complete (events collection)

---

## 12. Risk Register

### High-Priority Risks

| Risk                                   | Likelihood | Impact   | Mitigation                                                             |
| -------------------------------------- | ---------- | -------- | ---------------------------------------------------------------------- |
| **Gemini API cost overrun**            | Medium     | High     | Cost tracking + $500/month alert + daily target soft limits            |
| **Model accuracy <80%**                | Low        | High     | A/B testing 3 prompt variants; choose best v1.0 baseline               |
| **Dataset skew (mostly R)**            | Medium     | Medium   | Daily collection review + enforce diversity requirement                |
| **Confidence threshold miscalibrated** | Medium     | Medium   | Phase 11 exit: tune threshold based on 500-image validation            |
| **Privacy breach (patient PII)**       | Low        | Critical | No PII in image metadata; geolocation optional; 12-month retention max |
| **Gemini API latency >3s p99**         | Low        | Medium   | Fallback to manual review if timeout; alert ops team                   |

### Cost Control (Gemini API)

**Budget:** ~$500/month (hard cap, to be reviewed post-Phase 11)

**Tracking:** Daily cost logged to `imuno-ia-cost/{labId}/daily/{dateKey}`

**Calculation:**

- Input tokens: ~$1.25 per 1M
- Output tokens: ~$5.00 per 1M
- Avg classification: 350 input tokens + 80 output tokens = ~$0.00058 per call
- 50 images/day × 30 days = 1,500 calls/month ≈ $0.87/month (well below budget)

**Alert:** If monthly spend trajectory >$500, notify lab admin + pause collection

---

## 13. Implementation Tasks & Dependencies

### Phase 11 Task Breakdown

| Week | Task                     | Subtask                                         | Owner  | Status |
| ---- | ------------------------ | ----------------------------------------------- | ------ | ------ |
| W1   | **Image upload infra**   | StripCameraCapture component                    | Eng1   | —      |
| W1   |                          | Firebase Storage path + auto-resize             | Eng1   | —      |
| W1   |                          | Upload form validation (size, MIME, resolution) | Eng1   | —      |
| W1   | **Gemini integration**   | classifyStripGemini callable                    | Eng2   | —      |
| W1   |                          | Prompt v1/v2/v3 engineering                     | Eng2   | —      |
| W1   |                          | Response parsing + error handling               | Eng2   | —      |
| W1   | **Validation pipeline**  | Confidence threshold logic                      | Eng3   | —      |
| W1   |                          | StripManualReviewModal component                | Eng3   | —      |
| W1   |                          | Manual override + signature capture             | Eng3   | —      |
| W2   | **Firestore schema**     | Collections + indexes + rules                   | Eng2   | —      |
| W2   |                          | Cost tracking callables                         | Eng2   | —      |
| W2   | **Dashboard**            | IAPerformanceDashboard 5 tabs                   | Eng4   | —      |
| W2   |                          | Confusion matrix + metrics queries              | Eng4   | —      |
| W2   |                          | Cost trending + alerts                          | Eng4   | —      |
| W2   | **Testing & validation** | E2E test specs (5 flows)                        | QA     | —      |
| W2   |                          | Phase 11 smoke tests                            | QA     | —      |
| W2   |                          | Cloud Logs monitoring (24h post-deploy)         | DevOps | —      |

**Dependencies:**

- Gemini API key provisioned + quota verified (Week 1, Day 1)
- Firebase Storage bucket write access confirmed (Week 1, Day 1)
- Cloud Function emulator tested (Week 1, Day 2)

---

## 14. Success Criteria & Phase Exit

### Phase 11 Exit Gate Criteria

| Criterion               | Target                                       | Status |
| ----------------------- | -------------------------------------------- | ------ |
| **Code coverage**       | >85% (E2E + unit tests)                      | —      |
| **Functionality**       | All 6 callables + dashboard live             | —      |
| **Dataset collection**  | 500+ images by phase end                     | —      |
| **Gemini accuracy**     | ≥92% (vs. RT verdicts)                       | —      |
| **Latency**             | <3s p99 (95% <2.5s)                          | —      |
| **Cost control**        | <$500/month trajectory                       | —      |
| **DICQ 4.7 compliance** | Training policy + versioning documented      | —      |
| **E2E tests**           | 5/5 flows PASS                               | —      |
| **Regressions**         | 738/738 baseline tests still PASS            | —      |
| **Cloud Logs**          | 0 errors, <5% warning rate (24h post-deploy) | —      |

**Phase 11 Deploy Date:** 2026-06-23

---

## 15. Handoff to Phase 12

**Phase 12 kickoff dependencies:**

1. ✅ Image collection baseline (500+ images)
2. ✅ v1.0 model accuracy established (≥92%)
3. ✅ Dashboard live + operators trained on UI
4. ✅ Cost tracking validated
5. ✅ DICQ 4.7 baseline compliance documented

**Phase 12 scope:** IA feedback loop + model versioning + A/B testing framework.

---

## Appendix A: Sample Image Metadata (JSONL Log)

```jsonl
{"captureId":"img_20260609_001","labId":"lab_riopomba","testType":"igg","classification":"R","confidence":0.94,"rtVerdict":"R","agreedWithGemini":true,"geminiLatencyMs":1850,"promptVariant":"v1","tokens":{"input":350,"output":82},"classifiedAt":"2026-06-09T14:32:15Z"}
{"captureId":"img_20260609_002","labId":"lab_riopomba","testType":"igg","classification":"NR","confidence":0.67,"rtVerdict":"R","agreedWithGemini":false,"geminiLatencyMs":2140,"promptVariant":"v2","tokens":{"input":352,"output":85},"flaggedForManualReview":true,"classifiedAt":"2026-06-09T14:35:22Z"}
{"captureId":"img_20260609_003","labId":"lab_riopomba","testType":"igm","classification":"R","confidence":0.88,"rtVerdict":"R","agreedWithGemini":true,"geminiLatencyMs":1920,"promptVariant":"v3","tokens":{"input":348,"output":79},"classifiedAt":"2026-06-09T14:38:11Z"}
```

---

## Appendix B: Firestore Indexes (firestore.indexes.json snippet)

```json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "classifiedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "events",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "testType", "order": "ASCENDING" },
        { "fieldPath": "classifiedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "events",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "flaggedForManualReview", "order": "ASCENDING" },
        { "fieldPath": "classifiedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "daily",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "dateKey", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Appendix C: Prompt Engineering Baseline (Portuguese)

### Prompt v1 — Clinical Detail (Baseline)

```
Você está analisando a imagem de um strip de imunoensaio para detecção sorológica.
O teste pode ser IgG (Rubéola, Toxoplasma, Sífilis) ou IgM (Dengue, Zika).

INSTRUÇÕES DE LEITURA:
1. Procure por duas linhas:
   - Linha C (Controle): deve estar sempre presente (válida o teste)
   - Linha T (Teste): presença indica resultado REATIVO

2. Critério de classificação:
   - REATIVO (R): Se houver linha clara TANTO em C quanto em T
   - NÃO-REATIVO (NR): Se houver linha em C mas AUSÊNCIA de linha em T
   - INCONCLUSO: Se a imagem estiver borrada, sem contraste adequado, ou com reação ambígua

3. Qualidade da imagem:
   - BOA: linhas nítidas, boa iluminação, sem reflexos
   - ACEITÁVEL: linhas visíveis mas ligeiramente desbotadas
   - POBRE: linhas muito fracas ou banda difusa

RESPONDA APENAS COM JSON VÁLIDO no seguinte formato:
{
  "classification": "R",
  "confidence": 0.92,
  "reasoning": "Linha T clara e bem definida em comparação com linha C. Excelente iluminação."
}

Onde:
- classification: "R" (reativo), "NR" (não-reativo), ou "INCONCLUSIVE"
- confidence: número entre 0.0 e 1.0 representando sua certeza
- reasoning: explicação breve (máx 200 caracteres) do porquê da classificação
```

### Prompt v2 — Terse Checklist (Speed-optimized)

```
Strip imunoensaio: IgG/IgM. Classifique:

☐ Linha C present? NO → INCONCLUSIVE
☐ Linha C + T visible? YES → R (REATIVO)
☐ Linha C only? YES → NR (NÃO-REATIVO)
☐ Ambiguous? → INCONCLUSIVE

Image quality: GOOD/OK/POOR?

JSON: { "classification": "R|NR|INCONCLUSIVE", "confidence": 0–1, "reasoning": "..." }
```

### Prompt v3 — Visual Instructions (English, ML generalization)

```
Immunoassay strip classification (IgG/IgM serology).

Visual cues:
- Control line (C): red band, left side — always expected
- Test line (T): red band, right side — presence = positive

Output:
- REACTIVE (R): Both C and T lines visible, good contrast
- NON-REACTIVE (NR): Only C line visible
- INCONCLUSIVE: Faint lines, blurring, or mixed signal

Confidence: high (0.85–1.0) = crisp lines, good lighting
Confidence: low (<0.75) = faint, smudged, or ambiguous

JSON: { "classification": "R|NR|INCONCLUSIVE", "confidence": 0–1, "reasoning": "..." }
```

---

**Document prepared for Phase 11 execution.**  
**Target deploy: 2026-06-23**  
**Last updated: 2026-05-07**
