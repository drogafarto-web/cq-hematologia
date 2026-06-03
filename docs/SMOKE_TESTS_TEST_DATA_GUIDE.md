---
title: Test Data & Manual Dependencies Guide
version: 1.0
purpose: Prepare test environment for Smoke Tests v1.3
---

# Smoke Tests v1.3 — Test Data & Dependencies

**Purpose:** Document all manual dependencies and test data required for post-deploy smoke tests.

**Audience:** QA engineer, RT (test executor), DevOps

---

## Test Account Requirements

### Lab Account

| Property    | Requirement                                                 | Notes                                        |
| ----------- | ----------------------------------------------------------- | -------------------------------------------- |
| **Lab ID**  | `labs/{labId_staging}`                                      | Recommend: demo lab or Riopomba non-prod     |
| **Status**  | Marked "staging" or "test"                                  | Optional flag to exclude from prod analytics |
| **Modules** | All enabled (bioquimica, sgq, reclamacoes, liberacao, etc.) | Verify in `/labs/{labId}/config/moduleFlags` |

### Test User (RT — Responsável Técnico)

| Property             | Requirement                          | Notes                                                      |
| -------------------- | ------------------------------------ | ---------------------------------------------------------- |
| **Email**            | staging-rt@lab.com or reuse existing | Firebase Auth user                                         |
| **UID**              | Auto-assigned by Firebase            | Used in chainHash.operatorId validation                    |
| **Role**             | RT (Responsável Técnico)             | Set in `/labs/{labId}/members/{uid}` doc with `role: 'RT'` |
| **Claims**           | `isActiveMemberOfLab: true`          | Required for Firestore rule validation                     |
| **Bioquímica Admin** | (Optional) `bioquimicaAdmin: true`   | Not enforced in v1.3, but useful for full feature access   |

### Provisioning Script (if needed)

```bash
# Create staging lab
firebase firestore:data:import docs/test-data/staging-lab-setup.json --project hmatologia2

# Or manual Firestore console:
# 1. Create doc: /labs/staging-lab-2026/config/general
# 2. Create doc: /labs/staging-lab-2026/members/{testUID}
#    with: { email: "staging-rt@lab.com", role: "RT", isActiveMemberOfLab: true }
```

---

## Bioquímica Test Data

### Sample PDF (Bula) — Option A: Commercial

**Recommended:** BioPlus or Labtest commercial control material bula (real PDF)

**Where to obtain:**

- Riopomba archived bulas: ask lab manager
- Commercial supplier website (may require login)
- Alternative: use any PDF with structured analito names + numeric values

**Format expected by Gemini parser:**

```
Controle de Qualidade Interno

NÍVEL 1
Glicose: Média 95 mg/dL (SD 2.5)
Ureia: Média 25 mg/dL (SD 1.0)
Creatinina: Média 0.8 mg/dL (SD 0.05)

NÍVEL 2
Glicose: Média 150 mg/dL (SD 3.0)
Ureia: Média 45 mg/dL (SD 1.5)
Creatinina: Média 1.5 mg/dL (SD 0.1)

NÍVEL 3
Glicose: Média 250 mg/dL (SD 4.0)
Ureia: Média 70 mg/dL (SD 2.0)
Creatinina: Média 2.5 mg/dL (SD 0.15)

Lote: BIO-2026-001
Validade: 2026-12-31
Fabricante: BioPlus Diagnósticos
```

### Sample PDF (Bula) — Option B: Synthetic

If commercial PDF unavailable, use synthetic test PDF:

**Generation steps:**

1. Create `test-bula.txt` with text above
2. Convert to PDF:

   ```bash
   # Via LibreOffice (if available)
   libreoffice --headless --convert-to pdf test-bula.txt

   # Or use online converter: https://products.aspose.app/words/conversion/txt-to-pdf
   ```

3. Save as `test-bula.pdf`
4. Upload during Smoke 1, Step 2

**Alternative:** Use existing lab document if text-searchable PDF available

### Seed Analitos Validation

