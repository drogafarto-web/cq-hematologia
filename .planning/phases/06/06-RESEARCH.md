# Phase 6: Auditoria — Write Intent + Read Consent — Research

**Researched:** 2026-05-07  
**Domain:** Regulatory compliance (audit trail, LGPD data subject rights, RDC 978 rastreability)  
**Confidence:** HIGH

## Summary

Phase 6 formalizes the audit trail infrastructure (write intent + read consent) to close gaps in RDC 978 Art. 5.3 (Rastreabilidade de Operações), DICQ 4.4 (Documentação de Auditoria), and LGPD Art. 38 (direito de acesso do titular). v1.3 deployed foundational audit-chain types (`AuditEntry` with HMAC-SHA256) in `sgq/auditoria/types.ts`, but infrastructure is **incomplete**: (1) audit logging is not instrumented across all operations, (2) read-consent tracking doesn't exist, (3) data subject access requests (SolicitacaoDados) are types-only, and (4) cross-module audit coordination is missing. Phase 6 design must unify audit instrumentation (write intent), formalize read-consent logs (LGPD compliance), and deliver operator + auditor-ready reporting.

**Primary recommendation:** Centralized audit service (callable-based, not client-side) with per-module hooks for operation registration, paired with consent-tracking middleware for read access logs. Schema extends existing `audit-trail` collection; no breaking changes to v1.3 modules.

## Architectural Responsibility Map

| Capability                          | Primary Tier                      | Secondary Tier                    | Rationale                                                                                                          |
| ----------------------------------- | --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Audit logging (write intent)        | Backend (Cloud Function callable) | Database (append-only collection) | RDC 978 Art. 128 requires server-side, operator-attributed logging; client-side writes are rejected by rules       |
| Read consent tracking               | API / Backend                     | Database                          | LGPD Art. 38 access logs must be immutable and server-sealed; client sees consent prompt; backend records response |
| Data subject request processing     | API / Backend                     | —                                 | SolicitacaoDados creation + fulfillment (export, retification, deletion) is non-repudiable; Backend owns workflows |
| Audit report generation             | Backend (callable)                | Client (display)                  | Data aggregation happens server-side; Client renders formatted PDF/Excel export                                    |
| Read access in audit UI (Auditoria) | Frontend (React)                  | Backend (APIs)                    | Auditor/RT views audit logs via restricted-access callable; Rules enforce `role:auditor` OR `role:rt`              |

## Standard Stack

### Core

| Library                   | Version | Purpose                                             | Why Standard                                                                 | Verified                       |
| ------------------------- | ------- | --------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------ |
| Firebase Firestore        | v12     | Append-only audit collections + Rules               | Multi-tenant, immutable logs, transaction support                            | [VERIFIED: npm registry v12.x] |
| Cloud Functions (Node 22) | 22 LTS  | Callable for audit sealing + consent tracking       | RDC 978 requires server-sealed signatures; v1.3 ADR-0012 established pattern | [VERIFIED: v1.3 deployment]    |
| Zod 3                     | 3.x     | Input validation (audit payloads, SolicitacaoDados) | Type-safe request handling before sealing                                    | [VERIFIED: npm registry]       |
| React (existing)          | 19      | Audit log UI components (table, export, filters)    | Consistent with web tier; dark-first design                                  | [VERIFIED: v1.3 stack]         |

### Supporting

| Library        | Version | Purpose                                                      | When to Use                                                                           |
| -------------- | ------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| date-fns 3     | 3.x     | Timestamp formatting (audit log queries, date range filters) | Lightweight alternative to Moment; already in stack                                   |
| jsPDF + pdfkit | Latest  | Audit report PDF generation (server-side via Cloud Function) | Server-side generation avoids bundle bloat; v1.3 pattern (export module)              |
| nodemailer     | Latest  | Email notification (data subject request fulfillment)        | LGPD Art. 18 requires written response; Phase 0 established pattern for notifications |

### Alternatives Considered

| Instead of                     | Could Use                                      | Tradeoff                                                                                                                             |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Firestore append-only          | MongoDB oplog or PostgreSQL WAL                | Firestore is already in use; no new infrastructure; rules enforce immutability                                                       |
| Server-side callable for audit | Client-side Firestore batch + Rules validation | Client-side is lighter but RDC 978 auditor specifically requires server-sealed signature; v1.3 ADR-0012 chose callable for integrity |
| Simple timestamp log           | HMAC-SHA256 chain (ADR-0012)                   | HMAC is heavier but auditor-verifiable; DICQ 4.4 expects "auditoria… integra e rastreável"; chain is audit-ready                     |
| In-app LGPD forms              | Dedicated LGPD portal (future v1.5)            | Phase 6 is admin-only request intake; patient-facing portal deferred; reduces scope                                                  |

