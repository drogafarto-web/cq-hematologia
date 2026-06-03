# Phase 10: Multi-Instrument Strategy for Biochemistry CIQ

**Document**: PHASE_10_MULTI_INSTRUMENT_STRATEGY.md  
**Date**: 2026-05-07  
**Status**: Specification for Phase 10 implementation  
**Audience**: Engineering team, CIQ supervisors, audit trail

---

## Executive Summary

This document defines the end-to-end strategy for managing quantitative biochemistry control materials and runs across **multiple instruments** in a single laboratory. Phase 9 established the foundation (17 seed analytes, basic Westgard CLSI engine); Phase 10 extends this to handle:

1. **Multi-equipment validation** — same control lot measured on different analyzers
2. **Method-comparison Levey-Jennings charts** — detecting systematic instrument drift
3. **Equipment metadata + calibration verification** — per-instrument performance tracking
4. **Lot traceability** — which equipment can use which control material
5. **Cross-instrument statistical reconciliation** — comparing results across models

This architecture aligns with:

- **RDC 978/2025** Arts. 179–183 (CIQ mandatory, material traceability)
- **DICQ 4.3** Blocks F (Analytical) + inventory (calibration per equipment)
- **CLSI EP15** (method comparison studies)
- **ISO 15189** (equipment validation, QC procedures)

---

## 1. Multi-Equipment Design (Day 1 Architecture)

### 1.1 Control Material Ownership Model

**One control lot can be used on N instruments within the same lab.**

```
ControlMaterial (lote ABC-12345)
├── equipmentIds: ["equip-yumizen-1", "equip-yumizen-2", "equip-micros-60"]
├── origem: "bula"
├── manufacturerStats: { analyteId → { nivelId → { mean, sd } } }
└── validade: 2026-12-31

Run (captura de GLI, CRE, TGO em nível Normal)
├── lotId: "abc-12345"
├── equipmentId: "equip-yumizen-1"   ← ONE equipment per run
├── resultados: { glic-001: { normal: 95.2 }, cret-001: { normal: 1.1 }, tgo-001: { normal: 28 } }
└── violations: [] (Westgard evaluated vs. manufacturerStats)
```

**Key constraint**: A **run is granular to one equipment**. One operator in one shift on one analyzer captures N analytes at 1 control level in 1 run transaction. Aligns with typical workflow: "Run Normal level on Yumizen #1 now."

### 1.2 Firestore Schema (Multi-Tenant)

```
/labs/{labId}/bioquimica/
├── root/
│   ├── analitos/{analitoId}
│   │   ├── nome, sigla, unidade, normalRange, cvAlvo
│   │   ├── westgardRules (per-analyte enabled/disabled flags in v1.4)
│   │   └── ...
│   ├── lotes/{lotId}
│   │   ├── fornecedor, lote, validade
│   │   ├── equipmentIds: ["equip-yumizen-1", "equip-yumizen-2"]
│   │   ├── niveis: [{ id: "normal", nome: "Normal" }, { id: "patologico", nome: "Patológico" }]
│   │   ├── manufacturerStats: { analitoId → { nivelId → { mean: 95.5, sd: 2.1 } } }
│   │   ├── origem: "bula"
│   │   └── bulaPendente: false
│   ├── runs/{runId}
│   │   ├── equipmentId (1-to-1, not array)
│   │   ├── lotId
│   │   ├── operatorId
│   │   ├── capturaEm
│   │   ├── resultados: { analitoId → { nivelId → value } }
│   │   ├── violations: [{ rule, analitoId, nivelId, severity, detail }]
│   │   ├── status: "Aprovada" | "Rejeitada" | "Pendente"
│   │   └── chainHash (immutable, audit trail)
│   ├── traceability-events/{eventId}
│   │   ├── type: "bula-applied", "run-recorded", "lot-retired", ...
│   │   ├── lotId (FK)
│   │   ├── equipmentId (when relevant)
│   │   ├── signature: { hash, operatorId, ts }
│   │   └── ...
│   ├── audit/{logId}
│   │   └── (append-only trail, replicas run status + compliance overrides)
│   └── config/{singleton}
│       ├── westgard: { enabled: true, rules: ["1-2s", "1-3s", "2-2s", "R-4s"], ... }
│       └── ...
├── stats/
│   ├── (future aggregate rollup per month, per equipment)
│   └── (reduces need for cross-collection client-side `.reduce()`)
└── reports/
    └── (monthly FR-001 summaries: equipment-segregated Levey-Jennings exports)

/labs/{labId}/equipamentos/{equipamentoId}
├── id, module: "bioquimica", name, modelo, fabricante
├── status: "ativo" | "manutencao" | "aposentado"
├── numeroSerie, anoFabricacao, anoAquisicao, registroAnvisa
├── observacoes (free-form: calibration notes, maintenance contract, serial number changes)
├── criadoEm, createdBy, updatedAt, updatedBy
└── (soft-delete: aposentadoEm + retencaoAte for 5-year audit trail)
```

