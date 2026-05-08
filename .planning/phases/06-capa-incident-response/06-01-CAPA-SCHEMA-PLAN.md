---
phase: "06-capa-incident-response"
plan: "01"
type: "execute"
wave: 1
depends_on: []
files_modified:
  - "src/features/sgq/capa/types.ts"
  - "src/features/sgq/capa/services/capaService.ts"
  - "firestore.rules"
  - "firestore.indexes.json"
  - "functions/src/modules/capa.ts"
  - "functions/src/modules/capa.test.ts"

autonomous: true
requirements: ["RDC-978-ART-99", "DICQ-4.14.2", "DICQ-4.14.6"]

must_haves:
  truths:
    - "CAPA document structure (finding → action → verification → closeout) is defined and type-safe"
    - "Multi-tenant CAPA collection lives at /labs/{labId}/capa/{capaId} with soft-delete enforcement"
    - "Cloud Function callables exist for CAPA creation, status transitions, and audit trail integration"
    - "Firestore Rules enforce: only RT/admin can create; only assignee or RT can update; all writes audit-sealed"
    - "Service layer provides CRUD operations with automatic audit entry registration (per RDC 978 Art. 128)"
    - "Tests validate schema enforcement, audit trail linkage, and soft-delete behavior"

  artifacts:
    - path: "src/features/sgq/capa/types.ts"
      provides: "Type definitions for CAPA document, lifecycle statuses, actions, and verification states"
      must_contain: "interface CAPA"
      min_exports: 5

    - path: "src/features/sgq/capa/services/capaService.ts"
      provides: "Service layer: create, read, update, subscribe, search CAPA documents with audit integration"
      exports: ["createCAPA", "updateCAPAStatus", "subscribeCAPAs", "getCAPA", "softDeleteCAPA"]
      min_lines: 150

    - path: "firestore.rules"
      provides: "Security rules for /labs/{labId}/capa/* — immutable findings, role-based updates, audit-sealed"
      must_contain: ["match /labs/{labId}/capa", "allow create.*isAdminOrRT", "allow update.*isAuthorizedEditor", "allow delete.*false"]

    - path: "firestore.indexes.json"
      provides: "Composite indexes for CAPA queries: labId + status, labId + assigneeId, labId + dueDate"
      indexes_added: 3

    - path: "functions/src/modules/capa.ts"
      provides: "Cloud Function callables for CAPA lifecycle + audit sealing (createCAPA, updateCAPA, assignAction)"
      exports: ["createCAPA", "updateCAPA", "assignCAPA", "verifyCAPA"]
      min_functions: 4

    - path: "functions/src/modules/capa.test.ts"
      provides: "Unit + integration tests for CAPA callables, audit trail linkage, Rules enforcement"
      test_count: 12

  key_links:
    - from: "src/features/sgq/capa/services/capaService.ts"
      to: "functions/src/modules/capa.ts"
      via: "Cloud Function callables invoked from service"
      pattern: "httpsCallable.*\\(functions, 'createCAPA'"

    - from: "functions/src/modules/capa.ts"
      to: "firestore.rules"
      via: "Rules enforce Cloud Function context (service account writes)"
      pattern: "allow create.*request.auth == null"

    - from: "src/features/sgq/capa/services/capaService.ts"
      to: "functions/src/modules/audit.ts"
      via: "Automatic registerAuditEntry call on CAPA lifecycle"
      pattern: "registerAuditEntry.*'capa\\."

---

<objective>
Define CAPA schema, enforce immutability on findings, and establish Cloud Function callables for CAPA lifecycle management (create → assign → verify → closeout). All writes are audit-sealed per RDC 978 Art. 128 + DICQ 4.14.6 (preventive action tracking).

**Purpose:** Foundation for CAPA module. CAPA (Corrective/Preventive Action) tracks RDC findings through closure. Schema must enforce finding integrity (immutable once created) and link each state change to audit trail.

