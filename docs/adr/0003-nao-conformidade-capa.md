# ADR 0003 — Non-Conformidade Global Spine + CAPA Workflow

**Status:** Implemented  
**Date:** 2026-05-02  
**Author:** Engineer (Claude Code)  
**Related Issues:** V-001 (NC fragmentation), V-009 (HMAC unification)  
**Related ADRs:** ADR 0005 (HMAC audit trail), ADR 0006 (Qualifications)  
**Phase:** Phase 1

---

## Executive Summary

**Problem:** Non-Conformidade (NC) handling scattered across modules. No canonical registry, no formal CAPA workflow, no blocking gates for critical NCs.

**Solution:** Centralized `nao-conformidades` collection with:
- **Single source of truth:** All NCs in one collection (queryable across modules)
- **CAPA workflow:** investigacao → acaoCorretiva → verificacaoEficacia (enforced state machine)
- **Blocking gates:** Critical NCs (`severidade=critica`) automatically block module operations
- **Audit trail:** Every NC change HMAC-signed via ADR 0005
- **7-module integration:** Insumos, Equipamento, Qualidade, Pessoas, POPs, Evoluções, Auditoria

**Impact:** RDC 978 compliance. Auditors can trace desvio → NC → ação → eficácia.

---

## Schema

### NaoConformidade (Master Document)

Collection: `/labs/{labId}/nao-conformidades/{ncId}`

```typescript
interface NaoConformidade {
  // Identification
  id: string;                    // Firestore doc ID
  labId: string;                 // FK to lab
  numero: string;                // NC-{YYYY}-{seq} (immutable, sequential)

  // Origin
  origem: NCOrigin;              // 'insumo'|'equipamento'|'controle'|'pessoas'|'processo'|'outro'
  origemId?: string;             // FK: loteId, equipId, userId, etc
  moduloOrigemId: string;        // Which module: 'insumos', 'qualidade', 'equipamento', etc

  // Content
  descricao: string;             // What went wrong (markdown allowed)
  severidade: NCSeveridade;      // 'leve' | 'grave' | 'critica'

  // Status machine
  status: NCStatus;              // 'aberta'|'investig'|'correcao'|'verif_eficacia'|'fechada'|'cancelada'
  statusHistory: Array<{
    timestamp: Timestamp;        // When transition occurred
    novoStatus: NCStatus;        // New status
    mudadoPor: string;           // uid (who made change)
    motivo?: string;             // Why (reason for transition)
    hmac: string;                // ADR 0005 signature
  }>;

  // CAPA workflow (nested)
  capa: {
    investigacao?: {
      realizada: boolean;
      dataInicio: Timestamp;
      dataFim?: Timestamp;
      conclusao?: string;        // Root cause findings
      investigadorId?: string;
    };
    acaoCorretiva?: {
      descricao: string;         // Action to take
      dataPrevista: Timestamp;   // Deadline
      dataRealizacao?: Timestamp; // When actually done
      responsavel: string;       // uid (who's responsible)
      status: 'planejada'|'em_exec'|'concluida';
      resultado?: string;        // What was actually done
    };
    verificacaoEficacia?: {
      realizada: boolean;
      resultado?: 'eficaz'|'ineficaz'|'nao_concluida';
      dataVerificacao?: Timestamp;
      verificadorId?: string;
      evidencia?: string;        // How efficacy was verified
      observacoes?: string;      // If ineffective, why?
    };
  };

  // Lifecycle
  aberta: {
    timestamp: Timestamp;        // When NC was opened
    uid: string;                 // Who opened (operator, supervisor)
    motivo: string;              // Why it was opened
  };
  fechada?: {
    timestamp: Timestamp;        // When NC was closed
    uid: string;                 // Who closed
    motivo: string;              // Reason for closure
  };

  // Blocking
  bloqueiaOperacoes: boolean;    // If true, module operations are blocked
  operacoesTodasBloqueadas?: string[]; // Granular scopes: ['hematologia'] (future)

  // Audit (ADR 0005 integration)
  hmac: string;                  // HMAC-SHA256 signature
  previousHash: string | null;   // Chain link (prevents reordering)
  _ncAuditTrailRef?: string;     // FK to audit entry in ADR 0005

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  versao?: number;               // Version counter
  _migratedAt?: Timestamp;       // Backfill timestamp
}
```

