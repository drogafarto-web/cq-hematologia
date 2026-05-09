---
macro_phase: MP-3
phase_label: Phase 5 — Críticos thresholds + IA strip OCR (imunologia)
total_subagents: 12
waves: 4
parallel: true
autonomous: true
human_gates: 0
worker_model: claude-haiku-4-5-20251001
estimated_runtime: 3h
depends_on: [MP-2]
---

# MP-3 — Phase 5 Críticos + IA Strip

**Goal:** Complete the Phase 5 partials: per-lab Críticos threshold config + routing + SMS/email escalation, plus IA strip OCR for imunologia (Gemini Vision) with operator feedback loop and a labeled dataset collector.
**Dependencies:** MP-2 (no functional dep, ordering only).
**Output:**
- 3 new types/services + 1 admin form for Críticos thresholds
- 1 detection function + 1 SLA tracker + 1 escalation callable
- 1 IA strip upload component + 1 Gemini parser callable + 1 fuzzy validation service
- 1 dataset collector + 1 feedback loop UI + 2 test files (15 tests)

**Existing surface (do NOT duplicate — extend if needed):**
- `src/features/criticos/types/index.ts` exists — read first; SA-25 may extend
- `src/features/criticos/services/thresholdService.ts` exists — read first; SA-26 extends/replaces
- `src/features/criticos/components/ThresholdConfigPanel.tsx` exists — SA-27 may rename to `CriticosThresholdsForm` or wrap
- `src/features/criticos/components/CriticosThresholdsAdmin.tsx` exists — likely the parent
- `functions/src/modules/criticos/registerDetection.ts` and `tierEngine.ts` exist — SA-28 polishes / replaces
- `functions/src/modules/ciqImuno/classifyStripGemini.ts` exists — SA-32 polishes
- `functions/src/modules/ciqImuno/collectIADataset.ts` exists — SA-34 polishes
- `functions/src/modules/ciqImuno/handleMLTeamFeedback.ts` exists — SA-35 wires to UI

Each SA must read the existing file first and ADD/EXTEND, not blind-overwrite.

---

## Wave MP-3-W1 — Threshold Config + Routing (3 SAs ‖)

---

### SA-25 — Critico types & helpers

**Path:** `src/features/criticos/types/index.ts` (extend) and `src/features/criticos/types/threshold.ts` (extend)
**LOC target:** +120
**Depends on:** none (W1)

**Contract additions:**
```typescript
export type CriticoSeverity = 'low' | 'medium' | 'high' | 'panic';

export interface CriticoThreshold {
  id: string;
  labId: string;
  analitoId: string;          // e.g. 'sodio', 'potassio', 'tsh'
  analitoNome: string;
  unidade: string;            // 'mEq/L', 'mUI/mL', etc.
  faixaCritica: { min: number | null; max: number | null };  // null = open-ended
  faixaPanico:  { min: number | null; max: number | null };  // panic > critical
  severityDefault: CriticoSeverity;
  ativo: boolean;
  criadoEm: number;
  criadoPor: string;
  deletadoEm?: number;
}

export interface NotificationChannel {
  type: 'sms' | 'email' | 'in-app';
  target: string;             // phone E.164, email, userId
  fallbackOrder: number;      // 0 = primary, 1 = first fallback, etc.
}

export interface CriticoRouteRule {
  id: string;
  labId: string;
  analitoId?: string;         // null = applies to all
  severity: CriticoSeverity;
  channels: NotificationChannel[];
  responsavelEscalacaoUserId: string;
  slaMinutes: number;         // default 5
  ativo: boolean;
}

export function classifySeverity(
  valor: number,
  threshold: CriticoThreshold
): CriticoSeverity | null;
```

**`classifySeverity` semantics:**
- If `valor` is within `faixaPanico` → `'panic'`
- Else if within `faixaCritica` → `threshold.severityDefault` (clamped to `'medium' | 'high'`)
- Else → `null` (not critical)
- Open-ended (null bound) means "any value below/above is in range"

**Invariants:**
- Pure types + pure helpers. No imports from `firebase/*` or `services/*`.
- Append-only — read existing types and merge; if a type already exists with a different shape, log it in commit message (do not silently replace).

