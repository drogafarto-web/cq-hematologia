# Phase 10: Bioquímica Phase 2 — Multi-Equipment CIQ + Analyte Expansion — Research

**Researched:** 2026-05-07  
**Domain:** Clinical chemistry (biochemistry) QC; multi-instrument integration; analyte scale-up  
**Confidence:** MEDIUM-HIGH (Phase 9 foundation solid; Phase 10 scope emergent from v1.4 roadmap)

## Summary

Phase 10 extends Bioquímica Phase 1 (v1.3, 16 analitos, single-instrument model) to a **multi-equipment platform** supporting **≥50 analitos** across **≥3 instrument platforms** (Yumizen H550 primary; Roche Cobas, Abbott, Siemens as secondary targets). The phase consolidates QC rules from Phase 9 (Westgard CLSI, Levey-Jennings) with **multi-equipment validation**, **lot expiry enforcement**, **control material traceability**, and **analyte-equipment affinity mapping** — critical for RDC 978 Art. 180 (CIQ control plans) and DICQ 4.6.3 (CIQ documentation).

**Primary recommendation:** Design Phase 10 as infrastructure expansion (platform layer) + clinical module integration (coagulation, immunology, urinalysis). Multi-equipment CIQ is a cross-cutting capability, not a single module. Scope discipline critical — method validation (RDC 978 Art. 157) defers to v1.5 (XL effort).

---

## Architectural Responsibility Map

| Capability                             | Primary Tier                | Secondary Tier   | Rationale                                                                                      |
| -------------------------------------- | --------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| Multi-equipment QC engine              | Cloud Functions (callable)  | Firestore rules  | Westgard rules + statistical decisions server-side; rules enforce path isolation per equipment |
| Equipment-analyte affinity mapping     | API/Backend                 | Database         | Service layer validates that anlito X can run on equipment Y (LIS-like constraint)             |
| Lot expiry + batch tracking            | Database/Service            | API (validation) | Lot docs carregam `validadoAte`; pre-flight checks block stale lots                            |
| Control material specifications        | Database                    | Frontend (read)  | Bula-to-spec mapping lives in `/lotes/{lotId}/especificacoes`; client reads only               |
| Multi-run aggregation (Levey-Jennings) | Cloud Functions (aggregate) | Frontend (chart) | Stats computed server-side; client renders pre-computed series                                 |
| Instrument data integration (OCR)      | Cloud Functions (parser)    | Browser (upload) | Gemini Vision or equipment-specific parser; IA runs server-side                                |

---

## User Constraints (from v1.4 Roadmap)

### Locked Decisions (v1.4 Roadmap + ADRs)

1. **Multi-equipment scope:** Phase 10 focuses on **≥3 instruments validated** (coagulation, immunology, urinalysis) with multi-equipment Westgard evaluation. Bioquímica primary (H550) remains baseline; secondary instruments (Cobas, Abbott, Siemens) scoped as "Phase 10 eligible" but not mandated in Wave 1 delivery.
2. **Westgard engine:** Subset CLSI (1-2s, 1-3s, 2-2s, R-4s reject rules) deployed in Phase 9. Phase 10 does NOT add extended rules (4-1s, 10x, 6T, 6X) — kept disabled and deferred to v1.5.
3. **Lot expiry enforcement:** Soft stop if lot is past `validadoAte`; UI prevents new runs. No backfill of stale lots; operator intervention required (documented in manual).
4. **Bula-to-spec integration:** Bula PDF (Phase 9, Gemini Vision) extracts method + range. Phase 10 adds equipment-specific performance specs (accuracy, precision) from bula → `/lotes/{lotId}/especificacoes` doc.
5. **Stats threshold:** After N=20 runs per (analito, equipment, nivel), internal stats toggle available in UI (Phase 9 toggle remains, Phase 10 adds equipment selector).

### Claude's Discretion (Phase 10 Scope)

1. **Analyte expansion target:** 16 → 50+ is a goal; Phase 10 likely delivers 25–35 with operator ability to seed custom analytes (Obsidian shows coagulation, immunology, urinalysis as primary expansion targets).
2. **Equipment parser architecture:** Yumizen H550 parser (Gemini Vision) is proven Phase 9. Phase 10 can either (A) extend Gemini to all equipment (simpler, vendor lock-in risk), (B) equipment-specific parsers (complex, flexible), or (C) hybrid (Gemini for unstructured, equipment SDK for structured export). Recommend (C) with Gemini as fallback.
3. **Performance targets:** Levey-Jennings chart with 365+ data points across equipment-analyte pairs will stress browser rendering. Phase 10 should include virtual scrolling + server-side aggregation if >1000 series detected.

### Deferred to v1.5 (OUT OF SCOPE)

1. **Method validation** (RDC 978 Art. 157) — selectivity, accuracy, precision, linearity requires lab protocols + external standards. Deferred as **XL effort**, not Phase 10.
2. **Equipment SDK integration** (Roche Cobas, Abbott, Siemens direct API) — requires vendor contracts + documentation. Phase 10 may have _design_ for equipment SDK architecture, but no production implementation.
3. **CEQ PNCQ importer** — proficiency testing import from `pncq2013.pncq.org.br`. Scoped for v1.5.
4. **Equipment maintenance scheduling** (FR-11 style) — deferred to v1.5 Batch 2.

