# Phase 5 — Critical Findings (Adversarial Audit)

**Date:** 2026-05-08
**Auditor:** gsd-eval-auditor (a019f520212ce4f4a)
**Verdict:** SIGNIFICANT GAPS — DO NOT CLAIM 82%+ DICQ until BLOCKERS resolved
**Coverage:** 4/9 dimensions COVERED (44%) | Score: 51/100

---

## SCOPE ERRATA (2026-05-08)

**WARNING — DOCUMENTATION CORRECTIONS APPLIED. Read before consuming any Phase 5 compliance claim.**

1. **BLOCKER 2 correction — "OCR for Art. 167" does NOT exist in Phase 5.**
   - `functions/src/modules/ia-strip/callables/classifyStripGemini.ts` performs **RDT serology classification** (HIV / dengue / sífilis / COVID / hCG → R/NR), not laudo OCR.
   - Phase 5 Tasks **05-03 and 05-04 are RDT IA Strip Classifier scope ONLY**. They do **NOT** close RDC 978 Art. 167.
   - Art. 167 fields 10–12 (reference values, technical limitations, interpretation data) plus PDF generation and portal médico are **deferred to Phase 6** (Tasks 06-01 / 06-02 / 06-03). This is consistent with the existing acknowledgment in `.planning/PHASE_5_RDC_CRITICAL_VIOLATIONS.md` line 405 ("Phase 5 Action Required: NO ... Phase 6 Action Required: CRITICAL").
   - Any prior wording crediting Phase 5 with Art. 167 closure is rescinded.

2. **BLOCKER 6 correction — DICQ 78.5% → 82%+ swing is PROJECTED, not earned.**
   - The projection assumes `portal-rt`, `portal-paciente`, and `notivisa` are implemented. As of 2026-05-08 these are placeholders or absent (see BLOCKER 6 below).
   - DICQ tracker increments tied to Phase 5 deliverables are **PAUSED** until BLOCKERS 1, 3, 4, 5 close and a re-audit confirms code-level evidence. See banner at top of `docs/DICQ_CLOSURE_TRACKER_v1.4.md`.

3. **No code changes triggered by this errata.** Documentation-only corrections to align planning narrative with shipped code.

---

## 6 BLOCKERS (resolve before any "Phase 5 complete" claim)

### BLOCKER 1: Empty HMAC signatures in criticos module

**File:** `functions/src/modules/criticos/index.ts` lines 200, 364, 488
**Issue:** `hash: ''` literal — violates ADR-0017, RDC 978 Art. 128, Firestore rule `validSignature` (`hash.size() == 64`)
**Impact:** Either (a) Firestore rules accept empty hash = security regression, or (b) writes silently fail = functional regression
**Fix:** Restore `generateChainHash()` calls in all 4 signature emission sites. Add unit test `signature.hash.length === 64`

### BLOCKER 2: "OCR for Art. 167" does not exist

**Reality:** `classifyStripGemini.ts` does **RDT serology classification** (HIV/dengue/syphilis/COVID/HCG → R/NR), NOT laudo OCR
**Doc reference:** `PHASE_5_RDC_CRITICAL_VIOLATIONS.md` line 405 — Art. 167 fields 10–12 explicitly deferred to Phase 6
**Fix:** Stop crediting Task 05-03/04 to Art. 167. Phase 5 = IA Strip Classifier only.

### BLOCKER 3: LGPD Art. 9 not addressed for AI processing

**Issue:** Patient strip images sent base64 to `generativelanguage.googleapis.com` (Google Gemini) with:

- No DPIA addendum specific to Gemini Vision
- No Art. 33 international transfer legal basis documented
- No Art. 7/11 legal basis update
- No consent capture, no purpose limitation, no retention rule
  **Impact:** Regulatory blocker independent of DICQ scoring
  **Fix:** Build LGPD Art. 9 DPIA addendum + amend POL-LGPD-001 + RT/DPO sign-off **before** strip rollout

### BLOCKER 4: Critical Values UI is a placeholder

**File:** `src/features/criticos/CriticosPlaceholder.tsx` ships text "Phase 10-03: Em desenvolvimento"
**Issue:** Backend works, frontend doesn't exist. No `CriticosThresholdsAdmin`, no `ComunicacaoModal`, no threshold CRUD
**Fix:** Build the actual UI (Task 05-01 deliverable per plan)

### BLOCKER 5: Wave 0 modules status conflict (lab-apoio, turnos)

**Issue:**

- Root `CLAUDE.md` claims `lab-apoio` + `turnos` "Em prod 2026-05-07"
- Module `CLAUDE.md` files claim T5–T10 pending (deploy + claim provisioning)
  **Impact:** Audit cannot proceed on contradictory truth
  **Fix:** Verify via `firebase functions:list`. If T9–T10 not done, demote rows to "In dev"

### BLOCKER 6: DICQ 78.5% → 82%+ projection unsupported

**Issue:** Phase 5 contribution per `DICQ_CLOSURE_TRACKER_v1.4.md` depends on:

- portal-rt (no implementation evidence)
- portal-paciente (no implementation evidence)
- NOTIVISA integration (notivisa-portal placeholder only)
  **Fix:** Don't update DICQ tracker with Phase 5 deltas until evidence aligns. Projected swing is doc-driven, not code-driven.

