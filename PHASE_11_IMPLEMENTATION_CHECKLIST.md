# Phase 11 Implementation Checklist — Daily Progress Tracker

**Phase kickoff**: 2026-06-09  
**Target deploy**: 2026-06-23 (14 days)  
**Update frequency**: Daily standup (10am BRT)

---

## WEEK 1: Infrastructure & Gemini Integration

### Day 1 (Monday 2026-06-09): Kickoff & Gemini Callable Start

**Gemini Callable (`classifyStripGemini`) — 40% of Phase 11 scope**

- [ ] **Code**: `functions/src/modules/ia-strip/callables/classifyStripGemini.ts` (250–300 LOC)
  - Input validation (labId, captureId, operatorId, base64, testType)
  - Lab membership check via Admin SDK
  - Gemini Vision API call (model: `gemini-2.5-flash`, temperature=0.0)
  - Prompt building logic (select variant v1/v2/v3)
  - Response parsing (JSON extraction from markdown)
  - Confidence threshold logic (0.85 default)
  - Signature generation (`generateChainHash`)
  - Non-blocking audit log write to `imuno-ia-dev/{labId}/events/{captureId}`
  - Cost tracking write to `imuno-ia-cost/{labId}/daily/{dateKey}`

- [ ] **Types**: `functions/src/modules/ia-strip/types/GeminiClassification.ts`
  - `ClassifyStripPayload`
  - `GeminiClassificationResult`
  - `ClassifyStripResult`

- [ ] **Prompts**: `functions/src/modules/ia-strip/prompts/index.ts`
  - v1: Portuguese, clinical detail (baseline)
  - v2: Portuguese, terse checklist
  - v3: English, visual cues (international)
  - Prompt selection logic (random 33/33/33 or configurable allocation)

- [ ] **Export in `functions/src/index.ts`**: Add to module exports

- [ ] **Test**: `functions/src/modules/ia-strip/__tests__/classifyStripGemini.unit.test.ts`
  - Valid image classification (mock Gemini)
  - Confidence threshold (≥0.85 → AUTO_SAVE, <0.85 → MANUAL_REVIEW)
  - Error handling (invalid payload, Gemini API failure, JSON parse failure)
  - Signature validation (hash size = 64 chars)
  - Lab membership check (deny non-member)
  - Variant allocation (confirm v1/v2/v3 random selection)

**Firestore Schema Deployment**

- [ ] **Firestore indexes**: `firebase.json` / `firestore.indexes.json`
  - 5 composite indexes added (see PHASE_11_EXECUTION_STATUS.md)
  - Deploy: `firebase deploy --only firestore:indexes`

- [ ] **Firestore rules**: `firestore.rules`
  - `imuno-ia-dev/{labId}` collection rules
  - `imuno-ia-cost/{labId}` collection rules
  - Append-only events (no update/delete)
  - Deploy: `firebase deploy --only firestore:rules`

- [ ] **Lab config initialization**: Callable `initializeIALabConfig` (optional)
  - Or: Manual admin setup in Firebase Console
  - Default values: threshold=0.85, dailyTarget=50, retention=365

**Env Setup**

- [ ] **GEMINI_API_KEY**: Confirm provisioned
  - Command: `firebase functions:secrets:set GEMINI_API_KEY --project hmatologia2`
  - Verify: `bash scripts/preflight-secrets-check.sh` → GREEN
  - If PENDING_SET: provision immediately (blocking all functions)

- [ ] **Firebase Storage bucket**: Confirm write access
  - Bucket: `hmatologia2.appspot.com`
  - Path pattern: `imuno-ia-dev/{labId}/{year}/{month}/{captureId}*`

---

### Day 2–3 (Tuesday–Wednesday 2026-06-10/11): Code Review & Testing

- [ ] **PR code review**: Gemini callable
  - Signature validation logic correct?
  - Error messages clear (for operators)?
  - Latency tracking accurate?
  - Cost calculation correct (token estimate)?
  - Timeout handling (30s limit OK for image processing)?

