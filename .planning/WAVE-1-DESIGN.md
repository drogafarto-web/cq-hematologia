# ADR 0003 Wave 1 — Design + Schema + Backfill Strategy

**Status:** In Progress  
**Date:** 2026-05-02  
**Wave:** 1 / 5 (Days 1-3)  
**Owner:** gsd-executor (subagent)

---

## Completed Tasks

### 1. NaoConformidade Interface Finalized ✓

**File:** `functions/src/modules/qualidade/types.ts` (created)

**Core Structure:**

```
NaoConformidade {
  id, labId, numero (NC-{YYYY}-{seq})
  origem: 'insumo' | 'equipamento' | 'controle' | 'pessoas' | 'processo' | 'outro'
  origemId?: string (FK to originating entity)
  moduloOrigemId: string (which module opened)
  descricao: string (what went wrong)
  severidade: 'leve' | 'grave' | 'critica'

  status: 'aberta' | 'investig' | 'correcao' | 'verif_eficacia' | 'fechada' | 'cancelada'
  statusHistory: Array<StatusHistoryEntry> (HMAC-signed)

  capa: {
    investigacao: { realizada, dataInicio, dataFim?, conclusao?, investigadoPor? }
    acaoCorretiva: { descricao, dataPrevista, dataRealizacao?, responsavel, status, resultadoObtido? }
    verificacaoEficacia: { realizada, resultado, dataVerificacao?, verificadoPor?, evidencia?, observacoes? }
  }

  aberta: { timestamp, uid, motivo }
  fechada?: { timestamp, uid, motivo }

  bloqueiaOperacoes: boolean (if true, gates all module ops on critical NC)
  operacoesTodasBloqueadas?: string[] (granular scopes: ['hematologia', 'imunologia'])

  hmac: string (ADR 0005 signature)
  previousHash: string | null (chain link)
  _ncAuditTrailRef?: string (FK to audit entry)

  createdAt?, updatedAt?, versao?
}
```

**Supporting Types:**

- `OpenNaoConformidadeRequest` — callable input
- `OpenNaoConformidadeResponse` — callable output
- `UpdateNaoConformidadeRequest` — callable input
- `UpdateNaoConformidadeResponse` — callable output
- `NCCheckResult` — gate output (used by 7 modules)
- `NCAuditEvent` — ADR 0005 integration event
- Various nested interfaces: `Investigacao`, `AcaoCorretiva`, `VerificacaoEficacia`, `CAPA`, `NCAberta`, `NCFechada`

---

### 2. CAPA State Machine Designed ✓

**Workflow (Sequential):**

```
┌─ [NC ABERTA] ─────────────────────────────────────────────────────┐
│  status = 'aberta'                                                 │
│  aberta.timestamp, aberta.uid, aberta.motivo set                  │
│  IF severidade='critica' THEN bloqueiaOperacoes=true              │
│  HMAC-signed entry created (ADR 0005)                             │
└─────────────────────┬──────────────────────────────────────────────┘
                      │
                      ▼
         ┌──────────────────────────┐
         │ investigarNC() [RT-only]  │
         │ status → 'investig'      │
         │ capa.investigacao:       │
         │  ├─ realizada = true     │
         │  ├─ dataInicio = now     │
         │  └─ investigadoPor = uid │
         └────────────┬─────────────┘
                      │
                      ▼
         ┌──────────────────────────────────┐
         │ executarAcaoCorretiva() [RT]     │
         │ status → 'correcao'              │
         │ capa.acaoCorretiva:              │
         │  ├─ descricao (what to do)       │
         │  ├─ dataPrevista (deadline)      │
         │  ├─ responsavel = uid            │
         │  └─ status = 'planejada'         │
         └────────────┬─────────────────────┘
                      │
                      ▼
         ┌──────────────────────────────────┐
         │ (Operator executes action IRL)   │
         │ recordarAcaoRealizada() [RT]     │
         │ capa.acaoCorretiva:              │
         │  ├─ dataRealizacao = now         │
         │  ├─ resultadoObtido = description│
         │  └─ status = 'concluida'         │
         └────────────┬─────────────────────┘
                      │
                      ▼
         ┌──────────────────────────────────┐
         │ verificarEficacia() [RT]         │
         │ status → 'verif_eficacia'        │
         │ capa.verificacaoEficacia:        │
         │  ├─ realizada = true             │
         │  ├─ dataVerificacao = now        │
         │  ├─ verificadoPor = uid          │
         │  ├─ resultado = 'eficaz'|'inef..'│
         │  └─ evidencia (proof)            │
         └────────┬───────────┬─────────────┘
                  │           │
          ┌───────▼────┐   ┌──▼─────────────┐
          │ Eficaz     │   │ Ineficaz       │
          │ (✓)        │   │ (✗)            │
          └─────┬──────┘   └─────┬──────────┘
                │                │
                ▼                ▼
         ┌──────────────┐ ┌──────────────────────┐
         │ closeNC()    │ │ Reopen Investigation │
         │ status →     │ │ status → 'investig'  │
         │ 'fechada'    │ │ Loop to Investigação │
         │ fechada:{}   │ │ (try different root  │
         │ HMAC-sign    │ │  cause/action)       │
         └──────────────┘ └──────────────────────┘
```