### 1.3 Lot-to-Equipment Association Rules

**Firestore rules enforce:**

1. **Write**: A ControlMaterial doc can be created/updated only if:
   - `equipmentIds` array references valid equipment documents (foreign key check)
   - All referenced equipments have `module: "bioquimica"`
   - All referenced equipments have `status: "ativo"` or `"manutencao"` (not aposentado)
   - `labId` in path matches `labId` in payload (defense-in-depth)

2. **Run creation**: A Run can be created only if:
   - `equipmentId` exists and is marked `status: "ativo"` (not maintenance/retired)
   - `equipmentId` is in the referenced ControlMaterial's `equipmentIds` list
   - `operatorId === request.auth.uid` (no impersonation)
   - Server-side Cloud Function validates Westgard **before** committing

3. **Immutability post-signature**: Runs become read-only after signature is computed. Compliance overrides create a new versioned override doc in a `run-overrides/{overrideId}` subcollection (audit trail).

---

## 2. Westgard Engine (Server-Side Computation)

### 2.1 Triggering Point

**Cloud Function**: `recordRunBioquimica` (callable, region: `southamerica-east1`, Node 22)

```typescript
exports.recordRunBioquimica = functions
  .region('southamerica-east1')
  .https.onCall(async (req, ctx) => {
    // 1. Validate auth
    const userId = ctx.auth?.uid || throwError('Unauthenticated');

    // 2. Validate multi-tenant: req.labId must match user's active lab
    const labId = req.labId || throwError('Missing labId');
    const { labId: userLabId } = await verifyMembership(userId, labId);

    // 3. Load control material (bula stats)
    const lot = await db.doc(`/labs/${labId}/bioquimica/root/lotes/${req.lotId}`).get();
    if (!lot.exists) throw new HttpsError('not-found', 'Lot not found');

    // 4. Load analytes (all enabled)
    const analitos = await db
      .collection(`/labs/${labId}/bioquimica/root/analitos`)
      .where('ativo', '==', true)
      .get();

    // 5. Evaluate Westgard rules (see 2.2 below)
    const violations = evaluateWestgard(req.resultados, lot, analitos);

    // 6. Determine status + aproveitamento
    const status = violations.some((v) => v.severity === 'reject')
      ? 'Rejeitada'
      : violations.length > 0
        ? 'Pendente'
        : 'Aprovada';

    // 7. Compute signature (server-side)
    const signature = await computeLogicalSignature(userId, payload);

    // 8. Compute chainHash (encadeamento criptográfico)
    const chainHash = await computeChainHash(labId, signature, lastRunChainHash);

    // 9. Atomic transaction: create Run + append TraceabilityEvent
    const batch = db.batch();
    batch.set(db.collection(`/labs/${labId}/bioquimica/root/runs`).doc(), {
      labId,
      equipmentId: req.equipmentId,
      lotId: req.lotId,
      operatorId: userId,
      capturaEm: req.capturaEm,
      resultados: req.resultados,
      violations,
      status,
      aproveitamento: violations.some((v) => v.severity === 'reject') ? 'informativa' : 'oficial',
      signature,
      chainHash,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.set(db.collection(`/labs/${labId}/bioquimica/root/traceability-events`).doc(), {
      labId,
      type: 'run-recorded',
      runId: runDocRef.id,
      lotId: req.lotId,
      equipmentId: req.equipmentId,
      signature,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return { runId: runDocRef.id, status, violations };
  });
```

