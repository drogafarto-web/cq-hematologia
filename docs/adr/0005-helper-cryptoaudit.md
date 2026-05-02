# ADR 0005 — Helper cryptoAudit Centralizado

**Status:** Proposed (awaiting CTO approval)  
**Date:** 2026-05-02  
**Author:** Engineer (Claude Code)  
**Related Issues:** V-009 (HMAC + chainHash duplicação)  
**Related ADRs:** None (foundational)

---

## Problem Statement

**Violation V-009:** HMAC + chainHash implementados **duas vezes** em produção:

1. `functions/src/modules/insumos/chainHash.ts` — rastreia movimentação de lotes
2. `functions/src/modules/ciqAudit/writer.ts` — rastreia audit log de análises

**Riscos:**
- Código duplicado = bugs divergentes
- Se um é corrigido, o outro fica quebrado
- Manutenção duplicada (refactor é 2x o trabalho)
- HMAC pode divergir entre módulos (auditoria falha)

**Impacto regulatório:**
- RDC 978 exige rastreabilidade + integridade
- Se HMAC diverge, laudo não é auditável

**Bloqueador técnico:**
- ADR 0002 (Lote↔NF) precisa de HMAC unificado
- ADR 0003 (NC global) precisa de HMAC unificado
- Sem isso, spines não conseguem validar integridade

---

## Solution

Criar **helper `cryptoAudit.ts`** centralizado em `functions/src/modules/audit/`:

```
functions/src/modules/audit/
├── cryptoAudit.ts              ← Helper (HMAC, hash, chain operations)
├── chainHashValidator.ts       ← Scheduled job (verifica integridade)
├── cryptoAudit.test.ts         ← Tests >90%
└── types.ts                    ← AuditEntry, ChainEntry
```

**Princípio:** Um módulo, um helper, zero duplicação. Todos os módulos consomem via `import { signAuditEntry }`.

---

## Detailed Design

### 1. Schema: AuditEntry

```typescript
type AuditEntry = {
  // Document metadata
  id: string;                    // Firestore doc ID
  collectionPath: string;        // '/ciq-audit' or '/labs/{labId}/audit-log'
  
  // Operation context
  timestamp: Timestamp;          // server-generated, never client time
  operadorId: string;            // FK to /users
  operation: string;             // 'insumo.recebido', 'laudo.liberado', 'nc.aberta', etc
  
  // Payload (what changed)
  payload: Record<string, any>;  // {loteId, quantidade, motivo, ...}
  
  // Cryptographic integrity
  hmac: string;                  // HMAC-SHA256(deterministic JSON)
  hash: string;                  // SHA-256(entire entry JSON)
  previousHash: string | null;   // hash of entry before this one (chain)
  
  // Migration tracking
  _migratedAt?: Timestamp;       // For legacy entries (null = new format)
  _legacyHash?: string;          // For entries without HMAC (migration temp)
};
```

### 2. HMAC Computation (Deterministic)

```typescript
import crypto from 'crypto';

export function computeHmac(
  data: Record<string, any>,
  secret: string
): string {
  // Deterministic JSON: sort keys alphabetically
  const canonicalJson = JSON.stringify(data, Object.keys(data).sort());
  
  // HMAC-SHA256, output as hex
  return crypto
    .createHmac('sha256', secret)
    .update(canonicalJson, 'utf-8')
    .digest('hex');
}

export function hashData(data: Record<string, any>): string {
  const json = JSON.stringify(data, Object.keys(data).sort());
  return crypto
    .createHash('sha256')
    .update(json, 'utf-8')
    .digest('hex');
}
```

**Why deterministic?** Same data + same secret = same HMAC every time. No surprises on verification.

### 3. Sign Audit Entry (Main API)

```typescript
export async function signAuditEntry(
  collectionPath: string,
  operadorId: string,
  operation: string,
  payload: Record<string, any>,
  db: FirebaseFirestore.Firestore,
  secret: string
): Promise<AuditEntry> {
  // 1. Get previous hash (for chain)
  const previousHash = await getPreviousHashInCollection(
    db,
    collectionPath,
    'timestamp'
  );
  
  // 2. Create entry (without hmac/hash yet)
  const entryData = {
    collectionPath,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    operadorId,
    operation,
    payload,
    previousHash,
  };
  
  // 3. Compute HMAC + hash
  const hmac = computeHmac(entryData, secret);
  const hash = hashData({ ...entryData, hmac });
  
  // 4. Add cryptographic fields
  const finalEntry: AuditEntry = {
    ...entryData,
    hmac,
    hash,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  // 5. Write to Firestore (via Cloud Function, never direct)
  const docRef = await db.collection(collectionPath).add(finalEntry);
  return { ...finalEntry, id: docRef.id } as AuditEntry;
}
```