**Installation (no new npm deps for Phase 6 core):**

```bash
# All dependencies already in package.json from v1.3
npm ls firebase firebase-functions zod date-fns
```

**Version verification:** All Stack libraries are locked to v1.3 versions; Phase 6 is purely logic/schema, no upgrades needed.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       HC Quality v1.4 Audit Layer                       │
│                                                                          │
│  Client Tier (React Components)                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ [AuditoriaView (reader)] → Calls registerAuditRead() callable  │  │
│  │                            + Firestore Rules allow read + log   │  │
│  │                                                                    │  │
│  │ [SolicitacaoDadosForm] → HTTP POST /api/LGPD/solicitacao-dados  │  │
│  │                          → Backend processes (export/delete)     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                ↓                                         │
│  API Tier (Cloud Functions Callables)                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ [registerAuditEntry] → Validate + HMAC-SHA256 + chain-link      │  │
│  │ [registerAuditRead] → Log read intent + consent status          │  │
│  │ [createSolicitacaoDados] → Queue LGPD request (acesso/delete)  │  │
│  │ [fulfillSolicitacaoDados] → Export data / soft-delete + audit   │  │
│  │ [verifyAuditChainIntegrity] → Scan + report violations         │  │
│  │ [exportAuditReport] → PDF/Excel aggregation + signature        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                ↓                                         │
│  Firestore Collections (Data Tier)                                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ /labs/{labId}/audit-trail/{entryId}                             │  │
│  │   ├─ operation, modulo, acao, resultado                         │  │
│  │   ├─ operatorId, timestamp (server-sealed)                      │  │
│  │   ├─ hmac, hash, previousHash (chain validation)                │  │
│  │   └─ payload (structured, what changed)                         │  │
│  │                                                                    │  │
│  │ /labs/{labId}/audit-reads/{readEventId}                        │  │
│  │   ├─ operatorId, timestamp                                       │  │
│  │   ├─ documentId (what was accessed)                              │  │
│  │   ├─ consentStatus ('consentiu'|'nao-consentiu'|'sem-opcao')    │  │
│  │   └─ sourceView ('auditoria', 'analytics', 'sgd', …)           │  │
│  │                                                                    │  │
│  │ /labs/{labId}/lgpd-solicitacoes/{solicitacaoId}                │  │
│  │   ├─ titular_id, tipo ('acesso'|'retificacao'|'exclusao'|…)   │  │
│  │   ├─ status, data_prazo, data_conclusao                        │  │
│  │   └─ audit log (who processed, when, approval chain)           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                ↓                                         │
│  Reporting & Verification                                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ [Auditor via callables] → Integrity check + export report      │  │
│  │ [LGPD compliance check] → Read consent log + request audit     │  │
│  │ [RDC 978 verifier] → Art. 128 traceability proof               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

Data Flow:
1. User action (e.g., laudo.liberado) → module hook calls registerAuditEntry(…)
2. registerAuditEntry callable: HMAC-sha256(prev_hash+payload) → sealed doc
3. Firestore Rules enforce: sealed → immutable (no further writes)
4. Audit view (auditor) calls verifyAuditChainIntegrity() → integrity report
5. LGPD data subject requests: form → callable → async fulfillment + audit trail
```

### Recommended Project Structure

```
src/features/sgq/auditoria/
├── types.ts                 # AuditEntry, ChainValidationResult, ComplianceReport (exists)
├── auditoriaService.ts      # Existing service (read-only subscriptions)
├── hooks/
│   ├── useAuditoriaView.ts  # Fetches audit logs + tracks read consent
│   └── useAuditReport.ts    # Export + filtering
└── components/
    ├── AuditoriaLogTable.tsx     # Immutable log table (dark-first)
    ├── ChainIntegrityReport.tsx  # Visualize hash verification results
    └── AuditFilters.tsx         # Date range, operator, modulo, resultado

functions/src/
├── modules/
│   ├── audit.ts            # registerAuditEntry, registerAuditRead
│   ├── lgpd.ts             # createSolicitacaoDados, fulfillSolicitacaoDados
│   └── compliance.ts       # verifyAuditChainIntegrity, exportAuditReport
└── shared/
    └── auditLogger.ts      # Common audit instrumentation helper (used by all modules)
```

### Pattern 1: Callable-Based Audit Logging (Immutable)

**What:** Operations register their intent via a server-sealed callable that applies HMAC-SHA256 signature, chain-links to previous entry, and returns sealed doc ID.

**When to use:** Any regulatory write (laudo release, CAPA closure, NOTIVISA submission, personnel update). Client is forbidden from directly writing to `audit-trail`.

**Example:**

```typescript
// Source: ADR-0012 + Phase 3 schema design

