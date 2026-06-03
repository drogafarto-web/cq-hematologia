# Management Review Module — DICQ 4.15

**Status:** 🟡 In development (Phase 8 v1.3, 2026-06-10 → 2026-06-24)

**Purpose:**
Implements DICQ 4.15 "Análise Crítica pela Direção" (Annual Direction Critical Analysis) — mandatory annual leadership review with 15 documented sections, data aggregation from operational systems, and cryptographic signature.

**Requirement Mapping:**

- `CAPA-01` — NC-001 closure (management review POP formalizes audit process)
- `DICQ 4.15` — all 15 sections present + signed
- `DICQ 4.14` — linkage to Internal Audit (auditoria-interna) module

---

## Module Structure

```
src/features/management-review/
  ├── types/index.ts                    # Domain: ManagementReview, Ata, ReviewTemplate, LogicalSignature
  ├── services/
  │   ├── managementReviewService.ts   # CRUD + real-time subscriptions
  │   ├── reviewTemplateService.ts     # Data aggregation from 7 collections
  │   └── ataService.ts                # Meeting minutes CRUD
  ├── hooks/
  │   ├── useManagementReview.ts       # Real-time reviews + latest
  │   ├── useReviewTemplate.ts         # Async template generation (cached)
  │   └── useAtas.ts                   # Real-time atas subscriptions
  ├── components/
  │   ├── ManagementReviewDashboard.tsx  # Main container (tabs: new/history/atas)
  │   ├── ReviewForm.tsx                 # 15-section form with auto-save
  │   ├── ReviewSection.tsx              # Reusable section display (edit + read-only)
  │   ├── ReviewHistory.tsx              # Past reviews by year
  │   ├── ReviewDetail.tsx               # Full read-only review view
  │   └── AminutesEditor.tsx             # Meeting minutes form
  └── CLAUDE.md                          # This file
```

---

## The 15 Mandatory Sections (DICQ 4.15)

```typescript
1.  Análise de Resultados de Auditorias
    (Review of Audit Results)

2.  Análise de Conformidades e CAPAs
    (Review of NC/CAPA Status)

3.  Tendências de Indicadores de Desempenho
    (KPI Trends)

4.  Análise de Feedback do Cliente
    (Customer Feedback)

5.  Análise de Competência do Pessoal
    (Personnel Competency)

6.  Análise de Infraestrutura e Calibração
    (Infrastructure + Calibration)

7.  Análise de Desempenho de Fornecedores
    (Supplier Performance)

8.  Análise de Mudanças Regulatórias
    (Regulatory Changes) — manual entry only

9.  Oportunidades para Melhoria
    (Improvement Opportunities) — manual entry only

10. Avaliação de Riscos e Mitigação
    (Risk Assessment) — manual entry only

11. Status de Objetivos de Qualidade
    (Quality Objectives Status) — manual entry only

12. Decisões sobre Alocação de Recursos
    (Resource Allocation Decisions) — manual entry only

13. Mudanças Procedimentais Aprovadas
    (Procedural Changes Approved) — manual entry only

14. Direcionamento sobre Iniciativas Estratégicas
    (Strategic Initiatives Direction) — manual entry only

15. Data, Participantes e Assinatura
    (Date, Attendees + Signature)
```

---

## Data Aggregation Flow

`ReviewForm` → `useReviewTemplate()` → `generateReviewTemplate()` (Cloud Function)
→ Parallel pulls from 7 collections → Pre-populate Sections 1-7 with `sourceData`

**Data Sources:**

1. `labs/{labId}/auditoria-interna` → Section 1 (audit count, findings, closure rate)
2. `labs/{labId}/naoConformidades` → Section 2 (NC status counts)
3. `labs/{labId}/capa` → Section 2 (CAPA status counts)
4. `labs/{labId}/indicators` → Section 3 (KPI values)
5. `labs/{labId}/reclamacoes` → Section 4 (complaint count, closure rate)
6. `labs/{labId}/treinamentos` → Section 5 (training completion %)
7. `labs/{labId}/equipamentos` + `calibracao` → Section 6 (equipment + calibration compliance)
8. `labs/{labId}/fornecedores` → Section 7 (supplier count, active %)