**Files to read first:**
- `src/features/criticos/types/index.ts` (full)
- `src/features/criticos/types/threshold.ts` (full)
- `./CLAUDE.md`

**Verification:**
- `npx tsc --noEmit` exit 0
- `grep -E 'classifySeverity|CriticoThreshold|CriticoRouteRule' src/features/criticos/types/*.ts | wc -l ≥ 3`

**Commit:** `feat(MP-3-W1-SA-25): critico types — threshold/severity/route + classifySeverity helper`

---

### SA-26 — `criticosRoutingService.ts`

**Path:** `src/features/criticos/services/criticosRoutingService.ts`
**LOC target:** ~180
**Depends on:** SA-25 (types)

**Contract:**
```typescript
import type { CriticoRouteRule, NotificationChannel, CriticoSeverity } from '../types';

export async function getRoutingForLab(labId: string): Promise<CriticoRouteRule[]>;

export async function getDefaultRouting(): CriticoRouteRule[];

export async function resolveChannelsForAlert(
  labId: string,
  analitoId: string,
  severity: CriticoSeverity
): Promise<NotificationChannel[]>;

export async function upsertRouteRule(
  labId: string,
  rule: Omit<CriticoRouteRule, 'id' | 'labId'>
): Promise<string>;

export async function softDeleteRouteRule(labId: string, ruleId: string): Promise<void>;
```

**Behavior:**
- `getRoutingForLab` reads `/labs/{labId}/criticos-routing/` filtered `deletadoEm == null`. Cache for 30s in-memory.
- `getDefaultRouting` returns hard-coded fallback (panic → SMS+email to RT, high → email to RT, etc.) — at least 4 entries.
- `resolveChannelsForAlert` first matches lab-specific rules, then falls back to defaults. Ordering: most-specific first (analitoId match > wildcard).
- `upsertRouteRule` writes via `setDoc` with merge:false on create, merge:true on update. Always writes `labId` and `criadoEm` server-side.
- `softDeleteRouteRule` sets `deletadoEm = Date.now()`. Never `deleteDoc`.

**Invariants:**
- Multi-tenant: every read/write under `/labs/{labId}/`.
- Thin service: no UI state, no validation logic beyond shape (Zod is fine to import for safety).
- Returns Promises (no observables).

**Files to read first:**
- `src/features/criticos/services/thresholdService.ts` (canonical pattern)
- `.claude/rules/firestore-security.md`
- `./CLAUDE.md`

**Verification:**
- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-3-W1-SA-26): criticosRoutingService — per-lab routing with default fallback`

---

### SA-27 — `CriticosThresholdsForm.tsx`

**Path:** `src/features/criticos/components/CriticosThresholdsForm.tsx`
**LOC target:** ~220
**Depends on:** SA-25 (types), SA-26 (service)

**Contract:**
```typescript
type Props = {
  labId: string;
  initial?: CriticoThreshold;            // edit mode if set, create mode otherwise
  onSaved?: (threshold: CriticoThreshold) => void;
  onCancel?: () => void;
};

export default function CriticosThresholdsForm(props: Props): JSX.Element;
```

**Behavior:**
- Form fields: analitoId (select from existing analitos), nome (auto from analito), unidade, faixaCritica.min/max, faixaPanico.min/max, severityDefault (radio: medium / high), ativo (toggle).
- Validation:
  - panic min ≤ critical min (when both set)
  - critical max ≤ panic max (when both set)
  - At least one bound must be set
- Dark-first styling per MP-2 W4 invariants (`bg-white/5` panels, violet primary, etc.).
- Inline error messages (red-tinted text below the offending input).
- Submit calls `thresholdService.upsertThreshold(labId, ...)` (existing service from `thresholdService.ts` — extend if missing the call).
- After save: optimistic UI then resolve.

**Invariants:**
- WCAG AA: every input has a `<label>` with `htmlFor`; error text linked via `aria-describedby`.
- 4px grid spacing only.
- No date-pickers / no large UI libs.

**Files to read first:**
- `src/features/criticos/components/CriticosThresholdsAdmin.tsx` (parent / sibling)
- `src/features/criticos/components/ThresholdConfigPanel.tsx` (existing — possibly the seed)
- `src/features/criticos/services/thresholdService.ts`
- `DESIGN_SYSTEM.md`
- `.planning/phases/v1.4-final-closure/tokens-cache.json`

**Verification:**
- `npx tsc --noEmit` exit 0
- Imports resolve (no `..` overshoot)

**Commit:** `feat(MP-3-W1-SA-27): CriticosThresholdsForm — admin form with cross-field validation`

---

## Wave MP-3-W2 — Detection + SLA + Escalation (3 SAs ‖)

---

### SA-28 — `criticoDetector.ts` (functions side)

**Path:** `functions/src/modules/criticos/criticoDetector.ts` (new — distinct from existing `tierEngine.ts` and `registerDetection.ts`; extend if file already exists)
**LOC target:** ~200
**Depends on:** SA-25 types (mirror types in functions code — copy interface inline since cross-package import isn't set up)

**Contract:**
```typescript
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