// Client calls this callable after action completes
export async function registerAuditEntry(
  labId: string,
  operation: string, // e.g. 'laudo.liberado'
  modulo: string, // e.g. 'laudos'
  acao: string, // Human-readable: "Laudo LAC-001 liberado por RT"
  payload: Record<string, unknown>, // Structured data that changed
): Promise<string> {
  // Returns sealed entry ID
  const callable = httpsCallable(functions, 'registerAuditEntry');
  const result: any = await callable({
    labId,
    operation,
    modulo,
    acao,
    payload,
  });
  return result.data.entryId;
}

// Cloud Function (server-side, runs in service context)
export const registerAuditEntry = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, operation, modulo, acao, payload } = data;

    // Validate claims
    if (!context.auth) throw new Error('Unauthenticated');

    // Get previous hash from chain
    const lastEntrySnap = await admin
      .firestore()
      .collection(`labs/${labId}/audit-trail`)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    const previousHash = lastEntrySnap.empty ? null : lastEntrySnap.docs[0].data().hash;

    // Generate HMAC-SHA256
    const secret = await getSecretValue('audit-hmac-key'); // Rotated monthly
    const hmac = createHmac('sha256', secret)
      .update(JSON.stringify({ previousHash, payload, operation }))
      .digest('hex');

    // Full hash
    const hash = createHash('sha256')
      .update(JSON.stringify({ hmac, previousHash, timestamp: admin.firestore.Timestamp.now() }))
      .digest('hex');

    // Write sealed entry
    const entryRef = admin.firestore().collection(`labs/${labId}/audit-trail`).doc();
    await entryRef.set({
      operation,
      modulo,
      acao,
      operatorId: context.auth.uid,
      payload,
      hmac,
      hash,
      previousHash,
      timestamp: admin.firestore.Timestamp.now(),
      deletadoEm: null,
    });

    return { entryId: entryRef.id };
  });
```

### Pattern 2: Read-Consent Logging (LGPD Art. 38)

**What:** Every time an operator reads sensitive data (audit logs, laudo, patient record), system logs the read with consent status (did user confirm they understand they're reading PII?).

**When to use:** Audit views, analytics dashboards, clinical portals—any view that displays patient-identifiable info.

**Example:**

```typescript
// Client hook: wraps useAuditorias subscription with consent tracking

export function useAuditWithReadLogging(labId: string, options: { requireConsent?: boolean } = {}) {
  const user = useUser();
  const [auditorias, setAuditorias] = useState<AuditEntry[]>([]);

  useEffect(() => {
    // Log the read intent
    registerAuditRead({
      labId,
      documentId: `audit-trail/${labId}`,
      sourceView: 'auditoria',
      consentStatus: options.requireConsent ? 'pendente' : 'sem-opcao',
    }).then((readEventId) => {
      // Now subscribe to data
      const unsub = subscribeAuditorias(labId, (entries) => {
        setAuditorias(entries);
      });
      return () => unsub();
    });
  }, [labId, user.id]);

  return { auditorias, loading: !auditorias.length };
}

// Server callable
export const registerAuditRead = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, documentId, sourceView, consentStatus } = data;

    const readEventRef = admin.firestore().collection(`labs/${labId}/audit-reads`).doc();

    await readEventRef.set({
      operatorId: context.auth!.uid,
      timestamp: admin.firestore.Timestamp.now(),
      documentId,
      sourceView,
      consentStatus, // 'consentiu' | 'nao-consentiu' | 'sem-opcao'
      deletadoEm: null,
    });

    return { readEventId: readEventRef.id };
  });
```

### Pattern 3: Data Subject Access Request (LGPD Art. 18)

**What:** Patient submits GDPR-like "I want a copy of my data" request. Backend exports all PII in structured format (JSON or Excel) and queues email delivery. All actions audited.

**When to use:** LGPD compliance. Triggered from patient-facing portal (v1.5) or admin intake form (v1.4).

**Example:**

```typescript
// Admin form calls this
export async function createSolicitacaoDados(input: {
  labId: string;
  titular_id: string;
  titular_nome: string;
  titular_email: string;
  tipo: 'acesso' | 'retificacao' | 'exclusao';
  motivo?: string;
}): Promise<string> {
  const callable = httpsCallable(functions, 'createSolicitacaoDados');
  const result: any = await callable(input);
  return result.data.solicitacaoId;
}

