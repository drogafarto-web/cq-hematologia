# ADR-0024 — Patient Portal Authentication: HMAC-Signed Email-Link Tokens (Phase 4, v1.4)

**Date:** 2026-05-07  
**Status:** PROPOSED  
**Decided by:** CTO / fundador  
**Supersedes:** —  
**Superseded by:** —

---

## Problem

v1.4 Phase 4 includes **Patient Portal Phase 1** (read-only patient access to laudo download + NPS feedback). Patients must authenticate without:

1. **Creating a password** (LGPD Art. 38: minimize PII storage; no password = zero password breach risk).
2. **Using 3P OAuth** (Google/GitHub) — patient data would be entrusted to OAuth provider; LGPD Art. 8 restricts this unless explicit consent.
3. **Syncing with LIS** (not available until v1.4.1; Phase 4 uses manual patient seeding).

Regulatory constraints:
- **LGPD Art. 38** (patient consent): patient must explicitly consent to HC Quality processing results; no implicit OAuth delegation.
- **RDC 978 Arts. 166–180** (result communication): lab certifies it delivered result to patient; email link is defensible proof.

**Design challenge:** how to issue short-lived auth tokens without storing tokens in database?

---

## Decision

**v1.4 Phase 4 implements HMAC-signed email-link authentication:**

1. **Token generation:** Server generates JWT (or signed token) with `{ labId, patientId, ts, exp: ts + 7d }` + HMAC signature (per ADR-0012).
2. **Email delivery:** Token embedded in email link: `https://portal.hmatologia2.web.app/verify?token=<SIGNED_TOKEN>`.
3. **Token verification:** Client sends token to Cloud Function callable `verifyPatientAuthToken(token)`.
4. **No token storage:** Token is stateless; verification requires re-computing HMAC on server side (no DB lookup).
5. **Session creation:** After verification, server issues Firebase custom token (30-day TTL); client uses for subsequent API calls.

### Flow

```
Patient arrives at portal:
  1. Enters CPF (or email if lab has pre-seeded patient)
  2. POST to `generatePatientAuthLink(labId, patientIdentifier)`
       → Lab RT must confirm patient exists in `/labs/{labId}/patients`
       → Cloud Function generates: token = sign({labId, patientId, ts, exp: ts+7d})
       → Sends email with link: portal?token={token}
       → Returns: { success: true, messageSent: true }

Patient clicks email link:
  3. Browser navigates to /verify?token={token}
  4. Frontend calls `verifyPatientAuthToken(labId, token)`
       → Cloud Function computes HMAC of token payload
       → Compares with token's signature
       → If valid + not expired: issues custom Firebase auth token (scope: read own laudo)
       → If invalid or expired: returns { error: 'invalid-token' }
  5. Client stores custom token in localStorage
  6. Client redirects to /patient-portal/{patientId}/laudos
  7. Subsequent API calls: attach custom token to headers

Patient downloads laudo:
  8. Frontend calls `downloadPatientLaudo(labId, laudoId, token: customToken)`
       → Firestore rules validate: `request.auth.uid === patientId AND laudo.patientId === request.auth.uid`
       → Returns PDF (pre-cached in Cloud Storage or generated on-demand)
  9. Session expires after 30 days or explicit logout
```

---

## Technical Implementation

### Token Format (Signed JWT, no DB storage)

```typescript
// 1. Token generation (server)
const payload = {
  labId: 'lab-123',
  patientId: 'patient-456',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 86400), // 7 days
};

const tokenBody = JSON.stringify(payload);
const tokenSignature = HMAC_SHA256(tokenBody, HCQ_SIGNATURE_HMAC_KEY);
const signedToken = `${tokenBody}.${tokenSignature}`; // naive Base64URL encoding in reality

// 2. Email template
const emailBody = `
Hi [Patient Name],

Your lab results are ready. Click the link below to securely view your results:

https://portal.hmatologia2.web.app/verify?token=${signedToken}

This link expires in 7 days. After clicking, you'll have 30 days of access.
`;

// 3. Token verification (server)
const [body, signature] = signedToken.split('.');
const computedSignature = HMAC_SHA256(body, HCQ_SIGNATURE_HMAC_KEY);
if (signature !== computedSignature) {
  throw new Error('Invalid token signature');
}

const payload = JSON.parse(atob(body));
if (payload.exp < Math.floor(Date.now() / 1000)) {
  throw new Error('Token expired');
}

// 4. Custom Firebase token issuance
const customToken = admin.auth().createCustomToken(payload.patientId, {
  labId: payload.labId,
  portal: true,
  expiresIn: 30 * 86400, // 30 days
});
```

### Cloud Function Callables