### 4. Verify Entry (Integrity Check)

```typescript
export function verifyAuditEntry(
  entry: AuditEntry,
  secret: string
): {
  valid: boolean;
  reason?: string;
} {
  // Recompute HMAC (without hmac field)
  const { hmac: originalHmac, hash: originalHash, ...dataForHmac } = entry;
  const computedHmac = computeHmac(dataForHmac, secret);
  
  if (computedHmac !== originalHmac) {
    return {
      valid: false,
      reason: `HMAC mismatch: expected ${originalHmac}, computed ${computedHmac}`,
    };
  }
  
  // Recompute hash (with hmac included)
  const computedHash = hashData({ ...dataForHmac, hmac: originalHmac });
  if (computedHash !== originalHash) {
    return {
      valid: false,
      reason: `Hash mismatch: expected ${originalHash}, computed ${computedHash}`,
    };
  }
  
  return { valid: true };
}
```

### 5. Chain Integrity Validator (Scheduled)

```typescript
export async function validateChainIntegrity(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  secret: string,
  options?: { batchSize?: number; maxAge?: number }
): Promise<{
  valid: boolean;
  violations: Array<{
    docId: string;
    reason: 'hmac-mismatch' | 'hash-sequence-broken' | 'missing-hash';
    expected?: string;
    actual?: string;
  }>;
  stats: { scanned: number; valid: number; invalid: number; duration: number };
}> {
  const startTime = Date.now();
  const batchSize = options?.batchSize ?? 100;
  const violations = [];
  let scanned = 0;
  let valid = 0;

  // Query all entries, sorted by timestamp ascending
  const query = db.collection(collectionPath).orderBy('timestamp');
  const snapshot = await query.get();

  let previousHash: string | null = null;

  for (const doc of snapshot.docs) {
    scanned++;
    const entry = doc.data() as AuditEntry;

    // 1. Verify HMAC
    const hmacCheck = verifyAuditEntry(entry, secret);
    if (!hmacCheck.valid) {
      violations.push({
        docId: doc.id,
        reason: 'hmac-mismatch',
        expected: entry.hmac,
      });
      continue;
    }

    // 2. Verify chain (previousHash matches)
    if (entry.previousHash !== previousHash) {
      violations.push({
        docId: doc.id,
        reason: 'hash-sequence-broken',
        expected: previousHash,
        actual: entry.previousHash,
      });
      continue;
    }

    valid++;
    previousHash = entry.hash;
  }

  return {
    valid: violations.length === 0,
    violations,
    stats: {
      scanned,
      valid,
      invalid: scanned - valid,
      duration: Date.now() - startTime,
    },
  };
}

// Scheduled Cloud Function
export const validateChainIntegrityScheduled = functions
  .region('southamerica-east1')
  .pubsub.schedule('every 12 hours')
  .onRun(async context => {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

    const result = await validateChainIntegrity(db, '/ciq-audit', secret);
    if (!result.valid) {
      console.error('Chain integrity violation:', result.violations);
      // TODO: Open NC automatically (depends on ADR 0003)
    }
    return result;
  });
```

### 6. Firestore Rules (Enforce HMAC in Writes)

```
match /ciq-audit/{auditId} {
  // Deny direct writes — only Cloud Function can write
  allow create: if false;
  allow read: if request.auth.uid != null;
}

match /labs/{labId}/audit-log/{entryId} {
  allow create: if false;
  allow read: if request.auth.uid != null && 
              request.auth.token.labs[labId] != null;
}
```

**Enforcement in Cloud Function:**
- Check HMAC + hash present before writing
- Reject if missing or invalid
- Log rejection in separate error collection

---

## Implementation Plan

### Phase 1: Setup (Day 2)
- [ ] Create directory structure
- [ ] Add `process.env.HCQ_SIGNATURE_HMAC_KEY` via Firebase Secrets
- [ ] Initialize boilerplate (imports, types)

