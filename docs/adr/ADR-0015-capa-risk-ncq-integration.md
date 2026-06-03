# ADR-0015: CAPA vs Risk vs NCQ Integration — Submodule vs. Separate Collection (Phase 8)

- **Status:** Proposed
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

v1.4 Phase 8 integra 3 conceitos de gestão de qualidade que historicamente foram separados em sistemas legacy:

1. **NCQ (Não-Conformidade)** — Deviation detected (resultado crítico, equipamento fora de spec, etc.). RDC 978 Art. 6.
2. **CAPA (Corrective Action Preventive Action)** — Investigation + planned action + verification. RDC 978 Art. 86 (Risk Management component 3).
3. **RISK (FMEA-Lite)** — Probabilidade × Severidade × Detecção = Número de Prioridade. RDC 978 Art. 86 (Risk Management component 2).

**Relacionamento regulatório:**

```
RDC 978 Art. 86 — Risk Management has 3 components:
  1. Risk identification (what can go wrong?)
  2. Risk assessment (P×S×D scoring via FMEA)
  3. Risk treatment via CAPA (mitigação planned → implemented → verified)

So: Risk → CAPA (one risk may spawn multiple CAPAs)
And: NCQ → Risk (finding from audit/inspection triggers new risk entry)
And: NCQ → CAPA (critical finding requires corrective action)

Schema hierarchy:
  Risk (RDC 978 Art. 86 component 2)
    ├─ NPR scoring (P×S×D)
    ├─ Treatment plan (reference to CAPA)
    └─ Status: open → mitigating → closed (via CAPA verification)

  NCQ (Não-Conformidade)
    ├─ Origin (insumo, equipamento, processo, auditoria)
    ├─ Severity (leve, grave, critica)
    └─ CAPA plan (nested)

  CAPA (Corrective Action)
    ├─ Investigation (root cause)
    ├─ Action (what to do)
    ├─ Verification (efficacy proof)
    └─ Linked to: Risk (if treatment of risk) or NCQ (if remediation of finding)
```

**Questão arquitetural:**

Are CAPAs:

- **A)** Always nested inside NCQ (nao-conformidades/{ncId}/capa subfield)?
  - Implies: "CAPA without NCQ doesn't exist" (but Risk management also creates CAPAs)
- **B)** Top-level collection (/labs/{labId}/capas/{capaId}), linked via FK to Risk and/or NCQ?
  - Implies: "CAPA is standalone entity; can be linked to multiple sources"
- **C)** Hybrid: CAPAs are top-level, but Risk + NCQ both hold references to CAPA (read-side links, not redundant data)?
  - Pros: CAPA is normalized; no data duplication.
  - Cons: Circular references (Risk → CAPA → NCQ → Risk?).

**Timeline pressure:** Phase 8 is 3 weeks (May 21 - June 11). Decision must be made NOW (May 7).

## Problema

Three competing architectures:

### Option A: NCQ-only (CAPA nested in nao-conformidades)

**Schema:**

```
/labs/{labId}/nao-conformidades/{ncId}
├── descricao: string
├── severidade: 'leve' | 'grave' | 'critica'
├── status: 'aberta' | 'investigacao' | 'correcao' | 'verif_eficacia' | 'fechada'
├── capa: {                                    // Nested
│   ├── investigacao: {...}
│   ├── acaoCorretiva: {...}
│   ├── verificacaoEficacia: {...}
│   └── linkedRiskIds?: ['risk-123']          // FK to risks (reference only)
├── linkedRiskIds?: ['risk-456']              // Which risks triggered this NCQ?
└── ... (existing fields from ADR-0003)
```

**Characteristics:**

- ✅ Simple: NCQ = canonical entity; CAPA lives inside.
- ✅ Proven: ADR-0003 already uses this for insumos/equipamento NCQs.
- ❌ Rigidity: Risk-to-CAPA linkage is reverse (Risk references NCQ, not vice versa). May cause confusion.
- ❌ Scaling: If 1 NCQ triggers multiple CAPAs (e.g., "equipment down" → separate CAPAs for calibration, training, procedure revision), forcing 1:1 CAPA per NCQ is unnatural.

### Option B: CAPA top-level (separate collection)

**Schema:**

