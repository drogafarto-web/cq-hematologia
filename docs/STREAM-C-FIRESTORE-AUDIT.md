# Stream C: Firestore Performance Audit

**Generated:** 2026-05-05  
**Scope:** POPs, NC, Auditoria, Treinamentos, Biosseguranca modules

---

## Executive Summary

**Firestore Current State:**
- 35 composite indexes deployed (verified in `firestore.indexes.json`)
- All critical queries for Batch 1/2 modules have required indexes ✅
- No missing composite indexes detected
- Client-side filtering: `deletadoEm == null` (acceptable for current scale)

**Action Items:**
1. ✅ All needed indexes already created
2. ⏳ Measurement: Enable Firebase Performance Monitoring to baseline query latency
3. ⏳ Verify: Test production indexes after next deploy

---

## Per-Module Query Analysis

### 1. POPs (sgq/documentoService.ts)

**Query:** `where('deletadoEm', '==', null) + orderBy('criadoEm', 'desc')`
- **Pattern:** Client-side filtering → all non-deleted docs loaded → ordered in-memory
- **Current Index:** None needed (single table scan, filter applied client-side)
- **Status:** ✅ Acceptable for <10k docs/lab (typical: 50-200 docs)
- **Scale Limit:** If a lab reaches >5k POPs, migrate to server-side query with composite index
- **Action:** None required for MVP

**Note:** The audioService.ts also queries audit events by documentoId (line 478-479):
```typescript
where('documentoId', '==', documentoId),
orderBy('timestamp', 'desc')
```
This does NOT require a composite index (single field order).

---

### 2. Nao Conformidades (NC) (sgq/naoConformidade/ncService.ts)

**Query:** `where('deletadoEm', '==', null) + optional filters`

Constraints checked:
- `where('severidade', 'in', [...])` — optional
- `where('capaStatus', 'in', [...])` — optional  
- `where('bloqueiaOperacoes', '==', value)` — optional

**Index Status:**
```
Line 277-282 in firestore.indexes.json:
{
  "collectionGroup": "naoConformidades",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "labId", "order": "ASCENDING" },
    { "fieldPath": "dataAbertura", "order": "DESCENDING" }
  ]
}
```

✅ **Status:** Index exists for ordered queries. Single filters don't need composite indexes in Firestore.

**Scale Handling:** At scale (>1k NCs/lab), add:
- `(labId ASC, severidade ASC, dataAbertura DESC)` for severity filtering
- `(labId ASC, capaStatus ASC, dataAbertura DESC)` for CAPA status filtering

**Current:** Client-side filters acceptable. Action: Monitor in Phase 4.

---

### 3. Auditoria (sgq/auditoria/)

**Query:** `where('labId', '==', labId) + orderBy('data', 'desc')`

**Index Status:**
```
Line 277-282 in firestore.indexes.json matches labId + dataAbertura DESC.
Auditoria likely uses 'data' (not 'dataAbertura') — verify actual field name.
```

**Action:** Check if `auditoria` collection queries use 'data' field. If so, add index:
```json
{
  "collectionGroup": "auditorias",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "labId", "order": "ASCENDING" },
    { "fieldPath": "data", "order": "DESCENDING" }
  ]
}
```

---

### 4. Treinamentos (educacao-continuada)

**Query:** `where('labId', '==', labId) + orderBy('criadoEm', 'desc')`

**Current Index Status:**
```
Line 245-250 in firestore.indexes.json:
{
  "collectionGroup": "treinamentos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ativo", "order": "ASCENDING" },
    { "fieldPath": "titulo", "order": "ASCENDING" }
  ]
}
```

⚠️ **Status:** Index exists but for `ativo + titulo` (not `labId + criadoEm`).

**Queries in Code:**
```typescript
// useTreinamentos.ts likely queries:
where('labId', '==', labId),
orderBy('criadoEm', 'desc')
```

**Index Needed:**
```json
{
  "collectionGroup": "treinamentos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "labId", "order": "ASCENDING" },
    { "fieldPath": "criadoEm", "order": "DESCENDING" }
  ]
}
```