**Output:**
- Firestore schema: CAPA document + subcollections for actions + verifications
- Cloud Function callables: create, update, assign, verify (all audit-sealed)
- Firestore Rules: role-based access + immutability enforcement
- Service layer: thin client-side CRUD wrapper
- Unit + integration tests (12 tests minimum)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06/06-RESEARCH.md

# Existing audit infrastructure from Phase 3
From Phase 3 (v1.4-KICKOFF), audit chain types are defined in src/features/sgq/auditoria/types.ts:
- AuditEntry (hash, previousHash, hmac, operatorId, timestamp, payload)
- Pattern: server-sealed callables with HMAC-SHA256 + chain linking

# RDC 978 compliance refs
- Art. 99: CAPA tracking required for deviations
- Art. 128: Rastreabilidade via audit trail (server-sealed timestamps + operator attribution)
- Art. 115: 5-year retention minimum

# DICQ compliance refs
- 4.14.2: Non-conformity + CAPA management procedures
- 4.14.6: Preventive action identification + risk assessment (links to risks module Phase 0)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Define CAPA type system and data model</name>
  <files>src/features/sgq/capa/types.ts</files>
  <action>
Create CAPA type definitions covering:
1. **CAPA document root schema:**
   - id, labId (multi-tenant), criadoEm, criadoPor (operator ID)
   - titulo (short title), descricao (detailed finding)
   - encontroId (link to finding source: audit, laudo, complaint, risk) — nullable, immutable
   - status: 'aberta' | 'em-tratamento' | 'verificada' | 'fechada' | 'cancelada'
   - prioridade: 1-5 (risk priority from risks module)
   - dataPrazo (target closure date)
   - deletadoEm, deletadoPor (soft-delete fields per RDC-06)

2. **Subcollection: /labs/{labId}/capa/{capaId}/acoes/{acaoId}**
   - acaoId, tipo: 'corretiva' | 'preventiva'
   - descricao (corrective/preventive action)
   - responsavel (assigned operator ID)
   - dataVencimento (action due date)
   - status: 'aberta' | 'concluida' | 'vencida'
   - evidenciasLinks: string[] (references to PDF/file evidence)

3. **Subcollection: /labs/{labId}/capa/{capaId}/verificacoes/{verificationId}**
   - verificadoPor (RT ID), dataVerificacao
   - resultado: 'efetiva' | 'nao-efetiva' | 'parcialmente-efetiva'
   - notas (verification notes)
   - horasInvestidas (tracking DICQ 4.14.2 effort)

4. **Immutability marker:**
   - encontroId field: once set, cannot be changed (prevents re-assigning a CAPA to different finding)

Export:
- `interface CAPA` (root doc)
- `interface CAParecao` (action)
- `interface Verificacao` (verification)
- `type CAPAStatus` (union of status values)
- Input DTOs: `CreateCAPAInput = Omit<CAPA, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm' | 'deletadoPor'>`
  </action>
  <verify>
    <automated>npm run build -- src/features/sgq/capa/types.ts && grep -c "interface CAPA" src/features/sgq/capa/types.ts</automated>
  </verify>
  <done>File exists, 5+ type exports, no TS errors, immutability fields documented</done>
</task>

<task type="auto">
  <name>Task 2: Implement CAPA service layer with CRUD + audit integration</name>
  <files>src/features/sgq/capa/services/capaService.ts</files>
  <action>
Create service layer covering:

1. **createCAPA(labId, input): Promise<CAPA>**
   - Validate input against CreateCAPAInput DTO
   - Call Cloud Function callable `createCAPA` (server-sealed)
   - Callable returns capaId + audit entry ID
   - Service wraps response, returns populated CAPA doc

2. **updateCAPAStatus(labId, capaId, newStatus, notes): Promise<void>**
   - Validates status transition (aberta → em-tratamento → verificada → fechada)
   - Calls callable `updateCAPA` (server-sealed)
   - Callable logs status change + RT approval timestamp

3. **assignCAPA(labId, capaId, acaoId, responsavel, dataVencimento): Promise<void>**
   - Assigns corrective action to operator
   - Calls callable `assignCAPA` (audit-sealed)

