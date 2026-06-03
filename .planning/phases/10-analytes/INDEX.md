# Phase 10 Analyte Registry & Multi-Instrument Strategy — Complete Index

## Quick Navigation

| Document                                                                           | Purpose                                          | Audience                | Read Time |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------- | --------- |
| [**DELIVERABLES_SUMMARY.txt**](DELIVERABLES_SUMMARY.txt)                           | Executive overview + statistics                  | CTO, Project Manager    | 10 min    |
| [**README.md**](README.md)                                                         | Architectural guide + compliance                 | Engineers, QI Directors | 20 min    |
| [**PHASE_10_MULTI_INSTRUMENT_STRATEGY.md**](PHASE_10_MULTI_INSTRUMENT_STRATEGY.md) | Complete technical specification (11 sections)   | Engineers, Architects   | 45 min    |
| [**IMPLEMENTATION_GUIDE.md**](IMPLEMENTATION_GUIDE.md)                             | Code templates + step-by-step (copy-paste ready) | Developers              | 30 min    |
| [**PHASE_10_ANALYTE_REGISTRY.json**](PHASE_10_ANALYTE_REGISTRY.json)               | 30 analytes with metadata + Westgard thresholds  | Database/Data Engineers | 5 min     |

---

## What Each Document Covers

### 1. DELIVERABLES_SUMMARY.txt

**Quick reference — key facts at a glance**

- Deliverables checklist (5 files created)
- Architectural decisions (5 major choices)
- Westgard implementation table
- RDC 978 + DICQ 4.3 compliance matrix
- File sizes + resource usage
- Phase 10 timeline (4 weeks)
- Validation checklist
- Outstanding decisions for CTO review
- Stakeholder questions

**Best for**: Getting up to speed in 10 minutes, decision-making.

---

### 2. README.md

**Architecture + requirements overview**

- Executive summary
- Detailed breakdown of each deliverable (Registry, Strategy MD, JSON)
- Firestore schema diagram
- Integration points (Rules, Functions, UI)
- RDC 978 ↔ DICQ 4.3 mapping table
- Phase 10 timeline + milestones (7 stages)
- Success criteria (8 measurable goals)
- Known issues & deferred work
- 7-step getting started guide
- Full references section

**Best for**: Understanding the big picture, planning the sprint, compliance verification.

---

### 3. PHASE_10_MULTI_INSTRUMENT_STRATEGY.md

**Complete technical specification (11 sections, 700+ LOC)**

Sections:

1. **Multi-Equipment Design** — schema, one-lot-to-many-equipment, run granularity
2. **Westgard Engine** — Cloud Function flow, rule evaluation logic, code
3. **Levey-Jennings Charts** — per-equipment + method comparison, data model
4. **Equipment Metadata** — lifecycle (ativo → manutencao → aposentado), calibration
5. **Lot Traceability** — creation flow, queries, archival, 5-year retention
6. **Cross-Equipment QC** — bias/precision comparison, acceptable thresholds
7. **Compliance & Audit Trail** — immutable events, RDC/DICQ mapping, signatures
8. **Phase 10 Checklist** — data structures, UI, tests, gates (15 items)
9. **Known Limitations** — extended Westgard disabled, no retroactive re-eval, no IoT
10. **Configuration & Deployment** — Firestore indexes (6), Functions, rollback
11. **References** — RDC 978, DICQ 4.3, CLSI EP15, ISO 15189, etc.

**Best for**: Deep technical understanding, implementation planning, architecture review.

---

### 4. IMPLEMENTATION_GUIDE.md

**Step-by-step code templates (production-ready snippets)**

8 implementation sections:

1. Load Analyte Registry into Firestore (seed function)
2. Implement Westgard Engine (westgardRulesCLSI.ts, 200 LOC)
3. Update Firestore Rules (equipment validation, immutable runs)
4. Create Cloud Function: recordRunBioquimica (300 LOC)
5. Build UI Components (selector, chart, form)
6. Testing checklist (unit + E2E + integration)
7. Deployment checklist
8. File structure summary