**Expected seed count:** 16 analitos automatically created on first `/bioquimica` access

**List (from `seedAnalitos.ts`):**

1. Glicose (GLI) — mg/dL
2. Ureia (URE) — mg/dL
3. Creatinina (CRE) — mg/dL
4. TGO/AST (TGO) — U/L
5. TGP/ALT (TGP) — U/L
6. Fosfatase Alcalina (FA) — U/L
7. GGT (GGT) — U/L
8. Bilirrubina Direta (BT-D) — mg/dL
9. Bilirrubina Indireta (BT-I) — mg/dL
10. Colesterol Total (CT) — mg/dL
11. HDL Colesterol (HDL) — mg/dL
12. LDL Colesterol (LDL) — mg/dL
13. Triglicerídeos (TG) — mg/dL
14. Sódio (Na) — mEq/L
15. Potássio (K) — mEq/L
16. Cloro (Cl) — mEq/L
17. Cálcio Total (Ca) — mg/dL

**Cloud Function:** `seedBioquimicaDefaults` (Region: `southamerica-east1`, Runtime: Node 22)  
**Triggers:** First access to `/bioquimica` on any lab OR manual invocation via `https://console.cloud.google.com/functions?project=hmatologia2`

**Manual seed trigger (if needed):**

```bash
gcloud functions call seedBioquimicaDefaults \
  --region=southamerica-east1 \
  --data='{"labId":"staging-lab-2026"}' \
  --project=hmatologia2
```

### Test Run Data (Step 4 of Smoke 1)

**Example run (all within normal range):**

| Analito | Value | Unit  | Range   | Status |
| ------- | ----- | ----- | ------- | ------ |
| GLI     | 95    | mg/dL | 70–99   | ✓      |
| URE     | 25    | mg/dL | 17–49   | ✓      |
| CRE     | 0.8   | mg/dL | 0.6–1.3 | ✓      |

**Expected outcome:** All 3 in control range → Westgard status `OK` → run status `APROVADA`

**Alternative run (one above range):**

| Analito | Value | Unit  | Range   | Status |
| ------- | ----- | ----- | ------- | ------ |
| GLI     | 105   | mg/dL | 70–99   | ⚠      |
| URE     | 25    | mg/dL | 17–49   | ✓      |
| CRE     | 0.8   | mg/dL | 0.6–1.3 | ✓      |

**Expected outcome:** GLI above mean (trigger `1-2s` rule) → Westgard status `ALERTA` → run status `PENDENTE_REVISAO`

---

## SGD Drive Importer Test Data

### Google Drive Setup

**Requirements:**

- Google account with Drive access (personal or workspace)
- One folder containing exactly 5 test documents

**Folder structure example:**

```
Test Documents (folder ID: 1ABC...xyz)
├── MQ-001 Manual da Qualidade v1
├── PQ-002 Procedimento de Coleta
├── IT-003 Instrução de Uso do Analisador
├── FR-004 Formulário de Resultado
└── POL-005 Política de Controle Interno
```

### Test Document Preparation

**Document 1: Manual da Qualidade (MQ-001)**

- **Name in Drive:** `MQ-001 Manual da Qualidade v1`
- **Type:** PDF or Google Doc
- **Content:** Any text (e.g., "Manual da Qualidade v1. Procedures... ")
- **Size:** >100 KB (to test preview rendering)

**Document 2: Procedimento (PQ-002)**

- **Name in Drive:** `PQ-002 Procedimento de Coleta`
- **Type:** PDF or Google Doc
- **Content:** Any procedural text

**Document 3: Instrução (IT-003)**

- **Name in Drive:** `IT-003 Instrução de Uso do Analisador`
- **Type:** PDF or Google Doc

**Document 4: Formulário (FR-004)**

- **Name in Drive:** `FR-004 Formulário de Resultado`
- **Type:** PDF or Google Sheet

**Document 5: Política (POL-005)**

- **Name in Drive:** `POL-005 Política de Controle Interno`
- **Type:** PDF or Google Doc

