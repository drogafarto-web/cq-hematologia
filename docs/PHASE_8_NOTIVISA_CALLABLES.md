# PHASE 8: NOTIVISA Callables Specification

**Phase:** 8 (Phase 4 + Phase 8 integrated)  
**Status:** Planning + Foundation (callables architecture defined)  
**Last updated:** 2026-05-07  
**Author:** Architecture team  
**Milestone:** v1.4 (deferred from v1.3; Phase 10 criticos integration)

---

## Executive Summary

This document specifies 6 production-ready Cloud Function callables for NOTIVISA integration (Art. 6º §1 regulatory notifications, RDC 978). The callables implement:

1. **Submission pipeline** — draft creation, RT approval gate, government submission
2. **Status polling** — 5-min cron to fetch government responses + retry failures
3. **Draft lifecycle** — UI review, auditor rejection, outbox export
4. **Error handling** — rate limiting, retry logic, audit logging
5. **Phase 6 integration** — auto-draft trigger on critical detection (Phase 10 criticos module)

**Key constraints:**

- Multi-tenant (all endpoints require `labId`)
- Regulatory writes via callable only (RN-12 from Phase 0b pattern)
- Immutable audit chain + signature (ADR-0012)
- 5-min polling interval (government response time SLA)
- Rate limiting: 10 submissions/hour per lab (ANVISA throttle)

---

## Architecture Context

### Firestore Collections

```
/notivisa-drafts/{labId}/{draftId}
  └─ ├─ id: string (auto-generated)
     ├─ labId: string (multi-tenant key)
     ├─ laudoId: string (link to liberacao module)
     ├─ status: 'draft' | 'pending_approval' | 'approved' | 'submitted' | 'rejected'
     ├─ payload: NotivisaPayload (Art. 6º §1 schema)
     ├─ rejectionReason?: string (if status='rejected')
     ├─ rtApprovalSignature?: LogicalSignature (if status='approved')
     ├─ criadoEm: Timestamp
     ├─ deletadoEm: Timestamp | null (soft delete only)
     └─ auditLog: subcollection
        └─ {logId}
           ├─ action: 'CREATED' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'SUBMITTED'
           ├─ operatorId: string (request.auth.uid)
           ├─ ts: Timestamp
           └─ details: map

/notivisa-queue/{labId}/{eventId}
  └─ ├─ id: string (auto-generated)
     ├─ labId: string
     ├─ draftId: string (backref)
     ├─ pacienteCpf: string
     ├─ status: 'pending' | 'sent' | 'failed' | 'acknowledged' | 'rejected'
     ├─ attempts: integer (0–max retries)
     ├─ maxAttempts: integer (configurable per lab)
     ├─ lastAttempt?: Timestamp
     ├─ nextRetry?: Timestamp (calculated from exponential backoff)
     ├─ response?: { govCode: string, message: string, timestamp: number }
     ├─ createdAt: Timestamp
     └─ updatedAt: Timestamp

/notivisa-outbox/{labId}/{archiveId}
  └─ ├─ id: string
     ├─ labId: string
     ├─ draftIds: string[] (batch of drafts exported)
     ├─ filters: map (original query filters: date range, status, operatorId)
     ├─ exportedBy: string (operatorId)
     ├─ exportedAt: Timestamp
     ├─ format: 'csv' | 'json' | 'xlsx'
     ├─ url: string (Firebase Storage signed URL, 24h expiry)
     └─ signature: LogicalSignature (chain integrity)

/labs/{labId}/notivisa-config
  └─ ├─ labId: string
     ├─ enabled: boolean (lab opted-in)
     ├─ maxRetries: integer (3–10, default 5)
     ├─ retryIntervalMs: integer (60000–600000, default 300000)
     ├─ batchSize: integer (1–50, default 10)
     ├─ pollingIntervalMs: integer (300000 fixed at 5 min via scheduler)
     ├─ rtApprovalRequired: boolean (default true)
     ├─ govApiUrl: string (test vs prod endpoint)
     ├─ govApiKey: secret (managed via firebase functions:secrets:set)
     └─ lastPolledAt?: Timestamp
```

