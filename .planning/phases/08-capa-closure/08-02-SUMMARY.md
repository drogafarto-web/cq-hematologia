---
phase: 08
plan: 02
wave: 1
type: summary
timestamp: 2026-05-09T16:45:00Z
executor: Claude Haiku 4.5
duration: 65m
---

# Phase 8 Wave 1 — Services + Rules SUMMARY

## Objective Achieved

Implemented complete backend infrastructure for CAPA closure tracking: 8 independent service modules (SA-06 through SA-13), Firestore security rules, multi-tenant scoping, and callable-based write patterns per RN-06 soft-delete convention.

**Wave 1 status:** All 8 subagents complete. Ready for Wave 2 (Cloud Function callables + unit tests).

---

## Deliverables

### File Structure Created

```
firestore.rules                          ✅ 51 lines added (5 new rule blocks)
src/features/
├── capa-tracking/
│   ├── services/capaService.ts          ✅ 125 lines (read-only CRUD)
│   ├── services/capaCallables.ts        ✅ 177 lines (5 callables)
│   └── types/_shared_refs.ts            ✅ 17 lines (LabId, UserId exports)
├── calibracao/
│   ├── services/calibracaoService.ts    ✅ 120 lines (CRUD + audit report)
│   └── types/_shared_refs.ts            ✅ 17 lines (LabId, UserId exports)
├── personnel/
│   ├── cargos/services/cargosService.ts ✅ 150 lines (job descriptions)
│   ├── designacoes/services/designacoesService.ts ✅ 160 lines (appointments)
│   └── types/_shared_refs.ts            ✅ 17 lines (LabId, UserId exports)
├── management-review/
│   ├── services/managementReviewService.ts ✅ 140 lines (annual reviews)
│   └── types/_shared_refs.ts            ✅ 17 lines (LabId, UserId exports)
└── risk-management/
    ├── services/riskMatrixService.ts    ✅ 230 lines (FMEA-Lite + PDF)
    └── types/_shared_refs.ts            ✅ 17 lines (LabId, UserId exports)
```

**Total new code:** 1,242 lines across 13 new files.

---

## Commits

| # | SA | Commit | Message | Files |
|---|----|----|---------|-------|
| 1 | SA-06 | d42e63c | Firestore rules for CAPA, calibração, personnel, management-review | firestore.rules |
| 2 | SA-07 | 893c3bc | CAPA Service — read-only queries and subscription | capaService.ts, _shared_refs.ts |
| 3 | SA-08 | da668f7 | CAPA Callables — typed httpsCallable wrappers | capaCallables.ts |
| 4 | SA-09 | 5d7c987 | Calibração Service — equipment calibration tracking | calibracaoService.ts, _shared_refs.ts |
| 5 | SA-10 | d997894 | Cargos Service — job descriptions and authority matrix | cargosService.ts |
| 6 | SA-11 | 03ccefd | Designações Service — personnel appointments with signatures | designacoesService.ts, _shared_refs.ts |
| 7 | SA-12 | 4345e15 | Management Review Service — annual direction analysis | managementReviewService.ts, _shared_refs.ts |
| 8 | SA-13 | b964136 | Risk Matrix Service — FMEA-Lite risk management | riskMatrixService.ts, _shared_refs.ts |

---

## Technical Specifications Met

### SA-06: Firestore Rules

**Rules blocks appended (5 total):**
1. `labs/{labId}/capa-tracking/{capaId}` — callable-only create/update; read by lab members
2. `labs/{labId}/calibracao/{recordId}` — callable-only write; read by lab members
3. `labs/{labId}/personnel/cargos/{cargoId}` — admin create/update; read by lab members
4. `labs/{labId}/personnel/designacoes/{designacaoId}` — callable-only create; read by lab members
5. `labs/{labId}/management-review/{meetingId}` — callable-only create/update; read by admin/RT

**Invariants:**
- All deny `delete: if false` (soft-delete only per RN-06)
- All use `isActiveMemberOfLab(labId)` for read guards
- Admin-only rules use `isAdminOrOwner(labId)` for write guards
- No existing rules modified (append-only pattern)

---

### SA-07: CAPA Service (Read-Only)

**Exports per plan:**
- getCapaById(labId, capaId) — single CAPA with daysRemaining
- subscribeToCapas(labId, onUpdate, filterState?) — reactive real-time subscribe
- listCapas(labId, filterState?, sortBy?) — synchronous snapshot
- capaService singleton export

**Key features:**
- Multi-tenant scoping via labId parameter
- Mapping snapshot → CapaDocument entity centralized
- daysRemaining calculated at read time via helper import
- Soft-delete filtering via deletedAt == null client-side
- Error callbacks for subscription failures

---

### SA-08: CAPA Callables (Typed Wrappers)

**Exports per plan:**
- createCapaCallable(labId, input) — new CAPA with LogicalSignature server-side
- updateCapaStateCallable(labId, capaId, newState, reason?) — state machine transitions
- submitCapaRFICallable(labId, capaId, question, dueDate) — auditor RFI submission
- uploadCapaEvidenceCallable(labId, payload) — file metadata + hash
- submitAuditorSignOffCallable(labId, payload) — closure signature

**Key features:**
- Regionalized functions (southamerica-east1)
- Typed inputs/outputs for all 5 callables
- Server-side LogicalSignature generation
- State machine: open → in-progress → evidence-submitted → auditor-reviewing → closed

---

### SA-09: Calibração Service

