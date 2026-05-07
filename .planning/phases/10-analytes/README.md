# Phase 10: Analyte Registry & Multi-Instrument Strategy

**Status**: Specification phase  
**Date**: 2026-05-07  
**Audience**: Engineering team, CIQ supervisors, compliance officers

---

## Overview

Phase 10 extends Phase 9 (bioquímica foundation) with:

1. **30+ analyte registry** — complete biochemistry panel with LOINC codes, Westgard CLSI thresholds, critical values, and integration phases
2. **Multi-instrument strategy** — how control materials are shared across N instruments, method comparison, lot traceability, and cross-equipment QC assessment
3. **Equipment metadata framework** — calibration verification, equipment snapshots, and lifecycle management per RDC 978/2025 + RDC 786/2023

This addresses Phase 9 gaps (single equipment only) and prepares the system for Phase 11 (immunoassay, automated calibration, IoT monitoring).

---

## Deliverables

### 1. PHASE_10_ANALYTE_REGISTRY.json

**30 analytes with full metadata:**

```json
{
  "version": "1.0.0",
  "analytes": [
    {
      "id": "glic-001",
      "analyteName": "Glicose",
      "analyteCode": "2345-9",                    // LOINC
      "sigla": "GLI",
      "unidade": "mg/dL",
      "normalRange": { "min": 70, "max": 99 },
      "criticalThresholds": {
        "hiperglicemiaEmergencia": 400,
        "hipoglicemiaEmergencia": 40
      },
      "cvAlvo": 2.5,
      "westgardRules": {
        "active": ["1-2s", "1-3s", "2-2s", "R-4s"],
        "thresholds": { "1-2s": { "limit": 2.0, "severity": "warn" }, ... }
      },
      "seedDefault": true,
      "integrationPhase": "Phase 9"
    },
    // ... 29 more analytes
  ]
}
```

**Coverage:**
- **Phase 9 base**: 17 seed analytes (glucose, urea, liver panel, lipids, electrolytes)
- **Phase 10 expansion**: 9 new analytes (albumin, total protein, magnesium, phosphorus, uric acid, CK, LDH, amylase, lipase)
- **Phase 11 immunoassay**: 4 analytes (HbA1c, iron, ferritin, PSA, TSH)

**Westgard implementation:**
- **Active rules** (MVP, Phase 9): `1-2s` (warn), `1-3s` (reject), `2-2s` (reject), `R-4s` (reject)
- **Extended rules** (defined, disabled by default): `4-1s`, `10x`, `6T`, `6X` (enabled in v1.4 per analyte)
- **Each analyte** has explicit thresholds and severity mappings

---

### 2. PHASE_10_MULTI_INSTRUMENT_STRATEGY.md

**11-section strategy document covering:**

| Section | Topic | Key Points |
|---------|-------|-----------|
| 1 | Multi-Equipment Design | One control lot → N instruments; runs are 1-to-1 equipment |
| 2 | Westgard Engine (Server-Side) | `recordRunBioquimica` Cloud Function; never client-side computation (Threat T5) |
| 3 | Levey-Jennings by Equipment | Per-equipment charts + method-comparison overlays for cross-instrument validation |
| 4 | Equipment Metadata | `Equipamento` schema with lifecycle (ativo → manutencao → aposentado), calibration tracking |
| 5 | Lot Traceability | Lot-to-equipment association, archival, 5-year retention per RDC 786/2023 |
| 6 | Cross-Equipment Quality | Bias metrics, precision comparison, acceptable tolerance thresholds |
| 7 | Compliance & Audit Trail | Immutable `TraceabilityEvent` append-only log; RDC 978 + DICQ 4.3 mapping |
| 8 | Phase 10 Checklist | Data structures, UI components, tests, deployment gates |
| 9 | Known Limitations | Extended Westgard disabled, no retroactive bula re-evaluation UI, no IoT yet |
| 10 | Deployment | Firestore indexes, Cloud Function configuration, rollback plan |
| 11 | References | RDC 978/2025, DICQ 4.3, CLSI EP15, ISO 15189, Westgard QC |

**Key design decisions:**

