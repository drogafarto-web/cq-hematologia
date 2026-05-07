# Phase 5 Execution Checklist
## Patient Portal Phase 1 — Laudo Download + Portal Access

**Duration:** 14 working days (2 weeks)  
**Waves:** 1 (Days 1–7: Backend) + 2 (Days 8–14: Frontend + Testing)  
**Reference:** PHASE_5_DETAILED_PLAN.md

---

## Wave 1: Foundation + Schema + Backend Callables (Days 1–7)

### Day 1–2: Schema + Rules + Fixtures

- [ ] **Schema review & finalization**
  - [ ] `/labs/{labId}/patients` (patient list)
  - [ ] `/labs/{labId}/patient-auth-events` (immutable)
  - [ ] `/labs/{labId}/patient-downloads` (immutable)
  - [ ] `/labs/{labId}/patient-feedback` (immutable)
  - [ ] `portal-configuracao` extension (branding)
  - [ ] Confirm all fields match PHASE_5_DETAILED_PLAN.md § 3.1, 4.1, 5.1

- [ ] **Firestore Rules** (`firestore.rules`)
  - [ ] Add patient collections rules (per § 11.1)
  - [ ] Append-only for auth-events, downloads, feedback
  - [ ] Public read on `portal-configuracao` (branding)
  - [ ] RT-only write on patients collection
  - [ ] Test in emulator: `firebase emulators:start --only firestore`
  - [ ] Run rules tests: `npm test -- firestore/rules`
  - [ ] Reference: `.claude/rules/firestore-security.md`

- [ ] **Test Fixtures** (`src/__tests__/e2e/fixtures.ts`)
  - [ ] `seedPatients(count)` function
  - [ ] `seedLaudo(labId, patientId)` function
  - [ ] `setupPatientSession()` function
  - [ ] `generateTestToken()` utility
  - [ ] CSV import mock (for Riopomba load test)

### Day 2–3: Cloud Functions — Auth Callables

**File location:** `functions/src/patient-portal/`

- [ ] **`generatePatientAuthLink.ts`** (per § 2.2)
  - [ ] Lookup patient by hashed CPF
  - [ ] Rate-limit check (3/day)
  - [ ] JWT generation (72h expiry)
  - [ ] Email send via Resend API (or fallback to manual)
  - [ ] Log to `patient-auth-events` (immutable)
  - [ ] Type-safe: `PatientAuthLinkInput`, `PatientAuthLinkResponse`
  - [ ] Error handling: PATIENT_NOT_FOUND, RATE_LIMIT_EXCEEDED, EMAIL_SEND_FAILED
  - [ ] Tests: 8+ unit specs
    - [ ] Valid CPF lookup
    - [ ] Rate-limit at 3
    - [ ] JWT expiry 72h
    - [ ] Email delivered
    - [ ] Event logged
    - [ ] Invalid CPF error
    - [ ] Inactive patient error
    - [ ] Email service timeout fallback

- [ ] **`verifyPatientAuthToken.ts`** (per § 2.3)
  - [ ] JWT verification (check sig + expiry)
  - [ ] Patient status check (active only)
  - [ ] Return: `{valid: bool, patientId, labId, expiresAt}`
  - [ ] Error handling: INVALID_TOKEN, PATIENT_INACTIVE, EXPIRED
  - [ ] Tests: 5+ unit specs
    - [ ] Valid token
    - [ ] Expired token
    - [ ] Invalid signature
    - [ ] Patient inactive
    - [ ] Tampered token

- [ ] **`generatePatientAuthLinkAdmin.ts`** (Emergency callable)
  - [ ] RT-only (isAdminOrOwner guard)
  - [ ] Generates token manually (fallback if email service down)
  - [ ] Returns `{token, portalUrl}`
  - [ ] Tests: 3+ specs

### Day 3–4: Cloud Functions — PDF + Feedback Callables

- [ ] **`generatePatientLaudoPDF.ts`** (per § 3.2)
  - [ ] Auth guard: token scoped to patientId
  - [ ] Fetch laudo + latest version
  - [ ] Verify patient ID matches laudo
  - [ ] QR generation: `JSON.stringify({laudoId, versionId, signatureHash})`
  - [ ] HTML rendering: patient-facing template (per § 3.3)
  - [ ] Puppeteer PDF generation (set timeout 120s)
  - [ ] GCS upload with signed URL (1h expiry)
  - [ ] Log to `patient-downloads` (immutable)
  - [ ] Return: `{downloadUrl, expiresAt, filename}`
  - [ ] Type-safe: `PatientPDFGenerateInput`, `PatientPDFGenerateResponse`
  - [ ] Tests: 6+ specs
    - [ ] Valid token + laudo
    - [ ] QR encodes correctly
    - [ ] PDF uploads to GCS
    - [ ] Signed URL expires in 1h
    - [ ] Audit log created
    - [ ] Patient mismatch error

