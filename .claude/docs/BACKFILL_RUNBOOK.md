# Backfill Scripts Execution Runbook

**Status**: Ready to execute. Scripts exist in `functions/scripts/`. No code changes needed.

## Overview

5 backfill scripts fix legacy data integrity issues from Phase 0/1:
- `backfill-chainhash.mjs` — Seals insumo movements with chain hashes
- `backfill-hmac.mjs` — Backfills HMAC for legacy audit entries
- `backfill-notaFiscal.mjs` — Links invoices retroactively to insumos
- `backfill-pop-reference.mjs` — Adds popVersaoId to existing runs
- `backfill-naoConformidade.mjs` — Unifies scattered NCs (CT, Imuno, Análise)

All scripts:
- Operate on Firebase Firestore
- Require `GOOGLE_APPLICATION_CREDENTIALS` (Firebase Admin SDK)
- Have **dry-run by default** (safe to inspect before applying)

## Prerequisites

### 1. Test Lab Setup
- Need a Firebase Firestore test database with sample data (Phase 1 data OK)
- OR run against production lab (after CTO approval, since writes are to regulatory collections)

### 2. Environment Variables
```bash
# Required globally
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/hmatologia2-servicekey.json

# Required only for backfill-hmac.mjs
export HCQ_SIGNATURE_HMAC_KEY=$(your_hmac_secret)
```

### 3. Node Runtime
- Node 18+ (scripts use ESM)
- Firebase Admin SDK already in `functions/node_modules`

## Execution Order

**Dry-run first**, then apply in sequence:

### Step 1: backfill-chainhash.mjs
Seals insumo-movimentacoes with chain hashes (compliance-critical).

```bash
cd functions

# Dry-run (lists what would be sealed, no writes)
node scripts/backfill-chainhash.mjs

# Apply (REQUIRES CTO approval)
node scripts/backfill-chainhash.mjs --apply
```

**Expected output (dry-run)**:
```
Lab <labId> — X insumos com movimentações
  🔍 Selaria mov-123456... (insumo=ins-abc..., tipo=entrada, GENESIS) → chainHash=a1b2c3...
  ...
  Total sealed: N | Already sealed: M
```

### Step 2: backfill-hmac.mjs
Backfills HMAC for legacy audit entries per lab.

```bash
cd functions

# Dry-run (scans collection, no writes)
node scripts/backfill-hmac.mjs --labId=<lab_id>

# Apply (re-run with same command to update in-place)
node scripts/backfill-hmac.mjs --labId=<lab_id> --apply
```

**Expected output**:
```
Starting backfill for lab: <lab_id>
Querying: labs/<lab_id>/insumo-movimentacoes
Found N entries
Progress: 100/100
Backfill complete:
  Total: N
  Updated: M
  Skipped: K
  
Validation result:
  Passed: M
  Failed: 0
  Chain integrity: OK
```

### Step 3: backfill-notaFiscal.mjs
Links invoices retroactively to insumos.

```bash
node scripts/backfill-notaFiscal.mjs --labId=<lab_id>
node scripts/backfill-notaFiscal.mjs --labId=<lab_id> --apply
```

### Step 4: backfill-pop-reference.mjs
Adds popVersaoId to runs created before POP module existed.

```bash
node scripts/backfill-pop-reference.mjs --labId=<lab_id>
node scripts/backfill-pop-reference.mjs --labId=<lab_id> --apply
```

### Step 5: backfill-naoConformidade.mjs
Unifies scattered NCs (CT, Imuno, Análise).

```bash
node scripts/backfill-naoConformidade.mjs --labId=<lab_id>
node scripts/backfill-naoConformidade.mjs --labId=<lab_id> --apply
```

## Validation

After each `--apply`, verify:

```bash
# Check chainhash integrity
firebase emulators:firestore:export ./backup-before

# Query data to confirm writes
firebase firestore:get "labs/<labId>/insumo-movimentacoes/<docId>"
```

Or use Firestore Console GUI: check `chainHash`, `chainStatus` fields are populated.

## Rollback Plan

If backfill corrupts data:

1. **Before execution**: Export Firestore backup
   ```bash
   firebase emulators:firestore:export ./backup-clean
   ```

2. **After corruption detected**: Restore from backup
   ```bash
   firebase emulators:firestore:import ./backup-clean
   ```

3. **Notify**: Report to CTO with error logs + affected doc count

## CTO Sign-off Checklist

Before proceeding with `--apply` on any script:

- [ ] Dry-run output reviewed (no unintended seals/updates)
- [ ] Firestore backup created
- [ ] Test lab or staging environment confirmed
- [ ] Chain integrity validation passed
- [ ] Approval: CTO OK to write regulatory data

---

**Next step**: Get CTO approval + test lab credentials, then execute in order.