### 2.2 Rule Evaluation Logic

**Implemented in**: `functions/src/modules/bioquimica/westgardEngine.ts`

```typescript
/**
 * Evaluates CLSI Westgard rules against a run's results.
 * Returns array of violations (empty = all OK).
 */
export function evaluateWestgardRules(
  runResultados: RunResultados, // { analitoId → { nivelId → value } }
  controlMaterial: ControlMaterial, // { manufacturerStats, ... }
  analitos: Analito[], // all analytes in lab
  previousRuns: Run[], // last N runs on same (analitoId, equipmentId, nivelId)
): WestgardViolation[] {
  const violations: WestgardViolation[] = [];

  for (const [analitoId, nivelResults] of Object.entries(runResultados)) {
    const analito = analitos.find((a) => a.id === analitoId);
    if (!analito) continue; // Skip if analyte doesn't exist

    for (const [nivelId, value] of Object.entries(nivelResults)) {
      const manStats = controlMaterial.manufacturerStats?.[analitoId]?.[nivelId];
      if (!manStats) continue; // No stats = no rules (waiting for bula)

      const { mean, sd } = manStats;
      const deviation = (value - mean) / sd; // σ units

      // 1-2s rule (warn)
      if (Math.abs(deviation) > 2.0) {
        violations.push({
          rule: '1-2s',
          analitoId,
          nivelId,
          severity: 'warn',
          detail: `Run 1: ${deviation.toFixed(1)}σ from mean (${mean} ± ${sd})`,
        });
      }

      // 1-3s rule (reject)
      if (Math.abs(deviation) > 3.0) {
        violations.push({
          rule: '1-3s',
          analitoId,
          nivelId,
          severity: 'reject',
          detail: `Run 1: ${deviation.toFixed(1)}σ > 3σ (out of spec)`,
        });
      }

      // 2-2s rule (2 consecutive same side of 2σ)
      if (previousRuns.length > 0) {
        const lastRun = previousRuns[0];
        const lastManStats = controlMaterial.manufacturerStats?.[analitoId]?.[nivelId];
        if (lastManStats) {
          const lastDeviation =
            (lastRun.resultados[analitoId][nivelId] - lastManStats.mean) / lastManStats.sd;
          if (
            Math.abs(deviation) > 2.0 &&
            Math.abs(lastDeviation) > 2.0 &&
            Math.sign(deviation) === Math.sign(lastDeviation)
          ) {
            violations.push({
              rule: '2-2s',
              analitoId,
              nivelId,
              severity: 'reject',
              detail: `2 consecutive runs > 2σ, same side (run -1: ${lastDeviation.toFixed(1)}σ; this run: ${deviation.toFixed(1)}σ) — systematic drift`,
            });
          }
        }
      }

      // R-4s rule (range between 2 consecutive > 4σ)
      if (previousRuns.length > 0) {
        const lastRun = previousRuns[0];
        const lastManStats = controlMaterial.manufacturerStats?.[analitoId]?.[nivelId];
        if (lastManStats) {
          const lastValue = lastRun.resultados[analitoId][nivelId];
          const range = Math.abs(value - lastValue);
          const rangeInSd = range / (2 * manStats.sd); // Range in σ units
          if (rangeInSd > 4.0) {
            violations.push({
              rule: 'R-4s',
              analitoId,
              nivelId,
              severity: 'reject',
              detail: `Range between 2 runs: ${range.toFixed(2)} (${rangeInSd.toFixed(1)}σ) — precision loss`,
            });
          }
        }
      }
    }
  }

  return violations;
}
```

