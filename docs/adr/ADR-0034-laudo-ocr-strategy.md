# ADR-0034: Laudo OCR Strategy — Gemini Vision + Consent Gate + Manual Fallback

**Date:** 2026-05-08  
**Status:** APPROVED  
**Phase:** Phase 4 (Laudo OCR Wave 3.5)  
**Compliance:** RDC 978 Art. 167; LGPD Art. 9; DICQ 4.3  

---

## Problem Statement

Laboratory staff manually enter laudo (result strip) data by typing values from physical strips into the system. This is error-prone, time-consuming, and introduces transcription errors. Current workflow requires 2–5 minutes per strip entry.

**Regulatory Drivers:**
- RDC 978 Art. 167: Result data must be captured accurately and timely
- LGPD Art. 9: Patient image (strip photo) is sensitive biometric data; consent required before processing
- DICQ 4.3: Quality documentation must include result traceability and audit trail
- v1.4 Scope: Enable automated OCR with consent gate + manual fallback

---

## Decision

Implement **Laudo OCR with Gemini Vision API, consent gate, and manual fallback**:

1. **Engine:** Google Gemini 2.5 Vision API (already in use for strip classification)
2. **Consent Gate:** Check `patient-consents/{patientId}` before sending image to Gemini
3. **Capture Model:** Upload strip image → Gemini → parse result values → populate form (patient can override)
4. **Fallback:** If consent missing OR Gemini fails → show manual entry form (no image sent)
5. **Cache:** Gemini results cached 1h per strip hash (prevent re-processing identical images)
6. **Audit Trail:** Log all OCR decisions (success, consent skip, fallback) to `auditoria` collection

---

## Rationale

### Why Gemini Vision (Not AWS Textract or Local OCR)?

**Decision:** Google Gemini 2.5 Vision API instead of AWS Textract, Tesseract (open-source), or on-device vision.

**Rationale:**
- **Cost:** Gemini per-token pricing (0.075/1k input tokens) vs. Textract per-image ($0.01–0.04/page); same order of magnitude
- **Accuracy:** Gemini trained on medical/lab strips; Textract is generic invoice OCR
- **Latency:** Gemini API ~2s vs. Textract ~3s vs. Tesseract ~5–10s (local)
- **Consistency:** Already in use for strip classification (ADR-0025); single AI provider reduces operational complexity
- **Compliance:** API call logged; audit trail captures AI decision

**Trade-off:** Cloud dependency (no offline mode); acceptable for lab environment (always-online).

**Rejected Alternatives:**
- AWS Textract: Not trained on medical strips; higher error rate
- Tesseract (local): Slow (10–15s), offline but fragile, lower accuracy
- Custom on-device ML: Too expensive to train + maintain (Phase 15+, if ever)

### Why Consent Gate Before Gemini Call?

**Decision:** Check `patient-consents` for 'ocr-processing' scope before sending image to Gemini.

**Rationale:**
- **LGPD Art. 9:** Patient image is sensitive biometric data; explicit consent required before cloud processing
- **Audit:** Consent decision logged (proves consent was checked at time of OCR)
- **Patient Control:** Patient can revoke OCR consent independently from result access
- **Safety:** If patient revoked consent but lab staff tries OCR → explicit error "Consent required" (not silent skip)

**Example Flow:**
```
Lab staff uploads strip image
  ↓
Check: patient-consents[patientId].scope includes 'ocr-processing' && !consentRevoked?
  ↓ YES → Send to Gemini → Parse → Populate form
  ↓ NO → Skip Gemini, show manual entry form + inline consent widget
```

### Why Manual Fallback?

**Decision:** If Gemini fails OR consent missing → show form with empty fields (operator types values).

**Rationale:**
- **Resilience:** Gemini API outage doesn't block result entry (acceptable latency ~5 min longer)
- **Patient Privacy:** Operator can skip OCR entirely (no image sent to cloud)
- **Fallback UX:** Form clearly shows OCR was attempted + reason for fallback ("Consent required" or "API error")
- **Audit:** Fallback reason logged (manual entry is equivalent; no data loss)

**Alternative (Rejected):** If Gemini fails → block result entry until Gemini works again → patient safety risk.

### Why Cache OCR Results?

**Decision:** Cache Gemini response 1h per image hash (SHA-256).

**Rationale:**
- **Cost:** Prevent re-processing identical strips (e.g., staff uploads same strip twice by accident)
- **Latency:** Cache hit is instant (hash lookup + return cached JSON)
- **Compliance:** LGPD audit: prove same image sent to Gemini once (not repeated)
- **Privacy:** Cached result is `{ values: [...] }` (image not cached, only parsed data)

**Cache Key:** `sha256(imageBytes)` → `{ gastoCalor, glicose, ... }` (1h TTL)

### Why Audit All OCR Decisions?

**Decision:** Log every OCR attempt (success, consent skip, failure) to `auditoria` collection.

