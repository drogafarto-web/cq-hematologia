# CEQ — Ensaios de Aptidão Externa (External Proficiency Program)

**Module Status:** Production  
**Date Implemented:** 2026-05-05  
**Related ADRs:** ADR 0003 (NC module), ADR 0005 (HMAC audit)

---

## What is CEQ?

CEQ (Ensaios de Aptidão Externa) is the HC Quality module for participation in external proficiency testing (PT) programs from providers like Controllab and BIPEA. Labs receive blind samples, analyze them, and compare results against provider reference values using Z-score analysis.

**Key Feature:** Automatic NC creation when |Z| ≥ 3 (unsatisfactory results).

---

## Architecture

```
src/features/ceq/
├── types/CEQ.ts              # Data models (Participacao, Amostra, Resultado)
├── services/ceqService.ts    # Client-side CRUD + Z-score calculation
├── hooks/useCEQ.ts           # React hook with real-time listeners
├── components/
│   ├── CEQParticipacaoForm.tsx   # Enroll in PT program
│   ├── CEQResultadoEntry.tsx     # Record result + Z-score display
│   └── CEQDashboard.tsx          # Overview dashboard
├── __tests__/
│   └── ceqService.test.ts       # Z-score calculation tests
└── index.ts                  # Module exports

functions/src/modules/ceq/
├── types.ts                  # CF request/response types
├── ceq.ts                    # Cloud Functions (callables + triggers)
├── ceq.test.ts              # CF tests
└── index.ts                 # Module exports
```

---

## Data Model

### CEQParticipacao

**Collection:** `/labs/{labId}/ceq-participacoes/{participacaoId}`

Represents enrollment in a PT program scheme (e.g., "Hematologia Básica" from Controllab).

```typescript
interface CEQParticipacao {
  provedorId: string; // 'controllab', 'eqa-provider-x'
  provedorNome: string; // Display name
  esquema: string; // 'hematologia-basica', 'bioquimica-rotina'
  dataInicio: Date; // Enrollment start
  dataFim?: Date; // Enrollment end (if suspended)
  frequencia: 'mensal' | 'bimestral' | 'trimestral' | 'anual';
  analitosParticipados: string[]; // Analyte IDs enrolled
  ativo: boolean; // Active participation flag
}
```

### CEQAmostra

**Collection:** `/labs/{labId}/ceq-amostras/{amostraId}`

Represents a physical sample received from PT provider in a specific round.

```typescript
interface CEQAmostra {
  ceqParticipacaoId: string; // FK to CEQParticipacao
  rodada: number; // Round number (e.g., 5)
  ano: number; // Year (e.g., 2026)
  dataRecepcao: Date; // When lab received it
  status: 'recebida' | 'em_analise' | 'resultado_lancado' | 'processada';
}
```

### CEQResultado

**Collection:** `/labs/{labId}/ceq-resultados/{resultadoId}`

Represents one analyte result for one sample with Z-score calculation.

```typescript
interface CEQResultado {
  ceqAmostraId: string; // FK to sample
  ceqParticipacaoId: string; // FK to enrollment
  analyteId: string; // Which analyte (e.g., 'hb')
  analyteName: string; // 'Hemoglobin'

  // What we measured
  valorObtido: number; // Our result
  unidade: string; // Unit (e.g., 'g/dL')

  // Provider reference
  valorReferencia: number; // Provider's reference value
  desvioEstimado: number; // Provider's estimated SD

  // Calculation
  zScore: number; // (valorObtido - valorReferencia) / desvioEstimado
  interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria';

  // NC integration
  ncAutomaticaCriadaId?: string; // FK to NaoConformidade if |Z| >= 3
  temNCGrave?: boolean; // Flag for |Z| >= 3
}
```

---

## Z-Score Calculation

**Formula:** Z = (ValueObtained - ValueReference) / SD

**Interpretation (ISO 13528:2015):**

- |Z| < 2: **Satisfactory** (acceptable) ✓
- 2 ≤ |Z| < 3: **Questionable** (warning) ⚠️
- |Z| ≥ 3: **Unsatisfactory** (rejection) 🚨 → AUTO-NC