**Total files:** 5  
**Total size:** Ideally 1–10 MB combined (to keep preview load times <10s)

### Obtaining Folder ID

1. **Open Google Drive:** `https://drive.google.com`
2. **Create or select folder** with 5 test documents
3. **Right-click folder** → **Share**
4. **Copy link** from share dialog
   - Example: `https://drive.google.com/drive/folders/1ABC123xyz...`
5. **Extract ID** (portion after `/folders/`)
   - ID: `1ABC123xyz...`
6. **Save ID** for use in Smoke 2, Step 4

### OAuth Credentials (Setup by CTO/DevOps)

**Location:** Google Cloud Console → Project `hmatologia2` → APIs & Services → Credentials

**Required fields (pre-populated in Cloud Functions):**

- `VITE_GOOGLE_OAUTH_CLIENT_ID` (web)
- `DRIVE_OAUTH_CLIENT_SECRET` (backend, in Cloud Secrets Manager)

**If credentials not yet set:**

1. Create OAuth 2.0 consent screen: `https://console.cloud.google.com/apis/consent?project=hmatologia2`
   - User type: External (for test)
2. Create OAuth 2.0 Client ID:
   - Type: Web application
   - Authorized redirect URIs: `https://hmatologia2.web.app/api/sgq/oauth-callback`
3. Copy credentials to:
   - `.env.local`: `VITE_GOOGLE_OAUTH_CLIENT_ID=<client_id>`
   - Cloud Secret: `DRIVE_OAUTH_CLIENT_SECRET` → `gcloud secrets create DRIVE_OAUTH_CLIENT_SECRET --data-file=<(echo $SECRET_VALUE))`

---

## Reclamação Test Data (Smoke 3 — Optional)

### Public Form Submission

**No pre-requisites** — public form at `/reclamacao/nova` is unauthenticated

**Test input:**

- Assunto: "Resultado incorreto"
- Descrição: "Resultado de GLI não bate com manual"
- Email (optional): "test@example.com"

**Expected output:** Protocol (e.g., "REC-2026-05-06-001")

### NPS Verification

**After reclamação transitioned to `Resolvida`:**

- Check Firestore collection: `/labs/{labId}/satisfacao-respostas/`
- New document should exist with NPS link (if email was provided)

---

## Liberação Test Data (Smoke 4 — Optional)

### Prerequisites

- **Bioquímica run approved** (from Smoke 1 or separate test run)
- **Run status:** `APROVADA` (Westgard OK)

### Test Laudo Creation

**Manual trigger via UI:**

1. Navigate to run detail
2. Button "Gerar Laudo" → creates laudo doc in `/labs/{labId}/laudos/`

**Expected laudo status:** `PENDENTE` (awaiting RT signature)

---

## Cloud Function Dependencies

### Bioquímica Functions

| Function                          | Region               | Runtime | Memory  | Timeout | Secret           |
| --------------------------------- | -------------------- | ------- | ------- | ------- | ---------------- |
| `seedBioquimicaDefaults`          | `southamerica-east1` | Node 22 | 256 MB  | 60s     | —                |
| `parseBulaBioquimica`             | `southamerica-east1` | Node 22 | 1024 MB | 60s     | `GEMINI_API_KEY` |
| `recordRunBioquimica`             | `southamerica-east1` | Node 22 | 256 MB  | 60s     | —                |
| `applyBulaToLot`                  | `southamerica-east1` | Node 22 | 256 MB  | 60s     | —                |
| `generateMonthlyReportBioquimica` | `southamerica-east1` | Node 22 | 512 MB  | 120s    | —                |

### SGD Functions

