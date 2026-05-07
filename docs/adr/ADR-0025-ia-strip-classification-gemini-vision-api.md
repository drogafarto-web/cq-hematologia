# ADR-0025 — IA Strip Classification: Gemini 2.5 Flash Vision API (Phase 11)

**Date:** 2026-05-07  
**Status:** PROPOSED  
**Decided by:** CTO / fundador  
**Supersedes:** ADR-0010 (extends vision baseline to multi-analyte parsing)  
**Superseded by:** — (future: custom ML model if cost/accuracy warrants)

---

## Problem

v1.3 implemented Gemini Vision for H550 analyzer OCR (analyte result parsing from hematology images). v1.4 Phase 11 must **extend to multi-equipment + multi-analyte** (coagulação, imunologia, uroanálise strips):

- H550 (hematology): WBC, RBC, HGB, HCT, PLT, etc. (already live).
- Coagulation analyzer (PT, INR, APTT strips): OCR + normalization.
- Immunology (serology strips): band interpretation (REACTIVE / NON-REACTIVE / EQUIVOCAL).
- Urinalysis (dipstick images): color matching (glucose, protein, bilirubin, etc.).

**Technical challenge:** Gemini Vision API supports image-to-text inference; how to structure prompts for reliable multi-analyte extraction + error handling?

**Business constraints:**
- **Cost:** Gemini 2.5 Flash = $0.075 / 1M input tokens (cheap); fine-tuned model = $5–20K setup + $0.50–1.00 per inference (expensive).
- **Latency:** Gemini inference ~2–5 sec per image; acceptable for batch processing, not real-time mobile.
- **Accuracy:** Gemini ~95% accuracy on trained OCR tasks; custom ML = 98%+ but requires labeled dataset (10K+ images for training).
- **Timeline:** v1.4 Phase 11 has 2 weeks; custom ML requires 4–6 weeks (data labeling + training).

**Decision:** Gemini 2.5 Flash for Phase 11; revisit custom ML in v1.5 if accuracy gap demands it.

---

## Decision

**v1.4 Phase 11 uses Gemini 2.5 Flash Vision API for multi-equipment OCR, with equipment-specific prompts + structured extraction schema.**

### Architecture

#### 1. Equipment-Agnostic Pipeline

```
Analyzer image upload
  ↓ [equipment detection: user selects equipment type or auto-detect via filename pattern]
  ↓ [dispatch to equipment-specific prompt]
    ├→ H550 (hematology): "Extract: WBC, RBC, HGB, HCT, PLT, MCV, MCHC, RDW"
    ├→ Coagulation: "Extract: PT (sec), INR, APTT (sec), Fibrinogen (mg/dL)"
    ├→ Immunology: "Extract: test name, result (REACTIVE/NON-REACTIVE/EQUIVOCAL), numeric value (if any)"
    ├→ Urinalysis: "Extract: glucose, protein, blood, bilirubin, ketones, ... (0–4+ scale)"
  ↓ [Gemini inference: image + prompt → structured JSON]
  ↓ [schema validation: Zod check against expected fields + data types]
  ↓ [confidence scoring: Gemini returns confidence per field; flag <80% for manual review]
  ↓ [store result in Firestore + audit trail]
```

#### 2. Equipment-Specific Schemas (Zod)

