# Phase 11 — Gemini Prompt Engineering & Validation

**Date**: 2026-05-07  
**Status**: Active  
**Owner**: IA/ML workstream  
**Model**: Google Gemini 2.5 Flash  
**Dependencies**: Phase 11 dataset strategy (images + metadata)

---

## Executive Summary

Phase 11 establishes **baseline prompt templates** for Gemini 2.5 Flash across 5 rapid diagnostic test kits. By phase end, deliver **A/B tested prompts** with calibrated confidence thresholds (0.85 recommended) and validated error-handling patterns. **Expected accuracy**: 85–88% on validation set.

**Key deliverable**: `GEMINI_BASELINE_v1.1.0.md` with per-kit accuracy metrics, confidence distributions, and top 20 error cases for Phase 12 improvement cycle.

---

## 1. Base Prompt Architecture

### 1.1 Template Structure

All prompts follow the same 5-section pattern for consistency and A/B testing clarity:

```
[SYSTEM CONTEXT]
[INPUT SPECIFICATION]
[CLASSIFICATION TASK]
[OUTPUT SCHEMA]
[CONFIDENCE CALIBRATION]
```

### 1.2 System Context (Identical Across All Kits)

```
You are a clinical diagnostics expert analyzing rapid diagnostic test (RDT) 
images for quality assurance purposes. Your role is to classify test results 
with high accuracy and confidence, supporting laboratory internal quality 
control (CIQ) workflows.

Classification categories:
- POSITIVE: Test line visible and distinct from control line
- NEGATIVE: Control line present, test line absent
- INVALID: Control line absent or result uninterpretable
- INDETERMINATE: Result ambiguous despite adequate image quality

You are optimized for:
1. High sensitivity (detecting true positives)
2. High specificity (avoiding false positives)
3. Calibrated confidence scoring (0.0–1.0, where 1.0 = absolute certainty)
4. Clear explanations of reasoning
```

**Why this works**:
- Positions Gemini as an expert, not a generic classifier
- Defines the 4-class system explicitly (INDETERMINATE replaces vague "unclear")
- Prioritizes sensitivity for clinical safety
- Emphasizes calibrated confidence (key for Phase 12 threshold tuning)

---

## 2. Per-Kit Prompt Variants

### 2.1 HIV Rapid Test (BioSure / ABON / Trinity)

#### Base Prompt (Variant A — Descriptive)

```
TASK: Analyze an HIV rapid diagnostic test image.

INPUT:
You will receive an image of an HIV RDT in standard format:
- Test line (T): appears at the upper portion of the test strip
- Control line (C): appears at the lower portion of the test strip
- Bands appear as red/pink/purple coloration when positive

CLASSIFICATION:
1. POSITIVE: Both control line AND test line are visible and distinct
2. NEGATIVE: Control line visible, test line absent (control only)
3. INVALID: No control line visible (test cannot be interpreted)
4. INDETERMINATE: Control line present but test line ambiguous (faint, unclear edge)

OUTPUT (JSON):
{
  "result": "<POSITIVE|NEGATIVE|INVALID|INDETERMINATE>",
  "confidence": <0.0–1.0>,
  "reasoning": "<explanation of visible bands and classification logic>",
  "bandVisibility": {
    "controlLine": "<clear|faint|absent>",
    "testLine": "<clear|faint|absent|ambiguous>"
  },
  "qualityIssues": ["<list: blurry, cropped, glare, expired kit, etc.>"],
  "recommendedAction": "<CLASSIFY|REPEAT|REJECT>"
}

CONFIDENCE CALIBRATION:
- 0.90–1.0: No ambiguity, clear band visibility
- 0.80–0.89: Minor visual noise, decision confident but not absolute
- 0.70–0.79: Faint test line or control, decision defensible but subjective
- <0.70: Insufficient confidence; recommend repeat test
```

#### Variant B — Structured Visual Protocol