---

## Phase Requirements

| ID      | Description                                                                    | Research Support                                      |
| ------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| REQ-460 | Multi-equipment Westgard validation across ≥3 instruments                      | Phase 9 engine + equipment path isolation in rules    |
| REQ-461 | Analyte expansion: coagulation, immunology, urinalysis with equipment affinity | seedAnalitos expansion + equipment mapper service     |
| REQ-462 | Control material lot expiry enforcement + batch traceability                   | Bula integration + lot spec doc + preflight checks    |
| REQ-463 | Levey-Jennings multi-equipment chart + equipment selector                      | Chart component enhancement + server-side aggregation |
| REQ-464 | Compliance: RDC 978 Art. 180 (CIQ control plans), DICQ 4.6.3                   | Multi-equipment plan doc + audit trail                |

---

## Standard Stack

### Core (Inherited from Phase 9)

| Library             | Version         | Purpose                                   | Why Standard                                                                                 |
| ------------------- | --------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Westgard CLSI       | Phase 9 impl    | Subset QC rules (1-2s, 1-3s, 2-2s, R-4s)  | RDC 978 Art. 179 mandated; CLSI EP15 baseline                                                |
| Gemini 2.5 Flash    | 2.5 (confirmed) | OCR bula + equipment output parsing       | Cost-effective, multi-format (PDF + image), auditable                                        |
| Firestore           | 12.x (admin)    | Multi-tenant collection isolation + audit | Multi-equipment path scoping: `/labs/{labId}/bioquimica/root/runs/{runId}` + equipment index |
| React 19 + Recharts | Latest          | Levey-Jennings chart rendering            | Dark-first design system, real-time updates via `onSnapshot`                                 |

### Supporting (Phase 10 Additions)

| Library          | Version | Purpose                                      | When to Use                                                 |
| ---------------- | ------- | -------------------------------------------- | ----------------------------------------------------------- |
| `date-fns`       | 3.x     | Lot expiry validation + run date filtering   | RDC 978 Art. 181 (rastreabilidade); real-time expiry checks |
| `zod`            | 3.x     | Equipment-analyte affinity schema validation | Prevent invalid (analito, equipment) pairs before runs      |
| Puppeteer (lazy) | 22.x    | Multi-equipment report generation (PDF)      | FR-001 reports; server-side only, lazy-loaded in callable   |

### Alternatives Considered

| Instead of                      | Could Use                                       | Tradeoff                                                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini Vision for all equipment | Equipment-specific SDKs (Roche API, Abbott SDK) | Gemini = vendor neutral, cheaper, slower on structured output. SDKs = native performance, vendor lock-in, contract overhead. **Recommendation: Gemini + SDK fallback (Phase 10 design, Phase 11+ implement).** |
| Firestore Realtime aggregate    | Materialized views (Cloud SQL + Pubsub)         | Firestore = simpler rules scoping. SQL = better for heavy aggregation across 50+ analitos. **Phase 10 uses Firestore; Phase 12 may optimize with SQL if Levey-Jennings renders slowly.**                       |
| React Recharts                  | Victory, Visx, Plot.ly                          | Recharts = lightweight, dark-mode native. Victory = enterprise features (not needed Phase 10). **Stick with Recharts.**                                                                                        |

**Installation (Phase 10 additions):**

```bash
npm install date-fns@3.x zod@3.x --save
npm install --save-dev @types/date-fns
```

**Version verification (as of 2026-05-07):**

- [VERIFIED: npm registry] `date-fns@3.6.0` (latest 3.x)
- [VERIFIED: npm registry] `zod@3.23.8` (latest 3.x)
- [VERIFIED: npm registry] `recharts@2.13.2` (latest 2.x, pinned in package-lock)

---

## Architecture Patterns

### System Architecture Diagram

```
Entry Points:
  - NovaCorridaForm (user selects analito + equipment)
  - LotSwitcher (activate control material for specific equipment)
  - AnalyticsDashboard (filter by equipment)

Processing Pipeline:
  [Client: Equipment + Analito Selection]
     ↓
  [PreFlightCheck: Validate lot-equipment-analito triplet]
     ↓
  [recordRunBioquimica Callable: Westgard eval + equipment stats]
     ↓
  [Firestore: runs/{runId} + audit trail]
     ↓
  [Server Aggregation: Stats by (analito, equipment, nivel)]
     ↓
  [Client: LeveyJenningsChart (multi-equipment series)]

Decision Points:
  - Lot past expiry? → REJECT run
  - Analito not approved for equipment? → REJECT run
  - Westgard rule triggered? → Flag for review (override available)
  - >1000 series in Levey-Jennings? → Server-side aggregation + virtual scroll

External Dependencies:
  - Gemini Vision API (bula OCR, equipment output parsing)
  - Firestore Indexes (equipment + analito + nivel composite)
  - Cloud Functions region: southamerica-east1
```

### Recommended Project Structure

