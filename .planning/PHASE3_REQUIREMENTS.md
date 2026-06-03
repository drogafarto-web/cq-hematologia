# Phase 3 — Requirements & Scope

**Milestone**: Analytics + Data Export + Mobile  
**Timeline**: 6-8 weeks (Q2/Q3 2026)  
**Status**: Planning (2026-05-04)

---

## Executive Summary

Phase 3 expands HC Quality from desktop-only web to **mobile-native + analytics + export ecosystem**. Three independent workstreams run in parallel, each adds a new dimension to the core quality control system.

**Why now?**

- Phase 2 completes all 20 core modules (auditoria, pops, nc, controle-temperatura, educacao-continuada live)
- Labs need mobile to capture readings in field (calibration, temperature checks, training signature)
- Auditors demand data export (compliance evidence in XLSX/PDF format)
- Leadership needs dashboards (KPI trends, compliance status, incident heatmaps)

---

## Module 1: Mobile App (React Native / Expo)

**Objective**: Full feature parity with web. Operator can do everything on phone: read reports, create/resolve NC, sign training, log temperature, capture photos.

### MVP Scope (must-have)

| Feature         | Desktop                                | Mobile                            | Notes                         |
| --------------- | -------------------------------------- | --------------------------------- | ----------------------------- |
| **CIQ runs**    | ✅ Create/edit/sign                    | ✅ Create/edit/sign               | offline-first for IoT edge    |
| **NC workflow** | ✅ Open → investigate → action → close | ✅ Same                           | barcode scan equipamentos     |
| **Readings**    | ✅ Manual + IoT                        | ✅ Manual + QR device pairing     | tap-to-submit + offline queue |
| **Training**    | ✅ Record execution + competency       | ✅ Same                           | biometric sign (optional)     |
| **Reports**     | ✅ PDF export                          | ✅ PDF preview + share            | no printing                   |
| **Offline**     | ❌ Not needed                          | ✅ Queue writes, sync when online | critical for field work       |
| **Camera**      | ❌ (Drive links only)                  | ✅ Capture + attach               | laudo photos, evidence        |
| **Auth**        | ✅ Email + 2FA                         | ✅ Same                           | session persistence           |

**Stack decision needed**:

- React Native (code share with web? No — web is React, mobile ≠ compatible)
- Expo managed (faster launch) vs bare workflow
- Local SQLite for offline sync, or Firestore offline persistence only?

**Deliverables**:

- `src/mobile/` — Expo project (separate repo or monorepo subfolder)
- `src/mobile/screens/{CIQ,NC,Training,Reports,Auth,Offline}`
- Cloud Functions: sync queue handler (`mobileOfflineSyncQueue` callable)
- Firestore rules: allow mobile to write queue docs
- Beta testing: 5 users on testflight before prod

**Estimate**: 4 weeks (4 team members in parallel, 1 week overlap)

---

## Module 2: Analytics & Dashboards

**Objective**: Real-time KPI views for lab director + auditor. Compliance trends, incident hotspots, operator performance.

### MVP Scope (must-have)

| Dashboard             | Audience  | Metrics                                                                | Frequency |
| --------------------- | --------- | ---------------------------------------------------------------------- | --------- |
| **Compliance Status** | Director  | % CIQ compliant, NC open/closed, audit findings                        | Daily     |
| **CIQ Trends**        | QA Lead   | Levey-Jennings overlay, out-of-range frequency, equipment failure rate | Real-time |
| **NC Heatmap**        | Director  | Open NCs by module, by equipment, by age                               | Real-time |
| **Training Matrix**   | HR/QA     | Operator certifications expiring, recurrency due, competency gaps      | Weekly    |
| **Audit Evidence**    | Auditor   | RDC 978 compliance checklist, control evidence gallery, trail segments | On-demand |
| **Supplies**          | Logistics | Insumo expiration, stock level by category, movement audit             | Weekly    |

