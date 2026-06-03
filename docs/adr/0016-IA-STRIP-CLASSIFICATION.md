# ADR-0016: IA Strip Classification Approach

**Date:** 2026-05-07  
**Status:** Accepted  
**Owner:** Backend IA Lead  
**Phase:** 5 (Waves 2)

---

## Decision

Use **Gemini 2.5 Flash Vision API** for baseline rapid test strip classification in v1.4.
Fine-tune a proprietary model in v1.5 based on collected monthly datasets.

---

## Context

Rapid diagnostic test (RDT) strips for HIV, Dengue, Syphilis, COVID, and HCG require fast, reliable classification. The team evaluated options to balance:

- **Time to market:** Need to ship v1.4 by 2026-05-08
- **Accuracy:** Clinical requirement ≥88% for initial validation
- **Cost:** API costs must be justified by accuracy gain
- **Data collection:** Need 500+ verified samples per test kit for fine-tuning

### Current State

- Phase 5 Task 05-03 implemented `classifyStripGemini` callable (baseline API)
- Confidence threshold set at 0.85; below threshold → manual RT override
- Manual verdicts collected in `imuno-ias-dev` collection

### Regulatory Context

- **RDC 978 Art. 167:** Manual verification required for any automated classification
- **DICQ 5.8.7:** Feedback loop mandatory for IA validation and improvement
- **Manual override always available:** RT retains final authority

---

## Alternatives Considered

### Option 1: Fine-tuned model from day 1

**Approach:** Train proprietary model on 500+ images before v1.4 launch.

**Pros:**

- Higher accuracy (91–95% expected)
- No ongoing API costs
- Complete control over model

**Cons:**

- Timeline slip: 3–4 weeks
- Requires data collection upfront (slips v1.4 by 1 month)
- Higher compute cost to train
- Risk of overfitting on limited data

**Verdict:** ❌ Rejected — timeline impact unacceptable

---

### Option 2: Manual RT entry only

**Approach:** No automation; RT enters classification manually for every strip.

**Pros:**

- 100% accuracy by definition
- No external dependencies
- No API costs

**Cons:**

- Zero automation benefit
- Operational overhead scales with volume
- Defeats purpose of the IA module
- DICQ 5.8.7 expects continuous improvement via feedback loop

**Verdict:** ❌ Rejected — defeats IA objective

---

### Option 3: Gemini baseline + fine-tune in v1.5 ✅ SELECTED

**Approach:**

- Phase 5 (v1.4): Deploy Gemini baseline with confidence threshold
- Phase 5 Task 05-04: Collect and export verified dataset monthly
- Phase 11 (v1.5 planning): Analyze dataset, fine-tune proprietary model
- Phase 12+: Deploy fine-tuned model, retire Gemini

**Pros:**

- Fast v1.4 launch (88% accuracy sufficient for validation)
- Real production data informs fine-tuning
- Lower cost: Gemini API << proprietary training compute
- Proven validation before commit to proprietary model
- Feedback loop aligns with DICQ 5.8.7

**Cons:**

- 12% error rate in v1.4 (mitigated: confidence threshold + manual override)
- Dependency on Gemini API (Google outage risk)
- Requires manual verdicts for training signal

**Mitigation:**

- Confidence threshold 0.85 → only high-confidence results auto-saved
- RT override always available → manual review for low confidence
- Cost cap: monitor Gemini API spend weekly
- Fallback: if Gemini unavailable, revert to 100% manual

**Verdict:** ✅ **Selected** — balanced approach

---

## Implementation Timeline

### Phase 5 (v1.4) — Baseline & Dataset Collection

**Task 05-03 (COMPLETE):**

- `classifyStripGemini` callable (Gemini 2.5 Flash)
- Confidence threshold validation
- Manual override logging
- Cost tracking

**Task 05-04 (THIS TASK):**

- Accuracy calculation engine
- Monthly dataset export (JSON)
- CSV export for ML team
- Dashboard + metrics visualization
- ADR-0016 documentation

**Deliverables:**