### Zod Schemas

All request payloads validated via Zod before database writes.

#### NotivisaPayload (Art. 6º §1 schema)

```typescript
const notivisaPayloadSchema = z.object({
  versao: z.literal('1.0'),
  laudo_id: z.string().min(1).max(128),
  paciente_cpf: z.string().regex(/^\d{11}$/, 'Invalid CPF format (11 digits)'),
  data_resultado: z.number().int().positive('Unix timestamp required'),
  resultados: z
    .array(
      z.object({
        analito: z.string().min(1).max(256),
        valor: z.union([z.number(), z.string()]),
        unidade: z.string().min(1).max(32),
        referencia: z.string().max(256),
      }),
    )
    .min(1, 'At least one resultado required'),
  assinador: z.object({
    cpf: z.string().regex(/^\d{11}$/, 'Invalid operator CPF'),
    nome: z.string().min(1).max(256),
    data_assinatura: z.number().int().positive(),
  }),
});
```

#### Callable Input/Output Schemas

---

## Callable Specifications

### 1. `submitNotivisa(labId, draftId, rtApprovalSignature?)`

**Type:** Callable (HTTPS)  
**Region:** `southamerica-east1`  
**Permission:** `isActiveMemberOfLab(labId) && hasRole('RT' | 'AUDITOR')`  
**Timeout:** 30s  
**Rate limit:** 10 submissions/hour per lab

**Purpose:**  
Gateway callable that validates RT approval (if required), signs draft as submitted, enqueues notification for async government transmission, and returns queue event ID.

**Input Schema:**

```typescript
const submitNotivisaInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
  rtApprovalSignature: z
    .object({
      hash: z.string().length(64),
      operatorId: z.string(),
      ts: z.number().int(),
    })
    .optional(),
  // Idempotency token (prevent double-submit on network retry)
  idempotencyToken: z.string().uuid().optional(),
});
```

**Output Schema:**

```typescript
const submitNotivisaOutputSchema = z.object({
  ok: z.literal(true),
  eventId: z.string(),
  status: z.literal('pending'),
  pacienteCpf: z.string(),
  nextPollAt: z.number().int().optional(),
});

const submitNotivisaErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'DRAFT_NOT_FOUND',
    'DRAFT_ALREADY_SUBMITTED',
    'INVALID_PAYLOAD',
    'RT_APPROVAL_REQUIRED',
    'APPROVAL_SIGNATURE_INVALID',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});
```

**Algorithm:**

1. **Validate request**
   - Parse input schema; throw `INVALID-ARGUMENT` if fails
   - Assert caller is member of lab (Firestore claim check)
   - Assert caller has role 'RT' or 'AUDITOR'

2. **Idempotency check**
   - Query `notivisa-queue/{labId}` where `idempotencyToken == token`
   - If found and status in `['pending', 'sent', 'acknowledged']`, return existing `eventId`

3. **Fetch draft**
   - Read `/notivisa-drafts/{labId}/{draftId}`
   - If not found, throw `NOT-FOUND` + code `DRAFT_NOT_FOUND`
   - If already submitted (status ≠ 'approved'), throw `FAILED-PRECONDITION` + code `DRAFT_ALREADY_SUBMITTED`
   - If `rtApprovalRequired == true` and draft status is 'draft', throw `FAILED-PRECONDITION` + code `RT_APPROVAL_REQUIRED`

4. **Validate RT signature** (if provided)
   - Hash payload (see `Signature Canonical` section)
   - Compare: `requestSignature.hash == computedHash`
   - Verify: `requestSignature.operatorId == request.auth.uid`
   - Verify: `requestSignature.ts` within 5 minutes of server time
   - If fails, throw `INVALID-ARGUMENT` + code `APPROVAL_SIGNATURE_INVALID`

