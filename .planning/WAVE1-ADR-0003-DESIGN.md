# Wave 1 — ADR 0003 (NC Global) Design Finalization

**Date:** 2026-05-02  
**Status:** Design Complete ✓  
**Deliverables:** types.ts, backfill strategy, integration points

---

## Schema Finalization

**File:** `functions/src/modules/qualidade/types.ts` ✓ (84 lines)

### Core Entities

**NaoConformidade Interface:**
- `id`, `labId`, `numero` (NC-{YYYY}-{seq})
- **Origin:** `origem` (insumo|controle|equipamento|pessoas|processo|outro), `origemId`, `moduloOrigemId`
- **Description:** `descricao`, `severidade` (leve|grave|critica)
- **Status Machine:** `status` (aberta→investig→correcao→verif_eficacia→fechada|cancelada), `statusHistory[]`
- **CAPA Workflow:** `capa` {investigacao, acaoCorretiva, verificacaoEficacia, reabertura}
- **Traceability:** `aberta{timestamp,uid,motivo}`, `fechada{timestamp,uid,motivo}`
- **Blocking:** `bloqueiaOperacoes` (boolean), `operacoesTodasBloqueadas[]` (module names)
- **Audit:** `hmac` (ADR 0005), `previousHash` (chain), `createdAt`, `updatedAt`

### CAPA Workflow (Corrective Action Process)

**State Machine:**
```
Investigacao:
  - realizada: boolean
  - dataInicio: Timestamp (when investigation started)
  - dataFim: Timestamp (when investigation concluded)
  - descricao: string (findings)
  - investigadorId: uid (RT/supervisor)
  - achados: string[] (root causes)

AcaoCorretiva:
  - descricao: string (what action to take)
  - dataPrevista: Timestamp (when to be done)
  - dataRealizacao: Timestamp (actual completion)
  - responsavel: uid (who executes)
  - status: 'planejada' | 'em_exec' | 'concluida'
  - resultado: string (what was actually done)

VerificacaoEficacia:
  - realizada: boolean
  - resultado: 'eficaz' | 'ineficaz' | 'nao_concluida'
  - dataVerificacao: Timestamp
  - verificadoPor: uid
  - evidencia: string (how verified)
  - observacoes: string

Reabertura:
  - If eficacy check = ineficaz → status = 'investig' (restart)
  - If eficacy check = eficaz → status = 'fechada'
```

---

## NC Severity Levels & Blocking

**leve** (Minor):
- Impact: Low, limited scope
- Blocking: NO
- CAPA: Optional investigation
- Example: Documentation typo, minor process deviation

**grave** (Major):
- Impact: Affects patient safety or compliance
- Blocking: YES (auto-block originating module operations)
- CAPA: Mandatory investigation + action
- Example: Equipment calibration overdue, operator training expired

**critica** (Critical):
- Impact: Immediate safety risk or regulatory violation
- Blocking: YES (block across ALL modules until resolved)
- CAPA: Mandatory investigation + immediate action + verification
- Example: Equipment failure during analysis, contaminated reagent detected

---

## 7-Module Integration Map

Each module can **open** an NC and must **check** for NCs before operations:

| Module | Opens NC When | Check Before | Example |
|--------|---------------|--------------|---------|
| **Insumos** | Lot expired, contamination detected, quantity mismatch | Create/use Lote | Lot past expiry → open grave NC |
| **Equipamento** | Calibration overdue, maintenance issue, failure | Run test | Calibration expired → open grave NC |
| **Controle de Qualidade** | QC failure, EQA deviation, CEQ out of spec | Save QC result | QC outside control limits → open NC |
| **Pessoas** | Training expired, qualification revoked, competency issue | Perform operation | Operator qual expired → open grave NC |
| **POPs** | Procedure deviation, version obsolescence | Approve POP | POP marked obsolete → notify users |
| **Evoluções** | Result anomaly, transcription error, out-of-range value | Save evolution | Inconsistent with patient history → open leve NC |
| **Auditoria** | External audit finding, corrective action tracking | Create audit record | Inspector finding → auto-open NC |

---

## Backfill Strategy (NCTemps → NaoConformidade)

### Current State
- `NaoConformidadeTemp` scattered across collections:
  - `labs/{labId}/controleQualidade/desvios`
  - `labs/{labId}/insumos/{id}/ncHistory`
  - Module-specific temp collections

### Migration Plan

**Script:** `functions/scripts/backfill-naoConformidade.mjs`

```javascript
// 1. Query all NCTemps across modules
// 2. For each NCATemp:
//    - Determine origem from source collection
//    - Map to correct moduloOrigemId
//    - Generate numero (NC-{YYYY}-{seq})
//    - Create global NaoConformidade doc
//    - HMAC-sign via ADR 0005
//    - Copy statusHistory (keep original timestamps)
//    - Mark original as _migrated: true (don't delete)
// 3. Validate 100% of migrated NCs (chain integrity check)
// 4. Report: migrated count, errors, duration
```

**Safety Measures:**
- Dry-run first on test lab
- Verify 1:1 mapping (no data loss)
- Keep old NCTemps as read-only reference (_migrated: true)
- Halt if >5% anomalies detected
- Full audit trail of migration (who, when, count, hash)

---

## Firestore Rules (ADR 0003 Patch)

```firestore
match /labs/{labId}/nao-conformidades/{ncId} {
  // Create: anyone authenticated can open NC, but HMAC required
  allow create: if request.auth.uid != null &&
                   request.resource.data.numero != null &&
                   request.resource.data.descricao != null &&
                   request.resource.data.severidade in ['leve', 'grave', 'critica'] &&
                   request.resource.data.hmac != null;

  // Read: anyone in lab can read all NCs
  allow read: if request.auth.uid != null;

  // Update: RT or admin can update (for CAPA workflow)
  allow update: if request.auth.uid != null &&
                   (request.auth.token.responsavelTecnico == true ||
                    request.auth.token.admin == true);

  // Audit trail subcollection
  match /statusHistory/{entryId} {
    allow create, read: if request.auth.uid != null;
  }
}
```

---

## Success Criteria (Wave 1)

- [x] NaoConformidade interface finalized (types.ts created)
- [x] CAPA workflow state machine designed
- [x] NC origins mapped to 7 modules
- [x] Backfill strategy documented (dry-run → full → validate)
- [x] Firestore rules drafted
- [ ] CTO review & approval on design
- [ ] Any open questions resolved

---

## Next Steps (Wave 2)

1. Cloud Functions: openNaoConformidade(), updateNaoConformidade(), applyCAPAwithValidation()
2. HMAC integration with ADR 0005 helper
3. Unit tests (8+ cases)

---

**Status:** Wave 1 Complete — Ready for Wave 2  
**Commit:** "ADR 0003 Wave 1: Schema finalized + backfill strategy"