```
/labs/{labId}/capas/{capaId}
├── numero: 'CAPA-2026-0001'
├── titulo: string
├── descricao: string
├── linkedNcqId?: string                      // FK to nao-conformidades
├── linkedRiskIds?: ['risk-123', 'risk-456'] // Multiple risks
├── status: 'planejada' | 'em_execucao' | 'concluida' | 'verificada'
├── investigacao: {...}
├── acaoCorretiva: {...}
├── verificacaoEficacia: {...}
├── transitions: [...]                        // Audit trail (ADR-0012)
└── ...

/labs/{labId}/nao-conformidades/{ncId}
├── ... (as today)
├── linkedCapaId?: string                     // FK to capas
└── linkedRiskIds?: ['risk-123']

/labs/{labId}/risks/{riskId}
├── ... (P, S, D, NPR, status, etc.)
├── linkedCapaIds?: ['capa-001']              // Multiple CAPAs may treat risk
└── linkedNcqId?: string                      // Which NCQ triggered this risk?
```

**Characteristics:**

- ✅ Flexible: 1 risk can have multiple CAPAs; 1 CAPA can address multiple risks.
- ✅ Normalized: CAPA is its own entity (like Risk).
- ❌ Complexity: 3 collections with cross-links (NCQ ↔ CAPA ↔ Risk). More queries needed.
- ❌ Consistency: "Is this CAPA complete?" requires checking status + linkedRiskIds + linked NCQ status. Distributed state.
- ❌ Modeling ambiguity: Does CAPA without NCQ make sense? (Risk can create orphan CAPAs.) Policy unclear.

### Option C: Hybrid (CAPA top-level, Risk + NCQ reference)

**Schema (same as Option B, but with stricter policies):**

```
POLICY:
- NCQ can have 0 or 1 linked CAPA (from investigacao/acaoCorretiva)
- Risk MUST have linkedCapaIds (treatments of risk)
- CAPA MUST have linkedRiskIds (what risks does this CAPA address?)
  OR linkedNcqId (what NCQ triggered this CAPA?)
  (Never both empty; can be both filled)

Validation (server-side):
  if (!capa.linkedRiskIds && !capa.linkedNcqId) {
    throw new Error('CAPA must link to at least one Risk or NCQ');
  }
```

**Characteristics:**

- ✅ Flexibility: Option B benefits + policy clarity.
- ✅ Normalized: Single CAPA entity, reusable.
- ⚠️ Complexity: Policy must be enforced server-side (Cloud Function callable).
- ⚠️ Orphan risk: If linked Risk is deleted, CAPA validation fails. Soft-delete helps, but adds operational burden.

---

**Analysis matrix:**

