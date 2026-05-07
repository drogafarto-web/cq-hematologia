# CODE REVIEW — Phases 9–12
## Quality, Performance & Design Patterns

**Date:** 2026-05-06  
**Scope:** 21 commits across 4 phases  
**Focus:** Code structure, type safety, performance, testability

---

## STRONG PATTERNS (keep doing this)

### 1. **Westgard Engine — Defensive Math**
**File:** `src/features/bioquimica/utils/westgardRulesCLSI.ts`  
**Pattern:** ✓ EXEMPLARY

```typescript
// Guard against invalid stats
if (
  !Number.isFinite(input.stats.mean) ||
  !Number.isFinite(input.stats.sd) ||
  input.stats.sd <= 0
) {
  return [];
}

// Guard against invalid z-score
if (!Number.isFinite(z)) {
  return [];
}
```

**Why This Works:**
- Prevents division by zero (sd <= 0)
- Catches NaN propagation early
- Returns empty violations (safe fallback) instead of throwing
- Matches compliance: "invalid data = no control rule applies"

**Apply To:** All statistical engines (KPI calculators, analytics)

---

### 2. **Cloud Function Input Validation with Zod**
**File:** `functions/src/liberacao/validators.ts`  
**Pattern:** ✓ STRONG

```typescript
const CriarLaudoInputSchema = z.object({
  labId: z.string().min(1),
  runIds: z.array(z.string().min(1)).min(1),
  pacienteId: z.string().min(1),
  medicoSolicitanteId: z.string().min(1),
  exames: z.array(z.record(z.any())).min(1), // ← Issue #3 (separate review)
});

// In callable:
const parsed = CriarLaudoInputSchema.safeParse(request.data);
if (!parsed.success) {
  throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
}
```

**Strengths:**
- Centralized schema definition (single source of truth)
- Type inference from schema (TS type = Zod output)
- Early validation gate (fail fast)
- Distinguishes parse errors from runtime errors

**Recommendation:**
- Add `.describe()` to fields for better error messages
- Create shared `CommonSchemas` for repeated patterns (labId, userId, etc.)

---

### 3. **Multi-Tenant Path Validation**
**File:** `firestore.rules`, lines 94-142  
**Pattern:** ✓ STRONG

```typescript
function isActiveMemberOfLab(labId) {
  let memberPath = /databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid);
  return exists(memberPath) && get(memberPath).data.active == true;
}

// Applied to all document patterns:
match /lots/{lotId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('hematologia'));
}
```

**Strengths:**
- Two-layer isolation: labId from path + membership verification
- Module claim added as 3rd layer (defense in depth)
- Consistent pattern across all collections
- Prevents cross-tenant reads

**Consistency Check:** Applied uniformly to:
- ✓ `/lots`, `/ciq-imuno`, `/ciq-coagulacao`, `/ciq-uroanalise`
- ✓ `/insumos`, `/produtos-insumos`, `/equipamentos`
- ✓ `/sgq-documentos`, `/traceability-events`

---

### 4. **Atomic Batch Operations**
**File:** `functions/src/bioquimica/recordRunBioquimica.ts`, lines 200-219  
**Pattern:** ✓ STRONG

```typescript
const batch = db.batch();

// Write run
batch.set(db.doc(`labs/${labId}/bioquimica/root/runs/${runId}`), run);

// Update lot: increment approvalCount
const lotRef = db.doc(`labs/${labId}/bioquimica/root/lotes/${lotId}`);
batch.update(lotRef, {
  approvalCount: (lotData.approvalCount || 0) + 1,
  lastRunAt: admin.firestore.Timestamp.now(),
});

await batch.commit(); // All-or-nothing
```

**Why This Works:**
- Prevents partial updates (corrupted state)
- Matches compliance requirement: "every run increments lot counter atomically"
- Firebase transaction semantics ensure no interleaving

**Apply To:** All multi-document writes

---

### 5. **Soft-Delete Pattern (RN-06)**
**File:** `src/features/bioquimica/services/lotService.ts`, lines 215-223  
**Pattern:** ✓ STRONG