**Key points:**

- **Server-only**: Client never computes Westgard (Threat T5).
- **Queryable result history**: Violations are embedded in the Run doc → easy to filter "Rejeitada" runs in UI.
- **Severity escalation**: 1-2s remains `warn` (advisory), all others are `reject` (blocks oficial approval).
- **Extended rules disabled by default**: 4-1s, 10x, 6T, 6X are recognized in code but not evaluated unless explicitly enabled per analyte in v1.4 UI.

---

## 3. Method Comparison & Levey-Jennings by Equipment

### 3.1 Chart Data Model

**For a given analyte + level + equipment, compute aggregates:**

```typescript
interface LeveyJenningsDataEquipment {
  analitoId: AnalitoId;
  nivelId: NivelId;
  equipmentId: EquipmentId;

  // From bula (manufacturer reference)
  manufacturerMean: number;
  manufacturerSd: number;

  // Computed from runs on this equipment
  internalMean: number; // mean of last N runs
  internalSd: number; // std dev of last N runs

  // Time series for chart
  points: Array<{
    runId: string;
    capturaEm: Timestamp;
    value: number;
    status: 'Aprovada' | 'Rejeitada' | 'Pendente';
    deviationFromMean: number; // in σ units
  }>;

  // Trend stats
  pointCount: number;
  trendAnalysis: {
    isStable: boolean; // no 2-2s or R-4s violations
    driftDetected: boolean; // rising/falling over last 5 points?
    cvPercent: number;
  };
}
```

### 3.2 Method Comparison Chart (Cross-Equipment)

**When lab has 2+ instruments measuring the same analyte:**

```typescript
interface MethodComparisonChart {
  analitoId: AnalitoId;
  nivelId: NivelId;

  equipmentGroups: Array<{
    equipmentId: EquipmentId;
    equipmentName: string; // e.g., "Yumizen H550 — Bancada 2"
    modelo: string; // YUMIZEN_H550

    // Stats from this equipment
    mean: number;
    sd: number;
    pointCount: number;

    // Comparison to reference (bula)
    biasPercent: number; // (mean - manufacturerMean) / manufacturerMean
    isComparable: boolean; // |bias| < X% (configurable, default 10%)
  }>;

  // Overall assessment
  methodsComparable: boolean;
  recommendedReference: EquipmentId; // which one to use as "golden"?
}
```

**UI rendering:**

- X-axis: capture date
- Y-axis: result value (with ±2σ and ±3σ bands from manufacturer)
- Lines per equipment: distinct colors
- Hover: show exact value, σ deviation, equipment name

### 3.3 Data Materialization (Phase 10 or Phase 11 rollup?)

**Option A (Phase 10 — eager)**: Cloud Function `generateMonthlyReportBioquimica` runs every night or on-demand, pre-aggregating stats per (analitoId, nivelId, equipmentId) into `/stats/`. Reduces UI latency.

**Option B (Phase 10 — lazy)**: UI hook `useLeveyJenningsData(analitoId, nivelId, equipmentId)` queries `/runs` collection-group, applies `.filter()` and `.reduce()` client-side. Simpler to implement, slower for large datasets (>100 runs per pair).

**Recommendation**: Start with Option B (lazy) in Phase 10, migrate to Option A (eager) in Phase 11 when performance becomes measurable constraint (baseline: <1s chart render time).

---

## 4. Equipment Metadata & Calibration Verification

### 4.1 Equipment Document (from `src/features/equipamentos/types/Equipamento.ts`)