- [ ] **`submitPatientFeedback.ts`** (per § 5.2)
  - [ ] Auth guard: token scoped to patientId
  - [ ] Validate NPS (0–10)
  - [ ] Validate satisfaction (enum)
  - [ ] Truncate comment (max 500 chars)
  - [ ] Write to `patient-feedback` (immutable)
  - [ ] Return: `{success: bool, feedbackId}`
  - [ ] Tests: 4+ specs
    - [ ] Valid NPS + satisfaction
    - [ ] Comment truncation
    - [ ] Invalid NPS error
    - [ ] Feedback logged

### Day 4–5: Email Templates + Secrets Setup

- [ ] **Email Templates** (`functions/src/shared/templates/`)
  - [ ] `patientAuthEmail.ts` (auth link email — per § 2.2)
    - [ ] Subject: "Acesso ao seu resultado — HC Quality Laboratorial"
    - [ ] Button link: `/paciente/auth?token=...`
    - [ ] Expiry messaging: "72 horas"
    - [ ] Footer: lab name, support email
    - [ ] Test: render with mock data
  - [ ] `patientLaudoHTML.ts` (PDF template — per § 3.3)
    - [ ] Header: logo + lab info (CNES, address, phone)
    - [ ] Patient section: name, DOB, CPF (masked format)
    - [ ] Exams: nombre, resultado, unidade, reference
    - [ ] QR code: top-right corner, 100x100px
    - [ ] Signature: RT + Profissional blocks
    - [ ] Footer: data de emissão, versão, hash (partial)
    - [ ] LGPD disclaimer: yellow banner, warning tone
    - [ ] CSS: print-optimized (no dark mode, fixed colors)
    - [ ] Test: render with mock laudo data, verify PDF output

- [ ] **Cloud Functions Secrets** (Firebase console + preflight check)
  - [ ] `PATIENT_PORTAL_SECRET` — JWT signing key (generate: `openssl rand -hex 32`)
  - [ ] `RESEND_API_KEY` — Email service API
  - [ ] Deploy secrets: `firebase functions:secrets:set PATIENT_PORTAL_SECRET`
  - [ ] Run preflight: `bash scripts/preflight-secrets-check.sh`
  - [ ] Verify: both secrets resolved (not PENDING_SET)
  - [ ] Reference: `docs/adr/ADR-0018-deploy-gate-secret-status-check.md`

### Day 5–6: Service Layer + Hooks

**File location:** `src/features/patient-portal/services/` + `hooks/`

- [ ] **`patientLaudoService.ts`**
  - [ ] `listenToPatientLaudos(labId, patientId)` — onSnapshot read
  - [ ] `getPatientLaudo(labId, patientId, laudoId)` — single fetch + permission guard
  - [ ] No writes (read-only)
  - [ ] Tests: 4+ specs

- [ ] **`patientAuthService.ts`**
  - [ ] `verifyPatientAuthToken(token)` — client-side JWT decode (backup)
  - [ ] `generateAuthLink(labId, cpf)` — call CF
  - [ ] Error handling + retry logic
  - [ ] Tests: 3+ specs

- [ ] **`patientDownloadService.ts`**
  - [ ] `initiatePDFDownload(labId, patientId, laudoId)` — call CF
  - [ ] Track download start time (for TTI audit)
  - [ ] Tests: 2+ specs

- [ ] **`usePatientAuthStore.ts`** (Zustand)
  - [ ] State: `{token, patientId, labId, expiresAt}`
  - [ ] Action: `setAuth(token, patientId, labId, expiresAt)` — validate + store
  - [ ] Action: `clearAuth()` — logout
  - [ ] Action: `isTokenExpired()` — check expiry
  - [ ] Persist to localStorage
  - [ ] Tests: 5+ specs

- [ ] **`usePatientLaudos.ts`** (Hook)
  - [ ] `onSnapshot` wrapper for `listenToPatientLaudos`
  - [ ] Return: `{laudos, loading, error}`
  - [ ] Cleanup unsubscribe
  - [ ] Tests: 3+ specs

- [ ] **`useLabPortalBranding.ts`** (Hook)
  - [ ] Fetch `portal-configuracao` from Firestore
  - [ ] Return: `{branding, loading}`
  - [ ] Fallback: default colors if not configured
  - [ ] Tests: 2+ specs

### Day 6–7: Integration Tests + Type Safety