**Graceful Degradation:** If any collection is unavailable, template generation continues with warnings; sections show empty sourceData.

---

## Signature Pattern (LogicalSignature)

All reviews are signed with HMAC-SHA256 chain-hash:

```typescript
interface LogicalSignature {
  hash: string; // HMAC-SHA256 (exactly 64 chars)
  operatorId: string; // uid of director who submitted
  ts: Timestamp; // moment of submission
}
```

**Generation:** Server-side in `submitReview()` Cloud Function.

**Validation:** Client can display signature info; auditor verifies during external audit using hash chain.

---

## Multi-Tenant Scoping

All collections follow the pattern:

- Path: `labs/{labId}/management-reviews/{id}`
- Payload includes redundant `labId` field (ensures no cross-tenant leak)
- Service layer validates `labId` match on every read/write

---

## Soft-Delete (RN-06)

No `deleteDoc()` calls. Deletion marks `deletedAt = Timestamp.now()`.

All queries filter: `where('deletedAt', '==', null)`

**Retention:** 5 years (management reviews are regulatory evidence).

---

## Cloud Functions

### `generateReviewTemplate(labId, year)`

**Type:** Callable (HTTPS POST from React form)

**Auth:** User must be active lab member

**Input:**

```typescript
{
  labId: string;
  year: number;
}
```

**Output:**

```typescript
{
  success: boolean;
  template?: ReviewTemplate;
  error?: string;
}
```

**Side Effects:** None (read-only, no writes)

**Timeout:** 60s (parallel reads from 7 collections)

---

### `submitReview(labId, year, entries, participantes, diretor, gerenteQualidade, outrasCargos?)`

**Type:** Callable (HTTPS POST from ReviewForm submit)

**Auth:** User must be active lab member (director-level enforcement is client-side hint; server validates minimum attendees)

**Input:**

```typescript
{
  labId: string;
  year: number;
  entries: ReviewEntry[];  // All 15 sections with content
  participantes: string[];
  diretor: string;
  gerenteQualidade: string;
  outrasCargos?: string[];
  ataIds?: string[];  // Link existing atas
}
```

**Validation:**

1. All 15 sections must have non-empty content
2. Director + Quality Manager + at least 1 other participant (minimum 3 total)
3. No duplicate review for same year/lab in submitted/approved status

**Output:**

```typescript
{
  success: boolean;
  reviewId?: string;
  signature?: LogicalSignature;
  error?: string;
}
```

**Side Effects:**

- Creates ManagementReview document with `status='submitted'`
- Generates LogicalSignature (HMAC-SHA256)
- Updates linked Atas to set `managementReviewId`

**Timeout:** 60s

---

## Integration Points

### With auditoria-interna (Phase 5)

- Section 1 pulls audit findings from internal audit module
- Link: Review can trigger new audit cycle

### With naoConformidades + capa (Phase 5)

- Section 2 aggregates NC/CAPA counts
- Link: CAPA closure triggers by review date

### With indicators (Phase 3.1 KPIs)

- Section 3 pulls KPI trends
- Source: last 12 months of indicator readings

### With reclamacoes (Phase 12)

- Section 4 pulls complaint counts
- Source: customer feedback collection

### With treinamentos (Phase 3.3)

- Section 5 pulls training completion rates
- Source: personnel training records

### With equipamentos + calibracao (Phase 2)

- Section 6 pulls equipment status + calibration compliance
- Source: equipment and calibration records

### With fornecedores (Phase 2)

- Section 7 pulls supplier names + active status
- Source: vendor/supplier database

---

## Firestore Rules