5. **Rate limiting check**
   - Query submissions in last hour: `where createdAt >= now - 3600s`
   - If count ≥ 10, throw `RESOURCE-EXHAUSTED` + code `RATE_LIMITED`

6. **Enqueue notification**
   - Create event in `/notivisa-queue/{labId}/{eventId}`
     - status = 'pending'
     - attempts = 0
     - maxAttempts = config.maxRetries (default 5)
     - nextRetry = now + retryIntervalMs (first attempt immediate)
   - Create audit log entry: action='SUBMITTED', operatorId=uid, ts=now

7. **Trigger async job**
   - Fire background job (or rely on polling cron) to process queue
   - Return immediately with eventId + 'pending' status

**Error Codes:**

| Code                  | HTTP Status | Cause                                         | Mitigation                           |
| --------------------- | ----------- | --------------------------------------------- | ------------------------------------ |
| `INVALID-ARGUMENT`    | 400         | Payload schema fails Zod                      | Client retries with valid schema     |
| `UNAUTHENTICATED`     | 401         | No Firebase token                             | User re-authenticates                |
| `PERMISSION-DENIED`   | 403         | Not member of lab or wrong role               | User requests lab access             |
| `NOT-FOUND`           | 404         | Draft doesn't exist                           | Client queries draft existence first |
| `FAILED-PRECONDITION` | 412         | Draft already submitted or RT approval needed | Client checks draft status           |
| `RESOURCE-EXHAUSTED`  | 429         | Rate limited (10/hour exceeded)               | Client backs off exponentially       |
| `INTERNAL`            | 500         | Firestore write error                         | Auto-retry in client; alert SRE      |

**Audit Log Entry:**

```json
{
  "action": "SUBMITTED",
  "operatorId": "uid-of-caller",
  "ts": 1714945200000,
  "details": {
    "eventId": "queue-event-xyz",
    "pacienteCpf": "***1234",
    "idempotencyToken": "token-uuid"
  }
}
```

---

### 2. `notivisaDraftCreate(labId, laudoId, criticoData?)`

**Type:** Callable (HTTPS)  
**Region:** `southamerica-east1`  
**Permission:** `isActiveMemberOfLab(labId) && (hasRole('TECHNICIAN') || hasRole('AUDITOR'))`  
**Timeout:** 10s  
**Rate limit:** None (triggered server-side on crítico detection)

**Purpose:**  
System callable that auto-creates NOTIVISA draft from laudo when critério is detected (Phase 10 criticos module). Can also be called manually from UI to create draft from existing laudo.

**Input Schema:**

```typescript
const notivisaDraftCreateInputSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  // Optional: if triggered by criticos detector, include context
  criticoContext: z
    .object({
      detectadoEm: z.number().int(),
      analito: z.string(),
      valor: z.number(),
      severidade: z.enum(['alta', 'baixa']),
    })
    .optional(),
  // Allow manual override of auto-generated payload
  payloadOverride: z
    .object({
      resultados: z.array(
        z.object({
          analito: z.string(),
          valor: z.union([z.number(), z.string()]),
          unidade: z.string(),
          referencia: z.string(),
        }),
      ),
    })
    .optional(),
});
```

**Output Schema:**

```typescript
const notivisaDraftCreateOutputSchema = z.object({
  ok: z.literal(true),
  draftId: z.string(),
  status: z.literal('draft'),
  payload: notivisaPayloadSchema,
  createdAt: z.number().int(),
});
```

**Algorithm:**

1. **Validate request**
   - Parse input schema
   - Assert caller is member of lab

2. **Fetch laudo**
   - Read from `liberacao-laudos/{labId}/{laudoId}` (Phase 10 liberacao module)
   - If not found, throw `NOT-FOUND`
   - Validate required fields: paciente CPF, resultados, assinadura

