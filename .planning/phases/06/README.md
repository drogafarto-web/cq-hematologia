# Phase 6: Critical Values Escalation & Notifications — Documentation Index

**Status:** READY FOR EXECUTION  
**Date:** 2026-05-07  
**Effort Estimate:** 2 weeks (100 dev hours + 20 ops hours)  
**Dependencies:** Twilio contract confirmation  

---

## Quick Navigation

### For CTO (Approval + Architectural Decisions)

Start here:
1. **PHASE_6_EXECUTIVE_SUMMARY.md** — 1-page summary, approval checklist, timeline
2. **docs/adr/ADR-0019-critical-values-escalation.md** — Architecture decision rationale + alternatives

Then review:
3. **PHASE_6_DETAILED_PLAN.md** (Section 1-2: Architecture + Schema) — Verify Firestore design

---

### For Dev Team (Implementation)

Start here:
1. **PHASE_6_DETAILED_PLAN.md** — Complete technical specification (1,543 lines)
   - Section 1: Architecture overview
   - Section 2: Firestore schema (3 new collections + indexes)
   - Section 3: 7 Cloud Function callables + 1 cron trigger
   - Section 4: SMS & email templates
   - Section 5: Twilio integration details
   - Section 6: Unit test specs (20+ tests)
   - Section 7: E2E test scenarios (5+ specs)
   - Section 8-14: Data migration, runbook, references, approval checklist

Then build:
2. **Check Section 15: Approval Checklist** — Gate your work against success criteria

---

### For RT / Operations Team

Start here:
1. **PHASE_6_RT_OPERATIONAL_GUIDE.md** — Operational runbook in Português + English (503 lines)
   - Section 2: Dashboard access & navigation
   - Section 3: Understanding SLA colors & status
   - Section 4: Standard workflows (critical detected, fallback, SLA breach, NOTIVISA)
   - Section 5-7: Dashboard actions (acknowledge, retry, cancel)
   - Section 8-10: Configuring thresholds, NOTIVISA tracking, troubleshooting
   - Section 11-13: Daily checklist, support contacts, quick reference card

Print Section 13 for your desk.

---

### For Compliance / Auditors

Cross-reference:
1. **ADR-0019** (Section: Consequences Positive) — RDC 978 Art. 128 coverage
2. **PHASE_6_DETAILED_PLAN.md** (Section 14: Documentation References) — RDC 978 + DICQ 4.3 mapping
3. **PHASE_6_EXECUTIVE_SUMMARY.md** (Compliance Value section) — RDC 978 + DICQ coverage matrix

---

### For QA / Testing

Reference:
1. **PHASE_6_DETAILED_PLAN.md** (Sections 6-7) — Unit test specs (20+) + E2E test scenarios (5+)
2. **PHASE_6_DETAILED_PLAN.md** (Section 11: Success Criteria) — Acceptance tests, load testing

Then execute:
3. Create test files at:
   - `functions/src/__tests__/criticos.test.ts` (unit tests)
   - `smoke-test-openclaw/criticos.e2e.spec.ts` (E2E tests)

---

## Key Deliverables

| Deliverable | Location | Status | Lines |
|---|---|---|---|
| Executive Summary | PHASE_6_EXECUTIVE_SUMMARY.md | ✓ COMPLETE | 220 |
| Detailed Plan | PHASE_6_DETAILED_PLAN.md | ✓ COMPLETE | 1,543 |
| RT Operational Guide | PHASE_6_RT_OPERATIONAL_GUIDE.md | ✓ COMPLETE | 503 |
| Architecture Decision Record | docs/adr/ADR-0019-critical-values-escalation.md | ✓ COMPLETE | 235 |
| Firestore Schema | Spec in PHASE_6_DETAILED_PLAN.md Section 2 | READY FOR BUILD | — |
| Cloud Functions (7 callables + 1 cron) | Spec in PHASE_6_DETAILED_PLAN.md Section 3 | READY FOR BUILD | — |
| SMS/Email Templates | PHASE_6_DETAILED_PLAN.md Section 4 | ✓ COMPLETE | — |
| Twilio Integration | PHASE_6_DETAILED_PLAN.md Section 5 | ✓ COMPLETE | — |
| Unit Tests (20+) | PHASE_6_DETAILED_PLAN.md Section 6 | ✓ SPEC | — |
| E2E Tests (5+ scenarios) | PHASE_6_DETAILED_PLAN.md Section 7 | ✓ SPEC | — |