**Stack**:

- Frontend: Recharts (line/bar/scatter) + Zustand state (caching KPI calls)
- Backend: Firestore aggregation queries OR separate analytics Cloud Function (scheduled daily)
- Storage: BigQuery (optional, for historical trends >1 year)

**Deliverables**:

- `src/features/analytics/` — new module (hooks + services + components + types)
- Views: ComplianceStatusDash, CIQTrendsDash, NCHeatmapDash, TrainingMatrixDash, AuditEvidenceDash, SuppliesDash
- Cloud Functions: `aggregateCIQCompliance` (scheduled daily), `computeNCHeatmap` (realtime), etc.
- Firestore: read-only aggregation rules (no new writes)
- Export to PDF: each dashboard has "download as PDF" button

**Estimate**: 3 weeks (2 analysts in parallel, final integration 1 week)

---

## Module 3: Data Export (CSV/XLSX/PDF)

**Objective**: Auditor downloads full compliance dataset in 1 click. Supports PNCQ export format, RDC 978 checklist, custom queries.

### MVP Scope (must-have)

| Format                      | Contents                                                            | Use Case                               | Estimate                     |
| --------------------------- | ------------------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| **XLSX — CIQ Data**         | All runs (hematologia, imuno, coag, uro) + QC status                | Year-end audit, lab transfer           | SheetJS + job queue          |
| **XLSX — NC Register**      | All non-conformities (open + closed) + CAPA + effectiveness         | Compliance evidence                    | Same job queue               |
| **XLSX — Training Matrix**  | Operator certifications + competency assessments + dates            | PNCQ alignment                         | Same                         |
| **PDF — Compliance Report** | RDC 978 checklist (16 sections) + photos + signatures               | Regulatory submission                  | ReportLab or chrome headless |
| **PDF — FR-11 Monthly**     | Temperature logs grouped by equipment + out-of-range alerts         | Already exists, enhance with analytics |
| **CSV — Raw audit log**     | All `auditLogs` entries (created, updated, deleted, status changes) | Forensics + compliance trail           | Raw dump, 64MB limit         |

**Stack**:

- Frontend: Zustand state machine (select format → parameters → enqueue)
- Backend: Cloud Functions (long-running, job queue pattern)
- SheetJS (for XLSX generation server-side)
- Chromium via `puppeteer` or `playwright` (for PDF rendering)
- Cloud Storage: signed URLs for download links (expiring 24h)
- Firestore: `exportJobs` collection tracking status

**Deliverables**:

- `src/features/exports/` — new module (ExportWizard + ExportQueueView)
- Cloud Functions: `initiateExport` callable, `processExportJob` trigger, `cleanupExpiredExports` scheduled
- Firestore: `labs/{labId}/exportJobs/{jobId}` collection
- Storage: `labs/{labId}/exports/{jobId}/{format}.{ext}` (auto-delete 7 days)

**Estimate**: 3 weeks (2 backend engineers in parallel, 1 week UI integration)

---

## Cross-Module Requirements

### Authentication & Authorization

- Mobile: same `useAuthStore` as web, session tokens valid for 7 days (refresh via `updateTokenOnBackground`)
- Analytics: read-only queries, no new auth gates (uses existing rules)
- Export: `exportAdmin` or standard `labMember` role allowed to export (configurable per lab)

### Security

- Mobile: all writes signed via `LogicalSignature` (same as web)
- Export: downloaded files are NOT audit-logged by default (add flag to log exports separately)
- API rate limits: export queue max 10 jobs/lab/hour (prevent DoS)

### Compliance (RDC 978)

- **Mobile**: Every write captured in `auditLogs` — no special handling needed (same service layer)
- **Analytics**: Dashboards themselves are not logged, but queries that aggregate data must preserve data integrity (use read-only rules)
- **Export**: Export job initiation IS logged; file generation is not. File download logs only file ID + size (not full content)