- **Multi-tenant**: Every document carries `labId` (defense-in-depth)
- **Soft-delete only**: RN-06 — never `deleteDoc`, always `softDeletedAt` with 5-year retention
- **Server-side Westgard**: Callable function computes violations; client receives immutable result
- **Immutable runs**: Post-signature, runs are read-only; overrides tracked in separate audit subcollection
- **Equipment snapshots**: Every run freezes equipment state (survives future retirement)

---

### 3. Firestore Schema (Multi-Tenant)

```
/labs/{labId}/bioquimica/
├── root/
│   ├── analitos/{analitoId}              ← CRUD (Phase 10: via callable)
│   ├── lotes/{lotId}                     ← Control materials (multi-equipment)
│   ├── runs/{runId}                      ← CIQ results (server-side Westgard)
│   ├── traceability-events/{eventId}     ← Append-only audit log
│   ├── audit/{logId}                     ← Additional audit trail (chainHash)
│   └── config/{singleton}                ← Westgard thresholds, lab preferences
├── stats/                                ← (Phase 11: pre-aggregated LJ data)
└── reports/                              ← (Phase 11: monthly FR-001 PDFs)

/labs/{labId}/equipamentos/{equipamentoId}
├── id, module, name, modelo, fabricante
├── status: 'ativo' | 'manutencao' | 'aposentado'
├── observacoes (calibration notes, service log)
└── lifecycle fields (aposentadoEm, retencaoAte for 5-year retention)
```

---

## Integration Points

### Firestore Rules Updates Needed

```firestore
// Allow creation of ControlMaterial only with valid equipmentIds
match /labs/{labId}/bioquimica/root/lotes/{lotId} {
  allow create, update: if 
    isActiveMember(request.auth.uid, labId) &&
    validateEquipmentArray(resource.data.equipmentIds, labId) &&
    resource.data.labId == labId;
  allow delete: if false;  // soft-delete only
}

// Runs are callable-only post-signature; immutable
match /labs/{labId}/bioquimica/root/runs/{runId} {
  allow create: if false;  // only via recordRunBioquimica callable
  allow read: if isMemberOfLab(request.auth.uid, labId);
  allow update, delete: if false;
}

// TraceabilityEvents are append-only
match /labs/{labId}/bioquimica/root/traceability-events/{eventId} {
  allow create: if isValidTraceabilityEvent(request.resource.data);
  allow read: if isMemberOfLab(request.auth.uid, labId);
  allow update, delete: if false;
}
```

### Cloud Functions (Phase 10 Implementations)

1. **`recordRunBioquimica`** (callable, ~300 LOC)
   - Validates multi-tenant + auth
   - Loads ControlMaterial + Analytes
   - Evaluates Westgard rules (westgardEngine.ts)
   - Commits Run + TraceabilityEvent atomically
   - Returns: `{ runId, status, violations }`

2. **`applyBulaToLot`** (callable, Gemini Vision, ~200 LOC)
   - Parses PDF bula via Gemini Vision
   - Extracts manufacturer stats per analyte × level
   - Updates ControlMaterial.manufacturerStats
   - Triggers re-evaluation of pending runs

3. **`generateMonthlyReportBioquimica`** (scheduled, ~400 LOC)
   - Aggregates runs per (analitoId, equipmentId, nivelId)
   - Computes mean, SD, CV%, trend analysis
   - Generates FR-001 PDF (regulatory requirement)
   - Stores in `/reports/{monthYear}`

### UI Components (Phase 10 New)

- **ControlMaterialSelector**: Filter lots by equipment + validade
- **LeveyJenningsChart**: Display per-equipment timeseries + ±2σ/±3σ bands
- **MethodComparisonPanel**: Cross-equipment bias/precision visualization
- **EquipmentMetadataForm**: Create/edit equipment with observacoes
- **RunRecordModal**: Capture N analytes for 1 level on 1 equipment, review violations

---

## Regulatory Compliance Mapping

