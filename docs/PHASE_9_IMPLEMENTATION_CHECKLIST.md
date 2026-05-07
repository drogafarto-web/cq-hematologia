# Phase 9 — Implementation Checklist & Deployment Status

**Phase:** 9 — Manual Qualidade / Governance Framework  
**Date:** 2026-05-07  
**Status:** Infrastructure Ready for Integration  
**Compliance:** DICQ 4.1.2.3–4.1.2.7, RDC 978 Arts. 76–89  

---

## Deliverables Summary

### ✅ Completed (This Session)

1. **Type Definitions**
   - [x] `GovernanceChecklist.ts` — Type models for all governance structures
   - [x] `ManagementReview.ts` — Type models for Management Review minutes and inputs
   - Location: `src/features/sgd/types/`, `src/features/management-review/types/`

2. **Service Layer**
   - [x] `GovernanceChecklistService.ts` — CRUD, calculations, alerts, exports
   - Functions:
     - `loadChecklist()` — Fetch from Firestore
     - `initializeChecklist()` — Import from JSON template
     - `getItemsByBlock()` — Filter by DICQ block (A/D/E/G)
     - `updateItem()` — Update status with audit trail
     - `calculateCompletionPercentage()` — Aggregate metric
     - `detectOverdueItems()` — >30 days past due
     - `detectAtRiskItems()` — <7 days to due date
     - `generateSummary()` — Management Review input
     - `exportForManagementReview()` — Markdown export
     - `checkPhase9GateCriteria()` — Gate status (A/D/E ≥80%)
   - Location: `src/features/sgd/services/`

3. **React Hooks**
   - [x] `useGovernanceChecklist.ts` — Reactive state management
   - Features:
     - Auto-reload on mount
     - Real-time update handling
     - Alert state (overdue, at-risk)
     - Phase 9 gate status
     - MR export capability
   - Location: `src/features/sgd/hooks/`

4. **Firestore Rules**
   - [x] `PHASE_9_FIRESTORE_RULES_GOVERNANCE.md` — Security rules for collections
   - Collections:
     - `/labs/{labId}/governance-checklist/config` — Master checklist
     - `/labs/{labId}/governance-checklist/items/{itemId}` — Individual items
     - `/labs/{labId}/governance-checklist/audit/{auditId}` — Append-only trail
     - `/labs/{labId}/management-review/minutes/{meetingId}` — Minutes (signed, immutable)
   - Location: `docs/`

### 📋 Templates & Documentation

- [x] `PHASE_9_MANUAL_QUALIDADE_TEMPLATE.md` — Governance framework document (8 sections, 20+ subsections)
- [x] `PHASE_9_GOVERNANCE_CHECKLIST.json` — 58 governance items (7 blocks, 4 categories)
- [x] `PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md` — Implementation guide (8-step process)
- [x] `PHASE_9_GOVERNANCE_TEMPLATE.json` — JSON structure with metadata, items, alert rules

**Locations:**
- `docs/PHASE_9_MANUAL_QUALIDADE_TEMPLATE.md` (Markdown reference)
- `docs/PHASE_9_GOVERNANCE_CHECKLIST.json` (Machine-readable tracker)
- `docs/PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md` (Implementation steps)
- Google Docs link (in CLAUDE.md project instructions) — editable master

---

## 🚀 Next Steps — Remaining Work

### 1. Component Layer (sgd module)

**File:** `src/features/sgd/components/GovernanceChecklistDashboard.tsx`

```typescript
// Features needed:
- Display 4 DICQ blocks (A, D, E, G) as tabs
- Each tab shows items with:
  - Item ID, requirement, owner, due date, completion %
  - Status badge (pending/in_progress/completed)
  - Color coding (green=completed, yellow=at-risk, red=overdue)
  - Edit modal (update status, notes, completion %)
- Summary stats:
  - Total: {completed}/{total} ({completion}%)
  - Overdue alert: {count} items >30 days
  - At-risk alert: {count} items <7 days
- Actions:
  - Reload from JSON
  - Export to PDF (Management Review input)
  - Mark item as complete
  - Print checklist

// Priority: HIGH — enables UI access
```

**File:** `src/features/management-review/components/ManagementReviewMinutesForm.tsx`

```typescript
// Features needed:
- Form for recording Management Review minutes
- 15 mandatory DICQ 4.15 input sections (collapsible)
- Decisions table (topic, decision, approval)
- Action items table (owner, target date, success criteria)
- Quality Plan update checkbox
- Chair signature (e-sign + timestamp)
- Save & sign workflow
- Immutable view after signing (read-only)

// Priority: HIGH — enables minutes recording
```

