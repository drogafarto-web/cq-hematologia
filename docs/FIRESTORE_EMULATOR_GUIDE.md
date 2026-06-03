# Firestore Emulator Guide — Phase 3 Local Schema Testing

**Version:** 1.0  
**Status:** Ready for use  
**Audience:** Engineers, QA, CI/CD  
**Generated:** 2026-05-07

---

## Overview

This guide enables **local Firestore testing** for Phase 3 schema validation, rules verification, and multi-tenant isolation. The emulator runs on your machine with test data, allowing offline development and rapid iteration on rules, indexes, and data model changes.

**Key capabilities:**

- Local Firestore instance (port 8080) with UI (port 4000)
- Seed 3 test labs with realistic data structure
- Validate security rules before deployment
- Test multi-tenant isolation patterns
- Backup and restore snapshots for regression testing

**Time investment:** ~5 min initial setup, ~1 min to spin up per session

---

## Prerequisites

### Required

- **Node.js** 18+ (verify: `node --version`)
- **npm** 9+ (verify: `npm --version`)
- **firebase-tools** (verify: `firebase --version`)
  - Install: `npm install -g firebase-tools`
- **Git** (for this project)

### Optional but recommended

- **netcat** or **nc** (for port checking on Unix-like systems)
  - macOS: included
  - Linux: `apt-get install netcat-openbsd` (Ubuntu/Debian)
  - Windows: not required (PowerShell script auto-handles)

---

## Quick Start

### 1. Start the emulator

**macOS / Linux:**

```bash
bash scripts/firestore-emulator-setup.sh start
```

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command start
```

This will:

- Start Firestore on `localhost:8080`
- Start emulator UI on `http://localhost:4000`
- Wait for readiness check

**Expected output:**

```
✓ Loaded .env.emulator
✓ firebase-tools found
Starting Firestore emulator...
  Project: hmatologia2
  Firestore port: 8080
  UI port: 4000

Waiting for emulator to start...
✓ Emulator ready on port 8080
✓ UI available at http://localhost:4000
```

### 2. Seed test data

In a **new terminal** (keep emulator running):

**macOS / Linux:**

```bash
bash scripts/firestore-emulator-setup.sh seed
```

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command seed
```

This will:

- Create 3 test labs: `TEST-LAB-001`, `TEST-LAB-002`, `TEST-LAB-003`
- Seed portal configs with branding
- Add sample NOTIVISA events
- Create test users with module claims
- Populate sample CIQ data (runs, insumos, equipamentos, etc.)

**Expected output:**

```
✓ Loaded .env.emulator
============================================================
  STAGING DATA SEEDER
============================================================

Project: hmatologia2
Lab ID: TEST-LAB-001
Mode: Emulator

============================================================
  Step 1: Create Test Lab
============================================================

✓ Lab created: TEST-LAB-001
...
✓ Test data seeded successfully
```

### 3. Verify in Emulator UI

Open http://localhost:4000 in your browser. You should see:

- **Firestore tab** → Collections: `labs`, `portals`, `notivisa-events`, etc.
- **TEST-LAB-001** subcollection with:
  - `members/` (test users)
  - `usuarios/` (lab staff)
  - `runs/` (CIQ runs)
  - `insumos/` (consumables)
  - `equipamentos/` (equipment)

---

## Available Commands

### `start` — Launch Firestore emulator

**Bash:**

```bash
bash scripts/firestore-emulator-setup.sh start
```

**PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command start
```

Starts the Firestore emulator. Blocks until stopped (Ctrl+C).

**Options:**

- Port override: Edit `.env.emulator` → `FIRESTORE_EMULATOR_PORT`
- UI override: Edit `.env.emulator` → `FIREBASE_EMULATOR_UI_PORT`

---

### `seed` — Populate test data

**Bash:**

```bash
bash scripts/firestore-emulator-setup.sh seed
```

**PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command seed
```

Creates test labs and populates them with sample data. Uses `scripts/seed-staging-data.mjs`.

**Customization:**

- Change lab IDs: Edit `.env.emulator` → `TEST_LAB_IDS`
- Modify seed logic: Edit `scripts/seed-staging-data.mjs`

---

### `test` — Run rules validation

**Bash:**

```bash
bash scripts/firestore-emulator-setup.sh test
```

**PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command test
```

Runs the configured rules test suite (`npm run test:rules`) against the emulator.

**Prerequisites:**

- `npm run test:rules` must be configured in `package.json`
- Emulator must be running
- Test files in `__tests__/firestore.rules.test.ts` (or per your config)

**Test coverage checklist:**

- [ ] Multi-tenant isolation: `labId` path enforcement
- [ ] RBAC: member role validation (`admin`, `owner`, `rt`, `operador`, `patient`)
- [ ] Soft delete: `deletadoEm == null` filtering
- [ ] Event immutability: events subcollection `allow create` + `allow delete: false`
- [ ] Pessimistic locks: draft lock validation
- [ ] Signature validation: `hash.size() == 64` + `operatorId == request.auth.uid`

---

### `clean` — Reset emulator data

**Bash:**

```bash
bash scripts/firestore-emulator-setup.sh clean
```

**PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command clean
```

Deletes all emulator data and stops the running emulator. Backs up the current state before cleaning.

**Safety:**

- Previous state backed up to `.firebase/emulator-backups/pre-clean-<timestamp>`
- Useful for regression testing (seed → test → clean → restore)

---

### `restore` — Load from backup

**Bash:**

```bash
bash scripts/firestore-emulator-setup.sh restore <backup-name>
```

**PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command restore -BackupName "<backup-name>"
```

Restores the emulator to a previously saved state.

**Example:**

```bash
# List available backups
ls .firebase/emulator-backups

# Restore to a specific backup
bash scripts/firestore-emulator-setup.sh restore pre-clean-1715066400
```

---

### `logs` — Stream emulator logs

**Bash:**

```bash
bash scripts/firestore-emulator-setup.sh logs
```

Shows live logs from the running emulator (tail -f style). Press Ctrl+C to stop.

---

### `help` — Show usage

**Bash:**

```bash
bash scripts/firestore-emulator-setup.sh help
```

**PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command help
```

Displays command reference and examples.

---

## Configuration

### `.env.emulator` variables

| Variable                    | Default                                  | Purpose                        |
| --------------------------- | ---------------------------------------- | ------------------------------ |
| `FIREBASE_PROJECT_ID`       | `hmatologia2`                            | Project ID for emulation       |
| `FIRESTORE_EMULATOR_PORT`   | `8080`                                   | Firestore listener port        |
| `FIREBASE_EMULATOR_UI_PORT` | `4000`                                   | Emulator UI port               |
| `TEST_LAB_IDS`              | `TEST-LAB-001,TEST-LAB-002,TEST-LAB-003` | Labs to seed (comma-separated) |
| `SEED_DATA_DIR`             | `.firebase/emulator-backups`             | Backup directory               |

**Override in session:**

Bash:

```bash
export TEST_LAB_IDS="LAB-A,LAB-B"
bash scripts/firestore-emulator-setup.sh seed
```

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command seed -LabIds "LAB-A,LAB-B"
```

### Rules testing configuration

Add to `package.json` under `scripts`:

```json
"test:rules": "firebase emulators:exec 'npm run test:rules:exec' --only firestore",
"test:rules:exec": "jest --config jest.firestore.config.js"
```

Test file example (`__tests__/firestore.rules.test.ts`):

```typescript
describe('Firestore Rules — Multi-tenant', () => {
  it('should deny read of labs from different labId', async () => {
    const db = getFirestore();
    const user1Lab = doc(db, 'labs', 'LAB-A', 'runs', 'run-1');
    // ... assertion
  });
});
```

---

## Typical Workflows