| RDC 978/2025 | DICQ 4.3 | Implemented | Where |
|---|---|---|---|
| Art. 179 — CIQ obrigatório | 5.5.1.1 — Método | Analito.metodo + westgardRules | Analyte Registry + Run.violations |
| Art. 180 — Rastreabilidade material | 5.5.2 — Origem controle | ControlMaterial.origem + equipmentIds | Multi-instrument schema |
| Art. 181 — Amostra controle auditada | 5.6.3.1 — Registro corrida | Run doc + signature | Immutable runs + TraceabilityEvent |
| Art. 128 — Reagente rastreado | — | ReagenteSnapshot frozen | In Run doc |
| Art. 167 — Laudo gerado | — | FR-001 monthly report | Cloud Function + PDF export |
| Art. 183 — CIQ por lote novo | — | Separate ControlMaterial per lot | Lot ID in Run payload |
| RDC 786/2023 Art. 42 — Equipamento retenção 5a | — | aposentadoEm + retencaoAte | Equipment lifecycle |

---

## Phase 10 Timeline & Milestones

| Milestone | Date | Deliverable |
|-----------|------|-------------|
| Specification (this phase) | 2026-05-07 | Registry JSON + Strategy MD |
| Schema migration | 2026-05-10 | Firestore indexes + Rules updates |
| Westgard engine | 2026-05-14 | westgardEngine.ts + unit tests (50+) |
| Cloud Functions | 2026-05-18 | recordRunBioquimica + applyBulaToLot |
| UI components | 2026-05-24 | ControlMaterialSelector + LJ Chart |
| E2E testing | 2026-05-28 | Multi-instrument scenarios + compliance |
| Deployment | 2026-05-31 | Hosting + Functions + Rules deploy |

---

## Success Criteria

- [x] 30+ analytes with LOINC codes, Westgard thresholds, critical values
- [ ] Server-side Westgard engine evaluates rules before committing runs
- [ ] Multi-equipment control materials work without operator friction
- [ ] Levey-Jennings chart shows per-equipment data + method comparison overlay
- [ ] Equipment metadata captures lifecycle (ativo → aposentado + 5-year retention)
- [ ] All Phase 10 runs appear in immutable audit trail
- [ ] Firestore Rules prevent concurrent equipment deletions + run mutations
- [ ] 50+ new unit tests pass; bundle size < 100 KB
- [ ] Regulatory mappings (RDC 978 + DICQ 4.3) documented in code

---

## Known Issues & Deferral

### Not in Phase 10

- **Extended Westgard rules** — remain disabled; v1.4 feature
- **Lot-equipment re-assignment** — once a lot is used, equipment list is frozen (manual override available)
- **Retroactive re-evaluation** — runs recorded before bula arrives stay "Pendente"; no automatic "catch-up"
- **Real-time IoT** — manual observacoes only; IoT integration Phase 11+
- **LIS integration** — CSV import deferred to Phase 11

### Dependencies on Other Modules

- **equipamentos** module: Equipment CRUD already complete; Phase 10 just adds bioquimica-specific lifecycle flags
- **insumos** module: ReagenteSnapshot schema already exists; Phase 10 reuses in runs
- **audit** module: TraceabilityEvent schema aligns with existing audit trail pattern

---

## Getting Started for Engineers

1. **Review this README** — 5 min overview
2. **Read PHASE_10_MULTI_INSTRUMENT_STRATEGY.md** (Sections 1–4) — understand data flow
3. **Import PHASE_10_ANALYTE_REGISTRY.json** into seed test data
4. **Implement westgardEngine.ts** — start with 1-3s rule, add 2-2s, R-4s
5. **Write unit tests** — mock ControlMaterial + previous runs, verify violations
6. **Deploy as callable** — `recordRunBioquimica`; test with emulator
7. **Build UI** — ControlMaterialSelector + Run modal
8. **End-to-end test** — Create lot, run on 2 equipment, compare Levey-Jennings

---

## References

- **Westgard QC**: https://www.westgard.com/multirule.htm (multi-rule decision tree)
- **CLSI EP15-A3**: "User Verification of Performance for Clinical Laboratory Measurement Devices" (2014)
- **RDC 978/2025**: ANVISA norma para laboratórios clínicos (operacional)
- **DICQ 4.3**: Documento de Informação sobre Controle de Qualidade (compliance mapping)
- **ISO 15189:2022**: Medical laboratories — requirements for quality and competence

---

**Version**: 1.0  
**Last Updated**: 2026-05-07  
**Next Review**: Phase 10 final acceptance (2026-05-31)