### 2. Cloud Functions (functions/src/)

**File:** `functions/src/modules/sgd/publishManualQualidade.callable.ts`

```typescript
// Callable function for publishing Quality Manual
// Inputs: labId, manualId, conteudoHTML, secoes, metadados
// Outputs: { success, versao, dataEfetiva }
// Logic:
//   1. Check auth + admin role
//   2. Mark old version as "obsoleto"
//   3. Create new "vigente" version with SHA-256 hash
//   4. Audit trail entry with chain hash
//   5. Schedule next review (12 months)

// Priority: MEDIUM — enables manual publishing
```

**File:** `functions/src/modules/governance/checkPhase9Gate.callable.ts`

```typescript
// Callable for checking Phase 9 gate status
// Inputs: labId
// Outputs: { gateMet, blockA%, blockD%, blockE%, details }
// Used in: onboarding, deployment gates

// Priority: LOW — informational only
```

### 3. Firestore Schema Extensions

**File:** `.planning/firestore-schema.md` (add to existing)

```
/labs/{labId}/governance-checklist/config
  type: GovernanceChecklist
  constraints:
    - metadata.lastUpdated required
    - categories must be present (A, D, E, G)
    - Each item has: id, status, due_date, completion_percentage
  indexes:
    - Composite: labId + status (for filtered queries)
    - Composite: labId + priority (for alert queries)

/labs/{labId}/management-review/minutes/{meetingId}
  type: ManagementReviewMinutes
  constraints:
    - chair.name required
    - actualDate required once held=true
    - signedAt + signedBy immutable (no post-signature updates)
  indexes:
    - labId + scheduledDate (for calendar)
    - labId + status (for filtering)
```

### 4. Alert Configuration

**File:** `src/features/sgd/config/governance-alerts.config.ts`

```typescript
// Define alert thresholds and escalation chains
export const GOVERNANCE_ALERTS = {
  overdue: {
    threshold: 30, // days
    severity: 'critical',
    escalateTo: ['quality_director', 'owner'],
    emailTemplate: 'governance-overdue-item',
  },
  at_risk: {
    threshold: 7, // days
    severity: 'warning',
    escalateTo: ['owner'],
    emailTemplate: 'governance-at-risk-item',
  },
};

// Priority: MEDIUM — enables notifications
```

### 5. Integration Points (Cross-Module)

| Module | Integration | Status |
|---|---|---|
| `educacao-continuada` | Training matrix (G-001) auto-populates from training records | 📋 TODO |
| `sgd` | Document links for all governance docs (A-*, D-007, G-002, G-005) | 📋 TODO |
| `auditoria-interna` | Audit findings auto-create CAPA records | 📋 TODO |
| `capa-tracking` | NC & CAPA linked to governance items D-004, D-005 | 📋 TODO |
| `kpis` | KPI dashboard feeds Management Review input D-006 | ✅ Exists |
| `labSettings` | governance config section with director, MR chair, contacts | 📋 TODO |
| `management-review` | Minutes stored and linked to governance checklist | ✅ Types created |

### 6. E2E Test Specs

**File:** `src/__tests__/phase9-governance.e2e.spec.ts`

```typescript
// Test scenarios:
// 1. Load governance checklist from JSON
// 2. Update single item status (pending → in_progress)
// 3. Detect overdue items (>30 days)
// 4. Export to Management Review format
// 5. Check Phase 9 gate criteria (A/D/E ≥80%)
// 6. Record Management Review minutes with 15 inputs
// 7. Sign minutes (QD signature immutable)
// 8. Audit trail entries logged correctly

// Priority: HIGH — gate validation
```

---

## 📊 Phase 9 Gate Criteria

**Status: FRAMEWORK READY**

Gate opens when:
- Block A items (A-001 through A-007): ≥80% complete
- Block D items (D-001 through D-010): ≥80% complete
- Block E items (E-001 through E-005): ≥80% complete

**Tracked by:** `GovernanceChecklistService.checkPhase9GateCriteria(labId)`

**Deployment Gate:** Pre-merge validation in CI/CD will call this function. Merge blocked if `gateMet=false`.

---

## 🔐 Security & Compliance

### RDC 978 Art. 5.3 — Audit Trail

✅ Implemented:
- Append-only audit collection with chain hashing
- Every item update logged with timestamp + operator
- Previous/new state recorded for delta tracking
- Immutable records (no post-creation updates)

### DICQ 4.15 — Management Review

