# Pattern: Tamper-Evident Audit Chains via HMAC-SHA256

**Applies to:** RDC 978 Art. 128 (scientific and technical documentation audit), DICQ 4.4 (traceability of audit records), any regulatory collection requiring tamper-proof history.

**Canonical implementation:** `functions/src/modules/compras/notaFiscal.ts` (Invoice audits) + `functions/src/modules/criticos/` (Critical value escalation events).

---

## When to use this pattern

Your module needs an audit chain if:

1. **Regulatory requirement** — RDC 978 Art. 128 or DICQ 4.4 explicitly demand audit trail integrity.
2. **Tamper detection** — you must detect if someone modifies a historical record (not prevent, but detect and surface the breach).
3. **Non-repudiation** — the operator who created the record should not be able to deny it or fake retroactive approval.
4. **Forensic value** — if a record is tampered with, you want the corruption to be provable and signed.

Do **not** use this pattern if:

- You only need a simple activity log (use `writeAuditLog` instead).
- Compliance does not require proof of integrity, only evidence of occurrence.
- Your collection is not regulatory (e.g., user preferences, UI settings).

---

## How it works: the chain

```
Write 1 (Chain origin)
├─ payload: { numero: 'NF-001', value: 5000 }
├─ previousHash: null (first in chain)
├─ hmac: SHA256(payload + operatorId + timestamp, secret)
└─ hash: SHA256(hmac + payload + operatorId + timestamp)
    └─ Stored: hash1 = 'abc123...'

Write 2
├─ payload: { numero: 'NF-002', value: 3000 }
├─ previousHash: 'abc123...' ← REFERENCES hash1
├─ hmac: SHA256(payload + previousHash + operatorId + timestamp, secret)
└─ hash: SHA256(hmac + payload + previousHash + operatorId + timestamp)
    └─ Stored: hash2 = 'def456...'

Write 3
├─ payload: { numero: 'NF-003', value: 7000 }
├─ previousHash: 'def456...' ← REFERENCES hash2
├─ hmac: SHA256(payload + previousHash + operatorId + timestamp, secret)
└─ hash: SHA256(hmac + payload + previousHash + operatorId + timestamp)
    └─ Stored: hash3 = 'ghi789...'

Attack scenario: attacker modifies Write 2's payload to { numero: 'NF-002', value: 50000 }
├─ Write 2's hash recomputes to: hash2_new = 'xyz999...' (no longer 'def456...')
├─ But Write 3 still has previousHash: 'def456...'
├─ Auditor runs validateChainIntegrity()
├─ Detects: Write 3's previousHash doesn't match Write 2's actual hash
└─ Result: tamper detected, chain broken at Write 3, evidence preserved
```

---

## API: `writeChainedAudit()`

**Location:** `functions/src/shared/audit/writeChainedAudit.ts`

### Signature

```typescript
export interface ChainedAuditPayload {
  /** Chain target collection path, e.g. `/labs/{labId}/notas-fiscais`. */
  collectionPath: string;
  /** Operator UID (matches `request.auth.uid`). */
  operadorId: string;
  /** Domain operation, e.g. `notaFiscal.criada`. */
  operation: string;
  /** Operation-specific payload (no PII secrets). */
  payload: Record<string, unknown>;
  /** HMAC secret resolved from `defineSecret(...).value()`. */
  secret: string;
}

export type WriteChainedAuditResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function writeChainedAudit(
  entry: ChainedAuditPayload,
  firestore?: admin.firestore.Firestore
): Promise<WriteChainedAuditResult>;
```

### Behavior

1. **Retries:** 3 attempts with exponential backoff (100ms → 400ms → 1500ms).
2. **On success:** Returns `{ ok: true, id }` where `id` is the Firestore doc ID.
3. **On final failure:**
   - Emits `console.error('[writeChainedAudit] FAILED after retries', {...})` to Cloud Logs.
   - Writes a sibling failure marker into `<parent>/<leaf>-auditFailures/{autoId}`.
   - Returns `{ ok: false, error }`.
4. **Never throws** — audit failure is non-blocking by design.

### Caller contract

```typescript
await writeChainedAudit({
  collectionPath: `/labs/${labId}/notas-fiscais`,
  operadorId: request.auth.uid,
  operation: 'notaFiscal.criada',
  payload: { numero, serie, fornecedorId, itemCount: itens.length },
  secret: HCQ_SIGNATURE_HMAC_KEY.value(),
});
```

- Always `await` the result — the helper is non-blocking by intent (audit failure must not propagate to user), but retries must complete before the function returns.
- Do not check the result in the happy path — chain audit is non-critical. Only log/alert if `ok: false`.

---

## Firestore Schema

### Chain collection

**Example path:** `/labs/{labId}/notas-fiscais`

Each document contains:

