---
milestone: v1.4
version: 1.1
date_created: 2026-05-07
date_updated: 2026-05-08
status: approved
revision_note: "Phase 3 LIVE (2026-05-07). Phase 7 pivoted to Advanced Auditoria (2026-05-08). Phases 4–5 planned (2026-05-20 ~ 2026-06-27). Phases 6, 8–9 backlog."
---

# HC Quality v1.4 — Roadmap

**Milestone:** v1.4 (Quality Control Extensions + Compliance Phase 2)  
**Period:** 2026-05-07 → 2026-08-15 (14 weeks)  
**Status:** Phase 3 PRODUCTION LIVE · Phase 7 PLANNED (NEW) · Phases 4–5 PLANNED

---

## v1.4 Milestone Summary

**Overall Progress:** Phase 3 COMPLETE (100%), Phase 7 PLANNED (NEW), Phases 4–5 detailed, Phases 6, 8–9 backlog  
**Target Completion:** 2026-08-15 (14 weeks from Phase 3 close)  
**Compliance Target:** DICQ 88%+, RDC 978 92%+, LGPD 85%+

| Phase | Focus | Deliverables | Status | Deploy | Risk |
|-------|-------|--------------|--------|--------|------|
| **Phase 3** | Schema, Rules, Helpers, Functions Base | 12 deliverables, 42.4K LOC, 738/738 tests | ✅ LIVE | 2026-05-07 | 2/10 |
| **Phase 4** | Portal + NOTIVISA Integration | Portal UI (04-01/02), NOTIVISA API (04-03/04) | 📋 PLANNED | 2026-06-02 | 3.5/10 |
| **Phase 5** | Críticos + IA Strip Enhancement | Críticos severity (05-01/02), IA OCR (05-03/04) | 📋 PLANNED | 2026-06-27 | 3.5/10 |
| **Phase 6** | CAPA Workflow | CAPA schema + UI + audit trail | 📅 BACKLOG | 2026-07-14 | 3/10 |
| **Phase 7** | Advanced Auditoria + AI Insights | Audit trail extension, anomaly detection, alerts, reporting | 📋 PLANNED (NEW) | 2026-08-04 | 2.5/10 |
| **Phase 8–9** | NOTIVISA Edge + Labs Apoio + Manual QC | Extended quality assurance | 📅 BACKLOG | 2026-08-15 | 4/10 |

---

## Phase 3 Recap — PRODUCTION LIVE (2026-05-07)

**Status:** ✅ COMPLETE  
**Period:** 2026-04-16 → 2026-05-07 (3 weeks)  
**Team:** 4 FTE (Stream C foundation work)

### Deliverables

| Deliverable | Type | Status | LOC | Tests |
|------------|------|--------|-----|-------|
| **03-01** | Firestore schema (bioquímica, críticos, notivisa) | ✅ | 2.1K | 84 |
| **03-02** | Security rules (RBAC, member validation, audit) | ✅ | 1.8K | 45 |
| **03-03** | Helper functions (isValidRun, signHash, etc.) | ✅ | 3.2K | 156 |
| **03-04** | Cloud Functions base (78 functions scaffolded) | ✅ | 18.5K | 287 |
| **03-05** | Rules E2E tests (45/45 passing) | ✅ | 4.1K | 45 |
| **03-06** | TypeScript cleanup (no TSC errors) | ✅ | — | — |
| **03-07** | CI pipeline gate (GitHub Actions) | ✅ | — | — |
| **03-08** | Deploy procedure doc (step-by-step) | ✅ | — | — |
| **03-09** | Monitoring + telemetry (Cloud Logging) | ✅ | 2.4K | 34 |
| **03-10** | ADR-0017 remediation (HMAC baseline reset) | ✅ | — | — |
| **03-11** | ADR-0018 deploy gate (`preflight-secrets-check.sh`) | ✅ | 0.3K | 2 |
| **03-12** | Incident log + postmortem (11 ghost callables surfaced) | ✅ | — | — |

**Total Phase 3:** 12 deliverables, 42.4K LOC, 738/738 tests passing

### Compliance Impact

| Block | Pre-Phase 3 | Post-Phase 3 | Delta | Target v1.4 |
|-------|------------|-------------|-------|------------|
| A — Governança | 73% | 75% | +2% | 80% |
| B — Gestão Documental | 70% | 72% | +2% | 85% |
| C — Pessoal | 75% | 78% | +3% | 88% |
| D — Ambiente | 65% | 68% | +3% | 75% |
| E — Pré-analítico | 72% | 75% | +3% | 82% |
| F — Analítico | 85% | 88% | +3% | 92% |
| G — Pós-analítico | 78% | 82% | +4% | 90% |
| H — Garantia Qualidade | 75% | 78% | +3% | 88% |
| I — Laudos/Liberação | 80% | 83% | +3% | 92% |
| J — Continuidade | 70% | 72% | +2% | 80% |