---

## ⚠️ WARNINGS (PARTIAL coverage)

| Dimension                                | Issue                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| RDC 978 Art. 5.7.1 (criticos <60min)     | Backend present + SLA tracking ✓; UI placeholder ✗; HMAC empty hash regression ✗                                 |
| RDC 978 Art. 122 (supervisor presencial) | Designation tracked ✓; checkin/checkout primitive missing ✗; rule enforcement missing ✗                          |
| RDC 978 Art. 128 (rastreabilidade)       | `onContratoEventCreated` + `onTurnoEventCreated` triggers OK; criticos chain broken (BLOCKER 1)                  |
| DICQ 5.7.1                               | Backend logic exists; UI placeholder; signature hashes empty                                                     |
| DICQ 4.14.7 (KPIs)                       | Out of scope — Phase 4 deliverable per DICQ_CLOSURE_TRACKER, not Phase 5                                         |
| RDC 978 Art. 86 (PGQ)                    | IA dataset feedback = at best Component 6 contribution. Umbrella article is Phase 8 deliverable. Stop inflating. |

---

## ✅ COVERED (no remediation needed)

- RDC 978 Arts. 36–39 (lab-apoio contracts) — full module + 9 callables + AvaliacaoPeriodica history (subject to BLOCKER 5)
- DICQ 4.14.8 (lab-apoio external evals) — `AvaliacaoPeriodica` append-only history
- DICQ 4.1.2.7 (supervisor designation, not enforcement) — designation tracked

---

## 🔧 INFRASTRUCTURE GAPS

| Component                           | Status  | Gap                                                                                                     |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| AI eval framework (Promptfoo/RAGAS) | MISSING | No regression suite for `classifyStripGemini` accuracy. Confidence threshold 0.85 enforced runtime only |
| Reference dataset                   | PARTIAL | Plan claims 500+ images; no labeled fixtures in repo                                                    |
| CI eval gate                        | MISSING | No `npm run eval:ia`, no Promptfoo config, no CI gate                                                   |
| PII guardrail                       | MISSING | Patient images flow to Gemini without redaction or consent gate                                         |
| Audit log error handling            | PARTIAL | `.catch(() => {})` swallows errors silently — observability hole                                        |

---

## 📋 REMEDIATION (PRIORITY ORDER)

**MUST FIX before any auditor-facing Phase 5 claim:**

1. **HMAC restoration** — fix all 4 empty `hash: ''` sites in criticos. Add `signature.hash.length === 64` test. (BLOCKER 1)
2. **Status reconciliation** — `firebase functions:list` audit. Demote root CLAUDE.md rows if not deployed. (BLOCKER 5)
3. **Art. 122 enforcement** — add checkin/checkout primitive to turnos. Currently designation-only = no compliance gain vs v1.3. (WARNING)
4. **LGPD Art. 9 DPIA** — block strip rollout until amendment approved. (BLOCKER 3)
5. **Critical Values UI** — replace `CriticosPlaceholder.tsx` with real components. (BLOCKER 4)
6. **Stop Art. 86 inflation** — Task 05-04 contributes Component 6 only; PGQ closure remains Phase 8. (WARNING)
7. **Don't update DICQ tracker** until items 1–6 done. (BLOCKER 6)

---

## 🎯 SHOULD FIX (POST-BLOCKER)

- Promptfoo eval suite + CI gate for `classifyStripGemini` accuracy regression
- PII redaction or explicit-consent guardrail before sending patient images to Gemini
- Replace `.catch(() => {})` with retry+alerting in audit log writes
- Reconcile competing `.planning/phases/05-*` trees (`05-criticos-ia-strip`, `05-criticos-ia`, `05-auditoria-interna`) — archive duplicates

---

## 📁 RELEVANT PATHS

- `functions/src/modules/criticos/index.ts` — empty HMAC hashes (BLOCKER 1)
- `src/features/criticos/CriticosPlaceholder.tsx` — placeholder UI (BLOCKER 4)
- `functions/src/modules/ia-strip/callables/classifyStripGemini.ts` — RDT classifier (correctly scoped — NOT OCR)
- `src/features/lab-apoio/CLAUDE.md` — module status conflict (BLOCKER 5)
- `src/features/turnos/CLAUDE.md` — module status conflict (BLOCKER 5)
- `.planning/PHASE_5_RDC_CRITICAL_VIOLATIONS.md` — source of Wave 0 recommendation
- `.planning/phases/05-criticos-ia-strip/PHASE_5_OVERVIEW.md` — official Phase 5 plan (planning, not executed)
- `docs/DICQ_CLOSURE_TRACKER_v1.4.md` — DO NOT update until BLOCKERS resolved

---

## 🔍 BOTTOM LINE

User's prompt asked Phase 5 to close 6 RDC articles + 4 DICQ sections + LGPD Art. 9. Codebase delivers ~30% with one production-blocking regression (empty HMAC) and one scope mismatch (RDT classification ≠ Art. 167 OCR).

**Recommendation:** Pause DICQ tracker update. Resolve 6 BLOCKERs. Then re-audit.