4. **verifyCAPA(labId, capaId, verificadoPor, resultado, notas): Promise<void>**
   - RT submits verification after action completion
   - Calls callable `verifyCAPA` (audit-sealed)
   - If resultado === 'efetiva', auto-transitions status to 'fechada'

5. **subscribeCAPAs(labId, options: {status?: string; assigneeId?: string} = {}): Observable<CAPA[]>**
   - Realtime listener via onSnapshot
   - Filters by status and/or assignee
   - Unsubscribe cleanup in component

6. **getCAPA(labId, capaId): Promise<CAPA>**
   - Single fetch (used in detail view)

7. **softDeleteCAPA(labId, capaId, deletadoPor): Promise<void>**
   - Never calls deleteDoc
   - Updates deletadoEm + deletadoPor
   - Calls callable to audit the soft-delete

All callables include error handling: catch Firestore exceptions, return user-friendly error messages (not stack traces).

Per project conventions:
- Input validation uses Zod (if complex fields) or inline schema
- All callables invoke `registerAuditEntry` from audit module
- No direct Firestore writes from service; callables are the gate
  </action>
  <verify>
    <automated>npm run build -- src/features/sgq/capa/services/capaService.ts && grep -c "export const" src/features/sgq/capa/services/capaService.ts</automated>
  </verify>
  <done>Service exports 7+ functions, each callable-backed, builds without TS errors, audit integration confirmed in code</done>
</task>

<task type="auto">
  <name>Task 3: Implement Cloud Function callables for CAPA lifecycle + audit sealing</name>
  <files>functions/src/modules/capa.ts</files>
  <action>
Implement server-side callables:

1. **createCAPA(labId, input) → {capaId, auditEntryId}**
   - Validate input (Zod schema or inline checks)
   - Check caller is RT or admin
   - Write CAPA doc to Firestore (status: 'aberta')
   - Call registerAuditEntry('capa.criada', 'sgq/capa', payload={titulo, encontroId, prioridade})
   - Return {capaId, auditEntryId}

2. **updateCAPA(labId, capaId, newStatus, notes)**
   - Validate status transition rules
   - Check caller is RT or admin
   - Update status field
   - Call registerAuditEntry('capa.status-alterado', 'sgq/capa', payload={capaId, oldStatus, newStatus})

3. **assignCAPA(labId, capaId, acaoId, responsavel, dataVencimento)**
   - Validate CAPA exists and is not closed
   - Create acao doc in subcollection
   - Call registerAuditEntry('capa.acao-criada', 'sgq/capa', payload={capaId, acaoId, responsavel})

4. **verifyCAPA(labId, capaId, verificadoPor, resultado, notas)**
   - Validate CAPA status is 'em-tratamento'
   - Create verificacao doc in subcollection
   - If resultado === 'efetiva', update parent CAPA status to 'fechada'
   - Call registerAuditEntry('capa.verificada', 'sgq/capa', payload={capaId, resultado})

**Error handling:**
- All callables wrapped in try-catch
- Return { error: code, message: userFriendlyText } on failure
- Log to Cloud Logging (avoid exposing stack traces to client)

**Audit integration (per ADR-0012):**
- Each callable imports { registerAuditEntry } from shared audit module
- Payload structure: only IDs, status, operator — NO patient data or clinical details
- registerAuditEntry is synchronous (server-sealed before returning to client)

**Rules integration:**
- Callables run in service context (request.auth === null in Cloud Function)
- Firestore Rules accept writes only from service context
  </action>
  <verify>
    <automated>npm run build -- functions/src/modules/capa.ts && grep -c "export const" functions/src/modules/capa.ts</automated>
  </verify>
  <done>4+ callables exported, all audit-sealed, error handling present, builds without TS errors</done>
</task>

<task type="auto">
  <name>Task 4: Define Firestore Rules and indexes for CAPA collections</name>
  <files>firestore.rules, firestore.indexes.json</files>
  <action>
**firestore.rules updates:**

Add to rules file (after existing collections):

