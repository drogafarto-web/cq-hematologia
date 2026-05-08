# NOTIVISA Cloud Function Callables — Implementation Guide

## Overview

This document describes the implementation of four Cloud Function callables for NOTIVISA integration (Phase 4). These callables enable authenticated submission and tracking of laboratory test results to the Brazilian government's NOTIVISA notification system.

**Project Compliance:** RDC 978 Art. 66 (Signed Access) + DICQ 4.3 (Audit Trail)

---

## Callables Implemented

### 1. `authenticatePortal`
**File:** `authenticatePortal.ts`

**Purpose:** Authenticate with the NOTIVISA portal and create a session token.

**Input Schema:**
```typescript
{
  labId: string;              // Required: Lab identifier
  portalUsername: string;     // Required: Portal username (min 3 chars)
  portalPassword: string;     // Required: Portal password (min 8 chars)
  mfaCode?: string;           // Optional: 6-digit MFA code
}
```

**Output (Success):**
```typescript
{
  ok: true;
  authToken: string;          // Base64-encoded session token
  expiresAt: number;          // Expiration timestamp (ms)
  sessionId: string;          // Unique session identifier
  portalUrl?: string;         // Portal endpoint URL
}
```

**Output (Error):**
```typescript
{
  ok: false;
  code: enum [
    'INVALID_CREDENTIALS',     // Username/password incorrect
    'MFA_REQUIRED',            // MFA needed but not provided
    'MFA_INVALID',             // MFA code failed validation
    'PORTAL_CONFIG_MISSING',   // Lab hasn't configured portal
    'PORTAL_UNREACHABLE',      // Portal API unavailable
    'SESSION_CREATION_FAILED', // Unexpected session error
    'PERMISSION_DENIED',       // User lacks notivisa claim
    'INTERNAL_ERROR'           // Generic server error
  ];
  message: string;            // Human-readable error
}
```

**Key Features:**
- Multi-factor authentication support (optional per lab config)
- Session creation with 1-hour expiration
- Audit logging of all login attempts
- Credential validation against lab portal config
- PII protection in logs (masks CPF/credentials)

**Example Usage:**
```javascript
const result = await firebase.functions().httpsCallable('authenticatePortal')({
  labId: 'lab-abc',
  portalUsername: 'operator001',
  portalPassword: 'securePassword123',
  mfaCode: '123456' // If required
});

if (result.data.ok) {
  console.log('Session created:', result.data.sessionId);
  // Use result.data.authToken for subsequent calls
}
```

**Firestore Collections Modified:**
- `notivisa-sessions/{labId}/sessions/{sessionId}` — Session metadata
- `notivisa-audit-logs/{labId}/logins/{timestamp}` — Login audit trail
- `notivisa-audit-logs/{labId}/login-attempts/{timestamp}` — Failed attempts

---

### 2. `getPatientData`
**File:** `getPatientData.ts`

**Purpose:** Retrieve patient demographics and laudo (test result) data with validation.

**Input Schema:**
```typescript
{
  labId: string;              // Required: Lab identifier
  pacienteCpf: string;        // Required: Patient CPF (11 digits)
  laudoId?: string;           // Optional: Specific laudo ID; defaults to latest
}
```

**Output (Success):**
```typescript
{
  ok: true;
  paciente: {
    cpf: string;
    nome: string;
    dataNascimento?: number;  // Unix timestamp
    sexo?: 'M' | 'F' | 'O';
    mae?: string;
  };
  laudo: {
    id: string;
    pacienteCpf: string;
    resultadoEm: number;      // Unix timestamp
    resultados: [{
      analito: string;
      valor: number | string;
      unidade: string;
      referencia: string;
    }];
    assinatura: {
      operatorCpf: string;
      operatorNome: string;
      ts: number;             // Unix timestamp
    };
  };
  readyForSubmission: boolean; // All required fields present
  missingFields?: string[];    // Fields preventing submission
}
```

**Output (Error):**
```typescript
{
  ok: false;
  code: enum [
    'PATIENT_NOT_FOUND',       // CPF not in database
    'LAUDO_NOT_FOUND',         // No test result for patient
    'INCOMPLETE_DATA',         // Missing required fields
    'PERMISSION_DENIED',       // User lacks notivisa claim
    'INTERNAL_ERROR'
  ];
  message: string;
  missingFields?: string[];    // Listed only for INCOMPLETE_DATA
}
```

**Key Features:**
- Comprehensive data completeness validation
- Support for latest laudo or specific ID lookup
- Detailed error reporting of missing fields
- Audit logging of data access (with masked CPF)
- No PII exposure in error messages

