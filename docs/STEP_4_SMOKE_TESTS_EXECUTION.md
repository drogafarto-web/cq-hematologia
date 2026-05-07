---
title: Step 4 — Smoke Test Execution Guide (Post-Deploy)
version: 1.0
format: Flight Checklist — Top-to-Bottom Execution
status: Ready to execute (after Step 2 functions deploy completes)
date: 2026-05-06
owner: CTO (drogafarto)
---

# Step 4 — Smoke Test Execution Guide

**Duration:** 90 minutes total (30 min core tests + 30 min buffer + 30 min monitoring)  
**Tester Name:** _________________ | **Start Time:** _________________ | **End Time:** _________________

---

## PRE-EXECUTION CHECKLIST (5 min)

### ☐ Step 2 Deployment Complete

Before starting smoke tests, verify Step 2 finished successfully:

- [ ] Firebase Console → Cloud Functions: https://console.cloud.google.com/functions?project=hmatologia2
  - All 32 functions show status **ACTIVE** (green checkmark)
  - Refresh page if needed (wait up to 2 min for propagation)
  - **If any function shows ERROR (red):** STOP. Wait for Agente 2 to fix deploy.

- [ ] Hosting deployed
  - Firebase Console → Hosting: https://console.firebase.google.com/project/hmatologia2/hosting/main
  - Latest deployment timestamp is **now** (within last 5 min)
  - **Status:** Green checkmark ✅

**Outcome:** ☐ PASS ☐ FAIL | **If FAIL: STOP here, wait for deploy to complete**

---

### ☐ Test Lab Prepared (Riopomba)

Verify test environment is ready (prepared by Agente 8 or manual setup):

- [ ] Firestore: Navigate to `/labs/riopomba/` collection
  - Lab document exists and is active (`enabled: true`)

- [ ] Bioquímica: `/labs/riopomba/bioquimica/root/analitos/`
  - **Count:** 16+ analitos visible (Glicose, Ureia, Creatinina, TGO, TGP, etc.)
  - If empty: This is OK — seed function triggers on first `/bioquimica` access

- [ ] Admin User: Log into https://hmatologia2.web.app
  - Email: `drogafarto@gmail.com` (or your RT test account)
  - Lab selector shows **riopomba** in dropdown
  - You see the `/hub` dashboard (all module tiles visible)
  - **If you see "Access Denied":** Check user role in `/labs/riopomba/members/{uid}` — must have `isActiveMemberOfLab: true` and `role: 'RT'`

**Outcome:** ☐ PASS ☐ FAIL | **If FAIL: Run TEST_DATA_QUICK_START.md (5–10 min) first**

---

### ☐ Monitoring Setup (Start BEFORE smoke tests)

Set up real-time error monitoring so you catch any issues as they happen:

**Option A: Automated Script (Recommended)**

Open PowerShell and run:

```powershell
cd "C:\hc quality"
.\scripts\monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5
```

Expected output: Terminal shows status every 5 min (e.g., "Last 5 min: 0 errors | 2 warnings")

**Keep this terminal open** in background — minimize it, do not close.

**Option B: Manual Cloud Console (if script unavailable)**

- Open: https://console.cloud.google.com/logs/query?project=hmatologia2
- Paste filter: `severity >= ERROR AND resource.type = cloud_function`
- Click "Run Query"
- Set auto-refresh to 30 seconds (or manually refresh every 5 min)
- Keep tab open during smoke tests

**Outcome:** ☐ Monitoring active ☐ Ready to proceed

---

## SMOKE TEST 1: BIOQUÍMICA CIQ (10 min)

**Start Time:** __________ | **Status:** ☐ PASS ☐ FAIL

### Step 1.1: Load Bioquímica Module

**Action:**
1. In browser, navigate to: `https://hmatologia2.web.app/bioquimica`
2. Wait for page to load (expect <3 sec)

