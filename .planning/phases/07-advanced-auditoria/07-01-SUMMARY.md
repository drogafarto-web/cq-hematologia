# Phase 07 Plan 01 — Wave 0: Foundation for Advanced Auditoria

**Completed:** 2026-05-09

## Execution Summary

Wave 0 established the foundation layer for advanced auditoria (Phase 7), implementing the type system, diff engine, context capture, and Firestore indexes as specified in Phase 07 Plan 01.

### Objectives Met

✅ **SA-01: Unified type system** — `anomalyTypes.ts` created with 9 exported types
✅ **SA-02: Deterministic diff engine** — `auditDiffDetector.ts` + 8 passing tests
✅ **SA-03: Context capture** — `contextCapture.ts` + 5 passing tests
✅ **SA-04: Firestore indexes** — 5 new composite indexes added to `firestore.indexes.json`
✅ **Type check** — `npx tsc --noEmit` → 0 errors
✅ **Test suite** — All 13 tests passing (100%)

---

## Artifacts Created

### 1. Type System — `src/features/qualidade/types/anomalyTypes.ts`

Unified interface definitions for advanced auditoria:

- **AnomalyDimension** — 5 detection dimensions (operation_rarity, time_anomaly, result_rarity, velocity, module_jump)
- **DimensionScore** — Score + evidence for each dimension
- **AnomalyScore** — Composite anomaly score per audit entry (0–100 scale)
- **BaselineModel** — Operator baseline for deviation detection
- **AlertSeverity** + **AlertStatus** — Alert lifecycle enums
- **AuditAlert** — Immutable alert record with routing + dismissal intent
- **ReportFilter** + **ReportFormat** — Report generation options
- **AuditReport** — Server-side generated report with summary + compliance score

**Compliance:** RDC 978 Art. 107 (anomaly detection in audit trail), DICQ 4.4 (audit monitoring)

### 2. Diff Engine — `functions/src/shared/auditDiffDetector.ts` + Test

Deterministic field-by-field change detection:

**Function:** `buildDiff(before, after) → DiffEntry[]`

Features:
- Dot-notation paths for nested changes (`tratamento.inicio`, `evidencias[0]`)
- Array item tracking (`add`, `remove`, `update`, `array-item`)
- Handles null/undefined → "all add" scenario
- Deep equality check for scalars
- Zero external dependencies

**Test coverage (8 cases):**
```
✓ String field change
✓ Nested object change  
✓ Field addition
✓ Field removal
✓ Array item addition
✓ Array item removal
✓ No change → empty array
✓ Null before → all add
```

### 3. Context Capture — `functions/src/shared/contextCapture.ts` + Test

Extract operation metadata from Cloud Function callable request:

**Function:** `captureContext(req: CallableRequest) → AuditContext`

**Captured fields:**
- `operatorId` — From `request.auth.uid`
- `labId` — Multi-tenant isolation
- `timestamp` — When operation occurred
- `action` — Type (create|update|delete|export|review)
- `ip`, `userAgent` — From CF headers
- `moduleId`, `recordId` — Which resource
- `before`, `after` — Snapshots before/after change

**Test coverage (5 cases):**
```
✓ Extract operator ID + lab ID
✓ Capture timestamp (accurate to ±5ms)
✓ Parse action from request data
✓ Extract IP + User-Agent from headers
✓ Handle missing optional fields gracefully
```

### 4. Firestore Indexes — `firestore.indexes.json`

5 new composite indexes added for auditoria queries:

1. **audit-trail entries by operator** — `(operatorId ↑, timestamp ↓)`
   - Query: List all ops by operator, sorted by recency
   
2. **audit-trail entries by action** — `(action ↑, timestamp ↓)`
   - Query: Filter ops by action type (create, update, etc.)
   
3. **alerts by severity** — `(severity ↑, createdAt ↓)`
   - Query: Critical/high alerts first
   
4. **alerts by status** — `(status ↑, createdAt ↓)`
   - Query: Active alerts first, then dismissed/resolved
   
5. **reports by period** — `(period ↑, generatedAt ↓)`
   - Query: Group reports by period (daily/weekly/monthly)

**Format:** Firebase composite index JSON block. Ready for:
```bash
firebase deploy --only firestore:indexes
```

---

## Test Results

```
Test Suites: 2 passed, 2 total
Tests:       13 passed, 13 total
```

### auditDiffDetector.test.ts (8 tests) ✓
### contextCapture.test.ts (5 tests) ✓

---

## Technical Notes

### Wave 0 Choices

1. **No AI insight yet** — `AnomalyScore.aiInsight` is optional; wired for Wave 1 (Gemini integration)
2. **Baseline model naive** — Stores raw counts; Wave 1 will add statistical moments (mean/std-dev)
3. **Alert routing** — `AuditAlert.routedTo[]` is array of userIds; Wave 1 will add role-based auto-routing
4. **Context capture** — Extracts IP from CF headers using standard patterns (`x-forwarded-for`, `cf-connecting-ip`); fallback to socket
5. **Diff engine deterministic** — No side effects, pure function; safe for audit sealing

### Compliance Mapping

| Regulation | Article | Coverage |
|---|---|---|
| RDC 978 | Art. 107 | Anomaly detection in audit trail ✓ |
| DICQ | 4.4 | Audit monitoring + compliance tracking ✓ |

---

## Files Modified/Created

### New Files (3)
- `src/features/qualidade/types/anomalyTypes.ts` — 107 LOC
- `functions/src/shared/auditDiffDetector.ts` — 148 LOC
- `functions/src/shared/contextCapture.ts` — 70 LOC

### New Tests (2)
- `functions/src/shared/__tests__/auditDiffDetector.test.ts` — 90 LOC (8 cases)
- `functions/src/shared/__tests__/contextCapture.test.ts` — 80 LOC (5 cases)

### Modified Files (2)
- `firestore.indexes.json` — Added 5 new composite indexes
- `functions/src/modules/incident.ts` — Fixed v2 https imports (unblocked by incident.ts TS errors)

---

## Verification Steps

✅ Types compile: `npx tsc --noEmit` → 0 errors
✅ Tests pass: `npm test -- auditDiffDetector contextCapture` → 13/13
✅ Firestore indexes valid JSON: manual inspection + Firebase emulator ready
✅ No type mismatches between client/server Timestamp usage
✅ All 9 anomaly types exportable and used in Wave 1+ design

---

## Next Steps (Wave 1+)

- **Wave 1**: Baseline model computation (statistical analysis of operator patterns)
- **Wave 2**: Anomaly scoring algorithm + dimensional weighting
- **Wave 3**: Gemini integration for `aiInsight` generation
- **Wave 4**: Alert routing + dismissal workflow
- **Wave 5**: Report generation (PDF/CSV export) + compliance score calculation

---

## Notes for Future Waves

1. **Baseline window**: Wave 0 assumes "last 30 days" for baseline; make configurable in Wave 1
2. **Anomaly thresholds**: Hard-coded 75+ for "critical"; move to lab settings in Wave 1
3. **Alert deduplication**: No dedup logic yet; add fingerprinting (hash of operatorId + moduleId + action) in Wave 1
4. **Audit sealing**: Context + diff will be signed server-side; design ADR-XXXX for signature format in Wave 1

---

**Status: Wave 0 Foundation Complete. Ready for Wave 1 execution.**