```typescript
interface Equipamento {
  id: string;
  labId: string;

  // Identity
  module: 'bioquimica';
  name: string; // "Yumizen H550 — Bancada 2"
  modelo: string; // YUMIZEN_H550 (UPPER_SNAKE_CASE, used in bula lookup)
  fabricante: string;
  numeroSerie?: string; // RDC 786/2023 Art. 42 (required in audit)
  anoFabricacao?: number;
  anoAquisicao?: number;
  registroAnvisa?: string; // ANVISA device registration number
  observacoes?: string; // free-form: calibration schedule, contract details, etc.

  // Lifecycle
  status: 'ativo' | 'manutencao' | 'aposentado';
  manutencaoDesde?: Timestamp;
  motivoManutencao?: string;
  aposentadoEm?: Timestamp; // RDC 978 Art. 180 (traceability of retired instruments)
  motivoAposentadoria?: string; // ≥10 chars (defensible audit trail)
  destinoFinal?: 'venda' | 'devolucao' | 'sucateamento' | 'descarte-ambiental' | 'doacao';
  retencaoAte?: Timestamp; // aposentadoEm + 5 years (RDC 786/2023)

  createdAt: Timestamp;
  createdBy: UserId;
  updatedAt?: Timestamp;
  updatedBy?: UserId;
}
```

### 4.2 Calibration Verification Procedures

**Not a separate collection**; instead, part of `observacoes` free-form field + equipment audit log.

**Manual entry points** (Phase 10):

1. **Supervisor daily checklist**: "Run normal control on Yumizen #1 — is it passing Westgard?"
2. **Service log**: When technician replaces lamp, realigns optics, etc., operator records in `observacoes` + creates `EquipamentoAuditEvent` of type `'updated'`.
3. **Preventive maintenance calendar**: Stored outside this system (e.g., Obsidian, external maintenance contract).

**Future integration** (Phase 11+):

- IoT integration: ESP32 periodically sends temperature, humidity, lamp intensity → Firestore timeseries.
- Automated calibration alerts: When CV exceeds threshold for 3 consecutive runs.

### 4.3 Equipment in Run Snapshots

**Every run captures equipment state at capture time:**

```typescript
// Not stored in Run directly, but in ReagenteSnapshot + equipment reference
interface EquipamentoSnapshot {
  id: string;
  name: string;
  modelo: string;
  fabricante: string;
  numeroSerie?: string;
}

// In Run doc:
{
  id: "run-abc-123",
  equipmentId: "equip-yumizen-1",
  equipmentSnapshot: {
    id: "equip-yumizen-1",
    name: "Yumizen H550 — Bancada 2",
    modelo: "YUMIZEN_H550",
    fabricante: "Horiba Medical",
    numeroSerie: "HM-2024-00145"
  },
  // ... other run fields
}
```

**Rationale**: Survives future deletion/retirement of equipment master doc. Audit trail can prove "which instrument was used at 10:30 on 2026-05-15" even 5 years later.

---

## 5. Lot Traceability per Instrument

### 5.1 Lot Creation Flow

```
User: "I received ControlMaterial LOT-ABC-12345 today from ControlLab"

Step 1: Lab admin enters lot metadata
├── fornecedor: "ControlLab Brasil"
├── lote: "ABC-12345"
├── validade: 2026-12-31
├── niveis: [ { id: "normal", nome: "Normal" }, { id: "patologico", nome: "Patológico" } ]
└── origem: "sem-bula-7d" (or "bula" if PDF is available)

Step 2: Select which equipment can use this lot
├── equipmentIds: ["equip-yumizen-1", "equip-yumizen-2"]
└── (Constraint: only ativo or manutencao equipment)

Step 3: If origem === "bula", upload PDF
├── Gemini Vision parses PDF
├── Extracts mean ± SD per analyte × level
└── Populates manufacturerStats

Step 4: Cloud Function `seedBioquimicaDefaults` (or callable `createLot`) commits atomically
├── Creates ControlMaterial doc
├── Creates Traceability event
└── Returns lotId for UI confirmation
```