3. **Fetch paciente**
   - Read paciente document (reference from laudo)
   - Extract CPF (validate 11 digits)

4. **Build NOTIVISA payload**
   - Use `notivisaFormatter(laudo, paciente)` from `src/shared/notivisa.ts`
   - If `payloadOverride` provided, merge into resultados
   - Validate payload against schema
   - If invalid, throw `INVALID-ARGUMENT` + detailed error

5. **Check draft exists**
   - Query drafts where `laudoId == {laudoId}` and `status != 'submitted'`
   - If exists, return existing draft ID (idempotent)

6. **Create draft**
   - Write to `/notivisa-drafts/{labId}/{newDraftId}`:
     - status = 'draft'
     - payload = validated payload
     - laudoId = laudoId
     - pacienteCpf = masked (last 4 digits only in audit log)
     - criticoContext = if provided
     - criadoEm = serverTimestamp()
   - Create audit log: action='CREATED', operatorId=uid, details={criticoContext}

7. **Return**
   - draftId, payload, createdAt

**Error Codes:**

| Code                  | Cause                           |
| --------------------- | ------------------------------- |
| `NOT-FOUND`           | Laudo or paciente not found     |
| `INVALID-ARGUMENT`    | Payload schema fails validation |
| `FAILED-PRECONDITION` | Paciente missing CPF            |

**Audit Log Entry:**

```json
{
  "action": "CREATED",
  "operatorId": "system",
  "ts": 1714945200000,
  "details": {
    "source": "critico_detector" | "manual_ui",
    "laudoId": "laudo-xyz",
    "criticoAnalito": "potassio",
    "criticoSeveridade": "alta"
  }
}
```

---

### 3. `notivisaStatusCheck()` [CRON 5-min]

**Type:** Scheduled Function (Cloud Scheduler)  
**Region:** `southamerica-east1`  
**Schedule:** Every 5 minutes (`0 */5 * * * *`)  
**Timeout:** 120s  
**Retry:** 3 times on failure (Cloud Scheduler built-in)

**Purpose:**  
Cron job that polls government API for responses to submitted notifications, updates queue status, retries failures with exponential backoff, and alerts operator on acknowledgment/rejection.

**Algorithm:**

1. **Fetch config**
   - Read all labs where `notivisa-config.enabled == true`
   - For each lab:

2. **Query pending events**
   - Get all events where `status in ['pending', 'sent']`
   - Ordered by `nextRetry ASC`
   - Limit to `config.batchSize` (default 10)

3. **Poll government API** (per event)
   - Call government endpoint with:
     - `Authorization: Bearer {secret.govApiKey}`
     - `govCode` from event (if status != 'pending')
     - Timeout: 10s per request
   - Handle responses:
     - **Acknowledged:** Update event status='acknowledged'
     - **Rejected:** Update event status='rejected' + store response.message
     - **Unknown:** Keep status='sent', increment attempts
     - **Network error:** Keep status='sent', schedule next retry

4. **Retry logic** (exponential backoff)
   - If attempts < maxAttempts:
     - `nextRetry = now + retryIntervalMs * 2^(attempts-1)`
     - Cap at 24 hours
   - Else:
     - status='failed'
     - Alert operator in audit log + UI notification

5. **Audit logging** (non-blocking, fire-and-forget)
   - For each status change: create audit log entry
   - Log government response (govCode + message)
   - Batch writes where possible

6. **Update lab config**
   - Set `notivisa-config.lastPolledAt = now`

7. **Return**
   - { processed: number, acknowledged: number, failed: number, errors: [] }
   - Log summary (Cloud Logs)

**Error Handling:**

- If government API unreachable, increment attempts but don't fail function
- If Firestore write fails, retry locally; if fails 3x, alert SRE
- If event payload is corrupted, mark status='failed' + log

**Audit Log Entry:**

