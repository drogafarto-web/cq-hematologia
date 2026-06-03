# Phase 6: CAPA + Incident Response

**Status:** Plans Finalized  
**Date:** 2026-05-08  
**Estimated Duration:** 2 weeks (2026-06-30 → 2026-07-14)  
**Team Allocation:** 2.5 FTE (1.0 Backend, 0.8 Frontend, 0.2 Infrastructure, 0.5 DevOps)

---

## Overview

Phase 6 implements **CAPA module** (Corrective/Preventive Action tracking) per RDC 978 Art. 99 + DICQ 4.14.2, plus operational **Incident Response infrastructure** (severity matrix, on-call rotation, incident commander authority, runbooks, post-mortem framework).

This phase bridges compliance requirements (CAPA for finding management) with operational resilience (incident response for production support).

---

## Plans

| Plan      | Focus                                               | Type    | Wave | Dependencies                    |
| --------- | --------------------------------------------------- | ------- | ---- | ------------------------------- |
| **06-01** | CAPA schema + callables + Rules                     | execute | 1    | None (Phase 3 audit foundation) |
| **06-02** | CAPA UI (list, detail, forms, dark-first)           | execute | 2    | 06-01                           |
| **06-03** | Incident Response infrastructure (docs + callables) | execute | 2    | 06-01                           |
| **06-04** | Testing + compliance audit (RDC/DICQ/WCAG)          | execute | 3    | 06-01, 06-02, 06-03             |

---

## Deliverables by Plan

### Plan 06-01: CAPA Schema

- **Type System:** CAPA root + CAParecao (actions) + Verificacao (verifications)
- **Cloud Functions:** 4 callables (createCAPA, updateCAPA, assignCAPA, verifyCAPA) + soft-delete
- **Firestore Rules:** Role-based access (RT/admin only), immutability on findings + verifications
- **Firestore Indexes:** 3 composite indexes (status, assignee, due date)
- **Service Layer:** CRUD wrappers calling callables
- **Unit Tests:** 12+ tests (happy path + error cases)

**Artifacts:**

- `src/features/sgq/capa/types.ts` — Type definitions
- `src/features/sgq/capa/services/capaService.ts` — Service layer
- `functions/src/modules/capa.ts` — Cloud Function callables
- `functions/src/modules/capa.test.ts` — Unit tests
- `firestore.rules` — Immutability + role-based access
- `firestore.indexes.json` — Query optimization

**Compliance Coverage:**

- RDC 978 Art. 99 — CAPA finding-to-closeout lifecycle
- RDC 978 Art. 128 — Audit trail integration (HMAC-sealed)
- DICQ 4.14.2 — Nonconformity procedures (identification, action, verification)

---

### Plan 06-02: CAPA UI

- **List View:** Table with filtering (status, assignee), real-time updates, dark-first design
- **Detail View:** Finding summary, action cards, verification form, audit trail
- **Forms:** Create CAPA, assign action, verify effectiveness
- **Accessibility:** WCAG AA (contrast ≥4.5:1, focus rings, keyboard nav)
- **Routes:** `/capa`, `/capa/{capaId}`, `/capa/create`

**Artifacts:**

- `src/features/sgq/capa/hooks/useCAPAList.ts` — Real-time list subscription
- `src/features/sgq/capa/hooks/useCAPADetail.ts` — Detail + subcollections
- `src/features/sgq/capa/components/CAPAListView.tsx` — Table (dark-first, sortable)
- `src/features/sgq/capa/components/CAPADetailView.tsx` — Detail page
- `src/features/sgq/capa/components/CAPAForm.tsx` — Create form
- `src/features/sgq/capa/components/ActionCard.tsx` — Action display
- `src/features/sgq/capa/components/VerificationForm.tsx` — Verification submission
- `src/features/sgq/capa/pages/CAPAHome.tsx` — Top-level page
- `src/routes.tsx` — Route definitions

**Compliance Coverage:**

- WCAG 2.1 Level AA — Accessibility
- Design excellence — Apple/Linear/Stripe reference (dark-first, typography, spacing)