### 5.2 Lot-Equipment Compatibility Queries

**UI use cases:**

```typescript
// "Show me all active lots I can use on Yumizen #1"
const yumizenlots = await db
  .collection(`/labs/${labId}/bioquimica/root/lotes`)
  .where('equipmentIds', 'array-contains', 'equip-yumizen-1')
  .where('bulaPendente', '==', false)
  .where('deletadoEm', '==', null)
  .where('validade', '>', new Date())
  .orderBy('validade')
  .get();

// "Which equipment can use this lot?"
const compatibleEquipment = lot.data().equipmentIds;
const equipmentDocs = await db
  .collection(`/labs/${labId}/equipamentos`)
  .where('id', 'in', compatibleEquipment)
  .where('status', '==', 'ativo')
  .get();
```

### 5.3 Archival & Retention

**When a lot is retired:**

```typescript
// Supervisor clicks "Archive this lot" (e.g., expiration approaching, received replacement)
const batch = db.batch();

batch.update(lotDocRef, {
  archivedAt: admin.firestore.FieldValue.serverTimestamp(),
  // Note: deletadoEm remains null until full expiration + 5-year retention
});

batch.set(db.collection(`/labs/${labId}/bioquimica/root/traceability-events`).doc(), {
  type: 'lot-archived',
  lotId,
  archivedBy: userId,
  reason: 'Expired; replaced by LOT-XYZ-999',
  signature: { ... },
  ts: admin.firestore.FieldValue.serverTimestamp(),
});

await batch.commit();
```

**Soft-delete + retention**: Archived lots remain queryable for audit; hard deletion never occurs (RN-06).

---

## 6. Cross-Equipment Quality Assessment

### 6.1 Bias & Precision Metrics

**For two instruments measuring the same control:**

```typescript
/**
 * Compare results from Equipment A vs. Equipment B for a given analyte + level.
 * Used to detect systematic differences (e.g., Yumizen slightly higher than Micros).
 */
interface EquipmentComparison {
  analitoId: AnalitoId;
  nivelId: NivelId;
  equipmentIdA: EquipmentId;
  equipmentIdB: EquipmentId;

  // Manufacturer reference
  referenceMean: number;
  referenceSd: number;

  // Equipment A stats
  meanA: number;
  sdA: number;
  pointCountA: number;
  biasA: number; // (meanA - referenceMean) / referenceMean * 100
  cvA: number; // (sdA / meanA) * 100

  // Equipment B stats
  meanB: number;
  sdB: number;
  pointCountB: number;
  biasB: number;
  cvB: number;

  // Comparison
  meanDifference: number; // meanA - meanB
  isSystematic: boolean; // |bias_diff| > acceptable threshold?
  comparableEstimate: string; // "yes", "no — A runs 5% high", "insufficient data"
}
```

### 6.2 Acceptable Tolerance

**Default thresholds (configurable in `config/westgard` doc):**

```json
{
  "methodComparison": {
    "acceptableBiasPercent": 10, // max 10% bias vs. reference
    "acceptablePrecisionRatio": 1.5, // max σ_A / σ_B = 1.5×
    "minPointsPerEquipment": 10 // need 10+ data points to compare
  }
}
```

**Clinical decision**: If two instruments differ by >10%, supervisor investigates (calibration drift? reagent lot effect?).

---

## 7. Compliance & Audit Trail

### 7.1 Immutable Audit Log

**Every significant action creates append-only event:**

```typescript
interface TraceabilityEvent {
  id: string;
  labId: LabId;

  // What happened?
  type: 'bula-applied'
      | 'run-recorded'
      | 'lot-archived'
      | 'equipment-registered'
      | 'compliance-override-applied'
      | ...;

  // Context
  lotId?: string;
  runId?: string;
  equipmentId?: string;

  // Human accountability
  signature: LogicalSignature;  // { hash (SHA-256), operatorId, ts }

  // Metadata
  detail?: string;              // free-form reason
  timestamp: Timestamp;
}
```