| Function             | Region               | Runtime | Memory | Timeout | Secrets                     |
| -------------------- | -------------------- | ------- | ------ | ------- | --------------------------- |
| `listarDocsDrive`    | `southamerica-east1` | Node 22 | 256 MB | 30s     | `DRIVE_OAUTH_CLIENT_SECRET` |
| `previewDocDrive`    | `southamerica-east1` | Node 22 | 512 MB | 30s     | —                           |
| `aprovarBatchImport` | `southamerica-east1` | Node 22 | 256 MB | 60s     | —                           |
| `oauthCallbackDrive` | `southamerica-east1` | Node 22 | 256 MB | 30s     | `DRIVE_OAUTH_CLIENT_SECRET` |
| `classificarDocAuto` | `southamerica-east1` | Node 22 | 256 MB | 30s     | `GEMINI_API_KEY`            |

**Verification steps:**

```bash
# Check all functions deployed
firebase functions:list --project hmatologia2 | grep -E "(bioquimica|sgd)"

# Check function health
gcloud functions describe seedBioquimicaDefaults \
  --gen2 --region=southamerica-east1 --project=hmatologia2
```

---

## Environment Variables & Secrets

### Frontend (.env.local or Vite config)

```env
VITE_GOOGLE_OAUTH_CLIENT_ID=<your-oauth-client-id>
VITE_FIREBASE_API_KEY=<from-firebase-config>
VITE_FIREBASE_PROJECT_ID=hmatologia2
```

### Backend (Cloud Secrets Manager)

```bash
# Verify secrets exist
gcloud secrets list --project=hmatologia2 | grep -E "(GEMINI|DRIVE)"

# Set secret (if missing)
echo -n "your-gemini-api-key" | gcloud secrets create GEMINI_API_KEY \
  --replication-policy="automatic" \
  --project=hmatologia2 \
  --data-file=-

# Grant Cloud Functions access
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member=serviceAccount:hmatologia2@appspot.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=hmatologia2
```

---

## Firestore Indexes

### Required New Indexes (v1.3)

Deploy before running Smokes 1 & 2:

```bash
firebase deploy --only firestore:indexes --project hmatologia2
```

**Key indexes created:**

- `sgq-documentos`: (labId, status, dataRevisao)
- `sgq-documentos`: (labId, tipo, status)
- `bioquimica-runs`: (labId, equipmentId, status)

**Check status:**

```
Cloud Console → Firestore → Indexes → filter "v1.3"
All should be "Ready" before proceeding.
```

---

## Cleanup (Post-Test)

### Preserve (for audit trail)

- All test runs/lots (soft-deleted if needed, but not hard-deleted)
- All test documents (mark obsoleto, do not delete)
- All test reclamação entries
- Test lab account (reuse for future regression testing)

### Safe to Delete

- Temporary test PDFs in `/tmp/` or downloads
- Temporary auth tokens (expired after test session)

### Do NOT Delete

- Test lab account (preserve for next smoke round)
- Any Firestore documents (immutable by design)
- Audit trail entries

---

## Troubleshooting Reference

### If Gemini API Key Missing

```bash
gcloud functions describe parseBulaBioquimica \
  --gen2 --region=southamerica-east1 --project=hmatologia2 \
  --format='value(serviceConfig.secretEnvironmentVariables)'
```

Expected output: `GEMINI_API_KEY: projects/hmatologia2/secrets/GEMINI_API_KEY/versions/latest`

If missing: Set secret (see **Environment Variables** section above)

### If Drive OAuth Fails

Check consent screen status:

```
Cloud Console → APIs & Services → Credentials
→ OAuth 2.0 consent screen → Status should be "Published"
```

If "In development": Click "Edit app" → Change to "Production" (or keep as "Testing" if email test@example.com is verified with Google account)

### If Seed Analitos Not Loaded

```bash
# Manually trigger seed
gcloud functions call seedBioquimicaDefaults \
  --gen2 --region=southamerica-east1 \
  --data='{"labId":"staging-lab-2026"}' \
  --project=hmatologia2
```

Check Cloud Logging for errors:

```
gcloud functions logs read seedBioquimicaDefaults \
  --region=southamerica-east1 \
  --limit=10 \
  --project=hmatologia2
```

---

**Version:** 1.0  
**Last Updated:** 2026-05-06  
**Owner:** CTO (drogafarto)
