# Wave 3-10: NOTIVISA Validation Guardrails + Eval Framework

**Status:** Proposal  
**Phase:** Wave 3 (Parallel Execution)  
**Author:** Claude Code (AI)  
**Date:** 2026-05-08  
**Complexity:** Medium  
**Risk Level:** Low (validates only, no API integration)

---

## Summary

Build **validation guardrails** for NOTIVISA submissions — ensuring drafts meet government format requirements before leaving the lab system. This is analogous to Wave 1's Promptfoo eval for `ia-strip` (Gemini validation), but for NOTIVISA payloads (government API validation).

**Key deliverables:**
1. Zod schema + validation logic (CPF, dates, exam codes, business rules)
2. Audit trail validation (RDC 978 Art. 204 compliance)
3. Business rule checks (duplicate detection, gap enforcement)
4. Comprehensive test suite (18+ tests)
5. Evaluation framework with 10 fixtures + 6 scenarios
6. CI gate (requires ≥95% pass rate before deploy)
7. ANVISA test codes reference database (~50 common tests)

---

## Problem Statement

**Current State:**
- NOTIVISA draft payloads created by W3-3 callables
- No pre-submission validation (errors caught only after government API call)
- Government rejects malformed requests → retry loops, compliance gaps

**Risk:**
- Invalid CPF submitted to government → audit violation
- Future dates in results → government API rejection
- Duplicate payloads → duplicate notifications
- Missing RT approval → submission gap >24h (RDC 978 Art. 167)
- No audit trail → compliance audit failure

**Solution:**
- Fail-safe validation before dispatch
- Clear error messages for RT/auditor remediation
- Complete audit trail (HMAC chain per ADR-0017)
- Business rule enforcement with override tracking

---

## Validation Rules

### 1. Payload Schema Validation

**Schema:** Zod `NotivisaPayloadValidationSchema`

```typescript
{
  versao: "1.0",
  laudo_id: string (1-128 chars),
  paciente_cpf: string (11 digits, valid Mod-11 checksum),
  data_resultado: number (Unix ms, <= now),
  resultados: [
    {
      analito: string (1-256 chars),
      valor: number | string,
      unidade: string (1-32 chars),
      referencia?: string
    }
  ] (min 1),
  assinador: {
    cpf: string (11 digits, valid Mod-11),
    nome: string (1-256 chars),
    data_assinatura: number (Unix ms, <= now)
  }
}
```

**Validation rules:**
- CPF format: 11 digits
- CPF checksum: Mod-11 algorithm (reject all-same-digit)
- Date coherence: signature_date >= result_date
- No future dates (result_date, signature_date <= now)
- At least 1 result required
- No truncation of reference ranges

### 2. Exam Code Validation (ANVISA Registry)

**Database:** `functions/src/shared/notivisa/anvisaTestCodes.ts`

