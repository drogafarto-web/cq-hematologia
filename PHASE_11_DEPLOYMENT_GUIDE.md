# Phase 11 Deployment Guide — Ready for 2026-06-23

**Status**: Implementation code delivered, ready for team execution  
**Components**: Gemini Vision callable + types + execution roadmap  
**Deploy date**: 2026-06-23 (Monday, 2-week sprint from kickoff 2026-06-09)

---

## Delivered Artifacts

### 1. Gemini Vision Callable ✅

**File**: `functions/src/modules/ia-strip/callables/classifyStripGemini.ts`

**What it does**:

- Accepts base64-encoded RDT image (JPEG/PNG/WebP)
- Sends to Gemini 2.5 Flash with clinical prompts (Portuguese/English)
- Parses response JSON (handles markdown code blocks + raw JSON)
- Validates classification: R|NR|INCONCLUSIVE
- Applies confidence threshold: 0.85 default (configurable per lab)
- Returns: classification + confidence + recommended action (AUTO_SAVE|MANUAL_REVIEW)
- Logs audit trail → `imuno-ia-dev/{labId}/events/{captureId}`
- Tracks cost → `imuno-ia-cost/{labId}/daily/{dateKey}`
- Generates signature for compliance (DICQ 4.7, RDC 978 Art. 204)

**Latency target**: <3s p99 (95% <2.5s)  
**Cost estimate**: ~$0.87/month for 50 images/day collection

### 2. Types & Interfaces ✅

**File**: `functions/src/modules/ia-strip/types.ts`

**Defines**:

- `ClassifyStripPayload` — input shape
- `GeminiClassificationResult` — Gemini response
- `ClassifyStripResult` — final result with threshold logic
- `IAEventLog` — audit trail schema
- `IALabConfig` — lab settings (threshold, variant allocation)
- `IACostDaily` — cost tracking schema
- `TestType` — supported kits (hiv|dengue|syphilis|covid|hcg)
- `Classification` — R|NR|INCONCLUSIVE

### 3. Execution Plan ✅

**File**: `PHASE_11_EXECUTION_STATUS.md`

Comprehensive 2-week roadmap:

- Week 1: Infrastructure + Gemini callable
- Week 2: UI components + dashboard + testing
- Daily deployment gates (typecheck, lint, tests, secrets)
- Risk mitigation strategies
- Exit criteria checklist

### 4. Implementation Checklist ✅

**File**: `PHASE_11_IMPLEMENTATION_CHECKLIST.md`

Day-by-day task breakdown:

- Day 1–3: Callable + schema + UI start
- Day 4–7: Components + tests
- Day 8–12: Dashboard + E2E tests + collection
- Day 13–14: Deploy prep + pre-flight gates

---

## Next Steps (Immediate Handoff)

### Step 1: Kickoff Meeting (2026-06-09, 10am BRT)

**Attendees**: Engineering team + RT team + Lab ops + Audit

**Agenda**:

1. Review Phase 11 scope (30 min)
   - Read: `PHASE_11_EXECUTION_STATUS.md`
   - Watch: Gemini capabilities demo
   - Q&A on prompt engineering variants

2. Confirm capacity (15 min)
   - Assign: Callable reviewer (code review)
   - Assign: UI component developers (camera, modal, dashboard)
   - Assign: QA / E2E testing
   - Assign: Dataset collection lead (RT team)

3. Setup check (15 min)
   - GEMINI_API_KEY provisioned? (Action: `firebase functions:secrets:set`)
   - Firebase Storage bucket ready? (Action: verify permissions)
   - Firestore emulator working? (Action: `npm run emulator`)

4. Day 1 tasks clarified (10 min)

---

### Step 2: Implement Core Callable (Day 1–3)

**Task 1: Export callable in functions/src/index.ts**

Add to exports:

```typescript
export { classifyStripGemini } from './modules/ia-strip/callables/classifyStripGemini';
```

**Task 2: Create Firestore indexes (firestore.indexes.json)**

Add these 5 composite indexes:

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
      "collectionGroup": "events",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "promptVariant", "order": "ASCENDING" },
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

Deploy: `firebase deploy --only firestore:indexes`

**Task 3: Add Firestore rules (firestore.rules)**

