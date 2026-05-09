---
phase: v1.4-final-closure
macro_phase: MP-5a
label: Bioquímica Phase 2 — Westgard CLSI 8 + Gemini OCR + Z-score interlaboratorial
type: execute
model: haiku
escalation_model: sonnet
depends_on: ["MP-4"]
parallel_with: ["MP-5b", "MP-5c"]
autonomous: true
human_gates: 0
total_subagents: 22
total_waves: 7
estimated_runtime: 4h
---

# MP-5a — Bioquímica Phase 2 (22 SAs across 7 waves)

**Goal:** Extend the live `bioquimica` module (in prod since 2026-05-07) with full CLSI 8-rule Westgard engine, Gemini Vision OCR for analyte strip results, and z-score interlaboratorial comparison. Acceptance engine binds Westgard + z-score into a single pass/warn/fail decision per run.

**Module canonical paths:** `src/features/bioquimica/{types,services,hooks,components}` and `functions/src/modules/bioquimica/`.

**Compliance hooks:** RDC 978/2025 Arts. 179–183 · DICQ 4.3 Bloco F (5.5.1, 5.6.2, 5.6.3.1, 5.6.4) · CLSI EP15 + Westgard Multirule 1981 · LGPD Art. 9 (gate de consentimento OCR).

**Wave dependency graph:**
```
W0 (types + seeds)             4 SAs ‖
  └─> W1 (engines)              4 SAs ‖
        └─> W2 (gemini + accept) 3 SAs ‖
              └─> W3 (hooks + UI) 3 SAs ‖
                    └─> W4 (CF + docs) 2 SAs ‖
                          └─> W5 (tests) 5 SAs ‖
                                └─> W6 (verification gate) 1 SA
```

**Existing canonical files to read:**
- `src/features/bioquimica/types/westgard.ts` — current 4-rule subset (subset CLSI). Must NOT delete; extend.
- `src/features/bioquimica/types/_shared_refs.ts` — `AnalitoId`, `NivelId`.
- `src/features/bioquimica/services/bioquimicaService.ts` — thin-service pattern reference.
- `src/features/bioquimica/hooks/useAcceptanceEngine.ts` — current acceptance hook, will be re-exported with new engine.
- `functions/src/modules/bioquimica/seedBioquimicaDefaults.ts` — current 17-analyte seed; expanded seed in W0 SA-45.
- `src/features/bioquimica/CLAUDE.md` — module-local invariants.
- `./CLAUDE.md` — global invariants.

---

## Wave 9b-W0 — Foundation Types + Seeds (4 SAs ‖)

deps: nothing. All 4 SAs dispatch simultaneously.

---

### SA-43 — `src/features/bioquimica/types/analitoExpansion.ts`

Type extensions for the analyte catalog. Zero logic — types only.

**Exports obrigatórios:**

```typescript
import type { AnalitoId } from './_shared_refs';

export type AnalitoCategory =
  | 'enzimologia'      // ALT, AST, GGT, ALP, CK, LDH, amilase, lipase
  | 'lipidograma'      // colesterol total, HDL, LDL, triglicerídeos
  | 'glicemia'         // glicose jejum, hemoglobina-glicada
  | 'função-renal'     // ureia, creatinina, ácido-úrico
  | 'função-hepática'  // bilirrubinas, albumina, proteínas-totais
  | 'eletrólitos'      // sódio, potássio, cloreto, cálcio, fósforo, magnésio
  | 'hormonal'         // TSH, T4-livre, cortisol, ferritina, vitamina-B12, vitamina-D
  | 'cardíaco'         // troponina-I, CK-MB, mioglobina, NT-proBNP
  | 'inflamação'       // PCR, VHS
  | 'metabolismo-ósseo'; // fosfatase-alcalina, vitamina-D, PTH

export interface AnalitoExpandedMetadata {
  id: AnalitoId;
  category: AnalitoCategory;
  unit: string;            // 'mg/dL' | 'U/L' | 'ng/mL' | etc — string livre, validada server-side
  refRangeLow: number;
  refRangeHigh: number;
  refRangeUnit: 'adult-male' | 'adult-female' | 'pediatric' | 'unisex';
  expectedMethods: string[]; // canonical methods e.g. ['enzymatic-uv', 'colorimetric-photometric']
  alternativeNames: string[]; // fuzzy match aliases — e.g. ['ALT', 'TGP', 'alanina-aminotransferase']
  loincCode?: string;        // optional LOINC for interlab comparison
}

export const ANALITO_CATEGORIES: readonly AnalitoCategory[];

export function isExpandedAnalito(id: string): boolean;
```

**Invariantes:**
- 0 lógica de negócio — apenas tipos + 1 helper puro `isExpandedAnalito` (consulta lista hardcoded).
- Sem imports externos.
- `ANALITO_CATEGORIES` é `as const`.

**Files to read:** `src/features/bioquimica/types/_shared_refs.ts`, `src/features/bioquimica/types/analito.ts`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W0-SA-43): add analyte expansion types`

---

### SA-44 — `src/features/bioquimica/types/westgardCLSI.ts`

Full CLSI Multirule 1981 type definitions. Replaces the legacy 4-rule subset by extending it.

**Exports obrigatórios:**

```typescript
export type WestgardRuleCLSI8 =
  | '1-3s'   // 1 result > ±3 SD → reject
  | '2-2s'   // 2 consecutive same-side > ±2 SD → reject
  | 'R-4s'   // range between 2 consecutive runs > 4 SD → reject
  | '4-1s'   // 4 consecutive results > ±1 SD same side → reject
  | '10x'    // 10 consecutive same-side from mean → reject
  | '7T'     // 7 consecutive trending up or down → reject
  | '8x'     // 8 consecutive same-side from mean → warn
  | '12x';   // 12 consecutive same-side from mean → warn

export type WestgardSeverityCLSI8 = 'warn' | 'reject';