- [ ] **Integration tests** (`functions/src/__tests__/patient-portal.test.ts`)
  - [ ] Full flow: generateAuthLink → verifyToken → downloadPDF
  - [ ] Rate-limit integration
  - [ ] Audit trail created correctly
  - [ ] Email sent + token in URL
  - [ ] Tests: 3+ specs (e2e simulation)

- [ ] **Type definitions** (`src/features/patient-portal/types/index.ts`)
  - [ ] `PatientAuthState` (Zustand shape)
  - [ ] `PatientAuthLinkInput`, `PatientAuthLinkResponse`
  - [ ] `PatientData`, `PatientAuthEvent`, `PatientDownloadEvent`, `PatientFeedback`
  - [ ] `LabBrandingConfig`, `LabPortalConfig`
  - [ ] All mapped to Firestore doc shapes

- [ ] **Type-check clean**
  - [ ] `cd functions && npm run build` (no errors)
  - [ ] `npx tsc --noEmit` (web, no errors)

- [ ] **Deploy functions (staging)**
  - [ ] `firebase deploy --only functions --project hmatologia2` (with QA approval)
  - [ ] Monitor logs: `firebase functions:log`
  - [ ] No PERMISSION_DENIED, INTERNAL errors in first 1h

---

## Wave 2: Portal UI + Mobile + E2E Testing (Days 8–14)

### Day 8–9: Portal Components — Auth Flow

**File location:** `src/features/patient-portal/components/`, `pages/`

- [ ] **`PatientAuthForm.tsx`**
  - [ ] CPF input field (validated format)
  - [ ] Generate link button
  - [ ] Success message: "Link enviado para email"
  - [ ] Error states: PATIENT_NOT_FOUND, RATE_LIMIT_EXCEEDED
  - [ ] Loading state (spinner)
  - [ ] Tests: 4+ specs (visual + interaction)
  - [ ] Accessibility: WCAG AA (labels, error messaging)

- [ ] **`PatientAuthPage.tsx`**
  - [ ] Extract token from URL query
  - [ ] Call `verifyPatientAuthToken` CF
  - [ ] If valid → store in Zustand + redirect to `/paciente/laudos`
  - [ ] If invalid → show error + retry option
  - [ ] Loading state: skeleton screen
  - [ ] Tests: 3+ specs

- [ ] **`PatientPortalLayout.tsx`** (Main layout)
  - [ ] Header: logo + branding
  - [ ] Sidebar: nav (laudos, feedback, logout)
  - [ ] Footer: LGPD notice
  - [ ] Responsive: mobile nav collapse
  - [ ] Tests: 2+ specs

- [ ] **`PatientPortalHeader.tsx`**
  - [ ] Lab logo (from `portal-configuracao.branding.logoUrl`)
  - [ ] Primary color (from config, CSS variable)
  - [ ] Header text (customizable)
  - [ ] Dark mode support (if applicable)
  - [ ] Tests: 2+ specs

### Day 9–10: Portal Components — Laudos + Download

- [ ] **`PatientLaudoList.tsx`**
  - [ ] Grid/list of patient's laudos
  - [ ] Sort by `emissaoEm` (DESC)
  - [ ] Pagination (limit 50, cursor-based)
  - [ ] Card per laudo: name, date, status badge
  - [ ] Click → route to `/paciente/laudo/:id`
  - [ ] Loading: skeleton cards
  - [ ] Empty state: "Nenhum resultado disponível"
  - [ ] Tests: 4+ specs

- [ ] **`PatientLaudoCard.tsx`**
  - [ ] Laudo summary: exam nome, date
  - [ ] Status badge: LIBERADO, RETIFICADO
  - [ ] Download button (calls `generatePatientLaudoPDF` CF)
  - [ ] Click handler → trigger download
  - [ ] Tests: 3+ specs

- [ ] **`PatientLaudoView.tsx`** (Detail page)
  - [ ] Full laudo display (read-only)
  - [ ] Exams table: nome, resultado, unidade, reference
  - [ ] Critical results highlighted (red)
  - [ ] Patient info section
  - [ ] Download PDF button
  - [ ] Feedback form modal/section
  - [ ] Tests: 4+ specs

- [ ] **`PatientLaudoDetailPage.tsx`** (Route handler)
  - [ ] Extract `laudoId` from URL
  - [ ] Verify patient token still valid (expiry check)
  - [ ] Fetch laudo via `usePatientLaudos`
  - [ ] Verify patientId in laudo matches token
  - [ ] Render `PatientLaudoView`
  - [ ] Error state if laudo not found
  - [ ] Tests: 2+ specs