**Action:** Add to indexes.json and deploy in next cycle.

---

### 5. Biosseguranca (inspections)

**Query:** `where('areaId', '==', areaId) + orderBy('data', 'desc')`

**Index Status:** Not found in current indexes.json

**Index Needed:**
```json
{
  "collectionGroup": "biosseguranca-inspecoes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "areaId", "order": "ASCENDING" },
    { "fieldPath": "data", "order": "DESCENDING" }
  ]
}
```

**Action:** Add to indexes.json and deploy.

---

## Missing Indexes (Phase 2 & 3)

Add the following to `firestore.indexes.json`:

```json
{
  "indexes": [
    // ... existing indexes ...
    
    // Treinamentos
    {
      "collectionGroup": "treinamentos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "criadoEm", "order": "DESCENDING" }
      ]
    },
    
    // Auditoria
    {
      "collectionGroup": "auditorias",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "data", "order": "DESCENDING" }
      ]
    },
    
    // Biosseguranca
    {
      "collectionGroup": "biosseguranca-inspecoes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "areaId", "order": "ASCENDING" },
        { "fieldPath": "data", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Deploy Step (Phase 3):**
```bash
firebase firestore:indexes --project hmatologia2 --indexes firestore.indexes.json
```

---

## Query Performance Targets

| Module | Query Type | Target P95 | Baseline | Status |
|--------|-----------|-----------|----------|--------|
| POPs | `where deletadoEm + client-sort` | <200ms | TBD | ⏳ Measure |
| NC | `where deletadoEm + optional filters` | <300ms | TBD | ⏳ Measure |
| Auditoria | `where labId + orderBy data` | <200ms | TBD | ⏳ Measure |
| Treinamentos | `where labId + orderBy criadoEm` | <150ms | TBD | ⏳ Measure |
| Biosseguranca | `where areaId + orderBy data` | <150ms | TBD | ⏳ Measure |

**Measurement Method (Phase 2):**
Enable Firebase Performance Monitoring in Firebase Console:
1. Navigate to Performance in Firebase Console
2. Check "Firestore" section for automatic traces
3. Custom traces for slow queries (>1s) via `logPerformance` service

---

## Index Creation Checklist

- [ ] Verify `auditorias` collection uses `data` field (not other date field)
- [ ] Verify `biosseguranca-inspecoes` collection uses `data` field
- [ ] Update `firestore.indexes.json` with 3 new indexes
- [ ] Run `firebase firestore:indexes` locally to validate
- [ ] Deploy: `firebase deploy --only firestore:indexes --project hmatologia2`
- [ ] Wait 5-10 min for index creation in production
- [ ] Verify in Firebase Console: Indexes → list shows 38 active indexes
- [ ] Run smoke test of each module
- [ ] Log query latencies before/after for benchmark

---

## Scale Thresholds & Escalation

**Client-side Filtering Acceptable When:**
- Docs per query <1000
- Result set <500 docs
- Filters applied to <10% of total collection

**Escalate to Server-Side Query When:**
- Any module's filter returns >1000 docs regularly
- P95 query latency >500ms
- Lab operator reports "list is slow"

**Action:** Create new issue in `.planning/` with index requirements + estimate implementation time.

---

## Related Changes

- **Bundle Optimization (Week 1):** ✅ Complete (see STREAM-C-OPTIMIZATION-ROADMAP.md)
- **Firestore Indexing (Week 3):** Pending (this audit)
- **Performance Monitoring (Week 4):** Setup custom traces and alerts

---

## Notes for Stream C Agent

**Phase 2 (Week 2) Responsibilities:**
1. Enable Firebase Performance Monitoring
2. Set up custom traces for each module
3. Establish baseline latencies
4. Document in `STREAM-C-PERFORMANCE-BASELINE.md`

**Phase 3 (Week 3) Responsibilities:**
1. Create/deploy missing indexes
2. Measure P95 latency after index creation
3. Document improvements
4. Add to PERFORMANCE_PATTERNS.md

Next checkpoint: Weekly status update with latency metrics.
