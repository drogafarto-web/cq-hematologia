# Wave 3, Agent 5 — Laudo OCR Extraction (RDC 978 Art. 167)

**Phase 6 · Dates: 2026-05-08 — 2026-05-20**

## Objective

Implement OCR extraction of clinical report (laudo) fields 10–12 per RDC 978 Article 167 compliance requirements. Fields extracted:

- **Field 10**: Observações (clinical notes) — REQUIRED
- **Field 11**: RT (Responsável Técnico) signature/stamp — ADVISORY with bounding box detection
- **Field 12**: Lab director signature/stamp + date — ADVISORY with date extraction

Uses **Gemini 2.5 Vision** for automated extraction with **consent gate** (LGPD Art. 9) and **manual fallback** for OCR failures.

---

## Architecture

### Module: `functions/src/modules/laudo-ocr/`

```
laudo-ocr/
├── types.ts                       # Zod schemas (Field10/11/12, extraction result)
├── validators.ts                  # Validation logic (field10 required, field11/12 advisory)
├── laudoOCRExtractor.ts          # Main orchestrator (Gemini Vision call, consent gate)
├── callables/
│   ├── extractLaudoFieldsCallable.ts       # Auto OCR via Gemini
│   └── saveLaudoFieldsManuallyCallable.ts  # Fallback: manual entry by RT/director
├── __tests__/
│   ├── laudoOCRExtractor.test.ts           # 12+ tests
│   └── validators.test.ts                  # Validation + review level tests
└── index.ts                       # Exports
```

### Data Structures

#### LaudoExtractedFields (Firestore)

```typescript
{
  labId: string;
  laudoId: string;
  field10: {
    text: string;                  // Exact observações text
    confidence: 'high' | 'medium' | 'low';
  };
  field11: {
    detected: boolean;             // Signature/stamp found?
    boundingBox?: { x, y, width, height };  // % of image
    confidence?: 'high' | 'medium' | 'low';
    notes?: string;
  };
  field12: {
    detected: boolean;
    dateText?: string;             // Extracted date (ISO 8601)
    boundingBox?: { x, y, width, height };
    confidence?: 'high' | 'medium' | 'low';
    notes?: string;
  };
  source: 'auto' | 'manual';       // Extraction source
  extractedAt: Timestamp;          // Server-side timestamp
  extractedBy: string;             // Operator UID
  status: 'completed' | 'partial' | 'failed';
  geminiLatencyMs?: number;        // Vision API latency (auto only)
  rawGeminiResponse?: Record;      // Full Gemini response for audit
}
```

Stored at: `/laudos/{labId}/extractions/{laudoId}`

---

## Gemini Vision Prompt

```
Você está analisando um laudo clínico (relatório de resultado de laboratório).

EXTRAIR E ANALISAR TRÊS CAMPOS:

**Campo 10 — Observações (Texto livre)**
- Copie exatamente o texto da seção "Observações" ou "Notas Clínicas"
- Este campo é obrigatório
- Confiança: high | medium | low

**Campo 11 — Assinatura/Carimbo do Responsável Técnico (RT)**
- Detectar presença de assinatura OU carimbo
- Se presente: fornecer bounding box [x_min, y_min, width, height] como percentuais (0–100)
- Se ausente: detected=false
- Confiança: high | medium | low

**Campo 12 — Assinatura/Carimbo do Diretor do Lab + Data**
- Detectar presença de assinatura OU carimbo
- Se presente: extrair data visível (se houver)
- Se presente: fornecer bounding box [x_min, y_min, width, height] como percentuais (0–100)
- Se ausente: detected=false
- Confiança: high | medium | low

RETORNE JSON VÁLIDO (sem markdown):

{
  "field10": {
    "text": "...",
    "confidence": "high|medium|low"
  },
  "field11": {
    "detected": true|false,
    "boundingBox": { "x": 0–100, "y": 0–100, "width": 0–100, "height": 0–100 },
    "confidence": "high|medium|low",
    "notes": "..."
  },
  "field12": {
    "detected": true|false,
    "dateText": "data extraída (ISO 8601) ou null",
    "boundingBox": { "x": 0–100, "y": 0–100, "width": 0–100, "height": 0–100 },
    "confidence": "high|medium|low",
    "notes": "..."
  },
  "overallConfidence": "high|medium|low",
  "remarks": "..."
}
```

---

## Cloud Function Callables

### 1. `extractLaudoFieldsCallable`

**Input:**
```typescript
{
  labId: string;
  laudoId: string;
  storageUrl: string;              // Signed Cloud Storage URL to laudo PDF/image
  patientId?: string;              // Optional: for consent validation
}
```