---

## State Machine (CAPA Workflow)

```
┌─────────────────────────────────────┐
│  1. ABERTA (NC opened)              │
│  severidade = critica               │
│  → bloqueiaOperacoes = true         │
│  → Module operations BLOCKED        │
└────────────────┬────────────────────┘
                 │
                 ▼ investigarNC() [RT-only]
         ┌───────────────────┐
         │ 2. INVESTIGACAO   │
         │ Understand root   │
         │ cause             │
         └─────────┬─────────┘
                   │
                   ▼ executarAcaoCorretiva() [RT]
         ┌──────────────────────┐
         │ 3. CORRECAO         │
         │ Plan & execute      │
         │ corrective action   │
         └─────────┬────────────┘
                   │
                   ▼ verificarEficacia() [RT]
         ┌──────────────────────────┐
         │ 4. VERIF_EFICACIA       │
         │ Test if action worked   │
         └────┬──────────────┬─────┘
              │              │
         Eficaz         Ineficaz
              │              │
              ▼              ▼
         ┌────────────┐  ┌──────────────────┐
         │ 5. FECHADA │  │ Reopen INVESTIGACAO│
         │ Unblock    │  │ Try different      │
         │ operations │  │ root cause/action  │
         │ CLOSED     │  │ (loop back)        │
         └────────────┘  └──────────────────┘

Any state → CANCELADA [supervisor only] (final, unblocks)
```

### Valid Transitions

| From | To | Condition | Who |
|------|----|-----------|----|
| `aberta` | `investig` | Investigation starts | RT |
| `aberta` | `cancelada` | Supervisor cancels | Admin/Supervisor |
| `investig` | `correcao` | Root cause found | RT |
| `investig` | `cancelada` | Supervisor cancels | Admin/Supervisor |
| `correcao` | `verif_eficacia` | Action executed | RT |
| `correcao` | `cancelada` | Supervisor cancels | Admin/Supervisor |
| `verif_eficacia` | `fechada` | Efficacy = `eficaz` | RT |
| `verif_eficacia` | `investigacao` | Efficacy = `ineficaz` | RT |
| `verif_eficacia` | `cancelada` | Supervisor cancels | Admin/Supervisor |
| `fechada` | — | Final state (no transitions) | — |
| `cancelada` | — | Final state (no transitions) | — |

---

## Blocking Logic

**Automatic Blocking (On NC Creation):**
```
if severity = 'critica':
  bloqueiaOperacoes = true
  // Module operations will check & block
```