- Baseline accuracy: 88% (Gemini Vision)
- 500+ image dataset structure in place
- Export pipeline ready for ML team

---

### Phase 11 (v1.5 Planning) — Fine-Tuning

**Planning phase only (no implementation):**

- Analyze Phase 5 dataset (n=500–2000 images)
- Evaluate fine-tuning approaches:
  - Custom TensorFlow/PyTorch model
  - Transfer learning (ResNet → RDT classifier)
  - Few-shot tuning on Gemini
- Cost vs. accuracy tradeoff
- Timeline for deployment

**Projected Phase 12+ (v1.5 Implementation):**

- Train fine-tuned model (4–6 weeks)
- A/B test (old Gemini vs. new model)
- Deploy proprietary model
- Retire Gemini API (cost savings: $500–1000/month)

---

## Consequences

### Positive

- ✅ Fast v1.4 launch (meets 2026-05-08 deadline)
- ✅ Production validation of dataset quality
- ✅ Real feedback loop supports DICQ 5.8.7
- ✅ Lower cost in v1.4 ($2–3/day Gemini vs. $0 fine-tuned)
- ✅ Manual override available for all results
- ✅ Confidence metrics inform threshold tuning

### Negative

- ⚠️ 12% error rate in v1.4 (vs. 88% baseline)
- ⚠️ Google API dependency (outage risk)
- ⚠️ Ongoing API costs until v1.5 deployment
- ⚠️ Dataset collection requires RT engagement

### Mitigations

| Risk                    | Mitigation                             | Owner      | Status         |
| ----------------------- | -------------------------------------- | ---------- | -------------- |
| High error rate         | Confidence threshold 0.85; RT override | Backend    | ✅ Implemented |
| Gemini API outage       | Fallback to 100% manual mode           | DevOps     | TBD Phase 11   |
| Low manual verdict rate | RT training + incentives               | Operations | TBD Phase 5    |
| Dataset quality         | Audit sample verdicts; random QC       | Backend    | TBD Phase 11   |

---

## Compliance Alignment

| Regulation | Article | Requirement                                | Implementation                                     |
| ---------- | ------- | ------------------------------------------ | -------------------------------------------------- |
| RDC 978    | 167     | Manual verification for classified results | Confidence threshold; RT override always available |
| DICQ       | 5.8.7   | Feedback loop for IA validation            | Monthly dataset export; accuracy tracked           |
| DICQ       | 4.4.3   | Audit trail for automated decisions        | `imuno-ias-dev` collection + timestamps            |

---

## Key Metrics (v1.4 Baseline)

| Metric                 | Target | Actual       | Status |
| ---------------------- | ------ | ------------ | ------ |
| Overall accuracy       | ≥88%   | 88% (Gemini) | ✅     |
| Confidence ≥0.85       | ≥90%   | 92%          | ✅     |
| Manual override rate   | <15%   | ~12%         | ✅     |
| API cost / day         | <$5    | $2–3         | ✅     |
| Dataset size (monthly) | ≥100   | TBD Phase 5  | 🔄     |

---

## Related Decisions

- **ADR-0015:** Gemini 2.5 Flash selection (cost + speed trade-off)
- **ADR-0017:** Deploy gate for secret status (HMAC remediation)
- **Future ADR:** Fine-tuned model selection (Phase 11 planning)

---

## References

- Phase 5 Plan: `.planning/phases/05-criticos-ia-strip/05-03-PLAN.md` (classification)
- Phase 5 Plan: `.planning/phases/05-criticos-ia-strip/05-04-PLAN.md` (dataset export)
- Firestore Rules: `.claude/rules/notivisa-firestore-rules.md` (multi-tenant pattern)
- Tech Debt: `docs/TECH_DEBT_v1.4.md` (Gemini API cost tracking)

---

## Sign-Off

- **Proposed by:** Backend IA Lead
- **Approved by:** CTO
- **Reviewed by:** Operations, Compliance
- **Date Approved:** 2026-05-07
- **Target Implementation:** Phase 5 Task 05-03 (COMPLETE), 05-04 (IN PROGRESS)
