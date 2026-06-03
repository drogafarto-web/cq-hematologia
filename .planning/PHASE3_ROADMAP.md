# Phase 3 Roadmap — Analytics + Data Export + Mobile

**Status**: Planning  
**Duration**: 6-8 weeks  
**Timeline**: 2026-05 to 2026-07 (Q2/Q3)  
**Team**: ~6 engineers (2 mobile, 2 backend, 2 analyst/frontend)

---

## Phase Structure

### Phase 3.1 — Foundation (Weeks 1-2)

**Goal**: Infrastructure ready. Mobile stack booted. Analytics queries validated. Export templates drafted.

**Deliverables**:

- ✅ Mobile project initialized (Expo or React Native CLI)
- ✅ Mobile auth flow (Firebase + session sync)
- ✅ Analytics module structure (hooks + services + types)
- ✅ Analytics: CIQ compliance aggregation query (CloudFn + Firestore rule)
- ✅ Export: SheetJS wrapper + Cloud Function skeleton
- ✅ All three modules: unit tests + CI passing

**Blockers resolved**:

- Mobile CI/CD pipeline (GitHub Actions → TestFlight/Play Store)
- Firestore indices needed for analytics queries (CT-05 from Phase 2)
- Export: Cloud Function timeout strategy (30s default → 540s for large labs)

**Go/No-Go Gate**: All three codebases compile, unit tests green, data pipelines return valid JSON.

---

### Phase 3.2 — Core Features (Weeks 2-4)

**Goal**: All critical user flows implemented. Mobile writes working. Analytics dashboards visible. Export formats functional.

**Deliverables**:

#### Mobile (Week 2-4)

- ✅ Auth screen (login + 2FA)
- ✅ CIQ flow: list runs → view run → edit comments → submit (offline queue)
- ✅ NC flow: list open NCs → view → add action → resolve
- ✅ Readings: manual entry form + submit
- ✅ Training: view execucao → sign electronically
- ✅ Offline sync: queue + retry logic + conflict resolution

#### Analytics (Week 2-4)

- ✅ ComplianceStatusDash (% runs valid, open NCs, audit findings)
- ✅ CIQTrendsDash (Levey-Jennings, equipment failure trends)
- ✅ NCHeatmapDash (open NCs by module/equipment, age distribution)
- ✅ TrainingMatrixDash (certifications, expirations, competency gaps)
- ✅ Caching layer (Zustand + Redis for large labs)
- ✅ PDF export per dashboard

#### Export (Week 2-4)

- ✅ ExportWizard UI (step 1: select format, step 2: date range, step 3: review)
- ✅ XLSX CIQ export (all runs, status, equipment, operator)
- ✅ XLSX NC register (open + closed, CAPA, effectiveness)
- ✅ PDF Compliance Report (RDC 978 checklist mapped to evidence)
- ✅ Job queue (initiate → process → store → cleanup)
- ✅ Storage signed URLs (7-day expiry)

**Blockers resolved**:

- Mobile offline data model (define sync conflict strategy)
- Analytics real-time vs scheduled (decision: scheduled hourly for first pass)
- Export timeout strategy (large labs >100k docs)

**Go/No-Go Gate**: Mobile E2E test passes (auth → CIQ → offline → sync). Analytics dashboard loads <2s. Export job completes <5min for 10k runs.

---

### Phase 3.3 — Polish & Integration (Weeks 5-6)

**Goal**: UX refined. Performance optimized. Edge cases handled. Mobile beta-ready.

**Deliverables**:

#### Mobile (Week 5-6)

- ✅ Dark mode (CLAUDE.md brand compliance)
- ✅ Offline indicators (banner showing sync status)
- ✅ Image capture + attachment (photo evidence for NC)
- ✅ Biometric auth option (Face ID / fingerprint)
- ✅ Accessibility audit (a11y checklist)
- ✅ E2E test suite (Detox: 5 critical flows)
- ✅ TestFlight + Play Store beta ready

#### Analytics (Week 5-6)

- ✅ Real-time updates (WebSocket or polling 30s)
- ✅ Export PDF from dashboard (snapshot + timestamp)
- ✅ Custom date ranges (date picker, last 30d/90d/1y)
- ✅ Filter by equipment / operator / module
- ✅ Mobile responsive (dashboards work on tablet)

#### Export (Week 5-6)

- ✅ CSV raw audit log (forensics export)
- ✅ Excel conditional formatting (out-of-range cells highlighted)
- ✅ PDF compression (reduce file size <10MB for large labs)
- ✅ Email delivery option (send download link via email)
- ✅ Batch export (export multiple formats at once)
- ✅ Schedule recurring exports (weekly backup pattern)

**Blockers resolved**:

- Large dataset handling (test with real 100k+ records)
- Mobile memory usage (avoid crashes on low-end devices)
- Export PDF rendering time (async generation)