// Triggered on result write — target latency <200ms p95
export const onResultWriteDetectCritico = onDocumentWritten(
  {
    document: 'labs/{labId}/results/{resultId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    // 1. Read after-snapshot
    // 2. Read thresholds for the analito (cached in memory between invocations)
    // 3. classifySeverity(value, threshold)
    // 4. If non-null → write critico-alert + invoke escalateCritico (SA-30)
    // 5. Idempotent — skip if alert already exists for this resultId
    // 6. Latency budget: 200ms p95 — measure with Date.now() and log if exceeded
  }
);
```

**Behavior details:**
- Reads cached threshold via in-memory Map `Map<labId, Map<analitoId, CriticoThreshold>>` with 60s TTL — refresh on miss.
- Writes to `/labs/{labId}/criticos/{alertId}` with `{ labId, resultId, analitoId, valor, severity, detectedAt, status: 'novo' }`.
- On `severity === 'panic'`, also enqueues escalation via `criticosEscalationQueue` collection (consumed by SA-30 callable or its own cron).
- Logs `console.warn` when wall-clock exceeds 200ms.

**Invariants:**
- v2 trigger; no v1 syntax.
- Idempotent via `alertId = sha1(resultId)`.
- No HTTP calls in hot path — Firestore only.

**Files to read first:**
- `functions/src/modules/criticos/registerDetection.ts`
- `functions/src/modules/criticos/tierEngine.ts`
- `functions/src/modules/criticos/types.ts`
- `./CLAUDE.md`

**Verification:**
- `(cd functions && npm run build)` exit 0
- Latency benchmark in unit test (SA-36) shows median <200ms on synthetic input

**Commit:** `feat(MP-3-W2-SA-28): criticoDetector trigger — sub-200ms detection on result write`

---

### SA-29 — SLA tracker + dashboard

**Path:** `src/features/criticos/services/slaTracker.ts` + `src/features/criticos/components/CriticosSLADashboard.tsx`
**LOC target:** ~140 service + ~200 component
**Depends on:** SA-25 types

**Service contract:**
```typescript
export interface SLAMetric {
  alertId: string;
  detectedAt: number;
  acknowledgedAt: number | null;
  timeToAcknowledgeMs: number | null;
  slaBreached: boolean;
  slaTargetMs: number;
}

export async function getSLAMetrics(
  labId: string,
  range: { from: number; to: number }
): Promise<SLAMetric[]>;

export function aggregateSLA(metrics: SLAMetric[]): {
  count: number;
  breachedCount: number;
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
};
```

**Component:**
- Header: period selector (last 24h / 7d / 30d), refresh button.
- 4 KPI tiles: Total alertas, % SLA breach, p50 ack time, p95 ack time. Use `tabular-nums`.
- Body: list of breached alerts (descending breach delta), each with analito, severity badge, time-to-ack.
- Chart: tiny inline-SVG sparkline (no chart libs) of breach rate over time bucketed by day.
- Empty state: "Sem alertas no período".
- Loading: skeleton tiles.

**Invariants:**
- `aggregateSLA` is pure (testable without firestore).
- Component is dark-first per MP-2 W4 invariants.
- All percentages render with 1 decimal (e.g. "12.5%").

**Files to read first:**
- `src/features/criticos/components/EscalacaoDashboard.tsx`
- `./CLAUDE.md`
- `.planning/phases/v1.4-final-closure/tokens-cache.json`

**Verification:**
- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-3-W2-SA-29): SLA tracker + dashboard — p50/p95/breach metrics`