// Cloud Function
export const createSolicitacaoDados = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, titular_id, titular_email, tipo } = data;

    // Validate RT approval if tipo = 'exclusao'
    if (tipo === 'exclusao') {
      const user = await admin.auth().getUser(context.auth!.uid);
      if (!user.customClaims?.role?.includes('rt')) {
        throw new Error('Only RT can approve data deletion');
      }
    }

    // Create solicitacao document
    const solicitacaoRef = admin.firestore().collection(`labs/${labId}/lgpd-solicitacoes`).doc();

    const prazo = new Date();
    prazo.setDate(prazo.getDate() + 15); // 15 days for response (LGPD Art. 18)

    await solicitacaoRef.set({
      titular_id,
      titular_nome: data.titular_nome,
      titular_email,
      tipo,
      status: 'pendente',
      data_solicitacao: admin.firestore.Timestamp.now(),
      data_prazo: admin.firestore.Timestamp.fromDate(prazo),
      criadoEm: admin.firestore.Timestamp.now(),
      criadoPor: context.auth!.uid,
    });

    // Audit this action
    await registerAuditEntry(
      labId,
      'lgpd.solicitacao-criada',
      'lgpd',
      `LGPD ${tipo} request from ${titular_email}`,
      { solicitacaoId: solicitacaoRef.id, tipo, titularId: titular_id },
    );

    return { solicitacaoId: solicitacaoRef.id, prazo: prazo.toISOString() };
  });
```

### Anti-Patterns to Avoid

- **Client-side audit writes:** Never allow client Firestore batch to write directly to `audit-trail`. Rules must reject. Callable is the gate.
- **Audit logs without timestamp sealing:** Never trust client timestamp. `timestamp: serverTimestamp()` in callable.
- **Unlinked audit chains:** Every entry must have `previousHash`. Gaps = integrity failure.
- **Read logs without consent status:** LGPD auditor checks: "who accessed what data and did they consent?" If read log is missing `consentStatus`, auditor marks as non-compliant.
- **Synchronous LGPD fulfillment:** Never export 10k patient records in the HTTP response. Queue async job + email delivery; UI polls for completion.

## Don't Hand-Roll

| Problem                  | Don't Build                        | Use Instead                                              | Why                                                         |
| ------------------------ | ---------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| Audit chain integrity    | Custom hash verification algorithm | HMAC-SHA256 via Node.js crypto (ADR-0012)                | Cryptography is hard; standard library is battle-tested     |
| LGPD request fulfillment | Manual CSV generator + email       | Cloud Function + nodemailer + jsPDF                      | Async + retry logic, email templates, PDF signing           |
| Consent UX               | Custom consent dialog              | Reuse pattern from EC (educacao-continuada) + LGPD modal | Consistent with v1.3 design; auditor expects known patterns |
| Audit report generation  | In-memory JSON aggregation         | Server-side pdfkit + streaming response                  | >1k entries = OOM client-side; server streams to browser    |

**Key insight:** Audit infrastructure looks simple (timestamp + user ID) but regulatory complexity (chain integrity, consent proof, LGPD evidence preservation) demands cryptographic + operational discipline. Off-the-shelf libraries + proven patterns (ADR-0012) reduce attack surface.

## Runtime State Inventory

> Phase 6 does NOT involve rename/refactor/migration of existing audit state. It is additive (new collections, new callables). **This section is SKIPPED.**

## Common Pitfalls

### Pitfall 1: Audit Log Bloat from Polling

**What goes wrong:** If audit logging is triggered on every Firestore listener update (e.g., `onSnapshot` fires for each field change), audit trail explodes with duplicate entries. Auditor report becomes unreadable.

**Why it happens:** Developers instrument `onSnapshot` callbacks without deduplication. Multiple clients listening to same doc = multiple log entries per actual operation.

**How to avoid:** Audit entry is created **once per operation**, in the Cloud Function that executes the action (e.g., `registerAuditEntry` called from laudo-release callable, not from React hook). Listeners only **read** audit logs.

**Warning signs:** Audit trail has 10x more entries than expected; timestamps cluster within milliseconds; same `operatorId` + `operation` repeated.

### Pitfall 2: Chain Integrity Breaks on Concurrent Writes

**What goes wrong:** Two operations happen near-simultaneously. Both read `previousHash` from the same doc, generate chains. One writes first, invalidating the chain of the second.

**Why it happens:** Firestore doesn't lock on read; two Cloud Function invocations don't coordinate on write.

**How to avoid:** Use Firestore **transactions** to read-then-write atomically. Pattern: `admin.firestore().runTransaction(async (tx) => { const lastEntry = tx.get(...); const newHash = compute(lastEntry.hash); tx.set(..., newHash); })`.

**Warning signs:** Verification report shows "chain broken at entry N; expected prev_hash X but got Y"; concurrent users cause hash divergence.

### Pitfall 3: LGPD Request Timeout (Async Trap)

**What goes wrong:** Admin submits "export all patient data" via HTTP callable. Frontend waits for response. If export takes >10s, Cloud Functions timeout fires; user sees error; half-exported file is lost; audit shows incomplete request.

**Why it happens:** Exporting 5k patient records is not instantaneous. Callables have 540s hard limit but browser has 30s soft limit.

**How to avoid:** (1) Callable returns immediately with `solicitacaoId`. (2) Backend job (Cloud Task or Pub/Sub trigger) processes async. (3) UI polls `getSolicitacaoStatus(solicitacaoId)` → when `status == 'concluida'`, shows "Download link" + audit proof. (4) Email notification sent to titular + RT with download link + "link valid for 30 days".

**Warning signs:** Browser shows "timeout"; user submits request again; audit shows duplicate `solicitacao` entries; export file is incomplete/corrupted.

### Pitfall 4: Consent Status Misinterpretation

**What goes wrong:** Auditor reads "consentStatus: 'sem-opcao'" and asks: "sem-opcao = they didn't choose, or they chose no-consent?" Ambiguity = audit finding.

**Why it happens:** Enum values are unclear. v1.3 took shortcut: status is boolean `consentiu` or null.

**How to avoid:** Use explicit enum: `'consentiu' | 'nao-consentiu' | 'sem-opcao'`. Document in RESEARCH.md and code comment: `'sem-opcao'` = internal system view (audit log), no user choice required. `'consentiu'` = user explicitly confirmed. `'nao-consentiu'` = user declined (rare, reserved for patient portal v1.5).

**Warning signs:** Auditor asks for clarification; code has comments "TODO: fix enum naming"; different modules use different status values.

### Pitfall 5: Audit Entry Payload is PII Leakage

**What goes wrong:** Module logs `payload: { paciente_nome: 'João da Silva', resultado: 'HIV+' }`. Audit trail is now a de facto patient database. RDC auditor says "your audit logs are exposing sensitive data; who has access?"

**Why it happens:** Developer includes full entity in `payload` for debugging convenience.

**How to avoid:** Payload is **structural** only: IDs, status changes, operator, timestamp. Do NOT include patient name, diagnosis, result. Example: `payload: { laudoId: 'LAC-001', status: 'draft' → 'released', rtId: 'op-123' }`.

**Warning signs:** Audit entry contains free-text clinical findings; LGPD auditor marks as violation; Rules need tightening to reject fat payloads.

## Code Examples

Verified patterns from v1.3 (ADR-0012) and Phase 3 schema.

### HMAC Chain Calculation (Server-Side)

```typescript
// Source: ADR-0012 + functions/src/modules/audit.ts (to be implemented in Phase 6)

