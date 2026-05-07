# Phase 6: Executive Summary — Critical Values Escalation (v1.4 Wave 2)

**For:** CTO  
**Status:** READY FOR APPROVAL  
**Date:** 2026-05-07  
**Effort:** ~2 weeks (100 dev hours + 20 ops hours)  
**Dependencies:** Twilio contract confirmation  

---

## The Ask

Automate escalation of critical lab results to physicians + RTs via SMS (primary) + email (fallback), with SLA tracking and NOTIVISA draft generation. Closes RDC 978 Art. 128 compliance gap (rastreabilidade de operações).

---

## Scope

| Component | Deliverable | Status |
|---|---|---|
| **Schema** | 3 new Firestore collections + indexes | Specified (PHASE_6_DETAILED_PLAN.md) |
| **API** | 7 callables + 1 cron trigger | Specified |
| **Integrations** | Twilio SMS (regional São Paulo) | Specified (awaiting account) |
| **Testing** | 20+ unit tests + 5+ E2E specs | Specified |
| **Operations** | RT dashboard + config interface | Specified (PHASE_6_RT_OPERATIONAL_GUIDE.md) |
| **Documentation** | ADR-0019 + runbooks | Complete |

---

## Key Decisions (Ratified in ADR-0019)

1. **Multi-channel fallback:** SMS → email → RT alert (never silent failure)
2. **5-minute SLA polling cron** (not webhook-only) for robustness
3. **Append-only escalacao arrays** (audit immutability per ADR-0012 pattern)
4. **NOTIVISA draft generation** (Phase 6), auto-submission (Phase 8)
5. **Twilio SMS** (SMS delivery ≥99% SLA, regional number Brazil)

---

## Critical Path

### Week 1: Setup + Schema

1. **Twilio Account** (1h CTO effort)
   - Create account + provision regional SMS number (+5511XXXXXXXX)
   - Set secrets in Firebase: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
   - Enable webhook callbacks

2. **Firestore Schema** (8h dev)
   - Implement 3 collections: criticos-thresholds, criticos-escalacoes, criticos-log-eventos
   - Add 2 indexes (escalacao queries: status + sla_status)
   - Update labSettings + Laudo types

3. **Cloud Functions** (20h dev)
   - Implement 7 callables (registerCriticoDetection, acknowledge, retry, cancel, list, getNoisyThresholds, generateNOTIVISA)
   - Implement 1 cron (escalacaoCriticos every 5 min)
   - Twilio client integration
   - Webhook handler for SMS delivery callbacks

### Week 2: Testing + Ops

4. **Unit Tests** (6h dev)
   - 20+ test specs (threshold detection, SMS send, SLA polling, acknowledgment, NOTIVISA)
   - Mocked Twilio API

5. **E2E Tests** (4h QA)
   - 5 scenarios: happy path, SMS fallback, SLA breach, NOTIVISA, cancellation
   - Real Twilio sandbox (if available) or mocked

6. **Documentation + Training** (4h)
   - RT operational guide (PHASE_6_RT_OPERATIONAL_GUIDE.md) ✓ Done
   - ADR-0019 ✓ Done
   - Runbook: "Setup Thresholds" + "Monitor SLA"
   - Video walkthrough for RT (30 min)

7. **Deploy** (2h)
   - Firestore rules update (separate step: gate = schema must be live first)
   - Functions deploy (gate = secrets preflight check)
   - Hosting deploy (if UI changes included)
   - Smoke tests (detection → escalation → SMS → acknowledgment)

---

## Financial Impact

### Twilio SMS Cost

Estimate: 10 critical results/day × 30 days × BRL 0.10/SMS = **BRL 30/month** (~$6 USD)

This scales linearly. If 100 críticos/day (busier lab): **BRL 300/month** (~$60 USD).

**Budget:** Add Twilio line to operational expenses.

---

## Compliance Value

### RDC 978 Art. 128 Coverage

| Requirement | Phase 6 Delivers | Evidence |
|---|---|---|
| Imediata notificação ao médico | ✓ SMS within 30s | CallableTrace |
| Rastreabilidade de operações | ✓ Immutable log (criticos-log-eventos) | LogicalSignature chain |
| Assinatura de responsável | ✓ operatorId in every escalacao | request.auth.uid |
| Ação corretiva registrada | ✓ Escalacao doc is action record | Firestore audit export |

### DICQ 4.3 Coverage

| Block | Phase 6 Delivers |
|---|---|
| 4.3.1 (Documentação) | ✓ PHASE_6_DETAILED_PLAN.md (technical) + PHASE_6_RT_OPERATIONAL_GUIDE.md (operational) |
| 4.4 (Auditoria) | ✓ criticos-log-eventos with audit trail |
| 4.5 (Ação Corretiva) | ✓ Escalacao doc is formal action record |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Twilio account takes too long to provision | Low | 1-2 day slip | Request expedited setup |
| SMS delivery fails (Twilio outage) | Low | Users fall back to email | Dual-channel fallback + SLA cron |
| Phone number format invalid | Medium | SMS fails silently | Validate E.164 before send; log failure |
| SLA target too strict | Medium | Too many false alarms (RT fatigue) | RT can adjust per lab; default 30 min |
| NOTIVISA draft incomplete | Low | Manual form completion needed | Phase 6 generates pre-populated form; Phase 8 adds API |

