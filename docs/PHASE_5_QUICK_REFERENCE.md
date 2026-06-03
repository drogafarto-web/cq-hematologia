# Phase 5 Quick Reference

## Patient Portal — Implementation Cheat Sheet

**Print this and bookmark it.** Updated 2026-05-07.

---

## URLs & Routes

| Route                      | Purpose                        | Auth                 | Public?              |
| -------------------------- | ------------------------------ | -------------------- | -------------------- |
| `/paciente`                | Portal root (redirect to auth) | —                    | ✅ Yes               |
| `/paciente/auth?token=...` | Email link landing             | JWT token in query   | ✅ Yes               |
| `/paciente/laudos`         | Patient laudo list             | JWT token in Zustand | ✅ Yes (token-gated) |
| `/paciente/laudo/{id}`     | Laudo detail + download        | JWT token in Zustand | ✅ Yes (token-gated) |
| `/paciente/feedback`       | NPS form (optional modal)      | JWT token in Zustand | ✅ Yes (token-gated) |

---

## Cloud Function Callables (4 functions)

### 1. generatePatientAuthLink

```typescript
// Input
{
  labId: string,
  cpf: string,        // "12345678901"
  email?: string      // Optional (can be looked up)
}

// Output
{
  success: true,
  message: "Link enviado para email"
}

// Errors
PATIENT_NOT_FOUND | RATE_LIMIT_EXCEEDED | EMAIL_SEND_FAILED

// Rate limit
3 links per patient per day

// Token expiry
72 hours (259200 seconds)
```

### 2. verifyPatientAuthToken

```typescript
// Input
{
  token: string
}

// Output
{
  valid: true,
  patientId: string,
  labId: string,
  expiresAt: Date
}

// Errors
INVALID_TOKEN | PATIENT_INACTIVE | EXPIRED
```

### 3. generatePatientLaudoPDF

```typescript
// Input (client context)
{
  patientId: string,
  labId: string,
  laudoId: string
}

// Output
{
  success: true,
  downloadUrl: "https://...",  // GCS signed URL (1h expiry)
  expiresAt: "2026-05-08T...",
  filename: "Resultado_abc123_v1.pdf"
}

// Errors
PERMISSION_DENIED | LAUDO_NOT_FOUND | PDF_GENERATION_FAILED

// Audit
Logged to /labs/{labId}/patient-downloads
```

### 4. submitPatientFeedback

```typescript
// Input
{
  patientId: string,
  laudoId: string,
  labId: string,
  npsScore: number,           // 0–10
  satisfaction: string,       // 'very_satisfied' | 'satisfied' | ...
  comment: string,            // max 500 chars
  timeOnPortal: number        // milliseconds
}

// Output
{
  success: true,
  feedbackId: string
}

// Errors
INVALID_NPS | PERMISSION_DENIED

// Audit
Logged to /labs/{labId}/patient-feedback
```

---

## Firestore Collections (Phase 5 additions)

### /labs/{labId}/patients

```
{
  name: string,
  dateOfBirth: Timestamp,
  cpf: string (SHA-256 hash),
  email: string (encrypted),
  status: 'active' | 'inactive',
  createdAt: Timestamp,
  deletadoEm: Timestamp | null
}
```

### /labs/{labId}/patient-auth-events (immutable, append-only)

```
{
  patientId: string,
  action: 'LINK_GENERATED',
  createdAt: Timestamp,
  ipAddress: string (anonymized)
}
```

### /labs/{labId}/patient-downloads (immutable, append-only)

```
{
  patientId: string,
  laudoId: string,
  action: 'PDF_GENERATED',
  downloadedAt: Timestamp,
  ipAddress: string (anonymized),
  userAgent: string
}
```

### /labs/{labId}/patient-feedback (immutable, append-only)

```
{
  patientId: string,
  laudoId: string,
  npsScore: number,
  satisfaction: string,
  comment: string,
  createdAt: Timestamp
}
```

### /labs/{labId}/portal-configuracao (existing, extended)

```
{
  patientPortalEnabled: boolean,
  branding: {
    logoUrl: string,
    primaryColor: string,
    footerText?: string
  },
  emailTemplate: {
    senderName: string,
    subject: string
  }
}
```

---

## Key Files to Create/Modify

### Functions

