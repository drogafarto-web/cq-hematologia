# Phase 5 Execution Summary: Critical Values + IA Foundation

**Milestone:** v1.4 (Wave 2)  
**Duration:** 2 weeks (Week 4–5 of v1.4)  
**Status:** Planning Complete  
**Created:** 2026-05-07  

---

## Overview

Phase 5 splits into **4 parallel task streams** executed by Stream B (frontend) + Stream C (IA lead):
- Task 05-01 (Days 1–4): Threshold config engine
- Task 05-02 (Days 3–7): Critical escalation + SLA
- Task 05-03 (Days 4–8): IA upload + Gemini Vision
- Task 05-04 (Days 6–10): Feedback loop + dataset aggregation

**Critical path:** 05-01 → 05-02 (sequential) + 05-03, 05-04 (parallel with 05-02)

---

## Task Stream Overview

| Task | Focus | Duration | Dependency | Deliverable |
|---|---|---|---|---|
| **05-01** | Threshold CRUD + routing rules | 3–4d | Phase 3 ✓ | Config UI + service layer |
| **05-02** | Detection engine + SMS escalation + SLA | 3–4d | 05-01 ✓ | Callables + dashboard |
| **05-03** | Image upload + Gemini Vision API | 2–3d | Phase 3 ✓ | Strip classifier module |
| **05-04** | Accuracy calculation + dataset export | 2–3d | 05-03 ✓ | Aggregator + ADR-0016 |

---

## Key Deliverables

### Phase 5 Code Output
```
src/features/criticos/
  ├─ types/threshold.ts
  ├─ services/thresholdService.ts
  ├─ utils/routingEngine.ts
  ├─ components/ThresholdConfigPanel.tsx
  ├─ components/EscalacaoDashboard.tsx
  ├─ components/AcknowledgeModal.tsx
  ├─ hooks/useDetectCritico.ts
  └─ __tests__/

src/features/ciq-imuno/strip-classifier/
  ├─ StripUploadComponent.tsx
  ├─ ImunoIADashboard.tsx
  ├─ types.ts
  └─ __tests__/

functions/src/modules/criticos/
  ├─ escalacaoCriticos.ts
  ├─ escalarCriticoViaSmS.ts
  ├─ escalacao-sla-monitor.ts

functions/src/modules/ciqImuno/
  ├─ classifyStripGemini.ts
  ├─ confidenceValidation.ts
  ├─ accuracyCalculator.ts
  ├─ collectIADataset.ts
  └─ handleMLTeamFeedback.ts (placeholder)

Firestore:
  ├─ firestore.rules (updated)
  ├─ firestore.indexes.json (new indexes)

Docs:
  ├─ docs/adr/0014-CRITICAL-VALUES-ESCALATION.md
  └─ docs/adr/0016-IA-STRIP-CLASSIFICATION.md
```

### Regulatory Artifacts
- **RDC 978 coverage:** Arts. 17, 128, 167, 184-191 (critical escalation + audit trail)
- **DICQ compliance:** 5.8.7 (critical values), 4.4.3 (audit trail), 4.14.5 (SLA tracking)

---

## Acceptance Criteria (All Tasks)

**Phase 5 is complete when:**

1. **Functionality**
   - [ ] Threshold config CRUD functional + tested
   - [ ] Critical detection <200ms latency
   - [ ] SMS delivery >99% in <2 min
   - [ ] SLA tracking (red/amber/green) operational
   - [ ] IA image upload working on mobile + desktop
   - [ ] Gemini Vision classification <3s p99
   - [ ] Confidence validation (0.85 threshold) enforced
   - [ ] Dataset collection ongoing (500+ images by phase end)
   - [ ] Accuracy dashboard real-time + accurate

2. **Quality**
   - [ ] 0 critical linter errors
   - [ ] 0 TypeScript type errors
   - [ ] Unit tests ≥80% coverage (all tasks)
   - [ ] E2E test suite (10+ specs) all passing