When |Z| ≥ 3, Cloud Function automatically creates a critical NC with:

- `severidade: 'grave'`
- `bloqueiaOperacoes: true` (blocks lab operations until resolved)
- `origem: 'controle'`
- Description includes analyte, Z-score, sample ID

---

## Auto-NC Creation (NC Integration)

**Trigger:** Cloud Function `lacarCEQResultado()` creates CEQResultado

**Flow:**

1. Client calculates Z-score (validation only)
2. Client calls `lancarCEQResultado()`
3. Cloud Function validates Z-score server-side
4. If |Z| ≥ 3:
   - Creates CEQResultado with `temNCGrave: true`
   - Calls NC module to create critical NC (grave, blocking)
   - Updates CEQResultado with `ncAutomaticaCriadaId`
   - Lab operations blocked until NC resolved (via NC CAPA workflow)
5. Updates CEQAmostra status to `resultado_lancado`

**Example NC Created:**

```
Número: NC-2026-0042
Origem: controle (CEQ)
Descrição: CEQ insatisfatória: Hemoglobin | Z-Score: 3.5 | Amostra amo-789
Severidade: grave
Status: aberta
bloqueiaOperacoes: true
```

**Unblocking:** Lab must complete NC CAPA workflow:

1. Investigação (investigate root cause)
2. Ação Corretiva (plan + execute corrective action)
3. Verificação Eficácia (verify fix worked)
4. NC closes → bloqueiaOperacoes becomes false

---

## API

### Client-Side Service

**Create Participation:**

```typescript
const participacao = await criarCEQParticipacao(
  labId,
  { provedorId, esquema, dataInicio, frequencia, analitosParticipados },
  uid,
);
```

**Receive Sample:**

```typescript
const amostra = await receberCEQAmostra(
  labId,
  { ceqParticipacaoId, rodada, ano, dataRecepcao },
  uid,
);
```

**Record Result (triggers auto-NC if |Z| ≥ 3):**

```typescript
const resultado = await lancarCEQResultado(
  labId,
  { ceqAmostraId, analyteId, analyteName, valorObtido, unidade, valorReferencia, desvioEstimado },
  uid,
);
// resultado.temNCGrave will be true if |Z| >= 3
// resultado.ncAutomaticaCriadaId will contain NC ID
```

**Calculate Z-Score (client-side):**

```typescript
const { zScore, interpretacao } = calcularZScore(valorObtido, valorReferencia, desvioEstimado);
```

### React Hook

```typescript
const {
  participacoes, // Active PT enrollments
  amostras, // Samples for selected enrollment
  resultados, // Results for selected sample
  selectedParticipacao,
  selectedAmostra,
  loading,
  error,
  criarParticipacao,
  receberAmostra,
  lancarResultado,
  validar,
} = useCEQ();
```

---

## Cloud Functions

### createCEQParticipacao()

**Callable**  
Creates new PT program enrollment

```typescript
const response = await firebase.functions().httpsCallable('createCEQParticipacao')({
  labId: 'lab-123',
  input: { provedorId, esquema, dataInicio, frequencia, analitosParticipados },
});
// Returns: { success, participacaoId, message }
```

### receiveCEQAmostra()

**Callable**  
Record sample receipt

```typescript
const response = await firebase.functions().httpsCallable('receiveCEQAmostra')({
  labId: 'lab-123',
  ceqParticipacaoId: 'par-456',
  rodada: 5,
  ano: 2026,
  dataRecepcao: '2026-05-03',
});
// Returns: { success, amostraId, message }
```

### lacarCEQResultado()

**Callable**  
Record result + calculate Z-score + auto-create NC

```typescript
const response = await firebase.functions().httpsCallable('lacarCEQResultado')({
  labId: 'lab-123',
  ceqAmostraId: 'amo-456',
  ceqParticipacaoId: 'par-789',
  analyteId: 'hb',
  analyteName: 'Hemoglobin',
  valorObtido: 13.6,
  unidade: 'g/dL',
  valorReferencia: 13.5,
  desvioEstimado: 0.3,
});
// Returns: {
//   success: true,
//   resultadoId: 'res-123',
//   zScore: 0.333,
//   interpretacao: 'satisfatoria',
//   ncAutomaticaCriadaId?: 'nc-456',  // If |Z| >= 3
//   ncNumero?: 'NC-2026-0042'
// }
```