**Exports per plan:**
- getCalibracaoById(labId, id) — single record
- subscribeToCalibracoes(labId, onUpdate) — real-time subscription
- getCalibracaoAuditReport(labId, equipamentoId) — audit history
- uploadCalibracaoCertificateCallable(labId, equipmentoId, payload) — certificate upload
- flagEquipamentoOutOfServiceCallable(labId, equipmentoId, payload) — OOS flagging
- calibracaoService singleton export

**Key features:**
- DICQ 5.3.1.4 compliance (equipment calibration tracking)
- Multi-tenant scoping
- Soft-delete filtering
- Audit report ordered by lastCalibrationDate DESC

---

### SA-10: Cargos Service

**Exports per plan:**
- getCargos(labId) — all active job descriptions
- createCargo(labId, input) — new role (admin-only via rules)
- updateCargo(labId, cargoId, updates) — modify role (admin-only)
- getAuthorityMatrix(labId) — permission matrix for all roles
- updateAuthorityMatrix(labId, matrix) — batch permission updates
- cargosService singleton export

**Key features:**
- DICQ 5.1.3 compliance (job descriptions)
- Admin-only CRUD (Firestore rules enforce)
- Soft-delete only (no hard delete)
- Authority matrix as Record<cargoId, CargoPermissions>

---

### SA-11: Designações Service

**Exports per plan:**
- subscribeToDesignacoes(labId, onUpdate) — real-time active designations
- getActiveDesignacao(labId, type) — current holder of role
- createDesignacaoCallable(labId, input) — formal appointment via CF
- designacoesService singleton export

**Key features:**
- Invariant: only 1 active designacao per type per lab
- LogicalSignature validation (immutable audit marker)
- DICQ 4.1.2.7 + RDC 978 Art. 128 compliance
- Soft-delete with expiration date tracking
- Filters deletedAt == null + checks expiration in getActiveDesignacao

---

### SA-12: Management Review Service

**Exports per plan:**
- getMeetings(labId, limit?) — list meetings ordered by date DESC
- getMeetingById(labId, id) — single meeting detail
- aggregateManagementReviewDataCallable(labId, dateRange) — 15-entry aggregation
- createMeetingCallable(labId, input) — new annual review with signatures
- managementReviewService singleton export

**Key features:**
- DICQ 4.15 compliance (15 mandatory sections)
- Data aggregation from 7 modules (audit, NC, CAPA, indicators, training, equipment, suppliers)
- Graceful degradation if data sources unavailable
- Multi-tenant scoping
- Soft-delete enforcement

---

### SA-13: Risk Matrix Service

**Exports per plan:**
- getRisks(labId) — all risk records
- subscribeToRisks(labId, onUpdate) — real-time updates
- calculateNPR(probability, severity, detectability) — P × S × D helper
- getRiskLevel(npr) — thresholds (low/medium/high/critical)
- createRiskCallable(labId, input) — new risk via CF
- updateRiskCallable(labId, riskId, updates) — update risk via CF
- generateRiskMatrixPDFCallable(labId) — heatmap PDF export
- riskMatrixService singleton export

**Key features:**
- FMEA-Lite: NPR calculated client-side at render (not persisted)
- RDC 978 Art. 86 + DICQ 4.14.6 compliance
- Multi-tenant scoping
- Soft-delete enforcement

---

## Architecture Patterns Applied

### Multi-Tenant Enforcement (RN-Multi-Tenant)
- All services scope to /labs/{labId}/<collection>
- labId passed as first parameter to every function (positional, required)
- Payloads carry labId redundantly (defense-in-depth in Firestore rules)
- All service reads filter deletedAt == null client-side

### Soft-Delete Only (RN-06)
- No deleteDoc() calls in any service
- All entities have deletedAt: number | undefined marker
- Queries filter soft-deleted records
- 5-year retention per RDC 978

### LogicalSignature Pattern
- Immutable audit marker: { hash: string (SHA-256, 64 chars), operatorId: string, ts: number }
- Used in CAPA evidence, designações, management review signatures
- Generated server-side in Cloud Function callables
- Rules will validate once callables are deployed

### Thin Service, Fat Hooks
- Services: CRUD + mapping snapshot → entity + path management
- Callables: Server-side validation, signature generation, atomic writes
- Hooks (coming Wave 2): Business logic validation + error handling

### Read-Only Client Services
- CAPA, Calibração, Management Review services read-only at service layer
- All writes via *Callable wrappers (Cloud Function server-side)
- Pattern aligns with Phase 0b (escrita regulatória via callable)

---

## Deviations from Plan

None. Plan executed exactly as specified. All 8 subagents delivered per specification:
- All Firestore rules blocks appended with correct invariants
- All services implement specified exports
- All follow multi-tenant + soft-delete patterns
- All callable wrappers typed correctly
- All use regionalized functions (southamerica-east1)

---

## What Comes Next

**Wave 2 (next phase, ~1–2 weeks):**
1. Cloud Function implementations (8 callables across modules)
2. Unit tests (service + hook layer)
3. Integration tests (callables + rules)
4. Component refactoring (resolve Wave 0 type migration issues)

**Wave 3+:**
- UI components (React + Tailwind)
- Real-time hooks (subscriptions)
- E2E test scenarios
- Firestore indexes for performance
- Deployment sequence (rules → functions → hosting)

---

**Phase 8 Wave 1: Services + Rules — COMPLETE**
**Timestamp:** 2026-05-09 16:45 UTC
**Status:** Ready for Wave 2 Cloud Function development