```json
{
  "action": "STATUS_POLLED",
  "operatorId": "system",
  "ts": 1714945200000,
  "details": {
    "eventId": "queue-event-xyz",
    "previousStatus": "pending",
    "newStatus": "acknowledged",
    "govResponse": {
      "code": "ACK-001",
      "message": "Notification received"
    },
    "attempts": 1
  }
}
```

---

### 4. `getNotivisaDraft(labId, draftId)`

**Type:** Callable (HTTPS)  
**Region:** `southamerica-east1`  
**Permission:** `isActiveMemberOfLab(labId)`  
**Timeout:** 5s  
**Rate limit:** None (read-only)

**Purpose:**  
Fetch a single draft with full context (payload, audit log, current status, linked events).

**Input Schema:**

```typescript
const getNotivisaDraftInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
});
```

**Output Schema:**

```typescript
const getNotivisaDraftOutputSchema = z.object({
  ok: z.literal(true),
  draft: z.object({
    id: z.string(),
    labId: z.string(),
    laudoId: z.string(),
    status: z.enum(['draft', 'pending_approval', 'approved', 'submitted', 'rejected']),
    payload: notivisaPayloadSchema,
    rejectionReason: z.string().optional(),
    rtApprovalSignature: z
      .object({
        hash: z.string(),
        operatorId: z.string(),
        ts: z.number().int(),
      })
      .optional(),
    criadoEm: z.number().int(),
    updatedAt: z.number().int().optional(),
  }),
  auditLog: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      operatorId: z.string(),
      ts: z.number().int(),
      details: z.record(z.any()),
    }),
  ),
  linkedEvent: z
    .object({
      eventId: z.string(),
      status: z.enum(['pending', 'sent', 'failed', 'acknowledged', 'rejected']),
      attempts: z.number().int(),
      nextRetry: z.number().int().optional(),
    })
    .optional(),
});
```

**Algorithm:**

1. **Validate request**
   - Parse input schema
   - Assert caller is member of lab

2. **Fetch draft**
   - Read `/notivisa-drafts/{labId}/{draftId}`
   - If not found, throw `NOT-FOUND`
   - If `deletadoEm != null`, throw `NOT-FOUND` (soft delete)

3. **Fetch audit log**
   - Query audit subcollection, ordered by `ts DESC`
   - Limit 50 entries (most recent events)

4. **Fetch linked event** (if submitted)
   - If draft status is 'submitted', query `/notivisa-queue/{labId}` where `draftId == {draftId}`
   - If found, include event details

5. **Return**
   - Draft + auditLog + linkedEvent (if applicable)

---

### 5. `rejectNotivisaDraft(labId, draftId, reason)`

**Type:** Callable (HTTPS)  
**Region:** `southamerica-east1`  
**Permission:** `isActiveMemberOfLab(labId) && (hasRole('RT') || hasRole('AUDITOR'))`  
**Timeout:** 10s  
**Rate limit:** None

**Purpose:**  
RT marks draft as rejected with reason, preventing submission. Auditor can then investigate or request fixes.

**Input Schema:**

```typescript
const rejectNotivisaDraftInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason max 500 characters'),
  signature: z.object({
    hash: z.string().length(64),
    operatorId: z.string(),
    ts: z.number().int(),
  }),
});
```

**Output Schema:**

```typescript
const rejectNotivisaDraftOutputSchema = z.object({
  ok: z.literal(true),
  draftId: z.string(),
  status: z.literal('rejected'),
  rejectionReason: z.string(),
});
```

**Algorithm:**

1. **Validate request**
   - Parse input schema
   - Assert caller is RT or AUDITOR

2. **Fetch draft**
   - Read draft; if not found or already submitted, throw error

3. **Verify signature** (same as submitNotivisa)
   - Hash: `{ reason, draftId }`
   - Compare hash and operatorId

4. **Update draft**
   - Set status='rejected', rejectionReason=reason
   - Set updatedAt=now

