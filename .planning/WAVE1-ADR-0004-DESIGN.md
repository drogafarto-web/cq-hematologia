# Wave 1 — ADR 0004 (POP Versionado) Design Finalization

**Date:** 2026-05-02  
**Status:** Design Complete ✓  
**Deliverables:** types.ts, versioning spec, training linkage, backfill strategy

---

## Schema Finalization

**File:** `functions/src/modules/procedimentos/types.ts` ✓ (62 lines)

### Core Entities

**POP Interface:**
- `id`, `labId`, `nome`, `codigo` (e.g., "POP-HEM-001")
- **Content:** `conteudo` {markdown, pdfUrl, versaoDocumento}
- **Versioning:** `versoes[]` (array of POPVersao)
- **Training:** `treinamentosObrigatorios[]` {modulo, tipoTreinamento, periodicidadeMeses}
- **Ownership:** `criadoEm`, `criadoPor` (uid)
- **Scope:** `modulos[]` (which modules use: ['hematologia', 'imunologia'])

**POPVersao Interface (Immutable after RT Signature):**
- `numero` (string: "1.0", "1.1", "2.0")
- `dataVigenciaInicio`, `dataVigenciaFim` (versioning window)
- `hashConteudo` (SHA-256 of markdown/PDF, immutable)
- **RT Signature:**
  - `assinadaPor.uid`, `.nome`, `.cargo`, `.timestamp`, `.hmac` (ADR 0005)
- `proximaRevisao` (Timestamp for RT to schedule next review)
- `status` ('ativa' | 'obsoleta' | 'em_revisao')
- `motivo_obsolescencia` (why marked obsolete)

**POPVersaoRef (Immutable Reference in Runs):**
- `popId`, `popVersaoNumero` (e.g., "1.1")
- `assinadaPor`, `dataAssinatura` (denormalized for audit)

**TreinamentoPOP (In Qualificacao Array):**
- `popId`, `popVersaoNumero`
- `dataConcluso`, `validoAte` (training expiration)
- `certificado_url` (optional proof)

---

## Versioning Scheme

**Semantic-like (but controlled by RT):**

```
v1.0  (Initial release) → v1.1 (minor update) → v1.2 → v2.0 (major revision)
```

**Rules:**
- Operator can create new draft version (stored as `em_revisao`)
- RT signs → version becomes `ativa`, previous `ativa` → `obsoleta`
- Old `ativa` version remains queryable (immutable) for historical runs
- New operators must train on `ativa` version
- Old operators can finish work on old version, but new work requires retraining

**Auto-Obsolescence:**
```
POP v1.0 (ativa)
   ↓ (RT signs v1.1)
POP v1.0 (obsoleta) ← Keep for audit, operators can view
POP v1.1 (ativa)    ← New operators must train on this
```

---

## Operator Training Linkage

### Training Workflow

1. **POP Released** (RT signs v1.1)
   - System notifies operators: "New POP v1.1 released. Training deadline: 30 days"
   
2. **Operator Completes Training** 
   - Record added to `Qualificacao.treinamentosPOP[]`
   - Entry: {popId, popVersaoNumero: "1.1", dataConcluso, validoAte: now+24months}
   
3. **Operator Uses POP in Run**
   - Check: `canOperadorUsarPOP(labId, uid, popId, "1.1")`
   - Verify training record exists + not expired
   - If OK: run.popReferencia = {popId, "1.1"} (immutable)
   - If NOT: Throw error "Operator not trained on POP v1.1"

4. **New Version Released (v1.2)**
   - v1.1 stays `ativa` (backward compat window: 30 days)
   - After 30 days: v1.1 → `obsoleta`
   - Operators must train on v1.2 to continue

### Enforcement Levels

**Strict Mode (Recommended):**
- Operator MUST be trained on current `ativa` version
- Cannot use `obsoleta` versions