**Overall Post-Phase 3:** 76.3% DICQ compliance · RDC 978 80% · LGPD 72%

### Production Infrastructure

- **5 Collections:** `bioquimica/{labId}`, `criticos/{labId}`, `notivisa/{labId}`, `events`, `config`
- **5 Indexes:** composite indexes for poll queries, audit log access
- **78 Functions:** regional callables in `southamerica-east1`, versioned at `v1`
- **45 Rules Tests:** 100% pass rate, coverage: RBAC + event immutability + payload validation
- **Incidents Resolved:** ADR-0017 (HMAC PENDING_SET baseline reset), ADR-0018 (secrets gate mandatory)

### Risk Summary (Phase 3)

| Risk | Likelihood | Impact | Status |
|------|-----------|--------|--------|
| HMAC baseline mismatch (ADR-0017) | RESOLVED | Historical re-sign avoided | ✅ |
| Secrets in Functions git diff | RESOLVED | `preflight-secrets-check.sh` gate | ✅ |
| 11 ghost callables (no CF) | RESOLVED | Surfaced + scheduled for Phase 4 | ⚠️ |
| TSC/lint baseline creep | RESOLVED | CI gate enforced | ✅ |

---

## Phase 4 — Portal + NOTIVISA Integration (PLANNED)

**Goal:** Production-ready Patient Portal (patient-facing) + NOTIVISA integration (government reporting API).  
**Period:** 2026-05-20 → 2026-06-02 (2 weeks)  
**Team:** 3.5 FTE (Stream A backend, Stream B frontend)  
**Risk:** 3.5/10 (Portal UX complexity, NOTIVISA API flakiness)

### Plan Structure

| Plan | Focus | Duration | Owner | Deadline |
|------|-------|----------|-------|----------|
| **04-01** | Portal schema (patient profile, results history, consents) | 3 days | Stream A | 2026-05-23 |
| **04-02** | Portal UI (home, results, consents, settings) | 4 days | Stream B | 2026-05-27 |
| **04-03** | NOTIVISA API client + mapping (batch submission format) | 3 days | Stream A | 2026-05-23 |
| **04-04** | NOTIVISA scheduler + retry logic (gov endpoint flakiness) | 4 days | Stream A | 2026-05-27 |
| **04-05** | Portal + NOTIVISA integration (block release on gov ack) | 3 days | Stream A + B | 2026-05-30 |
| **04-06** | E2E tests + portal accessibility audit | 2 days | Stream B | 2026-06-01 |
| **04-07** | Deploy + monitoring | 1 day | Stream A | 2026-06-02 |

### Compliance Alignment

- **RDC 978 Art. 97** — Results delivery to patient within SLA
- **LGPD Art. 18** — Patient data portability (export feature)
- **DICQ 4.4** — External communication (gov reporting)

### Success Criteria

- Portal UI responsive, WCAG AA compliant
- NOTIVISA batch submissions 100% success rate in test gov environment
- Patient consent model fully audited (LGPD compliance)
- Deploy blocks on all E2E + security tests passing

---

## Phase 5 — Críticos + IA Strip Enhancement (PLANNED)

**Goal:** Enhanced critical value escalation workflow + Gemini OCR strip parsing for imunologia analytes.  
**Period:** 2026-06-09 → 2026-06-27 (3 weeks)  
**Team:** 2 FTE (Stream C IA specialist, Stream A backend)  
**Risk:** 3.5/10 (Gemini API cost + OCR accuracy trade-off)

### Plan Structure

| Plan | Focus | Duration | Owner | Deadline |
|------|-------|----------|-------|----------|
| **05-01** | Críticos severity + escalation rules (config-driven) | 3 days | Stream A | 2026-06-12 |
| **05-02** | Críticos notification cascade (SMS → email → portal) | 3 days | Stream A | 2026-06-12 |
| **05-03** | Gemini OCR strip parser (imunologia analytes) | 5 days | Stream C | 2026-06-17 |
| **05-04** | IA strip integration + fuzzy match (vs expected analytes) | 4 days | Stream C | 2026-06-21 |
| **05-05** | E2E tests (10 OCR samples, 5 escalation scenarios) | 2 days | Stream C | 2026-06-23 |
| **05-06** | Cost analysis + abuse prevention (rate limiting) | 1 day | Stream A | 2026-06-24 |
| **05-07** | Deploy + monitoring | 1 day | Stream A | 2026-06-27 |