**Firestore rules enforce append-only:**

```firestore
match /labs/{labId}/bioquimica/root/traceability-events/{eventId} {
  allow create: if isValidTraceabilityEvent(request.resource.data);
  allow read: if isMemberOfLab(request.auth.uid, labId);
  allow update, delete: if false;  // immutable
}
```

### 7.2 RDC 978/2025 Compliance Checklist

| Requisito                                       | Implementação                                      | Verificação                         |
| ----------------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| Art. 179 — CIQ obrigatório                      | Westgard engine + runs                             | `violations` array in Run doc       |
| Art. 180 — Material control com rastreabilidade | ControlMaterial.equipmentIds + Traceability events | Lot history queryable per equipment |
| Art. 181 — Amostra controle auditada            | TraceabilityEvent.signature + chainHash            | Immutable log, crypto-verified      |
| Art. 128 — Reagente rastreado                   | ReagenteSnapshot in Run                            | Snapshot frozen at capture          |
| Art. 167 — Laudo gerado                         | Monthly FR-001 report (Phase 10+)                  | Cloud Function generates PDF        |
| Art. 183 — CIQ por troca lote                   | Separate ControlMaterial doc per lot               | UI filters by lot + equipment       |

### 7.3 DICQ 4.3 Compliance Mapping

| Bloco F (Analítico)              | Donde vivem os dados                  |
| -------------------------------- | ------------------------------------- |
| 5.5.1.1 — Método descrito        | Analito.metodo + bula PDF             |
| 5.5.1.3 — CV alvo                | Analito.cvAlvo                        |
| 5.5.2 — Material controle origem | ControlMaterial.origem + Traceability |
| 5.6.2 — Regras Westgard          | westgardRules in Run.violations       |
| 5.6.3.1 — Registro de corrida    | Run doc + TraceabilityEvent           |
| 5.6.4 — Ação quando regra viola  | UI modal + approval/reject button     |

---

## 8. Phase 10 Deliverables Checklist

### 8.1 Data Structures

- [x] PHASE_10_ANALYTE_REGISTRY.json (30+ analytes, LOINC codes, Westgard thresholds)
- [x] PHASE_10_MULTI_INSTRUMENT_STRATEGY.md (this document)
- [ ] Firestore schema migration: Add `equipmentSnapshot` to Run docs
- [ ] Cloud Function: `recordRunBioquimica` with Westgard evaluation
- [ ] Cloud Function: `applyBulaToLot` (Gemini Vision parsing)

### 8.2 UI Components

- [ ] ControlMaterialSelector — filter by equipment + validade
- [ ] LeveyJenningsChart — per-equipment, method-comparison overlay
- [ ] EquipmentMetadataForm — create/edit equipment + observacoes
- [ ] RunRecordModal — capture N analytes, select equipment, review Westgard violations

### 8.3 Tests

- [ ] Unit: `evaluateWestgardRules()` with 30+ analyte scenarios
- [ ] Unit: Equipment compatibility checks (equipmentIds validation)
- [ ] E2E: Record run on Yumizen #1, verify violations, check traceability event
- [ ] E2E: Create lot with 2 equipment, verify both can use it
- [ ] Firestore Rules: Append-only traceability events, immutable runs

### 8.4 Documentation

- [ ] ADR-000X: Multi-equipment validation approach (bias tolerance, method comparison)
- [ ] CLAUDE.md update: Phase 10 plans, new rule types, equipment-related pendencies
- [ ] Training slides: CIQ supervisors — how to interpret Westgard violations across equipment

### 8.5 Deployment Gates

- [ ] TypeScript: No `any` types, strict mode for westgardEngine.ts
- [ ] Bundle: westgardEngine.ts max 20 KB gzip (utilities only, no client-side business logic)
- [ ] Lint: 0 new warnings (baseline 88 pre-existing)
- [ ] Tests: 50+ new unit tests for engine logic
- [ ] Rules test: Emulator + snapshot testing for traceability events