3. **Integration**
   - [ ] Laudo creation triggers detection + escalacao
   - [ ] Escalacao triggers SMS + in-app notification
   - [ ] Dashboard loads real data from Firestore
   - [ ] Manual override tracked in audit trail

4. **Security & Compliance**
   - [ ] RBAC enforced (RT + admin roles)
   - [ ] Audit trail 100% (escaladoEm, escaladoPor, acknowledgedAt)
   - [ ] Soft-delete enforced (RN-06)
   - [ ] No PII in images/exports
   - [ ] Signed URLs on Firebase Storage (24h expiry)

5. **Performance**
   - [ ] Detection: <200ms
   - [ ] SMS send: <10s
   - [ ] SLA cron: <10s for 100 labs
   - [ ] Dashboard: <1s load
   - [ ] Gemini call: <3s p99

---

## Timeline & Milestones

### Week 4 (Phase 5 Start)

**Days 1–2:**
- Task 05-01: Threshold service implementation
- Code review + merge

**Days 3–4:**
- Task 05-02: Detection engine logic
- Task 05-01: Config UI
- Begin Task 05-03: Camera UI

### Week 5

**Days 1–2:**
- Task 05-02: Escalacao callable + SMS integration
- Task 05-03: Gemini Vision integration
- Begin Task 05-04: Accuracy calculator

**Days 3–4:**
- Task 05-02: SLA cron + dashboard
- Task 05-03: Confidence validation
- Task 05-04: Dataset export aggregator

**Days 5–6 (buffer):**
- E2E testing + bug fixes
- Code review + final sign-off

---

## Risk & Mitigation

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Gemini API quota exceeded | IA stops classifying | Medium | $500/month alert; scale to fine-tuned model v1.5 |
| False positive critical flags | Lab workflow disruption | Medium | Gradual rollout (1 analyte, 1 week); monitor false positives |
| SMS delivery delays (Twilio) | SLA breach | Low | Email fallback; incident log; Twilio escalation |
| Low IA accuracy (<70%) | Patient safety hazard | Low | 0.85 confidence threshold; manual override always allowed |
| Performance regression | Web Vitals miss targets | Medium | Baseline Week 1; weekly monitoring; pre-merge gate |

---

## Dependencies & Handoff

### Incoming (from Phase 3)
- ✅ Schema: `criticos-escalacoes`, `criticos-thresholds`, `criticos-routing`, `imuno-ias-dev`
- ✅ Helpers: `smsTemplate`, `iaStripValidator`, `notivisaFormatter`, `criticoDetector`
- ✅ Twilio account + API keys
- ✅ Gemini 2.5 Flash API access

### Outgoing (to Phases 6–11)
- Phase 6 (Satisfação): Laudo escalacao status accessible in portal
- Phase 8 (NOTIVISA): Critical escalacao triggers NOTIVISA draft
- Phase 11 (IA fine-tuning, v1.5): Collected dataset + accuracy baseline

---

## Parallel Execution Notes

### Stream Coordination

**Stream B (Frontend):**
- Task 05-01: Threshold config UI (3–4d)
- Task 05-02: Dashboard UI (2–3d, starts Day 3)
- Task 05-03: Camera + upload UI (2–3d, starts Day 4)

**Stream C (IA lead):**
- Task 05-02: Escalacao + SMS callables (3–4d, starts Day 3)
- Task 05-03: Gemini Vision callable (2–3d, starts Day 4)
- Task 05-04: Accuracy + export (2–3d, starts Day 6)

**Daily sync:** 15-min standup (Stream B + C) to coordinate callable interfaces + test data.

---

## Testing Strategy

### Unit Tests (Per Task)
- Threshold service: 10+ specs
- Detection engine: 8+ specs
- SMS + SLA: 7+ specs
- Gemini integration: 6+ specs
- Accuracy calc: 5+ specs

### Integration Tests
- End-to-end: laudo creation → escalacao → SMS → dashboard update
- IA pipeline: upload → Gemini classify → confidence check → result populate