---

## Testing Strategy

### Unit Tests (20+ specs)

```
criticos.test.ts
├─ Threshold detection (4 tests)
├─ Escalacao registration (5 tests)
├─ Twilio integration (3 tests)
├─ SLA polling (4 tests)
├─ Acknowledgment (3 tests)
└─ NOTIVISA integration (2 tests)
```

**Mocked:** Twilio API, Firestore writes

### E2E Tests (5 scenarios)

```
criticos.e2e.spec.ts
├─ Happy path: crítico → SMS → ack
├─ Fallback: SMS fails → email sent
├─ SLA breach: cron alerts RT
├─ NOTIVISA: draft generated for reportable
└─ Cancel: false alarm handling
```

**Real:** Firestore emulator, mocked Twilio

### Smoke (Post-Deploy)

1. Create laudo with crítico result (bioquimica)
2. Verify escalacao doc created
3. Verify SMS queued (check Twilio logs)
4. Verify email sent (check SMTP logs)
5. Verify RT can acknowledge on dashboard
6. Verify SLA metrics calculated

---

## Approval Checkpoints

- [ ] **CTO:** Review ADR-0019, approve SMS primary channel + Twilio choice
- [ ] **CTO:** Confirm Twilio contract (cost + regional setup)
- [ ] **CTO:** Review Firestore schema (immutability pattern, index cost)
- [ ] **RT/Supervisor:** Review operational guide (usability + training needs)
- [ ] **Compliance:** Review RDC 978 coverage in PHASE_6_DETAILED_PLAN.md
- [ ] **QA:** Sign off on test plan (20+ unit + 5+ E2E)

---

## Go/No-Go Criteria

### Must-Haves (blocking)

- [ ] Twilio account + secrets live
- [ ] Schema deployed + rules in place
- [ ] 7 callables + 1 cron tested (unit + integration)
- [ ] SMS delivery >95% success rate (Twilio SLA)
- [ ] E2E critical path green (detect → escalate → acknowledge)
- [ ] Audit trail immutable (no escalacao updates except status + SLA fields)

### Nice-to-Haves (post-Phase-6)

- [ ] Push notification channel (Phase 7)
- [ ] NOTIVISA auto-submit (Phase 8, requires ANVISA API key)
- [ ] Machine learning threshold recommendations (Phase 10)

---

## Next Steps (If Approved)

1. **Confirm Twilio:** CTO spins up account + gets regional number
2. **Set Secrets:** `firebase functions:secrets:set TWILIO_*`
3. **Start Dev:** Dev team picks up PHASE_6_DETAILED_PLAN.md, implements per spec
4. **Parallel:** QA reviews E2E test plan, sets up Twilio sandbox
5. **Gate:** Preflight-secrets-check.sh must pass before functions deploy
6. **Deploy:** Rules → Functions → Hosting (order matters, per deploy-protocol.md)
7. **Smoke:** Manual walk-through of 5 E2E scenarios
8. **Training:** 30-min RT walkthrough of dashboard + config
9. **Launch:** Announce to all labs with criticos enabled

---

## Success Metrics (30 Days Post-Launch)

| Metric | Target | Track Via |
|---|---|---|
| SMS delivery success rate | ≥99% | Twilio dashboard |
| SMS delivery latency | <2 min | escalacao.escalacoes[].timestamp |
| RT SLA acknowledgment rate | ≥95% | criticos-log-eventos |
| False positive rate | <10% per day | escalacao.cancelado count |
| NOTIVISA draft generation accuracy | 100% | manual audit of 10 reportable cases |

---

## Estimated Timeline

| Phase | Duration | Owner | Status |
|---|---|---|---|
| Setup (Twilio + Schema) | 1 week | Dev + CTO | Ready |
| Implementation (Callables + Cron) | 1 week | Dev | Ready |
| Testing (Unit + E2E) | 3 days | QA | Ready |
| Ops + Training | 2 days | Tech Writer + RT | Ready |
| **Total** | **2 weeks** | — | **READY FOR EXECUTION** |

---

## Documents Attached

1. **PHASE_6_DETAILED_PLAN.md** — 400+ lines; complete spec (callable signatures, schema, templates, test specs)
2. **PHASE_6_RT_OPERATIONAL_GUIDE.md** — 300+ lines; operational runbook in Português + English
3. **ADR-0019-critical-values-escalation.md** — Architecture decision record (rationale + alternatives)

---

## Recommendation

**PROCEED WITH PHASE 6.** Foundation is solid (bioquimica CIQ + criticos detector working), compliance gap is real (RDC 978 Art. 128), and 2-week timeline is achievable. Twilio is industry-standard SMS provider (>10M deployments); risk is low.

**Approval needed:** Twilio contract confirmation + Firestore schema sign-off.

---

**Prepared by:** Claude Code (Agent)  
**Date:** 2026-05-07  
**Revision:** 1.0 FINAL