- [ ] **Local emulator test**: `npm run emulator`
  - Mock Gemini response
  - Test 3 prompt variants
  - Test confidence threshold logic
  - Test signature generation

- [ ] **Unit tests pass**: `npm test` for ia-strip module
  - Baseline: 738/738 tests still PASS
  - New: 8–12 unit tests for classifyStripGemini

- [ ] **Build succeeds**: `npm run build` (web + functions)
  - No TypeScript errors
  - No bundle regressions

---

### Day 4–5 (Thursday–Friday 2026-06-12/13): UI Components Sprint Start

**Camera Capture Component (`StripCameraCapture.tsx`)**

- [ ] **Code**: `src/features/ciq-imuno/components/StripCameraCapture.tsx` (150–200 LOC)
  - Live camera feed (HTML5 `<video>` + Canvas)
  - Focus guides (visual rectangle overlay)
  - Tap to capture OR 3-second countdown auto-capture
  - Real-time size validation (640×480 min, 1080p max)
  - Fallback to file input (desktop, no camera)
  - Mobile responsive (iOS Safari + Android Chrome)
  - WCAG AA: `aria-label`, focus visible, keyboard nav

- [ ] **Test**: `src/__tests__/ciq-imuno/StripCameraCapture.e2e.spec.ts`
  - Camera permission granted → video plays
  - Tap capture → image preview shown
  - File input fallback works
  - Mobile responsiveness (simulate iPhone + Android)

**Upload Form Component (`StripIAUploadForm.tsx`)**

- [ ] **Code**: `src/features/ciq-imuno/components/StripIAUploadForm.tsx` (150–180 LOC)
  - Camera feed (from StripCameraCapture)
  - Test type selector (dropdown: hiv, dengue, syphilis, covid, hcg)
  - Operator notes (256 char textarea, optional)
  - Confidence threshold override (toggle, default 0.85)
  - Submit button + error handling
  - Retry logic on API failure
  - Loading state (spinner)

- [ ] **Validation**: Client-side before upload
  - File size <5MB
  - MIME type (JPEG/PNG/WebP)
  - Resolution 640×480 min
  - Image hash (SHA-256, for deduplication)

- [ ] **Test**: Form validation, submit flow, error handling

---

### Day 6–7 (Saturday–Sunday 2026-06-14/15): Buffer & Review

- [ ] **Team sync**: 15-min standup
  - Callable code merged to main?
  - Firestore schema deployed?
  - UI components code-complete?
  - Any blockers?

- [ ] **Pre-merge gate**: `hcq-deploy-gates` skill
  - Typecheck: `npx tsc --noEmit`
  - Lint: `npm run lint` (baseline 88 warnings)
  - Tests: `npm test`
  - Build: `npm run build`

- [ ] **PR merge**: All Week 1 code merged to main
  - Callable + tests
  - Firestore schema + rules + indexes
  - UI components + tests (if complete)

---

## WEEK 2: Dashboard, Testing, & Production Deploy

### Day 8 (Monday 2026-06-16): Manual Review Modal & Dashboard Start

**Manual Review Modal (`StripManualReviewModal.tsx`)**

- [ ] **Code**: `src/features/ciq-imuno/components/StripManualReviewModal.tsx` (120–150 LOC)
  - Display Gemini result (classification + confidence %)
  - Show original image (full resolution, zoomable)
  - RT decision buttons: "Confirm (R)" | "Confirm (NR)" | "Mark Inconclusive"
  - Optional comment field (256 char)
  - Digital signature capture (useCIQSignature hook)
  - Audit trail: timestamp + operatorId + decision logged

- [ ] **Hook**: `src/features/ciq-imuno/hooks/useStripIAClassification.ts`
  - Call `classifyStripGemini` callable
  - Handle response (classification + confidence)
  - Determine recommendedAction (AUTO_SAVE vs MANUAL_REVIEW)
  - Trigger manual review modal if confidence < threshold

**Dashboard Start (`IAPerformanceDashboard.tsx`)**