**Flow:**
1. Auth check (user must be authenticated)
2. Verify lab membership (RT/admin role required)
3. Fetch laudo doc from Firestore
4. Call `extractLaudoFields()` orchestrator:
   - Consent gate if patientId provided (LGPD Art. 9)
   - Gemini Vision API call
   - Schema validation
5. Store extraction in `/laudos/{labId}/extractions/{laudoId}`
6. Update laudo doc with OCR metadata
7. Audit log with action='laudo-ocr-extraction-complete'

**Output (success):**
```typescript
{
  ok: true;
  extraction: LaudoExtractedFields;
  message: string;
}
```

**Output (failure):**
```typescript
{
  ok: false;
  error: string;
  code: 'vision_failed' | 'consent_failed' | 'validation_failed' | 'not_found' | 'unauthorized';
  allowManualEntry: true;          // Always true — RT can enter manually
}
```

---

### 2. `saveLaudoFieldsManuallyCallable`

**Input:**
```typescript
{
  labId: string;
  laudoId: string;
  field10Text: string;             // Required
  field11CapturedBy?: string;      // RT/Director UID (optional)
  field12CapturedBy?: string;      // Director UID (optional)
  field11Notes?: string;
  field12Notes?: string;
  field12Date?: string;            // ISO 8601 date
}
```

**Flow:**
1. Auth check
2. Verify lab membership (RT/admin role required)
3. Fetch laudo doc
4. Validate field10 is non-empty
5. Construct extraction with source='manual'
6. Store in `/laudos/{labId}/extractions/{laudoId}`
7. Update laudo doc with manual entry metadata
8. Audit log with action='laudo-fields-manual-entry'

**Output (success):**
```typescript
{
  ok: true;
  extraction: LaudoExtractedFields;
  message: string;
}
```

**Output (failure):**
```typescript
{
  ok: false;
  error: string;
}
```

---

## Firestore Rules (Proposed)

### Collection: `/laudos/{labId}/extractions/{laudoId}`

```firestore
match /laudos/{labId}/extractions/{laudoId} {
  // Read: RT, auditor, director
  allow read: if isActiveMemberOfLab(labId) &&
              (request.auth.token.role in ['RT', 'AUDITOR', 'director']);
  
  // Create: Cloud Function only
  allow create: if false;
  
  // Update: Cloud Function only
  allow update: if false;
  
  // Delete: never (soft-delete only)
  allow delete: if false;
}
```

---

## Firestore Indexes (Proposed)

### 1. `/laudos/{labId}/extractions` by extractedAt

```yaml
- collection: laudos/{labId}/extractions
  fields:
    - field: extractedAt
      direction: DESCENDING
```

**Purpose:** Auditor/director queries extraction history for a lab.

### 2. `/laudos/{labId}/extractions` by source + status

```yaml
- collection: laudos/{labId}/extractions
  fields:
    - field: source
      direction: ASCENDING
    - field: status
      direction: ASCENDING
```

**Purpose:** Separate auto vs manual extractions; report on failed extractions.

---

## Validation Rules

### Field 10 (Observações) — REQUIRED

- ✅ Non-empty after trim
- ❌ Fails extraction if empty
- **RDC 978 Art. 167** mandates clinical notes in every report

### Field 11 (RT Signature) — ADVISORY

- ⚠️ Warning if `detected=false` (but extraction still passes)
- ⚠️ Warning if `detected=true` but no `boundingBox` provided
- Allows manual entry fallback

### Field 12 (Director Signature + Date) — ADVISORY

- ⚠️ Warning if `detected=false`
- ⚠️ Warning if `detected=true` but no `dateText` extracted
- Allows manual entry fallback

### Review Level

- **auto**: All fields high confidence + all signatures detected → no manual review needed
- **manual-review**: Any advisory warning OR field10 empty → escalate to RT/director

---

## Consent Gate (LGPD Art. 9)

**Before Gemini Vision call**, if `patientId` provided:

```typescript
const consent = await consentGate({ labId, patientId });
// Throws HttpsError('failed-precondition', 'consent-not-captured') if:
// - consent doc does not exist
// - iaProcessing !== true
// - revokedAt !== null (revoked)
```

Ensures patient explicitly opted into AI processing of their clinical data.

---

## Audit Trail

### Action: `laudo-ocr-extracted` (auto)

```typescript
{
  action: 'laudo-ocr-extracted';
  labId: string;
  laudoId: string;
  operatorId: string;
  source: 'auto';
  geminiLatencyMs: number;
  field10_confidence: 'high' | 'medium' | 'low';
  field11_detected: boolean;
  field12_detected: boolean;
  timestamp: Timestamp;
}
```

### Action: `laudo-fields-manual-entry` (manual)

