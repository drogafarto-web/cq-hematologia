---
title: Post-Deploy Smoke Tests — v1.3
version: 2.0 (Refined & Executable)
author: CTO (drogafarto)
date: 2026-05-06
updated: 2026-05-06
scope: Production (hmatologia2.web.app)
status: Ready for Manual Execution — Unambiguous Steps
---

## Quick Start (TL;DR)

**You have 30 minutes to validate 3 critical flows.** Detailed steps below; follow each action exactly. Each step has **Pass/Fail** checkbox and **troubleshooting** if things break.

1. **Smoke 1 (Bioquímica):** Load module → Parse PDF → Create lot → Record run → View chart → Verify signature
2. **Smoke 2 (SGD):** Authorize Drive → List 5 docs → Preview 3 → Import all → Publish all → Search
3. **Smoke 5 (Regression):** Load 5 existing modules, spot-check for errors
4. **Final Step:** Open DevTools Console, verify 0 red ERROR messages

**All steps completed without breaking anything = PASS. One red error or chainHash fail = STOP, escalate.**

---

# Post-Deploy Smoke Tests — v1.3

**Target Environment:** Production (`https://hmatologia2.web.app`)  
**Test Window:** 24h post-deploy  
**Test Account:** Staging-flagged lab (recommend Riopomba or demo lab)  
**Tester Role:** RT (Responsável Técnico)

## Timing Summary

| Scenario | Duration | Steps | Pass/Fail |
|----------|----------|-------|-----------|
| **Smoke 1: Bioquímica CIQ** | 10 min | 7 steps | ☐/☐ |
| **Smoke 2: SGD Drive Importer** | 12 min | 7 steps | ☐/☐ |
| **Smoke 3: Reclamação** (optional) | 8 min | 6 steps | ☐/☐/☐ Skip |
| **Smoke 4: Liberação** (optional) | 5 min | 5 steps | ☐/☐/☐ Skip |
| **Smoke 5: Regression Check** | 5 min | 5 modules | ☐/☐ |
| **Final Console Check** | 3 min | DevTools review | ☐/☐ |
| **Total (Core 1+2+5+Console)** | **30 min** | — | — |
| **Total (All including optional)** | **45 min** | — | — |

**Go/No-Go Decision Criteria:**
- ✅ **PASS (Go):** Smoke 1 + Smoke 2 + Smoke 5 all PASS, console has 0 ERROR (red) messages
- ❌ **FAIL (No-Go):** Any critical error in Smoke 1/2, chainHash break, 5xx rate spike, console full of errors → escalate to CTO

---

## Overview

This document contains manual smoke test scenarios for v1.3 post-deploy validation (Step 4 of DEPLOY_ROADMAP_v1.3.md).

**Pass Criteria:** All steps in each smoke test complete without error. No critical logs (5xx, chainHash mismatch, data loss).

---

## Test Environment Setup

### Pre-Flight Checklist

- [ ] Production URL accessible: `https://hmatologia2.web.app`
- [ ] Test lab account exists and is marked "staging" (recommend Riopomba or demo)
- [ ] Test user with RT role provisioned and logged in
- [ ] Browser DevTools open (Console tab for error monitoring)
- [ ] Cloud Logging dashboard open in parallel tab (filter: `severity>=ERROR`, project `hmatologia2`)
- [ ] Test PDF file ready (see **Test Data** section)
- [ ] Google Drive test folder created with 5 sample documents

### Test Data

#### Bioquímica — Sample PDF (Bula)

**Source:** BioPlus control material bula (commercial kit)  
**Fallback:** Synthetic PDF with structured text:

```
CONTROLE DE QUALIDADE INTERNO
NÍVEL 1: Média 95 mg/dL (SD 2.5)
NÍVEL 2: Média 150 mg/dL (SD 3.0)
NÍVEL 3: Média 250 mg/dL (SD 4.0)

Analitos:
- Glicose (GLI): Nível 1 (95±2.5), Nível 2 (150±3.0), Nível 3 (250±4.0)
- Ureia (URE): Nível 1 (25±1.0), Nível 2 (45±1.5), Nível 3 (70±2.0)

Lote: BIO-2026-001
Validade: 2026-12-31
Fabricante: BioPlus Diagnósticos
```

**Upload method:** `/bioquimica/upload-bula` → select PDF file → submit

#### SGD — Drive Folder

**Required:** 5 test documents in Google Drive folder (any existing folder in authenticated Drive account)

Document types (naming convention: `[TIPO] [NUMERO] [TITULO]`):

1. **MQ-001 Manual da Qualidade v1**
2. **PQ-002 Procedimento de Coleta**
3. **IT-003 Instrução de Uso do Analisador**
4. **FR-004 Formulário de Resultado**
5. **POL-005 Política de Controle Interno**

**Folder ID location:** In Google Drive, right-click folder → "Copy link" → extract folder ID from URL  
Example: `https://drive.google.com/drive/folders/1ABC...` → ID is `1ABC...`

---

## Smoke Test 1: Bioquímica End-to-End (CIQ Quantitativo)

**Duration:** ~10 min  
**Module:** `/bioquimica`  
**Features tested:** Seed analitos, bula parsing (Gemini), lot creation, run recording, Westgard validation, Levey-Jennings chart, chainHash

### Preconditions (verify before starting)

- [ ] Logged in as RT (test account: `staging-rt@lab.com` or equivalent; role must be `RT` in `/labs/{labId}/members`)
- [ ] Lab ID visible in top-right or settings (e.g., `staging-lab-2026`)
- [ ] No prior bioquímica runs on this lab (fresh test slate)
- [ ] Sample bula PDF ready (BioPlus or synthetic PDF from **Test Data** section)
- [ ] Browser DevTools open: Console tab active, Network tab recording

### Test Steps

#### Step 1: Access Bioquímica Admin & Verify Seed Analitos