**Expected Result:**
- ✅ Page loads without error
- ✅ Table or list visible labeled "Analitos" or showing columns: Sigla, Unidade, Range, Método, CV%
- ✅ **Exactly 16 analitos** visible in list: GLI, URE, CRE, TGO, TGP, FA, GGT, BT-D, BT-I, CT, HDL, LDL, TG, Na, K, Cl (+ 1 bonus: Ca)
- ✅ DevTools Console (press F12): **0 red ERROR messages**

**If FAIL:**
- Blank page / 404: Check URL spelling. Verify lab dropdown shows "riopomba".
- <16 analitos: Refresh page (seed function auto-runs on first load). Wait 2 sec.
- Red console error: Screenshot error text. Note below.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 1.2: Upload & Parse Bula PDF (Gemini)

**Action:**
1. Look for button "Enviar Bula", "+ Adicionar Bula", or "Upload PDF" on the Bioquímica page
2. Click button → file picker opens
3. Select test PDF file:
   - **Option A (Preferred):** Use existing lab bula (e.g., BioPlus control material PDF)
   - **Option B (Fallback):** Use synthetic PDF (see Test Data guide for creation steps)
4. Click "Abrir" or "Select"
5. Page shows "Analisando..." spinner
6. **WAIT up to 35 seconds** for Gemini to parse the PDF

**Expected Result:**
- ✅ Spinner disappears (before 35s)
- ✅ Success panel appears showing:
  - **Lote:** (extracted from PDF, e.g., "BIO-2026-001")
  - **Validade:** (e.g., "2026-12-31")
  - **Fornecedor:** (e.g., "BioPlus Diagnósticos")
  - **Níveis:** 1, 2, 3 (shown as tabs or chips)
  - **Stats table:** Shows analitos (GLI, URE, CRE, etc.) with Nível, Média, SD columns
- ✅ Network tab (DevTools): Shows 1 POST request to Cloud Function `parseBulaBioquimica`, status 200
- ✅ Console: 0 red ERROR messages

**If FAIL:**
- Spinner hangs >35s: Gemini API slow. Refresh page, try lightweight synthetic PDF. Check Cloud Logs for timeout.
- Parse shows empty stats: PDF may lack structured text. Use different bula.
- Error "GEMINI_API_KEY not set": DevOps issue. Contact CTO.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 1.3: Create CIQ Lot

**Action:**
1. On success panel from Step 1.2, click button "Usar esta Bula" or "Criar Lote" (usually green/blue, at bottom-right)
2. Modal appears with pre-filled form:
   - Lote: `BIO-2026-001` (pre-filled from bula)
   - Validade: `2026-12-31` (pre-filled)
   - Níveis: 1, 2, 3 (pre-selected as tabs/checkboxes)
3. Scroll down to find **Equipamento** dropdown
   - Click and select any equipment (e.g., "Sysmex" or "Analisador 1")
   - If no equipamentos exist: Create one via admin first (skip this step for now, note below)
4. Scroll to bottom, click "Criar Lote" or "Salvar" button
5. Modal closes within 2 sec

**Expected Result:**
- ✅ Modal closes
- ✅ Page returns to Bioquímica view
- ✅ Navigate to "Lotes" tab or section (may need refresh)
- ✅ New lot visible in table with:
  - Lote: `BIO-2026-001`
  - Validade: `2026-12-31`
  - Status: `EM USO` (green badge)
  - Equipamento: Your selected device
  - Níveis: `3` or `[1, 2, 3]`
- ✅ Network: 1 Firestore write request, status 200, <2s
- ✅ Console: 0 red errors

**If FAIL:**
- Error "Lote já existe": Use unique lote number. In future tests, append suffix: `BIO-2026-001-TEST-2`
- "Equipamento required": Create equipment first (ask CTO or use admin panel)
- Modal hangs >5s: Check Network tab for stalled request. Refresh and retry.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 1.4: Record a QC Run

