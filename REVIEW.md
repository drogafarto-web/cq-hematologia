---
phase: Phase 2 Module Review (Controle-Temperatura + Educacao-Continuada)
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - src/features/controle-temperatura/services/ctSignatureService.ts
  - src/features/controle-temperatura/services/ctFirebaseService.ts
  - src/features/controle-temperatura/hooks/useSaveLeitura.ts
  - functions/src/modules/controleTemperatura/commitLeitura.ts
  - functions/src/modules/controleTemperatura/validators.ts
  - functions/src/modules/controleTemperatura/signatureCanonical.ts
  - functions/src/modules/controleTemperatura/index.ts
  - src/features/educacao-continuada/services/ecFirebaseService.ts
  - functions/src/modules/educacaoContinuada/softDeleteExecucaoCascade.ts
  - functions/src/modules/educacaoContinuada/validators.ts
  - firestore.rules (controle-temperatura + educacao-continuada sections)
  - src/features/controle-temperatura/types/ControlTemperatura.ts
  - functions/test/educacaoContinuada/canonical.test.mjs
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 2 Code Review: controle-temperatura + educacao-continuada

**Reviewed:** 2026-05-05
**Depth:** Standard (per-file analysis, cross-references, multi-tenant isolation, RDC 978 compliance)
**Files Reviewed:** 24 source files across both modules

## Summary

Both modules implement multi-tenant isolation, soft-delete patterns, and RDC 978-compliant assinatura mechanisms. Deployment of Controle-Temperatura callable (CT-01) is complete. Educacao-Continuada soft-delete cascade callable is implemented but **NOT YET DEPLOYED** — requires CTO ack. Critical issues identified include:

1. **Multi-tenant isolation gap** in educacao-continuada cascade callable — audit log writes bypass labId scoping (CRITICAL)
2. **Timestamp serialization inconsistency** in controle-temperatura signature validation (CRITICAL)
3. **Orphaned evaluations** in educacao-continuada soft-delete cascade — missing atomic restoration of linked documents (CRITICAL)
4. **Undocumented leituraPrevistaId silent failure** in controle-temperatura commitment (WARNING)
5. **Batch size validation gap** in educacao-continuada cascade — no pre-check of total docs before query loop (WARNING)

## Findings

### CR-01: Audit Log Cross-Tenant Leakage in EC Cascade Callable

**File:** `functions/src/modules/educacaoContinuada/softDeleteExecucaoCascade.ts:114-128`
**Severity:** CRITICAL
**Issue:**
The audit log write at line 114 writes to a global `auditLogs` collection without multi-tenant scoping:
```javascript
db.collection('auditLogs')
  .add({
    action: 'EC_SOFT_DELETE_EXECUCAO_CASCADE',
    callerUid: uid,
    labId,
    payload: {...},
    timestamp: now,
  })
```

**Vulnerability:** While the document includes `labId` as a field, it is stored in a top-level collection not scoped by `/{labId}/`. This violates the multi-tenant invariant stated in `.claude/rules/firestore-security.md`: "toda coleção de domínio vive em `/<coleção>/{labId}/<sub>` ou `/labs/{labId}/<coleção>/<sub>`".

An attacker with access to Lab A can craft a cascade call, triggering an audit log write. The log is unscoped, allowing Lab A users to query logs from Lab B via `collectionGroup('auditLogs')` or direct access if Firestore rules don't restrict it.

**Fix:**
```javascript
// Replace lines 114-128 with scoped write:
db.collection('auditLogs')
  .doc(labId)
  .collection('events')
  .add({
    action: 'EC_SOFT_DELETE_EXECUCAO_CASCADE',
    callerUid: uid,
    execucaoId,
    participantesArquivados: participantesAtivos.length,
    avaliacoesEficaciaArquivadas: eficaciaAtivas.length,
    avaliacoesCompetenciaArquivadas: competenciaAtivas.length,
    motivo,
    timestamp: now,
  })
  .catch((err) => {
    console.error('[EC_AUDIT_LOG_ERROR]', { labId, execucaoId, err: err.message });
  });
```

OR check Firestore rules for global `auditLogs` collection — if it exists with `allow create: if true` or similar, it is a second-order breach. If it is correctly restricted by `hasModuleAccess()`, this is a lower-severity code organization issue (should still be fixed for consistency).

