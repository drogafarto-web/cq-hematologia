# Phase 9 — Bioquímica Phase 2 + IA Strip OCR Foundation

**Index of Plans & Artifacts**

---

## Structure

```
.planning/phases/09-bioquimica-phase2/
├── INDEX.md                      ← You are here
├── 00-OVERVIEW.md               ← Phase 9 vision + dependencies + risk register
├── 09-01-PLAN.md                ← Plan 1: Analyte expansion + Westgard engines
├── 09-02-PLAN.md                ← Plan 2: Gemini Vision OCR + fuzzy matching
├── 09-01-SUMMARY.md             ← Generated after execution (Task 5 of Plan 1)
├── 09-02-SUMMARY.md             ← Generated after execution (Task 6 of Plan 2)
└── PHASE_9_RESEARCH.md          ← Optional deep-dive (if discovery required)
```

---

## Plan Details

### Plan 09-01: Analyte Expansion + Westgard Engine

**Status:** 📋 PLANNED  
**Wave:** 1  
**Duration:** ~12 days  
**Tasks:** 5 (types → seed → client engine → server engine → tests)  
**Files Modified:** 9 (types, constants, utils, services, tests)

**Key Outcomes:**

- 25+ analytes seeded (glucose, urea, creatinine, albumin, … TSH)
- Client Westgard engine: 200+ lines, 12+ test cases
- Server Westgard engine: 250+ lines, 8+ test cases
- Total tests: 54 (42 Phase 1 + 12 Phase 9.1)

**Compliance:**

- RDC 978 Art. 179 (CIQ mandatory)
- DICQ 4.3 Block F (Westgard rules documented)

---

### Plan 09-02: Gemini Vision OCR + Fuzzy Matching + Audit Trail

**Status:** 📋 PLANNED  
**Wave:** 2 (depends on 09-01)  
**Duration:** ~12 days  
**Tasks:** 6 (types → Gemini → fuzzy match → hooks+UI → server parser → audit)  
**Files Modified:** 12 (types, services, hooks, components, tests, docs)

**Key Outcomes:**

- Gemini 2.5 Flash integration (image → JSON in <3s)
- Fuzzy matching (Levenshtein + semantic, >90% accuracy)
- Dark-first OCRUploadModal (WCAG AA compliant)
- Audit trail (RDC 978 Art. 161 + DICQ 4.4 append-only)
- Total tests: 68 (42 Phase 1 + 26 Phase 9.2)

**Compliance:**

- RDC 978 Art. 161 (LogicalSignature audit)
- RDC 978 Art. 179 (Westgard from Plan 09-01)
- DICQ 4.3 Block F (OCR confidence scoring)
- DICQ 4.4 (append-only audit trail)

---

## Execution Checklist

### Pre-Execution (2026-05-20)