---

### SA-30 — `escalateCritico` callable

**Path:** `functions/src/modules/criticos/escalateCritico.ts`
**LOC target:** ~180
**Depends on:** SA-26 (routing logic mirrored on functions side — duplicate the small fallback table inline rather than cross-package import)

**Contract:**
```typescript
export const escalateCritico = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER',
              'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS'],
  },
  async (request) => {
    // input: { labId, alertId }
    // returns: { channelsAttempted: NotificationChannel[], delivered: NotificationChannel[] }
  }
);
```

**Behavior:**
1. Auth + lab membership guard.
2. Read alert at `/labs/{labId}/criticos/{alertId}`. If `status != 'novo'`, no-op return.
3. Resolve channels: read lab routing rules from `/labs/{labId}/criticos-routing/`. Fallback to default table.
4. For each channel in `fallbackOrder` ascending:
   - SMS via Twilio (POST to `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`). 
   - Email via nodemailer with SMTP_* secrets.
   - In-app: write to `/users/{userId}/notifications/{notifId}`.
   - On success, append to `delivered` array. On failure, continue to next channel.
5. Update alert `status: 'escalado'`, `escaladoEm: serverTimestamp()`, `canaisEntregues: delivered`.
6. Return `{ channelsAttempted, delivered }`.

**Invariants:**
- onCall v2 with `cors: true` and `region: 'southamerica-east1'`.
- Secrets declared via `secrets: [...]` — preflight gate enforces provisioning.
- Twilio call wrapped in 5s timeout; on timeout, treat as failure and continue.
- Idempotent — checking `status != 'novo'` prevents double-send.
- No PII (patient name, CPF) in SMS body — only analito, value, time, severity. SMS template:
  `[HC Quality] CRÍTICO {analito}={valor}{unidade} em {time}. Acessar app.`

**Files to read first:**
- `functions/src/modules/criticos/registerDetection.ts`
- Any sibling Twilio integration (search functions/src for `twilio`)
- `functions/src/modules/auditoria/emailAuditReport.ts` (just-written — same SMTP pattern)
- `.claude/rules/deploy-protocol.md`
- `./CLAUDE.md`

**Verification:**
- `(cd functions && npm run build)` exit 0
- `grep -c 'cors: true' functions/src/modules/criticos/escalateCritico.ts` ≥ 1
- `grep -c 'TWILIO_ACCOUNT_SID' functions/src/modules/criticos/escalateCritico.ts` ≥ 1 (declared in secrets)

**Commit:** `feat(MP-3-W2-SA-30): escalateCritico callable — SMS+email+in-app cascade`

---

## Wave MP-3-W3 — IA Strip OCR (3 SAs ‖)

---

### SA-31 — `IAStripUpload.tsx`

**Path:** `src/features/ciq-imuno/components/IAStripUpload.tsx`
**LOC target:** ~220
**Depends on:** SA-32 (callable name) — but Haiku can stub the callable name and trust the SA-32 export

**Contract:**
```typescript
type Props = {
  labId: string;
  expectedAnalytes: string[];     // e.g. ['TSH','T4','T3']
  onParsed?: (result: StripParseResult) => void;
};

export default function IAStripUpload(props: Props): JSX.Element;
```

**Behavior:**
- Drag-and-drop area: large dashed-border zone with `bg-white/5` resting / `bg-violet-500/10` on dragover.
- Or click-to-select fallback: `<input type="file" accept="image/png,image/jpeg" hidden>`.
- File size cap: 8 MB. Reject larger with inline error.
- After file selected: render preview thumbnail (object URL) at 240×240 with object-fit:cover.
- "Analisar" button (primary violet) — disabled while no file or while parsing.
- On click, base64-encode the image and call `httpsCallable(functions, 'geminiStripParser')` with `{ labId, imageBase64, expectedAnalytes }`. Spinner state on button.
- Result panel: parsed analytes table with confidence bars (using SA-33 validation).
- Error state: red banner with the error message; "Tentar novamente" button.

**Invariants:**
- Use `URL.createObjectURL` and revoke in `useEffect` cleanup (no memory leak).
- Drag overlay must respect `prefers-reduced-motion` (no bouncy transitions if reduced).
- WCAG AA: drag zone has `role="button"`, `tabindex="0"`, keyboard activation via Space/Enter.
- No new image library — `<img>` is fine.

