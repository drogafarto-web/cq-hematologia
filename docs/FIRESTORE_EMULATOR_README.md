# Firestore Emulator Setup — Complete Documentation Index

**Phase 3 Local Development: Firestore schema testing, rules validation, and multi-tenant isolation.**

> **TL;DR:** `bash scripts/firestore-emulator-setup.sh start && bash scripts/firestore-emulator-setup.sh seed`  
> Then open http://localhost:4000

---

## Quick Navigation

| Need              | Document                                                                         | Time   |
| ----------------- | -------------------------------------------------------------------------------- | ------ |
| **Fast start**    | [FIRESTORE_EMULATOR_QUICK_REFERENCE.md](./FIRESTORE_EMULATOR_QUICK_REFERENCE.md) | 2 min  |
| **Full guide**    | [FIRESTORE_EMULATOR_GUIDE.md](./FIRESTORE_EMULATOR_GUIDE.md)                     | 15 min |
| **CI/CD setup**   | [FIRESTORE_EMULATOR_CI_INTEGRATION.md](./FIRESTORE_EMULATOR_CI_INTEGRATION.md)   | 10 min |
| **Test examples** | [FIRESTORE_RULES_TEST_EXAMPLE.md](./FIRESTORE_RULES_TEST_EXAMPLE.md)             | 20 min |

---

## What's Included

### Scripts

- **`scripts/firestore-emulator-setup.sh`** — Bash setup script (macOS/Linux)
  - Commands: `start`, `seed`, `test`, `clean`, `restore`, `logs`
  - Features: port detection, emulator UI, backup/restore

- **`scripts/firestore-emulator-setup.ps1`** — PowerShell setup script (Windows)
  - Same commands as Bash version
  - Windows-native port checking and process management

- **`scripts/seed-staging-data.mjs`** — Node.js seed script (pre-existing)
  - Creates 3 test labs with full data model
  - Populates members, runs, equipment, suppliers, etc.
  - Reused by emulator setup scripts

### Configuration

- **`.env.emulator`** — Emulator environment variables
  - `FIREBASE_PROJECT_ID` — Project to emulate (default: `hmatologia2`)
  - `FIRESTORE_EMULATOR_PORT` — Firestore port (default: `8080`)
  - `FIREBASE_EMULATOR_UI_PORT` — UI port (default: `4000`)
  - `TEST_LAB_IDS` — Labs to seed (default: `TEST-LAB-001,TEST-LAB-002,TEST-LAB-003`)
  - `SEED_DATA_DIR` — Backup directory (default: `.firebase/emulator-backups`)

### Documentation

1. **FIRESTORE_EMULATOR_QUICK_REFERENCE.md** — 1-pager cheat sheet
   - Command table
   - Common issues + fixes
   - Default ports & lab IDs

2. **FIRESTORE_EMULATOR_GUIDE.md** — Complete setup guide
   - Prerequisites + installation
   - Step-by-step quickstart
   - All commands with examples
   - Typical workflows (rule dev, schema validation, regression testing)
   - Troubleshooting (port conflicts, seed failures, etc.)
   - CI/CD integration examples
   - Performance notes

3. **FIRESTORE_EMULATOR_CI_INTEGRATION.md** — Pipeline setup patterns
   - GitHub Actions workflows
   - GitLab CI configuration
   - Pre-commit hooks
   - Docker integration
   - Scheduled validation jobs
   - Reporting & notifications

4. **FIRESTORE_RULES_TEST_EXAMPLE.md** — Real test code
   - Test file structure & setup
   - 6 test suites (multi-tenant, RBAC, soft delete, locks, signatures, events)
   - Jest configuration
   - Testing patterns & checklist

---

## One-Minute Setup

### Prerequisites

```bash
npm install -g firebase-tools
node --version   # 18+
npm --version    # 9+
```

### Start Emulator

**macOS / Linux:**

```bash
bash scripts/firestore-emulator-setup.sh start
```

**Windows PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1
```

### Seed Test Data

In a new terminal:

**macOS / Linux:**

```bash
bash scripts/firestore-emulator-setup.sh seed
```

**Windows PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command seed
```

### View Data

Open http://localhost:4000 in your browser.

---

## Feature Breakdown

### What the Emulator Does

✓ Runs local Firestore instance (port 8080)  
✓ Provides browser UI for data inspection (port 4000)  
✓ Loads `firestore.rules` for security validation  
✓ Loads `firestore.indexes.json` for query optimization  
✓ Stores all data in `.firebase/` (ephemeral)  
✓ Supports backup/restore for snapshots

### What the Setup Scripts Do

✓ Validate firebase-tools installation  
✓ Load configuration from `.env.emulator`  
✓ Start Firestore emulator with health checks  
✓ Seed 3 test labs with realistic data  
✓ Run rules validation tests  
✓ Manage backups and restoration  
✓ Provide cleanup and reset

### Test Data Structure

Each lab includes:

- Lab document + metadata
- 3-5 test users (admin, operator, patient, RT)
- 10-20 CIQ runs (coagulation, immunology, biochemistry)
- 5-10 consumables (insumos) with expiry tracking
- 3-5 equipment items
- 2-3 suppliers (fornecedores)
- Sample NOTIVISA events (regulatory)
- Portal configuration with branding

---

## Command Reference

### Start Emulator

```bash
bash scripts/firestore-emulator-setup.sh start
```

Launches Firestore on `localhost:8080` + UI on `http://localhost:4000`. Runs until Ctrl+C.

### Seed Test Data

```bash
bash scripts/firestore-emulator-setup.sh seed
```

Creates `TEST-LAB-001`, `TEST-LAB-002`, `TEST-LAB-003` with full data model. Requires emulator running.