5. **Audit log**
   - action='REJECTED', operatorId=uid
   - details={reason, signature}

6. **Return**
   - draftId, status='rejected', reason

---

### 6. `listNotivisaOutbox(labId, filters)`

**Type:** Callable (HTTPS)  
**Region:** `southamerica-east1`  
**Permission:** `isActiveMemberOfLab(labId) && hasRole('AUDITOR')`  
**Timeout:** 30s  
**Rate limit:** 10 requests/hour per lab

**Purpose:**  
Auditor export endpoint. Returns paginated list of submitted notifications with filters (date range, status, operator), can batch-export as CSV/JSON/XLSX.

**Input Schema:**

```typescript
const listNotivisaOutboxInputSchema = z.object({
  labId: z.string().min(1),
  filters: z
    .object({
      status: z.enum(['submitted', 'acknowledged', 'rejected', 'failed']).optional(),
      operatorId: z.string().optional(),
      dateRangeStart: z.number().int().optional(),
      dateRangeEnd: z.number().int().optional(),
      pacienteCpf: z
        .string()
        .regex(/^\d{11}$/)
        .optional(),
    })
    .optional(),
  format: z.enum(['json', 'csv', 'xlsx']).default('json'),
  pageSize: z.number().int().min(10).max(500).default(50),
  pageToken: z.string().optional(),
});
```

**Output Schema:**

```typescript
const listNotivisaOutboxOutputSchema = z.object({
  ok: z.literal(true),
  items: z.array(
    z.object({
      draftId: z.string(),
      eventId: z.string().optional(),
      status: z.string(),
      pacienteCpf: z.string(),
      laudo_id: z.string(),
      submittedAt: z.number().int(),
      govStatus: z.enum(['pending', 'acknowledged', 'rejected', 'failed']).optional(),
      attempts: z.number().int().optional(),
    }),
  ),
  pageToken: z.string().optional(),
  total: z.number().int(),
  // For export formats (CSV/XLSX)
  downloadUrl: z.string().optional(),
});
```

**Algorithm:**

1. **Validate request**
   - Parse input schema
   - Assert caller is AUDITOR

2. **Build query**
   - Base: `/notivisa-drafts/{labId}` where `status == 'submitted'`
   - Apply filters:
     - dateRange: `criadoEm >= start AND criadoEm <= end`
     - operatorId: from audit log (join if needed)
     - pacienteCpf: from payload
   - Sort by criadoEm DESC
   - Paginate by pageToken

3. **Execute query**
   - Fetch results + next pageToken
   - Enrich with linked event status from `/notivisa-queue`

4. **Format output**
   - If format=='json': return items array
   - If format=='csv'/'xlsx':
     - Generate file in Cloud Functions (nodejs libs)
     - Upload to Storage: `gs://hmatologia2.appspot.com/exports/notivisa/{archiveId}.{ext}`
     - Create signed URL (24h expiry)
     - Record export in `/notivisa-outbox/{labId}/{archiveId}` with signature
     - Return downloadUrl

5. **Return**
   - items + pageToken + total + downloadUrl (if export)

---

## Error Handling Strategy

### Callable-level error codes

All callables return errors in consistent format:

```typescript
type CallableError = {
  ok: false;
  code: string; // Machine-readable error code
  message: string; // User-facing message
  details?: Record<string, any>; // Debug info
};
```

### HTTP Status Codes

| Error               | HTTP | Code                  | Client action            |
| ------------------- | ---- | --------------------- | ------------------------ |
| Invalid input       | 400  | `INVALID-ARGUMENT`    | Retry with valid data    |
| Unauthenticated     | 401  | `UNAUTHENTICATED`     | Re-authenticate          |
| Permission denied   | 403  | `PERMISSION-DENIED`   | Request lab access       |
| Not found           | 404  | `NOT-FOUND`           | Check existence first    |
| Precondition failed | 412  | `FAILED-PRECONDITION` | Check state before retry |
| Rate limited        | 429  | `RESOURCE-EXHAUSTED`  | Backoff exponentially    |
| Internal error      | 500  | `INTERNAL`            | Alert SRE, auto-retry    |