**Valid Transitions:**

- `aberta` → `investig` (investigarNC)
- `investig` → `correcao` (executarAcaoCorretiva)
- `correcao` → `verif_eficacia` (verificarEficacia)
- `verif_eficacia` → `fechada` (if resultado='eficaz')
- `verif_eficacia` → `investig` (if resultado='ineficaz', restart loop)
- Any state → `cancelada` (supervisor only, with motivo)

**State Machine Enforcement:**

- Only RT (responsavelTecnico) can advance through CAPA steps
- Each transition records `statusHistory` entry (HMAC-signed)
- Cannot skip steps (must go `investig` → `correcao` → `verif_eficacia`)
- `fechada` is final (no edits except via new NC if same issue re-occurs)

**Blocking Logic:**

- `severidade='critica'` → `bloqueiaOperacoes=true` immediately upon creation
- While `bloqueiaOperacoes=true`:
  - All operations in `moduloOrigemId` are gated
  - `checkNCs()` returns `hasCriticalNCs=true`
  - Module operation throws error with NC numero + message
- Blocking ends only when NC is `fechada` AND `resultado='eficaz'`

---

### 3. Backfill Strategy Planned ✓

**Current State (Pre-ADR-0003):**

- Various modules store NC-like data in **temporary collections**:
  - `labs/{labId}/controleQualidade/desvios` (TBD: check actual path)
  - `labs/{labId}/insumos/{loteId}/desvios` (or similar)
  - `labs/{labId}/equipamentos/{equipId}/manutencao` (maintenance issues)
  - Unstructured NC handling across modules

**Backfill Approach:**

**Phase 1: Audit Existing Data**

```bash
# Day 2 task: Query all labs for existing NC-like data
# Identify:
# - Total count of desvios/issues across all labs
# - Field mapping (temporary structure → NaoConformidade)
# - Data quality (missing fields, inconsistent dates)
# - Date range (oldest NC, newest NC)

Sample query logic:
  for each lab:
    count(labs/{labId}/controleQualidade/desvios)
    count(labs/{labId}/insumos/*/desvios)  [subcollection]
    count(labs/{labId}/equipamentos/*/manutencao)
    ...
```

**Phase 2: Design Mapping (1-to-1 per module)**

| Module      | Old Path                                         | NC Origem     | Mapping                                            |
| ----------- | ------------------------------------------------ | ------------- | -------------------------------------------------- |
| Insumos     | `labs/{labId}/insumos/{loteId}/desvios`          | `insumo`      | `origemId=loteId`, `moduloOrigemId='insumos'`      |
| Equipamento | `labs/{labId}/equipamentos/{equipId}/manutencao` | `equipamento` | `origemId=equipId`, `moduloOrigemId='equipamento'` |
| Qualidade   | `labs/{labId}/controleQualidade/desvios`         | `controle`    | `origemId=desvioId`, `moduloOrigemId='qualidade'`  |
| Pessoas     | `labs/{labId}/qualificacoes/{uid}/desvios`       | `pessoas`     | `origemId=uid`, `moduloOrigemId='pessoas'`         |
| Auditoria   | `labs/{labId}/auditorias/{auditId}/findings`     | `outro`       | `origemId=auditId`, `moduloOrigemId='auditoria'`   |
| Evolucoes   | ? (TBD: check if result quality issues stored)   | `outro`       | TBD                                                |
| POPs        | ? (TBD: check if procedure deviations stored)    | `processo`    | TBD                                                |