### onCEQResultadoValidado() [Trigger]

Auto-updates CEQAmostra status to `processada` when all its resultados are validated.

---

## Testing

### Service Tests

**File:** `src/features/ceq/__tests__/ceqService.test.ts`

Coverage: Z-score calculation, interpretacao logic, NC creation thresholds

- ✓ Satisfactory results (|Z| < 2)
- ✓ Questionable results (2 ≤ |Z| < 3)
- ✓ Unsatisfactory results (|Z| ≥ 3)
- ✓ Edge cases (zero SD, negative values, decimal precision)
- ✓ Real-world PT scenarios (hemoglobin, glucose, creatinine)
- ✓ NC creation logic (threshold >= 3)

### Cloud Function Tests

**File:** `functions/src/modules/ceq/ceq.test.ts`

Coverage: Server-side Z-score validation, NC number generation

- ✓ Z-score calculation (server-side)
- ✓ NC auto-creation trigger (|Z| ≥ 3)
- ✓ NC number format (NC-{YYYY}-{seq})
- ✓ Request validation
- ✓ Edge cases and real-world scenarios

**Overall Coverage:** >80%

---

## Integration Points

### 1. NC Module (ADR 0003)

When |Z| ≥ 3, CEQ automatically creates critical NC via `functions/src/modules/qualidade/naoConformidade.ts::openNaoConformidade()`.

### 2. Chart Module

Reuses Levey-Jennings chart pattern from `chart/LeveyJenningsChart.tsx` for Z-score visualization (future enhancement).

### 3. Audit Trail (ADR 0005)

CEQ operations logged via audit module when HMAC signatures enabled.

---

## Firestore Rules

```firestore
match /labs/{labId}/ceq-participacoes/{participacaoId} {
  allow create, read, update: if request.auth != null;
  allow delete: if false;  // Soft delete only
}

match /labs/{labId}/ceq-amostras/{amostraId} {
  allow create, read, update: if request.auth != null;
  allow delete: if false;
}

match /labs/{labId}/ceq-resultados/{resultadoId} {
  allow create, read, update: if request.auth != null;
  allow delete: if false;
}
```

---

## Performance Characteristics

- **Z-Score Calculation:** O(1), no external calls
- **Result Recording:** 1 Firestore write + potential NC creation (~200ms)
- **NC Auto-Creation:** Async, non-blocking
- **Queries:** Single-field queries (no composite indices needed)

---

## Future Enhancements

1. **Z-Score Chart:** Visualize Z-score trends over PT rounds (X-axis: round, Y-axis: Z-score)
2. **PT Dashboard:** Summary metrics (% satisfactory, trend over time, provider comparison)
3. **Auto-Recall:** If |Z| > 5, auto-flag for immediate retest
4. **Batch Imports:** CSV/Excel import of PT results from provider
5. **Compliance Reports:** PT participation proof for audits (RDC 978)
6. **Provider Integration:** Direct API connection to Controllab (auto-sync reference values)

---

## Known Limitations

1. **Provider Data:** Reference values manually entered (no live sync)
2. **Granularity:** NC blocking applies to all lab operations (not per-module yet)
3. **Retest Logic:** Manual retest recording (no auto-flag for |Z| > 5 yet)

---

## Compliance

**RDC 978/2025:**

- ✓ PT participation documented (CEQParticipacao)
- ✓ Results recorded with reference values (CEQResultado)
- ✓ Z-score calculation per ISO 13528:2015
- ✓ Unsatisfactory results trigger NC (grave, blocking)
- ✓ CAPA workflow enforced via ADR 0003
- ✓ Audit trail via ADR 0005

---

## Phase Transition

**Phase 2 Batch 3 — Task 2:** CEQ module  
**Status:** Complete ✓  
**Commit:** "Batch 3 Task 2: CEQ live"

---

**Maintainer:** gsd-executor  
**Last Updated:** 2026-05-05