```typescript
{
  id: string;
  collectionPath: string;                // e.g. "/labs/abc/notas-fiscais"
  timestamp: Timestamp;                  // Firestore server timestamp
  operadorId: string;                    // request.auth.uid
  operation: string;                     // e.g. "notaFiscal.criada"
  payload: Record<string, unknown>;      // Domain-specific data
  
  // Cryptographic chain fields
  previousHash: string | null;           // Chain link (null for first entry)
  hmac: string;                          // HMAC-SHA256 of entry (hex, 64 chars)
  hash: string;                          // SHA256 of (hmac + entry), hex, 64 chars
  
  // Optional: migration fields (ADR-0017/0030)
  _migratedAt?: Timestamp;               // Baseline reset timestamp
  _legacyHash?: string;                  // Original hash before migration
}
```

### Failure marker collection

**Pattern:** `/labs/{labId}/{leaf}-auditFailures`

**Example:** `/labs/{labId}/notas-fiscais-auditFailures`

When `writeChainedAudit` exhausts retries, it writes:

```typescript
{
  chainCollectionPath: string;            // e.g. "/labs/abc/notas-fiscais"
  operation: string;                      // e.g. "notaFiscal.criada"
  operadorId: string;                     // request.auth.uid
  intendedPayload: Record<string, unknown>; // Original payload
  error: string;                          // Truncated to 2000 chars
  attempts: number;                       // Always 3
  recordedAt: Timestamp;                  // Firestore server timestamp
}
```

**Why sibling?** The chain target must never contain failure markers — doing so would corrupt `previousHash` continuity for the next real entry. The marker lives in a sibling collection, so chain integrity is preserved for forensic validation.

---

## Validation: `validateChainIntegrity()`

**Location:** `functions/src/modules/audit/cryptoAudit.ts`

### Signature

```typescript
export async function validateChainIntegrity(
  collectionPath: string,
  secret: string,
  options?: { batchSize?: number }
): Promise<ChainValidationResult>;

export interface ChainValidationResult {
  valid: boolean;
  violations: Array<{
    docId: string;
    reason: 'hmac-mismatch' | 'hash-sequence-broken' | 'missing-hash';
    expected?: string;
    actual?: string;
  }>;
  stats: {
    scanned: number;
    valid: number;
    invalid: number;
    duration: number;
  };
}
```

### Usage

```typescript
const result = await validateChainIntegrity(
  '/labs/lab-abc/notas-fiscais',
  secret
);

if (!result.valid) {
  console.error('Chain breach detected:', result.violations);
  // Alert auditor, trigger RDC 978 Art. 128 investigation
}
```

### What it checks

1. **HMAC integrity:** Recomputes HMAC for each entry. If it doesn't match stored, record was tampered.
2. **Hash continuity:** Verifies `entry[i].previousHash == entry[i-1].hash`. If broken, someone inserted or modified an entry.
3. **Sequence:** Scans all entries in timestamp order and reports violations by doc ID.

---

## Implementation checklist: add chain hashing to a new module

### Step 1: Define the callable and security rules

Create a callable in your module that validates the operation, then calls `writeChainedAudit`:

```typescript
// functions/src/modules/your-module/yourCallable.ts
import { writeChainedAudit } from '../../shared/audit/writeChainedAudit';
import { YOUR_HMAC_SECRET } from './secrets';

export const yourOperation = functions.onCall(
  { region: 'southamerica-east1', secrets: [YOUR_HMAC_SECRET] },
  async (request) => {
    const { labId, payload } = request.data;
    
    // 1. Validate authorization, input, etc.
    if (!request.auth) throw new HttpsError('unauthenticated', '...');
    
    // 2. Perform your domain operation
    const docRef = db.collection(`labs/${labId}/your-collection`).doc();
    await docRef.set({ ...payload, createdAt: serverTimestamp() });
    
    // 3. Chain-audit the operation (non-blocking)
    await writeChainedAudit({
      collectionPath: `/labs/${labId}/your-collection`,
      operadorId: request.auth.uid,
      operation: 'yourModule.operationName',
      payload: { /* what to audit */ },
      secret: YOUR_HMAC_SECRET.value(),
    });
    
    return { success: true };
  }
);
```

### Step 2: Add Firestore rules for the audit collection

In `firestore.rules`, add a block for the chain-audit failure markers:

```firestore
// Your-module chain-audit failure markers
match /labs/{labId}/your-collection-auditFailures/{eventId} {
  allow read: if isAdminOrOwner(labId) || request.auth.token.role == 'RT';
  allow create, update, delete: if false;
}
```

### Step 3: Add composite indexes

See **Firestore Indexes for Chain Audits** section below.

### Step 4: Set up chain validation (optional, for large collections)

If your collection will have >1000 documents, set up a scheduled Cloud Function to validate chain integrity periodically:

```typescript
// functions/src/modules/your-module/validateChainScheduled.ts
export const validateYourCollectionChain = onSchedule('0 */4 * * *', async () => {
  const labs = await db.collection('labs').listDocuments();
  
  for (const labDoc of labs) {
    const result = await validateChainIntegrity(
      `/labs/${labDoc.id}/your-collection`,
      YOUR_HMAC_SECRET.value()
    );
    
    if (!result.valid) {
      await db.collection('audit-violations').add({
        collectionPath: `/labs/${labDoc.id}/your-collection`,
        type: 'chain-breach',
        violations: result.violations,
        detectedAt: serverTimestamp(),
      });
      // Alert auditor
    }
  }
});
```