export interface WestgardObservation {
  runId: string;
  analitoId: string;
  equipmentId: string;
  nivelId: string;
  value: number;
  mean: number;
  sd: number;
  zScore: number;     // (value - mean) / sd
  ts: number;
}

export interface WestgardViolationCLSI8 {
  rule: WestgardRuleCLSI8;
  severity: WestgardSeverityCLSI8;
  detectedAt: number;
  windowRuns: string[];   // runIds participating in the violation window
  description: string;    // human-readable, e.g. "1 result at +3.2 SD (rule 1-3s)"
}

export interface WestgardRuleConfigCLSI8 {
  rule: WestgardRuleCLSI8;
  enabled: boolean;
  severity: WestgardSeverityCLSI8;
}

export const CLSI8_DEFAULTS: Record<WestgardRuleCLSI8, WestgardSeverityCLSI8>;

export function isRejectRule(rule: WestgardRuleCLSI8): boolean;
```

**Invariantes:**
- `CLSI8_DEFAULTS` segue tabela CLSI EP15: `1-3s`, `2-2s`, `R-4s`, `4-1s`, `10x`, `7T` → reject; `8x`, `12x` → warn.
- 0 lógica de detecção (vai para `westgardEngine.ts` em W1).
- Sem imports além do próprio `_shared_refs` se necessário.

**Files to read:** `src/features/bioquimica/types/westgard.ts` (legacy subset to extend, not break).

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W0-SA-44): add full CLSI 8-rule Westgard types`

---

### SA-45 — `functions/src/seeds/analitosBioquimicaExpanded.json`

Expanded seed dataset with 50+ analytes covering 10 categories.

**Schema (each entry):**

```json
{
  "id": "alanina-aminotransferase",
  "category": "enzimologia",
  "unit": "U/L",
  "refRangeLow": 7,
  "refRangeHigh": 56,
  "refRangeUnit": "adult-male",
  "expectedMethods": ["enzymatic-uv", "ifcc-37c"],
  "alternativeNames": ["ALT", "TGP", "alanina-aminotransferase", "alanina aminotransferase"],
  "loincCode": "1742-6"
}
```

**Coverage required (50+ entries):**
- Enzimologia (8): ALT, AST, GGT, ALP, CK, LDH, amilase, lipase
- Lipidograma (4): colesterol-total, HDL, LDL, triglicerídeos
- Glicemia (2): glicose-jejum, hemoglobina-glicada
- Função renal (3): ureia, creatinina, ácido-úrico
- Função hepática (4): bilirrubina-total, bilirrubina-direta, albumina, proteínas-totais
- Eletrólitos (6): sódio, potássio, cloreto, cálcio, fósforo, magnésio
- Hormonal (6): TSH, T4-livre, cortisol, ferritina, vitamina-B12, vitamina-D
- Cardíaco (4): troponina-I, CK-MB, mioglobina, NT-proBNP
- Inflamação (2): PCR, VHS
- Metabolismo ósseo (2): fosfatase-alcalina, PTH

**Invariantes:**
- File is pure JSON (no comments, no trailing commas).
- Each entry validates against `AnalitoExpandedMetadata` (will be enforced by SA-58 sanity test).
- `alternativeNames` MUST contain the canonical Portuguese name + standard 2-4 char abbreviations (ALT, TSH, etc).
- `loincCode` optional but recommended for top 20 most-common.

**Verify:** `node -e "JSON.parse(require('fs').readFileSync('functions/src/seeds/analitosBioquimicaExpanded.json', 'utf8'))" && python -c "import json; d=json.load(open('functions/src/seeds/analitosBioquimicaExpanded.json')); assert len(d) >= 50, len(d)"`

**Commit:** `feat(MP-5a-W0-SA-45): seed 50+ expanded analyte catalog`

---

### SA-46 — `src/features/bioquimica/types/ocrResults.ts`

Types for Gemini Vision OCR parsing pipeline. Zero logic.

**Exports obrigatórios:**

```typescript
import type { AnalitoId } from './_shared_refs';

export type OCRConfidence = 'high' | 'medium' | 'low';  // ≥0.85 / 0.6–0.85 / <0.6

export interface OCRParsedAnalyte {
  rawName: string;            // exatamente como apareceu no laudo OCR
  matchedAnalitoId?: AnalitoId; // post fuzzy-match (SA-49)
  matchConfidence: OCRConfidence;
  rawValue: string;           // e.g. "84.3" or "<0.01"
  parsedValue?: number;       // post numeric parse; undefined se não numérico
  rawUnit?: string;           // e.g. "U/L"
  unitMatched: boolean;
}

export interface OCRParsedResult {
  imageStoragePath: string;
  imageHash: string;          // SHA-256 (64 hex)
  parsedAt: number;
  geminiModel: 'gemini-2.5-flash' | 'gemini-2.0-flash';
  rawText: string;            // full OCR text (may be redacted before storage)
  analytes: OCRParsedAnalyte[];
  overallConfidence: OCRConfidence;
  warnings: string[];         // e.g. "image rotated 90°", "partial occlusion bottom-left"
}

export interface OCRValidationReport {
  parsedResultId: string;
  expectedAnalytes: AnalitoId[];   // analytes the run is configured for
  matched: AnalitoId[];
  unmatched: AnalitoId[];          // expected but missing in OCR
  unexpected: string[];            // OCR found names not in expected set
  validationSeverity: 'accept' | 'review' | 'reject';
}
```

**Invariantes:**
- 0 lógica.
- Sem imports externos além de `_shared_refs`.