```typescript
// H550 Hematology
const H550ResultSchema = z.object({
  equipment: z.literal('H550'),
  wbc: z.number().min(0).max(1000), // WBC count (K/µL)
  rbc: z.number().min(0).max(100),  // RBC count (M/µL)
  hgb: z.number().min(0).max(30),   // Hemoglobin (g/dL)
  hct: z.number().min(0).max(70),   // Hematocrit (%)
  plt: z.number().min(0).max(1000), // Platelets (K/µL)
  mcv: z.number().min(50).max(150), // Mean corpuscular volume (fL)
  mch: z.number().min(10).max(50),  // Mean corpuscular hemoglobin (pg)
  mchc: z.number().min(20).max(40), // MCHC (g/dL)
  rdw: z.number().min(10).max(20),  // RDW (%)
  timestamp: z.date(),
  confidenceScores: z.record(z.number().min(0).max(100)), // field → confidence %
});

// Coagulation
const CoagulationResultSchema = z.object({
  equipment: z.literal('coagulation'),
  pt: z.number().min(5).max(60),    // PT (seconds)
  inr: z.number().min(0.5).max(15), // INR (ratio)
  aptt: z.number().min(20).max(150), // APTT (seconds)
  fibrinogen: z.number().min(50).max(500), // mg/dL
  timestamp: z.date(),
  confidenceScores: z.record(z.number()),
});

// Immunology
const ImmunologyResultSchema = z.object({
  equipment: z.literal('immunology'),
  testName: z.string(),
  result: z.enum(['REACTIVE', 'NON-REACTIVE', 'EQUIVOCAL']),
  value?: z.number(), // numeric result if any (e.g., antibody titer)
  timestamp: z.date(),
  confidenceScores: z.record(z.number()),
});

// Urinalysis
const UrinalysisResultSchema = z.object({
  equipment: z.literal('urinalysis'),
  glucose: z.enum(['Negative', 'Trace', '1+', '2+', '3+', '4+']),
  protein: z.enum(['Negative', 'Trace', '1+', '2+', '3+', '4+']),
  blood: z.enum(['Negative', 'Trace', '1+', '2+', '3+', '4+']),
  bilirubin: z.enum(['Negative', 'Small', 'Moderate', 'Large']),
  ketones: z.enum(['Negative', 'Trace', 'Small', 'Moderate', 'Large']),
  specificGravity: z.number().min(1.000).max(1.030),
  ph: z.number().min(4.5).max(8.5),
  timestamp: z.date(),
  confidenceScores: z.record(z.number()),
});
```

#### 3. Gemini Prompt Templates (per equipment)

**H550 Hematology:**
```
You are a laboratory analyzer OCR system. Analyze the image of a Sysmex H550 hematology analyzer output screen and extract the following parameters:

1. WBC (White Blood Cell Count) in K/µL
2. RBC (Red Blood Cell Count) in M/µL
3. HGB (Hemoglobin) in g/dL
4. HCT (Hematocrit) in %
5. PLT (Platelets) in K/µL
6. MCV (Mean Corpuscular Volume) in fL
7. MCH (Mean Corpuscular Hemoglobin) in pg
8. MCHC (Mean Corpuscular Hemoglobin Concentration) in g/dL
9. RDW (Red Cell Distribution Width) in %

For each parameter, provide:
- field_name: the numeric value (or null if not visible)
- confidence: your confidence (0-100) that the value is correct

Format output as JSON only, no additional text:
{
  "wbc": {"value": NUMBER, "confidence": NUMBER},
  "rbc": {"value": NUMBER, "confidence": NUMBER},
  ... (all 9 fields)
}

If any field is unclear, set value to null and confidence to 0.
```

**Coagulation:**
```
You are a laboratory analyzer OCR system. Analyze the image of a coagulation analyzer output and extract:
1. PT (Prothrombin Time) in seconds
2. INR (International Normalized Ratio)
3. APTT (Activated Partial Thromboplastin Time) in seconds
4. Fibrinogen in mg/dL

Format as JSON only:
{
  "pt": {"value": NUMBER, "confidence": NUMBER},
  "inr": {"value": NUMBER, "confidence": NUMBER},
  "aptt": {"value": NUMBER, "confidence": NUMBER},
  "fibrinogen": {"value": NUMBER, "confidence": NUMBER}
}
```

**Immunology (Serology Strip):**
```
Analyze the image of a serology/immunology test strip. Identify:
1. Test name (e.g., "HIV", "Syphilis", "Hepatitis B")
2. Test result (REACTIVE, NON-REACTIVE, or EQUIVOCAL based on band presence)
3. If numeric: antibody titer or quantitative value

Format as JSON:
{
  "testName": STRING,
  "result": "REACTIVE" | "NON-REACTIVE" | "EQUIVOCAL",
  "value": NUMBER (optional),
  "confidence": NUMBER
}
```

**Urinalysis (Dipstick):**
```
Analyze a urinalysis dipstick image. Extract color/intensity for each parameter:
1. Glucose: Negative, Trace, 1+, 2+, 3+, 4+
2. Protein: Negative, Trace, 1+, 2+, 3+, 4+
3. Blood: Negative, Trace, 1+, 2+, 3+, 4+
4. Bilirubin: Negative, Small, Moderate, Large
5. Ketones: Negative, Trace, Small, Moderate, Large
6. Specific Gravity (numeric, 1.000-1.030)
7. pH (numeric, 4.5-8.5)

Format as JSON:
{
  "glucose": {"value": STRING, "confidence": NUMBER},
  "protein": {"value": STRING, "confidence": NUMBER},
  ... (all 7 fields)
}
```

