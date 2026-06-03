# Phase 10 Implementation Guide for Engineers

**Quick-start checklist for Phase 10 features.**

---

## 1. Load Analyte Registry into Firestore

### 1.1 Parse and validate JSON

```bash
# Verify structure
python3 -c "
import json
with open('PHASE_10_ANALYTE_REGISTRY.json') as f:
    reg = json.load(f)
    print(f'Total analytes: {len(reg[\"registry\"][\"analytes\"])}')
    for a in reg['registry']['analytes'][:3]:
        print(f'  - {a[\"analyteName\"]} ({a[\"analyteCode\"]})')
"
```

### 1.2 Seed Firestore

Create a Cloud Function `seedPhase10Analytes` (or extend existing `seedBioquimicaDefaults`):

```typescript
import { PHASE_10_ANALYTE_REGISTRY } from '../registry/phase10AnalyteRegistry';

exports.seedPhase10Analytes = functions
  .region('southamerica-east1')
  .https.onCall(async (req, ctx) => {
    const labId = req.labId || throwError('Missing labId');
    await verifyMembership(ctx.auth?.uid, labId);

    const batch = db.batch();

    for (const analyteData of PHASE_10_ANALYTE_REGISTRY.registry.analytes) {
      const analitoRef = db
        .collection(`/labs/${labId}/bioquimica/root/analitos`)
        .doc(analyteData.id);

      // Check idempotency
      const existing = await analitoRef.get();
      if (existing.exists) continue;

      batch.set(analitoRef, {
        labId,
        nome: analyteData.analyteName,
        sigla: analyteData.sigla,
        unidade: analyteData.unidade,
        unidadeSI: analyteData.unidadeSI,
        rangeBiologico: analyteData.normalRange,
        metodo: analyteData.metodo,
        cvAlvo: analyteData.cvAlvo,
        ativo: analyteData.ativo,
        seedDefault: analyteData.seedDefault,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        deletadoEm: null,
        // Phase 10: add LOINC code for interoperability
        loincCode: analyteData.analyteCode,
        // Phase 10: add Westgard metadata
        westgardConfig: {
          activeRules: analyteData.westgardRules.active,
          extendedRulesAvailable: analyteData.westgardRules.extended.available,
          enabled: true,
        },
      });
    }

    await batch.commit();
    return { seeded: PHASE_10_ANALYTE_REGISTRY.registry.analytes.length };
  });
```

---

## 2. Implement Westgard Engine

### 2.1 Create utility file

**File**: `src/features/bioquimica/utils/westgardRulesCLSI.ts`

```typescript
import type { RunResultados, WestgardViolation, ControlMaterial, Analito, Run } from '../types';

export function evaluateWestgardRules(
  runResultados: RunResultados,
  controlMaterial: ControlMaterial,
  analitos: Analito[],
  previousRuns: Run[] = [],
): WestgardViolation[] {
  const violations: WestgardViolation[] = [];

  for (const [analitoId, nivelResults] of Object.entries(runResultados)) {
    const analito = analitos.find((a) => a.id === analitoId);
    if (!analito?.ativo) continue;

    for (const [nivelId, value] of Object.entries(nivelResults)) {
      const manStats = controlMaterial.manufacturerStats?.[analitoId]?.[nivelId];
      if (!manStats) continue; // No stats yet

      const { mean, sd } = manStats;
      const deviation = (value - mean) / sd;

      // Rule 1-2s: warn
      if (Math.abs(deviation) > 2.0) {
        violations.push({
          rule: '1-2s',
          analitoId,
          nivelId,
          severity: 'warn',
          detail: `1 result: ${Math.abs(deviation).toFixed(1)}σ from mean`,
        });
      }

      // Rule 1-3s: reject
      if (Math.abs(deviation) > 3.0) {
        violations.push({
          rule: '1-3s',
          analitoId,
          nivelId,
          severity: 'reject',
          detail: `1 result: ${Math.abs(deviation).toFixed(1)}σ > 3σ (out of spec)`,
        });
      }

      // Rule 2-2s: 2 consecutive same side of 2σ
      if (previousRuns.length > 0) {
        const lastRun = previousRuns[0];
        const lastManStats = controlMaterial.manufacturerStats?.[analitoId]?.[nivelId];
        if (lastManStats) {
          const lastDev =
            (lastRun.resultados[analitoId][nivelId] - lastManStats.mean) / lastManStats.sd;
          if (
            Math.abs(deviation) > 2.0 &&
            Math.abs(lastDev) > 2.0 &&
            Math.sign(deviation) === Math.sign(lastDev)
          ) {
            violations.push({
              rule: '2-2s',
              analitoId,
              nivelId,
              severity: 'reject',
              detail: `2 consecutive runs > 2σ, same side — drift`,
            });
          }
        }
      }

      // Rule R-4s: range between 2 consecutive > 4σ
      if (previousRuns.length > 0) {
        const lastRun = previousRuns[0];
        const lastManStats = controlMaterial.manufacturerStats?.[analitoId]?.[nivelId];
        if (lastManStats) {
          const lastValue = lastRun.resultados[analitoId][nivelId];
          const range = Math.abs(value - lastValue);
          const rangeInSd = range / (2 * manStats.sd);
          if (rangeInSd > 4.0) {
            violations.push({
              rule: 'R-4s',
              analitoId,
              nivelId,
              severity: 'reject',
              detail: `Range between 2 runs: ${rangeInSd.toFixed(1)}σ — precision loss`,
            });
          }
        }
      }
    }
  }

  return violations;
}

export const isCriticalViolation = (v: WestgardViolation): boolean => v.severity === 'reject';

export const hasWarnings = (violations: WestgardViolation[]): boolean =>
  violations.some((v) => v.severity === 'warn');
```