**Checkpoint:** Human visual verification (button activation, contrast, keyboard nav, dark theme)

---

### Plan 06-03: Incident Response Infrastructure

- **Severity Matrix:** Green/Yellow/Red/Black classification with decision tree + SLAs
- **On-Call Rotation:** 4-week template with role definitions, escalation rules
- **IC Authority:** Incident Commander scope (what can do without CTO approval)
- **Runbooks:** 8+ critical procedures (function timeout, database recovery, auth failure, Rules broken, data corruption, NOTIVISA failure, etc.)
- **Contact Tree:** Who to notify at each severity level (internal, team, leadership, legal)
- **Communication Templates:** 4 standard messages (customer incident, regulatory report, internal alert, post-mortem)
- **Post-Mortem Framework:** Blameless review process, RCA template, action item tracking
- **Cloud Functions:** 4 callables (createIncident, escalateIncident, closeIncident, recordPostMortem)

**Artifacts:**

- `docs/incident-response/SEVERITY_MATRIX.md` — Classification (Green/Yellow/Red/Black)
- `docs/incident-response/ON_CALL_ROTATION.md` — 4-week cycle template (ops team to populate)
- `docs/incident-response/INCIDENT_COMMANDER_AUTHORITY.md` — IC scope + decision criteria
- `docs/incident-response/RUNBOOK_LINKS.md` — 8+ runbook index
- `docs/incident-response/CONTACT_TREE.md` — Escalation paths (ops team to populate)
- `docs/incident-response/COMMUNICATION_TEMPLATES.md` — 4 message templates
- `docs/incident-response/POST_MORTEM_FRAMEWORK.md` — Blameless review guide
- `src/features/admin/incident-response/types.ts` — Type system
- `src/features/admin/incident-response/services/incidentService.ts` — Service layer
- `functions/src/modules/incident.ts` — Cloud Function callables

**Compliance Coverage:**

- Operational resilience (incident response SLAs)
- Communication protocol (DICQ 4.4 external communication)
- Post-mortem / continuous improvement (DICQ 4.15 management review)

**Checkpoint:** Ops team sign-off on contact details + runbooks

---

### Plan 06-04: Testing + Compliance Audit

- **Unit Tests (12+):** CAPA callables (create, update, assign, verify, soft-delete)
- **Integration Test (1):** Full CAPA lifecycle (create → assign → verify → close)
- **Severity Classification Tests (8):** Green/Yellow/Red/Black scenarios + escalation rules
- **Accessibility Tests (6+):** WCAG AA compliance (contrast, focus, keyboard nav, semantic HTML)
- **Compliance Audit Report:** RDC 978 Art. 99 + DICQ 4.14.2 mapping

**Artifacts:**

- `functions/src/modules/capa.test.ts` — 12+ unit tests
- `__tests__/capa/integration.test.ts` — 1 E2E test
- `__tests__/incident-response/severity-matrix.test.ts` — 8 classification tests
- `__tests__/accessibility/wcag-aa-audit.test.ts` — 6+ a11y tests (Axe-core)
- `.planning/phases/06-capa-incident-response/COMPLIANCE_AUDIT_06.md` — Requirement mapping

**Test Results Expected:**

- 27+ tests total, 100% passing
- 0 automated accessibility violations
- RDC 978: 100% coverage (Arts. 99, 128)
- DICQ: 100% coverage (4.14.2, 4.4, 4.15)
- WCAG AA: 100% coverage (Level AA)

**Checkpoint:** QA + CTO approval before Phase 6 handoff

---

## Compliance Mapping