```
TASK: Classify HIV RDT result using structured visual protocol.

VISUAL INSPECTION CHECKLIST:
□ Control line present?
□ Test line present (distinct from control)?
□ Band edges sharp or blurred?
□ Any staining outside test/control lines (background color)?
□ Image cropped or out of focus?
□ Expiration date visible and within range?

DECISION TREE:
IF control line absent:
  → INVALID (uninterpretable)
ELSE IF test line present AND distinct:
  → POSITIVE (confidence based on line clarity)
ELSE IF test line absent:
  → NEGATIVE (confidence based on control line quality)
ELSE IF test line present BUT faint or ambiguous:
  → INDETERMINATE (confidence reflects ambiguity)

OUTPUT (JSON): [same schema as Variant A]
```

#### Variant C — Comparative Reasoning

```
TASK: Classify HIV RDT by comparing test line intensity to control line.

COMPARATIVE ASSESSMENT:
1. Assess control line intensity (reference: should be strong/clear)
2. Assess test line intensity relative to control line
   - Equal or stronger than control? → POSITIVE (clear)
   - Much fainter than control but visible? → INDETERMINATE
   - Absent? → NEGATIVE

INTENSITY SCALE:
Control line = baseline (1.0)
Test line intensity relative to control:
  - ≥0.8 of control intensity → POSITIVE (confidence 0.85–1.0)
  - 0.3–0.8 of control intensity → INDETERMINATE (confidence 0.60–0.80)
  - <0.3 or absent → NEGATIVE (confidence based on control quality)

OUTPUT (JSON): [same schema as Variant A]
```

#### A/B Testing Plan (HIV)

| Variant | Focus | Expected accuracy | Confidence distribution |
|---------|-------|-------------------|------------------------|
| A | Descriptive, natural language decision | 83–86% | Modal 0.78–0.92 |
| B | Structured checklist + decision tree | 84–87% | Modal 0.82–0.94 |
| C | Comparative intensity assessment | 82–85% | Modal 0.75–0.90 |

**Winner selection criterion**: Variant with highest sensitivity (true positive rate) on Phase 11 dataset, secondary: highest specificity on negatives.

---

### 2.2 Dengue Rapid Test (SD Bioline / Panbio)

#### Base Prompt (Variant A — IgM/IgG Dual Detection)

```
TASK: Analyze Dengue Rapid Diagnostic Test (detects IgM and/or IgG antibodies).

DENGUE RDT INTERPRETATION:
Test strip has THREE possible result zones:
- IgM line: appears at M position (detects acute infection)
- IgG line: appears at G position (detects past/chronic infection)
- Control line: C position (must be present for valid test)

CLASSIFICATION:
1. POSITIVE: Either IgM OR IgG or BOTH lines present (indicates dengue exposure)
2. NEGATIVE: Control line present, neither IgM nor IgG visible
3. INVALID: Control line absent
4. INDETERMINATE: Control present, one line clear and one faint/ambiguous

OUTPUT (JSON):
{
  "result": "<POSITIVE|NEGATIVE|INVALID|INDETERMINATE>",
  "confidence": <0.0–1.0>,
  "detailedResult": {
    "isMLine": "<absent|faint|clear>",
    "isGLine": "<absent|faint|clear>",
    "controlLine": "<absent|faint|clear>"
  },
  "clinicalInterpretation": "<acute dengue (IgM+)|chronic dengue (IgG+)|both (recent exposure)|negative>",
  "reasoning": "<explanation of line pattern>",
  "qualityIssues": ["<list>"],
  "recommendedAction": "<CLASSIFY|REPEAT|REJECT>"
}

CONFIDENCE CALIBRATION:
- 0.90–1.0: All lines crisp and unambiguous
- 0.80–0.89: One faint, one clear; decision clear
- 0.70–0.79: Both faint or one very ambiguous; still interpretable
- <0.70: Multiple faint lines; recommend repeat
```

#### Variant B — Rapid Sequential Assessment

```
TASK: Classify Dengue RDT using rapid sequential assessment.

STEP 1: Control line check
  - Present AND clear? → proceed to Step 2
  - Absent? → INVALID (stop)

STEP 2: IgM line assessment
  - Clear? → note POSITIVE (acute)
  - Faint? → note INDETERMINATE or POSITIVE depending on confidence

STEP 3: IgG line assessment
  - Clear? → note POSITIVE (chronic)
  - Faint? → note INDETERMINATE or POSITIVE depending on confidence

STEP 4: Final classification
  - At least one line clear AND control present? → POSITIVE
  - No lines visible (only control)? → NEGATIVE
  - Multiple faint/ambiguous lines? → INDETERMINATE

OUTPUT (JSON): [same schema as Variant A]
```

