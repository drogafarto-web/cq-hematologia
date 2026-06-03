# ADR-0033: Portal-Paciente Privacy Model — Email Link Auth + Explicit Consent

**Date:** 2026-05-08  
**Status:** APPROVED  
**Phase:** Phase 4 (Portal-Paciente Wave 3.2)  
**Compliance:** LGPD Art. 9, 11, 13, 17; RDC 978 Art. 167; DICQ 4.3

---

## Problem Statement

Patients require secure, self-service access to their laboratory results and the ability to exercise LGPD rights (access, portability, deletion). Current system has no patient-facing portal; results are delivered via email with generic links (no authentication).

**Regulatory Drivers:**

- LGPD Art. 9: Explicit consent required before processing sensitive health data
- LGPD Art. 11: Right to data portability (download results in standard format)
- LGPD Art. 13: Right to access own data
- LGPD Art. 17: Right to deletion (with audit trail)
- RDC 978 Art. 167: Patient information delivery required in timely manner
- v1.4 Scope: Enable Portal-Paciente as patient entry point + LGPD compliance baseline

---

## Decision

Build a **Portal-Paciente (Patient Portal) with email-link authentication, explicit consent capture, and LGPD-compliant data export**:

1. **Authentication:** HMAC-signed email links (24h expiry), no patient account creation required
2. **Authorization:** Per-patient read access verified via email token in Firestore rules
3. **Consent Model:** Explicit opt-in before data processing (export, image OCR)
4. **Data Export:** XLSX + PDF via Cloud Function callable, email delivery with 7-day expiry
5. **Deletion:** Patient can revoke consent → blocks future access (with audit trail)
6. **Collections:**
   - `patient-consents/{patientId}/records` — Consent capture + revocation history
   - `patient-results/{patientId}/results` — Read-only copy of laudo metadata (no raw results stored)

---

## Rationale

### Why Email-Link Auth Instead of OAuth?

**Decision:** Stateless HMAC-signed email tokens (24h single-use) instead of patient account + OAuth.

**Rationale:**

- **Zero Friction:** Patient clicks link in email → auto-authenticated (no password creation)
- **Privacy:** No permanent patient account; identity verified via email possession only
- **Regulatory:** LGPD prefers "minimal data collection"; email link doesn't require password hash storage
- **Cost:** Stateless validation (HMAC check) vs. OAuth token persistence
- **Lab UX:** Lab staff send link via template; patient uses once, done

**Trade-off:** Token is per-email (not per patient); same patient with multiple email addresses requires multiple links. Acceptable for laboratory use case (patient addresses rarely change mid-treatment).

**HMAC Details:**

```
token = HMAC-SHA256(
  key=HCQ_SIGNATURE_HMAC_KEY,
  message=patientId + email + expiryTimestamp
)
expiry = now + 24h
```

Validated server-side in Firestore rules: `request.auth.customClaims.emailToken == computedToken`.

### Why Explicit Consent Before Data Export?

**Decision:** Show consent checkbox on export wizard step 1, require user action (not pre-ticked).

**Rationale:**

- **LGPD Art. 9:** Explicit consent for sensitive health data processing
- **Audit Trail:** Consent action logged with timestamp + email → non-repudiation
- **UX:** Patient sees "exporting your data" form; consent capture is integral (not hidden)
- **Compliance:** Meets LGPD requirement that consent is "explicit, clear, specific" (not inferred)

**Alternative (Rejected):** Pre-tick consent checkbox on export form → LGPD violation (consent must be affirmative action, not default).

### Why Per-Patient Reads?