**Files to read first:**
- `src/features/ciq-imuno/components/` index (for sibling pattern)
- `src/features/criticos/components/EscalacaoDashboard.tsx` (dark-first reference)
- `./CLAUDE.md`

**Verification:**
- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-3-W3-SA-31): IAStripUpload — drag-drop + thumbnail + Gemini callable`

---

### SA-32 — `geminiStripParser` callable

**Path:** `functions/src/modules/ciqImuno/classifyStripGemini.ts` (existing — extend / rename export to `geminiStripParser` if not already; add the alias export at minimum)
**LOC target:** +180
**Depends on:** none (W3)

**Contract:**
```typescript
export const geminiStripParser = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: ['GEMINI_API_KEY'],
    memory: '1GiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    // input: { labId, imageBase64, expectedAnalytes: string[] }
    // returns: { analytes: { name, value, unit, confidence }[], rawJson, modelVersion }
  }
);
```

**Behavior:**
1. Auth + lab membership guard.
2. Validate `imageBase64` size <12 MB (after decoding). Reject `invalid-argument` otherwise.
3. Build a Gemini 2.5 Flash request:
   - System prompt: lab assistant tasked with reading immunoassay analyte strips. Output strict JSON: `{ analytes: [{ name, value, unit, confidence }] }`.
   - User content: image (inline base64) + instruction listing `expectedAnalytes`.
4. Call Gemini via `@google/generative-ai` (already in deps; verify `functions/package.json`).
5. Validate response is parseable JSON. On parse failure, attempt one retry with stricter prompt. If still fails, throw `HttpsError('internal', 'Gemini returned non-JSON: ...')`.
6. Return result + log to `/labs/{labId}/ia-strip-runs/` for dataset/audit.

**Invariants:**
- onCall v2 with `cors: true`, `region: 'southamerica-east1'`, secret declared.
- Idempotent? — not strictly; each upload is a new run. Log every run.
- No PII forwarded to Gemini (no patient name in prompt).

**Files to read first:**
- `functions/src/modules/ciqImuno/classifyStripGemini.ts` (full)
- `functions/src/modules/ciqImuno/classify.ts`
- `functions/src/modules/ciqImuno/confidenceValidation.ts`
- `functions/package.json`
- `./CLAUDE.md`

**Verification:**
- `(cd functions && npm run build)` exit 0
- `grep -E 'export const geminiStripParser' functions/src/modules/ciqImuno/classifyStripGemini.ts` ≥ 1

**Commit:** `feat(MP-3-W3-SA-32): geminiStripParser callable — Gemini 2.5 Flash imuno strip OCR`

---

### SA-33 — `iaStripValidation.ts`

**Path:** `src/features/ciq-imuno/services/iaStripValidation.ts`
**LOC target:** ~140
**Depends on:** none (pure logic)

**Contract:**
```typescript
export interface ParsedAnalyte {
  name: string;
  value: number;
  unit: string;
  confidence: number;          // 0..1 from Gemini
}

export interface StripParseResult {
  analytes: ParsedAnalyte[];
  rawJson: string;
  modelVersion: string;
}

export interface ValidatedAnalyte extends ParsedAnalyte {
  matched: boolean;
  matchedExpected: string | null;     // the expected analyte name it matched
  matchScore: number;                 // 0..1 fuzzy
  flags: ('low-confidence' | 'unit-mismatch' | 'unknown-analyte' | 'value-out-of-plausible-range')[];
}

export function validateStripResult(
  parsed: StripParseResult,
  expectedAnalytes: string[],
  unitDictionary: Record<string, string[]>     // e.g. { TSH: ['mUI/mL', 'uIU/mL'] }
): ValidatedAnalyte[];