#### 4. Cloud Function Callable: Image Processing

```typescript
// functions/src/modules/ia-ocr/classifyAnalyzerImage.ts
export const classifyAnalyzerImage = onCall(
  { secrets: [HCQ_SIGNATURE_HMAC_KEY, GEMINI_API_KEY] },
  async (request: CallableRequest<ClassifyImageInput>): Promise<ClassifyImageOutput> => {
    const { labId, equipmentType, imagePath } = request.data;

    // 1. Validate input
    if (!['H550', 'coagulation', 'immunology', 'urinalysis'].includes(equipmentType)) {
      throw new HttpsError('invalid-argument', 'Unknown equipment type');
    }

    // 2. Load image from Firebase Storage
    const bucket = admin.storage().bucket();
    const imageBuffer = await bucket.file(imagePath).download();

    // 3. Encode image as base64
    const base64Image = imageBuffer.toString('base64');

    // 4. Dispatch to equipment-specific prompt
    const prompt = getPromptForEquipment(equipmentType);

    // 5. Call Gemini API
    const vertexAI = new VertexAI({
      project: 'hmatologia2',
      location: 'southamerica-east1',
    });
    const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const response = await model.generateContent([
      {
        inlineData: { mimeType: 'image/jpeg', data: base64Image },
      },
      { text: prompt },
    ]);

    const responseText = response.response.text();
    const parsedResult = JSON.parse(responseText);

    // 6. Validate against schema
    const equipment = equipmentType as 'H550' | 'coagulation' | 'immunology' | 'urinalysis';
    const schema = getSchemaForEquipment(equipment);
    const validatedResult = schema.parse(parsedResult);

    // 7. Check confidence scores; flag low-confidence fields for manual review
    const requiresManualReview = Object.entries(validatedResult.confidenceScores).some(
      ([field, confidence]) => confidence < 80
    );

    // 8. Store result in Firestore
    const resultId = admin.firestore().collection('_').doc().id;
    const docRef = admin.firestore()
      .collection(`/labs/${labId}/ia-ocr-results`)
      .doc(resultId);

    await docRef.set({
      id: resultId,
      labId,
      equipmentType,
      imagePath,
      parsedResult: validatedResult,
      requiresManualReview,
      geminResponse: responseText, // store raw Gemini response for debugging
      confidenceScores: validatedResult.confidenceScores,
      ts: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: request.auth!.uid,
    });

    // 9. Audit trail + chainHash
    const chainHash = generateChainHash({
      labId,
      resultId,
      equipmentType,
      requiresManualReview,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    await docRef.update({ chainHash });

    // 10. Return result
    return {
      success: true,
      resultId,
      parsedResult: validatedResult,
      requiresManualReview,
      confidenceScores: validatedResult.confidenceScores,
    };
  }
);
```

#### 5. Manual Review & Integration

If `requiresManualReview === true`:
- Flag result in RT dashboard: "Review OCR result for <equipment> — confidence <80%".
- RT can accept (trust Gemini) or reject + manually re-enter values.
- If rejected: store feedback `{ resultId, correctedValues, fieldsFlagged }` → future Gemini fine-tuning dataset.

---

## Rationale

1. **Cost-effective:** Gemini 2.5 Flash = $0.075 / 1M tokens (all 4 equipment types fit in <5K tokens total); ~$0.0004 per inference.
2. **Fast:** 2–5 sec inference acceptable for batch OCR (not real-time).
3. **Extensible:** equipment-agnostic pipeline; adding 5th equipment = new schema + prompt (no code refactor).
4. **Defensible accuracy:** ~95% accuracy sufficient for v1.4; RTs manually review low-confidence (<80%) results.
5. **Audit trail:** Gemini response + confidence scores stored; auditor can see why OCR flagged value for review.

---

## Alternatives Considered

### A. Fine-tuned custom ML model (on-premise or vendor)
**Pros:** 98%+ accuracy; no vendor dependency; full control.  
**Cons:** 4–6 weeks to build; requires 10K+ labeled images per equipment; $5–20K setup cost.  
**Rejected:** v1.4 timeline can't absorb 6 weeks. Revisit in v1.5 if Gemini accuracy gap grows.