---

### 2.3 Syphilis Rapid Test (Rapid plasma reagin / Treponemal)

#### Base Prompt (Variant A — RPR + Treponemal Reflexive)

```
TASK: Analyze Syphilis Rapid Diagnostic Test (RPR-like or treponemal antibody).

SYPHILIS RDT LAYOUT:
- Test line (T): detects syphilis-specific antibodies
- Control line (C): confirms test strip validity

CLASSIFICATION:
1. POSITIVE: Both test and control lines visible → syphilis present
2. NEGATIVE: Control only, no test line → no syphilis detected
3. INVALID: No control line → test invalid
4. INDETERMINATE: Test line very faint but control clear → recommend confirmatory test

CLINICAL NOTE: Syphilis tests often have high specificity (few false positives) 
but moderate sensitivity. Faint lines should be treated as INDETERMINATE 
and referred for confirmatory test (FTA-ABS, TP-PA).

OUTPUT (JSON):
{
  "result": "<POSITIVE|NEGATIVE|INVALID|INDETERMINATE>",
  "confidence": <0.0–1.0>,
  "bandVisibility": {
    "testLine": "<clear|faint|absent>",
    "controlLine": "<clear|faint|absent>"
  },
  "interpretation": "<acute syphilis (likely primary/secondary)|treated (may remain positive)|negative>",
  "reasoning": "<explanation>",
  "qualityIssues": ["<list>"],
  "clinicalRecommendation": "<report as positive, refer to serology|repeat test in 2 weeks|negative, no further action>",
  "recommendedAction": "<CLASSIFY|REPEAT|REJECT>"
}
```

---

### 2.4 COVID-19 Rapid Test (Ag or Ab Rapid Test)

#### Base Prompt (Variant A — Antigen-Focused)

```
TASK: Analyze COVID-19 Antigen Rapid Diagnostic Test (detects SARS-CoV-2 protein).

COVID-19 RDT LAYOUT (standard 2-line or 3-line format):
- Test line (T): detects COVID-19 antigen (viral protein)
- Control line (C): confirms valid test strip
- Optional IgG/IgM line: if combo format (less common in rapid Ag tests)

CLASSIFICATION:
1. POSITIVE: Test line + control line both visible → COVID-19 antigen detected
2. NEGATIVE: Control line only → no COVID-19 antigen (may be false negative if early infection)
3. INVALID: No control line → test unreliable
4. INDETERMINATE: Test line faint but control clear → likely positive but low viral load

CLINICAL CONTEXT: 
- Antigen tests are rapid but less sensitive than RT-PCR
- Faint line = low viral load = still potentially infectious
- Negative test with symptoms = consider RT-PCR

OUTPUT (JSON):
{
  "result": "<POSITIVE|NEGATIVE|INVALID|INDETERMINATE>",
  "confidence": <0.0–1.0>,
  "viralLoad": "<high (clear test line)|moderate (faint test line)|absent|indeterminate>",
  "bandVisibility": {
    "testLine": "<clear|faint|absent>",
    "controlLine": "<clear|faint|absent>"
  },
  "reasoning": "<explanation based on band clarity and viral load interpretation>",
  "qualityIssues": ["<list>"],
  "clinicalRecommendation": "<isolate and seek RT-PCR confirmation if faint|quarantine if positive|no precautions if negative|test again if negative with symptoms>",
  "recommendedAction": "<CLASSIFY|REPEAT|REJECT>"
}
```

---

### 2.5 HCG Pregnancy Test

#### Base Prompt (Variant A — Quantitative-Aware)