```javascript
// CAPA Collection Rules
match /labs/{labId}/capa/{capaId} {
  // Read: RT, admin, or auditor can view
  allow read: if isActiveMemberOfLab(labId) && 
              (request.auth.token.role in ['rt', 'admin', 'auditor']);
  
  // Create: Cloud Function only (not client-side)
  allow create: if request.auth == null;
  
  // Update: Cloud Function only
  allow update: if request.auth == null;
  
  // Delete: never (soft-delete only via callable)
  allow delete: if false;
  
  // Subcollection: acoes (actions)
  match /acoes/{acaoId} {
    allow read: if parent.read;
    allow create: if request.auth == null;
    allow update: if request.auth == null;
    allow delete: if false;
  }
  
  // Subcollection: verificacoes (verifications)
  match /verificacoes/{verificacaoId} {
    allow read: if parent.read;
    allow create: if request.auth == null;
    allow update: if false; // Immutable once created
    allow delete: if false;
  }
}
```

**firestore.indexes.json updates:**

Add three composite indexes:

1. **Index 1: labId + status (for listing by status)**
   ```json
   {
     "collectionGroup": "capa",
     "queryScope": "Collection",
     "fields": [
       {"fieldPath": "labId", "order": "ASCENDING"},
       {"fieldPath": "status", "order": "ASCENDING"},
       {"fieldPath": "criadoEm", "order": "DESCENDING"}
     ]
   }
   ```

2. **Index 2: labId + assigneeId (for "my actions" view)**
   ```json
   {
     "collectionGroup": "acoes",
     "queryScope": "Collection",
     "fields": [
       {"fieldPath": "labId", "order": "ASCENDING"},
       {"fieldPath": "responsavel", "order": "ASCENDING"},
       {"fieldPath": "dataVencimento", "order": "ASCENDING"}
     ]
   }
   ```

3. **Index 3: labId + dueDate (for deadline tracking)**
   ```json
   {
     "collectionGroup": "capa",
     "queryScope": "Collection",
     "fields": [
       {"fieldPath": "labId", "order": "ASCENDING"},
       {"fieldPath": "dataPrazo", "order": "ASCENDING"}
     ]
   }
   ```

**Ensure helpers are defined** (isActiveMemberOfLab, isAdminOrOwner):
- Use existing patterns from Phase 3 + v1.3 Rules baseline
- If not present, define at rules header

**Index deployment:**
- Via Firebase Console: Firestore → Indexes → create each composite index
- Or: `firebase deploy --only firestore:rules,firestore:indexes` (uses firestore.indexes.json)
  </action>
  <verify>
    <automated>grep -c "match /labs/{labId}/capa" firestore.rules && jq '.indexes | length' firestore.indexes.json</automated>
  </verify>
  <done>Rules block present, 3+ indexes defined in JSON, no syntax errors</done>
</task>

<task type="auto">
  <name>Task 5: Add unit + integration tests for CAPA callables and Rules</name>
  <files>functions/src/modules/capa.test.ts</files>
  <action>
Create test suite (Jest + Firebase Emulator):

**Unit tests (6 tests):**
1. createCAPA validates input (rejects missing titulo)
2. createCAPA calls registerAuditEntry with correct payload
3. updateCAPA rejects invalid status transition (aberta → fechada, skip em-tratamento)
4. assignCAPA validates responsavel user exists in lab members
5. verifyCAPA with resultado='efetiva' auto-closes CAPA
6. softDeleteCAPA sets deletadoEm but preserves doc (no deleteDoc)

**Integration tests (6 tests):**
1. Full CAPA lifecycle: create → assign → verify → close (end-to-end)
2. Firestore Rules reject client-side CAPA write (allow create: if false)
3. Firestore Rules allow Cloud Function write (auth == null context)
4. Verification subcollection is immutable (allow update: if false)
5. Audit entries are created for each status change (query audit-trail, verify count)
6. Concurrent assign operations don't break chain integrity (two users assign same CAPA → second fails gracefully)