- [ ] **Code skeleton**: `src/features/ciq-imuno/components/IAPerformanceDashboard.tsx` (300–400 LOC)
  - Tab navigation (5 tabs)
  - Tab 1: Overview (accuracy %, count, avg confidence, cost)
  - Metrics queries (Firestore, real-time via hook)

- [ ] **Tests**: Confusion matrix queries, dashboard rendering

---

### Day 9–10 (Tuesday–Wednesday 2026-06-17/18): Dataset Collection Kick-off

**Collection Infra Live**

- [ ] **Lab 1 (Riopomba)** starts daily collection
  - Target: 50 images/day (10 per kit: HIV, Dengue, Syphilis, COVID, HCG)
  - Manual classification by RT (ground truth labels)
  - Metadata logged to `imuno-ia-dev/{labId}/events/`

- [ ] **Gemini baseline** run daily
  - All new images classified by callable
  - Confidence scores logged
  - Agreement % calculated

- [ ] **Dashboard live** (Tab 1 + 2 at minimum)
  - Real-time accuracy % vs RT verdicts
  - Confusion matrix counts
  - Variant allocation visible (v1/v2/v3 %)

**A/B Test Allocation**

- [ ] **Variant allocation logic** in callable
  - Random assignment to v1/v2/v3 (33/33/33 by default)
  - Logged in each event
  - Configurable per lab (via config doc)

- [ ] **First 150 images collected** (50/day × 3 days)
  - Diversity across test types
  - Multiple devices (iPhone, Android, microscope)
  - Multiple lighting conditions

---

### Day 11–12 (Thursday–Friday 2026-06-19/20): Dashboard Completion & E2E Tests

**Dashboard Complete**

- [ ] **Tabs 3–5 implemented**
  - Tab 3: Confidence distribution (histogram)
  - Tab 4: Trend analysis (weekly line chart)
  - Tab 5: Cost tracking + alerts

- [ ] **All queries working**
  - Real-time data from `imuno-ia-dev/{labId}/events/`
  - Metrics: sensitivity, specificity, PPV, NPV
  - Cost: total spend + daily average + projected monthly

- [ ] **E2E tests (5 flows)**
  - Flow 1: Camera → Gemini → confidence ≥0.85 → auto-save
  - Flow 2: File upload → confidence <0.85 → manual review → signature
  - Flow 3: A/B variant collection (verify 33/33/33 allocation)
  - Flow 4: Dashboard metrics display
  - Flow 5: Cost alert (mock >$500 trajectory)

- [ ] **Manual collection running** 
  - 50 images/day on track
  - Cumulative: ~300 images by end of day 12
  - Accuracy baseline: expect 80–88% (Gemini vs RT)

---

### Day 13–14 (Saturday–Sunday 2026-06-21/22): Final Tests & Deploy Prep

**Documentation & DICQ Mapping**

- [ ] **DICQ 4.7 compliance docs**
  - `PHASE_11_IA_TRAINING_POLICY.md` — dataset selection, retention, consent
  - `PHASE_11_IA_MODEL_VERSIONING.md` — baseline v1.0 procedure, rollback
  - `PHASE_11_IA_PERFORMANCE_MONITORING.md` — accuracy tracking, audits

- [ ] **Handoff docs**
  - Dataset inventory (500+ images target, may be ~300 at Day 14)
  - Gemini baseline accuracy report (per kit, per variant)
  - Error analysis (top 20 misclassifications, pattern analysis)

**Pre-Deploy Gate**

- [ ] ✅ Type-check: `npx tsc --noEmit` (0 errors)
- [ ] ✅ Lint: `npm run lint` (baseline 88 warnings)
- [ ] ✅ Tests: `npm test` (738/738 + new Phase 11 tests)
- [ ] ✅ Build: `npm run build` (web + functions both compile)
- [ ] ✅ Secrets: `bash scripts/preflight-secrets-check.sh` (GREEN)
- [ ] ✅ Cloud Logs: Prepare `bash scripts/monitor-cloud-logs.sh 24 30`

**Deploy Sequence** (Monday 2026-06-23)