### Workflow 1: Rule Development & Testing

```bash
# Terminal 1: Start emulator
bash scripts/firestore-emulator-setup.sh start

# Terminal 2: Seed test data
bash scripts/firestore-emulator-setup.sh seed

# Terminal 3: Edit rules and test
# - Edit firestore.rules
# - Run: npm run test:rules
# - Repeat until ✓

bash scripts/firestore-emulator-setup.sh test
```

### Workflow 2: Schema Validation

```bash
# 1. Start fresh
bash scripts/firestore-emulator-setup.sh clean
bash scripts/firestore-emulator-setup.sh start

# 2. Seed with old schema
TEST_LAB_IDS="OLD-LAB-v1.3" bash scripts/firestore-emulator-setup.sh seed

# 3. Verify migration script works
npm run migrate:schema

# 4. Validate new structure
open http://localhost:4000  # Inspect in UI
```

### Workflow 3: Regression Testing

```bash
# 1. Create snapshot of known-good state
bash scripts/firestore-emulator-setup.sh start
bash scripts/firestore-emulator-setup.sh seed
firebase emulators:export .firebase/emulator-backups/v1.4-baseline

# 2. Later: test changes
bash scripts/firestore-emulator-setup.sh clean
bash scripts/firestore-emulator-setup.sh restore v1.4-baseline
npm run test:rules
```

### Workflow 4: Multi-tenant Isolation Testing

```bash
# Seed multiple labs
TEST_LAB_IDS="TENANT-A,TENANT-B,TENANT-C" bash scripts/firestore-emulator-setup.sh seed

# Verify cross-tenant access is blocked
# In emulator UI: select different labs, confirm isolation
open http://localhost:4000
```

---

## Troubleshooting

### "Port 8080 already in use"

Another emulator or service is using the port. Options:

1. **Use different port:**

   ```bash
   # Edit .env.emulator
   FIRESTORE_EMULATOR_PORT=8081
   ```

2. **Kill process on port:**

   macOS / Linux:

   ```bash
   lsof -ti:8080 | xargs kill -9
   ```

   Windows (PowerShell):

   ```powershell
   Get-NetTCPConnection -LocalPort 8080 | ForEach-Object { taskkill /PID $_.OwningProcess -Force }
   ```

### "firebase-tools not installed"

```bash
npm install -g firebase-tools
firebase --version  # Verify
```

### "Seed script fails with 'Cannot find module'"

```bash
# Ensure node_modules is installed
npm install

# Re-run seed
bash scripts/firestore-emulator-setup.sh seed
```

### "Rules tests fail but rules work in UI"

Check:

1. Emulator is running (`localhost:8080` accessible)
2. `FIRESTORE_EMULATOR_HOST` env var is set by script
3. Test file has correct `initializeFirestore` with emulator settings

Example test setup:

```typescript
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const db = initializeFirestore(app, {});
connectFirestoreEmulator(db, 'localhost', 8080);
```

### "Emulator starts but seeding hangs"

1. Check network: `nc -zv localhost 8080` (Unix) or PowerShell:

   ```powershell
   Test-NetConnection -ComputerName localhost -Port 8080
   ```

2. Check logs:

   ```bash
   bash scripts/firestore-emulator-setup.sh logs
   ```

3. Restart:

   ```bash
   # Kill emulator
   pkill -f "firebase emulators:start"

   # Clean and start fresh
   bash scripts/firestore-emulator-setup.sh clean
   bash scripts/firestore-emulator-setup.sh start
   ```

### "Backup/restore not working"

Ensure `.firebase/emulator-backups` directory exists:

```bash
mkdir -p .firebase/emulator-backups
```

List backups:

```bash
ls -la .firebase/emulator-backups
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Firestore Rules Testing

on: [push, pull_request]

jobs:
  rules-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Start emulator
        run: bash scripts/firestore-emulator-setup.sh start &

      - name: Wait for emulator
        run: sleep 5

      - name: Seed test data
        run: bash scripts/firestore-emulator-setup.sh seed

      - name: Run rules tests
        run: npm run test:rules

      - name: Stop emulator
        run: pkill -f "firebase emulators:start"
```