**Best for**: Hands-on coding, copy-paste templates, TDD setup.

---

### 5. PHASE_10_ANALYTE_REGISTRY.json

**Data: 30 analytes with complete metadata**

- 30 analytes (17 seed Phase 9 + 9 new Phase 10 + 4 imuno Phase 11)
- LOINC codes (Regenstrief 2025)
- Normal ranges (Brazilian adult reference)
- CV targets (PACS-CIQ + CLSI)
- Critical thresholds (8 analytes)
- Westgard rules (active: 1-2s, 1-3s, 2-2s, R-4s; extended: 4-1s, 10x, 6T, 6X)
- Test type classification
- Integration phase mapping

**Best for**: Database import, test fixtures, compliance documentation.

---

## Reading Paths by Role

### For Project Managers / CTOs

1. DELIVERABLES_SUMMARY.txt (10 min)
2. README.md (20 min)
3. Outstanding decisions section (5 min)

**Total: 35 min** — enough to approve sprint

### For Architects / Tech Leads

1. README.md (20 min)
2. PHASE_10_MULTI_INSTRUMENT_STRATEGY.md Sections 1-7 (40 min)
3. IMPLEMENTATION_GUIDE.md file structure (5 min)

**Total: 65 min** — complete design review

### For Backend Engineers

1. IMPLEMENTATION_GUIDE.md (30 min) — code templates
2. PHASE_10_MULTI_INSTRUMENT_STRATEGY.md Sections 2, 4, 10 (30 min) — Westgard, equipment, deploy
3. westgardRulesCLSI.ts implementation (2-3 hours coding)

**Total: 1-2 hours prep + 3 hours coding**

### For Frontend Engineers

1. README.md (20 min)
2. IMPLEMENTATION_GUIDE.md Sections 5-6 (20 min) — UI components + tests
3. PHASE_10_MULTI_INSTRUMENT_STRATEGY.md Section 3 (15 min) — chart design
4. Build LJ chart (4-5 hours coding)

**Total: 1 hour prep + 4 hours coding**

### For QA / Test Engineers

1. IMPLEMENTATION_GUIDE.md Section 6 (20 min) — testing checklist
2. PHASE_10_MULTI_INSTRUMENT_STRATEGY.md Section 7 (15 min) — audit trail
3. DELIVERABLES_SUMMARY.txt validation section (10 min)
4. Write E2E test suite (3-4 hours)

**Total: 45 min prep + 3 hours coding**

### For Compliance Officers / QI Directors

1. DELIVERABLES_SUMMARY.txt (10 min) — RDC/DICQ mapping
2. README.md compliance section (10 min)
3. PHASE_10_MULTI_INSTRUMENT_STRATEGY.md Sections 5, 7 (30 min) — audit trail, compliance
4. PHASE_10_ANALYTE_REGISTRY.json (5 min) — data review

**Total: 55 min** — ready for sign-off

---

## Key Artifacts by Type

### Data Structures

- **ControlMaterial** (multi-equipment, equipmentIds array)
- **Run** (immutable post-signature, server-side Westgard)
- **TraceabilityEvent** (append-only audit log)
- **Equipamento** (lifecycle: ativo → manutencao → aposentado, 5-year retention)
- **LeveyJenningsData** (per-equipment aggregates)

### Algorithms

- **evaluateWestgardRules()** — 1-2s, 1-3s, 2-2s, R-4s evaluation
- **computeLogicalSignature()** — SHA-256 signature generation
- **computeChainHash()** — encadeamento criptográfico (ADR-0001)

### Firestore Collections

```
/labs/{labId}/bioquimica/
├── root/analitos/
├── root/lotes/
├── root/runs/
├── root/traceability-events/
├── root/audit/
├── root/config/
├── stats/           (future: Phase 11)
└── reports/         (future: Phase 11)
```

### Cloud Functions