**Example Usage:**
```javascript
const result = await firebase.functions().httpsCallable('getPatientData')({
  labId: 'lab-abc',
  pacienteCpf: '12345678901'
});

if (result.data.ok && result.data.readyForSubmission) {
  console.log('Ready to submit:', result.data.laudo.id);
} else if (!result.data.readyForSubmission) {
  console.log('Missing fields:', result.data.missingFields);
}
```

**Firestore Collections Modified:**
- `notivisa-audit-logs/{labId}/data-access/{timestamp}` — Data access audit trail

---

### 3. `submitRequisition`
**File:** `submitRequisition.ts`

**Purpose:** Submit a lab requisition to the NOTIVISA portal and enqueue for polling.

**Input Schema:**
```typescript
{
  labId: string;              // Required: Lab identifier
  pacienteCpf: string;        // Required: Patient CPF (11 digits)
  laudoId: string;            // Required: Test result ID
  authSessionId: string;      // Required: Session from authenticatePortal
  notivisaPayload: {          // Required: Validated NOTIVISA payload
    versao: '1.0';
    laudo_id: string;
    paciente_cpf: string;     // 11 digits
    data_resultado: number;   // Unix timestamp
    resultados: [{
      analito: string;
      valor: number | string;
      unidade: string;
      referencia: string;
    }];
    assinador: {
      cpf: string;            // 11 digits
      nome: string;
      data_assinatura: number; // Unix timestamp
    };
  };
}
```

**Output (Success):**
```typescript
{
  ok: true;
  requisitionId: string;      // Unique submission ID
  status: 'queued' | 'submitted' | 'acknowledged';
  protocolNumber?: string;    // Government protocol number
  nextCheckAt?: number;       // Next polling time (ms)
}
```

**Output (Error):**
```typescript
{
  ok: false;
  code: enum [
    'INVALID_SESSION',         // Session not found
    'SESSION_EXPIRED',         // Session past expiration
    'INVALID_PAYLOAD',         // Payload validation failed
    'DUPLICATE_SUBMISSION',    // Already submitted for this laudo+CPF
    'PORTAL_ERROR',            // Portal API communication failed
    'RATE_LIMITED',            // Exceeded 20 submissions/hour
    'PERMISSION_DENIED',       // User lacks notivisa claim
    'INTERNAL_ERROR'
  ];
  message: string;
}
```

**Key Features:**
- Duplicate submission detection (idempotency)
- Rate limiting (20 submissions per hour per lab)
- Graceful degradation (queues if portal unavailable)
- Atomic batch writes (submission + audit + status update)
- Protocol number generation and tracking
- Optional idempotency token support

**Example Usage:**
```javascript
const result = await firebase.functions().httpsCallable('submitRequisition')({
  labId: 'lab-abc',
  pacienteCpf: '12345678901',
  laudoId: 'laudo-123',
  authSessionId: sessionId,
  notivisaPayload: payloadFromGetPatientData
});

if (result.data.ok) {
  console.log('Submitted! Protocol:', result.data.protocolNumber);
  console.log('Check again at:', new Date(result.data.nextCheckAt));
}
```

**Firestore Collections Modified:**
- `notivisa-requisitions/{labId}/submissions/{requisitionId}` — Submission record
- `notivisa-requisitions/{labId}/submissions/{requisitionId}/auditLog/{timestamp}` — Status changes
- `notivisa-sessions/{labId}/sessions/{sessionId}` — Last activity update

---

### 4. `trackSampleStatus`
**File:** `trackSampleStatus.ts`

**Purpose:** Poll NOTIVISA portal for submission status and update records.

**Input Schema:**
```typescript
{
  labId: string;              // Required: Lab identifier
  requisitionId: string;      // Required: Submission ID from submitRequisition
  authSessionId?: string;     // Optional: Session for portal API calls
}
```

**Output (Success):**
```typescript
{
  ok: true;
  status: enum [
    'queued',                  // Waiting for submission
    'submitted',               // Submitted to portal
    'acknowledged',            // Portal acknowledged receipt
    'processing',              // Under government review
    'completed',               // Processing complete
    'failed',                  // Failed or timeout
    'rejected'                 // Government rejected
  ];
  protocolNumber?: string;
  portalStatus?: string;      // Raw portal status code
  updatedAt: number;          // Last status timestamp (ms)
  nextCheckAt?: number;       // Time to check again (undefined = terminal)
  errorMessage?: string;      // For failed/rejected status
  details?: {
    attempts: number;
    maxAttempts: number;
    lastAttemptAt?: number;
    response?: Record<string, any>;
  };
}
```