### Compliance Alignment

- **RDC 978 Art. 99** — Critical result escalation (timely notification)
- **DICQ 4.6.3** — Resultado crítico — responsabilidade (who escalates, when)
- **F — Analítico (Phase 5 target: 92%)** — OCR accuracy + confidence scoring

### Success Criteria

- Críticos notifications reach clinician <5min from lab result entry
- Gemini OCR strip accuracy ≥92% on 100-sample validation set
- Cost per OCR parse <$0.003 (Gemini Flash pricing)
- No escalation false negatives (sensitivity >99%)

---

## Phase 6 — CAPA Workflow (2 weeks)

**Goal:** CAPA workflow implementation for non-conformance investigation and corrective action tracking.  
**Period:** 2026-06-30 → 2026-07-14  
**Compliance:** RDC 978 Art. 86 (CAPA management), DICQ 4.14.6 (preventive action)

| Plan | Focus | Duration |
|------|-------|----------|
| **06-01** | CAPA schema (finding → action → verification → closeout) | 3 days |
| **06-02** | CAPA workflow UI (assign, track, evidence, sign-off) | 4 days |
| **06-03** | Audit trail integration (CAPA investigation evidence) | 3 days |
| **06-04** | E2E tests + compliance audit | 2 days |
| **06-05** | Deploy | 1 day |

---

## Phase 7 — Advanced Auditoria + AI Insights (2 weeks) — NEW PLANNED

**Goal:** Enhanced audit trail with cross-collection diffs, AI-powered anomaly detection, real-time alerts, and NLP-driven audit reporting.  
**Period:** 2026-07-15 → 2026-08-04  
**Team:** 2 FTE (backend/frontend) + 0.5 FTE AI specialist  
**Compliance:** RDC 978 5.3, Art. 107 + DICQ 4.4 (Trilha de Auditoria, Investigação de NC)

### Plan Structure

| Plan | Focus | Duration |
|------|-------|----------|
| **07-01** | Audit Trail Extension (cross-collection diffs, context capture) | 3–4 days |
| **07-02** | Anomaly Detection Engine (baseline + Gemini pattern matching) | 4–5 days |
| **07-03** | Smart Alert System (real-time, role-based routing, drill-down UI) | 4–5 days |
| **07-04** | Audit Report Generation (NLP summaries Portuguese, PDF/CSV exports) | 2–3 days |

### Compliance Alignment

- **RDC 978 5.3** — Enhanced audit trail with field-level diffs + context
- **RDC 978 Art. 107** — Regular audit reviews via automated report generation
- **DICQ 4.4** — Trilha de auditoria with anomaly detection + investigation support

### Key Technologies

- **Diff Detection:** Native JS (deterministic field-level change tracking)
- **Baseline Computation:** Firestore queries + operator behavior analysis
- **Anomaly Scoring:** 5-dimensional weighted scoring (operation rarity, time, result, velocity, module jump)
- **AI Analysis:** Gemini 2.5 Flash (semantic pattern matching, <$0.01 per report)
- **PDF/CSV Export:** Cloud Function backed + Cloud Storage hosting
- **Real-time Alerts:** Firestore listeners, role-based routing, drill-down UI

### Success Criteria

- Audit trail captures field-level diffs + context for every regulatory write
- Anomaly detection baseline data-driven from historical entries
- Alert system real-time (<2 sec delivery), role-based access
- Report generation <10 seconds for 1000 entries, NLP summary in Portuguese
- All tests ≥85% coverage, WCAG AA accessibility verified

---

## Phase 8 — Remaining NOTIVISA + Labs Apoio (2 weeks)

**Goal:** Complete NOTIVISA API coverage + third-party lab contracts module.  
**Period:** 2026-08-05 → 2026-08-18  
**Compliance:** RDC 978 Arts. 36–39 (third-party labs), DICQ 4.14.8 (subcontracting)

| Plan | Focus | Duration |
|------|-------|----------|
| **08-01** | Labs Apoio schema (CNPJ, contracts, SLA, CAP cert) | 2 days |
| **08-02** | Labs Apoio UI + contract tracking | 3 days |
| **08-03** | NOTIVISA edge cases (partial result blocks, ack retries) | 2 days |
| **08-04** | E2E + compliance audit | 2 days |
| **08-05** | Deploy | 1 day |