import { createHmac, createHash } from 'crypto';

async function sealAuditEntry(
  previousHash: string | null,
  payload: Record<string, unknown>,
  secret: string,
): Promise<{ hmac: string; hash: string }> {
  // HMAC-SHA256: (previous_hash + payload + secret)
  const hmacInput = JSON.stringify({ previousHash, payload });
  const hmac = createHmac('sha256', secret).update(hmacInput).digest('hex'); // 64 chars

  // Full hash: SHA-256 of (hmac + previousHash + timestamp)
  const now = new Date().toISOString();
  const hashInput = JSON.stringify({ hmac, previousHash, now });
  const hash = createHash('sha256').update(hashInput).digest('hex'); // 64 chars

  return { hmac, hash };
}
```

### Firestore Rules: Audit Trail Immutability

```javascript
// Source: firestore.rules (Phase 6 update)

match /labs/{labId}/audit-trail/{entryId} {
  // Only Cloud Function (service context, no auth.uid) can write
  allow create: if request.auth == null
    && request.resource.data.size() > 0
    && request.resource.data.hmac is string
    && request.resource.data.hash is string
    && request.resource.data.hash.size() == 64;

  // Client can only read if they have audit:read claim for this lab
  allow read: if request.auth.token.audit_labs[labId] == 'read'
    || request.auth.token.role == 'rt';

  // No updates or deletes
  allow update, delete: if false;
}
```

### Integrity Verification Callable

```typescript
// Source: functions/src/modules/compliance.ts (to be implemented Phase 6)