**Go/No-Go Gate**: Mobile TestFlight public test link ready. Analytics dashboards pass performance audit. Export handles edge cases (empty data, very large datasets, special characters).

---

### Phase 3.4 — Testing & Documentation (Weeks 7-8)

**Goal**: Quality gate passed. Runbooks written. Deploy ready.

**Deliverables**:

#### All Modules

- ✅ Integration tests (Mobile ↔ Firestore, Analytics ↔ Cloud Functions, Export ↔ Storage)
- ✅ Performance tests (load testing for analytics queries, concurrent exports)
- ✅ Security audit (mobile + API rate limits, export access control)
- ✅ Compliance check (RDC 978 violations? Audit trail intact?)
- ✅ Documentation (API contracts, offline sync spec, export job status codes)
- ✅ Runbooks (troubleshooting, manual data recovery, export stuck jobs)

#### Deployment Checklist

- ✅ Firebase configuration (new Cloud Functions, rules updates, indices)
- ✅ Mobile app signing certificates ready (iOS + Android)
- ✅ TestFlight review passed (Apple), Play Store review passed (Google)
- ✅ Production secrets injected (API keys, Service Account JSON)
- ✅ Monitoring set up (Sentry, Firebase Crashlytics, Cloud Logging)
- ✅ Rollback plan documented (revert function versions, data recovery)

**Go/No-Go Gate**: All integration tests pass. Security audit clean. Compliance check: 0 new RDC violations.

---

## Milestone Success Criteria

| Criterion             | Measure                       | Target         |
| --------------------- | ----------------------------- | -------------- |
| Mobile availability   | App store + TestFlight        | Both available |
| Mobile adoption       | % of users accessing monthly  | >30%           |
| Analytics performance | Query p95 latency             | <2s            |
| Analytics freshness   | Data lag                      | <1h            |
| Export reliability    | Job success rate              | >99%           |
| Export performance    | XLSX gen (100k runs)          | <5min          |
| Compliance            | New RDC 978 violations        | 0              |
| Test coverage         | Critical flows                | >95%           |
| Bug escape rate       | Severity 1 bugs in first week | 0              |

---

## Resource Plan

| Role               | Count    | Weeks | Effort (person-weeks) |
| ------------------ | -------- | ----- | --------------------- |
| Mobile Engineer    | 2        | 8     | 16                    |
| Backend Engineer   | 2        | 8     | 16                    |
| Analyst / Frontend | 2        | 8     | 16                    |
| QA / Tester        | 1        | 4-8   | 6                     |
| DevOps / Infra     | 0.5      | 8     | 4                     |
| **Total**          | **~6-7** | **8** | **~58 person-weeks**  |

---

## Risks & Mitigation

| Risk                                  | Impact                  | Likelihood | Mitigation                                   |
| ------------------------------------- | ----------------------- | ---------- | -------------------------------------------- |
| Mobile offline sync complexity        | Schedule slip           | Medium     | Prototype offline model early (Phase 3.1)    |
| Analytics query timeouts (large labs) | Slow dashboards         | Medium     | Use indices + scheduled aggregation          |
| Export PDF rendering memory leak      | Crash on large datasets | Medium     | Test with >100k records, use streaming       |
| Mobile app store review delay         | Launch delay            | Low        | Submit 2 weeks early, have backup PWA        |
| Compliance violation discovered       | Rework + delay          | Low        | Audit trail review before Phase 3.1 end      |
| Team bandwidth                        | Schedule slip           | Medium     | Hire contractor if needed; prioritize Mobile |

---

## Phase 3 Backlog (Nice-to-Have, Post-MVP)

- [ ] Mobile push notifications (lab alerts → phone)
- [ ] Analytics: predictive alerts (equipment failure, NC trend)
- [ ] Export: template customization (labs design own report formats)
- [ ] Mobile: barcode scanning (equipamentos, insumos)
- [ ] Analytics: multilab view (director manages 5 labs at once)
- [ ] Export: scheduled downloads (weekly snapshot to cloud drive)
- [ ] Mobile: AI-powered form filling (OCR laudo → pre-fill form)
- [ ] Analytics: AI anomaly detection (flag unusual CIQ patterns)

---

## Next Steps

1. **Review & Approval**: CTO reviews PHASE3_REQUIREMENTS.md + PHASE3_ROADMAP.md
2. **Staffing Decision**: Confirm team size (6 or scale differently?)
3. **Stack Decision**: Mobile native vs PWA? Analytics real-time vs scheduled?
4. **Timeline**: Can Phase 3 start 2026-05-11, or schedule later?
5. **Phase 3.1 Kickoff**: `/gsd-plan-phase 3.1` to create detailed execution plan

---

**Created**: 2026-05-04 (HC Quality Phase 2 completion)  
**Last updated**: 2026-05-04  
**Owner**: CTO (requires approval for execution)