```
functions/src/patient-portal/
├── generatePatientAuthLink.ts
├── verifyPatientAuthToken.ts
├── generatePatientLaudoPDF.ts
├── submitPatientFeedback.ts

functions/src/shared/templates/
├── patientAuthEmail.ts        # Email template
├── patientLaudoHTML.ts        # PDF HTML template

functions/src/index.ts         # Register all 4 callables
```

### Web Components

```
src/features/patient-portal/
├── components/
│   ├── PatientAuthForm.tsx
│   ├── PatientAuthPage.tsx
│   ├── PatientLaudoList.tsx
│   ├── PatientLaudoView.tsx
│   ├── FeedbackForm.tsx
│   ├── LGPDNotice.tsx
│   ├── PrivacyPolicyModal.tsx
│   ├── PatientPortalHeader.tsx

├── hooks/
│   ├── usePatientAuthStore.ts  # Zustand
│   ├── usePatientLaudos.ts
│   ├── useLabPortalBranding.ts

├── services/
│   ├── patientAuthService.ts
│   ├── patientLaudoService.ts

├── pages/
│   ├── PatientAuthPage.tsx
│   ├── PatientLaudosListPage.tsx
│   ├── PatientLaudoDetailPage.tsx

├── types/
│   └── index.ts

├── PatientPortalApp.tsx
└── CLAUDE.md
```

### Tests

```
src/__tests__/e2e/
└── patient-portal.spec.ts     # 6 E2E specs
```

### Security Rules

```
firestore.rules                # Add patient collection rules (append-only)
```

---

## Zustand Store (usePatientAuthStore)

```typescript
const usePatientAuthStore = create((set, get) => ({
  token: null, // JWT token
  patientId: null, // UUID
  labId: null, // Lab ID
  expiresAt: null, // Timestamp

  setAuth: (token, patientId, labId, expiresAt) => {
    localStorage.setItem('patient_auth_token', token);
    set({ token, patientId, labId, expiresAt });
  },

  clearAuth: () => {
    localStorage.removeItem('patient_auth_token');
    set({ token: null, patientId: null, labId: null, expiresAt: null });
  },

  isTokenExpired: () => new Date() > (get().expiresAt || new Date(0)),
}));
```

---

## Email Template (Plain Text)

```
Subject: Acesso ao seu resultado — HC Quality Laboratorial

Olá {patient.name},

Clique no link abaixo para acessar seu resultado de laboratório:

[BOTÃO] Acessar Resultado
https://hmatologia2.web.app/paciente/auth?token={JWT}

Este link expira em 72 horas.

---
Laboratório: {lab.name}
Telefone: {lab.phone}
Email: {lab.email}

Perguntas sobre seu resultado? Entre em contato com nosso laboratório.
```

---

## QR Code Data (in PDF)

```json
{
  "laudoId": "laudo-abc123",
  "versionId": "version-xyz789",
  "signatureHash": "abcdef0123456789", // Last 32 chars of signature
  "generatedAt": "2026-05-08T14:30:00Z"
}
```

---

## Firestore Security Rules (Snippet)

```firestore
// Patient auth events — append-only
match /labs/{labId}/patient-auth-events/{eventId} {
  allow create: if true;  // CF creates
  allow read: if isAdminOrOwner(labId);
  allow update, delete: if false;
}

// Patient downloads — append-only
match /labs/{labId}/patient-downloads/{downloadId} {
  allow create: if true;  // CF creates
  allow read: if isAdminOrOwner(labId);
  allow update, delete: if false;
}

// Patient feedback — append-only
match /labs/{labId}/patient-feedback/{feedbackId} {
  allow create: if true;  // CF creates
  allow read: if isAdminOrOwner(labId);
  allow update, delete: if false;
}

// Portal branding — public read
match /labs/{labId}/portal-configuracao {
  allow read: if true;
  allow write: if isAdminOrOwner(labId);
}
```

---

## Environment Variables (Functions)

```bash
# In firebase:secrets:set

PATIENT_PORTAL_SECRET=<random-hex-string-64-chars>
RESEND_API_KEY=<resend-api-key>
```

Verify with:

```bash
bash scripts/preflight-secrets-check.sh
```

---

## Testing Checklist (Wave 1)