**Output (Error):**
```typescript
{
  ok: false;
  code: enum [
    'REQUISITION_NOT_FOUND',   // Submission ID invalid
    'SESSION_INVALID',         // Session not found
    'SESSION_EXPIRED',         // Session past expiration
    'PERMISSION_DENIED',       // User lacks notivisa claim
    'PORTAL_ERROR',            // Portal polling failed
    'INTERNAL_ERROR'
  ];
  message: string;
}
```

**Key Features:**
- Optional session validation
- Automatic 24-hour polling timeout
- Terminal state detection (no polling for final states)
- Graceful error recovery (continues with last known status)
- Portal response mapping to internal status enum
- Detailed attempt tracking
- Audit logging of all status changes
- 5-minute polling interval between checks

**Example Usage:**
```javascript
// Poll until completion
const poll = setInterval(async () => {
  const result = await firebase.functions().httpsCallable('trackSampleStatus')({
    labId: 'lab-abc',
    requisitionId: requisitionId
  });

  console.log('Status:', result.data.status);
  
  if (!result.data.nextCheckAt) {
    // Terminal state reached
    clearInterval(poll);
    console.log('Complete:', result.data.status);
  } else {
    // Schedule next check
    console.log('Check again at:', new Date(result.data.nextCheckAt));
  }
}, 300000); // Check every 5 minutes
```

**Firestore Collections Modified:**
- `notivisa-requisitions/{labId}/submissions/{requisitionId}` — Status update
- `notivisa-requisitions/{labId}/submissions/{requisitionId}/auditLog/{timestamp}` — Status history

---

## Architecture Patterns

### Authorization Model
All callables follow the pattern:
1. **Authentication check** — `request.auth` must exist
2. **Module claim validation** — `auth.token.modules.notivisa === true`
3. **Lab membership check** — User in `labs/{labId}/members/{uid}` (active)

See `validators.ts` and `assertNotivisaAccess()` for implementation.

### Error Handling
- **Input validation errors** → `INTERNAL_ERROR` with validation message
- **Firestore errors** → logged, user sees generic `INTERNAL_ERROR`
- **Portal API errors** → graceful degradation (queued for retry)
- **Auth errors** → appropriate HTTP error thrown (unauthenticated/permission-denied)

### Audit Trail Strategy
Every callable creates audit log entries:
- **Entry location:** `notivisa-audit-logs/{labId}/<action-type>/{timestamp}`
- **Immutable:** Created via batch, never updated
- **PII masking:** CPF masked to first 3 digits in logs
- **Action types:** PORTAL_LOGIN, PATIENT_DATA_RETRIEVED, SUBMITTED, STATUS_UPDATED

### Rate Limiting
- **Submit endpoint:** 20 requests per hour per lab
- **Portal authentication:** No limit (but 6-digit MFA prevents brute-force)
- **Status tracking:** No limit (polling is read-only)

---

## Testing

Each callable has a comprehensive test suite covering:

### authenticatePortal.test.ts
- ✅ Successful authentication (with/without MFA)
- ✅ Validation of credentials and MFA codes
- ✅ Session creation and expiration
- ✅ Error cases (invalid creds, missing config, permission denied)
- ✅ Audit logging
- ✅ Input validation (labId, username/password length)

### getPatientData.test.ts
- ✅ Successful data retrieval
- ✅ Latest vs. specific laudo lookup
- ✅ Missing field detection (patient + laudo)
- ✅ CPF format validation
- ✅ Error cases (patient/laudo not found, incomplete data)
- ✅ Audit logging with CPF masking

### submitRequisition.test.ts
- ✅ Successful submission (queued or submitted)
- ✅ Portal unavailable → queue for retry
- ✅ Duplicate detection
- ✅ Rate limiting enforcement
- ✅ Session validation
- ✅ Payload validation
- ✅ Audit trail creation

### trackSampleStatus.test.ts
- ✅ Status polling and updates
- ✅ Terminal state detection
- ✅ 24-hour timeout
- ✅ Session optional behavior
- ✅ Portal error graceful handling
- ✅ Status transition logging
- ✅ Details/attempts tracking

**Run tests:**
```bash
cd functions
npm test -- notivisa
```

---

## Deployment Checklist

Before deploying to production:

