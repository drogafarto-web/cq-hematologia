---
phase: 5
title: "Patient Portal Phase 1 — Research & Feature Breakdown"
period: "2026-05-21 → 2026-06-03 (2 weeks, Weeks 4–5)"
owner: "Stream B (Frontend Lead)"
objective: "Define patient portal architecture, UX flows, integration points, and wave structure for implementation"
status: RESEARCH
---

# Phase 5 RESEARCH — Patient Portal Phase 1

**Strategic Context:** Phase 5 launches read-only patient portal (laudo download + NPS feedback) following CAPA closure (Phase 4) and concurrent with critical values module (Phase 6). Patient portal is high-value feature enabling external feedback loop while maintaining RDC 978 + DICQ compliance.

**Duration:** 2 weeks (2026-05-21 → 2026-06-03, Weeks 4–5)  
**Owner:** Stream B (Frontend Lead) + 1 Backend Engineer  
**Success:** All 5 requirements (REQ-5.1 through REQ-5.6) mapped to delivery waves + integration points locked  
**Output:** Phase 5 PLAN.md ready for execution (gsd-plan-phase)

---

## 1. Feature Breakdown (REQ-5.x)

Phase 5 spans 6 distinct requirements per v1.4-ROADMAP Phase 5 section:

### REQ-5.1: Public Portal URL + Subdomain/Path Strategy

**User story:** As a patient, I want a dedicated, self-contained portal where I can securely access my laudo results without needing a lab account.

**Scope:**
- Separate subdomain (`patient.hmatologia2.web.app`) OR public path (`hmatologia2.web.app/paciente`)
- Independent from main HC Quality app (separate Firebase Hosting deployment or reuse main hosting with routing)
- Public (no auth required to land on portal; auth required to download/view)
- Dark-first design (consistent with v1.3 design system)
- Mobile-first responsive (tablet + phone tested)

**Decision required:** Subdomain vs. path? 
- **Subdomain pros:** Clean separation, independent analytics, easier credential/CORS scoping
- **Subdomain cons:** Requires DNS CNAME + separate SSL cert (Firebase handles via *.web.app wildcard)
- **Path pros:** Single hosting deployment, shared infrastructure, simpler deploy
- **Path cons:** URL longer, potential for confusion with main app routing

**Recommendation:** Use path (`/paciente`) for Phase 5 (lower infra complexity). v1.5 can extract to subdomain if branding/separation demanded.

**Acceptance criteria:**
- ✅ Portal accessible at public URL (production + staging both tested)
- ✅ Routing doesn't conflict with main app routes
- ✅ Separate metadata: SEO title/description for portal (vs. main app)
- ✅ HTTPS enforced (Firebase Hosting default)

---

### REQ-5.2: Laudo Download (PDF + QR + Audit Log)

**User story:** As a patient, I want to download my laudo as PDF, with a QR code I can share with my doctor for verification.

**Scope:**
- Extend `generateLaudoPDF` from Phase 3.3 export module (reuse callable if possible)
- PDF includes:
  - Patient name, DOB, CPF (last 4 digits only — privacy), test date
  - All results (analyte, value, reference range, interpretation)
  - Lab signature (RT or director per lab policy)
  - QR code (links to: `https://hmatologia2.web.app/verify?laudo_id=XXX&hash=YYY`)
  - Lab branding (colors, logo from `portal-configuracao`)
  - Footer: "Downloaded by patient on DATE via HC Quality Portal"
- Audit log: Each download recorded in `patient-portal-events` (patient ID, timestamp, laudo ID, no PII in log)
- TTI (Time to Interactive): <2s on tablet (real 4G network, mid-range tablet)
- Expiry: Laudo available for download 48h from result posting (configurable per lab)

**Technical decisions:**
- PDF generation: Reuse Puppeteer CF from Phase 3.3 export module (cost savings, proven pattern)
- QR code library: `qrcode` npm package (client-side generation) or CF-side (simpler, no network RTT for QR)
- Link format: Stateless verification (hash = HMAC-SHA256(laudo_id + patient_cpf + timestamp, secret key))
- Audit storage: Firestore doc `/labs/{labId}/patient-portal-events/{eventId}` (append-only, soft-delete never)