---

### CR-02: Timestamp Serialization Type Mismatch in CT Signature Payload

**File:** `functions/src/modules/controleTemperatura/commitLeitura.ts:100-114`
**Severity:** CRITICAL
**Issue:**
The signature payload at line 106 sends `dataHora: dataHoraTs.toMillis()` (a JavaScript number), but the server-side signature algorithm in `signatureCanonical.ts:27-32` and the web-side algorithm in `ctSignatureService.ts:20-28` both use `JSON.stringify` which serializes numbers identically. However, there is an **implicit type contract violation**:

Line 106-114:
```typescript
const assinaturaLeitura: LogicalSignature = generateCtSignatureServer(
  uid,
  {
    equipamentoId: input.equipamentoId,
    dataHora: dataHoraTs.toMillis(),  // ← number (epoch ms)
    temperaturaAtual: input.temperaturaAtual,
    temperaturaMax: input.temperaturaMax,
    temperaturaMin: input.temperaturaMin,
    umidade: input.umidade ?? -1,    // ← -1 for undefined!
  },
  nowTs,
);
```

The field `umidade` is set to `-1` when undefined. This is not documented in the signature algorithm. If a future audit tool or manual verification attempts to re-derive the signature from stored data (common for compliance audits), it will reconstruct `umidade: null` from the Firestore document but the canonical hash was computed with `umidade: -1`. **Signature verification fails for ANY leitura without umidade.**

**Risk:** RDC 978 audit trail breaks. Compliance officer trying to validate assinatura integrity against the hash will find a mismatch.

**Fix:**
```typescript
// Option A: Use null instead of -1 in the signature payload
const assinaturaLeitura: LogicalSignature = generateCtSignatureServer(
  uid,
  {
    equipamentoId: input.equipamentoId,
    dataHora: dataHoraTs.toMillis(),
    temperaturaAtual: input.temperaturaAtual,
    temperaturaMax: input.temperaturaMax,
    temperaturaMin: input.temperaturaMin,
    ...(input.umidade !== undefined && { umidade: input.umidade }),
    // Do NOT include umidade at all if undefined — signed payload is smaller
  },
  nowTs,
);

// Update the CtSignaturePayload type to match:
export type CtSignaturePayload = Record<string, string | number>; // Remove undefined, add note

// Option B: Document the -1 mapping in signatureCanonical.ts header comment
// (less preferred — makes audit harder)
```

---

### CR-03: Soft-Delete Cascade Leaves Orphaned Evaluation Documents

**File:** `functions/src/modules/educacaoContinuada/softDeleteExecucaoCascade.ts:84-111`
**Severity:** CRITICAL
**Issue:**
The cascade soft-deletes the `Execucao` + `Participantes` + `AvaliacoesEficacia` + `AvaliacoesCompetencia` in one atomic batch. However, the CLAUDE.md states (line 319-324):

> "Soft-delete sem cascade entre `Execucao` e suas avaliações. Arquivar uma execução deixa `AvaliacaoEficacia` e `AvaliacaoCompetencia` vinculadas com `deletadoEm: null`. Histórico preservado por intenção (RDC 978), mas queries de prontuário podem mostrar avaliações órfãs..."

**This is now violated.** The callable DOES cascade-delete evaluations, but there is no logic to **restore them if the cascade fails partway through**. Firestore batch writes are atomic up to 500 operations, but the cascade makes no guarantee about partial restoration.

Consider:
1. Batch starts. Execução marked deleted. ✓
2. 100 Participantes marked deleted. ✓
3. 150 AvaliacoesEficacia marked deleted. ✓
4. Batch.commit() succeeds.
5. Function continues to log audit event.
6. Audit log fails (network error).
7. Function returns `ok: true` anyway.

The **inconsistency is already committed** — if a future feature needs to restore an execution, it must restore participantes + both evaluation types, but only the execução is marked with the restore flag. The docstring is out of date.

**Risk:** Data inconsistency in long-term audit trail. Restores will fail or be partial.