**Action:**
1. In address bar, navigate to: `https://hmatologia2.web.app/bioquimica`
2. Page should load within 3 seconds
3. Look for table or card section labeled "Analitos" or "Glicose", "Ureia", etc.
4. If modal or loading state appears first, wait for content to render

**Expected Outcome:**
- Page loads without 404 or 500 error
- Table/list displays analitos with columns: **Sigla**, **Unidade**, **Range Biológico**, **Método**, **CV Alvo%**
- Exactly **16 analitos** visible:
  1. Glicose (GLI) - mg/dL
  2. Ureia (URE) - mg/dL
  3. Creatinina (CRE) - mg/dL
  4. TGO/AST (TGO) - U/L
  5. TGP/ALT (TGP) - U/L
  6. Fosfatase Alcalina (FA) - U/L
  7. GGT (GGT) - U/L
  8. Bilirrubina Direta (BT-D) - mg/dL
  9. Bilirrubina Indireta (BT-I) - mg/dL
  10. Colesterol Total (CT) - mg/dL
  11. HDL Colesterol (HDL) - mg/dL
  12. LDL Colesterol (LDL) - mg/dL
  13. Triglicerídeos (TG) - mg/dL
  14. Sódio (Na) - mEq/L
  15. Potássio (K) - mEq/L
  16. Cloro (Cl) - mEq/L
  17. Cálcio Total (Ca) - mg/dL
- Browser console shows **0 errors** (DevTools Console should be empty or only contain info/warn logs)
- Network tab shows request to Firestore (green, 200 OK, <1s)

**Troubleshooting if Fail:**
- **Blank page / 404**: Check URL spelled correctly. Verify lab is selected in top-right.
- **<16 analitos**: Seed function may not have run. Manually trigger via Cloud Console or admin panel.
- **Console errors** (red text): Screenshot error and check Cloud Logging at `severity>=ERROR`.

**Pass Criteria:** 16+ analitos visible, page loads <3s, console has 0 JavaScript errors  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 2: Upload & Parse Bula PDF (Gemini Integration)

**Action:**
1. On the Bioquímica page, look for button labeled "Enviar Bula" or "+ Adicionar Bula" or similar
2. Click button → file picker opens
3. Select test PDF file (`test-bula.pdf` from Test Data section)
4. Click "Abrir" or "Select"
5. Form submits; button shows spinner or "Analisando..." text
6. **WAIT up to 35 seconds** for parsing to complete (Gemini API can be slow)

