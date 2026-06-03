# ARCHITECTURE REVIEW — Phases 9–12

## Design Consistency, Scalability & Maintainability

**Date:** 2026-05-06  
**Scope:** Cross-module architecture across 4 phases  
**Review Basis:** CLAUDE.md patterns, ADRs, rules files

---

## OVERALL ASSESSMENT

**Grade:** B+ (Strong foundation, minor inconsistencies)

**Strengths:**

- Consistent multi-tenant isolation pattern (all modules)
- Clear separation of concerns (service ↔ hook ↔ component)
- Defensive firestore rules (3-layer auth)
- Atomic batch operations throughout
- Soft-delete pattern uniformly applied

**Concerns:**

- OAuth architecture incomplete (state validation missing)
- Type safety gaps (some `any` casts remain)
- Westgard history window under-specified
- Drive importer design not fully reviewed

---

## MODULE-LEVEL CONSISTENCY

### 1. **Multi-Tenant Isolation Pattern — CONSISTENT**

**Applied Across:**

- ✓ Bioquímica: `/labs/{labId}/bioquimica/root/...`
- ✓ Liberação: `/labs/{labId}/laudos/...`, `/labs/{labId}/laudo-versions/...`
- ✓ Reclamações: `/labs/{labId}/reclamacoes/...`
- ✓ Satisfação: `/labs/{labId}/satisfacao-respostas/...`
- ✓ SGQ: `/labs/{labId}/sgq-documentos/...`

**Pattern:**

```typescript
// Service layer ALWAYS receives labId as first param
export async function createEntity(
  labId: LabId, // ← First, positional
  input: EntityInput,
): Promise<string>;

// Firestore path ALWAYS includes labId
const ref = doc(db, 'labs', labId, 'collection', entityId);

// Payload ALWAYS carries labId (defense in depth)
const doc = {
  labId, // ← Redundant but validated in rules
  ...rest,
};
```

**Rule Validation:**

```
Function returns labId ↔ Rules validate d.labId == labId
  ↓
No cross-tenant writes possible
```