### 2.2 Unit tests

**File**: `functions/test/bioquimica/westgardEngine.test.ts`

```typescript
import { expect } from 'chai';
import { evaluateWestgardRules } from '../../src/modules/bioquimica/westgardEngine';

describe('Westgard Rules (CLSI subset)', () => {
  const mockAnalito = {
    id: 'glic-001',
    nome: 'Glicose',
    ativo: true,
    // ... minimal fields
  };

  const mockControlMaterial = {
    id: 'lot-001',
    manufacturerStats: {
      'glic-001': {
        normal: { mean: 95, sd: 2 },
        patologico: { mean: 250, sd: 10 },
      },
    },
  };

  it('should trigger 1-2s warn for 2.1σ deviation', () => {
    const run = { 'glic-001': { normal: 99.2 } }; // 95 + 2.1*2 = 99.2
    const violations = evaluateWestgardRules(run, mockControlMaterial, [mockAnalito]);
    expect(violations).to.have.lengthOf(1);
    expect(violations[0].rule).to.equal('1-2s');
    expect(violations[0].severity).to.equal('warn');
  });

  it('should trigger 1-3s reject for 3.1σ deviation', () => {
    const run = { 'glic-001': { normal: 101.2 } }; // 95 + 3.1*2 = 101.2
    const violations = evaluateWestgardRules(run, mockControlMaterial, [mockAnalito]);
    expect(violations.some((v) => v.rule === '1-3s' && v.severity === 'reject')).to.be.true;
  });

  it('should trigger 2-2s reject for 2 consecutive same-side 2σ', () => {
    const run1 = { 'glic-001': { normal: 99 } }; // +2σ
    const run2 = { 'glic-001': { normal: 99.5 } }; // +2.25σ
    const previousRuns = [
      {
        resultados: run1,
        // ... other fields
      },
    ];
    const violations = evaluateWestgardRules(
      run2,
      mockControlMaterial,
      [mockAnalito],
      previousRuns,
    );
    expect(violations.some((v) => v.rule === '2-2s')).to.be.true;
  });

  // ... add 20+ more scenarios
});
```

---

## 3. Update Firestore Rules

### 3.1 Equipment validation in ControlMaterial

**File**: `firestore.rules` (section: `/bioquimica/lotes`)

```firestore
match /labs/{labId}/bioquimica/root/lotes/{lotId} {
  allow create, update: if
    isActiveMemberOfLab(request.auth.uid, labId) &&
    request.resource.data.labId == labId &&
    allEquipmentIdsAreValid(request.resource.data.equipmentIds, labId);
  allow read: if isActiveMemberOfLab(request.auth.uid, labId);
  allow delete: if false;
}

// Helper function
function allEquipmentIdsAreValid(equipmentIds, labId) {
  // Pseudo-code: verify each equipmentId references a valid, active equipment doc
  // Actual implementation: use exists() checks in a loop
  return equipmentIds.size() > 0;  // simplified; expand with real validation
}
```

### 3.2 Runs immutable post-signature

```firestore
match /labs/{labId}/bioquimica/root/runs/{runId} {
  allow create: if false;  // only via callable
  allow read: if isActiveMemberOfLab(request.auth.uid, labId);
  allow update, delete: if false;

  // Compliance overrides in a sub-collection (tracked separately)
  match /overrides/{overrideId} {
    allow create: if
      isAdminOfLab(request.auth.uid, labId) &&
      request.resource.data.runId == runId;
    allow read: if isActiveMemberOfLab(request.auth.uid, labId);
    allow update, delete: if false;
  }
}
```

---

## 4. Create Cloud Function: recordRunBioquimica

**File**: `functions/src/modules/bioquimica/recordRunBioquimica.ts`