**Files to read:** `src/features/bioquimica/types/_shared_refs.ts`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W0-SA-46): add OCR result types`

---

## Wave 9b-W1 — Westgard Engine + Fuzzy Match + Z-score (4 SAs ‖)

deps: W0 (types). All 4 SAs dispatch simultaneously.

---

### SA-47 — `src/features/bioquimica/services/westgardEngine.ts`

Pure-function CLSI 8-rule engine. Client-side preview only — server-side parallel impl in SA-48 is the source of truth (per RN T5 in module CLAUDE.md).

**Exports obrigatórios:**

```typescript
import type {
  WestgardObservation,
  WestgardViolationCLSI8,
  WestgardRuleCLSI8,
  WestgardRuleConfigCLSI8,
} from '../types/westgardCLSI';

export interface WestgardEngineInput {
  windowObservations: WestgardObservation[];  // ordered by ts ASC, oldest first
  rulesConfig: WestgardRuleConfigCLSI8[];
}

export interface WestgardEngineOutput {
  violations: WestgardViolationCLSI8[];
  rejectCount: number;
  warnCount: number;
}

export function detectWestgardViolations(input: WestgardEngineInput): WestgardEngineOutput;

// Per-rule detectors (named exports for unit testing)
export function detect_1_3s(obs: WestgardObservation[]): WestgardViolationCLSI8[];
export function detect_2_2s(obs: WestgardObservation[]): WestgardViolationCLSI8[];
export function detect_R_4s(obs: WestgardObservation[]): WestgardViolationCLSI8[];
export function detect_4_1s(obs: WestgardObservation[]): WestgardViolationCLSI8[];
export function detect_10x(obs: WestgardObservation[]): WestgardViolationCLSI8[];
export function detect_7T(obs: WestgardObservation[]): WestgardViolationCLSI8[];
export function detect_8x(obs: WestgardObservation[]): WestgardViolationCLSI8[];
export function detect_12x(obs: WestgardObservation[]): WestgardViolationCLSI8[];
```

**Invariantes (CLSI EP15 conformant):**
- `detect_1_3s`: any obs with `|zScore| > 3` triggers reject.
- `detect_2_2s`: 2 consecutive same-side `|zScore| > 2` (both > +2 OR both < -2). Window = 2.
- `detect_R_4s`: pair where `(max(z) - min(z)) > 4` and signs differ. Window = 2.
- `detect_4_1s`: 4 consecutive same-side `|zScore| > 1`. Window = 4.
- `detect_10x`: 10 consecutive same-side from mean (`zScore > 0` or `< 0`, ignoring magnitude). Window = 10.
- `detect_7T`: 7 consecutive monotonic trend (strictly inc or dec zScore). Window = 7.
- `detect_8x`, `detect_12x`: same as `10x` with windows 8 and 12 respectively, severity `warn`.
- Pure functions — no side effects, no Date.now() calls (use `obs[i].ts`).
- Disabled rules in `rulesConfig` skipped silently.
- Per analyte/equipment/level grouping is the CALLER's job; this fn assumes single group input.

**Files to read:** `src/features/bioquimica/types/westgardCLSI.ts` (W0 SA-44), `src/features/bioquimica/types/westgard.ts` (legacy reference).

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W1-SA-47): implement client-side CLSI 8-rule Westgard engine`

---

### SA-48 — `functions/src/modules/bioquimica/serverWestgardEngine.ts`

Server-side parallel implementation. Authoritative — server result wins per Threat T5.

**Exports obrigatórios:**

```typescript
import type {
  WestgardObservation,
  WestgardViolationCLSI8,
  WestgardRuleConfigCLSI8,
} from '../../../../src/features/bioquimica/types/westgardCLSI';

export interface ServerWestgardInput {
  labId: string;
  analitoId: string;
  equipmentId: string;
  nivelId: string;
  newObservation: WestgardObservation;
  windowSize?: number;  // default 12 (max needed for 12x rule)
}

export interface ServerWestgardOutput {
  violations: WestgardViolationCLSI8[];
  finalStatus: 'pass' | 'warn' | 'reject';
  appliedRules: WestgardRuleConfigCLSI8[];
}

export async function evaluateWestgardServer(
  db: FirebaseFirestore.Firestore,
  input: ServerWestgardInput
): Promise<ServerWestgardOutput>;
```

**Invariantes:**
- Lê últimos `windowSize` observations de `labs/{labId}/bioquimica/root/runs` filtrados por `analitoId + equipmentId + nivelId` ordenados `ts DESC`, depois reverte para ASC.
- Lê `rulesConfig` de `labs/{labId}/bioquimica/root/config/{singleton}` (default ativa todas as 8 regras CLSI).
- Reusa lógica de detecção via duplicate-port (não importa de `src/` no functions runtime — copiar funções puras do SA-47 inline ou via shared `functions/src/shared/westgardCLSIShared.ts` se já criado em outra wave).
- `finalStatus = 'reject'` se qualquer violation severity === 'reject'; senão `'warn'` se qualquer 'warn'; senão `'pass'`.
- Logar `console.log(JSON.stringify({ event: 'westgard_evaluated', labId, analitoId, equipmentId, nivelId, status, violationsCount }))`.

**Files to read:** `src/features/bioquimica/services/westgardEngine.ts` (W1 SA-47 — port pure functions), `functions/src/modules/bioquimica/seedBioquimicaDefaults.ts`.

**Verify:** `cd functions && npm run build 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W1-SA-48): server-side authoritative Westgard CLSI 8-rule engine`

---

### SA-49 — `src/features/bioquimica/services/fuzzyAnalyteMatch.ts`

Fuzzy-match OCR-extracted analyte names to canonical `AnalitoId` via Levenshtein + alias table.

**Exports obrigatórios:**

```typescript
import type { AnalitoId } from '../types/_shared_refs';
import type { OCRConfidence } from '../types/ocrResults';
import type { AnalitoExpandedMetadata } from '../types/analitoExpansion';

export interface FuzzyMatchResult {
  matchedId?: AnalitoId;
  confidence: OCRConfidence;
  matchedVia: 'exact' | 'alias' | 'levenshtein' | 'none';
  distance?: number;  // Levenshtein distance if used
}

export function fuzzyMatchAnalyte(
  rawName: string,
  catalog: AnalitoExpandedMetadata[]
): FuzzyMatchResult;

export function levenshteinDistance(a: string, b: string): number;
export function normalizeAnalyteName(s: string): string;  // lowercase, strip accents, collapse spaces
```