export function fuzzyMatch(a: string, b: string): number;   // 0..1, exposed for tests
```

**Behavior:**
- `fuzzyMatch`: lowercase, strip diacritics, Levenshtein-based similarity (compute distance / max-length, invert). Pure JS, no deps.
- For each parsed analyte, find best fuzzy match against `expectedAnalytes` (>=0.7 threshold). Otherwise `flags: ['unknown-analyte']`.
- Confidence < 0.6 → flag `low-confidence`.
- Unit not in `unitDictionary[matchedExpected]` → `unit-mismatch`.
- Optional: hard-coded plausible-range table for top 5 imuno analytes (TSH 0.1-100, T4 0.1-30, T3 0.05-10, etc.) — flag `value-out-of-plausible-range` if outside.

**Invariants:**
- Pure functions, no Firebase / no React imports.
- Deterministic — given identical inputs, identical outputs.

**Files to read first:**
- `src/features/ciq-imuno/services/` (any existing validator)
- `functions/src/modules/ciqImuno/confidenceValidation.ts` (server-side analog — copy logic if compatible)
- `./CLAUDE.md`

**Verification:**
- `npx tsc --noEmit` exit 0
- Self-test in SA-36 passes (fuzzy match of 'tsh' vs 'TSH' = 1.0, etc.)

**Commit:** `feat(MP-3-W3-SA-33): iaStripValidation — fuzzy matching + plausibility flags`

---

## Wave MP-3-W4 — Dataset + Tests (3 SAs ‖)

---

### SA-34 — `iaDatasetCollector.ts`

**Path:** `src/features/ciq-imuno/services/iaDatasetCollector.ts` (new client-side service); also extend existing `functions/src/modules/ciqImuno/collectIADataset.ts` if needed
**LOC target:** ~140 client + +30 functions
**Depends on:** none (W4)

**Client-side contract:**
```typescript
import { ref, uploadBytes } from 'firebase/storage';

export interface DatasetEntry {
  labId: string;
  imageStoragePath: string;       // gs://.../ia-strip-dataset/{labId}/{ts}-{uid}.jpg
  parsedResultId: string;
  groundTruth?: ParsedAnalyte[];  // operator-corrected, set later via feedback
  modelVersion: string;
  uploadedAt: number;
  uploadedBy: string;
  consentGiven: boolean;          // explicit operator opt-in for retraining
}

export async function uploadDatasetEntry(
  labId: string,
  file: File,
  parsedResultId: string,
  modelVersion: string,
  consentGiven: boolean
): Promise<{ entryId: string; storagePath: string }>;
```

**Behavior:**
- If `!consentGiven`, throw `Error('Consent required for dataset collection')`.
- Upload file to Firebase Storage at path `ia-strip-dataset/{labId}/{Date.now()}-{uid}.jpg` (use `uploadBytes`).
- Write metadata doc to `/labs/{labId}/ia-strip-dataset/{entryId}` with the `DatasetEntry` shape.
- Return `entryId` and the storage path.

**Invariants:**
- LGPD: no patient identifiers in storage filename or metadata. Image must be a strip photo only (no requisition forms).
- Storage rules must allow upload only by lab members — verify a rule exists; if not, file a TODO in commit message.

**Files to read first:**
- `functions/src/modules/ciqImuno/collectIADataset.ts`
- `src/features/ciq-imuno/services/` index
- `./CLAUDE.md`

**Verification:**
- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-3-W4-SA-34): iaDatasetCollector — consent-gated retraining dataset`

---

### SA-35 — `IAFeedbackLoop.tsx`

**Path:** `src/features/ciq-imuno/components/IAFeedbackLoop.tsx`
**LOC target:** ~200
**Depends on:** SA-33 (validation), SA-34 (uploader)

**Contract:**
```typescript
type Props = {
  labId: string;
  validatedAnalytes: ValidatedAnalyte[];
  parsedResultId: string;
  onFeedbackSubmitted?: () => void;
};

export default function IAFeedbackLoop(props: Props): JSX.Element;
```

**Behavior:**
- Renders an editable table: each parsed analyte as a row with editable fields (name, value, unit). Pre-fills with parsed result.
- Highlights flagged rows: `ring-1 ring-rose-400/40` on `low-confidence`, `ring-amber-400/40` on `unit-mismatch`, etc. Show flag icons inline.
- Below table: consent checkbox (`Concordo em compartilhar este resultado corrigido para retreino do modelo`) — required to submit.
- Submit button calls the existing `handleMLTeamFeedback` callable with the corrected analytes + sets the dataset entry's `groundTruth` field.
- Toast (or inline confirmation) on success: "Obrigado — feedback enviado".
- Audit log: every correction triggers a write to `/labs/{labId}/ia-strip-feedback/{logId}` with operator id, ts, before/after.