**Rationale:**
- **DICQ 4.3:** Quality documentation requires result traceability
- **RDC 978 Art. 167:** Result capture method documented (OCR vs. manual)
- **LGPD Audit:** Proof that consent was checked before cloud processing
- **Incident Response:** If Gemini fails → audit log shows when + how many results affected

**Log Entry:**
```typescript
interface OcrAuditEntry {
  laudoId: string;
  patientId: string;
  decision: 'success' | 'consent-required' | 'gemini-error' | 'manual-entry';
  values: { [key: string]: string | number }; // parsed or manually entered
  geminiRequestHash?: string;                   // request token, not full image
  consentStatus?: boolean;                      // was consent active?
  errorMessage?: string;                        // if decision == 'gemini-error'
  criadoEm: Timestamp;
  operatorId: string;
  hmac: string;                                 // ADR-0005 signature
}
```

---

## Implementation

### Service: laudoOcrService.ts

**Public API:**
```typescript
class LaudoOcrService {
  async processLaudoImage(
    imageFile: File,
    patientId: string,
    labId: string
  ): Promise<{
    decision: 'success' | 'consent-required' | 'error';
    values?: Record<string, string | number>;
    errorMessage?: string;
    cacheHit?: boolean;
  }>;
}
```

**Algorithm:**
```
1. Compute SHA256(imageBytes) → imageHash
2. Check cache: get(imageHash)
   → if hit: return cached { values }
3. Query: patient-consents[patientId].records where scope='ocr-processing' && !consentRevoked
   → if missing: return { decision: 'consent-required' }
4. Call Gemini Vision: 
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-vision:generateContent
   payload: { image: imageBytes, prompt: "Extract result values from lab strip" }
5. Parse response: extract { glicose, gastoCalor, ... }
6. Cache result: set(imageHash, values, ttl: 1h)
7. Write audit entry: decision='success', values=parsed, hmac=sign(entry)
8. Return { decision: 'success', values, cacheHit: false }
```

**Error Handling:**
- Gemini timeout (>10s) → fallback to manual entry
- Gemini 403 (quota) → fallback + alert admin
- Gemini invalid image → fallback + show error "Could not read image; try again or enter manually"

### Hook: useLaudoOcr()

**State Machine:**
```
idle
  ↓
  user clicks "Upload image"
  ↓
loading (show spinner + "Checking consent...")
  ↓
  decision === 'consent-required'?
    ↓ YES → show ConsentWidget + manual form
    ↓ NO → call Gemini
  ↓
  Gemini response?
    ↓ success → display parsed values in form
    ↓ error → show error message + manual form
  ↓
success (or fallback_with_manual_entry)
```

**Usage:**
```typescript
const { state, decision, values, error, uploadImage, skipOcr } = useLaudoOcr();

return (
  <div>
    {state === 'idle' && <input type="file" onChange={e => uploadImage(e.target.files[0])} />}
    {state === 'loading' && <Skeleton />}
    {decision === 'success' && <ResultForm defaultValues={values} />}
    {decision === 'consent-required' && <ConsentWidget onConsent={...} />}
    {decision === 'error' && <ErrorState onRetry={...} />}
  </div>
);
```

### Cloud Function Callable: ocr_processLaudo()

**Input:**
```typescript
interface OcrRequest {
  laudoId: string;
  patientId: string;
  imageBase64: string;                    // base64-encoded strip image
}
```

**Output:**
```typescript
interface OcrResponse {
  decision: 'success' | 'consent-required' | 'error';
  values?: Record<string, string | number>;
  errorMessage?: string;
  auditEntryId: string;
}
```

**Server-Side Logic:**
1. Validate: request.auth.uid is operator in lab, request.auth.token.role in ['op', 'rt', 'admin']
2. Decode: base64 → bytes
3. Call: LaudoOcrService.processLaudoImage()
4. Write: Audit entry to `auditoria/{labId}/logs`
5. Return: Decision + values (or error)

### UI Components

**OcrUploadWidget.tsx**
```tsx
export function OcrUploadWidget({ patientId, onSuccess }) {
  const { state, uploadImage, values, error, decision } = useLaudoOcr();
  
  return (
    <div className="border-2 border-dashed rounded p-4">
      {state === 'idle' && (
        <input type="file" accept="image/*" onChange={e => uploadImage(e.target.files[0])} />
      )}
      {state === 'loading' && <Skeleton height={120} />}
      {decision === 'success' && (
        <div className="text-emerald-500">
          ✓ Found values: {JSON.stringify(values)}
        </div>
      )}
      {decision === 'consent-required' && (
        <ConsentWidget scope="ocr-processing" onConsent={() => uploadImage(lastFile)} />
      )}
      {decision === 'error' && (
        <div className="text-red-500">
          {error}
          <button onClick={() => uploadImage(lastFile)}>Retry</button>
          <button onClick={() => onSkip()}>Enter manually</button>
        </div>
      )}
    </div>
  );
}
```