**Consistency Score:** 95% (SGQ OAuth has gap — see SECURITY_AUDIT #10)

---

### 2. **Service-Hook-Component Separation — MOSTLY CONSISTENT**

**Layer Responsibilities:**

| Layer         | Responsibility                                 | Module Example                                |
| ------------- | ---------------------------------------------- | --------------------------------------------- |
| **Service**   | CRUD, Firestore ops, mapping, subscriptions    | `lotService.ts`, `laudoService.ts`            |
| **Hook**      | Real-time state, business logic, validation    | `useLotes()`, `useReclamacoes()`              |
| **Component** | UI rendering, user interaction, event handling | `NovaCorridaForm.tsx`, `ReviewLaudoModal.tsx` |

**Example (Bioquímica):**

```typescript
// Service: raw Firestore ops
export function subscribeLotes(
  labId: string,
  callback: (lotes: ControlMaterial[]) => void,
): Unsubscribe { /* ... */ }

// Hook: adds filtering, caching, error handling
export function useLotes() {
  const labId = useActiveLabId();
  const [lotes, setLotes] = useState<ControlMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeLotes(labId, (data) => {
      setLotes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [labId]);

  return { lotes, loading };
}

// Component: presentation + interaction
export function NovaCorridaForm() {
  const { lotes } = useLotes();
  const [selectedLotId, setSelectedLotId] = useState('');

  return <select value={selectedLotId} onChange={...}>
    {lotes.map(lot => <option key={lot.id}>{lot.lote}</option>)}
  </select>;
}
```

**Violation Found:**

- **Liberação module:** Some business logic (criticoDetector, stateMachine) lives in `utils/` (acceptable), but error messages in components may be too detailed

**Recommendation:**

- Extract "display logic" (formatting laudo status) to service layer
- Keep only interaction logic in components

**Consistency Score:** 85% (some business logic bleeding into components)

---

### 3. **Firestore Rules Architecture — STRONG**

**Three-Layer Auth Pattern:**

```
Layer 1: isAuthenticated()
  ↓
Layer 2: isActiveMemberOfLab(labId) → checks membership + active flag
  ↓
Layer 3: hasModuleAccess(module) → checks token claim
  ↓
Layer 4: Document-level validation (e.g., nfCompliant, sgqValidNew)
```

**Applied Consistently To:**

- `/lots` and `/ciq-*` collections ✓
- `/insumos` with NFCompliance check ✓
- `/sgq-documentos` with detailed validation ✓
- `/traceability-events` append-only ✓

**Strong Patterns:**

1. **Immutability enforcement** (sgqKeepsImmutable)
2. **Append-only events** (/audit, /traceability-events)
3. **Soft-delete gates** (deletadoEm field)
4. **Signature validation** (hasValidSignature in rules)

**Minor Gap:**

- `/controleTemperatura` rules are function-heavy (code duplication potential)

**Consistency Score:** 95%

---

### 4. **Cloud Functions Callable Pattern — MOSTLY CONSISTENT**

**Correct Pattern (recordRunBioquimica):**

```typescript
export const recordRunBioquimica = onCall(async (request) => {
  // 1. Auth + input validation
  if (!request.auth) throw new HttpsError('unauthenticated', '...');
  const parsed = InputSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', '...');

  // 2. Multi-tenant check (membership)
  const isMember = await isActiveMemberOfLab(uid, labId, db);
  if (!isMember) throw new HttpsError('permission-denied', '...');

  // 3. Load dependencies (lot, analitos)
  const [lotDoc, analitos] = await Promise.all([...]);

  // 4. Business logic (Westgard engine)
  const violations = checkWestgardCLSI(...);

  // 5. Atomic write (batch)
  const batch = db.batch();
  batch.set(...);
  batch.update(...);
  await batch.commit();

  // 6. Return result
  return { runId, status, violations, ... };
});
```

**Issues Found:**

1. **criarLaudo** — `assertLiberacaoAccess` good, but error messages could be more specific
2. **OAuth callback** — Missing state token validation (SECURITY_AUDIT #1)
3. **listarDocsDrive** — No rate limiting, N+1 Drive API calls (CODE_REVIEW #13)

**Consistency Score:** 80% (good pattern, some gaps in implementation)

---

### 5. **Schema & Type Definition Strategy — CONSISTENT**

**Pattern (from bioquimica/types/):**

```typescript
// Base entity
export interface ControlMaterial {
  id: string;
  labId: LabId;
  lote: string;
  validade: Timestamp;
  // ... fields
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

// Input DTO (omits computed fields)
export type ControlMaterialInput = Omit<
  ControlMaterial,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm'
>;

// Service returns entity; client never creates with `id` or `labId`
export async function createLotAvulso(labId: string, input: ControlMaterialInput): Promise<string>;
```

**Applied Consistently To:**

- ✓ Bioquímica (ControlMaterial, Run, Analito)
- ✓ Liberação (Laudo, LaudoVersion, ReleaseState)
- ✓ Reclamações (Reclamacao, RCA, SLA)

**Best Practice:** Input DTOs prevent ID injection attacks ✓

**Consistency Score:** 95%

---

## CROSS-MODULE PATTERNS

### 6. **Audit Trail Architecture**

**Pattern 1: Append-Only Events**

```typescript
// Immutable events (never update/delete)
match /traceability-events/{eventId} {
  allow create: if (...);
  allow update, delete: if false;
}

match /sgq-documentos-audit/{auditId} {
  allow create: if (...);
  allow update, delete: if false;
}
```

**Status:** ✓ Consistent across modules (bioquimica, liberação, reclamações)

**Pattern 2: Logical Signatures**

```typescript
// Format: { hash: string(64), operatorId, timestamp }
// Server-side generated, immutable
// Prevents tampering with operator identity
```

**Status:** ✓ Implemented in liberação, bioquimica
**Gap:** Not yet in reclamações or satisfacao modules

**Recommendation:**

- Audit trail completeness varies by module
- Add LogicalSignature to reclamações/feedback operations
- Document audit trail TTL (currently implicit: 7 years per RDC 978)

**Consistency Score:** 75% (good pattern, incomplete coverage)

---

### 7. **State Machine Pattern — Inconsistent**

**Liberação (Correct):**

```typescript
type ReleaseState = 'Pendente' | 'Auto-Liberado' | 'Liberado' | 'Rejeitado' | 'Retrabalho';

// Transitions:
export const ALLOWED_TRANSITIONS: Record<ReleaseState, ReleaseState[]> = {
  Pendente: ['Liberado', 'Retrabalho', 'Rejeitado'],
  'Auto-Liberado': ['Liberado', 'Retrabalho'],
  Liberado: [], // Terminal
  Rejeitado: ['Retrabalho'],
  Retrabalho: ['Liberado', 'Rejeitado'],
};

// Validation:
if (!ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)) {
  throw new Error(`Invalid transition: ${currentStatus} → ${newStatus}`);
}
```

**Reclamações (Partial):**

```typescript
type ReclamacaoStatus = 'Nova' | 'Em Analise' | 'Em Correcao' | 'Fechada' | 'Arquivada';

// No ALLOWED_TRANSITIONS table found (CODE_REVIEW gap)
```

**Issue:**

- Liberação has explicit state machine ✓
- Reclamações/Sugestões need to define allowed transitions

**Recommendation:**
Create `utils/stateMachine.ts` in each module:

```typescript
export const ReclamacaoStateMachine = {
  transitions: {
    Nova: ['Em Analise', 'Arquivada'],
    'Em Analise': ['Em Correcao', 'Fechada', 'Arquivada'],
    // ...
  },
  canTransition: (from: Status, to: Status) => {
    return (transitions[from] || []).includes(to);
  },
};
```

**Consistency Score:** 60% (some modules strict, others loose)

---

### 8. **Regulatory Annotation Strategy**

**Found:**

- RDC 978 references in comments (liberação, bioquimica)
- DICQ references in CLAUDE.md (not in code)
- ISO 15189 mentioned but not linked

**Pattern:**

```typescript
// Good:
// RDC 978 Art. 180: Westgard rules for CIQ
function checkWestgardCLSI(...) { ... }

// Could be better:
// File header with requirements traceability:
/**
 * Liberação de Laudos
 *
 * Regulatory Requirements:
 * - RDC 978/2025 Art. 167: Assinatura RT obrigatória
 * - RDC 978/2025 Art. 179: CIQ aplicável a analíticos
 * - DICQ 4.3.2.1: Laudo deve incluir referências
 * - ISO 15189:2022 cl. 7.5: Documento de saída
 *
 * @see ADR-0002 (audit chain architecture)
 */
```

**Recommendation:**

- Add compliance annotations to critical functions
- Create `docs/COMPLIANCE_MAP.md` (RDC req → code location)
- Link ADRs in function headers

**Consistency Score:** 70% (present but scattered)

---

## SCALABILITY ANALYSIS

### 9. **Real-Time Listener Strategy — GOOD**

**Scaling Pattern:**

```
Per user/lab:
- lotService.subscribeLotes() → 1 listener per view
- useLotes hook → reuses single listener
- Component unsubscribes on unmount

Firestore billing:
- 1 listener = 1 snapshot read/second (if data changes)
- No per-component listeners (aggregated in hook)
```

**Good:** Single responsibility for each listener  
**Concern:** If 50 labs × 10 techs per lab = 500 concurrent listeners (Firebase standard plan limit: unlimited reads, but billing scales)

**Recommendation:**

- Monitor active listener count (add to observability)
- Consider read caching (Zustand) for rarely-changing data
- Profile listener accumulation in multi-module scenarios

**Scalability Score:** 8/10 (good pattern, watch listener count)

---

### 10. **Database Indexing — DOCUMENTED**

**File:** `firestore.indexes.json`  
**Status:** ✓ Present

**Examples:**

- Composite index for `(deletadoEm, status, createdAt)` ✓
- Single-field indices for common filters ✓

**Concern:**

- New queries in Phases 11-12 may require new indices
- No evidence of index review before deploy

**Recommendation:**

- Add to deploy checklist: "Run `firebase firestore:indexes list` and verify all needed indices are present"
- Document index creation time (can be >10 min for large collections)

**Indexing Score:** 8/10 (complete, but deploy process unclear)

---

## DEPENDENCY MANAGEMENT

### 11. **External Library Usage**

**Appropriate (Core):**

- `firebase-admin` (13.8.0) ✓
- `firebase-functions` (7.2.5) ✓
- `zod` (3.25.76) ✓ Input validation
- `google-auth-library` (9.14.0) ✓ OAuth
- `nodemailer` (8.0.7) ✓ Email

**Review Needed:**

- `@google/generative-ai` (0.17.0) — Gemini API usage in reclamações
  - Size: ~200KB uncompressed
  - Version: recent (good)
  - Pattern: lazy-loaded? Not examined

- `xlsx` (0.18.5) — Spreadsheet parsing
  - Size: 170KB gzip
  - Pattern: Server-side only ✓ (functions/)
  - Risk: Medium (binary parsing, untrusted input)

- `puppeteer` (22.15.0) — Browser automation
  - Size: 80MB (not in bundle, functions-only)
  - Pattern: Server-side only ✓
  - Risk: Low (isolated environment)

**Recommendation:**

- Audit Gemini integration (see SECURITY_AUDIT #3 for input validation)
- Monitor xlsx security updates (parsing PDFs/XLSX is high-risk)
- Document when each large library is loaded

**Dependency Score:** 8/10 (mostly good, some large libs)

---

## DECISION HISTORY ALIGNMENT

### 12. **ADR Adherence**

**ADRs Noted:**

- ADR-0002: Multi-tenant pattern (inferred from rules)
- ADR-0006: Qualificações (operator certifications)
- ADR-0012: SGD Drive Importer (Phase 12)

**Alignment Check:**

- ✓ Multi-tenant isolation follows pattern
- ✓ Qualificações schema present in rules
- ⚠️ SGD architecture not fully reviewed (see ARCHITECTURE gap #13)

**Recommendation:**

- Create `docs/adr/DECISION_LOG.md` summarizing active decisions
- Link ADRs from code comments (e.g., "per ADR-0002, always include labId")

---

## IDENTIFIED GAPS

### 13. **SGD (Phase 12) Architecture Not Fully Specified**

**Concerns:**

1. OAuth flow (state validation missing — SECURITY_AUDIT #1)
2. Drive API usage patterns (N+1 queries — CODE_REVIEW #13)
3. Document versioning strategy unclear
4. Batch import rollback mechanism not documented

**Recommendation:**

- Create `src/features/sgd/ARCHITECTURE.md` documenting:
  - OAuth token lifecycle
  - Drive API batching strategy
  - Document import state machine
  - Error recovery/rollback

---

### 14. **Westgard Engine History Window — Under-Specified**

**Current State:**

```typescript
// Definition unclear: how many previous runs should history contain?
export interface WestgardCheckInput {
  current: { value: number; ... };
  history: Array<{ value: number; ... }>;
  stats: { mean: number; sd: number };
}
```

**Issue:**

- Rule 2-2s needs 2 consecutive runs
- Rule R-4s needs 2 consecutive runs
- But which 2? Latest? Last N with same (analito, nivel, equipment)?

**Recommendation:**
Document in code:

```typescript
/**
 * Westgard CLSI Check
 *
 * Rules checked:
 * - 1-2s: single point beyond ±2σ (warn)
 * - 1-3s: single point beyond ±3σ (reject)
 * - 2-2s: 2 consecutive points beyond ±2σ, same side (reject)
 * - R-4s: range between 2 consecutive points > 4σ (reject)
 *
 * History: Most recent N runs for same (analitoId, nivelId, equipmentId)
 *   - If N < 1: cannot check 2-2s/R-4s
 *   - If N >= 1: check against previous run
 *   - Window size: unlimited (all runs for this lot)
 *
 * @param input.history - ordered by descending capturaEm (newest first)
 */
export function checkWestgardCLSI(input: WestgardCheckInput): WestgardViolation[];
```

---

### 15. **Error Handling Strategy — Not Unified**

**Patterns Observed:**

- liberação/criarLaudo: `HttpsError` with message
- bioquimica/recordRunBioquimica: `HttpsError` with message
- sgq/oauthCallbackDrive: `HttpsError` on OAuth failure, but state missing

**Recommendation:**
Create `functions/src/shared/errorHandling.ts`:

```typescript
export const AppError = {
  // Client-visible (user-safe) messages
  userMessages: {
    INVALID_INPUT: 'Dados inválidos. Verifique os campos.',
    UNAUTHORIZED: 'Sem permissão para esta ação.',
    NOT_FOUND: 'Recurso não encontrado.',
  },

  // Internal (logged, not returned to client)
  internalMessages: {
    INVALID_INPUT: (field: string) => `Validation failed for ${field}`,
    UNAUTHORIZED: (uid: string, action: string) => `User ${uid} tried ${action} without permission`,
    NOT_FOUND: (id: string) => `Document not found: ${id}`,
  },

  // Helper to throw with both messages
  throw: (code: string, context: any) => {
    console.error(`[${code}]`, context);
    throw new HttpsError(mapToHttpCode(code), AppError.userMessages[code] || 'Erro interno');
  },
};

// Usage:
AppError.throw('UNAUTHORIZED', {
  uid,
  labId,
  requiredRole: 'RT',
  actualRole: role,
});
```

**Consistency Score:** 60% (inconsistent message handling)

---

## SUMMARY SCORECARD

| Aspect                  | Score | Status | Notes                                  |
| ----------------------- | ----- | ------ | -------------------------------------- |
| Multi-tenant isolation  | 95%   | ✓      | Consistent, defensible                 |
| Service-hook-component  | 85%   | ⚠️     | Business logic sometimes in components |
| Firestore rules         | 95%   | ✓      | Strong, well-documented                |
| Cloud Functions pattern | 80%   | ⚠️     | Good structure, some gaps              |
| Type safety             | 85%   | ⚠️     | `any` casts remain                     |
| Audit trail             | 75%   | ⚠️     | Good pattern, incomplete coverage      |
| State machines          | 60%   | ⚠️     | Inconsistent between modules           |
| Regulatory annotations  | 70%   | ⚠️     | Present but scattered                  |
| Error handling          | 60%   | ⚠️     | Inconsistent strategy                  |
| Real-time listeners     | 80%   | ✓      | Good pattern, monitor scale            |
| Dependency management   | 80%   | ✓      | Mostly good choices                    |
| Documentation           | 75%   | ⚠️     | Present but needs linking              |

**Overall Architecture Score: 8.1 / 10**

---

## ACTION ITEMS

### Must Fix (Blocker)

1. OAuth state validation (SECURITY_AUDIT #1)
2. Input schema validation (SECURITY_AUDIT #3)
3. Remove `any` type casts (CODE_REVIEW #18)

### Should Fix (Sprint 1)

1. Consolidate error handling strategy
2. Define state machine transitions for all modules
3. Specify Westgard history window clearly
4. Document SGD architecture
5. Add regulatory annotations to critical functions

### Nice to Have (Sprint 2)

1. Unify audit trail patterns
2. Add observability for listener count
3. Create compliance traceability map
4. Profile bundle size per module