**Decision:** Firestore rules allow patient read access to `patient-results/{patientId}/results` only (not other patients' data).

**Rationale:**

- **Multi-Tenant Safety:** Rules enforce isolation (patient A cannot read patient B's results)
- **Scalability:** Each patient gets own subcollection; no cross-patient queries
- **LGPD Audit:** Read access logged per patient (if access logs required in DPIA)

**Trade-off:** Requires duplicate storage of result metadata (laudo table + patient-results subcollection). Acceptable for laboratory scale (<10 million patients).

### Why Cloud Function for Data Export?

**Decision:** Export (XLSX + PDF generation) runs server-side via callable, not client-side.

**Rationale:**

- **Security:** Patient email verified server-side before export callable runs
- **Audit:** Export action creates immutable log entry (exportId, timestamp, email)
- **Compliance:** LGPD Art. 11 portability requirement satisfied with server-signed export hash
- **Performance:** Server can compress PDF + email async (not blocking patient browser)

**Alternative (Rejected):** Client-side export via SheetJS → patient email not re-verified; harder to audit deletion request compliance.

### Why Revoke Consent (Not Delete Data)?

**Decision:** `revokePatientConsent()` marks consent record as revoked (soft-delete), blocks future access (doesn't delete historical results).

**Rationale:**

- **LGPD Art. 17:** Right to deletion, but lab must preserve results for 5 years (RDC 978)
- **Compromise:** Patient can revoke consent for future access, but historical data preserved for regulatory audit
- **Audit Trail:** Revocation logged with timestamp (proves consent was withdrawn at specific time)

**Example:** Patient revokes 2023-05-08 → future portal access blocked, but results from 2022 retained in lab archives.

---

## Implementation

### Collections & Rules

**`patient-consents/{patientId}/records/{recordId}`**

```typescript
interface PatientConsent {
  patientId: string;
  recordId: string; // uuid v4
  email: string; // normalized lowercase
  consentGiven: Timestamp;
  consentRevoked?: Timestamp | null;
  scope: 'result-access' | 'export' | 'ocr-processing';
  ipAddress: string; // from request
  userAgent: string; // from request
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}
```

**Rules:**

- Read: Patient (via email token) OR Auditor (for DPIA audit)
- Create: Cloud Function `recordPatientConsent` only
- Update: Cloud Function `revokePatientConsent` only (append `consentRevoked`)
- Delete: Never (immutable audit trail)

**`patient-results/{patientId}/results/{resultId}`**

```typescript
interface PatientResult {
  patientId: string;
  resultId: string; // uuid v4
  laudoId: string; // reference to actual laudo
  nomeExame: string;
  resultado: string | number;
  unidade: string;
  dataColeta: Timestamp;
  dataResultado: Timestamp;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}
```

**Rules:**

- Read: Patient (via email token) with active consent
- Create: Cloud Function `sync_patientResults` (batch backfill)
- Update: Never
- Delete: Never (soft-delete only)

### Cloud Function Callables

**`recordPatientConsent(data)`**

- Input: `{ patientId, email, scope }`
- Output: Consent record
- Validation: Email token must be valid (24h window)
- Side-effect: Creates audit entry (writeAuditLog)

**`revokePatientConsent(data)`**

- Input: `{ consentRecordId }`
- Output: Updated consent record (with `consentRevoked`)
- Validation: Email token matches consent email
- Side-effect: Sets `patientResults` `deletadoEm` to now (soft-delete)

**`exportPatientData(data)`**

- Input: `{ patientId, format: 'xlsx' | 'pdf', email }`
- Output: Export task ID
- Validation: Active consent record exists, scope includes 'export'
- Side-effect:
  - Generate XLSX/PDF (Cloud Storage temporary file)
  - Send email with 7-day download link
  - Create audit entry with exportId + hash

### React Components

**PortalPacienteShell.tsx**

- Entry point: Shows "Enter your email" form if not authenticated
- Main: Result list, filter toolbar, export button

**AuthForm.tsx**

- Email input + submit
- Calls `validateEmailToken(token)` from URL params
- Error: "Invalid or expired link" with 24h retry hint

**ResultList.tsx**

- Query: `patient-results/{patientId}/results` (filtered by consent scope)
- Sort: Newest first
- Columns: Date, exam name, result, status (normal/critical/pending)
- Empty state: "No results available" or "You have not granted access to your results"

**ResultDetail.tsx**

- Full laudo view + reference ranges
- Actions: Add to export, revoke access
- Error: "You no longer have permission" if consent revoked between page loads

**ExportWizard.tsx** (4-step)

1. Confirm consent (checkbox: "I authorize HC Quality to export my data")
2. Select format (XLSX, PDF, or both)
3. Confirm email
4. Success: "Email sent; check inbox for download link (valid 7 days)"

**ConsentStatus.tsx**

- Shows: "Access granted [date]" or "Access revoked [date]"
- Button: "Revoke access" → confirmation dialog → POST to callable

### Hooks

**`usePatientAuth()`**

- Parse email token from URL
- Validate HMAC
- Store in sessionStorage (not localStorage; secure)
- Return: `{ patientId, email, isAuthenticated, error }`

**`usePatientResults(filters)`**

- Query: `patient-results/{patientId}/results`
- Filter: By date range, exam type
- Return: `[results, loading, error]`
- Auto-check consent on mount

**`useDataExport()`**

- State machine: idle → selecting → confirming → exporting → done
- Call: `exportPatientData` callable
- Track: Export task ID, email confirmation status

**`useConsentStatus()`**

- Query: `patient-consents/{patientId}/records` (active = `consentRevoked == null`)
- Return: `[isConsentActive, lastConsent, canRevoke]`
- Refresh: Every 5s (consent can be revoked in another tab)

### Tests (8 unit tests)

1. Email token validation (valid, expired, invalid)
2. Consent checkbox blocks export (unchecked → disabled button)
3. Data export wizard state machine
4. Consent revocation blocks future access
5. Result list filters by exam type
6. Error state: "Access revoked"
7. Email confirmation on export
8. E2E: Patient gets email → clicks link → views result → exports → revokes access

---

## Alternatives Considered

### 1. OAuth + Patient Account (Onboarding)

**Approach:** Patient creates account with username/password → OAuth token.

**Pros:** Standard authentication, persistent session  
**Cons:** Password management burden on patient, account recovery friction, requires PII storage (username at minimum)  
**Rejected:** LGPD prefers minimal data; email-link is stateless alternative.

### 2. Pre-Tick Consent Checkbox

**Approach:** Consent form has checkbox pre-ticked; patient unchecks to refuse.

**Pros:** Higher export completion rate  
**Cons:** LGPD violation (consent must be affirmative, not default); non-compliant  
**Rejected:** Regulatory risk outweighs UX benefit.

### 3. Patient Deletion (Hard Delete)

**Approach:** `revokePatientConsent()` calls `deleteDoc()` on all patient results.

**Pros:** GDPR-like "right to be forgotten"  
**Cons:** Violates RDC 978 (results must be retained 5 years); non-compliant  
**Rejected:** LGPD Art. 17 allows "deletion with exceptions"; RDC 978 is exception.

---

## Data Flow Diagram

```
Patient                        Portal-Paciente            Cloud Functions       Firestore
  |                                 |                           |                  |
  |------ email (result link) ------>|                           |                  |
  |                                 |                           |                  |
  |<----- redirect + token ---------|                           |                  |
  |                                 |                           |                  |
  |-- validate token ---->|         |                           |                  |
  |                       |         |                           |                  |
  |<---- render results --|<--------|-- recordPatientConsent -->|-- write consent -|
  |                                 |                           |                  |
  |-- click "export" ------>|        |                           |                  |
  |                        |--- captcha/consent --->|            |                  |
  |                        |        exportPatientData callable   |                  |
  |                        |        |---------- query results -->|                  |
  |                        |        |---------- generate XLSX -->|                  |
  |                        |        |---------- send email ----->|                  |
  |<---- "Check email" ----<--------|<---- write export log -----<-|                |
  |                                 |                           |                  |
  |-- email: download link -------->|                           |                  |
  |                                 |                           |                  |
  |-- revoke access ------>|        |                           |                  |
  |                        |--- revokePatientConsent --->|       |                  |
  |                        |        |-----------|---- write revoke ------>|        |
  |<---- "Access revoked" --|<------|<---- remove read access ---|        |
```

---

## Dependencies

- **ADR-0015:** Email link authentication design
- **ADR-0024:** HMAC-SHA256 token generation + validation
- **ADR-0028:** Advanced audit trail (cross-collection diffs)
- **Firestore Rules:** Helper `hasActivePatientConsent(patientId)`
- **Cloud Functions:** Node 22+, SheetJS for XLSX generation, nodemailer for email delivery

---

## Risks & Mitigations

| Risk                                      | Severity | Mitigation                                              |
| ----------------------------------------- | -------- | ------------------------------------------------------- |
| Email token leaked (shared link)          | Medium   | 24h expiry + single-use; regenerate per patient request |
| Patient revokes, then tries to access     | Medium   | Consent check on every read; fail-closed                |
| Export file leaked (7-day email link)     | Low      | HTTPS download only, unique token per email link        |
| LGPD audit: "consent not explicit enough" | Medium   | Checkbox capture + audit log with proof                 |

---

## Compliance Mapping

| LGPD Article | Requirement                         | Implementation                              |
| ------------ | ----------------------------------- | ------------------------------------------- |
| Art. 9       | Explicit consent for sensitive data | Checkbox on export wizard step 1            |
| Art. 11      | Portability right                   | exportPatientData callable returns XLSX/PDF |
| Art. 13      | Access right                        | Portal-Paciente shows all patient results   |
| Art. 17      | Deletion right                      | revokePatientConsent blocks future access   |

| RDC 978 Article | Requirement           | Implementation                        |
| --------------- | --------------------- | ------------------------------------- |
| Art. 167        | Patient info delivery | Portal-Paciente + email with 24h link |

---

## Success Criteria

- [x] Patient email auth works (token validation, 24h expiry)
- [x] Consent checkbox blocks export (unchecked = button disabled)
- [x] Data export generates valid XLSX + PDF
- [x] Consent revocation blocks portal access
- [x] 8 unit tests passing
- [x] 3 E2E specs passing (auth, export, revoke)
- [x] Zero LGPD compliance gaps (Art. 9/11/13/17 all covered)
- [x] Audit trail immutable (all consent/revoke/export logged)

---

## Sign-Off

| Role           | Name               | Date       |
| -------------- | ------------------ | ---------- |
| **Architect**  | CTO                | 2026-05-08 |
| **Compliance** | Legal/Privacy Lead | 2026-05-08 |
| **QA**         | Test Lead          | 2026-05-08 |

---

## References

- LGPD (Lei Geral de Proteção de Dados) Art. 9, 11, 13, 17
- RDC 978 Art. 167: Patient information delivery
- ADR-0015: Email link authentication
- ADR-0024: HMAC token design
- ADR-0028: Audit trail extensibility