**ConsentWidget.tsx**
```tsx
export function ConsentWidget({ scope, onConsent, patientId }) {
  return (
    <div className="bg-blue-50 p-4 rounded">
      <p>To use automatic OCR, we need your permission to process the image.</p>
      <label>
        <input type="checkbox" onChange={e => setConsent(e.target.checked)} />
        I consent to process my strip image for automatic result entry (ADR-0034)
      </label>
      <button onClick={onConsent} disabled={!consent}>
        Grant consent
      </button>
    </div>
  );
}
```

### Rules (Firestore)

**No direct OCR rule needed.** OCR is server-side callable only; rules don't gate image upload (image is binary, not stored in Firestore; sent directly to Gemini).

### Tests (7 unit tests)

1. Gemini API call succeeds → values returned
2. Consent missing → returns 'consent-required' (no Gemini call)
3. Consent revoked → returns 'consent-required'
4. Gemini timeout → fallback to manual entry
5. Cache hit → returns cached values (no Gemini call)
6. Cache miss → calls Gemini, caches result
7. Audit entry created with decision + HMAC signature

---

## Data Flow

```
Lab Staff                  Portal            Cloud Function       Gemini API       Firestore
    |                        |                    |                    |              |
    |-- select image ------->|                    |                    |              |
    |                        |-- uploadImage() -->|                    |              |
    |                        |                    |-- check consent ---<-----.        |
    |                        |                    |                        |          |
    |                        |<--- 'consent-req' -|                        |          |
    |<----- show widget ------|                    |                        |          |
    |                        |                    |                        |          |
    |-- grant consent ------>|-- recordConsent -->|                        |          |
    |                        |                    |-- POST /gemini --------->| (image) |
    |                        |<----- values <-----|<------ { values } ------| (skip)  |
    |<----- populate form ----|                    |                        |          |
    |                        |                    |-- write audit entry ---<-----------|
    |-- submit form -------->|                    |                        |          |
```

---

## Alternatives Considered

### 1. AWS Textract

**Approach:** Use AWS Textract (document OCR service) instead of Gemini Vision.

**Pros:** Industry-standard document OCR, mature API  
**Cons:** Generic invoice/document OCR (not trained on medical strips), higher cost (~$0.04/page), overkill for lab strips  
**Rejected:** Gemini is already in use for classification; reuse reduces complexity.

### 2. Local Tesseract OCR

**Approach:** Run Tesseract on client-side (open-source, no API call).

**Pros:** No cloud dependency, patient image never leaves device, LGPD-friendly  
**Cons:** Slow (10–15s per image), offline fragile, lower accuracy on lab strips  
**Rejected:** 10s latency unacceptable for lab workflow; consent gate achieves same privacy benefit without latency cost.

### 3. No Consent Gate

**Approach:** Always send image to Gemini (no consent check).

**Pros:** Simpler code, one fewer Firestore query  
**Cons:** LGPD violation (Art. 9 requires explicit consent for sensitive data processing), non-compliant  
**Rejected:** Regulatory risk.

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Gemini errors (hallucination) | Medium | Operator can override parsed values; audit trail captures manual override |
| Image confidentiality (sent to Google) | Medium | Consent gate ensures patient knows image is sent; DPIA covers Google as data processor |
| Gemini quota exceeded | Low | Fallback to manual entry; rate-limit callables (max 100 OCR requests/hour per lab) |
| Cache collision (SHA-256) | Very Low | Cryptographically negligible (2^256 space) |

---

## Compliance Mapping

| Standard | Article | Requirement | Implementation |
|----------|---------|-------------|-----------------|
| RDC 978 | Art. 167 | Result capture, timely | Laudo OCR speeds entry (5 min → 30 sec) |
| LGPD | Art. 9 | Consent for sensitive data | Consent check before Gemini call |
| DICQ | 4.3 | Result traceability | Audit log records OCR decision (success/consent-req/error) |

---

## Success Criteria

- [x] Gemini Vision API integration working
- [x] Consent gate blocks OCR when missing
- [x] Manual fallback form shows on consent-required or error
- [x] Audit trail captures all OCR decisions
- [x] Cache prevents re-processing identical images
- [x] 7 unit tests passing
- [x] 2 E2E specs passing (OCR success, consent gate, manual fallback)
- [x] Zero LGPD compliance gaps (consent captured, audit logged)

---

## Dependencies

- **ADR-0025:** Gemini Vision API for strip classification
- **ADR-0033:** Patient consent model (patient-consents collection)
- **Firestore Rules:** Audit trail append-only pattern
- **Cloud Functions:** Node 22+, Google Generative AI SDK, SHA-256 hashing (crypto module)

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| **Architect** | CTO | 2026-05-08 |
| **Compliance** | Security Lead | 2026-05-08 |
| **QA** | Test Lead | 2026-05-08 |

---

## References

- RDC 978 Art. 167: Result capture requirements
- LGPD Art. 9: Explicit consent for sensitive data processing
- DICQ 4.3: Result traceability documentation
- ADR-0025: Gemini Vision classification for RDT strips
- ADR-0033: Patient consent model + portal-paciente
- ADR-0005: HMAC signing for non-repudiation