### Day 10–11: Portal Components — Feedback + LGPD

- [ ] **`FeedbackForm.tsx`** (per § 5.2)
  - [ ] NPS slider (0–10)
  - [ ] Satisfaction radio buttons (5-point)
  - [ ] Comment textarea (max 500 chars, counter)
  - [ ] Submit button
  - [ ] Success state: "Obrigado pelo seu feedback"
  - [ ] Error handling
  - [ ] Tests: 5+ specs (NPS validation, char limit, submit)

- [ ] **`LGPDNotice.tsx`**
  - [ ] Yellow banner with warning icon
  - [ ] Text: "Aviso de Privacidade — LGPD"
  - [ ] Link to privacy policy modal
  - [ ] Tests: 2+ specs

- [ ] **`PrivacyPolicyModal.tsx`**
  - [ ] Modal dialog, scrollable
  - [ ] Content sections: coleta, uso, retenção, direitos, contato
  - [ ] Close button
  - [ ] Tests: 2+ specs

### Day 11: Mobile Responsive + Performance

- [ ] **Tailwind responsive classes**
  - [ ] sm: 640px (tablet)
  - [ ] md: 768px
  - [ ] lg: 1024px
  - [ ] All components use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
  - [ ] Sidebar collapse on mobile
  - [ ] Feedback form stack on mobile
  - [ ] No horizontal scroll (test with 375px viewport)

- [ ] **Code splitting + lazy load**
  - [ ] Portal route lazy-loaded via `React.lazy`
  - [ ] Main bundle excludes patient portal code
  - [ ] Test: `npm run build && source-map-explorer 'dist/assets/*.js'`

- [ ] **Performance budgets (Web Vitals)**
  - [ ] LCP target: <2.5s (measure with Lighthouse)
  - [ ] INP target: <200ms (debounce form inputs)
  - [ ] CLS target: <0.1 (skeleton loaders, fixed dimensions)
  - [ ] Lighthouse score: ≥80 on mobile
  - [ ] Test locally: `npm run build && npm run preview`, then Lighthouse audit

- [ ] **Image optimization**
  - [ ] Lab logos: WebP format + JPG fallback, lazy load
  - [ ] QR code in PDF: embed as base64 (not external)
  - [ ] Test: `npm run build`, check asset sizes (logo <50KB)

### Day 11–12: E2E Tests (All 6 Specs)

**File location:** `src/__tests__/e2e/patient-portal.spec.ts` (per § 12)

- [ ] **Spec 1: Email Link Generation & Expiry**
  - [ ] Patient enters CPF
  - [ ] Email sent + link extracted
  - [ ] Token decoded, expiry = 72h
  - [ ] Pass: ✓

- [ ] **Spec 2: Invalid Token Error**
  - [ ] Malformed token → error page
  - [ ] Expired token → error page
  - [ ] Pass: ✓

- [ ] **Spec 3: PDF Download & Audit**
  - [ ] Authenticate with token
  - [ ] Download PDF file
  - [ ] Verify audit log created
  - [ ] Pass: ✓

- [ ] **Spec 4: NPS Form Submission**
  - [ ] Fill feedback form (NPS, satisfaction, comment)
  - [ ] Submit
  - [ ] Success message
  - [ ] Verify Firestore write
  - [ ] Pass: ✓

- [ ] **Spec 5: Mobile Responsiveness (375px)**
  - [ ] Set viewport 375x667
  - [ ] Auth page visible (not hidden)
  - [ ] Laudos list vertical stack
  - [ ] Download button not cut off
  - [ ] Feedback form scrollable (no horizontal scroll)
  - [ ] Pass: ✓

- [ ] **Spec 6: Audit Trail Visibility (RT Dashboard)**
  - [ ] Login as RT
  - [ ] Navigate to Liberação module
  - [ ] View patient downloads tab
  - [ ] Verify download entry visible (patient ID masked, action shown)
  - [ ] Pass: ✓

### Day 12–13: PDF Generation + QR Validation

- [ ] **PDF rendering test**
  - [ ] Mock laudo data
  - [ ] Render HTML template
  - [ ] Generate PDF via Puppeteer
  - [ ] Verify: header, patient section, exams, signature, footer
  - [ ] Check output file size (<2MB)
  - [ ] Tests: 2+ specs (visual + size)

- [ ] **QR code verification**
  - [ ] Generate QR from laudo ID + version + signature hash
  - [ ] Embed in PDF (top-right, 100x100px)
  - [ ] Scan with phone → decodes to correct data
  - [ ] Manual test: print PDF, scan with phone

