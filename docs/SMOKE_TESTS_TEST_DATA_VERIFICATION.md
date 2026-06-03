---
title: Test Data Preparation & Verification — v1.3 Smoke Tests
version: 1.0
created: 2026-05-07
author: CTO (drogafarto)
status: Execution-Ready
scope: Riopomba Lab (pilot staging lab for smoke tests)
---

# Test Data Preparation & Verification — v1.3 Smoke Tests

**Purpose:** Verify and prepare all test materials, documents, and lab configuration needed for Step 4 (smoke tests) of the v1.3 deployment roadmap.

**Target Environment:** Production (`https://hmatologia2.web.app`)  
**Test Lab:** Riopomba (lab ID: `riopomba`)  
**Test Window:** 24h post-deploy  
**Completion Target:** Before executing Smoke Tests 1–5

---

## Table of Contents

1. [Riopomba Lab Verification](#riopomba-lab-verification)
2. [Bioquímica Test Data](#bioquímica-test-data)
3. [SGD/Drive Test Data](#sgddrive-test-data)
4. [Lab Configuration](#lab-configuration)
5. [Test Account Provisioning](#test-account-provisioning)
6. [Cloud Function Dependencies](#cloud-function-dependencies)
7. [Firestore Readiness](#firestore-readiness)
8. [Pre-Smoke Test Checklist](#pre-smoke-test-checklist)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## Riopomba Lab Verification

### Step 1: Verify Lab Document Exists

**Location:** Firestore → Collections → `labs` → document ID: `riopomba`

**Verification Checklist:**

- [ ] **Lab document exists** at `/labs/riopomba`
- [ ] **Status field:** `active: true` (boolean, not string)
- [ ] **Name field:** `"Riopomba"` or `"Laboratório Riopomba"`
- [ ] **Region field:** `region: "southamerica-east1"`
- [ ] **Timezone field:** `timezone: "America/Sao_Paulo"` (BRT -03:00)
- [ ] **Config sub-doc exists:** `/labs/riopomba/config/general` with `moduleFlags: {...}`

**If Lab Not Found:**

1. Create lab document manually in Firestore Console:

   ```json
   {
     "id": "riopomba",
     "name": "Laboratório Riopomba",
     "active": true,
     "region": "southamerica-east1",
     "timezone": "America/Sao_Paulo",
     "criadoEm": <current-timestamp>,
     "deletadoEm": null
   }
   ```

2. Create config document: `/labs/riopomba/config/general`
   ```json
   {
     "moduleFlags": {
       "bioquimica": true,
       "sgq": true,
       "reclamacoes": true,
       "liberacao": true,
       "analytics": true,
       "export": true
     },
     "labSettings": {
       "labName": "Laboratório Riopomba",
       "addressCity": "Riopomba",
       "addressState": "MG",
       "timezone": "America/Sao_Paulo"
     }
   }
   ```

**Status:** ☐ Verified ☐ Created

---

## Bioquímica Test Data

### Step 2: Verify Seed Analitos (17 Auto-Generated)

**Expected Location:** `/labs/riopomba/bioquimica/root/analitos/`

**Expected Count:** 17 analito documents

**Verification Steps:**

1. Navigate to Firestore Console → `labs` → `riopomba` → `bioquimica` → `root` → `analitos`
2. Count visible documents — should be exactly 17
3. Verify each has fields: `nome`, `sigla`, `unidade`, `rangeBiologico`, `ativo`, `criadoEm`

**Expected Analitos (17 total):**

| #   | Nome                 | Sigla | Unidade | Range Bio | CV% |
| --- | -------------------- | ----- | ------- | --------- | --- |
| 1   | Glicose              | GLI   | mg/dL   | 70–99     | 2.5 |
| 2   | Ureia                | URE   | mg/dL   | 17–49     | 3.0 |
| 3   | Creatinina           | CRE   | mg/dL   | 0.6–1.3   | 4.0 |
| 4   | TGO/AST              | TGO   | U/L     | 5–40      | 5.0 |
| 5   | TGP/ALT              | TGP   | U/L     | 5–41      | 5.0 |
| 6   | Fosfatase Alcalina   | FA    | U/L     | 40–129    | 4.5 |
| 7   | GGT                  | GGT   | U/L     | 8–61      | 6.0 |
| 8   | Bilirrubina Direta   | BT-D  | mg/dL   | 0–0.3     | 8.0 |
| 9   | Bilirrubina Indireta | BT-I  | mg/dL   | 0.1–1.0   | 8.0 |
| 10  | Colesterol Total     | CT    | mg/dL   | 0–199     | 3.0 |
| 11  | HDL Colesterol       | HDL   | mg/dL   | 40–999    | 4.0 |
| 12  | LDL Colesterol       | LDL   | mg/dL   | 0–129     | 4.5 |
| 13  | Triglicerídeos       | TG    | mg/dL   | 0–150     | 4.0 |
| 14  | Sódio                | Na    | mEq/L   | 136–145   | 1.5 |
| 15  | Potássio             | K     | mEq/L   | 3.5–5.0   | 2.0 |
| 16  | Cloro                | Cl    | mEq/L   | 98–107    | 1.5 |
| 17  | Cálcio Total         | Ca    | mg/dL   | 8.5–10.2  | 3.0 |

**If Analitos Missing:**

**Trigger Seed Function (Option A - Cloud Console):**

1. Navigate to: `https://console.cloud.google.com/functions?project=hmatologia2`
2. Find function: `seedBioquimicaDefaults`
3. Click function → **TESTING** tab
4. Input JSON:
   ```json
   {
     "labId": "riopomba"
   }
   ```
5. Click **Execute** → function should complete in <30s
6. Check Firestore for new analitos (refresh console)

**Trigger Seed Function (Option B - CLI):**

```bash
cd C:\hc quality
gcloud functions call seedBioquimicaDefaults \
  --gen2 \
  --region=southamerica-east1 \
  --data='{"labId":"riopomba"}' \
  --project=hmatologia2
```

**Status:** ☐ Verified (17 docs present) ☐ Seeded (function executed)

---

### Step 3: Create Test Equipamentos (Equipment)

**Location:** `/labs/riopomba/equipamentos/`

**Why:** Bioquímica runs require an equipment selection. Seed does not auto-create these.

**Create 1 Test Equipment (minimum):**

1. In Firestore Console, navigate to: `labs` → `riopomba` → `equipamentos`
2. Click **"Add Document"** or click collection name and **Create a new document**
3. Set document ID to: `eq-bioquimica-test` (auto-ID is also fine)
4. Add fields:

   ```json
   {
     "nome": "Analisador Teste — Bioquímica",
     "modelo": "Sysmex XN-550",
     "fabricante": "Sysmex",
     "ativo": true,
     "labId": "riopomba",
     "criadoEm": <timestamp>,
     "deletadoEm": null
   }
   ```

5. Click **Save**

**Status:** ☐ Equipment created (ID: `eq-bioquimica-test`)

---

### Step 4: Prepare Test Bula PDF (Bioquímica Step 2)

**Purpose:** For Smoke Test 1, Step 2 (Gemini parsing).

**Options:**

#### Option A: Use Commercial Bula (Recommended)

- [ ] Obtain a real BioPlus or Labtest control material bula (PDF)
- [ ] Ask Riopomba lab manager or supplier
- [ ] Save to local machine for upload during test
- [ ] Must be readable PDF with analito names + numeric values

#### Option B: Create Synthetic Test PDF

**File Content** (copy below text):

```
CONTROLE DE QUALIDADE INTERNO
BIOQUIMICA NIVEL 1, 2, 3

NÍVEL 1 — Padrão Baixo
Glicose (GLI): Média 95 mg/dL (SD 2.5)
Ureia (URE): Média 25 mg/dL (SD 1.0)
Creatinina (CRE): Média 0.8 mg/dL (SD 0.05)
Sódio (Na): Média 138 mEq/L (SD 1.0)
Potássio (K): Média 4.2 mEq/L (SD 0.2)

NÍVEL 2 — Padrão Médio
Glicose (GLI): Média 150 mg/dL (SD 3.0)
Ureia (URE): Média 45 mg/dL (SD 1.5)
Creatinina (CRE): Média 1.5 mg/dL (SD 0.1)
Sódio (Na): Média 139 mEq/L (SD 1.2)
Potássio (K): Média 4.3 mEq/L (SD 0.25)

NÍVEL 3 — Padrão Alto
Glicose (GLI): Média 250 mg/dL (SD 4.0)
Ureia (URE): Média 70 mg/dL (SD 2.0)
Creatinina (CRE): Média 2.5 mg/dL (SD 0.15)
Sódio (Na): Média 140 mEq/L (SD 1.5)
Potássio (K): Média 4.5 mEq/L (SD 0.3)

Identificação do Lote:
Lote: BIO-2026-001
Validade: 2026-12-31
Fabricante: BioPlus Diagnósticos LTDA
Data de Fabricação: 2026-01-15
Temperatura de Armazenamento: 2–8°C
```

**Steps to Convert to PDF:**

1. Save text to file: `test-bula.txt`
2. Use online converter (e.g., `https://cloudconvert.com/txt-to-pdf`) or LibreOffice:
   ```bash
   libreoffice --headless --convert-to pdf test-bula.txt
   ```
3. Save as `test-bula.pdf`
4. Keep file on desktop or downloads for upload during test

**Status:** ☐ Commercial bula obtained ☐ Synthetic PDF created

---

## SGD/Drive Test Data

### Step 5: Create Google Drive Test Folder

**Prerequisite:** Google account with Drive access (personal or workspace)

**Steps:**

1. Open `https://drive.google.com`
2. Click **"+ New"** → **"Folder"**
3. Name folder: `HC Quality Test Documents — 2026-05-07` (or similar)
4. Right-click folder → **Share**
5. Copy link from dialog:
   - Example: `https://drive.google.com/drive/folders/1ABC123xyz...`
6. Extract folder ID (part after `/folders/`):
   - **Save this ID** — needed in Smoke Test 2, Step 4
   - Example ID: `1ABC123xyz...`

**Status:** ☐ Folder created, ID saved: `________________`

---

### Step 6: Create 5 Test Documents in Drive Folder

**Location:** Inside the folder created in Step 5

**Required Documents (exactly 5):**

#### Document 1: Manual da Qualidade

- **Filename (as shown in Drive):** `MQ-001 Manual da Qualidade v1`
- **Type:** PDF or Google Doc
- **Minimum content:** Text mentioning "Qualidade" or "Manual" (for Gemini classification)
- **Size:** ≥100 KB (to test preview rendering)

**Creation Steps:**

1. In Google Drive folder, click **"+ New"** → **"Google Doc"** (or upload PDF)
2. Name it: `MQ-001 Manual da Qualidade v1`
3. Add some text (e.g., "Manual da Qualidade v1. Procedimentos operacionais...")
4. Click **Move to folder** → select your test folder
5. Save

#### Document 2: Procedimento de Coleta

- **Filename:** `PQ-002 Procedimento de Coleta`
- **Type:** PDF or Google Doc
- **Content:** Any procedural text

#### Document 3: Instrução Técnica

- **Filename:** `IT-003 Instrução de Uso do Analisador`
- **Type:** PDF or Google Doc
- **Content:** Technical instructions (can be generic)

#### Document 4: Formulário de Resultado

- **Filename:** `FR-004 Formulário de Resultado`
- **Type:** PDF or Google Sheet
- **Content:** Form structure or table

#### Document 5: Política

- **Filename:** `POL-005 Política de Controle Interno`
- **Type:** PDF or Google Doc
- **Content:** Policy text

**Verification:**

- [ ] Folder contains exactly 5 documents
- [ ] Each document is named correctly (codes match: MQ-001, PQ-002, IT-003, FR-004, POL-005)
- [ ] All documents are viewable (click each to verify access)

**Status:** ☐ 5 documents created and verified

---

## Lab Configuration

### Step 7: Create Lab Settings Document

**Location:** `/labs/riopomba/labSettings/general`

**Purpose:** Configuration needed for reports and analytics module.

**Create Document:**

1. Navigate to Firestore Console
2. Path: `labs` → `riopomba` → Create new collection → `labSettings`
3. Document ID: `general`
4. Add fields:

```json
{
  "labId": "riopomba",
  "labName": "Laboratório Riopomba",
  "region": "southamerica-east1",
  "timezone": "America/Sao_Paulo",
  "addressCity": "Riopomba",
  "addressState": "MG",
  "addressCountry": "Brazil",
  "phone": "+55 31 1234-5678",
  "email": "contato@riopomba.com.br",
  "criadoEm": <timestamp>,
  "deletadoEm": null
}
```

**Status:** ☐ Lab settings document created

---

## Test Account Provisioning

### Step 8: Verify Test User & Member Doc

**Location:**

- Firebase Auth user: any existing test account
- Firestore member doc: `/labs/riopomba/members/{uid}`

**Prerequisites for Smoke Tests:**

- [ ] Test user exists in Firebase Auth (email: e.g., `staging-rt@lab.com` or your test email)
- [ ] User UID is known (visible in Firebase Console → Authentication)
- [ ] User is marked as active member of Riopomba lab

**Create Member Document (if missing):**

1. Get your Firebase Auth user UID:
   - Go to: `https://console.firebase.google.com/project/hmatologia2/authentication`
   - Click your test user → copy UID

2. In Firestore Console, navigate to: `labs` → `riopomba` → Create new collection → `members`

3. Document ID: `{your-uid}` (paste the UID)

4. Add fields:

```json
{
  "uid": "{your-uid}",
  "email": "your-test-email@example.com",
  "role": "RT",
  "isActiveMemberOfLab": true,
  "isAdminOrOwner": true,
  "criadoEm": <timestamp>,
  "deletadoEm": null
}
```

**Status:** ☐ Member document exists with `isActiveMemberOfLab: true` and `role: "RT"`

---

## Cloud Function Dependencies

### Step 9: Verify Cloud Functions Deployed

**Purpose:** Ensure all required functions are live and have necessary environment variables set.

**Verification Steps:**

1. Navigate to: `https://console.cloud.google.com/functions?project=hmatologia2`

2. For each function listed below, verify:
   - [ ] **Status:** Green checkmark (deployed)
   - [ ] **Region:** `southamerica-east1`
   - [ ] **Runtime:** Node 22
   - [ ] **Env variables set** (visible in function detail → **Runtime settings**)

**Required Functions for Smoke Tests:**

#### Bioquímica Functions

| Function                 | Status | Env Vars           |
| ------------------------ | ------ | ------------------ |
| `seedBioquimicaDefaults` | ☐ OK   | —                  |
| `parseBulaBioquimica`    | ☐ OK   | `GEMINI_API_KEY` ✓ |
| `recordRunBioquimica`    | ☐ OK   | —                  |
| `applyBulaToLot`         | ☐ OK   | —                  |

#### SGD/Drive Functions

| Function             | Status | Env Vars                      |
| -------------------- | ------ | ----------------------------- |
| `listarDocsDrive`    | ☐ OK   | `DRIVE_OAUTH_CLIENT_SECRET` ✓ |
| `previewDocDrive`    | ☐ OK   | —                             |
| `aprovarBatchImport` | ☐ OK   | —                             |
| `oauthCallbackDrive` | ☐ OK   | `DRIVE_OAUTH_CLIENT_SECRET` ✓ |
| `classificarDocAuto` | ☐ OK   | `GEMINI_API_KEY` ✓            |

#### Other Critical Functions

| Function          | Status | Env Vars |
| ----------------- | ------ | -------- |
| `criarReclamacao` | ☐ OK   | —        |
| `liberarLaudo`    | ☐ OK   | —        |

**If Functions Missing:**

- Check Cloud Logs for deployment errors
- Check `firebase.json` for function includes
- Re-deploy: `firebase deploy --only functions --project hmatologia2`

**If Env Vars Missing:**

Check Cloud Secrets Manager:

```bash
gcloud secrets list --project=hmatologia2 | grep -E "(GEMINI|DRIVE)"
```

If missing, contact DevOps to add secrets.

**Status:** ☐ All 4 bioquímica functions green ☐ All 5 SGD functions green ☐ Env vars verified

---

## Firestore Readiness

### Step 10: Verify Indexes Deployed

**Location:** Firestore Console → **Indexes** tab

**Purpose:** Composite indexes required for queries in Smoke Tests.

**Verification:**

Search for these indexes and verify status = **Ready** or **Building** (not **Error**):

- [ ] `sgq-documentos: (labId, status, dataRevisao)`
- [ ] `sgq-documentos: (labId, tipo, status)`
- [ ] `bioquimica-runs: (labId, equipmentId, status)`

**If Indexes Missing:**

1. Run: `firebase deploy --only firestore:indexes --project hmatologia2`
2. Wait 5–60 minutes for index build to complete
3. Do not proceed with Smoke Tests until all indexes are **Ready**

**Status:** ☐ All indexes ready/building

---

### Step 11: Verify Firestore Rules

**Location:** Firestore Console → **Rules** tab

**Verification:**

- [ ] **Last published** timestamp: within last 24 hours (post-deploy)
- [ ] **Rule size:** ~2,100+ lines (covering all modules)
- [ ] **Error indicator:** None (rules compiled without errors)

**Spot-check key rules:**

```firestore
match /labs/{labId}/bioquimica/{document=**} {
  allow read: if isActiveMemberOfLab(labId);
  allow write: if false;  // Client writes disabled
}

match /labs/{labId}/sgq-documentos/{docId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create: if false;  // Imports via callable only
}
```

**Status:** ☐ Rules published and validated

---

## Pre-Smoke Test Checklist

### Final Readiness Verification

Complete this checklist before executing Smoke Tests 1–5:

#### Riopomba Lab Setup

- [ ] Lab document exists at `/labs/riopomba` with `active: true`
- [ ] Lab settings document created at `/labs/riopomba/labSettings/general`
- [ ] Module flags enabled: `bioquimica`, `sgq`, `reclamacoes`, `liberacao`, `analytics`, `export`

#### Bioquímica Module

- [ ] 17 seed analitos created at `/labs/riopomba/bioquimica/root/analitos/`
- [ ] 1+ equipment document created at `/labs/riopomba/equipamentos/`
- [ ] Test bula PDF ready (local file for upload)
- [ ] Cloud Function `seedBioquimicaDefaults` deployed and verified

#### SGD/Drive Module

- [ ] Google Drive test folder created
- [ ] Folder ID copied and saved: `____________________________`
- [ ] Exactly 5 test documents created in folder:
  - [ ] MQ-001 Manual da Qualidade v1
  - [ ] PQ-002 Procedimento de Coleta
  - [ ] IT-003 Instrução de Uso do Analisador
  - [ ] FR-004 Formulário de Resultado
  - [ ] POL-005 Política de Controle Interno
- [ ] All Cloud Functions (`listarDocsDrive`, `aprovarBatchImport`, etc.) deployed

#### Cloud Infrastructure

- [ ] Firestore indexes deployed and status = **Ready**
- [ ] Firestore rules published (timestamp recent)
- [ ] All Cloud Functions deployed (green status)
- [ ] Environment variables set (`GEMINI_API_KEY`, `DRIVE_OAUTH_CLIENT_SECRET`)

#### Test Account

- [ ] Firebase Auth test user exists
- [ ] Member document created: `/labs/riopomba/members/{uid}`
- [ ] Member has `role: "RT"` and `isActiveMemberOfLab: true`

#### Pre-Flight Checks

- [ ] Production URL accessible: `https://hmatologia2.web.app`
- [ ] Browser DevTools open (Console tab)
- [ ] Cloud Logging dashboard open in parallel tab
- [ ] Service Worker updated on this machine (hard reload if needed: Ctrl+Shift+R)

---

## Troubleshooting Guide

### Analitos Not Appearing

**Symptom:** Bioquímica page loads but analitos list is empty or <17 docs.

**Cause:** Seed function not executed or failed.

**Resolution:**

1. Check Cloud Logs for `seedBioquimicaDefaults` errors:

   ```bash
   gcloud functions logs read seedBioquimicaDefaults \
     --region=southamerica-east1 \
     --limit=10 \
     --project=hmatologia2
   ```

2. Re-trigger seed function from Cloud Console or CLI

3. Verify Firestore rules allow read from `/bioquimica/root/analitos/`

4. Check member doc has `isActiveMemberOfLab: true`

---

### Drive Folder Returns 0 Documents

**Symptom:** Smoke Test 2, Step 4 shows "Folder empty" or 0 documents listed.

**Cause:**

- Folder ID invalid
- Folder has no files
- OAuth token revoked
- Permission denied

**Resolution:**

1. Verify folder ID is correct:
   - Open Drive folder → right-click → Share → copy link
   - Extract ID from URL: `/folders/{ID}`
   - Paste into Smoke Test 2, Step 4 form

2. Verify 5 documents are in folder:
   - Open Google Drive folder in browser
   - Count files — should be exactly 5

3. Re-authorize Google Drive in Smoke Test 2, Step 2 (click "Conectar ao Google Drive" again)

4. Check Cloud Logs for `listarDocsDrive`:
   ```bash
   gcloud functions logs read listarDocsDrive \
     --region=southamerica-east1 \
     --limit=10 \
     --project=hmatologia2
   ```

---

### Gemini API Timeout (Bula Parsing)

**Symptom:** Smoke Test 1, Step 2 hangs >35s or shows "Timeout ao analisar bula".

**Cause:** Gemini API slow or overloaded; secret not set.

**Resolution:**

1. Verify `GEMINI_API_KEY` is set:

   ```bash
   gcloud functions describe parseBulaBioquimica \
     --gen2 --region=southamerica-east1 --project=hmatologia2 \
     --format='value(serviceConfig.secretEnvironmentVariables)'
   ```

2. If missing, contact DevOps to set secret

3. Try lightweight PDF (synthetic test PDF from Step 4) instead of commercial bula

4. Retry with patience — Gemini can be slow on first invoke (cold start)

---

### Firestore Rules Reject Reads

**Symptom:** Page shows "Permission denied" or blank after "Loading..." for >5s.

**Cause:** User not marked as `isActiveMemberOfLab` or rules have error.

**Resolution:**

1. Verify member doc:

   ```
   Firestore Console → labs → riopomba → members → {uid}
   Check: isActiveMemberOfLab = true
   ```

2. Verify rules are published (no errors):

   ```
   Firestore Console → Rules tab → should show "Last published: now"
   ```

3. Check Cloud Logs for rule rejection errors:
   ```bash
   gcloud logging read "resource.type=cloud_firestore AND protoPayload.status.message=~'Permission denied'" --limit=5 --project=hmatologia2
   ```

---

### Service Worker Not Updated

**Symptom:** Page shows old version of app after deploy.

**Cause:** Browser cached old Service Worker.

**Resolution:**

1. Hard reload in browser:
   - **Chrome/Edge:** Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   - **Firefox:** Ctrl+Shift+Del then refresh

2. Check DevTools → Application → Service Workers:
   - Should show new version hash
   - Click "Unregister" if multiple versions stuck

3. Clear site data:
   - DevTools → Application → Storage → "Clear site data"
   - Refresh page

---

## Final Sign-Off

**Date:** `________________`  
**Executor:** `________________`  
**Lab ID:** `riopomba`

**Pre-Smoke Test Readiness:**

- [ ] **All checks passed** — Ready to execute Smoke Tests 1–5
- [ ] **Some items incomplete** — List below and assign owner:
  - ***
  - ***
  - ***

**Sign-Off:**

I confirm that test data preparation is complete and the Riopomba lab is ready for Step 4 (Smoke Tests).

**Signature:** **********\_\_\_\_**********  
**Name:** **********\_\_\_\_**********  
**Timestamp:** **********\_\_\_\_**********

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Status:** Execution-Ready  
**Next Step:** Execute Smoke Test 1 (Bioquímica E2E)
