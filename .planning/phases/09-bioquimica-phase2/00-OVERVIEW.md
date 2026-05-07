# Phase 9 — Bioquímica Phase 2 + IA Strip OCR Foundation

**Milestone:** v1.4 Phase 9 (RDC 978 Art. 179, DICQ 4.3 Block F)  
**Period:** 2026-05-20 → 2026-06-10 (3 weeks)  
**Team:** 2 FTE (Stream A backend, Stream C IA specialist)  
**Status:** 📋 PLANNED (follows Phase 9.1 Foundation, enables Phase 9.3+ OCR enhancements)

---

## Vision

**Phase 9.1 Foundation** (2026-05-06, complete):
- 16 core analytes seeded
- Westgard CLSI engine stub
- Schema + service layer
- 42 unit tests

**Phase 9.2** (this phase — 2026-05-20 to 2026-06-10):
- **Plan 09-01:** Expand seed 16 → 25+ analytes, implement client + server Westgard engines, 20+ tests
- **Plan 09-02:** Gemini 2.5 Flash Vision integration, fuzzy matching, dark-first OCR UI, audit trail, 26+ tests

**Phase 9.3+** (future):
- Batch OCR processing (multi-image import)
- Semantic matching enhancement (LLM-based)
- Multi-instrument support (Abbott, Siemens SDKs)
- Phase 5 críticos strip + Phase 11 immunology strip OCR reuse same pipeline

---

## Plans

### Plan 09-01 — Analyte Expansion + Westgard Engine

**Objective:** Expand analyte library 16 → 25+ with complete Westgard CLSI rules engine. Client + server deterministic validation.

**Wave:** 1 (parallel with 09-02, no blocking dependencies)

**Deliverables:**
- 25+ analyte seed dataset (glucose, urea, creatinine, albumin, … TSH)
- Client-side Westgard engine (westgardRulesCLSI.ts, deterministic)
- Server-side Westgard engine (authoritative, Phase 9.4 recordRunBioquimica integration)
- Type definitions (Analito, WestgardConfig, RuleViolation, RunComplianceResult)
- 20+ unit tests (CLSI rules, extended rules, edge cases)
- Regression: all 42 Phase 1 tests still pass

**Key Milestones:**
- Task 1 (types): 2 days
- Task 2 (seed data): 2 days
- Task 3 (client engine): 3 days
- Task 4 (server engine): 3 days
- Task 5 (tests + regression): 2 days

**Success Criteria:**
- ✅ 25+ analytes seeded with westgardRules config
- ✅ Client evaluateRules() passes 12+ test scenarios
- ✅ Server evaluateRunCompliance() mirrors client logic
- ✅ 62+ total tests pass (42 Phase 1 + 20 Phase 9.1)
- ✅ Zero TypeScript errors
- ✅ DICQ 4.3 (Westgard documented)

---

### Plan 09-02 — Gemini Vision OCR + Fuzzy Matching + Audit Trail

**Objective:** Build end-to-end OCR pipeline: H550 image → Gemini parse → fuzzy match against seed → operator review gate → audit trail.

**Wave:** 2 (depends on 09-01 analyte seed + Westgard types)

**Deliverables:**
- Gemini 2.5 Flash Vision service (parseImageWithGemini, custom prompt, error handling)
- Fuzzy matching utility (Levenshtein + semantic, 70–100% confidence scoring)
- React hooks: useGeminiVision (state management), useOCRValidation (audit logging)
- Dark-first OCRUploadModal component (upload, progress states, results, approval flow)
- Server-side fallback parser (rate-limiting backup)
- Audit trail recording (RDC 978 Art. 161 + DICQ 4.3 append-only)
- End-to-end docs: BIOQUIMICA_OCR_INTEGRATION.md (flow diagram, prompt template, error scenarios)
- 26+ unit tests (fuzzy match, integration scenarios, audit, regression)