**Acceptance criteria:**
- ✅ PDF generated <500ms (p99) via CF callable
- ✅ QR code valid + scannable (tested on iPhone + Android)
- ✅ Link verification working (hash validation, expiry check)
- ✅ Audit log 100% coverage (zero untracked downloads)
- ✅ Page load <2s TTI (measured on Lighthouse + real tablet)
- ✅ 100 test downloads with 0 failures

---

### REQ-5.3: Patient Authentication (Email-Link Flow)

**User story:** As a patient, I want to authenticate securely using an email link sent to my registered email, without needing to remember a password.

**Scope:**
- **Per ADR-0015:** Email-link auth (defer LIS integration to v1.4.1)
- Patient lookup: By CPF or Patient ID (lab-assigned number)
- Flow:
  1. Patient lands on portal, sees "Enter your CPF or Patient ID"
  2. Enters CPF (validated format: 11 digits, no special chars)
  3. System checks `/labs/{labId}/patients/{patientId}` for matching record
  4. If found: Generates signed JWT (exp: 72h), sends email with link
  5. Patient clicks link → authenticated session created (scoped to patient record)
  6. Session: Can download own laudos + submit NPS only (no access to other patients)
  7. Session expires: After 72h OR explicit logout

**Patient data source (v1.4):**
- Manual entry: RT adds patients via admin UI (`/admin/manage-patients`)
- CSV import: `scripts/import-patients-csv.sh` (bulk-load; validates CPF, email format)
- Schema: `/labs/{labId}/patients/{patientId}` with fields: name, dateOfBirth, cpf (hashed), email, status ('manual' | 'synced')

**Email template:**
- Subject: "Acesse seus resultados — HC Quality" 
- Body: Plain text + HTML (dark-first, lab logo, expiration warning)
- Link: `https://hmatologia2.web.app/paciente/autenticar?token=JWT_TOKEN`
- Fallback: Text-only for accessibility

**Acceptance criteria:**
- ✅ CPF validation working (format check, duplicate prevention)
- ✅ Email sent <5s from request (verify via SendGrid/Resend logs)
- ✅ Token verification working (JWT signature, expiry, scoped to patient)
- ✅ Session management (token refresh if needed, explicit logout)
- ✅ E2E test: email-link flow end-to-end (generate link → receive → click → authenticated)
- ✅ Mobile: Email link works on mobile (iOS Mail, Gmail, Outlook)

**Optional Phase 5.1 (if time permits):**
- Patient self-service account creation (email + name + CPF matching against admin-seeded list)
- Password fallback (if email delivery fails; time-limited)
- Remember device (30-day cookie option)

---

### REQ-5.4: NPS/Feedback Form

**User story:** As a patient, I want to provide feedback on my laudo experience and rate lab service quality (NPS score).

**Scope:**
- Simple form after laudo download:
  - "How satisfied are you with your result? (1–10 NPS scale)"
  - "Any feedback? (optional, 500-char max textarea)"
  - "May we contact you about improvements? (checkbox, optional)"
  - Email field pre-populated from auth session
- Submission:
  - Data saved to `/labs/{labId}/satisfacao/paciente-nps/{docId}` (extends v1.3 satisfacao module)
  - Timestamp + patient ID (no PII in feedback log per LGPD)
  - Anonimization: After 90d, PII fields zeroed (cron job running daily)
- Trending:
  - Phase 7 (Satisfação module) aggregates NPS → monthly dashboard
  - Wordcloud of feedback sentiment (Phase 7 integrates Gemini for sentiment classification)

**Acceptance criteria:**
- ✅ Form renders after laudo download (or as separate link in portal)
- ✅ NPS data persisted + accessible to admin dashboard
- ✅ Anonimization cron tested (verify PII zeroed after 90d)
- ✅ E2E test: submit NPS → data appears in trending dashboard (next phase)
- ✅ Mobile: Form responsive on phone (single-column, large touch targets)

---

### REQ-5.5: Portal Branding (Portal-Configuracao Integration)

**User story:** As a lab director, I want to customize the patient portal appearance with our lab's logo, colors, and messaging, so it feels branded and professional.

**Scope:**
- Admin UI for portal branding (`/admin/portal-branding`):
  - Upload lab logo (SVG or PNG, auto-resize to 200x80px)
  - Set primary + secondary colors (color picker UI, hex validation)
  - Customize labels ("Resultado" → "Resultado de Exame", etc.)
  - Rich-text editor for Terms of Service + Privacy Policy HTML
- Portal UI applies branding:
  - Header: Logo + lab name
  - Buttons: Primary color
  - Links: Secondary color
  - Footer: Custom terms/privacy