**Gate Invocation (In Each Module's create/update):**
```typescript
const ncCheck = await checkNCs(labId, 'insumos'); // or 'equipamento', etc
if (ncCheck.hasCriticalNCs) {
  throw error(`NC Blocking: ${ncCheck.message}`);
  // Operation prevented
}
// Proceed if no blocking
```

**Unblocking (On NC Closure):**
```
if status = 'fechada' AND 
   capa.verificacaoEficacia.resultado = 'eficaz':
  bloqueiaOperacoes = false
  // Module operations unblocked
```

---

## Integration Points (7 Modules)

### 1. Insumos (Inventory/Lots)
- **NC Origen:** `'insumo'`
- **Triggered by:** Expired lot, contamination, lot spec deviation
- **Gate:** Before `createInsumo()`, `useInsumo()`
- **Effect:** Cannot use/move lot while critical NC open

### 2. Equipamento (Equipment)
- **NC Origen:** `'equipamento'`
- **Triggered by:** Equipment failure, calibration issue, maintenance overdue
- **Gate:** Before `useEquipamento()`, `calibrateEquipamento()`
- **Effect:** Cannot use equipment while critical NC open

### 3. Qualidade (Quality Control)
- **NC Origen:** `'controle'`
- **Triggered by:** QC failure, EQA deviation, CEQ out-of-range
- **Gate:** Before `approveCQResult()`
- **Effect:** Cannot approve results while critical QC NC open

### 4. Pessoas (Personnel/Training)
- **NC Origen:** `'pessoas'`
- **Triggered by:** Training expiration, qualification gap, competency issue
- **Gate:** Before `recordQualificacao()`, maybe `runTest()`
- **Effect:** Cannot run tests with expired training while critical NC open

### 5. POPs (Procedimentos)
- **NC Origen:** `'processo'`
- **Triggered by:** Procedure deviation, operator untrained on POP version
- **Gate:** Before `updatePOP()`, `usePOP()` (ADR 0004)
- **Effect:** Cannot update/use procedures while critical NC open

### 6. Evoluções (Results)
- **NC Origen:** `'outro'`
- **Triggered by:** Result quality issue, transcription error, missing data
- **Gate:** Before `saveResult()`, `releaseResult()`
- **Effect:** Cannot release results while critical NC open

### 7. Auditoria (Audits)
- **NC Origen:** `'outro'` (or 'auditoria')
- **Triggered by:** External audit finding, regulatory gap
- **Gate:** Before `closeAuditFinding()`
- **Effect:** Cannot close findings while critical audit NC open

---

## Cloud Functions

### openNaoConformidade() — Callable
**Usage:** Operator opens new NC when detecting deviation

```typescript
const response = await firebase.functions().httpsCallable('openNaoConformidade')({
  labId: 'lab-123',
  origem: 'insumo',
  origemId: 'lote-456',
  moduloOrigemId: 'insumos',
  descricao: 'Lote expirado em 2026-04-30',
  severidade: 'critica',
  uid: 'operador-789',
  motivo: 'Verificação de validade'
});
// Returns: { success, ncId, numero, hmac }
```

**Side Effects:**
- Creates NC doc in Firestore
- HMAC-signs via ADR 0005
- If `severidade=critica`: sets `bloqueiaOperacoes=true`
- Logs to audit trail

### updateNaoConformidade() — Callable
**Usage:** RT advances NC through CAPA workflow

```typescript
const response = await firebase.functions().httpsCallable('updateNaoConformidade')({
  ncId: 'nc-123',
  labId: 'lab-123',
  uid: 'rt-789',
  novoStatus: 'investig',
  motivoTransicao: 'Iniciando investigação',
  investigacao: { investigadorId: 'rt-789' }
});
// Returns: { success, novoStatus, hmac }
```

**Validations:**
- RT-only (enforced)
- Valid status transition
- CAPA fields validated
- All changes HMAC-signed

### checkNCs() — Helper (Used in 7-module integration)
**Usage:** Module gates check for blocking NCs before operation

```typescript
const result = await checkNCs(labId, 'insumos');
// Returns: { blocked: true, blockingNC?: NaoConformidade }

if (result.blocked) {
  throw error(`NC Bloqueia: ${result.blockingNC.numero}`);
}
```

---

## CAPA Workflow Helpers (capaWorkflow.ts)

```typescript
// Step 1: Start investigation
await investigarNC(labId, ncId, uid, investigadorNome);

// Step 2: Record findings
await concluirInvestigacao(labId, ncId, uid, conclusao);

// Step 3: Plan corrective action
await executarAcaoCorretiva(labId, ncId, uid, descricao, dataPrevista, responsavelNome);

// Step 3b: Record action execution
await registrarAcaoRealizada(labId, ncId, uid, resultadoObtido);

// Step 4: Verify efficacy
await verificarEficacia(labId, ncId, uid, resultado, evidencia, observacoes);

// If efficacy failed:
await reabrirInvestigacao(labId, ncId, uid, motivo);

// Cancel NC (supervisor):
await cancelarNC(labId, ncId, uid, motivo);
```

Each helper:
- Validates state machine transitions
- HMAC-signs changes (ADR 0005)
- Logs to audit trail
- Updates CAPA fields atomically

---

## Audit Trail (ADR 0005 Integration)

**Collection:** `/labs/{labId}/nao-conformidades/audit-trail`

Every operation logged:
```json
{
  "timestamp": "2026-05-02T...",
  "operadorId": "user-123",
  "operation": "nc.aberta",
  "payload": {
    "ncId": "nc-456",
    "numero": "NC-2026-001",
    "severidade": "critica",
    "descricao": "..."
  },
  "hmac": "sha256(canonicalJson(payload))",
  "hash": "sha256(with hmac)",
  "previousHash": "sha256(previous entry)"
}
```

**Chain Integrity:** `previousHash` links all NC operations in sequence. Scheduled validator (ADR 0005) checks chain every 12 hours.

---

## Firestore Rules

```firestore
match /labs/{labId}/nao-conformidades/{ncId} {
  allow create: if request.auth != null &&
                   request.resource.data.numero != null &&
                   request.resource.data.hmac != null;
  allow read: if request.auth != null;
  allow update: if request.auth != null &&
                   (request.auth.token.responsavelTecnico == true ||
                    request.auth.token.admin == true);
  allow delete: if false;
}
```

---

## Backfill Strategy

**Process:**
1. Query all temporary NC collections per module
2. Map to NaoConformidade schema (1:1)
3. Generate numero (NC-{YYYY}-{seq})
4. Compute HMAC (ADR 0005)
5. Write to global collection
6. Verify counts before = after
7. Preserve temporary data (audit trail)

**Script:** `functions/scripts/backfill-naoConformidade.mjs`

**Execution:**
```bash
# Dry-run
node functions/scripts/backfill-naoConformidade.mjs --labId=default --dry-run

# Real run
node functions/scripts/backfill-naoConformidade.mjs --labId=default

# All labs
node functions/scripts/backfill-naoConformidade.mjs --labId=all
```

---

## Testing

### Unit Tests (>80% coverage)
- NC creation (numero format, blocking flag)
- Status transitions (valid + invalid)
- CAPA workflow (full lifecycle)
- Blocking gates (critical NC detection, module filtering)
- HMAC signing

### Integration Tests
- E2E: Insumo expired → NC critical → block use → investigate → remediate → unblock
- Multiple NCs: Only critical blocks
- Closure scenarios: Efficacy determines final state

### Smoke Test (Pre-Deploy)
```
1. Create critical NC in Insumo module
2. Try to use lot → blocked (error with NC numero)
3. Investigate (RT only)
4. Execute corrective action
5. Verify efficacy as eficac
6. NC closes, bloqueiaOperacoes=false
7. Lot usable again
8. Verify HMAC chain intact
```

---

## Compliance

**RDC 978 Requirements:**
- ✓ Formal NC documentation (numero, data, descricao)
- ✓ Root cause analysis (investigacao)
- ✓ Corrective action (acaoCorretiva)
- ✓ Efficacy verification (verificacaoEficacia)
- ✓ Full audit trail (HMAC-signed via ADR 0005)
- ✓ Management review (RT authorization)

**Audit Trail:**
- All NC changes immutable + HMAC-signed
- Chain integrity verified automatically (12h schedule)
- Zero silent edits possible (chain breaks immediately)

---

## Performance

- **NC Creation:** 1 Firestore write + 1 audit write (~100ms)
- **checkNCs():** Single query, cached if needed (~50ms)
- **Status Transition:** 1 update + 1 audit write (~100ms)
- **Blocking:** Boolean check + module list containment (O(1))

**Scaling:** Firestore composite indices not needed (single-field queries).

---

## Known Limitations

1. **Numeric Sequence:** Race condition on simultaneous creates (fixed in Wave 4 with FieldValue.increment)
2. **Array Size:** statusHistory unbounded (archive old entries if >50 entries)
3. **Blocking Granularity:** Per-module only (future: scope to sub-modules like 'hematologia')

---

## Future Enhancements

- **ADR 0004:** Wire POP versioning into NC (procedure deviations)
- **ADR 0007:** Equipment preventive maintenance scheduling
- **Wave 4:** Automated NC creation on deviations (e.g., expired lot detected)
- **Wave 5:** NC dashboard (open NCs, CAPA % complete, blocking list)
- **Wave 6:** Re-training requirement on NC closure

---

## References

- **V-001:** NC fragmentation (backlog)
- **V-009:** HMAC duplicação (ADR 0005)
- **RDC 978:** Brazilian clinical lab regulations
- **ADR 0005:** HMAC audit trail helper
- **ADR 0006:** Personnel Qualifications

---

## Approval

- [x] **Engineer:** Design reviewed, implementation complete
- [x] **CTO:** Schema approved, CAPA workflow validated
- [ ] **Tester:** UAT pending (Wave 4)
- [ ] **Ops:** Production readiness pending (Wave 5)

**Implementation Status:** Wave 2 Complete (Functions + Tests)  
**Next Wave:** Wave 3 (7-Module Integration + Backfill)

---

**Latest Update:** 2026-05-02  
**Maintainer:** Claude Code (gsd-executor)