**Invariantes:**
- `normalizeAnalyteName`: lowercase, NFKD diacritic strip, collapse whitespace, trim, replace `[/\-_]` with space.
- Matching tier order:
  1. Exact match against `catalog[i].id` after normalize → `confidence: 'high'`, `matchedVia: 'exact'`.
  2. Exact match against any `alternativeNames[]` entry after normalize → `'high'`, `'alias'`.
  3. Levenshtein distance ≤ 2 against id or any alias → `'medium'` if distance ≤ 1, `'low'` if 2; `matchedVia: 'levenshtein'`.
  4. Else `matchedId: undefined`, `confidence: 'low'`, `matchedVia: 'none'`.
- Pure functions — no I/O, no Firestore reads.

**Files to read:** `src/features/bioquimica/types/analitoExpansion.ts` (W0 SA-43), `src/features/bioquimica/types/ocrResults.ts` (W0 SA-46).

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W1-SA-49): fuzzy analyte name matching service`

---

### SA-50 — `src/features/bioquimica/services/zscoreCalculator.ts`

Interlaboratorial z-score calculation aligned with CEQ comparison rounds.

**Exports obrigatórios:**

```typescript
import type { AnalitoId } from '../types/_shared_refs';

export interface InterlabPeerStats {
  analitoId: AnalitoId;
  peerCount: number;
  peerMean: number;
  peerSD: number;       // group SD across peer labs
  cycleId: string;      // e.g. "2026-Q2"
  source: 'ceq-provider' | 'internal-aggregate';
}

export interface InterlabZScoreInput {
  labResultValue: number;
  peerStats: InterlabPeerStats;
}

export interface InterlabZScoreOutput {
  zScore: number;
  classification: 'satisfactory' | 'questionable' | 'unsatisfactory';
  // CLSI EP15: |z| ≤ 2 satisfactory, 2 < |z| ≤ 3 questionable, |z| > 3 unsatisfactory
}

export function calculateInterlabZScore(input: InterlabZScoreInput): InterlabZScoreOutput;
export function aggregatePeerStats(values: number[], cycleId: string, analitoId: AnalitoId): InterlabPeerStats;
```

**Invariantes:**
- `calculateInterlabZScore`: `z = (labResultValue - peerMean) / peerSD`. Lança `Error('peerSD must be > 0')` se `peerSD <= 0`.
- Classification: `|z| ≤ 2` → `'satisfactory'`; `|z| ≤ 3` → `'questionable'`; else `'unsatisfactory'`.
- `aggregatePeerStats`: rejeita arrays com `length < 5` (lança `Error('insufficient peer count: minimum 5')`); calcula mean + sample SD (n-1).
- Pure functions, no I/O.

**Files to read:** `src/features/bioquimica/types/_shared_refs.ts`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W1-SA-50): interlaboratorial z-score calculator`

---

## Wave 9b-W2 — Gemini Vision Service + OCR Validation + Acceptance (3 SAs ‖)

deps: W0 + W1. All 3 SAs dispatch simultaneously.

---

### SA-51 — `functions/src/modules/bioquimica/geminiVisionService.ts`

Callable v2 wrapping Gemini 2.5 Flash for analyte strip OCR. Region `southamerica-east1`, `cors:true`.

**Exports obrigatórios:**

```typescript
import { onCall } from 'firebase-functions/v2/https';
import type { OCRParsedResult } from '../../../../src/features/bioquimica/types/ocrResults';

export const parseAnalyteStripImage: ReturnType<typeof onCall>;

// Internal helper exported for testing
export async function callGeminiVision(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<{ rawText: string; warnings: string[] }>;
```

**Input shape:** `{ labId: string; imageStoragePath: string; expectedAnalytes: string[]; consentToken: string }`
**Output shape:** `OCRParsedResult` (W0 SA-46)

**Invariantes:**
- `onCall({ region: 'southamerica-east1', cors: true, secrets: ['GEMINI_API_KEY'], memory: '512MiB', timeoutSeconds: 120 })`.
- Auth required: rejeita `unauthenticated` se `!request.auth`.
- `isActiveMemberOfLab(labId)` mandatory (RT/admin/operator role).
- **LGPD gate:** `consentToken` obrigatório — verificar em `labs/{labId}/lgpd/consents/{patientId}` antes de processar (Threat: PII leak via OCR text). Se ausente, rejeitar `permission-denied`.
- Image SHA-256 calculado e devolvido em `imageHash`.
- Gemini prompt template: extract analyte name, value, unit. JSON output schema enforced via `responseSchema`.
- `geminiModel: 'gemini-2.5-flash'` hardcoded.
- Logar `console.log(JSON.stringify({ event: 'gemini_ocr_parsed', labId, imageHash, analytesCount, overallConfidence }))` — NUNCA logar `rawText` (PII).
- Stub-mode quando `process.env.GEMINI_API_KEY === 'STUB'`: retorna fixture predefinida (para testes E2E).

**Files to read:** `functions/src/modules/bioquimica/seedBioquimicaDefaults.ts`, `src/features/bioquimica/types/ocrResults.ts`, `./CLAUDE.md`, `.claude/rules/firestore-security.md`.

**Verify:** `cd functions && npm run build 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W2-SA-51): Gemini Vision callable for analyte OCR`

---

### SA-52 — `src/features/bioquimica/services/ocrValidationService.ts`

Validate Gemini OCR output against expected analytes for the current run.

**Exports obrigatórios:**

```typescript
import type { OCRParsedResult, OCRValidationReport } from '../types/ocrResults';
import type { AnalitoId } from '../types/_shared_refs';
import type { AnalitoExpandedMetadata } from '../types/analitoExpansion';

export function validateOCRResult(args: {
  parsed: OCRParsedResult;
  expectedAnalytes: AnalitoId[];
  catalog: AnalitoExpandedMetadata[];
}): OCRValidationReport;
```

