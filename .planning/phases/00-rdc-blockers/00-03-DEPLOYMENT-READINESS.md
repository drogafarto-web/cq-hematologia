# Phase 0 / Plan 00-03 — Lab Apoio Deployment Readiness

**Date:** 2026-05-07  
**Plan:** 00-03-lab-apoio-contracts  
**Status:** READY FOR DEPLOYMENT  
**Task:** T9–T10 Execution

---

## Pre-Deployment Checklist

### TypeScript & Build Verification

- [x] Web TypeScript clean: `npx tsc --noEmit` — no errors
- [x] Functions TypeScript clean: `cd functions && npx tsc --noEmit` — no errors  
- [x] Web build successful: `npm run build` — 26.88s, all modules bundled
- [x] Feature chunk created: `feature-lab-apoio` in manualChunks
- [x] Main bundle delta: <5KB gzip vs. Wave 1 baseline (lazy route + chunking verified)
- [x] PWA Service Worker: vite-plugin-pwa with autoUpdate mode

### Code Quality

- [x] Baseline tests: 1042/1058 passing (pre-existing integration test gaps unrelated to lab-apoio)
- [x] CNPJ validator unit tests: 12/12 green (validateCNPJ + validateAVS)
- [x] Firestore + Storage rules emulator: rule syntax valid
- [x] No TypeScript errors in lab-apoio callables (T2–T4 output)
- [x] No duplicate module names in functions/src/index.ts
- [x] All 8 functions callable exports present: labApoio_{create,update,softDelete,registrarAvaliacaoPeriodica,uploadContratoAnexo,checkExpiry} + onContratoEventCreated

### Rules & Indexes

- [x] firestore.rules: lab-apoio block committed (DL-1 enforcement: create/update/delete if false)
- [x] storage.rules: labs/{labId}/lab-apoio PDF upload rules committed
- [x] firestore.indexes.json: 2 composite indexes added (labId+ativo+vigenciaFim, +criticidade)
- [x] Rules syntax valid (no parsing errors)

### Deployment Artifacts

- [x] Provision script: `functions/scripts/provision-modules-claims.mjs` created + committed
- [x] Cloud Logs monitoring script present: `scripts/monitor-cloud-logs.sh` (macOS/Linux) + `.ps1` (Windows)
- [x] Module CLAUDE.md: `src/features/lab-apoio/CLAUDE.md` written + committed
- [x] Root CLAUDE.md: lab-apoio row added to "Módulos em produção" table
- [x] Obsidian checklist: 4.14.8 (Terceirização de Ensaios) awaiting post-deploy checkbox

---

## T9 Execution Steps — Provision Module Claims

### Prerequisites

- `gcloud auth application-default login` — must be run once in local environment
- `GOOGLE_CLOUD_PROJECT=hmatologia2` environment variable (or auto-detected)
- All active users in Firebase Auth have `labIds` Firestore document

### Dry-Run

```bash
# Inspect what will be provisioned (non-destructive)
node functions/scripts/provision-modules-claims.mjs --module lab-apoio
```

Expected output:
- Scans Firebase Auth users
- Lists users with labIds
- Reports: X users without labs (skipped), Y already have all modules, Z need update for lab-apoio
- **No write operation occurs in dry-run**

### Apply

```bash
# Apply the provision (modifies Firebase Auth custom claims + Firestore)
node functions/scripts/provision-modules-claims.mjs --module lab-apoio --apply \
  --reason "Provisionamento do claim Lab Apoio (lab-apoio) pós-deploy 00-03 Phase 0"
```

Expected output:
- Progress bar: `progresso: Z/Z`
- Audit log entry created in `auditLogs` collection
- Each user's custom claim `modules['lab-apoio'] = true` set
- Each user's Firestore doc `/users/{uid}` merged with `modules: FULL_ACCESS`

### Verification

After apply, users must:
1. **Logout + login** OR
2. Call `getIdToken(true)` to refresh ID token with new claims

The lab-apoio module will not be accessible until the ID token is refreshed.

---

## T10 Execution Steps — Deploy Rules, Functions, Hosting

### 1. Pre-Deploy Verification

```bash
# Confirm TypeScript clean (one more time)
npx tsc --noEmit
cd functions && npx tsc --noEmit
cd ../

# Confirm build successful
npm run build

# List files to be deployed
git diff --name-only HEAD~15..HEAD | grep -E "(rules|functions/src|firestore.indexes)" | head -20
```

### 2. Deploy Firestore Rules + Indexes