### Step 5: Test chain continuity

See **Testing** section below.

---

## Firestore Indexes for Chain Audits

Add these composite indexes to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "notas-fiscais",
      "fields": [
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "criticos-log-eventos",
      "fields": [
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notas-fiscais-auditFailures",
      "fields": [
        { "fieldPath": "recordedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

For any new chained collection:
- **Query by timestamp (desc):** for `getPreviousHashInCollection` in `cryptoAudit.ts`.
- **Query failure markers by recordedAt (desc):** for operators investigating missing audits.

---

## Testing

### Unit test: chain signature generation

```typescript
import { signAuditEntry, verifyAuditEntry } from '../../modules/audit/cryptoAudit';

it('generates correct chain signature', async () => {
  const secret = 'test-secret';
  const entry = await signAuditEntry(
    '/labs/test-lab/notas-fiscais',
    'user-1',
    'notaFiscal.criada',
    { numero: 'NF-001' },
    secret
  );
  
  expect(entry.hash).toHaveLength(64); // SHA256 hex
  expect(entry.hmac).toHaveLength(64);
  expect(entry.previousHash).toBeNull(); // First in chain
  
  // Verify signature integrity
  const verified = verifyAuditEntry(entry, secret);
  expect(verified.valid).toBe(true);
});

it('chains previous hash correctly', async () => {
  const secret = 'test-secret';
  
  const entry1 = await signAuditEntry(
    '/labs/test-lab/notas-fiscais',
    'user-1',
    'notaFiscal.criada',
    { numero: 'NF-001' },
    secret
  );
  
  const entry2 = await signAuditEntry(
    '/labs/test-lab/notas-fiscais',
    'user-1',
    'notaFiscal.criada',
    { numero: 'NF-002' },
    secret
  );
  
  expect(entry2.previousHash).toBe(entry1.hash);
});
```

### Integration test: validate chain on failure injection

```typescript
it('detects tampered record in chain', async () => {
  // Insert 3 entries into chain
  const entry1 = await signAuditEntry(...);
  const entry2 = await signAuditEntry(...); // references entry1.hash
  const entry3 = await signAuditEntry(...); // references entry2.hash
  
  // Tamper: modify entry2's payload
  await db.collection('/labs/test-lab/notas-fiscais')
    .doc(entry2.id)
    .update({ 'payload.numero': 'FAKE-999' });
  
  // Validate: should detect tamper at entry3
  const result = await validateChainIntegrity(
    '/labs/test-lab/notas-fiscais',
    secret
  );
  
  expect(result.valid).toBe(false);
  expect(result.violations[0].reason).toBe('hash-sequence-broken');
  expect(result.violations[0].docId).toBe(entry3.id);
});
```

---

## Monitoring and alerting

### Cloud Logging filter

```
resource.type="cloud_function"
resource.labels.function_name=~"(criarNotaFiscal|confirmarRecebimento|yourModule_yourCallable)"
jsonPayload.message=~"writeChainedAudit.*FAILED"
```

### Alert rule

Alert on `[writeChainedAudit] FAILED after retries` with severity RED. This indicates:

- HMAC secret is missing or rotated (check `HCQ_SIGNATURE_HMAC_KEY`).
- Firestore quota exceeded (check project quota).
- Network/regional outage (check Cloud Status dashboard).

Paired alert: `[writeAuditLog] FAILED after retries` from Wave 1's audit resilience.

### Daily audit report

Query `*-auditFailures` collections daily:

```typescript
const failureMarkers = await db.collectionGroup('.*-auditFailures').get();
if (failureMarkers.size > 0) {
  // Email report to auditor with per-module summary
}
```

---

## Compliance mapping

| RDC 978 Article | DICQ Block | Satisfied by | Evidence |
|---|---|---|---|
| Art. 128 (Scientific & technical documentation audit) | 4.4 (Traceability) | Chain HMAC + failure markers | `validateChainIntegrity()` report |
| Art. 128 (Tamper-proof record) | 4.4.1 (Immutability) | SHA256 continuity + `previousHash` link | Hash recomputation detects any change |
| Art. 128 (Non-repudiation) | 4.4.2 (Operator identity) | `operadorId == request.auth.uid` at write time | Token claim in entry |

---

## References

- **Canonical implementation:** `functions/src/modules/compras/notaFiscal.ts`
- **Helper:** `functions/src/shared/audit/writeChainedAudit.ts`
- **Crypto module:** `functions/src/modules/audit/cryptoAudit.ts`
- **Validator:** `functions/src/modules/audit/chainHashValidator.ts`
- **Tests:** `functions/src/shared/audit/__tests__/writeChainedAudit.test.ts`, `functions/src/modules/audit/cryptoAudit.test.ts`
- **ADR-0017:** HMAC Signature Baseline Reset (Wave 2 incident response)
- **ADR-0030:** Criticos Audit Trail: HMAC Baseline Reset Extension

---

**Last updated:** 2026-05-08 (Wave 3 Agent 8 generalization)