- Storage: `/labs/{labId}/portal-configuracao/{configId}` (one per lab)
- Fallback: System defaults if no custom config provided

**Acceptance criteria:**
- ✅ Admin portal-branding UI working (upload, color picker, text editor)
- ✅ Portal applies branding correctly (colors, logo, labels)
- ✅ Responsive logo rendering (scales on mobile)
- ✅ Fallback styling applied if config missing
- ✅ E2E: Admin customizes branding → patient sees it in portal

---

### REQ-5.6: LGPD Disclaimers + Privacy Widget

**User story:** As a compliance officer, I want patient portal to display clear LGPD disclaimers and link to privacy policy, so we satisfy privacy regulation and patient transparency requirements.

**Scope:**
- Disclaimer banner (always visible on portal):
  - "Your data is protected. See our privacy policy." (with link)
  - Dismissible (user can close, re-appears on next session)
- Footer privacy widget:
  - Link to full privacy policy (from `portal-configuracao.privacyHTML`)
  - Link to data download request (triggers external portal or form)
  - Link to data deletion request (triggers LGPD module, Phase 11)
  - "Last updated: DATE" (auto-populated from config timestamp)
- Acceptance checkbox:
  - Optional on NPS form: "I consent to my feedback being used to improve service"
  - If checked: Timestamp + consent recorded in satisfacao log
- Regulatory references:
  - "LGPD Art. 7 (Consentimento)" + "RDC 978 (Confidencialidade)"

**Acceptance criteria:**
- ✅ LGPD banner displays on portal landing + result pages
- ✅ Privacy policy link working + content accessible
- ✅ Consent tracking (opt-in recorded with timestamp)
- ✅ Links to LGPD module for data requests (v1.4 Phase 11)
- ✅ Audit trail: User acceptance of privacy policy logged
- ✅ E2E: Accept privacy → verify logged in satisfacao audit

---

## 2. UX Flows (Patient Journey)

### Happy Path: Patient Downloads Laudo + Submits NPS

```
1. Patient receives email from lab:
   "Your result is ready — download via secure link"
   
2. Patient clicks link → Portal landing page:
   - Header: Lab logo + "Access Your Results"
   - Form: "Enter your CPF or Patient ID"
   - LGPD banner: "Your data is protected. See policy."
   
3. Patient enters CPF → clicks "Send Link" button:
   - System validates CPF format
   - Searches /labs/{labId}/patients for match
   - Generates JWT token (72h expiry)
   - Sends email with auth link
   - UI shows: "Check your email for access link (expires in 72h)"
   
4. Patient opens email → clicks "View Your Results" link:
   - URL: `https://...web.app/paciente/autenticar?token=JWT`
   - Token validated (signature, expiry, patient scope)
   - Session created (HttpOnly cookie or localStorage with SameSite)
   - Redirects to: `/paciente/resultados` (authenticated)
   
5. Portal displays laudo list:
   - Patient's name + DOB (last 4 digits)
   - List of available laudos (date, test type, status)
   - Filters: Date range, test type (if multiple tests)
   - Branding applied: Lab logo, colors, custom labels
   - LGPD footer: Links to privacy + data requests
   
6. Patient clicks laudo → Detail view:
   - Results displayed: Analyte, Value, Reference Range, Interpretation
   - Lab signature visible (RT or director)
   - Download button: "Download PDF"
   - QR code preview: "Share this code with your doctor"
   
7. Patient clicks "Download PDF":
   - Callable triggered: generateLaudoPDF(laudo_id, patient_id)
   - PDF generated (includes lab branding + QR code)
   - Download starts
   - Audit logged: patient_id, laudo_id, timestamp
   - (No PII in log; only IDs + action)
   
8. Patient sees optional NPS form:
   - "How satisfied are you? (1–10)"
   - "Feedback? (optional)"
   - Checkbox: "Consent to feedback use"
   - Submits → data saved to satisfacao collection
   
9. Portal shows thank-you message:
   - "Thank you! Your feedback helps us improve."
   - Logout button / "Download another result"
   - Session expires after 72h (or explicit logout)