**Grace Period (Optional, Weeks 1-4):**
- Operators can use old or new version (dual-mode)
- Messaging: "Please complete training on v1.1 by X date"

---

## 5 CIQ Module Wire-In (Wave 3)

Each module adds `popValidator.checkTrainingValid()` before **run save**:

| Module | Before Save | On Success | On Failure |
|--------|-------------|-----------|-----------|
| **Hematologia** | Check operator trained on current POP v{X} | Save run + denormalize popReferencia | Throw error "Training required" |
| **Imunologia** | Same | Same | Same |
| **Coagulacao** | Same | Same | Same |
| **Uroanalise** | Same | Same | Same |
| **Bioquimica** | Same | Same | Same |

**Denormalization in Run Doc:**
```typescript
interface CIQRun {
  // ... existing fields ...
  popReferencia?: {
    popId: string;
    popVersaoNumero: string;
    assinadaPor: string;
    dataAssinatura: Timestamp;
  };
}
```

This is **immutable after creation** — links run to exact POP version used.

---

## Backfill Strategy (Retroactive POP Wire-In)

### Current State
- 10,000+ existing CIQ runs (Hematologia, Imunologia, etc)
- No `popReferencia` (POPs didn't exist in schema)
- Runs reference procedures informally (operator knew which POP to use)

### Migration Plan

**Script:** `functions/scripts/backfill-pop-reference.mjs`

```javascript
// 1. Query all existing CIQ runs (5 modules)
// 2. For each run:
//    - Identify which POP was "active" on run.timestamp
//    - Find operator's training record on that date
//    - If match found: denormalize run.popReferencia = {popId, versao}
//    - If no match: mark as _uncovered_pop_reference (flag for manual review)
// 3. Safe: denormalization only (no breaking changes)
// 4. Validate: 95%+ coverage (fail if <90% have popReferencia)
// 5. Report: covered count, uncovered count, duration
```

**Safety Measures:**
- Dry-run first on sample (1,000 runs)
- This is denormalization only (no delete, no modify existing fields)
- Operators can have null popReferencia for legacy runs (acceptable)
- Future runs MUST have popReferencia (enforced in CF)

---

## Firestore Rules (ADR 0004 Patch)

```firestore
match /labs/{labId}/pops/{popId} {
  // Read: anyone can view POPs
  allow read: if request.auth.uid != null;
  
  // Create: admin/RT can create draft POPs
  allow create: if request.auth.uid != null &&
                   request.auth.token.admin == true;
  
  // Update: RT can update (for new versions, set status, etc)
  allow update: if request.auth.uid != null &&
                   request.auth.token.responsavelTecnico == true;

  // Versoes subcollection (immutable after RT signature)
  match /versoes/{vId} {
    allow read: if request.auth.uid != null;
    
    allow create: if request.auth.uid != null;
    
    allow update: if request.auth.uid != null &&
                     request.auth.token.responsavelTecnico == true &&
                     (request.resource.data.status == 'obsoleta' ||
                      request.resource.data.assinadaPor != null);
  }
}
```

---

## Success Criteria (Wave 1)

- [x] POP interface finalized (types.ts created)
- [x] POPVersao immutable signature scheme designed
- [x] Versioning (v1.0, v1.1, v2.0) spec documented
- [x] Training linkage to Qualificacao.treinamentosPOP[] designed
- [x] 5-module integration points identified
- [x] Backfill strategy documented (safe denormalization)
- [x] Firestore rules drafted
- [ ] CTO review & approval on design
- [ ] Any open questions resolved

---

## Next Steps (Wave 2)

1. Cloud Functions: createPOP(), createPOPVersion(), assinaturaRT(), canOperadorUsarPOP()
2. Qualificacao extension: add treinamentosPOP[] array support
3. HMAC integration with ADR 0005 helper
4. Unit tests (8+ cases)

---

**Status:** Wave 1 Complete — Ready for Wave 2  
**Commit:** "ADR 0004 Wave 1: POP schema + versioning spec finalized"