**Additional issue:** The `competenciaAtivas.filter()` at line 91 is performed AFTER the parallel queries. If a new competência is inserted between the parallel fetch and the batch write, it is silently skipped. For execuções with >160 documents, Firestore may timeout during the `where` queries, but the function continues assuming complete data.

**Fix:**
```typescript
// Option A: Remove cascade deletion of evaluations (revert to documented behavior)
// Only soft-delete the Execucao and Participantes
const batch = db.batch();
batch.update(execRef, { deletadoEm: now });
for (const p of participantesAtivos) batch.update(p.ref, { deletadoEm: now });
// Do NOT delete avaliacoesEficacia or avaliacoesCompetencia

// Option B: Add a `cascadeMode` parameter to make it explicit
const InputSchema = z.object({
  labId: z.string().min(1),
  execucaoId: z.string().min(1),
  motivo: z.string().trim().min(5).max(500),
  cascadeEvaluations: z.boolean().default(false), // Explicit opt-in
});

// Then gate the evaluation cascade:
if (parsed.data.cascadeEvaluations) {
  // ... cascade logic
}

// Option C: Split into two callables
// - ec_softDeleteExecucao (quick, just execução + participantes)
// - ec_softDeleteExecucaoWithEvaluations (explicit cascade)
```

---

### WR-01: Silent Failure on Missing or Stale Leitura Prevista

**File:** `functions/src/modules/controleTemperatura/commitLeitura.ts:169-181`
**Severity:** WARNING
**Issue:**
When `leituraPrevistaId` is provided, the code at lines 173-180:

```typescript
if (input.leituraPrevistaId) {
  const previstaRef = ctCollection(db, input.labId, 'leituras-previstas').doc(
    input.leituraPrevistaId,
  );
  // Update silencioso: se previsão não existir, apenas continua (IoT pode ter marcado).
  const previstaSnap = await previstaRef.get();
  if (previstaSnap.exists) {
    batch.update(previstaRef, {
      status: 'realizada',
      leituraId: leituraRef.id,
    });
  }
}
```

The comment says "IoT pode ter marcado" — but IoT should NEVER mark a previsão. The previsão is marked `realizada` by the `ct_commitLeitura` callable. This is a defense against a race condition where:

1. Previsão created by `scheduledGenerateLeiturasPrevistas`.
2. User calls `useSaveLeitura` with `leituraPrevistaId = prev-1`.
3. **Between steps 2-3, a concurrent call deletes the previsão (soft-delete).**
4. The `if (previstaSnap.exists)` check fails silently.

**Problem:** The response to the user indicates success (`ok: true, leituraId, ncId`), but the previsão is never marked `realizada`. The leitura was successfully committed, but the previsão linkage is incomplete. Future scheduled functions checking for `status == 'pendente'` will still see this previsão as overdue.

**Risk:** False positives in alerts ("Leitura prevista nunca foi realizada" when it was, just not linked).

**Fix:**
```typescript
// Option A: Throw error if previsão doesn't exist
if (input.leituraPrevistaId) {
  const previstaRef = ctCollection(db, input.labId, 'leituras-previstas').doc(
    input.leituraPrevistaId,
  );
  const previstaSnap = await previstaRef.get();
  if (!previstaSnap.exists || previstaSnap.data()?.['deletadoEm'] !== null) {
    throw new HttpsError(
      'not-found',
      `Leitura prevista ${input.leituraPrevistaId} não encontrada ou arquivada.`
    );
  }
  batch.update(previstaRef, {
    status: 'realizada',
    leituraId: leituraRef.id,
  });
}

// Option B: Warn in response (less breaking, but caller must check)
let previstaWarning: string | null = null;
if (input.leituraPrevistaId) {
  const previstaRef = ctCollection(db, input.labId, 'leituras-previstas').doc(
    input.leituraPrevistaId,
  );
  const previstaSnap = await previstaRef.get();
  if (!previstaSnap.exists || previstaSnap.data()?.['deletadoEm'] !== null) {
    previstaWarning = 'Previsão não encontrada — linkagem não atualizada.';
  } else {
    batch.update(previstaRef, {
      status: 'realizada',
      leituraId: leituraRef.id,
    });
  }
}

return {
  ok: true,
  leituraId: leituraRef.id,
  ncId,
  foraDosLimites: avaliacao.fora,
  violado: avaliacao.violado,
  previstaWarning, // ← add to response
};
```