---

## Critical Path Timeline

```
Week 1:
├─ Twilio account setup + regional number (CTO, 1h)
├─ Firestore schema implementation (Dev, 8h)
├─ Cloud Functions implementation (Dev, 20h)
└─ Parallel: QA preps E2E sandbox

Week 2:
├─ Unit testing (Dev, 6h)
├─ E2E testing (QA, 4h)
├─ Documentation + training (Tech Writer + RT, 4h)
└─ Deploy (following deploy-protocol.md order):
   1. Firestore rules (gate: schema must be live)
   2. Functions (gate: secrets preflight-check.sh)
   3. Hosting (if UI included)
   4. Smoke tests
```

**Total:** 2 weeks, ready for launch.

---

## Before You Start: Prerequisites

### For CTO

- [ ] Confirm Twilio contract (cost: ~BRL 30-300/month depending on volume)
- [ ] Create Twilio account + provision regional SMS number (+5511XXXXXXXX)
- [ ] Set Firebase secrets:
  ```bash
  firebase functions:secrets:set TWILIO_ACCOUNT_SID
  firebase functions:secrets:set TWILIO_AUTH_TOKEN
  firebase functions:secrets:set TWILIO_PHONE_NUMBER
  ```
- [ ] Verify `scripts/preflight-secrets-check.sh` passes

### For Dev

- [ ] Clone latest from main branch
- [ ] Review PHASE_6_DETAILED_PLAN.md sections 1-5 (40 min read)
- [ ] Review ADR-0019 (15 min read)
- [ ] Run `npm install twilio` in `functions/`
- [ ] Create test file structure per Section 6-7 spec

### For QA

- [ ] Provision Twilio sandbox (if available) or mock setup
- [ ] Review E2E test scenarios (PHASE_6_DETAILED_PLAN.md Section 7)
- [ ] Plan emulator setup for Firestore

### For RT / Operations

- [ ] Read PHASE_6_RT_OPERATIONAL_GUIDE.md (30 min)
- [ ] Print Quick Reference Card (Section 13)
- [ ] Prepare for training session (30 min walkthrough)

---

## Compliance Alignment

### RDC 978/2025 Art. 128 (Ações Corretivas)

Phase 6 delivers:
- ✓ Immediate notification to physician (SMS <30s)
- ✓ Audit trail of all escalation attempts (immutable logs)
- ✓ Operator attribution (request.auth.uid)
- ✓ Action record (escalacao doc = formal evidence)

### DICQ 4.3 (Documentação de Qualidade)

Phase 6 delivers:
- ✓ Technical documentation (PHASE_6_DETAILED_PLAN.md)
- ✓ Operational documentation (PHASE_6_RT_OPERATIONAL_GUIDE.md)
- ✓ Audit trail (criticos-log-eventos with LogicalSignature chain)
- ✓ Action logging (escalacao doc + log events)

---

## Risk Mitigation Strategies

### Risk 1: Twilio SMS Delivery Failure
→ **Mitigation:** Multi-channel fallback (SMS → email), 5-min SLA polling cron for safety net

### Risk 2: Invalid Physician Phone Number
→ **Mitigation:** E.164 validation before send, immediate fallback to email, log failure

### Risk 3: SLA Cron Doesn't Run
→ **Mitigation:** Manual RT override button, email fallback, Cloud Logs monitoring + alerts

### Risk 4: False Positives (Threshold Too Low)
→ **Mitigation:** RT can adjust thresholds per lab, defaults based on clinical references

### Risk 5: Duplicate Escalations
→ **Mitigation:** Dedup check (one escalacao per laudoId + exameId + analitoId + value)

---

## File Structure After Implementation