**Expected Outcome (on success):**
- Spinner disappears
- Below form appears success panel showing:
  - **Lote:** `BIO-2026-001` (or your test file's value)
  - **Validade:** `2026-12-31`
  - **Fornecedor:** `BioPlus Diagnósticos` (or from your PDF)
  - **Níveis:** `1`, `2`, `3` (displayed as list or tabs)
  - **Stats table** with analitos (GLI, URE, CRE, TGO, etc.) and columns: `Nível`, `Média`, `SD`
- Network tab shows 1 POST to Cloud Function `parseBulaBioquimica`, response ≈5–30s, status 200
- Console shows 0 JavaScript errors

**Troubleshooting if Fails:**
- **Spinner hangs >35s**: Gemini API may be timing out. Check Cloud Logging for `parseBulaBioquimica` errors. Refresh page and try lightweight synthetic PDF.
- **Parse shows empty/partial stats**: PDF may lack clear analito names or numeric values. Re-check PDF content matches format in **Test Data**.
- **Error message**: "Timeout ao analisar bula" → expected, retry; "Invalid PDF" → file may be corrupted; "GEMINI_API_KEY not set" → contact DevOps.

**Pass Criteria:** Parsing completes <35s, lote/validade/fornecedor populated, manufacturerStats contains ≥3 analitos with mean/sd  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 3: Create Lot from Parsed Bula

**Action:**
1. On the parsed bula panel, locate button "Usar esta Bula" or "Criar Lote" (primary button, likely green/blue)
2. Click button → modal appears with form
3. Form should be pre-filled with:
   - **Lote:** `BIO-2026-001`
   - **Validade:** `2026-12-31`
   - **Níveis:** 1, 2, 3 (shown as tabs or checkboxes, pre-selected)
4. **Equipamento field:** Look for dropdown or autocomplete labeled "Equipamento" or "Analisador"
   - Select any visible equipment (e.g., "Sysmex XN-550" or "Analisador 1")
   - If no equipamentos exist, create one first (outside this test) or skip
5. Scroll down to "Criar Lote" or "Salvar" button
6. Click button; modal should close within 2 seconds

**Expected Outcome (on success):**
- Modal closes
- Page returns to Bioquímica main view
- Navigate to "Lotes" section (tab or sidebar link)
- New lot visible in table with:
  - **Lote:** `BIO-2026-001`
  - **Validade:** `2026-12-31`
  - **Status:** `EM USO` (green badge)
  - **Equipamento:** Your selected device
  - **Níveis:** `3` or list [1,2,3]
- Network tab: 1 request to Firestore (Cloud Function or direct write), status 200, <2s
- Console shows 0 JavaScript errors

**Troubleshooting if Fails:**
- **Modal shows validation error** "Lote já existe": The lote number is already in use. In Test Data section, append a unique suffix (e.g., `BIO-2026-001-TEST-2`) and retry.
- **"Equipamento required" error**: Equipment must exist in your lab. Create one via admin panel first, or contact CTO.
- **Modal hangs >5s**: Check Network tab for stalled request. Refresh page and retry.
- **Duplicate Lote message appears**: Expected if you re-run this test with same PDF. Use new lote number in next iteration.

**Pass Criteria:** Lot created, visible in Lotes list with status `EM USO`, all fields populated from bula  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 4: Record a New Corrida (Run)

**Action:**
1. On the Bioquímica page, navigate to "Runs" or "Corridas" section (tab or button)
2. Click "+ Nova Corrida" or "Record Run" button
3. Form appears with multiple fields — fill out in order:
   - **Lote (required dropdown):** Select the lot created in Step 3 (e.g., `BIO-2026-001`)
   - **Equipamento (dropdown):** Should auto-populate from the lot's equipment; verify it's the same one from Step 3
   - **Nível (radio or dropdown):** Select `Nível 1` (or any level, e.g., "Nível 1")
   - **Analitos (checkboxes or multi-select):** Check exactly 3:
     - ☑ Glicose (GLI)
     - ☑ Ureia (URE)
     - ☑ Creatinina (CRE)
   - **Result Values (input fields, now appearing for selected analitos):**
     - **GLI:** type `95` (within manufacturer range)
     - **URE:** type `25` (within manufacturer range)
     - **CRE:** type `0.8` (within manufacturer range)
4. Scroll to bottom and click "Gravar Corrida" or "Salvar" button

**Expected Outcome (on success):**
- Form submits within 2 seconds
- Response from Cloud Function `recordRunBioquimica` arrives (Network tab shows POST, status 200)
- Modal/form closes
- Run appears in runs list (may need to refresh page) with:
  - **Lote:** `BIO-2026-001`
  - **Nível:** `1`
  - **Analitos:** GLI, URE, CRE (count = 3)
  - **Status:** `APROVADA` (green, if Westgard OK) or `PENDENTE_REVISAO` (yellow/orange, if warning)
  - **Timestamp:** Current time (now)
  - **Equipment:** Your selected device
  - **Hash icon** or indicator showing run is signed
- Console shows 0 JavaScript errors
- Network tab shows response includes `chainHash` field with 64-character hex string

**Troubleshooting if Fails:**
- **Validation error** "GLI out of range for Nível 1": Bula manufacturer stats may be different. Check lot details and adjust value (e.g., try 100 instead of 95).
- **"Lote not found" or dropdown empty**: No lot created in Step 3. Go back and retry Step 3.
- **Form hangs >5s on submit**: Check Network tab for stalled request. Refresh and retry.
- **No chainHash in response**: Server-side issue. Check Cloud Logging for `recordRunBioquimica` errors.

**Pass Criteria:** Run recorded and visible in list, status is `APROVADA` or `PENDENTE_REVISAO`, chainHash present, no JS errors  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 5: View Levey-Jennings Chart

**Action:**
1. On the Bioquímica page, navigate to "Gráfico" or "Levey-Jennings" tab/button
2. Look for dropdown or filter to select:
   - **Analito:** Select `Glicose (GLI)`
   - **Nível:** Select `Nível 1`
   - **Equipamento:** Select the equipment from Step 3/4
3. Chart should render within 2 seconds

**Expected Outcome (on success):**
- Chart displays with:
  - **Title:** e.g., "Levey-Jennings — Glicose (GLI) — Nível 1"
  - **X-axis:** Sequential run numbers or timestamps (1, 2, 3…)
  - **Y-axis:** Numeric scale (e.g., 80–110 for GLI in % of mean)
  - **Data point:** Exactly 1 point plotted (your run from Step 4) at y-value ≈0% (on the mean line)
  - **Control lines:** 
    - Horizontal line at y=0 (mean, blue or black)
    - Dashed lines at ±1SD, ±2SD, ±3SD (gray or colored)
  - **Legend:** Shows which lines represent which control limits
- Hover your mouse over the data point:
  - Tooltip appears showing: Analito, Value, Nível, Run Date, Equipamento
- Chart is interactive and responsive:
  - Resize browser window → chart reflows (not broken)
  - No console JavaScript errors
  - Network tab shows 1–2 GET requests for chart data, all status 200

**Troubleshooting if Fails:**
- **Chart is blank / axis-only**: Run data may not have loaded. Check Network tab for failed Firestore reads. Refresh and retry Step 5.
- **Point not visible**: Run data loaded but not plotted. Check run status in list (Step 4) — must be `APROVADA` or `PENDENTE_REVISAO`, not `RASCUNHO`.
- **Control lines missing**: Chart library may not be rendering them. Refresh page. If persists, check Cloud Logging for errors.
- **Tooltip doesn't appear on hover**: Chart library interaction issue. Try clicking point instead. Screenshot and document.

**Pass Criteria:** Chart renders within 2s, 1 point visible on mean line, ±1SD/±2SD/±3SD lines drawn, tooltip functional on hover  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 6: Verify ChainHash Signature in Firestore (Optional — Compliance Check)

**Action:**
1. Open new tab: `https://console.firebase.google.com/project/hmatologia2/firestore`
2. Log in with CTO credentials if prompted
3. In Firestore console, navigate using path bar:
   - Click "labs" collection
   - Select your lab ID (e.g., `staging-lab-2026`)
   - Click "bioquimica" collection
   - Click "root" document
   - Click "runs" collection
   - Select your run ID (look for most recent timestamp)
   - Check if "events" subcollection exists (may be collapsed)
4. Expand "events" subcollection → Click latest event document

**Expected Outcome:**
- Event document visible with fields:
  - **operacao:** `RUN_RECORDED` (or similar)
  - **assinatura.hash:** 64-character hexadecimal string (all 0–9, a–f)
  - **assinatura.operatorId:** Your user UID (matches the one logged in via UI)
  - **assinatura.ts:** Recent timestamp (within 1 minute of now)
  - **dadosOriginais:** Snapshot of original run data (nested object)
  - **criadoEm:** Recent timestamp
  - **deletadoEm:** null or not present (append-only, never deleted)

**Troubleshooting if Fails:**
- **No events subcollection**: Writes may not be happening server-side. Check Cloud Logging for `recordRunBioquimica` errors. Contact DevOps.
- **Hash looks wrong** (not 64 hex chars): Cryptographic signing issue server-side. Check Cloud Function logs.
- **operatorId mismatch**: Auth issue — user UID may be wrong. Check `/labs/{labId}/members` doc for correct UID.

**Pass Criteria:** Event exists with valid 64-char hex hash, operatorId matches logged-in user, assinatura.ts within 1 min of now  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 7: Validate ChainHash via CLI (Optional — DevOps Only)

**Action (for ops/deployment team only; skip if non-technical tester):**
1. Open terminal in project root (`C:\hc quality\`)
2. Run: `npm run verify-chain -- --labId staging-lab-2026 --module bioquimica --docId {runId}`
   - Replace `{runId}` with the run ID from Step 4 (check Firestore or run list)
3. Wait for script to complete (5–15 seconds)

**Expected Outcome:**
- Script exits with code 0 (success)
- Terminal output shows:
  ```
  ✓ ChainHash VALID
  ├ Stored hash:    abc123...def456 (64 chars)
  ├ Computed hash:  abc123...def456 (matches)
  ├ Operator UID:   {your UID}
  └ Verified:       2026-05-06T14:30:00Z
  ```
- No mismatch or tamper warnings

**Troubleshooting if Fails:**
- **Script not found**: `verify-chain` script may not be in `package.json`. Ask DevOps to add it.
- **Hash mismatch error**: Run data may have been tampered or corrupted. Contact CTO — DO NOT CONTINUE TESTING.
- **"Run not found"**: Check runId is correct in Firestore console (Step 6).

**Pass Criteria:** Script exits 0, computed hash matches stored hash, no tamper warnings  
**Sign Off:** ☐ Pass ☐ Fail ☐ Skipped | **Notes:** ___________________________________

---

### Smoke 1 Summary Checklist

| Step | Component | Expected | Est. Time | Status |
|------|-----------|----------|-----------|--------|
| 1 | Load Analitos | 16 visible in table | 2 min | ☐ Pass ☐ Fail |
| 2 | Parse Bula (Gemini) | Stats extracted, <35s | 3 min | ☐ Pass ☐ Fail |
| 3 | Create Lot | Status `EM USO`, visible | 2 min | ☐ Pass ☐ Fail |
| 4 | Record Run | chainHash present, `APROVADA` | 2 min | ☐ Pass ☐ Fail |
| 5 | Levey-Jennings Chart | 1 point on mean, lines, tooltip | 1.5 min | ☐ Pass ☐ Fail |
| 6 | Verify ChainHash | 64-char hex hash, operatorId match | 1 min | ☐ Pass ☐ Fail |
| 7 | CLI Verify (optional) | Script exits 0, hashes match | 1 min | ☐ Pass ☐ Fail |

**Overall Smoke 1 Result:** ☐ PASS ☐ FAIL  
**Total Time:** _________________ (target: ≤10 min, max 12 min)  
**Failed Steps (if any):** _____________________________________________

---

## Smoke Test 2: SGD Drive Importer (Gestão de Documentos Externos)

**Duration:** ~12 min  
**Module:** `/sgd` (or `/sgq/importar-drive` — check deployment routing)  
**Features tested:** OAuth consent flow, Drive folder listing, document preview, batch import, status transitions, search/filter

### Preconditions (verify before starting)

- [ ] Logged in as RT (same account as Smoke 1, test@lab.com or staging-rt@lab.com)
- [ ] Lab ID visible and matches Smoke 1 (e.g., `staging-lab-2026`)
- [ ] Google Drive account accessible from the same machine/browser
- [ ] Google Drive test folder ready with **exactly 5 documents** (see **Test Data** section for creation steps)
- [ ] Test folder **ID copied** and ready (e.g., `1ABC...xyz`)
- [ ] Browser DevTools open: Console tab active, Network tab recording
- [ ] No prior SGD documents in this lab (clean slate preferred)

### Test Steps

#### Step 1: Navigate to Drive Importer

**Action:**
1. In address bar, navigate to: `https://hmatologia2.web.app/sgd` (or `/sgq` — check routing doc)
2. Page should load within 3 seconds
3. Look for button "Importar de Drive", "Sincronizar Drive", "+ Novo", or similar
4. If no button visible, look for menu icon (⋮) or "Actions" dropdown
5. Click button/option labeled with "Drive" or "Importar"

**Expected Outcome:**
- Page/modal loads showing "Importar Documentos de Drive" or "Drive Importer"
- **Step 1** of wizard visible with title like "Selecionar Pasta" or "Conectar ao Drive"
- Form shows:
  - Text: "Conecte sua conta Google Drive para continuar" (or similar)
  - **Button:** "Conectar ao Google Drive" (blue/primary color)
  - Optional: Folder ID input field (for manual entry)
- Console shows 0 JavaScript errors
- Network tab shows page load requests all completed (200 OK)

**Troubleshooting if Fails:**
- **Page not found (404)**: Route may be different. Check routing in `AuthWrapper.tsx` or `AppRouter.tsx`.
- **Button not visible**: Feature may be behind feature flag or not deployed. Refresh and clear browser cache.

**Pass Criteria:** Page loads, Step 1 of wizard visible, "Conectar" button present, no console JS errors  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 2: Initiate OAuth Flow (Google Consent Screen)

**Action:**
1. Click the blue "Conectar ao Google Drive" button
2. Browser should open popup window or new tab within 2 seconds
3. Popup shows Google sign-in/consent screen
4. If you're already logged into Google in this browser, you may see account selector

**Expected Outcome:**
- Popup opens with URL starting with `accounts.google.com` or `consent.google.com`
- Screen title: "Google" or app name (e.g., "HC Quality")
- Shows text like "wants to access your Google Drive" or "Request for permission"
- **Scopes listed:** "View files in your Google Drive" (read-only, no write)
- **Buttons:** "Cancel" and "Allow" (or "Permitir" in Portuguese)
- No 403 Forbidden or 401 Unauthorized errors
- Network tab shows 1–2 redirects (301/302), all successful

**Troubleshooting if Fails:**
- **Popup blocked**: Browser may have blocked popup. Check address bar for popup blocker icon. Allow popups and retry.
- **Blank white screen in popup**: Google service may be slow. Wait 3s; if still blank, close and retry.
- **"Invalid client" error**: OAuth credentials misconfigured in Cloud Console. Contact DevOps.
- **Consent screen shows different app name**: This is expected if your OAuth app name is custom. Verify scopes are "Drive read-only".

**Pass Criteria:** Popup opens with Google consent screen, scopes visible, "Allow" button present  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 3: Authorize & OAuth Callback

**Action:**
1. On the Google consent screen, locate "Allow" or "Permitir" button (usually blue/green on right side)
2. Click button
3. Google processes authorization (1–2 seconds)
4. Browser redirects automatically back to HC Quality (`hmatologia2.web.app`)
5. **Stay on the page** — do not close popup or refresh

**Expected Outcome:**
- Popup closes automatically
- Page returns to HC Quality, stays at `/sgd` or `/sgq/importar-drive`
- **Wizard advances to Step 2:** "Selecionar Pasta do Drive" or "Choose Folder"
- New form visible with **Folder ID input field**:
  - Text field labeled "ID da Pasta" or "Folder ID"
  - Submit button "Listar Documentos" or "List Files"
  - Alternative: Dropdown list of Drive folders already loaded
- Network tab shows request to `https://hmatologia2.web.app/api/sgq/oauth-callback`, response 200 (or 302 redirect)
- Console shows 0 JavaScript errors
- Page loads within 3 seconds

**Troubleshooting if Fails:**
- **Popup closes but page stays on Step 1**: OAuth may not have completed. Refresh and retry.
- **Error message** "State token mismatch" or "Invalid state": CSRF protection issue. Clear browser cookies for `accounts.google.com` and retry.
- **Redirect takes >10s**: Network issue. Check Cloud Function logs for `oauthCallbackDrive`.
- **"Access denied"**: User revoked permission. Re-authorize by clicking "Conectar" again.

**Pass Criteria:** OAuth completes <5s, redirect successful, wizard advances to Step 2, Folder ID input visible, no errors  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 4: Select Folder & List Documents

**Action:**
1. In wizard Step 2 form, locate the **Folder ID input field** (labeled "ID da Pasta" or "Folder ID")
2. Click field and paste your test folder ID (from **Test Data** section):
   - Example: `1ABC123defGHI456jklMNO789pqrSTU`
   - Copy from: Google Drive test folder → right-click → Share → copy link → extract ID after `/folders/`
3. Click "Listar Documentos" or "Load Files" button
4. **Wait 5–10 seconds** for file listing to complete (Cloud Function processes the request)

**Expected Outcome (on success):**
- Loading spinner appears briefly
- After 5–10s: Table renders showing **exactly 5 documents**:
  1. **MQ-001** Manual da Qualidade v1
  2. **PQ-002** Procedimento de Coleta
  3. **IT-003** Instrução de Uso do Analisador
  4. **FR-004** Formulário de Resultado
  5. **POL-005** Política de Controle Interno
- Table columns: **Checkbox** ☐ | **Código** | **Tipo** | **Título** | **Arquivo** (icon/name)
- Each row is clickable (preview on click)
- All 5 rows have checkboxes (unchecked by default)
- Network tab shows POST to Cloud Function `listarDocsDrive`, response 200, <10s
- Console shows 0 JavaScript errors

**Troubleshooting if Fails:**
- **"Folder not found"**: Folder ID invalid or permission denied. Verify ID is correct (copy from Drive URL again).
- **List is empty** (0 documents): Folder exists but has no files. Verify you created 5 test documents in the folder.
- **Timeout >15s**: Cloud Function may be slow or failing. Check Cloud Logging for `listarDocsDrive` errors.
- **"Permission denied" error**: OAuth scope may be missing or revoked. Go back to Step 2 and re-authorize.
- **Only shows <5 docs**: Some files may be missing from Drive. Add them and retry.

**Pass Criteria:** Exactly 5 documents listed, all fields visible, all rows have checkboxes, no errors, <10s load time  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 5: Preview Documents (Sample Preview of 3 Documents)

**Action:**
1. In the document table from Step 4, locate the first document: **MQ-001 Manual da Qualidade v1**
2. Click the row or look for a "preview" icon (👁 or 🔍) on that row
3. Modal/panel should open within 2 seconds
4. Preview panel shows document content
5. Note the metadata displayed (size, modified date, MIME type)
6. Close modal (click X or press ESC)
7. **Repeat preview for 2 more documents** (e.g., PQ-002 and IT-003)

**Expected Outcome (per document):**
- Modal opens with title "Preview — {document name}"
- Content area shows:
  - **For PDF:** Embedded PDF viewer (may show first page thumbnail or text extraction)
  - **For Google Docs:** Rendered document content
- **Metadata section** shows:
  - Código: `MQ-001` (or respective)
  - Tipo: `Manual da Qualidade`
  - Título: `Manual da Qualidade v1`
  - Tamanho: e.g., "2.5 MB"
  - Data de Modificação: e.g., "2026-05-05 14:30"
- Modal closes cleanly on X click or ESC key (no hang)
- Content loads within 3 seconds per document
- Console shows 0 JavaScript errors

**Troubleshooting if Fails:**
- **Preview blank/white**: PDF may be image-heavy. Try another document.
- **Modal hangs >5s**: Network issue or slow Drive API. Check Network tab for stalled requests.
- **Content doesn't render**: File format may not be supported. Drive Viewer should support PDF/Google Docs; image PDFs may not show text extraction.
- **Modal doesn't close**: Browser/React issue. Refresh page and retry.

**Pass Criteria:** Preview modal opens within 2s per doc, metadata visible, content renders (full/partial acceptable), modal closes cleanly, 3+ docs previewed  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 6: Select All 5 Documents & Initiate Batch Import

**Action:**
1. Return to document table from Step 4 (if closed, re-enter wizard Step 2)
2. At the **table header**, find checkbox to "Select All" (usually in header row, left side)
3. Click header checkbox to select all 5 documents at once (should change from ☐ to ☑)
4. Verify all 5 rows are now checked (☑)
5. Below table, look for button "Aprovar Importação", "Importar Selecionados", or "Next Step"
6. Click button
7. **Wizard advances to Step 3** (review/confirmation page)

**Expected Outcome (Step 3 - Review):**
- Page shows summary: "Revisar Importação" or "Review Import"
- Summary displays:
  - **Count:** "5 documentos selecionados"
  - **List** showing all 5 document codes and titles:
    - MQ-001 Manual da Qualidade v1
    - PQ-002 Procedimento de Coleta
    - IT-003 Instrução de Uso do Analisador
    - FR-004 Formulário de Resultado
    - POL-005 Política de Controle Interno
  - **Expected status:** "Status inicial: `rascunho` (Você poderá publicar depois)"
  - **Checkbox:** "Concordo com a importação" or consent statement
- Buttons: "Voltar" (back), "Confirmar Importação" (primary, blue)
- No errors in console

**Action (continued):**
8. Review the summary
9. Check the consent checkbox at bottom ("Concordo..." or similar)
10. Click "Confirmar Importação" button

**Expected Outcome (Step 3 to completion):**
- Progress bar appears: "Importando documentos..." with percentage
- After 10–30 seconds: All 5 documents imported successfully
- Success message: "✓ 5 documentos importados com sucesso!"
- Wizard closes or shows button "Ver Documentos" / "Go to List"
- Cloud Function `aprovarBatchImport` completed (Network tab shows POST, response 200)
- **Firestore writes completed:**
  - 5 new documents in `/labs/{labId}/sgd-externos/`
  - 5 audit entries in `/labs/{labId}/sgd-externos-audit/`
- Console shows 0 JavaScript errors

**Troubleshooting if Fails:**
- **"Documento duplicado" error**: One or more codes already exist in your lab. Use unique codes in next test (add suffix like `-TEST`).
- **Progress bar hangs >45s**: Cloud Function may be timing out. Check Cloud Logging for `aprovarBatchImport` errors.
- **Partial import** (only 3/5 succeed): Some documents may have invalid data. Check Cloud Logging for per-document error details.
- **Auth error**: User may have lost Drive access. Go back to Step 2 and re-authorize.

**Pass Criteria:** All 5 documents imported, success message displayed, status is `rascunho`, no errors, <30s completion time  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

#### Step 7: Publish Documents & Verify Search

**Action (Part A - Navigate to Document List):**
1. Click button "Ver Documentos" (from Step 6 success screen) or navigate to `/sgd` or `/sgq/lista-mestra`
2. Page shows table with all 5 imported documents
3. Table columns: **Status** | **Código** | **Título** | **Tipo** | **Ações** (menu or buttons)
4. All 5 documents show status **`rascunho`** (gray badge, meaning draft/unpublished)

**Action (Part B - Publish First Document):**
5. Click the first document row (MQ-001) or the "..." menu for that row
6. Click "Publicar", "Aprovar para Vigência", or "Transition to Published"
7. Confirmation modal appears: "Tem certeza? Publicar este documento?"
8. Click "Sim, publicar" or "Confirmar"
9. Modal closes; document status changes to **`vigente`** (green badge, meaning active/published)
10. Audit event logged (may see toast notification or silent write)
11. **Repeat for remaining 4 documents** (publish each one)

**Expected Outcome (after publishing all 5):**
- All 5 documents now show status **`vigente`** (green badges)
- Each row shows:
  - ☑ Status: `vigente`
  - Código: MQ-001, PQ-002, IT-003, FR-004, POL-005
  - Título: (from Drive)
  - Tipo: (classified, e.g., Manual, Procedimento, Instrução, etc.)
  - Actions menu (⋮) for additional options
- Network tab shows 5 PATCH requests (one per doc) and 5 POST requests (audit logs), all status 200
- Console shows 0 JavaScript errors
- Each transition completes <3 seconds

**Action (Part C - Search & Filter):**
12. At the top of the table, locate search box or filter field (labeled "Pesquisar...", "Search", or icon 🔍)
13. Click search field
14. Type: `MQ`
15. Table should filter to show **only 1 document**: MQ-001 Manual da Qualidade v1
16. Clear search field (delete text or click X)
17. Table returns to showing all 5 documents
18. Try another search: type `Procedimento`
19. Table filters to show **only 1 document**: PQ-002 Procedimento de Coleta

**Expected Outcome (search functionality):**
- Search is real-time (filters as you type, <500ms)
- Searches title, código, and other fields
- Case-insensitive: "mq" finds "MQ-001"
- Clears quickly: deleting text shows full list within 1s
- Console shows 0 JavaScript errors

**Troubleshooting if Fails:**
- **Publish button not visible**: May require admin/RT role. Check user permissions in `/labs/{labId}/members` doc.
- **Transition hangs >5s**: Check Cloud Logging for `updateDocumentStatus` or similar function errors.
- **Status doesn't change after publish**: Page may not have refreshed. Refresh browser and check Firestore console.
- **Search not filtering**: May be disabled or slow. Check Firestore query performance in Network tab.

**Pass Criteria:** All 5 docs transition to `vigente` <3s each, search filter works (type "MQ" → 1 result), no console errors, audit events logged  
**Sign Off:** ☐ Pass ☐ Fail | **Notes:** ___________________________________

---

### Smoke 2 Summary Checklist

| Step | Component | Expected | Status |
|------|-----------|----------|--------|
| 1 | Navigate to SGD | Page loads, OAuth button visible | ☐ Pass ☐ Fail |
| 2 | OAuth Initiate | Google consent screen appears | ☐ Pass ☐ Fail |
| 3 | OAuth Callback | Redirect <5s, wizard Step 2 loads | ☐ Pass ☐ Fail |
| 4 | List Documents | Exactly 5 docs listed with all fields | ☐ Pass ☐ Fail |
| 5 | Preview Documents | 3+ previews open/close cleanly, <3s each | ☐ Pass ☐ Fail |
| 6 | Batch Import | All 5 imported, status `rascunho` | ☐ Pass ☐ Fail |
| 7 | Publish All & Search | All 5 → `vigente`, search filters work | ☐ Pass ☐ Fail |

**Overall Smoke 2 Result:** ☐ PASS ☐ FAIL  
**Total Time:** _________________ (target: ≤12 min)  
**Failed Steps (if any):** _____________________________________________  
**Error Summary:** ____________________________________________________

---

## Smoke Test 3: Reclamação Multi-Channel (Bonus/Optional)

**Duration:** ~8 min  
**Module:** `/reclamacoes` + public form  
**Features tested:** Public submission, Gemini classification, state machine, NPS trigger

*Note: This is listed in DEPLOY_ROADMAP as Smoke 3; execute if time permits during 24h validation window.*

### Steps (Abbreviated)

1. **Public form submission** → anonymous reclamação → protocol returned
2. **Login as RT** → `/reclamacoes` → new reclamação visible
3. **Classification** → Gemini auto-classification populated
4. **State transitions** → Nova → Analisando → Resolvida
5. **NPS triggered** → check `/labs/{labId}/satisfacao-respostas/` for new NPS entry
6. **NPS response** → public link works, response stored

**Pass Criteria:** Public form works, RT sees reclamação, state transitions, NPS triggered

---

## Smoke Test 4: Liberação State Machine (Bonus/Optional)

**Duration:** ~5 min  
**Module:** `/liberacao`  
**Features tested:** Laudo creation, state transitions, signature gate

*Note: PDF generation and portal médico deferred to v1.4.*

### Steps (Abbreviated)

1. Pick an approved bioquimica run (from Smoke 1)
2. Trigger laudo creation
3. State: `Pendente` → `Em Revisão` (signature gate)
4. Sign as RT
5. State: `Em Revisão` → `Liberado`
6. Verify event in `/labs/{labId}/bioquimica-runs/{id}/versions`

**Pass Criteria:** State transitions work, signature recorded, event chain valid

---

## Smoke Test 5: Regression (Existing Modules)

**Duration:** ~10 min  
**Modules:** analyzer, coagulacao, auditoria, treinamentos, educacao-continuada  
**Goal:** Spot-check that v1.2 modules still function

### Checklist

- [ ] `/analyzer` — OCR flow loads, upload button present
- [ ] `/coagulacao` → select run → chart loads
- [ ] `/auditoria` → checklist visible, no errors
- [ ] `/treinamentos` → list view renders
- [ ] `/educacao-continuada` → colaboradores list loads

**Pass Criteria:** All routes load, no 500 errors, no console JS errors in DevTools

---

---

## Final Validation: Browser Console Check (Required)

**CRITICAL:** After completing all smoke tests, perform this final check.

**Action:**
1. Keep browser DevTools open (Console tab)
2. Scan the entire console output for **ERROR** (red 🔴 text)
3. Ignore **WARNINGS** (yellow ⚠️) and **INFO** messages (blue ℹ️) — these are acceptable
4. Look specifically for:
   - `Uncaught Error`
   - `Uncaught TypeError`
   - `Uncaught ReferenceError`
   - `Failed to fetch`
   - `ChainHash mismatch`
   - `Security: Credentials mode is 'include'...` (spam warning, OK to ignore)

**Expected Outcome:**
- Console shows **0 red ERROR messages** related to the application
- May show 1–2 info logs like `[Firebase] Auth... initialized`
- May show warnings from third-party libs (Tailwind, analytics, etc.) — these are OK

**If Errors Found:**
1. Screenshot the error (Ctrl+PrtScn or F12 screenshot tool)
2. Note the **exact error text**
3. Check if error occurs in multiple modules or just one
4. **Failure Level:**
   - 🔴 **Critical:** `ChainHash mismatch`, `Uncaught`, `data loss` → STOP, escalate to CTO
   - 🟠 **High:** Module-specific errors (bioquimica module fails, SGD not loading) → Document, continue with next module
   - 🟡 **Medium:** Third-party warnings, deprecated API calls → Log, continue

**Pass Criteria:** 0 application ERROR messages (red text), only INFO/WARNING acceptable  
**Sign Off:** ☐ Pass (0 errors) ☐ Fail (errors found) | **Error Count:** _____ | **Types:** _____________________

---

## Post-Deploy Validation Checklist

### Immediate (after deploy, before Smoke 1)

- [ ] `https://hmatologia2.web.app` loads without 404 or 503
- [ ] Browser DevTools → Console: no red errors on page load
- [ ] Service Worker updated (DevTools → Application → Service Workers → version bumped)
- [ ] Cloud Logging dashboard: no `severity=ERROR` spike in first 5 min
- [ ] Firebase Console → Hosting: deployment timestamp = now

### During Smoke Tests (all 5)

- [ ] Cloud Logging: continuous monitoring for ERROR or CRITICAL
- [ ] Network tab: no 5xx responses
- [ ] Browser Console: no unhandled Promise rejections
- [ ] Performance: page loads <2.5s (LCP), interactions <200ms (INP)

### After All Smokes Pass

- [ ] Document per-smoke pass/fail status (template below)
- [ ] Screenshot any failures (console error, UI anomaly)
- [ ] Check if any non-blocking warnings (yellow/blue) need escalation
- [ ] Confirm on-call engineer ready for next 24h

---

## Pass/Fail Reporting Template

After completing all smoke tests, fill this section:

### Smoke 1: Bioquímica E2E

**Status:** ☐ PASS ☐ FAIL  
**Steps Passed:** 1, 2, 3, 4, 5, 6, 7 (circle passed)  
**Failed Step (if any):** _____________  
**Error Message (if any):** _____________  
**Screenshots/Logs:** (link or note)

### Smoke 2: SGD Drive Importer

**Status:** ☐ PASS ☐ FAIL  
**Steps Passed:** 1, 2, 3, 4, 5, 6, 7 (circle passed)  
**Failed Step (if any):** _____________  
**Error Message (if any):** _____________  
**Screenshots/Logs:** (link or note)

### Smoke 3: Reclamação (if executed)

**Status:** ☐ PASS ☐ FAIL ☐ NOT RUN  
**Key Issue (if any):** _____________

### Smoke 4: Liberação (if executed)

**Status:** ☐ PASS ☐ FAIL ☐ NOT RUN  
**Key Issue (if any):** _____________

### Smoke 5: Regression

**Status:** ☐ PASS ☐ FAIL ☐ PARTIAL  
**Modules Verified:** analyzer, coagulacao, auditoria, treinamentos, educacao-continuada  
**Failed Module (if any):** _____________

### Overall Post-Deploy Result

**Date/Time:** _____________  
**Tester (RT name):** _____________  
**Cloud Logging Review (any errors?):** ☐ Clean ☐ Warnings ☐ Errors  
**Approval:** ☐ Ready for next 24h ops ☐ Escalate issue

---

## Known Issues & Workarounds

### Bioquímica

1. **Bula PDF parsing timeout (>30s)**
   - **Cause:** Gemini API slow or overloaded
   - **Workaround:** Retry; use synthetic/text PDF if commercial bula unavailable
   - **Check:** Cloud Logging filter `function=parseBulaBioquimica` for actual duration

2. **ChainHash mismatch on verification**
   - **Cause:** Run data mutated between creation and verification
   - **Workaround:** Do not manually edit runs in Firestore; re-record
   - **Escalation:** Investigate data integrity in Cloud Logging

3. **Westgard status unexpected (OK when should warn)**
   - **Cause:** Bula stats not loaded or incorrect
   - **Workaround:** Verify bula parse succeeded in Step 2, check stats in lot doc
   - **Check:** Lot doc field `nivelControle[0].manufacturerStats` populated

### SGD Drive Importer

1. **OAuth consent screen does not appear**
   - **Cause:** Popup blocked by browser, or state token expired
   - **Workaround:** Allow popups; refresh and restart flow
   - **Check:** Browser console for blocked popup warnings

2. **Drive folder returns 0 documents**
   - **Cause:** Folder ID invalid, or folder empty, or permission denied
   - **Workaround:** Verify folder ID; ensure 5 test docs in folder; re-authorize
   - **Check:** Cloud Function logs `listarDocsDrive` for 403 Forbidden

3. **Duplicate código error on import**
   - **Cause:** Documento with same código already exists in vigente/rascunho
   - **Workaround:** Use unique códigos in Drive test folder (e.g., add timestamp suffix)
   - **Check:** RN-SGQ-01 validation in service

### Général

1. **Service Worker caching stale content after deploy**
   - **Cause:** Browser cached old SW before deploy
   - **Workaround:** Hard reload (Ctrl+Shift+R) or uninstall PWA; clear site data
   - **Check:** DevTools → Application → Service Workers → version should be new hash

2. **Firestore rules reject legitimate reads**
   - **Cause:** User not marked as active member of lab
   - **Workaround:** Verify user in `/labs/{labId}/members` doc with `isActiveMemberOfLab: true`
   - **Escalation:** Stop testing and provision user claim

---

## Escalation Path

If any smoke test fails:

1. **Severity Level Assessment:**
   - **Critical (🔴):** Data loss, chainHash break, rules lockout, 5xx rate >5%
   - **High (🟠):** UI broken, performance degraded, regression in v1.2 module
   - **Medium (🟡):** Cosmetic, non-blocking warning, incomplete feature (deferred to v1.4)

2. **Action:**
   - Document in **Pass/Fail Reporting** section above
   - Screenshot + console logs
   - Post to deployment channel (Slack/Discord/internal)
   - If **Critical**: initiate **Rollback Procedure** (Section 4, DEPLOY_ROADMAP_v1.3.md)
   - If **High/Medium**: log as post-deploy bug; schedule fix; continue monitoring

3. **No Go-Live Criteria:**
   - Critical smoke test fail + no clear workaround = **HOLD deployment**
   - Notify CTO + ops team; revert to v1.2 if necessary

---

## Appendix: Manual Test Lab Setup

### Lab Account Creation (if needed)

```
Email: staging-lab@test.hc.com (or Riopomba production account if available)
Role: RT (Responsável Técnico)
Lab ID: labs/{labId_staging}
Modules: all (bioquimica, sgq, reclamacoes, etc.)
```

### Test Data Cleanup (post-test)

- Delete test runs/lots from `/labs/{labId}/bioquimica/**` to avoid contamination
- Mark test documents in SGD as obsoleto (do not delete for audit trail)
- Clear test reclamação entries if created
- Do NOT delete test lab account (preserve for future regression testing)

### Monitoring Links

- **Cloud Logging:** `https://console.cloud.google.com/logs/query?project=hmatologia2&query=severity%3D%22ERROR%22`
- **Firebase Console:** `https://console.firebase.google.com/project/hmatologia2`
- **Hosting Deployments:** `https://console.firebase.google.com/project/hmatologia2/hosting/main`
- **Functions Logs:** `https://console.cloud.google.com/functions?project=hmatologia2`

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-06  
**Status:** Ready for Manual Execution  
**Next Review:** After v1.3 deploy completion
