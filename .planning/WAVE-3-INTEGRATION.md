# ADR 0003 Wave 3 — 7-Module Integration

**Status:** Planning  
**Date:** 2026-05-02  
**Wave:** 3 / 5 (Days 7-9)  
**Owner:** gsd-executor (subagent)

---

## Overview

Wave 3 integrates the NC global spine into all 7 modules. Each module will:

1. Import `checkNCs()` from qualidade module
2. Call `checkNCs()` before any create/update operation
3. If blocking NCs exist, throw error and prevent operation
4. Log the blocking event to audit trail

**No new functions needed.** We're using the `checkNCs()` helper from Wave 2.

---

## Integration Pattern (Template)

Each module's main function (e.g., `createInsumo()`) needs:

```typescript
// At function start, BEFORE create/update
import { checkNCs } from '../qualidade/naoConformidade';

export const createInsumo = functions.https.onCall(async (data, context) => {
  const { labId, uid, ... } = data;
  
  // NEW: Check for blocking NCs
  const ncCheck = await checkNCs(labId, 'insumos'); // or 'equipamento', etc
  if (ncCheck.hasCriticalNCs) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Operações bloqueadas: ${ncCheck.message}`
    );
  }
  
  // OLD: Proceed with rest of logic
  // ... existing code ...
});
```

---

## Module-by-Module Integration

### 1. Insumos (Lots)
**File:** `functions/src/modules/insumos/index.ts`  
**Module ID:** `'insumos'`  
**NC Origen:** `'insumo'`  
**Operations to Gate:**
- `createInsumo()` — New lot receipt
- `updateInsumo()` — Update lot metadata
- `useInsumo()` (if exists) — Consume lot for test

**Temporary NC Source (Backfill):**
- Collection: `labs/{labId}/insumos/{loteId}/desvios`
- Maps to: origem='insumo', origemId=loteId

**Integration Points:**
```typescript
// In index.ts or createInsumo.ts
const ncCheck = await checkNCs(labId, 'insumos');
if (ncCheck.hasCriticalNCs) throw error;
// Proceed
```

**Testing:** E2E test
- Create Insumo with expired lot
- System auto-opens NC (future: wave 3+ enhancement)
- checkNCs returns blocking
- Try to use lot → blocked
- Verify HMAC in audit trail

---

### 2. Equipamentos (Equipment)
**File:** `functions/src/modules/equipamentos/index.ts`  
**Module ID:** `'equipamento'`  
**NC Origen:** `'equipamento'`  
**Operations to Gate:**
- `createEquipamento()` — Register new equipment
- `useEquipamento()` — Use equipment for test (if method exists)
- `calibrateEquipamento()` — Record calibration

**Temporary NC Source (Backfill):**
- Collection: `labs/{labId}/equipamentos/{equipId}/manutencao`
- Maps to: origem='equipamento', origemId=equipId

**Integration Points:**
```typescript
const ncCheck = await checkNCs(labId, 'equipamento');
if (ncCheck.hasCriticalNCs) throw error;
```

**Testing:** E2E test
- Create NC for equipment failure (critica)
- Try to use equipment → blocked
- Close NC (eficaz)
- Equipment usable again

---

### 3. Controle de Qualidade (Quality Control)
**File:** `functions/src/modules/ciqAudit/index.ts` or `qualidade/index.ts`  
**Module ID:** `'qualidade'`  
**NC Origen:** `'controle'`  
**Operations to Gate:**
- `createCQResult()` or `saveCQResult()` — Save QC test result
- `approveCQResult()` — Approve QC

**Temporary NC Source (Backfill):**
- Collection: `labs/{labId}/controleQualidade/desvios`
- Maps to: origem='controle', origemId=desvioId

**Integration Points:**
```typescript
const ncCheck = await checkNCs(labId, 'qualidade');
if (ncCheck.hasCriticalNCs) throw error;
```

**Testing:** E2E test
- Simulate QC failure
- Open NC (grave)
- Try to approve result → blocked
- Investigate + fix
- Approve result after NC closes

---

### 4. Pessoas (Personnel/Qualifications)
**File:** `functions/src/modules/pessoas/index.ts` or `insumoQualificacao/index.ts`  
**Module ID:** `'pessoas'`  
**NC Origen:** `'pessoas'`  
**Operations to Gate:**
- `recordQualificacao()` — Record personnel qualification
- `runTest()` for module — If require qualification

**Temporary NC Source (Backfill):**
- Collection: `labs/{labId}/qualificacoes/{uid}/desvios` (if exists)
- Maps to: origem='pessoas', origemId=uid

**Integration Points:**
```typescript
const ncCheck = await checkNCs(labId, 'pessoas');
if (ncCheck.hasCriticalNCs) throw error;
```

**Testing:** E2E test
- Create NC for training expiration (grave)
- Try to run test → blocked if checking qualifications
- Complete retraining
- Close NC
- Operator can run test again

---

### 5. POPs (Procedimentos)
**File:** `functions/src/modules/procedimentos/index.ts`  
**Module ID:** `'processo'`  
**NC Origen:** `'processo'`  
**Operations to Gate:**
- `createPOP()` — Create procedure
- `updatePOP()` — Update procedure
- Maybe gate usage too (Wave 4: ADR 0004 adds this)

**Temporary NC Source (Backfill):**
- Collection: TBD (may not have existing NC source)
- Will be populated by POP versioning (ADR 0004)

**Integration Points:**
```typescript
const ncCheck = await checkNCs(labId, 'processo');
if (ncCheck.hasCriticalNCs) throw error;
```

**Note:** ADR 0004 (POP Versionado) will also modify this module in parallel. Coordinate with ADR 0004 executor.

---

### 6. Evoluções / Resultados (Results)
**File:** `functions/src/modules/ciqAudit/index.ts` or equivalent  
**Module ID:** `'outro'` (or could be new 'evolucao')  
**NC Origen:** `'outro'`  
**Operations to Gate:**
- `saveResult()` — Save clinical result
- `releaseResult()` — Release result to clinician

**Temporary NC Source (Backfill):**
- May not have existing NC source (new module)
- Or could be in audit trail

**Integration Points:**
```typescript
const ncCheck = await checkNCs(labId, 'outro');
if (ncCheck.hasCriticalNCs) throw error;
```

**Note:** May need to split 'outro' into specific modules. Defer if not critical.

---

### 7. Auditoria (Audits)
**File:** TBD  
**Module ID:** `'auditoria'`  
**NC Origen:** `'outro'` (audit findings)  
**Operations to Gate:**
- `createAuditFinding()` — Record audit finding
- `closeAuditFinding()` — Close finding (if procedure exists)

**Temporary NC Source (Backfill):**
- Collection: TBD
- May not have existing source

**Integration Points:**
```typescript
const ncCheck = await checkNCs(labId, 'auditoria');
if (ncCheck.hasCriticalNCs) throw error;
```

---

## Integration Checklist

### For Each Module:
- [ ] Identify main function(s) that create/update data
- [ ] Add `checkNCs()` call at function start
- [ ] Test: Function blocks when critical NC exists
- [ ] Test: Function proceeds when no critical NC
- [ ] Error message includes NC numero + description
- [ ] Audit log: Include NC block event in operation log (optional but recommended)

### Cross-Module:
- [ ] No conflicts between module modifications (each is independent)
- [ ] All 7 modules tested together (E2E full scenario)
- [ ] Blocking unblocks correctly (NC → investigacao → correcao → verif → fechada)

### Backfill:
- [ ] Identify temporary NC collections in each module
- [ ] Update backfill-naoConformidade.mjs with correct paths
- [ ] Dry-run backfill on test lab
- [ ] Verify counts (before = after)
- [ ] Spot-check 5 backfilled NCs in Firestore
- [ ] Verify HMAC present + valid

---

## File Changes per Module

**Pattern:** Modify existing module's main file (no new files)

```
functions/src/modules/insumos/index.ts
  ├─ Add import: import { checkNCs } from '../qualidade/naoConformidade';
  ├─ Add checkNCs() call in createInsumo()
  ├─ Add checkNCs() call in updateInsumo()
  └─ ~10-15 lines added per function