### Run Rules Tests

```bash
bash scripts/firestore-emulator-setup.sh test
```

Executes `npm run test:rules` against the emulator. Validates multi-tenant isolation, RBAC, soft delete, locks, signatures.

### Clean All Data

```bash
bash scripts/firestore-emulator-setup.sh clean
```

Stops emulator, backs up current state, deletes all data. Useful for fresh starts.

### Restore from Backup

```bash
bash scripts/firestore-emulator-setup.sh restore <backup-name>
```

Loads emulator from a previously saved snapshot. Useful for regression testing.

### View Logs

```bash
bash scripts/firestore-emulator-setup.sh logs
```

Streams emulator logs. Press Ctrl+C to stop.

---

## Common Workflows

### Workflow 1: Develop Rules

```bash
# Terminal 1
bash scripts/firestore-emulator-setup.sh start

# Terminal 2
bash scripts/firestore-emulator-setup.sh seed
bash scripts/firestore-emulator-setup.sh test

# Terminal 3: Edit firestore.rules, then run tests again
# Repeat until tests pass
```

### Workflow 2: Validate Schema

```bash
bash scripts/firestore-emulator-setup.sh start
TEST_LAB_IDS="OLD-v1.3" bash scripts/firestore-emulator-setup.sh seed
npm run migrate:schema
# Verify in UI
open http://localhost:4000
```

### Workflow 3: Regression Test

```bash
bash scripts/firestore-emulator-setup.sh start
bash scripts/firestore-emulator-setup.sh seed
firebase emulators:export .firebase/emulator-backups/baseline-v1.4
# ... make changes ...
bash scripts/firestore-emulator-setup.sh clean
bash scripts/firestore-emulator-setup.sh restore baseline-v1.4
npm run test:rules
```

---

## Troubleshooting Checklist

| Issue                        | Solution                                                            |
| ---------------------------- | ------------------------------------------------------------------- |
| **Port 8080 in use**         | Use different port: `FIRESTORE_EMULATOR_PORT=8081 bash scripts/...` |
| **firebase-tools not found** | `npm install -g firebase-tools`                                     |
| **Seed script fails**        | Check emulator running: `nc -zv localhost 8080`                     |
| **Rules tests fail**         | Emulator running? `npm run test:rules` configured?                  |
| **Backup/restore broken**    | Create dir: `mkdir -p .firebase/emulator-backups`                   |
| **Emulator stuck**           | Kill: `pkill -f "firebase emulators:start"`                         |

---

## File Locations

```
C:\hc quality\
├── scripts/
│   ├── firestore-emulator-setup.sh       ← Main script
│   ├── firestore-emulator-setup.ps1      ← Windows script
│   └── seed-staging-data.mjs             ← Data generator
├── .env.emulator                         ← Config
├── firestore.rules                       ← Rules (loaded by emulator)
├── firestore.indexes.json                ← Indexes (loaded by emulator)
├── firebase.json                         ← Firebase config
├── .firebase/                            ← Runtime directory
│   ├── emulator-backups/                 ← Snapshots
│   ├── firestore_export/                 ← Emulator data
│   └── emulator.log                      ← Logs (optional)
└── docs/
    ├── FIRESTORE_EMULATOR_README.md      ← This file
    ├── FIRESTORE_EMULATOR_QUICK_REFERENCE.md
    ├── FIRESTORE_EMULATOR_GUIDE.md
    ├── FIRESTORE_EMULATOR_CI_INTEGRATION.md
    └── FIRESTORE_RULES_TEST_EXAMPLE.md
```

---

## Integration Points

### GitHub Actions

See **FIRESTORE_EMULATOR_CI_INTEGRATION.md** for ready-to-use workflows.

### Local Git Hooks

Pre-commit and pre-push hooks available for automatic validation.

### Docker

Dockerfile example provided for containerized emulator.

### NPM Scripts

Ensure `npm run test:rules` is configured in `package.json`.

---

## Performance

| Operation      | Time | Notes                 |
| -------------- | ---- | --------------------- |
| Start emulator | 2-3s | First run slower      |
| Seed 3 labs    | 5-8s | ~150 documents        |
| Rules test run | 3-5s | Depends on test count |
| Backup         | 1-2s | To disk               |
| Restore        | 2-3s | From disk             |
| Clean          | 1s   | Delete all data       |

Memory usage: 150MB baseline → 300MB with 10K docs.

---

## Related Documentation

- **[firestore.rules](../firestore.rules)** — Security rules source code
- **[firestore.indexes.json](../firestore.indexes.json)** — Composite index definitions
- **[.claude/rules/firestore-security.md](../.claude/rules/firestore-security.md)** — Rules design patterns
- **[PHASE_3_HANDBOOK.md](./PHASE_3_HANDBOOK.md)** — Phase 3 feature overview
- **[PHASE_3_RUNBOOK.md](./PHASE_3_RUNBOOK.md)** — Production monitoring

---

## Support

For issues:

1. Check **Troubleshooting** section in [FIRESTORE_EMULATOR_GUIDE.md](./FIRESTORE_EMULATOR_GUIDE.md)
2. Review script output: `bash scripts/firestore-emulator-setup.sh logs`
3. Check Firebase docs: https://firebase.google.com/docs/emulator-suite
4. File issue with: OS, Node version, error message, steps to reproduce

---

## Version Info

| Component       | Version    | Status  |
| --------------- | ---------- | ------- |
| Firestore Rules | 2          | Stable  |
| Phase           | 3          | Live    |
| Generated       | 2026-05-07 | Current |

---

**Status:** Ready for production use  
**Audience:** Engineers, QA, DevOps  
**Maintainer:** Engineering team