**Invariantes:**
- Para cada `expectedAnalytes[i]`: verificar se existe `parsed.analytes[j].matchedAnalitoId === expectedAnalytes[i]` com `matchConfidence !== 'low'`.
- `unmatched` = expected sem match high/medium.
- `unexpected` = analytes parseados com `matchedAnalitoId` fora de `expectedAnalytes`.
- `validationSeverity`:
  - `unmatched.length === 0 && parsed.overallConfidence === 'high'` → `'accept'`
  - `unmatched.length <= 2 && parsed.overallConfidence !== 'low'` → `'review'`
  - else → `'reject'`
- Pure function — no I/O.

**Files to read:** `src/features/bioquimica/types/ocrResults.ts` (W0 SA-46), `src/features/bioquimica/services/fuzzyAnalyteMatch.ts` (W1 SA-49).

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W2-SA-52): OCR validation service`

---

### SA-53 — `src/features/bioquimica/services/acceptanceEngine.ts`

Combined acceptance decision engine: Westgard + interlab z-score + OCR validation.

**Exports obrigatórios:**

```typescript
import type { WestgardEngineOutput } from './westgardEngine';
import type { InterlabZScoreOutput } from './zscoreCalculator';
import type { OCRValidationReport } from '../types/ocrResults';

export type AcceptanceDecision = 'accept' | 'warn' | 'reject';

export interface AcceptanceInput {
  westgardResult: WestgardEngineOutput;
  interlabZScore?: InterlabZScoreOutput;       // optional — only when CEQ cycle exists
  ocrValidation?: OCRValidationReport;         // optional — only when OCR was used
}

export interface AcceptanceOutput {
  decision: AcceptanceDecision;
  reasons: string[];                           // human-readable, e.g. ["Westgard 1-3s reject", "interlab z=3.4 unsatisfactory"]
  blockers: string[];                          // subset of reasons that drove a 'reject' verdict
}

export function evaluateAcceptance(input: AcceptanceInput): AcceptanceOutput;
```

**Invariantes (priority order):**
1. Se `westgardResult.rejectCount > 0` → `'reject'`. Adicionar 1 reason por violation.
2. Se `interlabZScore?.classification === 'unsatisfactory'` → `'reject'`. Reason: `"interlab z=X classification=unsatisfactory"`.
3. Se `ocrValidation?.validationSeverity === 'reject'` → `'reject'`. Reason: `"OCR validation rejected: N unmatched"`.
4. Senão se qualquer warn (`westgardResult.warnCount > 0`, `interlabZScore.classification === 'questionable'`, `ocrValidation.validationSeverity === 'review'`) → `'warn'`.
5. Senão → `'accept'`.
- Pure function. Lista `reasons` ordenada por prioridade acima.
- `blockers` = subset de `reasons` que causaram `'reject'` (vazia se `decision !== 'reject'`).

**Files to read:** `src/features/bioquimica/services/westgardEngine.ts` (W1), `src/features/bioquimica/services/zscoreCalculator.ts` (W1), `src/features/bioquimica/types/ocrResults.ts` (W0).

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W2-SA-53): combined acceptance engine`

---

## Wave 9b-W3 — Hooks + UI (3 SAs ‖)

deps: W0 + W1 + W2. All 3 SAs dispatch simultaneously.

---

### SA-54 — `src/features/bioquimica/hooks/useGeminiVision.ts`

React hook wrapping the `parseAnalyteStripImage` callable.

**Exports obrigatórios:**

```typescript
import type { OCRParsedResult } from '../types/ocrResults';
import type { AnalitoId } from '../types/_shared_refs';

export interface UseGeminiVisionState {
  isParsing: boolean;
  result?: OCRParsedResult;
  error?: string;
}

export interface UseGeminiVisionApi {
  state: UseGeminiVisionState;
  parseImage(args: {
    imageStoragePath: string;
    expectedAnalytes: AnalitoId[];
    consentToken: string;
  }): Promise<OCRParsedResult>;
  reset(): void;
}

export function useGeminiVision(): UseGeminiVisionApi;
```

**Invariantes:**
- Importa `httpsCallable` de `firebase/functions` apontando para a região `southamerica-east1`.
- Callable name `parseAnalyteStripImage`.
- `useActiveLabId()` injetado automaticamente no payload (operador não passa labId explicitamente).
- Erro de rede ou de auth → `error: string`, `result: undefined`, `isParsing: false`.
- `reset()` zera state.
- NÃO chama hooks Firebase no top-level — usa lazy init no callback.

**Files to read:** `src/features/bioquimica/services/bioquimicaService.ts` (callable client pattern reference), `src/store/useAuthStore.ts`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W3-SA-54): useGeminiVision hook`

---

### SA-55 — `src/features/bioquimica/hooks/useOCRValidation.ts`

Hook orchestrating OCR validation flow: parse → fuzzy match → validate.

**Exports obrigatórios:**

```typescript
import type { OCRParsedResult, OCRValidationReport } from '../types/ocrResults';
import type { AnalitoId } from '../types/_shared_refs';

export interface UseOCRValidationApi {
  isValidating: boolean;
  parsed?: OCRParsedResult;
  validation?: OCRValidationReport;
  error?: string;
  validateImage(args: {
    imageStoragePath: string;
    expectedAnalytes: AnalitoId[];
    consentToken: string;
  }): Promise<OCRValidationReport>;
  reset(): void;
}