**Action:**
1. On Bioquímica page, navigate to "Runs" or "Corridas" tab/section
2. Click "+ Nova Corrida" or "Record Run" button
3. Form appears. Fill in order:
   - **Lote (dropdown):** Select `BIO-2026-001` (from Step 1.3)
   - **Equipamento:** Should auto-populate (from lot); verify correct
   - **Nível (radio):** Select `Nível 1`
   - **Analitos (checkboxes):** Check exactly 3:
     - ☑ Glicose (GLI)
     - ☑ Ureia (URE)
     - ☑ Creatinina (CRE)
4. Input fields appear for selected analitos. Enter values:
   - **GLI:** type `95` (within normal range)
   - **URE:** type `25` (within normal range)
   - **CRE:** type `0.8` (within normal range)
5. Scroll to bottom, click "Gravar Corrida" or "Salvar" button
6. Button shows spinner, then form submits

**Expected Result:**
- ✅ Form submits within 2 sec
- ✅ Modal/form closes
- ✅ Run appears in runs list (refresh if needed) with:
  - Lote: `BIO-2026-001`
  - Nível: `1`
  - Analitos: GLI, URE, CRE (count = 3)
  - Status: `APROVADA` (green) or `PENDENTE_REVISAO` (yellow) — both acceptable
  - Timestamp: Now
  - Equipment: Your device
- ✅ Network tab shows POST to `recordRunBioquimica`, status 200, response includes `chainHash` field (64-char hex)
- ✅ Console: 0 red errors
- ✅ Firestore check (optional): Navigate to `/labs/riopomba/bioquimica/root/runs/` — new run doc present

**If FAIL:**
- Error "GLI out of range": Bula stats may differ. Adjust value (try 100 instead of 95).
- "Lote not found" or empty dropdown: Lot not created in Step 1.3. Go back and retry.
- No chainHash in response: Server issue. Check Cloud Logs for `recordRunBioquimica` errors.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 1.5: View Levey-Jennings Chart

**Action:**
1. On Bioquímica page, find "Gráfico" or "Levey-Jennings" tab/button
2. Page shows filter dropdowns. Select:
   - **Analito:** `Glicose (GLI)`
   - **Nível:** `Nível 1`
   - **Equipamento:** Your device (from Step 1.4)
3. Chart loads within 2 sec

**Expected Result:**
- ✅ Chart displays with:
  - Title: "Levey-Jennings — Glicose (GLI) — Nível 1"
  - X-axis: Run sequence (1, 2, 3…)
  - Y-axis: Numeric scale (e.g., 80–110)
  - **Data point:** Exactly 1 point visible (your run), plotted near y=0 (on mean line)
  - **Control lines:** Horizontal line at y=0 (mean, blue/black) + dashed lines at ±1σ, ±2σ, ±3σ (gray)
  - **Legend:** Shows what each line means
- ✅ Hover over data point → tooltip appears showing: Analito, Value, Nível, Date, Equipment
- ✅ Resize browser → chart reflows (no breakage)
- ✅ Network: 1–2 GET requests for chart data, status 200
- ✅ Console: 0 red errors

**If FAIL:**
- Chart blank / axis-only: Run data may not have loaded. Check Network tab. Refresh and retry.
- Point not visible: Run status may be wrong. Check run in list — must be `APROVADA` or `PENDENTE_REVISAO`, not `RASCUNHO`.
- Control lines missing: Refresh page. If persists, check Cloud Logs.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 1.6: Verify Signature (ChainHash) — COMPLIANCE

**Action (quick verification):**
1. Open DevTools (F12) → Network tab
2. Record another QC run (same as Step 1.4, but with different values e.g., GLI=100 instead of 95)
3. Watch Network tab for POST request to `recordRunBioquimica`
4. Click that request → Response tab
5. Look for JSON field: `assinatura.hash`
6. **Check:** Must be exactly 64 characters, all hex (0–9, a–f)

**Expected Result:**
- ✅ Hash field present: `"hash": "abc123def456...xyz789"`
- ✅ Hash length: Exactly 64 characters
- ✅ Hash format: Only 0–9, a–f (no special chars)
- ✅ operatorId: Matches your user UID (from Auth)
- ✅ ts: Recent timestamp (within 1 min of now)