Add these rules to the `firestore.rules` file:

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
    allow write: if request.auth.token.claims.role == 'system'
                    || request.auth.uid == getCloudFunctionServiceUid();
  }
}
```

Deploy: `firebase deploy --only firestore:rules`

**Task 4: Code review + merge**

- Run tests: `npm test` (should pass 738/738 baseline)
- Type-check: `npx tsc --noEmit`
- Build: `npm run build`
- Merge to main

---

### Step 3: Build UI Components (Day 4–7)

Complete these components (order not strict):

1. **StripCameraCapture.tsx** — camera feed + capture
2. **StripIAUploadForm.tsx** — form with metadata
3. **StripManualReviewModal.tsx** — manual override UI
4. **useStripIAClassification.ts** — hook to call callable

Reference implementations in `PHASE_11_DETAILED_PLAN.md` (sections 1–3).

Each component:

- WCAG AA compliant (dark-first design, contrast 4.5:1)
- Mobile responsive (iOS Safari + Android Chrome)
- Error handling (network, validation, API timeouts)
- Unit + E2E tests

---

### Step 4: Collection Kick-off (Day 8)

**RT Team**:

1. Receive training: `CLASSIFICATION_GUIDE.md`
   - Manual classification categories (R, NR, INCONCLUSIVE, borderline, unclear)
   - Confidence sliders (0.0–1.0)
   - Practice 10 images with feedback

2. Start daily collection:
   - Open imuno module
   - Click "Capturar Strip" (camera) or "Upload Arquivo" (file)
   - Verify test type + device/lighting metadata
   - Submit
   - If Gemini confidence <0.85: manual review modal appears → RT classifies + signs
   - If confidence ≥0.85: auto-saved (no review)

3. Track daily quota:
   - Target: 50 images/day
   - Dashboard updates real-time
   - Alert if <25 images (missed target)

**Engineering**:

- Monitor Cloud Logs for errors
- Track variant allocation (v1/v2/v3 roughly 33/33/33)
- Calculate daily accuracy (Gemini vs RT verdicts)

---

### Step 5: Dashboard & E2E Tests (Day 8–12)

Build `IAPerformanceDashboard.tsx` with 5 tabs:

1. **Overview**
   - Accuracy % (vs RT verdicts)
   - Total images processed
   - Avg confidence by test type
   - Top prompt variant
   - API cost trend (weekly)

2. **Confusion Matrix**
   - TP/TN/FP/FN counts
   - Sensitivity, specificity, PPV, NPV

3. **Confidence Distribution**
   - Histogram (confidence buckets)
   - % flagged for manual review
   - Agreement % by bucket

4. **Trend Analysis**
   - Weekly accuracy + cost line chart
   - Filters: test type, variant, operator

5. **Cost Tracking**
   - Monthly spend
   - Cost per classification
   - Projected monthly (alert if >$500)

E2E test specs (5 critical flows):

- Flow 1: Camera → Gemini → confidence ≥0.85 → auto-save
- Flow 2: File → confidence <0.85 → manual review → signature
- Flow 3: A/B variant allocation (verify 33/33/33)
- Flow 4: Dashboard confusion matrix
- Flow 5: Cost alert (>$500)

---

### Step 6: Deploy to Staging (Day 13)

**Pre-flight gate**:

```bash
npx tsc --noEmit                 # TypeScript OK?
npm run lint                     # Baseline 88 warnings
npm test                         # 738/738 + new tests pass?
npm run build                    # Build OK?
bash scripts/preflight-secrets-check.sh  # GEMINI_API_KEY SET?
```

**If all green**:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2
```

**Post-deploy validation** (24 hours):

```bash
bash scripts/monitor-cloud-logs.sh 24 30
# Expected: 0 errors, <5% warning rate
```

---

### Step 7: Production Deploy (Monday 2026-06-23)

**Go/No-go decision**:

- Accuracy ≥85% on 300+ images? ✅ Go
- No data loss or corruption? ✅ Go
- Cloud Logs clean (0 errors, <5% warnings)? ✅ Go
- Operator feedback positive? ✅ Go