```typescript
export async function softDeleteLot(
  labId: string,
  lotId: string,
): Promise<void> {
  const lotRef = getLotDocRef(labId, lotId);
  await updateDoc(lotRef, {
    deletadoEm: serverTimestamp(), // Never hard-delete
  });
}

export async function restoreLot(
  labId: string,
  lotId: string,
): Promise<void> {
  const lotRef = getLotDocRef(labId, lotId);
  await updateDoc(lotRef, {
    deletadoEm: null, // Revert soft-delete
  });
}
```

**Strengths:**
- Preserves audit trail (can always see what was deleted and when)
- Supports recovery (accidental deletes reversible)
- Meets RDC 978 audit requirements
- Queries filter by `deletadoEm == null` to hide deleted docs

**Consistent Usage:** 
- ✓ All core entity services follow this pattern
- ⚠️ Verify deletion is always soft in client code (`deleteDoc` grep needed)

---

## QUALITY GAPS (fix in next sprint)

### 6. **Hook Cleanup Patterns — Incomplete Unsubscribe**
**File:** `src/features/bioquimica/hooks/useLotes.ts` (inferred)  
**Issue:** Standard hook pattern not thoroughly reviewed

**Pattern to Verify:**
```typescript
// GOOD:
export function useLotes(): { lotes: ControlMaterial[] } {
  const [lotes, setLotes] = useState<ControlMaterial[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeLotes(labId, (data) => {
      setLotes(data);
    });
    
    return () => unsubscribe(); // ← Cleanup REQUIRED
  }, [labId]);

  return { lotes };
}

// BAD (memory leak):
export function useLotes(): { lotes: ControlMaterial[] } {
  const [lotes, setLotes] = useState<ControlMaterial[]>([]);

  useEffect(() => {
    subscribeLotes(labId, (data) => {
      setLotes(data);
    });
    // ← Missing cleanup function — listener never unsubscribes
  }, [labId]);

  return { lotes };
}
```

**Recommendation:** Audit all hooks with onSnapshot:
```bash
grep -r "onSnapshot" src/features --include="*.ts" --include="*.tsx" | \
  grep -v "return () =>" | \
  grep -v "return unsubscribe"
```

---

### 7. **Error Handling — User vs. System Errors**
**File:** `functions/src/liberacao/criarLaudo.ts`, lines 120-125  
**Issue:** Generic error handling hides useful context

```typescript
try {
  lotDoc = await db.doc(`labs/${labId}/bioquimica/root/lotes/${lotId}`).get();
  if (!lotDoc.exists) {
    throw new HttpsError('not-found', 'Lot not found');
  }
  // ...
} catch (err) {
  if (err instanceof HttpsError) throw err;
  throw new HttpsError('internal', 'Failed to load lot or analitos'); // ← Too generic
}
```

**Problem:**
- Developer can't distinguish "document missing" from "database error"
- Logs don't show actual error reason

**Fix:**
```typescript
try {
  lotDoc = await db.doc(`labs/${labId}/bioquimica/root/lotes/${lotId}`).get();
  if (!lotDoc.exists) {
    throw new HttpsError('not-found', 'Lot not found');
  }
  
  const analitoPromises = analitoIds.map((id) =>
    db.doc(`labs/${labId}/bioquimica/root/analitos/${id}`).get()
      .catch(err => {
        console.error(`[criarLaudo] Failed to load analito ${id}:`, err);
        throw err;
      })
  );
  const analitoSnapshots = await Promise.all(analitoPromises);
  
} catch (err) {
  if (err instanceof HttpsError) throw err;
  
  console.error('[criarLaudo] Database error:', {
    uid,
    labId,
    lotId,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  
  throw new HttpsError(
    'internal',
    'Falha ao carregar dados do lote — contate suporte'
  );
}
```

---

### 8. **Component Coupling — State vs. Props**
**File:** `src/features/bioquimica/components/NovaCorridaForm.tsx`, lines 61-69  
**Issue:** Too many useState calls, no parent coordination

```typescript
const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
const [selectedAnalitoIds, setSelectedAnalitoIds] = useState<string[]>([]);
const [results, setResults] = useState<Record<string, number[]>>({});
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
const [switchingLot, setSwitchingLot] = useState<string | null>(null);
```

**Problem:**
- 6 independent state variables
- Hard to coordinate state (e.g., clear all when equipment changes?)
- Difficult to pass state up to parent for context