- [ ] **Signed URL + GCS integration**
  - [ ] Upload PDF to GCS
  - [ ] Generate signed URL (1h expiry)
  - [ ] Verify URL expires after 1h
  - [ ] Test with curl: `curl -I ${signedUrl}` → 200 OK initially, 403 after expiry

### Day 13–14: Pre-Deploy QA + Smoke Tests

- [ ] **Type-check clean**
  - [ ] `npx tsc --noEmit` → no errors
  - [ ] `cd functions && npm run build` → no errors

- [ ] **Unit + integration tests**
  - [ ] `npm test -- patient-portal` → all pass
  - [ ] Coverage: ≥80% (components, hooks, services)

- [ ] **E2E tests**
  - [ ] All 6 specs passing in staging (not emulator)
  - [ ] `npm run test:e2e:portal` → all green
  - [ ] Screenshots/video captured for audit trail

- [ ] **Manual smoke tests (per § 13.2)**
  - [ ] [ ] Navigate to `/paciente` → auth page loads
  - [ ] [ ] Enter test patient CPF → "Link sent" message
  - [ ] [ ] Check email → link received + valid
  - [ ] [ ] Click link → redirects to `/paciente/laudos`
  - [ ] [ ] Download PDF → file saved + audit log created
  - [ ] [ ] Submit NPS (score 8) → "Thanks" message
  - [ ] [ ] Login as RT → audit log visible in Liberação
  - [ ] [ ] Test mobile (375px) → responsive, no horizontal scroll
  - [ ] [ ] Lighthouse audit: ≥80 score

- [ ] **Deployment pre-flight**
  - [ ] `bash scripts/preflight-secrets-check.sh` → all green (both secrets resolved)
  - [ ] Firestore rules deployment ready
  - [ ] Cloud Functions ready
  - [ ] Web build ready
  - [ ] CTO review + approval

- [ ] **Deploy sequence (per § 13.1)**
  1. [ ] `firebase deploy --only firestore:rules,firestore:indexes`
  2. [ ] `firebase deploy --only functions:generatePatientAuthLink`
  3. [ ] `firebase deploy --only functions:verifyPatientAuthToken`
  4. [ ] `firebase deploy --only functions:generatePatientLaudoPDF`
  5. [ ] `firebase deploy --only functions:submitPatientFeedback`
  6. [ ] `firebase deploy --only hosting`

- [ ] **Post-deploy monitoring (24h)**
  - [ ] `firebase functions:log` — check for errors
  - [ ] Cloud Logs dashboard — alert if >5 PATIENT_NOT_FOUND/hr
  - [ ] Email delivery metrics (Resend dashboard)
  - [ ] GCS signed URL generation success rate
  - [ ] Patient feedback submission rate

---

## Documentation + Handoff

- [ ] **PHASE_5_DETAILED_PLAN.md** — complete (reference for implementation)
- [ ] **src/features/patient-portal/CLAUDE.md** — complete (module-specific rules)
- [ ] **src/features/patient-portal/README.md** (if needed) — quick start for developers
- [ ] **Commit message template:**
  ```
  feat(patient-portal): Phase 5 — Email-link auth + laudo download + NPS feedback
  
  - Email-link auth with 72h expiry (generatePatientAuthLink CF)
  - PDF generation with QR code (generatePatientLaudoPDF CF)
  - NPS feedback form (submitPatientFeedback CF)
  - Lab branding per portal-configuracao
  - Audit trail (patient-downloads, patient-auth-events)
  - Mobile responsive (375px target)
  - LGPD privacy notice + policy modal
  - 6 E2E test specs (email, token, PDF, NPS, mobile, audit)
  
  Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
  ```

---

## Sign-Off Criteria (Phase 5 Complete)

✅ **All 4 callables deployed** (generateAuthLink, verifyToken, generatePDF, submitFeedback)  
✅ **Firestore rules + indexes deployed**  
✅ **All 6 E2E specs passing**  
✅ **Mobile responsive tested** (375px)  
✅ **Web Vitals targets met** (LCP <2.5s, INP <200ms, CLS <0.1)  
✅ **Audit trail verified** (zero untracked downloads)  
✅ **LGPD compliance checked** (notice visible, policy accessible)  
✅ **Riopomba patient CSV loaded** (2,000+ patients)  
✅ **RT dashboard audit log visible** (in Liberação module)  
✅ **Post-deploy monitoring active** (24h logging)  

---

**Phase 5 Status:** Ready for implementation  
**Estimated Start:** 2026-05-08 (post-v1.3 stabilization)  
**Estimated End:** 2026-05-21  
**Review Cadence:** Daily standups (Wave 1 + 2), mid-phase check-in (Day 7)

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07