```
src/features/bioquimica/
├── components/
│   ├── NovaCorridaForm.tsx          (existing, multi-equipment enhanced)
│   ├── EquipamentoMultiselect.tsx    (existing, reuse)
│   ├── LeveyJenningsChart.tsx        (existing, multi-equipment series)
│   ├── LotSwitcher.tsx               (existing, equipment-specific lots)
│   ├── PreFlightCheck.tsx            (existing, enhanced validation)
│   └── EquipamentoAffinityModal.tsx  (NEW: configure analito-equipment mappings)
├── hooks/
│   ├── useActiveLotForEquipment.ts   (existing)
│   ├── useBioquimicaState.ts         (existing, may need refactor for equipment multi-select)
│   ├── useMultiEquipmentStats.ts     (NEW: fetch stats aggregated by equipment)
│   └── useEquipamentoAffinities.ts   (NEW: validate analito-equipment pairs)
├── services/
│   ├── bioquimicaService.ts          (existing, update for multi-equipment)
│   ├── analitoService.ts             (existing)
│   ├── bulaService.ts                (existing, Phase 9)
│   ├── lotService.ts                 (existing, add `validadoAte` enforcement)
│   ├── equipamentoAffinityService.ts (NEW: schema + CRUD for affinity mappings)
│   └── multiEquipmentReportService.ts (NEW: FR-001 multi-equipment report callable wrapper)
├── types/
│   ├── westgard.ts                   (existing)
│   ├── bioquimica.ts                 (existing, extend with equipment metadata)
│   └── equipamento.ts                (NEW: equipment specs + parsers)
├── constants/
│   ├── seedAnalitos.ts               (existing, expand to 25–35 analitos)
│   ├── seedEquipamentos.ts           (NEW: H550, Cobas, Abbott, Siemens specs)
│   └── westgardRulesByEquipment.ts   (NEW: equipment-specific CV targets)
└── utils/
    ├── westgardRulesCLSI.ts          (existing)
    ├── statsHelpers.ts               (existing)
    ├── equipamentoParser.ts          (NEW: unified OCR + SDK fallback)
    └── lotExpiryValidator.ts         (NEW: `validadoAte` enforcement)

functions/src/modules/bioquimica/
├── recordRunBioquimica.ts           (existing Phase 9)
├── applyBulaToLot.ts                (existing Phase 9)
├── recordTraceabilityEvent.ts        (existing Phase 9)
├── generateMonthlyReportBioquimica.ts (existing Phase 9, extend for multi-equipment)
├── aggregateMultiEquipmentStats.ts   (NEW: scheduled aggregator)
├── validateEquipamentoAffinity.ts    (NEW: pre-flight validation)
└── parseEquipamentoOutput.ts         (NEW: OCR dispatcher)
```

### Pattern 1: Multi-Equipment Run Validation

**What:** Before a run can be recorded, validate that:

1. Lot is not expired (`validadoAte` ≥ today)
2. Lot explicitly includes selected equipment in `equipmentIds[]`
3. Analito is approved for equipment (affinity mapping)
4. Lot has valid spec doc `/lotes/{lotId}/especificacoes/{equipment-analito}`

**When to use:** `PreFlightCheck` component before `recordRunBioquimica` callable.

**Example:**

```typescript
// Source: Phase 9 PreFlightCheck.tsx + Phase 10 enhancement
export async function validateMultiEquipmentRun(
  labId: string,
  lotId: string,
  equipmentId: string,
  analitoIds: string[],
): Promise<ValidationResult> {
  // 1. Fetch lot doc
  const lotDoc = await bioquimicaService.getLote(labId, lotId);

  // 2. Check expiry
  if (new Date(lotDoc.validadoAte) < new Date()) {
    return { valid: false, reason: 'Lot expired' };
  }

  // 3. Check lot includes equipment
  if (!lotDoc.equipmentIds.includes(equipmentId)) {
    return { valid: false, reason: 'Equipment not included in this lot' };
  }

  // 4. Validate affinity (analito X equipment)
  for (const analitoId of analitoIds) {
    const affinity = await equipamentoAffinityService.getAffinity(labId, analitoId, equipmentId);
    if (!affinity?.aprovado) {
      return { valid: false, reason: `Analito ${analitoId} not approved for ${equipmentId}` };
    }
  }

  return { valid: true };
}
```

### Pattern 2: Lot Expiry Enforcement (Soft Stop)

**What:** Lot past `validadoAte` cannot initiate new runs, but historical data remains readable.

**When to use:** Preflight checks + scheduled cleanup (mark expired lots as `utilizavelAte: false`).

**Example:**

```typescript
// Source: lotService + Phase 10 enhancement
export async function canUseLotForRun(labId: string, lotId: string): Promise<boolean> {
  const lote = await db.collection(`/labs/${labId}/bioquimica/root/lotes`).doc(lotId).get();

  if (!lote.exists) return false;

  const data = lote.data() as ControlMaterial;
  const isExpired = new Date(data.validadoAte) < new Date();

  return !isExpired && !data.deletadoEm;
}
```

### Pattern 3: Multi-Equipment Levey-Jennings Series

**What:** Aggregate runs by (analito, equipment, nivel, date) and render as separate series in Levey-Jennings chart.

**When to use:** LeveyJenningsChart component when equipment filter active.