- [ ] Read `00-OVERVIEW.md` (this file's neighbor)
- [ ] Verify phase dependencies (Phase 9.1 Foundation complete: 2026-05-06)
- [ ] Set up Gemini API key (Plan 09-02 user_setup)
  - Google Cloud Console → APIs & Services → Enable "Generative AI"
  - Create API key (unrestricted or HTTP referrer limited)
  - Add to `VITE_GEMINI_API_KEY` (client) and `GEMINI_API_KEY` (functions)
- [ ] Verify all Phase 1 bioquímica tests passing (`npm test src/features/bioquimica`)

### Execution Wave 1 (2026-05-20 → 2026-06-02)

- [ ] **Plan 09-01, Task 1:** Extend Analito types (2 days)
- [ ] **Plan 09-01, Task 2:** Seed 25+ analytes (2 days)
- [ ] **Plan 09-01, Task 3:** Client Westgard engine (3 days)
- [ ] **Plan 09-01, Task 4:** Server Westgard engine (3 days)
- [ ] **Plan 09-01, Task 5:** Tests + regression check (2 days)

### Execution Wave 2 (2026-06-02 → 2026-06-10)

- [ ] **Plan 09-02, Task 1:** OCR types (1 day)
- [ ] **Plan 09-02, Task 2:** Gemini service + docs (3 days)
- [ ] **Plan 09-02, Task 3:** Fuzzy matching (2 days)
- [ ] **Plan 09-02, Task 4:** Hooks + OCRUploadModal (3 days)
- [ ] **Plan 09-02, Task 5:** Server parser + integration tests (2 days)
- [ ] **Plan 09-02, Task 6:** Audit trail + final regression (1 day)

### Post-Execution (2026-06-11 → 2026-06-13)

- [ ] Create `09-01-SUMMARY.md` (test results, deliverables checklist)
- [ ] Create `09-02-SUMMARY.md` (test results, cost analysis, rollback procedure)
- [ ] Update root ROADMAP.md (Phase 9 status → ✅ COMPLETE)
- [ ] Update CLAUDE.md bioquimica entry (status, last delivery date)
- [ ] Smoke test: H550 image upload → Gemini parse → Westgard evaluation → audit trail
- [ ] Update v1.4 COMPLIANCE_SUMMARY (DICQ blocks F gained)

---

## Success Criteria Summary

### Plan 09-01

- ✅ 25+ analytes seeded with westgardRules config
- ✅ Client evaluateRules() deterministic, 12+ test cases pass
- ✅ Server evaluateRunCompliance() authoritative, 8+ test cases pass
- ✅ All 42 Phase 1 tests still pass (regression-free)
- ✅ Zero TypeScript errors

### Plan 09-02

- ✅ Gemini parses H550 image → JSON in <3s
- ✅ Fuzzy matching >90% accuracy on test scenarios
- ✅ OCR confidence <85% triggers operator review
- ✅ 26 new tests pass, 42 Phase 1 tests still green (68 total)
- ✅ Audit trail: 100% OCR decisions logged (RDC 978 5.3)
- ✅ Dark-first UI: WCAG AA compliant, keyboard nav functional
- ✅ Gemini cost <$0.001 per image
- ✅ Zero TypeScript errors

---

## Reading Order

1. **00-OVERVIEW.md** — Phase 9 vision, dependencies, risk register, readiness
2. **09-01-PLAN.md** — Plan 1 detailed execution (types, seed, Westgard engines, tests)
3. **09-02-PLAN.md** — Plan 2 detailed execution (OCR types, Gemini, fuzzy match, UI, audit)
4. **PHASE_9_RESEARCH.md** — Optional deep-dive if discovery is needed

---

## Key Artifacts (to be generated post-execution)

### Plan 09-01 Summary

- **Location:** `09-01-SUMMARY.md`
- **Contains:** Test results (54 total), deliverables checklist, next phase readiness
- **Timeline:** Generated after Task 5 completion (~2026-06-02)

### Plan 09-02 Summary

- **Location:** `09-02-SUMMARY.md`
- **Contains:** Test results (68 total), cost analysis, Gemini fallback procedure, Phase 9.3 readiness
- **Timeline:** Generated after Task 6 completion (~2026-06-10)

---

## Compliance References

- **RDC 978/2025:** Arts. 161 (audit), 179 (CIQ), 180 (rules)
- **DICQ 4.3 Block F (Analítico):** Westgard, multi-equipment tracking
- **DICQ 4.4:** Append-only audit trail with integrity check
- **ISO 15189:** Traceability, validation, method comparison

---

## Links to Related Phases

- **Phase 9.1 Foundation (completed 2026-05-06):** `09-bioquimica-phase1/`
- **Phase 9.3+ (planned 2026-06-17+):** Batch OCR, semantic matching, multi-instrument
- **Phase 9.4 (planned 2026-06-24):** recordRunBioquimica callable
- **Phase 5 críticos (2026-06-09):** Can leverage OCR pipeline (enhancement, not required)
- **Phase 11 immunology (planned):** Reuse OCR pipeline for strip images

---

## Questions & Escalation

| Question                          | Owner              | Timeline                           |
| --------------------------------- | ------------------ | ---------------------------------- |
| Gemini API key setup blocked?     | CTO/DevOps         | Before Wave 2 start (2026-06-02)   |
| OCR accuracy <90% in production?  | Stream C (IA)      | Week 2 → Phase 9.3 optimization    |
| Westgard rules not matching bula? | Stream A (backend) | Week 1 → adjustment in Task 2 seed |
| Phase 9.4 dependency blocker?     | CTO                | Plan 09-02 completion (2026-06-10) |

---

**Phase Status:** 📋 PLANNED  
**Next Review:** 2026-05-20 (execution kickoff)  
**Target Completion:** 2026-06-10  
**Auditor Pre-Alignment:** Westgard rules documented + audit trail RDC compliant