**Test structure:**
```typescript
describe('CAPA Callables', () => {
  beforeEach(async () => {
    // Setup Firebase Emulator context
    // Create test lab + members
  });

  describe('createCAPA', () => {
    test('should create CAPA and register audit entry', async () => {
      // Call createCAPA
      // Assert doc created
      // Assert audit-trail has entry with operation='capa.criada'
    });
  });

  describe('Firestore Rules', () => {
    test('should reject client-side write to capa', async () => {
      // Attempt direct client Firestore write
      // Assert permission denied
    });
  });
});
```

**Run command:**
```bash
npm test -- functions/src/modules/capa.test.ts
```

Minimum 12 tests; all must pass before merge.
  </action>
  <verify>
    <automated>npm test -- functions/src/modules/capa.test.ts --passWithNoTests 2>&1 | grep -E "12 passed|Tests:.*passed"</automated>
  </verify>
  <done>12+ tests defined, all passing, audit integration tests confirm registerAuditEntry calls</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Cloud Function | Client sends CAPA create request; must be authenticated (Firebase Auth) |
| Cloud Function → Firestore | Server-sealed writes (request.auth === null in Rules context) |
| Firestore Rules → CAPA collection | Role-based access (RT/admin read+write, others read-only) |
| Audit trail chain | HMAC-sealed entries; chain link verified on integrity check |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-01 | Tampering | CAPA doc fields | mitigate | Firestore Rules: verificaciones subcollection immutable (allow update: if false); encontroId immutable per validator |
| T-06-02 | Spoofing | Operator attribution | mitigate | operatorId = request.auth.uid (Firebase Auth canonical); cannot be forged by client; audit entry contains UID |
| T-06-03 | Repudiation | CAPA status change | mitigate | All status changes via audit-sealed callable; audit-trail HMAC chain proves who changed status and when |
| T-06-04 | Information Disclosure | CAPA read access | mitigate | Firestore Rules enforce role check; only RT/admin/auditor can read; no exposure to non-members |
| T-06-05 | Denial of Service | Concurrent writes | mitigate | Firestore transactions (atomic read-then-write on audit chain); concurrent updates serialize |
| T-06-06 | Elevation of Privilege | Admin CAPA actions | accept | RT/admin-only fields (dataPrazo, prioridade changes); normal users can only view assigned actions; low-value target |

</threat_model>

<verification>
**Phase Gate (before moving to 06-02 CAPA UI):**

1. Type system compiles without errors
   ```bash
   npx tsc --noEmit src/features/sgq/capa/types.ts
   ```

2. Service layer builds cleanly
   ```bash
   npm run build -- src/features/sgq/capa/services/capaService.ts
   ```

3. Cloud Function callables deploy to emulator
   ```bash
   npm test -- functions/src/modules/capa.test.ts
   ```

4. All 12 tests pass
   ```bash
   npm test -- functions/src/modules/capa.test.ts 2>&1 | grep "Tests:.*passed"
   ```

5. Firestore Rules syntax valid (no deploy errors on rules change)
   ```bash
   firebase deploy --only firestore:rules --dry-run
   ```

6. No TypeScript errors in entire project after changes
   ```bash
   npx tsc --noEmit
   ```

**Success:** All checks green. Ready for 06-02 UI implementation.
</verification>

<success_criteria>
- CAPA type system fully defined (5+ exported types)
- Service layer exports 7+ functions, all callable-backed
- Cloud Function callables: 4+ functions, all audit-sealed
- Firestore Rules: CAPA collection + subcollections protected, immutability enforced
- 3 composite indexes created in Firestore
- 12+ unit + integration tests, all passing
- Audit trail integration verified (registerAuditEntry called for each lifecycle event)
- Zero TypeScript errors
- Zero Firestore Rules deploy errors
</success_criteria>

<output>
After completion, create `.planning/phases/06-capa-incident-response/06-01-PLAN-SUMMARY.md` documenting:
- Schema design decisions (why encontroId is immutable, why verificacao is append-only)
- Callable signatures and error handling
- Firestore Rules enforcement strategy
- Test coverage map (which tests cover which RDC articles)
</output>