**Example:**

```typescript
// Source: Phase 10 useMultiEquipmentStats.ts (new)
export function useMultiEquipmentStats(labId: string, analitoId: string, equipmentId?: string) {
  const [statsMap, setStatsMap] = useState<
    Record<string, RunStat[]> // key = "H550.1S" (equipment.nivel)
  >({});

  useEffect(() => {
    if (!analitoId) return;

    // Subscribe to runs matching analito + optional equipment
    const q = equipmentId
      ? query(
          collection(db, `/labs/${labId}/bioquimica/root/runs`),
          where('analitoIds', 'array-contains', analitoId),
          where('equipmentId', '==', equipmentId),
          orderBy('criadoEm', 'desc'),
          limit(500),
        )
      : query(
          collection(db, `/labs/${labId}/bioquimica/root/runs`),
          where('analitoIds', 'array-contains', analitoId),
          orderBy('criadoEm', 'desc'),
          limit(500),
        );

    const unsubscribe = onSnapshot(q, (snap) => {
      const grouped = new Map<string, RunStat[]>();

      snap.docs.forEach((doc) => {
        const run = doc.data() as Run;
        const key = `${run.equipmentId}.${run.nivelId}`;

        if (!grouped.has(key)) {
          grouped.set(key, []);
        }

        grouped.get(key)!.push({
          date: run.criadoEm,
          value: run.resultados[analitoId],
          westgardStatus: run.westgardStatus[analitoId],
        });
      });

      setStatsMap(Object.fromEntries(grouped));
    });

    return unsubscribe;
  }, [labId, analitoId, equipmentId]);

  return statsMap;
}
```

### Anti-Patterns to Avoid

- **Storing equipment stats in analito document:** Leads to document size bloat and multi-tenant isolation bugs. Keep stats computed in Cloud Functions, read-only in client.
- **Hardcoding equipment-analito pairs in seed data:** Use `/affinity/{analito-equipment}` docs so operators can enable/disable pairs without code redeploy.
- **Ignoring lot expiry in Levey-Jennings filters:** Stale data can skew trend analysis. Filter out runs from expired lots before aggregating stats.
- **Single lot for all equipment:** Lot should explicitly list which equipment it applies to (`equipmentIds[]`). Mixing equipment in one lot masks calibration drift per instrument.

---

## Don't Hand-Roll

| Problem                                       | Don't Build                      | Use Instead                                                                   | Why                                                                                                                                                            |
| --------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Equipment data parsing (Yumizen, Cobas, etc.) | Custom regex + CSV parser        | Gemini Vision API (Phase 9 pattern) + equipment SDK bridges (Phase 10 design) | OCR handles handwriting + noise; SDKs provide structure. Custom parsing fails on small notation changes.                                                       |
| Multi-equipment Westgard stats                | In-app JS reduce over 500+ runs  | Server-side Cloud Function aggregator                                         | Browser renderer chokes on 50+ concurrent series. Server-side aggregation (scheduled or on-demand) + materialized view pattern essential for >500 data points. |
| Lot expiry logic                              | Distributed checks in components | Centralized lotService.canUseLotForRun()                                      | Expiry rules must be uniform; scattered checks lead to soft-delete races and audit inconsistency.                                                              |
| Equipment-analyte affinity validation         | Case statement in component      | Zod schema + service layer                                                    | Affinity rules change per lab + per equipment firmware update. Schema-driven approach allows operators to update rules without code.                           |
| Levey-Jennings multi-equipment rendering      | Custom D3 multi-axis chart       | Recharts (existing) + virtual scroller (react-window)                         | Recharts handles dark theme + responsive. Virtual scroller prevents DOM thrashing with 1000+ data points.                                                      |

**Key insight:** Multi-equipment CIQ creates a 10x increase in data cardinality (analito × equipment × nivel × date). Distributed logic fails under scale. Invest in server-side aggregation + schema-driven validation early.

---

## Runtime State Inventory

**Trigger:** Phase 10 is expansion (not rename), so RN-06 is primary concern, not string replacement. However, if equipamento seed data changes or analito IDs are refactored, runtime state inventory applies.

### Scenario: Equipamento ID refactor (e.g., "H550-SN12345" → "equipment-h550-sn12345")

| Category            | Items Found                                                                                                           | Action Required                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Stored data         | Firestore `/lotes/{lotId}` docs contain `equipmentIds: ["H550-SN12345"]`; `/runs/{runId}.equipmentId: "H550-SN12345"` | Data migration: batch update all lotes + runs with new ID format. No code-only fix. |
| Live service config | None (HC Quality is web-only; no task scheduler or external equipment registry)                                       | None                                                                                |
| OS-registered state | None                                                                                                                  | None                                                                                |
| Secrets/env vars    | None (equipment IDs are not secrets)                                                                                  | None                                                                                |
| Build artifacts     | None                                                                                                                  | None                                                                                |

**If equipamento ID changes:** Migrate via callable `renameBioquimicaEquipamento()` that batch-updates lotes + runs + audit trail in transaction.

---

## Common Pitfalls

### Pitfall 1: Equipment Context Loss in Multi-Run Views