### Testing

- **Mobile**: E2E via Detox or Appium (5 critical user flows: auth → CIQ create → NC resolve → reading → sign)
- **Analytics**: Jest snapshots for dashboard data shapes, visual regression for charts
- **Export**: Test matrix: 6 formats × 3 size categories (small, medium, large lab) = 18 scenarios

---

## Dependencies & Blockers

| Dependency                                      | Status         | Impact                                      |
| ----------------------------------------------- | -------------- | ------------------------------------------- |
| Phase 2 complete (all modules deployed)         | ✅ Done        | Analytics + Export depend on live data      |
| Firestore aggregation queries optimized         | 🟡 Partial     | CIQ compliance query may need index         |
| Mobile CI/CD pipeline (TestFlight + Play Store) | 🔴 Not started | Needed for beta release                     |
| Data retention policy (LGPD)                    | 🟡 Partial     | Export should exclude deleted personal data |

---

## Phase 3 Phases (sub-breakdown)

| Phase    | Week  | Deliverable                                        | Team               |
| -------- | ----- | -------------------------------------------------- | ------------------ |
| **3.1**  | W1-W2 | Mobile stack setup + auth working                  | 1 mobile engineer  |
| **3.2**  | W1-W2 | Analytics module structure + CIQ compliance query  | 1 analyst          |
| **3.3**  | W1-W2 | Export wizard UI + SheetJS integration             | 1 backend engineer |
| **3.4**  | W2-W3 | Mobile: CIQ + NC workflows                         | 2 mobile           |
| **3.5**  | W2-W3 | Analytics: all 6 dashboards + PDF export           | 1 analyst          |
| **3.6**  | W2-W3 | Export: Cloud Function job queue + storage cleanup | 1 backend          |
| **3.7**  | W4    | Mobile: readings + training + offline sync         | 2 mobile           |
| **3.8**  | W4    | Analytics: performance tuning + caching            | 1 analyst          |
| **3.9**  | W4    | Export: testing + edge cases (large datasets)      | 1 backend          |
| **3.10** | W5-W6 | Mobile E2E + TestFlight beta                       | 2 mobile           |
| **3.11** | W5-W6 | Analytics: UI polish + dark mode                   | 1 analyst          |
| **3.12** | W5-W6 | Export: accessibility + PDF compression            | 1 backend          |
| **3.13** | W7    | Integration testing + bug triage                   | Full team          |
| **3.14** | W8    | Production deploy + monitoring                     | Full team          |

---

## Success Criteria

- [ ] Mobile app on TestFlight (iOS) + Play Store beta (Android)
- [ ] All 6 analytics dashboards accessible from `/analytics` route
- [ ] Export wizard works end-to-end (select format → enqueue → download)
- [ ] 0 new RDC 978 violations (audit trail continues unbroken)
- [ ] <2s load time for analytics queries (p95)
- [ ] <5min for XLSX export (lab with 100k CIQ runs)
- [ ] 95%+ test coverage for critical flows
- [ ] Mobile offline queue syncs within 5 minutes of re-connection

---

## Known Unknowns

1. **Mobile web vs native trade-off** — should we build React Native or just PWA? (PWA is faster, but native has camera + biometric)
2. **Analytics real-time vs scheduled** — should we aggregate on-demand (slower, always fresh) or schedule hourly (fast, stale <1h)?
3. **Export formats priority** — which 2 formats are must-have? (XLSX + PDF likely, but CSV?))
4. **Offline sync strategy** — SQLite local DB or Firebase offline persistence? (SQLite = more control, Firebase = simpler)

---

## Metrics to Track (Post-Launch)

- Mobile adoption rate (% users accessing mobile/week)
- Analytics query latency (p50/p95/p99)
- Export success rate (% jobs completed without error)
- Data freshness lag (analytics stale by how much?)
- Compliance audit findings related to Phase 3 modules
