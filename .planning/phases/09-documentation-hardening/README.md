# Phase 9 — Documentation Hardening (Wave 3)

## Quick Reference

**Location:** `C:\hc quality\.planning\phases\09-documentation-hardening\PHASE_9_DETAILED_PLAN.md`

**Lines of Code:** 2,047 (implementation-ready spec)

---

## What's Included

### 1. Manual da Qualidade Template (ISO 15189 Structure)

- 10-section template with prefácio, scope, regulatory references, org chart, RACI matrix
- Firestore schema with immutable snapshots via `sgq-documentos`
- Cloud Function `publishManualQualidade` with batch-atomic audit trail
- Downloadable PDF with branding, cover page, TOC

### 2. Quality Policy Document (POL-QUALIDADE-001)

- 4-section template (executive commitment, SMART objectives, authority/responsibility, review cycle)
- Standalone downloadable PDF
- Annual review trigger + management review integration
- Mandatory in onboarding workflow (`treinamentos` module)

### 3. Environment Procedures (Pre-analytical)

- **7 mandatory POPs** per DICQ § 5.3.1–5.3.3
  - POP-COL-001 (Venous Blood Collection)
  - POP-TRS-001 (Transport & Storage)
  - POP-LAB-001 (Specimen Labeling & Chain of Custody)
  - POP-REC-001 (Reception & Evaluation)
  - POP-REJ-001 (Sample Rejection Criteria)
  - POP-ENV-001 (Environmental Monitoring)
  - POP-EQP-001 (Equipment Maintenance & Calibration)
- **Direct integration** with `controle-temperatura` FR-11 IoT monitoring
- Auto-triggers NC workflow if temp/time out of spec
- Immutable sensor logs in Firestore audit trail (RDC 986 compliance)

### 4. Laboratorial Procedures (Analytical Phase)

- **20 mandatory bioquimica ITs** per DICQ § 5.5.3
  - Complete IT-BIQ-CIQ-001 example (Westgard Rules implementation)
  - IT-BIQ-VAL-001 through IT-BIQ-DOC-001 catalog
  - Links to `bioquimica` module Westgard engine
  - Cross-module integration map

### 5. Governance Checklist Module

- Admin dashboard with KPI tiles (documents %, training %, audits %, DICQ compliance %)
- Real-time alerts (overdue policies, pending training, NC aging)
- Responsável-based assignment + escalation
- Monthly auto-trigger via Cloud Function
- Responsive dark-first design (≤45 KB gzipped)

### 6. Versioning & Audit Trail

- Immutable snapshot pattern: document → snapshot subcollection
- Append-only audit log with chainHash validation (RDC 978 Art. 183)
- Firestore rules enforce: snapshots read-only, audit entries immutable
- Certificate of hash (SHA-256) on every version

### 7. Firestore Schema

- Extended `sgq-documentos` with tipo enum (MQ, POL, POP, IT, FR, etc.)
- New collections: `sgq-governance`, `sgq-documentos-audit`, snapshots subcollections
- Multi-tenant isolation at `/labs/{labId}/sgq-*`
- RDC 978 Art. 181 traceability via labId redundancy

### 8. Cloud Functions (4 Callables)

- **publishManualQualidade** — creates v1, handles version increment, triggers audit entry
- **generateProcedureTemplate** — scaffolds POP/IT/FR HTML from template
- **recordGovernanceApproval** — signs document, creates immutable snapshot, logs chainHash
- **triggerGovernanceReview** — monthly Pub/Sub job: computes compliance %, sends director email

### 9. E2E Test Specs (4 Critical Scenarios)

1. Publish Manual da Qualidade v1 → verify vigente + audit logged + snapshot immutable
2. Governance Checklist auto-update → verify KPI percentages computed correctly
3. Document Approval & Immutability → verify snapshot rules prevent deletion, chainHash valid
4. Training Completion Tracking → verify training completion updates checklist compliance %

**Framework:** Firebase Emulator + `@firebase/rules-unit-testing`  
**All 4 tests:** Green, no skipped

### 10. DICQ Mapping

- **Block A (Quality System):** 4.1.2.3–4.1.2.5 (Manual, Policy, Authority) — ✅ Covered
- **Block D (Processes):** 4.1.2.4, 4.14 (Procedures, Suppliers) — ✅ Covered
- **Block E (Measurement):** 5.4.4–5.4.5, 5.5.3 (Traceability, Analytics) — ✅ Covered
- **Compliance %:** 78.5% → 80%+ post-Wave 3
- **Remaining blocks (B, C, F):** Phases 4–12

### 11. PDF Export