**Recommendation:**
```typescript
interface FormState {
  selectedEquipmentId: string;
  selectedAnalitoIds: string[];
  results: Record<string, number[]>;
  submitting: boolean;
  error: string | null;
  switchingLot: string | null;
}

const [state, setState] = useState<FormState>({
  selectedEquipmentId: '',
  selectedAnalitoIds: [],
  results: {},
  submitting: false,
  error: null,
  switchingLot: null,
});

const handleEquipmentChange = (equipmentId: string) => {
  setState(prev => ({
    ...prev,
    selectedEquipmentId: equipmentId,
    results: {}, // ← Clear results when equipment changes
    error: null, // ← Clear error
  }));
};
```

---

### 9. **Console.log in Production Code**
**Files:**
- `src/features/bioquimica/components/NovaCorridaForm.tsx`, line 94
- `src/features/bioquimica/services/lotService.ts`, line 193

**Issue:**
```typescript
console.log('TODO: recordRunBioquimica', {
  labId,
  equipmentId: selectedEquipmentId,
  // ... full payload to console
});
```

**Problem:**
- Sensitive data (labId, operatorId) logged to browser console
- User can screenshot and leak data
- TODO comments indicate incomplete code in production build

**Fix:**
- Remove all `console.log` from production code
- Use `console.debug` for development (only in development builds)
- Use structured logging service for errors/warnings

```typescript
// In production:
import { logger } from '../services/logger';

if (process.env.NODE_ENV === 'development') {
  console.debug('[NovaCorridaForm] TODO: recordRunBioquimica', {
    equipmentId: selectedEquipmentId,
    analitoCount: selectedAnalitoIds.length,
  });
}

// Or use logging service:
logger.warn('TODO: recordRunBioquimica not yet implemented', {
  level: 'debug',
  context: 'bioquimica',
});
```

---

### 10. **Race Condition Pattern in Async Operations**
**Pattern:** Likely in `useLaudoActions.ts` (not examined)  
**Issue:** Double-submit vulnerability

```typescript
// VULNERABLE:
const handleLiberate = async () => {
  setSubmitting(true);
  try {
    const result = await liberarLaudoCallable(laudoId, signature);
    showSuccess(`Laudo liberado: ${result.laudoId}`);
    await refetchLaudo(); // ← What if user clicked button again?
  } catch (err) {
    showError('Erro ao liberar laudo');
  } finally {
    setSubmitting(false);
  }
};

// If user clicks twice quickly:
// 1. First click: submitting=true (button disabled? maybe)
// 2. Network delay (2s)
// 3. User clicks button again (is it disabled?)
// 4. Both requests hit server
// 5. First request succeeds, status changes to 'Liberado'
// 6. Second request fails (laudo already liberado)
// 7. Error shown to user (confusing)
```

**Correct Pattern:**
```typescript
const [liberating, setLiberating] = useState(false);
const liberateRef = useRef<Promise<any> | null>(null);

const handleLiberate = async () => {
  // Already liberating? Prevent re-entry
  if (liberateRef.current) {
    console.debug('[ReviewLaudoModal] Liberation already in progress');
    return;
  }

  setLiberating(true);
  
  const liberationPromise = (async () => {
    try {
      const result = await liberarLaudoCallable(laudoId, signature);
      showSuccess(`Laudo liberado: ${result.laudoId}`);
      
      // Optimistically update UI
      setLaudoStatus('Liberado');
      
      // But also refetch to stay in sync
      await refetchLaudo();
    } catch (err) {
      // Only show error if it wasn't already resolved
      if (laudoStatus !== 'Liberado') {
        showError(err instanceof Error ? err.message : 'Erro ao liberar laudo');
      }
    }
  })();

  liberateRef.current = liberationPromise;
  
  try {
    await liberationPromise;
  } finally {
    liberateRef.current = null;
    setLiberating(false);
  }
};

// Button:
<button
  onClick={handleLiberate}
  disabled={liberating || laudoStatus === 'Liberado'}
  className="..."
>
  {liberating ? 'Liberando...' : 'Liberar'}
</button>
```

---

## PERFORMANCE FINDINGS

### 11. **Bundle Size — No Chunking Analysis Provided**
**File:** `vite.config.ts`  
**Issue:** No evidence of chunk size monitoring

