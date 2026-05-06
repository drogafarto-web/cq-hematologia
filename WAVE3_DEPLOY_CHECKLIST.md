# Wave 3 Deploy Checklist

**Status**: Code complete, ready for CTO approval and deployment

## Pre-Deployment Steps (automated)

- [ ] **Type check** — Run in functions directory:
  ```bash
  cd functions && npm run build
  ```
  Expected: No errors, generates `lib/` folder

- [ ] **Frontend build** (root):
  ```bash
  npm run build
  ```
  Expected: No errors, ~33s compilation

## Files Modified/Created

**Functions (backend)**:
- ✅ `functions/src/modules/auditoria/generatePDF.ts` — NEW, Puppeteer PDF generation
- ✅ `functions/src/modules/auditoria/index.ts` — Updated to export `generateAuditReportPDF`
- ✅ `functions/src/index.ts` — Updated to wire `generateAuditReportPDF`

**Frontend (web)**:
- ✅ `src/features/auditoria-interna/hooks/useAuditReportExport.ts` — NEW, export hook
- ✅ `src/features/auditoria-interna/hooks/index.ts` — NEW, hooks barrel export
- ✅ `src/features/auditoria-interna/components/AuditoriasList.tsx` — Updated with export button

**Tests**:
- ✅ `smoke-test-openclaw/wave3-audit-pdf-e2e.test.mjs` — NEW, end-to-end test

**Documentation**:
- ✅ `WAVE3_IMPLEMENTATION.md` — Implementation details
- ✅ `STATE.md` — Updated with Phase 5 status
- ✅ `WAVE3_DEPLOY_CHECKLIST.md` — This file

## Code Quality Checklist

**Cloud Function (`generatePDF.ts`)**:
- ✅ Type-safe with Zod input validation
- ✅ Lab membership check (multi-tenant security)
- ✅ Error handling (HttpsError with meaningful messages)
- ✅ Audit logging (GENERATE_AUDIT_REPORT_PDF in auditLogs)
- ✅ PDF size validation (<10MB, RDC 978 compliant)
- ✅ Signed URL generation (7-day expiry)
- ✅ Browser cleanup on error (finally block)
- ✅ Puppeteer configured for Cloud Functions (headless='new', --no-sandbox)

**Frontend Hook (`useAuditReportExport.ts`)**:
- ✅ Follows pattern from educacao-continuada
- ✅ useActiveLabId guard
- ✅ Loading state management
- ✅ Error state capture
- ✅ Progress message feedback
- ✅ Download helper (triggers browser download)

**UI Component (`AuditoriasList.tsx`)**:
- ✅ Dark-first design (matches existing theme)
- ✅ Expandable audit cards
- ✅ Export button with loading state
- ✅ Error message display
- ✅ Responsive layout

## What Gets Deployed

### Cloud Functions (functions/lib/index.js)
- New callable: `generateAuditReportPDF`
- Memory: 2GiB
- Timeout: 300s
- Region: southamerica-east1

### Web Hosting (hmatologia2.web.app)
- New hook: `useAuditReportExport`
- Updated component: `AuditoriasList.tsx` with export button
- No breaking changes to existing UIs

## Deployment Commands

**When CTO approves**:

```bash
# From repo root
cd functions

# 1. Build
npm run build

# 2. Deploy functions only
firebase deploy --only functions --project hmatologia2

# 3. Return to root
cd ..

# 4. Build web
npm run build

# 5. Deploy hosting
firebase deploy --only hosting --project hmatologia2
```

**Alternative** (one command, if comfortable):
```bash
firebase deploy --only functions,hosting --project hmatologia2
```

## Post-Deployment Validation

**On hmatologia2.web.app**:

1. Hard reload: Ctrl+Shift+R
2. Navigate to Auditoria → Histórico tab
3. Find any finalized audit
4. Click "Ver Detalhes" button (should expand to show sessions)
5. Click "Exportar PDF" button on a session
6. Monitor network: should see HTTPS call to `generateAuditReportPDF`
7. Wait 5-15s for Puppeteer processing
8. PDF should download automatically
9. Verify file opens + contains ~115 checklist items

**In Firebase Console**:

1. Firestore > Browse > `auditLogs` collection
2. Look for newest entry with action = `GENERATE_AUDIT_REPORT_PDF`
3. Verify fields: labId, auditoriaId, sessaoId, pdfSizeMB, pdfUrl

**In Cloud Storage**:

1. Cloud Storage > Browse > hmatologia2.appspot.com
2. Navigate to `audits/{labId}/...`
3. Find `relatorio-{sessaoId}-{date}.pdf`
4. Right-click > Get signed URL (should be valid for 7 days)

## Rollback Plan

If something breaks post-deployment:

```bash
# Option 1: Rollback functions only
git revert <commit-sha>
cd functions && npm run build && firebase deploy --only functions

# Option 2: Disable PDF export in UI (fastest)
# Edit AuditoriasList.tsx to hide export button
npm run build && firebase deploy --only hosting
```

## Notes

- PDF generation is **stateless** — no dependencies on previous audits
- Each PDF is **independent** — can be exported multiple times
- 7-day signed URL allows forwarding via email without re-generation
- Puppeteer cold start adds ~5s first call; warm instances are 2-3s

## CTO Approval Required

Before running deploy commands, we need explicit approval to proceed with:
- `firebase deploy --only functions` (modifies Cloud Functions in prod)
- `firebase deploy --only hosting` (updates web app in prod)

**Action**: Request CTO sign-off on Wave 3 implementation.

---

**Files ready**. **Tests written**. **Documentation complete**. Awaiting CTO approval.