- ~50 common tests (HC-001 Hemoglobin, CC-001 Glucose, IM-001 HIV, etc.)
- Format: `{ code, name, unit, method }`
- Unknown codes: warn (don't block), allow override via `forceExamCode: true`

**Fallback:** RT can override with `force: true` for new/experimental tests (logged as `notivisa-override-exam-code`)

### 3. Business Rule Validation

#### 3.1 Duplicate Detection

**Rule:** No resubmission of identical payload

```typescript
payloadHash = SHA256(JSON.stringify(payload, sortedKeys))
checkDuplicatePayload(labId, payloadHash)
  → if exists in (submitted, acknowledged): REJECT
```

**Error code:** `DUPLICATE_PAYLOAD`

#### 3.2 Gap Check (RDC 978 Art. 167)

**Rule:** Submission must occur within 24h of RT approval

```typescript
gapMs = now - approvedAt
if gapMs > 24 * 60 * 60 * 1000: WARN (not error)
RT can override with force=true (logged as notivisa-override-submission-gap)
```

**Warning code:** `SUBMISSION_GAP_EXCEEDED`

### 4. Audit Trail Validation (RDC 978 Art. 204)

**Chain integrity:**
- Every audit log entry signed with HMAC (operatorId, timestamp, prevHash)
- Order: DRAFT_CREATED → DRAFT_APPROVED → DRAFT_SUBMITTED
- DRAFT_REVOKED requires reason ≥10 chars (LGPD Art. 11)

**Validation checks:**
- All entries have signatures
- Hash chain unbroken (each entry verifies previous hash)
- Required events in correct order
- Revocation has reason logged

---

## File Structure

```
functions/src/modules/notivisa/guardrails/
├── notivisaPayloadValidator.ts     (CPF validation, schema, ANVISA codes)
├── notivisaAuditGuardrails.ts      (audit trail, chain validation)
├── notivisaBizRules.ts              (duplicate, gap check, overrides)
└── guardrails.test.ts               (18+ comprehensive tests)

functions/src/shared/notivisa/
└── anvisaTestCodes.ts               (50 test codes reference)

functions/eval/notivisa/
├── notivisaEvalConfig.yaml          (10 fixtures, 6 scenarios)
├── run-eval.sh                      (Jest-based runner)
└── results/                         (eval outputs)

functions/.github/workflows/
└── eval-notivisa.yml                (CI gate, PR comments)
```

---

## Test Coverage

### Unit Tests (guardrails.test.ts — 18+ tests)

| Suite | Tests | Coverage |
|-------|-------|----------|
| CPF Validation | 5 | Format, checksum, all-same-digits, formatting, edge cases |
| Payload Schema | 7 | Valid payload, CPF error, future date, no results, operator CPF, date coherence, stale signature |
| Exam Codes | 3 | Valid codes, unregistered, override handling |
| Duplicate Detection | 2 | Hash consistency, variance detection |
| Business Rules | 1 | Gap checks, overrides |
| Audit Trail | 3 | Chain validation, required events, revocation reason |
| Edge Cases | 6 | Null fields, large numbers, long names, boundaries, coded values, panels |
| **Total** | **27** | — |

### Eval Fixtures (notivisaEvalConfig.yaml — 10 payloads)

| Fixture | Status | Purpose |
|---------|--------|---------|
| fixture-001-valid-hemoglobin | ✓ Valid | Baseline: single numeric result |
| fixture-002-invalid-cpf-checksum | ✗ Invalid | CPF validation: checksum failure |
| fixture-003-unregistered-exam-code | ⚠ Warning | Exam code: not in ANVISA, allow override |
| fixture-004-future-result-date | ✗ Invalid | Date validation: reject future |
| fixture-005-multiple-results | ✓ Valid | Panel: multiple tests |
| fixture-006-stale-signature | ⚠ Warning | Signature: >7 days old, warn RT |
| fixture-007-coded-result-negative | ✓ Valid | Qualitative: negative result |
| fixture-008-coded-result-reagent | ✓ Valid | Qualitative: Portuguese reagente |
| fixture-009-unusual-coded-value | ⚠ Warning | Coded value: non-standard code |
| fixture-010-operator-cpf-invalid | ✗ Invalid | Operator CPF: checksum failure |

**Pass criteria:** ≥95% (9/10 fixtures)

### Validation Scenarios (6 critical paths)

1. **Schema Compliance** — All payloads conform to v1.0 spec
2. **CPF Validation** — Patient + operator CPF via Mod-11
3. **Date Validation** — No future dates
4. **Exam Code Registry** — ANVISA codes + override handling
5. **Qualitative Results** — Support numeric + coded values
6. **Multi-Test Panels** — Support resultados arrays

---

## Integration Points

### W3-3 HTTP Client

**Before:** Draft queued for dispatch

```typescript
// In submitNotivisaDraft callable (W3-3)
const validationResult = await validateNotivisaPayload(
  payload,
  { labId, db, forceExamCode }
);

if (!validationResult.valid) {
  // Log errors in audit trail
  await writeNotivisaAuditLog(db, labId, draftId, {
    eventType: 'SUBMISSION_VALIDATION_FAILED',
    operatorId: uid,
    details: { errors: validationResult.errors }
  });
  
  // Return error to Portal-RT
  throw new HttpsError('failed-precondition', 
    `Submission blocked: ${validationResult.errors[0].message}`);
}

// If validation passed: continue to HTTP dispatch
const response = await httpClient.submit(payload);
```

### Portal-RT Override Dialog

**Wire after W3-3:**

```tsx
// UI: Show validation warnings + override option
{validationResult.warnings.length > 0 && (
  <WarningDialog>
    {validationResult.warnings.map(w => (
      <li key={w.code}>{w.message}</li>
    ))}
    <Button onClick={() => submitWithForce(true)}>
      Override & Submit
    </Button>
  </WarningDialog>
)}
```

---

## Deployment Order

1. **Guardrails validators** deployed to `functions/src/modules/notivisa/guardrails/`
2. **ANVISA test codes** deployed to `functions/src/shared/notivisa/anvisaTestCodes.ts`
3. **Tests** pass locally (`npm test guardrails.test.ts`)
4. **Eval gate** passes in CI (`bash functions/eval/notivisa/run-eval.sh`)
5. **W3-3 HTTP client** wires validators (safe integration, no breaking changes to existing callables)
6. **Portal-RT override UI** wired (next milestone)

**Rollback:** If eval gate fails, PR blocks — fix validation logic before merge.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Pass Rate | 100% | `npm test guardrails.test.ts` |
| Fixture Pass Rate | ≥95% | `bash run-eval.sh` |
| Error Detection Accuracy | 100% | All intentionally invalid fixtures rejected |
| False Negative Rate | 0% | No valid payloads incorrectly blocked |
| Audit Trail Chain Integrity | 100% | HMAC verification |
| ANVISA Code Coverage | 50+ codes | Initial bootstrap (updated as gov provides) |

---

## Non-Deliverables

- **No government API integration** (that's W3-3 HTTP client)
- **No Portal-RT UI override dialog** (wire in next wave)
- **No real ANVISA registry** (reference stub; update as gov provides)
- **No performance optimization** (validators run in <100ms per payload)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Validation too strict | Warning flag (not error) for business rules; override with `force=true` |
| ANVISA codes outdated | Stub with 50 common tests; fallback override; document update process |
| Audit trail chain breaks | Unit tests verify chain integrity; Firestore transactions ensure atomicity |
| CPF validation bug | Real Mod-11 checksum (standard algorithm); test with known valid/invalid CPFs |

---

## Testing Checklist

- [ ] All 27 unit tests pass
- [ ] All 10 fixtures validate as expected
- [ ] Eval gate ≥95% pass rate
- [ ] CPF validation rejects all-same-digit
- [ ] Future dates rejected
- [ ] Duplicate detection hashes consistently
- [ ] Audit chain unbroken
- [ ] Override logging works
- [ ] Error messages clear for RT remediation

---

## Documentation & Handoff

**For next wave (Portal-RT override UI):**
- Override dialog wireframe
- Warning codes + user-facing messages
- Logging location for override events

**For Phase 4 (Government Sandbox):**
- Updated ANVISA code registry (gov will provide)
- Test payload generator (for sandbox calls)

---

## Author Notes

This is a **fail-safe validation layer** — it doesn't integrate with government yet, just ensures payloads are ready. Think of it as a quality gate before the HTTP client.

The eval framework mirrors `ia-strip` but for schema validation instead of image classification. Fixtures are real anonymized payloads; scenarios are critical validation paths.

Audit trail uses the same HMAC chain pattern as `educacao-continuada` (chain hash + operatorId + timestamp per ADR-0017).

**Key design decision:** Warnings (gap check, stale signature) are not errors — RT can override with reason logged. Errors (bad CPF, future date, duplicate) block submission.

---

## Sign-off

- **Proposal:** Ready for approval
- **Implementation:** Ready to start
- **QA:** 18+ tests + 10 fixtures ready
- **Deployment:** W3-10 deliverable