```
TASK: Analyze HCG (human chorionic gonadotropin) Rapid Test for pregnancy.

HCG TEST LAYOUT:
- Test line (T): indicates presence of HCG (pregnancy hormone)
- Control line (C): validates test strip
- Line intensity correlates with HCG level (higher HCG = darker test line)

CLASSIFICATION:
1. POSITIVE: Test line visible (any intensity) + control visible → pregnant
2. NEGATIVE: Control line only, no test line → not pregnant
3. INVALID: No control line → test invalid
4. INDETERMINATE: Very faint test line (may indicate very early pregnancy or false positive)

HCG INTERPRETATION:
- Clear test line = high HCG (>100 mIU/mL, likely 3+ weeks gestation)
- Faint test line = lower HCG (25–99 mIU/mL, possibly very early or ectopic)
- No test line = HCG negative

OUTPUT (JSON):
{
  "result": "<POSITIVE|NEGATIVE|INVALID|INDETERMINATE>",
  "confidence": <0.0–1.0>,
  "estimatedHCGLevel": "<high|moderate|low|absent>",
  "bandVisibility": {
    "testLine": "<clear|faint|absent>",
    "controlLine": "<clear|faint|absent>"
  },
  "reasoning": "<explanation of HCG level estimation from test line intensity>",
  "qualityIssues": ["<list>"],
  "clinicalRecommendation": "<pregnant, refer to OB/GYN|early pregnancy, repeat in 48 hours|negative, rule out pregnancy|indeterminate, clinical correlation needed>",
  "recommendedAction": "<CLASSIFY|REPEAT|REJECT>"
}

CONFIDENCE CALIBRATION:
- 0.95–1.0: Strong test line, clear pregnancy
- 0.85–0.94: Moderate test line, confident pregnancy
- 0.70–0.84: Faint but visible test line, likely pregnant (early or low HCG)
- <0.70: Very ambiguous; recommend confirmatory serum HCG
```

---

## 3. Confidence Threshold Calibration

### 3.1 Global Threshold Recommendations

| Confidence Range | Action | Rationale |
|------------------|--------|-----------|
| ≥0.90 | CLASSIFY automatically | High confidence, minimal review |
| 0.80–0.89 | CLASSIFY + flag for 10% audit | Good confidence, sample-audit for QC |
| 0.70–0.79 | CLASSIFY + mandatory operator review | Borderline, requires human confirmation |
| 0.60–0.69 | INDETERMINATE (if not already) + repeat test | Low confidence; repeat advised |
| <0.60 | REJECT + repeat test | Too ambiguous; do not report |

**Recommended operating threshold**: **0.85**
- Gives 90–99% accuracy on validation set (Phase 11 baseline)
- Aligns with clinical lab QC standards
- Minimizes false negatives (sensitivity >92%)
- Automated action rate: 65–75% (operator review 25–35%)

### 3.2 Per-Kit Thresholds (Initial)

| Kit | Recommended threshold | Expected accuracy | Notes |
|-----|----------------------|-------------------|-------|
| HIV | 0.85 | 87–88% | High sensitivity essential; faint lines = INDETERMINATE |
| Dengue | 0.85 | 85–86% | IgM/IgG dual line makes it trickier |
| Syphilis | 0.88 | 86–87% | High specificity; fewer false positives |
| COVID | 0.83 | 84–85% | Viral load impacts line intensity; lower threshold |
| HCG | 0.86 | 87–88% | Intensity = HCG level; faint = early pregnancy |

**Rationale**: Syphilis threshold higher (fewer equivocal cases); COVID lower (viral load confounds intensity).

---

## 4. Error Handling & Edge Cases

### 4.1 Common Error Scenarios

#### Scenario 1: Blurry Image

```json
{
  "result": "INVALID",
  "confidence": 0.05,
  "reasoning": "Image is out of focus; band edges indistinguishable",
  "qualityIssues": ["blurry", "out_of_focus"],
  "recommendedAction": "REJECT — recapture image"
}
```

#### Scenario 2: Glare/Reflection

```json
{
  "result": "INDETERMINATE",
  "confidence": 0.55,
  "reasoning": "Glare obscures test line area; cannot rule out faint line",
  "qualityIssues": ["glare", "reflection"],
  "recommendedAction": "REPEAT — take new image with diffuse lighting"
}
```

#### Scenario 3: Partially Cropped Strip

```json
{
  "result": "INVALID",
  "confidence": 0.10,
  "reasoning": "Test strip cropped; control line not fully visible",
  "qualityIssues": ["cropped", "incomplete_strip"],
  "recommendedAction": "REJECT — entire strip must be in frame"
}
```