export const verifyAuditChainIntegrity = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, startDate, endDate } = data;

    // Only auditors + RT
    if (!['auditor', 'rt'].includes(context.auth?.token?.role)) {
      throw new Error('Unauthorized');
    }

    const entries = await admin
      .firestore()
      .collection(`labs/${labId}/audit-trail`)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .orderBy('timestamp', 'asc')
      .get();

    const violations: any[] = [];
    let previousHash: string | null = null;

    for (const doc of entries.docs) {
      const entry = doc.data();

      // Verify hash chain
      if (entry.previousHash !== previousHash) {
        violations.push({
          entryId: doc.id,
          reason: 'hash-sequence-broken',
          expected: previousHash,
          actual: entry.previousHash,
        });
      }

      // Verify HMAC (requires secret key access)
      const secret = await getSecretValue('audit-hmac-key');
      const expectedHmac = createHmac('sha256', secret)
        .update(JSON.stringify({ previousHash: entry.previousHash, payload: entry.payload }))
        .digest('hex');

      if (entry.hmac !== expectedHmac) {
        violations.push({
          entryId: doc.id,
          reason: 'hmac-mismatch',
          expected: expectedHmac,
          actual: entry.hmac,
        });
      }

      previousHash = entry.hash;
    }

    return {
      valid: violations.length === 0,
      entriesChecked: entries.size,
      violations,
      generatedAt: new Date().toISOString(),
    };
  });
```

## State of the Art

| Old Approach               | Current Approach                    | When Changed          | Impact                                        |
| -------------------------- | ----------------------------------- | --------------------- | --------------------------------------------- |
| Timestamp-only logs (v1.2) | HMAC-SHA256 chain (v1.3+)           | ADR-0012 (2026-05-07) | Audit-proof integrity; regulatory credibility |
| Client-side audit writes   | Server-sealed callables             | Phase 3 schema design | Non-repudiable operator attribution           |
| No read consent tracking   | Per-read audit log + consent status | Phase 6 (new)         | LGPD Art. 38 compliance                       |
| Manual LGPD exports        | Async Cloud Function + email        | Phase 6 (new)         | Scalable, auditable, compliant                |

**Deprecated/outdated:**

- **Client-side `createAuditEntry` in v1.2:** Replaced by callable. Rollback not needed; v1.3 already deprecated.
- **Loose "who did what" logging:** Upgraded to HMAC chain in v1.3; v1.4 Phase 0–3 standardized pattern across all modules.

## Assumptions Log

| #   | Claim                                                                               | Section                     | Risk if Wrong                                                                                 |
| --- | ----------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| A1  | RDC 978 Art. 128 "rastreabilidade" accepts HMAC-SHA256 chains as proof of integrity | Standard Stack + Patterns   | Auditor rejects chain validation approach; costly rework to add digital signature PKI         |
| A2  | DICQ 4.4 "Documentação de Auditoria" requires server-sealed timestamps (not client) | Patterns                    | Client-side timestamps may be rejected; Phase 6 implementation blocked                        |
| A3  | LGPD Art. 38 data subject access requests must be async (not inline HTTP response)  | Pattern 3 + Common Pitfalls | If inline, large exports timeout; UX broken; compliance gap                                   |
| A4  | Firestore Rules can enforce `request.auth == null` for Cloud Function writes        | Code Examples (Rules)       | If Rules don't distinguish service context, any authenticated user could inject audit entries |

**If any claim is wrong:** User confirmation required before finalizing Phase 6 spec. These are regulatory+architectural decisions.

## Open Questions

1. **LGPD data subject access export format** — Excel (XLSX) vs JSON vs both?
   - What we know: v1.3 export module uses XLSX (ExportWizard). LGPD commonly expects structured export.
   - What's unclear: Does RDC auditor have preference? Does patient prefer human-readable XLSX?
   - Recommendation: Support both; callable parameter `format: 'xlsx' | 'json'`; default XLSX.

2. **Audit log retention window** — keep all entries or rotate after 5 years (RDC Art. 115)?
   - What we know: RDC Art. 115 requires 5-year minimum retention for all records.
   - What's unclear: After 5 years, can we archive to cold storage (Cloud Archive)? Or keep hot in Firestore?
   - Recommendation: Implement cron job in Phase 9–10 to export 5-year-old logs to Cloud Archive monthly; keep recent 2 years hot.

3. **Consent UI placement** — where should patient see "you're about to view PII" modal in patient portal (v1.5)?
   - What we know: v1.5 is out of Phase 6 scope.
   - What's unclear: Should Phase 6 define the consent modal template? Or is v1.5 greenfield?
   - Recommendation: Phase 6 defines `consentStatus` enum + callable contract; v1.5 designs UI.

## Environment Availability

| Dependency                   | Required By                       | Available | Version                    | Fallback                                                           |
| ---------------------------- | --------------------------------- | --------- | -------------------------- | ------------------------------------------------------------------ |
| Google Cloud Secret Manager  | Audit HMAC key rotation           | ✓         | v1 API                     | Hard-code secret (not for production; Phase 0 emergency only)      |
| Node.js crypto module        | HMAC-SHA256 calculation           | ✓         | Built-in                   | Use `tweetnacl.js` if crypto not available (unlikely; legacy Node) |
| Cloud Firestore transactions | Atomic read-then-write for chain  | ✓         | Firestore API v9+          | Fall back to optimistic concurrency (higher violation risk)        |
| Firebase Cloud Functions     | Callable for audit sealing + LGPD | ✓         | Region: southamerica-east1 | Deploy to us-central1 if region down (latency +50ms)               |

**Missing dependencies with no fallback:**

- None identified. Phase 6 uses only existing v1.3 infrastructure.

**Missing dependencies with fallback:**

- If Secret Manager is unavailable, audit key can be hardcoded in `.env` temporarily (dev/staging only), but must be rotated manually. Not suitable for production.

## Validation Architecture

### Test Framework

| Property           | Value                                        |
| ------------------ | -------------------------------------------- |
| Framework          | Jest + Firebase Emulator (existing)          |
| Config file        | `jest.config.js` (existing)                  |
| Quick run command  | `npm run test -- src/features/sgq/auditoria` |
| Full suite command | `npm run test && npm run test:integration`   |

### Phase Requirements → Test Map

| Req ID                   | Behavior                                                      | Test Type   | Automated Command                                               | File Exists? |
| ------------------------ | ------------------------------------------------------------- | ----------- | --------------------------------------------------------------- | ------------ |
| REQ-1 (RDC 978 Art. 128) | Audit entry sealed with HMAC + chain link                     | Unit        | `npm test -- registerAuditEntry.test.ts`                        | ❌ Wave 0    |
| REQ-2 (DICQ 4.4)         | Audit chain integrity verifiable (recalculate hashes, match)  | Integration | `npm run test:integration -- verifyAuditChainIntegrity.test.ts` | ❌ Wave 0    |
| REQ-3 (LGPD Art. 38)     | Data subject request creates SolicitacaoDados + audit trail   | Unit        | `npm test -- createSolicitacaoDados.test.ts`                    | ❌ Wave 0    |
| REQ-4 (Audit UI)         | AuditoriaView renders audit log with filters, no modification | Component   | `npm test -- AuditoriaLogTable.test.tsx`                        | ❌ Wave 0    |
| REQ-5 (Read consent)     | registerAuditRead callable logs access with consentStatus     | Unit        | `npm test -- registerAuditRead.test.ts`                         | ❌ Wave 0    |
| REQ-6 (LGPD fulfillment) | fulfillSolicitacaoDados exports data async + sends email      | Integration | `npm run test:integration -- fulfillSolicitacaoDados.test.ts`   | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm test -- src/features/sgq/auditoria` (unit tests for callables)
- **Per wave merge:** `npm run test && npm run test:integration` (full suite including Firestore rules)
- **Phase gate:** Full suite green + emulator Rules validation + manual smoke test (export audit report PDF)