### Retry Strategy

**Client side (callable submissions):**

- Exponential backoff: 1s, 2s, 4s, 8s, 16s (cap at 60s)
- Max 5 retries
- Always use `idempotencyToken` to prevent duplicate submissions

**Server side (polling cron):**

- Exponential backoff per event: `interval * 2^(attempts-1)`
- Cap at 24 hours
- Max attempts configurable per lab (default 5)
- Retry only on transient errors (network, timeout, 5xx)

---

## Signature Canonical (Shared with ADR-0012)

All regulatory writes use LogicalSignature (SHA-256 hash):

```typescript
interface LogicalSignature {
  hash: string; // SHA-256 hex (64 chars)
  operatorId: string; // request.auth.uid
  ts: number; // Unix timestamp (ms) at signing time
}

function generateSignature(operatorId: string, payload: any): LogicalSignature {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  return {
    hash,
    operatorId,
    ts: Date.now(),
  };
}

function verifySignature(sig: LogicalSignature, payload: any): boolean {
  const expectedHash = generateSignature(sig.operatorId, payload).hash;
  return sig.hash === expectedHash && Math.abs(Date.now() - sig.ts) < 300000; // 5 min window
}
```

---

## Rate Limiting Strategy

### Per-lab limits

| Endpoint              | Limit        | Window     | Fallback                   |
| --------------------- | ------------ | ---------- | -------------------------- |
| `submitNotivisa`      | 10 reqs/hour | Sliding 1h | 429 + `RESOURCE-EXHAUSTED` |
| `listNotivisaOutbox`  | 10 reqs/hour | Sliding 1h | 429 + `RESOURCE-EXHAUSTED` |
| `notivisaDraftCreate` | Unlimited    | —          | Server-side trigger only   |
| `getNotivisaDraft`    | Unlimited    | —          | Read-only                  |
| `rejectNotivisaDraft` | Unlimited    | —          | Write non-critical         |

### Implementation

```typescript
// In callable middleware
async function checkRateLimit(labId: string, endpoint: string): Promise<void> {
  const key = `ratelimit:${labId}:${endpoint}`;
  const count = await redisClient.incr(key);
  if (count === 1) await redisClient.expire(key, 3600); // 1 hour

  if (count > LIMITS[endpoint]) {
    throw new HttpsError('resource-exhausted', 'Rate limit exceeded');
  }
}
```

_(Alternative: use Firestore counters if Redis unavailable)_

---

## Audit Logging Pattern

Every regulatory write creates immutable audit log entry:

```typescript
async function auditLog(
  db: Firestore,
  labId: string,
  parentRef: string, // e.g., "notivisa-drafts/labId/draftId"
  entry: {
    action: string;
    operatorId: string;
    ts: Timestamp;
    details: Record<string, any>;
  },
): Promise<void> {
  const logRef = doc(db, parentRef, 'auditLog').collection('auditLog').doc();
  await setDoc(logRef, {
    ...entry,
    criadoEm: serverTimestamp(),
  });
}
```

**Sensitive field masking:**

- Patient CPF: log last 4 digits only (`***1234`)
- Patient name: hash or omit (store only in encrypted payload)
- Operator name: store UID, resolve in UI if needed

---

## Phase 6 Integration (Críticos Module)

When Phase 10 criticos module detects critical value, it automatically:

1. **Triggers** `notivisaDraftCreate(labId, laudoId, criticoContext)` server-side
2. **Notifies** operator via email + UI badge
3. **Sets** draft status='draft' (awaiting manual RT review)
4. **Awaits** operator to call `submitNotivisa` OR `rejectNotivisaDraft`