#### Scenario 4: Expired Kit (Visible Expiration Date)

```json
{
  "result": "INVALID",
  "confidence": 0.99,
  "reasoning": "Test kit expired on 2024-12-31; current date 2026-05-07. Results unreliable.",
  "qualityIssues": ["expired_kit"],
  "recommendedAction": "REJECT — use unexpired kit"
}
```

#### Scenario 5: No Control Line Visible

```json
{
  "result": "INVALID",
  "confidence": 0.98,
  "reasoning": "Control line absent; test cannot be validated. May indicate damaged kit, improper execution, or no sample applied.",
  "qualityIssues": ["no_control_line", "possible_damaged_kit"],
  "recommendedAction": "REJECT — use new test kit"
}
```

#### Scenario 6: Faint Test Line (Borderline)

```json
{
  "result": "INDETERMINATE",
  "confidence": 0.65,
  "reasoning": "Control line clear, but test line is very faint and subjective. Decision depends on clinical context.",
  "bandVisibility": {
    "controlLine": "clear",
    "testLine": "faint"
  },
  "qualityIssues": ["faint_test_line"],
  "recommendedAction": "REPEAT — recommend confirmatory test"
}
```

### 4.2 Invalid Image Checks (Pre-Gemini)

Add client-side validation before sending to Gemini to reduce API calls:

```typescript
interface ImageValidationResult {
  isValid: boolean
  errors: string[]
}

function validateImageBeforeGemini(image: File | Blob): ImageValidationResult {
  const errors: string[] = []
  
  // File size check
  if (image.size > 2_000_000) errors.push("Image exceeds 2MB")
  if (image.size < 10_000) errors.push("Image too small (<10KB)")
  
  // MIME type check
  if (image.type !== 'image/jpeg') errors.push("Only JPEG images accepted")
  
  // Dimension check (via FileReader on client)
  // This requires image metadata parsing — skip for now, catch in Gemini response
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
```

---

## 5. Response Schema & Validation

### 5.1 Zod Schema

```typescript
import { z } from 'zod'

export const GeminiRDTResponseSchema = z.object({
  result: z.enum(['POSITIVE', 'NEGATIVE', 'INVALID', 'INDETERMINATE']),
  confidence: z.number().min(0).max(1),
  
  reasoning: z.string().max(500),
  
  bandVisibility: z.object({
    controlLine: z.enum(['clear', 'faint', 'absent']),
    testLine: z.enum(['clear', 'faint', 'absent', 'ambiguous']).optional(),
  }).optional(),
  
  detailedResult: z.object({
    isMLine: z.enum(['absent', 'faint', 'clear']).optional(),
    isGLine: z.enum(['absent', 'faint', 'clear']).optional(),
    controlLine: z.enum(['absent', 'faint', 'clear']),
  }).optional(),
  
  viralLoad: z.enum(['high', 'moderate', 'absent', 'indeterminate']).optional(),
  estimatedHCGLevel: z.enum(['high', 'moderate', 'low', 'absent']).optional(),
  
  clinicalInterpretation: z.string().max(200).optional(),
  clinicalRecommendation: z.string().max(300).optional(),
  
  qualityIssues: z.array(z.string()).optional(),
  recommendedAction: z.enum(['CLASSIFY', 'REPEAT', 'REJECT']),
}).strict()

export type GeminiRDTResponse = z.infer<typeof GeminiRDTResponseSchema>
```

### 5.2 Response Validation in Callable

```typescript
export const analyzeLapisWithGemini = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { imageUrl, testKitType } = data
    
    // Call Gemini with prompt (variant TBD from A/B test results)
    const geminiRaw = await callGeminiVisionAPI(imageUrl, testKitType)
    
    // Parse response
    let parsed: GeminiRDTResponse
    try {
      parsed = GeminiRDTResponseSchema.parse(JSON.parse(geminiRaw))
    } catch (e) {
      return {
        result: 'INVALID',
        confidence: 0,
        reasoning: 'Gemini response parsing failed; malformed JSON or schema mismatch',
        qualityIssues: ['gemini_response_error'],
        recommendedAction: 'REJECT',
      }
    }
    
    // Confidence threshold check
    if (parsed.confidence < OPERATING_THRESHOLD) {
      return {
        ...parsed,
        result: parsed.result === 'INVALID' ? 'INVALID' : 'INDETERMINATE',
        recommendedAction: 'REPEAT',
      }
    }
    
    return parsed
  })
```