export function useOCRValidation(): UseOCRValidationApi;
```

**Invariantes:**
- Internamente compõe `useGeminiVision` (SA-54) + `validateOCRResult` (W2 SA-52) + lê catálogo via `useAnalitos` (já existe).
- Aplica `fuzzyMatchAnalyte` (W1 SA-49) sobre cada `parsed.analytes[i].rawName` antes de chamar `validateOCRResult`.
- `reset()` zera todos os campos.
- Erro em qualquer etapa propagado para `error`.

**Files to read:** `src/features/bioquimica/hooks/useGeminiVision.ts` (W3 SA-54), `src/features/bioquimica/hooks/useAnalitos.ts`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W3-SA-55): useOCRValidation hook`

---

### SA-56 — `src/features/bioquimica/components/OCRUploadModal.tsx`

Drag-and-drop image upload modal with parsing preview. Dark-first, WCAG AA.

**Exports obrigatórios:**

```typescript
import type { AnalitoId } from '../types/_shared_refs';
import type { OCRValidationReport } from '../types/ocrResults';

export interface OCRUploadModalProps {
  open: boolean;
  onClose: () => void;
  expectedAnalytes: AnalitoId[];
  onAccept: (report: OCRValidationReport, imageStoragePath: string) => void;
  consentToken: string;  // patient consent — caller must obtain before opening
}

export function OCRUploadModal(props: OCRUploadModalProps): JSX.Element;
```

**Invariantes (UX + visual):**
- Usa `bg-[#141417]` overlay, `bg-[#1a1a1f]` modal body, `border border-white/10`, `rounded-2xl`.
- Tipografia editorial: title `text-xl font-medium tracking-tight`, body `text-sm text-white/70`.
- Espaçamento 4px-grid: `p-6`, gaps `gap-4`.
- Drag-and-drop area: `border-2 border-dashed border-white/20`, hover `border-violet-500/60`, `transition-colors duration-200`.
- Aceita `.png .jpg .jpeg .webp` máx 10MB; reject feedback inline.
- Estados: idle / uploading / parsing / preview / error — cada um com visual próprio (Skeleton, não spinner em parsing).
- Após upload: chama `useOCRValidation.validateImage`. Preview tabela mostra cada analyte parseado com `matchConfidence` (chip `bg-emerald-500/15` para high, `bg-amber-500/15` para medium, `bg-rose-500/15` para low).
- Botão "Aceitar e usar" só habilita se `validation.validationSeverity !== 'reject'`. Reject mode mostra blockers e botão "Tentar novamente".
- A11y: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` no title, `aria-describedby` no preview. Focus trap + ESC close. Tab order lógico.
- `prefers-reduced-motion`: desabilita transições não-essenciais.
- Sem libs de ícone — SVG inline `currentColor`.

**Files to read:** `src/features/bioquimica/hooks/useOCRValidation.ts` (W3 SA-55), `src/features/bioquimica/components/AddLotModal.tsx` (modal pattern reference), `./CLAUDE.md` (design tokens).

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W3-SA-56): OCRUploadModal dark-first component`

---

## Wave 9b-W4 — Cloud Function Orchestrator + Integration Doc (2 SAs ‖)

deps: W0 + W1 + W2. All 2 SAs dispatch simultaneously.

---

### SA-57 — `functions/src/modules/bioquimica/geminiOCRParser.ts`

Top-level orchestrator callable: image in → Westgard + acceptance decision out.

**Exports obrigatórios:**

```typescript
import { onCall } from 'firebase-functions/v2/https';
import type { AcceptanceOutput } from '../../../../src/features/bioquimica/services/acceptanceEngine';
import type { OCRValidationReport } from '../../../../src/features/bioquimica/types/ocrResults';
import type { WestgardViolationCLSI8 } from '../../../../src/features/bioquimica/types/westgardCLSI';

export const submitBioquimicaRunWithOCR: ReturnType<typeof onCall>;
```

**Input:** `{ labId: string; runId: string; imageStoragePath: string; expectedAnalytes: string[]; equipmentId: string; nivelId: string; lotId: string; consentToken: string; signature: { hash: string; operatorId: string; ts: number } }`
**Output:** `{ acceptance: AcceptanceOutput; ocrReport: OCRValidationReport; westgardViolations: WestgardViolationCLSI8[]; runDocPath: string }`

**Invariantes:**
- `onCall({ region: 'southamerica-east1', cors: true, secrets: ['GEMINI_API_KEY'], memory: '1GiB', timeoutSeconds: 180 })`.
- Auth + `isActiveMemberOfLab(labId)`.
- `signature.operatorId === request.auth.uid` (Threat T2).
- `signature.hash.match(/^[a-f0-9]{64}$/)`.
- Pipeline:
  1. Chama `parseAnalyteStripImage` interno (reuse SA-51 exported helper or call via internal Firestore-side call) com `consentToken` gate.
  2. Para cada parsed analyte: `evaluateWestgardServer` (SA-48).
  3. Lê interlab peer stats se cycle ativo em `labs/{labId}/ceq-rounds/active`.
  4. Combina via `evaluateAcceptance` (SA-53).
  5. Escreve run doc em `labs/{labId}/bioquimica/root/runs/{runId}` com payload completo + `acceptance` + `signature`.
  6. Append `labs/{labId}/bioquimica/root/audit/{logId}` com chainHash server-side.
- **Idempotência:** se `runId` já existe com `state === 'committed'`, retornar payload existente sem reprocessar.
- Logar `console.log(JSON.stringify({ event: 'bioq_run_with_ocr', labId, runId, decision }))`.

**Files to read:** `functions/src/modules/bioquimica/seedBioquimicaDefaults.ts`, `functions/src/modules/bioquimica/serverWestgardEngine.ts` (W1 SA-48), `functions/src/modules/bioquimica/geminiVisionService.ts` (W2 SA-51).

**Verify:** `cd functions && npm run build 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5a-W4-SA-57): orchestrator callable submitBioquimicaRunWithOCR`

---

### SA-58 — `docs/BIOQUIMICA_PHASE_2_INTEGRATION.md`

Integration guide for operators using the OCR-driven run workflow.

**Required sections:**