```firestore-rules
match /labs/{labId}/management-reviews/{reviewId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow create: if false;  // Via submitReview callable only
  allow update: if false;  // Via submitReview callable only
  allow delete: if false;  // Soft-delete only (RN-06)
}

match /labs/{labId}/management-review-atas/{ataId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow create: if false;  // Via Cloud Function only
  allow update: if false;  // Via Cloud Function only
  allow delete: if false;  // Soft-delete only (RN-06)
}
```

---

## Key Invariants

1. **15 Sections Always:** Review must always have exactly 15 entries. Adding/removing sections requires data migration.
2. **Director-Signed:** Every review has a LogicalSignature from the submitting director. No unsigned reviews.
3. **Immutable After Submission:** Once submitted (status='submitted'), a review cannot be edited. To correct, create new review for same year (validation prevents duplicates).
4. **Data Aggregation:** Sections 1-7 are pre-populated from live data. User reviews pre-filled content, may add context in additional fields.
5. **5-Year Retention:** Reviews are never hard-deleted (soft-delete only). Retention policy enforces 5-year archive minimum.
6. **Single Review Per Year:** Only one review per lab per year can be in submitted/approved status. Prevents duplicate records.

---

## Dependencies

**Required (must be deployed first):**

- Phase 2: equipamentos, fornecedores
- Phase 3.1: indicators (KPIs)
- Phase 3.3: treinamentos
- Phase 5: auditoria-interna, naoConformidades, capa

**Optional (nice-to-have):**

- Phase 12: reclamacoes (customer feedback; if not available, section 4 shows empty)

---

## Known Limitations & Future Work

- **Sections 8-14:** Currently manual-entry only (no system data sources). Future versions may integrate risk management, strategic planning modules.
- **Export to PDF:** Not in Phase 8. Phase 9+ may add Puppeteer-based PDF generation for archival.
- **Multi-language:** Currently Portuguese only. Future localization TBD.
- **Approval Workflow:** Phase 8 creates reviews in 'submitted' status. Phase 9+ will add 'approval' flow (auditor sign-off).

---

## Testing Strategy

**Unit Tests:**

- `managementReviewService.test.ts` — CRUD, soft-delete, year filtering
- `reviewTemplateService.test.ts` — data aggregation from 8 sources, graceful degradation
- `useManagementReview.test.ts` — subscription + year organization
- `useReviewTemplate.test.ts` — caching, error handling

**Integration Tests:**

- `generateReviewTemplate.test.ts` — CF with 5+ scenarios (all collections present, missing collections, auth errors)
- `submitReview.test.ts` — CF with 5+ scenarios (all 15 sections, partial sections, duplicate year, auth)
- `management-review-rules.test.ts` — Firestore rules (deny direct writes, allow reads)

**E2E Tests:**

- `management-review.e2e.test.ts` — full user journey:
  1. Open review form
  2. Auto-populated data visible
  3. Edit sections
  4. Submit → success
  5. View in history
  6. Verify signature in Firestore

**Coverage Target:** ≥95% on new code

---

## Performance Notes

- **Template Generation:** ~2-3s for full data pull (parallel requests to 7 collections)
- **Subscription:** Real-time updates via `onSnapshot`, typically <200ms latency
- **Form Auto-Save:** Every 30s (debounced) to avoid excessive writes
- **Pagination:** Reviews organized by year on client; no server-side pagination needed for typical labs (<10 annual reviews)

---

## Compliance Evidence

When audited on DICQ 4.15:

- Open `/hub` → Management Review tile
- Navigate to Histórico tab
- Select any completed review
- Auditor sees:
  - All 15 sections with content
  - Director name + date
  - Participant list
  - Digital signature (hash + operatorId + timestamp)
  - Source data (Section 1-7 references for verification)

---

**Created:** 2026-05-06 (Phase 8 planning)
**Last Updated:** 2026-05-06