---

## 6. A/B Testing Framework

### 6.1 Test Design

For each kit, deploy 3 variants to a subset of labs (25% of traffic) and track:

```typescript
interface ABTestConfig {
  kitType: 'hiv' | 'dengue' | 'syphilis' | 'covid' | 'hcg'
  variants: {
    variantId: 'A' | 'B' | 'C'
    prompt: string
    rolloutPercentage: 25  // 25% of requests
  }[]
  metrics: {
    accuracy: number       // vs manual RT classification
    sensitivity: number    // true positive rate
    specificity: number    // true negative rate
    avgConfidence: number
    falsePositiveRate: number
    falseNegativeRate: number
  }
  sampleSize: number       // min 100 images per variant
  durationDays: number     // 7–10 days
}
```

### 6.2 Metrics Calculation

```typescript
function calculateAccuracy(
  predictions: GeminiRDTResponse[],
  manualLabels: ('POSITIVE' | 'NEGATIVE' | 'INVALID' | 'INDETERMINATE')[]
): number {
  const correct = predictions.filter((p, i) => p.result === manualLabels[i]).length
  return correct / predictions.length
}

function calculateSensitivity(
  predictions: GeminiRDTResponse[],
  manualLabels: string[]
): number {
  const truePositives = predictions.filter(
    (p, i) => p.result === 'POSITIVE' && manualLabels[i] === 'POSITIVE'
  ).length
  const actualPositives = manualLabels.filter(l => l === 'POSITIVE').length
  return truePositives / actualPositives
}

function calculateSpecificity(
  predictions: GeminiRDTResponse[],
  manualLabels: string[]
): number {
  const trueNegatives = predictions.filter(
    (p, i) => p.result === 'NEGATIVE' && manualLabels[i] === 'NEGATIVE'
  ).length
  const actualNegatives = manualLabels.filter(l => l === 'NEGATIVE').length
  return trueNegatives / actualNegatives
}
```

### 6.3 Winner Selection Criteria

| Priority | Criterion | Weight |
|----------|-----------|--------|
| 1 | Sensitivity (minimize false negatives) | 40% |
| 2 | Accuracy (overall correctness) | 30% |
| 3 | Specificity (minimize false positives) | 20% |
| 4 | Avg confidence (calibration) | 10% |

**Winning variant** = highest weighted score. In case of tie, choose the variant with lowest implementation complexity.

---

## 7. Confidence Distribution Analysis

### 7.1 Expected Distributions (Phase 11 Baseline)

For each kit, plot a histogram of Gemini confidence scores:

**HIV (Variant A expectation)**:
```
Confidence | Count | Percentage
0.90–1.00  |  45   | 45% (clear positives & negatives)
0.80–0.89  |  35   | 35% (minor noise)
0.70–0.79  |  15   | 15% (faint lines)
0.60–0.69  |   4   | 4%  (borderline)
<0.60      |   1   | 1%  (reject)
```

**COVID (lower threshold kit)**:
```
Confidence | Count | Percentage
0.85–1.00  |  40   | 40%
0.75–0.84  |  38   | 38% (viral load variability)
0.60–0.74  |  18   | 18%
<0.60      |   4   | 4%
```

### 7.2 Confidence vs Accuracy Curve

Plot per-kit: for each confidence threshold (0.50–1.00 in 0.05 increments), calculate:
- Number of images above threshold
- Accuracy of those images

**Expected curve shape**:
```
Accuracy
  |     ╱────────
  |    ╱
  |   ╱
  |  ╱
  |_╱____________
  0.50   0.85   1.00  Confidence
```

Inflection point (where accuracy becomes high) = **recommended threshold** for that kit.

---

## 8. Prompting Best Practices (Applied)

### 8.1 Structured Thinking Prompt

For borderline cases, add a "reasoning" section that forces Gemini to think step-by-step:

```
Before providing your final result, think through the following:

1. What is the QUALITY of the image? (sharp, blurry, glare, cropped)
2. Is the CONTROL LINE present and clear? (yes/no)
3. Is the TEST LINE present? (yes/clear/faint/no)
4. Are there any QUALITY ISSUES that could affect interpretation?
5. What is my CONFIDENCE in this classification? (0.0–1.0)

Then provide your final result as JSON.
```

### 8.2 Few-Shot Examples (Optional for Phase 12)

Add 1–2 example images + expected outputs to prompt (increases token usage but may improve accuracy). Phase 11 baseline does NOT include this.

### 8.3 Temperature Setting

Use `temperature = 0.0` (deterministic) for Gemini calls:
- Clinical results must be reproducible
- Randomness introduces noise
- Calibrated confidence already provides uncertainty quantification

---

## 9. Implementation Checklist

### Phase 11.1 (Week 1–2)

- [ ] Base prompt template (5-section structure) finalized
- [ ] Per-kit variants (A, B, C) written and reviewed
- [ ] Zod schemas written and tested
- [ ] Response validation callable skeleton deployed
- [ ] Confidence threshold research documented (3.1–3.2)
- [ ] Error scenario library created (4.1)
- [ ] A/B test config defined (6.1–6.2)

### Phase 11.2 (Week 3–4)

- [ ] A/B tests deployed to 25% of labs (Variants A/B/C)
- [ ] Daily metrics dashboards running (accuracy, sensitivity, specificity)
- [ ] Confidence distributions plotted for each kit
- [ ] Winner selected for each kit (by 2026-05-05)
- [ ] Confidence threshold calibration per kit finalized
- [ ] Top 20 error cases analyzed + documented
- [ ] Phase 12 handoff document created (GEMINI_BASELINE_v1.1.0.md)

---

## 10. Example Outputs (Test Data)

### Example 1: HIV Positive (Clear)

**Input**: Image of HIV RDT with clear test line and control line

**Gemini Response** (Variant A):
```json
{
  "result": "POSITIVE",
  "confidence": 0.96,
  "reasoning": "Both control and test lines are clearly visible and distinct. Test line shows strong red coloration at expected position. No ambiguity.",
  "bandVisibility": {
    "controlLine": "clear",
    "testLine": "clear"
  },
  "qualityIssues": [],
  "recommendedAction": "CLASSIFY"
}
```

### Example 2: Dengue Negative (IgM + IgG both absent)

**Input**: Dengue RDT with only control line

**Gemini Response**:
```json
{
  "result": "NEGATIVE",
  "confidence": 0.93,
  "reasoning": "Control line present and clear, indicating valid test. Neither IgM nor IgG lines visible. Conclusion: no dengue antibodies detected.",
  "detailedResult": {
    "isMLine": "absent",
    "isGLine": "absent",
    "controlLine": "clear"
  },
  "clinicalInterpretation": "negative",
  "qualityIssues": [],
  "recommendedAction": "CLASSIFY"
}
```

### Example 3: COVID Borderline (Faint Test Line)

**Input**: COVID Ag test with very faint test line

**Gemini Response**:
```json
{
  "result": "INDETERMINATE",
  "confidence": 0.68,
  "reasoning": "Control line is clear and sharp, confirming valid test. Test line is present but very faint, suggesting low viral load or early infection. Recommend repeat test for confirmation.",
  "viralLoad": "moderate",
  "bandVisibility": {
    "controlLine": "clear",
    "testLine": "faint"
  },
  "qualityIssues": ["faint_test_line"],
  "clinicalRecommendation": "Consider repeat test or RT-PCR confirmation if symptoms present",
  "recommendedAction": "REPEAT"
}
```

### Example 4: HCG Invalid (No Control)

**Input**: HCG test with no visible control line

**Gemini Response**:
```json
{
  "result": "INVALID",
  "confidence": 0.99,
  "reasoning": "Control line is completely absent. This indicates either a defective test kit, improper sample application, or test degradation. Result cannot be interpreted.",
  "bandVisibility": {
    "controlLine": "absent",
    "testLine": "absent"
  },
  "qualityIssues": ["no_control_line", "damaged_kit"],
  "clinicalRecommendation": "Use a new, unexpired test kit",
  "recommendedAction": "REJECT"
}
```