### Pre-Deployment
- [ ] All tests passing locally (`npm test`)
- [ ] Type-check clean (`npm run build`)
- [ ] Environmental secrets provisioned:
  - [ ] `NOTIVISA_PORTAL_URL` (government API endpoint)
  - [ ] `NOTIVISA_API_KEY` (authentication token)
  - [ ] `NOTIVISA_LAB_KEY` (per-lab credential — per lab config)
- [ ] Lab portal configurations created in Firestore:
  - [ ] `labs/{labId}/notivisa-config/portal` (URL, requiresMfa)
  - [ ] `labs/{labId}/notivisa-config/credentials` (encrypted username/password)
- [ ] Firestore rules deployed (see `.claude/rules/notivisa-firestore-rules.md`)
- [ ] Firestore indexes created (see rules doc)

### Deployment Order
1. Deploy Firestore rules + indexes (gates access)
2. Deploy Cloud Functions
3. Provision module claim (`modules.notivisa = true`) for pilot users
4. Smoke test in sandbox (all 4 callables)
5. Monitor Cloud Logs for 24 hours
6. Promote to production users

### Post-Deployment
- [ ] Monitor Cloud Logs for errors
- [ ] Check Firestore audit trails for unusual patterns
- [ ] Verify session creation/expiration working
- [ ] Confirm status polling (24h cycle test)
- [ ] Test error recovery (simulate portal downtime)

---

## Security Considerations

### Authentication & Authorization
- All callables require Firebase auth + notivisa module claim
- Session tokens expire after 1 hour (configurable)
- MFA support (TOTP/SMS-ready, mockable for sandbox)

### Data Protection
- Patient CPF masked in logs (first 3 digits only)
- Session tokens base64-encoded (not plaintext)
- Payload hash (SHA-256) stored in audit log
- No passwords stored in Firestore (use Cloud Secrets Manager)
- Credentials encrypted at-rest in Firestore rules validation

### Rate Limiting
- 20 submissions per hour per lab (prevents abuse)
- 6-digit MFA prevents brute-force (if enabled)
- Duplicate detection prevents accidental double-submission

### Audit Trail
- Immutable audit logs (created only, never updated)
- All actions timestamped and operator-identified
- Portal protocol numbers tracked end-to-end
- Status changes logged with before/after state

---

## API Integration

### Portal API Expectations
In `submitToNotivisaPortal()` and `pollNotivisaPortal()`, the mock implementation is provided. For production integration:

**Submission:**
```
POST /api/v1/notificacoes
Authorization: Bearer {authToken}
Content-Type: application/json

{
  payload: { /* NOTIVISA schema */ }
}

Response:
{
  success: true,
  protocolNumber: "NV-LAB-TIMESTAMP",
  status: "submitted"
}
```

**Status Poll:**
```
GET /api/v1/notificacoes/{protocolNumber}
Authorization: Bearer {authToken}

Response:
{
  status: "submitted" | "acknowledged" | "processing" | "completed" | "rejected",
  updatedAt: 1700000000000,
  result?: { /* Government-provided data */ }
}
```

Replace mock implementations in `authenticatePortal.ts` and `submitRequisition.ts` with actual HTTP calls.

---

## Troubleshooting

### "PERMISSION_DENIED: User does not have NOTIVISA access"
- Verify user has `modules.notivisa = true` custom claim
- Check lab membership: `labs/{labId}/members/{uid}` with active=true

### "SESSION_EXPIRED"
- Session tokens expire after 1 hour
- Call `authenticatePortal` again to get new session
- Consider increasing `SESSION_DURATION_MS` in production

### "RATE_LIMITED"
- Lab has submitted 20+ requisitions in the past hour
- Wait until earliest submission is >1 hour old
- Or contact admin to increase limit in codebase

### "DUPLICATE_SUBMISSION"
- This laudo+CPF combination already submitted
- Check `notivisa-requisitions/{labId}/submissions` for existing record
- Idempotency: re-calling `submitRequisition` with same data returns success

### Portal errors in `trackSampleStatus`
- Circuit breaker: if portal unreachable, continues with last known status
- Check Cloud Logs for detailed error from portal API
- Polling automatically times out after 24 hours

---

## References

- **RDC 978 (ANVISA)** — Art. 66 Signed Access Requirements
- **DICQ v4.3** — Section 4.3 Audit Trail Standards
- **ADR-0014** — NOTIVISA Integration Decision Record
- **ADR-0021** — Audit Trail Design Decision Record
- **v1.4_NOTIVISA_SANDBOX_SETUP.md** — Government sandbox onboarding guide
- **Firestore Rules** — `.claude/rules/notivisa-firestore-rules.md`