**Key Milestones:**
- Task 1 (OCR types): 1 day
- Task 2 (Gemini service + docs): 3 days
- Task 3 (fuzzy match): 2 days
- Task 4 (hooks + UI): 3 days
- Task 5 (server parser + integration tests): 2 days
- Task 6 (audit trail + regression): 1 day

**Success Criteria:**
- ✅ Gemini 2.5 Flash parses H550 images → JSON in <3s
- ✅ Fuzzy matching >90% accuracy on test set
- ✅ OCR confidence <85% triggers manual review
- ✅ 26+ new tests pass, 42 Phase 1 tests still green (68 total)
- ✅ Audit trail: 100% OCR decisions logged (RDC 978 5.3)
- ✅ Dark-first UI: WCAG AA 4.5:1 contrast, keyboard nav functional
- ✅ Cost model: <$0.001 per image (Gemini Flash)
- ✅ Zero TypeScript errors

---

## Wave Structure

```
Wave 1 (Parallel):
├── 09-01: Analyte expansion + Westgard engines (5 tasks, ~12 days)
└── 09-02: Gemini integration + fuzzy match (6 tasks, ~12 days)

Wave 2 (Sequential, depends on Wave 1):
├── Phase 9.3: Batch OCR + semantic enhancement
├── Phase 9.4: recordRunBioquimica callable (uses Westgard + OCR results)
└── Phase 9.5: Cost analysis + monitoring (post-production)
```

---

## Dependencies & Blockers

### Plan 09-01 → Plan 09-02
- **Dependency:** Plan 09-01 analyte seed must be live before Plan 09-02 fuzzy matching works
- **Mitigation:** Both plans can start in parallel; Plan 09-02 uses mock seed for initial development

### Phase 9.2 → Phase 9.4 (recordRunBioquimica callable)
- **Dependency:** Westgard engines from Plan 09-01 + OCR validation from Plan 09-02 must be complete
- **Timeline:** Phase 9.4 kicks off after both plans stabilize (~2026-06-15)

### Phase 9.2 → Phase 5 (críticos escalation)
- **Dependency:** OCR pipeline architecture can be reused for Phase 5 strip parsing
- **Not blocking:** Phase 5 proceeds independently; OCR foundation is optional enhancement

---

## Compliance Coverage

### RDC 978 Art. 179 (CIQ Mandatory)
- ✅ **Plan 09-01:** Westgard CLSI rules (1-2s, 1-3s, 2-2s, R-4s) mandatory per art. 179
- ✅ Extended rules optional (4-1s, 10x, 6T, 6X) config-enabled per art. 180

### RDC 978 Art. 161 (Audit Trail)
- ✅ **Plan 09-02:** LogicalSignature (hash, operatorId, timestamp) on all OCR decisions
- ✅ Append-only audit collection (immutable, chainHash integrity)

### DICQ 4.3 (Bloco F — Analítico)
- ✅ **Plan 09-01:** Westgard rules documented in code + test scenarios
- ✅ **Plan 09-02:** OCR confidence scoring + operator review gate
- ✅ Multi-equipment tracking (analito × equipment × nivel tuple)

### DICQ 4.4 (Trilha de Auditoria)
- ✅ **Plan 09-02:** Image → parse → match → decision audit trail

---

## Test Coverage

| Category | Phase 9.1 | Phase 9.2 | Total |
|----------|-----------|-----------|-------|
| Unit (Westgard) | 12 | — | 12 |
| Unit (OCR) | — | 7 (fuzzy) + 3 (parser) + 2 (audit) | 12 |
| Integration | — | 5 (OCR scenarios) | 5 |
| Regression (Phase 1) | 42 | 42 | 42 |
| **TOTAL** | **54** | **68** | **68** |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Gemini API rate limit exceeded | Medium | High | Server-side fallback parser (Task 5), batch processing (Phase 9.3) |
| OCR accuracy <90% on production images | Medium | High | 100+ test images, confidence thresholds, operator override UI |
| Fuzzy match false negatives | Low | Medium | Semantic matching enhancement (Phase 9.3), operator suggestions |
| Analyte seed drift (client vs server) | Low | Medium | Parity tests in CI (Task 2) |
| Performance: image processing >5s | Low | Medium | Optimize Gemini prompt (Task 2), async processing |
| Cost overrun (Gemini API) | Low | Low | Cost monitoring (Phase 9.5), batch optimization (Phase 9.3) |

