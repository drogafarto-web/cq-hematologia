# ADR 0004 — POP Versionado / Documento Vigente

**Status:** Design Phase (Wave 1 — Draft)  
**Date:** 2026-05-02  
**Author:** Engineer (Claude Code)  
**Related Issues:** V-004, V-011 (POP traceability, operator training)  
**Depends on:** ADR 0005 (HMAC signatures) ✓

---

## Problem Statement

**V-004:** POP (Standard Operating Procedures) versioning is informal:

- POPs exist in various formats (PDF, docs, shared drives)
- No formal versioning (v1.0, v1.1) or version control
- RT signature not mandatory before operator use
- Operators can use expired or obsolete POPs without detection
- No audit trail showing which POP version was used during a specific run

**V-011:** Operator training on POPs not tracked:

- Training records scattered across documents, emails, manual logs
- No linkage from training → POP version → operator → run
- Compliance gap: Can't prove operator was trained on POP X when running procedure on date Y
- RDC 978 § 8.5.5 requires: "Pessoal deve estar devidamente treinado e qualificado"

**Impact:**

- Regulatory findings on audits (especially RDC 978 + LGPD audit trails)
- Inability to trace back quality issues to operator knowledge gaps
- No evidence of training compliance
- Difficult CAPA closure (can't verify training adequacy)

---

## Solution Design

### 1. Schema: POP (Procedure Document)

```typescript
interface POP {
  id: string; // auto-generated Firestore ID
  labId: string; // FK to lab
  nome: string; // e.g., "Hemograma - Sysmex XN-1000"
  codigo: string; // e.g., "POP-HEM-001" (unique per lab)

  // Content
  conteudo: {
    markdown?: string; // Inline procedure text
    pdfUrl?: string; // GCS link to PDF
  };

  // Current active version reference
  versaoAtivaNumero?: string; // "1.0", "1.1", "2.0" (null until first signed)

  // Versioning
  versoes: POPVersao[]; // Array of all versions (immutable after signing)

  // Training requirements
  treinamentosObrigatorios: Array<{
    modulo: string; // 'hematologia', 'imunologia', 'coagulacao', 'uroanalise', 'bioquimica'
    tipoTreinamento: 'inicial' | 'reciclagem';
    periodicidadeMeses: number; // e.g., 24 for biennal refresher
  }>;

  // Scope (which modules reference this POP)
  modulos: string[]; // ['hematologia', 'imunologia'] etc

  // Audit
  criadoEm: Timestamp;
  criadoPor: string; // uid (admin/RT)
}

interface POPVersao {
  numero: string; // "1.0", "1.1", "2.0" (semver-like)

  // Validity period
  dataVigenciaInicio: Timestamp; // When this version becomes active
  dataVigenciaFim: Timestamp; // When this version expires (usually 2 years)

  // Content integrity
  hashConteudo: string; // SHA-256 hash (immutable, prevents tampering)

  // RT Signature (mandatory before use)
  assinadaPor?: {
    uid: string; // RT uid
    nome: string; // RT name
    cargo: string; // Role/title
    timestamp: Timestamp;
    hmac: string; // ADR 0005 signature
  };

  // Status lifecycle
  status: 'em_revisao' | 'ativa' | 'obsoleta';

  // Obsolescence tracking
  motivo_obsolescencia?: string; // e.g., "Substituído por v1.1"
  dataObsolescencia?: Timestamp;

  // Next review date (compliance tracking)
  proximaRevisao: Timestamp;
}

// Extension to Qualificacao (ADR 0006)
// Add to existing Qualificacao interface in pessoas/types.ts:
interface Qualificacao {
  // ... existing fields from ADR 0006 ...

  // NEW: Training on POPs
  treinamentosPOP?: Array<{
    popId: string; // FK to POP doc
    popVersaoNumero: string; // e.g., "1.0", "1.1"
    dataConcluso: Timestamp; // When operator completed training
    validoAte: Timestamp; // Training expires after periodicidade months
    certificado_url?: string; // GCS link to training certificate
  }>;
}

// Denormalized in CIQ runs for audit trail (immutable after creation)
interface POPReferencia {
  popId: string;
  popVersaoNumero: string; // e.g., "1.0"
  assinadaPor: string; // uid of RT who signed
  dataAssinatura: Timestamp;
}
```

### 2. Versioning Strategy

**Auto-increment logic:**

- **Minor version (v1.0 → v1.1):** Bug fixes, clarifications, non-breaking changes
  - Triggered by: Operator update to POP content with RT review
  - Operators on v1.0 CAN upgrade to v1.1 (backward compatible)
- **Major version (v1.1 → v2.0):** Significant procedure changes, new equipment, breaking changes
  - Triggered by: RT manual override (calls assinaturaRT with major=true)
  - Operators on v1.x CANNOT use v2.0 until retrained
  - Old version auto-marked `obsoleta` when new major version signed

**Semver-like:** `{major}.{minor}` where:

- `1.0` = first release
- `1.1` = first maintenance update
- `2.0` = major revision

**Automatic obsolescence:**

- When RT signs a new version, ALL prior versions with same major version become `obsoleta`
- Example: v1.0 active → RT signs v1.1 → v1.0 auto-marked obsoleta
- Operators can only use versions with `status = 'ativa'`

### 3. Training & Operator Gate

```typescript
// Validator function (used before saving CIQ runs)
async function canOperadorUsarPOP(
  labId: string,
  uid: string,
  popId: string,
  popVersaoAtual: string, // e.g., "1.0"
): Promise<{ allowed: boolean; reason?: string }> {
  // Step 1: Fetch current Qualificacao for operator
  const quals = await db.collection(`labs/${labId}/qualificacoes`).where('uid', '==', uid).get();

  if (quals.empty) {
    return { allowed: false, reason: 'Operator has no qualifications' };
  }

  // Step 2: Find training record for this POP version
  const qual = quals.docs[0].data() as Qualificacao;
  const popTraining = qual.treinamentosPOP?.find(
    (t) => t.popId === popId && t.popVersaoNumero === popVersaoAtual,
  );

  if (!popTraining) {
    return {
      allowed: false,
      reason: `Operator not trained on POP version ${popVersaoAtual}`,
    };
  }

  // Step 3: Check training validity (not expired)
  if (new Date(popTraining.validoAte.toDate()) < new Date()) {
    return {
      allowed: false,
      reason: `Training on POP v${popVersaoAtual} expired on ${popTraining.validoAte.toDate().toLocaleDateString()}`,
    };
  }

  return { allowed: true };
}
```

### 4. CIQ Run Integration

Every CIQ run (Hematologia, Imunologia, Coagulacao, Uroanalise, Bioquimica) must:

**Before saving:**

- Call `canOperadorUsarPOP(labId, uid, popId, popVersaoAtual)`
- If training missing/expired: throw error `'Operator not trained on POP v{x}'`

**On save (denormalization):**

```typescript
interface RunCIQ {
  // ... existing fields ...
  popReferencia?: POPReferencia; // NEW: immutable reference to POP version used
  // popReferencia = { popId, popVersaoNumero, assinadaPor, dataAssinatura }
}
```

This denormalization ensures:

- Historical immutability (can't change POP version after run is created)
- Audit trail (which operator used which POP version on which date)
- Fast lookups (no FK traversal needed in reports)

### 5. Workflow: Create POP → RT Sign → Operator Train → Use in Run

```
┌─────────────────────────────────────┐
│ Admin creates/updates POP           │
│ - Update markdown/PDF               │
│ - Set treinamentosObrigatorios      │
└────────────┬────────────────────────┘
             │
     ┌───────▼────────────────────────┐
     │ createPOPVersion()              │
     │ - Compute hashConteudo (SHA256) │
     │ - Set numero = "1.0" (if first) │
     │ - Set vigenciaInicio = now      │
     │ - Set vigenciaFim = now + 2yr   │
     │ - Set status = 'em_revisao'     │
     └───────┬────────────────────────┘
             │
     ┌───────▼────────────────────────┐
     │ RT reviews POP                  │
     │ (dashboard notification)        │
     └───────┬────────────────────────┘
             │
     ┌───────▼────────────────────────┐
     │ assinaturaRT() [RT-only callable]│
     │ - Verify RT permission          │
     │ - Sign hashConteudo via ADR 0005│
     │ - Set assinadaPor + hmac        │
     │ - Set status = 'ativa'          │
     │ - Auto-mark old version obso.   │
     └───────┬────────────────────────┘
             │
     ┌───────▼────────────────────────┐
     │ Schedule Training Event         │
     │ - Notify operators: "POP v1.0   │
     │   requires training"            │
     │ - Set deadline (e.g., 14 days)  │
     └───────┬────────────────────────┘
             │
     ┌───────▼────────────────────────┐
     │ Operador trains on POP v1.0     │
     │ recordarTreinamentoPOP()        │
     │ - Add to Qualificacao.training  │
     │ - validoAte = now + 24 meses    │
     │ - Certificate PDF/timestamp     │
     │ - Audit: logged via ADR 0005    │
     └───────┬────────────────────────┘
             │
     ┌───────▼────────────────────────┐
     │ Run CIQ test                    │
     │ beforeRunSave():                │
     │   canOperadorUsarPOP()?         │
     │   if !allowed → throw error     │
     │   if allowed → denormalize      │
     │   popReferencia = {popId,v1.0}  │
     └───────┬────────────────────────┘
             │
             ▼
     ┌─────────────────────────────────┐
     │ Run saved w/ POP trace          │
     │ Fully auditable + compliant     │
     └─────────────────────────────────┘
```

### 6. Firestore Rules (Security)

```
match /labs/{labId}/pops/{popId} {
  // Allow create/read by any lab member
  allow create: if request.auth.uid != null &&
                   request.resource.data.labId == labId &&
                   request.resource.data.codigo != null &&
                   request.resource.data.nome != null;

  allow read: if request.auth.uid != null;

  // Only RT can update POP (e.g., content updates)
  allow update: if request.auth.uid != null &&
                   request.auth.token.responsavelTecnico == true;

  // Prevent deletion (compliance requirement)
  allow delete: if false;
}

match /labs/{labId}/pops/{popId}/versoes/{vId} {
  // Allow read by any member
  allow read: if request.auth.uid != null;

  // Allow create (new versions can be drafted)
  allow create: if request.auth.uid != null;

  // Only RT can sign (update status to 'ativa')
  allow update: if request.auth.uid != null &&
                   request.auth.token.responsavelTecnico == true &&
                   (request.resource.data.status == 'ativa' ||
                    request.resource.data.assinadaPor != null);

  allow delete: if false;
}
```

---

## Migration Strategy

### Backfill Existing Runs

For all CIQ runs created BEFORE POP versioning:

1. Query all runs in Hematologia, Imunologia, Coagulacao, Uroanalise, Bioquimica
2. Identify which POP was "probably" used:
   - Check `operador.qualificacoes` at time of run (via audit trail)
   - If single POP version applies: assign `popReferencia`
   - If ambiguous: assign with `_uncertain: true` flag (manual review needed)
3. Denormalize safely (only adds new field, no breaking changes)
4. Log 100% coverage target; escalate any gaps >5%

Script: `functions/scripts/backfill-pop-reference.mjs`

---

## Implementation Plan

### Wave 1 (Days 1-3): Design + Schema ✓

- [ ] Finalize POP/POPVersao/POPReferencia interfaces
- [ ] Design versioning auto-increment (v1.0 → v1.1 → v2.0)
- [ ] Design training linkage to Qualificacao
- [ ] Map POP scope to 5 CIQ modules
- [ ] Design denormalization strategy
- [ ] Commit: "ADR 0004 Wave 1: POP schema + versioning spec finalized"

### Wave 2 (Days 4-6): Cloud Functions + Validators

- [ ] Create `functions/src/modules/procedimentos/types.ts`
- [ ] Implement `createPOP()`, `createPOPVersion()`, `assinaturaRT()`
- [ ] Implement `popValidator.canOperadorUsarPOP()`
- [ ] Unit tests >80% coverage
- [ ] HMAC integration via ADR 0005

### Wave 3 (Days 7-9): Wire into CIQ Runs

- [ ] Update Hematologia, Imunologia, Coagulacao, Uroanalise, Bioquimica
- [ ] Add `popValidator.checkTrainingValid()` before run save
- [ ] Denormalize `popReferencia` on save
- [ ] Create backfill script

### Wave 4 (Days 10-12): Tests + Rules

- [ ] Unit tests: versioning, signatures, training checks
- [ ] Integration tests: E2E POP create → operator train → use in run
- [ ] Firestore rules patch

### Wave 5 (Days 13-14): Deploy + Monitoring

- [ ] Deploy functions + rules
- [ ] Run backfill script
- [ ] Monitor adoption + training gaps

---

## Acceptance Criteria

- [ ] POP collection deployed with versioning (v1.0, v1.1 format)
- [ ] `createPOPVersion()` auto-increments número correctly
- [ ] `assinaturaRT()` signs hash via ADR 0005 + auto-obsoletes old versions
- [ ] `canOperadorUsarPOP()` validates training + expiration
- [ ] All CIQ runs (100%) have `popReferencia` post-backfill
- [ ] Operator without training on POP version cannot save run
- [ ] E2E test: POP v1.0 created → RT signs → Operator A trains → runs test → Operator A verified in audit trail

---

## Risks & Mitigations

| Risk                                                  | Likelihood | Impact | Mitigation                                              |
| ----------------------------------------------------- | ---------- | ------ | ------------------------------------------------------- |
| Backfill infers wrong POP for legacy runs             | Medium     | High   | Dry-run on test lab; manual spot-check 5% sample        |
| RT signature bottleneck (too many POPs await signing) | Low        | Medium | Pre-bulk sign common POPs; create dashboard             |
| Operators can't find training records (search)        | Low        | Medium | Index `Qualificacao.treinamentosPOP` clearly; UI search |
| Large dataset backfill timeout (>10k runs)            | Low        | Medium | Batch in waves (1k at a time); checkpoint each wave     |

---

## Success Metrics (Post-Deploy)

- **POP adoption:** 100% of CIQ runs reference a POP version
- **Training compliance:** 0% of runs from untrained operators
- **Signature verification:** 0% of runs with invalid HMAC
- **Version distribution:** Monitor v1.x usage (should shift to latest over time)
- **Operator feedback:** <5% "POP training not found" errors

---

## References

- RDC 978 § 8.5.5: Pessoal treinado e qualificado
- RDC 978 § 8.5.6: Registros de treinamento
- ADR 0005: HMAC signature helper
- ADR 0006: Qualificacao schema extension

---

**Status:** ✅ Wave 1 Complete — Ready for Wave 2 (Cloud Functions)  
**Next Action:** Implement createPOP, createPOPVersion, assinaturaRT callables