### Local Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

if git diff --cached --name-only | grep -E "firestore\.rules|firestore\.indexes\.json"; then
  bash scripts/firestore-emulator-setup.sh start &
  sleep 3
  bash scripts/firestore-emulator-setup.sh test
  if [ $? -ne 0 ]; then
    echo "Rules tests failed. Commit aborted."
    exit 1
  fi
  pkill -f "firebase emulators:start"
fi
```

---

## Performance & Limits

### Emulator Performance

| Operation      | Typical time | Notes                   |
| -------------- | ------------ | ----------------------- |
| Start emulator | ~2-3s        | First run may be slower |
| Seed 3 labs    | ~5-8s        | Includes 100+ documents |
| Rules test run | ~3-5s        | Depends on test count   |
| Backup         | ~1-2s        | Stores to `.firebase/`  |
| Restore        | ~2-3s        | Imports from backup     |

### Data Limits

- **Docs per emulator:** Unlimited (limited by memory)
- **Document size:** 1 MB (same as production)
- **Subcollection depth:** Unlimited
- **Real-time listeners:** Supported (for local testing)

### Memory Usage

- **Baseline:** ~150 MB
- **With 10K docs:** ~300 MB
- **With 100K docs:** ~800 MB

Monitor:

```bash
ps aux | grep firebase
```

---

## Architecture

### Directory Structure

```
C:\hc quality\
├── scripts/
│   ├── firestore-emulator-setup.sh       ← Main Bash script
│   ├── firestore-emulator-setup.ps1      ← Windows PowerShell script
│   └── seed-staging-data.mjs             ← Seed data generator
├── .env.emulator                         ← Configuration
├── firestore.rules                       ← Rules (loaded by emulator)
├── firestore.indexes.json                ← Indexes (loaded by emulator)
├── firebase.json                         ← Firebase config
├── .firebase/                            ← Emulator runtime
│   └── emulator-backups/                 ← Snapshot storage
└── docs/
    └── FIRESTORE_EMULATOR_GUIDE.md       ← This file
```

### Data Flow

```
script start → firebase emulators:start
    ↓
emulator loads firestore.rules + firestore.indexes.json
    ↓
script seed → seed-staging-data.mjs creates 3 labs
    ↓
firestore.rules validate each write
    ↓
emulator accepts/rejects write
    ↓
script test → npm run test:rules validates rules + isolation
    ↓
test report → pass/fail
```

---

## Next Steps

1. **Run through Quick Start** (above) to verify setup
2. **Add rule tests** to your CI/CD pipeline (see CI/CD section)
3. **Document any custom seed data** in `seed-staging-data.mjs`
4. **Schedule backup snapshots** before major rule changes
5. **Reference** this guide when onboarding engineers

---

## Support

For issues:

1. Check **Troubleshooting** section above
2. Review script logs: `bash scripts/firestore-emulator-setup.sh logs`
3. Check Firebase emulator docs: https://firebase.google.com/docs/emulator-suite
4. Open issue with:
   - OS (macOS/Linux/Windows)
   - Node version
   - Error message
   - Steps to reproduce

---

## Related Docs

- [`firestore.rules`](../firestore.rules) — Actual security rules
- [`firestore.indexes.json`](../firestore.indexes.json) — Composite indexes
- [`PHASE_3_RUNBOOK.md`](./PHASE_3_RUNBOOK.md) — Production monitoring
- [`.claude/rules/firestore-security.md`](../.claude/rules/firestore-security.md) — Rules design patterns
- [Firebase Emulator Suite docs](https://firebase.google.com/docs/emulator-suite)

---

**Last updated:** 2026-05-07  
**Maintained by:** Engineering team  
**Status:** Production ready