| Standard        | Article  | Requirement                   | Implementation                                           |
| --------------- | -------- | ----------------------------- | -------------------------------------------------------- |
| **RDC 978**     | Art. 99  | CAPA management               | CAPA module (finding → action → verify → close)          |
| **RDC 978**     | Art. 128 | Rastreabilidade (audit trail) | registerAuditEntry callable + HMAC-SHA256 chain          |
| **RDC 978**     | Art. 115 | 5-year retention              | Soft-delete only (no hard-delete), audit trail preserved |
| **DICQ 4.14.2** | —        | Nonconformity procedures      | CAPA: identification, action, verification, tracking     |
| **DICQ 4.14.6** | —        | Preventive action             | CAPA tipo='preventiva' + risk module linkage             |
| **DICQ 4.4**    | —        | Audit documentation           | Audit trail with immutability rules                      |
| **DICQ 4.15**   | —        | Management review             | Post-mortem framework for continuous improvement         |
| **WCAG 2.1**    | Level AA | Accessibility                 | CAPA UI: contrast, focus, keyboard navigation            |

---

## Technical Specifications

**Database:**

- Multi-tenant: `/labs/{labId}/capa/{capaId}` + subcollections
- Soft-delete: `deletadoEm` field (never hard-delete)
- Audit trail: Every state change sealed via Cloud Function callable

**Security:**

- Firestore Rules: Client writes rejected, Cloud Function writes allowed
- Role-based access: RT/admin can create/update; auditor can read
- Audit chain: HMAC-SHA256 + previousHash linking (ADR-0012)

**Accessibility:**

- Dark-first design: bg-[#141417], text-white/90
- Contrast: ≥4.5:1 text, ≥3:1 large text
- Focus: Visible ring on all interactive elements
- Keyboard: Tab + Enter operates entire interface

---

## Wave Structure

**Wave 1 (Parallel):** 06-01 (Schema + callables)  
**Wave 2 (Parallel):** 06-02 (UI) + 06-03 (Incident Response docs)  
**Wave 3 (Sequential):** 06-04 (Testing + compliance) [depends on 06-01/02/03]

**Timeline:**

- Week 1 (06-30 ~ 07-06): 06-01 + 06-03
- Week 2 (07-07 ~ 07-14): 06-02 + 06-04
- Deploy: 2026-07-14

---

## Success Criteria

- [ ] All CAPA callables implemented and tested (12+ tests passing)
- [ ] CAPA UI dark-first, WCAG AA compliant (0 violations)
- [ ] Firestore Rules enforce immutability on findings + verifications
- [ ] Incident response docs complete (7 files, ops team sign-off)
- [ ] 27+ tests total, 100% passing (unit + integration + accessibility)
- [ ] RDC 978 Art. 99 coverage: 100%
- [ ] DICQ 4.14.2 coverage: 100%
- [ ] WCAG AA coverage: 100%
- [ ] Checkpoint approvals: QA (testing), CTO (compliance), Ops (incident response)
- [ ] Zero TypeScript errors
- [ ] Zero Firestore Rules deploy errors

---

## Known Limitations / Future Work

None identified for Phase 6 scope. All deliverables fully specified.

Phase 7 will add:

- Export Wizard (multi-format XLSX/PDF/CSV)
- Mobile responsive UI overhaul
- Batch export scheduler + email delivery

---

## Files Created

```
.planning/phases/06-capa-incident-response/
├── 06-01-CAPA-SCHEMA-PLAN.md              (Schema + callables + Rules)
├── 06-02-CAPA-UI-PLAN.md                  (UI components + hooks + routes)
├── 06-03-INCIDENT-RESPONSE-PLAN.md        (Severity matrix + docs + callables)
├── 06-04-TESTING-COMPLIANCE-PLAN.md       (Tests + audit report)
├── COMPLIANCE_AUDIT_06.md                 (RDC/DICQ/WCAG mapping, auto-generated after 06-04)
├── PHASE-06-FINAL-SUMMARY.md              (Completion summary, auto-generated after 06-04)
└── README.md                              (This file)
```

---

## Next Phase (Phase 7)

Phase 7 (Export Wizard + Mobile) begins 2026-07-15, depends on Phase 6 deployment (2026-07-14).

See `.planning/ROADMAP.md` for full v1.4 schedule.

---

**Created:** 2026-05-08  
**Status:** All plans finalized, ready for execution  
**Next Action:** Execute 06-execute-phase 06 (or `/gsd-execute-phase 06`)