**If FAIL:**
- No hash field: Server not signing. Check Cloud Logs for `recordRunBioquimica` errors.
- Hash wrong length or format: Cryptographic issue. Contact CTO.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

**Smoke 1 Summary:**

| Step | Component | Status |
|------|-----------|--------|
| 1.1 | Load Analitos (16 visible) | ☐ PASS ☐ FAIL |
| 1.2 | Parse Bula (Gemini, <35s) | ☐ PASS ☐ FAIL |
| 1.3 | Create Lot | ☐ PASS ☐ FAIL |
| 1.4 | Record Run (chainHash present) | ☐ PASS ☐ FAIL |
| 1.5 | Levey-Jennings Chart | ☐ PASS ☐ FAIL |
| 1.6 | Verify Signature | ☐ PASS ☐ FAIL |

**Overall Smoke 1 Result:** ☐ PASS ☐ FAIL | **Total Time:** _____________ | **Failed Steps (if any):** _________________________________

---

## SMOKE TEST 2: SGD DRIVE IMPORTER (12 min)

**Start Time:** __________ | **Status:** ☐ PASS ☐ FAIL

### Step 2.1: Navigate to SGD

**Action:**
1. In browser, navigate to: `https://hmatologia2.web.app/sgd` (or `/sgq` depending on routing)
2. Page loads within 3 sec

**Expected Result:**
- ✅ Page loads without 404 or 500
- ✅ View shows "Master List" or "Lista Mestra" with existing documents (if any)
- ✅ Button visible for "Importar de Drive", "Sincronizar Drive", or similar
- ✅ Console: 0 red errors

**If FAIL:**
- 404 error: Route may have changed. Check `/src/core/AppRouter.tsx` for correct path.
- Page blank: Feature may be behind flag. Refresh cache (Ctrl+Shift+R).

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 2.2: Click Import Button & See OAuth Form

**Action:**
1. Click the "Importar de Drive" or "Import" button (top-right or menu)
2. Modal or panel opens within 2 sec

**Expected Result:**
- ✅ Modal title: "Importar Documentos de Drive" or "Drive Importer"
- ✅ **Step 1** visible with text: "Conecte sua conta Google Drive para continuar"
- ✅ **Button:** "Conectar ao Google Drive" (blue/primary color)
- ✅ Console: 0 red errors

**If FAIL:**
- Button not found: Check module routing and menu layout.
- Modal doesn't open: Browser/React issue. Refresh page.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 2.3: Authorize Google Drive (OAuth)

**Action:**
1. Click the blue "Conectar ao Google Drive" button
2. Popup window opens within 2 sec
3. **Google consent screen** appears (may show account selector first)
4. Screen text: "HC Quality" (or similar app name) "wants to access your Google Drive"
5. Scopes listed: "View files in your Google Drive" (read-only)
6. Buttons: "Cancel" and "Allow" (or "Permitir")
7. Click **"Allow"** to grant permission

**Expected Result:**
- ✅ Popup opens with Google consent screen
- ✅ Scopes visible (read-only Drive access)
- ✅ Allow/Cancel buttons present
- ✅ After clicking "Allow" → popup closes automatically (~2 sec)
- ✅ Page returns to HC Quality (still at `/sgd`)
- ✅ Wizard **advances to Step 2** with new form: "Selecionar Pasta" or "Choose Folder"
- ✅ New input field visible: "ID da Pasta" or "Folder ID"
- ✅ Submit button: "Listar Documentos" or "Load Files"
- ✅ Console: 0 red errors

**If FAIL:**
- Popup blocked: Check browser popup blocker icon. Allow popups and retry.
- Consent screen blank: Google service slow. Wait 3s; if still blank, close and retry.
- "Invalid client" error: OAuth credentials misconfigured. Contact DevOps.
- Popup closes but wizard stays at Step 1: OAuth may have failed. Refresh and retry.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 2.4: List Documents from Drive Folder