**Phase 3: Script Execution (Wave 3)**

```bash
# Create: functions/scripts/backfill-naoConformidade.mjs
# Input: --labId=default (or all labs)
# Tasks:
#  1. Query all temporary NC collections
#  2. For each temporary NC:
#     a. Generate numero (NC-{YYYY}-{seq})
#     b. Map fields to NaoConformidade schema
#     c. Set status='fechada' (historical NCs are closed)
#     d. Set aberta.timestamp from original createdAt
#     e. Leave capa empty (no CAPA data for historical NCs)
#     f. Compute HMAC (ADR 0005)
#     g. Write to /labs/{labId}/nao-conformidades/{ncId}
#  3. Verify 1:1 mapping (count before = count after)
#  4. Log results (created, skipped, errors)
#  5. Do NOT delete temporary data yet (Wave 5 cleanup)

# Execution:
#  node functions/scripts/backfill-naoConformidade.mjs --labId=default
#  # Output: Backfilled 127 NCs, 0 skipped, 0 errors
```

**Phase 4: Verification (Wave 4-5)**

- Spot-check 5 backfilled NCs in Firestore console
- Verify HMAC is present + valid
- Verify chainHash is intact
- Count: all temporary data still there (intact for audit trail)
- Test: query `/labs/{labId}/nao-conformidades` returns expected count

**Rollback Plan:**

- If backfill fails: script is idempotent (check `_migratedAt` flag on NCs)
- Re-run same script: skips already-migrated NCs
- Manual verification: can always query old collection + compare counts

---

## NC Origins Mapped to 7 Modules ✓

| #   | Modulo          | NC Origem     | Example                                                             | Responsible     |
| --- | --------------- | ------------- | ------------------------------------------------------------------- | --------------- |
| 1   | **Insumos**     | `insumo`      | Expired lot, contamination, deviation from specs                    | Almoxarife / RT |
| 2   | **Equipamento** | `equipamento` | Equipment failure, calibration issue, maintenance overdue           | Técnico / RT    |
| 3   | **Qualidade**   | `controle`    | QC failure, EQA deviation, CEQ out-of-range                         | Analista / RT   |
| 4   | **Pessoas**     | `pessoas`     | Training expiration, qualification gap, competency issue            | RH / RT         |
| 5   | **POPs**        | `processo`    | Procedure not followed, POP outdated, operator untrained on version | Supervisor / RT |
| 6   | **Evoluções**   | `outro`       | Result quality issue, transcription error, missing data             | Analista / RT   |
| 7   | **Auditoria**   | `outro`       | External audit finding, regulatory gap, corrective action overdue   | Auditor / RT    |

---

## Blocking Logic Designed ✓

**Gate Placement (per module):**

Each of the 7 modules will have a `checkNCs()` function (Wave 3):

```typescript
async function checkNCs(
  labId: string,
  uid: string,
  moduloOrigemId: string,
): Promise<NCCheckResult> {
  // Query critical NCs for this module + lab
  const criticalNCs = await db
    .collection(`labs/${labId}/nao-conformidades`)
    .where('moduloOrigemId', '==', moduloOrigemId)
    .where('bloqueiaOperacoes', '==', true)
    .where('status', 'in', ['aberta', 'investig', 'correcao', 'verif_eficacia'])
    .get();

  if (!criticalNCs.empty) {
    return {
      hasCriticalNCs: true,
      criticalNCs: criticalNCs.docs.map((doc) => ({
        ncId: doc.id,
        numero: doc.data().numero,
        severidade: doc.data().severidade,
        descricao: doc.data().descricao,
        bloqueiaOperacoes: doc.data().bloqueiaOperacoes,
      })),
      message: `Operações bloqueadas: ${criticalNCs.docs[0].data().numero} — ${criticalNCs.docs[0].data().descricao}`,
    };
  }

  return { hasCriticalNCs: false, criticalNCs: [] };
}
```