**Recommendation:**
```typescript
// In vite.config.ts:
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-firebase': ['firebase/firestore', 'firebase/auth', 'firebase/functions'],
        'vendor-ui': ['react', 'react-dom'],
        'module-bioquimica': ['src/features/bioquimica'],
        'module-liberacao': ['src/features/liberacao'],
        'module-reclamacoes': ['src/features/reclamacoes'],
        'module-sgq': ['src/features/sgq'],
      },
    },
  },
  chunkSizeWarningLimit: 1000, // 1MB
},
```

**Monitoring:**
```bash
npm run build && npm run analyze
# Output should show chunk sizes <60KB each (except vendors)
```

---

### 12. **React.memo — Unnecessary in Some Components**
**Pattern:** Not deeply reviewed, but recommendation:

```typescript
// Check if this component needs memo:
function ReviewLaudoModal({ laudo, onClose }) {
  const [localState, setLocalState] = useState(...);
  
  // If parent re-renders but props haven't changed,
  // should this component re-render? Usually NO.
  
  return <div>...</div>;
}

// Apply memo:
export const ReviewLaudoModal = React.memo(
  function ReviewLaudoModal({ laudo, onClose }) {
    // ...
  },
  (prevProps, nextProps) => {
    // Custom equality check:
    // re-render if laudo.id changed or onClose reference changed
    return prevProps.laudo.id === nextProps.laudo.id &&
           prevProps.onClose === nextProps.onClose;
  }
);
```

---

### 13. **Listener Accumulation Risk**
**Pattern:** All hooks with onSnapshot  
**Issue:** If a hook is used multiple times in same component, listeners accumulate

```typescript
// BAD:
function AnalyticsDashboard() {
  const { lotes } = useLotes(); // ← listener 1
  const { lotes: allLotes } = useLotes(); // ← listener 2 (duplicate!)
  // ...
}

// GOOD:
function AnalyticsDashboard() {
  const { lotes } = useLotes();
  // Reuse lotes, don't call hook twice
}
```

**Recommendation:** Add ESLint rule to catch duplicate hook calls

---

## TESTING OBSERVATIONS

### 14. **Test Coverage — E2E Only**
**File:** `e2e/bioquimica.spec.ts`  
**Status:** ⚠️ MINIMAL

**Present:**
- E2E tests for happy path ✓

**Missing:**
- Unit tests for `westgardRulesCLSI` (exists but minimal)
- Unit tests for `lotService` CRUD
- Unit tests for Cloud Function validators
- Integration tests for `recordRunBioquimica` callable

**Recommendation:**
```typescript
// tests/features/bioquimica/westgardRulesCLSI.test.ts
describe('westgardRulesCLSI', () => {
  describe('checkWestgardCLSI', () => {
    it('should flag 1-3s violation (>3σ)', () => {
      const violations = checkWestgardCLSI({
        current: { value: 13, analitoId: 'glc', nivelId: 'n1', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 10, sd: 1 },
      });
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('1-3s');
      expect(violations[0].severity).toBe('reject');
    });

    it('should NOT flag valid value (within 2σ)', () => {
      const violations = checkWestgardCLSI({
        current: { value: 11.5, analitoId: 'glc', nivelId: 'n1', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 10, sd: 1 },
      });
      expect(violations).toHaveLength(0);
    });

    it('should handle edge case: sd=0 (invalid)', () => {
      const violations = checkWestgardCLSI({
        current: { value: 5, analitoId: 'glc', nivelId: 'n1', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 10, sd: 0 }, // ← Invalid
      });
      expect(violations).toHaveLength(0); // Safe fallback
    });

    // ... more test cases
  });
});
```

**Priority:** Add to Phase 9 Sprint 2

---

### 15. **Firestore Rules Unit Tests**
**Status:** ⚠️ MANUAL ONLY

**Finding:**
```
// From .claude/rules/firestore-security.md:
// "Rule tests live in emulator" — no automated test framework detected
```