---

## Phase 9 — Manual Qualidade + Bioquímica Phase 2 (2 weeks)

**Goal:** Manual entry for QC data (post-scanner scenarios) + Bioquímica analyte expansion.  
**Period:** 2026-08-19 → 2026-08-15 (converge)  
**Compliance:** DICQ F — Analítico (complete 92%+ target), RDC 978 (full trace)

| Plan | Focus | Duration |
|------|-------|----------|
| **09-01** | Manual QC entry form + validation | 2 days |
| **09-02** | Bioquímica analyte library expansion (50+ new analytes) | 3 days |
| **09-03** | Legacy data backfill (importer from v1.2 sqlite) | 2 days |
| **09-04** | E2E + compliance final audit | 2 days |
| **09-05** | Deploy + final monitoring setup | 1 day |

---

## Compliance Roadmap (DICQ 4.3 Block Coverage)

### Tier 1 Blockers (Due 2026-05-14)

- **RDC 978 5.2** — Written policies (in SGQ)
- **DICQ 4.1.2.7** — Management responsibility (roles, turnos)
- **DICQ 4.14.5** — Internal audit procedure (POP documented)

**Status:** ✅ Phase 3 + Phase 4 (Portal) support. Compliance audit 2026-05-21.

### Tier 2 Governance + LGPD Consent (Due 2026-05-22)

- **LGPD Art. 7** — Explicit consent (patient portal Phase 4)
- **DICQ 4.4** — External communication (NOTIVISA Phase 4)
- **DICQ 4.15** — Management review (periodic analysis)

**Status:** 📋 Phase 4 Portal + NOTIVISA brings compliance to 82%+.

### Tier 3 Extended Quality (Due 2026-08-15)

- **DICQ 4.6** — Críticos workflow (Phase 5)
- **DICQ 4.14.6** — CAPA management (Phase 6)
- **DICQ 4.4** — Audit trail + anomaly detection (Phase 7) ← NEW
- **DICQ 4.8** — Customer feedback (Phase 6 Auditoria subcollection)

**Status:** 📅 Phases 5–9 complete compliance target 95%+.

---

## Dependencies Graph

```
Phase 3 (LIVE — 2026-05-07)
├─→ ADR-0017 (HMAC remediation) ✅
├─→ ADR-0018 (secrets gate) ✅
│
├─→ Phase 4 (2026-05-20 kickoff)
│   ├─→ Portal schema + UI (04-01/02)
│   ├─→ NOTIVISA API (04-03/04)
│   └─→ Deploy 2026-06-02
│       │
│       └─→ Phase 5 (2026-06-09 kickoff)
│           ├─→ Críticos severity (05-01/02)
│           ├─→ IA Strip OCR (05-03/04)
│           └─→ Deploy 2026-06-27
│               │
│               ├─→ Phase 6 (CAPA, 2026-06-30)
│               ├─→ Phase 7 (Advanced Auditoria, 2026-07-15) ← NEW
│               ├─→ Phase 8 (NOTIVISA edge, Labs Apoio, 2026-08-05)
│               └─→ Phase 9 (Manual QC + Bio2, 2026-08-19)
│
└─→ Compliance Tier-1 Blockers (2026-05-14) ✅
    └─→ Compliance Tier-2 Gov+LGPD (2026-05-22 via Phase 4)
        └─→ Compliance Tier-3 Extended (2026-08-15 via Phases 5–9)
```

---

## Resource Allocation (FTE per phase)

| Phase | Backend | Frontend | IA/ML | DevOps | Total | Notes |
|-------|---------|----------|-------|--------|-------|-------|
| Phase 3 | 1.5 | 1.5 | 0.5 | 0.5 | 4.0 | COMPLETE |
| Phase 4 | 2.0 | 1.0 | 0.5 | 0.5 | 3.5 | Parallel (start 2026-05-20) |
| Phase 5 | 1.0 | 0.5 | 1.5 | 0.5 | 3.5 | Parallel (start 2026-06-09) |
| Phase 6 | 1.0 | 0.8 | 0.2 | 0.5 | 2.5 | Sequential after Phase 5 |
| Phase 7 | 1.0 | 1.0 | 0.5 | 0.5 | 3.0 | NEW: Parallel Phase 6 |
| Phase 8 | 1.0 | 0.5 | 0.0 | 0.5 | 2.0 | Overlap Phases 6–7 |
| Phase 9 | 1.5 | 1.0 | 0.5 | 0.5 | 3.5 | Final push, target 2026-08-15 |