```typescript
import * as functions from 'firebase-functions';
import { db, admin } from '../../admin';
import { evaluateWestgardRules } from './westgardEngine';
import { computeLogicalSignature, computeChainHash } from '../../shared/crypto';

export const recordRunBioquimica = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // 1. Auth & multi-tenant
    const userId = context.auth?.uid || throwError('Unauthenticated');
    const { labId, lotId, equipmentId, capturaEm, resultados } = data;

    if (!labId || !lotId || !equipmentId) {
      throwError('Missing required fields');
    }

    const userLabId = await verifyMembership(userId, labId);
    if (userLabId !== labId) throwError('Unauthorized lab');

    // 2. Load control material
    const lotDoc = await db.doc(`/labs/${labId}/bioquimica/root/lotes/${lotId}`).get();
    if (!lotDoc.exists) throwError('Lot not found', 404);
    const lot = lotDoc.data();

    // 3. Verify equipment is in lot's equipmentIds
    if (!lot.equipmentIds.includes(equipmentId)) {
      throwError('Equipment not authorized for this lot');
    }

    // 4. Load analytes
    const analytesSnap = await db
      .collection(`/labs/${labId}/bioquimica/root/analitos`)
      .where('ativo', '==', true)
      .get();
    const analitos = analytesSnap.docs.map((d) => d.data());

    // 5. Load previous runs (last 5 for this analyte-level-equipment combo)
    // (Optimization: query by index)
    const prevRunsSnap = await db
      .collection(`/labs/${labId}/bioquimica/root/runs`)
      .where('equipmentId', '==', equipmentId)
      .where('lotId', '==', lotId)
      .orderBy('criadoEm', 'desc')
      .limit(5)
      .get();
    const previousRuns = prevRunsSnap.docs.map((d) => d.data());

    // 6. Evaluate Westgard
    const violations = evaluateWestgardRules(resultados, lot, analitos, previousRuns);

    // 7. Determine status
    const hasReject = violations.some((v) => v.severity === 'reject');
    const status = hasReject ? 'Rejeitada' : violations.length ? 'Pendente' : 'Aprovada';

    // 8. Compute signature (server-side)
    const payloadHash = computeHash(JSON.stringify(resultados));
    const signature = {
      hash: payloadHash,
      operatorId: userId,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 9. Compute chain hash (encadeamento criptográfico ADR-0001)
    const lastRunDoc = previousRuns.length ? previousRuns[0] : null;
    const lastChainHash = lastRunDoc?.chainHash || '';
    const chainHash = computeChainHash(lastChainHash, signature.hash, labId, lotId);

    // 10. Atomic transaction
    const runRef = db.collection(`/labs/${labId}/bioquimica/root/runs`).doc();
    const batch = db.batch();

    batch.set(runRef, {
      labId,
      equipmentId,
      lotId,
      operatorId: userId,
      capturaEm: new admin.firestore.Timestamp(capturaEm.seconds, capturaEm.nanoseconds),
      resultados,
      violations,
      status,
      aproveitamento: hasReject ? 'informativa' : 'oficial',
      signature,
      chainHash,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Append traceability event
    const eventRef = db.collection(`/labs/${labId}/bioquimica/root/traceability-events`).doc();
    batch.set(eventRef, {
      labId,
      type: 'run-recorded',
      runId: runRef.id,
      lotId,
      equipmentId,
      signature,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      runId: runRef.id,
      status,
      violations,
      aproveitamento: hasReject ? 'informativa' : 'oficial',
    };
  });

function throwError(msg: string, code: number = 400) {
  throw new functions.https.HttpsError(code === 404 ? 'not-found' : 'invalid-argument', msg);
}
```

---

## 5. Build UI Components

### 5.1 ControlMaterialSelector

```typescript
// hooks/useControlMaterials.ts
export function useControlMaterials(equipmentId: string) {
  const labId = useActiveLabId();
  const [lots, setLots] = useState<ControlMaterial[]>([]);

  useEffect(() => {
    const unsubscribe = db
      .collection(`/labs/${labId}/bioquimica/root/lotes`)
      .where('equipmentIds', 'array-contains', equipmentId)
      .where('bulaPendente', '==', false)
      .where('validade', '>', new Date())
      .orderBy('validade')
      .onSnapshot(
        (snap) => setLots(snap.docs.map((d) => d.data())),
        (err) => console.error(err),
      );

    return unsubscribe;
  }, [labId, equipmentId]);

  return { lots };
}
```

### 5.2 LeveyJenningsChart