```markdown
# Bioquímica Phase 2 — OCR Integration Guide

## Pré-requisitos
## Fluxo do operador (5 passos)
## Requisitos LGPD (consent token)
## Decisão de aceitação (acceptance engine)
## Tratamento de OCR rejeitado
## Roteiro de teste com fixture (STUB mode)
## Limites conhecidos + fallback manual
## Métricas Cloud Logs (queries esperadas)
## Compliance map (RDC 978 Art. 167 + DICQ 4.3 Bloco F + LGPD Art. 9)
```

**Invariantes:**
- Markdown puro, sem HTML inline.
- Exemplos de código TypeScript usando os hooks `useOCRValidation` + `useGeminiVision`.
- 1 fluxograma ASCII no fluxo de aceitação.
- Tabela de mapeamento DICQ 4.3 (5.6.2, 5.6.3.1, 5.6.4) → SAs implementadas (SA-43..SA-58).
- Snippet de query Cloud Logs (Logs Explorer) para event `bioq_run_with_ocr`.

**Files to read:** `docs/BIOQUIMICA_PHASE_1.md` se existir, ou qualquer doc bioquimica em `docs/`. `src/features/bioquimica/CLAUDE.md`.

**Verify:** `wc -l docs/BIOQUIMICA_PHASE_2_INTEGRATION.md | awk '{ exit ($1 < 120) }'`

**Commit:** `docs(MP-5a-W4-SA-58): bioquimica phase 2 integration guide`

---

## Wave 9b-W5 — Tests (5 SAs ‖)

deps: W0 + W1 + W2 + W4. All 5 SAs dispatch simultaneously.

---

### SA-59 — `src/__tests__/bioquimica/westgard.test.ts`

16 unit tests (2 per CLSI rule).

**Coverage required:**
- `detect_1_3s`: positive (z=3.5), negative (z=2.9). [2]
- `detect_2_2s`: positive (two consec +2.3, +2.5), negative (one inside, one outside). [2]
- `detect_R_4s`: positive (z=2.1, z=-2.3), negative (range 3.8). [2]
- `detect_4_1s`: positive (4 consec same-side ≥1), negative (mixed sides). [2]
- `detect_10x`: positive (10 same-side), negative (9 same-side). [2]
- `detect_7T`: positive (7 monotonic asc), negative (6 asc + 1 reverse). [2]
- `detect_8x`: positive (8 same-side warn), negative (7). [2]
- `detect_12x`: positive (12 same-side warn), negative (11). [2]

**Invariantes:**
- Vitest. Imports somente de `westgardEngine` (W1 SA-47) e tipos de `westgardCLSI` (W0 SA-44).
- Cada test usa fixture mínima — sem mock de Firebase.
- Asserts em violation count + severity + rule id.

**Files to read:** `src/features/bioquimica/services/westgardEngine.ts`, `src/__tests__/bioquimica/` para vitest config se houver.

**Verify:** `npx vitest run src/__tests__/bioquimica/westgard.test.ts 2>&1 | grep -E '16 passed' | head -1`

**Commit:** `test(MP-5a-W5-SA-59): 16 westgard CLSI 8-rule tests`

---

### SA-60 — `src/__tests__/bioquimica/acceptanceEngine.test.ts`

12 unit tests for acceptance decision matrix.

**Coverage required:**
- 4 cases isolating Westgard reject path
- 3 cases isolating interlab z-score (unsat / question / sat)
- 3 cases isolating OCR (reject / review / accept)
- 2 combined cases (e.g. westgard warn + interlab unsat → reject; all clean → accept)

**Invariantes:**
- Vitest. Pure import of `evaluateAcceptance`. No mocks.
- Cada test verifica `decision`, `reasons.length`, `blockers.length`.

**Files to read:** `src/features/bioquimica/services/acceptanceEngine.ts`.

**Verify:** `npx vitest run src/__tests__/bioquimica/acceptanceEngine.test.ts 2>&1 | grep -E '12 passed'`

**Commit:** `test(MP-5a-W5-SA-60): 12 acceptance engine tests`

---

### SA-61 — `src/__tests__/bioquimica/ocrValidation.test.ts`

10 unit tests for OCR validation report generator.

**Coverage required:**
- Exact-match all expected → `'accept'`.
- 1 unmatched → `'review'`.
- 3 unmatched → `'reject'`.
- Low-confidence parse → `'reject'`.
- Unexpected analyte present → reflected in `unexpected[]`.
- Fuzzy alias hit (e.g. "TGP" → ALT) → `'accept'`.
- Levenshtein distance 1 → `'review'` (medium confidence).
- Levenshtein distance 3 (no match) → recorded in `unexpected`.
- Empty parsed analytes + non-empty expected → `'reject'`.
- Mixed result (high + medium + 1 unmatched) → `'review'`.

**Invariantes:**
- Vitest. Imports of `validateOCRResult` (W2 SA-52) + `fuzzyMatchAnalyte` (W1 SA-49) + types only.
- Catalog fixture mínimo (5 analytes) inline no test.

**Files to read:** `src/features/bioquimica/services/ocrValidationService.ts`, `src/features/bioquimica/services/fuzzyAnalyteMatch.ts`.

**Verify:** `npx vitest run src/__tests__/bioquimica/ocrValidation.test.ts 2>&1 | grep -E '10 passed'`

**Commit:** `test(MP-5a-W5-SA-61): 10 OCR validation tests`

---

### SA-62 — `src/__tests__/bioquimica/geminiVision.test.ts`

5 tests with mocked Gemini responses.

**Coverage required:**
- Stub mode returns canned fixture → 4 analytes parsed with high confidence.
- Image hash matches expected SHA-256 of fixture buffer.
- Missing `consentToken` → callable rejects `permission-denied`.
- `isActiveMemberOfLab` false → `permission-denied`.
- Gemini API error simulado → callable rejects `internal` (não vaza stack).