**Action:**
1. In Step 2 form, locate **Folder ID input field** (labeled "ID da Pasta" or "Folder ID")
2. Click field and paste your test folder ID:
   - Example ID format: `1ABC123defGHI456jklMNO789pqrSTU`
   - **Where to get:** Google Drive → right-click test folder → Share → copy link → extract ID after `/folders/`
   - Save folder ID before starting test
3. Click "Listar Documentos" or "Load Files" button
4. **Wait 5–10 seconds** for Cloud Function to fetch file list

**Expected Result:**
- ✅ Loading spinner appears briefly
- ✅ After 5–10s: Table renders with exactly **5 documents**:
  1. MQ-001 Manual da Qualidade v1
  2. PQ-002 Procedimento de Coleta
  3. IT-003 Instrução de Uso do Analisador
  4. FR-004 Formulário de Resultado
  5. POL-005 Política de Controle Interno
- ✅ Columns visible: Checkbox ☐ | Código | Tipo | Título | Arquivo
- ✅ All rows have unchecked checkboxes
- ✅ Each row is clickable (for preview)
- ✅ Network: POST to Cloud Function `listarDocsDrive`, status 200, <10s
- ✅ Console: 0 red errors

**If FAIL:**
- "Folder not found": Folder ID invalid or permission denied. Verify ID from Drive URL.
- List empty (0 documents): Folder exists but has no files. Add 5 test documents to Drive folder.
- Timeout >15s: Cloud Function slow. Check Cloud Logs for `listarDocsDrive` errors.
- "Permission denied": OAuth scope missing. Go back to Step 2.3 and re-authorize.
- Only 3 docs visible: Some files missing from Drive. Add remaining 2 and reload.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 2.5: Preview 3 Documents

**Action:**
1. In the document table from Step 2.4, click the first row (MQ-001) or look for preview icon (👁 or 🔍)
2. Preview modal opens within 2 sec
3. View document content (PDF viewer or rendered text)
4. Note metadata displayed (size, modified date, etc.)
5. Close modal (click X or press ESC)
6. **Repeat for 2 more documents** (e.g., PQ-002 and IT-003)

**Expected Result (per document):**
- ✅ Modal opens with title "Preview — {document name}"
- ✅ Content area shows document (PDF viewer for PDFs, text for Google Docs)
- ✅ Metadata visible:
  - Código: `MQ-001` (or respective)
  - Tipo: `Manual da Qualidade`
  - Título: (from Drive)
  - Tamanho: (file size)
  - Data de Modificação: (date/time)
- ✅ Modal closes cleanly (no hang)
- ✅ Content loads <3s per document
- ✅ Console: 0 red errors
- ✅ **3+ documents previewed** without error

**If FAIL:**
- Preview blank/white: PDF may be image-heavy. Try another document.
- Modal hangs >5s: Network/API issue. Check Network tab for stalled requests.
- Content doesn't render: File format not supported. Try PDF instead of Google Doc.
- Modal won't close: Browser issue. Refresh page and retry.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 2.6: Batch Import All 5 Documents

**Action:**
1. Return to document table from Step 2.4 (if closed, start over from Step 2.1)
2. At table **header row**, find checkbox labeled "Select All" (usually left side)
3. Click header checkbox to select all 5 documents (should change ☐ → ☑)
4. Verify all 5 rows are now checked ☑
5. Below table, click "Aprovar Importação", "Importar Selecionados", or "Next Step" button
6. **Wizard advances to Step 3** (review/confirmation)

**Expected Result (Step 3 - Review):**
- ✅ Page shows "Revisar Importação" or "Review Import"
- ✅ Summary displays:
  - "5 documentos selecionados"
  - List of 5 documents (codes + titles)
  - Text: "Status inicial: `rascunho` (Você poderá publicar depois)"
- ✅ Checkbox: "Concordo com a importação" or consent statement
- ✅ Buttons: "Voltar" (back) and "Confirmar Importação" (blue)
- ✅ Console: 0 red errors

