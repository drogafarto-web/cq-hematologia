# v1.3 Archival Instructions

**Date:** 2026-05-07  
**Purpose:** Move Phase 8–12 directories from `.planning/phases/` to `.planning/milestones/v1.3-phases/`

## Prerequisites

- All v1.3 phase work is complete
- v1.3 is deployed to production
- v1.3-ARCHIVE-INDEX.md has been created

## Archival Steps

### Step 1: Create Archive Directory (if not exists)

```powershell
New-Item -ItemType Directory -Path ".planning/milestones/v1.3-phases" -Force
```

Or via bash:

```bash
mkdir -p ".planning/milestones/v1.3-phases"
```

### Step 2: Move Phase Directories

Move the following phase directories from `.planning/phases/` to `.planning/milestones/v1.3-phases/`:

```powershell
# Phase 8 — CAPA Closure Foundation + Housekeeping
Move-Item ".planning/phases/08-capa-closure" ".planning/milestones/v1.3-phases/"

# Phase 9 — Bioquímica
Move-Item ".planning/phases/09-bioquimica" ".planning/milestones/v1.3-phases/"

# Phase 10 — Liberação + Críticos
Move-Item ".planning/phases/10-liberacao-criticos" ".planning/milestones/v1.3-phases/"

# Phase 11 — Feedback Loop (Reclamações + Satisfação + Sugestões)
Move-Item ".planning/phases/11-feedback-loop" ".planning/milestones/v1.3-phases/"

# Phase 12 — SGD + Drive Importer
Move-Item ".planning/phases/12-sgd-drive-importer" ".planning/milestones/v1.3-phases/"
```

Or via bash:

```bash
for phase in 08-capa-closure 09-bioquimica 10-liberacao-criticos 11-feedback-loop 12-sgd-drive-importer; do
  mv ".planning/phases/$phase" ".planning/milestones/v1.3-phases/$phase"
done
```

### Step 3: Verify Archive

```powershell
Get-ChildItem ".planning/milestones/v1.3-phases"
```

Expected output (5 directories):

```
08-capa-closure
09-bioquimica
10-liberacao-criticos
11-feedback-loop
12-sgd-drive-importer
```

### Step 4: Git Commit

```bash
git add .planning/STATE.md \
        .planning/PROJECT.md \
        .planning/MILESTONES.md \
        .planning/milestones/v1.3-ARCHIVE-INDEX.md \
        .planning/milestones/v1.3-COMPLETION-SUMMARY.md \
        .planning/milestones/v1.3-DEPLOYMENT_LOG.md

git commit -m "chore(v1.3): archive milestone — 25 modules live, DICQ 78.5%, RDC 978 compliant"
```

### Step 5: Verify Git Status

```bash
git status
```

Should show:
- `.planning/STATE.md` (modified)
- `.planning/PROJECT.md` (modified)
- `.planning/MILESTONES.md` (modified)
- `.planning/milestones/v1.3-ARCHIVE-INDEX.md` (new file)
- `.planning/milestones/v1.3-COMPLETION-SUMMARY.md` (modified)
- `.planning/milestones/v1.3-DEPLOYMENT_LOG.md` (modified)
- Phase directories (deleted from `.planning/phases/`, added to `.planning/milestones/v1.3-phases/`)

## Post-Archive Cleanup (Optional)

Remove this instruction file after archival is complete:

```bash
rm ".planning/ARCHIVE_v1.3_INSTRUCTIONS.md"
git add ".planning/ARCHIVE_v1.3_INSTRUCTIONS.md"
git commit -m "chore(v1.3): remove archival instructions"
```

## Verification Checklist

After archival:

- [ ] `.planning/milestones/v1.3-phases/08-capa-closure/` exists
- [ ] `.planning/milestones/v1.3-phases/09-bioquimica/` exists
- [ ] `.planning/milestones/v1.3-phases/10-liberacao-criticos/` exists
- [ ] `.planning/milestones/v1.3-phases/11-feedback-loop/` exists
- [ ] `.planning/milestones/v1.3-phases/12-sgd-drive-importer/` exists
- [ ] `.planning/phases/08-capa-closure/` no longer exists in `.planning/phases/`
- [ ] `.planning/phases/09-bioquimica/` no longer exists in `.planning/phases/`
- [ ] `.planning/phases/10-liberacao-criticos/` no longer exists in `.planning/phases/`
- [ ] `.planning/phases/11-feedback-loop/` no longer exists in `.planning/phases/`
- [ ] `.planning/phases/12-sgd-drive-importer/` no longer exists in `.planning/phases/`
- [ ] Git shows all phase directories as moved (not deleted + added)
- [ ] `.planning/STATE.md` shows `status: v1.3-complete`
- [ ] `.planning/PROJECT.md` shows v1.3 as LIVE
- [ ] `.planning/MILESTONES.md` shows v1.3 as Complete

## Notes

- Do NOT manually delete the original phase directories. Use `Move-Item` or `mv` to preserve git history.
- All phase plans (08-01-PLAN.md, 09-01-SUMMARY.md, etc.) will move with their parent directories.
- This archival is non-destructive — original content is preserved in the milestone archive.

---

**Instructions created:** 2026-05-07 20:45 UTC  
**To execute:** Run the PowerShell or bash commands in **Step 2**, then Steps 3–5.