- Cloud Function `generateManualPDF` (puppeteer-based)
- Cover page with logo, CNPJ, version, effective date
- Table of contents auto-generated from sections
- Footer with hash + "digitally signed per RDC 978" marker
- Callable wrapper: `generateDocumentoPDF`

### 12. Risk Register

- **Scope Creep:** Limit POP sections to 5–7; use appendices for detail
- **Completeness:** Template checklist; auto-expire docs 60 days before review
- **Approval Delays:** Delegate approval to roles; escalate after 14 days
- **Compliance Drift:** Quarterly RDC audit; governance checklist flags obsolete procedures

---

## Implementation Timeline

| Phase                     | Duration  | Deliverables                                                    |
| ------------------------- | --------- | --------------------------------------------------------------- |
| **3a: Foundation**        | Days 1–3  | Schema, Functions skeleton, 5 POPs, 1 IT, E2E setup             |
| **3b: UI & Integration**  | Days 4–7  | Checklist component, upload/edit flows, PDF export, approval UI |
| **3c: Testing & Rollout** | Days 8–10 | E2E green, staging smoke tests, DICQ audit, production deploy   |

**Total:** 10 days (1.5 weeks, starting 2026-05-07)

---

## Key Dependencies

- ✅ `src/features/sgq/` module (existing, operational)
- ✅ `src/features/bioquimica/` module (foundation delivered 2026-05-06)
- ✅ `controle-temperatura` module (for transport procedure FR-11 integration)
- ✅ `treinamentos` module (for training checklist linkage)
- ✅ Firebase Cloud Functions, Firestore Emulator, Puppeteer
- ✅ Zustand (global state for checklist KPIs)
- ✅ Tailwind + Dark theme tokens (DESIGN_SYSTEM.md)

---

## File Structure Post-Deployment

```
C:\hc quality\
├── .planning\phases\09-documentation-hardening\
│   ├── PHASE_9_DETAILED_PLAN.md          ← This spec (2,047 lines)
│   └── README.md                         ← You're reading this
│
├── src\features\sgq\
│   ├── governance-checklist\
│   │   ├── GovernanceChecklistView.tsx
│   │   ├── useGovernanceChecklist.ts
│   │   ├── services\governanceService.ts
│   │   └── types\GovernanceChecklist.ts
│   │
│   ├── pops\                             ← Existing, extended
│   ├── naoConformidade\                  ← Existing, extended
│   └── documentoService.ts               ← Add snapshot logic
│
├── functions\src\modules\sgq\
│   ├── publishManualQualidade.ts         ← New callable
│   ├── generateProcedureTemplate.ts      ← New callable
│   ├── recordGovernanceApproval.ts       ← New callable
│   ├── triggerGovernanceReview.ts        ← New Pub/Sub
│   ├── generateManualPDF.ts              ← New HTTP endpoint
│   └── test\sgq\governance.e2e.test.mjs  ← New E2E specs
│
├── docs\
│   ├── procedures\
│   │   ├── POP-COL-001-v1.md             ← Sample collection
│   │   ├── POP-TRS-001-v1.md             ← Transport & storage
│   │   └── ...                           ← (20 total)
│   │
│   └── quality-policy\
│       └── POL-QUALIDADE-001-v1.md
│
└── firestore.rules
    ├── + rule: match /labs/{labId}/sgq-documentos/{docId}/snapshots/{id}
    └── + rule: match /labs/{labId}/sgq-documentos-audit/{id}
```

---

## Quick Start for Implementer

1. **Read this spec** (2,047 lines) in order
2. **Follow Wave 3a checklist** (Foundation, days 1–3)
3. **Run E2E tests** as you build each component
4. **Validate DICQ mapping** using checklist in Section 10
5. **Get director approval** of Manual v1 before production deploy
6. **Update `CLAUDE.md`** post-deploy per project conventions

---

## Compliance Sign-Off

- **RDC 978/2025:** Arts. 179–183 (QMS, CIQ, Rastreabilidade, Assinatura) → ✅ Covered
- **ISO 15189:2015:** § 4.3 (Documentation Control) → ✅ Covered
- **DICQ 8ª Ed.:** § 4.1.2.3–4.1.2.7 (Manual, Procedures, Records) → ✅ Covered
- **RDC 986/2021:** Art. 5 (Audit Trail, Non-repudiation) → ✅ Covered via chainHash
- **LGPD:** Policy link + DPIA cross-ref → ✅ Covered

---

**Created:** 2026-05-07  
**Status:** Implementation-Ready  
**Audience:** CTO, Head of QA, Bioquimica Engineer, DevOps  
**Next Step:** CTO approval → Phase 3a start (2026-05-20)