### B. Vendor SDK APIs (Sysmex, Mindray, etc.)
**Pros:** vendor-backed accuracy; no OCR needed (if analyzer exports structured data).  
**Cons:** Riopomba's H550 outputs PDF/image only (no API available); other equipment also image-only.  
**Rejected:** doesn't work for existing analyzer fleet.

### C. OCR libraries (Tesseract, EasyOCR)
**Pros:** open-source; no cloud dependency.  
**Cons:** accuracy <80% on medical analyzer displays (poor at small fonts, color-coded values).  
**Rejected:** insufficient accuracy for critical lab values.

### D. Hybrid: Gemini + human review (no automation)
**Pros:** full manual control; zero false positives.  
**Cons:** no speedup (still manual entry per result); defeats purpose of Phase 11 ("IA integration").  
**Rejected:** defeats IA benefit; v1.4 still ships "broken OCR".

---

## Consequences

### Positive

1. **Phase 11 ships IA.** Multi-equipment OCR available in v1.4 (market differentiator).
2. **Cost-effective:** <$0.50/month per lab for OCR (10 analyzers × 50 samples/day = 500 inferences/day × $0.0004 ≈ $0.20/day).
3. **Operator relief:** bulk result entry now 10–15 sec per image (vs. 2–3 min manual typing).
4. **Audit trail:** Gemini confidence scores + manual reviews create dataset for future ML fine-tuning.

### Negative

1. **Gemini vendor lock-in:** if Google discontinues Gemini API or raises pricing 10x, need to migrate (expensive refactor).
2. **False positives:** ~5% of inferences will be wrong; RTs must manually review flagged results (creates friction).
3. **No offline mode:** OCR requires internet + Gemini API availability; analyzer offline = OCR offline.
4. **Prompt engineering maintenance:** as equipment models evolve (new H550 firmware, different display format), prompts may degrade; require periodic retuning.

### Mitigation

- **Gemini alternative:** document fallback to Tesseract (open-source) for emergency offline OCR (lower accuracy, but better than nothing).
- **Manual review workflow:** RT dashboard should make review quick (<10 sec per flagged result).
- **Prompt versioning:** store prompt versions in Firestore; A/B test accuracy on live data.

---

## Derived Commitments

1. **Phase 11 deliverables (Weeks 1–2):**
   - Cloud Function callable: `classifyAnalyzerImage(labId, equipmentType, imagePath)`.
   - Equipment-specific schemas (Zod) + prompts (4 templates).
   - Firestore collection: `/labs/{labId}/ia-ocr-results` (schema + rules).
   - E2E tests: 8 specs (all 4 equipment types, low confidence flagging, manual review, audit trail).

2. **Phase 11 Configuration (Week 2):**
   - Gemini API key in Secret Manager (`GEMINI_API_KEY`).
   - Equipment mapping config (which analyzer firmware → which prompt version).

3. **RT UI Integration (Phase 11 Week 2–3):**
   - Upload image button on analyzer result entry form.
   - OCR processing spinner (Gemini latency ~3–5 sec).
   - Auto-fill result fields with Gemini output (or show "manual review required" if <80% confidence).
   - Manual review dashboard (list all flagged results; RT can accept/reject/correct).

4. **Feedback collection (Phase 11 Week 3):**
   - Store corrected values: `{ resultId, correctedValues, fieldsWrong }` in `ia-ocr-corrections` collection.
   - Monthly report: "OCR accuracy by equipment type" (track true-positive, false-positive rates).
   - Use report to decide: fine-tune Gemini prompts in Phase 12, or greenlight custom ML in v1.5.

5. **Firestore Rules & Security:**
   - `/labs/{labId}/ia-ocr-results`: RT-readable; immutable after creation.
   - Raw Gemini response stored (for debugging); not exposed to auditor by default (PII in images → sensitive).

---

## Links to Related ADRs & Phases

- **ADR-0010** — Gemini Vision API as IA baseline (extends to multi-equipment).
- **Phase 11** — IA Foundation (Strip OCR) (v1.4 roadmap).
- **Phase 12** — Performance Audit (includes OCR accuracy review).
- **v1.5 roadmap** — Consider custom ML model if Gemini accuracy <90%.

---

**ADR Status:** PROPOSED (2026-05-07)  
**Gate Review:** End of Phase 11 Week 2 (confirm Gemini integration working, test all 4 equipment types, assess accuracy on Riopomba images).  
**Feedback Analysis:** Phase 11 Week 4 (monthly OCR accuracy report; decide fine-tune vs. custom ML path for v1.5).