functions/src/modules/equipamentos/index.ts
  └─ Same pattern (~15 lines)

functions/src/modules/ciqAudit/index.ts  (or qualidade)
  └─ Same pattern (~15 lines)

... (repeat for all 7 modules)
```

**Total lines:** ~100 lines across 7 modules (minimal changes)

---

## Backfill Script Updates

**File:** `functions/scripts/backfill-naoConformidade.mjs`

Verify and update sources array:
```javascript
const sources = [
  {
    name: 'controleQualidade/desvios',
    path: `labs/${labId}/controleQualidade/desvios`,
    moduloOrigemId: 'qualidade',
    origem: 'controle',
  },
  {
    name: 'insumos (desvios)',
    path: `labs/${labId}/insumos`,
    subcollection: 'desvios',
    moduloOrigemId: 'insumos',
    origem: 'insumo',
  },
  // Add actual paths from audit
];
```

**Execution (Wave 3):**
```bash
# Dry-run first
node functions/scripts/backfill-naoConformidade.mjs --labId=default --dry-run

# If counts match, run for real
node functions/scripts/backfill-naoConformidade.mjs --labId=default

# Check all labs
node functions/scripts/backfill-naoConformidade.mjs --labId=all
```

---

## Testing Strategy (Wave 3)

### Unit Tests per Module
```typescript
// In each module's test file
describe('NC Integration: Module X', () => {
  it('should block operation when critical NC exists', async () => {
    // Create critical NC
    const ncResp = await openNaoConformidade({
      labId,
      origem: 'insumo',
      moduloOrigemId: 'insumos',
      severidade: 'critica',
      ...
    });
    
    // Try operation → should block
    expect(() => createInsumo({labId, ...})).toThrow(/NC Bloqueada/);
  });
  
  it('should allow operation when no critical NC', async () => {
    // No NC
    const result = await createInsumo({labId, ...});
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests
```typescript
// integration.test.ts for each module
describe('E2E: Module X + NC Blocking', () => {
  it('complete workflow: create issue → NC → block → resolve → unblock', () => {
    // Full scenario for that module
  });
});
```

### Cross-Module Smoke Test
```typescript
// Overall integration test
describe('E2E: All 7 Modules + NC', () => {
  it('critical NC in one module does not affect others', async () => {
    // Create NC in Insumos (critical)
    // Verify Equipamento operations NOT blocked
    // Verify Insumos operations ARE blocked
  });
});
```

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Module function signature changed | Low | Check each module's actual API before adding gate |
| Gate breaks happy-path test | Medium | Run existing module tests after integration |
| Backfill creates duplicate NCs | Medium | Add check for `_migratedAt` flag (idempotent) |
| Performance: checkNCs() too slow | Low | Single Firestore query, should be <100ms |
| Error message unclear | Medium | Include NC numero + description in error |

---

## Deliverables (Wave 3)

1. **Module Integrations** (7 files modified, ~100 lines total)
   - Add checkNCs() gate to each module's main create/update functions
   - Tests included

2. **Backfill Script** (updated)
   - Verify paths for all 7 modules
   - Execute dry-run → full run
   - Log results

3. **Integration Tests** (new files, per module or in single file)
   - E2E: Create issue → NC → block → investigate → resolve
   - Cross-module scenarios

4. **Documentation**
   - Module integration checklist (this file)
   - Backfill runbook
   - Troubleshooting guide

---

## Timeline (Days 7-9)

**Day 7:** Identify paths + update backfill script
**Day 8:** Integrate checkNCs() into 6 modules (insumos, equipamento, qualidade, pessoas, procedimentos)
**Day 9:** Write per-module tests + integration tests + verify backfill

---

## Commit Strategy

**Commit 1:** Backfill script + module paths audit
```bash
git commit -m "ADR 0003 Wave 3a: Backfill script + module path audit"
```

**Commit 2:** NC gates in all 7 modules
```bash
git commit -m "ADR 0003 Wave 3b: Integrate checkNCs() gate into 7 modules"
```

**Commit 3:** Tests
```bash
git commit -m "ADR 0003 Wave 3c: Per-module + integration tests"
```

---

**Next:** Execute integration for each module (start with Insumos, then Equipamento, etc)
