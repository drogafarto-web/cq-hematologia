---
title: Test Data Quick-Start — 5-Min Setup
version: 1.0
scope: Riopomba lab for v1.3 smoke tests
---

# Test Data Quick-Start — 5-Min Setup

**Goal:** Prepare Riopomba lab for smoke tests in minimal time.

**Estimated Time:** 5–10 minutes (assumes lab, Firebase Auth user, and Drive folder already exist)

---

## Checklist (Copy-Paste Friendly)

### 1. Create Lab Config (if missing)

**Firestore Console** → `labs/riopomba/config` → Create doc `general`:

```json
{
  "moduleFlags": {
    "bioquimica": true,
    "sgq": true,
    "reclamacoes": true,
    "liberacao": true,
    "analytics": true,
    "export": true
  }
}
```

**Status:** ☐ Done

---

### 2. Seed Bioquímica Analitos (17 docs)

**Cloud Console** (easiest):

1. Go: `https://console.cloud.google.com/functions?project=hmatologia2`
2. Find: `seedBioquimicaDefaults`
3. Click → **TESTING** tab
4. Input: `{"labId":"riopomba"}`
5. Click **Execute** → Wait <30s → Check Firestore for 17 new docs

**Status:** ☐ Done (17 analitos visible in Firestore)

---

### 3. Create Test Equipment

**Firestore Console** → `labs/riopomba/equipamentos` → Click **+ Add document**:

```json
{
  "nome": "Analisador Teste — Bioquímica",
  "modelo": "Sysmex XN-550",
  "fabricante": "Sysmex",
  "ativo": true,
  "labId": "riopomba",
  "criadoEm": "<timestamp>",
  "deletadoEm": null
}
```

**Status:** ☐ Done

---

### 4. Create Lab Settings

**Firestore Console** → `labs/riopomba/labSettings` → Create doc `general`:

```json
{
  "labId": "riopomba",
  "labName": "Laboratório Riopomba",
  "timezone": "America/Sao_Paulo",
  "region": "southamerica-east1"
}
```

**Status:** ☐ Done

---

### 5. Add Member Doc (with your UID)

**Get your UID:** Firebase Console → Authentication → Your user → Copy **User UID**

**Firestore Console** → `labs/riopomba/members` → Create doc with your **UID**:

```json
{
  "uid": "<your-uid>",
  "email": "<your-email>",
  "role": "RT",
  "isActiveMemberOfLab": true,
  "isAdminOrOwner": true
}
```

**Status:** ☐ Done

---

### 6. Create Drive Test Folder

1. Open: `https://drive.google.com`
2. **+ New** → **Folder** → Name: `HC Quality Test — 2026-05-07`
3. Right-click → **Share** → Copy link
4. Extract folder ID from URL: `/folders/{ID}`
5. **Save ID:** `_________________________`

**Status:** ☐ Done

---

### 7. Add 5 Documents to Drive Folder

Inside your test folder, create/upload:

- [ ] **MQ-001 Manual da Qualidade v1** (any PDF or Google Doc)
- [ ] **PQ-002 Procedimento de Coleta** (any PDF or Google Doc)
- [ ] **IT-003 Instrução de Uso do Analisador** (any PDF or Google Doc)
- [ ] **FR-004 Formulário de Resultado** (any PDF or Google Sheet)
- [ ] **POL-005 Política de Controle Interno** (any PDF or Google Doc)

**Status:** ☐ Done

---

### 8. Prepare Test Bula PDF

**Option A (Recommended):** Get real control material bula (PDF)  
**Option B:** Create synthetic PDF:

1. Save text to `test-bula.txt`:

   ```
   CONTROLE DE QUALIDADE INTERNO

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

2. Convert to PDF (use online tool or `libreoffice --headless --convert-to pdf test-bula.txt`)

3. Save to desktop as `test-bula.pdf`

**Status:** ☐ Done

---

### 9. Verify Cloud Functions

**Cloud Console** → Functions:

- [ ] `seedBioquimicaDefaults` — Green status
- [ ] `parseBulaBioquimica` — Green status + `GEMINI_API_KEY` env var set
- [ ] `listarDocsDrive` — Green status + `DRIVE_OAUTH_CLIENT_SECRET` env var set
- [ ] `aprovarBatchImport` — Green status
- [ ] `oauthCallbackDrive` — Green status

**Status:** ☐ All verified

---

### 10. Verify Firestore Rules

**Firestore Console** → **Rules** tab:

- [ ] Rules published (timestamp recent, no errors)

**Status:** ☐ Verified

---

## You're Ready!

Once all 10 items are checked, proceed to:

**→ Execute Smoke Test 1 (Bioquímica E2E)**  
**→ See:** `SMOKE_TESTS_v1.3.md`

---

## Quick Troubleshooting

| Issue                           | Fix                                                 |
| ------------------------------- | --------------------------------------------------- |
| Analitos not in Firestore       | Re-run `seedBioquimicaDefaults` from Cloud Console  |
| Drive folder empty after import | Verify 5 files are in folder; retry OAuth           |
| Bula parse timeout              | Use synthetic PDF; Gemini may be slow on cold start |
| Permission denied on read       | Check member doc has `isActiveMemberOfLab: true`    |
| Service Worker stale            | Hard refresh: Ctrl+Shift+R                          |

---

**Last Updated:** 2026-05-07  
**Status:** Ready for Execution