- [ ] `npm test -- patient-portal` (callables + services)
- [ ] `npm test -- firestore/rules` (Firestore rules)
- [ ] Type-check: `npx tsc --noEmit`
- [ ] Build functions: `cd functions && npm run build`
- [ ] Emulator test: `firebase emulators:start --only functions,firestore`

---

## Testing Checklist (Wave 2)

- [ ] `npm run test:e2e:portal` (all 6 specs)
- [ ] `npm test -- patient-portal` (components + hooks)
- [ ] Lighthouse audit: ≥80 (mobile)
- [ ] Mobile responsive: 375px viewport (no horizontal scroll)
- [ ] Manual smoke tests (all 7 steps in § 13.2)

---

## Deployment Sequence

**Order matters:**

1. `firebase deploy --only firestore:rules,firestore:indexes`
2. `firebase deploy --only functions:generatePatientAuthLink`
3. `firebase deploy --only functions:verifyPatientAuthToken`
4. `firebase deploy --only functions:generatePatientLaudoPDF`
5. `firebase deploy --only functions:submitPatientFeedback`
6. `firebase deploy --only hosting`

**After each step:** Check `firebase functions:log` for errors.

---

## Monitoring (Post-Deploy)

```bash
# Live logs
firebase functions:log --follow --project hmatologia2

# Firestore document count (patient data validation)
curl -s "https://firestore.googleapis.com/v1/projects/hmatologia2/databases/(default)/documents/labs" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" | jq

# GCS signed URL health
# (Test manually: curl -I ${signedUrl} → expect 200 OK)

# Email delivery metrics
# (Check Resend dashboard for failures)
```

---

## Common Errors & Fixes

| Error                   | Cause              | Fix                                     |
| ----------------------- | ------------------ | --------------------------------------- |
| `PATIENT_NOT_FOUND`     | CPF not in system  | Pre-seed patient data or CSV import     |
| `RATE_LIMIT_EXCEEDED`   | 3+ links/day       | Manual override via admin callable      |
| `INVALID_TOKEN`         | Malformed JWT      | User re-enters CPF, gets new link       |
| `EXPIRED`               | Token > 72h old    | User re-enters CPF, gets new link       |
| `PERMISSION_DENIED`     | Token scoped wrong | Verify token contains correct patientId |
| `PDF_GENERATION_FAILED` | Puppeteer timeout  | Increase CF timeout to 120s, retry      |
| `EMAIL_SEND_FAILED`     | Resend API down    | Use admin callable as fallback          |

---

## RN-\* (Business Rules) Quick Refs

| Rule   | What                  | Where                                      |
| ------ | --------------------- | ------------------------------------------ |
| RN-P01 | Patient-only access   | Service guards (patientId check)           |
| RN-P02 | 72h token expiry      | JWT issued in CF                           |
| RN-P03 | Rate-limit 3/day      | CF checks before issuing                   |
| RN-P04 | Immutable audit trail | Append-only collections (no updates)       |
| RN-P05 | No PII in logs        | Logs use ID only, anonymized IP            |
| RN-P06 | LGPD privacy notice   | LGPDNotice component on auth page          |
| RN-P07 | Soft delete only      | Patient.status = 'inactive' (no deleteDoc) |

---

## Handoff Checklist (Wave 1 → Wave 2)

- [ ] All 4 callables tested in emulator
- [ ] Functions type-check clean
- [ ] Firestore rules finalized + tested
- [ ] Patient CSV import script ready (Riopomba)
- [ ] Email templates reviewed + approved
- [ ] Secrets deployed (PATIENT_PORTAL_SECRET, RESEND_API_KEY)
- [ ] Service + hook layer complete
- [ ] README updated (repo onboarding)
- [ ] CLAUDE.md in patient-portal/ module checked in

---

## Key Contacts / Questions?

- **ADR:** ADR-0015 (Patient Portal Email-Link Auth v1.4) — full decision context
- **Plan:** PHASE_5_DETAILED_PLAN.md (15 pages, all specs)
- **Checklist:** PHASE_5_EXECUTION_CHECKLIST.md (170 tasks)
- **Module CLAUDE:** src/features/patient-portal/CLAUDE.md (rules + gotchas)

---

**Printed Version:** May 7, 2026  
**Keep on desk during implementation.** Update as you discover gotchas.