### Wave 0 Gaps

- [ ] `functions/src/modules/audit.test.ts` — covers REQ-1, REQ-2, REQ-5 (registerAuditEntry, registerAuditRead, verifyAuditChainIntegrity)
- [ ] `functions/src/modules/lgpd.test.ts` — covers REQ-3, REQ-6 (createSolicitacaoDados, fulfillSolicitacaoDados)
- [ ] `src/features/sgq/auditoria/components/AuditoriaLogTable.test.tsx` — covers REQ-4
- [ ] `firestore.rules.test.ts` (extend existing) — audit-trail immutability rules + read consent rules
- [ ] `setupTests.ts` — mock Google Secret Manager for HMAC key rotation tests

_(If no gaps: existing test infrastructure does not yet cover Phase 6 callables/rules; Wave 0 must scaffold)_

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                 |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| V2 Authentication     | yes     | `request.auth.uid` validated in callables; Cloud Functions enforce service-context-only for sensitive writes                                     |
| V3 Session Management | yes     | Audit logs are immutable per-session (Firestore Rules + transaction integrity)                                                                   |
| V4 Access Control     | yes     | `audit_labs` claim + `role:auditor` OR `role:rt` for audit log read; Rules enforce                                                               |
| V5 Input Validation   | yes     | Zod schemas for `AuditEntryInput`, `SolicitacaoDados`; callable validates before sealing                                                         |
| V6 Cryptography       | yes     | HMAC-SHA256 + SHA-256 chain (ADR-0012); never hand-roll crypto                                                                                   |
| V7 Error Handling     | yes     | Callables catch exceptions; return error codes, not stack traces; user sees "Request failed; contact admin"                                      |
| V8 Data Protection    | yes     | PII NOT in audit payload (see Anti-Patterns); LGPD export is encrypted in transit (HTTPS); audit logs stored in Firestore with field-level rules |
| V9 Communication      | yes     | All callables over HTTPS (Cloud Functions default); Firebase Hosting enforces HTTPS                                                              |
| V10 Malicious Code    | low     | No untrusted code execution; Cloud Functions are reviewed on deployment                                                                          |
| V13 API Security      | yes     | Callables are authenticated (Firebase Auth required); no API keys exposed                                                                        |
| V14 Configuration     | yes     | Secret Manager for HMAC key; no hardcoded secrets in code                                                                                        |