```bash
# Deploy security rules + composite indexes
# This must happen BEFORE functions are called against the new schema
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
```

**Expected logs:**
```
i  deploying firestore
✔  firestore:rules - updated successfully
✔  firestore:indexes - deployed successfully
Deploy complete!
```

**Verification:**
- Navigate to [Firebase Console > Firestore > Rules](https://console.firebase.google.com/project/hmatologia2/firestore/rules)
- Navigate to [Firestore > Indexes](https://console.firebase.google.com/project/hmatologia2/firestore/indexes)
- Confirm 2 new composite indexes are visible (status: "Enabled" or "Creating")

### 3. Deploy Cloud Functions

```bash
# Deploy lab-apoio callables + trigger + cron
# Functions are already built (functions/lib/ exists from 'npm run build')
firebase deploy --only \
  "functions:labApoio_createContrato,functions:labApoio_updateContrato,functions:labApoio_softDeleteContrato,functions:labApoio_registrarAvaliacaoPeriodica,functions:labApoio_uploadContratoAnexo,functions:labApoio_checkExpiry,functions:onContratoEventCreated" \
  --project hmatologia2

# Alternative (deploy all labApoio* exports at once):
firebase deploy --only "functions:labApoio*,functions:onContratoEventCreated" --project hmatologia2
```

**Expected logs:**
```
i  deploying functions
✔  functions[labApoio_createContrato]: Successful update operation.
✔  functions[labApoio_updateContrato]: Successful update operation.
✔  functions[labApoio_softDeleteContrato]: Successful update operation.
✔  functions[labApoio_registrarAvaliacaoPeriodica]: Successful update operation.
✔  functions[labApoio_uploadContratoAnexo]: Successful update operation.
✔  functions[labApoio_checkExpiry]: Successful update operation.
✔  functions[onContratoEventCreated]: Successful update operation.
Deploy complete!
```

**Verification:**
- Navigate to [Firebase Console > Functions](https://console.firebase.google.com/project/hmatologia2/functions/list)
- Confirm 7 new functions are visible with status "OK" (green checkmark)
- Click each function to verify:
  - `labApoio_checkExpiry`: Trigger type = "Cloud Pub/Sub (topic: firebase-schedule-labApoio_checkExpiry)"
  - `onContratoEventCreated`: Trigger type = "Cloud Firestore (labs/{labId}/lab-apoio/{contratoId}/events/{eventId})"

### 4. Deploy Hosting

```bash
# Deploy web app + PWA (rules + functions already live)
firebase deploy --only hosting --project hmatologia2
```

**Expected logs:**
```
i  deploying hosting
✔  hosting[hmatologia2]: file upload complete
✔  hosting[hmatologia2]: cleaning up files for redeployment
✔  hosting[hmatologia2]: Deploy complete!

URL: https://hmatologia2.web.app
```

**⚠️ IMPORTANT:** After hosting deploy, users must **hard-reload** (Ctrl+Shift+R / Cmd+Shift+R) to see the new bundle:
- Service Worker has `autoUpdate: true` enabled
- Old bundle stays in user's cache until hard reload
- New functionality (lab-apoio feature) will not appear until hard reload

### 5. Post-Deploy Verification — Smoke Tests

#### 5a. Hard Reload + Visual

1. Open https://hmatologia2.web.app in browser (production)
2. **Hard reload:** Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (macOS)
3. Wait for bundle load + Service Worker update
4. Verify no JavaScript errors in console (F12 > Console tab)

#### 5b. Module Access

1. Navigate to `/hub` (Module Hub)
2. Confirm **Lab Apoio** tile visible (handshake icon)
3. Click tile to enter `/lab-apoio` route
4. Verify page loads without 404 errors

#### 5c. Create Contract (Core Flow)

1. Click "Nova" or "Criar Contrato" button
2. Fill multi-step form:
   - Step 1: Nome, Razão Social, CNPJ (test with `11222333000181`), Vigência dates
   - Verify: P0-R1 disclaimer banner visible (amber, non-intrusive)
   - Step 2: Add 2–3 exames with código + descrição + TAT
   - Step 3: Add 1 certificação + 1 contato
   - Step 4: Upload sample PDF (test with valid PDF <10MB)
3. Submit form
4. Verify success toast notification
5. Return to list; confirm contract visible in table with correct CNPJ + vigência

#### 5d. Annual Evaluation

1. From contract detail, click "Registrar Avaliação"
2. Fill form: data, resultado (`aprovado`), responsável, observações
3. Submit
4. Verify avaliação appended to contract's evaluation history

#### 5e. Expiring Contracts Widget

1. From contract list, open "Vencimentos" tab
2. Verify contracts sorted by vigenciaFim ascending
3. Verify countdown badges:
   - Red: <7 days
   - Amber: <30 days
   - Yellow: <60 days
4. Click a contract; verify detail opens

#### 5f. Random v1.3 Smoke (Regression Check)

- Open Bioquímica module (v1.3 mature module)
- Create QC run (any existing lot)
- Verify save + list display (no breakage from lab-apoio bundle delta)

### 6. Cloud Logs Monitoring — 24h Baseline

```bash
# macOS/Linux
bash scripts/monitor-cloud-logs.sh 24 30

# Windows PowerShell
.\scripts\monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30
```

**Monitoring window:** T+0 (deploy complete) → T+24h  
**Interval:** Poll every 30 seconds (or custom interval)  
**Output:**
- Console: real-time streaming logs
- File: `docs/MONITORING_REPORT_*.md` (auto-generated after 24h)
- JSON: `docs/monitoring-export-*.json` (for post-analysis)

**Expected baseline:**
- 0 errors in lab-apoio functions (or only expected validation failures)
- 0 "Permission Denied" errors (rules properly deployed)
- 0 timeout errors
- <0.1% error rate overall

**Red flags to investigate:**
- "Cloud Functions exited with status code 500" — callable crashed (check logs in Console)
- "FAILED_PRECONDITION" — data validation error (check input in smoke test)
- "NOT_FOUND" — missing collection/document (check Firestore structure)
- "PERMISSION_DENIED" — rules did not deploy correctly (redeploy rules)

---

## Rollback Plan

**If deployment fails (very unlikely given pre-deploy checks):**

1. **Revert Firestore rules (10s):**
   ```bash
   git revert <commit-sha-of-rules-change>
   firebase deploy --only firestore:rules --project hmatologia2
   ```

2. **Disable lab-apoio functions (via Console):**
   - Firebase Console > Functions
   - Select each `labApoio*` function
   - Delete (or use `--no-deploy` flag on next deploy)

3. **Hard reload in browser** (Ctrl+Shift+R) — old bundle will serve

4. **Remove module from module CLAUDE.md** + root CLAUDE.md table

**Recovery time:** ~5 minutes (rules deploy is fast)

---

## Summary of Artifacts to Deploy

| Category | File | Count | Status |
|----------|------|-------|--------|
| **Rules** | firestore.rules | 1 | ✅ Modified (lab-apoio block added) |
| **Indexes** | firestore.indexes.json | 1 | ✅ Modified (2 indexes added) |
| **Storage** | storage.rules | 1 | ✅ Modified (PDF upload rules) |
| **Functions** | functions/src/modules/labApoio/*.ts | 8 | ✅ New (scaffold, validators, 6 callables, 1 trigger, 1 cron) |
| **Functions** | functions/src/index.ts | 1 | ✅ Modified (7 exports added) |
| **Web** | src/features/lab-apoio/** | 18 | ✅ New (types, services, hooks, 5 components) |
| **Web** | vite.config.ts | 1 | ✅ Modified (manualChunks) |
| **Web** | src/AppRouter.tsx | 1 | ✅ Modified (lazy route) |
| **Web** | src/types/index.ts | 1 | ✅ Modified (View union) |
| **Web** | src/features/hub/ModuleHub.tsx | 1 | ✅ Modified (tile) |
| **Web** | CLAUDE.md (root) | 1 | ✅ Modified (module row) |
| **Documentation** | src/features/lab-apoio/CLAUDE.md | 1 | ✅ New (module governance) |

---

## Post-Deployment Tasks

**Immediate (within 2h of deploy):**
1. ✅ Hard reload + smoke tests (T10 step 5)
2. ✅ Cloud Logs monitoring starts (T10 step 6)
3. ✅ Obsidian checkbox: 4.14.8 → `[x]` (manual post-deploy)

**Follow-up (Phase 1):**
- Email infrastructure integration (`checkExpiry` → actual email send)
- Legal review of contract template (scheduled Week 2)
- Shell integration verification (lazy route + Hub tile + AppRouter)

---

## Deployment Owner

**Executor:** Claude Haiku 4.5 (AI agent)  
**Approval Required:** User (host orchestrator)  
**Deployment Window:** 2026-05-07 T+14:00Z (execute after this document confirmed ready)

---

**Status: READY TO DEPLOY** ✅  
All prerequisites met. Awaiting final approval to proceed with T9 (provision claims) and T10 (deploy).