---

## Readiness for Phase 9.3+

| Component | Status | Notes |
|-----------|--------|-------|
| Analyte seed (25+) | ✅ Plan 09-01 | Expandable to 50+ in Phase 9.3 |
| Westgard engines | ✅ Plan 09-01 | Extended rules ready for activation (Phase 9.3+) |
| OCR pipeline | ✅ Plan 09-02 | Reusable for Phase 5 (críticos strip) + Phase 11 (immunology) |
| Fuzzy matching | ✅ Plan 09-02 | Semantic enhancement ready (Phase 9.3) |
| Batch processing | 📅 Phase 9.3 | Skeleton ready, implementation deferred |
| Multi-instrument | 📅 Phase 9.3 | H550 primary test, Abbott/Siemens design-ready |
| Cost model | 📅 Phase 9.5 | Monitoring infrastructure from Phase 9.2 |

---

## Deliverables Checklist

### Plan 09-01
- [ ] 25+ analytes seeded (glucose, urea, creatinine, albumin, …, TSH)
- [ ] Analito type extended with westgardRules
- [ ] Client Westgard engine (westgardRulesCLSI.ts, 200+ lines)
- [ ] Server Westgard engine (westgardEngine.ts, 250+ lines)
- [ ] 12+ Westgard test cases (CLSI + extended rules)
- [ ] 8+ server engine test cases
- [ ] All 42 Phase 1 tests still passing
- [ ] Zero TypeScript errors
- [ ] Commit: `feat(bioquimica): expand seed + Westgard engines (Phase 9.1)`

### Plan 09-02
- [ ] OCR type definitions (ParsedAnalyte, MatchResult, OCRValidationResult, etc.)
- [ ] Gemini Vision service (parseImageWithGemini, prompt template)
- [ ] Fuzzy matching utility (Levenshtein + semantic, 100 lines)
- [ ] useGeminiVision hook (state management, 150+ lines)
- [ ] OCRUploadModal component (dark-first, 200+ lines)
- [ ] Server-side OCR fallback parser
- [ ] Audit trail recording service (RDC 978 5.3 compliance)
- [ ] 7+ fuzzy match test cases
- [ ] 5+ OCR integration scenarios (perfect, low conf, unmatched, timeout, malformed)
- [ ] 2+ audit trail test cases
- [ ] BIOQUIMICA_OCR_INTEGRATION.md documentation (flow, prompt, error handling)
- [ ] All 42 Phase 1 tests still passing
- [ ] Zero TypeScript errors
- [ ] Commits:
  - `feat(bioquimica): add OCR types + Gemini service`
  - `feat(bioquimica): implement fuzzy matching + dark-first UI`
  - `feat(bioquimica): record OCR audit trail (RDC 978 5.3)`
  - `test(bioquimica): add 26+ OCR tests (zero regressions)`

---

## Next Steps (Post-Phase 9.2)

1. **Phase 9.3 (2026-06-17):** Batch OCR + semantic matching enhancement
2. **Phase 9.4 (2026-06-24):** recordRunBioquimica callable (records Westgard + OCR results to Firestore)
3. **Phase 9.5 (2026-07-01):** Cost analysis + monitoring + Phase 9 retrospective
4. **Phase 5 (críticos escalation):** Can leverage OCR pipeline for strip parsing (deferred)
5. **Phase 11 (immunology):** Reuse OCR + fuzzy matching for immunology strip images

---

**Prepared:** 2026-05-07  
**Last Updated:** 2026-05-07  
**Status:** 📋 PLANNED (ready for execution 2026-05-20)