**Action (continued):**
7. Review the summary
8. Check consent checkbox: "Concordo com a importação..."
9. Click "Confirmar Importação" button
10. Progress bar appears: "Importando documentos..."

**Expected Result (completion):**
- ✅ After 10–30s: All 5 documents imported
- ✅ Success message: "✓ 5 documentos importados com sucesso!"
- ✅ Wizard closes or shows button "Ver Documentos" or "Go to List"
- ✅ Network: POST to Cloud Function `aprovarBatchImport`, status 200, <30s
- ✅ Firestore writes completed (5 docs in `/labs/riopomba/sgd-externos/`)
- ✅ Console: 0 red errors

**If FAIL:**
- "Documento duplicado": Codes already exist. Use unique codes in future tests (add `-TEST` suffix).
- Progress bar hangs >45s: Cloud Function timeout. Check Cloud Logs for `aprovarBatchImport` errors.
- Partial import (only 3/5 succeed): Check Cloud Logs for per-document errors.
- Auth error: Drive access lost. Go back to Step 2.3 and re-authorize.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

### Step 2.7: Publish Documents & Verify Search

**Action (Part A - Navigate to List):**
1. Click "Ver Documentos" (from Step 2.6 success) or navigate to `/sgd` or `/sgq/lista-mestra`
2. Page shows table with imported 5 documents
3. All 5 show status **`rascunho`** (gray badge, draft/unpublished)

**Action (Part B - Publish Documents):**
4. Click first document row (MQ-001) or the "..." menu for that row
5. Click "Publicar", "Aprovar para Vigência", or "Publish" option
6. Confirmation modal: "Tem certeza? Publicar este documento?"
7. Click "Sim, publicar" or "Confirmar"
8. Modal closes; document status changes to **`vigente`** (green badge, active/published)
9. **Repeat for remaining 4 documents** (publish each one)

**Expected Result (after publishing all 5):**
- ✅ All 5 documents show status **`vigente`** (green badges)
- ✅ Each row displays:
  - Status: `vigente`
  - Código: MQ-001, PQ-002, IT-003, FR-004, POL-005
  - Título: (from Drive)
  - Tipo: (classified, e.g., Manual, Procedimento, Instrução, etc.)
- ✅ Network: 5 PATCH requests (one per doc) + 5 POST requests (audit), all status 200
- ✅ Each transition completes <3s
- ✅ Console: 0 red errors

**Action (Part C - Search & Filter):**
10. At table top, locate search box (labeled "Pesquisar...", "Search", or 🔍 icon)
11. Click search field and type: `MQ`
12. Table filters to show **only 1 document**: MQ-001
13. Clear search (delete text or click X)
14. Table shows all 5 again
15. Type another search: `Procedimento`
16. Table filters to **only PQ-002 Procedimento de Coleta**

**Expected Result (search):**
- ✅ Search is real-time (<500ms response)
- ✅ Searches title, código, other fields
- ✅ Case-insensitive: "mq" finds "MQ-001"
- ✅ Clears quickly: deleting text shows full list in <1s
- ✅ Console: 0 red errors

**If FAIL:**
- Publish button not visible: Check user role in `/labs/riopomba/members/{uid}` — must have RT role.
- Transition hangs >5s: Check Cloud Logs for `updateDocumentStatus` errors.
- Status doesn't change: Page may not have refreshed. Hard refresh (Ctrl+Shift+R).
- Search not working: May be slow or disabled. Check Firestore performance in Network tab.

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

**Smoke 2 Summary:**

| Step | Component | Status |
|------|-----------|--------|
| 2.1 | Navigate to SGD | ☐ PASS ☐ FAIL |
| 2.2 | Import button visible | ☐ PASS ☐ FAIL |
| 2.3 | OAuth authorization | ☐ PASS ☐ FAIL |
| 2.4 | List 5 documents | ☐ PASS ☐ FAIL |
| 2.5 | Preview 3+ documents | ☐ PASS ☐ FAIL |
| 2.6 | Batch import (all 5) | ☐ PASS ☐ FAIL |
| 2.7 | Publish & search | ☐ PASS ☐ FAIL |