1. ✅ Deploy Firestore rules + indexes: `firebase deploy --only firestore:rules,firestore:indexes`
2. ✅ Deploy functions (ia-strip module): `firebase deploy --only functions:classifyStripGemini`
3. ✅ Deploy hosting (UI): `firebase deploy --only hosting`
4. ✅ Monitor Cloud Logs: `bash scripts/monitor-cloud-logs.sh 24 30` (24h validation)
5. ✅ Smoke test: Manual camera capture → Gemini classification → dashboard update
6. ✅ Verify dataset collection working (new images auto-logged)

---

## Parallel Tracks (Cross-team)

**RT Team (Data Collection)**
- [ ] Training: manual classification guide (CLASSIFICATION_GUIDE.md)
- [ ] Device setup: camera + lighting standardization
- [ ] Daily collection: 50+ images/day, metadata complete
- [ ] Feedback: any issues with UI, classification difficulty noted

**Lab Ops (Infrastructure)**
- [ ] Gemini API quota: confirm 10M input tokens/month (sufficient for Phase 11)
- [ ] Cloud Storage: bucket permissions, CORS configured
- [ ] Firestore: backup enabled, replication to secondary region

**Audit/Compliance (DICQ Mapping)**
- [ ] Training dataset policy reviewed
- [ ] Model versioning procedure validated
- [ ] Performance monitoring audit trail complete

---

## Success Metrics (Phase 11 Exit)

| Metric | Target | Status |
|--------|--------|--------|
| **Gemini callable** | 6 callables deployed + tested | ❌ To do |
| **Dataset size** | 500+ images (or baseline 300+ ready) | ❌ To do |
| **Gemini accuracy** | ≥85% vs RT verdicts | ❌ To do |
| **Confidence threshold** | 0.85 default, manual override working | ❌ To do |
| **Latency** | <3s p99 (95% <2.5s) | ❌ To do |
| **Cost** | <$500/month trajectory | ✅ Projected $0.87 |
| **Dashboard** | 5 tabs live, metrics calculated | ❌ To do |
| **E2E tests** | 5/5 flows PASS | ❌ To do |
| **DICQ 4.7 compliance** | Training policy + versioning documented | ❌ To do |
| **Baseline tests** | 738/738 still PASS | ✅ Should pass |
| **Cloud Logs** | 0 errors, <5% warning rate (24h) | ❌ To do |

---

## Risk Mitigation (Watch List)

### Medium Priority

**Risk**: Dataset collection lags (target 50/day, actual <30)
- **Mitigation**: Allocate dedicated RT hour blocks (morning + afternoon)
- **Fallback**: Use batch replay from historical images (seed ~100)

**Risk**: Gemini accuracy <85% on any variant
- **Mitigation**: A/B test all 3 variants immediately; choose best
- **Fallback**: Widen manual review threshold to 0.80 (accept more operator review)

**Risk**: Confidence threshold miscalibrated
- **Mitigation**: Plot confidence vs accuracy curve (end of Week 2)
- **Action**: Adjust threshold if accuracy dips below 85% at 0.85

### Low Priority

**Risk**: API timeout (>3s p99)
- **Mitigation**: Fallback to manual review if timeout
- **Alert**: Ops team notified on 3 consecutive timeouts

**Risk**: Privacy breach (PII in image metadata)
- **Mitigation**: No patient ID in metadata; geolocation optional; audit trail immutable
- **Check**: Weekly PII scan (no text in images detected)

---

## Communication Plan

**Daily**: 10am BRT standup (15 min)
- Progress vs checklist
- Blockers + help needed
- Dataset count (images collected yesterday)
- Any alerts (accuracy drop, API errors)

**Weekly**: Friday 4pm BRT sync (30 min)
- Week summary
- Decisions needed (threshold tuning, variant selection)
- Phase 12 readiness check

**Pre-Deploy**: Sunday evening (final review)
- All gates PASS?
- Any last-minute concerns?
- Deploy confidence: 100%?

---

**Prepared by**: Claude (AI Assistant)  
**For**: HC Quality Phase 11 team  
**Kickoff**: 2026-06-09 10am BRT