**Gate Invocation (before create/update in each module):**

```typescript
// In insumos.createInsumo() or similar:
const ncCheck = await checkNCs(labId, uid, 'insumos');
if (ncCheck.hasCriticalNCs) {
  throw new Error(`NC Blocking: ${ncCheck.message}`);
}
// Proceed with operation
```

**Audit Trail:**

- Log which NC blocked which operation
- Store in ADR 0005 audit trail: `operation: 'operacao.bloqueada', payload: {ncId, operacao}`

---

## Design Decisions Documented ✓

### 1. Why Canonical Collection?

- **Single source of truth:** All NCs in one collection, queryable across modules
- **Audit trail:** Full status history + CAPA workflow in one document
- **Blocking:** Gate logic checks one collection (fast)
- **Compliance:** RDC 978 requires formal NC registry

### 2. Why CAPA Workflow in Same Document?

- **Atomicity:** NC + CAPA state always in sync (no split-brain)
- **History:** Full lifecycle visible in one doc (open → investigate → action → verify → close)
- **Denormalized but queryable:** Can filter by `capa.investigacao.realizada=true`
- **No N+1:** Single read gets full NC context

### 3. Why HMAC + Chain Hash?

- **Integrity:** Each NC signed via ADR 0005 (cannot tamper with status history)
- **Chain:** previousHash prevents reordering of NCs
- **Audit trail:** Full lineage of all changes (no silent edits)
- **Regulatory:** RDC 978 requires immutable records + audit trail

### 4. Why bloqueiaOperacoes Boolean?

- **Performance:** Single boolean check is O(1) before ops (no complex query)
- **Clarity:** NC creator decides blocking (not inferred)
- **Flexibility:** Can be set manually if initial severity was wrong
- **Reversible:** Can be unset if NC severity downgraded by RT

### 5. Why statusHistory Array (Not Separate Collection)?

- **Atomicity:** No race conditions between NC doc + history entries
- **Queryability:** Single `where` clause filters NCs by last transition
- **Limits:** Array can grow large (but NC has max ~10-20 transitions before closure)
- **Fallback:** If array grows too large (rare), can archive old entries

---

## Remaining Tasks (Waves 2-5)

### Wave 2 (Days 4-6): Cloud Functions + Validators

- [ ] Implement `openNaoConformidade()` callable
- [ ] Implement `updateNaoConformidade()` callable
- [ ] Implement `investigarNC()`, `executarAcaoCorretiva()`, `verificarEficacia()` helpers
- [ ] HMAC signing integration via ADR 0005
- [ ] Unit tests (8+ cases)

### Wave 3 (Days 7-9): 7-Module Integration

- [ ] Add `checkNCs()` gate to each module
- [ ] Add gate invocations before create/update
- [ ] Create per-module backfill scripts
- [ ] Integration tests (E2E open → block → investigate → close)

### Wave 4 (Days 10-12): Tests + Firestore Rules

- [ ] Unit tests >80% coverage
- [ ] Integration tests (blocking, CAPA flow)
- [ ] `firestore.rules.adr-0003.patch` (create, update, read rules)
- [ ] Smoke test: open NC in Insumo → block use → investigate → close

### Wave 5 (Days 13-14): Deploy + Monitoring

- [ ] Build functions: `npm run build`
- [ ] Deploy functions + rules
- [ ] Run backfill script
- [ ] Monitor logs + metrics
- [ ] Create SUMMARY.md

---

## Commit Status

**Ready for:** `git commit -m "ADR 0003 Wave 1: Schema finalized + backfill strategy"`

**Files to stage:**

- `functions/src/modules/qualidade/types.ts` ✓
- `.planning/WAVE-1-DESIGN.md` ✓

**No breaking changes:** Schema is new, no existing code modified yet.

---

**Next Action:** Commit Wave 1, proceed to Wave 2 (Cloud Functions)