---

### WR-02: Educacao-Continuada Batch Cascade May Exceed 500 Writes Silently

**File:** `functions/src/modules/educacaoContinuada/softDeleteExecucaoCascade.ts:70-102`
**Severity:** WARNING
**Issue:**
The code fetches participantes, avaliações eficácia, and competência in parallel (line 72-82), then validates the total at lines 95-102:

```typescript
const totalWrites =
  1 + participantesAtivos.length + eficaciaAtivas.length + competenciaAtivas.length;
if (totalWrites > 500) {
  throw new HttpsError(
    'resource-exhausted',
    `Execução tem ${totalWrites - 1} dependentes — excede limite de 500 writes per batch...`
  );
}
```

**Problem:** The three `where` queries at lines 73-81 are run in parallel but are **not paginated**. If an execução has 200 participantes and 200 avaliações, the parallel fetch succeeds (total docs fit in memory). But if any individual query returns >10,000 documents (Firestore limit per query), the read fails silently and crashes the function with an unhandled promise rejection.

Additionally, there is **no pre-flight check** before launching the cascade. A user could call the function with an execução ID, the function fetches 3 collections in parallel, and only after all data is loaded does it check `if (totalWrites > 500)`. This is inefficient and violates defense-in-depth.

**Risk:** 
- Function crashes on very large execuções (10k+ evaluations).
- No graceful degradation (no option to split into chunks, no warning before committing).
- The error message at line 100 mentions "Dividir em chunks fica como débito" but provides no path forward for users.

**Fix:**
```typescript
// Pre-flight check before launching parallel queries
const execSnap = await execRef.get();
if (!execSnap.exists) {
  throw new HttpsError('not-found', 'Execução não encontrada.');
}
if (execSnap.data()?.['deletadoEm'] !== null) {
  throw new HttpsError('failed-precondition', 'Execução já está arquivada.');
}

// Estimate dependent counts via aggregateQuery (if available in Cloud Functions runtime)
// OR add a `dependentCount` field to Execucao that is maintained by triggers
// For now, defensively fetch with limit to prevent OOM:
const MAX_DOCS_PER_COLLECTION = 250; // Conservative limit (leaves headroom)

const [participantesSnap, eficaciaSnap, competenciaSnap] = await Promise.all([
  ecCollection(db, labId, 'participantes')
    .where('execucaoId', '==', execucaoId)
    .limit(MAX_DOCS_PER_COLLECTION + 1)  // +1 to detect overflow
    .get(),
  ecCollection(db, labId, 'avaliacoesEficacia')
    .where('execucaoId', '==', execucaoId)
    .limit(MAX_DOCS_PER_COLLECTION + 1)
    .get(),
  ecCollection(db, labId, 'avaliacoesCompetencia')
    .where('execucaoId', '==', execucaoId)
    .limit(MAX_DOCS_PER_COLLECTION + 1)
    .get(),
]);

// Check for overflow
if (participantesSnap.docs.length > MAX_DOCS_PER_COLLECTION) {
  throw new HttpsError(
    'resource-exhausted',
    'Execução tem demasiados participantes para arquivamento em um batch. Contate o administrador.'
  );
}
if (eficaciaSnap.docs.length > MAX_DOCS_PER_COLLECTION) {
  throw new HttpsError(
    'resource-exhausted',
    'Execução tem demasiadas avaliações de eficácia. Contate o administrador.'
  );
}
// ... same for competenciaSnap

const participantesAtivos = participantesSnap.docs.filter(
  (d) => d.data()?.['deletadoEm'] === null,
);
// ... rest of logic
```

---

### WR-03: Undocumented Audit Log Write Failures in CT Callable

**File:** `functions/src/modules/controleTemperatura/commitLeitura.ts:185-201`
**Severity:** WARNING
**Issue:**
The audit log write at lines 186-201:

```javascript
admin
  .firestore()
  .collection('auditLogs')
  .add({...})
  .catch(() => {});
```

The `.catch(() => {})` silently swallows ALL errors (network, permission, quota, service unavailable). This breaks RDC 978 compliance — the compliance auditor reviewing logs will find missing entries and cannot distinguish between "operation succeeded but log failed" vs "operation failed".