| Criterion                         | Option A (NCQ-only)       | Option B (Top-level)        | Option C (Hybrid)                |
| --------------------------------- | ------------------------- | --------------------------- | -------------------------------- |
| Implementation speed              | ⭐⭐⭐⭐⭐ (already done) | ⭐⭐ (needs new collection) | ⭐⭐⭐ (new collection + policy) |
| Query simplicity                  | ⭐⭐⭐ (1 doc read)       | ⭐⭐ (multiple FK joins)    | ⭐⭐ (multiple FK joins)         |
| Flexibility (multi-source CAPA)   | ⭐ (1:1 only)             | ⭐⭐⭐⭐⭐                  | ⭐⭐⭐⭐⭐                       |
| Consistency (audit trail)         | ⭐⭐⭐ (single doc)       | ⭐⭐ (distributed)          | ⭐⭐ (distributed)               |
| Regulatory alignment (RDC 978)    | ⭐⭐⭐ (works)            | ⭐⭐⭐⭐⭐ (explicit)       | ⭐⭐⭐⭐⭐ (explicit)            |
| Scalability (# of CAPAs per Risk) | ⭐ (1 only)               | ⭐⭐⭐⭐⭐                  | ⭐⭐⭐⭐⭐                       |

## Decisão

**v1.4 Phase 8 adota OPTION C: Hybrid (CAPA as top-level collection with strict linking policy).**

**Rationale:**

1. **Phase 8 introduces Risk management (ADR-0016).** Risks are first-class entities in RDC 978. CAPAs are the _treatment_ of risks. So CAPA must be first-class too (not nested inside NCQ).
2. **Flexibility matters.** A risk (e.g., "equipment reliability") may spawn multiple CAPAs (calibration, preventive maintenance, staff training). One-CAPA-per-NCQ is too rigid.
3. **Regulatory alignment.** RDC 978 Art. 86 explicitly connects Risk → Treatment (CAPA). Nested CAPA (Option A) obscures this relationship.
4. **v1.3 precedent.** ADR-0003 nested CAPA in NCQ because v1.3 had no Risk management. Now that Risk exists, CAPA should reflect Risk treatment (top-level entity).

### 1. Firestore Schema (Hybrid)

```typescript
// Risk
/labs/{labId}/risks/{riskId}
├── codigo: string (unique per lab)
├── descricao: string
├── p: number (1–5)
├── s: number (1–5)
├── d: number (1–5)
├── npr: number (computed P×S×D)
├── nivel: 'baixo' | 'medio' | 'alto' | 'critico'
├── status: 'aberto' | 'mitigando' | 'fechado'
├── tratamento: {
│   ├── descricao: string
│   ├── capaIds: [string]              // Multiple CAPAs may treat this risk
│   ├── dataTargetMitigacao: Timestamp
│   └── ...
├── linkedNcqIds?: [string]            // Which NCQs identified this risk?
├── transitions: [...]                 // Audit trail
└── ...

// NCQ (Non-Conformidade) — same as v1.3, but with new linkage
/labs/{labId}/nao-conformidades/{ncId}
├── descricao: string
├── severidade: string
├── status: 'aberta' | 'investigacao' | 'correcao' | ...
├── capa: {                            // Single CAPA (or null if no action needed)
│   ├── capaId?: string                // FK to /capas collection (was nested, now FK)
│   ├── investigacao: {...}            // Local copy for legacy compat
│   ├── acaoCorretiva: {...}
│   ├── verificacaoEficacia: {...}
│   └── ... (keep for backward-compat v1.3 NCQs)
├── linkedRiskIds?: [string]           // Which risks does this NCQ relate to?
├── transitions: [...]
└── ...

// CAPA (Corrective Action) — NEW top-level collection
/labs/{labId}/capas/{capaId}
├── numero: string (CAPA-YYYY-SEQ)
├── titulo: string
├── descricao: string
├── linkage: {
│   ├── ncqId?: string                 // Origin: nao-conformidade (optional)
│   ├── riskIds: [string]              // Treatment of risk(s) (required if no ncqId)
│   └── validPolicy: () => {           // Server-side validation
│     return riskIds.length > 0 || ncqId != null;
│   }
├── prazos: {
│   ├── investigacaoDataLimite: Timestamp
│   ├── acaoDataLimite: Timestamp
│   ├── verificacaoDataLimite: Timestamp
│   └── ...
├── investigacao: {
│   ├── realizada: boolean
│   ├── causaRaiz: string
│   ├── dataInicio: Timestamp
│   ├── dataFim?: Timestamp
│   └── investigadorId: string
├── acaoCorretiva: {
│   ├── descricao: string
│   ├── responsavel: string
│   ├── dataRealizacao?: Timestamp
│   ├── resultado?: string
│   └── status: 'planejada' | 'em_execucao' | 'concluida'
├── verificacaoEficacia: {
│   ├── realizada: boolean
│   ├── resultado?: 'eficaz' | 'ineficaz'
│   ├── dataVerificacao?: Timestamp
│   ├── evidencia?: string
│   └── verificadorId: string
├── status: 'planejada' | 'em_execucao' | 'concluida' | 'verificada' | 'fechada'
├── transitions: [...]                 // Audit trail (ADR-0014)
├── signature: LogicalSignature        // (ADR-0012)
└── ...
```

### 2. Phase 8 Implementation Tasks

**A) Create /capas collection + schema**

- Cloud Firestore: new collection + indexes (status, linkedRiskIds)
- Firestore Rules: validate linkage policy (riskIds OR ncqId required)
- Schema migration: copy v1.3 nested NCQ.capa → /capas (one-time batch, backward-compat)

**B) Update NCQ → Reference CAPA**

- NCQ.capa.capaId becomes FK to /capas/{capaId}
- Keep nested fields for backward-compat (legacy queries still work)
- When nested CAPA is updated, trigger sync to /capas doc

**C) Link Risk → CAPA**

- Risk.tratamento.capaIds holds array of CAPA ids
- When Risk.status transitions (open → mitigating), update linked CAPA status (planejata → em_execucao)
- When CAPA verifies efficacy, update Risk.status (mitigating → fechado)

**D) Cloud Function: createCAPAFromRisk + createCAPAFromNCQ**

- `createCAPAFromRisk`: Risk management identifies treatment → creates CAPA + links bidirectionally
- `createCAPAFromNCQ`: Auditor finds NC → creates CAPA (or reuses existing if identical action) + links bidirectionally
- Both callables enforce linkage policy (riskIds OR ncqId)

**E) Query helpers**

- `getCAPAsForRisk(riskId)`: returns array of /capas linked via riskIds
- `getCAPAsForNCQ(ncqId)`: returns /capas linked via ncqId
- `getCAPALinkedRisksAndNCQs(capaId)`: returns {risks, ncqs} for CAPA detail view