**Overall Smoke 2 Result:** ☐ PASS ☐ FAIL | **Total Time:** _____________ | **Failed Steps (if any):** _________________________________

---

## SMOKE TEST 5: REGRESSION CHECK (5 min)

**Quick spot-check of 5 existing v1.2 modules — ensure no breakage:**

**Start Time:** __________ | **Status:** ☐ PASS ☐ FAIL

| Module | URL | Expected | Status |
|--------|-----|----------|--------|
| Analyzer | https://hmatologia2.web.app/analyzer | Page loads, no 5xx | ☐ PASS ☐ FAIL |
| Coagulação | https://hmatologia2.web.app/coagulacao | Page loads, no 5xx | ☐ PASS ☐ FAIL |
| Auditoria | https://hmatologia2.web.app/auditoria | Page loads, no 5xx | ☐ PASS ☐ FAIL |
| Treinamentos | https://hmatologia2.web.app/treinamentos | Page loads, no 5xx | ☐ PASS ☐ FAIL |
| Educação Continuada | https://hmatologia2.web.app/educacao-continuada | Page loads, no 5xx | ☐ PASS ☐ FAIL |

**For each module:**
- Click the URL
- Wait <3s for page to load
- Check DevTools Console: **0 red ERROR messages**
- Check Network tab: **No 5xx responses**
- Move to next module

**Overall Smoke 5 Result:** ☐ All PASS ☐ Some FAIL | **Failed Module (if any):** _________________________________

---

## FINAL VALIDATION (10 min)

### ☐ Browser Console Check (CRITICAL)

**Action:**
1. DevTools remains open (Console tab)
2. Scan **entire console output** for red 🔴 ERROR text
3. Ignore YELLOW ⚠️ warnings and BLUE ℹ️ info — these are OK

**What to look for (red text):**
- `Uncaught Error`
- `Uncaught TypeError`
- `Uncaught ReferenceError`
- `ChainHash mismatch`
- `Failed to fetch`

**What to ignore:**
- `[Firebase] Auth... initialized` (blue, informational)
- Third-party library warnings (Tailwind, analytics)
- `Security: Credentials mode is 'include'...` (spam warning)

**Expected Result:**
- ✅ **0 red ERROR messages** (application errors)
- ✅ Only INFO/WARN acceptable
- ✅ Console output matches expectations from smoke tests

**Sign-Off:** ☐ PASS (0 errors) ☐ FAIL | **Error Count:** _____ | **Error Types:** _________________________________

---

### ☐ Cloud Logs Check

**Action:**
1. Check monitoring setup from Pre-Execution:
   - **Script method:** Terminal from Step 4a shows summary (e.g., "Last 5 min: 0 errors")
   - **Console method:** Refresh Cloud Logging tab, check last 10 min for ERROR entries

**Expected Result:**
- ✅ **0–5 ERROR entries** (normal range, no critical errors)
- ✅ No recurring/cascading errors
- ✅ No 5xx spike during smoke test window

**Sign-Off:** ☐ PASS ☐ FAIL | **Error Summary:** _________________________________

---

### ☐ Firestore Spot-Check (Optional)

**Action (bonus verification):**
1. Open Firestore Console: https://console.firebase.google.com/project/hmatologia2/firestore
2. Navigate: Collections → `labs` → `riopomba` → `bioquimica` → `root` → `runs`
3. Look for your test runs (should see 2+ documents with recent timestamps)
4. Open one run document
5. Check field: `assinatura` → `hash`
6. **Verify:** 64-character hex string present

**Expected Result:**
- ✅ 2+ run documents visible
- ✅ chainHash field present with 64-char hex
- ✅ operatorId matches logged-in user
- ✅ ts is recent (within test window)

**Sign-Off:** ☐ PASS ☐ FAIL | **Notes:** _________________________________

---

## GO / NO-GO DECISION

**Summary of All Test Results:**