**What goes wrong:** Operator records 3 runs (1 run per equipment, same analito, same day). Levey-Jennings chart shows 3 overlapping series but doesn't visually distinguish equipment origin. User misreads trend as "same instrument, 3 replicas" instead of "3 instruments, possible calibration divergence."

**Why it happens:** LeveyJenningsChart component doesn't label series by equipment. Phase 9 prototype did single-equipment only.

**How to avoid:**

- Series name must include equipment: `"GLI H550.1S"`, `"GLI Cobas.1S"`, `"GLI Abbott.2S"`.
- Legend with equipment color coding (e.g., H550=blue, Cobas=green, Abbott=orange).
- Tooltip shows equipment on hover.

**Warning signs:** Look for queries filtering by `analitoId` only (missing equipment dimension). Pre-flight tests should include multi-equipment scenarios.

---

### Pitfall 2: Lot Expiry Race Condition

**What goes wrong:** Lot becomes expired while run is being recorded. PreFlightCheck passes (lot valid), but `recordRunBioquimica` callable executes 5 seconds later after lot was manually marked expired. Run writes succeed but should have failed.

**Why it happens:** Client-side validation is optimistic; server-side validation missing or late.

**How to avoid:**

- **Server-side source of truth:** `recordRunBioquimica` callable **must** re-validate expiry before writing.
- Code pattern: Check expiry inside callable's transaction start, not in hook.
- Test: E2E scenario where lot expires during preflight-to-submit window.

**Warning signs:** Runs with `validadoAte` < `run.criadoEm`. Cloud Logs shows runs created on expired lots.

---

### Pitfall 3: Equipment-Analyte Affinity Divergence

**What goes wrong:** Lab operator seeds analito "Glicose" and equipment "H550" without explicitly creating affinity doc. Phase 10 service assumes affinity exists (not found). Later, operator adds "Cobas" equipment. Glicose runs fail on Cobas because no affinity doc created.