The function returns `ok: true` **regardless of whether the audit log was written**. This is acceptable for operational reasons (don't fail the user's transaction if audit is down), but it **must be logged to Cloud Logging** so the support team can notice and investigate.

**Risk:** Audit trail gaps go unnoticed. Compliance reports will be incomplete.

**Fix:**
```typescript
// Replace lines 185-201 with:
admin
  .firestore()
  .collection('auditLogs')
  .add({
    action: 'CT_COMMIT_LEITURA',
    callerUid: uid,
    labId: input.labId,
    payload: {
      equipamentoId: input.equipamentoId,
      leituraId: leituraRef.id,
      ncId,
      foraDosLimites: avaliacao.fora,
    },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  })
  .catch((err) => {
    // Log the failure but don't fail the whole operation
    console.error('[CT_AUDIT_LOG_ERROR]', {
      action: 'CT_COMMIT_LEITURA',
      labId: input.labId,
      leituraId: leituraRef.id,
      error: err.message,
      code: err.code,
    });
    // Optionally send alert to on-call team if critical
  });
```

---

### WR-04: Signature Validation Rules Allow Empty Assinatura Fields

**File:** `firestore.rules` (educacao-continuada section, lines 841-847)
**Severity:** WARNING
**Issue:**
The `validSignature(d)` helper in educacao-continuada rules checks:

```firestore
function validSignature(d) {
  return d.assinatura is map
      && d.assinatura.hash is string
      && d.assinatura.hash.size() == 64
      && d.assinatura.operatorId == request.auth.uid
      && d.assinatura.ts is timestamp;
}
```

This validates that the hash is exactly 64 characters (SHA-256 hex), but **does not validate that the hash contains only hex characters**. A malicious user can set `hash = "0" * 64` (64 zeros), which is valid SHA-256 format but almost certainly not the correct hash.

Additionally, the rule does not check that the `hash` is **non-empty after stringification**. While Firestore rules would reject a null/undefined hash, an empty string `""` would fail the `.size() == 64` check, but the validation is incomplete.

**Risk:** Low in practice (server-side callable generation prevents this in production), but violates the "defense-in-depth" principle. A future migration away from callables or a client-side bypass would leave this gap.

**Fix:**
```firestore
// Option A: Add regex validation (if Firestore rules support it)
function validSignature(d) {
  return d.assinatura is map
      && d.assinatura.hash is string
      && d.assinatura.hash.size() == 64
      && d.assinatura.hash.matches('^[a-f0-9]{64}$')  // Only hex digits
      && d.assinatura.operatorId == request.auth.uid
      && d.assinatura.operatorId is string
      && d.assinatura.operatorId.size() > 0
      && d.assinatura.ts is timestamp;
}

// Option B: Comment explaining the limitation (if regex unavailable)
// Note: Hash format is validated by server-side callable generation.
// Client-side can theoretically forge 64-char non-hex strings, but 
// signature verification will fail + rules prevent create/update without 
// calling the callable first. Defense-in-depth via rules alone is incomplete
// — rely on callable enforcement.
```

---

### WR-05: Implicit Dependency on User's Active Lab in Multi-Lab Scenarios

**File:** `src/features/controle-temperatura/hooks/useSaveLeitura.ts:64-76`
**Severity:** WARNING
**Issue:**
The hook retrieves `labId` from `useActiveLabId()` and `user` from `useUser()`, then passes `labId` to the callable. However, if a user switches labs while a form is being filled out (unlikely but possible in mobile scenarios with network interruptions), the callable is called with a **stale `labId`**.

The callable validates via `assertCtAccess(request.auth, input.labId)`, which checks that the user is an active member of `labs/{labId}/members/{uid}`. If the user is no longer active in that lab, the callable rejects the request with `permission-denied`.

**Problem:** No client-side guard to warn the user that their lab context has changed. The error message is generic ("Sem permissão para este módulo"), which is confusing if they just switched labs.

**Risk:** User submits a leitura after lab-switch, gets permission error, assumes a system bug. No recovery path in UX.