- **recordRunBioquimica** (callable) — validate, compute Westgard, commit run
- **applyBulaToLot** (callable) — parse Gemini Vision OCR, update manufacturerStats
- **generateMonthlyReportBioquimica** (scheduled) — aggregate, export FR-001 PDF

### UI Components

- **ControlMaterialSelector** — filter lots by equipment
- **LeveyJenningsChart** — timeseries + ±2σ/±3σ bands + method comparison
- **EquipamentoMetadataForm** — lifecycle management
- **RunRecordModal** — capture results, review violations

---

## Compliance & Regulatory References

All requirements mapped in README.md and DELIVERABLES_SUMMARY.txt:

| Standard           | Coverage                                  | Where                          |
| ------------------ | ----------------------------------------- | ------------------------------ |
| **RDC 978/2025**   | 6 articles (179, 180, 181, 128, 167, 183) | DELIVERABLES_SUMMARY.txt table |
| **DICQ 4.3**       | 5 requirements (Bloco F 5.5–5.6)          | README.md compliance section   |
| **CLSI EP15-A3**   | Westgard rules + method comparison        | Sections 2, 6 of Strategy MD   |
| **ISO 15189:2022** | Equipment validation, QC procedures       | Strategy MD Section 4, 10      |
| **RDC 786/2023**   | Equipment retention (5 years)             | Strategy MD Section 4, 10      |

---

## Implementation Checklist (Phase 10)

### Week 1: Data + Schema

- [ ] Load PHASE_10_ANALYTE_REGISTRY.json into seed function
- [ ] Create Firestore indexes (6 complex indexes, ~30 min)
- [ ] Update Firestore Rules (equipment validation, ~1 hour)
- [ ] Design westgardEngine.ts structure (~30 min)

### Week 2: Core Logic

- [ ] Implement westgardEngine.ts (1-3s, 2-2s, R-4s rules, ~400 LOC)
- [ ] Write 50+ unit tests for westgardEngine (~800 LOC)
- [ ] Create recordRunBioquimica Cloud Function (~500 LOC)
- [ ] Test via emulator (~2 hours)

### Week 3: UI + Integration

- [ ] Build ControlMaterialSelector (~300 LOC)
- [ ] Build LeveyJenningsChart (~600 LOC)
- [ ] Write E2E tests (multi-equipment scenarios, ~400 LOC)
- [ ] Performance testing (chart render < 1s)

### Week 4: Deployment

- [ ] TypeScript: npx tsc --noEmit (0 new errors)
- [ ] Lint: npm run lint (baseline 88 warnings)
- [ ] Bundle: westgardEngine < 20 KB gzip
- [ ] Deploy gates + smoke test
- [ ] Production deploy (Rules → Functions → Hosting)

---

## Questions to Discuss

**For CTO (Architecture):**

1. Bula parsing library: Gemini Vision vs. local ML?
2. Method comparison bias threshold: fixed 10% or dynamic per-analyte?
3. Extended Westgard rules: disabled-by-default (v1.4) or opt-out?

**For Lab Manager (Operations):**

1. Are 30 analytes complete for your panel?
2. Can supervisors easily see equipment authorizations?
3. Should lot-equipment lists be mutable post-use (with audit)?

**For Compliance (Audit):**

1. Is 5-year equipment retention sufficient?
2. Are compliance override audit trails defensible?
3. Method comparison: enforce or advisory?

---

## Version & Updates

- **Version**: 1.0
- **Generated**: 2026-05-07
- **Status**: Phase 10 Specification Complete
- **Next Review**: Phase 10 Implementation Kickoff (2026-05-10)
- **Final Approval**: Phase 10 Deployment Gate (2026-05-31)

---

**Total Deliverable Package**: 95 KB (6 documents)  
**Estimated Implementation**: 3,000 LOC, 3-4 week sprint  
**Regulatory Coverage**: RDC 978, DICQ 4.3, CLSI EP15, ISO 15189 ✓