| Test | Result | Failed Steps |
|------|--------|--------------|
| **Smoke 1: Bioquímica** | ☐ PASS ☐ FAIL | _________________ |
| **Smoke 2: SGD** | ☐ PASS ☐ FAIL | _________________ |
| **Smoke 5: Regression** | ☐ PASS ☐ FAIL | _________________ |
| **Browser Console** | ☐ PASS ☐ FAIL | _________________ |
| **Cloud Logs** | ☐ PASS ☐ FAIL | _________________ |

---

### FINAL DECISION

**All tests PASS?**

- ✅ **YES → GO** — Proceed to sign-off and final commit
  - All 5 validation checks PASS
  - No critical errors
  - Production ready for next 24h ops

- 🔴 **NO → NO-GO** — Investigate before proceeding
  - Document which check(s) failed
  - Check troubleshooting section below
  - Escalate if critical error found

---

## IF ANY TEST FAILS

### Troubleshooting Quick Reference

**Bioquímica Module Issues:**
1. **Seed analitos not loaded:** Refresh page (seed triggers on first load)
2. **Bula parsing timeout:** Retry upload with simpler PDF. Check Cloud Logs: `parseBulaBioquimica`
3. **ChainHash missing:** Server issue. Check Cloud Logs for `recordRunBioquimica` error
4. **Chart blank:** Run status wrong (must be `APROVADA` or `PENDENTE_REVISAO`). Refresh page.

**SGD Drive Importer Issues:**
1. **OAuth consent doesn't appear:** Allow browser popups. Refresh and retry.
2. **Drive folder returns 0 docs:** Check folder ID (copy from URL again). Verify 5 test docs exist in folder.
3. **Duplicate código error:** Use unique codes. Add `-TEST-2` suffix if re-testing.
4. **Import hangs:** Check Cloud Logs: `aprovarBatchImport` for timeout.

**General Issues:**
1. **Service Worker caching old code:** Hard refresh (Ctrl+Shift+R). Clear site data (DevTools → Application → Clear site data).
2. **User access denied:** Verify in Firestore: `/labs/riopomba/members/{uid}` has `isActiveMemberOfLab: true` and `role: "RT"`.
3. **5xx errors:** Check Cloud Logs filter: `severity>=ERROR AND resource.type=cloud_function`. Screenshot error.

### Escalation Levels

- 🟡 **Medium:** Cosmetic issue, non-blocking, feature incomplete but deferred to v1.4
- 🟠 **High:** UI broken, module fails, regression in v1.2 feature
- 🔴 **Critical:** ChainHash break, data loss, 5xx rate >5%, rules lockout, security issue

**For any CRITICAL issue:** STOP testing. Take screenshot + console logs. Contact CTO immediately. **DO NOT COMMIT** or proceed with deployment.

---

## SIGN-OFF

**All Tests Completed:** ☐ Yes ☐ No

**Final Status:** ☐ GO ☐ NO-GO

**Tester Name:** _________________ | **Date/Time:** _________________ | **Signature:** _________________

---

## NEXT STEPS

**If GO:**
1. ✅ Stop monitoring script (Ctrl+C in terminal)
2. ✅ Run commit:
   ```powershell
   cd "C:\hc quality"
   git add -A
   git commit -m "v1.3 deployment: smoke tests PASSED"
   git push origin main
   ```
3. ✅ Post to team (Slack/Discord):
   > "v1.3 smoke tests GREEN ✅. Bioquímica + SGD + regression all passing. Production stable. Ready for next 24h ops."

**If NO-GO:**
1. 🔴 **DO NOT COMMIT** or push
2. 🔴 File issue with:
   - Screenshot of console error (Ctrl+PrtScn)
   - Failed step(s)
   - Error message
   - Cloud Logs link (copy filter from monitoring)
3. 🔴 Wait for fix + redeploy
4. 🔴 Re-run smoke tests from beginning

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-06  
**Status:** Ready for Manual Execution  
**Owner:** CTO (drogafarto)  
**Next Review:** After v1.3 deployment completion