### 3. Backward Compatibility (v1.3 → v1.4)

**Migration strategy:**

```
1. Phase 8 Week 1: Deploy schema (new /capas collection is empty)
2. Week 2: Cloud Function `migrateLegacyCAPAs` (batch)
   - Scan all nao-conformidades with nested capa data
   - For each: create doc in /capas with same content
   - Update NCQ.capa.capaId to point to new /capas doc
   - Result: v1.3 NCQs are now linked to v1.4 CAPAs
3. Week 3: Flag as "can create new CAPAs in /capas (top-level)"
   - New CAPAs (Phase 8+) go directly to /capas
   - Legacy CAPAs (migrated from v1.3) already in /capas
   - No two-source-of-truth risk
```

**Data integrity:**

- Nested NCQ.capa fields remain populated (no deletion) for audit trail.
- /capas is source of truth going forward.
- If auditor asks "show me all CAPAs", query `/capas` (not nao-conformidades).

### 4. Regulatory Alignment (RDC 978 Art. 86)

**Risk Management components:**

1. ✅ Identification: Risk register (FMEA-Lite, ADR-0016)
2. ✅ Assessment: P×S×D scoring (ADR-0016)
3. ✅ Treatment: CAPA (planned → implemented → verified) — **THIS ADR**

**RDC 978 Art. 86 audit trail:**

```
Auditor asks: "Show me how you managed risk 'Equipment Downtime'?"
Answer (with ADR-0015):
  1. Risk ID: RISK-2026-0042
  2. Description: "Equipment X failure causes 8h downtime"
  3. P=4, S=5, D=2 → NPR=40 (HIGH)
  4. Treatment: CAPA-2026-0015
  5. CAPA investigation: Root cause = "maintenance interval too long"
  6. CAPA action: "Implement preventive maintenance every 3 months"
  7. CAPA verification: "No equipment downtime in 90 days post-action" ✓ EFICAZ
  8. Risk status: CLOSED (treatment verified)

Timeline (with signatures):
  2026-04-01 10:00 — Risk created (OP-001)
  2026-04-05 14:30 — CAPA created + linked (OP-002)
  2026-04-10 09:00 — Investigation concluded (ENG-003)
  2026-04-15 15:00 — Action started (TECH-004)
  2026-05-01 16:30 — Action completed (TECH-004)
  2026-07-30 08:00 — Efficacy verified (QA-005)
```

**Evidence:** All timestamps + signatures in transitions[] arrays (ADR-0012 + 0014).

## Alternativas consideradas

### Alternativa A' — CAPA always nested in NCQ (no Risk link)

Keep v1.3 model (CAPA inside NCQ). Don't create top-level CAPA collection.

**Pros:**

- Minimal change (1–2 days implementation).
- v1.3 NCQs stay unchanged.

**Cons:**

- Risk → Treatment relationship is implicit (Risk mentions "see NCQ X for CAPA"). Auditor must know to ask.
- If 1 Risk triggers multiple corrective actions, forcing 1 CAPA per NCQ is unnatural.
- Doesn't align with RDC 978 Art. 86 (which lists Risk → Treatment as explicit requirement).

**Rejected:** Not explicit enough for regulatory audit. Phase 8 introduces Risk explicitly; CAPA must reflect that.

### Alternativa B' — CAPA always top-level, NO linkage to NCQ

Create /capas, link to Risks only (NCQs are separate concern).

**Pros:**

- Clear Risk → CAPA → Verification chain (RDC 978 Art. 86).

**Cons:**

- NCQ findings (from audits) can't directly link to corrective actions. Workflow is broken.
- Auditor finds NC, wants to see "what action are we taking?" Can't query directly.

**Rejected:** Breaks NCQ → CAPA workflow (proven in v1.3). CAPAs sometimes originate from NCQs, not just Risks.

## Consequências

### Positivas

1. **Regulatory alignment.** RDC 978 Art. 86 Risk → Treatment → Verification is explicit (Risk doc → CAPA doc → Verification field).
2. **Flexibility.** 1 Risk can spawn multiple CAPAs (calibration + training + procedure revision). 1 NCQ can link to multiple Risks.
3. **Normalized schema.** CAPA is top-level entity (like Risk), not nested. Queries are consistent.
4. **Backward-compatible.** v1.3 NCQs with nested CAPA are migrated seamlessly; no data loss.
5. **Audit trail clarity.** Each CAPA transition is logged (transitions[] array) with LogicalSignature. Auditor sees definitive timeline.