**Baseline:** 2 FTE constant (CTO oversight + DevOps)  
**Peak:** 4 FTE (Phase 4 + Phase 5 overlap, 2026-06-09 ~ 2026-06-27)

---

## Risk Dashboard (Updated for v1.4 + Phase 7)

| Risk | Likelihood | Impact | Mitigation | Status |
|------|-----------|--------|-----------|--------|
| **Portal UX complexity** | Medium | 1-week slip | Pair programming Phase 4 week 1; design spike pre-Phase 4 | Monitoring |
| **NOTIVISA gov endpoint flakiness** | Medium | 2-week slip | Webhook timeout + retry queue in Phase 4-04; mock gov env for tests | Monitoring |
| **Gemini OCR cost overruns** (Phase 5) | Low | Budget impact | Rate limiting + batch processing per Phase 5-06; cost cap $500/mo | Monitoring |
| **Gemini anomaly detection false positives** (Phase 7) | Medium | Alert fatigue | Tuning post-deploy; start with high threshold (0.85), gradually lower | Monitoring |
| **Report generation timeout** (Phase 7) | Low | Degraded UX | Limit query to 5000 entries per report; paginate if >5000 | Mitigation |
| **Real-time alert memory leak** (Phase 7) | Low | Long-term cost | Enforce unsubscribe on component unmount; test with Chrome DevTools | Monitoring |
| **Labs Apoio contract complexity** (Phase 8) | Medium | 3-day slip | Legal review by 2026-08-01; template contracts in place early | Planning |
| **Phases 6–9 schedule compression** | Medium | Final deadline slip | Weekly checkpoint gates; cut Phase 9 scope if needed (bio analytes → v1.5) | Mitigating |

---

## Success Criteria (v1.4)

| Criterion | Target | Measurement | Date |
|-----------|--------|-------------|------|
| **Phase 3 Production** | All systems stable, 0 critical incidents | Cloud Logs dashboard + weekly review | 2026-05-14 |
| **Phase 4 Deploy** | Portal + NOTIVISA live, gov batch acceptance | Firebase deploy + gov test batch ACK | 2026-06-02 |
| **Phase 5 Deploy** | Críticos + IA live, OCR accuracy ≥92% | E2E tests + 100-sample validation | 2026-06-27 |
| **Phase 7 Deploy** | Audit trail + anomaly detection + alerts live | Firebase deploy + E2E tests ≥85% coverage | 2026-08-04 |
| **Phase 6–9 Deliver** | All 4 phases live, DICQ ≥88% | Compliance audit + Firebase deploy | 2026-08-15 |
| **Compliance Baseline** | DICQ 88%+, RDC 978 92%+, LGPD 85%+ | Third-party audit report | 2026-08-31 |
| **Test Coverage** | ≥95% on new code | nyc report Phase 4–9 | 2026-08-15 |
| **Zero Critical Debt** | No open ADRs blocking deploy | ADR registry review | 2026-08-15 |

---

## Timeline Visualization

```
May              Jun              Jul              Aug
│────────────────────────────────────────────────│

Phase 3: LIVE (complete)
  └──────────────────────────────────────────────┘ May 7

Phase 4: Portal + NOTIVISA (planned)
  │─ schema + UI ─────────┤ May 27
  │─ NOTIVISA API ────────┤ May 27
  │─ integration + deploy ┤ Jun 2

Phase 5: Críticos + IA Strip (planned)
       │─ severity + cascade ─────────┤ Jun 12
       │─ IA strip parser ────────────┤ Jun 21
       │─ E2E + deploy ──────────────┤ Jun 27

Phase 6–9: Quality Assurance & Compliance
              │── Phase 6 (CAPA, 2w) ────┤ Jul 14
              │── Phase 7 (Auditoria AI, 2w) ──┤ Aug 4  [NEW]
              │── Phase 8 (NOTIVISA edge, 2w) ┤ Aug 18
              └── Phase 9 (Manual QC + Bio, converge Aug 15)

Target completion: 2026-08-15 (overall v1.4 milestone) ✓
Compliance audit: 2026-08-31 (final sign-off)
```

---

**Created:** 2026-05-07  
**Updated:** 2026-05-08 (Phase 7 planned)  
**Status:** Phase 3 LIVE, Phase 7 PLANNED, Phases 4–5 detailed, Phases 6, 8–9 sketched  
**Next Step:** Execute Phase 4 (Portal + NOTIVISA) on 2026-05-20