```typescript
// In criticos/detector.ts (Phase 10)
export async function onCriticoDetected(laudo: Laudo, critico: CriticoEvent) {
  // Call NOTIVISA draft creator
  const response = await httpsCallable(
    functions,
    'notivisaDraftCreate',
  )({
    labId: laudo.labId,
    laudoId: laudo.id,
    criticoContext: {
      detectadoEm: critico.ts,
      analito: critico.analito,
      valor: critico.valor,
      severidade: critico.severidade,
    },
  });

  // Notify operator
  await notifyOperatorCritico(laudo.labId, critico);
}
```

---

## Testing Strategy

### Unit tests (per callable)

```typescript
describe('submitNotivisa', () => {
  test('validates Zod schema', () => {});
  test('rate limits at 10/hour', () => {});
  test('creates queue event on success', () => {});
  test('returns idempotent eventId on retry', () => {});
  test('rejects if draft not found', () => {});
  test('rejects if RT approval required but missing', () => {});
});

describe('notivisaStatusCheck (cron)', () => {
  test('polls government API per event', () => {});
  test('exponential backoff on retry', () => {});
  test('marks failed after max attempts', () => {});
  test('audits each status change', () => {});
});
```

### Integration tests

- Full flow: create draft → submit → poll → acknowledge
- Error recovery: network failure → retry → success
- Rate limiting: 11th request blocked, response is 429
- Soft delete: rejected draft cannot be resubmitted

### E2E smoke tests (Phase 10-06)

- RT libera laudo → crítico detected → draft auto-created → RT reviews → RT submits → poll confirms acknowledgment

---

## Deployment & Runbook

### Pre-deploy checklist

- [ ] All Zod schemas pass `npm test`
- [ ] Firestore rules updated (soft delete, chainHash validation)
- [ ] Secret `NOTIVISA_API_KEY` provisioned via `firebase functions:secrets:set`
- [ ] Firestore indexes created for queries (date range + status filters)
- [ ] Rate limit Redis/Firestore counter ready
- [ ] Audit log subcollections initialized in `firestore.rules`
- [ ] Cloud Scheduler cron job configured (every 5 min)

### Deploy order

1. `firebase deploy --only firestore:rules,firestore:indexes`
2. `firebase deploy --only functions:notivisaDraftCreate,notivisaStatusCheck,...`
3. Verify functions respond (health check)
4. Create Cloud Scheduler job: `gcloud scheduler jobs create pubsub notivisa-polling --schedule "*/5 * * * *" --topic notivisa-poll`
5. `firebase deploy --only hosting` (UI for draft review)
6. Smoke test: create draft → submit → poll

### Monitoring

- **Cloud Logs filter:** `resource.type="cloud_function" AND functionName="notivisa*"`
- **Alert triggers:**
  - Error rate >1% for 5 min
  - Rate limit hits >5/hour per lab
  - Queue backlog (pending events >20 per lab)
- **Dashboard:**
  - Submissions/hour per lab
  - Acknowledgment rate (% of submitted that acknowledged)
  - Avg retry attempts per event

---

## Future Enhancements (v1.4+)

1. **ICP-Brasil signatures** — upgrade from LogicalSignature to digital certificate
2. **SMS/WhatsApp notifications** — Twilio/Zenvia integration
3. **Webhook callbacks** — government API sends status updates (not polling)
4. **Batch submission** — submit multiple drafts in single government request
5. **Multi-language support** — notifications in Portuguese/Spanish/English

---

## References

- **ADR-0012** — Audit trail + LogicalSignature (this document reuses)
- **ADR-0021** — NOTIVISA queue pattern (foundation)
- **Phase 10 Overview** — Liberação + Críticos (integration point)
- **RDC 978 Art. 6º §1** — NOTIVISA mandatory schema
- **DICQ 5.9.3** — Immutable audit + versioning
- **Firestore security rules** — `.claude/rules/firestore-security.md`
- **Deploy protocol** — `.claude/rules/deploy-protocol.md`