#### 1. **`generatePatientAuthLink(labId, patientIdentifier)` (callable)**
- Input: `patientIdentifier` = CPF or email.
- Validates: patient exists in `/labs/{labId}/patients`.
- Lookup: `patients[?cpf === patientIdentifier || email === patientIdentifier]`.
- If not found: returns `{ error: 'patient-not-found' }` (don't leak patient existence).
- Generates token: `sign({labId, patientId, ts, exp: ts+7d})`.
- Sends email via Sendgrid or Firebase email function.
- Audit event: `{ operatorId?, patientId (hashed), ts, acao: 'auth-link-gerado' }`.
- Returns: `{ success: true, messageSent: true }`.

#### 2. **`verifyPatientAuthToken(labId, token)` (callable, unauthenticated)**
- Input: `token` (from URL query param or header).
- Parses token (validates format, checks expiry).
- Computes HMAC, compares with token signature.
- If valid: issues Firebase custom token + returns to client.
- Audit event: `{ patientId, ts, acao: 'token-verificado' }` or `{ ts, acao: 'token-verificacao-falhou' }`.
- **Rate limiting:** max 5 verification attempts per token per minute (brute-force protection).

#### 3. **`downloadPatientLaudo(labId, laudoId)` (callable, authenticated with custom token)**
- Validates: `request.auth.uid === laudo.patientId` (Firestore rules also enforce).
- Generates or retrieves PDF from Cloud Storage.
- Logs download: `{ patientId, laudoId, ts, acao: 'laudo-baixado' }`.
- Returns: signed URL for PDF download (expires 5 min).

### Firestore Rules

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Patient portal read-only access
    match /labs/{labId}/laudos/{laudoId} {
      allow read: if request.auth.token.portal == true 
                  && request.auth.uid == resource.data.patientId;
      allow write: never; // read-only for patients
    }

    // Patient data (only RT can read; patients cannot list)
    match /labs/{labId}/patients/{patientId} {
      allow read: if request.auth.uid == patientId 
                  && request.auth.token.portal == true;
      allow create, update, delete: never; // RT-only via admin SDK
    }

    // NPS feedback form (append-only)
    match /labs/{labId}/patient-nps-feedback/{feedbackId} {
      allow create: if request.auth.token.portal == true 
                    && request.auth.uid == request.resource.data.patientId;
      allow read, update, delete: never;
    }
  }
}
```

### Session Management

- **Token lifetime:** 7 days (email link expiry). After 7 days, patient must re-request link.
- **Session lifetime:** 30 days (custom Firebase token). After 30 days, patient must re-authenticate.
- **Logout:** patient clicks logout → custom token revoked (client-side deletion; server has no session store to invalidate).
- **Token refresh:** not supported (stateless). If session expires before 30 days, patient must re-login (via email link).

### Security Details

1. **Email link contains no PII** (only hashed token, no patient name/CPF visible in URL).
2. **HMAC prevents tampering** (attacker cannot forge valid token without knowing `HCQ_SIGNATURE_HMAC_KEY`).
3. **Token expiry enforced** (after 7 days, link is dead; no re-use).
4. **Rate limiting** (5 attempts per token per minute prevents brute-force verification).
5. **Sendgrid email** (if available) ensures email delivery logging; if not, fallback to Firebase email (simpler but no delivery tracking).

---

## Firestore Schema

```typescript
// /labs/{labId}/patients/{patientId}
interface Patient {
  id: string;
  labId: string;
  
  // PII (encrypted at rest)
  name: string;
  dateOfBirth: Timestamp;
  cpf: string; // hashed (bcrypt or SHA-256)
  email: string; // encrypted
  
  // v1.4.1 LIS integration (future)
  lisId?: string;
  lisVendor?: string;
  syncedAt?: Timestamp;
  
  // Patient status
  status: 'ativo' | 'inativo';
  
  // Audit
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}

// /labs/{labId}/patient-nps-feedback/{feedbackId}
interface PatientNPSFeedback {
  id: string;
  labId: string;
  patientId: string; // link to patient
  laudoId: string; // which laudo was this feedback about?
  
  // NPS question
  npsScore: number; // 0-10
  comment?: string;
  
  // Metadata
  criadoEm: Timestamp;
  // NO operator editing (append-only)
}

// Audit trail (separate collection)
// /labs/{labId}/audit-patient-portal/{eventId}
interface AuditPatientPortal {
  id: string;
  labId: string;
  
  ts: Timestamp;
  acao: 'auth-link-gerado' | 'token-verificado' | 'token-verificacao-falhou' | 'laudo-baixado' | 'feedback-submetido';
  patientId?: string; // hashed or omitted for privacy
  laudoId?: string;
  
