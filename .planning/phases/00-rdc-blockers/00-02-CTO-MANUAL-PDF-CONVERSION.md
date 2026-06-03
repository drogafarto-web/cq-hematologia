# CTO Manual Step-by-Step: LGPD Policy PDF Conversion

## Task

Convert 2 markdown policy documents to PDF and upload to Firebase Storage.

**Files to convert:**

- `docs/policies/POL-LGPD-001-v1.0.md` → PDF
- `docs/policies/IT-LGPD-DPIA-001-v1.0.md` → PDF

**Destination (Firebase Storage):**

- `gs://hmatologia2.appspot.com/labs/labclin-riopomba/sgq/POL-LGPD-001/v1.pdf`
- `gs://hmatologia2.appspot.com/labs/labclin-riopomba/sgq/IT-LGPD-DPIA-001/v1.pdf`

---

## Prerequisites

- **pandoc** installed (cross-platform markdown → PDF converter)
  - macOS: `brew install pandoc`
  - Windows: download from https://pandoc.org/installing.html or `choco install pandoc`
  - Linux: `apt-get install pandoc` (Ubuntu/Debian)

- **Firebase CLI** authenticated

  ```bash
  firebase auth:list
  ```

  Should show your account as logged in.

- **gcloud CLI** authenticated (for signed URL generation)

  ```bash
  gcloud auth list
  ```

- **Project access**: must have Editor role on `hmatologia2` Firebase project

---

## Step 1: Convert Markdown → PDF (Local Machine)

### Option A: Using Pandoc CLI (Recommended)

From repository root, run:

```bash
# Convert POL-LGPD-001
pandoc docs/policies/POL-LGPD-001-v1.0.md \
  --from markdown \
  --to pdf \
  --output /tmp/POL-LGPD-001-v1.0.pdf

# Convert IT-LGPD-DPIA-001
pandoc docs/policies/IT-LGPD-DPIA-001-v1.0.md \
  --from markdown \
  --to pdf \
  --output /tmp/IT-LGPD-DPIA-001-v1.0.pdf
```

**Windows users** (PowerShell):

```powershell
# POL-LGPD-001
pandoc docs/policies/POL-LGPD-001-v1.0.md `
  --from markdown `
  --to pdf `
  --output $env:TEMP/POL-LGPD-001-v1.0.pdf

# IT-LGPD-DPIA-001
pandoc docs/policies/IT-LGPD-DPIA-001-v1.0.md `
  --from markdown `
  --to pdf `
  --output $env:TEMP/IT-LGPD-DPIA-001-v1.0.pdf
```

### Verify Both Files Were Created

```bash
# macOS/Linux
ls -lh /tmp/POL-LGPD-*.pdf /tmp/IT-LGPD-*.pdf

# Windows (PowerShell)
ls $env:TEMP/POL-LGPD-*.pdf, $env:TEMP/IT-LGPD-*.pdf
```

**Expected output:** 2 files, each >100 KB.

### Option B: Browser Print-to-PDF (Manual, No CLI)

If pandoc is unavailable:

1. Open markdown file in VS Code or text editor
2. Use GitHub renderer: copy file content → paste into GitHub issue (raw markdown) → right-click → Print → Save as PDF
3. Manually name files: `POL-LGPD-001-v1.0.pdf` and `IT-LGPD-DPIA-001-v1.0.pdf`
4. Save to temp location (noted above)

---

## Step 2: Upload to Firebase Storage

### Option A: Firebase CLI (Recommended)

From repository root:

```bash
# Set project to hmatologia2
firebase use hmatologia2

# Upload POL-LGPD-001
firebase storage:upload /tmp/POL-LGPD-001-v1.0.pdf \
  --remote-path labs/labclin-riopomba/sgq/POL-LGPD-001/v1.pdf

# Upload IT-LGPD-DPIA-001
firebase storage:upload /tmp/IT-LGPD-DPIA-001-v1.0.pdf \
  --remote-path labs/labclin-riopomba/sgq/IT-LGPD-DPIA-001/v1.pdf
```

**Windows (PowerShell):**

```powershell
# Set project
firebase use hmatologia2

# Upload POL-LGPD-001
firebase storage:upload "$env:TEMP/POL-LGPD-001-v1.0.pdf" `
  --remote-path "labs/labclin-riopomba/sgq/POL-LGPD-001/v1.pdf"

# Upload IT-LGPD-DPIA-001
firebase storage:upload "$env:TEMP/IT-LGPD-DPIA-001-v1.0.pdf" `
  --remote-path "labs/labclin-riopomba/sgq/IT-LGPD-DPIA-001/v1.pdf"
```