```
c:/hc quality/
├── .planning/phases/06/
│   ├── 06-RESEARCH.md (historical research, keep for reference)
│   ├── PHASE_6_EXECUTIVE_SUMMARY.md (this doc — CTO approval)
│   ├── PHASE_6_DETAILED_PLAN.md (full spec — 1,543 lines)
│   ├── PHASE_6_RT_OPERATIONAL_GUIDE.md (operational runbook)
│   └── README.md (you are here)
│
├── docs/adr/
│   └── ADR-0019-critical-values-escalation.md (architecture decision)
│
├── src/features/criticos/
│   ├── types/index.ts (CriticosThreshold, CriticosEscalacao types)
│   ├── utils/criticoDetector.ts (existing detection logic, keep as-is)
│   ├── services/criticosService.ts (NEW — Firestore service for thresholds)
│   ├── hooks/useCriticosEscalacoes.ts (NEW — React hook for escalacao list)
│   └── components/
│       ├── CriticosEscalacoesDashboard.tsx (NEW — RT dashboard view)
│       ├── CriticosThresholdManager.tsx (NEW — Config interface)
│       └── CriticosEscalacaoWidget.tsx (NEW — Laudo-embedded widget)
│
├── src/features/liberacao/
│   └── types/laudo.ts (UPDATE — add criticoMetadata, medicoTelefone)
│
├── functions/src/
│   ├── index.ts (ADD exports for 7 callables + 1 cron)
│   ├── shared/sms/
│   │   ├── twilioClient.ts (NEW — Twilio SDK wrapper)
│   │   └── escalacaoCriticos.ts (NEW — main callable)
│   ├── modules/criticos/
│   │   ├── registerCriticoDetection.ts (NEW callable)
│   │   ├── acknowledgeEscalacao.ts (NEW callable)
│   │   ├── retryEscalacao.ts (NEW callable)
│   │   ├── cancelarEscalacao.ts (NEW callable)
│   │   ├── listCriticosEscalacoes.ts (NEW callable)
│   │   ├── generateNOTIVISADraft.ts (NEW callable)
│   │   ├── getCriticosThresholds.ts (NEW callable)
│   │   └── escalacaoCritiocos_webhook.ts (NEW Twilio callback)
│   ├── seeds/
│   │   └── criticos-thresholds.seed.ts (NEW — seed default thresholds)
│   └── __tests__/
│       └── criticos.test.ts (NEW — 20+ unit tests)
│
├── smoke-test-openclaw/
│   └── criticos.e2e.spec.ts (NEW — 5+ E2E scenarios)
│
└── firestore.rules (UPDATE — add rules for 3 new collections)
```

---

## Success Metrics (30 Days Post-Launch)

| Metric | Target | How to Track |
|---|---|---|
| SMS delivery success rate | ≥99% | Twilio dashboard |
| SMS latency | <2 min | escalacao.escalacoes[0].timestamp vs entregue_em |
| RT acknowledgment rate | ≥95% | COUNT(status='reconhecido') / COUNT(total) |
| False positive rate | <10%/day | COUNT(status='cancelado') / COUNT(total) |
| NOTIVISA accuracy | 100% | Manual audit of 10 reportable cases |

---

## Support & Escalation

| Question | Ask | How |
|---|---|---|
| "How do I configure thresholds?" | RT Supervisor or Tech Writer | PHASE_6_RT_OPERATIONAL_GUIDE.md Section 6 |
| "Why is SLA vencido?" | CTO | Check time calculation in Section 3.2 |
| "SMS not working?" | CTO | Check TWILIO_ACCOUNT_SID secret (preflight-check.sh) |
| "NOTIVISA draft generation?" | Tech Writer | Section 2.7 of PHASE_6_DETAILED_PLAN.md |
| "Scaling to 100+ críticos/day?" | CTO | Firestore limits + Twilio batch quotas |

---

## Next Steps

1. **CTO:** Review PHASE_6_EXECUTIVE_SUMMARY.md → sign off on Twilio + schema
2. **Dev:** Pick up PHASE_6_DETAILED_PLAN.md → start implementation (Week 1)
3. **QA:** Review test specs (Section 6-7) → prepare sandbox
4. **RT:** Read PHASE_6_RT_OPERATIONAL_GUIDE.md → prepare for training
5. **All:** Schedule kickoff meeting (30 min) → confirm timeline + dependencies

---

**Document Version:** 1.0  
**Status:** READY FOR EXECUTION  
**Last Updated:** 2026-05-07