```typescript
{
  action: 'laudo-fields-manual-entry';
  labId: string;
  laudoId: string;
  operatorId: string;
  field11CapturedBy: string | null;  // Who entered field11
  field12CapturedBy: string | null;  // Who entered field12
  source: 'manual';
  warnings: string[];               // Advisory warnings (if any)
  timestamp: Timestamp;
}
```

---

## Tests (Minimum 12)

| Test | Coverage |
|------|----------|
| Happy path: extract field10/11/12 | Gemini integration |
| Field10 required; field11/12 advisory | Validation rules |
| Consent gate passes (patient has consent) | LGPD compliance |
| Consent gate fails (no consent) | Error handling |
| Signature detection with bounding box | Field11 detection |
| Director signature + date extraction | Field12 detection |
| Manual field entry from RT | Fallback path |
| Validator: field10 empty → fail | Validation |
| Validator: signatures not detected → warning | Validation |
| Review level: auto vs manual-review | Review logic |
| Audit log on extraction | Audit trail |
| Audit log on manual entry | Audit trail |

---

## Deployment Order

### Phase 6 Step 1: Rules + Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
```

### Phase 6 Step 2: Functions

```bash
bash scripts/preflight-secrets-check.sh  # Mandatory pre-flight check
cd functions && npm run build
firebase deploy --only functions:extractLaudoFieldsCallable --project hmatologia2
firebase deploy --only functions:saveLaudoFieldsManuallyCallable --project hmatologia2
```

### Phase 6 Step 3: Update Function Index

Add to `functions/src/index.ts`:
```typescript
export {
  extractLaudoFieldsCallable,
  saveLaudoFieldsManuallyCallable,
} from './modules/laudo-ocr';
```

### Phase 6 Step 4: Hosting

```bash
npm run build
firebase deploy --only hosting --project hmatologia2
```

---

## Compliance Mapping

| Requirement | Implementation |
|---|---|
| **RDC 978 Art. 167** — Laudo field integrity | Field extraction + audit trail |
| **RDC 978 Art. 167** — Signatory verification | Signature detection (field11/12) |
| **LGPD Art. 9** — PII in AI processing | Consent gate before Gemini call |
| **DICQ 4.3** — Versioned, signed, traceable | Extraction logged in auditLogs |
| **DICQ 4.4** — Audit trail | action='laudo-ocr-extracted' + manual fallback log |

---

## Manual Entry SOP (When OCR Fails)

1. **RT receives** extraction failure notification
2. **RT opens** laudo PDF alongside portal
3. **RT enters** field10 text manually (REQUIRED)
4. **RT checks** signature/stamp visually:
   - If RT signature visible → mark field11 with notes
   - If Director signature + date visible → mark field12 with date
5. **RT saves** via `saveLaudoFieldsManuallyCallable`
6. **Audit log** captures manual entry with field11CapturedBy/field12CapturedBy UIDs
7. **Director reviews** if needed (advisory workflow)

---

## Non-Deliverables (Future)

- Bounding-box visualization in Portal-RT UI (can be Phase 7 feature)
- Cryptographic signature verification (detection only, not validation)
- PDF to image conversion (assumes signed URL points to image or pre-converted)
- Multi-language prompt variants (Portuguese only for this release)

---

## Gemini API Costs

**Per extraction:**
- Input tokens: ~500–800 (image + prompt)
- Output tokens: ~100–200 (JSON response)
- Estimated cost: ~$0.001–0.003 USD per call

**Scaling (1,000 laudos/month):**
- Estimated monthly cost: $1–3 USD (negligible)
- Cost tracking: recorded in auditLogs with `geminiLatencyMs` for analysis

---

## Known Limitations

1. **Image quality**: OCR accuracy degrades with poor scans/old paper
2. **Language**: Portuguese prompts only (regional labs may need translation)
3. **PDF handling**: Signed URLs must point to images or pre-converted images (not raw PDFs)
4. **Signature complexity**: Faint/smudged signatures may not detect (manual entry required)

---

## Success Criteria

- ✅ Field 10 extraction with ≥90% accuracy on test set
- ✅ Field 11/12 signature detection working (bounding boxes)
- ✅ Manual fallback path clear + RT tested
- ✅ Consent gate functional (patient consent verified before OCR)
- ✅ Audit trail complete (all extractions logged)
- ✅ 12+ tests passing
- ✅ Firestore rules deployed without blocking access
- ✅ Zero audit trail losses (writeAuditLog retries)

---

## Commit Message

```
feat(laudo-ocr): Phase 6 Art. 167 OCR extraction fields 10–12 (W3-5)

- Gemini 2.5 Vision integration for clinical report field extraction
- Field 10 (Observações) required; fields 11–12 (signatures) advisory
- Consent gate (LGPD Art. 9) before API call
- Manual entry fallback for OCR failures
- 12+ tests; full audit trail; Firestore rules + indexes
- Deployment: rules → functions → hosting
```