```

### Alternative: Patient ID Lookup (if CPF not registered)

```
1. Patient enters CPF → "Patient not found in our system"
2. Patient tries Patient ID instead (lab-assigned number)
3. System matches against /labs/{labId}/patients doc ID
4. Rest of flow proceeds as normal
```

### Admin Flow: Import Patients via CSV

```
1. Lab RT opens admin dashboard → "Manage Patients"
2. Clicks "Import from CSV"
3. Uploads file with columns: name, cpf, email, dateOfBirth
4. System validates each row:
   - CPF format (11 digits, checksum)
   - Email format
   - No duplicates (existing patients skipped)
5. Preview shows: "500 rows valid, 2 duplicates skipped"
6. Clicks "Import" → batch writes to /labs/{labId}/patients
7. Success message: "500 patients imported"
8. Admin can now send email campaigns or manual links to patients
```

---

## 3. Integration Points (Dependencies)

### 3.1 Schema Dependencies (Phase 3 ✓)

All required collections exist post-Phase 3:

| Collection | Phase 3 Status | Phase 5 Usage |
|---|---|---|
| `/labs/{labId}/portal-configuracao` | ✓ Created | Portal branding (colors, logo, terms) |
| `/labs/{labId}/patients` | ✓ Created (empty, seeded by Phase 5) | Patient auth lookup, CPF matching |
| `/labs/{labId}/patient-portal-events` | ✓ Created | Audit log (downloads, auth attempts) |
| `/labs/{labId}/laudos` | ✓ Exists from v1.3 | Source data for download |
| `/labs/{labId}/satisfacao/paciente-nps` | ✓ Exists | NPS feedback storage |

**Decision:** No schema changes needed in Phase 5. All collections exist post-Phase 3.

---

### 3.2 Cloud Function Dependencies

**Phase 5 requires 2 new callables + 1 cron:**

1. **`generatePatientAuthLink` callable** (new in Phase 5):
   - Input: labId, cpf (or patientId)
   - Process:
     - Lookup patient in `/labs/{labId}/patients`
     - Generate JWT token (exp: 72h)
     - Send email via Resend/SendGrid
   - Output: `{ success, emailSent, expiresIn72h }`
   - Error handling: Patient not found, email send failed
   
2. **`generateLaudoPDF` callable** (reuse Phase 3.3 if available):
   - Extend signature: `generateLaudoPDF(laudo_id, patient_id, branded=true)`
   - If `branded=true`: Load `/labs/{labId}/portal-configuracao` + apply colors/logo
   - If `branded=false`: Use standard template (for internal export)
   - Output: PDF blob URL (cloud storage public link, 48h expiry)
   - Audit: Log download to `/patient-portal-events`

3. **`anonimizarFeedback` cron** (Phase 5 → extends Phase 7):
   - Runs daily at 02:00 UTC
   - Queries `/labs/{labId}/satisfacao/paciente-nps` where `createdAt < 90d ago`
   - Zeros PII fields: `email` → null, feedback text → "*ANONIMIZADO*"
   - Keeps: `nps_score`, `createdAt`, `anonimizedAt` timestamp
   - Audit: Logs anonimization to separate collection (`anonimizacao-log`)

---

### 3.3 Rules Dependencies (Firestore Security Rules)

**Phase 5 rules additions:**

```
// Patient portal reads (public portal path)
match /labs/{labId}/patients/{patientId} {
  allow read: if request.auth == null; // Patient lookup (CPF check)
  allow write: if isAdminOrOwner(request.auth.uid, labId);
}

match /labs/{labId}/laudos/{laudoId} {
  allow read: if isAuthenticatedPatient(request.auth.uid, laudoId);
  // (Scoped: patient can only read their own laudo)
}

match /labs/{labId}/patient-portal-events/{eventId} {
  allow read: if isAdminOrOwner(request.auth.uid, labId);
  allow write: if false; // Append-only via CF callable
}