### E2E Test Suite (10+ specs)
1. Create laudo with critical RBC <3.0 → escalacao created
2. Escalacao SMS sent + logged in Firestore
3. SLA dashboard shows red status
4. User acknowledges → status green
5. Upload imuno strip image → Gemini classifies
6. Confidence ≥0.85 → auto-accept result
7. Confidence <0.85 → flag for RT review
8. RT overrides result → audit logged
9. SLA cron marks overdue as EXPIRED
10. Monthly export generates correct JSON

---

## Regulatory Alignment

### RDC 978 Coverage
- **Art. 17 (Critical values):** Task 05-02 detection engine ✅
- **Art. 128 (Audit trail):** All tasks log operador + timestamp ✅
- **Art. 167 (Emergency procedures):** Task 05-03 manual override ✅
- **Arts. 184-191 (SLA tracking):** Task 05-02 SLA monitoring ✅

### DICQ Alignment
- **5.8.7 (Critical values):** Detection + escalation ✅
- **4.4.3 (Audit trail):** All state changes logged ✅
- **4.14.5 (SLA tracking):** Dashboard + monitoring ✅

---

## Knowledge Artifacts (ADRs)

**ADR-0014: Critical Values Escalation Model**
- Threshold configuration per lab
- Escalation routing rules
- Manual acknowledgment gate
- SLA tracking + monitoring

**ADR-0016: IA Strip Classification Approach**
- Gemini baseline (v1.4) vs. fine-tuned (v1.5)
- Confidence threshold (0.85)
- Manual override always available
- Dataset collection strategy

---

## Post-Phase-5 Planning (v1.5 Prep)

- **IA fine-tuning:** Collect 1000+ images, train proprietary model
- **WhatsApp escalation:** Integration with WhatsApp Business API
- **PNCQ integration:** Import external QC results from PNCQ Gestor
- **Multi-tenant v2:** Extend to N labs per deploy

---

## Deliverable Checklist

### Phase 5 Documentation
- [ ] PHASE_5_OVERVIEW.md ✅
- [ ] 05-01-PLAN.md ✅ (threshold config)
- [ ] 05-02-PLAN.md ✅ (escalation + SLA)
- [ ] 05-03-PLAN.md ✅ (IA upload + Gemini)
- [ ] 05-04-PLAN.md ✅ (feedback loop + export)
- [ ] EXECUTION_SUMMARY.md ✅ (this document)

### Code Artifacts
- [ ] Threshold service + CRUD UI
- [ ] Escalacao callables + SMS
- [ ] SLA cron monitor + dashboard
- [ ] IA strip upload component
- [ ] Gemini Vision integration
- [ ] Accuracy calculator + export
- [ ] Firestore rules + indexes
- [ ] 78+ unit tests
- [ ] 10+ E2E tests
- [ ] ADR-0014, ADR-0016

---

## Success Metrics

**by Phase 5 end:**

1. Critical value detection: <200ms latency (measured)
2. SMS delivery: >99% success rate (Twilio logs)
3. SLA dashboard: real-time status (red/amber/green)
4. IA accuracy baseline: ~88% (Gemini Vision)
5. Dataset collected: 500+ labeled images
6. Code quality: 0 critical linter errors, 80%+ test coverage
7. Compliance: 100% audit trail, 0 security findings

---

## Escalation & Support

**Stream Leads:** Contact within 24h if:
- Blocking dependency unresolved
- Technical architectural decision needed
- Integration test failure after merge

**CTO:** Final approval on ADRs + regulatory compliance

---

## Version Control

- **Planned:** 2026-05-07
- **Execution start:** 2026-05-13 (Week 4 of v1.4)
- **Target completion:** 2026-05-27 (Week 5)
- **Next phase (06-Satisfação):** 2026-05-28

---

**Document version:** 1.0  
**Status:** Ready for Execution  
**Owner:** Stream B + Stream C  
**Last updated:** 2026-05-07