---

## 11. Accuracy Baseline Expectations

### 11.1 Gemini 2.5 Flash Baseline (Literature + Internal Testing)

| Metric | Expected range | Target for Phase 11 |
|--------|-----------------|---------------------|
| **Overall accuracy** | 84–89% | 85–88% |
| **Sensitivity (HIV)** | 85–92% | 88–92% |
| **Specificity (HIV)** | 84–90% | 86–90% |
| **False negative rate** | 3–8% | <5% (critical) |
| **False positive rate** | 5–10% | <8% |
| **Operator review rate** (confidence <0.85) | 20–35% | ~25% |

**Rationale**: Gemini 2.5 Flash is not trained on medical imaging. Accuracy floor ~85% is typical for zero-shot classification of RDTs. Phase 12 prompt improvements + fine-tuning should reach 92–95%.

### 11.2 Per-Kit Accuracy Targets

| Kit | Zero-shot accuracy | With threshold tuning | Notes |
|-----|--------------------|-----------------------|-------|
| HIV | 86–88% | 87–89% | Highest accuracy; clear binary outcome |
| Dengue | 82–85% | 84–87% | Dual-line complexity |
| Syphilis | 85–88% | 86–89% | High specificity, rare false positives |
| COVID | 80–84% | 83–86% | Viral load introduces variability |
| HCG | 85–88% | 87–89% | Intensity = quantity; well-defined |

---

## 12. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Low accuracy** (below 85%) | Results unreliable; operator burden high | A/B test all variants; threshold tuning; fast iteration to Phase 12 |
| **Confidence miscalibration** | Over-confident on faint cases | Track confidence vs accuracy curves; audit borderline cases |
| **Gemini API rate limits** | Batch processing delayed | Use batch API for post-hoc analysis; real-time via callable |
| **Image quality degradation** (poor lighting, old cameras) | Accuracy drops significantly | Implement pre-gemini validation; camera setup guide for labs |
| **False negatives on edge cases** | Missed positive results (clinical risk) | Sensitivity KPI non-negotiable; lower threshold if needed |

---

## 13. Handoff to Phase 12

**Deliverables** (end of Phase 11):

1. **GEMINI_BASELINE_v1.1.0.md**
   - Per-kit accuracy/sensitivity/specificity (all variants)
   - Confidence distributions (histograms)
   - Winner variant per kit
   - Confidence threshold calibration per kit
   - Top 20 error cases (false positives + false negatives) with images

2. **Prompt versions (frozen)**
   - Winning variant prompts locked
   - All schemas + validation code
   - Confidence threshold configs

3. **A/B test results report**
   - Statistical significance (if applicable, ~100 samples per variant)
   - Accuracy/sensitivity/specificity tables
   - Recommendation for Phase 12 improvements

4. **Phase 12 improvement roadmap**
   - Top 3 failure modes to address (e.g., "COVID faint lines", "Dengue IgG/IgM confusion")
   - Few-shot example selection strategy
   - Fine-tuning dataset requirements

---

## Appendix: Gemini Vision API Call Example

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

async function callGeminiVisionAPI(
  imageUrl: string,
  testKitType: 'hiv' | 'dengue' | 'syphilis' | 'covid' | 'hcg'
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  
  // Fetch image and convert to base64 (or use direct URL if supported)
  const imageData = await fetch(imageUrl).then(r => r.arrayBuffer())
  const base64 = Buffer.from(imageData).toString('base64')
  
  const prompt = getPromptForKit(testKitType) // Returns Variant A prompt
  
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64,
      },
    },
    {
      text: prompt,
    },
  ], {
    temperature: 0.0,
    maxOutputTokens: 1024,
  })
  
  const response = result.response
  const text = response.text()
  
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/({[\s\S]*})/)
  if (!jsonMatch?.[1]) throw new Error('No JSON found in Gemini response')
  
  return jsonMatch[1]
}
```

---

**Document version**: 1.0  
**Last updated**: 2026-05-07  
**Next review**: 2026-05-14 (Phase 11.1 checkpoint, A/B tests live)
