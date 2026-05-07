# Firestore v1.3 → v1.4 Migration Guide

## Overview

Migração de Firestore para adicionar 5 novas collections por lab, preparando a infraestrutura para Phase 4 (NOTIVISA) e recursos de críticos/escalações.

**Collections criadas:**
1. `labs/{labId}/portal-configuracao/` — branding, termos de serviço, privacidade (com defaults RDC 978)
2. `labs/{labId}/notivisa-outbox/` — fila de notificações NOTIVISA (inicialmente vazio)
3. `labs/{labId}/criticos-escalacoes/` — escalações de resultados críticos (inicialmente vazio)
4. `labs/{labId}/imuno-ias-dev/` — experimentos de IA para imunologia (inicialmente vazio)
5. `labs/{labId}/laudos-draft/` — rascunhos de laudos (inicialmente vazio)

---

## Script Selection

| OS | Bash | PowerShell |
|---|---|---|
| macOS / Linux | ✓ `scripts/migrate-v1.4.sh` | — |
| Windows | (via WSL/Git Bash) | ✓ `scripts/migrate-v1.4.ps1` |

---

## Prerequisites

1. **Firebase CLI** installed and authenticated
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Lab list in environment variable** (required for production execution)
   ```bash
   # Get lab IDs from Firestore
   export LABS_LIST="lab-uuid-1,lab-uuid-2,lab-uuid-3"
   ```

3. **Permissions**: must be able to deploy to the Firebase project
   ```bash
   firebase projects:list
   ```

---

## Bash Usage (macOS/Linux)

### Dry-run (safe, no changes)
```bash
export LABS_LIST="lab-uuid-1,lab-uuid-2"
bash scripts/migrate-v1.4.sh --dry-run --project hmatologia2
```

### Execute migration
```bash
export LABS_LIST="lab-uuid-1,lab-uuid-2"
bash scripts/migrate-v1.4.sh --execute --project hmatologia2
```

### Verify log
```bash
cat migrate-v1.4.log
```

### Rollback (soft-delete)
```bash
export LABS_LIST="lab-uuid-1,lab-uuid-2"
bash scripts/migrate-v1.4-rollback.sh --execute --project hmatologia2
```

---

## PowerShell Usage (Windows)

### Dry-run (safe, no changes)
```powershell
$env:LABS_LIST = "lab-uuid-1,lab-uuid-2"
.\scripts\migrate-v1.4.ps1 -DryRun -ProjectId hmatologia2
```

### Execute migration
```powershell
$env:LABS_LIST = "lab-uuid-1,lab-uuid-2"
.\scripts\migrate-v1.4.ps1 -Execute -ProjectId hmatologia2
```

### Verify log
```powershell
Get-Content migrate-v1.4.log
```

### Rollback (soft-delete)
```powershell
$env:LABS_LIST = "lab-uuid-1,lab-uuid-2"
.\scripts\migrate-v1.4-rollback.ps1 -Execute -ProjectId hmatologia2
```

---

## Getting Lab IDs

### Option 1: From Firestore Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project `hmatologia2`
3. Firestore Database → Collections
4. Expand `labs` collection
5. Copy document IDs (these are lab UUIDs)

### Option 2: Via Firebase CLI
```bash
firebase firestore:inspect --path=labs --project=hmatologia2
```

### Option 3: List from production (if emulator access available)
```bash
# Query active labs from admin SDK
node -e "
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'hmatologia2' });
admin.firestore().collection('labs').get().then(snap => {
  snap.forEach(doc => console.log(doc.id));
});
"
```

---

## Migration Workflow

### Step 1: Prepare
```bash
# Set labs (all UUIDs from labs collection)
export LABS_LIST="$(node scripts/list-labs.js)"

# Dry-run to validate
bash scripts/migrate-v1.4.sh --dry-run
```

### Step 2: Review
- Check `migrate-v1.4.log`
- Verify all labs listed
- Confirm Firestore access works

### Step 3: Execute
```bash
bash scripts/migrate-v1.4.sh --execute
```

### Step 4: Verify
- Check Firebase Console → Firestore
- Confirm 5 collections exist per lab
- Review `migrate-v1.4.log` for status

### Step 5: Backup (optional, recommended)
```bash
firebase firestore:export backup-v1.4-$(date +%s).json --project=hmatologia2
```

---

## Schema Details

### 1. portal-configuracao/config

```json
{
  "branding": {
    "logoUrl": "",
    "primaryColor": "#7c3aed",
    "secondaryColor": "#ec4899"
  },
  "termos": {
    "versao": "1.0",
    "descricao": "Termos de serviço padrão RDC 978",
    "dataEfetivacao": "2026-05-07T12:00:00Z"
  },
  "privacidade": {
    "versao": "1.0",
    "descricao": "Política de privacidade LGPD compliant",
    "dataEfetivacao": "2026-05-07T12:00:00Z"
  },
  "ativo": true,
  "criadoEm": "2026-05-07T12:00:00Z",
  "deletadoEm": null
}
```