```typescript
interface LJChartProps {
  analitoId: string;
  nivelId: string;
  equipmentId: string;
}

export function LeveyJenningsChart({ analitoId, nivelId, equipmentId }: LJChartProps) {
  const labId = useActiveLabId();
  const [data, setData] = useState<LeveyJenningsDataEquipment>();

  useEffect(() => {
    // Query runs for this (analitoId, nivelId, equipmentId)
    const unsubscribe = db
      .collection(`/labs/${labId}/bioquimica/root/runs`)
      .where('equipmentId', '==', equipmentId)
      .orderBy('capturaEm', 'desc')
      .limit(30)
      .onSnapshot(snap => {
        const runs = snap.docs.map(d => d.data());
        const points = runs
          .filter(r => r.resultados[analitoId]?.[nivelId])
          .map(r => ({
            runId: r.id,
            capturaEm: r.capturaEm,
            value: r.resultados[analitoId][nivelId],
            status: r.status,
          }));

        // Compute mean, SD, etc.
        const values = points.map(p => p.value);
        const mean = values.reduce((a, b) => a + b) / values.length;
        const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2) / values.length);

        setData({ points, mean, sd, /* ... */ });
      });

    return unsubscribe;
  }, [labId, analitoId, nivelId, equipmentId]);

  if (!data) return <Skeleton />;

  return (
    <LineChart data={data.points}>
      <Line stroke="#8b5cf6" dataKey="value" />
      <Line stroke="gray" dataKey={() => data.mean} strokeDasharray="4" />
      <Line stroke="rgba(0,0,0,0.1)" dataKey={() => data.mean + 2 * data.sd} />
      <Line stroke="rgba(0,0,0,0.1)" dataKey={() => data.mean - 2 * data.sd} />
    </LineChart>
  );
}
```

---

## 6. Testing Checklist

### 6.1 Unit Tests (westgardEngine)

- [ ] 1-2s rule for various deviations (1.5σ, 2.0σ, 2.5σ)
- [ ] 1-3s rule for > 3σ
- [ ] 2-2s rule with same-side consecutive runs
- [ ] R-4s rule with range calculations
- [ ] Empty violations for good runs
- [ ] Multiple analytes in single run
- [ ] Multiple levels (normal, pathological)

### 6.2 E2E Tests (Firestore emulator)

- [ ] Create ControlMaterial with 2 equipment
- [ ] Record run on Equipment A, verify Westgard violations
- [ ] Record run on Equipment B, verify independent stats
- [ ] Check TraceabilityEvent created
- [ ] Verify run is immutable post-signature
- [ ] Query lot by equipmentId
- [ ] Soft-delete lot (set archivedAt)

### 6.3 Integration Tests

- [ ] Call `recordRunBioquimica` via Firebase Emulator Suite
- [ ] Verify status field (Aprovada/Pendente/Rejeitada)
- [ ] Verify chainHash encadeamento (hash of previous run included)
- [ ] Verify signature computed server-side

---

## 7. Deployment Checklist

- [ ] TypeScript: `npx tsc --noEmit` (no `any`)
- [ ] Lint: `npm run lint` (88 baseline warnings tolerated)
- [ ] Tests: `npm test` (50+ new westgard tests pass)
- [ ] Bundle size: westgardEngine < 20 KB gzip
- [ ] Firestore indexes created (equipmentIds array, validade, etc.)
- [ ] Cloud Function deployed: `firebase deploy --only functions:recordRunBioquimica`
- [ ] Rules deployed: `firebase deploy --only firestore:rules`
- [ ] Smoke test: Create lot, record run, verify violations in console
- [ ] Rollback plan documented (disable westgard via config flag)

---

## 8. File Structure Summary

```
src/features/bioquimica/
├── utils/
│   └── westgardRulesCLSI.ts          ← NEW: Westgard logic (20 KB max)
├── hooks/
│   └── useControlMaterials.ts        ← NEW: Load lots by equipment
├── components/
│   ├── ControlMaterialSelector.tsx   ← NEW: Dropdown lot selector
│   ├── LeveyJenningsChart.tsx        ← NEW: Timeseries + σ bands
│   └── ...
├── types/
│   └── (update westgard.ts if needed)
└── ...

functions/src/modules/bioquimica/
├── recordRunBioquimica.ts            ← NEW: Callable + Westgard
├── applyBulaToLot.ts                 ← NEW: Gemini Vision (Phase 10)
├── westgardEngine.ts                 ← NEW: Core logic
└── ...

functions/test/bioquimica/
├── westgardEngine.test.ts            ← NEW: 50+ scenarios
└── recordRunBioquimica.test.ts       ← NEW: E2E via emulator

.planning/phases/10-analytes/
├── PHASE_10_ANALYTE_REGISTRY.json    ← DELIVERED
├── PHASE_10_MULTI_INSTRUMENT_STRATEGY.md ← DELIVERED
├── README.md                         ← DELIVERED
└── IMPLEMENTATION_GUIDE.md           ← THIS FILE
```

---

**Version**: 1.0  
**Date**: 2026-05-07  
**Status**: Ready for Phase 10 implementation sprint