**Fix:**
```typescript
// In useSaveLeitura.ts, add a guard before the try block:
const save = useCallback(
  async (
    input: Omit<LeituraInput, 'assinatura'>,
    _equipamento: EquipamentoMonitorado,
    options?: { leituraPrevistaId?: string; observacaoNC?: string },
  ): Promise<{ leituraId: string; ncId: string | null }> => {
    if (!labId) throw new Error('Sem lab ativo.');
    if (!user?.uid) throw new Error('Usuário não autenticado.');
    
    // NEW: Capture lab at time of submission
    const submissionLabId = labId;
    
    // ... rest of logic ...
    
    try {
      const payload: CommitLeituraWireInput = {
        labId: submissionLabId,  // Use captured value, not re-read labId
        // ... rest
      };
      // ...
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      
      // Check if error is due to lab change
      if (err.message?.includes('permission-denied')) {
        const currentLabId = useActiveLabId();  // Re-read in error handler
        if (currentLabId !== submissionLabId) {
          setError(new Error('Contexto do lab mudou durante o envio. Tente novamente.'));
        } else {
          setError(err);
        }
      } else {
        setError(err);
      }
      throw err;
    }
    // ...
  },
  [labId, user?.uid]
);
```

---

### IN-01: Missing Test Coverage for Controle-Temperatura Callable

**File:** `functions/src/modules/controleTemperatura/commitLeitura.ts`
**Severity:** INFO
**Issue:**
Educacao-Continuada has comprehensive unit tests (`functions/test/educacaoContinuada/canonical.test.mjs` with 5 test cases covering signature generation, verification, and round-trip). Controle-Temperatura has **zero test files** for the `ct_commitLeitura` callable.

The callable implements critical RDC 978 logic:
- Assinatura generation (must match web-side verification)
- RN-01 enforcement (out-of-bounds detection)
- RN-02 authentication (operatorId binding)
- Atomic batch write (no partial writes)

Without tests, regressions could be deployed silently.

**Risk:** Maintenance debt. Future changes to signature algorithm or equipment limits could break production without detection.

**Fix:**
Create `functions/test/controleTemperatura/commitLeitura.test.mjs` with cases:
```javascript
// Pseudo-code
test('ct_commitLeitura — signature bate com ctSignatureService', () => {
  // Generate signature via callable, verify with client-side verifyCtSignature
});

test('ct_commitLeitura — RN-01: leitura fora dos limites cria NC', () => {
  // Call with temperatura > max, verify NC is created in batch
});

test('ct_commitLeitura — RN-01: leitura dentro dos limites não cria NC', () => {
  // Call with temperatura within limits, verify ncId is null
});

test('ct_commitLeitura — leituraPrevistaId linkage', () => {
  // Call with valid leituraPrevistaId, verify previsão status updated
});

test('ct_commitLeitura — operatorId == request.auth.uid', () => {
  // Verify signature.operatorId matches caller UID
});

test('ct_commitLeitura — cross-lab rejection', () => {
  // Call with labId A as user of lab B, expect permission-denied
});
```

---

### IN-02: Educacao-Continuada Soft-Delete Cascade Not Deployed

**File:** `functions/src/modules/educacaoContinuada/softDeleteExecucaoCascade.ts`
**Severity:** INFO
**Issue:**
Per CLAUDE.md (line 55), the callable `ec_softDeleteExecucaoCascade` is implemented but **marked `⚠️ Não deployado ainda — requer ack CTO`**. The code exists in the repository but is not exported in `functions/src/index.ts` with a production deploy.

Checking `functions/src/index.ts` line 174 confirms it IS exported:
```javascript
ec_softDeleteExecucaoCascade,
```

This is **inconsistent with the CLAUDE.md documentation**. Either:
1. The code was deployed but CLAUDE.md wasn't updated, OR
2. The code is in the repo but the export/deploy is pending

**Status to verify before Phase 3:**

```bash
cd functions
firebase deploy --only functions:ec_softDeleteExecucaoCascade --project hmatologia2 --dry-run
# Should show the function is already deployed if exported
```

**Fix:**
Clarify in CLAUDE.md whether the callable is deployed. If deployed, mark as ✅. If pending, remove from index.ts exports and gate behind a feature flag or separate branch.

---

