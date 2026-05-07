# Phase 11 Execution Status — IA Foundation / Gemini Vision OCR

**Date**: 2026-05-07  
**Status**: Ready for Execution  
**Target Deploy**: 2026-06-23 (2 weeks from kickoff 2026-06-09)  
**Scope**: Gemini Vision callable, dataset collection infrastructure, confidence thresholding, metrics dashboard

---

## Executive Summary

Phase 11 establishes **AI-powered rapid diagnostic test (RDT) classification** using Gemini 2.5 Flash. Deliverables:
- ✅ Gemini Vision callable with 3 prompt variants (A/B testing)
- ✅ 500+ training images collected across 5 test kits
- ✅ Confidence threshold validation (0.85 default, manual override)
- ✅ IA metrics dashboard (accuracy, sensitivity, specificity)
- ✅ Firestore schema + Cloud Functions (6 callables)
- ✅ E2E tests (5 critical flows)

**Success Criteria:**
- Gemini accuracy ≥85% on validation set
- Dataset collection: 50+ images/day → 500+ by phase end
- Latency: <3s p99 (95% <2.5s)
- DICQ 4.7 compliance documented
- 738/738 baseline tests still passing

---

## Current State

### Completed (Phase 0–3, v1.3)
- **20 modules in production** (analyzer, coagulacao, ciq-imuno, uroanalise, etc.)
- **ia-strip module scaffold** exists with placeholder implementations
- **Gemini API key provisioned** (environment ready)
- **Firebase Storage buckets** configured (gs://hmatologia2.appspot.com/)
- **CIQ infrastructure** stable (347/347 tests passing from v1.3)

### In Progress (Phase 11 kickoff needed)
- **Gemini Vision callable** — needs full implementation
- **UI components** — camera capture, manual review modal, image preview
- **Dataset collection pipeline** — metadata schema, auto-ingestion, versioning
- **Firestore schema** — 4 new collections (events, config, cost, metadata)
- **IA metrics dashboard** — accuracy/sensitivity/specificity tracking
- **Prompt engineering** — 3 variants (v1 Portuguese detail, v2 terse, v3 English)

---

## Task Breakdown (2-week timeline)

### Week 1: Infrastructure & Gemini Integration

#### 1.1 Gemini Vision Callable (`classifyStripGemini`)
**File**: `functions/src/modules/ia-strip/callables/classifyStripGemini.ts`

**Spec**:
- Input: `{ base64: string, mimeType, testType, labId, captureId, operatorId, promptVariant? }`
- Output: `{ classification: 'R'|'NR'|'INCONCLUSIVE', confidence: 0–1, reasoning, flaggedForManualReview, recommendedAction, signature }`
- Gemini model: `gemini-2.5-flash`
- Temperature: 0.0 (deterministic)
- Latency target: <3s p99
- Error handling: JSON parse failures → return INVALID with confidence=0

**Dependencies**:
- `@google/generative-ai` (already in package.json)
- `firebase-admin` (sign payload + write audit log)
- Helper: `generateChainHash()` (from shared/signature)
- Lab membership check via `labs/{labId}/members/{operatorId}`

**A/B Test Variants** (prompts hardcoded, variant allocation 33/33/33):

| Variant | Language | Style | Expected accuracy |
|---------|----------|-------|-------------------|
| v1 | Portuguese | Clinical detail + decision rules | 86–88% |
| v2 | Portuguese | Terse checklist (faster) | 84–86% |
| v3 | English | Visual cues (international) | 82–85% |

**Implementation Priority**: HIGH — blocks all downstream components

---

#### 1.2 Firestore Schema (4 collections + indexes)

**Collection 1: `imuno-ia-dev/{labId}/events/{captureId}` (Append-only audit log)**
```typescript
{
  captureId: string;                    // UUID
  testType: 'hiv'|'dengue'|'syphilis'|'covid'|'hcg';
  classification: 'R'|'NR'|'INCONCLUSIVE';
  confidence: 0.0–1.0;
  reasoning: string;                    // 50–200 chars
  geminiModel: 'gemini-2.5-flash';
  promptVariant: 'v1'|'v2'|'v3';
  geminiLatencyMs: number;
  tokensUsed: { input, output };
  
  flaggedForManualReview: boolean;      // confidence < 0.85
  rtVerdict?: 'R'|'NR'|'INCONCLUSIVE';
  rtVerdictAt?: Timestamp;
  rtOperatorId?: string;
  rtNotes?: string;
  
  signature: { hash: string, operatorId, ts };
  operatorId: string;
  labId: string;
  classifiedAt: Timestamp;
  agreedWithGemini: boolean;
  
  createdAt: Timestamp;
  deletedAt?: Timestamp;  // Soft-delete only
}
```

**Collection 2: `imuno-ia-dev/{labId}/config` (Lab settings)**
```typescript
{
  labId: string;
  confidenceThreshold: number;           // 0.85 default
  minImagesBeforeModelUpdate: number;    // 100
  dailyCollectionTarget: number;        // 50
  maxImagesPerDay: number;              // 200 (soft limit)
  promptVariantAllocation: { v1, v2, v3 };  // % allocation
  recordGeolocation: boolean;
  retentionDays: number;               // 365 default
  alertEmail: string[];
  alertOnAccuracyDrop: number;         // 0.80
  updatedAt: Timestamp;
  updatedBy: string;
}
```

**Collection 3: `imuno-ia-cost/{labId}/daily/{dateKey}` (Cost tracking)**
```typescript
{
  labId: string;
  dateKey: string;                    // YYYY-MM-DD
  callCount: number;
  estimatedCost: number;              // USD (Gemini pricing)
  tokensUsed: { input, output };
  lastUpdated: Timestamp;
}
```

**Indexes**:
```json
{
  "indexes": [
    { "fields": [["labId", "ASC"], ["classifiedAt", "DESC"]] },
    { "fields": [["labId", "ASC"], ["testType", "ASC"], ["classifiedAt", "DESC"]] },
    { "fields": [["labId", "ASC"], ["flaggedForManualReview", "ASC"], ["classifiedAt", "DESC"]] },
    { "fields": [["labId", "ASC"], ["promptVariant", "ASC"], ["classifiedAt", "DESC"]] },
    { "fields": [["labId", "ASC"], ["dateKey", "DESC"]] }
  ]
}
```

**Firestore Rules**:
```
match /imuno-ia-dev/{labId} {
  match /config {
    allow read: if isActiveMemberOfLab(labId);
    allow write: if isAdminOfLab(labId);
  }
  match /events/{captureId} {
    allow read: if isActiveMemberOfLab(labId);
    allow create: if isActiveMemberOfLab(labId)
                     && request.resource.data.labId == labId
                     && validSignature(request.resource.data.signature);
    allow update, delete: if false;  // Immutable
  }
}
match /imuno-ia-cost/{labId} {
  match /daily/{dateKey} {
    allow read: if isAdminOfLab(labId);
    allow write: if request.auth.uid == cloudFunctionServiceUid();
  }
}
```

**Implementation Priority**: HIGH — schema must exist before callables write

---

#### 1.3 UI Components (Camera Capture + Manual Review)

**Component 1: `StripCameraCapture.tsx`**
- Live camera feed with focus guides
- Tap to capture or 3-second countdown
- Real-time size validation (640×480 min, 1080p max)
- Fallback to file input
- Mobile responsive (iOS Safari + Android Chrome)

**Component 2: `StripIAUploadForm.tsx`**
- Camera feed or image preview
- Test type selector (dropdown)
- Operator notes (256 char textarea)
- Confidence threshold override (advanced toggle, default 0.85)
- Submission button + retry logic

**Component 3: `StripManualReviewModal.tsx`**
- Show Gemini result + confidence %
- Display image (full resolution, zoomable)
- RT decision buttons: "Confirm (R)" | "Confirm (NR)" | "Mark Inconclusive"
- Digital signature capture
- Audit trail logging

**Implementation Priority**: MEDIUM — needed for collection phase, not blocking callable

---

### Week 2: Dashboard, Testing, & Documentation

#### 2.1 IA Metrics Dashboard (`IAPerformanceDashboard.tsx`)

**5 tabs**:
1. **Overview**: accuracy %, image count, avg confidence, top variant, Gemini API cost trend
2. **Confusion Matrix**: TP/TN/FP/FN counts + sensitivity/specificity/PPV/NPV
3. **Confidence Distribution**: histogram of confidence buckets, % flagged for review, RT agreement by bucket
4. **Trend Analysis**: weekly accuracy + API cost line chart, filters (test type, variant, operator)
5. **Cost Tracking**: monthly spend, cost per classification, projected monthly cost, alert if >$500

**Queries** (firestore):
- Accuracy: `count(agreed) / count(total)`
- Sensitivity: `count(TP) / (TP + FN)`
- Specificity: `count(TN) / (TN + FP)`
- Confidence bucketing: group by confidence ranges (0.0–0.1, 0.1–0.2, ..., 0.9–1.0)

**Implementation Priority**: MEDIUM — supports validation, not blocking callable

---

#### 2.2 E2E Tests (5 critical flows)

**Flow 1**: Camera capture → Gemini classify → confidence ≥0.85 → auto-save
**Flow 2**: File upload → confidence <0.85 → manual review modal → RT override → signature
**Flow 3**: Prompt variant A/B test collection (33% v1, v2, v3 each)
**Flow 4**: Dashboard confusion matrix + accuracy % display
**Flow 5**: Cost tracking alert when >$500/month

**Implementation Priority**: MEDIUM — validation + DICQ compliance

---

#### 2.3 Documentation & DICQ Mapping

**DICQ 4.7 Compliance Docs**:
1. `PHASE_11_IA_TRAINING_POLICY.md` — dataset selection, diversity, retention
2. `PHASE_11_IA_MODEL_VERSIONING.md` — baseline v1.0, A/B test procedure, rollback
3. `PHASE_11_IA_PERFORMANCE_MONITORING.md` — accuracy tracking, alerts, audits
4. `PHASE_11_GEMINI_PROMPT_ENGINEERING.md` — already exists, use as reference

**Implementation Priority**: HIGH — regulatory requirement

---

## Critical Path Dependencies

```
Day 1–3:
├─ Gemini callable (classifyStripGemini) → base implementation
├─ Firestore schema (4 collections) → rules + indexes deployed
└─ Lab config doc initialized (via callable or admin setup)

Day 4–7:
├─ UI components (camera, upload form, manual review) → ready for testing
├─ Dashboard skeleton (queries working)
└─ First 50 images collected (manual test data seed)

Day 8–14:
├─ A/B test variants live (33/33/33 allocation)
├─ Daily collection running (target 50+/day)
├─ Accuracy metrics calculated (vs RT verdicts)
├─ E2E tests written + passing
└─ Deploy to staging for 1-week validation
```

---

## Pre-Deployment Gate

**Before any deploy to prod** (Week 2, Day 14):

1. ✅ Type-check: `npx tsc --noEmit`
2. ✅ Lint: `npm run lint` (baseline 88 pre-existing warnings acceptable)
3. ✅ Unit tests: `npm test` (738/738 baseline + new tests for Phase 11)
4. ✅ Build: `npm run build` (web + functions both compile)
5. ✅ Secret-status: `bash scripts/preflight-secrets-check.sh` (GEMINI_API_KEY must be SET)
6. ✅ Deploy rules: `firebase deploy --only firestore:rules,firestore:indexes`
7. ✅ Deploy functions: `firebase deploy --only functions` (ia-strip module)
8. ✅ Deploy hosting: `firebase deploy --only hosting` (UI changes)
9. ✅ Cloud Logs monitor: `bash scripts/monitor-cloud-logs.sh 24 30` (24h validation, 30s interval)

---

## Cost Estimate (Gemini API)

**Budget**: ~$500/month (hard cap)

**Calculation**:
- Gemini 2.5 Flash: ~$1.25 per 1M input tokens + ~$5 per 1M output tokens
- Avg classification: 350 input tokens + 80 output tokens ≈ $0.00058 per call
- Phase 11 collection: 50 images/day × 30 days = 1,500 calls ≈ $0.87/month (well below budget)

**Monitoring**: Gemini cost tracked real-time in dashboard; alert if monthly trajectory exceeds $500

---

## Risk Register (High-Priority)

| Risk | Mitigation |
|------|-----------|
| **Gemini accuracy <85%** | A/B test 3 prompt variants; choose best; Phase 12 improvements |
| **API cost overrun** | Daily tracking + $500/month alert; soft-limit 200 images/day |
| **Confidence miscalibration** | Validate threshold with 500-image dataset; confidence vs accuracy curve |
| **Privacy breach (patient PII)** | No PII in metadata; geolocation optional; 12-month retention max; audit trail immutable |
| **Gemini API timeout** | Fallback to manual review if >3s; alert ops team; non-blocking |

---

## Phase 11 Exit Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Gemini callable deployed + tested | 6 callables live | ❌ To do |
| 500+ training images collected | Images with metadata + ground truth | ❌ To do |
| Confidence threshold validated | 0.85 default, manual override working | ❌ To do |
| Fallback logic confirmed | Auto-save ≥0.85, manual review <0.85 | ❌ To do |
| Accuracy metrics dashboard deployed | 5 tabs live, queries working | ❌ To do |
| DICQ 4.7 compliance documented | Training policy + versioning + monitoring | ❌ To do |
| E2E tests pass | 5/5 flows PASS | ❌ To do |
| Baseline tests still pass | 738/738 | ✅ Confirmed |
| Cloud Logs validation | 24h post-deploy, 0 errors | ❌ To do |

**Phase 11 Deploy Date**: 2026-06-23

---

## Next Steps (Immediate)

1. **Kickoff meeting** (2026-06-09): confirm team capacity, assign tasks
2. **Gemini callable code review** (Day 2–3): core implementation, response parsing
3. **Firestore schema deploy** (Day 3): rules + indexes, data validation
4. **UI component sprint** (Day 4–7): camera, upload, manual review
5. **Dataset collection kick-off** (Day 8): first 50+ images
6. **A/B testing** (Day 8–14): variant allocation, metric tracking
7. **Deploy prep** (Day 14): gate validation, Cloud Logs monitor
8. **Handoff to Phase 12** (Day 14 PM): dataset frozen, v1.0 baseline ready

---

**Prepared by**: Claude (AI Assistant)  
**For execution**: Engineering team (2026-06-09 kickoff)  
**Stakeholders**: RT team (data collection), Lab ops (infrastructure), Audit (DICQ 4.7)