### Negativas

1. **Schema complexity.** Three linked collections (Risk ↔ CAPA ↔ NCQ) require careful consistency management. Circular references possible (Risk → CAPA → NCQ → Risk).
2. **Migration burden.** ~50 v1.3 NCQs with nested CAPAs must be migrated to /capas. 1-time operation, but testing required.
3. **Operational burden (orphan CAPA).** If Risk is soft-deleted, CAPA.linkedRiskIds points to null Risk. Recovery procedure needed (reassign CAPA to remaining Risk, or mark CAPA as "orphan").
4. **Query complexity.** "Show me all actions for patient X" requires joining NCQ → CAPA (or Risk → CAPA), plus filters. More complex than Option A (single NCQ read).

### Mitigations

1. **Validation policy (server-side).** CAPA.linkage.validate() ensures riskIds OR ncqId always populated. Orphan CAPAs are prevented.
2. **Soft-delete only (RN-06).** Risks are never hard-deleted; soft-delete only. Orphan references are findable (search for deleted=true).
3. **Query helpers (CF).** `getCAPAsForRisk()`, `getCAPAsForNCQ()` abstract away complexity. UI just calls helpers.
4. **Documentation.** `.claude/docs/CAPA_ARCHITECTURE.md` explains linking patterns + query helpers.

## Compromissos derivados

1. **v1.4 Phase 8 deliverables (CAPA top-level collection).**
   - `src/features/capa-tracking/types/index.ts` — update to include CAPA entity (was nested, now top-level).
   - `src/features/capa-tracking/services/capaService.ts` — CRUD for /capas collection.
   - `src/features/risks/services/risksService.ts` — update to link CAPA IDs in Risk.tratamento.capaIds.
   - `functions/src/v1.4-capa/createCAPAFromRisk.ts` — CF callable to create CAPA from Risk.
   - `functions/src/v1.4-capa/createCAPAFromNCQ.ts` — CF callable to create CAPA from NCQ.
   - `functions/src/v1.4-capa/migrateLegacyCAPAs.ts` — batch migration script (v1.3 → v1.4).
   - Firestore Rules: validate linkage policy (riskIds OR ncqId required).
   - E2E tests: 8 specs (create CAPA from Risk, create CAPA from NCQ, transition CAPA status, verify Risk status updates, migration success).

2. **Schema documentation.**
   - `.claude/docs/CAPA_ARCHITECTURE.md` — linking patterns, query helpers, backward-compat migration.
   - `docs/adr/ADR-0015-capa-risk-ncq-integration.md` — this ADR.

3. **Operational procedures.**
   - `docs/CAPA_ORPHAN_RECOVERY.md` — procedure if Risk is accidentally deleted (soft-delete, recover CAPA).
   - `docs/CAPA_QUERYING.md` — guide to query helpers (getCAPAsForRisk, getCAPAsForNCQ).

4. **v1.4 Phase 8 migration gate (Week 2).**
   - `scripts/migrate-legacy-capas.sh` — batch migration (test on staging first).
   - Verification: all v1.3 NCQs with CAPA have corresponding /capas doc.
   - Rollback plan: if migration fails, revert to v1.3 schema (nested CAPA only).

5. **Testing + validation.**
   - Unit tests: linkage validation, transition logic.
   - Firestore Rules emulator tests: policy enforcement (riskIds OR ncqId required).
   - E2E tests: create Risk → CAPA → transition → verify efficacy → Risk closes.
   - Integration test: Legacy NCQ.capa migrated to /capas correctly.

## Referências

- ADR-0003 (nao-conformidades + CAPA workflow v1.3)
- ADR-0012 (LogicalSignature audit trail)
- ADR-0014 (Audit Trail Extensibility)
- ADR-0016 (FMEA-Lite Risk Methodology)
- RDC 978/2025 Art. 86 (Risk Management component 3: Treatment via CAPA)
- DICQ 4.14 (Gestão de Risco + Gestão de Não-Conformidades)
- ISO 15189:2022 §8.5 (Risk Management actions)
- v1.4-ROADMAP Phase 8 (CAPA / Risk / NCQ integration)

---

**Aplikabilnost:** v1.4 Phase 8 (Risk Management Treatment via CAPA) + backward-compat migration.

---

**ADR Status:** PROPOSED (pending CTO review)  
**Review Date:** 2026-05-14 (1 week checkpoint: confirm top-level CAPA architecture + linkage policy)  
**Phase 8 Implementation Gate:** 2026-05-21 (Phase 8 kickoff: migration script ready, schema approved, CF callables designed)