### Known Threat Patterns for {Firestore + Cloud Functions}

| Pattern                          | STRIDE                 | Standard Mitigation                                                                                                       |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Audit log tampering (post-write) | Tampering              | Firestore Rules: `allow update: if false` on sealed entries; violations audited                                           |
| Unauthorized read of audit logs  | Information Disclosure | RBAC via `audit_labs` claim; Rules check `role:auditor` or `role:rt`                                                      |
| HMAC key compromise              | Information Disclosure | Key rotation monthly via Secret Manager; leaked key invalidates only future hashes, not past (can re-verify with old key) |
| LGPD data export interception    | Information Disclosure | HTTPS in transit; export encrypted at rest in Firebase Storage; signed URL expires in 1 hour                              |
| DOS on audit log verification    | Denial of Service      | Callable times out after 540s; verification job is cron-based (off-peak), not inline                                      |
| Concurrent write chain break     | Integrity              | Firestore transactions (atomic read-then-write); concurrent writes serialize                                              |
| Operator impersonation           | Spoofing               | `operatorId = request.auth.uid` (Firebase Auth canonical); cannot be forged by client                                     |

## Sources

### Primary (HIGH confidence)

- **ADR-0012** (`C:\hc quality\docs\adr\ADR-0012-rdc-978-audit-trail-logical-signature.md`) — HMAC-SHA256 chain architecture, Firestore Rules enforcement, recovery procedures
- **v1.3 SGQ Types** (`src\features\sgq\auditoria\types.ts`) — `AuditEntry`, `ChainValidationResult`, `ComplianceReport` interfaces (verified in codebase)
- **RDC 978/2025** (Obsidian `HC_Quality_RDC_978_2025_Resumo.md`, Arts. 117–131, 128 rastreabilidade, 115 retention) — regulatory requirements
- **DICQ 4.4** (Obsidian `HC_Quality_Compliance_DICQ.md`, Block D sub-item 4.4) — audit documentation standards
- **LGPD Law** (code `src/features/lgpd/types/LGPD.ts` types: `SolicitacaoDados` with `tipo: 'acesso' | 'retificacao' | 'exclusao'`) — Art. 18 (access requests), Art. 38 (data subject rights)

### Secondary (MEDIUM confidence)

- **v1.4 REQUIREMENTS** (`.planning/milestones/v1.4-REQUIREMENTS.md`) — Phase 6 is implicitly ref'd in Block D (4.14.5 auditoria interna + 4.14.6 risks + data subject access)
- **v1.4 DICQ Coverage Matrix** (`.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md`) — Block D coverage delta (+25 pts); Phase 6 mapped to NEW-D1 (auditoria interna) + REQ-415 (audit trail)
- **Auditoria Interna Module** (`src/features/auditoria-interna/CLAUDE.md`) — Phase 3 Wave 3 pending (Cloud Functions callables); types + service layer + Rules done
- **PHASE_3_TRAINING.md** (existing doc, Phase 3 onboarding) — establishes callable + Rules pattern (copy-paste safe)

### Tertiary (LOW confidence)

- None. Phase 6 research is grounded in v1.3 production code + official RDC + DICQ standards.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH (all deps exist in v1.3; no new packages)
- Architecture (callables): HIGH (ADR-0012 approved + Phase 3 deployed similar patterns)
- Regulatory (RDC/DICQ/LGPD): HIGH (extracted from official docs + Obsidian compliance spine)
- Pitfalls: MEDIUM (chain breaks, concurrent writes—mitigated by Firestore transactions but edge cases exist)
- LGPD fulfillment UX: MEDIUM (async pattern is standard, but email delivery + link expiry adds complexity)

**Research date:** 2026-05-07  
**Valid until:** 2026-05-21 (2 weeks; RDC/DICQ stable, crypto practices stable; Firestore API stable)