**Recommendation:**
```typescript
// tests/firestore.rules.test.ts
import { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await RulesTestEnvironment.create({
    projectId: 'test-project',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

describe('firestore.rules — /lots access', () => {
  it('should allow read if user is active member with hematologia claim', async () => {
    const db = testEnv.authenticatedContext('user123', {
      modules: { hematologia: true },
    });
    
    // Setup lab structure
    const labRef = testEnv.database().doc('labs/lab1');
    await labRef.set({ name: 'Test Lab' });
    
    const memberRef = testEnv.database().doc('labs/lab1/members/user123');
    await memberRef.set({ active: true, role: 'Técnico' });
    
    const lotRef = db.collection('labs/lab1/lots').doc('lot1');
    await lotRef.set({ lote: 'L001', labId: 'lab1' });
    
    // Should succeed
    await expect(lotRef.get()).resolves.toBeDefined();
  });

  it('should deny read if user lacks hematologia claim', async () => {
    const db = testEnv.authenticatedContext('user456', {
      modules: { }, // ← No hematologia claim
    });
    
    const lotRef = db.collection('labs/lab1/lots').doc('lot1');
    await expect(lotRef.get()).rejects.toThrow();
  });
});
```

---

## DESIGN PATTERNS & CONSISTENCY

### 16. **Service Layer — Consistent Naming**
**Status:** ✓ MOSTLY GOOD

**Pattern Observed:**
```typescript
// Good naming:
subscribeLotes(labId, callback) → real-time
subscribeLotById(labId, lotId, callback) → real-time by ID
createLotAvulso(labId, input) → create
softDeleteLot(labId, lotId) → soft-delete
```

**Recommendation:**
- Always prefix with operation type (subscribe, get, create, update, soft*)
- Always include labId as first parameter (multi-tenant)
- Document TTL/cleanup behavior (e.g., "returns Unsubscribe")

---

### 17. **Hook Naming — Usage Intent Clear**
**Status:** ✓ GOOD

**Examples:**
```typescript
useEquipamentos()      → returns { equipamentos }
useLotes()             → returns { lotes }
useActiveLotForEquipment(equipmentId) → returns { lot }
```

**Pattern:** All hooks clearly indicate what they return by name

---

### 18. **Type Safety — Generics vs. Any**
**File:** `src/features/bioquimica/services/lotService.ts`, line 118  
**Issue:** `manufacturerStats: any` cast

```typescript
// Instead of:
const manufacturerStats: any = {};

// Use:
const manufacturerStats: Record<string, Record<string, { mean: number; sd: number }>> = {};
```

---

## SUMMARY TABLE

| ID | Finding | Category | Severity | Status |
|---|---|---|---|---|
| 1-5 | Strong patterns | Code Quality | N/A | Keep doing ✓ |
| 6 | Hook cleanup | Memory | MEDIUM | Audit needed |
| 7 | Error handling | Code Quality | MEDIUM | Improve msgs |
| 8 | Component state | Architecture | MEDIUM | Consolidate |
| 9 | Console.log | Security | LOW | Remove all |
| 10 | Race conditions | Concurrency | HIGH | Fix pattern |
| 11 | Bundle chunks | Performance | LOW | Monitor |
| 12 | React.memo | Performance | LOW | Profile first |
| 13 | Listener dups | Memory | MEDIUM | Prevent via lint |
| 14 | Unit tests | Testing | HIGH | Add coverage |
| 15 | Rules tests | Testing | HIGH | Automate |
| 16 | Service naming | Consistency | LOW | Continue |
| 17 | Hook naming | Consistency | LOW | Good ✓ |
| 18 | Type safety | Type Safety | MEDIUM | Remove `any` |

---

## RECOMMENDATIONS

### Sprint 1 (Next 5 days)
- Remove all `console.log` (Issue #9)
- Fix race condition pattern (Issue #10)
- Add unit tests for `westgardRulesCLSI` (Issue #14)
- Consolidate component state (Issue #8)
- Review all error messages (Issue #7)

### Sprint 2 (Next 10 days)
- Automate Firestore rules tests (Issue #15)
- Add listener duplicate detection (Issue #13)
- Profile bundle chunks (Issue #11)
- Audit hook cleanup patterns (Issue #6)
- Remove all `any` type casts (Issue #18)

### Quality Gates
Before next production deploy:
- All MEDIUM issues above must be fixed
- Unit test coverage >70% for new modules
- Bundle size monitoring enabled