**Invariantes:**
- Vitest. Mocks de `firebase-admin` + `firebase-functions/v2/https` via `vi.mock`.
- Stub mode habilitado via `process.env.GEMINI_API_KEY = 'STUB'` no `beforeAll`.
- Fixture predefinida em `src/__tests__/fixtures/ocrFixture.json` (criar se não existir).

**Files to read:** `functions/src/modules/bioquimica/geminiVisionService.ts` (W2 SA-51).

**Verify:** `npx vitest run src/__tests__/bioquimica/geminiVision.test.ts 2>&1 | grep -E '5 passed'`

**Commit:** `test(MP-5a-W5-SA-62): 5 Gemini Vision callable tests with mocks`

---

### SA-63 — `src/__tests__/bioquimica/integration.test.ts`

End-to-end OCR → fuzzy match → Westgard → acceptance pipeline.

**Coverage required (5 scenarios, 1 test each):**
- Scenario 1: clean image, 4 expected analytes, all within 1 SD → `acceptance.decision === 'accept'`.
- Scenario 2: clean image, 1 analyte at z=3.5 → `acceptance.decision === 'reject'` with `reasons` mentioning `1-3s`.
- Scenario 3: 1 unmatched analyte (OCR review) + Westgard clean → `acceptance.decision === 'warn'`.
- Scenario 4: interlab z-score `unsatisfactory` + Westgard clean → `acceptance.decision === 'reject'`.
- Scenario 5: blockers populated only on reject paths.

**Invariantes:**
- Vitest. Stub Gemini mode. No Firestore — use in-memory fixtures.
- Cada test compõe `useOCRValidation.validateImage` (mock) → `evaluateWestgardServer` (mock — 12 historical observations) → `evaluateAcceptance`.

**Files to read:** SAs 47, 49, 50, 52, 53.

**Verify:** `npx vitest run src/__tests__/bioquimica/integration.test.ts 2>&1 | grep -E '5 passed'`

**Commit:** `test(MP-5a-W5-SA-63): 5 e2e OCR pipeline integration tests`

---

## Wave 9b-W6 — Verification Gate (1 SA, sequential, blocking)

deps: W0..W5 all green.

---

### SA-64 — `.planning/phases/09-bioquimica-phase2/PHASE-9B-VERIFICATION.md`

**Required content:**

```markdown
# Phase 9B — Bioquímica Phase 2 Verification Gate

## Build gates
- [ ] `npx tsc --noEmit` exit 0 (web)
- [ ] `cd functions && npm run build` exit 0
- [ ] `npm run build` (vite) exit 0; main chunk delta vs v1.4 baseline ≤ +15 KB gzip

## Test gates
- [ ] SA-59 westgard.test.ts — 16 passed
- [ ] SA-60 acceptanceEngine.test.ts — 12 passed
- [ ] SA-61 ocrValidation.test.ts — 10 passed
- [ ] SA-62 geminiVision.test.ts — 5 passed
- [ ] SA-63 integration.test.ts — 5 passed
- [ ] **Subtotal: 48 tests passing** (target ≥ 48)

## CLSI compliance
- [ ] All 8 rules implemented and unit-tested (1-3s, 2-2s, R-4s, 4-1s, 10x, 7T, 8x, 12x)
- [ ] Server-side engine matches client-side outputs on the SA-63 fixture

## DICQ 4.3 mapping
| DICQ clause | SA | Status |
|---|---|---|
| 5.5.1.1 (CIQ planning) | SA-43, SA-45 | covered |
| 5.6.2 (Westgard rules) | SA-44, SA-47, SA-48, SA-59 | covered |
| 5.6.3.1 (rejection criteria) | SA-53, SA-60 | covered |
| 5.6.4 (interlab comparison) | SA-50, SA-60, SA-63 | covered |

## RDC 978/2025 mapping
- Art. 167 (laudo): OCR pipeline ⇒ SA-51, SA-57, SA-58
- Art. 179 (CIQ obrigatório): SA-43..SA-50
- Art. 183 (CIQ por troca de lote): integrates with existing lot logic — no regression

## LGPD
- [ ] `consentToken` enforced in SA-51 + SA-57 (gate before processing image)
- [ ] No `rawText` logged (audit Cloud Logs query attached)

## OCR accuracy
- [ ] Manual validation on 10 sample lab strips ≥ 92% accurate analyte extraction (run by RT, output appended to this doc)

## Sign-off
- [ ] Module owner sign-off: __________
- [ ] CTO sign-off: __________
- [ ] Date: __________
```

**Files to read:** all SAs above (43..63), `.planning/phases/08-capa-closure/08-08-VERIFICATION.md` (gate document pattern).

**Verify:** `test -f .planning/phases/09-bioquimica-phase2/PHASE-9B-VERIFICATION.md && grep -c '^- \[ \]' .planning/phases/09-bioquimica-phase2/PHASE-9B-VERIFICATION.md | awk '$1 >= 14 { exit 0 } { exit 1 }'`

**Commit:** `docs(MP-5a-W6-SA-64): phase 9b verification gate document`

---

## MP-5a Master Verification Gate (post-W6)

| Gate | Pass criteria |
|------|---------------|
| **G-Build** | `npx tsc --noEmit` exit 0 + `cd functions && npm run build` exit 0 |
| **G-Test** | 48+ tests passing across 5 spec files; no Phase 8/9 regression |
| **G-CORS** | `parseAnalyteStripImage` and `submitBioquimicaRunWithOCR` both have `cors:true` |
| **G-LGPD** | `consentToken` gate present in SA-51 + SA-57 (grep enforced) |
| **G-CLSI** | All 8 rule detectors exported from `westgardEngine.ts` (grep enforced) |
| **G-OCR-Accuracy** | ≥92% on 10-sample manual validation (recorded in SA-64 doc) |

Failure of any gate → escalate to Sonnet 4.6 with full failing test output. Re-run wave incrementally; do NOT skip gates.