---

## 9. Known Limitations & Future Work

### 9.1 Phase 10 Out of Scope

1. **Extended Westgard rules** (4-1s, 10x, 6T, 6X) — remain disabled by default; enablement in v1.4
2. **Lot-equipment swap on the fly** — cannot move a used lot to a new equipment without manual override
3. **Retroactive bula application** — runs recorded before bula arrives are re-evaluated server-side, but UI doesn't show "before/after" visually
4. **Real-time IoT calibration data** — manual observacoes only; IoT integration in Phase 11+
5. **Method equivalence studies** — supervisors manually assess; no automated ANOVA

### 9.2 Deprecation Timeline

- **Client-side analito write** (createAnalito, updateAnalito) — deprecated in Phase 10, removed in Phase 10.1
- **Run import from CSV** — considered but deferred to Phase 11 (requires LIS integration testing)

### 9.3 Technical Debt

- `subscribeToState` layer for bioquimica still uses 3 direct `onSnapshot` calls (refactor in Phase 10.2)
- Seed dataset duplication (constants/seedAnalitos.ts vs. functions/seedBioquimicaDefaults.ts) — parity test needed
- Bula PDF parsing (Gemini Vision) needs fallback to manual entry if OCR confidence < 85%

---

## 10. Configuration & Deployment

### 10.1 Firestore Indexes

```
Collection: `/labs/{labId}/bioquimica/root/lotes`
Indexes:
  - equipmentIds (array), bulaPendente (ascending), deletadoEm (ascending)
  - validade (descending), deletadoEm (ascending)

Collection: `/labs/{labId}/bioquimica/root/runs`
Indexes:
  - equipmentId (ascending), criadoEm (descending)
  - equipmentId (ascending), lotId (ascending), criadoEm (descending)
  - status (ascending), criadoEm (descending)

Collection: `/labs/{labId}/bioquimica/root/traceability-events`
Indexes:
  - lotId (ascending), timestamp (descending)
  - type (ascending), timestamp (descending)
```

### 10.2 Cloud Function Deploy

```bash
# 1. Rebuild Functions with Westgard engine
npx tsc --project functions/tsconfig.json --noEmit

# 2. Size check
wc -c functions/src/modules/bioquimica/westgardEngine.ts  # expect < 10 KB source

# 3. Deploy with region + memory
firebase deploy --only functions:recordRunBioquimica \
  --region southamerica-east1

# 4. Verify callable works
curl -X POST https://southamerica-east1-hmatologia2.cloudfunctions.net/recordRunBioquimica \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"labId":"lab-001","lotId":"lot-001","equipmentId":"equip-yumizen-1","...":""}'
```

### 10.3 Rollback Plan

If Westgard evaluation breaks runs:

1. Set `config/westgard.enabled = false` (disables engine, all runs become "Pendente" until review)
2. Cloud Function logs (BigQuery) show which runs failed evaluation
3. Revert to previous function version via Firebase Console
4. Manually re-run `recordRunBioquimica` for affected runs

---

## 11. References & Normative Documents

- **RDC 978/2025** (ANVISA) — Art. 179–183, 128, 167, 180
- **DICQ 4.3** — Blocos F (Analítico)
- **CLSI EP15-A3** — User Verification of Performance for Clinical and Laboratory Measurement Devices (2014)
- **ISO 15189:2022** — Medical laboratories — Requirements for quality and competence
- **PACS-CIQ 2024** — Programa de Avaliação de Competência em Ensaios Clínicos (Brazil)
- **Westgard QC Rules** — westgard.com multi-rule QC decision tree

---

**Document Version**: 1.0 (2026-05-07)  
**Next Review**: Phase 10 final acceptance (2026-05-31)  
**Approval**: CTO + QI Director + Lab Manager
