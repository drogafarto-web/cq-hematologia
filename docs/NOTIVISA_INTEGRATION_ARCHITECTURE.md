# NOTIVISA Integration Architecture Document

**Version:** 1.0  
**Last Updated:** 2026-05-07  
**Status:** Complete (Phase 4–12 Roadmap)  
**Author:** CTO / Engineering Team  
**Audience:** Engineers, Auditors, Regulatory Affairs

---

## Executive Summary

HC Quality v1.4 implements **NOTIVISA (Notificação Imediata de Vítima de Violência / RDC 978 Art. 66 compliance)** in two phases:

1. **Phase 8 (May–June 2026):** Sandbox NOTIVISA — form generation, RT approval workflow, audit trail, manual export.
2. **Phase 12+ (Aug–Sept 2026):** Production NOTIVISA — real Anvisa API integration, async queue processing, webhook acknowledgment, idempotent retries.

This document covers:

- **Architectural overview** (client → Cloud Functions → Portal API → Anvisa)
- **All 8 callable specs** with I/O schemas
- **Async queue pattern** (append-only outbox, exponential backoff)
- **Error handling & retry strategy** (transient vs. permanent failures)
- **Security model** (token management, rate limiting, signature verification)
- **Compliance alignment** (RDC 978 Art. 66, DICQ 4.4 audit trail)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Flow Diagram](#api-flow-diagram)
3. [Callable Functions Specification](#callable-functions-specification)
4. [Firestore Data Model](#firestore-data-model)
5. [Queue Processing Strategy](#queue-processing-strategy)
6. [Error Handling & Retry Logic](#error-handling--retry-logic)
7. [Security Considerations](#security-considerations)
8. [RDC 978 Art. 66 Compliance](#rdc-978-art-66-compliance)
9. [DICQ Compliance (Audit Trail & Operator Tracking)](#dicq-compliance-audit-trail--operator-tracking)
10. [Deployment Checklist](#deployment-checklist)

---

## Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                          HC Quality Web                           │
│                    (React 19 + Zustand 5)                        │
└───────────┬────────────────────────────────────────┬─────────────┘
            │                                        │
            ├─ notivisaDraftCreate()           ┌─────▼──────────┐
            ├─ getNotivisaDraft()              │ Cloud           │
            ├─ submitNotivisa()                │ Functions       │
            ├─ listNotivisaOutbox()            │ (Gen 2)         │
            └─ notivisaExportArchive()         │ 🔒 Auth        │
                                               │ ✓ Firestore    │
                                               └────────┬────────┘
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    │                   │                   │
                        ┌───────────▼────────┐ ┌───────▼────────┐ ┌──────▼──────┐
                        │ Firestore (Phase 4)│ │  Secret Mgr    │ │ Cloud       │
                        │ (outbox queue)      │ │ (certificates) │ │ Logging     │
                        │                     │ └────────────────┘ └─────────────┘
                        └─────────────────────┘
                                    │
                        ┌───────────▼────────┐
                        │ Scheduled Processor │ (every 5 min)
                        │ processNotivisa...  │
                        └───────────┬─────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │ Phase 8       │ Phase 12+     │
                    │ (Sandbox)     │ (Production)  │
                    │               │               │
                ┌───▼──────┐  ┌────▼──────────────┐
                │   Mock    │  │ Anvisa SOAP API  │
                │ Submitter │  │ (real endpoint)  │
                └───┬───────┘  └────┬──────────────┘
                    │               │
                    │               ├─ POST form
                    │               ├─ Receive receipt
                    │               └─ Webhook callback
                    │
                    └─ Status: 'acknowledged'
```

### Phase Breakdown

| Phase                                          | Timeline             | Scope                                                             | Status                           |
| ---------------------------------------------- | -------------------- | ----------------------------------------------------------------- | -------------------------------- |
| **Phase 4** (NOTIVISA Sandbox Setup)           | May 20–June 30, 2026 | Form generation, draft approval, mock queue, audit export         | In Scope                         |
| **Phase 8** (NOTIVISA Production Config)       | July 1–July 31, 2026 | Real API endpoint config, certificate provisioning, webhook setup | Dependent on Phase 4             |
| **Phase 12** (NOTIVISA Production Integration) | Aug 1–Sept 15, 2026  | Real API submission, idempotent retries, production deployment    | Deferred (certificate lead time) |

---

## API Flow Diagram

### Client → Cloud Functions → Firestore → Anvisa (Sequence)

```
User (RT / Lab Admin)
│
├─[1] notivisaDraftCreate(labId, laudoId)
│    │ ✓ Validate laudo exists + has resultados
│    │ ✓ Fetch paciente data (CPF required)
│    │ ✓ Build NOTIVISA Art. 6º payload (Zod validation)
│    │ ✓ Write draft to /notivisa-drafts/{labId}/drafts/{draftId}
│    │ ✓ Create auditLog entry (CREATED action)
│    └─→ Response: {ok, draftId, status: 'draft', payload, createdAt}
│
├─[2] getNotivisaDraft(labId, draftId)
│    │ ✓ Authorize (must be RT or admin)
│    │ ✓ Fetch draft doc + auditLog subcollection
│    └─→ Response: {ok, draftId, payload, auditLog, status}
│
├─[3] approveNotivisaDraft(labId, draftId)
│    │ ✓ Authorize (RT role required)
│    │ ✓ Check draft status = 'draft'
│    │ ✓ Update status → 'approved' + RT signature (chainHash)
│    │ ✓ Create auditLog entry (APPROVED action)
│    └─→ Response: {ok, draftId, status: 'approved', approvedBy, approvedAt}
│
├─[4] submitNotivisa(labId, draftId)
│    │ ✓ Authorize (RT or admin)
│    │ ✓ Check draft status = 'approved'
│    │ ✓ Create queue entry in /notivisa-outbox/{labId}/{entryId}
│    │ ✓ Set status = 'pending', submissionAttempts = []
│    │ ✓ Set notificationDeadline = resultDate + 24h
│    │ ✓ Update draft status → 'submitted'
│    └─→ Response: {ok, entryId, status: 'pending', deadline}
│
└─[5–7] Background: Scheduled Processor (every 5 min)
         │ ✓ Query pending entries (status = 'pending')
         │ ✓ Check if nextRetryTime ≤ now
         │ ✓ Attempt submission (mock Phase 4 / real API Phase 12+)
         │ ✓ Append submissionAttempt record (immutable)
         │ ✓ If success: status → 'submitted'
         │ ✓ If retryable error (5xx): wait for next cycle
         │ ✓ If non-retryable (4xx) or max attempts: escalate supervisor
         └─→ Firestore update: submissionAttempts.push({...})

        [6] Anvisa Webhook (Phase 12+)
            │ ✓ Anvisa calls /notivisaWebhookHandler(payload)
            │ ✓ Verify HMAC-SHA256 signature
            │ ✓ Find entry by idempotencyKey
            │ ✓ Update status → 'acknowledged'
            │ ✓ Record anvisa_eventId + receiptNumber
            └─→ Firestore update: status = 'acknowledged'

        [7] Auditor Export
            │ ✓ Call notivisaExportArchive(labId, daysBack, format)
            │ ✓ Authorize (AUDITOR role required)
            │ ✓ Query acknowledged entries (past 90 days)
            │ ✓ Generate CSV + JSON
            │ ✓ Store immutable archive doc
            └─→ Response: {ok, archiveId, recordCount, formats, expiresAt}

        [8] Soft Delete (Rare)
            │ ✓ Call notivisaSoftDelete(labId, entryId, reason)
            │ ✓ Authorize (admin only)
            │ ✓ Update status → 'deleted', record reason + timestamp
            │ ✓ Append auditLog entry (immutable)
            └─→ Response: {ok, entryId, deletedAt, deletedBy}
```

---

## Callable Functions Specification

### 1. `notivisaDraftCreate` (Phase 4+)

**Purpose:** Generate NOTIVISA draft form from laboratory result (laudo).

**Region:** `southamerica-east1`

**Authorization:** ✓ Authenticated user, member of lab

**Input Schema:**

```typescript
{
  labId: string;                    // Lab identifier
  laudoId: string;                  // Result ID to convert to NOTIVISA form
  criticoContext?: {                // Optional: triggered by crítico detector
    detectadoEm: number;            // Timestamp when critical result detected
    analito: string;                // Analyte name (e.g., "HIV", "Hepatitis C")
    valor: number;                  // Measured value
    severidade: 'alta' | 'baixa';   // Severity level
  };
  payloadOverride?: {               // Optional: override specific fields
    resultados: Array<{
      analito: string;
      valor: number | string;
      unidade: string;
      referencia: string;
    }>;
  };
}
```

**Output (Success):**

```typescript
{
  ok: true;
  draftId: string; // Firestore doc ID
  status: 'draft'; // Immutable status
  payload: NotivisaPayload; // Full NOTIVISA payload (Art. 6º §1)
  createdAt: number; // Unix timestamp
}
```

**Output (Error):**

```typescript
{
  ok: false;
  code: 'LAUDO_NOT_FOUND' | 'PACIENTE_NOT_FOUND' | 'INVALID_PAYLOAD' | 'INTERNAL_ERROR';
  message: string;
}
```

**Side Effects:**

- Creates `/notivisa-drafts/{labId}/drafts/{draftId}`
- Appends audit log entry (action: 'CREATED')
- Logs to Cloud Logging with labId, draftId, source

**Idempotency:** Yes — checks for existing draft with same laudoId + status in ['draft', 'approved', 'submitted']; returns existing if found.

---

### 2. `getNotivisaDraft` (Phase 4+)

**Purpose:** Retrieve NOTIVISA draft details + audit log.

**Region:** `southamerica-east1`

**Authorization:** ✓ RT or Auditor role

**Input Schema:**

```typescript
{
  labId: string;
  draftId: string;
}
```

**Output (Success):**

```typescript
{
  ok: true;
  draftId: string;
  status: 'draft' | 'approved' | 'submitted' | 'rejected' | 'deleted';
  payload: NotivisaPayload;
  auditLog: Array<{
    action: 'CREATED' | 'APPROVED' | 'SUBMITTED' | 'REJECTED';
    operatorId: string;
    ts: number;
    details: Record<string, any>;
  }>;
  createdAt: number;
}
```

**Output (Error):**

```typescript
{
  ok: false;
  code: 'UNAUTHORIZED' | 'DRAFT_NOT_FOUND' | 'INTERNAL_ERROR';
  message: string;
}
```

**Side Effects:** None (read-only).

---

### 3. `approveNotivisaDraft` (Phase 4+)

**Purpose:** RT approval of NOTIVISA draft (requires signature).

**Region:** `southamerica-east1`

**Authorization:** ✓ RT role only

**Input Schema:**

```typescript
{
  labId: string;
  draftId: string;
  signature: {
    hash: string; // SHA-256(payload) — HMAC-signed by client
    operatorId: string; // request.auth.uid
    ts: number; // Unix timestamp of approval
  }
}
```

**Output (Success):**

```typescript
{
  ok: true;
  draftId: string;
  status: 'approved';
  approvedBy: string;
  approvedAt: number;
  chainHash: string; // Cumulative HMAC over status + timestamp
}
```

**Output (Error):**

```typescript
{
  ok: false;
  code: 'UNAUTHORIZED' |
    'DRAFT_NOT_FOUND' |
    'INVALID_STATUS' |
    'SIGNATURE_INVALID' |
    'INTERNAL_ERROR';
  message: string;
}
```

**Side Effects:**

- Updates `/notivisa-drafts/{labId}/drafts/{draftId}` → status = 'approved'
- Appends audit log entry (action: 'APPROVED', signature recorded)
- Generates chainHash per ADR-0012 (RDC 978 audit trail)

**Signature Validation:** HMAC-SHA256(payload, HCQ_SIGNATURE_KEY) must match input hash.

---

### 4. `submitNotivisa` (Phase 4+)

**Purpose:** Move approved draft to submission queue (async processing).

**Region:** `southamerica-east1`

**Authorization:** ✓ RT or Admin role

**Input Schema:**

```typescript
{
  labId: string;
  draftId: string;
}
```

**Output (Success):**

```typescript
{
  ok: true;
  entryId: string; // Outbox entry ID
  status: 'pending';
  notificationDeadline: number; // Unix timestamp (resultDate + 24h)
  nextRetryTime: number; // When first submission attempt will be made
}
```

**Output (Error):**

```typescript
{
  ok: false;
  code: 'UNAUTHORIZED' | 'DRAFT_NOT_FOUND' | 'INVALID_STATUS' | 'INTERNAL_ERROR';
  message: string;
}
```

**Side Effects:**

- Creates `/labs/{labId}/notivisa-outbox/{entryId}`
- Sets status = 'pending', submissionAttempts = []
- Updates draft status → 'submitted'
- Triggers scheduled processor on next 5-minute cycle

**Timeline:** Entry queued immediately; first submission attempt within 5 minutes.

---

### 5. `notivisaExportArchive` (Phase 4+)

**Purpose:** Auditor-only export of past submissions (compliance audit).

**Region:** `southamerica-east1`

**Authorization:** ✓ AUDITOR role only

**Input Schema:**

```typescript
{
  labId: string;
  daysBack: number; // How many days to export (default 90, max 365)
  format: 'csv' | 'json' | 'both'; // Export format (default 'both')
}
```

**Output (Success):**

```typescript
{
  ok: true;
  archiveId: string; // Archive doc ID
  exportedAt: number; // Unix timestamp of export
  recordCount: number; // Entries included
  formats: Array<'csv' | 'json'>; // Actual formats created
  expiresAt: number; // Archive expires after 90 days
}
```

**Output (Error):**

```typescript
{
  ok: false;
  code: 'UNAUTHORIZED' | 'LAB_NOT_FOUND' | 'NO_DATA' | 'EXPORT_FAILED' | 'INTERNAL_ERROR';
  message: string;
}
```

**Side Effects:**

- Creates immutable archive doc in `/labs/{labId}/notivisa-outbox/_archives/exports/{archiveId}`
- Stores CSV + JSON file contents in subcollection (if <1MB each)
- Appends audit log entry (action: 'CREATED', exportedBy, recordCount)
- Archive immutable — cannot be modified or deleted

**Data Included:**

- archiveId, diseaseCode, patientAnon, resultValue, resultDate, status
- receiptCode (from Anvisa), submissionAttempts count, createdAt
- Sensitive data masked (patient name anonymized)

**Retention:** Archives retained 90 days; after expiration, soft-delete.

---

### 6. `notivisaSoftDelete` (Phase 4+)

**Purpose:** Mark NOTIVISA entry as deleted (audit trail preserved, soft-delete only).

**Region:** `southamerica-east1`

**Authorization:** ✓ Admin or Owner role only

**Input Schema:**

```typescript
{
  labId: string;
  entryId: string;
  reason: 'duplicate' | 'incorrect-patient' | 'false-positive' | 'test-entry' | 'other';
  notes?: string;                   // Max 500 chars (optional explanation)
}
```

**Output (Success):**

```typescript
{
  ok: true;
  entryId: string;
  deletedAt: number;
  deletedBy: string; // operatorId who initiated deletion
}
```

**Output (Error):**

```typescript
{
  ok: false;
  code: 'UNAUTHORIZED' |
    'ENTRY_NOT_FOUND' |
    'ENTRY_ALREADY_DELETED' |
    'ALREADY_SUBMITTED' |
    'INVALID_PAYLOAD' |
    'INTERNAL_ERROR';
  message: string;
}
```

**Side Effects:**

- Updates entry status → 'deleted'
- Appends audit log entry (action: 'SOFT_DELETED', reason, notes, previousStatus)
- If entry was already submitted to Anvisa (status='acknowledged'): logs warning, proceeds with deletion (audit trail preserved)
- No hard delete — all data remains queryable for audit

**Compliance:** Per RN-06 (soft delete only) and ADR-0026 (append-only outbox).

---

### 7. `notivisaWebhookHandler` (Phase 12+)

**Purpose:** HTTP endpoint for Anvisa acknowledgment callbacks (production only).

**Region:** `southamerica-east1`

**Authorization:** ✓ HMAC-SHA256 signature verification (no auth.uid required)

**Input (Webhook Payload from Anvisa):**

```typescript
{
  idempotencyKey: string;           // 64-char hex (SHA-256)
  status: 'success' | 'rejected' | 'error';
  eventId: string;                  // Anvisa internal event ID
  timestamp: string;                // ISO 8601 datetime
  receiptNumber?: string;           // Anvisa receipt code
  errorCode?: string;               // If status = 'error' or 'rejected'
  errorMessage?: string;
}
```

**HTTP Response:**

```typescript
{
  received: true;
  entryId?: string;
  labId?: string;
  note?: string;
}
```

**Status Code:** 200 OK (always, to prevent Anvisa retry storms)

**Side Effects:**

- Finds entry by idempotencyKey across all labs
- Updates `/labs/{labId}/notivisa-outbox/{entryId}` → status = 'acknowledged'
- Records anvisa_eventId, anvisa_acknowledgedAt, receiptNumber, rejectionCode (if error)
- Appends webhook log entry (immutable)
- Logs to Cloud Logging

**Error Handling:**

- Missing signature → 401 Unauthorized (Anvisa sees it and retries)
- Payload validation fails → 200 OK (acknowledge to prevent retry)
- Entry not found → 200 OK (acknowledge; edge case)

**Signature Verification:**

```
HMAC-SHA256(JSON.stringify(payload), ANVISA_WEBHOOK_SECRET)
Header: x-anvisa-signature (hex-encoded)
Constant-time comparison required (prevent timing attacks)
```

---

### 8. `listNotivisaOutbox` (Phase 4+)

**Purpose:** Query NOTIVISA queue entries with filtering + pagination.

**Region:** `southamerica-east1`

**Authorization:** ✓ RT or Admin role

**Input Schema:**

```typescript
{
  labId: string;
  status?: 'pending' | 'submitted' | 'acknowledged' | 'failed-permanent' | 'deleted';
  limit: number;                    // Max 100 (default 50)
  cursor?: string;                  // Pagination cursor
  sortBy?: 'createdAt' | 'deadline' | 'status'; // Default 'createdAt'
  order?: 'asc' | 'desc';
}
```

**Output (Success):**

```typescript
{
  ok: true;
  entries: Array<{
    id: string;
    diseaseCode: string;
    patientAnon: string;
    resultValue: string;
    status: string;
    createdAt: number;
    notificationDeadline: number;
    escalatedToSupervisor: boolean;
    submissionAttempts: number;     // Count (not full history)
  }>;
  total: number;
  cursor?: string;                  // For next page
}
```

**Output (Error):**

```typescript
{
  ok: false;
  code: 'UNAUTHORIZED' | 'LAB_NOT_FOUND' | 'INTERNAL_ERROR';
  message: string;
}
```

**Side Effects:** None (read-only).

**Composite Index Required:**

```
/labs/{labId}/notivisa-outbox
- fields: [status ASC, createdAt DESC]
- fields: [status ASC, notificationDeadline ASC]
```

---

## Firestore Data Model

### Collection: `/notivisa-drafts/{labId}/drafts/{draftId}`

**Purpose:** NOTIVISA form drafts awaiting RT approval.

**Schema:**

```typescript
{
  // Identifiers
  id: string;                       // Firestore doc ID
  labId: string;                    // Tenant ID (redundant)
  laudoId: string;                  // Reference to result

  // Form payload (Art. 6º §1)
  payload: {
    versao: string;                 // "1.0"
    laudo_id: string;
    paciente_cpf: string;           // Masked CPF (required)
    data_resultado: number;         // Unix timestamp
    resultados: Array<{
      analito: string;
      valor: number;
      unidade: string;
      referencia: string;
    }>;
    assinador: {
      cpf: string;
      nome: string;
      data_assinatura: number;
    };
  };

  // Approval workflow
  status: 'draft' | 'approved' | 'submitted' | 'rejected' | 'deleted';

  // Context (from crítico detector if applicable)
  criticoContext?: {
    detectadoEm: number;
    analito: string;
    valor: number;
    severidade: 'alta' | 'baixa';
  };

  // Audit
  pacienteCpf: string;              // Indexed for fast lookup
  criadoEm: Timestamp;
  deletadoEm: null;                 // RN-06 pattern (null until soft-deleted)
}
```

**Indexes:**

```yaml
- collection: /notivisa-drafts/{labId}/drafts
  fields:
    - field: status
      direction: ASCENDING
    - field: criadoEm
      direction: DESCENDING
```

**Subcollection: `auditLog/{logId}`**

```typescript
{
  action: 'CREATED' | 'APPROVED' | 'SUBMITTED' | 'REJECTED';
  operatorId: string;               // request.auth.uid
  ts: number;                       // Unix timestamp
  details: {
    source?: 'critico_detector' | 'manual_ui';
    laudoId?: string;
    criticoAnalito?: string;
    signature?: {
      hash: string;
      chainHash: string;
    };
  };
}
```

---

### Collection: `/labs/{labId}/notivisa-outbox/{entryId}`

**Purpose:** Async submission queue (append-only outbox pattern).

**Schema:**

```typescript
{
  // Identifiers
  id: string;
  labId: string;
  laudoId: string;                  // Reference to result

  // Disease & patient
  diseaseCode: string;              // MS Portaria code (e.g., '99078' = syphilis)
  diseaseName: string;
  patientData: {
    name_anon: string;              // Anonymized (e.g., "Paciente 1234")
    dateOfBirth: Timestamp;
    gender: 'M' | 'F' | 'outro';
  };

  // Result
  resultValue: string;              // "positivo", "negativo", "reagente", etc.
  resultDate: Timestamp;
  testMethod?: string;

  // SLA
  notificationDeadline: Timestamp;  // resultDate + 24h (RDC 978 Art. 66)

  // State machine
  status: 'pending' | 'submitted' | 'acknowledged' | 'failed-permanent' | 'deleted';

  // Submission attempts (append-only log)
  submissionAttempts: Array<{
    attempt: number;                // 1, 2, 3, ... (max 5)
    ts: Timestamp;                  // When attempt made
    method: 'mock-submit' | 'soap-anvisa' | 'rest-anvisa';
    status: 'sent' | 'mocked' | 'failed' | 'success';
    error?: {
      errorCode?: string;           // HTTP code or exception name
      errorMessage?: string;
      isRetryable: boolean;         // true if 5xx/timeout, false if 4xx
    };
    receiptCode?: string;           // From Anvisa (on success)
    roundTripMs?: number;           // API latency
  }>;

  // Anvisa integration (Phase 12+)
  receiptCodeFromAnvisa?: string;   // Primary receipt code
  anvisa_eventId?: string;          // Anvisa event ID
  idempotencyKey?: string;          // SHA-256(labId:diseaseCode:patientId:resultDate)

  // Escalation (if past deadline or permanent failure)
  escalatedToSupervisor?: boolean;
  escalationTs?: Timestamp;
  escalationMotivo?: 'deadline-passed' | 'permanent-failure' | 'max-retries-exceeded';
  supervisorId?: string;

  // Soft delete (RN-06)
  status: 'deleted';                // If deleted
  deletedAt?: Timestamp;
  deletedBy?: string;
  deletionReason?: 'duplicate' | 'incorrect-patient' | 'false-positive' | 'test-entry' | 'other';
  deletionNotes?: string;

  // Audit
  criadoEm: Timestamp;
  criadoPor: string;                // operatorId or 'system'
}
```

**Indexes:**

```yaml
- collection: /labs/{labId}/notivisa-outbox
  fields:
    - field: status
      direction: ASCENDING
    - field: notificationDeadline
      direction: ASCENDING

- collection: /labs/{labId}/notivisa-outbox
  fields:
    - field: status
      direction: ASCENDING
    - field: criadoEm
      direction: DESCENDING

- collection: /labs/{labId}/notivisa-outbox
  fields:
    - field: idempotencyKey
      direction: ASCENDING
```

**Subcollection: `auditLog/{logId}` (Append-Only)**

```typescript
{
  action: 'CREATED' | 'SUBMISSION_ATTEMPT' | 'SOFT_DELETED' | 'ESCALATION';
  operatorId: string;
  ts: Timestamp;
  details: {
    // For SUBMISSION_ATTEMPT:
    attempt: number;
    status: 'success' | 'failed';
    errorCode?: string;
    isRetryable?: boolean;

    // For SOFT_DELETED:
    reason: string;
    notes?: string;
    previousStatus: string;

    // For ESCALATION:
    motivo: string;
    deadline: Timestamp;
  };
}
```

---

### Collection: `/labs/{labId}/notivisa-outbox/_archives/exports/{archiveId}`

**Purpose:** Immutable audit archives (retained 90 days).

**Schema:**

```typescript
{
  // Archive metadata
  id: string;
  labId: string;
  exportedBy: string; // operatorId (AUDITOR)
  exportedAt: Timestamp;
  expiresAt: Timestamp; // Auto-delete after 90 days

  // Export parameters
  daysBack: number;
  recordCount: number;
  formats: Array<'csv' | 'json'>;
  csvSize: number;
  jsonSize: number;
  status: 'ready'; // Only value; immutable
}
```

**Subcollection: `files/{fileName}` (CSV / JSON Contents)**

```typescript
{
  content: string; // Full CSV or JSON (if <1MB)
  mimeType: 'text/csv' | 'application/json';
  size: number;
}
```

**Subcollection: `auditLog/{logId}` (Append-Only)**

```typescript
{
  action: 'CREATED';
  operatorId: string;
  ts: Timestamp;
  details: {
    recordCount: number;
    formats: Array<string>;
    daysBack: number;
  }
}
```

---

## Queue Processing Strategy

### Scheduled Processor: `notivisaQueueProcessor`

**Execution:** Every 5 minutes (Cloud Scheduler)

**Region:** `southamerica-east1`

**Timeout:** 9 minutes (540 seconds)

**Concurrency:** `maxInstances: 1` (serialize to prevent race conditions)

### Algorithm

#### Step 1: Enumerate Pending Entries

```
FOR EACH lab IN collection('labs'):
  pendingEntries = QUERY {
    collection: /labs/{labId}/notivisa-outbox,
    where: [
      ('status', '==', 'pending'),
      ('notificationDeadline', '<=', now())
    ],
    limit: 100  // Per-lab limit to avoid timeout
  }
```

#### Step 2: Evaluate Retry Eligibility

For each pending entry:

```
attemptCount = entry.submissionAttempts.length

IF attemptCount >= 5:
  → Update status → 'failed-permanent'
  → Escalate supervisor
  → Continue (skip to next entry)

IF attemptCount > 0:
  lastAttempt = entry.submissionAttempts[attemptCount - 1]
  nextRetryTime = backoffSchedule[attemptCount] (see below)

  IF now < lastAttempt.ts + nextRetryTime:
    → Continue (not yet time)
```

#### Step 3: Exponential Backoff Schedule

| Attempt | Backoff Interval  | Next Window |
| ------- | ----------------- | ----------- |
| 1       | 0 min (immediate) | T+0         |
| 2       | 1 min             | T+1         |
| 3       | 5 min             | T+6         |
| 4       | 15 min            | T+21        |
| 5       | 45 min            | T+66        |

After attempt 5 fails: status → 'failed-permanent', escalate.

#### Step 4: Attempt Submission

```
result = submitNotivisaToAnvisa(labId, entry)

IF result.success:
  → Append submissionAttempt {
      attempt: attemptCount + 1,
      ts: now(),
      method: 'mock-submit' (Phase 4) | 'soap-anvisa' (Phase 12+),
      status: 'success',
      receiptCode: result.receiptCode,
      roundTripMs: result.roundTripMs
    }
  → Update status → 'submitted'
  → Record receiptCodeFromAnvisa
  → Log success

ELSE:
  isRetryable = result.isRetryable ?? true

  IF isRetryable AND attemptCount < 4:
    → Append submissionAttempt { status: 'failed', error: {...} }
    → Status remains 'pending' (retry on next cycle)
    → Log retryable failure

  ELSE:
    → Append submissionAttempt { status: 'failed', error: {...} }
    → Update status → 'failed-permanent'
    → Escalate supervisor (SMS + email alert)
    → Log permanent failure
```

#### Step 5: Deadline Escalations

After processing retries:

```
pastDeadlineEntries = QUERY {
  collection: /labs/{labId}/notivisa-outbox,
  where: [
    ('status', 'in', ['pending', 'submitted']),
    ('notificationDeadline', '<', now()),
    ('escalatedToSupervisor', '==', false)
  ],
  limit: 50
}

FOR EACH entry IN pastDeadlineEntries:
  → Update escalatedToSupervisor = true
  → Update escalationMotivo = 'deadline-passed'
  → Notify supervisor (SMS + email)
```

---

## Error Handling & Retry Logic

### Classification: Retryable vs. Non-Retryable

#### Retryable Errors (5xx, Timeout, Network)

```
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable
- 504 Gateway Timeout
- ECONNREFUSED (network unreachable)
- ETIMEDOUT (socket timeout >30s)
- ENOTFOUND (DNS failure, temp)
```

**Action:** Append attempt record, keep status='pending', retry on next cycle (exponential backoff).

#### Non-Retryable Errors (4xx, Auth, Validation)

```
- 400 Bad Request (malformed payload)
- 401 Unauthorized (certificate expired)
- 403 Forbidden (insufficient permissions)
- 404 Not Found (endpoint changed)
- 422 Unprocessable Entity (validation failure)
- 429 Too Many Requests (rate limit; treat as retryable with longer backoff)
```

**Action:** Append attempt record, update status='failed-permanent', escalate supervisor immediately.

### Escalation to Supervisor

**Trigger 1: Permanent Failure**

```
IF status = 'failed-permanent':
  → Send SMS alert (Twilio integration, Phase 8+)
  → Send email alert (SendGrid integration, Phase 8+)
  → Log entry in Cloud Logging
  → Mark escalatedToSupervisor = true
  → Supervisor sees dashboard alert (red banner)
```

**Alert Content:**

```
[NOTIVISA] ESCALATION REQUIRED

Lab: {labName}
Entry: {entryId}
Disease: {diseaseName} ({diseaseCode})
Patient: {patientAnon}
Result Date: {resultDate}
Deadline: {notificationDeadline}

Issue: {escalationMotivo}
Last Error: {lastError}
Attempts: {attemptCount}/5

Action: RT/Admin must review and manually submit or contact support.
```

**Trigger 2: Past-Deadline Escalation**

```
IF notificationDeadline < now AND status IN ['pending', 'submitted']:
  AND escalatedToSupervisor = false:
  → Same alert as Trigger 1
  → Escalation motivo: 'deadline-passed'
```

### Recovery Actions

#### For Permanent Failure (Validation Error)

**Supervisor Steps:**

1. Review entry details (payload, error message)
2. Identify issue (e.g., malformed CPF, missing field)
3. Contact RT: "Fix payload and resubmit"
4. Update entry payload (if operator corrects via UI)
5. Call `notivisaSoftDelete` → create new draft with corrected data
6. Re-submit new draft

#### For Transient Failure (Network Down)

**Automatic Recovery:**

- Processor retries with exponential backoff
- No manual intervention needed
- If still pending after 24h: escalate supervisor (past deadline)

#### For Certificate Expiration (401 Auth)

**Supervisor Steps (Phase 12+):**

1. Receive alert: "Unauthorized (cert expired)"
2. Contact Security/Ops: "Renew Anvisa certificate"
3. New certificate provisioned, uploaded to Secret Manager
4. Restart Cloud Function (secret update triggers redeploy)
5. Processor resumes submissions on next cycle (automatic)
6. Backoff counter resets (treats as new submission)

---

## Security Considerations

### 1. Authentication & Authorization

#### Client-Side (Web)

```
User logs in → Firebase Auth → ID token (request.auth)

For callable functions:
  Functions SDK verifies ID token
  request.auth.uid = user's UID
  request.auth.token.role = custom claim (RT, AUDITOR, admin, etc.)
```

#### Cloud Functions Verification

```typescript
// Every callable validates:
if (!request.auth) {
  throw new HttpsError('unauthenticated', 'User must be authenticated');
}

// Role-based checks:
const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(uid).get();

const role = memberDoc.data()?.role;

if (role !== 'RT' && role !== 'AUDITOR') {
  throw new HttpsError('permission-denied', `Role ${role} not allowed`);
}
```

#### Multi-Tenant Isolation

```
labId from request must match labId from callable input.
Functions validate: operatorId === request.auth.uid
Data written always includes redundant labId field.
Firestore rules prevent cross-tenant reads (labId filter required).
```

### 2. Token Management

#### ID Token Lifecycle

```
Issued: Firebase Auth (at login)
Expiry: 1 hour
Refresh: Automatic (Firebase SDK handles)
Scope: User identity + custom claims (role, labId)
```

#### Custom Claims (Role-Based Access)

```typescript
// Admin sets custom claims (one-time setup per user)
await admin.auth().setCustomUserClaims(uid, {
  role: 'RT', // RT, AUDITOR, admin, owner, etc.
  labIds: ['lab-1'], // Which labs user can access
});

// Callable checks claims
const role = request.auth.token.role;
const allowedLabs = request.auth.token.labIds || [];

if (!allowedLabs.includes(labId)) {
  throw new HttpsError('permission-denied', 'User not authorized for this lab');
}
```

### 3. Rate Limiting

#### Firestore Write Limits (Multi-Tenant)

```
Per lab: max 50 NOTIVISA submissions per hour
Enforcement: Cloud Function checks submission count in past hour

before submitNotivisa():
  recent = QUERY {
    /labs/{labId}/notivisa-outbox,
    where: ['criadoEm', '>', now() - 1h],
    select: ['id']
  }

  IF recent.length >= 50:
    throw HttpsError('resource-exhausted', 'Rate limit exceeded')
```

#### Scheduled Processor Rate Limiting

```
Per processor cycle (5 min):
  - Max 100 entries processed per lab
  - Max 10 submission attempts per cycle globally
  - Backoff prevents hammering Anvisa (1m → 5m → 15m → ...)
```

### 4. Signature Verification (Webhooks & Approvals)

#### HMAC-SHA256 Signing

```typescript
// Client: sign approval with operator CPF + timestamp
const message = JSON.stringify({ draftId, operatorId, ts });
const signature = crypto.createHmac('sha256', HCQ_SIGNATURE_HMAC_KEY).update(message).digest('hex');

// Server: verify signature
function verifySignature(message: string, signature: string): boolean {
  const computed = crypto
    .createHmac('sha256', HCQ_SIGNATURE_HMAC_KEY)
    .update(message)
    .digest('hex');

  // Constant-time comparison (prevent timing attacks)
  return computed.length === signature.length && computed === signature;
}
```

#### Anvisa Webhook Signature (Phase 12+)

```typescript
// Anvisa includes header: x-anvisa-signature
// Value: HMAC-SHA256(JSON.stringify(body), ANVISA_WEBHOOK_SECRET)

const signature = req.headers['x-anvisa-signature'];
const payload = JSON.stringify(req.body);
const computed = crypto.createHmac('sha256', ANVISA_WEBHOOK_SECRET).update(payload).digest('hex');

if (!secureCompare(computed, signature)) {
  res.status(401).json({ error: 'Unauthorized' });
  return;
}
```

### 5. Secret Management (Phase 12+)

#### Cloud Secret Manager

```
ANVISA_CERTIFICATE_PATH        — Path to .pfx certificate
ANVISA_CERTIFICATE_PASSWORD    — Certificate password
ANVISA_WEBHOOK_SECRET          — Webhook verification secret
HCQ_SIGNATURE_HMAC_KEY         — Approval signature key
TWILIO_API_KEY                 — SMS alerts (supervisor notifications)
```

#### Access Control

```
Only Cloud Functions (service account) can read secrets.
Web client cannot access secrets (all signing server-side).
Rotation: Every 90 days (automated policy)
```

#### Secret Provisioning (Deployment Gate)

```bash
# Pre-flight check: verify all secrets are provisioned
$ bash scripts/preflight-secrets-check.sh

# Outputs:
# ✓ ANVISA_CERTIFICATE_PATH — SET
# ✓ ANVISA_WEBHOOK_SECRET — SET
# ✗ TWILIO_API_KEY — PENDING_SET
#   → Run: firebase functions:secrets:set TWILIO_API_KEY

# Deploy blocked until all secrets provisioned (ADR-0017 + ADR-0018)
```

---

## RDC 978 Art. 66 Compliance

### Regulatory Requirement

**RDC 978 Art. 66:** Laboratórios devem notificar ao Ministério da Saúde (ANVISA/NOTIVISA) qualquer resultado positivo para doenças notificáveis dentro de **24 horas** da aprovação do resultado.

**99 Doenças Notificáveis** (Portaria 204/2016 MS):

- Sífilis (adquirida, gestacional, congênita)
- HIV
- Tuberculose
- Hepatite B, C
- Dengue (em gestante)
- Febre amarela
- Rubéola (em gestante)
- - 91 others

### HC Quality Compliance Evidence

#### Phase 4 (Sandbox Form Generation)

**Evidence 1: Form Generation**

```
✓ notivisaDraftCreate callable generates NOTIVISA Art. 6º §1 payload
✓ Zod validation ensures 15 mandatory fields present
✓ Draft stored immutably in Firestore (/notivisa-drafts/{labId}/drafts)
✓ Audit log entry created (CREATED action, operatorId, timestamp)
```

**Evidence 2: RT Approval Process**

```
✓ RT reviews draft in UI (read-only view of payload)
✓ RT clicks "Approve" → approveNotivisaDraft() callable
✓ Signature verification ensures RT identity (HMAC-SHA256)
✓ Audit log entry created (APPROVED action, chainHash per ADR-0012)
✓ Status transitions: draft → approved (immutable)
```

**Evidence 3: 24h Deadline Tracking**

```
✓ notificationDeadline = resultDate + 24h (set in submitNotivisa)
✓ Scheduled processor queries entries with deadline ≤ now()
✓ Past-deadline escalations alert supervisor (SMS + email)
✓ Audit log documents deadline (field: notificationDeadline)
```

**Evidence 4: Export for Auditor**

```
✓ notivisaExportArchive callable (AUDITOR role only)
✓ Generates immutable CSV + JSON archive
✓ Includes: diseaseCode, patientAnon, resultDate, status, attempts
✓ Archive retained 90 days (compliance period)
✓ Audit log tracks who exported when (exportedBy, exportedAt)
```

#### Phase 12+ (Production API Submission)

**Evidence 5: Real API Integration**

```
✓ Scheduled processor calls real Anvisa SOAP API (Phase 12+)
✓ Payload signed with lab certificate (X.509 client auth)
✓ Receipt code returned by Anvisa recorded (receiptCodeFromAnvisa)
✓ Submission attempt logged (method: 'soap-anvisa', receiptCode)
```

**Evidence 6: Idempotent Retries**

```
✓ idempotencyKey = SHA-256(labId:diseaseCode:patientId:resultDate)
✓ Anvisa API respects idempotency (no duplicates on retry)
✓ Deduplication prevents multiple notifications for same result
```

**Evidence 7: Webhook Acknowledgment**

```
✓ Anvisa sends webhook callback with eventId + receiptNumber
✓ Signature verified (HMAC-SHA256 over payload)
✓ Entry status → 'acknowledged' (final state)
✓ Webhook log entry appended (immutable, timestamps)
```

### Audit Trail (RDC 978 § 5.3 & DICQ 4.4)

**Complete Audit Trail Example:**

```
Entry: notivisa-outbox/lab-123/entry-abc123

auditLog:
[1] CREATED (2026-05-07T10:00:00Z)
    action: CREATED
    operatorId: critico-detector-system
    details:
      source: critico_detector
      criticoAnalito: HIV
      criticoSeveridade: alta

[2] APPROVED (2026-05-07T10:15:00Z)
    action: APPROVED
    operatorId: rt-maria-123
    details:
      signature: {hash: "abc...", chainHash: "def..."}

[3] SUBMISSION_ATTEMPT (2026-05-07T10:20:00Z)
    action: SUBMISSION_ATTEMPT
    attempt: 1
    status: success
    receiptCode: NV-2026-0507-12345

[4] ANVISA_WEBHOOK (2026-05-07T11:30:00Z)
    action: ANVISA_WEBHOOK
    anvisaEventId: evt-67890
    anvisaStatus: success
```

Every action immutable, timestamped, operator-tracked (operatorId = request.auth.uid).

---

## DICQ Compliance (Audit Trail & Operator Tracking)

### DICQ 4.3 — Record Integrity

**Requirement:** All records (regulatória or internal) must be immutable after creation. Amendments documented separately with full traceability.

**Implementation:**

1. **Append-Only Audit Log**

   ```
   Cannot update/delete auditLog entries.
   Firestore rules: allow create (with validSignature), deny update/delete.
   ```

2. **Soft Delete Only**

   ```
   NOTIVISA entries never hard-deleted.
   Soft delete appends auditLog entry with reason + timestamp.
   Original data preserved for audit (queryable via deletedAt filter).
   ```

3. **Immutable Archive**
   ```
   notivisaExportArchive creates immutable /archives/{archiveId}
   Archive cannot be updated or deleted (rules enforce).
   Retention: 90 days (then soft-delete in background job).
   ```

### DICQ 4.4 — Audit Trail Completeness

**Requirement:** Every action on regulated data must have:

- **Who** (operator ID / system)
- **When** (timestamp)
- **What** (action taken)
- **Why** (context / reason)
- **Result** (outcome)

**Mapping to NOTIVISA Operations:**

| Action              | Who                   | When           | What                          | Why                                      | Result                     |
| ------------------- | --------------------- | -------------- | ----------------------------- | ---------------------------------------- | -------------------------- |
| Draft creation      | operatorId / system   | ts (Timestamp) | status='draft'                | Source: critico_detector or manual_ui    | draftId + payload          |
| RT approval         | operatorId (RT)       | ts             | status='approved' + signature | Regulatory requirement (Art. 66)         | chainHash                  |
| Submit to queue     | operatorId (RT/admin) | ts             | status='pending'              | Move to async processing                 | entryId + deadline         |
| Submission attempt  | system                | ts             | submissionAttempt record      | Scheduled processor cycle                | success/failed + error     |
| Deadline escalation | system                | ts             | escalatedToSupervisor=true    | Past 24h deadline                        | SMS + email alert          |
| Soft delete         | operatorId (admin)    | ts             | status='deleted'              | reason (duplicate, false-positive, etc.) | deletedAt + deletionReason |

### DICQ 4.1.2 — Operator Tracking

**Requirement:** Every operation must identify the operator (user or system).

**Implementation:**

```typescript
// All callable functions capture operatorId
const operatorId = request.auth.uid;

// System-triggered operations use 'system' identifier
const operatorId = 'system'; // for scheduled processor

// Audit log always includes operatorId
await entryDoc.ref.collection('auditLog').doc(docId).set({
  action: 'APPROVED',
  operatorId: request.auth.uid,  // ← always present
  ts: Date.now(),
  details: { ... }
});

// Firestore rules validate operatorId matches request.auth.uid (for user actions)
match /notivisa-drafts/{labId}/drafts/{draftId} {
  match /auditLog/{logId} {
    allow create: if
      (request.resource.data.operatorId == request.auth.uid) ||
      (request.resource.data.operatorId == 'system');
  }
}
```

---

## Deployment Checklist

### Pre-Deployment (Phase 4 — Sandbox)

- [ ] **Firestore Rules Deployed**
  - [ ] `/notivisa-drafts/{labId}/drafts` rules + indexes
  - [ ] `/notivisa-outbox/{labId}/entries` rules + indexes
  - [ ] Audit log subcollections (append-only)
  - Test: `firebase emulators:exec "npm test notivisa.test.ts"`

- [ ] **Cloud Functions Built & Tested**
  - [ ] `notivisaDraftCreate` compiled, unit tests pass (100%)
  - [ ] `getNotivisaDraft` compiled, unit tests pass
  - [ ] `approveNotivisaDraft` compiled, unit tests pass, signature validation ✓
  - [ ] `submitNotivisa` compiled, unit tests pass
  - [ ] `notivisaExportArchive` compiled, unit tests pass, auditor-only enforced
  - [ ] `notivisaSoftDelete` compiled, unit tests pass
  - [ ] `notivisaQueueProcessor` compiled, mock submitter tested
  - [ ] `listNotivisaOutbox` compiled, pagination tested
  - Run: `npm test functions/src/modules/notivisa/**/*.test.ts`

- [ ] **E2E Tests Passing**
  - [ ] Draft creation from laudo (happy path + error cases)
  - [ ] RT approval + signature verification
  - [ ] Submit to queue, queue entry created with deadline
  - [ ] Scheduled processor runs, mock submission succeeds
  - [ ] Past-deadline escalation (entry past 24h, escalatedToSupervisor=true)
  - [ ] Auditor export (CSV + JSON created, 90-day retention)
  - [ ] Soft delete (reason recorded, audit trail preserved)
  - Run: `npm run test:e2e -- notivisa`

- [ ] **Type Checking Clean**
  - [ ] `npx tsc --noEmit` (no errors)
  - [ ] No unused variables or imports

- [ ] **Lint Clean**
  - [ ] `npm run lint` (baseline 88 warnings pre-existing, no regressions)

- [ ] **Secret Check (Deployment Gate)**
  - [ ] `bash scripts/preflight-secrets-check.sh`
  - [ ] Phase 4: HCQ_SIGNATURE_HMAC_KEY provisioned ✓
  - [ ] Phase 4: TWILIO_API_KEY provisioned (for supervisor alerts) ✓

- [ ] **Bundle Size Check**
  - [ ] Functions bundle <50MB (Cloud Functions gen 2 limit)
  - [ ] No new 3rd-party deps >10KB gzip

- [ ] **Documentation Complete**
  - [ ] This architecture doc (NOTIVISA_INTEGRATION_ARCHITECTURE.md)
  - [ ] Supervisor runbook (NOTIVISA_SUPERVISOR_RUNBOOK.md)
  - [ ] Deployment notes in PR description

### Deployment (Phase 4 — Sandbox)

```bash
# 1. Type check
npx tsc --noEmit

# 2. Build
npm run build

# 3. Pre-flight secrets check
bash scripts/preflight-secrets-check.sh

# 4. Deploy Firestore rules
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# 5. Deploy Cloud Functions (notivisa module)
firebase deploy --only functions:notivisaDraftCreate,\
  functions:getNotivisaDraft,\
  functions:approveNotivisaDraft,\
  functions:submitNotivisa,\
  functions:notivisaExportArchive,\
  functions:notivisaSoftDelete,\
  functions:notivisaQueueProcessor,\
  functions:listNotivisaOutbox \
  --project hmatologia2

# 6. Deploy hosting (web UI updates)
firebase deploy --only hosting --project hmatologia2

# 7. Post-deployment smoke test
npm run test:smoke -- notivisa
```

### Post-Deployment Validation (Phase 4)

- [ ] **Web UI Tests (Manual)**
  - [ ] Create draft from a positive laudo → draft appears in "NOTIVISA Drafts" tab
  - [ ] RT views draft → payload displayed correctly
  - [ ] RT clicks "Approve" → signature dialog appears
  - [ ] RT approves → draft status changes to "approved"
  - [ ] RT clicks "Submit" → entry moves to "Submitted Queue"
  - [ ] Wait 5 min → scheduled processor runs, status → "acknowledged"
  - [ ] Auditor clicks "Export Archive" → CSV + JSON downloaded
  - [ ] Admin clicks "Delete" on entry → status → "deleted", audit trail visible

- [ ] **Cloud Logs Check (24 hours)**
  - [ ] `bash scripts/monitor-cloud-logs.sh 24 30` (run after deploy)
  - [ ] Check for errors: `severity="ERROR"` or `severity="WARNING"`
  - [ ] Expected: ~0 errors, <5 warnings (startup logs)
  - [ ] No rate limit errors (functions not throttled)
  - [ ] No secret provisioning errors

- [ ] **Firestore Console Check**
  - [ ] `/notivisa-drafts/{labId}/drafts` collections exist
  - [ ] `/labs/{labId}/notivisa-outbox` collections exist
  - [ ] Sample docs visible, structure matches schema

- [ ] **Rules Validation**
  - [ ] Non-member cannot read drafts (403 Forbidden)
  - [ ] Admin can read/create, RT can read, others denied
  - [ ] Rules enforce labId match (cross-tenant prevention)
  - [ ] Hard delete rules deny (allow delete: if false)

---

## Appendix: API Client Example (React Hook)

### Usage in Web Component

```typescript
import { useNotivisaCallables } from '@/hooks/useNotivisaCallables';
import { useAuthStore } from '@/stores/authStore';

export function NotivisaDraftForm({ laudoId }: { laudoId: string }) {
  const { labId } = useAuthStore();
  const { createDraft, approveDraft, submitDraft } = useNotivisaCallables();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateDraft = async () => {
    setLoading(true);
    try {
      const result = await createDraft({
        labId,
        laudoId,
        criticoContext: undefined,
      });
      if (result.ok) {
        setDraft(result);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDraft = async (signature: any) => {
    setLoading(true);
    try {
      const result = await approveDraft({
        labId,
        draftId: draft.draftId,
        signature,
      });
      if (result.ok) {
        setDraft(prev => ({ ...prev, status: 'approved' }));
      } else {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* UI rendering draft + buttons */}
    </div>
  );
}
```

---

## References

- **ADR-0014:** NOTIVISA Integration via Sandbox → Production Pathway
- **ADR-0021:** NOTIVISA Queue & Retry Pattern
- **ADR-0026:** NOTIVISA Queue Processing: Async Append-Only Outbox Pattern
- **ADR-0012:** RDC 978 Audit Trail Logical Signature (chainHash)
- **RDC 978 Art. 66:** Notificação de Eventos Adversos (statutory requirement)
- **Portaria 204/2016 MS:** 99 Doenças Notificáveis
- **DICQ 4.3–4.4:** Record Integrity & Audit Trail Requirements
- **Anvisa NOTIVISA Documentation:** https://notivisa.saude.gov.br/ (gov endpoint, Phase 12+)

---

**Document Status:** Final  
**Next Review:** Phase 12 Kickoff (Aug 1, 2026)  
**Owner:** CTO / Engineering Team  
**Distribution:** Engineering, Regulatory Affairs, QA, Auditors