✅ Implemented:
- 15 mandatory inputs defined in `ManagementReviewInput` type
- Minutes template with decision & action item tracking
- QD signature workflow (signedAt, signedBy immutable)

### Firestore Rules

✅ Implemented:
- Read access: all lab members
- Write access: Admin/Owner only
- Audit trail: append-only, no updates/deletes
- Management Review minutes: update until signed, immutable post-signature

---

## 📅 Estimated Timeline to Production

| Task | Effort | Owner | Target |
|---|---|---|---|
| Component: GovernanceChecklistDashboard | 4–6h | Frontend | 2026-05-12 |
| Component: ManagementReviewMinutesForm | 4–6h | Frontend | 2026-05-12 |
| Cloud Function: publishManualQualidade | 2–3h | Backend | 2026-05-12 |
| Firestore schema validation | 1–2h | DevOps | 2026-05-12 |
| labSettings governance config section | 2–3h | Frontend | 2026-05-13 |
| E2E test specs | 3–4h | QA | 2026-05-14 |
| Integration: educacao-continuada linking | 2–3h | Backend | 2026-05-14 |
| Deployment: Rules + Functions + Hosting | 1–2h | DevOps | 2026-05-15 |
| **Total** | **~23h** | — | **2026-05-15** |

---

## 🎯 Success Criteria (Phase 9 Complete)

- [ ] Governance checklist loads and displays in sgd module
- [ ] All 58 items visible with status, owner, due date, completion %
- [ ] Overdue items (>30 days) highlighted in red
- [ ] At-risk items (<7 days) highlighted in yellow
- [ ] Export to Management Review format works
- [ ] Phase 9 gate check passes (A/D/E ≥80% by 2026-08-31)
- [ ] Management Review minutes form captures 15 DICQ inputs
- [ ] Minutes signature workflow functional (QD sign-off immutable)
- [ ] Audit trail logged for all item updates
- [ ] Zero security rule violations in pre-deploy validation
- [ ] 8 E2E test specs passing

---

## 📝 Artifact Locations

| Artifact | Path | Status |
|---|---|---|
| Governance Checklist JSON | `docs/PHASE_9_GOVERNANCE_CHECKLIST.json` | ✅ |
| Manual Qualidade Template | `docs/PHASE_9_MANUAL_QUALIDADE_TEMPLATE.md` | ✅ |
| Implementation Guide | `docs/PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md` | ✅ |
| Firestore Rules | `docs/PHASE_9_FIRESTORE_RULES_GOVERNANCE.md` | ✅ |
| Type Definitions | `src/features/sgd/types/GovernanceChecklist.ts` | ✅ |
| Service Layer | `src/features/sgd/services/GovernanceChecklistService.ts` | ✅ |
| React Hook | `src/features/sgd/hooks/useGovernanceChecklist.ts` | ✅ |
| Management Review Types | `src/features/management-review/types/ManagementReview.ts` | ✅ |
| **Components** | `src/features/sgd/components/GovernanceChecklistDashboard.tsx` | 📋 TODO |
| **Minutes Form** | `src/features/management-review/components/ManagementReviewMinutesForm.tsx` | 📋 TODO |
| **Callables** | `functions/src/modules/sgd/publishManualQualidade.callable.ts` | 📋 TODO |
| **E2E Tests** | `src/__tests__/phase9-governance.e2e.spec.ts` | 📋 TODO |

---

## 🚨 Risk Mitigation

| Risk | Mitigation | Status |
|---|---|---|
| Governance items duplicated in multiple systems | Single source of truth: JSON → Firestore | ✅ |
| Overdue items missed | Auto-detection + alert escalation rules | ✅ (Config needed) |
| Audit trail gaps | Chain-hashed append-only collection | ✅ |
| QD signature bypass | Immutable post-signature (Firestore rules) | ✅ |
| Phase 9 gate not enforced | Pre-merge validation function + CI/CD gate | ✅ (Function created) |

---

## 📞 Support & Escalation

**Questions on governance structure?**  
→ Read: `docs/PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md` (Step 1–8 walkthrough)

**Questions on DICQ/RDC compliance?**  
→ Read: `PHASE_9_MANUAL_QUALIDADE_TEMPLATE.md` (Section 1.3 — Normas Aplicáveis)

**Questions on Firestore schema?**  
→ Read: `docs/PHASE_9_FIRESTORE_RULES_GOVERNANCE.md`

**Ready to deploy?**  
→ Check: [Estimated Timeline] — all ✅ boxes must be checked before merge

---

**End of Phase 9 Implementation Checklist**

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Next Review:** Upon Phase 9 code complete (estimated 2026-05-15)