### Option B: Firebase Console (Web UI)

1. Open [Firebase Console](https://console.firebase.google.com)
2. Select **hmatologia2** project
3. Navigate to **Storage** tab
4. Click **Create folder** → name it `labs` (if not exists)
5. Inside `labs/`, create `labclin-riopomba/`
6. Inside `labclin-riopomba/`, create `sgq/`
7. Inside `sgq/`, create folder `POL-LGPD-001/`
8. Upload `POL-LGPD-001-v1.0.pdf` into that folder → rename file in Storage to `v1.pdf`
9. Repeat for `IT-LGPD-DPIA-001/` and `IT-LGPD-DPIA-001-v1.0.pdf`

**Path verification:**

- `labs/labclin-riopomba/sgq/POL-LGPD-001/v1.pdf` ✓
- `labs/labclin-riopomba/sgq/IT-LGPD-DPIA-001/v1.pdf` ✓

---

## Step 3: Generate Signed URLs

Signed URLs allow temporary access without Firebase credentials (valid 7 days by default).

```bash
# For POL-LGPD-001
firebase storage:get-signed-url labs/labclin-riopomba/sgq/POL-LGPD-001/v1.pdf --project hmatologia2

# For IT-LGPD-DPIA-001
firebase storage:get-signed-url labs/labclin-riopomba/sgq/IT-LGPD-DPIA-001/v1.pdf --project hmatologia2
```

**Windows (PowerShell):**

```powershell
firebase storage:get-signed-url "labs/labclin-riopomba/sgq/POL-LGPD-001/v1.pdf" --project hmatologia2
firebase storage:get-signed-url "labs/labclin-riopomba/sgq/IT-LGPD-DPIA-001/v1.pdf" --project hmatologia2
```

**Expected output:**

```
https://firebasestorage.googleapis.com/v0/b/hmatologia2.appspot.com/o/labs%2Flabclin-riopomba%2Fsgq%2FPOL-LGPD-001%2Fv1.pdf?alt=media&token=<TOKEN>
```

Copy both URLs → these will be referenced in the SGQ document creation step (next phase).

---

## Step 4: Validation Checklist

Before signing off:

- [ ] **Both PDFs created locally** — files exist at temp location, each >100 KB
- [ ] **Both files uploaded to Firebase Storage** — visible in Firebase Console → Storage tab
- [ ] **Correct paths** — match the structure above
- [ ] **Files are readable** — open signed URL in incognito browser, PDF displays correctly
- [ ] **Signed URLs copied** — both URLs noted for next phase (SGQ document creation)

---

## Step 5: Document URLs for Handoff

Create a simple reference sheet for the next phase (RT/SGQ team):

```text
PDF Upload Complete — 2026-05-07

POL-LGPD-001-v1.0
  Signed URL: [paste URL from Step 3]
  Expires: [7 days from upload date]

IT-LGPD-DPIA-001-v1.0
  Signed URL: [paste URL from Step 3]
  Expires: [7 days from upload date]

Firebase Storage Path:
  gs://hmatologia2.appspot.com/labs/labclin-riopomba/sgq/
```

**Next step:** RT creates SGQ document records with these URLs embedded.

---

## Troubleshooting

| Problem                         | Solution                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `pandoc: command not found`     | Install pandoc from https://pandoc.org/installing.html                                 |
| `firebase: command not found`   | Run `npm install -g firebase-tools`                                                    |
| `Error: User not authenticated` | Run `firebase login` to re-authenticate                                                |
| PDF upload fails with 403       | Verify you have Editor role on `hmatologia2` project (IAM)                             |
| Signed URL expires              | URLs are valid 7 days; regenerate with Step 3 if needed                                |
| PDF appears blank in browser    | Check that markdown file has valid frontmatter and formatting; retry pandoc conversion |

---

## Estimated Time

- Markdown → PDF conversion: **2–3 minutes**
- Firebase Storage upload: **1–2 minutes** (per file)
- Signed URL generation: **1 minute**
- **Total: ~10 minutes**

---

## Notes

- **Retention**: PDFs in Firebase Storage are retained indefinitely (not auto-deleted).
- **Versioning**: If policies are updated, increment version suffix (`v2.pdf`, `v3.pdf`).
- **Access control**: Storage rules allow reads to authenticated users in `labclin-riopomba` only. Signed URLs grant temporary public access.
- **Audit trail**: All uploads are logged in Firebase Cloud Logging (queries via `gcloud logging read`).