### Phase 2: Core Helper (Days 3-4)
- [ ] Implement `cryptoAudit.ts` (sign, verify, chain operations)
- [ ] Unit tests >90% coverage
- [ ] Test with Firebase emulator

### Phase 3: Refactor Existing (Days 3-4)
- [ ] Update `chainHash.ts` to use helper
- [ ] Update `ciqAudit/writer.ts` to use helper
- [ ] Integration tests (no behavior change)

### Phase 4: Validator (Day 5)
- [ ] Implement `chainHashValidator.ts`
- [ ] Scheduled Cloud Function
- [ ] Test validator with seeded data

### Phase 5: Migration (Day 6)
- [ ] Backfill legacy entries with HMAC
- [ ] Verify chain unbroken post-migration
- [ ] Script: `functions/scripts/backfill-hmac.mjs`

### Phase 6: Testing & Audit (Day 7)
- [ ] Smoke tests (create entry → verify HMAC → validate chain)
- [ ] Security review (secret mgmt, crypto correctness)
- [ ] CTO sign-off

### Phase 7: Production Deploy (Day 8)
- [ ] Merge to main (code review)
- [ ] `firebase deploy --only functions`
- [ ] Monitor logs (Firestore, Cloud Functions)
- [ ] Verify 1x scheduled validator run

---

## Security Considerations

### Key Management
- Secret: `HCQ_SIGNATURE_HMAC_KEY` (32 bytes, SHA-256 input size)
- Stored in: Firebase Secret Manager (not .env, not git)
- Rotation: Quarterly (generate new → deploy → retire old)
- Access: Cloud Functions only (service account)

### Cryptographic Correctness
- HMAC-SHA256: NIST FIPS 198-1 approved ✓
- Deterministic JSON: sorts keys, no whitespace variation ✓
- Timestamp: server-generated, never client time ✓
- previousHash: prevents reordering attacks ✓

### Secrets Never Logged
- Grep `-v HCQ_SIGNATURE_HMAC_KEY` on all code
- No `console.log(secret)`
- No `console.log(hmac)` in production logs

---

## Acceptance Criteria

✓ **Technical:**
- Helper `cryptoAudit.ts` implemented
- Unit tests >90% coverage, all passing
- Integration tests pass (emulator)
- Chain validator runs, detects breaks
- Backfill 100% complete
- Smoke tests pass
- Zero HMAC divergence between modules

✓ **Security:**
- Secret manager configured
- Firestore rules block direct writes
- Security review passed
- CTO sign-off

✓ **Production:**
- Deployed without errors
- Scheduled validator runs 1x successfully
- Monitoring alerts configured

---

## Rollback Plan

If production breaks:

1. **Immediate (first 1 hour):**
   - Revert Cloud Functions to previous version
   - Keep Firestore docs (they're immutable)
   - Notify CTO

2. **Short-term (1-24 hours):**
   - Analyze what broke (logs)
   - Fix bug + re-test locally
   - Redeploy

3. **Data consistency:**
   - New entries use new format (HMAC + hash)
   - Old entries keep old format
   - Validator dual-checks both formats
   - No data loss

---

## Dependency Graph

```
Task 1.1 (Design) ← CTO approval
  ↓
Task 1.2 (Setup) ← secret manager key
  ↓
Task 1.3 (Implementation) ← helper + tests
  ├─→ Task 1.4 (Validator) ← depends on 1.3
  ├─→ Task 1.5 (Backfill) ← depends on 1.3
  └─→ Task 1.6 (Testing) ← depends on 1.3 + 1.5
      ↓
      Task 1.7 (Deploy) ← all above
```

---

## References

- **V-009:** `docs/backlog/spine-violations.md` — HMAC duplicação
- **NIST FIPS 198-1:** HMAC specification
- **Firebase Secrets:** https://firebase.google.com/docs/functions/config-env
- **Node.js crypto:** https://nodejs.org/api/crypto.html
- **Firestore Rules:** https://firebase.google.com/docs/firestore/security/rules-conditions

---

## Approval

- [ ] **Engineer:** Design reviewed, ready to implement
- [ ] **CTO:** Scope approved, security risks acceptable, timeline OK

**CTO Signature:** _________________  **Date:** _________________

---

**Next:** Upon CTO approval, proceed to Task 1.2 (Setup — Day 2)