match /labs/{labId}/portal-configuracao/{configId} {
  allow read: if true; // Public config (used by unauthenticated portal)
  allow write: if isAdminOrOwner(request.auth.uid, labId);
}
```

---

### 3.4 Export Module Integration (Phase 3.3)

Phase 5 should **reuse** `generateLaudoPDF` callable from Phase 3.3 export module if already deployed:

- **Argument:** Extend to accept `includeQRCode` + `brandingConfig` parameters
- **Benefit:** Code reuse, proven PDF generation (Puppeteer works), single source of truth
- **Risk:** If Phase 3.3 not complete by Phase 5 start (Week 4), Phase 5 blocked → needs contingency

**Contingency:** If Phase 3.3 delayed, Phase 5 implements standalone `generateLaudoPDF` for portal only (can merge with export module after Phase 3.3 completes).

---

### 3.5 RDC 978 + DICQ Compliance Mapping

| Requirement | Phase 5 Coverage | Regulation |
|---|---|---|
| Patient privacy + data minimization | NPS anonimization, CPF hashing | LGPD Art. 7 |
| Audit trail of downloads | patient-portal-events collection | RDC 978 Art. 167 |
| Document retention (laudo) | Laudos stored per module, 5-year policy (Phase 3) | RDC 978 Art. 115 |
| Laudo mandatory fields (14 per Art. 167) | Portal displays all 14 fields from laudo record | RDC 978 Art. 167 |
| Patient feedback loop | NPS form + trending dashboard (Phase 7) | DICQ 4.14.3 (Realimentação) |
| Document control (terms/privacy versioning) | portal-configuracao versioning + audit | DICQ 4.3 (Hierarquia) |

---

## 4. Wave Structure (Delivery Plan)

Phase 5 spans 2 weeks (Weeks 4–5). Deliver in 2 waves:

### Wave 1 (Week 4, Days 1–4): Portal Foundation + Auth

**Goals:**
- Patient portal UI scaffold (responsive, dark-first)
- Email-link auth flow (token generation + email send)
- Patient data seeding (CSV import for Riopomba)
- Firestore rules + audit collection setup

**Deliverables:**
- `src/features/patient-portal/` module (components: landing, auth-form, result-list, detail-view)
- `generatePatientAuthLink` callable (tested locally + staging)
- Patient CSV import script (`scripts/import-patients-csv.sh`)
- `/labs/{labId}/patient-portal-events` collection + rules deployed
- E2E test: 2 specs (auth link send, token verification)

**Exit criteria:**
- ✅ Portal accessible at `staging.hmatologia2.web.app/paciente`
- ✅ Auth flow working (generate link → email sent → token verified)
- ✅ 500+ test patients imported via CSV
- ✅ Rules audit passed (no public write, patient-scoped reads)

---

### Wave 2 (Week 5, Days 5–10): Download + Branding + NPS

**Goals:**
- PDF download (reuse Phase 3.3 callable or standalone implementation)
- QR code integration + link verification
- Portal branding (logo, colors, custom labels)
- NPS feedback form + anonimization setup
- E2E testing + mobile responsiveness

**Deliverables:**
- `generateLaudoPDF` callable (branded version with QR code)
- QR code verification endpoint (stateless hash check)
- Portal branding admin UI (`/admin/portal-branding`)
- NPS form component + satisfacao integration
- `anonimizarFeedback` cron job (staging test)
- E2E tests: 4 specs (PDF download, QR verify, NPS submit, mobile responsive)

**Exit criteria:**
- ✅ Laudo downloads working (<2s TTI on tablet)
- ✅ QR code scans correctly (tested on iOS + Android)
- ✅ Admin can customize portal branding + changes live immediately
- ✅ NPS data persisted + visible in admin dashboard
- ✅ Anonimization running daily (verified in staging logs)
- ✅ 100 test downloads with 0 failures
- ✅ WCAG AA compliance (lighthouse report >85)

---

## 5. Effort Estimation

**Based on v1.4-ROADMAP Phase 5: "2 weeks, Stream B (frontend) + 1 backend"**

### Wave 1 Effort (Auth + Foundation)

| Task | Owner | Points | Duration |
|---|---|---|---|
| Portal UI scaffold (landing, auth form, result list) | Frontend | 8 | 2d |
| Email-link generation + Resend integration | Backend | 5 | 1d |
| Patient CSV import script + validation | Backend | 4 | 1d |
| Firestore rules audit + setup | Backend | 3 | 0.5d |
| E2E auth tests (2 specs) | QA | 3 | 0.5d |
| **Wave 1 Total** | | **23 pts** | **~5d** |

### Wave 2 Effort (Download + Branding + NPS)

| Task | Owner | Points | Duration |
|---|---|---|---|
| PDF download callable (reuse Phase 3.3 if available, else standalone) | Backend | 8 | 1.5d |
| QR code generation + verification | Backend | 4 | 1d |
| Portal branding admin UI (logo upload, color picker) | Frontend | 6 | 1.5d |
| Portal branding application (dynamic styling) | Frontend | 5 | 1d |
| NPS feedback form + satisfacao integration | Frontend | 5 | 1.5d |
| Anonimization cron job setup | Backend | 3 | 0.5d |
| Mobile responsiveness testing | QA | 3 | 0.5d |
| E2E tests (4 specs: PDF, QR, NPS, mobile) | QA | 4 | 1d |
| **Wave 2 Total** | | **38 pts** | **~8d** |

**Phase 5 Total: ~61 pts over 10 days (2 weeks, assuming 5 engineer days/week)**

---

## 6. Technical Architecture Decisions

### 6.1 Client-Side vs. Server-Side PDF Generation

**Decision:** Use Cloud Function callable (Puppeteer) from Phase 3.3 export module.

**Rationale:**
- Puppeteer proven in v1.3 export module (20+ daily PDFs working)
- Complex HTML→PDF (branding, QR code, lab signature) better handled server-side
- Client-side libraries (jsPDF, html2pdf) have quality/rendering issues with dark theme
- QR code: Server-side generation ensures consistency + determinism

**Fallback:** If Phase 3.3 callable not available by Phase 5 start, use `qrcode` npm + jsPDF (degraded quality, but functional).

---

### 6.2 Email Service (Resend vs. SendGrid)

**Decision:** Use Resend (already integrated in HC Quality for NOTIVISA/templates).

**Rationale:**
- Already deployed in functions (v1.3)
- React Email templates supported (dark-mode friendly)
- Simple rate limits (100 req/s sufficient)
- Cost: $1/10k emails (cheap for patient portal scale)

**Fallback:** SendGrid + nodemailer if Resend unavailable.

---

### 6.3 Token Strategy (JWT vs. Firebase Session)

**Decision:** Signed JWT (custom implementation) for email-link auth.

**Rationale:**
- Email-link auth is stateless (no server-side session store needed)
- JWT expires after 72h (soft expiry; allow re-request at any time)
- Scope: Patient ID + lab ID encoded in JWT payload
- Signature: HMAC-SHA256(payload, secret key) prevents tampering
- Session storage: HttpOnly cookie (secure, not accessible to JS malware)

**Alternative rejected:** Firebase Auth custom claims (overkill for read-only access; adds complexity).

---

### 6.4 Patient Lookup (CPF vs. Patient ID)

**Decision:** Support both CPF + Patient ID for flexibility.

**Rationale:**
- CPF: User-friendly (patients know their CPF); privacy concern if exposed in URL
- Patient ID: Lab assigns; can be anonymous barcode or MRN; simpler if printed on test requisition
- Implementation: Accept either in form; query `/labs/{labId}/patients` by both fields (separate indexes)

**Rules:** CPF stored hashed (one-way) + salted to prevent rainbow table attacks.

---

### 6.5 Portal Subdomain vs. Path

**Decision for Phase 5:** Use path (`/paciente`) for simplicity.

**Rationale:**
- Single Hosting deployment (reuse main app infra)
- No DNS/cert changes needed
- Route isolation via React Router (separate layout, no header/nav bar)
- v1.5 can extract to subdomain if branding/analytics separation needed

**Routing:** `/paciente/*` routes handled by separate React component tree (not shared with `/admin` or `/dashboard`).

---

### 6.6 Branding Storage + CDN

**Decision:** Logo stored in Cloud Storage (CDN-backed by Firebase Hosting).

**Rationale:**
- Cloud Storage URL: `https://firebaseapp.com/v0/b/bucket/o/labs%2FLAB001%2Flogo.png`
- Auto-served via CDN (global, fast)
- Firestore stores: URL only (not binary; keeps Firestore document size small)
- Fallback: System default logo if custom not provided

**Alternative rejected:** Base64 in Firestore (document size bloat; slower for large images).

---

## 7. Acceptance Criteria & Quality Gates

### Functional Acceptance Criteria

- ✅ Portal accessible at public URL (no lab login required to view portal landing)
- ✅ Patient can authenticate via email-link (CPF or Patient ID lookup working)
- ✅ Patient can download laudo as PDF (branded, includes QR code)
- ✅ QR code links to verification page (stateless hash validation working)
- ✅ Patient can submit NPS feedback (data persisted to satisfacao collection)
- ✅ Lab admin can customize portal branding (logo, colors, labels)
- ✅ Audit log complete (all downloads, auth attempts, feedback recorded)
- ✅ LGPD disclaimer visible + privacy policy accessible
- ✅ Email links expire after 72h (link reusable, can request new link anytime)
- ✅ Session timeout after 72h or explicit logout

### Performance Acceptance Criteria

- ✅ Portal TTI (Time to Interactive) <2.5s on Lighthouse (mobile + desktop)
- ✅ PDF generation <500ms p99 latency (Cloud Function timeout is 60s, should never hit)
- ✅ Email delivery <5s from request (Resend SLA: <1s typical)
- ✅ Laudo detail page load <1s (Firestore read + rendering)

### Security Acceptance Criteria

- ✅ Patient can only access own laudos (JWT scope validated per request)
- ✅ Email links contain no PII (random token only)
- ✅ Audit log contains no PII (only IDs + timestamp)
- ✅ HTTPS enforced (Firebase Hosting default)
- ✅ Firestore rules audit passed (no public write, patient-scoped reads)
- ✅ CORS headers correct (patient portal endpoints only, no CSRF vulnerabilities)

### Accessibility Acceptance Criteria (WCAG AA)

- ✅ Contrast ratio ≥4.5:1 for normal text (dark theme + light text)
- ✅ All form inputs have associated labels
- ✅ Keyboard navigation working (Tab + Enter for all interactions)
- ✅ Screen reader compatible (semantic HTML, ARIA labels where needed)
- ✅ Focus visible on all interactive elements
- ✅ Lighthouse accessibility score ≥85

### Mobile Acceptance Criteria

- ✅ Portal responsive on iPhone SE (375px), iPad (768px), tablet (1024px)
- ✅ Email link clicks on mobile open portal correctly (no redirect loops)
- ✅ PDF download on mobile saves to camera roll (iOS) or Downloads (Android)
- ✅ QR code scannable from phone camera (tested iOS 15+, Android 11+)

### Testing Acceptance Criteria

- ✅ 6 E2E tests passing (email link send, token verify, PDF download, QR verify, NPS submit, mobile responsive)
- ✅ 100 test downloads with 0 failures (stress test)
- ✅ 15 unit tests for patient auth + crypto functions (JWT, hash validation)
- ✅ Cloud Logs review: 0 errors in patient-portal functions during UAT

---

## 8. Risk Register (Phase 5 Specific)

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Phase 3.3 export module not ready by Week 4 | Medium | HIGH (blocks PDF download) | Implement standalone `generateLaudoPDF` in Phase 5; merge after Phase 3.3 completes |
| Email delivery to patient delays (Resend down) | Low | MEDIUM (auth blocked) | Fallback to SMS-based link (Twilio); requires CPF + phone# lookup |
| Patient CPF lookup PII exposure (log leak) | Low | HIGH (LGPD violation) | CPF hashed + salted; audit logs use patient ID only (no CPF) |
| PDF generation hits Puppeteer memory limits (large PDFs) | Low | MEDIUM (download fails) | Implement streaming PDF output; chunk results if >5MB |
| QR code verification link accessible without auth | Medium | MEDIUM (privacy) | Link contains time-based hash; expires after 24h; patient ID scoped |
| Mobile PDF download fails (browser sandbox) | Medium | MEDIUM (poor UX) | Test on real devices (iPhone, Android); use standard download approach (no custom JS) |
| Portal branding CSS conflicts with main app | Low | LOW (cosmetic) | Isolate portal CSS in separate module; use CSS modules or BEM namespacing |

---

## 9. Dependencies & Blockers

### Hard Dependencies (Must be complete before Phase 5 starts)

1. ✓ **Phase 3 schema deployed** — All collections exist (`portal-configuracao`, `laudos`, `patients`, etc.)
2. ✓ **v1.3 Firestore data** — Laudos collection populated with test data + real patient data (if available)
3. ✓ **Resend integration** — Email service working in functions (already deployed v1.3)

### Soft Dependencies (Nice to have, but not blocking)

1. **Phase 3.3 export module** — Prefer reuse of `generateLaudoPDF` callable; fallback: standalone implementation
2. **Portal branding design** — Figma spec helps, but can use default styling + iterate

### Blockers (Would delay Phase 5)

1. **Phase 4 (CAPA closure) slips** → Phase 5 slides by same amount (parallel streams, but Phase 5 depends on Phase 3 being stable)
2. **Firestore indexes building** → Portal queries slow; Phase 3.1 completion gate
3. **Cloud Functions deploy broken** → Cannot deploy auth + PDF callables

---

## 10. Compliance Mapping (RDC 978 + DICQ)

### RDC 978 Requirements Addressed

| Article | Requirement | Phase 5 Implementation |
|---|---|---|
| 77 | Privacy policy (LGPD) | Footer links to privacy policy + DPIA (from portal-configuracao) |
| 115 | Document retention (5 years) | Laudos retained per existing module (Phase 3, unmodified) |
| 167 | Laudo mandatory fields (14) | Portal displays all 14 fields from laudo record |
| 191 | Patient communication | Email link + NPS feedback creates feedback loop |

### DICQ Requirements Addressed

| Block | Requirement | Phase 5 Implementation |
|---|---|---|
| 4.3 | Document hierarchy + control | Portal-configuracao versioning (admin UI tracks updates) |
| 4.14.3 | Feedback / realimentação | NPS feedback form + trending (Phase 7 aggregates) |
| 4.14.4 | Complaint + feedback trending | NPS trending dashboard (Phase 7) |

---

## 11. Success Metrics & KPIs

Post-launch (Phase 5 completion, Week 6):

| Metric | Target | Measurement |
|---|---|---|
| Portal uptime | >99.5% | Firebase Hosting + Cloud Functions monitoring |
| Laudo download success rate | >99% | Audit log / failed downloads <1% |
| Email delivery rate | >98% | Resend analytics + bounce tracking |
| Portal TTI (mobile) | <2.5s p99 | Lighthouse CI + RUM (if instrumented) |
| Patient adoption | >30% of eligible patients download laudo within 1 month | Audit log analysis |
| NPS average score | >7/10 | Dashboard average |
| WCAG AA compliance | ≥85 Lighthouse | Lighthouse CI report |

---

## 12. Next Steps (Planning → Execution)

1. **Phase 5 PLAN.md** (gsd-plan-phase):
   - Wave-by-wave task breakdown (subtasks per story point)
   - Daily standups + rollover tracking
   - Sign-off criteria per wave

2. **Phase 5 Implementation** (Week 4–5):
   - Team kickoff (Day 1)
   - Wave 1 complete + merged to main (Day 5)
   - Wave 2 complete + staging QA (Day 10)
   - Production deploy (Day 10.5, pending gate approval)

3. **Phase 5 Deployment**:
   - Pre-deploy: 2,000+ patient CSV import + smoke tests
   - Deploy: Firebase Hosting + Cloud Functions
   - Post-deploy: Cloud Logs monitoring 24h (per deployment protocol)
   - Auditor notification (email + link to live portal)

4. **Phase 6 Kickoff** (Week 5, concurrent):
   - Critical values escalation (Phase 6) begins mid-Phase 5
   - Phase 5 wave 2 polish happens in parallel with Phase 6 wave 1

---

## Appendix: Design References

### Portal Landing Page (Dark-First, Responsive)

```
[Lab Logo] HC Quality — Seus Resultados
────────────────────────────────────────

"Acesse seus resultados de forma segura"

┌──────────────────────────┐
│ CPF ou ID do Paciente:   │
│ [      ___________      ]│
│                          │
│ [ Enviar Link Seguro ]   │
└──────────────────────────┘

Privacidade: Seus dados estão protegidos.
Saiba mais sobre nossa política.
```

### Laudo Detail (Mobile)

```
[← Voltar]
╔════════════════════════════════╗
║ Seu Nome · 31/12/1990          ║
║ Coleta: 07/05/2026             ║
║ [QR Code]                       ║
╚════════════════════════════════╝

┌─ Hemograma ─────────────────────┐
│ Hemoglobina    │ 14.5 │ 12–16   │
│ Hematócrito    │ 43%  │ 36–46   │
│ Leucócitos     │ 7.2  │ 4–11    │
└─────────────────────────────────┘

[ Baixar PDF ]  [ Compartilhar ]

Avalie sua experiência?
[1 ⭐ 2 ⭐ 3 ⭐ ... 10 ⭐]
Feedback (opcional): [_________]
☐ Posso receber contato sobre melhorias

[ Enviar Avaliação ]
```

---

**Document Status:** RESEARCH (planning phase)  
**Created:** 2026-05-07  
**Owner:** Stream B (Frontend Lead) + Backend Engineer  
**Next:** Phase 5 PLAN.md (detailed task breakdown + gsd-plan-phase execution)

**Ready for:** gsd-plan-phase tool (convert to PLAN.md with day-by-day task assignment)