**Invariants:**
- Dark-first; tabular numbers in the value column.
- WCAG AA: every input labelled.
- Cannot submit without consent checkbox.

**Files to read first:**
- `functions/src/modules/ciqImuno/handleMLTeamFeedback.ts` (callable contract)
- `src/features/ciq-imuno/services/iaStripValidation.ts` (just-written)
- `src/features/ciq-imuno/services/iaDatasetCollector.ts` (just-written)
- `./CLAUDE.md`

**Verification:**
- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-3-W4-SA-35): IAFeedbackLoop — operator correction UI feeding retraining`

---

### SA-36 — `criticosFlow.test.ts` + `iaStripOCR.test.ts`

**Path:** `src/__tests__/criticos/criticosFlow.test.ts` + `src/__tests__/ciq-imuno/iaStripOCR.test.ts`
**LOC target:** ~200 each
**Depends on:** SA-25–35

**`criticosFlow.test.ts` — 5 escalation scenarios:**
1. `classifySeverity` returns `null` for normal value.
2. `classifySeverity` returns `medium` when value enters critical range with `severityDefault: 'medium'`.
3. `classifySeverity` returns `panic` when value enters panic range, regardless of `severityDefault`.
4. `resolveChannelsForAlert` falls back to defaults when lab has no rules.
5. `escalateCritico` (mocked) — given an alert with `severity: 'panic'`, attempts SMS first, then email; if SMS fails, email is still attempted; final `delivered` includes email.
6. (bonus) Latency: `criticoDetector` synthetic invocation completes in <200ms median across 100 runs (use `performance.now()`).

**`iaStripOCR.test.ts` — 10 OCR validation samples:**
1. `fuzzyMatch('tsh','TSH')` ≈ 1.0
2. `fuzzyMatch('tsh','t4')` ≤ 0.5
3. `fuzzyMatch('Tireotrofina','TSH')` (alias case) — score depends on impl, but documented expectation
4. `validateStripResult` flags low-confidence when confidence=0.5
5. `validateStripResult` flags unit-mismatch when parsed unit not in dictionary
6. `validateStripResult` flags unknown-analyte when no fuzzy match >= 0.7
7. `validateStripResult` flags value-out-of-plausible-range when TSH=999
8. `validateStripResult` returns matched=true for clean input
9. Determinism: same input → same output across 10 runs
10. Empty parsed result → returns empty array (no throw)

**Harness:**
- vitest. No emulator. No Firebase calls — mock everything.

**Verification:**
- `npm test -- src/__tests__/criticos/ src/__tests__/ciq-imuno/` → 15+ pass

**Commit:** `test(MP-3-W4-SA-36): 5 criticos scenarios + 10 OCR validation tests`

---

## Verification Gate MP-3

```bash
# G-Build
npx tsc --noEmit
(cd functions && npm run build)

# G-CORS
grep -c 'cors: true' functions/src/modules/criticos/escalateCritico.ts
grep -c 'cors: true' functions/src/modules/ciqImuno/classifyStripGemini.ts
# Each ≥1

# G-Secrets declared
grep -E "TWILIO_|GEMINI_API_KEY|SMTP_" functions/src/modules/criticos/escalateCritico.ts
grep -E "GEMINI_API_KEY" functions/src/modules/ciqImuno/classifyStripGemini.ts

# G-Tests
npm test -- src/__tests__/criticos/criticosFlow.test.ts
npm test -- src/__tests__/ciq-imuno/iaStripOCR.test.ts
```

**Pass criteria:**
- [ ] 12 SA commits landed
- [ ] All new callables (escalateCritico, geminiStripParser) have `cors: true` + `region: 'southamerica-east1'`
- [ ] criticoDetector trigger compiles and median latency < 200ms in synthetic test
- [ ] OCR validation hits ≥ 92% on the 10-sample test set (`matched=true` rate, given clean inputs in 9/10 fixtures)
- [ ] SMS escalation cascade verified via Twilio sandbox in mocked test (real sandbox call is deferred to MP-8 smoke)
- [ ] 15+ new tests green
- [ ] No regression vs MP-2 baseline (TSC, prior tests)