**Why it happens:** Implicit affinity assumption (if both exist, they're compatible) breaks when equipment is added later. RDC 978 Art. 180 requires explicit control plans per instrument.

**How to avoid:**

- **Seed affinity docs on analito creation:** When operator adds analito via admin, for every existing equipment, create affinity doc with `aprovado: true` by default.
- **Affinity as explicit opt-out:** Operator must actively disable affinity if not valid (not leave it undefined).
- Test: After seeding new equipment, query for missing affinity docs.

**Warning signs:** Null pointer errors in `equipamentoAffinityService.getAffinity()`. SQL query showing analitos with no equipment affinity.

---

### Pitfall 4: Westgard Rule Evaluation Divergence Across Equipment

**What goes wrong:** Same analito (Glicose), same level (1S), same control material, but Westgard rules evaluated differently on H550 vs. Cobas due to different CV targets extracted from bula. H550 accepts result as valid; Cobas rejects under 2-2s rule. Operator confused why same sample has different status.

**Why it happens:** CV alvo (Phase 9 constant) is per-analito global. Phase 10 adds per-equipment CV in bula specs. Westgard engine needs to know which CV to apply — can be missed.

**How to avoid:**

- **CV sourcing explicit in callable:** `recordRunBioquimica(lotId, equipmentId, analitoIds)` must fetch CV from `/lotes/{lotId}/especificacoes/{analito-equipment}`, not from analito doc global.
- Test: Same run data evaluated on 2 equipment models with different CVs. Assert Westgard status differs iff CV differs.

**Warning signs:** Cloud Logs showing inconsistent `westgardStatus` for identical runs on different equipment. DICQ auditor flags "why did you approve H550 but reject Cobas?"

---

## Code Examples

Verified patterns from Phase 9 + Phase 10 design:

### Multi-Equipment Equipment Affinity Validation

```typescript
// Source: Phase 10 equipamentoAffinityService.ts (new)
import { db } from '@/shared/services/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { z } from 'zod';

export const EquipamentoAffinitySchema = z.object({
  labId: z.string(),
  analitoId: z.string(),
  equipmentId: z.string(),
  aprovado: z.boolean(),
  notas: z.string().optional(),
  cvAlvo: z.number().optional(), // equipment-specific override
  criadoEm: z.number(),
  atualizadoEm: z.number(),
  deletadoEm: z.number().optional(),
});

export type EquipamentoAffinity = z.infer<typeof EquipamentoAffinitySchema>;

export async function getAffinity(
  labId: string,
  analitoId: string,
  equipmentId: string,
): Promise<EquipamentoAffinity | null> {
  const docRef = doc(db, `/labs/${labId}/bioquimica/root/affinities/${analitoId}-${equipmentId}`);

  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  // Respect soft-delete
  if (data.deletadoEm) {
    return null;
  }

  return EquipamentoAffinitySchema.parse(data);
}

export async function isAnalitoApprovedForEquipment(
  labId: string,
  analitoId: string,
  equipmentId: string,
): Promise<boolean> {
  const affinity = await getAffinity(labId, analitoId, equipmentId);
  return affinity?.aprovado ?? false;
}
```

### Lot Expiry Validator

```typescript
// Source: Phase 10 lotExpiryValidator.ts (new)
import { ControlMaterial } from '../types';

export function isLotExpired(lot: ControlMaterial): boolean {
  return new Date(lot.validadoAte) < new Date();
}

export function daysUntilExpiry(lot: ControlMaterial): number {
  const now = new Date();
  const expiry = new Date(lot.validadoAte);
  return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(lot: ControlMaterial): 'expired' | 'warning' | 'valid' {
  const days = daysUntilExpiry(lot);

  if (days < 0) {
    return 'expired';
  }

  if (days < 30) {
    return 'warning';
  }

  return 'valid';
}

// Cloud Function usage (in recordRunBioquimica callable)
export function validateLotForRun(lot: ControlMaterial): void {
  if (isLotExpired(lot)) {
    throw new Error(`Lot ${lot.id} expired on ${lot.validadoAte}. Cannot record new runs.`);
  }
}
```

### Multi-Equipment Stats Aggregation (Cloud Function)

```typescript
// Source: functions/src/modules/bioquimica/aggregateMultiEquipmentStats.ts (new)
import * as admin from 'firebase-admin';
import { westgardEvaluate } from './westgardRulesCLSI';

interface AggregatedStat {
  analito: string;
  equipment: string;
  nivel: string;
  mean: number;
  stdDev: number;
  cv: number;
  count: number;
  lastUpdated: number;
}

export async function aggregateMultiEquipmentStats(
  labId: string,
  analitoId: string,
  equipmentId: string,
  nivelId: string,
): Promise<AggregatedStat> {
  const db = admin.firestore();

  // Fetch last 30 runs for this (analito, equipment, nivel)
  const runsSnap = await db
    .collection(`/labs/${labId}/bioquimica/root/runs`)
    .where('analitoIds', 'array-contains', analitoId)
    .where('equipmentId', '==', equipmentId)
    .where('nivelId', '==', nivelId)
    .orderBy('criadoEm', 'desc')
    .limit(30)
    .get();

  if (runsSnap.empty) {
    throw new Error('Insufficient data for aggregation');
  }

  const values = runsSnap.docs.map((d) => d.data().resultados[analitoId]).filter((v) => v != null);

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;

  return {
    analito: analitoId,
    equipment: equipmentId,
    nivel: nivelId,
    mean,
    stdDev,
    cv,
    count: values.length,
    lastUpdated: admin.firestore.Timestamp.now().toMillis(),
  };
}
```

---

## State of the Art

| Old Approach                                    | Current Approach                           | When Changed            | Impact                                                                          |
| ----------------------------------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------- |
| Single equipment QC (Phase 9 MVP)               | Multi-equipment CIQ with affinity mapping  | Phase 10                | Enables RDC 978 Art. 180 (control plans per instrument) + DICQ 4.6.3 compliance |
| Lot as single batch (no equipment binding)      | Lot with explicit equipmentIds[]           | Phase 9 → Phase 10      | Prevents cross-equipment lot usage; audit trail clearer                         |
| Global CV targets                               | Per-equipment CV from bula specs           | Phase 10                | Westgard rules tuned per instrument; accuracy improves                          |
| Client-side Levey-Jennings (all runs in memory) | Server-side aggregation + virtual scroller | Phase 10 if >500 series | Renders chart with 1000+ points smoothly; no UI lag                             |

**Deprecated/outdated:**

- **Single-analito seed data (Phase 9):** Phase 10 uses multi-analito seed + lab-specific custom analitos.
- **Equipment-agnostic bula parsing (Phase 9):** Phase 10 adds equipment-specific spec extraction.

---

## Assumptions Log

| #   | Claim                                                                                               | Section     | Risk if Wrong                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Yumizen H550 is primary/baseline equipment; Cobas/Abbott/Siemens are secondary targets.             | Scope       | If scope includes all 4 as equal priority, Phase 10 overruns +3 weeks. Recommend scoping to H550 MVP + Cobas design-only.                |
| A2  | Analyte expansion target is 25–35 analitos by Phase 10 end (from 16 in Phase 9).                    | Scope       | If lab needs 50+ on day 1, seed data creation becomes manual bottleneck. Consider Excel importer Phase 10.1.                             |
| A3  | Westgard rules remain Phase 9 subset (no extended rules 4-1s, 10x, 6T, 6X).                         | Locked      | If auditor requires extended rules for multi-equipment validation, Phase 10 timeline extends +1 week.                                    |
| A4  | Lot expiry enforcement is **soft stop** (UI prevents submission, not hard fail in callable).        | Locked      | If hard fail required (no overrides), authorization + audit flow adds +3 days.                                                           |
| A5  | Gemini Vision API is sufficient for all equipment OCR; no equipment SDK implementation in Phase 10. | Discretion  | If equipment vendors enforce SDK-only parsing (e.g., Roche Cobas), Phase 10 becomes blocked. Recommend async SDK evaluation in parallel. |
| A6  | Phase 10 does NOT include method validation (RDC 978 Art. 157).                                     | Deferred    | If auditor flags method validation as blocker, Phase 10 scope increases +2 weeks. Recommend pre-audit discussion.                        |
| A7  | Levey-Jennings chart supports ≤1000 data points natively; >1000 requires virtual scroller.          | Performance | If chart renders <1000 points, virtual scroller is nice-to-have. If >1000 is day-1 production load, it's required.                       |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **What equipment is Riopomba currently using?**
   - **What we know:** H550 is primary (Phase 9 parser confirmed). Secondary equipment unknown.
   - **What's unclear:** Do other Riopomba labs use Cobas, Abbott, Siemens, or other platforms?
   - **Recommendation:** Confirm via Obsidian HC_Quality_Labclin_Drive_Inventory. Scope Phase 10 based on actual lab inventory, not assumptions.

2. **How many analytes should Phase 10 deliver?**
   - **What we know:** Phase 9 = 16 seed analitos. Phase 10 = "25–35" is estimate based on coagulation, immunology, urinalysis expansion.
   - **What's unclear:** Are there existing lab-specific analitos (custom names, non-standard methods) that must seed on Phase 10 kickoff?
   - **Recommendation:** Request analito list from Riopomba before Phase 10 planning starts. If >50, scope to operator-driven custom analitos + admin UI (not hardcoded seed).

3. **What compliance gap does Phase 10 close?**
   - **What we know:** RDC 978 Art. 180 (control plans per instrument) + DICQ 4.6.3 (CIQ documentation).
   - **What's unclear:** Does auditor require method validation (RDC 978 Art. 157) as blocker, or is Phase 10 CIQ sufficient for "audit-ready"?
   - **Recommendation:** Schedule auditor pre-alignment call (Phase 2 activity in v1.4) to confirm Phase 10 scope vs. Phase 11+ scope.

4. **Should Phase 10 include equipment SDK integration or design-only?**
   - **What we know:** Gemini Vision API is production-ready (Phase 9 pattern). Equipment SDKs (Roche, Abbott, Siemens) require vendor contracts.
   - **What's unclear:** Which equipment has public API documentation? Are there license/cost implications?
   - **Recommendation:** Parallel research task (Phase 10 Week 1) to catalog equipment APIs. Scope Phase 10 as "Gemini baseline + SDK design", Phase 11 as SDK implementation.

---

## Environment Availability

| Dependency                  | Required By                          | Available             | Version                     | Fallback                                                |
| --------------------------- | ------------------------------------ | --------------------- | --------------------------- | ------------------------------------------------------- |
| Gemini 2.5 Flash API        | Equipment OCR, bula parsing          | ✓                     | 2.5 (confirmed Phase 9)     | Manual data entry                                       |
| Firestore composite indexes | Multi-equipment aggregation queries  | ✓                     | Admin SDK 12.x              | Denormalize to materialized view (Phase 12 perf tuning) |
| Firebase Cloud Functions    | Westgard eval, stats aggregation     | ✓                     | Node 22, southamerica-east1 | None (callable required by RDC 978 Art. 5.3 audit)      |
| React 19 + Recharts         | Levey-Jennings multi-equipment chart | ✓                     | React 19.x, Recharts 2.13   | Victory.js (heavier bundle, not recommended)            |
| date-fns library            | Lot expiry validation                | ✗ (Phase 10 addition) | 3.6.0 (available)           | Manual date math (error-prone)                          |

**Missing dependencies with no fallback:**

- None identified. Phase 10 is expansion, not dependent on external services unavailable today.

**Missing dependencies with fallback:**

- date-fns: fallback is manual date arithmetic (not recommended for production). Install as standard.

---

## Validation Architecture

### Test Framework

| Property           | Value                                           |
| ------------------ | ----------------------------------------------- |
| Framework          | Vitest (existing; configured in vite.config.ts) |
| Config file        | `vitest.config.ts` or `vite.config.ts` (shared) |
| Quick run command  | `npm run test:unit -- src/features/bioquimica/` |
| Full suite command | `npm run test:unit`                             |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                            | Test Type          | Automated Command                                                     | File Exists?                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| REQ-460 | Multi-equipment Westgard validation for same analito on different equipment yields different results iff CV differs | unit               | `npm run test:unit -- westgardRulesCLSI.test.ts -t "multi-equipment"` | ✅ westgardRulesCLSI.test.ts (Phase 9); needs +6 tests |
| REQ-461 | Analyte expansion seed loads 25+ analitos without duplication                                                       | unit               | `npm run test:unit -- analitoService.test.ts`                         | ❌ Wave 0 (needs creation)                             |
| REQ-461 | Equipment-analyte affinity validation blocks invalid pairs                                                          | unit               | `npm run test:unit -- equipamentoAffinityService.test.ts`             | ❌ Wave 0 (needs creation)                             |
| REQ-462 | Lot past `validadoAte` blocks new runs; historical reads allowed                                                    | unit + integration | `npm run test:unit -- lotExpiryValidator.test.ts`                     | ❌ Wave 0 (needs creation)                             |
| REQ-463 | Levey-Jennings chart filters runs by equipment correctly                                                            | unit               | `npm run test:unit -- LeveyJenningsChart.test.tsx`                    | ✅ useChartData.test.ts (Phase 9); needs enhancement   |
| REQ-464 | Audit trail records multi-equipment run metadata + Westgard status                                                  | integration        | `npm run test:unit -- bioquimicaService.test.ts`                      | ❌ Wave 0 (needs creation)                             |

### Sampling Rate

- **Per task commit:** `npm run test:unit -- src/features/bioquimica/`
- **Per wave merge:** `npm run test:unit` (full suite)
- **Phase gate:** Full suite green + 0 TypeScript errors before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/features/bioquimica/__tests__/equipamentoAffinityService.test.ts` — covers REQ-461 (affinity CRUD + validation)
- [ ] `src/features/bioquimica/__tests__/lotExpiryValidator.test.ts` — covers REQ-462 (expiry soft-stop + soft-delete)
- [ ] `src/features/bioquimica/__tests__/analitoService.test.ts` — covers REQ-461 (multi-tenant isolation + batch seed)
- [ ] `functions/test/bioquimica/aggregateMultiEquipmentStats.test.mjs` — covers REQ-460 (server-side aggregation)
- [ ] `src/features/bioquimica/__tests__/westgardRulesCLSI.test.ts` — extend with 6 multi-equipment scenarios (existing file, add cases)
- [ ] Framework install: `npm install --save-dev vitest` (already present; no action needed)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies                   | Standard Control                                                              |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| V2 Authentication     | No (auth scoped Phase 9+) | —                                                                             |
| V3 Session Management | No                        | —                                                                             |
| V4 Access Control     | Yes                       | Equipment data scoped to `labId` path; RT-only affinity edits via callable    |
| V5 Input Validation   | Yes                       | `Zod` schema for affinity + lot mutations; Firestore Rules enforce path arity |
| V6 Cryptography       | Yes (inherited Phase 9)   | HMAC chain integrity for runs + audit trail; no new crypto in Phase 10        |

### Known Threat Patterns for Multi-Equipment CIQ

| Pattern                                                                   | STRIDE                 | Standard Mitigation                                                                                                      |
| ------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Equipment affinity bypass (run analito on unapproved equipment)           | Tampering              | Validate affinity server-side in `recordRunBioquimica` callable; Firestore Rules block direct writes to runs from client |
| Lot expiry circumvention (submit run on expired lot)                      | Tampering              | Server-side `validateLotForRun()` in callable; re-check expiry at transaction boundary                                   |
| Cross-equipment data leakage (equipment A reads results from equipment B) | Information disclosure | Queries scoped by `equipmentId` + `labId` in Rules; no cross-equipment queries allowed                                   |
| Westgard rule tampering (client modifies `westgardStatus` before submit)  | Tampering              | Rules evaluate Westgard server-side; client cannot write `westgardStatus` directly (read-only field)                     |

---

## Sources

### Primary (HIGH confidence)

- Phase 9 CLAUDE.md (`src/features/bioquimica/CLAUDE.md`) — schema, locked decisions, phase context
- HC Quality v1.4 Roadmap (`HC_Quality_Roadmap.md`, Obsidian) — Phase 10 scope definition + competing streams
- Phase 9 source code — westgardRulesCLSI.ts, bioquimicaService.ts, types/westgard.ts (implementation baseline)

### Secondary (MEDIUM confidence)

- RDC 978/2025 Arts. 179–181 (CIQ requirements) — RDC text verified in Obsidian HC_Quality_RDC_978_2025_Resumo.md
- DICQ 4.3 Bloco F 5.5–5.6 (CIQ documentation) — mapped in Obsidian HC_Quality_Compliance_DICQ.md
- CLSI EP15 (Westgard rules) — Phase 9 subset documented; full standard not fetched for Phase 10 research

### Tertiary (LOW confidence)

- Equipment vendor documentation (Yumizen H550, Roche Cobas, Abbott, Siemens) — research phase only; no official docs consulted yet

---

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — Phase 9 foundation solid; Phase 10 is incremental (date-fns, zod are standard utilities).
- **Architecture:** MEDIUM-HIGH — Multi-equipment patterns are industry-standard (lab information systems); Phase 10 design sound but execution dependencies on equipment data integration remain.
- **Scope:** MEDIUM — Phase 10 deliverables ("25–35 analitos", "≥3 instruments") are estimates pending lab inventory confirmation.
- **Pitfalls:** MEDIUM-HIGH — Common errors identified (expiry race, affinity divergence, Westgard CV sourcing); preventive testing patterns clear.

**Research date:** 2026-05-07  
**Valid until:** 2026-05-21 (2 weeks; multi-equipment integration may evolve if equipment SDKs become available)

**T-shirt estimate:** Phase 10 is **MEDIUM-to-LARGE (M-L)** effort.

- Infrastructure (rules, services, types, callables): L (10 pts)
- Component enhancements (PreFlightCheck, LeveyJenningsChart, EquipamentoMultiselect): M (6 pts)
- Testing + compliance audit: M (5 pts)
- **Total: ~21 pts (3 weeks at 7 pts/week velocity)**

**Deferred to v1.5 (explicitly):**

- Method validation (RDC 978 Art. 157): XL effort, requires lab protocol design + external standard sourcing
- Equipment SDK implementation (Roche, Abbott, Siemens): L effort each, but requires vendor contracts; Phase 10 design, Phase 11+ execute
- CEQ PNCQ importer: M effort, compliance-gated by proficiency testing participation