**Usage:** Portal client reads this to populate branding and legal docs.

### 2. notivisa-outbox/_init

```json
{
  "status": "initialized",
  "iniciadoEm": "2026-05-07T12:00:00Z",
  "versao": "1.4",
  "deletadoEm": null
}
```

**Usage:** Phase 4 writes NOTIVISA events here. _init marker is soft-deleted once first real event arrives.

### 3-5. criticos-escalacoes/_init, imuno-ias-dev/_init, laudos-draft/_init

Same structure as notivisa-outbox. Marker documents serve as collection initialization flags.

---

## Troubleshooting

### Error: "Cannot access project: hmatologia2"

**Cause:** Firebase CLI not authenticated or project not in account

**Solution:**
```bash
firebase login
firebase projects:list
```

### Error: "LABS_LIST env var not set" (in production mode)

**Cause:** Trying to execute (not dry-run) without lab list

**Solution:**
```bash
export LABS_LIST="lab1,lab2,lab3"
bash scripts/migrate-v1.4.sh --execute
```

### Error: "Firestore error" in logs

**Cause:** Permission denied or Firestore rules block write

**Solution:**
1. Verify user is `owner` of the lab
2. Check Firestore rules allow `createDocument`
3. Retry with specific lab: `export LABS_LIST="single-lab-id"`

### Dry-run shows "[DRY-RUN] Would create..." but no actual changes

**This is correct behavior.** Dry-run doesn't touch Firestore. To execute, use `--execute`.

---

## Rollback Procedure

If migration fails or needs to be undone:

```bash
# Soft-delete all 5 collections per lab (marks deletadoEm = now)
export LABS_LIST="lab1,lab2,lab3"
bash scripts/migrate-v1.4-rollback.sh --execute

# Verify in logs
cat migrate-v1.4-rollback.log
```

**Note:** Soft-delete means documents are marked with `deletadoEm` timestamp, not hard-deleted. They remain in Firestore but are filtered out by client queries.

---

## Post-Migration Tasks

1. **Deploy Firestore Rules** (if new rules added for v1.4)
   ```bash
   firebase deploy --only firestore:rules --project hmatologia2
   ```

2. **Update client-side collections** (if needed)
   - Check `src/features/*/services.ts` for collection refs
   - Add new collections to UI if portal-configuracao is used

3. **Add Functions** (if Phase 4 NOTIVISA callbacks needed)
   - Create Cloud Function for `notivisa-outbox` triggers
   - Reference: `functions/src/modules/liberacao/` pattern

4. **Test in emulator** (before production)
   ```bash
   firebase emulators:start
   # In another terminal:
   export LABS_LIST="test-lab"
   bash scripts/migrate-v1.4.sh --execute --project emulator
   ```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Firestore v1.4 Migration

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run only?'
        required: true
        default: 'true'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -g firebase-tools
      - run: firebase login --token ${{ secrets.FIREBASE_TOKEN }}
      - run: |
          export LABS_LIST="${{ secrets.LABS_LIST }}"
          bash scripts/migrate-v1.4.sh ${{ inputs.dry_run == 'true' && '--dry-run' || '--execute' }}
      - uses: actions/upload-artifact@v3
        with:
          name: migration-log
          path: migrate-v1.4.log
```

---

## Monitoring

### Real-time progress
```bash
# Terminal 1
bash scripts/migrate-v1.4.sh --execute 2>&1 | tee -a migrate-v1.4.log

# Terminal 2 (watch logs)
tail -f migrate-v1.4.log
```

### Post-execution verification
```bash
# Check collections exist
firebase firestore:inspect --path="labs/lab-uuid/portal-configuracao" --project=hmatologia2

# Count documents per collection
firebase firestore:indexes --json --project=hmatologia2 | jq '.[] | select(.collectionGroup | IN("portal-configuracao", "notivisa-outbox")) | .name'
```

---

## Performance Notes

- **Speed:** ~1-2 seconds per lab (Firestore write latency)
- **Parallel execution:** Scripts are sequential (intentional for predictability)
- **Resource impact:** Minimal (5 small documents per lab)
- **Cost:** Standard Firestore write charges (~1,500 writes per 100 labs)

---

## References

- RDC 978/2025 (Resolução ANVISA): Boas práticas de qualidade
- DICQ 4.3 (Documentação da Qualidade): Portal configuracao
- Phase 4 spec: `docs/phase-4-notivisa.md` (pending)
- Firestore rules: `firestore.rules` (v1.4 rules TBD)

---

## Support

If migration fails:
1. Check logs: `cat migrate-v1.4.log`
2. Verify Firebase CLI: `firebase --version`
3. Test Firestore access: `firebase firestore:inspect --path=labs --project=hmatologia2`
4. If stuck, rollback: `bash scripts/migrate-v1.4-rollback.sh --execute`

---

**Last updated:** 2026-05-07
**Version:** 1.4.0
**Status:** Ready for production