  details?: {
    ipAddress?: string; // optional client IP
    userAgent?: string; // browser info for fraud detection
  };
}
```

---

## Rationale

1. **LGPD compliance:** stateless tokens mean zero patient session storage; no password = minimal PII footprint.
2. **RDC 978 Art. 166–180:** email link is auditable proof of result delivery (email timestamp + link click timestamp).
3. **No 3P OAuth:** patient data remains under lab control; no OAuth provider involvement.
4. **Scalability:** stateless design means no session DB required; infinite parallel patients.
5. **Simplicity:** email-link pattern is familiar (password resets, account verification); low friction for patient UX.

---

## Alternatives Considered

### A. Password-based login (username/email + password)
**Pros:** familiar auth pattern; persistent login.  
**Cons:** LGPD-unfriendly (password storage = PII breach risk); patient burden (remember password).  
**Rejected:** Violates "minimize PII" principle.

### B. SMS OTP (one-time PIN sent via SMS)
**Pros:** no password; familiar (banking apps use SMS OTP).  
**Cons:** SMS delivery unreliable (especially in rural areas of Brazil); requires phone number (more PII); cost (SMS charges).  
**Rejected:** Email is more reliable + no additional PII.

### C. OAuth (Google/GitHub)
**Pros:** no password; familiar.  
**Cons:** LGPD issue — patient credentials managed by 3P; Google/GitHub can infer lab patient base.  
**Rejected:** LGPD Art. 8 restricts delegation to 3P without explicit consent (hard to obtain at scale).

### D. Persistent email-link tokens (stored in DB)
**Pros:** can track token usage, invalidate tokens on demand.  
**Cons:** requires token store (Redis or Firestore); added operational complexity; potential token leaks.  
**Rejected:** Stateless tokens are simpler + sufficient for 7-day link lifetime.

---

## Consequences

### Positive

1. **Patient adoption:** email link is universally understood; no app download required.
2. **LGPD defensive:** no password storage + stateless tokens = minimal regulatory risk.
3. **Audit trail:** email delivery timestamp + link-click timestamp = proof of result communication (RDC 978 requirement).
4. **Cost:** Sendgrid (or Firebase email) + Twilio are cheap ($0.0005–0.001 per email); no session DB cost.

### Negative

1. **Link-click friction:** patients must check email + click link each time; not seamless (longer than persistent login).
2. **Email dependency:** if email delivery fails (Sendgrid down, spam filter), patient cannot access. Mitigation: add fallback SMS fallback in Phase 5 if needed.
3. **No token revocation:** if email link is leaked (forwarded to friend), friend can download patient laudo for 7 days. Mitigation: lab includes patient name in email body (warning: "if you didn't request this, contact lab").
4. **Session timeout friction:** custom token expires at 30 days; no refresh mechanism. Patient must re-request email link (minor inconvenience).

---

## Derived Commitments

1. **Phase 4 deliverables (Weeks 1–2):**
   - Cloud Function callables: 3 callables (generate link, verify token, download laudo).
   - Firestore schema + rules (`patients`, `laudos` read-only for patient role).
   - Sendgrid integration (or Firebase email fallback).
   - Email template (LGPD disclaimer + link).
   - E2E tests: 6 specs (generate link, verify token, download, token expiry, brute-force protection, mobile responsive).

2. **Phase 4 Configuration (Week 2):**
   - Sendgrid API key in Secret Manager (`SENDGRID_API_KEY`).
   - Email sender address (`PORTAL_EMAIL_FROM`) in `labSettings`.
   - Token TTL config (7 days, customizable per lab in Phase 5).

3. **Patient data onboarding (Weeks 2–3):**
   - RT UI: add patient to lab (`name`, `CPF`, `email`).
   - Bulk import: CSV script (`scripts/import-patients-from-csv.sh`) for Riopomba baseline.
   - Validation: CPF format, email format, no duplicates.

4. **Phase 4 Audit Trail:**
   - All link generations logged to `/labs/{labId}/audit-patient-portal`.
   - Token verification attempts (success + failure) logged.
   - Download events logged with timestamp + IP (for fraud detection).

5. **v1.4.1 LIS integration (future-proof schema):**
   - `Patient.lisId`, `Patient.lisVendor`, `Patient.syncedAt` fields already in schema.
   - v1.4.1 refactor: replace manual patient entry with LIS sync; email-link auth continues to work unchanged.

6. **Firestore Rules & Multi-tenant:**
   - `/labs/{labId}/patients`: RT-only access; patients cannot list.
   - `/labs/{labId}/patient-nps-feedback`: patient append-only; auditor can read.
   - `/labs/{labId}/laudos`: patient can read if patientId matches custom token.
   - Audit collection: RT + auditor can read; patients cannot.

---

## Links to Related ADRs & Phases

- **ADR-0012** — RDC 978 audit trail logical signature (HMAC token signing).
- **ADR-0015** — Patient Portal LIS Integration Deferral (v1.4 email-link, v1.4.1 LIS upgrade).
- **Phase 4** — Patient Portal Phase 1 (v1.4 roadmap).
- **Phase 5 (v1.4.1)** — LIS integration (future upgrade).
- **RDC 978 Arts. 166–180** — Comunicação de Resultados (statutory reference).
- **LGPD Arts. 8, 38** — Data subject consent + patient privacy (statutory reference).
- **DICQ 4.1.2.3** — Entrega de Laudos (DICQ mapping).

---

**ADR Status:** PROPOSED (2026-05-07)  
**Gate Review:** End of Phase 4 Week 2 (confirm email link generation + token verification working; 10+ patients onboarded).  
**Patient Testing:** Phase 4 Week 3 (test with 5 real patients from Riopomba; gather UX feedback).