**Deploy to prod**:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2
```

**Immediate post-deploy**:

- Hard reload browser (Ctrl+Shift+R)
- Manual camera test (capture image → verify Gemini classification)
- Verify dashboard is live (real-time accuracy updating)
- Alert RT team: Phase 11 live ✅

---

## Fallback & Rollback Procedures

### If Gemini accuracy <85% on any variant:

1. **Immediate**: Switch manual review threshold to 0.80 (accept more review)
2. **24h**: All 3 variants running, track accuracy per variant
3. **Day 2**: Select best variant by sensitivity (recall), retire worst
4. **Day 3**: Adjust prompt based on top 20 misclassifications

### If API costs exceed $500/month trajectory:

1. **Immediate**: Pause collection for 24h
2. **24h**: Reduce daily target from 50 → 25 images/day
3. **Day 2**: Optimize prompt (shorter, reuse cached context)
4. **Day 3**: Resume at 25 images/day until cost stabilizes

### If confidence threshold miscalibrated:

1. **Immediate**: Plot confidence vs accuracy curve (all data to date)
2. **24h**: Calculate ideal threshold (where accuracy inflects)
3. **Day 2**: Update lab config `confidenceThreshold` to new value
4. **Day 3**: Monitor accuracy + manual review load

### If Gemini API timeout (>3s):

1. **Immediate**: Fallback to manual review (no auto-save)
2. **24h**: Check Gemini quota (contact Google support if exhausted)
3. **Day 2**: Optimize payload (smaller image, shorter prompt)
4. **Day 3**: Resume with optimized payload

---

## Monitoring & Alerting (Post-Deploy)

### Daily standup (10am BRT)

- Images collected yesterday?
- Accuracy % (vs RT verdicts)?
- API errors or timeouts?
- Cost on track?

### Weekly metrics review (Friday 4pm)

- Accuracy per test type (HIV/Dengue/Syphilis/COVID/HCG)
- Accuracy per variant (v1/v2/v3)
- Confidence distribution (histogram)
- Operator feedback from manual reviews

### Monthly handoff (End of June)

- Dataset export (500+ images, metadata.csv)
- Gemini baseline report (per-kit accuracy/sensitivity/specificity)
- Error analysis (top 20 misclassifications)
- Recommendation: Phase 12 improvements

---

## Phase 11 Exit Criteria (Final Checklist)

### Code Quality ✅

- [ ] All 3 callables merged + deployed
- [ ] 8–12 unit tests passing for Gemini callable
- [ ] 5 E2E tests for critical flows PASS
- [ ] TypeScript: `npx tsc --noEmit` (0 errors)
- [ ] Lint: `npm run lint` (baseline 88 warnings)
- [ ] Build: `npm run build` (no regressions)
- [ ] Tests: `npm test` (738/738 baseline still PASS)

### Functionality ✅

- [ ] Callable deployed + handles all 5 test kits
- [ ] 3 prompt variants (v1/v2/v3) running, allocation 33/33/33
- [ ] Confidence threshold (0.85) working
- [ ] Manual review modal live (for confidence <0.85)
- [ ] Dashboard live (5 tabs, real-time metrics)

### Dataset ✅

- [ ] 300+ images collected (target 500 by end of phase, may land at 300)
- [ ] Metadata complete (test type, device, lighting, manual classification)
- [ ] Diversity: ≥3 devices, ≥3 lighting conditions, balanced result distribution
- [ ] Ground truth: RT classifications logged + timestamped

### Accuracy ✅

- [ ] Gemini accuracy ≥85% vs RT verdicts
- [ ] No variant significantly worse than others
- [ ] Confidence distribution plotted (modal 0.70–0.95)
- [ ] Confidence vs accuracy curve shows inflection at ~0.85

### Compliance ✅

- [ ] DICQ 4.7 training dataset policy documented
- [ ] DICQ 4.7 model versioning procedure documented
- [ ] DICQ 4.7 performance monitoring live (dashboard)
- [ ] RDC 978 Art. 204 audit trail immutable (Firestore rules enforce)
- [ ] Signature validation passing (hash size = 64 chars)

### Cost ✅

- [ ] Gemini API cost tracking live
- [ ] Monthly trajectory <$500 (expected ~$0.87 for Phase 11 collection)
- [ ] Cost per classification: ~$0.0006 (acceptable)
- [ ] Alert system ready (will fire if >$500)

### Operations ✅

- [ ] Cloud Logs clean (24h post-deploy: 0 errors, <5% warnings)
- [ ] Firestore indexes deployed
- [ ] Firestore rules deployed
- [ ] Lab config document initialized (threshold, retention, etc.)

### Handoff to Phase 12 ✅

- [ ] Dataset frozen (v1.1.0 export ready)
- [ ] Gemini baseline established (baseline v1.0)
- [ ] Error analysis documented (top 20 misclassifications)
- [ ] Phase 12 improvement roadmap prepared

---

## Support & Escalation

**Issues during Phase 11**:

| Problem                               | Owner            | Escalation                         |
| ------------------------------------- | ---------------- | ---------------------------------- |
| Gemini API errors (quota/rate limit)  | Engineering      | CTO (need Google support ticket)   |
| Firestore write failures (rules deny) | Engineering      | Audit compliance review            |
| Accuracy <85% on variant              | Engineering + RT | CTO (re-evaluate prompt strategy)  |
| PII leak detected in images           | Security + Audit | CTO + Legal (LGPD breach protocol) |
| Dataset collection lagging            | RT team lead     | Lab ops (resource allocation)      |

**Contact**:

- Engineering lead: [assigned]
- RT team lead: [assigned]
- CTO: [assigned]
- On-call rotation: 24h coverage during Phase 11 (2026-06-09 to 2026-06-23)

---

## Reference Documents

Read in this order:

1. `PHASE_11_EXECUTION_STATUS.md` — overview + critical path
2. `PHASE_11_IMPLEMENTATION_CHECKLIST.md` — day-by-day tasks
3. `PHASE_11_GEMINI_PROMPT_ENGINEERING.md` — prompt variants + accuracy targets
4. `PHASE_11_IA_DATASET_STRATEGY.md` — collection, metadata, privacy
5. `PHASE_11_DETAILED_PLAN.md` — UI components, E2E tests, DICQ mapping
6. `docs/CLASSIFICATION_GUIDE.md` (create) — RT training for manual classification
7. `docs/PHASE_11_IA_TRAINING_POLICY.md` (create) — DICQ 4.7 training dataset policy
8. `docs/PHASE_11_IA_MODEL_VERSIONING.md` (create) — DICQ 4.7 model versioning

---

**Phase 11 is ready for execution.**  
**Kickoff: 2026-06-09 10am BRT**  
**Target deploy: 2026-06-23**  
**Handoff to Phase 12: 2026-06-23 PM**