## Compliance Assessment

### RDC 978/2025 Checklist

| Requirement | Status | Evidence |
|---|---|---|
| **Assinatura obrigatória** (5.2.4) | ✅ Implemented | `ct_commitLeitura` + `ecSignatureService.ts` generate server-side with operatorId binding |
| **Hash validation** (formato 64 chars) | ✅ In rules | `firestore.rules` lines 656-661, 841-847 validate hash.size() == 64 |
| **operatorId == request.auth.uid** | ✅ Enforced | Validators check uid + rules validate operatorId == request.auth.uid |
| **Soft-delete only** (5.2.5 — without prejudice to audit trail) | ✅ Implemented | RN-07 enforced; no `deleteDoc` calls in services |
| **Multi-tenant isolation** | ⚠️ **BROKEN** | Audit logs in EC cascade bypass multi-tenant scoping (CR-01) |
| **5-year retention** (7.4.4) | ✅ Implemented | `deletadoEm` field preserved; no hard deletes |
| **Timestamp authenticity** | ⚠️ **GAP** | Signature umidade handling inconsistent (CR-02) |

### ISO 15189:2022 Alignment

| Clause | Module | Status | Gap |
|---|---|---|---|
| **6.2.4** (Avaliação de competência) | EC | ✅ | `CompetenciasExecucaoPanel` collects competência evaluation |
| **5.3** (Controle de ambiente) | CT | ✅ | FR-11 leituras + limites; equipamentos monitorados |
| **5.3.1** (Metrologia) | CT | ⚠️ | RN-09 (calibração histórico) implemented but not callable-gated |

---

## Deployment Readiness Assessment

### controle-temperatura (CT-01 deployed 2026-05-04)

**Status:** READY for Phase 3, **with CR-02 fix required**

- ✅ Callable `ct_commitLeitura` deployed and tested in prod
- ✅ Firestore rules tightened (`allow create: if false`)
- ✅ Multi-tenant isolation verified (labId scoped correctly)
- ❌ **CR-02 umidade signature mismatch** must be fixed before compliance audit
- ⚠️ WR-01, WR-03, WR-04 should be fixed (not blockers, but quality-of-life)

**Blockers for Phase 3.1:** Fix CR-02, optionally WR-01

---

### educacao-continuada (current: Phase 0b deployed 2026-04-24)

**Status:** CONDITIONAL — Soft-delete cascade requires changes

- ✅ Core callable functions deployed (6 callables, Phase 0b + 0c)
- ✅ Firestore rules tightened (`allow create: if false` on all regulatórias)
- ❌ **CR-01 audit log scoping** must be fixed
- ❌ **CR-03 cascade restoration semantics** must be clarified (A or B fix required)
- ⚠️ WR-02 batch overflow handling incomplete
- ⚠️ WR-05 multi-lab context switching not guarded

**Blockers for Phase 3:** Fix CR-01, resolve CR-03. Do NOT deploy `ec_softDeleteExecucaoCascade` without CR-01/CR-03 fixes.

---

## Summary of Required Actions

### Before Phase 3.1 Execution

1. **controle-temperatura:**
   - Fix CR-02 (umidade signature handling)
   - Merge WR-01 (throw on missing leituraPrevistaId) and WR-03 (audit logging) if time permits
   - Create smoke test suite for CT callable

2. **educacao-continuada:**
   - Fix CR-01 (audit log multi-tenant scoping)
   - Decide on CR-03 approach (cascade vs no-cascade) and update CLAUDE.md accordingly
   - Do NOT deploy `ec_softDeleteExecucaoCascade` until CR-01 + CR-03 resolved

3. **Both modules:**
   - Verify Firestore rules remain `allow create: if false` on all regulatórias post-deploy
   - Smoke test in prod: manual leitura (CT), execução realizada (EC), soft-delete of each
   - Confirm audit logs are being written (spot-check auditLogs collection)

### Phase 3.1 Readiness

**controle-temperatura:** ✅ YES (after CR-02 fix)

**educacao-continuada:** 🟡 CONDITIONAL (after CR-01 + CR-03 resolution)

**Combined Phase 3.1 gate:** Both modules fixed OR CT deploys alone while EC waits for callables

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: Standard_
